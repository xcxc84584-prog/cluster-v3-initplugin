/* Editor first-run Local Agent onboarding. PRMU owns remote repository and locale. */
(()=>{'use strict';
const pane=document.querySelector('.editor-pane');
const header=document.querySelector('.workbench-header');
if(!pane||!header)return;
const style=document.createElement('style');
style.textContent=[
'.agent-entry{display:flex;align-items:center;gap:7px;white-space:nowrap}',
'.agent-entry .status{width:7px;height:7px;border-radius:50%;background:var(--ui-muted)}',
'.agent-entry[data-connected=true] .status{background:var(--ui-accent)}',
'.agent-onboard{position:absolute;z-index:25;right:20px;bottom:34px;width:min(425px,calc(100% - 25px));max-height:calc(100% - 55px);overflow-y:auto;background:var(--ui-panel);color:var(--ui-on-panel,var(--ui-text));border:1px solid var(--ui-border);border-radius:9px;box-shadow:0 18px 44px #0008;font-size:12px}',
'.agent-onboard[hidden]{display:none}',
'.agent-onboard header{display:flex;justify-content:space-between;align-items:center;padding:13px 15px;border-bottom:1px solid var(--ui-border);background:var(--ui-surface)}',
'.agent-onboard header strong{font-size:13px}',
'.agent-onboard button{cursor:pointer;border:1px solid var(--ui-border);background:var(--ui-control);color:var(--ui-on-control,var(--ui-text));border-radius:5px;padding:8px 11px}',
'.agent-onboard button:hover{background:var(--ui-hover)}',
'.agent-onboard button:disabled{opacity:.55;cursor:not-allowed}',
'.agent-content{padding:13px 16px;line-height:1.7}',
'.agent-content p{color:var(--ui-muted);margin:0 0 10px}',
'.agent-step{display:flex;gap:11px;align-items:flex-start;padding:8px 0}',
'.agent-step b{display:grid;place-items:center;flex:none;width:22px;height:22px;border:1px solid var(--ui-border);border-radius:50%;background:var(--ui-control);font:11px Consolas,monospace}',
'.agent-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}',
'.agent-notice{color:var(--ui-muted);font-size:11px;margin-top:8px;overflow-wrap:anywhere}',
'@media(max-width:600px){.agent-onboard{right:7px;bottom:32px;width:calc(100% - 14px)}}'
].join('\n');
document.head.append(style);
if(getComputedStyle(pane).position==='static')pane.style.position='relative';
const entry=document.createElement('button');entry.type='button';entry.className='tool agent-entry';
const dot=document.createElement('span');dot.className='status';const label=document.createElement('span');
entry.append(dot,label);header.append(entry);
const panel=document.createElement('section');panel.className='agent-onboard';
panel.setAttribute('aria-label','Local Agent Setup');
panel.innerHTML='<header><strong id="agentTitle"></strong><button id="agentClose" type="button" aria-label="Close">×</button></header>'+
'<div class="agent-content"><p id="agentIntro"></p>'+
[1,2,3,4].map(i=>'<div class="agent-step"><b>'+i+'</b><span id="agentStep'+i+'"></span></div>').join('')+
'<div class="agent-actions"><button id="agentDownload" disabled type="button"></button>'+
'<button id="agentOpen" type="button"></button></div>'+
'<div class="agent-notice" id="agentNotice" aria-live="polite"></div></div>';
pane.append(panel);
const $=id=>document.getElementById(id);
const labels={
'zh-TW':['Local Agent','Local Agent 快速配置','首次使用請下載快速配置 CMD，依指引配置本機環境，再於 PowerShell 視窗連線。','下載快速配置 CMD 到 Windows 電腦','執行 CMD，自動檢查 Node.js 與終端環境，必要時安裝','依照 CMD 提示設定允許的網站，取得 Port URL 和 Token','點選 Tool → PowerShell，輸入 Port URL 和 Token','下載快速配置 CMD','開啟 PowerShell','正在讀取公共庫下載來源…','找不到公共庫下載來源，請檢查 Host 連線','已下載 CMD，請到本機執行','Local Agent 已連線','Local Agent 尚未配置'],
en:['Local Agent','Local Agent quick setup','Download the setup CMD and configure Windows locally, then connect PowerShell.','Download the quick-setup CMD to Windows','Run CMD to check or install Node.js and terminal dependencies','Authorize your site and copy the printed Port URL and Token','Open Tool → PowerShell and connect','Download setup CMD','Open PowerShell','Loading PRMU download source…','PRMU source unavailable. Check Host connection.','CMD downloaded. Run it locally.','Local Agent connected','Local Agent not configured'],
fr:['Agent local','Configuration de l’agent local','Téléchargez le CMD puis configurez Windows.','Télécharger le CMD','Exécuter CMD pour installer les dépendances','Autoriser le site et copier URL/Token','Ouvrir Tool → PowerShell','Télécharger CMD','Ouvrir PowerShell','Chargement de PRMU…','Source PRMU indisponible','CMD téléchargé','Connecté','Non configuré'],
ja:['Local Agent','Local Agent の初期設定','CMD をダウンロードして Windows で初期設定してください。','CMD をダウンロード','CMD で Node.js と必要な環境を準備','サイトを許可し URL と Token を取得','Tool → PowerShell で接続','CMD ダウンロード','PowerShell を開く','PRMU を読み込み中…','PRMU に接続できません','CMD をダウンロードしました','接続済み','未設定'],
es:['Agente local','Configuración de agente local','Descargue CMD y configure Windows antes de conectar.','Descargar CMD','Ejecutar CMD e instalar dependencias','Autorizar sitio y copiar URL y Token','Abrir Tool → PowerShell','Descargar CMD','Abrir PowerShell','Cargando PRMU…','PRMU no disponible','CMD descargado','Conectado','No configurado'],
hi:['लोकल एजेंट','लोकल एजेंट सेटअप','CMD डाउनलोड करें और Windows पर कॉन्फ़िगर करें।','CMD डाउनलोड करें','CMD चलाकर आवश्यक निर्भरताएँ स्थापित करें','वेबसाइट स्वीकार करके URL और Token लें','Tool → PowerShell खोलें','सेटअप CMD डाउनलोड','PowerShell खोलें','PRMU लोड हो रहा है…','PRMU अनुपलब्ध','CMD डाउनलोड किया गया','कनेक्टेड','कॉन्फ़िगर नहीं']
};
let lang='zh-TW',connected=false,repo=null,ref='main',ready=false,serial=0;
const t=i=>(labels[lang]||labels.en)[i];
function render(){
label.textContent=connected?t(12):t(13);
$('agentTitle').textContent=t(1);$('agentIntro').textContent=t(2);
for(let i=1;i<=4;i++)$('agentStep'+i).textContent=t(i+2);
$('agentDownload').textContent=t(7);$('agentOpen').textContent=t(8);
$('agentDownload').disabled=!ready;
if(!ready)$('agentNotice').textContent=t(9);
}
function setSource(data){
const d=typeof data==='string'?{repositoryUrl:data}:data?.data||data||{};
const raw=d.repositoryUrl||d.repository?.url||d.repository?.repositoryUrl||d.url;
if(typeof raw!=='string')return;
let url;try{url=new URL(raw)}catch{return;}
const parts=url.pathname.replace(/\.git$/,'').match(/^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/?$/);
if(url.protocol!=='https:'||url.hostname!=='github.com'||!parts)return;
const sourceRef=String(d.ref||d.repositoryRef||d.repository?.ref||'main');
if(!/^[A-Za-z0-9._/-]{1,100}$/.test(sourceRef)||sourceRef.includes('..'))return;
repo={owner:parts[1],name:parts[2]};ref=sourceRef;ready=true;render();
$('agentNotice').textContent='';
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
'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference = \'Stop\'; $base=$env:CLUSTER_SOURCE; $dir=$env:CLUSTER_TARGET; foreach($f in @(\'package.json\',\'server.cjs\',\'Setup-ClusterPowerShell.cmd\')) { Invoke-WebRequest -UseBasicParsing -Uri ($base+$f) -OutFile (Join-Path $dir $f) }"',
'if errorlevel 1 ( echo Download failed. & pause & exit /b 1 )',
'call "%CLUSTER_TARGET%\\Setup-ClusterPowerShell.cmd"',
'if errorlevel 1 ( echo Setup failed. & pause & exit /b 1 )',
'endlocal'].join('\r\n')+'\r\n';
}
$('agentDownload').onclick=()=>{
if(!ready)return;
const url=URL.createObjectURL(new Blob([bootstrap()],{type:'application/octet-stream'}));
const link=document.createElement('a');link.href=url;link.download='ClusterPowerShell-QuickSetup.cmd';
document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
$('agentNotice').textContent=t(11);
};
$('agentClose').onclick=()=>panel.hidden=true;
entry.onclick=()=>panel.hidden=!panel.hidden;
$('agentOpen').onclick=()=>{
const group=document.querySelector('.cluster-tool-group');
const trigger=group?.querySelector('button');
const item=group?.querySelector('.cluster-tool-menu button');
if(group&&!group.hidden&&trigger&&item){trigger.click();item.click();panel.hidden=true;}
else $('agentNotice').textContent=t(10);
};
window.addEventListener('message',event=>{
const m=event.data;if(!m||typeof m!=='object')return;
if(event.source===parent){
if(m.protocol==='cluster.plugin.v1'&&m.type==='response'&&String(m.requestId||'').startsWith('agent-guide-'))setSource(m.data);
const locale=m.language||m.data?.language;if(labels[locale]){lang=locale;render();}
}
const terminal=Array.from(pane.querySelectorAll('iframe')).find(x=>x.title==='ClusterPowerShell');
if(terminal&&event.source===terminal.contentWindow&&m.protocol==='cluster.powershell.status.v1'){
connected=m.connected===true;entry.dataset.connected=String(connected);
panel.hidden=connected;if(!connected)panel.hidden=false;render();
}
});
render();
if(parent!==window){
for(const method of ['PRMU.getCommunityConfig','PRMU.getCommunityRepositoryUrl']){
parent.postMessage({protocol:'cluster.plugin.v1',type:'request',requestId:'agent-guide-'+(++serial),method,args:[]},'*');
}
}
})();
