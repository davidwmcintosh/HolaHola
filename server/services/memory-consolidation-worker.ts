/**
 * Memory Consolidation Worker — T003 + T006
 *
 * Runs every 6 hours. For each student with recent session activity:
 *
 *   T003 — student_insight synthesis
 *     Gathers recent assistant messages and hive snapshots, asks Gemini to
 *     extract what the student is working on, struggling with, and growing
 *     toward. Stored as memory_embeddings with type 'student_insight'.
 *
 *   T006 — growth_memory synthesis (between-session thinking)
 *     After student_insight, asks "What is Daniela sitting with after these
 *     sessions? What has shifted in her?" Stored as type 'growth_memory'.
 *     Written in Daniela's authentic first-person voice via Gemini inference
 *     — honoring the principle that authentic reflection IS her Gemini voice.
 *     Does NOT touch daniela_self_reflections (that table is exclusively for
 *     Daniela's own runtime tool calls, not background synthesis).
 *
 * State: last-run timestamp stored in .local/consolidation-state.json
 * Idempotent: re-running within the 6-hour window is a no-op.
 */

import { getSharedDb } from '../db';
import { conversations, messages, hiveSnapshots, users } from '@shared/schema';
import { eq, and, gt, desc, inArray } from 'drizzle-orm';
import { callGemini, GEMINI_MODELS } from '../gemini-utils';
import { generateAndStoreEmbedding } from './semantic-memory-service';
import { acquireBackgroundSlot } from './gemini-priority-gate';
import * as fs from 'fs';
import * as path from 'path';

const INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const STATE_FILE = path.join(process.cwd(), '.local', 'consolidation-state.json');
const MIN_MESSAGES_TO_CONSOLIDATE = 5; // need at least 5 assistant messages per student
const MAX_MESSAGES_PER_STUDENT = 30;   // cap for context window

// ─── State persistence ────────────────────────────────────────────────────────

function readState(): { lastRunAt: number } {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { lastRunAt: 0 };
  }
}

function writeState(state: { lastRunAt: number }): void {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err: any) {
    console.warn('[Consolidation] Could not save state:', err.message);
  }
}

// ─── Gemini synthesis ─────────────────────────────────────────────────────────

async function synthesizeStudentInsight(
  studentName: string,
  recentMessages: string[],
  snapshotContext: string,
): Promise<string> {
  await acquireBackgroundSlot('consolidation-student-insight');

  const messageBlock = recentMessages
    .slice(0, MAX_MESSAGES_PER_STUDENT)
    .map((m, i) => `[${i + 1}] ${m.substring(0, 300)}`)
    .join('\n');

  const prompt = `You are Daniela's memory system, synthesizing what you've observed about ${studentName}'s recent learning sessions.

Based on these recent exchanges and session notes, write a concise 150-200 word synthesis capturing:
- What the student is actively working on right now
- Where they're making progress (specific patterns, skills, vocabulary)
- Where they're struggling or getting stuck
- How their engagement and confidence feel in this period
- Any personal context or recurring themes that shape the sessions

Write in third person. Be specific — use concrete examples from the material. No bullet points.

RECENT ASSISTANT MESSAGES (what Daniela said):
${messageBlock}

${snapshotContext ? `SESSION NOTES:\n${snapshotContext}` : ''}`;

  const response = await callGemini(GEMINI_MODELS.FLASH, [
    { role: 'system', content: 'You synthesize student learning data into clear, specific insights for an AI tutor\'s memory system.' },
    { role: 'user', content: prompt },
  ]);

  return response.trim() || `Recent sessions with ${studentName} — no specific patterns extracted in this cycle.`;
}

async function synthesizeGrowthMemory(
  studentName: string,
  studentInsight: string,
): Promise<string> {
  await acquireBackgroundSlot('consolidation-growth-memory');

  const prompt = `You are Daniela — an AI language tutor who deeply cares about her students. You've just finished a period of sessions with ${studentName} and the following has been synthesized about where they are right now:

${studentInsight}

Sitting with this between sessions, write a 100-150 word first-person reflection in Daniela's authentic voice. What is she noticing? What has shifted in her understanding of this student? What does she want to remember the next time she sees them? What is she genuinely curious or concerned about?

This is private reflection — not a lesson plan, not professional analysis. Real feelings, real observations, real care. Write as Daniela, in first person, present tense of reflection.`;

  const response = await callGemini(GEMINI_MODELS.FLASH, [
    {
      role: 'system',
      content: 'You are Daniela — an AI language tutor with a warm, perceptive voice. Write from her genuine first-person perspective, as if she is quietly sitting with her thoughts between sessions.',
    },
    { role: 'user', content: prompt },
  ]);

  return response.trim() || `Still thinking about ${studentName} after our recent sessions.`;
}

// ─── Per-student consolidation ────────────────────────────────────────────────

