"""
formulas.py — Faithful Python port of *Our Floating Castle* combat & growth math.

This module re-implements, line-for-line, the gameplay formulas that live in the
TypeScript game server, so that we can reason about balance OFFLINE without
touching the running game or its data (`server/server/data/store.json`).

Source of truth (TypeScript):
  - server/src/combatEngine.ts          連擊 / 暴擊 / 減傷 / 戰術事件
  - server/src/utils.ts                 classBaseStats、HP/MP/精力、升級與敵人縮放
  - server/src/persistence/localStore.ts runInstantBattle 單人戰鬥迴圈、soloDifficultyConfig

Every function notes the originating TS symbol + line so the port stays auditable.

Numerical fidelity notes
-------------------------
* JavaScript ``Math.round`` rounds half *up* toward +inf; all values in this model
  are non-negative, so ``js_round(x) = floor(x + 0.5)`` reproduces it exactly.
* ``Math.floor`` -> ``math.floor``; ``Math.ceil`` -> ``math.ceil``; ``Math.pow`` -> ``**``.
* Randomness uses an injected ``random.Random`` instance so a fixed seed makes a
  whole experiment reproducible. The PRNG itself differs from V8's, but every
  probability and distribution is identical to the game, which is what matters
  for a statistical balance study.
"""

from __future__ import annotations

import math
from typing import Dict, Optional

# ---------------------------------------------------------------------------
# Small numeric helpers (mirror the JS primitives used in the engine)
# ---------------------------------------------------------------------------

Stats = Dict[str, float]

STAT_KEYS = (
    "attack",
    "defense",
    "luck",
    "intelligence",
    "vitality",
    "spirit",
    "technique",
    "tenacity",
)

CLASSES = ("warrior", "assassin", "mage", "priest")
DIFFICULTIES = ("easy", "normal", "hard", "elite")


def js_round(x: float) -> int:
    """Match JavaScript ``Math.round`` for non-negative inputs (round half up)."""
    return math.floor(x + 0.5)


def clamp(value: float, low: float, high: float) -> float:
    return min(high, max(low, value))


def chance(base: float, stat: float, per_point: float, mx: float) -> float:
    """combatEngine.ts:3 — chance(base, stat, perPoint, max)."""
    return min(mx, base + max(0.0, stat) * per_point)


# ---------------------------------------------------------------------------
# Class identity: base stats & representative growth (utils.ts:83 classBaseStats)
# ---------------------------------------------------------------------------

# NOTE: warrior uses its PRE-TUNING values (technique=4, spirit=5) on purpose.
# This is the baseline the study analysed; it is what surfaced the warrior gap.
# Based on that finding the live game was tuned (technique 4->8, spirit 5->6 in
# server/src/utils.ts classBaseStats). `python main.py --tune` reproduces the
# projected post-tuning balance, so the before/after in the report stays valid.
CLASS_BASE_STATS: Dict[str, Stats] = {
    "warrior": dict(attack=12, defense=6, luck=3, intelligence=5, vitality=8, spirit=5, technique=4, tenacity=7),
    "assassin": dict(attack=11, defense=4, luck=8, intelligence=5, vitality=5, spirit=5, technique=12, tenacity=4),
    "mage": dict(attack=4, defense=3, luck=4, intelligence=13, vitality=4, spirit=8, technique=7, tenacity=3),
    "priest": dict(attack=5, defense=4, luck=7, intelligence=7, vitality=6, spirit=13, technique=4, tenacity=5),
}

CLASS_LABEL = {"warrior": "Warrior", "assassin": "Assassin", "mage": "Mage", "priest": "Priest"}

# --- Representative growth model (EXPLICIT MODELLING ASSUMPTION) ------------
# In the real game a character's stats come from the player's TRAINING choices
# (fishing/reading/boxing/... each raise a different stat) plus equipment, which
# an offline model cannot know. For a fair, reproducible class-vs-class study we
# assume each level-up invests POINTS_PER_LEVEL stat points *proportionally to the
# class's innate identity* (its classBaseStats distribution). This keeps every
# class growing along its own design axis (warrior -> attack, mage -> int, ...).
# It is a simplification and is documented as such in the report.
POINTS_PER_LEVEL = 7


