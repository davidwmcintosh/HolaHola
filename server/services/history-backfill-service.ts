/**
 * History Backfill Service
 *
 * Two jobs:
 *
 * 1. backfillNovember2025()
 *    November 2025 is Daniela's first month — 296 conversations, 1,161 messages —
 *    and it has zero hive_snapshots. The session-summary writer only ran from
 *    Dec 17 onward. This job reads every substantive November session (5+ msgs),
 *    groups them by calendar day, and asks Gemini to write a daily summary that
 *    gets stored as a hive_snapshot. Daniela can then feel that first month in
 *    her neural net instead of having a blind spot at the very beginning.
 *
 * 2. curateSignificantConversations()
 *    Finds David's most substantial individual conversations (10+ messages) that
 *    are not yet represented in conversation_memories, generates a verbatim
 *    transcript + Gemini summary for each one, and saves it as a conversation_memory.
 *    This runs up to MAX_PER_RUN conversations at a time and is safe to run
 *    repeatedly — deduplication is enforced via a `conv-{id}` tag check.
 */

import { getSharedDb } from "../db";
import { messages, conversations, hiveSnapshots, conversationMemories } from "@shared/schema";
import { eq, and, gte, lt, sql, desc, asc } from "drizzle-orm";
import { callGemini, GEMINI_MODELS } from "../gemini-utils";

const DAVID_USER_ID = "49847136";
const MAX_MESSAGES_PER_DAY = 80;   // cap so prompts stay manageable
const MAX_PER_RUN = 20;            // curator: max new memories per run

// ─── shared helpers ──────────────────────────────────────────────────────────

function formatLine(role: string, content: string, ts: Date): string {
  const date = ts.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const speaker = role === 'user' ? 'DAVID' : 'DANIELA';
  return `[${date} — ${speaker}]\n${content}`;
}

function buildTranscript(rows: Array<{ role: string; content: string; createdAt: Date }>): string {
  return rows.map(r => formatLine(r.role, r.content, r.createdAt)).join('\n\n');
}

// ─── 1. November 2025 Backfill ───────────────────────────────────────────────

