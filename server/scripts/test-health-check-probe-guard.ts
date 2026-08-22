#!/usr/bin/env npx tsx
/**
 * CI: Confirm the production health-check UA-intercept guard catches empty-UA
 * probers and known infra user-agents before they can fall through to serveStatic
 * and trigger a deployment death-spiral.
 *
 * Imports the REAL production middleware (server/health-probe-guard.ts) so any
 * regression in that module will immediately break this check.
 *
 * Tests (normal mode):
 *  1. GET /  with no User-Agent          → 200 "OK"   (intercepted)
 *  2. GET /  with empty-string UA        → 200 "OK"   (intercepted)
 *  3. GET /  with Go-http-client/1.1     → 200 "OK"   (intercepted)
 *  4. GET /  with GoogleHC/1.0           → 200 "OK"   (intercepted)
 *  5. GET /  with health-checker/1.0     → 200 "OK"   (intercepted)
 *  6. GET /  with kube-probe/1.27        → 200 "OK"   (intercepted)
 *  7. GET /  with Mozilla/5.0 (browser)  → 500        (passes through to mock static)
 *  8. GET /  with curl/7.88.1            → 500        (passes through to mock static)
 *  9. GET /api/me with no User-Agent     → 500        (path ≠ "/" — not intercepted)
 * 10. POST / with no User-Agent          → 500        (method ≠ GET — not intercepted)
 *
 * Self-check mode (--self-check):
 *  Reads server/health-probe-guard.ts source and asserts that the critical
 *  `ua === ""` clause is still present. Fails loudly if it has been removed.
 *  Also runs the full test suite with a locally-broken detector (ua==='' removed)
 *  and confirms the no-UA cases then fail, proving the clause is load-bearing.
 */

import express from "express";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { AddressInfo } from "net";

// ── Import the REAL production guard ─────────────────────────────────────────
import {
  healthProbeGuardMiddleware,
  isHealthProbe,
} from "../health-probe-guard.js";

// ── Broken detector for self-check simulation ─────────────────────────────────
// Mirrors isHealthProbe but with the `ua === ""` branch removed.
// Used only to confirm the clause is load-bearing — never shipped.
function brokenIsProbe(ua: string): boolean {
  return (
    // ua === ""  ← INTENTIONALLY REMOVED for self-check
    ua.startsWith("GoogleHC") ||
    ua.startsWith("Go-http-client") ||
    ua.toLowerCase().includes("health") ||
    ua.toLowerCase().includes("kube-probe")
  );
}

// ── Build a test Express app ─────────────────────────────────────────────────

type Middleware = (req: express.Request, res: express.Response, next: express.NextFunction) => void;

function buildApp(guardMiddleware: Middleware) {
  const app = express();
  app.use(guardMiddleware);
  // Mock serveStatic — would 500 if reached by a probe that was not intercepted.
  app.use("*", (_req, res) => {
    res.status(500).send("REACHED_STATIC");
  });
  return app;
}