def stats_at_level(class_name: str, level: int) -> Stats:
    base = CLASS_BASE_STATS[class_name]
    total = float(sum(base.values()))
    growth_steps = max(0, level - 1)
    out: Stats = {}
    for key in STAT_KEYS:
        out[key] = base[key] + js_round(base[key] / total * POINTS_PER_LEVEL * growth_steps)
    return out


# ---------------------------------------------------------------------------
# Derived pools (utils.ts:1052-1068)
# ---------------------------------------------------------------------------

def max_hp(level: int, stats: Stats) -> int:
    return 80 + level * 8 + int(stats["vitality"]) * 4 + int(stats["defense"]) * 3 + int(stats["tenacity"])


def max_mp(level: int, stats: Stats) -> int:
    return 30 + level * 5 + int(stats["intelligence"]) * 4 + int(stats["spirit"]) * 3 + int(stats["technique"])


def max_energy(level: int, stats: Stats) -> int:
    return 60 + level * 6 + int(stats["vitality"]) * 2 + int(stats["spirit"]) * 2 + int(stats["technique"]) * 2


def next_level_requirement(level: int) -> int:
    """utils.ts:1070 — front-loaded growth curve. L1~110, L5~520, L10~1340, L20~3650."""
    return max(60, js_round(70 + (max(1, level) ** 1.5) * 40))


# ---------------------------------------------------------------------------
# Enemy scaling
# ---------------------------------------------------------------------------

def boss_base_hp(member_count: int, context: str = "raid", avg_battle_level: float = 1) -> int:
    """utils.ts:1075 — raid/room boss HP (quadratic level term to avoid one-shots)."""
    level_factor = max(0.0, avg_battle_level - 1)
    level_scale = 1 + level_factor * 0.2 + level_factor * level_factor * 0.01
    base = (180 + member_count * 80) * level_scale
    mult = {"castle": 1.15, "factionBoss": 1.3, "guildBoss": 1.3, "worldBoss": 1.6}.get(context, 1.0)
    return js_round(base * mult)


def boss_base_attack(member_count: int, context: str = "raid", avg_battle_level: float = 1) -> int:
    """utils.ts:1085 — raid/room boss attack."""
    level_scale = 1 + max(0.0, avg_battle_level - 1) * 0.07
    base = (11 + member_count * 3) * level_scale
    mult = {"castle": 1.1, "factionBoss": 1.25, "guildBoss": 1.25, "worldBoss": 1.45}.get(context, 1.0)
    return js_round(base * mult)


# defaultSoloDifficulties (utils.ts:1531)
SOLO_DIFFICULTY_BASE = {
    "easy": dict(hp=90, attack=12, gold=24, exp=18, qty=1),
    "normal": dict(hp=145, attack=18, gold=42, exp=32, qty=1),
    "hard": dict(hp=220, attack=26, gold=72, exp=54, qty=2),
    "elite": dict(hp=330, attack=36, gold=120, exp=90, qty=3),
}


def solo_enemy(difficulty: str, layer: int, battle_level: int):
    """localStore.ts:4210 soloDifficultyConfig — single-target enemy hp/attack/rounds.

    Returns (enemy_hp, enemy_attack, max_rounds).
    """
    cfg = SOLO_DIFFICULTY_BASE.get(difficulty, SOLO_DIFFICULTY_BASE["normal"])
    lf = max(0, battle_level - 1)
    enemy_hp = js_round((cfg["hp"] + layer * 18) * (1 + lf * 0.22 + lf * lf * 0.012))
    enemy_attack = js_round((cfg["attack"] + layer * 3) * (1 + lf * 0.08))
    return enemy_hp, enemy_attack, 8


# ---------------------------------------------------------------------------
# SAO-style combo chain (combatEngine.ts:177-374)
# ---------------------------------------------------------------------------

COMBO_HARD_CAP = 20


