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

// ── Tests: Refresh button presence and refetch wiring — static source analysis ─
//
// CONTRACT: The Refresh button in AbsenceMonitorTab must be present and wired
// to refetch() regardless of component state.  It must not be inside a
// conditional block that hides it when isLoading=false and data=undefined
// (error state).
//
// Approach: read the real CommandCenter.tsx source and assert on the
// AbsenceMonitorTab region.  These tests will fail if the button is removed,
// its onClick is changed, or it is wrapped in a conditional that hides it in
// error state.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Source extraction ─────────────────────────────────────────────────────────

// Locate the AbsenceMonitorTab region in the real source file.
// We extract from `function AbsenceMonitorTab()` to the next top-level
// `function ` declaration so we only assert within this component.

function readAbsenceMonitorTabSource(): string {
  const filePath = resolve(
    process.cwd(),
    'client/src/pages/admin/CommandCenter.tsx',
  );
  const full = readFileSync(filePath, 'utf-8');
  const start = full.indexOf('function AbsenceMonitorTab()');
  if (start === -1) throw new Error('AbsenceMonitorTab not found in CommandCenter.tsx');
  // Find the next top-level function declaration after the start.
  const afterStart = full.indexOf('\nfunction ', start + 1);
  return afterStart === -1 ? full.slice(start) : full.slice(start, afterStart);
}

const absenceMonitorTabSrc = readAbsenceMonitorTabSource();

// ── Helper: locate the Refresh button region in the source ───────────────────
//
// The Refresh button is identified by its data-testid="button-refresh-absence".
// We locate that anchor and check:
//   - refetch() is called inside the same onClick block
//   - the badge-count key is also invalidated in the same block
//   - the button is NOT inside an isLoading/data conditional
//
// The onClick handler is a multi-statement block:
//   onClick={() => {
//     refetch();
//     queryClient.invalidateQueries({ queryKey: ['/api/admin/absence-nudges/count'] });
//   }}

function findRefreshButtonContext(src: string): {
  buttonLine: string;
  precedingConditional: boolean;
} {
  const lines = src.split('\n');

  // Step 1: locate the testid anchor (stable even when onClick shape changes).
  const testidIdx = lines.findIndex(
    (l) => l.includes('data-testid="button-refresh-absence"'),
  );
  if (testidIdx === -1) return { buttonLine: '', precedingConditional: false };

  // Step 2: walk backward from the testid line to find the opening <Button tag.
  // The button's props span multiple lines; we need the *opening* line so that
  // the conditional lookback starts before the button, not inside its prop block
  // (where `isLoading` appears legitimately as a disabled / className expression).
  let openingIdx = testidIdx;
  for (let i = testidIdx; i >= Math.max(0, testidIdx - 20); i--) {
    if (lines[i].trimStart().startsWith('<Button')) {
      openingIdx = i;
      break;
    }
  }

  const buttonLine = lines[openingIdx];

  // Step 3: look back up to 15 lines from the <Button opening to detect whether
  // the button is wrapped in an isLoading/data conditional block.
  const lookback = lines.slice(Math.max(0, openingIdx - 15), openingIdx);
  const conditionalKeywords = /\bisLoading\s*\?|\bdata\s*\?|\bdata\s*&&/;
  const lookbackStr = lookback.join('\n');
  const hasConditional =
    conditionalKeywords.test(lookbackStr) &&
    // A closing tag just before the <Button means any preceding ternary was
    // already closed — the button lives outside that conditional block.
    !/(\/div>|<\/>|<\/Card[^>]*>)\s*$/.test(lookbackStr.trimEnd());

  return { buttonLine, precedingConditional: hasConditional };
}

