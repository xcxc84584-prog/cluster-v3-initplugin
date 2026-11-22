# ClusterPowerShell (Windows)

This is an opt-in local PowerShell tool for the Cluster Editor workspace.

## Install and connect

1. Quick-install the `cluster.powershell` plugin from Cluster Community, or download this plugin Folder package.
2. On the Windows device, open the plugin's `bridge` folder in PowerShell.
3. Start the bridge from the local script:
   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Start-ClusterPowerShell.ps1
   ```
   The command requests the **Cluster website origin**, such as `https://example.org` (without a path).
4. When the script prints `PORT MESSAGE : http://127.0.0.1:<port>/ TOKEN <token>`, enter the URL and token in the terminal's connection panel. Do not share the token.
5. In the Editor, click **Tools → PowerShell**. The plugin registers `workspace.powershell.v1` through PRMU; the Tool control only appears when this capability is discoverable.

### Optional environment setup

Windows PowerShell 5.1 usually exists on supported Windows installations and needs no download. To **offer automatic PowerShell 7 installation** with the user's approval, run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Start-ClusterPowerShell.ps1 -InstallPowerShell7
```

This uses Windows Package Manager (`winget`) and its Microsoft.PowerShell package. If winget is missing, it explains the error and requires an official manual installation; the script does not download arbitrary executables or silently change system configuration.

### Architecture and limits

- No fixed port. The bridge asks Windows for an available loopback TCP port and starts an HTTP listener.
- Local HTTP traffic is restricted to 127.0.0.1, an explicitly approved browser origin, and a random 256-bit token held only in memory.
- Browser cannot directly run or silently install a local native shell; user must start the script locally.
- **Each command starts a new PowerShell process**. State such as `cd`, functions, and environment assignments does not persist across commands in this initial implementation.
- The bridge is an intentionally privileged local execution tool; only connect it to a trusted Cluster page. Stop it with Ctrl+C.
- The shared color palette and interface language are received from the Host PRMU. Port, origin, and token are device-local runtime settings and **must never be stored in the shared public library**.
- No Cluster-v3 Host changes are made by this package.
