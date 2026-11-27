# init_cluster

Release authority for the official plugin collection. Edit collection.json only; collectionVersion is the release version and is also projected into this package manifest. Each entry has independent initialize and community booleans. All current official plugins default to both true. The authority package is not automatically installed or listed in its own catalog; it can be imported manually for inspection. The host reads the data before executing any plugin. The root community-index.json and collection-view.js are generated compatibility projections, never independent sources of truth.

Run node scripts/publish-collection.mjs after editing the collection. Increment collectionVersion whenever publishing a changed collection or plugin release. The publisher verifies plugin manifests and writes the projections. CI verifies the generated files.
