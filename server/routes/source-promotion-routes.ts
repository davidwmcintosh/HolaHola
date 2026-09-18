import type { Application, NextFunction, Request, Response } from 'express';
import { mutationLimiter } from '../middleware/rate-limiter';
import {
  SourcePromotionConflictError,
  SourcePromotionInputError,
  SourcePromotionService,
  authenticateSourcePromotionToken,
  validateSourcePromotionActor,
  validateSourcePromotionIdempotencyKey,
} from '../services/source-promotion-service';

function requireSourcePromotionToken(req: Request, res: Response, next: NextFunction): void {
  const supplied = req.header('x-source-promotion-token');
  if (!authenticateSourcePromotionToken(supplied)) {
    res.status(401).json({ error: 'Source-promotion authentication required.' });
    return;
  }
  next();
}

function requestIdentity(req: Request): { actor: string; idempotencyKey: string } {
  return {
    actor: validateSourcePromotionActor(req.header('x-source-promotion-actor')),
    idempotencyKey: validateSourcePromotionIdempotencyKey(req.header('idempotency-key')),
  };
}

function sendError(res: Response, error: unknown): void {
  if (error instanceof SourcePromotionInputError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof SourcePromotionConflictError) {
    res.status(409).json({ error: error.message });
    return;
  }
  console.error('[SourcePromotion] Request failed:', error);
  res.status(500).json({ error: 'Source-promotion request failed.' });
}

export function registerSourcePromotionRoutes(
  app: Application,
  service = new SourcePromotionService(),
): void {
  app.get(
    '/api/admin/source-promotion/status',
    requireSourcePromotionToken,
    async (_req: Request, res: Response) => {
      try {
        res.json({
          ...await service.getStatus(),
          publishBoundary: {
            modes: ['render_release_health', 'explicit_replit_publish'],
            programmaticPublishSupported: false,
            recordVerification: 'exact_release_identity_or_replit_marker',
          },
        });
      } catch (error: unknown) {
        sendError(res, error);
      }
    },
  );

  app.get(
    '/api/admin/source-promotion/requests/:requestId',
    requireSourcePromotionToken,
    async (req: Request, res: Response) => {
      try {
        const request = await service.getRequest(req.params.requestId);
        if (!request) {
          res.status(404).json({ error: 'Source-promotion request not found.' });
          return;
        }
        res.json({ request });
      } catch (error: unknown) {
        sendError(res, error);
      }
    },
  );

  app.post(
    '/api/admin/source-promotion/sync',
    mutationLimiter,
    requireSourcePromotionToken,
    async (req: Request, res: Response) => {
      try {
        const result = await service.sync(requestIdentity(req));
        res.status(result.replayed && result.request.status !== 'running' ? 200 : 202).json({
          ...result,
          next: 'Poll the request URL until it reaches a terminal state.',
          requestUrl: `/api/admin/source-promotion/requests/${result.request.requestId}`,
        });
      } catch (error: unknown) {
        sendError(res, error);
      }
    },
  );

  app.post(
    '/api/admin/source-promotion/prepare',
    mutationLimiter,
    requireSourcePromotionToken,
    async (req: Request, res: Response) => {
      try {
        const result = await service.prepare(requestIdentity(req));
        res.status(result.replayed && result.request.status !== 'running' ? 200 : 202).json({
          ...result,
          next: result.request.status === 'succeeded'
            ? 'Publish the exact SHA, then record matching Render release identity or an explicit Replit publication marker.'
            : 'Poll the request URL until it reaches a terminal state.',
          requestUrl: `/api/admin/source-promotion/requests/${result.request.requestId}`,
        });
      } catch (error: unknown) {
        sendError(res, error);
      }
    },
  );

  app.post(
    '/api/admin/source-promotion/record',
    mutationLimiter,
    requireSourcePromotionToken,
    async (req: Request, res: Response) => {
      try {
        if (!req.body || typeof req.body.sha !== 'string') {
          throw new SourcePromotionInputError('A sha field is required.');
        }
        if (
          req.body.publicationReference !== undefined
          && typeof req.body.publicationReference !== 'string'
        ) {
          throw new SourcePromotionInputError('publicationReference must be a string.');
        }
        if (
          req.body.sourceContextSha256 !== undefined
          && typeof req.body.sourceContextSha256 !== 'string'
        ) {
          throw new SourcePromotionInputError('sourceContextSha256 must be a string.');
        }
        const result = await service.record({
          ...requestIdentity(req),
          sha: req.body.sha,
          sourceContextSha256: req.body.sourceContextSha256,
          publicationReference: req.body.publicationReference,
        });
        res.status(result.replayed && result.request.status !== 'running' ? 200 : 202).json({
          ...result,
          verification: {
            mode: result.request.verificationMode,
            note: result.request.verificationMode === 'render_release_health'
              ? 'The exact commit and source-context digest must match the pinned HTTPS Render release identity.'
              : 'The exact Replit publication marker must match the validated candidate.',
          },
          requestUrl: `/api/admin/source-promotion/requests/${result.request.requestId}`,
        });
      } catch (error: unknown) {
        sendError(res, error);
      }
    },
  );
}

export function registerDisabledSourcePromotionRoutes(app: Application): void {
  app.all('/api/admin/source-promotion/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Source-promotion API is disabled.' });
  });
}