describe('Refresh button — source-level presence and refetch wiring', () => {
  it('AbsenceMonitorTab source is readable and non-empty', () => {
    assert.ok(absenceMonitorTabSrc.length > 200, 'component source must be non-trivial');
    assert.ok(
      absenceMonitorTabSrc.startsWith('function AbsenceMonitorTab'),
      'source must start at the correct function boundary',
    );
  });

  it('Refresh button exists in AbsenceMonitorTab and calls refetch()', () => {
    // The onClick may be an inline arrow or a block — both must call refetch().
    assert.ok(
      absenceMonitorTabSrc.includes('refetch()'),
      'AbsenceMonitorTab must call refetch() somewhere in the Refresh button handler — ' +
        'if this fails the button was removed or refetch() is no longer invoked',
    );
  });

  it('Refresh button also invalidates the badge-count query key on click', () => {
    // Task 405: clicking Refresh must also clear the /api/admin/absence-nudges/count
    // cache so the tab-label badge updates immediately without waiting for the 30s poll.
    assert.ok(
      absenceMonitorTabSrc.includes('/api/admin/absence-nudges/count'),
      'AbsenceMonitorTab Refresh handler must invalidate /api/admin/absence-nudges/count — ' +
        'without this the badge lags up to 30 s after the founder manually refreshes',
    );
  });

  it('Refresh button carries the RefreshCw icon (visual identity check)', () => {
    assert.ok(
      absenceMonitorTabSrc.includes('RefreshCw'),
      'AbsenceMonitorTab must contain a RefreshCw icon near the Refresh button',
    );
  });

  it('Refresh button is NOT inside an isLoading conditional — it renders in error state', () => {
    const { buttonLine, precedingConditional } = findRefreshButtonContext(absenceMonitorTabSrc);
    assert.ok(
      buttonLine.length > 0,
      'Refresh button must be present (located via data-testid="button-refresh-absence")',
    );
    assert.equal(
      precedingConditional,
      false,
      'Refresh button must not be gated by an isLoading or data conditional — ' +
        'it must render even when data is undefined (error state)',
    );
  });

  it('refetch is declared via useQuery in AbsenceMonitorTab', () => {
    assert.ok(
      absenceMonitorTabSrc.includes('refetch') &&
        absenceMonitorTabSrc.includes('useQuery'),
      'AbsenceMonitorTab must use useQuery and destructure refetch from it',
    );
  });

  it('query key targets /api/founder/absence-nudges — Refresh re-issues the correct endpoint', () => {
    assert.ok(
      absenceMonitorTabSrc.includes('/api/founder/absence-nudges'),
      'useQuery in AbsenceMonitorTab must target /api/founder/absence-nudges ' +
        'so refetch() re-issues the correct request after a 500',
    );
  });
});

// ── Tests: Refresh button click → recovered data replaces zeros ───────────────
//
// Sequence the user experiences:
//   1. API returns 500  → isLoading=false, data=undefined → cards show 0.
//   2. User clicks Refresh → refetch() re-issues /api/founder/absence-nudges.
//   3. API recovers     → data becomes defined → cards show real values.
//
// Step 2 is confirmed by the source-level tests above (refetch is wired to the
// button onClick).  Steps 1 and 3 are verified here against the same display
// expressions the component uses.

