@echo off
setlocal enabledelayedexpansion

echo.
echo [*] BudgetPulse Installer
echo [*] Downloading latest release...
echo.

REM Download latest release info
for /f "delims=" %%A in ('powershell -NoProfile -Command "iwr -Uri 'https://api.github.com/repos/shrijitb/budget-pulse/releases/latest' | Select-Object -ExpandProperty Content" 2^>nul') do set "RELEASE_JSON=%%A"

REM Extract Windows exe URL
for /f "delims=" %%A in ('powershell -NoProfile -Command "($RELEASE_JSON = '!RELEASE_JSON!') | ConvertFrom-Json | .assets | Where-Object {$_.name -match '\.exe$'} | Select-Object -First 1 -ExpandProperty browser_download_url" 2^>nul') do set "ASSET_URL=%%A"

if "!ASSET_URL!"=="" (
  echo [ERROR] No Windows release found
  echo [*] Make sure a .exe release is published
  pause
  exit /b 1
)

REM Extract filename
for %%F in (!ASSET_URL!) do set "FILENAME=%%~nxF"

set "INSTALL_DIR=%USERPROFILE%\BudgetPulse"
if not exist "!INSTALL_DIR!" mkdir "!INSTALL_DIR!"

echo [*] Downloading !FILENAME!...
powershell -NoProfile -Command "iwr -Uri '!ASSET_URL!' -OutFile '!INSTALL_DIR!\!FILENAME!'" 2^>nul

if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Download failed
  pause
  exit /b 1
)

echo.
echo [OK] Download complete!
echo.
echo [*] To install, run:
echo    !INSTALL_DIR!\!FILENAME!
echo.
pause