def combo_cap_for_level(battle_level: int) -> int:
    return max(1, min(COMBO_HARD_CAP, math.floor(battle_level)))


def combo_continue_chance(stats: Stats, battle_level: int) -> float:
    # 2026-06-23 retune: speed(spirit) now leads combo continuation (大);
    # technique now leads hit/crit. combatEngine.ts:366 comboContinueChance.
    return min(
        0.94,
        0.45 + max(0.0, stats["spirit"]) * 0.016 + max(0.0, stats["technique"]) * 0.006 + max(0.0, battle_level) * 0.006,
    )


def combo_miss_chance(stats: Stats) -> float:
    # combatEngine.ts:373 — technique reduces miss most, speed secondary.
    return max(0.015, 0.11 - max(0.0, stats["technique"]) * 0.004 - max(0.0, stats["spirit"]) * 0.003)


def crit_chance(stats: Stats) -> float:
    # combatEngine.ts:377 — technique leads crit (大), luck/speed minor.
    return min(
        0.42,
        0.05 + max(0.0, stats["technique"]) * 0.009 + max(0.0, stats["luck"]) * 0.003 + max(0.0, stats["spirit"]) * 0.002,
    )


def crit_multiplier(stats: Stats) -> float:
    return 1.45 + min(0.65, max(0.0, stats["luck"]) * 0.01 + max(0.0, stats["intelligence"]) * 0.003)


def combo_base_damage_for(class_name: str, stats: Stats, battle_level: int = 1, role_bonus: int = 0) -> int:
    """combatEngine.ts:236 comboBaseDamageFor — per-class single-hit base damage."""
    level_bonus = math.floor(max(1, battle_level) / 2)
    if class_name == "mage":
        return 8 + js_round(stats["intelligence"] * 1.8 + stats["technique"] * 0.5) + level_bonus + role_bonus
    if class_name == "assassin":
        return 7 + js_round(stats["attack"] * 1.2 + stats["technique"] * 1.0 + stats["luck"] * 0.4) + level_bonus + role_bonus
    if class_name == "priest":
        return 6 + js_round(stats["attack"] * 0.35 + stats["spirit"] * 0.8 + stats["intelligence"] * 0.75) + level_bonus + role_bonus
    return 8 + js_round(stats["attack"] * 1.5 + stats["technique"] * 0.5) + level_bonus + role_bonus


class ComboResult:
    __slots__ = ("total_damage", "combo_length", "missed", "finisher_triggered", "resource_spent", "boss_attack_modifier")

    def __init__(self, total_damage, combo_length, missed, finisher_triggered, resource_spent, boss_attack_modifier):
        self.total_damage = total_damage
        self.combo_length = combo_length
        self.missed = missed
        self.finisher_triggered = finisher_triggered
        self.resource_spent = resource_spent
        self.boss_attack_modifier = boss_attack_modifier


COMBO_MILESTONES = ((20, 0.4), (16, 0.3), (12, 0.2), (8, 0.12))


def _apply_combo_milestone(total_damage: int, hits: int) -> int:
    """combatEngine.ts resolveComboAttack — 8/12/16/20 combo milestone bonus."""
    for threshold, factor in COMBO_MILESTONES:
        if hits >= threshold:
            return total_damage + js_round(total_damage * factor)
    return total_damage