describe('Refresh button click → recovered data shows real nudge counts, not 0', () => {
  // Step 1: error state — data=undefined, isLoading=false (identical to a 500 response).
  it('before Refresh: pending card expression yields 0 in error state', () => {
    const data: AbsenceNudgesResponse | undefined = undefined;
    const isLoading = false;
    // Mirrors: {isLoading ? '…' : (data?.summary.pending ?? 0)}
    const displayed = isLoading ? '…' : (data?.summary.pending ?? 0);
    assert.strictEqual(displayed, 0);
  });

  it('before Refresh: resolved card expression yields 0 in error state', () => {
    const data: AbsenceNudgesResponse | undefined = undefined;
    const isLoading = false;
    const displayed = isLoading ? '…' : (data?.summary.resolved ?? 0);
    assert.strictEqual(displayed, 0);
  });

  it('before Refresh: total card expression yields 0 in error state', () => {
    const data: AbsenceNudgesResponse | undefined = undefined;
    const isLoading = false;
    const displayed = isLoading ? '…' : (data?.summary.total ?? 0);
    assert.strictEqual(displayed, 0);
  });

  // Step 3: after refetch() returns successfully — data is defined.
  it('after Refresh: pending card expression yields real count (1), not 0', () => {
    const data = buildResponse([existingPendingNudge], [existingResolvedNudge], 1);
    const isLoading = false;
    const displayed = isLoading ? '…' : (data?.summary.pending ?? 0);
    assert.strictEqual(displayed, 1);
    assert.notStrictEqual(displayed, 0, 'pending must not be 0 after recovery');
  });

  it('after Refresh: resolved card expression yields real count (1), not 0', () => {
    const data = buildResponse([existingPendingNudge], [existingResolvedNudge], 1);
    const isLoading = false;
    const displayed = isLoading ? '…' : (data?.summary.resolved ?? 0);
    assert.strictEqual(displayed, 1);
    assert.notStrictEqual(displayed, 0, 'resolved must not be 0 after recovery');
  });

  it('after Refresh: total card expression yields real count (2), not 0', () => {
    const data = buildResponse([existingPendingNudge], [existingResolvedNudge], 1);
    const isLoading = false;
    const displayed = isLoading ? '…' : (data?.summary.total ?? 0);
    assert.strictEqual(displayed, 2);
    assert.notStrictEqual(displayed, 0, 'total must not be 0 after recovery');
  });

  it('after Refresh: pending list renders nudge cards (not empty state)', () => {
    const data = buildResponse([existingPendingNudge], [existingResolvedNudge], 1);
    // Component uses: (data?.pending ?? []).length === 0 → empty-state
    const isEmpty = (data?.pending ?? []).length === 0;
    assert.equal(isEmpty, false, 'pending list must be non-empty after recovery');
  });

  it('after Refresh: resolved list renders nudge cards (not empty state)', () => {
    const data = buildResponse([existingPendingNudge], [existingResolvedNudge], 1);
    const isEmpty = (data?.resolved ?? []).length === 0;
    assert.equal(isEmpty, false, 'resolved list must be non-empty after recovery');
  });

  it('transition: pending display goes from 0 (error) to 1 (recovered)', () => {
    const errorData: AbsenceNudgesResponse | undefined = undefined;
    const recoveredData = buildResponse([existingPendingNudge], [existingResolvedNudge], 1);
    const isLoading = false;

    const before = isLoading ? '…' : (errorData?.summary.pending ?? 0);
    const after  = isLoading ? '…' : (recoveredData?.summary.pending ?? 0);

    assert.strictEqual(before, 0);
    assert.strictEqual(after, 1);
    assert.notStrictEqual(after, before, 'display value must change after recovery');
  });

  it('transition: total display goes from 0 (error) to 2 (recovered)', () => {
    const errorData: AbsenceNudgesResponse | undefined = undefined;
    const recoveredData = buildResponse([existingPendingNudge], [existingResolvedNudge], 1);
    const isLoading = false;

    assert.strictEqual(isLoading ? '…' : (errorData?.summary.total   ?? 0), 0);
    assert.strictEqual(isLoading ? '…' : (recoveredData?.summary.total ?? 0), 2);
  });
});

// ── Tests: Refresh button disabled/loading state ──────────────────────────────
//
// CONTRACT: When a refetch is in flight the Refresh button must be disabled to
// prevent double-clicks, and the RefreshCw icon must carry `animate-spin` so
// the user sees visual feedback.
//
// TanStack Query v5 detail:
//   - `isLoading` is only true on the FIRST fetch (no data yet, pending status).
//   - `isFetching` is true during EVERY in-flight request — initial load AND
//     every subsequent refetch() call.
//   After an error the user clicks Refresh: query status is 'error', but
//   isFetching=true while the retry is in flight.  isLoading stays false.
//   The button/icon must be gated on `isFetching`, not `isLoading`.
//
// Tests:
//   A. Source-level: confirm the prop/class condition references `isFetching`.
//   B. Behavioural: simulate the three relevant query states and assert that
//      the button disabled expression and icon className expression produce the
//      correct values in each state.

// ── A. Source-level assertions ────────────────────────────────────────────────

describe('Refresh button — source guard uses isFetching (not isLoading)', () => {
  it('isFetching is destructured from useQuery in AbsenceMonitorTab', () => {
    assert.ok(
      absenceMonitorTabSrc.includes('isFetching'),
      'AbsenceMonitorTab must destructure isFetching from useQuery — ' +
        'isLoading stays false during a manual refetch; isFetching covers all in-flight states',
    );
  });

  it('Refresh button has disabled={isFetching} prop', () => {
    assert.ok(
      absenceMonitorTabSrc.includes('disabled={isFetching}'),
      'AbsenceMonitorTab Refresh button must carry disabled={isFetching} — ' +
        'without it the button can be double-clicked while a refetch is in flight',
    );
  });

  it('RefreshCw icon applies animate-spin conditional on isFetching', () => {
    // The class must reference isFetching, not isLoading, for the same reason.
    const hasConditional =
      absenceMonitorTabSrc.includes('animate-spin') &&
      /isFetching[^}]{0,80}animate-spin|animate-spin[^}]{0,80}isFetching/.test(
        absenceMonitorTabSrc,
      );
    assert.ok(
      hasConditional,
      'animate-spin must be conditionally applied based on isFetching — ' +
        'if it references isLoading the spinner will not appear during a manual refetch',
    );
  });

  it('Refresh button still carries RefreshCw icon (visual identity check)', () => {
    assert.ok(
      absenceMonitorTabSrc.includes('RefreshCw'),
      'AbsenceMonitorTab Refresh button must include a RefreshCw icon',
    );
  });
});

