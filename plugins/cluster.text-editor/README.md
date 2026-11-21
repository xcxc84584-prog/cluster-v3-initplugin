# Cluster BasicTextEditor v2.6.0

File 選單的「開啟舊檔（資料夾）」優先以 File System Access API 取得可讀寫 handle，再送往 Explorer 插件嵌入畫面；一般檔案匯入仍為唯讀副本。

與 Explorer v2.1.0 配對使用。若瀏覽器不支援，退回傳統檔案選擇器。

Host 未修改；磁碟寫入權限由瀏覽器在使用者操作時授權。
