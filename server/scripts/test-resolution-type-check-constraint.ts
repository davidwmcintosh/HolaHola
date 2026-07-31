/**
 * test-resolution-type-check-constraint.ts
 *
 * Confirms that the DB-level CHECK constraint on
 * daniela_absence_nudges.resolution_type actually fires when an invalid value
 * is inserted — and that valid values (and NULL) are accepted.
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
