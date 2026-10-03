/**
 * Shared by the historical Neon HTTP repair and disposable-PostgreSQL tests.
 * No replica or embedding work may start until the exact snapshot wins its CAS
 * and is independently reread. Full content equality is intentional: length
 * or prefix checks cannot protect another author's same-length edits.
 */
export type AttributionRepairSql = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;

export async function commitEpisodeAttributionRepair<T>(
  sql: AttributionRepairSql,
  snapshot: { episodeId: string; beforeContent: string; content: string; editCount: number },
  stages: {
    writeReplica: (content: string) => void | Promise<void>;
    reembed: (content: string) => Promise<T>;
  },
): Promise<T> {
  if (snapshot.editCount) {
    const updated = await sql`
      UPDATE conversation_memories SET content = ${snapshot.content}
      WHERE id = ${snapshot.episodeId} AND content = ${snapshot.beforeContent}
      RETURNING id
    `;
    if (updated.length !== 1) throw new Error('Canonical content changed concurrently; retry from a fresh source snapshot');
  }
  const [after] = await sql`SELECT content FROM conversation_memories WHERE id = ${snapshot.episodeId}`;
  if (after?.content !== snapshot.content) throw new Error('Post-update canonical snapshot differs; refusing to overwrite the replica');
  await stages.writeReplica(after.content);
  return stages.reembed(after.content);
}