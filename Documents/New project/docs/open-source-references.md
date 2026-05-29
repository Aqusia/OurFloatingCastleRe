# Open Source References

這份文件整理目前適合參考的開源遊戲、UI 資源與架構工具。用途是讓後續開發時能快速判斷哪些東西可以直接引用，哪些只適合參考設計或架構。

## 授權原則

- MIT / Apache-2.0 / BSD 類：通常可直接引用，保留 license notice。
- CC0：素材使用最輕量，但仍建議保留來源紀錄。
- CC BY：可用但需要 attribution。
- MPL-2.0：可用但有檔案級開源義務，建議先參考設計後自行實作。
- GPL / AGPL / CC-NC / 無 license：目前不直接拷貝程式碼或素材，只做靈感與架構參考。

## 同類型遊戲與架構參考

| 專案 | URL | License | 可借鑑點 | 建議 |
| --- | --- | --- | --- | --- |
| RPG-JS | https://github.com/RSamaium/RPG-JS | MIT | Browser RPG / MMORPG framework、地圖、事件、角色模組化 | 可研究架構與部分程式模式 |
| Reldens | https://github.com/damian-pastorini/reldens | MIT | Node.js MMORPG platform、多人房間、世界/伺服器拆分 | 可參考 server 模組邊界 |
| Biomes | https://github.com/ill-inc/biomes-game | MIT | 大型 Web MMORPG、React/TypeScript、client/server/shared 分層 | 適合參考大型架構，不急著搬 |
| Athena Crisis | https://github.com/nkzw-tech/athena-crisis | MIT core code | React + TypeScript + CSS 做高品質遊戲 UI 與工具 | 適合研究 UI 組織與工程品質 |
| BrowserQuest | https://github.com/mozilla/BrowserQuest | MPL-2.0 code, CC-BY-SA content | 經典 HTML5 多人 RPG、client/server/shared 分層 | 只參考同步與 loop 設計 |
| Evolve | https://github.com/pmotschmann/Evolve | MPL-2.0 | idle / incremental 成長、資源與解鎖節奏 | 參考 progression 設計 |
| A Dark Room | https://github.com/doublespeakgames/adarkroom | MPL-2.0 | 極簡文字 RPG、逐步展開玩法 | 參考節奏與資訊揭露 |
| Habitica | https://github.com/HabitRPG/habitica | GPLv3 code, assets restrictions | RPG 化 dashboard、任務、獎勵、社群 | 只做產品與 UI 參考 |
| OpenFrontIO | https://github.com/openfrontio/OpenFrontIO | AGPL-3.0 source | 大型 browser multiplayer、多人同步壓力處理 | 架構參考，不直接引用 |

## UI / 視覺 / 元件資源

| 資源 | URL | License | 可用方式 |
| --- | --- | --- | --- |
| Radix UI Primitives | https://www.radix-ui.com/primitives/docs | MIT | 無樣式互動元件，可接目前 CSS |
| Floating UI | https://floating-ui.com/docs/react | MIT | 物品 tooltip、popover、浮動說明 |
| Tippy.js React | https://www.npmjs.com/package/@tippyjs/react | MIT | 快速加 tooltip |
| RPGUI | https://github.com/RonenNess/RPGUI | zlib | 參考 RPG 風格面板、按鈕、progress bar |
| 8bitcn UI | https://github.com/TheOrcDev/8bitcn-ui | MIT | 參考可訪問的復古 UI component 做法 |
| Trophy UI | https://ui.trophy.so/ | MIT | 成就、排行榜、點數、等級元件參考 |
| NES.css | https://nostalgic-css.github.io/NES.css/ | MIT | CSS-only 像素風可做小範圍實驗 |
| Kenney UI Pack | https://kenney.nl/assets/ui-pack | CC0 | 可做按鈕、面板、滑桿素材 |
| Kenney UI Pack RPG Expansion | https://kenney.nl/assets/ui-pack-rpg-expansion | CC0 | RPG 面板與 UI 素材 |
| Game-icons.net | https://game-icons.net/ | CC BY 3.0 | 可做技能/道具 icon，需 attribution |
| RPG Awesome | https://nagoshiashumari.github.io/Rpg-Awesome/ | 需依套件保留 license | RPG icon font，採用前要鎖定套件授權 |
| OpenGameArt Fantasy GUI | https://opengameart.org/content/fantasy-gui-0 | CC0 | Fantasy GUI 素材 |
| RPG UI Set 1 | https://foozlecc.itch.io/rpg-ui-set-1 | CC0 | 暗黑系 RPG panel / frame 視覺參考 |

## 架構與工具候選

| 工具 | URL | License | 適用情境 | 建議 |
| --- | --- | --- | --- | --- |
| Zod | https://github.com/colinhacks/zod | MIT | API / socket / 存檔 runtime validation | 短期可導入 |
| TanStack Query | https://github.com/TanStack/query | MIT | HTTP server-state 快取與重新整理 | 短期可導入 |
| Zustand | https://github.com/pmndrs/zustand | MIT | 拆 `App.tsx` 過大的 UI state | 視狀態膨脹程度導入 |
| XState | https://github.com/statelyai/xstate | MIT | 房間、Boss、戰鬥 phase 狀態機 | 中期局部導入 |
| Colyseus | https://github.com/colyseus/colyseus | MIT | Authoritative multiplayer、room、matchmaking、state sync | 中長期評估 |
| Drizzle ORM | https://github.com/drizzle-team/drizzle-orm | Apache-2.0 | Supabase/Postgres schema 與型別安全查詢 | 資料層重構時評估 |
| boardgame.io | https://github.com/boardgameio/boardgame.io | MIT | 回合制、phase、可重播 log | 戰鬥副本若回合化時參考 |
| Nakama | https://github.com/heroiclabs/nakama | Apache-2.0 | 完整遊戲後端平台 | 先記錄，不急著替換 |

## 目前採用的落地改動

- 新增 `lucide-react`，先用成熟 MIT icon library 改善導覽與狀態資訊。
- 暫不導入 Tailwind / shadcn，避免為了 UI 元件重鋪整個樣式系統。
- 先在現有 CSS 裡吸收 RPGUI / 8bitcn 的面板感：更清楚的框線、內陰影、icon 導覽、資源狀態徽章。
- 架構工具先記錄，不在這輪大改後端或資料層。
