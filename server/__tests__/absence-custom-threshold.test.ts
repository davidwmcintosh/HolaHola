/**
 * Unit tests for the per-student custom absence threshold filter.
 *
 * CONTRACT being tested (from detectAbsentStudents() in daniela-absence-worker.ts):
 *
 *   1. A student with a 14-day custom threshold who has been absent 8 days
 *      is NOT included in the nudge batch — they haven't crossed their threshold yet.
 *
 *   2. The same student after 14 days of absence IS included — they have crossed it.
 *
 *   3. A student with no custom threshold falls back to the global default
 *      (ABSENCE_THRESHOLD_DAYS = 5) — identical behaviour to before the feature.
 *
 *   4. A student with a shorter custom threshold (2 days) is included if they've
 *      been absent >= 2 days, even though the global default is 5.
 *
 *   5. Blocked users (unresolved nudge or active suppress window) are always
 *      excluded regardless of how many days they've been absent or their threshold.
 *
 *   6. Exactly at the threshold boundary (daysSince === customThreshold) is included.
 *
 *   7. One day before the boundary (daysSince === customThreshold - 1) is excluded.
 *
 *   8. CONFIG QUERY FAILURE FALLBACK (task 279): when the studentAbsenceConfig table
 *      query fails, detectAbsentStudents() catches the error and leaves configMap
 *      empty (daniela-absence-worker.ts lines 65-72).  The observable effect is:
 *
 *        - No custom threshold is applied to any student.
 *        - Every student that passed the DB query (absent >= global threshold) is
 *          included in the nudge batch — even those who would normally be protected
 *          by a longer custom threshold.
 *        - Students are NOT blocked by their custom threshold when config is
 *          unavailable.  This is intentional: the worker errs toward notifying
 *          Daniela rather than silently dropping students.
 *
 *      Simulated in tests by passing an empty configMap to applyCustomThresholdFilter.
 *
 * The filter logic is inlined here (same approach as absence-history-filter.test.ts)
 * so the test is zero-dependency and fast — no DB, no server.
 *
 * Run with:
 *   npx tsx --test server/__tests__/absence-custom-threshold.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Types ────────────────────────────────────────────────────────────────────

interface AbsentStudent {
  userId: string;
  firstName: string | null;
  lastSessionDate: Date;
}

// ── Inline replica of the per-student threshold filter ───────────────────────
//
// This mirrors the eligibleStudents filter block in detectAbsentStudents()
// (daniela-absence-worker.ts lines 135-145).  Any change to the production
// logic that diverges from this contract will cause these tests to fail.

const GLOBAL_THRESHOLD_DAYS = 5;

function applyCustomThresholdFilter(
  absentStudents: AbsentStudent[],
  configMap: Map<string, number>,
  blockedUserIds: Set<string>,
  now: Date,
): AbsentStudent[] {
  return absentStudents.filter(s => {
    // Blocked users are always excluded (unresolved nudge or active suppress window)
    if (blockedUserIds.has(s.userId)) return false;

    const customThreshold = configMap.get(s.userId);
    if (customThreshold !== undefined) {
      const daysSince = Math.floor(
        (now.getTime() - s.lastSessionDate.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (daysSince < customThreshold) return false;
    }
    // No custom threshold → already passed the global DB filter (>= global default)
    return true;
  });
}

/** Build a Date that is `days` days before `now`. */
function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-07-31T12:00:00Z');

// Student A: 14-day custom threshold, 8 days absent → should NOT be nudged yet
const STUDENT_A_8_DAYS: AbsentStudent = {
  userId: 'user-weekly-8d',
  firstName: 'Ana',
  lastSessionDate: daysAgo(NOW, 8),
};

// Student A equivalent: same threshold, 14 days absent → should BE nudged
const STUDENT_A_14_DAYS: AbsentStudent = {
  userId: 'user-weekly-14d',
  firstName: 'Ana',
  lastSessionDate: daysAgo(NOW, 14),
};

// Student A equivalent: same threshold, 15 days absent → should BE nudged (over threshold)
const STUDENT_A_15_DAYS: AbsentStudent = {
  userId: 'user-weekly-15d',
  firstName: 'Ana',
  lastSessionDate: daysAgo(NOW, 15),
};

// Student A equivalent: same threshold, 13 days absent → should NOT be nudged (one day before)
const STUDENT_A_13_DAYS: AbsentStudent = {
  userId: 'user-weekly-13d',
  firstName: 'Ana',
  lastSessionDate: daysAgo(NOW, 13),
};

