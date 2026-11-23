@echo off
setlocal EnableExtensions DisableDelayedExpansion
title ClusterPowerShell Native Terminal Local Agent Setup
cd /d "%~dp0"
echo ===========================================================
echo   ClusterPowerShell - Native ConPTY Local Agent Quick Setup
echo ===========================================================
echo.
call :resolve_node
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
  call :resolve_node
  if errorlevel 1 (
    echo [ERROR] Node.js was installed but node.exe could not be located.
    echo Check the installation and retry.
    goto :error
  )
)
call :resolve_npm
if errorlevel 1 (
  echo [ERROR] npm missing. Repair Node.js installation and retry.
  goto :error
)
echo.
echo [2/3] Installing pinned dependencies: Windows ConPTY / xterm.js / WebSocket.
echo.
echo The native node-pty dependency requires a build/install script.
echo This setup will approve ONLY node-pty install scripts, after your permission.
choice /c YN /n /m "Allow node-pty's native install/build script? [Y/N] "
if errorlevel 2 (
  echo [ERROR] node-pty build authorization was declined.
  goto :error
)
call npm install --omit=dev --no-audit --no-fund
if errorlevel 1 goto :native_error
call npm install-scripts approve node-pty
if errorlevel 1 (
  echo [INFO] npm install-scripts approve unsupported or failed; checking native module.
)
call npm rebuild node-pty
if errorlevel 1 goto :native_error
node -e "try{require('node-pty');console.log('[PASS] node-pty native module loaded')}catch(e){console.error(e.message);process.exit(1)}"
if errorlevel 1 goto :native_error
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
    call :refresh_path
    where pwsh.exe >nul 2>nul
    if errorlevel 1 (
      echo [ERROR] PowerShell 7 installed but pwsh.exe is unavailable.
      goto :error
    )
  )
  set "CLUSTER_SHELL=pwsh"
) else (
  set "CLUSTER_SHELL=powershell"
)
echo.
echo Enter your Cluster webpage URL (a full URL with /Cluster-v3/ is accepted).
echo Local Agent will automatically normalize it to the website origin.
echo Only that HTTPS origin can access your local terminal.
set /p "CLUSTER_ALLOWED_ORIGIN=Cluster origin: "
if not defined CLUSTER_ALLOWED_ORIGIN goto :error
echo.
echo [STARTING] Verifying Local Agent binds to 127.0.0.1 on a dynamic port.
echo Copy the PORT MESSAGE URL and TOKEN into ClusterPowerShell.
echo Close this CMD window or Ctrl+C to terminate the agent and its tabs.
node "%~dp0server.cjs"
if errorlevel 1 goto :error
echo Agent stopped.
pause
exit /b 0

:resolve_node
where node.exe >nul 2>nul
if not errorlevel 1 exit /b 0
call :refresh_path
where node.exe >nul 2>nul
if not errorlevel 1 exit /b 0
if exist "%ProgramFiles%\nodejs\node.exe" (
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
  exit /b 0
)
if defined ProgramFiles(x86) if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
  set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
  exit /b 0
)
if exist "%APPDATA%\npm\node.exe" (
  set "PATH=%APPDATA%\npm;%PATH%"
  exit /b 0
)
exit /b 1

:resolve_npm
where npm.cmd >nul 2>nul
if not errorlevel 1 exit /b 0
call :refresh_path
where npm.cmd >nul 2>nul
if not errorlevel 1 exit /b 0
if exist "%ProgramFiles%\nodejs\npm.cmd" (
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
  exit /b 0
)
exit /b 1

:refresh_path
rem winget updates registry PATH; this CMD retains its original environment.
rem Reconstruct machine and user PATH without requiring a new console.
for /f "usebackq tokens=2,*" %%A in (`reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul`) do if /i "%%A"=="REG_EXPAND_SZ" call set "PATH=%%B;%%PATH%%"
for /f "usebackq tokens=2,*" %%A in (`reg query "HKCU\Environment" /v Path 2^>nul`) do if /i "%%A"=="REG_EXPAND_SZ" call set "PATH=%%PATH%%;%%B"
exit /b 0

:native_error
echo [ERROR] node-pty native module is unavailable.
echo Verify npm approval, Windows build tools and compatible Node.js LTS.
goto :error

:error
echo.
echo Local Agent setup or startup failed; inspect the message above.
pause
exit /b 1
