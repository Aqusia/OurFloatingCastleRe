import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ActionQueueState,
  ActionType,
  ActivityResult,
  AdminAdjustResourcesPayload,
  AdminAdjustTreasuryPayload,
  AdminAnnouncementPayload,
  AdminAnnouncementTogglePayload,
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
  AttackCastleResult,
  AuthUser,
  BattleRecordSummary,
  CastleState,
  CharacterClass,
  CharacterProfile,
  CharacterStatKey,
  ClassConfig,
  CooperatePayload,
  CooperateRespondPayload,
  CraftPayload,
  DeclareWarPayload,
  DiplomacyRequest,
  EquipItemPayload,
  EquipmentSlotKey,
  FactionState,
  FactionSummary,
  ForgeOption,
  FriendSummary,
  InventoryItem,
  InventoryResult,
  InventorySortPayload,
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
  SelectFactionPayload,
  ShopItem,
  SignInStatus,
  TreasuryGrantPayload,
  UnequipItemPayload,
  UserRole
} from "../../../shared/events";
import {
  actionDurationLabel,
  actionDurationMs,
  actionLabel,
  bossBaseAttack,
  bossBaseHp,
  clamp,
  classBaseStats,
  classDefaultLoadout,
  classMigrationBase,
  cloneCharacter,
  createForgedEquipment,
  createMaterialItem,
  equipmentSlotLabel,
  forgeOptions,
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
  starterEquipmentSlots,
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
  diplomacyRequests: DiplomacyRequest[];
  marketListings: MarketListing[];
  announcements: Announcement[];
  classConfigs: ClassConfig[];
  forcedFlashEventEndsAt: string | null;
  dailyRewardConfig: RewardScheduleConfig;
  flashEventConfig: RewardScheduleConfig;
};

const dataDir = path.resolve(process.cwd(), "server", "data");
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

