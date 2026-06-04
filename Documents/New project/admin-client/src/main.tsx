import { Fragment, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Plus, RefreshCw, RotateCcw, Save, Trash2 } from "lucide-react";
import type { AdminConfigSection, AdminGameConfigResponse } from "../../shared/events";
import { getAdminGameConfig, login, resetAdminGameConfigSection, updateAdminGameConfigSection } from "./api";
import "./style.css";

type Option = { value: string; label: string };
type FieldType = "text" | "textarea" | "number" | "boolean" | "select" | "multiselect" | "datetime";
type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  min?: number;
  max?: number;
  step?: number;
  options?: Option[];
};
type ObjectGroup = { type: "object"; key: string; label: string; fields: FieldDef[] };
type ArrayGroup = { type: "array"; key: string; label: string; itemLabel: string; fields: FieldDef[]; createItem: () => AnyRecord };
type GroupDef = ObjectGroup | ArrayGroup;
type SectionDef = {
  key: AdminConfigSection;
  label: string;
  description: string;
  groups: (context: EditorContext) => GroupDef[];
  createItem?: () => unknown;
};
type EditorContext = {
  resourceOptions: Option[];
  factionOptions: Option[];
  castleOptions: Option[];
  shopOptions: Option[];
  skillOptions: Option[];
};
type AnyRecord = Record<string, any>;

const classOptions: Option[] = [
  { value: "warrior", label: "戰士" },
  { value: "assassin", label: "刺客" },
  { value: "mage", label: "法師" },
  { value: "priest", label: "牧師" }
];
const sourceOptions: Option[] = [
  { value: "class", label: "職業" },
  { value: "secondary", label: "副角色" },
  { value: "manual", label: "秘籍" }
];
const logStyleOptions: Option[] = [
  { value: "single", label: "單段" },
  { value: "multi_hit", label: "多段" }
];
const categoryOptions: Option[] = [
  { value: "consumable", label: "消耗品" },
  { value: "equipment", label: "裝備" },
  { value: "sub_slot", label: "副角色槽" },
  { value: "loot", label: "戰利品" },
  { value: "material", label: "材料" },
  { value: "manual", label: "秘籍" }
];
const slotOptions: Option[] = [
  { value: "weapon", label: "武器" },
  { value: "offhand", label: "副手" },
  { value: "helmet", label: "頭盔" },
  { value: "armor", label: "護甲" },
  { value: "kneepad", label: "護膝" },
  { value: "pet", label: "寵物" },
  { value: "avatar", label: "外觀" }
];
const rarityOptions: Option[] = [
  { value: "common", label: "普通" },
  { value: "uncommon", label: "精良" },
  { value: "rare", label: "稀有" },
  { value: "epic", label: "史詩" }
];
const specialtyOptions: Option[] = [
  { value: "capital", label: "首都" },
  { value: "agriculture", label: "農業" },
  { value: "mining", label: "採礦" },
  { value: "boss", label: "Boss" },
  { value: "trade", label: "貿易" }
];

const statFields: FieldDef[] = [
  { key: "attack", label: "攻擊", type: "number", min: 0, step: 1 },
  { key: "defense", label: "防禦", type: "number", min: 0, step: 1 },
  { key: "luck", label: "運氣", type: "number", min: 0, step: 1 },
  { key: "intelligence", label: "智慧", type: "number", min: 0, step: 1 },
  { key: "vitality", label: "生命", type: "number", min: 0, step: 1 },
  { key: "spirit", label: "精神", type: "number", min: 0, step: 1 },
  { key: "technique", label: "技巧", type: "number", min: 0, step: 1 },
  { key: "tenacity", label: "韌性", type: "number", min: 0, step: 1 }
];

