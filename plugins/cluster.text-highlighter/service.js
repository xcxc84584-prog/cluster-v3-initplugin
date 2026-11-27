(() => {
'use strict';
const E=globalThis.ClusterHighlightEngine;
const protocol='cluster.plugin.v1';
const MAX_TEXT=1024*1024, MAX_CACHE=16*1024*1024, MAX_QUEUE=8;
let worker=null, running=null, serial=0, bytes=0, registered=false, registering=false;
const registeredActions=new Set();
let base='#17191e', colors=E.palette(base);
const queue=[], cache=new Map(), pending=new Map();
function post(message){parent.postMessage({protocol,...message},'*');}
function rpc(method,...args){return new Promise((resolve,reject)=>{
 const requestId='highlight-register-'+(++serial);
 const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('Host timeout'));},5000);
 pending.set(requestId,{resolve,reject,timer});post({type:'request',requestId,method,args});
});}
function stopWorker(){if(worker){worker.terminate();worker=null;}}
function finish(result,error){const task=running;if(!task)return;running=null;clearTimeout(task.timer);
 if(error){stopWorker();task.reject(Error(error));}else task.resolve(result);pump();}
function pump(){if(running||!queue.length)return;running=queue.shift();
 try{if(!worker){const url=URL.createObjectURL(new Blob([E.workerSource()],{type:'text/javascript'}));
 try{worker=new Worker(url);}finally{URL.revokeObjectURL(url);}
 worker.onmessage=e=>{if(e.data.id===running?.id)finish(e.data.result,e.data.error);};
 worker.onerror=()=>finish(null,'Worker execution failed');}
 running.timer=setTimeout(()=>finish(null,'Highlight time limit'),1800);
 worker.postMessage({id:running.id,text:running.text,language:running.language});
 }catch(error){finish(null,String(error.message||error));}}
function calculate(text,language){return new Promise((resolve,reject)=>{
 if(queue.length>=MAX_QUEUE){reject(Error('Highlight queue full'));return;}
 queue.push({id:++serial,text,language,resolve,reject});pump();
});}
const inflight=new Map();
async function tokenize(p){
 if(typeof p?.text!=='string'||p.text.length>MAX_TEXT)return {revision:p?.revision??null,language:'plain',types:E.kinds,tokens:[],palette:colors,degraded:true};
 const language=E.language(p.language,p.filename);
 if(language==='plain')return {revision:p.revision??null,language,types:E.kinds,tokens:[],palette:colors};
 // Exact input identity avoids hash collisions. Bound both key and output memory.
 const key=language+'\0'+p.text;let result=cache.get(key)?.result;
 if(result){const entry=cache.get(key);cache.delete(key);cache.set(key,entry);}
 else{let task=inflight.get(key);if(!task){task=calculate(p.text,language).then(value=>{
 const size=key.length*2+value.tokens.length*8+256;
 if(size<=MAX_CACHE){while(cache.size&&bytes+size>MAX_CACHE){const first=cache.keys().next().value;bytes-=cache.get(first).size;cache.delete(first);}
 cache.set(key,{size,result:value});bytes+=size;}return value;
 }).finally(()=>inflight.delete(key));inflight.set(key,task);}
 try{result=await task;}catch{return {revision:p.revision??null,language,types:E.kinds,tokens:[],palette:colors,degraded:true};}}
 return {...result,revision:p.revision??null,language,palette:colors};
}
const methods={'highlight.tokenize':tokenize,'highlight.languages':()=>({languages:E.languages}),'highlight.detect':p=>({language:E.language(p?.language,p?.filename)}),'highlight.palette':()=>({palette:colors})};
async function register(){if(registered||registering)return;registering=true;
 try{
  for(const action of Object.keys(methods)){if(registeredActions.has(action))continue;
   const r=await rpc('Router.register',action,'runtime-callback',{contract:{version:'1.0.0',description:action,request:{type:'object'},response:{type:'object'}}});
   if(!r.ok)throw Error(r.error?.message||action);registeredActions.add(action);}
  const r=await rpc('PRMU.register','capabilities',{key:'workspace.highlight.v1',value:{kind:'service',version:'1.0.0',action:'highlight.tokenize'},sharedWrite:false,persistent:false});
  if(!r.ok&&r.error?.code!=='ALREADY_REGISTERED')throw Error(r.error?.message||'Capability registration failed');
  registered=true;
 }catch(error){console.warn('Highlight registration:',error);setTimeout(register,2000);}
 finally{registering=false;}}
window.addEventListener('message',event=>{if(event.source!==parent)return;const m=event.data;if(m?.protocol!==protocol)return;
 if(m.type==='context'){const next=m.palette?.editor||m.palette?.background||m.baseColor;if(next&&next!==base){base=next;colors=E.palette(base);}void register();return;}
 if(m.type==='response'){const p=pending.get(m.requestId);if(p){clearTimeout(p.timer);pending.delete(m.requestId);p.resolve(m);}return;}
 if(m.type==='invoke'){Promise.resolve().then(()=>{if(!methods[m.action])throw Error('Unknown highlight action');return methods[m.action](m.payload||{});}).then(data=>post({type:'invoke-result',requestId:m.requestId,ok:true,data}),error=>post({type:'invoke-result',requestId:m.requestId,ok:false,error:{code:'HIGHLIGHT_FAILED',message:String(error.message||error)}}));}
});
window.addEventListener('pagehide',stopWorker);
if(parent!==window)post({type:'hello'});
})();
