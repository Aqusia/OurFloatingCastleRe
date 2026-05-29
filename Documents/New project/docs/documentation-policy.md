# Documentation Policy

這份文件把「程式改了就要同步改文件」明文化，避免 repo 的說明落後於實作。

## 核心原則

文件不是事後補充，而是功能交付的一部分。

如果下列任一項發生改動，就不能只改程式：

- 使用者看得到的功能
- 遊戲規則或數值邏輯
- API、socket、資料模型
- 專案入口、結構、啟動方式

## 更新對照表

### 改了功能、規則、頁面行為

更新：

- `docs/game-design.md`
- `docs/changelog.md`

### 改了 API、socket 事件、資料結構

更新：

- `docs/repository-guide.md`
- `docs/changelog.md`

如果影響玩法或操作流程，也一起更新 `docs/game-design.md`。

### 改了啟動方式、設定方式、必要環境

更新：

- `README.md`
- `docs/changelog.md`

## 提交前檢查清單

1. 我改動的功能，文件有沒有描述到
2. 我改動的結構，導覽有沒有更新
3. 我這一輪的成果，變更紀錄有沒有補上
4. 如果沒改文件，是否真的有合理原因

## 建議做法

- 把文件更新放進同一個提交，不要拖到下一輪
- 先改設計文件，再補程式，或至少在收尾時一起檢查
- 若是大改版，先更新 `docs/repository-guide.md` 再讓其他人或 AI 接手