const makeSkill = () => ({
  id: "new_skill",
  name: "新技能",
  source: "secondary",
  detail: "",
  statBonus: {},
  baseChance: 0.25,
  cooldownTurns: 2,
  unlockLevel: 1,
  hitCount: 1,
  logStyle: "single"
});
const makeSecondary = () => ({
  id: "new_partner",
  name: "新副角色",
  origin: "",
  role: "",
  weapon: "",
  detail: "",
  statBonus: {},
  unlockedSkillIds: []
});
const makeShopItem = () => ({
  id: "new_item",
  name: "新物品",
  category: "equipment",
  price: 100,
  description: "",
  effectSummary: "",
  stock: "infinite",
  statBonus: {}
});
const makeForgeOption = () => ({
  id: "new_forge",
  name: "新鍛造配方",
  equipmentSlot: "weapon",
  materialCost: 10,
  effectSummary: "",
  statBonus: {},
  durability: 100,
  maxDurability: 100,
  recommendedMaterials: []
});
const makeRewardMaterial = () => ({ materialType: "iron_ore", quantity: 1 });
const makeRewardItem = () => ({ shopItemId: "" });
const makeAnnouncement = () => ({ id: `ann_${Date.now()}`, title: "新公告", body: "", active: true, createdAt: new Date().toISOString() });

