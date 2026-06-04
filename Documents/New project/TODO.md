# TODO

本檔保存「應該做但還沒做」的事項，避免散落在對話 / commit message 裡。完成後直接刪除該行或移到 `docs/changelog.md`。

> 不取代 issue tracker；當需要協作 / 指派 / 討論時，請開正式 issue。

## High priority

- [ ] 處理現有 60 個 lint warnings (大多是 `any` 與 unused vars)，集中於 `client/src/App.tsx`、`server/src/persistence/localStore.ts`、`server/src/utils.ts`、`admin-client/src/main.tsx`；逐檔清掉後可考慮把 `npm run lint` 加回 `--max-warnings=0`
- [ ] 擴充 vitest 測試覆蓋：`server/src/persistence/localStore.ts` 的隊列推進 / 戰鬥結算 / 攻城戰回合、`server/src/auth.ts` 的登入授權
- [ ] (可選) 把 `server/src` 改成 ESM 規範的 `.js` 副檔名 import，並把 `npm start` 換回 `node server/dist/...`；目前用 `tsx` 在 production 跑 TS source，是務實但非典型的妥協

## Medium priority

- [ ] `client/src/App.tsx` 已偏大，考慮把幾個切頁 (戰鬥、揹包、陣營、商店) 抽成獨立 component
- [ ] `server/src/persistence/localStore.ts` 內的正規化邏輯越來越多，考慮抽成 `normalize/` 子模組
- [ ] Supabase migration 與本地 store 的 schema 對齊；目前兩邊獨立演化
- [ ] 把 `.env.local` 加入 `.gitignore` (目前只擋 `node_modules` 等)

## Nice to have

- [ ] 加 pre-commit hook (`.husky/`) 或 `.claude/settings.json` 內的 PostToolUse hook 自動跑型別檢查
- [ ] 補 `docs/api-reference.md` 自動產生機制 (從 `server/src/routes.ts` 抽 endpoints)
- [ ] 補 Socket event 一覽 (從 `shared/events.ts` 抽，方便前端對接)
- [ ] 在 CI 加 build cache (npm cache 已啟用，但可以再加 `dist/` 與 `tsbuildinfo` 的 actions/cache)

## 已知問題 / 風險

- `server/server/data/store.json` 沒有 backup 機制；本地誤刪即失資料
- 沒有 rate limit / brute-force 防護，登入 endpoint 暴露在公網時要注意
- 沒有正式 logging；目前都靠 `console.log`，部署後不易追問題