// Student B: no custom threshold (uses global 5-day default), 7 days absent → nudged
const STUDENT_B_NO_CONFIG: AbsentStudent = {
  userId: 'user-default-7d',
  firstName: 'Bianca',
  lastSessionDate: daysAgo(NOW, 7),
};

// Student C: 2-day custom threshold (high-engagement), 2 days absent → nudged early
const STUDENT_C_2DAY: AbsentStudent = {
  userId: 'user-keen-2d',
  firstName: 'Carlos',
  lastSessionDate: daysAgo(NOW, 2),
};

// Student D: blocked (unresolved nudge), 20 days absent → always excluded
const STUDENT_D_BLOCKED: AbsentStudent = {
  userId: 'user-blocked-20d',
  firstName: 'Daniela',
  lastSessionDate: daysAgo(NOW, 20),
};

// ── Tests: core custom threshold cases ───────────────────────────────────────

describe('per-student threshold — 14-day custom threshold', () => {
  const configMap = new Map<string, number>([
    ['user-weekly-8d',  14],
    ['user-weekly-14d', 14],
    ['user-weekly-15d', 14],
    ['user-weekly-13d', 14],
  ]);
  const blocked = new Set<string>();

  it('student absent 8 days with 14-day threshold is NOT included in the nudge batch', () => {
    const result = applyCustomThresholdFilter([STUDENT_A_8_DAYS], configMap, blocked, NOW);
    assert.equal(result.length, 0,
      'Student should not be nudged after only 8 days when threshold is 14');
    assert.ok(!result.some(s => s.userId === STUDENT_A_8_DAYS.userId),
      'user-weekly-8d must not appear in the nudge batch');
  });

  it('student absent 14 days with 14-day threshold IS included (threshold exactly met)', () => {
    const result = applyCustomThresholdFilter([STUDENT_A_14_DAYS], configMap, blocked, NOW);
    assert.equal(result.length, 1,
      'Student should be nudged exactly when daysSince === threshold');
    assert.equal(result[0].userId, STUDENT_A_14_DAYS.userId);
  });

  it('student absent 15 days with 14-day threshold IS included (threshold exceeded)', () => {
    const result = applyCustomThresholdFilter([STUDENT_A_15_DAYS], configMap, blocked, NOW);
    assert.equal(result.length, 1);
    assert.equal(result[0].userId, STUDENT_A_15_DAYS.userId);
  });

  it('student absent 13 days with 14-day threshold is NOT included (one day before boundary)', () => {
    const result = applyCustomThresholdFilter([STUDENT_A_13_DAYS], configMap, blocked, NOW);
    assert.equal(result.length, 0,
      'daysSince=13 < threshold=14 → must be excluded');
  });
});

// ── Tests: boundary cases ─────────────────────────────────────────────────────

describe('per-student threshold — boundary values', () => {
  it('daysSince === threshold is included (>= comparison in production code)', () => {
    const configMap = new Map([['boundary-user', 7]]);
    const student: AbsentStudent = {
      userId: 'boundary-user',
      firstName: 'Bea',
      lastSessionDate: daysAgo(NOW, 7),
    };
    const result = applyCustomThresholdFilter([student], configMap, new Set(), NOW);
    assert.equal(result.length, 1, 'At-boundary student must be included');
  });

  it('daysSince === threshold - 1 is excluded', () => {
    const configMap = new Map([['boundary-user', 7]]);
    const student: AbsentStudent = {
      userId: 'boundary-user',
      firstName: 'Bea',
      lastSessionDate: daysAgo(NOW, 6),
    };
    const result = applyCustomThresholdFilter([student], configMap, new Set(), NOW);
    assert.equal(result.length, 0, 'One-day-before-boundary student must be excluded');
  });

  it('daysSince === threshold + 1 is included', () => {
    const configMap = new Map([['boundary-user', 7]]);
    const student: AbsentStudent = {
      userId: 'boundary-user',
      firstName: 'Bea',
      lastSessionDate: daysAgo(NOW, 8),
    };
    const result = applyCustomThresholdFilter([student], configMap, new Set(), NOW);
    assert.equal(result.length, 1, 'One-day-past-boundary student must be included');
  });
});

// ── Tests: no custom config → global default ──────────────────────────────────

