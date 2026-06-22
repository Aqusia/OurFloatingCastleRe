import type { ActiveStatus, BattleSpecialEvent, CharacterClass, CharacterStats, ComboHitDetail } from "../../shared/events";

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

  if (
    input.lowestAllyName &&
    (input.lowestAllyHpRatio ?? 1) < 0.72 &&
    roll(chance(0.04, input.stats.luck + input.stats.technique, 0.004, 0.24))
  ) {
    supportHealing = Math.max(4, Math.round(6 + input.stats.spirit * 0.8 + input.stats.luck * 0.4));
    events.push({
      kind: "ally_support",
      actorUserId: input.actorUserId || null,
      label: "隊友支援",
      message: `${input.actorName} 支援 ${input.lowestAllyName}，回復 ${supportHealing} 點生命。`,
      impact: { healing: supportHealing }
    });
  }

  if (roll(chance(0.03, input.stats.luck, 0.006, 0.24))) {
    const twists = ["腳下一滑露出破綻", "踩到尖銳碎石", "被掉落補給箱砸中", "踩到樂高般的尖刺"];
    const twist = twists[Math.floor(Math.random() * twists.length)];
    const damage = Math.max(3, Math.round(input.baseDamage * (0.1 + Math.min(0.18, input.stats.luck * 0.004))));
    extraDamage += damage;
    bossAttackModifier = Math.min(bossAttackModifier, 0.94);
    events.push({
      kind: "lucky_twist",
      actorUserId: input.actorUserId || null,
      label: "幸運事故",
      message: `${input.bossName} ${twist}，額外受到 ${damage} 點傷害。`,
      impact: { damage, bossAttackModifier }
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
  // 速度(spirit) 主導閃避（大），運氣次之，技巧僅小幅貢獻
  const dodgeStat = input.stats.spirit + Math.floor(input.stats.luck * 0.5) + Math.floor(input.stats.technique * 0.25);
  if (input.hpRatio > 0.38 || !roll(chance(0.05, dodgeStat, 0.006, 0.42))) {
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

export function rollBlockMitigation(input: {
  actorUserId?: string | null;
  actorName: string;
  stats: CharacterStats;
  incomingDamage: number;
}) {
  // 格擋由防禦與技巧主導（技巧大幅貢獻），韌性小幅加成
  const blockStat =
    input.stats.defense + Math.floor(input.stats.technique * 0.7) + Math.floor(input.stats.tenacity * 0.2);
  if (!roll(chance(0.04, blockStat, 0.006, 0.38))) {
    return { event: null as BattleSpecialEvent | null, damageReduction: 0 };
  }

  const reductionRate = Math.min(0.55, 0.22 + input.stats.defense * 0.004 + input.stats.tenacity * 0.003);
  const damageReduction = Math.max(1, Math.round(input.incomingDamage * reductionRate));
  return {
    event: {
      kind: "block",
      actorUserId: input.actorUserId || null,
      label: "格擋減傷",
      message: `${input.actorName} 格擋攻擊，減免 ${damageReduction} 點傷害。`,
      impact: { damageReduction }
    } satisfies BattleSpecialEvent,
    damageReduction
  };
}

export function rollCounterStrike(input: {
  actorUserId?: string | null;
  actorName: string;
  targetName: string;
  stats: CharacterStats;
  battleLevel: number;
}) {
  // 反擊由技巧主導（大），速度僅小幅提供反擊窗口
  const counterStat = input.stats.technique + Math.floor(input.stats.spirit * 0.3);
  if (!roll(chance(0.03, counterStat, 0.006, 0.34))) {
    return { event: null as BattleSpecialEvent | null, damage: 0 };
  }

  const damage = Math.max(
    3,
    Math.round(
      6 + input.stats.attack * 0.75 + input.stats.technique * 1.15 + input.stats.spirit * 0.35 + input.battleLevel * 1.5
    )
  );
  return {
    event: {
      kind: "counter_strike",
      actorUserId: input.actorUserId || null,
      label: "技巧反擊",
      message: `${input.actorName} 抓到空檔反擊 ${input.targetName}，造成 ${damage} 點傷害。`,
      impact: { damage }
    } satisfies BattleSpecialEvent,
    damage
  };
}

export function rollBossCounterEvent(input: {
  bossName: string;
  tick: number;
  livingCount: number;
  attackPower: number;
}) {
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
// 進階戰技與狀態效果（2026-06-22 豐富化）
// 破甲穿刺 / 灼燒 / 劇毒 / 冰封 / 震懾：在連擊之外追加爆發或對 Boss 施加持續狀態，
// 讓戰鬥更有層次。狀態於每回合開頭由 tickStatuses 結算（DoT、凍結減攻、眩暈跳過、破甲加重）。
// ---------------------------------------------------------------------------

function makeStatus(kind: ActiveStatus["kind"], label: string, remaining: number, magnitude: number): ActiveStatus {
  return { kind, label, remaining, magnitude };
}

/** 進階攻擊戰技：可能追加爆發傷害並對 Boss 施加持續狀態。回傳事件、額外傷害與待套用狀態。 */
export function rollOffensiveSpecials(input: {
  actorUserId?: string | null;
  actorName: string;
  bossName: string;
  stats: CharacterStats;
  baseDamage: number;
}) {
  const s = input.stats;
  const events: BattleSpecialEvent[] = [];
  const statuses: ActiveStatus[] = [];
  let extraDamage = 0;

  // 破甲穿刺：爆發傷害 + 破甲（受擊加重）
  if (roll(chance(0.05, Math.max(0, s.attack) + Math.floor(Math.max(0, s.technique) / 2), 0.007, 0.3))) {
    const dmg = Math.max(5, Math.round(input.baseDamage * 0.4));
    extraDamage += dmg;
    statuses.push(makeStatus("armor_break", "破甲", 2, 0.12));
    events.push({
      kind: "piercing_strike",
      actorUserId: input.actorUserId || null,
      label: "破甲穿刺",
      message: `${input.actorName} 破甲穿刺，造成 ${dmg} 點傷害並削弱 ${input.bossName} 的防禦。`,
      impact: { damage: dmg }
    });
  }
  // 灼燒：燃燒 DoT
  if (roll(chance(0.05, Math.max(0, s.intelligence) + Math.floor(Math.max(0, s.technique) / 2), 0.006, 0.3))) {
    const mag = Math.max(3, Math.round(input.baseDamage * 0.15));
    statuses.push(makeStatus("burn", "燃燒", 3, mag));
    events.push({
      kind: "ignite",
      actorUserId: input.actorUserId || null,
      label: "灼燒",
      message: `${input.actorName} 點燃 ${input.bossName}，使其陷入燃燒（每回合 ${mag} 點）。`,
      impact: {}
    });
  }
  // 劇毒：中毒 DoT（可疊加）
  if (roll(chance(0.045, Math.max(0, s.luck) + Math.max(0, s.technique), 0.005, 0.28))) {
    const mag = Math.max(2, Math.round(input.baseDamage * 0.1));
    statuses.push(makeStatus("poison", "中毒", 3, mag));
    events.push({
      kind: "poison_strike",
      actorUserId: input.actorUserId || null,
      label: "劇毒",
      message: `${input.actorName} 以毒刃命中 ${input.bossName}，造成中毒（每回合 ${mag} 點，可疊加）。`,
      impact: {}
    });
  }
  // 冰封：凍結，削弱 Boss 下一次攻勢
  if (roll(chance(0.04, Math.max(0, s.intelligence) + Math.max(0, s.spirit), 0.005, 0.24))) {
    statuses.push(makeStatus("freeze", "冰凍", 1, 0.6));
    events.push({
      kind: "frostbite",
      actorUserId: input.actorUserId || null,
      label: "冰封",
      message: `${input.actorName} 冰封 ${input.bossName}，下一次攻勢被大幅削弱。`,
      impact: {}
    });
  }
  // 震懾：眩暈，Boss 跳過下一次行動
  if (roll(chance(0.03, Math.max(0, s.attack) + Math.max(0, s.technique), 0.004, 0.2))) {
    statuses.push(makeStatus("stun", "眩暈", 1, 1));
    events.push({
      kind: "stun_blow",
      actorUserId: input.actorUserId || null,
      label: "震懾",
      message: `${input.actorName} 震懾 ${input.bossName}，使其下一次行動失措！`,
      impact: {}
    });
  }

  return { events, extraDamage, statuses };
}

/** 將新施加的狀態併入既有狀態列：中毒疊加強度，其餘刷新持續時間並取較高強度。回傳新陣列。 */
export function applyStatuses(target: ActiveStatus[], incoming: ActiveStatus[]): ActiveStatus[] {
  const out = target.map((s) => ({ ...s }));
  for (const st of incoming) {
    const existing = out.find((e) => e.kind === st.kind);
    if (existing) {
      existing.remaining = Math.max(existing.remaining, st.remaining);
      existing.magnitude =
        st.kind === "poison"
          ? Math.min(existing.magnitude + st.magnitude, st.magnitude * 5)
          : Math.max(existing.magnitude, st.magnitude);
    } else {
      out.push({ ...st });
    }
  }
  return out;
}

export type StatusTickResult = {
  statuses: ActiveStatus[];
  damage: number;
  attackMultiplier: number;
  skipAttack: boolean;
  incomingMultiplier: number;
  event: BattleSpecialEvent | null;
};

/** 每回合開頭結算 Boss 身上的狀態：DoT 傷害、凍結減攻、眩暈跳過、破甲加重，並遞減持續時間。 */
export function tickStatuses(statuses: ActiveStatus[], bossName: string): StatusTickResult {
  let damage = 0;
  let attackMultiplier = 1;
  let incomingMultiplier = 1;
  let skipAttack = false;
  const active: ActiveStatus[] = [];
  const survivors: ActiveStatus[] = [];

  for (const st of statuses) {
    if (st.kind === "burn" || st.kind === "poison") damage += st.magnitude;
    else if (st.kind === "freeze") attackMultiplier *= st.magnitude;
    else if (st.kind === "stun") skipAttack = true;
    else if (st.kind === "armor_break") incomingMultiplier *= 1 + st.magnitude;
    active.push({ ...st });
    const remaining = st.remaining - 1;
    if (remaining > 0) survivors.push({ ...st, remaining });
  }

  let event: BattleSpecialEvent | null = null;
  if (active.length) {
    const parts = active.map((s) => `${s.label}(${s.remaining})`);
    event = {
      kind: "status_tick",
      actorUserId: null,
      label: "持續效果",
      message: `${bossName} 承受 ${parts.join("、")}${damage > 0 ? `，受到 ${damage} 點持續傷害` : ""}${
        skipAttack ? "，且行動失措" : ""
      }。`,
      impact: { ...(damage > 0 ? { damage } : {}), statuses: active }
    };
  }

  return { statuses: survivors, damage, attackMultiplier, skipAttack, incomingMultiplier, event };
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
    moves: [
      "聖光彈",
      "裁決之鎚",
      "聖印衝擊",
      "光刃斬",
      "祈晨打擊",
      "淨化波",
      "聖環震盪",
      "輝光連打",
      "天啟之矛",
      "聖言轟鳴"
    ],
    finishers: ["終結技「神罰降臨」", "終結技「晨曦審判」"]
  }
};

export function comboCapForLevel(battleLevel: number) {
  return Math.max(1, Math.min(COMBO_HARD_CAP, Math.floor(battleLevel)));
}

// 速度(spirit) 主導連擊接續次數（大）；技巧(technique) 主導命中與暴擊（大）。
export function comboContinueChance(stats: CharacterStats, battleLevel: number) {
  return Math.min(
    0.94,
    0.45 + Math.max(0, stats.spirit) * 0.016 + Math.max(0, stats.technique) * 0.006 + Math.max(0, battleLevel) * 0.006
  );
}

export function comboMissChance(stats: CharacterStats) {
  return Math.max(0.015, 0.11 - Math.max(0, stats.technique) * 0.004 - Math.max(0, stats.spirit) * 0.003);
}

export function critChance(stats: CharacterStats) {
  return Math.min(
    0.42,
    0.05 + Math.max(0, stats.technique) * 0.009 + Math.max(0, stats.luck) * 0.003 + Math.max(0, stats.spirit) * 0.002
  );
}

export function critMultiplier(stats: CharacterStats) {
  return 1.45 + Math.min(0.65, Math.max(0, stats.luck) * 0.01 + Math.max(0, stats.intelligence) * 0.003);
}

/** 各職業的單擊基準傷害：攻擊吃物理職，智慧吃法師與技能，速度支撐補師節奏，技巧全職業小幅加成 */
export function comboBaseDamageFor(className: CharacterClass, stats: CharacterStats, battleLevel = 1, roleBonus = 0) {
  const levelBonus = Math.floor(Math.max(1, battleLevel) / 2);
  if (className === "mage") {
    return 8 + Math.round(stats.intelligence * 1.8 + stats.technique * 0.5) + levelBonus + roleBonus;
  }
  if (className === "assassin") {
    return 7 + Math.round(stats.attack * 1.2 + stats.technique * 1.0 + stats.luck * 0.4) + levelBonus + roleBonus;
  }
  if (className === "priest") {
    return (
      6 + Math.round(stats.attack * 0.35 + stats.spirit * 0.8 + stats.intelligence * 0.75) + levelBonus + roleBonus
    );
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
  /** 可用 MP：連擊第 2 擊起每擊消耗 1 MP（全職業統一吃 MP）。行動本身另外消耗精力，由呼叫端扣除。 */
  availableMp: number;
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
      if (resourceSpent + 1 > input.availableMp) break; // MP 不足，連擊中斷
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
    const finisher =
      chainLongEnough && (isLastPossible || !roll(pContinue) || resourceSpent + 1 > input.availableMp);
    let moveName = pickMove();
    if (finisher) {
      moveName = pool.finishers[Math.floor(Math.random() * pool.finishers.length)];
      damage = Math.max(damage, Math.round(input.baseDamage * (1 + 0.06 * hitIndex) * (isCrit ? critMult : 1)));
      bossAttackModifier = Math.min(bossAttackModifier, 0.88);
    }

    hits.push({ index: hitIndex, moveName, damage, crit: isCrit, finisher });
    totalDamage += damage;
    if (finisher) {
      logs.push(
        `${moveName}爆發！${input.actorName} 以 ${hitIndex} 連擊收尾，造成 ${damage} 點傷害，並壓低 ${input.targetName} 的攻勢。`
      );
      break;
    }
    logs.push(`${input.actorName} 攻擊 ${input.targetName}${isCrit ? "，暴擊" : ""}，造成 ${damage} 點傷害。`);
  }

  const comboLength = hits.length;
  const finisherTriggered = hits.some((hit) => hit.finisher);

  // 連擊里程碑：8/12/16/20 連擊追加爆發傷害（加到最後一擊，維持 totalDamage = 各擊總和）
  let milestoneReached = 0;
  let milestoneBonus = 0;
  for (const [threshold, factor] of [
    [20, 0.4],
    [16, 0.3],
    [12, 0.2],
    [8, 0.12]
  ] as Array<[number, number]>) {
    if (comboLength >= threshold) {
      milestoneReached = threshold;
      milestoneBonus = Math.round(totalDamage * factor);
      break;
    }
  }
  if (milestoneBonus > 0 && hits.length > 0) {
    hits[hits.length - 1].damage += milestoneBonus;
    totalDamage += milestoneBonus;
  }

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

  if (milestoneReached > 0) {
    events.push({
      kind: "combo_milestone",
      actorUserId: input.actorUserId || null,
      label: `${milestoneReached} 連擊里程碑`,
      message: `${input.actorName} 打出 ${milestoneReached} 連擊里程碑，追加 ${milestoneBonus} 點爆發傷害！`,
      impact: { damage: milestoneBonus, milestone: milestoneReached }
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

/** 防禦提供百分比減傷與部分固定減傷，韌性提供較大的固定減傷（硬韌） */
export function mitigateIncomingDamage(rawDamage: number, stats: CharacterStats) {
  const percentReduction = Math.max(0, stats.defense) / (Math.max(0, stats.defense) + 80);
  const flatReduction = Math.floor(Math.max(0, stats.tenacity) / 3) + Math.floor(Math.max(0, stats.defense) / 10);
  return Math.max(1, Math.round(rawDamage * (1 - percentReduction)) - flatReduction);
}

// ---------------------------------------------------------------------------
// 心態（mindset / 士氣）系統
// 體力(vitality) 與韌性(tenacity) 撐起心態：高心態進入「好狀態」小幅增傷，
// 低心態時略為降傷；體/韌 越高，越不會因心態低落而降傷或退縮（投降）。
// ---------------------------------------------------------------------------

/** 開場心態（0–100）：體力小幅、韌性大幅墊高基礎值 */
export function initialMindset(stats: CharacterStats) {
  const base = 50 + Math.max(0, stats.vitality) * 1.2 + Math.max(0, stats.tenacity) * 2.6;
  return Math.round(Math.min(100, Math.max(20, base)));
}

/**
 * 心態每回合漂移：受重擊下降、打出連擊/暴擊上升；體/韌 提供穩定回復下限。
 * delta 由呼叫端依當回合戰況給出（正＝振奮、負＝受挫）。
 */
export function driftMindset(current: number, stats: CharacterStats, delta: number) {
  const recovery = 1 + Math.max(0, stats.vitality) * 0.05 + Math.max(0, stats.tenacity) * 0.12;
  const floor = Math.min(60, 18 + Math.max(0, stats.tenacity) * 1.4 + Math.max(0, stats.vitality) * 0.4);
  const next = current + delta + (delta >= 0 ? recovery : recovery * 0.5);
  return Math.round(Math.min(100, Math.max(floor, next)));
}

/** 心態對輸出傷害的乘數：好狀態(>=80) 小幅增傷；低落(<30) 略降傷。 */
export function mindsetDamageMultiplier(mindset: number) {
  if (mindset >= 80) return 1.12;
  if (mindset >= 55) return 1.0;
  if (mindset >= 30) return 0.94;
  return 0.85;
}

/** 心態狀態標籤，用於戰報敘述 */
export function mindsetLabel(mindset: number): "亢奮" | "穩定" | "緊繃" | "低落" {
  if (mindset >= 80) return "亢奮";
  if (mindset >= 55) return "穩定";
  if (mindset >= 30) return "緊繃";
  return "低落";
}

/**
 * 退縮 / 投降判定：僅在心態極低且瀕死時可能發生；體/韌 大幅降低機率（高韌幾乎不退縮）。
 */
export function rollMindsetFalter(mindset: number, hpRatio: number, stats: CharacterStats) {
  if (mindset >= 22 || hpRatio > 0.25) return false;
  const resolve = Math.max(0, stats.tenacity) * 0.05 + Math.max(0, stats.vitality) * 0.02;
  const chance = Math.max(0, 0.32 - resolve);
  return Math.random() < chance;
}
