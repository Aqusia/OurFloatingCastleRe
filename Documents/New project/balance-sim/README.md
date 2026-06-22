# Our Floating Castle — Combat Balance Simulator (Python)

An **offline, pure-Python** Monte-Carlo tool that re-implements the combat and
growth formulas of the *Our Floating Castle* RPG and uses thousands of simulated
battles to answer the game designer's hardest question:

> *Are the four classes balanced across levels, are battles landing in the
> intended length, and where are the conflicts?*

It never touches the running game or its save data — it reads the formulas from
the TypeScript source, re-expresses them in Python, and studies them
statistically. This is the part of the project implemented deeply for the Python
final project.

## Why this exists

The game has 4 classes, an SAO-style combo chain (combo length = battle level),
per-stat tactical events, and enemy HP that scales **quadratically** with level.
Hand-tuning that by eye is guesswork, and the in-game "FUN SCORE" in the admin
panel is only a single-point heuristic. This tool replaces guesswork with
distributions: win rate, rounds-to-kill, combo length, finisher rate and
per-class damage, each estimated from many independent battles.

## Requirements

- Python 3.10+
- `numpy`, `pandas`, `matplotlib`

```bash
pip install -r requirements.txt
```

## Run it

```bash
# full study (seed 20260622, 4000 battles per class/level/difficulty) + tuning demo
python main.py --n 4000 --tune

# fast smoke run
python main.py --quick --n 500

# choose the primary difficulty used for the headline win-rate chart
python main.py --difficulty elite

# validate the Python port against the TS formulas (19 unit tests)
python -m unittest test_formulas

# extra analyses (produce fig10 / fig11)
python sensitivity.py --n 1500     # balance vs warrior technique sweep
python optimize.py --n 1200        # grid search for the best warrior buff
```

All results are written to `./output/`:

| File | Contents |
| --- | --- |
| `summary_<difficulty>.csv` | aggregated grid (win rate, rounds, combo, finisher, damage) per class × level |
| `summary_all.csv` | every difficulty concatenated |
| `imbalance_report.txt` | human-readable balance findings (class spread, slow kills, level walls, one-shots) |
| `tuning_*.csv` / `tuning_summary.json` | before/after the proposed tuning |
| `fig0..fig9 *.png` | all charts cited by the report (`main.py` produces fig0..fig9; fig10/fig11 below) |
| `sensitivity.csv` / `fig10_sensitivity.png` | balance vs warrior technique sweep |
| `optimize.csv` / `fig11_optimization.png` | grid-search heatmap of warrior tech/spirit buffs |

Modules: `formulas.py` (ported formulas), `simulate.py` (1-vs-1 battle), `analyze.py`
(Monte Carlo + pandas), `plots.py` (charts), `main.py` (CLI), `make_architecture.py`
(fig0), `test_formulas.py` (port validation), `sensitivity.py` (fig10), `optimize.py` (fig11).

## How it maps to the game

| Python | Game source of truth (TypeScript) |
| --- | --- |
| `formulas.py` | `server/src/combatEngine.ts`, `server/src/utils.ts` |
| `simulate.py` (1-vs-1 loop) | `runInstantBattle` in `server/src/persistence/localStore.ts` |
| enemy scaling | `soloDifficultyConfig`, `bossBaseHp/Attack` in `utils.ts` |

Each ported function carries a comment pointing at the originating TS symbol and
line, so the port can be audited against the live game.

## 2026-06-23 mechanic update (kept in sync)

The game's combat was reworked and this port was updated to match, so the study
still mirrors the live engine:

- **Attribute purposes retuned** — speed (`spirit`) now leads combo continuation
  and dodge; technique leads crit / counter / block; tenacity gives a larger flat
  (hard) reduction. The coefficients in `formulas.py` were updated accordingly.
- **Resource model** — combo hits (from the 2nd) now cost **MP** for every class
  (the action itself costs stamina); `simulate.py` reflects this.
- **心態 (mindset)** — a vitality/tenacity-driven morale that multiplies output and
  can cause a low-morale falter (`initial_mindset` / `drift_mindset` /
  `mindset_damage_multiplier` / `roll_mindset_falter`).
- **Ultimate gauge** — charges with combo/hits and releases an awakening burst at
  full (the baseline study equips no secret technique, so it uses that branch).

Effect on findings: with more diverse damage sources every class wins ~100% at
normal difficulty; the previously-weakest warrior (base technique 4 / speed 5) no
longer collapses (elite mean win-rate ~79.5%, vs ~18% in the pre-update baseline).
The grid search still re-confirms the shipped **technique 8 / speed 6** warrior
buff as the minimum-spread choice (~4.3 pts). Unit tests grew 15 → 19, all passing.

## Modelling scope (honest limitations)

The model deliberately covers the **core single-target combat math** and omits
systems whose effect depends on per-player choices: equipment & durability,
secondary-character auto-skills, learnable manuals, party synergy, and the full
adventure/tower/siege flow. Stat growth uses a documented *representative build*
(each level invests points proportionally to the class's innate identity), since
real stats come from the player's training choices. Results are therefore a
faithful study of the combat **engine**, not a clone of every match.

## Reproducibility

A fixed `--seed` makes a whole study reproducible. The Python PRNG differs from
the game's V8 engine, but every probability and distribution is identical, which
is what a statistical balance study needs.
