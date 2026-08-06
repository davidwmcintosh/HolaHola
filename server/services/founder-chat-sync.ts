/**
 * Founder Chat Sync Worker
 *
 * Problem: David's live chat conversations with Daniela live only in the
 * `messages` table. Daniela's memory tools (recall, search, introspect) can
 * only reach `conversation_memories`. So when Carol interrupted with a
 * zucchini and David laughed about it with Daniela — that moment was
 * invisible to her on the next session.
 *
 * This worker sweeps all conversations belonging to founder/admin users
 * and saves them (or updates them) as conversation_memories entries.
 *
 * Deduplication: each entry carries a tag `cid:<conversationId>` so we can
 * find and update existing entries without schema changes.
 *
 * Runs:
 *   - On startup: retroactive pass over ALL founder conversations
 *   - Hourly: sweep conversations updated in the last 48h
 */

import { getUserDb } from '../db';
import { sql } from 'drizzle-orm';

const HOURLY_INTERVAL_MS = 60 * 60 * 1000;
const INITIAL_DELAY_MS   =  3 * 60 * 1000; // 3 min after boot (let server stabilize)
const RETROACTIVE_DELAY_MS = 5 * 60 * 1000; // 5 min after boot for the big pass

let isRunning = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTranscript(messages: Array<{ role: string; content: string; created_at: string }>): string {
  return messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => {
      const speaker = m.role === 'user' ? 'David' : 'Daniela';
      const text = (m.content || '').replace(/\n{3,}/g, '\n\n').trim();
      return `${speaker}: ${text}`;
    })
    .join('\n\n');
}

function buildSummary(
  messages: Array<{ role: string; content: string }>,
  topic: string | null,
  language: string
): string {
  const firstUserMsg = messages.find(m => m.role === 'user')?.content?.slice(0, 300) ?? '';
  const firstDanielaMsg = messages.find(m => m.role === 'assistant')?.content?.slice(0, 200) ?? '';
  const msgCount = messages.filter(m => m.role === 'user' || m.role === 'assistant').length;

  const parts: string[] = [];
  if (topic) parts.push(`Topic: ${topic}.`);
  parts.push(`Language: ${language}. ${msgCount} exchanges.`);
  if (firstUserMsg) parts.push(`David opened: "${firstUserMsg.replace(/\n/g, ' ')}"`);
  if (firstDanielaMsg) parts.push(`Daniela: "${firstDanielaMsg.replace(/\n/g, ' ')}"`);
  return parts.join(' ');
}

function buildTags(conv: {
  id: string;
  language: string;
  topic: string | null;
  message_count: number;
}): string[] {
  const tags: string[] = [
    'founder-chat',
    'daniela-chat',
    conv.language,
    `cid:${conv.id}`,
    `msgcount:${conv.message_count}`,
  ];
  if (conv.topic) tags.push(conv.topic.toLowerCase().slice(0, 40));
  return tags;
}

