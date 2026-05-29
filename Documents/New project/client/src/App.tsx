import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Backpack,
  BatteryCharging,
  Castle,
  Coins,
  Dumbbell,
  Hammer,
  HeartPulse,
  LogOut,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Store,
  Swords,
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
  BattleRecordSummary,
  BattleSummary,
  BattleTickEvent,
  CharacterClass,
  CharacterProfile,
  EquipmentSlotKey,
  FactionState,
  ForgeOption,
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
  SignInStatus
} from "../../shared/events";
import {
  addFriend,
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
  attackCastle,
  buyMarketItem,
  cancelMarketItem,
  cancelQueueAction,
  cancelQueuedActions,
  changeClass,
  claimDailySignIn,
  claimFlashSignIn,
  craftItem,
  declareWar,
  equipItem,
  enqueueAction,
  getAdminAnnouncements,
  getAdminState,
  getAnnouncements,
  getBattles,
  getFactions,
  getForgeOptions,
  getFriends,
  getMe,
  getNotifications,
  getShop,
  getSignInStatus,
  grantTreasury,
  listMarketItem,
  login,
  purchaseItem,
  register,
  repairItem,
  requestCooperation,
  respondCooperation,
  selectFaction,
  unequipItem,
  updateInventorySort
} from "./lib/api";
import { getSocket } from "./lib/socket";
import { getStoredToken, setStoredToken } from "./lib/storage";

type NavKey = "character" | "actions" | "battle" | "faction" | "inventory" | "forge" | "messages" | "friends" | "shop" | "admin";
type InventoryTab = "equipment" | "material" | "manual" | "other";
type ShopTab = "npc" | "market";
type ShopCategoryFilter = "all" | "weapon" | "offhand" | "armor" | "material" | "other";
type MessageTab = "announcements" | "notifications" | "battles";
type FactionTab = "map" | "diplomacy" | "treasury" | "members";
type AdminTab = "actions" | "battle" | "items" | "system" | "factions";

const classOptions: Array<{ value: CharacterClass; label: string }> = [
  { value: "warrior", label: "戰士" },
  { value: "mage", label: "法師" },
  { value: "priest", label: "祭司" }
];

