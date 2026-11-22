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
  const languageDialog=document.getElementById('workspaceLanguageDialog');
  const storageDialog=document.getElementById('workspaceStorageDialog');
  const OPTIONS_KEY='cluster.workspace.options.v1';
  let workspacePriority='internal',currentLocale='zh-TW';
  let restoredOptions=null;
  try {
    restoredOptions=JSON.parse(localStorage.getItem(OPTIONS_KEY)||'null');
    if(restoredOptions?.priority==='external')workspacePriority='external';
  }catch{}
  const priorityLabels={
    'zh-TW':['存儲優先策略','內部優先','外部優先',
      '外部檔案變更時保留編輯器內容','外部檔案變更時同步磁碟內容',
      '選擇語言後將透過公共庫同步所有插件'],
    en:['Storage priority','Internal priority','External priority',
      'Keep editor content when disk files change',
      'Replace editor content with changed disk files',
      'Language changes are shared via the public repository'],
    fr:['Priorité de stockage','Priorité interne','Priorité externe',
      'Conserver le contenu local','Synchroniser le contenu du disque',
      'La langue est synchronisée via le dépôt public'],
    ja:['保存の優先順位','内部優先','外部優先',
      '外部変更後も編集内容を保持','ディスク変更で編集内容を置換',
      '言語は公開リポジトリから同期されます'],
    es:['Prioridad de almacenamiento','Prioridad interna','Prioridad externa',
      'Conservar el contenido local','Sincronizar el contenido del disco',
      'El idioma se sincroniza mediante el repositorio público'],
    hi:['भंडारण प्राथमिकता','आंतरिक प्राथमिकता','बाहरी प्राथमिकता',
      'डिस्क परिवर्तन पर संपादक सामग्री रखें','डिस्क से संपादक सामग्री बदलें',
      'भाषा सार्वजनिक रिपॉज़िटरी के माध्यम से साझा होती है']
  };
  const statusLabels={
    'zh-TW':['同步','待存儲','錯誤','載入'],
    en:['Synced','Pending','Error','Loading'],
    fr:['Synchronisé','En attente','Erreur','Chargement'],
    ja:['同期済','未保存','エラー','読込中'],
    es:['Sincronizado','Pendiente','Error','Cargando'],
    hi:['सिंक','लंबित','त्रुटि','लोड']
  };
  let currentStatus='loading',currentPercent=5;
  function setProgress(status,percent){
    if(!['synced','pending','error','loading'].includes(status))return;
    currentStatus=status;
    currentPercent=Math.max(0,Math.min(100,Number(percent)||0));
    const bar=document.getElementById('workbenchProgress');
    bar.dataset.state=status;
    bar.setAttribute('aria-valuenow',String(currentPercent));
    bar.querySelector('span').style.width=currentPercent+'%';
    const label=statusLabels[currentLocale]||statusLabels.en;
    const index={synced:0,pending:1,error:2,loading:3}[status];
    document.getElementById('workbenchProgressLabel').textContent=label[index];
    bar.setAttribute('aria-label',label[index]);
  }
  function saveWorkspaceOptions(){
    try{localStorage.setItem(OPTIONS_KEY,JSON.stringify({
      priority:workspacePriority,collapsed:sidebar.classList.contains('collapsed'),
      sidebarWidth:sidebar.style.getPropertyValue('--sidebar-width')
    }));}catch{}
  }
  const fileLocaleNames={
    'zh-TW':['建立新文件','建立新檔（資料夾）','開啟舊文件','開啟舊檔（資料夾）','儲存','另存新檔','關閉文件','介面調色盤','插件','語言'],
    en:['New file','New folder','Open file','Open folder','Save','Save as','Close file','Interface palette','Plugins','Language'],
    fr:['Nouveau fichier','Nouveau dossier','Ouvrir fichier','Ouvrir dossier','Enregistrer','Enregistrer sous','Fermer','Palette','Plugins','Langue'],
    ja:['新しいファイル','新しいフォルダー','ファイルを開く','フォルダーを開く','保存','名前を付けて保存','閉じる','配色','プラグイン','言語'],
    es:['Nuevo archivo','Nueva carpeta','Abrir archivo','Abrir carpeta','Guardar','Guardar como','Cerrar','Paleta','Complementos','Idioma'],
    hi:['नई फ़ाइल','नया फ़ोल्डर','फ़ाइल खोलें','फ़ोल्डर खोलें','सहेजें','इस रूप में सहेजें','बंद करें','रंग पैलेट','प्लगइन','भाषा']
  };
  function applyMenuLocale(lang){
    updateDeleteLocale(lang);
    const labels=fileLocaleNames[lang] ||
      (String(lang).startsWith('zh')?fileLocaleNames['zh-TW']:fileLocaleNames.en);
    currentLocale=fileLocaleNames[lang]?lang:'en';
    ['new','new-folder','open','open-folder','save','save-as','close','palette','plugin','language']
      .forEach((action,i)=>{
        const button=fileMenu.querySelector('[data-file-action="'+action+'"]');
        if(button)button.textContent=labels[i];
      });
    document.documentElement.lang=lang;
    const more=priorityLabels[currentLocale]||priorityLabels.en;
    fileMenu.querySelector('[data-file-action="storage-priority"]').textContent=more[0];
    document.getElementById('workspaceStorageTitle').textContent=more[0];
    document.getElementById('priorityInternalTitle').textContent=more[1];
    document.getElementById('priorityExternalTitle').textContent=more[2];
    document.getElementById('priorityInternalHint').textContent=more[3];
    document.getElementById('priorityExternalHint').textContent=more[4];
    document.getElementById('workspaceLanguageHint').textContent=more[5];
    document.getElementById('workspaceLanguageTitle').textContent=labels[9];
    languageMenu.querySelectorAll('[data-locale]').forEach(button=>
      button.setAttribute('aria-pressed',String(button.dataset.locale===currentLocale)));
    setProgress(currentStatus,currentPercent);
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
    languageDialog.close();
    showFileMenu(false);
  });

  function showFileMenu(open) {
    fileMenu.hidden=!open;
    fileButton.setAttribute('aria-expanded',String(open));
  }
  let pluginManagerUrl=null;
  function navigatePluginManager(url){
    try {
      const destination=new URL(url);
      if(destination.protocol!=='https:' && destination.hostname!=='localhost')
        throw Error('Unsafe Plugin Manager destination');
      // Navigate the top-level application, not an iframe or popup.
      window.top.location.assign(destination.href);
    } catch(error){
      console.error('Plugin Manager navigation failed:',error);
    }
  }
  function openPluginManager(){
    if(pluginManagerUrl){navigatePluginManager(pluginManagerUrl);return;}
    // All domains and paths are published by the PRMU authority.
    if(parent!==window){
      parent.postMessage({protocol:'cluster.plugin.v1',type:'request',
        requestId:'workspace-plugin-manager-url',
        method:'PRMU.getPluginManagerUrl',args:[]},'*');
    }
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
    if(action==='language'){languageDialog.showModal();return;}
    if(action==='storage-priority'){storageDialog.showModal();return;}
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
    else if(action==='plugin')openPluginManager();
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
  // A click inside a child iframe does not bubble to the shell document.
  window.addEventListener('blur',()=>showFileMenu(false));
  fileMenu.addEventListener('click',event=>{
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
  for(const button of document.querySelectorAll('[data-close-workspace-dialog]'))
    button.addEventListener('click',()=>document.getElementById(
      button.dataset.closeWorkspaceDialog).close());
  for(const radio of document.querySelectorAll('input[name="workspacePriority"]')){
    radio.checked=radio.value===workspacePriority;
    radio.addEventListener('change',()=>{
      if(!radio.checked)return;
      workspacePriority=radio.value;
      explorer.contentWindow?.postMessage({protocol:'cluster.workspace.sync.v1',
        type:'control',action:'storage-policy',value:workspacePriority},'*');
      saveWorkspaceOptions();
      storageDialog.close();
    });
  }
  const deleteDialog=document.getElementById('workspaceDeleteDialog');
  let deleteRequest=null;
  const deleteTranslations={
    'zh-TW':['確認刪除','取消','刪除'],en:['Confirm deletion','Cancel','Delete'],
    fr:['Confirmer la suppression','Annuler','Supprimer'],
    ja:['削除の確認','キャンセル','削除'],es:['Confirmar eliminación','Cancelar','Eliminar'],
    hi:['हटाने की पुष्टि','रद्द करें','हटाएँ']};
  function updateDeleteLocale(lang){
    const [heading,cancel,confirm]=deleteTranslations[lang]||deleteTranslations.en;
    document.getElementById('workspaceDeleteTitle').textContent=heading;
    document.getElementById('workspaceDeleteCancel').textContent=cancel;
    document.getElementById('workspaceDeleteConfirm').textContent=confirm;
  }
  function closeDeleteDialog(approved){
    const info=deleteRequest; deleteRequest=null;
    if(deleteDialog.open)deleteDialog.close();
    if(info&&approved)explorer.contentWindow?.postMessage({
      protocol:'cluster.workspace.sync.v1',type:'delete.decision',
      path:info.path,approved:true},'*');
  }
  document.getElementById('workspaceDeleteCancel').addEventListener('click',
    ()=>closeDeleteDialog(false));
  document.getElementById('workspaceDeleteConfirm').addEventListener('click',
    ()=>closeDeleteDialog(true));
  deleteDialog.addEventListener('cancel',()=>{deleteRequest=null;});
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
    explorer.contentWindow?.postMessage({protocol:'cluster.workspace.sync.v1',
      type:'control',action:'storage-policy',value:workspacePriority},'*');
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
    saveWorkspaceOptions();
  };
  toggle.addEventListener('click', () => setSidebar(sidebar.classList.contains('collapsed')));
  if(typeof restoredOptions?.sidebarWidth==='string' &&
     /^[0-9]+(?:\.[0-9]+)?px$/.test(restoredOptions.sidebarWidth))
    sidebar.style.setProperty('--sidebar-width',restoredOptions.sidebarWidth);
  if(restoredOptions?.collapsed===true)setSidebar(false);
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
    saveWorkspaceOptions();
  });
  const sendResponse = (frame, requestId, ok, data, error) => {
    frame.postMessage({protocol:hostProtocol,type:'response',requestId,ok,data,
      error:error || null}, '*');
  };
  const normalize = value => value && typeof value === 'object' ? value : {};
  window.addEventListener('message', event => {
    const msg = normalize(event.data);
    if(event.source===explorer.contentWindow &&
       msg.protocol==='cluster.workspace.sync.v1' && msg.type==='command'){
      if(msg.action==='disk.reconnected'){
        editor.contentWindow?.postMessage({protocol:'cluster.workspace.external.v1',
          type:'reconnected',path:msg.params?.path},'*');
        return;
      }
      if(msg.action==='external.changed'){
        setProgress('loading',30);
        editor.contentWindow?.postMessage({protocol:'cluster.workspace.external.v1',
          type:'changed',...msg.params,strategy:workspacePriority},'*');
        return;
      }
      if(msg.action==='workspace.error'){setProgress('error',100);return;}
    }
    if(event.source===editor.contentWindow &&
       msg.protocol==='cluster.workspace.status.v1' && msg.type==='cursor'){
      const line=Number(msg.line),col=Number(msg.col);
      if(Number.isSafeInteger(line)&&line>0&&Number.isSafeInteger(col)&&col>0)
        document.getElementById('workbenchCursor').textContent=
          'Ln '+line+', Col '+col;
      return;
    }
    // Host never receives raw workspace UI events: they stay between children.
    if (event.source === editor.contentWindow &&
        msg.protocol === 'cluster.editor.v1' && msg.type === 'event') {
      const doc = msg.data?.document;
      if (doc && msg.event === 'document.opened')
        documentPaths.set(String(doc.id), doc.path || doc.name);
      if (msg.event === 'document.closed') documentPaths.delete(String(msg.data?.id));
      explorer.contentWindow?.postMessage({protocol:syncProtocol,
        type:'event', event:msg.event, data:msg.data}, '*');
      if(msg.event==='document.changed' || msg.event==='document.conflict')
        setProgress('pending',100);
      else if(msg.event==='document.saved' || msg.event==='document.externalSynced')
        setProgress('synced',100);
      else if(msg.event==='workspace.error' ||
        msg.event==='editor.registration.error')setProgress('error',100);
      else if(msg.event==='document.opened') {
        setProgress('loading',40);
        setTimeout(()=>{
          if(currentStatus==='loading')
            setProgress(doc?.dirty || !doc?.diskBacked?'pending':'synced',100);
        },180);
      } else if(msg.event==='tab.activated')
        setProgress(doc?.dirty || !doc?.diskBacked?'pending':'synced',100);
      return;
    }
    if(event.source===editor.contentWindow &&
       msg.protocol==='cluster.workspace.file.v1' && msg.type==='save-request'){
      explorer.contentWindow?.postMessage(msg,'*');return;
    }
    if(event.source===explorer.contentWindow &&
       msg.protocol==='cluster.workspace.file.v1' && msg.type==='save-result'){
      editor.contentWindow?.postMessage(msg,'*');return;
    }
    if (event.source === explorer.contentWindow &&
        msg.protocol === syncProtocol && msg.type === 'command') {
      if(msg.action==='delete.confirm'){
        const info=msg.params||{};
        if(deleteDialog.open)deleteDialog.close();
        deleteRequest=info;
        document.getElementById('workspaceDeleteName').textContent=String(info.name||'');
        document.getElementById('workspaceDeleteDetail').textContent=String(info.detail||'');
        document.getElementById('workspaceDeleteConfirm').disabled=info.allowed===false;
        deleteDialog.showModal();return;
      }
      if (msg.action === 'sidebar.toggle') { toggle.click(); return; }
      if (msg.action === 'file.new') { fileAction('new'); return; }
      if (['document.close','tabs.activate','document.rename'].includes(msg.action) &&
          /^[0-9]+$/.test(String(msg.params?.id)))
        sendEditorCommand(msg.action, {...msg.params,id:String(msg.params.id),
          prompt:false, discardChanges:msg.action==='document.close'});
      return;
    }

    if (event.source === parent && parent !== window) {
      if(msg.protocol===hostProtocol && msg.type==='response' &&
         msg.requestId==='workspace-plugin-manager-url') {
        if(msg.ok && typeof msg.data==='string')pluginManagerUrl=msg.data;
        else if(msg.ok && typeof msg.data?.pluginManagerUrl==='string')
          pluginManagerUrl=msg.data.pluginManagerUrl;
        if(pluginManagerUrl)navigatePluginManager(pluginManagerUrl);
        return;
      }
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
        if(typeof msg.pluginManagerUrl==='string')pluginManagerUrl=msg.pluginManagerUrl;
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
  if(typeof event.data.language==='string')applyMenuLocale(event.data.language);
  for(const id of ['explorerFrame','editorFrame']){
    document.getElementById(id)?.contentWindow?.postMessage(event.data,'*');
  }
});
