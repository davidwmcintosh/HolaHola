/**
 * Daniela Tool Indexer — COMPLETE 3-LAYER PIPELINE
 *
 * This is the single source of truth for keeping Daniela's tool documentation
 * complete. It runs idempotently at server startup (+100s) and ensures every
 * entry in DANIELA_FUNCTION_REGISTRY is represented in all three layers:
 *
 *   LAYER 1 — daniela_tool embeddings (memory_embeddings, memoryType='daniela_tool')
 *     Pinned global embeddings of the full tool declaration. Used by the neural
 *     memory recall scatter-gather so Daniela can find any tool by natural-language
 *     query even when context injection is degraded.
 *
 *   LAYER 2 — tool_knowledge rows (tool_knowledge table)
 *     Structured metadata: purpose, syntax, examples, bestUsedFor, combinesWith.
 *     Used by Daniela's brain-surgery self-modification tools and the toolkit
 *     browser. Auto-generated from the declaration if no hand-crafted row exists.
 *     Hand-crafted rows (richer examples, combinesWith, avoidWhen) are preserved
 *     on re-runs — the indexer only inserts missing rows, never overwrites.
 *
 *   LAYER 3 — tool_knowledge embeddings (memory_embeddings, memoryType='tool_knowledge')
 *     Semantic index of the Layer 2 rows. A semantic search on "how do I traverse
 *     connected memories?" surfaces find_connected_memories via this layer.
 *     Auto-synced whenever a tool_knowledge row lacks a matching embedding.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RULE: When you add a new tool to DANIELA_FUNCTION_REGISTRY (in
 * daniela-function-registry.ts), that is the ONLY thing you need to do.
 * This indexer handles all three layers automatically on the next server start.
 *
 * Optionally, hand-craft richer tool_knowledge rows (better examples, explicit
 * combinesWith/avoidWhen lists) by inserting directly into the tool_knowledge
 * table. The indexer respects hand-crafted rows and will never overwrite them.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Embedding model: OpenAI text-embedding-3-small (768-dimensional vectors).
 * Requires USER_OPENAI_API_KEY or OPENAI_API_KEY environment variable.
 * This is the same model used by the entire semantic-memory-service layer.
 */

import { getSharedDb } from '../db';
import { memoryEmbeddings, toolKnowledge } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';
import { generateAndStoreEmbedding } from './semantic-memory-service';
import { DANIELA_FUNCTION_REGISTRY } from './daniela-function-registry';

const MEMORY_TYPE_TOOL = 'daniela_tool';
const MEMORY_TYPE_KNOWLEDGE = 'tool_knowledge';

// ─── Layer 1: Embed the raw declaration ──────────────────────────────────────

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

// ─── Layer 2: Structured tool_knowledge row ───────────────────────────────────

/**
 * Auto-generate a tool_knowledge row from the function declaration.
 * These are intentionally minimal — just enough to be searchable.
 * Hand-crafted rows (with richer examples and combinesWith) are preferred
 * and are never overwritten by this function.
 */
function buildToolKnowledgeRow(entry: (typeof DANIELA_FUNCTION_REGISTRY)[number]) {
  const decl = entry.declaration;
  const schema = decl.parametersJsonSchema as any;

  // Derive purpose: first paragraph of the description (up to first blank line)
  const firstParagraph = decl.description.split(/\n\n/)[0].trim();
  const purpose = firstParagraph.length > 500
    ? firstParagraph.slice(0, 497) + '...'
    : firstParagraph;

  // Derive syntax: toolName({ param1 [required], param2? })
  const paramParts: string[] = [];
  if (schema?.properties) {
    for (const [param, def] of Object.entries<any>(schema.properties)) {
      const required = (schema.required ?? []).includes(param);
      paramParts.push(required ? param : `${param}?`);
    }
  }
  const syntax = paramParts.length > 0
    ? `${decl.name}({ ${paramParts.join(', ')} })`
    : `${decl.name}()`;

  // Derive bestUsedFor: look for WHEN TO USE section in the description
  const whenToUseMatch = decl.description.match(/WHEN TO USE:?\s*\n([\s\S]*?)(\n\n|$)/i);
  let bestUsedFor: string[] | null = null;
  if (whenToUseMatch) {
    bestUsedFor = whenToUseMatch[1]
      .split('\n')
      .map(l => l.replace(/^[-•*]\s*/, '').trim())
      .filter(l => l.length > 5)
      .slice(0, 5);
  }

  return {
    toolName: decl.name,
    toolType: 'native_function_call',
    purpose,
    syntax,
    examples: null as string[] | null,
    bestUsedFor,
    avoidWhen: null as string[] | null,
    combinesWith: null as string[] | null,
    sequencePatterns: null as string[] | null,
    isActive: true,
  };
}

