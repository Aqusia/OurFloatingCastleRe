import type {
  AuthUser,
  BattleRecordSummary,
  BattleSummary,
  BattleTickEvent,
  BattleWinner,
  BattleContext,
  BossState,
  CharacterProfile,
  LoadoutSummary,
  RoomMemberState,
  RoomState,
  RoomSummary
} from "../../shared/events";
import { recordBattle, syncBattleResult, updateCharacter } from "./persistence/localStore";
import {
  bossBaseAttack,
  bossBaseHp,
  capLogs,
  cloneCharacter,
  maxEnergyForCharacter,
  maxHpForCharacter,
  maxMpForCharacter,
  nowIso,
  randomFrom,
  randomId,
  randomRoomId,
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

function createBoss(memberCount: number, battleContext: BattleContext = "raid"): BossState {
  return {
    id: randomId("boss"),
    name: battleContext === "raid" ? "裂岩巨像" : battleContext === "castle" ? "守城統領" : "陣營領主",
    hp: bossBaseHp(memberCount, battleContext),
    maxHp: bossBaseHp(memberCount, battleContext),
    attackPower: bossBaseAttack(memberCount, battleContext)
  };
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
      tickIntervalMs: 2000,
      bossName: "裂岩巨像",
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
  room.boss = createBoss(room.members.length, room.battleConfig?.battleContext || "raid");
  if (room.battleConfig?.bossName) {
    room.boss.name = room.battleConfig.bossName;
  }
  room.logs = capLogs([...room.logs, `戰鬥開始，${room.boss.name} 現身了。`]);
  return room;
}

type BattleActionResult = {
  message: string;
};

function livingMembers(room: RoomInternal) {
  return room.members.filter((member) => member.currentHp > 0);
}

function chooseRoleAction(member: RoomMemberState, room: RoomInternal): BattleActionResult {
  const role = member.character.loadout.preferredRole;
  const boss = room.boss!;
  const allies = livingMembers(room);
  const lowestAlly = [...allies].sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)[0];

  if ((role === "healer" || member.character.className === "priest") && lowestAlly && member.currentMp >= 10) {
    if (lowestAlly.currentHp / lowestAlly.maxHp < 0.72) {
      const heal = 14 + member.character.stats.spirit * 2;
      member.currentMp = Math.max(0, member.currentMp - 10);
      lowestAlly.currentHp = Math.min(lowestAlly.maxHp, lowestAlly.currentHp + heal);
      member.battleStats.healingDone += heal;
      return {
        message: `${member.displayName} 施放恢復術，替 ${lowestAlly.displayName} 回復了 ${heal} 點生命。`
      };
    }
  }

  if (role === "tank" && Math.random() < 0.4) {
    member.defending = true;
    return {
      message: `${member.displayName} 進入防禦姿態，準備承受下一次攻擊。`
    };
  }

  if (member.character.className === "mage" && member.currentMp >= 8 && Math.random() < 0.55) {
    const damage = 16 + member.character.stats.intelligence * 2 + member.character.stats.technique;
    member.currentMp = Math.max(0, member.currentMp - 8);
    boss.hp = Math.max(0, boss.hp - damage);
    member.battleStats.damageDealt += damage;
    return {
      message: `${member.displayName} 釋放魔力彈，對 ${boss.name} 造成 ${damage} 點傷害。`
    };
  }

  if (member.character.className === "priest" && member.currentMp >= 6 && Math.random() < 0.35) {
    const damage = 10 + member.character.stats.spirit + member.character.stats.intelligence;
    member.currentMp = Math.max(0, member.currentMp - 6);
    boss.hp = Math.max(0, boss.hp - damage);
    member.battleStats.damageDealt += damage;
    return {
      message: `${member.displayName} 以聖光衝擊 ${boss.name}，造成 ${damage} 點傷害。`
    };
  }

  const damage =
    10 +
    member.character.stats.attack +
    Math.floor(member.character.level / 2) +
    (role === "dps" ? 6 : role === "balanced" ? 2 : 0);
  boss.hp = Math.max(0, boss.hp - damage);
  member.battleStats.damageDealt += damage;
  return {
    message: `${member.displayName} 發動攻擊，對 ${boss.name} 造成 ${damage} 點傷害。`
  };
}

function bossAttack(room: RoomInternal) {
  const boss = room.boss!;
  const targets = livingMembers(room);
  if (targets.length === 0) {
    return `${boss.name} 找不到還站著的對手。`;
  }

  const weightedTargets = targets.flatMap((member) => {
    const repeats =
      member.character.loadout.preferredRole === "tank" ? 3 : member.character.loadout.preferredRole === "healer" ? 1 : 2;
    return Array.from({ length: repeats }, () => member);
  });

  const target = randomFrom(weightedTargets);
  const rawDamage = boss.attackPower + Math.floor(Math.random() * 8);
  const mitigated = Math.max(1, rawDamage - Math.floor(target.character.stats.defense / 3));
  const damage = target.defending ? Math.ceil(mitigated / 2) : mitigated;
  target.currentHp = Math.max(0, target.currentHp - damage);
  target.battleStats.damageTaken += damage;
  target.defending = false;
  return `${boss.name} 攻擊 ${target.displayName}，造成 ${damage} 點傷害。`;
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
    logs: [...room.logs]
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

  for (const member of livingMembers(room)) {
    if (room.boss.hp <= 0) {
      break;
    }
    recentLogs.push(chooseRoleAction(member, room).message);
  }

  if (room.boss.hp > 0) {
    recentLogs.push(bossAttack(room));
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
    recentLogs
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
