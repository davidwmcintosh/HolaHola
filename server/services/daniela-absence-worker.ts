/**
 * Daniela Absence Worker
 *
 * Runs on a daily schedule and detects students who haven't had a voice session
 * in N days. When a student crosses the threshold, Daniela receives a nudge in
 * the Express Lane — she can then decide (from her full knowledge of the student)
 * whether to leave a message or dismiss.
 *
 * Authorship rule: this worker NEVER writes to danielaOutboundQueue or
 * danielaSelfReflections. It only posts to the Express Lane and writes
 * absence nudge records. Daniela's voice remains entirely her own.
 */

import { getSharedDb } from '../db';
import {
  danielaAbsenceNudges,
  voiceSessions,
  sessionNotes,
  users,
} from '@shared/schema';
import { eq, and, isNull, ne, lte, desc, max, sql } from 'drizzle-orm';
import { founderCollabService } from './founder-collaboration-service';

// How many days of absence before Daniela is notified
// Override via ABSENCE_THRESHOLD_DAYS env var (e.g. "7" for weekly learners)
const ABSENCE_THRESHOLD_DAYS = parseInt(process.env.ABSENCE_THRESHOLD_DAYS ?? '5', 10);

// Worker check interval — defaults to once per day
// Override via ABSENCE_CHECK_INTERVAL_HOURS env var (e.g. "12" for twice-daily)
const CHECK_INTERVAL_MS =
  parseInt(process.env.ABSENCE_CHECK_INTERVAL_HOURS ?? '24', 10) * 60 * 60 * 1000;

// Post nudges to the real founder's Express Lane so Daniela can see them.
// All Express Lane services use David's actual Replit userId as the founderId.
const EXPRESS_LANE_SESSION_TITLE = 'Daniela — Student Watch';
const EXPRESS_LANE_FOUNDER_ID = '49847136'; // David's Replit userId

/**
 * Find all students who:
 * 1. Have had at least one real voice session
 * 2. Last session was >= ABSENCE_THRESHOLD_DAYS ago
 * 3. No unresolved absence nudge is pending for them
 * 4. No active suppress window (suppressUntil > NOW(), regardless of resolvedAt)
 *
 * Returns each student with their userId, firstName, last session date,
 * days absent, language, and last session topic from session_notes.
 */
