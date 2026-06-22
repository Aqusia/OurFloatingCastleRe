import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COMBO_HARD_CAP,
  applyStatuses,
  comboCapForLevel,
  driftMindset,
  initialMindset,
  mindsetDamageMultiplier,
  mindsetLabel,
  mitigateIncomingDamage,
  resolveComboAttack,
  rollAttackSpecialEvents,
  rollBossCounterEvent,
  rollDangerDodge,
  rollMindsetFalter,
  rollOffensiveSpecials,
  tickStatuses
} from "../src/combatEngine";
import type { ActiveStatus, CharacterStats } from "../../shared/events";

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
    availableMp: 100
  };

  it("never exceeds the level combo cap and damage sums match", () => {
    for (let run = 0; run < 50; run += 1) {
      const result = resolveComboAttack(input);
      expect(result.comboLength).toBeGreaterThanOrEqual(1);
      expect(result.comboLength).toBeLessThanOrEqual(comboCapForLevel(input.battleLevel));
      expect(result.totalDamage).toBe(result.hits.reduce((sum, hit) => sum + hit.damage, 0));
      expect(result.resourceSpent).toBeLessThanOrEqual(input.availableMp);
    }
  });

  it("always lands exactly one hit at battle level 1", () => {
    const result = resolveComboAttack({ ...input, battleLevel: 1 });
    expect(result.comboLength).toBe(1);
    expect(result.hits[0].index).toBe(1);
    expect(result.resourceSpent).toBe(0);
  });

  it("stops the chain when resources run out", () => {
    const result = resolveComboAttack({ ...input, availableMp: 0 });
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

describe("tickStatuses", () => {
  it("applies DoT damage and decrements/expires durations", () => {
    const res = tickStatuses(
      [
        { kind: "burn", label: "燃燒", remaining: 2, magnitude: 5 },
        { kind: "poison", label: "中毒", remaining: 1, magnitude: 3 }
      ],
      "Boss"
    );
    expect(res.damage).toBe(8);
    expect(res.statuses.map((s) => s.kind)).toEqual(["burn"]); // poison expired
    expect(res.statuses[0].remaining).toBe(1);
    expect(res.event?.kind).toBe("status_tick");
  });

  it("freeze lowers attack, stun skips, armor_break amplifies incoming", () => {
    const res = tickStatuses(
      [
        { kind: "freeze", label: "冰凍", remaining: 1, magnitude: 0.6 },
        { kind: "stun", label: "眩暈", remaining: 1, magnitude: 1 },
        { kind: "armor_break", label: "破甲", remaining: 2, magnitude: 0.12 }
      ],
      "Boss"
    );
    expect(res.attackMultiplier).toBeCloseTo(0.6);
    expect(res.skipAttack).toBe(true);
    expect(res.incomingMultiplier).toBeCloseTo(1.12);
  });

  it("returns no event when there are no statuses", () => {
    const res = tickStatuses([], "Boss");
    expect(res.event).toBeNull();
    expect(res.damage).toBe(0);
    expect(res.skipAttack).toBe(false);
  });
});

describe("applyStatuses", () => {
  it("stacks poison magnitude, refreshes others, and does not mutate input", () => {
    const base: ActiveStatus[] = [
      { kind: "poison", label: "中毒", remaining: 2, magnitude: 3 },
      { kind: "burn", label: "燃燒", remaining: 1, magnitude: 4 }
    ];
    const out = applyStatuses(base, [
      { kind: "poison", label: "中毒", remaining: 3, magnitude: 2 },
      { kind: "burn", label: "燃燒", remaining: 3, magnitude: 6 }
    ]);
    const poison = out.find((s) => s.kind === "poison")!;
    const burn = out.find((s) => s.kind === "burn")!;
    expect(poison.magnitude).toBe(5); // 3 + 2
    expect(poison.remaining).toBe(3); // max(2, 3)
    expect(burn.magnitude).toBe(6); // max(4, 6)
    expect(base[0].magnitude).toBe(3); // input untouched
  });
});

describe("rollOffensiveSpecials", () => {
  it("triggers techniques, deals extra damage and applies statuses when rolls succeed", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const res = rollOffensiveSpecials({ actorName: "Hero", bossName: "Boss", stats: baseStats, baseDamage: 100 });
      expect(res.events.length).toBeGreaterThan(0);
      expect(res.statuses.length).toBeGreaterThan(0);
      expect(res.extraDamage).toBeGreaterThan(0);
    } finally {
      spy.mockRestore();
    }
  });

  it("does nothing when rolls fail", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.999);
    try {
      const res = rollOffensiveSpecials({ actorName: "Hero", bossName: "Boss", stats: baseStats, baseDamage: 100 });
      expect(res.events).toHaveLength(0);
      expect(res.statuses).toHaveLength(0);
      expect(res.extraDamage).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("resolveComboAttack milestones", () => {
  it("emits combo_milestone on long chains and keeps totalDamage equal to the hit sum", () => {
    let sawMilestone = false;
    for (let run = 0; run < 300 && !sawMilestone; run += 1) {
      const result = resolveComboAttack({
        actorName: "Hero",
        className: "assassin",
        targetName: "Boss",
        stats: { ...baseStats, technique: 40, spirit: 40 },
        battleLevel: 20,
        baseDamage: 20,
        availableMp: 100
      });
      expect(result.totalDamage).toBe(result.hits.reduce((sum, hit) => sum + hit.damage, 0));
      if (result.events.some((e) => e.kind === "combo_milestone")) sawMilestone = true;
    }
    expect(sawMilestone).toBe(true);
  });
});

describe("mindset (心態) system", () => {
  it("vitality and tenacity raise the opening mindset", () => {
    const frail = initialMindset({ ...baseStats, vitality: 1, tenacity: 1 });
    const tough = initialMindset({ ...baseStats, vitality: 30, tenacity: 30 });
    expect(tough).toBeGreaterThan(frail);
    expect(initialMindset(baseStats)).toBeGreaterThanOrEqual(20);
    expect(initialMindset({ ...baseStats, vitality: 99, tenacity: 99 })).toBeLessThanOrEqual(100);
  });

  it("low mindset reduces damage, high mindset boosts it", () => {
    expect(mindsetDamageMultiplier(10)).toBeLessThan(1);
    expect(mindsetDamageMultiplier(60)).toBe(1);
    expect(mindsetDamageMultiplier(90)).toBeGreaterThan(1);
  });

  it("labels track the thresholds", () => {
    expect(mindsetLabel(90)).toBe("亢奮");
    expect(mindsetLabel(60)).toBe("穩定");
    expect(mindsetLabel(40)).toBe("緊繃");
    expect(mindsetLabel(10)).toBe("低落");
  });

  it("drift never falls below the tenacity/vitality floor", () => {
    const tough = { ...baseStats, vitality: 20, tenacity: 20 };
    let value = 80;
    for (let i = 0; i < 20; i += 1) value = driftMindset(value, tough, -50);
    const floor = Math.min(60, 18 + tough.tenacity * 1.4 + tough.vitality * 0.4);
    expect(value).toBeGreaterThanOrEqual(Math.round(floor));
    expect(value).toBeLessThanOrEqual(100);
  });

  it("high tenacity makes faltering essentially impossible", () => {
    const stubborn = { ...baseStats, tenacity: 40, vitality: 40 };
    let faltered = false;
    for (let i = 0; i < 200; i += 1) {
      if (rollMindsetFalter(5, 0.1, stubborn)) faltered = true;
    }
    expect(faltered).toBe(false);
    // 反例：心態與體韌都低時，瀕死才可能退縮
    expect(rollMindsetFalter(80, 0.1, baseStats)).toBe(false);
    expect(rollMindsetFalter(5, 0.9, baseStats)).toBe(false);
  });
});
