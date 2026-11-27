/* Cluster Text Editor v1 — autonomous plugin, no Host/internal API imports. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const editor = $('editor');
  const tabs = new Map();
  const languages = {
    'zh-TW': {
      new:'新增檔案',open:'開啟檔案…',save:'儲存',saveAs:'另存新檔…',
      copyAll:'複製全部文字',close:'關閉目前分頁',closeAll:'關閉全部',ready:'就緒',
      empty:'從右上角 File 開啟文字檔案，或建立新檔案。',
      find:'尋找',fileName:'檔案名稱',download:'匯出檔案',cancel:'取消',
      unsaved:'內容尚未儲存，確定要放棄變更並關閉？',newFile:'未命名',
      opened:'已開啟',saved:'已儲存',exported:'已嘗試匯出',
      sandbox:'Cluster 沙箱可能攔截下載。若未出現檔案，請使用「複製全部文字」或獨立頁面。',
      unsupported:'此環境不支援直接覆寫檔案；將使用下載方式匯出。',
      copied:'已複製全部文字',copyFailed:'無法複製，請手動全選文字。',
      cancelled:'操作已取消',failed:'操作失敗',tooLarge:'檔案超過 10 MiB 限制',
      invalid:'不支援的文字編碼；請使用 UTF-8 或 UTF-16 LE。',
      found:'找到',notFound:'沒有符合結果',savedWithName:'已儲存檔案',palette:'介面著色盤',language:'語言',plugins:'插件',done:'完成',resetPalette:'恢復預設',localPalette:'設定目前編輯器配色；Host 共用調色盤更新時將同步覆蓋對應顏色。',localLanguage:'選擇編輯器顯示語言；Host 共用語言更新時將自動同步。',navigationBlocked:'無法直接切換 Host 頁面，請在 Cluster 網址開啟 /plugin。'
    },
    en: {
      new:'New File',open:'Open File…',save:'Save',saveAs:'Save As…',
      copyAll:'Copy All Text',close:'Close Tab',closeAll:'Close All',ready:'Ready',
      empty:'Open a text file from File, or create a new one.',
      find:'Find',fileName:'File name',download:'Export file',cancel:'Cancel',
      unsaved:'Discard unsaved changes and close?',newFile:'Untitled',
      opened:'Opened',saved:'Saved',exported:'Export requested',
      sandbox:'Cluster sandbox may block downloads. If nothing appears, use Copy All Text or the standalone page.',
      unsupported:'Direct file overwriting unavailable; exporting a download instead.',
      copied:'Text copied',copyFailed:'Copy not available; select and copy manually.',
      cancelled:'Cancelled',failed:'Operation failed',tooLarge:'File exceeds the 10 MiB limit',
      invalid:'Unsupported text encoding. Use UTF-8 or UTF-16 LE.',
      found:'Match',notFound:'No matches',savedWithName:'Saved file',palette:'Interface Palette',language:'Language',plugins:'Plugins',done:'Done',resetPalette:'Reset colors',localPalette:'Customize editor colors. Shared Host palette updates take precedence.',localLanguage:'Choose editor language. Shared Host language updates take precedence.',navigationBlocked:'Host navigation is blocked. Open /plugin from the Cluster address.'
    }
  };
  const paletteTranslations = {
    'zh-TW':{baseRGB:'介面全局 RGB',pickDescription:'選擇單一顏色即可調整整個介面，文字對比自動適應。',textColorMode:'字體對比自動調整',darkBaseline:'黑色基準',lightBaseline:'白色基準',autoSave:'設定自動儲存'},
    en:{baseRGB:'Global interface RGB',pickDescription:'One color updates the entire UI; text contrast adapts automatically.',textColorMode:'Automatic text contrast',darkBaseline:'Dark baseline',lightBaseline:'Light baseline',autoSave:'Settings auto-saved'},
    fr:{baseRGB:'RGB global',pickDescription:'Une couleur pour toute l’interface ; contraste automatique.',textColorMode:'Contraste automatique',darkBaseline:'Base sombre',lightBaseline:'Base claire',autoSave:'Enregistrement automatique'},
    ja:{baseRGB:'全体 RGB',pickDescription:'1色で全体を変更し、文字のコントラストを自動調整します。',textColorMode:'文字コントラスト自動調整',darkBaseline:'ダーク基準',lightBaseline:'ライト基準',autoSave:'設定は自動保存'},
    es:{baseRGB:'RGB global',pickDescription:'Un color ajusta toda la interfaz y el contraste.',textColorMode:'Contraste automático',darkBaseline:'Base oscura',lightBaseline:'Base clara',autoSave:'Guardado automático'},
    hi:{baseRGB:'ग्लोबल RGB',pickDescription:'एक रंग से पूरा इंटरफ़ेस बदलेगा।',textColorMode:'स्वचालित टेक्स्ट कंट्रास्ट',darkBaseline:'डार्क आधार',lightBaseline:'लाइट आधार',autoSave:'सेटिंग स्वतः सहेजी गई'}
  };
  const otherLocales = {
    fr:{new:'Nouveau',open:'Ouvrir…',save:'Enregistrer',saveAs:'Enregistrer sous…',copyAll:'Tout copier',close:'Fermer',closeAll:'Tout fermer',unsaved:'Des modifications ne sont pas enregistrées. Les abandonner ?',find:'Chercher',fileName:'Nom du fichier',download:'Exporter',cancel:'Annuler',ready:'Prêt',palette:'Palette',language:'Langue',plugins:'Plugins',done:'Terminé',resetPalette:'Réinitialiser'},
    ja:{new:'新規',open:'開く…',save:'保存',saveAs:'名前を付けて保存…',copyAll:'すべてコピー',close:'タブを閉じる',closeAll:'すべて閉じる',unsaved:'未保存の変更を破棄しますか？',find:'検索',fileName:'ファイル名',download:'エクスポート',cancel:'キャンセル',ready:'準備完了',palette:'配色',language:'言語',plugins:'プラグイン',done:'完了',resetPalette:'初期化'},
    es:{new:'Nuevo',open:'Abrir…',save:'Guardar',saveAs:'Guardar como…',copyAll:'Copiar todo',close:'Cerrar',closeAll:'Cerrar todo',unsaved:'Hay cambios sin guardar. ¿Descartarlos?',find:'Buscar',fileName:'Nombre del archivo',download:'Exportar',cancel:'Cancelar',ready:'Listo',palette:'Paleta',language:'Idioma',plugins:'Complementos',done:'Listo',resetPalette:'Restablecer'},
    hi:{new:'नया',open:'खोलें…',save:'सहेजें',saveAs:'इस रूप में सहेजें…',copyAll:'सब कॉपी करें',close:'बंद करें',closeAll:'सभी बंद करें',unsaved:'बिना सहेजे बदलाव छोड़ दें?',find:'खोजें',fileName:'फ़ाइल नाम',download:'निर्यात',cancel:'रद्द करें',ready:'तैयार',palette:'रंग',language:'भाषा',plugins:'प्लगइन',done:'पूर्ण',resetPalette:'रीसेट'}
  };
  let locale = 'zh-TW';
  let nextId = 1;
  let untitled = 1;
  let activeId = null;
  let toastTimer;
  let showingFind = false;
  let internalUpdate = false;
  const maxFileBytes = 10 * 1024 * 1024;
  // Public Repository location is supplied by the Host context, never imported.
  let pluginManagerUrl = null;
  const EDITOR_PROTOCOL = 'cluster.editor.v1';
  const EDITOR_API_VERSION = '1.0.0';
  const MAX_REQUEST_ID = 128;
  const MAX_DOCUMENT_PATH = 1024;
  let nextRevision = 1;
  const VALID_PLUGIN_SITE = url => {
    try {
      const candidate = new URL(url);
      if (candidate.protocol !== 'https:' && candidate.hostname !== 'localhost') return null;
      if (candidate.username || candidate.password) return null;
      return candidate.href;
    } catch { return null; }
  };
  function getPluginManagerUrl() {
    // Only PRMU context is authorized to provide this destination.
    return pluginManagerUrl;
  }
  function emitEditorEvent(name, data = {}) {
    if (window.parent === window) return;
    window.parent.postMessage({protocol:EDITOR_PROTOCOL, type:'event',
      version:EDITOR_API_VERSION, sourcePlugin:'cluster.text-editor',
      event:name, data}, '*');
  }
  function tabMetadata(tab) {
    return {id:String(tab.id), name:tab.name, path:tab.path || null,
      diskBacked:tab.diskBacked === true,
      dirty:tab.dirty, revision:tab.revision, active:tab.id === activeId,
      length:tab.text.length};
  }


  function t(key) {
    return paletteTranslations[locale]?.[key] || otherLocales[locale]?.[key] || languages[locale]?.[key] ||
      languages.en[key] || languages['zh-TW'][key] || key;
  }

  function setStatus(text) {
    $('statusMessage').textContent = text;
    $('fileState').textContent = text;
  }
  function toast(text, timeout = 4100) {
    clearTimeout(toastTimer);
    $('toast').textContent = text;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, timeout);
  }
  function applyLocale(value) {
    if (!value || !['zh-TW','en','fr','ja','es','hi'].includes(value)) return;
    locale = value;
    document.documentElement.lang = locale;
    $('languageSelect').value = locale;
    for (const element of document.querySelectorAll('[data-i18n]'))
      element.textContent = t(element.dataset.i18n);
    const target = current();
    if (!target) setStatus(t('ready'));
    renderTabs();
  }
  function receiveContext(message) {
    if (typeof message?.language === 'string') applyLocale(message.language);
    // Published read-only by PRMU.getPluginManagerUrl().
    if (typeof message?.pluginManagerUrl === 'string')
      pluginManagerUrl = VALID_PLUGIN_SITE(message.pluginManagerUrl);
    for (const [key, color] of Object.entries(message?.palette || {})) {
      if (/^[a-zA-Z][a-zA-Z-]*$/.test(key) && /^#[0-9a-fA-F]{6}$/.test(color))
        document.documentElement.style.setProperty('--ui-' + key, color);
    }
    if (message?.palette?.background && hexValid.test(message.palette.background)) {
      baseColor = message.palette.background.toLowerCase();
      fontBaseline = message.palette.text?.toLowerCase() === '#000000' ? 'light' : 'dark';
    }
    syncPaletteFields();
  }
  window.addEventListener('message', event => {
    if (event.source !== parent) return;
    if (event.data?.protocol === 'cluster.workspace.external.v1') {
      const changed=event.data;
      if(changed.type==='reconnected') {
        const authorized=[...tabs.values()].find(tab=>tab.path===changed.path);
        if(authorized) {
          authorized.diskBacked=true;
          scheduleSessionSave();
        }
        return;
      }
      if (changed.type!=='changed')return;
      const tab=[...tabs.values()].find(x=>x.path===changed.path);
      if(!tab || typeof changed.content!=='string')return;
      if(changed.strategy!=='external') {
        emitEditorEvent('document.conflict',{document:tabMetadata(tab),
          message:'External file changed; internal state retained'});
        return;
      }
      const active=tab.id===activeId;
      if(active)captureTab();
      tab.text=changed.content;tab.lastSaved=changed.content;
      tab.dirty=false;tab.revision=nextRevision++;
      if(active) {
        editor.value=tab.text;
        editor.setSelectionRange(Math.min(tab.selectionStart,tab.text.length),
          Math.min(tab.selectionEnd,tab.text.length));
        renderLines();renderCursor();
        requestAnimationFrame(()=>{editor.scrollTop=tab.scrollTop;
          editor.scrollLeft=tab.scrollLeft||0;renderLines();});
      }
      renderTabs();scheduleSessionSave();
      emitEditorEvent('document.externalSynced',{document:tabMetadata(tab),
        content:tab.text});
      return;
    }
    if (event.data?.protocol === EDITOR_PROTOCOL) {
      if (event.data.type === 'req') void handleEditorRequest(event);
      return;
    }
    if (!event.data || !['cluster.plugin.v1','cluster.settings.context.v1']
      .includes(event.data.protocol)) return;
    if (event.data.protocol === 'cluster.plugin.v1' && event.data.type !== 'context') return;
    receiveContext(event.data);
  });

  const SESSION_KEY = 'cluster.editor.workspace.v2';
  const SNAPSHOT_DB = 'cluster-v3-plugin-workspace';
  let snapshotTimer = null, snapshotFailure = false;
  let bootReady = Promise.resolve();
  function snapshotDB(mode, operation) {
    return new Promise((resolve,reject)=>{
      if (typeof indexedDB === 'undefined') {
        reject(Error('IndexedDB unavailable'));return;
      }
      const open=indexedDB.open(SNAPSHOT_DB,1);
      open.onupgradeneeded=()=>{
        if (!open.result.objectStoreNames.contains('snapshots'))
          open.result.createObjectStore('snapshots');
      };
      open.onerror=()=>reject(open.error||Error('IndexedDB open failed'));
      open.onsuccess=()=>{
        const db=open.result;
        let request;
        try{
          const tx=db.transaction('snapshots',mode);
          request=operation(tx.objectStore('snapshots'));
          tx.oncomplete=()=>{db.close();resolve(request?.result);};
          tx.onerror=()=>{db.close();reject(tx.error||Error('Snapshot transaction failed'));};
          tx.onabort=()=>{db.close();reject(tx.error||Error('Snapshot transaction aborted'));};
        }catch(error){db.close();reject(error);}
      };
    });
  }
  function saveSessionNow() {
    clearTimeout(snapshotTimer);
    const active=current();
    if (active) {
      active.text=editor.value;
      active.selectionStart=editor.selectionStart;
      active.selectionEnd=editor.selectionEnd;
      active.scrollTop=editor.scrollTop;
      active.scrollLeft=editor.scrollLeft;
      active.dirty=active.text!==active.lastSaved;
    }
    const snapshot={
      schema:2,activeId,nextId,untitled,
      documents:[...tabs.values()].map(tab=>({
        id:tab.id,name:tab.name,text:tab.text,lastSaved:tab.lastSaved,
        path:tab.path,revision:tab.revision,
        selectionStart:tab.selectionStart,selectionEnd:tab.selectionEnd,
        scrollTop:tab.scrollTop,scrollLeft:tab.scrollLeft||0
      }))
    };
    let localSaved=false;
    try{
      localStorage.setItem(SESSION_KEY,JSON.stringify(snapshot));
      localSaved=true;
    }catch{}
    void snapshotDB('readwrite',store=>store.put(snapshot,SESSION_KEY))
      .then(()=>{snapshotFailure=false;})
      .catch(error=>{
        if(!localSaved && !snapshotFailure){
          snapshotFailure=true;
          emitEditorEvent('workspace.error',{message:'Editor snapshot failed: '+
            String(error?.message||error)});
        }
      });
  }
  function scheduleSessionSave() {
    clearTimeout(snapshotTimer);
    snapshotTimer=setTimeout(saveSessionNow,160);
  }
  function restoreSession(override) {
    let saved=override;
    if(!saved){
      try{saved=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');}
      catch{return false;}
    }
    if(saved?.schema!==2 || !Array.isArray(saved.documents) ||
       saved.documents.length>100 || !saved.documents.length)return false;
    let total=0;
    for(const item of saved.documents) {
      if(!Number.isSafeInteger(item.id) || item.id<1 ||
        typeof item.name!=='string' || typeof item.text!=='string' ||
        typeof item.lastSaved!=='string' || item.text.length>10*1024*1024)return false;
      total+=item.text.length;
      if(total>30*1024*1024)return false;
      tabs.set(item.id,{
        id:item.id,name:item.name,text:item.text,lastSaved:item.lastSaved,
        handle:null,path:typeof item.path==='string'?item.path:null,
        // FileSystemHandle cannot be restored from a JSON snapshot.
        diskBacked:false,revision:Number(item.revision)||nextRevision++,
        dirty:item.text!==item.lastSaved,
        selectionStart:Math.max(0,Number(item.selectionStart)||0),
        selectionEnd:Math.max(0,Number(item.selectionEnd)||0),
        scrollTop:Math.max(0,Number(item.scrollTop)||0),
        scrollLeft:Math.max(0,Number(item.scrollLeft)||0)
      });
    }
    nextId=Math.max(...tabs.keys())+1;
    nextRevision=Math.max(nextRevision,...[...tabs.values()].map(x=>x.revision))+1;
    untitled=Math.max(1,Number(saved.untitled)||1);
    const active=Number(saved.activeId);
    selectTab(tabs.has(active)?active:tabs.keys().next().value);
    for(const item of tabs.values())
      emitEditorEvent('document.opened',{document:tabMetadata(item),content:item.text});
    return true;
  }
  function current() { return tabs.get(activeId) || null; }
  function makeTab(name, text = '', handle = null, path = null, diskBacked = false) {
    const id = nextId++;
    const data = { id, name, text, lastSaved: text, handle, path, diskBacked,
      revision:nextRevision++, dirty:false,
      selectionStart:0, selectionEnd:0, scrollTop:0,scrollLeft:0 };
    tabs.set(id, data);
    selectTab(id);
    emitEditorEvent('document.opened', {document:tabMetadata(data), content:text});
    scheduleSessionSave();
    return data;
  }
  function newFile() { makeTab(`${t('newFile')}-${untitled++}.txt`); editor.focus(); }
  function captureTab() {
    const tab = current();
    if (!tab) return;
    tab.text = editor.value;
    tab.selectionStart = editor.selectionStart;
    tab.selectionEnd = editor.selectionEnd;
    tab.scrollTop = editor.scrollTop;
    tab.scrollLeft = editor.scrollLeft;
    tab.dirty = tab.text !== tab.lastSaved;
  }
  function selectTab(id) {
    if (!tabs.has(id)) return;
    if (activeId !== id) captureTab();
    activeId = id;
    const tab = current();
    internalUpdate = true;
    editor.value = tab.text;
    editor.readOnly = false;
    editor.selectionStart = Math.min(tab.selectionStart, tab.text.length);
    editor.selectionEnd = Math.min(tab.selectionEnd, tab.text.length);
    editor.scrollTop = tab.scrollTop;
    editor.scrollLeft = tab.scrollLeft || 0;
    internalUpdate = false;
    $('emptyHint').hidden = true;
    requestAnimationFrame(()=>{
      if(activeId !== id)return;
      editor.scrollTop=tab.scrollTop;
      editor.scrollLeft=tab.scrollLeft || 0;
      renderLines();
    });
    scheduleSessionSave();
    renderTabs();
    renderLines();
    renderCursor();
    setStatus(tab.name + (tab.dirty ? ' •' : ''));
    emitEditorEvent('tab.activated', {document:tabMetadata(tab)});
  }
  function renderTabs() {
    const crumb = document.getElementById('breadcrumbName');
    if (crumb) crumb.textContent = current()?.path || current()?.name || 'EDITOR';
    const nav = $('tabs');
    nav.replaceChildren();
    for (const tab of tabs.values()) {
      const button = document.createElement('button');
      button.className = 'tab';
      button.type = 'button';
      button.dataset.tabId = String(tab.id);
      button.setAttribute('role','tab');
      button.setAttribute('aria-selected',String(tab.id === activeId));
      const name = document.createElement('span');
      name.className = 'tab-name';
      name.textContent = tab.name;
      const dirty = document.createElement('span');
      dirty.className = 'tab-dirty';
      dirty.textContent = tab.dirty ? '●' : '';
      const close = document.createElement('span');
      close.className = 'tab-close';
      close.setAttribute('aria-hidden','true');
      close.textContent = '×';
      button.append(name,dirty,close);
      button.addEventListener('click', e => {
        if (e.target === close) closeTab(tab.id);
        else selectTab(tab.id);
      });
      button.addEventListener('auxclick', e => {
        if (e.button === 1) { e.preventDefault();closeTab(tab.id); }
      });
      nav.append(button);
    }
  }
  function closeTab(id = activeId, discardChanges = false) {
    const tab = tabs.get(id);
    if (!tab) return false;
    if (id === activeId) captureTab();
    if (tab.dirty && !discardChanges && !window.confirm(t('unsaved')+'\n'+tab.name)) return false;
    const order = [...tabs.keys()];
    const index = order.indexOf(id);
    tabs.delete(id);
    scheduleSessionSave();
    emitEditorEvent('document.closed', {id:String(id), path:tab.path || null});
    if (activeId === id) {
      const candidate = order[index + 1] || order[index - 1];
      activeId = null;
      if (candidate && tabs.has(candidate)) selectTab(candidate);
      else {
        editor.value = '';
        editor.readOnly = true;
        $('emptyHint').hidden = false;
        setStatus(t('ready'));
        renderTabs();
        renderLines();
        renderCursor();
      }
    } else renderTabs();
    return true;
  }

  function closeAllTabs() {
    captureTab();
    const dirty = [...tabs.values()].filter(tab => tab.dirty);
    if (dirty.length && !window.confirm(t('unsaved')+'\n'+dirty.map(tab=>tab.name).join('\n'))) return false;
    for (const id of [...tabs.keys()].filter(id=>id!==activeId)) closeTab(id,true);
    if (activeId!==null) closeTab(activeId,true);
    return true;
  }

  // Host Router / Explorer bridge v1.0. Requests must be forwarded by the Host.
  // This is an in-memory document API. Saving to a filesystem is NOT authorized.
  async function handleEditorRequest(event) {
    await bootReady;
    const request = event.data;
    const requestId = request?.requestId;
    if (typeof requestId !== 'string' || !requestId ||
        requestId.length > MAX_REQUEST_ID) return;
    const reply = (status, data = null, error = null) => event.source?.postMessage({
      protocol:EDITOR_PROTOCOL, type:'rep', version:EDITOR_API_VERSION,
      sourcePlugin:'cluster.text-editor', requestId, status,
      ok:status === 200, data, error
    }, '*');
    try {
      if (request.version !== EDITOR_API_VERSION) {
        reply(400,null,{code:'UNSUPPORTED_VERSION', message:'Expected '+EDITOR_API_VERSION});return;
      }
      const action = request.action;
      const args = request.params && typeof request.params === 'object' ? request.params : {};
      if (action === 'editor.capabilities') {
        reply(200,{version:EDITOR_API_VERSION, actions:[
          'editor.capabilities','tabs.list','tabs.activate','document.open',
          'document.get','document.update','document.close'],
          eventNames:['document.opened','document.changed','document.saved',
            'document.closed','tab.activated'],
          persistence:'memory-only',maxFileBytes});return;
      }
      if (action === 'workspace.snapshot') {
        captureTab();
        reply(200,{activeId:activeId == null ? null : String(activeId),
          documents:[...tabs.values()].map(tab => ({...tabMetadata(tab), content:tab.text}))});
        return;
      }
      if (action === 'tabs.list') {
        captureTab(); reply(200,{activeId:activeId === null ? null : String(activeId),
          tabs:[...tabs.values()].map(tabMetadata)});return;
      }
      if (action === 'document.open') {
        if (typeof args.name !== 'string' || !args.name.trim() || args.name.length > 255 ||
            typeof args.content !== 'string' ||
            new Blob([args.content]).size > maxFileBytes ||
            (args.path != null && (typeof args.path !== 'string' ||
              args.path.length > MAX_DOCUMENT_PATH))) {
          reply(400,null,{code:'INVALID_DOCUMENT',message:'Invalid name, path or content'});return;
        }
        const existing = args.path && [...tabs.values()].find(tab=>tab.path===args.path);
        if (existing) {
          selectTab(existing.id);
          reply(200,{document:tabMetadata(existing), reused:true});return;
        }
        const tab=makeTab(args.name,args.content,null,args.path || null,
          args.diskBacked === true);
        reply(200,{document:tabMetadata(tab)});return;
      }
      const tab = tabs.get(Number(args.id));
      if (!tab || String(tab.id)!==String(args.id)) {
        reply(404,null,{code:'DOCUMENT_NOT_FOUND',message:'Unknown document ID'});return;
      }
      if (action === 'tabs.activate') {
        selectTab(tab.id);reply(200,{document:tabMetadata(tab)});return;
      }
      if (action === 'document.get') {
        if (tab.id === activeId) captureTab();
        reply(200,{document:tabMetadata(tab),content:tab.text});return;
      }
      if (action === 'document.update') {
        if (typeof args.content !== 'string' ||
            new Blob([args.content]).size > maxFileBytes) {
          reply(400,null,{code:'INVALID_CONTENT',message:'Invalid content'});return;
        }
        if (!Number.isInteger(args.expectedRevision) ||
            args.expectedRevision !== tab.revision) {
          reply(409,{document:tabMetadata(tab)},
            {code:'REVISION_CONFLICT',message:'Read latest revision before writing'});return;
        }
        if (tab.id === activeId) captureTab();
        tab.text=args.content;tab.dirty=tab.text!==tab.lastSaved;
        tab.revision=nextRevision++;
        scheduleSessionSave();
        if (tab.id===activeId) selectTab(tab.id);
        else renderTabs();
        emitEditorEvent('document.changed',{document:tabMetadata(tab),content:tab.text});
        reply(200,{document:tabMetadata(tab)});return;
      }
      if (action === 'document.rename') {
        if(typeof args.name!=='string' || !args.name.trim() || args.name.length>255 ||
           typeof args.path!=='string' || args.path.length>MAX_DOCUMENT_PATH){
          reply(400,null,{code:'INVALID_RENAME',message:'Invalid new document name/path'});return;
        }
        tab.name=args.name;tab.path=args.path;tab.revision=nextRevision++;
        scheduleSessionSave();
        renderTabs();
        emitEditorEvent('document.renamed',{document:tabMetadata(tab)});
        reply(200,{document:tabMetadata(tab)});return;
      }
      if (action === 'document.close') {
        if (tab.id === activeId) captureTab();
        if (tab.dirty && args.prompt === true) {
          if (!window.confirm(t('unsaved'))) {
            reply(409,{document:tabMetadata(tab)},
              {code:'CLOSE_CANCELLED',message:'Close was cancelled'});return;
          }
          args.discardChanges = true;
        }
        if (tab.dirty && args.discardChanges!==true) {
          reply(409,{document:tabMetadata(tab)},
            {code:'UNSAVED_CHANGES',message:'Explicit discardChanges is required'});return;
        }
        // closeTab normally prompts; only bypass prompt after explicit discard.
        if (!closeTab(tab.id,args.discardChanges===true)) {
          reply(409,{document:tabMetadata(tab)},
            {code:'CLOSE_CANCELLED',message:'Close was cancelled'});return;
        }
        reply(200,{id:String(tab.id)});return;
      }
      reply(400,null,{code:'UNKNOWN_ACTION',message:'Unsupported action'});
    } catch (error) {
      reply(500,null,{code:'EDITOR_REQUEST_FAILED',message:String(error?.message||error)});
    }
  }

  // Register actual callable services in the Host's live Router registry.
  // A postMessage endpoint alone does not populate Plugin Manager / API List.
  const documentId = { type:'string', minLength:1 };
  const schemas = [
    ['editor.capabilities', 'Discover editor actions, events and limits', {}, []],
    ['tabs.list', 'List open tabs and active document', {}, []],
    ['tabs.activate', 'Switch active editor tab', {id:documentId}, ['id']],
    ['document.open', 'Open a text document supplied by Explorer', {
      name:{type:'string'}, content:{type:'string'}, path:{type:'string'}
    }, ['name','content']],
    ['document.get', 'Read document contents and revision', {id:documentId}, ['id']],
    ['document.update', 'Update an in-memory document with MVCC revision', {
      id:documentId, content:{type:'string'}, expectedRevision:{type:'integer'}
    }, ['id','content','expectedRevision']],
    ['document.close', 'Close a tab with explicit unsaved-change protection', {
      id:documentId, discardChanges:{type:'boolean'}
    }, ['id']]
  ];
  async function executeRegisteredAction(action, params) {
    let message = null;
    const requestId = 'router-' + String(++nextRevision);
    await handleEditorRequest({
      data:{version:EDITOR_API_VERSION,requestId,action,params:params || {}},
      source:{postMessage: response => { message = response; }}
    });
    if (!message) throw new Error('Editor did not return a response');
    if (!message.ok) {
      const error = new Error(message.error?.message || 'Editor action failed');
      error.code = message.error?.code || 'EDITOR_REQUEST_FAILED';
      throw error;
    }
    return message.data;
  }
  async function registerEditorServices() {
    if (!window.Cluster?.Router?.register || window.parent === window) return;
    for (const [action, description, properties, required] of schemas) {
      try {
        const response = await Cluster.Router.register(
          action, params => executeRegisteredAction(action, params), {
            contract:{version:EDITOR_API_VERSION,description,
              request:{type:'object',properties,required,additionalProperties:false},
              response:{type:'object'}}
          });
        if (!response.ok) throw new Error(response.error?.message || String(response.status));
      } catch (error) {
        console.warn('Cluster Editor API registration failed:', action, error);
        emitEditorEvent('editor.registration.error', {action,
          message:String(error?.message || error)});
      }
    }
  }
  void registerEditorServices();

  function linePosition(text, offset) {
    const before = text.slice(0, offset);
    const lastNewline = before.lastIndexOf('\n');
    return { line:before.split('\n').length, col:before.length - lastNewline };
  }
  function renderCursor() {
    const tab = current();
    if (!tab) {
      $('cursorStatus').textContent = 'Ln 1, Col 1';
      return;
    }
    const pos = linePosition(editor.value, editor.selectionStart);
    $('cursorStatus').textContent = `Ln ${pos.line}, Col ${pos.col}`;
    if(parent!==window) parent.postMessage({protocol:'cluster.workspace.status.v1',
      type:'cursor',line:pos.line,col:pos.col},'*');
  }
  function renderLines() {
    const total = (editor.value.match(/\n/g) || []).length + 1;
    $('lineCount').textContent = `${total} lines`;
    const maxRendered = Math.min(total, 50000);
    $('lineNumbers').textContent = Array.from({length:maxRendered}, (_,i)=>i+1).join('\n') +
      (total > maxRendered ? '\n…' : '');
    $('lineNumbers').style.transform = `translateY(-${editor.scrollTop}px)`;
  }
  function markChanged() {
    if (internalUpdate) return;
    const tab = current();
    if (!tab) return;
    tab.text = editor.value;
    tab.dirty = tab.text !== tab.lastSaved;
    tab.revision = nextRevision++;
    emitEditorEvent('document.changed', {document:tabMetadata(tab), content:tab.text});
    scheduleSessionSave();
    renderTabs();
    renderLines();
    renderCursor();
    setStatus(tab.name + (tab.dirty ? ' •' : ''));
  }

  function decodeText(buffer) {
    const data = new Uint8Array(buffer);
    if (data.length >= 2 && data[0] === 0xff && data[1] === 0xfe)
      return new TextDecoder('utf-16le', {fatal:true}).decode(data.subarray(2));
    const offset = data.length >= 3 && data[0] === 0xef && data[1] === 0xbb &&
      data[2] === 0xbf ? 3 : 0;
    return new TextDecoder('utf-8',{fatal:true}).decode(data.subarray(offset));
  }
  async function openFiles(files, handles = []) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        if (file.size > maxFileBytes) { toast(t('tooLarge')+': '+file.name); continue; }
        const text = decodeText(await file.arrayBuffer());
        makeTab(file.name, text, handles[i] || null);
        setStatus(t('opened')+': '+file.name);
      } catch (error) {
        toast(t('invalid')+' '+file.name+' ('+String(error?.message||error)+')');
      }
    }
  }
  function fallbackOpen() { $('openFileInput').click(); }
  async function open() {
    closeMenu();
    // Only user-gesture file handles may grant direct overwrite rights.
    if (typeof window.showOpenFilePicker === 'function') {
      try {
        const handles = await window.showOpenFilePicker({multiple:true});
        const files = await Promise.all(handles.map(h=>h.getFile()));
        await openFiles(files, handles);
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
        // SecurityError is expected inside Cluster's opaque-origin iframe.
      }
    }
    fallbackOpen();
  }
  function canDirectSave() {
    return typeof window.showSaveFilePicker === 'function';
  }
  function updateSaved(tab) {
    tab.lastSaved = tab.text;
    tab.dirty = false;
    tab.revision = nextRevision++;
    emitEditorEvent('document.saved', {document:tabMetadata(tab), content:tab.text, persistence:'file-handle'});
    scheduleSessionSave();
    renderTabs();
    setStatus(t('savedWithName')+': '+tab.name);
  }
  async function saveToHandle(tab, handle) {
    const stream = await handle.createWritable();
    await stream.write(new Blob([tab.text],{type:'text/plain;charset=utf-8'}));
    await stream.close();
    tab.handle = handle;
    tab.diskBacked = true;
    tab.name = handle.name || tab.name;
    updateSaved(tab);
  }
  let diskSaveCounter=0;
  const pendingDiskSaves=new Map();
  function saveViaExplorer(tab){
    if(!tab.path || parent===window)return Promise.reject(Error('No authorized file destination')); 
    const requestId='disk-save-'+(++diskSaveCounter);
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{
        pendingDiskSaves.delete(requestId);reject(Error('Disk save timed out'));
      },12000);
      pendingDiskSaves.set(requestId,{resolve,reject,timer});
      parent.postMessage({protocol:'cluster.workspace.file.v1',type:'save-request',
        requestId,path:tab.path,content:tab.text},'*');
    });
  }
  window.addEventListener('message',event=>{
    if(event.source!==parent || event.data?.protocol!=='cluster.workspace.file.v1' ||
       event.data.type!=='save-result')return;
    const pending=pendingDiskSaves.get(event.data.requestId);
    if(!pending)return;
    clearTimeout(pending.timer);pendingDiskSaves.delete(event.data.requestId);
    if(event.data.ok)pending.resolve(true);
    else pending.reject(Error(String(event.data.error||'Disk save not authorized')));
  });
  async function save() {
    closeMenu();
    captureTab();
    const tab = current();
    if (!tab) return;
    if (tab.handle) {
      try {
        await saveToHandle(tab,tab.handle);
        return;
      } catch (error) {
        toast(t('failed')+': '+String(error?.message||error));
      }
    }
    if(tab.path && tab.diskBacked){
      try{await saveViaExplorer(tab);updateSaved(tab);return;}
      catch(error){
        // A direct save must not silently export or claim success.
        toast(t('failed')+': '+String(error.message||error));return;
      }
    }
    // No disk origin: ask the browser where to persist the document.
    await saveAs();
  }
  async function saveAs() {
    closeMenu();
    captureTab();
    const tab = current();
    if (!tab) return;
    if (canDirectSave()) {
      try {
        const handle = await window.showSaveFilePicker({suggestedName:tab.name,
          types:[{description:'Text / source file',accept:{'text/plain':['.txt','.md','.json','.js','.ts','.html','.css','.py','.cpp','.h','.log','.csv']}}]});
        await saveToHandle(tab,handle);
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
        toast(t('unsupported')+' ('+String(error?.name||error)+')');
      }
    }
    $('saveName').value = tab.name;
    $('saveDialog').dataset.tabId = String(tab.id);
    $('saveDialog').showModal();
    $('saveName').focus();
    $('saveName').select();
  }
  function exportDownload(id, name) {
    const tab = tabs.get(id);
    if (!tab) return;
    const safeName = name.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').trim() || 'untitled.txt';
    const blob = new Blob([tab.text], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeName;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    // A sandboxed iframe without allow-downloads is blocked by Chrome.
    // Never claim the data was saved; only report that export was attempted.
    setStatus(t('exported')+': '+safeName);
    if (window.self !== window.top) toast(t('sandbox'), 8000);
    else toast(t('exported')+': '+safeName);
    // Deliberately leave the dirty marker: download success cannot be detected.
  }
  function copyAll() {
    closeMenu();
    const tab = current();
    if (!tab) return;
    editor.focus();
    editor.select();
    let copied = false;
    try { copied = document.execCommand('copy'); }
    catch { /* browser denied clipboard */ }
    if (copied) toast(t('copied'));
    else toast(t('copyFailed'),6500);
  }
  function setMenu(opened) {
    $('fileMenu').hidden = !opened;
    $('fileMenuButton').setAttribute('aria-expanded',String(opened));
  }
  function closeMenu() { setMenu(false); }
  // Public palette comes exclusively from PRMU context forwarded by Host.
  const hexValid = /^#[0-9a-f]{6}$/i;
  let baseColor = '#000000';
  let fontBaseline = 'dark';
  function syncPaletteFields() { /* Host-owned palette controls only. */ }
  function initPaletteControls() { /* No local palette dialog. */ }
  async function openHostPalette() {
    try {
      // Route via the owning editor shell to the Host RPC bridge.
      const result=await new Promise((resolve,reject)=>{
        const requestId='palette-ui-'+Math.random().toString(36).slice(2);
        const timeout=setTimeout(()=>{window.removeEventListener('message',reply);reject(Error('RPC timeout'));},9000);
        function reply(e){if(e.source!==parent||e.data?.protocol!=='cluster.plugin.v1'||
          e.data?.type!=='response'||e.data.requestId!==requestId)return;
          clearTimeout(timeout);window.removeEventListener('message',reply);resolve(e.data);}
        window.addEventListener('message',reply);
        parent.postMessage({protocol:'cluster.plugin.v1',type:'request',requestId,
          method:'PRMU.openUIColorPalette',args:[]},'*');
      });
      if(!result.ok)throw Error(result.error?.message||'Palette unavailable');
    }catch(error){toast('公共庫調色盤無法開啟：'+String(error.message||error));}
  }
  function openPlugins() {
    // Never hardcode a Host location in an isolated plugin.
    const url = getPluginManagerUrl();
    if (!url) { toast(t('navigationBlocked'), 9000); return; }
    try {
      if (window.top === window.self) { location.assign(url); return; }
      window.top.location.assign(url);
      return;
    } catch { /* top-level navigation can be blocked by iframe sandbox */ }
    try {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (opened) return;
    } catch { /* popups can also be blocked by iframe sandbox */ }
    toast(t('navigationBlocked') + ' ' + url, 9000);
  }
  window.addEventListener('message', event => {
    if(event.source!==parent || event.data?.protocol!=='cluster.workspace.file.v1' ||
       event.data.type!=='command')return;
    const cmd=event.data.action;
    if(['new','open','save','save-as','copy','close','close-all','palette','language'].includes(cmd))
      runCommand(cmd);
  });
  function runCommand(command) {
    const actions = {
      new:newFile, open, save, 'save-as':saveAs, copy:copyAll,
      close:()=>closeTab(), 'close-all':closeAllTabs,
      palette:openHostPalette,
      language:()=>$('languageDialog').showModal(),
      plugins:openPlugins
    };
    closeMenu();
    if (actions[command]) void actions[command]();
  }
  function showFind() {
    showingFind = true;
    $('findPanel').hidden = false;
    $('findText').focus();
    $('findText').select();
  }
  function hideFind() {
    showingFind = false;
    $('findPanel').hidden = true;
    editor.focus();
  }
  function findNext() {
    const term = $('findText').value;
    if (!term) { $('findCount').textContent = '';return; }
    const haystack = editor.value.toLocaleLowerCase();
    const needle = term.toLocaleLowerCase();
    let idx = haystack.indexOf(needle, editor.selectionEnd);
    if (idx === -1) idx = haystack.indexOf(needle);
    if (idx < 0) { $('findCount').textContent = t('notFound');return; }
    editor.focus();
    editor.setSelectionRange(idx,idx+term.length);
    const count = haystack.split(needle).length - 1;
    $('findCount').textContent = t('found')+': '+count;
    renderCursor();
  }

  initPaletteControls();
  $('languageSelect').addEventListener('change', event => applyLocale(event.target.value));
  document.querySelectorAll('[data-close-dialog]').forEach(button => {
    button.addEventListener('click', () => $(button.dataset.closeDialog).close());
  });
  $('fileMenuButton').addEventListener('click',()=>setMenu($('fileMenu').hidden));
  $('fileMenu').addEventListener('click',event=>{
    const command = event.target.closest('[data-command]')?.dataset.command;
    if (command) runCommand(command);
  });
  document.addEventListener('pointerdown', event => {
    if (!$('fileMenuGroup').contains(event.target)) closeMenu();
  });
  $('newButton').addEventListener('click',newFile);
  $('openFileInput').addEventListener('change',event=>{
    const files = [...event.target.files];
    event.target.value = '';
    void openFiles(files);
  });
  $('saveDialog').addEventListener('close',()=>{
    if ($('saveDialog').returnValue === 'save') {
      const id = Number($('saveDialog').dataset.tabId);
      exportDownload(id, $('saveName').value);
    }
  });
  $('findNext').addEventListener('click',findNext);
  $('findText').addEventListener('keydown',event=>{
    if (event.key === 'Enter') {event.preventDefault();findNext();}
    if (event.key === 'Escape') hideFind();
  });
  $('closeFind').addEventListener('click',hideFind);
  editor.addEventListener('input',markChanged);
  editor.addEventListener('scroll',() => {
    renderLines();
    const tab=current();
    if(tab){tab.scrollTop=editor.scrollTop;
      tab.scrollLeft=editor.scrollLeft;scheduleSessionSave();}
  });
  editor.addEventListener('click',()=>{renderCursor();scheduleSessionSave();});
  editor.addEventListener('keyup',()=>{renderCursor();scheduleSessionSave();});
  editor.addEventListener('keydown',event=>{
    if (event.key === 'Tab') {
      event.preventDefault();
      const a = editor.selectionStart, b = editor.selectionEnd;
      editor.setRangeText('    ',a,b,'end');
      markChanged();
    }
  });
  document.addEventListener('keydown',event=>{
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (mod && ['s','o','n','w','f'].includes(key)) {
      event.preventDefault();
      if (key === 's') void (event.shiftKey ? saveAs() : save());
      if (key === 'o') void open();
      if (key === 'n') newFile();
      if (key === 'w') closeTab();
      if (key === 'f') showFind();
    } else if (key === 'escape') {
      closeMenu();
      if (showingFind) hideFind();
    }
  });
  document.addEventListener('dragover',event=>event.preventDefault());
  document.addEventListener('drop',event=>{
    event.preventDefault();
    if (event.dataTransfer?.files?.length) void openFiles([...event.dataTransfer.files]);
  });
  window.addEventListener('beforeunload',event=>{
    captureTab();
    saveSessionNow();
    if ([...tabs.values()].some(tab=>tab.dirty)) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  window.addEventListener('pagehide',saveSessionNow);
  window.addEventListener('error', event =>
    emitEditorEvent('workspace.error',{message:String(event.message||'Editor error')}));
  bootReady=(async()=>{
    let indexed=null;
    try{indexed=await snapshotDB('readonly',store=>store.get(SESSION_KEY));}
    catch{}
    if(!restoreSession(indexed)){
      tabs.clear();
      if(!restoreSession())tabs.clear();
    }
    if(tabs.size===0){
      activeId=null;
      editor.value='';
      editor.readOnly=true;
      $('emptyHint').hidden=false;
      renderTabs();
      renderLines();
      renderCursor();
      setStatus(t('ready'));
    }
  })();
})();
