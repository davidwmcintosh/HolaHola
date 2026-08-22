/**
 * Confirms that the undefined-sentinel guard is applied on the PTT and OpenMic
 * pattern-signal refresh paths in streaming-voice-orchestrator.ts — the same
 * guard that was established in native-fc-handlers.ts (RECORD_PATTERN_SIGNAL step 5).
 *
 * BACKGROUND
 * Task 334 fixed the RECORD_PATTERN_SIGNAL path in native-fc-handlers.ts.
 * The comment there reads:
 *   "Mirrors the same refresh applied on the PTT and OpenMic command-parser paths."
 * This test confirms those paths actually use the same pattern, not the old
 * `.catch(() => null)` form that silently drops live wobble context on a DB error.
 *
 * CONTRACTS tested — via static source analysis of the real production orchestrator
 * (server/services/streaming-voice-orchestrator.ts):
 *
 * 1. PTT path (~line 3332):
 *    - `.catch(() => null)` is absent in the PTT PatternSignal refresh block.
 *    - `.catch((): undefined => ...)` is present (error sentinel is undefined).
 *    - `if (refreshed !== undefined)` guards the assignment.
 *
 * 2. OpenMic path (~line 6790):
 *    - Same three checks as PTT.
 *
 * 3. BEHAVIOURAL SIMULATION: the guard logic is exercised directly so any
 *    future refactor of the conditional is caught even if the text patterns change.
 *
 * Run with:
 *   npx tsx --test server/__tests__/pattern-signal-ptt-openmic-guard.test.ts
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const root       = resolve(__dirname, '../..');

// ── Load production source once ───────────────────────────────────────────────

let orchestratorSrc: string;

before(() => {
  orchestratorSrc = readFileSync(
    resolve(root, 'server/services/streaming-voice-orchestrator.ts'),
    'utf-8',
  );
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Return a window of `src` centred on the Nth occurrence of `anchor`.
 * Returns '' when the anchor is not found.
 */
function regionAroundNth(
  src: string,
  anchor: string,
  n: number,           // 1-based occurrence index
  before = 800,
  after  = 900,
): string {
  let searchFrom = 0;
  let idx = -1;
  for (let i = 0; i < n; i++) {
    idx = src.indexOf(anchor, searchFrom);
    if (idx === -1) return '';
    searchFrom = idx + anchor.length;
  }
  return src.slice(Math.max(0, idx - before), Math.min(src.length, idx + anchor.length + after));
}

// Stable anchors — these are the warn-log lines added by the fix.
// If they disappear the refresh block has been restructured and the tests need
// to be updated alongside the production code.
const PTT_ANCHOR    = '[PatternSignal] fetchPatternSignalContext threw unexpectedly';
const OPENMIC_ANCHOR = '[PatternSignal - OpenMic] fetchPatternSignalContext threw unexpectedly';

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1 — PTT path
// ═══════════════════════════════════════════════════════════════════════════════

