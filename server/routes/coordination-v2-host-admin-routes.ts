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
  submitCoordinationV2HostReauthorizationRequest,
  approveCoordinationV2HostReauthorization,
  issueCoordinationV2HostReauthorizationChallenge,
  completeCoordinationV2HostReauthorization,
  getCoordinationV2HostReauthorizationRequest,
} from '../services/coordination-v2-host-auth-service';
import { CoordinationHostEnrollmentError } from '../services/coordination-host-enrollment-service';
import { requireCoordinationV2HostIdentityAuth } from '../middleware/coordination-v2-host-auth';
import { strictLimiter } from '../middleware/rate-limiter';

export type CoordinationV2HostAdminRouteDependencies = {
  founderMiddleware?: readonly RequestHandler[];
  submitEnrollmentRequest?: typeof submitCoordinationV2HostEnrollmentRequest;
  submitReauthorizationRequest?: typeof submitCoordinationV2HostReauthorizationRequest;
};

function actor(req: Request): string {
  return (req as AuthenticatedRequest).authenticatedUser?.id ?? '';
}

function text(body: Record<string, unknown>, key: string): string {
  return typeof body[key] === 'string' ? body[key] as string : '';
}
function exactBody(body: unknown, keys: readonly string[]): body is Record<string, unknown> {
  return !!body && typeof body === 'object' && !Array.isArray(body)
    && Object.keys(body as object).sort().join('\0') === [...keys].sort().join('\0');
}

function replyError(res: Response, error: unknown): void {
  const code = error instanceof CoordinationV2HostAuthError ? error.code
    : error instanceof CoordinationHostEnrollmentError ? error.code : 'V2_HOST_DATABASE_UNAVAILABLE';
  const status = code === 'V2_HOST_SOURCE_PROMOTION_REQUIRED' ? 409
    : code === 'V2_HOST_BOOTSTRAP_UNAVAILABLE' ? 503
      : code === 'V2_HOST_BOOTSTRAP_DENIED' ? 403
        : code.endsWith('REQUIRED') ? 401
    : code.includes('NOT_FOUND') ? 404
      : code.includes('REVOKED') || code.includes('SCOPE') ? 403
        : code.includes('CONFLICT') || code.includes('REPLAYED') || code.includes('CONSUMED') ? 409
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
  const submitEnrollmentRequest = dependencies.submitEnrollmentRequest
    ?? submitCoordinationV2HostEnrollmentRequest;
  const submitReauthorizationRequest = dependencies.submitReauthorizationRequest
    ?? submitCoordinationV2HostReauthorizationRequest;

  // Reauthorization is deliberately a separate protocol boundary. It does not
  // accept an expired credential, actor token, runtime credential, or session.
  app.post('/api/coordination/v2/host/reauthorization-requests', strictLimiter, async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (!exactBody(body, ['declaration', 'signature', 'publicKey', 'keyFingerprint'])) {
        throw new CoordinationV2HostAuthError('V2_HOST_REAUTH_INVALID');
      }
      const result = await submitReauthorizationRequest({
        declaration: body.declaration,
        signature: text(body, 'signature'),
        publicKey: text(body, 'publicKey'),
        keyFingerprint: text(body, 'keyFingerprint'),
      });
      res.status(result.status === 'pending' ? 201 : 200).json(result);
    } catch (error) { replyError(res, error); }
  });
  app.post('/api/coordination/v2/host/reauthorization-requests/:id/approve', ...founderSession, async (req: Request, res: Response) => {
    try {
      res.json(await approveCoordinationV2HostReauthorization({
        founderActor: actor(req), founderRole: 'founder', requestId: req.params.id,
      }));
    } catch (error) { replyError(res, error); }
  });
  app.get('/api/coordination/v2/host/reauthorization-requests/:id/status', strictLimiter, async (req: Request, res: Response) => {
    try {
      const header = req.get('x-hola-reauthorization-key');
      if (!header || header.length > 128 || header.trim() !== header || /[\u0000-\u001f\u007f]/.test(header)) {
        throw new CoordinationV2HostAuthError('V2_HOST_REAUTH_INVALID');
      }
      const requestKey = header;
      res.json(await issueCoordinationV2HostReauthorizationChallenge({ requestId: req.params.id, requestKey }));
    } catch (error) { replyError(res, error); }
  });
  app.post('/api/coordination/v2/host/reauthorization-requests/:id/proof', strictLimiter, async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (!exactBody(body, ['requestKey', 'challengeId', 'nonce', 'signature'])) {
        throw new CoordinationV2HostAuthError('V2_HOST_REAUTH_INVALID');
      }
      res.status(201).json(await completeCoordinationV2HostReauthorization({
        requestId: req.params.id, requestKey: text(body, 'requestKey'),
        challengeId: text(body, 'challengeId'), nonce: text(body, 'nonce'), signature: text(body, 'signature'),
      }));
    } catch (error) { replyError(res, error); }
  });
  app.get('/coordination/v2/host-reauthorization-approval', ...founderSession, async (req: Request, res: Response) => {
    try {
      // Only bounded, non-secret metadata is rendered. State changes only through POST.
      const requestId = typeof req.query.requestId === 'string' ? req.query.requestId : '';
      const request = await getCoordinationV2HostReauthorizationRequest(requestId);
      const safe = JSON.stringify(request).replace(/</g, '\\u003c');
      res.type('html').send(`<!doctype html><meta charset="utf-8"><title>Coordinator V2 host reauthorization</title>
        <h1>Coordinator V2 host reauthorization</h1><pre>${safe}</pre>
        <form method="post" action="/api/coordination/v2/host/reauthorization-requests/${encodeURIComponent(requestId)}/approve">
        <button type="submit">Approve this reauthorization</button></form>`);
    } catch (error) { replyError(res, error); }
  });

  app.post('/api/coordination/v2/host-enrollment-requests', strictLimiter, async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await submitEnrollmentRequest({
        requestKey: text(body, 'requestKey'), declaration: body.declaration,
        publicKey: text(body, 'publicKey'), keyFingerprint: text(body, 'keyFingerprint'),
        bootstrapSecret: req.get('x-coordination-initial-bootstrap') || undefined,
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