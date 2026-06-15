import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ActionQueueState,
  ActionType,
  ActivityResult,
  AchievementProgress,
  AdminAdjustResourcesPayload,
  AdminAdjustTreasuryPayload,
  AdminAnnouncementPayload,
  AdminAnnouncementTogglePayload,
  AdminConfigSection,
  AdminGameConfigResponse,
  AdminAssignLeaderPayload,
  AdminBattleTestPayload,
  AdminClassTogglePayload,
  AdminCompleteQueuePayload,
  AdminFillResourcesPayload,
  AdminGrantItemPayload,
  AdminGrantResourcesPayload,
  AdminRewardConfigPayload,
  AdminState,
  Announcement,
  AdventureBattlePayload,
  AdventureBattleResult,
  AttackCastleResult,
  BattleSpecialEvent,
  AuthUser,
  BattleRecordSummary,
  BuildFacilityPayload,
  CastleGarrison,
  CastleState,
  CharacterClass,
  CharacterProfile,
  CharacterStatKey,
  CharacterStats,
  ClassMasteryMap,
  ClassConfig,
  CooperatePayload,
  CooperateRespondPayload,
  CraftPayload,
  DeclareWarPayload,
  DiplomacyRequest,
  EquipItemPayload,
  EquipmentSlotKey,
  FactionState,
  FactionActionResult,
  FactionProject,
  FactionSummary,
  FactionTechKey,
  FactionTechUpgradePayload,
  FactionTowerBattlePayload,
  FactionTowerBattleResult,
  FactionTowerProgress,
  ForgeOption,
  ForgeRecipe,
  FriendSummary,
  GameConfig,
  InventoryItem,
  InventoryResult,
  InventorySortPayload,
  LearnedManual,
  MarketBuyPayload,
  MarketListPayload,
  MarketListing,
  MaterialType,
  NotificationEntry,
  PurchaseResult,
  QueueMutationResult,
  QueuedAction,
  RegisterPayload,
  RewardScheduleConfig,
  RewardTemplate,
  RepairPayload,
  RepairCastlePayload,
  SecondaryCharacterSlot,
  SelectFactionPayload,
  SiegeBattleState,
  SiegeParticipant,
  ShopItem,
  SignInStatus,
  SoloBattleDifficulty,
  SoloBattlePayload,
  SoloBattleResult,
  SpecialSkillDefinition,
  TravelPayload,
  UnequipItemPayload,
  UserRole,
  WorldBossChallengeResult,
  WorldBossState,
  WorldBossStateResult
} from "../../../shared/events";
import {
  comboBaseDamageFor,
  mitigateIncomingDamage,
  resolveComboAttack,
  rollAttackSpecialEvents,
  rollBossCounterEvent,
  rollDangerDodge
} from "../combatEngine";
import {
  actionDurationLabel,
  actionDurationMs,
  actionLabel,
  buildSkillLogLines,
  bossBaseAttack,
  bossBaseHp,
  clamp,
  classBaseStats,
  classDefaultLoadout,
  classMigrationBase,
  cloneCharacter,
  createForgedEquipment,
  createRecipeEquipment,
  defaultForgeRecipes,
  forgeRecipes,
  matchForgeRecipe,
  createMaterialItem,
  equipmentSlotLabel,
  forgeOptions,
  defaultGameConfig,
  defaultSoloDifficulties,
  materialCatalog,
  materialName,
  maxEnergyForCharacter,
  maxHpForCharacter,
  maxMpForCharacter,
  nextLevelRequirement,
  nowIso,
  randomFrom,
  randomId,
  seedCastles,
  gameplaySecondaryCharacterCatalog,
  gameplaySoloDifficulties,
  gameplaySpecialSkillCatalog,
  setRuntimeGameConfig,
  starterEquipmentSlots,
  starterSecondaryCharacters,
  starterStatusEffects,
  starterSubRoleSlots,
  starterTitle,
  staticShopItems,
  taipeiDayKey
} from "../utils";

type StoredUser = AuthUser & {
  password: string;
  createdAt: string;
  friendIds: string[];
  lastDailySignInOn: string | null;
  lastFlashSignInOn: string | null;
};

type SessionRecord = {
  token: string;
  userId: string;
  createdAt: string;
};

type StoredQueuedAction = QueuedAction & {
  hiddenCost?: number;
};

type StoredFaction = Omit<FactionSummary, "leaderDisplayName" | "memberCount">;

type StoreData = {
  users: StoredUser[];
  sessions: SessionRecord[];
  characters: CharacterProfile[];
  battleRecords: BattleRecordSummary[];
  activityLogs: Array<{
    id: string;
    userId: string;
    createdAt: string;
    activity: ActivityResult;
  }>;
  factions: StoredFaction[];
  castles: CastleState[];
  sieges: SiegeBattleState[];
  factionProjects: FactionProject[];
  diplomacyRequests: DiplomacyRequest[];
  marketListings: MarketListing[];
  announcements: Announcement[];
  classConfigs: ClassConfig[];
  gameConfig: GameConfig;
  worldBoss: WorldBossState;
  forcedFlashEventEndsAt: string | null;
  dailyRewardConfig: RewardScheduleConfig;
  flashEventConfig: RewardScheduleConfig;
};

const dataDir = path.resolve(process.env.GAME_DATA_DIR || path.join(process.cwd(), "server", "data"));
const dataFile = path.join(dataDir, "store.json");

const GAME_LIMITS = {
  goldBalance: 999999,
  grantGold: 999999,
  resourceQuantity: 9999,
  marketPrice: 999999,
  customStatBonus: 999,
  durability: 9999,
  monsterHp: 999999,
  monsterAttack: 9999
};

function defaultWorldBoss(): WorldBossState {
  return {
    activeBossId: randomId("world_boss"),
    bossName: "裂界魔龍",
    bossHp: 520,
    bossAttack: 34,
    rewardGold: 420,
    rewardMaterials: 8,
    winnerFactionId: null,
    rewardClaimed: false,
    attempts: [],
    startedAt: nowIso()
  };
}

const initialData: StoreData = {
  users: [],
  sessions: [],
  characters: [],
  battleRecords: [],
  activityLogs: [],
  factions: [],
  castles: [],
  sieges: [],
  factionProjects: [],
  diplomacyRequests: [],
  marketListings: [],
  announcements: [],
  classConfigs: [
    { className: "warrior", label: "戰士", active: true },
    { className: "assassin", label: "刺客", active: true },
    { className: "mage", label: "法師", active: true },
    { className: "priest", label: "補師", active: true }
  ],
  gameConfig: defaultGameConfig(),
  worldBoss: defaultWorldBoss(),
  forcedFlashEventEndsAt: null,
  dailyRewardConfig: {
    title: "每日補給",
    active: true,
    startAt: null,
    endAt: null,
    reward: {
      gold: 60,
      materials: [
        { materialType: "iron_ore", quantity: 2 },
        { materialType: "copper_ore", quantity: 1 },
        { materialType: "cloth", quantity: 1 }
      ]
    }
  },
  flashEventConfig: {
    title: "限時補給",
    active: false,
    startAt: null,
    endAt: null,
    reward: {
      gold: 80,
      materials: [
        { materialType: "iron_ore", quantity: 1 },
        { materialType: "copper_ore", quantity: 1 },
        { materialType: "silver_ore", quantity: 1 },
        { materialType: "obsidian_ore", quantity: 1 },
        { materialType: "cloth", quantity: 1 },
        { materialType: "leather", quantity: 1 }
      ]
    }
  }
};

let cachedData: StoreData | null = null;
let storageNeedsMigration = false;

function isCorruptedText(value: unknown) {
  return typeof value === "string" && /[�\uE000-\uF8FF\uFFFD]|嚗|撌|蝚|摰|蝪|閮|銵|雿|暺|憭|瘨||/.test(value);
}

function cleanText(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.trim() || isCorruptedText(value)) {
    if (value !== fallback) storageNeedsMigration = true;
    return fallback;
  }
  return value;
}

const classLabels: Record<CharacterClass, string> = {
  warrior: "戰士",
  assassin: "刺客",
  mage: "法師",
  priest: "補師"
};

const factionDefaults: Record<string, { name: string; description: string }> = {
  faction_ember: { name: "炎燼", description: "攻勢與鍛造導向。" },
  faction_tide: { name: "潮汐", description: "支援與資源調度導向。" },
  faction_gale: { name: "翠風", description: "速度與偵查導向。" },
  faction_stone: { name: "岩盾", description: "防守與城防工程導向。" },
  faction_lumen: { name: "曦光", description: "治療與外交協作導向。" }
};

function normalizeGameConfig(rawConfig: any): GameConfig {
  const fallback = defaultGameConfig();
  const normalizeSkills = (skills: any): SpecialSkillDefinition[] =>
    Array.isArray(skills)
      ? skills
          .map((skill) => ({
            ...skill,
            id: String(skill?.id || "").trim(),
            name: String(skill?.name || skill?.id || "").trim(),
            source: (["class", "secondary", "manual"].includes(skill?.source) ? skill.source : "secondary") as SpecialSkillDefinition["source"],
            detail: String(skill?.detail || ""),
            baseChance: skill?.baseChance == null ? undefined : clamp(Number(skill.baseChance), 0, 1),
            cooldownTurns: skill?.cooldownTurns == null ? undefined : clampedInt(skill.cooldownTurns, 0, 20, 2),
            unlockLevel: skill?.unlockLevel == null ? undefined : clampedInt(skill.unlockLevel, 1, 99, 1),
            hitCount: skill?.hitCount == null ? undefined : clampedInt(skill.hitCount, 1, 99, 1),
            hitLabel: skill?.hitLabel ? String(skill.hitLabel) : undefined,
            finisherText: skill?.finisherText ? String(skill.finisherText) : undefined,
            logStyle: skill?.logStyle === "multi_hit" ? "multi_hit" : "single"
          }))
          .filter((skill) => skill.id && skill.name)
      : fallback.specialSkills;
  const skills = normalizeSkills(rawConfig?.specialSkills);
  const skillIds = new Set(skills.map((skill) => skill.id));
  const secondaryCharacters = Array.isArray(rawConfig?.secondaryCharacters)
    ? rawConfig.secondaryCharacters
        .map((entry: any) => ({
          ...entry,
          id: String(entry?.id || "").trim(),
          name: String(entry?.name || entry?.id || "").trim(),
          origin: String(entry?.origin || ""),
          role: String(entry?.role || ""),
          weapon: String(entry?.weapon || ""),
          detail: String(entry?.detail || ""),
          statBonus: entry?.statBonus || {},
          unlockedSkillIds: Array.isArray(entry?.unlockedSkillIds) ? entry.unlockedSkillIds.filter((skillId: string) => skillIds.has(skillId)) : []
        }))
        .filter((entry: any) => entry.id && entry.name)
    : fallback.secondaryCharacters;
  const soloDefaults = defaultSoloDifficulties();
  const soloDifficulties = (Object.keys(soloDefaults) as Array<keyof GameConfig["soloDifficulties"]>).reduce<GameConfig["soloDifficulties"]>((next, key) => {
    const source = rawConfig?.soloDifficulties?.[key] || soloDefaults[key];
    next[key] = {
      label: String(source.label || soloDefaults[key].label),
      hp: clampedInt(source.hp, 1, GAME_LIMITS.monsterHp, soloDefaults[key].hp),
      attack: clampedInt(source.attack, 1, GAME_LIMITS.monsterAttack, soloDefaults[key].attack),
      gold: clampedInt(source.gold, 0, GAME_LIMITS.grantGold, soloDefaults[key].gold),
      exp: clampedInt(source.exp, 0, 999999, soloDefaults[key].exp),
      qty: clampedInt(source.qty, 0, GAME_LIMITS.resourceQuantity, soloDefaults[key].qty),
      risk: String(source.risk || soloDefaults[key].risk)
    };
    return next;
  }, structuredClone(soloDefaults));
  const siegeFallback = fallback.siegeRules;
  const rawSiege = rawConfig?.siegeRules || {};
  const statFallback = fallback.statRules;
  const rawStats = rawConfig?.statRules || {};
  const statRules = (Object.keys(statFallback) as CharacterStatKey[]).reduce<GameConfig["statRules"]>((next, key) => {
    const source = rawStats[key] || {};
    next[key] = {
      attackPower: Number.isFinite(Number(source.attackPower)) ? Number(source.attackPower) : statFallback[key].attackPower,
      defensePower: Number.isFinite(Number(source.defensePower)) ? Number(source.defensePower) : statFallback[key].defensePower,
      sustain: Number.isFinite(Number(source.sustain)) ? Number(source.sustain) : statFallback[key].sustain,
      siege: Number.isFinite(Number(source.siege)) ? Number(source.siege) : statFallback[key].siege,
      growth: Number.isFinite(Number(source.growth)) ? Number(source.growth) : statFallback[key].growth,
      summary: String(source.summary || statFallback[key].summary)
    };
    return next;
  }, structuredClone(statFallback));
  return {
    specialSkills: skills.length ? skills : fallback.specialSkills,
    secondaryCharacters: secondaryCharacters.length ? secondaryCharacters : fallback.secondaryCharacters,
    soloDifficulties,
    shopItems: Array.isArray(rawConfig?.shopItems) && rawConfig.shopItems.length ? rawConfig.shopItems.map(normalizeShopItemConfig) : fallback.shopItems,
    forgeOptions: Array.isArray(rawConfig?.forgeOptions) && rawConfig.forgeOptions.length ? rawConfig.forgeOptions.map(normalizeForgeOptionConfig) : fallback.forgeOptions,
    forgeRecipes:
      Array.isArray(rawConfig?.forgeRecipes) && rawConfig.forgeRecipes.length
        ? rawConfig.forgeRecipes
            .map((recipe: any) => ({
              ...recipe,
              id: String(recipe?.id || "").trim(),
              name: String(recipe?.name || "").trim(),
              ingredients: recipe?.ingredients && typeof recipe.ingredients === "object" ? recipe.ingredients : {},
              statBonus: recipe?.statBonus && typeof recipe.statBonus === "object" ? recipe.statBonus : {},
              durability: clampedInt(recipe?.durability, 10, 999, 120)
            }))
            .filter((recipe: any) => recipe.id && recipe.name && Object.keys(recipe.ingredients).length)
        : defaultForgeRecipes(),
    siegeRules: {
      durationMinutes: clampedInt(rawSiege.durationMinutes, 1, 240, siegeFallback.durationMinutes),
      tickIntervalSeconds: clampedInt(rawSiege.tickIntervalSeconds, 10, 600, siegeFallback.tickIntervalSeconds),
      baseEnergyCost: clampedInt(rawSiege.baseEnergyCost, 1, 100, siegeFallback.baseEnergyCost),
      minorFortificationDamage: clampedInt(rawSiege.minorFortificationDamage, 0, 100, siegeFallback.minorFortificationDamage),
      breakthroughMultiplier: Number.isFinite(Number(rawSiege.breakthroughMultiplier)) ? clamp(Number(rawSiege.breakthroughMultiplier), 0.01, 2) : siegeFallback.breakthroughMultiplier,
      defenderTerrainMultiplier: Number.isFinite(Number(rawSiege.defenderTerrainMultiplier)) ? clamp(Number(rawSiege.defenderTerrainMultiplier), 0.5, 5) : siegeFallback.defenderTerrainMultiplier,
      autoDefenseScaling: Number.isFinite(Number(rawSiege.autoDefenseScaling)) ? clamp(Number(rawSiege.autoDefenseScaling), 0, 5) : siegeFallback.autoDefenseScaling,
      minAttackerEnergy: clampedInt(rawSiege.minAttackerEnergy, 0, 100, siegeFallback.minAttackerEnergy)
    },
    statRules
  };
}

function normalizeWorldBoss(rawBoss: any): WorldBossState {
  const fallback = defaultWorldBoss();
  const attempts = Array.isArray(rawBoss?.attempts)
    ? rawBoss.attempts
        .map((attempt: any) => ({
          id: String(attempt?.id || randomId("world_attempt")),
          factionId: String(attempt?.factionId || ""),
          factionName: String(attempt?.factionName || ""),
          characterName: String(attempt?.characterName || ""),
          won: Boolean(attempt?.won),
          damageDealt: clampedInt(attempt?.damageDealt, 0, GAME_LIMITS.monsterHp, 0),
          createdAt: String(attempt?.createdAt || nowIso()),
          battleRecordId: String(attempt?.battleRecordId || "")
        }))
        .filter((attempt: WorldBossState["attempts"][number]) => attempt.factionId && attempt.characterName)
    : [];
  return {
    activeBossId: String(rawBoss?.activeBossId || fallback.activeBossId),
    bossName: String(rawBoss?.bossName || fallback.bossName),
    bossHp: clampedInt(rawBoss?.bossHp, 1, GAME_LIMITS.monsterHp, fallback.bossHp),
    bossAttack: clampedInt(rawBoss?.bossAttack, 1, GAME_LIMITS.monsterAttack, fallback.bossAttack),
    rewardGold: clampedInt(rawBoss?.rewardGold, 0, GAME_LIMITS.grantGold, fallback.rewardGold),
    rewardMaterials: clampedInt(rawBoss?.rewardMaterials, 0, GAME_LIMITS.resourceQuantity, fallback.rewardMaterials),
    winnerFactionId: rawBoss?.winnerFactionId ? String(rawBoss.winnerFactionId) : null,
    rewardClaimed: Boolean(rawBoss?.rewardClaimed),
    attempts,
    startedAt: String(rawBoss?.startedAt || fallback.startedAt)
  };
}

function createEmptyQueue(): ActionQueueState {
  return {
    items: [],
    updatedAt: nowIso()
  };
}

function starterAchievements(character: Pick<CharacterProfile, "instinctLevel">): AchievementProgress[] {
  const level = Number(character.instinctLevel || 1);
  return [
    {
      id: "level_5",
      title: "達到 5 級",
      description: "角色等級達到 5 級。",
      progress: Math.min(level, 5),
      target: 5,
      completed: level >= 5,
      completedAt: level >= 5 ? nowIso() : null,
      rewardSummary: "待領取"
    }
  ];
}

function normalizeSecondaryCharacters(rawSlots: any): SecondaryCharacterSlot[] {
  const slots = Array.isArray(rawSlots) ? rawSlots : [];
  return starterSecondaryCharacters().map((starter) => {
    const raw = slots.find((entry: any) => Number(entry?.slot) === starter.slot) || slots[starter.slot - 1] || {};
    const level = clampedInt(raw.level, 1, 99, 1);
    const definition = typeof raw.characterId === "string" ? gameplaySecondaryCharacterCatalog().find((entry) => entry.id === raw.characterId) : null;
    const unlockedSkillIds = definition
      ? definition.unlockedSkillIds.filter((skillId) => {
          const skill = gameplaySpecialSkillCatalog().find((entry) => entry.id === skillId);
          return (skill?.unlockLevel || 1) <= level;
        })
      : [];
    return {
      slot: starter.slot,
      characterId: typeof raw.characterId === "string" ? raw.characterId : null,
      level,
      exp: clampedInt(raw.exp, 0, 999999, 0),
      unlockedSkillIds,
      lastTriggeredSkillId: typeof raw.lastTriggeredSkillId === "string" ? raw.lastTriggeredSkillId : null,
      cooldownUntilTick: raw.cooldownUntilTick == null ? null : clampedInt(raw.cooldownUntilTick, 0, 9999, 0)
    };
  });
}

function masteryRequirement(level: number) {
  return Math.max(40, level * 70);
}

function secondaryRequirement(level: number) {
  return Math.max(35, level * 55);
}

function normalizeClassMastery(rawMastery: any, currentClass: CharacterClass): ClassMasteryMap {
  const classes: CharacterClass[] = ["warrior", "assassin", "mage", "priest"];
  return classes.reduce((map, className) => {
    const raw = rawMastery?.[className] || {};
    map[className] = {
      className,
      level: clampedInt(raw.level, 1, 99, className === currentClass ? 1 : 1),
      exp: clampedInt(raw.exp, 0, 999999, 0),
      unlocked: raw.unlocked ?? className === currentClass
    };
    return map;
  }, {} as ClassMasteryMap);
}

function normalizeLearnedManuals(rawManuals: any): LearnedManual[] {
  if (!Array.isArray(rawManuals)) return [];
  return rawManuals
    .filter((entry) => entry?.manualId && entry?.name)
    .map((entry) => ({
      manualId: String(entry.manualId),
      name: String(entry.name),
      effectSummary: String(entry.effectSummary || ""),
      statBonus: entry.statBonus || {},
      unlockedSkillId: entry.unlockedSkillId || null,
      learnedAt: entry.learnedAt || nowIso()
    }));
}

function normalizeEquippedManuals(rawManualIds: any, learnedManuals: LearnedManual[]) {
  const learnedIds = new Set(learnedManuals.map((manual) => manual.manualId));
  return (Array.isArray(rawManualIds) ? rawManualIds : [])
    .filter((manualId) => typeof manualId === "string" && learnedIds.has(manualId))
    .slice(0, 3);
}

function normalizeAchievements(rawAchievements: any, character: Pick<CharacterProfile, "instinctLevel">): AchievementProgress[] {
  const defaults = starterAchievements(character);
  if (!Array.isArray(rawAchievements)) return defaults;
  return defaults.map((entry) => {
    const existing = rawAchievements.find((achievement: any) => achievement?.id === entry.id);
    return existing
      ? {
          ...entry,
          progress: Math.max(entry.progress, Number(existing.progress || 0)),
          completed: Boolean(existing.completed) || entry.completed,
          completedAt: existing.completedAt || entry.completedAt
        }
      : entry;
  });
}

function statBonusFromSkill(skill: SpecialSkillDefinition | null | undefined) {
  return skill?.statBonus || {};
}

function applyStatBonus(character: CharacterProfile, bonus: Partial<CharacterStats>, direction: 1 | -1) {
  for (const key of Object.keys(bonus) as CharacterStatKey[]) {
    updateCharacterStat(character, key, (bonus[key] || 0) * direction);
  }
}

function secondaryLevelMultiplier(level: number) {
  return 1 + Math.max(0, level - 1) * 0.12;
}

function secondaryAffinity(definition: { classAffinity?: Partial<Record<CharacterClass, number>> }, className: CharacterClass) {
  return definition.classAffinity?.[className] ?? 1;
}

function equippedPreferenceMultiplier(character: CharacterProfile, preferredSlots?: EquipmentSlotKey[]) {
  if (!preferredSlots?.length) return 1;
  return preferredSlots.some((slot) => Boolean(character.equipmentSlots[slot])) ? 1.12 : 1;
}

function effectiveSecondaryStatBonus(character: CharacterProfile, slot: SecondaryCharacterSlot, definition: { statBonus: Partial<CharacterStats>; classAffinity?: Partial<Record<CharacterClass, number>> }) {
  const multiplier = secondaryLevelMultiplier(slot.level) * secondaryAffinity(definition, character.className);
  const result: Partial<CharacterStats> = {};
  for (const key of Object.keys(definition.statBonus) as CharacterStatKey[]) {
    result[key] = Math.max(1, Math.round((definition.statBonus[key] || 0) * multiplier));
  }
  return result;
}

function updateSecondaryUnlockedSkills(slot: SecondaryCharacterSlot, characterId: string | null) {
  const definition = characterId ? gameplaySecondaryCharacterCatalog().find((entry) => entry.id === characterId) : null;
  slot.unlockedSkillIds = definition
    ? definition.unlockedSkillIds.filter((skillId) => {
        const skill = gameplaySpecialSkillCatalog().find((entry) => entry.id === skillId);
        return (skill?.unlockLevel || 1) <= slot.level;
      })
    : [];
}

function awardSecondaryExperience(character: CharacterProfile, gained: number) {
  for (const slot of character.secondaryCharacters) {
    if (!slot.characterId) continue;
    slot.exp += gained;
    while (slot.exp >= secondaryRequirement(slot.level)) {
      slot.exp -= secondaryRequirement(slot.level);
      const definition = gameplaySecondaryCharacterCatalog().find((entry) => entry.id === slot.characterId);
      if (definition) applyStatBonus(character, effectiveSecondaryStatBonus(character, slot, definition), -1);
      slot.level += 1;
      updateSecondaryUnlockedSkills(slot, slot.characterId);
      if (definition) applyStatBonus(character, effectiveSecondaryStatBonus(character, slot, definition), 1);
    }
  }
  refreshCharacterLoadout(character);
  recalcResources(character);
}

function awardClassMasteryExperience(character: CharacterProfile, gained: number) {
  const mastery = character.classMastery[character.className];
  mastery.exp += gained;
  while (mastery.exp >= masteryRequirement(mastery.level)) {
    mastery.exp -= masteryRequirement(mastery.level);
    mastery.level += 1;
  }
}

const playerActionTypes = new Set<ActionType>([
  "fishing",
  "jump_rope",
  "reading",
  "push_ups",
  "meditation",
  "boxing",
  "rest",
  "mine_shallow",
  "mine_deep",
  "forge"
]);

function isPlayerActionType(value: unknown): value is ActionType {
  return typeof value === "string" && playerActionTypes.has(value as ActionType);
}

function isLegacyFactionQueueNotification(entry: NotificationEntry) {
  const body = entry.body || "";
  const isQueueText = body.includes("queue") || body.includes("已加入行動佇列");
  const isFactionQueueText = body.includes("faction") || body.includes("同盟") || body.includes("城池");
  return isQueueText && isFactionQueueText;
}

function defaultFactionTech(): Record<FactionTechKey, number> {
  return {
    castle: 0,
    defense: 0,
    attack: 0,
    support: 0,
    offense_speed: 0
  };
}

function defaultFactionTower(factionName = "公會"): FactionTowerProgress {
  return {
    currentLayer: 1,
    highestClearedLayer: 0,
    bossName: `${factionName} 第 1 層守將`,
    bossHp: 260,
    rewardSummary: "公庫金幣、個人素材與戰鬥經驗",
    progress: 0
  };
}

