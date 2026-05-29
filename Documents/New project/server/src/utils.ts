import { randomUUID } from "node:crypto";
import type {
  ActionType,
  BattleContext,
  CastleState,
  CharacterClass,
  CharacterProfile,
  CharacterStatKey,
  CharacterStats,
  CombatRole,
  EquipmentSlotKey,
  EquipmentSlots,
  FactionSummary,
  ForgeOption,
  InventoryItem,
  LoadoutSummary,
  MaterialType,
  QualityTier,
  ShopItem,
  StatusEffect,
  SubRoleSlot
} from "../../shared/events";

export function randomId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function randomRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function sanitizePartyCode(value?: string | null) {
  const code = (value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 6) {
    return null;
  }
  return code;
}

export function nowIso() {
  return new Date().toISOString();
}

export function taipeiDayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function classMigrationBase(className: CharacterClass) {
  if (className === "warrior") {
    return { defense: 3, vitality: 4, technique: 2, luck: 1, tenacity: 4 };
  }
  if (className === "mage") {
    return { defense: 1, vitality: 2, technique: 4, luck: 2, tenacity: 1 };
  }
  return { defense: 2, vitality: 3, technique: 2, luck: 4, tenacity: 2 };
}

export function classBaseStats(className: CharacterClass): CharacterStats {
  if (className === "warrior") {
    return {
      attack: 12,
      defense: 6,
      luck: 3,
      intelligence: 5,
      vitality: 8,
      spirit: 5,
      technique: 4,
      tenacity: 7
    };
  }

  if (className === "mage") {
    return {
      attack: 4,
      defense: 3,
      luck: 4,
      intelligence: 13,
      vitality: 4,
      spirit: 8,
      technique: 7,
      tenacity: 3
    };
  }

  return {
    attack: 5,
    defense: 4,
    luck: 7,
    intelligence: 7,
    vitality: 6,
    spirit: 13,
    technique: 4,
    tenacity: 5
  };
}

export function localizedClassName(className: CharacterClass) {
  if (className === "warrior") return "戰士";
  if (className === "mage") return "法師";
  return "祭司";
}

export function localizedRole(role: CombatRole) {
  if (role === "tank") return "坦克";
  if (role === "dps") return "輸出";
  if (role === "healer") return "治療";
  return "均衡";
}

export function classDefaultLoadout(className: CharacterClass): LoadoutSummary {
  if (className === "warrior") {
    return {
      preferredRole: "tank",
      blessing: "鋼鐵誓約",
      title: "前線破陣者",
      equipment: ["厚刃長劍", "訓練護甲"],
      skills: ["盾牆", "裂地", "怒吼"]
    };
  }

  if (className === "mage") {
    return {
      preferredRole: "dps",
      blessing: "星紋法印",
      title: "秘術觀測者",
      equipment: ["學徒法杖", "導流長袍"],
      skills: ["火矢", "寒霜", "奧術潮湧"]
    };
  }

  return {
    preferredRole: "healer",
    blessing: "聖輝恩典",
    title: "晨光祈禱者",
    equipment: ["聖枝權杖", "祈福披肩"],
    skills: ["治癒", "祝福", "淨化"]
  };
}

export function starterTitle(className: CharacterClass) {
  return classDefaultLoadout(className).title;
}

export function starterStatusEffects(): StatusEffect[] {
  return [
    {
      id: randomId("status"),
      name: "初心者祝福",
      description: "剛踏上旅途的角色會獲得一段短暫的新手保護。",
      kind: "buff",
      source: "title"
    }
  ];
}

export function starterSubRoleSlots(): SubRoleSlot[] {
  return [
    { slot: 1, item: null },
    { slot: 2, item: null },
    { slot: 3, item: null }
  ];
}

export function starterEquipmentSlots(): EquipmentSlots {
  return {
    weapon: null,
    offhand: null,
    helmet: null,
    armor: null,
    kneepad: null,
    pet: null,
    avatar: null
  };
}

export function cloneCharacter(character: CharacterProfile): CharacterProfile {
  return JSON.parse(JSON.stringify(character)) as CharacterProfile;
}

export function maxHpForCharacter(character: Pick<CharacterProfile, "level" | "stats">) {
  return 80 + character.level * 8 + character.stats.vitality * 4 + character.stats.defense * 2 + character.stats.spirit;
}

