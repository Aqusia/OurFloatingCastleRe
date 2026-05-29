# AI 維護指南

本資料夾是目前真正的應用程式根目錄。

## 先看哪裡

每次接手時，請依序閱讀：

1. `README.md`
2. `docs/repository-guide.md`
3. `docs/documentation-policy.md`
4. `docs/game-design.md`
5. `docs/changelog.md`

## 這個 repo 的基本判斷

- `client/` 是 React + Vite 前端
- `server/` 是 Express + Socket.IO 後端
- `shared/` 是前後端共用型別與事件契約
- `server/src/persistence/localStore.ts` 是目前本地資料的主要來源
- `shared/events.ts` 是 API / socket / domain 型別的核心契約

## 不可省略的文件同步規則

只要改了程式，請先判斷是否要同步更新文件；大多數功能型改動都需要。

### 必須同步更新文件的情況

- 新增、刪除、調整功能或遊戲規則
- 修改 API 路由、socket 事件、資料模型
- 調整專案結構、模組職責、入口檔案
- 變更啟動方式、環境設定、必要檔案

### 對應要更新的文件

- 功能與規則：`docs/game-design.md`
- 架構與入口：`docs/repository-guide.md`
- 本輪變更摘要：`docs/changelog.md`
- 啟動與總覽：`README.md`
- 判斷哪些文件該動：`docs/documentation-policy.md`

## 提交前檢查

在結束前確認：

1. 文件是否仍然描述目前真實行為
2. 新增功能是否已寫入 `docs/game-design.md`
3. 結構調整是否已寫入 `docs/repository-guide.md`
4. 本輪完成內容是否已補進 `docs/changelog.md`

如果這次程式改動真的不需要更新文件，請在最終說明中明確講出原因。

## 命名規則

- 文件檔名使用 `kebab-case`
- 根目錄慣例檔案保留大寫，例如 `README.md`、`AGENTS.md`
- TypeScript 模組沿用現有風格：
  - React component 檔案可用 `PascalCase`
  - 其他模組以 `camelCase` 為主
