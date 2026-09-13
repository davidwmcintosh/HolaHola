import type { Application, Request, Response, RequestHandler } from 'express';
import { requireCoordinationAuth, type CoordinationAuthenticatedRequest } from '../middleware/coordination-auth';
import {
  createOrResumeSession, transitionCoordinationSession, CoordinationSessionError,
} from '../services/coordination-session-service';
import {
  createFreshAttempt, transitionCoordinationAttempt, CoordinationAttemptError,
} from '../services/coordination-attempt-service';
import { resumeSameCoordinationAttempt } from '../services/coordination-attempt-service';
import {
  acceptCoordinationCompletion, transitionCoordinationCleanup, CoordinationCleanupError,
} from '../services/coordination-cleanup-service';

type AuthRequest = CoordinationAuthenticatedRequest & { body: Record<string, unknown>; params: { id: string; attemptId?: string; obligationId?: string } };
type Services = {
  createOrResumeSession: typeof createOrResumeSession;
  transitionCoordinationSession: typeof transitionCoordinationSession;
  createFreshAttempt: typeof createFreshAttempt;
  transitionCoordinationAttempt: typeof transitionCoordinationAttempt;
  resumeSameCoordinationAttempt: typeof resumeSameCoordinationAttempt;
  acceptCoordinationCompletion: typeof acceptCoordinationCompletion;
  transitionCoordinationCleanup: typeof transitionCoordinationCleanup;
};
class RouteCommandError extends Error {
  readonly code = 'COORDINATION_INVALID_COMMAND';
}
export type CoordinationSessionRouteDependencies = {
  coordinationAuthMiddleware?: RequestHandler;
  services?: Partial<Services>;
};

function stringBody(body: Record<string, unknown>, key: string): string | undefined {
  return typeof body[key] === 'string' ? body[key] as string : undefined;
}
function actor(req: AuthRequest): string {
  return req.coordinationActor ?? '';
}
function errorCode(error: unknown): string {
  if (error instanceof RouteCommandError) return error.code;
  if (error instanceof CoordinationSessionError || error instanceof CoordinationAttemptError || error instanceof CoordinationCleanupError) return error.code;
  return 'COORDINATION_DATABASE_UNAVAILABLE';
}
function status(code: string): number {
  if (code.endsWith('NOT_FOUND')) return 404;
  if (code.includes('INVALID_REQUEST')) return 422;
  if (code.includes('CONFLICT') || code.includes('REPLAY') || code.includes('BUDGET') || code.includes('TERMINAL')) return 409;
  if (code.includes('DATABASE')) return 503;
  if (code.includes('GRANT') || code.includes('POLICY') || code.includes('HOST')) return 403;
  return 422;
}
function reply(res: Response, error: unknown): void {
  const code = errorCode(error);
  res.status(status(code)).json({ error: { code } });
}
function bodyCommand(body: Record<string, unknown>): Record<string, unknown> {
  const command = body.command;
  if (!command || typeof command !== 'object' || Array.isArray(command)) throw new RouteCommandError();
  return command as Record<string, unknown>;
}
function command(body: Record<string, unknown>, allowed: readonly string[]): Record<string, unknown> {
  const value = bodyCommand(body);
  if (typeof value.type !== 'string' || !allowed.includes(value.type)) throw new RouteCommandError();
  return value;
}
function requestKey(req: AuthRequest): string {
  return req.get('Idempotency-Key') || stringBody(req.body, 'requestKey') || '';
}

