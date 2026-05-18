/**
 * Memory Embedding Indexer
 *
 * Background worker that generates Gemini text-embedding-004 vectors for all
 * memory records that don't yet have an embedding. Runs every 2 hours.
 *
 * Covers four memory stores:
 *   - student_insights       (deep observations, confidence-scored)
 *   - hive_snapshots         (relationship_moment, session_summary, breakthrough, teaching_moment)
 *   - daniela_growth_memories (Daniela's own pedagogical learnings)
 *   - learner_personal_facts  (bi-temporal personal facts)
 *
 * Safe to run repeatedly — generateAndStoreEmbedding() is idempotent and skips
 * memories whose content hasn't changed since the last run.
 *
 * Rate limiting: 10 embeddings per batch, 600ms pause between batches.
 * Gemini text-embedding-004 free tier: 1500 RPM, well within budget.
 */

import { getSharedDb } from '../db';
import {
  studentInsights,
  hiveSnapshots,
  danielaGrowthMemories,
  learnerPersonalFacts,
  collaborationMessages,
  memoryEmbeddings,
  conversationMemories,
  users,
} from '@shared/schema';
import { eq, notExists, sql } from 'drizzle-orm';
import { generateAndStoreEmbedding } from './semantic-memory-service';

const BATCH_SIZE = 10;
const BATCH_PAUSE_MS = 600;
const INDEXER_INTERVAL_MS = 2 * 60 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface IndexTarget {
  id: string;
  userId: string | null;
  content: string;
  memoryType: string;
  initialStrength?: number;
}

