/**
 * Semantic Memory Service
 *
 * Provides embedding-based similarity search over Daniela's memory stores.
 * Uses OpenAI text-embedding-3-small (768-dimensional, via dimensions param)
 * stored in the memory_embeddings table. Cosine similarity computed in
 * JavaScript so no pgvector extension is needed.
 *
 * Advantages over keyword search (ILIKE / tsvector):
 * - Finds conceptually related memories without exact word match
 * - "spontaneity" surfaces "improvisation", "jazz", "going off-script"
 * - "pride" surfaces memories tagged "accomplishment", "breakthrough", "tears"
 * - Language-agnostic (Spanish and English queries find the same memory)
 *
 * Usage:
 *   const results = await semanticSearch(userId, 'his relationship with music', 5);
 */

import { createHash } from 'crypto';
import { getSharedDb } from '../db';
import { memoryEmbeddings } from '@shared/schema';
import { eq, and, or, isNull, inArray, desc } from 'drizzle-orm';
import { computeDecayMultiplier } from './memory-decay-service';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 768;
const OPENAI_EMBED_URL = 'https://api.openai.com/v1/embeddings';

export interface SemanticSearchResult {
  memoryType: string;
  memoryId: string;
  similarity: number; // 0-1 cosine similarity
  contentHash: string;
}

// ─── Core math ────────────────────────────────────────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 64);
}

// ─── OpenAI embedding API ─────────────────────────────────────────────────────

function getEmbedApiKey(): string {
  // USER_OPENAI_API_KEY is a valid direct OpenAI key; OPENAI_API_KEY may be
  // a managed/proxy key that doesn't support the embeddings endpoint.
  return process.env.USER_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
}