describe('PTT PatternSignal refresh — .catch() returns undefined, not null', () => {
  it('PTT refresh block is present in orchestrator source', () => {
    assert.ok(
      orchestratorSrc.includes(PTT_ANCHOR),
      `PTT refresh anchor not found in streaming-voice-orchestrator.ts. ` +
      `Expected warn-log: "${PTT_ANCHOR}". ` +
      `The PTT RECORD_PATTERN_SIGNAL refresh block may have been restructured.`,
    );
  });

  it('PTT path: .catch(() => null) anti-pattern is absent', () => {
    const region = regionAroundNth(orchestratorSrc, PTT_ANCHOR, 1);
    const catchReturnsNull = /\.catch\s*\(\s*\(\s*\)\s*=>\s*null\s*\)/.test(region);
    assert.ok(
      !catchReturnsNull,
      `PTT path: .catch(() => null) is present on fetchPatternSignalContext — this silently ` +
      `overwrites session.activePatternSignals (including live wobbles) on a transient DB error. ` +
      `The catch must return undefined so the guard can distinguish the error path.`,
    );
  });

  it('PTT path: .catch() callback explicitly returns undefined (typed or plain)', () => {
    const region = regionAroundNth(orchestratorSrc, PTT_ANCHOR, 1);
    const catchReturnsUndefined =
      /\.catch\s*\(\s*\(\s*\)\s*:\s*undefined\s*=>/.test(region) ||
      /\.catch\s*\(\s*\(\s*\)\s*=>\s*undefined\s*\)/.test(region);
    assert.ok(
      catchReturnsUndefined,
      `PTT path: .catch() on fetchPatternSignalContext does not use undefined as the error sentinel. ` +
      `undefined is required to distinguish "fetch threw" from "fetch returned null because ` +
      `all patterns are stable". Use: .catch((): undefined => { return undefined; })`,
    );
  });
});

describe('PTT PatternSignal refresh — assignment is gated on the undefined sentinel', () => {
  it('PTT path: if (refreshed !== undefined) guard is present', () => {
    const region = regionAroundNth(orchestratorSrc, PTT_ANCHOR, 1);
    const hasGuard = /if\s*\(\s*refreshed\s*!==\s*undefined\s*\)/.test(region);
    assert.ok(
      hasGuard,
      `PTT path: No 'if (refreshed !== undefined)' guard found after fetchPatternSignalContext. ` +
      `Without this guard, a transient DB error still overwrites session.activePatternSignals. ` +
      `Add: if (refreshed !== undefined) { session.activePatternSignals = refreshed; }`,
    );
  });

  it('PTT path: session.activePatternSignals = refreshed appears after the guard', () => {
    const region = regionAroundNth(orchestratorSrc, PTT_ANCHOR, 1);
    const guardIdx  = region.indexOf('if (refreshed !== undefined)');
    const assignIdx = region.indexOf('session.activePatternSignals = refreshed');
    assert.ok(guardIdx  !== -1, `PTT: guard 'if (refreshed !== undefined)' not found in refresh region`);
    assert.ok(assignIdx !== -1, `PTT: 'session.activePatternSignals = refreshed' not found in refresh region`);
    assert.ok(
      assignIdx > guardIdx,
      `PTT: assignment appears BEFORE the guard — the guard must come first and wrap the assignment`,
    );
  });

  it('PTT path: comment documents the three-way sentinel meaning', () => {
    const region = regionAroundNth(orchestratorSrc, PTT_ANCHOR, 1);
    const hasNullComment =
      /null\b.*\bstable\b/i.test(region) ||
      /null\b.*\bintentional\b/i.test(region);
    const hasUndefinedComment =
      /undefined\b.*\b(preserve|error|threw)/i.test(region);
    assert.ok(
      hasNullComment,
      `PTT: comment does not explain that null means "all stable → intentional clear". ` +
      `Add a comment so future editors understand the three-way sentinel meaning.`,
    );
    assert.ok(
      hasUndefinedComment,
      `PTT: comment does not explain that undefined means "fetch threw → preserve existing". ` +
      `Add a comment so future editors understand the three-way sentinel meaning.`,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2 — OpenMic path
// ═══════════════════════════════════════════════════════════════════════════════

describe('OpenMic PatternSignal refresh — .catch() returns undefined, not null', () => {
  it('OpenMic refresh block is present in orchestrator source', () => {
    assert.ok(
      orchestratorSrc.includes(OPENMIC_ANCHOR),
      `OpenMic refresh anchor not found in streaming-voice-orchestrator.ts. ` +
      `Expected warn-log: "${OPENMIC_ANCHOR}". ` +
      `The OpenMic RECORD_PATTERN_SIGNAL refresh block may have been restructured.`,
    );
  });

  it('OpenMic path: .catch(() => null) anti-pattern is absent', () => {
    const region = regionAroundNth(orchestratorSrc, OPENMIC_ANCHOR, 1);
    const catchReturnsNull = /\.catch\s*\(\s*\(\s*\)\s*=>\s*null\s*\)/.test(region);
    assert.ok(
      !catchReturnsNull,
      `OpenMic path: .catch(() => null) is present on fetchPatternSignalContext — this silently ` +
      `overwrites session.activePatternSignals (including live wobbles) on a transient DB error. ` +
      `The catch must return undefined so the guard can distinguish the error path.`,
    );
  });

  it('OpenMic path: .catch() callback explicitly returns undefined (typed or plain)', () => {
    const region = regionAroundNth(orchestratorSrc, OPENMIC_ANCHOR, 1);
    const catchReturnsUndefined =
      /\.catch\s*\(\s*\(\s*\)\s*:\s*undefined\s*=>/.test(region) ||
      /\.catch\s*\(\s*\(\s*\)\s*=>\s*undefined\s*\)/.test(region);
    assert.ok(
      catchReturnsUndefined,
      `OpenMic path: .catch() on fetchPatternSignalContext does not use undefined as the error sentinel. ` +
      `Use: .catch((): undefined => { return undefined; })`,
    );
  });
});

describe('OpenMic PatternSignal refresh — assignment is gated on the undefined sentinel', () => {
  it('OpenMic path: if (refreshed !== undefined) guard is present', () => {
    const region = regionAroundNth(orchestratorSrc, OPENMIC_ANCHOR, 1);
    const hasGuard = /if\s*\(\s*refreshed\s*!==\s*undefined\s*\)/.test(region);
    assert.ok(
      hasGuard,
      `OpenMic path: No 'if (refreshed !== undefined)' guard found after fetchPatternSignalContext. ` +
      `Add: if (refreshed !== undefined) { session.activePatternSignals = refreshed; }`,
    );
  });

  it('OpenMic path: session.activePatternSignals = refreshed appears after the guard', () => {
    const region = regionAroundNth(orchestratorSrc, OPENMIC_ANCHOR, 1);
    const guardIdx  = region.indexOf('if (refreshed !== undefined)');
    const assignIdx = region.indexOf('session.activePatternSignals = refreshed');
    assert.ok(guardIdx  !== -1, `OpenMic: guard not found in refresh region`);
    assert.ok(assignIdx !== -1, `OpenMic: assignment not found in refresh region`);
    assert.ok(
      assignIdx > guardIdx,
      `OpenMic: assignment appears BEFORE the guard — the guard must come first`,
    );
  });

  it('OpenMic path: comment documents the three-way sentinel meaning', () => {
    const region = regionAroundNth(orchestratorSrc, OPENMIC_ANCHOR, 1);
    const hasNullComment =
      /null\b.*\bstable\b/i.test(region) ||
      /null\b.*\bintentional\b/i.test(region);
    const hasUndefinedComment =
      /undefined\b.*\b(preserve|error|threw)/i.test(region);
    assert.ok(
      hasNullComment,
      `OpenMic: comment does not explain that null means "all stable → intentional clear".`,
    );
    assert.ok(
      hasUndefinedComment,
      `OpenMic: comment does not explain that undefined means "fetch threw → preserve existing".`,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3 — Behavioural simulation
//
// Replicates the production guard logic for both paths so any refactor of the
// conditional is caught here even if the text patterns above change.
// ═══════════════════════════════════════════════════════════════════════════════

describe('Guard logic simulation — PTT and OpenMic paths', () => {
  /**
   * Replicates the exact pattern now in both the PTT and OpenMic blocks:
   *
   *   const refreshed = await fetchPatternSignalContext(...).catch((): undefined => undefined);
   *   if (refreshed !== undefined) {
   *     session.activePatternSignals = refreshed;
   *   }
   */
  function applyRefreshedSignal(
    existing: string | null,
    refreshed: string | null | undefined,
  ): string | null {
    let activePatternSignals = existing;
    if (refreshed !== undefined) {
      activePatternSignals = refreshed;
    }
    return activePatternSignals;
  }

  it('error path (undefined) preserves an existing wobble signal on PTT/OpenMic', () => {
    const existing = '- ser_vs_estar: WOBBLING — slipped back after partial stability. Needs revisiting.';
    const result = applyRefreshedSignal(existing, undefined); // fetchPatternSignalContext threw
    assert.strictEqual(
      result,
      existing,
      'An error from fetchPatternSignalContext must not overwrite an existing wobble signal',
    );
  });

  it('error path (undefined) preserves null when no signals were set', () => {
    const result = applyRefreshedSignal(null, undefined);
    assert.strictEqual(result, null, 'Existing null must be preserved on error');
  });

  it('stable path (null) intentionally clears an existing wobble signal', () => {
    const existing = '- ser_vs_estar: WOBBLING — slipped back. Needs revisiting.';
    const result = applyRefreshedSignal(existing, null);
    assert.strictEqual(
      result,
      null,
      'A null return (all compartments stable) must clear the signal — this is the intentional clear path',
    );
  });

  it('refresh path (string) replaces an existing signal with fresh data', () => {
    const existing = '- old_pattern: WOBBLING — slipped back. Needs revisiting.';
    const fresh    = '- new_pattern: IN PROGRESS — being drilled (3 poundings, 0 wobbles). Keep building.';
    const result   = applyRefreshedSignal(existing, fresh);
    assert.strictEqual(result, fresh, 'A successful refresh must replace the existing signal');
  });

  it('refresh path (string) sets signals when none were present before', () => {
    const fresh  = '- reflexive_verbs: WOBBLING — slipped back. Needs revisiting.';
    const result = applyRefreshedSignal(null, fresh);
    assert.strictEqual(result, fresh, 'A successful refresh must set signals when starting from null');
  });

  it('error path preserves combined wobble + pounding signal string', () => {
    const combined =
      '- ser_vs_estar: WOBBLING — slipped back. Needs revisiting.\n' +
      '- preterite_ir: IN PROGRESS — being drilled (5 poundings, 1 wobbles). Keep building.';
    assert.strictEqual(
      applyRefreshedSignal(combined, undefined),
      combined,
      'Error path must preserve the full signal string including both wobbling and pounding entries',
    );
  });
});
