export type CharacterClass = "warrior" | "mage" | "priest";

export type UserRole = "player" | "admin";

export type CombatRole = "tank" | "dps" | "healer" | "balanced";

export type CharacterStatKey =
  | "attack"
  | "defense"
  | "luck"
  | "intelligence"
  | "vitality"
  | "spirit"
  | "technique"
  | "tenacity";

export type ActivityType = "training" | "mining" | "rest";

export type RoomPhase = "lobby" | "battle" | "ended";

export type BattleWinner = "players" | "boss";

export type BattleContext = "raid" | "castle" | "factionBoss";

export type ActionType =
  | "fishing"
  | "jump_rope"
  | "reading"
  | "push_ups"
  | "meditation"
  | "boxing"
  | "rest"
  | "mine_shallow"
  | "mine_deep"
  | "forge";

export type InventoryCategory = "consumable" | "equipment" | "sub_slot" | "loot" | "material" | "manual";

export type EquipmentSlotKey = "weapon" | "offhand" | "helmet" | "armor" | "kneepad" | "pet" | "avatar";

export type ItemRarity = "common" | "uncommon" | "rare" | "epic";

export type QualityTier = "rough" | "standard" | "fine" | "masterwork" | "epic" | "divine";

export type MaterialType =
  | "iron_ore"
  | "copper_ore"
  | "silver_ore"
  | "obsidian_ore"
  | "stardust"
  | "leather"
  | "cloth"
  | "bone";

export type ResourceGrant = {
  materialType: MaterialType;
  quantity: number;
};

export type CustomWeaponGrant = {
  name: string;
  equipmentSlot: EquipmentSlotKey;
  attackBonus?: number;
  defenseBonus?: number;
  luckBonus?: number;
  intelligenceBonus?: number;
  tenacityBonus?: number;
  durability?: number;
  craftedBy?: string | null;
  craftedAt?: string | null;
  rarity?: ItemRarity;
  qualityTier?: QualityTier | null;
  effectSummary?: string;
};

export type RewardItemGrant = {
  shopItemId?: string;
  recipeId?: string;
  customWeapon?: CustomWeaponGrant | null;
};

export type RewardTemplate = {
  gold?: number;
  materials?: ResourceGrant[];
  itemGrants?: RewardItemGrant[];
};

export type RewardScheduleConfig = {
  title: string;
  active: boolean;
  startAt: string | null;
  endAt: string | null;
  reward: RewardTemplate;
};

export type StatusEffectKind = "buff" | "debuff";

export type NotificationKind = "battle" | "system" | "sign_in" | "activity" | "social" | "faction" | "admin";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
};

export type CharacterStats = {
  attack: number;
  defense: number;
  luck: number;
  intelligence: number;
  vitality: number;
  spirit: number;
  technique: number;
  tenacity: number;
};

export type LoadoutSummary = {
  preferredRole: CombatRole;
  blessing: string;
  title: string;
  equipment: string[];
  skills: string[];
};

export type InventoryItem = {
  id: string;
  name: string;
  category: InventoryCategory;
  effectSummary: string;
  equipmentSlot?: EquipmentSlotKey | null;
  rarity?: ItemRarity;
  craftSource?: string | null;
  statBonus?: Partial<CharacterStats>;
  attackBonus?: number;
  defenseBonus?: number;
  luckBonus?: number;
  hpBonus?: number;
  mpBonus?: number;
  energyBonus?: number;
  durability?: number | null;
  maxDurability?: number | null;
  isBroken?: boolean;
  sortOrder?: number;
  stackable?: boolean;
  quantity?: number;
  materialType?: MaterialType | null;
  prefixName?: string | null;
  suffixName?: string | null;
  qualityTier?: QualityTier | null;
  tenacityBonus?: number;
  itemLevel?: number | null;
  sellPrice?: number | null;
  salvagePrice?: number | null;
  craftedBy?: string | null;
  craftedAt?: string | null;
};

export type EquipmentSlots = Record<EquipmentSlotKey, InventoryItem | null>;

