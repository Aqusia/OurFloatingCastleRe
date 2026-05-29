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
  - 包含角色、行動、戰鬥、陣營、揹包、鍛造、消息、好友、商店、Admin
- `client/src/lib/api.ts`
  - 所有 HTTP API 呼叫集中處
- `client/src/lib/socket.ts`
  - Socket.IO 連線入口
- `client/src/lib/storage.ts`
  - token 等本地儲存

### `server/`

後端 Express API 與 Socket.IO 即時事件。

- `server/src/index.ts`
  - 後端啟動入口
  - 掛載 REST API、Socket.IO、背景隊列處理
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

### 陣營、城池、市場

1. REST API 入口在 `server/src/routes.ts`
2. 實作大多在 `server/src/persistence/localStore.ts`
3. 型別與 payload 定義在 `shared/events.ts`

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
