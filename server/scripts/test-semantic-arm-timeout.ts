/**
 * test-semantic-arm-timeout.ts
 *
 * CI self-check: confirms that the Arm 4 semantic search inside
 * processUnifiedRecall (native-fc-handlers.ts) has:
 *
 *   1. A 3000ms delay in the actual Promise.race setTimeout call (not just
 *      the number 3000 appearing somewhere in log text or comments).
 *   2. A named rejection marker ('semantic-arm-timeout') inside the
 *      Promise.race reject, so the catch block can distinguish a real
 *      timeout from a zero-result ("genuinely empty") search.
 *   3. A catch-block branch that specifically tests for the marker and logs
 *      "timed out" — checked in the catch body only, not the whole arm.
 *   4. A "genuinely empty" log on the zero-result path in the try body,
 *      distinct from the timeout path.
 *
 * Background
 * ──────────
 * Before this guard, a pgvector pool drop and a genuine zero-result search
 * were indistinguishable: both silently returned null with no log.  A future
 * regression that reverts the timeout or removes the log distinction would be
 * invisible at runtime.
 *
 * Tests
 * ─────
 *   1. Arm 4 setTimeout delay is 3000ms (checked in the Promise.race body).
 *   2. Rejection marker 'semantic-arm-timeout' present in the Promise.race.
 *   3. Catch block branches on the marker and logs "timed out".
 *   4. Zero-result try-body path logs "genuinely empty".
 *
 * Self-check (--self-check)
 * ─────────────────────────
 *   Runs three independent mutations, one per structurally distinct check,
 *   and confirms the corresponding assertion fails in isolation:
 *
 *   Mutation A — change the setTimeout delay from 3000 to 1500.
 *                Check 1 must fail; checks 3 and 4 must still pass.
 *
 *   Mutation B — strip the `if (semantic-arm-timeout)` branch from the
 *                catch body, leaving only the generic else-if path.
 *                Check 3 must fail; checks 1 and 4 must still pass.
 *
 *   Mutation C — remove the "genuinely empty" log from the try body.
 *                Check 4 must fail; checks 1 and 3 must still pass.
 *
 * Run
 * ───
 *   npx tsx server/scripts/test-semantic-arm-timeout.ts
 *   npx tsx server/scripts/test-semantic-arm-timeout.ts --self-check
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const G   = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R   = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B   = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y   = (s: string) => `\x1b[33m${s}\x1b[0m`;
const DIM = (s: string) => `\x1b[2m${s}\x1b[0m`;
const sep = () => console.log('─'.repeat(70));

const SELF_CHECK = process.argv.includes('--self-check');

const SOURCE_FILE = path.resolve(
  path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))),
  'server/services/native-fc-handlers.ts',
);

let passed = 0;
let failed = 0;

function assert(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ${G('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${R('✗')} ${label}${detail ? `\n       ${detail}` : ''}`);
    failed++;
  }
}

// ─── Extraction helpers ────────────────────────────────────────────────────────

/**
 * Extract the Arm 4 block: from "Arm 4: Semantic similarity search" comment
 * to the "Arm 5:" comment.  Scopes all checks to the right code section.
 */
function extractArm4(source: string): string {
  const start = source.indexOf('Arm 4: Semantic similarity search');
  if (start < 0) return '';
  const end = source.indexOf('Arm 5:', start);
  return end > start ? source.slice(start, end) : source.slice(start, start + 6000);
}

/**
 * Split the Arm 4 block into its try body and catch body.
 *
 * The split point is `} catch (err: any) {`.  Everything before is the try
 * body (setTimeout, hits.length guard, hydration); everything from that point
 * on is the catch body.  Checking each part separately prevents a catch-body
 * keyword from satisfying a try-body assertion or vice-versa.
 */
function splitArm4(arm4: string): { tryBody: string; catchBody: string } {
  const CATCH_MARKER = '} catch (err: any) {';
  // Use lastIndexOf so we get the outer catch, not one inside a nested callback
  const catchIdx = arm4.lastIndexOf(CATCH_MARKER);
  if (catchIdx < 0) return { tryBody: arm4, catchBody: '' };
  return {
    tryBody:   arm4.slice(0, catchIdx),
    catchBody: arm4.slice(catchIdx),
  };
}

// ─── Individual check predicates ─────────────────────────────────────────────

/**
 * Check 1: The actual Promise.race setTimeout delay is 3000ms.
 *
 * Looks for `arm4Timer = setTimeout` (assignment, not any setTimeout call)
 * AND `}, 3000)` in the same try body.  The pattern `}, 3000)` is the unique
 * closing line of the multi-line setTimeout callback — it cannot match a log
 * string or comment because those never contain `}, 3000)`.
 */
