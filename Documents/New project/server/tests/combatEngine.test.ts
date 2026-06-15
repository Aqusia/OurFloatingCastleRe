import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COMBO_HARD_CAP,
  comboCapForLevel,
  mitigateIncomingDamage,
  resolveComboAttack,
  rollAttackSpecialEvents,
  rollBossCounterEvent,
  rollDangerDodge
} from "../src/combatEngine";
import type { CharacterStats } from "../../shared/events";

const baseStats: CharacterStats = {
  attack: 10,
  defense: 10,
  luck: 10,
  intelligence: 10,
  vitality: 10,
  spirit: 10,
  technique: 10,
  tenacity: 10
};

function withRandom(values: number[], fn: () => void) {
  const spy = vi.spyOn(Math, "random");
  values.forEach((v) => spy.mockReturnValueOnce(v));
  spy.mockReturnValue(0.99);
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rollAttackSpecialEvents", () => {
  it("returns no events when all rolls fail", () => {
    withRandom([0.99, 0.99], () => {
      const result = rollAttackSpecialEvents({
        actorName: "Hero",
        bossName: "Boss",
        stats: baseStats,
        baseDamage: 100,
        lowestAllyName: "Ally",
        lowestAllyHpRatio: 0.5
      });

      expect(result.events).toEqual([]);
      expect(result.extraDamage).toBe(0);
      expect(result.supportHealing).toBe(0);
      expect(result.bossAttackModifier).toBe(1);
    });
  });

  it("emits armor_break with a 0.9 boss attack modifier", () => {
    withRandom([0.0, 0.99], () => {
      const result = rollAttackSpecialEvents({
        actorName: "Hero",
        bossName: "Boss",
        stats: baseStats,
        baseDamage: 100
      });

      const armorBreak = result.events.find((e) => e.kind === "armor_break");
      expect(armorBreak).toBeDefined();
      expect(result.bossAttackModifier).toBe(0.9);
    });
  });

  it("does not emit ally_support when ally hp ratio is above 0.72", () => {
    withRandom([0.99, 0.0], () => {
      const result = rollAttackSpecialEvents({
        actorName: "Hero",
        bossName: "Boss",
        stats: baseStats,
        baseDamage: 100,
        lowestAllyName: "Ally",
        lowestAllyHpRatio: 0.9
      });

      expect(result.events.find((e) => e.kind === "ally_support")).toBeUndefined();
      expect(result.supportHealing).toBe(0);
    });
  });

  it("emits ally_support when ally hp ratio is below threshold and roll succeeds", () => {
    withRandom([0.99, 0.0], () => {
      const result = rollAttackSpecialEvents({
        actorName: "Hero",
        bossName: "Boss",
        stats: baseStats,
        baseDamage: 100,
        lowestAllyName: "Ally",
        lowestAllyHpRatio: 0.5
      });

      const support = result.events.find((e) => e.kind === "ally_support");
      expect(support).toBeDefined();
      expect(result.supportHealing).toBeGreaterThan(0);
    });
  });
});

describe("comboCapForLevel", () => {
  it("matches battle level up to the hard cap", () => {
    expect(comboCapForLevel(1)).toBe(1);
    expect(comboCapForLevel(16)).toBe(16);
    expect(comboCapForLevel(99)).toBe(COMBO_HARD_CAP);
  });
});

