# Cluster-v3 Community Plugin Registry

This public repository is the **data source** for the Cluster-v3 Community.
The authoritative repository address and transport settings live in Cluster-v3's
**PRMU public repository**; the Cluster-v3 Community UI must never hardcode
individual plugin names, versions, folder locations or GitHub coordinates.

## Register or update a community plugin

1. Add one Folder package at `plugins/<plugin-id>/` containing a root
   `manifest.json` and its HTML/CSS/JS assets.
2. Add or update its entry in [community-index.json](community-index.json).
3. Match the entry's `id`, `version` and `directory` to its manifest
   (`directory` must be `plugins/<plugin-id>`).
4. Commit and refresh Cluster-v3 /plugin. Cards are generated from the index
   at runtime. Quick Install retrieves only the selected plugin's files.

No Host source code changes are needed when publishing additional plugins.

## Existing plugins

- `plugins/cluster.explorer/`: Explorer v2.4.0
- `plugins/cluster.text-editor/`: BasicTextEditor v2.9.0

Both are independent Folder packages. The embedded Editor module's nested
manifest was omitted to prevent treating that module as another plugin.

## Public API

Use `PRMU.getCommunityRepositoryUrl()` to read the unique source URL.
Use `PRMU.getCommunityConfig()` to read its URL, ref, index format, transport
endpoints, quotas and built-in example metadata. Generic equivalents:

- `PRMU.get("parameters", "community.repositoryUrl")`
- `PRMU.get("parameters", "community.config")`

These values are Host-owned and read-only; plugin code must not repeat them.

## Safety

Physical disk deletion and overwrite require explicit writable directory
authorization in a browser that supports the File System Access API.

## 2026-11-21 Plugin UI and storage update

- Editor File menu is bounded by viewport height and scrolls at high browser zoom.
- Workspace-only files prompt for a native save destination where supported.
- Explorer rows provide **Save to disk** for virtual files and folders; the folder
  action asks for a destination directory and writes its contained files.
- Existing authorized disk files keep direct overwrite behavior.
- The bottom **Cluster · Ln / Col** status bar spans the Explorer and Editor.
- These changes are limited to this initplugin repository; Cluster-v3 Host is
  not changed.
- CI regression checks: `node --test tests/plugin-regression.test.mjs`.

**Browser limitation:** Native directory/file pickers require a supported secure
context with user activation. If blocked, the operation reports the limitation
rather than claiming that physical disk storage succeeded. Folder export may
write into an existing directory of the same name; choose a separate location
when preserving existing files is important.

## 2026-11-21 Editor state / external-first update

- The shared footer now displays four status states:
  **green** synchronized, **yellow** pending / unsaved, **red** error and
  **blue** loading. Values represent operation state, not fake byte progress.
- File > Language opens an accessible Cluster-themed modal in six languages.
- File > Storage priority opens a modal with **Internal-first** (retain local
  buffer after native file changes) and **External-first** (replace the buffer
  with changed disk content, including discarding unsaved edits).
- Explorer's visible title, empty state, action labels and ARIA labels now
  follow the Host's shared language.
- Explorer persists its virtual file tree, expansion, selection, search and
  scroll position across reload. Editor persists tabs, content, cursor and
  per-tab scroll positions in a versioned browser-local workspace snapshot.
- The external file watcher checks only currently authorized disk directories.
  Reloaded roots are initially restored as **virtual snapshots**. For real
  disk reads/overwrites after reload, choose Open Folder again and reauthorize
  the same disk directory; it reconnects without discarding restored data.
- Editor and Explorer now save snapshots primarily in IndexedDB with a
  localStorage fallback; this avoids the smaller localStorage quota for large
  workspace content. If both browser stores are disabled, cleared or full,
  recovery cannot be guaranteed. Errors display as red status events.
- No Cluster-v3 Host source files were changed in this release.

### Release verification

The `Initplugin regression` GitHub Action checks manifests, JavaScript syntax,
embedded Editor parity, reload and cursor state handling, external priority
routing, modal structure and four-color progress states.
