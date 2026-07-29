/**
 * Object Storage Migration Script
 *
 * Copies all objects from the current Replit GCS bucket to a new GCS bucket
 * that uses standard service-account credentials (not the Replit sidecar).
 *
 * Usage:
 *   npx tsx server/scripts/migrate-object-storage.ts
 *
 * Required env vars (set these before running):
 *   DEFAULT_OBJECT_STORAGE_BUCKET_ID   — source bucket name (Replit bucket)
 *   GOOGLE_CLOUD_STORAGE_CREDENTIALS   — JSON service-account key for the destination
 *   DESTINATION_BUCKET_ID              — destination bucket name
 *
 * The script streams each object from the source bucket to the destination
 * bucket, preserving the object path, content-type, and custom metadata.
 *
 * Run from the Replit environment where the Replit sidecar is still accessible
 * so the source bucket credentials resolve correctly.
 */

import { Storage } from "@google-cloud/storage";

const SOURCE_BUCKET = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "";
const DEST_BUCKET = process.env.DESTINATION_BUCKET_ID || "";
const DEST_CREDENTIALS_JSON = process.env.GOOGLE_CLOUD_STORAGE_CREDENTIALS || "";
const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

function createSourceStorage(): Storage {
  // On Replit, the sidecar provides credentials automatically.
  return new Storage({
    credentials: {
      audience: "replit",
      subject_token_type: "access_token",
      token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
      type: "external_account",
      credential_source: {
        url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
        format: {
          type: "json",
          subject_token_field_name: "access_token",
        },
      },
      universe_domain: "googleapis.com",
    } as any,
    projectId: "",
  });
}

function createDestStorage(): Storage {
  if (!DEST_CREDENTIALS_JSON) {
    throw new Error("GOOGLE_CLOUD_STORAGE_CREDENTIALS must be set for destination");
  }
  const credentials = JSON.parse(DEST_CREDENTIALS_JSON);
  return new Storage({
    credentials,
    projectId: credentials.project_id || "",
  });
}

async function main() {
  if (!SOURCE_BUCKET) {
    console.error("ERROR: DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
    process.exit(1);
  }
  if (!DEST_BUCKET) {
    console.error("ERROR: DESTINATION_BUCKET_ID not set");
    process.exit(1);
  }
  if (!DEST_CREDENTIALS_JSON) {
    console.error("ERROR: GOOGLE_CLOUD_STORAGE_CREDENTIALS not set");
    process.exit(1);
  }

  console.log(`Source bucket : ${SOURCE_BUCKET}`);
  console.log(`Destination   : ${DEST_BUCKET}`);
  console.log("");

  const srcStorage = createSourceStorage();
  const dstStorage = createDestStorage();

  const srcBucket = srcStorage.bucket(SOURCE_BUCKET);
  const dstBucket = dstStorage.bucket(DEST_BUCKET);

  // List all objects in source bucket
  console.log("Listing source objects...");
  const [files] = await srcBucket.getFiles();
  console.log(`Found ${files.length} objects to copy.\n`);

  let copied = 0;
  let failed = 0;

  for (const srcFile of files) {
    const objectName = srcFile.name;
    try {
      // Download from source
      const [metadata] = await srcFile.getMetadata();
      const [data] = await srcFile.download();

      // Upload to destination preserving content-type and custom metadata
      const dstFile = dstBucket.file(objectName);
      await dstFile.save(data, {
        contentType: (metadata.contentType as string) || "application/octet-stream",
        metadata: metadata.metadata || {},
      });

      copied++;
      if (copied % 10 === 0 || copied === files.length) {
        console.log(`  Copied ${copied}/${files.length}: ${objectName}`);
      }
    } catch (err: any) {
      failed++;
      console.error(`  FAILED: ${objectName} — ${err.message}`);
    }
  }

  console.log(`\n✅ Migration complete: ${copied} copied, ${failed} failed`);

  if (failed > 0) {
    console.log("\nRe-run the script to retry failed objects (already-copied objects will overwrite safely).");
    process.exit(1);
  }

  console.log("\nNext steps:");
  console.log("  1. Set GOOGLE_CLOUD_STORAGE_CREDENTIALS in your environment secrets");
  console.log(`  2. Set DEFAULT_OBJECT_STORAGE_BUCKET_ID=${DEST_BUCKET}`);
  console.log("  3. Update PUBLIC_OBJECT_SEARCH_PATHS and PRIVATE_OBJECT_DIR to use the new bucket name");
  console.log("  4. Restart the server");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
