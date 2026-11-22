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
  assert.equal(catalog.plugins.length,4);
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

test('Editor File > Plugin uses PRMU manager URL, never a guessed path',()=>{
  const embedded=read('plugins/cluster.text-editor/index.html');
  assert.match(workspace,/method:'PRMU\.getPluginManagerUrl'/);
  assert.match(workspace,/msg\.pluginManagerUrl/);
  assert.match(workspace,/window\.top\.location\.assign\(destination\.href\)/);
  assert.doesNotMatch(workspace,/new URL\(['"]\.\.\/plugin/);
  assert.doesNotMatch(workspace,/window\.open\(pluginSiteUrl/);
  assert.match(editor,/message\?\.pluginManagerUrl/);
  assert.match(editor,/getPluginManagerUrl\(\)/);
  assert.doesNotMatch(editor,/document\.referrer/);
  assert.doesNotMatch(editor,/new URL\(root \+/);
  assert.match(embedded,/data-file-action="plugin"/);
});

test('native ConPTY PowerShell tabs and Local Agent installer',()=>{
 const tool=read('plugins/cluster.text-editor/scripts/powershell-tool.js');
 const terminal=read('plugins/cluster.powershell/index.html');
 const bridge=read('plugins/cluster.powershell/bridge/server.cjs');
 const setup=read('plugins/cluster.powershell/bridge/Setup-ClusterPowerShell.cmd');
 assert.match(html,/scripts\/powershell-tool\.js/);
 assert.match(tool,/PRMU\.resolveCapability/);
 assert.match(tool,/workspace\.powershell\.v1/);
 assert.match(terminal,/cluster\.public\.v1/);
 assert.match(terminal,/new window\.Terminal/);
 assert.match(terminal,/FitAddon/);
 assert.match(terminal,/new WebSocket/);
 assert.match(terminal,/type:'input'/);
 assert.match(terminal,/type:'resize'/);
 assert.match(terminal,/type:'create'/);
 assert.match(terminal,/role="tablist"/);
 assert.match(terminal,/class="setup-workspace"/);
 assert.match(bridge,/require\('node-pty'\)/);
 assert.match(bridge,/pty\.spawn\(shell/);
 assert.match(bridge,/useConpty:true/);
 assert.match(bridge,/proc\.write\(msg\.data\)/);
 assert.match(bridge,/proc\.resize\(msg\.cols,msg\.rows\)/);
 assert.match(bridge,/new WebSocketServer/);
 assert.match(bridge,/MAX_SESSIONS = 12/);
 assert.match(bridge,/127\.0\.0\.1/);
 assert.match(bridge,/randomBytes\(32\)/);
 assert.match(setup,/npm install --omit=dev/);
 assert.match(setup,/OpenJS\.NodeJS\.LTS/);
 assert.match(setup,/server\.cjs/);
});

test('PowerShell setup is inline, not an overlay, and transitions to terminal view',()=>{
 const html=read('plugins/cluster.powershell/index.html');
 const guide=read('plugins/cluster.text-editor/scripts/powershell-onboarding.js');
 const bridge=read('plugins/cluster.powershell/bridge/server.cjs');
 const setup=read('plugins/cluster.powershell/bridge/Setup-ClusterPowerShell.cmd');
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script);
 new Script(script,{filename:'cluster-powershell.js'});
 new Script(guide,{filename:'powershell-onboarding.js'});
 new Script(bridge,{filename:'server.cjs'});
 assert.match(html,/class="setup-workspace"/);
 assert.match(html,/class="setup-grid"/);
 assert.match(html,/id="downloadSetup"/);
 assert.match(html,/id="terminalArea" hidden/);
 assert.match(html,/id="endpoint"/);
 assert.match(html,/id="token"/);
 assert.match(html,/id="verifyConnection"/);
 assert.match(html,/role="tablist"/);
 assert.match(html,/\$\('connectPanel'\)\.hidden=value/);
 assert.match(html,/\$\('terminalArea'\)\.hidden=!value/);
 assert.match(html,/bootstrapCommand/);
 assert.match(html,/new Blob\(\[bootstrapCommand\]/);
 assert.match(html,/cluster\.powershell\.setup\.v1/);
 assert.match(guide,/PRMU\.getCommunityConfig/);
 assert.match(guide,/PRMU\.getCommunityRepositoryUrl/);
 assert.match(guide,/bootstrap-ready/);
 assert.doesNotMatch(guide,/agent-onboard/);
 assert.doesNotMatch(guide,/header\.append/);
 assert.match(setup,/npm install-scripts approve node-pty/);
 assert.match(setup,/npm rebuild node-pty/);
 assert.match(setup,/require\('node-pty'\)/);
 assert.match(bridge,/normalizeAllowedOrigin/);
 assert.match(bridge,/parsed\.origin/);
 assert.match(bridge,/Access-Control-Allow-Private-Network/);
 assert.match(bridge,/randomBytes\(32\)\.toString\('hex'\)/);
});
test('copy-pasted full website URL becomes a strict browser Origin',()=>{
 const bridge=read('plugins/cluster.powershell/bridge/server.cjs');
 const func=bridge.match(/function normalizeAllowedOrigin\(value\) \{[\s\S]*?\n\}/)?.[0];
 assert.ok(func);
 const normalize=new Script(func+';normalizeAllowedOrigin').runInNewContext({URL});
 assert.equal(normalize('https://example.com/Cluster-v3/plugin/'),'https://example.com');
 assert.equal(normalize('https://example.com:8443/editor/'),'https://example.com:8443');
 assert.equal(normalize('http://127.0.0.1:43881/a'),'http://127.0.0.1:43881');
 assert.throws(()=>normalize('http://example.com/anything'));
 assert.throws(()=>normalize('https://user:pass@example.com/path'));
});


test('single workspace tab bar represents files and native PowerShell sessions',()=>{
 const unified=read('plugins/cluster.text-editor/scripts/workspace-unified-tabs.js');
 const tool=read('plugins/cluster.text-editor/scripts/powershell-tool.js');
 const ps=read('plugins/cluster.powershell/index.html');
 const page=read('plugins/cluster.text-editor/index.html');
 new Script(unified,{filename:'workspace-unified-tabs.js'});
 new Script(tool,{filename:'powershell-tool.js'});
 new Script(ps.match(/<script>([\s\S]*?)<\/script>/)[1],{filename:'powershell-terminal.js'});
 assert.match(page,/scripts\/workspace-unified-tabs\.js/);
 assert.match(unified,/className='unified-tabbar'/);
 assert.match(unified,/pane\.insertBefore\(tabbar,view\)/);
 assert.match(unified,/documents=new Map\(\)/);
 assert.match(unified,/cluster\.editor\.v1/);
 assert.match(unified,/workspace\.snapshot/);
 assert.match(unified,/tabs\.activate/);
 assert.match(unified,/document\.close/);
 assert.match(unified,/cluster\.powershell\.tabs\.v1/);
 assert.match(unified,/request-state/);
 assert.match(unified,/psRequest\('create'\)/);
 assert.match(unified,/nav#tabs\{display:none!important\}/);
 assert.match(ps,/body\.embedded-unified #tabs\{display:none!important\}/);
 assert.match(ps,/function publishTabState/);
 assert.match(ps,/sessions:\[\.\.\.sessions\.values\(\)\]/);
 assert.match(ps,/msg\.type==='activate'/);
 assert.match(ps,/msg\.type==='close'/);
 assert.match(ps,/msg\.type==='create'/);
 assert.match(tool,/\.cluster-shell-tabs\{display:none!important/);
 assert.match(tool,/toggle\.before\(group\)/);
 assert.match(tool,/\.cluster-tool-menu \.menu-glyph/);
 assert.match(tool,/\.cluster-tool-menu \.menu-detail/);
 assert.match(tool,/addEventListener\('pointerdown',event=>\{if\(!group\.contains\(event\.target\)\)closeMenu\(\);\},true\)/);
 assert.match(tool,/addEventListener\('blur',closeMenu\)/);
 assert.match(tool,/cluster-powershell-new-tab/);
});

test('AI Agent MCP manifest, PRMU locale palette, setup and actual agent event feed',()=>{
 const page=read('plugins/cluster.ai-agent-mcp/index.html');
 const source=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(source);new Script(source,{filename:'ai-agent-mcp.js'});
 const loader=read('plugins/cluster.text-editor/scripts/ai-agent-tool.js');
 new Script(loader,{filename:'ai-agent-tool.js'});
 assert.match(page,/id="railDivider"/);
 assert.match(page,/setRail\(!railOpen\)/);
 assert.match(page,/pointermove/);
 assert.match(page,/localStorage\.setItem\('cluster\.ai-agent\.rail'/);
 assert.match(page,/cluster\.public\.v1/);
 assert.match(page,/--ui-/);
 assert.match(page,/cluster\.powershell\.setup\.v1/);
 assert.match(page,/call\('\/activity'\)/);
 assert.match(page,/call\('\/health'\)/);
 assert.match(page,/const tools=\['get_status'/);
 assert.match(page,/v3 Router/);
 assert.match(page,/indexedDB/);
 assert.match(page,/AES-GCM/);
 assert.match(page,/id="remember"/);
 assert.match(page,/id="forget"/);
 for(const language of ['zh-TW','en','fr','ja','es','hi'])
   assert.ok(source.includes("'"+language+"':")||source.includes(language+':'),
     'Missing locale '+language);
 assert.match(loader,/PRMU\.resolveCapability/);
 assert.match(loader,/workspace\.ai-agent-mcp\.v1/);
 assert.match(loader,/cluster-ai-agent-view/);
 assert.match(loader,/community-index\.json/);
});
test('Workspace registers AI Agent Tab and themed Tool menu',()=>{
 const tool=read('plugins/cluster.text-editor/scripts/powershell-tool.js');
 const tabs=read('plugins/cluster.text-editor/scripts/workspace-unified-tabs.js');
 const setup=read('plugins/cluster.text-editor/scripts/powershell-onboarding.js');
 const page=read('plugins/cluster.text-editor/index.html');
 new Script(tool);new Script(tabs);new Script(setup);
 assert.match(page,/scripts\/ai-agent-tool\.js/);
 assert.match(tool,/AI Agent MCP/);
 assert.match(tool,/cluster-ai-agent-open/);
 assert.match(tabs,/cluster-ai-agent-view/);
 assert.match(tabs,/selected==='agent'/);
 assert.match(setup,/Cluster AI Agent MCP/);
});
test('Windows DPAPI token, stable loopback and Ctrl C copy semantics',()=>{
 const server=read('plugins/cluster.powershell/bridge/server.cjs');
 const secure=read('plugins/cluster.powershell/bridge/secure-store.cjs');
 const page=read('plugins/cluster.powershell/index.html');
 new Script(server);new Script(secure);
 const js=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];new Script(js);
 assert.match(server,/secureStore\.loadOrMigrate/);
 assert.match(server,/pairing-token\.dpapi/);
 assert.match(server,/previousPort/);
 assert.match(server,/if\(url\.pathname==='\/activity'\)/);
 assert.match(server,/X-Cluster-Token/);
 assert.match(server,/Input content withheld/);
 assert.match(secure,/DataProtectionScope\]::CurrentUser/);
 assert.match(page,/term\.attachCustomKeyEventHandler/);
 assert.match(page,/term\.hasSelection\(\)/);
 assert.match(page,/term\.getSelection\(\)/);
 assert.match(page,/navigator\.clipboard\?\.writeText/);
 assert.match(page,/term\.clearSelection\(\);return false/);
 assert.match(page,/id="rememberPairing"/);
 assert.match(page,/pairingVault\.save\(endpoint,token\)/);
 assert.match(page,/pairingVault\.clear\(\)/);
 assert.match(page,/indexedDB/);
});

test('all 14 browser MCP tools bind real capability handlers with fail-closed approval',()=>{
 const page=read('plugins/cluster.ai-agent-mcp/index.html');
 const source=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 new Script(source,{filename:'cluster.ai-agent-mcp/index.html'});
 const names=[
 'get_status','get_task_status','list_files','get_editor_state',
 'read_file','list_roots','find_root_windows_path','list_directory',
 'read_path','create_file','write_path','delete_path',
 'open_powershell','powershell_request'
 ];
 for(const name of names){
  assert.match(source,new RegExp("case 'cluster\\."+name+"'"),name);
 }
 assert.match(source,/function requestApproval/);
 assert.match(source,/approvalPending/);
 assert.match(source,/id="approvalPane"/);
 assert.match(source,/setTimeout\(\(\)=>settle\(null/);
 assert.match(source,/window\.showDirectoryPicker/);
 assert.match(source,/parent\.postMessage\(\{protocol:'cluster\.ai-agent\.editor\.v1'/);
 assert.match(source,/document\.dirty===true/);
 assert.doesNotMatch(source,/window\.confirm\(/);
 assert.doesNotMatch(source,/window\.prompt\(/);
 assert.match(source,/type:'tool_result'/);
 const bridge=read('plugins/cluster.powershell/bridge/server.cjs');
 assert.match(bridge,/if\(url\.pathname==='\/mcp\/call'\)/);
 assert.match(bridge,/if\(ws\.isAgent\)/);
 assert.match(bridge,/runApprovedPowerShell/);
 assert.match(bridge,/pending\.args\.command,cwd/);
});
test('MCP first-run bootstrap includes secure gateway and OAuth scripts',()=>{
 const onboarding=read('plugins/cluster.text-editor/scripts/powershell-onboarding.js');
 for(const file of ['secure-store.cjs','mcp-gateway.cjs',
 'oauth-mcp-gateway.cjs','Start-Cluster-MCP.cmd','Show-OAuth-Approval.cmd'])
  assert.ok(onboarding.includes(file),file);
 const installer=read('plugins/cluster.powershell/bridge/Start-Cluster-MCP.cmd');
 assert.match(installer,/CLUSTER_OAUTH_ISSUER/);
 assert.match(installer,/mcp-gateway\.cjs/);
 assert.match(installer,/oauth-mcp-gateway\.cjs/);
 const oauth=read('plugins/cluster.powershell/bridge/oauth-mcp-gateway.cjs');
 assert.match(oauth,/resourceId=issuer\+'\/mcp'/);
 assert.match(oauth,/authorization_response_iss_parameter_supported:true/);
 assert.match(oauth,/if\(route==='\/revoke'/);
 assert.match(oauth,/DataProtectionScope|secureStore\.loadOrMigrate/);
 for(const lang of ['zh-TW','en','fr','ja','es','hi'])
  assert.ok(oauth.includes('"'+lang+'":')||oauth.includes('"'+lang+'"'),lang);
});
