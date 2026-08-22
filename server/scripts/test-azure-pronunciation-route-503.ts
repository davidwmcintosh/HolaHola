/**
 * Integration test: POST /api/voice/assess-pronunciation returns HTTP 503
 * (not 500) when Azure credentials are wrong.
 *
 * What this verifies
 * ------------------
 * 1. The REAL route handler from server/handlers/pronunciation-assess.ts
 *    (the same code registered by routes.ts) catches an AzurePronunciationError.
 * 2. The catch block maps it to HTTP 503 — not 500 — for any category
 *    other than 'rate_limit'.
 * 3. The JSON body has the exact shape:
 *      { error: 'pronunciation_unavailable', reason: <non-empty string> }
 *
 * The handler under test is imported directly (not re-implemented), so any
 * future change to the catch block in pronunciation-assess.ts will be caught
 * by this test.
 *
 * Usage
 *   npx tsx --test server/scripts/test-azure-pronunciation-route-503.ts
 *
 * Exits 0 on success, non-zero on failure.
 */

// ------------------------------------------------------------------
// 1. Override Azure credentials BEFORE anything imports the service.
//    The service reads AZURE_SPEECH_KEY / AZURE_SPEECH_REGION at the
//    module-level const, so the override must happen before the first
//    dynamic import() inside the handler fires.
// ------------------------------------------------------------------
process.env.AZURE_SPEECH_KEY = "bad-key-intentionally-invalid-for-route-503-test";
process.env.AZURE_SPEECH_REGION = "westus";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express, { type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Buffer } from "node:buffer";

// Import the REAL handler — the same module registered by routes.ts.
// If the catch block changes in production, this test will catch it.
import { assessPronunciationHandler } from "../handlers/pronunciation-assess.js";

// ------------------------------------------------------------------
// 2. Build a minimal valid WAV buffer (silence, 16 kHz, 16-bit, mono).
//    Azure SDK validates the RIFF header before sending to the service.
// ------------------------------------------------------------------
function buildSilentWav(durationMs = 500): Buffer {
  const sampleRate = 16000;
  const bitsPerSample = 16;
  const numChannels = 1;
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

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
// 3. Minimal Express app using the REAL handler from routes.ts.
//    Auth (isAuthenticated) and rate-limiting (voiceLimiter) are
//    replaced with no-ops so we can reach the handler itself.
// ------------------------------------------------------------------
const upload = multer({ storage: multer.memoryStorage() });

// No-op auth: stamp a resolvedUserId so getRequestUserId() in the handler
// returns a non-empty string, matching what isAuthenticated would do.
function mockAuth(req: Request, _res: Response, next: NextFunction): void {
  (req as any).resolvedUserId = "test-user-503";
  next();
}

const app = express();
app.use(express.json());

app.post(
  "/api/voice/assess-pronunciation",
  mockAuth,
  upload.single("audio"),
  assessPronunciationHandler   // ← real production handler, not a copy
);

// ------------------------------------------------------------------
// 4. Start / stop helpers
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
// 5. Tests
// ------------------------------------------------------------------
describe("POST /api/voice/assess-pronunciation with invalid Azure credentials", () => {
  before(async () => {
    await startServer();
    console.log(`[route-503-test] Server listening at ${baseUrl}`);
  });

  after(async () => {
    await stopServer();
    console.log("[route-503-test] Server stopped.");
  });

  it("returns HTTP 503 when Azure rejects the key", async () => {
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

    console.log("[route-503-test] ✓ status     :", res.status);
    console.log("[route-503-test] ✓ error      :", body.error);
    console.log(
      "[route-503-test] ✓ reason     :",
      String(body.reason).slice(0, 150)
    );
  });

  it("does NOT return HTTP 500 for an Azure auth failure (regression guard)", async () => {
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
      "Route must not return 500 for an AzurePronunciationError — expected 503"
    );
  });
});