function buildBrokenApp() {
  const app = express();
  // Inline equivalent of healthProbeGuardMiddleware using brokenIsProbe
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    if (req.path !== "/") return next();
    const ua = (req.get("user-agent") || "").trim();
    if (brokenIsProbe(ua)) {
      res.status(200).send("OK");
      return;
    }
    next();
  });
  app.use("*", (_req, res) => {
    res.status(500).send("REACHED_STATIC");
  });
  return app;
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function doGet(
  port: number,
  reqPath: string,
  ua: string | undefined,
  method = "GET",
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (ua !== undefined) headers["User-Agent"] = ua;
    const options = { host: "127.0.0.1", port, path: reqPath, method, headers };
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

// ── Test runner ───────────────────────────────────────────────────────────────

interface Case {
  description: string;
  path: string;
  ua: string | undefined;
  method?: string;
  expectedStatus: number;
  expectedBody?: string;
}

const CASES: Case[] = [
  // Probe cases — must be intercepted at GET /
  { description: "no User-Agent header → 200 OK",         path: "/", ua: undefined,                                                        expectedStatus: 200, expectedBody: "OK" },
  { description: "empty string UA → 200 OK",              path: "/", ua: "",                                                               expectedStatus: 200, expectedBody: "OK" },
  { description: "Go-http-client/1.1 → 200 OK",           path: "/", ua: "Go-http-client/1.1",                                             expectedStatus: 200, expectedBody: "OK" },
  { description: "GoogleHC/1.0 → 200 OK",                 path: "/", ua: "GoogleHC/1.0",                                                   expectedStatus: 200, expectedBody: "OK" },
  { description: "health-checker/1.0 → 200 OK",           path: "/", ua: "health-checker/1.0",                                             expectedStatus: 200, expectedBody: "OK" },
  { description: "kube-probe/1.27 → 200 OK",              path: "/", ua: "kube-probe/1.27",                                                expectedStatus: 200, expectedBody: "OK" },
  // Real clients — must NOT be intercepted
  { description: "Mozilla/5.0 browser → passes through",  path: "/", ua: "Mozilla/5.0 (Macintosh) AppleWebKit/537.36",                    expectedStatus: 500, expectedBody: "REACHED_STATIC" },
  { description: "curl/7.88.1 → passes through",          path: "/", ua: "curl/7.88.1",                                                   expectedStatus: 500, expectedBody: "REACHED_STATIC" },
  // Path restriction — non-root paths must not be intercepted even with no UA
  { description: "GET /api/me no-UA → NOT intercepted (wrong path)", path: "/api/me", ua: undefined,                                       expectedStatus: 500, expectedBody: "REACHED_STATIC" },
  // Method restriction — non-GET must not be intercepted
  { description: "POST / no-UA → NOT intercepted (wrong method)",    path: "/",      ua: undefined,       method: "POST",                  expectedStatus: 500, expectedBody: "REACHED_STATIC" },
];

async function runSuite(
  app: express.Express,
  label: string,
): Promise<{ passed: number; failed: string[] }> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;

  const failed: string[] = [];
  let passed = 0;

  for (const c of CASES) {
    const result = await doGet(port, c.path, c.ua, c.method ?? "GET");
    const statusOk = result.status === c.expectedStatus;
    const bodyOk = c.expectedBody === undefined || result.body === c.expectedBody;
    if (statusOk && bodyOk) {
      console.log(`  [${label}] ✓ ${c.description}`);
      passed++;
    } else {
      const detail = `status=${result.status} (expected ${c.expectedStatus}), body=${JSON.stringify(result.body)}`;
      console.error(`  [${label}] ✗ ${c.description} — ${detail}`);
      failed.push(c.description);
    }
  }

  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );

  return { passed, failed };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const selfCheck = process.argv.includes("--self-check");

  if (!selfCheck) {
    // ── Normal mode ────────────────────────────────────────────────────────
    console.log("");
    console.log("health-check probe guard — normal mode (production middleware)");
    console.log("────────────────────────────────────────────────────────────────");
    const { passed, failed } = await runSuite(buildApp(healthProbeGuardMiddleware), "prod");
    console.log("");
    if (failed.length > 0) {
      console.error(`FAIL: ${failed.length} assertion(s) failed:`);
      failed.forEach((f) => console.error(`  • ${f}`));
      process.exit(1);
    }
    console.log(`PASS: all ${passed} assertions passed`);
    process.exit(0);
  }

  // ── Self-check mode ────────────────────────────────────────────────────────
  console.log("");
  console.log("health-check probe guard — self-check");
  console.log("──────────────────────────────────────");

  let allOk = true;

  // 1. Source-level contract: confirm `ua === ""` is still in the production guard.
  const guardSrc = fs.readFileSync(
    path.resolve(import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url)), "..", "health-probe-guard.ts"),
    "utf-8",
  );
  if (guardSrc.includes('ua === ""')) {
    console.log('  ✓ source contract: `ua === ""` clause is present in health-probe-guard.ts');
  } else {
    console.error('  ✗ source contract FAILED: `ua === ""` clause is MISSING from health-probe-guard.ts');
    allOk = false;
  }

  // 2. Behavioral simulation: run the suite with the broken detector and confirm
  //    the no-UA cases fail, proving the clause is load-bearing.
  console.log("");
  console.log("  Running suite with broken detector (ua==='' removed)…");
  const { failed: brokenFailed } = await runSuite(buildBrokenApp(), "broken");

  const expectedFailures = [
    "no User-Agent header → 200 OK",
    "empty string UA → 200 OK",
  ];

  const missingFailures = expectedFailures.filter((e) => !brokenFailed.includes(e));
  const unexpectedFailures = brokenFailed.filter((f) => !expectedFailures.includes(f));

  console.log("");
  if (missingFailures.length > 0) {
    console.error("  ✗ broken detector did NOT fail the expected no-UA assertions:");
    missingFailures.forEach((f) => console.error(`    • ${f}`));
    allOk = false;
  } else {
    console.log("  ✓ broken detector correctly fails the no-UA assertions");
  }

  if (unexpectedFailures.length > 0) {
    console.error("  ✗ broken detector failed unexpected assertions (guard too broad?):");
    unexpectedFailures.forEach((f) => console.error(`    • ${f}`));
    allOk = false;
  }

  console.log("");
  if (!allOk) {
    console.error("SELF-CHECK FAILED");
    process.exit(1);
  }
  console.log("SELF-CHECK PASSED: ua==='' clause is present and load-bearing");
  process.exit(0);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