export function registerCoordinationSessionRoutes(
  app: Application,
  dependencies: CoordinationSessionRouteDependencies = {},
): void {
  const auth = dependencies.coordinationAuthMiddleware ?? requireCoordinationAuth;
  const services: Services = {
    createOrResumeSession, transitionCoordinationSession, createFreshAttempt,
    transitionCoordinationAttempt, resumeSameCoordinationAttempt, acceptCoordinationCompletion, transitionCoordinationCleanup,
    ...dependencies.services,
  };

  app.post('/api/coordination/v2/sessions', auth, async (req: Request, res: Response) => {
    const request = req as AuthRequest;
    try {
      const body = request.body;
      const result = await services.createOrResumeSession({
        operatorActor: actor(request), operatorGrantId: stringBody(body, 'operatorGrantId') || '',
        policyVersionId: stringBody(body, 'policyVersionId') || '', taskRef: stringBody(body, 'taskRef') || '',
        taskArtifactSha256: stringBody(body, 'taskArtifactSha256') || '',
        repositoryIdentity: stringBody(body, 'repositoryIdentity') || '',
        startingCommit: stringBody(body, 'startingCommit') || '',
        enrolledHostId: stringBody(body, 'enrolledHostId') || '',
        requestedProviders: Array.isArray(body.requestedProviders)
          ? body.requestedProviders.filter((item: unknown): item is string => typeof item === 'string') : [],
        idempotencyKey: requestKey(request),
      });
      res.status(result.created === false ? 200 : 201).json(result);
    } catch (error) { reply(res, error); }
  });

  app.post('/api/coordination/v2/sessions/:id/transitions', auth, async (req: Request, res: Response) => {
    const request = req as AuthRequest;
    try {
      res.json(await services.transitionCoordinationSession({
        sessionId: request.params.id, requestKey: requestKey(request),
        actorId: actor(request), command: command(request.body, [
          'preparation_ready', 'start_attempt', 'transport_recovered', 'begin_verification',
          'accept_completion', 'retry', 'fail', 'exhaust', 'expire', 'revoke', 'host_wait',
        ]) as any,
      }));
    } catch (error) { reply(res, error); }
  });

  app.post('/api/coordination/v2/sessions/:id/attempts', auth, async (req: Request, res: Response) => {
    const request = req as AuthRequest;
    try {
      const body = request.body;
      const result = await services.createFreshAttempt({
        sessionId: request.params.id, requestKey: requestKey(request),
        actorId: actor(request), provider: stringBody(body, 'provider') || '',
        model: stringBody(body, 'model') || '', adapterVersion: stringBody(body, 'adapterVersion') || '',
        attemptGeneration: stringBody(body, 'attemptGeneration'),
        previousAttemptId: stringBody(body, 'previousAttemptId'),
        classification: stringBody(body, 'classification') as any,
      });
      res.status((result as { created?: boolean }).created === false ? 200 : 201).json(result);
    } catch (error) { reply(res, error); }
  });

  app.post('/api/coordination/v2/attempts/:id/transitions', auth, async (req: Request, res: Response) => {
    const request = req as AuthRequest;
    try {
      res.json(await services.transitionCoordinationAttempt({
        attemptId: request.params.id, requestKey: requestKey(request),
        actorId: actor(request), command: command(request.body, [
          'provider_started', 'intent_ready', 'host_wait', 'host_started', 'result_ready',
          'provider_continuation', 'provider_resumed', 'transport_recovered', 'complete',
          'fail', 'cancel',
        ]) as any,
      }));
    } catch (error) { reply(res, error); }
  });

  app.post('/api/coordination/v2/attempts/:id/resume', auth, async (req: Request, res: Response) => {
    const request = req as AuthRequest;
    try {
      res.json(await services.resumeSameCoordinationAttempt({
        attemptId: request.params.id, requestKey: requestKey(request), actorId: actor(request),
      }));
    } catch (error) { reply(res, error); }
  });

  app.post('/api/coordination/v2/sessions/:id/completion', auth, async (req: Request, res: Response) => {
    const request = req as AuthRequest;
    try {
      const body = request.body;
      res.json(await services.acceptCoordinationCompletion({
        sessionId: request.params.id, requestKey: requestKey(request),
        actorId: actor(request), evidence: Array.isArray(body.evidence) ? body.evidence : [],
      }));
    } catch (error) { reply(res, error); }
  });

}