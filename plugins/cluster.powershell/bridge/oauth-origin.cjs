'use strict';
// An OAuth issuer must be a public HTTPS origin backed by the user's
// own reverse proxy to this Gateway, not the Cluster GitHub Pages UI.
const {URL}=require('node:url');
const net=require('node:net');

function normalizePublicIssuer(value) {
 if(typeof value!=='string'||!value.trim())
  throw Error('Enter the public HTTPS address of your OAuth reverse proxy, not the Cluster website.');
 let url;
 try{url=new URL(value.trim());}
 catch{throw Error('Invalid URL: enter a public HTTPS address such as https://mcp.example.com');}
 if(url.protocol!=='https:'||url.username||url.password)
  throw Error('OAuth Gateway requires HTTPS and must not contain embedded credentials.');
 const host=url.hostname.toLowerCase();
 if(host==='localhost'||host.endsWith('.localhost')||
   host==='github.io'||host.endsWith('.github.io')||
   host==='github.com'||host.endsWith('.github.com')||
   net.isIP(host)!==0||!host.includes('.'))
  throw Error('Use your public HTTPS reverse-proxy domain, not GitHub Pages, localhost, or an IP address.');
 // Pasted full URLs are accepted; OAuth metadata and callbacks need an origin.
 return url.origin;
}
if(require.main===module){
 try{
  const origin=normalizePublicIssuer(process.env.CLUSTER_OAUTH_INPUT||
    process.env.CLUSTER_OAUTH_ISSUER);
  process.stdout.write(origin+'\n');
 }catch(error){
  process.stderr.write('[ERROR] '+error.message+'\n');
  process.exitCode=2;
 }
}
module.exports={normalizePublicIssuer};
