import { eq } from 'drizzle-orm';
import {
  coordinationV2HostEnrollments,
  coordinationV2OperatorGrants,
  coordinationV2PolicyIdentities,
  coordinationV2PolicyVersions,
  coordinationV2Sessions,
  type CoordinationV2Session,
} from '@shared/schema';

export type LifecycleAction = 'launch' | 'resume' | 'terminate' | 'status';

export type LifecycleAuthorizationErrorCode =
  | 'LIFECYCLE_SESSION_NOT_FOUND'
  | 'LIFECYCLE_ACTOR_MISMATCH'
  | 'LIFECYCLE_GRANT_INVALID'
  | 'LIFECYCLE_POLICY_INVALID'
  | 'LIFECYCLE_HOST_INVALID'
  | 'LIFECYCLE_SESSION_EXPIRED'
  | 'LIFECYCLE_ACTION_DENIED';

export class CoordinationLifecycleAuthorizationError extends Error {
  readonly code: LifecycleAuthorizationErrorCode;
  constructor(code: LifecycleAuthorizationErrorCode) {
    super(code);
    this.name = 'CoordinationLifecycleAuthorizationError';
    this.code = code;
  }
}

function deny(code: LifecycleAuthorizationErrorCode): never {
  throw new CoordinationLifecycleAuthorizationError(code);
}

/**
 * Transaction-scoped authority check. The initial session read is deliberately
 * non-locking: every row lock acquired by this helper follows the canonical
 * grant -> policy identity -> policy version -> host -> session order.
 */
export async function authorizeCoordinationLifecycleInTransaction(
  tx: any,
  input: {
    sessionId: string;
    actorId: string;
    action: LifecycleAction;
    now: Date;
    requireHostId?: string;
    allowExpired?: boolean;
  },
): Promise<{
  session: CoordinationV2Session;
  grant: any;
  identity: any;
  version: any;
  host: any;
}> {
  const found = await tx.select().from(coordinationV2Sessions)
    .where(eq(coordinationV2Sessions.id, input.sessionId));
  const reference = found[0] as CoordinationV2Session | undefined;
  if (!reference) deny('LIFECYCLE_SESSION_NOT_FOUND');
  const grantRows = await tx.select().from(coordinationV2OperatorGrants)
    .where(eq(coordinationV2OperatorGrants.id, reference.operatorGrantId)).for('update');
  const grant = grantRows[0];
  if (!grant || grant.operatorActor !== reference.operatorActor || grant.operatorActor !== input.actorId
    || grant.revokedAt || grant.expiresAt <= input.now) deny('LIFECYCLE_GRANT_INVALID');
  if (!grant.actions.includes(input.action)) deny('LIFECYCLE_ACTION_DENIED');
  const identityRows = await tx.select().from(coordinationV2PolicyIdentities)
    .where(eq(coordinationV2PolicyIdentities.id, grant.policyIdentityId)).for('update');
  const identity = identityRows[0];
  if (!identity || identity.status !== 'active' || identity.revokedAt) deny('LIFECYCLE_POLICY_INVALID');
  const versionRows = await tx.select().from(coordinationV2PolicyVersions)
    .where(eq(coordinationV2PolicyVersions.id, reference.policyVersionId)).for('update');
  const version = versionRows[0];
  if (!version || version.policyIdentityId !== identity.id || version.approvalState !== 'approved'
    || version.revokedAt
    || (grant.minVersion !== null && version.version < grant.minVersion)
    || (grant.maxVersion !== null && version.version > grant.maxVersion)) deny('LIFECYCLE_POLICY_INVALID');
  const hostRows = await tx.select().from(coordinationV2HostEnrollments)
    .where(eq(coordinationV2HostEnrollments.id, reference.enrolledHostId)).for('update');
  const host = hostRows[0];
  if (!host || host.status !== 'active' || host.revokedAt
    || (input.requireHostId !== undefined && input.requireHostId !== host.id)) deny('LIFECYCLE_HOST_INVALID');
  const sessionRows = await tx.select().from(coordinationV2Sessions)
    .where(eq(coordinationV2Sessions.id, input.sessionId)).for('update');
  const session = sessionRows[0] as CoordinationV2Session | undefined;
  if (!session) deny('LIFECYCLE_SESSION_NOT_FOUND');
  if (session.operatorActor !== input.actorId) deny('LIFECYCLE_ACTOR_MISMATCH');
  if (session.expiresAt <= input.now && !input.allowExpired) deny('LIFECYCLE_SESSION_EXPIRED');
  return { session, grant, identity, version, host };
}