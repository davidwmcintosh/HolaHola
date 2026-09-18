import type { Application, Request, Response, RequestHandler } from 'express';
import { requireCoordinationV2HostAuth, requireCoordinationV2HostIdentityAuth, type CoordinationV2HostAuthenticatedRequest } from '../middleware/coordination-v2-host-auth';
import { launchOrResumeCoordinationLifecycle, reserveCoordinationLifecyclePreparation, type CoordinationLifecycleFacadeDependencies } from '../services/coordination-lifecycle-facade-service';
import { transitionCoordinationSession } from '../services/coordination-session-service';
import { createFreshAttempt } from '../services/coordination-attempt-service';
import { DEFAULT_PROVIDER_REGISTRY } from '../services/coordination-provider-adapters/registry';
import { issueCoordinationV2SessionCredential, renewCoordinationV2SessionCredential } from '../services/coordination-v2-host-auth-service';
import { db } from '../db';
import { coordinationV2Attempts, coordinationV2Sessions } from '@shared/schema';
import { and, desc, eq } from 'drizzle-orm';
import {
  promoteCoordinationWindowsPreparation,
  acknowledgeCoordinationWindowsPreparation,
  recoverCoordinationWindowsPreparation,
  acknowledgeCoordinationWindowsPreparationBeforeSession,
  promoteCoordinationWindowsPreparationBeforeSession,
  reserveCoordinationWindowsPreparation,
  readCoordinationWindowsPreparation,
} from '../services/coordination-windows-generation';
import { issueCoordinationV2PreparationEnvelope } from '../services/coordination-v2-preparation-material-service';
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

