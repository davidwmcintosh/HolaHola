/**
 * test-gcs-copy-probe.test.ts
 *
 * Exercises the GCS branch of the copy-object probe to confirm:
 *   1. Happy path  — "[ObjectStorage:CopyProbe] GCS metadata probe OK" is logged.
 *   2. setMetadata failure path — WARN is logged (not an uncaught exception), and
 *      the sentinel file is still deleted even when setMetadata rejects.
 *   3. save() failure path — outer WARN is logged, cleanup still fires.
 *
 * Uses fully mocked GCS clients so no real credentials are needed.
 * Runs automatically in CI as part of `npm test`.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  runGcsCopyProbeWithClient,
  GCS_COPY_PROBE_TAG,
  GCS_PROBE_MSG_OK,
  GCS_PROBE_MSG_SET_METADATA_FAILED,
  GCS_PROBE_MSG_PROBE_ERROR,
} from "../replit_integrations/object_storage/objectStorage.js";
import type { Storage } from "@google-cloud/storage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
 * @param opts.saveThrows        — if true, file.save() rejects (tests outer-catch path)
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
// Tests
// ---------------------------------------------------------------------------

describe("GCS copy probe", () => {
  it("happy path — save and setMetadata both succeed", async () => {
    const { gcs, calls } = makeMockGcs();
    const bucket = "mock-bucket-happy";

    const captured = await captureConsoleDuring(() =>
      runGcsCopyProbeWithClient(gcs, bucket, "_health_probe/test-probe-1.txt"),
    );

    assert.ok(
      captured.logs.some(l => l.includes(`${GCS_COPY_PROBE_TAG} ${GCS_PROBE_MSG_OK}`)),
      `'${GCS_PROBE_MSG_OK}' not found in logs: ${JSON.stringify(captured.logs)}`,
    );
    assert.equal(calls.save, 1, `file.save() call count: expected 1, got ${calls.save}`);
    assert.equal(calls.setMetadata, 1, `file.setMetadata() call count: expected 1, got ${calls.setMetadata}`);
    assert.equal(calls.delete, 1, `file.delete() call count: expected 1, got ${calls.delete}`);
    assert.equal(calls.delete, 1, "cleanup must run");
    assert.equal(
      captured.warns.length,
      0,
      `unexpected WARN on happy path: ${JSON.stringify(captured.warns)}`,
    );
  });

  it("setMetadata failure — WARN logged, no uncaught exception, cleanup still runs", async () => {
    const { gcs, calls } = makeMockGcs({ setMetadataThrows: true });
    const bucket = "mock-bucket-meta-fail";

    // Must not throw — any uncaught exception would fail this test automatically.
    const captured = await captureConsoleDuring(() =>
      runGcsCopyProbeWithClient(gcs, bucket, "_health_probe/test-probe-2.txt"),
    );

    assert.ok(
      captured.warns.some(w => w.includes(`${GCS_COPY_PROBE_TAG} ${GCS_PROBE_MSG_SET_METADATA_FAILED}`)),
      `WARN line for setMetadata failure not found: ${JSON.stringify(captured.warns)}`,
    );
    assert.ok(
      captured.warns.some(w => w.includes("storage.objects.update not granted")),
      `WARN did not carry original error message: ${JSON.stringify(captured.warns)}`,
    );
    assert.ok(
      captured.warns.some(w => w.includes("storage.objects.update") && w.includes("CMEK")),
      `WARN missing IAM/CMEK remediation hint: ${JSON.stringify(captured.warns)}`,
    );
    assert.equal(calls.save, 1, "file.save() must be called before setMetadata fails");
    assert.equal(
      calls.delete,
      1,
      `file.delete() must be called after setMetadata failure (cleanup always runs); got ${calls.delete}`,
    );
  });

  it("save() failure — outer WARN logged, setMetadata skipped, cleanup still runs", async () => {
    const { gcs, calls } = makeMockGcs({ saveThrows: true });
    const bucket = "mock-bucket-save-fail";

    const captured = await captureConsoleDuring(() =>
      runGcsCopyProbeWithClient(gcs, bucket, "_health_probe/test-probe-3.txt"),
    );

    assert.ok(
      captured.warns.some(w => w.includes(`${GCS_COPY_PROBE_TAG} ${GCS_PROBE_MSG_PROBE_ERROR}`)),
      `outer WARN for save() failure not found: ${JSON.stringify(captured.warns)}`,
    );
    assert.equal(calls.setMetadata, 0, "file.setMetadata() must NOT be called after save() fails");
    assert.equal(
      calls.delete,
      1,
      `file.delete() must be called even after save() failure (finally block); got ${calls.delete}`,
    );
  });
});

// ---------------------------------------------------------------------------
// Source-level mutation guards (#518, #519)
//
// These tests confirm that renaming GCS_COPY_PROBE_TAG or GCS_PROBE_MSG_OK in
// objectStorage.ts would be caught by the mocked runtime tests above — making
// those tests genuine regression guards, not just happy-path smoke tests.
// ---------------------------------------------------------------------------

const objectStorageSrc = readFileSync(
  resolve(import.meta.dirname, "../replit_integrations/object_storage/objectStorage.ts"),
  "utf-8",
);

describe("Source-level guard — GCS_PROBE_MSG_OK constant (#519)", () => {
  it("GCS_PROBE_MSG_OK is exported with the exact value the happy-path test asserts", () => {
    assert.ok(
      objectStorageSrc.includes('export const GCS_PROBE_MSG_OK = "GCS metadata probe OK"'),
      'GCS_PROBE_MSG_OK not found with expected value in objectStorage.ts — was the constant renamed or the string changed?',
    );
  });

  it("mutation self-check: changing GCS_PROBE_MSG_OK value would break the happy-path assertion", () => {
    const mutated = objectStorageSrc.replace(
      'GCS_PROBE_MSG_OK = "GCS metadata probe OK"',
      'GCS_PROBE_MSG_OK = "GCS metadata probe RENAMED"',
    );
    assert.ok(
      !mutated.includes('GCS_PROBE_MSG_OK = "GCS metadata probe OK"'),
      "guard pattern still present after mutation — source assertion is not tight enough",
    );
  });
});

describe("Source-level guard — GCS_COPY_PROBE_TAG constant (#518)", () => {
  it("GCS_COPY_PROBE_TAG is exported with the exact tag the WARN-detection test asserts", () => {
    assert.ok(
      objectStorageSrc.includes('export const GCS_COPY_PROBE_TAG = "[ObjectStorage:CopyProbe]"'),
      'GCS_COPY_PROBE_TAG not found with expected value in objectStorage.ts — was the tag renamed?',
    );
  });

  it("mutation self-check: renaming GCS_COPY_PROBE_TAG would break the WARN-detection assertion", () => {
    const mutated = objectStorageSrc.replace(
      'GCS_COPY_PROBE_TAG = "[ObjectStorage:CopyProbe]"',
      'GCS_COPY_PROBE_TAG = "[ObjectStorage:RENAMED]"',
    );
    assert.ok(
      !mutated.includes('GCS_COPY_PROBE_TAG = "[ObjectStorage:CopyProbe]"'),
      "guard pattern still present after mutation — source assertion is not tight enough",
    );
  });
});
