@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Cluster MCP OAuth Approval Credential
cd /d "%~dp0"
echo OAuth approval is a powerful local credential.
echo Show it only on your own Windows user session.
choice /c YN /n /m "Reveal local approval password? [Y/N] "
if errorlevel 2 exit /b 0
node -e "const path=require('node:path');const os=require('node:os');const folder=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'ClusterPowerShell');try{const token=require('./secure-store.cjs').unprotectFile(path.join(folder,'oauth-approval-password.dpapi'));console.log('OAUTH APPROVAL PASSWORD: '+token)}catch(e){console.error('Credential unavailable: '+e.message);process.exitCode=1}"
echo.
echo Do not paste this password into a public website, GitHub or PRMU.
pause
