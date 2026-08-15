/**
 * test-straggler-check-ci.ts
 *
 * CI check: confirms the postCycleStragglerCheck() warning path is live.
 *
 * Uses runPostCycleWarning() from straggler-detector.ts — the exact function
 * that postCycleStragglerCheck() delegates to for its warning decision.
 *
 * INDEXER-INELIGIBLE FIXTURE
 * ──────────────────────────
 * The fake row uses title="x", no summary, content="x".  The indexer's lazy
 * content loader (memory-embedding-indexer.ts line 827) combines these as:
 *   [title, summary, fullContent].filter(Boolean).join('\n\n') → "x\n\nx" (5 chars)
 * and skips any result ≤ 10 chars.  Arm B requires length(summary) > 10 — NULL
 * summary is excluded.  Arm C requires length(content) > 4500 — excluded.
 * Result: the background indexer cannot embed this row, making the count-delta
 * assertion deterministic.
 *
 * Two rounds:
 *   Round 1 — Baseline: record the unembedded count before any mutation.
 *   Round 2 — Mutation: insert indexer-ineligible fake row, assert count rose by ≥ 1,
 *             assert point-query confirms the fake row is still unembedded, call
 *             runPostCycleWarning() with a capture logger, assert warned=true AND
 *             capturedWarnings is non-empty.
 *             Cleanup: delete the fake row AND any stray embeddings (belt-and-suspenders).
 *
 * Exit codes
 * ──────────
 *   0 — all rounds pass
 *   1 — fatal error or assertion failed
 *
 * Uses neon() HTTP driver per episode-sync-http rule.
 */

import { neon } from '@neondatabase/serverless';
import {
  countUnembeddedConversationMemories,
  runPostCycleWarning,
} from '../services/straggler-detector';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;

