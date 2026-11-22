# ClusterPowerShell local bridge. Run explicitly on the user's Windows computer.
# No administrator rights required for Windows PowerShell 5.1.
param(
  [string]$AllowedOrigin = "",
  [switch]$InstallPowerShell7
)
$ErrorActionPreference = 'Stop'
if ($InstallPowerShell7 -and -not (Get-Command pwsh -ErrorAction SilentlyContinue)) {
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) { throw 'winget is unavailable. Install PowerShell 7 manually from the official Microsoft distribution.' }
  & winget install --id Microsoft.PowerShell --source winget --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { throw 'PowerShell 7 installation failed' }
}
$engine = Get-Command pwsh -ErrorAction SilentlyContinue
if (-not $engine) { $engine = Get-Command powershell.exe -ErrorAction SilentlyContinue }
if (-not $engine) { throw 'No PowerShell engine found. Install Windows PowerShell or PowerShell 7.' }
if (-not $AllowedOrigin) { $AllowedOrigin = Read-Host 'Enter the full origin of your Cluster page (https://hostname, no path)' }
try { $originUri = [uri]$AllowedOrigin } catch { throw 'Invalid origin' }
if ($originUri.AbsolutePath -ne '/' -or $originUri.Query -or $originUri.Fragment -or
    $originUri.Scheme -notin @('https','http') -or
    ($originUri.Scheme -eq 'http' -and $originUri.Host -notin @('localhost','127.0.0.1'))) {
  throw 'Origin must be an HTTPS site or a local HTTP development origin, without path.'
}
$AllowedOrigin = $originUri.GetLeftPart([System.UriPartial]::Authority)
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
$token = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
$listener = [System.Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([Net.IPEndPoint]$listener.LocalEndpoint).Port
$listener.Stop()
$server = New-Object System.Net.HttpListener
$server.Prefixes.Add("http://127.0.0.1:$port/")
$server.Start()
Write-Host "PORT MESSAGE : http://127.0.0.1:$port/ TOKEN $token"
Write-Host "ALLOWED ORIGIN : $AllowedOrigin"
Write-Host 'Keep this window open; Ctrl+C stops the bridge.'
function Reply($response, [int]$status, [object]$data) {
  $response.StatusCode = $status
  $response.ContentType = 'application/json; charset=utf-8'
  $json = ConvertTo-Json -InputObject $data -Compress -Depth 5
  $out = [Text.Encoding]::UTF8.GetBytes($json)
  $response.ContentLength64 = $out.Length
  $response.OutputStream.Write($out, 0, $out.Length)
}
try {
  while ($server.IsListening) {
    $context = $server.GetContext()
    $request = $context.Request
    $response = $context.Response
    try {
      $source = $request.Headers['Origin']
      if ($source -ne $AllowedOrigin) { Reply $response 403 @{ok=$false;error='Origin denied'}; continue }
      $response.Headers.Add('Access-Control-Allow-Origin', $AllowedOrigin)
      $response.Headers.Add('Vary','Origin')
      $response.Headers.Add('Access-Control-Allow-Methods','POST, OPTIONS')
      $response.Headers.Add('Access-Control-Allow-Headers','Content-Type, X-Cluster-Token')
      $response.Headers.Add('Cache-Control','no-store')
      if ($request.HttpMethod -eq 'OPTIONS') { $response.StatusCode = 204; continue }
      if ($request.HttpMethod -ne 'POST') { Reply $response 405 @{ok=$false;error='POST required'}; continue }
      if ($request.Headers['X-Cluster-Token'] -cne $token) {
        Reply $response 403 @{ok=$false;error='Token denied'}; continue
      }
      if ($request.Url.AbsolutePath -eq '/health') {
        Reply $response 200 @{ok=$true;engine=$engine.Name}; continue
      }
      if ($request.Url.AbsolutePath -ne '/exec') {
        Reply $response 404 @{ok=$false;error='Unknown route'}; continue
      }
      if ($request.ContentLength64 -lt 1 -or $request.ContentLength64 -gt 65536) {
        Reply $response 413 @{ok=$false;error='Invalid payload size'}; continue
      }
      $reader = New-Object IO.StreamReader($request.InputStream, [Text.Encoding]::UTF8)
      $payload = $reader.ReadToEnd() | ConvertFrom-Json
      if ($payload.command -isnot [string] -or $payload.command.Length -gt 8192 -or
          [string]::IsNullOrWhiteSpace($payload.command)) {
        Reply $response 400 @{ok=$false;error='Invalid command'}; continue
      }
      $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($payload.command))
      $start = New-Object Diagnostics.ProcessStartInfo
      $start.FileName = $engine.Source
      $start.Arguments = "-NoLogo -NoProfile -NonInteractive -EncodedCommand $encoded"
      $start.UseShellExecute = $false
      $start.CreateNoWindow = $true
      $start.RedirectStandardOutput = $true
      $start.RedirectStandardError = $true
      $process = [Diagnostics.Process]::Start($start)
      try {
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(60000)) {
          $process.Kill(); $process.WaitForExit()
          Reply $response 408 @{ok=$false;error='Command exceeded 60 seconds'}
        } else {
          $stdout = $stdoutTask.Result
          $stderr = $stderrTask.Result
          Reply $response 200 @{ok=$true;output=$stdout;error=$stderr;exitCode=$process.ExitCode}
        }
      } finally { $process.Dispose() }
    } catch {
      try { Reply $response 500 @{ok=$false;error=$_.Exception.Message} } catch {}
    } finally { try { $response.Close() } catch {} }
  }
} finally { $server.Stop(); $server.Close() }
