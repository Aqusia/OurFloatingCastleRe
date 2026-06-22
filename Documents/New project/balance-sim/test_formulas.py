"""
test_formulas.py — Unit tests that pin the Python port to the TypeScript source.

These mirror (and extend) the game's own server/tests/combatEngine.test.ts so we
can be confident the re-implemented formulas behave identically to the live game.

Run:
    python -m unittest test_formulas        # or: python test_formulas.py
"""

import random
import unittest

import formulas as F


class Const:
    """A fake RNG whose .random() always returns a fixed value (for forced rolls)."""
    def __init__(self, value):
        self.value = value
    def random(self):
        return self.value


ALL10 = {k: 10 for k in F.STAT_KEYS}


class TestScalarFormulas(unittest.TestCase):
    def test_level_requirement(self):
        self.assertEqual(F.next_level_requirement(1), 110)          # 70 + 1^1.5*40
        self.assertGreaterEqual(F.next_level_requirement(1), 60)    # floor at 60
        # strictly increasing
        reqs = [F.next_level_requirement(lv) for lv in range(1, 21)]
        self.assertTrue(all(b > a for a, b in zip(reqs, reqs[1:])))

    def test_combo_cap(self):
        self.assertEqual(F.combo_cap_for_level(1), 1)
        self.assertEqual(F.combo_cap_for_level(16), 16)
        self.assertEqual(F.combo_cap_for_level(99), F.COMBO_HARD_CAP)  # hard cap 20
        self.assertEqual(F.combo_cap_for_level(0), 1)                  # max(1, .)

    def test_base_damage_by_class(self):
        # warrior: 8 + round(atk*1.5 + tech*0.5) + floor(1/2)
        self.assertEqual(F.combo_base_damage_for("warrior", ALL10, 1), 8 + round(10 * 1.5 + 10 * 0.5))
        # mage: 8 + round(int*1.8 + tech*0.5)
        self.assertEqual(F.combo_base_damage_for("mage", ALL10, 1), 8 + round(10 * 1.8 + 10 * 0.5))

    def test_crit_and_continue(self):
        self.assertAlmostEqual(F.crit_chance(ALL10), 0.19, places=6)            # 0.05+.09+.03+.02 (technique-led retune)
        self.assertAlmostEqual(F.combo_continue_chance(ALL10, 16), 0.766, places=6)  # 0.45+.16(spd)+.06(tech)+.096(lvl)
        # caps
        big = {k: 1000 for k in F.STAT_KEYS}
        self.assertLessEqual(F.crit_chance(big), 0.42)
        self.assertLessEqual(F.combo_continue_chance(big, 99), 0.94)

    def test_mitigation(self):
        tanky = F.mitigate_incoming_damage(100, {**ALL10, "defense": 80, "tenacity": 40})
        squishy = F.mitigate_incoming_damage(100, {**ALL10, "defense": 0, "tenacity": 0})
        self.assertEqual(tanky, 29)        # round(100*0.5) - (13+8)  tenacity flat now /3
        self.assertEqual(squishy, 100)
        self.assertLess(tanky, squishy)
        self.assertEqual(F.mitigate_incoming_damage(1, {**ALL10, "defense": 999, "tenacity": 999}), 1)  # floor at 1


class TestEvents(unittest.TestCase):
    def test_boss_counter_scaling(self):
        # forced success (rng=0), tick>=2
        self.assertEqual(F.roll_boss_counter_event(Const(0.0), 5, 3, 100), 45)   # 0.45x for 3+
        self.assertEqual(F.roll_boss_counter_event(Const(0.0), 5, 2, 100), 30)   # 0.30x for <3
        self.assertEqual(F.roll_boss_counter_event(Const(0.0), 1, 3, 100), 0)    # never before tick 2

    def test_danger_dodge_requires_low_hp(self):
        # high hp -> no dodge regardless of roll
        self.assertEqual(F.roll_danger_dodge(Const(0.0), ALL10, 0.5, 100), 0)
        # low hp + forced success -> ceil(100*0.45)
        self.assertEqual(F.roll_danger_dodge(Const(0.0), ALL10, 0.2, 100), 45)


class TestComboInvariants(unittest.TestCase):
    def test_single_hit_at_level_1(self):
        rng = random.Random(1)
        res = F.resolve_combo_attack(rng, "warrior", ALL10, 1, 20, 100)
        self.assertEqual(res.combo_length, 1)
        self.assertEqual(res.resource_spent, 0)

    def test_combo_within_cap_and_resource(self):
        rng = random.Random(42)
        for _ in range(200):
            res = F.resolve_combo_attack(rng, "assassin", ALL10, 16, 20, 100)
            self.assertGreaterEqual(res.combo_length, 1)
            self.assertLessEqual(res.combo_length, F.combo_cap_for_level(16))
            self.assertLessEqual(res.resource_spent, 100)

    def test_resource_starved_combo_stops(self):
        rng = random.Random(7)
        res = F.resolve_combo_attack(rng, "warrior", ALL10, 16, 20, 0)
        self.assertEqual(res.combo_length, 1)  # no resource to continue past hit 1


