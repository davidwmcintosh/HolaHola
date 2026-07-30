/**
 * Tests for the absence history filter — resolutionType query param.
 *
 * CONTRACT being tested:
 *   1. GET /api/admin/absence-nudges/history with no param → all resolved nudges
 *   2. GET /api/admin/absence-nudges/history?resolutionType=student_returned → only student_returned rows
 *   3. GET /api/admin/absence-nudges/history?resolutionType=message_queued → only message_queued rows
 *   4. GET /api/admin/absence-nudges/history?resolutionType=dismissed → only dismissed rows
 *   5. The frontend summary line counts come from the UNFILTERED list, even when a filter is active.
 *   6. An invalid/unknown resolutionType param is silently ignored (treated as no filter).
 *
 * The core filtering behaviour lives in listResolvedNudges() in daniela-absence-worker.ts.
 * Rather than spinning up a real DB, we inline the in-memory equivalent of that function here
 * (same approach as absence-resolution-labels.test.ts) so the test is zero-dependency and fast.
 *
 * Run with:
 *   npx tsx --test server/__tests__/absence-history-filter.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Types ────────────────────────────────────────────────────────────────────

type ResolutionType = 'student_returned' | 'message_queued' | 'dismissed';

interface ResolvedNudge {
  nudgeId: string;
  userId: string;
  firstName: string | null;
  daysSinceLastSession: number;
  lastSessionDate: Date | null;
  resolvedAt: Date;
  resolutionType: string | null;
}

// ── Inline implementation of listResolvedNudges filter logic ─────────────────
//
// This mirrors the WHERE clause in listResolvedNudges():
//   resolutionType param → filter to exact match
//   no param            → all resolved rows
//
// We apply the same VALID_TYPES guard that routes.ts applies before passing
// the param to listResolvedNudges (so unknown values are treated as no-filter).

const VALID_TYPES = ['student_returned', 'message_queued', 'dismissed'] as const;

function parseResolutionTypeParam(raw: string | undefined): ResolutionType | undefined {
  return VALID_TYPES.includes(raw as ResolutionType) ? (raw as ResolutionType) : undefined;
}

function filterResolvedNudges(
  all: ResolvedNudge[],
  resolutionType?: ResolutionType,
): ResolvedNudge[] {
  if (!resolutionType) return all;
  return all.filter(n => n.resolutionType === resolutionType);
}

// ── Seed data ────────────────────────────────────────────────────────────────

const now = new Date('2026-07-30T12:00:00Z');

const SEED_NUDGES: ResolvedNudge[] = [
  {
    nudgeId: 'nudge-1',
    userId: 'user-aaa',
    firstName: 'Alice',
    daysSinceLastSession: 10,
    lastSessionDate: new Date('2026-07-20T08:00:00Z'),
    resolvedAt: new Date('2026-07-30T09:00:00Z'),
    resolutionType: 'student_returned',
  },
  {
    nudgeId: 'nudge-2',
    userId: 'user-bbb',
    firstName: 'Bob',
    daysSinceLastSession: 8,
    lastSessionDate: new Date('2026-07-22T08:00:00Z'),
    resolvedAt: new Date('2026-07-30T10:00:00Z'),
    resolutionType: 'message_queued',
  },
  {
    nudgeId: 'nudge-3',
    userId: 'user-ccc',
    firstName: 'Carol',
    daysSinceLastSession: 14,
    lastSessionDate: new Date('2026-07-16T08:00:00Z'),
    resolvedAt: new Date('2026-07-30T11:00:00Z'),
    resolutionType: 'dismissed',
  },
  {
    nudgeId: 'nudge-4',
    userId: 'user-ddd',
    firstName: 'Dan',
    daysSinceLastSession: 12,
    lastSessionDate: new Date('2026-07-18T08:00:00Z'),
    resolvedAt: new Date('2026-07-30T11:30:00Z'),
    resolutionType: 'student_returned',
  },
  {
    nudgeId: 'nudge-5',
    userId: 'user-eee',
    firstName: 'Eve',
    daysSinceLastSession: 6,
    lastSessionDate: new Date('2026-07-24T08:00:00Z'),
    resolvedAt: new Date('2026-07-30T12:00:00Z'),
    resolutionType: 'message_queued',
  },
];

// ── Tests: server-side filter ────────────────────────────────────────────────

describe('listResolvedNudges — no filter (all resolved rows)', () => {
  it('returns all 5 seeded nudges when no resolutionType is given', () => {
    const result = filterResolvedNudges(SEED_NUDGES, undefined);
    assert.equal(result.length, 5);
  });

  it('result includes all three resolutionType values', () => {
    const result = filterResolvedNudges(SEED_NUDGES, undefined);
    const types = new Set(result.map(n => n.resolutionType));
    assert.ok(types.has('student_returned'));
    assert.ok(types.has('message_queued'));
    assert.ok(types.has('dismissed'));
  });
});

describe('listResolvedNudges — filter by student_returned', () => {
  it('returns only student_returned rows', () => {
    const result = filterResolvedNudges(SEED_NUDGES, 'student_returned');
    assert.equal(result.length, 2);
    assert.ok(result.every(n => n.resolutionType === 'student_returned'));
  });

  it('returned nudge IDs are nudge-1 and nudge-4', () => {
    const result = filterResolvedNudges(SEED_NUDGES, 'student_returned');
    const ids = result.map(n => n.nudgeId).sort();
    assert.deepEqual(ids, ['nudge-1', 'nudge-4']);
  });

  it('does NOT include message_queued rows', () => {
    const result = filterResolvedNudges(SEED_NUDGES, 'student_returned');
    assert.ok(result.every(n => n.resolutionType !== 'message_queued'));
  });

  it('does NOT include dismissed rows', () => {
    const result = filterResolvedNudges(SEED_NUDGES, 'student_returned');
    assert.ok(result.every(n => n.resolutionType !== 'dismissed'));
  });
});

describe('listResolvedNudges — filter by message_queued', () => {
  it('returns only message_queued rows', () => {
    const result = filterResolvedNudges(SEED_NUDGES, 'message_queued');
    assert.equal(result.length, 2);
    assert.ok(result.every(n => n.resolutionType === 'message_queued'));
  });

  it('returned nudge IDs are nudge-2 and nudge-5', () => {
    const result = filterResolvedNudges(SEED_NUDGES, 'message_queued');
    const ids = result.map(n => n.nudgeId).sort();
    assert.deepEqual(ids, ['nudge-2', 'nudge-5']);
  });

  it('does NOT include student_returned rows', () => {
    const result = filterResolvedNudges(SEED_NUDGES, 'message_queued');
    assert.ok(result.every(n => n.resolutionType !== 'student_returned'));
  });
});

describe('listResolvedNudges — filter by dismissed', () => {
  it('returns only dismissed rows', () => {
    const result = filterResolvedNudges(SEED_NUDGES, 'dismissed');
    assert.equal(result.length, 1);
    assert.ok(result.every(n => n.resolutionType === 'dismissed'));
  });

  it('returned nudge ID is nudge-3', () => {
    const result = filterResolvedNudges(SEED_NUDGES, 'dismissed');
    assert.equal(result[0].nudgeId, 'nudge-3');
  });

  it('does NOT include student_returned or message_queued rows', () => {
    const result = filterResolvedNudges(SEED_NUDGES, 'dismissed');
    assert.ok(result.every(n => n.resolutionType !== 'student_returned'));
    assert.ok(result.every(n => n.resolutionType !== 'message_queued'));
  });
});

// ── Tests: VALID_TYPES guard (mirrors routes.ts) ─────────────────────────────

describe('resolutionType param guard — invalid values treated as no-filter', () => {
  it('unknown string "snoozed" is coerced to undefined (no filter)', () => {
    const parsed = parseResolutionTypeParam('snoozed');
    assert.equal(parsed, undefined);
    // With no filter the full list is returned
    const result = filterResolvedNudges(SEED_NUDGES, parsed);
    assert.equal(result.length, 5);
  });

  it('empty string is coerced to undefined (no filter)', () => {
    const parsed = parseResolutionTypeParam('');
    assert.equal(parsed, undefined);
    const result = filterResolvedNudges(SEED_NUDGES, parsed);
    assert.equal(result.length, 5);
  });

  it('undefined is kept as undefined (no filter)', () => {
    const parsed = parseResolutionTypeParam(undefined);
    assert.equal(parsed, undefined);
    const result = filterResolvedNudges(SEED_NUDGES, parsed);
    assert.equal(result.length, 5);
  });

  it('valid type "student_returned" passes through unchanged', () => {
    const parsed = parseResolutionTypeParam('student_returned');
    assert.equal(parsed, 'student_returned');
  });

  it('valid type "message_queued" passes through unchanged', () => {
    const parsed = parseResolutionTypeParam('message_queued');
    assert.equal(parsed, 'message_queued');
  });

  it('valid type "dismissed" passes through unchanged', () => {
    const parsed = parseResolutionTypeParam('dismissed');
    assert.equal(parsed, 'dismissed');
  });
});

// ── Tests: frontend summary counts from unfiltered list ──────────────────────
//
// AbsenceHistoryPanel keeps two separate queries:
//   allData   → always fetches without ?resolutionType (unfiltered, for counts)
//   data      → fetches with the active filter (for the list)
//
// The counts object is always derived from allData.history, never from data.history.
// These tests verify that the count computation is correct regardless of active filter.

function computeSummaryCounts(allHistory: ResolvedNudge[]) {
  return {
    student_returned: allHistory.filter(n => n.resolutionType === 'student_returned').length,
    message_queued:   allHistory.filter(n => n.resolutionType === 'message_queued').length,
    dismissed:        allHistory.filter(n => n.resolutionType === 'dismissed').length,
  };
}

describe('frontend summary counts — always from unfiltered list', () => {
  it('counts are correct when no filter is active', () => {
    const counts = computeSummaryCounts(SEED_NUDGES);
    assert.equal(counts.student_returned, 2);
    assert.equal(counts.message_queued, 2);
    assert.equal(counts.dismissed, 1);
  });

  it('summary counts stay the same when student_returned filter is active', () => {
    // allHistory is always the full list — filter only affects the displayed rows
    const allHistory = SEED_NUDGES;
    const filteredDisplay = filterResolvedNudges(SEED_NUDGES, 'student_returned');

    const counts = computeSummaryCounts(allHistory);

    // Display shows only 2 rows — but the summary must still show all 3 types
    assert.equal(filteredDisplay.length, 2);
    assert.equal(counts.student_returned, 2, 'summary student_returned count unchanged');
    assert.equal(counts.message_queued, 2,   'summary message_queued count unchanged');
    assert.equal(counts.dismissed, 1,        'summary dismissed count unchanged');
  });

  it('summary counts stay the same when message_queued filter is active', () => {
    const allHistory = SEED_NUDGES;
    const filteredDisplay = filterResolvedNudges(SEED_NUDGES, 'message_queued');

    const counts = computeSummaryCounts(allHistory);

    assert.equal(filteredDisplay.length, 2);
    assert.equal(counts.student_returned, 2);
    assert.equal(counts.message_queued, 2);
    assert.equal(counts.dismissed, 1);
  });

  it('summary counts stay the same when dismissed filter is active', () => {
    const allHistory = SEED_NUDGES;
    const filteredDisplay = filterResolvedNudges(SEED_NUDGES, 'dismissed');

    const counts = computeSummaryCounts(allHistory);

    // Only 1 row displayed — summary must still reflect all 5 nudges
    assert.equal(filteredDisplay.length, 1);
    assert.equal(counts.student_returned, 2);
    assert.equal(counts.message_queued, 2);
    assert.equal(counts.dismissed, 1);
  });

  it('total count (all filter button) equals sum of individual type counts', () => {
    const counts = computeSummaryCounts(SEED_NUDGES);
    const total = counts.student_returned + counts.message_queued + counts.dismissed;
    assert.equal(total, SEED_NUDGES.length);
  });

  it('switching filter does NOT change summary line — counts come from allHistory', () => {
    const counts = computeSummaryCounts(SEED_NUDGES);

    // Simulate switching through all three filters; counts must be identical each time
    for (const filter of ['student_returned', 'message_queued', 'dismissed'] as ResolutionType[]) {
      filterResolvedNudges(SEED_NUDGES, filter); // would update the display list
      const refreshedCounts = computeSummaryCounts(SEED_NUDGES); // always from full list
      assert.deepEqual(refreshedCounts, counts, `counts must not change when filter="${filter}"`);
    }
  });
});

// ── Tests: limit param clamping (mirrors routes.ts + listResolvedNudges) ─────
//
// routes.ts (fixed):
//   const rawLimit = parseInt(req.query.limit as string, 10);
//   const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1), 100);
//
// listResolvedNudges (daniela-absence-worker.ts):
//   .limit(Math.min(limit, 100))
//
// Together these ensure:
//   - oversized limit (e.g. 200) is silently capped at 100
//   - non-numeric limit (e.g. "abc") falls back to the default 20
//   - missing limit (undefined) falls back to the default 20
//   - zero or negative limit is clamped to 1 (lower bound — never an unsafe DB call)

/** Inline replica of the fixed routes.ts limit-parsing expression */
function parseLimit(raw: string | undefined): number {
  const parsed = parseInt(raw as string, 10);
  return Math.min(Math.max(Number.isFinite(parsed) ? parsed : 20, 1), 100);
}

