# Cluster-v3 Basic Text Editor Plugin v1.3.1

完全獨立的文字編輯器插件，不修改 Cluster-v3 核心。

## 功能

- 舊版 Cluster 風格：深色編輯器、右上方 **File** 選單、檔案分頁、行號、狀態列。
- New、Open、Save、Save As、Close、Copy All Text。
- 多個檔案分頁、未儲存標記、切換分頁、關閉前確認、拖放開啟文字檔。
- Ctrl+N / Ctrl+O / Ctrl+S / Ctrl+Shift+S / Ctrl+W / Ctrl+F，Tab 鍵輸入 4 個空白。
- 搜尋文字、行列位置、基本編碼偵測（UTF-8 / UTF-16 LE）、10 MiB 單檔上限。
- 透過 Cluster 共用介面調色盤與語言事件同步，不需要核心私有 API。

## 安裝方式

1. 在 Cluster-v3 的 Plugin Explorer 點選 `＋`（ZIP 插件裝載）。
2. 選取整個 `Cluster-v3-Basic-Text-Editor.zip`，**不要先解壓縮**。
3. 點選 `Cluster Text Editor`，進入插件頁面。
4. 右上角 File → Open 選取檔案；或選擇 New 建立新檔。

## 重要：讀寫權限限制

Cluster-v3 目前把插件放在不含 `allow-same-origin` 和 `allow-downloads` 的 sandbox iframe 中。
這個限制由 Host 建立，插件不能自行取消。依目前 Chrome 安全機制：

- **可用**：`<input type=file>` 選擇檔案後讀取文字、內部編輯、多分頁、複製文字。
- **不保證可用**：在插件 iframe 內以 Blob/`a[download]` 匯出文字，可能遭沙箱封鎖。
- **不可直接覆寫本機原檔**：File System Access API 的 `showSaveFilePicker`/`createWritable` 在 sandbox opaque-origin iframe 內無法正常取得使用者本機檔案授權。
- 若需要真正的本機寫入：將插件解壓後，**在 HTTPS/localhost 的獨立網頁環境**（非 sandbox iframe）載入 `index.html`，使用 Chrome 或 Edge。獨立網頁在支援 File System Access API 的環境下，可授權寫入；其他瀏覽器可用下載式匯出。
- Cluster 的 `?plugin=cluster.text-editor` 獨立視圖仍由 Host 以 sandbox iframe 掛載，**不等於解除沙箱**。

儲存動作不會偽稱寫入成功：若只是發起下載，編輯器不會清除未儲存標記。使用者可以透過 File → Copy All Text 備份文字。

如需在 Cluster Host iframe 中真正支援儲存到本機，需要 Host 新增經使用者授權的下載／檔案儲存橋接 API，或安全放寬沙箱限制；這超出「不動核心」範圍。

## 套件規範

本套件以 `manifest.json` 為根目錄，包含：

```text
manifest.json
index.html
community.html
scripts/editor.js
scripts/community.js
styles/editor.css
styles/community.css
README.md
docs/Compatibility.md
```

`manifest.schemaVersion` 為 `1.0.0`、插件 ID 為 `cluster.text-editor`，並使用 `ui.mode = both`。

## 安全與隱私

- 編輯內容保留在當前瀏覽器分頁記憶體；**沒有偷偷上傳到伺服器**。
- 沒有外部 CDN、外部網路 API 或儲存密鑰。
- 重新整理頁面前應先複製或保存文字；在沙箱中無法保證保存。

## v1.2.1 新增

- File 移至右上角，並套用 Cluster 風格的菱形品牌標誌。
- File → 介面著色盤：可在編輯器中調整八個 UI 色彩變數。
- File → 語言：繁中、英文、法文、日文、西文、印地文。Host 語言事件仍可同步更新。
- File → 插件：前往 Host 網址的 `/plugin`，在受限 iframe 中可能被瀏覽器阻擋；無法保證不修改 Host 就能切換父視窗。
- 配色與語言選單修改的是插件當前頁面的呈現，不會繞過權限直接修改 Host 全域設定。

## v1.2.0 Appearance
Single global RGB color input (HEX/color picker/R/G/B), automatic text contrast, dark/light baseline, live preview and local autosave.

## v1.2.1 修正

- File → 插件：直接導向 https://xcxc84584-prog.github.io/Cluster-v3/plugin/?view=home。
- 白色基準設定 RGB(255,255,255) / #FFFFFF；黑色基準設定 RGB(0,0,0) / #000000。
- 修正 HEX / RGB 編輯時重繪干擾，校正純白背景端點。

## v1.3.1 — Explorer compatibility

- Plugin navigation resolves the Host Public Repository `getPluginSiteUrl()`
  context property (`pluginSiteUrl`), without a hardcoded URL.
- Exact white RGB endpoint now applies `#ffffff` to background and correctly
  contrasts foreground even after dark-baseline mode was selected.
- Adds versioned `cluster.editor.v1` req/rep document and tab APIs, including
  revision conflict checks and lifecycle notifications.
- The current Cluster-v3 Host still needs a Router mapping/permission layer
  to connect a separate Explorer plugin. See `docs/Explorer-API-v1.md`.

## v1.3.1：Host API List 正式註冊

編輯器啟動後，使用 `cluster.plugin.v1` Host Bridge 的 `Router.register(action, handler, {contract})` 註冊以下 7 個可呼叫動作：`editor.capabilities`、`tabs.list`、`tabs.activate`、`document.open`、`document.get`、`document.update`、`document.close`。

Plugin Manager → 選取 Cluster Text Editor → API 列表：應顯示 7 筆 `cluster.text-editor:<action>`（Host 需於成功註冊時重新整理 API 視圖）。註冊失敗會記錄至瀏覽器 console，且對外送出 `editor.registration.error` 事件。

每次裝載／重新啟動均註冊，卸載時由 Host Router 清理。Explorer 透過 `Router.request('cluster.text-editor', 'document.open', {...})` 呼叫。跨插件讀寫需由 Host 授權；此 API 不授權磁碟寫入。

## v1.4.0 — ClusterOpt2 × VS Code UI

- 更新標題列、工作區標示、分頁、編輯區、狀態列，新增路徑麵包屑。
- 保留 v1.3.1 所有 API 與編輯功能；Explorer 另以獨立 ZIP 發佈。
- 跨插件路由仍取決於 Cluster-v3 Host 是否支援。

Palette dialog removed; use Host public library palette controls.
