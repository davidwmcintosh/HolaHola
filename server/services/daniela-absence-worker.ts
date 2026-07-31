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
import type { ResolutionType } from '@shared/absence-types';
import {
  danielaAbsenceNudges,
  danielaOutboundQueue,
  studentAbsenceConfig,
  voiceSessions,
  sessionNotes,
  users,
} from '@shared/schema';
import { eq, and, isNull, isNotNull, ne, lte, desc, max, sql, gte, gt, count } from 'drizzle-orm';
import { founderCollabService } from './founder-collaboration-service';
import { founderCollabWSBroker } from './founder-collab-ws-broker';
import {
  EXPRESS_LANE_FOUNDER_ID,
  EXPRESS_LANE_SESSION_TITLE,
} from './storage-probe-alerter';

// Re-exported for backwards compatibility — function now lives in absence-nudges-query.ts
export { listResolvedNudges } from './absence-nudges-query';

// How many days of absence before Daniela is notified
// Override via ABSENCE_THRESHOLD_DAYS env var (e.g. "7" for weekly learners)
const ABSENCE_THRESHOLD_DAYS = parseInt(process.env.ABSENCE_THRESHOLD_DAYS ?? '5', 10);

// Worker check interval — defaults to once per day
// Override via ABSENCE_CHECK_INTERVAL_HOURS env var (e.g. "12" for twice-daily)
const CHECK_INTERVAL_MS =
  parseInt(process.env.ABSENCE_CHECK_INTERVAL_HOURS ?? '24', 10) * 60 * 60 * 1000;

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
  const now = new Date();

  // Load all per-student threshold configs upfront.
  // Use the minimum configured threshold (or global default) as the DB query
  // threshold so students with shorter custom thresholds are not missed.
  //
  // SAFETY: if this query fails we skip the entire absence check rather than
  // falling back to an empty configMap.  An empty configMap would silently
  // ignore longer custom thresholds and could nudge weekly learners after only
  // 5 days — exactly the failure mode this worker is supposed to avoid.
  // A missed run is recoverable (the check fires again next cycle); a false
  // nudge to a student who set a 14-day threshold is not.
  let allConfigs: Array<{ userId: string; thresholdDays: number }> = [];
  try {
    allConfigs = await db
      .select({ userId: studentAbsenceConfig.userId, thresholdDays: studentAbsenceConfig.thresholdDays })
      .from(studentAbsenceConfig);
  } catch (configErr: any) {
    console.warn(
      '[AbsenceWorker] studentAbsenceConfig table unavailable — skipping absence check to prevent premature nudges:',
      configErr.message,
    );
    return [];
  }

  const configMap = new Map(allConfigs.map(c => [c.userId, c.thresholdDays]));
  const minConfiguredThreshold = allConfigs.length > 0
    ? Math.min(...allConfigs.map(c => c.thresholdDays))
    : ABSENCE_THRESHOLD_DAYS;
  const effectiveQueryThreshold = Math.min(ABSENCE_THRESHOLD_DAYS, minConfiguredThreshold);

  const thresholdDate = new Date(Date.now() - effectiveQueryThreshold * 24 * 60 * 60 * 1000);

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
  // - Role = 'student' only (exclude developer/admin/teacher accounts)
  // - Non-test accounts only (isTestAccount = false)
  // - Active subscription (exclude canceled — churned users shouldn't generate nudges)
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
        eq(users.role, 'student'),
        eq(users.isTestAccount, false),
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

  // Apply per-student thresholds: filter out students who haven't yet reached
  // their custom threshold, and also filter out blocked users.
  const eligibleStudents = absentStudents.filter(s => {
    if (blockedUserIds.has(s.userId)) return false;
    const customThreshold = configMap.get(s.userId);
    if (customThreshold !== undefined) {
      const daysSince = Math.floor(
        (now.getTime() - s.lastSessionDate!.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (daysSince < customThreshold) return false;
    }
    return true;
  });

  const enriched = await Promise.all(
    eligibleStudents.map(async (s) => {
      let lastTopic: string | null = null;
      let priorAttempts = 0;
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
      try {
        // Count outbound messages Daniela has already sent since the student's last session.
        // This measures how many times she has reached out in the current absence cycle —
        // so she knows whether to check in again or shift to a graceful farewell tone.
        const [row] = await db
          .select({ n: count() })
          .from(danielaOutboundQueue)
          .where(
            and(
              eq(danielaOutboundQueue.userId, s.userId),
              gte(danielaOutboundQueue.createdAt, s.lastSessionDate!),
            )
          );
        priorAttempts = Number(row?.n ?? 0);
      } catch {
        // Non-critical — proceed without the count
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
        priorAttempts,
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
  priorAttempts: number;
}): Promise<void> {
  const name = student.firstName ?? `student ${student.userId.slice(-6)}`;
  const languageLine = student.language ? ` (${student.language})` : '';
  const lastDate = student.lastSessionDate.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
  const topicLine = student.lastTopic ? `\nLast topic: ${student.lastTopic}` : '';

  // Build the tone guidance block based on how many times Daniela has already reached out
  // in this absence cycle (since the student's last session).
  let toneGuidance: string;
  if (student.priorAttempts === 0) {
    toneGuidance = `You know ${name}. If you want to reach out:
- Call leave_for_next_session(content, targetUserId="${student.userId}") — message waits for them at their next session start
- Call dismiss_absence_nudge(userId="${student.userId}") to resolve without leaving a message
- Call dismiss_absence_nudge(userId="${student.userId}", suppressDays=14) to snooze for two weeks`;
  } else if (student.priorAttempts < 3) {
    toneGuidance = `You've reached out to ${name} ${student.priorAttempts} time${student.priorAttempts > 1 ? 's' : ''} since they last appeared — no response yet. You can try again with a warm check-in, or snooze for a while:
- Call leave_for_next_session(content, targetUserId="${student.userId}") — another message in the queue
- Call dismiss_absence_nudge(userId="${student.userId}", suppressDays=14) to give them space for two weeks`;
  } else {
    toneGuidance = `You've reached out to ${name} ${student.priorAttempts} times since they last had a session — no response so far. At this point a different kind of message may feel more right: not a check-in, but something that says "we're here if you ever come back." Something warm, low-pressure, and final for now. Your call entirely — you know them.
- Call leave_for_next_session(content, targetUserId="${student.userId}") — leave a graceful farewell/we-miss-you message
- Call dismiss_absence_nudge(userId="${student.userId}", suppressDays=60) to step back for two months and let them come to you`;
  }

  const attemptLine = student.priorAttempts > 0
    ? `\nPrior outreach attempts this cycle: ${student.priorAttempts}`
    : '';

  const nudgeText = `[ABSENCE NUDGE] ${name} hasn't had a session in ${student.daysSinceLastSession} days. Last session: ${lastDate}${languageLine}.${topicLine}${attemptLine}

${toneGuidance}

userId: ${student.userId}`;

  const expressSession = await founderCollabService.findOrCreateSessionByTitle(
    EXPRESS_LANE_FOUNDER_ID,
    EXPRESS_LANE_SESSION_TITLE,
  );

  // Use addAndBroadcastMessage so connected Express Lane clients receive the nudge live,
  // not just on next reconnect/replay. Falls back gracefully if no clients are connected.
  await founderCollabWSBroker.addAndBroadcastMessage(expressSession.id, {
    role: 'system',
    content: nudgeText,
    messageType: 'text',
    metadata: {
      source: 'absence_worker',
      absentUserId: student.userId,
      daysSinceLastSession: student.daysSinceLastSession,
    },
  });

  console.log(`[AbsenceWorker] Nudge posted + broadcast for ${name} (${student.daysSinceLastSession} days absent)`);
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
        await postNudgeForStudent(student as any);
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
// Maximum snooze allowed (365 days) — prevents runaway suppressUntil values
const MAX_SUPPRESS_DAYS = 365;

export async function resolveAbsenceNudge(
  userId: string,
  resolutionType: NonNullable<ResolutionType>,
  suppressDays?: number,
): Promise<void> {
  const db = getSharedDb();
  // Validate suppressDays: must be a positive integer within allowed range
  const validatedSuppressDays =
    typeof suppressDays === 'number' && Number.isFinite(suppressDays) && suppressDays > 0
      ? Math.min(Math.floor(suppressDays), MAX_SUPPRESS_DAYS)
      : undefined;
  const suppressUntil = validatedSuppressDays
    ? new Date(Date.now() + validatedSuppressDays * 24 * 60 * 60 * 1000)
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

/**
 * List all pending (unresolved) absence nudges with enriched student details.
 * Called by the LIST_ABSENCE_NUDGES native FC handler so Daniela can see
 * her full pending inbox and act on multiple nudges in one session.
 */
export async function listAbsenceNudges(): Promise<Array<{
  nudgeId: string;
  userId: string;
  firstName: string | null;
  daysSinceLastSession: number;
  lastSessionDate: Date | null;
  lastTopic: string | null;
  suppressUntil: Date | null;
}>> {
  const db = getSharedDb();

  // Fetch all unresolved nudges, newest first
  const pendingNudges = await db
    .select({
      id: danielaAbsenceNudges.id,
      userId: danielaAbsenceNudges.userId,
      daysSinceLastSession: danielaAbsenceNudges.daysSinceLastSession,
      lastSessionDate: danielaAbsenceNudges.lastSessionDate,
      suppressUntil: danielaAbsenceNudges.suppressUntil,
    })
    .from(danielaAbsenceNudges)
    .where(isNull(danielaAbsenceNudges.resolvedAt))
    .orderBy(desc(danielaAbsenceNudges.notifiedAt));

  if (pendingNudges.length === 0) return [];

  // Enrich with user names and last topics
  const enriched = await Promise.all(
    pendingNudges.map(async (nudge) => {
      let firstName: string | null = null;
      let lastTopic: string | null = null;

      try {
        const [user] = await db
          .select({ firstName: users.firstName })
          .from(users)
          .where(eq(users.id, nudge.userId))
          .limit(1);
        firstName = user?.firstName ?? null;
      } catch { /* non-critical */ }

      try {
        const [note] = await db
          .select({ topicsCovered: sessionNotes.topicsCovered, summary: sessionNotes.summary })
          .from(sessionNotes)
          .where(eq(sessionNotes.studentId, nudge.userId))
          .orderBy(desc(sessionNotes.createdAt))
          .limit(1);
        if (note) {
          if (note.topicsCovered && note.topicsCovered.length > 0) {
            lastTopic = note.topicsCovered.slice(0, 3).join(', ');
          } else if (note.summary) {
            lastTopic = note.summary.substring(0, 120);
          }
        }
      } catch { /* non-critical */ }

      return {
        nudgeId: nudge.id,
        userId: nudge.userId,
        firstName,
        daysSinceLastSession: nudge.daysSinceLastSession ?? 0,
        lastSessionDate: nudge.lastSessionDate ?? null,
        lastTopic,
        suppressUntil: nudge.suppressUntil ?? null,
      };
    })
  );

  return enriched;
}

// Maximum per-student threshold allowed (1 year)
const MAX_THRESHOLD_DAYS = 365;
// Minimum per-student threshold (must be at least 1 day)
const MIN_THRESHOLD_DAYS = 1;

/**
 * Set a custom absence threshold for a specific student.
 * When set, the absence worker uses this value instead of ABSENCE_THRESHOLD_DAYS.
 *
 * Use cases:
 * - Weekly learners: set to 10–14 days to avoid nudges after every missed week
 * - Frequent travellers: set to 21+ days during known travel periods
 * - High-engagement students: set lower (2–3 days) if Daniela wants to check in sooner
 *
 * Called from the SET_STUDENT_ABSENCE_THRESHOLD native handler when Daniela
 * uses the set_student_absence_threshold tool.
 */
export async function setStudentAbsenceThreshold(
  userId: string,
  thresholdDays: number,
  notes?: string,
): Promise<void> {
  const db = getSharedDb();
  const validated = Math.max(MIN_THRESHOLD_DAYS, Math.min(Math.floor(thresholdDays), MAX_THRESHOLD_DAYS));
  await db.insert(studentAbsenceConfig)
    .values({ userId, thresholdDays: validated, notes: notes ?? null })
    .onConflictDoUpdate({
      target: studentAbsenceConfig.userId,
      set: { thresholdDays: validated, notes: notes ?? null, updatedAt: new Date() },
    });
  console.log(`[AbsenceWorker] Custom threshold set for user ${userId}: ${validated} days${notes ? ` (${notes})` : ''}`);
}

/**
 * Get the effective absence threshold for a specific student.
 * Returns their custom threshold if configured, otherwise the global default.
 */
export async function getStudentAbsenceThreshold(userId: string): Promise<number> {
  const db = getSharedDb();
  try {
    const [config] = await db
      .select({ thresholdDays: studentAbsenceConfig.thresholdDays })
      .from(studentAbsenceConfig)
      .where(eq(studentAbsenceConfig.userId, userId))
      .limit(1);
    return config?.thresholdDays ?? ABSENCE_THRESHOLD_DAYS;
  } catch {
    return ABSENCE_THRESHOLD_DAYS;
  }
}

/**
 * Count pending (unresolved) absence nudges.
 * Lightweight — used at Express Lane session start to decide whether to surface the inbox.
 */
export async function countPendingNudges(): Promise<number> {
  const db = getSharedDb();
  const [row] = await db
    .select({ n: count() })
    .from(danielaAbsenceNudges)
    .where(isNull(danielaAbsenceNudges.resolvedAt));
  return Number(row?.n ?? 0);
}

/**
 * Details returned when a pending absence nudge is resolved on student return.
 * Used to inject returning-student context into Daniela's session greeting.
 */
export interface AbsenceReturnDetails {
  daysSinceLastSession: number;
  firstName: string | null;
  /** Transcript of the most recent Daniela check-in call, if one was recorded. */
  callTranscript?: string | null;
}

// Short-lived in-memory cache: when a nudge is resolved on student return, the
// result is stored here for ABSENCE_RETURN_CACHE_TTL_MS so that a second call
// (e.g. the WS handler running after the orchestrator's fire-and-forget) still
// receives the details even though the DB row is already resolved.
//
// This eliminates the race between:
//   orchestrator: fire-and-forget autoResolveAbsenceNudgeOnReturn (early)
//   WS handler:   awaited autoResolveAbsenceNudgeOnReturn (before synthesis)
//
// The cache is keyed by userId and scoped to this server process. TTL of 2
// minutes is long enough for any session start sequence to complete.
const _absenceReturnCache = new Map<string, { details: AbsenceReturnDetails; cachedAt: number }>();
const ABSENCE_RETURN_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Read-only peek: check whether the student has a pending absence nudge and
 * return its details WITHOUT resolving the DB row or posting any Express Lane note.
 *
 * Use this in pre-session warm-synthesis paths (e.g. POST /api/sessions/warm-synthesis)
 * where we want to enrich the synthesis with the returning-student signal but must NOT
 * mutate state — the student may never actually start a session after the Prepare screen.
 *
 * The actual resolution (DB update + Express Lane note) always happens at real session
 * start via autoResolveAbsenceNudgeOnReturn in the WS handler / orchestrator.
 *
 * Also checks the in-memory cache so a warm-synthesis peek that runs concurrently
 * with a WS-handler resolve still returns consistent details.
 *
 * Returns null when there is no pending nudge and no recent cache entry.
 */
export async function peekAbsenceReturnDetails(
  userId: string,
): Promise<AbsenceReturnDetails | null> {
  try {
    // ── Cache check (fast path) ───────────────────────────────────────────────
    // Honour the resolve cache — if the WS handler already ran, the details are here.
    const cached = _absenceReturnCache.get(userId);
    if (cached && (Date.now() - cached.cachedAt) < ABSENCE_RETURN_CACHE_TTL_MS) {
      return cached.details;
    }

    const db = getSharedDb();

    // ── DB check (read-only) ─────────────────────────────────────────────────
    const [pending] = await db
      .select({
        daysSinceLastSession: danielaAbsenceNudges.daysSinceLastSession,
      })
      .from(danielaAbsenceNudges)
      .where(
        and(
          eq(danielaAbsenceNudges.userId, userId),
          isNull(danielaAbsenceNudges.resolvedAt),
        )
      )
      .limit(1);

    if (!pending) return null;

    // Fetch name for context — non-mutating
    let firstName: string | null = null;
    try {
      const [user] = await db
        .select({ firstName: users.firstName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      firstName = user?.firstName ?? null;
    } catch { /* non-critical */ }

    // Fetch the most recent recorded call transcript from the current absence window only.
    // Guard: bound by createdAt > (now - daysSinceLastSession - 1 day) so we never surface
    // a transcript from an older absence cycle and confuse Daniela's greeting.
    let callTranscript: string | null = null;
    try {
      const daysSince = pending.daysSinceLastSession ?? 0;
      const absenceThreshold = new Date(Date.now() - (daysSince + 1) * 24 * 60 * 60 * 1000);
      const [queueRow] = await db
        .select({ callTranscript: danielaOutboundQueue.callTranscript })
        .from(danielaOutboundQueue)
        .where(
          and(
            eq(danielaOutboundQueue.userId, userId),
            isNotNull(danielaOutboundQueue.callTranscript),
            gt(danielaOutboundQueue.createdAt, absenceThreshold),
          )
        )
        .orderBy(desc(danielaOutboundQueue.createdAt))
        .limit(1);
      callTranscript = queueRow?.callTranscript ?? null;
    } catch { /* non-critical */ }

    return { daysSinceLastSession: pending.daysSinceLastSession ?? 0, firstName, callTranscript };
  } catch (err: any) {
    console.warn(`[AbsenceWorker] peekAbsenceReturnDetails failed for ${userId}: ${err.message}`);
    return null;
  }
}

/**
 * Auto-resolve an absence nudge when the student returns for a session.
 * Called from both the streaming orchestrator (fire-and-forget) and the WS
 * handler (awaited, before pre-session synthesis).
 *
 * Checks whether the student has an unresolved nudge. If so, resolves it,
 * posts an Express Lane note, caches the details, and returns them so the
 * caller can inject returning-student context into Daniela's session greeting.
 *
 * If the nudge was already resolved (e.g. by an earlier fire-and-forget call),
 * the in-memory cache is checked so the second caller still receives the
 * details within the 2-minute session-start window.
 *
 * Returns null when there is no pending nudge and no recent cache entry.
 * Safe to call for every session start — no-ops immediately in the common case.
 */
export async function autoResolveAbsenceNudgeOnReturn(
  userId: string,
): Promise<AbsenceReturnDetails | null> {
  try {
    // ── Cache check (fast path) ───────────────────────────────────────────────
    // If a prior call in this session already resolved the nudge and stored the
    // details here, return them immediately without hitting the DB again.
    const cached = _absenceReturnCache.get(userId);
    if (cached && (Date.now() - cached.cachedAt) < ABSENCE_RETURN_CACHE_TTL_MS) {
      return cached.details;
    }

    const db = getSharedDb();

    // ── DB check ─────────────────────────────────────────────────────────────
    // Look for an unresolved nudge. If none exists, return null (common case).
    const [pending] = await db
      .select({
        id: danielaAbsenceNudges.id,
        daysSinceLastSession: danielaAbsenceNudges.daysSinceLastSession,
      })
      .from(danielaAbsenceNudges)
      .where(
        and(
          eq(danielaAbsenceNudges.userId, userId),
          isNull(danielaAbsenceNudges.resolvedAt),
        )
      )
      .limit(1);

    if (!pending) return null; // Nothing to resolve and nothing cached — common case.

    // ── Resolve ───────────────────────────────────────────────────────────────
    await resolveAbsenceNudge(userId, 'student_returned');

    // Look up the student's name for a human-readable Express Lane note
    let firstName: string | null = null;
    try {
      const [user] = await db
        .select({ firstName: users.firstName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      firstName = user?.firstName ?? null;
    } catch { /* non-critical — name is cosmetic */ }

    const name = firstName ?? `student ${userId.slice(-6)}`;
    const daysSince = pending.daysSinceLastSession ?? 0;

    // Fetch the most recent recorded call transcript from the current absence window only.
    // Guard: bound by createdAt > (now - daysSince - 1 day) so we never surface a transcript
    // from an older absence cycle and confuse Daniela's returning-student greeting.
    let callTranscript: string | null = null;
    try {
      const absenceThreshold = new Date(Date.now() - (daysSince + 1) * 24 * 60 * 60 * 1000);
      const [queueRow] = await db
        .select({ callTranscript: danielaOutboundQueue.callTranscript })
        .from(danielaOutboundQueue)
        .where(
          and(
            eq(danielaOutboundQueue.userId, userId),
            isNotNull(danielaOutboundQueue.callTranscript),
            gt(danielaOutboundQueue.createdAt, absenceThreshold),
          )
        )
        .orderBy(desc(danielaOutboundQueue.createdAt))
        .limit(1);
      callTranscript = queueRow?.callTranscript ?? null;
    } catch { /* non-critical */ }

    const details: AbsenceReturnDetails = { daysSinceLastSession: daysSince, firstName, callTranscript };

    // ── Cache the result ──────────────────────────────────────────────────────
    // Store immediately so any subsequent call within the TTL window returns
    // details even after the DB row is resolved.
    _absenceReturnCache.set(userId, { details, cachedAt: Date.now() });

    // ── Express Lane note ─────────────────────────────────────────────────────
    try {
      const expressSession = await founderCollabService.findOrCreateSessionByTitle(
        EXPRESS_LANE_FOUNDER_ID,
        EXPRESS_LANE_SESSION_TITLE,
      );
      await founderCollabWSBroker.addAndBroadcastMessage(expressSession.id, {
        role: 'system',
        content: `[STUDENT RETURNED] ${name} just started a new session — the pending absence nudge was auto-cleared. No action needed.`,
        messageType: 'text',
        metadata: {
          source: 'absence_worker',
          absentUserId: userId,
          event: 'student_returned',
        },
      });
    } catch (err: any) {
      // Express Lane post is cosmetic — don't let it break the session start path.
      console.warn(`[AbsenceWorker] Failed to post return note for ${name}: ${err.message}`);
    }

    console.log(`[AbsenceWorker] Auto-cleared absence nudge for ${name} on session return (${daysSince} days absent)`);
    return details;
  } catch (err: any) {
    // Never let this bubble up to session start.
    console.warn(`[AbsenceWorker] autoResolveAbsenceNudgeOnReturn failed for ${userId}: ${err.message}`);
    return null;
  }
}

/**
 * Write the hadAbsenceReturn flag onto an existing voice_sessions row.
 *
 * Called by unified-ws-handler.ts (both the GL path and the text-mode path)
 * immediately after autoResolveAbsenceNudgeOnReturn() returns non-null details.
 * Exported so integration tests can call the exact same production function
 * and assert the DB state without reimplementing the update logic inline.
 *
 * Fire-and-forget in the WS handler (errors are non-fatal and logged).
 * In tests, await it so the assertion can read the committed row.
 */
export async function applyAbsenceReturnFlag(
  sessionId: string,
  daysSinceLastSession: number,
): Promise<void> {
  const db = getSharedDb();
  await db.update(voiceSessions)
    .set({
      hadAbsenceReturn: true,
      absenceReturnDays: daysSinceLastSession,
    })
    .where(eq(voiceSessions.id, sessionId));
  console.log(`[AbsenceWorker] ✓ hadAbsenceReturn flag written to voice_sessions row ${sessionId} (${daysSinceLastSession} days)`);
}

export function startDanielaAbsenceWorker(): void {
  console.log('[AbsenceWorker] Starting (interval: 24h, threshold: 5 days absent)');
  // Initial check after 10 minutes to let everything settle and avoid boot storms
  setTimeout(() => {
    runAbsenceCheck();
    setInterval(runAbsenceCheck, CHECK_INTERVAL_MS);
  }, 10 * 60 * 1000);
}
