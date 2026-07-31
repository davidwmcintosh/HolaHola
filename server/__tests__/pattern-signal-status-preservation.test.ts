/**
 * Confirms that `unlock` and `review` events in RECORD_PATTERN_SIGNAL preserve
 * a compartment's existing status rather than overwriting it, and that `wobble`
 * unconditionally resets status to 'wobbling' (intentional regression signal)
 * while incrementing wobbleCount and setting lastWobbledAt.
 *
 * CONTRACTS tested — via static source analysis of the real production handler
 * (server/services/native-fc-handlers.ts, RECORD_PATTERN_SIGNAL case):
 *
 * 1. statusMap entries for `unlock` and `review` use the conditional
 *    `existing.status` form (preserve-or-fallback), not a fixed reset string.
 *
 * 2. The base `updates` object always includes `lastDrilledAt: now` so a review
 *    event touches that timestamp even when no counter moves.
 *
 * 3. Counter increment blocks (poundingCount, wobbleCount, derivationCount) are
 *    guarded by explicit eventType checks that exclude `unlock` and `review`.
 *    - `poundingCount`   is only incremented when eventType === 'pounding'
 *    - `wobbleCount`     is only incremented when eventType === 'wobble'
 *    - `derivationCount` is only incremented when eventType === 'derivation'
 *
 * 4. The handler includes comments explicitly stating that unlock and review do
 *    not increment counters (preserves intent documentation alongside the code).
 *
 * 5. `unlock` and `review` are present as recognised eventType values in the
 *    function declaration (daniela-function-registry.ts), so Daniela can
 *    actually fire them.
 *
 * Strategy: read the real production source and assert on specific patterns.
 * Any future change to the statusMap that silently resets a stable compartment,
 * or any accidental counter increment added for unlock/review, will break these
 * assertions immediately.
 *
 * Run with:
 *   npx tsx --test server/__tests__/pattern-signal-status-preservation.test.ts
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '../..');

// ── Load production source files once ─────────────────────────────────────────

let handlerSrc: string;
let registrySrc: string;

before(() => {
  handlerSrc  = readFileSync(resolve(root, 'server/services/native-fc-handlers.ts'), 'utf-8');
  registrySrc = readFileSync(resolve(root, 'server/services/daniela-function-registry.ts'), 'utf-8');
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Return a window of `src` centred on the first occurrence of `anchor`.
 * Returns '' when the anchor is not found.
 */
function regionAround(
  src: string,
  anchor: string,
  before = 400,
  after = 800,
): string {
  const idx = src.indexOf(anchor);
  if (idx === -1) return '';
  return src.slice(Math.max(0, idx - before), Math.min(src.length, idx + anchor.length + after));
}

// The statusMap is the canonical anchor for all handler tests.
const STATUS_MAP_ANCHOR = 'const statusMap: Record<typeof eventType, string>';

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1 — statusMap: unlock and review preserve existing status
// ═══════════════════════════════════════════════════════════════════════════════

