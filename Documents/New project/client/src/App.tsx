import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  Backpack,
  BatteryCharging,
  Castle,
  Coins,
  Dumbbell,
  Footprints,
  Hammer,
  HeartPulse,
  LogOut,
  MapPinned,
  MessageSquareText,
  ShieldCheck,
  Skull,
  Sparkles,
  Store,
  ScrollText,
  Swords,
  Trophy,
  TowerControl,
  UserRound,
  UsersRound,
  Wifi,
  WifiOff
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  ActionType,
  AdminState,
  Announcement,
  AuthPayload,
  AuthUser,
  AchievementProgress,
  BattleRecordSummary,
  BattleSpecialEvent,
  BattleSummary,
  BattleTickEvent,
  CastleState,
  CharacterClass,
  CharacterCatalogPayload,
  CharacterProfile,
  EquipmentSlotKey,
  FactionState,
  FactionTechKey,
  FactionTowerProgress,
  ForgeOption,
  ForgeRecipe,
  FriendSummary,
  InventoryItem,
  InventorySortPayload,
  MarketListing,
  MaterialType,
  NotificationEntry,
  RegisterPayload,
  RewardTemplate,
  RoomState,
  RoomSummary,
  ShopItem,
  SignInStatus,
  SoloBattleDifficulty,
  TowerAdvanceMode,
  WorldBossState
} from "../../shared/events";
import {
  addFriend,
  advanceFactionTower,
  adminAdjustResources,
  adminGrantResources,
  adminAdjustTreasury,
  adminAssignLeader,
  adminBattleTest,
  adminCompleteQueue,
  adminCreateAnnouncement,
  adminFillResources,
  adminGrantItem,
  adminResetDiplomacy,
  adminSetCastleOwner,
  adminToggleAnnouncement,
  adminToggleClass,
  adminTriggerDaily,
  adminTriggerFlashEvent,
  adminUpdateRewardConfig,
  buildCastleFacility,
  buyMarketItem,
  cancelMarketItem,
  cancelQueueAction,
  cancelQueuedActions,
  changeClass,
  challengeWorldBoss,
  claimDailySignIn,
  claimFlashSignIn,
  craftItem,
  declareWar,
  equipItem,
  equipManual,
  equipSpecialSkill,
  enqueueAction,
  getAdminAnnouncements,
  getAdminState,
  getAchievements,
  getCharacterCatalog,
  getAnnouncements,
  getBattles,
  getFactions,
  getForgeOptions,
  getFriends,
  getMe,
  getNotifications,
  getShop,
  getSignInStatus,
  getWorldBoss,
  garrisonCastle,
  joinFactionProject,
  joinCastleSiege,
  learnManual,
  leaveGarrison,
  leaveFactionProject,
  listMarketItem,
  login,
  moveToCastle,
  purchaseItem,
  register,
  repairItem,
  repairCastle,
  requestCooperation,
  retreatFactionTowerBoss,
  resolveCastleSiege,
  respondCooperation,
  selectFaction,
  selectSecondaryCharacter,
  startFactionTowerBattle,
  startCastleSiege,
  startSoloBattle,
  unequipItem,
  unequipManual,
  upgradeFactionTech,
  updateInventorySort
} from "./lib/api";
import { getSocket } from "./lib/socket";
import { getStoredToken, setStoredToken } from "./lib/storage";

type NavKey = "character" | "actions" | "tower" | "battle" | "faction" | "inventory" | "forge" | "achievements" | "messages" | "friends" | "shop" | "admin";
type InventoryTab = "equipment" | "material" | "manual" | "other";
type ShopTab = "npc" | "market";
type ShopCategoryFilter = "all" | "weapon" | "offhand" | "armor" | "material" | "other";
type MessageTab = "announcements" | "notifications" | "battles";
type FactionTab = "map" | "diplomacy" | "treasury" | "members";
type AdminTab = "actions" | "battle" | "items" | "system" | "factions";
type AuthMode = "login" | "register";

const classOptions: Array<{ value: CharacterClass; label: string }> = [
  { value: "warrior", label: "戰士" },
  { value: "assassin", label: "刺客" },
  { value: "mage", label: "法師" },
  { value: "priest", label: "補師" }
];

const factionTechOptions: Array<{ key: FactionTechKey; label: string; detail: string }> = [
  { key: "castle", label: "城堡", detail: "降低建設花費，縮短建設工程時間" },
  { key: "defense", label: "防禦", detail: "提高修建量，降低被攻城時的城防損失" },
  { key: "attack", label: "攻擊", detail: "提高攻城隊伍總戰力" },
  { key: "support", label: "支援", detail: "縮短建設與修建工程時間" },
  { key: "offense_speed", label: "進攻速度", detail: "縮短據點移動時間" }
];

function factionTechCost(level: number) {
  return 120 * (level + 1);
}

function buildFacilityGold(castle: CastleState, castleTechLevel: number) {
  return Math.max(40, 80 + castle.layer * 30 - castleTechLevel * 10);
}

function repairCastlePlan(castle: CastleState, defenseTechLevel: number) {
  const repairAmount = Math.min(25 + defenseTechLevel * 5, castle.maxFortification - castle.fortification);
  return {
    repairAmount,
    gold: Math.ceil(repairAmount * 2)
  };
}

const navItems: Array<{ key: NavKey; label: string; icon: LucideIcon; hint: string; group: string }> = [
  { key: "character", label: "角色", icon: UserRound, hint: "狀態與裝備", group: "個人" },
  { key: "actions", label: "行動", icon: Dumbbell, hint: "訓練與隊列", group: "個人" },
  { key: "inventory", label: "揹包", icon: Backpack, hint: "物品與穿戴", group: "個人" },
  { key: "achievements", label: "成就", icon: Trophy, hint: "目標與進度", group: "個人" },
  { key: "tower", label: "爬塔", icon: TowerControl, hint: "推進與打王", group: "征戰" },
  { key: "battle", label: "戰鬥", icon: Swords, hint: "房間與討伐", group: "征戰" },
  { key: "faction", label: "陣營", icon: Castle, hint: "城池與外交", group: "征戰" },
  { key: "forge", label: "鍛造", icon: Hammer, hint: "製作與修復", group: "經濟" },
  { key: "shop", label: "商店", icon: Store, hint: "NPC 與市場", group: "經濟" },
  { key: "messages", label: "消息", icon: MessageSquareText, hint: "公告與戰報", group: "社交" },
  { key: "friends", label: "好友", icon: UsersRound, hint: "社交與在線", group: "社交" }
];

const initialRegister: RegisterPayload = {
  email: "",
  password: "",
  displayName: "",
  characterName: "",
  className: "warrior"
};

const trainingActions: Array<{ type: ActionType; title: string; detail: string }> = [
  { type: "fishing", title: "釣魚", detail: "技巧、精神、少量智力" },
  { type: "jump_rope", title: "跳繩", detail: "體力、技巧、攻防" },
  { type: "reading", title: "讀書", detail: "智力、技巧" },
  { type: "push_ups", title: "伏地挺身", detail: "體力、攻、防" },
  { type: "meditation", title: "沉思", detail: "運氣、少量精神" },
  { type: "boxing", title: "拳擊", detail: "攻擊、體力、技巧" }
];

const inventoryTabs: Array<{ key: InventoryTab; label: string }> = [
  { key: "equipment", label: "裝備" },
  { key: "material", label: "材料" },
  { key: "manual", label: "秘笈" },
  { key: "other", label: "其他" }
];
const equipmentGroupOrder: EquipmentSlotKey[] = ["weapon", "offhand", "helmet", "armor", "kneepad", "pet", "avatar"];
const forgeMaterialLimit = 16;
const numberLimits = {
  grantGold: 999999,
  resourceQuantity: 9999,
  marketPrice: 999999,
  customStatBonus: 999,
  durability: 9999,
  monsterHp: 999999,
  monsterAttack: 9999
};

type ActivityStatusTone = "idle" | "training" | "mining" | "combat" | "moving" | "resting" | "crafting";

function toClampedInt(value: string | number | undefined | null, min: number, max: number, fallback = min) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(numberValue)));
}

function clampedInputValue(value: string, min: number, max: number) {
  if (value.trim() === "") return "";
  return String(toClampedInt(value, min, max));
}

function activeQueueItem(character: CharacterProfile) {
  return character.actionQueue.items.find((item) => item.status === "active") || character.actionQueue.items[0] || null;
}

function activityStatusFor(character: CharacterProfile, room?: RoomState | null, userId?: string) {
  if (room?.phase === "battle" && room.members.some((member) => member.userId === userId)) {
    return { label: "狩獵中", tone: "combat" as ActivityStatusTone };
  }
  if (character.movement) return { label: "移動中", tone: "moving" as ActivityStatusTone };

  const currentAction = activeQueueItem(character);
  if (!currentAction) return { label: "閒暇中", tone: "idle" as ActivityStatusTone };
  if (currentAction.actionType === "mine_shallow" || currentAction.actionType === "mine_deep") {
    return { label: "挖礦中", tone: "mining" as ActivityStatusTone };
  }
  if (currentAction.actionType === "rest") return { label: "休息中", tone: "resting" as ActivityStatusTone };
  if (currentAction.actionType === "forge") return { label: "鍛造中", tone: "crafting" as ActivityStatusTone };
  return { label: "訓練中", tone: "training" as ActivityStatusTone };
}

function isIdle(character: CharacterProfile) {
  return character.actionQueue.items.length === 0 && !character.movement && !character.garrisonAssignment;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-TW");
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function percent(current: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / max) * 100)));
}

function slotLabel(slot: EquipmentSlotKey) {
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

function inventoryGroupKey(item: InventoryItem) {
  if (item.category === "equipment") return item.equipmentSlot || "other";
  if (item.category === "material") return "material";
  if (item.category === "manual") return "manual";
  return "other";
}

function shopCategoryOf(item: ShopItem | MarketListing["item"]): ShopCategoryFilter {
  if (item.category === "material") return "material";
  if (item.equipmentSlot === "weapon") return "weapon";
  if (item.equipmentSlot === "offhand") return "offhand";
  if (item.equipmentSlot === "helmet" || item.equipmentSlot === "armor" || item.equipmentSlot === "kneepad") return "armor";
  return "other";
}

function emptyRewardTemplate(): RewardTemplate {
  return { gold: 0, materials: [], itemGrants: [] };
}

function sanitizePartyCodeInput(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function itemSummaryLine(item: InventoryItem) {
  const pieces: string[] = [];
  if (item.attackBonus) pieces.push(`攻 ${item.attackBonus}`);
  if (item.defenseBonus) pieces.push(`防 ${item.defenseBonus}`);
  if (item.luckBonus) pieces.push(`運 ${item.luckBonus}`);
  if (item.tenacityBonus) pieces.push(`韌 ${item.tenacityBonus}`);
  if (item.durability != null && item.maxDurability != null) pieces.push(`耐久 ${item.durability}/${item.maxDurability}`);
  if (item.quantity && item.quantity > 1) pieces.push(`數量 ${item.quantity}`);
  return pieces.join(" · ") || item.effectSummary;
}

function qualityLabel(item: InventoryItem) {
  return item.qualityTier || item.rarity || "standard";
}

function craftSourceLabel(item: InventoryItem) {
  return (item.craftSource || "系統產出 / 未記錄").split(",").join(" / ").split("_").join(" ");
}

function inventoryRowSummary(item: InventoryItem) {
  if (item.category === "equipment") {
    const slot = item.equipmentSlot ? slotLabel(item.equipmentSlot) : "裝備";
    return `${slot} · ${qualityLabel(item)}${item.isBroken ? " · 已損壞" : ""}`;
  }
  if (item.category === "material") {
    return `數量 ${item.quantity || 0}`;
  }
  return item.effectSummary;
}

function statBonusSummary(statBonus?: Partial<CharacterProfile["stats"]>) {
  if (!statBonus) return "無額外數值";
  const labels: Array<[keyof CharacterProfile["stats"], string]> = [
    ["attack", "攻"],
    ["defense", "防"],
    ["luck", "運"],
    ["intelligence", "智"],
    ["vitality", "體"],
    ["spirit", "精"],
    ["technique", "技"],
    ["tenacity", "韌"]
  ];
  const pieces = labels.filter(([key]) => statBonus[key]).map(([key, label]) => `${label} +${statBonus[key]}`);
  return pieces.join(" · ") || "無額外數值";
}

function itemIntelligence(item: InventoryItem) {
  return item.statBonus?.intelligence ?? 0;
}

function castleSpecialtyLabel(specialty: string) {
  const labels: Record<string, string> = {
    capital: "核心管理",
    agriculture: "農業 / 採集",
    mining: "礦脈採掘",
    boss: "Boss 討伐",
    trade: "商路交易"
  };
  return labels[specialty] || "未設定";
}

function mapNodePurposeLabel(purpose: CastleState["mapNodePurpose"]) {
  const labels: Record<CastleState["mapNodePurpose"], string> = {
    capital: "核心",
    gathering: "採集點",
    solo_combat: "野外戰鬥",
    guild_boss: "公會 Boss",
    mining: "礦脈",
    trade: "商路"
  };
  return labels[purpose];
}

const materialLabels: Record<MaterialType, string> = {
  iron_ore: "鐵礦",
  copper_ore: "銅礦",
  silver_ore: "銀礦",
  obsidian_ore: "黑曜礦",
  stardust: "星砂",
  leather: "皮革",
  cloth: "布料",
  bone: "骨材"
};

type StrategicMapNode = {
  castle: CastleState;
  x: number;
  y: number;
};

type StrategicMapTerritory = {
  factionId: string;
  name: string;
  color: string;
  points: string;
};

function polarPoint(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: 50 + Math.cos(rad) * radius, y: 50 + Math.sin(rad) * radius };
}

// 城市規劃式放射狀佈局：世界中心向外 5 個扇區（每陣營一個方位），
// 首都在內環，外層一~四沿主幹道向外延伸，環道串起同層城池。
const MAP_LAYER_RADII = [13, 21.5, 29.5, 37, 44];
const MAP_LAYER_ANGLE_OFFSETS = [0, -13, 11, -9, 13];

function buildStrategicMapNodes(castles: CastleState[]): StrategicMapNode[] {
  const ordered = [...castles].sort((left, right) => left.row - right.row || left.layer - right.layer);
  return ordered.map((castle) => {
    const sectorAngle = -90 + castle.row * 72;
    const angle = sectorAngle + (MAP_LAYER_ANGLE_OFFSETS[castle.col % MAP_LAYER_ANGLE_OFFSETS.length] || 0);
    const radius = MAP_LAYER_RADII[castle.col % MAP_LAYER_RADII.length] || 44;
    const point = polarPoint(angle, radius);
    return {
      castle,
      x: Number(point.x.toFixed(1)),
      y: Number(point.y.toFixed(1))
    };
  });
}

function buildStrategicMapTerritories(factions: FactionState["factions"]): StrategicMapTerritory[] {
  return factions.map((faction, index) => {
    const center = -90 + index * 72;
    const arcPoints = [-33, -16.5, 0, 16.5, 33].map((delta) => polarPoint(center + delta, 49));
    const points = ["50,50", ...arcPoints.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)].join(" ");
    return {
      factionId: faction.id,
      name: faction.name,
      color: faction.color,
      points
    };
  });
}

function buildStrategicMapRoutes(nodes: StrategicMapNode[]) {
  const routes: Array<{ id: string; from: StrategicMapNode; to: StrategicMapNode }> = [];
  const nodesByLayer = new Map<number, StrategicMapNode[]>();
  nodes.forEach((node) => {
    nodesByLayer.set(node.castle.layer, [...(nodesByLayer.get(node.castle.layer) || []), node]);
  });

  nodes.forEach((node) => {
    if (node.castle.layer === 0) return;
    const previousLayer = nodesByLayer.get(node.castle.layer - 1) || [];
    const sameOwner = previousLayer.filter((entry) => entry.castle.ownerFactionId === node.castle.ownerFactionId);
    const candidates = sameOwner.length > 0 ? sameOwner : previousLayer;
    const from = candidates.reduce<StrategicMapNode | null>((closest, candidate) => {
      if (!closest) return candidate;
      return Math.abs(candidate.y - node.y) < Math.abs(closest.y - node.y) ? candidate : closest;
    }, null);
    if (from) routes.push({ id: `${from.castle.id}-${node.castle.id}`, from, to: node });
  });

  return routes;
}

function soloDifficultyLabel(difficulty: SoloBattleDifficulty) {
  const labels: Record<SoloBattleDifficulty, string> = {
    easy: "簡單",
    normal: "普通",
    hard: "困難",
    elite: "菁英"
  };
  return labels[difficulty];
}

function soloDifficultySummary(difficulty: SoloBattleDifficulty, layer: number) {
  const configs: Record<SoloBattleDifficulty, { gold: number; exp: number; material: number; risk: string }> = {
    easy: { gold: 24, exp: 18, material: 1, risk: "低風險" },
    normal: { gold: 42, exp: 32, material: 1, risk: "穩定" },
    hard: { gold: 72, exp: 54, material: 2, risk: "高壓" },
    elite: { gold: 120, exp: 90, material: 3, risk: "危險" }
  };
  const config = configs[difficulty];
  return `${soloDifficultyLabel(difficulty)} · ${config.risk} · 金幣 ${config.gold + layer * 8} · 戰鬥經驗 ${config.exp + layer * 6} · 材料 x${config.material}`;
}

function sceneDifficulty(castle: CastleState): SoloBattleDifficulty {
  if (castle.mapNodePurpose === "guild_boss") return "elite";
  if (castle.mapNodePurpose === "mining") return castle.layer >= 3 ? "elite" : "hard";
  if (castle.mapNodePurpose === "trade" || castle.mapNodePurpose === "solo_combat") return castle.layer >= 3 ? "hard" : "normal";
  if (castle.mapNodePurpose === "capital") return "normal";
  return castle.layer >= 2 ? "normal" : "easy";
}

function battleSceneName(castle: CastleState) {
  const names: Record<CastleState["mapNodePurpose"], string> = {
    capital: "城門訓練場",
    gathering: "農野異獸區",
    solo_combat: "荒野獸群",
    guild_boss: "討伐營前哨",
    mining: "礦坑晶化獸",
    trade: "商路盜匪"
  };
  return names[castle.mapNodePurpose];
}

function battleSceneDetail(castle: CastleState) {
  const details: Record<CastleState["mapNodePurpose"], string> = {
    capital: "城門巡防與訓練怪混合，難度穩定。",
    gathering: "農野、小型獸群與補給事件，低壓刷怪。",
    solo_combat: "荒野連續遭遇，戰鬥經驗較穩。",
    guild_boss: "公會前哨戰，會遇到菁英守衛與爬塔準備事件。",
    mining: "礦區晶化怪與坍方事件，材料偏鍛造礦石。",
    trade: "商路盜匪與伏擊事件，金幣收益較直觀。"
  };
  return details[castle.mapNodePurpose];
}

function towerSceneBand(layer: number) {
  const start = Math.floor((Math.max(1, layer) - 1) / 5) * 5 + 1;
  return `${start} - ${start + 4} 層`;
}

function towerModeLabel(mode: TowerAdvanceMode) {
  return mode === "rush" ? "趕路" : "攻擊";
}

function towerModeDetail(mode: TowerAdvanceMode) {
  return mode === "rush" ? "較高機率前進，適合快速找 Boss。" : "前進較慢，但較容易遇到小王與素材。";
}

