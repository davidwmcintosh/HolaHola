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
import { memoryEmbeddings, learnerPersonalFacts } from '@shared/schema';
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

// ─── North Star principle embedding cache ─────────────────────────────────────

const NORTH_STAR_MEMORY_TYPE = 'north_star_principle';

/**
 * Return the embedding vector for a North Star principle, reading from the
 * memory_embeddings cache first.  If no cached entry exists (or the principle
 * text has changed since it was cached), the embedding is computed via OpenAI
 * and stored so future calls are free.
 *
 * Callers in processReachNorthStar should use this instead of calling
 * embedText(p.principle) directly — principles are static, so the embedding
 * never changes and should be paid for at most once.
 */
export async function getCachedPrincipleEmbedding(
  principleId: string,
  principleText: string,
): Promise<number[]> {
  const db = getSharedDb();
  const hash = hashContent(principleText);

  const [cached] = await db
    .select({ embedding: memoryEmbeddings.embedding, contentHash: memoryEmbeddings.contentHash })
    .from(memoryEmbeddings)
    .where(and(
      eq(memoryEmbeddings.memoryType, NORTH_STAR_MEMORY_TYPE),
      eq(memoryEmbeddings.memoryId, principleId),
    ))
    .limit(1);

  if (cached && cached.contentHash === hash) {
    // Cache hit — no OpenAI call needed
    return cached.embedding as number[];
  }

  // Cache miss or stale — compute and store
  const embedding = await embedText(principleText);

  if (cached) {
    await db
      .update(memoryEmbeddings)
      .set({ embedding, contentHash: hash, createdAt: new Date() })
      .where(and(
        eq(memoryEmbeddings.memoryType, NORTH_STAR_MEMORY_TYPE),
        eq(memoryEmbeddings.memoryId, principleId),
      ));
  } else {
    await db.insert(memoryEmbeddings).values({
      memoryType: NORTH_STAR_MEMORY_TYPE,
      memoryId: principleId,
      userId: null, // global — not per-student
      embedding,
      contentHash: hash,
      strength: 1.0,
    });
  }

  return embedding;
}

// ─── Search ───────────────────────────────────────────────────────────────────

// Global memory types that are always safe to include in student recall searches.
// collaboration_message is intentionally excluded from this default set — it is 23k+ rows
// of Hive messages that are only relevant for Express Lane / Hive-specific searches.
// Including it in every student memory recall loaded ~356MB of JSONB per call, causing
// the 10-second memory lookup delays observed in voice sessions.
// conversation_summary = sharp title+summary-only anchor per conversation_memory.
// conversation_chunk   = verbatim transcript slice (~1000 tokens) — every part of every
//   long conversation gets its own embedding so no moment is lost to token truncation.
const GLOBAL_RECALL_TYPES = ['daniela_tool', 'hive_snapshot', 'conversation_memory', 'conversation_summary', 'conversation_chunk', 'growth_memory', 'goal_capability', 'teaching_skill'];

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
      // Sort by pinned first, then by recency (lastReinforcedAt) rather than raw strength.
      // Raw strength is the un-decayed value — a memory reinforced 2 years ago but never
      // touched since can have strength=1.0 while a fresh memory has strength=0.2, causing
      // the stale memory to displace the fresh one in the 8000-row buffer BEFORE JS decay
      // is applied.  Using recency as the primary sort puts recently-active memories first
      // so they are never cut from the buffer by long-forgotten high-strength entries.
      .orderBy(desc(memoryEmbeddings.pinned), desc(memoryEmbeddings.lastReinforcedAt), desc(memoryEmbeddings.strength))
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
  // T001 Ghost Facts fix: post-filter expired personal facts.
  // memory_embeddings has no expiry field — once embedded, a fact lives in the
  // vector index forever even if invalidated via valid_to in learner_personal_facts.
  // This check removes stale entries before they reach the LLM.
  const aboveThreshold = scored.filter(r => r.similarity > 0.65);

  const personalFactIds = aboveThreshold
    .filter(r => r.memoryType === 'learner_personal_fact')
    .map(r => r.memoryId);

  let expiredIds = new Set<string>();
  if (personalFactIds.length > 0) {
    try {
      const db = getSharedDb();
      const now = new Date();
      const facts = await db
        .select({ id: learnerPersonalFacts.id, validTo: learnerPersonalFacts.validTo })
        .from(learnerPersonalFacts)
        .where(inArray(learnerPersonalFacts.id, personalFactIds));
      for (const fact of facts) {
        if (fact.validTo !== null && fact.validTo < now) {
          expiredIds.add(fact.id);
        }
      }
      if (expiredIds.size > 0) {
        console.log(`[SemanticSearch] Filtered ${expiredIds.size} expired personal fact(s) from results`);
      }
    } catch (err: any) {
      console.warn('[SemanticSearch] Ghost facts validity check failed — returning unfiltered:', err.message);
    }
  }

  return aboveThreshold
    .filter(r => !expiredIds.has(r.memoryId))
    .slice(0, limit)
    .map(r => ({ memoryType: r.memoryType, memoryId: r.memoryId, similarity: r.similarity, contentHash: r.contentHash }));
}

/**
 * Identical to semanticSearch but accepts a pre-computed query vector instead of a
 * text string.  Use this when the embedding is already known (e.g. from the North
 * Star principle cache) to avoid a redundant OpenAI API call.
 */
export async function semanticSearchByVector(
  userId: string,
  queryVec: number[],
  limit: number = 5,
  memoryTypes?: string[],
): Promise<SemanticSearchResult[]> {
  const db = getSharedDb();

  const wantsCollabMessages = memoryTypes?.includes('collaboration_message') ?? false;

  const userTypeCondition = memoryTypes && memoryTypes.length > 0
    ? inArray(memoryEmbeddings.memoryType, memoryTypes)
    : undefined;

  const globalTypes = memoryTypes && memoryTypes.length > 0
    ? (wantsCollabMessages ? memoryTypes : memoryTypes.filter(t => t !== 'collaboration_message'))
    : GLOBAL_RECALL_TYPES;

  const [userRows, globalRows] = await Promise.all([
    db
      .select(EMBED_SELECT)
      .from(memoryEmbeddings)
      .where(
        userTypeCondition
          ? and(eq(memoryEmbeddings.userId, userId), userTypeCondition)
          : eq(memoryEmbeddings.userId, userId),
      )
      .orderBy(desc(memoryEmbeddings.pinned), desc(memoryEmbeddings.lastReinforcedAt), desc(memoryEmbeddings.strength))
      .limit(8000),

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
      similarity,
      effectiveScore: similarity * decay,
    };
  });

  scored.sort((a, b) => b.effectiveScore - a.effectiveScore);

  const aboveThreshold = scored.filter(r => r.similarity > 0.65);

  // Ghost-facts expiry check (mirrors semanticSearch)
  const personalFactIds = aboveThreshold
    .filter(r => r.memoryType === 'learner_personal_fact')
    .map(r => r.memoryId);

  let expiredIds = new Set<string>();
  if (personalFactIds.length > 0) {
    try {
      const now = new Date();
      const facts = await db
        .select({ id: learnerPersonalFacts.id, validTo: learnerPersonalFacts.validTo })
        .from(learnerPersonalFacts)
        .where(inArray(learnerPersonalFacts.id, personalFactIds));
      for (const fact of facts) {
        if (fact.validTo !== null && fact.validTo < now) {
          expiredIds.add(fact.id);
        }
      }
    } catch { /* non-fatal — return unfiltered */ }
  }

  return aboveThreshold
    .filter(r => !expiredIds.has(r.memoryId))
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