def resolve_combo_attack(rng, class_name: str, stats: Stats, battle_level: int, base_damage: int, available_mp: int) -> ComboResult:
    """combatEngine.ts:431 resolveComboAttack — the full per-hit combo chain.

    2026-06-23 resource model: combo hits 2..N each cost 1 *MP* for ALL classes
    (was energy for non-mages). The per-action energy cost is handled by the caller.
    """
    cap = combo_cap_for_level(battle_level)
    p_continue = combo_continue_chance(stats, battle_level)
    p_miss = combo_miss_chance(stats)
    p_crit = crit_chance(stats)
    crit_mult = crit_multiplier(stats)

    total_damage = 0
    missed = False
    resource_spent = 0
    boss_attack_modifier = 1.0
    hits = 0

    hit_index = 1
    while hit_index <= cap:
        if hit_index > 1:
            if resource_spent + 1 > available_mp:
                break  # 資源不足，連擊中斷
            if rng.random() >= p_continue:
                break  # 沒接上
            resource_spent += 1
            if rng.random() < p_miss:
                missed = True
                break

        decay = max(0.4, 0.9 ** (hit_index - 1))
        variance = 0.9 + rng.random() * 0.2
        is_crit = rng.random() < p_crit
        damage = max(1, js_round(base_damage * decay * variance * (crit_mult if is_crit else 1)))

        is_last_possible = hit_index == cap
        chain_long_enough = hit_index >= 4
        finisher = chain_long_enough and (
            is_last_possible or (rng.random() >= p_continue) or (resource_spent + 1 > available_mp)
        )
        if finisher:
            damage = max(damage, js_round(base_damage * (1 + 0.06 * hit_index) * (crit_mult if is_crit else 1)))
            boss_attack_modifier = min(boss_attack_modifier, 0.88)

        total_damage += damage
        hits += 1
        if finisher:
            return ComboResult(_apply_combo_milestone(total_damage, hits), hits, missed, True, resource_spent, boss_attack_modifier)
        hit_index += 1

    return ComboResult(_apply_combo_milestone(total_damage, hits), hits, missed, False, resource_spent, boss_attack_modifier)


# ---------------------------------------------------------------------------
# Mitigation & tactical events (combatEngine.ts:11-381)
# ---------------------------------------------------------------------------

def mitigate_incoming_damage(raw_damage: float, stats: Stats) -> int:
    """combatEngine.ts:377 — defense % + flat, tenacity flat."""
    percent_reduction = max(0.0, stats["defense"]) / (max(0.0, stats["defense"]) + 80)
    # 2026-06-23: tenacity gives a larger flat (hard) reduction (/3, was /4). combatEngine.ts:563.
    flat_reduction = math.floor(max(0.0, stats["tenacity"]) / 3) + math.floor(max(0.0, stats["defense"]) / 10)
    return max(1, js_round(raw_damage * (1 - percent_reduction)) - flat_reduction)


class AttackSpecials:
    __slots__ = ("extra_damage", "support_healing", "boss_attack_modifier")

    def __init__(self, extra_damage, support_healing, boss_attack_modifier):
        self.extra_damage = extra_damage
        self.support_healing = support_healing
        self.boss_attack_modifier = boss_attack_modifier


def roll_attack_special_events(rng, stats: Stats, base_damage: int, lowest_ally_ratio: Optional[float] = None) -> AttackSpecials:
    """combatEngine.ts:11 rollAttackSpecialEvents — armor break / ally support / lucky twist."""
    extra_damage = 0
    support_healing = 0
    boss_attack_modifier = 1.0

    # 精準破防
    if rng.random() < chance(0.04, stats["technique"] + math.floor(stats["intelligence"] / 2), 0.008, 0.28):
        boss_attack_modifier = 0.9

    # 隊友支援 (solo: no ally -> skipped)
    if lowest_ally_ratio is not None and lowest_ally_ratio < 0.72:
        if rng.random() < chance(0.04, stats["luck"] + stats["technique"], 0.004, 0.24):
            support_healing = max(4, js_round(6 + stats["spirit"] * 0.8 + stats["luck"] * 0.4))

    # 幸運事故
    if rng.random() < chance(0.03, stats["luck"], 0.006, 0.24):
        damage = max(3, js_round(base_damage * (0.1 + min(0.18, stats["luck"] * 0.004))))
        extra_damage += damage
        boss_attack_modifier = min(boss_attack_modifier, 0.94)

    return AttackSpecials(extra_damage, support_healing, boss_attack_modifier)


def roll_danger_dodge(rng, stats: Stats, hp_ratio: float, incoming_damage: int) -> int:
    """combatEngine.ts:70 rollDangerDodge — low-HP emergency dodge. Returns reduction."""
    # 2026-06-23: speed(spirit) leads dodge (大), luck secondary, technique minor.
    dodge_stat = stats["spirit"] + math.floor(stats["luck"] * 0.5) + math.floor(stats["technique"] * 0.25)
    if hp_ratio > 0.38 or rng.random() >= chance(0.05, dodge_stat, 0.006, 0.42):
        return 0
    return max(1, math.ceil(incoming_damage * 0.45))


