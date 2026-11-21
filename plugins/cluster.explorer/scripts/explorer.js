/* Cluster Explorer: virtual file tree; inter-plugin operations use Host Router only. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const entries = new Map();
  const expanded = new Set(['']);
  const requests = new Map();
  let counter = 0;
  let selectedPath = null;
  const manualOrder = new Map();
  let clipboard = null;
  let dragSession = null;
  let consumedClick = false;
  let pendingRemoval = new Map();
  let inlineEdit = null; // {mode, path, folder, parent, value}
  let closingTree = null;
  // Host owns locale. Every visible label uses the common six-language contract.
  const translations = {
    '重新命名':['Rename','Renommer','名前を変更','Renombrar','नाम बदलें'],
    '複製':['Copy','Copier','コピー','Copiar','कॉपी करें'],
    '剪下':['Cut','Couper','切り取り','Cortar','काटें'],
    '貼上':['Paste','Coller','貼り付け','Pegar','चिपकाएँ'],
    '關閉':['Close','Fermer','閉じる','Cerrar','बंद करें'],
    '刪除':['Delete','Supprimer','削除','Eliminar','हटाएँ'],
    '建立資料夾':['New folder','Nouveau dossier','新しいフォルダー','Nueva carpeta','नया फ़ोल्डर'],
    '建立文件':['New file','Nouveau fichier','新規ファイル','Nuevo archivo','नई फ़ाइल'],
    '開啟資料夾':['Open folder','Ouvrir dossier','フォルダーを開く','Abrir carpeta','फ़ोल्डर खोलें'],
    '開啟文件':['Open file','Ouvrir fichier','ファイルを開く','Abrir archivo','फ़ाइल खोलें'],
    '重新整理並關閉已載入根目錄':['Refresh and close roots','Actualiser et fermer les racines','更新してルートを閉じる','Actualizar y cerrar raíces','रीफ़्रेश करें और रूट बंद करें'],
    '搜尋文件':['Search files','Rechercher des fichiers','ファイルを検索','Buscar archivos','फ़ाइल खोजें'],
    '收合檔案總管':['Collapse Explorer','Réduire Explorateur','エクスプローラーを閉じる','Ocultar explorador','एक्सप्लोरर बंद करें'],
    '新增資料夾':['New folder','Nouveau dossier','新しいフォルダー','Nueva carpeta','नया फ़ोल्डर'],
    '未命名.txt':['Untitled.txt','Sans titre.txt','無題.txt','Sin título.txt','बेनाम.txt'],
    '取消':['Cancel','Annuler','キャンセル','Cancelar','रद्द करें'],
    '確認刪除':['Confirm deletion','Confirmer la suppression','削除の確認','Confirmar eliminación','हटाने की पुष्टि'],
    '刪除完成':['Deleted','Supprimé','削除しました','Eliminado','हटा दिया गया'],
    '未能關閉文件':['Could not close file','Impossible de fermer','ファイルを閉じられません','No se puede cerrar','फ़ाइल बंद नहीं हुई'],
    '輸入名稱':['Enter name','Saisir le nom','名前を入力','Introduzca nombre','नाम दर्ज करें'],
    '名稱已存在':['Name already exists','Nom déjà utilisé','名前は既に存在します','El nombre ya existe','नाम पहले से है'],
    '無法開啟編輯器：':['Cannot open editor: ','Impossible d’ouvrir l’éditeur : ','エディターを開けません：','No se puede abrir el editor: ','संपादक नहीं खुला: ']
  };
  const languageIndex={en:0,fr:1,ja:2,es:3,hi:4};
  const t = (zh,en) => locale.startsWith('zh') ? zh :
    (translations[zh]?.[languageIndex[locale]] || en);


  const openDocuments = new Map(); // canonical path -> editor document metadata
  const workspaceProtocol = 'cluster.workspace.sync.v1';
  const sendWorkspace = (action, params = {}) => {
    if (window.parent !== window) parent.postMessage({
      protocol:workspaceProtocol,type:'command',action,params
    }, '*');
    else if(action==='file.new')createEntry(false);
  };
  const canonical = value => escapePath(String(value || ''));

  let toastTimer;
  let locale = 'zh-TW';
  const MAX_FILE = 10 * 1024 * 1024;
  const TYPES = /\.(txt|md|json|js|ts|jsx|tsx|html|css|py|c|h|cpp|hpp|java|rs|go|xml|yaml|yml|csv|log|ini|sh|ps1|sql|toml)$/i;
  const knownFolders = new Set();
  // Directory handles are kept in this plugin's memory, never in PRMU/JSON.
  // Only files enumerated from a user-authorized directory are disk-backed.
  const diskRoots = new Map(); // imported root path -> FileSystemDirectoryHandle
  const diskPaths = new Set(); // canonical names observed on disk
  const hasDiskOrigin = path => [...diskRoots].some(([root]) =>
    path === root || path.startsWith(root + '/'));
  const isDiskBacked = path => diskRoots.has(path) || diskPaths.has(path);
  function diskOrigin(path) {
    const roots = [...diskRoots.keys()].filter(root =>
      path === root || path.startsWith(root + '/'));
    if (!roots.length) return null;
    const root = roots.sort((a,b)=>b.length-a.length)[0];
    return {root, handle:diskRoots.get(root), relative:path.slice(root.length).replace(/^\//,'')};
  }
  async function openAuthorizedFolder(handle) {
    if (!handle || handle.kind !== 'directory')
      throw new Error(t('無效的目錄權限','Invalid directory handle'));
    const base = escapePath(handle.name);
    if (!base || exists(base))
      throw new Error(t('工作區已有同名根目錄，請先關閉','A root with this name already exists'));
    const rows=[];
    const folders=[];
    const MAX_ENTRIES=3000;
    async function scan(directory,relative,depth) {
      if(depth>24) throw Error('Directory depth exceeds 24');
      for await (const [name, child] of directory.entries()) {
        if(rows.length+folders.length>=MAX_ENTRIES)
          throw Error('Folder exceeds 3,000 entries; no partial import was performed');
        const path=relative+'/'+name;
        if(child.kind==='directory') {
          folders.push(path);
          await scan(child,path,depth+1);
        } else if(child.kind==='file') {
          const file=await child.getFile();
          if(!TYPES.test(name) || file.size>MAX_FILE) continue;
          try { rows.push([path,new TextDecoder('utf-8',{fatal:true})
            .decode(await file.arrayBuffer())]); }
          catch { /* Unsupported file: do not pretend it is editable. */ }
        }
      }
    }
    await scan(handle,base,0);
    knownFolders.add(base);
    diskRoots.set(base,handle);
    for(const folder of folders){ knownFolders.add(folder);diskPaths.add(folder); }
    for(const [path,content] of rows){ addFile(path,content);diskPaths.add(path); }
    expanded.add(base);
    render();
    toast(t(`已連結磁碟資料夾：${base}`,
      `Disk folder connected: ${base}`));
  }
  async function chooseAuthorizedFolder() {
    if(typeof window.showDirectoryPicker!=='function') {
      toast(t('瀏覽器不支援磁碟授權；將以唯讀方式匯入',
        'Writable directory picker unavailable; using read-only import'));
      $('folderInput').click(); return;
    }
    try {
      // Call picker immediately from a user gesture (no prior awaits).
      const handle=await window.showDirectoryPicker({mode:'readwrite'});
      await openAuthorizedFolder(handle);
    } catch(error) {
      if(error?.name==='AbortError')return;
      toast(t('資料夾開啟失敗：','Cannot open directory: ')+String(error.message||error));
    }
  }
  async function deleteFromDisk(item) {
    const origin=diskOrigin(item.path);
    if(!origin || !diskPaths.has(item.path))
      throw Error(t('此項目沒有磁碟刪除權限','No disk-delete authorization for this item'));
    if(!origin.relative)throw Error('Cannot delete the selected authorization root');
    // requestPermission is user-activation-sensitive: call it directly after
    // the confirmation button click and before unrelated async operations.
    if(typeof origin.handle.requestPermission === 'function') {
      const permission=await origin.handle.requestPermission({mode:'readwrite'});
      if(permission!=='granted')throw Error(t('未取得磁碟寫入權限','Disk write permission denied'));
    }
    const parts=origin.relative.split('/').filter(Boolean);
    let parent=origin.handle;
    for(const name of parts.slice(0,-1))
      parent=await parent.getDirectoryHandle(name);
    await parent.removeEntry(parts.at(-1),{recursive:Boolean(item.folder)});
  }

  // Explicit Save-to-disk for workspace-only files and folders. The native
  // picker is called directly from the Explorer row click (user activation).
  async function saveWorkspaceItem(item) {
    try {
      if (isDiskBacked(item.path)) {
        toast(t('磁碟來源已存在，請在編輯器直接儲存',
          'Disk-backed item: use Editor Save to overwrite'));return;
      }
      if (item.folder) {
        if (typeof window.showDirectoryPicker !== 'function')
          throw Error(t('瀏覽器不支援選擇資料夾儲存位置',
            'Browser cannot select a destination folder'));
        const destination = await window.showDirectoryPicker({mode:'readwrite'});
        const root = await destination.getDirectoryHandle(item.name,{create:true});
        const folders = [...knownFolders].filter(path =>
          path.startsWith(item.path+'/')).sort((a,b)=>a.length-b.length);
        for (const folder of folders) {
          const parts=folder.slice(item.path.length+1).split('/').filter(Boolean);
          let current=root;
          for (const part of parts)
            current=await current.getDirectoryHandle(part,{create:true});
        }
        for (const [path,file] of entries) {
          if(!path.startsWith(item.path+'/'))continue;
          const parts=path.slice(item.path.length+1).split('/').filter(Boolean);
          let current=root;
          for(const part of parts.slice(0,-1))
            current=await current.getDirectoryHandle(part,{create:true});
          const target=await current.getFileHandle(parts.at(-1),{create:true});
          const stream=await target.createWritable();
          try{await stream.write(file.content);await stream.close();}
          catch(error){try{await stream.abort();}catch{}throw error;}
        }
      } else {
        if(typeof window.showSaveFilePicker !== 'function')
          throw Error(t('瀏覽器不支援選擇檔案儲存位置',
            'Browser cannot select a destination file'));
        const target=await window.showSaveFilePicker({suggestedName:item.name});
        const stream=await target.createWritable();
        try{await stream.write(item.content);await stream.close();}
        catch(error){try{await stream.abort();}catch{}throw error;}
      }
      toast(t('已儲存至選擇的磁碟位置','Saved to selected disk location'));
    } catch(error) {
      if(error?.name==='AbortError')return;
      toast(t('儲存失敗：','Save failed: ')+String(error.message||error));
    }
  }
  const escapePath = path => path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const parents = path => {
    const bits = path.split('/');
    const output = [];
    while (bits.length > 1) { bits.pop(); output.unshift(bits.join('/')); }
    return output;
  };
  const toast = message => {
    const el = $('toast'); el.textContent = message; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3800);
  };
  const setStatus = value => { $('status').textContent = value; };
  const registerFolders = path => parents(path).forEach(p => { if (p) knownFolders.add(p); });
  const fileIcon = name => /\.md$/i.test(name) ? 'M↓' : /\.(js|ts|jsx|tsx)$/i.test(name) ? 'JS' :
    /\.(html|css)$/i.test(name) ? '<>' : /\.json$/i.test(name) ? '{}' : /\.py$/i.test(name) ? 'Py' : '≡';

  async function hostRequest(method, ...args) {
    if (window.parent === window) throw new Error('未連接 Cluster Host Router');
    const requestId = 'explorer-' + (++counter);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { requests.delete(requestId); reject(new Error('Host Router timeout')); }, 12000);
      requests.set(requestId, {resolve, reject, timeout});
      parent.postMessage({protocol:'cluster.plugin.v1',type:'request',requestId,method,args}, '*');
    });
  }
  window.addEventListener('message', event => {
    if (event.source !== parent || !event.data || typeof event.data !== 'object') return;
    const data = event.data;
    if (data.protocol === workspaceProtocol && data.type === 'event') {
      const doc = data.data?.document;
      const path = canonical(doc?.path || data.data?.path);
      if(data.event==='document.closeRejected'){
        const rejected=[...openDocuments].find(([,meta])=>
          String(meta.id)===String(data.data?.id))?.[0];
        if(rejected)pendingRemoval.delete(rejected);
        toast(t('未能關閉文件','Could not close the file'));render();return;
      }
      if (data.event === 'document.opened' && doc) {
        const targetPath = path || canonical(doc.name);
        if (targetPath && !entries.has(targetPath))
          addFile(targetPath, typeof data.data.content === 'string' ? data.data.content : '');
        if (targetPath) { openDocuments.set(targetPath, {...doc,path:targetPath});
          parents(targetPath).forEach(dir => expanded.add(dir));
          if (doc.active) selectedPath=targetPath; }
      } else if (data.event === 'document.closed') {
        const pendingPath = path || [...openDocuments].find(([,x]) =>
          String(x.id) === String(data.data.id))?.[0];
        if (pendingPath && pendingRemoval.has(pendingPath)) {
          const remove = pendingRemoval.get(pendingPath); pendingRemoval.delete(pendingPath);
          remove();
        }
        if (path) openDocuments.delete(path);
        else for (const [key, item] of openDocuments)
          if (String(item.id) === String(data.data.id)) openDocuments.delete(key);
      } else if (doc && (data.event === 'tab.activated' ||
          data.event === 'document.changed' || data.event === 'document.saved')) {
        const targetPath = path || [...openDocuments].find(([,x])=>
          String(x.id) === String(doc.id))?.[0] || canonical(doc.name);
        if (targetPath) {
          if (!entries.has(targetPath)) addFile(targetPath, typeof data.data.content === 'string' ? data.data.content : '');
          openDocuments.set(targetPath, {...doc,path:targetPath});
          if (typeof data.data.content === 'string' && entries.has(targetPath))
            entries.get(targetPath).content = data.data.content;
          if (data.event === 'tab.activated') {
            for (const entry of openDocuments.values()) entry.active = false;
            selectedPath = targetPath;
            parents(targetPath).forEach(dir => expanded.add(dir));
          }
        }
      }
      render(); return;
    }

    if (data.protocol === 'cluster.plugin.v1' && data.type === 'response') {
      const pending = requests.get(data.requestId);
      if (pending) { clearTimeout(pending.timeout); requests.delete(data.requestId); pending.resolve(data); }
    }
    if (data.protocol === 'cluster.plugin.v1' && data.type === 'context') {
      if (typeof data.language === 'string') { locale = data.language; updateLanguage();render(); }
      if (data.pluginId === 'cluster.explorer') void registerServices();
    }
    if (data.protocol === 'cluster.plugin.v1' && data.type === 'invoke') {
      const handler = services.get(data.action);
      Promise.resolve().then(() => {
        if (!handler) throw Error('Unknown action');
        return handler(data.payload || {});
      }).then(value => parent.postMessage({protocol:'cluster.plugin.v1',
        type:'invoke-result',requestId:data.requestId,ok:true,data:value},'*'),
        error => parent.postMessage({protocol:'cluster.plugin.v1',
          type:'invoke-result',requestId:data.requestId,ok:false,
          error:{code:'EXPLORER_SERVICE_ERROR',message:String(error.message || error)}},'*'));
    }
  });

  $('collapseNotice').addEventListener('click', () => sendWorkspace('sidebar.toggle', {}));
  window.addEventListener('message',event=>{
    const data=event.data;
    if(event.source!==parent||data?.protocol!=='cluster.workspace.file.v1'||
      data.type!=='save-request')return;
    const requestId=String(data.requestId||'');
    const path=canonical(data.path);
    const result=(ok,error)=>parent.postMessage({protocol:'cluster.workspace.file.v1',
      type:'save-result',requestId,ok,error:error||null},'*');
    (async()=>{
      if(!diskPaths.has(path)||!entries.has(path))
        throw Error(t('此文件沒有磁碟來源，請選擇儲存位置',
          'No disk location for this file; choose a save destination'));
      const origin=diskOrigin(path);
      if(!origin?.relative)throw Error('Missing authorized parent');
      const pieces=origin.relative.split('/').filter(Boolean);
      let directory=origin.handle;
      // The granted folder handle is never serialized to the Editor.
      if(typeof directory.queryPermission==='function' &&
         await directory.queryPermission({mode:'readwrite'})!=='granted')
        throw Error(t('目錄尚未取得讀寫權限','Directory write permission not granted'));
      for(const segment of pieces.slice(0,-1))
        directory=await directory.getDirectoryHandle(segment);
      const handle=await directory.getFileHandle(pieces.at(-1));
      const content=String(data.content||'');
      if(new Blob([content]).size>MAX_FILE)throw Error('File exceeds size limit');
      const writable=await handle.createWritable();
      try{await writable.write(content);await writable.close();}
      catch(error){try{await writable.abort();}catch{}throw error;}
      entries.get(path).content=content;
      result(true);
    })().catch(error=>result(false,String(error.message||error)));
  });
  window.addEventListener('message', event => {
    if (event.source !== parent || event.data?.protocol !== workspaceProtocol ||
        event.data.type !== 'control') return;
    const action = event.data.action;
    if (action === 'new-folder') createEntry(true);
    if (action === 'new-file') createEntry(false);
    if (action === 'refresh') refreshTree();
    if (action === 'import-folder') $('folderInput').click();
    if (action === 'import-folder-picker') void chooseAuthorizedFolder();
    if (action === 'import-handle') void openAuthorizedFolder(event.data.handle)
      .catch(error=>toast(String(error.message||error)));
    if (action === 'import-files') $('filesInput').click();
    if (action === 'import-file-list' && Array.isArray(event.data.files))
      void importList(event.data.files);
  });
  $('workspaceFolder').addEventListener('click', event => {
    if (event.target.closest('button')) return;
    if (expanded.has('')) expanded.delete(''); else expanded.add('');
    $('tree').hidden = !expanded.has('');
  });
  let registered = false;
  async function registerServices() {
    if (registered) return;
    registered = true;
    const definitions = [
      ['workspace.files.list', 'List current virtual workspace files',
        () => [...entries.values()].map(({path,name}) => ({path,name}))],
      ['workspace.files.read', 'Read an existing virtual text file',
        payload => { const file = entries.get(escapePath(String(payload?.path || '')));
          if (!file) throw new Error('File not found');
          return {path:file.path,name:file.name,content:file.content}; }]
    ];
    // Register the UI as a reusable capability, not a hard-coded Host route.
    // The public registration is owned by this plugin and removed on unload.
    try {
      const registeredUI = await hostRequest('PRMU.register', 'capabilities', {
        key:'workspace.explorer.v1', value:{kind:'ui.embed',version:'1.0.0'},
        sharedWrite:false, persistent:false
      });
      if (!registeredUI.ok && registeredUI.error?.code !== 'ALREADY_REGISTERED')
        throw Error(registeredUI.error?.message || 'Capability registration failed');
    } catch (err) { console.warn('PRMU capability registration:',err); }
    for (const [action, description, handler] of definitions) {
      try {
        const reply = await hostRequest('Router.register', action,
          'runtime-callback', {contract:{version:'1.0.0',description,
            request:{type:'object'},response:{type:'object'}}});
        if (!reply.ok) throw Error(reply.error?.message || 'Router registration failed');
        services.set(action,handler);
      } catch (err) { console.warn('Explorer service registration:',action,err); }
    }
  }
  const services = new Map();
  if (window.parent !== window) parent.postMessage({protocol:'cluster.plugin.v1',type:'hello'}, '*');

  function addFile(path, content) {
    path = escapePath(path);
    if (!path || path.includes('..') || path.startsWith('/')) throw new Error('Invalid path');
    registerFolders(path);
    entries.set(path, {path, name:path.split('/').pop(), content});
  }
  async function importList(files) {
    let success = 0, skipped = 0;
    for (const file of files) {
      const path = escapePath(file.webkitRelativePath || file.name);
      if (!TYPES.test(file.name) || file.size > MAX_FILE || !path) { skipped++; continue; }
      try {
        const bytes = file.data instanceof ArrayBuffer ? file.data : await file.arrayBuffer();
        const text = new TextDecoder('utf-8', {fatal:true}).decode(bytes);
        addFile(path, text); success++;
      } catch { skipped++; }
    }
    render(); setStatus(`IMPORTED ${success}`);
    toast(`已匯入 ${success} 個文字檔${skipped ? `，略過 ${skipped} 個不支援檔案` : ''}`);
  }
  const parentOf = path => path.includes('/') ? path.slice(0,path.lastIndexOf('/')) : '';
  const basename = path => path.split('/').pop();
  const cleanName = name => !!name && !/[\\/\u0000-\u001f]/.test(name) &&
    name !== '.' && name !== '..';
  const exists = path => entries.has(path) || knownFolders.has(path);
  function remapPath(oldPath, newPath) {
    const mappings = [];
    for (const key of [...entries.keys(), ...knownFolders]) {
      if (key === oldPath || key.startsWith(oldPath + '/'))
        mappings.push([key, newPath + key.slice(oldPath.length)]);
    }
    if (mappings.some(([,dest]) => exists(dest) && !mappings.some(([src])=>src===dest)))
      throw new Error('目標已有同名檔案');
    for (const [before,after] of mappings) {
      if (entries.has(before)) {
        const entry = entries.get(before); entries.delete(before);
        entry.path=after; entry.name=basename(after);entries.set(after,entry);
      }
      if (knownFolders.delete(before)) knownFolders.add(after);
      const meta=openDocuments.get(before);
      if (meta) {
        openDocuments.delete(before);
        openDocuments.set(after,{...meta,path:after,name:basename(after)});
        sendWorkspace('document.rename',{id:String(meta.id),
          name:basename(after),path:'/'+after});
      }
      if(selectedPath===before) selectedPath=after;
    }
    const nextOrder=new Map();
    for (const [parent,order] of manualOrder)
      nextOrder.set(parent===oldPath||parent.startsWith(oldPath+'/') ?
        newPath+parent.slice(oldPath.length):parent,
        order.map(v=>v===oldPath||v.startsWith(oldPath+'/')?
          newPath+v.slice(oldPath.length):v));
    manualOrder.clear();for(const [key,value] of nextOrder)manualOrder.set(key,value);
  }
  function removePath(item) {
    if(diskRoots.has(item.path))diskRoots.delete(item.path);
    for(const path of [...diskPaths])
      if(path===item.path || (item.folder && path.startsWith(item.path+'/')))
        diskPaths.delete(path);
    if (item.folder) {
      for(const key of [...entries.keys()])if(key.startsWith(item.path+'/'))entries.delete(key);
      for(const key of [...knownFolders])
        if(key===item.path||key.startsWith(item.path+'/'))knownFolders.delete(key);
    } else entries.delete(item.path);
    for(const [k,v] of manualOrder)manualOrder.set(k,v.filter(path=>
      path!==item.path&&!path.startsWith(item.path+'/')));
    if(selectedPath===item.path)selectedPath=null;
    render();
  }
  function openedWithin(item) {
    return [...openDocuments].filter(([path]) => path===item.path ||
      (item.folder && path.startsWith(item.path+'/')));
  }
  function closeEntry(item) {
    // Close is non-destructive to disk and never prompts for confirmation.
    // Folder/root close releases its virtual subtree as well as all child tabs.
    const documents=openedWithin(item);
    for(const [,meta] of documents) sendWorkspace('document.close', {
      id:String(meta.id), discardChanges:true
    });
    if (item.folder) {
      for(const [path] of documents) openDocuments.delete(path);
      removePath(item);
    } else {
      openDocuments.delete(item.path);
      selectedPath=item.path;
      render();
    }
  }
  function refreshTree() {
    // Reload Explorer roots: imported folder trees close with their tabs.
    // Detached untitled files are retained unless they belong to a root.
    const roots=[...knownFolders].filter(path=>!path.includes('/'));
    for(const root of roots) closeEntry({path:root,name:basename(root),folder:true});
    expanded.clear();expanded.add('');
    manualOrder.clear();render();
    toast(t('已關閉所有資料夾根目錄','All folder roots closed'));
  }
  function deleteEntry(item) {
    const origin=diskOrigin(item.path);
    let detail, allowed=true;
    if(origin && diskRoots.has(item.path)) {
      detail=t('已授權的根目錄無法透過自身權限刪除，請先授權其父目錄。',
        'This authorized root cannot be deleted without parent-directory access.');
      allowed=false;
    } else if(origin && diskPaths.has(item.path)) {
      detail=t('永久刪除磁碟原始檔案或資料夾（包括未顯示子項目），無法復原。',
        'Permanently delete original disk content, including hidden children. This cannot be undone.');
      detail+=' '+origin.root+'/'+origin.relative;
    } else {
      detail=t('僅刪除工作區中的項目，磁碟上的原始檔案不變。',
        'Remove only the workspace copy; the disk original is unchanged.');
    }
    // Confirmation dialog belongs to the editor workspace, never Explorer.
    sendWorkspace('delete.confirm',{path:item.path,name:item.name,folder:item.folder,
      disk:Boolean(origin && diskPaths.has(item.path)),allowed,detail});
  }
  window.addEventListener('message',event=>{
    if(event.source!==parent||event.data?.protocol!==workspaceProtocol||
       event.data.type!=='delete.decision'||event.data.approved!==true)return;
    const path=String(event.data.path||'');
    // Confirm only a still-visible exact path; no stale selection fallback.
    if(!visibleTree().some(item=>item.path===path))return;
    void deleteConfirmed(path).catch(error=>toast(t('刪除失敗，磁碟和工作區保持不變：',
      'Delete failed; disk and workspace unchanged: ')+String(error.message||error)));
  });
  async function deleteConfirmed(path) {
    const item=visibleTree().find(node=>node.path===path);
    if(!item)return false;
    if(diskRoots.has(path))throw Error('Cannot delete authorized root without parent access');
    if(diskPaths.has(path)) {
      // Never remove UI items unless the actual filesystem operation succeeded.
      await deleteFromDisk(item);
    }
    for(const [,meta] of openedWithin(item))sendWorkspace('document.close', {
      id:String(meta.id),discardChanges:true
    });
    for(const [key] of openedWithin(item))openDocuments.delete(key);
    if(item.folder){
      for(const key of [...diskPaths])
        if(key===path||key.startsWith(path+'/'))diskPaths.delete(key);
    } else diskPaths.delete(path);
    removePath(item);
    toast(t('刪除完成','Deleted successfully'));
    return true;
  }
  function renameEntry(item) {
    if (isDiskBacked(item.path)) {
      toast(t('磁碟檔案重新命名尚未支援；請勿改變真實路徑',
        'Renaming disk-backed items is not yet supported')); return;
    }
    inlineEdit={mode:'rename',path:item.path,folder:item.folder,
      parent:parentOf(item.path),value:item.name};
    render();
  }
  function commitInline(raw) {
    if(!inlineEdit)return;
    const state=inlineEdit;
    const name=String(raw||'').trim();
    if(!cleanName(name)){toast(t('名稱不可為空或包含 /、\\','Invalid filename'));return false;}
    const dest=(state.parent ? state.parent+'/' : '')+name;
    if(state.mode==='rename' && dest===state.path){inlineEdit=null;render();return true;}
    if(exists(dest)){toast(t('名稱已存在','Name already exists'));return false;}
    try {
      if(state.mode==='rename')remapPath(state.path,dest);
      else if(state.folder){knownFolders.add(dest);registerFolders(dest);}
      else addFile(dest,'');
      inlineEdit=null;
      parents(dest).forEach(dir=>expanded.add(dir));
      selectedPath=dest;render();
      if(state.mode==='create'&&!state.folder)void openFile(entries.get(dest));
      return true;
    }catch(err){toast(String(err.message||err));return false;}
  }
  function beginInline(row,name) {
    const field=document.createElement('input');
    field.className='inline-name';field.value=name;
    field.setAttribute('aria-label',t('輸入名稱','Enter name'));
    field.maxLength=180;
    let cancelled=false;let finished=false;
    const finish=commit=>{
      if(finished)return;
      if(commit){if(!commitInline(field.value))return;}
      else {inlineEdit=null;render();}
      finished=true;
    };
    field.addEventListener('click',event=>event.stopPropagation());
    field.addEventListener('pointerdown',event=>event.stopPropagation());
    field.addEventListener('keydown',event=>{
      event.stopPropagation();
      if(event.key==='Enter'){event.preventDefault();finish(true);}
      if(event.key==='Escape'){event.preventDefault();cancelled=true;finish(false);}
    });
    field.addEventListener('blur',()=>{if(!cancelled)finish(true);});
    row.replaceWith(field);
    requestAnimationFrame(()=>{field.focus();field.select();});
  }
  function setClipboard(item,cut) {
    if(cut && isDiskBacked(item.path)) {
      toast(t('磁碟檔案剪下移動尚未支援','Moving disk-backed files is not supported'));
      return;
    }
    clipboard={path:item.path,folder:item.folder,cut};
    render();
  }
  function pasteInto(item) {
    if(!clipboard)return;
    const source=clipboard.path;
    const targetDir=item?.folder?item.path:parentOf(item?.path||'');
    const destination=(targetDir?targetDir+'/':'')+basename(source);
    if(source===destination){toast('來源與目標相同');return;}
    if(item?.folder&&(targetDir===source||targetDir.startsWith(source+'/'))){
      toast('不可移動資料夾至自身內部');return;
    }
    if(exists(destination)){toast('目標已有同名項目');return;}
    if(clipboard.cut){
      try{remapPath(source,destination);clipboard=null;render();}
      catch(err){toast(err.message);}
    } else {
      const sourceFiles=[...entries].filter(([path])=>path===source||
        (clipboard.folder&&path.startsWith(source+'/')));
      for(const [path,file] of sourceFiles)
        addFile(destination+path.slice(source.length),file.content);
      if(clipboard.folder){
        knownFolders.add(destination);
        for(const path of [...knownFolders])if(path.startsWith(source+'/'))
          knownFolders.add(destination+path.slice(source.length));
      }
      render();
    }
  }
  function moveOrder(source,dest) {
    if(source===dest || parentOf(source)!==parentOf(dest))return;
    const parent=parentOf(source);
    const siblings=visibleTree().filter(item=>parentOf(item.path)===parent)
      .map(item=>item.path);
    const from=siblings.indexOf(source), to=siblings.indexOf(dest);
    if(from<0||to<0)return;
    siblings.splice(from,1);siblings.splice(to,0,source);
    manualOrder.set(parent,siblings);render();
  }
  function rowAction(symbol,label,handler,disabled=false) {
    const button=document.createElement('button');
    button.type='button';button.className='row-action';
    button.textContent=symbol;button.title=label;
    button.setAttribute('aria-label',label);button.disabled=disabled;
    button.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();handler();
    });
    return button;
  }
  function attachDrag(row,item) {
    row.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.target.closest('button,input'))return;
      clearTimeout(dragSession?.timer);
      const state={path:item.path,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,
        active:false,timer:null};dragSession=state;
      state.timer=setTimeout(()=>{
        if(dragSession!==state)return;
        state.active=true;try{row.setPointerCapture(state.pointerId);}catch{}
        row.classList.add('dragging');
        row.setAttribute('aria-grabbed','true');
      },200);
    });
    row.addEventListener('pointermove',event=>{
      const state=dragSession;
      if(!state||state.path!==item.path)return;
      if(!state.active && Math.hypot(event.clientX-state.startX,
          event.clientY-state.startY)>6){clearTimeout(state.timer);dragSession=null;return;}
      if(!state.active)return;
      document.querySelectorAll('.node.drop-target').forEach(n=>n.classList.remove('drop-target'));
      const node=document.elementFromPoint(event.clientX,event.clientY)?.closest('.node');
      if(node&&node.dataset.path!==state.path)node.classList.add('drop-target');
    });
    row.addEventListener('pointerup',event=>{
      const state=dragSession;
      if(!state||state.path!==item.path)return;
      clearTimeout(state.timer);
      if(state.active){
        const node=document.elementFromPoint(event.clientX,event.clientY)?.closest('.node');
        if(node?.dataset.path)moveOrder(state.path,node.dataset.path);
        consumedClick=true;setTimeout(()=>consumedClick=false,0);
      }
      try{if(row.hasPointerCapture(state.pointerId))row.releasePointerCapture(state.pointerId);}catch{}
      dragSession=null;row.classList.remove('dragging');
      row.removeAttribute('aria-grabbed');
      document.querySelectorAll('.node.drop-target').forEach(n=>n.classList.remove('drop-target'));
    });
    row.addEventListener('pointercancel',()=>{
      if(dragSession?.path===item.path){clearTimeout(dragSession.timer);dragSession=null;}
      row.classList.remove('dragging');
    });
  }

  function visibleTree() {
    // Depth-first traversal guarantees that every child stays immediately
    // under its own folder, regardless of the number of loaded roots.
    const dirs=new Set(knownFolders);
    for(const entry of entries.values())
      parents(entry.path).filter(Boolean).forEach(dir=>dirs.add(dir));
    const nodes=[...dirs].map(path=>({path,name:basename(path),folder:true}));
    nodes.push(...[...entries.values()].map(item=>({...item,folder:false})));
    const byParent=new Map();
    for(const item of nodes){
      const parent=parentOf(item.path);
      if(!byParent.has(parent))byParent.set(parent,[]);
      byParent.get(parent).push(item);
    }
    for(const [parent,siblings] of byParent){
      const order=manualOrder.get(parent)||[];
      siblings.sort((a,b)=>{
        const ai=order.indexOf(a.path),bi=order.indexOf(b.path);
        if(ai>=0||bi>=0)return ai<0?1:bi<0?-1:ai-bi;
        return Number(b.folder)-Number(a.folder)||a.name.localeCompare(b.name,undefined,{numeric:true});
      });
    }
    const ordered=[];
    function visit(parent){
      for(const node of byParent.get(parent)||[]){
        ordered.push(node);
        if(node.folder)visit(node.path);
      }
    }
    visit('');return ordered;
  }
  function render() {
    const items = visibleTree();
    const query = $('search').value.trim().toLowerCase();
    const tree = $('tree'); tree.replaceChildren();
    const folderHasMatch = path => items.some(x => x.path.startsWith(path + '/') && !x.folder && x.name.toLowerCase().includes(query));
    for (const item of items) {
      const depth = item.path.split('/').length - 1;
      const parentPath = item.path.includes('/') ? item.path.slice(0,item.path.lastIndexOf('/')) : '';
      if (query) {
        if (!item.name.toLowerCase().includes(query) && (!item.folder || !folderHasMatch(item.path))) continue;
      } else if (parents(item.path).some(p => p && !expanded.has(p))) continue;
      if (!query && parentPath && !expanded.has(parentPath)) continue;
      const row = document.createElement('div'); row.className = 'node'; row.setAttribute('role','treeitem'); row.dataset.path=item.path;
      row.setAttribute('aria-label', item.name); row.style.paddingLeft = (13 + depth * 17) + 'px';
      if (selectedPath === item.path) row.classList.add('selected');
      const live = !item.folder && openDocuments.get(item.path);
      if (live) row.classList.add('is-open');
      if (live?.active) row.classList.add('is-active');

      const twist = document.createElement('span'); twist.className = 'twisty'; twist.textContent = item.folder ? (expanded.has(item.path) || query ? '⌄' : '›') : '';
      const icon = document.createElement('span'); icon.className = 'file-icon' + (item.folder ? ' folder' : ''); icon.textContent = item.folder ? '▣' : '◇';
      const label = document.createElement('span'); label.className = 'node-name'; label.textContent = item.name;
      row.append(twist,icon,label);
      if(inlineEdit?.mode==='rename' && inlineEdit.path===item.path){
        const wrapper=document.createElement('span');wrapper.className='inline-anchor';
        row.replaceChild(wrapper,label);
        beginInline(wrapper,inlineEdit.value);
      }
      const tools=document.createElement('span');tools.className='node-actions';
      tools.append(
        rowAction('✎',t('重新命名','Rename'),()=>renameEntry(item)),
        rowAction('⧉',t('複製','Copy'),()=>setClipboard(item,false)),
        rowAction('✂',t('剪下','Cut'),()=>setClipboard(item,true)),
        rowAction('▣',t('貼上','Paste'),()=>pasteInto(item),!clipboard),
        rowAction('↓',t('儲存至磁碟','Save to disk'),()=>void saveWorkspaceItem(item),
          isDiskBacked(item.path)),
        rowAction('⊟',t('關閉','Close'),()=>closeEntry(item)),
        rowAction('⌫',t('刪除','Delete'),()=>deleteEntry(item))
      );
      row.append(tools);
      attachDrag(row,item);
      row.tabIndex=0;
      row.addEventListener('click',event => {
        if(consumedClick || event.target.closest('button'))return;
        selectedPath=item.path;
        if(item.folder){
          if(expanded.has(item.path))expanded.delete(item.path);
          else expanded.add(item.path);
          render();
        } else {
          render();void openFile(item);
        }
      });
      tree.append(row);
    }
    if(inlineEdit?.mode==='create'){
      const holder=document.createElement('div');holder.className='node create-node';
      const parent=inlineEdit.parent;
      holder.style.paddingLeft=(13+(parent?parent.split('/').length:0)*17)+'px';
      const icon=document.createElement('span');icon.className='file-icon';
      icon.textContent=inlineEdit.folder?'▣':'◇';
      const anchor=document.createElement('span');anchor.className='inline-anchor';
      holder.append(icon,anchor);
      const siblings=[...tree.querySelectorAll('.node')];
      const match=siblings.filter(row=>row.dataset.path===parent||
        row.dataset.path?.startsWith(parent+'/'));
      if(parent && match.length) match.at(-1).after(holder);
      else tree.prepend(holder);
      beginInline(anchor,inlineEdit.value);
    }
    $('empty').hidden = entries.size > 0 || knownFolders.size > 0 || !!query || !!inlineEdit;
    $('fileCount').textContent = String(entries.size);
    const roots = [...knownFolders].filter(value => value && !value.includes('/'));
    $('workspaceName').textContent = roots.length === 1 ? roots[0] : 'WORKSPACE';
  }
  async function openFile(item) {
    const alreadyOpen = openDocuments.get(item.path);
    if (alreadyOpen) {
      sendWorkspace('tabs.activate', {id:String(alreadyOpen.id)});
      return;
    }
    setStatus('OPENING ' + item.name);
    try {
      const reply = await hostRequest('Router.request', 'cluster.text-editor', 'document.open',
        {name:item.name, path:'/' + item.path, content:item.content,
          diskBacked:diskPaths.has(item.path)});
      if (!reply.ok) throw new Error(reply.error?.message || 'Router.request failed');
      setStatus('OPENED ' + item.name); toast('已開啟：' + item.name);
    } catch (error) {
      setStatus('ROUTER UNAVAILABLE');
      toast('無法開啟編輯器：' + String(error.message || error) + '。請確認 Host 路由及編輯器已裝載。');
    }
  }
  function createEntry(folder) {
    const parent=selectedPath && knownFolders.has(selectedPath) ? selectedPath :
      selectedPath ? parentOf(selectedPath) : '';
    if(parent)expanded.add(parent);
    inlineEdit={mode:'create',path:null,folder,parent,
      value:folder?t('新增資料夾','New folder'):t('未命名.txt','Untitled.txt')};
    render();
  }
  document.addEventListener('keydown',event=>{
    if(event.key==='F2'&&selectedPath){
      const item=visibleTree().find(x=>x.path===selectedPath);
      if(item){event.preventDefault();renameEntry(item);}
    }
  });
  $('refreshRoots').addEventListener('click',refreshTree);
  $('filesInput').addEventListener('change',e => { void importList([...e.target.files]); e.target.value=''; });
  $('folderInput').addEventListener('change',e => { void importList([...e.target.files]); e.target.value=''; });
  $('importFiles').addEventListener('click',()=> $('filesInput').click());
  $('importFolder').addEventListener('click',()=> void chooseAuthorizedFolder());
  $('newFile').addEventListener('click',()=> createEntry(false));
  $('newFolder').addEventListener('click',()=> createEntry(true));
  $('search').addEventListener('input',render);
  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' && selectedPath && entries.has(selectedPath) && !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) {
      void openFile(entries.get(selectedPath));
    }
  });
  function updateLanguage(){
    const labels={newFolder:[t('建立資料夾','New folder')],
      newFile:[t('建立文件','New file')],
      importFolder:[t('開啟資料夾','Open folder')],
      importFiles:[t('開啟文件','Open file')],
      refreshRoots:[t('重新整理並關閉已載入根目錄','Refresh and close loaded roots')]};
    for(const [id,[label]] of Object.entries(labels)){
      $(id).title=label;$(id).setAttribute('aria-label',label);
    }
    $('search').placeholder=t('搜尋文件','Search files');
    $('collapseNotice').title=t('收合檔案總管','Collapse explorer');
  }
  document.addEventListener('cluster-public-properties',event=>{
    if(event.detail?.language){locale=event.detail.language;updateLanguage();render();}
  });
  updateLanguage();
  // The Host PRMU palette and locale are authoritative; no local theme preferences.

  render();
})();
