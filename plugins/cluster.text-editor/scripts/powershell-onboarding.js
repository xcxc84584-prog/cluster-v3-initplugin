/* CMD download transport only. The PowerShell iframe owns all setup UI.
 * Repository URL and branch are fetched from PRMU; never hardcoded in UI.
 */
(()=>{'use strict';
let repo=null,ref='main',ready=false,serial=0,pending=null;
function setSource(data){
const d=typeof data==='string'?{repositoryUrl:data}:data?.data||data||{};
const raw=d.repositoryUrl||d.repository?.url||d.repository?.repositoryUrl||d.url;
if(typeof raw!=='string')return;
let url;try{url=new URL(raw)}catch{return;}
const parts=url.pathname.replace(/\.git$/,'').match(/^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/?$/);
if(url.protocol!=='https:'||url.hostname!=='github.com'||!parts)return;
const sourceRef=String(d.ref||d.repositoryRef||d.repository?.ref||'main');
if(!/^[A-Za-z0-9._/-]{1,100}$/.test(sourceRef)||sourceRef.includes('..'))return;
repo={owner:parts[1],name:parts[2]};ref=sourceRef;ready=true;
publishBootstrap();

}
function bootstrap(){
const base='https://raw.githubusercontent.com/'+repo.owner+'/'+repo.name+'/'+ref+'/plugins/cluster.powershell/bridge/';
return [
'@echo off','setlocal EnableExtensions DisableDelayedExpansion',
'title ClusterPowerShell Quick Setup',
'set "CLUSTER_SOURCE='+base+'"',
'set "CLUSTER_TARGET=%LOCALAPPDATA%\\ClusterPowerShell\\bridge"',
'if not exist "%CLUSTER_TARGET%" mkdir "%CLUSTER_TARGET%"',
'where powershell.exe >nul 2>nul',
'if errorlevel 1 ( echo Windows PowerShell required. & pause & exit /b 1 )',
'echo Downloading ClusterPowerShell Local Agent components...',
'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference = \'Stop\'; $base=$env:CLUSTER_SOURCE; $dir=$env:CLUSTER_TARGET; foreach($f in @(\'package.json\',\'server.cjs\',\'secure-store.cjs\',\'mcp-gateway.cjs\',\'oauth-mcp-gateway.cjs\',\'oauth-origin.cjs\',\'Setup-ClusterPowerShell.cmd\',\'Start-Cluster-MCP.cmd\',\'Show-OAuth-Approval.cmd\')) { Invoke-WebRequest -UseBasicParsing -Uri ($base+$f) -OutFile (Join-Path $dir $f) }"',
'if errorlevel 1 ( echo Download failed. & pause & exit /b 1 )',
'call "%CLUSTER_TARGET%\\Setup-ClusterPowerShell.cmd"',
'if errorlevel 1 ( echo Setup failed. & pause & exit /b 1 )',
'endlocal'].join('\r\n')+'\r\n';
}

function setupFrames(){
 return Array.from(document.querySelectorAll('iframe'))
  .filter(frame=>['ClusterPowerShell','Cluster AI Agent MCP'].includes(frame.title));
}
function publishBootstrap(){
 if(!ready)return;
 for(const frame of setupFrames())
  frame.contentWindow?.postMessage({protocol:'cluster.powershell.setup.v1',
   type:'bootstrap-ready',content:bootstrap()},'*');
}
function reply(frame,ok,error){
 frame?.contentWindow?.postMessage({
  protocol:'cluster.powershell.setup.v1',type:'download-result',ok,
  error:error||null
 },'*');
}
function download(){
 const url=URL.createObjectURL(new Blob([bootstrap()],{type:'application/octet-stream'}));
 const link=document.createElement('a');
 link.href=url;link.download='ClusterPowerShell-QuickSetup.cmd';
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function queryPRMU(){
 if(parent===window)return;
 for(const method of ['PRMU.getCommunityConfig','PRMU.getCommunityRepositoryUrl'])
  parent.postMessage({protocol:'cluster.plugin.v1',type:'request',
   requestId:'powershell-onboard-'+(++serial),method,args:[]},'*');
}
window.addEventListener('message',event=>{
 const msg=event.data;
 if(event.source===parent&&msg?.protocol==='cluster.plugin.v1'&&
  msg.type==='response'&&String(msg.requestId||'').startsWith('powershell-onboard-')){
  if(msg.ok)setSource(msg.data);
  if(ready&&pending){
   const frame=pending;pending=null;
   try{download();reply(frame,true)}catch(error){reply(frame,false,error.message)}
  }
  return;
 }
 const frame=setupFrames().find(frame=>event.source===frame.contentWindow);
 if(frame&&
   msg?.protocol==='cluster.powershell.setup.v1'&&
   (msg.type==='download'||msg.type==='request-bootstrap')){
  if(msg.type==='request-bootstrap'){
   if(ready)publishBootstrap();else queryPRMU();
   return;
  }
  if(ready){
   try{download();reply(frame,true)}catch(error){reply(frame,false,error.message)}
  }else{
   pending=frame;queryPRMU();
   setTimeout(()=>{
    if(pending===frame){pending=null;reply(frame,false,'Community repository not available from PRMU')}
   },7000);
  }
 }
});
queryPRMU();
})();