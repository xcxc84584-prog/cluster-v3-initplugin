# Cluster Explorer v2.5.0 — Live Disk Reconciliation

- 「開啟舊檔（資料夾）」在支援的 Chromium 安全環境中使用 `showDirectoryPicker({mode:"readwrite"})`。
- 授權目錄中的真實子檔案／子資料夾可經刪除確認後以 `removeEntry` 真正刪除磁碟內容；資料夾遞迴刪除包含未顯示檔案。
- 磁碟刪除會跳過資源回收筒，**無法復原**。失敗時維持 Explorer/Editor 狀態。
- **授權根資料夾本身不能刪除**，因為還需要父資料夾權限；可按「關閉」卸載。
- 一般 `<input type="file">` 匯入檔案、原生新建及複製的虛擬文件：只能刪除工作區副本，原始磁碟檔案不變，UI 會清楚標示。
- 已授權磁碟項目的重新命名與剪下移動暫時停用，以防顯示名稱與原始路徑不一致。
- handle 僅存於 Explorer iframe 記憶體，關閉／刷新後需重新授權。
- 若瀏覽器不支援 File System Access API，會降級為唯讀資料夾匯入，不能刪除原檔。
- 跨插件開檔、Tab/Explorer 關閉同步、公共庫配色與語言設定延續前版。
- 不需修改 Host；但完整 Host iframe 中是否允許 File System Access API 仍須在使用者環境驗證。

## External directory synchronization (v2.5.0)

- An authorized, connected directory is re-enumerated approximately every 3 seconds
  while the Explorer frame is visible. Browser scheduling may delay individual scans.
- Newly added supported text files and subfolders appear automatically. Files and
  folders removed or renamed outside Cluster are removed from the on-screen tree;
  a rename appears as removal of the old path and discovery of the new path.
- The scan never creates, overwrites, or deletes disk files. Scans are bounded by
  the existing 3,000-entry, 24-level and 10 MiB-per-text-file limits.
- External-first prioritizes changed disk content; internal-first retains the
  workspace copy. Open tabs are not forcibly closed when a backing file vanishes.
- Previously imported folders still require a new browser directory permission
  after reloading the page. Snapshots do not grant disk access.
- The stable plugin ID is `cluster.explorer`; no Router or workspace
  protocol names have changed.
