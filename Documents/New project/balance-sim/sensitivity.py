"""
sensitivity.py — How does balance respond to one tuning lever?

Sweeps the warrior's base technique (the stat the main study fingered as the
root cause) and measures, at elite difficulty over levels 5-16:
  * warrior mean win rate
  * mean class win-rate spread (lower = more balanced)

Produces output/fig10_sensitivity.png and sensitivity.csv. This shows *why* a
technique buff is the right lever and brackets a sensible magnitude.
"""

from __future__ import annotations

import argparse
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

import analyze  # noqa: E402
import formulas as F  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "output")
LEVELS = list(range(5, 17))
DIFF = "elite"
SEED = 20260622


def _metrics(df: pd.DataFrame):
    spread = df.groupby("level")["win_rate"].agg(lambda s: s.max() - s.min()).mean()
    warr = df[df["class_name"] == "warrior"]["win_rate"].mean()
    return float(spread), float(warr)


def run(n: int = 1500) -> pd.DataFrame:
    os.makedirs(OUT, exist_ok=True)
    base = dict(F.CLASS_BASE_STATS["warrior"])
    rows = []
    print(f"sensitivity sweep: warrior technique 4..12 @ {DIFF}, L{LEVELS[0]}-{LEVELS[-1]}, N={n}")
    for tech in range(4, 13):
        F.CLASS_BASE_STATS["warrior"] = {**base, "technique": tech}
        df = analyze.run_grid(SEED, n, LEVELS, DIFF)
        spread, warr = _metrics(df)
        rows.append(dict(technique=tech, warrior_winrate=round(warr, 4), mean_spread=round(spread, 4)))
        print(f"  tech={tech:2d}: warrior wr={warr*100:5.1f}%  spread={spread*100:5.1f}pts")
    F.CLASS_BASE_STATS["warrior"] = base

    d = pd.DataFrame(rows)
    d.to_csv(os.path.join(OUT, "sensitivity.csv"), index=False)

    fig, ax = plt.subplots(figsize=(8, 4.8))
    ax.plot(d["technique"], d["warrior_winrate"] * 100, marker="o", color="#c0392b", label="Warrior win rate")
    ax.plot(d["technique"], d["mean_spread"] * 100, marker="s", color="#2980b9", label="Mean class spread")
    ax.axvline(4, color="#888888", ls=":", alpha=0.8, label="original (tech 4)")
    ax.axvline(8, color="#27ae60", ls="--", alpha=0.8, label="shipped (tech 8)")
    ax.set_xlabel("Warrior base technique")
    ax.set_ylabel("Percent (%)")
    ax.set_title(f"Sensitivity: balance vs warrior base technique ({DIFF}, L{LEVELS[0]}-{LEVELS[-1]})")
    ax.grid(True, alpha=0.3)
    ax.legend()
    fig.tight_layout()
    path = os.path.join(OUT, "fig10_sensitivity.png")
    fig.savefig(path, dpi=130)
    plt.close(fig)
    print("saved", path)
    return d


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=1500)
    run(ap.parse_args().n)
