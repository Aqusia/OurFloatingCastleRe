# 專案說明 (Claude / AI 維護指南)

這是一個多人養成 + 自動討伐網頁原型，採 `client` / `admin-client` / `server` / `shared` 的 monorepo 分層。詳細介紹與啟動方式請先讀 [README.md](README.md)、[AGENTS.md](AGENTS.md) 與 [docs/repository-guide.md](docs/repository-guide.md)。

> Claude 與 AI 助手：每次新 session 開始時請先讀本檔，再依需要打開 `docs/` 內對應文件。

## 技術棧

- 前端 (`client/`)：React 18 + TypeScript + Vite 5
- 管理後台 (`admin-client/`)：React 18 + TypeScript + Vite 5
- 後端 (`server/`)：Node 20 + Express 4 + Socket.IO 4 + TypeScript (tsx watch)
- 共用 (`shared/`)：TypeScript 型別與事件契約
- 持久化：預設本地 JSON (`server/server/data/store.json`)；Supabase 為未來方向
- 部署：單一 Node 服務同時提供前端靜態檔 + REST + Socket.IO；Docker 也可

## 常用指令 (在 `Documents/New project/` 內執行)

| 用途               | 指令                                                            |
| ------------------ | --------------------------------------------------------------- |
| 安裝所有 workspace | `npm install`                                                   |
| 啟動後端 (dev)     | `npm --workspace server run dev`                                |
| 啟動主前端 (dev)   | `npm --workspace client run dev`                                |
| 啟動管理後台 (dev) | `npm run dev:admin`                                             |
| Lint               | `npm run lint` (warnings 不阻擋) / `npm run lint:fix`           |
| Format             | `npm run format` / `npm run format:check`                       |
| Typecheck          | `npm run typecheck`                                             |
| Test               | `npm run test` / `npm run test:watch` / `npm run test:coverage` |
| 全套 CI 檢查       | `npm run ci`                                                    |
| 建置 (全部)        | `npm run build`                                                 |
| 啟動 production    | `npm start` (透過 `tsx` 跑 server source)                       |

預設網址：

- 主前端：<http://127.0.0.1:5173>
- 管理後台：<http://127.0.0.1:5174>
- 後端健康檢查：<http://127.0.0.1:3001/api/health>

CI 設定在 repo root 的 `.github/workflows/ci.yml` (注意 git repo root 在 `D:\OurFloatingCastle\`，不是 `Documents/New project/`)。Commit 前的最低門檻是 `npm run ci` 通過。

## 架構慣例

- 一律使用 TypeScript，盡量避免 `any`
- 共用型別、REST payload、Socket event 一律放 `shared/events.ts`
- 後端 REST 入口統一在 `server/src/routes.ts`，業務邏輯放在 `server/src/persistence/localStore.ts` 與 `server/src/game.ts`
- 戰鬥特殊事件判定共用 `server/src/combatEngine.ts`
- 前端 HTTP 呼叫集中在 `client/src/lib/api.ts`，Socket 連線在 `client/src/lib/socket.ts`
- React component 檔名使用 `PascalCase`；其他模組以 `camelCase` 為主
- 文件檔名使用 `kebab-case`；`README.md`、`AGENTS.md`、`CLAUDE.md` 等慣例檔保留大寫
- 主畫面與大部分頁面邏輯目前集中在 `client/src/App.tsx`，新增頁面時優先沿用既有 nav 與切頁結構

## 高影響區檔案 (改動後幾乎都要同步更新文件)

- `client/src/App.tsx`
- `server/src/routes.ts`
- `server/src/game.ts`
- `server/src/persistence/localStore.ts`
- `server/src/combatEngine.ts`
- `shared/events.ts`
- `admin-client/src/main.tsx`

## 絕對不要

- 不要在沒討論的情況下新增第三方套件 (尤其影響打包體積或授權的)
- 不要把 secrets / token commit 進 repo；環境變數請參考 `.env.example`
- 不要直接修改 `server/server/data/store.json` 線上資料；若要重置請刪檔重啟
- 不要繞過 `shared/events.ts` 直接在 client / server 各自重複定義型別
- 不要在程式改動時略過文件同步 (詳見 [docs/documentation-policy.md](docs/documentation-policy.md))
- 不要使用 `// @ts-ignore` 或 `as any` 規避型別錯誤，除非加註說明原因
- 不要直接改 `supabase/migrations/` 內已存在的 migration，需要修正時新增一份新的

## 文件同步規則 (摘要)

只要有以下變更，**同一次提交**就要補文件：

| 變更類型                     | 必須更新                                         |
| ---------------------------- | ------------------------------------------------ |
| 功能、規則、頁面行為         | `docs/game-design.md` + `docs/changelog.md`      |
| API、socket 事件、資料模型   | `docs/repository-guide.md` + `docs/changelog.md` |
| 結構、入口、模組職責         | `docs/repository-guide.md`                       |
| 啟動方式、環境變數、必要檔案 | `README.md` + `docs/changelog.md`                |

詳細規則見 [docs/documentation-policy.md](docs/documentation-policy.md)。

## 給 AI 的工作流提示

1. 接到任務時先讀 `AGENTS.md` → `docs/repository-guide.md` 找入口檔
2. 複雜或跨檔改動先用 Plan Mode (Shift+Tab) 規劃再動工
3. 改完後在最終回覆**明列**：改了哪些檔案、跑過哪些指令、文件是否同步
4. 若這次改動真的不需更新文件，請主動說明原因
5. 不確定改動範圍時，優先在 `docs/changelog.md` 留下一筆當輪紀錄

## 進場閱讀順序

1. [README.md](README.md)
2. [AGENTS.md](AGENTS.md)
3. [docs/repository-guide.md](docs/repository-guide.md)
4. [docs/documentation-policy.md](docs/documentation-policy.md)
5. [docs/game-design.md](docs/game-design.md)
6. [docs/changelog.md](docs/changelog.md)
7. [docs/environment.md](docs/environment.md) — 環境變數與本地資料位置
8. [docs/contributing.md](docs/contributing.md) — 提交流程、commit 規範
9. [DECISIONS.md](DECISIONS.md) — 重大技術決策紀錄
