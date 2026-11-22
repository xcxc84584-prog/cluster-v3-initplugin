# Opt2-style temporary Cloudflare OAuth tunnel. MCP and PS remain local-only.
$ErrorActionPreference='Stop'
$root=Join-Path $env:LOCALAPPDATA 'ClusterPowerShell'
$logs=Join-Path $root 'logs'
$state=Join-Path $root 'quick-tunnel.json'
New-Item -ItemType Directory -Path $logs -Force|Out-Null
$tunnel=$null;$oauth=$null
function Owned([int]$processId,[string]$needle){
 if($processId -le 4){return $null}
 try{$p=Get-CimInstance Win32_Process -Filter ("ProcessId="+$processId) -ErrorAction Stop
 if(!$p){return $null}
 if($needle -eq 'tunnel'){
  if($p.Name -ne 'cloudflared.exe' -or
     $p.CommandLine -notmatch '(?i)\btunnel\b' -or
     $p.CommandLine -notmatch '127\.0\.0\.1:'){return $null}
 }else{
  if($p.Name -ne 'node.exe' -or $p.CommandLine -notlike ('*'+$needle+'*')){return $null}
 }
 return $p
 }catch{}
 return $null
}
function CloudflaredExe {
 $found=Get-Command cloudflared.exe -ErrorAction SilentlyContinue
 if($found){return $found.Source}
 $paths=@((Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\cloudflared.exe'),(Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'cloudflared\cloudflared.exe'),(Join-Path ([Environment]::GetFolderPath('ProgramFilesX86')) 'cloudflared\cloudflared.exe'))
 foreach($p in $paths){if(Test-Path -LiteralPath $p){return $p}}
 $winget=Get-Command winget.exe -ErrorAction SilentlyContinue
 if(!$winget){throw 'cloudflared missing. Install Cloudflare.cloudflared first.'}
 if((Read-Host 'Install Cloudflare.cloudflared via winget? [Y/N]') -notmatch '^[Yy]$'){throw 'Installation cancelled'}
 & $winget.Source install --id Cloudflare.cloudflared --exact --source winget --accept-package-agreements --accept-source-agreements --disable-interactivity | Out-Host
 if($LASTEXITCODE -ne 0){throw 'cloudflared installation failed'}
 $found=Get-Command cloudflared.exe -ErrorAction SilentlyContinue
 if($found){return $found.Source}
 foreach($p in $paths){if(Test-Path -LiteralPath $p){return $p}}
 throw 'cloudflared installed but executable not found. Restart the setup CMD.'
}
function FreePort {
 $listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
 $listener.Start()
 try{return $listener.LocalEndpoint.Port}finally{$listener.Stop()}
}
function PublicCheck([string]$issuer){
 $m=Invoke-RestMethod -Uri ($issuer+'/.well-known/oauth-authorization-server') -TimeoutSec 12
 $r=Invoke-RestMethod -Uri ($issuer+'/.well-known/oauth-protected-resource/mcp') -TimeoutSec 12
 if($m.issuer -cne $issuer -or $r.resource -cne ($issuer+'/mcp')){throw 'Public OAuth metadata issuer/resource mismatch'}
 if($m.code_challenge_methods_supported -notcontains 'S256'){throw 'OAuth PKCE metadata missing'}
}
try {
 if(Test-Path $state){
  $old=Get-Content $state -Raw|ConvertFrom-Json
  $oldCloud=Owned $old.tunnelPid 'tunnel'
  $oldOAuth=Owned $old.oauthPid 'oauth-mcp-gateway.cjs'
  if($oldCloud -and $oldOAuth){
   Write-Host ('Existing Quick Tunnel URL: '+$old.issuer+'/mcp')
   Write-Host '[R] Reuse and verify | [D] Revoke and recreate | [C] Cancel'
   $decision=(Read-Host 'Choose R/D/C').Trim().ToUpperInvariant()
   if($decision -eq 'C'){exit 0}
   if($decision -eq 'R'){
    PublicCheck $old.issuer
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'Wait-Cluster-Connection.ps1') -Mode quick
    if($LASTEXITCODE -ne 0){throw 'Saved gateway credentials verification failed'}
    Write-Host ('PORT MESSAGE : CHATGPT MCP '+$old.issuer+'/mcp')
    exit 0
   }
   if($decision -ne 'D'){throw 'Existing gateway retained; cancelled'}
   if((Read-Host 'Type REVOKE to stop verified prior OAuth/tunnel processes') -cne 'REVOKE'){throw 'Revocation declined'}
   Stop-Process -Id $oldOAuth.ProcessId -ErrorAction Stop
   Stop-Process -Id $oldCloud.ProcessId -ErrorAction Stop
  }elseif($oldCloud -or $oldOAuth){
   throw 'Partially running previous tunnel: inspect manually; refusing to terminate it'
  }
  Remove-Item -LiteralPath $state -Force -ErrorAction SilentlyContinue
 }
 if((Read-Host 'Expose ONLY OAuth via a temporary public HTTPS URL? [Y/N]') -notmatch '^[Yy]$'){throw 'User cancelled public tunnel'}
 $node=(Get-Command node.exe -ErrorAction Stop).Source
 $bridge=$PSScriptRoot
 foreach($name in @('mcp-gateway.cjs','oauth-mcp-gateway.cjs','oauth-origin.cjs','secure-store.cjs')){
  if(!(Test-Path -LiteralPath (Join-Path $bridge $name))){throw ('Missing '+$name)}
 }
 $mcpState=Join-Path $root 'mcp-port.json'
 $mcpReady=$false
 if(Test-Path $mcpState){
  try{$saved=Get-Content $mcpState -Raw|ConvertFrom-Json
   $mcpReady=[bool](Owned $saved.pid 'mcp-gateway.cjs')}catch{}
 }
 if(!$mcpReady){
  $mcp=Start-Process -FilePath $node -ArgumentList ('"'+(Join-Path $bridge 'mcp-gateway.cjs')+'"') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs 'mcp.out') -RedirectStandardError (Join-Path $logs 'mcp.err')
  for($i=0;$i -lt 35;$i++){
   Start-Sleep -Milliseconds 400
   $mcp.Refresh()
   if($mcp.HasExited){throw 'Local MCP failed; inspect logs/mcp.err'}
   if(Test-Path $mcpState){
    try{$saved=Get-Content $mcpState -Raw|ConvertFrom-Json
     if($saved.pid -eq $mcp.Id){$mcpReady=$true;break}}catch{}
   }
  }
  if(!$mcpReady){throw 'MCP startup timed out'}
 }
 $cloudflared=CloudflaredExe
 $port=FreePort
 $stdout=Join-Path $logs 'quick-tunnel.out'
 $stderr=Join-Path $logs 'quick-tunnel.err'
 Write-Host ('Starting Quick Tunnel for OAuth 127.0.0.1:'+$port)
 $tunnel=Start-Process -FilePath $cloudflared -ArgumentList @('tunnel','--url',('http://127.0.0.1:'+$port),'--no-autoupdate') -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
 $issuer='';$registered=$false
 for($i=0;$i -lt 100;$i++){
  Start-Sleep -Milliseconds 500
  $tunnel.Refresh()
  if($tunnel.HasExited){throw 'cloudflared exited before tunnel registration'}
  $raw=''
  foreach($f in @($stdout,$stderr)){if(Test-Path $f){$raw+=Get-Content -LiteralPath $f -Raw -ErrorAction SilentlyContinue}}
  if(!$issuer -and $raw -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com'){$issuer=$Matches[0]}
  if($raw -match '(?i)Registered tunnel connection'){$registered=$true}
  if($issuer -and $registered){break}
 }
 if(!$issuer -or !$registered){throw 'Quick Tunnel URL/registration unavailable. Check DNS or outbound port 7844.'}
 $env:CLUSTER_OAUTH_ISSUER=$issuer
 $env:CLUSTER_OAUTH_PORT=[string]$port
 $oauth=Start-Process -FilePath $node -ArgumentList ('"'+(Join-Path $bridge 'oauth-mcp-gateway.cjs')+'"') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs 'oauth.out') -RedirectStandardError (Join-Path $logs 'oauth.err')
 $localReady=$false
 for($i=0;$i -lt 50;$i++){
  Start-Sleep -Milliseconds 400
  $oauth.Refresh()
  if($oauth.HasExited){throw 'OAuth failed to start; inspect logs/oauth.err'}
  try{$meta=Invoke-RestMethod -Uri ('http://127.0.0.1:'+$port+'/.well-known/oauth-authorization-server') -TimeoutSec 2
   if($meta.issuer -ceq $issuer){$localReady=$true;break}}catch{}
 }
 if(!$localReady){throw 'OAuth did not return the same temporary issuer'}
 $verified=$false
 for($i=1;$i -le 6;$i++){
  try{PublicCheck $issuer;$verified=$true;break}
  catch{Write-Warning ('Public metadata check '+$i+'/6: '+$_.Exception.Message)
   if($i -lt 6){Start-Sleep -Seconds 3}}
 }
 if(!$verified){throw 'Public OAuth/MCP metadata could not be verified'}
 $snapshot=@{schemaVersion=1;issuer=$issuer;oauthPort=$port;oauthPid=$oauth.Id;tunnelPid=$tunnel.Id;created=(Get-Date).ToUniversalTime().ToString('o')}
 $tmp=$state+'.new'
 [IO.File]::WriteAllText($tmp,($snapshot|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
 Move-Item -LiteralPath $tmp -Destination $state -Force
 Write-Host ''
 & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'Wait-Cluster-Connection.ps1') -Mode quick
 if($LASTEXITCODE -ne 0){throw 'Local token verification failed'}
 Write-Host 'Quick Tunnel verified (development/testing only).'
 Write-Host ('PORT MESSAGE : CHATGPT MCP '+$issuer+'/mcp')
 Write-Host 'No domain configuration required. URL changes when tunnel restarts.'
 Write-Host 'For OAuth approval password, run Show-OAuth-Approval.cmd locally.'
 exit 0
}catch{
 [Console]::Error.WriteLine('[ERROR] '+$_.Exception.Message)
 if($oauth){try{$oauth.Refresh();if(!$oauth.HasExited){Stop-Process -Id $oauth.Id -ErrorAction SilentlyContinue}}catch{}}
 if($tunnel){try{$tunnel.Refresh();if(!$tunnel.HasExited){Stop-Process -Id $tunnel.Id -ErrorAction SilentlyContinue}}catch{}}
 exit 1
}
