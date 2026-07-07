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

// Chunking constants — ~1000 tokens per chunk, ~200 token overlap
const CHUNK_CHARS = 4500;
const OVERLAP_CHARS = 900;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * SPEAKER ATTRIBUTION FORMAT (June 2026 — Gemini-recommended "Script-Naturalist" format):
 * Transforms bracketed timestamp headers into inline NAME (Date): prefixes.
 *
 * Before: [Jan 20, 2026, 03:27 AM — DANIELA]
 * After:  DANIELA (Jan 20, 2026 — 03:27 AM):
 *
 * Why: LLMs treat [brackets] as metadata/log markers (attention weakens across them).
 * Putting the speaker name FIRST in a NAME (Date): pattern matches screenplay/chat
 * training data — the strongest pattern-match for speaker attribution.
 * Applied at chunk-storage time AND at retrieval time (neural-memory-search.ts)
 * so both new and existing indexed chunks get the better format.
 */
export function reformatSpeakerHeaders(text: string): string {
  return text.replace(
    /\[([A-Z][a-z]{2} \d{1,2}, \d{4})(?:, (\d{1,2}:\d{2} (?:AM|PM)))? — ([A-Z]+)\]/g,
    (_match, date: string, time: string | undefined, speaker: string) => {
      const timePart = time ? ` — ${time}` : '';
      return `${speaker} (${date}${timePart}):`;
    }
  );
}

/**
 * Split text into overlapping chunks for verbatim semantic indexing.
 * Tries to snap chunk boundaries to sentence endings (newline or ". ")
 * so chunks don't cut mid-sentence.
 *
 * SPEAKER ATTRIBUTION FIX: Chunk starts are snapped to the nearest turn header
 * "[Date — SPEAKER]" so every chunk begins at a clear speaker boundary. Without
 * this, chunks starting mid-turn cause Daniela to misattribute quotes (e.g.,
 * saying David made a joke that she actually made).
 */