async function collectUnindexedMemories(): Promise<IndexTarget[]> {
  const db = getSharedDb();
  const targets: IndexTarget[] = [];

  // Helper: check if embedding exists for a (type, id) pair
  const hasEmbedding = (type: string, idCol: any) =>
    db.select({ id: memoryEmbeddings.id })
      .from(memoryEmbeddings)
      .where(
        sql`memory_type = ${type} AND memory_id = ${idCol}`
      );

  // student_insights — observationCount feeds initial embedding strength
  try {
    const rows = await db
      .select({
        id: studentInsights.id,
        userId: studentInsights.studentId,
        content: studentInsights.insight,
        observationCount: studentInsights.observationCount,
      })
      .from(studentInsights)
      .where(
        notExists(
          db.select({ x: memoryEmbeddings.id })
            .from(memoryEmbeddings)
            .where(sql`memory_type = 'student_insight' AND memory_id = ${studentInsights.id}`)
        )
      )
      .limit(200);
    for (const r of rows) {
      if (r.content) targets.push({
        id: r.id, userId: r.userId, content: r.content, memoryType: 'student_insight',
        initialStrength: Math.min(1.0, 0.7 + (r.observationCount ?? 1) * 0.06),
      });
    }
  } catch (err: any) {
    console.warn('[EmbedIndexer] student_insights scan failed:', err.message);
  }

  // hive_snapshots (only high-signal types)
  try {
    const rows = await db
      .select({
        id: hiveSnapshots.id,
        userId: hiveSnapshots.userId,
        title: hiveSnapshots.title,
        content: hiveSnapshots.content,
      })
      .from(hiveSnapshots)
      .where(sql`
        snapshot_type IN ('relationship_moment', 'session_summary', 'breakthrough', 'teaching_moment', 'life_context')
        AND NOT EXISTS (
          SELECT 1 FROM memory_embeddings
          WHERE memory_type = 'hive_snapshot' AND memory_id = ${hiveSnapshots.id}
        )
      `)
      .limit(200);
    for (const r of rows) {
      const content = [r.title, r.content].filter(Boolean).join('. ');
      if (content.trim().length > 10) {
        targets.push({ id: r.id, userId: r.userId, content, memoryType: 'hive_snapshot' });
      }
    }
  } catch (err: any) {
    console.warn('[EmbedIndexer] hive_snapshots scan failed:', err.message);
  }

  // daniela_growth_memories
  try {
    const rows = await db
      .select({
        id: danielaGrowthMemories.id,
        content: danielaGrowthMemories.content,
      })
      .from(danielaGrowthMemories)
      .where(sql`
        NOT EXISTS (
          SELECT 1 FROM memory_embeddings
          WHERE memory_type = 'growth_memory' AND memory_id = ${danielaGrowthMemories.id}
        )
      `)
      .limit(100);
    for (const r of rows) {
      if (r.content) targets.push({ id: r.id, userId: null, content: r.content, memoryType: 'growth_memory' });
    }
  } catch (err: any) {
    console.warn('[EmbedIndexer] growth_memories scan failed:', err.message);
  }

  // learner_personal_facts — mentionCount feeds initial embedding strength
  try {
    const rows = await db
      .select({
        id: learnerPersonalFacts.id,
        studentId: learnerPersonalFacts.studentId,
        fact: learnerPersonalFacts.fact,
        context: learnerPersonalFacts.context,
        mentionCount: learnerPersonalFacts.mentionCount,
      })
      .from(learnerPersonalFacts)
      .where(sql`
        is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM memory_embeddings
          WHERE memory_type = 'personal_fact' AND memory_id = ${learnerPersonalFacts.id}
        )
      `)
      .limit(200);
    for (const r of rows) {
      const content = [r.fact, r.context].filter(Boolean).join('. ');
      if (content.trim().length > 5) {
        targets.push({
          id: r.id, userId: r.studentId, content, memoryType: 'personal_fact',
          initialStrength: Math.min(1.0, 0.7 + (r.mentionCount ?? 1) * 0.06),
        });
      }
    }
  } catch (err: any) {
    console.warn('[EmbedIndexer] personal_facts scan failed:', err.message);
  }

  // collaboration_messages (Express Lane) — founder/Daniela/team messages
  // Stored with userId = null (globally-scoped, not per-student).
  // semanticSearch() includes userId IS NULL records so these surface in all sessions.
  try {
    const rows = await db
      .select({
        id: collaborationMessages.id,
        role: collaborationMessages.role,
        content: collaborationMessages.content,
      })
      .from(collaborationMessages)
      .where(sql`
        NOT EXISTS (
          SELECT 1 FROM memory_embeddings
          WHERE memory_type = 'collaboration_message' AND memory_id = ${collaborationMessages.id}
        )
        AND length(content) > 20
      `)
      .limit(300);
    for (const r of rows) {
      // Prepend role so the embedding captures speaker context ("founder: ..." vs "daniela: ...")
      const content = `${r.role}: ${r.content}`;
      targets.push({ id: r.id, userId: null, content, memoryType: 'collaboration_message' });
    }
  } catch (err: any) {
    console.warn('[EmbedIndexer] collaboration_messages scan failed:', err.message);
  }

  // conversation_memories — full narrative memories of meaningful sessions
  // These are the richest memories: full transcripts, breakthrough moments, the podcast.
  // No userId scoping — these are global shared history between David and Daniela.
  try {
    const db = getSharedDb();
    const rows = await db
      .select({
        id: conversationMemories.id,
        title: conversationMemories.title,
        content: conversationMemories.content,
        importance: conversationMemories.importance,
      })
      .from(conversationMemories)
      .where(sql`
        NOT EXISTS (
          SELECT 1 FROM memory_embeddings
          WHERE memory_type = 'conversation_memory' AND memory_id = ${conversationMemories.id}
        )
      `)
      .limit(100);
    for (const r of rows) {
      const content = [r.title, r.content].filter(Boolean).join('\n\n');
      if (content.trim().length > 10) {
        targets.push({
          id: r.id,
          userId: null,
          content,
          memoryType: 'conversation_memory',
          // importance maps to initial strength: 10→1.0, 7→0.7, etc.
          initialStrength: Math.min(1.0, (r.importance ?? 7) / 10),
        });
      }
    }
  } catch (err: any) {
    console.warn('[EmbedIndexer] conversation_memories scan failed:', err.message);
  }

  return targets;
}

async function runIndexer(): Promise<void> {
  const targets = await collectUnindexedMemories();

  if (targets.length === 0) {
    console.log('[EmbedIndexer] All memories already indexed');
    return;
  }

  console.log(`[EmbedIndexer] Indexing ${targets.length} new memories...`);

  let generated = 0;
  let errors = 0;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (t) => {
        try {
          const isNew = await generateAndStoreEmbedding(t.memoryType, t.id, t.userId, t.content, t.initialStrength);
          if (isNew) generated++;
        } catch (err: any) {
          errors++;
          if (errors <= 3) {
            console.warn(`[EmbedIndexer] Failed to embed ${t.memoryType}/${t.id}:`, err.message);
          }
        }
      })
    );

    if (i + BATCH_SIZE < targets.length) {
      await sleep(BATCH_PAUSE_MS);
    }
  }

  console.log(`[EmbedIndexer] Done — generated: ${generated}, errors: ${errors}, already fresh: ${targets.length - generated - errors}`);
}

