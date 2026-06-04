# Changelog

## 2026-06-04

### 工程基建：Lint / Test / CI / Docker / Prod start

- 新增根目錄 ESLint flat config (`eslint.config.mjs`) + Prettier 設定，三個 workspace 共用
- 新增 Vitest，補上 `server/tests/combatEngine.test.ts` (11 個測試，覆蓋 lucky_crit / technique_combo / armor_break / ally_support / danger_dodge / boss_counter)
- 新增 `.github/workflows/ci.yml`，PR / push 跑 lint + typecheck + test + build
- 修正 `Dockerfile`：補 `admin-client/package.json` 的 COPY，`npm ci` 加 `--workspaces --include-workspace-root`，避免漏 workspace
- 補 `.dockerignore` 排除 `admin-client/node_modules`、`*.tsbuildinfo`、`server/server/data`
- 修正 `npm start`：原本依賴 Node 19- 才存在的 `--experimental-specifier-resolution=node` flag (Node 20+ 已移除)，改用 `tsx server/src/index.ts` 在 production 也直接跑 TS source
- 新增根 scripts：`lint`、`lint:fix`、`format`、`format:check`、`test`、`test:watch`、`test:coverage`、`typecheck`、`ci`
- 將 `tsx` 從 server workspace 提升為根 devDep，避免 hoisting 假設
- 既有程式碼共 60 個 lint warnings (`any` + unused vars)，集中於 `App.tsx` / `localStore.ts` / `utils.ts` / `admin-client/main.tsx`；目前不阻擋 CI，列為 TODO

### 相關檔案

- `package.json`
- `eslint.config.mjs`
- `.prettierrc.json`
- `.prettierignore`
- `vitest.config.ts`
- `server/tests/combatEngine.test.ts`
- `.github/workflows/ci.yml`
- `Dockerfile`
- `.dockerignore`
- `README.md`
- `docs/environment.md`
- `docs/contributing.md`
- `DECISIONS.md`
- `TODO.md`
- `CLAUDE.md`

## 2026-06-01

### 攻城戰 v2

- 攻城從一次性結算改為持久化攻城戰，支援發起、加入與依時間推進結算。
- 新增城池駐防，玩家可在目前所在的我方城池駐防，駐防期間視為忙碌並可離線參與防守。
- 城池新增地形優勢、自動防禦、駐防上限與攻城抗性；城防歸零才會易主。
- 新增 `siegeRules` 與 `statRules`，Admin 可用表單調整攻城規則與 8 屬性係數。
- 前端城池詳情新增駐防、退出駐防、攻城戰狀態、加入戰場與更新戰況操作。

### 相關檔案

- `shared/events.ts`
- `server/src/utils.ts`
- `server/src/persistence/localStore.ts`
- `server/src/routes.ts`
- `client/src/lib/api.ts`
- `client/src/App.tsx`
- `admin-client/src/main.tsx`
- `docs/game-design.md`
- `docs/repository-guide.md`
- `docs/changelog.md`

## 2026-06-01

### Admin 參數表單化

- 將 `admin-client` 的 JSON textarea 改成 schema-driven 參數表單，admin 可直接用輸入框、select、toggle、多選與時間欄位調整設定。
- 新增列表增刪介面，支援技能、副角色、商品、鍛造配方、城池、陣營與公告等資料列擴充。
- 擴充可調參數：技能觸發率 / 冷卻 / 段數 / stat bonus、副角色技能與裝備偏好、活動贈品、城池 Boss / 報酬、陣營外交 / 公庫 / 塔進度、商店與鍛造裝備數值。

### 相關檔案

- `admin-client/src/main.tsx`
- `admin-client/src/style.css`
- `docs/game-design.md`
- `docs/repository-guide.md`
- `docs/changelog.md`

## 2026-06-01

### 戰報修復與三類戰鬥

- 新增三種明確戰鬥類型：探險、公會 Boss、世界 Boss 競賽。
- 探險改為即時多步結算，單場會產生 3-6 步事件與逐行戰報。
- 公會 Boss 改用清楚的入口與戰報語意，保留舊 tower endpoint 作相容 alias。
- 新增世界 Boss 狀態與挑戰 API，每個公會挑戰滿血 Boss，第一個勝利公會取得主要資源。
- 新戰報改用正常中文逐行保存，並修正攻城、戰鬥通知、回合數計算等亂碼來源。
- 前端戰報詳情只顯示一次舊版亂碼資料提示，不再每行重複洗版。

