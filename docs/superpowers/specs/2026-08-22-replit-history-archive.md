# Protected Replit History Archive

## Purpose

The approved GitHub release is a non-force source snapshot, not a transport for
the historic Replit object graph. That graph contains an ordinary Git blob that
GitHub refuses by size, so GitHub `main` must never be used as the only copy of
the original histories.

The configured private S3-compatible object store is the durable
off-workspace archive for this evidence. The immutable archive objects are
rooted under:

```text
history-archives/reconciliation-2026-08-21/
```

The archive command may create a missing object or accept an existing object
only when its byte count and SHA-256 metadata match. It fails rather than
overwriting different archive content.

## Contents

The archive contains these historical source anchors:

| Source | Local protected tag | Required commit |
| --- | --- | --- |
| Original Replit main | `reconciliation/replit-main-2026-08-21` | `b88ac3304f29d1374359f11fbb16b5fc6771fde6` |
| Original GitHub main | `reconciliation/github-main-2026-08-21` | `37ed5a85d3527f66b805c2212598793676b2752e` |

It also contains the backup and reconciliation lineage tips, plus the nearest
two-parent merge behind each reconciliation tip. This makes the
complete-history, LFS-migration, LFS-release, and final live-release
reconciliation decisions independently addressable in the manifest.

The archive manifest is stored beside the bundle at:

```text
history-archives/reconciliation-2026-08-21/manifest.txt
```

Its `manifest.txt` records every archived ref and object ID (and the peeled
commit for annotated tags), the explicit two-parent merge relationships, and
the SHA-256 of the pre-push portable bundle used to validate the archive input.

## Creating or rechecking the archive

From a checkout that still has the protected local refs:

```bash
bash scripts/archive-reconciliation-history.sh
```

The command:

1. rejects moved source tags and missing source/reconciliation refs;
2. creates and validates a portable Git bundle;
3. runs strict Git-object and LFS-pointer validation;
4. multipart-uploads the bundle and manifest only when no conflicting object
   already exists at their archive keys;
5. downloads those durable objects into a fresh temporary directory, verifies
   their SHA-256 values, and runs `git bundle verify` plus
   `git fsck --full --strict` against an isolated bare recovery clone.

To revalidate a completed archive without creating or changing refs:

```bash
bash scripts/archive-reconciliation-history.sh --verify
```

For an intentional disaster-recovery copy, set
`RECONCILIATION_ARCHIVE_BUCKET` and/or `RECONCILIATION_ARCHIVE_PREFIX` to a
separately configured private bucket/prefix. The default bucket is the active
project object-storage bucket and the default prefix is the path above.

To replicate the completed archive to a separately administered account, set
the independent account's values in `RECONCILIATION_REPLICA_BUCKET`,
`RECONCILIATION_REPLICA_ACCESS_KEY_ID`,
`RECONCILIATION_REPLICA_SECRET_ACCESS_KEY`, and
`RECONCILIATION_REPLICA_REGION`. Set
`RECONCILIATION_REPLICA_ENDPOINT` for an S3-compatible provider and optionally
set `RECONCILIATION_REPLICA_ACCOUNT_LABEL` for the credential-free receipt.
For Cloudflare R2, the endpoint is the account's R2 S3 endpoint; the command
accepts an R2 dashboard location label such as `Eastern North America (ENAM)`
and sends the S3 API's required `auto` region.
The replica uses the same prefix by default so the copied manifest remains
byte-for-byte unchanged. The command rejects reuse of the primary access key,
the exact primary bucket/endpoint, or a different prefix.

```bash
bash scripts/archive-reconciliation-history.sh --replicate
```

The command downloads and verifies the primary bundle and manifest, uploads
both unchanged to the replica, downloads them again from the replica, compares
SHA-256 and byte counts, and stores a
`history-archives/reconciliation-2026-08-21/replication-receipt.txt` beside the
replica objects. The receipt records locations, checksums, and verification
status; it never records bucket credentials.

## Safe recovery procedure

Recovery restores evidence into a fresh clone or a separate recovery
namespace. It never force-pushes, resets, merges into, or overwrites GitHub
`main`.

```bash
# Download from the primary recovery location performs an object-store metadata
# and SHA-256 check.
npx tsx scripts/reconciliation-history-object-storage.ts download ./recovery-input

# Verify the downloaded bundle and materialize it as an isolated bare clone.
git bundle verify ./recovery-input/reconciliation-2026-08-21.bundle
git clone --bare ./recovery-input/reconciliation-2026-08-21.bundle ./recovered.git
git -C ./recovered.git fsck --full --strict --no-reflogs

# Make local, clearly named evidence branches if investigation requires them.
git -C ./recovered.git branch recovery/replit-main \
  refs/tags/reconciliation/replit-main-2026-08-21
git -C ./recovered.git branch recovery/github-main \
  refs/tags/reconciliation/github-main-2026-08-21
```

For the independent replica, configure its `RECONCILIATION_REPLICA_*` values
and use the replica-specific download command, or use the
`replication-receipt.txt` to identify the verified replica location.
Both recovery locations are evidence archives; neither authorizes changing
GitHub `main`.

```bash
npx tsx scripts/reconciliation-history-object-storage.ts download-replica ./replica-input
```

`manifest.txt` records the two-parent reconciliation commit IDs and their
parents; use `git -C ./recovered.git show --no-patch --format=raw <merge-id>`
to inspect them. If a future source release needs material from this history,
build a new reviewed commit or a new branch from the recovery ref; do **not**
force-push it to `github/main`.