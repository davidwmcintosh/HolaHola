/**
 * verify-system-health.ts
 *
 * Fast pre-completion verifier. Checks every critical invariant in the system
 * and prints green/red for each. Run before marking any task done.
 *
 * Usage:  npx tsx server/scripts/verify-system-health.ts
 */

import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.NEON_SHARED_DATABASE_URL,
  max: 1,
});

const GREEN = "\x1b[32m✓\x1b[0m";
const RED = "\x1b[31m✗\x1b[0m";
const YELLOW = "\x1b[33m⚠\x1b[0m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

let failures = 0;
let warnings = 0;

function pass(label: string, detail = "") {
  console.log(`  ${GREEN} ${label}${detail ? "  " + detail : ""}`);
}
function fail(label: string, detail = "") {
  console.log(`  ${RED} ${label}${detail ? "  " + detail : ""}`);
  failures++;
}
function warn(label: string, detail = "") {
  console.log(`  ${YELLOW} ${label}${detail ? "  " + detail : ""}`);
  warnings++;
}

async function tableExists(name: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
    [name]
  );
  return r.rowCount! > 0;
}

async function rowCount(table: string, where = ""): Promise<number> {
  const r = await pool.query(
    `SELECT COUNT(*)::int n FROM ${table}${where ? " WHERE " + where : ""}`
  );
  return r.rows[0].n;
}

// ─── DB TABLES ──────────────────────────────────────────────────────────────

async function checkTables() {
  console.log(`\n${BOLD}── DB Tables ──────────────────────────────────────────${RESET}`);

  const required = [
    // core learning
    "users", "conversations", "messages", "curriculum_paths", "curriculum_units",
    "curriculum_lessons", "class_enrollments",
    // can-do / mastery
    "can_do_statements", "student_can_do_progress", "student_can_do_evidence",
    "curriculum_unit_can_do_map",
    // pedagogical brief
    "student_pedagogical_briefs",
    // voice / reflection
    "voice_sessions", "pending_reflections", "reflection_triggers",
    // memory / embeddings
    "memory_embeddings", "learner_personal_facts",
    // tutor system
    "tutor_procedures", "tool_knowledge",
    // agent space
    "agent_north_star", "agent_open_questions", "agent_record_of_david",
    // team room
    "team_rooms",
    // neural / identity
    "daniela_self_reflections", "daniela_aspirations", "editor_insights",
  ];

  for (const t of required) {
    if (await tableExists(t)) {
      pass(t);
    } else {
      fail(t, "MISSING FROM DB");
    }
  }
}

// ─── SEEDED DATA ─────────────────────────────────────────────────────────────

async function checkSeededData() {
  console.log(`\n${BOLD}── Seeded Data ─────────────────────────────────────────${RESET}`);

  // Universal ACTFL Can-Do statements
  const universalCount = await rowCount("can_do_statements", "language='universal'");
  if (universalCount >= 30) {
    pass(`can_do_statements (universal)`, `${universalCount} rows`);
  } else {
    fail(`can_do_statements (universal)`, `only ${universalCount} rows — need ≥30`);
  }

  // Tutor procedures
  const procCount = await rowCount("tutor_procedures");
  if (procCount > 0) {
    pass("tutor_procedures", `${procCount} rows`);
  } else {
    warn("tutor_procedures", "0 rows — Daniela's procedures not seeded");
  }

  // Tool knowledge
  const toolCount = await rowCount("tool_knowledge");
  if (toolCount >= 50) {
    pass("tool_knowledge", `${toolCount} rows`);
  } else {
    warn("tool_knowledge", `only ${toolCount} rows — may need indexer run`);
  }

  // Agent identity tables
  const northStar = await rowCount("agent_north_star");
  if (northStar > 0) pass("agent_north_star", `${northStar} rows`);
  else warn("agent_north_star", "0 rows");
}

// ─── CURRICULUM ALIGNMENT ────────────────────────────────────────────────────

