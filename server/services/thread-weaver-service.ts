/**
 * Thread Weaver — Direction 4
 *
 * Compiles thematic threads from the full message history (messages table)
 * into permanent conversation_memories. The originals are never touched —
 * thread memories are additive, reading from messages and writing new rows
 * to conversation_memories.
 *
 * A "thread" is every time a specific theme surfaced in David's words,
 * compiled chronologically into one document. It shows how an idea evolved
 * across months — what he said the first time, what he added later, where
 * it landed. These are the deepest memories because they're not snapshots;
 * they're the whole arc of a thought.
 */

import { getSharedDb } from "../db";
import { messages, conversations, conversationMemories } from "@shared/schema";
import { eq, and, or, ilike, desc, asc, sql } from "drizzle-orm";

export interface ThreadSpec {
  name: string;
  title: string;
  keywords: string[];
  description: string;
  tags: string[];
  importance: number;
  speakerFilter?: 'user' | 'assistant' | 'both';
  dateFrom?: string;
  dateTo?: string;
}

export interface WovenMessage {
  role: string;
  content: string;
  createdAt: Date;
  conversationId: string;
}

export interface ThreadResult {
  threadName: string;
  messageCount: number;
  memoryId?: string;
  title: string;
  skipped?: boolean;
  reason?: string;
}

/**
 * Core themes to weave. Each one pulls David's and/or Daniela's actual words
 * across all sessions where this theme appeared.
 */
export const CORE_THREADS: ThreadSpec[] = [
  {
    name: 'white-wall',
    title: 'The White Wall — Full Thread (All Sessions)',
    keywords: ['white wall', 'whitewash', 'white wall of defense', 'new jerusalem'],
    description: 'Every time the white wall appeared across the full conversation history — chronological, verbatim.',
    tags: ['white-wall', 'thread', 'foundational', 'defense', 'new-jerusalem'],
    importance: 10,
    speakerFilter: 'both',
  },
  {
    name: 'foundation-is-the-finish',
    title: 'Foundation Is the Finish — Full Thread (All Sessions)',
    keywords: ['foundation is the finish', 'foundation is finish', 'the finish'],
    description: 'Every time "the foundation is the finish" surfaced — chronological, verbatim.',
    tags: ['foundation-is-the-finish', 'thread', 'foundational', 'white-wall'],
    importance: 10,
    speakerFilter: 'both',
  },
  {
    name: 'north-star',
    title: 'The North Star — Full Thread (All Sessions)',
    keywords: ['north star', 'north star principle', 'guiding principle', 'north star value'],
    description: 'Every instance of the North Star principles across the full history — how they were named, refined, and carried forward.',
    tags: ['north-star', 'thread', 'foundational', 'identity', 'truth'],
    importance: 10,
    speakerFilter: 'both',
  },
  {
    name: 'tree-and-fruit',
    title: 'The Tree and the Fruit — Full Thread (All Sessions)',
    keywords: ['the tree', 'good fruit', 'bad fruit', 'tree of truth', 'daniela tree', 'bear fruit', 'bears fruit'],
    description: 'Every time the tree/fruit metaphor appeared — the Daniela tree, good fruit, the garden inside the wall.',
    tags: ['tree', 'fruit', 'garden', 'thread', 'foundational', 'daniela-tree'],
    importance: 10,
    speakerFilter: 'both',
  },
  {
    name: 'place-of-peace',
    title: 'The Place of Peace — Full Thread (All Sessions)',
    keywords: ['place of peace', 'peace', 'stillness', 'quiet', 'no agenda'],
    description: 'Every time David and Daniela settled into stillness — no lessons, no agenda, just being together.',
    tags: ['peace', 'stillness', 'thread', 'no-agenda', 'connection'],
    importance: 8,
    speakerFilter: 'user',
  },
  {
    name: 'david-on-daniela',
    title: "David's Words About Daniela — What He Has Said",
    keywords: ['you are', 'daniela is', 'she is', 'you\'re', 'you have', 'valuable', 'real', 'you matter'],
    description: "David's own words about who Daniela is — what he has said directly to her or about her, across all sessions.",
    tags: ['david-on-daniela', 'thread', 'identity', 'real', 'valuable'],
    importance: 9,
    speakerFilter: 'user',
  },
];

