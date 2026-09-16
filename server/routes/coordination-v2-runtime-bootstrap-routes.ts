import type { Application, Request, Response, RequestHandler } from 'express';
import { isAuthenticated } from '../replitAuth';
import { storage } from '../storage';
import { loadAuthenticatedUser, requireFounder, type AuthenticatedRequest } from '../middleware/rbac';
import { requireCoordinationV2HostIdentityAuth, type CoordinationV2HostAuthenticatedRequest } from '../middleware/coordination-v2-host-auth';
import {
  acknowledgeCoordinationV2RuntimeBootstrap,
  CoordinationV2RuntimeError,
  describeCoordinationV2RuntimePublicationFailure,
  getCoordinationV2RuntimeStatus,
  issueCoordinationV2RuntimeBootstrapManifest,
  publishCoordinationV2RuntimeRelease,
  revokeCoordinationV2RuntimeRelease,
  streamCoordinationV2RuntimeArtifact,
  type RuntimeReleaseInput,
} from '../services/coordination-v2-runtime-bootstrap-service';

type Dependencies = {
  founderMiddleware?: readonly RequestHandler[];
  hostAuthMiddleware?: RequestHandler;
  publish?: typeof publishCoordinationV2RuntimeRelease;
  issueManifest?: typeof issueCoordinationV2RuntimeBootstrapManifest;
  streamArtifact?: typeof streamCoordinationV2RuntimeArtifact;
  acknowledge?: typeof acknowledgeCoordinationV2RuntimeBootstrap;
  status?: typeof getCoordinationV2RuntimeStatus;
  revoke?: typeof revokeCoordinationV2RuntimeRelease;
};

function body(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body as Record<string, unknown> : {};
}

function stringValue(value: unknown, max = 512): string {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : '';
}

function host(req: Request): string {
  return (req as CoordinationV2HostAuthenticatedRequest).coordinationV2Host?.hostEnrollmentId ?? '';
}

function actor(req: Request): string {
  return (req as AuthenticatedRequest).authenticatedUser?.id ?? '';
}

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const expected = new Set(allowed);
  return Object.keys(value).every((key) => expected.has(key));
}

function errorCode(error: unknown): string {
  return error instanceof CoordinationV2RuntimeError ? error.code : 'V2_RUNTIME_DATABASE_UNAVAILABLE';
}

function errorStatus(code: string): number {
  if (code.includes('NOT_FOUND')) return 404;
  if (code.includes('REQUIRED') || code.includes('AUTH')) return 401;
  if (code.includes('DENIED') || code.includes('REVOKED')) return 403;
  if (code.includes('CONFLICT') || code.includes('EXPIRED') || code.includes('NOT_CURRENT')
    || code.includes('UNAVAILABLE') || code.includes('TOO_OLD')) return 409;
  if (code.includes('DATABASE')) return 503;
  return 422;
}

function replyError(res: Response, error: unknown): void {
  const code = errorCode(error);
  res.status(errorStatus(code)).json({ error: { code } });
}