async function checkCurriculum() {
  console.log(`\n${BOLD}── Curriculum Alignment (vs Spanish baseline) ──────────${RESET}`);

  // Get Spanish baselines
  const spPaths = await pool.query(`
    SELECT cp.start_level, COUNT(cu.id)::int unit_count
    FROM curriculum_paths cp
    LEFT JOIN curriculum_units cu ON cu.curriculum_path_id=cp.id
    WHERE cp.language='spanish'
    GROUP BY cp.start_level
  `);
  const spBaseline: Record<string, number> = {};
  for (const r of spPaths.rows) spBaseline[r.start_level] = r.unit_count;

  // Get all languages
  const allLangs = await pool.query(`
    SELECT cp.language, cp.start_level, COUNT(cu.id)::int unit_count
    FROM curriculum_paths cp
    LEFT JOIN curriculum_units cu ON cu.curriculum_path_id=cp.id
    WHERE cp.language != 'spanish'
    GROUP BY cp.language, cp.start_level, cp.id
    ORDER BY cp.language, cp.start_level
  `);

  // Group by language + level, take MAX (handles duplicate paths)
  const langMap: Record<string, Record<string, number>> = {};
  for (const r of allLangs.rows) {
    if (!langMap[r.language]) langMap[r.language] = {};
    langMap[r.language][r.start_level] = Math.max(
      langMap[r.language][r.start_level] ?? 0,
      r.unit_count
    );
  }

  const levels = ["novice_low", "novice_high", "intermediate_low", "intermediate_mid", "advanced_low"];
  const labelMap: Record<string, string> = {
    novice_low: "L1", novice_high: "L2", intermediate_low: "L3",
    intermediate_mid: "L4", advanced_low: "L5",
  };

  for (const lang of Object.keys(langMap).sort()) {
    const counts = langMap[lang];
    let issues: string[] = [];
    for (const level of levels) {
      const sp = spBaseline[level] ?? 0;
      const actual = counts[level] ?? 0;
      if (actual === 0 && sp === 0) continue;
      if (actual < sp) {
        issues.push(`${labelMap[level]}=${actual}/${sp}⚠`);
      }
    }
    if (issues.length === 0) {
      pass(lang.padEnd(12), "all levels ≥ baseline");
    } else {
      warn(lang.padEnd(12), `under baseline: ${issues.join(" ")}`);
    }
  }

  // Duplicate path check — same language + start_level + target_audience > 1 is ambiguous.
  // Different target_audiences at the same level (e.g., adult vs high school) are intentional.
  const dupes = await pool.query(`
    SELECT language, start_level, target_audience, COUNT(*) n
    FROM curriculum_paths
    GROUP BY language, start_level, target_audience
    HAVING COUNT(*) > 1
  `);
  if (dupes.rows.length > 0) {
    console.log("");
    for (const r of dupes.rows) {
      warn(
        `duplicate paths`,
        `${r.language} ${r.start_level} (${r.target_audience}) has ${r.n} paths — routing is ambiguous`
      );
    }
  }

  // chapter_type NULL check — every unit must have a chapter_type
  const nullTypes = await pool.query(`
    SELECT cp.language, cp.name as path_name, COUNT(cu.id)::int null_count
    FROM curriculum_units cu
    JOIN curriculum_paths cp ON cu.curriculum_path_id = cp.id
    WHERE cu.chapter_type IS NULL
    GROUP BY cp.language, cp.name
    ORDER BY cp.language
  `);
  if (nullTypes.rows.length > 0) {
    console.log("");
    for (const r of nullTypes.rows) {
      warn(`chapter_type NULLs`, `${r.path_name}: ${r.null_count} units have NULL chapter_type`);
    }
  }
}

// ─── WORKER WIRING ───────────────────────────────────────────────────────────