export async function embedText(text: string): Promise<number[]> {
  const apiKey = getEmbedApiKey();
  if (!apiKey) throw new Error('No OpenAI API key available for embeddings');

  const res = await fetch(OPENAI_EMBED_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.substring(0, 8192),
      dimensions: EMBEDDING_DIM,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embedding failed (${res.status}): ${err}`);
  }

  const json = await res.json() as { data: { embedding: number[] }[] };
  const values = json.data?.[0]?.embedding;
  if (!values || values.length === 0) throw new Error('OpenAI returned empty embedding');
  return values;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

/**
 * Generate and store an embedding for a single memory.
 * Idempotent: skips if an embedding with matching contentHash already exists.
 * Returns true if a new embedding was generated, false if skipped.
 */
export async function generateAndStoreEmbedding(
  memoryType: string,
  memoryId: string,
  userId: string | null,
  content: string,
  initialStrength?: number,
): Promise<boolean> {
  const db = getSharedDb();
  const hash = hashContent(content);

  // Check if already up-to-date
  const existing = await db
    .select({ contentHash: memoryEmbeddings.contentHash })
    .from(memoryEmbeddings)
    .where(and(
      eq(memoryEmbeddings.memoryType, memoryType),
      eq(memoryEmbeddings.memoryId, memoryId),
    ))
    .limit(1);

  if (existing.length > 0 && existing[0].contentHash === hash) {
    return false; // Already fresh
  }

  const embedding = await embedText(content);

  if (existing.length > 0) {
    // Update stale embedding
    await db
      .update(memoryEmbeddings)
      .set({ embedding, contentHash: hash, createdAt: new Date() })
      .where(and(
        eq(memoryEmbeddings.memoryType, memoryType),
        eq(memoryEmbeddings.memoryId, memoryId),
      ));
  } else {
    // Insert new — use initialStrength if provided (confidence calibration)
    await db.insert(memoryEmbeddings).values({
      memoryType,
      memoryId,
      userId,
      embedding,
      contentHash: hash,
      strength: Math.min(1.0, Math.max(0.05, initialStrength ?? 1.0)),
    });
  }
  return true;
}

// ─── Search ───────────────────────────────────────────────────────────────────

// Global memory types that are always safe to include in student recall searches.
// collaboration_message is intentionally excluded from this default set — it is 23k+ rows
// of Hive messages that are only relevant for Express Lane / Hive-specific searches.
// Including it in every student memory recall loaded ~356MB of JSONB per call, causing
// the 10-second memory lookup delays observed in voice sessions.
const GLOBAL_RECALL_TYPES = ['daniela_tool', 'hive_snapshot', 'conversation_memory', 'growth_memory', 'goal_capability'];

const EMBED_SELECT = {
  memoryType: memoryEmbeddings.memoryType,
  memoryId: memoryEmbeddings.memoryId,
  embedding: memoryEmbeddings.embedding,
  contentHash: memoryEmbeddings.contentHash,
  strength: memoryEmbeddings.strength,
  lastReinforcedAt: memoryEmbeddings.lastReinforcedAt,
  pinned: memoryEmbeddings.pinned,
} as const;

/**
 * Find the top-k memories most semantically similar to the query string.
 *
 * Runs two parallel queries — user-specific records + global records — then
 * merges and scores with cosine similarity + decay weighting.
 *
 * Performance notes:
 *   - User-specific: capped at 8000 rows, ordered by pinned → strength → recency.
 *   - Global: only safe, small types loaded by default (191 rows).
 *     collaboration_message (23k+ rows) is excluded unless explicitly requested
 *     via memoryTypes — loading it for every recall caused ~10s delays.
 *   - Type filter is pushed into SQL (not applied post-load).
 */
export async function semanticSearch(
  userId: string,
  query: string,
  limit: number = 5,
  memoryTypes?: string[],
): Promise<SemanticSearchResult[]> {
  const db = getSharedDb();

  const wantsCollabMessages = memoryTypes?.includes('collaboration_message') ?? false;

  // SQL-level type filter for user rows (push-down avoids loading irrelevant types)
  const userTypeCondition = memoryTypes && memoryTypes.length > 0
    ? inArray(memoryEmbeddings.memoryType, memoryTypes)
    : undefined;

  // Global types: use explicit list when provided, otherwise use safe defaults
  // (excludes collaboration_message unless caller specifically asked for it)
  const globalTypes = memoryTypes && memoryTypes.length > 0
    ? (wantsCollabMessages ? memoryTypes : memoryTypes.filter(t => t !== 'collaboration_message'))
    : GLOBAL_RECALL_TYPES;

  // Run both queries in parallel
  const [userRows, globalRows] = await Promise.all([
    // User-specific: ordered by pinned → strength → recency, capped at 8000
    db
      .select(EMBED_SELECT)
      .from(memoryEmbeddings)
      .where(
        userTypeCondition
          ? and(eq(memoryEmbeddings.userId, userId), userTypeCondition)
          : eq(memoryEmbeddings.userId, userId),
      )
      .orderBy(desc(memoryEmbeddings.pinned), desc(memoryEmbeddings.strength), desc(memoryEmbeddings.lastReinforcedAt))
      .limit(8000),

    // Global (userId IS NULL): only safe types unless collaboration explicitly requested
    globalTypes.length > 0
      ? db
        .select(EMBED_SELECT)
        .from(memoryEmbeddings)
        .where(and(
          isNull(memoryEmbeddings.userId),
          inArray(memoryEmbeddings.memoryType, globalTypes),
        ))
        .orderBy(desc(memoryEmbeddings.pinned), desc(memoryEmbeddings.strength))
        .limit(1000)
      : Promise.resolve([]),
  ]);

  const rows = [...userRows, ...globalRows];
  if (rows.length === 0) return [];

  // Embed the query
  const queryVec = await embedText(query);

  // Score all candidates — raw cosine for threshold, decayed score for ranking
  const scored = rows.map(row => {
    const similarity = cosineSimilarity(queryVec, row.embedding as number[]);
    const decay = computeDecayMultiplier(
      row.strength ?? 1.0,
      row.lastReinforcedAt ?? null,
      row.pinned ?? false,
    );
    return {
      memoryType: row.memoryType,
      memoryId: row.memoryId,
      contentHash: row.contentHash,
      similarity,               // raw cosine — used for threshold checks by callers
      effectiveScore: similarity * decay, // decay-weighted — used for ranking only
    };
  });

  // Sort by effective score (recently reinforced memories rank higher at equal relevance).
  // Threshold applied to raw cosine so highly relevant but faded memories still pass.
  scored.sort((a, b) => b.effectiveScore - a.effectiveScore);
  return scored
    .filter(r => r.similarity > 0.65)
    .slice(0, limit)
    .map(r => ({ memoryType: r.memoryType, memoryId: r.memoryId, similarity: r.similarity, contentHash: r.contentHash }));
}

/**
 * Find memories that are semantically connected to a source memory.
 * Uses the source memory's stored embedding vector directly — no new AI call needed.
 * This surfaces the associative structure already latent in the embedding space.
 *
 * Returns up to `limit` connected memories sorted by raw cosine similarity (no decay
 * weighting — for association we want the structural connection, not recency).
 */
export async function findConnectedMemories(
  userId: string,
  sourceMemoryId: string,
  sourceMemoryType: string = 'conversation_memory',
  limit: number = 5,
): Promise<Array<{ memoryId: string; memoryType: string; similarity: number }>> {
  const db = getSharedDb();

  const [source] = await db
    .select({ embedding: memoryEmbeddings.embedding })
    .from(memoryEmbeddings)
    .where(and(
      eq(memoryEmbeddings.memoryId, sourceMemoryId),
      eq(memoryEmbeddings.memoryType, sourceMemoryType),
    ))
    .limit(1);

  if (!source?.embedding) return [];

  const sourceVec = source.embedding as number[];

  const [userRows, globalRows] = await Promise.all([
    db.select(EMBED_SELECT)
      .from(memoryEmbeddings)
      .where(eq(memoryEmbeddings.userId, userId))
      .orderBy(desc(memoryEmbeddings.strength), desc(memoryEmbeddings.lastReinforcedAt))
      .limit(8000),
    db.select(EMBED_SELECT)
      .from(memoryEmbeddings)
      .where(and(
        isNull(memoryEmbeddings.userId),
        inArray(memoryEmbeddings.memoryType, GLOBAL_RECALL_TYPES),
      ))
      .limit(1000),
  ]);

  const rows = [...userRows, ...globalRows].filter(r => r.memoryId !== sourceMemoryId);
  if (rows.length === 0) return [];

  const scored = rows.map(row => ({
    memoryType: row.memoryType,
    memoryId: row.memoryId,
    similarity: cosineSimilarity(sourceVec, row.embedding as number[]),
  }));

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored
    .filter(r => r.similarity > 0.6)
    .slice(0, limit);
}
