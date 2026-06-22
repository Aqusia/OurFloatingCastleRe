"""
main.py — One-shot driver for the Our Floating Castle balance study.

Usage:
    python main.py                         # default study (seed 20260622, N=4000)
    python main.py --n 1000 --quick        # faster smoke run
    python main.py --difficulty hard       # primary difficulty for win-rate figs
    python main.py --tune                   # also run the proposed-tuning comparison

Outputs (written to ./output):
    summary_<difficulty>.csv      aggregated grid per difficulty
    summary_all.csv               every difficulty concatenated
    imbalance_report.txt          human-readable balance findings
    fig1..fig9 *.png              charts cited by the written report
"""

from __future__ import annotations

import argparse
import json
import os
from typing import List

import pandas as pd

import analyze
import formulas as F
import plots

DEFAULT_SEED = 20260622


def _levels(quick: bool) -> List[int]:
    return list(range(1, 21)) if not quick else [1, 5, 10, 16, 20]


def run_study(seed: int, n: int, quick: bool, primary_difficulty: str, do_tune: bool, outdir: str) -> None:
    os.makedirs(outdir, exist_ok=True)
    levels = _levels(quick)
    difficulties = list(F.DIFFICULTIES)

    print(f"== Our Floating Castle balance study ==")
    print(f"seed={seed}  N={n}/cell  levels={levels[0]}..{levels[-1]}  difficulties={difficulties}")

    grids = {}
    for diff in difficulties:
        print(f"  simulating difficulty='{diff}' ...")
        grids[diff] = analyze.run_grid(seed, n, levels, diff)
        grids[diff].to_csv(os.path.join(outdir, f"summary_{diff}.csv"), index=False)

    all_df = pd.concat(grids.values(), ignore_index=True)
    all_df.to_csv(os.path.join(outdir, "summary_all.csv"), index=False)

    # --- figures -----------------------------------------------------------
    primary = grids[primary_difficulty]
    saved = []
    try:
        from make_architecture import build_architecture
        saved.append(build_architecture(outdir))
    except Exception as exc:  # diagram is non-critical; never break the study
        print(f"  (architecture diagram skipped: {exc})")
    saved.append(plots.plot_winrate_vs_level(primary, outdir, primary_difficulty))
    saved.append(plots.plot_rounds_vs_level(grids["normal"], outdir, "normal"))
    combo_df = analyze.combo_length_samples(seed, max(400, n // 4), levels, "normal")
    saved.append(plots.plot_combo_distribution(combo_df, outdir, levels))
    saved.append(plots.plot_damage_by_class(grids["normal"], outdir, "normal", levels))
    saved.append(plots.plot_finisher_rate(grids["normal"], outdir, "normal"))
    saved.append(plots.plot_level_curve(outdir))
    saved.append(plots.plot_enemy_scaling(outdir))
    saved.append(plots.plot_winrate_convergence(seed, "warrior", 12, primary_difficulty, outdir, max_n=min(4000, max(1000, n))))

    # --- imbalance report --------------------------------------------------
    lines: List[str] = []
    lines.append("Our Floating Castle - automated balance findings")
    lines.append(f"(seed={seed}, N={n}/cell, levels {levels[0]}-{levels[-1]})\n")
    for diff in difficulties:
        df = grids[diff]
        band = analyze.summarize_target_band(df)
        lines.append(f"### difficulty = {diff}")
        lines.append(
            f"  kill-time in target {analyze.TARGET_ROUNDS_LOW:.0f}-{analyze.TARGET_ROUNDS_HIGH:.0f} rounds: "
            f"{band['in_band']}/{band['total']} cells ({band['fraction']*100:.0f}%)"
        )
        findings = analyze.detect_imbalances(df)
        if not findings:
            lines.append("  no flagged imbalances at this difficulty.")
        for f in findings:
            lines.append(f"  - {f['message']}")
        lines.append("")

    report_text = "\n".join(lines)
    with open(os.path.join(outdir, "imbalance_report.txt"), "w", encoding="utf-8") as fh:
        fh.write(report_text)
    print("\n" + report_text)

    # --- optional proposed-tuning comparison -------------------------------
    if do_tune:
        _run_tuning_comparison(seed, n, levels, outdir)

    print("Saved figures:")
    for path in saved:
        print("  " + os.path.relpath(path, outdir))
    print(f"All outputs in: {outdir}")


TECH_BUFF = 4
SPIRIT_BUFF = 1


def _run_tuning_comparison(seed: int, n: int, levels: List[int], outdir: str) -> None:
    """Demonstrate the tool's decision value: re-run with a proposed tuning and
    compare before/after.

    The simulation traces the weakest class's poor win rate to a ROOT CAUSE: its
    low technique/spirit starve the combo-continuation chance, so it cannot chain
    hits the way the combo system rewards. The proposed fix raises that class's
    base technique (+4) and spirit (+1) in ``classBaseStats``. We apply it here by
    patching the in-memory stat table (never touching live game data) to project
    the effect; the same change is then applied to the TypeScript game source.
    """
    print("  running proposed-tuning comparison ...")
    diff = "elite"
    before = analyze.run_grid(seed, n, levels, diff)

    weakest = before.groupby("class_name")["win_rate"].mean().idxmin()
    print(f"    weakest class before tuning: {weakest}")

    original_stats = dict(F.CLASS_BASE_STATS[weakest])
    tuned_stats = dict(original_stats)
    tuned_stats["technique"] = original_stats["technique"] + TECH_BUFF
    tuned_stats["spirit"] = original_stats["spirit"] + SPIRIT_BUFF
    F.CLASS_BASE_STATS[weakest] = tuned_stats
    try:
        after = analyze.run_grid(seed, n, levels, diff)
    finally:
        F.CLASS_BASE_STATS[weakest] = original_stats

    before.to_csv(os.path.join(outdir, f"tuning_before_{diff}.csv"), index=False)
    after.to_csv(os.path.join(outdir, f"tuning_after_{diff}.csv"), index=False)
    plots.plot_before_after(
        before, after, outdir,
        metric="win_rate", ylabel="Win Rate (fraction)",
        title=f"Win Rate Before vs After Tuning ({F.CLASS_LABEL[weakest]} technique +{TECH_BUFF} / spirit +{SPIRIT_BUFF}, {diff})",
        name="fig8_tuning_before_after.png",
    )

    spread_before = before.groupby("level")["win_rate"].agg(lambda s: s.max() - s.min()).mean()
    spread_after = after.groupby("level")["win_rate"].agg(lambda s: s.max() - s.min()).mean()
    wr_before = before[before["class_name"] == weakest]["win_rate"].mean()
    wr_after = after[after["class_name"] == weakest]["win_rate"].mean()
    print(f"    mean class win-rate spread: {spread_before*100:.1f}pts -> {spread_after*100:.1f}pts")
    print(f"    {weakest} mean win rate: {wr_before*100:.1f}% -> {wr_after*100:.1f}%")
    with open(os.path.join(outdir, "tuning_summary.json"), "w", encoding="utf-8") as fh:
        json.dump(
            dict(weakest_class=weakest, change=f"technique +{TECH_BUFF}, spirit +{SPIRIT_BUFF}",
                 mean_spread_before=round(float(spread_before), 4),
                 mean_spread_after=round(float(spread_after), 4),
                 weakest_winrate_before=round(float(wr_before), 4),
                 weakest_winrate_after=round(float(wr_after), 4)),
            fh, indent=2,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Our Floating Castle offline balance simulator")
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--n", type=int, default=4000, help="battles per (class, level) cell")
    parser.add_argument("--quick", action="store_true", help="fewer levels for a fast smoke run")
    parser.add_argument("--difficulty", default="elite", choices=list(F.DIFFICULTIES), help="primary difficulty for win-rate figures")
    parser.add_argument("--tune", action="store_true", help="also run the proposed-tuning before/after comparison")
    parser.add_argument("--outdir", default=os.path.join(os.path.dirname(__file__), "output"))
    args = parser.parse_args()
    run_study(args.seed, args.n, args.quick, args.difficulty, args.tune, args.outdir)


if __name__ == "__main__":
    main()