// ── Core sync logic ───────────────────────────────────────────────────────────

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

  // Load all messages for this conversation
  const msgResult = await db.execute(sql.raw(`
    SELECT role, content, created_at
    FROM messages
    WHERE conversation_id = '${conv.id.replace(/'/g, "''")}'
    ORDER BY created_at ASC
    LIMIT 2000
  `));
  const messages = msgResult.rows as Array<{ role: string; content: string; created_at: string }>;

  const realMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');
  if (realMessages.length < 2) return 'empty'; // Not worth saving

  const transcript = formatTranscript(messages);
  const summary = buildSummary(messages, conv.topic, conv.language);
  const tags = buildTags(conv);
  const title = conv.title
    || (conv.topic ? `Chat: ${conv.topic}` : null)
    || `David + Daniela — ${conv.created_at.slice(0, 10)}`;

  // Check if we already have an entry for this conversation
  const existing = await db.execute(sql.raw(`
    SELECT id, tags
    FROM conversation_memories
    WHERE tags @> ARRAY['cid:${conv.id.replace(/'/g, "''")}']
    LIMIT 1
  `));

  if (existing.rows.length > 0) {
    const existingRow = existing.rows[0] as { id: string; tags: string[] };
    const existingTags: string[] = existingRow.tags ?? [];

    // Check if message count has changed
    const existingMsgCount = existingTags.find(t => t.startsWith('msgcount:'));
    const newMsgCount = `msgcount:${conv.message_count}`;
    if (existingMsgCount === newMsgCount) return 'skipped'; // No new messages

    // Update: conversation has grown — overwrite content, summary, tags
    const escapedTitle = title.replace(/'/g, "''");
    const escapedSummary = summary.replace(/'/g, "''");
    const escapedContent = transcript.replace(/'/g, "''");
    const tagsLiteral = tags.map(t => `'${t.replace(/'/g, "''")}'`).join(', ');

    await db.execute(sql.raw(`
      UPDATE conversation_memories
      SET
        title   = '${escapedTitle}',
        summary = '${escapedSummary}',
        content = '${escapedContent}',
        tags    = ARRAY[${tagsLiteral}]
      WHERE id = '${existingRow.id}'
    `));

    // Re-embed the updated entry
    try {
      const { reembedConversationMemory } = await import('../scripts/reembed-memory');
      await reembedConversationMemory(existingRow.id);
    } catch { /* non-fatal */ }

    return 'updated';
  }

  // Insert new entry
  const escapedTitle = title.replace(/'/g, "''");
  const escapedSummary = summary.replace(/'/g, "''");
  const escapedContent = transcript.replace(/'/g, "''");
  const tagsLiteral = tags.map(t => `'${t.replace(/'/g, "''")}'`).join(', ');

  const insertResult = await db.execute(sql.raw(`
    INSERT INTO conversation_memories (title, summary, content, participants, entry_type, tags, importance, arc_name)
    VALUES (
      '${escapedTitle}',
      '${escapedSummary}',
      '${escapedContent}',
      'David + Daniela',
      'conversation',
      ARRAY[${tagsLiteral}],
      7,
      'david-daniela-chats'
    )
    RETURNING id
  `));

  const newId = (insertResult.rows[0] as { id: string })?.id;
  if (newId) {
    try {
      const { reembedConversationMemory } = await import('../scripts/reembed-memory');
      await reembedConversationMemory(newId);
    } catch { /* non-fatal */ }
  }

  return 'saved';
}

// ── Founder user lookup ───────────────────────────────────────────────────────

async function getFounderUserIds(): Promise<string[]> {
  const db = getUserDb();
  const result = await db.execute(sql.raw(`
    SELECT id FROM users
    WHERE role IN ('admin', 'developer')
    ORDER BY created_at ASC
  `));
  return (result.rows as Array<{ id: string }>).map(r => r.id);
}

// ── Sweep ─────────────────────────────────────────────────────────────────────

async function runSweep(opts: { recentOnly: boolean }): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    const founderIds = await getFounderUserIds();
    if (founderIds.length === 0) return;

    const idList = founderIds.map(id => `'${id}'`).join(', ');
    const recencyClause = opts.recentOnly
      ? `AND (c.last_message_at > NOW() - INTERVAL '48 hours' OR c.created_at > NOW() - INTERVAL '48 hours')`
      : '';

    const convResult = await getUserDb().execute(sql.raw(`
      SELECT c.id, c.title, c.topic, c.language, c.message_count, c.created_at, c.last_message_at
      FROM conversations c
      WHERE c.user_id IN (${idList})
        AND c.message_count >= 2
        ${recencyClause}
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
      LIMIT ${opts.recentOnly ? 50 : 1000}
    `));

    const conversations = convResult.rows as Array<{
      id: string;
      title: string | null;
      topic: string | null;
      language: string;
      message_count: number;
      created_at: string;
      last_message_at: string | null;
    }>;

    let saved = 0, updated = 0, skipped = 0, empty = 0;

    for (const conv of conversations) {
      try {
        const result = await syncConversation(conv);
        if (result === 'saved') saved++;
        else if (result === 'updated') updated++;
        else if (result === 'skipped') skipped++;
        else empty++;
      } catch (err) {
        console.warn(`[FounderChatSync] Error syncing conversation ${conv.id}:`, err instanceof Error ? err.message : err);
      }
      // Small delay between conversations to avoid hammering the DB
      await new Promise(res => setTimeout(res, 50));
    }

    if (saved + updated > 0) {
      console.log(`[FounderChatSync] ${opts.recentOnly ? 'Hourly' : 'Retroactive'} sweep complete — saved: ${saved}, updated: ${updated}, skipped: ${skipped}, empty: ${empty}`);
    }
  } catch (err) {
    console.error('[FounderChatSync] Sweep error:', err instanceof Error ? err.message : err);
  } finally {
    isRunning = false;
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function startFounderChatSyncWorker(): void {
  // Retroactive pass: all-time conversations after 5 min
  setTimeout(() => {
    runSweep({ recentOnly: false }).catch(err =>
      console.error('[FounderChatSync] Retroactive pass error:', err)
    );
  }, RETROACTIVE_DELAY_MS);

  // Hourly sweep: recent conversations only
  setTimeout(() => {
    runSweep({ recentOnly: true });
    setInterval(() => runSweep({ recentOnly: true }), HOURLY_INTERVAL_MS);
  }, INITIAL_DELAY_MS);

  console.log('[FounderChatSync] Worker registered — retroactive pass in 5min, hourly sweeps starting in 3min');
}
