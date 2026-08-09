/**
 * Self-check (mutation test) for read_my_story invariants.
 *
 * Confirms that the existing read-my-story CI (test-read-my-story.ts) actually
 * FAILS when each of the three critical invariants in native-fc-handlers.ts is
 * removed, and PASSES when the file is restored.
 *
 * Invariants tested:
 *  1. Regex `([^0-9]|$)` — prevents Episode 1 matching Episode 10/14/etc.
 *  2. ORDER BY `importance DESC, LENGTH(content) DESC` — canonical row wins over
 *     newer-synced duplicates; NOT `recorded_at DESC`.
 *  3. `next_offset` field always present in the paginated response.
 *
 * Each mutation is:
 *   a) Applied to native-fc-handlers.ts
 *   b) The CI run is expected to EXIT NON-ZERO (failure detected)
 *   c) The file is restored unconditionally (even on unexpected pass)
 *   d) A final clean run confirms restoration was complete
 *
 * Exit 1 on any self-check failure.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HANDLER_PATH = path.resolve(__dirname, '../services/native-fc-handlers.ts');
const CI_SCRIPT = 'server/scripts/test-read-my-story.ts';

// ── Helpers ─────────────────────────────────────────────────────────────────

function readHandler(): string {
  return fs.readFileSync(HANDLER_PATH, 'utf8');
}

function writeHandler(content: string): void {
  fs.writeFileSync(HANDLER_PATH, content, 'utf8');
}

/**
 * Run the CI script and return true if it exited with a non-zero code (failure).
 * Returns false if it passed (exit 0), which is the wrong outcome for a mutation test.
 */
function runCiExpectFailure(label: string): boolean {
  console.log(`  Running CI under mutation: "${label}" …`);
  try {
    execSync(`npx tsx ${CI_SCRIPT}`, {
      stdio: 'pipe',
      timeout: 120_000,
    });
    // CI passed — mutation did NOT break it (bad)
    console.error(`  ✗ CI unexpectedly PASSED under mutation "${label}" — invariant is not guarded`);
    return false;
  } catch {
    // CI exited non-zero — mutation correctly broke it (good)
    console.log(`  ✓ CI correctly FAILED under mutation "${label}"`);
    return true;
  }
}

/**
 * Run the CI script and return true if it exited 0 (success).
 */
function runCiExpectPass(label: string): boolean {
  console.log(`  Running CI after restore: "${label}" …`);
  try {
    execSync(`npx tsx ${CI_SCRIPT}`, {
      stdio: 'pipe',
      timeout: 120_000,
    });
    console.log(`  ✓ CI correctly PASSED after restore "${label}"`);
    return true;
  } catch (err: any) {
    const out = (err.stdout?.toString() ?? '') + (err.stderr?.toString() ?? '');
    console.error(`  ✗ CI FAILED after restore "${label}" — file may be corrupted:\n${out.slice(0, 800)}`);
    return false;
  }
}

// ── Mutations ────────────────────────────────────────────────────────────────

/**
 * Mutation 1 — swap ORDER BY to `recorded_at DESC`.
 * The canonical Episode 1 row wins on importance + length; a newer-synced shorter
 * duplicate wins on recorded_at. Swapping causes the wrong row to be returned.
 */
function mutateOrderBy(original: string): string {
  const TARGET = 'ORDER BY importance DESC, LENGTH(content) DESC';
  const REPLACEMENT = 'ORDER BY recorded_at DESC';
  if (!original.includes(TARGET)) {
    throw new Error(`ORDER BY mutation target not found in handler. Expected: "${TARGET}"`);
  }
  return original.replace(TARGET, REPLACEMENT);
}

/**
 * Mutation 2 — swap the digit-boundary regex `([^0-9]|$)` → `(\\s|$)`.
 * With `(\\s|$)`, a title like "Episode 1: Take That, World" no longer matches
 * (colon is not whitespace), so the canonical row is missed and the CI's
 * canonical-record check (#6) and/or row-not-found check (#1) fails.
 *
 * The pattern appears twice (once for Episodes 1–27, once for Prequel Episodes).
 */
function mutateRegex(original: string): string {
  // Pattern inside the handler looks like: `([^0-9]|$)` (inside a template literal)
  const TARGET = /\(\[A-Z\^0-9\]\|\\$\)/g;  // won't match — use literal string instead

  const LITERAL_TARGET = '([^0-9]|$)';
  const LITERAL_REPLACEMENT = '(\\s|$)';

  if (!original.includes(LITERAL_TARGET)) {
    throw new Error(`Regex mutation target "${LITERAL_TARGET}" not found in handler.`);
  }
  // Replace ALL occurrences (Episodes + Prequel Episodes)
  return original.split(LITERAL_TARGET).join(LITERAL_REPLACEMENT);
}

