# Contributing

本檔說明貢獻流程、commit 規範與 PR 檢查清單。Claude / AI 助手與人類維護者皆適用。

## 工作流程概觀

1. 開新 branch (建議 `feature/...`、`fix/...`、`docs/...`、`refactor/...`)
2. 動工前先讀 `AGENTS.md` → `docs/repository-guide.md`，必要時用 Plan Mode 規劃
3. 改完跑 `npm run build` 確認三個 workspace 都通過型別檢查
4. 依 `docs/documentation-policy.md` 同步更新文件
5. 在 `docs/changelog.md` 補一筆當輪紀錄
6. 開 PR (或請 reviewer 看 diff)，等 review 後 merge

## Commit 規範

採 **Conventional Commits**：

```
<type>(<scope>): <subject>

<body — optional>
```

常用 `type`：

- `feat:` 新功能
- `fix:` Bug 修復
- `refactor:` 不改行為的重構
- `docs:` 文件 only
- `chore:` 設定 / 工具 / 依賴
- `perf:` 效能
- `style:` 格式 / 排版 (不改邏輯)
- `test:` 測試

建議：

- subject 用祈使句、≤ 70 字
- 一個 commit 一件事；功能 + 文件可以同一 commit (鼓勵)
- 大改動建議在 body 列出影響範圍

範例：

```
feat(siege): 加入持久化攻城戰與駐防上限

- 攻城從一次性結算改為依時間推進結算
- 城池新增 garrison 上限與抗性
- 補上 docs/game-design.md 與 docs/changelog.md
```

## PR / Review 檢查清單

提交前 (或審查時) 確認：

- [ ] `npm run build` 通過 (三個 workspace 都過)
- [ ] 新功能 / 規則改動寫入 `docs/game-design.md`
- [ ] API / socket / 資料結構改動寫入 `docs/repository-guide.md`
- [ ] 本輪變更寫入 `docs/changelog.md` (含日期 + 標題 + 相關檔案)
- [ ] 啟動 / 環境變動寫入 `README.md` 與 `docs/environment.md`
- [ ] `shared/events.ts` 是唯一型別來源，沒有在 client / server 重複定義
- [ ] 沒有把 secrets / store.json 真實資料 commit 進去
- [ ] 沒有未經討論的新依賴 (`package.json` diff 乾淨或有解釋)
- [ ] 高影響檔案 (`client/src/App.tsx`、`server/src/routes.ts`、`server/src/persistence/localStore.ts`、`shared/events.ts`、`server/src/game.ts`) 變動，文件都已對齊

## 不確定時的指南

- **規格不清** → 先在 PR description / issue 內描述需求與權衡，再動工
- **多解法擇一** → 把替代方案寫進 `DECISIONS.md`，記錄為何選 A 不選 B
- **跨檔案大重構** → 先更新 `docs/repository-guide.md` 描述新結構，再改 code
- **舊資料相容** → 在 `localStore` 正規化階段補預設值，不要直接破壞舊欄位

## 安全的破壞性操作

下列操作會造成資料遺失或無法回復，**改完務必先確認再做**：

- 刪除或重置 `server/server/data/store.json`
- 修改 `supabase/migrations/` 已存在的 migration (應新增一份新的)
- `git reset --hard`、`git push --force`、`git clean -fd`
- 移除 workspace、刪除 shared type、把功能直接從 `client/src/App.tsx` 整段刪掉

Claude 工作流預設不會主動跑這些指令，需明確授權。
