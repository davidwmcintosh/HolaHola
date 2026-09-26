/**
 * test-episode-lifecycle-promote-success.ts
 *
 * CI self-check: promoteRollingEpisode() (server/services/episode-lifecycle-service.ts)
 * actually performs the successful 'rolling' tag swap end-to-end against the real
 * database -- not just the not-found/no-op paths already covered by
 * test-set-rolling-episode-bad-name.ts and `set-rolling-episode.ts --self-check`
 * (unrecognised name, and a forced-rollback simulation that never commits).
 * Nothing before this test exercised the actual committed swap: that the target row
 * really gains 'rolling' + 'rolling-protected', that the previously-rolling row(s)
 * really lose 'rolling' while keeping 'rolling-protected', and that the function's
 * return value (previousRolling/alreadyRolling) matches what was actually written.
 *
 * Why this briefly touches the real live rolling episode, and why that's safe here:
 *   promoteRollingEpisode() always strips 'rolling' from EVERY row currently tagged
 *   'rolling' in the "HolaHola Episodes" arc as part of any successful call -- there
 *   is no way to exercise its real committed success path without it touching
 *   whichever row is currently live. .agents/memory/episode-lifecycle-service-guards.md
 *   warns against flipping the live tag during testing "even briefly... even with a
 *   planned restore", because a concurrent real conversation write could target the
 *   disposable row during the flip window and be lost when that row is deleted. This
 *   test accepts that narrow, documented risk deliberately (it is what this task was
 *   written to do) and minimizes it:
 *     - The only work inside the risk window (between the promote call and the
 *       restore call) is ONE tag-state read -- no logging, no other queries, no
 *       assertions. All assertions run afterward against data already captured.
 *     - A try/finally guarantees an emergency restore attempt (with a loud,
 *       actionable manual-recovery command) even if an assertion fails or an
 *       exception is thrown between the two calls.
 *     - After the finally block's restore attempt, an independent ground-truth
 *       read (getCurrentRollingEpisode(), not a return value) confirms the real
 *       episode is back before the script reports success, and fails loudly
 *       (without throwing away already-collected failures) if it is not.
 *     - The disposable fixture row is deleted ONLY after independently confirming
 *       (via getCurrentRollingEpisode() and a direct tag re-read on the fixture
 *       itself -- never a trusted return value) that the original episode is
 *       rolling again and the fixture is not. If that confirmation fails -- the
 *       exact failure shape a real regression in promoteRollingEpisode() would
 *       produce -- the fixture is deliberately LEFT IN PLACE and the script exits
 *       1 with a manual-recovery command, rather than risk deleting whatever row
 *       is currently serving as the arc's live capture target. A future run's
 *       pre-flight orphan sweep (below) only ever touches a leftover fixture that
 *       is NOT tagged 'rolling', so it can never delete a row a failed run
 *       deliberately kept because it might still be live.
 *
 * Checks:
 *   1. Disposable episode is created fresh (a pre-existing collision on the
 *      timestamp+random title would be a bug in the test itself, not the code under
 *      test -- refuse to proceed rather than promote/delete a row this run did not
 *      create).
 *   2. promoteRollingEpisode(disposable) returns ok:true, alreadyRolling:false, the
 *      correct target id/title, and previousRolling exactly matching what was rolling
 *      beforehand.
 *   3. Mid-flip tag state (read once, inside the risk window): the disposable row has
 *      gained BOTH 'rolling' and 'rolling-protected'; every previously-rolling row has
 *      lost 'rolling' but kept/gained 'rolling-protected'.
 *   4. The restore call (promoteRollingEpisode(originalTitle)) returns ok:true,
 *      alreadyRolling:false, the correct original target, and previousRolling
 *      including the disposable title.
 *   5. Post-restore (zero added risk): the disposable row has lost 'rolling' but kept
 *      'rolling-protected' -- corroborating, from a second independent angle, that it
 *      really held 'rolling' beforehand (rolling-protected is only ever added to a row
 *      that currently holds 'rolling').
 *   6. Independent of all the above return values: getCurrentRollingEpisode() reports
 *      the original episode as rolling again before the script exits successfully.
 *
 * Inverse / guard-removal check:
 *   If the target-tagging step (Step B in promoteRollingEpisode) stopped adding
 *   'rolling' or 'rolling-protected', check 2/3 fail. If the demote step (Step A/A0)
 *   stopped stripping 'rolling' from the previous row(s) or stopped protecting them,
 *   check 3 fails. If previousRolling were computed from the wrong query (e.g. after
 *   the demote instead of before), check 2's previousRolling assertion fails. Wiring
 *   any of the return fields to the wrong row would fail the id/title assertions in
 *   checks 2 and 4.
 *
 * Safe to run repeatedly against the shared database in the normal (passing) case:
 * the only lasting effect on the real arc is that the original rolling episode gains
 * 'rolling-protected' if it did not already have it (a true, harmless fact -- it just
 * held 'rolling' -- and it would gain that tag on its next real promotion anyway); the
 * disposable fixture is deleted ONLY once independently confirmed safe to remove (see
 * above). This does not eliminate the underlying risk that a concurrent real write
 * could land on the disposable row during the brief flip window -- see the "why this
 * briefly touches..." note above -- but it does mean a regression in the code under
 * test fails loudly with the fixture preserved for inspection, never a silent deletion
 * of whatever row is currently live. See server/scripts/test-episode-lifecycle-create-dedup.ts
 * for the disposable-title/cleanup pattern this test follows for its non-live-tag portions.
 *
 * Run: npx tsx server/scripts/test-episode-lifecycle-promote-success.ts
 */

