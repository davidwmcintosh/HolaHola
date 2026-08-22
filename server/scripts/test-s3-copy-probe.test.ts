/**
 * test-s3-copy-probe.test.ts
 *
 * Exercises the S3/R2 branch of the copy-object probe to confirm:
 *   1. Happy path  — "[ObjectStorage:CopyProbe] CopyObject probe OK" is logged.
 *   2. CopyObject failure path — WARN is logged (not an uncaught exception), and
 *      the sentinel file is still deleted even when CopyObject rejects.
 *   3. PutObject failure path — outer WARN is logged, CopyObject is skipped,
 *      cleanup still fires.
 *
 * Uses a fully mocked S3 client so no real credentials are needed.
 * Runs automatically in CI as part of `npm test`.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  runS3CopyProbeWithClient,
  S3_COPY_PROBE_TAG,
  S3_PROBE_MSG_OK,
  S3_PROBE_MSG_COPY_FAILED,
  S3_PROBE_MSG_PROBE_ERROR,
} from "../replit_integrations/object_storage/objectStorage.js";

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
 * Builds a fake S3 client whose send() dispatches by command constructor name.
 *
 * @param opts.putThrows   — if true, PutObjectCommand rejects (tests outer-catch path)
 * @param opts.copyThrows  — if true, CopyObjectCommand rejects (tests inner-catch path)
 */
function makeMockS3(opts: {
  putThrows?: boolean;
  copyThrows?: boolean;
} = {}): {
  s3: { send: (cmd: any) => Promise<any> };
  calls: { put: number; copy: number; delete: number };
} {
  const calls = { put: 0, copy: 0, delete: 0 };

  const s3 = {
    send: async (cmd: any) => {
      const name: string = cmd?.constructor?.name ?? "";
      if (name === "PutObjectCommand") {
        calls.put++;
        if (opts.putThrows) throw new Error("403 Forbidden — s3:PutObject denied (simulated)");
      } else if (name === "CopyObjectCommand") {
        calls.copy++;
        if (opts.copyThrows) throw new Error("405 Method Not Allowed — CopyObject not supported (simulated)");
      } else if (name === "DeleteObjectCommand") {
        calls.delete++;
      }
    },
  };

  return { s3, calls };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("S3/R2 copy probe", () => {
  it("happy path — PutObject and CopyObject both succeed", async () => {
    const { s3, calls } = makeMockS3();
    const bucket = "mock-bucket-happy";

    const captured = await captureConsoleDuring(() =>
      runS3CopyProbeWithClient(s3, bucket, "_health_probe/test-s3-probe-1.txt"),
    );

    assert.ok(
      captured.logs.some(l => l.includes(`${S3_COPY_PROBE_TAG} ${S3_PROBE_MSG_OK}`)),
      `'${S3_PROBE_MSG_OK}' not found in logs: ${JSON.stringify(captured.logs)}`,
    );
    assert.equal(calls.put, 1, `PutObjectCommand call count: expected 1, got ${calls.put}`);
    assert.equal(calls.copy, 1, `CopyObjectCommand call count: expected 1, got ${calls.copy}`);
    assert.equal(calls.delete, 1, `DeleteObjectCommand call count: expected 1, got ${calls.delete}`);
    assert.equal(
      captured.warns.length,
      0,
      `unexpected WARN on happy path: ${JSON.stringify(captured.warns)}`,
    );
  });

  it("CopyObject failure — WARN logged, no uncaught exception, cleanup still runs", async () => {
    const { s3, calls } = makeMockS3({ copyThrows: true });
    const bucket = "mock-bucket-copy-fail";

    // Must not throw — any uncaught exception would fail this test automatically.
    const captured = await captureConsoleDuring(() =>
      runS3CopyProbeWithClient(s3, bucket, "_health_probe/test-s3-probe-2.txt"),
    );

    assert.ok(
      captured.warns.some(w => w.includes(`${S3_COPY_PROBE_TAG} ${S3_PROBE_MSG_COPY_FAILED}`)),
      `WARN line for CopyObject failure not found: ${JSON.stringify(captured.warns)}`,
    );
    assert.ok(
      captured.warns.some(w => w.includes("CopyObject not supported")),
      `WARN did not carry original error message: ${JSON.stringify(captured.warns)}`,
    );
    assert.equal(calls.put, 1, "PutObjectCommand must be called before CopyObject fails");
    assert.equal(
      calls.delete,
      1,
      `DeleteObjectCommand must be called after CopyObject failure (cleanup always runs); got ${calls.delete}`,
    );
  });

  it("PutObject failure — outer WARN logged, CopyObject skipped, cleanup still runs", async () => {
    const { s3, calls } = makeMockS3({ putThrows: true });
    const bucket = "mock-bucket-put-fail";

    const captured = await captureConsoleDuring(() =>
      runS3CopyProbeWithClient(s3, bucket, "_health_probe/test-s3-probe-3.txt"),
    );

    assert.ok(
      captured.warns.some(w => w.includes(`${S3_COPY_PROBE_TAG} ${S3_PROBE_MSG_PROBE_ERROR}`)),
      `outer WARN for PutObject failure not found: ${JSON.stringify(captured.warns)}`,
    );
    assert.equal(calls.copy, 0, "CopyObjectCommand must NOT be called after PutObject fails");
    assert.equal(
      calls.delete,
      1,
      `DeleteObjectCommand must be called even after PutObject failure (finally block); got ${calls.delete}`,
    );
  });
});