describe("resolveComboAttack", () => {
  const input = {
    actorName: "Hero",
    className: "warrior" as const,
    targetName: "Boss",
    stats: baseStats,
    battleLevel: 16,
    baseDamage: 20,
    availableResource: 100
  };

  it("never exceeds the level combo cap and damage sums match", () => {
    for (let run = 0; run < 50; run += 1) {
      const result = resolveComboAttack(input);
      expect(result.comboLength).toBeGreaterThanOrEqual(1);
      expect(result.comboLength).toBeLessThanOrEqual(comboCapForLevel(input.battleLevel));
      expect(result.totalDamage).toBe(result.hits.reduce((sum, hit) => sum + hit.damage, 0));
      expect(result.resourceSpent).toBeLessThanOrEqual(input.availableResource);
    }
  });

  it("always lands exactly one hit at battle level 1", () => {
    const result = resolveComboAttack({ ...input, battleLevel: 1 });
    expect(result.comboLength).toBe(1);
    expect(result.hits[0].index).toBe(1);
    expect(result.resourceSpent).toBe(0);
  });

  it("stops the chain when resources run out", () => {
    const result = resolveComboAttack({ ...input, availableResource: 0 });
    expect(result.comboLength).toBe(1);
  });

  it("emits a combo event with per-hit details for chains of 2+", () => {
    withRandom([0.0, 0.99, 0.5, 0.0, 0.99, 0.5, 0.99], () => {
      const result = resolveComboAttack(input);
      if (result.comboLength >= 2) {
        expect(result.events).toHaveLength(1);
        expect(result.events[0].impact.comboHits).toHaveLength(result.comboLength);
        expect(result.events[0].impact.comboLength).toBe(result.comboLength);
      }
    });
  });

  it("marks a finisher on long chains and lowers the boss attack modifier", () => {
    let sawFinisher = false;
    for (let run = 0; run < 200 && !sawFinisher; run += 1) {
      const result = resolveComboAttack({ ...input, battleLevel: 20, stats: { ...baseStats, technique: 40 } });
      if (result.finisherTriggered) {
        sawFinisher = true;
        expect(result.hits[result.hits.length - 1].finisher).toBe(true);
        expect(result.bossAttackModifier).toBeLessThan(1);
      }
    }
    expect(sawFinisher).toBe(true);
  });
});

describe("mitigateIncomingDamage", () => {
  it("reduces damage with defense and tenacity but never below 1", () => {
    const tanky = mitigateIncomingDamage(100, { ...baseStats, defense: 80, tenacity: 40 });
    const squishy = mitigateIncomingDamage(100, { ...baseStats, defense: 0, tenacity: 0 });
    expect(tanky).toBeLessThan(squishy);
    expect(mitigateIncomingDamage(1, { ...baseStats, defense: 999, tenacity: 999 })).toBe(1);
  });
});

describe("rollDangerDodge", () => {
  it("returns no event when hp ratio is above 0.38", () => {
    withRandom([0.0], () => {
      const result = rollDangerDodge({
        actorName: "Hero",
        stats: baseStats,
        hpRatio: 0.5,
        incomingDamage: 100
      });
      expect(result.event).toBeNull();
      expect(result.damageReduction).toBe(0);
    });
  });

  it("returns a danger_dodge event when hp is low and luck roll succeeds", () => {
    withRandom([0.0], () => {
      const result = rollDangerDodge({
        actorName: "Hero",
        stats: baseStats,
        hpRatio: 0.2,
        incomingDamage: 100
      });
      expect(result.event?.kind).toBe("danger_dodge");
      expect(result.damageReduction).toBe(45);
    });
  });

  it("returns null when luck roll fails even with low hp", () => {
    withRandom([0.99], () => {
      const result = rollDangerDodge({
        actorName: "Hero",
        stats: baseStats,
        hpRatio: 0.1,
        incomingDamage: 100
      });
      expect(result.event).toBeNull();
    });
  });
});

describe("rollBossCounterEvent", () => {
  it("returns null before tick 2", () => {
    withRandom([0.0], () => {
      const result = rollBossCounterEvent({
        bossName: "Boss",
        tick: 1,
        livingCount: 3,
        attackPower: 100
      });
      expect(result).toBeNull();
    });
  });

  it("emits boss_counter with higher damage when livingCount >= 3", () => {
    withRandom([0.0], () => {
      const result = rollBossCounterEvent({
        bossName: "Boss",
        tick: 5,
        livingCount: 3,
        attackPower: 100
      });
      expect(result?.kind).toBe("boss_counter");
      expect(result?.impact?.damage).toBe(45);
    });
  });

  it("emits boss_counter with lower damage when livingCount < 3", () => {
    withRandom([0.0], () => {
      const result = rollBossCounterEvent({
        bossName: "Boss",
        tick: 5,
        livingCount: 2,
        attackPower: 100
      });
      expect(result?.impact?.damage).toBe(30);
    });
  });
});