export function maxMpForCharacter(character: Pick<CharacterProfile, "level" | "stats">) {
  return 30 + character.level * 5 + character.stats.intelligence * 4 + character.stats.spirit * 3 + character.stats.technique;
}

export function maxEnergyForCharacter(character: Pick<CharacterProfile, "level" | "stats">) {
  return 60 + character.level * 6 + character.stats.vitality * 2 + character.stats.spirit * 2 + character.stats.technique * 2;
}

export function nextLevelRequirement(level: number) {
  return Math.max(50, level * 100);
}

export function bossBaseHp(memberCount: number, battleContext: BattleContext = "raid") {
  const base = 200 + memberCount * 90;
  if (battleContext === "castle") return Math.round(base * 1.15);
  if (battleContext === "factionBoss") return Math.round(base * 1.3);
  return base;
}

export function bossBaseAttack(memberCount: number, battleContext: BattleContext = "raid") {
  const base = 12 + memberCount * 3;
  if (battleContext === "castle") return Math.round(base * 1.1);
  if (battleContext === "factionBoss") return Math.round(base * 1.25);
  return base;
}

export function randomFrom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export function capLogs(logs: string[]) {
  return logs.slice(-60);
}

export function updateCharacterStat(character: CharacterProfile, statKey: CharacterStatKey, amount: number) {
  character.stats[statKey] += amount;
  character.maxHp = maxHpForCharacter(character);
  character.maxMp = maxMpForCharacter(character);
  character.maxEnergy = maxEnergyForCharacter(character);
  character.hp = clamp(character.hp, 0, character.maxHp);
  character.mp = clamp(character.mp, 0, character.maxMp);
  character.energy = clamp(character.energy, 0, character.maxEnergy);
}

export function setPreferredRole(character: CharacterProfile, role: CombatRole) {
  character.loadout.preferredRole = role;
}

export function actionLabel(actionType: ActionType) {
  const labels: Record<ActionType, string> = {
    fishing: "釣魚",
    jump_rope: "跳繩",
    reading: "讀書",
    push_ups: "伏地挺身",
    meditation: "沉思",
    boxing: "拳擊",
    rest: "休息",
    mine_shallow: "淺層挖礦",
    mine_deep: "深層挖礦",
    forge: "鍛造"
  };
  return labels[actionType];
}

export function actionDurationMs(actionType: ActionType, durationHours?: number) {
  if (actionType === "mine_shallow" || actionType === "mine_deep" || actionType === "forge") {
    const hours = durationHours && [1, 2, 4, 8, 12].includes(durationHours) ? durationHours : 1;
    return hours * 60 * 60 * 1000;
  }
  return 60 * 60 * 1000;
}

export function actionDurationLabel(actionType: ActionType, durationHours?: number) {
  if (actionType === "mine_shallow" || actionType === "mine_deep" || actionType === "forge") {
    return `${durationHours || 1} 小時`;
  }
  return "1 小時";
}

export function equipmentSlotLabel(slot: EquipmentSlotKey) {
  const labels: Record<EquipmentSlotKey, string> = {
    weapon: "主武器",
    offhand: "副武器",
    helmet: "頭盔",
    armor: "盔甲",
    kneepad: "護膝",
    pet: "寵物",
    avatar: "替身"
  };
  return labels[slot];
}

export function factionSeedSummaries(): Array<Pick<FactionSummary, "id" | "name" | "color" | "description">> {
  return [
    { id: "faction_ember", name: "炎燼", color: "#e85d4f", description: "以攻勢與遠征聞名的前線陣營。" },
    { id: "faction_tide", name: "潮汐", color: "#4f9fe8", description: "擅長調度與戰術協作的海風陣營。" },
    { id: "faction_gale", name: "疾風", color: "#62c67f", description: "節奏迅猛，偏好突襲與快攻的機動陣營。" },
    { id: "faction_stone", name: "磐石", color: "#b58952", description: "穩守與反擊兼具，善於長線經營。" },
    { id: "faction_lumen", name: "晨曦", color: "#d7bb4f", description: "重視支援與信念，擅長資源整合。" }
  ];
}

