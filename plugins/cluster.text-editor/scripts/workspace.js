/* Shell owns composition and mediates messages, never reads child DOM. */
(() => {
  'use strict';
  const explorer = document.getElementById('explorerFrame');
  const editor = document.getElementById('editorFrame');
  const sidebar = document.getElementById('sidebar');
  const divider = document.getElementById('divider');
  const toggle = document.getElementById('toggleExplorer');
  // One File controller for the global File button and Explorer shortcuts.
  const fileGroup=document.getElementById('globalFileGroup');
  const fileButton=document.getElementById('globalFileButton');
  const fileMenu=document.getElementById('globalFileMenu');
  const languageMenu=document.getElementById('workspaceLanguageMenu');
  const fileLocaleNames={
    'zh-TW':['建立新文件','建立新檔（資料夾）','開啟舊文件','開啟舊檔（資料夾）','儲存','另存新檔','關閉文件','介面調色盤','語言'],
    en:['New file','New folder','Open file','Open folder','Save','Save as','Close file','Interface palette','Language'],
    fr:['Nouveau fichier','Nouveau dossier','Ouvrir fichier','Ouvrir dossier','Enregistrer','Enregistrer sous','Fermer','Palette','Langue'],
    ja:['新しいファイル','新しいフォルダー','ファイルを開く','フォルダーを開く','保存','名前を付けて保存','閉じる','配色','言語'],
    es:['Nuevo archivo','Nueva carpeta','Abrir archivo','Abrir carpeta','Guardar','Guardar como','Cerrar','Paleta','Idioma'],
    hi:['नई फ़ाइल','नया फ़ोल्डर','फ़ाइल खोलें','फ़ोल्डर खोलें','सहेजें','इस रूप में सहेजें','बंद करें','रंग पैलेट','भाषा']
  };
  function applyMenuLocale(lang){
    const labels=fileLocaleNames[lang]||fileLocaleNames.en;
    ['new','new-folder','open','open-folder','save','save-as','close','palette','language']
      .forEach((action,i)=>{
        const button=fileMenu.querySelector('[data-file-action="'+action+'"]');
        if(button)button.textContent=labels[i]+(action==='language'?' ▸':'');
      });
    document.documentElement.lang=lang;
  }
  let localeRequestSerial=0;
  function setSharedLanguage(locale){
    if(!fileLocaleNames[locale])return;
    // The PRMU public repository owns language settings; no local preference.
    if(parent===window)return;
    parent.postMessage({protocol:'cluster.plugin.v1',type:'request',
      requestId:'workspace-language-'+(++localeRequestSerial),
      method:'PRMU.set',args:['properties','system.language',locale]},'*');
  }
  languageMenu.addEventListener('click', event=>{
    const lang=event.target.closest('[data-locale]')?.dataset.locale;
    if(!lang)return;
    setSharedLanguage(lang);
    languageMenu.hidden=true;
    showFileMenu(false);
  });

  function showFileMenu(open) {
    fileMenu.hidden=!open;
    if(!open)languageMenu.hidden=true;
    fileButton.setAttribute('aria-expanded',String(open));
  }
  function editorFile(action){
    editor.contentWindow?.postMessage({protocol:'cluster.workspace.file.v1',
      type:'command',action},'*');
  }
  function explorerFile(action){
    explorer.contentWindow?.postMessage({protocol:'cluster.workspace.sync.v1',
      type:'control',action},'*');
  }
  function fileAction(action){
    showFileMenu(false);
    if(action==='new')explorerFile('new-file');
    else if(action==='new-folder')explorerFile('new-folder');
    else if(action==='open')document.getElementById('workspaceOpenFiles').click();
    else if(action==='open-folder') {
      if(typeof window.showDirectoryPicker==='function') {
        // Picker must be invoked from the File menu user gesture.
        window.showDirectoryPicker({mode:'readwrite'}).then(handle=>{
          explorer.contentWindow?.postMessage({protocol:'cluster.workspace.sync.v1',
            type:'control',action:'import-handle',handle},'*');
        }).catch(error=>{
          if(error?.name!=='AbortError')console.warn('Directory authorization failed:',error);
        });
      } else document.getElementById('workspaceOpenFolder').click();
    }
    else if(action==='language'){languageMenu.hidden=!languageMenu.hidden;showFileMenu(true);}
    else if(action==='palette')editorFile('palette');
    else editorFile(action);
  }
  for(const [id] of [['workspaceOpenFiles'],['workspaceOpenFolder']]){
    document.getElementById(id).addEventListener('change',async event=>{
      const files=Array.from(event.target.files||[]);
      event.target.value='';
      // File.webkitRelativePath may not survive structured cloning.
      // Preserve the directory relative path explicitly before crossing frames.
      const transferred=[];
      for(const file of files){
        if(file.size>10*1024*1024)continue;
        transferred.push({name:file.name,webkitRelativePath:file.webkitRelativePath,
          size:file.size,data:await file.arrayBuffer()});
      }
      if(transferred.length)explorer.contentWindow?.postMessage({
        protocol:'cluster.workspace.sync.v1',type:'control',
        action:'import-file-list',files:transferred},'*');
    });
  }
  fileButton.addEventListener('click',()=>showFileMenu(fileMenu.hidden));
  fileMenu.addEventListener('click',event=>{
    if(event.target.closest('[data-locale]'))return;
    const cmd=event.target.closest('button[data-file-action]')?.dataset.fileAction;
    if(cmd)fileAction(cmd);
  });
  document.addEventListener('pointerdown',event=>{
    if(!fileGroup.contains(event.target))showFileMenu(false);
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape')showFileMenu(false);
    if(event.ctrlKey&&event.key.toLowerCase()==='n'){
      event.preventDefault();fileAction('new');
    }
  });
  const requests = new Map();
  const forwardRequests = new Map();
  let serial = 0;
  const syncProtocol = 'cluster.workspace.sync.v1';
  const documentPaths = new Map();
  const workspacePending = new Map();
  const sendEditorCommand = (action, params = {}) => {
    const requestId = 'workspace-cmd-' + (++serial);
    const timer=setTimeout(()=>workspacePending.delete(requestId),12000);
    workspacePending.set(requestId,{action,params,timer});
    editor.contentWindow?.postMessage({protocol:'cluster.editor.v1',
      type:'req',version:'1.0.0',requestId,action,params}, '*');
  };

  // Generic PRMU capability resolution. No provider plugin ID is required.
  const registryState = document.getElementById('registryState');
  const connectMessage = document.getElementById('connectMessage');
  const connectPanel = document.getElementById('connectPanel');
  let discoveryId = 0;
  let activeExplorerVersion = null;
  let discoveryTimer = null;
  function mountExplorer(payload) {
    if (!payload || typeof payload.html !== 'string' ||
        typeof payload.pluginId !== 'string' || payload.html.length > 2000000)
      throw new Error('Host 回傳的 UI Capability 無效');
    const key = payload.pluginId + ':' + payload.version;
    if (activeExplorerVersion === key && !explorer.hidden) return;
    activeExplorerVersion = key;
    explorer.removeAttribute('src');
    explorer.srcdoc = payload.html;
    explorer.hidden = false;
    connectPanel.hidden = true;
    registryState.textContent = 'EXPLORER · CONNECTED';
  }
  function discover() {
    discoveryId++;
    clearTimeout(discoveryTimer);
    registryState.textContent = '公共庫查詢中…';
    connectMessage.textContent = '查詢 workspace.explorer.v1 UI 能力…';
    if (parent === window) {
      registryState.textContent = 'HOST UNAVAILABLE';
      connectMessage.textContent = '請從 Cluster-v3 Plugin Manager 開啟 Editor。';
      return;
    }
    parent.postMessage({protocol:'cluster.plugin.v1', type:'request',
      requestId:'prmu-discover-' + discoveryId,
      method:'PRMU.resolveCapability',args:['workspace.explorer.v1']}, '*');
    discoveryTimer = setTimeout(() => {
      if (registryState.textContent === '公共庫查詢中…') {
        registryState.textContent = 'WAITING FOR CAPABILITY';
        connectMessage.textContent = '等待 Explorer 完成公共庫能力註冊…';
        discover();
      }
    }, 3500);
  }
  // Initial Editor tab may precede Explorer iframe mounting.
  // Replay the authoritative editor snapshot on every Explorer document load.
  let lastHostContext = null;
  function requestSnapshot() {
    if (!explorer.contentWindow || !editor.contentWindow || explorer.hidden) return;
    const requestId = 'workspace-snapshot-' + (++serial);
    editor.contentWindow.postMessage({protocol:'cluster.editor.v1',type:'req',
      version:'1.0.0',requestId,action:'workspace.snapshot',params:{}},'*');
  }
  explorer.addEventListener('load', () => {
    // Iframe load order is unspecified; retry when Editor boots afterwards.
    if (lastHostContext) explorer.contentWindow?.postMessage(lastHostContext,'*');
    requestSnapshot();
    setTimeout(requestSnapshot, 180);
    setTimeout(requestSnapshot, 650);
  });
  editor.addEventListener('load', () => {
    if (lastHostContext) editor.contentWindow?.postMessage(lastHostContext,'*');
    setTimeout(requestSnapshot, 150);
  });
  document.getElementById('retryDiscovery').addEventListener('click', discover);
  window.addEventListener('message', event => {
    if (event.source !== parent || event.data?.protocol !== 'cluster.plugin.v1') return;
    const message = event.data;
    if (message.type !== 'response' ||
        message.requestId !== 'prmu-discover-' + discoveryId) return;
    clearTimeout(discoveryTimer);
    if (!message.ok || !message.data?.html) {
      registryState.textContent = 'EXPLORER NOT REGISTERED';
      connectMessage.textContent = message.error?.message || '公共庫尚無 Explorer 能力，將自動重試。';
      discoveryTimer = setTimeout(discover, 2500);
      return;
    }
    try { mountExplorer(message.data); }
    catch (error) { registryState.textContent = 'MOUNT ERROR';
      connectMessage.textContent = error.message; }
  });
  discover();

  const internalProtocol = 'cluster.editor.v1';
  const hostProtocol = 'cluster.plugin.v1';
  const setSidebar = show => {
    sidebar.classList.toggle('collapsed', !show);
    divider.classList.toggle('collapsed', !show);
    toggle.setAttribute('aria-expanded', String(show));
  };
  toggle.addEventListener('click', () => setSidebar(sidebar.classList.contains('collapsed')));
  document.addEventListener('keydown', event => {
    if (event.ctrlKey && event.key.toLowerCase() === 'b') {
      event.preventDefault(); toggle.click();
    }
  });
  divider.addEventListener('pointerdown', event => {
    divider.setPointerCapture(event.pointerId);
    divider.classList.add('dragging');
  });
  divider.addEventListener('pointermove', event => {
    if (!divider.hasPointerCapture(event.pointerId)) return;
    const width = Math.max(180, Math.min(window.innerWidth * .52, event.clientX));
    sidebar.style.setProperty('--sidebar-width', width + 'px');
  });
  divider.addEventListener('pointerup', event => {
    if (divider.hasPointerCapture(event.pointerId)) divider.releasePointerCapture(event.pointerId);
    divider.classList.remove('dragging');
  });
  const sendResponse = (frame, requestId, ok, data, error) => {
    frame.postMessage({protocol:hostProtocol,type:'response',requestId,ok,data,
      error:error || null}, '*');
  };
  const normalize = value => value && typeof value === 'object' ? value : {};
  window.addEventListener('message', event => {
    const msg = normalize(event.data);
    // Host never receives raw workspace UI events: they stay between children.
    if (event.source === editor.contentWindow &&
        msg.protocol === 'cluster.editor.v1' && msg.type === 'event') {
      const doc = msg.data?.document;
      if (doc && msg.event === 'document.opened')
        documentPaths.set(String(doc.id), doc.path || doc.name);
      if (msg.event === 'document.closed') documentPaths.delete(String(msg.data?.id));
      explorer.contentWindow?.postMessage({protocol:syncProtocol,
        type:'event', event:msg.event, data:msg.data}, '*');
      return;
    }
    if (event.source === explorer.contentWindow &&
        msg.protocol === syncProtocol && msg.type === 'command') {
      if (msg.action === 'sidebar.toggle') { toggle.click(); return; }
      if (msg.action === 'file.new') { fileAction('new'); return; }
      if (['document.close','tabs.activate','document.rename'].includes(msg.action) &&
          /^[0-9]+$/.test(String(msg.params?.id)))
        sendEditorCommand(msg.action, {...msg.params,id:String(msg.params.id),
          prompt:false, discardChanges:msg.action==='document.close'});
      return;
    }

    if (event.source === parent && parent !== window) {
      if (msg.protocol === hostProtocol && msg.type === 'response') {
        const pending = forwardRequests.get(msg.requestId);
        if (!pending) return;
        clearTimeout(pending.timer); forwardRequests.delete(msg.requestId);
        pending.frame.postMessage({...msg,requestId:pending.originalId}, '*');
      } else if (msg.protocol === hostProtocol && msg.type === 'invoke') {
        // The registered BasicTextEditor APIs belong to the editor frame.
        editor.contentWindow?.postMessage(msg, '*');
      } else if (msg.type === 'context' || msg.protocol === 'cluster.settings.context.v1') {
        lastHostContext = msg;
        if(typeof msg.language==='string')applyMenuLocale(msg.language);
        explorer.contentWindow?.postMessage(msg, '*');
        editor.contentWindow?.postMessage(msg, '*');
      }
      return;
    }
    if(event.source===editor.contentWindow && msg.protocol===internalProtocol &&
       msg.type==='rep' && workspacePending.has(msg.requestId)){
      const pending=workspacePending.get(msg.requestId);
      clearTimeout(pending.timer);workspacePending.delete(msg.requestId);
      if(!msg.ok && pending.action==='document.close'){
        explorer.contentWindow?.postMessage({protocol:syncProtocol,type:'event',
          event:'document.closeRejected',data:{id:String(pending.params.id),
            error:msg.error||null}},'*');
      }
      return;
    }
    if (event.source === editor.contentWindow && msg.protocol === internalProtocol &&
        msg.type === 'rep' && String(msg.requestId).startsWith('workspace-snapshot-')) {
      if (msg.ok && Array.isArray(msg.data?.documents)) {
        for (const document of msg.data.documents) {
          explorer.contentWindow?.postMessage({protocol:syncProtocol,type:'event',
            event:'document.opened',data:{document,content:document.content || ''}},'*');
        }
        const active = msg.data.documents.find(item => String(item.id) === String(msg.data.activeId));
        if (active) explorer.contentWindow?.postMessage({protocol:syncProtocol,
          type:'event',event:'tab.activated',data:{document:active}},'*');
      }
      return;
    }
    if (event.source === editor.contentWindow && msg.protocol === internalProtocol && msg.type === 'rep') {
      const pending = requests.get(msg.requestId);
      if (!pending) return;
      clearTimeout(pending.timer); requests.delete(msg.requestId);
      sendResponse(pending.frame,pending.requestId,msg.ok,msg.data,msg.error);
      return;
    }
    const sourceIsExplorer = event.source === explorer.contentWindow;
    const sourceIsEditor = event.source === editor.contentWindow;
    if ((!sourceIsExplorer && !sourceIsEditor) || msg.protocol !== hostProtocol) return;
    if (msg.type === 'hello') {
      if (parent !== window) parent.postMessage(msg, '*');
      return;
    }
    if (msg.type === 'invoke-result') {
      if (parent !== window) parent.postMessage(msg, '*');
      return;
    }
    if (msg.type !== 'request' || typeof msg.requestId !== 'string') return;
    const frame = event.source;
    const args = Array.isArray(msg.args) ? msg.args : [];
    if (sourceIsExplorer && msg.method === 'Router.request' && args[0] === 'cluster.text-editor') {
      if (args[1] !== 'document.open') {
        sendResponse(frame,msg.requestId,false,null,{code:'UNKNOWN_ACTION',message:'Unsupported internal route'});
        return;
      }
      const requestId = 'local-' + (++serial);
      const timer = setTimeout(() => {
        requests.delete(requestId);
        sendResponse(frame,msg.requestId,false,null,{code:'EDITOR_TIMEOUT',message:'Editor did not respond'});
      }, 12000);
      requests.set(requestId,{frame,requestId:msg.requestId,timer});
      editor.contentWindow?.postMessage({protocol:internalProtocol,type:'req',version:'1.0.0',requestId,
        action:args[1],params:args[2] || {}},'*');
      return;
    }
    if (parent === window) {
      sendResponse(frame,msg.requestId,false,null,{code:'HOST_UNAVAILABLE',message:'No parent Cluster Host'});
      return;
    }
    const forwardId = 'shell-' + (++serial);
    const timer = setTimeout(() => {
      forwardRequests.delete(forwardId);
      sendResponse(frame,msg.requestId,false,null,{code:'HOST_TIMEOUT',message:'Host did not respond'});
    }, 12000);
    forwardRequests.set(forwardId,{frame,originalId:msg.requestId,timer});
    parent.postMessage({...msg,requestId:forwardId}, '*');
  });
})();

/* Public Repository shared palette / language context fanout. */
window.addEventListener('message',event=>{
  if(event.source!==parent || event.data?.protocol!=='cluster.public.v1')return;
  if(event.data.type!=='snapshot' && event.data.type!=='properties.changed')return;
  if(typeof event.data.language==='string')document.documentElement.lang=event.data.language;
  for(const id of ['explorerFrame','editorFrame']){
    document.getElementById(id)?.contentWindow?.postMessage(event.data,'*');
  }
});