function normalizeFactionTower(rawTower: any, factionName: string): FactionTowerProgress {
  const fallback = defaultFactionTower(factionName);
  const currentLayer = clampedInt(rawTower?.currentLayer, 1, 999, fallback.currentLayer);
  return {
    currentLayer,
    highestClearedLayer: clampedInt(rawTower?.highestClearedLayer, 0, 999, Math.max(0, currentLayer - 1)),
    bossName: String(rawTower?.bossName || `${factionName} 第 ${currentLayer} 層守將`),
    bossHp: clampedInt(rawTower?.bossHp, 80, GAME_LIMITS.monsterHp, 220 + currentLayer * 55),
    rewardSummary: String(rawTower?.rewardSummary || fallback.rewardSummary),
    progress: clampedInt(rawTower?.progress, 0, 100, 0)
  };
}

function normalizeFactionTech(rawTech: any): Record<FactionTechKey, number> {
  const fallback = defaultFactionTech();
  return {
    castle: clampedInt(rawTech?.castle, 0, 99, fallback.castle),
    defense: clampedInt(rawTech?.defense, 0, 99, fallback.defense),
    attack: clampedInt(rawTech?.attack, 0, 99, fallback.attack),
    support: clampedInt(rawTech?.support, 0, 99, fallback.support),
    offense_speed: clampedInt(rawTech?.offense_speed, 0, 99, fallback.offense_speed)
  };
}

function factionTechLevel(faction: StoredFaction, techKey: FactionTechKey) {
  return normalizeFactionTech(faction.tech)[techKey];
}

function normalizeCharacterName(value: string) {
  return value.trim().toLowerCase();
}

function clampedInt(value: unknown, min: number, max: number, fallback = min) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return clamp(Math.floor(numberValue), min, max);
}

function flashWindowInfo(forcedEndsAt: string | null, now = new Date()) {
  if (forcedEndsAt && new Date(forcedEndsAt).getTime() > now.getTime()) {
    return { active: true, endsAt: forcedEndsAt, dayKey: taipeiDayKey(now) };
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  const hour = Number(value("hour"));
  const minute = Number(value("minute"));
  const dayKey = `${value("year")}-${value("month")}-${value("day")}`;
  const active = hour === 13 && minute === 30;
  return {
    active,
    endsAt: active ? `${dayKey}T13:31:00+08:00` : null,
    dayKey
  };
}

function normalizeRewardTemplate(rawReward: any, fallback: RewardTemplate): RewardTemplate {
  return {
    gold: clampedInt(rawReward?.gold ?? fallback.gold ?? 0, 0, GAME_LIMITS.grantGold, 0),
    materials: Array.isArray(rawReward?.materials)
      ? rawReward.materials
          .map((entry: any) => ({
            materialType: entry.materialType as MaterialType,
            quantity: clampedInt(entry.quantity, 0, GAME_LIMITS.resourceQuantity, 0)
          }))
          .filter((entry: any) => entry.materialType && entry.quantity > 0)
      : fallback.materials || [],
    itemGrants: Array.isArray(rawReward?.itemGrants)
      ? rawReward.itemGrants.map((entry: any) => ({
          shopItemId: entry.shopItemId || undefined,
          recipeId: entry.recipeId || undefined,
          customWeapon: entry.customWeapon || null
        }))
      : fallback.itemGrants || []
  };
}

function normalizeRewardSchedule(rawConfig: any, fallback: RewardScheduleConfig): RewardScheduleConfig {
  return {
    title: cleanText(rawConfig?.title, fallback.title),
    active: rawConfig?.active ?? fallback.active,
    startAt: rawConfig?.startAt || fallback.startAt || null,
    endAt: rawConfig?.endAt || fallback.endAt || null,
    reward: normalizeRewardTemplate(rawConfig?.reward, fallback.reward)
  };
}

function isRewardScheduleActive(config: RewardScheduleConfig, now = new Date()) {
  if (!config.active) return false;
  const time = now.getTime();
  const startOk = !config.startAt || new Date(config.startAt).getTime() <= time;
  const endOk = !config.endAt || new Date(config.endAt).getTime() >= time;
  return startOk && endOk;
}

function mapLegacyStats(rawStats: any, className: CharacterClass) {
  const strength = Number(rawStats?.strength ?? 0);
  const intelligence = Number(rawStats?.intelligence ?? 0);
  const spirit = Number(rawStats?.spirit ?? 0);
  const base = classMigrationBase(className);
  const starter = classBaseStats(className);
  return {
    attack: Math.max(1, strength || starter.attack),
    defense: Math.max(1, base.defense + Math.floor(strength * 0.25)),
    luck: Math.max(1, base.luck + Math.floor(spirit * 0.2)),
    intelligence: Math.max(1, intelligence || starter.intelligence),
    vitality: Math.max(1, base.vitality + Math.floor(strength * 0.35)),
    spirit: Math.max(1, spirit || starter.spirit),
    technique: Math.max(1, base.technique + Math.floor(intelligence * 0.2)),
    tenacity: Math.max(1, base.tenacity + Math.floor(strength * 0.15))
  };
}

function inferEquipmentSlot(item: any): EquipmentSlotKey | null {
  if (item?.category !== "equipment") return null;
  const text = `${item.name || ""} ${item.effectSummary || ""}`.toLowerCase();
  if (text.includes("helmet") || text.includes("頭盔")) return "helmet";
  if (text.includes("armor") || text.includes("護甲") || text.includes("盔甲")) return "armor";
  if (text.includes("kneepad") || text.includes("護膝")) return "kneepad";
  if (text.includes("offhand") || text.includes("副手")) return "offhand";
  return "weapon";
}

function normalizeShopItemConfig(item: any): ShopItem {
  return {
    id: String(item?.id || randomId("shop")),
    name: String(item?.name || "未命名商品"),
    category: item?.category || "other",
    price: clampedInt(item?.price, 0, GAME_LIMITS.marketPrice, 0),
    description: String(item?.description || ""),
    effectSummary: String(item?.effectSummary || ""),
    stock: "infinite",
    equipmentSlot: item?.equipmentSlot || null,
    rarity: item?.rarity || "common",
    statBonus: item?.statBonus || {},
    attackBonus: clampedInt(item?.attackBonus, 0, GAME_LIMITS.customStatBonus, 0),
    defenseBonus: clampedInt(item?.defenseBonus, 0, GAME_LIMITS.customStatBonus, 0),
    luckBonus: clampedInt(item?.luckBonus, 0, GAME_LIMITS.customStatBonus, 0),
    hpBonus: clampedInt(item?.hpBonus, 0, GAME_LIMITS.customStatBonus, 0),
    mpBonus: clampedInt(item?.mpBonus, 0, GAME_LIMITS.customStatBonus, 0),
    energyBonus: clampedInt(item?.energyBonus, 0, GAME_LIMITS.customStatBonus, 0),
    durability: item?.durability == null ? null : clampedInt(item.durability, 0, GAME_LIMITS.durability, 0),
    maxDurability: item?.maxDurability == null ? null : clampedInt(item.maxDurability, 0, GAME_LIMITS.durability, 0)
  };
}

function normalizeForgeOptionConfig(option: any): ForgeOption {
  return {
    id: String(option?.id || randomId("forge")),
    name: String(option?.name || "未命名配方"),
    equipmentSlot: option?.equipmentSlot || "weapon",
    materialCost: clampedInt(option?.materialCost, 0, GAME_LIMITS.resourceQuantity, 0),
    effectSummary: String(option?.effectSummary || ""),
    statBonus: option?.statBonus || {},
    attackBonus: clampedInt(option?.attackBonus, 0, GAME_LIMITS.customStatBonus, 0),
    defenseBonus: clampedInt(option?.defenseBonus, 0, GAME_LIMITS.customStatBonus, 0),
    luckBonus: clampedInt(option?.luckBonus, 0, GAME_LIMITS.customStatBonus, 0),
    durability: clampedInt(option?.durability, 1, GAME_LIMITS.durability, 100),
    maxDurability: clampedInt(option?.maxDurability, 1, GAME_LIMITS.durability, 100),
    recommendedMaterials: Array.isArray(option?.recommendedMaterials) ? option.recommendedMaterials : []
  };
}

function normalizeItem(rawItem: any): InventoryItem {
  if (!rawItem) {
    return {
      id: randomId("item"),
      name: "未知物品",
      category: "loot",
      effectSummary: "舊資料缺少物品資訊。",
      rarity: "common",
      craftSource: null,
      isBroken: false,
      stackable: false,
      quantity: 1,
      sortOrder: 0,
      materialType: null,
      prefixName: null,
      suffixName: null,
      qualityTier: null,
      tenacityBonus: 0,
      itemLevel: 1,
      sellPrice: 0,
      salvagePrice: 0,
      craftedBy: null,
      craftedAt: null
    };
  }

  const legacyStatBonus = rawItem.statBonus || {};
  const mappedStatBonus =
    legacyStatBonus.attack != null ||
    legacyStatBonus.defense != null ||
    legacyStatBonus.luck != null ||
    legacyStatBonus.vitality != null ||
    legacyStatBonus.technique != null ||
    legacyStatBonus.tenacity != null
      ? legacyStatBonus
      : {
          ...(legacyStatBonus.strength ? { attack: legacyStatBonus.strength } : {}),
          ...(legacyStatBonus.intelligence ? { intelligence: legacyStatBonus.intelligence } : {}),
          ...(legacyStatBonus.spirit ? { spirit: legacyStatBonus.spirit } : {})
        };

  const maxDurability = rawItem.maxDurability ?? rawItem.durability ?? null;
  const durability = rawItem.durability ?? maxDurability;
  const isBroken = rawItem.isBroken ?? (typeof durability === "number" && durability <= 0);

  return {
    id: rawItem.id || randomId("item"),
    name: cleanText(rawItem.name, "未知物品"),
    category: rawItem.category || "loot",
    effectSummary: cleanText(rawItem.effectSummary, "無特殊效果"),
    equipmentSlot: rawItem.equipmentSlot || inferEquipmentSlot(rawItem),
    rarity: rawItem.rarity || "common",
    craftSource: rawItem.craftSource || null,
    statBonus: mappedStatBonus,
    attackBonus: rawItem.attackBonus ?? mappedStatBonus.attack ?? 0,
    defenseBonus: rawItem.defenseBonus ?? mappedStatBonus.defense ?? 0,
    luckBonus: rawItem.luckBonus ?? mappedStatBonus.luck ?? 0,
    hpBonus: rawItem.hpBonus ?? 0,
    mpBonus: rawItem.mpBonus ?? 0,
    energyBonus: rawItem.energyBonus ?? rawItem.spiritBonus ?? 0,
    durability,
    maxDurability,
    isBroken,
    sortOrder: Number(rawItem.sortOrder ?? 0),
    stackable: Boolean(rawItem.stackable),
    quantity: Math.max(1, Number(rawItem.quantity ?? 1)),
    materialType: rawItem.materialType || null,
    prefixName: rawItem.prefixName || null,
    suffixName: rawItem.suffixName || null,
    qualityTier: rawItem.qualityTier || null,
    tenacityBonus: rawItem.tenacityBonus ?? mappedStatBonus.tenacity ?? 0,
    itemLevel: rawItem.itemLevel ?? 1,
    sellPrice: rawItem.sellPrice ?? 0,
    salvagePrice: rawItem.salvagePrice ?? 0,
    craftedBy: rawItem.craftedBy || null,
    craftedAt: rawItem.craftedAt || null
  };
}

function sortInventory(character: CharacterProfile) {
  character.inventory = character.inventory
    .map((item, index) => ({
      ...item,
      sortOrder: item.sortOrder ?? index
    }))
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
}

function mergeInventoryStack(character: CharacterProfile, item: InventoryItem) {
  if (item.stackable && item.materialType) {
    const existing = character.inventory.find(
      (entry) => entry.stackable && entry.category === item.category && entry.materialType === item.materialType
    );
    if (existing) {
      existing.quantity = (existing.quantity || 0) + (item.quantity || 1);
      sortInventory(character);
      return existing;
    }
  }

  item.sortOrder = character.inventory.length;
  item.quantity = item.quantity || 1;
  character.inventory.push(item);
  sortInventory(character);
  return item;
}

function removeInventoryQuantity(character: CharacterProfile, itemId: string, quantity = 1) {
  const index = character.inventory.findIndex((item) => item.id === itemId);
  if (index === -1) {
    return null;
  }

  const item = character.inventory[index];
  if (!item.stackable || (item.quantity || 1) <= quantity) {
    character.inventory.splice(index, 1);
    sortInventory(character);
    return { ...item, quantity };
  }

  item.quantity = (item.quantity || 1) - quantity;
  sortInventory(character);
  return { ...item, quantity };
}

function materialItems(character: CharacterProfile) {
  return character.inventory.filter((item) => item.category === "material" && item.materialType && (item.quantity || 0) > 0);
}

function materialCountForType(character: CharacterProfile, type: MaterialType) {
  return materialItems(character)
    .filter((item) => item.materialType === type)
    .reduce((sum, item) => sum + (item.quantity || 0), 0);
}

function addMaterialRewards(character: CharacterProfile, materialTypes: MaterialType[]) {
  const added: InventoryItem[] = [];
  for (const type of materialTypes) {
    const item = createMaterialItem(type, 1);
    mergeInventoryStack(character, item);
    added.push(item);
  }
  return added;
}

function addMaterialResourceRewards(character: CharacterProfile, resources: Array<{ materialType: MaterialType; quantity: number }>) {
  const added: InventoryItem[] = [];
  for (const resource of resources) {
    const quantity = clampedInt(resource.quantity, 0, GAME_LIMITS.resourceQuantity, 0);
    for (let count = 0; count < quantity; count += 1) {
      const item = createMaterialItem(resource.materialType, 1);
      mergeInventoryStack(character, item);
      added.push(item);
    }
  }
  return added;
}

function buildAdminCustomWeapon(payload: NonNullable<AdminGrantItemPayload["customWeapon"]>): InventoryItem {
  const durability = clampedInt(payload.durability || 100, 1, GAME_LIMITS.durability, 100);
  const attackBonus = clampedInt(payload.attackBonus, 0, GAME_LIMITS.customStatBonus, 0);
  const defenseBonus = clampedInt(payload.defenseBonus, 0, GAME_LIMITS.customStatBonus, 0);
  const luckBonus = clampedInt(payload.luckBonus, 0, GAME_LIMITS.customStatBonus, 0);
  const intelligenceBonus = clampedInt(payload.intelligenceBonus, 0, GAME_LIMITS.customStatBonus, 0);
  const tenacityBonus = clampedInt(payload.tenacityBonus, 0, GAME_LIMITS.customStatBonus, 0);
  return normalizeItem({
    id: randomId("item"),
    name: payload.name.trim(),
    category: "equipment",
    equipmentSlot: payload.equipmentSlot,
    rarity: payload.rarity || "rare",
    qualityTier: payload.qualityTier || "fine",
    craftSource: "admin_custom",
    effectSummary: payload.effectSummary || "管理員自訂裝備",
    attackBonus,
    defenseBonus,
    luckBonus,
    tenacityBonus,
    durability,
    maxDurability: durability,
    statBonus: {
      ...(attackBonus ? { attack: attackBonus } : {}),
      ...(defenseBonus ? { defense: defenseBonus } : {}),
      ...(luckBonus ? { luck: luckBonus } : {}),
      ...(intelligenceBonus ? { intelligence: intelligenceBonus } : {}),
      ...(tenacityBonus ? { tenacity: tenacityBonus } : {})
    },
    itemLevel: 1 + attackBonus + defenseBonus + intelligenceBonus,
    sellPrice: attackBonus * 30 + defenseBonus * 24 + intelligenceBonus * 20,
    salvagePrice: attackBonus * 10 + defenseBonus * 8 + intelligenceBonus * 6,
    craftedBy: payload.craftedBy || "Admin",
    craftedAt: payload.craftedAt || nowIso()
  });
}

function buildGrantedItem(grant: { recipeId?: string; shopItemId?: string; customWeapon?: AdminGrantItemPayload["customWeapon"] | null }) {
  if (grant.customWeapon) {
    return buildAdminCustomWeapon(grant.customWeapon);
  }
  if (grant.recipeId) {
    const option = forgeOptions().find((entry) => entry.id === grant.recipeId);
    if (!option) throw new Error("找不到鍛造配方。");
    return normalizeItem({ ...option, id: randomId("item"), category: "equipment" });
  }
  if (grant.shopItemId) {
    const shopItem = staticShopItems().find((entry) => entry.id === grant.shopItemId);
    if (!shopItem) throw new Error("找不到商店物品。");
    return normalizeItem({ ...shopItem, id: randomId("item"), qualityTier: "standard" });
  }
  throw new Error("請選擇要發放的物品。");
}

function summarizeRewardTemplate(reward: RewardTemplate) {
  const parts: string[] = [];
  if (reward.gold) parts.push(`金幣 ${reward.gold}`);
  for (const resource of reward.materials || []) {
    parts.push(`${materialName(resource.materialType)} x${resource.quantity}`);
  }
  for (const itemGrant of reward.itemGrants || []) {
    if (itemGrant.customWeapon?.name) parts.push(itemGrant.customWeapon.name);
    if (itemGrant.shopItemId) parts.push(itemGrant.shopItemId);
    if (itemGrant.recipeId) parts.push(itemGrant.recipeId);
  }
  return parts.join(", ") || "獎勵";
}

function grantRewardTemplate(character: CharacterProfile, reward: RewardTemplate, notificationTitle: string) {
  const grantedItems: InventoryItem[] = [];
  const gold = clampedInt(reward.gold, 0, GAME_LIMITS.grantGold, 0);
  character.gold = clamp(character.gold + gold, 0, GAME_LIMITS.goldBalance);
  addMaterialResourceRewards(character, reward.materials || []);
  for (const itemGrant of reward.itemGrants || []) {
    const item = buildGrantedItem(itemGrant);
    mergeInventoryStack(character, item);
    grantedItems.push(item);
  }
  appendNotification(character, "sign_in", notificationTitle, `獲得 ${summarizeRewardTemplate(reward)}。`);
  return grantedItems;
}

function appendRewardAnnouncement(data: StoreData, title: string, reward: RewardTemplate) {
  data.announcements.unshift({
    id: randomId("announcement"),
    title,
    body: `補給發放：${summarizeRewardTemplate(reward)}。`,
    active: true,
    createdAt: nowIso()
  });
  data.announcements = data.announcements.slice(0, 80);
}

function spendRepairMaterials(character: CharacterProfile, amount: number) {
  const types: MaterialType[] = ["iron_ore", "copper_ore", "silver_ore", "obsidian_ore", "stardust"];
  let remaining = amount;
  for (const type of types) {
    while (remaining > 0 && materialCountForType(character, type) > 0) {
      const stack = character.inventory.find((item) => item.materialType === type && (item.quantity || 0) > 0);
      if (!stack) break;
      removeInventoryQuantity(character, stack.id, 1);
      remaining -= 1;
    }
  }
  if (remaining > 0) {
    throw new Error("修復材料不足。");
  }
}

function recalcResources(character: CharacterProfile) {
  const equipped = [
    ...Object.values(character.equipmentSlots).filter((item): item is InventoryItem => Boolean(item)),
    ...character.subRoleSlots.map((slot) => slot.item).filter((item): item is InventoryItem => Boolean(item))
  ].filter((item) => !item.isBroken);

  const hpBonus = equipped.reduce((sum, item) => sum + (item.hpBonus || 0), 0);
  const mpBonus = equipped.reduce((sum, item) => sum + (item.mpBonus || 0), 0);
  const energyBonus = equipped.reduce((sum, item) => sum + (item.energyBonus || 0), 0);

  character.maxHp = maxHpForCharacter(character) + hpBonus;
  character.maxMp = maxMpForCharacter(character) + mpBonus;
  character.maxEnergy = maxEnergyForCharacter(character) + energyBonus;
  character.hp = clamp(character.hp, 0, character.maxHp);
  character.mp = clamp(character.mp, 0, character.maxMp);
  character.energy = clamp(character.energy, 0, character.maxEnergy);
}

function applyItemBonus(character: CharacterProfile, item: InventoryItem) {
  if (item.isBroken) return;
  const statBonus = item.statBonus || {};
  for (const key of Object.keys(statBonus) as CharacterStatKey[]) {
    updateCharacterStat(character, key, statBonus[key] || 0);
  }
  if (!item.statBonus) {
    if (item.attackBonus) updateCharacterStat(character, "attack", item.attackBonus);
    if (item.defenseBonus) updateCharacterStat(character, "defense", item.defenseBonus);
    if (item.luckBonus) updateCharacterStat(character, "luck", item.luckBonus);
    if (item.tenacityBonus) updateCharacterStat(character, "tenacity", item.tenacityBonus);
  }
  recalcResources(character);
}

function removeItemBonus(character: CharacterProfile, item: InventoryItem) {
  if (item.isBroken) return;
  const statBonus = item.statBonus || {};
  for (const key of Object.keys(statBonus) as CharacterStatKey[]) {
    updateCharacterStat(character, key, -(statBonus[key] || 0));
  }
  if (!item.statBonus) {
    if (item.attackBonus) updateCharacterStat(character, "attack", -item.attackBonus);
    if (item.defenseBonus) updateCharacterStat(character, "defense", -item.defenseBonus);
    if (item.luckBonus) updateCharacterStat(character, "luck", -item.luckBonus);
    if (item.tenacityBonus) updateCharacterStat(character, "tenacity", -item.tenacityBonus);
  }
  recalcResources(character);
}

function damageItem(character: CharacterProfile, item: InventoryItem | null, amount: number) {
  if (!item || item.maxDurability == null || item.durability == null) return false;
  const reduced = Math.max(1, amount - Math.floor(character.stats.tenacity / 10));
  item.durability = clamp(item.durability - reduced, 0, item.maxDurability);
  item.isBroken = item.durability <= 0;
  return item.isBroken;
}

function normalizeCharacter(rawCharacter: any): CharacterProfile {
  const className = (rawCharacter.className || "warrior") as CharacterClass;
  const stats =
    rawCharacter.stats?.attack != null
      ? {
          attack: Number(rawCharacter.stats.attack || 0),
          defense: Number(rawCharacter.stats.defense || 0),
          luck: Number(rawCharacter.stats.luck || 0),
          intelligence: Number(rawCharacter.stats.intelligence || 0),
          vitality: Number(rawCharacter.stats.vitality || 0),
          spirit: Number(rawCharacter.stats.spirit || 0),
          technique: Number(rawCharacter.stats.technique || 0),
          tenacity: Number(rawCharacter.stats.tenacity || 0)
        }
      : mapLegacyStats(rawCharacter.stats, className);

  const instinctLevel = Number(rawCharacter.instinctLevel || rawCharacter.level || 1);
  const normalizedManuals = normalizeLearnedManuals(rawCharacter.learnedManuals);
  const equipmentSlots = starterEquipmentSlots();
  for (const slot of Object.keys(equipmentSlots) as EquipmentSlotKey[]) {
    equipmentSlots[slot] = rawCharacter.equipmentSlots?.[slot] ? normalizeItem(rawCharacter.equipmentSlots[slot]) : null;
  }

  const character: CharacterProfile = {
    id: rawCharacter.id || randomId("char"),
    userId: rawCharacter.userId,
    factionId: rawCharacter.factionId || null,
    currentCastleId: rawCharacter.currentCastleId || null,
    movement: rawCharacter.movement || null,
    garrisonAssignment: rawCharacter.garrisonAssignment?.castleId
      ? {
          castleId: String(rawCharacter.garrisonAssignment.castleId),
          startedAt: String(rawCharacter.garrisonAssignment.startedAt || nowIso())
        }
      : null,
    name: cleanText(rawCharacter.name, "未命名角色"),
    className,
    classChangedOn: rawCharacter.classChangedOn || taipeiDayKey(),
    level: instinctLevel,
    experience: Number(rawCharacter.instinctExp ?? rawCharacter.experience ?? 0),
    instinctLevel,
    instinctExp: Number(rawCharacter.instinctExp ?? rawCharacter.experience ?? 0),
    battleLevel: Number(rawCharacter.battleLevel || 1),
    battleExp: Number(rawCharacter.battleExp || 0),
    forgeLevel: Number(rawCharacter.forgeLevel || 1),
    forgeExp: Number(rawCharacter.forgeExp || 0),
    gold: Number(rawCharacter.gold || 0),
    materials: Number(rawCharacter.materials || 0),
    hp: Number(rawCharacter.hp ?? rawCharacter.maxHp ?? 1),
    maxHp: 1,
    mp: Number(rawCharacter.mp ?? rawCharacter.maxMp ?? 1),
    maxMp: 1,
    energy: Number(rawCharacter.energy ?? rawCharacter.spirit ?? rawCharacter.maxEnergy ?? rawCharacter.maxSpirit ?? 1),
    maxEnergy: 1,
    stats,
    equipmentSlots,
    title: cleanText(rawCharacter.title, starterTitle(className)),
    inventory: Array.isArray(rawCharacter.inventory) ? rawCharacter.inventory.map(normalizeItem) : [],
    statusEffects:
      Array.isArray(rawCharacter.statusEffects) && rawCharacter.statusEffects.length > 0
        ? rawCharacter.statusEffects.map((effect: any) => ({
            ...effect,
            name: cleanText(effect?.name, "狀態效果"),
            description: cleanText(effect?.description, "舊狀態描述已損壞。")
          }))
        : starterStatusEffects(),
    subRoleSlots:
      Array.isArray(rawCharacter.subRoleSlots) && rawCharacter.subRoleSlots.length === 3
        ? rawCharacter.subRoleSlots.map((slot: any) => ({ slot: slot.slot, item: slot.item ? normalizeItem(slot.item) : null }))
        : starterSubRoleSlots(),
    secondaryCharacters: normalizeSecondaryCharacters(rawCharacter.secondaryCharacters),
    classMastery: normalizeClassMastery(rawCharacter.classMastery, className),
    specialSkillSlot: typeof rawCharacter.specialSkillSlot === "string" ? rawCharacter.specialSkillSlot : null,
    learnedManuals: normalizedManuals,
    equippedManuals: normalizeEquippedManuals(rawCharacter.equippedManuals, normalizedManuals),
    achievements: normalizeAchievements(rawCharacter.achievements, { instinctLevel }),
    jobImage: rawCharacter.jobImage ?? null,
    loadout: rawCharacter.loadout || classDefaultLoadout(className),
    actionQueue: rawCharacter.actionQueue || createEmptyQueue(),
    notifications: Array.isArray(rawCharacter.notifications)
      ? rawCharacter.notifications.map((notification: any) => ({
          ...notification,
          title: cleanText(notification?.title, "系統通知"),
          body: cleanText(notification?.body, "舊通知內容已損壞，新通知會正常顯示。")
        }))
      : []
  };

  const rawQueueItems = Array.isArray(character.actionQueue.items) ? character.actionQueue.items : [];
  character.actionQueue.items = rawQueueItems
    .filter((item: any) => isPlayerActionType(item.actionType))
    .map((item: any) => ({
      ...item,
      label: item.label || actionLabel(item.actionType),
      durationMs: item.durationMs || actionDurationMs(item.actionType, item.metadata?.durationHours),
      status: item.status || "queued",
      onlineBonusEligible: item.onlineBonusEligible ?? true,
      hiddenCost: item.hiddenCost ?? item.metadata?.hiddenCost
    }))
    .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime());
  if (character.actionQueue.items.length !== rawQueueItems.length) {
    character.actionQueue.updatedAt = nowIso();
    storageNeedsMigration = true;
  }
  if (character.specialSkillSlot && !unlockedSpecialSkills(character).some((skill) => skill.id === character.specialSkillSlot)) {
    character.specialSkillSlot = null;
    storageNeedsMigration = true;
  }
  const rawNotificationCount = character.notifications.length;
  character.notifications = character.notifications.filter((entry) => !isLegacyFactionQueueNotification(entry));
  if (character.notifications.length !== rawNotificationCount) {
    storageNeedsMigration = true;
  }

  if (character.materials > 0 && !materialItems(character).length) {
    addMaterialRewards(character, Array.from({ length: character.materials }, () => "iron_ore"));
  }

  sortInventory(character);
  recalcResources(character);
  return character;
}

