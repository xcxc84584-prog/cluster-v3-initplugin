param([ValidateSet('mcp','oauth','quick')][string]$Mode='mcp')
$ErrorActionPreference='Stop'
$bridge=$PSScriptRoot
$reporter=Join-Path $bridge 'Show-Connection-Tokens.cjs'
if(!(Test-Path -LiteralPath $reporter)){throw 'Token reporter missing; rerun latest QuickSetup'}
for($attempt=1;$attempt -le 35;$attempt++){
 $result= & node.exe $reporter $Mode 2>&1
 if($LASTEXITCODE -eq 0){
  $result|ForEach-Object{Write-Host $_}
  exit 0
 }
 Start-Sleep -Milliseconds 600
}
throw ('MCP/OAuth readiness failed after verification attempts. Check gateway windows and logs. Last: '+($result -join ' '))
