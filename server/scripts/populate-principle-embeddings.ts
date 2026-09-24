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

import { getSharedDb } from '../db';
import { northStarPrinciples } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getCachedPrincipleEmbedding } from '../services/semantic-memory-service';
import { isDirectCliInvocation } from './lib/cli-entrypoint';

/**
 * Exported function — safe to call from the server boot path (no process.exit).
 * Idempotent: reads cache first, computes + stores only if the embedding is missing or stale.
 * Returns a summary so the caller can log a single line.
 */
export async function populatePrincipleEmbeddings(): Promise<{ total: number; processed: number; failed: number }> {
  const db = getSharedDb();

  const principles = await db
    .select({ id: northStarPrinciples.id, principleTitle: northStarPrinciples.principleTitle, principle: northStarPrinciples.principle })
    .from(northStarPrinciples)
    .where(eq(northStarPrinciples.isActive, true));

  if (principles.length === 0) {
    console.log('[populate-principle-embeddings] No active principles found — nothing to do.');
    return { total: 0, processed: 0, failed: 0 };
  }

  console.log(`[populate-principle-embeddings] Seeding embeddings for ${principles.length} active principle(s)…`);

  let processed = 0;
  let failed = 0;

  for (const p of principles) {
    try {
      // getCachedPrincipleEmbedding is idempotent: reads cache first, computes+stores only if missing/stale
      const vec = await getCachedPrincipleEmbedding(p.id, p.principle);
      if (vec.length > 0) {
        console.log(`  ✓ [${p.id}] "${p.principleTitle ?? p.principle.substring(0, 60)}…"`);
        processed++;
      }
    } catch (err: any) {
      console.error(`  ✗ [${p.id}] "${p.principleTitle ?? '?'}" — ${err.message}`);
      failed++;
    }
  }

  console.log(`[populate-principle-embeddings] Done. ${processed} processed, ${failed} failed.`);
  return { total: principles.length, processed, failed };
}

// CLI entry-point — only runs when invoked directly (not when imported by the
// server, and not when this module is imported for its exports elsewhere).
// This script is dynamically imported by server/index.ts, so it IS part of
// the esbuild production bundle: isDirectCliInvocation() (argv[1]-basename
// only, never import.meta.url) is required here, not optional. See
// server/scripts/lib/cli-entrypoint.ts for why import.meta.url is unsafe for
// any bundle-reachable script.
if (isDirectCliInvocation('populate-principle-embeddings.ts')) {
  (async () => {
    try {
      const result = await populatePrincipleEmbeddings();
      if (result.failed > 0) process.exit(1);
      process.exit(0);
    } catch (err: any) {
      console.error('[populate-principle-embeddings] Fatal:', err);
      process.exit(1);
    }
  })();
}
