/**
 * test-episode-lifecycle-create-dedup.ts
 *
 * CI self-check: createEpisode() (server/services/episode-lifecycle-service.ts)
 * reuses an existing row instead of inserting a duplicate when it is called
 * twice with the same title.
 *
 * The primary defense is a single app-level guard inside createEpisode():
 *
 *   const existing = await db.select(...).where(and(
 *     eq(conversationMemories.entryType, "episode"),
 *     eq(conversationMemories.arcName, HOLAHOLA_EPISODES_ARC),
 *     eq(conversationMemories.title, title),
 *   ));
 *   if (existing.length > 0) return { ok: true, created: false, episode: existing[0] };
 *
 * This is reachable both from Alden's start_next_episode tool (LLM-operated,
 * conversational) and, via startNextEpisode(), indirectly from
 * server/scripts/set-rolling-episode.ts (human-operated CLI).
 *
 * A database-level backstop also exists: idx_episode_title_arc_unique, a
 * partial unique index on conversation_memories(arc_name, title) WHERE
 * entry_type = 'episode'. It is confirmed present in the live database but
 * is NOT declared in shared/schema.ts (undocumented schema drift -- flagged
 * as a separate follow-up). Because of it, removing the app-level guard
 * today no longer produces a SILENT duplicate row; Postgres rejects the
 * second insert outright. That is still a real regression, just a louder
 * one: a caller (Alden's start_next_episode tool, or the
 * set-rolling-episode.ts CLI) would get a thrown duplicate-key error instead
 * of the graceful "already exists, reusing it" response the guard is
 * supposed to provide. This test is written to catch the guard's removal
 * either way it could fail -- silently (if the DB index is ever also
 * dropped) or loudly (as it does today).
 *
 * Checks:
 *   1. The first createEpisode() call with a disposable test title inserts a
 *      new row (created: true).
 *   2. The second createEpisode() call with the SAME title does not throw.
 *      This is the check that fails TODAY if the app-level guard is
 *      removed: the DB-level unique index rejects the raw second insert
 *      with a duplicate-key error.
 *   3. If (and only if) the second call did not throw: it reports
 *      created: false (reused the existing row, not duplicated) and returns
 *      the IDENTICAL id as the first call. This is the check that would fail
 *      if the app-level guard were removed AND the DB-level unique index
 *      were also absent -- the historical "silent duplicate" failure mode
 *      this test was originally written for.
 *   4. Exactly one row with that title exists in conversation_memories after
 *      both calls -- the real invariant a missing guard (with no DB
 *      backstop at all) would violate. This passes in both failure modes
 *      above, because either the app guard or the DB index kept the row
 *      count at one.
 *   5. The surviving row's original summary is unchanged (the second call
 *      deliberately passes a different summary/content/importance) --
 *      proving "reuse", not "overwrite" (createEpisode is documented in its
 *      module header as never destructive, unlike the allowDuplicate:true
 *      path on POST /api/conversation-memories).
 *
 * This test deliberately calls ONLY createEpisode() -- never
 * promoteRollingEpisode() or startNextEpisode() -- so it never touches the
 * live 'rolling' tag on production data. It runs against the real shared
 * database (same as server/scripts/test-set-rolling-episode-bad-name.ts),
 * using a title that can never collide with a real episode ("Episode
 * TEST-DEDUP-<timestamp>-<random>" -- real titles are "Episode <N>" or
 * "Episode <N>: <Name>"). It always cleans up (deletes) whatever row it
 * created, in a finally block, so a failed assertion never leaves litter in
 * the real "HolaHola Episodes" arc and this check is safe to run repeatedly.
 *
 * Inverse / guard-removal check:
 *   Commenting out (or otherwise short-circuiting) the
 *   `if (existing.length > 0) { ... }` block in createEpisode() makes this
 *   test FAIL today: the second call's raw insert collides with
 *   idx_episode_title_arc_unique and throws, which check 2 above reports as
 *   an explicit failure (not an uncaught crash -- see the try/catch around
 *   the second call, below). If that DB index is ever also removed in a
 *   future migration, the second call would instead succeed and insert a
 *   real duplicate, which checks 3-4 would catch instead. Either way the
 *   script exits non-zero.
 *
 * Run: npx tsx server/scripts/test-episode-lifecycle-create-dedup.ts
 */

import { and, eq } from 'drizzle-orm';
import { getSharedDb } from '../db';
import { conversationMemories } from '@shared/schema';
import { createEpisode, HOLAHOLA_EPISODES_ARC } from '../services/episode-lifecycle-service';

// Clearly-marked disposable title, unique per run: never collides with a real
// episode title, and a prior crashed run's leftover row (if cleanup somehow
// failed) can never be mistaken for this run's own fixture.
const TEST_TITLE = `Episode TEST-DEDUP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const ORIGINAL_SUMMARY = 'CI dedup guard test fixture — safe to delete.';

const failures: string[] = [];

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}${detail ? `: ${detail}` : ''}`);
    failures.push(detail ? `${label}: ${detail}` : label);
  }
}

async function findTestRows(db: ReturnType<typeof getSharedDb>) {
  return db
    .select({
      id: conversationMemories.id,
      title: conversationMemories.title,
      summary: conversationMemories.summary,
    })
    .from(conversationMemories)
    .where(
      and(
        eq(conversationMemories.entryType, 'episode' as any),
        eq(conversationMemories.arcName, HOLAHOLA_EPISODES_ARC),
        eq(conversationMemories.title, TEST_TITLE),
      ),
    );
}

