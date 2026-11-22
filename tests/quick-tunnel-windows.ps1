$ErrorActionPreference='Stop'
$names=@('Start-Quick-Tunnel.ps1','Select-Local-Root.ps1','Wait-Cluster-Connection.ps1')
foreach($name in $names){
 $script=Join-Path $PSScriptRoot ('../plugins/cluster.powershell/bridge/'+$name)
 $tokens=$null;$errors=$null
 $ast=[System.Management.Automation.Language.Parser]::ParseFile(
  (Resolve-Path $script).Path,[ref]$tokens,[ref]$errors)
 if($errors.Count -gt 0){
  foreach($error in $errors){Write-Error ($error.ToString())}
  exit 1
 }
 if(!$ast){throw ('PowerShell parse failed: '+$name)}
 Write-Host ('Windows PowerShell parser PASS: '+$name)
}
