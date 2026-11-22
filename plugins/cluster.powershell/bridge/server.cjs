/* Interactive Windows ConPTY server for ClusterPowerShell.
 * Local-only transport: no remote bind, no command evaluation or shell emulation.
 * The user starts this explicitly; the browser is only a terminal viewport.
 */
'use strict';
const http = require('node:http');
const net = require('node:net');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const pty = require('node-pty');
const secureStore = require('./secure-store.cjs');
const {WebSocketServer} = require('ws');

if(process.platform !== 'win32') throw Error('ClusterPowerShell currently requires Windows ConPTY');
// Accept a copied Cluster page URL, then compare ONLY its canonical Origin.
function normalizeAllowedOrigin(value) {
 if(typeof value!=='string'||!value.trim()) throw Error('Cluster website URL is required');
 const parsed=new URL(value.trim());
 if(parsed.username||parsed.password||
    (parsed.protocol!=='https:' && !(parsed.protocol==='http:' &&
       ['127.0.0.1','localhost'].includes(parsed.hostname))))
   throw Error('Cluster website must use HTTPS or localhost HTTP');
 return parsed.origin;
}
const enteredOrigin=process.env.CLUSTER_ALLOWED_ORIGIN;
const origin=normalizeAllowedOrigin(enteredOrigin);
if(enteredOrigin.trim()!==origin)console.log('Normalized Cluster website origin: '+origin);
const shell = process.env.CLUSTER_SHELL === 'pwsh' ? 'pwsh.exe' : 'powershell.exe';
// Only this Windows user can decrypt a retained pairing credential.
const credentialDir=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),
  'ClusterPowerShell');
fs.mkdirSync(credentialDir,{recursive:true});
const token = secureStore.loadOrMigrate(
 path.join(credentialDir,'pairing-token.dpapi'),
 path.join(credentialDir,'legacy-pairing-token'),
 value=>/^[a-f0-9]{64}$/.test(value),
 ()=>crypto.randomBytes(32).toString('hex')
);
const portFile=path.join(credentialDir,'agent-port.json');
let previousPort=0;
try{const n=JSON.parse(fs.readFileSync(portFile,'utf8')).port;
 if(Number.isInteger(n)&&n>=1024&&n<=65535)previousPort=n;}catch{}
