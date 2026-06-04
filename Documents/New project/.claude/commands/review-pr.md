審查 PR #$ARGUMENTS。請用 `gh` CLI (若可用) 取得 diff 與 metadata，然後依本專案標準逐項檢查：

1. **正確性**：邏輯是否如 PR description 所述；邊界情況、null / 空陣列 / 失敗路徑有沒有處理。
2. **架構慣例**：是否符合 [CLAUDE.md](../../CLAUDE.md) 的規則；型別是否走 `shared/events.ts`；REST 是否走 `server/src/routes.ts`。
3. **安全性**：權限守門 (`server/src/auth.ts`)、admin-only 路由、SQL/JSON 注入、secrets 不外洩。
4. **效能**：是否有不必要的 socket broadcast、N+1 store 讀寫、過度的 React re-render。
5. **資料一致性**：對 `localStore` 的寫入是否在正規化流程內、是否處理舊資料補預設值。
6. **文件同步**：依 `docs/documentation-policy.md`，該動的 `docs/game-design.md` / `docs/repository-guide.md` / `docs/changelog.md` / `README.md` 有沒有動。
7. **測試 / 驗證**：作者有沒有實際跑過服務 (有截圖 / log 更佳)。

最後給總評：`approve` / `request changes` / `comment`，並列出三件最重要的事 (若有 blocker，標清楚)。