async function checkWorkers() {
  console.log(`\n${BOLD}── Worker Wiring (server/index.ts + ws-handler) ────────${RESET}`);
  const { readFileSync } = await import("fs");

  const indexTs = readFileSync("server/index.ts", "utf8");
  const wsHandler = readFileSync("server/unified-ws-handler.ts", "utf8");

  // Workers booted from server/index.ts (long-running background processes)
  const indexChecks: Array<[string, string]> = [
    ["AgentSessionAutosave", "agent-session-autosave"],
    ["DanielaPresenceWorker", "daniela-presence-worker"],
    ["EmbedIndexer", "memory-embedding-indexer"],
    ["AbsenceWorker", "absence-worker"],
    ["ToolIndexer", "tool-indexer"],
  ];
  for (const [label, token] of indexChecks) {
    if (indexTs.includes(token)) {
      pass(label);
    } else {
      warn(label, `'${token}' not found in server/index.ts`);
    }
  }

  // Workers fired from ws-handler on session close (NOT booted at server start)
  const wsChecks: Array<[string, string]> = [
    ["ws-handler → generateAndStorePedagogicalBrief", "generateAndStorePedagogicalBrief"],
    ["ws-handler → analyzeSessionForMasteryEvidence", "analyzeSessionForMasteryEvidence"],
  ];
  for (const [label, token] of wsChecks) {
    if (wsHandler.includes(token)) {
      pass(label);
    } else {
      fail(label, `'${token}' not found in unified-ws-handler.ts`);
    }
  }
}

// ─── PRE-SESSION SYNTHESIS ───────────────────────────────────────────────────

async function checkPreSessionSynthesis() {
  console.log(`\n${BOLD}── Pre-Session Synthesis Wiring ───────────────────────${RESET}`);
  const { readFileSync } = await import("fs");
  const pss = readFileSync("server/services/pre-session-synthesis.ts", "utf8");

  const checks: Array<[string, string]> = [
    ["imports getLatestPedagogicalBrief", "getLatestPedagogicalBrief"],
    ["imports getMasteryDigest", "getMasteryDigest"],
    ["injects pedagogicalBrief into synthesis", "pedagogicalBrief"],
    ["injects masteryDigest into synthesis", "masteryDigest"],
  ];
  for (const [label, token] of checks) {
    if (pss.includes(token)) pass(label);
    else fail(label, `'${token}' not found`);
  }
}

// ─── OBJECT STORAGE — CopyObject probe ───────────────────────────────────────

async function checkObjectStorageMetadata() {
  console.log(`\n${BOLD}── Object Storage — CopyObject metadata probe ──────────${RESET}`);

  const {
    isS3Configured,
    makeS3File,
    uploadBuffer,
  } = await import("../replit_integrations/object_storage/objectStorage.js");

  if (!isS3Configured()) {
    console.log(`  ℹ  S3 not configured — GCS backend in use (CopyObject probe skipped)`);
    return;
  }

  // Derive bucket from PRIVATE_OBJECT_DIR (format: /bucket-name/path/…)
  const privateDir = process.env.PRIVATE_OBJECT_DIR ?? "";
  if (!privateDir) {
    warn("CopyObject probe", "PRIVATE_OBJECT_DIR not set — cannot derive bucket for probe");
    return;
  }
  const parts = privateDir.replace(/^\//, "").split("/");
  const bucketName = parts[0];
  if (!bucketName) {
    warn("CopyObject probe", `Could not parse bucket from PRIVATE_OBJECT_DIR="${privateDir}"`);
    return;
  }

  const probeKey = `_health_probe/copy-object-probe-${Date.now()}.txt`;

  try {
    // 1. Upload a tiny probe object.
    await uploadBuffer(bucketName, probeKey, Buffer.from("holahola-probe"), "text/plain", {
      "x-probe-init": "true",
    });

    // 2. Intercept console.warn to catch the fallback warning from s3File.ts.
    let fallbackFired = false;
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      const msg = args.map(String).join(" ");
      if (msg.includes("falling back to download+reupload")) {
        fallbackFired = true;
      }
      originalWarn.apply(console, args);
    };

    try {
      const file = makeS3File(bucketName, probeKey);
      await file.setCustomMetadata({ "x-probe-updated": "true" });
    } finally {
      console.warn = originalWarn;
    }

    if (fallbackFired) {
      warn(
        "CopyObject probe",
        `CopyObject FAILED — fell back to download+reupload for bucket "${bucketName}". ` +
          `Every metadata update will download the full object. Check bucket region/permissions.`,
      );
    } else {
      pass("CopyObject probe", `CopyObject succeeded on bucket "${bucketName}"`);
    }
  } catch (err: any) {
    warn("CopyObject probe", `probe error: ${err?.message ?? err}`);
  } finally {
    // 3. Clean up — best-effort, ignore errors.
    try {
      const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const s3 = new S3Client({
        region: process.env.AWS_S3_REGION!,
        credentials: {
          accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY!,
        },
        ...(process.env.AWS_S3_ENDPOINT
          ? { endpoint: process.env.AWS_S3_ENDPOINT, forcePathStyle: true }
          : {}),
      });
      await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: probeKey }));
    } catch {
      // Probe cleanup failed — not a health-check failure, just note it.
    }
  }
}