async function main() {
  console.log('\n=== createEpisode() reuse-not-duplicate guard test ===\n');
  console.log(`  Test title: ${TEST_TITLE}\n`);

  const db = getSharedDb();

  // Defensive pre-cleanup: a prior crashed run should never leave a row
  // behind (see the finally block below), but guard against it anyway so
  // this test is safe to re-run without manual intervention.
  const preExisting = await findTestRows(db);
  for (const row of preExisting) {
    await db.delete(conversationMemories).where(eq(conversationMemories.id, row.id));
  }

  try {
    // ── Call 1: expect a fresh insert ──────────────────────────────────────
    const first = await createEpisode({
      title: TEST_TITLE,
      summary: ORIGINAL_SUMMARY,
      content: 'Disposable content created by test-episode-lifecycle-create-dedup.ts.',
      importance: 1,
      tags: ['ci-test-disposable'],
    });

    check('First createEpisode() call succeeds (ok: true)', first.ok === true, first.ok ? undefined : JSON.stringify(first));

    // Everything below needs `first.episode.id` and only makes sense once the
    // fixture actually exists. Guarded with `if (first.ok)` rather than an
    // early `return` -- a `return` here would skip the failure-count/exit-code
    // block after this try/finally entirely, so a failed first call would log
    // a "✗" but still exit 0 (a false-green CI result). Falling through to
    // that shared tail unconditionally is what makes a first-call failure
    // actually fail the script.
    if (first.ok) {
      check('First call reports created: true (fresh insert)', first.created === true, `created=${first.created}`);
      const firstId = first.episode.id;

      // ── Call 2: same title, deliberately DIFFERENT summary/content/importance
      //    — expect reuse, not a second insert and not an overwrite.
      //
      //    Wrapped in its own try/catch: if the app-level reuse guard above is
      //    ever removed, the DB-level idx_episode_title_arc_unique unique
      //    index (see module header) becomes the only remaining defense, and
      //    converts what would otherwise be a silent duplicate row into a
      //    thrown duplicate-key error on this very call. That is still a
      //    regression worth catching (a caller would get an error instead of
      //    a graceful reuse), so it is reported as an explicit check() failure
      //    here rather than left to crash out to the generic fatal handler at
      //    the bottom of this file. ─────────────────────────────────────────
      let second: Awaited<ReturnType<typeof createEpisode>> | undefined;
      try {
        second = await createEpisode({
          title: TEST_TITLE,
          summary: 'A DIFFERENT summary that must NOT overwrite the original.',
          content: 'DIFFERENT content that must NOT overwrite the original.',
          importance: 9,
          tags: ['some-other-tag'],
        });
      } catch (err: any) {
        const cause = err?.cause ?? err;
        check(
          'Second createEpisode() call succeeds without throwing (guard reused the row cleanly)',
          false,
          `threw ${cause?.code ?? 'error'}${cause?.constraint ? ` (constraint: ${cause.constraint})` : ''}: ${cause?.detail ?? err?.message ?? err}`,
        );
      }

      if (second) {
        check('Second createEpisode() call succeeds (ok: true)', second.ok === true, second.ok ? undefined : JSON.stringify(second));
        if (second.ok) {
          check(
            'Second call reports created: false (reused existing row, not duplicated)',
            second.created === false,
            `created=${second.created}`,
          );
          check(
            'Second call returns the SAME id as the first call',
            second.episode.id === firstId,
            `first=${firstId}, second=${second.episode.id}`,
          );
        }
      }

      // ── DB-level invariant: exactly one row with this title ────────────────
      // Meaningful regardless of which branch above ran: whether the app-level
      // guard or the DB-level unique index is what stopped the duplicate, the
      // row count must still be exactly one.
      const rows = await findTestRows(db);
      check(
        'Exactly one row with the test title exists in conversation_memories',
        rows.length === 1,
        `found ${rows.length} row(s): ${JSON.stringify(rows.map((r) => r.id))}`,
      );

      // ── Non-destructive reuse: original summary must be untouched ──────────
      check(
        "Reused row's summary is still the ORIGINAL one (proves reuse, not overwrite)",
        rows[0]?.summary === ORIGINAL_SUMMARY,
        `summary was: ${JSON.stringify(rows[0]?.summary)}`,
      );
    }
  } finally {
    // Always clean up, even on a failed assertion above (check() never
    // throws) or an unexpected exception -- this arc must never accumulate
    // test litter.
    const cleanup = await findTestRows(db);
    for (const row of cleanup) {
      await db.delete(conversationMemories).where(eq(conversationMemories.id, row.id));
    }
    console.log(`\n  (cleaned up ${cleanup.length} test row(s))`);
  }

  console.log(`\n=== Results: ${failures.length} failure(s) ===\n`);
  if (failures.length > 0) {
    for (const f of failures) console.error('  ✗', f);
    console.error(
      '\nHint: if the reuse guard (`if (existing.length > 0)`) was removed or ' +
      'short-circuited from createEpisode() in episode-lifecycle-service.ts, ' +
      'the checks above fail because the second call either throws a ' +
      'duplicate-key error (idx_episode_title_arc_unique) or, if that index ' +
      'is ever also removed, inserts a second row instead of reusing the ' +
      'first.',
    );
    process.exit(1);
  }

  console.log('ALL CHECKS PASSED — createEpisode() correctly reuses an existing row instead of duplicating it.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[test-episode-lifecycle-create-dedup] Fatal error:', err);
  process.exit(1);
});
