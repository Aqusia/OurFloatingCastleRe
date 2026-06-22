"""Generate a clean system-architecture diagram (fig0) for the report."""
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import os


def build_architecture(outdir=None):
    """Render fig0_architecture.png into ``outdir`` (defaults to ./output)."""
    OUT = outdir or os.path.join(os.path.dirname(__file__), "output")
    os.makedirs(OUT, exist_ok=True)

    fig, ax = plt.subplots(figsize=(9.5, 5.4))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 60)
    ax.axis("off")

    def box(x, y, w, h, title, lines, color):
        p = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.6,rounding_size=2",
                           linewidth=1.5, edgecolor="#2c3e50", facecolor=color, alpha=0.92)
        ax.add_patch(p)
        ax.text(x + w / 2, y + h - 4, title, ha="center", va="top", fontsize=11, fontweight="bold", color="#1a1a1a")
        ax.text(x + w / 2, y + h - 9, "\n".join(lines), ha="center", va="top", fontsize=8.2, color="#222")

    def arrow(x1, y1, x2, y2, label=""):
        a = FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="-|>", mutation_scale=14,
                            linewidth=1.4, color="#34495e", connectionstyle="arc3,rad=0")
        ax.add_patch(a)
        if label:
            ax.text((x1 + x2) / 2, (y1 + y2) / 2 + 1.2, label, ha="center", fontsize=7.6, color="#34495e")

    # Game (TypeScript) layer
    box(3, 38, 28, 18, "client / admin-client", ["React + Vite (TS)", "game UI · 8 stats", "battle log · tower"], "#aed6f1")
    box(36, 38, 30, 18, "server (Node + TS)", ["Express + Socket.IO", "combatEngine.ts", "localStore.ts · utils.ts"], "#a9dfbf")
    box(70, 38, 27, 18, "store.json", ["local persistence", "characters · config", "(never touched by tool)"], "#f5cba7")
    arrow(31, 47, 36, 47)
    arrow(66, 47, 70, 47)

    # Python balance-sim layer
    box(36, 8, 30, 18, "balance-sim (Python)", ["formulas.py (ported)", "simulate.py · analyze.py", "plots.py · main.py"], "#d2b4de")
    box(3, 8, 28, 18, "outputs", ["summary_*.csv", "fig1-9 *.png", "imbalance_report.txt"], "#f9e79f")
    box(70, 8, 27, 18, "tuning feedback", ["weakest class found", "-> classBaseStats buff", "re-validated"], "#f1948a")

    # Relationships
    arrow(48, 38, 48, 26, "re-implement formulas (read-only)")
    arrow(36, 17, 31, 17, "produce")
    arrow(66, 17, 70, 17, "recommend")
    arrow(83.5, 26, 60, 41, "apply tuning")

    ax.text(50, 58, "Our Floating Castle — system & analysis pipeline", ha="center", fontsize=12.5, fontweight="bold")
    fig.tight_layout()
    path = os.path.join(OUT, "fig0_architecture.png")
    fig.savefig(path, dpi=140)
    plt.close(fig)
    return path


if __name__ == "__main__":
    print("saved", build_architecture())