function normalizeCastle(rawCastle: any): CastleState {
  const layer = Number(rawCastle.col ?? rawCastle.layer ?? 0);
  const specialtyByLayer: CastleState["specialty"][] = ["capital", "agriculture", "boss", "mining", "trade"];
  const layerNames = ["首都", "外城一：農礦帶", "外城二：討伐帶", "外城三：礦脈帶", "外城四：商路前線"];
  const purposeByLayer: CastleState["mapNodePurpose"][] = ["capital", "gathering", "guild_boss", "mining", "trade"];
  const benefitByLayer = [
    "公會管理、科技、倉庫與城防",
    "農業採集區：採集與精力恢復較快",
    "Boss 討伐區：公會 Boss、爬層與討伐營",
    "礦脈區：材料、鍛造素材與深層礦",
    "商路前線：玩家市場、交易與攻城前哨"
  ];
  const defaultRewardSummary = layer === 0 ? "大量公庫金幣與稀有戰利品機率" : "公庫金幣與一般戰利品";
  const rewardSummary = cleanText(rawCastle.rewardSummary, defaultRewardSummary);
  if (rewardSummary !== rawCastle.rewardSummary) {
    storageNeedsMigration = true;
  }
  return {
    ...rawCastle,
    layer,
    layerName: rawCastle.layerName || layerNames[layer] || `外城 ${layer}`,
    specialty: rawCastle.specialty || specialtyByLayer[layer] || "trade",
    distanceFromCapital: Number(rawCastle.distanceFromCapital ?? layer),
    buildSlots: Number(rawCastle.buildSlots ?? (layer === 0 ? 4 : layer <= 2 ? 3 : 2)),
    facilities: Array.isArray(rawCastle.facilities) ? rawCastle.facilities : layer === 0 ? ["政務廳", "倉庫"] : [],
    fortification: clampedInt(rawCastle.fortification, 0, GAME_LIMITS.monsterHp, layer === 0 ? 150 : 100),
    maxFortification: clampedInt(rawCastle.maxFortification, 1, GAME_LIMITS.monsterHp, layer === 0 ? 150 : 100),
    terrainAdvantage: clampedInt(rawCastle.terrainAdvantage, 0, 9999, layer === 0 ? 28 : 12 + layer * 3),
    autoDefensePower: clampedInt(rawCastle.autoDefensePower, 0, 99999, layer === 0 ? 95 : 45 + layer * 12),
    garrisonSlots: clampedInt(rawCastle.garrisonSlots, 0, 99, layer === 0 ? 8 : 3 + Math.max(0, 4 - layer)),
    siegeResistance: clampedInt(rawCastle.siegeResistance, 0, 9999, layer === 0 ? 24 : 10 + layer * 2),
    bossSkills: Array.isArray(rawCastle.bossSkills) ? rawCastle.bossSkills : layer === 0 ? ["統領號令", "壁壘反擊", "士氣重整"] : ["重擊", "防禦姿態"],
    rewardSummary,
    mapNodePurpose: rawCastle.mapNodePurpose || purposeByLayer[layer] || "trade",
    wallRepairAt: rawCastle.wallRepairAt || null,
    layerBenefit: rawCastle.layerBenefit || benefitByLayer[layer] || "前線據點"
  };
}

function toPublicQueue(queue: ActionQueueState): ActionQueueState {
  return {
    updatedAt: queue.updatedAt,
    items: queue.items.map((item: StoredQueuedAction) => ({
      id: item.id,
      actionType: item.actionType,
      label: item.label,
      durationMs: item.durationMs,
      queuedAt: item.queuedAt,
      startAt: item.startAt,
      endsAt: item.endsAt,
      status: item.status,
      onlineBonusEligible: item.onlineBonusEligible,
      metadata: item.metadata
    }))
  };
}

function toPublicCharacter(character: CharacterProfile): CharacterProfile {
  const cloned = cloneCharacter(character);
  cloned.actionQueue = toPublicQueue(character.actionQueue);
  return cloned;
}

function seedFactionStore(): StoredFaction[] {
  return [
    { id: "faction_ember", name: "炎燼", color: "#e85d4f", description: "攻勢與鍛造導向。", leaderUserId: null, allyIds: [], warTargetIds: [], treasury: { gold: 0, materials: 0 }, tech: defaultFactionTech(), tower: defaultFactionTower("炎燼"), memberCount: 0, leaderDisplayName: null },
    { id: "faction_tide", name: "潮汐", color: "#4f9fe8", description: "支援與資源調度導向。", leaderUserId: null, allyIds: [], warTargetIds: [], treasury: { gold: 0, materials: 0 }, tech: defaultFactionTech(), tower: defaultFactionTower("潮汐"), memberCount: 0, leaderDisplayName: null },
    { id: "faction_gale", name: "翠風", color: "#62c67f", description: "速度與偵查導向。", leaderUserId: null, allyIds: [], warTargetIds: [], treasury: { gold: 0, materials: 0 }, tech: defaultFactionTech(), tower: defaultFactionTower("翠風"), memberCount: 0, leaderDisplayName: null },
    { id: "faction_stone", name: "岩盾", color: "#b58952", description: "防守與城防工程導向。", leaderUserId: null, allyIds: [], warTargetIds: [], treasury: { gold: 0, materials: 0 }, tech: defaultFactionTech(), tower: defaultFactionTower("岩盾"), memberCount: 0, leaderDisplayName: null },
    { id: "faction_lumen", name: "曦光", color: "#d7bb4f", description: "治療與外交協作導向。", leaderUserId: null, allyIds: [], warTargetIds: [], treasury: { gold: 0, materials: 0 }, tech: defaultFactionTech(), tower: defaultFactionTower("曦光"), memberCount: 0, leaderDisplayName: null }
  ].map(({ memberCount: _memberCount, leaderDisplayName: _leaderDisplayName, ...rest }) => rest);
}

function normalizeSiege(raw: any): SiegeBattleState {
  return {
    id: String(raw?.id || randomId("siege")),
    castleId: String(raw?.castleId || ""),
    attackerFactionId: String(raw?.attackerFactionId || ""),
    defenderFactionId: String(raw?.defenderFactionId || ""),
    status: raw?.status === "resolved" ? "resolved" : "active",
    startedAt: String(raw?.startedAt || nowIso()),
    endsAt: String(raw?.endsAt || nowIso()),
    lastResolvedTick: clampedInt(raw?.lastResolvedTick, 0, 999999, 0),
    participants: Array.isArray(raw?.participants)
      ? raw.participants.map((participant: any) => ({
          userId: String(participant?.userId || ""),
          characterId: String(participant?.characterId || ""),
          characterName: String(participant?.characterName || ""),
          factionId: String(participant?.factionId || ""),
          side: participant?.side === "defense" ? "defense" : "attack",
          joinedAt: String(participant?.joinedAt || nowIso()),
          status: participant?.status === "retreated" || participant?.status === "downed" ? participant.status : "active",
          damageDealt: clampedInt(participant?.damageDealt, 0, GAME_LIMITS.monsterHp, 0),
          damageTaken: clampedInt(participant?.damageTaken, 0, GAME_LIMITS.monsterHp, 0),
          energySpent: clampedInt(participant?.energySpent, 0, GAME_LIMITS.resourceQuantity, 0)
        })).filter((participant: SiegeParticipant) => participant.userId && participant.characterId)
      : [],
    logs: Array.isArray(raw?.logs)
      ? raw.logs.map((log: any) => ({
          tick: clampedInt(log?.tick, 0, 999999, 0),
          createdAt: String(log?.createdAt || nowIso()),
          message: String(log?.message || ""),
          attackerPower: clampedInt(log?.attackerPower, 0, GAME_LIMITS.monsterHp, 0),
          defenderPower: clampedInt(log?.defenderPower, 0, GAME_LIMITS.monsterHp, 0),
          autoDefensePower: clampedInt(log?.autoDefensePower, 0, GAME_LIMITS.monsterHp, 0),
          fortificationDamage: clampedInt(log?.fortificationDamage, 0, GAME_LIMITS.monsterHp, 0),
          attackerEnergySpent: clampedInt(log?.attackerEnergySpent, 0, GAME_LIMITS.resourceQuantity, 0),
          retreatedUserIds: Array.isArray(log?.retreatedUserIds) ? log.retreatedUserIds.map(String) : []
        }))
      : [],
    fortificationStart: clampedInt(raw?.fortificationStart, 0, GAME_LIMITS.monsterHp, 0),
    fortificationCurrent: clampedInt(raw?.fortificationCurrent, 0, GAME_LIMITS.monsterHp, 0),
    winnerFactionId: raw?.winnerFactionId ? String(raw.winnerFactionId) : null,
    battleRecordId: raw?.battleRecordId ? String(raw.battleRecordId) : null
  };
}

function hydrateFactions(data: StoreData) {
  if (!Array.isArray(data.factions) || data.factions.length === 0) {
    data.factions = seedFactionStore();
  }
  if (!Array.isArray(data.castles) || data.castles.length === 0) {
    data.castles = seedCastles();
  }
  data.factions = data.factions.map((faction: any) => {
    const builtInDefaults = factionDefaults[faction.id];
    const defaults = builtInDefaults || { name: "未命名陣營", description: "尚未設定陣營描述。" };
    const name = builtInDefaults ? defaults.name : cleanText(faction.name, defaults.name);
    if (builtInDefaults && faction.name !== defaults.name) storageNeedsMigration = true;
    const tower = normalizeFactionTower(faction.tower, name);
    if (isCorruptedText(tower.bossName) || (builtInDefaults && !tower.bossName.includes(name))) {
      tower.bossName = `${name} 第 ${tower.currentLayer} 層守將`;
      storageNeedsMigration = true;
    }
    if (isCorruptedText(tower.rewardSummary)) {
      tower.rewardSummary = "公庫金幣、個人素材與戰鬥經驗";
      storageNeedsMigration = true;
    }
    return {
      ...faction,
      name,
      description: builtInDefaults ? defaults.description : cleanText(faction.description, defaults.description),
      treasury: {
        gold: clampedInt(faction.treasury?.gold, 0, GAME_LIMITS.goldBalance, 0),
        materials: clampedInt(faction.treasury?.materials, 0, GAME_LIMITS.resourceQuantity, 0)
      },
      tech: normalizeFactionTech(faction.tech),
      tower
    };
  });
  data.castles = data.castles.map(normalizeCastle);
  data.sieges = Array.isArray(data.sieges) ? data.sieges.map(normalizeSiege).filter((siege) => siege.castleId) : [];
  data.factionProjects = Array.isArray(data.factionProjects)
    ? data.factionProjects.map((project: any) => ({
        ...project,
        contributorUserIds: Array.isArray(project.contributorUserIds) ? project.contributorUserIds : [],
        status: project.status || "active",
        treasuryCost: {
          gold: clampedInt(project.treasuryCost?.gold, 0, GAME_LIMITS.goldBalance, 0)
        }
      }))
    : [];
}

async function ensureLoaded() {
  if (cachedData) return cachedData;

  await mkdir(dataDir, { recursive: true });

  try {
    const raw = await readFile(dataFile, "utf8");
    cachedData = JSON.parse(raw) as StoreData;
  } catch {
    cachedData = structuredClone(initialData);
    hydrateFactions(cachedData);
    await persist();
  }

  hydrateFactions(cachedData);
  cachedData.users = (cachedData.users || []).map((user: any) => ({
    ...user,
    role: (user.role || (user.email === "admin" ? "admin" : "player")) as UserRole,
    friendIds: Array.isArray(user.friendIds) ? user.friendIds : [],
    lastDailySignInOn: user.lastDailySignInOn || null,
    lastFlashSignInOn: user.lastFlashSignInOn || null
  }));
  cachedData.gameConfig = normalizeGameConfig(cachedData.gameConfig);
  setRuntimeGameConfig(cachedData.gameConfig);
  cachedData.worldBoss = normalizeWorldBoss(cachedData.worldBoss);
  cachedData.characters = (cachedData.characters || []).map(normalizeCharacter);
  for (const character of cachedData.characters) {
    if (character.factionId && !character.currentCastleId) {
      character.currentCastleId =
        cachedData.castles.find((castle) => castle.ownerFactionId === character.factionId && castle.isCapital)?.id ||
        cachedData.castles.find((castle) => castle.ownerFactionId === character.factionId)?.id ||
        null;
    }
    if (character.garrisonAssignment) {
      const garrisonCastle = cachedData.castles.find((castle) => castle.id === character.garrisonAssignment?.castleId);
      if (!garrisonCastle || !character.factionId || garrisonCastle.ownerFactionId !== character.factionId) {
        character.garrisonAssignment = null;
      }
    }
  }
  cachedData.battleRecords = Array.isArray(cachedData.battleRecords)
    ? cachedData.battleRecords.map((record: any) => ({
        ...record,
        logs: Array.isArray(record.logs) ? record.logs : []
      }))
    : [];
  cachedData.activityLogs = Array.isArray(cachedData.activityLogs) ? cachedData.activityLogs : [];
  cachedData.diplomacyRequests = Array.isArray(cachedData.diplomacyRequests) ? cachedData.diplomacyRequests : [];
  cachedData.marketListings = Array.isArray(cachedData.marketListings)
    ? cachedData.marketListings.map((listing: any) => ({
        ...listing,
        item: normalizeItem(listing.item),
        quantity: Number(listing.quantity || listing.item?.quantity || 1),
        sellerCharacterName: listing.sellerCharacterName || listing.sellerDisplayName
      }))
    : [];
  cachedData.announcements = Array.isArray(cachedData.announcements)
    ? cachedData.announcements.map((announcement: any) => ({
        ...announcement,
        title: cleanText(announcement?.title, "系統公告"),
        body: cleanText(announcement?.body, "舊公告內容已損壞，新的公告會正常顯示。")
      }))
    : [];
  cachedData.classConfigs =
    Array.isArray(cachedData.classConfigs) && cachedData.classConfigs.length > 0
      ? cachedData.classConfigs
      : structuredClone(initialData.classConfigs);
  for (const defaultConfig of initialData.classConfigs) {
    if (!cachedData.classConfigs.some((entry) => entry.className === defaultConfig.className)) {
      cachedData.classConfigs.push({ ...defaultConfig });
      storageNeedsMigration = true;
    }
  }
  cachedData.classConfigs = cachedData.classConfigs.map((entry) => ({
    ...entry,
    label: classLabels[entry.className] || cleanText(entry.label, "未命名職業")
  }));
  cachedData.forcedFlashEventEndsAt = cachedData.forcedFlashEventEndsAt || null;
  cachedData.dailyRewardConfig = normalizeRewardSchedule(cachedData.dailyRewardConfig, initialData.dailyRewardConfig);
  cachedData.flashEventConfig = normalizeRewardSchedule(cachedData.flashEventConfig, initialData.flashEventConfig);
  hydrateFactions(cachedData);
  if (storageNeedsMigration) {
    await persist();
    storageNeedsMigration = false;
  }

  return cachedData;
}

async function persist() {
  if (!cachedData) return;
  setRuntimeGameConfig(cachedData.gameConfig);
  await writeFile(dataFile, JSON.stringify(cachedData, null, 2), "utf8");
}

function findCharacterByName(data: StoreData, characterName: string) {
  const normalized = normalizeCharacterName(characterName);
  return data.characters.find((entry) => normalizeCharacterName(entry.name) === normalized) || null;
}

function findUserByCharacterName(data: StoreData, characterName: string) {
  const character = findCharacterByName(data, characterName);
  if (!character) return null;
  return data.users.find((entry) => entry.id === character.userId) || null;
}

async function findCharacterForUpdate(userId: string) {
  const data = await ensureLoaded();
  const character = data.characters.find((entry) => entry.userId === userId);
  const user = data.users.find((entry) => entry.id === userId);
  if (!character || !user) {
    throw new Error("找不到角色資料。");
  }
  return { data, character, user };
}

export async function resolveCharacterByName(characterName: string) {
  const data = await ensureLoaded();
  return findCharacterByName(data, characterName);
}

export async function resolveUserByCharacterName(characterName: string) {
  const data = await ensureLoaded();
  return findUserByCharacterName(data, characterName);
}

function baseCharacterFromPayload(user: StoredUser, payload: RegisterPayload): CharacterProfile {
  const stats = classBaseStats(payload.className);
  const level = 1;
  return {
    id: randomId("char"),
    userId: user.id,
    factionId: null,
    currentCastleId: null,
    movement: null,
    garrisonAssignment: null,
    name: payload.characterName.trim(),
    className: payload.className,
    classChangedOn: taipeiDayKey(),
    level,
    experience: 0,
    instinctLevel: 1,
    instinctExp: 0,
    battleLevel: 1,
    battleExp: 0,
    forgeLevel: 1,
    forgeExp: 0,
    gold: 100,
    materials: 0,
    hp: maxHpForCharacter({ level, stats }),
    maxHp: maxHpForCharacter({ level, stats }),
    mp: maxMpForCharacter({ level, stats }),
    maxMp: maxMpForCharacter({ level, stats }),
    energy: maxEnergyForCharacter({ level, stats }),
    maxEnergy: maxEnergyForCharacter({ level, stats }),
    stats,
    equipmentSlots: starterEquipmentSlots(),
    title: starterTitle(payload.className),
    inventory: [createMaterialItem("iron_ore", 3), createMaterialItem("cloth", 2)],
    statusEffects: starterStatusEffects(),
    subRoleSlots: starterSubRoleSlots(),
    secondaryCharacters: starterSecondaryCharacters(),
    classMastery: normalizeClassMastery(null, payload.className),
    specialSkillSlot: null,
    learnedManuals: [],
    equippedManuals: [],
    achievements: starterAchievements({ instinctLevel: 1 }),
    jobImage: null,
    loadout: classDefaultLoadout(payload.className),
    actionQueue: createEmptyQueue(),
    notifications: []
  };
}

function appendNotification(character: CharacterProfile, kind: NotificationEntry["kind"], title: string, body: string) {
  character.notifications.unshift({
    id: randomId("notice"),
    kind,
    title,
    body,
    createdAt: nowIso(),
    read: false
  });
  character.notifications = character.notifications.slice(0, 120);
}

function syncQueueStatuses(character: CharacterProfile) {
  const now = Date.now();
  character.actionQueue.items = character.actionQueue.items.map((item: StoredQueuedAction, index) => ({
    ...item,
    status: index === 0 && new Date(item.startAt).getTime() <= now ? "active" : "queued"
  }));
  character.actionQueue.updatedAt = nowIso();
}

function syncProgressionLevel(character: CharacterProfile) {
  character.level = character.instinctLevel;
  character.experience = character.instinctExp;
}

function awardInstinctExperience(character: CharacterProfile, gained: number) {
  character.instinctExp += gained;
  while (character.instinctExp >= nextLevelRequirement(character.instinctLevel)) {
    character.instinctExp -= nextLevelRequirement(character.instinctLevel);
    character.instinctLevel += 1;
    syncProgressionLevel(character);
    recalcResources(character);
    character.hp = character.maxHp;
    character.mp = character.maxMp;
    character.energy = character.maxEnergy;
    appendNotification(character, "system", "本能升級", `${character.name} 的本能等級提升到 ${character.instinctLevel}`);
  }
  syncProgressionLevel(character);
}

function awardBattleExperience(character: CharacterProfile, gained: number) {
  character.battleExp += gained;
  while (character.battleExp >= nextLevelRequirement(character.battleLevel)) {
    character.battleExp -= nextLevelRequirement(character.battleLevel);
    character.battleLevel += 1;
    appendNotification(character, "battle", "戰鬥升級", `${character.name} 的戰鬥等級提升到 ${character.battleLevel}`);
  }
}

function awardForgeExperience(character: CharacterProfile, gained: number) {
  character.forgeExp += gained;
  while (character.forgeExp >= nextLevelRequirement(character.forgeLevel)) {
    character.forgeExp -= nextLevelRequirement(character.forgeLevel);
    character.forgeLevel += 1;
    appendNotification(character, "system", "鍛造升級", `${character.name} 的鍛造等級提升到 ${character.forgeLevel}`);
  }
}

function roundReward(value: number, multiplier: number) {
  return Math.max(1, Math.round(value * multiplier));
}

function appendActivityLog(data: StoreData, userId: string, activity: ActivityResult) {
  data.activityLogs.unshift({
    id: randomId("activity"),
    userId,
    createdAt: nowIso(),
    activity
  });
  data.activityLogs = data.activityLogs.slice(0, 300);
}

function actionEnergyCost(character: CharacterProfile, actionType: ActionType, durationHours?: number) {
  const base =
    actionType === "fishing"
      ? 9
      : actionType === "jump_rope"
        ? 10
        : actionType === "reading"
          ? 10
          : actionType === "push_ups"
            ? 11
            : actionType === "meditation"
              ? 8
              : actionType === "boxing"
                ? 12
                : actionType === "mine_shallow"
                  ? 8 * (durationHours || 1)
                  : actionType === "mine_deep"
                    ? 12 * (durationHours || 1)
                    : 0;

  const randomDelta =
    actionType === "mine_shallow" || actionType === "mine_deep"
      ? Array.from({ length: durationHours || 1 }, () => Math.floor(Math.random() * 3) - 1).reduce((sum, n) => sum + n, 0)
      : Math.floor(Math.random() * 3) - 1;

  const levelModifier = 1 + Math.min(0.5, (character.instinctLevel - 1) * 0.02);
  return Math.max(0, Math.round((base + randomDelta) * levelModifier));
}

function queueActionInternal(
  data: StoreData,
  character: CharacterProfile,
  actionType: ActionType,
  options: {
    label?: string;
    durationMs: number;
    hiddenCost: number;
    metadata?: StoredQueuedAction["metadata"];
  }
) {
  const queuedMs = character.actionQueue.items.reduce((total, item) => total + item.durationMs, 0);
  if (queuedMs + options.durationMs > 24 * 60 * 60 * 1000) {
    throw new Error("行動佇列不能超過 24 小時。");
  }
  if (character.energy < options.hiddenCost) {
    throw new Error("精力不足，無法加入行動佇列。");
  }

  character.energy = clamp(character.energy - options.hiddenCost, 0, character.maxEnergy);
  const startFrom = character.actionQueue.items.at(-1)?.endsAt || nowIso();
  const startAt = new Date(startFrom);
  const endsAt = new Date(startAt.getTime() + options.durationMs).toISOString();
  const queuedAction: StoredQueuedAction = {
    id: randomId("queue"),
    actionType,
    label: options.label || actionLabel(actionType),
    durationMs: options.durationMs,
    queuedAt: nowIso(),
    startAt: startAt.toISOString(),
    endsAt,
    status: character.actionQueue.items.length === 0 ? "active" : "queued",
    onlineBonusEligible: true,
    metadata: {
      ...(options.metadata || {}),
      hiddenCost: options.hiddenCost
    },
    hiddenCost: options.hiddenCost
  };

  character.actionQueue.items.push(queuedAction);
  syncQueueStatuses(character);
  appendNotification(character, "system", "行動佇列", `${queuedAction.label} 已加入行動佇列。`);
  return queuedAction;
}

function castleTravelDurationMs(fromCastle: CastleState, toCastle: CastleState, faction?: StoredFaction) {
  if (fromCastle.id === toCastle.id) return 10 * 60 * 1000;
  const distance = Math.max(1, Math.abs(fromCastle.distanceFromCapital - toCastle.distanceFromCapital));
  const speedLevel = faction ? factionTechLevel(faction, "offense_speed") : 0;
  const multiplier = Math.max(0.5, 1 - speedLevel * 0.06);
  return Math.round(distance * 30 * 60 * 1000 * multiplier);
}

function castleTravelEnergyCost(fromCastle: CastleState, toCastle: CastleState) {
  if (fromCastle.id === toCastle.id) return 2;
  const distance = Math.max(1, Math.abs(fromCastle.distanceFromCapital - toCastle.distanceFromCapital));
  return distance * 6;
}

function buildFacilityCost(castle: CastleState, faction?: StoredFaction) {
  const castleLevel = faction ? factionTechLevel(faction, "castle") : 0;
  return {
    gold: Math.max(40, 80 + castle.layer * 30 - castleLevel * 10)
  };
}

function repairCastleCost(castle: CastleState, faction?: StoredFaction) {
  const defenseLevel = faction ? factionTechLevel(faction, "defense") : 0;
  const repairAmount = Math.min(25 + defenseLevel * 5, castle.maxFortification - castle.fortification);
  return {
    repairAmount,
    gold: Math.ceil(repairAmount * 2)
  };
}