export type StatusEffect = {
  id: string;
  name: string;
  description: string;
  kind: StatusEffectKind;
  source: "title" | "sub_role" | "battle" | "activity" | "faction";
};

export type SubRoleSlot = {
  slot: number;
  item: InventoryItem | null;
};

export type QueuedAction = {
  id: string;
  actionType: ActionType;
  label: string;
  durationMs: number;
  queuedAt: string;
  startAt: string;
  endsAt: string;
  status: "queued" | "active";
  onlineBonusEligible: boolean;
  metadata?: {
    durationHours?: number;
    durationLabel?: string;
    hiddenCost?: number;
    equipmentSlot?: EquipmentSlotKey;
    customName?: string;
    materialItemIds?: string[];
    materialNames?: string[];
    materialTypes?: MaterialType[];
    forgeDuration?: number;
  };
};

export type ActionQueueState = {
  items: QueuedAction[];
  updatedAt: string;
};

export type NotificationEntry = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export type FriendSummary = {
  userId: string;
  displayName: string;
  characterName: string;
  online: boolean;
};

export type SignInStatus = {
  dailyClaimedToday: boolean;
  dailyAvailable: boolean;
  dailyStartsAt: string | null;
  dailyEndsAt: string | null;
  dailyTitle: string;
  flashEventActive: boolean;
  flashEventEndsAt: string | null;
  flashEventStartsAt: string | null;
  flashClaimedToday: boolean;
  flashTitle: string;
};

export type CharacterProfile = {
  id: string;
  userId: string;
  factionId: string | null;
  name: string;
  className: CharacterClass;
  classChangedOn: string;
  level: number;
  experience: number;
  instinctLevel: number;
  instinctExp: number;
  battleLevel: number;
  battleExp: number;
  forgeLevel: number;
  forgeExp: number;
  gold: number;
  materials: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  energy: number;
  maxEnergy: number;
  stats: CharacterStats;
  equipmentSlots: EquipmentSlots;
  title: string;
  inventory: InventoryItem[];
  statusEffects: StatusEffect[];
  subRoleSlots: SubRoleSlot[];
  jobImage: string | null;
  loadout: LoadoutSummary;
  actionQueue: ActionQueueState;
  notifications: NotificationEntry[];
};

export type BattleStats = {
  damageDealt: number;
  healingDone: number;
  damageTaken: number;
};

export type RoomMemberState = {
  userId: string;
  socketId: string;
  displayName: string;
  isHost: boolean;
  character: CharacterProfile;
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  currentEnergy: number;
  maxEnergy: number;
  defending: boolean;
  battleStats: BattleStats;
};

export type BossState = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  attackPower: number;
};

export type BattleConfig = {
  tickIntervalMs: number;
  bossName: string;
  battleContext: BattleContext;
  castleId?: string | null;
  targetFactionId?: string | null;
};

export type BattleSummary = {
  winner: BattleWinner;
  totalTicks: number;
  durationMs: number;
  endedAt: string;
  battleContext: BattleContext;
};

export type RoomSummary = {
  roomId: string;
  hostId: string;
  phase: RoomPhase;
  memberCount: number;
  members: Pick<RoomMemberState, "userId" | "displayName" | "isHost">[];
  createdAt: string;
  battleContext: BattleContext;
};

export type RoomState = {
  roomId: string;
  hostId: string;
  phase: RoomPhase;
  members: RoomMemberState[];
  boss: BossState | null;
  logs: string[];
  createdAt: string;
  battleConfig: BattleConfig | null;
  battleSummary: BattleSummary | null;
};

export type BattleTickEvent = {
  roomId: string;
  tick: number;
  boss: BossState;
  members: RoomMemberState[];
  recentLogs: string[];
};

export type BattleRecordSummary = {
  id: string;
  roomId: string;
  bossName: string;
  winner: BattleWinner;
  durationMs: number;
  totalTicks: number;
  createdAt: string;
  battleContext: BattleContext;
  castleId?: string | null;
  targetFactionId?: string | null;
  participants: {
    userId: string;
    displayName: string;
    className: CharacterClass;
    damageDealt: number;
    healingDone: number;
    damageTaken: number;
  }[];
  logs: string[];
};

