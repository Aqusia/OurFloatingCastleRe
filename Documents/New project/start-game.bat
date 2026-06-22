@echo off
setlocal

title Game Launcher
set "PROJECT_DIR=%~dp0"
set "DRY_RUN="

if /I "%~1"=="--dry-run" (
  set "DRY_RUN=1"
)

cd /d "%PROJECT_DIR%" || (
  echo [ERROR] Cannot enter project directory:
  echo   %PROJECT_DIR%
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install the LTS version:
  echo   https://nodejs.org
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm.cmd was not found. Reinstall Node.js LTS with npm enabled.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo First run: installing packages. This may take 1-3 minutes...
  call npm.cmd install
  if errorlevel 1 (
    echo [ERROR] npm install failed. Check the message above.
    pause
    exit /b 1
  )
)

echo Starting local services...
echo   API server:   http://127.0.0.1:3001/api/health
echo   Game client:  http://127.0.0.1:5173
echo   Admin client: http://127.0.0.1:5174

if defined DRY_RUN (
  echo [DRY RUN] start "game-server" /D "%PROJECT_DIR%" cmd /k npm.cmd run dev:server
  echo [DRY RUN] start "game-client" /D "%PROJECT_DIR%" cmd /k npm.cmd run dev:client
  echo [DRY RUN] start "admin-client" /D "%PROJECT_DIR%" cmd /k npm.cmd run dev:admin
  echo [DRY RUN] Browser launch skipped.
  exit /b 0
)

start "game-server" /D "%PROJECT_DIR%" cmd /k npm.cmd run dev:server
start "game-client" /D "%PROJECT_DIR%" cmd /k npm.cmd run dev:client
start "admin-client" /D "%PROJECT_DIR%" cmd /k npm.cmd run dev:admin

echo Waiting for dev servers...
timeout /t 10 /nobreak >nul

start "" "http://127.0.0.1:5173"
start "" "http://127.0.0.1:5174"

echo.
echo Browser pages opened.
echo Keep the three command windows open while playing.
echo If a page is not ready yet, wait a few seconds and refresh:
echo   Game:  http://127.0.0.1:5173
echo   Admin: http://127.0.0.1:5174
echo Check game-server, game-client, or admin-client for errors if startup fails.
pause
