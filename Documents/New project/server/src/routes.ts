import { Router } from "express";
import type {
  ActionType,
  AdminAnnouncementPayload,
  AdminAnnouncementTogglePayload,
  AdminAdjustCharacterPayload,
  AdminAdjustResourcesPayload,
  AdminGrantResourcesPayload,
  AdminRewardConfigPayload,
  AdminAdjustTreasuryPayload,
  AdminAssignLeaderPayload,
  AdminBattleTestPayload,
  AdminClassTogglePayload,
  AdminConfigSection,
  AdminCompleteQueuePayload,
  AdminFillResourcesPayload,
  AdminGrantItemPayload,
  BuildFacilityPayload,
  CharacterClass,
  CharacterProfile,
  CooperateRespondPayload,
  CraftPayload,
  EquipItemPayload,
  FactionTechUpgradePayload,
  FactionTowerAdvancePayload,
  FactionTowerBattlePayload,
  FriendAddPayload,
  InventorySortPayload,
  MarketBuyPayload,
  MarketListPayload,
  PlayerAttackPayload,
  PurchasePayload,
  QueueActionPayload,
  RepairPayload,
  RepairCastlePayload,
  SelectFactionPayload,
  SoloBattlePayload,
  TravelPayload,
  UnequipItemPayload
} from "../../shared/events";
import type { AuthedRequest } from "./auth";
import { login, register, requireAuth, requireFactionLeaderOrAdmin, requireRole } from "./auth";
import { getPublicRoomState, getRoomForUser, listRoomSummaries, refreshRoomMemberCharacters } from "./game";
import {
  addFriend,
  advanceFactionTower,
  attackNearbyPlayer,
  adminAdjustResources,
  adminAdjustCharacter,
  adminAdjustTreasury,
  adminAssignLeader,
  adminBattleTest,
  adminCreateAnnouncement,
  adminCompleteQueue,
  adminFillResources,
  adminResetGameConfigSection,
  adminGrantItem,
  adminGrantResources,
  adminListAnnouncements,
  adminUpdateGameConfigSection,
  adminResetDiplomacy,
  adminSetCastleOwner,
  adminToggleAnnouncement,
  adminToggleClass,
  adminTriggerDaily,
  adminTriggerFlashEvent,
  adminUpdateRewardConfig,
  cancelMarketListing,
  cancelQueuedAction,
  cancelQueuedActionsExceptActive,
  changeCharacterClass,
  challengeWorldBoss,
  claimDailySignIn,
  claimFlashSignIn,
  craftEquipment,
  createMarketListing,
  declareWar,
  enqueueAction,
  enqueueCastleBuild,
  enqueueCastleMove,
  enqueueCastleRepair,
  equipInventoryItem,
  equipManual,
  equipSpecialSkill,
  getAchievements,
  getAdminState,
  getAdminGameConfig,
  getCharacterCatalog,
  getFactionState,
  getWorldBossState,
  getInventory,
  getQueueState,
  garrisonCastle,
  getSignInStatus,
  isCharacterBusy,
  joinFactionProject,
  joinCastleSiege,
  learnManual,
  leaveGarrison,
  leaveFactionProject,
  listNearbyPlayers,
  listBattleRecordsForUser,
  listFactionMarket,
  listFactions,
  listForgeOptions,
  listForgeRecipes,
  listFriends,
  listAnnouncements,
  listNotifications,
  listShopItems,
  processCharacterQueue,
  purchaseShopItem,
  repairEquipment,
  retreatFactionTowerBoss,
  requestCooperation,
  respondCooperation,
  selectFaction,
  selectSecondaryCharacter,
  startFactionTowerBattle,
  startCastleSiege,
  startAdventureBattle,
  startSoloBattle,
  resolveCastleSiege,
  upgradeFactionTech,
  updateInventorySortOrder,
  unequipInventoryItem,
  unequipManual,
  buyMarketListing
} from "./persistence/localStore";
import { getOnlineUserIds } from "./socketServer";

