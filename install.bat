@echo off
setlocal enabledelayedexpansion

echo.
echo ^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|
echo ^|  BudgetPulse One-Shot Installer (Windows)  ^|
echo ^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|^|
echo.

REM Check for git
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] git is not installed
  echo Install from: https://git-scm.com
  exit /b 1
)
echo [OK] git found

REM Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Node.js is not installed
  echo Install from: https://nodejs.org
  exit /b 1
)
echo [OK] Node.js found

echo.
set "REPO_URL=https://github.com/shrijitb/budget-pulse.git"
set "INSTALL_DIR=%USERPROFILE%\BudgetPulse"

if exist "%INSTALL_DIR%" (
  echo Directory already exists: %INSTALL_DIR%
  set /p "REPLACE=Replace it? (y/n): "
  if /i not "!REPLACE!"=="y" (
    echo Exiting...
    exit /b 0
  )
  rmdir /s /q "%INSTALL_DIR%"
)

echo.
echo [*] Cloning BudgetPulse...
git clone "%REPO_URL%" "%INSTALL_DIR%"
cd /d "%INSTALL_DIR%"

echo.
echo [*] Installing dependencies (this may take a few minutes)...
call npm install
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] npm install failed
  exit /b 1
)

echo.
echo [*] Building Windows installer...
call npm run build:win
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Build failed
  exit /b 1
)

echo.
echo ========================================
echo [OK] Installation complete!
echo ========================================
echo.
echo Installer location: %INSTALL_DIR%\dist\
echo.
echo To run the installer:
echo   "%INSTALL_DIR%\dist\BudgetPulse Setup *.exe"
echo.
echo For development mode with hot reload:
echo   cd "%INSTALL_DIR%"
echo   npm run dev
echo.
pause
