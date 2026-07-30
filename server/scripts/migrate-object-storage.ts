/**
 * DEPRECATED — GCS-to-GCS migration script (Replit sidecar era)
 *
 * This script copied objects between GCS buckets using the Replit sidecar
 * (port 1106) for source credentials.  The sidecar is retired and R2 is now
 * the sole active storage backend.  This script is kept for historical
 * reference only and MUST NOT be run — the sidecar endpoint no longer exists
 * so the source storage client will fail immediately on any real call.
 *
 * To migrate data between storage backends today, use:
 *   server/scripts/migrate-gcs-to-s3.ts  (requires explicit service-account key)
 */

console.error(
  "ERROR: migrate-object-storage.ts is retired.\n" +
  "The Replit GCS sidecar (port 1106) no longer exists.\n" +
  "Use migrate-gcs-to-s3.ts if you need to move objects into R2.",
);
process.exit(1);