function createDb() {
  const dbUrl = process.env.NEON_SHARED_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('NEON_SHARED_DATABASE_URL (or DATABASE_URL) is not set.');
  return neon(dbUrl);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cleanup(sql: any, id: string): Promise<void> {
  await sql`DELETE FROM memory_embeddings WHERE memory_id LIKE ${id + '%'}`;
  await sql`DELETE FROM conversation_memories WHERE id = ${id}`;
}

async function main(): Promise<void> {
  const sql = createDb();
  let fakeId: string | null = null;

  try {
    // ── Round 1: Baseline ──────────────────────────────────────────────────────
    console.log(B('\n[straggler-check-ci] Round 1 — Baseline count'));

    const baselineCount = await countUnembeddedConversationMemories(sql);
    if (baselineCount < 0) {
      console.error(R(`[straggler-check-ci] FAIL: baseline count is negative: ${baselineCount}`));
      process.exit(1);
    }
    console.log(G(`[straggler-check-ci] ✓ Baseline unembedded count = ${baselineCount}`));

    // ── Round 2: Mutation ──────────────────────────────────────────────────────
    console.log(B('\n[straggler-check-ci] Round 2 — Mutation (inject indexer-ineligible dark row)'));

    // title="x", no summary, content="x" → combined indexer text = "x\n\nx" (5 chars).
    // Indexer skips at the `content.trim().length <= 10` guard (line 827 of
    // memory-embedding-indexer.ts) so the background indexer cannot embed this row.
    // Omit `tags` and `summary` — DB defaults apply; avoids neon HTTP array-cast issues.
    // summary='x': Arm B requires length(summary) > 10 — 1 char is excluded.
    // Combined Arm A text: ["x","x","x"].filter(Boolean).join('\n\n') = "x\n\nx\n\nx" (7 chars) ≤ 10 → SKIPPED.
    const inserted: any[] = await sql`
      INSERT INTO conversation_memories (title, summary, content, importance, entry_type)
      VALUES ('x', 'x', 'x', 1, 'conversation')
      RETURNING id
    `;

    fakeId = (inserted[0] as { id: string })?.id ?? null;
    if (!fakeId) {
      console.error(R('[straggler-check-ci] FAIL: INSERT returned no id.'));
      process.exit(1);
    }
    console.log(Y(`[straggler-check-ci] Inserted fake row id=${fakeId} (title="x", no summary, content="x" — ineligible for indexing)`));

    // (a) Count-delta: because the fake row is ineligible for indexing the count
    // must rise by at least 1.  This proves the injected row (not a pre-existing one)
    // is what changed the detector state.
    const postInsertCount = await countUnembeddedConversationMemories(sql);
    if (postInsertCount <= baselineCount) {
      console.error(
        R(`[straggler-check-ci] FAIL: count did not rise after INSERT. ` +
          `before=${baselineCount}, after=${postInsertCount}. ` +
          `The injected row is not visible to the detector.`)
      );
      await cleanup(sql, fakeId);
      process.exit(1);
    }
    console.log(G(`[straggler-check-ci] ✓ Count rose ${baselineCount} → ${postInsertCount} (injected row is visible)`));

    // (b) Point-query: confirm the fake row is still unembedded immediately before
    // calling the warning function.
    const pointRows: any[] = await sql`
      SELECT 1 AS found
      FROM conversation_memories cm
      LEFT JOIN (
        SELECT DISTINCT SPLIT_PART(me.memory_id, ':chunk:', 1) AS base_id
        FROM memory_embeddings me
      ) covered ON covered.base_id = cm.id::text
      WHERE cm.id = ${fakeId}
        AND covered.base_id IS NULL
      LIMIT 1
    `;
    if (pointRows.length === 0) {
      console.error(
        R(`[straggler-check-ci] FAIL: fake row id=${fakeId} is already embedded. ` +
          `Cannot assert the warning is triggered by the injected row.`)
      );
      await cleanup(sql, fakeId);
      process.exit(1);
    }
    console.log(G(`[straggler-check-ci] ✓ Point-query confirms fake row is still unembedded`));

    // (c) runPostCycleWarning() — the function postCycleStragglerCheck() delegates to —
    // must call the logger with a warning string.  Removing the logger() call from
    // runPostCycleWarning() makes warned===false and capturedWarnings empty → test fails.
    const capturedWarnings: string[] = [];
    const warningResult = await runPostCycleWarning(sql, (msg) => capturedWarnings.push(msg));

    if (!warningResult.warned || capturedWarnings.length === 0) {
      console.error(
        R(`[straggler-check-ci] FAIL: runPostCycleWarning() did not call the logger. ` +
          `warned=${warningResult.warned}, capturedWarnings=${capturedWarnings.length}, ` +
          `count=${warningResult.count}. ` +
          `The ⚠ WARNING branch in postCycleStragglerCheck() is dead code.`)
      );
      await cleanup(sql, fakeId);
      process.exit(1);
    }
    console.log(G(
      `[straggler-check-ci] ✓ warned=true (count=${warningResult.count}), ` +
      `logger received: "${capturedWarnings[0]?.slice(0, 80)}…". ` +
      `⚠ WARNING path in postCycleStragglerCheck() fires. Detector is live.`
    ));

    // ── Cleanup ────────────────────────────────────────────────────────────────
    await cleanup(sql, fakeId);
    fakeId = null;
    console.log(Y('[straggler-check-ci] Cleaned up fake row and any stray embeddings — no permanent DB writes'));

    const afterCleanup = await countUnembeddedConversationMemories(sql);
    if (afterCleanup >= postInsertCount) {
      console.log(Y(
        `[straggler-check-ci] Note: count after cleanup (${afterCleanup}) ≥ post-insert count ` +
        `(${postInsertCount}) — concurrent dark rows may have appeared`
      ));
    } else {
      console.log(G(`[straggler-check-ci] ✓ Count after cleanup = ${afterCleanup} (fake row removed)`));
    }

    console.log(G('\n[straggler-check-ci] ✓ All rounds passed — straggler warning path is live'));
    process.exit(0);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(R(`[straggler-check-ci] FATAL: ${msg}`));
    if (fakeId) {
      try {
        const cleanupSql = createDb();
        await cleanup(cleanupSql, fakeId);
        console.log(Y(`[straggler-check-ci] Emergency cleanup: deleted fake row id=${fakeId}`));
      } catch (cleanupErr: unknown) {
        const cleanupMsg = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
        console.error(Y(`[straggler-check-ci] Emergency cleanup failed: ${cleanupMsg}`));
      }
    }
    process.exit(1);
  }
}

main();