export function seedCastles(): CastleState[] {
  const factions = factionSeedSummaries();
  return Array.from({ length: 25 }, (_, index) => {
    const row = Math.floor(index / 5);
    const col = index % 5;
    const ownerFaction = factions[row];
    const isCapital = col === 0;
    return {
      id: `castle_${row + 1}_${col + 1}`,
      name: `${ownerFaction.name}${isCapital ? "首都" : `城池 ${col}`}`,
      row,
      col,
      ownerFactionId: ownerFaction.id,
      fortification: 100,
      maxFortification: 100,
      isCapital,
      bossName: isCapital ? `${ownerFaction.name}守城統領` : `${ownerFaction.name}守城隊長`,
      bossHp: isCapital ? 350 : 280,
      bossAttack: isCapital ? 32 : 24,
      rewardGold: isCapital ? 120 : 80,
      rewardMaterials: isCapital ? 60 : 36
    };
  });
}

export function staticShopItems(): ShopItem[] {
  return [
    {
      id: "shop_healing_tea",
      name: "回神茶",
      category: "consumable",
      price: 35,
      description: "簡單的補給飲品。",
      effectSummary: "精力 +12",
      stock: "infinite",
      energyBonus: 12
    },
    {
      id: "shop_bronze_blade",
      name: "青銅短刃",
      category: "equipment",
      equipmentSlot: "weapon",
      price: 120,
      description: "能撐過前期戰鬥的練習武器。",
      effectSummary: "攻擊 +1，耐久 70",
      stock: "infinite",
      rarity: "common",
      attackBonus: 1,
      statBonus: { attack: 1 },
      durability: 70,
      maxDurability: 70
    },
    {
      id: "shop_lucky_charm",
      name: "幸運護符",
      category: "sub_slot",
      price: 180,
      description: "小巧的護身物。",
      effectSummary: "運氣 +1",
      stock: "infinite",
      rarity: "uncommon",
      statBonus: { luck: 1 }
    },
    {
      id: "shop_forge_manual",
      name: "鍛造筆記",
      category: "manual",
      price: 220,
      description: "記錄常見鍛造心得的入門筆記。",
      effectSummary: "技巧 +1，智力 +1",
      stock: "infinite",
      rarity: "rare",
      statBonus: { technique: 1, intelligence: 1 }
    }
  ];
}

export function forgeOptions(): ForgeOption[] {
  return [
    {
      id: "forge_weapon",
      name: "鍛造主武器",
      equipmentSlot: "weapon",
      materialCost: 20,
      effectSummary: "攻擊 +3，運氣 +1，耐久 100",
      attackBonus: 3,
      luckBonus: 1,
      statBonus: { attack: 3, luck: 1 },
      durability: 100,
      maxDurability: 100,
      recommendedMaterials: ["iron_ore", "silver_ore"]
    },
    {
      id: "forge_offhand",
      name: "鍛造副武器",
      equipmentSlot: "offhand",
      materialCost: 16,
      effectSummary: "防禦 +2，技巧 +1，耐久 100",
      defenseBonus: 2,
      statBonus: { defense: 2, technique: 1 },
      durability: 100,
      maxDurability: 100,
      recommendedMaterials: ["iron_ore", "leather"]
    },
    {
      id: "forge_helmet",
      name: "鍛造頭盔",
      equipmentSlot: "helmet",
      materialCost: 14,
      effectSummary: "防禦 +2，耐久 120",
      defenseBonus: 2,
      statBonus: { defense: 2 },
      durability: 120,
      maxDurability: 120,
      recommendedMaterials: ["iron_ore", "cloth"]
    },
    {
      id: "forge_armor",
      name: "鍛造盔甲",
      equipmentSlot: "armor",
      materialCost: 24,
      effectSummary: "防禦 +4，體力 +1，耐久 140",
      defenseBonus: 4,
      statBonus: { defense: 4, vitality: 1 },
      durability: 140,
      maxDurability: 140,
      recommendedMaterials: ["iron_ore", "obsidian_ore", "leather"]
    },
    {
      id: "forge_kneepad",
      name: "鍛造護膝",
      equipmentSlot: "kneepad",
      materialCost: 12,
      effectSummary: "防禦 +1，技巧 +1，耐久 110",
      defenseBonus: 1,
      statBonus: { defense: 1, technique: 1 },
      durability: 110,
      maxDurability: 110,
      recommendedMaterials: ["copper_ore", "bone"]
    }
  ];
}

