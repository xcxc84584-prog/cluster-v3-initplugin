import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {Script} from 'node:vm';

const require=createRequire(import.meta.url);
const rootAccess=require('../plugins/cluster.powershell/bridge/root-access.cjs');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const server=read('plugins/cluster.powershell/bridge/server.cjs');
const ui=read('plugins/cluster.ai-agent-mcp/index.html');
const inline=ui.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('unified AUTO defaults off and migrates old PowerShell-only grants',()=>{
 assert.equal(rootAccess.normalizeRights({powershell:true}).auto,false);
 assert.equal(rootAccess.normalizeRights({auto:true}).auto,true);
 assert.equal(rootAccess.normalizeRights({autoPowershell:true}).auto,true);
 assert.equal(rootAccess.normalizeRights({read:true,auto:true}).read,true);
 assert.equal(rootAccess.normalizeRights({auto:false}).auto,false);
 assert.equal(rootAccess.normalizeRights({auto:true}).delete,false);
});

test('agent and plugin runtime syntax is valid',()=>{
 new Script(server,{filename:'server.cjs'});
 assert.ok(inline);
 new Script(inline,{filename:'agent-ui.js'});
});

test('agent re-checks auto execution privilege locally',()=>{
 assert.match(server,/const automatic=msg\.result\?\.automatic===true/);
 assert.match(server,/checkPowerShell\(String\(pending\.args\.path\|\|''\),cwd,\{automatic\}\)/);
 assert.match(inline,/root\.rights\?\.autoPowershell===true/);
 assert.match(inline,/automatic:true/);
 assert.match(inline,/window\.confirm\(message\)/);
});

test('activity stores bounded PowerShell outputs and supports reload',()=>{
 assert.match(server,/const activityFile=path\.join\(credentialDir,'agent-activity\.json'\)/);
 assert.match(server,/entry\.stdout=sanitizeOutput\(output\.stdout\)/);
 assert.doesNotMatch(server,/entry\.stderr=sanitizeOutput/);
 assert.match(server,/LOG_LIMIT=200,OUTPUT_LIMIT=16384/);
 assert.match(server,/fs\.writeFileSync\(tmp,JSON\.stringify/);
 assert.match(inline,/event\.action==='ps\.execution'/);
 assert.match(inline,/pre\.textContent=value/);
});

test('both updated manifests match community index',()=>{
 const index=JSON.parse(read('community-index.json'));
 for(const [id,version] of [
  ['cluster.powershell','0.7.2'],['cluster.ai-agent-mcp','0.3.2']
 ]){
  const entry=index.plugins.find(p=>p.id===id);
  assert.ok(entry,id);
  const manifest=JSON.parse(read(entry.directory+'/manifest.json'));
  assert.equal(entry.version,version);
  assert.equal(manifest.version,version);
 }
});
