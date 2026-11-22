@echo off
setlocal EnableExtensions DisableDelayedExpansion
title ClusterPowerShell Native Terminal Local Agent Setup
cd /d "%~dp0"
echo ===========================================================
echo   ClusterPowerShell - Native ConPTY Local Agent Quick Setup
echo ===========================================================
echo.
where node.exe >nul 2>nul
if errorlevel 1 (
  echo [1/3] Node.js not installed. Installer uses official winget package.
  where winget.exe >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] winget not found. Install Node.js LTS from nodejs.org and retry.
    goto :error
  )
  choice /c YN /n /m "Install Node.js LTS using winget? [Y/N] "
  if errorlevel 2 goto :error
  winget install --id OpenJS.NodeJS.LTS --exact --source winget --accept-package-agreements --accept-source-agreements
  if errorlevel 1 goto :error
  where node.exe >nul 2>nul
  if errorlevel 1 (
    echo Node.js installed but PATH not refreshed. Open a NEW CMD window and run this script again.
    goto :error
  )
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm missing. Repair Node.js installation and retry.
  goto :error
)
echo.
echo [2/3] Installing pinned dependencies: Windows ConPTY / xterm.js / WebSocket.
call npm install --omit=dev --no-audit --no-fund
if errorlevel 1 (
  echo [ERROR] Dependency installation failed.
  echo node-pty may need a compatible Node.js LTS version and Windows C++ build tools.
  goto :error
)
echo.
echo [3/3] Select PowerShell engine.
echo [1] Windows PowerShell (powershell.exe)
echo [2] PowerShell 7 (pwsh.exe), if installed
echo [Q] Cancel
choice /c 12Q /n /m "Choose [1/2/Q]: "
if errorlevel 3 exit /b 0
if errorlevel 2 (
  where pwsh.exe >nul 2>nul
  if errorlevel 1 (
    echo PowerShell 7 is missing. Install from official Microsoft release.
    choice /c YN /n /m "Install PowerShell 7 using winget? [Y/N] "
    if errorlevel 2 goto :error
    winget install --id Microsoft.PowerShell --exact --source winget --accept-package-agreements --accept-source-agreements
    if errorlevel 1 goto :error
    where pwsh.exe >nul 2>nul
    if errorlevel 1 (
      echo pwsh is installed but PATH is not updated. Re-open CMD and retry.
      goto :error
    )
  )
  set "CLUSTER_SHELL=pwsh"
) else (
  set "CLUSTER_SHELL=powershell"
)
echo.
echo Enter the exact Cluster website origin, for example https://example.com
echo This Local Agent will not accept requests from other browser sites.
set /p "CLUSTER_ALLOWED_ORIGIN=Cluster origin: "
if not defined CLUSTER_ALLOWED_ORIGIN goto :error
echo.
echo [READY] Local Agent binds to 127.0.0.1 on a dynamically allocated port.
echo Copy the PORT MESSAGE URL and TOKEN into ClusterPowerShell.
echo Close this CMD window or Ctrl+C to terminate the agent and its tabs.
node "%~dp0server.cjs"
if errorlevel 1 goto :error
echo Agent stopped.
pause
exit /b 0
:error
echo.
echo Local Agent setup or startup failed; inspect the message above.
pause
exit /b 1
