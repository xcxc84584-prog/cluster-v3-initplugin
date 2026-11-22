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

Browser read operations use the active Editor document API and a user-picked
File System Access directory. File actions require the user to select a
directory and grant browser permission. Create, overwrite, delete and
PowerShell commands require **one-shot approval** in the Agent window.

`cluster.find_root_windows_path` returns a *user-confirmed* Windows
path, with `verified:false` because File System Access does not reveal
a provable absolute Windows path. PowerShell commands are launched only
when the user confirms the exact command and supplies a matching native
root path. Commands execute as the signed-in Windows user, not sandboxed.

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
