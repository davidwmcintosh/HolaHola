/**
 * Integration test: POST /api/voice/assess-pronunciation returns HTTP 503
 * (not 500) when AzurePronunciationError carries a completely unrecognised
 * category string (e.g. 'timeout' or 'quota').
 *
 * What this verifies
 * ------------------
 * The catch block in server/handlers/pronunciation-assess.ts maps:
 *   category === 'rate_limit'  →  HTTP 429
 *   anything else              →  HTTP 503
 *
 * A future refactor (e.g. a switch with a default that falls through to 500)
 * could silently break the 'else → 503' contract.  This test uses a novel
 * category value that is guaranteed never to match 'rate_limit', confirming
 * the fallthrough path stays on 503.
 *
 * Injection strategy
 * ------------------
 * The handler calls `await import('../services/azure-pronunciation-service.js')`
 * dynamically.  Node.js caches modules after the first resolution, so we
 * pre-import the service, monkey-patch its `assessPronunciation` method, and
 * the handler will call our patched version.  No production code changes needed.
 *
 * Usage
 *   npx tsx --test server/scripts/test-azure-pronunciation-route-503-unrecognised-category.ts
 *
 * Exits 0 on success, non-zero on failure.
 */

// ------------------------------------------------------------------
// 1. Set Azure env vars so the service reports isAvailable()=true
//    (the handler returns 503 early if isAvailable() is false).
// ------------------------------------------------------------------
process.env.AZURE_SPEECH_KEY    = "fake-key-for-503-unrecognised-test";
process.env.AZURE_SPEECH_REGION = "westus";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express, { type Request, type NextFunction } from "express";
import multer from "multer";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Buffer } from "node:buffer";

// ------------------------------------------------------------------
// 2. Pre-load the service module so we can patch it before the
//    handler's dynamic import() hits the module cache.
// ------------------------------------------------------------------
import * as azureSvcModule from "../services/azure-pronunciation-service.js";

const svc = azureSvcModule.azurePronunciationService as any;

/**
 * Build an error object that satisfies the handler's duck-type check
 *   if (error?.name === "AzurePronunciationError") { ... error.category ... }
 * without going through the AzurePronunciationError constructor, whose
 * category parameter is typed as 'auth'|'rate_limit'|'network'|'unknown'.
 * This lets us pass truly novel category strings (e.g. 'timeout', 'quota')
 * while keeping the file typecheck-clean.
 */
function makeUnrecognisedError(message: string, category: string): Error {
  const err = new Error(message);
  err.name = "AzurePronunciationError";
  (err as any).category = category;
  return err;
}
const originalIsAvailable         = svc.isAvailable.bind(svc);
const originalAssessPronunciation = svc.assessPronunciation.bind(svc);

// ------------------------------------------------------------------
// 3. Import the REAL handler — same module that routes.ts registers.
// ------------------------------------------------------------------
import { assessPronunciationHandler } from "../handlers/pronunciation-assess.js";

// ------------------------------------------------------------------
// 4. Build a minimal valid WAV buffer (silence, 16 kHz, 16-bit, mono).
// ------------------------------------------------------------------
function buildSilentWav(durationMs = 500): Buffer {
  const sampleRate    = 16000;
  const bitsPerSample = 16;
  const numChannels   = 1;
  const numSamples    = Math.floor((sampleRate * durationMs) / 1000);
  const dataSize      = numSamples * numChannels * (bitsPerSample / 8);
  const byteRate      = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign    = (numChannels * bitsPerSample) / 8;

  const buf = Buffer.alloc(44 + dataSize, 0);

  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, "ascii");

  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);           // PCM
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);

  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);

  return buf;
}

// ------------------------------------------------------------------
// 5. Helper: POST a WAV to the running test server.
// ------------------------------------------------------------------
async function postWav(baseUrl: string): Promise<Response> {
  const wav  = buildSilentWav(500);
  const form = new FormData();
  form.append("audio",         new Blob([wav], { type: "audio/wav" }), "test.wav");
  form.append("referenceText", "hola");
  form.append("language",      "spanish");

  return fetch(`${baseUrl}/api/voice/assess-pronunciation`, {
    method: "POST",
    body: form,
  });
}

// ------------------------------------------------------------------
// 6. Minimal Express app using the REAL handler.
// ------------------------------------------------------------------
const upload = multer({ storage: multer.memoryStorage() });

function mockAuth(req: Request, _res: express.Response, next: NextFunction): void {
  (req as any).resolvedUserId = "test-user-503-unrecognised";
  next();
}

