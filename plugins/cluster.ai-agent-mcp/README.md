# Cluster AI Agent MCP v0.2.0

Reference implementation: ClusterOpt2 AI Agent MCP. This version uses the
Cluster-v3 plugin-only project and **does not change the Cluster-v3 Host**.

## One-time installation

1. Update the Editor and ClusterPowerShell plugins from the initplugin
   community repository, then install `cluster.ai-agent-mcp`.
2. Open Tool → AI Agent MCP. Its workspace uses the same shared Tab row.
   The child sidebar toggles by clicking its border, resizes by dragging,
   and stores its width and collapsed state.
3. Download and run the ClusterPowerShell QuickSetup CMD on Windows.
   It downloads the Local Agent, secure-store, MCP Gateway, OAuth Gateway
   and launcher files into the user's LOCALAPPDATA directory.
4. Connect AI Agent to the running Local Agent with its port and DPAPI
   pairing token. The optional browser remember switch stores encrypted
   credentials in IndexedDB; it is **not** a replacement for user approval.
5. In the AI Agent setup page, download `Cluster-MCP-QuickSetup.cmd`,
   execute it and choose option 2 to start MCP + OAuth gateways.
6. Enter the **stable HTTPS OAuth issuer origin** (no path) when requested.
   The machine starts two localhost-only processes, never a LAN listener.
7. Run `Show-OAuth-Approval.cmd` locally to display the DPAPI-protected
   approval password. Keep it private. The password is required when
   approving the ChatGPT OAuth connection.
8. Configure a trusted HTTPS reverse proxy or tunnel to point **only** at
   the OAuth listener port shown by the OAuth CMD window. Do not expose
   PowerShell, the raw MCP listener or an unrelated local service.
9. In ChatGPT's MCP connector configuration, enter the secure URL
   `https://your-mcp-host.example/mcp`, choosing OAuth (Dynamic Client
   Registration) when applicable. The origin must match the configured
   issuer. Approve the requested read-only or control scope in the
   OAuth approval page.

**OAuth issuer validation:** Cluster's `https://...github.io/Cluster-v3/`
GitHub Pages address is a static web app, **not** an OAuth issuer. Use a
public hostname that actually routes to the running OAuth Gateway through a
trusted HTTPS reverse proxy. The launcher accepts pasted full URLs and
normalizes them to the HTTPS origin. If the public proxy does not yet exist,
set it up before choosing option 2; otherwise choose option 1 (local MCP only).


There is no embedded public reverse-proxy installer: you must supply
the stable HTTPS endpoint, TLS termination and DNS setup yourself.

## Option [3]: temporary Cloudflare Quick Tunnel (ClusterOpt2 workflow)

Run the updated `Start-Cluster-MCP.cmd` and select `[3]`.

- No custom hostname, Cloudflare account or DNS setup is required.
- If `cloudflared` is missing, the script asks before installing the
  official `Cloudflare.cloudflared` WinGet package.
- After explicit approval, it starts/reuses the loopback MCP Gateway;
  allocates a loopback OAuth port; registers a Quick Tunnel **only to OAuth**;
  extracts the random `https://…trycloudflare.com` issuer; starts the OAuth
  Gateway with precisely that issuer; and verifies localhost and public
  OAuth/MCP resource metadata before displaying the ChatGPT MCP URL.
- The verified connection is shown as
  `PORT MESSAGE : CHATGPT MCP https://random.trycloudflare.com/mcp`.
- If a previous verified Quick Tunnel is running, choose **R** to reuse,
  **D** to explicitly revoke the verified processes and make a new URL,
  or **C** to preserve the old connection.
