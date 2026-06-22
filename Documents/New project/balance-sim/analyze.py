"""
analyze.py — Monte Carlo experiment + balance metrics.

Runs many simulated battles per (class, battle level, difficulty) cell, aggregates
with pandas, and derives quantitative "balance conflict" flags that answer the
question the game designer actually cares about:

  * Is any class dominating / starved? (win-rate spread across classes per level)
  * Are kills landing in the intended 3-4 round window? (avg rounds-to-kill)
  * Is there a "level wall" where win rate suddenly collapses?
  * Are enemies being one-shot (rounds < 2) — i.e. is HP scaling doing its job?
  * Does the finisher rate ramp up with level as designed (0% -> ~35%)?
"""

from __future__ import annotations

import random
from typing import Dict, List

import pandas as pd

import formulas as F
from simulate import simulate_battle

# Designer's intended kill-time window (docs/game-design.md).
TARGET_ROUNDS_LOW = 3.0
TARGET_ROUNDS_HIGH = 4.0
# Flag thresholds for the imbalance report.
WINRATE_SPREAD_FLAG = 0.20  # >20 pts spread between best & worst class at a level
LEVEL_WALL_DROP = 0.25      # win rate dropping >25 pts between adjacent levels
ONE_SHOT_ROUND_FLAG = 1.5   # avg rounds below this means enemies fold instantly


def run_grid(seed: int, n: int, levels: List[int], difficulty: str, layer: int = 1) -> pd.DataFrame:
    """Run ``n`` battles for every (class, level) at one difficulty -> tidy DataFrame."""
    rows: List[Dict] = []
    rng = random.Random(seed)
    for class_name in F.CLASSES:
        for level in levels:
            wins = 0
            rounds_to_kill: List[int] = []
            all_rounds: List[int] = []
            combo_all: List[int] = []
            finisher_attacks = 0
            total_attacks = 0
            total_damage = 0
            end_hp = []
            for _ in range(n):
                out = simulate_battle(rng, class_name, level, difficulty, layer)
                all_rounds.append(out.rounds)
                combo_all.extend(out.combo_lengths)
                finisher_attacks += out.finisher_count
                total_attacks += out.attacks
                total_damage += out.total_damage
                end_hp.append(out.ended_hp_ratio)
                if out.won:
                    wins += 1
                    rounds_to_kill.append(out.rounds)
            rows.append(
                dict(
                    difficulty=difficulty,
                    class_name=class_name,
                    class_label=F.CLASS_LABEL[class_name],
                    level=level,
                    win_rate=wins / n,
                    avg_rounds_to_kill=(sum(rounds_to_kill) / len(rounds_to_kill)) if rounds_to_kill else float("nan"),
                    avg_rounds_all=sum(all_rounds) / len(all_rounds),
                    avg_combo_len=(sum(combo_all) / len(combo_all)) if combo_all else 0.0,
                    max_combo_len=max(combo_all) if combo_all else 0,
                    finisher_rate=(finisher_attacks / total_attacks) if total_attacks else 0.0,
                    avg_damage_per_attack=(total_damage / total_attacks) if total_attacks else 0.0,
                    avg_end_hp_ratio=sum(end_hp) / len(end_hp),
                    samples=n,
                )
            )
    return pd.DataFrame(rows)


def combo_length_samples(seed: int, n: int, levels: List[int], difficulty: str, layer: int = 1) -> pd.DataFrame:
    """Collect raw per-attack combo lengths (for distribution histograms)."""
    rng = random.Random(seed + 1)
    rows: List[Dict] = []
    for class_name in F.CLASSES:
        for level in levels:
            for _ in range(n):
                out = simulate_battle(rng, class_name, level, difficulty, layer)
                for length in out.combo_lengths:
                    rows.append(dict(class_name=class_name, class_label=F.CLASS_LABEL[class_name], level=level, combo_len=length))
    return pd.DataFrame(rows)


def detect_imbalances(df: pd.DataFrame) -> List[Dict]:
    """Turn the aggregated grid into a list of human-readable balance findings."""
    findings: List[Dict] = []
    difficulty = df["difficulty"].iloc[0] if len(df) else "?"
    levels = sorted(df["level"].unique())

    # 1) Per-level win-rate spread across classes (class dominance / starvation).
    for level in levels:
        sub = df[df["level"] == level]
        best = sub.loc[sub["win_rate"].idxmax()]
        worst = sub.loc[sub["win_rate"].idxmin()]
        spread = best["win_rate"] - worst["win_rate"]
        if spread >= WINRATE_SPREAD_FLAG:
            findings.append(
                dict(
                    kind="class_spread",
                    level=int(level),
                    severity=round(float(spread), 3),
                    message=(
                        f"[{difficulty}] L{int(level)} class win-rate spread {spread*100:.0f}pts: "
                        f"{best['class_label']} {best['win_rate']*100:.0f}% vs {worst['class_label']} {worst['win_rate']*100:.0f}%"
                    ),
                )
            )

    # 2) Kill time outside the intended 3-4 round window.
    for _, row in df.iterrows():
        rk = row["avg_rounds_to_kill"]
        if rk == rk:  # not NaN
            if rk < ONE_SHOT_ROUND_FLAG:
                findings.append(
                    dict(kind="one_shot", level=int(row["level"]), severity=round(float(rk), 2),
                         message=f"[{difficulty}] {row['class_label']} L{int(row['level'])} kills in {rk:.1f} rounds (< {ONE_SHOT_ROUND_FLAG}) — enemy folds too fast")
                )
            elif rk > TARGET_ROUNDS_HIGH + 1.5:
                findings.append(
                    dict(kind="slow_kill", level=int(row["level"]), severity=round(float(rk), 2),
                         message=f"[{difficulty}] {row['class_label']} L{int(row['level'])} avg {rk:.1f} rounds to kill (target {TARGET_ROUNDS_LOW:.0f}-{TARGET_ROUNDS_HIGH:.0f})")
                )

    # 3) Level walls: win rate collapsing between adjacent levels for a class.
    for class_name in df["class_name"].unique():
        sub = df[df["class_name"] == class_name].sort_values("level")
        prev = None
        for _, row in sub.iterrows():
            if prev is not None:
                drop = prev["win_rate"] - row["win_rate"]
                if drop >= LEVEL_WALL_DROP:
                    findings.append(
                        dict(kind="level_wall", level=int(row["level"]), severity=round(float(drop), 3),
                             message=f"[{difficulty}] {row['class_label']} win rate drops {drop*100:.0f}pts from L{int(prev['level'])} to L{int(row['level'])}")
                    )
            prev = row

    return findings


def summarize_target_band(df: pd.DataFrame) -> Dict:
    """Fraction of (class, level) cells whose avg kill time sits in the target band."""
    valid = df[df["avg_rounds_to_kill"] == df["avg_rounds_to_kill"]]
    if not len(valid):
        return dict(in_band=0, total=0, fraction=0.0)
    in_band = valid[(valid["avg_rounds_to_kill"] >= TARGET_ROUNDS_LOW) & (valid["avg_rounds_to_kill"] <= TARGET_ROUNDS_HIGH)]
    return dict(in_band=int(len(in_band)), total=int(len(valid)), fraction=round(len(in_band) / len(valid), 3))
