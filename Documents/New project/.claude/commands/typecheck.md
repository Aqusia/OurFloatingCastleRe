跑全專案的 TypeScript 型別檢查，並修復任何錯誤。

1. 在專案根目錄跑 `npm run build`，這會依序建置 `client`、`admin-client`、`server`。
2. 如果有錯，按 workspace 分組逐一處理：
   - `client` / `admin-client` 走 `tsc -b && vite build`
   - `server` 走 `tsc -p tsconfig.json`
3. 修正型別錯誤時：
   - 優先讓 `shared/events.ts` 維持單一真實來源，不要在 client / server 各自重複定義
   - 避免使用 `as any` 或 `// @ts-ignore`；若不得已，要加註說明
4. 全部過了再跑一次 `npm run build` 確認乾淨。
5. 最後列出每個 workspace 的狀態 (pass / fail + 修了什麼)。