const sections: SectionDef[] = [
  {
    key: "classes",
    label: "角色職業",
    description: "控制職業名稱與開放狀態。",
    createItem: () => ({ className: "warrior", label: "新職業", active: true }),
    groups: () => [
      {
        type: "array",
        key: "",
        label: "職業列表",
        itemLabel: "職業",
        createItem: () => ({ className: "warrior", label: "新職業", active: true }),
        fields: [
          { key: "className", label: "職業 key", type: "select", options: classOptions },
          { key: "label", label: "顯示名稱", type: "text" },
          { key: "active", label: "啟用", type: "boolean" }
        ]
      }
    ]
  },
  {
    key: "specialSkills",
    label: "特殊技能",
    description: "調整技能來源、觸發率、冷卻、段數與能力加成。",
    createItem: makeSkill,
    groups: () => [
      {
        type: "array",
        key: "",
        label: "技能列表",
        itemLabel: "技能",
        createItem: makeSkill,
        fields: [
          { key: "id", label: "ID", type: "text" },
          { key: "name", label: "名稱", type: "text" },
          { key: "source", label: "來源", type: "select", options: sourceOptions },
          { key: "requiredClass", label: "限定職業", type: "select", options: [{ value: "", label: "不限" }, ...classOptions] },
          { key: "detail", label: "說明", type: "textarea" },
          { key: "baseChance", label: "觸發率", type: "number", min: 0, max: 1, step: 0.01 },
          { key: "cooldownTurns", label: "冷卻回合", type: "number", min: 0, step: 1 },
          { key: "unlockLevel", label: "解鎖等級", type: "number", min: 1, step: 1 },
          { key: "hitCount", label: "命中段數", type: "number", min: 1, step: 1 },
          { key: "hitLabel", label: "段數文字", type: "text" },
          { key: "finisherText", label: "收尾文字", type: "text" },
          { key: "logStyle", label: "戰報樣式", type: "select", options: logStyleOptions },
          ...statFields.map((field) => ({ ...field, key: `statBonus.${field.key}` }))
        ]
      }
    ]
  },
  {
    key: "secondaryCharacters",
    label: "副角色",
    description: "調整副角色故事、武器、技能解鎖與能力加成。",
    createItem: makeSecondary,
    groups: (context) => [
      {
        type: "array",
        key: "",
        label: "副角色列表",
        itemLabel: "副角色",
        createItem: makeSecondary,
        fields: [
          { key: "id", label: "ID", type: "text" },
          { key: "name", label: "名稱", type: "text" },
          { key: "origin", label: "出身", type: "text" },
          { key: "role", label: "定位", type: "text" },
          { key: "weapon", label: "武器", type: "text" },
          { key: "detail", label: "說明", type: "textarea" },
          { key: "unlockedSkillIds", label: "解鎖技能", type: "multiselect", options: context.skillOptions },
          { key: "preferredEquipmentSlots", label: "偏好部位", type: "multiselect", options: slotOptions },
          ...statFields.map((field) => ({ ...field, key: `statBonus.${field.key}` }))
        ]
      }
    ]
  },
  {
    key: "battle",
    label: "戰鬥難度",
    description: "調整單人戰鬥每個難度的怪物、報酬與風險文字。",
    groups: () => [
      {
        type: "object",
        key: "easy",
        label: "簡單",
        fields: battleFields()
      },
      {
        type: "object",
        key: "normal",
        label: "普通",
        fields: battleFields()
      },
      {
        type: "object",
        key: "hard",
        label: "困難",
        fields: battleFields()
      },
      {
        type: "object",
        key: "elite",
        label: "菁英",
        fields: battleFields()
      }
    ]
  },
  {
    key: "rewards",
    label: "獎勵活動",
    description: "調整每日獎勵與突發活動的時間、金幣、材料與贈品。",
    groups: (context) => rewardGroups(context)
  },
  {
    key: "castles",
    label: "城池",
    description: "調整地圖座標、防禦、Boss 與攻城獎勵。",
    groups: (context) => [
      {
        type: "array",
        key: "",
        label: "城池列表",
        itemLabel: "城池",
        createItem: () => ({
          id: "new_castle",
          name: "新城池",
          row: 0,
          col: 0,
          layer: 1,
          layerName: "",
          specialty: "trade",
          distanceFromCapital: 1,
          buildSlots: 2,
          facilities: [],
          ownerFactionId: context.factionOptions[0]?.value || "",
          fortification: 100,
          maxFortification: 100,
          terrainAdvantage: 12,
          autoDefensePower: 45,
          garrisonSlots: 4,
          siegeResistance: 10,
          isCapital: false,
          bossName: "",
          bossHp: 100,
          bossAttack: 10,
          rewardGold: 20,
          rewardMaterials: 1
        }),
        fields: [
          { key: "id", label: "ID", type: "text" },
          { key: "name", label: "名稱", type: "text" },
          { key: "row", label: "Row", type: "number", step: 1 },
          { key: "col", label: "Col", type: "number", step: 1 },
          { key: "layer", label: "圈層", type: "number", min: 1, step: 1 },
          { key: "layerName", label: "圈層名稱", type: "text" },
          { key: "specialty", label: "特色", type: "select", options: specialtyOptions },
          { key: "ownerFactionId", label: "所屬陣營", type: "select", options: context.factionOptions },
          { key: "distanceFromCapital", label: "距首都", type: "number", min: 0, step: 1 },
          { key: "buildSlots", label: "建設槽", type: "number", min: 0, step: 1 },
          { key: "fortification", label: "防禦值", type: "number", min: 0, step: 1 },
          { key: "maxFortification", label: "防禦上限", type: "number", min: 1, step: 1 },
          { key: "terrainAdvantage", label: "地形優勢", type: "number", min: 0, step: 1 },
          { key: "autoDefensePower", label: "自動防禦", type: "number", min: 0, step: 1 },
          { key: "garrisonSlots", label: "駐防上限", type: "number", min: 0, step: 1 },
          { key: "siegeResistance", label: "攻城抗性", type: "number", min: 0, step: 1 },
          { key: "isCapital", label: "首都", type: "boolean" },
          { key: "bossName", label: "Boss 名稱", type: "text" },
          { key: "bossHp", label: "Boss HP", type: "number", min: 0, step: 1 },
          { key: "bossAttack", label: "Boss 攻擊", type: "number", min: 0, step: 1 },
          { key: "rewardGold", label: "獎勵金幣", type: "number", min: 0, step: 1 },
          { key: "rewardMaterials", label: "獎勵材料", type: "number", min: 0, step: 1 }
        ]
      }
    ]
  },
  {
    key: "siegeRules",
    label: "攻城規則",
    description: "調整長戰場時間、回合間隔、精力消耗與城防損耗。",
    groups: () => [
      {
        type: "object",
        key: "",
        label: "攻城戰規則",
        fields: [
          { key: "durationMinutes", label: "戰場分鐘", type: "number", min: 1, step: 1 },
          { key: "tickIntervalSeconds", label: "回合秒數", type: "number", min: 10, step: 1 },
          { key: "baseEnergyCost", label: "基礎精力消耗", type: "number", min: 1, step: 1 },
          { key: "minorFortificationDamage", label: "輕微城防損耗", type: "number", min: 0, step: 1 },
          { key: "breakthroughMultiplier", label: "突破倍率", type: "number", min: 0.01, step: 0.01 },
          { key: "defenderTerrainMultiplier", label: "守方地形倍率", type: "number", min: 0.5, step: 0.01 },
          { key: "autoDefenseScaling", label: "自動防禦倍率", type: "number", min: 0, step: 0.01 },
          { key: "minAttackerEnergy", label: "發起最低精力", type: "number", min: 0, step: 1 }
        ]
      }
    ]
  },
  {
    key: "statRules",
    label: "屬性規則",
    description: "調整 8 屬性在攻城、守城、續戰與成長中的係數摘要。",
    groups: () =>
      [
        ["attack", "攻擊"],
        ["defense", "防禦"],
        ["luck", "運氣"],
        ["intelligence", "智慧"],
        ["vitality", "體力"],
        ["spirit", "精神"],
        ["technique", "技巧"],
        ["tenacity", "韌性"]
      ].map(([key, label]) => ({
        type: "object" as const,
        key,
        label,
        fields: [
          { key: "attackPower", label: "攻方戰力", type: "number" as const, step: 0.1 },
          { key: "defensePower", label: "守方戰力", type: "number" as const, step: 0.1 },
          { key: "sustain", label: "續戰", type: "number" as const, step: 0.1 },
          { key: "siege", label: "攻城器械", type: "number" as const, step: 0.1 },
          { key: "growth", label: "成長權重", type: "number" as const, step: 0.1 },
          { key: "summary", label: "詳細摘要", type: "textarea" as const }
        ]
      }))
  },
  {
    key: "factions",
    label: "陣營",
    description: "調整陣營描述、顏色、外交、公庫與塔進度。",
    groups: (context) => [
      {
        type: "array",
        key: "",
        label: "陣營列表",
        itemLabel: "陣營",
        createItem: () => ({
          id: "new_faction",
          name: "新陣營",
          color: "#d6ad5d",
          description: "",
          leaderUserId: null,
          allyIds: [],
          warTargetIds: [],
          treasury: { gold: 0, materials: 0 },
          tower: { unlocked: false, currentLayer: 1, highestClearedLayer: 0, bossName: "", bossHp: 100, rewardSummary: "", progress: 0 }
        }),
        fields: [
          { key: "id", label: "ID", type: "text" },
          { key: "name", label: "名稱", type: "text" },
          { key: "color", label: "顏色", type: "text" },
          { key: "description", label: "描述", type: "textarea" },
          { key: "leaderUserId", label: "領袖 User ID", type: "text" },
          { key: "allyIds", label: "盟友", type: "multiselect", options: context.factionOptions },
          { key: "warTargetIds", label: "敵對", type: "multiselect", options: context.factionOptions },
          { key: "treasury.gold", label: "公庫金幣", type: "number", min: 0, step: 1 },
          { key: "treasury.materials", label: "公庫材料", type: "number", min: 0, step: 1 },
          { key: "tower.unlocked", label: "開放陣營塔", type: "boolean" },
          { key: "tower.currentLayer", label: "目前層數", type: "number", min: 1, step: 1 },
          { key: "tower.highestClearedLayer", label: "最高通關", type: "number", min: 0, step: 1 },
          { key: "tower.bossName", label: "塔 Boss", type: "text" },
          { key: "tower.bossHp", label: "塔 Boss HP", type: "number", min: 1, step: 1 },
          { key: "tower.rewardSummary", label: "塔獎勵", type: "text" },
          { key: "tower.progress", label: "塔進度", type: "number", min: 0, step: 1 }
        ]
      }
    ]
  },
  {
    key: "shop",
    label: "商店",
    description: "調整 NPC 商店物品、價格、裝備部位、稀有度與數值。",
    createItem: makeShopItem,
    groups: () => [
      {
        type: "array",
        key: "",
        label: "商品列表",
        itemLabel: "商品",
        createItem: makeShopItem,
        fields: [
          { key: "id", label: "ID", type: "text" },
          { key: "name", label: "名稱", type: "text" },
          { key: "category", label: "分類", type: "select", options: categoryOptions },
          { key: "price", label: "價格", type: "number", min: 0, step: 1 },
          { key: "description", label: "描述", type: "textarea" },
          { key: "effectSummary", label: "效果摘要", type: "text" },
          { key: "equipmentSlot", label: "裝備部位", type: "select", options: [{ value: "", label: "無" }, ...slotOptions] },
          { key: "rarity", label: "稀有度", type: "select", options: [{ value: "", label: "未指定" }, ...rarityOptions] },
          { key: "attackBonus", label: "攻擊加成", type: "number", min: 0, step: 1 },
          { key: "defenseBonus", label: "防禦加成", type: "number", min: 0, step: 1 },
          { key: "luckBonus", label: "運氣加成", type: "number", min: 0, step: 1 },
          { key: "hpBonus", label: "HP 加成", type: "number", min: 0, step: 1 },
          { key: "mpBonus", label: "MP 加成", type: "number", min: 0, step: 1 },
          { key: "energyBonus", label: "體力加成", type: "number", min: 0, step: 1 },
          { key: "durability", label: "耐久", type: "number", min: 0, step: 1 },
          { key: "maxDurability", label: "耐久上限", type: "number", min: 0, step: 1 },
          ...statFields.map((field) => ({ ...field, key: `statBonus.${field.key}` }))
        ]
      }
    ]
  },
  {
    key: "forge",
    label: "鍛造",
    description: "調整鍛造配方、材料成本、耐久與推薦材料。",
    createItem: makeForgeOption,
    groups: (context) => [
      {
        type: "array",
        key: "",
        label: "配方列表",
        itemLabel: "配方",
        createItem: makeForgeOption,
        fields: [
          { key: "id", label: "ID", type: "text" },
          { key: "name", label: "名稱", type: "text" },
          { key: "equipmentSlot", label: "裝備部位", type: "select", options: slotOptions },
          { key: "materialCost", label: "材料成本", type: "number", min: 0, step: 1 },
          { key: "effectSummary", label: "效果摘要", type: "text" },
          { key: "attackBonus", label: "攻擊加成", type: "number", min: 0, step: 1 },
          { key: "defenseBonus", label: "防禦加成", type: "number", min: 0, step: 1 },
          { key: "luckBonus", label: "運氣加成", type: "number", min: 0, step: 1 },
          { key: "durability", label: "耐久", type: "number", min: 1, step: 1 },
          { key: "maxDurability", label: "耐久上限", type: "number", min: 1, step: 1 },
          { key: "recommendedMaterials", label: "推薦材料", type: "multiselect", options: context.resourceOptions },
          ...statFields.map((field) => ({ ...field, key: `statBonus.${field.key}` }))
        ]
      }
    ]
  },
  {
    key: "announcements",
    label: "公告",
    description: "管理公告標題、內容、啟用狀態與建立時間。",
    createItem: makeAnnouncement,
    groups: () => [
      {
        type: "array",
        key: "",
        label: "公告列表",
        itemLabel: "公告",
        createItem: makeAnnouncement,
        fields: [
          { key: "id", label: "ID", type: "text" },
          { key: "title", label: "標題", type: "text" },
          { key: "body", label: "內容", type: "textarea" },
          { key: "active", label: "啟用", type: "boolean" },
          { key: "createdAt", label: "建立時間", type: "datetime" }
        ]
      }
    ]
  }
];

