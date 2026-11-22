'use strict';
/* Print credentials ONLY in this locally invoked CMD console, after verifying
 * that the referenced service is alive and actually answers a request.
 * Never print secrets in tunnel log files, PRMU or browser-visible output.
 */
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const vault=require('./secure-store.cjs');
const dir=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'ClusterPowerShell');
const mode=(process.argv[2]||'mcp').toLowerCase();
if(!['mcp','oauth','quick'].includes(mode))throw Error('Invalid gateway mode');
function state(name){
 const record=JSON.parse(fs.readFileSync(path.join(dir,name+'-port.json'),'utf8'));
 if(!Number.isInteger(record.port)||record.port<1024||record.port>65535||
    !Number.isInteger(record.pid)||record.pid<1)throw Error(name+' state unavailable');
 process.kill(record.pid,0);
 return record;
}
function readSecret(name){
 const value=vault.unprotectFile(path.join(dir,name+'.dpapi'));
 if(typeof value!=='string'||value.length<24)throw Error('Invalid '+name+' token');
 return value;
}
function post(port,uri,headers,body){
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port,path:uri,method:'POST',
   timeout:2200,headers:{...headers,'Content-Type':'application/json'}},res=>{
   let data='';res.on('data',chunk=>data+=chunk);
   res.on('end',()=>{if(res.statusCode!==200){reject(Error('Health check HTTP '+res.statusCode));return;}
    try{resolve(JSON.parse(data))}catch(error){reject(error)}});
  });
  req.on('timeout',()=>req.destroy(Error('Gateway response timeout')));
  req.on('error',reject);req.end(JSON.stringify(body));
 });
}
async function main(){
 const mcpToken=readSecret('remote-mcp-token');
 const mcp=state('mcp');
 const probe=await post(mcp.port,'/mcp',{Authorization:'Bearer '+mcpToken},
  {jsonrpc:'2.0',id:'check',method:'initialize',params:{}});
 if(probe.result?.serverInfo?.name!=='cluster-v3-mcp')
  throw Error('MCP Gateway did not pass startup verification');
 let oauth=null,issuer=null,oauthApproval=null;
 if(mode!=='mcp'){
  oauth=state('oauth');
  const meta=await new Promise((resolve,reject)=>{
   http.get('http://127.0.0.1:'+oauth.port+'/.well-known/oauth-authorization-server',
    {timeout:2200},res=>{
     let raw='';res.on('data',x=>raw+=x);
     res.on('end',()=>{try{resolve(JSON.parse(raw))}catch(e){reject(e)}});
    }).on('error',reject);
  });
  issuer=meta.issuer;
  if(typeof issuer!=='string'||!/^https:\/\/[^/?#]+$/.test(issuer))
   throw Error('OAuth Issuer not ready');
  oauthApproval=readSecret('oauth-approval-password');
 }
 let agent=null,pairing=null;
 try{
  const record=JSON.parse(fs.readFileSync(path.join(dir,'agent-state.json'),'utf8'));
  if(!Number.isInteger(record.port)||!Number.isInteger(record.pid))throw Error('Agent state missing');
  process.kill(record.pid,0);
  pairing=readSecret('pairing-token');
  const check=await post(record.port,'/health',
    {'Origin':record.origin,'X-Cluster-Token':pairing},{});
  if(check.agent==='ClusterPowerShell')agent=record;
 }catch{/* Agent may be managed in a different active console. */}
 console.log('');
 console.log('================ LOCAL CONNECTION ================');
 if(agent)console.log('PORT MESSAGE : LOCAL AGENT '+agent.port+' : TOKEN '+pairing);
 console.log('PORT MESSAGE : MCP '+mcp.port+' : TOKEN '+mcpToken);
 if(oauth){
  console.log('PORT MESSAGE : OAUTH '+oauth.port+' : APPROVAL TOKEN '+oauthApproval);
  console.log('PORT MESSAGE : CHATGPT MCP '+issuer+'/mcp');
 }
 console.log('Tokens are shown only in this local CMD window. Keep them private.');
 console.log('==================================================');
}
main().catch(e=>{console.error('[ERROR] Gateway not verified: '+e.message);process.exitCode=1});
