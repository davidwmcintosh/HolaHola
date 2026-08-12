/**
 * set-rolling-episode.ts
 *
 * Atomically promotes a named episode to the "rolling" target by:
 *   1. Removing the 'rolling' tag from ALL current rolling episodes in the arc
 *   2. Adding the 'rolling' tag to the named episode
 *
 * Both steps run inside a single Drizzle transaction, so a failure after step 1
 * rolls back automatically — no episode is ever left without a rolling tag due
 * to a partial write.
 *
 * Usage:
 *   npx tsx server/scripts/set-rolling-episode.ts --episode episode-28
 *
 * Options:
 *   --episode <name>   The episode to promote (e.g. "episode-28" or "Episode 28").
 *                      Matched against the `title` field in conversation_memories
 *                      (case-insensitive; accepts slugs like "episode-28" or
 *                      human-readable titles like "Episode 28").
 *   --self-check       Run atomicity/error-path validation without modifying
 *                      production state, then exit. No --episode required.
 *
 * Output:
 *   Old rolling: Episode 27
 *   New rolling: Episode 28
 *
 * Why this exists:
 *   Changing the rolling episode previously required raw SQL in a DB console.
 *   This script makes the handoff safe and auditable — no raw SQL, no typos,
 *   and the old/new names are printed so the change is self-documenting.
 *
 * The autosave watcher (checkEpisodeAppend) and `append-to-episode.ts --rolling`
 * both look up the most-recently-created row tagged 'rolling', so after this
 * script runs they automatically target the new episode on their next cycle.
 */

import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let episodeArg = '';
let selfCheckMode = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--episode' && args[i + 1]) {
    episodeArg = args[i + 1];
    i++;
  } else if (args[i] === '--self-check') {
    selfCheckMode = true;
  }
}

