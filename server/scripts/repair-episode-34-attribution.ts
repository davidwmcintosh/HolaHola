/**
 * DB-first, compare-and-swap historical attribution repair. Dry-run by default.
 * --apply commits only label spans authorized by complete source records.
 * --evidence <path> writes hashes/IDs, never dialogue, for an audit receipt.
 */
import { neon } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { attributionSha256, repairEpisodeClaudeAttribution } from '../services/episode-claude-attribution-repair';
import { commitEpisodeAttributionRepair } from '../services/episode-attribution-repair-commit';

const EPISODE_ID = '41200170-1c49-4660-838c-9d397aff5d27';
const SESSION = 'c52bede8-dd68-4804-8f77-59290f60b9e2';
const normalize = (content: string) => content.split('\n').map(line => line.trimEnd()).join('\n').trim();

async function main(): Promise<void> {
  const url = process.env.NEON_SHARED_DATABASE_URL;
  if (!url) throw new Error('NEON_SHARED_DATABASE_URL is required');
  const sql = neon(url);
  const [before] = await sql`
    SELECT id, title, content, tags FROM conversation_memories
    WHERE id = ${EPISODE_ID} AND title = 'Episode 34' AND arc_name = 'HolaHola Episodes'
  `;
  if (!before || !before.tags.includes('rolling-protected')) throw new Error('Canonical Episode 34 identity was not verified');
  const sources = await sql`
    SELECT id, content, tags FROM conversation_memories
    WHERE arc_name = 'david-luca-chat' AND 'source-claude-code' = ANY(tags)
      AND EXISTS (SELECT 1 FROM unnest(tags) tag WHERE tag LIKE ${`capture-id:cc-${SESSION}-%`})
  `;
  const repair = repairEpisodeClaudeAttribution(before.content, sources.map(row => ({
    id: String(row.id), content: String(row.content), tags: row.tags as string[],
  })), SESSION);
  const evidence = {
    episodeId: EPISODE_ID,
    beforeSha256: attributionSha256(before.content),
    afterSha256: attributionSha256(repair.content),
    edits: repair.edits,
    nonLabelBytesUnchanged: true,
    applied: process.argv.includes('--apply'),
  };
  console.log(JSON.stringify({ ...evidence, edits: evidence.edits.length }));
  if (!evidence.applied) return;
  const verifiedEmbeddingArms = await commitEpisodeAttributionRepair(sql, {
    episodeId: EPISODE_ID, beforeContent: before.content,
    content: repair.content, editCount: repair.edits.length,
  }, {
    writeReplica(content) {
      const replicaPath = resolve('docs/episode-34.md');
      writeFileSync(replicaPath, content, 'utf8');
      if (normalize(readFileSync(replicaPath, 'utf8')) !== normalize(content)) throw new Error('DB-normalized replica parity failed');
    },
    async reembed(content) {
      const { reembedConversationMemory } = await import('./reembed-memory');
      await reembedConversationMemory(EPISODE_ID);
      const { splitIntoChunks, reformatSpeakerHeaders } = await import('../services/memory-embedding-indexer');
      const [memory] = await sql`SELECT title, summary, content FROM conversation_memories WHERE id = ${EPISODE_ID}`;
      if (memory.content !== content) throw new Error('Canonical record changed while embedding; rerun to verify the latest snapshot');
      const embeddings = await sql`
        SELECT memory_type, memory_id, content_hash FROM memory_embeddings
        WHERE (memory_type = 'conversation_memory' AND memory_id = ${EPISODE_ID})
          OR (memory_type = 'conversation_chunk' AND memory_id LIKE ${`${EPISODE_ID}:chunk:%`})
      `;
      const expected = [
        { type: 'conversation_memory', id: EPISODE_ID, text: [memory.title, memory.summary, memory.content].filter(Boolean).join('\n\n') },
        ...splitIntoChunks(memory.content).map((chunk, index, chunks) => ({
          type: 'conversation_chunk', id: `${EPISODE_ID}:chunk:${index}`,
          text: `[Memory: ${memory.title ?? 'Untitled'} | Part ${index + 1} of ${chunks.length}]\n\n${reformatSpeakerHeaders(chunk)}`,
        })),
      ];
      for (const arm of expected) {
        const found = embeddings.filter(row => row.memory_type === arm.type && row.memory_id === arm.id);
        if (!found.length || found.some(row => row.content_hash !== attributionSha256(arm.text))) {
          throw new Error(`Embedding hash mismatch: ${arm.id}`);
        }
      }
      return expected.length;
    },
  });
  const receipt = { ...evidence, replicaParity: true, verifiedEmbeddingArms };
  const evidenceIndex = process.argv.indexOf('--evidence');
  if (evidenceIndex >= 0) {
    const output = process.argv[evidenceIndex + 1];
    if (!output) throw new Error('--evidence requires a path');
    const json = JSON.stringify(receipt, null, 2) + '\n';
    // Restrict audit writes to the documented replica-side receipts.
    // Never accept an arbitrary CLI destination in a source-mutating script.
    if (output === 'docs/episode-34-attribution-repair-evidence.json') {
      writeFileSync('docs/episode-34-attribution-repair-evidence.json', json);
    } else if (output === 'docs/episode-34-attribution-repair-backfill-evidence.json') {
      writeFileSync('docs/episode-34-attribution-repair-backfill-evidence.json', json);
    } else if (output === 'docs/episode-34-attribution-repair-post-merge-evidence.json') {
      writeFileSync('docs/episode-34-attribution-repair-post-merge-evidence.json', json);
    } else if (output === 'docs/episode-34-attribution-repair-validation-startup-evidence.json') {
      writeFileSync('docs/episode-34-attribution-repair-validation-startup-evidence.json', json);
    } else {
      throw new Error('--evidence must name a documented Episode 34 receipt path');
    }
  }
  console.log(JSON.stringify({ replicaParity: true, verifiedEmbeddingArms }));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});