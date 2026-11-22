import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import {runInNewContext} from 'node:vm';

const folder=new URL('../plugins/cluster.powershell/bridge/',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,folder),'utf8');
function harness(script,kind){
 let handler=null,lastAgentCall=null;
 const http={
  createServer(callback){
   handler=callback;
   const server={listen(port,host,done){done();},address(){return {port:46345}}};
   return server;
  }
 };
 const mockFs={
  mkdirSync(){},writeFileSync(){},
  readFileSync(name){
   if(String(name).endsWith('agent-state.json'))
    return JSON.stringify({port:43881,origin:'https://cluster.example.com',pid:123});
   if(String(name).endsWith('mcp-port.json'))
    return JSON.stringify({port:46346,pid:124});
   throw Error('Unknown mock file '+name);
  }
 };
 const vault={
  loadOrMigrate(){return kind==='oauth'?'test-secret-with-at-least-24-characters':'b'.repeat(64);},
  unprotectFile(){return 'a'.repeat(64);}
 };
 const fakeFetch=async(url,opts)=>{
  lastAgentCall={url:String(url),options:opts};
  const data={jsonrpc:'2.0',id:1,result:{tools:[
   {name:'cluster.get_status'},
   {name:'cluster.delete_path'}]}};
  return {ok:true,status:200,
   json:async()=>({result:{served:true,url:String(url),tool:JSON.parse(opts.body||'{}').name}}),
   headers:{get:()=> 'application/json'},
   arrayBuffer:async()=>Buffer.from(JSON.stringify(data))
  };
 };
 const modules={
  'node:http':http,'node:fs':mockFs,'node:path':path,'node:os':os,
  'node:crypto':crypto,'node:url':{URL,URLSearchParams},
  './secure-store.cjs':vault
 };
 const module={exports:{}};
 const processMock={env:{LOCALAPPDATA:'/tmp/test-cluster',
  CLUSTER_OAUTH_ISSUER:'https://mcp.example.com',CLUSTER_OAUTH_PORT:'0'},
  pid:1234};
 runInNewContext(script,{
  require:id=>{if(!(id in modules))throw Error('Unexpected require '+id);return modules[id];},
  process:processMock,console:{log(){},warn(){},error(){}},
  module,Buffer,URL,URLSearchParams,setTimeout,clearTimeout,
  fetch:fakeFetch,AbortSignal
 },{filename:kind+'.cjs'});
 return {module:module.exports,handle:()=>handler,lastCall:()=>lastAgentCall};
}
async function send(handler,url,method='GET',data=null,headers={}){
 const raw=data==null?[]:[typeof data==='string'?data:JSON.stringify(data)];
 const req=Readable.from(raw);req.url=url;req.method=method;req.headers=headers;
 const res={code:200,headers:{},body:'',
  setHeader(name,value){this.headers[name.toLowerCase()]=value;},
  writeHead(code,values={}){this.code=code;for(const [k,v] of Object.entries(values))this.setHeader(k,v);},
  end(value=''){this.body+=value?String(value):'';}
 };
 await handler(req,res);
 return {status:res.code,headers:res.headers,body:res.body,
  data:res.body&&res.headers['content-type']?.includes('json')?JSON.parse(res.body):null};
}
test('MCP Gateway publishes all 14 legacy tool schemas with routed execution',async()=>{
 const server=harness(read('mcp-gateway.cjs'),'mcp');
 const {tools,rpc}=server.module;
 assert.equal(tools.length,14);
 assert.equal(new Set(tools.map(t=>t.name)).size,14);
 const init=await rpc({jsonrpc:'2.0',id:1,method:'initialize'});
 assert.equal(init.result.protocolVersion,'2025-03-26');
 const list=await rpc({jsonrpc:'2.0',id:2,method:'tools/list'});
 assert.equal(list.result.tools.length,14);
 for(const tool of tools){
  const args={};
  for(const [name,spec] of Object.entries(tool.inputSchema.properties)){
   if(spec.type==='integer')args[name]=spec.minimum||0;
   else if(spec.type==='string')args[name]='example';
  }
  const result=await rpc({jsonrpc:'2.0',id:3,method:'tools/call',
   params:{name:tool.name,arguments:args}});
  assert.equal(result.result.isError,undefined,tool.name);
  assert.equal(JSON.parse(result.result.content[0].text).served,true);
  assert.equal(server.lastCall().options.headers['X-Cluster-Token'].length,64);
 }
 assert.equal((await rpc({jsonrpc:'2.0',id:4,method:'tools/call',
  params:{name:'cluster.unknown',arguments:{}}})).error.code,-32602);
 assert.equal((await rpc({jsonrpc:'2.0',id:5,method:'tools/call',
  params:{name:'cluster.read_file',arguments:{id:42}}})).error.code,-32602);
});
test('OAuth metadata, authorization code + PKCE, scoped MCP tools and revocation',async()=>{
 const gateway=harness(read('oauth-mcp-gateway.cjs'),'oauth');
 const req=(url,method='GET',data=null,headers={})=>send(gateway.handle(),url,method,data,headers);
 const meta=await req('/.well-known/oauth-authorization-server');
 assert.equal(meta.status,200);
 assert.equal(meta.data.issuer,'https://mcp.example.com');
 assert.equal(meta.data.code_challenge_methods_supported[0],'S256');
 const registry=await req('/register','POST',{
  redirect_uris:['https://chatgpt.com/connector/oauth/callback'],
  token_endpoint_auth_method:'none'});
 assert.equal(registry.status,201);
 const client=registry.data.client_id;
 const verifier='a'.repeat(64);
 const challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
 const redirect='https://chatgpt.com/connector/oauth/callback';
 const query=new URLSearchParams({response_type:'code',client_id:client,
  redirect_uri:redirect,code_challenge:challenge,code_challenge_method:'S256',
  state:'secure-state-test',scope:'cluster.read'});
 const authorize=await req('/authorize?'+query);
 assert.equal(authorize.status,200);
 const ticket=authorize.body.match(/name="ticket" value="([^"]+)"/)?.[1];
 assert.ok(ticket);
 const approval=await req('/approve','POST',new URLSearchParams({
  ticket,password:'test-secret-with-at-least-24-characters',decision:'approve'}).toString());
 assert.equal(approval.status,302);
 const code=new URL(approval.headers.location).searchParams.get('code');
 assert.ok(code);
 const token=await req('/token','POST',new URLSearchParams({
  grant_type:'authorization_code',code,client_id:client,redirect_uri:redirect,
  code_verifier:verifier}).toString());
 assert.equal(token.status,200);
 const access=token.data.access_token,auth={authorization:'Bearer '+access};
 const denied=await req('/mcp','POST',{jsonrpc:'2.0',id:9,method:'tools/call',
  params:{name:'cluster.delete_path',arguments:{path:'home/test'}}},auth);
 assert.equal(denied.data.error.code,-32602);
 const listed=await req('/mcp','POST',{jsonrpc:'2.0',id:10,method:'tools/list'},auth);
 assert.deepEqual(JSON.parse(JSON.stringify(listed.data.result.tools.map(t=>t.name))),['cluster.get_status']);
 const revoked=await req('/revoke','POST',new URLSearchParams({token:access,client_id:client}).toString());
 assert.equal(revoked.status,200);
 const after=await req('/mcp','POST',{jsonrpc:'2.0',id:11,method:'tools/list'},auth);
 assert.equal(after.status,401);
});
