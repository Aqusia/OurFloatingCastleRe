export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type ProfileRecord = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CharacterClassName = "warrior" | "assassin" | "mage" | "priest";

export type CharacterRecord = {
  id: string;
  profile_id: string;
  name: string;
  class_name: CharacterClassName;
  class_changed_on: string;
  level: number;
  experience: number;
  gold: number;
  materials: number;
  strength: number;
  intelligence: number;
  spirit: number;
  loadout: JsonValue;
  created_at: string;
  updated_at: string;
};

export type BattleRecordStatus = "created" | "active" | "ended";
export type BattleWinner = "players" | "boss";

export type BattleRecord = {
  id: string;
  room_id: string;
  created_by_profile_id: string | null;
  created_by_character_id: string | null;
  boss_name: string;
  boss_max_hp: number;
  boss_remaining_hp: number;
  status: BattleRecordStatus;
  winner: BattleWinner | null;
  player_count: number;
  room_snapshot: JsonValue;
  metadata: JsonValue;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ParticipantResult = "alive" | "downed" | "escaped";

export type BattleParticipantRecord = {
  id: string;
  battle_record_id: string;
  profile_id: string | null;
  character_id: string | null;
  socket_player_id: string | null;
  player_name: string;
  player_slot: number | null;
  is_host: boolean;
  joined_at: string;
  final_hp: number | null;
  max_hp: number;
  total_damage_done: number;
  total_healing_done: number;
  total_damage_taken: number;
  result: ParticipantResult | null;
  metadata: JsonValue;
  created_at: string;
  updated_at: string;
};

export type ActivityType =
  | "room_created"
  | "player_joined"
  | "player_left"
  | "battle_started"
  | "battle_tick"
  | "battle_ended"
  | "system";

export type ActivityLogRecord = {
  id: number;
  battle_record_id: string | null;
  participant_id: string | null;
  room_id: string;
  activity_type: ActivityType;
  actor_profile_id: string | null;
  actor_character_id: string | null;
  action_key: string | null;
  message: string;
  metadata: JsonValue;
  occurred_at: string;
};

export type UpsertProfileInput = Pick<ProfileRecord, "id" | "email" | "display_name" | "avatar_url" | "last_seen_at">;

export type CreateCharacterInput = Pick<
  CharacterRecord,
  | "profile_id"
  | "name"
  | "class_name"
  | "class_changed_on"
  | "level"
  | "experience"
  | "gold"
  | "materials"
  | "strength"
  | "intelligence"
  | "spirit"
  | "loadout"
>;

export type CreateBattleRecordInput = Pick<
  BattleRecord,
  | "room_id"
  | "created_by_profile_id"
  | "created_by_character_id"
  | "boss_name"
  | "boss_max_hp"
  | "boss_remaining_hp"
  | "status"
  | "winner"
  | "player_count"
  | "room_snapshot"
  | "metadata"
  | "started_at"
> & {
  ended_at?: string | null;
};

export type UpdateBattleRecordInput = Partial<
  Pick<
    BattleRecord,
    "boss_remaining_hp" | "status" | "winner" | "player_count" | "room_snapshot" | "metadata" | "ended_at"
  >
>;

export type CreateBattleParticipantInput = Pick<
  BattleParticipantRecord,
  | "battle_record_id"
  | "profile_id"
  | "character_id"
  | "socket_player_id"
  | "player_name"
  | "player_slot"
  | "is_host"
  | "joined_at"
  | "final_hp"
  | "max_hp"
  | "total_damage_done"
  | "total_healing_done"
  | "total_damage_taken"
  | "result"
  | "metadata"
>;

export type UpdateBattleParticipantInput = Partial<
  Pick<
    BattleParticipantRecord,
    "final_hp" | "total_damage_done" | "total_healing_done" | "total_damage_taken" | "result" | "metadata"
  >
>;

export type CreateActivityLogInput = Pick<
  ActivityLogRecord,
  | "battle_record_id"
  | "participant_id"
  | "room_id"
  | "activity_type"
  | "actor_profile_id"
  | "actor_character_id"
  | "action_key"
  | "message"
  | "metadata"
  | "occurred_at"
>;
