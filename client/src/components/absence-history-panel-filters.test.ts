/**
 * Tests for the AbsenceHistoryPanel filter-button behaviour.
 *
 * Imports the REAL production helpers from
 * client/src/lib/absence-history-panel-logic.ts — the same module that
 * AbsenceHistoryPanel (ExpressLanePane.tsx) uses — so that regressions in the
 * component's filter logic are caught here rather than silently passing through
 * a mirrored re-implementation.
 *
 * Run with:
 *   npx tsx --test client/src/components/absence-history-panel-filters.test.ts
 *
 * Uses Node.js built-in test runner — no extra packages needed.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── localStorage shim (same pattern as absence-filter-persistence.test.ts) ──

const store = new Map<string, string>();

// @ts-ignore
globalThis.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
};

// ── Import the REAL production helpers ───────────────────────────────────────

import {
  shouldRenderFilterButtons,
  buildHistoryUrl,
  isActiveButton,
  buildFilters,
  type ResolvedNudge,
} from '../lib/absence-history-panel-logic.js';

import {
  ABSENCE_FILTER_KEY,
  readAbsenceFilterFromStorage,
  writeAbsenceFilterToStorage,
} from '../lib/absence-filter-storage.js';

// ── Sample nudge fixtures ────────────────────────────────────────────────────

function makeNudge(
  nudgeId: string,
  resolutionType: ResolvedNudge['resolutionType'],
): ResolvedNudge {
  return {
    nudgeId,
    userId: `user-${nudgeId}`,
    firstName: `Student-${nudgeId}`,
    daysSinceLastSession: 14,
    lastSessionDate: '2026-07-01T00:00:00.000Z',
    resolvedAt: '2026-07-15T00:00:00.000Z',
    resolutionType,
  };
}

const nudgeReturned = makeNudge('n1', 'student_returned');
const nudgeMessaged = makeNudge('n2', 'message_queued');
const nudgeDismissed = makeNudge('n3', 'dismissed');

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AbsenceHistoryPanel — filter buttons rendering gate (production helper)', () => {
  it('returns false (no filter buttons) when there are no nudges', () => {
    assert.equal(shouldRenderFilterButtons([]), false);
  });

  it('returns true (render filter buttons) when there is at least one nudge', () => {
    assert.equal(shouldRenderFilterButtons([nudgeReturned]), true);
  });

  it('returns true when the history contains nudges of multiple resolution types', () => {
    assert.equal(
      shouldRenderFilterButtons([nudgeReturned, nudgeMessaged, nudgeDismissed]),
      true,
    );
  });
});

describe('AbsenceHistoryPanel — fetch URL construction per active filter (production helper)', () => {
  it('uses the bare URL when filter is "all"', () => {
    assert.equal(buildHistoryUrl('all'), '/api/admin/absence-nudges/history');
  });

  it('appends ?resolutionType=student_returned when filter is "student_returned"', () => {
    assert.equal(
      buildHistoryUrl('student_returned'),
      '/api/admin/absence-nudges/history?resolutionType=student_returned',
    );
  });

  it('appends ?resolutionType=message_queued when filter is "message_queued"', () => {
    assert.equal(
      buildHistoryUrl('message_queued'),
      '/api/admin/absence-nudges/history?resolutionType=message_queued',
    );
  });

  it('appends ?resolutionType=dismissed when filter is "dismissed"', () => {
    assert.equal(
      buildHistoryUrl('dismissed'),
      '/api/admin/absence-nudges/history?resolutionType=dismissed',
    );
  });
});

describe('AbsenceHistoryPanel — active-button class logic (production helper)', () => {
  it('"all" button is active when filter is "all"', () => {
    assert.equal(isActiveButton('all', 'all'), true);
  });

  it('"all" button is NOT active when filter is "dismissed"', () => {
    assert.equal(isActiveButton('dismissed', 'all'), false);
  });

  it('"dismissed" button is active when filter is "dismissed"', () => {
    assert.equal(isActiveButton('dismissed', 'dismissed'), true);
  });

  it('"student_returned" button is active when filter is "student_returned"', () => {
    assert.equal(isActiveButton('student_returned', 'student_returned'), true);
  });

  it('"message_queued" button is NOT active when filter is "student_returned"', () => {
    assert.equal(isActiveButton('student_returned', 'message_queued'), false);
  });

  it('only one button is active at a time across all four filter keys', () => {
    const filterKeys = ['all', 'student_returned', 'message_queued', 'dismissed'] as const;
    for (const activeFilter of filterKeys) {
      const activeCount = filterKeys.filter((k) => isActiveButton(activeFilter, k)).length;
      assert.equal(
        activeCount,
        1,
        `Expected exactly 1 active button when filter is "${activeFilter}", got ${activeCount}`,
      );
    }
  });
});

describe('AbsenceHistoryPanel — filter persistence when a button is clicked (production helpers)', () => {
  beforeEach(() => { store.clear(); });

  it('persists "dismissed" to localStorage when the Dismissed button is clicked', () => {
    writeAbsenceFilterToStorage('dismissed');
    assert.equal(store.get(ABSENCE_FILTER_KEY), 'dismissed');
  });

  it('persists "student_returned" to localStorage when the Returned button is clicked', () => {
    writeAbsenceFilterToStorage('student_returned');
    assert.equal(store.get(ABSENCE_FILTER_KEY), 'student_returned');
  });

  it('persists "message_queued" to localStorage when the Messaged button is clicked', () => {
    writeAbsenceFilterToStorage('message_queued');
    assert.equal(store.get(ABSENCE_FILTER_KEY), 'message_queued');
  });

  it('persists "all" to localStorage when the All button is clicked', () => {
    store.set(ABSENCE_FILTER_KEY, 'dismissed');
    writeAbsenceFilterToStorage('all');
    assert.equal(store.get(ABSENCE_FILTER_KEY), 'all');
  });

  it('the stored value is readable back as the same filter after a write', () => {
    writeAbsenceFilterToStorage('message_queued');
    assert.equal(readAbsenceFilterFromStorage(), 'message_queued');
  });

  it('clicking Dismissed then Returned leaves "student_returned" as the stored value', () => {
    writeAbsenceFilterToStorage('dismissed');
    writeAbsenceFilterToStorage('student_returned');
    assert.equal(readAbsenceFilterFromStorage(), 'student_returned');
  });
});

describe('AbsenceHistoryPanel — buildFilters array structure (production helper)', () => {
  it('produces four filter buttons: all, student_returned, message_queued, dismissed', () => {
    const filters = buildFilters([nudgeReturned, nudgeMessaged, nudgeDismissed]);
    const keys = filters.map((f) => f.key);
    assert.deepEqual(keys, ['all', 'student_returned', 'message_queued', 'dismissed']);
  });

  it('counts each resolution type correctly', () => {
    const history = [nudgeReturned, nudgeReturned, nudgeMessaged, nudgeDismissed];
    const filters = buildFilters(history);

    const all = filters.find((f) => f.key === 'all')!;
    const returned = filters.find((f) => f.key === 'student_returned')!;
    const messaged = filters.find((f) => f.key === 'message_queued')!;
    const dismissed = filters.find((f) => f.key === 'dismissed')!;

    assert.equal(all.count, 4);
    assert.equal(returned.count, 2);
    assert.equal(messaged.count, 1);
    assert.equal(dismissed.count, 1);
  });

  it('"All" count equals the total history length', () => {
    const history = [nudgeReturned, nudgeMessaged];
    const filters = buildFilters(history);
    const all = filters.find((f) => f.key === 'all')!;
    assert.equal(all.count, history.length);
  });

  it('all counts are zero for an empty history (but filters array still has four entries)', () => {
    const filters = buildFilters([]);
    assert.equal(filters.length, 4);
    for (const f of filters) {
      assert.equal(f.count, 0);
    }
  });

  it('the "All" count matches shouldRenderFilterButtons — zero implies no buttons', () => {
    const emptyHistory: ResolvedNudge[] = [];
    const filters = buildFilters(emptyHistory);
    const allEntry = filters.find((f) => f.key === 'all')!;
    // When shouldRenderFilterButtons returns false, the "All" count must be 0.
    assert.equal(shouldRenderFilterButtons(emptyHistory), false);
    assert.equal(allEntry.count, 0);
  });

  it('the "All" count matches shouldRenderFilterButtons — non-zero implies buttons visible', () => {
    const history = [nudgeReturned];
    const filters = buildFilters(history);
    const allEntry = filters.find((f) => f.key === 'all')!;
    assert.equal(shouldRenderFilterButtons(history), true);
    assert.ok(allEntry.count > 0);
  });
});
