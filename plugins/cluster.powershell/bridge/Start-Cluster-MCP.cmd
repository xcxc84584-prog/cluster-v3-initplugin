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
echo.
echo [1] Start local MCP Gateway
echo [2] Start local MCP Gateway + OAuth Gateway
echo [Q] Cancel
choice /c 12Q /n /m "Choose [1/2/Q]: "
if errorlevel 3 exit /b 0
if errorlevel 2 goto :oauth
start "Cluster MCP" cmd /k "node ""%~dp0mcp-gateway.cjs"""
echo MCP started in a separate CMD. It is localhost-only.
pause
exit /b 0
:oauth
echo.
echo OAuth must be exposed only through a trusted HTTPS reverse proxy.
echo Never expose the PowerShell terminal or raw MCP Gateway.
set /p "CLUSTER_OAUTH_ISSUER=Public HTTPS issuer (origin only): "
if not defined CLUSTER_OAUTH_ISSUER goto :error
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