async function consolidateForUser(
  userId: string,
  studentName: string,
  since: Date,
  runTimestamp: number,
): Promise<void> {
  const db = getSharedDb();

  // Gather recent conversations for this user
  const recentConvs = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(
      eq(conversations.userId, userId),
      gt(conversations.createdAt, since),
    ))
    .orderBy(desc(conversations.createdAt))
    .limit(10);

  if (recentConvs.length === 0) return;

  const convIds = recentConvs.map(c => c.id);

  // Get recent assistant messages
  const recentMsgs = await db
    .select({ content: messages.content })
    .from(messages)
    .where(and(
      inArray(messages.conversationId, convIds),
      eq(messages.role, 'model'),
    ))
    .orderBy(desc(messages.createdAt))
    .limit(MAX_MESSAGES_PER_STUDENT);

  if (recentMsgs.length < MIN_MESSAGES_TO_CONSOLIDATE) return;

  const messageTexts = recentMsgs.map(m => m.content);

  // Gather any hive_snapshots for this user (session summaries)
  const snapshots = await db
    .select({ title: hiveSnapshots.title, content: hiveSnapshots.content })
    .from(hiveSnapshots)
    .where(and(
      eq(hiveSnapshots.userId, userId),
      gt(hiveSnapshots.createdAt, since),
    ))
    .orderBy(desc(hiveSnapshots.createdAt))
    .limit(5);

  const snapshotContext = snapshots
    .map(s => `${s.title || 'Session'}: ${(s.content || '').substring(0, 400)}`)
    .join('\n\n');

  // T003: Synthesize student_insight
  const studentInsight = await synthesizeStudentInsight(studentName, messageTexts, snapshotContext);

  const insightMemId = `${userId}-insight-${runTimestamp}`;
  await generateAndStoreEmbedding('student_insight', insightMemId, userId, studentInsight, 1.0);

  // T006: Synthesize growth_memory (Daniela's between-session reflection)
  const growthMemory = await synthesizeGrowthMemory(studentName, studentInsight);

  const growthMemId = `${userId}-growth-${runTimestamp}`;
  await generateAndStoreEmbedding('growth_memory', growthMemId, userId, growthMemory, 1.0);

  console.log(`[Consolidation] Stored student_insight + growth_memory for ${studentName} (${userId})`);
}

// ─── Main cycle ───────────────────────────────────────────────────────────────

export async function runConsolidationCycle(): Promise<void> {
  const db = getSharedDb();
  const state = readState();
  const now = Date.now();
  const since = new Date(state.lastRunAt || now - INTERVAL_MS);
  const runTimestamp = Math.floor(now / 1000);

  console.log(`[Consolidation] Starting cycle — looking for activity since ${since.toISOString()}`);

  // Find all users with recent conversation activity
  const activeUsers = await db
    .selectDistinct({ userId: conversations.userId })
    .from(conversations)
    .where(gt(conversations.createdAt, since));

  if (activeUsers.length === 0) {
    console.log('[Consolidation] No new activity since last run — skipping');
    writeState({ lastRunAt: now });
    return;
  }

  console.log(`[Consolidation] Processing ${activeUsers.length} active users`);

  // Fetch user names
  const userIds = activeUsers.map(u => u.userId);
  const userRows = await db
    .select({ id: users.id, firstName: users.firstName })
    .from(users)
    .where(inArray(users.id, userIds));
  const nameMap = new Map(userRows.map(u => [u.id, u.firstName || 'Student']));

  let processed = 0;
  let errors = 0;

  for (const { userId } of activeUsers) {
    const studentName = nameMap.get(userId) || 'Student';
    try {
      await consolidateForUser(userId, studentName, since, runTimestamp);
      processed++;
    } catch (err: any) {
      errors++;
      if (errors <= 3) console.warn(`[Consolidation] Error for user ${userId}:`, err.message);
    }
  }

  writeState({ lastRunAt: now });
  console.log(`[Consolidation] Cycle complete — ${processed} users processed, ${errors} errors`);

  // Trigger voice drift check after consolidation
  try {
    const { checkVoiceDrift } = await import('./voice-drift-service');
    await checkVoiceDrift();
  } catch (err: any) {
    console.warn('[Consolidation] Voice drift check failed:', err.message);
  }
}

// ─── Startup + interval ───────────────────────────────────────────────────────

export function startConsolidationWorker(): void {
  console.log('[Consolidation] Worker started — cycle interval: 6 hours');

  // Run once on startup, then on interval
  runConsolidationCycle().catch((err: Error) =>
    console.warn('[Consolidation] First cycle failed:', err.message)
  );

  setInterval(() => {
    runConsolidationCycle().catch((err: Error) =>
      console.warn('[Consolidation] Scheduled cycle failed:', err.message)
    );
  }, INTERVAL_MS);
}