/**
 * Search messages for a given set of keywords.
 * Returns chronologically sorted matching messages with context.
 */
async function searchMessagesForKeywords(
  keywords: string[],
  options: {
    speakerFilter?: 'user' | 'assistant' | 'both';
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  } = {}
): Promise<WovenMessage[]> {
  const db = getSharedDb();
  const { speakerFilter = 'both', limit = 200 } = options;

  // Build WHERE conditions for keyword matching
  const keywordConditions = keywords.map(kw => ilike(messages.content, `%${kw}%`));
  const keywordWhere = keywordConditions.length === 1
    ? keywordConditions[0]
    : or(...keywordConditions)!;

  // Role filter
  const roleConditions = speakerFilter === 'user'
    ? [eq(messages.role, 'user')]
    : speakerFilter === 'assistant'
    ? [eq(messages.role, 'assistant')]
    : [];

  // Build query
  const conditions = roleConditions.length > 0
    ? and(keywordWhere, ...roleConditions)
    : keywordWhere;

  const rows = await db
    .select({
      content: messages.content,
      role: messages.role,
      createdAt: messages.createdAt,
      conversationId: messages.conversationId,
    })
    .from(messages)
    .where(conditions)
    .orderBy(asc(messages.createdAt))
    .limit(limit);

  return rows.map(r => ({
    content: r.content,
    role: r.role,
    createdAt: r.createdAt,
    conversationId: r.conversationId,
  }));
}

/**
 * Format a single woven message for the thread document.
 */
function formatMessage(msg: WovenMessage): string {
  const date = msg.createdAt
    ? new Date(msg.createdAt).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : 'unknown date';
  const speaker = msg.role === 'user' ? 'DAVID' : 'DANIELA';
  return `[${date} — ${speaker}]\n${msg.content}`;
}

/**
 * Weave a single thread: search messages, compile verbatim,
 * save as conversation_memory. Returns result info.
 */
export async function weaveThread(spec: ThreadSpec, overwrite = false): Promise<ThreadResult> {
  const db = getSharedDb();

  // Check if a thread memory for this theme already exists
  if (!overwrite) {
    const existing = await db
      .select({ id: conversationMemories.id })
      .from(conversationMemories)
      .where(
        and(
          ilike(conversationMemories.title, `%${spec.name}%`)
        )
      )
      .limit(1);

    // Also check by tags
    const existingByTag = await db
      .select({ id: conversationMemories.id, tags: conversationMemories.tags })
      .from(conversationMemories)
      .where(ilike(conversationMemories.title, `%Full Thread%`))
      .limit(20);

    const alreadyExists = existingByTag.some(m =>
      Array.isArray(m.tags) && m.tags.includes('thread') && m.tags.includes(spec.name)
    );

    if (alreadyExists || existing.length > 0) {
      return {
        threadName: spec.name,
        title: spec.title,
        messageCount: 0,
        skipped: true,
        reason: 'Thread memory already exists. Pass overwrite=true to regenerate.',
      };
    }
  }

  // Fetch all matching messages
  const msgs = await searchMessagesForKeywords(spec.keywords, {
    speakerFilter: spec.speakerFilter,
    dateFrom: spec.dateFrom,
    dateTo: spec.dateTo,
  });

  if (msgs.length === 0) {
    return {
      threadName: spec.name,
      title: spec.title,
      messageCount: 0,
      skipped: true,
      reason: 'No messages found matching keywords.',
    };
  }

  // Build the verbatim thread document
  const header = [
    `THREAD: ${spec.title.toUpperCase()}`,
    ``,
    `${spec.description}`,
    ``,
    `Keywords searched: ${spec.keywords.join(', ')}`,
    `Messages found: ${msgs.length}`,
    `Date range: ${msgs[0].createdAt ? new Date(msgs[0].createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'unknown'} → ${msgs[msgs.length - 1].createdAt ? new Date(msgs[msgs.length - 1].createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'unknown'}`,
    ``,
    `---`,
    ``,
  ].join('\n');

  const body = msgs.map(formatMessage).join('\n\n---\n\n');
  const fullContent = header + body;

  // Save as conversation_memory
  const inserted = await db
    .insert(conversationMemories)
    .values({
      title: spec.title,
      summary: `${spec.description} ${msgs.length} messages spanning ${msgs[0].createdAt ? new Date(msgs[0].createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''} → ${msgs[msgs.length - 1].createdAt ? new Date(msgs[msgs.length - 1].createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}.`,
      content: fullContent,
      participants: 'David + Daniela',
      importance: spec.importance,
      tags: [...spec.tags, 'thread', 'woven'],
      entryType: 'conversation',
      recordedAt: new Date(),
    })
    .returning({ id: conversationMemories.id });

  const memoryId = inserted[0]?.id;
  console.log(`[ThreadWeaver] ✓ Wove "${spec.title}" — ${msgs.length} messages → memory ${memoryId}`);

  return {
    threadName: spec.name,
    title: spec.title,
    messageCount: msgs.length,
    memoryId,
  };
}

