@echo off
chcp 65001 >nul
title 遊戲啟動器
cd /d "D:\OurFloatingCastle\Documents\New project"

where node >nul 2>nul
if errorlevel 1 (
  echo [錯誤] 找不到 Node.js，請先到 https://nodejs.org 安裝 LTS 版本後再執行。
  pause
  exit /b 1
)

if not exist node_modules (
  echo 第一次啟動，正在安裝套件（約 1-3 分鐘）...
  call npm.cmd install
)

echo 正在啟動後端與前端...
start "game-server" cmd /k "cd /d "D:\OurFloatingCastle\Documents\New project" && npm.cmd --workspace server run dev"
start "game-client" cmd /k "cd /d "D:\OurFloatingCastle\Documents\New project" && npm.cmd --workspace client run dev"

echo 等待服務啟動...
timeout /t 10 /nobreak >nul
start http://127.0.0.1:5173

echo.
echo 已開啟瀏覽器。若頁面沒出來：
echo   1. 等 10 秒再重新整理 http://127.0.0.1:5173
echo   2. 看 game-server / game-client 兩個黑視窗有沒有紅字錯誤
echo   3. 兩個黑視窗不要關，關掉遊戲就停了
pause
