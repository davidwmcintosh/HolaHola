import type { Application, Response } from 'express';
import {
  requireCoordinationAuth,
  type CoordinationAuthenticatedRequest,
} from '../middleware/coordination-auth';
import { COORDINATION_ACTOR_IDS, type CoordinationActorId } from '@shared/schema';
import {
  formatCoordinationRuntimeStatusJson,
  getCoordinationRuntimeStatus,
  type CoordinationRuntimeStatusFilter,
} from '../scripts/coordination-runtime-status';

/**
 * Read-only HTTP surface for coordination-runtime-status.ts's operator CLI.
 * Alden's own runtime and any future operations dashboard can call this
 * instead of shelling out to `npx tsx server/scripts/coordination-runtime-status.ts`.
 *
 * Deliberately thin: the query (getCoordinationRuntimeStatus) and the JSON
 * shape (formatCoordinationRuntimeStatusJson) both live in
 * coordination-runtime-status.ts and are only called from here, never
 * reimplemented -- so the CLI and this route can never drift apart on what
 * "status" means or how a row is rendered. This route only adds request
 * parsing/validation and the HTTP envelope.
 *
 * Auth follows the same requireCoordinationAuth pattern as the other
 * coordination:read GET routes in coordination-routes.ts (e.g.
 * /api/coordination/threads, /api/coordination/operations): any
 * authenticated coordination actor with the coordination:read capability
 * may call it, with no further actor allowlist. That matches the
 * CLI's own scope -- it has no actor concept at all and is run directly
 * against the database by an operator -- translated to "any authenticated
 * coordination actor" for the HTTP surface.
 */

class RuntimeStatusRouteError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'RuntimeStatusRouteError';
  }
}

const SUPPORTED_QUERY_PARAMETERS = new Set(['actor', 'runtimeIds', 'includeDisabled']);

function actorFilter(value: unknown): CoordinationActorId | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !COORDINATION_ACTOR_IDS.includes(value as CoordinationActorId)) {
    throw new RuntimeStatusRouteError(
      `actor must be one of ${COORDINATION_ACTOR_IDS.join(', ')}`,
      400,
      'invalid_actor',
    );
  }
  return value as CoordinationActorId;
}

/** Accepts either one `?runtimeIds=x` or repeated `?runtimeIds=x&runtimeIds=y` -- Express already arrays the latter. */
function runtimeIdsFilter(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  const values = Array.isArray(value) ? value : [value];
  if (values.length === 0 || !values.every((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)) {
    throw new RuntimeStatusRouteError(
      'runtimeIds must be one or more non-empty strings',
      400,
      'invalid_request',
    );
  }
  return values;
}

function sendError(res: Response, error: unknown): void {
  if (error instanceof RuntimeStatusRouteError) {
    res.status(error.statusCode).json({ error: error.message, code: error.code });
    return;
  }
  console.error('[CoordinationRuntimeStatusRoutes] Query failed:', error);
  res.status(500).json({ error: 'Coordination runtime status query failed', code: 'internal_error' });
}

export function registerCoordinationRuntimeStatusRoutes(app: Application): void {
  app.get(
    '/api/coordination/runtime-status',
    requireCoordinationAuth,
    async (req: CoordinationAuthenticatedRequest, res: Response) => {
      try {
        const unsupported = Object.keys(req.query).filter((name) => !SUPPORTED_QUERY_PARAMETERS.has(name));
        if (unsupported.length > 0) {
          throw new RuntimeStatusRouteError(
            `Unsupported query parameter${unsupported.length === 1 ? '' : 's'}: ${unsupported.join(', ')}`,
            400,
            'unsupported_query_parameter',
          );
        }

        const filter: CoordinationRuntimeStatusFilter = {
          actor: actorFilter(req.query.actor),
          runtimeIds: runtimeIdsFilter(req.query.runtimeIds),
          includeDisabled: req.query.includeDisabled === 'true',
        };

        const rows = await getCoordinationRuntimeStatus(filter);
        // formatCoordinationRuntimeStatusJson is the same formatter the CLI's
        // --json flag uses; parsing its output back into an object (rather
        // than reimplementing the row->JSON mapping here) is what keeps this
        // route byte-for-byte consistent with the CLI's JSON shape.
        const runtimes: unknown = JSON.parse(formatCoordinationRuntimeStatusJson(rows));

        res.json({
          actor: req.coordinationActor,
          filter: {
            actor: filter.actor ?? null,
            runtimeIds: filter.runtimeIds ?? null,
            includeDisabled: filter.includeDisabled,
          },
          runtimes,
        });
      } catch (error) {
        sendError(res, error);
      }
    },
  );
}