def roll_block_mitigation(rng, stats: Stats, incoming_damage: int) -> int:
    """combatEngine.ts:95 rollBlockMitigation — block. Returns reduction."""
    # 2026-06-23: block led by defense + technique (大), tenacity minor.
    block_stat = stats["defense"] + math.floor(stats["technique"] * 0.7) + math.floor(stats["tenacity"] * 0.2)
    if rng.random() >= chance(0.04, block_stat, 0.006, 0.38):
        return 0
    reduction_rate = min(0.55, 0.22 + stats["defense"] * 0.004 + stats["tenacity"] * 0.003)
    return max(1, js_round(incoming_damage * reduction_rate))


def roll_counter_strike(rng, stats: Stats, battle_level: int) -> int:
    """combatEngine.ts:121 rollCounterStrike — technique counter. Returns damage."""
    # 2026-06-23: counter led by technique (大); speed only a minor window.
    counter_stat = stats["technique"] + math.floor(stats["spirit"] * 0.3)
    if rng.random() >= chance(0.03, counter_stat, 0.006, 0.34):
        return 0
    return max(3, js_round(6 + stats["attack"] * 0.75 + stats["technique"] * 1.15 + stats["spirit"] * 0.35 + battle_level * 1.5))


def roll_offensive_specials(rng, stats: Stats, base_damage: int):
    """combatEngine.ts rollOffensiveSpecials — piercing/ignite/poison/frostbite/stun.

    Returns (extra_damage, statuses) where statuses is a list of
    {kind, remaining, magnitude} dicts to apply to the enemy.
    """
    extra_damage = 0
    statuses = []
    if rng.random() < chance(0.05, stats["attack"] + math.floor(stats["technique"] / 2), 0.007, 0.3):
        extra_damage += max(5, js_round(base_damage * 0.4))
        statuses.append({"kind": "armor_break", "remaining": 2, "magnitude": 0.12})
    if rng.random() < chance(0.05, stats["intelligence"] + math.floor(stats["technique"] / 2), 0.006, 0.3):
        statuses.append({"kind": "burn", "remaining": 3, "magnitude": max(3, js_round(base_damage * 0.15))})
    if rng.random() < chance(0.045, stats["luck"] + stats["technique"], 0.005, 0.28):
        statuses.append({"kind": "poison", "remaining": 3, "magnitude": max(2, js_round(base_damage * 0.1))})
    if rng.random() < chance(0.04, stats["intelligence"] + stats["spirit"], 0.005, 0.24):
        statuses.append({"kind": "freeze", "remaining": 1, "magnitude": 0.6})
    if rng.random() < chance(0.03, stats["attack"] + stats["technique"], 0.004, 0.2):
        statuses.append({"kind": "stun", "remaining": 1, "magnitude": 1})
    return extra_damage, statuses


def apply_statuses(target, incoming):
    """combatEngine.ts applyStatuses — poison stacks, others refresh; returns new list."""
    out = [dict(s) for s in target]
    for st in incoming:
        existing = next((e for e in out if e["kind"] == st["kind"]), None)
        if existing:
            existing["remaining"] = max(existing["remaining"], st["remaining"])
            existing["magnitude"] = (
                min(existing["magnitude"] + st["magnitude"], st["magnitude"] * 5)
                if st["kind"] == "poison"
                else max(existing["magnitude"], st["magnitude"])
            )
        else:
            out.append(dict(st))
    return out


