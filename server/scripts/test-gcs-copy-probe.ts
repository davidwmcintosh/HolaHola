/**
 * test-gcs-copy-probe.ts
 *
 * Exercises the GCS branch of the copy-object probe to confirm:
 *   1. Happy path  — "[ObjectStorage:CopyProbe] GCS metadata probe OK" is logged.
 *   2. setMetadata failure path — WARN is logged (not an uncaught exception), and
 *      the sentinel file is still deleted even when setMetadata rejects.
 *
 * Uses fully mocked GCS clients so the script runs in any environment,
 * including ones where S3/R2 is the active backend.
 *
 * Run: npx tsx server/scripts/test-gcs-copy-probe.ts
 */

import { runGcsCopyProbeWithClient } from "../replit_integrations/object_storage/objectStorage.js";
import type { Storage } from "@google-cloud/storage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TAG = "[ObjectStorage:CopyProbe]";
let allPassed = true;

function pass(label: string) {
  console.log(`  ✅ PASS  ${label}`);
}

function fail(label: string, detail?: string) {
  console.error(`  ❌ FAIL  ${label}${detail ? `\n         ${detail}` : ""}`);
  allPassed = false;
}

/** Capture console output while running fn(). */
async function captureConsoleDuring(fn: () => Promise<void>): Promise<{
  logs: string[];
  warns: string[];
  errors: string[];
}> {
  const logs: string[] = [];
  const warns: string[] = [];
  const errors: string[] = [];

  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);

  console.log = (...args: any[]) => { const m = args.join(" "); logs.push(m); origLog(m); };
  console.warn = (...args: any[]) => { const m = args.join(" "); warns.push(m); origWarn(m); };
  console.error = (...args: any[]) => { const m = args.join(" "); errors.push(m); origError(m); };

  try {
    await fn();
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
  }

  return { logs, warns, errors };
}

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

/**
 * Builds a fake GCS Storage client.
 *
 * @param opts.saveThrows       — if true, file.save() rejects (tests outer-catch path)
 * @param opts.setMetadataThrows — if true, file.setMetadata() rejects (tests inner-catch path)
 */
function makeMockGcs(opts: {
  saveThrows?: boolean;
  setMetadataThrows?: boolean;
} = {}): {
  gcs: Storage;
  calls: { save: number; setMetadata: number; delete: number };
} {
  const calls = { save: 0, setMetadata: 0, delete: 0 };

  const mockFile = {
    save: async (_data: Buffer, _options: any) => {
      calls.save++;
      if (opts.saveThrows) throw new Error("403 Forbidden — storage.objects.create denied (simulated)");
    },
    setMetadata: async (_meta: any) => {
      calls.setMetadata++;
      if (opts.setMetadataThrows) {
        throw new Error("403 Forbidden — storage.objects.update not granted (simulated)");
      }
    },
    delete: async () => {
      calls.delete++;
    },
  };

  const mockBucket = {
    file: (_name: string) => mockFile,
  };

  const gcs = {
    bucket: (_name: string) => mockBucket,
  } as unknown as Storage;

  return { gcs, calls };
}

// ---------------------------------------------------------------------------
// Test 1 — Happy path (save + setMetadata both succeed)
// ---------------------------------------------------------------------------

console.log("\nTest 1: happy path — save and setMetadata both succeed");

{
  const { gcs, calls } = makeMockGcs();
  const bucket = "mock-bucket-happy";

  const captured = await captureConsoleDuring(() =>
    runGcsCopyProbeWithClient(gcs, bucket, "_health_probe/test-probe-1.txt"),
  );

  if (captured.logs.some(l => l.includes(`${TAG} GCS metadata probe OK`))) {
    pass("logged 'GCS metadata probe OK'");
  } else {
    fail("'GCS metadata probe OK' not found in logs", JSON.stringify(captured.logs));
  }

  if (calls.save === 1) {
    pass("file.save() called once");
  } else {
    fail(`file.save() call count wrong`, `expected 1, got ${calls.save}`);
  }

  if (calls.setMetadata === 1) {
    pass("file.setMetadata() called once");
  } else {
    fail(`file.setMetadata() call count wrong`, `expected 1, got ${calls.setMetadata}`);
  }

  if (calls.delete === 1) {
    pass("file.delete() called (cleanup ran)");
  } else {
    fail(`file.delete() call count wrong`, `expected 1, got ${calls.delete}`);
  }

  if (captured.warns.length === 0) {
    pass("no WARN lines on happy path");
  } else {
    fail("unexpected WARN on happy path", JSON.stringify(captured.warns));
  }
}

