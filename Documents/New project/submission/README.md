# Python 期末個人專題 — 繳交說明

**主題**：以 Python 蒙地卡羅模擬驗證多人 RPG《Our Floating Castle》的戰鬥平衡

**作者**：楊澤全　·　國立中央大學 電機工程學系 四年級　·　學號 111501572

本壓縮檔是 Python 期末專題的補充材料。**主要繳交文件是 Word 報告**（`期末報告.docx`），本檔提供可執行的 Python 程式與重現結果。

## 內容

| 路徑 | 說明 |
| --- | --- |
| `期末報告.docx` | 書面報告（主要繳交文件）；§5 為基準研究、§6 為 2026-06-23 機制更新與重新驗證（含新模型圖 13、14） |
| `期末簡報.pptx` | 21 頁口頭簡報（選繳；含 2026-06-23 機制更新頁） |
| `balance-sim/` | **本專題深入完成的 Python 程式**：離線戰鬥平衡模擬／分析工具 |
| `balance-sim/output/` | 程式產出的圖表（fig0–fig11）、CSV 與失衡報告 |

## 如何重現結果（Python 工具）

需求：Python 3.10+。

```bash
cd balance-sim
pip install -r requirements.txt
python main.py --n 4000 --tune        # 完整研究（固定種子，可重現）
# 或快速版：
python main.py --quick --n 500
```

產出寫入 `balance-sim/output/`：

- `summary_<difficulty>.csv` / `summary_all.csv`：各職業 × 等級 × 難度的勝率、擊殺回合、連擊、終結率、每擊傷害
- `fig0–fig11 *.png`：報告引用的全部圖表（`main.py` 產生 fig0–fig9；`sensitivity.py`／`optimize.py` 產生 fig10／fig11）
- `imbalance_report.txt`：自動標記的失衡 case
- `tuning_*.csv` / `tuning_summary.json`：調參前後對照

固定 `--seed`（預設 20260622）即可完整重現報告中的數字。

## 關於遊戲本體

被分析的遊戲《Our Floating Castle》是一個 TypeScript / React / Node.js 的多人 RPG，原始碼在同一個專案庫（`Documents/New project/`）。本專題以 Python 工具分析其戰鬥引擎，並依模擬結果將戰士基礎技巧 4→8、速度 5→6 套用回 `server/src/utils.ts`。2026-06-23 另將戰鬥機制升級（八屬性用途重定義、連擊改吃 MP／行動吃精力、心態系統、能量槽必殺密技），並同步更新 Python 移植（單元測試 15→19 全過）後重跑驗證，結論見報告 §6。

啟動遊戲（需 Node 20、`npm install`）：

```bash
npm install
npm --workspace server run dev      # 後端 http://localhost:3001
npm --workspace client run dev      # 前端 http://127.0.0.1:5173
npm run dev:admin                   # 後台 http://127.0.0.1:5174
```

## 誠實聲明

`balance-sim` 重現的是遊戲戰鬥「引擎」的核心公式，未涵蓋裝備、次要角色技能、秘籍與隊伍綜效；角色成長採「依職業天賦比例配點」的代表性 build。圖表標籤採英文以避免跨機器缺字。詳見報告第 7 節（反思與限制）。