function check1_timeout3000(tryBody: string): boolean {
  const hasTimer   = tryBody.includes('arm4Timer = setTimeout');
  const hasDelay   = /\},\s*3000\s*\)/.test(tryBody);
  return hasTimer && hasDelay;
}

/**
 * Check 2: The actual Promise.race timer uses `reject(new Error('semantic-arm-timeout'))`.
 *
 * Checking the specific rejection expression (not just the literal string) prevents
 * a false pass from the Arm 4 IMPORTANT comment, which also contains the literal
 * `'semantic-arm-timeout'` but is not the code path that matters.
 */
function check2_marker(tryBody: string): boolean {
  return tryBody.includes("reject(new Error('semantic-arm-timeout'))");
}

/**
 * Check 3: Catch body has the `semantic-arm-timeout` branch AND logs "timed out".
 *
 * Both strings must appear in the CATCH body only.  The timer callback's own
 * inline console.warn is in the try body and does not satisfy this check.
 */
function check3_catchBranch(catchBody: string): boolean {
  const hasBranch  = catchBody.includes('semantic-arm-timeout');
  const hasTimedOut = /timed out|timedOut|Timed out/i.test(catchBody);
  return hasBranch && hasTimedOut;
}

/**
 * Check 4: Zero-result path in the try body logs "genuinely empty".
 *
 * Uses the phrase unique to the log line ("genuinely empty — no vector matches")
 * rather than the shorter "genuinely empty" which also appears in the Arm 4
 * comment explaining the distinction.
 */
function check4_genuinelyEmpty(tryBody: string): boolean {
  return tryBody.includes('genuinely empty — no vector matches');
}

// ─── Mutation helpers for self-check ─────────────────────────────────────────

/**
 * Mutation A: regress the setTimeout delay from 3000 → 1500.
 * Only targets `}, 3000)` (the delay argument), not "3000ms" in log strings.
 */
function mutateA_delay(arm4: string): string {
  return arm4.replace(/(\},\s*)3000(\s*\))/, '$1' + '1500' + '$2');
}

/**
 * Mutation B: remove the `semantic-arm-timeout` catch branch.
 * Replaces the if/else-if structure with just the else-if body, simulating
 * a regression where the distinction was deleted.
 */
function mutateB_catchBranch(arm4: string): string {
  // Remove: `if (err.message?.includes('semantic-arm-timeout')) {
  //            console.warn(`..timed out..`);
  //          } else ` (the else connects to the next if)
  return arm4.replace(
    /if \(err\.message\?\.includes\('semantic-arm-timeout'\)\) \{[^}]+\} else /,
    ''
  );
}

/**
 * Mutation C: remove the "genuinely empty" log from the try body.
 * Replaces the if-block that logs + returns null with just `return null;`.
 */