export type ActivityResult = {
  type: ActivityType;
  message: string;
  character: CharacterProfile;
  rewards: {
    gold?: number;
    materials?: number;
    experience?: number;
    instinctExp?: number;
    battleExp?: number;
    forgeExp?: number;
    statKeys?: CharacterStatKey[];
    hpRestored?: number;
    energyRestored?: number;
    mpRestored?: number;
    items?: InventoryItem[];
  };
};

export type ShopItem = {
  id: string;
  name: string;
  category: InventoryCategory;
  price: number;
  description: string;
  effectSummary: string;
  stock: "infinite";
  equipmentSlot?: EquipmentSlotKey | null;
  rarity?: ItemRarity;
  statBonus?: Partial<CharacterStats>;
  attackBonus?: number;
  defenseBonus?: number;
  luckBonus?: number;
  hpBonus?: number;
  mpBonus?: number;
  energyBonus?: number;
  durability?: number | null;
  maxDurability?: number | null;
};

export type ForgeOption = {
  id: string;
  name: string;
  equipmentSlot: EquipmentSlotKey;
  materialCost: number;
  effectSummary: string;
  statBonus?: Partial<CharacterStats>;
  attackBonus?: number;
  defenseBonus?: number;
  luckBonus?: number;
  durability: number;
  maxDurability: number;
  recommendedMaterials?: MaterialType[];
};

export type QueueMutationResult = {
  message: string;
  character: CharacterProfile;
  queue: ActionQueueState;
};

export type PurchaseResult = {
  message: string;
  character: CharacterProfile;
  purchasedItem: InventoryItem;
};

export type InventoryResult = {
  character: CharacterProfile;
  inventory: InventoryItem[];
  equipmentSlots: EquipmentSlots;
};

export type InventorySortPayload = {
  groupKey: string;
  orderedItemIds: string[];
};

export type FriendAddPayload = {
  characterName?: string;
  email?: string;
};

export type AuthPayload = {
  token: string;
  user: AuthUser;
  character: CharacterProfile;
};