function battleFields(): FieldDef[] {
  return [
    { key: "label", label: "名稱", type: "text" },
    { key: "hp", label: "怪物 HP", type: "number", min: 1, step: 1 },
    { key: "attack", label: "怪物攻擊", type: "number", min: 1, step: 1 },
    { key: "gold", label: "金幣", type: "number", min: 0, step: 1 },
    { key: "exp", label: "經驗", type: "number", min: 0, step: 1 },
    { key: "qty", label: "材料數量", type: "number", min: 0, step: 1 },
    { key: "risk", label: "風險文字", type: "text" }
  ];
}

function rewardGroups(context: EditorContext): GroupDef[] {
  const schedule = (key: string, label: string): GroupDef => ({
    type: "object",
    key,
    label,
    fields: [
      { key: "title", label: "標題", type: "text" },
      { key: "active", label: "啟用", type: "boolean" },
      { key: "startAt", label: "開始時間", type: "datetime" },
      { key: "endAt", label: "結束時間", type: "datetime" },
      { key: "reward.gold", label: "金幣", type: "number", min: 0, step: 1 }
    ]
  });
  return [
    schedule("dailyRewardConfig", "每日獎勵"),
    {
      type: "array",
      key: "dailyRewardConfig.reward.materials",
      label: "每日材料",
      itemLabel: "材料",
      createItem: makeRewardMaterial,
      fields: [
        { key: "materialType", label: "材料", type: "select", options: context.resourceOptions },
        { key: "quantity", label: "數量", type: "number", min: 0, step: 1 }
      ]
    },
    {
      type: "array",
      key: "dailyRewardConfig.reward.itemGrants",
      label: "每日贈品",
      itemLabel: "贈品",
      createItem: makeRewardItem,
      fields: [{ key: "shopItemId", label: "商店物品", type: "select", options: [{ value: "", label: "不使用" }, ...context.shopOptions] }]
    },
    schedule("flashEventConfig", "突發活動"),
    {
      type: "array",
      key: "flashEventConfig.reward.materials",
      label: "突發材料",
      itemLabel: "材料",
      createItem: makeRewardMaterial,
      fields: [
        { key: "materialType", label: "材料", type: "select", options: context.resourceOptions },
        { key: "quantity", label: "數量", type: "number", min: 0, step: 1 }
      ]
    },
    {
      type: "array",
      key: "flashEventConfig.reward.itemGrants",
      label: "突發贈品",
      itemLabel: "贈品",
      createItem: makeRewardItem,
      fields: [{ key: "shopItemId", label: "商店物品", type: "select", options: [{ value: "", label: "不使用" }, ...context.shopOptions] }]
    }
  ];
}

