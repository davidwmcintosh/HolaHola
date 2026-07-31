/**
 * test-r2-health-check.ts
 *
 * CI guard for the R2 object-storage read paths used by student-facing media
 * routes (/api/media/ai-image/:file and /api/media/vm-audio/:file).
 *
 * Three outcomes:
 *   PASS – credentials are valid and both prefixes are reachable (empty or not)
 *   PASS – credentials are valid but both watched prefixes are empty
 *   FAIL – required env vars are absent, credentials are rejected, or
 *           ListObjectsV2 throws for any other reason
 *
 * An empty bucket is NOT a failure — it just means there is nothing to
 * read-verify yet; the credentials check still passes.
 *
 * Usage:
 *   npx tsx server/scripts/test-r2-health-check.ts
 *
 * Exit code: 0 = all checks passed, 1 = at least one check failed.
 */

export {}; // top-level await requires module mode

// ── helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function pass(label: string, detail = ""): void {
  console.log(`  ✅  ${label}${detail ? `  — ${detail}` : ""}`);
  passed++;
}

function fail(label: string, detail = ""): void {
  console.error(`  ❌  ${label}${detail ? `  — ${detail}` : ""}`);
  failed++;
}

// ── env ──────────────────────────────────────────────────────────────────────

const BUCKET    = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? "";
const REGION    = process.env.AWS_S3_REGION ?? "auto";
const ENDPOINT  = process.env.AWS_S3_ENDPOINT ?? "";
const ACCESS_KEY = process.env.AWS_S3_ACCESS_KEY_ID ?? "";
const SECRET_KEY = process.env.AWS_S3_SECRET_ACCESS_KEY ?? "";

console.log("\n── R2 Health Check (CI) ─────────────────────────────────────");

// Required vars — absent = immediate failure so CI surfaces the misconfiguration.
const missing: string[] = [];
if (!BUCKET)      missing.push("DEFAULT_OBJECT_STORAGE_BUCKET_ID");
if (!ACCESS_KEY)  missing.push("AWS_S3_ACCESS_KEY_ID");
if (!SECRET_KEY)  missing.push("AWS_S3_SECRET_ACCESS_KEY");

if (missing.length > 0) {
  fail("R2 env vars present", `Missing: ${missing.join(", ")}`);
  console.log(`\n  ❌  1 failure — R2 credentials not configured in this environment.\n`);
  process.exit(1);
}

// ── S3 client ────────────────────────────────────────────────────────────────

const { S3Client, ListObjectsV2Command, GetObjectCommand } = await import("@aws-sdk/client-s3");

const s3Config: ConstructorParameters<typeof S3Client>[0] = {
  region: REGION,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
};
if (ENDPOINT) {
  s3Config.endpoint = ENDPOINT;
  s3Config.forcePathStyle = true;
}
const s3 = new S3Client(s3Config);

// ── helpers ───────────────────────────────────────────────────────────────────

async function listPrefix(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const resp = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, MaxKeys: 20, ContinuationToken: token })
    );
    for (const obj of resp.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    token = resp.NextContinuationToken;
  } while (token && keys.length < 20);
  return keys;
}

async function directRead(key: string): Promise<number> {
  const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  let bytes = 0;
  if (resp.Body) {
    for await (const chunk of resp.Body as AsyncIterable<Uint8Array>) bytes += chunk.length;
  }
  return bytes;
}

// ── prefixes to verify ───────────────────────────────────────────────────────

const PREFIXES = [
  { prefix: "public/ai-images/",      label: "ai-image" },
  { prefix: "public/voice-messages/", label: "vm-audio" },
];

let anySucceeded = false;
let anyRead = false;

for (const { prefix, label } of PREFIXES) {
  let keys: string[];
  try {
    keys = await listPrefix(prefix);
    anySucceeded = true;
  } catch (err: any) {
    fail(`R2 list ${label}`, `ListObjectsV2 failed: ${err?.message ?? err}`);
    continue;
  }

  if (keys.length === 0) {
    // Empty prefix is fine — credentials work, nothing to read-verify yet.
    continue;
  }

  anyRead = true;

  // Prefer a key with a file extension so content-type is meaningful.
  const key = keys.find((k) => (k.split("/").pop() ?? "").includes(".")) ?? keys[0];

  try {
    const bytes = await directRead(key);
    if (bytes === 0) {
      fail(`R2 direct read ${label}`, `Key "${key}" returned 0 bytes`);
    } else {
      pass(`R2 direct read ${label}`, `${bytes} bytes`);
    }
  } catch (err: any) {
    fail(`R2 direct read ${label}`, `GetObject failed: ${err?.message ?? err}`);
  }
}

// ── summary ──────────────────────────────────────────────────────────────────

if (failed === 0) {
  if (anySucceeded && !anyRead) {
    // Both prefixes were empty but ListObjectsV2 succeeded — credentials valid.
    pass("R2 credentials valid", "ListObjectsV2 succeeded; both watched prefixes are empty");
  }
  console.log(`\n  ✅  All R2 checks passed (${passed} passed, 0 failed).\n`);
  process.exit(0);
} else {
  console.log(`\n  ❌  ${failed} R2 check(s) failed.\n`);
  process.exit(1);
}
