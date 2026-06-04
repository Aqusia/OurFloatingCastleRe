# Decisions Log

紀錄重大技術 / 架構決策，避免「為何當初要這樣寫」的記憶遺失。

每筆條目包含：日期、決策、背景、考量過的替代方案、後續影響。改變決策時請新增一條，不要直接覆寫舊的。

---

## 2026-06-04 採用 monorepo + npm workspaces

**背景**：前端、管理後台、後端、共用型別需要協作；avoid 重複定義 + 型別漂移。

**決策**：用 npm workspaces，分 `client/`、`admin-client/`、`server/`、`shared/`。

**替代方案**：

- pnpm / yarn workspaces — 暫不引入新工具，npm 內建已足夠
- 把 shared 包成獨立 npm package — 過早抽象；目前 TS path 直引更輕量

**影響**：

- 啟動指令多走一層 `npm --workspace <name> run <script>`
- `Dockerfile` 與部署腳本要記得 copy 各 workspace 的 `package.json`

---

## 2026-06-04 本地 JSON 為主、Supabase 為次的持久化策略

**背景**：原型期需要快速迭代資料模型，正式資料庫 schema 還不穩。

**決策**：

- dev 預設用 `server/server/data/store.json` 單檔持久化 (見 `server/src/persistence/localStore.ts`)
- Supabase 連線程式碼保留 (`server/src/persistence/supabase.ts` + `supabase/migrations/`)，但未上線
- 切換點：環境變數 `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`

**替代方案**：

- 一開始就用 Supabase — schema 改動成本高，原型期不適合
- 用 SQLite — 多一層 driver；本地 JSON 對單機開發已夠用

**影響**：

- 所有資料操作集中在 `localStore.ts`；未來搬到 Supabase 時要寫遷移 + 對應 query 重構
- 部署到 persistent disk 時要設 `GAME_DATA_DIR`，不然容器重啟資料會掉

---

## 2026-06-04 共用型別放 `shared/events.ts` 單一檔

**背景**：REST payload、Socket event、Domain type 散在 client / server 容易漂移。

**決策**：所有跨 client/server 的型別**只**從 `shared/events.ts` 匯出，client 與 server 一律 import 同一份。

**替代方案**：

- 拆多檔 (events / domain / api 分開) — 等到 `shared/events.ts` 真的太大再拆，目前可控
- 用 OpenAPI / tRPC — 過度工程；原型期手寫 type 已夠快

**影響**：

- 改型別時要同步檢查 client 與 server 兩邊；CLAUDE.md / contributing.md 都已強調

---

## 2026-06-04 前端主畫面集中在 `client/src/App.tsx`

**背景**：原型期頁面多，但流程相近 (左側 nav + 右側切頁)。

**決策**：主畫面與大部分頁面邏輯集中在 `App.tsx`，登入畫面已抽成 `AuthScreen`，其他頁面暫不拆 component。

**替代方案**：

- 一開始就 file-per-page — 拆太早，state 同步成本高
- 引入 router (react-router) — 目前用 nav state 切頁已夠

**影響**：

- `App.tsx` 會逐漸變大，需要時再切；新增頁面時優先沿用既有 nav 結構
- 若未來引入 router，要同步更新 `docs/repository-guide.md` 與 `CLAUDE.md`

---

## 2026-06-04 ESLint flat config + Prettier，warnings 不阻擋 CI

**背景**：既有 codebase 沒有 lint，要加但又不想被現存的 `any` / unused vars 卡 CI。

**決策**：

- 用 ESLint 9 flat config (`eslint.config.mjs`)
- 啟用 `@eslint/js` recommended + `typescript-eslint` recommended (不用 strict) + React hooks
- 把 `no-explicit-any` / `no-unused-vars` 降為 warn
- `npm run lint` 不加 `--max-warnings=0`，僅在 errors 時 fail；warnings 留作清理 TODO
- Prettier 採預設加幾項：`printWidth: 120`、`trailingComma: none`、雙引號

**替代方案**：

- `typescript-eslint` strict — 對既有 codebase 太激進，會出上百 errors
- Biome 一套搞定 — 工具新、生態待觀察；現階段先用主流 ESLint + Prettier
- 一開始就要求 0 warnings — 開發體驗差，重構壓力大

**影響**：

- 新程式碼仍可帶進 `any` (warn) 但不會擋 PR；CI 只擋真正的 errors
- 待 TODO 清完 60 個 warnings 後可考慮升級到 `--max-warnings=0`

---

## 2026-06-04 Vitest 為測試框架，集中在 `server/tests/`

**背景**：要加測試但又不想拉太多依賴；server 端純函式優先測。

**決策**：

- 用 Vitest (與 Vite 同源，啟動快、設定少)
- 測試檔放 `server/tests/`，命名 `*.test.ts`
- 第一份測試 cover `server/src/combatEngine.ts` (純函式 + `Math.random` 可 mock)
- coverage 用 `@vitest/coverage-v8`，include 限在 `server/src/**` 與 `shared/**`

**替代方案**：

- Jest — 設定多、ESM 還要額外 transform；對 TS-first 專案 Vitest 更輕
- Node test runner — 內建但 API 較陽春，少了 `vi.spyOn` 等好用工具

**影響**：

- client 端測試以後可直接用同一份 vitest config (`environment: "jsdom"` 切換即可)
- `npm run test:coverage` 跑出來的報告會 include `server/src`，未來 client 加測試要擴 include

---

## 2026-06-04 Production 用 `tsx` 跑 TS source，不跑 compiled JS

**背景**：原本 `npm start` 用 `node --experimental-specifier-resolution=node server/dist/...`，但這個 flag 在 Node 20 被移除 (使用者跑 Node 24)；tsc 編出來的 JS import 沒帶 `.js` 副檔名，Node ESM 直接報 `ERR_MODULE_NOT_FOUND`。

**決策**：

- `npm start` 改成 `tsx server/src/index.ts`，在 production 直接跑 TS source
- `tsx` 加進根 devDeps (不只是 server workspace)
- `npm run build` 仍會跑，作為型別檢查與 client/admin-client 的 production bundling

**替代方案**：

- 在所有 server `import` 補 `.js` 副檔名 + 改 `moduleResolution: "NodeNext"` — 正規做法，但 ~30 個 import 要改，這次任務不擴 scope
- 用 esbuild / tsup 打包 server 成單一 bundle — 工具鏈再多一層，目前沒有 bundle 大小需求
- Pin Node 版本到 18 (有 `--experimental-specifier-resolution`) — 鎖舊版本只會更痛

**影響**：

- `server/dist/` 仍會被 build 產生，但 production 並未實際讀取；保留它純為型別檢查證明
- Cold start 多一點 esbuild 轉譯時間，但 server 是長駐 process，可忽略
- 若未來想擺脫 `tsx`，需依「替代方案 1」改 import 副檔名 + tsconfig；列入 TODO

---

## 範本：新增決策時複製這段

```markdown
## YYYY-MM-DD 決策標題 (祈使句或名詞片語)

**背景**：(為什麼需要做決策)

**決策**：(實際選了什麼)

**替代方案**：

- 方案 A — 為什麼沒選
- 方案 B — 為什麼沒選

**影響**：

- 程式 / 文件 / 流程上的後續影響
- 若要回頭改，會碰到哪些檔案
```
