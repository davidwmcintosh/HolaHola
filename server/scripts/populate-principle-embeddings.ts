/**
 * populate-principle-embeddings.ts
 *
 * One-time (idempotent) script that pre-computes and caches the embedding
 * vector for every active North Star principle into the memory_embeddings table.
 *
 * Run once after deploy (or whenever new principles are added) so that
 * processReachNorthStar Phase B never calls OpenAI at serve-time.
 *
 * Usage:
 *   npx tsx server/scripts/populate-principle-embeddings.ts
 */

import '../lib/env';
import { getSharedDb } from '../db';
import { northStarPrinciples } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getCachedPrincipleEmbedding } from '../services/semantic-memory-service';

async function main() {
  const db = getSharedDb();

  const principles = await db
    .select({ id: northStarPrinciples.id, principleTitle: northStarPrinciples.principleTitle, principle: northStarPrinciples.principle })
    .from(northStarPrinciples)
    .where(eq(northStarPrinciples.isActive, true));

  if (principles.length === 0) {
    console.log('[populate-principle-embeddings] No active principles found — nothing to do.');
    process.exit(0);
  }

  console.log(`[populate-principle-embeddings] Seeding embeddings for ${principles.length} active principle(s)…`);

  let cached = 0;
  let computed = 0;
  let failed = 0;

  for (const p of principles) {
    try {
      // getCachedPrincipleEmbedding is idempotent: reads cache first, computes+stores only if missing/stale
      const vec = await getCachedPrincipleEmbedding(p.id, p.principle);
      if (vec.length > 0) {
        // We can tell whether it was a cache hit by checking if OpenAI was called,
        // but getCachedPrincipleEmbedding doesn't expose that flag — log uniformly.
        console.log(`  ✓ [${p.id}] "${p.principleTitle ?? p.principle.substring(0, 60)}…"`);
        computed++;
      }
    } catch (err: any) {
      console.error(`  ✗ [${p.id}] "${p.principleTitle ?? '?'}" — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n[populate-principle-embeddings] Done. ${computed} processed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

main().catch(err => {
  console.error('[populate-principle-embeddings] Fatal:', err);
  process.exit(1);
});