// ─── Layer 3: Embed the tool_knowledge row ────────────────────────────────────

function formatKnowledgeRowForEmbedding(
  name: string,
  purpose: string,
  syntax: string,
  bestUsedFor: string[] | null,
): string {
  const lines = [
    `TOOL: ${name}`,
    `TYPE: native_function_call`,
    `PURPOSE: ${purpose}`,
    `SYNTAX: ${syntax}`,
  ];
  if (bestUsedFor && bestUsedFor.length > 0) {
    lines.push(`BEST USED FOR: ${bestUsedFor.join(', ')}`);
  }
  return lines.join('\n');
}

// ─── Main indexer ─────────────────────────────────────────────────────────────

/**
 * Run the full 3-layer tool documentation pipeline.
 *
 * Layer 1: daniela_tool embeddings — one per registry entry, idempotent.
 * Layer 2: tool_knowledge rows — inserts missing rows, never overwrites existing.
 * Layer 3: tool_knowledge embeddings — indexes any row that lacks an embedding.
 */
export async function runDanielaToolIndexer(): Promise<void> {
  const db = getSharedDb();
  const tools = DANIELA_FUNCTION_REGISTRY;

  console.log(`[ToolIndexer] Starting 3-layer pipeline for ${tools.length} tools...`);

  // ── Layer 1: daniela_tool embeddings ─────────────────────────────────────────
  let l1Indexed = 0, l1Skipped = 0, l1Errors = 0;

  for (const tool of tools) {
    try {
      const content = formatToolForEmbedding(tool);
      const isNew = await generateAndStoreEmbedding(
        MEMORY_TYPE_TOOL,
        tool.legacyType,
        null,     // globally scoped — not student-specific
        content,
        1.0,      // full initial strength
      );
      if (isNew) l1Indexed++; else l1Skipped++;
    } catch (err: any) {
      l1Errors++;
      if (l1Errors <= 3) console.warn(`[ToolIndexer] L1 failed for ${tool.legacyType}:`, err.message);
    }
  }

  // Pin all tool embeddings so they never decay
  try {
    await db
      .update(memoryEmbeddings)
      .set({ pinned: true })
      .where(eq(memoryEmbeddings.memoryType, MEMORY_TYPE_TOOL));
  } catch (err: any) {
    console.warn('[ToolIndexer] Could not pin tool embeddings:', err.message);
  }

  console.log(`[ToolIndexer] Layer 1 (daniela_tool) — ${l1Indexed} indexed, ${l1Skipped} fresh, ${l1Errors} errors`);

  // ── Layer 2: tool_knowledge rows ─────────────────────────────────────────────
  let l2Inserted = 0, l2Skipped = 0, l2Errors = 0;

  // Fetch all existing tool_knowledge names in one query
  const existingRows = await db
    .select({ toolName: toolKnowledge.toolName, id: toolKnowledge.id })
    .from(toolKnowledge);
  const existingNames = new Set(existingRows.map(r => r.toolName));
  const nameToId = new Map(existingRows.map(r => [r.toolName, r.id]));

  for (const tool of tools) {
    const name = tool.declaration.name;
    if (existingNames.has(name)) {
      l2Skipped++;
      continue;
    }
    try {
      const row = buildToolKnowledgeRow(tool);
      const [inserted] = await db.insert(toolKnowledge).values(row).returning({ id: toolKnowledge.id });
      nameToId.set(name, inserted.id);
      l2Inserted++;
    } catch (err: any) {
      l2Errors++;
      if (l2Errors <= 3) console.warn(`[ToolIndexer] L2 insert failed for ${name}:`, err.message);
    }
  }

  console.log(`[ToolIndexer] Layer 2 (tool_knowledge) — ${l2Inserted} inserted, ${l2Skipped} already exist, ${l2Errors} errors`);

  // ── Layer 3: tool_knowledge embeddings ───────────────────────────────────────
  let l3Indexed = 0, l3Skipped = 0, l3Errors = 0;

  // Fetch existing tool_knowledge embeddings
  const existingEmbedIds = new Set(
    (await db
      .select({ memoryId: memoryEmbeddings.memoryId })
      .from(memoryEmbeddings)
      .where(eq(memoryEmbeddings.memoryType, MEMORY_TYPE_KNOWLEDGE))
    ).map(r => r.memoryId)
  );

  // Fetch full rows for any tool that needs an embedding
  const toolsNeedingEmbedding = tools.filter(t => {
    const id = nameToId.get(t.declaration.name);
    return id && !existingEmbedIds.has(id);
  });

  if (toolsNeedingEmbedding.length > 0) {
    const idsNeeded = toolsNeedingEmbedding
      .map(t => nameToId.get(t.declaration.name))
      .filter(Boolean) as string[];

    const fullRows = await db
      .select({ id: toolKnowledge.id, toolName: toolKnowledge.toolName, purpose: toolKnowledge.purpose, syntax: toolKnowledge.syntax, bestUsedFor: toolKnowledge.bestUsedFor })
      .from(toolKnowledge)
      .where(inArray(toolKnowledge.id, idsNeeded));

    for (const row of fullRows) {
      try {
        const embedText = formatKnowledgeRowForEmbedding(
          row.toolName,
          row.purpose,
          row.syntax,
          row.bestUsedFor as string[] | null,
        );
        const isNew = await generateAndStoreEmbedding(
          MEMORY_TYPE_KNOWLEDGE,
          row.id,
          null,   // globally scoped
          embedText,
          1.0,
        );
        if (isNew) l3Indexed++; else l3Skipped++;
      } catch (err: any) {
        l3Errors++;
        if (l3Errors <= 3) console.warn(`[ToolIndexer] L3 embed failed for ${row.toolName}:`, err.message);
      }
    }
  }

  // Pin all tool_knowledge embeddings unconditionally — even when no new
  // embeddings were written this run, pre-existing rows may be un-pinned
  // (e.g. after a migration that reset the column).
  try {
    await db
      .update(memoryEmbeddings)
      .set({ pinned: true })
      .where(eq(memoryEmbeddings.memoryType, MEMORY_TYPE_KNOWLEDGE));
    console.log(`[ToolIndexer] Layer 3 pinning applied to all tool_knowledge embeddings`);
  } catch (err: any) {
    console.warn('[ToolIndexer] Could not pin tool_knowledge embeddings:', err.message);
  }

  console.log(`[ToolIndexer] Layer 3 (tool_knowledge embeds) — ${l3Indexed} indexed, ${l3Skipped} already fresh, ${l3Errors} errors`);
  if (l3Errors > 0) {
    console.error(`[ToolIndexer] WARNING: ${l3Errors} Layer-3 embedding error(s) — some tools may not be semantically searchable. Check logs above for details.`);
  }
  console.log(`[ToolIndexer] Pipeline complete — all 3 layers synced for ${tools.length} tools`);
}
