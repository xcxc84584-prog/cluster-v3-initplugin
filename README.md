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

- `plugins/cluster.explorer/`: Explorer v2.2.0
- `plugins/cluster.text-editor/`: BasicTextEditor v2.7.0

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