function projectDurationMs(kind: FactionProject["kind"], faction?: StoredFaction) {
  const supportLevel = faction ? factionTechLevel(faction, "support") : 0;
  const castleLevel = faction && kind === "build_facility" ? factionTechLevel(faction, "castle") : 0;
  const multiplier = Math.max(0.55, 1 - supportLevel * 0.06 - castleLevel * 0.04);
  const baseMs = kind === "build_facility" ? 2 * 60 * 60 * 1000 : 60 * 60 * 1000;
  return Math.round(baseMs * multiplier);
}

function recalibrateProjectEndsAt(project: FactionProject, nextContributorCount: number) {
  const now = Date.now();
  const remainingMs = Math.max(5 * 60 * 1000, new Date(project.endsAt).getTime() - now);
  const currentCount = Math.max(1, project.contributorUserIds.length);
  const nextCount = Math.max(1, nextContributorCount);
  project.endsAt = new Date(now + Math.max(5 * 60 * 1000, Math.round((remainingMs * currentCount) / nextCount))).toISOString();
}

function processWorldProgress(data: StoreData) {
  const now = Date.now();
  let changed = false;

  // 城牆被動維修：沒有攻城戰時，駐防守軍會逐步修復城牆（基礎 2/小時 + 每名駐軍 4/小時）
  for (const castle of data.castles) {
    const underSiege = data.sieges.some((siege) => siege.status === "active" && siege.castleId === castle.id);
    if (underSiege) {
      castle.wallRepairAt = nowIso();
      continue;
    }
    if (castle.fortification >= castle.maxFortification) {
      if (castle.wallRepairAt) {
        castle.wallRepairAt = null;
        changed = true;
      }
      continue;
    }
    if (!castle.wallRepairAt) {
      castle.wallRepairAt = nowIso();
      changed = true;
      continue;
    }
    const garrisonCount = data.characters.filter((entry) => entry.garrisonAssignment?.castleId === castle.id).length;
    const repairPerHour = 2 + garrisonCount * 4;
    const elapsedHours = (now - new Date(castle.wallRepairAt).getTime()) / 3600000;
    const repaired = Math.floor(elapsedHours * repairPerHour);
    if (repaired > 0) {
      castle.fortification = clamp(castle.fortification + repaired, 0, castle.maxFortification);
      castle.wallRepairAt = nowIso();
      changed = true;
    }
  }

  for (const character of data.characters) {
    if (!character.movement) continue;
    if (character.movement.fromCastleId === character.movement.toCastleId) {
      character.movement = null;
      changed = true;
      continue;
    }
    if (new Date(character.movement.endsAt).getTime() > now) continue;
    const destination = data.castles.find((castle) => castle.id === character.movement?.toCastleId);
    if (destination) {
      character.currentCastleId = destination.id;
      appendNotification(character, "faction", "城池移動完成", `已抵達 ${destination.name}。`);
    }
    character.movement = null;
    changed = true;
  }

  for (const project of data.factionProjects) {
    if (project.status !== "active") continue;
    if (new Date(project.endsAt).getTime() > now) continue;
    const castle = data.castles.find((entry) => entry.id === project.castleId);
    if (!castle) {
      project.status = "cancelled";
      changed = true;
      continue;
    }
    if (project.kind === "build_facility" && project.facilityName) {
      if (!castle.facilities.includes(project.facilityName) && castle.facilities.length < castle.buildSlots) {
        castle.facilities.push(project.facilityName);
      }
    }
    if (project.kind === "repair_castle") {
      castle.fortification = clamp(castle.fortification + (project.repairAmount || 0), 0, castle.maxFortification);
    }
    project.status = "completed";
    for (const userId of project.contributorUserIds) {
      const contributor = data.characters.find((entry) => entry.userId === userId);
      if (contributor) appendNotification(contributor, "faction", "工程完成", `${project.label} 已完成。`);
    }
    changed = true;
  }

  return changed;
}

function getFactionById(data: StoreData, factionId: string) {
  const faction = data.factions.find((entry) => entry.id === factionId);
  if (!faction) throw new Error("找不到陣營。");
  return faction;
}

function memberCountForFaction(data: StoreData, factionId: string) {
  return data.characters.filter((entry) => entry.factionId === factionId).length;
}

function toFactionSummary(data: StoreData, faction: StoredFaction): FactionSummary {
  const leader = faction.leaderUserId ? data.users.find((entry) => entry.id === faction.leaderUserId) || null : null;
  return {
    ...faction,
    leaderDisplayName: leader?.displayName || null,
    memberCount: memberCountForFaction(data, faction.id)
  };
}

function visibleFactionIds(data: StoreData, factionId: string) {
  const faction = getFactionById(data, factionId);
  return new Set([faction.id, ...faction.allyIds]);
}

function isFactionLeader(data: StoreData, userId: string) {
  const character = data.characters.find((entry) => entry.userId === userId);
  if (!character?.factionId) return false;
  return getFactionById(data, character.factionId).leaderUserId === userId;
}

function listCastleGarrisons(data: StoreData, factionId?: string | null): CastleGarrison[] {
  return data.characters
    .filter((character) => character.garrisonAssignment && (!factionId || character.factionId === factionId))
    .map((character) => ({
      castleId: character.garrisonAssignment!.castleId,
      userId: character.userId,
      characterId: character.id,
      characterName: character.name,
      factionId: character.factionId || "",
      startedAt: character.garrisonAssignment!.startedAt
    }));
}

function buildFactionState(data: StoreData, userId: string): FactionState {
  const character = data.characters.find((entry) => entry.userId === userId) || null;
  const myFactionId = character?.factionId || null;
  const selectedFaction = myFactionId ? toFactionSummary(data, getFactionById(data, myFactionId)) : null;
  const listings = myFactionId
    ? data.marketListings.filter((listing) => visibleFactionIds(data, myFactionId).has(listing.factionId))
    : [];

  return {
    factions: data.factions.map((faction) => toFactionSummary(data, faction)),
    selectedFaction,
    castles: data.castles,
    garrisons: listCastleGarrisons(data, myFactionId),
    sieges: myFactionId
      ? data.sieges.filter((siege) => siege.attackerFactionId === myFactionId || siege.defenderFactionId === myFactionId)
      : [],
    projects: myFactionId ? data.factionProjects.filter((project) => project.factionId === myFactionId) : [],
    diplomacyRequests: myFactionId
      ? data.diplomacyRequests.filter((request) => request.fromFactionId === myFactionId || request.toFactionId === myFactionId)
      : [],
    marketListings: listings,
    myFactionId,
    isLeader: myFactionId ? getFactionById(data, myFactionId).leaderUserId === userId : false
  };
}

function damageEquippedForMining(character: CharacterProfile, hours: number) {
  for (const slot of ["weapon", "kneepad"] as EquipmentSlotKey[]) {
    const item = character.equipmentSlots[slot];
    if (!item) continue;
    const broke = damageItem(character, item, hours);
    if (broke) removeItemBonus(character, item);
  }
}

function damageEquippedForBattle(character: CharacterProfile, tookDamage: boolean) {
  for (const slot of ["weapon", "offhand"] as EquipmentSlotKey[]) {
    const item = character.equipmentSlots[slot];
    if (!item) continue;
    const broke = damageItem(character, item, 1);
    if (broke) removeItemBonus(character, item);
  }
  if (tookDamage) {
    for (const slot of ["helmet", "armor", "kneepad"] as EquipmentSlotKey[]) {
      const item = character.equipmentSlots[slot];
      if (!item) continue;
      const broke = damageItem(character, item, 1);
      if (broke) removeItemBonus(character, item);
    }
  }
}

function completeAction(data: StoreData, character: CharacterProfile, item: StoredQueuedAction, isOnline: boolean): ActivityResult {
  const multiplier = item.onlineBonusEligible && isOnline ? 1.2 : 1;
  const rewards: ActivityResult["rewards"] = {};
  let message = `${character.name} 完成了 ${item.label}。`;
  let notificationBody = message;
  let activityType: ActivityResult["type"] = "training";

  const grantStats = (...keys: CharacterStatKey[]) => {
    rewards.statKeys = [...(rewards.statKeys || []), ...keys];
  };

  const statLabel = (key: CharacterStatKey) =>
    ({
      attack: "攻擊",
      defense: "防禦",
      luck: "運氣",
      intelligence: "智慧",
      vitality: "體力",
      spirit: "精神",
      technique: "技巧",
      tenacity: "韌性"
    })[key];

  if (item.actionType === "fishing") {
    updateCharacterStat(character, "technique", 1);
    updateCharacterStat(character, "spirit", 1);
    grantStats("technique", "spirit");
    if (Math.random() < 0.25) {
      updateCharacterStat(character, "intelligence", 1);
      grantStats("intelligence");
    }
    rewards.experience = roundReward(10, multiplier);
    rewards.instinctExp = Math.max(1, Math.round(rewards.experience * 0.35));
    rewards.gold = roundReward(10, multiplier);
    character.gold += rewards.gold;
    awardInstinctExperience(character, rewards.instinctExp);
    message = `${character.name} 完成釣魚訓練，技巧與精神提升。`;
    notificationBody = `${message}\n獲得 ${rewards.gold} 金幣、${rewards.experience} 經驗、${rewards.instinctExp} 本能經驗。\n提升：${(rewards.statKeys || []).map(statLabel).join("、")}`;
  } else if (item.actionType === "jump_rope") {
    updateCharacterStat(character, "vitality", 1);
    updateCharacterStat(character, "technique", 1);
    grantStats("vitality", "technique");
    if (Math.random() < 0.5) {
      updateCharacterStat(character, "attack", 1);
      grantStats("attack");
    }
    if (Math.random() < 0.5) {
      updateCharacterStat(character, "defense", 1);
      grantStats("defense");
    }
    rewards.experience = roundReward(12, multiplier);
    rewards.instinctExp = Math.max(1, Math.round(rewards.experience * 0.4));
    awardInstinctExperience(character, rewards.instinctExp);
    message = `${character.name} 完成跳繩訓練，體能節奏變得更穩。`;
    notificationBody = `${message}\n獲得 ${rewards.experience} 經驗、${rewards.instinctExp} 本能經驗。\n提升：${(rewards.statKeys || []).map(statLabel).join("、")}`;
  } else if (item.actionType === "reading") {
    updateCharacterStat(character, "intelligence", 1);
    updateCharacterStat(character, "technique", 1);
    grantStats("intelligence", "technique");
    rewards.experience = roundReward(14, multiplier);
    rewards.instinctExp = Math.max(1, Math.round(rewards.experience * 0.35));
    awardInstinctExperience(character, rewards.instinctExp);
    message = `${character.name} 完成讀書訓練，智慧與技巧提升。`;
    notificationBody = `${message}\n獲得 ${rewards.experience} 經驗、${rewards.instinctExp} 本能經驗。\n提升：${(rewards.statKeys || []).map(statLabel).join("、")}`;
  } else if (item.actionType === "push_ups") {
    updateCharacterStat(character, "vitality", 1);
    updateCharacterStat(character, "attack", 1);
    updateCharacterStat(character, "defense", 1);
    grantStats("vitality", "attack", "defense");
    rewards.experience = roundReward(14, multiplier);
    rewards.instinctExp = Math.max(1, Math.round(rewards.experience * 0.45));
    awardInstinctExperience(character, rewards.instinctExp);
    message = `${character.name} 完成伏地挺身，攻防與體力提升。`;
    notificationBody = `${message}\n獲得 ${rewards.experience} 經驗、${rewards.instinctExp} 本能經驗。\n提升：${(rewards.statKeys || []).map(statLabel).join("、")}`;
  } else if (item.actionType === "meditation") {
    updateCharacterStat(character, "luck", 1);
    grantStats("luck");
    if (Math.random() < 0.4) {
      updateCharacterStat(character, "spirit", 1);
      grantStats("spirit");
    }
    rewards.experience = roundReward(11, multiplier);
    rewards.instinctExp = Math.max(1, Math.round(rewards.experience * 0.35));
    awardInstinctExperience(character, rewards.instinctExp);
    message = `${character.name} 完成沉思，運氣與精神更加集中。`;
    notificationBody = `${message}\n獲得 ${rewards.experience} 經驗、${rewards.instinctExp} 本能經驗。\n提升：${(rewards.statKeys || []).map(statLabel).join("、")}`;
  } else if (item.actionType === "boxing") {
    updateCharacterStat(character, "attack", 1);
    updateCharacterStat(character, "vitality", 1);
    updateCharacterStat(character, "technique", 1);
    grantStats("attack", "vitality", "technique");
    if (Math.random() < 0.35) {
      updateCharacterStat(character, "defense", 1);
      grantStats("defense");
    }
    rewards.experience = roundReward(15, multiplier);
    rewards.instinctExp = Math.max(1, Math.round(rewards.experience * 0.5));
    awardInstinctExperience(character, rewards.instinctExp);
    message = `${character.name} 完成拳擊訓練，攻擊、體力與技巧提升。`;
    notificationBody = `${message}\n獲得 ${rewards.experience} 經驗、${rewards.instinctExp} 本能經驗。\n提升：${(rewards.statKeys || []).map(statLabel).join("、")}`;
  } else if (item.actionType === "rest") {
    activityType = "rest";
    const prevHp = character.hp;
    const prevMp = character.mp;
    const prevEnergy = character.energy;
    character.hp = clamp(character.hp + roundReward(Math.max(20, character.maxHp * 0.45), multiplier), 0, character.maxHp);
    character.mp = clamp(character.mp + roundReward(Math.max(12, character.maxMp * 0.4), multiplier), 0, character.maxMp);
    character.energy = clamp(character.energy + roundReward(Math.max(18, character.maxEnergy * 0.5), multiplier), 0, character.maxEnergy);
    rewards.hpRestored = character.hp - prevHp;
    rewards.mpRestored = character.mp - prevMp;
    rewards.energyRestored = character.energy - prevEnergy;
    rewards.instinctExp = 1;
    awardInstinctExperience(character, rewards.instinctExp);
    message = `${character.name} 完成休息，狀態已恢復。`;
    notificationBody = `${message}\n恢復 HP ${rewards.hpRestored}、MP ${rewards.mpRestored}、精力 ${rewards.energyRestored}，獲得 ${rewards.instinctExp} 本能經驗。`;
  } else if (item.actionType === "mine_shallow" || item.actionType === "mine_deep") {
    activityType = "mining";
    const hours = item.metadata?.durationHours || 1;
    const isDeep = item.actionType === "mine_deep";
    const gold = roundReward((isDeep ? 26 : 14) * hours, multiplier);
    const experience = roundReward((isDeep ? 18 : 10) * hours, multiplier);
    const rewardPool = materialCatalog().flatMap((entry) => Array.from({ length: entry.weight }, () => entry.type));
    const dropCount = roundReward((isDeep ? 4 : 2) * hours, multiplier);
    const drops = Array.from({ length: dropCount }, () => randomFrom(rewardPool));
    const addedItems = addMaterialRewards(character, drops);
    character.gold += gold;
    rewards.gold = gold;
    rewards.materials = drops.length;
    rewards.items = addedItems;
    rewards.experience = experience;
    rewards.instinctExp = Math.max(1, Math.round(experience * 0.4));
    awardInstinctExperience(character, rewards.instinctExp);
    character.hp = clamp(character.hp - Math.ceil(hours * Math.max(1, (isDeep ? 6 : 3) - Math.floor(character.stats.tenacity / 8))), 0, character.maxHp);
    character.mp = clamp(character.mp - Math.ceil(hours * (isDeep ? 5 : 2)), 0, character.maxMp);
    damageEquippedForMining(character, hours);
    const dropSummary = addedItems.reduce<Record<string, number>>((summary, entry) => {
      summary[entry.name] = (summary[entry.name] || 0) + 1;
      return summary;
    }, {});
    const dropText = Object.entries(dropSummary)
      .map(([name, amount]) => `${name} x${amount}`)
      .join("、");
    message = `${character.name} 完成${isDeep ? "深層" : "淺層"}挖礦，獲得 ${gold} 金幣與 ${drops.length} 份素材。`;
    notificationBody = `${message}\n掉落：${dropText || "無"}\n獲得 ${experience} 經驗、${rewards.instinctExp} 本能經驗。\n狀態：HP ${character.hp}/${character.maxHp}、MP ${character.mp}/${character.maxMp}`;
  }

  awardClassMasteryExperience(character, Math.max(2, Math.round((rewards.experience || 8) * 0.25)));
  appendNotification(character, "activity", "行動完成", notificationBody);
  const result: ActivityResult = {
    type: activityType,
    message,
    character: toPublicCharacter(character),
    rewards
  };
  appendActivityLog(data, character.userId, result);
  return result;
}

async function processCharacterQueueInternal(data: StoreData, character: CharacterProfile, isOnline: boolean, now = Date.now()) {
  let changed = false;
  const completedActivities: ActivityResult[] = [];
  while (character.actionQueue.items.length > 0) {
    const current = character.actionQueue.items[0] as StoredQueuedAction;
    if (new Date(current.endsAt).getTime() > now) break;
    character.actionQueue.items.shift();
    completedActivities.push(completeAction(data, character, current, isOnline));
    changed = true;
  }
  if (changed || character.actionQueue.items.length > 0) {
    syncQueueStatuses(character);
  }
  return { changed, completedActivities };
}

export async function registerUser(payload: RegisterPayload) {
  const data = await ensureLoaded();
  const email = payload.email.trim().toLowerCase();
  if (data.users.some((user) => user.email === email)) {
    throw new Error("這個 Email 已經註冊。");
  }
  if (findCharacterByName(data, payload.characterName)) {
    throw new Error("這個角色名稱已被使用。");
  }
  const user: StoredUser = {
    id: randomId("user"),
    email,
    displayName: payload.displayName.trim(),
    role: email === "admin" ? "admin" : "player",
    password: payload.password,
    createdAt: nowIso(),
    friendIds: [],
    lastDailySignInOn: null,
    lastFlashSignInOn: null
  };
  const character = baseCharacterFromPayload(user, payload);
  data.users.push(user);
  data.characters.push(character);
  await persist();
  return { user: toAuthUser(user), character: toPublicCharacter(character) };
}

export async function loginUser(emailInput: string, password: string) {
  const data = await ensureLoaded();
  const email = emailInput.trim().toLowerCase();
  const user = data.users.find((entry) => entry.email === email && entry.password === password);
  if (!user) throw new Error("登入失敗，請確認帳號與密碼。");
  const character = data.characters.find((entry) => entry.userId === user.id);
  if (!character) throw new Error("找不到角色資料。");
  return { user: toAuthUser(user), character: toPublicCharacter(character) };
}

export async function createSession(userId: string) {
  const data = await ensureLoaded();
  const token = randomId("session");
  data.sessions = data.sessions.filter((session) => session.userId !== userId);
  data.sessions.push({ token, userId, createdAt: nowIso() });
  await persist();
  return token;
}

export async function getSession(token: string) {
  const data = await ensureLoaded();
  return data.sessions.find((entry) => entry.token === token) || null;
}

export async function getUserById(userId: string) {
  const data = await ensureLoaded();
  const user = data.users.find((entry) => entry.id === userId);
  return user ? toAuthUser(user) : null;
}

export async function getCharacterByUserId(userId: string) {
  const data = await ensureLoaded();
  if (processWorldProgress(data)) await persist();
  const character = data.characters.find((entry) => entry.userId === userId);
  return character ? toPublicCharacter(character) : null;
}

export async function updateCharacter(character: CharacterProfile) {
  const data = await ensureLoaded();
  const index = data.characters.findIndex((entry) => entry.id === character.id);
  if (index === -1) throw new Error("?曆??啗??脰???");
  recalcResources(character);
  sortInventory(character);
  data.characters[index] = normalizeCharacter(cloneCharacter(character));
  await persist();
  return toPublicCharacter(data.characters[index]);
}

export async function changeCharacterClass(userId: string, className: CharacterClass) {
  const { data, character } = await findCharacterForUpdate(userId);
  if (character.classChangedOn === taipeiDayKey()) {
    throw new Error("今天已經切換過職業。");
  }
  const config = data.classConfigs.find((entry) => entry.className === className);
  if (!config?.active) {
    throw new Error("這個職業目前未開放。");
  }
  if (character.specialSkillSlot) {
    const previous = gameplaySpecialSkillCatalog().find((entry) => entry.id === character.specialSkillSlot);
    applyStatBonus(character, statBonusFromSkill(previous), -1);
  }
  for (const slot of character.secondaryCharacters) {
    const definition = slot.characterId ? gameplaySecondaryCharacterCatalog().find((entry) => entry.id === slot.characterId) : null;
    if (definition) applyStatBonus(character, effectiveSecondaryStatBonus(character, slot, definition), -1);
  }
  character.className = className;
  character.classMastery[className].unlocked = true;
  character.classChangedOn = taipeiDayKey();
  character.specialSkillSlot = null;
  for (const slot of character.secondaryCharacters) {
    const definition = slot.characterId ? gameplaySecondaryCharacterCatalog().find((entry) => entry.id === slot.characterId) : null;
    if (definition) applyStatBonus(character, effectiveSecondaryStatBonus(character, slot, definition), 1);
  }
  refreshCharacterLoadout(character);
  character.title = starterTitle(className);
  character.statusEffects = starterStatusEffects();
  recalcResources(character);
  await persist();
  return toPublicCharacter(character);
}

export async function recordBattle(record: BattleRecordSummary) {
  const data = await ensureLoaded();
  data.battleRecords.unshift(record);
  data.battleRecords = data.battleRecords.slice(0, 120);
  const participantIds = new Set(record.participants.map((participant) => participant.userId));
  for (const character of data.characters) {
    if (!participantIds.has(character.userId)) continue;
    const battleExp = record.winner === "players" ? 18 : 8;
    awardBattleExperience(character, battleExp);
    awardInstinctExperience(character, record.winner === "players" ? 10 : 4);
    awardClassMasteryExperience(character, Math.max(3, Math.round(battleExp * 0.45)));
    awardSecondaryExperience(character, Math.max(4, Math.round(battleExp * 0.55)));
    appendNotification(
      character,
      "battle",
      record.winner === "players" ? "戰鬥勝利" : "戰鬥失敗",
      `${record.bossName} 的戰報已保存。`
    );
  }
  await persist();
}

export async function syncBattleResult(userId: string, hp: number, mp: number, energy?: number, tookDamage = false) {
  const { character } = await findCharacterForUpdate(userId);
  character.hp = clamp(hp, 0, character.maxHp);
  character.mp = clamp(mp, 0, character.maxMp);
  character.energy = clamp(energy ?? character.energy, 0, character.maxEnergy);
  damageEquippedForBattle(character, tookDamage);
  await persist();
  return toPublicCharacter(character);
}

export async function listBattleRecordsForUser(userId: string) {
  const data = await ensureLoaded();
  return data.battleRecords.filter((record) => record.participants.some((participant) => participant.userId === userId));
}

export async function processCharacterQueue(userId: string, isOnline: boolean) {
  const { data, character } = await findCharacterForUpdate(userId);
  const worldChanged = processWorldProgress(data);
  const result = await processCharacterQueueInternal(data, character, isOnline);
  if (worldChanged || result.changed) await persist();
  return { character: toPublicCharacter(character), completedActivities: result.completedActivities };
}

export async function processAllCharacterQueues(isUserOnline: (userId: string) => boolean) {
  const data = await ensureLoaded();
  let changed = false;
  for (const character of data.characters) {
    const result = await processCharacterQueueInternal(data, character, isUserOnline(character.userId));
    changed = changed || result.changed;
  }
  if (changed) await persist();
}

export async function enqueueAction(userId: string, actionType: ActionType, durationHours?: number): Promise<QueueMutationResult> {
  const { data, character } = await findCharacterForUpdate(userId);
  processWorldProgress(data);
  await processCharacterQueueInternal(data, character, false);
  if (isCharacterBusy(character)) throw new Error("角色正在忙碌中，無法加入新的行動。");
  if (actionType === "mine_deep" && character.instinctLevel < 10) {
    throw new Error("深層挖礦需要本能等級 10。");
  }

  const hiddenCost = actionEnergyCost(character, actionType, durationHours);
  const durationMs = actionDurationMs(actionType, durationHours);
  const queuedAction = queueActionInternal(data, character, actionType, {
    durationMs,
    hiddenCost,
    metadata: {
      durationHours,
      durationLabel: actionDurationLabel(actionType, durationHours)
    }
  });
  await persist();

  return {
    message: `${queuedAction.label} 已加入行動佇列。`,
    character: toPublicCharacter(character),
    queue: toPublicQueue(character.actionQueue)
  };
}

export async function getQueueState(userId: string, isOnline: boolean) {
  const result = await processCharacterQueue(userId, isOnline);
  return { queue: result.character.actionQueue, character: result.character, completedActivities: result.completedActivities };
}

export async function cancelQueuedAction(userId: string, actionId: string): Promise<QueueMutationResult> {
  const { data, character } = await findCharacterForUpdate(userId);
  const index = character.actionQueue.items.findIndex((item) => item.id === actionId);
  if (index === -1) throw new Error("找不到指定的佇列行動。");
  if (index === 0) throw new Error("進行中的行動不能取消。");

  const item = character.actionQueue.items[index] as StoredQueuedAction;
  character.energy = clamp(character.energy + (item.hiddenCost || 0), 0, character.maxEnergy);
  character.actionQueue.items.splice(index, 1);
  syncQueueStatuses(character);
  appendNotification(character, "system", "行動佇列", `${item.label} 已從佇列取消。`);
  await persist();
  return { message: "已取消佇列行動", character: toPublicCharacter(character), queue: toPublicQueue(character.actionQueue) };
}

export async function cancelQueuedActionsExceptActive(userId: string): Promise<QueueMutationResult> {
  const { data, character } = await findCharacterForUpdate(userId);
  if (character.actionQueue.items.length <= 1) {
    return {
      message: "目前沒有可取消的等待行動。",
      character: toPublicCharacter(character),
      queue: toPublicQueue(character.actionQueue)
    };
  }

  const cancelledItems = character.actionQueue.items.slice(1) as StoredQueuedAction[];
  const refundedEnergy = cancelledItems.reduce((total, item) => total + (item.hiddenCost || 0), 0);
  character.energy = clamp(character.energy + refundedEnergy, 0, character.maxEnergy);
  character.actionQueue.items = character.actionQueue.items.slice(0, 1) as StoredQueuedAction[];
  syncQueueStatuses(character);
  appendNotification(character, "system", "行動佇列", `已取消 ${cancelledItems.length} 個等待行動。`);
  await persist();
  return {
    message: `已取消 ${cancelledItems.length} 個等待行動。`,
    character: toPublicCharacter(character),
    queue: toPublicQueue(character.actionQueue)
  };
}

