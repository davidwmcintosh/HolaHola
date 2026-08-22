/**
 * Route handler for GET /api/admin/absence-nudges/history
 *
 * Extracted into its own module so that integration tests can import and mount
 * the real handler (with only the DB dependency swapped out) rather than
 * duplicating the limit-parsing logic.
 *
 * DESIGN
 * ------
 * buildAbsenceHistoryHandler() accepts an optional `listNudges` override.
 * In production (routes.ts) the override is omitted and the real
 * listResolvedNudges() from daniela-absence-worker is used.  In tests the
 * override is a lightweight mock whose return-value length reflects the limit
 * argument the handler actually passed in.
 *
 * This means any change to the limit-parsing expression inside the handler
 * (e.g. parseInt → parseFloat) will immediately break the HTTP integration
 * tests because the wrong count will come back from the mock.
 */

import type { Request, Response } from 'express';
import { resolutionTypeSchema } from '../../shared/absence-types';

// ── Types shared with the service layer ──────────────────────────────────────

export type AbsenceResolutionType = 'student_returned' | 'message_queued' | 'dismissed';

export type ListResolvedNudgesFn = (
  limit: number,
  resolutionType?: AbsenceResolutionType,
) => Promise<unknown[]>;

// ── Handler factory ───────────────────────────────────────────────────────────

export function buildAbsenceHistoryHandler(
  listNudgesOverride?: ListResolvedNudgesFn,
) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      // Resolve the DB function: use the override when supplied (tests),
      // otherwise fall back to the real service implementation.
      let listResolvedNudges: ListResolvedNudgesFn;
      if (listNudgesOverride) {
        listResolvedNudges = listNudgesOverride;
      } else {
        const mod = await import('../services/absence-nudges-query');
        listResolvedNudges = mod.listResolvedNudges;
      }

      // ── Limit parsing — this is the expression under test ─────────────────
      const rawLimit = parseInt(req.query.limit as string, 10);
      const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1), 100);
      // ─────────────────────────────────────────────────────────────────────

      // Resolution-type filter — validate with Zod so a misspelled value returns
      // 400 instead of silently being ignored or reaching the DB.
      const rawType = req.query.resolutionType as string | undefined;
      let resolutionType: AbsenceResolutionType | undefined;
      if (rawType !== undefined && rawType !== '') {
        const parsedType = resolutionTypeSchema.safeParse(rawType);
        if (!parsedType.success) {
          res.status(400).json({
            error: 'Invalid resolutionType',
            details: parsedType.error.issues,
          });
          return;
        }
        resolutionType = parsedType.data as AbsenceResolutionType;
      }

      const history = await listResolvedNudges(limit, resolutionType);
      res.json({ history });
    } catch (error: any) {
      console.error('[AbsenceNudges] History endpoint error:', error);
      res.status(500).json({ error: error.message });
    }
  };
}

// Default export: the production handler (no override).
export const absenceHistoryHandler = buildAbsenceHistoryHandler();