/**
 * Post-session incremental indexer.
 * Embeds only the newest student_insights and personal_facts for one user
 * (records created in the last 15 minutes that have no embedding yet).
 * Called immediately after memory extraction at session end so new memories
 * are semantically searchable within the same session — not 2 hours later.
 */
export async function indexNewMemoriesForUser(userId: string): Promise<void> {
  const db = getSharedDb();
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
  const targets: IndexTarget[] = [];

  try {
    const rows = await db
      .select({
        id: studentInsights.id,
        insight: studentInsights.insight,
        details: studentInsights.details,
        category: studentInsights.category,
        observationCount: studentInsights.observationCount,
      })
      .from(studentInsights)
      .where(sql`
        student_id = ${userId}
        AND created_at >= ${fifteenMinsAgo}
        AND NOT EXISTS (
          SELECT 1 FROM memory_embeddings
          WHERE memory_type = 'student_insight' AND memory_id = ${studentInsights.id}
        )
      `)
      .limit(20);
    for (const r of rows) {
      const content = [r.insight, r.details, r.category].filter(Boolean).join('. ');
      if (content.trim().length > 5) targets.push({
        id: r.id, userId, content, memoryType: 'student_insight',
        initialStrength: Math.min(1.0, 0.7 + (r.observationCount ?? 1) * 0.06),
      });
    }
  } catch (err: any) {
    console.warn('[PostSessionIndex] student_insights scan failed:', err.message);
  }

  try {
    const rows = await db
      .select({
        id: learnerPersonalFacts.id,
        fact: learnerPersonalFacts.fact,
        context: learnerPersonalFacts.context,
        mentionCount: learnerPersonalFacts.mentionCount,
      })
      .from(learnerPersonalFacts)
      .where(sql`
        student_id = ${userId}
        AND is_active = true
        AND created_at >= ${fifteenMinsAgo}
        AND NOT EXISTS (
          SELECT 1 FROM memory_embeddings
          WHERE memory_type = 'personal_fact' AND memory_id = ${learnerPersonalFacts.id}
        )
      `)
      .limit(20);
    for (const r of rows) {
      const content = [r.fact, r.context].filter(Boolean).join('. ');
      if (content.trim().length > 5) targets.push({
        id: r.id, userId, content, memoryType: 'personal_fact',
        initialStrength: Math.min(1.0, 0.7 + (r.mentionCount ?? 1) * 0.06),
      });
    }
  } catch (err: any) {
    console.warn('[PostSessionIndex] personal_facts scan failed:', err.message);
  }

  if (targets.length === 0) {
    console.log(`[PostSessionIndex] Nothing new to index for user ${userId}`);
    return;
  }

  console.log(`[PostSessionIndex] Indexing ${targets.length} new record(s) for user ${userId}...`);
  let indexed = 0;
  for (const t of targets) {
    try {
      const isNew = await generateAndStoreEmbedding(t.memoryType, t.id, t.userId, t.content, t.initialStrength);
      if (isNew) indexed++;
    } catch (err: any) {
      console.warn(`[PostSessionIndex] Failed to embed ${t.memoryType}/${t.id}:`, err.message);
    }
  }
  console.log(`[PostSessionIndex] Done — ${indexed} new embedding(s) stored for user ${userId}`);
}

export function startMemoryEmbeddingIndexer(): void {
  console.log('[EmbedIndexer] Starting (interval: 2h)');

  // Boot run after 100 seconds (embeddings are a background enrichment, not blocking)
  setTimeout(() => {
    runIndexer().catch(err =>
      console.error('[EmbedIndexer] Boot run failed:', err.message)
    );
  }, 100000);

  setInterval(() => {
    runIndexer().catch(err =>
      console.error('[EmbedIndexer] Periodic run failed:', err.message)
    );
  }, INDEXER_INTERVAL_MS);
}