// ---------------------------------------------------------------------------
// Test 2 — setMetadata failure path
// ---------------------------------------------------------------------------

console.log("\nTest 2: setMetadata failure — simulates restricted IAM role");

{
  const { gcs, calls } = makeMockGcs({ setMetadataThrows: true });
  const bucket = "mock-bucket-meta-fail";

  const captured = await captureConsoleDuring(() =>
    runGcsCopyProbeWithClient(gcs, bucket, "_health_probe/test-probe-2.txt"),
  );

  if (captured.warns.some(w => w.includes(`${TAG} WARN GCS setMetadata failed`))) {
    pass("WARN line logged for setMetadata failure");
  } else {
    fail("expected WARN for setMetadata failure not found", JSON.stringify(captured.warns));
  }

  if (captured.warns.some(w => w.includes("storage.objects.update not granted"))) {
    pass("WARN carries the original error message");
  } else {
    fail("WARN did not include original error message", JSON.stringify(captured.warns));
  }

  if (captured.warns.some(w => w.includes("storage.objects.update") && w.includes("CMEK"))) {
    pass("WARN includes IAM/CMEK remediation hint");
  } else {
    fail("WARN missing IAM/CMEK remediation hint", JSON.stringify(captured.warns));
  }

  if (calls.save === 1) {
    pass("file.save() was called before setMetadata failure");
  } else {
    fail(`file.save() call count wrong`, `expected 1, got ${calls.save}`);
  }

  if (calls.delete === 1) {
    pass("file.delete() called after setMetadata failure (cleanup always runs)");
  } else {
    fail(
      "file.delete() was NOT called after setMetadata failure — sentinel would be orphaned",
      `call count: ${calls.delete}`,
    );
  }

  // No uncaught exceptions: the function must have returned normally.
  pass("function returned without throwing (setMetadata failure is contained)");
}

// ---------------------------------------------------------------------------
// Test 3 — save() failure path (outer catch + cleanup still fires)
// ---------------------------------------------------------------------------

console.log("\nTest 3: save() failure — outer catch + cleanup still fires");

{
  const { gcs, calls } = makeMockGcs({ saveThrows: true });
  const bucket = "mock-bucket-save-fail";

  const captured = await captureConsoleDuring(() =>
    runGcsCopyProbeWithClient(gcs, bucket, "_health_probe/test-probe-3.txt"),
  );

  if (captured.warns.some(w => w.includes(`${TAG} WARN GCS probe error`))) {
    pass("WARN line logged for save() failure");
  } else {
    fail("expected outer WARN for save() failure not found", JSON.stringify(captured.warns));
  }

  if (calls.setMetadata === 0) {
    pass("file.setMetadata() was NOT called after save() failure (correct short-circuit)");
  } else {
    fail("file.setMetadata() was called even after save() failed");
  }

  if (calls.delete === 1) {
    pass("file.delete() called even after save() failure (finally block runs)");
  } else {
    fail(
      "file.delete() was NOT called after save() failure — finally block may be broken",
      `call count: ${calls.delete}`,
    );
  }

  pass("function returned without throwing (save failure is contained)");
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log("\n──────────────────────────────────────────────────");
if (allPassed) {
  console.log("All GCS copy-probe tests passed ✅");
  process.exit(0);
} else {
  console.log("One or more GCS copy-probe tests FAILED ❌  (see above)");
  process.exit(1);
}
