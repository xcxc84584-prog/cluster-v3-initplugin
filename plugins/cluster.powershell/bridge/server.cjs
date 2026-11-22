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
const {WebSocketServer} = require('ws');

if(process.platform !== 'win32') throw Error('ClusterPowerShell currently requires Windows ConPTY');
const origin = process.env.CLUSTER_ALLOWED_ORIGIN;
if(!origin) throw Error('CLUSTER_ALLOWED_ORIGIN is required');
const parsedOrigin = new URL(origin);
if(parsedOrigin.origin !== origin ||
   (parsedOrigin.protocol !== 'https:' &&
    !(parsedOrigin.protocol === 'http:' &&
      ['127.0.0.1','localhost'].includes(parsedOrigin.hostname))))
  throw Error('Origin must be an exact HTTPS site origin or local HTTP origin');
const shell = process.env.CLUSTER_SHELL === 'pwsh' ? 'pwsh.exe' : 'powershell.exe';
const token = crypto.randomBytes(32).toString('base64url');
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
  if(req.headers.origin !== origin){
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
    json(res,200,{ok:true,agent:'ClusterPowerShell',apiVersion:'3.0.0',maxSessions:MAX_SESSIONS});
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
}
server.on('upgrade',(req,socket,head)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname!=='/terminal' ||
       req.headers.origin!==origin ||
       url.searchParams.get('token')!==token ||
       sessions.size>=MAX_SESSIONS){
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;
    }
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
  }catch{socket.destroy();}
});
wss.on('connection',ws=>{
  let current=null;
  ws.on('message',raw=>{
    let msg;
    try{msg=JSON.parse(String(raw));}catch{return;}
    if(!msg||typeof msg.type!=='string')return;
    if(msg.type==='create' && !current && sessions.size<MAX_SESSIONS) {
      const id=crypto.randomBytes(16).toString('hex');
      try{
        const proc=pty.spawn(shell,[],{
          name:'xterm-256color',cols:80,rows:24,
          cwd:os.homedir(),env:process.env,useConpty:true
        });
        current=id;sessions.set(id,{process:proc,ws});
        proc.onData(data=>send(ws,{type:'data',data}));
        proc.onExit(({exitCode})=>{
          if(sessions.get(id)?.ws===ws)sessions.delete(id);
          current=null;send(ws,{type:'exit',exitCode});
        });
        send(ws,{type:'created',sessionId:id});
      }catch(error){send(ws,{type:'error',error:'Could not start PowerShell ConPTY: '+error.message});}
      return;
    }
    if(!current || !sessions.has(current))return;
    const proc=sessions.get(current).process;
    if(msg.type==='input' && typeof msg.data==='string' && msg.data.length<=MAX_MESSAGE)proc.write(msg.data);
    if(msg.type==='resize' && Number.isInteger(msg.cols) && Number.isInteger(msg.rows) &&
       msg.cols>=10 && msg.cols<=500 && msg.rows>=2 && msg.rows<=200)
      proc.resize(msg.cols,msg.rows);
    if(msg.type==='close'){closeSession(current);current=null;}
  });
  ws.on('close',()=>{if(current)closeSession(current);});
  ws.on('error',()=>{if(current)closeSession(current);});
});
function listen(port=0){
 server.listen(port,'127.0.0.1',()=>{
  const address=server.address();
  console.log('PORT MESSAGE : http://127.0.0.1:'+address.port+'/ TOKEN '+token);
  console.log('ALLOWED ORIGIN : '+origin);
  console.log('PowerShell engine : '+shell);
  console.log('Close this window / Ctrl+C to stop Local Agent.');
 });
}
listen(Number(process.env.CLUSTER_PORT)||0);
process.on('SIGINT',()=>{for(const id of sessions.keys())closeSession(id);server.close();});
