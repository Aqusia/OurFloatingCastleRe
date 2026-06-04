import { afterEach, describe, expect, it, vi } from "vitest";
import {
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
    withRandom([0.99, 0.99, 0.99, 0.99], () => {
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

  it("emits a lucky_crit event when the luck roll succeeds", () => {
    withRandom([0.0, 0.99, 0.99, 0.99], () => {
      const result = rollAttackSpecialEvents({
        actorUserId: "u1",
        actorName: "Hero",
        bossName: "Boss",
        stats: baseStats,
        baseDamage: 100
      });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].kind).toBe("lucky_crit");
      expect(result.events[0].actorUserId).toBe("u1");
      expect(result.extraDamage).toBeGreaterThan(0);
      expect(result.events[0].impact?.damage).toBe(result.extraDamage);
    });
  });

  it("emits armor_break with a 0.9 boss attack modifier", () => {
    withRandom([0.99, 0.99, 0.0, 0.99], () => {
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
    withRandom([0.99, 0.99, 0.99, 0.0], () => {
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
    withRandom([0.99, 0.99, 0.99, 0.0], () => {
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
