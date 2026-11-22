/* Workspace Tool integration. No Host modifications or fixed plugin URL. */
(()=>{'use strict';
const toolbar=document.querySelector('.workbench-header');
const pane=document.querySelector('.editor-pane');
const editor=document.getElementById('editorFrame');
if(!toolbar||!pane||!editor)return;
const style=document.createElement('style');
style.textContent=`
.cluster-tool-group{position:relative;display:flex;gap:5px;align-items:center}
.cluster-tool-menu{position:absolute;top:calc(100% + 5px);left:0;z-index:30;min-width:165px;background:var(--ui-panel);border:1px solid var(--ui-border);border-radius:7px;padding:5px;box-shadow:0 12px 35px #0007}
.cluster-tool-menu[hidden]{display:none}
.cluster-tool-menu button{width:100%;text-align:left;background:transparent;color:var(--ui-on-panel,var(--ui-text));border:0;padding:9px;border-radius:5px}
.cluster-tool-menu button:hover{background:var(--ui-hover)}
.cluster-shell-tabs{display:flex;gap:2px;align-items:center;background:var(--ui-panel);border-bottom:1px solid var(--ui-border);height:34px;padding:0 8px}
.cluster-shell-tabs button{background:transparent;color:var(--ui-muted);border:0;border-bottom:2px solid transparent;height:100%;padding:0 13px}
.cluster-shell-tabs button[aria-selected=true]{border-color:var(--ui-accent);color:var(--ui-on-panel,var(--ui-text))}
.cluster-shell-view{min-height:0;flex:1;position:relative}
.cluster-shell-view iframe{height:100%;width:100%;border:0}
.cluster-shell-placeholder{padding:24px;color:var(--ui-muted);font-size:12px}
.cluster-shell-placeholder[hidden]{display:none}
`;
document.head.append(style);
pane.style.display='flex';pane.style.flexDirection='column';
const view=document.createElement('div');view.className='cluster-shell-view';
editor.parentNode.insertBefore(view,editor);view.append(editor);
const psFrame=document.createElement('iframe');psFrame.title='ClusterPowerShell';
psFrame.hidden=true;view.append(psFrame);
const notice=document.createElement('div');notice.className='cluster-shell-placeholder';
notice.hidden=true;view.append(notice);
const tabs=document.createElement('div');tabs.className='cluster-shell-tabs';tabs.hidden=true;
pane.insertBefore(tabs,view);
const editorTab=document.createElement('button');editorTab.type='button';editorTab.dataset.tab='editor';
const psTab=document.createElement('button');psTab.type='button';psTab.dataset.tab='powershell';
tabs.append(editorTab,psTab);
const group=document.createElement('div');group.className='cluster-tool-group';
const trigger=document.createElement('button');trigger.type='button';trigger.className='tool';
trigger.setAttribute('aria-haspopup','true');trigger.setAttribute('aria-expanded','false');
const menu=document.createElement('div');menu.className='cluster-tool-menu';menu.hidden=true;
menu.setAttribute('role','menu');
const item=document.createElement('button');item.type='button';item.setAttribute('role','menuitem');
menu.append(item);group.append(trigger,menu);
const toggle=document.getElementById('toggleExplorer');
toggle.after(group);
group.hidden=false; // Tool must remain accessible before Local Agent / capability init.
let language='zh-TW',loaded=false,requestId='',lastContext=null,selected='editor';
let communityRequest='',fallbackInFlight=false;
const labels={
'zh-TW':['工具 ▾','PowerShell','編輯器','PowerShell 插件尚未提供 workspace.powershell.v1 能力；請先裝載並啟用插件。'],
en:['Tools ▾','PowerShell','Editor','PowerShell capability is unavailable. Install and enable the plugin first.'],
fr:['Outils ▾','PowerShell','Éditeur','Le module PowerShell est indisponible. Installez et activez-le.'],
ja:['ツール ▾','PowerShell','エディター','PowerShell プラグインをインストールして有効化してください。'],
es:['Herramientas ▾','PowerShell','Editor','Instale y active primero el complemento PowerShell.'],
hi:['टूल ▾','PowerShell','एडिटर','पहले PowerShell प्लगइन इंस्टॉल और सक्रिय करें।']
};
function localize(){const l=labels[language]||labels.en;trigger.textContent=l[0];item.textContent=l[1];editorTab.textContent=l[2];psTab.textContent=l[1];}
function select(which){
selected=which;
const ps=which==='powershell';
editor.hidden=ps;psFrame.hidden=!ps||!loaded;
notice.hidden=!ps||loaded;
tabs.hidden=false;
for(const button of tabs.querySelectorAll('button'))button.setAttribute('aria-selected',String(button.dataset.tab===which));
window.dispatchEvent(new CustomEvent('cluster-powershell-view',{detail:{selected:ps}}));
if(ps&&!loaded){notice.hidden=true;discover();requestCommunityFallback();}
}
function closeMenu(){menu.hidden=true;trigger.setAttribute('aria-expanded','false');}
trigger.onclick=()=>{menu.hidden=!menu.hidden;trigger.setAttribute('aria-expanded',String(!menu.hidden));};
item.onclick=()=>{closeMenu();select('powershell');};
editorTab.onclick=()=>select('editor');psTab.onclick=()=>select('powershell');
document.addEventListener('pointerdown',event=>{if(!group.contains(event.target))closeMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
function discover(){if(window.parent===window)return;
requestId='cluster-ps-capability-'+Date.now();
parent.postMessage({protocol:'cluster.plugin.v1',type:'request',requestId,
method:'PRMU.resolveCapability',args:['workspace.powershell.v1']},'*');
}

function mountPowerShell(html, version){
 if(loaded||typeof html!=='string'||html.length>2000000)return;
 loaded=true;group.hidden=false;
 psFrame.srcdoc=html;notice.hidden=true;psFrame.hidden=selected!=='powershell';
 psFrame.addEventListener('load',()=>{
  if(lastContext)psFrame.contentWindow?.postMessage(lastContext,'*');
 },{once:true});
}
function requestCommunityFallback(){
 if(loaded||fallbackInFlight||selected!=='powershell'||parent===window)return;
 fallbackInFlight=true;
 communityRequest='cluster-ps-community-'+Date.now();
 parent.postMessage({protocol:'cluster.plugin.v1',type:'request',
  requestId:communityRequest,method:'PRMU.getCommunityConfig',args:[]},'*');
 setTimeout(()=>{if(!loaded)fallbackInFlight=false;},6500);
}
async function mountFromConfiguredCommunity(source){
 try{
  const obj=typeof source==='string'?{repositoryUrl:source}:source?.data||source||{};
  const raw=obj.repositoryUrl||obj.repository?.url||obj.repository?.repositoryUrl||obj.url;
  const parsed=new URL(raw);
  const match=parsed.pathname.replace(/\.git$/,'').match(/^\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/?$/);
  if(parsed.protocol!=='https:'||parsed.hostname!=='github.com'||!match)
   throw Error('Invalid community repository configuration');
  const ref=String(obj.ref||obj.repositoryRef||obj.repository?.ref||'main');
  if(!/^[a-zA-Z0-9._/-]{1,120}$/.test(ref)||ref.includes('..'))
   throw Error('Invalid community repository ref');
  const prefix='https://raw.githubusercontent.com/'+match[1]+'/'+match[2]+'/'+ref+'/';
  async function read(path){
   const response=await fetch(prefix+path,{cache:'no-store'});
   if(!response.ok)throw Error('Community file unavailable');
   const content=await response.text();
   if(content.length>2000000)throw Error('Community file too large');
   return content;
  }
  const index=JSON.parse(await read('community-index.json'));
  const plugin=index.plugins?.find(entry=>entry.id==='cluster.powershell');
  if(!plugin||!/^plugins\/[a-zA-Z0-9._-]+$/.test(plugin.directory))
   throw Error('PowerShell plugin not in configured community registry');
  const manifest=JSON.parse(await read(plugin.directory+'/manifest.json'));
  if(manifest.id!=='cluster.powershell'||manifest.version!==plugin.version||
     manifest.entry!=='index.html')throw Error('Manifest mismatch');
  mountPowerShell(await read(plugin.directory+'/'+manifest.entry),manifest.version);
 }catch(error){
  console.warn('ClusterPowerShell UI fallback unavailable:',error);
 }finally{fallbackInFlight=false;}
}
window.addEventListener('message',event=>{
const m=event.data;
if(event.source===parent&&m?.protocol==='cluster.plugin.v1'&&m.type==='response'&&m.requestId===requestId){
if(!m.ok||typeof m.data?.html!=='string'){
 requestCommunityFallback();return;
}
mountPowerShell(m.data.html,m.data.version);
}
if(event.source===parent&&m?.protocol==='cluster.plugin.v1'&&
 m.type==='response'&&m.requestId===communityRequest){
 if(m.ok)mountFromConfiguredCommunity(m.data);
 else fallbackInFlight=false;
 return;
}
if(event.source===parent&&
  ((m?.protocol==='cluster.plugin.v1'&&m.type==='context')||
   (m?.protocol==='cluster.public.v1'&&['snapshot','properties.changed'].includes(m.type))||
   m?.protocol==='cluster.settings.context.v1')){
lastContext=m;
const lang=m.language||m.data?.language;
if(labels[lang]){language=lang;localize();}
if(loaded)psFrame.contentWindow?.postMessage(m,'*');
}
});
localize();
discover();
const discoveryInterval=setInterval(()=>{if(loaded)clearInterval(discoveryInterval);else if(selected==='powershell')discover();},4000);
})();
