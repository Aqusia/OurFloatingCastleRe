收尾這一輪改動，請依序執行：

1. 跑 `npm run build`，確認 client / admin-client / server 三個 workspace 都通過 TypeScript 型別檢查；若任一個失敗，先修到全綠再繼續。
2. 跑 `git status` 與 `git diff`，快速 review 一遍這輪改了什麼。
3. 依 `docs/documentation-policy.md` 的對照表判斷是否要更新：
   - `docs/game-design.md` (功能 / 規則 / 頁面行為)
   - `docs/repository-guide.md` (API / socket / 資料模型 / 結構 / 入口)
   - `docs/changelog.md` (本輪變更摘要，務必補)
   - `README.md` (啟動方式 / 環境變數 / 必要檔案)
4. 如果這次改動真的不需要更新文件，明確說明原因。
5. 提議一個 Conventional Commits 格式的 commit message (例如 `feat:`, `fix:`, `refactor:`, `docs:`)。
6. 最後給我簡短總結：改了哪些檔案、跑過哪些指令、文件同步狀態、剩餘 TODO/FIXME。
