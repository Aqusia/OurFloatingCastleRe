# Environment & 本地資料

本檔說明本專案需要的環境變數、本地資料位置與常見組態切換。範本見 `.env.example`。

## 環境變數一覽

### 後端 (`server/`)

| 變數                        | 必要?                | 用途                                                | 預設                               |
| --------------------------- | -------------------- | --------------------------------------------------- | ---------------------------------- |
| `NODE_ENV`                  | 部署時               | `production` 時 Express 會回傳 `client/dist` 靜態檔 | 未設 (dev)                         |
| `PORT`                      | 否                   | 後端監聽 port                                       | `3001`                             |
| `GAME_DATA_DIR`             | 部署時建議           | 本地 JSON 儲存目錄，部署請指到 persistent disk      | `server/server/data/` (相對於 cwd) |
| `SUPABASE_URL`              | 啟用 Supabase 才需要 | Supabase 專案 URL                                   | 未設                               |
| `SUPABASE_SERVICE_ROLE_KEY` | 啟用 Supabase 才需要 | Supabase service role key (server-only)             | 未設                               |

> 沒設 Supabase 變數時，`server/src/persistence/supabase.ts` 內的 `isSupabaseEnabled()` 會回傳 `false`，全站走本地 JSON 持久化。

### 前端 (`client/` 與 `admin-client/`)

Vite 透過 `import.meta.env.VITE_*` 注入 (build time)。

| 變數                     | 必要? | 用途                                    | 預設 (fallback)                                                  |
| ------------------------ | ----- | --------------------------------------- | ---------------------------------------------------------------- |
| `VITE_API_URL`           | 否    | REST API base URL                       | dev 時 `http://localhost:3001`；prod 時 `window.location.origin` |
| `VITE_SOCKET_URL`        | 否    | Socket.IO base URL                      | 同上                                                             |
| `VITE_SUPABASE_URL`      | 預留  | Supabase 專案 URL (給未來客戶端 SDK 用) | 未設                                                             |
| `VITE_SUPABASE_ANON_KEY` | 預留  | Supabase anon key                       | 未設                                                             |

> 同源部署 (production 單一 Node 服務) 時，前端不用設 `VITE_API_URL` / `VITE_SOCKET_URL`，會自動沿用 `window.location.origin`。

## 本機一鍵啟動

Windows 開發可從專案根目錄執行：

```powershell
.\start-game.bat
```

此啟動器會開三個命令視窗：`server` API、`client` 主遊戲與 `admin-client` 管理後台。舊的 `啟動遊戲.bat` 仍可執行，但只會轉接到英文檔名的 `start-game.bat`。

## 本地資料位置

| 路徑                            | 內容                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| `server/server/data/store.json` | 角色、背包、公告、陣營、城池、市場、簽到、管理參數的本地持久化檔；server dev 啟動時自動生成 |
| `client/src/assets/`            | 前端視覺素材；第三方素材需在 `client/src/assets/asset-sources.md` 紀錄來源與授權            |
| `supabase/migrations/`          | Supabase schema / migration 草稿；目前尚未進入正式 pipeline                                 |

## 切換到 production 模式

1. 在根目錄跑 `npm run build`，產生 `client/dist`、`admin-client/dist`、`server/dist`
2. 設定 `NODE_ENV=production`，並視需要設 `PORT`、`GAME_DATA_DIR`
3. `npm start` 會透過 `tsx` 執行 `server/src/index.ts`，單一 port 同時提供前端 + REST + Socket.IO
4. Docker 部署可直接用根目錄的 `Dockerfile`

## 重置本地資料

開發過程中若想清空角色 / 房間 / 市場資料：

```powershell
Remove-Item "server\server\data\store.json"
```

接著重啟 `npm --workspace server run dev`，server 會以預設值重新生成 store。

## 安全提醒

- 不要 commit `.env` / `.env.local`；本 repo 的 `.gitignore` 並未明列這些檔，請在本機自行小心
- `SUPABASE_SERVICE_ROLE_KEY` 僅限後端使用，絕對不要讓它出現在 `client/` 或 `admin-client/`
- `store.json` 含使用者帳號密碼雜湊 (本機 dev) 與遊戲狀態；分享 repo 時請排除或重置
