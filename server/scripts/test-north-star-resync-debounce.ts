/**
 * test-north-star-resync-debounce.ts
 *
 * Confirms that calling scheduleNorthStarResync() N times in rapid succession
 * collapses into exactly ONE syncNorthStarToNeuralNetwork() call after the
 * debounce window settles.
 *
 * Three parts:
 *   PART 1 — Source shape check: debounce guard (clearTimeout) is present
 *             *within the scheduleNorthStarResync() method body*, bounded by
 *             the sentinel comment that opens the next section.
 *   PART 2 — Runtime spy: call scheduleNorthStarResync() 5 times within
 *             100 ms, wait for the debounce window to settle, assert
 *             syncNorthStarToNeuralNetwork() fired exactly once.
 *   PART 3 — Mutation self-check: simulate removing clearTimeout and verify
 *             the PART 1 guard would catch it.
 *
 * Run: npx tsx server/scripts/test-north-star-resync-debounce.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ${G('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${R('✗')} ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

/**
 * Extract the text of the scheduleNorthStarResync() method body from the
 * source string. The method body is bounded by:
 *   - start: the line containing `scheduleNorthStarResync(`
 *   - end:   the sentinel comment `// ON-DEMAND REFRESH` that opens the
 *             next section (appears immediately after the closing brace).
 *
 * This ensures assertions cannot be satisfied by coincidentally identical
 * text elsewhere in the file.
 */