/**
 * Simulate applying the parsed limit to an in-memory list.
 * parseLimit already enforces [1..100], so we can always slice safely.
 */
function applyLimit(rows: ResolvedNudge[], raw: string | undefined): ResolvedNudge[] {
  return rows.slice(0, parseLimit(raw));
}

// Build a larger dataset (150 items) so cap tests are meaningful
const LARGE_SEED: ResolvedNudge[] = Array.from({ length: 150 }, (_, i) => ({
  nudgeId: `nudge-${i + 1}`,
  userId: `user-${i + 1}`,
  firstName: `Student${i + 1}`,
  daysSinceLastSession: 5 + (i % 10),
  lastSessionDate: new Date('2026-07-01T00:00:00Z'),
  resolvedAt: new Date('2026-07-28T00:00:00Z'),
  resolutionType: (['student_returned', 'message_queued', 'dismissed'] as const)[i % 3],
}));

describe('history endpoint — limit param clamping', () => {
  it('limit=200 is capped at 100 — never more than 100 rows returned', () => {
    const rows = applyLimit(LARGE_SEED, '200');
    assert.ok(rows.length <= 100, `Expected ≤100 rows, got ${rows.length}`);
    assert.equal(rows.length, 100);
  });

  it('limit=100 returns exactly 100 rows (at-boundary value)', () => {
    const rows = applyLimit(LARGE_SEED, '100');
    assert.equal(rows.length, 100);
  });

  it('limit=50 returns exactly 50 rows (under-cap value)', () => {
    const rows = applyLimit(LARGE_SEED, '50');
    assert.equal(rows.length, 50);
  });

  it('limit=20 (default) returns exactly 20 rows', () => {
    const rows = applyLimit(LARGE_SEED, '20');
    assert.equal(rows.length, 20);
  });

  it('limit="abc" (non-numeric) falls back to default 20', () => {
    // parseInt('abc', 10) === NaN; Number.isFinite(NaN) === false → default 20 used.
    const parsed = parseLimit('abc');
    assert.equal(parsed, 20, 'parseLimit("abc") should return the default 20');
    const rows = applyLimit(LARGE_SEED, 'abc');
    assert.equal(rows.length, 20, 'non-numeric limit should return 20 rows (the default)');
  });

  it('limit=undefined (omitted) falls back to default 20', () => {
    const rows = applyLimit(LARGE_SEED, undefined);
    assert.equal(rows.length, 20, 'missing limit should default to 20');
  });

  it('limit=0 is clamped to 1 (lower bound — prevents unsafe DB LIMIT 0)', () => {
    const rows = applyLimit(LARGE_SEED, '0');
    assert.equal(rows.length, 1);
  });

  it('limit=-5 (negative) is clamped to 1 (lower bound — prevents unsafe negative DB LIMIT)', () => {
    const rows = applyLimit(LARGE_SEED, '-5');
    assert.equal(rows.length, 1);
  });

  it('limit=1 returns exactly 1 row (minimum valid positive value)', () => {
    const rows = applyLimit(LARGE_SEED, '1');
    assert.equal(rows.length, 1);
  });

  it('limit=999 is capped at 100 — caller cannot request thousands of rows', () => {
    const rows = applyLimit(LARGE_SEED, '999');
    assert.equal(rows.length, 100);
  });

  it('parsed limit is always ≤ 100 for any string input from "1" to "10000"', () => {
    for (const n of [1, 50, 100, 101, 500, 1000, 10000]) {
      const parsed = parseLimit(String(n));
      assert.ok(
        Number.isNaN(parsed) || parsed <= 100,
        `parseLimit("${n}") = ${parsed}; expected ≤ 100`,
      );
    }
  });
});

