import type { BattleSummary, BattleTickEvent, BattleWinner, RoomMemberState, RoomState } from "../../../shared/events";
import type {
  ActivityType,
  CreateActivityLogInput,
  CreateBattleParticipantInput,
  CreateBattleRecordInput,
  JsonValue,
  ParticipantResult
} from "./types";

type ActivityMetadata = Record<string, JsonValue>;

function toIsoString(dateLike?: string) {
  return dateLike ?? new Date().toISOString();
}

function cloneRoomSnapshot(room: RoomState): JsonValue {
  return {
    roomId: room.roomId,
    hostId: room.hostId,
    phase: room.phase,
    boss: room.boss
      ? {
          id: room.boss.id,
          name: room.boss.name,
          hp: room.boss.hp,
          maxHp: room.boss.maxHp,
          attackPower: room.boss.attackPower
        }
      : null,
    members: room.members.map((member) => ({
      userId: member.userId,
      socketId: member.socketId,
      displayName: member.displayName,
      isHost: member.isHost,
      currentHp: member.currentHp,
      maxHp: member.maxHp,
      defending: member.defending,
      battleStats: {
        damageDealt: member.battleStats.damageDealt,
        healingDone: member.battleStats.healingDone,
        damageTaken: member.battleStats.damageTaken
      },
      character: {
        id: member.character.id,
        name: member.character.name,
        className: member.character.className,
        level: member.character.level
      }
    })),
    logs: [...room.logs],
    createdAt: room.createdAt,
    battleConfig: room.battleConfig
      ? {
          tickIntervalMs: room.battleConfig.tickIntervalMs,
          bossName: room.battleConfig.bossName
        }
      : null,
    battleSummary: room.battleSummary
      ? {
          winner: room.battleSummary.winner,
          totalTicks: room.battleSummary.totalTicks,
          durationMs: room.battleSummary.durationMs,
          endedAt: room.battleSummary.endedAt
        }
      : null
  };
}

function resolveParticipantResult(member: RoomMemberState, roomPhase: RoomState["phase"]): ParticipantResult | null {
  if (roomPhase !== "ended") {
    return null;
  }

  return member.currentHp > 0 ? "alive" : "downed";
}

function buildParticipantMetadata(member: RoomMemberState): ActivityMetadata {
  return {
    memberState: {
      currentHp: member.currentHp,
      maxHp: member.maxHp,
      defending: member.defending
    },
    character: {
      className: member.character.className,
      level: member.character.level,
      experience: member.character.experience,
      gold: member.character.gold,
      materials: member.character.materials,
      stats: {
        attack: member.character.stats.attack,
        defense: member.character.stats.defense,
        luck: member.character.stats.luck,
        intelligence: member.character.stats.intelligence,
        vitality: member.character.stats.vitality,
        spirit: member.character.stats.spirit,
        technique: member.character.stats.technique
      },
      loadout: {
        preferredRole: member.character.loadout.preferredRole,
        blessing: member.character.loadout.blessing,
        title: member.character.loadout.title,
        equipment: [...member.character.loadout.equipment],
        skills: [...member.character.loadout.skills]
      }
    }
  };
}

export function mapRoomToBattleRecord(
  room: RoomState,
  hostUserId: string,
  options: {
    occurredAt?: string;
    metadata?: ActivityMetadata;
  } = {}
): CreateBattleRecordInput {
  const hostMember = room.members.find((member) => member.userId === hostUserId);

  return {
    room_id: room.roomId,
    created_by_profile_id: hostUserId,
    created_by_character_id: hostMember?.character.id ?? null,
    boss_name: room.boss?.name ?? room.battleConfig?.bossName ?? "Unknown Boss",
    boss_max_hp: room.boss?.maxHp ?? 1,
    boss_remaining_hp: room.boss?.hp ?? 0,
    status: room.phase === "lobby" ? "created" : room.phase === "battle" ? "active" : "ended",
    winner: room.battleSummary?.winner ?? null,
    player_count: room.members.length,
    room_snapshot: cloneRoomSnapshot(room),
    metadata: options.metadata ?? {},
    started_at: toIsoString(options.occurredAt)
  };
}

export function mapRoomToBattleParticipants(
  battleRecordId: string,
  room: RoomState,
  occurredAt?: string
): CreateBattleParticipantInput[] {
  return room.members.map((member, index) => ({
    battle_record_id: battleRecordId,
    profile_id: member.userId,
    character_id: member.character.id,
    socket_player_id: member.socketId,
    player_name: member.displayName,
    player_slot: index + 1,
    is_host: member.isHost,
    joined_at: toIsoString(occurredAt),
    final_hp: room.phase === "ended" ? member.currentHp : null,
    max_hp: member.maxHp,
    total_damage_done: member.battleStats.damageDealt,
    total_healing_done: member.battleStats.healingDone,
    total_damage_taken: member.battleStats.damageTaken,
    result: resolveParticipantResult(member, room.phase),
    metadata: buildParticipantMetadata(member)
  }));
}

export function mapBattleActivityLog(input: {
  roomId: string;
  battleRecordId?: string | null;
  participantId?: string | null;
  actorProfileId?: string | null;
  actorCharacterId?: string | null;
  activityType: ActivityType;
  actionKey?: string | null;
  message: string;
  occurredAt?: string;
  metadata?: ActivityMetadata;
}): CreateActivityLogInput {
  return {
    battle_record_id: input.battleRecordId ?? null,
    participant_id: input.participantId ?? null,
    room_id: input.roomId,
    activity_type: input.activityType,
    actor_profile_id: input.actorProfileId ?? null,
    actor_character_id: input.actorCharacterId ?? null,
    action_key: input.actionKey ?? null,
    message: input.message,
    metadata: input.metadata ?? {},
    occurred_at: toIsoString(input.occurredAt)
  };
}

export function inferBattleWinner(room: RoomState, summary?: BattleSummary | null): BattleWinner | null {
  if (summary) {
    return summary.winner;
  }

  if (!room.boss) {
    return null;
  }

  if (room.boss.hp <= 0) {
    return "players";
  }

  const hasLivingMembers = room.members.some((member) => member.currentHp > 0);
  return hasLivingMembers ? null : "boss";
}

export function summarizeTickMetadata(event: BattleTickEvent, summary?: BattleSummary | null): ActivityMetadata {
  return {
    tick: event.tick,
    roomId: event.roomId,
    recentLogs: [...event.recentLogs],
    boss: {
      id: event.boss.id,
      hp: event.boss.hp,
      maxHp: event.boss.maxHp,
      attackPower: event.boss.attackPower
    },
    members: event.members.map((member) => ({
      userId: member.userId,
      displayName: member.displayName,
      currentHp: member.currentHp,
      maxHp: member.maxHp,
      defending: member.defending,
      battleStats: {
        damageDealt: member.battleStats.damageDealt,
        healingDone: member.battleStats.healingDone,
        damageTaken: member.battleStats.damageTaken
      }
    })),
    summary: summary
      ? {
          winner: summary.winner,
          totalTicks: summary.totalTicks,
          durationMs: summary.durationMs,
          endedAt: summary.endedAt
        }
      : null
  };
}
