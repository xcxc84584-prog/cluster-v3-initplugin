import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const root='plugins/cluster.text-editor/';
const editor=read(root+'modules/editor/scripts/editor.js');
const shell=read(root+'index.html');
const workspace=read(root+'scripts/workspace.js');
const unified=read(root+'scripts/workspace-unified-tabs.js');
function harness(approved,dirty=true){
 const tabs=new Map([[1,{id:1,name:'a.txt',dirty}],[2,{id:2,name:'b.txt',dirty:false}]]);
 const calls=[],events=[];
 const source=editor.slice(editor.indexOf('  function closeTab('),editor.indexOf('  // Host Router / Explorer bridge'));
 const c={tabs,calls,events,activeId:1,editor:{value:'text'},captureTab(){},window:{confirm(msg){calls.push(msg);return approved;}},t:k=>k,scheduleSessionSave(){},emitEditorEvent:(...args)=>events.push(args),selectTab(id){c.activeId=id;},$(){return {};},setStatus(){},renderTabs(){},renderLines(){},renderCursor(){}};
 new Script(source+';this.closeTab=closeTab;this.closeAllTabs=closeAllTabs;').runInNewContext(c);
 return c;
}
test('dirty close requires confirmation, cancel preserves document',()=>{
 const c=harness(false);assert.equal(c.closeTab(1),false);assert.equal(c.tabs.size,2);assert.equal(c.events.length,0);assert.equal(c.calls.length,1);
});
test('confirmed dirty close discards and emits event',()=>{
 const c=harness(true);assert.equal(c.closeTab(1),true);assert.equal(c.tabs.has(1),false);assert.equal(c.calls.length,1);assert.equal(c.events[0][0],'document.closed');
});
test('clean tab closes without prompt',()=>{
 const c=harness(false,false);assert.equal(c.closeTab(1),true);assert.equal(c.calls.length,0);
});
test('close all is atomic on cancel and asks only once on approval',()=>{
 const no=harness(false);assert.equal(no.closeAllTabs(),false);assert.equal(no.tabs.size,2);
 const yes=harness(true);assert.equal(yes.closeAllTabs(),true);assert.equal(yes.tabs.size,0);assert.equal(yes.calls.length,1);assert.equal(yes.events.length,2);
});
test('shell and unified tabs route closing to editor with confirmation',()=>{
 assert.ok(shell.includes('data-file-action="close-all"'));
 assert.ok(workspace.includes("'close','close-all','palette'"));
 assert.ok(unified.includes("editorRequest('document.close',{id:d.id,prompt:true})"));
 assert.ok(editor.includes("if (!closeTab(tab.id,args.discardChanges===true))"));
 new Script(editor);new Script(workspace);new Script(unified);
});
