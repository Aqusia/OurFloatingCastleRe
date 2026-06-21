import type {
  AuthUser,
  BattleRecordSummary,
  BattleSummary,
  BattleSpecialEvent,
  BattleTickEvent,
  BattleWinner,
  BattleContext,
  BossState,
  CharacterProfile,
  LoadoutSummary,
  RoomMemberState,
  RoomState,
  RoomSummary,
  SpecialSkillDefinition
} from "../../shared/events";
import {
  comboBaseDamageFor,
  mitigateIncomingDamage,
  resolveComboAttack,
  rollAttackSpecialEvents,
  rollBossCounterEvent,
  rollDangerDodge
} from "./combatEngine";
import { recordBattle, syncBattleResult, updateCharacter } from "./persistence/localStore";
import {
  bossBaseAttack,
  bossBaseHp,
  buildSkillLogLines,
  capLogs,
  cloneCharacter,
  gameplaySecondaryCharacterCatalog,
  gameplayRoomBossRules,
  gameplaySpecialSkillCatalog,
  hasEquippedTimeManual,
  maxEnergyForCharacter,
  maxHpForCharacter,
  maxMpForCharacter,
  nowIso,
  randomFrom,
  randomId,
  randomRoomId,
  resolveTimeStopWindow,
  sanitizePartyCode,
  setPreferredRole
} from "./utils";

type RoomInternal = RoomState & {
  startedAt: string | null;
  tick: number;
  interval?: NodeJS.Timeout;
};

const rooms = new Map<string, RoomInternal>();
const socketToRoom = new Map<string, string>();

function toMember(user: AuthUser, character: CharacterProfile, socketId: string, isHost: boolean): RoomMemberState {
  const cloned = cloneCharacter(character);
  const maxHp = maxHpForCharacter(cloned);
  const maxMp = maxMpForCharacter(cloned);
  const maxEnergy = maxEnergyForCharacter(cloned);
  return {
    userId: user.id,
    socketId,
    displayName: user.displayName,
    isHost,
    character: cloned,
    currentHp: Math.min(cloned.hp, maxHp),
    maxHp,
    currentMp: Math.min(cloned.mp, maxMp),
    maxMp,
    currentEnergy: Math.min(cloned.energy, maxEnergy),
    maxEnergy,
    defending: false,
    battleStats: {
      damageDealt: 0,
      healingDone: 0,
      damageTaken: 0
    }
  };
}

function createBoss(memberCount: number, battleContext: BattleContext = "raid", averageLevel = 1): BossState {
  const roomBossRules = gameplayRoomBossRules();
  const hp = Math.round(
    bossBaseHp(memberCount, battleContext, averageLevel) * (battleContext === "raid" ? roomBossRules.hpMultiplier : 1)
  );
  return {
    id: randomId("boss"),
    name: battleContext === "raid" ? roomBossRules.bossName : battleContext === "castle" ? "守城統領" : "陣營領主",
    hp,
    maxHp: hp,
    attackPower: Math.round(
      bossBaseAttack(memberCount, battleContext, averageLevel) *
        (battleContext === "raid" ? roomBossRules.attackMultiplier : 1)
    )
  };
}

function averageBattleLevel(members: Array<{ character: CharacterProfile }>) {
  if (!members.length) return 1;
  const total = members.reduce((sum, member) => sum + Math.max(1, member.character.battleLevel || 1), 0);
  return total / members.length;
}

function ensureRoom(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error("找不到房間。");
  }
  return room;
}

function roomSummary(room: RoomInternal): RoomSummary {
  return {
    roomId: room.roomId,
    hostId: room.hostId,
    phase: room.phase,
    memberCount: room.members.length,
    members: room.members.map((member) => ({
      userId: member.userId,
      displayName: member.displayName,
      isHost: member.isHost
    })),
    createdAt: room.createdAt,
    battleContext: room.battleConfig?.battleContext || "raid"
  };
}