function sectionValue(config: AdminGameConfigResponse, section: AdminConfigSection) {
  if (section === "classes") return config.classes;
  if (section === "secondaryCharacters") return config.gameConfig.secondaryCharacters;
  if (section === "specialSkills") return config.gameConfig.specialSkills;
  if (section === "battle") return config.gameConfig.soloDifficulties;
  if (section === "rewards") return config.rewards;
  if (section === "castles") return config.castles;
  if (section === "factions") return config.factions;
  if (section === "shop") return config.gameConfig.shopItems;
  if (section === "forge") return config.gameConfig.forgeOptions;
  if (section === "siegeRules") return config.gameConfig.siegeRules;
  if (section === "statRules") return config.gameConfig.statRules;
  return config.announcements;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function getAt(source: any, path: string) {
  if (!path) return source;
  return path.split(".").reduce((current, key) => current?.[key], source);
}

function setAt(source: any, path: string, value: unknown) {
  if (!path) return value;
  const keys = path.split(".");
  const next = Array.isArray(source) ? [...source] : { ...(source || {}) };
  let cursor: AnyRecord = next;
  keys.slice(0, -1).forEach((key) => {
    cursor[key] = Array.isArray(cursor[key]) ? [...cursor[key]] : { ...(cursor[key] || {}) };
    cursor = cursor[key];
  });
  cursor[keys[keys.length - 1]] = value === "" ? undefined : value;
  return next;
}

function toDateTimeInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function fromDateTimeInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function optionLabel(options: Option[] | undefined, value: string) {
  return options?.find((option) => option.value === value)?.label || value;
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("admin-token") || "");
  const [email, setEmail] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [userRole, setUserRole] = useState<"player" | "admin" | null>(null);
  const [config, setConfig] = useState<AdminGameConfigResponse | null>(null);
  const [activeSection, setActiveSection] = useState<AdminConfigSection>("specialSkills");
  const [draft, setDraft] = useState<any>(null);
  const [feedback, setFeedback] = useState("尚未載入設定。");

  const activeDef = useMemo(() => sections.find((section) => section.key === activeSection) || sections[0], [activeSection]);
  const editorContext = useMemo<EditorContext>(() => {
    const shopItems = config?.gameConfig.shopItems || [];
    const skills = config?.gameConfig.specialSkills || [];
    return {
      resourceOptions: [
        { value: "iron_ore", label: "鐵礦" },
        { value: "copper_ore", label: "銅礦" },
        { value: "silver_ore", label: "銀礦" },
        { value: "obsidian_ore", label: "黑曜石" },
        { value: "stardust", label: "星塵" },
        { value: "leather", label: "皮革" },
        { value: "cloth", label: "布料" },
        { value: "bone", label: "骨材" }
      ],
      factionOptions: (config?.factions || []).map((faction) => ({ value: faction.id, label: faction.name })),
      castleOptions: (config?.castles || []).map((castle) => ({ value: castle.id, label: castle.name })),
      shopOptions: shopItems.map((item) => ({ value: item.id, label: item.name })),
      skillOptions: skills.map((skill) => ({ value: skill.id, label: skill.name }))
    };
  }, [config]);

  async function refresh(nextToken = token, nextSection = activeSection) {
    if (!nextToken) return;
    const next = await getAdminGameConfig(nextToken);
    setConfig(next);
    setDraft(clone(sectionValue(next, nextSection)));
    setFeedback("設定已更新。");
  }

  useEffect(() => {
    if (token) void refresh(token).catch((error) => setFeedback(error instanceof Error ? error.message : "載入失敗。"));
  }, []);

  useEffect(() => {
    if (config) setDraft(clone(sectionValue(config, activeSection)));
  }, [activeSection, config]);

  async function handleLogin() {
    try {
      setFeedback("登入中...");
      const result = await login({ email, password });
      setUserRole(result.user.role);
      if (result.user.role !== "admin") {
        setFeedback("目前帳號不是 admin，不能管理參數。");
        return;
      }
      localStorage.setItem("admin-token", result.token);
      setToken(result.token);
      await refresh(result.token);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "登入失敗。");
    }
  }

  async function handleSave() {
    if (!token || draft == null) return;
    try {
      setFeedback("儲存中...");
      const next = await updateAdminGameConfigSection(token, activeSection, draft);
      setConfig(next);
      setDraft(clone(sectionValue(next, activeSection)));
      setFeedback(`${activeDef.label} 已儲存。`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "儲存失敗。");
    }
  }

  async function handleReset() {
    if (!token) return;
    try {
      setFeedback("還原中...");
      const next = await resetAdminGameConfigSection(token, activeSection);
      setConfig(next);
      setDraft(clone(sectionValue(next, activeSection)));
      setFeedback(`${activeDef.label} 已還原預設。`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "還原失敗。");
    }
  }

  function updateDraft(path: string, value: unknown) {
    setDraft((current: any) => setAt(current, path, value));
  }

  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <div>
          <span className="eyebrow">Admin Console</span>
          <h1>遊戲參數管理</h1>
          <p>用表單直接調整各分類參數，儲存時只更新目前分類。</p>
        </div>
        <div className="login-card">
          <label>
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            <span>Password</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </label>
          <button onClick={() => void handleLogin()} type="button">登入後台</button>
          {userRole === "player" ? <strong className="danger">此帳號沒有 admin 權限。</strong> : null}
        </div>
        <nav>
          {sections.map((section) => (
            <button key={section.key} className={activeSection === section.key ? "active" : ""} onClick={() => setActiveSection(section.key)} type="button">
              <strong>{section.label}</strong>
              <span>{section.description}</span>
            </button>
          ))}
        </nav>
      </aside>
      <section className="workspace">
        <header>
          <div>
            <span className="eyebrow">{activeSection}</span>
            <h2>{activeDef.label}</h2>
            <p>{activeDef.description}</p>
          </div>
          <div className="actions">
            <button onClick={() => void refresh()} type="button"><RefreshCw size={16} />重新載入</button>
            <button onClick={() => void handleReset()} type="button"><RotateCcw size={16} />還原預設</button>
            <button className="primary" onClick={() => void handleSave()} type="button"><Save size={16} />儲存</button>
          </div>
        </header>

        <div className="editor">
          {draft == null ? (
            <div className="empty-state">請先登入並載入參數。</div>
          ) : (
            activeDef.groups(editorContext).map((group) => (
              <EditorGroup key={`${group.type}:${group.key}:${group.label}`} group={group} value={draft} onChange={updateDraft} />
            ))
          )}
        </div>
        <footer>{feedback}</footer>
      </section>
    </main>
  );
}

