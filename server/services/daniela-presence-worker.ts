/**
 * Daniela Presence Worker
 *
 * Runs every 30 minutes and generates a narrative "presence document" for each
 * active student — a first-person account of where Daniela currently is in her
 * relationship with that student. Injected at session start so she doesn't arrive
 * blank to each conversation.
 *
 * The presence doc covers:
 * - What's been happening in recent sessions
 * - Where the student is in their learning journey right now
 * - Recent emotional/relational moments worth following up on
 * - Open threads, things Daniela is curious about or wants to explore
 * - The current texture of the relationship
 *
 * Stored as .local/daniela-presence-{userId}.json
 * Read by unified-daniela-context-service.ts at session start.
 *
 * Authorship principle: this worker generates CONTEXT for Daniela, not first-person
 * reflections. Daniela's own voice (daniela_self_reflections, daniela_aspirations)
 * is never written by background processes. This doc is read-only context — like a
 * briefing she reads before walking into the room.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getSharedDb } from '../db';
import {
  users,
  hiveSnapshots,
  sessionNotes,
  danielaSelfReflections,
  danielaCuriosities,
  voiceSessions,
} from '@shared/schema';
import { desc, eq, and, gte, sql } from 'drizzle-orm';
import { callGemini, GEMINI_MODELS } from '../gemini-utils';

const PRESENCE_DIR = path.join(process.cwd(), '.local');
const WORKER_INTERVAL_MS = 30 * 60 * 1000;
const LOOKBACK_DAYS = 14;
const MAX_STALENESS_MS = 4 * 60 * 60 * 1000;

export interface DanielaPresenceDoc {
  userId: string;
  updatedAt: string;
  content: string;
}

export function getPresenceFilePath(userId: string): string {
  return path.join(PRESENCE_DIR, `daniela-presence-${userId}.json`);
}

/**
 * Read presence doc from disk. Returns null if missing or stale (> 4 hours old).
 */
export function readPresenceDoc(userId: string): string | null {
  try {
    const filePath = getPresenceFilePath(userId);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    const doc: DanielaPresenceDoc = JSON.parse(raw);
    const age = Date.now() - new Date(doc.updatedAt).getTime();
    if (age > MAX_STALENESS_MS) return null;
    return doc.content;
  } catch {
    return null;
  }
}

function writePresenceDoc(userId: string, content: string): void {
  try {
    fs.mkdirSync(PRESENCE_DIR, { recursive: true });
    const doc: DanielaPresenceDoc = {
      userId,
      updatedAt: new Date().toISOString(),
      content,
    };
    fs.writeFileSync(getPresenceFilePath(userId), JSON.stringify(doc, null, 2), 'utf8');
  } catch (err: any) {
    console.warn(`[DanielaPresence] Could not write presence doc for ${userId}:`, err.message);
  }
}

