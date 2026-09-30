import { createHash } from 'node:crypto';
import type { Application, Request, Response, RequestHandler } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';
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
  resolveCoordinationV2RuntimeSourceSnapshot,
  revokeCoordinationV2RuntimeRelease,
  streamCoordinationV2RuntimeArtifact,
  RUNTIME_SOURCE_MEMBER_PATHS,
  type RuntimeArtifactInput,
  type RuntimeReleaseInput,
  type RuntimeSourceMembers,
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
  latestPublishedSourcePromotion?: typeof latestPublishedSourcePromotion;
  latestRuntimeRelease?: typeof latestRuntimeRelease;
  latestRuntimeReleaseArtifacts?: typeof latestRuntimeReleaseArtifacts;
  previewSourceMembers?: typeof previewSourceMembers;
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

function rowOf(result: unknown): Record<string, unknown> | undefined {
  const value = result as { rows?: unknown[] } | unknown[];
  return (Array.isArray(value) ? value[0] : value.rows?.[0]) as Record<string, unknown> | undefined;
}

function rowsOf(result: unknown): Record<string, unknown>[] {
  const value = result as { rows?: unknown[] } | unknown[];
  return (Array.isArray(value) ? value : value.rows ?? []) as Record<string, unknown>[];
}

/**
 * Read-only preview helpers for the founder-facing runtime-release trigger
 * below. None of these are the authority: publishCoordinationV2RuntimeRelease
 * independently re-verifies the source promotion, re-derives sourceMembers
 * from a fresh GitHub snapshot, and re-checks every artifact against object
 * storage before it writes anything. These just let a founder see, before
 * clicking publish, what that independent verification is expected to find.
 */
async function latestPublishedSourcePromotion(): Promise<Record<string, unknown> | undefined> {
  return rowOf(await db.execute(sql`
    SELECT id, repository_identity, promoted_commit_sha, exact_tree_sha, created_at
    FROM coordination_v2_source_promotions
    WHERE state = 'published'
    ORDER BY created_at DESC LIMIT 1
  `));
}

async function latestRuntimeRelease(): Promise<Record<string, unknown> | undefined> {
  return rowOf(await db.execute(sql`
    SELECT id, source_promotion_id, promoted_commit_sha, published_at
    FROM coordination_v2_runtime_releases
    ORDER BY published_at DESC LIMIT 1
  `));
}

/**
 * Node.js/tsx pin (RUNTIME_NODE_VERSION etc.) is a fixed constant in the
 * service module, not a per-request input, so the exact same artifact bytes
 * remain valid evidence across releases. Reusing them here means a founder
 * publishing a fix to the three tracked source files never needs to source a
 * new Node executable or tsx bundle by hand.
 */
async function latestRuntimeReleaseArtifacts(runtimeReleaseId: string): Promise<RuntimeArtifactInput[]> {
  const rows = rowsOf(await db.execute(sql`
    SELECT role, fixed_destination, object_key, object_digest, byte_length,
      media_type, requires_authenticode
    FROM coordination_v2_runtime_release_artifacts
    WHERE runtime_release_id = ${runtimeReleaseId}
    ORDER BY fixed_destination
  `));
  return rows.map((row) => ({
    role: String(row.role) as RuntimeArtifactInput['role'],
    fixedDestination: String(row.fixed_destination),
    objectKey: String(row.object_key),
    objectDigest: String(row.object_digest),
    byteLength: Number(row.byte_length),
    mediaType: String(row.media_type),
    requiresAuthenticode: Boolean(row.requires_authenticode),
  }));
}

/**
 * Computed the exact same way publishCoordinationV2RuntimeRelease's internal
 * deriveProvenance step recomputes and cross-checks it, so this is a genuine
 * preview rather than a guess: a mismatch here would also fail at publish
 * time with V2_RUNTIME_SOURCE_MEMBERS_MISMATCH.
 */