export async function listShopItems(): Promise<ShopItem[]> {
  await ensureLoaded();
  return staticShopItems();
}

export async function purchaseShopItem(userId: string, itemId: string): Promise<PurchaseResult> {
  const { character } = await findCharacterForUpdate(userId);
  const item = staticShopItems().find((entry) => entry.id === itemId);
  if (!item) throw new Error("找不到商店物品。");
  if (character.gold < item.price) throw new Error("金幣不足。");

  character.gold -= item.price;
  const inventoryItem = normalizeItem({
    ...item,
    id: randomId("item"),
    stackable: false,
    quantity: 1,
    sortOrder: character.inventory.length,
    qualityTier: "standard"
  });
  mergeInventoryStack(character, inventoryItem);
  appendNotification(character, "system", "購買完成", `${inventoryItem.name} 已加入背包。`);
  await persist();

  return {
    message: `${inventoryItem.name} 購買成功。`,
    character: toPublicCharacter(character),
    purchasedItem: inventoryItem
  };
}

export async function listNotifications(userId: string) {
  const { character } = await findCharacterForUpdate(userId);
  return toPublicCharacter(character).notifications;
}

export async function listAnnouncements() {
  const data = await ensureLoaded();
  return data.announcements.filter((entry) => entry.active);
}

export async function listFriends(userId: string, isOnline: (id: string) => boolean): Promise<FriendSummary[]> {
  const data = await ensureLoaded();
  const user = data.users.find((entry) => entry.id === userId);
  if (!user) throw new Error("找不到使用者。");
  return user.friendIds
    .map((friendId) => data.users.find((entry) => entry.id === friendId))
    .filter((entry): entry is StoredUser => Boolean(entry))
    .map((entry) => ({
      userId: entry.id,
      displayName: entry.displayName,
      characterName: data.characters.find((character) => character.userId === entry.id)?.name || entry.displayName,
      online: isOnline(entry.id)
    }));
}

export async function addFriend(userId: string, characterName?: string, email?: string) {
  const data = await ensureLoaded();
  const me = data.users.find((entry) => entry.id === userId);
  const target =
    (characterName ? findUserByCharacterName(data, characterName) : null) ||
    (email ? data.users.find((entry) => entry.email === email.trim().toLowerCase()) || null : null);
  if (!me) throw new Error("找不到使用者。");
  if (!target) throw new Error("找不到目標角色或 Email。");
  if (target.id === me.id) throw new Error("不能加入自己為好友。");
  if (me.friendIds.includes(target.id)) throw new Error("已經是好友。");
  me.friendIds.push(target.id);
  target.friendIds.push(me.id);
  await persist();
}

export async function getSignInStatus(userId: string): Promise<SignInStatus> {
  const data = await ensureLoaded();
  const user = data.users.find((entry) => entry.id === userId);
  if (!user) throw new Error("找不到使用者。");
  const flashConfig = data.flashEventConfig;
  const forcedFlash = flashWindowInfo(data.forcedFlashEventEndsAt);
  const flashActive = forcedFlash.active || isRewardScheduleActive(flashConfig);
  const flashEndsAt = forcedFlash.endsAt || flashConfig.endAt;
  const dailyConfig = data.dailyRewardConfig;
  return {
    dailyClaimedToday: user.lastDailySignInOn === taipeiDayKey(),
    dailyAvailable: isRewardScheduleActive(dailyConfig),
    dailyStartsAt: dailyConfig.startAt,
    dailyEndsAt: dailyConfig.endAt,
    dailyTitle: dailyConfig.title,
    flashEventActive: flashActive,
    flashEventEndsAt: flashEndsAt,
    flashEventStartsAt: flashConfig.startAt,
    flashClaimedToday: user.lastFlashSignInOn === taipeiDayKey(),
    flashTitle: flashConfig.title
  };
}

export async function claimDailySignIn(userId: string) {
  const { data, user, character } = await findCharacterForUpdate(userId);
  const dayKey = taipeiDayKey();
  if (user.lastDailySignInOn === dayKey) throw new Error("今天已經領過每日補給。");
  if (!isRewardScheduleActive(data.dailyRewardConfig)) throw new Error("目前沒有可領取的每日補給。");
  user.lastDailySignInOn = dayKey;
  grantRewardTemplate(character, data.dailyRewardConfig.reward, data.dailyRewardConfig.title);
  appendRewardAnnouncement(data, data.dailyRewardConfig.title, data.dailyRewardConfig.reward);
  await persist();
  return { message: "每日補給領取成功。", character: toPublicCharacter(character) };
}

export async function claimFlashSignIn(userId: string) {
  const { data, user, character } = await findCharacterForUpdate(userId);
  const flash = flashWindowInfo(data.forcedFlashEventEndsAt);
  const flashActive = flash.active || isRewardScheduleActive(data.flashEventConfig);
  if (!flashActive) throw new Error("目前沒有可領取的限時補給。");
  if (user.lastFlashSignInOn === taipeiDayKey()) throw new Error("今天已經領過限時補給。");
  user.lastFlashSignInOn = taipeiDayKey();
  grantRewardTemplate(character, data.flashEventConfig.reward, data.flashEventConfig.title);
  appendRewardAnnouncement(data, data.flashEventConfig.title, data.flashEventConfig.reward);
  await persist();
  return { message: "限時補給領取成功。", character: toPublicCharacter(character) };
}

export async function getInventory(userId: string): Promise<InventoryResult> {
  const { character } = await findCharacterForUpdate(userId);
  sortInventory(character);
  return {
    character: toPublicCharacter(character),
    inventory: toPublicCharacter(character).inventory,
    equipmentSlots: toPublicCharacter(character).equipmentSlots
  };
}

function selectedSecondaryDefinitions(character: CharacterProfile) {
  const selectedIds = new Set(character.secondaryCharacters.map((slot) => slot.characterId).filter(Boolean) as string[]);
  return gameplaySecondaryCharacterCatalog().filter((entry) => selectedIds.has(entry.id));
}

function unlockedSpecialSkills(character: CharacterProfile) {
  const skillIds = new Set<string>();
  for (const skill of gameplaySpecialSkillCatalog()) {
    const masteryLevel = character.classMastery?.[character.className]?.level || 1;
    if (skill.source === "class" && skill.requiredClass === character.className && (skill.unlockLevel || 1) <= masteryLevel) skillIds.add(skill.id);
  }
  for (const slot of character.secondaryCharacters) {
    if (!slot.characterId) continue;
    for (const skillId of slot.unlockedSkillIds) skillIds.add(skillId);
  }
  for (const manual of character.learnedManuals) {
    if (manual.unlockedSkillId) skillIds.add(manual.unlockedSkillId);
  }
  return gameplaySpecialSkillCatalog().filter((skill) => skillIds.has(skill.id));
}

function refreshCharacterLoadout(character: CharacterProfile) {
  const base = classDefaultLoadout(character.className);
  const selectedSecondaries = selectedSecondaryDefinitions(character);
  const skills = new Set(base.skills);
  for (const slot of character.secondaryCharacters) {
    for (const skillId of slot.unlockedSkillIds) {
      const skill = gameplaySpecialSkillCatalog().find((entry) => entry.id === skillId);
      if (skill) skills.add(skill.name);
    }
  }
  if (character.specialSkillSlot) {
    const special = gameplaySpecialSkillCatalog().find((entry) => entry.id === character.specialSkillSlot);
    if (special) skills.add(`特殊技能：${special.name}`);
  }
  character.loadout = {
    ...base,
    equipment: [...base.equipment, ...selectedSecondaries.map((entry) => entry.weapon)],
    skills: [...skills]
  };
}

function syncCharacterAchievements(character: CharacterProfile) {
  character.achievements = normalizeAchievements(character.achievements, character).map((achievement) => {
    if (achievement.id !== "level_5") return achievement;
    const completed = character.instinctLevel >= achievement.target || achievement.completed;
    return {
      ...achievement,
      progress: Math.min(character.instinctLevel, achievement.target),
      completed,
      completedAt: completed ? achievement.completedAt || nowIso() : null
    };
  });
}

export async function getCharacterCatalog() {
  await ensureLoaded();
  return {
    secondaryCharacters: gameplaySecondaryCharacterCatalog(),
    specialSkills: gameplaySpecialSkillCatalog()
  };
}

export async function selectSecondaryCharacter(userId: string, payload: { slot: number; characterId: string | null }) {
  const { character } = await findCharacterForUpdate(userId);
  const slotNumber = Number(payload.slot);
  if (![1, 2, 3].includes(slotNumber)) throw new Error("次要角色欄位必須是 1 到 3。");
  const nextCharacterId = payload.characterId || null;
  const catalog = gameplaySecondaryCharacterCatalog();
  const nextDefinition = nextCharacterId ? catalog.find((entry) => entry.id === nextCharacterId) : null;
  if (nextCharacterId && !nextDefinition) throw new Error("找不到次要角色。");
  if (nextCharacterId && character.secondaryCharacters.some((slot) => slot.slot !== slotNumber && slot.characterId === nextCharacterId)) {
    throw new Error("同一個次要角色不能重複裝備。");
  }
  const currentSlot = character.secondaryCharacters.find((slot) => slot.slot === slotNumber);
  if (!currentSlot) throw new Error("找不到次要角色欄位。");
  const previousDefinition = currentSlot.characterId ? catalog.find((entry) => entry.id === currentSlot.characterId) : null;
  if (previousDefinition) applyStatBonus(character, effectiveSecondaryStatBonus(character, currentSlot, previousDefinition), -1);
  currentSlot.characterId = nextCharacterId;
  currentSlot.level = currentSlot.level || 1;
  currentSlot.exp = currentSlot.exp || 0;
  currentSlot.lastTriggeredSkillId = null;
  currentSlot.cooldownUntilTick = null;
  updateSecondaryUnlockedSkills(currentSlot, nextCharacterId);
  if (nextDefinition) applyStatBonus(character, effectiveSecondaryStatBonus(character, currentSlot, nextDefinition), 1);
  if (character.specialSkillSlot && !unlockedSpecialSkills(character).some((skill) => skill.id === character.specialSkillSlot)) {
    const oldSkill = gameplaySpecialSkillCatalog().find((entry) => entry.id === character.specialSkillSlot);
    applyStatBonus(character, statBonusFromSkill(oldSkill), -1);
    character.specialSkillSlot = null;
  }
  refreshCharacterLoadout(character);
  recalcResources(character);
  appendNotification(character, "system", "次要角色", nextDefinition ? `已裝備 ${nextDefinition.name}` : `第 ${slotNumber} 格已卸下`);
  await persist();
  return toPublicCharacter(character);
}

export async function equipSpecialSkill(userId: string, payload: { skillId: string | null }) {
  const { character } = await findCharacterForUpdate(userId);
  const nextSkillId = payload.skillId || null;
  const previous = character.specialSkillSlot ? gameplaySpecialSkillCatalog().find((entry) => entry.id === character.specialSkillSlot) : null;
  const next = nextSkillId ? unlockedSpecialSkills(character).find((entry) => entry.id === nextSkillId) : null;
  if (nextSkillId && !next) throw new Error("這個特殊技能尚未解鎖。");
  if (previous) applyStatBonus(character, statBonusFromSkill(previous), -1);
  character.specialSkillSlot = nextSkillId;
  if (next) applyStatBonus(character, statBonusFromSkill(next), 1);
  refreshCharacterLoadout(character);
  recalcResources(character);
  appendNotification(character, "system", "特殊技能", next ? `已裝備 ${next.name}` : "已卸下特殊技能");
  await persist();
  return toPublicCharacter(character);
}

export async function learnManual(userId: string, payload: { itemId: string }) {
  const { character } = await findCharacterForUpdate(userId);
  const index = character.inventory.findIndex((item) => item.id === payload.itemId);
  if (index === -1) throw new Error("找不到秘籍物品。");
  const item = character.inventory[index];
  if (item.category !== "manual") throw new Error("這個物品不是秘籍。");
  const manualId = item.craftSource || item.name;
  if (character.learnedManuals.some((manual) => manual.manualId === manualId)) throw new Error("這本秘籍已經學會。");
  character.inventory.splice(index, 1);
  const learned: LearnedManual = {
    manualId,
    name: item.name,
    effectSummary: item.effectSummary,
    statBonus: item.statBonus || {},
    unlockedSkillId: "manual_secret_breath",
    learnedAt: nowIso()
  };
  character.learnedManuals.push(learned);
  refreshCharacterLoadout(character);
  appendNotification(character, "system", "秘籍學會", `${item.name} 已永久學會。`);
  await persist();
  return getInventory(userId);
}

export async function equipManual(userId: string, payload: { manualId: string }) {
  const { character } = await findCharacterForUpdate(userId);
  const manual = character.learnedManuals.find((entry) => entry.manualId === payload.manualId);
  if (!manual) throw new Error("尚未學會這本秘籍。");
  if (character.equippedManuals.includes(manual.manualId)) throw new Error("這本秘籍已經裝備。");
  if (character.equippedManuals.length >= 3) throw new Error("秘籍槽已滿，最多裝備 3 本。");
  character.equippedManuals.push(manual.manualId);
  applyStatBonus(character, manual.statBonus || {}, 1);
  refreshCharacterLoadout(character);
  recalcResources(character);
  appendNotification(character, "system", "秘籍裝備", `${manual.name} 的 Buff 已生效。`);
  await persist();
  return toPublicCharacter(character);
}

export async function unequipManual(userId: string, payload: { manualId: string }) {
  const { character } = await findCharacterForUpdate(userId);
  const manual = character.learnedManuals.find((entry) => entry.manualId === payload.manualId);
  if (!manual || !character.equippedManuals.includes(payload.manualId)) throw new Error("這本秘籍目前沒有裝備。");
  character.equippedManuals = character.equippedManuals.filter((manualId) => manualId !== payload.manualId);
  applyStatBonus(character, manual.statBonus || {}, -1);
  refreshCharacterLoadout(character);
  recalcResources(character);
  appendNotification(character, "system", "秘籍卸下", `${manual.name} 的 Buff 已移除。`);
  await persist();
  return toPublicCharacter(character);
}

export async function getAchievements(userId: string) {
  const { character } = await findCharacterForUpdate(userId);
  syncCharacterAchievements(character);
  await persist();
  return { achievements: character.achievements, character: toPublicCharacter(character) };
}

export async function updateInventorySortOrder(userId: string, payload: InventorySortPayload): Promise<InventoryResult> {
  const { character } = await findCharacterForUpdate(userId);
  const orderedIds = payload.orderedItemIds.filter(Boolean);
  const orderedIdSet = new Set(orderedIds);
  const groupedItems = character.inventory.filter((item) => {
    if (payload.groupKey === "material") return item.category === "material";
    if (payload.groupKey === "manual") return item.category === "manual";
    if (payload.groupKey === "other") return !["equipment", "material", "manual"].includes(item.category);
    return item.category === "equipment" && (item.equipmentSlot || "other") === payload.groupKey;
  });
  const groupIds = new Set(groupedItems.map((item) => item.id));
  if (orderedIds.some((itemId) => !groupIds.has(itemId)) || orderedIds.length !== groupedItems.length) {
    throw new Error("背包排序資料與目前分類不一致。");
  }

  const sortedGroup = orderedIds
    .map((itemId) => character.inventory.find((item) => item.id === itemId))
    .filter((item): item is InventoryItem => Boolean(item));
  const restItems = character.inventory.filter((item) => !orderedIdSet.has(item.id));
  const nextInventory: InventoryItem[] = [];
  let inserted = false;
  for (const item of character.inventory) {
    if (orderedIdSet.has(item.id)) {
      if (!inserted) {
        nextInventory.push(...sortedGroup);
        inserted = true;
      }
      continue;
    }
    nextInventory.push(item);
  }
  character.inventory = inserted ? nextInventory : [...restItems, ...sortedGroup];
  character.inventory = character.inventory.map((item, index) => ({ ...item, sortOrder: index }));
  await persist();
  return getInventory(userId);
}

export async function equipInventoryItem(userId: string, payload: EquipItemPayload): Promise<InventoryResult> {
  const { character } = await findCharacterForUpdate(userId);
  const index = character.inventory.findIndex((item) => item.id === payload.itemId);
  if (index === -1) throw new Error("找不到背包物品。");
  const item = character.inventory[index];
  const slot = payload.slot || item.equipmentSlot;
  if (!slot) throw new Error("這個物品沒有可裝備欄位。");
  if (item.isBroken) throw new Error("已損壞的裝備不能裝備。");
  const previous = character.equipmentSlots[slot];
  if (previous) {
    removeItemBonus(character, previous);
    mergeInventoryStack(character, previous);
  }
  character.inventory.splice(index, 1);
  character.equipmentSlots[slot] = item;
  applyItemBonus(character, item);
  appendNotification(character, "system", "裝備更新", `${item.name} 已裝備到 ${equipmentSlotLabel(slot)}。`);
  await persist();
  return getInventory(userId);
}

export async function unequipInventoryItem(userId: string, payload: UnequipItemPayload): Promise<InventoryResult> {
  const { character } = await findCharacterForUpdate(userId);
  const item = character.equipmentSlots[payload.slot];
  if (!item) throw new Error("這個欄位沒有裝備。");
  removeItemBonus(character, item);
  character.equipmentSlots[payload.slot] = null;
  mergeInventoryStack(character, item);
  appendNotification(character, "system", "裝備卸下", `${item.name} 已放回背包。`);
  await persist();
  return getInventory(userId);
}

export async function listForgeOptions(): Promise<ForgeOption[]> {
  await ensureLoaded();
  return forgeOptions();
}

export async function listForgeRecipes(): Promise<ForgeRecipe[]> {
  await ensureLoaded();
  return forgeRecipes();
}

export async function craftEquipment(userId: string, payload: CraftPayload) {
  const { data, character } = await findCharacterForUpdate(userId);
  processWorldProgress(data);
  if (isCharacterBusy(character)) throw new Error("角色正在忙碌中，無法鍛造。");
  if (character.actionQueue.items.length > 0) throw new Error("角色已有行動佇列，暫時無法鍛造。");
  if (!payload.materialItemIds?.length || payload.materialItemIds.length > 16) {
    throw new Error("鍛造材料需介於 1 到 16 個。");
  }

  const materialTypes: MaterialType[] = [];
  const materialCounts = new Map<string, number>();
  for (const materialItemId of payload.materialItemIds) {
    materialCounts.set(materialItemId, (materialCounts.get(materialItemId) || 0) + 1);
  }
  for (const [materialItemId, count] of materialCounts.entries()) {
    const source = character.inventory.find((item) => item.id === materialItemId);
    if (!source || source.category !== "material" || !source.materialType) {
      throw new Error("鍛造只能使用背包中的材料。");
    }
    if (count > (source.quantity || 0)) {
      throw new Error(`${source.name} 數量不足。`);
    }
    for (let index = 0; index < count; index += 1) {
      materialTypes.push(source.materialType);
    }
  }
  for (const [materialItemId, count] of materialCounts.entries()) {
    const removed = removeInventoryQuantity(character, materialItemId, count);
    if (!removed) throw new Error("扣除材料失敗。");
  }

  // Minecraft 式精確配方優先：材料組合完全一致時打造出特殊產品
  const matchedRecipe = matchForgeRecipe(materialTypes);
  const item = normalizeItem(
    matchedRecipe
      ? createRecipeEquipment({ recipe: matchedRecipe, forgeLevel: character.forgeLevel, craftedBy: character.name })
      : createForgedEquipment({
          equipmentSlot: payload.equipmentSlot,
          customName: payload.customName,
          materialTypes,
          stats: character.stats,
          instinctLevel: character.instinctLevel,
          forgeLevel: character.forgeLevel,
          craftedBy: character.name
        })
  );
  mergeInventoryStack(character, item);
  awardForgeExperience(character, matchedRecipe ? 30 + materialTypes.length * 2 : 14 + materialTypes.length * 2);
  awardInstinctExperience(character, Math.max(2, Math.floor(materialTypes.length / 2)));
  appendNotification(
    character,
    "system",
    matchedRecipe ? "特殊配方鍛造成功" : "鍛造完成",
    matchedRecipe ? `配方「${matchedRecipe.name}」命中！打造出 ${item.name}。` : `${item.name} 已完成強化。`
  );
  await persist();
  return {
    message: matchedRecipe ? `特殊配方命中！打造出 ${item.name}` : `${item.name} 已完成強化`,
    character: toPublicCharacter(character),
    item,
    matchedRecipeName: matchedRecipe?.name || null
  };
}

export async function repairEquipment(userId: string, payload: RepairPayload) {
  const { character } = await findCharacterForUpdate(userId);
  const item =
    payload.source === "equipment" && payload.slot
      ? character.equipmentSlots[payload.slot]
      : character.inventory.find((entry) => entry.id === payload.itemId) || null;
  if (!item || item.maxDurability == null || item.durability == null) throw new Error("這個裝備無法修復。");

  const repairMaterials = Math.ceil((item.maxDurability - item.durability) / 10);
  if (repairMaterials <= 0) throw new Error("這個裝備不需要修復。");
  spendRepairMaterials(character, repairMaterials);

  const wasBroken = item.isBroken;
  item.durability = item.maxDurability;
  item.isBroken = false;
  if (wasBroken && payload.source === "equipment") {
    applyItemBonus(character, item);
  }
  appendNotification(character, "system", "修復完成", `${item.name} 已恢復耐久。`);
  await persist();
  return { message: `${item.name} 修復完成`, character: toPublicCharacter(character), item, repairMaterials };
}

export async function listFactions() {
  const data = await ensureLoaded();
  return data.factions.map((faction) => toFactionSummary(data, faction));
}

export async function getFactionState(userId: string): Promise<FactionState> {
  const data = await ensureLoaded();
  const progressed = processWorldProgress(data);
  processAllSieges(data);
  if (progressed || data.sieges.some((siege) => siege.status === "active" || siege.status === "resolved")) await persist();
  return buildFactionState(data, userId);
}

export async function selectFaction(userId: string, payload: SelectFactionPayload) {
  const { data, character } = await findCharacterForUpdate(userId);
  if (character.factionId) throw new Error("已經加入陣營，若要重選請使用 admin 功能。");
  getFactionById(data, payload.factionId);
  character.factionId = payload.factionId;
  character.currentCastleId =
    data.castles.find((castle) => castle.ownerFactionId === payload.factionId && castle.isCapital)?.id ||
    data.castles.find((castle) => castle.ownerFactionId === payload.factionId)?.id ||
    null;
  appendNotification(character, "faction", "加入陣營", "已加入陣營。");
  await persist();
  return buildFactionState(data, userId);
}

export async function enqueueCastleMove(userId: string, payload: TravelPayload): Promise<FactionActionResult> {
  const { data, character } = await findCharacterForUpdate(userId);
  processWorldProgress(data);
  if (!character.factionId) throw new Error("尚未加入陣營。");
  if (character.movement) throw new Error("角色已在移動中。");
  if (isCharacterBusy(character)) throw new Error("角色忙碌中，不能移動。");
  const targetCastle = data.castles.find((castle) => castle.id === payload.castleId);
  if (!targetCastle) throw new Error("找不到目標城池。");
  if (targetCastle.ownerFactionId !== character.factionId) throw new Error("只能移動到自己陣營的城池。");
  const currentCastle =
    data.castles.find((castle) => castle.id === character.currentCastleId) ||
    data.castles.find((castle) => castle.ownerFactionId === character.factionId && castle.isCapital) ||
    targetCastle;
  if (currentCastle.id === targetCastle.id) throw new Error("角色已經在這座城池。");
  const energyCost = castleTravelEnergyCost(currentCastle, targetCastle);
  if (character.energy < energyCost) throw new Error("精力不足，不能移動。");
  const startedAt = nowIso();
  character.energy = clamp(character.energy - energyCost, 0, character.maxEnergy);
  const faction = getFactionById(data, character.factionId);
  character.movement = {
    fromCastleId: currentCastle.id,
    toCastleId: targetCastle.id,
    startedAt,
    endsAt: new Date(Date.now() + castleTravelDurationMs(currentCastle, targetCastle, faction)).toISOString()
  };
  appendNotification(character, "faction", "城池移動", `正在前往 ${targetCastle.name}。`);
  await persist();
  return {
    message: `正在前往 ${targetCastle.name}`,
    character: toPublicCharacter(character),
    factionState: buildFactionState(data, userId)
  };
}

export async function enqueueCastleBuild(userId: string, payload: BuildFacilityPayload): Promise<FactionActionResult> {
  const { data, character } = await findCharacterForUpdate(userId);
  processWorldProgress(data);
  if (!character.factionId) throw new Error("請先加入陣營。");
  if (isCharacterBusy(character)) throw new Error("角色忙碌中，不能建設。");
  const castle = data.castles.find((entry) => entry.id === payload.castleId);
  if (!castle) throw new Error("找不到城池。");
  if (castle.ownerFactionId !== character.factionId) throw new Error("只能建設自己陣營的城池。");
  if (character.currentCastleId !== castle.id) throw new Error("必須在該城池才能建設。");
  const facilityName = payload.facilityName.trim().slice(0, 20);
  if (!facilityName) throw new Error("請輸入設施名稱。");
  if (castle.facilities.includes(facilityName)) throw new Error("這個設施已存在。");
  if (castle.facilities.length >= castle.buildSlots) throw new Error("建設槽已滿。");
  if (data.factionProjects.some((project) => project.status === "active" && project.castleId === castle.id && project.facilityName === facilityName)) {
    throw new Error("這個設施已經在建設中。");
  }

  const faction = getFactionById(data, character.factionId);
  const cost = buildFacilityCost(castle, faction);
  if (faction.treasury.gold < cost.gold) throw new Error("公庫金幣不足。");
  faction.treasury.gold -= cost.gold;
  const project: FactionProject = {
    id: randomId("project"),
    factionId: faction.id,
    castleId: castle.id,
    kind: "build_facility",
    label: `建設 ${facilityName}`,
    startedAt: nowIso(),
    endsAt: new Date(Date.now() + projectDurationMs("build_facility", faction)).toISOString(),
    contributorUserIds: [userId],
    status: "active",
    facilityName,
    treasuryCost: cost
  };
  data.factionProjects.unshift(project);
  appendNotification(character, "faction", "工程開始", `${project.label} 已開始。`);
  await persist();
  return {
    message: `${project.label} 已開始。`,
    character: toPublicCharacter(character),
    factionState: buildFactionState(data, userId)
  };
}