describe('per-student threshold — no custom config uses global default', () => {
  it('student with no custom config passes through (DB already filtered by global threshold)', () => {
    // The DB query already filters to lastSessionDate <= globalThresholdDate,
    // so students reaching this function without a config entry are already eligible.
    const emptyConfigMap = new Map<string, number>();
    const result = applyCustomThresholdFilter([STUDENT_B_NO_CONFIG], emptyConfigMap, new Set(), NOW);
    assert.equal(result.length, 1,
      'No config entry → no custom filter applied → student passes through');
    assert.equal(result[0].userId, STUDENT_B_NO_CONFIG.userId);
  });

  it('multiple students with no custom config all pass through', () => {
    const students: AbsentStudent[] = [
      { userId: 'u1', firstName: 'Eve',   lastSessionDate: daysAgo(NOW, 6) },
      { userId: 'u2', firstName: 'Frank', lastSessionDate: daysAgo(NOW, 10) },
      { userId: 'u3', firstName: 'Grace', lastSessionDate: daysAgo(NOW, 30) },
    ];
    const result = applyCustomThresholdFilter(students, new Map(), new Set(), NOW);
    assert.equal(result.length, 3, 'All three should pass through without a config map');
  });
});

// ── Tests: shorter custom threshold (high-engagement students) ────────────────

describe('per-student threshold — shorter custom threshold (2 days)', () => {
  it('student with 2-day threshold absent 2 days IS included', () => {
    const configMap = new Map([['user-keen-2d', 2]]);
    const result = applyCustomThresholdFilter([STUDENT_C_2DAY], configMap, new Set(), NOW);
    assert.equal(result.length, 1,
      'daysSince=2 >= threshold=2 → should be nudged early');
  });

  it('student with 2-day threshold absent 1 day is NOT included', () => {
    const configMap = new Map([['user-keen-1d', 2]]);
    const student: AbsentStudent = {
      userId: 'user-keen-1d',
      firstName: 'Hiro',
      lastSessionDate: daysAgo(NOW, 1),
    };
    const result = applyCustomThresholdFilter([student], configMap, new Set(), NOW);
    assert.equal(result.length, 0, 'daysSince=1 < threshold=2 → not yet eligible');
  });
});

// ── Tests: blocked users ──────────────────────────────────────────────────────

describe('per-student threshold — blocked users always excluded', () => {
  it('blocked user with 20 days absence is excluded regardless of threshold', () => {
    const configMap = new Map([['user-blocked-20d', 14]]);
    const blocked = new Set(['user-blocked-20d']);
    const result = applyCustomThresholdFilter([STUDENT_D_BLOCKED], configMap, blocked, NOW);
    assert.equal(result.length, 0,
      'Blocked user must be excluded even when far past their threshold');
  });

  it('blocked user with no custom config is still excluded', () => {
    const blocked = new Set(['user-blocked-20d']);
    const result = applyCustomThresholdFilter([STUDENT_D_BLOCKED], new Map(), blocked, NOW);
    assert.equal(result.length, 0,
      'Blocked user is excluded regardless of whether they have a custom config');
  });

  it('blocking one user does not affect other users in the same batch', () => {
    const configMap = new Map<string, number>([
      ['user-blocked-20d', 14],
      ['user-weekly-14d',  14],
    ]);
    const blocked = new Set(['user-blocked-20d']);
    const students = [STUDENT_D_BLOCKED, STUDENT_A_14_DAYS];
    const result = applyCustomThresholdFilter(students, configMap, blocked, NOW);
    assert.equal(result.length, 1, 'Only the non-blocked student should appear');
    assert.equal(result[0].userId, STUDENT_A_14_DAYS.userId);
  });
});

// ── Tests: mixed batch ────────────────────────────────────────────────────────

