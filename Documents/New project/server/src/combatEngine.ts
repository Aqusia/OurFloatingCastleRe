import type { BattleSpecialEvent, CharacterStats } from "../../shared/events";

function chance(base: number, stat: number, perPoint: number, max: number) {
  return Math.min(max, base + Math.max(0, stat) * perPoint);
}

function roll(probability: number) {
  return Math.random() < probability;
}

export function rollAttackSpecialEvents(input: {
  actorUserId?: string | null;
  actorName: string;
  bossName: string;
  stats: CharacterStats;
  baseDamage: number;
  lowestAllyName?: string | null;
  lowestAllyHpRatio?: number | null;
}) {
  const events: BattleSpecialEvent[] = [];
  let extraDamage = 0;
  let supportHealing = 0;
  let bossAttackModifier = 1;

  if (roll(chance(0.06, input.stats.luck, 0.012, 0.42))) {
    const damage = Math.max(4, Math.round(input.baseDamage * (0.35 + input.stats.luck * 0.01)));
    extraDamage += damage;
    events.push({
      kind: "lucky_crit",
      actorUserId: input.actorUserId || null,
      label: "幸運暴擊",
      message: `${input.actorName} 抓到破綻，幸運暴擊追加 ${damage} 點傷害。`,
      impact: { damage }
    });
  }

  if (roll(chance(0.05, input.stats.technique, 0.014, 0.46))) {
    const damage = Math.max(3, Math.round(input.baseDamage * (0.24 + input.stats.technique * 0.008)));
    extraDamage += damage;
    events.push({
      kind: "technique_combo",
      actorUserId: input.actorUserId || null,
      label: "技巧連擊",
      message: `${input.actorName} 接上技巧連擊，追加 ${damage} 點傷害。`,
      impact: { damage }
    });
  }

  if (roll(chance(0.04, input.stats.technique, 0.008, 0.28))) {
    bossAttackModifier = 0.9;
    events.push({
      kind: "armor_break",
      actorUserId: input.actorUserId || null,
      label: "精準破防",
      message: `${input.actorName} 精準破防，壓低 ${input.bossName} 下一次攻勢。`,
      impact: { bossAttackModifier }
    });
  }

  if (input.lowestAllyName && (input.lowestAllyHpRatio ?? 1) < 0.72 && roll(chance(0.04, input.stats.luck + input.stats.technique, 0.004, 0.24))) {
    supportHealing = Math.max(4, Math.round(6 + input.stats.spirit * 0.8 + input.stats.luck * 0.4));
    events.push({
      kind: "ally_support",
      actorUserId: input.actorUserId || null,
      label: "隊友支援",
      message: `${input.actorName} 支援 ${input.lowestAllyName}，回復 ${supportHealing} 點生命。`,
      impact: { healing: supportHealing }
    });
  }

  return { events, extraDamage, supportHealing, bossAttackModifier };
}

export function rollDangerDodge(input: {
  actorUserId?: string | null;
  actorName: string;
  stats: CharacterStats;
  hpRatio: number;
  incomingDamage: number;
}) {
  if (input.hpRatio > 0.38 || !roll(chance(0.06, input.stats.luck, 0.01, 0.38))) {
    return { event: null as BattleSpecialEvent | null, damageReduction: 0 };
  }

  const damageReduction = Math.max(1, Math.ceil(input.incomingDamage * 0.45));
  return {
    event: {
      kind: "danger_dodge",
      actorUserId: input.actorUserId || null,
      label: "危急閃避",
      message: `${input.actorName} 在危急時閃避，減免 ${damageReduction} 點傷害。`,
      impact: { damageReduction }
    } satisfies BattleSpecialEvent,
    damageReduction
  };
}

export function rollBossCounterEvent(input: { bossName: string; tick: number; livingCount: number; attackPower: number }) {
  if (input.tick < 2 || !roll(Math.min(0.34, 0.12 + input.tick * 0.015))) {
    return null as BattleSpecialEvent | null;
  }

  const damage = Math.max(3, Math.round(input.attackPower * (input.livingCount >= 3 ? 0.45 : 0.3)));
  return {
    kind: "boss_counter",
    actorUserId: null,
    label: "Boss 反制",
    message: `${input.bossName} 發動反制，對全隊施加壓力。`,
    impact: { damage }
  } satisfies BattleSpecialEvent;
}
