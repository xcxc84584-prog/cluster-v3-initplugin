# Cluster Text Editor ↔ Explorer API v1.0.0

## Transport and trust

All requests must pass through **Cluster-v3 Host Router**. An Explorer plugin
must never directly access another plugin iframe or its DOM. The Host routes
requests to the editor frame as `postMessage` with `event.source === parent`;
the editor responds to that Host. **The current Host does not yet implement
routing for this protocol**. This package implements the editor endpoint and
contract; Host-side routing / capabilities are a separate integration step.

Protocol: `cluster.editor.v1`; request `type=req`, response `type=rep`,
notification `type=event`; `version=1.0.0`; `sourcePlugin=cluster.text-editor`.
Every request needs a unique string `requestId`, and `params` (JSON object).

```json
{"protocol":"cluster.editor.v1","type":"req","version":"1.0.0","requestId":"req-001","action":"document.open","params":{"name":"a.md","path":"/notes/a.md","content":"Hello"}}
```

```json
{"protocol":"cluster.editor.v1","type":"rep","version":"1.0.0","sourcePlugin":"cluster.text-editor","requestId":"req-001","ok":true,"status":200,"data":{"document":{"id":"2","name":"a.md","path":"/notes/a.md","dirty":false,"revision":2,"active":true,"length":5}},"error":null}
```

### Actions

| Action | Params | Response | Notes |
|---|---|---|---|
| `editor.capabilities` | `{}` | protocol, maxFileBytes, actions, eventNames, persistence | Discovery |
| `tabs.list` | `{}` | `{activeId,tabs[]}` | Metadata, no contents |
| `tabs.activate` | `{id}` | `{document}` | Switch active tab |
| `document.open` | `{name,path?,content}` | `{document}` | New memory tab. Duplicate path → 409 |
| `document.get` | `{id}` | `{document,content}` | Full text read |
| `document.update` | `{id,content,expectedRevision}` | `{document}` | MVCC compare-and-set; 409 conflict |
| `document.close` | `{id,discardChanges?}` | `{id}` | Dirty tabs require explicit `discardChanges:true` |

### Events

`document.opened`, `document.changed`, `document.saved`, `document.closed`,
`tab.activated`. Events have `protocol`, `type=event`, `version`,
`sourcePlugin`, `event`, and `data` fields. The Host must subscribe and
forward only to authorized consumers.

### Persistence and security

This is **memory-only** RPC. `document.open` does not access the filesystem,
`document.update` does not save to disk, and no API returns a file handle.
The Explorer remains responsible for file loading, authorized persistence,
path normalization and optional synchronization. The Host must authenticate
requesting plugins, check per-action permission and target identity, enforce
size/rate limits, and handle subscriptions/unload. The editor checks protocol,
revision and payload size, but receiving a Host message is *not* a replacement
for Host-side authorization. A save event means only the existing native
file-handle path succeeded, not that an Explorer persistence RPC occurred.

## Public Repository plugin URL

The editor reads `pluginSiteUrl` from `cluster.plugin.v1` context or
`cluster.settings.context.v1`, populated by Host
`publicRepository.getPluginSiteUrl()`. It never imports Host internals.
Without context, it can derive the owner site from a valid referrer. If
navigation is blocked by browser sandbox policy, a warning is shown.

## Plugin Manager API List registration (v1.3.1)

The plugin now registers all seven actions with `Router.register` and JSON
contracts via the standard `cluster.plugin.v1` Host bridge. The Cluster-v3
Host must refresh the API view after successful registration. The old
`cluster.editor.v1` request/response endpoint remains for compatibility.

```js
const result = await Cluster.Router.request('cluster.text-editor',
  'document.open', {name:'notes.md', path:'/notes.md', content:'# Notes'});
```