const initialData: StoreData = {
  users: [],
  sessions: [],
  characters: [],
  battleRecords: [],
  activityLogs: [],
  factions: [],
  castles: [],
  diplomacyRequests: [],
  marketListings: [],
  announcements: [],
  classConfigs: [
    { className: "warrior", label: "戰士", active: true },
    { className: "mage", label: "法師", active: true },
    { className: "priest", label: "祭司", active: true }
  ],
  forcedFlashEventEndsAt: null,
  dailyRewardConfig: {
    title: "每日獎勵",
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
    title: "突發獎勵",
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

function createEmptyQueue(): ActionQueueState {
  return {
    items: [],
    updatedAt: nowIso()
  };
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
    title: String(rawConfig?.title || fallback.title),
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
  if (text.includes("armor") || text.includes("盔甲")) return "armor";
  if (text.includes("kneepad") || text.includes("護膝")) return "kneepad";
  if (text.includes("offhand") || text.includes("副")) return "offhand";
  return "weapon";
}

function normalizeItem(rawItem: any): InventoryItem {
  if (!rawItem) {
    return {
      id: randomId("item"),
      name: "未知物品",
      category: "loot",
      effectSummary: "無法辨識的物品",
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
    name: rawItem.name || "未知物品",
    category: rawItem.category || "loot",
    effectSummary: rawItem.effectSummary || "無說明",
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
    effectSummary: payload.effectSummary || "由管理員建立的自訂裝備",
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
    if (!option) throw new Error("找不到鍛造模板");
    return normalizeItem({ ...option, id: randomId("item"), category: "equipment" });
  }
  if (grant.shopItemId) {
    const shopItem = staticShopItems().find((entry) => entry.id === grant.shopItemId);
    if (!shopItem) throw new Error("找不到商店物品");
    return normalizeItem({ ...shopItem, id: randomId("item"), qualityTier: "standard" });
  }
  throw new Error("請指定要發送的物品");
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
  return parts.join("、") || "無獎勵";
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
  appendNotification(character, "sign_in", notificationTitle, `你領取了 ${summarizeRewardTemplate(reward)}。`);
  return grantedItems;
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
    throw new Error("材料不足");
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
  const equipmentSlots = starterEquipmentSlots();
  for (const slot of Object.keys(equipmentSlots) as EquipmentSlotKey[]) {
    equipmentSlots[slot] = rawCharacter.equipmentSlots?.[slot] ? normalizeItem(rawCharacter.equipmentSlots[slot]) : null;
  }

  const character: CharacterProfile = {
    id: rawCharacter.id || randomId("char"),
    userId: rawCharacter.userId,
    factionId: rawCharacter.factionId || null,
    name: rawCharacter.name || "冒險者",
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
    title: rawCharacter.title || starterTitle(className),
    inventory: Array.isArray(rawCharacter.inventory) ? rawCharacter.inventory.map(normalizeItem) : [],
    statusEffects:
      Array.isArray(rawCharacter.statusEffects) && rawCharacter.statusEffects.length > 0
        ? rawCharacter.statusEffects
        : starterStatusEffects(),
    subRoleSlots:
      Array.isArray(rawCharacter.subRoleSlots) && rawCharacter.subRoleSlots.length === 3
        ? rawCharacter.subRoleSlots.map((slot: any) => ({ slot: slot.slot, item: slot.item ? normalizeItem(slot.item) : null }))
        : starterSubRoleSlots(),
    jobImage: rawCharacter.jobImage ?? null,
    loadout: rawCharacter.loadout || classDefaultLoadout(className),
    actionQueue: rawCharacter.actionQueue || createEmptyQueue(),
    notifications: Array.isArray(rawCharacter.notifications) ? rawCharacter.notifications : []
  };

  character.actionQueue.items = (character.actionQueue.items || [])
    .map((item: any) => ({
      ...item,
      label: item.label || actionLabel(item.actionType),
      durationMs: item.durationMs || actionDurationMs(item.actionType, item.metadata?.durationHours),
      status: item.status || "queued",
      onlineBonusEligible: item.onlineBonusEligible ?? true,
      hiddenCost: item.hiddenCost ?? item.metadata?.hiddenCost
    }))
    .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime());

  if (character.materials > 0 && !materialItems(character).length) {
    addMaterialRewards(character, Array.from({ length: character.materials }, () => "iron_ore"));
  }

  sortInventory(character);
  recalcResources(character);
  return character;
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
    { id: "faction_ember", name: "炎燼", color: "#e85d4f", description: "前線攻勢陣營", leaderUserId: null, allyIds: [], warTargetIds: [], treasury: { gold: 0, materials: 0 }, memberCount: 0, leaderDisplayName: null },
    { id: "faction_tide", name: "潮汐", color: "#4f9fe8", description: "調度協作陣營", leaderUserId: null, allyIds: [], warTargetIds: [], treasury: { gold: 0, materials: 0 }, memberCount: 0, leaderDisplayName: null },
    { id: "faction_gale", name: "疾風", color: "#62c67f", description: "機動突襲陣營", leaderUserId: null, allyIds: [], warTargetIds: [], treasury: { gold: 0, materials: 0 }, memberCount: 0, leaderDisplayName: null },
    { id: "faction_stone", name: "磐石", color: "#b58952", description: "防守反擊陣營", leaderUserId: null, allyIds: [], warTargetIds: [], treasury: { gold: 0, materials: 0 }, memberCount: 0, leaderDisplayName: null },
    { id: "faction_lumen", name: "晨曦", color: "#d7bb4f", description: "支援整合陣營", leaderUserId: null, allyIds: [], warTargetIds: [], treasury: { gold: 0, materials: 0 }, memberCount: 0, leaderDisplayName: null }
  ].map(({ memberCount: _memberCount, leaderDisplayName: _leaderDisplayName, ...rest }) => rest);
}

function hydrateFactions(data: StoreData) {
  if (!Array.isArray(data.factions) || data.factions.length === 0) {
    data.factions = seedFactionStore();
  }
  if (!Array.isArray(data.castles) || data.castles.length === 0) {
    data.castles = seedCastles();
  }
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

  cachedData.users = (cachedData.users || []).map((user: any) => ({
    ...user,
    role: (user.role || (user.email === "admin" ? "admin" : "player")) as UserRole,
    friendIds: Array.isArray(user.friendIds) ? user.friendIds : [],
    lastDailySignInOn: user.lastDailySignInOn || null,
    lastFlashSignInOn: user.lastFlashSignInOn || null
  }));
  cachedData.characters = (cachedData.characters || []).map(normalizeCharacter);
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
  cachedData.announcements = Array.isArray(cachedData.announcements) ? cachedData.announcements : [];
  cachedData.classConfigs =
    Array.isArray(cachedData.classConfigs) && cachedData.classConfigs.length > 0
      ? cachedData.classConfigs
      : structuredClone(initialData.classConfigs);
  cachedData.forcedFlashEventEndsAt = cachedData.forcedFlashEventEndsAt || null;
  cachedData.dailyRewardConfig = normalizeRewardSchedule(cachedData.dailyRewardConfig, initialData.dailyRewardConfig);
  cachedData.flashEventConfig = normalizeRewardSchedule(cachedData.flashEventConfig, initialData.flashEventConfig);
  hydrateFactions(cachedData);

  return cachedData;
}

async function persist() {
  if (!cachedData) return;
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
    throw new Error("找不到角色資料");
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
    appendNotification(character, "system", "本能提升", `${character.name} 的本能等級提升到 ${character.instinctLevel}。`);
  }
  syncProgressionLevel(character);
}

