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
  - 包含角色、行動、戰鬥、陣營、揹包、鍛造、消息、好友、商店
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

1. 前端送出排程請求
2. `server/src/routes.ts` 驗證是否在房間內
3. `server/src/persistence/localStore.ts` 寫入隊列
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
11. 個人戰鬥走 `/battles/solo/start`，公會爬層走 `/factions/battles/tower/start`
12. 即時房間戰鬥的特殊事件判定在 `server/src/combatEngine.ts`，房間戰鬥、個人戰鬥與公會戰鬥共用
13. 次要角色自動技能在 `server/src/game.ts` 的房間戰鬥 tick 中判定；個人 / 公會即時結算戰鬥在 `server/src/persistence/localStore.ts` 內同步套用

### 管理後台與遊戲參數

1. `admin-client/src/api.ts` 使用 `/api/auth/login` 取得 token，再呼叫 `/api/admin/config`。
2. `/api/admin/config` 回傳 `gameConfig`、職業狀態、獎勵、城池、陣營與公告。
3. `/api/admin/config/:section` 只更新單一分類，避免整包設定被誤覆蓋。
4. `/api/admin/config/:section/reset` 還原單一分類預設。
5. 後台參數頁用表單 schema 產生輸入元件，支援文字、數字、開關、下拉、多選、時間、陣列增刪與巢狀欄位。
6. `server/src/persistence/localStore.ts` 會正規化舊 store；沒有 `gameConfig`、`siegeRules`、`statRules` 或 `garrisonAssignment` 時自動補預設值。
7. `server/src/utils.ts` 的技能、次要角色、戰鬥難度、商店、鍛造、攻城與屬性規則都會先讀取 store override，沒有 override 才使用預設值。

### 探險、公會 Boss、世界 Boss

1. 探險入口是 `/battles/adventure/start`，舊 `/battles/solo/start` 保留為 alias。
2. 公會 Boss 入口是 `/factions/battles/guild-boss/start`，舊 `/factions/battles/tower/start` 保留為 alias。
3. 世界 Boss 狀態與挑戰分別是 `/factions/world-boss`、`/factions/world-boss/challenge`。
4. 三類戰鬥都由 `server/src/persistence/localStore.ts` 產生 `BattleRecordSummary`，新資料使用 `battleKind` 標示 `adventure / guildBoss / worldBoss`。
5. 前端戰鬥頁在 `client/src/App.tsx` 顯示三類入口，戰報詳情會把舊 context 轉成可讀中文標籤。

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

- 共用型別在 `shared/events.ts`：`CharacterClass` 包含 `assassin`，角色資料包含 `secondaryCharacters`、`classMastery`、`specialSkillSlot`、`learnedManuals`、`equippedManuals`、`achievements`。
- 角色/技能目錄在 `server/src/utils.ts`，前端透過 `/api/character/catalog` 取得次要角色卡與特殊技能清單。
- 角色操作 REST API 位於 `server/src/routes.ts`：`/character/secondary`、`/character/special-skill`、`/inventory/manuals/*`、`/achievements`。
- 前端主要入口仍是 `client/src/App.tsx`：角色頁負責主定位、職業熟練度、次要角色等級 / 經驗 / 自動技能顯示；背包秘笈 tab 負責秘籍學習/裝備；成就頁為獨立 nav。
- 次要角色卡狀態從單一 id 擴充為 `level / exp / unlockedSkillIds / lastTriggeredSkillId / cooldownUntilTick`，舊資料會在 `localStore` 正規化時補預設值。
- `specialSkillSlot` 仍保留，但次要角色技能的主要玩法已改為戰鬥中自動判定。