export async function enqueueCastleRepair(userId: string, payload: RepairCastlePayload): Promise<FactionActionResult> {
  const { data, character } = await findCharacterForUpdate(userId);
  processWorldProgress(data);
  if (!character.factionId) throw new Error("請先加入陣營。");
  const castle = data.castles.find((entry) => entry.id === payload.castleId);
  if (!castle) throw new Error("找不到城池。");
  if (castle.ownerFactionId !== character.factionId) throw new Error("只能修建自己陣營的城池。");
  if (character.currentCastleId !== castle.id) throw new Error("必須在該城池才能修建。");
  if (castle.fortification >= castle.maxFortification) throw new Error("城牆耐久已滿。");
  if (isCharacterBusy(character)) throw new Error("角色忙碌中，不能修建。");
  if (data.factionProjects.some((project) => project.status === "active" && project.castleId === castle.id && project.kind === "repair_castle")) {
    throw new Error("這座城池已經有修建工程。");
  }

  const faction = getFactionById(data, character.factionId);
  const cost = repairCastleCost(castle, faction);
  if (faction.treasury.gold < cost.gold) throw new Error("公庫金幣不足。");
  faction.treasury.gold -= cost.gold;
  const project: FactionProject = {
    id: randomId("project"),
    factionId: faction.id,
    castleId: castle.id,
    kind: "repair_castle",
    label: `修建 ${castle.name} 城防`,
    startedAt: nowIso(),
    endsAt: new Date(Date.now() + projectDurationMs("repair_castle", faction)).toISOString(),
    contributorUserIds: [userId],
    status: "active",
    repairAmount: cost.repairAmount,
    treasuryCost: { gold: cost.gold }
  };
  data.factionProjects.unshift(project);
  appendNotification(character, "faction", "工程開始", `${project.label} 已開始。`);
  await persist();
  return {
    message: `${project.label} 已開始。`,
    character: toPublicCharacter(character),
    factionState: buildFactionState(data, userId)
  };
}

export async function joinFactionProject(userId: string, projectId: string): Promise<FactionActionResult> {
  const { data, character } = await findCharacterForUpdate(userId);
  processWorldProgress(data);
  if (!character.factionId) throw new Error("請先加入陣營。");
  if (isCharacterBusy(character)) throw new Error("角色忙碌中，不能協助工程。");
  const project = data.factionProjects.find((entry) => entry.id === projectId && entry.status === "active");
  if (!project) throw new Error("找不到進行中的工程。");
  if (project.factionId !== character.factionId) throw new Error("不能協助其他陣營的工程。");
  if (character.currentCastleId !== project.castleId) throw new Error("必須在工程所在城池才能協助。");
  if (!project.contributorUserIds.includes(userId)) {
    recalibrateProjectEndsAt(project, project.contributorUserIds.length + 1);
    project.contributorUserIds.push(userId);
  }
  appendNotification(character, "faction", "協助工程", `已協助 ${project.label}。`);
  await persist();
  return {
    message: `已協助 ${project.label}`,
    character: toPublicCharacter(character),
    factionState: buildFactionState(data, userId)
  };
}

export async function leaveFactionProject(userId: string, projectId: string): Promise<FactionActionResult> {
  const { data, character } = await findCharacterForUpdate(userId);
  processWorldProgress(data);
  if (!character.factionId) throw new Error("請先加入陣營。");
  const project = data.factionProjects.find((entry) => entry.id === projectId && entry.status === "active");
  if (!project) throw new Error("找不到進行中的工程。");
  if (!project.contributorUserIds.includes(userId)) throw new Error("你尚未加入這個工程。");
  const nextContributorIds = project.contributorUserIds.filter((entry) => entry !== userId);
  if (nextContributorIds.length === 0) {
    const faction = data.factions.find((entry) => entry.id === project.factionId);
    if (faction) {
      faction.treasury.gold = clamp(faction.treasury.gold + project.treasuryCost.gold, 0, GAME_LIMITS.goldBalance);
    }
    project.status = "cancelled";
  } else {
    recalibrateProjectEndsAt(project, nextContributorIds.length);
    project.contributorUserIds = nextContributorIds;
  }
  appendNotification(character, "faction", "同盟專案", `已退出 ${project.label}`);
  await persist();
  return {
    message: `已退出 ${project.label}`,
    character: toPublicCharacter(character),
    factionState: buildFactionState(data, userId)
  };
}

export async function requestCooperation(userId: string, payload: CooperatePayload) {
  const { data, character, user } = await findCharacterForUpdate(userId);
  if (!character.factionId) throw new Error("請先加入陣營。");
  if (!isFactionLeader(data, userId) && user.role !== "admin") throw new Error("只有陣營領袖或 admin 可以提出合作。");
  const faction = getFactionById(data, character.factionId);
  const target = getFactionById(data, payload.targetFactionId);
  if (faction.id === target.id) throw new Error("不能向自己的陣營提出合作。");
  if (faction.allyIds.includes(target.id)) throw new Error("雙方已經是盟友。");
  if (faction.allyIds.length >= 2 || target.allyIds.length >= 2) throw new Error("任一陣營最多只能維持 2 個盟友。");
  const existing = data.diplomacyRequests.find(
    (request) =>
      request.status === "pending" &&
      ((request.fromFactionId === faction.id && request.toFactionId === target.id) ||
        (request.fromFactionId === target.id && request.toFactionId === faction.id))
  );
  if (existing) throw new Error("已經有待處理的合作申請。");

  data.diplomacyRequests.unshift({
    id: randomId("dip"),
    fromFactionId: faction.id,
    toFactionId: target.id,
    type: "cooperate",
    status: "pending",
    createdAt: nowIso(),
    respondedAt: null
  });
  await persist();
  return buildFactionState(data, userId);
}

export async function respondCooperation(userId: string, payload: CooperateRespondPayload) {
  const { data, character, user } = await findCharacterForUpdate(userId);
  if (!character.factionId) throw new Error("請先加入陣營。");
  if (!isFactionLeader(data, userId) && user.role !== "admin") throw new Error("只有陣營領袖或 admin 可以回應合作。");
  const request = data.diplomacyRequests.find((entry) => entry.id === payload.requestId);
  if (!request || request.status !== "pending") throw new Error("找不到待處理的合作申請。");
  if (request.toFactionId !== character.factionId && user.role !== "admin") throw new Error("你不能回應其他陣營的合作申請。");

  request.status = payload.accept ? "accepted" : "rejected";
  request.respondedAt = nowIso();
  if (payload.accept) {
    const from = getFactionById(data, request.fromFactionId);
    const to = getFactionById(data, request.toFactionId);
    if (from.allyIds.length >= 2 || to.allyIds.length >= 2) throw new Error("任一陣營最多只能維持 2 個盟友。");
    from.allyIds = Array.from(new Set([...from.allyIds, to.id]));
    to.allyIds = Array.from(new Set([...to.allyIds, from.id]));
  }
  await persist();
  return buildFactionState(data, userId);
}

export async function declareWar(userId: string, payload: DeclareWarPayload) {
  const { data, character, user } = await findCharacterForUpdate(userId);
  if (!character.factionId) throw new Error("請先加入陣營。");
  if (!isFactionLeader(data, userId) && user.role !== "admin") throw new Error("只有陣營領袖或 admin 可以宣戰。");
  const faction = getFactionById(data, character.factionId);
  const target = getFactionById(data, payload.targetFactionId);
  if (faction.id === target.id) throw new Error("不能對自己的陣營宣戰。");
  faction.warTargetIds = Array.from(new Set([...faction.warTargetIds, target.id]));
  await persist();
  return buildFactionState(data, userId);
}

function factionTechLabel(techKey: FactionTechKey) {
  const labels: Record<FactionTechKey, string> = {
    castle: "城建",
    defense: "防禦",
    attack: "攻擊",
    support: "支援",
    offense_speed: "攻城機動"
  };
  return labels[techKey];
}

function factionTechUpgradeCost(level: number) {
  return 120 * (level + 1);
}

export async function upgradeFactionTech(userId: string, payload: FactionTechUpgradePayload) {
  const { data, character, user } = await findCharacterForUpdate(userId);
  if (!character.factionId) throw new Error("請先加入陣營。");
  if (!isFactionLeader(data, userId) && user.role !== "admin") throw new Error("只有陣營領袖或 admin 可以升級科技。");
  const faction = getFactionById(data, character.factionId);
  faction.tech = normalizeFactionTech(faction.tech);
  if (!Object.prototype.hasOwnProperty.call(faction.tech, payload.techKey)) throw new Error("未知的科技項目。");
  const currentLevel = faction.tech[payload.techKey];
  const cost = factionTechUpgradeCost(currentLevel);
  if (faction.treasury.gold < cost) throw new Error("公庫金幣不足。");

  faction.treasury.gold -= cost;
  faction.tech[payload.techKey] = currentLevel + 1;
  for (const member of data.characters.filter((entry) => entry.factionId === faction.id)) {
    appendNotification(member, "faction", "公會科技升級", `${factionTechLabel(payload.techKey)} 已升到 Lv.${currentLevel + 1}。`);
  }
  await persist();
  return buildFactionState(data, userId);
}

export async function listFactionMarket(userId: string) {
  const data = await ensureLoaded();
  return buildFactionState(data, userId).marketListings;
}

export async function createMarketListing(userId: string, payload: MarketListPayload) {
  const { data, character, user } = await findCharacterForUpdate(userId);
  if (!character.factionId) throw new Error("請先加入陣營才能使用玩家市場。");
  const source = character.inventory.find((item) => item.id === payload.itemId);
  if (!source) throw new Error("找不到要上架的物品。");
  const maxQuantity = Math.max(1, source.quantity || 1);
  const price = clampedInt(payload.price, 1, GAME_LIMITS.marketPrice, 0);
  if (price <= 0) throw new Error("上架價格必須大於 0。");
  const quantity = clampedInt(payload.quantity || 1, 1, maxQuantity, 1);
  const removed = removeInventoryQuantity(character, payload.itemId, quantity);
  if (!removed) throw new Error("找不到要上架的物品。");

  data.marketListings.unshift({
    id: randomId("listing"),
    sellerUserId: userId,
    sellerDisplayName: user.displayName,
    sellerCharacterName: character.name,
    factionId: character.factionId,
    quantity,
    price,
    item: normalizeItem(removed),
    createdAt: nowIso()
  });
  await persist();
  return buildFactionState(data, userId);
}

export async function buyMarketListing(userId: string, payload: MarketBuyPayload) {
  const { data, character } = await findCharacterForUpdate(userId);
  if (!character.factionId) throw new Error("請先加入陣營才能使用玩家市場。");
  const index = data.marketListings.findIndex((listing) => listing.id === payload.listingId);
  if (index === -1) throw new Error("找不到市場商品。");
  const listing = data.marketListings[index];
  if (!visibleFactionIds(data, character.factionId).has(listing.factionId)) throw new Error("目前看不到這筆市場商品。");
  if (character.gold < listing.price) throw new Error("金幣不足。");

  const sellerCharacter = data.characters.find((entry) => entry.userId === listing.sellerUserId);
  if (!sellerCharacter) throw new Error("找不到賣家角色。");

  character.gold -= listing.price;
  sellerCharacter.gold += listing.price;
  mergeInventoryStack(character, normalizeItem(listing.item));
  data.marketListings.splice(index, 1);
  appendNotification(sellerCharacter, "faction", "市場售出", `${listing.item.name} 已售出，獲得 ${listing.price} 金幣。`);
  await persist();
  return buildFactionState(data, userId);
}

export async function cancelMarketListing(userId: string, listingId: string) {
  const { data, character } = await findCharacterForUpdate(userId);
  const index = data.marketListings.findIndex((listing) => listing.id === listingId && listing.sellerUserId === userId);
  if (index === -1) throw new Error("找不到可取消的市場商品。");
  const [listing] = data.marketListings.splice(index, 1);
  mergeInventoryStack(character, normalizeItem(listing.item));
  await persist();
  return buildFactionState(data, userId);
}

type InstantBattleConfig = {
  context: "adventure" | "guildBoss" | "worldBoss";
  bossName: string;
  bossHp: number;
  bossAttack: number;
  maxRounds: number;
  rewardGold: number;
  battleExp: number;
  materialType: MaterialType;
  materialQuantity: number;
  scenePurpose?: CastleState["mapNodePurpose"];
  difficulty?: SoloBattleDifficulty;
};

function sceneDifficultyForCastle(castle: CastleState): SoloBattleDifficulty {
  if (castle.mapNodePurpose === "guild_boss") return "elite";
  if (castle.mapNodePurpose === "mining") return castle.layer >= 3 ? "elite" : "hard";
  if (castle.mapNodePurpose === "trade" || castle.mapNodePurpose === "solo_combat") return castle.layer >= 3 ? "hard" : "normal";
  if (castle.mapNodePurpose === "capital") return "normal";
  return castle.layer >= 2 ? "normal" : "easy";
}

function soloDifficultyConfig(difficulty: SoloBattleDifficulty, castle: CastleState, battleLevel = 1): InstantBattleConfig {
  const configs = gameplaySoloDifficulties();
  const config = configs[difficulty] || configs.normal;
  const materialType: MaterialType =
    castle.mapNodePurpose === "mining" ? "silver_ore" : castle.mapNodePurpose === "guild_boss" ? "stardust" : "iron_ore";
  // 敵方與獎勵都跟著戰鬥等級成長，讓挑戰與收益曲線一致
  const levelFactor = Math.max(0, battleLevel - 1);
  return {
    context: "adventure",
    bossName: `${castle.name} ${config.label}探險`,
    bossHp: Math.round((config.hp + castle.layer * 18) * (1 + levelFactor * 0.22 + levelFactor * levelFactor * 0.012)),
    bossAttack: Math.round((config.attack + castle.layer * 3) * (1 + levelFactor * 0.08)),
    maxRounds: 8,
    rewardGold: Math.round((config.gold + castle.layer * 8) * (1 + levelFactor * 0.05)),
    battleExp: Math.round((config.exp + castle.layer * 6) * (1 + levelFactor * 0.1)),
    materialType,
    materialQuantity: config.qty,
    scenePurpose: castle.mapNodePurpose,
    difficulty
  };
}

function adventureEncounter(purpose: CastleState["mapNodePurpose"] = "solo_combat", round: number) {
  const pools: Record<CastleState["mapNodePurpose"], Array<{ name: string; intro: string; hp: number; attack: number }>> = {
    capital: [
      { name: "城門訓練傀儡", intro: "守備教官放出訓練傀儡，測試你的起手節奏。", hp: 0.9, attack: 0.85 },
      { name: "潛入斥候", intro: "城門陰影裡竄出一名潛入斥候。", hp: 1, attack: 1 },
      { name: "失控守城機關", intro: "舊式守城機關突然失控，必須立刻壓制。", hp: 1.1, attack: 1.05 }
    ],
    gathering: [
      { name: "田野野豬群", intro: "農野被野豬群踩亂，牠們正朝補給車衝來。", hp: 0.85, attack: 0.9 },
      { name: "偷糧盜鼠王", intro: "糧倉旁傳來翻箱聲，盜鼠王帶著小怪現身。", hp: 0.95, attack: 0.95 },
      { name: "毒藤寄生獸", intro: "採集點的藤蔓纏上腳踝，寄生獸從土裡鑽出。", hp: 1, attack: 1 }
    ],
    solo_combat: [
      { name: "荒野狼群", intro: "遠處狼嚎回應，荒野狼群從兩側包抄。", hp: 1, attack: 1 },
      { name: "裂谷蠻兵", intro: "裂谷邊的蠻兵敲盾挑釁，逼你正面交戰。", hp: 1.1, attack: 1.08 },
      { name: "遊蕩菁英怪", intro: "道路中央出現遊蕩菁英怪，牠守著一只補給箱。", hp: 1.18, attack: 1.12 }
    ],
    guild_boss: [
      { name: "前哨守衛隊長", intro: "公會前哨的守衛隊長攔下隊伍，要求一對一試煉。", hp: 1.2, attack: 1.12 },
      { name: "爬塔偵察兵", intro: "爬塔偵察兵帶著戰術圖撤退，必須先截住他。", hp: 1.12, attack: 1.18 },
      { name: "儀式護衛", intro: "討伐營周圍的儀式護衛展開防線。", hp: 1.25, attack: 1.15 }
    ],
    mining: [
      { name: "晶化礦獸", intro: "礦壁裂開，晶化礦獸拖著礦脈碎片衝出來。", hp: 1.15, attack: 1.05 },
      { name: "噬礦蟲群", intro: "腳下礦砂塌陷，噬礦蟲群從裂縫中湧出。", hp: 1.05, attack: 1.15 },
      { name: "深層岩殼怪", intro: "深層通道傳來重擊聲，岩殼怪堵住退路。", hp: 1.28, attack: 1.12 }
    ],
    trade: [
      { name: "商路盜匪", intro: "商隊旗幟倒在路邊，盜匪從貨車後現身。", hp: 0.98, attack: 1.05 },
      { name: "走私法師", intro: "走私法師撕開卷軸，準備用幻術拖延你。", hp: 1, attack: 1.12 },
      { name: "攔路破甲兵", intro: "關卡前的破甲兵舉起重槌，企圖打斷你的連擊。", hp: 1.12, attack: 1.1 }
    ]
  };
  const encounter = randomFrom(pools[purpose] || pools.solo_combat);
  const roundScale = 1 + Math.max(0, round - 1) * 0.06;
  return {
    ...encounter,
    hp: encounter.hp * roundScale,
    attack: encounter.attack * roundScale
  };
}

function rollInstantSecondarySkills(character: CharacterProfile, bossName: string, round: number) {
  const events: BattleSpecialEvent[] = [];
  const logs: string[] = [];
  let damageTotal = 0;
  let healingTotal = 0;
  let bossAttackModifier = 1;
  for (const slot of character.secondaryCharacters) {
    if (!slot.characterId || (slot.cooldownUntilTick || 0) > round) continue;
    const definition = gameplaySecondaryCharacterCatalog().find((entry) => entry.id === slot.characterId);
    if (!definition) continue;
    const skills = slot.unlockedSkillIds
      .map((skillId) => gameplaySpecialSkillCatalog().find((entry) => entry.id === skillId))
      .filter((skill): skill is SpecialSkillDefinition => Boolean(skill));
    if (!skills.length) continue;
    const skill = randomFrom(skills);
    const affinity = secondaryAffinity(definition, character.className);
    const equipmentMultiplier = equippedPreferenceMultiplier(character, definition.preferredEquipmentSlots);
    const chance = Math.min(0.86, (skill.baseChance || 0.38) + 0.18 + (slot.level - 1) * 0.025 + (affinity - 1) * 0.14 + (equipmentMultiplier - 1) * 0.08);
    if (Math.random() >= chance) continue;
    const damage = Math.max(
      8,
      Math.round(
        (10 + character.stats.attack + character.stats.technique + Math.floor(character.stats.intelligence * 0.7) + Math.floor(character.stats.luck * 0.5)) *
          (1 + (slot.level - 1) * 0.12) *
          affinity *
          equipmentMultiplier
      )
    );
    const healing = skill.id.includes("healing") || skill.id.includes("rosario") ? Math.max(4, Math.round(character.stats.spirit * 0.7 + slot.level * 2)) : 0;
    const modifier = skill.id.includes("infinity") || skill.id.includes("parry") ? 0.92 : 1;
    slot.lastTriggeredSkillId = skill.id;
    slot.cooldownUntilTick = round + (skill.cooldownTurns || 2);
    damageTotal += damage;
    healingTotal += healing;
    bossAttackModifier *= modifier;
    const logLines = buildSkillLogLines({
      actorName: character.name,
      characterName: definition.name,
      skill,
      targetName: bossName,
      damage,
      healing,
      healingTargetName: character.name
    });
    logs.push(...logLines);
    events.push({
      kind: "secondary_skill",
      actorUserId: character.userId,
      label: skill.name,
      message: logLines.join("\n"),
      impact: {
        damage,
        ...(healing ? { healing } : {}),
        ...(modifier !== 1 ? { bossAttackModifier: modifier } : {})
      }
    });
  }
  return { events, logs, damageTotal, healingTotal, bossAttackModifier };
}

function runInstantBattle(character: CharacterProfile, config: InstantBattleConfig) {
  character.secondaryCharacters.forEach((slot) => {
    slot.cooldownUntilTick = null;
  });
  let bossHp = config.context === "adventure" ? 0 : config.bossHp;
  let currentTargetName = config.bossName;
  let currentAttack = config.bossAttack;
  const battleTypeLabel = config.context === "adventure" ? "探險" : config.context === "guildBoss" ? "公會 Boss" : "世界 Boss";
  const logs: string[] = [`【${battleTypeLabel}】目標：${config.bossName}`, `開戰：${character.name} 進入 ${battleTypeLabel}。`];
  const specialEvents: BattleSpecialEvent[] = [];
  const participant = {
    damageDealt: 0,
    healingDone: 0,
    damageTaken: 0
  };
  let roundCount = 0;
  const adventureSteps = config.context === "adventure" ? 3 + Math.floor(Math.random() * 4) : config.maxRounds;

  for (let round = 1; round <= adventureSteps; round += 1) {
    if (character.hp <= 0) break;
    if (config.context !== "adventure" && bossHp <= 0) break;
    if (config.context === "adventure" && bossHp <= 0) {
      const encounter = adventureEncounter(config.scenePurpose, round);
      currentTargetName = encounter.name;
      currentAttack = Math.round(config.bossAttack * encounter.attack);
      bossHp = Math.round((config.bossHp + round * 14) * encounter.hp);
      const difficultyName = ({ easy: "簡單", normal: "普通", hard: "困難", elite: "菁英" } as Record<SoloBattleDifficulty, string>)[config.difficulty || "normal"];
      logs.push(`第 ${round} 步：${encounter.intro}`);
      logs.push(`遭遇 ${currentTargetName}，場景難度 ${difficultyName}，HP ${bossHp}。`);
      if (round > 1 && Math.random() < 0.28) {
        const recovered = Math.max(2, Math.round(character.stats.spirit / 2));
        character.hp = clamp(character.hp + recovered, 0, character.maxHp);
        logs.push(`場景事件：找到短暫補給，回復 ${recovered} HP。`);
      }
    }
    roundCount = round;
    if (config.context === "adventure") {
      logs.push(`第 ${round} 步交戰：${currentTargetName} 剩餘 ${bossHp} HP。`);
    } else {
      logs.push(`第 ${round} 回合：${config.bossName} 仍有 ${bossHp} HP。`);
    }
    // 精神回魔、體力回精力，支撐連擊持久度
    character.mp = clamp(character.mp + Math.floor(character.stats.spirit / 6), 0, character.maxMp);
    character.energy = clamp(character.energy + Math.floor(character.stats.vitality / 8), 0, character.maxEnergy);

    const usesMp = character.className === "mage";
    const combo = resolveComboAttack({
      actorUserId: character.userId,
      actorName: character.name,
      className: character.className,
      targetName: currentTargetName,
      stats: character.stats,
      battleLevel: Math.max(1, character.battleLevel || 1),
      baseDamage: comboBaseDamageFor(character.className, character.stats, Math.max(1, character.battleLevel || 1)),
      availableResource: usesMp ? character.mp : character.energy
    });
    if (usesMp) {
      character.mp = clamp(character.mp - combo.resourceSpent, 0, character.maxMp);
    } else {
      character.energy = clamp(character.energy - combo.resourceSpent, 0, character.maxEnergy);
    }
    bossHp = Math.max(0, bossHp - combo.totalDamage);
    participant.damageDealt += combo.totalDamage;
    logs.push(...combo.logs);
    specialEvents.push(...combo.events);

    const attackEvents = rollAttackSpecialEvents({
      actorUserId: character.userId,
      actorName: character.name,
      bossName: currentTargetName,
      stats: character.stats,
      baseDamage: combo.totalDamage
    });
    if (attackEvents.extraDamage > 0) {
      bossHp = Math.max(0, bossHp - attackEvents.extraDamage);
      participant.damageDealt += attackEvents.extraDamage;
    }
    if (attackEvents.supportHealing > 0) {
      character.hp = clamp(character.hp + attackEvents.supportHealing, 0, character.maxHp);
      participant.healingDone += attackEvents.supportHealing;
    }
    specialEvents.push(...attackEvents.events);
    logs.push(...attackEvents.events.map((event) => event.message));

    const secondaryEvents = rollInstantSecondarySkills(character, currentTargetName, round);
    if (secondaryEvents.damageTotal > 0) {
      bossHp = Math.max(0, bossHp - secondaryEvents.damageTotal);
      participant.damageDealt += secondaryEvents.damageTotal;
    }
    if (secondaryEvents.healingTotal > 0) {
      character.hp = clamp(character.hp + secondaryEvents.healingTotal, 0, character.maxHp);
      participant.healingDone += secondaryEvents.healingTotal;
    }
    specialEvents.push(...secondaryEvents.events);
    logs.push(...secondaryEvents.logs);

    if (bossHp <= 0) {
      if (config.context === "adventure") {
        logs.push(`第 ${round} 步：擊倒 ${currentTargetName}，隊伍繼續前進。`);
        continue;
      }
      break;
    }

    const bossCounter = rollBossCounterEvent({
      bossName: currentTargetName,
      tick: round,
      livingCount: 1,
      attackPower: currentAttack
    });
    if (bossCounter) {
      specialEvents.push(bossCounter);
      logs.push(bossCounter.message);
    }

    const incomingRaw = Math.round(
      (currentAttack + round * 2 + (bossCounter?.impact.damage || 0)) *
        (attackEvents.bossAttackModifier || 1) *
        secondaryEvents.bossAttackModifier *
        combo.bossAttackModifier
    );
    const incoming = mitigateIncomingDamage(incomingRaw, character.stats);
    const dodge = rollDangerDodge({
      actorUserId: character.userId,
      actorName: character.name,
      stats: character.stats,
      hpRatio: character.hp / character.maxHp,
      incomingDamage: incoming
    });
    const damage = Math.max(1, incoming - dodge.damageReduction);
    if (dodge.event) {
      specialEvents.push(dodge.event);
      logs.push(dodge.event.message);
    }
    character.hp = clamp(character.hp - damage, 0, character.maxHp);
    character.mp = clamp(character.mp - Math.ceil(damage / 4), 0, character.maxMp);
    character.energy = clamp(character.energy - 4, 0, character.maxEnergy);
    participant.damageTaken += damage;
    logs.push(`${currentTargetName} 反擊 ${character.name}，造成 ${damage} 點傷害。`);
  }

  const won = config.context === "adventure" ? character.hp > 0 && roundCount >= adventureSteps : bossHp <= 0;
  if (specialEvents.length > 0) {
    const eventCounts = specialEvents.reduce<Record<string, number>>((counts, event) => {
      counts[event.label] = (counts[event.label] || 0) + 1;
      return counts;
    }, {});
    logs.push(`特殊事件 ${specialEvents.length} 次：${Object.entries(eventCounts).map(([label, count]) => `${label} x${count}`).join("、")}`);
  } else {
    logs.push("特殊事件：本場沒有觸發特殊事件。");
  }
  logs.push(won ? (config.context === "adventure" ? `${config.bossName} 探險完成，取得勝利。` : `${config.bossName} 已被擊敗，取得勝利。`) : `${character.name} 戰敗，等待下次挑戰。`);
  return {
    won,
    logs,
    specialEvents,
    participant,
    roundCount,
    remainingBossHp: bossHp
  };
}

