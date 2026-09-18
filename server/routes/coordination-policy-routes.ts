import type { Application, Request, Response, RequestHandler } from 'express';
import {
  requireFounder,
  loadAuthenticatedUser,
  type AuthenticatedRequest,
} from '../middleware/rbac';
import { isAuthenticated } from '../replitAuth';
import { storage } from '../storage';
import {
  requireCoordinationAuth,
  type CoordinationAuthenticatedRequest,
} from '../middleware/coordination-auth';
import {
  approvePolicyVersion,
  authorizeOperatorAction,
  createPolicyDraft,
  issueOperatorGrant,
  getPolicyVersion,
  listPolicyVersions,
  rejectPolicyVersion,
  revokePolicyVersion,
  revokeOperatorGrant,
  CoordinationPolicyError,
} from '../services/coordination-policy-service';

type FounderRequest = Request<{ id: string }, unknown, Record<string, unknown>>;
type CoordinationRequest = CoordinationAuthenticatedRequest & {
  body: Record<string, unknown>;
  params: { id: string };
};

export type CoordinationPolicyRouteDependencies = {
  founderMiddleware?: readonly RequestHandler[];
  coordinationAuthMiddleware?: RequestHandler;
  services?: Partial<{
    approvePolicyVersion: typeof approvePolicyVersion;
    authorizeOperatorAction: typeof authorizeOperatorAction;
    createPolicyDraft: typeof createPolicyDraft;
    issueOperatorGrant: typeof issueOperatorGrant;
    getPolicyVersion: typeof getPolicyVersion;
    listPolicyVersions: typeof listPolicyVersions;
    rejectPolicyVersion: typeof rejectPolicyVersion;
    revokePolicyVersion: typeof revokePolicyVersion;
    revokeOperatorGrant: typeof revokeOperatorGrant;
  }>;
};

const STATUS: Record<string, number> = {
  FOUNDER_REQUIRED: 401,
  POLICY_NOT_FOUND: 404,
  POLICY_VERSION_NOT_FOUND: 404,
  OPERATOR_GRANT_NOT_FOUND: 404,
  POLICY_INVALID: 422,
  FOUNDER_DECISION_REQUIRED: 422,
  OPERATOR_GRANT_INVALID: 422,
  POLICY_NOT_APPROVED: 409,
  POLICY_NOT_DRAFT: 409,
  POLICY_ALREADY_APPROVED: 409,
  POLICY_ALREADY_REJECTED: 409,
  POLICY_ALREADY_REVOKED: 409,
  POLICY_IDENTITY_REVOKED: 409,
  IDEMPOTENCY_CONFLICT: 409,
  OPERATOR_GRANT_EXPIRED: 403,
  OPERATOR_GRANT_REVOKED: 403,
  OPERATOR_GRANT_SCOPE_DENIED: 403,
  OPERATOR_GRANT_ACTION_DENIED: 403,
  OPERATOR_GRANT_POLICY_DENIED: 403,
  OPERATOR_GRANT_ALREADY_REVOKED: 409,
};

function replyError(res: Response, error: unknown): void {
  const code = error instanceof CoordinationPolicyError ? error.code : 'POLICY_DATABASE_UNAVAILABLE';
  res.status(STATUS[code] ?? 503).json({
    error: {
      code,
      ...(error instanceof CoordinationPolicyError && error.details ? { details: error.details } : {}),
    },
  });
}

function founderActor(req: FounderRequest): string {
  const actor = (req as AuthenticatedRequest).authenticatedUser?.id;
  if (!actor) {
    const error = new CoordinationPolicyError('FOUNDER_REQUIRED');
    throw error;
  }
  return actor;
}

function stringBody(body: Record<string, unknown>, key: string): string | undefined {
  return typeof body[key] === 'string' ? body[key] as string : undefined;
}

