import type { Application, Request, Response, RequestHandler } from 'express';
import { requireCoordinationAuth, type CoordinationAuthenticatedRequest } from '../middleware/coordination-auth';
import {
  acquireCoordinationTransportLease,
  renewCoordinationTransportLease,
  releaseCoordinationTransportLease,
  expireCoordinationTransportLease,
  takeoverCoordinationTransportLease,
  submitStaleCoordinationLeaseReconciliation,
  pollCoordinationTransportWork,
  claimCoordinationTransportWork,
  resultCoordinationTransportWork,
  acknowledgeCoordinationCleanup,
  cleanupCoordinationTransportWork,
  CoordinationTransportLeaseError,
} from '../services/coordination-transport-lease-service';

type HostRequest = CoordinationAuthenticatedRequest & {
  body: Record<string, unknown>;
  params: { id?: string; operation?: string };
};

type HostServices = {
  acquireCoordinationTransportLease: typeof acquireCoordinationTransportLease;
  renewCoordinationTransportLease: typeof renewCoordinationTransportLease;
  releaseCoordinationTransportLease: typeof releaseCoordinationTransportLease;
  expireCoordinationTransportLease: typeof expireCoordinationTransportLease;
  takeoverCoordinationTransportLease: typeof takeoverCoordinationTransportLease;
  submitStaleCoordinationLeaseReconciliation: typeof submitStaleCoordinationLeaseReconciliation;
  pollCoordinationTransportWork: typeof pollCoordinationTransportWork;
  claimCoordinationTransportWork: typeof claimCoordinationTransportWork;
  resultCoordinationTransportWork: typeof resultCoordinationTransportWork;
  acknowledgeCoordinationCleanup: typeof acknowledgeCoordinationCleanup;
  cleanupCoordinationTransportWork: typeof cleanupCoordinationTransportWork;
};

export type CoordinationHostRouteDependencies = {
  coordinationAuthMiddleware?: RequestHandler;
  services?: Partial<HostServices>;
};