class TestStatusAndTechniques(unittest.TestCase):
    def test_tick_dot_and_expiry(self):
        r = F.tick_statuses(
            [
                {"kind": "burn", "remaining": 2, "magnitude": 5},
                {"kind": "poison", "remaining": 1, "magnitude": 3},
            ]
        )
        self.assertEqual(r["damage"], 8)
        self.assertEqual([s["kind"] for s in r["statuses"]], ["burn"])  # poison expired
        self.assertEqual(r["statuses"][0]["remaining"], 1)

    def test_tick_freeze_stun_armor(self):
        r = F.tick_statuses(
            [
                {"kind": "freeze", "remaining": 1, "magnitude": 0.6},
                {"kind": "stun", "remaining": 1, "magnitude": 1},
                {"kind": "armor_break", "remaining": 2, "magnitude": 0.12},
            ]
        )
        self.assertAlmostEqual(r["attack_multiplier"], 0.6)
        self.assertTrue(r["skip_attack"])
        self.assertAlmostEqual(r["incoming_multiplier"], 1.12)

    def test_apply_statuses(self):
        base = [{"kind": "poison", "remaining": 2, "magnitude": 3}, {"kind": "burn", "remaining": 1, "magnitude": 4}]
        out = F.apply_statuses(
            base, [{"kind": "poison", "remaining": 3, "magnitude": 2}, {"kind": "burn", "remaining": 3, "magnitude": 6}]
        )
        poison = next(s for s in out if s["kind"] == "poison")
        burn = next(s for s in out if s["kind"] == "burn")
        self.assertEqual(poison["magnitude"], 5)  # 3 + 2 (stack)
        self.assertEqual(poison["remaining"], 3)
        self.assertEqual(burn["magnitude"], 6)  # max
        self.assertEqual(base[0]["magnitude"], 3)  # input untouched

    def test_offensive_specials_all_or_none(self):
        extra, statuses = F.roll_offensive_specials(Const(0.0), ALL10, 100)
        self.assertGreater(extra, 0)
        self.assertGreaterEqual(len(statuses), 4)
        self.assertEqual(F.roll_offensive_specials(Const(0.999), ALL10, 100), (0, []))

    def test_combo_milestone_bonus(self):
        self.assertEqual(F._apply_combo_milestone(100, 16), 130)  # +30%
        self.assertEqual(F._apply_combo_milestone(100, 8), 112)  # +12%
        self.assertEqual(F._apply_combo_milestone(100, 3), 100)  # below first milestone


class TestMindset(unittest.TestCase):
    """2026-06-23 心態 system — 體/韌 prop up morale (combatEngine.ts:567-614)."""

    def test_initial_mindset_clamped_and_ordered(self):
        low = F.initial_mindset({**ALL10, "vitality": 0, "tenacity": 0})
        high = F.initial_mindset({**ALL10, "vitality": 20, "tenacity": 20})
        self.assertGreaterEqual(low, 20)   # floor
        self.assertLessEqual(high, 100)    # ceiling
        self.assertGreater(high, low)      # 體/韌 raise opening morale

    def test_damage_multiplier_bands(self):
        self.assertEqual(F.mindset_damage_multiplier(90), 1.12)  # 亢奮
        self.assertEqual(F.mindset_damage_multiplier(60), 1.0)   # 穩定
        self.assertEqual(F.mindset_damage_multiplier(40), 0.94)  # 緊繃
        self.assertEqual(F.mindset_damage_multiplier(10), 0.85)  # 低落

    def test_falter_only_when_low_morale_and_near_death(self):
        squishy = {**ALL10, "tenacity": 0, "vitality": 0}
        self.assertFalse(F.roll_mindset_falter(Const(0.0), 10, 0.9, squishy))  # healthy -> never
        self.assertTrue(F.roll_mindset_falter(Const(0.0), 10, 0.1, squishy))   # low morale + near death
        tough = {**ALL10, "tenacity": 10, "vitality": 10}                      # resolve 0.7 -> chance 0
        self.assertFalse(F.roll_mindset_falter(Const(0.0), 10, 0.1, tough))

    def test_drift_respects_tenacity_floor(self):
        tough = {**ALL10, "tenacity": 30, "vitality": 10}  # floor = min(60, 18+42+4) = 60
        self.assertEqual(F.drift_mindset(100, tough, -100), 60)


if __name__ == "__main__":
    unittest.main(verbosity=2)