/**
 * Mutation 3 — remove the `next_offset` field from the JSON response.
 * The pagination contract requires next_offset to be present so callers know
 * where to resume. Removing it causes the offset-pagination CI check (#7) to fail.
 */
function mutateNextOffset(original: string): string {
  const TARGET = 'next_offset: truncated ? chunkEnd : null,';
  if (!original.includes(TARGET)) {
    throw new Error(`next_offset mutation target not found in handler. Expected: "${TARGET}"`);
  }
  return original.replace(TARGET, '/* next_offset REMOVED BY MUTATION TEST */');
}

// ── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== read_my_story SELF-CHECK (mutation tests) ===\n');

  const selfCheckFailures: string[] = [];
  const original = readHandler();

  // ── 1. ORDER BY mutation ──────────────────────────────────────────────────
  console.log('--- Mutation 1: ORDER BY recorded_at DESC (should break canonical row selection) ---');
  {
    let mutated: string;
    try {
      mutated = mutateOrderBy(original);
    } catch (e: any) {
      selfCheckFailures.push(`Mutation 1 setup: ${e.message}`);
      mutated = original; // no-op, but still run restore below
    }

    writeHandler(mutated);
    let failedAsExpected = false;
    try {
      failedAsExpected = runCiExpectFailure('ORDER BY recorded_at DESC');
    } finally {
      // Always restore — even if CI unexpectedly passes
      writeHandler(original);
    }

    if (!failedAsExpected) {
      selfCheckFailures.push('Mutation 1: CI did not fail when ORDER BY was changed to recorded_at DESC');
    }

    // Confirm restore
    const passedAfterRestore = runCiExpectPass('ORDER BY restored');
    if (!passedAfterRestore) {
      selfCheckFailures.push('Mutation 1: CI failed after restoring ORDER BY — handler file may be corrupted');
    }
  }

  console.log('');

  // ── 2. Regex mutation ─────────────────────────────────────────────────────
  console.log('--- Mutation 2: regex ([^0-9]|$) → (\\s|$) (should break canonical row selection) ---');
  {
    let mutated: string;
    try {
      mutated = mutateRegex(original);
    } catch (e: any) {
      selfCheckFailures.push(`Mutation 2 setup: ${e.message}`);
      mutated = original;
    }

    writeHandler(mutated);
    let failedAsExpected = false;
    try {
      failedAsExpected = runCiExpectFailure('regex (\\s|$)');
    } finally {
      writeHandler(original);
    }

    if (!failedAsExpected) {
      selfCheckFailures.push('Mutation 2: CI did not fail when regex was changed to (\\s|$)');
    }

    const passedAfterRestore = runCiExpectPass('regex restored');
    if (!passedAfterRestore) {
      selfCheckFailures.push('Mutation 2: CI failed after restoring regex — handler file may be corrupted');
    }
  }

  console.log('');

  // ── 3. next_offset mutation ───────────────────────────────────────────────
  console.log('--- Mutation 3: next_offset removed (should break pagination contract check) ---');
  {
    let mutated: string;
    try {
      mutated = mutateNextOffset(original);
    } catch (e: any) {
      selfCheckFailures.push(`Mutation 3 setup: ${e.message}`);
      mutated = original;
    }

    writeHandler(mutated);
    let failedAsExpected = false;
    try {
      failedAsExpected = runCiExpectFailure('next_offset removed');
    } finally {
      writeHandler(original);
    }

    if (!failedAsExpected) {
      selfCheckFailures.push('Mutation 3: CI did not fail when next_offset was removed from the response');
    }

    const passedAfterRestore = runCiExpectPass('next_offset restored');
    if (!passedAfterRestore) {
      selfCheckFailures.push('Mutation 3: CI failed after restoring next_offset — handler file may be corrupted');
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n=== Self-check Summary ===\n');
  if (selfCheckFailures.length === 0) {
    console.log('ALL 3 MUTATION CHECKS PASSED:');
    console.log('  ✓ ORDER BY recorded_at DESC breaks CI (ordering invariant is guarded)');
    console.log('  ✓ Regex (\\s|$) breaks CI (digit-boundary invariant is guarded)');
    console.log('  ✓ Removing next_offset breaks CI (pagination contract is guarded)');
    console.log('\nThe read_my_story CI correctly catches all three regressions.');
    process.exit(0);
  } else {
    console.error('SELF-CHECK FAILURES:');
    for (const f of selfCheckFailures) console.error('  ✗', f);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[test-read-my-story-self-check] Fatal error:', err);
  process.exit(1);
});