function awardBattleExperience(character: CharacterProfile, gained: number) {
  character.battleExp += gained;
  while (character.battleExp >= nextLevelRequirement(character.battleLevel)) {
    character.battleExp -= nextLevelRequirement(character.battleLevel);
    character.battleLevel += 1;
    appendNotification(character, "battle", "戰鬥提升", `${character.name} 的戰鬥等級提升到 ${character.battleLevel}。`);
  }
}

function awardForgeExperience(character: CharacterProfile, gained: number) {
  character.forgeExp += gained;
  while (character.forgeExp >= nextLevelRequirement(character.forgeLevel)) {
    character.forgeExp -= nextLevelRequirement(character.forgeLevel);
    character.forgeLevel += 1;
    appendNotification(character, "system", "鍛造提升", `${character.name} 的鍛造等級提升到 ${character.forgeLevel}。`);
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

function getFactionById(data: StoreData, factionId: string) {
  const faction = data.factions.find((entry) => entry.id === factionId);
  if (!faction) throw new Error("找不到陣營");
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
    message = `${character.name} 在釣魚中鍛鍊了技巧與精神。`;
    notificationBody = `${message}\n獲得 ${rewards.gold} 金幣、${rewards.experience} 經驗、${rewards.instinctExp} 本能經驗。\n屬性提升：${(rewards.statKeys || []).map(statLabel).join("、")}。`;
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
    message = `${character.name} 完成跳繩訓練，節奏和耐力都提升了。`;
    notificationBody = `${message}\n獲得 ${rewards.experience} 經驗、${rewards.instinctExp} 本能經驗。\n屬性提升：${(rewards.statKeys || []).map(statLabel).join("、")}。`;
  } else if (item.actionType === "reading") {
    updateCharacterStat(character, "intelligence", 1);
    updateCharacterStat(character, "technique", 1);
    grantStats("intelligence", "technique");
    rewards.experience = roundReward(14, multiplier);
    rewards.instinctExp = Math.max(1, Math.round(rewards.experience * 0.35));
    awardInstinctExperience(character, rewards.instinctExp);
    message = `${character.name} 透過讀書累積了知識與技巧。`;
    notificationBody = `${message}\n獲得 ${rewards.experience} 經驗、${rewards.instinctExp} 本能經驗。\n屬性提升：${(rewards.statKeys || []).map(statLabel).join("、")}。`;
  } else if (item.actionType === "push_ups") {
    updateCharacterStat(character, "vitality", 1);
    updateCharacterStat(character, "attack", 1);
    updateCharacterStat(character, "defense", 1);
    grantStats("vitality", "attack", "defense");
    rewards.experience = roundReward(14, multiplier);
    rewards.instinctExp = Math.max(1, Math.round(rewards.experience * 0.45));
    awardInstinctExperience(character, rewards.instinctExp);
    message = `${character.name} 完成伏地挺身，攻防與體力更穩定了。`;
    notificationBody = `${message}\n獲得 ${rewards.experience} 經驗、${rewards.instinctExp} 本能經驗。\n屬性提升：${(rewards.statKeys || []).map(statLabel).join("、")}。`;
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
    message = `${character.name} 透過沉思沉澱心神，運氣也跟著上升。`;
    notificationBody = `${message}\n獲得 ${rewards.experience} 經驗、${rewards.instinctExp} 本能經驗。\n屬性提升：${(rewards.statKeys || []).map(statLabel).join("、")}。`;
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
    message = `${character.name} 完成拳擊訓練，出手與節奏更加俐落。`;
    notificationBody = `${message}\n獲得 ${rewards.experience} 經驗、${rewards.instinctExp} 本能經驗。\n屬性提升：${(rewards.statKeys || []).map(statLabel).join("、")}。`;
  } else if (item.actionType === "rest") {
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
    message = `${character.name} 好好休息了一段時間，狀態回升了。`;
    notificationBody = `${message}\n恢復 HP ${rewards.hpRestored}、MP ${rewards.mpRestored}、精力 ${rewards.energyRestored}。\n獲得 ${rewards.instinctExp} 本能經驗。`;
  } else {
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
    message = `${character.name} 挖礦完成，帶回 ${gold} 金幣與 ${drops.length} 份素材。`;
    notificationBody = `${message}\n採集內容：${dropText || "無"}。\n獲得 ${experience} 經驗、${rewards.instinctExp} 本能經驗。\n本次消耗後狀態：HP ${character.hp}/${character.maxHp}、MP ${character.mp}/${character.maxMp}。`;
  }

  appendNotification(character, "activity", "行動完成", notificationBody);
  const result: ActivityResult = {
    type:
      item.actionType === "mine_shallow" || item.actionType === "mine_deep"
        ? "mining"
        : item.actionType === "rest"
          ? "rest"
          : "training",
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
    throw new Error("這個 Email 已經註冊過了");
  }
  if (findCharacterByName(data, payload.characterName)) {
    throw new Error("這個角色名稱已經被使用了");
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
  if (!user) throw new Error("登入失敗");
  const character = data.characters.find((entry) => entry.userId === user.id);
  if (!character) throw new Error("找不到角色資料");
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
  const character = data.characters.find((entry) => entry.userId === userId);
  return character ? toPublicCharacter(character) : null;
}

export async function updateCharacter(character: CharacterProfile) {
  const data = await ensureLoaded();
  const index = data.characters.findIndex((entry) => entry.id === character.id);
  if (index === -1) throw new Error("找不到角色資料");
  recalcResources(character);
  sortInventory(character);
  data.characters[index] = normalizeCharacter(cloneCharacter(character));
  await persist();
  return toPublicCharacter(data.characters[index]);
}

export async function changeCharacterClass(userId: string, className: CharacterClass) {
  const { data, character } = await findCharacterForUpdate(userId);
  if (character.classChangedOn === taipeiDayKey()) {
    throw new Error("今天已經換過職業了");
  }
  const config = data.classConfigs.find((entry) => entry.className === className);
  if (!config?.active) {
    throw new Error("這個職業目前停用中");
  }
  character.className = className;
  character.classChangedOn = taipeiDayKey();
  character.loadout = classDefaultLoadout(className);
  character.title = starterTitle(className);
  character.statusEffects = starterStatusEffects();
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
    awardBattleExperience(character, record.winner === "players" ? 18 : 8);
    awardInstinctExperience(character, record.winner === "players" ? 10 : 4);
    appendNotification(
      character,
      "battle",
      record.winner === "players" ? "戰鬥勝利" : "戰鬥失敗",
      `${record.bossName} 的戰鬥已結束。`
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
  const result = await processCharacterQueueInternal(data, character, isOnline);
  if (result.changed) await persist();
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
  await processCharacterQueueInternal(data, character, false);
  if (actionType === "mine_deep" && character.instinctLevel < 10) {
    throw new Error("深層挖礦需要本能等級 10");
  }

  const durationMs = actionDurationMs(actionType, durationHours);
  const queuedMs = character.actionQueue.items.reduce((total, item) => total + item.durationMs, 0);
  if (queuedMs + durationMs > 24 * 60 * 60 * 1000) {
    throw new Error("隊列總長不能超過一天");
  }

  const hiddenCost = actionEnergyCost(character, actionType, durationHours);
  if (character.energy < hiddenCost) {
    throw new Error("目前狀態不適合進行這項行動");
  }

  character.energy = clamp(character.energy - hiddenCost, 0, character.maxEnergy);
  const startFrom = character.actionQueue.items.at(-1)?.endsAt || nowIso();
  const startAt = new Date(startFrom);
  const endsAt = new Date(startAt.getTime() + durationMs).toISOString();
  const queuedAction: StoredQueuedAction = {
    id: randomId("queue"),
    actionType,
    label: actionLabel(actionType),
    durationMs,
    queuedAt: nowIso(),
    startAt: startAt.toISOString(),
    endsAt,
    status: character.actionQueue.items.length === 0 ? "active" : "queued",
    onlineBonusEligible: true,
    metadata: {
      durationHours,
      durationLabel: actionDurationLabel(actionType, durationHours),
      hiddenCost
    },
    hiddenCost
  };

  character.actionQueue.items.push(queuedAction);
  syncQueueStatuses(character);
  appendNotification(character, "system", "加入隊列", `${queuedAction.label} 已排入隊列。`);
  await persist();

  return {
    message: `${queuedAction.label} 已排入隊列`,
    character: toPublicCharacter(character),
    queue: toPublicQueue(character.actionQueue)
  };
}

export async function getQueueState(userId: string, isOnline: boolean) {
  const result = await processCharacterQueue(userId, isOnline);
  return { queue: result.character.actionQueue, character: result.character, completedActivities: result.completedActivities };
}

export async function cancelQueuedAction(userId: string, actionId: string): Promise<QueueMutationResult> {
  const { character } = await findCharacterForUpdate(userId);
  const index = character.actionQueue.items.findIndex((item) => item.id === actionId);
  if (index === -1) throw new Error("找不到這個隊列項目");
  if (index === 0) throw new Error("進行中的項目不能取消");

  const item = character.actionQueue.items[index] as StoredQueuedAction;
  character.energy = clamp(character.energy + (item.hiddenCost || 0), 0, character.maxEnergy);
  character.actionQueue.items.splice(index, 1);
  syncQueueStatuses(character);
  appendNotification(character, "system", "取消隊列", `${item.label} 已從隊列移除。`);
  await persist();
  return { message: "已取消隊列項目", character: toPublicCharacter(character), queue: toPublicQueue(character.actionQueue) };
}

export async function cancelQueuedActionsExceptActive(userId: string): Promise<QueueMutationResult> {
  const { character } = await findCharacterForUpdate(userId);
  if (character.actionQueue.items.length <= 1) {
    return {
      message: "目前沒有可取消的排隊項目。",
      character: toPublicCharacter(character),
      queue: toPublicQueue(character.actionQueue)
    };
  }

  const cancelledItems = character.actionQueue.items.slice(1) as StoredQueuedAction[];
  const refundedEnergy = cancelledItems.reduce((total, item) => total + (item.hiddenCost || 0), 0);
  character.energy = clamp(character.energy + refundedEnergy, 0, character.maxEnergy);
  character.actionQueue.items = character.actionQueue.items.slice(0, 1) as StoredQueuedAction[];
  syncQueueStatuses(character);
  appendNotification(character, "system", "取消隊列", `已取消 ${cancelledItems.length} 個排隊項目。`);
  await persist();
  return {
    message: `已取消 ${cancelledItems.length} 個排隊項目。`,
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
  if (!item) throw new Error("找不到商店物品");
  if (character.gold < item.price) throw new Error("金幣不足");

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
  appendNotification(character, "system", "購買成功", `${inventoryItem.name} 已進入背包。`);
  await persist();

  return {
    message: `${inventoryItem.name} 已購買`,
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
  if (!user) throw new Error("找不到使用者");
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
  if (!me) throw new Error("找不到使用者");
  if (!target) throw new Error("找不到這個角色名稱");
  if (target.id === me.id) throw new Error("不能把自己加成好友");
  if (me.friendIds.includes(target.id)) throw new Error("已經是好友了");
  me.friendIds.push(target.id);
  target.friendIds.push(me.id);
  await persist();
}

export async function getSignInStatus(userId: string): Promise<SignInStatus> {
  const data = await ensureLoaded();
  const user = data.users.find((entry) => entry.id === userId);
  if (!user) throw new Error("找不到使用者");
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
  if (user.lastDailySignInOn === dayKey) throw new Error("今天已經簽到過了");
  if (!isRewardScheduleActive(data.dailyRewardConfig)) throw new Error("目前每日獎勵尚未開放");
  user.lastDailySignInOn = dayKey;
  grantRewardTemplate(character, data.dailyRewardConfig.reward, data.dailyRewardConfig.title);
  await persist();
  return { message: "每日簽到完成", character: toPublicCharacter(character) };
}

export async function claimFlashSignIn(userId: string) {
  const { data, user, character } = await findCharacterForUpdate(userId);
  const flash = flashWindowInfo(data.forcedFlashEventEndsAt);
  const flashActive = flash.active || isRewardScheduleActive(data.flashEventConfig);
  if (!flashActive) throw new Error("目前沒有突發簽到活動");
  if (user.lastFlashSignInOn === taipeiDayKey()) throw new Error("今天已經領過突發簽到");
  user.lastFlashSignInOn = taipeiDayKey();
  grantRewardTemplate(character, data.flashEventConfig.reward, data.flashEventConfig.title);
  await persist();
  return { message: "突發簽到完成", character: toPublicCharacter(character) };
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
    throw new Error("排序資料與目前群組不一致");
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
  if (index === -1) throw new Error("找不到這個背包物品");
  const item = character.inventory[index];
  const slot = payload.slot || item.equipmentSlot;
  if (!slot) throw new Error("這個物品沒有可裝備欄位");
  if (item.isBroken) throw new Error("壞掉的裝備不能裝備");
  const previous = character.equipmentSlots[slot];
  if (previous) {
    removeItemBonus(character, previous);
    mergeInventoryStack(character, previous);
  }
  character.inventory.splice(index, 1);
  character.equipmentSlots[slot] = item;
  applyItemBonus(character, item);
  appendNotification(character, "system", "裝備變更", `${item.name} 已裝備到 ${equipmentSlotLabel(slot)}。`);
  await persist();
  return getInventory(userId);
}

export async function unequipInventoryItem(userId: string, payload: UnequipItemPayload): Promise<InventoryResult> {
  const { character } = await findCharacterForUpdate(userId);
  const item = character.equipmentSlots[payload.slot];
  if (!item) throw new Error("該欄位沒有裝備");
  removeItemBonus(character, item);
  character.equipmentSlots[payload.slot] = null;
  mergeInventoryStack(character, item);
  appendNotification(character, "system", "卸下裝備", `${item.name} 已回到背包。`);
  await persist();
  return getInventory(userId);
}

export async function listForgeOptions(): Promise<ForgeOption[]> {
  await ensureLoaded();
  return forgeOptions();
}

export async function craftEquipment(userId: string, payload: CraftPayload) {
  const { character } = await findCharacterForUpdate(userId);
  if (character.actionQueue.items.length > 0) throw new Error("目前忙碌中，無法進行鍛造");
  if (!payload.materialItemIds?.length || payload.materialItemIds.length > 16) {
    throw new Error("鍛造需要放入 1 到 16 個材料");
  }

  const materialTypes: MaterialType[] = [];
  const materialCounts = new Map<string, number>();
  for (const materialItemId of payload.materialItemIds) {
    materialCounts.set(materialItemId, (materialCounts.get(materialItemId) || 0) + 1);
  }
  for (const [materialItemId, count] of materialCounts.entries()) {
    const source = character.inventory.find((item) => item.id === materialItemId);
    if (!source || source.category !== "material" || !source.materialType) {
      throw new Error("材料清單中有無效項目");
    }
    if (count > (source.quantity || 0)) {
      throw new Error(`${source.name} 的投入數量超過持有數量`);
    }
    for (let index = 0; index < count; index += 1) {
      materialTypes.push(source.materialType);
    }
  }
  for (const [materialItemId, count] of materialCounts.entries()) {
    const removed = removeInventoryQuantity(character, materialItemId, count);
    if (!removed) throw new Error("材料扣除失敗");
  }

  const item = normalizeItem(
    createForgedEquipment({
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
  awardForgeExperience(character, 14 + materialTypes.length * 2);
  awardInstinctExperience(character, Math.max(2, Math.floor(materialTypes.length / 2)));
  appendNotification(character, "system", "鍛造完成", `${item.name} 已進入背包。`);
  await persist();
  return { message: `${item.name} 鍛造完成`, character: toPublicCharacter(character), item };
}

export async function repairEquipment(userId: string, payload: RepairPayload) {
  const { character } = await findCharacterForUpdate(userId);
  const item =
    payload.source === "equipment" && payload.slot
      ? character.equipmentSlots[payload.slot]
      : character.inventory.find((entry) => entry.id === payload.itemId) || null;
  if (!item || item.maxDurability == null || item.durability == null) throw new Error("這件裝備不能修理");

  const repairMaterials = Math.ceil((item.maxDurability - item.durability) / 10);
  if (repairMaterials <= 0) throw new Error("這件裝備目前不需要修理");
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
  return buildFactionState(data, userId);
}

export async function selectFaction(userId: string, payload: SelectFactionPayload) {
  const { data, character } = await findCharacterForUpdate(userId);
  if (character.factionId) throw new Error("已經選過陣營了，如需調整請由 admin 協助");
  getFactionById(data, payload.factionId);
  character.factionId = payload.factionId;
  appendNotification(character, "faction", "加入陣營", "你已完成陣營選擇。");
  await persist();
  return buildFactionState(data, userId);
}

export async function requestCooperation(userId: string, payload: CooperatePayload) {
  const { data, character, user } = await findCharacterForUpdate(userId);
  if (!character.factionId) throw new Error("尚未加入陣營");
  if (!isFactionLeader(data, userId) && user.role !== "admin") throw new Error("只有領袖或 admin 可以提出合作");
  const faction = getFactionById(data, character.factionId);
  const target = getFactionById(data, payload.targetFactionId);
  if (faction.id === target.id) throw new Error("不能對自己陣營提出合作");
  if (faction.allyIds.includes(target.id)) throw new Error("已經是盟友");
  if (faction.allyIds.length >= 2 || target.allyIds.length >= 2) throw new Error("其中一方盟友數已達上限");
  const existing = data.diplomacyRequests.find(
    (request) =>
      request.status === "pending" &&
      ((request.fromFactionId === faction.id && request.toFactionId === target.id) ||
        (request.fromFactionId === target.id && request.toFactionId === faction.id))
  );
  if (existing) throw new Error("已經有待處理的合作申請");

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
  if (!character.factionId) throw new Error("尚未加入陣營");
  if (!isFactionLeader(data, userId) && user.role !== "admin") throw new Error("只有領袖或 admin 可以處理合作");
  const request = data.diplomacyRequests.find((entry) => entry.id === payload.requestId);
  if (!request || request.status !== "pending") throw new Error("找不到待處理合作申請");
  if (request.toFactionId !== character.factionId && user.role !== "admin") throw new Error("你不能處理別的陣營申請");

  request.status = payload.accept ? "accepted" : "rejected";
  request.respondedAt = nowIso();
  if (payload.accept) {
    const from = getFactionById(data, request.fromFactionId);
    const to = getFactionById(data, request.toFactionId);
    if (from.allyIds.length >= 2 || to.allyIds.length >= 2) throw new Error("其中一方盟友數已達上限");
    from.allyIds = Array.from(new Set([...from.allyIds, to.id]));
    to.allyIds = Array.from(new Set([...to.allyIds, from.id]));
  }
  await persist();
  return buildFactionState(data, userId);
}

export async function declareWar(userId: string, payload: DeclareWarPayload) {
  const { data, character, user } = await findCharacterForUpdate(userId);
  if (!character.factionId) throw new Error("尚未加入陣營");
  if (!isFactionLeader(data, userId) && user.role !== "admin") throw new Error("只有領袖或 admin 可以宣戰");
  const faction = getFactionById(data, character.factionId);
  const target = getFactionById(data, payload.targetFactionId);
  if (faction.id === target.id) throw new Error("不能對自己宣戰");
  faction.warTargetIds = Array.from(new Set([...faction.warTargetIds, target.id]));
  await persist();
  return buildFactionState(data, userId);
}

export async function grantFactionTreasury(userId: string, payload: TreasuryGrantPayload) {
  const { data, character, user } = await findCharacterForUpdate(userId);
  if (!character.factionId) throw new Error("尚未加入陣營");
  if (!isFactionLeader(data, userId) && user.role !== "admin") throw new Error("只有領袖或 admin 可以分配公庫");
  const faction = getFactionById(data, character.factionId);
  const targetCharacter = findCharacterByName(data, payload.targetCharacterName);
  if (!targetCharacter) throw new Error("找不到這個角色名稱");
  if (targetCharacter.factionId !== faction.id) throw new Error("目標不在同一個陣營");
  const gold = clampedInt(payload.gold, 0, faction.treasury.gold, 0);
  const materials = clampedInt(payload.materials, 0, faction.treasury.materials, 0);
  if (faction.treasury.gold < gold || faction.treasury.materials < materials) throw new Error("公庫資源不足");

  faction.treasury.gold -= gold;
  faction.treasury.materials -= materials;
  targetCharacter.gold = clamp(targetCharacter.gold + gold, 0, GAME_LIMITS.goldBalance);
  addMaterialRewards(targetCharacter, Array.from({ length: materials }, () => "iron_ore"));
  appendNotification(targetCharacter, "faction", "公庫發放", `你收到陣營公庫發放：${gold} 金幣與 ${materials} 份素材。`);
  await persist();
  return buildFactionState(data, userId);
}

export async function listFactionMarket(userId: string) {
  const data = await ensureLoaded();
  return buildFactionState(data, userId).marketListings;
}

export async function createMarketListing(userId: string, payload: MarketListPayload) {
  const { data, character, user } = await findCharacterForUpdate(userId);
  if (!character.factionId) throw new Error("需要先加入陣營才能使用市場");
  const source = character.inventory.find((item) => item.id === payload.itemId);
  if (!source) throw new Error("找不到要上架的物品");
  const maxQuantity = Math.max(1, source.quantity || 1);
  const price = clampedInt(payload.price, 1, GAME_LIMITS.marketPrice, 0);
  if (price <= 0) throw new Error("價格必須大於 0");
  const quantity = clampedInt(payload.quantity || 1, 1, maxQuantity, 1);
  const removed = removeInventoryQuantity(character, payload.itemId, quantity);
  if (!removed) throw new Error("找不到要上架的物品");

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
  if (!character.factionId) throw new Error("需要先加入陣營才能使用市場");
  const index = data.marketListings.findIndex((listing) => listing.id === payload.listingId);
  if (index === -1) throw new Error("找不到這筆掛單");
  const listing = data.marketListings[index];
  if (!visibleFactionIds(data, character.factionId).has(listing.factionId)) throw new Error("你看不到這筆掛單");
  if (character.gold < listing.price) throw new Error("金幣不足");

  const sellerCharacter = data.characters.find((entry) => entry.userId === listing.sellerUserId);
  if (!sellerCharacter) throw new Error("賣家角色不存在");

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
  if (index === -1) throw new Error("找不到這筆自己的掛單");
  const [listing] = data.marketListings.splice(index, 1);
  mergeInventoryStack(character, normalizeItem(listing.item));
  await persist();
  return buildFactionState(data, userId);
}

export async function attackCastle(userId: string, castleId: string, participantUserIds: string[] = [userId]): Promise<AttackCastleResult> {
  const { data, character } = await findCharacterForUpdate(userId);
  if (!character.factionId) throw new Error("需要先加入陣營");
  if (isCharacterBusy(character)) throw new Error("角色目前不是閒暇中，不能進攻");
  const castle = data.castles.find((entry) => entry.id === castleId);
  if (!castle) throw new Error("找不到城池");
  if (castle.ownerFactionId === character.factionId) throw new Error("不能攻打自己的城池");
  const targetFactionId = castle.ownerFactionId;
  const myFaction = getFactionById(data, character.factionId);
  if (myFaction.allyIds.includes(targetFactionId)) throw new Error("不能攻打盟友城池");

  const participants = Array.from(new Set(participantUserIds.length > 0 ? participantUserIds : [userId]))
    .map((participantUserId) => {
      const participant = data.characters.find((entry) => entry.userId === participantUserId);
      if (!participant) throw new Error("找不到隊伍成員資料");
      if (participant.factionId !== character.factionId) throw new Error("隊伍成員必須在同一陣營才能進攻");
      if (isCharacterBusy(participant)) throw new Error(`${participant.name} 目前不是閒暇中，不能進攻`);
      return participant;
    });

  const warBonus = myFaction.warTargetIds.includes(targetFactionId) ? 1.15 : 1;
  const bossHp = castle.isCapital ? Math.round(castle.bossHp * 1.25) : castle.bossHp;
  const bossAttack = castle.isCapital ? Math.round(castle.bossAttack * 1.25) : castle.bossAttack;
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
  const power = Math.round(rawPower * warBonus);
  const defenseScore = bossHp + bossAttack * 8;
  const won = power + Math.floor(Math.random() * 80) >= defenseScore;
  const siegeDamage = 25;
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

  if (won) {
    castle.fortification -= siegeDamage;
    myFaction.treasury.gold += castle.rewardGold;
    myFaction.treasury.materials += castle.rewardMaterials;
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
      damageDealt: won ? Math.floor(bossHp / participantResults.length) : Math.floor(power / Math.max(6, participantResults.length * 6)) + index,
      healingDone: 0,
      damageTaken: hpLoss
    })),
    logs: [
      `目標：${castle.name} / ${castle.bossName}`,
      `結果：${won ? "勝利" : "失敗"}`,
      `造成傷害：${won ? bossHp : Math.floor(power / 6)}`,
      `參與人數：${participantResults.length}`,
      `承受傷害：${participantResults.reduce((total, result) => total + result.hpLoss, 0)}`,
      `消耗 MP：${participantResults.reduce((total, result) => total + result.mpLoss, 0)}、精力：${participantResults.reduce((total, result) => total + result.energyLoss, 0)}`
    ]
  };
  await recordBattle(record);
  await persist();

  return {
    message: won ? `${castle.name} 攻城成功，城防下降。` : `${castle.name} 攻城失敗。`,
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
  if (!announcement) throw new Error("找不到公告");
  announcement.active = payload.active;
  await persist();
  return data.announcements;
}

export async function adminCompleteQueue(payload: AdminCompleteQueuePayload) {
  const target = await resolveCharacterByName(payload.targetCharacterName);
  if (!target) throw new Error("找不到這個角色名稱");
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
  if (!target) throw new Error("找不到這個角色名稱");
  const { character } = await findCharacterForUpdate(target.userId);
  character.hp = character.maxHp;
  character.mp = character.maxMp;
  character.energy = character.maxEnergy;
  await persist();
  return toPublicCharacter(character);
}

export async function adminGrantItem(payload: AdminGrantItemPayload) {
  const target = await resolveCharacterByName(payload.targetCharacterName);
  if (!target) throw new Error("找不到這個角色名稱");
  const { character } = await findCharacterForUpdate(target.userId);
  const item = buildGrantedItem(payload);
  mergeInventoryStack(character, item);
  appendNotification(character, "admin", "管理員發送物品", `${item.name} 已送入你的背包。`);
  await persist();
  return { character: toPublicCharacter(character), item };
}

export async function adminAdjustResources(payload: AdminAdjustResourcesPayload) {
  const target = await resolveCharacterByName(payload.targetCharacterName);
  if (!target) throw new Error("找不到這個角色名稱");
  const { character } = await findCharacterForUpdate(target.userId);
  character.gold = clampedInt(payload.gold ?? character.gold, 0, GAME_LIMITS.goldBalance, character.gold);
  character.materials = clampedInt(payload.materials ?? character.materials, 0, GAME_LIMITS.resourceQuantity, character.materials);
  await persist();
  return toPublicCharacter(character);
}

export async function adminGrantResources(payload: AdminGrantResourcesPayload) {
  const target = await resolveCharacterByName(payload.targetCharacterName);
  if (!target) throw new Error("找不到這個角色名稱");
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
  appendNotification(character, "admin", "管理員發送資源", `你收到金幣 ${gold} 與 ${summarizeRewardTemplate({ materials: resources })}。`);
  await persist();
  return toPublicCharacter(character);
}

export async function adminBattleTest(payload: AdminBattleTestPayload) {
  const target = await resolveCharacterByName(payload.targetCharacterName);
  if (!target) throw new Error("找不到這個角色名稱");
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
      `目標：${payload.monsterName}`,
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
  if (!config) throw new Error("找不到職業設定");
  config.active = payload.active;
  await persist();
  return data.classConfigs;
}

export async function adminAssignLeader(payload: AdminAssignLeaderPayload) {
  const data = await ensureLoaded();
  const faction = getFactionById(data, payload.factionId);
  const targetCharacter = findCharacterByName(data, payload.targetCharacterName);
  if (!targetCharacter) throw new Error("找不到這個角色名稱");
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
  if (!castle) throw new Error("找不到城池");
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
  faction.treasury.materials = clampedInt(payload.materials ?? faction.treasury.materials, 0, GAME_LIMITS.resourceQuantity, faction.treasury.materials);
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
  return character.actionQueue.items.length > 0;
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