function extractMethodBody(src: string): string | null {
  const methodStart = src.indexOf('scheduleNorthStarResync(');
  if (methodStart === -1) return null;

  // The next section is delimited by this sentinel comment
  const nextSectionSentinel = '// ON-DEMAND REFRESH';
  const methodEnd = src.indexOf(nextSectionSentinel, methodStart);
  if (methodEnd === -1) return null;

  return src.slice(methodStart, methodEnd);
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Source shape check (bounded to the method body)
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — Source shape: debounce guard (clearTimeout) present within scheduleNorthStarResync() body'));
sep();

function runPart1() {
  const src = readFileSync(
    resolve(__dirname, '../services/context-sync-service.ts'),
    'utf-8',
  );

  // ── Verify method and next-section sentinel exist ──────────────────────────
  const methodStart = src.indexOf('scheduleNorthStarResync(');
  assert(
    'scheduleNorthStarResync() method is defined',
    methodStart !== -1,
  );

  const nextSentinelIdx = src.indexOf('// ON-DEMAND REFRESH', methodStart);
  assert(
    '"// ON-DEMAND REFRESH" sentinel found after method (used as method-end boundary)',
    nextSentinelIdx !== -1 && nextSentinelIdx > methodStart,
    `methodStart=${methodStart}, sentinelIdx=${nextSentinelIdx}`,
  );

  // ── Extract the bounded method body ───────────────────────────────────────
  const methodBody = extractMethodBody(src);
  assert(
    'Method body extracted successfully (non-null)',
    methodBody !== null,
  );
  if (!methodBody) return; // subsequent checks need the body

  // ── Check debounce timer field ─────────────────────────────────────────────
  assert(
    '_northStarResyncTimer field referenced in method body',
    methodBody.includes('_northStarResyncTimer'),
  );

  // ── clearTimeout must appear inside the method body ────────────────────────
  const clearTimeoutInBody = methodBody.includes('clearTimeout(this._northStarResyncTimer)');
  assert(
    'clearTimeout(this._northStarResyncTimer) is present inside scheduleNorthStarResync() body',
    clearTimeoutInBody,
  );

  // ── Timer must be reset to null before the sync fires ─────────────────────
  const timerNullInBody = methodBody.includes('this._northStarResyncTimer = null');
  assert(
    'Timer is reset to null inside the setTimeout callback (within method body)',
    timerNullInBody,
  );

  // ── syncNorthStarToNeuralNetwork must be called after the null reset ───────
  const nullResetIdx  = methodBody.indexOf('this._northStarResyncTimer = null');
  const syncCallIdx   = methodBody.indexOf('this.syncNorthStarToNeuralNetwork()', nullResetIdx);
  assert(
    'syncNorthStarToNeuralNetwork() called after timer reset (within method body)',
    nullResetIdx !== -1 && syncCallIdx !== -1 && syncCallIdx > nullResetIdx,
    `nullResetIdx=${nullResetIdx}, syncCallIdx=${syncCallIdx}`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Runtime spy: burst of 5 calls → exactly 1 sync
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Runtime: 5 rapid scheduleNorthStarResync() calls fire syncNorthStarToNeuralNetwork() exactly once'));
sep();

const DEBOUNCE_DELAY_MS = 200;   // short delay so the test finishes quickly
const BURST_COUNT       = 5;     // number of rapid calls
const BURST_INTERVAL_MS = 15;    // gap between calls (well under 100 ms)
const SETTLE_MS         = DEBOUNCE_DELAY_MS + 500; // well past the debounce window

async function runPart2() {
  const { contextSyncService } = await import('../services/context-sync-service');

  // ── Install spy ──────────────────────────────────────────────────────────
  let syncCallCount = 0;
  const originalSync = contextSyncService.syncNorthStarToNeuralNetwork.bind(contextSyncService);

  // Replace with a lightweight spy (no real DB work needed for this test)
  (contextSyncService as any).syncNorthStarToNeuralNetwork = async () => {
    syncCallCount++;
    console.log(`    [spy] syncNorthStarToNeuralNetwork() call #${syncCallCount} detected`);
    return { synced: 0, skipped: 0, errors: [] };
  };

  try {
    // ── Burst ────────────────────────────────────────────────────────────────
    console.log(`  Firing scheduleNorthStarResync() ${BURST_COUNT}× at ${BURST_INTERVAL_MS} ms intervals (debounce=${DEBOUNCE_DELAY_MS} ms) …`);

    for (let i = 0; i < BURST_COUNT; i++) {
      contextSyncService.scheduleNorthStarResync(DEBOUNCE_DELAY_MS);
      if (i < BURST_COUNT - 1) {
        await new Promise<void>(res => setTimeout(res, BURST_INTERVAL_MS));
      }
    }

    // ── Wait for debounce to settle ──────────────────────────────────────────
    console.log(`  Waiting ${SETTLE_MS} ms for debounce to settle …`);
    await new Promise<void>(res => setTimeout(res, SETTLE_MS));

    // ── Assert exactly one call ──────────────────────────────────────────────
    assert(
      `syncNorthStarToNeuralNetwork() fired exactly once after ${BURST_COUNT} rapid calls`,
      syncCallCount === 1,
      `actual call count = ${syncCallCount}`,
    );

  } finally {
    // Restore original method
    (contextSyncService as any).syncNorthStarToNeuralNetwork = originalSync;

    // Clear any pending timer so it does not leak into subsequent tests
    const svc = contextSyncService as any;
    if (svc._northStarResyncTimer !== null) {
      clearTimeout(svc._northStarResyncTimer);
      svc._northStarResyncTimer = null;
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Mutation self-check
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Mutation self-check: PART 1 guard catches when clearTimeout is removed from method body'));
sep();

function runPart3() {
  const src = readFileSync(
    resolve(__dirname, '../services/context-sync-service.ts'),
    'utf-8',
  );

  // ── Simulate: clearTimeout removed ────────────────────────────────────────
  const mutatedSrc   = src.replace(
    'clearTimeout(this._northStarResyncTimer)',
    '/* clearTimeout removed */',
  );
  const mutatedBody  = extractMethodBody(mutatedSrc);
  const clearInMuted = mutatedBody?.includes('clearTimeout(this._northStarResyncTimer)') ?? false;

  assert(
    'Mutation self-check: PART 1 detects when clearTimeout is removed from method body',
    !clearInMuted,
    clearInMuted
      ? 'clearTimeout still found in mutated method body — guard would not catch the regression'
      : undefined,
  );

  // ── Simulate: timer-null reset removed ────────────────────────────────────
  const mutatedSrc2   = src.replace(
    'this._northStarResyncTimer = null',
    '/* timer reset removed */',
  );
  const mutatedBody2  = extractMethodBody(mutatedSrc2);
  const nullInMuted   = mutatedBody2?.includes('this._northStarResyncTimer = null') ?? false;

  assert(
    'Mutation self-check: PART 1 detects when timer-null reset is removed from method body',
    !nullInMuted,
    nullInMuted
      ? 'null reset still found in mutated method body — guard would not catch the regression'
      : undefined,
  );

  // ── Confirm the boundary sentinel is itself guarded ───────────────────────
  // If the sentinel comment is ever renamed the boundary breaks; detect that.
  const originalBody = extractMethodBody(src);
  assert(
    'Method body extraction is non-empty (sentinel boundary is intact)',
    !!originalBody && originalBody.length > 0,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

(async () => {
  try {
    runPart1();
    await runPart2();
    runPart3();
  } catch (err: any) {
    console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
    if (err?.stack) console.error(err.stack);
    process.exit(1);
  }

  sep();
  const all = passed + failed;
  if (failed === 0) {
    console.log(G(`\n✓  All ${all} assertions passed — North Star debounce collapse verified.\n`));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${all} assertions failed.\n`));
    process.exit(1);
  }
})();
