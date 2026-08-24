# Maintenance archive and recovery

Large source PDFs, ZIP working sets, and the historical source bundle are kept
outside the deployment checkout in private object storage. Their exact paths,
sizes, object keys, and SHA-256 hashes are recorded in
`docs/maintenance-archive-manifest.json`.

## Safety model

- The archive uploader is immutable: it reuses an object only when its source
  path, size, and checksum metadata match exactly. It never overwrites a
  different object.
- Local materials are removed only after `verify` downloads every archived
  object and checks its SHA-256 hash.
- The manifest is both checked into source and uploaded last to the private
  archive, so it describes only a complete archive set.

## Operations

Run these commands from the project root:

```bash
npx tsx scripts/archive-maintenance-assets.ts inventory
npx tsx scripts/archive-maintenance-assets.ts upload
npx tsx scripts/archive-maintenance-assets.ts verify
npx tsx scripts/archive-maintenance-assets.ts fetch <source-path> <destination>
```

`upload` is resumable. If an object exists with different bytes or metadata, it
fails instead of replacing the existing archive.

The Madrigal scan maintenance command automatically materializes its two source
PDFs from this private archive when they are absent locally:

```bash
npx tsx server/scripts/upload-madrigal-scans.ts
```

The archive is for maintenance material only. Runtime frontend assets remain in
the repository and must not be added to this manifest without a separate
consumer and recovery review.