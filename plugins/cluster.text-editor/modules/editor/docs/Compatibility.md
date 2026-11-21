# File Access Compatibility

| Capability | Cluster-v3 opaque sandbox iframe | Standalone HTTPS/localhost Chrome/Edge |
|---|---|---|
| Read text selected with file input | Yes, user-selected | Yes |
| Modify text in editor | Yes | Yes |
| Save directly to disk with file handle | No reliable permission path | Supported after user permission |
| Save As with browser picker | Security restrictions | Supported in compatible browsers |
| Download via Blob URL | May be blocked (`allow-downloads` missing) | Generally supported |
| Copy all text | Browser clipboard policy dependent | Generally supported |
| Install plugin ZIP | Yes, by PMU | Not needed |

This plugin intentionally never bypasses browser permissions or assumes an undocumented Cluster file API.
