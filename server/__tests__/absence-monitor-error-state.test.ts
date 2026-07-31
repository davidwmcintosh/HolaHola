/**
 * Tests for AbsenceMonitorTab — error-state rendering when the API returns 500.
 *
 * CONTRACT being tested:
 *   When /api/founder/absence-nudges returns a 500 (or any network error),
 *   React Query sets isLoading=false and data=undefined.  The component must not
 *   crash and every summary card must show "0" — not undefined, NaN, or blank.
 *
 *   The error branch is functionally identical to the not-yet-loaded branch from
 *   the component's perspective: data is undefined, isLoading is false.  All
 *   guards are `?? 0` / optional-chaining — they handle undefined regardless of
 *   why it is undefined.
 *
 *   1. When data is undefined AND isLoading is false (error state), pending card → 0.
 *   2. When data is undefined AND isLoading is false (error state), resolved card → 0.
 *   3. When data is undefined AND isLoading is false (error state), total card → 0.
 *   4. No card value is NaN or undefined — guaranteed by `?? 0`.
 *   5. Pending empty-state condition is true (shows graceful empty card, not crash).
 *   6. Resolved empty-state condition is true (shows graceful empty card, not crash).
 *   7. A nudge-aware scenario: even when nudges exist in memory but data is
 *      undefined (mid-error), the display still shows 0 everywhere — no stale
 *      reads from outside the data object can leak in.
 *   8. The `?? 0` guard is sufficient — `|| 0` would also coerce 0 to 0, but the
 *      component uses `??` which is null/undefined-specific; NaN would leak through
 *      if the server returned NaN.  The server must never return NaN — confirmed by
 *      the companion empty-state test.  Here we only guarantee the undefined path.
 *   9. isLoading=false, isError=true path: all three card expression branches
 *      (not the '…' branch) must produce number 0, not the string '0'.
 *  10. When data becomes defined again after a retry, the ?? 0 fallback is no
 *      longer needed — verified by confirming the guard yields the real value.
 *
 * All logic is inlined — no DB, no React, no network.
 *
 * Run with:
 *   npx tsx --test server/__tests__/absence-monitor-error-state.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Types (mirrored from CommandCenter.tsx) ───────────────────────────────────

interface AbsenceNudgeSummary {
  pending: number;
  resolved: number;
  total: number;
}

interface PendingNudge {
  nudgeId: string;
  userId: string;
  firstName: string | null;
  daysSinceLastSession: number;
  lastSessionDate: string | null;
  lastTopic: string | null;
  suppressUntil: string | null;
}

interface ResolvedNudge {
  nudgeId: string;
  userId: string;
  firstName: string | null;
  daysSinceLastSession: number;
  lastSessionDate: string | null;
  resolvedAt: string;
  resolutionType: string | null;
}

interface AbsenceNudgesResponse {
  summary: AbsenceNudgeSummary;
  pending: PendingNudge[];
  resolved: ResolvedNudge[];
}

// ── Inline replica of each summary card's display expression ──────────────────
//
// mirrors AbsenceMonitorTab JSX:
//   {isLoading ? '…' : (data?.summary.pending ?? 0)}
//   {isLoading ? '…' : (data?.summary.resolved ?? 0)}
//   {isLoading ? '…' : (data?.summary.total ?? 0)}
//
// When isLoading=false (error state), the ternary takes the right branch.
// data is undefined → optional chain short-circuits → ?? 0 yields 0.

function cardValue(
  data: AbsenceNudgesResponse | undefined,
  isLoading: boolean,
  field: 'pending' | 'resolved' | 'total',
): number | string {
  return isLoading ? '…' : (data?.summary[field] ?? 0);
}

function pendingCardValue(data: AbsenceNudgesResponse | undefined): number | string {
  return data?.summary.pending ?? 0;
}

function resolvedCardValue(data: AbsenceNudgesResponse | undefined): number | string {
  return data?.summary.resolved ?? 0;
}

function totalCardValue(data: AbsenceNudgesResponse | undefined): number | string {
  return data?.summary.total ?? 0;
}

// ── Inline replica of the empty-state conditions ──────────────────────────────
//
// pending view empty-state: (data?.pending ?? []).length === 0
// resolved view empty-state: (data?.resolved ?? []).length === 0

function isPendingEmpty(data: AbsenceNudgesResponse | undefined): boolean {
  return (data?.pending ?? []).length === 0;
}

function isResolvedEmpty(data: AbsenceNudgesResponse | undefined): boolean {
  return (data?.resolved ?? []).length === 0;
}

// ── Simulated nudge fixtures (existing nudges at the time of the API error) ───

const existingPendingNudge: PendingNudge = {
  nudgeId: 'nudge-p1',
  userId: 'user-aaa',
  firstName: 'Alice',
  daysSinceLastSession: 7,
  lastSessionDate: '2026-07-24T10:00:00Z',
  lastTopic: 'Past tense',
  suppressUntil: null,
};

const existingResolvedNudge: ResolvedNudge = {
  nudgeId: 'nudge-r1',
  userId: 'user-bbb',
  firstName: 'Bob',
  daysSinceLastSession: 10,
  lastSessionDate: '2026-07-21T08:00:00Z',
  resolvedAt: '2026-07-31T09:00:00Z',
  resolutionType: 'student_returned',
};

// ── Helper: valid full response (for recovery-path tests) ─────────────────────

function buildResponse(
  pending: PendingNudge[],
  resolved: ResolvedNudge[],
  pendingCount: number,
): AbsenceNudgesResponse {
  return {
    summary: {
      pending: pendingCount,
      resolved: resolved.length,
      total: pendingCount + resolved.length,
    },
    pending,
    resolved,
  };
}

// ── Tests: error state — data is undefined, isLoading is false ────────────────
//
// This is the React Query state when the server responds with 5xx or the
// request is rejected at the network level.

describe('summary card values — API error (isLoading=false, data=undefined)', () => {
  const isLoading = false;
  const data: AbsenceNudgesResponse | undefined = undefined;

  it('pending card shows exactly 0, not undefined or NaN', () => {
    const value = cardValue(data, isLoading, 'pending');
    assert.strictEqual(value, 0);
    assert.ok(!Number.isNaN(value as number), 'pending card must not be NaN in error state');
  });

  it('resolved card shows exactly 0, not undefined or NaN', () => {
    const value = cardValue(data, isLoading, 'resolved');
    assert.strictEqual(value, 0);
    assert.ok(!Number.isNaN(value as number), 'resolved card must not be NaN in error state');
  });

  it('total card shows exactly 0, not undefined or NaN', () => {
    const value = cardValue(data, isLoading, 'total');
    assert.strictEqual(value, 0);
    assert.ok(!Number.isNaN(value as number), 'total card must not be NaN in error state');
  });

  it('all three card values are the number 0, not the string "0"', () => {
    assert.strictEqual(cardValue(data, isLoading, 'pending'), 0);
    assert.strictEqual(cardValue(data, isLoading, 'resolved'), 0);
    assert.strictEqual(cardValue(data, isLoading, 'total'), 0);
  });

  it('does not render "…" — isLoading=false takes the value branch', () => {
    const p = cardValue(data, isLoading, 'pending');
    const r = cardValue(data, isLoading, 'resolved');
    const t = cardValue(data, isLoading, 'total');
    assert.notEqual(p, '…');
    assert.notEqual(r, '…');
    assert.notEqual(t, '…');
  });
});

// ── Tests: empty-state conditions in error state ──────────────────────────────
//
// When data is undefined the pending/resolved lists fall back to [], so the
// empty-state card is shown rather than nothing or a crash.

describe('empty-state conditions — API error (data=undefined)', () => {
  it('isPendingEmpty is true — graceful empty card, not a crash', () => {
    assert.equal(isPendingEmpty(undefined), true);
  });

  it('isResolvedEmpty is true — graceful empty card, not a crash', () => {
    assert.equal(isResolvedEmpty(undefined), true);
  });

  it('pending list guard (data?.pending ?? []) yields an array of length 0', () => {
    const list = (undefined as AbsenceNudgesResponse | undefined)?.pending ?? [];
    assert.equal(list.length, 0);
    assert.ok(Array.isArray(list));
  });

  it('resolved list guard (data?.resolved ?? []) yields an array of length 0', () => {
    const list = (undefined as AbsenceNudgesResponse | undefined)?.resolved ?? [];
    assert.equal(list.length, 0);
    assert.ok(Array.isArray(list));
  });
});

// ── Tests: nudge-aware scenario — existing nudges do not leak into error state ─
//
// Even when nudge objects exist in the environment, the component reads
// exclusively from the `data` prop.  If data is undefined, nothing from
// local fixtures bleeds into the display values.

describe('nudge-aware error state — existing nudges do not affect display when data=undefined', () => {
  // Nudges exist as local variables (simulating previously loaded state that
  // was discarded when the query errored and data reverted to undefined).
  const _pendingNudges = [existingPendingNudge];
  const _resolvedNudges = [existingResolvedNudge];
  void _pendingNudges; // referenced to satisfy linter; not used in expressions
  void _resolvedNudges;

  const data: AbsenceNudgesResponse | undefined = undefined;

  it('pending card still shows 0 even though a pending nudge exists locally', () => {
    assert.strictEqual(pendingCardValue(data), 0);
  });

  it('resolved card still shows 0 even though a resolved nudge exists locally', () => {
    assert.strictEqual(resolvedCardValue(data), 0);
  });

  it('total card still shows 0 even though nudges exist locally', () => {
    assert.strictEqual(totalCardValue(data), 0);
  });

  it('isPendingEmpty is true regardless of local nudge array contents', () => {
    assert.equal(isPendingEmpty(data), true);
  });

  it('isResolvedEmpty is true regardless of local nudge array contents', () => {
    assert.equal(isResolvedEmpty(data), true);
  });
});

// ── Tests: recovery after error — query succeeds on retry ────────────────────
//
// After a transient 500 the user clicks Refresh and the query succeeds.
// The `?? 0` guard must yield the real value (not force 0) when data is present.

describe('recovery path — data defined after successful retry', () => {
  const recovered = buildResponse([existingPendingNudge], [existingResolvedNudge], 1);

  it('pending card shows real count (1) after recovery', () => {
    const value = pendingCardValue(recovered);
    assert.strictEqual(value, 1);
  });

  it('resolved card shows real count (1) after recovery', () => {
    const value = resolvedCardValue(recovered);
    assert.strictEqual(value, 1);
  });

  it('total card shows real count (2) after recovery', () => {
    const value = totalCardValue(recovered);
    assert.strictEqual(value, 2);
  });

  it('isPendingEmpty is false after recovery with real nudges', () => {
    assert.equal(isPendingEmpty(recovered), false);
  });

  it('isResolvedEmpty is false after recovery with real nudges', () => {
    assert.equal(isResolvedEmpty(recovered), false);
  });

  it('card values are not NaN after recovery', () => {
    assert.ok(!Number.isNaN(pendingCardValue(recovered) as number));
    assert.ok(!Number.isNaN(resolvedCardValue(recovered) as number));
    assert.ok(!Number.isNaN(totalCardValue(recovered) as number));
  });
});

// ── Tests: ?? 0 guard semantics ───────────────────────────────────────────────
//
// Explicit verification that ?? catches null and undefined but not 0 or NaN.

describe('?? 0 guard — semantics verification', () => {
  it('undefined ?? 0 yields 0', () => {
    const v = (undefined as number | undefined) ?? 0;
    assert.strictEqual(v, 0);
  });

  it('null ?? 0 yields 0', () => {
    const v = (null as number | null) ?? 0;
    assert.strictEqual(v, 0);
  });

  it('0 ?? 0 yields 0 (no double-fallback)', () => {
    const v = (0 as number | undefined) ?? 0;
    assert.strictEqual(v, 0);
  });

  it('real count ?? 0 yields the real count, not 0', () => {
    const v = (5 as number | undefined) ?? 0;
    assert.strictEqual(v, 5);
  });

  it('NaN ?? 0 yields NaN — server must never return NaN (guard does not catch it)', () => {
    const v = (NaN as number | undefined) ?? 0;
    // NaN is not null/undefined, so ?? does NOT replace it.
    // This test documents the known limitation: the server must return valid integers.
    assert.ok(Number.isNaN(v), 'NaN passes through ?? — server must not produce NaN');
  });
});