export function listRoomSummaries() {
  return Array.from(rooms.values())
    .filter((room) => room.phase === "lobby")
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map(roomSummary);
}

export function getRoomForSocket(socketId: string) {
  const roomId = socketToRoom.get(socketId);
  return roomId ? rooms.get(roomId) || null : null;
}

export function getRoomState(roomId: string) {
  return rooms.get(roomId) || null;
}

export function getPublicRoomState(roomId: string) {
  const room = rooms.get(roomId);
  return room ? publicRoomState(room) : null;
}

export function isUserInRoom(userId: string) {
  return Array.from(rooms.values()).some((room) => room.members.some((member) => member.userId === userId));
}

export function getRoomForUser(userId: string) {
  return Array.from(rooms.values()).find((room) => room.members.some((member) => member.userId === userId)) || null;
}

export function refreshRoomMemberCharacters(roomId: string, characters: CharacterProfile[]) {
  const room = ensureRoom(roomId);
  for (const member of room.members) {
    const nextCharacter = characters.find((character) => character.userId === member.userId);
    if (!nextCharacter) continue;
    member.character = cloneCharacter(nextCharacter);
  }
  return room;
}

export function leaveRoom(socketId: string) {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) {
    return null;
  }

  socketToRoom.delete(socketId);
  const room = rooms.get(roomId);
  if (!room) {
    return null;
  }

  const departingMember = room.members.find((member) => member.socketId === socketId) || null;
  room.members = room.members.filter((member) => member.socketId !== socketId);
  room.logs = capLogs([...room.logs, `${departingMember?.displayName || "玩家"} 離開了房間。`]);

  if (room.members.length === 0) {
    if (room.interval) {
      clearInterval(room.interval);
    }
    rooms.delete(roomId);
    return null;
  }

  if (!room.members.some((member) => member.userId === room.hostId)) {
    room.hostId = room.members[0].userId;
    room.logs = capLogs([...room.logs, `${room.members[0].displayName} 成為新的房主。`]);
  }

  room.members = room.members.map((member) => ({
    ...member,
    isHost: member.userId === room.hostId
  }));
  return room;
}

export function createRoom(user: AuthUser, character: CharacterProfile, socketId: string, requestedRoomId?: string) {
  leaveRoom(socketId);
  const roomBossRules = gameplayRoomBossRules();
  const sanitizedCode = sanitizePartyCode(requestedRoomId);
  let roomId = sanitizedCode || randomRoomId();
  if (sanitizedCode && rooms.has(roomId)) {
    throw new Error("這個隊伍代碼已經有人使用。");
  }
  while (!sanitizedCode && rooms.has(roomId)) {
    roomId = randomRoomId();
  }

  const room: RoomInternal = {
    roomId,
    hostId: user.id,
    phase: "lobby",
    members: [toMember(user, character, socketId, true)],
    boss: null,
    logs: ["房間已建立，等待隊友加入。"],
    createdAt: nowIso(),
    battleConfig: {
      tickIntervalMs: roomBossRules.tickIntervalMs,
      bossName: roomBossRules.bossName,
      battleContext: "raid"
    },
    battleSummary: null,
    startedAt: null,
    tick: 0
  };

  rooms.set(roomId, room);
  socketToRoom.set(socketId, roomId);
  return room;
}

export function joinRoom(roomId: string, user: AuthUser, character: CharacterProfile, socketId: string) {
  leaveRoom(socketId);
  const room = ensureRoom(roomId);
  if (room.phase !== "lobby") {
    throw new Error("這個房間已經開始戰鬥了。");
  }
  if (room.members.length >= 4 && !room.members.some((member) => member.userId === user.id)) {
    throw new Error("房間已滿。");
  }

  const existing = room.members.find((member) => member.userId === user.id);
  if (existing) {
    existing.socketId = socketId;
    existing.displayName = user.displayName;
    existing.character = cloneCharacter(character);
    existing.currentHp = Math.min(character.hp, existing.maxHp);
    existing.currentMp = Math.min(character.mp, existing.maxMp);
    existing.currentEnergy = Math.min(character.energy, existing.maxEnergy);
  } else {
    room.members.push(toMember(user, character, socketId, false));
  }

  socketToRoom.set(socketId, roomId);
  room.logs = capLogs([...room.logs, `${user.displayName} 加入了房間。`]);
  return room;
}