import { eq, sql } from 'drizzle-orm';
import { getSharedDb } from '../db';
import { conversationMemories } from '@shared/schema';
import {
  createEpisode,
  promoteRollingEpisode,
  getCurrentRollingEpisode,
  HOLAHOLA_EPISODES_ARC,
  type PromoteRollingEpisodeResult,
} from '../services/episode-lifecycle-service';

type Db = ReturnType<typeof getSharedDb>;
type RollingRow = { id: string; title: string; tags: string[] };

// Clearly-marked disposable title, unique per run -- can never collide with a real
// episode title ("Episode <N>" or "Episode <N>: <Name>"), and a prior crashed run's
// leftover row (if the finally block somehow failed) can never be mistaken for this
// run's own fixture. Mirrors test-episode-lifecycle-create-dedup.ts's TEST_TITLE.
const TEST_TITLE = `Episode TEST-PROMOTE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const ORIGINAL_SUMMARY = 'CI promote-success guard test fixture — safe to delete.';

const failures: string[] = [];

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}${detail ? `: ${detail}` : ''}`);
    failures.push(detail ? `${label}: ${detail}` : label);
  }
}

async function queryRollingRows(db: Db): Promise<RollingRow[]> {
  const res = await db.execute(sql`
    SELECT id, title, tags
    FROM conversation_memories
    WHERE arc_name = ${HOLAHOLA_EPISODES_ARC}
      AND 'rolling' = ANY(tags)
    ORDER BY created_at DESC
  `);
  return res.rows as unknown as RollingRow[];
}

// Drizzle's sql tag binds a raw JS array as a row/record literal, not a
// Postgres array literal -- `ANY(${ids}::text[])` fails with "cannot cast
// type record to text[]". Build the array literal as a string instead (see
// .agents/memory/js-ts-drizzle-runtime-gotchas.md, "Drizzle sql tag cannot
// bind a raw array for ::text[]").
function pgTextArrayLiteral(values: string[]): string {
  return `{${values.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(',')}}`;
}

/** One combined lookup so the risk window only needs a single round trip. */
async function queryTagsByIds(db: Db, ids: string[]): Promise<Map<string, string[]>> {
  if (ids.length === 0) return new Map();
  const res = await db.execute(sql`
    SELECT id, tags FROM conversation_memories WHERE id = ANY(${pgTextArrayLiteral(ids)}::text[])
  `);
  const rows = res.rows as unknown as Array<{ id: string; tags: string[] | null }>;
  return new Map(rows.map((r) => [r.id, r.tags ?? []]));
}