export function materialCatalog(): Array<{
  type: MaterialType;
  name: string;
  weight: number;
  affinity: Partial<Record<EquipmentSlotKey, number>>;
}> {
  return [
    { type: "iron_ore", name: "鐵礦", weight: 36, affinity: { weapon: 3, offhand: 2, helmet: 2, armor: 3, kneepad: 2 } },
    { type: "copper_ore", name: "銅礦", weight: 22, affinity: { weapon: 2, offhand: 3, kneepad: 2 } },
    { type: "silver_ore", name: "銀礦", weight: 14, affinity: { weapon: 2, offhand: 2, helmet: 1 } },
    { type: "obsidian_ore", name: "黑曜礦", weight: 10, affinity: { weapon: 4, armor: 3 } },
    { type: "stardust", name: "星砂", weight: 8, affinity: { weapon: 1, offhand: 1, pet: 2, avatar: 2 } },
    { type: "leather", name: "皮革", weight: 16, affinity: { offhand: 2, armor: 2, kneepad: 3 } },
    { type: "cloth", name: "布料", weight: 16, affinity: { helmet: 2, armor: 1, avatar: 2 } },
    { type: "bone", name: "骨材", weight: 12, affinity: { weapon: 1, kneepad: 3, pet: 2 } }
  ];
}

export function materialName(type: MaterialType) {
  return materialCatalog().find((entry) => entry.type === type)?.name || type;
}

export function createMaterialItem(type: MaterialType, quantity = 1): InventoryItem {
  return {
    id: randomId("item"),
    name: materialName(type),
    category: "material",
    effectSummary: "鍛造與修復素材",
    rarity: type === "obsidian_ore" || type === "stardust" ? "rare" : "common",
    craftSource: null,
    isBroken: false,
    sortOrder: 0,
    stackable: true,
    quantity,
    materialType: type,
    prefixName: null,
    suffixName: null,
    qualityTier: null,
    tenacityBonus: 0,
    itemLevel: 1,
    sellPrice: null,
    salvagePrice: null,
    craftedBy: null,
    craftedAt: null
  };
}

export function qualityTierMeta(tier: QualityTier) {
  const map: Record<QualityTier, { label: string; rarity: InventoryItem["rarity"]; multiplier: number }> = {
    rough: { label: "粗製", rarity: "common", multiplier: 0.8 },
    standard: { label: "標準", rarity: "common", multiplier: 1 },
    fine: { label: "精良", rarity: "uncommon", multiplier: 1.2 },
    masterwork: { label: "精品", rarity: "rare", multiplier: 1.45 },
    epic: { label: "史詩級", rarity: "epic", multiplier: 1.75 },
    divine: { label: "神工級", rarity: "epic", multiplier: 2.1 }
  };
  return map[tier];
}

export function pickQualityTier(score: number): QualityTier {
  if (score >= 92) return "divine";
  if (score >= 80) return "epic";
  if (score >= 66) return "masterwork";
  if (score >= 52) return "fine";
  if (score >= 38) return "standard";
  return "rough";
}