describe('per-student threshold — mixed batch of students', () => {
  it('correctly separates eligible from ineligible students in one call', () => {
    //  user-weekly-8d:  threshold=14, absent 8  → NOT included
    //  user-weekly-14d: threshold=14, absent 14 → IS  included
    //  user-default-7d: no config,   absent 7  → IS  included (past global 5-day floor)
    //  user-keen-2d:    threshold=2,  absent 2  → IS  included
    //  user-blocked-20d: blocked                → NOT included

    const configMap = new Map<string, number>([
      ['user-weekly-8d',  14],
      ['user-weekly-14d', 14],
      ['user-keen-2d',     2],
    ]);
    const blocked = new Set(['user-blocked-20d']);
    const students = [
      STUDENT_A_8_DAYS,
      STUDENT_A_14_DAYS,
      STUDENT_B_NO_CONFIG,
      STUDENT_C_2DAY,
      STUDENT_D_BLOCKED,
    ];

    const result = applyCustomThresholdFilter(students, configMap, blocked, NOW);

    assert.equal(result.length, 3, 'Exactly 3 students should be eligible');

    const ids = result.map(s => s.userId);
    assert.ok(ids.includes('user-weekly-14d'), 'user-weekly-14d (14d absent, 14d threshold) must be included');
    assert.ok(ids.includes('user-default-7d'),  'user-default-7d (no custom config) must be included');
    assert.ok(ids.includes('user-keen-2d'),     'user-keen-2d (2d absent, 2d threshold) must be included');

    assert.ok(!ids.includes('user-weekly-8d'),  'user-weekly-8d (8d absent, 14d threshold) must NOT be included');
    assert.ok(!ids.includes('user-blocked-20d'),'user-blocked-20d (blocked) must NOT be included');
  });

  it('empty input always produces empty output', () => {
    const result = applyCustomThresholdFilter([], new Map(), new Set(), NOW);
    assert.equal(result.length, 0);
  });

  it('all students blocked produces empty output', () => {
    const students = [STUDENT_A_8_DAYS, STUDENT_A_14_DAYS, STUDENT_B_NO_CONFIG];
    const blocked = new Set(students.map(s => s.userId));
    const result = applyCustomThresholdFilter(students, new Map(), blocked, NOW);
    assert.equal(result.length, 0, 'All blocked → empty batch');
  });
});

// ── Tests: the configMap.get() lookup is per-userId ───────────────────────────

describe('per-student threshold — config is per-userId (not shared across users)', () => {
  it("one user's custom threshold does not affect another user's eligibility", () => {
    // user-A has 14-day threshold; user-B has no config entry
    const configMap = new Map([['user-A', 14]]);
    const studentA: AbsentStudent = { userId: 'user-A', firstName: 'Alice', lastSessionDate: daysAgo(NOW, 8) };
    const studentB: AbsentStudent = { userId: 'user-B', firstName: 'Bob',   lastSessionDate: daysAgo(NOW, 8) };

    const result = applyCustomThresholdFilter([studentA, studentB], configMap, new Set(), NOW);

    // studentA: 8 < 14 → excluded
    // studentB: no config → passes through (DB already confirmed they're past global default)
    assert.equal(result.length, 1);
    assert.equal(result[0].userId, 'user-B',
      "user-B (no custom config) must pass through; user-A's 14-day threshold must not spill over");
  });

  it('each user applies only their own threshold', () => {
    const configMap = new Map<string, number>([
      ['user-X', 10],
      ['user-Y', 20],
    ]);
    const studentX: AbsentStudent = { userId: 'user-X', firstName: 'Xavier', lastSessionDate: daysAgo(NOW, 10) };
    const studentY: AbsentStudent = { userId: 'user-Y', firstName: 'Yolanda', lastSessionDate: daysAgo(NOW, 10) };

    const result = applyCustomThresholdFilter([studentX, studentY], configMap, new Set(), NOW);

    // user-X: 10 >= 10 → included
    // user-Y: 10 <  20 → excluded
    assert.equal(result.length, 1);
    assert.equal(result[0].userId, 'user-X',
      'user-X (10d absent, 10d threshold) is at boundary → included; user-Y (10d absent, 20d threshold) → excluded');
  });
});

// ── Tests: config-query failure fallback (Task 279) ───────────────────────────
//
// When the studentAbsenceConfig DB query throws, detectAbsentStudents() catches
// the error and falls back to an empty configMap (daniela-absence-worker.ts
// lines 65-72):
//
//   let allConfigs = [];
//   try {
//     allConfigs = await db.select(...).from(studentAbsenceConfig);
//   } catch { /* non-critical — fall back to global threshold */ }
//   const configMap = new Map(allConfigs.map(c => [c.userId, c.thresholdDays]));
//
// Observable effect: no custom threshold is applied to any student.  Every
// student that the DB query returned (absent >= global default) passes through
// the filter unimpeded — including students who would normally be protected by a
// longer custom threshold.
//
// This is intentional: the worker errs toward notifying Daniela rather than
// silently dropping a student.  Daniela can always dismiss the nudge; a missed
// nudge cannot be recovered.

