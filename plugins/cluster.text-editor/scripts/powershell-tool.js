/* Workspace Tool integration. No Host modifications or fixed plugin URL. */
(()=>{'use strict';
const toolbar=document.querySelector('.workbench-header');
const pane=document.querySelector('.editor-pane');
const editor=document.getElementById('editorFrame');
if(!toolbar||!pane||!editor)return;
const style=document.createElement('style');
style.textContent=`
.cluster-tool-group{position:relative;display:flex;gap:5px;align-items:center}
.cluster-tool-menu{position:absolute;top:calc(100% + 7px);left:0;z-index:50;min-width:215px;background:var(--ui-panel);border:1px solid var(--ui-border);border-radius:9px;padding:6px;box-shadow:0 16px 40px #0009}
.cluster-tool-menu[hidden]{display:none}
.cluster-tool-menu button{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:transparent;color:var(--ui-on-panel,var(--ui-text));border:0;padding:10px;border-radius:6px;font:500 12px system-ui;cursor:pointer}
.cluster-tool-menu button:hover,.cluster-tool-menu button:focus-visible{background:var(--ui-hover);outline:1px solid var(--ui-accent)}
.cluster-tool-menu .section-label{padding:7px 9px;color:var(--ui-muted);font:600 9px Consolas,monospace;letter-spacing:1px;border-bottom:1px solid var(--ui-border);margin-bottom:5px}
.cluster-tool-menu .menu-glyph{display:inline-grid;place-items:center;flex:none;width:26px;height:26px;border-radius:5px;background:var(--ui-control);color:var(--ui-accent);font:600 12px Consolas,monospace}
.cluster-tool-menu .menu-detail{display:block;font:10px system-ui;color:var(--ui-muted);margin-top:3px}
.cluster-tool-group>.tool{border:1px solid var(--ui-border);background:var(--ui-control);color:var(--ui-on-control,var(--ui-text));border-radius:6px;padding:6px 11px;font-weight:600}
.cluster-tool-group>.tool:hover,.cluster-tool-group>.tool[aria-expanded=true]{background:var(--ui-hover);border-color:var(--ui-accent)}
.cluster-shell-tabs{display:none!important;gap:2px;align-items:center;background:var(--ui-panel);border-bottom:1px solid var(--ui-border);height:34px;padding:0 8px}
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
const section=document.createElement('div');section.className='section-label';
const glyph=document.createElement('span');glyph.className='menu-glyph';glyph.textContent='>_';
const content=document.createElement('span');const name=document.createElement('strong');
const detail=document.createElement('small');detail.className='menu-detail';
content.append(name,detail);item.replaceChildren(glyph,content);
const agentItem=document.createElement('button');agentItem.type='button';agentItem.setAttribute('role','menuitem');
const agentGlyph=document.createElement('span');agentGlyph.className='menu-glyph';agentGlyph.textContent='✧';
const agentBody=document.createElement('span');const agentName=document.createElement('strong');
agentName.textContent='AI Agent MCP';const agentHint=document.createElement('small');agentHint.className='menu-detail';
agentBody.append(agentName,agentHint);agentItem.append(agentGlyph,agentBody);
menu.append(section,item,agentItem);group.append(trigger,menu);
const toggle=document.getElementById('toggleExplorer');
toggle.before(group);
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
function localize(){const l=labels[language]||labels.en;trigger.textContent=l[0];name.textContent=l[1];detail.textContent=({ 'zh-TW':'本地終端與多工作階段',en:'Local terminal sessions',fr:'Terminal local',ja:'ローカル端末',es:'Terminal local',hi:'लोकल टर्मिनल' })[language]||'Local terminal';agentHint.textContent=({ 'zh-TW':'MCP 動作與 PowerShell 紀錄',en:'MCP actions and terminal activity',fr:'Activité MCP et terminal',ja:'MCP と端末の記録',es:'Actividad MCP y terminal',hi:'MCP और टर्मिनल गतिविधि'})[language]||'MCP activity';section.textContent=({ 'zh-TW':'工具 / 插件',en:'TOOLS / PLUGINS',fr:'OUTILS / PLUGINS',ja:'ツール / プラグイン',es:'HERRAMIENTAS',hi:'टूल / प्लगइन' })[language]||'TOOLS';editorTab.textContent=l[2];psTab.textContent=l[1];}
function select(which){
selected=which;
const ps=which==='powershell';
editor.hidden=ps;psFrame.hidden=!ps||!loaded;
notice.hidden=!ps||loaded;
tabs.hidden=false;
for(const button of tabs.querySelectorAll('button'))button.setAttribute('aria-selected',String(button.dataset.tab===which));
window.dispatchEvent(new CustomEvent('cluster-powershell-view',{detail:{selected:ps}}));
window.dispatchEvent(new CustomEvent('cluster-workspace-select',{detail:{selected:which}}));
if(ps&&!loaded){notice.hidden=true;discover();requestCommunityFallback();}
}
function closeMenu(){menu.hidden=true;trigger.setAttribute('aria-expanded','false');}
trigger.onclick=()=>{menu.hidden=!menu.hidden;trigger.setAttribute('aria-expanded',String(!menu.hidden));};
agentItem.onclick=()=>{closeMenu();window.dispatchEvent(new Event('cluster-ai-agent-open'));};
item.onclick=()=>{closeMenu();select('powershell');
window.dispatchEvent(new CustomEvent('cluster-powershell-new-tab'));};
editorTab.onclick=()=>select('editor');psTab.onclick=()=>select('powershell');
document.addEventListener('pointerdown',event=>{if(!group.contains(event.target))closeMenu();},true);
document.addEventListener('focusin',event=>{if(!group.contains(event.target))closeMenu();});
window.addEventListener('blur',closeMenu);
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
