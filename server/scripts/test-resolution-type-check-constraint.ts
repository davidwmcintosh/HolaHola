/**
 * test-resolution-type-check-constraint.ts
 *
 * Confirms that the DB-level CHECK constraint on
 * daniela_absence_nudges.resolution_type actually fires when an invalid value
 * is inserted or updated — and that valid values (and NULL) are accepted.
 *
 * WHY this test exists:
 *   The constraint lives in migrations/0014_absence_nudge_resolution_type_check.sql.
 *   Without an automated test the constraint could be silently dropped or
 *   weakened by a future migration (e.g. ALTER TABLE … DROP CONSTRAINT …).
 *   This script exercises the real database, not a mocked ORM layer.
 *
 * WHAT is tested:
 *   PART 1 — Typo 'studenr_returned' → DB raises constraint-violation (23514)
 *   PART 2 — Valid value 'student_returned' is accepted, row inserted
 *   PART 3 — Valid value 'message_queued' is accepted
 *   PART 4 — Valid value 'dismissed' is accepted
 *   PART 5 — NULL is accepted (resolution_type is nullable until Daniela acts)
 *   PART 6 — Another arbitrary typo 'resolved' is rejected
 *   PART 7 (UPDATE path) — INSERT NULL row, then UPDATE with invalid type → rejected (23514)
 *   PART 8 (UPDATE path) — UPDATE to valid 'student_returned' succeeds
 *   PART 9 (UPDATE path) — UPDATE to valid 'message_queued' succeeds
 *   PART 10 (UPDATE path) — UPDATE to valid 'dismissed' succeeds
 *
 * Run: npx tsx server/scripts/test-resolution-type-check-constraint.ts
 */

import { neon } from '@neondatabase/serverless';

