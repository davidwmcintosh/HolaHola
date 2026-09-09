import type { Application, Response } from 'express';
import {
  requireCoordinationAuth,
  type CoordinationAuthenticatedRequest,
} from '../middleware/coordination-auth';
import {
  exchangeBootstrapCredential,
  auditMissingBootstrapAttempt,
  renewBrokerCredential,
  revokeBrokerCredential,
  revokeRuntimeCredentials,
} from '../services/coordination-credential-broker';
import { strictLimiter } from '../middleware/rate-limiter';

function sourceIp(req: CoordinationAuthenticatedRequest): string | undefined {
  return req.ip || req.socket.remoteAddress;
}

function credentialRouteError(res: Response, error: unknown): void {
  console.error('[CoordinationCredentials] Request failed:', error);
  if (!res.headersSent) {
    res.status(503).json({ error: 'Coordination credential service is unavailable' });
  }
}

export function registerCoordinationCredentialRoutes(app: Application): void {
  app.post('/api/coordination/credentials/exchange', strictLimiter, async (req: CoordinationAuthenticatedRequest, res: Response) => {
    try {
      const runtimeId = typeof req.body?.runtimeId === 'string' ? req.body.runtimeId.trim() : '';
      const bootstrap = typeof req.headers['x-coordination-bootstrap'] === 'string'
        ? req.headers['x-coordination-bootstrap']
        : undefined;
      if (!runtimeId || !bootstrap) {
        await auditMissingBootstrapAttempt(runtimeId || undefined, sourceIp(req));
        res.status(401).json({ error: 'Runtime bootstrap authentication required' });
        return;
      }
      const issued = await exchangeBootstrapCredential(runtimeId, bootstrap, sourceIp(req));
      if (!issued) {
        res.status(401).json({ error: 'Runtime bootstrap authentication failed' });
        return;
      }
      res.status(201).json({
        accessToken: issued.accessToken,
        tokenType: 'Coordination',
        actor: issued.credential.actor,
        runtimeId: issued.credential.runtimeId,
        capabilities: issued.credential.capabilities,
        expiresAt: issued.credential.expiresAt.toISOString(),
      });
    } catch (error) {
      credentialRouteError(res, error);
    }
  });

  app.post('/api/coordination/credentials/renew', strictLimiter, requireCoordinationAuth, async (req: CoordinationAuthenticatedRequest, res: Response) => {
    try {
      if (req.coordinationAuthType !== 'broker' || !req.coordinationCredential) {
        res.status(403).json({ error: 'Only a broker credential can renew itself' });
        return;
      }
      const renewed = await renewBrokerCredential(req.coordinationCredential, sourceIp(req));
      if (!renewed) {
        res.status(401).json({ error: 'Credential renewal failed' });
        return;
      }
      res.json({
        accessToken: renewed.accessToken,
        tokenType: 'Coordination',
        actor: renewed.credential.actor,
        runtimeId: renewed.credential.runtimeId,
        capabilities: renewed.credential.capabilities,
        expiresAt: renewed.credential.expiresAt.toISOString(),
      });
    } catch (error) {
      credentialRouteError(res, error);
    }
  });

  app.post('/api/coordination/credentials/revoke', strictLimiter, requireCoordinationAuth, async (req: CoordinationAuthenticatedRequest, res: Response) => {
    try {
      if (req.coordinationAuthType === 'broker' && req.coordinationCredential) {
        await revokeBrokerCredential(req.coordinationCredential, sourceIp(req));
        res.status(204).end();
        return;
      }
      const runtimeId = typeof req.body?.runtimeId === 'string' ? req.body.runtimeId.trim() : '';
      if (!runtimeId || !req.coordinationActor) {
        res.status(400).json({ error: 'runtimeId is required' });
        return;
      }
      if (!await revokeRuntimeCredentials(runtimeId, req.coordinationActor, sourceIp(req))) {
        res.status(404).json({ error: 'Runtime registration not found for authenticated actor' });
        return;
      }
      res.status(204).end();
    } catch (error) {
      credentialRouteError(res, error);
    }
  });
}