function EditorGroup({ group, value, onChange }: { group: GroupDef; value: unknown; onChange: (path: string, value: unknown) => void }) {
  if (group.type === "object") {
    const objectValue = (getAt(value, group.key) || {}) as AnyRecord;
    return (
      <section className="panel">
        <div className="panel-title">
          <h3>{group.label}</h3>
        </div>
        <FieldGrid fields={group.fields} value={objectValue} onChange={(field, next) => onChange(group.key ? `${group.key}.${field}` : field, next)} />
      </section>
    );
  }

  const rows = (getAt(value, group.key) || []) as AnyRecord[];
  return (
    <section className="panel">
      <div className="panel-title">
        <h3>{group.label}</h3>
        <button className="icon-button" onClick={() => onChange(group.key, [...rows, group.createItem()])} type="button" title={`新增${group.itemLabel}`}>
          <Plus size={16} />
        </button>
      </div>
      <div className="row-list">
        {rows.map((row, index) => (
          <article className="row-card" key={`${row.id || row.name || group.itemLabel}-${index}`}>
            <div className="row-card-title">
              <strong>{row.name || row.title || `${group.itemLabel} ${index + 1}`}</strong>
              <button
                className="icon-button danger-button"
                onClick={() => onChange(group.key, rows.filter((_, rowIndex) => rowIndex !== index))}
                type="button"
                title="刪除"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <FieldGrid
              fields={group.fields}
              value={row}
              onChange={(field, next) => {
                const nextRows = [...rows];
                nextRows[index] = setAt(row, field, next) as AnyRecord;
                onChange(group.key, nextRows);
              }}
            />
          </article>
        ))}
      </div>
    </section>
  );
}

