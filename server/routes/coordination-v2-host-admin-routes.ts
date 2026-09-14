import type { Application, Request, Response, RequestHandler } from 'express';
import { isAuthenticated } from '../replitAuth';
import { storage } from '../storage';
import { loadAuthenticatedUser, requireFounder, type AuthenticatedRequest } from '../middleware/rbac';
import {
  submitCoordinationV2HostEnrollmentRequest,
  approveCoordinationV2HostEnrollment,
  getCoordinationV2HostEnrollmentRequest,
  issueCoordinationV2HostProofChallenge,
  completeCoordinationV2HostEnrollment,
  renewCoordinationV2HostCredential,
  revokeCoordinationV2Host,
  CoordinationV2HostAuthError,
} from '../services/coordination-v2-host-auth-service';
import { CoordinationHostEnrollmentError } from '../services/coordination-host-enrollment-service';
import { requireCoordinationV2HostIdentityAuth } from '../middleware/coordination-v2-host-auth';
import { strictLimiter } from '../middleware/rate-limiter';

export type CoordinationV2HostAdminRouteDependencies = {
  founderMiddleware?: readonly RequestHandler[];
};

function actor(req: Request): string {
  return (req as AuthenticatedRequest).authenticatedUser?.id ?? '';
}

function text(body: Record<string, unknown>, key: string): string {
  return typeof body[key] === 'string' ? body[key] as string : '';
}

function replyError(res: Response, error: unknown): void {
  const code = error instanceof CoordinationV2HostAuthError ? error.code
    : error instanceof CoordinationHostEnrollmentError ? error.code : 'V2_HOST_DATABASE_UNAVAILABLE';
  const status = code.endsWith('REQUIRED') ? 401
    : code.includes('NOT_FOUND') ? 404
      : code.includes('REVOKED') || code.includes('SCOPE') ? 403
        : code.includes('CONFLICT') || code.includes('REPLAYED') ? 409
          : code.includes('DATABASE') ? 503 : 422;
  res.status(status).json({ error: { code } });
}

export function registerCoordinationV2HostAdminRoutes(
  app: Application,
  dependencies: CoordinationV2HostAdminRouteDependencies = {},
): void {
  const founderSession = dependencies.founderMiddleware
    ? [...dependencies.founderMiddleware]
    : [isAuthenticated, loadAuthenticatedUser(storage), requireFounder];

  app.post('/api/coordination/v2/host-enrollment-requests', strictLimiter, async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await submitCoordinationV2HostEnrollmentRequest({
        requestKey: text(body, 'requestKey'), declaration: body.declaration,
        publicKey: text(body, 'publicKey'), keyFingerprint: text(body, 'keyFingerprint'),
        capabilities: Array.isArray(body.capabilities) ? body.capabilities.filter((v): v is string => typeof v === 'string') : undefined,
      });
      res.status(result.created ? 201 : 200).json(result);
    } catch (error) { replyError(res, error); }
  });
  app.get('/api/coordination/v2/host/protocol', (_req: Request, res: Response) => {
    res.json({ protocolVersion: 1, enrollmentCompatible: true });
  });

  app.get('/api/coordination/v2/host-enrollment-requests/:id/status', strictLimiter, async (req: Request, res: Response) => {
    try {
      res.json(await issueCoordinationV2HostProofChallenge({
        requestId: req.params.id, requestKey: typeof req.query.requestKey === 'string' ? req.query.requestKey : undefined,
      }));
    } catch (error) { replyError(res, error); }
  });

  app.post('/api/coordination/v2/host-enrollment-requests/:id/approve', ...founderSession, async (req: Request, res: Response) => {
    try {
      const result = await approveCoordinationV2HostEnrollment({
        founderActor: actor(req), founderRole: 'founder', requestId: req.params.id,
      });
      res.json(result);
    } catch (error) { replyError(res, error); }
  });

  app.get('/api/coordination/v2/host-enrollment-requests/:id', ...founderSession, async (req: Request, res: Response) => {
    try { res.json(await getCoordinationV2HostEnrollmentRequest(req.params.id)); }
    catch (error) { replyError(res, error); }
  });

  app.get('/coordination/v2/host-approval', ...founderSession, async (req: Request, res: Response) => {
    try {
      const requestId = typeof req.query.requestId === 'string' ? req.query.requestId : '';
      const request = await getCoordinationV2HostEnrollmentRequest(requestId);
      const safe = JSON.stringify(request).replace(/</g, '\\u003c');
      res.type('html').send(`<!doctype html><meta charset="utf-8"><title>Coordinator V2 host approval</title>
        <h1>Coordinator V2 host approval</h1><pre id="request">${safe}</pre>
        <form method="post" action="/api/coordination/v2/host-enrollment-requests/${encodeURIComponent(requestId)}/approve">
        <button type="submit">Approve this host</button></form>`);
    } catch (error) { replyError(res, error); }
  });

  app.post('/api/coordination/v2/host-enrollment-requests/:id/proof', strictLimiter, async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await completeCoordinationV2HostEnrollment({
        requestId: req.params.id, challengeId: text(body, 'challengeId'),
        nonce: text(body, 'nonce'), signature: text(body, 'signature'),
      });
      res.status(201).json(result);
    } catch (error) { replyError(res, error); }
  });

  app.post('/api/coordination/v2/host/renew', requireCoordinationV2HostIdentityAuth, async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const token = req.get('x-coordination-v2-host-token') || '';
      res.json(await renewCoordinationV2HostCredential({
        token, signature: text(body, 'signature'), holderInstanceId: text(body, 'holderInstanceId') || undefined,
      }));
    } catch (error) { replyError(res, error); }
  });

  app.post('/api/coordination/v2/hosts/:id/revoke', ...founderSession, async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      res.json(await revokeCoordinationV2Host({
        founderActor: actor(req), founderRole: 'founder', hostEnrollmentId: req.params.id,
        requestKey: text(body, 'requestKey'),
      }));
    } catch (error) { replyError(res, error); }
  });
}