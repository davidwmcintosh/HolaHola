import { and, eq, isNull } from 'drizzle-orm';
import { memoryEmbeddings } from '@shared/schema';
import { getSharedDb } from '../db';
import {
  formatOperationForEmbedding,
  OPERATIONS_CATALOG,
} from './operations-catalog';
import { generateAndStoreEmbedding } from './semantic-memory-service';

export const OPERATION_SKILL_MEMORY_TYPE = 'operation_skill';

export async function runOperationSkillIndexer(): Promise<void> {
  const db = getSharedDb();
  let indexed = 0;
  let fresh = 0;
  let errors = 0;

  console.log(`[OperationIndexer] Indexing ${OPERATIONS_CATALOG.length} operation manifests...`);

  for (const operation of OPERATIONS_CATALOG) {
    try {
      const changed = await generateAndStoreEmbedding(
        OPERATION_SKILL_MEMORY_TYPE,
        operation.id,
        null,
        formatOperationForEmbedding(operation),
        1.0,
        10,
      );
      if (changed) indexed++;
      else fresh++;
    } catch (error) {
      errors++;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[OperationIndexer] Failed to index ${operation.id}: ${message}`);
    }
  }

  await db
    .update(memoryEmbeddings)
    .set({ pinned: true, importance: 10 })
    .where(and(
      eq(memoryEmbeddings.memoryType, OPERATION_SKILL_MEMORY_TYPE),
      isNull(memoryEmbeddings.userId),
    ));

  console.log(
    `[OperationIndexer] Complete — ${indexed} indexed, ${fresh} fresh, ${errors} errors`,
  );
}
