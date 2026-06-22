# OurFloatingCastleRe

這個 GitHub 倉庫目前真正的應用程式位於：

- `Documents/New project/`

## 快速啟動（clone 後，任何目錄皆可）

需求：Node.js 20+（含 npm）。clone 後：

```powershell
git clone https://github.com/Aqusia/OurFloatingCastleRe.git
cd "OurFloatingCastleRe/Documents/New project"
```

- **Windows 一鍵啟動**：直接執行 `start-game.bat`（會自動 `npm install`，並開啟後端 API、主遊戲前端與管理後台三個視窗）。
- **手動啟動**（跨平台）：

  ```bash
  npm install
  npm --workspace server run dev      # 後端 http://localhost:3001
  npm --workspace client run dev      # 前端 http://127.0.0.1:5173
  npm run dev:admin                   # 管理後台 http://127.0.0.1:5174
  ```

- **production**：`npm install && npm run build && npm start`
- **驗證可建置**：`npm run ci`（lint + typecheck + test + build，與 GitHub Actions 相同）

> 注意：專案位於含空白的 `Documents/New project/` 子目錄，指令請務必在該目錄內執行（`start-game.bat` 會自動切換到自身所在目錄）。

如果你是人或 AI，要理解這個專案，請先從這裡開始看：

1. `Documents/New project/AGENTS.md`
2. `Documents/New project/README.md`
3. `Documents/New project/docs/repository-guide.md`
4. `Documents/New project/docs/game-design.md`
5. `Documents/New project/docs/changelog.md`

## 目前狀態

- repo 根目錄仍保留早期初始化痕跡
- 實際前端、後端、共用型別與文件都在 `Documents/New project/`
- 若要修改功能，請以 `Documents/New project/` 為主要工作區

## 維護提醒

每次修改程式後，請同步更新該目錄中的文件，尤其是：

- `Documents/New project/docs/game-design.md`
- `Documents/New project/docs/repository-guide.md`
- `Documents/New project/docs/changelog.md`