const app = express();
app.use(express.json());
app.post(
  "/api/voice/assess-pronunciation",
  mockAuth,
  upload.single("audio"),
  assessPronunciationHandler  // ← real production handler
);

// ------------------------------------------------------------------
// 7. Start / stop helpers
// ------------------------------------------------------------------
let server: Server;
let baseUrl: string;

async function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server = createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

async function stopServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

// ------------------------------------------------------------------
// 8. Tests — category='timeout' (completely unrecognised category)
// ------------------------------------------------------------------
describe("POST /api/voice/assess-pronunciation — unrecognised category='timeout' → HTTP 503", () => {
  before(async () => {
    svc.isAvailable = () => true;
    svc.assessPronunciation = async () => {
      throw makeUnrecognisedError(
        "Azure Speech timed out waiting for a response",
        "timeout"
      );
    };
    await startServer();
    console.log(`[route-503-timeout-test] Server listening at ${baseUrl}`);
  });

  after(async () => {
    svc.isAvailable         = originalIsAvailable;
    svc.assessPronunciation = originalAssessPronunciation;
    await stopServer();
    console.log("[route-503-timeout-test] Server stopped.");
  });

  it("returns HTTP 503 for a completely unrecognised category='timeout'", async () => {
    const res = await postWav(baseUrl);

    assert.equal(
      res.status,
      503,
      `Expected HTTP 503 but received ${res.status}`
    );

    const body = await res.json() as Record<string, unknown>;

    assert.equal(
      body.error,
      "pronunciation_unavailable",
      `Expected error='pronunciation_unavailable', got '${body.error}'`
    );

    assert.ok(
      typeof body.reason === "string" && body.reason.length > 0,
      `Expected a non-empty reason string, got: ${JSON.stringify(body.reason)}`
    );

    console.log("[route-503-timeout-test] ✓ status :", res.status);
    console.log("[route-503-timeout-test] ✓ error  :", body.error);
    console.log("[route-503-timeout-test] ✓ reason :", String(body.reason).slice(0, 150));
  });

  it("does NOT return HTTP 500 for an unrecognised category (regression guard)", async () => {
    const res = await postWav(baseUrl);

    assert.notEqual(
      res.status,
      500,
      "Route must not return 500 for an unrecognised AzurePronunciationError category — expected 503"
    );
  });

  it("does NOT return HTTP 429 for an unrecognised category (regression guard)", async () => {
    const res = await postWav(baseUrl);

    assert.notEqual(
      res.status,
      429,
      "Route must not return 429 for an unrecognised AzurePronunciationError category — expected 503"
    );
  });
});

// ------------------------------------------------------------------
// 9. Tests — category='quota' (second unrecognised category)
// ------------------------------------------------------------------
describe("POST /api/voice/assess-pronunciation — unrecognised category='quota' → HTTP 503", () => {
  before(async () => {
    svc.isAvailable = () => true;
    svc.assessPronunciation = async () => {
      throw makeUnrecognisedError(
        "Azure Speech quota exceeded for this billing period",
        "quota"
      );
    };
    await startServer();
    console.log(`[route-503-quota-test] Server listening at ${baseUrl}`);
  });

  after(async () => {
    svc.isAvailable         = originalIsAvailable;
    svc.assessPronunciation = originalAssessPronunciation;
    await stopServer();
    console.log("[route-503-quota-test] Server stopped.");
  });

  it("returns HTTP 503 for a completely unrecognised category='quota'", async () => {
    const res = await postWav(baseUrl);

    assert.equal(
      res.status,
      503,
      `Expected HTTP 503 but received ${res.status}`
    );

    const body = await res.json() as Record<string, unknown>;

    assert.equal(
      body.error,
      "pronunciation_unavailable",
      `Expected error='pronunciation_unavailable', got '${body.error}'`
    );

    assert.ok(
      typeof body.reason === "string" && body.reason.length > 0,
      `Expected a non-empty reason string, got: ${JSON.stringify(body.reason)}`
    );

    console.log("[route-503-quota-test] ✓ status :", res.status);
    console.log("[route-503-quota-test] ✓ error  :", body.error);
    console.log("[route-503-quota-test] ✓ reason :", String(body.reason).slice(0, 150));
  });

  it("does NOT return HTTP 500 for an unrecognised category='quota' (regression guard)", async () => {
    const res = await postWav(baseUrl);

    assert.notEqual(
      res.status,
      500,
      "Route must not return 500 for an unrecognised AzurePronunciationError category — expected 503"
    );
  });
});
