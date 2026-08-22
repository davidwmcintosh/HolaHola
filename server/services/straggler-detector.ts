/**
 * straggler-detector.ts
 *
 * Side-effect-free module — safe to import from CI scripts.
 * Contains the SQL logic for detecting conversation_memories rows that have
 * no embedding of any type.  Used by:
 *
 *   • memory-embedding-indexer.ts — production post-cycle check
 *   • test-straggler-check-ci.ts  — CI mutation test (via neon() HTTP driver)
 *
 * Accepting the db tag as a parameter keeps this module driver-agnostic and
 * free of side effects on import.
 *
 * Query design ("any embedding of any type" invariant):
 *   A row is covered if memory_embeddings has ANY record whose memory_id either
 *   equals the bare conversation UUID OR begins with that UUID (chunk IDs are
 *   stored as `{uuid}:chunk:{n}`).  No memory_type filter is applied — an
 *   embedding of any type counts as coverage.
 *
 *   Implementation: pre-aggregate from memory_embeddings by stripping any
 *   ':chunk:' suffix with SPLIT_PART, deduplicate, then LEFT JOIN against
 *   conversation_memories.  This is O(k + n log k) and avoids the O(n × m)
 *   per-row LIKE scan that prevented index use on neon HTTP.
 */

/**
 * Counts how many conversation_memories rows have no embedding of any type.
 * Core liveness signal: > 0 after a cycle means the indexer left rows dark.
 * This is the exact condition that triggers ⚠ WARNING in postCycleStragglerCheck().
 *
 * @param sqlTag  A tagged-template SQL executor (neon() tag or Drizzle wrapper).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function countUnembeddedConversationMemories(sqlTag: any): Promise<number> {
  const rows: any[] = await sqlTag`
    SELECT COUNT(*)::int AS cnt
    FROM conversation_memories cm
    LEFT JOIN (
      SELECT DISTINCT SPLIT_PART(me.memory_id, ':chunk:', 1) AS base_id
      FROM memory_embeddings me
    ) covered ON covered.base_id = cm.id::text
    WHERE covered.base_id IS NULL
  `;
  return Number(rows[0]?.cnt ?? 0);
}

/**
 * Returns the top `limit` conversation_memory IDs that have no embedding.
 * Ordered by highest importance first so critical memories are patched first.
 * Mirrors the ordering used by postCycleStragglerCheck() to prioritise patching.
 *
 * @param sqlTag  A tagged-template SQL executor (neon() tag or Drizzle wrapper).
 * @param limit   Maximum number of IDs to return.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getTopUnembeddedConversationMemoryIds(sqlTag: any, limit: number): Promise<string[]> {
  const rows: any[] = await sqlTag`
    SELECT cm.id
    FROM conversation_memories cm
    LEFT JOIN (
      SELECT DISTINCT SPLIT_PART(me.memory_id, ':chunk:', 1) AS base_id
      FROM memory_embeddings me
    ) covered ON covered.base_id = cm.id::text
    WHERE covered.base_id IS NULL
    ORDER BY cm.importance DESC NULLS LAST, cm.created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r: { id: string }) => r.id);
}

/**
 * Returns the ⚠ WARNING message for a given dark-row count, or null when no
 * warning is needed (count === 0).  Used internally by runPostCycleWarning().
 *
 * @param count  Return value of countUnembeddedConversationMemories().
 */
export function stragglerWarningMessage(count: number): string | null {
  if (count === 0) return null;
  return (
    `[EmbedIndexer] ⚠ WARNING: ${count} conversation_memories row(s) still have no ` +
    `embedding after this cycle (likely left dark by a previous OOM or rate-limit failure).`
  );
}

/**
 * Runs the post-cycle warning operation that postCycleStragglerCheck() delegates to.
 *
 * Counts dark rows and — if any exist — calls logger() with the ⚠ WARNING message.
 * Returns { count, warned } so callers can inspect the outcome.
 *
 * postCycleStragglerCheck() calls this with logger = console.warn.
 * CI scripts call this with logger = a capture function and assert warned === true
 * after injecting a dark row, proving the warning branch is live and not dead code.
 * Removing or short-circuiting the logger() call in this function causes the CI to fail.
 *
 * @param sqlTag  A tagged-template SQL executor (neon() tag or Drizzle wrapper).
 * @param logger  Receives the warning string when dark rows are found.
 */
export async function runPostCycleWarning(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sqlTag: any,
  logger: (msg: string) => void,
): Promise<{ count: number; warned: boolean }> {
  const count = await countUnembeddedConversationMemories(sqlTag);
  const msg = stragglerWarningMessage(count);
  if (msg !== null) {
    logger(msg);
  }
  return { count, warned: msg !== null };
}
