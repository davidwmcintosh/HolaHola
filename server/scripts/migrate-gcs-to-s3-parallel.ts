/**
 * Parallel GCS → S3 / Cloudflare R2 Migration
 *
 * Same as migrate-gcs-to-s3.ts but uses CONCURRENCY parallel workers
 * so the full 17k-object bucket finishes in one session instead of hours.
 *
 * Usage: npx tsx server/scripts/migrate-gcs-to-s3-parallel.ts
 *
 * Env vars: same as migrate-gcs-to-s3.ts
 */
import { Storage } from "@google-cloud/storage";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

const SOURCE_BUCKET   = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "";
const DEST_BUCKET     = process.env.AWS_S3_DESTINATION_BUCKET || "";
const DEST_ACCESS_KEY = process.env.AWS_S3_ACCESS_KEY_ID || "";
const DEST_SECRET_KEY = process.env.AWS_S3_SECRET_ACCESS_KEY || "";
const DEST_REGION     = process.env.AWS_S3_REGION || "";
const DEST_ENDPOINT   = process.env.AWS_S3_ENDPOINT || "";
const GCS_CREDS_JSON  = process.env.GOOGLE_CLOUD_STORAGE_CREDENTIALS || "";
const CONCURRENCY     = parseInt(process.env.MIGRATION_CONCURRENCY || "20", 10);

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

function createSourceGcs(): Storage {
  if (GCS_CREDS_JSON) {
    try {
      const credentials = JSON.parse(GCS_CREDS_JSON);
      return new Storage({ credentials, projectId: credentials.project_id || "" });
    } catch {
      console.warn("[migrate] Could not parse GOOGLE_CLOUD_STORAGE_CREDENTIALS — using sidecar");
    }
  }
  return new Storage({
    credentials: {
      audience: "replit",
      subject_token_type: "access_token",
      token_url: "http://127.0.0.1:1106/token",
      type: "external_account",
      credential_source: {
        url: "http://127.0.0.1:1106/credential",
        format: { type: "json", subject_token_field_name: "access_token" },
      },
      universe_domain: "googleapis.com",
    } as any,
    projectId: "",
  });
}

function createDestS3(): S3Client {
  const config: ConstructorParameters<typeof S3Client>[0] = {
    region: DEST_REGION,
    credentials: { accessKeyId: DEST_ACCESS_KEY, secretAccessKey: DEST_SECRET_KEY },
  };
  if (DEST_ENDPOINT) {
    config.endpoint = DEST_ENDPOINT;
    config.forcePathStyle = true;
  }
  return new S3Client(config);
}

async function s3ObjectSize(s3: S3Client, key: string): Promise<number | null> {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: DEST_BUCKET, Key: key }));
    return head.ContentLength ?? null;
  } catch (err: any) {
    if (
      err.name === "NotFound" ||
      err.name === "NoSuchKey" ||
      err.$metadata?.httpStatusCode === 404
    ) return null;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Concurrency pool
// ---------------------------------------------------------------------------

async function runPool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const missing: string[] = [];
  if (!SOURCE_BUCKET)   missing.push("DEFAULT_OBJECT_STORAGE_BUCKET_ID");
  if (!DEST_BUCKET)     missing.push("AWS_S3_DESTINATION_BUCKET");
  if (!DEST_ACCESS_KEY) missing.push("AWS_S3_ACCESS_KEY_ID");
  if (!DEST_SECRET_KEY) missing.push("AWS_S3_SECRET_ACCESS_KEY");
  if (!DEST_REGION)     missing.push("AWS_S3_REGION");
  if (missing.length > 0) {
    console.error("ERROR: Missing required env vars:", missing.join(", "));
    process.exit(1);
  }

  console.log("GCS → R2 Parallel Migration");
  console.log("===========================");
  console.log(`Source  : ${SOURCE_BUCKET}`);
  console.log(`Dest    : ${DEST_BUCKET}`);
  console.log(`Region  : ${DEST_REGION}`);
  if (DEST_ENDPOINT) console.log(`Endpoint: ${DEST_ENDPOINT}`);
  console.log(`Workers : ${CONCURRENCY}`);
  console.log("");

  const gcs = createSourceGcs();
  const s3  = createDestS3();

  console.log("Listing source objects from GCS...");
  const [files] = await gcs.bucket(SOURCE_BUCKET).getFiles();
  console.log(`Found ${files.length} objects.\n`);

  let copied = 0, skipped = 0, failed = 0;
  const total    = files.length;
  const startMs  = Date.now();

  await runPool(files, CONCURRENCY, async (srcFile) => {
    const key = srcFile.name;
    try {
      const [meta] = await srcFile.getMetadata();
      const contentType = (meta.contentType as string) || "application/octet-stream";
      const gcsSize     = parseInt(String(meta.size ?? "0"), 10);

      const existingSize = await s3ObjectSize(s3, key);
      if (existingSize !== null && existingSize === gcsSize) {
        skipped++;
        return;
      }

      const [data]     = await srcFile.download();
      const customMeta = (meta.metadata as Record<string, string>) ?? {};

      await s3.send(new PutObjectCommand({
        Bucket:      DEST_BUCKET,
        Key:         key,
        Body:        data,
        ContentType: contentType,
        Metadata:    customMeta,
      }));

      copied++;
      const done    = copied + skipped + failed;
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(0);
      if (copied % 200 === 0 || done === total) {
        const rate = (done / ((Date.now() - startMs) / 60000)).toFixed(0);
        const eta  = Math.round((total - done) / parseFloat(rate));
        console.log(
          `  [${elapsed}s] ${done}/${total} — ${copied} copied, ${skipped} skipped` +
          ` @ ${rate}/min (ETA ~${eta}min)`,
        );
      }
    } catch (err: any) {
      failed++;
      console.error(`  FAILED: ${key} — ${err.message}`);
    }
  });

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`\n✅ Done in ${elapsed}s: ${copied} copied, ${skipped} skipped, ${failed} failed`);

  if (failed > 0) {
    console.log("Re-run to retry failed objects — already-migrated objects are skipped.");
    process.exit(1);
  }
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
