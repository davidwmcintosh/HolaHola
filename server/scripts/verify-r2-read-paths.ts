/**
 * verify-r2-read-paths.ts
 *
 * Confirms that the student-facing image and voice-note read paths actually
 * work end-to-end against R2 — not just the startup PUT/HEAD/DELETE probe.
 *
 * Tests:
 *   1. List real objects in public/ai-images/  → pick one → GET /api/media/ai-image/:filename
 *   2. List real objects in public/voice-messages/ → pick one → GET /api/media/vm-audio/:filename
 *   3. Report HTTP status, content-type, and byte count for each
 *
 * Usage:
 *   npx tsx server/scripts/verify-r2-read-paths.ts
 *
 * Requires the server to be running (uses $REPLIT_DEV_DOMAIN or localhost:5000).
 */

import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BUCKET = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "";
const REGION = process.env.AWS_S3_REGION || "auto";
const ENDPOINT = process.env.AWS_S3_ENDPOINT || "";
const ACCESS_KEY = process.env.AWS_S3_ACCESS_KEY_ID || "";
const SECRET_KEY = process.env.AWS_S3_SECRET_ACCESS_KEY || "";

// HTTP base for app-route tests (server must be running).
// When running from a shell script on Replit the Replit dev-domain proxy is not
// reachable — use localhost directly.  Override with APP_BASE env var if needed.
const APP_BASE =
  process.env.APP_BASE ||
  "http://localhost:5000";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeS3(): S3Client {
  const config: ConstructorParameters<typeof S3Client>[0] = {
    region: REGION,
    credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  };
  if (ENDPOINT) {
    config.endpoint = ENDPOINT;
    config.forcePathStyle = true;
  }
  return new S3Client(config);
}

async function listPrefix(s3: S3Client, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const resp = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        MaxKeys: 20,
        ContinuationToken: token,
      })
    );
    for (const obj of resp.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    token = resp.NextContinuationToken;
  } while (token && keys.length < 20);
  return keys;
}

/** Download an object directly from R2 using the S3 client and measure bytes. */
async function directR2Download(
  s3: S3Client,
  key: string
): Promise<{ bytes: number; contentType: string }> {
  const resp = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key })
  );
  const contentType = resp.ContentType ?? "unknown";
  let bytes = 0;
  if (resp.Body) {
    for await (const chunk of resp.Body as AsyncIterable<Uint8Array>) {
      bytes += chunk.length;
    }
  }
  return { bytes, contentType };
}

/** Hit the app's HTTP proxy route and measure the response. */
async function appRouteGet(
  url: string
): Promise<{ status: number; contentType: string; bytes: number }> {
  const resp = await fetch(url);
  const contentType = resp.headers.get("content-type") ?? "unknown";
  const buf = await resp.arrayBuffer();
  return { status: resp.status, contentType, bytes: buf.byteLength };
}

// ---------------------------------------------------------------------------
// Section runner
// ---------------------------------------------------------------------------

type CheckResult = {
  label: string;
  key: string;
  directBytes: number;
  directContentType: string;
  appStatus: number;
  appContentType: string;
  appBytes: number;
  pass: boolean;
  note: string;
};

async function checkPrefix(
  s3: S3Client,
  prefix: string,
  routeBuilder: (filename: string) => string,
  label: string
): Promise<CheckResult | null> {
  const keys = await listPrefix(s3, prefix);
  if (keys.length === 0) {
    console.log(`  [${label}] No objects found under "${prefix}" — skipping`);
    return null;
  }

  // Pick the first key; prefer a key whose filename part has an extension
  const key =
    keys.find((k) => {
      const fname = k.split("/").pop() ?? "";
      return fname.includes(".");
    }) ?? keys[0];

  const filename = key.split("/").pop()!;
  console.log(`  [${label}] Testing key: ${key}`);

  // Direct R2 download
  let directBytes = 0;
  let directContentType = "error";
  try {
    const d = await directR2Download(s3, key);
    directBytes = d.bytes;
    directContentType = d.contentType;
    console.log(
      `  [${label}] Direct R2 → ${directBytes} bytes, content-type: ${directContentType}`
    );
  } catch (err: any) {
    console.error(`  [${label}] Direct R2 read FAILED: ${err.message}`);
    directContentType = `ERROR: ${err.message}`;
  }

  // App route
  const url = `${APP_BASE}${routeBuilder(filename)}`;
  console.log(`  [${label}] App route: GET ${url}`);
  let appStatus = 0;
  let appContentType = "error";
  let appBytes = 0;
  try {
    const a = await appRouteGet(url);
    appStatus = a.status;
    appContentType = a.contentType;
    appBytes = a.bytes;
    console.log(
      `  [${label}] App route → HTTP ${appStatus}, ${appBytes} bytes, content-type: ${appContentType}`
    );
  } catch (err: any) {
    console.error(`  [${label}] App route FAILED: ${err.message}`);
    appContentType = `ERROR: ${err.message}`;
  }

  const pass = appStatus === 200 && appBytes > 0 && directBytes > 0;
  const note = pass
    ? "OK"
    : `appStatus=${appStatus} appBytes=${appBytes} directBytes=${directBytes}`;

  return {
    label,
    key,
    directBytes,
    directContentType,
    appStatus,
    appContentType,
    appBytes,
    pass,
    note,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== R2 Student-Facing Read Path Verification ===\n");

  // Guard: credentials
  const missing: string[] = [];
  if (!BUCKET) missing.push("DEFAULT_OBJECT_STORAGE_BUCKET_ID");
  if (!ACCESS_KEY) missing.push("AWS_S3_ACCESS_KEY_ID");
  if (!SECRET_KEY) missing.push("AWS_S3_SECRET_ACCESS_KEY");
  if (missing.length > 0) {
    console.error(`ABORT: missing env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  console.log(`Bucket : ${BUCKET}`);
  console.log(`Region : ${REGION}`);
  console.log(`Endpoint: ${ENDPOINT || "(default AWS)"}`);
  console.log(`App base: ${APP_BASE}\n`);

  const s3 = makeS3();
  const results: CheckResult[] = [];

  // --- Images ---
  console.log("── Images (public/ai-images/) ──────────────────────────────");
  const imageResult = await checkPrefix(
    s3,
    "public/ai-images/",
    (fname) => `/api/media/ai-image/${fname}`,
    "image"
  );
  if (imageResult) results.push(imageResult);

  console.log();

  // --- Voice messages ---
  console.log("── Voice messages (public/voice-messages/) ─────────────────");
  const voiceResult = await checkPrefix(
    s3,
    "public/voice-messages/",
    (fname) => `/api/media/vm-audio/${fname}`,
    "voice"
  );
  if (voiceResult) results.push(voiceResult);

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n=== Summary ===");
  if (results.length === 0) {
    console.log(
      "No objects found in either prefix — nothing to verify.\n" +
        "If the bucket is newly migrated, confirm objects were copied successfully."
    );
    process.exit(0);
  }

  let allPass = true;
  for (const r of results) {
    const icon = r.pass ? "✓" : "✗";
    console.log(`  ${icon} [${r.label}] ${r.pass ? "PASS" : "FAIL — " + r.note}`);
    if (!r.pass) allPass = false;
  }

  console.log();
  if (allPass) {
    console.log("All checks PASSED — R2 read paths are working correctly.");
    process.exit(0);
  } else {
    console.error("One or more checks FAILED — see details above.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
