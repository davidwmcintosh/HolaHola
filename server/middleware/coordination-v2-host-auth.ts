import type { NextFunction, Request, Response } from 'express';
import {
  resolveCoordinationV2HostCredential,
  verifyCoordinationV2HostProof,
  resolveCoordinationV2SessionCredential,
  type HostAuthContext,
  type CoordinationV2HostCapability,
} from '../services/coordination-v2-host-auth-service';

export interface CoordinationV2HostAuthenticatedRequest extends Request {
  coordinationV2Host?: HostAuthContext;
}

function header(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function bodySessionId(req: Request): string | undefined {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const payload = (body as Record<string, unknown>).payload;
  const binding = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>).binding : undefined;
  if (binding && typeof binding === 'object' && !Array.isArray(binding)
    && typeof (binding as Record<string, unknown>).sessionId === 'string') {
    return (binding as Record<string, unknown>).sessionId as string;
  }
  if (typeof (body as Record<string, unknown>).sessionId === 'string') {
    return (body as Record<string, unknown>).sessionId as string;
  }
  return typeof req.params?.id === 'string' ? req.params.id : undefined;
}

function capability(req: Request): CoordinationV2HostCapability {
  return req.path.includes('/cleanup') || req.path.includes('/ack') ? 'host:cleanup' : 'host:transport';
}

/**
 * V2 host transport has a separate credential namespace and header.  In
 * particular, this middleware never calls legacy actor/broker resolution:
 * actor tokens, Gate 3 credentials, and runtime credentials cannot cross this
 * boundary.
 */
export async function requireCoordinationV2HostAuth(
  req: CoordinationV2HostAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = header(req, 'x-coordination-v2-session-token');
  const proof = header(req, 'x-coordination-v2-session-proof');
  if (!token || !proof) {
    res.status(401).json({ error: { code: 'V2_HOST_CREDENTIAL_REQUIRED' } });
    return;
  }
  let context: HostAuthContext | undefined;
  try {
    const sessionId = bodySessionId(req);
    const holderInstanceId = (() => {
      const body = req.body;
      const binding = body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>).payload : undefined;
      const value = binding && typeof binding === 'object' && !Array.isArray(binding)
        ? (binding as Record<string, unknown>).binding : undefined;
      const holder = value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>).holderInstanceId : undefined;
      return typeof holder === 'string' ? holder : undefined;
    })();
    const protocolVersion = (() => {
      const value = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>).protocolVersion : undefined;
      return typeof value === 'number' ? value : undefined;
    })();
    if (!sessionId || !holderInstanceId || protocolVersion === undefined) {
      res.status(401).json({ error: { code: 'V2_HOST_CREDENTIAL_SCOPE_DENIED' } });
      return;
    }
    context = await resolveCoordinationV2SessionCredential({
      token,
      signature: proof,
      capability: capability(req),
      protocolVersion, sessionId, holderInstanceId,
    });
  } catch {
    res.status(503).json({ error: { code: 'V2_HOST_DATABASE_UNAVAILABLE' } });
    return;
  }
  if (!context) {
    res.status(401).json({ error: { code: 'V2_HOST_CREDENTIAL_INVALID' } });
    return;
  }
  req.coordinationV2Host = context;
  next();
}

export const requireCoordinationV2Host = requireCoordinationV2HostAuth;

export async function requireCoordinationV2HostIdentityAuth(
  req: CoordinationV2HostAuthenticatedRequest, res: Response, next: NextFunction,
): Promise<void> {
  const token = header(req, 'x-coordination-v2-host-token');
  const proof = header(req, 'x-coordination-v2-host-proof');
  if (!token || !proof) { res.status(401).json({ error: { code: 'V2_HOST_CREDENTIAL_REQUIRED' } }); return; }
  try {
    const context = await verifyCoordinationV2HostProof(token, proof);
    if (!context || context.sessionId !== null) {
      res.status(401).json({ error: { code: 'V2_HOST_CREDENTIAL_INVALID' } }); return;
    }
    req.coordinationV2Host = context;
    next();
  } catch {
    res.status(503).json({ error: { code: 'V2_HOST_DATABASE_UNAVAILABLE' } });
  }
}

/** Bootstrap exchange has its own one-use credential, never a legacy token. */
export function requireCoordinationV2HostBootstrap(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!header(req, 'x-coordination-v2-bootstrap')) {
    res.status(401).json({ error: { code: 'V2_HOST_BOOTSTRAP_REQUIRED' } });
    return;
  }
  next();
}