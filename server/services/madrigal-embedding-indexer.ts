/**
 * Madrigal Embedding Indexer
 *
 * Idempotent boot-time indexer that embeds each Madrigal unit catalog entry
 * and stores it in memory_embeddings with type='madrigal_unit'.
 *
 * Used by PedagogicalStateService.semanticMatchMadrigalUnit() to route
 * start_madrigal_loop(vocab_query) calls to the correct pedagogical unit.
 *
 * Storage: memory_embeddings table, memoryType='madrigal_unit', userId=null (global).
 * The memoryId is the unit's contentKey (e.g. "i took", "where are you going").
 * Strict type='madrigal_unit' filter prevents these from appearing in student
 * memory recall searches.
 *
 * Safety: generateAndStoreEmbedding is idempotent — skips rows where content hash
 * matches. Only generates new embeddings when the catalog text changes.
 */

import { getAllMadrigalUnits } from '../data/madrigal-loop-catalog';
import { generateAndStoreEmbedding } from './semantic-memory-service';

let indexingComplete = false;
let indexingInProgress = false;

export async function indexMadrigalUnits(): Promise<void> {
  if (indexingComplete || indexingInProgress) return;
  indexingInProgress = true;

  const units = getAllMadrigalUnits();
  console.log(`[MadrigalIndexer] Indexing ${units.length} Madrigal units…`);

  let newCount = 0;
  let skipCount = 0;
  const errors: string[] = [];

  for (const unit of units) {
    const unitLanguage = unit.language ?? 'spanish';

    // Build the content string that gets embedded.
    // Rich enough for semantic match: display name + vocab terms + step names + language.
    const content = [
      `Madrigal unit: ${unit.displayName}`,
      `Language: ${unitLanguage}`,
      `Chapter key: ${unit.contentKey}`,
      `Vocabulary: ${unit.vocabTerms.join(', ')}`,
      `Steps: ${unit.steps.map(s => s.stepName).join(', ')}`,
    ].join('. ');

    // For Spanish units (language omitted = legacy), keep memoryId = contentKey for
    // backward compat with existing embeddings. French and future languages use
    // "contentKey:language" format so they don't collide with Spanish entries.
    const memoryId = unitLanguage === 'spanish' ? unit.contentKey : `${unit.contentKey}:${unitLanguage}`;

    try {
      const isNew = await generateAndStoreEmbedding(
        'madrigal_unit',   // memoryType — strict; excluded from student recall searches
        memoryId,          // language-scoped id
        null,              // userId null = global (not student-specific)
        content,
      );
      if (isNew) {
        newCount++;
        console.log(`[MadrigalIndexer]  ✓ indexed "${memoryId}"`);
      } else {
        skipCount++;
      }
    } catch (err: any) {
      errors.push(`${memoryId}: ${err.message}`);
      console.warn(`[MadrigalIndexer]  ✗ failed "${memoryId}":`, err.message);
    }
  }

  indexingComplete = errors.length === 0;
  indexingInProgress = false;
  console.log(`[MadrigalIndexer] Done — ${newCount} new, ${skipCount} skipped, ${errors.length} errors`);
  if (errors.length > 0) {
    console.warn('[MadrigalIndexer] Errors:', errors);
  }
}

/**
 * Schedule indexing after a delay (avoids blocking the boot sequence).
 * Uses 90s delay to avoid hitting the OOM pattern identified in EmbedIndexer.
 * See: .agents/memory/embed-indexer-oom.md
 */
export function scheduleMadrigalIndexing(delayMs = 90_000): void {
  console.log(`[MadrigalIndexer] Scheduled for ${delayMs / 1000}s after boot`);
  setTimeout(() => {
    indexMadrigalUnits().catch(err =>
      console.error('[MadrigalIndexer] Unhandled error during indexing:', err),
    );
  }, delayMs);
}
