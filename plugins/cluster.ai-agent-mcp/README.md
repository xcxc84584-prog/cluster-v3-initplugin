# Cluster AI Agent MCP — initial v3 migration

Source baseline: https://github.com/xcxc84584-prog/ClusterOpt2/tree/main/Implementation/plugins/ai-agent-mcp

## Implemented in v0.1.0

- Tool → AI Agent MCP opens in the existing unified workspace Tab bar.
- The child sidebar is toggled by clicking its divider; dragging resizes it,
  double-click resets its width; keyboard navigation is supported.
- The sidebar's position is persisted separately from credentials.
- Six UI languages and PRMU-provided palette colors are supported.
- The plugin pairs with the existing ClusterPowerShell Local Agent.
- It can request the PRMU-generated Local Agent setup CMD.
- Authenticated health and activity requests retrieve actual bounded
  PowerShell activity metadata from the local agent. Raw command contents,
  terminal outputs, file contents and secrets are not logged.
- No chat composer: only real AI/PowerShell activity and status.
- Opt-in long-term browser token memory uses nonextractable AES-GCM key
  material stored in IndexedDB; browser pairing can be cleared.
- Windows Local Agent pairing credential uses DPAPI CurrentUser.
- Ctrl+C with selected terminal text copies; otherwise it interrupts the PTY.

## NOT implemented yet

ClusterOpt2 exposes 14 legacy MCP tools, but those depend on HubUnit,
Host ToolBox and other trusted Host objects missing from the Cluster-v3
public Router. The 14 names are shown as a disabled catalog ONLY:

get_status, get_task_status, list_files, get_editor_state, read_file,
list_roots, find_root_windows_path, list_directory, read_path, create_file,
write_path, delete_path, open_powershell, powershell_request.

No version of these tools is actually registered with a working MCP gateway
or authorized by this plugin yet. There is no ChatGPT OAuth endpoint or
public HTTPS gateway in this initial integration. This is a partial
implementation and must NOT be represented as complete MCP migration.

## Next implementation gates

1. v3 Router adapters for real Editor and Explorer public APIs.
2. Separate permissions for read/create/update/delete and per-command
   PowerShell user confirmation before allowing dangerous actions.
3. OAuth 2.1 with PKCE and HTTPS issuer validation; a separate locally
   restricted MCP gateway; scopes cluster.read and cluster.control.
4. E2E tests of all 14 tools, authorization/revocation, Windows node-pty,
   ChatGPT OAuth connectivity and failure modes.

No modification to the Cluster-v3 Host repository is needed for the UI.
Whether complete legacy tool parity is possible without Host changes must
be verified against its published Router contract.

## Security limitations

Browser-side encryption does not protect against malicious scripts from the
same browser origin. Use only trusted plugins and machines. Credentials are
never placed in PRMU or a public source file. The authoritative Windows
pairing token persists encrypted with the Windows user's DPAPI key.
Clearing the browser pairing does not revoke the Windows credential.
The local agent must be restarted or explicitly rotated to revoke it.
Activity entries are intentionally metadata-only and are cleared on restart.