- Quick Tunnel logs and non-secret local process state live under
  `%LOCALAPPDATA%\ClusterPowerShell\`. The launcher will never expose
  PowerShell or the raw MCP Gateway.
- Quick Tunnels are **temporary/testing-only**, have no uptime SLA, use a
  different URL when recreated, and do not support SSE. Update ChatGPT's
  configured URL after recreation. For long-term use select [2] with a
  stable, trusted HTTPS reverse proxy.

If tunnel registration, DNS, OAuth issuer metadata or public reachability
fails, the setup does **not** claim success. It stops only the OAuth and
cloudflared processes launched in that failed attempt; existing MCP sessions
are preserved.

## Fourteen MCP tools

The MCP Gateway advertises 14 JSON-RPC tools; execution is proxied through
the authenticated Local Agent and live browser AI Agent frame.

- **Default read scope (5):** `cluster.get_status`,
  `cluster.get_task_status`, `cluster.list_files`,
  `cluster.get_editor_state`, `cluster.read_file`.
- **Control scope (9):** `cluster.list_roots`,
  `cluster.find_root_windows_path`, `cluster.list_directory`,
  `cluster.read_path`, `cluster.create_file`, `cluster.write_path`,
  `cluster.delete_path`, `cluster.open_powershell`,
  `cluster.powershell_request`.

Editor read operations use its existing document API. Filesystem operations
use the native Local Agent's user-selected, permission-scoped Windows roots. Create, overwrite, delete and
PowerShell commands require **one-shot approval** in the Agent window.

`cluster.find_root_windows_path` returns a *user-confirmed* Windows
path, with `verified:false` because File System Access does not reveal
a provable absolute Windows path. PowerShell commands are launched only
when the user confirms the exact command and supplies a matching native
root path. Commands execute as the signed-in Windows user, not sandboxed.

## Native Windows folder selection and permissions (v0.2.1)

In **AI Agent → Setup**, connect Local Agent first, then click
**Select local folder**. Windows opens the native folder-selection dialog.
After selecting a folder, the UI displays the actual absolute path returned
by the native Windows process and independently configurable checkboxes:

| Right | Effect |
|---|---|
| Read (R) | Browse and read files under the root |
| Create (C) | Create new files, without overwriting existing ones |
| Update (U) | Modify existing files after one-shot user confirmation |
| Delete (D) | Delete files after one-shot user confirmation |
| PowerShell (PS) | Permit executing individually approved commands with this exact root as cwd |

Grants are checked in the Local Agent, saved under
`%LOCALAPPDATA%\\ClusterPowerShell\\authorized-roots.json`, and can be
revoked with the UI. Paths are canonical Windows paths; relative traversal,
unselected roots and escaping symlinks are rejected.

The browser File System Access picker was removed: embedded iframes cannot
reliably invoke it and it cannot reveal an authoritative Windows absolute
path. This native picker requires a running Windows Local Agent in the
interactive user's session. Do not use it from headless service sessions.
The local agent itself is a high-trust component: only allow the trusted
Cluster website Origin and do not install untrusted same-origin plugins.

## CMD token messages (v0.6.1)

After MCP and/or OAuth processes **actually answer local health checks**,
`Start-Cluster-MCP.cmd` prints the active Local Agent pairing token (when
reachable), the MCP bearer token, and for OAuth mode the approval token and
ChatGPT MCP URL. Option 3's temporary Cloudflare Tunnel also prints these
messages after public issuer verification.

Token values are decrypted from DPAPI only for output to the local CMD
console. The reporter does not write secrets to repository files,
`logs/` or PRMU. Treat CMD screenshots and console logs as sensitive.
If verification fails, setup stops without reporting success.

## Security

- MCP and OAuth listeners are bound to `127.0.0.1` with dynamically
  selected ports. Listener state is recorded in the local user profile.
- Local PowerShell pairing, MCP bearer and OAuth approval secrets are
  DPAPI CurrentUser-protected. The browser has a separate opt-in encrypted
  IndexedDB cache, which is vulnerable to malicious same-origin scripts.
- OAuth uses PKCE S256, DCR, read/control scope isolation, issuer
  identification, audience/resource binding, expiry and revocation.
- Requests for sensitive actions fail closed if the browser Agent is offline,
  the directory is not selected, the local token is wrong, or user approval
  is denied or times out.
- The activity feed records request names, timestamps and status, but not
  actual commands, file content or secrets.
- These safeguards do not eliminate the risk of granting control-scope
  access to an untrusted client or installing an untrusted Cluster plugin.

## Validation and remaining steps

GitHub CI exercises 14 MCP JSON-RPC tool routes using a mock Local Agent,
OAuth registration, PKCE, scopes, issuer, resource binding, and revocation.
It also syntax-checks the browser bridge and verifies key permission
invariants.

**Still requiring Windows/browser/ChatGPT real-device E2E:** DPAPI
persistence and migration, node-pty build, Chrome private-network
permissions, File System Access roots, exact approval flow, OAuth HTTPS
reverse proxy, ChatGPT connector registration and full command output.

Do not mark production deployment validated until those checks pass.