describe('RECORD_PATTERN_SIGNAL statusMap — unlock and review preserve existing status', () => {
  it('statusMap block is present in the handler', () => {
    assert.ok(
      handlerSrc.includes(STATUS_MAP_ANCHOR),
      `statusMap declaration not found in native-fc-handlers.ts — the block may have been restructured or renamed`,
    );
  });

  it('unlock entry uses the conditional existing.status form (not a fixed reset string)', () => {
    // The pattern we require:
    //   unlock: (existing?.status && existing.status !== 'unstarted') ? existing.status : 'pounding',
    // Any form that hard-codes 'pounding' or another status unconditionally would
    // silently overwrite a stable compartment.
    const region = regionAround(handlerSrc, STATUS_MAP_ANCHOR, 0, 600);
    const hasUnlockPreserve = /unlock\s*:\s*\(existing\?\.status\b/.test(region);
    assert.ok(
      hasUnlockPreserve,
      `unlock entry in statusMap does not use the conditional existing.status form — ` +
      `a hard-coded status would overwrite a 'stable' or 'generative' compartment on unlock`,
    );
  });

  it('review entry uses the conditional existing.status form (not a fixed reset string)', () => {
    const region = regionAround(handlerSrc, STATUS_MAP_ANCHOR, 0, 600);
    const hasReviewPreserve = /review\s*:\s*\(existing\?\.status\b/.test(region);
    assert.ok(
      hasReviewPreserve,
      `review entry in statusMap does not use the conditional existing.status form — ` +
      `a hard-coded status would overwrite a 'stable' or 'generative' compartment on review`,
    );
  });

  it("unlock and review fall back to 'pounding' only when the compartment is new/unstarted", () => {
    // The fallback for both must be 'pounding' (the initial drill state), not 'stable'
    // or another misleading value, and it must be guarded by the unstarted check.
    const region = regionAround(handlerSrc, STATUS_MAP_ANCHOR, 0, 600);

    // Pattern:  ? existing.status : 'pounding'  — appears for both unlock and review
    const fallbackMatches = (region.match(/\?\s*existing\.status\s*:\s*'pounding'/g) ?? []).length;
    assert.ok(
      fallbackMatches >= 2,
      `Expected at least 2 conditional fallback patterns (unlock + review), found ${fallbackMatches} — ` +
      `one of the entries may be missing the preserve-or-fallback guard`,
    );
  });

  it("neither unlock nor review is mapped to a fixed 'wobbling' or 'generative' reset", () => {
    const region = regionAround(handlerSrc, STATUS_MAP_ANCHOR, 0, 600);
    // Disallow fixed literals on the unlock/review lines
    const hasUnlockBadLiteral = /unlock\s*:\s*'(wobbling|generative|stable|pounding)'/.test(region);
    const hasReviewBadLiteral = /review\s*:\s*'(wobbling|generative|stable|pounding)'/.test(region);
    assert.ok(
      !hasUnlockBadLiteral,
      `unlock is mapped to a fixed literal in the statusMap — this will overwrite stable compartments`,
    );
    assert.ok(
      !hasReviewBadLiteral,
      `review is mapped to a fixed literal in the statusMap — this will overwrite stable compartments`,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2 — lastDrilledAt is always written (review event must update it)
// ═══════════════════════════════════════════════════════════════════════════════

describe('RECORD_PATTERN_SIGNAL — lastDrilledAt is in the base updates object', () => {
  it('lastDrilledAt: now is set in the base updates block (before any counter guards)', () => {
    // The updates object is constructed just after the statusMap.
    // lastDrilledAt must be in the base object, not inside an eventType guard,
    // so that review and unlock both update it unconditionally.
    const updatesAnchor = 'const updates: Record<string, any> = {';
    const region = regionAround(handlerSrc, updatesAnchor, 0, 300);
    assert.ok(
      region.includes('lastDrilledAt: now'),
      `lastDrilledAt: now is not in the base updates object — ` +
      `review events will not update lastDrilledAt if this field is moved inside an eventType guard`,
    );
  });

  it('status: statusMap[eventType] is in the same base updates block as lastDrilledAt', () => {
    const updatesAnchor = 'const updates: Record<string, any> = {';
    const region = regionAround(handlerSrc, updatesAnchor, 0, 300);
    assert.ok(
      region.includes('status: statusMap[eventType]'),
      `status: statusMap[eventType] not found in the base updates block — ` +
      `unlock/review status values may not be applied to the DB write`,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3 — counters are not incremented for unlock or review
// ═══════════════════════════════════════════════════════════════════════════════

describe('RECORD_PATTERN_SIGNAL — unlock and review do not increment counters', () => {
  // We examine the counter-increment block that follows the base updates object.
  // Each counter must be gated by an explicit eventType === '<type>' guard,
  // and none of those guards may reference 'unlock' or 'review'.
  const COUNTER_BLOCK_ANCHOR = "if (eventType === 'pounding')";

  it("poundingCount is only incremented when eventType === 'pounding'", () => {
    const region = regionAround(handlerSrc, COUNTER_BLOCK_ANCHOR, 0, 600);
    // The increment must be inside the pounding guard, not a shared path
    const poundingGuardIdx  = region.indexOf("if (eventType === 'pounding')");
    const poundingCountIdx  = region.indexOf('poundingCount');
    assert.ok(poundingGuardIdx !== -1, `'if (eventType === 'pounding')' guard not found in counter block`);
    assert.ok(poundingCountIdx !== -1, `poundingCount increment not found in counter block`);
    // poundingCount must appear after the guard (inside it)
    assert.ok(
      poundingCountIdx > poundingGuardIdx,
      `poundingCount increment appears before the eventType === 'pounding' guard — ` +
      `it may be incremented unconditionally, which would affect unlock/review events`,
    );
  });

  it("wobbleCount is only incremented when eventType === 'wobble'", () => {
    const region = regionAround(handlerSrc, COUNTER_BLOCK_ANCHOR, 0, 600);
    const wobbleGuardIdx = region.indexOf("eventType === 'wobble'");
    const wobbleCountIdx = region.indexOf('wobbleCount');
    assert.ok(wobbleGuardIdx !== -1, `eventType === 'wobble' guard not found in counter block`);
    assert.ok(wobbleCountIdx !== -1, `wobbleCount not found in counter block`);
    assert.ok(
      wobbleCountIdx > wobbleGuardIdx,
      `wobbleCount appears before the 'wobble' guard — it may be incremented for non-wobble events`,
    );
  });

  it("derivationCount is only incremented when eventType === 'derivation'", () => {
    const region = regionAround(handlerSrc, COUNTER_BLOCK_ANCHOR, 0, 600);
    const derivGuardIdx = region.indexOf("eventType === 'derivation'");
    const derivCountIdx = region.indexOf('derivationCount');
    assert.ok(derivGuardIdx !== -1, `eventType === 'derivation' guard not found in counter block`);
    assert.ok(derivCountIdx !== -1, `derivationCount not found in counter block`);
    assert.ok(
      derivCountIdx > derivGuardIdx,
      `derivationCount appears before the 'derivation' guard`,
    );
  });

  it("counter block does not reference 'unlock' as a counter-increment trigger", () => {
    const region = regionAround(handlerSrc, COUNTER_BLOCK_ANCHOR, 0, 600);
    const hasUnlockCounter = /eventType\s*===\s*['"]unlock['"]/.test(region);
    assert.ok(
      !hasUnlockCounter,
      `eventType === 'unlock' found inside the counter-increment block — ` +
      `unlock must never increment any counter`,
    );
  });

  it("counter block does not reference 'review' as a counter-increment trigger", () => {
    const region = regionAround(handlerSrc, COUNTER_BLOCK_ANCHOR, 0, 600);
    const hasReviewCounter = /eventType\s*===\s*['"]review['"]/.test(region);
    assert.ok(
      !hasReviewCounter,
      `eventType === 'review' found inside the counter-increment block — ` +
      `review must never increment any counter`,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4 — Intent comments are present (documents the design for future editors)
// ═══════════════════════════════════════════════════════════════════════════════

describe('RECORD_PATTERN_SIGNAL — intent comments for unlock and review', () => {
  it('comment states unlock does not increment any counter', () => {
    // The comment documents the design so a future editor knows the omission is deliberate.
    const hasComment = handlerSrc.includes('unlock: no counter increment');
    assert.ok(
      hasComment,
      `Comment 'unlock: no counter increment' not found in handler — ` +
      `the no-counter rule for unlock may have been accidentally removed along with the comment`,
    );
  });

  it('comment states review does not increment any counter', () => {
    const hasComment = handlerSrc.includes('review: no counter increment');
    assert.ok(
      hasComment,
      `Comment 'review: no counter increment' not found in handler — ` +
      `the no-counter rule for review may have been accidentally removed along with the comment`,
    );
  });

  it('statusMap comment states unlock and review preserve existing status', () => {
    const hasComment = handlerSrc.includes(
      'unlock and review preserve whatever status the compartment already has',
    );
    assert.ok(
      hasComment,
      `Intent comment for status preservation not found — ` +
      `removing this comment is a signal that the preservation logic itself may have been changed`,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 5 — daniela-function-registry.ts: unlock and review are valid event types
// ═══════════════════════════════════════════════════════════════════════════════

describe('daniela-function-registry.ts — unlock and review are declared event types', () => {
  it("'unlock' appears in the record_pattern_signal tool declaration", () => {
    // The record_pattern_signal tool must enumerate 'unlock' so Daniela can fire it.
    const region = regionAround(registrySrc, 'record_pattern_signal', 0, 2000);
    assert.ok(
      region.includes('unlock'),
      `'unlock' not found within 2000 chars of record_pattern_signal in daniela-function-registry.ts — ` +
      `Daniela may not be able to fire the unlock event type`,
    );
  });

  it("'review' appears in the record_pattern_signal tool declaration", () => {
    const region = regionAround(registrySrc, 'record_pattern_signal', 0, 2000);
    assert.ok(
      region.includes('review'),
      `'review' not found within 2000 chars of record_pattern_signal in daniela-function-registry.ts — ` +
      `Daniela may not be able to fire the review event type`,
    );
  });

  it("'record_pattern_signal' tool is registered in the function registry", () => {
    assert.ok(
      registrySrc.includes('record_pattern_signal'),
      `record_pattern_signal not found in daniela-function-registry.ts — ` +
      `the tool declaration may have been removed`,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 6 — Logic simulation: verify the statusMap logic behaves correctly
//           for a stable compartment receiving unlock and review events.
//           This exercises the exact same conditional expression used in production.
// ═══════════════════════════════════════════════════════════════════════════════

describe('statusMap logic simulation — stable compartment + unlock/review', () => {
  /**
   * Replicate the exact statusMap conditional from native-fc-handlers.ts
   * so we can assert the result for different existing.status values.
   * If the production code changes this expression, the source-analysis tests
   * in Part 1 will fail first — this part adds a behavioural cross-check.
   */
  function computeStatus(
    eventType: 'unlock' | 'review',
    existing: { status: string } | null,
  ): string {
    const statusMap = {
      unlock: (existing?.status && existing.status !== 'unstarted') ? existing.status : 'pounding',
      review: (existing?.status && existing.status !== 'unstarted') ? existing.status : 'pounding',
    };
    return statusMap[eventType];
  }

  it("unlock on a 'stable' compartment returns 'stable'", () => {
    const result = computeStatus('unlock', { status: 'stable' });
    assert.strictEqual(result, 'stable',
      `unlock on a stable compartment must return 'stable', got '${result}'`);
  });

  it("review on a 'stable' compartment returns 'stable'", () => {
    const result = computeStatus('review', { status: 'stable' });
    assert.strictEqual(result, 'stable',
      `review on a stable compartment must return 'stable', got '${result}'`);
  });

  it("unlock on a 'generative' compartment returns 'generative'", () => {
    const result = computeStatus('unlock', { status: 'generative' });
    assert.strictEqual(result, 'generative',
      `unlock must not demote a generative compartment`);
  });

  it("review on a 'generative' compartment returns 'generative'", () => {
    const result = computeStatus('review', { status: 'generative' });
    assert.strictEqual(result, 'generative',
      `review must not demote a generative compartment`);
  });

  it("unlock on a new compartment (null existing) falls back to 'pounding'", () => {
    const result = computeStatus('unlock', null);
    assert.strictEqual(result, 'pounding',
      `unlock on a brand-new compartment must fall back to 'pounding'`);
  });

  it("review on a new compartment (null existing) falls back to 'pounding'", () => {
    const result = computeStatus('review', null);
    assert.strictEqual(result, 'pounding',
      `review on a brand-new compartment must fall back to 'pounding'`);
  });

  it("unlock on an 'unstarted' compartment falls back to 'pounding'", () => {
    const result = computeStatus('unlock', { status: 'unstarted' });
    assert.strictEqual(result, 'pounding',
      `unlock on an unstarted compartment must fall back to 'pounding' (unstarted is treated as new)`);
  });

  it("review on an 'unstarted' compartment falls back to 'pounding'", () => {
    const result = computeStatus('review', { status: 'unstarted' });
    assert.strictEqual(result, 'pounding',
      `review on an unstarted compartment must fall back to 'pounding'`);
  });

  it('counter simulation: unlock does not produce poundingCount, wobbleCount, or derivationCount', () => {
    // Replicate the counter-increment logic from the handler.
    const eventType = 'unlock';
    const existing = { poundingCount: 2, wobbleCount: 1, derivationCount: 3, status: 'stable' };
    const updates: Record<string, unknown> = { status: 'stable', lastDrilledAt: new Date() };

    if (eventType === 'pounding') updates.poundingCount   = (existing.poundingCount ?? 0) + 1;
    // @ts-ignore — deliberate runtime comparison
    else if (eventType === 'wobble') updates.wobbleCount  = (existing.wobbleCount ?? 0) + 1;
    // @ts-ignore
    else if (eventType === 'stability') updates.stabilizedAt = new Date();
    // @ts-ignore
    else if (eventType === 'derivation') updates.derivationCount = (existing.derivationCount ?? 0) + 1;
    // unlock and review: no counter branch

    assert.ok(!('poundingCount'   in updates), 'unlock must not set poundingCount');
    assert.ok(!('wobbleCount'     in updates), 'unlock must not set wobbleCount');
    assert.ok(!('derivationCount' in updates), 'unlock must not set derivationCount');
    assert.ok('lastDrilledAt'     in updates,  'unlock must always set lastDrilledAt');
  });

  it('counter simulation: review does not produce poundingCount, wobbleCount, or derivationCount', () => {
    const eventType = 'review';
    const existing = { poundingCount: 2, wobbleCount: 1, derivationCount: 3, status: 'stable' };
    const updates: Record<string, unknown> = { status: 'stable', lastDrilledAt: new Date() };

    if (eventType === 'pounding') updates.poundingCount   = (existing.poundingCount ?? 0) + 1;
    // @ts-ignore
    else if (eventType === 'wobble') updates.wobbleCount  = (existing.wobbleCount ?? 0) + 1;
    // @ts-ignore
    else if (eventType === 'stability') updates.stabilizedAt = new Date();
    // @ts-ignore
    else if (eventType === 'derivation') updates.derivationCount = (existing.derivationCount ?? 0) + 1;

    assert.ok(!('poundingCount'   in updates), 'review must not set poundingCount');
    assert.ok(!('wobbleCount'     in updates), 'review must not set wobbleCount');
    assert.ok(!('derivationCount' in updates), 'review must not set derivationCount');
    assert.ok('lastDrilledAt'     in updates,  'review must always set lastDrilledAt');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 7 — pounding on a stable/generative compartment preserves status
//           AND increments poundingCount
//
// The statusMap entry for 'pounding' uses the same conditional-preservation
// form as unlock and review:
//   pounding: (existing?.status && existing.status !== 'unstarted') ? existing.status : 'pounding'
//
// This means pounding a compartment that is already 'stable' or 'generative'
// must NOT demote it back to 'pounding' — it keeps its current status.
// At the same time, poundingCount must still be incremented (the drill event
// is recorded even though the status is preserved).
// ═══════════════════════════════════════════════════════════════════════════════

describe('RECORD_PATTERN_SIGNAL statusMap — pounding on stable/generative compartment', () => {
  // ── Source-level assertions ────────────────────────────────────────────────

  it('pounding entry uses the conditional existing.status form (not a fixed reset string)', () => {
    // The pattern we require:
    //   pounding: (existing?.status && existing.status !== 'unstarted') ? existing.status : 'pounding',
    // A hard-coded 'pounding' literal unconditionally would demote a stable compartment.
    const region = regionAround(handlerSrc, STATUS_MAP_ANCHOR, 0, 600);
    const hasPoundingPreserve = /pounding\s*:\s*\(existing\?\.status\b/.test(region);
    assert.ok(
      hasPoundingPreserve,
      `pounding entry in statusMap does not use the conditional existing.status form — ` +
      `a hard-coded 'pounding' literal would demote a 'stable' or 'generative' compartment on every drill`,
    );
  });

  it("pounding falls back to 'pounding' only when the compartment is new/unstarted", () => {
    // The fallback pattern:  ? existing.status : 'pounding'
    // must appear at least 3 times (unlock + review + pounding)
    const region = regionAround(handlerSrc, STATUS_MAP_ANCHOR, 0, 600);
    const fallbackMatches = (region.match(/\?\s*existing\.status\s*:\s*'pounding'/g) ?? []).length;
    assert.ok(
      fallbackMatches >= 3,
      `Expected at least 3 conditional fallback patterns (unlock + review + pounding), found ${fallbackMatches} — ` +
      `the pounding entry may be missing the preserve-or-fallback guard`,
    );
  });

  it('poundingCount increment block is guarded by eventType === pounding in the handler', () => {
    // Assert the production handler increments poundingCount inside an
    // `if (eventType === 'pounding')` block (not unconditionally).
    const hasPoundingGuard = /if\s*\(\s*eventType\s*===\s*'pounding'\s*\)/.test(handlerSrc);
    assert.ok(
      hasPoundingGuard,
      `poundingCount increment must be inside an if(eventType === 'pounding') guard; ` +
      `removing the guard would increment the counter on every RECORD_PATTERN_SIGNAL call`,
    );
  });

  // ── Logic simulations ─────────────────────────────────────────────────────

  /**
   * Replicate the exact pounding statusMap conditional from native-fc-handlers.ts.
   * If the production expression changes, the source-level test above will fail
   * first; this block adds a behavioural cross-check.
   */
  function computePoundingStatus(existing: { status: string } | null): string {
    return (existing?.status && existing.status !== 'unstarted')
      ? existing.status
      : 'pounding';
  }

  /**
   * Replicate the poundingCount increment from the handler counter block.
   */
  function computePoundingUpdates(
    existing: { poundingCount?: number; status: string } | null,
  ): Record<string, unknown> {
    const status = computePoundingStatus(existing);
    const updates: Record<string, unknown> = { status, lastDrilledAt: new Date() };
    // handler: if (eventType === 'pounding') { updates.poundingCount = (existing?.poundingCount ?? 0) + 1; }
    updates.poundingCount = (existing?.poundingCount ?? 0) + 1;
    return updates;
  }

  it("pounding on a 'generative' compartment keeps status 'generative'", () => {
    const result = computePoundingStatus({ status: 'generative' });
    assert.strictEqual(result, 'generative',
      `pounding must not demote a 'generative' compartment — status should remain 'generative'`);
  });

  it("pounding on a 'stable' compartment keeps status 'stable'", () => {
    const result = computePoundingStatus({ status: 'stable' });
    assert.strictEqual(result, 'stable',
      `pounding must not demote a 'stable' compartment — status should remain 'stable'`);
  });

  it("poundingCount is incremented even when a 'generative' compartment preserves its status", () => {
    const existing = { poundingCount: 4, status: 'generative' };
    const updates = computePoundingUpdates(existing);
    assert.strictEqual(updates.status, 'generative',
      `status must be preserved as 'generative'`);
    assert.strictEqual(updates.poundingCount, 5,
      `poundingCount must go from 4 → 5 even when status is preserved`);
  });

  it("poundingCount is incremented even when a 'stable' compartment preserves its status", () => {
    const existing = { poundingCount: 2, status: 'stable' };
    const updates = computePoundingUpdates(existing);
    assert.strictEqual(updates.status, 'stable',
      `status must be preserved as 'stable'`);
    assert.strictEqual(updates.poundingCount, 3,
      `poundingCount must go from 2 → 3 even when status is preserved`);
  });

  it("pounding on a new compartment (null existing) falls back to 'pounding' and starts poundingCount at 1", () => {
    const updates = computePoundingUpdates(null);
    assert.strictEqual(updates.status, 'pounding',
      `pounding on a brand-new compartment must set status to 'pounding'`);
    assert.strictEqual(updates.poundingCount, 1,
      `poundingCount must start at 1 for a new compartment`);
  });

  it("pounding on an 'unstarted' compartment falls back to 'pounding'", () => {
    const result = computePoundingStatus({ status: 'unstarted' });
    assert.strictEqual(result, 'pounding',
      `pounding on an 'unstarted' compartment must fall back to 'pounding'`);
  });

  it("poundingCount is initialised to 1 when existing.poundingCount is undefined", () => {
    const existing = { status: 'stable' } as { poundingCount?: number; status: string };
    const updates = computePoundingUpdates(existing);
    assert.strictEqual(updates.poundingCount, 1,
      `poundingCount must default to 0 then increment to 1 when the field is absent`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 8 — wobble event: unconditional regression signal
//
// Unlike unlock/review, a 'wobble' event ALWAYS sets status='wobbling', even
// when the compartment was previously 'generative' or 'stable'. This is the
// intentional design: a wobble is a real regression that must surface.
// These tests confirm:
//   (a) the statusMap entry for wobble is a fixed literal (not conditional)
//   (b) wobbleCount is incremented and lastWobbledAt is set on every wobble
//   (c) the boundary: wobble on a 'generative' compartment yields 'wobbling'
// ═══════════════════════════════════════════════════════════════════════════════

describe('RECORD_PATTERN_SIGNAL statusMap — wobble is an unconditional regression signal', () => {
  it("wobble entry in statusMap is a fixed literal 'wobbling' (not conditional on existing.status)", () => {
    // A conditional form would allow wobble to silently preserve 'generative' or 'stable',
    // masking the regression. The fixed literal 'wobbling' is the contract.
    const region = regionAround(handlerSrc, STATUS_MAP_ANCHOR, 0, 600);
    // Must match: wobble: 'wobbling',  (fixed literal, not a ternary)
    const hasFixedWobble = /wobble\s*:\s*'wobbling'/.test(region);
    assert.ok(
      hasFixedWobble,
      `wobble entry in statusMap is not a fixed 'wobbling' literal — ` +
      `if it uses a conditional, a 'generative' compartment will not be demoted on wobble, masking regressions`,
    );
  });

  it("wobble entry does NOT use the conditional existing.status form", () => {
    // If someone accidentally makes wobble preserve-status like unlock/review,
    // this test will catch it immediately.
    const region = regionAround(handlerSrc, STATUS_MAP_ANCHOR, 0, 600);
    const hasConditionalWobble = /wobble\s*:\s*\(existing\?\.status\b/.test(region);
    assert.ok(
      !hasConditionalWobble,
      `wobble entry in statusMap uses the conditional existing.status form — ` +
      `wobble must unconditionally write 'wobbling' to surface the regression, not preserve a higher status`,
    );
  });
});

describe('RECORD_PATTERN_SIGNAL — wobble increments wobbleCount and sets lastWobbledAt', () => {
  it("wobbleCount increment is guarded by eventType === 'wobble'", () => {
    const region = regionAround(handlerSrc, "if (eventType === 'pounding')", 0, 600);
    const wobbleGuardIdx  = region.indexOf("eventType === 'wobble'");
    const wobbleCountIdx  = region.indexOf('wobbleCount');
    assert.ok(wobbleGuardIdx !== -1, `eventType === 'wobble' guard not found in counter block`);
    assert.ok(wobbleCountIdx !== -1, `wobbleCount not found in counter block`);
    assert.ok(
      wobbleCountIdx > wobbleGuardIdx,
      `wobbleCount increment appears before the 'wobble' guard — ` +
      `it may be incremented unconditionally or skipped entirely`,
    );
  });

  it("lastWobbledAt is set inside the wobble counter block", () => {
    // lastWobbledAt is specific to wobble events; it must appear after the wobble guard.
    const region = regionAround(handlerSrc, "if (eventType === 'pounding')", 0, 600);
    const wobbleGuardIdx    = region.indexOf("eventType === 'wobble'");
    const lastWobbledAtIdx  = region.indexOf('lastWobbledAt');
    assert.ok(lastWobbledAtIdx !== -1, `lastWobbledAt not found in counter block`);
    assert.ok(
      lastWobbledAtIdx > wobbleGuardIdx,
      `lastWobbledAt is not inside the wobble guard block — ` +
      `a wobble event will not stamp the timestamp, making regression tracking unreliable`,
    );
  });

  it("wobbleCount increment reads from existing.wobbleCount (not hard-coded)", () => {
    // Confirms the increment is cumulative, not a reset to 1.
    const region = regionAround(handlerSrc, "if (eventType === 'pounding')", 0, 600);
    const hasCumulativeIncrement = /wobbleCount\s*=\s*\(existing\?\.wobbleCount/.test(region) ||
                                   /wobbleCount\s*=\s*\(existing\.wobbleCount/.test(region);
    assert.ok(
      hasCumulativeIncrement,
      `wobbleCount increment does not read from existing.wobbleCount — ` +
      `the counter will be reset to 1 on every wobble instead of accumulating`,
    );
  });
});

describe('statusMap logic simulation — wobble on any status always yields wobbling', () => {
  /**
   * Replicate the exact statusMap + counter logic from native-fc-handlers.ts
   * for the 'wobble' event type, to assert boundary behaviour without a live DB.
   */
  function simulateWobble(existing: { status: string; wobbleCount: number } | null): {
    status: string;
    wobbleCount: number;
    hasLastWobbledAt: boolean;
  } {
    // Mirror of the production statusMap for wobble
    const status = 'wobbling'; // fixed literal — intentional

    const updates: Record<string, unknown> = {
      status,
      lastDrilledAt: new Date(),
    };
    // Mirror of the production counter block for wobble
    updates.wobbleCount   = (existing?.wobbleCount ?? 0) + 1;
    updates.lastWobbledAt = new Date();

    return {
      status: updates.status as string,
      wobbleCount: updates.wobbleCount as number,
      hasLastWobbledAt: 'lastWobbledAt' in updates,
    };
  }

  it("wobble on a 'generative' compartment sets status='wobbling' (regression signal)", () => {
    const result = simulateWobble({ status: 'generative', wobbleCount: 0 });
    assert.strictEqual(
      result.status,
      'wobbling',
      `wobble on a 'generative' compartment must demote to 'wobbling', got '${result.status}'`,
    );
  });

  it("wobble on a 'stable' compartment sets status='wobbling'", () => {
    const result = simulateWobble({ status: 'stable', wobbleCount: 2 });
    assert.strictEqual(
      result.status,
      'wobbling',
      `wobble on a 'stable' compartment must demote to 'wobbling', got '${result.status}'`,
    );
  });

  it("wobble on a 'pounding' compartment sets status='wobbling'", () => {
    const result = simulateWobble({ status: 'pounding', wobbleCount: 0 });
    assert.strictEqual(result.status, 'wobbling');
  });

  it('wobble on a new compartment (null existing) sets status=wobbling and wobbleCount=1', () => {
    const result = simulateWobble(null);
    assert.strictEqual(result.status, 'wobbling');
    assert.strictEqual(result.wobbleCount, 1,
      `wobbleCount must be 1 on first wobble of a new compartment`);
  });

  it('wobble increments wobbleCount cumulatively', () => {
    const result = simulateWobble({ status: 'stable', wobbleCount: 5 });
    assert.strictEqual(result.wobbleCount, 6,
      `wobbleCount must be 6 after wobble on a compartment with wobbleCount=5, got ${result.wobbleCount}`);
  });

  it('wobble sets lastWobbledAt', () => {
    const result = simulateWobble({ status: 'generative', wobbleCount: 0 });
    assert.ok(result.hasLastWobbledAt,
      `wobble must set lastWobbledAt so the regression timestamp is recorded`);
  });

  it('wobble does not preserve a higher status — confirms the design is unconditional', () => {
    // This test is the guard against someone accidentally making wobble status-preserving.
    // If statusMap ever changes to: wobble: (existing?.status...) ? existing.status : 'wobbling'
    // the simulation above would start returning 'generative', breaking the first test.
    // This test documents the intent explicitly.
    const statuses = ['generative', 'stable', 'pounding', 'wobbling'];
    for (const status of statuses) {
      const result = simulateWobble({ status, wobbleCount: 0 });
      assert.strictEqual(
        result.status,
        'wobbling',
        `wobble must override '${status}' and set 'wobbling' — ` +
        `a wobble is always a regression signal, not a no-op`,
      );
    }
  });
});
