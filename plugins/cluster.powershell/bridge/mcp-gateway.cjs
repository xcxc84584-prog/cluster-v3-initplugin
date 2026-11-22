'use strict';
/* Cluster-v3 Local MCP: actual JSON-RPC tool catalog with scoped browser bridge.
 * Strict loopback binding and a separate DPAPI-protected MCP access secret.
 * This is NOT an HTTP listener on any public interface.
 */
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const secureStore=require('./secure-store.cjs');
const folder=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'ClusterPowerShell');
fs.mkdirSync(folder,{recursive:true});
const statePath=path.join(folder,'agent-state.json');
const portFile=path.join(folder,'mcp-port.json');
const tokenPath=path.join(folder,'remote-mcp-token.dpapi');
const bearer=secureStore.loadOrMigrate(tokenPath,path.join(folder,'legacy-mcp-token'),
 v=>/^[a-f0-9]{64}$/.test(v),()=>crypto.randomBytes(32).toString('hex'));
const tools=[
 {name:'cluster.get_status',description:'Get status of the paired Cluster local Agent and browser editor.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'cluster.get_task_status',description:'Get recent local task states.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'cluster.list_files',description:'List files opened in Cluster editor.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'cluster.get_editor_state',description:'Get active Cluster editor state.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'cluster.read_file',description:'Read an open and saved Cluster editor file by its ID.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false}},
 {name:'cluster.list_roots',description:'List Explorer roots.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'cluster.find_root_windows_path',description:'Search bounded Windows user folders for Explorer root directory name. Returns candidates only; browser handle identity is not verified.',inputSchema:{type:'object',properties:{root:{type:'string'}},required:['root'],additionalProperties:false}},
 {name:'cluster.list_directory',description:'List entries in an authorized Explorer directory.',inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path'],additionalProperties:false}},
 {name:'cluster.read_path',description:'Read a portion of an Explorer file using offset and length; supports large files without loading them all.',inputSchema:{type:'object',properties:{path:{type:'string'},offset:{type:'integer',minimum:0},length:{type:'integer',minimum:1,maximum:262144}},required:['path'],additionalProperties:false}},
 {name:'cluster.create_file',description:'Create an empty file in an authorized Explorer directory.',inputSchema:{type:'object',properties:{path:{type:'string'},name:{type:'string'}},required:['path','name'],additionalProperties:false}},
 {name:'cluster.write_path',description:'Replace an authorized Explorer file with UTF-8 text. No timestamp or extra confirmation flags required. This overwrites the full file.',inputSchema:{type:'object',properties:{path:{type:'string'},content:{type:'string'}},required:['path','content'],additionalProperties:false}},
 {name:'cluster.delete_path',description:'Delete one Explorer file when workspace Delete permission and browser write permission are granted.',inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path'],additionalProperties:false}},
 {name:'cluster.open_powershell',description:'Request opening a Cluster PowerShell terminal window; execution still requires Workspace PowerShell permission and approval.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'cluster.powershell_request',description:'Execute a PowerShell command only after the Cluster browser explicitly confirms the exact command. Runs as the local signed-in user; not sandboxed.',inputSchema:{type:'object',properties:{path:{type:'string',description:'Authorized Explorer workspace root name'},command:{type:'string'}},required:['path','command'],additionalProperties:false}}
];

const allowed=new Set(tools.map(x=>x.name));
function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;
 const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y);}
function agentState(){
 const state=JSON.parse(fs.readFileSync(statePath,'utf8'));
 if(!Number.isInteger(state.port)||state.port<1024||state.port>65535||
 typeof state.origin!=='string'||!state.origin.startsWith('https://'))
  throw Error('Untrusted Local Agent state');
 return state;
}
function respond(res,status,value){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));
}
function fail(id,code,message){return {jsonrpc:'2.0',id,error:{code,message}};}
async function forward(name,args){
 const state=agentState();
 const localToken=secureStore.unprotectFile(path.join(folder,'pairing-token.dpapi'));
 const response=await fetch('http://127.0.0.1:'+state.port+'/mcp/call',{
  method:'POST',headers:{Origin:state.origin,'Content-Type':'application/json','X-Cluster-Token':localToken},
  body:JSON.stringify({name,arguments:args||{}}),
  signal:AbortSignal.timeout(name==='cluster.powershell_request'?135000:55000)
 });
 const result=await response.json();
 if(!response.ok)throw Error(result.error||'Agent HTTP '+response.status);
 return result.result;
}
async function rpc(msg){
 const id=msg?.id??null;
 if(msg?.jsonrpc!=='2.0')return fail(id,-32600,'Invalid JSON-RPC');
 if(msg.method==='initialize')return {jsonrpc:'2.0',id,result:{
  protocolVersion:'2025-03-26',capabilities:{tools:{listChanged:false}},
  serverInfo:{name:'cluster-v3-mcp',version:'0.2.0'}}};
 if(msg.method==='ping')return {jsonrpc:'2.0',id,result:{}};
 if(msg.method==='notifications/initialized')return null;
 if(msg.method==='tools/list')return {jsonrpc:'2.0',id,result:{tools}};
 if(msg.method!=='tools/call')return fail(id,-32601,'Method not found');
 const name=msg.params?.name,args=msg.params?.arguments||{};
 if(!allowed.has(name))return fail(id,-32602,'Unknown tool');
 if(typeof args!=='object'||args===null||Array.isArray(args))return fail(id,-32602,'Invalid arguments');
 const schema=tools.find(x=>x.name===name).inputSchema;
 if(Object.keys(args).some(x=>!(x in schema.properties)) ||
   (schema.required||[]).some(x=>!(x in args)))return fail(id,-32602,'Unexpected or missing arguments');
 for(const [key,val] of Object.entries(args)){
  const spec=schema.properties[key]||{};
  if((spec.type==='string'&&typeof val!=='string')||
     (spec.type==='integer'&&(!Number.isInteger(val)||val<(spec.minimum||0)||val>(spec.maximum||Number.MAX_SAFE_INTEGER))))
    return fail(id,-32602,'Invalid '+key);
 }
 try{
  const result=await forward(name,args);
  return {jsonrpc:'2.0',id,result:{content:[{type:'text',text:JSON.stringify(result)}]}};
 }catch(e){return {jsonrpc:'2.0',id,result:{isError:true,content:[{type:'text',text:String(e.message).slice(0,450)}]}};}
}
const server=http.createServer(async(req,res)=>{
 if(req.url!=='/mcp'){respond(res,404,{error:'Not Found'});return;}
 const auth=req.headers.authorization||'';
 if(!auth.startsWith('Bearer ')||!equal(auth.slice(7),bearer)){
  res.setHeader('WWW-Authenticate','Bearer realm="Cluster MCP"');
  respond(res,401,{error:'Unauthorized'});return;
 }
 if(req.method==='DELETE'){res.writeHead(204);res.end();return;}
 if(req.method==='GET'){res.writeHead(405,{'Allow':'POST, DELETE'});res.end();return;}
 if(req.method!=='POST'){respond(res,405,{error:'Method not allowed'});return;}
 let raw='';for await(const chunk of req){raw+=chunk;
  if(Buffer.byteLength(raw)>32768){respond(res,413,{error:'Too large'});return;}}
 let msg;try{msg=JSON.parse(raw)}catch{respond(res,400,fail(null,-32700,'Parse error'));return;}
 if(Array.isArray(msg)||typeof msg!=='object'||!msg){respond(res,400,fail(null,-32600,'Invalid request'));return;}
 const value=await rpc(msg);
 if(value===null){res.writeHead(202);res.end();return;}
 respond(res,200,value);
});
server.listen(0,'127.0.0.1',()=>{
 const port=server.address().port;
 fs.writeFileSync(portFile,JSON.stringify({port,pid:process.pid}),{mode:0o600});
 console.log('MCP STATUS: http://127.0.0.1:'+port+'/mcp');
 console.log('Authentication: DPAPI-protected local token (not printed)');
});
module.exports={tools,rpc};
