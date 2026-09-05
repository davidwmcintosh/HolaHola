import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import {
  COORDINATION_ACTOR_IDS,
  type CoordinationActorId,
} from '@shared/schema';

type CoordinationEnvironment = Record<string, string | undefined>;

export interface CoordinationAuthenticatedRequest extends Request {
  coordinationActor?: CoordinationActorId;
}

export const COORDINATION_TOKEN_ENV_BY_ACTOR: Record<
  Exclude<CoordinationActorId, 'coordination-system'>,
  string
> = {
  'luca-replit': 'COORDINATION_LUCA_REPLIT_TOKEN',
  'luca-claude-code': 'COORDINATION_LUCA_CLAUDE_CODE_TOKEN',
  'luca-holahola': 'COORDINATION_LUCA_HOLAHOLA_TOKEN',
  alden: 'COORDINATION_ALDEN_TOKEN',
  daniela: 'COORDINATION_DANIELA_TOKEN',
  david: 'COORDINATION_DAVID_TOKEN',
};

export type CoordinationAuthResolution =
  | { ok: true; actor: CoordinationActorId }
  | { ok: false; status: 401 | 503; error: string };

const actorIds = new Set<string>(COORDINATION_ACTOR_IDS);

/**
 * Resolves a supplied credential using only the server's fixed actor bindings.
 * `environment` is injectable so this function can be tested without mutating
 * process.env.
 */
export function resolveCoordinationActor(
  coordinationToken: string | undefined,
  agentToken: string | undefined,
  environment: CoordinationEnvironment = process.env,
): CoordinationAuthResolution {
  // `agentToken` is intentionally ignored. Keep the parameter during this
  // migration so callers that still pass the old compatibility argument fail
  // closed instead of gaining a second authentication path.
  void agentToken;
  const configuredBindings = Object.entries(COORDINATION_TOKEN_ENV_BY_ACTOR)
    .map(([actor, envName]) => [actor as CoordinationActorId, environment[envName]] as const);

  const validBindings = configuredBindings.filter(
    (binding): binding is [CoordinationActorId, string] => Boolean(binding[1] && binding[1].length >= 32),
  );

  const duplicateTokens = new Set<string>();
  const seenTokens = new Set<string>();
  for (const [, token] of validBindings) {
    if (seenTokens.has(token)) duplicateTokens.add(token);
    seenTokens.add(token);
  }

  // A duplicate makes actor attribution ambiguous. Reject every attempt rather
  // than selecting an arbitrary actor.
  if (duplicateTokens.size > 0) {
    return { ok: false, status: 503, error: 'Coordination authentication has ambiguous token bindings' };
  }

  if (coordinationToken) {
    for (const [actor, token] of validBindings) {
      const provided = Buffer.from(coordinationToken);
      const expected = Buffer.from(token);
      if (provided.length === expected.length && crypto.timingSafeEqual(provided, expected)) {
        return { ok: true, actor };
      }
    }
    return { ok: false, status: 401, error: 'Invalid coordination token' };
  }

  if (validBindings.length === 0) {
    return { ok: false, status: 503, error: 'Coordination authentication is not configured' };
  }
  return { ok: false, status: 401, error: 'Coordination token required (x-coordination-token header)' };
}

function readHeader(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return typeof value === 'string' ? value : undefined;
}

export function requireCoordinationAuth(
  req: CoordinationAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const resolution = resolveCoordinationActor(
    readHeader(req, 'x-coordination-token'),
    undefined,
  );

  if (!resolution.ok) {
    res.status(resolution.status).json({ error: resolution.error });
    return;
  }

  // This invariant narrows the set at runtime too, should bindings change.
  if (!actorIds.has(resolution.actor)) {
    res.status(503).json({ error: 'Coordination actor binding is invalid' });
    return;
  }
  req.coordinationActor = resolution.actor;
  next();
}