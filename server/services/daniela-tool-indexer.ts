/**
 * Daniela Tool Indexer
 *
 * Embeds all of Daniela's function declarations into the neural memory system
 * (memory_embeddings table) so she can recall what tools she has, when to use
 * them, and how they work — even if the function registry injection degrades.
 *
 * Memory type: 'daniela_tool'
 * userId: null — globally scoped, relevant to every session
 * pinned: true — tools don't decay; their embeddings are always full-weight
 *
 * Runs idempotently at startup (+100s). The content hash check means re-runs
 * are nearly free unless a tool description has changed.
 */

import { getSharedDb } from '../db';
import { memoryEmbeddings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { generateAndStoreEmbedding } from './semantic-memory-service';
import { DANIELA_FUNCTION_REGISTRY } from './daniela-function-registry';

const MEMORY_TYPE = 'daniela_tool';

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Render a tool entry as a rich text document suitable for embedding.
 * Captures name, purpose, parameters, and when to use — enough for semantic
 * recall to surface the right tool from a natural-language query.
 */
function formatToolForEmbedding(entry: (typeof DANIELA_FUNCTION_REGISTRY)[number]): string {
  const decl = entry.declaration;
  const schema = decl.parametersJsonSchema as any;
  const props: string[] = [];

  if (schema?.properties) {
    for (const [param, def] of Object.entries<any>(schema.properties)) {
      const required = (schema.required ?? []).includes(param);
      const enumStr = def.enum ? ` (options: ${def.enum.join(', ')})` : '';
      props.push(`  - ${param}${required ? ' [required]' : ' [optional]'}${enumStr}: ${def.description ?? ''}`);
    }
  }

  const paramBlock = props.length > 0
    ? `\nParameters:\n${props.join('\n')}`
    : '\nNo parameters required.';

  return [
    `Tool: ${decl.name} (internal type: ${entry.legacyType})`,
    '',
    decl.description,
    paramBlock,
  ].join('\n');
}

// ─── Indexer ─────────────────────────────────────────────────────────────────

/**
 * Index all Daniela tool declarations into memory_embeddings.
 * Each tool gets memoryType='daniela_tool', memoryId=legacyType, userId=null.
 * All tool embeddings are pinned (strength stays at 1.0 — tools don't decay).
 * Idempotent: content hash prevents re-embedding unchanged tools.
 */
export async function runDanielaToolIndexer(): Promise<void> {
  const db = getSharedDb();
  const tools = DANIELA_FUNCTION_REGISTRY;

  console.log(`[ToolIndexer] Indexing ${tools.length} Daniela tool declarations into neural memory...`);

  let indexed = 0;
  let skipped = 0;
  let errors  = 0;

  for (const tool of tools) {
    try {
      const content = formatToolForEmbedding(tool);
      const isNew = await generateAndStoreEmbedding(
        MEMORY_TYPE,
        tool.legacyType,
        null,           // globally scoped — not student-specific
        content,
        1.0,            // full initial strength
      );
      if (isNew) indexed++;
      else skipped++;
    } catch (err: any) {
      errors++;
      if (errors <= 3) {
        console.warn(`[ToolIndexer] Failed to embed tool ${tool.legacyType}:`, err.message);
      }
    }
  }

  // Pin all tool embeddings so they never decay — tools are permanent knowledge
  try {
    await db
      .update(memoryEmbeddings)
      .set({ pinned: true })
      .where(eq(memoryEmbeddings.memoryType, MEMORY_TYPE));
  } catch (err: any) {
    console.warn(`[ToolIndexer] Could not pin tool embeddings:`, err.message);
  }

  console.log(`[ToolIndexer] Done — ${indexed} indexed, ${skipped} already fresh, ${errors} errors`);
}
