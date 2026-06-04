啟動本地開發環境並驗證三個服務都正常。

1. 確認在 `Documents/New project/` 目錄下。
2. 若 `node_modules/` 不存在，先跑 `npm install`。
3. 平行啟動三個服務 (用背景模式 / 三個 terminal)：
   - 後端：`npm --workspace server run dev`
   - 主前端：`npm --workspace client run dev`
   - 管理後台：`npm run dev:admin`
4. 驗證：
   - `curl http://localhost:3001/api/health` 應回 `{"ok":true}`
   - <http://localhost:5173/> 應回 HTTP 200 (主前端)
   - <http://localhost:5174/> 應回 HTTP 200 (管理後台)
5. 若任一服務失敗，讀對應的 log 找原因；常見問題：
   - 連 Vite 抱怨 lockfile 變動 → 正常，會自動 re-optimize
   - 連 server 不起來 → 看是否 port 3001 被佔用
   - 資料相關錯誤 → 檢查 `server/server/data/store.json` 是否損壞
6. 最後回報三個服務的網址與健康狀態。