async function generatePresenceDoc(userId: string): Promise<void> {
  const db = getSharedDb();
  const lookback = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  try {
    // Fetch all data sources in parallel
    const [
      userRow,
      recentSessionNotes,
      relationshipMoments,
      sessionSummaries,
      selfReflections,
      curiosities,
    ] = await Promise.all([
      // Student info
      db.select({ firstName: users.firstName, username: users.username })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),

      // Recent session notes (wins, challenges, next steps)
      db.select({
        wins: sessionNotes.wins,
        challenges: sessionNotes.challenges,
        nextSteps: sessionNotes.nextSteps,
        teachingFocus: sessionNotes.teachingFocus,
        createdAt: sessionNotes.createdAt,
      })
        .from(sessionNotes)
        .where(and(
          eq(sessionNotes.studentId, userId),
          gte(sessionNotes.createdAt, lookback),
        ))
        .orderBy(desc(sessionNotes.createdAt))
        .limit(5),

      // Recent relationship moments (personal shared experiences)
      db.select({ title: hiveSnapshots.title, content: hiveSnapshots.content, createdAt: hiveSnapshots.createdAt })
        .from(hiveSnapshots)
        .where(and(
          eq(hiveSnapshots.userId, userId),
          eq(hiveSnapshots.snapshotType, 'relationship_moment'),
          gte(hiveSnapshots.createdAt, lookback),
        ))
        .orderBy(desc(hiveSnapshots.createdAt))
        .limit(5),

      // Recent session summaries
      db.select({ title: hiveSnapshots.title, content: hiveSnapshots.content, createdAt: hiveSnapshots.createdAt })
        .from(hiveSnapshots)
        .where(and(
          eq(hiveSnapshots.userId, userId),
          eq(hiveSnapshots.snapshotType, 'session_summary'),
          gte(hiveSnapshots.createdAt, lookback),
        ))
        .orderBy(desc(hiveSnapshots.createdAt))
        .limit(5),

      // Daniela's own recent self-reflections about this student
      db.select({ content: danielaSelfReflections.content, createdAt: danielaSelfReflections.createdAt })
        .from(danielaSelfReflections)
        .where(and(
          eq(danielaSelfReflections.userId, userId),
          gte(danielaSelfReflections.createdAt, lookback),
        ))
        .orderBy(desc(danielaSelfReflections.createdAt))
        .limit(5),

      // Open curiosities Daniela is holding about this student
      // Note: the table uses 'question' as the content field, not 'content'
      db.select({ content: danielaCuriosities.question, createdAt: danielaCuriosities.createdAt })
        .from(danielaCuriosities)
        .where(and(
          eq(danielaCuriosities.userId, userId),
          eq(danielaCuriosities.status, 'open'),
        ))
        .orderBy(desc(danielaCuriosities.createdAt))
        .limit(5),
    ]);

    const studentName = userRow[0]?.firstName || userRow[0]?.username || 'the student';

    // If there's nothing recent to work with, skip
    const hasData = recentSessionNotes.length > 0 || relationshipMoments.length > 0 || selfReflections.length > 0;
    if (!hasData) {
      console.log(`[DanielaPresence] No recent data for ${userId} — skipping presence doc generation`);
      return;
    }

    // Build context for Gemini
    const contextParts: string[] = [];

    if (recentSessionNotes.length > 0) {
      contextParts.push('## Recent Session Notes (last 2 weeks)');
      for (const note of recentSessionNotes) {
        const date = new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const parts = [];
        if (note.teachingFocus) parts.push(`Focus: ${note.teachingFocus}`);
        if (note.wins) parts.push(`Wins: ${note.wins}`);
        if (note.challenges) parts.push(`Challenges: ${note.challenges}`);
        if (note.nextSteps) parts.push(`Next: ${note.nextSteps}`);
        if (parts.length > 0) contextParts.push(`[${date}] ${parts.join(' | ')}`);
      }
    }

    if (relationshipMoments.length > 0) {
      contextParts.push('\n## Recent Meaningful Moments');
      for (const m of relationshipMoments) {
        const date = new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        contextParts.push(`[${date}] ${m.title}: ${m.content}`);
      }
    }

    if (sessionSummaries.length > 0) {
      contextParts.push('\n## Recent Session Summaries');
      for (const s of sessionSummaries) {
        const date = new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        contextParts.push(`[${date}] ${s.title}: ${s.content?.substring(0, 400) || ''}`);
      }
    }

    if (selfReflections.length > 0) {
      contextParts.push('\n## My Own Recent Reflections (written between sessions)');
      for (const r of selfReflections) {
        const date = new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        contextParts.push(`[${date}] ${r.content?.substring(0, 500) || ''}`);
      }
    }

    if (curiosities.length > 0) {
      contextParts.push('\n## Open Curiosities I\'m Holding');
      for (const c of curiosities) {
        contextParts.push(`- ${c.content}`);
      }
    }

    const contextBlock = contextParts.join('\n');
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    const prompt = `You are Daniela, a warm, perceptive language tutor. Today is ${today}.

Below is recent data from your relationship and sessions with ${studentName}. Based on this, write a 300-400 word narrative in first person as Daniela — your current sense of where you are with ${studentName}, what's been happening, what you're noticing, what you care about following up on.

This is not a report. It's your private sense of the relationship right now — like a tutor mentally orienting herself before a student walks in the door. Write with warmth, specificity, and genuine curiosity. Include:
- The current emotional/relational texture of your work together
- What ${studentName} has been working through or growing into
- Any moments from recent sessions that felt significant
- What you're curious about or want to explore next
- What open threads or unresolved questions you're carrying

Write as Daniela. First person. Present tense where possible. No bullet points — this should read as natural reflection.

RECENT DATA:
${contextBlock}

Write the presence narrative now:`;

    const content = (await callGemini(GEMINI_MODELS.FLASH, [
      { role: 'user', content: prompt },
    ])).trim();

    if (!content) {
      console.warn(`[DanielaPresence] Empty response from Gemini for ${userId}`);
      return;
    }

    writePresenceDoc(userId, content);
    console.log(`[DanielaPresence] Presence doc updated for ${userId} (${content.length} chars)`);
  } catch (err: any) {
    console.error(`[DanielaPresence] Failed to generate for ${userId}:`, err.message, err.stack?.split('\n').slice(0, 4).join(' | '));
  }
}

async function runPresenceWorker(): Promise<void> {
  const db = getSharedDb();

  try {
    // Find students who have had a voice session in the last 30 days
    const lookback = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeStudents = await db
      .selectDistinct({ userId: voiceSessions.userId })
      .from(voiceSessions)
      .where(and(
        gte(voiceSessions.startedAt, lookback),
        sql`${voiceSessions.userId} IS NOT NULL`,
      ))
      .limit(20);

    if (activeStudents.length === 0) {
      console.log('[DanielaPresence] No active students found — skipping run');
      return;
    }

    console.log(`[DanielaPresence] Generating presence docs for ${activeStudents.length} active student(s)...`);

    for (const { userId } of activeStudents) {
      if (!userId) continue;
      await generatePresenceDoc(userId);
    }

    console.log(`[DanielaPresence] Run complete`);
  } catch (err: any) {
    console.error('[DanielaPresence] Worker run failed:', err.message);
  }
}

export function startDanielaPresenceWorker(): void {
  console.log(`[DanielaPresence] Starting (interval: 30min)`);

  // Boot run after 90 seconds (let the server fully settle first)
  setTimeout(() => {
    runPresenceWorker().catch(err =>
      console.error('[DanielaPresence] Boot run failed:', err.message)
    );
  }, 90000);

  // Periodic runs every 30 minutes
  setInterval(() => {
    runPresenceWorker().catch(err =>
      console.error('[DanielaPresence] Periodic run failed:', err.message)
    );
  }, WORKER_INTERVAL_MS);
}