export function createApiRouter() {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  router.post("/auth/register", async (request, response) => {
    try {
      const result = await register(request.body);
      response.json(result);
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "註冊失敗。" });
    }
  });

  router.post("/auth/login", async (request, response) => {
    try {
      const result = await login(request.body);
      response.json(result);
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "登入失敗。" });
    }
  });

  router.get("/me", requireAuth(), async (request: AuthedRequest, response) => {
    const processed = await processCharacterQueue(request.auth!.user.id, true);
    response.json({
      user: request.auth!.user,
      character: processed.character,
      token: request.auth!.token,
      completedActivities: processed.completedActivities.map((activity) => ({ message: activity.message }))
    });
  });

  router.get("/rooms", requireAuth(), (_request, response) => {
    response.json({ rooms: listRoomSummaries() });
  });

  router.get("/rooms/:roomId", requireAuth(), (request: AuthedRequest, response) => {
    const roomIdParam = Array.isArray(request.params.roomId) ? request.params.roomId[0] : request.params.roomId;
    const room = getPublicRoomState((roomIdParam || "").trim().toUpperCase());
    if (!room) {
      response.status(404).json({ error: "找不到房間。" });
      return;
    }
    response.json({ room });
  });

  router.post("/character/class", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      const className = request.body.className as CharacterClass;
      const character = await changeCharacterClass(request.auth!.user.id, className);
      response.json(character);
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "切換職業失敗。" });
    }
  });

  router.get("/character/catalog", requireAuth(), async (_request: AuthedRequest, response) => {
    response.json(await getCharacterCatalog());
  });

  router.post("/character/secondary", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      response.json(await selectSecondaryCharacter(request.auth!.user.id, request.body));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "次要角色更新失敗" });
    }
  });

  router.post("/character/special-skill", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      response.json(await equipSpecialSkill(request.auth!.user.id, request.body));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "特殊技能更新失敗" });
    }
  });

  router.get("/achievements", requireAuth(), async (request: AuthedRequest, response) => {
    response.json(await getAchievements(request.auth!.user.id));
  });

  router.get("/queue", requireAuth(), async (request: AuthedRequest, response) => {
    const result = await getQueueState(request.auth!.user.id, true);
    response.json(result);
  });

  router.post("/queue/actions", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      const queuePayload = request.body as QueueActionPayload;
      const room = getRoomForUser(request.auth!.user.id);
      if (room?.phase === "battle") {
        response.status(400).json({ error: "隊伍戰鬥中不能加入行動佇列。" });
        return;
      }
      await processCharacterQueue(request.auth!.user.id, true);
      const result = await enqueueAction(
        request.auth!.user.id,
        queuePayload.actionType as ActionType,
        queuePayload.durationHours
      );
      response.json(result);
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "加入隊列失敗。" });
    }
  });

  router.delete("/queue/actions/:actionId", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      const actionId = Array.isArray(request.params.actionId) ? request.params.actionId[0] : request.params.actionId;
      const result = await cancelQueuedAction(request.auth!.user.id, actionId);
      response.json(result);
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "取消隊列失敗。" });
    }
  });

  router.delete("/queue/actions", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      const result = await cancelQueuedActionsExceptActive(request.auth!.user.id);
      response.json(result);
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "取消隊列失敗。" });
    }
  });

  router.get("/shop", requireAuth(), async (_request: AuthedRequest, response) => {
    const items = await listShopItems();
    response.json({ items });
  });

  router.post("/shop/purchase", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      const payload = request.body as PurchasePayload;
      const result = await purchaseShopItem(request.auth!.user.id, payload.itemId);
      response.json(result);
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "購買失敗。" });
    }
  });

  router.get("/inventory", requireAuth(), async (request: AuthedRequest, response) => {
    response.json(await getInventory(request.auth!.user.id));
  });

  router.post("/inventory/equip", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      response.json(await equipInventoryItem(request.auth!.user.id, request.body as EquipItemPayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "裝備失敗。" });
    }
  });

  router.post("/inventory/unequip", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      response.json(await unequipInventoryItem(request.auth!.user.id, request.body as UnequipItemPayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "卸下失敗。" });
    }
  });

  router.post("/inventory/sort", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      response.json(await updateInventorySortOrder(request.auth!.user.id, request.body as InventorySortPayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "排序失敗。" });
    }
  });

  router.post("/inventory/manuals/learn", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      response.json(await learnManual(request.auth!.user.id, request.body));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "秘籍學習失敗" });
    }
  });

  router.post("/inventory/manuals/equip", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      response.json(await equipManual(request.auth!.user.id, request.body));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "秘籍裝備失敗" });
    }
  });

  router.post("/inventory/manuals/unequip", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      response.json(await unequipManual(request.auth!.user.id, request.body));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "秘籍卸下失敗" });
    }
  });

  router.get("/forge/options", requireAuth(), async (_request: AuthedRequest, response) => {
    response.json({ options: await listForgeOptions(), recipes: await listForgeRecipes() });
  });

  router.post("/forge/craft", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      const payload = request.body as CraftPayload;
      response.json(await craftEquipment(request.auth!.user.id, payload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "鍛造失敗。" });
    }
  });

  router.post("/forge/repair", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      response.json(await repairEquipment(request.auth!.user.id, request.body as RepairPayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "修復失敗。" });
    }
  });

  router.get("/factions", requireAuth(), async (_request: AuthedRequest, response) => {
    response.json({ factions: await listFactions() });
  });

  router.get("/factions/me", requireAuth(), async (request: AuthedRequest, response) => {
    response.json(await getFactionState(request.auth!.user.id));
  });

  router.post("/factions/select", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      response.json(await selectFaction(request.auth!.user.id, request.body as SelectFactionPayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "加入陣營失敗。" });
    }
  });

  router.post("/factions/castles/move", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      response.json(await enqueueCastleMove(request.auth!.user.id, request.body as TravelPayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "移動失敗。" });
    }
  });

  router.post("/factions/castles/:castleId/build", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      const castleId = Array.isArray(request.params.castleId) ? request.params.castleId[0] : request.params.castleId;
      response.json(
        await enqueueCastleBuild(request.auth!.user.id, { ...(request.body as BuildFacilityPayload), castleId })
      );
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "建設失敗。" });
    }
  });

  router.post("/factions/castles/:castleId/repair", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      const castleId = Array.isArray(request.params.castleId) ? request.params.castleId[0] : request.params.castleId;
      response.json(
        await enqueueCastleRepair(request.auth!.user.id, { ...(request.body as RepairCastlePayload), castleId })
      );
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "修建失敗。" });
    }
  });

  router.post("/factions/projects/:projectId/join", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      const projectId = Array.isArray(request.params.projectId)
        ? request.params.projectId[0]
        : request.params.projectId;
      response.json(await joinFactionProject(request.auth!.user.id, projectId));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "加入工程失敗。" });
    }
  });

  router.post("/factions/projects/:projectId/leave", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      const projectId = Array.isArray(request.params.projectId)
        ? request.params.projectId[0]
        : request.params.projectId;
      response.json(await leaveFactionProject(request.auth!.user.id, projectId));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "退出工程失敗。" });
    }
  });

  router.post(
    "/factions/diplomacy/cooperate",
    requireFactionLeaderOrAdmin(),
    async (request: AuthedRequest, response) => {
      try {
        response.json(await requestCooperation(request.auth!.user.id, request.body));
      } catch (error) {
        response.status(400).json({ error: error instanceof Error ? error.message : "提出合作失敗。" });
      }
    }
  );

  router.post(
    "/factions/diplomacy/cooperate/respond",
    requireFactionLeaderOrAdmin(),
    async (request: AuthedRequest, response) => {
      try {
        response.json(await respondCooperation(request.auth!.user.id, request.body as CooperateRespondPayload));
      } catch (error) {
        response.status(400).json({ error: error instanceof Error ? error.message : "處理合作邀請失敗。" });
      }
    }
  );

  router.post(
    "/factions/diplomacy/declare-war",
    requireFactionLeaderOrAdmin(),
    async (request: AuthedRequest, response) => {
      try {
        response.json(await declareWar(request.auth!.user.id, request.body));
      } catch (error) {
        response.status(400).json({ error: error instanceof Error ? error.message : "宣戰失敗。" });
      }
    }
  );

  router.post("/factions/tech/upgrade", requireFactionLeaderOrAdmin(), async (request: AuthedRequest, response) => {
    try {
      response.json(await upgradeFactionTech(request.auth!.user.id, request.body as FactionTechUpgradePayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "科技升級失敗。" });
    }
  });

  router.get("/battles/players/nearby", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      await processCharacterQueue(request.auth!.user.id, true);
      response.json(await listNearbyPlayers(request.auth!.user.id));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "讀取同地點玩家失敗。" });
    }
  });

  router.post("/battles/players/attack", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      await processCharacterQueue(request.auth!.user.id, true);
      response.json(await attackNearbyPlayer(request.auth!.user.id, request.body as PlayerAttackPayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "玩家遭遇攻擊失敗。" });
    }
  });

  router.post("/battles/adventure/start", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      await processCharacterQueue(request.auth!.user.id, true);
      response.json(await startAdventureBattle(request.auth!.user.id, request.body as SoloBattlePayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "探險失敗。" });
    }
  });

  router.post("/battles/solo/start", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      await processCharacterQueue(request.auth!.user.id, true);
      response.json(await startSoloBattle(request.auth!.user.id, request.body as SoloBattlePayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "探險失敗。" });
    }
  });

  router.post("/factions/battles/guild-boss/advance", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      await processCharacterQueue(request.auth!.user.id, true);
      response.json(await advanceFactionTower(request.auth!.user.id, request.body as FactionTowerAdvancePayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "塔層推進失敗。" });
    }
  });

  router.post("/factions/battles/guild-boss/retreat", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      await processCharacterQueue(request.auth!.user.id, true);
      response.json(await retreatFactionTowerBoss(request.auth!.user.id));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "塔層撤退失敗。" });
    }
  });

  router.post("/factions/battles/guild-boss/start", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      await processCharacterQueue(request.auth!.user.id, true);
      response.json(await startFactionTowerBattle(request.auth!.user.id, request.body as FactionTowerBattlePayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "公會 Boss 戰鬥失敗。" });
    }
  });

  router.post("/factions/battles/tower/start", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      await processCharacterQueue(request.auth!.user.id, true);
      response.json(await startFactionTowerBattle(request.auth!.user.id, request.body as FactionTowerBattlePayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "公會 Boss 戰鬥失敗。" });
    }
  });

  router.get("/factions/world-boss", requireAuth(), async (_request: AuthedRequest, response) => {
    response.json(await getWorldBossState());
  });

  router.post("/factions/world-boss/challenge", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      await processCharacterQueue(request.auth!.user.id, true);
      response.json(await challengeWorldBoss(request.auth!.user.id));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "世界 Boss 挑戰失敗。" });
    }
  });

  router.get("/shop/market", requireAuth(), async (request: AuthedRequest, response) => {
    response.json({ listings: await listFactionMarket(request.auth!.user.id) });
  });

  router.post("/shop/market/list", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      response.json(await createMarketListing(request.auth!.user.id, request.body as MarketListPayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "上架失敗。" });
    }
  });

  router.post("/shop/market/buy", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      response.json(await buyMarketListing(request.auth!.user.id, request.body as MarketBuyPayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "購買掛單失敗。" });
    }
  });

  router.post("/shop/market/cancel", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      response.json(await cancelMarketListing(request.auth!.user.id, request.body.listingId as string));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "取消掛單失敗。" });
    }
  });

  router.post("/factions/castles/:castleId/garrison", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      const castleId = Array.isArray(request.params.castleId) ? request.params.castleId[0] : request.params.castleId;
      response.json(await garrisonCastle(request.auth!.user.id, castleId));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "駐防失敗。" });
    }
  });

  router.post("/factions/castles/:castleId/garrison/leave", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      const castleId = Array.isArray(request.params.castleId) ? request.params.castleId[0] : request.params.castleId;
      response.json(await leaveGarrison(request.auth!.user.id, castleId));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "退出駐防失敗。" });
    }
  });

  router.post("/factions/castles/:castleId/siege/start", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      const castleId = Array.isArray(request.params.castleId) ? request.params.castleId[0] : request.params.castleId;
      response.json(await startCastleSiege(request.auth!.user.id, castleId));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "發起攻城戰失敗。" });
    }
  });

  router.post("/factions/sieges/:siegeId/join", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      const siegeId = Array.isArray(request.params.siegeId) ? request.params.siegeId[0] : request.params.siegeId;
      response.json(await joinCastleSiege(request.auth!.user.id, siegeId));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "加入攻城戰失敗。" });
    }
  });

  router.post("/factions/sieges/:siegeId/resolve", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      const siegeId = Array.isArray(request.params.siegeId) ? request.params.siegeId[0] : request.params.siegeId;
      response.json(await resolveCastleSiege(request.auth!.user.id, siegeId));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "結算攻城戰失敗。" });
    }
  });

  router.post("/factions/castles/:castleId/attack", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      const castleId = Array.isArray(request.params.castleId) ? request.params.castleId[0] : request.params.castleId;
      const room = getRoomForUser(request.auth!.user.id);
      if (room) {
        if (room.phase !== "lobby") {
          response.status(400).json({ error: "隊伍已經在行動中。" });
          return;
        }
        if (room.hostId !== request.auth!.user.id) {
          response.status(400).json({ error: "只有隊長可以發起進攻。" });
          return;
        }
        const onlineUsers = getOnlineUserIds();
        const latestCharacters: CharacterProfile[] = [];
        for (const member of room.members) {
          const processed = await processCharacterQueue(member.userId, onlineUsers.has(member.userId));
          if (isCharacterBusy(processed.character)) {
            response.status(400).json({ error: `${member.displayName} 目前不是閒暇中，隊伍不能進攻。` });
            return;
          }
          latestCharacters.push(processed.character);
        }
        refreshRoomMemberCharacters(room.roomId, latestCharacters);
      } else {
        const processed = await processCharacterQueue(request.auth!.user.id, true);
        if (isCharacterBusy(processed.character)) {
          response.status(400).json({ error: "角色目前不是閒暇中，不能進攻。" });
          return;
        }
      }
      response.json(await startCastleSiege(request.auth!.user.id, castleId));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "攻城失敗。" });
    }
  });

  router.get("/battles", requireAuth(), async (request: AuthedRequest, response) => {
    response.json(await listBattleRecordsForUser(request.auth!.user.id));
  });

  router.get("/notifications", requireAuth(), async (request: AuthedRequest, response) => {
    response.json({ notifications: await listNotifications(request.auth!.user.id) });
  });

  router.get("/announcements", requireAuth(), async (_request: AuthedRequest, response) => {
    response.json({ announcements: await listAnnouncements() });
  });

  router.get("/friends", requireAuth(), async (request: AuthedRequest, response) => {
    const onlineUsers = getOnlineUserIds();
    response.json({ friends: await listFriends(request.auth!.user.id, (id) => onlineUsers.has(id)) });
  });

  router.post("/friends", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      const payload = request.body as FriendAddPayload;
      await addFriend(request.auth!.user.id, payload.characterName, payload.email);
      const onlineUsers = getOnlineUserIds();
      response.json({
        message: "好友已加入。",
        friends: await listFriends(request.auth!.user.id, (id) => onlineUsers.has(id))
      });
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "加入好友失敗。" });
    }
  });

  router.get("/sign-in/status", requireAuth(), async (request: AuthedRequest, response) => {
    response.json(await getSignInStatus(request.auth!.user.id));
  });

  router.post("/sign-in/daily", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      response.json(await claimDailySignIn(request.auth!.user.id));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "每日簽到失敗。" });
    }
  });

  router.post("/sign-in/flash", requireAuth(), async (request: AuthedRequest, response) => {
    try {
      response.json(await claimFlashSignIn(request.auth!.user.id));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "突襲活動失敗。" });
    }
  });

  router.get("/admin/state", requireRole("admin"), async (_request: AuthedRequest, response) => {
    response.json(await getAdminState());
  });

  router.get("/admin/config", requireRole("admin"), async (_request: AuthedRequest, response) => {
    response.json(await getAdminGameConfig());
  });

  router.put("/admin/config/:section", requireRole("admin"), async (request: AuthedRequest, response) => {
    try {
      const section = (
        Array.isArray(request.params.section) ? request.params.section[0] : request.params.section
      ) as AdminConfigSection;
      response.json(await adminUpdateGameConfigSection(section, request.body));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "更新參數失敗。" });
    }
  });

  router.post("/admin/config/:section/reset", requireRole("admin"), async (request: AuthedRequest, response) => {
    try {
      const section = (
        Array.isArray(request.params.section) ? request.params.section[0] : request.params.section
      ) as AdminConfigSection;
      response.json(await adminResetGameConfigSection(section));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "還原參數失敗。" });
    }
  });

  router.get("/admin/announcements", requireRole("admin"), async (_request: AuthedRequest, response) => {
    response.json({ announcements: await adminListAnnouncements() });
  });

  router.post("/admin/actions/complete-queue", requireRole("admin"), async (request: AuthedRequest, response) => {
    try {
      response.json(await adminCompleteQueue(request.body as AdminCompleteQueuePayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "立即完成隊列失敗。" });
    }
  });

  router.post("/admin/actions/fill-resources", requireRole("admin"), async (request: AuthedRequest, response) => {
    try {
      response.json(await adminFillResources(request.body as AdminFillResourcesPayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "補滿資源失敗。" });
    }
  });

  router.post("/admin/items/grant", requireRole("admin"), async (request: AuthedRequest, response) => {
    try {
      response.json(await adminGrantItem(request.body as AdminGrantItemPayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "發送物品失敗。" });
    }
  });

  router.post("/admin/resources/adjust", requireRole("admin"), async (request: AuthedRequest, response) => {
    try {
      response.json(await adminAdjustResources(request.body as AdminAdjustResourcesPayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "修改資源失敗。" });
    }
  });

  router.post("/admin/characters/adjust", requireRole("admin"), async (request: AuthedRequest, response) => {
    try {
      response.json(await adminAdjustCharacter(request.body as AdminAdjustCharacterPayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "修改角色參數失敗。" });
    }
  });

  router.post("/admin/resources/grant", requireRole("admin"), async (request: AuthedRequest, response) => {
    try {
      response.json(await adminGrantResources(request.body as AdminGrantResourcesPayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "發送資源失敗。" });
    }
  });

  router.post("/admin/battle/test", requireRole("admin"), async (request: AuthedRequest, response) => {
    try {
      response.json(await adminBattleTest(request.body as AdminBattleTestPayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "戰鬥測試失敗。" });
    }
  });

  router.post("/admin/system/daily", requireRole("admin"), async (request: AuthedRequest, response) => {
    try {
      response.json(await adminTriggerDaily(request.body.targetUserId as string));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "手動簽到失敗。" });
    }
  });

  router.post("/admin/system/flash-event", requireRole("admin"), async (request: AuthedRequest, response) => {
    try {
      response.json(await adminTriggerFlashEvent(Number(request.body.minutes || 15)));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "觸發突襲活動失敗。" });
    }
  });

  router.post("/admin/system/reward-config", requireRole("admin"), async (request: AuthedRequest, response) => {
    try {
      response.json(await adminUpdateRewardConfig(request.body as AdminRewardConfigPayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "獎勵設定失敗。" });
    }
  });

  router.post("/admin/system/class-toggle", requireRole("admin"), async (request: AuthedRequest, response) => {
    try {
      response.json(await adminToggleClass(request.body as AdminClassTogglePayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "更新職業狀態失敗。" });
    }
  });

  router.post("/admin/system/announcements", requireRole("admin"), async (request: AuthedRequest, response) => {
    try {
      response.json({ announcements: await adminCreateAnnouncement(request.body as AdminAnnouncementPayload) });
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "公告建立失敗" });
    }
  });

  router.post("/admin/system/announcements/toggle", requireRole("admin"), async (request: AuthedRequest, response) => {
    try {
      response.json({ announcements: await adminToggleAnnouncement(request.body as AdminAnnouncementTogglePayload) });
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "公告切換失敗" });
    }
  });

  router.post("/admin/factions/assign-leader", requireRole("admin"), async (request: AuthedRequest, response) => {
    try {
      response.json(await adminAssignLeader(request.body as AdminAssignLeaderPayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "指派領袖失敗。" });
    }
  });

  router.post("/admin/factions/set-castle-owner", requireRole("admin"), async (request: AuthedRequest, response) => {
    try {
      response.json(await adminSetCastleOwner(request.body));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "修改城池歸屬失敗。" });
    }
  });

  router.post("/admin/factions/adjust-treasury", requireRole("admin"), async (request: AuthedRequest, response) => {
    try {
      response.json(await adminAdjustTreasury(request.body as AdminAdjustTreasuryPayload));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "調整公庫失敗。" });
    }
  });

  router.post("/admin/factions/reset-diplomacy", requireRole("admin"), async (_request: AuthedRequest, response) => {
    try {
      response.json(await adminResetDiplomacy());
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "重設外交失敗。" });
    }
  });

  return router;
}
