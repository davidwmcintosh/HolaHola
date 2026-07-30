/**
 * GCS → S3 / Cloudflare R2 Migration Script
 *
 * Copies every object from the current GCS bucket (Replit sidecar or
 * service-account credentials) to an AWS S3 bucket or a Cloudflare R2 bucket.
 *
 * Usage:
 *   npx tsx server/scripts/migrate-gcs-to-s3.ts
 *
 * Required env vars:
 *   DEFAULT_OBJECT_STORAGE_BUCKET_ID   — source GCS bucket name
 *   AWS_S3_ACCESS_KEY_ID               — destination S3 / R2 access key
 *   AWS_S3_SECRET_ACCESS_KEY           — destination S3 / R2 secret key
 *   AWS_S3_REGION                      — region (use "auto" for R2)
 *   AWS_S3_DESTINATION_BUCKET          — destination bucket name
 *
 * Optional:
 *   GOOGLE_CLOUD_STORAGE_CREDENTIALS   — JSON service-account key for GCS source
 *                                        (if not set the Replit sidecar is used)
 *   AWS_S3_ENDPOINT                    — custom endpoint for R2 / MinIO
 *                                        e.g. https://<account-id>.r2.cloudflarestorage.com
 *
 * The script:
 *   1. Lists all objects in the GCS source bucket
 *   2. Downloads each object in-memory
 *   3. Uploads it to the S3 destination preserving content-type and custom metadata
 *   4. Skips objects that are already present with the same size (idempotent)
 *
 * Re-running is safe — existing objects in S3 with a matching size are skipped.
 * After migration, update your environment variables to the S3 backend and restart.
 */

import { Storage } from "@google-cloud/storage";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

// ---------------------------------------------------------------------------
// Config from environment
// ---------------------------------------------------------------------------

const SOURCE_BUCKET = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "";
const DEST_BUCKET = process.env.AWS_S3_DESTINATION_BUCKET || "";
const DEST_ACCESS_KEY = process.env.AWS_S3_ACCESS_KEY_ID || "";
const DEST_SECRET_KEY = process.env.AWS_S3_SECRET_ACCESS_KEY || "";
const DEST_REGION = process.env.AWS_S3_REGION || "";
const DEST_ENDPOINT = process.env.AWS_S3_ENDPOINT || "";
const GCS_CREDENTIALS_JSON = process.env.GOOGLE_CLOUD_STORAGE_CREDENTIALS || "";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// ---------------------------------------------------------------------------
// Client factories
// ---------------------------------------------------------------------------

