"""
plots.py — matplotlib figures for the balance report.

Chart labels are in English on purpose: it keeps the figures readable on any
machine without a bundled CJK font, while the (Chinese) report supplies the
captions. Every figure is saved as a PNG into the output directory.
"""

from __future__ import annotations

import os
from typing import List

import matplotlib

matplotlib.use("Agg")  # headless / reproducible
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

import formulas as F  # noqa: E402

CLASS_COLORS = {"Warrior": "#c0392b", "Assassin": "#8e44ad", "Mage": "#2980b9", "Priest": "#27ae60"}
DPI = 130


def _save(fig, outdir: str, name: str) -> str:
    path = os.path.join(outdir, name)
    fig.tight_layout()
    fig.savefig(path, dpi=DPI)
    plt.close(fig)
    return path


def plot_winrate_vs_level(df: pd.DataFrame, outdir: str, difficulty: str) -> str:
    fig, ax = plt.subplots(figsize=(8, 4.8))
    for label, sub in df.groupby("class_label"):
        sub = sub.sort_values("level")
        ax.plot(sub["level"], sub["win_rate"] * 100, marker="o", ms=3, label=label, color=CLASS_COLORS.get(label))
    ax.set_xlabel("Battle Level")
    ax.set_ylabel("Win Rate (%)")
    ax.set_title(f"Win Rate vs Battle Level by Class ({difficulty} difficulty)")
    ax.set_ylim(-2, 102)
    ax.grid(True, alpha=0.3)
    ax.legend()
    return _save(fig, outdir, f"fig1_winrate_{difficulty}.png")


def plot_rounds_vs_level(df: pd.DataFrame, outdir: str, difficulty: str) -> str:
    fig, ax = plt.subplots(figsize=(8, 4.8))
    ax.axhspan(3, 4, color="#f1c40f", alpha=0.18, label="Target 3-4 rounds")
    for label, sub in df.groupby("class_label"):
        sub = sub.sort_values("level")
        ax.plot(sub["level"], sub["avg_rounds_to_kill"], marker="s", ms=3, label=label, color=CLASS_COLORS.get(label))
    ax.set_xlabel("Battle Level")
    ax.set_ylabel("Avg Rounds to Kill (won battles)")
    ax.set_title(f"Average Kill Time vs Battle Level ({difficulty} difficulty)")
    ax.grid(True, alpha=0.3)
    ax.legend()
    return _save(fig, outdir, f"fig2_rounds_{difficulty}.png")


def plot_combo_distribution(combo_df: pd.DataFrame, outdir: str, levels: List[int]) -> str:
    pick = [lv for lv in (5, 10, 16, 20) if lv in levels] or [max(levels)]
    fig, axes = plt.subplots(1, len(pick), figsize=(4.0 * len(pick), 4.2), sharey=True)
    if len(pick) == 1:
        axes = [axes]
    for ax, lv in zip(axes, pick):
        sub = combo_df[combo_df["level"] == lv]
        maxlen = int(sub["combo_len"].max()) if len(sub) else 1
        bins = range(1, maxlen + 2)
        ax.hist(sub["combo_len"], bins=bins, align="left", rwidth=0.85, color="#34495e")
        ax.set_title(f"Battle Level {lv}")
        ax.set_xlabel("Combo Length (hits)")
        ax.grid(True, axis="y", alpha=0.3)
    axes[0].set_ylabel("Attack count")
    fig.suptitle("Combo-Length Distribution (combo cap = battle level)")
    return _save(fig, outdir, "fig3_combo_distribution.png")


def plot_damage_by_class(df: pd.DataFrame, outdir: str, difficulty: str, levels: List[int]) -> str:
    pick = [lv for lv in (1, 5, 10, 16, 20) if lv in levels]
    fig, ax = plt.subplots(figsize=(8.5, 4.8))
    labels = [F.CLASS_LABEL[c] for c in F.CLASSES]
    width = 0.8 / len(pick)
    import numpy as np

    x = np.arange(len(labels))
    for i, lv in enumerate(pick):
        vals = [df[(df["class_label"] == lbl) & (df["level"] == lv)]["avg_damage_per_attack"].mean() for lbl in labels]
        ax.bar(x + i * width, vals, width=width, label=f"L{lv}")
    ax.set_xticks(x + width * (len(pick) - 1) / 2)
    ax.set_xticklabels(labels)
    ax.set_ylabel("Avg Damage per Attack (combo total)")
    ax.set_title(f"Per-Class Attack Output across Levels ({difficulty} difficulty)")
    ax.grid(True, axis="y", alpha=0.3)
    ax.legend(title="Battle Level")
    return _save(fig, outdir, f"fig4_damage_{difficulty}.png")