### 相關檔案

- `shared/events.ts`
- `server/src/persistence/localStore.ts`
- `server/src/routes.ts`
- `server/src/utils.ts`
- `client/src/lib/api.ts`
- `client/src/App.tsx`
- `docs/game-design.md`
- `docs/repository-guide.md`
- `docs/changelog.md`

## 2026-06-01

### 獨立管理後台與技能演出

- 主遊戲移除可見的 Admin 導覽入口，玩家流程不再混入管理頁。
- 新增 `admin-client` 獨立 Vite 前端，預設使用 [http://127.0.0.1:5174](http://127.0.0.1:5174)，登入後只允許 admin 帳號讀取參數。
- 新增 `/admin/config`、`/admin/config/:section`、`/admin/config/:section/reset`，可分分類讀取、儲存與還原遊戲參數。
- 新增 `gameConfig` 本地資料層，技能、次要角色、個人戰鬥難度、商店與鍛造配方支援 store override 與舊資料預設補齊。
- 角色技能 log 改為多段演出；桐人「星爆氣流斬」會顯示 16 hit 分段傷害與終結斬總傷害，其他次要角色技能也會用多段 log 呈現。

### 相關檔案

- `package.json`
- `admin-client/`
- `shared/events.ts`
- `server/src/utils.ts`
- `server/src/routes.ts`
- `server/src/persistence/localStore.ts`
- `client/src/App.tsx`
- `client/src/index.css`
- `README.md`
- `docs/game-design.md`
- `docs/repository-guide.md`
- `docs/changelog.md`

## 2026-05-31

### 城池操作與角色技能顯示修正

- 移除目前所在城池的「城內移動」操作，避免玩家誤以為需要在同一城池內移動。
- 陣營地圖正中心新增「場景挑戰」入口，點擊後切到戰鬥頁。
- 次要角色技能冷卻改為單場戰鬥內使用，避免下一場短戰鬥被舊冷卻擋掉。
- 提高次要角色技能觸發率，並在 log 前加上「【角色技能】」讓自動施放更明顯。

### 相關檔案

- `client/src/App.tsx`
- `client/src/index.css`
- `server/src/game.ts`
- `server/src/persistence/localStore.ts`
- `server/src/utils.ts`
- `docs/game-design.md`
- `docs/changelog.md`

## 2026-05-31

### 戰報亂碼修正

- 修正個人 / 公會即時戰報中 Boss 攻擊、特殊事件摘要與戰鬥結果訊息的破損中文。
- 戰鬥紀錄畫面新增舊資料清理：已經存壞的歷史 log 會顯示可讀提示，不再直接顯示亂碼。

### 相關檔案

- `client/src/App.tsx`
- `server/src/persistence/localStore.ts`
- `docs/changelog.md`

## 2026-05-31

### 次要角色自動技能與職業熟練度

- 次要角色技能改為裝備後在戰鬥中自動判定施放，battle log 與 specialEvents 會顯示角色、技能與效果。
- 次要角色卡新增等級、經驗、解鎖技能、最後觸發技能與冷卻狀態；戰鬥後會自動取得經驗並在 Lv.3 / Lv.5 解鎖更多技能。
- 次要角色加成改吃角色等級、主職業適配性與偏好裝備，角色頁會顯示適配職業、偏好裝備、經驗條與自動技能清單。
- 主職業新增獨立職業熟練度，切換職業仍可行，但戰力與主職業成長會依各職業自己的等級與經驗計算。
- `specialSkillSlot` 保留相容舊資料，但 UI 不再把次要角色技能當成必須手動選擇的主要操作。

### 相關檔案

- `shared/events.ts`
- `server/src/utils.ts`
- `server/src/game.ts`
- `server/src/persistence/localStore.ts`
- `client/src/App.tsx`
- `docs/game-design.md`
- `docs/repository-guide.md`
- `docs/changelog.md`

## 2026-05-30

### 城池戰略地圖風格修正

- 陣營地圖由 5 欄層次 board 改為三國策略遊戲風格的城池戰略圖，使用地貌底圖、道路線、區域標籤與城池旗標呈現。
- 地圖底圖新增 public domain 羊皮紙紋理資產，讓畫面更接近古戰略沙盤。
- 地圖改為所有陣營共用同一張城池圖，新增勢力色塊領土；城池節點只保留地圖標記，點選後才在右側面板顯示詳情與操作。
- 移動改為忙碌狀態：移動中不能再加入訓練、挖礦、鍛造、戰鬥、攻城、建設、修建或協助工程。
- 移動狀態補上出發地、目的地與抵達時間；地圖節點會標記目前位置與目的地。
- 目前所在城池也能發起 10 分鐘城內移動，並套用同樣的忙碌限制。
- 城池地圖新增縮放控制與可捲動 canvas；地圖上改用小型城池圖示，只對首都、目前位置、目的地與選中城池顯示標籤，避免資訊卡互相重疊。
- 城池節點保留移動、攻城、建設、修建與公會爬層 Boss 操作，但版面從卡片列表改為地圖座標散佈。

### 視覺化地圖與戰鬥入口重整

- 陣營地圖改成視覺化 2D 地圖呈現，加入地形底圖、節點標記與層次連線，不再只是直欄卡片列表。
- 陣營頁移除野外刷怪與公會一般戰鬥入口，只保留城池、移動、建設、修建、攻城 Boss 與公會爬塔 Boss。
- 戰鬥頁新增場景挑戰區，個人刷怪與公會一般戰鬥都移到戰鬥頁，並可依不同城池場景挑戰。
- 個人戰鬥、公會一般戰鬥、公會爬塔 Boss 與攻城 Boss 結束後會切到戰鬥頁並直接開啟戰鬥紀錄。

### 相關檔案

- `client/src/App.tsx`
- `client/src/index.css`
- `docs/game-design.md`
- `docs/changelog.md`

## 2026-05-30

### 戰鬥可讀性與地圖節點回饋

- 陣營地圖節點新增用途標籤，和既有特性標籤一起顯示，讓核心、採集、野外戰鬥、公會 Boss、礦脈與商路更清楚。
- 個人戰鬥難度選擇會顯示風險與預估金幣、戰鬥經驗、材料收益。
- 公會爬層入口新增進度條與當層 Boss HP 摘要。
- 即時戰鬥 log 與詳細戰報會依特殊事件、Boss 攻勢、獎勵 / 勝利結果做視覺標示。
- 個人戰鬥與公會戰鬥結算戰報新增特殊事件統計摘要。

### 相關檔案

- `client/src/App.tsx`
- `client/src/index.css`
- `server/src/persistence/localStore.ts`
- `docs/game-design.md`
- `docs/changelog.md`

## 2026-05-30

### 戰鬥、地圖與公會爬層

- 戰鬥 overlay 改成可手動收起，戰鬥仍在背景同步，結束後不會再強制蓋住畫面。
- 新增共用戰鬥特殊事件：幸運暴擊、技巧連擊、精準破防、隊友支援、危急閃避、Boss 反制。
- `BattleTickEvent` 新增 `specialEvents`，即時戰鬥與戰報都會保留特殊事件文字。
- 新增個人戰鬥 API `/api/battles/solo/start`，支援簡單、普通、困難、菁英難度。
- 新增公會爬層 API `/api/factions/battles/tower/start`，外層二可打一般公會戰鬥或挑戰爬層 Boss。
- 陣營地圖節點新增用途與層級功能說明：核心、採集、Boss、礦脈、商路。

### 相關檔案

- `client/src/App.tsx`
- `client/src/lib/api.ts`
- `server/src/combatEngine.ts`
- `server/src/game.ts`
- `server/src/routes.ts`
- `server/src/persistence/localStore.ts`
- `server/src/utils.ts`
- `shared/events.ts`
- `docs/game-design.md`
- `docs/repository-guide.md`
- `docs/changelog.md`

## 2026-05-30

### 陣營隊列與公庫科技修正

- 舊資料載入時會過濾掉 `travel`、`build_facility`、`repair_castle` 等非個人行動，避免移動 / 建設 / 修建殘留在個人行動隊列。
- 移動維持角色 `movement` 狀態；建設 / 修建維持陣營工程 `factionProjects`，不再用「排入建設」文案。
- 陣營地圖改為真正的 5 欄層次地圖 board，每欄代表核心 / 外層一到外層四，城池以節點與連線呈現。
- 每日 / 突發獎勵領取後，前端會立即刷新公告列表，讓獎勵公告直接出現在消息。
- 公庫移除前端發放流程與素材欄位，改為消耗公庫金幣升級公會科技。
- 新增公會科技升級 API：城堡、防禦、攻擊、支援、進攻速度。
- 公會科技已影響建設花費 / 工程時間、修建量、防守損耗、攻城戰力與移動時間。

### 相關檔案

- `client/src/App.tsx`
- `client/src/lib/api.ts`
- `server/src/routes.ts`
- `server/src/persistence/localStore.ts`
- `shared/events.ts`
- `docs/game-design.md`
- `docs/repository-guide.md`
- `docs/changelog.md`

## 2026-05-29

### 登入分離與陣營層次

- 將登入 / 建立角色畫面抽成獨立 `AuthScreen`，主遊戲畫面不再和登入表單混在同一段 render。
- 角色資料新增目前所在據點 `currentCastleId`。
- 城池資料新增層次、距核心距離、特性、建設槽與設施列表。
- 新增據點移動 API；移動改為角色 `movement` 狀態，不再放進個人行動隊列。
- 新增陣營工程：建設設施、修建 / 防守城防、加入工程、退出工程。
- 建設與修建會消耗陣營公庫；所有人退出工程時會取消並退回公庫成本。
- 公庫發放改為全員平均發放，不能指定發給單一角色。
- 陣營地圖改成 5 欄層次地圖，顯示核心據點與外層一到四、目前位置、Boss 技能與獎勵。
- 每日 / 突發獎勵領取後，會把獎勵內容寫入公告。
- 攻城 Boss 追加技能與獎勵摘要，勝利時參與者也會拿到個人金幣與素材。
- 角色頁屬性標題改為「8 個屬性」，不再寫「七屬性 + 韌性」。
- 文件同步更新陣營層次與 8 屬性規則。

### 相關檔案

- `client/src/App.tsx`
- `client/src/lib/api.ts`
- `server/src/routes.ts`
- `server/src/utils.ts`
- `server/src/persistence/localStore.ts`
- `shared/events.ts`
- `docs/game-design.md`
- `docs/changelog.md`

## 2026-05-29

### 部署準備

- 新增 production 單一服務部署：Express 在 `NODE_ENV=production` 時提供 `client/dist`。
- 後端 port 改為讀取 `PORT`，保留本地預設 `3001`。
- 前端 API / Socket 預設改為 dev 連 `localhost:3001`，production 連同 origin。
- 本地 JSON store 支援 `GAME_DATA_DIR`，方便部署平台掛 persistent disk。
- 新增 `Dockerfile` 與 `.dockerignore`。
- 更新 README 與 repository guide 的部署說明。

### 相關檔案

- `package.json`
- `Dockerfile`
- `.dockerignore`
- `client/src/lib/api.ts`
- `client/src/lib/socket.ts`
- `server/src/index.ts`
- `server/src/persistence/localStore.ts`
- `README.md`
- `docs/repository-guide.md`

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
## 2026-05-31

### 角色定位、技能槽、秘籍與成就

- 保留主定位系統並新增刺客；補師顯示名稱取代原祭司顯示。
- 新增 3 格次要角色卡，可選桐人、亞絲娜、漩渦鳴人、五條悟、林克，提供數值加成、專屬武器概念與技能解鎖。
- 新增特殊技能槽，技能可由主定位、次要角色或秘籍解鎖。
- 秘籍改為學會後永久解鎖，並限制最多 3 本同時裝備 Buff。
- 新增成就頁與「升到 5 等」樣板成就。

### 變更檔案

- `shared/events.ts`
- `server/src/utils.ts`
- `server/src/persistence/localStore.ts`
- `server/src/routes.ts`
- `client/src/lib/api.ts`
- `client/src/App.tsx`
- `client/src/index.css`
- `docs/game-design.md`
- `docs/repository-guide.md`
- `docs/changelog.md`
