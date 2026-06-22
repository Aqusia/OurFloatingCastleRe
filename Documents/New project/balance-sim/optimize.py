"""
optimize.py — Automated parameter search for the warrior buff.

Grid-searches warrior base (technique, spirit) and scores each combination by the
mean class win-rate spread at elite difficulty over levels 5-16 (lower = more
balanced). This realises the report's "future work" item — the tool no longer just
*diagnoses* imbalance, it *recommends* a near-optimal fix — and shows whether the
shipped (technique 8, spirit 6) choice sits in the low-spread region.

Produces output/fig11_optimization.png and optimize.csv.
"""

from __future__ import annotations

import argparse
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

import analyze  # noqa: E402
import formulas as F  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "output")
LEVELS = list(range(5, 17))
DIFF = "elite"
SEED = 20260622
TECHS = [4, 6, 8, 10]
SPIRITS = [5, 6, 7]


def _mean_spread(df: pd.DataFrame) -> float:
    return float(df.groupby("level")["win_rate"].agg(lambda s: s.max() - s.min()).mean())


def run(n: int = 1200) -> pd.DataFrame:
    os.makedirs(OUT, exist_ok=True)
    base = dict(F.CLASS_BASE_STATS["warrior"])
    grid = np.zeros((len(SPIRITS), len(TECHS)))
    rows = []
    print(f"grid search: warrior tech {TECHS} x spirit {SPIRITS} @ {DIFF}, N={n}")
    for i, sp in enumerate(SPIRITS):
        for j, tech in enumerate(TECHS):
            F.CLASS_BASE_STATS["warrior"] = {**base, "technique": tech, "spirit": sp}
            df = analyze.run_grid(SEED, n, LEVELS, DIFF)
            spread = _mean_spread(df)
            warr = float(df[df["class_name"] == "warrior"]["win_rate"].mean())
            grid[i, j] = spread * 100
            rows.append(dict(technique=tech, spirit=sp, mean_spread=round(spread, 4), warrior_winrate=round(warr, 4)))
            print(f"  tech={tech:2d} spirit={sp}: spread={spread*100:5.1f}pts  warrior={warr*100:5.1f}%")
    F.CLASS_BASE_STATS["warrior"] = base

    d = pd.DataFrame(rows)
    d.to_csv(os.path.join(OUT, "optimize.csv"), index=False)
    best = d.loc[d["mean_spread"].idxmin()]
    orig = d[(d["technique"] == 4) & (d["spirit"] == 5)]["mean_spread"].iloc[0]
    shipped = d[(d["technique"] == 8) & (d["spirit"] == 6)]["mean_spread"].iloc[0]
    print(f"  original (4,5) spread={orig*100:.1f}pts | shipped (8,6) spread={shipped*100:.1f}pts")
    print(f"  BEST: technique={int(best['technique'])} spirit={int(best['spirit'])} spread={best['mean_spread']*100:.1f}pts")

    fig, ax = plt.subplots(figsize=(7.4, 4.7))
    im = ax.imshow(grid, cmap="RdYlGn_r", aspect="auto")
    ax.set_xticks(range(len(TECHS)))
    ax.set_xticklabels([f"tech {t}" for t in TECHS])
    ax.set_yticks(range(len(SPIRITS)))
    ax.set_yticklabels([f"spirit {s}" for s in SPIRITS])
    for i in range(len(SPIRITS)):
        for j in range(len(TECHS)):
            ax.text(j, i, f"{grid[i, j]:.0f}", ha="center", va="center", color="#111111", fontsize=11, fontweight="bold")
    ax.add_patch(plt.Rectangle((TECHS.index(8) - 0.5, SPIRITS.index(6) - 0.5), 1, 1, fill=False, edgecolor="#1565C0", lw=2.6))
    ax.text(TECHS.index(8), SPIRITS.index(6) - 0.62, "shipped", ha="center", color="#1565C0", fontsize=9, fontweight="bold")
    ax.set_title(f"Mean class win-rate spread (pts) — lower is better ({DIFF}, L{LEVELS[0]}-{LEVELS[-1]})")
    fig.colorbar(im, ax=ax, label="mean spread (pts)")
    fig.tight_layout()
    path = os.path.join(OUT, "fig11_optimization.png")
    fig.savefig(path, dpi=130)
    plt.close(fig)
    print("saved", path)
    return d


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=1200)
    run(ap.parse_args().n)
