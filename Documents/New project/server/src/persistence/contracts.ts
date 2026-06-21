import type { BattleSummary, BattleTickEvent, RoomMemberState, RoomState } from "../../../shared/events";
import type {
  ActivityLogRecord,
  BattleParticipantRecord,
  BattleRecord,
  CharacterRecord,
  CreateActivityLogInput,
  CreateBattleParticipantInput,
  CreateBattleRecordInput,
  CreateCharacterInput,
  JsonValue,
  ProfileRecord,
  UpdateBattleParticipantInput,
  UpdateBattleRecordInput,
  UpsertProfileInput
} from "./types";

type HookMetadata = Record<string, JsonValue>;

export type RoomPersistenceContext = {
  roomId: string;
  hostUserId: string;
  occurredAt?: string;
  metadata?: HookMetadata;
};

export type BattlePersistenceContext = RoomPersistenceContext & {
  battleRecordId?: string | null;
  bossId?: string | null;
  bossName: string;
  tick?: number;
};

export type ResolvedBattleTick = {
  room: RoomState;
  event: BattleTickEvent;
  summary?: BattleSummary | null;
  occurredAt?: string;
  metadata?: HookMetadata;
};

export interface RaidPersistenceRepository {
  upsertProfile(input: UpsertProfileInput): Promise<ProfileRecord>;
  createCharacter(input: CreateCharacterInput): Promise<CharacterRecord>;
  createBattleRecord(input: CreateBattleRecordInput): Promise<BattleRecord>;
  updateBattleRecord(battleRecordId: string, input: UpdateBattleRecordInput): Promise<BattleRecord>;
  createBattleParticipant(input: CreateBattleParticipantInput): Promise<BattleParticipantRecord>;
  updateBattleParticipant(participantId: string, input: UpdateBattleParticipantInput): Promise<BattleParticipantRecord>;
  createActivityLog(input: CreateActivityLogInput): Promise<ActivityLogRecord>;
}

export interface RaidPersistenceHooks {
  onRoomCreated(room: RoomState, context: RoomPersistenceContext): Promise<void>;
  onPlayerJoined(room: RoomState, member: RoomMemberState, context: RoomPersistenceContext): Promise<void>;
  onPlayerLeft(room: RoomState, member: RoomMemberState, context: RoomPersistenceContext): Promise<void>;
  onBattleStarted(room: RoomState, context: BattlePersistenceContext): Promise<void>;
  onBattleTickResolved(payload: ResolvedBattleTick, context: BattlePersistenceContext): Promise<void>;
  onBattleEnded(room: RoomState, summary: BattleSummary, context: BattlePersistenceContext): Promise<void>;
}

export function createNoopRaidPersistenceHooks(): RaidPersistenceHooks {
  return {
    async onRoomCreated() {},
    async onPlayerJoined() {},
    async onPlayerLeft() {},
    async onBattleStarted() {},
    async onBattleTickResolved() {},
    async onBattleEnded() {}
  };
}
