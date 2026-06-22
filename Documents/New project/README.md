# 多人養成討伐原型

這是一個以網頁為主的多人養成 + 自動討伐原型，採用 `client` / `server` / `shared` 的分層結構。

目前重點包含：

- 中文介面、頂部 HUD 導覽與狀態指揮列
- 行動隊列、訓練、挖礦、休息、行動中追加排程、移動路線與全域行動鎖定提示
- 多人房間、自動戰鬥、逐行戰報
- 八屬性(攻／防／運／智／體／速／技／韌)各有明確戰鬥用途；SAO 式連擊鏈(連擊第 2 擊起消耗 MP、行動消耗精力)、心態(士氣)系統(體／韌撐起,影響輸出與是否退縮)、能量槽必殺槽與可裝備密技(承太郎歐拉歐拉連打／時間暫停)、進階戰技與狀態效果(破甲／灼燒／劇毒／冰封／震懾)、Boss 狂怒
- 探險、同地點玩家遭遇、公會 Boss、世界 Boss 競賽
- Attack Director 下一步攻打入口、Boss Command 集中攻打入口
- 公會爬塔推進與小關節點獎勵、隊伍 Boss、世界 Boss、玩家遭遇與可調攻打節奏
- 陣營、城池、外交、公庫
- 技能配置、登入贈送承太郎、次要角色自動技能、時間系技能、秘籍 Buff、成就、揹包、裝備、鍛造、玩家市場
- 獨立管理後台、使用者參數調整、補狀態 / 解鎖、發材料與裝備、攻打 FUN SCORE 總覽、爬塔 / 隊伍 Boss / 世界 Boss / 玩家遭遇攻打參數、公告、每日獎勵、突發活動

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
admin-client/           React + Vite 獨立管理後台
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

啟動獨立管理後台：

```powershell
npm.cmd run dev:admin
```

前端網址：

- [http://127.0.0.1:5173](http://127.0.0.1:5173)

管理後台網址：

- [http://127.0.0.1:5174](http://127.0.0.1:5174)

後端健康檢查：

- [http://127.0.0.1:3001/api/health](http://127.0.0.1:3001/api/health)

## 部署方式

production 可用單一 Node 服務同時提供前端、REST API 與 Socket.IO：

```powershell
npm.cmd install
npm.cmd run build
npm.cmd start
```

部署平台設定：

- Build command：`npm install && npm run build`
- Start command：`npm start`
- 必要環境變數：`NODE_ENV=production`
- 平台若提供 port，server 會讀取 `PORT`
- 若要保存正式資料，設定 `GAME_DATA_DIR` 到 persistent disk，例如 `/data`

Docker 部署可直接使用根目錄的 `Dockerfile`。

> Note: `npm start` 目前透過 `tsx` 直接執行 `server/src/index.ts`；理由與替代方案見 `DECISIONS.md`。

## 開發工具指令

```powershell
npm.cmd run lint           # ESLint 全專案
npm.cmd run lint:fix       # ESLint 自動修
npm.cmd run format         # Prettier 全專案格式化
npm.cmd run format:check   # Prettier 檢查 (不寫檔)
npm.cmd run test           # Vitest 跑一次
npm.cmd run test:watch     # Vitest watch 模式
npm.cmd run test:coverage  # 帶 coverage 報告
npm.cmd run typecheck      # 三個 workspace 的 tsc 型別檢查
npm.cmd run ci             # lint + typecheck + test + build (本機模擬 CI)
```

CI 走 GitHub Actions，設定在 `.github/workflows/ci.yml`，PR / push 到 `main` 會跑 `npm run ci` 等同的步驟。

## 文件索引

- `CLAUDE.md`
  - 給 Claude / AI 助手的進場守則、架構慣例、禁止事項
- `AGENTS.md`
  - 給 AI / 維護者的進場順序、改動守則、文件同步規則
- `docs/repository-guide.md`
  - 讀 repo 最快的導覽，說明每個資料夾與關鍵檔案負責什麼
- `docs/documentation-policy.md`
  - 明文規定什麼改動一定要同步更新文件
- `docs/environment.md`
  - 環境變數、本地資料位置、production 切換、重置流程
- `docs/contributing.md`
  - 工作流程、Conventional Commits、PR 檢查清單
- `docs/open-source-references.md`
  - 可參考的開源遊戲、UI 資源、架構工具與授權判斷
- `docs/game-design.md`
  - 目前玩法、系統規則、功能狀態
- `docs/changelog.md`
  - 每一輪實際改動紀錄
- `DECISIONS.md`
  - 重大技術 / 架構決策紀錄與背景
- `TODO.md`
  - 應該做但還沒做的事項

## 文件同步規則

只要有以下變更，就要在同一次提交補文件：

- 功能或規則改動：更新 `docs/game-design.md`
- 結構、資料流、關鍵入口改動：更新 `docs/repository-guide.md`
- 已完成的工作內容：更新 `docs/changelog.md`
- 啟動方式、環境需求、入口路徑改動：更新 `README.md`

如果程式改了但文件沒改，這個 repo 很快就會變得難以維護，也會讓 AI 判讀成本大幅上升。

## 目前主要資料位置

- 本地持久化：開發指令預設 `server/server/data/store.json`；部署時建議用 `GAME_DATA_DIR` 指到 persistent disk
- 前後端契約：`shared/events.ts`
- 後端主路由：`server/src/routes.ts`
- 戰鬥流程：`server/src/game.ts`
- 前端主畫面：`client/src/App.tsx`
- Supabase migration 草稿：`supabase/migrations/`
