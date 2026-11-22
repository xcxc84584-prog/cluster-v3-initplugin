# ClusterPowerShell v0.3.1 — Native Windows PowerShell terminal

Cluster is **only the terminal window**. The local agent creates real Windows
ConPTY terminals running `powershell.exe` or `pwsh.exe`. Each PowerShell
tab owns a separate process and has its own working directory, command history,
variables, native prompt, stream output and interactive keyboard handling.

## Quick setup (Windows)

1. Open **Tool → PowerShell** in the Cluster Editor. The first-run
   configuration view fills the PowerShell window (it is not a popup).
2. Click **Download quick setup CMD** and run the downloaded
   `ClusterPowerShell-QuickSetup.cmd` on your Windows PC.
3. The script checks Node.js and offers to install the official Node.js LTS
   package via winget. It runs npm to install the pinned ConPTY/node-pty,
   WebSocket, and xterm.js runtime dependencies.
4. Explicitly approve the `node-pty` native build script if requested.
   Setup verifies `require('node-pty')` before continuing, rather than
   claiming READY when npm skipped a necessary install script.
5. Choose Windows PowerShell or PowerShell 7 (with optional winget install).
6. Enter the trusted Cluster page URL, for example
   `https://example.com/Cluster-v3/`. The bridge normalizes it to
   `https://example.com` for strict browser Origin checks.
7. Copy the printed **PORT MESSAGE** URL (or just its numeric port) and
   64-character **TOKEN** into the setup page, then click **Check connection**.
   The same window switches to a native ConPTY PowerShell terminal on success.

The quick setup requires the user's explicit choice. The browser cannot
automatically execute CMD or install software.

## Terminal behavior

- **+** adds an independent PowerShell terminal process, **×** closes one.
- Terminal input is sent byte-for-byte to the ConPTY process; xterm.js renders
  the VT / ANSI output stream.
- Native line editing, Tab completion, Ctrl+C, interactive processes, native
  stdout/stderr, working directory and shell history are not emulated.
- Different tabs run concurrently; max 12 per Local Agent process.
- Resizing updates ConPTY dimensions. Reloading the browser ends that page's
  terminal connections. Closing the CMD window stops all sessions.
- A browser terminal can closely reproduce PowerShell CLI behavior but
  cannot guarantee identical Windows Terminal or legacy Console Host graphics,
  clipboard, system shortcuts, or every external console application.

## Design and protection

- Changes are confined to `cluster-v3-initplugin`, with no Host modifications.
- Editor Tool menu and layout remain unchanged; terminal tabs live within it.
- Six UI languages and shared PRMU palette are used. PRMU does not store local
  Port, Token, Origin, terminal input or shell output.
- Agent binds only to `127.0.0.1` using a dynamic available port.
- A fresh random 256-bit token and explicit browser Origin check protect the
  local privileged terminal. Only connect a trusted page.
- No silent remote execution, open LAN listeners or remote tunneling.
- Windows 10 version 1809+ is required for the ConPTY path.

## Validation

Static syntax and source-level regression tests cover the protocol wiring.
Real Windows functional tests are still needed for ConPTY, multiline input,
PSReadLine, Ctrl+C, resizing, ANSI output and platform compatibility.