type HostRequest = CoordinationV2HostAuthenticatedRequest & {
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

export type CoordinationHostOpaqueState = {
  sessionId: string; reservationId: string; generationId: string;
  policyVersionId: string; attemptId: string; enrolledHostId: string;
};

export type CoordinationHostRouteDependencies = {
  coordinationAuthMiddleware?: RequestHandler;
  coordinationIdentityAuthMiddleware?: RequestHandler;
  issueSessionCredentials?: boolean;
  issueSessionCredential?: typeof issueCoordinationV2SessionCredential;
  resolveSessionAttempt?: (sessionId: string) => Promise<string | undefined>;
  renewSessionCredential?: typeof renewCoordinationV2SessionCredential;
  services?: Partial<HostServices>;
  /** Server wall clock used only for protocol freshness, never lease authority. */
  now?: () => number;
  lifecycle?: CoordinationLifecycleFacadeDependencies;
  reserveLifecyclePreparation?: typeof reserveCoordinationLifecyclePreparation;
  issuePreparationEnvelope?: typeof issueCoordinationV2PreparationEnvelope;
  readAcknowledgedState?: (reservation: { id: string; sessionId?: string | null; generationId: string; policyVersionId?: string | null }) =>
    Promise<CoordinationHostOpaqueState | undefined>;
  promotePreparationBeforeSession?: typeof promoteCoordinationWindowsPreparationBeforeSession;
  acknowledgePreparationBeforeSession?: typeof acknowledgeCoordinationWindowsPreparationBeforeSession;
  createInitialAttempt?: typeof createFreshAttempt;
  acknowledgeAndProjectState?: (input: Parameters<typeof acknowledgeCoordinationWindowsPreparationBeforeSession>[0]) =>
    Promise<{ reservation: Awaited<ReturnType<typeof acknowledgeCoordinationWindowsPreparationBeforeSession>>; state: CoordinationHostOpaqueState }>;
};

class HostRouteCommandError extends Error { readonly code = 'COORDINATION_INVALID_COMMAND'; }

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function actor(req: HostRequest): string {
  return req.coordinationV2Host?.hostEnrollmentId ?? '';
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
  // This namespace must never fall back to actor/runtime authentication.
  const auth = dependencies.coordinationAuthMiddleware ?? requireCoordinationV2HostAuth;
  const identityAuth = dependencies.coordinationIdentityAuthMiddleware ?? requireCoordinationV2HostIdentityAuth;
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
  const reserveLifecycle = dependencies.reserveLifecyclePreparation ?? reserveCoordinationLifecyclePreparation;
  const issuePreparation = dependencies.issuePreparationEnvelope ?? issueCoordinationV2PreparationEnvelope;
  const promoteBeforeSession = dependencies.promotePreparationBeforeSession ?? promoteCoordinationWindowsPreparationBeforeSession;
  const acknowledgeBeforeSession = dependencies.acknowledgePreparationBeforeSession ?? acknowledgeCoordinationWindowsPreparationBeforeSession;
  const createInitial = dependencies.createInitialAttempt ?? createFreshAttempt;
  const readAcknowledged = dependencies.readAcknowledgedState ?? (async (reservation) => {
    if (!reservation.sessionId) return undefined;
    const session = (await db.select().from(coordinationV2Sessions)
      .where(eq(coordinationV2Sessions.id, reservation.sessionId)).limit(1))[0];
    const attempt = session
      ? (await db.select({ id: coordinationV2Attempts.id }).from(coordinationV2Attempts)
        .where(eq(coordinationV2Attempts.sessionId, session.id))
        .orderBy(desc(coordinationV2Attempts.createdAt)).limit(1))[0]
      : undefined;
    return session && attempt ? {
      sessionId: session.id, reservationId: reservation.id, generationId: reservation.generationId,
      policyVersionId: session.policyVersionId, attemptId: attempt.id, enrolledHostId: session.enrolledHostId,
    } : undefined;
  });

  app.post('/api/coordination/v2/host/lifecycle', identityAuth, async (rawReq: Request, res: Response) => {
    const req = rawReq as HostRequest;
    try {
      const body = req.body;
      if (Object.keys(body).some((key) => !['taskRef', 'policySelector', 'holderInstanceId'].includes(key))) {
        throw new HostRouteCommandError();
      }
      if (typeof body.taskRef !== 'string' || !/^[1-9][0-9]*$/.test(body.taskRef)) throw new HostRouteCommandError();
      if (typeof body.holderInstanceId !== 'string' || body.holderInstanceId.length < 1) throw new HostRouteCommandError();
      const lifecycleRequestKey = req.get('Idempotency-Key') || `host:${body.taskRef}`;
      const deferred = await reserveLifecycle(
        { taskRef: body.taskRef, ...(typeof body.policySelector === 'string' ? { policySelector: body.policySelector } : {}) },
        { actorId: req.coordinationV2Host?.hostEnrollmentId ?? '', requestKey: lifecycleRequestKey },
        dependencies.lifecycle,
      );
      const material = deferred.reservation.state === 'acknowledged' ? undefined : await issuePreparation({
        taskRef: body.taskRef, hostEnrollmentId: req.coordinationV2Host!.hostEnrollmentId,
        preparationGeneration: deferred.reservation.generationId, reservationId: deferred.reservation.id,
        publicMaterialDigest: deferred.reservation.publicMaterialDigest, policyVersionId: deferred.policyVersionId,
      });
      let opaqueState: Record<string, unknown> | undefined;
      if (deferred.reservation.state === 'acknowledged') {
        opaqueState = await readAcknowledged(deferred.reservation);
      }
      if (deferred.reservation.state === 'acknowledged' && !opaqueState) {
        throw new HostRouteCommandError();
      }
      res.json({
        ...(deferred.reservation.state === 'acknowledged'
          ? { state: opaqueState, alreadyAcknowledged: true, opaqueState }
          : {
            state: 'preparing',
            preparation: { reservation: deferred.reservation, ...(material ? { envelope: material } : {}) },
            preflightEnvelope: material,
            alreadyAcknowledged: false,
          }),
        // Host identity is transport binding only. It lives in opaque output
        // and is never copied into operator-safe lifecycle output.
        opaque: {
          hostEnrollmentId: req.coordinationV2Host!.hostEnrollmentId,
          preparationReservationId: deferred.reservation.id,
          generationId: deferred.reservation.generationId,
          policyVersionId: deferred.reservation.policyVersionId,
        },
      });
      return;
      /*
      const result = await launchOrResumeCoordinationLifecycle(
        { taskRef: body.taskRef, ...(typeof body.policySelector === 'string' ? { policySelector: body.policySelector } : {}) },
        { actorId: req.coordinationV2Host?.hostEnrollmentId ?? '', requestKey: lifecycleRequestKey },
        dependencies.lifecycle,
      );
      const sessionRows = await db.select({
        id: coordinationV2Sessions.id, taskRef: coordinationV2Sessions.taskRef,
        taskArtifactSha256: coordinationV2Sessions.taskArtifactSha256,
        policyVersionId: coordinationV2Sessions.policyVersionId,
      }).from(coordinationV2Sessions)
        .where(and(eq(coordinationV2Sessions.operatorActor, req.coordinationV2Host?.hostEnrollmentId ?? ''),
          eq(coordinationV2Sessions.idempotencyKey, lifecycleRequestKey)));
      const sessionId = sessionRows[0]?.id;
      let preparation: unknown;
      if (result.state === 'preparing' && sessionId && req.coordinationV2Host) {
        const reservation = await reserveCoordinationWindowsPreparation({
          sessionId, actorId: req.coordinationV2Host.hostEnrollmentId,
          reserveRequestKey: `${lifecycleRequestKey}:preparation`,
        });
        const material = reservation.state === 'acknowledged' ? undefined : await issueCoordinationV2PreparationEnvelope({
          taskRef: sessionRows[0].taskRef, hostEnrollmentId: req.coordinationV2Host.hostEnrollmentId,
          preparationGeneration: reservation.generationId, reservationId: reservation.id,
          publicMaterialDigest: reservation.publicMaterialDigest, policyVersionId: sessionRows[0].policyVersionId,
        });
        preparation = { reservation, ...(material ? { envelope: material } : {}), alreadyAcknowledged: reservation.state === 'acknowledged' };
      } else if (sessionId && req.coordinationV2Host) {
        const reservation = await readCoordinationWindowsPreparation({
          sessionId, actorId: req.coordinationV2Host.hostEnrollmentId,
        });
        preparation = reservation ? { reservation, alreadyAcknowledged: reservation.state === 'acknowledged' } : undefined;
      }
      if (!['running', 'waiting_for_host', 'verifying'].includes(result.state)
        || typeof sessionId !== 'string' || !req.coordinationV2Host) {
        res.json({ ...result, ...(preparation ? { preparation, preflightEnvelope: (preparation as any).envelope } : {}), terminalState: result.state === 'preparing' || result.state === 'ready' ? undefined : result.state });
        return;
      }
      const holder = body.holderInstanceId;
      res.json({
        ...result, ...(preparation ? { preparation, preflightEnvelope: (preparation as any).envelope } : {}),
        state: {
          sessionId, holderInstanceId: holder,
          binding: { sessionId, holderInstanceId: holder, enrolledHostId: req.coordinationV2Host.hostEnrollmentId },
        },
      });
      */
    } catch (error) { replyError(res, error); }
  });

  app.post('/api/coordination/v2/host/sessions/:id/renew', identityAuth, async (rawReq: Request, res: Response) => {
    const req = rawReq as HostRequest;
    try {
      const token = req.get('x-coordination-v2-session-token') ?? '';
      const proof = req.get('x-coordination-v2-session-proof') ?? '';
      const holderInstanceId = typeof req.body?.holderInstanceId === 'string' ? req.body.holderInstanceId : '';
      if (!token || !proof || !holderInstanceId || !req.coordinationV2Host) throw new HostRouteCommandError();
      const renewCredential = dependencies.renewSessionCredential ?? renewCoordinationV2SessionCredential;
      res.json(await renewCredential({
        token, signature: proof, hostEnrollmentId: req.coordinationV2Host.hostEnrollmentId,
        sessionId: req.params.id!, holderInstanceId,
      }));
    } catch (error) { replyError(res, error); }
  });

  for (const [path, handler] of [
    ['promote', promoteCoordinationWindowsPreparation],
    ['acknowledge', acknowledgeCoordinationWindowsPreparation],
    ['recover', recoverCoordinationWindowsPreparation],
  ] as const) {
    app.post(`/api/coordination/v2/host/preparation/${path}`, identityAuth, async (rawReq: Request, res: Response) => {
      const req = rawReq as HostRequest;
      try {
        const body = req.body;
        const actorId = req.coordinationV2Host?.hostEnrollmentId ?? '';
        if (path === 'promote' && typeof body.reservationId === 'string' && typeof body.sessionId !== 'string') {
            const result = await promoteBeforeSession({
            reservationId: body.reservationId, actorId, generationId: String(body.generationId),
            publicMaterialDigest: String(body.publicMaterialDigest),
            safePromotionEvidenceDigest: String(body.safePromotionEvidenceDigest),
          });
          res.json(result);
          return;
        }
        if (path === 'acknowledge' && typeof body.reservationId === 'string' && typeof body.sessionId !== 'string') {
          const acknowledgementInput = {
            reservationId: body.reservationId, actorId, generationId: String(body.generationId),
            publicMaterialDigest: String(body.publicMaterialDigest),
            acknowledgementRequestKey: String(body.acknowledgementRequestKey),
            safePromotionEvidenceDigest: String(body.safePromotionEvidenceDigest),
          };
          if (dependencies.acknowledgeAndProjectState) {
            const projected = await dependencies.acknowledgeAndProjectState(acknowledgementInput);
            res.json({ ...projected.reservation, state: projected.state });
            return;
          }
          const result = await acknowledgeBeforeSession(acknowledgementInput);
          const createdSession = await db.select().from(coordinationV2Sessions)
            .where(eq(coordinationV2Sessions.id, result.sessionId!)).limit(1);
          const session = createdSession[0];
          const descriptor = session && DEFAULT_PROVIDER_REGISTRY.descriptorsForProvider(session.requestedProviders[0] || '')[0];
          let attempt: { id: string } | undefined;
          if (session && descriptor) {
            const createdAttempt = await createInitial({
              sessionId: session.id, requestKey: `${result.id}:initial-attempt`, actorId,
              provider: descriptor.provider, model: descriptor.model, adapterVersion: descriptor.adapterVersion,
              attemptGeneration: `${result.generationId}`,
            });
            if ('id' in createdAttempt && typeof createdAttempt.id === 'string') {
              attempt = createdAttempt as { id: string };
            }
          }
          res.json({
            ...result,
            // This is opaque transport state only. Credentials are intentionally
            // absent until the subsequent lease acquisition succeeds.
            state: session && attempt ? {
              sessionId: session.id, reservationId: result.id, generationId: result.generationId,
              policyVersionId: session.policyVersionId, attemptId: attempt.id,
              enrolledHostId: session.enrolledHostId,
            } : undefined,
          });
          return;
        }
        const result = path === 'recover'
          ? await handler({ ...body, actorId } as any)
          : await handler({ ...body, actorId } as any);
        if (path === 'acknowledge' && result.state === 'acknowledged' && typeof (result as any).sessionId === 'string') {
          const sessionId = (result as any).sessionId as string;
          const current = await db.select({ state: coordinationV2Sessions.state }).from(coordinationV2Sessions)
            .where(eq(coordinationV2Sessions.id, sessionId)).limit(1);
          if (current[0]?.state === 'preparing') {
            await transitionCoordinationSession({
              sessionId, requestKey: String((result as any).acknowledgementRequestKey || `${sessionId}:preparation-ack`),
              actorId, command: { type: 'preparation_ready' },
            });
          }
        }
        res.json(result);
      } catch (error) { replyError(res, error); }
    });
  }

  // Acquire and takeover are explicit commands rather than an implicit
  // "ensure lease" operation; this keeps takeover's epoch boundary visible.
  app.post('/api/coordination/v2/host/leases', async (rawReq: Request, res: Response) => {
    const useSession = typeof rawReq.headers['x-coordination-v2-session-token'] === 'string';
    const middleware = useSession ? auth : identityAuth;
    let authenticated = false;
    await middleware(rawReq, res, () => { authenticated = true; });
    if (!authenticated || res.headersSent) return;
    const req = rawReq as HostRequest;
    try {
      const value = envelope(req, 'lease_request', protocolNow());
      const payload = value.payload as Record<string, unknown>;
      const kind = 'acquire';
      const input = hostInput(req, value);
      const result = kind === 'acquire'
        ? await services.acquireCoordinationTransportLease(input)
        : await services.takeoverCoordinationTransportLease(input);
       if (kind === 'acquire' && dependencies.issueSessionCredentials !== false && req.coordinationV2Host?.sessionId === null) {
         const leaseResult = result as { sessionId: string; id: string; epoch: number; holderInstanceId: string };
         const attemptId = dependencies.resolveSessionAttempt
           ? await dependencies.resolveSessionAttempt(leaseResult.sessionId)
           : (await db.select({ id: coordinationV2Attempts.id }).from(coordinationV2Attempts)
             .where(eq(coordinationV2Attempts.sessionId, leaseResult.sessionId)).orderBy(desc(coordinationV2Attempts.createdAt)).limit(1))[0]?.id;
         if (!attemptId) throw new HostRouteCommandError();
         const common = { hostCredentialId: req.coordinationV2Host.credentialId, hostEnrollmentId: req.coordinationV2Host.hostEnrollmentId,
           sessionId: leaseResult.sessionId, attemptId, leaseId: leaseResult.id, leaseEpoch: leaseResult.epoch,
           holderInstanceId: leaseResult.holderInstanceId, lineageDigest: req.coordinationV2Host.lineageDigest };
         const issueCredential = dependencies.issueSessionCredential ?? issueCoordinationV2SessionCredential;
         const transport = await issueCredential({ ...common, capability: 'host:transport' });
         const cleanup = await issueCredential({ ...common, capability: 'host:cleanup' });
          res.status(201).json({
            ...result, ...transport, attemptId, cleanupSessionToken: cleanup.sessionToken, cleanupCredentialId: cleanup.credentialId,
          });
         return;
       }
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
        // The envelope has already passed closed-shape/digest validation.
        // A valid envelope bound to another URL scope is authorization denial,
        // not malformed protocol input.
        if (binding?.sessionId !== req.params.id) throw new CoordinationTransportLeaseError('LEASE_AUTHORIZATION_DENIED');
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
       if (binding?.sessionId !== req.params.id) throw new CoordinationTransportLeaseError('LEASE_AUTHORIZATION_DENIED');
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