export async function updateLoadoutForSocket(socketId: string, loadout: Partial<LoadoutSummary>) {
  const room = getRoomForSocket(socketId);
  if (!room) {
    throw new Error("你目前不在任何房間。");
  }

  const member = room.members.find((entry) => entry.socketId === socketId);
  if (!member) {
    throw new Error("找不到房內成員。");
  }

  member.character.loadout = {
    ...member.character.loadout,
    ...loadout
  };
  if (loadout.preferredRole) {
    setPreferredRole(member.character, loadout.preferredRole);
  }
  await updateCharacter(member.character);
  room.logs = capLogs([...room.logs, `${member.displayName} 更新了房間配置。`]);
  return {
    room,
    character: member.character
  };
}

export function prepareRoomMembers(room: RoomInternal) {
  room.members = room.members.map((member) => {
    const maxHp = maxHpForCharacter(member.character);
    const maxMp = maxMpForCharacter(member.character);
    const maxEnergy = maxEnergyForCharacter(member.character);
    return {
      ...member,
      currentHp: Math.min(member.character.hp, maxHp),
      maxHp,
      currentMp: Math.min(member.character.mp, maxMp),
      maxMp,
      currentEnergy: Math.min(member.character.energy, maxEnergy),
      maxEnergy,
      defending: false,
      battleStats: {
        damageDealt: 0,
        healingDone: 0,
        damageTaken: 0
      }
    };
  });
}

export function startBattle(roomId: string, userId: string) {
  const room = ensureRoom(roomId);
  if (room.hostId !== userId) {
    throw new Error("只有房主可以開始戰鬥。");
  }
  if (room.phase !== "lobby") {
    throw new Error("這個房間已經在戰鬥中。");
  }

  room.phase = "battle";
  room.startedAt = nowIso();
  room.tick = 0;
  room.battleSummary = null;
  prepareRoomMembers(room);
  room.boss = createBoss(
    room.members.length,
    room.battleConfig?.battleContext || "raid",
    averageBattleLevel(room.members)
  );
  if (room.battleConfig?.bossName) {
    room.boss.name = room.battleConfig.bossName;
  }
  room.logs = capLogs([...room.logs, `戰鬥開始，${room.boss.name} 現身了。`]);
  return room;
}

type BattleActionResult = {
  message: string;
  events: BattleSpecialEvent[];
  logs?: string[];
};

function livingMembers(room: RoomInternal) {
  return room.members.filter((member) => member.currentHp > 0);
}

function applyAttackSpecials(member: RoomMemberState, room: RoomInternal, baseDamage: number): BattleSpecialEvent[] {
  const boss = room.boss!;
  const allies = livingMembers(room);
  const lowestAlly = [...allies].sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)[0];
  const result = rollAttackSpecialEvents({
    actorUserId: member.userId,
    actorName: member.displayName,
    bossName: boss.name,
    stats: member.character.stats,
    baseDamage,
    lowestAllyName: lowestAlly?.displayName || null,
    lowestAllyHpRatio: lowestAlly ? lowestAlly.currentHp / lowestAlly.maxHp : null
  });

  if (result.extraDamage > 0) {
    boss.hp = Math.max(0, boss.hp - result.extraDamage);
    member.battleStats.damageDealt += result.extraDamage;
  }
  if (result.supportHealing > 0 && lowestAlly) {
    lowestAlly.currentHp = Math.min(lowestAlly.maxHp, lowestAlly.currentHp + result.supportHealing);
    member.battleStats.healingDone += result.supportHealing;
  }
  return result.events;
}

