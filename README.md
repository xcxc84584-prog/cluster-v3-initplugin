# Cluster-v3 Initial Plugins

This repository contains two independently installable Cluster-v3 plugin ZIP archives:

- `Cluster-v3-Explorer-v2.1.0-Real-Delete.zip` — Explorer (`cluster.explorer`).
- `Cluster-v3-BasicTextEditor-v2.6.0-Real-Delete.zip` — BasicTextEditor (`cluster.text-editor`).

## Load from GitHub

In Cluster-v3, open **Project Repository → Connect GitHub Repository** and enter:

`https://github.com/xcxc84584-prog/cluster-v3-initplugin`

The Cluster-v3 GitHub importer recognizes each `.zip` file as an independent plugin package, validates its root `manifest.json`, and loads the two plugins. Do not unzip the Editor archive into the repository: it includes an internal module manifest which is not a separate plugin.

## Safety

Actual on-disk deletion requires a compatible secure browser context and an explicitly granted writable directory handle. Unloading a root is not the same as deleting it. Test with a disposable directory first.
