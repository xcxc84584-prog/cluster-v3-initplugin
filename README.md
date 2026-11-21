# Cluster-v3 initial plugins (Folder distribution)

Load both plugins using Cluster-v3 **Project Repository → Connect GitHub Repository**:

https://github.com/xcxc84584-prog/cluster-v3-initplugin

- `plugins/cluster.explorer/`: Explorer v2.2.0
- `plugins/cluster.text-editor/`: BasicTextEditor v2.7.0

Each folder contains its own root `manifest.json`. The embedded editor module's nested manifest is omitted to avoid a duplicate plugin during project discovery.

**Disk deletion requires explicit writable directory authorization.**
