import type { BattleSpecialEvent, CharacterClass, CharacterStats, ComboHitDetail } from "../../shared/events";

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
  const extraDamage = 0;
  let supportHealing = 0;
  let bossAttackModifier = 1;

  // 暴擊與連擊已改由 resolveComboAttack 逐擊判定，這裡保留破防與隊友支援等戰術事件。
  if (roll(chance(0.04, input.stats.technique + Math.floor(input.stats.intelligence / 2), 0.008, 0.28))) {
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

// ---------------------------------------------------------------------------
// SAO 式連擊鏈系統
// 戰鬥等級決定連擊上限（16 級＝最多 16 連），技巧決定連擊是否接得下去，
// 運氣決定每一擊的暴擊，行動資源（精力 / MP）決定連擊撐不撐得住。
// ---------------------------------------------------------------------------

export const COMBO_HARD_CAP = 20;

const CLASS_MOVE_POOLS: Record<CharacterClass, { moves: string[]; finishers: string[] }> = {
  warrior: {
    moves: ["橫斬", "上挑", "重劈", "迴旋斬", "盾擊", "突進刺", "破甲斬", "斷岳擊", "雙手轟落", "戰吼追擊"],
    finishers: ["終結技「裂地崩岳」", "終結技「百鍛・斷鋼」"]
  },
  assassin: {
    moves: ["背刺", "影步突刺", "雙刃交錯", "斷筋割", "毒牙刺", "霧隱連割", "倒懸斬", "咽喉線", "影縫", "殘影連擊"],
    finishers: ["終結技「暗影十字」", "終結技「絕影・千刃」"]
  },
  mage: {
    moves: ["火矢", "寒霜箭", "雷紋脈衝", "風刃", "奧術飛彈", "熔岩濺射", "冰晶散射", "閃電鏈", "星塵爆", "虛空裂隙"],
    finishers: ["終結技「奧術洪流」", "終結技「隕星墜落」"]
  },
  priest: {
    moves: ["聖光彈", "裁決之鎚", "聖印衝擊", "光刃斬", "祈晨打擊", "淨化波", "聖環震盪", "輝光連打", "天啟之矛", "聖言轟鳴"],
    finishers: ["終結技「神罰降臨」", "終結技「晨曦審判」"]
  }
};

export function comboCapForLevel(battleLevel: number) {
  return Math.max(1, Math.min(COMBO_HARD_CAP, Math.floor(battleLevel)));
}

export function comboContinueChance(stats: CharacterStats, battleLevel: number) {
  return Math.min(0.92, 0.5 + Math.max(0, stats.technique) * 0.012 + Math.max(0, battleLevel) * 0.006);
}

export function comboMissChance(stats: CharacterStats) {
  return Math.max(0.02, 0.1 - Math.max(0, stats.technique) * 0.004);
}

export function critChance(stats: CharacterStats) {
  return Math.min(0.35, 0.06 + Math.max(0, stats.luck) * 0.009);
}

export function critMultiplier(stats: CharacterStats) {
  return 1.5 + Math.min(0.6, Math.max(0, stats.luck) * 0.012);
}

/** 各職業的單擊基準傷害：攻擊吃物理職、智慧吃法師、精神吃補師，技巧全職業小幅加成 */
export function comboBaseDamageFor(className: CharacterClass, stats: CharacterStats, battleLevel = 1, roleBonus = 0) {
  const levelBonus = Math.floor(Math.max(1, battleLevel) / 2);
  if (className === "mage") {
    return 8 + Math.round(stats.intelligence * 1.8 + stats.technique * 0.5) + levelBonus + roleBonus;
  }
  if (className === "assassin") {
    return 7 + Math.round(stats.attack * 1.2 + stats.technique * 1.0 + stats.luck * 0.4) + levelBonus + roleBonus;
  }
  if (className === "priest") {
    return 6 + Math.round(stats.spirit * 1.1 + stats.intelligence * 0.8) + levelBonus + roleBonus;
  }
  return 8 + Math.round(stats.attack * 1.5 + stats.technique * 0.5) + levelBonus + roleBonus;
}

export type ComboAttackInput = {
  actorUserId?: string | null;
  actorName: string;
  className: CharacterClass;
  targetName: string;
  stats: CharacterStats;
  battleLevel: number;
  /** 單擊基準傷害，由呼叫端依職業 / 屬性算出 */
  baseDamage: number;
  /** 可用行動資源（戰士 / 刺客 / 補師吃精力，法師吃 MP）；第 2 擊起每擊消耗 1 點 */
  availableResource: number;
};

export type ComboAttackResult = {
  hits: ComboHitDetail[];
  totalDamage: number;
  comboLength: number;
  missed: boolean;
  finisherTriggered: boolean;
  resourceSpent: number;
  /** 終結技成功時，壓低 Boss 下一輪攻勢 */
  bossAttackModifier: number;
  logs: string[];
  events: BattleSpecialEvent[];
};

export function resolveComboAttack(input: ComboAttackInput): ComboAttackResult {
  const pool = CLASS_MOVE_POOLS[input.className] || CLASS_MOVE_POOLS.warrior;
  const cap = comboCapForLevel(input.battleLevel);
  const pContinue = comboContinueChance(input.stats, input.battleLevel);
  const pMiss = comboMissChance(input.stats);
  const pCrit = critChance(input.stats);
  const critMult = critMultiplier(input.stats);

  const hits: ComboHitDetail[] = [];
  const logs: string[] = [];
  let totalDamage = 0;
  let missed = false;
  let resourceSpent = 0;
  let bossAttackModifier = 1;

  const usedMoves = new Set<number>();
  const pickMove = () => {
    if (usedMoves.size >= pool.moves.length) usedMoves.clear();
    let index = Math.floor(Math.random() * pool.moves.length);
    while (usedMoves.has(index)) index = (index + 1) % pool.moves.length;
    usedMoves.add(index);
    return pool.moves[index];
  };

  for (let hitIndex = 1; hitIndex <= cap; hitIndex += 1) {
    if (hitIndex > 1) {
      if (resourceSpent + 1 > input.availableResource) break; // 資源不足，連擊中斷
      if (!roll(pContinue)) break; // 沒接上
      resourceSpent += 1;
      if (roll(pMiss)) {
        missed = true;
        logs.push(`${input.actorName} 第 ${hitIndex} 擊落空，連擊中斷！`);
        break;
      }
    }

    const decay = Math.max(0.4, Math.pow(0.9, hitIndex - 1));
    const variance = 0.9 + Math.random() * 0.2;
    const isCrit = roll(pCrit);
    let damage = Math.max(1, Math.round(input.baseDamage * decay * variance * (isCrit ? critMult : 1)));

    const isLastPossible = hitIndex === cap;
    const chainLongEnough = hitIndex >= 4;
    const finisher = chainLongEnough && (isLastPossible || !roll(pContinue) || resourceSpent + 1 > input.availableResource);
    let moveName = pickMove();
    if (finisher) {
      moveName = pool.finishers[Math.floor(Math.random() * pool.finishers.length)];
      damage = Math.max(damage, Math.round(input.baseDamage * (1 + 0.06 * hitIndex) * (isCrit ? critMult : 1)));
      bossAttackModifier = Math.min(bossAttackModifier, 0.88);
    }

    hits.push({ index: hitIndex, moveName, damage, crit: isCrit, finisher });
    totalDamage += damage;
    if (finisher) {
      logs.push(`${moveName}爆發！${input.actorName} 以 ${hitIndex} 連擊收尾，造成 ${damage} 點傷害，並壓低 ${input.targetName} 的攻勢。`);
      break;
    }
    logs.push(`「${moveName}」第 ${hitIndex} 擊${isCrit ? "暴擊！" : ""}對 ${input.targetName} 造成 ${damage} 點傷害。`);
  }

  const comboLength = hits.length;
  const finisherTriggered = hits.some((hit) => hit.finisher);
  if (comboLength >= 2) {
    logs.push(`連擊 x${comboLength}${missed ? "（中途落空）" : " 全段命中"}，總傷害 ${totalDamage}。`);
  }

  const events: BattleSpecialEvent[] = [];
  if (comboLength >= 2) {
    events.push({
      kind: finisherTriggered ? "combo_finisher" : "combo_chain",
      actorUserId: input.actorUserId || null,
      label: finisherTriggered ? `${comboLength} 連擊・終結` : `${comboLength} 連擊`,
      message: logs.join("\n"),
      impact: {
        damage: totalDamage,
        comboLength,
        comboHits: hits,
        ...(bossAttackModifier < 1 ? { bossAttackModifier } : {})
      }
    });
  }

  return {
    hits,
    totalDamage,
    comboLength,
    missed,
    finisherTriggered,
    resourceSpent,
    bossAttackModifier,
    logs,
    events
  };
}

/** 防禦提供百分比減傷（遞減收益），韌性提供固定減傷 */
export function mitigateIncomingDamage(rawDamage: number, stats: CharacterStats) {
  const percentReduction = Math.max(0, stats.defense) / (Math.max(0, stats.defense) + 80);
  const flatReduction = Math.floor(Math.max(0, stats.tenacity) / 4);
  return Math.max(1, Math.round(rawDamage * (1 - percentReduction)) - flatReduction);
}
