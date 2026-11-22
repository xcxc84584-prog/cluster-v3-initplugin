@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Cluster AI Agent MCP and OAuth
cd /d "%~dp0"
echo ==================================================
echo   Cluster AI Agent MCP ^| Local OAuth setup
echo ==================================================
where node.exe >nul 2>nul
if errorlevel 1 (
 echo [ERROR] Install Node.js LTS using the PowerShell Quick Setup CMD first.
 goto :error
)
if not exist "%~dp0secure-store.cjs" goto :missing
if not exist "%~dp0mcp-gateway.cjs" goto :missing
if not exist "%~dp0oauth-mcp-gateway.cjs" goto :missing
if not exist "%~dp0oauth-origin.cjs" goto :missing
echo.
echo [1] Start local MCP Gateway
echo [2] Start local MCP Gateway + OAuth Gateway (own HTTPS hostname)
echo [3] Create temporary Cloudflare Quick Tunnel (no domain required)
echo [Q] Cancel
choice /c 123Q /n /m "Choose [1/2/3/Q]: "
if errorlevel 4 exit /b 0
if errorlevel 3 goto :quick_tunnel
if errorlevel 2 goto :oauth
start "Cluster MCP" cmd /k "node ""%~dp0mcp-gateway.cjs"""
echo MCP started in a separate CMD. It is localhost-only.
pause
exit /b 0
:quick_tunnel
echo.
echo Cloudflare Quick Tunnel is TEMPORARY and for testing only.
echo This exposes OAuth only, not PowerShell or the raw MCP Gateway.
echo Any previous Quick Tunnel may require user-approved reuse or revocation.
if not exist "%~dp0Start-Quick-Tunnel.ps1" goto :missing
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Quick-Tunnel.ps1"
if errorlevel 1 goto :error
echo.
echo Quick Tunnel setup completed. Copy the verified MCP URL shown above.
echo Reconfigure ChatGPT when the temporary URL changes.
pause
exit /b 0
:oauth
echo.
echo OAuth needs your OWN trusted public HTTPS proxy domain.
echo Example only: https://mcp.example.com
echo Do NOT enter the Cluster-v3 github.io website.
echo Never expose the PowerShell terminal or raw MCP Gateway.
echo.
:issuer_prompt
set "CLUSTER_OAUTH_INPUT="
set "CLUSTER_OAUTH_ISSUER="
set /p "CLUSTER_OAUTH_INPUT=Public OAuth HTTPS URL (or Q to cancel): "
if /i "%CLUSTER_OAUTH_INPUT%"=="Q" exit /b 0
for /f "usebackq delims=" %%I in (`node "%~dp0oauth-origin.cjs"`) do set "CLUSTER_OAUTH_ISSUER=%%I"
if not defined CLUSTER_OAUTH_ISSUER (
 echo.
 echo [ERROR] An OAuth public HTTPS reverse proxy is required.
 echo A github.io Cluster page is NOT an OAuth Gateway.
 echo Configure your HTTPS endpoint, then try again.
 echo.
 goto :issuer_prompt
)
echo [VALID] OAuth issuer: %CLUSTER_OAUTH_ISSUER%
echo Your reverse proxy must forward HTTPS requests to the OAuth localhost port.
choice /c YN /n /m "Proxy configured and ready? [Y/N] "
if errorlevel 2 goto :issuer_prompt
start "Cluster MCP" cmd /k "node ""%~dp0mcp-gateway.cjs"""
start "Cluster OAuth" cmd /k "node ""%~dp0oauth-mcp-gateway.cjs"""
echo.
echo OAuth is localhost-only. Set your reverse proxy to the OAuth Gateway.
echo Pair the ChatGPT MCP connection at:
echo %CLUSTER_OAUTH_ISSUER%/mcp
echo.
echo OAuth approval password is stored using Windows DPAPI.
echo To view it as the current Windows user, use the authorized local
echo credential viewer; never share it or place it in Cluster PRMU.
pause
exit /b 0
:missing
echo [ERROR] MCP Gateway files missing. Download the latest setup CMD.
:error
echo Setup stopped. No public service was exposed.
pause
exit /b 1