function towerFunRating(tower: FactionTowerProgress | null, canAct: boolean, isAtTowerCastle: boolean) {
  const layer = tower?.currentLayer ?? 1;
  const progress = tower?.progress ?? 0;
  const activeProgressBonus = progress > 0 && progress < 100 ? 0.8 : 0;
  const bossBonus = tower?.bossUnlocked ? 1.4 : 0;
  const layerBonus = Math.min(1.2, Math.max(0, layer - 1) * 0.15);
  const actionBonus = isAtTowerCastle ? (canAct ? 0.5 : -0.3) : -0.8;
  const score = 6.2 + activeProgressBonus + bossBonus + layerBonus + actionBonus;
  return Math.max(1, Math.min(10, Number(score.toFixed(1))));
}

function towerFunSummary(score: number, tower: FactionTowerProgress | null) {
  if (tower?.bossUnlocked) return "王戰已開，刺激度最高。";
  if (score >= 8) return "推進節奏佳，刷怪與找王平衡。";
  if (score >= 7) return "節奏穩定，可以繼續推進。";
  if (score >= 6) return "偏暖機，需要更多遭遇或進度。";
  return "目前受位置或忙碌狀態限制。";
}

function battleLogTone(log: string) {
  if (/終結技|連擊收尾/.test(log)) return "finisher";
  if (/暴擊/.test(log)) return "crit";
  if (/連擊 x|第 \d+ 擊|連擊中斷/.test(log)) return "combo";
  if (/角色技能|自動施放|幸運暴擊|技巧連擊|精準破防|隊友支援|危急閃避|Boss 反制|特殊事件/.test(log)) return "special";
  if (/獎勵|獲得|公庫|勝利|倒下/.test(log)) return "reward";
  if (/Boss|首領|反擊|撤退|失敗|攻擊/.test(log)) return "boss";
  return "normal";
}

function latestComboEvent(events?: BattleSpecialEvent[] | null) {
  if (!events?.length) return null;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if ((event.kind === "combo_chain" || event.kind === "combo_finisher") && event.impact.comboHits?.length) {
      return event;
    }
  }
  return null;
}

