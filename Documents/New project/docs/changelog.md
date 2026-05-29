# Changelog

## 2026-05-29

### 狀態、隊伍行動與數字限制

- 新增角色狀態顯示：閒暇中、訓練中、挖礦中、休息中、鍛造中、狩獵中。
- 調整組隊規則：玩家可在忙碌時建立或加入隊伍，但開始狩獵 / 進攻時必須由隊長發起，且全隊都要閒暇中。
- 攻城支援隊伍檢查與多參與者紀錄，隊伍成員會共同承受消耗。
- 移除「人在房間內不能加入行動隊列」的舊限制。
- 鍛造材料投入改成前端即時限制，不能超過持有數量或單次 16 個材料上限。
- 玩家市場上架數量改成不能超過持有數量。
- Admin 與獎勵相關數字輸入新增上下限，後端也會 clamp，避免離譜數值寫入。

### 相關檔案

- `client/src/App.tsx`
- `client/src/index.css`
- `server/src/game.ts`
- `server/src/routes.ts`
- `server/src/socketServer.ts`
- `server/src/persistence/localStore.ts`
- `docs/game-design.md`

## 2026-05-29

### 開源參考與 UI 小改

- 研究 browser RPG、idle RPG、多人遊戲、RPG UI 元件與架構工具的開源參考。
- 新增 `docs/open-source-references.md`，記錄可參考資源、license 與導入建議。
- 新增 `lucide-react`，先用 MIT icon library 改善側邊導覽與資源狀態資訊。
- 調整 `client/src/index.css`，讓整體更接近 RPG dashboard / HUD：更清楚的面板框線、內陰影、資源徽章、icon 導覽。
- 文件同步更新 `README.md`、`docs/repository-guide.md`、`docs/game-design.md`。

### 相關檔案

- `client/package.json`
- `client/src/App.tsx`
- `client/src/index.css`
- `docs/open-source-references.md`
- `README.md`
- `docs/repository-guide.md`
- `docs/game-design.md`

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