async function main() {
  console.log('\n=== promoteRollingEpisode() success-path guard test ===\n');
  console.log(`  Test title: ${TEST_TITLE}\n`);
  console.log(
    "  This test briefly promotes a disposable episode to 'rolling' on the REAL\n" +
    '  shared database, then immediately restores the original rolling episode.\n' +
    '  See .agents/memory/episode-lifecycle-service-guards.md for the accepted risk\n' +
    '  and why the flip/restore pair is kept back-to-back with nothing else between.\n',
  );

  const db = getSharedDb();

  // Defensive self-heal: a previous run of THIS test that crashed before reaching
  // its own finally block could leave an orphaned "Episode TEST-PROMOTE-*" row
  // behind without a 'rolling' tag. Left alone, such a row is newer than the real
  // rolling episode but lacks 'rolling' -- exactly the shape
  // detectRollingTagMisroute() treats as a misroute, which would block live
  // capture routing on the next server restart. Never touches a row that
  // currently holds 'rolling' -- that could never be an orphan from this test.
  const orphans = await db.execute(sql`
    SELECT id, title FROM conversation_memories
    WHERE arc_name = ${HOLAHOLA_EPISODES_ARC}
      AND title LIKE 'Episode TEST-PROMOTE-%'
      AND NOT ('rolling' = ANY(tags))
  `);
  const orphanRows = orphans.rows as unknown as Array<{ id: string; title: string }>;
  for (const row of orphanRows) {
    console.warn(`  (sweeping orphaned fixture from a previous run: "${row.title}")`);
    await db.delete(conversationMemories).where(eq(conversationMemories.id, row.id));
  }

  // ── Capture the pre-test rolling state -- this is what gets restored ──────────
  const beforeRows = await queryRollingRows(db);

  if (beforeRows.length === 0) {
    // On the live shared DB there should always be exactly one row tagged
    // 'rolling' -- every consumer of that tag (capture routing, autosave,
    // detectRollingTagMisroute()) depends on that invariant holding. Treating
    // "nobody is currently rolling" as a silent pass would let this guard
    // report green forever without ever exercising the success path it exists
    // to protect, and would hide a real invariant violation behind a check
    // that looks like it still ran. Fail loudly instead.
    const msg =
      "No episode currently holds the 'rolling' tag -- refusing to silently skip. " +
      'This violates the invariant that exactly one "HolaHola Episodes" row is always ' +
      "rolling, and there is no known-good row to restore to after exercising the " +
      'success path. Fix the rolling episode first, e.g.: ' +
      'npx tsx server/scripts/set-rolling-episode.ts --episode "<correct episode title>"';
    console.error(`\n🚨 [promote-success] ${msg}\n`);
    process.exit(1);
  }

  const originalTitle = beforeRows[0].title;
  console.log(`  Current rolling episode: "${originalTitle}" (${beforeRows.length} row(s) tagged 'rolling')\n`);

  // ── Create the disposable promotion target ─────────────────────────────────────
  const created = await createEpisode({
    title: TEST_TITLE,
    summary: ORIGINAL_SUMMARY,
    content: 'Disposable content created by test-episode-lifecycle-promote-success.ts.',
    importance: 1,
    tags: ['ci-test-disposable'],
  });

  if (!created.ok || !created.created) {
    // A pre-existing row with this exact timestamp+random title would mean an
    // astronomically unlikely collision -- refuse to proceed rather than
    // promote/delete a row this run did not create.
    check('Disposable episode created fresh (ok:true, created:true)', false, JSON.stringify(created));
    console.error(`\n=== Results: ${failures.length} failure(s) ===\n`);
    process.exit(1);
  }
  check('Disposable episode created fresh (ok:true, created:true)', true);
  const disposableId = created.episode.id;

  let restoreConfirmed = false;

  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // RISK WINDOW -- from here until the restore call resolves, the REAL rolling
    // episode is NOT tagged 'rolling'; the disposable fixture is. Nothing except
    // these three awaited calls runs inside this window: no logging, no extra
    // queries beyond the one needed to observe the promoted tag state, and no
    // assertions (all assertions below run afterward, against data already
    // captured here).
    // ═══════════════════════════════════════════════════════════════════════════
    const promoted: PromoteRollingEpisodeResult = await promoteRollingEpisode(TEST_TITLE);
    const midTags = await queryTagsByIds(db, [disposableId, ...beforeRows.map((r) => r.id)]);
    const restored: PromoteRollingEpisodeResult = await promoteRollingEpisode(originalTitle);
    // ═══════════════════════════════════════════════════════════════════════ END

    restoreConfirmed = restored.ok && restored.target.id === beforeRows[0].id;

    // ── Assertions on the promote call ─────────────────────────────────────────
    check('promoteRollingEpisode(disposable) succeeds (ok:true)', promoted.ok === true, promoted.ok ? undefined : JSON.stringify(promoted));
    if (promoted.ok) {
      check('alreadyRolling is false for a fresh disposable target', promoted.alreadyRolling === false, `alreadyRolling=${promoted.alreadyRolling}`);
      check('target.id matches the disposable episode', promoted.target.id === disposableId, `target.id=${promoted.target.id}, expected=${disposableId}`);
      check('target.title matches the disposable title', promoted.target.title === TEST_TITLE, `target.title=${promoted.target.title}`);

      const expectedPrevious = beforeRows.map((r) => r.title).slice().sort();
      const actualPrevious = promoted.previousRolling.slice().sort();
      check(
        'previousRolling reports exactly the row(s) that were rolling before this call',
        JSON.stringify(actualPrevious) === JSON.stringify(expectedPrevious),
        `previousRolling=${JSON.stringify(actualPrevious)}, expected=${JSON.stringify(expectedPrevious)}`,
      );
    }

    // ── Assertions on the mid-flip tag state (captured inside the window) ─────
    const targetTags = midTags.get(disposableId) ?? [];
    check("Target row gained the 'rolling' tag while promoted", targetTags.includes('rolling'), `tags=${JSON.stringify(targetTags)}`);
    check("Target row gained the 'rolling-protected' tag while promoted", targetTags.includes('rolling-protected'), `tags=${JSON.stringify(targetTags)}`);

    for (const row of beforeRows) {
      const tags = midTags.get(row.id) ?? [];
      check(`Previously-rolling row "${row.title}" lost the 'rolling' tag`, !tags.includes('rolling'), `tags=${JSON.stringify(tags)}`);
      check(`Previously-rolling row "${row.title}" kept/gained the 'rolling-protected' tag`, tags.includes('rolling-protected'), `tags=${JSON.stringify(tags)}`);
    }

    // ── Assertions on the restore call ─────────────────────────────────────────
    check('Restore call succeeds (ok:true)', restored.ok === true, restored.ok ? undefined : JSON.stringify(restored));
    if (restored.ok) {
      check('Restore alreadyRolling is false', restored.alreadyRolling === false, `alreadyRolling=${restored.alreadyRolling}`);
      check('Restore target is the original rolling episode', restored.target.id === beforeRows[0].id, `target.id=${restored.target.id}, expected=${beforeRows[0].id}`);
      check('Restore previousRolling includes the disposable title', restored.previousRolling.includes(TEST_TITLE), `previousRolling=${JSON.stringify(restored.previousRolling)}`);
    }

    // ── Post-restore corroboration (zero added risk -- window already closed) ──
    // rolling-protected is only ever added to a row that currently holds
    // 'rolling' (Step A0), so its presence here -- after the restore call
    // demoted the disposable row -- is a second, independent line of evidence
    // that the promote call really did set 'rolling' on it earlier.
    const afterTags = await queryTagsByIds(db, [disposableId]);
    const disposableFinalTags = afterTags.get(disposableId) ?? [];
    check(
      "Disposable row lost 'rolling' after being demoted by the restore call",
      !disposableFinalTags.includes('rolling'),
      `tags=${JSON.stringify(disposableFinalTags)}`,
    );
    check(
      "Disposable row gained 'rolling-protected' when demoted -- corroborates it held 'rolling' beforehand",
      disposableFinalTags.includes('rolling-protected'),
      `tags=${JSON.stringify(disposableFinalTags)}`,
    );
  } finally {
    // Safety net: if the restore call above did not run, or ran but didn't land
    // on the expected row (e.g. an exception was thrown between the promote and
    // restore calls, or the connection dropped mid-window), attempt an
    // emergency restore now rather than leaving the disposable row as the live
    // rolling episode.
    if (!restoreConfirmed) {
      console.warn('  ⚠ restore did not confirm in the primary path -- attempting emergency restore now');
      try {
        const emergency = await promoteRollingEpisode(originalTitle);
        restoreConfirmed = emergency.ok && emergency.target.id === beforeRows[0].id;
      } catch (emergencyErr: any) {
        console.error('  ⚠ emergency restore threw:', emergencyErr?.message ?? emergencyErr);
      }
    }

    // Final ground-truth check, independent of any return value above: read back
    // which row is ACTUALLY tagged 'rolling' right now, AND whether the
    // disposable fixture itself still holds 'rolling'. A return value only
    // proves what the function *reported*; only a fresh read proves what is
    // actually committed.
    const finalRolling = await getCurrentRollingEpisode();
    const disposableTagsAfter = (await queryTagsByIds(db, [disposableId])).get(disposableId) ?? [];
    const disposableStillRolling = disposableTagsAfter.includes('rolling');
    const originalConfirmedRolling = finalRolling?.id === beforeRows[0].id;

    if (!originalConfirmedRolling || disposableStillRolling) {
      // Do NOT delete the fixture here. If restoration can't be independently
      // confirmed, the fixture may be the only row currently tagged 'rolling' --
      // deleting it would destroy the arc's live capture target and any writes
      // that landed on it. Leaving it in place costs nothing but a manual
      // cleanup step; deleting it here could cost production data.
      const msg =
        'CRITICAL: the real rolling episode was NOT confirmed restored -- refusing to ' +
        `delete the disposable fixture. Currently rolling: ${finalRolling ? `"${finalRolling.title}" (${finalRolling.id})` : 'none'}. ` +
        `Expected: "${originalTitle}" (${beforeRows[0].id}). Disposable fixture "${TEST_TITLE}" ` +
        `(${disposableId}) still tagged 'rolling': ${disposableStillRolling}. The fixture has been ` +
        'LEFT IN PLACE (not deleted) so no live data is lost while this is unresolved. Manual ' +
        `recovery: npx tsx server/scripts/set-rolling-episode.ts --episode ${JSON.stringify(originalTitle)} ` +
        `-- then verify "${TEST_TITLE}" (${disposableId}) is safe to delete before removing it.`;
      failures.push(msg);
      console.error(`\n🚨 ${msg}\n`);
    } else {
      console.log(`  (confirmed original rolling episode "${originalTitle}" is restored; disposable fixture is safe to delete)`);
      // Only delete the disposable fixture once restoration is independently
      // confirmed on both fronts above.
      try {
        await db.delete(conversationMemories).where(eq(conversationMemories.id, disposableId));
        console.log(`  (cleaned up disposable test episode "${TEST_TITLE}")`);
      } catch (cleanupErr: any) {
        const msg = `Cleanup failed to delete disposable fixture ${disposableId} ("${TEST_TITLE}") -- manual deletion needed: ${cleanupErr?.message ?? cleanupErr}`;
        console.error(`  ⚠ ${msg}`);
        failures.push(msg);
      }
    }
  }

  console.log(`\n=== Results: ${failures.length} failure(s) ===\n`);
  if (failures.length > 0) {
    for (const f of failures) console.error('  ✗', f);
    console.error(
      "\nHint: if promoteRollingEpisode() no longer correctly swaps the 'rolling' tag " +
      "(wrong target row, missing 'rolling-protected' tag, or a demoted row not losing " +
      "'rolling'), the checks above identify exactly which step regressed.",
    );
    process.exit(1);
  }

  console.log('ALL CHECKS PASSED — promoteRollingEpisode() correctly performs the successful rolling-tag swap.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[test-episode-lifecycle-promote-success] Fatal error:', err);
  process.exit(1);
});