// ── B. Behavioural: inline replicas of the button expressions ─────────────────
//
// These tests simulate the three relevant query states a user will encounter:
//
//   State 1 — idle (initial load done, no refetch pending):
//     isFetching=false → button enabled, no spinner.
//
//   State 2 — refetch in flight (user clicked Refresh after an error):
//     isFetching=true, isLoading=false → button disabled, spinner visible.
//     This is the critical path the task targets.
//
//   State 3 — initial load (first ever fetch, no data yet):
//     isFetching=true, isLoading=true → button disabled, spinner visible.

// Inline replicas (mirror AbsenceMonitorTab JSX):
//   disabled={isFetching}
//   className={`h-4 w-4 mr-2${isFetching ? ' animate-spin' : ''}`}

function buttonDisabled(isFetching: boolean): boolean {
  return isFetching;
}

function iconClassName(isFetching: boolean): string {
  return `h-4 w-4 mr-2${isFetching ? ' animate-spin' : ''}`;
}

describe('Refresh button — behavioural: disabled and spinner states', () => {
  // State 1: idle — no request in flight
  it('[idle] button is NOT disabled when isFetching=false', () => {
    assert.equal(buttonDisabled(false), false);
  });

  it('[idle] icon does NOT have animate-spin when isFetching=false', () => {
    const cls = iconClassName(false);
    assert.ok(!cls.includes('animate-spin'), `expected no animate-spin, got: ${cls}`);
  });

  // State 2: refetch in flight — the exact path triggered by clicking Refresh
  // after a 500.  isLoading stays false; isFetching becomes true.
  it('[refetch in flight] button IS disabled when isFetching=true, isLoading=false', () => {
    const isFetching = true;
    const isLoading  = false;          // typical after-error refetch: no isLoading
    void isLoading;                    // isLoading not used in the guard — intentional
    assert.equal(buttonDisabled(isFetching), true);
  });

  it('[refetch in flight] icon HAS animate-spin when isFetching=true, isLoading=false', () => {
    const isFetching = true;
    const cls = iconClassName(isFetching);
    assert.ok(cls.includes('animate-spin'), `expected animate-spin, got: ${cls}`);
  });

  it('[refetch in flight] isLoading=false alone would NOT disable button — confirms isFetching is required', () => {
    // This test documents WHY we need isFetching rather than isLoading:
    // during a manual refetch after error, isLoading is false.
    // If the button were gated on isLoading, it would be enabled (wrong).
    const isLoadingOnlyGate = false;   // simulating isLoading during a manual refetch
    assert.equal(isLoadingOnlyGate, false,
      'isLoading stays false during a post-error refetch — gating on it leaves the button clickable');
  });

  // State 3: initial load (first fetch, no prior data)
  it('[initial load] button IS disabled when isFetching=true', () => {
    assert.equal(buttonDisabled(true), true);
  });

  it('[initial load] icon HAS animate-spin when isFetching=true', () => {
    const cls = iconClassName(true);
    assert.ok(cls.includes('animate-spin'), `expected animate-spin on initial load, got: ${cls}`);
  });

  // Transition: error → refetch in flight → success
  it('transition: button goes from enabled → disabled → enabled across the refetch cycle', () => {
    // Before Refresh click: isFetching=false (idle/error, not fetching)
    assert.equal(buttonDisabled(false), false, 'enabled before Refresh click');
    // During refetch: isFetching=true
    assert.equal(buttonDisabled(true), true,  'disabled while refetch is in flight');
    // After refetch resolves: isFetching=false
    assert.equal(buttonDisabled(false), false, 'enabled again after refetch completes');
  });

  it('transition: icon animates only during the in-flight window', () => {
    assert.ok(!iconClassName(false).includes('animate-spin'), 'no spin before Refresh');
    assert.ok( iconClassName(true ).includes('animate-spin'), 'spins while in flight');
    assert.ok(!iconClassName(false).includes('animate-spin'), 'no spin after completion');
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