function createSourceGcs(): Storage {
  if (GCS_CREDENTIALS_JSON) {
    try {
      const credentials = JSON.parse(GCS_CREDENTIALS_JSON);
      return new Storage({
        credentials,
        projectId: credentials.project_id || "",
      });
    } catch {
      console.warn(
        "[migrate] Could not parse GOOGLE_CLOUD_STORAGE_CREDENTIALS — " +
          "falling back to Replit sidecar."
      );
    }
  }

  // Replit sidecar (must be run inside the Replit environment)
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

function createDestS3(): S3Client {
  const config: ConstructorParameters<typeof S3Client>[0] = {
    region: DEST_REGION,
    credentials: {
      accessKeyId: DEST_ACCESS_KEY,
      secretAccessKey: DEST_SECRET_KEY,
    },
  };
  if (DEST_ENDPOINT) {
    config.endpoint = DEST_ENDPOINT;
    config.forcePathStyle = true;
  }
  return new S3Client(config);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the object's byte size in S3, or null if it does not exist. */
async function s3ObjectSize(
  s3: S3Client,
  bucket: string,
  key: string
): Promise<number | null> {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return head.ContentLength ?? null;
  } catch (err: any) {
    if (
      err.name === "NotFound" ||
      err.name === "NoSuchKey" ||
      err.$metadata?.httpStatusCode === 404
    ) {
      return null;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Validate required env vars
  const missing: string[] = [];
  if (!SOURCE_BUCKET) missing.push("DEFAULT_OBJECT_STORAGE_BUCKET_ID");
  if (!DEST_BUCKET)   missing.push("AWS_S3_DESTINATION_BUCKET");
  if (!DEST_ACCESS_KEY) missing.push("AWS_S3_ACCESS_KEY_ID");
  if (!DEST_SECRET_KEY) missing.push("AWS_S3_SECRET_ACCESS_KEY");
  if (!DEST_REGION) missing.push("AWS_S3_REGION");

  if (missing.length > 0) {
    console.error("ERROR: Missing required environment variables:");
    for (const v of missing) console.error(`  ${v}`);
    process.exit(1);
  }

  console.log("GCS → S3 / R2 Migration");
  console.log("========================");
  console.log(`Source GCS bucket : ${SOURCE_BUCKET}`);
  console.log(`Destination bucket: ${DEST_BUCKET}`);
  console.log(`Destination region: ${DEST_REGION}`);
  if (DEST_ENDPOINT) console.log(`Custom endpoint   : ${DEST_ENDPOINT}`);
  console.log("");

  const gcs = createSourceGcs();
  const s3 = createDestS3();

  const srcBucket = gcs.bucket(SOURCE_BUCKET);

  console.log("Listing source objects from GCS...");
  const [files] = await srcBucket.getFiles();
  console.log(`Found ${files.length} object(s) to migrate.\n`);

  let copied = 0;
  let skipped = 0;
  let failed = 0;

  for (const srcFile of files) {
    const key = srcFile.name;
    try {
      // Fetch GCS metadata
      const [gcsMetadata] = await srcFile.getMetadata();
      const contentType =
        (gcsMetadata.contentType as string) || "application/octet-stream";
      const gcsSize = parseInt(String(gcsMetadata.size ?? "0"), 10);

      // Check if already present in S3 with same size → skip
      const existingSize = await s3ObjectSize(s3, DEST_BUCKET, key);
      if (existingSize !== null && existingSize === gcsSize) {
        skipped++;
        if (skipped <= 5 || skipped % 50 === 0) {
          console.log(`  SKIP (already present): ${key}`);
        }
        continue;
      }

      // Download from GCS
      const [data] = await srcFile.download();

      // Gather custom metadata (preserves ACL policy and any other tags)
      const customMeta = (gcsMetadata.metadata as Record<string, string>) ?? {};

      // Upload to S3
      await s3.send(
        new PutObjectCommand({
          Bucket: DEST_BUCKET,
          Key: key,
          Body: data,
          ContentType: contentType,
          Metadata: customMeta,
        })
      );

      copied++;
      if (copied % 10 === 0 || copied + skipped + failed === files.length) {
        console.log(`  Copied ${copied}/${files.length}: ${key}`);
      }
    } catch (err: any) {
      failed++;
      console.error(`  FAILED: ${key} — ${err.message}`);
    }
  }

  console.log(
    `\n✅ Migration complete: ${copied} copied, ${skipped} skipped, ${failed} failed`
  );

  if (failed > 0) {
    console.log(
      "\nRe-run the script to retry failed objects — already-migrated objects are skipped."
    );
    process.exit(1);
  }

  console.log("\nNext steps:");
  console.log("  1. Set the following environment secrets:");
  console.log(`     AWS_S3_ACCESS_KEY_ID     = (your key)`);
  console.log(`     AWS_S3_SECRET_ACCESS_KEY = (your secret)`);
  console.log(`     AWS_S3_REGION            = ${DEST_REGION}`);
  if (DEST_ENDPOINT) {
    console.log(`     AWS_S3_ENDPOINT          = ${DEST_ENDPOINT}`);
  }
  console.log(
    `     PUBLIC_OBJECT_SEARCH_PATHS and PRIVATE_OBJECT_DIR stay the same` +
      ` — just point them at the new bucket name if it changed.`
  );
  console.log("  2. Unset GOOGLE_CLOUD_STORAGE_CREDENTIALS (or leave it — S3 takes priority)");
  console.log("  3. Restart the server");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
