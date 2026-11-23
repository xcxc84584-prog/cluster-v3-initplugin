'use strict';
/* Authorized local workspace roots. Paths originate ONLY from the Windows
 * folder picker launched by this agent, never from browser-supplied strings.
 * File operations are independently rechecked against stored permissions.
 */
const fs=require('node:fs');
const path=require('node:path');
const {execFile}=require('node:child_process');
const RIGHTS=['create','read','update','delete','powershell','auto'];
function normalizeRights(input){
 const obj={};
 for(const key of RIGHTS)obj[key]=input&&input[key]===true;
 // Migrate the legacy PS-only grant to the single per-root AUTO switch.
 // AUTO never grants an action: each operation still checks its own right.
 obj.auto=obj.auto||input?.autoPowershell===true;
 return obj;
}
function createRootAccess({directory,platform=process.platform,picker}={}){
 if(platform!=='win32')throw Error('Native root picker is Windows-only');
 const store=path.join(directory,'authorized-roots.json');
 const roots=new Map();
 function storeRoots(){
  const output=[...roots.values()];
  const tmp=store+'.new';
  fs.writeFileSync(tmp,JSON.stringify({schemaVersion:1,roots:output},null,2),{mode:0o600});
  fs.renameSync(tmp,store);
 }
 try {
  const old=JSON.parse(fs.readFileSync(store,'utf8'));
  if(old.schemaVersion===1&&Array.isArray(old.roots)){
   for(const entry of old.roots){
    if(typeof entry.id!=='string'||!/^[a-f0-9]{24}$/.test(entry.id)||
       typeof entry.absolutePath!=='string')continue;
    const root=fs.realpathSync.native(entry.absolutePath);
    if(root!==entry.absolutePath||!path.win32.isAbsolute(root)||!fs.statSync(root).isDirectory())continue;
    roots.set(entry.id,{id:entry.id,name:path.basename(root),absolutePath:root,
      rights:normalizeRights(entry.rights)});
   }
  }
 }catch{/* No pre-existing grant. */}
 function listing(){
  return [...roots.values()].map(x=>({id:x.id,name:x.name,absolutePath:x.absolutePath,
   rights:{...x.rights},authorized:true}));
 }
 function find(id){
  const item=roots.get(id)||[...roots.values()].find(x=>x.name===id);
  if(!item)throw Error('Root not authorized');
  const actual=fs.realpathSync.native(item.absolutePath);
  if(actual!==item.absolutePath||!fs.statSync(actual).isDirectory())throw Error('Root changed; reselect required');
  return item;
 }
 function requireRight(root,right){
  if(!RIGHTS.includes(right)||!root.rights[right])throw Error(right+' permission denied by local Agent');
 }
 async function choose(){
  let chosen;
  if(picker)chosen=await picker();
  else chosen=await new Promise((resolve,reject)=>{
   const script=path.join(__dirname,'Select-Local-Root.ps1');
   execFile('powershell.exe',['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',script],
    {windowsHide:false,timeout:180000,maxBuffer:8192},
    (error,stdout)=>{
     if(error){reject(Error('Windows folder selection cancelled or unavailable'));return;}
     resolve(stdout.trim().split(/\r?\n/).filter(Boolean).at(-1)||'');
    });
  });
  if(!chosen)throw Error('No folder selected');
  const actual=fs.realpathSync.native(chosen);
  if(!path.win32.isAbsolute(actual)||!fs.statSync(actual).isDirectory())
   throw Error('Selected root is not an absolute Windows folder');
  const id=require('node:crypto').randomBytes(12).toString('hex');
  roots.set(id,{id,name:path.basename(actual),absolutePath:actual,
   rights:normalizeRights({})});storeRoots();
  return find(id);
 }
 function update(id,rights){
  const root=find(id);root.rights=normalizeRights(rights);storeRoots();
  return {id:root.id,name:root.name,absolutePath:root.absolutePath,rights:root.rights};
 }
 function remove(id){
  if(!roots.has(id))throw Error('Unknown root');
  roots.delete(id);storeRoots();
  return {removed:true};
 }
 function locate(rootId,relative,required,allowMissing=false){
  const root=find(rootId);requireRight(root,required);
  if(typeof relative!=='string'||relative.length>1024||relative.startsWith('/')||
    relative.includes('\\')||relative.includes('\0'))throw Error('Invalid relative path');
  const parts=relative.split('/').filter(Boolean);
  if(parts.some(v=>v==='.'||v==='..'||v.includes(':')))throw Error('Unsafe relative path');
  const target=path.resolve(root.absolutePath,...parts);
  const contained=(p)=>p.toLowerCase()===root.absolutePath.toLowerCase()||
   p.toLowerCase().startsWith(root.absolutePath.toLowerCase()+path.sep);
  if(!contained(target))throw Error('Path escapes authorized root');
  const parent=fs.realpathSync.native(target.toLowerCase()===root.absolutePath.toLowerCase()?target:path.dirname(target));
  if(!contained(parent))throw Error('Symlink exits authorized root');
  if(!allowMissing){
   const existing=fs.realpathSync.native(target);
   if(!contained(existing))throw Error('Symlink exits authorized root');
  }
  return {root,target};
 }
 async function action(input){
  const {id,action,relative=''}=input||{};
  if(typeof id!=='string')throw Error('Missing root identifier');
  if(action==='list'){
   const {target}=locate(id,relative,'read');
   const entries=await fs.promises.readdir(target,{withFileTypes:true});
   return {path:relative,entries:entries.slice(0,500).map(e=>({name:e.name,kind:e.isDirectory()?'directory':'file'})),
    truncated:entries.length>500};
  }
  if(action==='read'){
   const {target}=locate(id,relative,'read');
   const offset=Number(input.offset??0),length=Number(input.length??65536);
   if(!Number.isInteger(offset)||offset<0||!Number.isInteger(length)||length<1||length>262144)
    throw Error('Invalid read range');
   const stat=await fs.promises.stat(target);
   if(!stat.isFile())throw Error('Not a file');
   const file=await fs.promises.open(target,'r');
   try{
    const buffer=Buffer.alloc(length);
    const {bytesRead}=await file.read(buffer,0,length,offset);
    // Preserve the original content/length contract and add explicit fields
    // for consumers that discard ambiguous or empty tool-result payloads.
    const content=buffer.subarray(0,bytesRead).toString('utf8');
    return {ok:true,path:relative,offset,totalBytes:stat.size,
      content,text:content,length:bytesRead,bytesRead,
      eof:offset+bytesRead>=stat.size};
   }finally{await file.close();}
  }
  if(action==='create'){
   const {target}=locate(id,relative,'create',true);
   const file=await fs.promises.open(target,'wx');
   await file.close();
   return {created:true,path:relative};
  }
  if(action==='write'){
   const {target}=locate(id,relative,'update');
   if(typeof input.content!=='string'||Buffer.byteLength(input.content,'utf8')>1048576)
    throw Error('Content size exceeds limit');
   await fs.promises.writeFile(target,input.content,{flag:'w'});
   return {written:true,path:relative};
  }
  if(action==='delete'){
   const {target}=locate(id,relative,'delete');
   if(!fs.statSync(target).isFile())throw Error('Only files can be deleted');
   await fs.promises.unlink(target);
   return {deleted:true,path:relative};
  }
  throw Error('Unsupported root operation');
 }
 function checkPowerShell(rootId,absolutePath,{automatic=false}={}){
  const root=find(rootId);requireRight(root,'powershell');
  if(automatic)requireRight(root,'auto');
  const actual=fs.realpathSync.native(absolutePath);
  if(actual.toLowerCase()!==root.absolutePath.toLowerCase())throw Error('PowerShell cwd differs from granted folder');
  return actual;
 }
 return {listing,choose,update,remove,find,action,checkPowerShell};
}
module.exports={createRootAccess,normalizeRights};