export async function startAdventureBattle(userId: string, payload: AdventureBattlePayload): Promise<AdventureBattleResult> {
  const { data, character } = await findCharacterForUpdate(userId);
  processWorldProgress(data);
  if (isCharacterBusy(character)) throw new Error("角色正在忙碌中，無法開始探險。");
  if (!character.factionId) throw new Error("請先加入陣營。");
  const castle = data.castles.find((entry) => entry.id === payload.mapNodeId);
  if (!castle) throw new Error("找不到探險場景。");
  if (castle.ownerFactionId !== character.factionId) throw new Error("只能在自己陣營的場景探險。");

  const config = soloDifficultyConfig(sceneDifficultyForCastle(castle), castle, Math.max(1, character.battleLevel || 1));
  const result = runInstantBattle(character, config);
  const materialQuantity = result.won ? config.materialQuantity : Math.max(1, Math.floor(config.materialQuantity / 2));
  // 運氣提高金幣繳獲
  const luckBonus = 1 + Math.max(0, character.stats.luck) * 0.004;
  const gold = Math.round((result.won ? config.rewardGold : config.rewardGold * 0.25) * luckBonus);
  const battleExp = result.won ? config.battleExp : Math.floor(config.battleExp * 0.4);
  character.gold = clamp(character.gold + gold, 0, GAME_LIMITS.goldBalance);
  mergeInventoryStack(character, createMaterialItem(config.materialType, materialQuantity));
  awardBattleExperience(character, battleExp);
  damageEquippedForBattle(character, result.participant.damageTaken > 0);
  appendNotification(character, "battle", "個人戰鬥", `獲得 ${gold} 金幣、${materialName(config.materialType)} x${materialQuantity}、戰鬥經驗 ${battleExp}。`);

  const record: BattleRecordSummary = {
    id: randomId("battle"),
    roomId: randomId("solo"),
    bossName: config.bossName,
    winner: result.won ? "players" : "boss",
    durationMs: result.roundCount * 1000,
    totalTicks: result.roundCount,
    createdAt: nowIso(),
    battleContext: "adventure",
    battleKind: "adventure",
    castleId: castle.id,
    participants: [
      {
        userId: character.userId,
        displayName: character.name,
        className: character.className,
        damageDealt: result.participant.damageDealt,
        healingDone: result.participant.healingDone,
        damageTaken: result.participant.damageTaken
      }
    ],
    logs: result.logs
  };
  await recordBattle(record);
  await persist();
  return {
    message: result.won ? `${config.bossName} 探險成功` : `${config.bossName} 探險失敗，請恢復後再試`,
    character: toPublicCharacter(character),
    battleRecord: record,
    rewards: { gold, battleExp, materialType: config.materialType, materialQuantity }
  };
}

export async function startSoloBattle(userId: string, payload: SoloBattlePayload): Promise<SoloBattleResult> {
  return startAdventureBattle(userId, payload);
}

export async function startFactionTowerBattle(userId: string, payload: FactionTowerBattlePayload): Promise<FactionTowerBattleResult> {
  const { data, character } = await findCharacterForUpdate(userId);
  processWorldProgress(data);
  if (isCharacterBusy(character)) throw new Error("角色正在忙碌中，無法挑戰公會 Boss。");
  if (!character.factionId) throw new Error("請先加入陣營。");
  const faction = getFactionById(data, character.factionId);
  faction.tower = normalizeFactionTower(faction.tower, faction.name);
  const castle =
    data.castles.find((entry) => entry.id === payload.castleId) ||
    data.castles.find((entry) => entry.ownerFactionId === faction.id && entry.mapNodePurpose === "guild_boss");
  if (!castle) throw new Error("找不到公會 Boss 場景。");
  if (castle.ownerFactionId !== faction.id) throw new Error("只能在自己陣營的公會 Boss 據點挑戰。");

  const isBoss = payload.mode === "boss";
  const layer = faction.tower.currentLayer;
  const towerLevelFactor = 1 + Math.max(0, (character.battleLevel || 1) - 1) * 0.16;
  const config: InstantBattleConfig = {
    context: "guildBoss",
    bossName: isBoss ? `${faction.name} 第 ${layer} 層 ${faction.tower.bossName}` : `${castle.name} 公會 Boss 準備戰`,
    bossHp: Math.round((isBoss ? faction.tower.bossHp + layer * 60 : 130 + layer * 20) * towerLevelFactor),
    bossAttack: Math.round((isBoss ? 24 + layer * 4 : 16 + layer * 2) * (1 + Math.max(0, (character.battleLevel || 1) - 1) * 0.05)),
    maxRounds: isBoss ? 10 : 7,
    rewardGold: Math.round((isBoss ? 140 + layer * 35 : 45 + layer * 10) * towerLevelFactor),
    battleExp: Math.round((isBoss ? 80 + layer * 18 : 30 + layer * 8) * towerLevelFactor),
    materialType: isBoss ? "stardust" : "iron_ore",
    materialQuantity: isBoss ? 2 : 1
  };
  const result = runInstantBattle(character, config);
  const personalGold = result.won ? Math.floor(config.rewardGold * 0.35) : Math.floor(config.rewardGold * 0.1);
  const guildGold = result.won ? config.rewardGold : Math.floor(config.rewardGold * 0.25);
  const battleExp = result.won ? config.battleExp : Math.floor(config.battleExp * 0.35);
  character.gold = clamp(character.gold + personalGold, 0, GAME_LIMITS.goldBalance);
  mergeInventoryStack(character, createMaterialItem(config.materialType, result.won ? config.materialQuantity : 1));
  awardBattleExperience(character, battleExp);
  faction.treasury.gold = clamp(faction.treasury.gold + guildGold, 0, GAME_LIMITS.goldBalance);
  if (isBoss && result.won) {
    faction.tower.highestClearedLayer = Math.max(faction.tower.highestClearedLayer, layer);
    faction.tower.currentLayer = layer + 1;
    faction.tower.progress = 0;
    faction.tower.bossName = `${faction.name} 第 ${layer + 1} 層守將`;
    faction.tower.bossHp = 260 + (layer + 1) * 55;
  } else if (!isBoss && result.won) {
    faction.tower.progress = clamp(faction.tower.progress + 20, 0, 100);
  }
  appendNotification(character, "battle", "公會戰鬥", `公庫獲得 ${guildGold} 金幣，個人獲得 ${personalGold} 金幣與戰鬥經驗 ${battleExp}。`);

  const record: BattleRecordSummary = {
    id: randomId("battle"),
    roomId: randomId("guild"),
    bossName: config.bossName,
    winner: result.won ? "players" : "boss",
    durationMs: result.roundCount * 1000,
    totalTicks: result.roundCount,
    createdAt: nowIso(),
    battleContext: "guildBoss",
    battleKind: "guildBoss",
    castleId: castle.id,
    targetFactionId: faction.id,
    participants: [
      {
        userId: character.userId,
        displayName: character.name,
        className: character.className,
        damageDealt: result.participant.damageDealt,
        healingDone: result.participant.healingDone,
        damageTaken: result.participant.damageTaken
      }
    ],
    logs: result.logs
  };
  await recordBattle(record);
  await persist();
  return {
    message: result.won ? `${config.bossName} 討伐成功` : `${config.bossName} 討伐失敗`,
    character: toPublicCharacter(character),
    factionState: buildFactionState(data, userId),
    battleRecord: record
  };
}

export async function getWorldBossState(): Promise<WorldBossStateResult> {
  const data = await ensureLoaded();
  data.worldBoss = normalizeWorldBoss(data.worldBoss);
  return { worldBoss: data.worldBoss };
}

export async function challengeWorldBoss(userId: string): Promise<WorldBossChallengeResult> {
  const { data, character } = await findCharacterForUpdate(userId);
  processWorldProgress(data);
  if (isCharacterBusy(character)) throw new Error("角色正在忙碌中，無法挑戰世界 Boss。");
  if (!character.factionId) throw new Error("請先加入陣營。");
  const faction = getFactionById(data, character.factionId);
  data.worldBoss = normalizeWorldBoss(data.worldBoss);
  const worldBoss = data.worldBoss;
  const config: InstantBattleConfig = {
    context: "worldBoss",
    bossName: worldBoss.bossName,
    bossHp: worldBoss.bossHp,
    bossAttack: worldBoss.bossAttack,
    maxRounds: 12,
    rewardGold: worldBoss.rewardGold,
    battleExp: 120,
    materialType: "stardust",
    materialQuantity: Math.max(1, Math.floor(worldBoss.rewardMaterials / 2))
  };
  const result = runInstantBattle(character, config);
  const isFirstWinner = result.won && !worldBoss.winnerFactionId;
  const personalGold = isFirstWinner ? Math.floor(worldBoss.rewardGold * 0.35) : result.won ? 60 : 24;
  const guildGold = isFirstWinner ? worldBoss.rewardGold : result.won ? 80 : 30;
  const materialQuantity = isFirstWinner ? Math.max(1, Math.floor(worldBoss.rewardMaterials / 2)) : 1;
  const battleExp = isFirstWinner ? 120 : result.won ? 70 : 32;

  character.gold = clamp(character.gold + personalGold, 0, GAME_LIMITS.goldBalance);
  mergeInventoryStack(character, createMaterialItem("stardust", materialQuantity));
  awardBattleExperience(character, battleExp);
  faction.treasury.gold = clamp(faction.treasury.gold + guildGold, 0, GAME_LIMITS.goldBalance);
  if (isFirstWinner) {
    worldBoss.winnerFactionId = faction.id;
    worldBoss.rewardClaimed = true;
  }

  const record: BattleRecordSummary = {
    id: randomId("battle"),
    roomId: randomId("world"),
    bossName: worldBoss.bossName,
    winner: result.won ? "players" : "boss",
    durationMs: result.roundCount * 1000,
    totalTicks: result.roundCount,
    createdAt: nowIso(),
    battleContext: "worldBoss",
    battleKind: "worldBoss",
    targetFactionId: faction.id,
    participants: [
      {
        userId: character.userId,
        displayName: character.name,
        className: character.className,
        damageDealt: result.participant.damageDealt,
        healingDone: result.participant.healingDone,
        damageTaken: result.participant.damageTaken
      }
    ],
    logs: [
      `世界 Boss 競賽：${faction.name} 派出 ${character.name} 挑戰 ${worldBoss.bossName}。`,
      ...result.logs,
      isFirstWinner
        ? `${faction.name} 首次擊敗世界 Boss，取得主要資源獎勵。`
        : worldBoss.winnerFactionId === faction.id
          ? `${faction.name} 已經是本輪勝利公會，本次取得追加參與獎。`
          : worldBoss.winnerFactionId
            ? `本輪世界 Boss 已由其他公會率先擊敗，本次取得參與獎。`
            : `本次未能擊敗世界 Boss，取得安慰獎。`,
      `獎勵：個人金幣 ${personalGold}、星砂 x${materialQuantity}、戰鬥經驗 ${battleExp}；公庫金幣 ${guildGold}。`
    ]
  };
  worldBoss.attempts.unshift({
    id: randomId("world_attempt"),
    factionId: faction.id,
    factionName: faction.name,
    characterName: character.name,
    won: result.won,
    damageDealt: result.participant.damageDealt,
    createdAt: record.createdAt,
    battleRecordId: record.id
  });
  worldBoss.attempts = worldBoss.attempts.slice(0, 30);
  appendNotification(character, "battle", "世界 Boss", `個人獲得 ${personalGold} 金幣、星砂 x${materialQuantity}、戰鬥經驗 ${battleExp}。`);
  await recordBattle(record);
  await persist();
  return {
    message: isFirstWinner ? `${faction.name} 率先擊敗世界 Boss` : result.won ? `${worldBoss.bossName} 挑戰成功` : `${worldBoss.bossName} 挑戰失敗`,
    character: toPublicCharacter(character),
    factionState: buildFactionState(data, userId),
    worldBoss,
    battleRecord: record
  };
}

function siegeParticipantFromCharacter(character: CharacterProfile, side: "attack" | "defense"): SiegeParticipant {
  return {
    userId: character.userId,
    characterId: character.id,
    characterName: character.name,
    factionId: character.factionId || "",
    side,
    joinedAt: nowIso(),
    status: "active",
    damageDealt: 0,
    damageTaken: 0,
    energySpent: 0
  };
}

function siegeStatPower(character: CharacterProfile, side: "attack" | "defense", config: GameConfig) {
  const rules = config.statRules;
  const statPower = (Object.keys(character.stats) as CharacterStatKey[]).reduce((total, key) => {
    const value = character.stats[key] || 0;
    const rule = rules[key];
    return total + value * (side === "attack" ? rule.attackPower + rule.siege : rule.defensePower + rule.sustain);
  }, 0);
  return Math.round(character.instinctLevel * 3 + character.battleLevel * 5 + statPower);
}

function facilitySiegeBonus(castle: CastleState) {
  return castle.facilities.reduce(
    (bonus, facility) => {
      if (/箭|塔|砲|炮/i.test(facility)) bonus.autoDefense += 18;
      if (/兵|營|訓/i.test(facility)) bonus.garrison += 12;
      if (/牆|壁|城防|堡/i.test(facility)) bonus.resistance += 8;
      return bonus;
    },
    { autoDefense: 0, garrison: 0, resistance: 0 }
  );
}

function ensureSiegeDefenders(data: StoreData, siege: SiegeBattleState) {
  const castle = data.castles.find((entry) => entry.id === siege.castleId);
  if (!castle) return;
  for (const defender of data.characters.filter((entry) => entry.garrisonAssignment?.castleId === castle.id && entry.factionId === siege.defenderFactionId)) {
    if (!siege.participants.some((participant) => participant.userId === defender.userId && participant.side === "defense")) {
      siege.participants.push(siegeParticipantFromCharacter(defender, "defense"));
    }
  }
}

function applySiegeParticipantCost(character: CharacterProfile, participant: SiegeParticipant, input: { hpLoss: number; mpLoss: number; energyLoss: number }) {
  character.hp = clamp(character.hp - input.hpLoss, 1, character.maxHp);
  character.mp = clamp(character.mp - input.mpLoss, 0, character.maxMp);
  character.energy = clamp(character.energy - input.energyLoss, 0, character.maxEnergy);
  participant.damageTaken += input.hpLoss;
  participant.energySpent += input.energyLoss;
  damageEquippedForBattle(character, input.hpLoss > 0);
  if (character.energy <= 0 || character.hp <= 1) {
    participant.status = character.hp <= 1 ? "downed" : "retreated";
  }
}

function finishSiege(data: StoreData, siege: SiegeBattleState, winnerFactionId: string | null, message: string) {
  if (siege.status === "resolved") return;
  const castle = data.castles.find((entry) => entry.id === siege.castleId);
  siege.status = "resolved";
  siege.winnerFactionId = winnerFactionId;
  if (castle && winnerFactionId === siege.attackerFactionId && castle.fortification <= 0) {
    castle.ownerFactionId = siege.attackerFactionId;
    castle.fortification = castle.maxFortification;
    for (const character of data.characters) {
      if (character.garrisonAssignment?.castleId === castle.id) character.garrisonAssignment = null;
    }
  }
  const record: BattleRecordSummary = {
    id: randomId("battle"),
    roomId: siege.id,
    bossName: castle ? `${castle.name} 攻城戰` : "攻城戰",
    winner: winnerFactionId === siege.attackerFactionId ? "players" : "boss",
    durationMs: Math.max(0, new Date(nowIso()).getTime() - new Date(siege.startedAt).getTime()),
    totalTicks: siege.lastResolvedTick,
    createdAt: nowIso(),
    battleContext: "castle",
    castleId: siege.castleId,
    targetFactionId: siege.defenderFactionId,
    participants: siege.participants.map((participant) => ({
      userId: participant.userId,
      displayName: data.users.find((entry) => entry.id === participant.userId)?.displayName || participant.characterName,
      className: data.characters.find((entry) => entry.userId === participant.userId)?.className || "warrior",
      damageDealt: participant.damageDealt,
      healingDone: 0,
      damageTaken: participant.damageTaken
    })),
    logs: [
      message,
      ...(castle ? [`城池：${castle.name}`, `最終城防：${castle.fortification}/${castle.maxFortification}`] : []),
      ...siege.logs.map((log) => `第 ${log.tick} 輪：${log.message}`)
    ]
  };
  siege.battleRecordId = record.id;
  data.battleRecords.unshift(record);
}

function processSiegeTicks(data: StoreData, siege: SiegeBattleState) {
  if (siege.status === "resolved") return siege;
  const castle = data.castles.find((entry) => entry.id === siege.castleId);
  if (!castle) {
    finishSiege(data, siege, null, "攻城戰因城池不存在而結束。");
    return siege;
  }
  ensureSiegeDefenders(data, siege);
  const rules = data.gameConfig.siegeRules;
  const now = Date.now();
  const startedAt = new Date(siege.startedAt).getTime();
  const endsAt = new Date(siege.endsAt).getTime();
  const dueTicks = Math.min(
    Math.floor((Math.min(now, endsAt) - startedAt) / Math.max(1, rules.tickIntervalSeconds * 1000)),
    Math.ceil((endsAt - startedAt) / Math.max(1, rules.tickIntervalSeconds * 1000))
  );
  for (let tick = siege.lastResolvedTick + 1; tick <= dueTicks && siege.status === "active"; tick += 1) {
    const activeAttackers = siege.participants.filter((participant) => participant.side === "attack" && participant.status === "active");
    if (activeAttackers.length === 0) {
      finishSiege(data, siege, siege.defenderFactionId, "攻方無可戰鬥成員，守方守住城池。");
      break;
    }
    const activeDefenders = siege.participants.filter((participant) => participant.side === "defense" && participant.status === "active");
    const facilityBonus = facilitySiegeBonus(castle);
    const attackingCharacters = activeAttackers
      .map((participant) => data.characters.find((entry) => entry.userId === participant.userId))
      .filter((entry): entry is CharacterProfile => Boolean(entry));
    const defendingCharacters = activeDefenders
      .map((participant) => data.characters.find((entry) => entry.userId === participant.userId))
      .filter((entry): entry is CharacterProfile => Boolean(entry));
    const attackerPower = attackingCharacters.reduce((total, character) => total + siegeStatPower(character, "attack", data.gameConfig), 0);
    const defenderPlayerPower = defendingCharacters.reduce((total, character) => total + siegeStatPower(character, "defense", data.gameConfig) + facilityBonus.garrison, 0);
    const defenseTechLevel = factionTechLevel(getFactionById(data, siege.defenderFactionId), "defense");
    const autoDefensePower = Math.round(
      (castle.autoDefensePower + facilityBonus.autoDefense + castle.fortification * 0.55 + castle.terrainAdvantage + defenseTechLevel * 10) * rules.autoDefenseScaling
    );
    const defenderPower = Math.round(defenderPlayerPower * rules.defenderTerrainMultiplier + autoDefensePower);
    const brokeDefense = attackerPower * rules.breakthroughMultiplier > defenderPower;
    const resistance = castle.siegeResistance + facilityBonus.resistance;
    const fortificationDamage = brokeDefense
      ? Math.max(rules.minorFortificationDamage, Math.floor((attackerPower * rules.breakthroughMultiplier - defenderPower) / 18) + rules.minorFortificationDamage - Math.floor(resistance / 10))
      : Math.max(0, rules.minorFortificationDamage - Math.floor(resistance / 18));
    let attackerEnergySpent = 0;
    let turretDamageTotal = 0;
    // 自動砲臺：城防工事獨立輸出，無人駐守時城池靠它磨死攻方；城牆越殘破火力越弱
    const turretPower = Math.round(
      (castle.autoDefensePower + facilityBonus.autoDefense + castle.fortification * 0.4 + defenseTechLevel * 8) * rules.autoDefenseScaling
    );
    const retreatedUserIds: string[] = [];
    for (const participant of activeAttackers) {
      const character = data.characters.find((entry) => entry.userId === participant.userId);
      if (!character) continue;
      const energyLoss = Math.max(1, rules.baseEnergyCost - Math.floor((character.stats.vitality + character.stats.tenacity) / 12));
      const turretDamage = Math.max(
        activeDefenders.length === 0 ? 2 : 0,
        Math.floor(turretPower / (6 + activeAttackers.length * 3)) - Math.floor((character.stats.defense + character.stats.tenacity) / 6)
      );
      const meleePressure = Math.floor((defenderPlayerPower * rules.defenderTerrainMultiplier) / Math.max(20, activeAttackers.length * 32));
      const hpLoss = Math.max(1, meleePressure - Math.floor((character.stats.defense + character.stats.tenacity) / 9) + turretDamage);
      const mpLoss = Math.max(0, Math.floor(autoDefensePower / 45) - Math.floor(character.stats.spirit / 12));
      applySiegeParticipantCost(character, participant, { hpLoss, mpLoss, energyLoss });
      attackerEnergySpent += energyLoss;
      turretDamageTotal += turretDamage;
      participant.damageDealt += Math.max(1, Math.floor(attackerPower / Math.max(1, activeAttackers.length * 6)));
      if (participant.status !== "active") retreatedUserIds.push(participant.userId);
    }
    const turretDamageAverage = Math.round(turretDamageTotal / Math.max(1, activeAttackers.length));
    for (const participant of activeDefenders) {
      const character = data.characters.find((entry) => entry.userId === participant.userId);
      if (!character) continue;
      const hpLoss = Math.max(1, Math.floor(attackerPower / Math.max(24, activeDefenders.length * 42)) - Math.floor((character.stats.defense + character.stats.tenacity) / 8));
      const mpLoss = Math.max(0, Math.floor(attackerPower / 120) - Math.floor(character.stats.spirit / 14));
      applySiegeParticipantCost(character, participant, { hpLoss, mpLoss, energyLoss: Math.max(1, Math.floor(rules.baseEnergyCost / 2)) });
      participant.damageDealt += Math.max(1, Math.floor(defenderPlayerPower / Math.max(1, activeDefenders.length * 5)));
    }
    castle.fortification = clamp(castle.fortification - fortificationDamage, 0, castle.maxFortification);
    siege.fortificationCurrent = castle.fortification;
    siege.lastResolvedTick = tick;
    siege.logs.push({
      tick,
      createdAt: nowIso(),
      message: `${activeDefenders.length === 0 ? "無人駐守，自動砲臺獨力開火；" : ""}${
        brokeDefense ? `攻方突破守勢，城牆損耗 ${fortificationDamage}` : `守勢穩固，城牆僅損耗 ${fortificationDamage}`
      }；砲臺對每名攻方造成約 ${turretDamageAverage} 點壓制傷害。`,
      attackerPower,
      defenderPower,
      autoDefensePower,
      fortificationDamage,
      attackerEnergySpent,
      retreatedUserIds
    });
    if (castle.fortification <= 0) {
      finishSiege(data, siege, siege.attackerFactionId, `${castle.name} 城防歸零，攻方佔領城池。`);
    }
  }
  if (siege.status === "active" && now >= endsAt) {
    finishSiege(data, siege, siege.defenderFactionId, `${castle.name} 撐過攻城時間，守方守住城池。`);
  }
  return siege;
}

function processAllSieges(data: StoreData) {
  for (const siege of data.sieges) processSiegeTicks(data, siege);
}

export async function garrisonCastle(userId: string, castleId: string): Promise<FactionActionResult> {
  const { data, character } = await findCharacterForUpdate(userId);
  if (!character.factionId) throw new Error("請先加入陣營。");
  if (character.actionQueue.items.length > 0 || character.movement) throw new Error("角色目前忙碌中，不能駐防。");
  const castle = data.castles.find((entry) => entry.id === castleId);
  if (!castle) throw new Error("找不到城池。");
  if (castle.ownerFactionId !== character.factionId) throw new Error("只能駐防我方城池。");
  if (character.currentCastleId !== castle.id) throw new Error("必須在目前所在城池才能駐防。");
  const garrisonCount = data.characters.filter((entry) => entry.garrisonAssignment?.castleId === castle.id).length;
  if (garrisonCount >= castle.garrisonSlots) throw new Error("此城池駐防名額已滿。");
  character.garrisonAssignment = { castleId: castle.id, startedAt: nowIso() };
  await persist();
  return { message: `${character.name} 已駐防 ${castle.name}`, character: toPublicCharacter(character), factionState: buildFactionState(data, userId) };
}

export async function leaveGarrison(userId: string, castleId: string): Promise<FactionActionResult> {
  const { data, character } = await findCharacterForUpdate(userId);
  if (character.garrisonAssignment?.castleId !== castleId) throw new Error("角色目前沒有駐防此城池。");
  processAllSieges(data);
  const activeSiege = data.sieges.find((siege) => siege.status === "active" && siege.castleId === castleId);
  if (activeSiege) throw new Error("攻城戰進行中，不能退出駐防。");
  character.garrisonAssignment = null;
  await persist();
  return { message: `${character.name} 已退出駐防`, character: toPublicCharacter(character), factionState: buildFactionState(data, userId) };
}