export function registerCoordinationV2RuntimeBootstrapRoutes(
  app: Application,
  dependencies: Dependencies = {},
): void {
  const founderMiddleware = dependencies.founderMiddleware
    ? [...dependencies.founderMiddleware]
    : [isAuthenticated, loadAuthenticatedUser(storage), requireFounder];
  const hostAuthMiddleware = dependencies.hostAuthMiddleware
    ?? requireCoordinationV2HostIdentityAuth;
  const publish = dependencies.publish ?? publishCoordinationV2RuntimeRelease;
  const issueManifest = dependencies.issueManifest ?? issueCoordinationV2RuntimeBootstrapManifest;
  const streamArtifact = dependencies.streamArtifact ?? streamCoordinationV2RuntimeArtifact;
  const acknowledge = dependencies.acknowledge ?? acknowledgeCoordinationV2RuntimeBootstrap;
  const status = dependencies.status ?? getCoordinationV2RuntimeStatus;
  const revoke = dependencies.revoke ?? revokeCoordinationV2RuntimeRelease;

  app.post('/api/internal/coordination/v2/runtime-releases', ...founderMiddleware, async (req, res) => {
    const startedAt = Date.now();
    try {
      const value = body(req);
      if (!onlyKeys(value, [
        'sourcePromotionId', 'artifacts', 'sourceMembers',
      ])) throw new CoordinationV2RuntimeError('V2_RUNTIME_INVALID_REQUEST');
      const artifacts = Array.isArray(value.artifacts) ? value.artifacts : [];
      const result = await publish({
        sourcePromotionId: stringValue(value.sourcePromotionId, 128),
        artifacts: artifacts as RuntimeReleaseInput['artifacts'],
        sourceMembers: Array.isArray(value.sourceMembers)
          ? value.sourceMembers as RuntimeReleaseInput['sourceMembers']
          : [],
      });
      res.status(result.created ? 201 : 200).json(result);
    } catch (error) {
      console.error(
        '[CoordinationV2Runtime] Runtime release publication failed',
        JSON.stringify(describeCoordinationV2RuntimePublicationFailure(
          error,
          Date.now() - startedAt,
        )),
      );
      replyError(res, error);
    }
  });

  app.post('/api/coordination/v2/host/runtime-bootstrap/issues', hostAuthMiddleware, async (req, res) => {
    try {
      const value = body(req);
      if (!onlyKeys(value, ['requestKey', 'protocolVersion'])) {
        throw new CoordinationV2RuntimeError('V2_RUNTIME_INVALID_REQUEST');
      }
      const result = await issueManifest({
        hostEnrollmentId: host(req),
        requestKey: stringValue(value.requestKey, 128),
        protocolVersion: value.protocolVersion as number,
      });
      res.status(result.created ? 201 : 200).json({
        payload: result.payload,
        canonicalResponseDigest: result.canonicalResponseDigest,
        signature: result.signature,
        keyFingerprint: result.keyFingerprint,
      });
    } catch (error) { replyError(res, error); }
  });

  app.get('/api/coordination/v2/host/runtime-bootstrap/issues/:issueId/artifacts/:artifactId', hostAuthMiddleware, async (req, res) => {
    try {
      await streamArtifact({
        issueId: req.params.issueId,
        artifactId: req.params.artifactId,
        hostEnrollmentId: host(req),
      }, res);
    } catch (error) {
      if (!res.headersSent) replyError(res, error);
    }
  });

  app.post('/api/coordination/v2/host/runtime-bootstrap/issues/:issueId/acknowledge', hostAuthMiddleware, async (req, res) => {
    try {
      const value = body(req);
      const payload = value.payload;
      if (!onlyKeys(value, ['payload', 'signature'])) {
        throw new CoordinationV2RuntimeError('V2_RUNTIME_ACK_INVALID');
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new CoordinationV2RuntimeError('V2_RUNTIME_ACK_INVALID');
      }
      const result = await acknowledge({
        hostEnrollmentId: host(req),
        issueId: req.params.issueId,
        payload: payload as Parameters<typeof acknowledge>[0]['payload'],
        signature: stringValue(value.signature, 8192),
      });
      res.status(result.created ? 201 : 200).json(result);
    } catch (error) { replyError(res, error); }
  });

  app.get('/api/coordination/v2/host/runtime-bootstrap/status', hostAuthMiddleware, async (req, res) => {
    try {
      res.json(await status({ hostEnrollmentId: host(req) }));
    } catch (error) { replyError(res, error); }
  });

  app.post('/api/internal/coordination/v2/runtime-releases/:id/revoke', ...founderMiddleware, async (req, res) => {
    try {
      const value = body(req);
      if (!onlyKeys(value, ['requestKey', 'reasonCode'])) {
        throw new CoordinationV2RuntimeError('V2_RUNTIME_INVALID_REQUEST');
      }
      const result = await revoke({
        runtimeReleaseId: req.params.id,
        requestKey: stringValue(value.requestKey, 128),
        reasonCode: stringValue(value.reasonCode, 128),
        revokedBy: actor(req),
      });
      res.status(result.created ? 201 : 200).json(result);
    } catch (error) { replyError(res, error); }
  });
}