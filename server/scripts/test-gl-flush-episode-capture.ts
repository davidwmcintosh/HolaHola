/**
 * test-gl-flush-episode-capture.ts
 *
 * CI check: confirms the GL voice session flush path still routes real
 * (non-greeting) turns to the rolling episode via safeWriteTrigger.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What is being guarded
 * ─────────────────────────────────────────────────────────────────────────────
 * `_doFlushTranscripts()` in gemini-live-session.ts contains an
 * "EPISODE CAPTURE" block that fires after every real student↔Daniela exchange:
 *
 *   // EPISODE CAPTURE: write this GL exchange to the rolling episode (live mode).
 *   if (!this.isGreetingTurn && !this.session.isIncognito && ...) {
 *     setImmediate(async () => {
 *       const { safeWriteTrigger, getRollingEpisodeName } = await import('./chat-episode-hook');
 *       const episodeName = await getRollingEpisodeName();
 *       if (!episodeName) return;
 *       await safeWriteTrigger(exchange, episodeName);
 *     });
 *   }
 *
 * If a refactor removes or bypasses this block, GL voice sessions silently stop
 * contributing to the rolling episode record — with no runtime error or visible
 * symptom until someone notices the episode is missing GL content.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Strategy
 * ─────────────────────────────────────────────────────────────────────────────
 * This is a deterministic static check (same style as test-gl-reconnected-
 * client-recovery.ts and the other needle-check CI scripts).  We parse the
 * source of gemini-live-session.ts in memory to:
 *
 *   1. Verify the EPISODE CAPTURE block is present inside _doFlushTranscripts.
 *   2. Verify the safeWriteTrigger call is inside the block.
 *   3. Verify the non-greeting guard (!this.isGreetingTurn) is present.
 *   4. Verify the import of chat-episode-hook is inside the block.
 *
 * In self-check mode (--self-check) we also verify that removing the block
 * from the in-memory source causes every check to fail — confirming the test
 * would catch a real regression.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Run
 * ─────────────────────────────────────────────────────────────────────────────
 *   npx tsx server/scripts/test-gl-flush-episode-capture.ts
 *   npx tsx server/scripts/test-gl-flush-episode-capture.ts --self-check
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Colour helpers ─────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ── CLI ────────────────────────────────────────────────────────────────────────
const selfCheckMode = process.argv.includes('--self-check');

// ── Source file path ───────────────────────────────────────────────────────────
const GL_SESSION_FILE = 'server/services/gemini-live-session.ts';
const GL_SESSION_PATH = resolve(process.cwd(), GL_SESSION_FILE);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract the body of _doFlushTranscripts from the source text.
 * Returns the substring from the function declaration until a matching
 * closing brace at the same nesting depth as the opening brace.
 * Returns null if the function cannot be found.
 */
function extractFlushBody(src: string): string | null {
  const marker = 'private async _doFlushTranscripts(): Promise<void> {';
  const start = src.indexOf(marker);
  if (start === -1) return null;

  // Walk forward counting braces to find the function's closing }
  let depth = 0;
  let i = start + marker.length - 1; // start at the opening {
  while (i < src.length) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
    i++;
  }
  return null; // unmatched braces — malformed source
}

/**
 * Simulate removal of the EPISODE CAPTURE block from source text.
 * Strips the block from the opening comment to the closing brace of the
 * `if (!this.isGreetingTurn …)` block.  Produces the source as it would
 * look if a refactor accidentally dropped the block.
 */
function stripEpisodeCaptureBlock(src: string): string {
  // The block starts with the EPISODE CAPTURE comment and ends with the
  // closing brace+newline of the outer `if (!this.isGreetingTurn …) {`
  // We match from the comment to the first `}` that closes that if block.
  const blockStart = src.indexOf('      // EPISODE CAPTURE: write this GL exchange');
  if (blockStart === -1) return src; // already absent — nothing to strip

  // Find the matching closing brace: walk forward counting { and }
  // starting after the comment line.
  const codeStart = src.indexOf('\n', blockStart) + 1;
  let depth = 0;
  let i = codeStart;
  let blockEnd = -1;
  while (i < src.length) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth < 0) {
        // We closed before any opening — this is the outer if's closing brace
        blockEnd = i + 1;
        break;
      }
    }
    i++;
  }
  if (blockEnd === -1) return src.slice(0, blockStart) + src.slice(codeStart);
  return src.slice(0, blockStart) + src.slice(blockEnd);
}

// ─────────────────────────────────────────────────────────────────────────────
// Core assertion set
// ─────────────────────────────────────────────────────────────────────────────

interface CheckResult {
  passed: number;
  failed: number;
}

/**
 * Run all assertions against the given source text.
 * When `expectPass` is true (normal mode), a found needle = pass.
 * When `expectPass` is false (self-check — block removed), a found needle = fail.
 */
