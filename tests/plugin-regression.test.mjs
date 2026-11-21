import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const explorer = read('plugins/cluster.explorer/scripts/explorer.js');
const editor = read('plugins/cluster.text-editor/modules/editor/scripts/editor.js');
const workspace = read('plugins/cluster.text-editor/scripts/workspace.js');
const css = read('plugins/cluster.text-editor/styles/workspace.css');
const html = read('plugins/cluster.text-editor/index.html');

test('all plugin runtime JavaScript is syntactically valid', () => {
  new Script(explorer, {filename:'explorer.js'});
  new Script(editor, {filename:'editor.js'});
  new Script(workspace, {filename:'workspace.js'});
});

test('all community versions match their folder manifests', () => {
  const catalog=JSON.parse(read('community-index.json'));
  assert.equal(catalog.plugins.length,2);
  for(const entry of catalog.plugins){
    const manifest=JSON.parse(read(entry.directory+'/manifest.json'));
    assert.equal(manifest.id,entry.id);
    assert.equal(manifest.version,entry.version);
    assert.equal(manifest.schemaVersion,'1.0.0');
    assert.ok(read(entry.directory+'/'+manifest.entry).length);
  }
});

test('File menu remains scrollable under browser viewport zoom', () => {
  assert.match(css,/\.global-file-menu\s*\{[\s\S]*?max-height:[^;]*dvh/);
  assert.match(css,/\.global-file-menu\s*\{[\s\S]*?overflow-y:auto/);
  assert.match(css,/\.language-menu/);
});

test('non-disk source prompts Save As, disk origin retains overwrite', () => {
  assert.match(explorer,/diskBacked:diskPaths\.has\(item\.path\)/);
  assert.match(editor,/args\.diskBacked === true/);
  assert.match(editor,/if\(tab\.path && tab\.diskBacked\)/);
  assert.match(editor,/await saveAs\(\)/);
  assert.match(html,/if\(tab\.path &amp;&amp; tab\.diskBacked\)/);
  assert.match(html,/args\.diskBacked === true/);
});

test('Explorer can select disk location for virtual file and folder', () => {
  assert.match(explorer,/async function saveWorkspaceItem\(item\)/);
  assert.match(explorer,/showDirectoryPicker\(\{mode:'readwrite'\}\)/);
  assert.match(explorer,/showSaveFilePicker\(\{suggestedName:item\.name\}\)/);
  assert.match(explorer,/saveWorkspaceItem\(item\)/);
});

test('shared footer covers Explorer and Editor and receives cursor updates', () => {
  assert.match(html,/<footer class="workbench-footer"/);
  assert.match(html,/<span class="status-title">Cluster<\/span>/);
  assert.match(html,/id="workbenchCursor"/);
  assert.match(workspace,/cluster\.workspace\.status\.v1/);
  assert.match(editor,/cluster\.workspace\.status\.v1/);
  assert.match(html,/\.status-bar\{display:none!important\}/);
});

test('language selection uses styled modal and six supported locales',()=>{
  assert.match(html,/id="workspaceLanguageDialog"/);
  assert.match(html,/class="workspace-option-dialog"/);
  assert.match(workspace,/languageDialog\.showModal\(\)/);
  for(const language of ['zh-TW','en','fr','ja','es','hi'])
    assert.match(html,new RegExp('data-locale="'+language+'"'));
});

test('internal vs external priority is persisted and forwarded',()=>{
  assert.match(html,/id="workspaceStorageDialog"/);
  assert.match(html,/name="workspacePriority" value="internal"/);
  assert.match(html,/name="workspacePriority" value="external"/);
  assert.match(workspace,/workspacePriority=radio\.value/);
  assert.match(workspace,/action:'storage-policy'/);
  assert.match(workspace,/strategy:workspacePriority/);
  assert.match(explorer,/storagePriority==='external'/);
  assert.match(editor,/changed\.strategy!=='external'/);
});

test('Editor and Explorer persist reload snapshots and positions',()=>{
  assert.match(editor,/SESSION_KEY = 'cluster\.editor\.workspace\.v2'/);
  assert.match(editor,/saveSessionNow\(\)/);
  assert.match(editor,/restoreSession\(\)/);
  assert.match(editor,/selectionStart:tab\.selectionStart/);
  assert.match(editor,/scrollTop:tab\.scrollTop/);
  assert.match(editor,/scrollLeft:tab\.scrollLeft/);
  assert.match(editor,/requestAnimationFrame\(\(\)=>/);
  assert.match(explorer,/EXPLORER_SESSION_KEY='cluster\.explorer\.workspace\.v2'/);
  assert.match(explorer,/restoreExplorer\(indexed\)/);
  assert.match(explorer,/treeScroll:\$\('tree'\)\.scrollTop/);
});

test('Explorer polls authorized disk and sends safe sync events',()=>{
  assert.match(explorer,/diskSnapshots\.set\(path/);
  assert.match(explorer,/async function inspectExternalChanges\(\)/);
  assert.match(explorer,/action === 'storage-policy'/);
  assert.match(workspace,/msg\.action==='external\.changed'/);
  assert.match(editor,/document\.externalSynced/);
  assert.match(editor,/changed\.type==='reconnected'/);
  assert.match(workspace,/type:'reconnected'/);
});

test('footer supports four actual state transitions in original palette',()=>{
  assert.match(html,/id="workbenchProgress"/);
  assert.match(html,/id="workbenchProgressFill"/);
  assert.match(workspace,/setProgress\('pending',100\)/);
  assert.match(workspace,/setProgress\('synced',100\)/);
  assert.match(workspace,/setProgress\('error',100\)/);
  assert.match(workspace,/setProgress\('loading',30\)/);
  for(const state of ['synced','pending','error','loading'])
    assert.match(css,new RegExp('workbench-progress\\[data-state="'+state+'"\\]'));
});

test('embedded Editor source matches standalone source',()=>{
  const mark='/* Cluster Text Editor v1 — autonomous plugin, no Host/internal API imports. */';
  const at=html.indexOf(mark),start=html.lastIndexOf('&lt;script&gt;',at);
  const end=html.indexOf('&lt;/script&gt;',at);
  assert.ok(start>=0&&end>start);
  const encoded=html.slice(start+'&lt;script&gt;'.length,end);
  const decoded=encoded.replaceAll('&quot;','"').replaceAll('&gt;','>')
    .replaceAll('&lt;','<').replaceAll('&amp;','&');
  assert.equal(decoded,editor);
});

test('browser-local restore has durable IndexedDB with localStorage fallback',()=>{
  assert.match(editor,/indexedDB\.open\(SNAPSHOT_DB,1\)/);
  assert.match(explorer,/indexedDB\.open\(EXPLORER_DB,1\)/);
  assert.match(editor,/store=>store\.put\(snapshot,SESSION_KEY\)/);
  assert.match(explorer,/store=>store\.put\(snapshot,EXPLORER_SESSION_KEY\)/);
  assert.match(editor,/store=>store\.get\(SESSION_KEY\)/);
  assert.match(explorer,/store=>store\.get\(EXPLORER_SESSION_KEY\)/);
  assert.match(editor,/localStorage\.setItem\(SESSION_KEY/);
  assert.match(explorer,/localStorage\.setItem\(EXPLORER_SESSION_KEY/);
  assert.match(editor,/await bootReady/);
});
test('external-first refreshes unopened files as well as open tabs',()=>{
  assert.match(explorer,/storagePriority==='external' && entries\.has\(path\)/);
  assert.match(explorer,/sendWorkspace\('external\.changed'/);
  assert.match(editor,/document\.externalSynced/);
});

test('Editor starts without an automatic untitled tab when recovery is empty', () => {
  assert.doesNotMatch(editor,/if\(!restoreSession\(\)\)\s*\{?[^\n]*newFile\(\)/);
  assert.match(editor,/if\(tabs\.size===0\)\{/);
  assert.match(editor,/activeId=null;/);
  assert.match(editor,/editor\.readOnly=true;/);
  assert.match(editor,/\$\('emptyHint'\)\.hidden=false;/);
  assert.match(editor,/function newFile\(\)/);
  assert.match(editor,/if\(!restoreSession\(indexed\)\)/);
});