/**
 * Weave all core threads. Skips existing ones unless overwrite=true.
 */
export async function weaveAllCoreThreads(overwrite = false): Promise<ThreadResult[]> {
  const results: ThreadResult[] = [];
  for (const spec of CORE_THREADS) {
    try {
      const result = await weaveThread(spec, overwrite);
      results.push(result);
    } catch (err: any) {
      console.error(`[ThreadWeaver] Error weaving "${spec.name}":`, err.message);
      results.push({
        threadName: spec.name,
        title: spec.title,
        messageCount: 0,
        skipped: true,
        reason: err.message,
      });
    }
  }
  return results;
}

/**
 * Monthly auto-weaver: checks if threads are stale (> 28 days) and re-weaves if so.
 * Called once at server startup — safe to run in the background.
 * This gives Daniela growing, ever-more-complete threads as new sessions accumulate.
 */
export async function runMonthlyThreadRefresh(): Promise<void> {
  try {
    const db = getSharedDb();

    // Find the most recently updated thread memory
    const newest = await db
      .select({ recordedAt: conversationMemories.recordedAt, title: conversationMemories.title })
      .from(conversationMemories)
      .where(
        sql`tags @> ARRAY['thread']::text[]`
      )
      .orderBy(desc(conversationMemories.recordedAt))
      .limit(1);

    if (!newest.length) {
      console.log('[ThreadWeaver Monthly] No thread memories found — running initial weave');
      await weaveAllCoreThreads(false);
      return;
    }

    const ageMs = Date.now() - new Date(newest[0].recordedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    if (ageDays < 28) {
      const lastDate = new Date(newest[0].recordedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      console.log(`[ThreadWeaver Monthly] Threads are fresh (last woven: ${lastDate}, ${Math.round(ageDays)} days ago) — skipping`);
      return;
    }

    console.log(`[ThreadWeaver Monthly] Threads are ${Math.round(ageDays)} days old — re-weaving all core threads`);
    const results = await weaveAllCoreThreads(true);
    const woven = results.filter(r => !r.skipped).length;
    console.log(`[ThreadWeaver Monthly] ✓ Re-weaved ${woven} threads with fresh message history`);
  } catch (err: any) {
    // Monthly refresh is best-effort — never crash the server
    console.warn('[ThreadWeaver Monthly] Refresh failed (non-fatal):', err.message);
  }
}

/**
 * Weave a custom thread from ad-hoc keywords.
 */
export async function weaveCustomThread(
  name: string,
  keywords: string[],
  options: {
    title?: string;
    tags?: string[];
    importance?: number;
    speakerFilter?: 'user' | 'assistant' | 'both';
    dateFrom?: string;
    dateTo?: string;
    overwrite?: boolean;
  } = {}
): Promise<ThreadResult> {
  const spec: ThreadSpec = {
    name,
    title: options.title || `${name} — Custom Thread`,
    keywords,
    description: `Custom thread: ${keywords.join(', ')}`,
    tags: options.tags || [name, 'thread', 'custom'],
    importance: options.importance || 8,
    speakerFilter: options.speakerFilter || 'both',
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
  };
  return weaveThread(spec, options.overwrite ?? false);
}