function secondaryPreferenceMultiplier(
  member: RoomMemberState,
  preferredSlots?: Array<keyof CharacterProfile["equipmentSlots"]>
) {
  if (!preferredSlots?.length) return 1;
  return preferredSlots.some((slot) => Boolean(member.character.equipmentSlots[slot])) ? 1.18 : 1;
}

function equippedSpecialSkillIds(character: CharacterProfile) {
  const source = Array.isArray(character.specialSkillSlots)
    ? character.specialSkillSlots
    : [character.specialSkillSlot];
  return new Set(source.filter((skillId): skillId is string => typeof skillId === "string" && skillId.length > 0));
}

function rollSecondaryCharacterSkills(member: RoomMemberState, room: RoomInternal): BattleActionResult {
  const boss = room.boss!;
  const events: BattleSpecialEvent[] = [];
  const messages: string[] = [];
  const definitions = gameplaySecondaryCharacterCatalog();
  const skills = gameplaySpecialSkillCatalog();
  const equippedSkillIds = equippedSpecialSkillIds(member.character);
  const allies = livingMembers(room);
  const lowestAlly = [...allies].sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)[0] || null;

  for (const slot of member.character.secondaryCharacters) {
    if (!slot.characterId || (slot.cooldownUntilTick || 0) > room.tick || boss.hp <= 0) continue;
    const definition = definitions.find((entry) => entry.id === slot.characterId);
    if (!definition) continue;
    const unlocked = (slot.unlockedSkillIds?.length ? slot.unlockedSkillIds : definition.unlockedSkillIds).filter(
      (skillId) => {
        const skill = skills.find((entry) => entry.id === skillId);
        return skill && equippedSkillIds.has(skillId) && (skill.unlockLevel || 1) <= slot.level;
      }
    );
    if (!unlocked.length) continue;
    const availableSkills = unlocked
      .map((skillId) => skills.find((entry) => entry.id === skillId))
      .filter((skill): skill is SpecialSkillDefinition => Boolean(skill));
    const skill = randomFrom(availableSkills);
    const affinity = definition.classAffinity?.[member.character.className] ?? 1;
    const equipmentMultiplier = secondaryPreferenceMultiplier(member, definition.preferredEquipmentSlots);
    const chance = Math.min(
      0.86,
      (skill.baseChance || 0.38) +
        0.18 +
        (slot.level - 1) * 0.025 +
        (affinity - 1) * 0.14 +
        (equipmentMultiplier - 1) * 0.08
    );
    if (Math.random() >= chance) continue;

    const levelMultiplier = 1 + (slot.level - 1) * 0.12;
    const damageBase =
      member.character.stats.attack +
      member.character.stats.technique +
      Math.floor(member.character.stats.intelligence * 0.7) +
      Math.floor(member.character.stats.luck * 0.5);
    const timeManualActive = skill.id.includes("time_stop") && hasEquippedTimeManual(member.character);
    const skillDamageMultiplier = skill.id.includes("time_stop") ? 1.04 : skill.id.includes("ora_ora") ? 1.12 : 1;
    const damage = Math.max(
      8,
      Math.round((10 + damageBase) * levelMultiplier * affinity * equipmentMultiplier * skillDamageMultiplier)
    );
    boss.hp = Math.max(0, boss.hp - damage);
    member.battleStats.damageDealt += damage;

    let healing = 0;
    if ((skill.id.includes("healing") || skill.id.includes("rosario")) && lowestAlly) {
      healing = Math.max(5, Math.round((member.character.stats.spirit + slot.level * 3) * affinity));
      lowestAlly.currentHp = Math.min(lowestAlly.maxHp, lowestAlly.currentHp + healing);
      member.battleStats.healingDone += healing;
    }
    let bossAttackModifier = skill.id.includes("time_stop")
      ? 1
      : skill.id.includes("opening_thread")
        ? 0.88
        : skill.id.includes("infinity") || skill.id.includes("parry")
          ? 0.92
          : undefined;
    slot.lastTriggeredSkillId = skill.id;
    slot.cooldownUntilTick = room.tick + (skill.cooldownTurns || 2);
    const logLines = buildSkillLogLines({
      actorName: member.displayName,
      characterName: definition.name,
      skill,
      targetName: boss.name,
      damage,
      healing,
      healingTargetName: lowestAlly?.displayName
    });
    let extraDamage = 0;
    if (skill.id.includes("time_stop")) {
      const followUpSkillNames = gameplaySpecialSkillCatalog()
        .filter((entry) => equippedSkillIds.has(entry.id) && entry.id !== skill.id)
        .map((entry) => entry.name);
      const window = resolveTimeStopWindow({
        actorName: member.displayName,
        targetName: boss.name,
        stats: member.character.stats,
        battleLevel: member.character.battleLevel,
        slotLevel: slot.level,
        manualActive: timeManualActive,
        followUpSkillNames
      });
      extraDamage = window.damage;
      bossAttackModifier = window.bossAttackModifier;
      boss.hp = Math.max(0, boss.hp - extraDamage);
      member.battleStats.damageDealt += extraDamage;
      member.currentEnergy = Math.min(member.maxEnergy, member.currentEnergy + window.recoveredEnergy);
      if (window.recoveredMp > 0) {
        member.currentMp = Math.min(member.maxMp, member.currentMp + window.recoveredMp);
      }
      logLines.push(...window.logs);
    }
    messages.push(...logLines);
    events.push({
      kind: "secondary_skill",
      actorUserId: member.userId,
      label: skill.name,
      message: logLines.join("\n"),
      impact: {
        damage: damage + extraDamage,
        ...(healing ? { healing } : {}),
        ...(bossAttackModifier ? { bossAttackModifier } : {})
      }
    });
  }

  return { message: messages.join(" "), events, logs: messages };
}

