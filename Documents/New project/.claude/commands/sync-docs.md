依本輪程式改動同步更新文件。

1. 跑 `git diff --name-only` 與 `git status`，列出本輪改了哪些檔案。
2. 對照 `docs/documentation-policy.md` 的規則判斷：
   - 改到 `client/`、`server/src/game.ts`、玩法邏輯、規則、頁面 → 更新 `docs/game-design.md`
   - 改到 `shared/events.ts`、`server/src/routes.ts`、socket、資料結構、入口檔 → 更新 `docs/repository-guide.md`
   - 改到 `package.json`、`.env.example`、`Dockerfile`、啟動腳本 → 更新 `README.md` (與 `docs/environment.md` 如果存在)
   - 一律補一筆到 `docs/changelog.md` (用今天日期當 section)
3. `docs/changelog.md` 的格式：頂部新增 `## YYYY-MM-DD` 區塊 + `### 標題` + bullet 列表 + 「相關檔案」清單。
4. 更新完文件後跑 `git diff docs/` 自我 review 一次，確認沒打錯日期或路徑。
5. 最後報告：更新了哪幾份文件、各自加了什麼、有沒有跳過的 (有的話講原因)。
