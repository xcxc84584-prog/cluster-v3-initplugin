import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const agent=read('plugins/cluster.powershell/bridge/server.cjs');
const ai=read('plugins/cluster.ai-agent-mcp/index.html');
const unified=read('plugins/cluster.text-editor/scripts/workspace-unified-tabs.js');
const agentUI=ai.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('all updated runtimes parse',()=>{
 new Script(agent,{filename:'server.cjs'});
 assert.ok(agentUI);
 new Script(agentUI,{filename:'agent-ui.js'});
 new Script(unified,{filename:'workspace-unified-tabs.js'});
});

test('PS activity stores stdout only while still returning process results',()=>{
 assert.match(agent,/entry\.stdout=sanitizeOutput\(output\.stdout\)/);
 assert.doesNotMatch(agent,/entry\.stderr\s*=/);
 assert.match(agent,/const \{stderr:_discarded,\.\.\.metadata\}=event/);
 assert.match(agent,/activityOutput:'stdout-only'/);
 assert.match(ai,/for\(const \[kind,value\] of \[\['STDOUT',event\.stdout\]\]\)/);
 assert.doesNotMatch(ai,/\['STDERR',event\.stderr\]/);
 assert.doesNotMatch(ai,/exitCode,stdout,stderr,truncated/);
});

test('Clear Log announces capability and instructs restart for an old agent',()=>{
 assert.match(agent,/activityClear:true/);
 assert.match(agent,/if\(url\.pathname==='\/activity\/clear'\)/);
 assert.match(agentUI,/canClearActivity=health\.activityClear===true/);
 assert.match(agentUI,/if\(!canClearActivity\)throw Error/);
 assert.match(agentUI,/lc\(7\)/);
});

test('creating a new PS or Editor tab activates the matching unified tab',()=>{
 assert.match(unified,/window\.addEventListener\('cluster-powershell-new-tab',[\s\S]*?goPowershell\(\)/);
 assert.match(unified,/const added=psSnapshotReady&&psSessions\.find/);
 assert.match(unified,/if\(added\)\{goPowershell\(added\.id\);return;\}/);
 assert.match(unified,/const newlyOpened=msg\.event==='document\.opened'/);
 assert.match(unified,/if\(newlyOpened\)\{goEditor\(doc\.id\);return;\}/);
 assert.match(unified,/window\.addEventListener\('cluster-ai-agent-view'/);
});

test('all three changed manifests match registry versions',()=>{
 const catalog=JSON.parse(read('community-index.json'));
 for(const [id,version] of [
  ['cluster.powershell','0.7.3'],
  ['cluster.ai-agent-mcp','0.3.2'],
  ['cluster.text-editor','2.12.3']
 ]){
  const entry=catalog.plugins.find(x=>x.id===id);
  assert.ok(entry,id);
  assert.equal(entry.version,version);
  assert.equal(JSON.parse(read(entry.directory+'/manifest.json')).version,version);
 }
});
