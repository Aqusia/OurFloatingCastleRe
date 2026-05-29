# 多人養成討伐原型

這是一個以網頁為主的多人養成 + 自動討伐原型，採用 `client` / `server` / `shared` 的分層結構。

目前重點包含：

- 中文介面與左側固定導覽
- 行動隊列、訓練、挖礦、休息
- 多人房間、自動戰鬥、戰報
- 陣營、城池、外交、公庫
- 揹包、裝備、鍛造、玩家市場
- Admin 功能、公告、每日獎勵、突發活動

## 快速入口

第一次接手這個 repo，建議依序看：

1. `AGENTS.md`
2. `README.md`
3. `docs/repository-guide.md`
4. `docs/documentation-policy.md`
5. `docs/game-design.md`
6. `docs/changelog.md`

## 專案結構

```text
client/                 React + Vite 前端
server/                 Express + Socket.IO 後端
shared/                 前後端共用型別與事件契約
docs/                   專案導覽、設計、變更紀錄
supabase/               schema / migration 草稿
```

## 啟動方式

在專案根目錄執行：

```powershell
npm.cmd install
```

啟動後端：

```powershell
npm.cmd --workspace server run dev
```

啟動前端：

```powershell
npm.cmd --workspace client run dev
```

前端網址：

- [http://127.0.0.1:5173](http://127.0.0.1:5173)

後端健康檢查：

- [http://127.0.0.1:3001/api/health](http://127.0.0.1:3001/api/health)

## 文件索引

- `AGENTS.md`
  - 給 AI / 維護者的進場順序、改動守則、文件同步規則
- `docs/repository-guide.md`
  - 讀 repo 最快的導覽，說明每個資料夾與關鍵檔案負責什麼
- `docs/documentation-policy.md`
  - 明文規定什麼改動一定要同步更新文件
- `docs/game-design.md`
  - 目前玩法、系統規則、功能狀態
- `docs/changelog.md`
  - 每一輪實際改動紀錄

## 文件同步規則

只要有以下變更，就要在同一次提交補文件：

- 功能或規則改動：更新 `docs/game-design.md`
- 結構、資料流、關鍵入口改動：更新 `docs/repository-guide.md`
- 已完成的工作內容：更新 `docs/changelog.md`
- 啟動方式、環境需求、入口路徑改動：更新 `README.md`

如果程式改了但文件沒改，這個 repo 很快就會變得難以維護，也會讓 AI 判讀成本大幅上升。

## 目前主要資料位置

- 本地持久化：`server/server/data/store.json`
- 前後端契約：`shared/events.ts`
- 後端主路由：`server/src/routes.ts`
- 戰鬥流程：`server/src/game.ts`
- 前端主畫面：`client/src/App.tsx`
- Supabase migration 草稿：`supabase/migrations/`
