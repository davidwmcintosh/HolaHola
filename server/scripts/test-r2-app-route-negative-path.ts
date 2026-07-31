/**
 * test-r2-app-route-negative-path.ts
 *
 * Negative-path validator for the app-route check inside test-r2-health-check.ts.
 *
 * WHAT THIS PROVES
 * ────────────────
 * test-r2-health-check.ts checks that the Express proxy route returns HTTP 200
 * with a non-empty body.  A green-only run cannot prove the guard has real bite —
 * it might always pass even if the route returns 404 or 503.
 *
 * This script imports the REAL `checkAppRouteUrl` function directly from
 * test-r2-health-check.ts (not a copy of it).  If anyone weakens or removes the
 * non-200 / 0-bytes branches in the production guard, this test will immediately
 * catch it in CI.
 *
 * Three steps:
 *   Step 1 — Negative path (non-200):
 *     Point checkAppRouteUrl at a local mock server that returns 503.
 *     Assert outcome === 'fail-non-200'.
 *
 *   Step 2 — Negative path (empty body):
 *     Point checkAppRouteUrl at a local mock server that returns 200 with
 *     an empty body.  Assert outcome === 'fail-empty'.
 *
 *   Step 3 — Positive path:
 *     Point checkAppRouteUrl at a local mock server that returns 200 with a
 *     non-empty body.  Assert outcome === 'pass'.
 *
 * Exits 0 when all assertions hold; exits 1 with a clear message otherwise.
 *
 * Run: npx tsx server/scripts/test-r2-app-route-negative-path.ts
 */

// ── Import the REAL guard function — not a copy ───────────────────────────────
// Both test-r2-health-check.ts and this script import from the same shared
// module (r2-app-route-check.ts).  If the non-200 / 0-bytes branches are
// weakened there, this test will immediately fail in CI.
import { checkAppRouteUrl } from './r2-app-route-check.js';

import * as http from 'http';
import * as net from 'net';

// ─── Colour helpers ───────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ─── Port helper ──────────────────────────────────────────────────────────────
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address() as net.AddressInfo;
      const port = addr.port;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
    srv.on('error', reject);
  });
}

// ─── Mock server factory ──────────────────────────────────────────────────────
async function startMockServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
): Promise<{ port: number; close: () => Promise<void> }> {
  const port = await getFreePort();
  const server = http.createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.listen(port, '127.0.0.1', resolve);
    server.on('error', reject);
  });
  const close = () =>
    new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  return { port, close };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

sep();
console.log(B('R2 app-route check — negative-path validator'));
console.log(Y('  Uses the real checkAppRouteUrl() from test-r2-health-check.ts.'));
console.log(Y('  If the non-200 guard is weakened in that file, this test fails.'));

let allPassed = true;
const PROBE_PATH = '/api/media/ai-image/test-r2-negative-path-probe.jpg';

// ══════════════════════════════════════════════════════════════════════════════
// STEP 1 — Negative path: 503 response must yield outcome 'fail-non-200'
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('Step 1 — Negative path: mock server returns HTTP 503'));
console.log(Y('  Expected: checkAppRouteUrl returns outcome === \'fail-non-200\'.'));

const srv503 = await startMockServer((_req, res) => {
  res.writeHead(503, { 'Content-Type': 'text/plain' });
  res.end('Service Unavailable');
});

const r503 = await checkAppRouteUrl(`http://127.0.0.1:${srv503.port}${PROBE_PATH}`);
await srv503.close();

console.log(`    outcome: ${r503.outcome}, status: ${r503.status ?? '—'}`);

if (r503.outcome === 'fail-non-200') {
  console.log(`\n  ${G('✓')} outcome is \'fail-non-200\' — guard fires on non-200 response.`);
  console.log(G('  STEP 1 PASSED.'));
} else {
  console.log(`\n  ${R(`✗ Expected 'fail-non-200', got '${r503.outcome}'.`)}`);
  console.log(R('  STEP 1 FAILED — the non-200 guard is silently broken.'));
  console.log(Y('  The check in test-r2-health-check.ts would pass even when the proxy'));
  console.log(Y('  returns a non-200 status, letting a broken media route ship undetected.'));
  allPassed = false;
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 2 — Negative path variant: 200 + empty body must yield 'fail-empty'
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('Step 2 — Negative path (variant): HTTP 200 with empty body'));
console.log(Y('  Expected: checkAppRouteUrl returns outcome === \'fail-empty\'.'));

const srvEmpty = await startMockServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': '0' });
  res.end();
});

const rEmpty = await checkAppRouteUrl(`http://127.0.0.1:${srvEmpty.port}${PROBE_PATH}`);
await srvEmpty.close();

console.log(`    outcome: ${rEmpty.outcome}, status: ${rEmpty.status ?? '—'}, bytes: ${rEmpty.bytes ?? '—'}`);

if (rEmpty.outcome === 'fail-empty') {
  console.log(`\n  ${G('✓')} outcome is \'fail-empty\' — 0-bytes guard fires.`);
  console.log(G('  STEP 2 PASSED.'));
} else {
  console.log(`\n  ${R(`✗ Expected 'fail-empty', got '${rEmpty.outcome}'.`)}`);
  console.log(R('  STEP 2 FAILED — the 0-bytes guard is silently broken.'));
  allPassed = false;
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 3 — Positive path: 200 + non-empty body must yield 'pass'
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('Step 3 — Positive path: HTTP 200 with non-empty body'));
console.log(Y('  Expected: checkAppRouteUrl returns outcome === \'pass\'.'));

const srvOk = await startMockServer((_req, res) => {
  const body = Buffer.from('FAKE_JPEG_BYTES_FOR_TESTING');
  res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': String(body.length) });
  res.end(body);
});

const rOk = await checkAppRouteUrl(`http://127.0.0.1:${srvOk.port}${PROBE_PATH}`);
await srvOk.close();

console.log(`    outcome: ${rOk.outcome}, status: ${rOk.status ?? '—'}, bytes: ${rOk.bytes ?? '—'}`);

if (rOk.outcome === 'pass') {
  console.log(`\n  ${G('✓')} outcome is \'pass\' — guard clears on valid response.`);
  console.log(G('  STEP 3 PASSED.'));
} else {
  console.log(`\n  ${R(`✗ Expected 'pass', got '${rOk.outcome}'.`)}`);
  console.log(R('  STEP 3 FAILED — the guard incorrectly rejects a valid 200 response.'));
  allPassed = false;
}

// ─── Summary ──────────────────────────────────────────────────────────────────
sep();
if (allPassed) {
  console.log(G('ALL STEPS PASSED'));
  console.log(G('  The real checkAppRouteUrl() from test-r2-health-check.ts has confirmed bite:'));
  console.log(G('  • outcome \'fail-non-200\' fires when the proxy returns 503.'));
  console.log(G('  • outcome \'fail-empty\' fires when the proxy returns 200 with an empty body.'));
  console.log(G('  • outcome \'pass\' is returned for a valid 200 response.'));
  console.log('');
} else {
  console.log(R('ONE OR MORE STEPS FAILED — see ✗ lines above.'));
  process.exit(1);
}