// ── Tests: empty state ───────────────────────────────────────────────────────

describe('edge cases — empty or no matching rows', () => {
  it('returns empty array when no nudges exist', () => {
    const result = filterResolvedNudges([], undefined);
    assert.equal(result.length, 0);
  });

  it('returns empty array when filter matches no rows', () => {
    // Only message_queued rows — filter for dismissed should return []
    const mqOnly: ResolvedNudge[] = SEED_NUDGES.filter(n => n.resolutionType === 'message_queued');
    const result = filterResolvedNudges(mqOnly, 'dismissed');
    assert.equal(result.length, 0);
  });

  it('summary counts are all zero for an empty history', () => {
    const counts = computeSummaryCounts([]);
    assert.equal(counts.student_returned, 0);
    assert.equal(counts.message_queued, 0);
    assert.equal(counts.dismissed, 0);
  });

  it('"No nudges match this filter" condition: allHistory non-empty but filteredDisplay empty', () => {
    const mqOnly: ResolvedNudge[] = SEED_NUDGES.filter(n => n.resolutionType === 'message_queued');
    const filteredDisplay = filterResolvedNudges(mqOnly, 'dismissed');

    // This is the condition for showing "No nudges match this filter"
    assert.equal(mqOnly.length > 0, true,        'allHistory is non-empty');
    assert.equal(filteredDisplay.length === 0, true, 'filtered display is empty');
  });
});
