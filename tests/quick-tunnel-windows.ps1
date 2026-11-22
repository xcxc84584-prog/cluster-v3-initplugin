$ErrorActionPreference='Stop'
$script=Join-Path $PSScriptRoot '../plugins/cluster.powershell/bridge/Start-Quick-Tunnel.ps1'
$tokens=$null
$errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile(
  (Resolve-Path $script).Path,[ref]$tokens,[ref]$errors)
if($errors.Count -gt 0){
  foreach($error in $errors){Write-Error ($error.ToString())}
  exit 1
}
if(-not $ast){throw 'Failed to parse Start-Quick-Tunnel.ps1'}
Write-Host 'Quick Tunnel PowerShell parser PASS'