function runChecks(src: string, expectPass: boolean): CheckResult {
  const result: CheckResult = { passed: 0, failed: 0 };

  // ── Step 1: function exists ────────────────────────────────────────────────
  const flushBody = extractFlushBody(src);
  const funcFound = flushBody !== null;
  {
    const ok = expectPass ? funcFound : !funcFound;
    if (!expectPass) {
      // In self-check we're stripping the EPISODE CAPTURE block, NOT the
      // function itself — so the function should still exist.  Skip this
      // particular inversion.
      if (funcFound) {
        console.log(`  ${G('✓')} _doFlushTranscripts() function body found in source`);
        result.passed++;
      } else {
        console.log(`  ${R('✗')} _doFlushTranscripts() function body NOT found in source`);
        result.failed++;
      }
    } else {
      if (funcFound) {
        console.log(`  ${G('✓')} _doFlushTranscripts() function body found in source`);
        result.passed++;
      } else {
        console.log(`  ${R('✗')} _doFlushTranscripts() function body NOT found in source`);
        result.failed++;
      }
    }
  }
  if (!flushBody) return result; // can't check the rest without a body

  // ── Helper: check needle inside the flush body ─────────────────────────────
  function checkNeedle(needle: string | RegExp, label: string): void {
    const found = typeof needle === 'string'
      ? flushBody!.includes(needle)
      : needle.test(flushBody!);

    if (expectPass) {
      if (found) {
        console.log(`  ${G('✓')} ${label}`);
        result.passed++;
      } else {
        console.log(`  ${R('✗')} MISSING: ${label}`);
        result.failed++;
      }
    } else {
      // Self-check: we expect the block to have been removed, so needles
      // inside the block should be absent.  Present = self-check broken.
      if (!found) {
        console.log(`  ${G('✓')} [self-check] Correctly absent: ${label}`);
        result.passed++;
      } else {
        console.log(`  ${R('✗')} [self-check] STILL PRESENT (block was not stripped): ${label}`);
        result.failed++;
      }
    }
  }

  // ── Step 2: EPISODE CAPTURE comment is inside _doFlushTranscripts ─────────
  checkNeedle(
    '// EPISODE CAPTURE: write this GL exchange to the rolling episode',
    'EPISODE CAPTURE comment inside _doFlushTranscripts',
  );

  // ── Step 3: safeWriteTrigger call inside the block ─────────────────────────
  checkNeedle(
    'safeWriteTrigger(exchange, episodeName)',
    'safeWriteTrigger(exchange, episodeName) call inside flush path',
  );

  // ── Step 4: non-greeting guard inside the block ────────────────────────────
  checkNeedle(
    '!this.isGreetingTurn',
    '!this.isGreetingTurn guard skips greeting turns',
  );

  // ── Step 5: chat-episode-hook imported inside the block ───────────────────
  checkNeedle(
    `import('./chat-episode-hook')`,
    `dynamic import of './chat-episode-hook' inside flush block`,
  );

  // ── Step 6: getRollingEpisodeName guard (null-check before write) ──────────
  checkNeedle(
    'getRollingEpisodeName',
    'getRollingEpisodeName() called to gate the write (null-check present)',
  );

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  let totalPassed = 0;
  let totalFailed = 0;

  const src = readFileSync(GL_SESSION_PATH, 'utf8');

  if (!selfCheckMode) {
    // ── Normal mode ────────────────────────────────────────────────────────
    sep();
    console.log(B('NORMAL MODE — verify EPISODE CAPTURE block is intact in _doFlushTranscripts'));
    sep();
    console.log(Y(`  ℹ  Source file: ${GL_SESSION_FILE}`));

    const r = runChecks(src, /* expectPass= */ true);
    totalPassed += r.passed;
    totalFailed += r.failed;

  } else {
    // ── Self-check mode ────────────────────────────────────────────────────
    sep();
    console.log(B('SELF-CHECK MODE — verify test fails when EPISODE CAPTURE block is removed'));
    sep();
    console.log(Y('  ℹ  Strips the EPISODE CAPTURE block from the in-memory source,'));
    console.log(Y('  ℹ  then verifies every block-level needle is absent (gate is sound).'));
    console.log(Y(`  ℹ  Source file: ${GL_SESSION_FILE}`));

    const stripped = stripEpisodeCaptureBlock(src);
    const blockRemoved = !stripped.includes('// EPISODE CAPTURE: write this GL exchange');
    if (blockRemoved) {
      console.log(Y('  ℹ  Block successfully stripped from in-memory source'));
    } else {
      console.log(R('  ✗  stripEpisodeCaptureBlock() did not remove the block — self-check cannot proceed'));
      totalFailed++;
    }

    if (blockRemoved) {
      const r = runChecks(stripped, /* expectPass= */ false);
      totalPassed += r.passed;
      totalFailed += r.failed;
    }

    sep();
    console.log(B('CONFIRMATION — normal-mode checks would fail on stripped source'));
    sep();
    // Run normal-mode checks on the stripped source to prove they fail
    const normalOnStripped = runChecks(stripped, /* expectPass= */ true);
    const normalFailed = normalOnStripped.failed;
    if (normalFailed > 0) {
      console.log(G(`  ✓ ${normalFailed} normal-mode check(s) correctly fail on stripped source`));
      totalPassed++;
    } else {
      console.log(R('  ✗ Normal-mode checks all passed on stripped source — test cannot catch the regression'));
      totalFailed++;
    }
  }

  sep();
  const total = totalPassed + totalFailed;
  if (totalFailed === 0) {
    console.log(G(`\n✓ All ${total} check(s) passed\n`));
    process.exit(0);
  } else {
    console.log(R(`\n✗ ${totalFailed} of ${total} check(s) failed\n`));
    process.exit(1);
  }
})();