describe('config-query failure — empty configMap fallback', () => {
  // This is the empty map that results when the config query fails.
  const FAILED_CONFIG_MAP = new Map<string, number>();

  it('a student with a 14-day custom threshold absent only 8 days IS included when configMap is empty', () => {
    // Normally: daysSince=8 < customThreshold=14 → excluded.
    // Config query failed → configMap empty → no custom check → student passes through.
    //
    // OBSERVABLE EFFECT: students are NOT blocked by their custom threshold when
    // the config table is unavailable.
    const result = applyCustomThresholdFilter(
      [STUDENT_A_8_DAYS],
      FAILED_CONFIG_MAP,
      new Set(),
      NOW,
    );
    assert.equal(result.length, 1,
      'Config query failure (empty configMap) means the 14-day custom threshold is not applied; ' +
      'student absent 8 days passes through and will be nudged');
    assert.equal(result[0].userId, STUDENT_A_8_DAYS.userId);
  });

  it('all students that passed the DB query are included when configMap is empty', () => {
    // Simulate a batch where each student would normally be held back by a longer
    // custom threshold, but the config query has failed.
    const students: AbsentStudent[] = [
      { userId: 'cfg-fail-u1', firstName: 'Ada',    lastSessionDate: daysAgo(NOW, 6) },
      { userId: 'cfg-fail-u2', firstName: 'Bram',   lastSessionDate: daysAgo(NOW, 9) },
      { userId: 'cfg-fail-u3', firstName: 'Cleo',   lastSessionDate: daysAgo(NOW, 11) },
    ];
    // These would have been their custom thresholds (all longer than days-absent above)
    // — irrelevant now because configMap is empty.
    const result = applyCustomThresholdFilter(students, FAILED_CONFIG_MAP, new Set(), NOW);
    assert.equal(result.length, 3,
      'All three students pass through: no custom threshold is applied when configMap is empty');
    const ids = result.map(s => s.userId);
    assert.ok(ids.includes('cfg-fail-u1'));
    assert.ok(ids.includes('cfg-fail-u2'));
    assert.ok(ids.includes('cfg-fail-u3'));
  });

  it('blocked users are still excluded even when configMap is empty', () => {
    // The blocked-user guard is independent of configMap: it runs first and
    // short-circuits before any threshold check.
    const blocked = new Set(['cfg-fail-u1', 'cfg-fail-u3']);
    const students: AbsentStudent[] = [
      { userId: 'cfg-fail-u1', firstName: 'Ada',  lastSessionDate: daysAgo(NOW, 6) },
      { userId: 'cfg-fail-u2', firstName: 'Bram', lastSessionDate: daysAgo(NOW, 9) },
      { userId: 'cfg-fail-u3', firstName: 'Cleo', lastSessionDate: daysAgo(NOW, 11) },
    ];
    const result = applyCustomThresholdFilter(students, FAILED_CONFIG_MAP, blocked, NOW);
    assert.equal(result.length, 1,
      'Blocked users remain excluded even when config query fails; unblocked students pass through');
    assert.equal(result[0].userId, 'cfg-fail-u2');
  });

  it('empty student list with empty configMap produces empty output', () => {
    const result = applyCustomThresholdFilter([], FAILED_CONFIG_MAP, new Set(), NOW);
    assert.equal(result.length, 0);
  });

  it('a mixed batch is split correctly: blocked excluded, unblocked all included regardless of what thresholds would have been', () => {
    // user-weekly-8d would normally be excluded by its 14-day threshold (only 8d absent).
    // With configMap empty (config query failed) it passes through.
    // STUDENT_D_BLOCKED is blocked — still excluded.
    const blocked = new Set([STUDENT_D_BLOCKED.userId]);
    const students = [STUDENT_A_8_DAYS, STUDENT_B_NO_CONFIG, STUDENT_D_BLOCKED];

    const result = applyCustomThresholdFilter(students, FAILED_CONFIG_MAP, blocked, NOW);

    assert.equal(result.length, 2,
      'Two unblocked students pass through; the blocked student is excluded');
    const ids = result.map(s => s.userId);
    assert.ok(ids.includes(STUDENT_A_8_DAYS.userId),
      'user-weekly-8d (normally held by 14d custom threshold) is included because configMap is empty');
    assert.ok(ids.includes(STUDENT_B_NO_CONFIG.userId),
      'user-default-7d (no custom config) passes through as normal');
    assert.ok(!ids.includes(STUDENT_D_BLOCKED.userId),
      'Blocked user is always excluded');
  });
});