export function registerCoordinationPolicyRoutes(
  app: Application,
  dependencies: CoordinationPolicyRouteDependencies = {},
): void {
  const founderSession = dependencies.founderMiddleware
    ? [...dependencies.founderMiddleware]
    : [isAuthenticated, loadAuthenticatedUser(storage), requireFounder];
  const coordinationAuth = dependencies.coordinationAuthMiddleware ?? requireCoordinationAuth;
  const policyServices = {
    approvePolicyVersion,
    authorizeOperatorAction,
    createPolicyDraft,
    issueOperatorGrant,
    getPolicyVersion,
    listPolicyVersions,
    rejectPolicyVersion,
    revokePolicyVersion,
    revokeOperatorGrant,
    ...dependencies.services,
  };

  app.post('/api/coordination/v2/policies', ...founderSession, async (req: FounderRequest, res: Response) => {
    try {
      const actor = founderActor(req);
      const result = await policyServices.createPolicyDraft({
        policyKey: stringBody(req.body, 'policyKey') || '',
        displayName: stringBody(req.body, 'displayName') || '',
        description: stringBody(req.body, 'description'),
        policy: req.body.policy,
        createdBy: actor,
      });
      res.status(201).json(result);
    } catch (error) {
      replyError(res, error);
    }
  });

  app.post('/api/coordination/v2/policy-versions/:id/approve', ...founderSession, async (req: FounderRequest, res: Response) => {
    try {
      const result = await policyServices.approvePolicyVersion({
        versionId: req.params.id,
        founderActor: founderActor(req),
        requestKey: stringBody(req.body, 'requestKey') || '',
        reason: stringBody(req.body, 'reason'),
      });
      res.json(result);
    } catch (error) {
      replyError(res, error);
    }
  });

  app.post('/api/coordination/v2/policy-versions/:id/reject', ...founderSession, async (req: FounderRequest, res: Response) => {
    try {
      const result = await policyServices.rejectPolicyVersion({
        versionId: req.params.id,
        founderActor: founderActor(req),
        requestKey: stringBody(req.body, 'requestKey') || '',
        reason: stringBody(req.body, 'reason'),
      });
      res.json(result);
    } catch (error) {
      replyError(res, error);
    }
  });

  app.post('/api/coordination/v2/policy-versions/:id/revoke', ...founderSession, async (req: FounderRequest, res: Response) => {
    try {
      const result = await policyServices.revokePolicyVersion({
        versionId: req.params.id,
        founderActor: founderActor(req),
        requestKey: stringBody(req.body, 'requestKey') || '',
        reason: stringBody(req.body, 'reason'),
      });
      res.json(result);
    } catch (error) {
      replyError(res, error);
    }
  });

  app.post('/api/coordination/v2/operator-grants', ...founderSession, async (req: FounderRequest, res: Response) => {
    try {
      const body = req.body;
      const result = await policyServices.issueOperatorGrant({
        policyIdentityId: stringBody(body, 'policyIdentityId') || '',
        operatorActor: stringBody(body, 'operatorActor') || '',
        minVersion: typeof body.minVersion === 'number' ? body.minVersion : undefined,
        maxVersion: typeof body.maxVersion === 'number' ? body.maxVersion : undefined,
        actions: Array.isArray(body.actions) ? body.actions.filter((value): value is string => typeof value === 'string') : [],
        expiresAt: stringBody(body, 'expiresAt') || '',
        requestKey: stringBody(body, 'requestKey') || '',
        founderActor: founderActor(req),
        founderRole: 'founder',
      });
      res.status(201).json(result);
    } catch (error) {
      replyError(res, error);
    }
  });

  app.post('/api/coordination/v2/operator-grants/authorize', coordinationAuth, async (req: CoordinationRequest, res: Response) => {
    try {
      if (!req.coordinationActor) {
        res.status(401).json({ error: { code: 'OPERATOR_REQUIRED' } });
        return;
      }
      const result = await policyServices.authorizeOperatorAction({
        grantId: stringBody(req.body, 'grantId') || '',
        operatorActor: req.coordinationActor,
        policyVersionId: stringBody(req.body, 'policyVersionId') || '',
        action: stringBody(req.body, 'action') || '',
      });
      res.json(result);
    } catch (error) {
      replyError(res, error);
    }
  });

  app.post('/api/coordination/v2/operator-grants/:id/revoke', ...founderSession, async (req: FounderRequest, res: Response) => {
    try {
      const result = await policyServices.revokeOperatorGrant({
        grantId: req.params.id,
        founderActor: founderActor(req),
        founderRole: 'founder',
        requestKey: stringBody(req.body, 'requestKey') || '',
        reason: stringBody(req.body, 'reason'),
      });
      res.json(result);
    } catch (error) {
      replyError(res, error);
    }
  });

  app.get('/api/coordination/v2/policy-versions/:id', coordinationAuth, async (req: CoordinationAuthenticatedRequest, res: Response) => {
    try {
      res.json(await policyServices.getPolicyVersion(req.params.id));
    } catch (error) {
      replyError(res, error);
    }
  });

  app.get('/api/coordination/v2/policies/:id/versions', coordinationAuth, async (req: CoordinationAuthenticatedRequest, res: Response) => {
    try {
      res.json(await policyServices.listPolicyVersions(req.params.id));
    } catch (error) {
      replyError(res, error);
    }
  });
}