class HostRouteCommandError extends Error {
  readonly code = 'COORDINATION_INVALID_COMMAND';
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function requestKey(req: HostRequest): string {
  return req.get('Idempotency-Key') || stringValue(req.body?.requestKey) || '';
}

function actor(req: HostRequest): string {
  return req.coordinationActor ?? '';
}

function bodyCommand(body: Record<string, unknown>): Record<string, unknown> {
  body = body ?? {};
  if (body.command && typeof body.command === 'object' && !Array.isArray(body.command)) {
    return body.command as Record<string, unknown>;
  }
  return body;
}

function operation(body: Record<string, unknown>, allowed: readonly string[]): string {
  const value = stringValue(bodyCommand(body).type);
  if (!value || !allowed.includes(value)) throw new HostRouteCommandError();
  return value;
}

function hostInput(req: HostRequest, command: Record<string, unknown>, leaseId?: string) {
  const body = req.body ?? {};
  const sessionId = stringValue(body.sessionId) || stringValue(command.sessionId) || '';
  const holderInstanceId = stringValue(body.holderInstanceId) || stringValue(command.holderInstanceId) || '';
  const rawEpoch = command.epoch ?? body.epoch;
  const rawDuration = command.durationMs ?? command.duration ?? body.durationMs ?? body.duration;
  return {
    sessionId, holderInstanceId, actorId: actor(req),
    requestKey: requestKey(req), leaseId,
    ...(typeof rawEpoch === 'number' ? { epoch: rawEpoch } : {}),
    ...(typeof rawDuration === 'number' ? { durationMs: rawDuration } : {}),
  };
}

function errorCode(error: unknown): string {
  if (error instanceof HostRouteCommandError) return error.code;
  if (error instanceof CoordinationTransportLeaseError) return error.code;
  return 'LEASE_DATABASE_UNAVAILABLE';
}

function errorStatus(code: string): number {
  if (code === 'LEASE_NOT_FOUND') return 404;
  if (code === 'LEASE_INVALID_REQUEST' || code === 'COORDINATION_INVALID_COMMAND') return 422;
  if (code === 'LEASE_AUTHORIZATION_DENIED' || code === 'LEASE_HOST_MISMATCH') return 403;
  if (code === 'LEASE_DATABASE_UNAVAILABLE') return 503;
  return 409;
}

function replyError(res: Response, error: unknown): void {
  const code = errorCode(error);
  res.status(errorStatus(code)).json({ error: { code } });
}

export function registerCoordinationHostRoutes(
  app: Application,
  dependencies: CoordinationHostRouteDependencies = {},
): void {
  const auth = dependencies.coordinationAuthMiddleware ?? requireCoordinationAuth;
  const services: HostServices = {
    acquireCoordinationTransportLease,
    renewCoordinationTransportLease,
    releaseCoordinationTransportLease,
    expireCoordinationTransportLease,
    takeoverCoordinationTransportLease,
    submitStaleCoordinationLeaseReconciliation,
    pollCoordinationTransportWork,
    claimCoordinationTransportWork,
    resultCoordinationTransportWork,
    acknowledgeCoordinationCleanup,
    cleanupCoordinationTransportWork,
    ...dependencies.services,
  };

  // Acquire and takeover are explicit commands rather than an implicit
  // "ensure lease" operation; this keeps takeover's epoch boundary visible.
  app.post('/api/coordination/v2/host/leases', auth, async (rawReq: Request, res: Response) => {
    const req = rawReq as HostRequest;
    try {
      const body = bodyCommand(req.body);
      const kind = operation(req.body, ['acquire', 'takeover']);
      const input = hostInput(req, body);
      const result = kind === 'acquire'
        ? await services.acquireCoordinationTransportLease(input)
        : await services.takeoverCoordinationTransportLease(input);
      res.status(kind === 'acquire' ? 201 : 200).json(result);
    } catch (error) { replyError(res, error); }
  });

  for (const kind of ['renew', 'release', 'expire'] as const) {
    app.post(`/api/coordination/v2/host/leases/:id/${kind}`, auth, async (rawReq: Request, res: Response) => {
      const req = rawReq as HostRequest;
      try {
        const command = bodyCommand(req.body);
        if (command.type !== undefined && command.type !== kind) throw new HostRouteCommandError();
        const input = hostInput(req, command, req.params.id);
        const result = kind === 'renew'
          ? await services.renewCoordinationTransportLease(input)
          : kind === 'release'
            ? await services.releaseCoordinationTransportLease(input)
            : await services.expireCoordinationTransportLease(input);
        res.json(result);
      } catch (error) { replyError(res, error); }
    });
  }

  app.post('/api/coordination/v2/host/leases/:id/takeover', auth, async (rawReq: Request, res: Response) => {
    const req = rawReq as HostRequest;
    try {
      const command = bodyCommand(req.body);
      if (command.type !== undefined && command.type !== 'takeover') throw new HostRouteCommandError();
      res.json(await services.takeoverCoordinationTransportLease(hostInput(req, command, req.params.id)));
    } catch (error) { replyError(res, error); }
  });

  // The URL identifies the session. The service derives enrolledHostId from
  // the locked session; holderInstanceId is only an ephemeral lease CAS key.
  for (const kind of ['poll', 'claim', 'result', 'ack', 'cleanup'] as const) {
    app.post(`/api/coordination/v2/host/sessions/:id/${kind}`, auth, async (rawReq: Request, res: Response) => {
      const req = rawReq as HostRequest;
      try {
        const command = bodyCommand(req.body);
        if (command.type !== undefined && command.type !== kind) throw new HostRouteCommandError();
        const { enrolledHostId: _ignoredEnrolledHostId, ...safeCommand } = command;
      const commandLeaseId = stringValue(safeCommand.leaseId);
      const input = {
          ...hostInput(req, { ...safeCommand, sessionId: req.params.id }, commandLeaseId),
          sessionId: req.params.id,
          operation: kind,
          command: safeCommand,
          ...(typeof safeCommand.attemptId === 'string' ? { attemptId: safeCommand.attemptId } : {}),
          ...(typeof safeCommand.claimId === 'string' ? { claimId: safeCommand.claimId } : {}),
          ...(typeof safeCommand.obligationId === 'string' ? { obligationId: safeCommand.obligationId } : {}),
          ...(safeCommand.result && typeof safeCommand.result === 'object' ? { result: safeCommand.result } : {}),
          ...(safeCommand.evidence && typeof safeCommand.evidence === 'object' ? { evidence: safeCommand.evidence } : {}),
        } as Parameters<typeof services.pollCoordinationTransportWork>[0];
        const serviceInput = input as any;
        const result = kind === 'poll'
          ? await services.pollCoordinationTransportWork(serviceInput)
          : kind === 'claim'
            ? await services.claimCoordinationTransportWork(serviceInput)
            : kind === 'result'
              ? await services.resultCoordinationTransportWork(serviceInput)
              : kind === 'ack'
                ? await services.acknowledgeCoordinationCleanup(serviceInput)
                : await services.cleanupCoordinationTransportWork(serviceInput);
        res.json(result);
      } catch (error) { replyError(res, error); }
    });
  }

  app.post('/api/coordination/v2/host/sessions/:id/reconciliation', auth, async (rawReq: Request, res: Response) => {
    const req = rawReq as HostRequest;
    try {
      const command = bodyCommand(req.body);
      if (command.type !== undefined && command.type !== 'reconciliation') throw new HostRouteCommandError();
      const { enrolledHostId: _ignoredEnrolledHostId, ...safeCommand } = command;
      const input = hostInput(req, { ...safeCommand, sessionId: req.params.id });
      const evidence = safeCommand.evidence ?? req.body.evidence;
      res.status(201).json(await services.submitStaleCoordinationLeaseReconciliation({
        ...input,
        sessionId: req.params.id!,
        evidence: evidence as Record<string, unknown>,
      }));
    } catch (error) { replyError(res, error); }
  });
}