def plot_finisher_rate(df: pd.DataFrame, outdir: str, difficulty: str) -> str:
    fig, ax = plt.subplots(figsize=(8, 4.8))
    for label, sub in df.groupby("class_label"):
        sub = sub.sort_values("level")
        ax.plot(sub["level"], sub["finisher_rate"] * 100, marker="^", ms=3, label=label, color=CLASS_COLORS.get(label))
    ax.set_xlabel("Battle Level")
    ax.set_ylabel("Finisher Trigger Rate (% of attacks)")
    ax.set_title(f"Finisher Rate vs Battle Level ({difficulty} difficulty)")
    ax.grid(True, alpha=0.3)
    ax.legend()
    return _save(fig, outdir, f"fig5_finisher_{difficulty}.png")


def plot_level_curve(outdir: str, max_level: int = 30) -> str:
    levels = list(range(1, max_level + 1))
    req = [F.next_level_requirement(lv) for lv in levels]
    fig, ax = plt.subplots(figsize=(8, 4.6))
    ax.plot(levels, req, marker="o", ms=3, color="#16a085")
    for lv in (1, 5, 10, 16, 20):
        if lv <= max_level:
            ax.annotate(f"L{lv}: {F.next_level_requirement(lv)}", (lv, F.next_level_requirement(lv)),
                        textcoords="offset points", xytext=(6, 6), fontsize=8)
    ax.set_xlabel("Level")
    ax.set_ylabel("Experience to Next Level")
    ax.set_title("Level-Up Requirement Curve  max(60, 70 + level^1.5 * 40)")
    ax.grid(True, alpha=0.3)
    return _save(fig, outdir, "fig6_level_curve.png")


def plot_enemy_scaling(outdir: str, max_level: int = 20) -> str:
    import numpy as np

    levels = np.arange(1, max_level + 1)
    lf = np.maximum(0, levels - 1)
    linear = 1 + lf * 0.2
    quad = 1 + lf * 0.2 + lf * lf * 0.01
    base = 260  # solo raid base for 1 member
    fig, ax = plt.subplots(figsize=(8, 4.6))
    ax.plot(levels, base * linear, "--", color="#7f8c8d", label="linear term only")
    ax.plot(levels, base * quad, marker="o", ms=3, color="#c0392b", label="linear + quadratic (live)")
    ax.fill_between(levels, base * linear, base * quad, color="#e74c3c", alpha=0.12, label="quadratic contribution")
    ax.set_xlabel("Average Battle Level")
    ax.set_ylabel("Boss Base HP (1 member)")
    ax.set_title("Enemy HP Scaling: the quadratic term resists high-level one-shots")
    ax.grid(True, alpha=0.3)
    ax.legend()
    return _save(fig, outdir, "fig7_enemy_scaling.png")


def plot_before_after(before: pd.DataFrame, after: pd.DataFrame, outdir: str, metric: str, ylabel: str, title: str, name: str) -> str:
    fig, (axb, axa) = plt.subplots(1, 2, figsize=(11, 4.6), sharey=True)
    for ax, df, sub_title in ((axb, before, "Before tuning"), (axa, after, "After tuning")):
        for label, sub in df.groupby("class_label"):
            sub = sub.sort_values("level")
            ax.plot(sub["level"], sub[metric], marker="o", ms=3, label=label, color=CLASS_COLORS.get(label))
        ax.set_title(sub_title)
        ax.set_xlabel("Battle Level")
        ax.grid(True, alpha=0.3)
    axb.set_ylabel(ylabel)
    axb.legend()
    fig.suptitle(title)
    fig.subplots_adjust(top=0.86)
    return _save(fig, outdir, name)


def plot_winrate_convergence(seed: int, class_name: str, level: int, difficulty: str, outdir: str, max_n: int = 4000) -> str:
    """Show the Monte Carlo estimate converging as sample count grows."""
    import random

    from simulate import simulate_battle

    rng = random.Random(seed + 7)
    wins = 0
    xs, ys = [], []
    checkpoints = set(int(c) for c in _logspace_points(50, max_n, 40))
    for i in range(1, max_n + 1):
        out = simulate_battle(rng, class_name, level, difficulty)
        wins += 1 if out.won else 0
        if i in checkpoints:
            xs.append(i)
            ys.append(wins / i * 100)
    fig, ax = plt.subplots(figsize=(8, 4.4))
    ax.plot(xs, ys, marker=".", color="#2c3e50")
    if ys:
        ax.axhline(ys[-1], color="#e74c3c", ls="--", alpha=0.6, label=f"final ~{ys[-1]:.1f}%")
    ax.set_xscale("log")
    ax.set_xlabel("Number of simulated battles (log scale)")
    ax.set_ylabel("Estimated Win Rate (%)")
    ax.set_title(f"Monte Carlo Convergence — {F.CLASS_LABEL[class_name]} L{level} ({difficulty})")
    ax.grid(True, alpha=0.3)
    ax.legend()
    return _save(fig, outdir, "fig9_convergence.png")


def _logspace_points(lo, hi, count):
    import math

    out = []
    for i in range(count):
        frac = i / (count - 1)
        out.append(lo * (hi / lo) ** frac)
    return out
