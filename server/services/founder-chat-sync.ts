/**
 * Founder Chat Sync Worker
 *
 * Problem: David's live chat conversations with Daniela live only in the
 * `messages` table. Daniela's memory tools (recall, search, introspect) can
 * only reach `conversation_memories`. So when Carol walked in with a zucchini
 * and David laughed about it with Daniela — that moment was invisible to her
 * on the next session.
 *
 * This worker makes every David↔Daniela conversation searchable by Daniela.
 *
 * Three layers:
 *
 *   1. IMMEDIATE — notifyConversationUpdated(id) is called by routes.ts after
 *      every assistant message save. A per-conversation debounce (30s) batches
 *      the user+assistant pair and syncs within seconds of the exchange.
 *
 *   2. SWEEP — every 5 minutes, catches any conversation updated in the last
 *      15 minutes (covers reconnects, multi-language sessions, rapid learners).
 *
 *   3. RETROACTIVE — 5 minutes after boot, walks the ENTIRE conversations
 *      table in batches of 200 (no cap) so day-one memories are reachable.
 *      Subsequent boots skip already-indexed conversations in O(1) via tag check.
 */

import { getUserDb } from '../db';
import { sql } from 'drizzle-orm';

const SWEEP_INTERVAL_MS     =  5 * 60 * 1000; // every 5 minutes
const SWEEP_INITIAL_DELAY   =  3 * 60 * 1000; // 3 min after boot
const RETROACTIVE_DELAY_MS  =  5 * 60 * 1000; // 5 min after boot
const SWEEP_WINDOW_MINUTES  = 15;              // look back 15 min on each sweep
const RETROACTIVE_BATCH     = 200;             // rows per DB page — no total cap
const NOTIFY_DEBOUNCE_MS    = 30 * 1000;       // batch user+assistant pair

// Per-conversation debounce map: conversationId → timeout handle
const pendingNotifications = new Map<string, ReturnType<typeof setTimeout>>();

let retroactiveRunning = false;
let sweepRunning       = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTranscript(
  messages: Array<{ role: string; content: string }>
): string {
  return messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => {
      const speaker = m.role === 'user' ? 'David' : 'Daniela';
      return `${speaker}: ${(m.content ?? '').replace(/\n{3,}/g, '\n\n').trim()}`;
    })
    .join('\n\n');
}

function buildSummary(
  messages: Array<{ role: string; content: string }>,
  topic: string | null,
  language: string
): string {
  const firstUser     = messages.find(m => m.role === 'user')?.content?.slice(0, 300)     ?? '';
  const firstDaniela  = messages.find(m => m.role === 'assistant')?.content?.slice(0, 200) ?? '';
  const count         = messages.filter(m => m.role === 'user' || m.role === 'assistant').length;

  const parts: string[] = [];
  if (topic) parts.push(`Topic: ${topic}.`);
  parts.push(`Language: ${language}. ${count} exchanges.`);
  if (firstUser)    parts.push(`David opened: "${firstUser.replace(/\n/g, ' ')}"`);
  if (firstDaniela) parts.push(`Daniela: "${firstDaniela.replace(/\n/g, ' ')}"`);
  return parts.join(' ');
}

function buildTags(conv: {
  id: string;
  language: string;
  topic: string | null;
  message_count: number;
}): string[] {
  const tags = [
    'founder-chat',
    'daniela-chat',
    conv.language,
    `cid:${conv.id}`,
    `msgcount:${conv.message_count}`,
  ];
  if (conv.topic) tags.push(conv.topic.toLowerCase().slice(0, 40));
  return tags;
}

// ── Core: sync one conversation ───────────────────────────────────────────────

