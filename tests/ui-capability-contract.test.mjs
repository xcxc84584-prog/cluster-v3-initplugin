import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('workspace providers advertise the shared ui.embed v1 contract',()=>{
 for(const [path,key] of [
 ['plugins/cluster.powershell/index.html','workspace.powershell.v1'],
 ['plugins/cluster.ai-agent-mcp/index.html','workspace.ai-agent-mcp.v1'],
 ['plugins/cluster.explorer/scripts/explorer.js','workspace.explorer.v1']
 ]){
 const source=read(path);
 const start=source.indexOf("key:'"+key+"'");
 assert.notEqual(start,-1,key);
 const descriptor=source.slice(start,start+160);
 assert.match(descriptor,/value:\s*\{kind:'ui\.embed',version:'1\.0\.0'\}/,key);
 }
});
