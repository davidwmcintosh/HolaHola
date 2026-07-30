/**
 * Integration test: POST /api/voice/assess-pronunciation returns HTTP 429
 * (not 503 or 500) when Azure signals a rate-limit failure.
 *
 * What this verifies
 * ------------------
 * 1. The REAL route handler from server/handlers/pronunciation-assess.ts
 *    (the same code registered by routes.ts) catches an AzurePronunciationError
 *    whose category is 'rate_limit'.
 * 2. The catch block maps category='rate_limit' to HTTP 429 — not 503, not 500.
 * 3. The JSON body has the exact shape:
 *      { error: 'pronunciation_unavailable', reason: <non-empty string> }
 *
 * Injection strategy
 * ------------------
 * The handler calls `await import('../services/azure-pronunciation-service.js')`
 * dynamically.  Because Node.js caches modules after the first resolution, we
 * can pre-import the service, monkey-patch its `assessPronunciation` method to
 * throw an AzurePronunciationError with category='rate_limit', and the handler
 * will call our patched version.  No production code changes required.
 *
 * Usage
 *   npx tsx --test server/scripts/test-azure-pronunciation-route-429.ts
 *
 * Exits 0 on success, non-zero on failure.
 */

// ------------------------------------------------------------------
// 1. Set Azure env vars so the service reports isAvailable()=true
//    (the handler returns 503 early if isAvailable() is false).
// ------------------------------------------------------------------
process.env.AZURE_SPEECH_KEY    = "fake-key-for-429-test";
process.env.AZURE_SPEECH_REGION = "westus";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express, { type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Buffer } from "node:buffer";

// ------------------------------------------------------------------
// 2. Pre-load the service module so we can patch it before the
//    handler's dynamic import() hits the module cache.
// ------------------------------------------------------------------
import * as azureSvcModule from "../services/azure-pronunciation-service.js";
import { AzurePronunciationError } from "../services/azure-pronunciation-service.js";

// Force isAvailable() to return true (key/region are set above, but the
// service reads them at module-level const before our assignment runs on
// some Node import-order paths — patching the method is the safe approach).
const svc = azureSvcModule.azurePronunciationService as any;
const originalIsAvailable      = svc.isAvailable.bind(svc);
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
// 5. Minimal Express app using the REAL handler.
// ------------------------------------------------------------------
const upload = multer({ storage: multer.memoryStorage() });

function mockAuth(req: Request, _res: Response, next: NextFunction): void {
  (req as any).resolvedUserId = "test-user-429";
  next();
}

const app = express();
app.use(express.json());

app.post(
  "/api/voice/assess-pronunciation",
  mockAuth,
  upload.single("audio"),
  assessPronunciationHandler   // ← real production handler
);

// ------------------------------------------------------------------
// 6. Start / stop helpers
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
// 7. Tests
// ------------------------------------------------------------------
describe("POST /api/voice/assess-pronunciation — rate-limit branch (HTTP 429)", () => {
  before(async () => {
    // Patch the service singleton so the handler sees:
    //   isAvailable()        → true  (otherwise 503 fires early)
    //   assessPronunciation() → throws AzurePronunciationError(category='rate_limit')
    svc.isAvailable = () => true;
    svc.assessPronunciation = async () => {
      throw new AzurePronunciationError(
        "Azure Speech rate limit exceeded — too many requests",
        "rate_limit"
      );
    };

    await startServer();
    console.log(`[route-429-test] Server listening at ${baseUrl}`);
  });

  after(async () => {
    // Restore original methods.
    svc.isAvailable           = originalIsAvailable;
    svc.assessPronunciation   = originalAssessPronunciation;

    await stopServer();
    console.log("[route-429-test] Server stopped.");
  });

  it("returns HTTP 429 when Azure signals a rate-limit error", async () => {
    const wav = buildSilentWav(500);

    const form = new FormData();
    form.append(
      "audio",
      new Blob([wav], { type: "audio/wav" }),
      "test.wav"
    );
    form.append("referenceText", "hola");
    form.append("language", "spanish");

    const res = await fetch(`${baseUrl}/api/voice/assess-pronunciation`, {
      method: "POST",
      body: form,
    });

    assert.equal(
      res.status,
      429,
      `Expected HTTP 429 but received ${res.status}`
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

    console.log("[route-429-test] ✓ status :", res.status);
    console.log("[route-429-test] ✓ error  :", body.error);
    console.log("[route-429-test] ✓ reason :", String(body.reason).slice(0, 150));
  });

  it("does NOT return HTTP 503 for a rate-limit error (regression guard)", async () => {
    const wav = buildSilentWav(500);

    const form = new FormData();
    form.append(
      "audio",
      new Blob([wav], { type: "audio/wav" }),
      "test.wav"
    );
    form.append("referenceText", "hola");
    form.append("language", "spanish");

    const res = await fetch(`${baseUrl}/api/voice/assess-pronunciation`, {
      method: "POST",
      body: form,
    });

    assert.notEqual(
      res.status,
      503,
      "Route must not return 503 for a rate-limit AzurePronunciationError — expected 429"
    );
  });

  it("does NOT return HTTP 500 for a rate-limit error (regression guard)", async () => {
    const wav = buildSilentWav(500);

    const form = new FormData();
    form.append(
      "audio",
      new Blob([wav], { type: "audio/wav" }),
      "test.wav"
    );
    form.append("referenceText", "hola");
    form.append("language", "spanish");

    const res = await fetch(`${baseUrl}/api/voice/assess-pronunciation`, {
      method: "POST",
      body: form,
    });

    assert.notEqual(
      res.status,
      500,
      "Route must not return 500 for a rate-limit AzurePronunciationError — expected 429"
    );
  });
});