export async function startCastleSiege(userId: string, castleId: string): Promise<FactionState> {
  const { data, character } = await findCharacterForUpdate(userId);
  processAllSieges(data);
  if (!character.factionId) throw new Error("請先加入陣營。");
  if (isCharacterBusy(character)) throw new Error("角色正在忙碌中，無法攻城。");
  if (character.energy < data.gameConfig.siegeRules.minAttackerEnergy) throw new Error("精力不足，無法發起攻城。");
  const castle = data.castles.find((entry) => entry.id === castleId);
  if (!castle) throw new Error("找不到目標城池。");
  if (castle.ownerFactionId === character.factionId) throw new Error("不能攻擊自己的城池。");
  const myFaction = getFactionById(data, character.factionId);
  if (myFaction.allyIds.includes(castle.ownerFactionId)) throw new Error("不能攻擊盟友城池。");
  const existing = data.sieges.find((siege) => siege.status === "active" && siege.castleId === castle.id);
  if (existing) throw new Error("此城池已在攻城戰中。");
  const startedAt = nowIso();
  const siege: SiegeBattleState = {
    id: randomId("siege"),
    castleId: castle.id,
    attackerFactionId: character.factionId,
    defenderFactionId: castle.ownerFactionId,
    status: "active",
    startedAt,
    endsAt: new Date(Date.now() + data.gameConfig.siegeRules.durationMinutes * 60 * 1000).toISOString(),
    lastResolvedTick: 0,
    participants: [siegeParticipantFromCharacter(character, "attack")],
    logs: [],
    fortificationStart: castle.fortification,
    fortificationCurrent: castle.fortification,
    winnerFactionId: null,
    battleRecordId: null
  };
  ensureSiegeDefenders(data, siege);
  data.sieges.unshift(siege);
  await persist();
  return buildFactionState(data, userId);
}

export async function joinCastleSiege(userId: string, siegeId: string): Promise<FactionActionResult> {
  const { data, character } = await findCharacterForUpdate(userId);
  processAllSieges(data);
  if (!character.factionId) throw new Error("請先加入陣營。");
  if (isCharacterBusy(character)) throw new Error("角色正在忙碌中，無法加入攻城戰。");
  const siege = data.sieges.find((entry) => entry.id === siegeId);
  if (!siege || siege.status !== "active") throw new Error("找不到進行中的攻城戰。");
  const side = character.factionId === siege.attackerFactionId ? "attack" : character.factionId === siege.defenderFactionId ? "defense" : null;
  if (!side) throw new Error("只有攻守雙方陣營可加入此戰場。");
  if (siege.participants.some((participant) => participant.userId === userId)) throw new Error("已在此攻城戰中。");
  siege.participants.push(siegeParticipantFromCharacter(character, side));
  await persist();
  return { message: `${character.name} 已加入攻城戰`, character: toPublicCharacter(character), factionState: buildFactionState(data, userId) };
}

export async function resolveCastleSiege(userId: string, siegeId: string): Promise<FactionState> {
  const data = await ensureLoaded();
  const character = data.characters.find((entry) => entry.userId === userId);
  if (!character?.factionId) throw new Error("請先加入陣營。");
  const siege = data.sieges.find((entry) => entry.id === siegeId);
  if (!siege) throw new Error("找不到攻城戰。");
  if (character.factionId !== siege.attackerFactionId && character.factionId !== siege.defenderFactionId) throw new Error("只有攻守雙方可結算此戰場。");
  processSiegeTicks(data, siege);
  await persist();
  return buildFactionState(data, userId);
}

export async function attackCastle(userId: string, castleId: string, participantUserIds: string[] = [userId]): Promise<AttackCastleResult> {
  const { data, character } = await findCharacterForUpdate(userId);
  if (!character.factionId) throw new Error("請先加入陣營。");
  if (isCharacterBusy(character)) throw new Error("角色正在忙碌中，無法攻城。");
  const castle = data.castles.find((entry) => entry.id === castleId);
  if (!castle) throw new Error("找不到目標城池。");
  if (castle.ownerFactionId === character.factionId) throw new Error("不能攻擊自己的城池。");
  const targetFactionId = castle.ownerFactionId;
  const myFaction = getFactionById(data, character.factionId);
  if (myFaction.allyIds.includes(targetFactionId)) throw new Error("不能攻擊盟友城池。");

  const participants = Array.from(new Set(participantUserIds.length > 0 ? participantUserIds : [userId]))
    .map((participantUserId) => {
      const participant = data.characters.find((entry) => entry.userId === participantUserId);
      if (!participant) throw new Error("找不到參戰角色。");
      if (participant.factionId !== character.factionId) throw new Error("只能帶同陣營成員攻城。");
      if (isCharacterBusy(participant)) throw new Error(`${participant.name} 正在忙碌中，無法攻城。`);
      return participant;
    });

  const warBonus = myFaction.warTargetIds.includes(targetFactionId) ? 1.15 : 1;
  const bossSkill = randomFrom(castle.bossSkills.length > 0 ? castle.bossSkills : ["重擊"]);
  const bossHpModifier = bossSkill.includes("防禦姿態") || bossSkill.includes("士氣重整") || bossSkill.includes("壁壘反擊") ? 1.15 : 1;
  const bossAttackModifier = bossSkill.includes("重擊") || bossSkill.includes("統領號令") || bossSkill.includes("破甲") ? 1.2 : 1;
  const bossHp = Math.round((castle.isCapital ? castle.bossHp * 1.25 : castle.bossHp) * bossHpModifier);
  const bossAttack = Math.round((castle.isCapital ? castle.bossAttack * 1.25 : castle.bossAttack) * bossAttackModifier);
  const rawPower = participants.reduce(
    (total, participant) =>
      total +
      participant.instinctLevel * 6 +
      participant.battleLevel * 5 +
      participant.stats.attack * 3 +
      participant.stats.defense * 2 +
      participant.stats.intelligence * 2 +
      participant.stats.technique * 2 +
      participant.stats.luck +
      participant.stats.tenacity,
    0
  );
  const attackTechLevel = factionTechLevel(myFaction, "attack");
  const power = Math.round(rawPower * warBonus * (1 + attackTechLevel * 0.04));
  const defenseScore = bossHp + bossAttack * 8;
  const won = power + Math.floor(Math.random() * 80) >= defenseScore;
  const defendingFaction = data.factions.find((entry) => entry.id === targetFactionId);
  const defenseTechLevel = defendingFaction ? factionTechLevel(defendingFaction, "defense") : 0;
  const siegeDamage = Math.max(10, 25 - defenseTechLevel * 2);
  const participantResults = participants.map((participant) => {
    const hpLoss = Math.min(participant.hp - 1, Math.max(4, Math.floor(bossAttack / 2) - Math.floor(participant.stats.tenacity / 3)));
    const mpLoss = Math.min(participant.mp, Math.max(6, Math.floor(bossAttack / 3)));
    const energyLoss = Math.min(participant.energy, 12);
    participant.hp = clamp(participant.hp - Math.max(0, hpLoss), 1, participant.maxHp);
    participant.mp = clamp(participant.mp - mpLoss, 0, participant.maxMp);
    participant.energy = clamp(participant.energy - energyLoss, 0, participant.maxEnergy);
    damageEquippedForBattle(participant, hpLoss > 0);
    return { participant, hpLoss, mpLoss, energyLoss };
  });
  const castleSpecialEvents: BattleSpecialEvent[] = [];
  const specialDamageByUser = new Map<string, number>();
  for (const participant of participants) {
    const baseDamage = Math.max(10, Math.floor(power / Math.max(1, participants.length * 4)));
    const special = rollAttackSpecialEvents({
      actorUserId: participant.userId,
      actorName: participant.name,
      bossName: castle.bossName,
      stats: participant.stats,
      baseDamage
    });
    castleSpecialEvents.push(...special.events);
    specialDamageByUser.set(participant.userId, special.extraDamage);
  }

  if (won) {
    castle.fortification -= siegeDamage;
    myFaction.treasury.gold = clamp(myFaction.treasury.gold + castle.rewardGold, 0, GAME_LIMITS.goldBalance);
    for (const participant of participants) {
      const personalGold = 16 + castle.layer * 8 + (castle.specialty === "boss" ? 16 : 0);
      const materialType: MaterialType = castle.specialty === "mining" ? "silver_ore" : castle.specialty === "boss" ? "stardust" : "iron_ore";
      participant.gold = clamp(participant.gold + personalGold, 0, GAME_LIMITS.goldBalance);
      mergeInventoryStack(participant, createMaterialItem(materialType, castle.specialty === "boss" ? 2 : 1));
      appendNotification(participant, "battle", "攻城獎勵", `獲得 ${personalGold} 金幣、${materialName(materialType)} x${castle.specialty === "boss" ? 2 : 1}。`);
    }
  }
  if (won && castle.fortification <= 0) {
    castle.ownerFactionId = character.factionId;
    castle.fortification = castle.maxFortification;
  } else {
    castle.fortification = clamp(castle.fortification, 0, castle.maxFortification);
  }

  const record: BattleRecordSummary = {
    id: randomId("battle"),
    roomId: randomId("castle"),
    bossName: castle.bossName,
    winner: won ? "players" : "boss",
    durationMs: 0,
    totalTicks: 1,
    createdAt: nowIso(),
    battleContext: "castle",
    castleId: castle.id,
    targetFactionId,
    participants: participantResults.map(({ participant, hpLoss }, index) => ({
      userId: participant.userId,
      displayName: data.users.find((entry) => entry.id === participant.userId)?.displayName || participant.name,
      className: participant.className,
      damageDealt:
        (won ? Math.floor(bossHp / participantResults.length) : Math.floor(power / Math.max(6, participantResults.length * 6)) + index) +
        (specialDamageByUser.get(participant.userId) || 0),
      healingDone: 0,
      damageTaken: hpLoss
    })),
    logs: [
      `攻城目標：${castle.name} / ${castle.bossName}`,
      `守城 Boss 技能：${bossSkill}`,
      `攻城隊伍：${participantResults.map((result) => result.participant.name).join("、")}`,
      `獎勵摘要：${castle.rewardSummary}`,
      ...castleSpecialEvents.map((event) => event.message),
      `攻城結果：${won ? "勝利" : "失敗"}`,
      `造成傷害：${won ? bossHp : Math.floor(power / 6)}`,
      `參戰人數：${participantResults.length}`,
      `總承受傷害：${participantResults.reduce((total, result) => total + result.hpLoss, 0)}`,
      `消耗 MP ${participantResults.reduce((total, result) => total + result.mpLoss, 0)}、精力 ${participantResults.reduce((total, result) => total + result.energyLoss, 0)}`
    ]
  };
  await recordBattle(record);
  await persist();

  return {
    message: won ? `${castle.name} 攻略成功` : `${castle.name} 攻略失敗`,
    castle,
    factionState: buildFactionState(data, userId),
    battleRecord: record
  };
}

export async function getAdminState(): Promise<AdminState> {
  const data = await ensureLoaded();
  return {
    classes: data.classConfigs,
    factions: data.factions.map((faction) => toFactionSummary(data, faction)),
    castles: data.castles,
    dailyRewardConfig: data.dailyRewardConfig,
    flashEventConfig: data.flashEventConfig,
    resourceTypes: materialCatalog().map((entry) => ({ type: entry.type, name: entry.name }))
  };
}

function buildAdminGameConfigResponse(data: StoreData): AdminGameConfigResponse {
  return {
    gameConfig: data.gameConfig,
    classes: data.classConfigs,
    rewards: {
      dailyRewardConfig: data.dailyRewardConfig,
      flashEventConfig: data.flashEventConfig
    },
    castles: data.castles,
    factions: data.factions.map((faction) => toFactionSummary(data, faction)),
    announcements: data.announcements
  };
}

function assertCastleOwners(castles: CastleState[], factions: StoredFaction[]) {
  const factionIds = new Set(factions.map((faction) => faction.id));
  for (const castle of castles) {
    if (!castle.id) throw new Error("城池 id 不可空白。");
    if (!factionIds.has(castle.ownerFactionId)) throw new Error(`${castle.name || castle.id} 的 ownerFactionId 不存在。`);
  }
}

export async function getAdminGameConfig(): Promise<AdminGameConfigResponse> {
  const data = await ensureLoaded();
  return buildAdminGameConfigResponse(data);
}

export async function adminUpdateGameConfigSection(section: AdminConfigSection, payload: any): Promise<AdminGameConfigResponse> {
  const data = await ensureLoaded();
  if (section === "classes") {
    data.classConfigs = Array.isArray(payload) ? payload.filter((entry) => entry.className && entry.label).map((entry) => ({ className: entry.className, label: String(entry.label), active: Boolean(entry.active) })) : data.classConfigs;
  } else if (section === "specialSkills") {
    data.gameConfig = normalizeGameConfig({ ...data.gameConfig, specialSkills: payload });
  } else if (section === "secondaryCharacters") {
    data.gameConfig = normalizeGameConfig({ ...data.gameConfig, secondaryCharacters: payload });
  } else if (section === "battle") {
    data.gameConfig = normalizeGameConfig({ ...data.gameConfig, soloDifficulties: payload?.soloDifficulties || payload });
  } else if (section === "rewards") {
    if (payload?.dailyRewardConfig) data.dailyRewardConfig = normalizeRewardSchedule(payload.dailyRewardConfig, initialData.dailyRewardConfig);
    if (payload?.flashEventConfig) data.flashEventConfig = normalizeRewardSchedule(payload.flashEventConfig, initialData.flashEventConfig);
  } else if (section === "castles") {
    const castles = Array.isArray(payload) ? payload : data.castles;
    assertCastleOwners(castles, data.factions);
    data.castles = castles;
  } else if (section === "factions") {
    const factions = Array.isArray(payload) ? payload : data.factions;
    data.factions = factions.map((faction: any) => ({
      id: String(faction.id || ""),
      name: String(faction.name || faction.id || ""),
      color: String(faction.color || "#d6ad5d"),
      description: String(faction.description || ""),
      leaderUserId: faction.leaderUserId || null,
      allyIds: Array.isArray(faction.allyIds) ? faction.allyIds : [],
      warTargetIds: Array.isArray(faction.warTargetIds) ? faction.warTargetIds : [],
      treasury: faction.treasury || { gold: 0, materials: 0 },
      tech: faction.tech || defaultFactionTech(),
      tower: normalizeFactionTower(faction.tower || {}, String(faction.name || faction.id || "")),
    }));
    assertCastleOwners(data.castles, data.factions);
  } else if (section === "shop") {
    data.gameConfig = normalizeGameConfig({ ...data.gameConfig, shopItems: payload });
  } else if (section === "forge") {
    data.gameConfig = normalizeGameConfig({ ...data.gameConfig, forgeOptions: payload });
  } else if (section === "siegeRules") {
    data.gameConfig = normalizeGameConfig({ ...data.gameConfig, siegeRules: payload });
  } else if (section === "statRules") {
    data.gameConfig = normalizeGameConfig({ ...data.gameConfig, statRules: payload });
  } else if (section === "announcements") {
    data.announcements = Array.isArray(payload) ? payload : data.announcements;
  }
  data.gameConfig = normalizeGameConfig(data.gameConfig);
  await persist();
  return buildAdminGameConfigResponse(data);
}

export async function adminResetGameConfigSection(section: AdminConfigSection): Promise<AdminGameConfigResponse> {
  const data = await ensureLoaded();
  const defaults = defaultGameConfig();
  if (section === "classes") data.classConfigs = structuredClone(initialData.classConfigs);
  if (section === "specialSkills") data.gameConfig.specialSkills = defaults.specialSkills;
  if (section === "secondaryCharacters") data.gameConfig.secondaryCharacters = defaults.secondaryCharacters;
  if (section === "battle") data.gameConfig.soloDifficulties = defaults.soloDifficulties;
  if (section === "rewards") {
    data.dailyRewardConfig = structuredClone(initialData.dailyRewardConfig);
    data.flashEventConfig = structuredClone(initialData.flashEventConfig);
  }
  if (section === "factions") {
    data.factions = [];
    hydrateFactions(data);
  }
  if (section === "castles") data.castles = seedCastles();
  if (section === "shop") data.gameConfig.shopItems = defaults.shopItems;
  if (section === "forge") data.gameConfig.forgeOptions = defaults.forgeOptions;
  if (section === "siegeRules") data.gameConfig.siegeRules = defaults.siegeRules;
  if (section === "statRules") data.gameConfig.statRules = defaults.statRules;
  if (section === "announcements") data.announcements = [];
  data.gameConfig = normalizeGameConfig(data.gameConfig);
  await persist();
  return buildAdminGameConfigResponse(data);
}

export async function adminListAnnouncements() {
  const data = await ensureLoaded();
  return data.announcements;
}

export async function adminCreateAnnouncement(payload: AdminAnnouncementPayload) {
  const data = await ensureLoaded();
  data.announcements.unshift({
    id: randomId("announcement"),
    title: payload.title.trim(),
    body: payload.body.trim(),
    active: true,
    createdAt: nowIso()
  });
  await persist();
  return data.announcements;
}

export async function adminToggleAnnouncement(payload: AdminAnnouncementTogglePayload) {
  const data = await ensureLoaded();
  const announcement = data.announcements.find((entry) => entry.id === payload.announcementId);
  if (!announcement) throw new Error("找不到公告。");
  announcement.active = payload.active;
  await persist();
  return data.announcements;
}

export async function adminCompleteQueue(payload: AdminCompleteQueuePayload) {
  const target = await resolveCharacterByName(payload.targetCharacterName);
  if (!target) throw new Error("找不到目標角色。");
  const { data, character } = await findCharacterForUpdate(target.userId);
  const now = Date.now() + 10 * 24 * 60 * 60 * 1000;
  for (const item of character.actionQueue.items) {
    item.endsAt = new Date(now).toISOString();
  }
  const result = await processCharacterQueueInternal(data, character, true, now);
  await persist();
  return { character: toPublicCharacter(character), completedActivities: result.completedActivities };
}

export async function adminFillResources(payload: AdminFillResourcesPayload) {
  const target = await resolveCharacterByName(payload.targetCharacterName);
  if (!target) throw new Error("找不到目標角色。");
  const { character } = await findCharacterForUpdate(target.userId);
  character.hp = character.maxHp;
  character.mp = character.maxMp;
  character.energy = character.maxEnergy;
  await persist();
  return toPublicCharacter(character);
}

export async function adminGrantItem(payload: AdminGrantItemPayload) {
  const target = await resolveCharacterByName(payload.targetCharacterName);
  if (!target) throw new Error("找不到目標角色。");
  const { character } = await findCharacterForUpdate(target.userId);
  const item = buildGrantedItem(payload);
  mergeInventoryStack(character, item);
  appendNotification(character, "admin", "管理員發放道具", `${item.name} 已加入背包。`);
  await persist();
  return { character: toPublicCharacter(character), item };
}

export async function adminAdjustResources(payload: AdminAdjustResourcesPayload) {
  const target = await resolveCharacterByName(payload.targetCharacterName);
  if (!target) throw new Error("找不到目標角色。");
  const { character } = await findCharacterForUpdate(target.userId);
  character.gold = clampedInt(payload.gold ?? character.gold, 0, GAME_LIMITS.goldBalance, character.gold);
  character.materials = clampedInt(payload.materials ?? character.materials, 0, GAME_LIMITS.resourceQuantity, character.materials);
  await persist();
  return toPublicCharacter(character);
}

export async function adminGrantResources(payload: AdminGrantResourcesPayload) {
  const target = await resolveCharacterByName(payload.targetCharacterName);
  if (!target) throw new Error("找不到目標角色。");
  const { character } = await findCharacterForUpdate(target.userId);
  const gold = clampedInt(payload.gold, 0, GAME_LIMITS.grantGold, 0);
  const resources = (payload.resources || [])
    .map((resource) => ({
      materialType: resource.materialType,
      quantity: clampedInt(resource.quantity, 0, GAME_LIMITS.resourceQuantity, 0)
    }))
    .filter((resource) => resource.quantity > 0);
  character.gold = clamp(character.gold + gold, 0, GAME_LIMITS.goldBalance);
  addMaterialResourceRewards(character, resources);
  appendNotification(character, "admin", "管理員發放資源", `獲得 ${gold} 金幣與 ${summarizeRewardTemplate({ materials: resources })}`);
  await persist();
  return toPublicCharacter(character);
}

export async function adminBattleTest(payload: AdminBattleTestPayload) {
  const target = await resolveCharacterByName(payload.targetCharacterName);
  if (!target) throw new Error("找不到目標角色。");
  const { character } = await findCharacterForUpdate(target.userId);
  const monsterHp = clampedInt(payload.monsterHp, 1, GAME_LIMITS.monsterHp, 1);
  const monsterAttack = clampedInt(payload.monsterAttack, 1, GAME_LIMITS.monsterAttack, 1);
  const power =
    character.instinctLevel * 6 +
    character.battleLevel * 6 +
    character.stats.attack * 3 +
    character.stats.defense * 2 +
    character.stats.technique +
    character.stats.tenacity;
  const monsterPower = monsterHp + monsterAttack * 8;
  const won = power + Math.floor(Math.random() * 40) >= monsterPower;
  const damageTaken = won ? Math.max(1, Math.floor(monsterAttack / 2) - Math.floor(character.stats.tenacity / 4)) : monsterAttack;
  character.hp = clamp(character.hp - damageTaken, 1, character.maxHp);
  damageEquippedForBattle(character, damageTaken > 0);
  const record: BattleRecordSummary = {
    id: randomId("battle"),
    roomId: randomId("admin"),
    bossName: payload.monsterName,
    winner: won ? "players" : "boss",
    durationMs: 0,
    totalTicks: 1,
    createdAt: nowIso(),
    battleContext: "raid",
    participants: [
      {
        userId: character.userId,
        displayName: character.name,
        className: character.className,
        damageDealt: won ? monsterHp : Math.floor(power / 6),
        healingDone: 0,
        damageTaken
      }
    ],
    logs: [
      `怪物：${payload.monsterName}`,
      `結果：${won ? "勝利" : "失敗"}`,
      `造成傷害：${won ? monsterHp : Math.floor(power / 6)}`,
      `承受傷害：${damageTaken}`,
      `怪物攻擊：${monsterAttack}`
    ]
  };
  await recordBattle(record);
  await persist();
  return { character: toPublicCharacter(character), battleRecord: record };
}

export async function adminTriggerDaily(userId: string) {
  const { data, user } = await findCharacterForUpdate(userId);
  user.lastDailySignInOn = null;
  data.dailyRewardConfig.active = true;
  return claimDailySignIn(userId);
}

export async function adminTriggerFlashEvent(minutes = 15) {
  const data = await ensureLoaded();
  data.flashEventConfig.active = true;
  data.flashEventConfig.startAt = nowIso();
  data.flashEventConfig.endAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  data.forcedFlashEventEndsAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  await persist();
  return { endsAt: data.forcedFlashEventEndsAt };
}

export async function adminUpdateRewardConfig(payload: AdminRewardConfigPayload) {
  const data = await ensureLoaded();
  const nextConfig = normalizeRewardSchedule(payload, payload.kind === "daily" ? initialData.dailyRewardConfig : initialData.flashEventConfig);
  if (payload.kind === "daily") {
    data.dailyRewardConfig = nextConfig;
  } else {
    data.flashEventConfig = nextConfig;
    data.forcedFlashEventEndsAt = nextConfig.active && nextConfig.endAt ? nextConfig.endAt : null;
  }
  await persist();
  return {
    dailyRewardConfig: data.dailyRewardConfig,
    flashEventConfig: data.flashEventConfig
  };
}

export async function adminToggleClass(payload: AdminClassTogglePayload) {
  const data = await ensureLoaded();
  const config = data.classConfigs.find((entry) => entry.className === payload.className);
  if (!config) throw new Error("找不到職業設定。");
  config.active = payload.active;
  await persist();
  return data.classConfigs;
}

export async function adminAssignLeader(payload: AdminAssignLeaderPayload) {
  const data = await ensureLoaded();
  const faction = getFactionById(data, payload.factionId);
  const targetCharacter = findCharacterByName(data, payload.targetCharacterName);
  if (!targetCharacter) throw new Error("找不到目標角色。");
  if (targetCharacter.factionId !== faction.id) {
    targetCharacter.factionId = faction.id;
  }
  faction.leaderUserId = targetCharacter.userId;
  await persist();
  return buildFactionState(data, targetCharacter.userId);
}

type AdminSetCastleOwnerPayload = {
  castleId: string;
  ownerFactionId: string;
};

export async function adminSetCastleOwner(payload: AdminSetCastleOwnerPayload) {
  const data = await ensureLoaded();
  const castle = data.castles.find((entry) => entry.id === payload.castleId);
  if (!castle) throw new Error("找不到城池。");
  getFactionById(data, payload.ownerFactionId);
  castle.ownerFactionId = payload.ownerFactionId;
  castle.fortification = castle.maxFortification;
  await persist();
  return castle;
}

export async function adminAdjustTreasury(payload: AdminAdjustTreasuryPayload) {
  const data = await ensureLoaded();
  const faction = getFactionById(data, payload.factionId);
  faction.treasury.gold = clampedInt(payload.gold ?? faction.treasury.gold, 0, GAME_LIMITS.goldBalance, faction.treasury.gold);
  await persist();
  return toFactionSummary(data, faction);
}

export async function adminResetDiplomacy() {
  const data = await ensureLoaded();
  data.diplomacyRequests = [];
  data.factions = data.factions.map((faction) => ({
    ...faction,
    allyIds: [],
    warTargetIds: []
  }));
  await persist();
  return data.factions.map((faction) => toFactionSummary(data, faction));
}

export function isCharacterBusy(character: CharacterProfile) {
  return character.actionQueue.items.length > 0 || Boolean(character.movement) || Boolean(character.garrisonAssignment);
}

export function toAuthUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role
  };
}

function updateCharacterStat(character: CharacterProfile, statKey: CharacterStatKey, amount: number) {
  character.stats[statKey] += amount;
  recalcResources(character);
}
