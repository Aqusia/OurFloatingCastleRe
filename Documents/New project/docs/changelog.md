# Changelog

## 2026-05-29

### 這一輪調整

- 整理文件檔名，將內部文件統一為較清楚的 `kebab-case`
- 新增 `AGENTS.md`，明確規定 AI / 維護者的閱讀順序與文件同步責任
- 新增 `docs/repository-guide.md`，讓新接手的人或 AI 能快速理解結構與資料流
- 新增 `docs/documentation-policy.md`，把「改程式就要同步改文件」寫成明文規則
- 重寫 `README.md`，補上文件入口、專案地圖與文件更新規則
- 重整 `docs/game-design.md`，讓內容更聚焦於目前已實作的真實狀態

### 相關檔案

- `README.md`
- `AGENTS.md`
- `docs/repository-guide.md`
- `docs/documentation-policy.md`
- `docs/game-design.md`
- `docs/changelog.md`

## 2026-05-27

### 這一輪調整

- 詳情彈窗改成固定置中顯示，並在開啟時鎖定背景捲動。
- 揹包與裝備改成單欄列表，穿戴中的裝備固定顯示在上方。
- 裝備群組新增收合邏輯，主武器群組可預設收起。
- 同群組物品新增拖動排序，順序會寫回後端保存。
- 角色頁把公告移到最上方，等級顯示改成較精簡的 `等級 Lv.X`。
- 商店與玩家市場新增分類篩選，玩家市場可搜尋販賣者名稱。
- Admin 新增可設定每日獎勵與突發活動的時間與內容。
- Admin 新增自訂武器發送與多資源發送。
- 每日獎勵與突發活動設定已改成存進本地資料，不只存在記憶體。

### 相關檔案

- `client/src/App.tsx`
- `client/src/index.css`
- `client/src/lib/api.ts`
- `server/src/routes.ts`
- `server/src/persistence/localStore.ts`
- `shared/events.ts`
