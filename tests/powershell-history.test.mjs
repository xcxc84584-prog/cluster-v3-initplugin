import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const html=readFileSync(new URL('../plugins/cluster.powershell/index.html',
  import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('PowerShell inline runtime is valid JavaScript',()=>{
 assert.ok(script,'inline terminal script exists');
 new Script(script,{filename:'powershell-inline.js'});
});

test('all PTY response types enter persistent terminal history',()=>{
 for(const fragment of [
  'terminalHistory.append(message.data)',
  'terminalHistory.append(line);term.write(line)',
  'const database=\'cluster-powershell-history-v1\'',
  'crypto.subtle.encrypt',
  'crypto.subtle.decrypt',
  'slice(-limit)'
 ])assert.ok(script.includes(fragment),fragment);
});

test('saved authorized pairing reconnects after reload',()=>{
 assert.match(script,/pairingVault\.load\(\)\.then\(saved=>/);
 assert.match(script,/void connectAgent\(\{automatic:true\}\)/);
 assert.match(script,/await requestHealth\(\);await ensureAssets\(\);await terminalHistory\.ready/);
 assert.match(script,/if\(connected\)return/);
});

test('clear output discards durable history',()=>{
 assert.match(script,/\$\('clear'\)\.onclick=[\s\S]*?terminalHistory\.clear\(\)/);
});

test('manifest and community catalog stay synchronized',()=>{
 const manifest=JSON.parse(readFileSync(new URL(
  '../plugins/cluster.powershell/manifest.json',import.meta.url),'utf8'));
 const catalog=JSON.parse(readFileSync(new URL(
  '../community-index.json',import.meta.url),'utf8'));
 const entry=catalog.plugins.find(item=>item.id===manifest.id);
 assert.match(manifest.version,/^\d+\.\d+\.\d+$/);
 assert.equal(entry?.version,manifest.version);
});

test('Local Agent v3.1 accepts the same authorized pairing token',()=>{
 const server=readFileSync(new URL(
  '../plugins/cluster.powershell/bridge/server.cjs',import.meta.url),'utf8');
 assert.ok(server.includes("apiVersion:'3.1.0'"));
 assert.ok(server.includes("req.headers['x-cluster-token']!==token"));
 assert.ok(script.includes("'X-Cluster-Token':token"));
 assert.ok(script.includes("json.apiVersion"));
 const compatible=/^3\\.(?:0|1)\\.\\d+$/;
 assert.ok(script.includes(compatible.toString()+".test(json.apiVersion||'')"));
 assert.equal(compatible.test('3.0.0'),true);
 assert.equal(compatible.test('3.1.0'),true);
 assert.equal(compatible.test('2.0.0'),false);
});