if (!selfCheckMode && !episodeArg) {
  console.error('Usage: npx tsx server/scripts/set-rolling-episode.ts --episode episode-28');
  console.error('       npx tsx server/scripts/set-rolling-episode.ts --self-check');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Normalise the supplied episode name into a DB title pattern
//
// Accepts: "episode-28", "episode28", "Episode 28", "Episode-28"
// Resolves to the canonical title form stored in the DB ("Episode 28").
// ---------------------------------------------------------------------------

function normaliseToTitle(input: string): string {
  const s = input.trim();
  const slugMatch = /^episode[-\s]?(\d+)$/i.exec(s);
  if (slugMatch) return `Episode ${parseInt(slugMatch[1], 10)}`;
  // Already looks like a human title — return as-is
  return s;
}

// ---------------------------------------------------------------------------
// Self-check: validate error paths and transaction atomicity
//   - Passes a definitely-nonexistent episode name and asserts lookup returns empty
//   - Runs a transaction that clears rolling tags, then throws to force rollback,
//     then verifies the original rolling tag is still intact
// ---------------------------------------------------------------------------

async function runSelfCheck(): Promise<void> {
  console.log('[set-rolling-episode --self-check] Starting...\n');
  const db = getSharedDb();

  // ── Check 1: Not-found path ───────────────────────────────────────────────
  const bogusTitle = 'Episode 99999-nonexistent';
  const bogusRows = await db.execute(sql`
    SELECT id FROM conversation_memories
    WHERE arc_name = 'HolaHola Episodes'
      AND lower(title) = lower(${bogusTitle})
    LIMIT 1
  `);
  if (bogusRows.rows.length > 0) {
    console.error(`[self-check] FAIL: Unexpectedly found episode "${bogusTitle}" — test assumption invalid`);
    process.exit(1);
  }
  console.log('[self-check] PASS (1/2): Not-found lookup correctly returns empty for a nonexistent episode');

  // ── Check 2: Transaction rollback atomicity ───────────────────────────────
  // Find the current rolling episode (if any) to use as the reference point.
  const currentRows = await db.execute(sql`
    SELECT id, title
    FROM conversation_memories
    WHERE arc_name = 'HolaHola Episodes'
      AND 'rolling' = ANY(tags)
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (currentRows.rows.length === 0) {
    console.log('[self-check] SKIP (2/2): No rolling episode in DB — cannot test rollback (no reference row). All other checks passed.');
    process.exit(0);
  }

  const currentRow = currentRows.rows[0] as { id: string; title: string };

  // Run a transaction that simulates the full tag-removal, then throws an
  // intentional error to force rollback. Verify the tag is still present after.
  let rolledBack = false;
  try {
    await db.transaction(async (tx) => {
      // Simulate step 1: remove rolling from all arc rows
      await tx.execute(sql`
        UPDATE conversation_memories
        SET tags = array_remove(tags, 'rolling')
        WHERE arc_name = 'HolaHola Episodes'
          AND 'rolling' = ANY(tags)
      `);

      // Confirm within the transaction that the tag is gone
      const midCheck = await tx.execute(sql`
        SELECT id FROM conversation_memories
        WHERE id = ${currentRow.id}
          AND 'rolling' = ANY(tags)
      `);
      if (midCheck.rows.length > 0) {
        console.error('[self-check] FAIL (2/2): Tag still present mid-transaction after array_remove — UPDATE did not fire');
        process.exit(1);
      }

      // Simulate step 2 failure (e.g. target episode not found) → force rollback
      throw new Error('INTENTIONAL_ROLLBACK — simulating target-episode-not-found failure');
    });
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('INTENTIONAL_ROLLBACK')) {
      rolledBack = true;
    } else {
      throw e;
    }
  }

  if (!rolledBack) {
    console.error('[self-check] FAIL (2/2): Transaction did not throw as expected');
    process.exit(1);
  }

  // Verify the rolling tag survived the rollback
  const afterRows = await db.execute(sql`
    SELECT id FROM conversation_memories
    WHERE id = ${currentRow.id}
      AND 'rolling' = ANY(tags)
  `);
  if (afterRows.rows.length === 0) {
    console.error('[self-check] FAIL (2/2): Rolling tag was NOT restored after transaction rollback — partial state leak!');
    process.exit(1);
  }

  console.log('[self-check] PASS (2/2): Transaction rollback correctly preserved the rolling tag — no partial state');
  console.log('\n[set-rolling-episode --self-check] All checks passed. ✅');
}

// ---------------------------------------------------------------------------
// Main: atomically promote the named episode to rolling
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const db = getSharedDb();
  const newTitle = normaliseToTitle(episodeArg);

  // ── 1. Find the target episode row ────────────────────────────────────────
  const targetRows = await db.execute(sql`
    SELECT id, title, tags
    FROM conversation_memories
    WHERE arc_name = 'HolaHola Episodes'
      AND lower(title) = lower(${newTitle})
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (targetRows.rows.length === 0) {
    console.error(`[set-rolling-episode] ERROR: No episode found with title matching "${newTitle}" in HolaHola Episodes arc.`);
    console.error("Tip: SELECT id, title FROM conversation_memories WHERE arc_name = 'HolaHola Episodes' ORDER BY created_at DESC;");
    process.exit(1);
  }

  const target = targetRows.rows[0] as { id: string; title: string; tags: string[] };

  if (Array.isArray(target.tags) && target.tags.includes('rolling')) {
    console.log(`[set-rolling-episode] "${target.title}" is already the rolling episode. No change needed.`);
    process.exit(0);
  }

  // ── 2. Read the current rolling set (for the audit log) ──────────────────
  const currentRows = await db.execute(sql`
    SELECT title
    FROM conversation_memories
    WHERE arc_name = 'HolaHola Episodes'
      AND 'rolling' = ANY(tags)
    ORDER BY created_at DESC
  `);
  const currentTitles = (currentRows.rows as Array<{ title: string }>).map(r => r.title);

  // ── 3. Atomic swap inside a single transaction ───────────────────────────
  //       Step A: clear 'rolling' from ALL arc rows (not just the newest)
  //       Step B: add 'rolling' to the target
  //    If step B throws (e.g. DB error), step A is rolled back automatically.
  await db.transaction(async (tx) => {
    // Step A: clear rolling from every HolaHola episode that currently has it
    await tx.execute(sql`
      UPDATE conversation_memories
      SET tags = array_remove(tags, 'rolling')
      WHERE arc_name = 'HolaHola Episodes'
        AND 'rolling' = ANY(tags)
    `);

    // Step B: add rolling + rolling-protected to the verified target.
    // 'rolling-protected' is a permanent tag that is NEVER removed — it marks
    // every episode that has ever been the rolling episode so the startup
    // shrinkage guard can find and protect them even after they are superseded.
    await tx.execute(sql`
      UPDATE conversation_memories
      SET tags = array_append(
                   CASE WHEN 'rolling-protected' = ANY(tags)
                        THEN tags
                        ELSE array_append(tags, 'rolling-protected')
                   END,
                   'rolling'
                 )
      WHERE id = ${target.id}
    `);
  });

  // ── 4. Auditable summary ──────────────────────────────────────────────────
  const oldLabel = currentTitles.length > 0 ? currentTitles.join(', ') : '(none)';
  console.log('[set-rolling-episode] Done.');
  console.log(`  Old rolling: ${oldLabel}`);
  console.log(`  New rolling: ${target.title}`);
  console.log('');
  console.log('The autosave watcher and --rolling flag will pick up the new target on their next cycle.');
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

(selfCheckMode ? runSelfCheck() : main()).catch(err => {
  console.error('[set-rolling-episode] Unexpected error:', err);
  process.exit(1);
});
