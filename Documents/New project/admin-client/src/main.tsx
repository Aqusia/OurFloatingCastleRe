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
    key: "towerRules",
    label: "爬塔規則",
    description: "調整趕路 / 攻擊推進、Boss 遭遇、小王遭遇、能量成本與獎勵倍率。",
    groups: () => [
      {
        type: "object",
        key: "",
        label: "推進與遭遇",
        fields: [
          { key: "baseStepsRequired", label: "基礎步數", type: "number", min: 3, step: 1 },
          { key: "stepsPerSceneBand", label: "每 5 層增加步數", type: "number", min: 0, step: 1 },
          { key: "maxStepsRequired", label: "最大步數", type: "number", min: 3, step: 1 },
          { key: "rushEnergyCost", label: "趕路精力", type: "number", min: 1, step: 1 },
          { key: "huntEnergyCost", label: "攻擊精力", type: "number", min: 1, step: 1 },
          { key: "rushDoubleStepChance", label: "趕路 +2 步率", type: "number", min: 0, max: 1, step: 0.01 },
          { key: "rushSingleStepChance", label: "趕路 +1 步率", type: "number", min: 0, max: 1, step: 0.01 },
          { key: "huntStepChance", label: "攻擊前進率", type: "number", min: 0, max: 1, step: 0.01 },
          { key: "bossFindChanceRush", label: "趕路找王率", type: "number", min: 0, max: 1, step: 0.01 },
          { key: "bossFindChanceHunt", label: "攻擊找王率", type: "number", min: 0, max: 1, step: 0.01 },
          { key: "minorBossChanceRush", label: "趕路小王率", type: "number", min: 0, max: 1, step: 0.01 },
          { key: "minorBossChanceHunt", label: "攻擊小王率", type: "number", min: 0, max: 1, step: 0.01 },
          { key: "bossHpMultiplier", label: "Boss HP 倍率", type: "number", min: 0.2, step: 0.05 },
          { key: "bossAttackMultiplier", label: "Boss 攻擊倍率", type: "number", min: 0.2, step: 0.05 },
          { key: "rewardMultiplier", label: "獎勵倍率", type: "number", min: 0.1, step: 0.05 }
        ]
      }
    ]
  },
  {
    key: "playerAttackRules",
    label: "玩家遭遇",
    description: "調整同地點玩家攻擊的精力成本、回合數、金幣繳獲與勝敗經驗。",
    groups: () => [
      {
        type: "object",
        key: "",
        label: "同地點攻擊規則",
        fields: [
          { key: "energyCost", label: "發起精力", type: "number", min: 1, step: 1 },
          { key: "maxRounds", label: "最多回合", type: "number", min: 1, max: 12, step: 1 },
          { key: "attackerWinBattleExp", label: "攻方勝利經驗", type: "number", min: 0, step: 1 },
          { key: "attackerLoseBattleExp", label: "攻方失敗經驗", type: "number", min: 0, step: 1 },
          { key: "defenderWinBattleExp", label: "守方勝利經驗", type: "number", min: 0, step: 1 },
          { key: "defenderLoseBattleExp", label: "守方失敗經驗", type: "number", min: 0, step: 1 },
          { key: "baseGoldSteal", label: "基礎繳獲金幣", type: "number", min: 0, step: 1 },
          { key: "goldStealPerBattleLevel", label: "每戰鬥等級金幣", type: "number", min: 0, step: 0.1 },
          { key: "goldStealLuckMultiplier", label: "運氣金幣倍率", type: "number", min: 0, step: 0.1 },
          { key: "minGoldSteal", label: "最低繳獲金幣", type: "number", min: 0, step: 1 },
          { key: "maxGoldSteal", label: "最高繳獲金幣", type: "number", min: 0, step: 1 }
        ]
      }
    ]
  },
  {
    key: "worldBossRules",
    label: "世界 Boss",
    description: "調整世界 Boss 本體強度、回合數、首殺獎勵、重複勝利與失敗參與獎。",
    groups: (context) => [
      {
        type: "object",
        key: "",
        label: "世界 Boss 規則",
        fields: [
          { key: "bossName", label: "Boss 名稱", type: "text" },
          { key: "bossHp", label: "Boss HP", type: "number", min: 1, step: 1 },
          { key: "bossAttack", label: "Boss 攻擊", type: "number", min: 1, step: 1 },
          { key: "maxRounds", label: "最多回合", type: "number", min: 1, max: 30, step: 1 },
          { key: "rewardGold", label: "首殺公庫金幣", type: "number", min: 0, step: 1 },
          { key: "rewardMaterials", label: "首殺材料基數", type: "number", min: 0, step: 1 },
          { key: "materialType", label: "獎勵材料", type: "select", options: context.resourceOptions },
          { key: "firstWinPersonalGoldRate", label: "首殺個人金幣率", type: "number", min: 0, max: 1, step: 0.01 },
          { key: "firstWinMaterialRate", label: "首殺材料率", type: "number", min: 0, max: 1, step: 0.01 },
          { key: "firstWinBattleExp", label: "首殺戰鬥經驗", type: "number", min: 0, step: 1 },
          { key: "repeatWinPersonalGold", label: "重複勝利個人金幣", type: "number", min: 0, step: 1 },
          { key: "repeatWinGuildGold", label: "重複勝利公庫金幣", type: "number", min: 0, step: 1 },
          { key: "repeatWinBattleExp", label: "重複勝利經驗", type: "number", min: 0, step: 1 },
          { key: "lossPersonalGold", label: "失敗個人金幣", type: "number", min: 0, step: 1 },
          { key: "lossGuildGold", label: "失敗公庫金幣", type: "number", min: 0, step: 1 },
          { key: "lossBattleExp", label: "失敗戰鬥經驗", type: "number", min: 0, step: 1 },
          { key: "participationMaterials", label: "參與材料數", type: "number", min: 0, step: 1 }
        ]
      }
    ]
  },
  {
    key: "roomBossRules",
    label: "隊伍 Boss",
    description: "調整一般隊伍 Boss 的名稱、速度、強度倍率與勝敗獎勵。",
    groups: () => [
      {
        type: "object",
        key: "",
        label: "隊伍 Boss 規則",
        fields: [
          { key: "bossName", label: "Boss 名稱", type: "text" },
          { key: "tickIntervalMs", label: "回合間隔 ms", type: "number", min: 500, max: 10000, step: 100 },
          { key: "hpMultiplier", label: "HP 倍率", type: "number", min: 0.2, max: 5, step: 0.05 },
          { key: "attackMultiplier", label: "攻擊倍率", type: "number", min: 0.2, max: 5, step: 0.05 },
          { key: "winBattleExp", label: "勝利戰鬥經驗", type: "number", min: 0, step: 1 },
          { key: "lossBattleExp", label: "失敗戰鬥經驗", type: "number", min: 0, step: 1 },
          { key: "winInstinctExp", label: "勝利本能經驗", type: "number", min: 0, step: 1 },
          { key: "lossInstinctExp", label: "失敗本能經驗", type: "number", min: 0, step: 1 },
          { key: "winGold", label: "勝利金幣", type: "number", min: 0, step: 1 },
          { key: "lossGold", label: "失敗金幣", type: "number", min: 0, step: 1 }
        ]
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
  if (section === "towerRules") return config.gameConfig.towerRules;
  if (section === "playerAttackRules") return config.gameConfig.playerAttackRules;
  if (section === "worldBossRules") return config.gameConfig.worldBossRules;
  if (section === "roomBossRules") return config.gameConfig.roomBossRules;
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

function numericRule(source: AnyRecord, key: string, fallback: number) {
  const value = Number(source?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function bounded(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function evaluateTowerRules(source: AnyRecord) {
  const rushDouble = numericRule(source, "rushDoubleStepChance", 0.72);
  const rushSingle = numericRule(source, "rushSingleStepChance", 0.22);
  const huntStep = numericRule(source, "huntStepChance", 0.38);
  const bossRush = numericRule(source, "bossFindChanceRush", 0.68);
  const bossHunt = numericRule(source, "bossFindChanceHunt", 0.42);
  const minorRush = numericRule(source, "minorBossChanceRush", 0.14);
  const minorHunt = numericRule(source, "minorBossChanceHunt", 0.42);
  const rushEnergy = numericRule(source, "rushEnergyCost", 5);
  const huntEnergy = numericRule(source, "huntEnergyCost", 7);
  const baseSteps = numericRule(source, "baseStepsRequired", 5);
  const bossPressure = numericRule(source, "bossHpMultiplier", 1) * numericRule(source, "bossAttackMultiplier", 1);
  const reward = numericRule(source, "rewardMultiplier", 1);
  const expectedRushSteps = rushDouble * 2 + rushSingle;
  const speedSeparation = expectedRushSteps - huntStep;
  const encounterSeparation = minorHunt - minorRush;
  const costGap = huntEnergy - rushEnergy;

  let score =
    5.4 +
    bounded(speedSeparation * 1.3, -1.2, 1.4) +
    bounded(encounterSeparation * 2.2, -0.9, 1.2) +
    bounded((bossRush + bossHunt) * 0.75, 0, 1.1) +
    bounded(1.2 - Math.abs(bossPressure - 1.15), -0.9, 1.2) +
    bounded(reward - 0.75, -0.8, 1.1) -
    bounded((baseSteps - 7) * 0.12, -0.3, 0.7) -
    bounded(Math.abs(costGap - 2) * 0.08, 0, 0.5);
  score = Number(bounded(score, 1, 10).toFixed(1));

  const advice: string[] = [];
  if (expectedRushSteps <= huntStep + 0.25) advice.push("趕路前進優勢不明顯，玩家可能感覺兩種模式差不多。");
  if (bossRush < bossHunt) advice.push("趕路找王率低於攻擊，會削弱快速推王定位。");
  if (minorHunt <= minorRush) advice.push("攻擊模式小王率應高於趕路，刷寶定位才清楚。");
  if (bossPressure > 1.75) advice.push("Boss 壓力偏高，低等玩家可能需要先刷裝或調高獎勵。");
  if (bossPressure < 0.75) advice.push("Boss 壓力偏低，打王可能缺少緊張感。");
  if (reward < 0.8) advice.push("獎勵倍率偏低，長線推進的回饋感會弱。");
  if (baseSteps > 9) advice.push("前期步數偏長，第一層到第一隻王可能拖太久。");
  if (!advice.length) advice.push("目前節奏明確：趕路找王、攻擊刷小王，風險與獎勵平衡。");

  return {
    score,
    expectedRushSteps,
    huntStep,
    bossRush,
    bossHunt,
    minorHunt,
    bossPressure,
    reward,
    advice
  };
}

function evaluatePlayerAttackRules(source: AnyRecord) {
  const energyCost = numericRule(source, "energyCost", 12);
  const maxRounds = numericRule(source, "maxRounds", 5);
  const attackerWinExp = numericRule(source, "attackerWinBattleExp", 36);
  const attackerLoseExp = numericRule(source, "attackerLoseBattleExp", 16);
  const defenderWinExp = numericRule(source, "defenderWinBattleExp", 26);
  const defenderLoseExp = numericRule(source, "defenderLoseBattleExp", 12);
  const baseGold = numericRule(source, "baseGoldSteal", 12);
  const levelGold = numericRule(source, "goldStealPerBattleLevel", 4);
  const luckGold = numericRule(source, "goldStealLuckMultiplier", 0.8);
  const minGold = numericRule(source, "minGoldSteal", 8);
  const maxGold = numericRule(source, "maxGoldSteal", 120);
  const averageGold = bounded(baseGold + levelGold * 6 + luckGold * 12, minGold, Math.max(minGold, maxGold));
  const rewardPressure = averageGold / Math.max(1, energyCost);
  const defenderComfort = defenderWinExp - defenderLoseExp;

  let score =
    5.8 +
    bounded((6 - Math.abs(energyCost - 12)) * 0.16, -0.7, 1) +
    bounded((5 - Math.abs(maxRounds - 5)) * 0.16, -0.6, 0.8) +
    bounded((attackerWinExp - attackerLoseExp) / 25, -0.6, 1.1) +
    bounded(defenderComfort / 24, -0.6, 0.9) +
    bounded((rewardPressure - 1.5) * 0.45, -0.8, 1.1) -
    bounded(maxGold > 180 ? (maxGold - 180) / 120 : 0, 0, 1);
  score = Number(bounded(score, 1, 10).toFixed(1));

  const advice: string[] = [];
  if (energyCost < 8) advice.push("發起成本偏低，玩家可能過度騷擾同地點目標。");
  if (energyCost > 18) advice.push("發起成本偏高，玩家遭遇會變成很少使用的功能。");
  if (maxRounds < 3) advice.push("回合數太短，戰力差距不容易被打出來。");
  if (maxRounds > 8) advice.push("回合數偏長，PVP 會拖慢打王主節奏。");
  if (attackerWinExp <= attackerLoseExp) advice.push("攻方勝敗經驗差距不明顯，勝利回饋會偏弱。");
  if (defenderWinExp <= defenderLoseExp) advice.push("守方成功防守的回饋應高於被擊敗，才有防守感。");
  if (averageGold < 18) advice.push("金幣繳獲偏低，玩家可能只把遭遇當成戰報而不是玩法。");
  if (maxGold > 220) advice.push("最高繳獲偏高，容易讓高等玩家搶金幣收益過大。");
  if (!advice.length) advice.push("目前節奏穩定：成本能限制濫用，勝敗經驗與金幣繳獲都有明確差異。");

  return {
    score,
    energyCost,
    maxRounds,
    averageGold,
    rewardPressure,
    attackerWinExp,
    attackerLoseExp,
    defenderWinExp,
    defenderLoseExp,
    advice
  };
}

function evaluateWorldBossRules(source: AnyRecord) {
  const bossHp = numericRule(source, "bossHp", 520);
  const bossAttack = numericRule(source, "bossAttack", 34);
  const maxRounds = numericRule(source, "maxRounds", 12);
  const rewardGold = numericRule(source, "rewardGold", 420);
  const rewardMaterials = numericRule(source, "rewardMaterials", 8);
  const firstGoldRate = numericRule(source, "firstWinPersonalGoldRate", 0.35);
  const firstMaterialRate = numericRule(source, "firstWinMaterialRate", 0.5);
  const firstExp = numericRule(source, "firstWinBattleExp", 120);
  const repeatGold = numericRule(source, "repeatWinPersonalGold", 60);
  const repeatGuild = numericRule(source, "repeatWinGuildGold", 80);
  const repeatExp = numericRule(source, "repeatWinBattleExp", 70);
  const lossGold = numericRule(source, "lossPersonalGold", 24);
  const lossGuild = numericRule(source, "lossGuildGold", 30);
  const lossExp = numericRule(source, "lossBattleExp", 32);
  const participationMaterials = numericRule(source, "participationMaterials", 1);
  const pressure = (bossHp * bossAttack) / Math.max(1, maxRounds * 1500);
  const firstPersonalGold = rewardGold * firstGoldRate;
  const firstMaterials = rewardMaterials * firstMaterialRate;
  const participationValue = lossGold + lossGuild * 0.35 + lossExp * 0.5 + participationMaterials * 16;
  const repeatValue = repeatGold + repeatGuild * 0.35 + repeatExp * 0.5;

  let score =
    5.9 +
    bounded(1.2 - Math.abs(pressure - 1), -1.2, 1.2) +
    bounded((firstPersonalGold - 120) / 160, -0.7, 1) +
    bounded((firstExp - 90) / 90, -0.6, 0.9) +
    bounded((repeatValue - participationValue) / 120, -0.7, 0.9) +
    bounded(firstMaterials / 6 - 0.45, -0.5, 0.7) -
    bounded(maxRounds > 18 ? (maxRounds - 18) * 0.08 : 0, 0, 0.7);
  score = Number(bounded(score, 1, 10).toFixed(1));

  const advice: string[] = [];
  if (pressure > 1.35) advice.push("Boss 壓力偏高，可能只有高等或運氣好才打得過。");
  if (pressure < 0.65) advice.push("Boss 壓力偏低，世界 Boss 競賽可能太快結束。");
  if (maxRounds < 8) advice.push("回合數偏短，連擊職業和副角色技能不容易展開。");
  if (maxRounds > 18) advice.push("回合數偏長，單次挑戰會拖慢戰鬥頁節奏。");
  if (firstPersonalGold < 80) advice.push("首殺個人金幣偏低，玩家可能只感覺公會有賺。");
  if (repeatValue <= participationValue) advice.push("重複勝利獎應高於失敗參與獎，否則打贏後續挑戰回饋不明顯。");
  if (participationValue < 35) advice.push("失敗參與獎偏低，玩家可能不願意試打世界 Boss。");
  if (!advice.length) advice.push("目前節奏穩定：Boss 有壓力，首殺有爆點，失敗也有參與回饋。");

  return {
    score,
    pressure,
    firstPersonalGold,
    firstMaterials,
    repeatValue,
    participationValue,
    maxRounds,
    rewardGold,
    advice
  };
}

function WorldBossRulesScorePanel({ rules }: { rules: AnyRecord }) {
  const result = evaluateWorldBossRules(rules);
  return (
    <section className="tuning-panel">
      <div className="tuning-score">
        <span>FUN SCORE</span>
        <strong>{result.score.toFixed(1)} / 10</strong>
        <small>{result.score >= 8 ? "世界 Boss 有吸引力" : result.score >= 7 ? "可玩性穩定" : "需要調整壓力"}</small>
      </div>
      <div className="tuning-metrics">
        <div><span>Boss 壓力</span><strong>{result.pressure.toFixed(2)}x</strong></div>
        <div><span>最多回合</span><strong>{result.maxRounds}</strong></div>
        <div><span>首殺公庫</span><strong>{result.rewardGold}</strong></div>
        <div><span>首殺個人</span><strong>{Math.round(result.firstPersonalGold)}</strong></div>
        <div><span>首殺材料</span><strong>{Math.round(result.firstMaterials)}</strong></div>
        <div><span>勝 / 敗價值</span><strong>{Math.round(result.repeatValue)} / {Math.round(result.participationValue)}</strong></div>
      </div>
      <div className="tuning-advice">
        <strong>調參建議</strong>
        {result.advice.map((entry) => <p key={entry}>{entry}</p>)}
      </div>
    </section>
  );
}

function evaluateRoomBossRules(source: AnyRecord) {
  const tickIntervalMs = numericRule(source, "tickIntervalMs", 2000);
  const hpMultiplier = numericRule(source, "hpMultiplier", 1);
  const attackMultiplier = numericRule(source, "attackMultiplier", 1);
  const winBattleExp = numericRule(source, "winBattleExp", 18);
  const lossBattleExp = numericRule(source, "lossBattleExp", 8);
  const winInstinctExp = numericRule(source, "winInstinctExp", 10);
  const lossInstinctExp = numericRule(source, "lossInstinctExp", 4);
  const winGold = numericRule(source, "winGold", 36);
  const lossGold = numericRule(source, "lossGold", 12);
  const pressure = hpMultiplier * attackMultiplier;
  const pace = 2000 / Math.max(500, tickIntervalMs);
  const winValue = winGold + winBattleExp * 1.8 + winInstinctExp * 1.2;
  const lossValue = lossGold + lossBattleExp * 1.4 + lossInstinctExp;

  let score =
    5.7 +
    bounded(1.15 - Math.abs(pressure - 1.05), -1, 1.15) +
    bounded(0.85 - Math.abs(pace - 1), -0.7, 0.85) +
    bounded((winValue - lossValue) / 90, -0.6, 1) +
    bounded((lossValue - 18) / 55, -0.5, 0.7) -
    bounded(tickIntervalMs < 900 ? (900 - tickIntervalMs) / 600 : 0, 0, 0.7);
  score = Number(bounded(score, 1, 10).toFixed(1));

  const advice: string[] = [];
  if (pressure > 1.6) advice.push("Boss 壓力偏高，一般隊伍可能頻繁失敗。");
  if (pressure < 0.65) advice.push("Boss 壓力偏低，隊伍戰可能太快結束。");
  if (tickIntervalMs < 1000) advice.push("回合間隔偏短，戰報與連擊動畫可能讀不清楚。");
  if (tickIntervalMs > 3500) advice.push("回合間隔偏長，隊伍戰等待感會變重。");
  if (winValue <= lossValue) advice.push("勝利獎應明顯高於失敗獎，否則開打動機會弱。");
  if (lossValue < 18) advice.push("失敗獎偏低，低等隊伍試打成本感會太高。");
  if (!advice.length) advice.push("目前節奏穩定：隊伍戰有壓力、回合速度可讀、勝敗獎勵差距明確。");

  return { score, pressure, pace, tickIntervalMs, winValue, lossValue, winBattleExp, lossBattleExp, winGold, lossGold, advice };
}

function RoomBossRulesScorePanel({ rules }: { rules: AnyRecord }) {
  const result = evaluateRoomBossRules(rules);
  return (
    <section className="tuning-panel">
      <div className="tuning-score">
        <span>FUN SCORE</span>
        <strong>{result.score.toFixed(1)} / 10</strong>
        <small>{result.score >= 8 ? "隊伍戰節奏好" : result.score >= 7 ? "可玩性穩定" : "需要調整壓力"}</small>
      </div>
      <div className="tuning-metrics">
        <div><span>Boss 壓力</span><strong>{result.pressure.toFixed(2)}x</strong></div>
        <div><span>回合間隔</span><strong>{result.tickIntervalMs}ms</strong></div>
        <div><span>節奏倍率</span><strong>{result.pace.toFixed(2)}x</strong></div>
        <div><span>勝 / 敗價值</span><strong>{Math.round(result.winValue)} / {Math.round(result.lossValue)}</strong></div>
        <div><span>勝敗 EXP</span><strong>{result.winBattleExp} / {result.lossBattleExp}</strong></div>
        <div><span>勝敗金幣</span><strong>{result.winGold} / {result.lossGold}</strong></div>
      </div>
      <div className="tuning-advice">
        <strong>調參建議</strong>
        {result.advice.map((entry) => <p key={entry}>{entry}</p>)}
      </div>
    </section>
  );
}

function PlayerAttackRulesScorePanel({ rules }: { rules: AnyRecord }) {
  const result = evaluatePlayerAttackRules(rules);
  return (
    <section className="tuning-panel">
      <div className="tuning-score">
        <span>FUN SCORE</span>
        <strong>{result.score.toFixed(1)} / 10</strong>
        <small>{result.score >= 8 ? "遭遇節奏好" : result.score >= 7 ? "可玩性穩定" : "需要調整風險"}</small>
      </div>
      <div className="tuning-metrics">
        <div><span>發起精力</span><strong>{result.energyCost}</strong></div>
        <div><span>最多回合</span><strong>{result.maxRounds}</strong></div>
        <div><span>預估繳獲</span><strong>{Math.round(result.averageGold)}</strong></div>
        <div><span>金幣 / 精力</span><strong>{result.rewardPressure.toFixed(1)}</strong></div>
        <div><span>攻方勝敗 EXP</span><strong>{result.attackerWinExp} / {result.attackerLoseExp}</strong></div>
        <div><span>守方勝敗 EXP</span><strong>{result.defenderWinExp} / {result.defenderLoseExp}</strong></div>
      </div>
      <div className="tuning-advice">
        <strong>調參建議</strong>
        {result.advice.map((entry) => <p key={entry}>{entry}</p>)}
      </div>
    </section>
  );
}

function TowerRulesScorePanel({ rules }: { rules: AnyRecord }) {
  const result = evaluateTowerRules(rules);
  return (
    <section className="tuning-panel">
      <div className="tuning-score">
        <span>FUN SCORE</span>
        <strong>{result.score.toFixed(1)} / 10</strong>
        <small>{result.score >= 8 ? "節奏偏好玩" : result.score >= 7 ? "可玩性穩定" : "需要調整節奏"}</small>
      </div>
      <div className="tuning-metrics">
        <div><span>趕路期望步數</span><strong>{result.expectedRushSteps.toFixed(2)}</strong></div>
        <div><span>攻擊前進率</span><strong>{Math.round(result.huntStep * 100)}%</strong></div>
        <div><span>趕路找王率</span><strong>{Math.round(result.bossRush * 100)}%</strong></div>
        <div><span>攻擊找王率</span><strong>{Math.round(result.bossHunt * 100)}%</strong></div>
        <div><span>攻擊小王率</span><strong>{Math.round(result.minorHunt * 100)}%</strong></div>
        <div><span>Boss 壓力</span><strong>{result.bossPressure.toFixed(2)}x</strong></div>
      </div>
      <div className="tuning-advice">
        <strong>調參建議</strong>
        {result.advice.map((entry) => <p key={entry}>{entry}</p>)}
      </div>
    </section>
  );
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
            <>
              {activeSection === "towerRules" ? <TowerRulesScorePanel rules={draft as AnyRecord} /> : null}
              {activeSection === "playerAttackRules" ? <PlayerAttackRulesScorePanel rules={draft as AnyRecord} /> : null}
              {activeSection === "worldBossRules" ? <WorldBossRulesScorePanel rules={draft as AnyRecord} /> : null}
              {activeSection === "roomBossRules" ? <RoomBossRulesScorePanel rules={draft as AnyRecord} /> : null}
              {activeDef.groups(editorContext).map((group) => (
                <EditorGroup key={`${group.type}:${group.key}:${group.label}`} group={group} value={draft} onChange={updateDraft} />
              ))}
            </>
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
