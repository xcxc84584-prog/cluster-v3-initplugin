/* One Cluster workspace tab bar for documents and native PowerShell sessions.
 * The child editor/terminal remains responsible for its own data and lifetime.
 */
(()=>{'use strict';
const pane=document.querySelector('.editor-pane');
const editor=document.getElementById('editorFrame');
if(!pane||!editor)return;
const style=document.createElement('style');
style.textContent=[
'.unified-tabbar{height:35px;flex:none;display:flex;gap:2px;align-items:stretch;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;padding:0 8px;background:var(--ui-panel,var(--panel));border-bottom:1px solid var(--ui-border,var(--edge))}',
'.unified-tabbar button{display:flex;flex:none;align-items:center;gap:7px;max-width:220px;min-width:0;padding:0 11px;color:var(--ui-muted,var(--muted));background:transparent;border:0;border-bottom:2px solid transparent;font:11px system-ui;cursor:pointer}',
'.unified-tabbar button:hover,.unified-tabbar button[aria-selected=true]{background:var(--ui-hover,var(--panel));color:var(--ui-text,var(--text))}',
'.unified-tabbar button[aria-selected=true]{border-bottom-color:var(--ui-accent,var(--accent))}',
'.unified-tabbar .tab-name{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
'.unified-tabbar .tab-glyph{font:600 12px Consolas,monospace;color:var(--ui-accent,var(--accent))}',
'.unified-tabbar .tab-close{padding:2px 5px;margin-left:3px;border-radius:4px;color:var(--ui-muted,var(--muted))}',
'.unified-tabbar .tab-close:hover{background:var(--ui-control,var(--panel));color:var(--ui-text,var(--text))}'
].join('\n');
document.head.append(style);
const tabbar=document.createElement('nav');tabbar.className='unified-tabbar';
tabbar.setAttribute('role','tablist');tabbar.setAttribute('aria-label','Workspace documents and PowerShell terminals');
const view=pane.querySelector('.cluster-shell-view');
if(!view)return;
pane.insertBefore(tabbar,view);
const documents=new Map();
let activeDocument=null,activePowerShell=null,psSessions=[];
let selected='editor',psOpened=false,psConnected=false,aiOpened=false,serial=0,snapshotTimer=0;
const terminal=()=>Array.from(view.querySelectorAll('iframe')).find(x=>x.title==='ClusterPowerShell');
function editorRequest(action,params){
editor.contentWindow?.postMessage({protocol:'cluster.editor.v1',type:'req',
version:'1.0.0',requestId:'unified-view-'+(++serial),action,params:params||{}},'*');
}
function psRequest(type,sessionId){
terminal()?.contentWindow?.postMessage({protocol:'cluster.powershell.tabs.v1',
 type,sessionId:sessionId||null},'*');
}
function goEditor(documentId){
const fileTab=pane.querySelector('.cluster-shell-tabs button[data-tab="editor"]');
if(fileTab)fileTab.click();
selected='editor';
if(documentId!=null)editorRequest('tabs.activate',{id:String(documentId)});
render();
}
function goPowershell(sessionId){
const psTab=pane.querySelector('.cluster-shell-tabs button[data-tab="powershell"]');
if(psTab)psTab.click();
selected='powershell';psOpened=true;
if(sessionId)psRequest('activate',sessionId);
render();
}
function addTab(kind,id,title,dirty,active,onClick,onClose){
const btn=document.createElement('button');btn.type='button';btn.setAttribute('role','tab');
btn.setAttribute('aria-selected',String(active));btn.title=title;
const glyph=document.createElement('span');glyph.className='tab-glyph';glyph.textContent=kind==='ps'?'>_':'◇';
const name=document.createElement('span');name.className='tab-name';name.textContent=title;
btn.append(glyph,name);
if(dirty){const mark=document.createElement('span');mark.className='tab-glyph';mark.textContent='●';btn.append(mark);}
if(onClose){
const close=document.createElement('span');close.className='tab-close';close.textContent='×';
close.setAttribute('aria-label','Close '+title);
close.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();onClose();});
btn.append(close);
btn.addEventListener('auxclick',e=>{if(e.button===1){e.preventDefault();onClose();}});
}
btn.addEventListener('click',onClick);tabbar.append(btn);
}
function render(){
tabbar.replaceChildren();
for(const d of documents.values()){
addTab('doc',d.id,d.name||'Untitled',d.dirty,
selected==='editor'&&String(activeDocument)===d.id,
()=>goEditor(d.id),()=>editorRequest('document.close',{id:d.id}));
}
if(aiOpened){
 addTab('agent','ai-agent','AI Agent MCP',false,selected==='agent',
  ()=>window.dispatchEvent(new Event('cluster-ai-agent-open')),
  ()=>{aiOpened=false;goEditor();});
}
if(psOpened||psSessions.length){
if(psSessions.length===0){
addTab('ps','pending','PowerShell',false,selected==='powershell',
()=>goPowershell(),()=>{psOpened=false;goEditor();});
}else{
for(const s of psSessions){
addTab('ps',s.id,s.name,false,selected==='powershell'&&activePowerShell===s.id,
()=>goPowershell(s.id),()=>psRequest('close',s.id));
}
const add=document.createElement('button');add.type='button';add.title='New PowerShell session';
add.textContent='+';add.setAttribute('aria-label','New PowerShell session');
add.addEventListener('click',()=>{goPowershell();psRequest('create');});
tabbar.append(add);
}
}
}
function setDocument(doc){
if(!doc||doc.id==null)return;
const id=String(doc.id);
documents.set(id,{id,name:String(doc.name||'Untitled'),dirty:doc.dirty===true});
if(doc.active===true)activeDocument=id;
render();
}
function scheduleSnapshot(){
clearTimeout(snapshotTimer);
snapshotTimer=setTimeout(()=>editorRequest('workspace.snapshot',{}),90);
}
function updatePowerShell(msg){
if(!Array.isArray(msg.sessions))return;
psSessions=msg.sessions.filter(x=>typeof x.id==='string'&&typeof x.name==='string');
psConnected=msg.connected===true;
if(msg.activeId&&psSessions.some(x=>x.id===msg.activeId))activePowerShell=msg.activeId;
else activePowerShell=psSessions[0]?.id||null;
if(msg.closedLast&&psSessions.length===0){
psOpened=false;goEditor();return;
}
render();
}
// Hide only the duplicated child tab widgets, never its document content or APIs.
function hideChildTabbar(){
try{
const inner=editor.contentDocument;
if(inner?.head&&!inner.getElementById('unified-tab-presentation')){
const css=inner.createElement('style');css.id='unified-tab-presentation';
css.textContent='nav#tabs{display:none!important}';
inner.head.append(css);
}
}catch{/* Cross-origin child keeps native tabs rather than risking document damage. */}
}
editor.addEventListener('load',()=>{hideChildTabbar();setTimeout(scheduleSnapshot,125);});
window.addEventListener('cluster-ai-agent-view',event=>{
 if(event.detail?.selected===true){selected='agent';aiOpened=true;render();}
 else if(selected==='agent'){selected='editor';render();}
});
window.addEventListener('cluster-powershell-new-tab',()=>{
 if(psConnected)psRequest('create');
});
window.addEventListener('cluster-workspace-select',event=>{
selected=event.detail?.selected==='powershell'?'powershell':'editor';
if(selected==='powershell')psOpened=true;
render();
});
window.addEventListener('message',event=>{
const msg=event.data;if(!msg||typeof msg!=='object')return;
if(event.source===editor.contentWindow&&msg.protocol==='cluster.editor.v1'){
if(msg.type==='event'){
if(msg.event==='document.opened'||msg.event==='document.saved'||
   msg.event==='document.changed'||msg.event==='tab.activated'){
const doc=msg.data?.document;
if(doc)setDocument(doc);
if(msg.event==='tab.activated'&&doc){
activeDocument=String(doc.id);
if(selected==='powershell')goEditor();
}
}else if(msg.event==='document.closed'){
documents.delete(String(msg.data?.id));
if(String(activeDocument)===String(msg.data?.id))activeDocument=null;
scheduleSnapshot();render();
}
}
if(msg.type==='rep'&&String(msg.requestId||'').startsWith('unified-view-')&&
  Array.isArray(msg.data?.documents)){
documents.clear();for(const d of msg.data.documents)setDocument(d);
activeDocument=msg.data.activeId==null?null:String(msg.data.activeId);render();
}
}
if(event.source===terminal()?.contentWindow&&msg.protocol==='cluster.powershell.tabs.v1'){
 if(msg.type==='hello')psRequest('request-state');
 if(msg.type==='state')updatePowerShell(msg);
}
});
hideChildTabbar();
scheduleSnapshot();
render();
})();
