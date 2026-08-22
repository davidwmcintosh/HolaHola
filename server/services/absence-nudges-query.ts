/**
 * Lightweight DB query for resolved absence nudges.
 *
 * Extracted from daniela-absence-worker.ts so that integration tests can
 * import this function without pulling in the heavy service dependencies
 * (Deepgram, Cartesia, WebSocket brokers, etc.) that live in the worker.
 *
 * daniela-absence-worker.ts re-exports this as `listResolvedNudges`.
 */

import { getSharedDb } from '../db';
import {
  danielaAbsenceNudges,
  users,
} from '@shared/schema';
import { eq, and, isNotNull, desc } from 'drizzle-orm';

export type AbsenceResolutionType = 'student_returned' | 'message_queued' | 'dismissed';

export async function listResolvedNudges(
  limit = 20,
  resolutionType?: AbsenceResolutionType,
): Promise<Array<{
  nudgeId: string;
  userId: string;
  firstName: string | null;
  daysSinceLastSession: number;
  lastSessionDate: Date | null;
  resolvedAt: Date;
  resolutionType: string | null;
}>> {
  const db = getSharedDb();

  const whereClause = resolutionType
    ? and(
        isNotNull(danielaAbsenceNudges.resolvedAt),
        eq(danielaAbsenceNudges.resolutionType, resolutionType),
      )
    : isNotNull(danielaAbsenceNudges.resolvedAt);

  const resolved = await db
    .select({
      id: danielaAbsenceNudges.id,
      userId: danielaAbsenceNudges.userId,
      daysSinceLastSession: danielaAbsenceNudges.daysSinceLastSession,
      lastSessionDate: danielaAbsenceNudges.lastSessionDate,
      resolvedAt: danielaAbsenceNudges.resolvedAt,
      resolutionType: danielaAbsenceNudges.resolutionType,
    })
    .from(danielaAbsenceNudges)
    .where(whereClause)
    .orderBy(desc(danielaAbsenceNudges.resolvedAt))
    .limit(Math.min(limit, 100));

  if (resolved.length === 0) return [];

  const enriched = await Promise.all(
    resolved.map(async (nudge) => {
      let firstName: string | null = null;
      try {
        const [user] = await db
          .select({ firstName: users.firstName })
          .from(users)
          .where(eq(users.id, nudge.userId))
          .limit(1);
        firstName = user?.firstName ?? null;
      } catch { /* non-critical */ }

      return {
        nudgeId: nudge.id,
        userId: nudge.userId,
        firstName,
        daysSinceLastSession: nudge.daysSinceLastSession ?? 0,
        lastSessionDate: nudge.lastSessionDate ?? null,
        resolvedAt: nudge.resolvedAt!,
        resolutionType: nudge.resolutionType ?? null,
      };
    })
  );

  return enriched;
}