function ComboBurst({ event }: { event: BattleSpecialEvent }) {
  const hits = event.impact.comboHits || [];
  const finisher = event.kind === "combo_finisher";
  return (
    <div className={`combo-burst ${finisher ? "is-finisher" : ""}`}>
      <div className="combo-counter">
        <span className="combo-count">{event.impact.comboLength}</span>
        <span className="combo-label">COMBO{finisher ? " FINISH!" : ""}</span>
      </div>
      <div className="combo-hits">
        {hits.map((hit, index) => (
          <span
            className={`damage-float ${hit.crit ? "is-crit" : ""} ${hit.finisher ? "is-finisher" : ""}`}
            key={`${hit.index}-${index}`}
            style={{ animationDelay: `${index * 0.12}s` }}
          >
            {hit.moveName} {hit.damage}{hit.crit ? "!" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function isMojibakeText(text: string) {
  return /[�\uE000-\uF8FF\uFFFD]|嚗|撌|蝚|摰|蝪|閮|銵|雿|暺|憭|瘨|||\\x[0-9a-f]{2}/i.test(text);
}

function cleanBattleLog(log: string) {
  if (!isMojibakeText(log)) return log;
  return "舊戰報文字已損壞；新版戰鬥紀錄會以正常中文顯示。";
}

function visibleBattleLogs(logs: string[]) {
  let hasLegacyWarning = false;
  return logs.flatMap((log) => {
    if (!isMojibakeText(log)) return [log];
    if (hasLegacyWarning) return [];
    hasLegacyWarning = true;
    return ["舊版戰報資料已損壞；無法還原原文，新產生的戰報會以正常中文逐行顯示。"];
  });
}

function battleContextLabel(context: BattleRecordSummary["battleContext"], kind?: BattleRecordSummary["battleKind"]) {
  const value = kind || context;
  if (value === "adventure" || value === "solo") return "探險";
  if (value === "guildBoss" || value === "factionBoss") return "公會 Boss";
  if (value === "worldBoss") return "世界 Boss";
  if (value === "castle") return "攻城";
  if (value === "raid") return "房間 Boss";
  return value;
}

function levelBar(label: string, level: number, exp: number) {
  return (
    <div className="metric-card" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <strong>{label}</strong>
        <span className="muted">Lv.{level}</span>
      </div>
      <div className="muted" style={{ marginTop: 6 }}>
        經驗 {exp}
      </div>
    </div>
  );
}

type AuthScreenProps = {
  authMode: AuthMode;
  feedback: string;
  loginEmail: string;
  loginPassword: string;
  registerForm: RegisterPayload;
  onAuthModeChange: (mode: AuthMode) => void;
  onLoginEmailChange: (value: string) => void;
  onLoginPasswordChange: (value: string) => void;
  onRegisterChange: (patch: Partial<RegisterPayload>) => void;
  onSubmit: () => void;
};

function AuthScreen({
  authMode,
  feedback,
  loginEmail,
  loginPassword,
  registerForm,
  onAuthModeChange,
  onLoginEmailChange,
  onLoginPasswordChange,
  onRegisterChange,
  onSubmit
}: AuthScreenProps) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-hero">
          <div>
            <p className="eyebrow">8 個屬性 / 陣營層次</p>
            <h1>先登入或建立角色</h1>
            <p className="muted">登入只負責帳號與角色建立；進入後才載入主畫面、陣營、戰鬥與管理流程。</p>
          </div>
          <div className="info-card" style={{ padding: 18 }}>
            <h3>目前系統</h3>
            <div className="tag-row">
              <span className="tag">揹包裝備分離</span>
              <span className="tag">8 個屬性</span>
              <span className="tag">多礦石鍛造</span>
              <span className="tag">陣營層次</span>
              <span className="tag">商店玩家市場</span>
            </div>
          </div>
        </div>

        <div className="auth-tabs">
          <button className={authMode === "login" ? "is-active" : ""} onClick={() => onAuthModeChange("login")} type="button">
            登入
          </button>
          <button className={authMode === "register" ? "is-active" : ""} onClick={() => onAuthModeChange("register")} type="button">
            建立角色
          </button>
        </div>

        {authMode === "login" ? (
          <div className="form-grid">
            <label className="field">
              <span>Email</span>
              <input value={loginEmail} onChange={(event) => onLoginEmailChange(event.target.value)} />
            </label>
            <label className="field">
              <span>密碼</span>
              <input type="password" value={loginPassword} onChange={(event) => onLoginPasswordChange(event.target.value)} />
            </label>
          </div>
        ) : (
          <div className="form-grid">
            <label className="field">
              <span>Email</span>
              <input value={registerForm.email} onChange={(event) => onRegisterChange({ email: event.target.value })} />
            </label>
            <label className="field">
              <span>密碼</span>
              <input type="password" value={registerForm.password} onChange={(event) => onRegisterChange({ password: event.target.value })} />
            </label>
            <label className="field">
              <span>顯示名稱</span>
              <input value={registerForm.displayName} onChange={(event) => onRegisterChange({ displayName: event.target.value })} />
            </label>
            <label className="field">
              <span>角色名稱</span>
              <input value={registerForm.characterName} onChange={(event) => onRegisterChange({ characterName: event.target.value })} />
            </label>
            <label className="field">
              <span>初始職業</span>
              <select value={registerForm.className} onChange={(event) => onRegisterChange({ className: event.target.value as CharacterClass })}>
                {classOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="battle-actions">
          <button className="primary-button" onClick={onSubmit} type="button">
            {authMode === "login" ? "登入" : "建立角色"}
          </button>
          <span className="muted">狀態：{feedback}</span>
        </div>
      </div>
    </div>
  );
}

function App() {
  const socket = useMemo(() => getSocket(), []);
  const [connected, setConnected] = useState(socket.connected);
  const [token, setToken] = useState(getStoredToken());
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [activeNav, setActiveNav] = useState<NavKey>("character");
  const [inventoryTab, setInventoryTab] = useState<InventoryTab>("equipment");
  const [inventorySearch, setInventorySearch] = useState("");
  const [shopTab, setShopTab] = useState<ShopTab>("npc");
  const [messageTab, setMessageTab] = useState<MessageTab>("announcements");
  const [factionTab, setFactionTab] = useState<FactionTab>("map");
  const [adminTab, setAdminTab] = useState<AdminTab>("actions");
  const [selectedMapCastleId, setSelectedMapCastleId] = useState("");
  const [selectedTowerCastleId, setSelectedTowerCastleId] = useState("");
  const [towerAdvanceMode, setTowerAdvanceMode] = useState<TowerAdvanceMode>("rush");
  const [mapZoom, setMapZoom] = useState(1);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);
  const [detailBattleRecord, setDetailBattleRecord] = useState<BattleRecordSummary | null>(null);
  const sceneRailRef = useRef<HTMLDivElement | null>(null);
  const sceneDragRef = useRef({ active: false, dragged: false, startX: 0, scrollLeft: 0 });
  const [collapsedEquipmentGroups, setCollapsedEquipmentGroups] = useState<Record<string, boolean>>({
    weapon: true,
    offhand: false,
    helmet: false,
    armor: false,
    kneepad: false,
    pet: false,
    avatar: false,
    other: false
  });
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [character, setCharacter] = useState<CharacterProfile | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [lastBattleTick, setLastBattleTick] = useState<BattleTickEvent | null>(null);
  const [battleSummary, setBattleSummary] = useState<BattleSummary | null>(null);
  const [battleOverlayDismissed, setBattleOverlayDismissed] = useState(false);
  const [battleHistory, setBattleHistory] = useState<BattleRecordSummary[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [forgeOptions, setForgeOptions] = useState<ForgeOption[]>([]);
  const [forgeRecipesList, setForgeRecipesList] = useState<ForgeRecipe[]>([]);
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [signInStatus, setSignInStatus] = useState<SignInStatus | null>(null);
  const [factionState, setFactionState] = useState<FactionState | null>(null);
  const [worldBoss, setWorldBoss] = useState<WorldBossState | null>(null);
  const [characterCatalog, setCharacterCatalog] = useState<CharacterCatalogPayload>({ secondaryCharacters: [], specialSkills: [] });
  const [achievements, setAchievements] = useState<AchievementProgress[]>([]);
  const [adminState, setAdminState] = useState<AdminState | null>(null);
  const [adminAnnouncements, setAdminAnnouncements] = useState<Announcement[]>([]);
  const [feedback, setFeedback] = useState("準備中");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerForm, setRegisterForm] = useState(initialRegister);
  const [friendName, setFriendName] = useState("");
  const [partyCode, setPartyCode] = useState("");
  const [joinPartyCode, setJoinPartyCode] = useState("");
  const [shopCategoryFilter, setShopCategoryFilter] = useState<ShopCategoryFilter>("all");
  const [marketSellerFilter, setMarketSellerFilter] = useState("");
  const [selectedFactionId, setSelectedFactionId] = useState("");
  const [selectedFactionTarget, setSelectedFactionTarget] = useState("");
  const [facilityDrafts, setFacilityDrafts] = useState<Record<string, string>>({});
  const [forgeRecipeId, setForgeRecipeId] = useState("");
  const [forgeCustomName, setForgeCustomName] = useState("");
  const [forgeMaterialAmounts, setForgeMaterialAmounts] = useState<Record<string, string>>({});
  const [adminTargetName, setAdminTargetName] = useState("");
  const [adminRecipeId, setAdminRecipeId] = useState("");
  const [adminShopItemId, setAdminShopItemId] = useState("");
  const [adminGrantGold, setAdminGrantGold] = useState("0");
  const [adminResourceType, setAdminResourceType] = useState<MaterialType>("iron_ore");
  const [adminResourceQuantity, setAdminResourceQuantity] = useState("1");
  const [adminCustomWeaponName, setAdminCustomWeaponName] = useState("");
  const [adminCustomWeaponSlot, setAdminCustomWeaponSlot] = useState<EquipmentSlotKey>("weapon");
  const [adminCustomWeaponAttack, setAdminCustomWeaponAttack] = useState("0");
  const [adminCustomWeaponDefense, setAdminCustomWeaponDefense] = useState("0");
  const [adminCustomWeaponLuck, setAdminCustomWeaponLuck] = useState("0");
  const [adminCustomWeaponIntelligence, setAdminCustomWeaponIntelligence] = useState("0");
  const [adminCustomWeaponTenacity, setAdminCustomWeaponTenacity] = useState("0");
  const [adminCustomWeaponDurability, setAdminCustomWeaponDurability] = useState("100");
  const [adminBattleName, setAdminBattleName] = useState("測試怪物");
  const [adminBattleHp, setAdminBattleHp] = useState("220");
  const [adminBattleAttack, setAdminBattleAttack] = useState("24");
  const [adminFactionId, setAdminFactionId] = useState("");
  const [adminCastleId, setAdminCastleId] = useState("");
  const [adminOwnerFactionId, setAdminOwnerFactionId] = useState("");
  const [adminAnnouncementTitle, setAdminAnnouncementTitle] = useState("");
  const [adminAnnouncementBody, setAdminAnnouncementBody] = useState("");
  const [dailyConfigForm, setDailyConfigForm] = useState<AdminState["dailyRewardConfig"] | null>(null);
  const [flashConfigForm, setFlashConfigForm] = useState<AdminState["flashEventConfig"] | null>(null);
  const [miningHours, setMiningHours] = useState<Record<"mine_shallow" | "mine_deep", number>>({
    mine_shallow: 1,
    mine_deep: 1
  });
  const [, setNowTick] = useState(Date.now());

  const currentForgeOption = forgeOptions.find((entry) => entry.id === forgeRecipeId) || forgeOptions[0] || null;
  const visibleNav = navItems;
  const activeNavMeta = visibleNav.find((item) => item.key === activeNav);
  const noticeItems = announcements.length > 0 ? announcements.slice(0, 5) : [{ id: "empty", title: "NOTICE", body: "目前沒有公告。" }];
  const visibleListings = useMemo(
    () =>
      (factionState?.marketListings || []).filter((listing) => {
        const sellerMatch = !marketSellerFilter || listing.sellerCharacterName.toLowerCase().includes(marketSellerFilter.toLowerCase());
        const categoryMatch = shopCategoryFilter === "all" || shopCategoryOf(listing.item) === shopCategoryFilter;
        return sellerMatch && categoryMatch;
      }),
    [factionState?.marketListings, marketSellerFilter, shopCategoryFilter]
  );
  const filteredShopItems = useMemo(
    () => shopItems.filter((item) => shopCategoryFilter === "all" || shopCategoryOf(item) === shopCategoryFilter),
    [shopItems, shopCategoryFilter]
  );
  const inventoryGroups = useMemo(() => {
    const keyword = inventorySearch.trim().toLowerCase();
    const matches = (item: InventoryItem) =>
      !keyword || item.name.toLowerCase().includes(keyword) || (item.effectSummary || "").toLowerCase().includes(keyword);
    const items = (character?.inventory || []).filter(matches);
    return {
      equipment: items.filter((item) => item.category === "equipment"),
      material: items.filter((item) => item.category === "material"),
      manual: items.filter((item) => item.category === "manual"),
      other: items.filter((item) => !["equipment", "material", "manual"].includes(item.category))
    };
  }, [character?.inventory, inventorySearch]);
  const selectedInventoryItems = inventoryGroups[inventoryTab];
  const selectedInventoryItem = selectedInventoryItems.find((item) => item.id === selectedInventoryItemId) || null;
  const currentCastle = factionState?.castles.find((castle) => castle.id === character?.currentCastleId) || null;
  const movementFromCastle = factionState?.castles.find((castle) => castle.id === character?.movement?.fromCastleId) || null;
  const movementToCastle = factionState?.castles.find((castle) => castle.id === character?.movement?.toCastleId) || null;
  const movementRouteLabel = character?.movement
    ? `${movementFromCastle?.name || "未知據點"} → ${movementToCastle?.name || "未知據點"}`
    : "";
  const equipmentInventoryGroups = useMemo(() => {
    const equipmentItems = inventoryGroups.equipment;
    const groups = equipmentGroupOrder
      .map((slot) => ({
        slot,
        label: slotLabel(slot),
        items: equipmentItems.filter((item) => item.equipmentSlot === slot)
      }))
      .filter((group) => group.items.length > 0);
    const otherItems = equipmentItems.filter((item) => !item.equipmentSlot || !equipmentGroupOrder.includes(item.equipmentSlot));
    return otherItems.length > 0 ? [...groups, { slot: null, label: "其他裝備", items: otherItems }] : groups;
  }, [inventoryGroups.equipment]);
  const visibleCastles = useMemo(() => {
    if (!factionState?.castles?.length) return [];
    return [...factionState.castles].sort((left, right) => left.layer - right.layer || left.name.localeCompare(right.name));
  }, [factionState?.castles]);
  const selectedMapCastle =
    visibleCastles.find((castle) => castle.id === selectedMapCastleId) ||
    visibleCastles.find((castle) => castle.id === character?.movement?.toCastleId) ||
    visibleCastles.find((castle) => castle.id === character?.currentCastleId) ||
    visibleCastles[0] ||
    null;
  const strategicMapNodes = useMemo(() => buildStrategicMapNodes(visibleCastles), [visibleCastles]);
  const strategicMapRoutes = useMemo(() => buildStrategicMapRoutes(strategicMapNodes), [strategicMapNodes]);
  const strategicMapTerritories = useMemo(
    () => buildStrategicMapTerritories(factionState?.factions || []),
    [factionState?.factions]
  );
  const activeFactionProjects = useMemo(
    () => (factionState?.projects || []).filter((project) => project.status === "active"),
    [factionState?.projects]
  );
  const battleScenes = useMemo(
    () =>
      (factionState?.castles || [])
        .filter((castle) => castle.ownerFactionId === character?.factionId)
        .sort((left, right) => left.layer - right.layer || left.name.localeCompare(right.name)),
    [character?.factionId, factionState?.castles]
  );
  const towerCastles = useMemo(() => battleScenes.filter((castle) => castle.mapNodePurpose === "guild_boss"), [battleScenes]);
  const selectedTowerCastle =
    towerCastles.find((castle) => castle.id === selectedTowerCastleId) ||
    towerCastles.find((castle) => castle.id === character?.currentCastleId) ||
    towerCastles[0] ||
    null;
  const towerProgress = factionState?.selectedFaction?.tower || null;
  const isAtTowerCastle = Boolean(selectedTowerCastle && character?.currentCastleId === selectedTowerCastle.id);
  const canUseTowerAction = Boolean(character && selectedTowerCastle && isAtTowerCastle && isIdle(character));
  const towerFunScore = towerFunRating(towerProgress, canUseTowerAction, isAtTowerCastle);
  const selectedSecondaryCharacters = useMemo(
    () =>
      (character?.secondaryCharacters || []).map((slot) => ({
        slot,
        definition: characterCatalog.secondaryCharacters.find((entry) => entry.id === slot.characterId) || null
      })),
    [character?.secondaryCharacters, characterCatalog.secondaryCharacters]
  );
  const classMasteryRows = useMemo(
    () => classOptions.map((option) => character?.classMastery?.[option.value]).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    [character?.classMastery]
  );
  const unlockedSpecialSkills = useMemo(() => {
    if (!character) return [];
    const skillIds = new Set<string>();
    characterCatalog.specialSkills.forEach((skill) => {
      if (skill.source === "class" && skill.requiredClass === character.className) skillIds.add(skill.id);
    });
    selectedSecondaryCharacters.forEach(({ slot }) => slot.unlockedSkillIds.forEach((skillId) => skillIds.add(skillId)));
    character.learnedManuals.forEach((manual) => {
      if (manual.unlockedSkillId) skillIds.add(manual.unlockedSkillId);
    });
    return characterCatalog.specialSkills.filter((skill) => skillIds.has(skill.id));
  }, [character, characterCatalog.specialSkills, selectedSecondaryCharacters]);
  const equippedSpecialSkill = unlockedSpecialSkills.find((skill) => skill.id === character?.specialSkillSlot) || null;

  const battleOverlayVisible = Boolean((roomState?.phase === "battle" || roomState?.phase === "ended") && !battleOverlayDismissed);
  const detailModalRoot = typeof document !== "undefined" ? document.body : null;
  const myActivityStatus = character ? activityStatusFor(character, roomState, user?.id) : { label: "閒暇中", tone: "idle" as ActivityStatusTone };
  const partyBlocker = roomState?.members.find((member) => !isIdle(member.character)) || null;
  const canLeadPartyAction = Boolean(roomState && user && roomState.hostId === user.id && roomState.phase === "lobby" && !partyBlocker);
  const canAttackCastle = character ? (!roomState ? isIdle(character) : canLeadPartyAction) : false;

  function handleSceneRailPointerDown(event: PointerEvent<HTMLDivElement>) {
    const rail = sceneRailRef.current;
    if (!rail) return;
    sceneDragRef.current = {
      active: true,
      dragged: false,
      startX: event.clientX,
      scrollLeft: rail.scrollLeft
    };
    rail.setPointerCapture(event.pointerId);
  }

  function handleSceneRailPointerMove(event: PointerEvent<HTMLDivElement>) {
    const rail = sceneRailRef.current;
    const drag = sceneDragRef.current;
    if (!rail || !drag.active) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 6) drag.dragged = true;
    rail.scrollLeft = drag.scrollLeft - delta;
  }

  function handleSceneRailPointerEnd(event: PointerEvent<HTMLDivElement>) {
    const rail = sceneRailRef.current;
    if (rail?.hasPointerCapture(event.pointerId)) {
      rail.releasePointerCapture(event.pointerId);
    }
    window.setTimeout(() => {
      sceneDragRef.current.active = false;
      sceneDragRef.current.dragged = false;
    }, 0);
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedInventoryItems.length) {
      setSelectedInventoryItemId(null);
      return;
    }
    if (!selectedInventoryItem || !selectedInventoryItems.some((item) => item.id === selectedInventoryItem.id)) {
      setSelectedInventoryItemId(selectedInventoryItems[0]?.id || null);
    }
  }, [inventoryTab, selectedInventoryItem, selectedInventoryItems]);

  useEffect(() => {
    if (!detailItem && !detailBattleRecord) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [detailItem, detailBattleRecord]);

  useEffect(() => {
    if (!adminState) return;
    setDailyConfigForm(adminState.dailyRewardConfig);
    setFlashConfigForm(adminState.flashEventConfig);
  }, [adminState]);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onAuthReady = (payload: { user: AuthUser; character: CharacterProfile }) => {
      setUser(payload.user);
      setCharacter(payload.character);
      if (!adminTargetName) {
        setAdminTargetName(payload.character.name);
      }
    };
    const onLobbyRooms = (nextRooms: RoomSummary[]) => setRooms(nextRooms);
    const onRoomState = (state: RoomState | null) => {
      setRoomState(state);
      if (!state || state.phase === "lobby") {
        setLastBattleTick(null);
        setBattleOverlayDismissed(false);
      }
      if (state?.phase === "battle" || state?.phase === "ended") {
        setActiveNav("battle");
      }
    };
    const onBattleTick = (event: BattleTickEvent) => {
      setLastBattleTick(event);
      setBattleSummary(null);
      if (event.tick === 1) {
        setBattleOverlayDismissed(false);
      }
    };
    const onBattleEnded = (payload: { roomId: string; summary: BattleSummary }) => {
      setBattleSummary(payload.summary);
      void refreshBattles();
      void refreshMe();
    };
    const onCharacterUpdated = (nextCharacter: CharacterProfile) => {
      setCharacter(nextCharacter);
      void refreshFaction();
    };
    const onError = (message: string) => setFeedback(message);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("auth:ready", onAuthReady);
    socket.on("lobby:rooms", onLobbyRooms);
    socket.on("room:state", onRoomState);
    socket.on("battle:tick", onBattleTick);
    socket.on("battle:ended", onBattleEnded);
    socket.on("character:updated", onCharacterUpdated);
    socket.on("app:error", onError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("auth:ready", onAuthReady);
      socket.off("lobby:rooms", onLobbyRooms);
      socket.off("room:state", onRoomState);
      socket.off("battle:tick", onBattleTick);
      socket.off("battle:ended", onBattleEnded);
      socket.off("character:updated", onCharacterUpdated);
      socket.off("app:error", onError);
    };
  }, [socket, adminTargetName]);

  useEffect(() => {
    if (!token) return;
    void bootstrap(token);
  }, [token]);

async function bootstrap(nextToken: string) {
    try {
      const me = await getMe(nextToken);
      setUser(me.user);
      setCharacter(me.character);
      socket.emit("auth:ready", nextToken);
      await Promise.all([
        refreshBattles(nextToken),
        refreshShop(nextToken),
        refreshNotifications(nextToken),
        refreshAnnouncements(nextToken),
        refreshFriends(nextToken),
        refreshSignIn(nextToken),
        refreshFaction(nextToken),
        refreshWorldBoss(nextToken),
        refreshForge(nextToken),
        refreshCharacterCatalog(nextToken),
        refreshAchievements(nextToken)
      ]);
      setFeedback(me.completedActivities?.at(-1)?.message || "已同步最新資料");
    } catch (error) {
      logout();
      setFeedback(error instanceof Error ? error.message : "讀取資料失敗");
    }
  }

  async function refreshMe(nextToken = token) {
    if (!nextToken) return;
    const me = await getMe(nextToken);
    setUser(me.user);
    setCharacter(me.character);
    if (me.completedActivities?.length) {
      setFeedback(me.completedActivities.at(-1)?.message || "已同步最新資料");
      await refreshNotifications(nextToken);
    }
  }

  async function refreshBattles(nextToken = token) {
    if (!nextToken) return;
    setBattleHistory(await getBattles(nextToken));
  }

  async function refreshShop(nextToken = token) {
    if (!nextToken) return;
    const result = await getShop(nextToken);
    setShopItems(result.items);
  }

  async function refreshNotifications(nextToken = token) {
    if (!nextToken) return;
    const result = await getNotifications(nextToken);
    setNotifications(result.notifications);
  }

  async function refreshAnnouncements(nextToken = token) {
    if (!nextToken) return;
    const result = await getAnnouncements(nextToken);
    setAnnouncements(result.announcements);
  }

  async function refreshFriends(nextToken = token) {
    if (!nextToken) return;
    const result = await getFriends(nextToken);
    setFriends(result.friends);
  }

  async function refreshSignIn(nextToken = token) {
    if (!nextToken) return;
    setSignInStatus(await getSignInStatus(nextToken));
  }

  async function refreshFaction(nextToken = token) {
    if (!nextToken) return;
    setFactionState(await getFactions(nextToken));
  }

  async function refreshWorldBoss(nextToken = token) {
    if (!nextToken) return;
    const result = await getWorldBoss(nextToken);
    setWorldBoss(result.worldBoss);
  }

  async function refreshForge(nextToken = token) {
    if (!nextToken) return;
    const result = await getForgeOptions(nextToken);
    setForgeOptions(result.options);
    setForgeRecipesList(result.recipes || []);
    setForgeRecipeId((current) => current || result.options[0]?.id || "");
  }

  async function refreshCharacterCatalog(nextToken = token) {
    if (!nextToken) return;
    setCharacterCatalog(await getCharacterCatalog(nextToken));
  }

  async function refreshAchievements(nextToken = token) {
    if (!nextToken) return;
    const result = await getAchievements(nextToken);
    setAchievements(result.achievements);
    setCharacter(result.character);
  }

  async function refreshAdmin(nextToken = token) {
    if (!nextToken || user?.role !== "admin") return;
    const [state, announcementState] = await Promise.all([getAdminState(nextToken), getAdminAnnouncements(nextToken)]);
    setAdminState(state);
    setAdminAnnouncements(announcementState.announcements);
  }

  function applyAuth(result: AuthPayload) {
    setStoredToken(result.token);
    setToken(result.token);
    setUser(result.user);
    setCharacter(result.character);
    setAdminTargetName(result.character.name);
  }

  function logout() {
    setStoredToken("");
    setToken("");
    setUser(null);
    setCharacter(null);
    setRooms([]);
    setRoomState(null);
    setFactionState(null);
    setWorldBoss(null);
    setAdminState(null);
    setAdminAnnouncements([]);
    socket.emit("room:leave");
  }

  async function handleAuthSubmit() {
    try {
      const result =
        authMode === "login"
          ? await login({ email: loginEmail, password: loginPassword })
          : await register(registerForm);
      applyAuth(result);
      await bootstrap(result.token);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "登入失敗");
    }
  }

  async function handleQueue(actionType: ActionType, durationHours?: number) {
    if (!token || !character) return;
    if (!isIdle(character)) {
      setFeedback("角色目前忙碌中，移動或行動完成前不能加入新行動。");
      return;
    }
    try {
      const result = await enqueueAction(token, { actionType, durationHours });
      setCharacter(result.character);
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "加入隊列失敗");
    }
  }

  async function handleCancelQueue(actionId: string) {
    if (!token) return;
    try {
      const result = await cancelQueueAction(token, actionId);
      setCharacter(result.character);
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "取消失敗");
    }
  }

  async function handleCancelQueuedActions() {
    if (!token) return;
    try {
      const result = await cancelQueuedActions(token);
      setCharacter(result.character);
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "取消失敗");
    }
  }

  async function handlePurchase(itemId: string) {
    if (!token) return;
    try {
      const result = await purchaseItem(token, { itemId });
      setCharacter(result.character);
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "購買失敗");
    }
  }

  async function handleEquip(itemId: string) {
    if (!token) return;
    try {
      const result = await equipItem(token, { itemId });
      setCharacter(result.character);
      setFeedback("裝備完成");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "裝備失敗");
    }
  }

  async function handleSelectSecondary(slot: number, characterId: string) {
    if (!token) return;
    try {
      const result = await selectSecondaryCharacter(token, { slot, characterId: characterId || null });
      setCharacter(result);
      setFeedback("次要角色已更新");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "次要角色更新失敗");
    }
  }

  async function handleChangeClass(className: CharacterClass) {
    if (!token || className === character?.className) return;
    try {
      setCharacter(await changeClass(token, className));
      setFeedback("主定位已更新");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "主定位更新失敗");
    }
  }

  async function handleEquipSpecialSkill(skillId: string) {
    if (!token) return;
    try {
      const result = await equipSpecialSkill(token, { skillId: skillId || null });
      setCharacter(result);
      setFeedback(skillId ? "特殊技能已裝備" : "特殊技能已卸下");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "特殊技能更新失敗");
    }
  }

  async function handleLearnManual(itemId: string) {
    if (!token) return;
    try {
      const result = await learnManual(token, { itemId });
      setCharacter(result.character);
      setFeedback("秘籍已學會");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "秘籍學習失敗");
    }
  }

  async function handleEquipManual(manualId: string) {
    if (!token) return;
    try {
      setCharacter(await equipManual(token, { manualId }));
      setFeedback("秘籍 Buff 已裝備");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "秘籍裝備失敗");
    }
  }

  async function handleUnequipManual(manualId: string) {
    if (!token) return;
    try {
      setCharacter(await unequipManual(token, { manualId }));
      setFeedback("秘籍 Buff 已卸下");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "秘籍卸下失敗");
    }
  }

  async function handleUnequip(slot: EquipmentSlotKey) {
    if (!token) return;
    try {
      const result = await unequipItem(token, { slot });
      setCharacter(result.character);
      setFeedback("已卸下裝備");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "卸下失敗");
    }
  }

  async function handleRepairInventory(itemId: string) {
    if (!token) return;
    try {
      const result = await repairItem(token, { itemId, source: "inventory" });
      setCharacter(result.character);
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "修復失敗");
    }
  }

  async function handleRepairEquipment(slot: EquipmentSlotKey, itemId: string) {
    if (!token) return;
    try {
      const result = await repairItem(token, { itemId, source: "equipment", slot });
      setCharacter(result.character);
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "修復失敗");
    }
  }

  function forgeSelectedCount(exceptItemId?: string) {
    return inventoryGroups.material.reduce((total, item) => {
      if (item.id === exceptItemId) return total;
      return total + toClampedInt(forgeMaterialAmounts[item.id], 0, item.quantity || 0, 0);
    }, 0);
  }

  function updateForgeMaterialAmount(item: InventoryItem, value: string) {
    const remaining = Math.max(0, forgeMaterialLimit - forgeSelectedCount(item.id));
    const maxForItem = Math.min(item.quantity || 0, remaining);
    setForgeMaterialAmounts((current) => ({
      ...current,
      [item.id]: clampedInputValue(value, 0, maxForItem)
    }));
  }

  async function handleForge() {
    if (!token || !character || !currentForgeOption) return;
    if (!isIdle(character)) {
      setFeedback("角色目前忙碌中，移動或行動完成前不能鍛造。");
      return;
    }
    try {
      const materialItemIds = character.inventory
        .filter((item) => item.category === "material")
        .flatMap((item) => {
          const amount = toClampedInt(forgeMaterialAmounts[item.id], 0, item.quantity || 0, 0);
          return Array.from({ length: amount }, () => item.id);
        })
        .slice(0, forgeMaterialLimit);
      if (!materialItemIds.length) {
        setFeedback("請至少選 1 個材料");
        return;
      }
      const result = await craftItem(token, {
        equipmentSlot: currentForgeOption.equipmentSlot,
        materialItemIds,
        customName: forgeCustomName
      });
      setCharacter(result.character);
      setForgeMaterialAmounts({});
      setForgeCustomName("");
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "鍛造失敗");
    }
  }

  async function handleAddFriend() {
    if (!token || !friendName.trim()) return;
    try {
      const result = await addFriend(token, { characterName: friendName.trim() });
      setFriends(result.friends);
      setFriendName("");
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "新增好友失敗");
    }
  }

  async function handleSelectFaction() {
    if (!token || !selectedFactionId) return;
    try {
      setFactionState(await selectFaction(token, selectedFactionId));
      await refreshMe();
      setFeedback("已選擇陣營");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "選擇陣營失敗");
    }
  }

  async function handleCooperateRequest() {
    if (!token || !selectedFactionTarget) return;
    try {
      setFactionState(await requestCooperation(token, selectedFactionTarget));
      setFeedback("合作申請已送出");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "合作申請失敗");
    }
  }

  async function handleDeclareWar() {
    if (!token || !selectedFactionTarget) return;
    try {
      setFactionState(await declareWar(token, selectedFactionTarget));
      setFeedback("已對目標宣戰");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "宣戰失敗");
    }
  }

  async function handleMoveCastle(castleId: string) {
    if (!token || !character) return;
    if (!isIdle(character)) {
      setFeedback("角色目前忙碌中，行動完成前不能移動。");
      return;
    }
    try {
      const result = await moveToCastle(token, castleId);
      setCharacter(result.character);
      setFactionState(result.factionState);
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "移動失敗");
    }
  }

  async function handleBuildFacility(castleId: string) {
    if (!token || !character) return;
    if (!isIdle(character)) {
      setFeedback("角色目前忙碌中，移動或行動完成前不能建設。");
      return;
    }
    const facilityName = facilityDrafts[castleId]?.trim();
    if (!facilityName) {
      setFeedback("請輸入要建設的設施名稱。");
      return;
    }
    try {
      const result = await buildCastleFacility(token, castleId, facilityName);
      setCharacter(result.character);
      setFactionState(result.factionState);
      setFacilityDrafts((current) => ({ ...current, [castleId]: "" }));
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "建設失敗");
    }
  }

  async function handleRepairCastle(castleId: string) {
    if (!token || !character) return;
    if (!isIdle(character)) {
      setFeedback("角色目前忙碌中，移動或行動完成前不能修建。");
      return;
    }
    try {
      const result = await repairCastle(token, castleId);
      setCharacter(result.character);
      setFactionState(result.factionState);
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "修建失敗");
    }
  }

  async function handleUpgradeTech(techKey: FactionTechKey) {
    if (!token) return;
    try {
      setFactionState(await upgradeFactionTech(token, techKey));
      setFeedback("公會科技已升級");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "科技升級失敗");
    }
  }

  async function handleJoinProject(projectId: string) {
    if (!token || !character) return;
    if (!isIdle(character)) {
      setFeedback("角色目前忙碌中，移動或行動完成前不能協助工程。");
      return;
    }
    try {
      const result = await joinFactionProject(token, projectId);
      setCharacter(result.character);
      setFactionState(result.factionState);
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "加入工程失敗");
    }
  }

  async function handleLeaveProject(projectId: string) {
    if (!token) return;
    try {
      const result = await leaveFactionProject(token, projectId);
      setCharacter(result.character);
      setFactionState(result.factionState);
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "退出工程失敗");
    }
  }

  async function handleListMarket(item: InventoryItem) {
    if (!token) return;
    const priceText = window.prompt(`設定 ${item.name} 的售價`, "100");
    if (priceText === null) return;
    const maxQuantity = Math.max(1, item.quantity || 1);
    const quantityText = window.prompt(`上架數量（最多 ${maxQuantity}）`, String(maxQuantity));
    if (quantityText === null) return;
    const price = toClampedInt(priceText, 1, numberLimits.marketPrice, 0);
    const quantity = toClampedInt(quantityText, 1, maxQuantity, 0);
    if (price <= 0 || quantity <= 0) return;
    try {
      setFactionState(await listMarketItem(token, { itemId: item.id, price, quantity }));
      await refreshMe();
      setFeedback("已送至玩家市場");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "上架失敗");
    }
  }

  async function handleBuyListing(listing: MarketListing) {
    if (!token) return;
    try {
      setFactionState(await buyMarketItem(token, { listingId: listing.id }));
      await refreshMe();
      setFeedback("購買完成");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "購買失敗");
    }
  }

  async function handleCancelListing(listingId: string) {
    if (!token) return;
    try {
      setFactionState(await cancelMarketItem(token, listingId));
      await refreshMe();
      setFeedback("已取消掛單");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "取消掛單失敗");
    }
  }

  async function handleInventoryReorder(groupKey: string, draggedId: string, targetId: string) {
    if (!token || !character || draggedId === targetId) return;
    const sourceItems = character.inventory.filter((item) => inventoryGroupKey(item) === groupKey);
    const draggedIndex = sourceItems.findIndex((item) => item.id === draggedId);
    const targetIndex = sourceItems.findIndex((item) => item.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const reordered = [...sourceItems];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    try {
      const payload: InventorySortPayload = {
        groupKey,
        orderedItemIds: reordered.map((item) => item.id)
      };
      const result = await updateInventorySort(token, payload);
      setCharacter(result.character);
      setFeedback("順序已更新");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "排序失敗");
    } finally {
      setDraggedItemId(null);
    }
  }

  async function handleAdminGrantResources() {
    if (!token || !adminTargetName.trim()) return;
    await handleAdminAction(
      () =>
        adminGrantResources(token, {
          targetCharacterName: adminTargetName.trim(),
          gold: toClampedInt(adminGrantGold, 0, numberLimits.grantGold, 0),
          resources: [{ materialType: adminResourceType, quantity: toClampedInt(adminResourceQuantity, 0, numberLimits.resourceQuantity, 0) }]
        }),
      "資源已發送。"
    );
  }

  async function handleAdminGrantCustomWeapon() {
    if (!token || !adminTargetName.trim() || !adminCustomWeaponName.trim()) return;
    await handleAdminAction(
      () =>
        adminGrantItem(token, {
          targetCharacterName: adminTargetName.trim(),
          customWeapon: {
            name: adminCustomWeaponName.trim(),
            equipmentSlot: adminCustomWeaponSlot,
            attackBonus: toClampedInt(adminCustomWeaponAttack, 0, numberLimits.customStatBonus, 0),
            defenseBonus: toClampedInt(adminCustomWeaponDefense, 0, numberLimits.customStatBonus, 0),
            luckBonus: toClampedInt(adminCustomWeaponLuck, 0, numberLimits.customStatBonus, 0),
            intelligenceBonus: toClampedInt(adminCustomWeaponIntelligence, 0, numberLimits.customStatBonus, 0),
            tenacityBonus: toClampedInt(adminCustomWeaponTenacity, 0, numberLimits.customStatBonus, 0),
            durability: toClampedInt(adminCustomWeaponDurability, 1, numberLimits.durability, 100)
          }
        }),
      "自訂武器已發送。"
    );
  }

  async function handleSaveRewardConfig(kind: "daily" | "flash") {
    if (!token) return;
    const config = kind === "daily" ? dailyConfigForm : flashConfigForm;
    if (!config) return;
    const reward: RewardTemplate = {
      ...config.reward,
      gold: toClampedInt(config.reward.gold, 0, numberLimits.grantGold, 0),
      materials: (config.reward.materials || [])
        .map((resource) => ({
          materialType: resource.materialType,
          quantity: toClampedInt(resource.quantity, 0, numberLimits.resourceQuantity, 0)
        }))
        .filter((resource) => resource.quantity > 0)
    };
    await handleAdminAction(
      () =>
        adminUpdateRewardConfig(token, {
          kind,
          title: config.title,
          active: config.active,
          startAt: config.startAt || null,
          endAt: config.endAt || null,
          reward
        }),
      `${kind === "daily" ? "每日獎勵" : "突發活動"}設定已更新。`
    );
  }

  async function handleAttackCastle(castleId: string) {
    if (!token) return;
    if (!canAttackCastle) {
      setFeedback(roomState ? "只有隊長且全隊閒暇中才能進攻。" : "角色目前不是閒暇中，不能進攻。");
      return;
    }
    try {
      setFactionState(await startCastleSiege(token, castleId));
      await refreshMe();
      setFeedback("攻城戰已發起，戰場會依時間自動推進。");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "發起攻城戰失敗");
    }
  }

  async function handleGarrisonCastle(castleId: string) {
    if (!token) return;
    try {
      const result = await garrisonCastle(token, castleId);
      setCharacter(result.character);
      setFactionState(result.factionState);
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "駐防失敗");
    }
  }

  async function handleLeaveGarrison(castleId: string) {
    if (!token) return;
    try {
      const result = await leaveGarrison(token, castleId);
      setCharacter(result.character);
      setFactionState(result.factionState);
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "退出駐防失敗");
    }
  }

  async function handleJoinSiege(siegeId: string) {
    if (!token) return;
    try {
      const result = await joinCastleSiege(token, siegeId);
      setCharacter(result.character);
      setFactionState(result.factionState);
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "加入攻城戰失敗");
    }
  }

  async function handleResolveSiege(siegeId: string) {
    if (!token) return;
    try {
      setFactionState(await resolveCastleSiege(token, siegeId));
      await refreshBattles();
      await refreshMe();
      setFeedback("攻城戰已更新。");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "更新攻城戰失敗");
    }
  }

  async function handleSoloBattle(castleId: string) {
    if (!token) return;
    try {
      const result = await startSoloBattle(token, castleId);
      setCharacter(result.character);
      await refreshBattles();
      await refreshNotifications();
      setDetailBattleRecord(result.battleRecord);
      setActiveNav("battle");
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "探險失敗");
    }
  }

  async function handleFactionTowerBattle(castleId: string, mode: "skirmish" | "boss") {
    if (!token) return;
    try {
      const result = await startFactionTowerBattle(token, { castleId, mode });
      setCharacter(result.character);
      setFactionState(result.factionState);
      await refreshBattles();
      await refreshNotifications();
      setDetailBattleRecord(result.battleRecord);
      setActiveNav("battle");
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "公會 Boss 戰鬥失敗");
    }
  }

  async function handleAdvanceTower(mode: TowerAdvanceMode) {
    if (!token || !selectedTowerCastle) return;
    try {
      const result = await advanceFactionTower(token, { castleId: selectedTowerCastle.id, mode });
      setCharacter(result.character);
      setFactionState(result.factionState);
      await refreshNotifications();
      if (result.battleRecord) {
        await refreshBattles();
        setDetailBattleRecord(result.battleRecord);
      }
      setActiveNav("tower");
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "塔層推進失敗");
    }
  }

  async function handleRetreatTowerBoss() {
    if (!token) return;
    try {
      const result = await retreatFactionTowerBoss(token);
      setCharacter(result.character);
      setFactionState(result.factionState);
      await refreshNotifications();
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "塔層撤退失敗");
    }
  }

  async function handleWorldBossChallenge() {
    if (!token) return;
    try {
      const result = await challengeWorldBoss(token);
      setCharacter(result.character);
      setFactionState(result.factionState);
      setWorldBoss(result.worldBoss);
      await refreshBattles();
      await refreshNotifications();
      setDetailBattleRecord(result.battleRecord);
      setActiveNav("battle");
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "世界 Boss 挑戰失敗");
    }
  }

  async function handleClaimDaily() {
    if (!token) return;
    try {
      const result = await claimDailySignIn(token);
      setCharacter(result.character);
      await refreshSignIn();
      await refreshAnnouncements();
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "簽到失敗");
    }
  }

  async function handleClaimFlash() {
    if (!token) return;
    try {
      const result = await claimFlashSignIn(token);
      setCharacter(result.character);
      await refreshSignIn();
      await refreshAnnouncements();
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "突發簽到失敗");
    }
  }

  async function handleAdminRefresh() {
    await Promise.all([refreshAdmin(), refreshFaction(), refreshBattles(), refreshMe()]);
  }

  async function handleAdminAction(action: () => Promise<unknown>, successMessage: string) {
    try {
      await action();
      await handleAdminRefresh();
      setFeedback(successMessage);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Admin 操作失敗");
    }
  }

  function createParty() {
    const nextCode = sanitizePartyCodeInput(partyCode);
    if (partyCode.trim() && nextCode.length !== 6) {
      setFeedback("隊伍代碼請輸入 6 碼英文或數字。");
      return;
    }
    socket.emit("room:create", nextCode || undefined);
    setActiveNav("battle");
  }

  function joinParty(code?: string) {
    const nextCode = sanitizePartyCodeInput(code || joinPartyCode);
    if (nextCode.length !== 6) {
      setFeedback("請輸入 6 碼隊伍代碼。");
      return;
    }
    socket.emit("room:join", nextCode);
    setActiveNav("battle");
  }

  function leaveParty() {
    socket.emit("room:leave");
  }

  function startBattle() {
    if (!roomState) return;
    if (!canLeadPartyAction) {
      setFeedback(partyBlocker ? `${partyBlocker.displayName} 目前不是閒暇中。` : "只有隊長且全隊閒暇中才能開始狩獵。");
      return;
    }
    socket.emit("room:start", roomState.roomId);
  }

  if (!token || !user || !character) {
    return (
      <AuthScreen
        authMode={authMode}
        feedback={feedback}
        loginEmail={loginEmail}
        loginPassword={loginPassword}
        registerForm={registerForm}
        onAuthModeChange={setAuthMode}
        onLoginEmailChange={setLoginEmail}
        onLoginPasswordChange={setLoginPassword}
        onRegisterChange={(patch) => setRegisterForm((current) => ({ ...current, ...patch }))}
        onSubmit={() => void handleAuthSubmit()}
      />
    );
  }

  return (
    <div className="app-shell">
      <div className="app-layout">
        <aside className="sidebar" style={{ padding: 16 }}>
          <div className="section-stack shell-bar">
            <div className="brand-panel">
              <div className="eyebrow">角色</div>
              <h3 style={{ marginBottom: 4 }}>{character.name}</h3>
              <div className="muted">{user.displayName} · {classOptions.find((option) => option.value === character.className)?.label}</div>
            </div>
            <div className="status-stack">
              <span className={`status-pill compact ${connected ? "is-live" : ""}`}>
                {connected ? <Wifi size={15} /> : <WifiOff size={15} />}
                {connected ? "連線中" : "離線"}
              </span>
              <span className="status-pill compact">等級 Lv.{character.instinctLevel}</span>
              <span className={`status-pill compact status-${myActivityStatus.tone}`}>狀態 {myActivityStatus.label}</span>
            </div>
            <div className="nav-stack">
              {Array.from(new Set(visibleNav.map((item) => item.group))).map((groupName) => (
                <div className="nav-group" key={groupName}>
                  <div className="nav-group-label">{groupName}</div>
                  {visibleNav.filter((item) => item.group === groupName).map((item) => {
                    const Icon = item.icon;
                    return (
                      <button key={item.key} className={`nav-button ${activeNav === item.key ? "is-active" : ""}`} onClick={() => setActiveNav(item.key)} type="button">
                        <span className="nav-icon"><Icon size={18} /></span>
                        <span className="nav-copy">
                          <strong>{item.label}</strong>
                          <small>{item.hint}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <button className="ghost-button" onClick={logout} type="button">
              <LogOut size={16} />
              登出
            </button>
          </div>
        </aside>

        <main className="content-panel">
          <div className="notice-strip">
            <strong>公告 · NOTICE</strong>
            <div className="notice-track">
              <div className="notice-marquee">
                {[...noticeItems, ...noticeItems].map((announcement, index) => (
                  <span key={`${announcement.id}-${index}`}>{announcement.title}：{announcement.body}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="top-banner" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <strong>{feedback}</strong>
                <div className="muted" style={{ marginTop: 4 }}>
                  {character.movement ? `目前行動：移動中 · ${movementRouteLabel} · 抵達 ${formatDate(character.movement.endsAt)}` : `今日隊列 ${character.actionQueue.items.length} 項`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span className="mini-pill"><HeartPulse size={15} />HP {character.hp}/{character.maxHp}</span>
                <span className="mini-pill"><Sparkles size={15} />MP {character.mp}/{character.maxMp}</span>
                <span className="mini-pill"><BatteryCharging size={15} />精力 {character.energy}/{character.maxEnergy}</span>
                <span className="mini-pill"><Coins size={15} />金幣 {character.gold}</span>
              </div>
            </div>
          </div>

          <div className="page-title-bar">
            <div>
              <div className="eyebrow">/ {activeNavMeta?.key.toUpperCase() || "PAGE"}</div>
              <h1>{activeNavMeta?.label || "頁面"}</h1>
              <p className="muted">{activeNavMeta?.hint || "系統功能"}</p>
            </div>
            <span className={`status-pill compact status-${myActivityStatus.tone}`}>{myActivityStatus.label}</span>
          </div>

          {activeNav === "character" ? (
            <section className="section-stack">
              <div className="panel announcement-hero" style={{ padding: 16 }}>
                <strong>公告</strong>
                <div className="history-list" style={{ marginTop: 10 }}>
                  {announcements.length > 0 ? (
                    announcements.slice(0, 3).map((announcement) => (
                      <div key={announcement.id} className="history-card" style={{ padding: 12 }}>
                        <strong>{announcement.title}</strong>
                        <div className="muted" style={{ marginTop: 6 }}>{announcement.body}</div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-card" style={{ padding: 14 }}>目前沒有公告。</div>
                  )}
                </div>
              </div>

              <div className="stat-cards" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
                {levelBar("等級", character.instinctLevel, character.instinctExp)}
                {levelBar("戰鬥等級", character.battleLevel, character.battleExp)}
                {levelBar("鍛造等級", character.forgeLevel, character.forgeExp)}
              </div>

              <div className="panel" style={{ padding: 16 }}>
                <div className="panel-heading">
                  <strong>定位與技能</strong>
                  <span className="muted">主定位保留，另外可選 3 個次要角色</span>
                </div>
                <div className="form-grid two-col" style={{ marginTop: 14 }}>
                  <label className="field">
                    <span>主定位</span>
                    <select value={character.className} onChange={(event) => void handleChangeClass(event.target.value as CharacterClass)}>
                      {classOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <div className="banner" style={{ padding: 10 }}>
                    次要角色技能會在戰鬥中自動施放，不需要手動裝備。角色卡等級越高，技能種類與觸發率越高。
                  </div>
                </div>
                <div className="member-grid role-card-grid" style={{ marginTop: 14 }}>
                  {classMasteryRows.map((mastery) => (
                    <div key={mastery.className} className="member-card" style={{ padding: 14 }}>
                      <strong>{classOptions.find((option) => option.value === mastery.className)?.label || mastery.className}熟練度</strong>
                      <div className="muted">Lv.{mastery.level} · EXP {mastery.exp} / {Math.max(40, mastery.level * 70)}</div>
                      <div className="progress-bar"><div className="progress-fill" style={{ width: `${percent(mastery.exp, Math.max(40, mastery.level * 70))}%` }} /></div>
                      <div className="muted">{mastery.className === character.className ? "目前主定位，行動與戰鬥會累積熟練度。" : "切換後使用這個職業自己的熟練等級。"}</div>
                    </div>
                  ))}
                </div>
                <div className="member-grid role-card-grid" style={{ marginTop: 14 }}>
                  {selectedSecondaryCharacters.map(({ slot, definition }) => (
                    <div key={slot.slot} className="member-card" style={{ padding: 14 }}>
                      <label className="field">
                        <span>次要角色 {slot.slot}</span>
                        <select value={slot.characterId || ""} onChange={(event) => void handleSelectSecondary(slot.slot, event.target.value)}>
                          <option value="">未選擇</option>
                          {characterCatalog.secondaryCharacters.map((entry) => (
                            <option key={entry.id} value={entry.id} disabled={character.secondaryCharacters.some((selected) => selected.slot !== slot.slot && selected.characterId === entry.id)}>
                              {entry.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {definition ? (
                        <>
                          <strong>{definition.name} · {definition.origin}</strong>
                          <div className="muted">Lv.{slot.level} · EXP {slot.exp} / {Math.max(35, slot.level * 55)}</div>
                          <div className="progress-bar"><div className="progress-fill" style={{ width: `${percent(slot.exp, Math.max(35, slot.level * 55))}%` }} /></div>
                          <div className="muted">{definition.role} · {definition.weapon}</div>
                          <div className="muted">{definition.detail}</div>
                          <div className="muted">
                            適配 {classOptions.map((option) => `${option.label} x${definition.classAffinity?.[option.value] ?? 1}`).join(" · ")}
                          </div>
                          <div className="muted">偏好裝備 {definition.preferredEquipmentSlots?.map(slotLabel).join("、") || "無"}</div>
                          <div className="tag-row">
                            <span className="tag is-buff">{statBonusSummary(definition.statBonus)}</span>
                            {slot.unlockedSkillIds.map((skillId) => {
                              const skill = characterCatalog.specialSkills.find((entry) => entry.id === skillId);
                              return skill ? <span key={skill.id} className="tag">{skill.name} Lv.{skill.unlockLevel || 1}</span> : null;
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="muted">選一個角色取得數值加成、專屬武器概念與技能。</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="stat-cards" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <div className="stat-card" style={{ padding: 16 }}>
                  <strong>資源</strong>
                  <div className="muted" style={{ marginTop: 8 }}>HP {character.hp} / {character.maxHp}</div>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${percent(character.hp, character.maxHp)}%` }} /></div>
                  <div className="muted" style={{ marginTop: 8 }}>MP {character.mp} / {character.maxMp}</div>
                  <div className="progress-bar"><div className="progress-fill is-mp" style={{ width: `${percent(character.mp, character.maxMp)}%` }} /></div>
                  <div className="muted" style={{ marginTop: 8 }}>精力 {character.energy} / {character.maxEnergy}</div>
                  <div className="progress-bar"><div className="progress-fill is-energy" style={{ width: `${percent(character.energy, character.maxEnergy)}%` }} /></div>
                </div>
                <div className="stat-card" style={{ padding: 16 }}>
                  <strong>8 個屬性</strong>
                  <div className="muted" style={{ marginTop: 10 }}>
                    攻 {character.stats.attack} · 防 {character.stats.defense} · 運 {character.stats.luck}
                  </div>
                  <div className="muted">智 {character.stats.intelligence} · 體 {character.stats.vitality} · 精 {character.stats.spirit}</div>
                  <div className="muted">技 {character.stats.technique} · 韌 {character.stats.tenacity}</div>
                  <div className="muted" style={{ marginTop: 8 }}>攻城：攻/智/技破防，體/韌降低精力損耗。</div>
                  <div className="muted">守城：防/精/韌提高存活，運氣降低戰損。</div>
                </div>
                {currentCastle ? (
                  <div className="stat-card" style={{ padding: 16 }}>
                    <strong>目前位置</strong>
                    <div className="muted" style={{ marginTop: 10 }}>{currentCastle.name}</div>
                    <div className="muted">{currentCastle.layerName}</div>
                    <div className="muted">距核心 {currentCastle.distanceFromCapital} 層 · {castleSpecialtyLabel(currentCastle.specialty)}</div>
                    {character.movement ? (
                      <div className="banner" style={{ padding: 10, marginTop: 10 }}>
                        移動中：{movementRouteLabel}
                        <div className="muted">抵達 {formatDate(character.movement.endsAt)}</div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="stat-card" style={{ padding: 16 }}>
                  <strong>簽到</strong>
                  <div className="battle-actions" style={{ marginTop: 10 }}>
                    <button className="primary-button" onClick={() => void handleClaimDaily()} disabled={Boolean(signInStatus?.dailyClaimedToday)} type="button">
                      {signInStatus?.dailyClaimedToday ? "今日已簽到" : "每日簽到"}
                    </button>
                    <button className="secondary-button" onClick={() => void handleClaimFlash()} disabled={!signInStatus?.flashEventActive || Boolean(signInStatus?.flashClaimedToday)} type="button">
                      {signInStatus?.flashEventActive ? "突發簽到" : "無活動"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="equipment-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                {(Object.keys(character.equipmentSlots) as EquipmentSlotKey[]).map((slot) => {
                  const item = character.equipmentSlots[slot];
                  return (
                    <div className="equipment-card" key={slot} style={{ padding: 14 }}>
                      <strong>{slotLabel(slot)}</strong>
                      <div className="muted" style={{ marginTop: 8 }}>{item ? item.name : "未裝備"}</div>
                      {item ? (
                        <div className="muted" style={{ marginTop: 6 }}>
                          耐久 {item.durability ?? "-"} / {item.maxDurability ?? "-"}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {activeNav === "actions" ? (
            <section className="section-stack">
              <div className="panel command-panel">
                <div className="panel-heading">
                  <div>
                    <strong>ACTION PROTOCOL</strong>
                    <div className="muted" style={{ marginTop: 6 }}>
                      {isIdle(character) ? "角色閒暇中，可以安排下一個行動。" : `目前狀態：${myActivityStatus.label}，完成前不能插入新行動。`}
                    </div>
                  </div>
                  <span className={`status-pill compact status-${myActivityStatus.tone}`}>{myActivityStatus.label}</span>
                </div>
                <div className="quick-metric-grid">
                  <div><span>QUEUE</span><strong>{character.actionQueue.items.length}</strong></div>
                  <div><span>ENERGY</span><strong>{character.energy}/{character.maxEnergy}</strong></div>
                  <div><span>LOCATION</span><strong>{currentCastle?.name || "-"}</strong></div>
                </div>
              </div>

              <div className="shop-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                {trainingActions.map((entry) => (
                  <div className="action-card" key={entry.type} style={{ padding: 16 }}>
                    <strong>{entry.title}</strong>
                    <div className="muted" style={{ marginTop: 6 }}>{entry.detail}</div>
                    <button className="primary-button" style={{ marginTop: 14 }} onClick={() => void handleQueue(entry.type)} disabled={!isIdle(character)} type="button">
                      加入隊列
                    </button>
                  </div>
                ))}
                <div className="action-card" style={{ padding: 16 }}>
                  <strong>恢復</strong>
                  <div className="muted" style={{ marginTop: 6 }}>安排一段休息時間，專心回復狀態。</div>
                  <button className="primary-button" style={{ marginTop: 14 }} onClick={() => void handleQueue("rest")} disabled={!isIdle(character)} type="button">
                    加入隊列
                  </button>
                </div>
              </div>

              <div className="panel" style={{ padding: 16 }}>
                <strong>挖礦與恢復</strong>
                <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginTop: 14 }}>
                  <label className="field">
                    <span>淺層挖礦時數</span>
                    <select value={miningHours.mine_shallow} onChange={(event) => setMiningHours((current) => ({ ...current, mine_shallow: Number(event.target.value) }))}>
                      {[1, 2, 4, 8, 12].map((hours) => <option key={hours} value={hours}>{hours} 小時</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>深層挖礦時數</span>
                    <select value={miningHours.mine_deep} onChange={(event) => setMiningHours((current) => ({ ...current, mine_deep: Number(event.target.value) }))}>
                      {[1, 2, 4, 8, 12].map((hours) => <option key={hours} value={hours}>{hours} 小時</option>)}
                    </select>
                  </label>
                </div>
                <div className="battle-actions" style={{ marginTop: 12 }}>
                  <button className="primary-button" onClick={() => void handleQueue("mine_shallow", miningHours.mine_shallow)} disabled={!isIdle(character)} type="button">淺層挖礦</button>
                  <button className="secondary-button" onClick={() => void handleQueue("mine_deep", miningHours.mine_deep)} disabled={!isIdle(character)} type="button">深層挖礦</button>
                </div>
              </div>

              <div className="panel" style={{ padding: 16 }}>
                <div className="panel-heading">
                  <strong>目前隊列</strong>
                  <button className="ghost-button" onClick={() => void handleCancelQueuedActions()} disabled={character.actionQueue.items.length <= 1} type="button">
                    全部取消
                  </button>
                </div>
                <div className="queue-list" style={{ marginTop: 12 }}>
                  {character.movement ? (
                    <div className="queue-card is-active" style={{ padding: 12, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <div>
                        <strong>據點移動中</strong>
                        <div className="muted">{movementRouteLabel}</div>
                        <div className="muted">抵達 {formatDate(character.movement.endsAt)}</div>
                      </div>
                      <span className="mini-pill">進行中</span>
                    </div>
                  ) : null}
                  {character.actionQueue.items.length > 0 ? (
                    character.actionQueue.items.map((item, index) => (
                      <div className="queue-card" key={item.id} style={{ padding: 12, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                        <div>
                          <strong>{item.label}</strong>
                          <div className="muted">開始 {formatDate(item.startAt)} · 結束 {formatDate(item.endsAt)}</div>
                        </div>
                        {index > 0 ? (
                          <button className="ghost-button" onClick={() => void handleCancelQueue(item.id)} type="button">
                            取消
                          </button>
                        ) : (
                          <span className="mini-pill">{item.status === "active" ? "進行中" : "排隊中"}</span>
                        )}
                      </div>
                    ))
                  ) : !character.movement ? (
                    <div className="empty-card" style={{ padding: 14 }}>目前沒有隊列。</div>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {activeNav === "tower" ? (
            <section className="section-stack tower-page">
              {!character.factionId ? (
                <div className="panel tower-terminal">
                  <div className="tower-panel-title">
                    <span>/ TOWER</span>
                    <strong>請先加入陣營</strong>
                  </div>
                  <button className="primary-button" onClick={() => setActiveNav("faction")} type="button">
                    <Castle size={16} /> 前往陣營
                  </button>
                </div>
              ) : (
                <>
                  <div className="tower-command-grid">
                    <div className="panel tower-terminal">
                      <div className="tower-panel-title">
                        <span>/ STATUS</span>
                        <strong>塔層狀態</strong>
                      </div>
                      <div className="tower-status-row">
                        <div>
                          <span className="metric-label">LAYER</span>
                          <strong className="tower-big-number">{towerProgress?.currentLayer ?? 1}</strong>
                        </div>
                        <div>
                          <span className="metric-label">SCENE</span>
                          <strong>{towerSceneBand(towerProgress?.currentLayer ?? 1)}</strong>
                          <div className="muted">最高通關 {towerProgress?.highestClearedLayer ?? 0} 層</div>
                        </div>
                        <span className={`mini-pill ${towerProgress?.bossUnlocked ? "is-live" : ""}`}>
                          {towerProgress?.bossUnlocked ? "Boss 已遇到" : "搜尋中"}
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill is-energy" style={{ width: `${towerProgress?.progress ?? 0}%` }} />
                      </div>
                      <div className="tower-step-row" aria-label="塔層步數">
                        {Array.from({ length: towerProgress?.stepsRequired ?? 5 }).map((_, index) => (
                          <span key={index} className={index < (towerProgress?.steps ?? 0) ? "is-done" : ""} />
                        ))}
                      </div>
                      <div className="tower-rating-card">
                        <div>
                          <span className="metric-label">FUN SCORE</span>
                          <strong>{towerFunScore.toFixed(1)} / 10</strong>
                        </div>
                        <span>{towerFunSummary(towerFunScore, towerProgress)}</span>
                      </div>
                      <div className="muted">{towerProgress?.lastEvent || "尚未開始推進本層。"}</div>
                    </div>

                    <div className="panel tower-terminal">
                      <div className="tower-panel-title">
                        <span>/ LOCATION</span>
                        <strong>據點</strong>
                      </div>
                      {selectedTowerCastle ? (
                        <>
                          <div className="tower-location-card">
                            <MapPinned size={22} />
                            <div>
                              <strong>{selectedTowerCastle.name}</strong>
                              <div className="muted">{selectedTowerCastle.layerName} · {castleSpecialtyLabel(selectedTowerCastle.specialty)}</div>
                            </div>
                            <span className={`mini-pill ${isAtTowerCastle ? "is-live" : ""}`}>{isAtTowerCastle ? "目前所在" : "未抵達"}</span>
                          </div>
                          {towerCastles.length > 1 ? (
                            <label className="field">
                              <span>Boss 據點</span>
                              <select value={selectedTowerCastle.id} onChange={(event) => setSelectedTowerCastleId(event.target.value)}>
                                {towerCastles.map((castle) => (
                                  <option key={castle.id} value={castle.id}>{castle.name}</option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                          {character.movement ? (
                            <div className="banner tower-lock-strip">
                              <strong>移動中</strong>
                              <span>{movementRouteLabel}</span>
                              <span>抵達 {formatDate(character.movement.endsAt)}</span>
                            </div>
                          ) : !isAtTowerCastle ? (
                            <button className="primary-button" onClick={() => void handleMoveCastle(selectedTowerCastle.id)} disabled={!isIdle(character)} type="button">
                              <Footprints size={16} /> 前往據點
                            </button>
                          ) : (
                            <span className="mini-pill is-live">可推進塔層</span>
                          )}
                        </>
                      ) : (
                        <div className="empty-card" style={{ padding: 14 }}>你的陣營還沒有公會 Boss 據點。</div>
                      )}
                    </div>
                  </div>

                  <div className="tower-action-layout">
                    <div className="panel tower-terminal">
                      <div className="tower-panel-title">
                        <span>/ ADVANCE</span>
                        <strong>推進模式</strong>
                      </div>
                      <div className="tower-mode-grid">
                        {(["rush", "hunt"] as TowerAdvanceMode[]).map((mode) => (
                          <button
                            key={mode}
                            className={`tower-mode-card ${towerAdvanceMode === mode ? "is-active" : ""}`}
                            onClick={() => setTowerAdvanceMode(mode)}
                            type="button"
                          >
                            {mode === "rush" ? <Footprints size={22} /> : <Swords size={22} />}
                            <strong>{towerModeLabel(mode)}</strong>
                            <span>{towerModeDetail(mode)}</span>
                          </button>
                        ))}
                      </div>
                      <div className="battle-actions">
                        <button
                          className="primary-button"
                          onClick={() => void handleAdvanceTower(towerAdvanceMode)}
                          disabled={!canUseTowerAction || Boolean(towerProgress?.bossUnlocked)}
                          type="button"
                        >
                          <Footprints size={16} /> 執行{towerModeLabel(towerAdvanceMode)}
                        </button>
                        <span className="muted">
                          {towerProgress?.bossUnlocked ? "已遇到 Boss，請挑戰或撤退。" : canUseTowerAction ? "精力足夠時可推進。" : "需在 Boss 據點且角色閒暇。"}
                        </span>
                      </div>
                    </div>

                    <div className="panel tower-terminal tower-boss-zone">
                      <div className="tower-panel-title">
                        <span>/ BOSS</span>
                        <strong>挑戰 Boss</strong>
                      </div>
                      <div className="tower-boss-card">
                        <Skull size={28} />
                        <div>
                          <strong>{towerProgress?.bossName || "未鎖定 Boss"}</strong>
                          <div className="muted">
                            HP {towerProgress?.bossHp ?? "-"} · 攻擊 {towerProgress?.bossAttack ?? "-"} · {towerProgress?.rewardSummary || "公庫與個人獎勵"}
                          </div>
                        </div>
                      </div>
                      <div className="battle-actions">
                        <button
                          className="primary-button"
                          onClick={() => selectedTowerCastle && void handleFactionTowerBattle(selectedTowerCastle.id, "boss")}
                          disabled={!canUseTowerAction || !towerProgress?.bossUnlocked}
                          type="button"
                        >
                          <Swords size={16} /> 挑戰 Boss
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() => void handleRetreatTowerBoss()}
                          disabled={!canUseTowerAction || !towerProgress?.bossUnlocked}
                          type="button"
                        >
                          <Footprints size={16} /> 撤退
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          ) : null}

          {activeNav === "battle" ? (
            <section className="section-stack">
              <div className="panel" style={{ padding: 16 }}>
                <strong>組隊大廳</strong>
                <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 14 }}>
                  <label className="field">
                    <span>建立隊伍代碼</span>
                    <input value={partyCode} maxLength={6} onChange={(event) => setPartyCode(sanitizePartyCodeInput(event.target.value))} placeholder="留空會自動產生 6 碼" />
                  </label>
                  <label className="field">
                    <span>加入隊伍代碼</span>
                    <input value={joinPartyCode} maxLength={6} onChange={(event) => setJoinPartyCode(sanitizePartyCodeInput(event.target.value))} placeholder="例如 ABC123" />
                  </label>
                </div>
                <div className="muted" style={{ marginTop: 10 }}>隊伍代碼固定為 6 碼英文或數字。</div>
                <div className="battle-actions" style={{ marginTop: 12 }}>
                  <button className="primary-button" onClick={createParty} type="button">建立隊伍</button>
                  <button className="secondary-button" onClick={() => joinParty()} type="button">加入隊伍</button>
                  {roomState ? <button className="ghost-button" onClick={leaveParty} type="button">離開隊伍</button> : null}
                </div>
              </div>

              <div className="panel" style={{ padding: 16 }}>
                <div className="panel-heading">
                  <div>
                    <strong>場景挑戰</strong>
                    <div className="muted" style={{ marginTop: 6 }}>探險會產生多步事件；公會 Boss 會用逐回合戰報推進公會討伐。</div>
                  </div>
                  <span className="mini-pill">{isIdle(character) ? "可挑戰" : "角色忙碌中"}</span>
                </div>
                <div
                  className="battle-scene-grid battle-scene-rail"
                  onPointerCancel={handleSceneRailPointerEnd}
                  onPointerDown={handleSceneRailPointerDown}
                  onPointerMove={handleSceneRailPointerMove}
                  onPointerUp={handleSceneRailPointerEnd}
                  ref={sceneRailRef}
                  style={{ marginTop: 14 }}
                >
                  {battleScenes.map((castle) => {
                    const difficulty = sceneDifficulty(castle);
                    return (
                      <div key={castle.id} className={`battle-scene-card scene-${castle.mapNodePurpose}`}>
                        <div className="battle-scene-visual">
                          <span className="battle-scene-icon"><Swords size={20} /></span>
                          <div>
                            <strong>{battleSceneName(castle)}</strong>
                            <div className="muted">{castle.name} · {mapNodePurposeLabel(castle.mapNodePurpose)}</div>
                          </div>
                        </div>
                        <div className="muted">{battleSceneDetail(castle)}</div>
                        <div className="tag-row compact" style={{ justifyContent: "flex-start" }}>
                          <span className="mini-pill">場景難度：{soloDifficultyLabel(difficulty)}</span>
                          <span className="mini-pill">外層 {castle.layer}</span>
                          <span className="mini-pill">{castleSpecialtyLabel(castle.specialty)}</span>
                        </div>
                        <div className="muted">{soloDifficultySummary(difficulty, castle.layer)}</div>
                        <div className="battle-actions">
                          <button
                            className="secondary-button"
                            onClick={() => {
                              if (sceneDragRef.current.dragged) return;
                              void handleSoloBattle(castle.id);
                            }}
                            disabled={!isIdle(character)}
                            type="button"
                          >
                            開始探險
                          </button>
                          {castle.mapNodePurpose === "guild_boss" ? (
                            <button
                              className="primary-button"
                              onClick={() => {
                                if (sceneDragRef.current.dragged) return;
                                setSelectedTowerCastleId(castle.id);
                                setActiveNav("tower");
                              }}
                              type="button"
                            >
                              <TowerControl size={16} /> 進入爬塔
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  {battleScenes.length === 0 ? <div className="empty-card" style={{ padding: 14 }}>加入陣營後會顯示可挑戰場景。</div> : null}
                </div>
              </div>

              <div className="panel" style={{ padding: 16 }}>
                <div className="panel-heading">
                  <div>
                    <strong>世界 Boss 競賽</strong>
                    <div className="muted" style={{ marginTop: 6 }}>所有公會挑戰同一個事件 Boss；每個公會進場都面對滿血 Boss，第一個勝利公會取得主要資源。</div>
                  </div>
                  <span className="mini-pill">{worldBoss?.winnerFactionId ? "已有勝利公會" : "競賽中"}</span>
                </div>
                {worldBoss ? (
                  <div className="battle-scene-card scene-guild_boss" style={{ marginTop: 14 }}>
                    <div className="battle-scene-visual">
                      <span className="battle-scene-icon"><Trophy size={20} /></span>
                      <div>
                        <strong>{worldBoss.bossName}</strong>
                        <div className="muted">HP {worldBoss.bossHp} · 攻擊 {worldBoss.bossAttack}</div>
                      </div>
                    </div>
                    <div className="tag-row compact" style={{ justifyContent: "flex-start" }}>
                      <span className="mini-pill">主要公庫獎勵 {worldBoss.rewardGold} 金幣</span>
                      <span className="mini-pill">星砂 x{worldBoss.rewardMaterials}</span>
                      <span className="mini-pill">挑戰 {worldBoss.attempts.length} 次</span>
                    </div>
                    <div className="muted">
                      {worldBoss.winnerFactionId
                        ? `勝利公會：${factionState?.factions.find((faction) => faction.id === worldBoss.winnerFactionId)?.name || worldBoss.winnerFactionId}`
                        : "尚未有公會擊敗本輪世界 Boss。"}
                    </div>
                    <div className="battle-actions">
                      <button className="primary-button" onClick={() => void handleWorldBossChallenge()} disabled={!isIdle(character) || !character.factionId} type="button">
                        挑戰世界 Boss
                      </button>
                      <button className="ghost-button" onClick={() => void refreshWorldBoss()} type="button">重整狀態</button>
                    </div>
                  </div>
                ) : (
                  <div className="empty-card" style={{ padding: 14, marginTop: 14 }}>讀取世界 Boss 中。</div>
                )}
              </div>

              <div className="room-list">
                {rooms.map((room) => (
                  <button key={room.roomId} className="room-card" onClick={() => joinParty(room.roomId)} type="button" style={{ padding: 14, textAlign: "left" }}>
                    <strong>{room.roomId}</strong>
                    <div className="muted" style={{ marginTop: 6 }}>成員 {room.memberCount} 人 · {room.phase === "lobby" ? "待機中" : room.phase === "battle" ? "戰鬥中" : "已結束"}</div>
                  </button>
                ))}
                {rooms.length === 0 ? <div className="empty-card" style={{ padding: 14 }}>目前沒有公開隊伍。</div> : null}
              </div>

              {roomState ? (
                <div className="panel" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <strong>隊伍 {roomState.roomId}</strong>
                      <div className="muted">隊長 {roomState.members.find((member) => member.isHost)?.displayName || "-"}</div>
                    </div>
                    {roomState.phase === "lobby" ? (
                      <button className="primary-button" onClick={startBattle} disabled={!canLeadPartyAction} type="button">開始戰鬥</button>
                    ) : null}
                  </div>
                  {partyBlocker ? <div className="banner" style={{ padding: 12, marginTop: 12 }}>隊伍中有成員不是閒暇中：{partyBlocker.displayName}</div> : null}
                  <div className="member-grid" style={{ marginTop: 14 }}>
                    {roomState.members.map((member) => (
                      <div key={member.userId} className="member-card" style={{ padding: 12 }}>
                        {(() => {
                          const memberStatus = activityStatusFor(member.character, roomState, member.userId);
                          return <span className={`mini-pill status-${memberStatus.tone}`} style={{ marginBottom: 8 }}>{memberStatus.label}</span>;
                        })()}
                        <strong>{member.displayName}</strong>
                        <div className="muted">{member.isHost ? "隊長" : "隊員"}</div>
                        <div className="muted" style={{ marginTop: 8 }}>
                          HP {member.currentHp}/{member.maxHp} · MP {member.currentMp}/{member.maxMp}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {roomState && (roomState.phase === "battle" || roomState.phase === "ended") && battleOverlayDismissed ? (
                <div className="banner" style={{ padding: 14 }}>
                  <strong>{roomState.phase === "ended" ? "戰鬥已結束" : "戰鬥同步中"}</strong>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {roomState.phase === "ended" && (battleSummary || roomState.battleSummary)
                      ? `結果：${(battleSummary || roomState.battleSummary)?.winner === "players" ? "玩家勝利" : "Boss 獲勝"}`
                      : "你已收起戰鬥畫面，戰鬥仍會在背景同步。"}
                  </div>
                  <div className="battle-actions" style={{ marginTop: 10 }}>
                    <button className="primary-button" onClick={() => setBattleOverlayDismissed(false)} type="button">打開戰鬥畫面</button>
                    {roomState.phase === "ended" ? <button className="secondary-button" onClick={leaveParty} type="button">離開隊伍</button> : null}
                  </div>
                </div>
              ) : null}

              {battleOverlayVisible ? (
                <div style={{ position: "fixed", inset: 20, background: "rgba(9, 12, 20, 0.82)", zIndex: 30, display: "grid", placeItems: "center" }}>
                  <div className="battle-stage" style={{ width: "min(980px, 100%)", maxHeight: "90vh", overflow: "auto", padding: 22 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
                      <div>
                        <div className="eyebrow">同頁戰鬥</div>
                        <h2 style={{ marginBottom: 4 }}>{roomState?.boss?.name || "戰鬥中"}</h2>
                        <div className="muted">隊伍代碼 {roomState?.roomId}</div>
                      </div>
                      <button className="ghost-button" onClick={() => setBattleOverlayDismissed(true)} type="button">收起回到頁面</button>
                    </div>
                    {roomState?.boss ? (
                      <div className="boss-stage-card" style={{ padding: 16, marginBottom: 14 }}>
                        <strong>Boss HP {roomState.boss.hp} / {roomState.boss.maxHp}</strong>
                        <div className="progress-bar" style={{ marginTop: 10 }}>
                          <div className="progress-fill is-danger" style={{ width: `${percent(roomState.boss.hp, roomState.boss.maxHp)}%` }} />
                        </div>
                      </div>
                    ) : null}
                    {(() => {
                      const comboEvent = latestComboEvent(lastBattleTick?.specialEvents);
                      return comboEvent ? <ComboBurst event={comboEvent} key={`combo-${lastBattleTick?.tick}`} /> : null;
                    })()}
                    <div className="member-grid">
                      {(lastBattleTick?.members || roomState?.members || []).map((member) => (
                        <div key={member.userId} className="member-card" style={{ padding: 12 }}>
                          <strong>{member.displayName}</strong>
                          <div className="muted">HP {member.currentHp}/{member.maxHp}</div>
                          <div className="muted">輸出 {member.battleStats.damageDealt} · 承傷 {member.battleStats.damageTaken}</div>
                        </div>
                      ))}
                    </div>
                    <div className="history-list" style={{ marginTop: 14 }}>
                      {(lastBattleTick?.recentLogs || roomState?.logs || []).slice(-8).map((log, index) => {
                        const cleanLog = cleanBattleLog(log);
                        return (
                          <div className={`history-card battle-log-card is-${battleLogTone(cleanLog)}`} key={`${log}-${index}`} style={{ padding: 10 }}>{cleanLog}</div>
                        );
                      })}
                    </div>
                    {lastBattleTick?.specialEvents?.length ? (
                      <div className="tag-row" style={{ marginTop: 14 }}>
                        {lastBattleTick.specialEvents.slice(-5).map((event, index) => (
                          <span key={`${event.kind}-${index}`} className="mini-pill">{event.label}</span>
                        ))}
                      </div>
                    ) : null}
                    {battleSummary ? (
                      <div className="banner" style={{ padding: 14, marginTop: 14 }}>
                        <strong>{battleSummary.winner === "players" ? "玩家勝利" : "Boss 獲勝"}</strong>
                        <div className="muted">結束時間 {formatDate(battleSummary.endedAt)}</div>
                        <div className="battle-actions" style={{ marginTop: 10 }}>
                          <button className="secondary-button" onClick={() => setBattleOverlayDismissed(true)} type="button">查看頁面結果</button>
                          <button className="ghost-button" onClick={leaveParty} type="button">離開隊伍</button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {activeNav === "faction" ? (
            <section className="section-stack">
              {!character.factionId ? (
                <div className="panel" style={{ padding: 16 }}>
                  <strong>先選擇陣營</strong>
                  <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 12 }}>
                    {factionState?.factions.map((faction) => (
                      <label key={faction.id} className="field">
                        <span>{faction.name}</span>
                        <input type="radio" checked={selectedFactionId === faction.id} onChange={() => setSelectedFactionId(faction.id)} />
                        <div className="muted">{faction.description}</div>
                      </label>
                    ))}
                  </div>
                  <button className="primary-button" style={{ marginTop: 14 }} onClick={() => void handleSelectFaction()} type="button">
                    確認加入
                  </button>
                </div>
              ) : (
                <>
                  <div className="auth-tabs">
                    {([
                      ["map", "視覺地圖 / 城池"],
                      ["diplomacy", "外交"],
                      ["treasury", "公庫"],
                      ["members", "成員"]
                    ] as Array<[FactionTab, string]>).map(([key, label]) => (
                      <button key={key} className={factionTab === key ? "is-active" : ""} onClick={() => setFactionTab(key)} type="button">
                        {label}
                      </button>
                    ))}
                  </div>

{factionTab === "map" ? (
                    <div className="section-stack">
                      <div className="panel" style={{ padding: 16 }}>
                        <div className="panel-heading">
                          <strong>天下城池地圖</strong>
                          <span className="muted">{visibleCastles.length} 座城 · {factionState?.factions.length ?? 0} 個陣營</span>
                        </div>
                        <div className="muted" style={{ marginTop: 8 }}>
                          所有陣營共用同一張戰略地圖；點城池後在右側查看城防、設施、Boss 與可執行操作。
                        </div>
                        <div className="map-legend-row" style={{ marginTop: 12 }}>
                          {factionState?.factions.map((faction) => (
                            <span key={faction.id} className={`map-legend-item ${faction.id === character.factionId ? "is-mine" : ""}`}>
                              {faction.name} · {faction.memberCount} 人
                            </span>
                          ))}
                        </div>
                        <div className="map-toolbar" style={{ marginTop: 12 }}>
                          <button className="secondary-button" onClick={() => setMapZoom((value) => Math.max(0.7, Number((value - 0.1).toFixed(1))))} type="button">
                            縮小
                          </button>
                          <input
                            aria-label="地圖縮放"
                            max="1.6"
                            min="0.7"
                            onChange={(event) => setMapZoom(Number(event.target.value))}
                            step="0.1"
                            type="range"
                            value={mapZoom}
                          />
                          <button className="secondary-button" onClick={() => setMapZoom((value) => Math.min(1.6, Number((value + 0.1).toFixed(1))))} type="button">
                            放大
                          </button>
                          <button className="ghost-button" onClick={() => setMapZoom(1)} type="button">
                            重設 {Math.round(mapZoom * 100)}%
                          </button>
                        </div>
                        {character.movement ? (
                          <div className="banner" style={{ padding: 12, marginTop: 12 }}>
                            <strong>移動中</strong>
                            <div className="muted">{movementRouteLabel}</div>
                            <div className="muted">抵達時間 {formatDate(character.movement.endsAt)}</div>
                          </div>
                        ) : null}
                        {activeFactionProjects.length > 0 ? (
                          <div className="history-list" style={{ marginTop: 12 }}>
                            {activeFactionProjects.map((project) => {
                              const joined = project.contributorUserIds.includes(user.id);
                              return (
                                <div key={project.id} className="history-card" style={{ padding: 12 }}>
                                  <strong>{project.label}</strong>
                                  <div className="muted">結束 {formatDate(project.endsAt)} · 協力 {project.contributorUserIds.length} 人</div>
                                  <div className="battle-actions" style={{ marginTop: 10 }}>
                                    {joined ? (
                                      <button className="secondary-button" onClick={() => void handleLeaveProject(project.id)} type="button">退出工程</button>
                                    ) : (
                                      <button className="primary-button" onClick={() => void handleJoinProject(project.id)} type="button">協助工程</button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                        <div className="world-map-layout" style={{ marginTop: 12 }}>
                          <div className="faction-map-board">
                            <div className="strategic-map-canvas" style={{ "--map-zoom": mapZoom } as CSSProperties}>
                              <div className="map-region-label map-region-label-core">王城</div>
                              <div className="map-region-label map-region-label-pass">關隘</div>
                              <div className="map-region-label map-region-label-front">邊境</div>
                              <button className="map-challenge-node" onClick={() => setActiveNav("battle")} type="button">
                                <span><Swords size={20} /></span>
                                <strong>場景挑戰</strong>
                                <small>個人 / 公會戰鬥</small>
                              </button>
                              <svg className="strategic-map-territories" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                                {strategicMapTerritories.map((territory) => (
                                  <polygon
                                    key={territory.factionId}
                                    points={territory.points}
                                    style={{ "--territory-color": territory.color } as CSSProperties}
                                  />
                                ))}
                              </svg>
                              <svg className="strategic-map-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                                {[21.5, 29.5, 37, 44].map((radius) => (
                                  <circle className="map-ring-road" cx="50" cy="50" key={`ring-${radius}`} r={radius} />
                                ))}
                                {strategicMapRoutes.map((route) => (
                                  <line
                                    key={route.id}
                                    x1={route.from.x}
                                    y1={route.from.y}
                                    x2={route.to.x}
                                    y2={route.to.y}
                                  />
                                ))}
                              </svg>
                              {strategicMapNodes.map(({ castle, x, y }) => {
                                const ownerFaction = factionState?.factions.find((faction) => faction.id === castle.ownerFactionId);
                                const isMine = castle.ownerFactionId === character.factionId;
                                const isCurrentLocation = castle.id === character.currentCastleId;
                                const isMovementDestination = castle.id === character.movement?.toCastleId;
                                const isMovementOrigin = castle.id === character.movement?.fromCastleId;
                                const isSelected = castle.id === selectedMapCastle?.id;
                                const project = activeFactionProjects.find((entry) => entry.castleId === castle.id && entry.status === "active");
                                const showLabel = castle.isCapital || isCurrentLocation || isMovementDestination || isSelected;
                                return (
                                  <button
                                    key={castle.id}
                                    aria-label={`${castle.name}，${ownerFaction?.name || "未歸屬"}，${castle.layerName}`}
                                    className={`castle-node ${castle.isCapital ? "is-capital" : ""} ${showLabel ? "has-label" : ""} ${isSelected ? "is-selected" : ""} ${isCurrentLocation ? "is-current" : ""} ${isMovementDestination ? "is-destination" : ""} ${isMine ? "is-owned" : "is-enemy"}`}
                                    onClick={() => setSelectedMapCastleId(castle.id)}
                                    style={{ left: `${x}%`, top: `${y}%`, "--faction-color": ownerFaction?.color || "#d6ad5d" } as CSSProperties}
                                    title={`${castle.name}｜${ownerFaction?.name || "未歸屬"}｜${mapNodePurposeLabel(castle.mapNodePurpose)}`}
                                    type="button"
                                  >
                                    <span className="map-node-marker">
                                      <Castle size={castle.isCapital ? 26 : 18} />
                                    </span>
                                    <span className="castle-node-label">
                                      <strong>{castle.name}</strong>
                                      <small>{ownerFaction?.name || "未歸屬"} · {mapNodePurposeLabel(castle.mapNodePurpose)}</small>
                                    </span>
                                    <span className="castle-node-badges">
                                      {isCurrentLocation ? <span className="mini-pill">目前</span> : null}
                                      {isMovementOrigin && !isCurrentLocation ? <span className="mini-pill">出發</span> : null}
                                      {isMovementDestination ? <span className="mini-pill">目的</span> : null}
                                      {project ? <span className="mini-pill">工程</span> : null}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {selectedMapCastle ? (() => {
                            const castle = selectedMapCastle;
                            const ownerFaction = factionState?.factions.find((faction) => faction.id === castle.ownerFactionId);
                            const isMine = castle.ownerFactionId === character.factionId;
                            const isCurrentLocation = castle.id === character.currentCastleId;
                            const isMovementDestination = castle.id === character.movement?.toCastleId;
                            const isMovementOrigin = castle.id === character.movement?.fromCastleId;
                            const layerDistance = Math.max(1, Math.abs((currentCastle?.distanceFromCapital ?? 0) - castle.distanceFromCapital));
                            const buildGold = buildFacilityGold(castle, factionState?.selectedFaction?.tech.castle ?? 0);
                            const repairPlan = repairCastlePlan(castle, factionState?.selectedFaction?.tech.defense ?? 0);
                            const project = activeFactionProjects.find((entry) => entry.castleId === castle.id && entry.status === "active");
                            const garrisons = factionState?.garrisons.filter((entry) => entry.castleId === castle.id) || [];
                            const activeSiege = factionState?.sieges.find((entry) => entry.castleId === castle.id && entry.status === "active");
                            const isGarrisonedHere = character.garrisonAssignment?.castleId === castle.id;
                            const isInActiveSiege = activeSiege?.participants.some((participant) => participant.userId === character.userId);
                            return (
                              <aside className="castle-detail-panel">
                                <div className="castle-detail-header">
                                  <div>
                                    <strong>{castle.name}</strong>
                                    <div className="muted">{ownerFaction?.name || "未歸屬"} · {castle.layerName}</div>
                                  </div>
                                  <span className={`mini-pill ${isMine ? "is-friendly" : ""}`}>{isMine ? "我方城池" : "敵方城池"}</span>
                                </div>
                                <div className="tag-row">
                                  <span className="mini-pill">{mapNodePurposeLabel(castle.mapNodePurpose)}</span>
                                  <span className="mini-pill">{castleSpecialtyLabel(castle.specialty)}</span>
                                  {isCurrentLocation ? <span className="mini-pill">目前位置</span> : null}
                                  {isMovementOrigin && !isCurrentLocation ? <span className="mini-pill">出發地</span> : null}
                                  {isMovementDestination ? <span className="mini-pill">目的地</span> : null}
                                  {project ? <span className="mini-pill">工程中 · {project.contributorUserIds.length} 人</span> : null}
                                </div>
                                {character.movement ? (
                                  <div className="banner" style={{ padding: 10 }}>
                                    移動路線：{movementRouteLabel}
                                    <div className="muted">抵達 {formatDate(character.movement.endsAt)}</div>
                                  </div>
                                ) : null}
                                <div className="castle-detail-grid">
                                  <span>距核心</span><strong>{castle.distanceFromCapital} 層</strong>
                                  <span>城牆耐久</span><strong>{castle.fortification}/{castle.maxFortification}{castle.fortification < castle.maxFortification && garrisons.length > 0 && !activeSiege ? "（守軍維修中）" : ""}</strong>
                                  <span>駐防</span><strong>{garrisons.length}/{castle.garrisonSlots}</strong>
                                  <span>自動砲臺火力</span><strong>{castle.autoDefensePower}</strong>
                                  <span>地形優勢</span><strong>{castle.terrainAdvantage}</strong>
                                  <span>抗攻城</span><strong>{castle.siegeResistance}</strong>
                                  <span>建設槽</span><strong>{castle.facilities.length}/{castle.buildSlots}</strong>
                                  <span>設施</span><strong>{castle.facilities.length > 0 ? castle.facilities.join("、") : "尚未建設"}</strong>
                                </div>
                                {activeSiege ? (
                                  <div className="castle-boss-strip">
                                    <strong>攻城戰進行中</strong>
                                    <span>攻方 {factionState?.factions.find((faction) => faction.id === activeSiege.attackerFactionId)?.name || activeSiege.attackerFactionId} · 守方 {factionState?.factions.find((faction) => faction.id === activeSiege.defenderFactionId)?.name || activeSiege.defenderFactionId}</span>
                                    <span>城防 {activeSiege.fortificationCurrent}/{activeSiege.fortificationStart} · 第 {activeSiege.lastResolvedTick} 輪 · 結束 {formatDate(activeSiege.endsAt)}</span>
                                    {activeSiege.logs.slice(0, 3).map((log) => <span key={`${activeSiege.id}-${log.tick}`}>第 {log.tick} 輪：{log.message}</span>)}
                                    <div className="battle-actions">
                                      {!isInActiveSiege && isIdle(character) ? (
                                        <button className="secondary-button" onClick={() => void handleJoinSiege(activeSiege.id)} type="button">加入戰場</button>
                                      ) : null}
                                      <button className="ghost-button" onClick={() => void handleResolveSiege(activeSiege.id)} type="button">更新戰況</button>
                                    </div>
                                  </div>
                                ) : null}
                                <div className="muted">{castle.layerBenefit}</div>
                                <div className="castle-boss-strip">
                                  <strong>{castle.bossName}</strong>
                                  <span>技能：{castle.bossSkills.join("、")}</span>
                                  <span>獎勵：{castle.rewardSummary}</span>
                                </div>
                                {isMine && castle.mapNodePurpose === "guild_boss" ? (
                                  <div className="castle-boss-strip">
                                    <strong>公會爬層 Lv.{factionState?.selectedFaction?.tower.currentLayer ?? 1}</strong>
                                    <span>
                                      最高通關 {factionState?.selectedFaction?.tower.highestClearedLayer ?? 0} 層 ·
                                      進度 {factionState?.selectedFaction?.tower.steps ?? 0}/{factionState?.selectedFaction?.tower.stepsRequired ?? 5}
                                    </span>
                                    <div className="progress-bar">
                                      <div className="progress-fill is-energy" style={{ width: `${factionState?.selectedFaction?.tower.progress ?? 0}%` }} />
                                    </div>
                                    <span>當層 Boss：{factionState?.selectedFaction?.tower.bossName ?? "未設定"} · HP {factionState?.selectedFaction?.tower.bossHp ?? "-"}</span>
                                    <span>{factionState?.selectedFaction?.tower.rewardSummary}</span>
                                    <div className="battle-actions">
                                      <button
                                        className="secondary-button"
                                        onClick={() => {
                                          setSelectedTowerCastleId(castle.id);
                                          setActiveNav("tower");
                                        }}
                                        type="button"
                                      >
                                        <TowerControl size={16} /> 進入爬塔
                                      </button>
                                      <button
                                        className="primary-button"
                                        onClick={() => void handleFactionTowerBattle(castle.id, "boss")}
                                        disabled={!isIdle(character) || !isCurrentLocation || !factionState?.selectedFaction?.tower.bossUnlocked}
                                        type="button"
                                      >
                                        挑戰爬層 Boss
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                                <div className="battle-actions">
                                  {!isMine ? (
                                    <button className="primary-button" onClick={() => void handleAttackCastle(castle.id)} disabled={!canAttackCastle || Boolean(activeSiege)} type="button">
                                      發起攻城戰
                                    </button>
                                  ) : !isCurrentLocation ? (
                                    <button className="primary-button" onClick={() => void handleMoveCastle(castle.id)} disabled={Boolean(character.movement)} type="button">
                                      移動至此（{layerDistance * 30} 分）
                                    </button>
                                  ) : !isIdle(character) ? (
                                    <span className="mini-pill">忙碌中，暫不可操作</span>
                                  ) : (
                                    <span className="mini-pill">目前所在城池 · 可建設 / 修建</span>
                                  )}
                                </div>
                                {isMine && isCurrentLocation ? (
                                  <div className="castle-node-actions">
                                    <div className="battle-actions">
                                      {isGarrisonedHere ? (
                                        <button className="secondary-button" onClick={() => void handleLeaveGarrison(castle.id)} disabled={Boolean(activeSiege)} type="button">
                                          退出駐防
                                        </button>
                                      ) : (
                                        <button className="secondary-button" onClick={() => void handleGarrisonCastle(castle.id)} disabled={!isIdle(character) || garrisons.length >= castle.garrisonSlots} type="button">
                                          駐防此城
                                        </button>
                                      )}
                                    </div>
                                    <label className="field">
                                      <span>建設設施（公庫 {buildGold} 金幣）</span>
                                      <input
                                        value={facilityDrafts[castle.id] || ""}
                                        onChange={(event) => setFacilityDrafts((current) => ({ ...current, [castle.id]: event.target.value }))}
                                        placeholder={castle.specialty === "boss" ? "討伐營" : castle.specialty === "mining" ? "礦坑" : castle.specialty === "trade" ? "市集" : "農田"}
                                      />
                                    </label>
                                    <div className="battle-actions">
                                      <button className="secondary-button" onClick={() => void handleBuildFacility(castle.id)} disabled={!isIdle(character) || castle.facilities.length >= castle.buildSlots} type="button">
                                        發起建設工程
                                      </button>
                                      <button className="secondary-button" onClick={() => void handleRepairCastle(castle.id)} disabled={!isIdle(character) || repairPlan.repairAmount <= 0} type="button">
                                        防守 / 修建城防 +{repairPlan.repairAmount}（{repairPlan.gold} 金幣）
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </aside>
                            );
                          })() : (
                            <aside className="castle-detail-panel">
                              <strong>選擇城池</strong>
                              <div className="muted">點地圖上的城池查看詳情。</div>
                            </aside>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {factionTab === "diplomacy" ? (
                    <div className="panel" style={{ padding: 16 }}>
                      <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                        <label className="field">
                          <span>選擇目標陣營</span>
                          <select value={selectedFactionTarget} onChange={(event) => setSelectedFactionTarget(event.target.value)}>
                            <option value="">請選擇</option>
                            {factionState?.factions.filter((faction) => faction.id !== character.factionId).map((faction) => (
                              <option key={faction.id} value={faction.id}>{faction.name}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="battle-actions" style={{ marginTop: 12 }}>
                        <button className="primary-button" onClick={() => void handleCooperateRequest()} type="button">提出合作</button>
                        <button className="secondary-button" onClick={() => void handleDeclareWar()} type="button">宣戰</button>
                      </div>
                      <div className="history-list" style={{ marginTop: 14 }}>
                        {factionState?.diplomacyRequests.map((request) => (
                          <div key={request.id} className="history-card" style={{ padding: 12 }}>
                            <strong>{request.type === "cooperate" ? "合作申請" : request.type}</strong>
                            <div className="muted">狀態：{request.status}</div>
                            {request.status === "pending" ? (
                              <div className="battle-actions" style={{ marginTop: 10 }}>
                                <button className="primary-button" onClick={() => void respondCooperation(token, request.id, true).then(setFactionState).catch((error) => setFeedback(error.message))} type="button">接受</button>
                                <button className="secondary-button" onClick={() => void respondCooperation(token, request.id, false).then(setFactionState).catch((error) => setFeedback(error.message))} type="button">拒絕</button>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {factionTab === "treasury" ? (
                    <div className="panel" style={{ padding: 16 }}>
                      <strong>公庫</strong>
                      <div className="muted" style={{ marginTop: 6 }}>
                        公庫金幣 {factionState?.selectedFaction?.treasury.gold ?? 0}
                      </div>
                      <div className="muted" style={{ marginTop: 6 }}>公庫不發放給個人，金幣用於據點工程與公會科技。</div>
                      <div className="selector-grid" style={{ marginTop: 12 }}>
                        {factionTechOptions.map((option) => {
                          const level = factionState?.selectedFaction?.tech[option.key] ?? 0;
                          const cost = factionTechCost(level);
                          const treasuryGold = factionState?.selectedFaction?.treasury.gold ?? 0;
                          return (
                            <div key={option.key} className="selector-card">
                              <strong>{option.label} Lv.{level}</strong>
                              <div className="muted" style={{ marginTop: 6 }}>{option.detail}</div>
                              <div className="muted" style={{ marginTop: 6 }}>升級花費 {cost} 公庫金幣</div>
                              <button
                                className="primary-button"
                                style={{ marginTop: 10 }}
                                onClick={() => void handleUpgradeTech(option.key)}
                                disabled={treasuryGold < cost}
                                type="button"
                              >
                                升級
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {factionTab === "members" ? (
                    <div className="member-grid">
                      {factionState?.factions.find((faction) => faction.id === character.factionId) ? (
                        <div className="member-card" style={{ padding: 14 }}>
                          <strong>{factionState.selectedFaction?.name}</strong>
                          <div className="muted">成員數 {factionState.selectedFaction?.memberCount ?? 0}</div>
                          <div className="muted">領袖 {factionState.selectedFaction?.leaderDisplayName || "尚未指派"}</div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </section>
          ) : null}

          {activeNav === "inventory" ? (
            <section className="section-stack">
              <div className="panel" style={{ padding: 12 }}>
                <label className="field" style={{ margin: 0 }}>
                  <span>搜尋物品</span>
                  <input
                    onChange={(event) => setInventorySearch(event.target.value)}
                    placeholder="輸入名稱或效果關鍵字，例如 鐵礦、防禦"
                    value={inventorySearch}
                  />
                </label>
              </div>
              <div className="selector-grid">
                {inventoryTabs.map((tab) => (
                  <button
                    key={tab.key}
                    className={`selector-card ${inventoryTab === tab.key ? "is-active" : ""}`}
                    onClick={() => setInventoryTab(tab.key)}
                    type="button"
                  >
                    <strong>{tab.label}</strong>
                    <div className="muted" style={{ marginTop: 6 }}>{inventoryGroups[tab.key].length} 件</div>
                  </button>
                ))}
              </div>

              {inventoryTab === "equipment" ? (
                <div className="section-stack">
                  <div className="panel" style={{ padding: 16 }}>
                    <div className="panel-heading">
                      <strong>目前穿戴中</strong>
                      <span className="muted">{equipmentGroupOrder.filter((slot) => Boolean(character.equipmentSlots[slot])).length} / {equipmentGroupOrder.length}</span>
                    </div>
                    <div className="table-list" style={{ marginTop: 12 }}>
                      {equipmentGroupOrder.map((slot) => {
                        const item = character.equipmentSlots[slot];
                        return (
                          <div key={slot} className="history-card table-row">
                            <div className="table-main">
                              <strong>{slotLabel(slot)}</strong>
                              <div className="muted">{item?.name || "未裝備"}</div>
                            </div>
                            {item ? (
                              <div className="table-actions">
                                <button className="ghost-button" onClick={() => setDetailItem(item)} type="button">詳情</button>
                                <button className="secondary-button" onClick={() => void handleUnequip(slot)} type="button">卸下</button>
                                <button className="ghost-button" onClick={() => void handleRepairEquipment(slot, item.id)} type="button">修復</button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {equipmentInventoryGroups.map((group) => (
                    <div key={group.label} className="panel" style={{ padding: 16 }}>
                      <div className="panel-heading">
                        <strong>{group.label}</strong>
                        <div className="battle-actions">
                          <span className="muted">{group.items.length} 件</span>
                          <button
                            className="ghost-button"
                            onClick={() =>
                              setCollapsedEquipmentGroups((current) => ({
                                ...current,
                                [group.slot || "other"]: !current[group.slot || "other"]
                              }))
                            }
                            type="button"
                          >
                            {collapsedEquipmentGroups[group.slot || "other"] ? "展開" : "收起"}
                          </button>
                        </div>
                      </div>
                      {!collapsedEquipmentGroups[group.slot || "other"] ? (
                        <div className="table-list" style={{ marginTop: 12 }}>
                          {group.items.map((item) => (
                            <div
                              key={item.id}
                              className="history-card table-row draggable-row"
                              draggable
                              onDragStart={() => setDraggedItemId(item.id)}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={() => draggedItemId && void handleInventoryReorder(group.slot || "other", draggedItemId, item.id)}
                            >
                              <div className="table-main">
                                <strong>{item.name}</strong>
                                <div className="muted">{inventoryRowSummary(item)}</div>
                              </div>
                              <div className="table-actions">
                                <button className="ghost-button" onClick={() => setDetailItem(item)} type="button">詳情</button>
                                <button className="primary-button" onClick={() => void handleEquip(item.id)} type="button">裝備</button>
                                <button className="ghost-button" onClick={() => void handleRepairInventory(item.id)} type="button">修復</button>
                                <button className="secondary-button" onClick={() => void handleListMarket(item)} type="button">上架</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}

                  {equipmentInventoryGroups.length === 0 ? <div className="empty-card" style={{ padding: 14 }}>目前沒有可用裝備</div> : null}
                </div>
              ) : (
                <div className="panel" style={{ padding: 16 }}>
                  {inventoryTab === "manual" ? (
                    <div className="section-stack" style={{ marginBottom: 16 }}>
                      <div className="panel-heading">
                        <strong><ScrollText size={17} /> 秘籍槽</strong>
                        <span className="muted">{character.equippedManuals.length} / 3</span>
                      </div>
                      <div className="member-grid">
                        {character.learnedManuals.map((manual) => {
                          const equipped = character.equippedManuals.includes(manual.manualId);
                          return (
                            <div key={manual.manualId} className="member-card" style={{ padding: 14 }}>
                              <strong>{manual.name}</strong>
                              <div className="muted">{manual.effectSummary}</div>
                              <div className="muted">{statBonusSummary(manual.statBonus)}</div>
                              <button
                                className={equipped ? "secondary-button" : "primary-button"}
                                onClick={() => void (equipped ? handleUnequipManual(manual.manualId) : handleEquipManual(manual.manualId))}
                                disabled={!equipped && character.equippedManuals.length >= 3}
                                type="button"
                              >
                                {equipped ? "卸下 Buff" : "裝備 Buff"}
                              </button>
                            </div>
                          );
                        })}
                        {character.learnedManuals.length === 0 ? <div className="empty-card" style={{ padding: 14 }}>尚未學會任何秘籍。</div> : null}
                      </div>
                    </div>
                  ) : null}
                  <div className="table-list">
                    {selectedInventoryItems.map((item) => (
                      <div
                        key={item.id}
                        className="history-card table-row draggable-row"
                        draggable
                        onDragStart={() => setDraggedItemId(item.id)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => draggedItemId && void handleInventoryReorder(inventoryTab, draggedItemId, item.id)}
                      >
                        <div className="table-main">
                          <strong>{item.name}</strong>
                          <div className="muted">{inventoryRowSummary(item)}</div>
                        </div>
                        <div className="table-actions">
                          <button className="ghost-button" onClick={() => setDetailItem(item)} type="button">詳情</button>
                          {item.category === "manual" ? <button className="primary-button" onClick={() => void handleLearnManual(item.id)} type="button">學習</button> : null}
                          {item.category === "material" ? <button className="secondary-button" onClick={() => void handleListMarket(item)} type="button">上架</button> : null}
                        </div>
                      </div>
                    ))}
                    {selectedInventoryItems.length === 0 ? <div className="empty-card" style={{ padding: 14 }}>這個分類目前沒有物品</div> : null}
                  </div>
                </div>
              )}
            </section>
          ) : null}

          {activeNav === "forge" ? (
            <section className="section-stack">
              <div className="panel" style={{ padding: 16 }}>
                <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                  <label className="field">
                    <span>裝備類型</span>
                    <select value={forgeRecipeId} onChange={(event) => setForgeRecipeId(event.target.value)}>
                      {forgeOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>自訂名稱片段</span>
                    <input value={forgeCustomName} onChange={(event) => setForgeCustomName(event.target.value)} placeholder="例如 酷酷的熊" />
                  </label>
                </div>
              </div>

              <div className="history-list">
                <div className="banner" style={{ padding: 12 }}>
                  已投入 {forgeSelectedCount()} / {forgeMaterialLimit} 個材料
                </div>
                {inventoryGroups.material.map((item) => (
                  <div key={item.id} className="history-card" style={{ padding: 14, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div>
                      <strong>{item.name}</strong>
                      <div className="muted">現有 {item.quantity || 0}</div>
                    </div>
                    <label className="field" style={{ minWidth: 120 }}>
                      <span>投入數量</span>
                      <input
                        type="number"
                        min={0}
                        max={Math.min(item.quantity || 0, Math.max(0, forgeMaterialLimit - forgeSelectedCount(item.id)))}
                        step={1}
                        value={forgeMaterialAmounts[item.id] || ""}
                        onChange={(event) => updateForgeMaterialAmount(item, event.target.value)}
                        placeholder="0"
                      />
                    </label>
                  </div>
                ))}
                {inventoryGroups.material.length === 0 ? <div className="empty-card" style={{ padding: 14 }}>先去挖礦取得材料。</div> : null}
              </div>

              <button className="primary-button" onClick={() => void handleForge()} disabled={!isIdle(character)} type="button">開始鍛造</button>

              <div className="panel" style={{ padding: 16 }}>
                <div className="panel-heading">
                  <strong>特殊配方圖鑑</strong>
                  <span className="muted">材料種類與數量完全一致才會命中</span>
                </div>
                <div className="muted" style={{ marginTop: 6 }}>
                  命中配方會打造出固定的強力裝備（投入的其他材料組合則走一般品質鍛造）。
                </div>
                <div className="recipe-grid" style={{ marginTop: 12 }}>
                  {forgeRecipesList.map((recipe) => {
                    const ingredients = Object.entries(recipe.ingredients) as Array<[MaterialType, number]>;
                    const canAfford = ingredients.every(([type, qty]) =>
                      (inventoryGroups.material.find((item) => item.materialType === type)?.quantity || 0) >= (qty || 0)
                    );
                    return (
                      <div className={`recipe-card ${canAfford ? "is-ready" : ""}`} key={recipe.id}>
                        <div className="recipe-card-head">
                          <strong>{recipe.name}</strong>
                          <span className={`mini-pill ${canAfford ? "is-live" : ""}`}>{canAfford ? "材料齊全" : "材料不足"}</span>
                        </div>
                        <div className="tag-row" style={{ marginTop: 8 }}>
                          {ingredients.map(([type, qty]) => (
                            <span className="mini-pill" key={type}>{materialLabels[type] || type} x{qty}</span>
                          ))}
                        </div>
                        <div className="muted" style={{ marginTop: 8 }}>{recipe.effectSummary}</div>
                        {recipe.lore ? <div className="muted recipe-lore">{recipe.lore}</div> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : null}

          {activeNav === "achievements" ? (
            <section className="section-stack">
              <div className="panel" style={{ padding: 16 }}>
                <div className="panel-heading">
                  <strong>成就</strong>
                  <button className="ghost-button" onClick={() => void refreshAchievements()} type="button">刷新</button>
                </div>
                <div className="muted" style={{ marginTop: 8 }}>目前先建立成就頁與進度框架，具體內容之後可繼續擴充。</div>
              </div>
              <div className="history-list">
                {achievements.map((achievement) => (
                  <div key={achievement.id} className="history-card table-row">
                    <div className="table-main">
                      <strong>{achievement.title}</strong>
                      <div className="muted">{achievement.description}</div>
                      <div className="progress-bar" style={{ marginTop: 10 }}>
                        <div className="progress-fill" style={{ width: `${percent(achievement.progress, achievement.target)}%` }} />
                      </div>
                      <div className="muted" style={{ marginTop: 6 }}>
                        {achievement.progress} / {achievement.target} · {achievement.completed ? "已完成" : "進行中"}
                      </div>
                    </div>
                    <span className={`mini-pill ${achievement.completed ? "is-live" : ""}`}>{achievement.rewardSummary || "獎勵待定"}</span>
                  </div>
                ))}
                {achievements.length === 0 ? <div className="empty-card" style={{ padding: 14 }}>成就內容尚未建立。</div> : null}
              </div>
            </section>
          ) : null}

          {activeNav === "messages" ? (
            <section className="section-stack">
              <div className="auth-tabs">
                {([
                  ["announcements", "公告"],
                  ["notifications", "通知"],
                  ["battles", "戰報"]
                ] as Array<[MessageTab, string]>).map(([key, label]) => (
                  <button key={key} className={messageTab === key ? "is-active" : ""} onClick={() => setMessageTab(key)} type="button">
                    {label}
                  </button>
                ))}
              </div>

              {messageTab === "announcements" ? (
                <div className="history-list">
                  {announcements.map((announcement) => (
                    <div key={announcement.id} className="history-card" style={{ padding: 14 }}>
                      <strong>{announcement.title}</strong>
                      <div className="muted" style={{ marginTop: 6 }}>{announcement.body}</div>
                      <div className="muted" style={{ marginTop: 8 }}>{formatDate(announcement.createdAt)}</div>
                    </div>
                  ))}
                </div>
              ) : null}

              {messageTab === "notifications" ? (
                <div className="history-list">
                  {notifications.map((notice) => (
                    <div key={notice.id} className="history-card" style={{ padding: 14 }}>
                      <strong>{notice.title}</strong>
                      <div className="muted" style={{ marginTop: 6 }}>{notice.body}</div>
                      <div className="muted" style={{ marginTop: 8 }}>{formatDate(notice.createdAt)}</div>
                    </div>
                  ))}
                </div>
              ) : null}

              {messageTab === "battles" ? (
                <div className="history-list">
                  {battleHistory.map((battle) => (
                    <div key={battle.id} className="history-card table-row">
                      <div className="table-main">
                        <strong>{battle.bossName}</strong>
                        <div className="muted">{battleContextLabel(battle.battleContext, battle.battleKind)} · 結果 {battle.winner === "players" ? "勝利" : "失敗"} · 共 {battle.totalTicks} 回合</div>
                        <div className="muted">{formatDate(battle.createdAt)}</div>
                      </div>
                      <div className="table-actions">
                        <button className="ghost-button" onClick={() => setDetailBattleRecord(battle)} type="button">詳情</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {activeNav === "friends" ? (
            <section className="section-stack">
              <div className="panel" style={{ padding: 16 }}>
                <div className="form-grid" style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}>
                  <label className="field">
                    <span>角色名稱</span>
                    <input value={friendName} onChange={(event) => setFriendName(event.target.value)} placeholder="直接輸入角色名稱" />
                  </label>
                  <button className="primary-button" onClick={() => void handleAddFriend()} type="button">新增好友</button>
                </div>
              </div>
              <div className="member-grid">
                {friends.map((friend) => (
                  <div key={friend.userId} className="member-card" style={{ padding: 14 }}>
                    <strong>{friend.characterName}</strong>
                    <div className="muted">{friend.displayName}</div>
                    <div className="muted">{friend.online ? "在線" : "離線"}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

                    {activeNav === "shop" ? (
            <section className="section-stack">
              <div className="auth-tabs">
                {([
                  ["npc", "NPC 商店"],
                  ["market", "玩家市場"]
                ] as Array<[ShopTab, string]>).map(([key, label]) => (
                  <button key={key} className={shopTab === key ? "is-active" : ""} onClick={() => setShopTab(key)} type="button">
                    {label}
                  </button>
                ))}
              </div>

              <div className="panel" style={{ padding: 16 }}>
                <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                  <label className="field">
                    <span>分類</span>
                    <select value={shopCategoryFilter} onChange={(event) => setShopCategoryFilter(event.target.value as ShopCategoryFilter)}>
                      <option value="all">全部</option>
                      <option value="weapon">主武器</option>
                      <option value="offhand">副武器</option>
                      <option value="armor">防具</option>
                      <option value="material">材料</option>
                      <option value="other">其他</option>
                    </select>
                  </label>
                  {shopTab === "market" ? (
                    <label className="field">
                      <span>賣家名稱</span>
                      <input value={marketSellerFilter} onChange={(event) => setMarketSellerFilter(event.target.value)} placeholder="搜尋販賣者名稱" />
                    </label>
                  ) : null}
                </div>
              </div>

              {shopTab === "npc" ? (
                <div className="history-list">
                  {filteredShopItems.map((item) => (
                    <div key={item.id} className="history-card table-row">
                      <div className="table-main">
                        <strong>{item.name}</strong>
                        <div className="muted">{item.description}</div>
                        <div className="muted">{item.effectSummary} · 售價 {item.price}</div>
                      </div>
                      <div className="table-actions">
                        <button className="primary-button" onClick={() => void handlePurchase(item.id)} type="button">購買</button>
                      </div>
                    </div>
                  ))}
                  {filteredShopItems.length === 0 ? <div className="empty-card" style={{ padding: 14 }}>這個分類目前沒有商店物品</div> : null}
                </div>
              ) : null}

              {shopTab === "market" ? (
                <div className="history-list">
                  {visibleListings.map((listing) => (
                    <div key={listing.id} className="history-card table-row">
                      <div className="table-main">
                        <strong>{listing.item.name}</strong>
                        <div className="muted">賣家 {listing.sellerCharacterName}</div>
                        <div className="muted">數量 {listing.quantity} · 售價 {listing.price}</div>
                      </div>
                      <div className="table-actions">
                        <button className="ghost-button" onClick={() => setDetailItem(listing.item)} type="button">詳情</button>
                        {listing.sellerUserId === user.id ? (
                          <button className="ghost-button" onClick={() => void handleCancelListing(listing.id)} type="button">下架</button>
                        ) : (
                          <button className="primary-button" onClick={() => void handleBuyListing(listing)} type="button">購買</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {visibleListings.length === 0 ? <div className="empty-card" style={{ padding: 14 }}>目前沒有符合條件的玩家掛單</div> : null}
                </div>
              ) : null}
            </section>
          ) : null}

                    {activeNav === "admin" && user.role === "admin" ? (
            <section className="section-stack">
              <div className="panel" style={{ padding: 16 }}>
                <div className="auth-tabs">
                  {([
                    ["actions", "行動"],
                    ["battle", "戰鬥"],
                    ["items", "物品"],
                    ["system", "系統"],
                    ["factions", "陣營"]
                  ] as Array<[AdminTab, string]>).map(([key, label]) => (
                    <button key={key} className={adminTab === key ? "is-active" : ""} onClick={() => setAdminTab(key)} type="button">
                      {label}
                    </button>
                  ))}
                </div>
                <label className="field" style={{ marginTop: 14 }}>
                  <span>目標角色名稱</span>
                  <input value={adminTargetName} onChange={(event) => setAdminTargetName(event.target.value)} placeholder="輸入要操作的角色名稱" />
                </label>
              </div>

              {adminTab === "actions" ? (
                <div className="battle-actions">
                  <button className="primary-button" onClick={() => void handleAdminAction(() => adminCompleteQueue(token, { targetCharacterName: adminTargetName }), "已完成目標角色的隊列")} type="button">立即完成隊列</button>
                  <button className="secondary-button" onClick={() => void handleAdminAction(() => adminFillResources(token, { targetCharacterName: adminTargetName }), "已補滿 HP / MP / 精力")} type="button">補滿狀態</button>
                </div>
              ) : null}

              {adminTab === "battle" ? (
                <div className="panel" style={{ padding: 16 }}>
                  <div className="form-grid three-col">
                    <label className="field"><span>怪物名稱</span><input value={adminBattleName} onChange={(event) => setAdminBattleName(event.target.value)} /></label>
                    <label className="field"><span>HP</span><input type="number" min={1} max={numberLimits.monsterHp} step={1} value={adminBattleHp} onChange={(event) => setAdminBattleHp(clampedInputValue(event.target.value, 1, numberLimits.monsterHp))} /></label>
                    <label className="field"><span>攻擊</span><input type="number" min={1} max={numberLimits.monsterAttack} step={1} value={adminBattleAttack} onChange={(event) => setAdminBattleAttack(clampedInputValue(event.target.value, 1, numberLimits.monsterAttack))} /></label>
                  </div>
                  <button className="primary-button" style={{ marginTop: 12 }} onClick={() => void handleAdminAction(() => adminBattleTest(token, { targetCharacterName: adminTargetName, monsterName: adminBattleName, monsterHp: toClampedInt(adminBattleHp, 1, numberLimits.monsterHp, 1), monsterAttack: toClampedInt(adminBattleAttack, 1, numberLimits.monsterAttack, 1) }), "已啟動測試戰鬥")} type="button">啟動測試戰鬥</button>
                </div>
              ) : null}

              {adminTab === "items" ? (
                <div className="section-stack">
                  <div className="panel" style={{ padding: 16 }}>
                    <strong>發送既有物品</strong>
                    <div className="form-grid two-col" style={{ marginTop: 12 }}>
                      <label className="field"><span>鍛造配方</span><select value={adminRecipeId} onChange={(event) => setAdminRecipeId(event.target.value)}><option value="">不使用</option>{forgeOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
                      <label className="field"><span>商店物品</span><select value={adminShopItemId} onChange={(event) => setAdminShopItemId(event.target.value)}><option value="">不使用</option>{shopItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                    </div>
                    <button className="primary-button" style={{ marginTop: 12 }} onClick={() => void handleAdminAction(() => adminGrantItem(token, { targetCharacterName: adminTargetName, recipeId: adminRecipeId || undefined, shopItemId: adminShopItemId || undefined }), "已發送物品")} type="button">發送物品</button>
                  </div>

                  <div className="panel" style={{ padding: 16 }}>
                    <strong>自訂武器</strong>
                    <div className="form-grid three-col" style={{ marginTop: 12 }}>
                      <label className="field"><span>名稱</span><input value={adminCustomWeaponName} onChange={(event) => setAdminCustomWeaponName(event.target.value)} /></label>
                      <label className="field"><span>部位</span><select value={adminCustomWeaponSlot} onChange={(event) => setAdminCustomWeaponSlot(event.target.value as EquipmentSlotKey)}>{equipmentGroupOrder.map((slot) => <option key={slot} value={slot}>{slotLabel(slot)}</option>)}</select></label>
                      <label className="field"><span>耐久</span><input type="number" min={1} max={numberLimits.durability} step={1} value={adminCustomWeaponDurability} onChange={(event) => setAdminCustomWeaponDurability(clampedInputValue(event.target.value, 1, numberLimits.durability))} /></label>
                      <label className="field"><span>攻擊</span><input type="number" min={0} max={numberLimits.customStatBonus} step={1} value={adminCustomWeaponAttack} onChange={(event) => setAdminCustomWeaponAttack(clampedInputValue(event.target.value, 0, numberLimits.customStatBonus))} /></label>
                      <label className="field"><span>防禦</span><input type="number" min={0} max={numberLimits.customStatBonus} step={1} value={adminCustomWeaponDefense} onChange={(event) => setAdminCustomWeaponDefense(clampedInputValue(event.target.value, 0, numberLimits.customStatBonus))} /></label>
                      <label className="field"><span>運氣</span><input type="number" min={0} max={numberLimits.customStatBonus} step={1} value={adminCustomWeaponLuck} onChange={(event) => setAdminCustomWeaponLuck(clampedInputValue(event.target.value, 0, numberLimits.customStatBonus))} /></label>
                      <label className="field"><span>智慧</span><input type="number" min={0} max={numberLimits.customStatBonus} step={1} value={adminCustomWeaponIntelligence} onChange={(event) => setAdminCustomWeaponIntelligence(clampedInputValue(event.target.value, 0, numberLimits.customStatBonus))} /></label>
                      <label className="field"><span>韌性</span><input type="number" min={0} max={numberLimits.customStatBonus} step={1} value={adminCustomWeaponTenacity} onChange={(event) => setAdminCustomWeaponTenacity(clampedInputValue(event.target.value, 0, numberLimits.customStatBonus))} /></label>
                    </div>
                    <button className="primary-button" style={{ marginTop: 12 }} onClick={() => void handleAdminGrantCustomWeapon()} type="button">發送自訂武器</button>
                  </div>

                  <div className="panel" style={{ padding: 16 }}>
                    <strong>發送資源</strong>
                    <div className="form-grid three-col" style={{ marginTop: 12 }}>
                      <label className="field"><span>金幣</span><input type="number" min={0} max={numberLimits.grantGold} step={1} value={adminGrantGold} onChange={(event) => setAdminGrantGold(clampedInputValue(event.target.value, 0, numberLimits.grantGold))} /></label>
                      <label className="field"><span>資源種類</span><select value={adminResourceType} onChange={(event) => setAdminResourceType(event.target.value as MaterialType)}>{adminState?.resourceTypes.map((entry) => <option key={entry.type} value={entry.type}>{entry.name}</option>)}</select></label>
                      <label className="field"><span>數量</span><input type="number" min={0} max={numberLimits.resourceQuantity} step={1} value={adminResourceQuantity} onChange={(event) => setAdminResourceQuantity(clampedInputValue(event.target.value, 0, numberLimits.resourceQuantity))} /></label>
                    </div>
                    <button className="secondary-button" style={{ marginTop: 12 }} onClick={() => void handleAdminGrantResources()} type="button">發送資源</button>
                  </div>
                </div>
              ) : null}

              {adminTab === "system" ? (
                <div className="section-stack">
                  <div className="panel" style={{ padding: 16 }}>
                    <strong>公告管理</strong>
                    <div className="form-grid two-col" style={{ marginTop: 12 }}>
                      <label className="field"><span>公告標題</span><input value={adminAnnouncementTitle} onChange={(event) => setAdminAnnouncementTitle(event.target.value)} /></label>
                      <label className="field"><span>公告內容</span><input value={adminAnnouncementBody} onChange={(event) => setAdminAnnouncementBody(event.target.value)} /></label>
                    </div>
                    <button className="primary-button" style={{ marginTop: 12 }} onClick={() => void handleAdminAction(() => adminCreateAnnouncement(token, { title: adminAnnouncementTitle, body: adminAnnouncementBody }), "已發布公告")} type="button">發布公告</button>
                  </div>

                  {([
                    ["daily", dailyConfigForm, setDailyConfigForm, "立即觸發每日獎勵", () => void handleAdminAction(() => adminTriggerDaily(token, user.id), "已觸發每日獎勵")],
                    ["flash", flashConfigForm, setFlashConfigForm, "立即觸發突發活動", () => void handleAdminAction(() => adminTriggerFlashEvent(token, 20), "已觸發突發活動")]
                  ] as const).map(([kind, config, setConfig, quickLabel, quickAction]) =>
                    config ? (
                      <div key={kind} className="panel" style={{ padding: 16 }}>
                        <div className="panel-heading">
                          <strong>{kind === "daily" ? "每日獎勵設定" : "突發活動設定"}</strong>
                          <button className="secondary-button" onClick={quickAction} type="button">{quickLabel}</button>
                        </div>
                        <div className="form-grid three-col" style={{ marginTop: 12 }}>
                          <label className="field"><span>標題</span><input value={config.title} onChange={(event) => setConfig((current) => current ? { ...current, title: event.target.value } : current)} /></label>
                          <label className="field"><span>開始時間</span><input type="datetime-local" value={toDateTimeLocalValue(config.startAt)} onChange={(event) => setConfig((current) => current ? { ...current, startAt: event.target.value ? new Date(event.target.value).toISOString() : null } : current)} /></label>
                          <label className="field"><span>結束時間</span><input type="datetime-local" value={toDateTimeLocalValue(config.endAt)} onChange={(event) => setConfig((current) => current ? { ...current, endAt: event.target.value ? new Date(event.target.value).toISOString() : null } : current)} /></label>
                          <label className="field"><span>金幣</span><input type="number" min={0} max={numberLimits.grantGold} step={1} value={String(config.reward.gold || 0)} onChange={(event) => setConfig((current) => current ? { ...current, reward: { ...current.reward, gold: toClampedInt(event.target.value, 0, numberLimits.grantGold, 0) } } : current)} /></label>
                          <label className="field"><span>資源種類</span><select value={config.reward.materials?.[0]?.materialType || "iron_ore"} onChange={(event) => setConfig((current) => current ? { ...current, reward: { ...current.reward, materials: [{ materialType: event.target.value as MaterialType, quantity: current.reward.materials?.[0]?.quantity || 1 }] } } : current)}>{adminState?.resourceTypes.map((entry) => <option key={entry.type} value={entry.type}>{entry.name}</option>)}</select></label>
                          <label className="field"><span>資源數量</span><input type="number" min={0} max={numberLimits.resourceQuantity} step={1} value={String(config.reward.materials?.[0]?.quantity || 0)} onChange={(event) => setConfig((current) => current ? { ...current, reward: { ...current.reward, materials: [{ materialType: current.reward.materials?.[0]?.materialType || "iron_ore", quantity: toClampedInt(event.target.value, 0, numberLimits.resourceQuantity, 0) }] } } : current)} /></label>
                          <label className="field"><span>附贈物品</span><select value={config.reward.itemGrants?.[0]?.shopItemId || ""} onChange={(event) => setConfig((current) => current ? { ...current, reward: { ...current.reward, itemGrants: event.target.value ? [{ shopItemId: event.target.value }] : [] } } : current)}><option value="">不使用</option>{shopItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                          <label className="field"><span>啟用狀態</span><select value={config.active ? "on" : "off"} onChange={(event) => setConfig((current) => current ? { ...current, active: event.target.value === "on" } : current)}><option value="on">啟用</option><option value="off">停用</option></select></label>
                        </div>
                        <button className="primary-button" style={{ marginTop: 12 }} onClick={() => void handleSaveRewardConfig(kind as "daily" | "flash")} type="button">儲存設定</button>
                      </div>
                    ) : null
                  )}

                  <div className="history-list">
                    {adminAnnouncements.map((announcement) => (
                      <div key={announcement.id} className="history-card table-row">
                        <div className="table-main">
                          <strong>{announcement.title}</strong>
                          <div className="muted">{announcement.body}</div>
                        </div>
                        <div className="table-actions">
                          <button className="ghost-button" onClick={() => void handleAdminAction(() => adminToggleAnnouncement(token, { announcementId: announcement.id, active: !announcement.active }), "已更新公告狀態")} type="button">
                            {announcement.active ? "停用" : "啟用"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="battle-actions">
                    {adminState?.classes.map((entry) => (
                      <button key={entry.className} className="ghost-button" onClick={() => void handleAdminAction(() => adminToggleClass(token, { className: entry.className, active: !entry.active }), "已更新職業狀態") } type="button">
                        {entry.label} · {entry.active ? "啟用" : "停用"}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {adminTab === "factions" ? (
                <div className="panel" style={{ padding: 16 }}>
                  <div className="form-grid">
                    <label className="field"><span>陣營</span><select value={adminFactionId} onChange={(event) => setAdminFactionId(event.target.value)}><option value="">請先選擇</option>{adminState?.factions.map((faction) => <option key={faction.id} value={faction.id}>{faction.name}</option>)}</select></label>
                    <label className="field"><span>城池</span><select value={adminCastleId} onChange={(event) => setAdminCastleId(event.target.value)}><option value="">請先選擇</option>{adminState?.castles.map((castle) => <option key={castle.id} value={castle.id}>{castle.name}</option>)}</select></label>
                    <label className="field"><span>新擁有陣營</span><select value={adminOwnerFactionId} onChange={(event) => setAdminOwnerFactionId(event.target.value)}><option value="">請先選擇</option>{adminState?.factions.map((faction) => <option key={faction.id} value={faction.id}>{faction.name}</option>)}</select></label>
                  </div>
                  <div className="battle-actions" style={{ marginTop: 12 }}>
                    <button className="primary-button" onClick={() => void handleAdminAction(() => adminAssignLeader(token, { factionId: adminFactionId, targetCharacterName: adminTargetName }), "已指派新領袖") } type="button">指派領袖</button>
                    <button className="secondary-button" onClick={() => void handleAdminAction(() => adminAdjustTreasury(token, { factionId: adminFactionId, gold: 9999 }), "已補充公庫") } type="button">補充公庫</button>
                    <button className="ghost-button" onClick={() => void handleAdminAction(() => adminSetCastleOwner(token, { castleId: adminCastleId, ownerFactionId: adminOwnerFactionId }), "已調整城池擁有權") } type="button">變更城池</button>
                    <button className="ghost-button" onClick={() => void handleAdminAction(() => adminResetDiplomacy(token), "已重設外交") } type="button">重設外交</button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {detailItem && detailModalRoot ? createPortal(
            <div className="modal-overlay" onClick={() => setDetailItem(null)}>
              <div className="detail-modal" onClick={(event) => event.stopPropagation()}>
                <div className="panel-heading">
                  <div>
                    <strong>{detailItem.name}</strong>
                    <div className="muted" style={{ marginTop: 6 }}>{inventoryRowSummary(detailItem)}</div>
                  </div>
                  <button className="ghost-button" onClick={() => setDetailItem(null)} type="button">關閉</button>
                </div>
                <div className="detail-list">
                  <div><strong>基本類型</strong><div className="muted">{detailItem.category === "equipment" ? "裝備" : detailItem.category === "material" ? "材料" : detailItem.category === "manual" ? "秘笈" : "其他"}</div></div>
                  <div><strong>屬性</strong><div className="muted">攻擊 {detailItem.attackBonus || 0} · 防禦 {detailItem.defenseBonus || 0} · 運氣 {detailItem.luckBonus || 0} · 耐久 {detailItem.maxDurability != null ? `${detailItem.durability ?? 0}/${detailItem.maxDurability}` : "-" } · 智慧 {itemIntelligence(detailItem)}</div></div>
                  <div><strong>等級</strong><div className="muted">{detailItem.itemLevel ?? 1}</div></div>
                  {detailItem.category !== "material" ? <div><strong>預設賣價</strong><div className="muted">{detailItem.sellPrice ?? 0}</div></div> : null}
                  {detailItem.category !== "material" ? <div><strong>分解價錢</strong><div className="muted">{detailItem.salvagePrice ?? 0}</div></div> : null}
                  <div><strong>製作方式與材料</strong><div className="muted">{craftSourceLabel(detailItem)}</div></div>
                  {detailItem.category !== "material" ? (
                    <div>
                      <strong>製作人與製作時間</strong>
                      <div className="muted">{detailItem.craftedBy || "未記錄"}{detailItem.craftedAt ? ` · ${formatDate(detailItem.craftedAt)}` : ""}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>,
            detailModalRoot
          ) : null}

          {detailBattleRecord && detailModalRoot ? createPortal(
            <div className="modal-overlay" onClick={() => setDetailBattleRecord(null)}>
              <div className="detail-modal detail-modal-wide" onClick={(event) => event.stopPropagation()}>
                <div className="panel-heading">
                  <div>
                    <strong>{detailBattleRecord.bossName}</strong>
                    <div className="muted" style={{ marginTop: 6 }}>結果 {detailBattleRecord.winner === "players" ? "勝利" : "失敗"} · {formatDate(detailBattleRecord.createdAt)}</div>
                  </div>
                  <button className="ghost-button" onClick={() => setDetailBattleRecord(null)} type="button">關閉</button>
                </div>
                <div className="detail-list">
                  <div><strong>戰鬥摘要</strong><div className="muted">總回合 {detailBattleRecord.totalTicks} · 戰鬥時長 {Math.round(detailBattleRecord.durationMs / 1000)} 秒 · 類型 {battleContextLabel(detailBattleRecord.battleContext, detailBattleRecord.battleKind)}</div></div>
                  <div>
                    <strong>參戰者</strong>
                    <div className="history-list" style={{ marginTop: 10 }}>
                      {detailBattleRecord.participants.map((participant) => (
                        <div key={participant.userId} className="history-card" style={{ padding: 12 }}>
                          <strong>{participant.displayName}</strong>
                          <div className="muted">傷害 {participant.damageDealt} · 承傷 {participant.damageTaken} · 治療 {participant.healingDone}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <strong>完整戰鬥紀錄</strong>
                    <div className="history-list" style={{ marginTop: 10 }}>
                      {visibleBattleLogs(detailBattleRecord.logs).map((log, index) => {
                        const cleanLog = cleanBattleLog(log);
                        return (
                          <div key={`${detailBattleRecord.id}-${index}`} className={`history-card battle-log-card is-${battleLogTone(cleanLog)}`} style={{ padding: 10 }}>{cleanLog}</div>
                        );
                      })}
                      {detailBattleRecord.logs.length === 0 ? <div className="empty-card" style={{ padding: 14 }}>目前沒有保存戰鬥紀錄。</div> : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            detailModalRoot
          ) : null}
        </main>
      </div>
    </div>
  );
}

export default App;