const navItems: Array<{ key: NavKey; label: string; icon: LucideIcon; hint: string }> = [
  { key: "character", label: "角色", icon: UserRound, hint: "狀態與裝備" },
  { key: "actions", label: "行動", icon: Dumbbell, hint: "訓練與隊列" },
  { key: "battle", label: "戰鬥", icon: Swords, hint: "房間與討伐" },
  { key: "faction", label: "陣營", icon: Castle, hint: "城池與外交" },
  { key: "inventory", label: "揹包", icon: Backpack, hint: "物品與穿戴" },
  { key: "forge", label: "鍛造", icon: Hammer, hint: "製作與修復" },
  { key: "messages", label: "消息", icon: MessageSquareText, hint: "公告與戰報" },
  { key: "friends", label: "好友", icon: UsersRound, hint: "社交與在線" },
  { key: "shop", label: "商店", icon: Store, hint: "NPC 與市場" },
  { key: "admin", label: "Admin", icon: ShieldCheck, hint: "管理工具" }
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
  return character.actionQueue.items.length === 0;
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

function itemIntelligence(item: InventoryItem) {
  return item.statBonus?.intelligence ?? 0;
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

function App() {
  const socket = useMemo(() => getSocket(), []);
  const [connected, setConnected] = useState(socket.connected);
  const [token, setToken] = useState(getStoredToken());
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [activeNav, setActiveNav] = useState<NavKey>("character");
  const [inventoryTab, setInventoryTab] = useState<InventoryTab>("equipment");
  const [shopTab, setShopTab] = useState<ShopTab>("npc");
  const [messageTab, setMessageTab] = useState<MessageTab>("announcements");
  const [factionTab, setFactionTab] = useState<FactionTab>("map");
  const [adminTab, setAdminTab] = useState<AdminTab>("actions");
  const [selectedCastleFactionId, setSelectedCastleFactionId] = useState("");
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);
  const [detailBattleRecord, setDetailBattleRecord] = useState<BattleRecordSummary | null>(null);
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
  const [battleHistory, setBattleHistory] = useState<BattleRecordSummary[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [forgeOptions, setForgeOptions] = useState<ForgeOption[]>([]);
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [signInStatus, setSignInStatus] = useState<SignInStatus | null>(null);
  const [factionState, setFactionState] = useState<FactionState | null>(null);
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
  const [treasuryTargetName, setTreasuryTargetName] = useState("");
  const [treasuryGold, setTreasuryGold] = useState("0");
  const [treasuryMaterials, setTreasuryMaterials] = useState("0");
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
  const visibleNav = navItems.filter((entry) => entry.key !== "admin" || user?.role === "admin");
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
    const items = character?.inventory || [];
    return {
      equipment: items.filter((item) => item.category === "equipment"),
      material: items.filter((item) => item.category === "material"),
      manual: items.filter((item) => item.category === "manual"),
      other: items.filter((item) => !["equipment", "material", "manual"].includes(item.category))
    };
  }, [character?.inventory]);
  const selectedInventoryItems = inventoryGroups[inventoryTab];
  const selectedInventoryItem = selectedInventoryItems.find((item) => item.id === selectedInventoryItemId) || null;
  const selectedCastleFaction = factionState?.factions.find((faction) => faction.id === selectedCastleFactionId) || null;
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
    return selectedCastleFactionId ? factionState.castles.filter((castle) => castle.ownerFactionId === selectedCastleFactionId) : factionState.castles;
  }, [factionState?.castles, selectedCastleFactionId]);

  const battleOverlayVisible = roomState?.phase === "battle" || roomState?.phase === "ended";
  const detailModalRoot = typeof document !== "undefined" ? document.body : null;
  const myActivityStatus = character ? activityStatusFor(character, roomState, user?.id) : { label: "閒暇中", tone: "idle" as ActivityStatusTone };
  const partyBlocker = roomState?.members.find((member) => !isIdle(member.character)) || null;
  const canLeadPartyAction = Boolean(roomState && user && roomState.hostId === user.id && roomState.phase === "lobby" && !partyBlocker);
  const canAttackCastle = character ? (!roomState ? isIdle(character) : canLeadPartyAction) : false;

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!factionState) return;
    if (!selectedCastleFactionId) {
      setSelectedCastleFactionId(factionState.myFactionId || factionState.factions[0]?.id || "");
    }
  }, [factionState, selectedCastleFactionId]);

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
      }
      if (state?.phase === "battle" || state?.phase === "ended") {
        setActiveNav("battle");
      }
    };
    const onBattleTick = (event: BattleTickEvent) => {
      setLastBattleTick(event);
      setBattleSummary(null);
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
      setAdminTargetName((current) => current || me.character.name);
      socket.emit("auth:ready", nextToken);
      await Promise.all([
        refreshBattles(nextToken),
        refreshShop(nextToken),
        refreshNotifications(nextToken),
        refreshAnnouncements(nextToken),
        refreshFriends(nextToken),
        refreshSignIn(nextToken),
        refreshFaction(nextToken),
        refreshForge(nextToken),
        me.user.role === "admin" ? refreshAdmin(nextToken) : Promise.resolve()
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

  async function refreshForge(nextToken = token) {
    if (!nextToken) return;
    const result = await getForgeOptions(nextToken);
    setForgeOptions(result.options);
    setForgeRecipeId((current) => current || result.options[0]?.id || "");
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
    if (!token) return;
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

  async function handleGrantTreasury() {
    if (!token || !treasuryTargetName.trim()) return;
    const treasury = factionState?.selectedFaction?.treasury;
    try {
      setFactionState(
        await grantTreasury(token, {
          targetCharacterName: treasuryTargetName.trim(),
          gold: toClampedInt(treasuryGold, 0, treasury?.gold || 0, 0),
          materials: toClampedInt(treasuryMaterials, 0, treasury?.materials || 0, 0)
        })
      );
      setFeedback("公庫已發放");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "公庫發放失敗");
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
      const result = await attackCastle(token, castleId);
      setFactionState(result.factionState);
      await refreshBattles();
      await refreshMe();
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "攻城失敗");
    }
  }

  async function handleClaimDaily() {
    if (!token) return;
    try {
      const result = await claimDailySignIn(token);
      setCharacter(result.character);
      await refreshSignIn();
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

  function renderAuth() {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-hero">
            <div>
              <p className="eyebrow">七屬性 / 陣營改版</p>
              <h1>先登入或建立角色</h1>
              <p className="muted">
                系統會自動把舊角色升級成七屬性，並接上新的揹包、鍛造、陣營與 Admin 流程。
              </p>
            </div>
            <div className="info-card" style={{ padding: 18 }}>
              <h3>這一輪已整合</h3>
              <div className="tag-row">
                <span className="tag">揹包裝備分離</span>
                <span className="tag">七基底屬性</span>
                <span className="tag">多礦石鍛造</span>
                <span className="tag">5 陣營 / 25 城</span>
                <span className="tag">商店玩家市場</span>
              </div>
            </div>
          </div>

          <div className="auth-tabs">
            <button className={authMode === "login" ? "is-active" : ""} onClick={() => setAuthMode("login")} type="button">
              登入
            </button>
            <button className={authMode === "register" ? "is-active" : ""} onClick={() => setAuthMode("register")} type="button">
              建立角色
            </button>
          </div>

          {authMode === "login" ? (
            <div className="form-grid">
              <label className="field">
                <span>Email</span>
                <input value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} />
              </label>
              <label className="field">
                <span>密碼</span>
                <input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} />
              </label>
            </div>
          ) : (
            <div className="form-grid">
              <label className="field">
                <span>Email</span>
                <input value={registerForm.email} onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))} />
              </label>
              <label className="field">
                <span>密碼</span>
                <input type="password" value={registerForm.password} onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))} />
              </label>
              <label className="field">
                <span>顯示名稱</span>
                <input value={registerForm.displayName} onChange={(event) => setRegisterForm((current) => ({ ...current, displayName: event.target.value }))} />
              </label>
              <label className="field">
                <span>角色名稱</span>
                <input value={registerForm.characterName} onChange={(event) => setRegisterForm((current) => ({ ...current, characterName: event.target.value }))} />
              </label>
              <label className="field">
                <span>初始職業</span>
                <select value={registerForm.className} onChange={(event) => setRegisterForm((current) => ({ ...current, className: event.target.value as CharacterClass }))}>
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
            <button className="primary-button" onClick={() => void handleAuthSubmit()} type="button">
              {authMode === "login" ? "登入" : "建立角色"}
            </button>
            <span className="muted">狀態：{feedback}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!token || !user || !character) {
    return renderAuth();
  }

  return (
    <div className="app-shell">
      <div className="app-layout">
        <aside className="sidebar" style={{ padding: 16 }}>
          <div className="section-stack">
            <div>
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
              {visibleNav.map((item) => {
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
            <button className="ghost-button" onClick={logout} type="button">
              <LogOut size={16} />
              登出
            </button>
          </div>
        </aside>

        <main className="content-panel">
          <div className="top-banner" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <strong>{feedback}</strong>
                <div className="muted" style={{ marginTop: 4 }}>
                  今日隊列 {character.actionQueue.items.length} 項
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
                  <strong>七屬性 + 韌性</strong>
                  <div className="muted" style={{ marginTop: 10 }}>
                    攻 {character.stats.attack} · 防 {character.stats.defense} · 運 {character.stats.luck}
                  </div>
                  <div className="muted">智 {character.stats.intelligence} · 體 {character.stats.vitality} · 精 {character.stats.spirit}</div>
                  <div className="muted">技 {character.stats.technique} · 韌 {character.stats.tenacity}</div>
                </div>
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
              <div className="shop-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                {trainingActions.map((entry) => (
                  <div className="action-card" key={entry.type} style={{ padding: 16 }}>
                    <strong>{entry.title}</strong>
                    <div className="muted" style={{ marginTop: 6 }}>{entry.detail}</div>
                    <button className="primary-button" style={{ marginTop: 14 }} onClick={() => void handleQueue(entry.type)} type="button">
                      加入隊列
                    </button>
                  </div>
                ))}
                <div className="action-card" style={{ padding: 16 }}>
                  <strong>恢復</strong>
                  <div className="muted" style={{ marginTop: 6 }}>安排一段休息時間，專心回復狀態。</div>
                  <button className="primary-button" style={{ marginTop: 14 }} onClick={() => void handleQueue("rest")} type="button">
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
                  <button className="primary-button" onClick={() => void handleQueue("mine_shallow", miningHours.mine_shallow)} type="button">淺層挖礦</button>
                  <button className="secondary-button" onClick={() => void handleQueue("mine_deep", miningHours.mine_deep)} type="button">深層挖礦</button>
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
                  ) : (
                    <div className="empty-card" style={{ padding: 14 }}>目前沒有隊列。</div>
                  )}
                </div>
              </div>
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

              {battleOverlayVisible ? (
                <div style={{ position: "fixed", inset: 20, background: "rgba(9, 12, 20, 0.82)", zIndex: 30, display: "grid", placeItems: "center" }}>
                  <div className="battle-stage" style={{ width: "min(980px, 100%)", maxHeight: "90vh", overflow: "auto", padding: 22 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
                      <div>
                        <div className="eyebrow">同頁戰鬥</div>
                        <h2 style={{ marginBottom: 4 }}>{roomState?.boss?.name || "戰鬥中"}</h2>
                        <div className="muted">隊伍代碼 {roomState?.roomId}</div>
                      </div>
                      <button className="ghost-button" onClick={() => setActiveNav("battle")} type="button">收起回到頁面</button>
                    </div>
                    {roomState?.boss ? (
                      <div className="boss-stage-card" style={{ padding: 16, marginBottom: 14 }}>
                        <strong>Boss HP {roomState.boss.hp} / {roomState.boss.maxHp}</strong>
                        <div className="progress-bar" style={{ marginTop: 10 }}>
                          <div className="progress-fill is-danger" style={{ width: `${percent(roomState.boss.hp, roomState.boss.maxHp)}%` }} />
                        </div>
                      </div>
                    ) : null}
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
                      {(lastBattleTick?.recentLogs || roomState?.logs || []).slice(-8).map((log, index) => (
                        <div className="history-card" key={`${log}-${index}`} style={{ padding: 10 }}>{log}</div>
                      ))}
                    </div>
                    {battleSummary ? (
                      <div className="banner" style={{ padding: 14, marginTop: 14 }}>
                        <strong>{battleSummary.winner === "players" ? "玩家勝利" : "Boss 獲勝"}</strong>
                        <div className="muted">結束時間 {formatDate(battleSummary.endedAt)}</div>
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
                      ["map", "地圖 / 城池"],
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
                      <div className="selector-grid">
                        {factionState?.factions.map((faction) => (
                          <button
                            key={faction.id}
                            className={`selector-card ${selectedCastleFactionId === faction.id ? "is-active" : ""}`}
                            onClick={() => setSelectedCastleFactionId(faction.id)}
                            type="button"
                          >
                            <strong>{faction.name}</strong>
                            <div className="muted" style={{ marginTop: 6 }}>{faction.memberCount} 名成員</div>
                            <div className="muted">{faction.leaderDisplayName ? `領袖 ${faction.leaderDisplayName}` : "尚未指派領袖"}</div>
                          </button>
                        ))}
                      </div>

                      <div className="panel" style={{ padding: 16 }}>
                        <div className="panel-heading">
                          <strong>{selectedCastleFaction?.name || "城池分類"}</strong>
                          <span className="muted">{visibleCastles.length} 座城池</span>
                        </div>
                        <div className="castle-grid" style={{ marginTop: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                          {visibleCastles.map((castle) => {
                            const isMine = castle.ownerFactionId === character.factionId;
                            return (
                              <div key={castle.id} className="history-card" style={{ padding: 14 }}>
                                <strong>{castle.name}</strong>
                                <div className="muted" style={{ marginTop: 6 }}>城防 {castle.fortification} / {castle.maxFortification}</div>
                                <div className="muted">Boss {castle.bossName}</div>
                                {!isMine ? (
                                  <button className="primary-button" style={{ marginTop: 12 }} onClick={() => void handleAttackCastle(castle.id)} disabled={!canAttackCastle} type="button">
                                    攻打城堡
                                  </button>
                                ) : (
                                  <span className="mini-pill" style={{ marginTop: 12 }}>我方領地</span>
                                )}
                              </div>
                            );
                          })}
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
                      <div className="muted">公庫金幣 {factionState?.selectedFaction?.treasury.gold ?? 0} · 公庫素材 {factionState?.selectedFaction?.treasury.materials ?? 0}</div>
                      <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 12 }}>
                        <label className="field">
                          <span>目標角色名稱</span>
                          <input value={treasuryTargetName} onChange={(event) => setTreasuryTargetName(event.target.value)} />
                        </label>
                        <label className="field">
                          <span>金幣</span>
                          <input
                            type="number"
                            min={0}
                            max={factionState?.selectedFaction?.treasury.gold || 0}
                            step={1}
                            value={treasuryGold}
                            onChange={(event) => setTreasuryGold(clampedInputValue(event.target.value, 0, factionState?.selectedFaction?.treasury.gold || 0))}
                          />
                        </label>
                        <label className="field">
                          <span>素材</span>
                          <input
                            type="number"
                            min={0}
                            max={factionState?.selectedFaction?.treasury.materials || 0}
                            step={1}
                            value={treasuryMaterials}
                            onChange={(event) => setTreasuryMaterials(clampedInputValue(event.target.value, 0, factionState?.selectedFaction?.treasury.materials || 0))}
                          />
                        </label>
                      </div>
                      <button className="primary-button" style={{ marginTop: 12 }} onClick={() => void handleGrantTreasury()} type="button">發放公庫</button>
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

              <button className="primary-button" onClick={() => void handleForge()} type="button">開始鍛造</button>
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
                        <div className="muted">結果 {battle.winner === "players" ? "勝利" : "失敗"} · 共 {battle.totalTicks} 回合</div>
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
                    <button className="secondary-button" onClick={() => void handleAdminAction(() => adminAdjustTreasury(token, { factionId: adminFactionId, gold: 9999, materials: 9999 }), "已補充公庫") } type="button">補充公庫</button>
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
                  <div><strong>戰鬥摘要</strong><div className="muted">總回合 {detailBattleRecord.totalTicks} · 戰鬥時長 {Math.round(detailBattleRecord.durationMs / 1000)} 秒 · 類型 {detailBattleRecord.battleContext}</div></div>
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
                      {detailBattleRecord.logs.map((log, index) => (
                        <div key={`${detailBattleRecord.id}-${index}`} className="history-card" style={{ padding: 10 }}>{log}</div>
                      ))}
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
