/**
 * test-startup-liveness-check-error-path.ts
 *
 * CI check: confirms that when countUnembeddedConversationMemories() throws
 * (e.g. because the DB is unavailable at T+4h), scheduleStartupLivenessCheck's
 * catch block logs a "non-fatal" warning rather than silently swallowing the
 * error with no output at all.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Design notes  (read before modifying)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The liveness-check logic lives in runStartupLivenessCheckInner() in
 * server/services/memory-embedding-indexer.ts.  Its catch block logs:
 *
 *   console.warn('[EmbedIndexer] Startup liveness check failed (non-fatal):', err.message);
 *
 * The risk is that a future refactor silently removes this warn (or the entire
 * catch block), converting a DB-unavailable scenario at T+4h into a completely
 * silent failure — the server would appear healthy in logs while never
 * confirming embedding coverage.
 *
 * The test seam is the optional `countFn` parameter of
 * runStartupLivenessCheckInner().  In normal use it defaults to the real DB
 * query; in this script we pass a stub that throws a simulated DB error.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Normal mode
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. Replaces console.warn with a capturing stub.
 *   2. Calls runStartupLivenessCheckInner() with a countFn that throws
 *      "simulated DB connection failure".
 *   3. Restores console.warn.
 *   4. Asserts at least one captured warning contains "non-fatal".
 *   → PASS confirms the error path is NOT silently swallowed.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Proves the normal assertion would catch the regression where the non-fatal
 *   warning is removed from the catch block.
 *
 *   1. Runs a "broken" version of the inner check whose catch block is silent
 *      (models removing the console.warn).
 *   2. Asserts "non-fatal" is ABSENT from the captured output.
 *      This is the expected negative outcome — confirming that the normal-mode
 *      assertion (step 4) would exit 1 if the guard were deleted.
 *   3. Then re-runs the real runStartupLivenessCheckInner() with the same stub.
 *   4. Asserts "non-fatal" IS present — proving the gate is currently active.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Exit codes
 * ─────────────────────────────────────────────────────────────────────────────
 *   0 — PASS
 *   1 — FAIL
 *
 * Usage
 * ─────
 *   npx tsx server/scripts/test-startup-liveness-check-error-path.ts
 *   npx tsx server/scripts/test-startup-liveness-check-error-path.ts --self-check
 */

import { runStartupLivenessCheckInner } from '../services/memory-embedding-indexer';

// ── Colour helpers ────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;

const SELF_CHECK = process.argv.includes('--self-check');

// ── Stub that simulates a DB connection failure ───────────────────────────────
async function dbErrorStub(): Promise<number> {
  throw new Error('simulated DB connection failure');
}

// ── console.warn capture helper ───────────────────────────────────────────────
function captureWarn(fn: () => Promise<void>): Promise<string[]> {
  return new Promise(async (resolve) => {
    const captured: string[] = [];
    const original = console.warn;
    console.warn = (...args: any[]) => {
      captured.push(args.map(String).join(' '));
    };
    try {
      await fn();
    } finally {
      console.warn = original;
    }
    resolve(captured);
  });
}