// ── Colour helpers ────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ── Test accounting ───────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function pass(name: string, detail?: string) {
  passed++;
  console.log(`  ${G('✓')} ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name: string, detail: string) {
  failed++;
  console.error(`  ${R('✗')} ${name}`);
  console.error(`    ${detail}`);
}

// ── DB connection ─────────────────────────────────────────────────────────────
// Uses the neon HTTP client (same DATABASE_URL used by the server).
// We intentionally bypass the Drizzle ORM layer so the raw DB constraint fires.
const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
if (!DATABASE_URL) {
  console.error(R('[FATAL] NEON_SHARED_DATABASE_URL is not set — cannot run DB constraint test'));
  process.exit(1);
}
const sql = neon(DATABASE_URL);

// ── Probe user ────────────────────────────────────────────────────────────────
// We need a userId that satisfies any FK-style expectations (the column is varchar,
// no FK constraint), so any non-empty string works.
const TEST_USER_ID = 'test-constraint-probe-user-220';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Attempt to insert a row with the given resolution_type.
 * Returns the PostgreSQL error code string (e.g. '23514') on failure,
 * or null on success.
 */
async function tryInsert(resolutionType: string | null): Promise<{ ok: boolean; code?: string; id?: string }> {
  try {
    const rows = await sql`
      INSERT INTO daniela_absence_nudges (user_id, resolution_type)
      VALUES (${TEST_USER_ID}, ${resolutionType})
      RETURNING id
    `;
    return { ok: true, id: (rows[0] as any)?.id };
  } catch (err: any) {
    // PostgreSQL error codes:
    //   23514 = check_violation
    //   23503 = foreign_key_violation
    const code: string | undefined = err?.code ?? err?.cause?.code;
    return { ok: false, code };
  }
}

/**
 * Attempt to UPDATE resolution_type on an existing row identified by id.
 * Returns { ok: true } on success, or { ok: false, code } on constraint failure.
 */
async function tryUpdate(id: string, resolutionType: string | null): Promise<{ ok: boolean; code?: string }> {
  try {
    await sql`
      UPDATE daniela_absence_nudges
      SET resolution_type = ${resolutionType}
      WHERE id = ${id}
    `;
    return { ok: true };
  } catch (err: any) {
    const code: string | undefined = err?.code ?? err?.cause?.code;
    return { ok: false, code };
  }
}

/**
 * Delete all test rows inserted by this script (clean up after ourselves).
 */
async function cleanUp() {
  try {
    await sql`DELETE FROM daniela_absence_nudges WHERE user_id = ${TEST_USER_ID}`;
  } catch (err: any) {
    console.warn(`  [cleanup warn] ${err.message}`);
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function runTests() {
  console.log(B('\n╔══════════════════════════════════════════════════════════════════════╗'));
  console.log(B('║  Task 220 — resolution_type CHECK constraint (DB level)              ║'));
  console.log(B('╚══════════════════════════════════════════════════════════════════════╝'));

  // ── PART 1: typo 'studenr_returned' must be rejected ─────────────────────
  sep();
  console.log(B('PART 1 — Invalid value "studenr_returned" is rejected by the constraint'));
  {
    const result = await tryInsert('studenr_returned');
    if (!result.ok && result.code === '23514') {
      pass(
        'INSERT with resolution_type="studenr_returned" raises check_violation (23514)',
        `pg code=${result.code}`,
      );
    } else if (!result.ok) {
      fail(
        'INSERT with "studenr_returned" was rejected but with wrong error code',
        `expected code=23514, got code=${result.code ?? 'unknown'}`,
      );
    } else {
      fail(
        'INSERT with "studenr_returned" should have been rejected',
        'Row was inserted — constraint is NOT firing!',
      );
    }
  }

  // ── PART 2: 'student_returned' must be accepted ───────────────────────────
  sep();
  console.log(B('PART 2 — Valid value "student_returned" is accepted'));
  {
    const result = await tryInsert('student_returned');
    if (result.ok) {
      pass('INSERT with resolution_type="student_returned" succeeds', `id=${result.id}`);
    } else {
      fail(
        'INSERT with "student_returned" should have succeeded',
        `Error code=${result.code ?? 'unknown'}`,
      );
    }
  }

  // ── PART 3: 'message_queued' must be accepted ─────────────────────────────
  sep();
  console.log(B('PART 3 — Valid value "message_queued" is accepted'));
  {
    const result = await tryInsert('message_queued');
    if (result.ok) {
      pass('INSERT with resolution_type="message_queued" succeeds', `id=${result.id}`);
    } else {
      fail(
        'INSERT with "message_queued" should have succeeded',
        `Error code=${result.code ?? 'unknown'}`,
      );
    }
  }

  // ── PART 4: 'dismissed' must be accepted ──────────────────────────────────
  sep();
  console.log(B('PART 4 — Valid value "dismissed" is accepted'));
  {
    const result = await tryInsert('dismissed');
    if (result.ok) {
      pass('INSERT with resolution_type="dismissed" succeeds', `id=${result.id}`);
    } else {
      fail(
        'INSERT with "dismissed" should have succeeded',
        `Error code=${result.code ?? 'unknown'}`,
      );
    }
  }

  // ── PART 5: NULL must be accepted (unresolved nudge) ─────────────────────
  sep();
  console.log(B('PART 5 — NULL is accepted (nullable until Daniela acts)'));
  {
    const result = await tryInsert(null);
    if (result.ok) {
      pass('INSERT with resolution_type=NULL succeeds', `id=${result.id}`);
    } else {
      fail(
        'INSERT with NULL should have succeeded',
        `Error code=${result.code ?? 'unknown'}`,
      );
    }
  }

  // ── PART 6: arbitrary typo 'resolved' must be rejected ───────────────────
  sep();
  console.log(B('PART 6 — Arbitrary invalid value "resolved" is rejected'));
  {
    const result = await tryInsert('resolved');
    if (!result.ok && result.code === '23514') {
      pass(
        'INSERT with resolution_type="resolved" raises check_violation (23514)',
        `pg code=${result.code}`,
      );
    } else if (!result.ok) {
      fail(
        'INSERT with "resolved" was rejected but with wrong error code',
        `expected code=23514, got code=${result.code ?? 'unknown'}`,
      );
    } else {
      fail(
        'INSERT with "resolved" should have been rejected',
        'Row was inserted — constraint is NOT firing!',
      );
    }
  }

  // ── UPDATE PATH TESTS ─────────────────────────────────────────────────────
  // These confirm that the CHECK constraint fires on UPDATE, not just INSERT.
  // The production write path (resolveAbsenceNudge) uses UPDATE, never INSERT.

  // Insert a base row with NULL resolution_type for the UPDATE tests.
  sep();
  console.log(B('PART 7 — UPDATE path: invalid value "studenr_returned" is rejected (23514)'));
  {
    const inserted = await tryInsert(null);
    if (!inserted.ok || !inserted.id) {
      fail('PART 7 setup: INSERT NULL row for UPDATE test', `code=${inserted.code}`);
    } else {
      const updateResult = await tryUpdate(inserted.id, 'studenr_returned');
      if (!updateResult.ok && updateResult.code === '23514') {
        pass(
          'UPDATE with resolution_type="studenr_returned" raises check_violation (23514)',
          `pg code=${updateResult.code}`,
        );
      } else if (!updateResult.ok) {
        fail(
          'UPDATE with "studenr_returned" was rejected but with wrong error code',
          `expected code=23514, got code=${updateResult.code ?? 'unknown'}`,
        );
      } else {
        fail(
          'UPDATE with "studenr_returned" should have been rejected',
          'Row was updated — constraint is NOT firing on UPDATE!',
        );
      }
    }
  }

  sep();
  console.log(B('PART 8 — UPDATE path: valid value "student_returned" is accepted'));
  {
    const inserted = await tryInsert(null);
    if (!inserted.ok || !inserted.id) {
      fail('PART 8 setup: INSERT NULL row for UPDATE test', `code=${inserted.code}`);
    } else {
      const updateResult = await tryUpdate(inserted.id, 'student_returned');
      if (updateResult.ok) {
        pass('UPDATE with resolution_type="student_returned" succeeds');
      } else {
        fail(
          'UPDATE with "student_returned" should have succeeded',
          `Error code=${updateResult.code ?? 'unknown'}`,
        );
      }
    }
  }

  sep();
  console.log(B('PART 9 — UPDATE path: valid value "message_queued" is accepted'));
  {
    const inserted = await tryInsert(null);
    if (!inserted.ok || !inserted.id) {
      fail('PART 9 setup: INSERT NULL row for UPDATE test', `code=${inserted.code}`);
    } else {
      const updateResult = await tryUpdate(inserted.id, 'message_queued');
      if (updateResult.ok) {
        pass('UPDATE with resolution_type="message_queued" succeeds');
      } else {
        fail(
          'UPDATE with "message_queued" should have succeeded',
          `Error code=${updateResult.code ?? 'unknown'}`,
        );
      }
    }
  }

  sep();
  console.log(B('PART 10 — UPDATE path: valid value "dismissed" is accepted'));
  {
    const inserted = await tryInsert(null);
    if (!inserted.ok || !inserted.id) {
      fail('PART 10 setup: INSERT NULL row for UPDATE test', `code=${inserted.code}`);
    } else {
      const updateResult = await tryUpdate(inserted.id, 'dismissed');
      if (updateResult.ok) {
        pass('UPDATE with resolution_type="dismissed" succeeds');
      } else {
        fail(
          'UPDATE with "dismissed" should have succeeded',
          `Error code=${updateResult.code ?? 'unknown'}`,
        );
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  sep();
  await cleanUp();

  console.log(`\n${B('Results:')} ${G(`${passed} passed`)}, ${failed > 0 ? R(`${failed} failed`) : `${failed} failed`}\n`);

  if (failed > 0) {
    console.error(R('FAIL — resolution_type CHECK constraint is not working as expected.'));
    process.exit(1);
  } else {
    console.log(G('PASS — resolution_type CHECK constraint is enforced at the DB level.'));
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error(R(`[FATAL] Unexpected error: ${err.message}`));
  process.exit(1);
});
