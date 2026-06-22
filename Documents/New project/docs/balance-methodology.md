# 平衡方法學：用 Python 蒙地卡羅模擬驗證戰鬥平衡

本文件說明 `balance-sim/`（Python 工具）如何離線驗證《Our Floating Castle》的戰鬥平衡，以及每次調整戰鬥內容後的「再驗證」流程。這也是本專案 Python 期末專題深入完成的部分。

## 1. 為什麼需要它

遊戲設計者最難回答的問題是「平衡了沒？」。在四職業 × 最長 20 段連擊 × 狀態效果 × 敵人 HP 二次縮放交織下，人工試玩一場只看到一個隨機樣本，靠手感調整無異於盲調；後台 FUN SCORE 只是單點啟發式估計，看不到分佈。本工具用大量重複模擬，把隱藏在隨機性背後的職業差距與節奏問題以「分佈」顯影。

## 2. 工具架構

| 模組 | 職責 |
| --- | --- |
| `formulas.py` | 逐式移植 TS 戰鬥/成長公式（含來源行號），含連擊、暴擊、減傷、進階戰技、狀態結算、里程碑 |
| `simulate.py` | 重現單體戰鬥迴圈：連擊→進階戰技→狀態結算→Boss 狂怒→Boss 攻擊 |
| `analyze.py` | Monte Carlo（每格 N 場、固定種子）+ pandas 聚合 + 失衡偵測 |
| `plots.py` | matplotlib 圖表 |
| `main.py` | 一鍵跑完並輸出 CSV/圖表/失衡報告；`--tune` 做調參前後比較 |
| `sensitivity.py` | 單一槓桿（戰士技巧）掃描 |
| `optimize.py` | （技巧×速度）網格搜尋最小職業落差 |
| `test_formulas.py` | 單元測試，確保 Python 移植與 TS 一致 |

## 3. 移植正確性

JavaScript `Math.round` 對非負數為四捨五入進位，Python 端以 `floor(x+0.5)` 對齊；`Math.floor/ceil/pow` 一一對應；隨機以注入的 `random.Random(seed)` 確保整個研究可重現（PRNG 與 V8 不同，但每條機率與分佈一致）。`test_formulas.py` 對連擊上限、減傷、Boss 反制、狀態結算、狀態疊加、進階戰技、連擊里程碑等做斷言，全數通過。

## 4. 失衡指標

`analyze.py` 自動標記四類衝突：

1. **職業壓制**：同等級各職業勝率最大−最小落差過大。
2. **節奏異常**：平均擊殺回合落在設計目標 3–4 回合帶之外。
3. **等級牆**：相鄰等級勝率驟降。
4. **秒殺**：擊殺回合過短，代表敵人 HP 縮放失效。

## 5. 再驗證流程（每次改動戰鬥內容）

1. 在遊戲端（TS）修改戰鬥機制並通過 `npm run ci`。
2. 把相同機制移植進 `formulas.py`/`simulate.py`，補 `test_formulas.py` 測試。
3. 重跑 `python main.py --n 4000 --tune`、`sensitivity.py`、`optimize.py`，重新產生圖表與失衡報告。
4. 比較前後平衡指標；若惡化則回到遊戲端調參（如職業基礎屬性、敵人縮放），再重跑，直到收斂。

## 6. 已得到的決策

- 早期（基礎連擊）分析發現戰士因技巧/速度偏低於連擊系統墊底（菁英難度勝率最低約 18%、職業落差達 75pt）→ 將戰士基礎技巧 4→8、速度 5→6。
- 豐富化（狀態效果/里程碑/進階戰技/狂怒）後再驗證：傷害來源更多元使各職業落差進一步收斂；網格搜尋確認 (技巧 8, 速度 6) 仍位於落差近最小區，且不致把戰士反向過度補強。

## 7. 重現

```bash
cd balance-sim
pip install -r requirements.txt
python -m unittest test_formulas        # 全數通過
python main.py --n 4000 --tune          # 重現報告圖表與數字
python sensitivity.py --n 1500
python optimize.py --n 1200
```

固定 `--seed`（預設 20260622）即可完整重現報告中的數字。
