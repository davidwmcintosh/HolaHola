import type { Application, RequestHandler, Response } from 'express';
import type { CoordinationActorId } from '@shared/schema';
import {
  requireCoordinationAuth,
  type CoordinationAuthenticatedRequest,
} from '../middleware/coordination-auth';
import {
  addBenchObservation,
  createObservationBenchArm,
  endObservationBench,
  getObservationBenchComparison,
  getObservationBenchSourceStream,
  inviteBenchObservation,
  listActiveObservationSessions,
  listObservationBenchArms,
  listObservationBenchDashboard,
  startObservationBench,
  syncObservationBench,
  type ObservationCategory,
} from '../services/observation-bench-service';
import { CoordinationError, getCoordinationThread } from '../services/coordination-ledger-service';

function actorFrom(req: CoordinationAuthenticatedRequest): CoordinationActorId {
  if (!req.coordinationActor) {
    throw new CoordinationError('Coordination actor missing after authentication', 500, 'auth_invariant');
  }
  return req.coordinationActor;
}

function sendError(res: Response, error: unknown): void {
  if (error instanceof CoordinationError) {
    res.status(error.statusCode).json({ error: error.message, code: error.code, ...(error.details ?? {}) });
    return;
  }
  console.error('[ObservationBenchRoutes] Unexpected error:', error);
  res.status(500).json({ error: 'Observation bench operation failed', code: 'internal_error' });
}

export function registerObservationBenchCoordinationRoutes(app: Application): void {
  app.post('/api/coordination/observation-benches/:threadId/sync', requireCoordinationAuth, async (req: CoordinationAuthenticatedRequest, res: Response) => {
    try {
      res.json(await syncObservationBench({ threadId: req.params.threadId, actor: actorFrom(req) }));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/coordination/observation-benches/:threadId', requireCoordinationAuth, async (req: CoordinationAuthenticatedRequest, res: Response) => {
    try {
      const afterSequence = Number.parseInt(String(req.query.afterSequence ?? '0'), 10);
      res.json(await getCoordinationThread(req.params.threadId, actorFrom(req), afterSequence));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/coordination/observation-benches/:threadId/sources', requireCoordinationAuth, async (req: CoordinationAuthenticatedRequest, res: Response) => {
    try {
      const afterSequence = Number.parseInt(String(req.query.afterSequence ?? '0'), 10);
      res.json(await getObservationBenchSourceStream(req.params.threadId, actorFrom(req), afterSequence));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/coordination/observation-benches/:threadId/observations', requireCoordinationAuth, async (req: CoordinationAuthenticatedRequest, res: Response) => {
    try {
      const result = await addBenchObservation({
        threadId: req.params.threadId,
        actor: actorFrom(req),
        category: req.body?.category as ObservationCategory,
        content: req.body?.content,
        sourceEventIds: Array.isArray(req.body?.sourceEventIds) ? req.body.sourceEventIds : [],
        improvesObservationEventIds: Array.isArray(req.body?.improvesObservationEventIds)
          ? req.body.improvesObservationEventIds
          : undefined,
        idempotencyKey: req.headers['idempotency-key'] as string ?? req.body?.idempotencyKey,
        expectedSequence: req.body?.expectedSequence,
      });
      res.status(result.deduplicated ? 200 : 201).json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/coordination/observation-benches/:threadId/comparison', requireCoordinationAuth, async (req: CoordinationAuthenticatedRequest, res: Response) => {
    try {
      res.json(await getObservationBenchComparison(req.params.threadId, actorFrom(req)));
    } catch (error) {
      sendError(res, error);
    }
  });
}

export function registerObservationBenchFounderRoutes(
  app: Application,
  founderMiddleware: RequestHandler[],
): void {
  app.get(
    '/api/admin/luca/observation-bench-arms',
    ...founderMiddleware,
    async (_req: CoordinationAuthenticatedRequest, res: Response) => {
      try {
        res.json(await listObservationBenchArms());
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.post(
    '/api/admin/luca/observation-bench-arms',
    ...founderMiddleware,
    async (req: CoordinationAuthenticatedRequest, res: Response) => {
      try {
        const result = await createObservationBenchArm({
          idempotencyKey: req.headers['idempotency-key'] as string ?? req.body?.idempotencyKey,
        });
        res.status(result.deduplicated ? 200 : 201).json(result);
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.get(
    '/api/admin/luca/observation-benches',
    ...founderMiddleware,
    async (_req: CoordinationAuthenticatedRequest, res: Response) => {
      try {
        res.json(await listObservationBenchDashboard());
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.get(
    '/api/admin/luca/observation-bench-sessions',
    ...founderMiddleware,
    async (_req: CoordinationAuthenticatedRequest, res: Response) => {
      try {
        res.json(await listActiveObservationSessions());
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.post(
    '/api/admin/luca/observation-benches/:threadId/end',
    ...founderMiddleware,
    async (req: CoordinationAuthenticatedRequest, res: Response) => {
      try {
        res.json(await endObservationBench({ threadId: req.params.threadId }));
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.post(
    '/api/admin/luca/observation-benches/:threadId/sync',
    ...founderMiddleware,
    async (req: CoordinationAuthenticatedRequest, res: Response) => {
      try {
        res.json(await syncObservationBench({
          threadId: req.params.threadId,
          actor: 'david',
        }));
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.post(
    '/api/admin/luca/observation-benches',
    ...founderMiddleware,
    async (req: CoordinationAuthenticatedRequest, res: Response) => {
      try {
        const result = await startObservationBench({
          sessionId: req.body?.sessionId,
          armThreadId: req.body?.armThreadId,
          idempotencyKey: req.headers['idempotency-key'] as string ?? req.body?.idempotencyKey,
        });
        res.status(result.deduplicated ? 200 : 201).json(result);
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.post(
    '/api/admin/luca/observation-benches/:threadId/invite',
    ...founderMiddleware,
    async (req: CoordinationAuthenticatedRequest, res: Response) => {
      try {
        const result = await inviteBenchObservation({
          threadId: req.params.threadId,
          observationEventId: req.body?.observationEventId,
          conversationId: req.body?.conversationId,
          requestedBy: 'david',
        });
        res.status(result.deduplicated ? 200 : 201).json(result);
      } catch (error) {
        sendError(res, error);
      }
    },
  );
}