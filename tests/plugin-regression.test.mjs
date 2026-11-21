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
  assert.match(html,/if\(tab\.path && tab\.diskBacked\)/);
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