const activity=[];let activitySequence=0;
function record(action,result,detail=''){
 const safe=String(detail).replace(/[a-f0-9]{64}/gi,'[redacted]').slice(0,256);
 activity.push({id:++activitySequence,at:new Date().toISOString(),source:'powershell',action,result,detail:safe});
 if(activity.length>200)activity.splice(0,activity.length-200);
}
const pendingTools=new Map();
let browserBridge=null;
const sessions = new Map();
const MAX_SESSIONS = 12;
const MAX_MESSAGE = 65536;
const assets = new Map([
  ['/assets/xterm.js','@xterm/xterm/lib/xterm.js'],
  ['/assets/xterm.css','@xterm/xterm/css/xterm.css'],
  ['/assets/fit.js','@xterm/addon-fit/lib/addon-fit.js']
]);
function headers(res,req) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'none'");
  if(req.headers.origin === origin){
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Cluster-Token');
    // Allow Chrome private-network preflight only from the explicitly approved site.
    if(req.headers['access-control-request-private-network']==='true')
      res.setHeader('Access-Control-Allow-Private-Network','true');
  }
}
function json(res,status,obj) {
  const body=JSON.stringify(obj);
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});
  res.end(body);
}
const server=http.createServer((req,res)=>{
  headers(res,req);
  const url=new URL(req.url,'http://127.0.0.1');
  // Non-sensitive terminal JS/CSS may be loaded as classic scripts without an Origin header.
  if(req.method==='GET' && assets.has(url.pathname)){
    // The assets are read-only packaged third-party files, never terminal data.
  } else if(req.headers.origin !== origin){
    json(res,403,{ok:false,error:'Origin denied'});return;
  }
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  if(req.method==='GET' && assets.has(url.pathname)){
    const relative=assets.get(url.pathname);
    const full=path.resolve(__dirname,'node_modules',relative);
    if(!fs.existsSync(full)){json(res,503,{ok:false,error:'Terminal assets not installed'});return;}
    res.writeHead(200,{'Content-Type':relative.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'});
    fs.createReadStream(full).pipe(res);
    return;
  }
  if(req.method!=='POST' || req.headers['x-cluster-token']!==token){
    json(res,403,{ok:false,error:'Unauthorized'});return;
  }
  if(url.pathname==='/health'){
    json(res,200,{ok:true,agent:'ClusterPowerShell',apiVersion:'3.0.0',maxSessions:MAX_SESSIONS,sessionCount:sessions.size});
    return;
  }
  if(url.pathname==='/activity'){
    json(res,200,{ok:true,events:activity.slice(-100),cursor:activitySequence});
    return;
  }
  if(url.pathname==='/mcp/call'){
    let body='';
    req.on('data',chunk=>{body+=chunk;
      if(Buffer.byteLength(body)>32768)req.destroy();});
    req.on('end',()=>{
      let request;try{request=JSON.parse(body)}catch{json(res,400,{error:'Invalid JSON'});return;}
      if(!request||typeof request.name!=='string'||!request.name.startsWith('cluster.')){
        json(res,400,{error:'Invalid tool name'});return;
      }
      if(!browserBridge||browserBridge.readyState!==1){
        json(res,503,{error:'AI Agent browser not connected'});return;
      }
      if(pendingTools.size>=24){json(res,429,{error:'Too many pending requests'});return;}
      const requestId=crypto.randomBytes(16).toString('hex');
      const timer=setTimeout(()=>{
        pendingTools.delete(requestId);
        json(res,504,{error:'User or plugin response timed out'});
      },request.name==='cluster.powershell_request'?125000:45000);
      pendingTools.set(requestId,{res,timer,name:request.name});
      send(browserBridge,{type:'tool_call',requestId,name:request.name,args:request.arguments||{}});
      record('mcp.request','pending',request.name);
    });
    return;
  }
  json(res,404,{ok:false,error:'Unknown route'});
});
const wss=new WebSocketServer({noServer:true,maxPayload:MAX_MESSAGE,perMessageDeflate:false});
function send(ws,message) {
  if(ws.readyState===ws.OPEN) ws.send(JSON.stringify(message));
}
function closeSession(id) {
  const session=sessions.get(id);
  if(!session)return;
  sessions.delete(id);
  try{session.process.kill();}catch{}
  record('session.close','ok',id.slice(0,8));
}
server.on('upgrade',(req,socket,head)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(!['/terminal','/agent'].includes(url.pathname) ||
       req.headers.origin!==origin ||
       url.searchParams.get('token')!==token ||
       sessions.size>=MAX_SESSIONS){
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;
    }
    wss.handleUpgrade(req,socket,head,ws=>{
      ws.isAgent=url.pathname==='/agent';wss.emit('connection',ws);
    });
  }catch{socket.destroy();}
});
wss.on('connection',ws=>{
  let current=null;
  if(ws.isAgent){
    if(browserBridge&&browserBridge!==ws&&browserBridge.readyState===1){
      send(ws,{type:'error',error:'Agent browser already connected'});ws.close();return;
    }
    browserBridge=ws;
    send(ws,{type:'bridge_registered'});
  }
  ws.on('message',raw=>{
    let msg;
    try{msg=JSON.parse(String(raw));}catch{return;}
    if(!msg||typeof msg.type!=='string')return;
    if(ws.isAgent){
      if(msg.type==='tool_result'&&typeof msg.requestId==='string'){
        const pending=pendingTools.get(msg.requestId);if(!pending||browserBridge!==ws)return;
        pendingTools.delete(msg.requestId);clearTimeout(pending.timer);
        const response=msg.error?{error:String(msg.error).slice(0,256)}:{result:msg.result};
        json(pending.res,msg.error?403:200,response);
        record('mcp.response',msg.error?'denied':'ok',pending.name);
      }
      return;
    }
    if(msg.type==='create' && !current && sessions.size<MAX_SESSIONS) {
      const id=crypto.randomBytes(16).toString('hex');
      try{
        const proc=pty.spawn(shell,[],{
          name:'xterm-256color',cols:80,rows:24,
          cwd:os.homedir(),env:process.env,useConpty:true
        });
        current=id;sessions.set(id,{process:proc,ws});
        record('session.create','ok',id.slice(0,8));
        proc.onData(data=>send(ws,{type:'data',data}));
        proc.onExit(({exitCode})=>{
          if(sessions.get(id)?.ws===ws)sessions.delete(id);
          record('process.exit',exitCode===0?'ok':'error','exit '+exitCode);
          current=null;send(ws,{type:'exit',exitCode});
        });
        send(ws,{type:'created',sessionId:id});
      }catch(error){send(ws,{type:'error',error:'Could not start PowerShell ConPTY: '+error.message});}
      return;
    }
    if(!current || !sessions.has(current))return;
    const proc=sessions.get(current).process;
    if(msg.type==='input' && typeof msg.data==='string' && msg.data.length<=MAX_MESSAGE){
      proc.write(msg.data);
      // Do not retain input text. Only record completed line submissions.
      if(msg.data.includes('\r')||msg.data.includes('\n'))record('ps.command.submitted','ok','Input content withheld');
    }
    if(msg.type==='resize' && Number.isInteger(msg.cols) && Number.isInteger(msg.rows) &&
       msg.cols>=10 && msg.cols<=500 && msg.rows>=2 && msg.rows<=200)
      proc.resize(msg.cols,msg.rows);
    if(msg.type==='close'){closeSession(current);current=null;}
  });
  ws.on('close',()=>{
  if(current)closeSession(current);
  if(browserBridge===ws){browserBridge=null;
    for(const [id,pending] of pendingTools){clearTimeout(pending.timer);
      json(pending.res,503,{error:'AI Agent browser disconnected'});pendingTools.delete(id);}
  }
});
  ws.on('error',()=>{if(current)closeSession(current);});
});
function listen(port=0){
 server.listen(port,'127.0.0.1',()=>{
  const address=server.address();
  fs.writeFileSync(portFile,JSON.stringify({port:address.port}),{mode:0o600});
  fs.writeFileSync(path.join(credentialDir,'agent-state.json'),
   JSON.stringify({port:address.port,origin,pid:process.pid}),{mode:0o600});
  console.log('PORT MESSAGE : http://127.0.0.1:'+address.port+'/ TOKEN '+token);
  console.log('ALLOWED ORIGIN : '+origin);
  console.log('PowerShell engine : '+shell);
  console.log('Close this window / Ctrl+C to stop Local Agent.');
 });
}
// Keep the browser's remembered endpoint stable whenever possible.
const configuredPort=Number(process.env.CLUSTER_PORT)||previousPort||0;
server.on('error',error=>{
 if(error.code==='EADDRINUSE'&&configuredPort!==0&&!server.listening){
  console.warn('Previous port occupied; selecting another loopback port.');
  listen(0);
 }else{console.error('Local Agent start failed:',error.message);process.exitCode=1;}
});
listen(configuredPort);
process.on('SIGINT',()=>{for(const id of sessions.keys())closeSession(id);server.close();});
