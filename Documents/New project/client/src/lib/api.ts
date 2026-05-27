import type {
  AdminAdjustResourcesPayload,
  AdminGrantResourcesPayload,
  AdminRewardConfigPayload,
  AdminAdjustTreasuryPayload,
  AdminAnnouncementPayload,
  AdminAnnouncementTogglePayload,
  AdminAssignLeaderPayload,
  AdminBattleTestPayload,
  AdminClassTogglePayload,
  AdminCompleteQueuePayload,
  AdminFillResourcesPayload,
  AdminGrantItemPayload,
  AdminState,
  AttackCastleResult,
  AuthPayload,
  BattleRecordSummary,
  CharacterClass,
  CharacterProfile,
  CraftPayload,
  EquipItemPayload,
  FactionState,
  ForgeOption,
  FriendAddPayload,
  FriendSummary,
  InventoryResult,
  InventorySortPayload,
  LoginPayload,
  MarketBuyPayload,
  MarketListPayload,
  NotificationEntry,
  Announcement,
  PurchasePayload,
  PurchaseResult,
  QueueActionPayload,
  QueueMutationResult,
  RegisterPayload,
  RepairPayload,
  ShopItem,
  SignInStatus,
  TreasuryGrantPayload,
  UnequipItemPayload
} from "../../../shared/events";

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${apiBase}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ error: "請求失敗。" }))) as { error?: string };
    throw new Error(payload.error || "請求失敗。");
  }

  return response.json() as Promise<T>;
}

