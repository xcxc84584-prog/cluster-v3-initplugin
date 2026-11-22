import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const agent=read('plugins/cluster.ai-agent-mcp/index.html');
const runtime=agent.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const server=read('plugins/cluster.powershell/bridge/server.cjs');

test('activity and Local Agent JavaScript parse',()=>{
 assert.ok(runtime);
 new Script(runtime,{filename:'ai-agent-ui.js'});
 new Script(server,{filename:'local-agent.cjs'});
});

test('polling preserves expanded output and anchored visible entries',()=>{
 assert.match(runtime,/const activityOpenKeys=new Set\(\)/);
 assert.match(runtime,/details\.open=activityOpenKeys\.has\(activityKey\(event\)\)/);
 assert.match(runtime,/details\.addEventListener\('toggle'/);
 assert.match(runtime,/const anchorKey=anchor\?\.dataset\.eventKey/);
 assert.match(runtime,/container\.insertBefore\(row,at\|\|null\)/);
 assert.match(runtime,/container\.scrollTop=logTop\+moved/);
 assert.doesNotMatch(runtime,/replaceChildren\(\.\.\.events\.map\(entry\)\)/);
});

test('activity viewport and expanded output survive reloading',()=>{
 assert.match(runtime,/const ACTIVITY_VIEW_KEY='cluster\.ai-agent\.activity-view\.v1'/);
 assert.match(runtime,/localStorage\.getItem\(ACTIVITY_VIEW_KEY\)/);
 assert.match(runtime,/localStorage\.setItem\(ACTIVITY_VIEW_KEY/);
 assert.match(runtime,/storedActivityTop=activityViewport\.scrollTop/);
 assert.match(runtime,/activityViewport\.scrollTop=storedActivityTop/);
 assert.match(agent,/\.log\{overflow-anchor:none/);
});

test('clear is explicit, localized, persisted and protects against stale refresh',()=>{
 for(const id of ['clearLog','clearLogDialog','cancelClearLog','confirmClearLog'])
  assert.ok(agent.includes('id="'+id+'"'),id);
 for(const locale of ["'zh-TW'",'en:','fr:','ja:','es:','hi:'])
  assert.ok(agent.includes(locale),locale);
 assert.match(runtime,/\$\('clearLogDialog'\)\.showModal\(\)/);
 assert.match(runtime,/await call\('\/activity\/clear'\)/);
 assert.match(runtime,/generation!==activityGeneration\|\|clearingActivity/);
 assert.match(runtime,/activityOpenKeys\.clear\(\)/);
 assert.match(server,/if\(url\.pathname==='\/activity\/clear'\)/);
 assert.match(server,/fs\.renameSync\(tmp,activityFile\)/);
 assert.match(server,/activity\.push\(\.\.\.previous\)/);
});

test('buttons use shared palette and independent spacing',()=>{
 assert.match(agent,/\.log-actions\{display:flex;gap:10px/);
 assert.match(agent,/\.log-actions button\{[^}]*var\(--ui-control\)/);
 assert.match(agent,/\.clear-log-dialog\{[^}]*var\(--ui-panel\)/);
});

test('community plugin versions match their manifests',()=>{
 const catalog=JSON.parse(read('community-index.json'));
 for(const [id,version] of [
  ['cluster.ai-agent-mcp','0.3.2'],
  ['cluster.powershell','0.7.2']
 ]){
  const entry=catalog.plugins.find(x=>x.id===id);
  assert.ok(entry,id);
  assert.equal(entry.version,version);
  assert.equal(JSON.parse(read(entry.directory+'/manifest.json')).version,version);
 }
});
