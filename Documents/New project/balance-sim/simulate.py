"""
simulate.py — One simulated single-target battle.

This reproduces the non-adventure branch of ``runInstantBattle``
(server/src/persistence/localStore.ts), i.e. a single character fighting a single
scaled enemy for up to ``max_rounds`` rounds. It is the cleanest 1-vs-1 encounter
in the game and the one the design doc's "3-4 round kill" target refers to.

Mirrors the 2026-06-22 combat enrichment AND the 2026-06-23 systems:
  * combo milestones (8/12/16/20) — handled inside resolve_combo_attack
  * offensive specials (piercing/ignite/poison/frostbite/stun) applying statuses
  * per-round status resolution (burn/poison DoT, freeze, stun, armor_break)
  * boss enrage at < 40% HP (attack x1.25)
  * resource model: combo hits cost MP (all classes); the action costs 3 energy
  * 心態 (mindset): 體/韌-driven morale multiplies output and can cause a falter
  * ultimate gauge (必殺槽): charges with combo, releases an awakening burst at full
    (baseline study equips no 密技, so it uses the class awakening branch)

Baseline assumptions (documented in the report):
  * No equipment, no secondary characters, no manuals — a clean class-vs-enemy test.
  * Character main level == battle level (a single representative growth track).
  * Each battle starts at full HP/MP/energy (independent Monte Carlo sample).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import List

import formulas as F


@dataclass
class BattleOutcome:
    won: bool
    rounds: int
    total_damage: int
    damage_taken: int
    combo_lengths: List[int] = field(default_factory=list)
    finisher_count: int = 0
    attacks: int = 0
    status_procs: int = 0
    enraged: bool = False
    ended_hp_ratio: float = 1.0
    ultimate_count: int = 0
    mindset_end: int = 0


def simulate_battle(rng, class_name: str, battle_level: int, difficulty: str = "normal", layer: int = 1) -> BattleOutcome:
    stats = F.stats_at_level(class_name, battle_level)
    level = battle_level  # representative: main level tracks battle level

    mhp = F.max_hp(level, stats)
    mmp = F.max_mp(level, stats)
    meng = F.max_energy(level, stats)
    hp, mp, energy = mhp, mmp, meng

    enemy_hp, enemy_attack, max_rounds = F.solo_enemy(difficulty, layer, battle_level)
    enemy_max_hp = enemy_hp

    boss_statuses = []
    enraged = False
    mindset = F.initial_mindset(stats)        # 心態：體/韌 撐起的士氣
    ultimate_gauge = 0                          # 必殺槽：連擊與受擊充能
    outcome = BattleOutcome(won=False, rounds=0, total_damage=0, damage_taken=0)

    for rnd in range(1, max_rounds + 1):
        outcome.rounds = rnd
        if hp <= 0:
            break
        if enemy_hp <= 0:
            break

        # Spirit regens MP, vitality regens energy
        mp = min(mmp, mp + math.floor(stats["spirit"] / 6))
        energy = min(meng, energy + math.floor(stats["vitality"] / 8))

        # status resolution (DoT, freeze, stun, armor_break) at round start
        tick = F.tick_statuses(boss_statuses)
        boss_statuses = tick["statuses"]
        if tick["damage"] > 0:
            enemy_hp = max(0, enemy_hp - tick["damage"])
            outcome.total_damage += tick["damage"]
        if enemy_hp <= 0:
            break
        incoming_mult = tick["incoming_multiplier"]

        # 2026-06-23: the action itself costs 3 energy; combo hits 2..N cost MP (all classes).
        energy = max(0, energy - 3)
        base_damage = F.combo_base_damage_for(class_name, stats, max(1, battle_level))
        combo = F.resolve_combo_attack(rng, class_name, stats, battle_level, base_damage, mp)
        mp = max(0, mp - combo.resource_spent)

        # 心態：低落降傷；極低且瀕死時可能一度退縮（體/韌 大幅降低機率）
        mindset_mult = F.mindset_damage_multiplier(mindset)
        faltered = F.roll_mindset_falter(rng, mindset, hp / mhp, stats)
        if faltered:
            mindset_mult *= 0.45

        ultimate_attack_modifier = 1.0
        combo_damage = F.js_round(combo.total_damage * incoming_mult * mindset_mult)
        enemy_hp = max(0, enemy_hp - combo_damage)
        outcome.total_damage += combo_damage
        outcome.attacks += 1
        outcome.combo_lengths.append(combo.combo_length)
        if combo.finisher_triggered:
            outcome.finisher_count += 1

        # 必殺槽充能：基礎 + 連擊段數
        ultimate_gauge = min(F.ULTIMATE_MAX, ultimate_gauge + 14 + combo.combo_length * 3)

        atk = F.roll_attack_special_events(rng, stats, combo.total_damage, lowest_ally_ratio=None)
        if atk.extra_damage > 0:  # 幸運事故等：照 TS 為原值（不乘 incoming/mindset）
            enemy_hp = max(0, enemy_hp - atk.extra_damage)
            outcome.total_damage += atk.extra_damage
        if atk.support_healing > 0:
            hp = F.clamp(hp + atk.support_healing, 0, mhp)

        # advanced techniques: extra burst + status application
        off_extra, off_statuses = F.roll_offensive_specials(rng, stats, combo.total_damage)
        if off_extra > 0:
            dealt = F.js_round(off_extra * incoming_mult * mindset_mult)
            enemy_hp = max(0, enemy_hp - dealt)
            outcome.total_damage += dealt
        if off_statuses:
            boss_statuses = F.apply_statuses(boss_statuses, off_statuses)
            outcome.status_procs += len(off_statuses)

        # 必殺槽滿格：釋放覺醒爆發（baseline 未裝備密技 -> 職業覺醒分支）
        if ultimate_gauge >= F.ULTIMATE_MAX:
            ultimate_gauge = 0
            ult_base = F.combo_base_damage_for(class_name, stats, max(1, battle_level))
            ult_damage = F.js_round(ult_base * F.ULTIMATE_AWAKENING_FACTOR * mindset_mult)
            enemy_hp = max(0, enemy_hp - ult_damage)
            outcome.total_damage += ult_damage
            outcome.ultimate_count += 1
            ultimate_attack_modifier = F.ULTIMATE_BOSS_ATTACK_MODIFIER
            mindset = F.drift_mindset(mindset, stats, 8)

        if enemy_hp <= 0:
            break

        # boss enrage at low HP (once)
        if not enraged and enemy_max_hp > 0 and enemy_hp / enemy_max_hp < 0.4:
            enraged = True
            outcome.enraged = True
            enemy_attack = F.js_round(enemy_attack * 1.25)

        round_damage_taken = 0
        if tick["skip_attack"]:
            pass  # stunned: boss skips its action this round
        else:
            boss_counter = F.roll_boss_counter_event(rng, rnd, 1, enemy_attack)
            incoming_raw = F.js_round(
                (enemy_attack + rnd * 2 + boss_counter)
                * atk.boss_attack_modifier
                * combo.boss_attack_modifier
                * ultimate_attack_modifier
                * tick["attack_multiplier"]
            )
            incoming = F.mitigate_incoming_damage(incoming_raw, stats)
            block = F.roll_block_mitigation(rng, stats, incoming)
            dodge_input = max(1, incoming - block)
            dodge = F.roll_danger_dodge(rng, stats, hp / mhp, dodge_input)
            damage = max(1, incoming - block - dodge)
            hp = F.clamp(hp - damage, 0, mhp)
            mp = F.clamp(mp - math.ceil(damage / 4), 0, mmp)
            energy = F.clamp(energy - 4, 0, meng)
            outcome.damage_taken += damage
            round_damage_taken = damage

        counter = F.roll_counter_strike(rng, stats, max(1, battle_level))
        if counter > 0:
            enemy_hp = max(0, enemy_hp - counter)
            outcome.total_damage += counter

        # 心態結算：連擊振奮、退縮或受重擊受挫；體/韌 提供回穩下限
        mindset_delta = 0
        if combo.finisher_triggered or combo.combo_length >= 8:
            mindset_delta += 6
        elif combo.combo_length >= 2:
            mindset_delta += 2
        if faltered:
            mindset_delta -= 5
        if round_damage_taken > mhp * 0.18:
            mindset_delta -= 7
        mindset = F.drift_mindset(mindset, stats, mindset_delta)
        # 受擊也會充能能量槽
        if round_damage_taken > 0:
            ultimate_gauge = min(F.ULTIMATE_MAX, ultimate_gauge + 10)

    outcome.won = enemy_hp <= 0
    outcome.ended_hp_ratio = max(0.0, hp / mhp)
    outcome.mindset_end = int(mindset)
    return outcome
