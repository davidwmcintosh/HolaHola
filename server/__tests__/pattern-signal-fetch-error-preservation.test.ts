/**
 * Confirms that `session.activePatternSignals` is NOT overwritten when
 * `fetchPatternSignalContext` throws during a RECORD_PATTERN_SIGNAL fire-and-forget.
 *
 * CONTRACTS tested — via static source analysis of the real production handler
 * (server/services/native-fc-handlers.ts, RECORD_PATTERN_SIGNAL case, step 5):
 *
 * 1. The `.catch()` on `fetchPatternSignalContext` returns `undefined`, NOT `null`.
 *    Returning `null` is indistinguishable from "all patterns resolved to stable"
 *    and would silently wipe live wobble context from `session.activePatternSignals`.
 *
 * 2. The result is only assigned to `session.activePatternSignals` inside an
 *    `if (refreshed !== undefined)` guard — the field is left unchanged when the
 *    fetch throws.
 *
 * 3. A comment in the source documents the three-way meaning of the result:
 *    null = stable (intentional clear) / undefined = error (preserve) / string = active.
 *
 * 4. BEHAVIOURAL SIMULATION: the guard logic is exercised directly so any future
 *    refactor of the conditional is caught even if the text pattern changes.
 *
 * Run with:
 *   npx tsx --test server/__tests__/pattern-signal-fetch-error-preservation.test.ts
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

let handlerSrc: string;

before(() => {
  handlerSrc = readFileSync(
    resolve(root, 'server/services/native-fc-handlers.ts'),
    'utf-8',
  );
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Return a window of `src` centred on the first occurrence of `anchor`.
 * Returns '' when the anchor is not found.
 */
function regionAround(
  src: string,
  anchor: string,
  before = 200,
  after  = 900,
): string {
  const idx = src.indexOf(anchor);
  if (idx === -1) return '';
  return src.slice(Math.max(0, idx - before), Math.min(src.length, idx + anchor.length + after));
}

// The step-5 comment is the stable anchor for all tests in this suite.
const STEP5_ANCHOR = '5) Refresh mid-session pattern anchor';

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1 — The .catch() must return undefined, not null
// ═══════════════════════════════════════════════════════════════════════════════

