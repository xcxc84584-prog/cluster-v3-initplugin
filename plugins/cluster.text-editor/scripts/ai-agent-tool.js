/* AI Agent plugin loader: PRMU capability discovery and community fallback only.
 * It creates an iframe in the existing workspace view; no new browser window.
 */
(()=>{'use strict';
const pane=document.querySelector('.editor-pane');
const view=pane?.querySelector('.cluster-shell-view');
const editor=document.getElementById('editorFrame');
const ps=Array.from(view?.querySelectorAll('iframe')||[]).find(f=>f.title==='ClusterPowerShell');
if(!view||!editor)return;
const agent=document.createElement('iframe');agent.title='Cluster AI Agent MCP';
agent.hidden=true;agent.dataset.provider='cluster.ai-agent-mcp';view.append(agent);
let loaded=false,selected=false,context=null,sequence=0,resolveId='',repositoryId='';
function show(){
 selected=true;editor.hidden=true;if(ps)ps.hidden=true;
 agent.hidden=false;
 window.dispatchEvent(new CustomEvent('cluster-ai-agent-view',{detail:{selected:true}}));
 if(!loaded){discover();lookup();}
}
function hide(){
 selected=false;agent.hidden=true;
 window.dispatchEvent(new CustomEvent('cluster-ai-agent-view',{detail:{selected:false}}));
}
function mount(content){
 if(loaded||typeof content!=='string'||content.length>500000)return;
 loaded=true;agent.srcdoc=content;
 agent.addEventListener('load',()=>{if(context)agent.contentWindow?.postMessage(context,'*');},{once:true});
}
function discover(){
 if(parent===window)return;
 resolveId='agent-ui-resolve-'+(++sequence);
 parent.postMessage({protocol:'cluster.plugin.v1',type:'request',requestId:resolveId,
 method:'PRMU.resolveCapability',args:['workspace.ai-agent-mcp.v1']},'*');
}
function lookup(){
 if(parent===window)return;
 repositoryId='agent-ui-community-'+(++sequence);
 parent.postMessage({protocol:'cluster.plugin.v1',type:'request',requestId:repositoryId,
 method:'PRMU.getCommunityConfig',args:[]},'*');
}
async function fromCommunity(source){
 try{
  const data=typeof source==='string'?{repositoryUrl:source}:source?.data||source||{};
  const raw=data.repositoryUrl||data.url||data.repository?.url;
  const url=new URL(raw);
  const path=url.pathname.replace(/\.git$/,'');
  const match=path.match(/^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/?$/);
  if(url.hostname!=='github.com'||url.protocol!=='https:'||!match)throw Error('Invalid community repository');
  const ref=String(data.ref||data.repositoryRef||'main');
  if(!/^[A-Za-z0-9._/-]{1,120}$/.test(ref)||ref.includes('..'))throw Error('Invalid version ref');
  const prefix='https://raw.githubusercontent.com/'+match[1]+'/'+match[2]+'/'+ref+'/';
  async function read(path){
   const response=await fetch(prefix+path,{cache:'no-store'});
   if(!response.ok)throw Error('Community resource unavailable');
   const value=await response.text();if(value.length>500000)throw Error('Asset size limit');
   return value;
  }
  const registry=JSON.parse(await read('community-index.json'));
  const entry=registry.plugins?.find(p=>p.id==='cluster.ai-agent-mcp');
  if(!entry||entry.directory!=='plugins/cluster.ai-agent-mcp')throw Error('AI Agent plugin not registered');
  const manifest=JSON.parse(await read(entry.directory+'/manifest.json'));
  if(manifest.id!==entry.id||manifest.version!==entry.version||manifest.entry!=='index.html')
   throw Error('AI Agent manifest mismatch');
  mount(await read(entry.directory+'/'+manifest.entry));
 }catch(error){console.warn('AI Agent UI not available:',error.message);}
}
window.addEventListener('cluster-ai-agent-open',show);
window.addEventListener('cluster-workspace-select',event=>{
 if(event.detail?.selected!=='agent'&&selected)hide();
});
// Route only messages from the installed AI Agent frame to our own Editor.
const editorPending=new Map();
window.addEventListener('message',event=>{
 const msg=event.data;
 if(event.source===agent.contentWindow&&
    msg?.protocol==='cluster.ai-agent.editor.v1'&&msg.type==='req'){
  const allowed=new Set(['workspace.snapshot','tabs.list','document.get','document.open','document.update']);
  if(!allowed.has(msg.action)||typeof msg.requestId!=='string'||msg.requestId.length>96)return;
  if(editorPending.size>=16)return;
  const requestId='agent-editor-'+(++sequence);
  const timer=setTimeout(()=>{
   editorPending.delete(requestId);
   agent.contentWindow?.postMessage({protocol:'cluster.ai-agent.editor.v1',
    type:'rep',requestId:msg.requestId,ok:false,error:'Editor timeout'},'*');
  },12000);
  editorPending.set(requestId,{timer,original:msg.requestId});
  editor.contentWindow?.postMessage({protocol:'cluster.editor.v1',type:'req',
   version:'1.0.0',requestId,action:msg.action,params:msg.params||{}},'*');
  return;
 }
 if(event.source===editor.contentWindow&&msg?.protocol==='cluster.editor.v1'&&
    msg.type==='rep'&&editorPending.has(msg.requestId)){
  const pending=editorPending.get(msg.requestId);
  clearTimeout(pending.timer);editorPending.delete(msg.requestId);
  agent.contentWindow?.postMessage({protocol:'cluster.ai-agent.editor.v1',
   type:'rep',requestId:pending.original,ok:msg.ok,
   data:msg.data,error:msg.error?.message},'*');
  return;
 }
});
window.addEventListener('message',event=>{
 const msg=event.data;if(event.source!==parent||!msg)return;
 if(msg.protocol==='cluster.plugin.v1'&&msg.type==='response'&&msg.requestId===resolveId){
  if(msg.ok&&typeof msg.data?.html==='string')mount(msg.data.html);
  else lookup();return;
 }
 if(msg.protocol==='cluster.plugin.v1'&&msg.type==='response'&&msg.requestId===repositoryId){
  if(msg.ok)fromCommunity(msg.data);return;
 }
 if((msg.protocol==='cluster.plugin.v1'&&msg.type==='context')||
    (msg.protocol==='cluster.public.v1'&&['snapshot','properties.changed'].includes(msg.type))||
    msg.protocol==='cluster.settings.context.v1'){
  context=msg;if(loaded)agent.contentWindow?.postMessage(msg,'*');
 }
});
})();