export function register(payload: RegisterPayload) {
  return request<AuthPayload>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function login(payload: LoginPayload) {
  return request<AuthPayload>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getMe(token: string) {
  return request<{ user: AuthPayload["user"]; character: CharacterProfile; token: string; completedActivities?: Array<{ message: string }> }>("/me", {}, token);
}

export function getBattles(token: string) {
  return request<BattleRecordSummary[]>("/battles", {}, token);
}

export function changeClass(token: string, className: CharacterClass) {
  return request<CharacterProfile>(
    "/character/class",
    {
      method: "POST",
      body: JSON.stringify({ className })
    },
    token
  );
}

export function getQueue(token: string) {
  return request<{
    queue: CharacterProfile["actionQueue"];
    character: CharacterProfile;
    completedActivities: Array<{ message: string }>;
  }>("/queue", {}, token);
}

export function enqueueAction(token: string, payload: QueueActionPayload) {
  return request<QueueMutationResult>(
    "/queue/actions",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function cancelQueueAction(token: string, actionId: string) {
  return request<QueueMutationResult>(
    `/queue/actions/${actionId}`,
    {
      method: "DELETE"
    },
    token
  );
}

export function cancelQueuedActions(token: string) {
  return request<QueueMutationResult>(
    "/queue/actions",
    {
      method: "DELETE"
    },
    token
  );
}

export function getShop(token: string) {
  return request<{ items: ShopItem[] }>("/shop", {}, token);
}

export function purchaseItem(token: string, payload: PurchasePayload) {
  return request<PurchaseResult>(
    "/shop/purchase",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function getInventory(token: string) {
  return request<InventoryResult>("/inventory", {}, token);
}

export function equipItem(token: string, payload: EquipItemPayload) {
  return request<InventoryResult>(
    "/inventory/equip",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function unequipItem(token: string, payload: UnequipItemPayload) {
  return request<InventoryResult>(
    "/inventory/unequip",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function updateInventorySort(token: string, payload: InventorySortPayload) {
  return request<InventoryResult>(
    "/inventory/sort",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function getForgeOptions(token: string) {
  return request<{ options: ForgeOption[] }>("/forge/options", {}, token);
}

export function craftItem(token: string, payload: CraftPayload) {
  return request<{ message: string; character: CharacterProfile }>(
    "/forge/craft",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function repairItem(token: string, payload: RepairPayload) {
  return request<{ message: string; character: CharacterProfile }>(
    "/forge/repair",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function getNotifications(token: string) {
  return request<{ notifications: NotificationEntry[] }>("/notifications", {}, token);
}

export function getAnnouncements(token: string) {
  return request<{ announcements: Announcement[] }>("/announcements", {}, token);
}

export function getFriends(token: string) {
  return request<{ friends: FriendSummary[] }>("/friends", {}, token);
}

export function addFriend(token: string, payload: FriendAddPayload) {
  return request<{ message: string; friends: FriendSummary[] }>(
    "/friends",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function getSignInStatus(token: string) {
  return request<SignInStatus>("/sign-in/status", {}, token);
}

export function claimDailySignIn(token: string) {
  return request<{ message: string; character: CharacterProfile }>(
    "/sign-in/daily",
    {
      method: "POST"
    },
    token
  );
}

export function claimFlashSignIn(token: string) {
  return request<{ message: string; character: CharacterProfile }>(
    "/sign-in/flash",
    {
      method: "POST"
    },
    token
  );
}

export function getFactions(token: string) {
  return request<FactionState>("/factions/me", {}, token);
}

export function getFactionList(token: string) {
  return request<{ factions: FactionState["factions"] }>("/factions", {}, token);
}

export function selectFaction(token: string, factionId: string) {
  return request<FactionState>(
    "/factions/select",
    {
      method: "POST",
      body: JSON.stringify({ factionId })
    },
    token
  );
}

export function requestCooperation(token: string, targetFactionId: string) {
  return request<FactionState>(
    "/factions/diplomacy/cooperate",
    {
      method: "POST",
      body: JSON.stringify({ targetFactionId })
    },
    token
  );
}

export function respondCooperation(token: string, requestId: string, accept: boolean) {
  return request<FactionState>(
    "/factions/diplomacy/cooperate/respond",
    {
      method: "POST",
      body: JSON.stringify({ requestId, accept })
    },
    token
  );
}

export function declareWar(token: string, targetFactionId: string) {
  return request<FactionState>(
    "/factions/diplomacy/declare-war",
    {
      method: "POST",
      body: JSON.stringify({ targetFactionId })
    },
    token
  );
}

export function grantTreasury(token: string, payload: TreasuryGrantPayload) {
  return request<FactionState>(
    "/factions/treasury/grant",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function getFactionMarket(token: string) {
  return request<{ listings: FactionState["marketListings"] }>("/shop/market", {}, token);
}

export function listMarketItem(token: string, payload: MarketListPayload) {
  return request<FactionState>(
    "/shop/market/list",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function buyMarketItem(token: string, payload: MarketBuyPayload) {
  return request<FactionState>(
    "/shop/market/buy",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function cancelMarketItem(token: string, listingId: string) {
  return request<FactionState>(
    "/shop/market/cancel",
    {
      method: "POST",
      body: JSON.stringify({ listingId })
    },
    token
  );
}

export function attackCastle(token: string, castleId: string) {
  return request<AttackCastleResult>(
    `/factions/castles/${castleId}/attack`,
    {
      method: "POST"
    },
    token
  );
}

export function getAdminState(token: string) {
  return request<AdminState>("/admin/state", {}, token);
}

export function getAdminAnnouncements(token: string) {
  return request<{ announcements: Announcement[] }>("/admin/announcements", {}, token);
}

export function adminCompleteQueue(token: string, payload: AdminCompleteQueuePayload) {
  return request<{ character: CharacterProfile }>(
    "/admin/actions/complete-queue",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function adminFillResources(token: string, payload: AdminFillResourcesPayload) {
  return request<CharacterProfile>(
    "/admin/actions/fill-resources",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function adminGrantItem(token: string, payload: AdminGrantItemPayload) {
  return request<{ character: CharacterProfile }>(
    "/admin/items/grant",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function adminAdjustResources(token: string, payload: AdminAdjustResourcesPayload) {
  return request<CharacterProfile>(
    "/admin/resources/adjust",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function adminGrantResources(token: string, payload: AdminGrantResourcesPayload) {
  return request<CharacterProfile>(
    "/admin/resources/grant",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function adminBattleTest(token: string, payload: AdminBattleTestPayload) {
  return request<{ character: CharacterProfile }>(
    "/admin/battle/test",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function adminTriggerDaily(token: string, targetUserId: string) {
  return request<{ message: string; character: CharacterProfile }>(
    "/admin/system/daily",
    {
      method: "POST",
      body: JSON.stringify({ targetUserId })
    },
    token
  );
}

export function adminTriggerFlashEvent(token: string, minutes = 15) {
  return request<{ endsAt: string }>("/admin/system/flash-event", {
    method: "POST",
    body: JSON.stringify({ minutes })
  }, token);
}

export function adminUpdateRewardConfig(token: string, payload: AdminRewardConfigPayload) {
  return request<{
    dailyRewardConfig: AdminState["dailyRewardConfig"];
    flashEventConfig: AdminState["flashEventConfig"];
  }>(
    "/admin/system/reward-config",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function adminToggleClass(token: string, payload: AdminClassTogglePayload) {
  return request<AdminState["classes"]>(
    "/admin/system/class-toggle",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function adminCreateAnnouncement(token: string, payload: AdminAnnouncementPayload) {
  return request<{ announcements: Announcement[] }>(
    "/admin/system/announcements",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function adminToggleAnnouncement(token: string, payload: AdminAnnouncementTogglePayload) {
  return request<{ announcements: Announcement[] }>(
    "/admin/system/announcements/toggle",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function adminAssignLeader(token: string, payload: AdminAssignLeaderPayload) {
  return request<FactionState>(
    "/admin/factions/assign-leader",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function adminSetCastleOwner(token: string, payload: { castleId: string; ownerFactionId: string }) {
  return request(
    "/admin/factions/set-castle-owner",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function adminAdjustTreasury(token: string, payload: AdminAdjustTreasuryPayload) {
  return request(
    "/admin/factions/adjust-treasury",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function adminResetDiplomacy(token: string) {
  return request("/admin/factions/reset-diplomacy", { method: "POST" }, token);
}
