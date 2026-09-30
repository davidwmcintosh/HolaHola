/**
 * Batch sweep that finds Coordination V2 sessions abandoned in a non-terminal
 * state -- for example an attempt reaches waiting_for_host but the host
 * process that was supposed to poll/claim/submit a result crashed or was
 * never started -- and drives each one to a terminal state so its cleanup
 * obligations can run and its transport lease is released.
 *
 * Mirrors coordination-gemini-provider-driver.ts's batch shape: a plain async
 * function other callers (the worker, tests, a one-off script) can invoke
 * directly, oldest-effective-activity-first (see selectStaleSessionCandidates),
 * tolerating individual per-row failures.
 *
 * Two independent staleness signals select a candidate session, matching the
 * two ways task #1642's own interrupted demo runs left rows behind:
 *  - past its own expiresAt (the session's formal deadline already passed), or
 *  - no session-level state change for at least `staleThresholdMs`, even
 *    though its formal expiresAt has not arrived yet (the general "nothing is
 *    driving this forward any more" signal -- covers a long-lived session
 *    whose one active attempt goes silent well before the session's own
 *    deadline).
 *
 * Deliberately does not special-case individual attempts: revokeActiveAttemptAuthority
 * (coordination-cleanup-service.ts) already force-cancels every open attempt
 * the instant its session goes terminal, regardless of the attempt's own
 * deadline. Reaping the session is enough to unstick everything under it.
 */
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { reapStaleCoordinationSession, type ReapStaleSessionOutcome } from './coordination-session-service';

const TERMINAL_SESSION_STATES = ['succeeded', 'failed', 'exhausted', 'expired', 'revoked'] as const;

// 30 minutes: comfortably longer than the default 15-minute transport lease
// duration (coordination-transport-lease-service.ts) and the Gemini driver's
// 5-second poll interval, so a session mid-lease or mid-poll is never reaped
// out from under genuinely live work.
export const DEFAULT_STALE_SESSION_THRESHOLD_MS = 30 * 60 * 1_000;
export const DEFAULT_REAPER_BATCH_LIMIT = 25;

export function staleSessionThresholdMs(): number {
  const raw = Number(process.env.COORDINATION_SESSION_STALE_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_STALE_SESSION_THRESHOLD_MS;
}

export type SweepStaleCoordinationSessionsResult = {
  scanned: number;
  reaped: number;
  expired: number;
  failed: number;
  errors: number;
};

type StaleSessionCandidate = { id: string; state: string };

/**
 * Selects candidate sessions by the SAME "effective last activity" signal
 * reapStaleCoordinationSession itself uses to decide whether a row is really
 * stale: the most recent of the session row's own updatedAt, its latest
 * attempt's updatedAt, and its latest transport-lease receipt's createdAt --
 * not the session row's raw updatedAt alone.
 *
 * This has to happen in the selection query, not just in the per-row check.
 * A prior version filtered/ordered purely by coordinationV2Sessions.updatedAt
 * and left the effective-activity check to reapStaleCoordinationSession. That
 * correctly skipped any individual live-but-old-parent-row session, but a
 * batch of >= `limit` such sessions (stale session-row updatedAt, live
 * attempt/lease activity underneath) would fill every page of the ordered
 * scan -- each one consumes a LIMIT slot and is correctly skipped, but a
 * genuinely abandoned session sorting behind them by raw updatedAt is never
 * reached at all. Filtering and ordering by the corrected signal here means
 * a live session is excluded from the candidate set entirely, instead of
 * merely being skipped after consuming a batch slot the sweep needed for a
 * real candidate.
 */
async function selectStaleSessionCandidates(
  now: Date, staleBefore: Date, limit: number,
): Promise<StaleSessionCandidate[]> {
  const result = await db.execute(sql`
    WITH session_activity AS (
      SELECT s.id, s.state, s.expires_at,
        GREATEST(
          s.updated_at,
          COALESCE((SELECT MAX(a.updated_at) FROM coordination_v2_attempts a WHERE a.session_id = s.id), s.updated_at),
          COALESCE((SELECT MAX(r.created_at) FROM coordination_v2_transport_lease_receipts r WHERE r.session_id = s.id), s.updated_at)
        ) AS effective_last_activity
      FROM coordination_v2_sessions s
      WHERE s.state NOT IN ${[...TERMINAL_SESSION_STATES]}
    )
    SELECT id, state
    FROM session_activity
    WHERE expires_at <= ${now} OR effective_last_activity <= ${staleBefore}
    ORDER BY effective_last_activity ASC
    LIMIT ${limit}
  `);
  return result.rows as unknown as StaleSessionCandidate[];
}

export async function sweepStaleCoordinationSessions(
  limit = DEFAULT_REAPER_BATCH_LIMIT,
  staleThresholdMs = staleSessionThresholdMs(),
): Promise<SweepStaleCoordinationSessionsResult> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - staleThresholdMs);
  const rows = await selectStaleSessionCandidates(now, staleBefore, limit);

  let reaped = 0;
  let expired = 0;
  let failed = 0;
  let errors = 0;
  for (const row of rows) {
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential keeps per-row
      // failures isolated and logs readable; this is a low-frequency sweep,
      // not a hot path that needs fan-out.
      const outcome: ReapStaleSessionOutcome = await reapStaleCoordinationSession({
        sessionId: row.id, staleThresholdMs, now,
      });
      if (outcome.reaped) {
        reaped += 1;
        if (outcome.command === 'expire') expired += 1; else failed += 1;
        console.log(`[CoordinationLifecycleReaper] session ${row.id} reaped via ${outcome.command} (was ${row.state})`);
      }
    } catch (error) {
      errors += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[CoordinationLifecycleReaper] session ${row.id} failed: ${message}`);
    }
  }
  return { scanned: rows.length, reaped, expired, failed, errors };
}