function comboBaseDamage(member: RoomMemberState) {
  const role = member.character.loadout.preferredRole;
  const roleBonus = role === "dps" ? 4 : role === "balanced" ? 2 : 0;
  return comboBaseDamageFor(
    member.character.className,
    member.character.stats,
    Math.max(1, member.character.battleLevel || 1),
    roleBonus
  );
}

function chooseRoleAction(member: RoomMemberState, room: RoomInternal): BattleActionResult {
  const role = member.character.loadout.preferredRole;
  const boss = room.boss!;
  const allies = livingMembers(room);
  const lowestAlly = [...allies].sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)[0];

  // 速度回魔、體力回精力：讓資源型屬性支撐連擊持久度
  member.currentMp = Math.min(member.maxMp, member.currentMp + Math.floor(member.character.stats.spirit / 6));
  member.currentEnergy = Math.min(
    member.maxEnergy,
    member.currentEnergy + Math.floor(member.character.stats.vitality / 8)
  );

  if ((role === "healer" || member.character.className === "priest") && lowestAlly && member.currentMp >= 10) {
    if (lowestAlly.currentHp / lowestAlly.maxHp < 0.72) {
      const heal = 14 + member.character.stats.spirit * 2;
      member.currentMp = Math.max(0, member.currentMp - 10);
      lowestAlly.currentHp = Math.min(lowestAlly.maxHp, lowestAlly.currentHp + heal);
      member.battleStats.healingDone += heal;
      return {
        message: `${member.displayName} 施放恢復術，替 ${lowestAlly.displayName} 回復了 ${heal} 點生命。`,
        events: applyAttackSpecials(member, room, Math.max(6, Math.round(heal / 2)))
      };
    }
  }

  if (role === "tank" && Math.random() < 0.35) {
    member.defending = true;
    return {
      message: `${member.displayName} 進入防禦姿態，準備承受下一次攻擊。`,
      events: []
    };
  }

  const usesMp = member.character.className === "mage";
  const combo = resolveComboAttack({
    actorUserId: member.userId,
    actorName: member.displayName,
    className: member.character.className,
    targetName: boss.name,
    stats: member.character.stats,
    battleLevel: Math.max(1, member.character.battleLevel || 1),
    baseDamage: comboBaseDamage(member),
    availableResource: usesMp ? member.currentMp : member.currentEnergy
  });

  if (usesMp) {
    member.currentMp = Math.max(0, member.currentMp - combo.resourceSpent);
  } else {
    member.currentEnergy = Math.max(0, member.currentEnergy - combo.resourceSpent);
  }
  boss.hp = Math.max(0, boss.hp - combo.totalDamage);
  member.battleStats.damageDealt += combo.totalDamage;

  return {
    message: combo.logs[0] || `${member.displayName} 發動攻擊，對 ${boss.name} 造成 ${combo.totalDamage} 點傷害。`,
    events: [...combo.events, ...applyAttackSpecials(member, room, combo.totalDamage)],
    logs: combo.logs
  };
}