function FieldGrid({ fields, value, onChange }: { fields: FieldDef[]; value: AnyRecord; onChange: (field: string, value: unknown) => void }) {
  return (
    <div className="field-grid">
      {fields.map((field) => (
        <Fragment key={field.key}>
          <FieldEditor field={field} value={getAt(value, field.key)} onChange={(next) => onChange(field.key, next)} />
        </Fragment>
      ))}
    </div>
  );
}

function FieldEditor({ field, value, onChange }: { field: FieldDef; value: any; onChange: (value: unknown) => void }) {
  if (field.type === "boolean") {
    return (
      <label className="field toggle-field">
        <span>{field.label}</span>
        <button className={value ? "toggle on" : "toggle"} onClick={() => onChange(!value)} type="button">{value ? "啟用" : "停用"}</button>
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="field wide-field">
        <span>{field.label}</span>
        <textarea value={value || ""} onChange={(event) => onChange(event.target.value)} rows={3} />
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label className="field">
        <span>{field.label}</span>
        <select value={value || ""} onChange={(event) => onChange(event.target.value)}>
          {(field.options || []).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "multiselect") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <label className="field wide-field">
        <span>{field.label}</span>
        <select
          multiple
          value={selected}
          onChange={(event) => onChange(Array.from(event.target.selectedOptions).map((option) => option.value))}
        >
          {(field.options || []).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <small>{selected.length ? selected.map((entry) => optionLabel(field.options, entry)).join("、") : "未選擇"}</small>
      </label>
    );
  }

  if (field.type === "datetime") {
    return (
      <label className="field">
        <span>{field.label}</span>
        <input type="datetime-local" value={toDateTimeInput(value)} onChange={(event) => onChange(fromDateTimeInput(event.target.value))} />
      </label>
    );
  }

  if (field.type === "number") {
    return (
      <label className="field">
        <span>{field.label}</span>
        <input
          max={field.max}
          min={field.min}
          step={field.step || 1}
          type="number"
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
        />
      </label>
    );
  }

  return (
    <label className="field">
      <span>{field.label}</span>
      <input value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
