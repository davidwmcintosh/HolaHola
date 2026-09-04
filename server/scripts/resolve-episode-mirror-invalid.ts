/**
 * Operator command for resolving a mirror item whose requested Episode can
 * never be valid again. This never retargets or appends content.
 *
 * Usage:
 *   npx tsx server/scripts/resolve-episode-mirror-invalid.ts \
 *     --item .local/episode-mirror-outbox/<item>.json \
 *     --destination-state removed \
 *     --reason "Episode was deliberately removed after sealing" \
 *     --operator "Luca [Replit]" \
 *     --evidence-file /tmp/mirror-evidence.json
 *
 * Evidence JSON is an array with exactly one entry per capture ID:
 *   [{"captureId":"turn-id","disposition":"canonical","canonicalMemoryId":"uuid"}]
 * or
 *   [{"captureId":"turn-id","disposition":"deliberately-unresolved","reason":"..."}]
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  resolveEpisodeMirrorDestinationInvalid,
  type EpisodeMirrorResolutionEvidence,
  type EpisodeMirrorUnresolvedEvidence,
} from '../services/episode-mirror-outbox';
import { getUserDb } from '../db';
import { sql } from 'drizzle-orm';

function requiredArg(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value;
}

async function main(): Promise<void> {
  const itemPath = resolve(requiredArg('--item'));
  const destinationState = requiredArg('--destination-state');
  if (destinationState !== 'removed' && destinationState !== 'sealed') {
    throw new Error('--destination-state must be removed or sealed');
  }
  const evidencePath = resolve(requiredArg('--evidence-file'));
  const evidence = JSON.parse(readFileSync(evidencePath, 'utf8')) as Array<
    EpisodeMirrorResolutionEvidence | EpisodeMirrorUnresolvedEvidence
  >;
  if (!Array.isArray(evidence)) throw new Error('--evidence-file must contain a JSON array');

  const db = getUserDb();
  const resolution = await resolveEpisodeMirrorDestinationInvalid(itemPath, {
    destinationState,
    reason: requiredArg('--reason'),
    operator: requiredArg('--operator'),
    evidence,
    verifyCanonicalMemory: async (captureId, canonicalMemoryId) => {
      const result = await db.execute(sql`
        SELECT id
        FROM conversation_memories
        WHERE id = ${canonicalMemoryId}
          AND arc_name = 'david-luca-chat'
          AND tags @> ARRAY[${`capture-id:${captureId}`}]::text[]
        LIMIT 1
      `);
      return Boolean((result as any).rows?.[0]?.id ?? (result as any)[0]?.id);
    },
  });
  console.log(
    `[EpisodeOutbox] Audited terminal resolution recorded. ` +
    `The worker may advance without modifying the invalid destination. Audit: ${resolution.auditPath}`,
  );
}

main().catch(error => {
  console.error(`[EpisodeOutbox] ${error?.message ?? String(error)}`);
  process.exit(1);
});