export function createForgedEquipment(input: {
  equipmentSlot: EquipmentSlotKey;
  customName?: string;
  materialTypes: MaterialType[];
  stats: CharacterStats;
  instinctLevel: number;
  forgeLevel: number;
  craftedBy?: string;
}): InventoryItem {
  const materialInfo = materialCatalog();
  const materials = input.materialTypes
    .map((type) => materialInfo.find((entry) => entry.type === type))
    .filter(Boolean) as Array<(typeof materialInfo)[number]>;
  const materialCount = Math.max(1, materials.length);
  const affinityScore = materials.reduce((sum, entry) => sum + (entry.affinity[input.equipmentSlot] || 0), 0);
  const qualityScore =
    24 +
    affinityScore * 4 +
    materialCount * 2 +
    input.forgeLevel * 3 +
    input.instinctLevel * 2 +
    input.stats.luck +
    input.stats.technique +
    Math.floor(Math.random() * 18);
  const qualityTier = pickQualityTier(qualityScore);
  const quality = qualityTierMeta(qualityTier);
  const baseTypeName =
    input.equipmentSlot === "weapon"
      ? "長刃"
      : input.equipmentSlot === "offhand"
        ? "護手"
        : input.equipmentSlot === "helmet"
          ? "頭盔"
          : input.equipmentSlot === "armor"
            ? "戰甲"
            : input.equipmentSlot === "kneepad"
              ? "護膝"
              : input.equipmentSlot === "pet"
                ? "靈寵"
                : "替身";
  const primaryMaterial = materials[0]?.name || "素材";
  const customName = (input.customName || "").trim();
  const prefixName = customName || primaryMaterial;
  const suffixName = `${quality.label}${baseTypeName}`;
  const basePower = Math.max(1, Math.round(materialCount * quality.multiplier));
  const attackBonus = input.equipmentSlot === "weapon" ? basePower + Math.floor(input.stats.attack / 8) : 0;
  const defenseBonus = ["offhand", "helmet", "armor", "kneepad"].includes(input.equipmentSlot)
    ? basePower + Math.floor(input.stats.defense / 10)
    : 0;
  const luckBonus = Math.max(0, Math.floor((input.stats.luck + materialCount) / 10) + (qualityTier === "divine" ? 2 : qualityTier === "epic" ? 1 : 0));
  const tenacityBonus = Math.max(0, Math.floor((input.stats.tenacity + materialCount) / 12) + (input.equipmentSlot === "armor" ? 1 : 0));
  const techniqueBonus = Math.max(0, input.equipmentSlot === "offhand" || input.equipmentSlot === "kneepad" ? Math.floor(basePower / 2) : 0);
  const vitalityBonus = Math.max(0, input.equipmentSlot === "armor" ? Math.floor(basePower / 2) : 0);
  const durabilityBase = input.equipmentSlot === "armor" ? 130 : input.equipmentSlot === "helmet" ? 110 : 100;
  const maxDurability = Math.round(durabilityBase + materialCount * 4 + input.forgeLevel * 2 + input.stats.tenacity * 1.5);
  const itemLevel = Math.max(1, Math.round((input.instinctLevel + input.forgeLevel + materialCount) / 2));
  const statBonus: Partial<CharacterStats> = {
    ...(attackBonus ? { attack: attackBonus } : {}),
    ...(defenseBonus ? { defense: defenseBonus } : {}),
    ...(luckBonus ? { luck: luckBonus } : {}),
    ...(tenacityBonus ? { tenacity: tenacityBonus } : {}),
    ...(techniqueBonus ? { technique: techniqueBonus } : {}),
    ...(vitalityBonus ? { vitality: vitalityBonus } : {})
  };

  return {
    id: randomId("item"),
    name: `${prefixName} ${suffixName}`.trim(),
    category: "equipment",
    effectSummary: `${materials.map((entry) => entry.name).join(" / ")} 打造的 ${baseTypeName}`,
    equipmentSlot: input.equipmentSlot,
    rarity: quality.rarity,
    craftSource: materials.map((entry) => entry.type).join(","),
    statBonus,
    attackBonus,
    defenseBonus,
    luckBonus,
    tenacityBonus,
    durability: maxDurability,
    maxDurability,
    isBroken: false,
    sortOrder: 0,
    stackable: false,
    quantity: 1,
    materialType: null,
    prefixName,
    suffixName,
    qualityTier,
    itemLevel,
    sellPrice: Math.max(20, itemLevel * 12 + materialCount * 6),
    salvagePrice: Math.max(8, itemLevel * 6 + materialCount * 3),
    craftedBy: input.craftedBy || null,
    craftedAt: nowIso()
  };
}

export function toInventoryItem(source: ShopItem | ForgeOption): InventoryItem {
  const rarity = "rarity" in source ? source.rarity : undefined;
  const hpBonus = "hpBonus" in source ? source.hpBonus : undefined;
  const mpBonus = "mpBonus" in source ? source.mpBonus : undefined;
  const energyBonus = "energyBonus" in source ? source.energyBonus : undefined;
  return {
    id: randomId("item"),
    name: source.name,
    category: "category" in source ? source.category : "equipment",
    effectSummary: source.effectSummary,
    equipmentSlot: source.equipmentSlot ?? null,
    rarity: rarity ?? "common",
    craftSource: "materialCost" in source ? source.id : null,
    statBonus: source.statBonus,
    attackBonus: source.attackBonus,
    defenseBonus: source.defenseBonus,
    luckBonus: source.luckBonus,
    hpBonus,
    mpBonus,
    energyBonus,
    durability: source.durability ?? null,
    maxDurability: source.maxDurability ?? null,
    isBroken: false,
    sortOrder: 0,
    stackable: false,
    quantity: 1,
    materialType: null,
    prefixName: null,
    suffixName: null,
    qualityTier: "standard",
    tenacityBonus: source.statBonus?.tenacity,
    itemLevel: 1,
    sellPrice: "price" in source ? source.price : 12,
    salvagePrice: Math.max(4, Math.floor(("price" in source ? source.price : 12) / 2)),
    craftedBy: null,
    craftedAt: null
  };
}
