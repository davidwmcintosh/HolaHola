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
import {
  validateHostEnvelope,
  CoordinationHostProtocolError,
  type HostEnvelope,
  type HostBinding,
} from '../services/coordination-host-protocol';

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
  /** Server wall clock used only for protocol freshness, never lease authority. */
  now?: () => number;
};

class HostRouteCommandError extends Error { readonly code = 'COORDINATION_INVALID_COMMAND'; }

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function actor(req: HostRequest): string {
  return req.coordinationActor ?? '';
}

function envelope(req: HostRequest, expected?: string, now = Date.now()): HostEnvelope {
  const value = validateHostEnvelope(req.body, { now });
  if (expected && value.kind !== expected) throw new HostRouteCommandError();
  return value;
}

function requestKey(req: HostRequest, value: HostEnvelope): string {
  return req.get('Idempotency-Key') || value.requestId;
}

function hostInput(req: HostRequest, value: HostEnvelope, leaseId?: string) {
  const payload = value.payload as Record<string, unknown>;
  const binding = payload.binding as Record<string, unknown> | undefined;
  const sessionId = stringValue(binding?.sessionId) || stringValue(payload.sessionId) || '';
  const holderInstanceId = stringValue(binding?.holderInstanceId) || stringValue(payload.holderInstanceId) || '';
  const rawEpoch = binding?.leaseEpoch;
  const rawDuration = payload.durationMs;
  return {
    sessionId, holderInstanceId, actorId: actor(req),
    requestKey: requestKey(req, value), leaseId,
    command: value,
    ...(binding ? { protocolBinding: binding as HostBinding } : {}),
    ...(typeof rawEpoch === 'number' ? { epoch: rawEpoch } : {}),
    ...(typeof rawDuration === 'number' ? { durationMs: rawDuration } : {}),
  };
}

function errorCode(error: unknown): string {
  if (error instanceof HostRouteCommandError) return error.code;
  if (error instanceof CoordinationHostProtocolError) return error.code;
  if (error instanceof CoordinationTransportLeaseError) return error.code;
  return 'LEASE_DATABASE_UNAVAILABLE';
}

function errorStatus(code: string): number {
  if (code === 'LEASE_NOT_FOUND') return 404;
  if (code === 'LEASE_INVALID_REQUEST' || code === 'COORDINATION_INVALID_COMMAND') return 422;
  if (code.startsWith('HOST_PROTOCOL_')) return 422;
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
  const protocolNow = dependencies.now ?? Date.now;

  // Acquire and takeover are explicit commands rather than an implicit
  // "ensure lease" operation; this keeps takeover's epoch boundary visible.
  app.post('/api/coordination/v2/host/leases', auth, async (rawReq: Request, res: Response) => {
    const req = rawReq as HostRequest;
    try {
      const value = envelope(req, 'lease_request', protocolNow());
      const payload = value.payload as Record<string, unknown>;
      const kind = 'acquire';
      const input = hostInput(req, value);
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
        const value = envelope(req, 'lease_renewal', protocolNow());
        const input = {
          ...hostInput(req, value, req.params.id),
          authorizedOperation: kind,
        };
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
        const value = envelope(req, 'lease_request', protocolNow());
        res.json(await services.takeoverCoordinationTransportLease(hostInput(req, value, req.params.id)));
    } catch (error) { replyError(res, error); }
  });

  // The URL identifies the session. The service derives enrolledHostId from
  // the locked session; holderInstanceId is only an ephemeral lease CAS key.
  for (const kind of ['poll', 'claim', 'result', 'ack', 'cleanup'] as const) {
    app.post(`/api/coordination/v2/host/sessions/:id/${kind}`, auth, async (rawReq: Request, res: Response) => {
      const req = rawReq as HostRequest;
      try {
        const expectedKind = kind === 'poll' ? 'work_poll' : kind === 'claim' ? 'operation_claim'
          : kind === 'result' ? 'structured_result' : 'cleanup_acknowledgement';
        const value = envelope(req, expectedKind, protocolNow());
        const payload = value.payload as Record<string, unknown>;
        const binding = payload.binding as Record<string, unknown>;
        if (binding?.sessionId !== req.params.id) throw new CoordinationHostProtocolError('HOST_PROTOCOL_BINDING_MISMATCH');
      const commandLeaseId = stringValue(binding?.transportLeaseId);
      const safeCommand = payload;
      const input = {
          ...hostInput(req, value, commandLeaseId),
          sessionId: req.params.id,
          operation: kind,
          protocolBinding: binding,
          authorizedOperation: kind,
           command: value,
           ...(typeof binding?.attemptId === 'string' ? { attemptId: binding.attemptId } : {}),
          ...(typeof safeCommand.claimId === 'string' ? { claimId: safeCommand.claimId } : {}),
          ...(typeof safeCommand.obligationId === 'string' ? { obligationId: safeCommand.obligationId } : {}),
          ...(safeCommand.result && typeof safeCommand.result === 'object' ? { result: safeCommand.result } : {}),
          ...(safeCommand.evidence && typeof safeCommand.evidence === 'object' ? { evidence: safeCommand.evidence } : {}),
        } as unknown as Parameters<typeof services.pollCoordinationTransportWork>[0];
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
       const value = envelope(req, 'safe_diagnostics', protocolNow());
       const payload = value.payload as Record<string, unknown>;
       const binding = payload.binding as Record<string, unknown>;
       if (binding?.sessionId !== req.params.id) throw new CoordinationHostProtocolError('HOST_PROTOCOL_BINDING_MISMATCH');
       const input = hostInput(req, value);
       const evidence = { entries: payload.entries };
      res.status(201).json(await services.submitStaleCoordinationLeaseReconciliation({
        ...input,
        sessionId: req.params.id!,
        evidence: evidence as Record<string, unknown>,
      }));
    } catch (error) { replyError(res, error); }
  });
}