async function previewSourceMembers(
  repositoryIdentity: string,
  promotedCommitSha: string,
): Promise<RuntimeSourceMembers> {
  const snapshot = await resolveCoordinationV2RuntimeSourceSnapshot({
    repositoryIdentity,
    promotedCommitSha,
    fixedPaths: RUNTIME_SOURCE_MEMBER_PATHS,
  });
  return [...RUNTIME_SOURCE_MEMBER_PATHS]
    .map((fixedPath) => ({
      fixedPath,
      sha256: createHash('sha256').update(Buffer.from(snapshot.blobs[fixedPath])).digest('hex'),
    }))
    .sort((a, b) => a.fixedPath.localeCompare(b.fixedPath));
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
  const resolveLatestPublishedSourcePromotion = dependencies.latestPublishedSourcePromotion
    ?? latestPublishedSourcePromotion;
  const resolveLatestRuntimeRelease = dependencies.latestRuntimeRelease ?? latestRuntimeRelease;
  const resolveLatestRuntimeReleaseArtifacts = dependencies.latestRuntimeReleaseArtifacts
    ?? latestRuntimeReleaseArtifacts;
  const resolvePreviewSourceMembers = dependencies.previewSourceMembers ?? previewSourceMembers;

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

  /**
   * Founder-facing trigger for publishing a fresh runtime release. Mirrors
   * the host-reauthorization-approval pattern in
   * coordination-v2-host-admin-routes.ts: GET renders a bounded, non-secret
   * preview computed from live state; POST recomputes everything itself
   * (never trusts a client-echoed body) and calls the same
   * publishCoordinationV2RuntimeRelease used by the JSON API above, which
   * independently re-verifies the source promotion, re-derives sourceMembers
   * from a fresh GitHub snapshot, and re-checks every artifact before it
   * writes anything. Publication is idempotent by release digest, so a
   * redundant click when nothing has changed safely replays the existing
   * release instead of creating a duplicate.
   */
  app.get('/coordination/v2/runtime-release-approval', ...founderMiddleware, async (_req: Request, res: Response) => {
    try {
      const source = await resolveLatestPublishedSourcePromotion();
      if (!source) throw new CoordinationV2RuntimeError('V2_RUNTIME_SOURCE_PROMOTION_REQUIRED');
      const release = await resolveLatestRuntimeRelease();
      const upToDate = !!release && String(release.source_promotion_id) === String(source.id);
      const sourceMembers = await resolvePreviewSourceMembers(
        String(source.repository_identity),
        String(source.promoted_commit_sha),
      );
      const preview = {
        currentPublishedSource: {
          sourcePromotionId: source.id,
          repositoryIdentity: source.repository_identity,
          promotedCommitSha: source.promoted_commit_sha,
          promotedAt: source.created_at,
        },
        latestRuntimeRelease: release ? {
          runtimeReleaseId: release.id,
          promotedCommitSha: release.promoted_commit_sha,
          publishedAt: release.published_at,
        } : null,
        upToDate,
        sourceMembersToPublish: sourceMembers,
      };
      const safe = JSON.stringify(preview, null, 2).replace(/</g, '\\u003c');
      res.type('html').send(`<!doctype html><meta charset="utf-8"><title>Coordinator V2 runtime release</title>
        <h1>Coordinator V2 runtime release</h1>
        <p>${upToDate
          ? 'Up to date: the latest runtime release already matches the current published source. Publishing again will safely replay the existing release.'
          : 'Stale: the latest runtime release does not match the current published source. Hosts cannot receive the current source until a new release is published.'}</p>
        <p>The Node.js executable and tsx runtime module will be reused unchanged from the most recent runtime release.</p>
        <pre>${safe}</pre>
        <form method="post" action="/coordination/v2/runtime-release-publish">
        <button type="submit">Publish runtime release from current source</button></form>`);
    } catch (error) { replyError(res, error); }
  });

  app.post('/coordination/v2/runtime-release-publish', ...founderMiddleware, async (_req: Request, res: Response) => {
    const startedAt = Date.now();
    try {
      const source = await resolveLatestPublishedSourcePromotion();
      if (!source) throw new CoordinationV2RuntimeError('V2_RUNTIME_SOURCE_PROMOTION_REQUIRED');
      const priorRelease = await resolveLatestRuntimeRelease();
      if (!priorRelease) throw new CoordinationV2RuntimeError('V2_RUNTIME_NO_PRIOR_RELEASE_ARTIFACTS');
      const [artifacts, sourceMembers] = await Promise.all([
        resolveLatestRuntimeReleaseArtifacts(String(priorRelease.id)),
        resolvePreviewSourceMembers(String(source.repository_identity), String(source.promoted_commit_sha)),
      ]);
      const result = await publish({
        sourcePromotionId: String(source.id),
        artifacts,
        sourceMembers,
      });
      const safe = JSON.stringify(result, null, 2).replace(/</g, '\\u003c');
      res.status(result.created ? 201 : 200).type('html').send(`<!doctype html><meta charset="utf-8"><title>Coordinator V2 runtime release</title>
        <h1>Runtime release ${result.created ? 'published' : 'already up to date'}</h1>
        <pre>${safe}</pre>
        <p><a href="/coordination/v2/runtime-release-approval">Back to runtime release status</a></p>`);
    } catch (error) {
      console.error(
        '[CoordinationV2Runtime] Runtime release publication failed (founder trigger)',
        JSON.stringify(describeCoordinationV2RuntimePublicationFailure(error, Date.now() - startedAt)),
      );
      replyError(res, error);
    }
  });
}