def tick_statuses(statuses):
    """combatEngine.ts tickStatuses — DoT, freeze (attack down), stun (skip), armor_break (incoming up)."""
    damage = 0
    attack_multiplier = 1.0
    incoming_multiplier = 1.0
    skip_attack = False
    survivors = []
    for st in statuses:
        if st["kind"] in ("burn", "poison"):
            damage += st["magnitude"]
        elif st["kind"] == "freeze":
            attack_multiplier *= st["magnitude"]
        elif st["kind"] == "stun":
            skip_attack = True
        elif st["kind"] == "armor_break":
            incoming_multiplier *= 1 + st["magnitude"]
        remaining = st["remaining"] - 1
        if remaining > 0:
            survivors.append({**st, "remaining": remaining})
    return {
        "damage": damage,
        "attack_multiplier": attack_multiplier,
        "incoming_multiplier": incoming_multiplier,
        "skip_attack": skip_attack,
        "statuses": survivors,
    }


def roll_boss_counter_event(rng, tick: int, living_count: int, attack_power: int) -> int:
    """combatEngine.ts:154 rollBossCounterEvent — boss pressure from tick 2+. Returns damage."""
    if tick < 2 or rng.random() >= min(0.34, 0.12 + tick * 0.015):
        return 0
    return max(3, js_round(attack_power * (0.45 if living_count >= 3 else 0.3)))


# ---------------------------------------------------------------------------
# 心態 (mindset / morale) system — combatEngine.ts:567-614 (2026-06-23)
# vitality + tenacity prop up morale: high morale = a small damage buff,
# low morale = a small damage penalty; high 體/韌 means the character will
# not lose damage or falter from low morale.
# ---------------------------------------------------------------------------

def initial_mindset(stats: Stats) -> int:
    """combatEngine.ts:574 initialMindset — opening morale (0–100)."""
    base = 50 + max(0.0, stats["vitality"]) * 1.2 + max(0.0, stats["tenacity"]) * 2.6
    return js_round(min(100, max(20, base)))


def drift_mindset(current: float, stats: Stats, delta: float) -> int:
    """combatEngine.ts:583 driftMindset — per-round morale drift with 體/韌 recovery floor."""
    recovery = 1 + max(0.0, stats["vitality"]) * 0.05 + max(0.0, stats["tenacity"]) * 0.12
    floor = min(60, 18 + max(0.0, stats["tenacity"]) * 1.4 + max(0.0, stats["vitality"]) * 0.4)
    nxt = current + delta + (recovery if delta >= 0 else recovery * 0.5)
    return js_round(min(100, max(floor, nxt)))


def mindset_damage_multiplier(mindset: float) -> float:
    """combatEngine.ts:591 mindsetDamageMultiplier — output multiplier by morale band."""
    if mindset >= 80:
        return 1.12
    if mindset >= 55:
        return 1.0
    if mindset >= 30:
        return 0.94
    return 0.85


def mindset_label(mindset: float) -> str:
    """combatEngine.ts:599 mindsetLabel."""
    if mindset >= 80:
        return "亢奮"
    if mindset >= 55:
        return "穩定"
    if mindset >= 30:
        return "緊繃"
    return "低落"


def roll_mindset_falter(rng, mindset: float, hp_ratio: float, stats: Stats) -> bool:
    """combatEngine.ts:609 rollMindsetFalter — only when morale is very low AND near death;
    高體/韌 大幅降低退縮機率（高韌幾乎不退縮）。"""
    if mindset >= 22 or hp_ratio > 0.25:
        return False
    resolve = max(0.0, stats["tenacity"]) * 0.05 + max(0.0, stats["vitality"]) * 0.02
    return rng.random() < max(0.0, 0.32 - resolve)


# ---------------------------------------------------------------------------
# Ultimate gauge (必殺槽) — localStore.ts runInstantBattle (2026-06-23)
# Charges by combo length each round (+10 when hit); at full it releases an
# equipped 密技. The offline baseline study equips NO skill, so the gauge falls
# to the class "awakening burst" branch: ultBase * 3.2 * mindset, boss atk x0.85.
# ---------------------------------------------------------------------------

ULTIMATE_MAX = 100
ULTIMATE_AWAKENING_FACTOR = 3.2  # localStore.ts:4677 — no equipped 密技 branch
ULTIMATE_BOSS_ATTACK_MODIFIER = 0.85