// ── "Broken" inner check — catch block is silent (models the regression) ──────
async function runLivenessCheckBroken(countFn: () => Promise<number>): Promise<void> {
  try {
    const count = await countFn();
    if (count > 0) {
      console.warn(
        `[EmbedIndexer] ⚠ STARTUP LIVENESS CHECK (4h): ${count} conversation_memories row(s) ` +
        `still have no embedding after two indexer cycles. ` +
        `Run: npx tsx server/scripts/test-backfill-embeddings-complete.ts --patch`,
      );
    } else {
      console.log('[EmbedIndexer] ✓ Startup liveness check (4h): all conversation_memories rows embedded.');
    }
  } catch {
    // Silent catch — models the regression: non-fatal warn removed
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(B(`\n══ Startup Liveness Check Error-Path CI${SELF_CHECK ? ' (self-check)' : ''} ══\n`));

  let passed = 0;
  let failed = 0;

  function pass(label: string) {
    console.log(G(`  ✓ PASS`) + `  ${label}`);
    passed++;
  }

  function fail(label: string, detail?: string) {
    console.error(R(`  ✗ FAIL`) + `  ${label}`);
    if (detail) console.error(`        ${Y(detail)}`);
    failed++;
  }

  if (!SELF_CHECK) {
    // ── Normal mode ────────────────────────────────────────────────────────────
    console.log(Y('Round A — DB error stub → expect "non-fatal" warning'));

    const warns = await captureWarn(() => runStartupLivenessCheckInner(dbErrorStub));

    const nonFatalWarn = warns.find(w => w.includes('non-fatal'));
    if (nonFatalWarn) {
      pass(`"non-fatal" appears in console.warn output`);
      console.log(`        captured: ${Y(nonFatalWarn)}`);
    } else {
      fail(
        `"non-fatal" NOT found — error path is silently swallowed`,
        `captured warns (${warns.length}): ${JSON.stringify(warns)}`,
      );
    }

    // Sanity: no "non-fatal" when countFn succeeds normally
    console.log(Y('\nRound B — countFn returns 0 → no non-fatal warning expected'));
    const warnsOk = await captureWarn(() => runStartupLivenessCheckInner(async () => 0));
    const spurious = warnsOk.find(w => w.includes('non-fatal'));
    if (!spurious) {
      pass(`no spurious "non-fatal" warn on healthy DB`);
    } else {
      fail(`unexpected "non-fatal" warn on healthy DB`, spurious);
    }

    // Sanity: non-zero count logs its own warn but not "non-fatal"
    console.log(Y('\nRound C — countFn returns 5 → liveness warning but NOT non-fatal'));
    const warnsDark = await captureWarn(() => runStartupLivenessCheckInner(async () => 5));
    const hasDarkWarn  = warnsDark.some(w => w.includes('STARTUP LIVENESS CHECK'));
    const hasNonFatal  = warnsDark.some(w => w.includes('non-fatal'));
    if (hasDarkWarn) {
      pass(`dark-rows warning appears when count > 0`);
    } else {
      fail(`dark-rows warning absent when count > 0`, JSON.stringify(warnsDark));
    }
    if (!hasNonFatal) {
      pass(`no "non-fatal" warn on dark-rows path (not an error)`);
    } else {
      fail(`unexpected "non-fatal" warn on dark-rows path`, JSON.stringify(warnsDark));
    }

  } else {
    // ── Self-check mode ────────────────────────────────────────────────────────
    console.log(Y('Step 1 — broken catch (silent) → "non-fatal" must be ABSENT'));

    const warnsBroken = await captureWarn(() => runLivenessCheckBroken(dbErrorStub));
    const nonFatalBroken = warnsBroken.find(w => w.includes('non-fatal'));
    if (!nonFatalBroken) {
      pass(`"non-fatal" correctly absent from broken (silent-catch) version`);
      console.log(`        (confirms normal mode would FAIL if guard is removed)`);
    } else {
      fail(
        `"non-fatal" unexpectedly present in broken version — self-check is wrong`,
        nonFatalBroken,
      );
    }

    console.log(Y('\nStep 2 — real runStartupLivenessCheckInner → "non-fatal" must be PRESENT'));

    const warnsReal = await captureWarn(() => runStartupLivenessCheckInner(dbErrorStub));
    const nonFatalReal = warnsReal.find(w => w.includes('non-fatal'));
    if (nonFatalReal) {
      pass(`"non-fatal" present in real implementation — gate is active`);
      console.log(`        captured: ${Y(nonFatalReal)}`);
    } else {
      fail(
        `"non-fatal" NOT found in real implementation — guard appears missing`,
        `captured warns (${warnsReal.length}): ${JSON.stringify(warnsReal)}`,
      );
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${B('══ Summary ══')}  ${G(`${passed} passed`)}  ${failed > 0 ? R(`${failed} failed`) : ''}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(R('Unexpected error:'), err);
  process.exit(1);
});