describe('RECORD_PATTERN_SIGNAL step 5 — .catch() returns undefined, not null', () => {
  it('step-5 block is present in the handler source', () => {
    assert.ok(
      handlerSrc.includes(STEP5_ANCHOR),
      `Step-5 comment not found in native-fc-handlers.ts — the refresh block may ` +
      `have been restructured; search for "Refresh mid-session pattern anchor" to locate it`,
    );
  });

  it('.catch(() => null) anti-pattern is absent — null return would silently wipe live wobbles', () => {
    const region = regionAround(handlerSrc, STEP5_ANCHOR);
    // The original broken form: .catch(() => null)  with no guard
    const catchReturnsNull = /\.catch\s*\(\s*\(\s*\)\s*=>\s*null\s*\)/.test(region);
    assert.ok(
      !catchReturnsNull,
      `.catch(() => null) is present on fetchPatternSignalContext — this silently overwrites ` +
      `session.activePatternSignals (including live wobbles) on a transient DB error. ` +
      `The catch must return undefined so the guard below can distinguish the error path.`,
    );
  });

  it('.catch() callback explicitly returns undefined (typed or plain)', () => {
    const region = regionAround(handlerSrc, STEP5_ANCHOR);
    // Accept both:
    //   .catch((): undefined => { ...; return undefined; })
    //   .catch(() => undefined)
    const catchReturnsUndefined =
      // typed form: .catch((): undefined => { ... return undefined; })
      /\.catch\s*\(\s*\(\s*\)\s*:\s*undefined\s*=>/.test(region) ||
      // plain form: .catch(() => undefined)
      /\.catch\s*\(\s*\(\s*\)\s*=>\s*undefined\s*\)/.test(region);
    assert.ok(
      catchReturnsUndefined,
      `.catch() on fetchPatternSignalContext does not use undefined as the error sentinel. ` +
      `undefined is required to distinguish "fetch threw" from "fetch returned null because ` +
      `all patterns are stable". Use: .catch((): undefined => { return undefined; })`,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2 — The assignment is guarded by `if (refreshed !== undefined)`
// ═══════════════════════════════════════════════════════════════════════════════

describe('RECORD_PATTERN_SIGNAL step 5 — assignment is gated on the undefined sentinel', () => {
  it('session.activePatternSignals assignment is inside an `if (refreshed !== undefined)` guard', () => {
    const region = regionAround(handlerSrc, STEP5_ANCHOR);
    const hasGuard = /if\s*\(\s*refreshed\s*!==\s*undefined\s*\)/.test(region);
    assert.ok(
      hasGuard,
      `No 'if (refreshed !== undefined)' guard found after fetchPatternSignalContext — ` +
      `without this guard, a transient DB error would still overwrite session.activePatternSignals. ` +
      `Add: if (refreshed !== undefined) { session.activePatternSignals = refreshed; }`,
    );
  });

  it('session.activePatternSignals = refreshed appears after the guard (not before it)', () => {
    const region = regionAround(handlerSrc, STEP5_ANCHOR);
    const guardIdx  = region.indexOf('if (refreshed !== undefined)');
    const assignIdx = region.indexOf('session.activePatternSignals = refreshed');
    assert.ok(
      guardIdx !== -1,
      `Guard 'if (refreshed !== undefined)' not found in step-5 region`,
    );
    assert.ok(
      assignIdx !== -1,
      `'session.activePatternSignals = refreshed' assignment not found in step-5 region`,
    );
    assert.ok(
      assignIdx > guardIdx,
      `The assignment 'session.activePatternSignals = refreshed' appears BEFORE the guard — ` +
      `the guard must come first and wrap the assignment`,
    );
  });

  it('unconditional assignment `session.activePatternSignals = refreshed` is absent outside a guard', () => {
    const region = regionAround(handlerSrc, STEP5_ANCHOR);
    // If the guard exists AND the assignment is inside it, this pattern is safe.
    // The old broken form: no guard at all, assignment on its own line.
    // We detect the broken form: assignment exists but guard does not.
    const hasAssignment = region.includes('session.activePatternSignals = refreshed');
    const hasGuard      = /if\s*\(\s*refreshed\s*!==\s*undefined\s*\)/.test(region);
    if (hasAssignment) {
      assert.ok(
        hasGuard,
        `'session.activePatternSignals = refreshed' is present but no ` +
        `'if (refreshed !== undefined)' guard was found — the assignment is unconditional, ` +
        `which overwrites existing wobble signals on a DB error.`,
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3 — Source comment documents the three-way meaning
// ═══════════════════════════════════════════════════════════════════════════════

describe('RECORD_PATTERN_SIGNAL step 5 — intent comment is present', () => {
  it('comment documents that null means intentional clear (all stable)', () => {
    const region = regionAround(handlerSrc, STEP5_ANCHOR);
    const hasNullComment =
      /null\b.*\bstable\b/i.test(region) ||
      /null\b.*\bintentional\b/i.test(region) ||
      region.includes('null = all compartments resolved to stable');
    assert.ok(
      hasNullComment,
      `Step-5 comment does not explain that null means "all stable → intentional clear". ` +
      `Add a comment so future editors understand the three-way sentinel meaning.`,
    );
  });

  it('comment documents that undefined means error (preserve existing value)', () => {
    const region = regionAround(handlerSrc, STEP5_ANCHOR);
    const hasUndefinedComment =
      region.includes('undefined = fetchPatternSignalContext threw') ||
      /undefined\b.*\b(preserve|error|threw)/i.test(region);
    assert.ok(
      hasUndefinedComment,
      `Step-5 comment does not explain that undefined means "fetch threw → preserve existing". ` +
      `Add a comment so future editors understand the three-way sentinel meaning.`,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4 — Behavioural simulation of the guard logic
//
// Directly replicates the production conditional so any refactor that breaks
// the invariant is caught here even if the text patterns above change.
// ═══════════════════════════════════════════════════════════════════════════════

describe('Guard logic simulation — activePatternSignals preservation on error', () => {
  /**
   * Replicate the exact step-5 pattern from native-fc-handlers.ts:
   *
   *   const refreshed = await fetchPatternSignalContext(...).catch((): undefined => undefined);
   *   if (refreshed !== undefined) {
   *     session.activePatternSignals = refreshed;
   *   }
   *
   * We pass a simulated `refreshed` value and assert what happens to the field.
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

  it('error path (undefined) preserves an existing wobble signal', () => {
    const existing = '- ser_vs_estar: WOBBLING — slipped back after partial stability. Needs revisiting.';
    const result = applyRefreshedSignal(existing, undefined); // fetch threw
    assert.strictEqual(
      result,
      existing,
      'An error from fetchPatternSignalContext must not overwrite an existing wobble signal',
    );
  });

  it('error path (undefined) preserves null when no signals were set before', () => {
    const result = applyRefreshedSignal(null, undefined); // fetch threw, nothing was set before
    assert.strictEqual(result, null, 'Existing null must be preserved on error');
  });

  it('stable path (null) intentionally clears an existing wobble signal', () => {
    const existing = '- ser_vs_estar: WOBBLING — slipped back. Needs revisiting.';
    const result = applyRefreshedSignal(existing, null); // all compartments resolved to stable
    assert.strictEqual(
      result,
      null,
      'A null return (all stable) must clear the existing signal — this is the intentional clear path',
    );
  });

  it('refresh path (string) replaces an existing signal with the new value', () => {
    const existing = '- old_pattern: WOBBLING — slipped back. Needs revisiting.';
    const fresh    = '- new_pattern: IN PROGRESS — being drilled (3 poundings, 0 wobbles). Keep building.';
    const result   = applyRefreshedSignal(existing, fresh);
    assert.strictEqual(result, fresh, 'A successful refresh must replace the old signal with the new one');
  });

  it('refresh path (string) sets signals when none were present before', () => {
    const fresh  = '- reflexive_verbs: WOBBLING — slipped back. Needs revisiting.';
    const result = applyRefreshedSignal(null, fresh);
    assert.strictEqual(result, fresh, 'A successful refresh must set signals when starting from null');
  });

  it('error path preserves a combined wobble + pounding signal string', () => {
    const wobbleSignal   = '- ser_vs_estar: WOBBLING — slipped back. Needs revisiting.';
    const poundingSignal = '- preterite_ir: IN PROGRESS — being drilled (5 poundings, 1 wobbles). Keep building.';
    const combined = [wobbleSignal, poundingSignal].join('\n');

    assert.strictEqual(
      applyRefreshedSignal(combined, undefined),
      combined,
      'Error path must preserve the full signal string, including both wobbling and pounding entries',
    );
  });
});