function bossAttack(room: RoomInternal, attackModifier = 1) {
  const boss = room.boss!;
  const targets = livingMembers(room);
  if (targets.length === 0) {
    return { message: `${boss.name} 找不到還站著的對手。`, events: [] as BattleSpecialEvent[] };
  }

  const weightedTargets = targets.flatMap((member) => {
    const repeats =
      member.character.loadout.preferredRole === "tank"
        ? 3
        : member.character.loadout.preferredRole === "healer"
          ? 1
          : 2;
    return Array.from({ length: repeats }, () => member);
  });

  const target = randomFrom(weightedTargets);
  const rawDamage = Math.round((boss.attackPower + Math.floor(Math.random() * 8)) * attackModifier);
  const mitigated = mitigateIncomingDamage(rawDamage, target.character.stats);
  const dodge = rollDangerDodge({
    actorUserId: target.userId,
    actorName: target.displayName,
    stats: target.character.stats,
    hpRatio: target.currentHp / target.maxHp,
    incomingDamage: mitigated
  });
  const damage = Math.max(1, (target.defending ? Math.ceil(mitigated / 2) : mitigated) - dodge.damageReduction);
  target.currentHp = Math.max(0, target.currentHp - damage);
  target.battleStats.damageTaken += damage;
  target.defending = false;
  return {
    message: `${boss.name} 攻擊 ${target.displayName}，造成 ${damage} 點傷害。`,
    events: dodge.event ? [dodge.event] : []
  };
}

async function finalizeBattle(room: RoomInternal, winner: BattleWinner) {
  room.phase = "ended";
  const startedAt = room.startedAt ? new Date(room.startedAt).getTime() : Date.now();
  room.battleSummary = {
    winner,
    totalTicks: room.tick,
    durationMs: Date.now() - startedAt,
    endedAt: nowIso(),
    battleContext: room.battleConfig?.battleContext || "raid"
  };
  if (room.interval) {
    clearInterval(room.interval);
    room.interval = undefined;
  }

  const roomBossRules = gameplayRoomBossRules();
  const isRaidBattle = (room.battleConfig?.battleContext || "raid") === "raid";
  const rewardGold = isRaidBattle ? (winner === "players" ? roomBossRules.winGold : roomBossRules.lossGold) : 0;

  await Promise.all(
    room.members.map(async (member) => {
      member.character.hp = member.currentHp;
      member.character.mp = member.currentMp;
      member.character.energy = member.currentEnergy;
      const updated = await syncBattleResult(
        member.userId,
        member.currentHp,
        member.currentMp,
        member.currentEnergy,
        member.battleStats.damageTaken > 0
      );
      member.character = updated;
    })
  );

  const record: BattleRecordSummary = {
    id: randomId("battle"),
    roomId: room.roomId,
    bossName: room.boss?.name || "未知首領",
    winner,
    durationMs: room.battleSummary.durationMs,
    totalTicks: room.battleSummary.totalTicks,
    createdAt: room.battleSummary.endedAt,
    battleContext: room.battleSummary.battleContext,
    participants: room.members.map((member) => ({
      userId: member.userId,
      displayName: member.displayName,
      className: member.character.className,
      damageDealt: member.battleStats.damageDealt,
      healingDone: member.battleStats.healingDone,
      damageTaken: member.battleStats.damageTaken
    })),
    logs: [
      ...room.logs,
      ...(isRaidBattle
        ? [
            `隊伍 Boss 獎勵：每名成員金幣 ${rewardGold}，戰鬥經驗 ${winner === "players" ? roomBossRules.winBattleExp : roomBossRules.lossBattleExp}。`
          ]
        : [])
    ]
  };

  await recordBattle(record);
  return room.battleSummary;
}

