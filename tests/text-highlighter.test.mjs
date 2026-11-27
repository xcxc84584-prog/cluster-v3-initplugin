import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext,Script} from 'node:vm';
const root='plugins/cluster.text-highlighter/';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ctx=createContext({});
for(const p of ['vendor/prism-core-source.js','vendor/grammar-deps.js','vendor/grammars-a.js','vendor/grammars-b.js','vendor/grammars-c.js','engine.js'])runInContext(read(root+p),ctx);
const E=ctx.ClusterHighlightEngine;
test('all grammars parse with immutable UTF-16 offsets and no HTML',()=>{
 const samples={cpp:'int main() { return 42; }',python:'def f():\n    return "中文"',javascript:'const n = 1; // 😀',markup:'<p>hello</p>',rust:'fn main() {}',powershell:'Write-Host "hello"',json:'{"ok":true}',tsx:'const A = <div/>;'};
 const c=createContext({console});runInContext('class WorkerGlobalScope{}; var self=new WorkerGlobalScope(); self.postMessage=m=>globalThis.answer=m;',c);
 runInContext(E.workerSource(),c);
 for(const language of E.languages){const text=samples[language]||'hello 42\n// comment\n';c.input={id:1,text,language};runInContext('self.onmessage({data:input})',c);assert.ok(c.answer.result,language+': '+c.answer.error);const a=c.answer.result.tokens;assert.equal(a.length%3,0);let end=0;for(let i=0;i<a.length;i+=3){assert.ok(a[i]>=end&&a[i+1]>a[i]&&a[i+1]<=text.length,language);end=a[i+1];}}
 assert.ok(E.languages.length>=25);
});
test('language detection and theme generation are independent of tokenization',()=>{
 assert.equal(E.language('', 'src/main.cpp'),'cpp');assert.equal(E.language('', 'x.ps1'),'powershell');assert.equal(E.language('', 'x.txt'),'plain');
 assert.notDeepEqual(E.palette('#111111'),E.palette('#eeeeee'));assert.ok(Object.values(E.palette('#123456')).every(s=>/^#[0-9a-f]{6}$/.test(s)));
});
test('headless package and editor use color-only non-interactive render layer',()=>{
 const m=JSON.parse(read(root+'manifest.json'));assert.equal(m.ui.mode,'embedded');
 const h=read(root+'index.html');assert.match(h,/<body><\/body>/);assert.doesNotMatch(h,/<button|<input|<textarea/);
 const source=read('plugins/cluster.text-editor/modules/editor/scripts/editor.js');
 new Script(source);new Script(read(root+'service.js'));
 assert.match(source,/CSS\.highlights/);assert.match(source,/new Range\(\)/);assert.match(source,/layer\.scrollHeight-editor\.scrollHeight/);assert.match(source,/compositionstart/);assert.match(source,/hostRPC\('PRMU\.list'/);assert.match(source,/capabilities\.workspace\.highlight\.v1/);assert.doesNotMatch(source,/m\.services/);assert.match(read(root+'service.js'),/rpc\('PRMU\.register','capabilities'/);
 assert.match(source,/::highlight\(cluster-hl-/);assert.match(source,/editor\.classList\.remove\('cluster-highlighted'\)/);
});
