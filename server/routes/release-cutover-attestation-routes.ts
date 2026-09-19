import type { Application, Response } from 'express';
import {
  requireCoordinationAuth,
  type CoordinationAuthenticatedRequest,
} from '../middleware/coordination-auth';
import { mutationLimiter } from '../middleware/rate-limiter';
import {
  ReleaseCutoverAttestationConflictError,
  ReleaseCutoverAttestationDisagreementError,
  ReleaseCutoverAttestationInputError,
  ReleaseCutoverAttestationNotFoundError,
  ReleaseCutoverAttestationService,
} from '../services/release-cutover-attestation-service';
function sendError(res: Response, error: unknown): void {
  if (error instanceof ReleaseCutoverAttestationInputError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof ReleaseCutoverAttestationNotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }
  if (error instanceof ReleaseCutoverAttestationConflictError) {
    res.status(409).json({ error: error.message });
    return;
  }
  if (error instanceof ReleaseCutoverAttestationDisagreementError) {
    res.status(409).json({ error: error.message, evidence: error.evidence });
    return;
  }
  console.error('[ReleaseCutoverAttestation] Request failed:', error);
  res.status(500).json({ error: 'Release-cutover-attestation request failed.' });
}
function requireBodyString(body: unknown, field: string): string {
  const value = (body as Record<string, unknown> | null | undefined)?.[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new ReleaseCutoverAttestationInputError(`${field} is required and must be a non-empty string.`);
  }
  return value;
}
export function registerReleaseCutoverAttestationRoutes(
  app: Application,
  service = new ReleaseCutoverAttestationService(),
): void {
  app.post(
    '/api/admin/release-attestation/attest',
    mutationLimiter,
    requireCoordinationAuth,
    async (req: CoordinationAuthenticatedRequest, res: Response) => {
      try {
        const decisionRef = requireBodyString(req.body, 'decisionRef');
        const reason = requireBodyString(req.body, 'reason');
        const ttlMs = req.body?.ttlMs;
        if (ttlMs !== undefined && typeof ttlMs !== 'number') {
          throw new ReleaseCutoverAttestationInputError('ttlMs must be a number when provided.');
        }
        const attestation = await service.attest({
          actor: req.coordinationActor!,
          decisionRef,
          reason,
          ttlMs,
        });
        res.status(201).json({ attestation });
      } catch (error: unknown) {
        sendError(res, error);
      }
    },
  );
  app.get(
    '/api/admin/release-attestation/:decisionRef',
    requireCoordinationAuth,
    async (req: CoordinationAuthenticatedRequest, res: Response) => {
      try {
        const active = await service.getActive(req.params.decisionRef);
        if (!active) {
          res.status(404).json({ error: `No active attestation for decisionRef "${req.params.decisionRef}".` });
          return;
        }
        res.json({ attestation: active });
      } catch (error: unknown) {
        sendError(res, error);
      }
    },
  );
  app.post(
    '/api/admin/release-attestation/:decisionRef/verify',
    mutationLimiter,
    requireCoordinationAuth,
    async (req: CoordinationAuthenticatedRequest, res: Response) => {
      try {
        const attestation = await service.verifyStillLive(req.params.decisionRef);
        res.json({ attestation, stillLive: true });
      } catch (error: unknown) {
        sendError(res, error);
      }
    },
  );
  app.post(
    '/api/admin/release-attestation/:decisionRef/invalidate',
    mutationLimiter,
    requireCoordinationAuth,
    async (req: CoordinationAuthenticatedRequest, res: Response) => {
      try {
        const reason = requireBodyString(req.body, 'reason');
        const attestation = await service.invalidate(req.params.decisionRef, req.coordinationActor!, reason);
        res.json({ attestation });
      } catch (error: unknown) {
        sendError(res, error);
      }
    },
  );
  app.post(
    '/api/admin/release-attestation/:decisionRef/consume',
    mutationLimiter,
    requireCoordinationAuth,
    async (req: CoordinationAuthenticatedRequest, res: Response) => {
      try {
        const action = requireBodyString(req.body, 'action');
        const attestation = await service.consume(req.params.decisionRef, req.coordinationActor!, action);
        res.json({ attestation });
      } catch (error: unknown) {
        sendError(res, error);
      }
    },
  );
}
