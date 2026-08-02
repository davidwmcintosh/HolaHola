/**
 * test-concurrent-flush-guard.ts
 *
 * Confirms that the isFlushInProgress guard in flushTranscripts() prevents a
 * concurrent second call from reaching _doFlushTranscripts() and sending a
 * duplicate response_complete message.
 *
 * Scenario: both the 800ms debounce timer AND generationComplete call
 * flushTranscripts() in the same event-loop tick.  Only the first call must
 * proceed; the second must be suppressed before it ever calls _doFlushTranscripts.
 *
 * Checks:
 *   PART 1 — Static: guard lives in flushTranscripts() (public entry), NOT in
 *             _doFlushTranscripts() (private implementation).
 *   PART 2 — Simulation: two concurrent calls to a mock flush; only one
 *             _doFlushTranscripts execution, one response_complete sent.
 *
 * Run: npx tsx server/scripts/test-concurrent-flush-guard.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const G   = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R   = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B   = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ${G('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${R('✗')} ${label}${detail ? `\n      ${R('→')} ${detail}` : ''}`);
    failed++;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Static source analysis
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — Static: guard placement in gemini-live-session.ts'));

const src = readFileSync(
  resolve(__dirname, '../services/gemini-live-session.ts'),
  'utf8',
);

const lines = src.split('\n');

// Locate flushTranscripts and _doFlushTranscripts method bodies
const flushStart = lines.findIndex(l => /^\s+private async flushTranscripts\(\)/.test(l));
const doFlushStart = lines.findIndex(l => /^\s+private async _doFlushTranscripts\(\)/.test(l));

assert(
  'flushTranscripts() method is present in the file',
  flushStart !== -1,
  'Could not find "private async flushTranscripts()"',
);

assert(
  '_doFlushTranscripts() method is present in the file',
  doFlushStart !== -1,
  'Could not find "private async _doFlushTranscripts()"',
);

// Find the line containing the guard check "if (this.isFlushInProgress)"
const guardLine = lines.findIndex(l => /if\s*\(\s*this\.isFlushInProgress\s*\)/.test(l));

assert(
  'isFlushInProgress guard check exists in the file',
  guardLine !== -1,
  'Could not find "if (this.isFlushInProgress)"',
);

if (flushStart !== -1 && doFlushStart !== -1 && guardLine !== -1) {
  assert(
    'Guard is INSIDE flushTranscripts() (between its definition and _doFlushTranscripts)',
    guardLine > flushStart && guardLine < doFlushStart,
    `Guard at line ${guardLine + 1}, flushTranscripts at ${flushStart + 1}, _doFlushTranscripts at ${doFlushStart + 1}`,
  );

  assert(
    'Guard is NOT inside _doFlushTranscripts() body',
    guardLine < doFlushStart,
    `Guard line ${guardLine + 1} is at or after _doFlushTranscripts start ${doFlushStart + 1}`,
  );
}

// Verify isFlushInProgress is set to true before the await _doFlushTranscripts() call
const setTrueLine = lines.findIndex((l, i) =>
  i > flushStart && i < doFlushStart && /this\.isFlushInProgress\s*=\s*true/.test(l),
);
assert(
  'isFlushInProgress is set to true inside flushTranscripts() before the await',
  setTrueLine !== -1 && setTrueLine > flushStart && setTrueLine < doFlushStart,
  'Could not find "this.isFlushInProgress = true" between flushTranscripts and _doFlushTranscripts',
);

// Verify the finally block clears it back to false
const clearInFinally = (() => {
  // Look for "finally {" block inside flushTranscripts (between flushStart and doFlushStart)
  for (let i = flushStart; i < doFlushStart; i++) {
    if (/finally\s*\{/.test(lines[i])) {
      // Scan forward for the isFlushInProgress = false line within ~5 lines
      for (let j = i + 1; j < Math.min(i + 6, doFlushStart); j++) {
        if (/this\.isFlushInProgress\s*=\s*false/.test(lines[j])) return true;
      }
    }
  }
  return false;
})();

assert(
  'isFlushInProgress is cleared to false in a finally block inside flushTranscripts()',
  clearInFinally,
  'Could not find "this.isFlushInProgress = false" inside a finally{} in flushTranscripts()',
);

// Verify _doFlushTranscripts does NOT contain its own isFlushInProgress guard
const doFlushGuard = (() => {
  for (let i = doFlushStart + 1; i < lines.length; i++) {
    // Stop at next private/public/protected method (end of _doFlushTranscripts)
    if (i > doFlushStart + 1 && /^\s+(private|public|protected)\s+(async\s+)?[a-zA-Z]/.test(lines[i])) break;
    if (/if\s*\(\s*this\.isFlushInProgress\s*\)/.test(lines[i])) return true;
  }
  return false;
})();

assert(
  '_doFlushTranscripts() does NOT contain its own isFlushInProgress guard (guard stays in public entry)',
  !doFlushGuard,
  'Found "if (this.isFlushInProgress)" inside _doFlushTranscripts — guard is in the wrong place',
);

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Runtime simulation
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Simulation: two concurrent flush calls'));

// Minimal mock that mirrors the guard structure in GeminiLiveSession
class MockFlushable {
  isFlushInProgress = false;
  doFlushCallCount = 0;
  responsesEmitted: string[] = [];
  suppressLog = true; // silence the console.log in this mock

  async flushTranscripts(): Promise<void> {
    if (this.isFlushInProgress) {
      if (!this.suppressLog) console.log('[mock] concurrent call suppressed');
      return;
    }
    this.isFlushInProgress = true;
    try {
      await this._doFlushTranscripts();
    } finally {
      this.isFlushInProgress = false;
    }
  }

  private async _doFlushTranscripts(): Promise<void> {
    this.doFlushCallCount++;
    // Simulate an async operation (e.g. DB write)
    await new Promise<void>(resolve => setImmediate(resolve));
    this.responsesEmitted.push(`response_complete:turn-1`);
  }
}

// Test A: simultaneous calls (both launched without awaiting either)
const instanceA = new MockFlushable();
await Promise.all([
  instanceA.flushTranscripts(),
  instanceA.flushTranscripts(),
]);

assert(
  'Simulation A: _doFlushTranscripts called exactly once when two calls race simultaneously',
  instanceA.doFlushCallCount === 1,
  `_doFlushTranscripts was called ${instanceA.doFlushCallCount} time(s); expected 1`,
);

assert(
  'Simulation A: exactly one response_complete emitted',
  instanceA.responsesEmitted.length === 1,
  `response_complete count: ${instanceA.responsesEmitted.length}; expected 1`,
);

assert(
  'Simulation A: isFlushInProgress is false after both calls settle (finally block ran)',
  instanceA.isFlushInProgress === false,
  'isFlushInProgress is still true after both calls settled',
);

// Test B: three concurrent calls (debounce + generationComplete + watchdog)
const instanceB = new MockFlushable();
await Promise.all([
  instanceB.flushTranscripts(),
  instanceB.flushTranscripts(),
  instanceB.flushTranscripts(),
]);

assert(
  'Simulation B: _doFlushTranscripts called exactly once with three concurrent callers',
  instanceB.doFlushCallCount === 1,
  `_doFlushTranscripts was called ${instanceB.doFlushCallCount} time(s); expected 1`,
);

assert(
  'Simulation B: exactly one response_complete emitted',
  instanceB.responsesEmitted.length === 1,
  `response_complete count: ${instanceB.responsesEmitted.length}; expected 1`,
);

// Test C: sequential calls (flush completes, then a second flush fires — must succeed)
const instanceC = new MockFlushable();
await instanceC.flushTranscripts();  // first flush — completes
await instanceC.flushTranscripts();  // second flush after the first settled — must go through

assert(
  'Simulation C: sequential calls each reach _doFlushTranscripts (guard resets after flush)',
  instanceC.doFlushCallCount === 2,
  `Expected 2 sequential flushes, got ${instanceC.doFlushCallCount}`,
);

// ══════════════════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════════════════
sep();
const total = passed + failed;
if (failed === 0) {
  console.log(G(`\n✓ All ${total} checks passed — concurrent-flush guard is correctly placed and works.\n`));
  process.exit(0);
} else {
  console.log(R(`\n✗ ${failed} of ${total} checks FAILED — concurrent-flush guard has a defect.\n`));
  process.exit(1);
}