async function syncConversation(conv: {
  id: string;
  title: string | null;
  topic: string | null;
  language: string;
  message_count: number;
  created_at: string;
  last_message_at: string | null;
}): Promise<'saved' | 'updated' | 'skipped' | 'empty'> {
  const db = getUserDb();

  const msgResult = await db.execute(sql.raw(`
    SELECT role, content, created_at
    FROM messages
    WHERE conversation_id = '${conv.id.replace(/'/g, "''")}'
    ORDER BY created_at ASC
    LIMIT 5000
  `));
  const messages = msgResult.rows as Array<{ role: string; content: string; created_at: string }>;
  const real = messages.filter(m => m.role === 'user' || m.role === 'assistant');
  if (real.length < 2) return 'empty';

  const transcript = formatTranscript(messages);
  const summary    = buildSummary(messages, conv.topic, conv.language);
  const tags       = buildTags(conv);
  const title      = conv.title
    || (conv.topic ? `Chat: ${conv.topic}` : null)
    || `David + Daniela — ${conv.created_at.slice(0, 10)}`;

  // Check for existing entry via cid: tag
  const existing = await db.execute(sql.raw(`
    SELECT id, tags
    FROM conversation_memories
    WHERE tags @> ARRAY['cid:${conv.id.replace(/'/g, "''")}']
    LIMIT 1
  `));

  if (existing.rows.length > 0) {
    const row = existing.rows[0] as { id: string; tags: string[] };
    const existingMsgCount = (row.tags ?? []).find((t: string) => t.startsWith('msgcount:'));
    if (existingMsgCount === `msgcount:${conv.message_count}`) return 'skipped';

    // Conversation has grown — update in place
    await db.execute(sql.raw(`
      UPDATE conversation_memories SET
        title   = '${title.replace(/'/g, "''")}',
        summary = '${summary.replace(/'/g, "''")}',
        content = '${transcript.replace(/'/g, "''")}',
        tags    = ARRAY[${tags.map(t => `'${t.replace(/'/g, "''")}'`).join(', ')}]
      WHERE id = '${row.id}'
    `));
    reembedAsync(row.id);
    return 'updated';
  }

  // New entry
  const insertResult = await db.execute(sql.raw(`
    INSERT INTO conversation_memories
      (title, summary, content, participants, entry_type, tags, importance, arc_name)
    VALUES (
      '${title.replace(/'/g, "''")}',
      '${summary.replace(/'/g, "''")}',
      '${transcript.replace(/'/g, "''")}',
      'David + Daniela',
      'conversation',
      ARRAY[${tags.map(t => `'${t.replace(/'/g, "''")}'`).join(', ')}],
      7,
      'david-daniela-chats'
    )
    RETURNING id
  `));
  const newId = (insertResult.rows[0] as { id: string })?.id;
  if (newId) reembedAsync(newId);
  return 'saved';
}

function reembedAsync(id: string): void {
  import('../scripts/reembed-memory')
    .then(mod => mod.reembedConversationMemory(id))
    .catch(() => { /* non-fatal */ });
}

// ── Founder user IDs (cached after first load) ────────────────────────────────

let cachedFounderIds: string[] | null = null;

async function getFounderUserIds(): Promise<string[]> {
  if (cachedFounderIds) return cachedFounderIds;
  const db = getUserDb();
  const result = await db.execute(sql.raw(`
    SELECT id FROM users WHERE role IN ('admin', 'developer') ORDER BY created_at ASC
  `));
  cachedFounderIds = (result.rows as Array<{ id: string }>).map(r => r.id);
  return cachedFounderIds;
}

// ── Immediate hook (called by routes.ts) ──────────────────────────────────────

/**
 * Call this after every assistant message is saved for a conversation.
 * A 30-second debounce batches the user+assistant pair into one sync.
 * Fire-and-forget — never throws.
 */
export function notifyConversationUpdated(conversationId: string): void {
  const existing = pendingNotifications.get(conversationId);
  if (existing) clearTimeout(existing);

  const handle = setTimeout(async () => {
    pendingNotifications.delete(conversationId);
    try {
      const founderIds = await getFounderUserIds();
      if (!founderIds.length) return;

      const idList = founderIds.map(id => `'${id}'`).join(', ');
      const db = getUserDb();
      const result = await db.execute(sql.raw(`
        SELECT id, title, topic, language, message_count, created_at, last_message_at
        FROM conversations
        WHERE id = '${conversationId.replace(/'/g, "''")}' AND user_id IN (${idList})
        LIMIT 1
      `));
      if (!result.rows.length) return; // not a founder conversation — skip

      const conv = result.rows[0] as {
        id: string; title: string | null; topic: string | null;
        language: string; message_count: number;
        created_at: string; last_message_at: string | null;
      };
      const outcome = await syncConversation(conv);
      if (outcome === 'saved' || outcome === 'updated') {
        console.log(`[FounderChatSync] Immediate sync: ${outcome} — conv ${conversationId.slice(0, 8)}`);
      }
    } catch (err) {
      console.warn('[FounderChatSync] Immediate sync error:', err instanceof Error ? err.message : err);
    }
  }, NOTIFY_DEBOUNCE_MS);

  pendingNotifications.set(conversationId, handle);
}

// ── Sweep (recent conversations) ──────────────────────────────────────────────

async function runSweep(): Promise<void> {
  if (sweepRunning) return;
  sweepRunning = true;
  try {
    const founderIds = await getFounderUserIds();
    if (!founderIds.length) return;

    const idList = founderIds.map(id => `'${id}'`).join(', ');
    const db = getUserDb();
    const result = await db.execute(sql.raw(`
      SELECT id, title, topic, language, message_count, created_at, last_message_at
      FROM conversations
      WHERE user_id IN (${idList})
        AND message_count >= 2
        AND (
          last_message_at > NOW() - INTERVAL '${SWEEP_WINDOW_MINUTES} minutes'
          OR created_at    > NOW() - INTERVAL '${SWEEP_WINDOW_MINUTES} minutes'
        )
      ORDER BY COALESCE(last_message_at, created_at) DESC
      LIMIT 100
    `));

    const convs = result.rows as Array<{
      id: string; title: string | null; topic: string | null;
      language: string; message_count: number;
      created_at: string; last_message_at: string | null;
    }>;

    let saved = 0, updated = 0;
    for (const conv of convs) {
      // Skip if already being handled by a pending immediate notification
      if (pendingNotifications.has(conv.id)) continue;
      try {
        const outcome = await syncConversation(conv);
        if (outcome === 'saved')   saved++;
        if (outcome === 'updated') updated++;
      } catch { /* non-fatal */ }
      await new Promise(r => setTimeout(r, 30));
    }
    if (saved + updated > 0) {
      console.log(`[FounderChatSync] Sweep complete — saved: ${saved}, updated: ${updated}`);
    }
  } catch (err) {
    console.error('[FounderChatSync] Sweep error:', err instanceof Error ? err.message : err);
  } finally {
    sweepRunning = false;
  }
}

// ── Retroactive pass (no cap, paginated) ──────────────────────────────────────

async function runRetroactivePass(): Promise<void> {
  if (retroactiveRunning) return;
  retroactiveRunning = true;

  try {
    const founderIds = await getFounderUserIds();
    if (!founderIds.length) { retroactiveRunning = false; return; }

    const idList = founderIds.map(id => `'${id}'`).join(', ');
    const db     = getUserDb();

    let offset = 0;
    let totalSaved = 0, totalUpdated = 0, totalSkipped = 0, totalEmpty = 0;

    while (true) {
      const batch = await db.execute(sql.raw(`
        SELECT id, title, topic, language, message_count, created_at, last_message_at
        FROM conversations
        WHERE user_id IN (${idList}) AND message_count >= 2
        ORDER BY created_at ASC
        LIMIT ${RETROACTIVE_BATCH} OFFSET ${offset}
      `));

      const convs = batch.rows as Array<{
        id: string; title: string | null; topic: string | null;
        language: string; message_count: number;
        created_at: string; last_message_at: string | null;
      }>;

      if (!convs.length) break; // done

      for (const conv of convs) {
        try {
          const outcome = await syncConversation(conv);
          if (outcome === 'saved')   totalSaved++;
          if (outcome === 'updated') totalUpdated++;
          if (outcome === 'skipped') totalSkipped++;
          if (outcome === 'empty')   totalEmpty++;
        } catch (err) {
          console.warn(`[FounderChatSync] Retroactive error on ${conv.id}:`,
            err instanceof Error ? err.message : err);
        }
        // Light throttle — avoid holding the DB connection pool under load
        await new Promise(r => setTimeout(r, 50));
      }

      offset += RETROACTIVE_BATCH;

      // Brief pause between pages
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(
      `[FounderChatSync] Retroactive pass complete — ` +
      `saved: ${totalSaved}, updated: ${totalUpdated}, ` +
      `skipped: ${totalSkipped}, empty: ${totalEmpty}, ` +
      `total processed: ${offset}`
    );
  } catch (err) {
    console.error('[FounderChatSync] Retroactive pass error:', err instanceof Error ? err.message : err);
  } finally {
    retroactiveRunning = false;
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function startFounderChatSyncWorker(): void {
  // Retroactive: full table walk, 5 min after boot
  setTimeout(() => runRetroactivePass(), RETROACTIVE_DELAY_MS);

  // Sweep: every 5 minutes, starting 3 min after boot
  setTimeout(() => {
    runSweep();
    setInterval(runSweep, SWEEP_INTERVAL_MS);
  }, SWEEP_INITIAL_DELAY);

  console.log(
    '[FounderChatSync] Worker registered — ' +
    'immediate sync on each message, 5-min sweeps, retroactive pass in 5min'
  );
}