async function checkGcsCopyProbe() {
  console.log(`\n${BOLD}── GCS Copy-Probe (mocked) ─────────────────────────────${RESET}`);

  const {
    runGcsCopyProbeWithClient,
    GCS_COPY_PROBE_TAG,
    GCS_PROBE_MSG_OK,
    GCS_PROBE_MSG_SET_METADATA_FAILED,
    GCS_PROBE_MSG_PROBE_ERROR,
  } = await import(
    "../replit_integrations/object_storage/objectStorage.js"
  );

  type AnyStorage = any;

  /** Capture console output produced by fn() without suppressing it. */
  async function capture(fn: () => Promise<void>): Promise<{ logs: string[]; warns: string[] }> {
    const logs: string[] = [];
    const warns: string[] = [];
    const origLog = console.log.bind(console);
    const origWarn = console.warn.bind(console);
    console.log = (...a: any[]) => { const m = a.join(" "); logs.push(m); origLog(m); };
    console.warn = (...a: any[]) => { const m = a.join(" "); warns.push(m); origWarn(m); };
    try { await fn(); } finally { console.log = origLog; console.warn = origWarn; }
    return { logs, warns };
  }

  function makeMock(opts: { saveThrows?: boolean; setMetadataThrows?: boolean } = {}): {
    gcs: AnyStorage;
    calls: { save: number; setMetadata: number; delete: number };
  } {
    const calls = { save: 0, setMetadata: 0, delete: 0 };
    const mockFile = {
      save: async () => { calls.save++; if (opts.saveThrows) throw new Error("403 save denied (simulated)"); },
      setMetadata: async () => { calls.setMetadata++; if (opts.setMetadataThrows) throw new Error("403 storage.objects.update not granted (simulated)"); },
      delete: async () => { calls.delete++; },
    };
    const gcs = { bucket: () => ({ file: () => mockFile }) } as AnyStorage;
    return { gcs, calls };
  }

  // ── Test 1: happy path ──────────────────────────────────────────────────────
  {
    const { gcs, calls } = makeMock();
    const { logs, warns } = await capture(() =>
      runGcsCopyProbeWithClient(gcs, "mock-bucket-happy", "_health_probe/ci-probe-1.txt"),
    );
    if (logs.some((l: string) => l.includes(`${GCS_COPY_PROBE_TAG} ${GCS_PROBE_MSG_OK}`))) {
      pass("GCS probe — happy path logged OK");
    } else {
      fail("GCS probe — happy path", `'${GCS_PROBE_MSG_OK}' not found in logs`);
    }
    if (calls.save === 1 && calls.setMetadata === 1 && calls.delete === 1) {
      pass("GCS probe — happy path call counts correct");
    } else {
      fail("GCS probe — happy path call counts", `save=${calls.save} setMetadata=${calls.setMetadata} delete=${calls.delete} (expected 1 each)`);
    }
    if (warns.length === 0) {
      pass("GCS probe — happy path produced no warnings");
    } else {
      fail("GCS probe — happy path unexpected warnings", warns.join("; "));
    }
  }

  // ── Test 2: setMetadata failure ─────────────────────────────────────────────
  {
    const { gcs, calls } = makeMock({ setMetadataThrows: true });
    const { warns } = await capture(() =>
      runGcsCopyProbeWithClient(gcs, "mock-bucket-meta-fail", "_health_probe/ci-probe-2.txt"),
    );
    if (warns.some((w: string) => w.includes(`${GCS_COPY_PROBE_TAG} ${GCS_PROBE_MSG_SET_METADATA_FAILED}`))) {
      pass("GCS probe — setMetadata failure logged WARN");
    } else {
      fail("GCS probe — setMetadata failure", `expected '${GCS_PROBE_MSG_SET_METADATA_FAILED}' WARN not found`);
    }
    if (calls.delete === 1) {
      pass("GCS probe — setMetadata failure still cleaned up sentinel");
    } else {
      fail("GCS probe — setMetadata failure cleanup", `delete called ${calls.delete} time(s), expected 1`);
    }
  }

  // ── Test 3: save() failure ──────────────────────────────────────────────────
  {
    const { gcs, calls } = makeMock({ saveThrows: true });
    const { warns } = await capture(() =>
      runGcsCopyProbeWithClient(gcs, "mock-bucket-save-fail", "_health_probe/ci-probe-3.txt"),
    );
    if (warns.some((w: string) => w.includes(`${GCS_COPY_PROBE_TAG} ${GCS_PROBE_MSG_PROBE_ERROR}`))) {
      pass("GCS probe — save() failure logged outer WARN");
    } else {
      fail("GCS probe — save() failure", `expected '${GCS_PROBE_MSG_PROBE_ERROR}' WARN not found`);
    }
    if (calls.setMetadata === 0) {
      pass("GCS probe — save() failure short-circuited setMetadata");
    } else {
      fail("GCS probe — save() failure", "setMetadata was called after save() failed");
    }
    if (calls.delete === 1) {
      pass("GCS probe — save() failure still cleaned up sentinel (finally block)");
    } else {
      fail("GCS probe — save() failure cleanup", `delete called ${calls.delete} time(s), expected 1`);
    }
  }
}
async function checkR2ReadPaths() {
  console.log(`\n${BOLD}── R2 Student-Facing Read Paths ────────────────────────${RESET}`);

  const BUCKET = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? "";
  const REGION = process.env.AWS_S3_REGION ?? "auto";
  const ENDPOINT = process.env.AWS_S3_ENDPOINT ?? "";
  const ACCESS_KEY = process.env.AWS_S3_ACCESS_KEY_ID ?? "";
  const SECRET_KEY = process.env.AWS_S3_SECRET_ACCESS_KEY ?? "";

  if (!BUCKET || !ACCESS_KEY || !SECRET_KEY) {
    const missing: string[] = [];
    if (!BUCKET) missing.push("DEFAULT_OBJECT_STORAGE_BUCKET_ID");
    if (!ACCESS_KEY) missing.push("AWS_S3_ACCESS_KEY_ID");
    if (!SECRET_KEY) missing.push("AWS_S3_SECRET_ACCESS_KEY");
    console.log(`  ℹ  R2 not configured (${missing.join(", ")} missing) — read-path checks skipped`);
    return;
  }

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

  // App HTTP base — used to verify the Express proxy routes students actually hit.
  // The health verifier runs in the same process context as the server, but we
  // check via HTTP to exercise the full stack.  Fall back to localhost:5000.
  const APP_BASE = process.env.APP_BASE ?? "http://localhost:5000";

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

  async function directRead(key: string): Promise<{ bytes: number; contentType: string }> {
    const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    let bytes = 0;
    if (resp.Body) {
      for await (const chunk of resp.Body as AsyncIterable<Uint8Array>) bytes += chunk.length;
    }
    return { bytes, contentType: resp.ContentType ?? "unknown" };
  }

  async function appGet(url: string): Promise<{ status: number; bytes: number }> {
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const buf = await resp.arrayBuffer();
    return { status: resp.status, bytes: buf.byteLength };
  }

  type PrefixSpec = { prefix: string; routeFn: (fname: string) => string; label: string };
  const prefixes: PrefixSpec[] = [
    { prefix: "public/ai-images/",      routeFn: (f) => `/api/media/ai-image/${f}`,  label: "ai-image" },
    { prefix: "public/voice-messages/", routeFn: (f) => `/api/media/vm-audio/${f}`,  label: "vm-audio" },
  ];

  let anyChecked = false;
  let anyListSucceeded = false;

  for (const { prefix, routeFn, label } of prefixes) {
    let keys: string[];
    try {
      keys = await listPrefix(prefix);
      anyListSucceeded = true;
    } catch (err: any) {
      fail(`R2 list ${label}`, `ListObjectsV2 failed: ${err?.message ?? err}`);
      continue;
    }

    if (keys.length === 0) {
      // ListObjectsV2 succeeded but prefix is empty — credentials work, nothing to read-verify
      continue;
    }

    anyChecked = true;
    // Prefer a key with a file extension so content-type is meaningful
    const key = keys.find((k) => (k.split("/").pop() ?? "").includes(".")) ?? keys[0];
    const filename = key.split("/").pop()!;

    // 1. Direct S3 read
    let directBytes = 0;
    try {
      const d = await directRead(key);
      directBytes = d.bytes;
      if (directBytes === 0) {
        fail(`R2 direct read ${label}`, `Key "${key}" returned 0 bytes`);
      } else {
        pass(`R2 direct read ${label}`, `${directBytes} bytes (${d.contentType})`);
      }
    } catch (err: any) {
      fail(`R2 direct read ${label}`, `GetObject failed: ${err?.message ?? err}`);
    }

    // 2. App route (server must be running; gracefully skip if refused)
    const url = `${APP_BASE}${routeFn(filename)}`;
    try {
      const a = await appGet(url);
      if (a.status === 200 && a.bytes > 0) {
        pass(`R2 app route ${label}`, `HTTP ${a.status}, ${a.bytes} bytes`);
      } else if (a.status === 200 && a.bytes === 0) {
        fail(`R2 app route ${label}`, `HTTP 200 but 0 bytes returned for "${filename}"`);
      } else {
        fail(`R2 app route ${label}`, `HTTP ${a.status} for GET ${routeFn(filename)}`);
      }
    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
        warn(`R2 app route ${label}`, `Server not reachable at ${APP_BASE} — app-route check skipped`);
      } else {
        fail(`R2 app route ${label}`, msg);
      }
    }
  }

  if (!anyChecked) {
    if (anyListSucceeded) {
      // Credentials are valid — bucket is reachable but both prefixes are empty
      pass("R2 credentials valid", "ListObjectsV2 succeeded, 0 objects in watched prefixes");
    } else {
      // All ListObjectsV2 calls failed — failures already recorded above
      // (nothing extra to emit here; avoid a redundant warning)
    }
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${BOLD}╔══════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}║       HolaHola System Health Verifier        ║${RESET}`);
  console.log(`${BOLD}╚══════════════════════════════════════════════╝${RESET}`);

  await checkTables();
  await checkSeededData();
  await checkCurriculum();
  await checkWorkers();
  await checkPreSessionSynthesis();
  await checkObjectStorageMetadata();
  await checkGcsCopyProbe();
  await checkR2ReadPaths();

  console.log(`\n${BOLD}── Summary ─────────────────────────────────────────────${RESET}`);
  if (failures === 0 && warnings === 0) {
    console.log(`  ${GREEN} All checks passed — safe to mark done.\n`);
  } else {
    if (failures > 0) console.log(`  ${RED} ${failures} failure(s) — DO NOT mark done until fixed.\n`);
    if (warnings > 0) console.log(`  ${YELLOW} ${warnings} warning(s) — review before marking done.\n`);
  }

  await pool.end();
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Verifier crashed:", e.message);
  pool.end();
  process.exit(1);
});
