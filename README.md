# Cluster-v3 Initial Plugins

This repository is a **folder-format Cluster-v3 plugin project** (not a ZIP-only repository).

- `plugins/cluster.explorer/` — Explorer v2.1.0 (`manifest.json` at its package root)
- `plugins/cluster.text-editor/` — BasicTextEditor v2.6.0 (`manifest.json` at its package root)

## Direct GitHub import

In Cluster-v3 open **Project Repository → Connect GitHub Repository**, then enter:

`https://github.com/xcxc84584-prog/cluster-v3-initplugin`

The project loader discovers the two `plugins/<id>/manifest.json` files. The editor's nested `modules/editor/manifest.json` was omitted from this folder distribution because it describes an embedded module (with the same plugin ID) and would otherwise be mistaken for a third plugin.

## Safety

On-disk deletion is available only for entries under a writable directory selected and explicitly authorized by the user in a compatible secure browser. Deletion may be permanent and recursive. Use a disposable folder for first tests. This repository has not been verified through end-to-end Host GitHub import.
