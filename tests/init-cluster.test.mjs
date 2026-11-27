import test from 'node:test';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('init_cluster is the sole collection authority; generated projections are exact',()=>{
 execFileSync(process.execPath,['scripts/publish-collection.mjs','--check']);
 const c=JSON.parse(readFileSync(new URL('../plugins/cluster.init-cluster/collection.json',import.meta.url)));
 assert.ok(c.plugins.every(p=>typeof p.initialize==='boolean'&&typeof p.community==='boolean'));
});