function mutateC_genuinelyEmpty(arm4: string): string {
  return arm4.replace(
    /console\.log\(`\[UnifiedRecall\] Semantic arm: genuinely empty[^`]*`\);\s*/,
    ''
  );
}

/**
 * Mutation D: change the timer rejection from `semantic-arm-timeout` to the
 * generic `timeout`.  This simulates removing the named marker from the actual
 * reject() call while leaving the Arm 4 IMPORTANT comment and catch-body
 * unchanged — proving Check 2 is scoped to the reject() expression, not the
 * comment literal.
 */
function mutateD_timerMarker(arm4: string): string {
  return arm4.replace(
    "reject(new Error('semantic-arm-timeout'))",
    "reject(new Error('timeout'))"
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log('');
  console.log(B(SELF_CHECK
    ? '  SEMANTIC ARM TIMEOUT GUARD — SELF-CHECK'
    : '  SEMANTIC ARM TIMEOUT GUARD — CI CHECK'));
  sep();

  if (!fs.existsSync(SOURCE_FILE)) {
    console.log(R(`FATAL: source file not found: ${SOURCE_FILE}`));
    process.exit(1);
  }

  const source = fs.readFileSync(SOURCE_FILE, 'utf8');
  const arm4   = extractArm4(source);

  if (!arm4) {
    console.log(R(`FATAL: "Arm 4: Semantic similarity search" not found in ${SOURCE_FILE}`));
    console.log(Y('  This means the arm was renamed or removed — the guard no longer exists.'));
    process.exit(1);
  }

  const { tryBody, catchBody } = splitArm4(arm4);

  console.log(DIM(`  Source: ${SOURCE_FILE}`));
  console.log(DIM(`  Arm 4 block: ${arm4.length} chars  |  try body: ${tryBody.length}  |  catch body: ${catchBody.length}`));
  console.log('');

  if (SELF_CHECK) {
    // ═══════════════════════════════════════════════════════════════════════
    // SELF-CHECK MODE
    // Three independent mutations — each must break exactly one check.
    // ═══════════════════════════════════════════════════════════════════════

    // ── Mutation A: delay 3000 → 1500 — Check 1 must fail ─────────────────
    console.log(B('Mutation A — delay 3000 → 1500 (Check 1 must fail, checks 3+4 must pass)'));
    sep();
    {
      const mutA = mutateA_delay(arm4);
      const { tryBody: tA, catchBody: cA } = splitArm4(mutA);

      // Verify the mutation was actually applied
      assert(
        'Mutation A was applied (}, 3000) replaced with }, 1500))',
        !(/\},\s*3000\s*\)/.test(tA)),
        `The regex did not match — mutateA_delay needs adjusting.\n` +
        `Try body snippet:\n${tA.slice(tA.indexOf('arm4Timer'), tA.indexOf('arm4Timer') + 200)}`
      );
      assert(
        'Check 1 FAILS on mutated source (3000ms guard is gone)',
        !check1_timeout3000(tA),
        `Check 1 still passes on the regressed source — the check is not testing the actual delay.\n` +
        `This means a future regression that reverts to 1500ms would slip past CI.`
      );
      assert(
        'Check 3 still PASSES on mutated source (catch branch independent of delay)',
        check3_catchBranch(cA),
        `Check 3 failed on delay mutation — these should be independent.\n` +
        `Catch body:\n${cA.slice(0, 400)}`
      );
      assert(
        'Check 4 still PASSES on mutated source (genuinely-empty log independent of delay)',
        check4_genuinelyEmpty(tA),
        `Check 4 failed on delay mutation — these should be independent.`
      );
    }

    // ── Mutation B: remove catch branch — Check 3 must fail ───────────────
    console.log('');
    console.log(B('Mutation B — catch semantic-arm-timeout branch removed (Check 3 must fail, checks 1+4 must pass)'));
    sep();
    {
      const mutB = mutateB_catchBranch(arm4);
      const { tryBody: tB, catchBody: cB } = splitArm4(mutB);

      // Verify mutation applied
      assert(
        'Mutation B was applied (semantic-arm-timeout branch removed from catch)',
        !cB.includes("if (err.message?.includes('semantic-arm-timeout'))"),
        `The if-branch is still present in the catch body — mutateB_catchBranch needs adjusting.\n` +
        `Catch body snippet:\n${cB.slice(0, 400)}`
      );
      assert(
        'Check 3 FAILS on mutated source (catch branch is gone)',
        !check3_catchBranch(cB),
        `Check 3 still passes on the regressed source — it is not verifying the catch block.\n` +
        `Catch body:\n${cB.slice(0, 400)}`
      );
      assert(
        'Check 1 still PASSES on mutated source (delay independent of catch branch)',
        check1_timeout3000(tB),
        `Check 1 failed on catch mutation — these should be independent.`
      );
      assert(
        'Check 4 still PASSES on mutated source (genuinely-empty log independent of catch branch)',
        check4_genuinelyEmpty(tB),
        `Check 4 failed on catch mutation — these should be independent.`
      );
    }

    // ── Mutation C: remove genuinely-empty log — Check 4 must fail ────────
    console.log('');
    console.log(B('Mutation C — genuinely-empty log removed (Check 4 must fail, checks 1+2+3 must pass)'));
    sep();
    {
      const mutC = mutateC_genuinelyEmpty(arm4);
      const { tryBody: tC, catchBody: cC } = splitArm4(mutC);

      assert(
        'Mutation C was applied (genuinely empty log removed from try body)',
        !tC.includes('genuinely empty — no vector matches'),
        `The log text is still present — mutateC_genuinelyEmpty needs adjusting.\n` +
        `(Note: the shorter "genuinely empty" also appears in the Arm 4 comment; use the full phrase.)`
      );
      assert(
        'Check 4 FAILS on mutated source (genuinely-empty log is gone)',
        !check4_genuinelyEmpty(tC),
        `Check 4 still passes on the regressed source — it is not gated on the try-body log.\n` +
        `Try body snippet:\n${tC.slice(tC.indexOf('hits.length'), tC.indexOf('hits.length') + 200)}`
      );
      assert(
        'Check 1 still PASSES on mutated source (delay independent of empty-log)',
        check1_timeout3000(tC),
        `Check 1 failed on genuinely-empty mutation — these should be independent.`
      );
      assert(
        'Check 2 still PASSES on mutated source (reject() expression independent of empty-log)',
        check2_marker(tC),
        `Check 2 failed on genuinely-empty mutation — these should be independent.`
      );
      assert(
        'Check 3 still PASSES on mutated source (catch branch independent of empty-log)',
        check3_catchBranch(cC),
        `Check 3 failed on genuinely-empty mutation — these should be independent.`
      );
    }

    // ── Mutation D: change timer rejection marker — Check 2 must fail ─────
    console.log('');
    console.log(B('Mutation D — timer reject() marker changed to generic (Check 2 must fail, checks 1+3+4 must pass)'));
    sep();
    {
      const mutD = mutateD_timerMarker(arm4);
      const { tryBody: tD, catchBody: cD } = splitArm4(mutD);

      // Verify mutation applied
      assert(
        "Mutation D was applied (reject(new Error('semantic-arm-timeout')) replaced with generic)",
        !tD.includes("reject(new Error('semantic-arm-timeout'))"),
        `The rejection expression is still present — mutateD_timerMarker needs adjusting.\n` +
        `Try body snippet:\n${tD.slice(tD.indexOf('arm4Timer'), tD.indexOf('arm4Timer') + 300)}`
      );
      assert(
        'Check 2 FAILS on mutated source (reject() no longer uses named marker)',
        !check2_marker(tD),
        `Check 2 still passes after removing reject(new Error('semantic-arm-timeout')).\n` +
        `This means Check 2 is matching a comment or comment literal instead of the actual\n` +
        `rejection expression — the check is vacuous for real regressions.\n` +
        `Try body snippet:\n${tD.slice(0, 600)}`
      );
      assert(
        'Check 1 still PASSES on mutated source (delay independent of marker)',
        check1_timeout3000(tD),
        `Check 1 failed on timer-marker mutation — these should be independent.`
      );
      assert(
        'Check 3 still PASSES on mutated source (catch body unchanged by timer mutation)',
        check3_catchBranch(cD),
        `Check 3 failed on timer-marker mutation — the catch body should be unchanged.\n` +
        `Catch body:\n${cD.slice(0, 400)}`
      );
      assert(
        'Check 4 still PASSES on mutated source (genuinely-empty log independent of timer marker)',
        check4_genuinelyEmpty(tD),
        `Check 4 failed on timer-marker mutation — these should be independent.`
      );
    }

  } else {
    // ═══════════════════════════════════════════════════════════════════════
    // NORMAL CI MODE — four structural checks on the live source
    // ═══════════════════════════════════════════════════════════════════════
    console.log(B('Tests — semantic arm timeout guard in processUnifiedRecall'));
    sep();

    assert(
      'Arm 4 setTimeout delay is 3000ms (arm4Timer assignment + }, 3000) pattern in try body)',
      check1_timeout3000(tryBody),
      `The actual setTimeout delay in the Promise.race is not 3000ms.\n` +
      `Looked for 'arm4Timer = setTimeout' AND the }, 3000) closing pattern in the try body.\n` +
      `Try body snippet (setTimeout area):\n` +
      `${tryBody.slice(Math.max(0, tryBody.indexOf('arm4Timer')), tryBody.indexOf('arm4Timer') + 300)}`
    );

    assert(
      "Promise.race timer uses reject(new Error('semantic-arm-timeout')) (actual rejection, not comment literal)",
      check2_marker(tryBody),
      `The expression reject(new Error('semantic-arm-timeout')) must appear in the\n` +
      `timer callback so the catch block can key on the marker at runtime.\n` +
      `(The Arm 4 IMPORTANT comment also contains the literal string — this check\n` +
      `deliberately targets the reject() call to avoid matching the comment.)\n` +
      `Try body snippet:\n${tryBody.slice(tryBody.indexOf('arm4Timer'), tryBody.indexOf('arm4Timer') + 400)}`
    );

    assert(
      'Catch block branches on semantic-arm-timeout and logs "timed out" (in catch body)',
      check3_catchBranch(catchBody),
      `The catch body must have an 'if (semantic-arm-timeout)' branch that logs "timed out".\n` +
      `Checking the catch body only (not the inline timer warning in the try body).\n` +
      `Catch body:\n${catchBody.slice(0, 500)}`
    );

    assert(
      'Zero-result path logs "genuinely empty" (in try body, separate from timeout path)',
      check4_genuinelyEmpty(tryBody),
      `When hits.length === 0, the try body must log "genuinely empty" so a\n` +
      `real zero-result search is distinguishable from a timeout in the server log.\n` +
      `Try body snippet (hits area):\n` +
      `${tryBody.slice(Math.max(0, tryBody.indexOf('hits.length')), tryBody.indexOf('hits.length') + 200)}`
    );
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('');
  sep();
  const total = passed + failed;
  if (failed === 0) {
    console.log(G(`  ALL ${total} checks passed ✅`));
  } else {
    console.log(R(`  ${failed} of ${total} checks FAILED ❌`));
  }
  sep();

  if (failed > 0) process.exit(1);
}

main();