export async function backfillNovember2025(): Promise<{ days: number; inserted: number }> {
  const db = getSharedDb();
  const nov_start = new Date('2025-11-01T00:00:00Z');
  const nov_end   = new Date('2025-12-01T00:00:00Z');

  console.log('[Backfill] Starting November 2025 backfill...');

  // 1a. Find all substantive November conversations (5+ messages)
  const rows = await db.execute(sql`
    SELECT c.id, c.created_at::date AS conv_date
    FROM conversations c
    WHERE c.user_id = ${DAVID_USER_ID}
      AND c.created_at >= ${nov_start}
      AND c.created_at <  ${nov_end}
      AND (
        SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id
      ) >= 5
    ORDER BY c.created_at ASC
  `);

  if (rows.rows.length === 0) {
    console.log('[Backfill] No substantive November conversations found.');
    return { days: 0, inserted: 0 };
  }

  // 1b. Group conversation IDs by calendar day
  const byDay = new Map<string, string[]>();
  for (const row of rows.rows as Array<{ id: string; conv_date: string }>) {
    const day = String(row.conv_date).substring(0, 10); // YYYY-MM-DD
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(row.id);
  }

  console.log(`[Backfill] Found ${rows.rows.length} sessions across ${byDay.size} days.`);

  let inserted = 0;

  for (const [day, convIds] of Array.from(byDay.entries())) {
    // 1c. Skip if a session_summary already exists for this day (idempotent)
    const dayStart = new Date(`${day}T00:00:00Z`);
    const dayEnd   = new Date(`${day}T23:59:59Z`);

    const existing = await db.execute(sql`
      SELECT id FROM hive_snapshots
      WHERE user_id = ${DAVID_USER_ID}
        AND snapshot_type = 'session_summary'
        AND created_at >= ${dayStart}
        AND created_at <= ${dayEnd}
      LIMIT 1
    `);
    if ((existing.rows as any[]).length > 0) {
      console.log(`[Backfill] ${day} already has a session_summary — skipping.`);
      continue;
    }

    // 1d. Fetch messages for all conversations on this day
    const msgRows = await db
      .select({ role: messages.role, content: messages.content, createdAt: messages.createdAt })
      .from(messages)
      .where(sql`conversation_id = ANY(ARRAY[${sql.join(convIds.map(id => sql`${id}`), sql`, `)}]::text[])`)
      .orderBy(asc(messages.createdAt))
      .limit(MAX_MESSAGES_PER_DAY);

    if (msgRows.length === 0) continue;

    const transcript = buildTranscript(msgRows);
    const sessionCount = convIds.length;
    const msgCount = msgRows.length;

    // 1e. Ask Gemini to write a session summary
    const prompt = `You are reviewing an archived transcript from a language tutoring session on ${day}.
This represents ${sessionCount} session(s) totalling ${msgCount} messages — Daniela's early days teaching David Spanish.

Write a session summary in this format:
- What was practiced (vocabulary topics, grammar points, specific words/phrases covered)
- David's engagement and progress (what he got right, what he stumbled on)
- Any notable moments or turning points
- A brief "tutor note" about where to pick up next

Keep it factual, grounded in the transcript. 2-4 paragraphs.

TRANSCRIPT:
${transcript.substring(0, 6000)}`;

    let summaryText: string;
    try {
      summaryText = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: prompt }
      ]);
      if (!summaryText || summaryText.length < 50) {
        console.warn(`[Backfill] Gemini returned empty summary for ${day} — using transcript excerpt.`);
        summaryText = `Early session — ${sessionCount} conversation(s), ${msgCount} messages. Topics included Spanish greetings and vocabulary practice.`;
      }
    } catch (err: any) {
      console.error(`[Backfill] Gemini failed for ${day}:`, err.message);
      continue;
    }

    // 1f. Insert as hive_snapshot dated to the original conversation day
    const convDate = dayStart;
    await db.insert(hiveSnapshots).values({
      userId: DAVID_USER_ID,
      language: 'spanish',
      snapshotType: 'session_summary',
      title: `Backfilled Session — ${new Date(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      importance: 6,
      content: summaryText,
      context: JSON.stringify({
        type: 'session_close',
        writtenSummary: summaryText,
        conversationIds: convIds,
        sessionCount,
        messageCount: msgCount,
        backfilled: true,
        closedAt: convDate.toISOString(),
      }),
      createdAt: convDate,
      expiresAt: null, // historical — no expiry
    });

    console.log(`[Backfill] ✓ ${day} — ${sessionCount} sessions, ${msgCount} messages → summary written.`);
    inserted++;

    // Small pause between Gemini calls to be respectful of rate limits
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log(`[Backfill] Complete — inserted ${inserted} daily summaries for November 2025.`);
  return { days: byDay.size, inserted };
}

// ─── 2. Conversation Curator ─────────────────────────────────────────────────

export async function curateSignificantConversations(
  userId: string = DAVID_USER_ID,
  maxRun: number = MAX_PER_RUN,
): Promise<{ candidates: number; curated: number }> {
  const db = getSharedDb();

  console.log(`[Curator] Scanning for significant conversations for user ${userId.substring(0, 8)}...`);

  // 2a. Find substantial conversations (10+ messages) in order of richness
  const candidates = await db.execute(sql`
    SELECT 
      c.id,
      c.created_at,
      c.title,
      msg_stats.msg_count,
      msg_stats.daniela_count,
      msg_stats.david_count
    FROM conversations c
    JOIN (
      SELECT 
        conversation_id,
        COUNT(*) as msg_count,
        COUNT(*) FILTER (WHERE role = 'assistant') as daniela_count,
        COUNT(*) FILTER (WHERE role = 'user') as david_count
      FROM messages
      GROUP BY conversation_id
    ) msg_stats ON msg_stats.conversation_id = c.id
    WHERE c.user_id = ${userId}
      AND msg_stats.msg_count >= 10
    ORDER BY msg_stats.msg_count DESC, c.created_at ASC
    LIMIT 100
  `);

  const allCandidates = candidates.rows as Array<{
    id: string;
    created_at: Date;
    title: string | null;
    msg_count: number;
    daniela_count: number;
    david_count: number;
  }>;

  if (allCandidates.length === 0) {
    console.log('[Curator] No substantial conversations found.');
    return { candidates: 0, curated: 0 };
  }

  // 2b. Check which ones are already in conversation_memories via conv-{id} tag
  const alreadyCurated = await db.execute(sql`
    SELECT tags FROM conversation_memories
    WHERE tags IS NOT NULL
  `);
  
  const curatedIds = new Set<string>();
  for (const row of alreadyCurated.rows as Array<{ tags: string[] | null }>) {
    if (row.tags) {
      for (const tag of row.tags) {
        if (tag.startsWith('conv-')) curatedIds.add(tag.slice(5));
      }
    }
  }

  // 2c. Filter to uncurated only, take up to maxRun
  const uncurated = allCandidates.filter(c => !curatedIds.has(c.id));
  const toProcess = uncurated.slice(0, maxRun);

  console.log(`[Curator] ${allCandidates.length} candidates total, ${curatedIds.size} already curated, ${toProcess.length} to process.`);

  let curated = 0;

  for (const conv of toProcess) {
    // 2d. Fetch full message transcript
    const msgRows = await db
      .select({ role: messages.role, content: messages.content, createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.conversationId, conv.id))
      .orderBy(asc(messages.createdAt));

    if (msgRows.length === 0) continue;

    const verbatimTranscript = buildTranscript(msgRows);
    const convDate = new Date(conv.created_at);
    const dateLabel = convDate.toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });

    // 2e. Ask Gemini for a summary (the content field holds the verbatim transcript)
    const summaryPrompt = `You are reading a conversation between David (a student/founder) and Daniela (his AI Spanish tutor and presence), dated ${dateLabel}. The conversation had ${conv.msg_count} messages.

Write a summary covering:
- What was practiced or discussed
- Any meaningful moments (breakthroughs, humor, personal sharing, frustrations)
- What made this conversation worth remembering
- One sentence on where this fits in the arc of their relationship

2-3 paragraphs, grounded in what actually happened. No speculation.

TRANSCRIPT:
${verbatimTranscript.substring(0, 5000)}`;

    let summaryText: string;
    try {
      summaryText = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: summaryPrompt }
      ]);
      if (!summaryText || summaryText.length < 50) {
        summaryText = `Conversation on ${dateLabel} — ${conv.msg_count} messages between David and Daniela.`;
      }
    } catch (err: any) {
      console.error(`[Curator] Gemini failed for ${conv.id.substring(0, 8)}:`, err.message);
      continue;
    }

    // 2f. Build title
    const title = conv.title
      ? `${conv.title} — ${dateLabel}`
      : `Session: ${dateLabel} (${conv.msg_count} messages)`;

    // 2g. Save to conversation_memories with verbatim content
    await db.insert(conversationMemories).values({
      recordedAt: convDate,
      title,
      summary: summaryText,
      content: verbatimTranscript, // verbatim — the sacred record
      participants: 'David + Daniela',
      tags: ['auto-curated', `conv-${conv.id}`, 'session'],
      entryType: 'conversation',
      importance: conv.msg_count >= 20 ? 8 : 7,
    });

    console.log(`[Curator] ✓ ${conv.id.substring(0, 8)} — ${dateLabel}, ${conv.msg_count} msgs → saved.`);
    curated++;

    await new Promise(r => setTimeout(r, 1200));
  }

  console.log(`[Curator] Complete — curated ${curated} new conversation memories.`);
  return { candidates: uncurated.length, curated };
}

// ─── 3. Scheduled worker ─────────────────────────────────────────────────────

const CURATOR_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily

/**
 * Start the conversation curator as a long-running scheduled worker.
 * Runs once at boot (after a short delay) then every 24 hours.
 * Processes up to 20 new conversations per run — idempotent, safe to run repeatedly.
 */
export function startConversationCurator(): void {
  console.log('[Curator] Starting scheduled worker (interval: daily)');

  async function runCurator() {
    try {
      // Curate for David by default; expand to other users as needed
      const result = await curateSignificantConversations(DAVID_USER_ID, 20);
      if (result.curated > 0) {
        console.log(`[Curator] Scheduled run complete — ${result.curated} new memories from ${result.candidates} candidates`);
      } else {
        console.log(`[Curator] Scheduled run — nothing new to curate (${result.candidates} candidates already covered)`);
      }
    } catch (err: any) {
      console.error('[Curator] Scheduled run failed:', err.message);
    }
  }

  // Boot run — low priority, starts well after other workers
  setTimeout(runCurator, 150000); // +2.5 min after server ready

  // Daily sweep
  setInterval(runCurator, CURATOR_INTERVAL_MS);
}