export function splitIntoChunks(text: string, chunkSize: number = CHUNK_CHARS, overlap: number = OVERLAP_CHARS): string[] {
  if (text.length <= chunkSize) return [text];

  // Regex that matches turn headers like "[Jan 20, 2026, 03:27 AM — DANIELA]"
  // or "[Jun 18, 2026, 07:00 PM — DAVID]" — any "[" followed by a date-like prefix.
  const TURN_HEADER_RE = /\[[A-Z][a-z]{2} \d{1,2}, \d{4}/g;

  /**
   * Given a position inside the text, scan forward up to maxScan chars for
   * the next turn header. Returns the position of the "[" if found, else -1.
   */
  function nextTurnHeader(pos: number, maxScan: number = 800): number {
    TURN_HEADER_RE.lastIndex = pos;
    const m = TURN_HEADER_RE.exec(text);
    if (m && m.index < pos + maxScan) return m.index;
    return -1;
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    // Snap END to a sentence boundary in the final 20% of the chunk
    if (end < text.length) {
      const snapZoneStart = start + Math.floor(chunkSize * 0.8);
      const searchStr = text.slice(snapZoneStart, Math.min(end + 200, text.length));
      const snapOffset = Math.max(searchStr.lastIndexOf('\n'), searchStr.lastIndexOf('. '));
      if (snapOffset > 0) end = snapZoneStart + snapOffset + 1;
    }

    chunks.push(text.slice(start, end));

    // Move start back by overlap, then snap FORWARD to the next turn header so
    // the following chunk never starts mid-speaker-turn.
    const rawNext = end - overlap;
    if (rawNext <= 0 || rawNext >= text.length) break;

    const headerPos = nextTurnHeader(rawNext);
    // Use the header snap only if it's within a reasonable distance; otherwise
    // use the raw overlap position to avoid giant un-indexed gaps.
    start = (headerPos > 0 && headerPos < rawNext + 1200) ? headerPos : rawNext;
    if (start >= text.length) break;
  }
  return chunks;
}

interface IndexTarget {
  id: string;
  userId: string | null;
  content: string;
  // When set, content is loaded lazily (one at a time) instead of held in RAM.
  // The caller sets content = '' and runIndexer() resolves this before embedding.
  contentLoader?: () => Promise<string>;
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
        lesson: danielaGrowthMemories.lesson,
        title: danielaGrowthMemories.title,
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
      // Combine title + lesson into the embeddable content string
      const content = [r.title, r.lesson].filter(Boolean).join('. ');
      if (content) targets.push({ id: r.id, userId: null, content, memoryType: 'growth_memory' });
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
  //
  // Two embeddings per entry:
  //   1. conversation_memory  — title + summary + full content (summary first so it survives token truncation)
  //   2. conversation_summary — title + summary only (~200 tokens, sharp keyword anchor, no truncation risk)
  //
  // The summary embedding is the key fix for "summarization loss": specific words like "toy" or "juguete"
  // appear prominently in the distilled summary but get diluted in the full-transcript vector.
  // Semantic search now hits both vectors, so a targeted query ("toy") finds the summary anchor
  // even when the full-content vector misses it.
  try {
    const db = getSharedDb();

    // Arm A: full-content embeddings for not-yet-indexed conversations only.
    // LAZY LOADING: fetch IDs + metadata only here (no content), content is loaded
    // one-at-a-time in runIndexer() via contentLoader to avoid bulk RAM usage.
    // Some conversation_memories entries are 146KB+ — loading 50 at once was OOM.
    const fullRows = await db
      .select({
        id: conversationMemories.id,
        title: conversationMemories.title,
        summary: conversationMemories.summary,
        importance: conversationMemories.importance,
      })
      .from(conversationMemories)
      .where(sql`
        NOT EXISTS (
          SELECT 1 FROM memory_embeddings
          WHERE memory_type = 'conversation_memory' AND memory_id = ${conversationMemories.id}
        )
      `)
      .limit(200);
    for (const r of fullRows) {
      const rowId = r.id;
      const rowTitle = r.title;
      const rowSummary = r.summary;
      const strength = Math.min(1.0, (r.importance ?? 7) / 10);
      targets.push({
        id: rowId,
        userId: null,
        content: '',
        // Content is fetched lazily in runIndexer() — one at a time to avoid OOM.
        // Summary goes BEFORE content so keyword-rich anchor survives token truncation.
        contentLoader: async () => {
          const dbInner = getSharedDb();
          const row = await dbInner
            .select({ content: conversationMemories.content })
            .from(conversationMemories)
            .where(sql`${conversationMemories.id} = ${rowId}`)
            .limit(1);
          const fullContent = row[0]?.content ?? '';
          return [rowTitle, rowSummary, fullContent].filter(Boolean).join('\n\n');
        },
        memoryType: 'conversation_memory',
        initialStrength: strength,
      });
    }

    // Arm B: summary-only anchor embeddings — sharp, keyword-rich, never truncated
    const summaryRows = await db
      .select({
        id: conversationMemories.id,
        title: conversationMemories.title,
        summary: conversationMemories.summary,
        importance: conversationMemories.importance,
      })
      .from(conversationMemories)
      .where(sql`
        NOT EXISTS (
          SELECT 1 FROM memory_embeddings
          WHERE memory_type = 'conversation_summary' AND memory_id = ${conversationMemories.id}
        )
        AND ${conversationMemories.summary} IS NOT NULL
        AND length(${conversationMemories.summary}) > 10
      `)
      .limit(200);
    for (const r of summaryRows) {
      const summaryContent = [r.title, r.summary].filter(Boolean).join('\n\n');
      targets.push({
        id: r.id,
        userId: null,
        content: summaryContent,
        memoryType: 'conversation_summary',
        initialStrength: Math.min(1.0, (r.importance ?? 7) / 10),
      });
    }

    // Arm C: verbatim content chunks — the heart of the fix.
    // For conversations longer than CHUNK_CHARS, the full transcript is sliced into
    // overlapping segments (~1000 tokens each). Every segment gets its own embedding,
    // pointing back to the parent conversation_memory via a stable chunk ID.
    //
    // This guarantees that EVERY moment of every conversation is semantically searchable
    // regardless of where it falls in the transcript — a 3 AM remark at token 12000
    // surfaces just as easily as the opening line.
    //
    // Performance note: content is fetched per-conversation (not in bulk) to avoid
    // pulling megabytes of data in one query. Some conversations are 100KB+ so the
    // bulk approach caused query timeouts.
    const unchunkedIds = await db
      .select({
        id: conversationMemories.id,
        title: conversationMemories.title,
        importance: conversationMemories.importance,
      })
      .from(conversationMemories)
      .where(sql`
        length(${conversationMemories.content}) > ${CHUNK_CHARS}
        AND NOT EXISTS (
          SELECT 1 FROM memory_embeddings
          WHERE memory_type = 'conversation_chunk'
          AND memory_id = (${conversationMemories.id}::text || ':chunk:0')
        )
      `)
      .limit(20);

    for (const r of unchunkedIds) {
      const contentRow = await db
        .select({ content: conversationMemories.content })
        .from(conversationMemories)
        .where(sql`id = ${r.id}`)
        .limit(1);
      const content = contentRow[0]?.content;
      if (!content) continue;

      const chunks = splitIntoChunks(content);
      const total = chunks.length;

      // Fetch existing chunks for this conversation only (targeted, not all chunks)
      const existingForThis = new Set(
        (await db
          .select({ memoryId: memoryEmbeddings.memoryId })
          .from(memoryEmbeddings)
          .where(sql`memory_type = 'conversation_chunk' AND memory_id LIKE ${r.id + ':chunk:%'}`)
        ).map(row => row.memoryId)
      );

      for (let i = 0; i < total; i++) {
        const chunkId = `${r.id}:chunk:${i}`;
        if (existingForThis.has(chunkId)) continue;
        const chunkContent = `[Memory: ${r.title ?? 'Untitled'} | Part ${i + 1} of ${total}]\n\n${reformatSpeakerHeaders(chunks[i])}`;
        targets.push({
          id: chunkId,
          userId: null,
          content: chunkContent,
          memoryType: 'conversation_chunk',
          initialStrength: Math.min(1.0, (r.importance ?? 7) / 10),
        });
      }
    }
  } catch (err: any) {
    console.warn('[EmbedIndexer] conversation_memories scan failed:', err.message);
  }

  return targets;
}

/**
 * Incremental message archive step.
 *
 * On each 2h indexer run, picks up to 30 conversations from the messages table
 * that don't yet have a conversation_memories entry tagged 'message-archive'.
 * Creates those entries so collectUnindexedMemories() can embed them on the
 * same or next run.
 *
 * This keeps the archive current without requiring a separate cron job.
 * The one-time backfill script (index-message-archive.ts) seeds the bulk;
 * this function handles all conversations going forward.
 */
async function archiveUnindexedConversations(): Promise<number> {
  const db = getSharedDb();
  const MIN_MESSAGES = 3;
  const PER_RUN_LIMIT = 30;

  let archived = 0;
  try {
    const result = await db.execute(sql`
      SELECT
        c.id,
        c.title,
        c.language,
        c.created_at,
        COUNT(m.id) AS msg_count
      FROM conversations c
      JOIN messages m ON m.conversation_id = c.id
      WHERE NOT EXISTS (
        SELECT 1
        FROM conversation_memories cm
        WHERE 'message-archive' = ANY(cm.tags)
          AND c.id = ANY(cm.tags)
      )
      GROUP BY c.id, c.title, c.language, c.created_at
      HAVING COUNT(m.id) >= ${MIN_MESSAGES}
      ORDER BY c.created_at DESC
      LIMIT ${PER_RUN_LIMIT}
    `);

    const rows = result.rows as Array<{
      id: string;
      title: string | null;
      language: string | null;
      created_at: Date | string;
      msg_count: string;
    }>;

    for (const conv of rows) {
      try {
        const msgsResult = await db.execute(sql`
          SELECT role, content, created_at
          FROM messages
          WHERE conversation_id = ${conv.id}
          ORDER BY created_at ASC
        `);
        const messages = msgsResult.rows as Array<{ role: string; content: string; created_at: Date | string }>;
        if (messages.length < MIN_MESSAGES) continue;

        const transcript = messages.map(m => {
          const speaker = m.role === 'assistant' ? 'DANIELA' : m.role.toUpperCase();
          const d = m.created_at ? new Date(m.created_at) : new Date();
          const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          return `[${dateStr}, ${timeStr} — ${speaker}]\n${m.content}`;
        }).join('\n\n');

        const lang = conv.language ? conv.language.charAt(0).toUpperCase() + conv.language.slice(1) : 'Language';
        const d = new Date(conv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const title = (conv.title && conv.title.trim().length > 3)
          ? conv.title.trim()
          : `${lang} session — ${d} (${messages.length} messages)`;
        const firstStudent = messages.find(m => m.role === 'user');
        const summary = firstStudent
          ? `${lang} session (${messages.length} messages). Student: "${firstStudent.content.slice(0, 120)}"`
          : `${lang} session with ${messages.length} messages.`;

        await db.execute(sql`
          INSERT INTO conversation_memories
            (id, recorded_at, title, summary, content, tags, importance, entry_type, arc_name, created_at)
          VALUES
            (gen_random_uuid(), ${new Date(conv.created_at)}, ${title}, ${summary}, ${transcript},
             ARRAY['message-archive', ${conv.id}]::text[], 5, 'conversation', 'Message Archive', NOW())
        `);
        archived++;
      } catch (err: any) {
        console.warn(`[EmbedIndexer] archiveUnindexedConversations: failed for ${conv.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    console.warn('[EmbedIndexer] archiveUnindexedConversations scan failed:', err.message);
  }

  if (archived > 0) {
    console.log(`[EmbedIndexer] Archived ${archived} conversation(s) from messages table → conversation_memories`);
  }
  return archived;
}

export async function runIndexer(): Promise<void> {
  // Step 0: promote any un-archived conversations into conversation_memories
  // (up to 30 per run — drains the backlog incrementally and picks up new sessions)
  await archiveUnindexedConversations();

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

    // Process batch sequentially when any item has a contentLoader (lazy content).
    // Parallel loading of multiple large conversation transcripts risks OOM.
    const hasLazy = batch.some(t => t.contentLoader);

    if (hasLazy) {
      for (const t of batch) {
        try {
          const content = t.contentLoader ? await t.contentLoader() : t.content;
          if (!content || content.trim().length <= 10) continue;
          const isNew = await generateAndStoreEmbedding(t.memoryType, t.id, t.userId, content, t.initialStrength);
          if (isNew) generated++;
        } catch (err: any) {
          errors++;
          if (errors <= 3) {
            console.warn(`[EmbedIndexer] Failed to embed ${t.memoryType}/${t.id}:`, err.message);
          }
          if (err.message?.includes('OpenAI embedding failed') && errors === 1) {
            const { reportEmbeddingApiError } = await import('./sofia-billing-monitor');
            reportEmbeddingApiError({ source: 'EmbedIndexer', error: err.message }).catch(() => {});
          }
        }
      }
    } else {
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
            if (err.message?.includes('OpenAI embedding failed') && errors === 1) {
              const { reportEmbeddingApiError } = await import('./sofia-billing-monitor');
              reportEmbeddingApiError({ source: 'EmbedIndexer', error: err.message }).catch(() => {});
            }
          }
        })
      );
    }

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
        details: (studentInsights as any).details,
        category: (studentInsights as any).category,
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
  console.log('[EmbedIndexer] Starting (interval: 2h, no boot run)');

  // NO boot run. The server heap hits ~4GB during startup from background workers
  // (VocabImageSeed at +70s, MadrigalIndexer at +390s, ToolIndexer, etc.). A 10-min
  // delayed first run was landing directly on top of MadrigalIndexer and causing OOM.
  // The 2h setInterval is sufficient — embeddings are not latency-critical.
  setInterval(() => {
    runIndexer().catch(err =>
      console.error('[EmbedIndexer] Periodic run failed:', err.message)
    );
  }, INDEXER_INTERVAL_MS);
}