export type RegisterPayload = {
  email: string;
  password: string;
  displayName: string;
  characterName: string;
  className: CharacterClass;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type QueueActionPayload = {
  actionType: ActionType;
  durationHours?: number;
};

export type QueueCancelPayload = {
  actionId: string;
};

export type PurchasePayload = {
  itemId: string;
};

export type EquipItemPayload = {
  itemId: string;
  slot?: EquipmentSlotKey;
};

export type UnequipItemPayload = {
  slot: EquipmentSlotKey;
};

export type CraftPayload = {
  equipmentSlot: EquipmentSlotKey;
  materialItemIds: string[];
  customName?: string;
  forgeDuration?: number;
};

export type RepairPayload = {
  itemId: string;
  source: "inventory" | "equipment";
  slot?: EquipmentSlotKey;
};

export type FactionSummary = {
  id: string;
  name: string;
  color: string;
  description: string;
  leaderUserId: string | null;
  leaderDisplayName: string | null;
  allyIds: string[];
  warTargetIds: string[];
  treasury: {
    gold: number;
    materials: number;
  };
  memberCount: number;
};

export type CastleState = {
  id: string;
  name: string;
  row: number;
  col: number;
  ownerFactionId: string;
  fortification: number;
  maxFortification: number;
  isCapital: boolean;
  bossName: string;
  bossHp: number;
  bossAttack: number;
  rewardGold: number;
  rewardMaterials: number;
};

export type DiplomacyRequestStatus = "pending" | "accepted" | "rejected" | "cancelled";

export type DiplomacyRequest = {
  id: string;
  fromFactionId: string;
  toFactionId: string;
  type: "cooperate";
  status: DiplomacyRequestStatus;
  createdAt: string;
  respondedAt: string | null;
};

export type MarketListing = {
  id: string;
  sellerUserId: string;
  sellerDisplayName: string;
  sellerCharacterName: string;
  factionId: string;
  quantity: number;
  price: number;
  item: InventoryItem;
  createdAt: string;
};

export type FactionState = {
  factions: FactionSummary[];
  selectedFaction: FactionSummary | null;
  castles: CastleState[];
  diplomacyRequests: DiplomacyRequest[];
  marketListings: MarketListing[];
  myFactionId: string | null;
  isLeader: boolean;
};

export type SelectFactionPayload = {
  factionId: string;
};

export type CooperatePayload = {
  targetFactionId: string;
};

export type CooperateRespondPayload = {
  requestId: string;
  accept: boolean;
};

export type DeclareWarPayload = {
  targetFactionId: string;
};

export type TreasuryGrantPayload = {
  targetCharacterName: string;
  gold?: number;
  materials?: number;
};

export type MarketListPayload = {
  itemId: string;
  quantity?: number;
  price: number;
};

export type MarketBuyPayload = {
  listingId: string;
};

export type AttackCastleResult = {
  message: string;
  castle: CastleState;
  factionState: FactionState;
  battleRecord: BattleRecordSummary;
};

export type ClassConfig = {
  className: CharacterClass;
  label: string;
  active: boolean;
};

export type AdminState = {
  classes: ClassConfig[];
  factions: FactionSummary[];
  castles: CastleState[];
  dailyRewardConfig: RewardScheduleConfig;
  flashEventConfig: RewardScheduleConfig;
  resourceTypes: Array<{
    type: MaterialType;
    name: string;
  }>;
};

export type AdminCompleteQueuePayload = {
  targetCharacterName: string;
};

export type AdminFillResourcesPayload = {
  targetCharacterName: string;
};

export type AdminGrantItemPayload = {
  targetCharacterName: string;
  recipeId?: string;
  shopItemId?: string;
  customWeapon?: CustomWeaponGrant | null;
};

export type AdminAdjustResourcesPayload = {
  targetCharacterName: string;
  gold?: number;
  materials?: number;
};

export type AdminGrantResourcesPayload = {
  targetCharacterName: string;
  gold?: number;
  resources?: ResourceGrant[];
};

export type AdminBattleTestPayload = {
  targetCharacterName: string;
  monsterName: string;
  monsterHp: number;
  monsterAttack: number;
};

export type AdminClassTogglePayload = {
  className: CharacterClass;
  active: boolean;
};

export type AdminAssignLeaderPayload = {
  factionId: string;
  targetCharacterName: string;
};

export type AdminSetCastleOwnerPayload = {
  castleId: string;
  ownerFactionId: string;
};

export type AdminAdjustTreasuryPayload = {
  factionId: string;
  gold?: number;
  materials?: number;
};

export type AdminRewardConfigPayload = {
  kind: "daily" | "flash";
  title: string;
  active: boolean;
  startAt: string | null;
  endAt: string | null;
  reward: RewardTemplate;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  active: boolean;
  createdAt: string;
};

export type AdminAnnouncementPayload = {
  title: string;
  body: string;
};

export type AdminAnnouncementTogglePayload = {
  announcementId: string;
  active: boolean;
};

export type ClientToServerEvents = {
  "auth:ready": (token: string) => void;
  "lobby:subscribe": () => void;
  "room:create": (roomId?: string) => void;
  "room:join": (roomId: string) => void;
  "room:leave": () => void;
  "room:updateLoadout": (loadout: Partial<LoadoutSummary>) => void;
  "room:start": (roomId: string) => void;
};

export type ServerToClientEvents = {
  "auth:ready": (payload: { user: AuthUser; character: CharacterProfile }) => void;
  "lobby:rooms": (rooms: RoomSummary[]) => void;
  "room:state": (state: RoomState | null) => void;
  "battle:tick": (event: BattleTickEvent) => void;
  "battle:ended": (payload: { roomId: string; summary: BattleSummary }) => void;
  "character:updated": (character: CharacterProfile) => void;
  "app:error": (message: string) => void;
};
