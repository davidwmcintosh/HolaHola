/**
 * Semantic Memory Service
 *
 * Provides embedding-based similarity search over Daniela's memory stores.
 * Uses Gemini text-embedding-004 (768-dimensional) vectors stored in the
 * memory_embeddings table. Cosine similarity computed in JavaScript so no
 * pgvector extension is needed.
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

import { GoogleGenAI } from '@google/genai';
import { createHash } from 'crypto';
import { getSharedDb } from '../db';
import { memoryEmbeddings } from '@shared/schema';
import { eq, and, or, isNull } from 'drizzle-orm';
import { computeDecayMultiplier } from './memory-decay-service';

const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_DIM = 768;

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

// ─── Gemini embedding API ─────────────────────────────────────────────────────

let genAI: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAI) genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '' });
  return genAI;
}

export async function embedText(text: string): Promise<number[]> {
  const ai = getGenAI();
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text.substring(0, 8192), // API limit
  });
  const values = response.embeddings?.[0]?.values;
  if (!values || values.length === 0) throw new Error('Gemini returned empty embedding');
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

/**
 * Find the top-k memories most semantically similar to the query string.
 * Loads all stored embeddings for the user (or all users if null), computes
 * cosine similarity in JS, and returns ranked results.
 *
 * Performance: 1000 embeddings × 768 dims → ~3MB loaded, ~5ms computation.
 * Fine for current scale; revisit if memory count grows past ~50k.
 */
export async function semanticSearch(
  userId: string,
  query: string,
  limit: number = 5,
  memoryTypes?: string[],
): Promise<SemanticSearchResult[]> {
  const db = getSharedDb();

  // Load embeddings for this student PLUS globally-scoped records (userId IS NULL).
  // Globally-scoped records include: Express Lane collaboration messages,
  // Daniela growth memories — content relevant to any session, not one student.
  const rows = await db
    .select({
      memoryType: memoryEmbeddings.memoryType,
      memoryId: memoryEmbeddings.memoryId,
      embedding: memoryEmbeddings.embedding,
      contentHash: memoryEmbeddings.contentHash,
      strength: memoryEmbeddings.strength,
      lastReinforcedAt: memoryEmbeddings.lastReinforcedAt,
      pinned: memoryEmbeddings.pinned,
    })
    .from(memoryEmbeddings)
    .where(or(
      eq(memoryEmbeddings.userId, userId),
      isNull(memoryEmbeddings.userId),
    ));

  if (rows.length === 0) return [];

  // Filter by type if requested
  const candidates = memoryTypes
    ? rows.filter(r => memoryTypes.includes(r.memoryType))
    : rows;

  if (candidates.length === 0) return [];

  // Embed the query
  const queryVec = await embedText(query);

  // Score all candidates — raw cosine for threshold, decayed score for ranking
  const scored = candidates.map(row => {
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
