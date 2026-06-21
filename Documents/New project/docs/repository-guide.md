# Repository Guide

這份文件的目的是讓人或 AI 能在最短時間內理解這個專案的入口、資料流與主要責任分工。

## 建議閱讀順序

1. `README.md`
2. `docs/repository-guide.md`
3. `docs/game-design.md`
4. `shared/events.ts`
5. `server/src/routes.ts`
6. `client/src/App.tsx`

## 目錄地圖

### `client/`

前端 React 應用。

- `client/src/App.tsx`
  - 主畫面與大部分頁面邏輯都集中在這裡
  - 包含角色、技能、行動、爬塔、戰鬥、陣營、揹包、鍛造、消息、好友、商店
  - 頂部 HUD 導覽、公告列、狀態指揮列、頁面標題列、全域行動鎖定、Attack Director、Skill Console、Boss Command、Forge Workbench 與主要切頁狀態也在這裡
  - 登入 / 建立角色畫面已抽成 `AuthScreen`
- `client/src/lib/api.ts`
  - 所有 HTTP API 呼叫集中處
- `client/src/lib/socket.ts`
  - Socket.IO 連線入口
- `client/src/lib/storage.ts`
  - token 等本地儲存

### `admin-client/`

獨立 React + Vite 管理後台，預設使用 [http://127.0.0.1:5174](http://127.0.0.1:5174)。

- 使用與主遊戲相同的 `/api/auth/login` 登入。
- 登入後只允許 `user.role === "admin"` 載入參數頁。
- 目前以 schema-driven 表單管理遊戲參數分類，不再要求 admin 直接編輯 JSON。
- 後台編輯器上方顯示「攻打調參總覽」，會整合爬塔、玩家遭遇、世界 Boss、隊伍 Boss 的平均 FUN 分數、最低分模式與調參建議。
- 「爬塔規則」、「隊伍 Boss」、「世界 Boss」與「玩家遭遇」頁額外顯示 FUN SCORE 與調參建議，邏輯在 `admin-client/src/main.tsx`，樣式在 `admin-client/src/style.css`。
- 後台「使用者參數」面板呼叫 `/api/admin/characters/adjust` 調指定角色的 HP / MP / 精力、上限、等級、經驗、金幣、材料與 8 屬性；同一面板也會呼叫 `/api/admin/actions/fill-resources`、`/api/admin/resources/grant`、`/api/admin/items/grant` 補狀態、解除移動 / 駐防 / 隊列鎖、發材料與發裝備。
- `admin-client/src/main.tsx` 的 `sections` / `FieldDef` 是後台擴充入口；新增參數時優先補欄位定義與預設新增模板。
- 主遊戲 `client/` 不再顯示 Admin 導覽入口。

### `server/`

後端 Express API 與 Socket.IO 即時事件。

- `server/src/index.ts`
  - 後端啟動入口
  - 掛載 REST API、Socket.IO、背景隊列處理
  - production 模式會提供 `client/dist`，可用單一 Node 服務部署完整網站
- `server/src/routes.ts`
  - 所有 REST 路由入口
- `server/src/game.ts`
  - 房間、Boss、自動戰鬥、tick 流程
- `server/src/auth.ts`
  - 註冊、登入、授權守門
- `server/src/socketServer.ts`
  - socket 訂閱、房間事件與同步
- `server/src/persistence/localStore.ts`
  - 目前最重要的資料層
  - 角色、背包、公告、陣營、城池、市場、簽到、管理功能幾乎都在這裡
  - 開發指令預設資料位置為 `server/server/data/store.json`，部署時可用 `GAME_DATA_DIR` 指向 persistent disk
- `server/src/lib/supabase.ts`
  - Supabase 相關連線準備

### `shared/`

前後端共用契約。

- `shared/events.ts`
  - 所有主要 domain type
  - REST payload / response type
  - Socket event type

### `docs/`

維護導向文件。

- `docs/game-design.md`
  - 功能、系統規則、目前狀態
- `docs/documentation-policy.md`
  - 文件同步規則與提交前檢查
- `docs/open-source-references.md`
  - 開源遊戲、UI、架構工具參考與授權判斷
- `docs/changelog.md`
  - 每輪改動紀錄
- `docs/repository-guide.md`
  - 本文件，快速理解 repo

### `supabase/`

未來資料庫 schema 與 migration 草稿。

## 重要資料流

### 登入與初始化

1. 前端透過 `client/src/lib/api.ts` 呼叫登入 / 註冊
2. 取得 token 後，由 `client/src/lib/storage.ts` 保存
3. `client/src/App.tsx` 呼叫 `/me` 取得角色狀態
4. socket 以 `auth:ready` 通知後端建立即時同步

### 行動隊列

1. 前端送出排程請求；訓練、挖礦、休息進行中可追加下一個隊列項目
2. `server/src/routes.ts` 驗證是否處於隊伍 Boss 戰鬥中
3. `server/src/persistence/localStore.ts` 檢查移動 / 駐防鎖定後寫入隊列
4. `server/src/index.ts` 的定時流程持續推進並結算

### 房間與戰鬥

1. 前端透過 socket 建房 / 加房 / 開戰
2. `server/src/socketServer.ts` 接住事件
3. `server/src/game.ts` 建立房間狀態並跑戰鬥 tick
4. 戰報與結果回寫到 `localStore`

### Production 部署

1. `npm run build` 先建置 `client/dist` 與 `server/dist`
2. `npm start` 執行 `server/dist/server/src/index.js`
3. `NODE_ENV=production` 時 Express 會回傳前端靜態檔
4. REST API 仍在 `/api/*`，Socket.IO 與頁面共用同一個 origin

### 陣營、城池、市場

1. REST API 入口在 `server/src/routes.ts`
2. 實作大多在 `server/src/persistence/localStore.ts`
3. 型別與 payload 定義在 `shared/events.ts`
4. 城池資料包含層次、距離、特性、建設槽與設施，角色用 `currentCastleId` 記錄目前所在據點
5. 移動透過 `/factions/castles/move` 寫入角色 `movement`，不進 `actionQueue`
6. 建設與修建透過 `/factions/castles/*` 建立 `factionProjects`，成員可加入或退出，完成時寫回設施或城防
7. 公庫不發放給個人；`/factions/tech/upgrade` 會消耗公庫金幣升級城堡、防禦、攻擊、支援或進攻速度科技
8. 駐防走 `/factions/castles/:castleId/garrison` 與 `/garrison/leave`，角色會寫入 `garrisonAssignment` 並視為忙碌
9. 攻城戰走 `/factions/castles/:castleId/siege/start`、`/factions/sieges/:siegeId/join`、`/factions/sieges/:siegeId/resolve`
10. 攻城戰狀態存於 local store 的 `sieges`；讀取陣營狀態或操作戰場時會依 elapsed ticks 補跑回合
11. 個人探險走 `/battles/adventure/start`，舊 `/battles/solo/start` 保留為 alias；前端只送 `mapNodeId`，難度由場景用途與外層在 server 推導
12. 即時房間戰鬥的特殊事件判定在 `server/src/combatEngine.ts`，房間戰鬥、個人戰鬥與公會戰鬥共用
13. 次要角色自動技能在 `server/src/game.ts` 的房間戰鬥 tick 中判定；個人 / 公會即時結算戰鬥在 `server/src/persistence/localStore.ts` 內同步套用；只會從 `specialSkillSlots` 已裝備的技能中抽選，時間暫停會讀取已裝備的時脈秘籍並透過 `server/src/utils.ts` 的 `resolveTimeStopWindow` 追加普攻、飛刀、接續技能與 Boss 壓制
14. 角色登入與 session 讀取會透過 `localStore` 檢查承太郎登入贈禮：沒有承太郎且有空槽時自動裝備，不覆蓋既有三槽配置。

### 管理後台與遊戲參數

1. `admin-client/src/api.ts` 使用 `/api/auth/login` 取得 token，再呼叫 `/api/admin/config`。
2. `/api/admin/config` 回傳 `gameConfig`、職業狀態、獎勵、城池、陣營與公告。
3. `/api/admin/config/:section` 只更新單一分類，避免整包設定被誤覆蓋。
4. `/api/admin/config/:section/reset` 還原單一分類預設。
5. 後台參數頁用表單 schema 產生輸入元件，支援文字、數字、開關、下拉、多選、時間、陣列增刪與巢狀欄位。
6. `/api/admin/characters/adjust` 直接調角色測試參數；payload 型別是 `AdminAdjustCharacterPayload`，包含目前資源、上限、等級、經驗、金幣、材料與 stats。
7. `/api/admin/actions/fill-resources` 可補滿指定角色 HP / MP / 精力，也可清狀態效果、清行動隊列、完成移動或解除駐防；payload 型別是 `AdminFillResourcesPayload`。
8. `/api/admin/resources/grant` 與 `/api/admin/items/grant` 用於 GM 發放，前者發金幣與材料堆疊，後者發商店物品、鍛造物品或自訂裝備。
9. `towerRules` 是爬塔與攻打節奏的調參入口，控制步數需求、趕路 / 攻擊機率、Boss / 小王遭遇、小關節點獎勵、強度倍率與獎勵倍率；推進未鎖定 Boss 時會固定進入巡邏怪或小王短戰。
10. `playerAttackRules` 是同地點玩家遭遇的調參入口，控制發起精力、最多回合、攻守勝敗經驗與金幣繳獲公式。
11. `worldBossRules` 是世界 Boss 競賽的調參入口，控制 Boss 名稱、HP、攻擊、回合數、首殺獎勵、重複勝利獎與失敗參與獎。
12. `roomBossRules` 是一般隊伍 Boss 的調參入口，控制 Boss 名稱、回合間隔、HP / 攻擊倍率、勝敗經驗與勝敗金幣。
13. `server/src/persistence/localStore.ts` 會正規化舊 store；沒有 `gameConfig`、`siegeRules`、`statRules`、`towerRules`、`playerAttackRules`、`worldBossRules`、`roomBossRules` 或 `garrisonAssignment` 時自動補預設值。
14. `server/src/utils.ts` 的技能、次要角色、戰鬥難度、商店、鍛造、攻城、隊伍 Boss、爬塔、世界 Boss、玩家遭遇與屬性規則都會先讀取 store override，沒有 override 才使用預設值；舊 store 缺少新預設角色或技能時，`normalizeGameConfig` 會補回缺少的預設項目。

### 探險、公會 Boss、世界 Boss

1. 探險入口是 `/battles/adventure/start`，舊 `/battles/solo/start` 保留為 alias。
2. 公會爬塔推進入口是 `/factions/battles/guild-boss/advance`，撤退入口是 `/factions/battles/guild-boss/retreat`，Boss 挑戰入口是 `/factions/battles/guild-boss/start`；舊 `/factions/battles/tower/start` 保留為 alias。
3. 隊伍 Boss 走 Socket.IO 房間事件 `room:create`、`room:join`、`room:start`，Boss 生成與 tick 流程在 `server/src/game.ts`；`gameConfig.roomBossRules` 控制一般隊伍 Boss 名稱、速度、強度與勝敗獎勵。
4. 同地點玩家遭遇入口是 `/battles/players/nearby` 與 `/battles/players/attack`；後端會檢查同據點、角色閒暇、HP / 精力與同陣營禁止攻擊。
5. `gameConfig.playerAttackRules` 控制同地點玩家遭遇的發起精力、最多回合、攻守勝敗經驗與金幣繳獲公式；admin-client 的「玩家遭遇」分頁可調。
6. `FactionTowerProgress` 會保存目前層數、最高通關層、當層 Boss、步數、所需步數、Boss 解鎖狀態與最近事件；舊 store 會在 `localStore` 正規化時補欄位。
7. `gameConfig.towerRules` 控制公會爬塔步數需求、推進機率、Boss 鎖定率、小王率、小關節點獎勵、Boss 強度倍率與獎勵倍率；未鎖定 Boss 的推進會固定產生巡邏短戰，admin-client 的「爬塔規則」分頁可調。
8. 世界 Boss 狀態與挑戰分別是 `/factions/world-boss`、`/factions/world-boss/challenge`。
9. `gameConfig.worldBossRules` 控制世界 Boss 的本體數值、最多回合、材料種類、首殺獎勵、重複勝利獎與失敗參與獎；admin-client 的「世界 Boss」分頁可調。更新此 section 時會同步目前 active world boss 的名稱、HP、攻擊與獎勵數字，但保留挑戰紀錄。
10. 四類戰鬥都由 `server/src/persistence/localStore.ts` 產生 `BattleRecordSummary`，新資料使用 `battleKind` 標示 `adventure / guildBoss / worldBoss / pvp`。
11. 前端戰鬥頁在 `client/src/App.tsx` 顯示 `BATTLE HALL` 總覽、`ATTACK DIRECTOR` 下一步攻打入口、`BOSS COMMAND` 指揮列、同地點玩家遭遇、探險、隊伍與世界 Boss；公會爬塔改到獨立「爬塔」導覽頁，Boss 據點卡只導向塔頁。
12. 前端狀態指揮列會統一顯示 READY / MOVING / ACTION LOCK、移動路線、倒數、HP / MP / 精力 / 金幣；Battle / Tower 會沿用同一套鎖定文案，避免移動中仍看起來能操作。FUN SCORE 與調參建議只留在 admin-client。
13. 前端整體視覺集中在 `client/src/index.css`，目前採頂部 HUD、公告跑馬燈、狀態指揮列、終端式卡片與手機橫向導航列。

## 哪些檔案是高影響區

以下檔案改動後，通常都要同步更新文件：

- `client/src/App.tsx`
- `server/src/routes.ts`
- `server/src/game.ts`
- `server/src/persistence/localStore.ts`
- `shared/events.ts`

## 文件同步約定

改動完成後，請同步檢查：

- 功能或規則是否需要更新 `docs/game-design.md`
- 結構或入口是否需要更新 `docs/repository-guide.md`
- 本輪內容是否需要更新 `docs/changelog.md`
- 啟動或使用方式是否需要更新 `README.md`

## Frontend assets

- `client/src/assets/` stores frontend visual assets.
- Third-party or public domain images must record source and license notes in `client/src/assets/asset-sources.md`.

## 2026-05-31 角色擴充資料流

- 共用型別在 `shared/events.ts`：`CharacterClass` 包含 `assassin`，角色資料包含 `secondaryCharacters`、`classMastery`、`specialSkillSlots`、`specialSkillSlot`、`learnedManuals`、`equippedManuals`、`achievements`。
- 角色/技能目錄在 `server/src/utils.ts`，前端透過 `/api/character/catalog` 取得次要角色卡與特殊技能清單。
- 角色操作 REST API 位於 `server/src/routes.ts`：`/character/secondary`、`/character/special-skill`、`/inventory/manuals/*`、`/achievements`。
- 前端主要入口仍是 `client/src/App.tsx`：角色頁負責主定位、職業熟練度、次要角色等級 / 經驗 / 自動技能顯示；背包秘笈 tab 負責秘籍學習/裝備；成就頁為獨立 nav。
- 次要角色卡狀態從單一 id 擴充為 `level / exp / unlockedSkillIds / lastTriggeredSkillId / cooldownUntilTick`，舊資料會在 `localStore` 正規化時補預設值。
- `specialSkillSlots` 是 3 格特殊技能裝備欄；`specialSkillSlot` 仍保留作舊資料相容，次要角色自動技能只會從已裝備技能槽中判定。