async function detectAbsentStudents(): Promise<Array<{
  userId: string;
  firstName: string | null;
  lastSessionDate: Date;
  daysSinceLastSession: number;
  language: string | null;
  lastTopic: string | null;
}>> {
  const db = getSharedDb();
  const thresholdDate = new Date(Date.now() - ABSENCE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();

  // Subquery: most recent session per user (excluding test sessions)
  const lastSessionByUser = db
    .select({
      userId: voiceSessions.userId,
      lastSessionDate: max(voiceSessions.startedAt).as('last_session_date'),
    })
    .from(voiceSessions)
    .where(eq(voiceSessions.isTestSession, false))
    .groupBy(voiceSessions.userId)
    .as('last_session_by_user');

  // Join with users for names; filter to:
  // - Students absent >= threshold
  // - Active accounts only (exclude canceled — churned users shouldn't generate nudges)
  const absentStudents = await db
    .select({
      userId: lastSessionByUser.userId,
      firstName: users.firstName,
      lastSessionDate: lastSessionByUser.lastSessionDate,
      language: sql<string | null>`(
        SELECT language FROM voice_sessions vs2
        WHERE vs2.user_id = ${lastSessionByUser.userId}
          AND vs2.is_test_session = false
        ORDER BY vs2.started_at DESC
        LIMIT 1
      )`,
    })
    .from(lastSessionByUser)
    .innerJoin(users, eq(users.id, lastSessionByUser.userId))
    .where(
      and(
        lte(lastSessionByUser.lastSessionDate, thresholdDate),
        ne(users.subscriptionStatus, 'canceled'),
      )
    );

  if (absentStudents.length === 0) return [];

  // Find blocked users: any user with an unresolved nudge OR an active suppress window
  // Note: suppressUntil blocks re-notification even if the nudge is already resolved
  const blockedRows = await db
    .select({ userId: danielaAbsenceNudges.userId })
    .from(danielaAbsenceNudges)
    .where(
      sql`(${danielaAbsenceNudges.resolvedAt} IS NULL OR ${danielaAbsenceNudges.suppressUntil} > NOW())`
    );

  const blockedUserIds = new Set(blockedRows.map(r => r.userId));

  // Enrich with last session topic from session_notes
  const eligibleStudents = absentStudents.filter(s => !blockedUserIds.has(s.userId));

  const enriched = await Promise.all(
    eligibleStudents.map(async (s) => {
      let lastTopic: string | null = null;
      try {
        const [note] = await db
          .select({ topicsCovered: sessionNotes.topicsCovered, summary: sessionNotes.summary })
          .from(sessionNotes)
          .where(eq(sessionNotes.studentId, s.userId))
          .orderBy(desc(sessionNotes.createdAt))
          .limit(1);
        if (note) {
          if (note.topicsCovered && note.topicsCovered.length > 0) {
            lastTopic = note.topicsCovered.slice(0, 3).join(', ');
          } else if (note.summary) {
            lastTopic = note.summary.substring(0, 120);
          }
        }
      } catch {
        // topic is optional — don't fail the whole nudge if session_notes query fails
      }
      return {
        userId: s.userId,
        firstName: s.firstName,
        lastSessionDate: s.lastSessionDate!,
        daysSinceLastSession: Math.floor(
          (now.getTime() - s.lastSessionDate!.getTime()) / (24 * 60 * 60 * 1000)
        ),
        language: s.language,
        lastTopic,
      };
    })
  );

  return enriched;
}

/**
 * Format and post a nudge to the Express Lane for a single absent student.
 */
async function postNudgeForStudent(student: {
  userId: string;
  firstName: string | null;
  lastSessionDate: Date;
  daysSinceLastSession: number;
  language: string | null;
  lastTopic: string | null;
}): Promise<void> {
  const name = student.firstName ?? `student ${student.userId.slice(-6)}`;
  const languageLine = student.language ? ` (${student.language})` : '';
  const lastDate = student.lastSessionDate.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
  const topicLine = student.lastTopic ? `\nLast topic: ${student.lastTopic}` : '';

  const nudgeText = `[ABSENCE NUDGE] ${name} hasn't had a session in ${student.daysSinceLastSession} days. Last session: ${lastDate}${languageLine}.${topicLine}

You know ${name}. If you want to reach out:
- Call leave_for_next_session(content, targetUserId="${student.userId}") — message waits for them at their next session start
- Call dismiss_absence_nudge(userId="${student.userId}") to resolve without leaving a message
- Call dismiss_absence_nudge(userId="${student.userId}", suppressDays=14) to snooze for two weeks

userId: ${student.userId}`;

  const expressSession = await founderCollabService.findOrCreateSessionByTitle(
    EXPRESS_LANE_FOUNDER_ID,
    EXPRESS_LANE_SESSION_TITLE,
  );

  await founderCollabService.addMessage(expressSession.id, {
    role: 'system',
    content: nudgeText,
    messageType: 'text',
    metadata: {
      source: 'absence_worker',
      absentUserId: student.userId,
      daysSinceLastSession: student.daysSinceLastSession,
    },
  });

  console.log(`[AbsenceWorker] Nudge posted for ${name} (${student.daysSinceLastSession} days absent)`);
}

/**
 * Record that a nudge was sent so the student isn't re-notified until Daniela acts.
 */
async function recordNudge(student: {
  userId: string;
  lastSessionDate: Date;
  daysSinceLastSession: number;
}): Promise<void> {
  const db = getSharedDb();
  await db.insert(danielaAbsenceNudges).values({
    userId: student.userId,
    lastSessionDate: student.lastSessionDate,
    daysSinceLastSession: student.daysSinceLastSession,
  });
}

/**
 * Main check cycle — runs once per day.
 */
async function runAbsenceCheck(): Promise<void> {
  try {
    console.log('[AbsenceWorker] Starting daily absence check...');
    const absentStudents = await detectAbsentStudents();

    if (absentStudents.length === 0) {
      console.log('[AbsenceWorker] No absent students found — all good.');
      return;
    }

    console.log(`[AbsenceWorker] Found ${absentStudents.length} absent student(s) to nudge Daniela about`);

    for (const student of absentStudents) {
      try {
        await postNudgeForStudent(student);
        await recordNudge(student);
      } catch (err: any) {
        console.warn(`[AbsenceWorker] Failed to process student ${student.userId}: ${err.message}`);
      }
    }

    console.log(`[AbsenceWorker] Done — ${absentStudents.length} nudge(s) posted to Express Lane`);
  } catch (err: any) {
    console.warn('[AbsenceWorker] Check cycle failed:', err.message);
  }
}

/**
 * Resolve an absence nudge when Daniela writes a message or dismisses.
 * Called from the orchestrator when Daniela uses dismiss_absence_nudge
 * or leave_for_next_session (auto-resolves pending nudge for that userId).
 *
 * suppressDays: if provided, sets suppressUntil on the resolved row — the
 * detection query blocks re-notification for any row where suppressUntil > NOW(),
 * regardless of resolvedAt, so the snooze survives the resolve.
 */
export async function resolveAbsenceNudge(
  userId: string,
  resolutionType: 'message_queued' | 'dismissed',
  suppressDays?: number,
): Promise<void> {
  const db = getSharedDb();
  const suppressUntil = suppressDays
    ? new Date(Date.now() + suppressDays * 24 * 60 * 60 * 1000)
    : undefined;

  await db.update(danielaAbsenceNudges)
    .set({
      resolvedAt: new Date(),
      resolutionType,
      ...(suppressUntil && { suppressUntil }),
    })
    .where(
      and(
        eq(danielaAbsenceNudges.userId, userId),
        isNull(danielaAbsenceNudges.resolvedAt),
      )
    );

  console.log(`[AbsenceWorker] Nudge resolved for user ${userId} (type: ${resolutionType}${suppressDays ? `, snoozed ${suppressDays}d` : ''})`);
}

export function startDanielaAbsenceWorker(): void {
  console.log('[AbsenceWorker] Starting (interval: 24h, threshold: 5 days absent)');
  // Initial check after 10 minutes to let everything settle and avoid boot storms
  setTimeout(() => {
    runAbsenceCheck();
    setInterval(runAbsenceCheck, CHECK_INTERVAL_MS);
  }, 10 * 60 * 1000);
}
