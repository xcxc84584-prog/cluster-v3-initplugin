param([string]$AllowedOrigin='', [switch]$InstallPowerShell7)
$ErrorActionPreference='Stop'
if($InstallPowerShell7 -and -not (Get-Command pwsh -ErrorAction SilentlyContinue)){
  if(-not (Get-Command winget -ErrorAction SilentlyContinue)){throw 'winget missing; install PowerShell 7 using Microsoft installer'}
  & winget install --id Microsoft.PowerShell --source winget --accept-package-agreements --accept-source-agreements
  if($LASTEXITCODE -ne 0){throw 'PowerShell 7 installation failed'}
}
if(-not $AllowedOrigin){$AllowedOrigin=Read-Host 'Enter your Cluster website origin (https://hostname, no path)'}
try{$uri=[Uri]$AllowedOrigin}catch{throw 'Invalid Cluster origin'}
if($uri.AbsolutePath -ne '/' -or $uri.Query -or $uri.Fragment -or $uri.Scheme -notin @('https','http') -or ($uri.Scheme -eq 'http' -and $uri.Host -notin @('localhost','127.0.0.1'))){throw 'Invalid or insecure origin'}
$AllowedOrigin=$uri.GetLeftPart([UriPartial]::Authority)
function New-Secret([int]$count){
 $bytes=New-Object byte[] $count
 $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
 try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}
 return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
}
$token=New-Secret 32
$socket=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
$socket.Start();$port=([Net.IPEndPoint]$socket.LocalEndpoint).Port;$socket.Stop()
$server=New-Object Net.HttpListener
$server.Prefixes.Add("http://127.0.0.1:$port/")
$server.Start()
Add-Type -AssemblyName System.Management.Automation
$sessions=@{}
$maxSessions=12
function Reply($response,[int]$status,[object]$body){
 $response.StatusCode=$status;$response.ContentType='application/json; charset=utf-8'
 $json=ConvertTo-Json -InputObject $body -Compress -Depth 5
 $bytes=[Text.Encoding]::UTF8.GetBytes($json)
 $response.ContentLength64=$bytes.Length
 $response.OutputStream.Write($bytes,0,$bytes.Length)
}
function Read-Body($request){
 if($request.ContentLength64 -lt 2 -or $request.ContentLength64 -gt 65536){throw 'Invalid request size'}
 $reader=New-Object IO.StreamReader($request.InputStream,[Text.Encoding]::UTF8)
 try{return ConvertFrom-Json -InputObject $reader.ReadToEnd()}finally{$reader.Dispose()}
}
Write-Host "PORT MESSAGE : http://127.0.0.1:$port/ TOKEN $token"
Write-Host "ALLOWED ORIGIN : $AllowedOrigin"
Write-Host 'Press Ctrl+C or close this window to stop the Local Agent.'
try{
 while($server.IsListening){
  $ctx=$server.GetContext();$req=$ctx.Request;$res=$ctx.Response
  try{
   if($req.Headers['Origin'] -cne $AllowedOrigin){Reply $res 403 @{ok=$false;error='Origin denied'};continue}
   $res.Headers.Add('Access-Control-Allow-Origin',$AllowedOrigin)
   $res.Headers.Add('Access-Control-Allow-Methods','POST, OPTIONS')
   $res.Headers.Add('Access-Control-Allow-Headers','Content-Type, X-Cluster-Token')
   $res.Headers.Add('Cache-Control','no-store')
   $res.Headers.Add('Vary','Origin')
   if($req.HttpMethod -eq 'OPTIONS'){$res.StatusCode=204;continue}
   if($req.HttpMethod -ne 'POST'){Reply $res 405 @{ok=$false;error='POST required'};continue}
   if($req.Headers['X-Cluster-Token'] -cne $token){Reply $res 403 @{ok=$false;error='Token denied'};continue}
   $route=$req.Url.AbsolutePath
   if($route -eq '/health'){
    Reply $res 200 @{ok=$true;agent='ClusterPowerShell';apiVersion='2.0.0';maxSessions=$maxSessions;count=$sessions.Count}
    continue
   }
   if($route -notin @('/session/create','/session/close','/exec')){Reply $res 404 @{ok=$false;error='Unknown route'};continue}
   try{$payload=Read-Body $req}catch{Reply $res 400 @{ok=$false;error='Invalid JSON body'};continue}
   if($route -eq '/session/create'){
    if($sessions.Count -ge $maxSessions){Reply $res 429 @{ok=$false;error='Session limit reached'};continue}
    $id=New-Secret 18
    $space=[Management.Automation.Runspaces.RunspaceFactory]::CreateRunspace()
    try{$space.Open();$sessions[$id]=$space;Reply $res 200 @{ok=$true;sessionId=$id;sessionCount=$sessions.Count}}
    catch{$space.Dispose();throw}
    continue
   }
   $id=[string]$payload.sessionId
   if(-not $sessions.ContainsKey($id)){Reply $res 404 @{ok=$false;error='Session not found'};continue}
   if($route -eq '/session/close'){
    $space=$sessions[$id];$sessions.Remove($id);$space.Dispose()
    Reply $res 200 @{ok=$true;sessionCount=$sessions.Count};continue
   }
   $source=$payload.command
   if($source -isnot [string] -or [string]::IsNullOrWhiteSpace($source) -or $source.Length -gt 8192){
    Reply $res 400 @{ok=$false;error='Invalid command'};continue
   }
   $ps=[Management.Automation.PowerShell]::Create()
   try{
    $ps.Runspace=$sessions[$id]
    [void]$ps.AddScript($source)
    $items=$ps.Invoke()
    $out=($items|Out-String)
    $errs=($ps.Streams.Error|Out-String)
    Reply $res 200 @{ok=$true;sessionId=$id;output=$out;error=$errs;hadErrors=$ps.HadErrors}
   }finally{$ps.Dispose()}
  }catch{
   Write-Warning $_.Exception.Message
   try{Reply $res 500 @{ok=$false;error='Agent request failed'}}catch{}
  }finally{try{$res.Close()}catch{}}
 }
}finally{
 foreach($space in $sessions.Values){try{$space.Dispose()}catch{}}
 $server.Stop();$server.Close()
}