export async function runBattleTick(roomId: string) {
  const room = ensureRoom(roomId);
  if (room.phase !== "battle" || !room.boss) {
    return null;
  }

  room.tick += 1;
  const recentLogs: string[] = [];
  const specialEvents: BattleSpecialEvent[] = [];

  for (const member of livingMembers(room)) {
    if (room.boss.hp <= 0) {
      break;
    }
    const action = chooseRoleAction(member, room);
    recentLogs.push(...(action.logs?.length ? action.logs : [action.message]));
    specialEvents.push(...action.events);
    recentLogs.push(
      ...action.events
        .filter((event) => event.kind !== "combo_chain" && event.kind !== "combo_finisher")
        .map((event) => event.message)
    );
    const secondaryAction = rollSecondaryCharacterSkills(member, room);
    specialEvents.push(...secondaryAction.events);
    recentLogs.push(...(secondaryAction.logs || secondaryAction.events.flatMap((event) => event.message.split("\n"))));
  }

  if (room.boss.hp > 0) {
    const bossCounter = rollBossCounterEvent({
      bossName: room.boss.name,
      tick: room.tick,
      livingCount: livingMembers(room).length,
      attackPower: room.boss.attackPower
    });
    if (bossCounter) {
      specialEvents.push(bossCounter);
      recentLogs.push(bossCounter.message);
      const pressureDamage = bossCounter.impact.damage || 0;
      if (pressureDamage > 0) {
        for (const member of livingMembers(room)) {
          const damage = Math.max(1, pressureDamage - Math.floor(member.character.stats.tenacity / 5));
          member.currentHp = Math.max(0, member.currentHp - damage);
          member.battleStats.damageTaken += damage;
        }
        recentLogs.push(`${room.boss.name} 的反制對全隊造成 ${pressureDamage} 點基礎壓力。`);
      }
    }
    const bossAttackModifier = specialEvents.reduce(
      (modifier, event) => modifier * (event.impact.bossAttackModifier || 1),
      1
    );
    const attack = bossAttack(room, bossAttackModifier);
    recentLogs.push(attack.message);
    specialEvents.push(...attack.events);
    recentLogs.push(...attack.events.map((event) => event.message));
  }

  room.logs = capLogs([...room.logs, ...recentLogs]);

  let summary: BattleSummary | null = null;
  if (room.boss.hp <= 0) {
    room.logs = capLogs([...room.logs, "首領倒下，玩家取得勝利。"]);
    summary = await finalizeBattle(room, "players");
  } else if (livingMembers(room).length === 0) {
    room.logs = capLogs([...room.logs, "隊伍全滅，戰鬥失敗。"]);
    summary = await finalizeBattle(room, "boss");
  }

  const event: BattleTickEvent = {
    roomId: room.roomId,
    tick: room.tick,
    boss: room.boss,
    members: room.members,
    recentLogs,
    specialEvents
  };

  return {
    room,
    event,
    summary
  };
}

export function attachBattleLoop(roomId: string, runner: () => Promise<void>, intervalMs: number) {
  const room = ensureRoom(roomId);
  room.interval = setInterval(() => {
    void runner();
  }, intervalMs);
}

export function publicRoomState(room: RoomInternal): RoomState {
  return {
    roomId: room.roomId,
    hostId: room.hostId,
    phase: room.phase,
    members: room.members,
    boss: room.boss,
    logs: room.logs,
    createdAt: room.createdAt,
    battleConfig: room.battleConfig,
    battleSummary: room.battleSummary
  };
}
