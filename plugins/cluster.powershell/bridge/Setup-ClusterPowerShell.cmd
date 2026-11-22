@echo off
setlocal EnableExtensions DisableDelayedExpansion
title ClusterPowerShell Local Agent Setup
cd /d "%~dp0"
echo ===============================
echo ClusterPowerShell Quick Setup
echo ===============================
where powershell.exe >nul 2>nul
if errorlevel 1 (
 echo Windows PowerShell unavailable. Install it from Microsoft.
 pause
 exit /b 1
)
echo [1] Start with existing Windows PowerShell
echo [2] Install PowerShell 7 with winget and start
echo [Q] Cancel
choice /c 12Q /n /m "Choose [1/2/Q]: "
if errorlevel 3 exit /b 0
if errorlevel 2 (
 powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-ClusterPowerShell.ps1" -InstallPowerShell7
) else (
 powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-ClusterPowerShell.ps1"
)
if errorlevel 1 echo Local Agent exited with an error. Review the output above.
echo Agent stopped. Press any key to close.
pause
