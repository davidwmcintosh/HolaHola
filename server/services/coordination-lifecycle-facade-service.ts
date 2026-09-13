import { createHash } from 'node:crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  coordinationV2HostEnrollments,
  coordinationV2OperatorGrants,
  coordinationV2PolicyIdentities,
  coordinationV2PolicyVersions,
  coordinationV2CleanupObligations,
  coordinationV2Sessions,
  coordinationV2PreparationReservations,
  coordinationV2Attempts,
} from '@shared/schema';
import {
  createOrResumeSession,
  transitionCoordinationSession,
  type SessionDto,
} from './coordination-session-service';
import {
  createFreshAttempt,
  transitionCoordinationAttempt,
  resumeSameCoordinationAttempt,
} from './coordination-attempt-service';
import {
  acquireCoordinationTransportLease,
} from './coordination-transport-lease-service';
import {
  acceptCoordinationCompletion,
  transitionCoordinationCleanup,
} from './coordination-cleanup-service';
import {
  mapProviderFailure,
  type ProviderFailure,
  type ProviderFailureEnvelope,
  type FailureMapping,
} from './coordination-provider-failure';
import {
  DEFAULT_PROVIDER_REGISTRY,
  type CoordinationProviderRegistry,
} from './coordination-provider-adapters/registry';
import type { ProviderAdapterDescriptor, ProviderSelectionPolicy } from './coordination-provider-adapters/types';
import {
  resolveCoordinationTaskMetadata,
  DEFAULT_COORDINATION_TASK_METADATA_REGISTRY,
  CoordinationTaskMetadataError,
  type CoordinationTaskMetadata,
  type CoordinationTaskMetadataRegistry,
} from './coordination-task-metadata-service';
import type { AttemptCommand } from './coordination-attempt-state';
import type { SessionCommand } from './coordination-session-state';

export type CoordinationLifecycleOperatorInput = Readonly<{
  taskRef: string;
  policySelector?: string;
}>;

/** Authenticated context is supplied by middleware, never decoded from body. */
export type CoordinationLifecycleActorContext = Readonly<{
  actorId: string;
  requestKey?: string;
}>;

export type CoordinationLifecycleSafeState =
  | 'preparing' | 'ready' | 'running' | 'waiting_for_host' | 'verifying'
  | 'cleanup_pending' | 'succeeded' | 'failed' | 'exhausted' | 'expired' | 'revoked';

export type CoordinationLifecycleSafeStatus = Readonly<{
  state: CoordinationLifecycleSafeState;
  cleanupPending: boolean;
}>;

export class CoordinationLifecycleFacadeError extends Error {
  readonly code:
    | 'LIFECYCLE_INVALID_REQUEST'
    | 'LIFECYCLE_TASK_UNSUPPORTED'
    | 'LIFECYCLE_POLICY_UNAVAILABLE'
    | 'LIFECYCLE_HOST_UNAVAILABLE'
    | 'LIFECYCLE_PROVIDER_UNAVAILABLE'
    | 'LIFECYCLE_DATABASE_UNAVAILABLE'
    | 'LIFECYCLE_TRANSITION_REJECTED';
  constructor(code: CoordinationLifecycleFacadeError['code']) {
    super(code);
    this.name = 'CoordinationLifecycleFacadeError';
    this.code = code;
  }
}

type ResolvedPolicy = Readonly<{
  policyVersionId: string;
  operatorGrantId: string;
  policy: ProviderSelectionPolicy;
}>;

type ResolvedHost = Readonly<{ enrolledHostId: string }>;

export type CoordinationProviderFailureInput = Readonly<{
  /** Provider-native identity is deliberately excluded; it is read from the attempt row. */
  failure: ProviderFailure;
  sessionId: string;
  attemptId: string;
  actorId: string;
  requestKey: string;
}>;

export type ResolvedProviderFailureAuthority = Readonly<{
  sessionId: string;
  attemptId: string;
  policy: ProviderSelectionPolicy;
  currentProvider: ProviderAdapterDescriptor;
  nextProvider?: ProviderAdapterDescriptor;
}>;

type LifecycleServices = {
  createOrResumeSession: typeof createOrResumeSession;
  transitionCoordinationSession: typeof transitionCoordinationSession;
  createFreshAttempt: typeof createFreshAttempt;
  transitionCoordinationAttempt: typeof transitionCoordinationAttempt;
  resumeSameCoordinationAttempt: typeof resumeSameCoordinationAttempt;
  acquireCoordinationTransportLease: typeof acquireCoordinationTransportLease;
  acceptCoordinationCompletion: typeof acceptCoordinationCompletion;
  transitionCoordinationCleanup: typeof transitionCoordinationCleanup;
};

export type CoordinationLifecycleFacadeDependencies = {
  taskMetadataRegistry?: CoordinationTaskMetadataRegistry;
  resolveTaskMetadata?: (taskRef: string) => Promise<CoordinationTaskMetadata>;
  resolvePolicy?: (context: CoordinationLifecycleActorContext, selector?: string) => Promise<ResolvedPolicy>;
  resolveHost?: (context: CoordinationLifecycleActorContext) => Promise<ResolvedHost>;
  providerRegistry?: CoordinationProviderRegistry;
  services?: Partial<LifecycleServices>;
  now?: () => Date;
  cleanupPending?: (sessionId: string) => Promise<boolean>;
  readDurableSessionState?: (sessionId: string) => Promise<string>;
  preparationAcknowledged?: (sessionId: string) => Promise<boolean>;
  resolveProviderFailureAuthority?: (
    sessionId: string,
    attemptId: string,
    actorId: string,
  ) => Promise<ResolvedProviderFailureAuthority>;
  /** Stable server-generated request identity for retries when middleware has none. */
  idempotencyKey?: (input: CoordinationLifecycleOperatorInput, context: CoordinationLifecycleActorContext) => string;
  holderInstanceId?: () => string;
  leaseDurationMs?: number;
};

function invalid(input: CoordinationLifecycleOperatorInput, context: CoordinationLifecycleActorContext): void {
  if (!input || typeof input !== 'object'
    || Object.keys(input as Record<string, unknown>).some((key) => key !== 'taskRef' && key !== 'policySelector')) {
    throw new CoordinationLifecycleFacadeError('LIFECYCLE_INVALID_REQUEST');
  }
  if (typeof input.taskRef !== 'string' || !/^[1-9][0-9]*$/.test(input.taskRef)
    || !context.actorId || context.actorId.trim() !== context.actorId) {
    throw new CoordinationLifecycleFacadeError('LIFECYCLE_INVALID_REQUEST');
  }
  if (input.policySelector !== undefined
    && (typeof input.policySelector !== 'string' || !input.policySelector || input.policySelector.length > 128
      || input.policySelector.trim() !== input.policySelector)) {
    throw new CoordinationLifecycleFacadeError('LIFECYCLE_INVALID_REQUEST');
  }
}

function requestKey(
  input: CoordinationLifecycleOperatorInput,
  context: CoordinationLifecycleActorContext,
  dependencies: CoordinationLifecycleFacadeDependencies,
): string {
  if (context.requestKey) return context.requestKey;
  if (dependencies.idempotencyKey) return dependencies.idempotencyKey(input, context);
  return createHash('sha256').update(JSON.stringify({
    taskRef: input.taskRef, policySelector: input.policySelector ?? null, actorId: context.actorId,
  })).digest('hex');
}

function safeState(value: string): CoordinationLifecycleSafeState {
  if (value === 'succeeded') return 'succeeded';
  if (['preparing', 'ready', 'running', 'waiting_for_host', 'verifying',
    'failed', 'exhausted', 'expired', 'revoked'].includes(value)) {
    return value as CoordinationLifecycleSafeState;
  }
  return 'cleanup_pending';
}

async function cleanupPending(sessionId: string): Promise<boolean> {
  const rows = await db.select({ state: coordinationV2CleanupObligations.state })
    .from(coordinationV2CleanupObligations)
    .where(eq(coordinationV2CleanupObligations.sessionId, sessionId));
  return rows.length === 0 || rows.some((row) => row.state !== 'acknowledged');
}

function statusFromSession(session: SessionDto, pending: boolean): CoordinationLifecycleSafeStatus {
  // A succeeded row is not operator-ready until all four obligations have
  // durable acknowledgements.
  return Object.freeze({
    state: session.state === 'succeeded' && pending ? 'cleanup_pending' : safeState(session.state),
    cleanupPending: pending,
  });
}

async function defaultTaskMetadata(taskRef: string): Promise<CoordinationTaskMetadata> {
  return resolveCoordinationTaskMetadata(taskRef);
}

async function defaultPolicy(
  context: CoordinationLifecycleActorContext,
  selector?: string,
): Promise<ResolvedPolicy> {
  const versions = await db.select({
    version: coordinationV2PolicyVersions,
    identity: coordinationV2PolicyIdentities,
  }).from(coordinationV2PolicyVersions)
    .innerJoin(
      coordinationV2PolicyIdentities,
      eq(coordinationV2PolicyVersions.policyIdentityId, coordinationV2PolicyIdentities.id),
    )
    .where(and(
      eq(coordinationV2PolicyVersions.approvalState, 'approved'),
      eq(coordinationV2PolicyIdentities.status, 'active'),
    )).orderBy(desc(coordinationV2PolicyVersions.version));
  const selected = versions.find(({ version, identity }) =>
    !selector || selector === identity.policyKey);
  if (!selected || selected.version.revokedAt) {
    throw new CoordinationLifecycleFacadeError('LIFECYCLE_POLICY_UNAVAILABLE');
  }
  const grants = await db.select().from(coordinationV2OperatorGrants)
    .where(and(
      eq(coordinationV2OperatorGrants.operatorActor, context.actorId),
      eq(coordinationV2OperatorGrants.policyIdentityId, selected.identity.id),
      gt(coordinationV2OperatorGrants.expiresAt, sql`CURRENT_TIMESTAMP`),
    )).orderBy(desc(coordinationV2OperatorGrants.expiresAt));
  const grant = grants.find((candidate) =>
    !candidate.revokedAt
      && candidate.actions.includes('launch')
      && (candidate.minVersion === null || selected.version.version >= candidate.minVersion)
      && (candidate.maxVersion === null || selected.version.version <= candidate.maxVersion));
  if (!grant) throw new CoordinationLifecycleFacadeError('LIFECYCLE_POLICY_UNAVAILABLE');
  return {
    policyVersionId: selected.version.id,
    operatorGrantId: grant.id,
    policy: selected.version.canonicalPolicy as ProviderSelectionPolicy,
  };
}

async function defaultHost(): Promise<ResolvedHost> {
  const hosts = await db.select().from(coordinationV2HostEnrollments)
    .where(and(
      eq(coordinationV2HostEnrollments.status, 'active'),
      eq(coordinationV2HostEnrollments.protocolVersion, 1),
    )).orderBy(desc(coordinationV2HostEnrollments.updatedAt));
  const host = hosts.find((candidate) => !candidate.revokedAt && candidate.hostType.toLowerCase() === 'windows');
  if (!host) throw new CoordinationLifecycleFacadeError('LIFECYCLE_HOST_UNAVAILABLE');
  return { enrolledHostId: host.id };
}

function descriptorFor(
  policy: ProviderSelectionPolicy,
  registry: CoordinationProviderRegistry,
): ProviderAdapterDescriptor {
  for (const provider of policy.providerOrder) {
    const descriptor = registry.descriptorsForProvider(provider).find((candidate) => {
      try {
        registry.resolve(candidate, policy);
        return true;
      } catch {
        return false;
      }
    });
    if (descriptor) return descriptor;
  }
  throw new CoordinationLifecycleFacadeError('LIFECYCLE_PROVIDER_UNAVAILABLE');
}

function descriptorForProvider(
  provider: string,
  policy: ProviderSelectionPolicy,
  registry: CoordinationProviderRegistry,
): ProviderAdapterDescriptor {
  const descriptor = registry.descriptorsForProvider(provider).find((candidate) => {
    try {
      registry.resolve(candidate, policy);
      return true;
    } catch {
      return false;
    }
  });
  if (!descriptor) throw new CoordinationLifecycleFacadeError('LIFECYCLE_PROVIDER_UNAVAILABLE');
  return descriptor;
}

function selectionPolicy(value: Record<string, unknown>): ProviderSelectionPolicy | undefined {
  const order = value.providerOrder;
  const total = value.totalAttemptBudget;
  if (!Array.isArray(order) || order.length === 0
    || order.some((provider) => typeof provider !== 'string' || !provider.trim())
    || typeof total !== 'number' || !Number.isInteger(total) || total <= 0) {
    return undefined;
  }
  const budgets = value.providerAttemptBudgets;
  if (budgets !== undefined && (typeof budgets !== 'object' || budgets === null || Array.isArray(budgets)
    || Object.values(budgets as Record<string, unknown>).some((budget) =>
      typeof budget !== 'number' || !Number.isInteger(budget) || budget <= 0))) {
    return undefined;
  }
  const fallback = value.fallbackEligibleFailureClasses;
  if (fallback !== undefined && (!Array.isArray(fallback)
    || fallback.some((reason) => typeof reason !== 'string' || !reason.trim()))) {
    return undefined;
  }
  const constraints = value.providerConstraints;
  if (constraints !== undefined
    && (typeof constraints !== 'object' || constraints === null || Array.isArray(constraints)
      || Object.values(constraints as Record<string, unknown>).some((constraint) => {
        if (typeof constraint !== 'object' || constraint === null || Array.isArray(constraint)) return true;
        const value = constraint as Record<string, unknown>;
        return (value.models !== undefined
          && (!Array.isArray(value.models) || value.models.some((model) => typeof model !== 'string')))
          || (value.adapterVersions !== undefined
            && (!Array.isArray(value.adapterVersions)
              || value.adapterVersions.some((version) => typeof version !== 'string')));
      }))) {
    return undefined;
  }
  return value as unknown as ProviderSelectionPolicy;
}

async function defaultProviderFailureAuthority(
  sessionId: string,
  attemptId: string,
  actorId: string,
  registry: CoordinationProviderRegistry = DEFAULT_PROVIDER_REGISTRY,
): Promise<ResolvedProviderFailureAuthority> {
  const rows = await db.select({
    session: coordinationV2Sessions,
    attempt: coordinationV2Attempts,
    version: coordinationV2PolicyVersions,
    identity: coordinationV2PolicyIdentities,
    grant: coordinationV2OperatorGrants,
  }).from(coordinationV2Attempts)
    .innerJoin(coordinationV2Sessions, eq(coordinationV2Attempts.sessionId, coordinationV2Sessions.id))
    .innerJoin(coordinationV2PolicyVersions, eq(coordinationV2Sessions.policyVersionId, coordinationV2PolicyVersions.id))
    .innerJoin(
      coordinationV2PolicyIdentities,
      eq(coordinationV2PolicyVersions.policyIdentityId, coordinationV2PolicyIdentities.id),
    )
    .innerJoin(coordinationV2OperatorGrants, eq(coordinationV2Sessions.operatorGrantId, coordinationV2OperatorGrants.id))
    .where(and(
      eq(coordinationV2Attempts.id, attemptId),
      eq(coordinationV2Attempts.sessionId, sessionId),
      eq(coordinationV2Sessions.id, sessionId),
      eq(coordinationV2Sessions.operatorActor, actorId),
      eq(coordinationV2PolicyVersions.approvalState, 'approved'),
      isNull(coordinationV2PolicyVersions.revokedAt),
      eq(coordinationV2PolicyIdentities.status, 'active'),
      isNull(coordinationV2PolicyIdentities.revokedAt),
      eq(coordinationV2OperatorGrants.policyIdentityId, coordinationV2PolicyIdentities.id),
      eq(coordinationV2OperatorGrants.operatorActor, actorId),
      isNull(coordinationV2OperatorGrants.revokedAt),
      gt(coordinationV2OperatorGrants.expiresAt, sql`CURRENT_TIMESTAMP`),
      gt(coordinationV2Sessions.expiresAt, sql`CURRENT_TIMESTAMP`),
    ))
    .limit(1);
  const row = rows[0];
  const terminalAttemptStates = new Set(['completed', 'retryable_failed', 'terminal_failed', 'cancelled']);
  const terminalSessionStates = new Set(['succeeded', 'failed', 'exhausted', 'expired', 'revoked']);
  if (!row || terminalAttemptStates.has(row.attempt.state) || terminalSessionStates.has(row.session.state)) {
    throw new CoordinationLifecycleFacadeError('LIFECYCLE_TRANSITION_REJECTED');
  }

  // The failure event can only be applied to the session's current attempt.
  const currentRows = await db.select({ attempt: coordinationV2Attempts })
    .from(coordinationV2Attempts)
    .where(eq(coordinationV2Attempts.sessionId, sessionId))
    .orderBy(desc(coordinationV2Attempts.sessionOrdinal))
    .limit(1);
  const current = currentRows[0]?.attempt;
  if (!current || current.id !== row.attempt.id || terminalAttemptStates.has(current.state)) {
    throw new CoordinationLifecycleFacadeError('LIFECYCLE_TRANSITION_REJECTED');
  }

  const policy = selectionPolicy(row.version.canonicalPolicy);
  if (!policy) throw new CoordinationLifecycleFacadeError('LIFECYCLE_POLICY_UNAVAILABLE');
  const currentProvider = descriptorForProvider(row.attempt.provider, policy, registry);
  if (currentProvider.model !== row.attempt.model
    || currentProvider.adapterVersion !== row.attempt.adapterVersion) {
    throw new CoordinationLifecycleFacadeError('LIFECYCLE_PROVIDER_UNAVAILABLE');
  }
  const providerIndex = policy.providerOrder.indexOf(currentProvider.provider);
  const nextProvider = policy.providerOrder.slice(providerIndex + 1)
    .map((provider) => {
      try {
        return descriptorForProvider(provider, policy, registry);
      } catch {
        return undefined;
      }
    }).find((descriptor): descriptor is ProviderAdapterDescriptor => descriptor !== undefined);
  return { sessionId, attemptId, policy, currentProvider, nextProvider };
}

type AttemptFailureCommand = Omit<
  Extract<AttemptCommand, { type: 'fail' }>,
  'requestId' | 'eventId' | 'now'
>;
type SessionFailureCommand = Omit<
  Extract<SessionCommand, { type: 'fail' }>,
  'requestId' | 'eventId' | 'now'
>;

function attemptFailureCommand(
  classification: AttemptFailureCommand['classification'],
): AttemptFailureCommand {
  return { type: 'fail', classification };
}

function sessionFailureCommand(
  reason: string,
  classification?: SessionFailureCommand['classification'],
): SessionFailureCommand {
  return { type: 'fail', reason, ...(classification ? { classification } : {}) };
}

function deterministicIdentity(...parts: string[]): string {
  return createHash('sha256').update(parts.join('\u0000'), 'utf8').digest('hex');
}

function validateProviderFailureInput(input: CoordinationProviderFailureInput): void {
  if (!input || typeof input !== 'object'
    || Object.keys(input as Record<string, unknown>).some((key) =>
      !['failure', 'sessionId', 'attemptId', 'actorId', 'requestKey'].includes(key))
    || !input.sessionId || input.sessionId.trim() !== input.sessionId
    || !input.attemptId || input.attemptId.trim() !== input.attemptId
    || !input.actorId || input.actorId.trim() !== input.actorId
    || !input.requestKey || input.requestKey.trim() !== input.requestKey
    || !input.failure || typeof input.failure !== 'object'
    || Object.keys(input.failure as Record<string, unknown>).some((key) => !['kind', 'detail'].includes(key))
    || typeof input.failure.kind !== 'string') {
    throw new CoordinationLifecycleFacadeError('LIFECYCLE_INVALID_REQUEST');
  }
}

async function readDurableSessionState(sessionId: string): Promise<string> {
  const rows = await db.select({ state: coordinationV2Sessions.state })
    .from(coordinationV2Sessions)
    .where(eq(coordinationV2Sessions.id, sessionId));
  return rows[0]?.state ?? 'preparing';
}

/**
 * Only the newest reservation lineage may authorize the preparation transition.
 * In particular, an older acknowledged row cannot revive a newer failed,
 * abandoned, expired, or superseded reservation.
 */
async function preparationAcknowledged(sessionId: string): Promise<boolean> {
  const rows = await db.select({
    reservation: coordinationV2PreparationReservations,
    session: coordinationV2Sessions,
  }).from(coordinationV2PreparationReservations)
    .innerJoin(
      coordinationV2Sessions,
      eq(coordinationV2PreparationReservations.sessionId, coordinationV2Sessions.id),
    )
    .where(eq(coordinationV2PreparationReservations.sessionId, sessionId))
    .orderBy(desc(coordinationV2PreparationReservations.createdAt))
    .limit(1);
  const row = rows[0];
  if (!row) return false;
  const reservation = row.reservation;
  const session = row.session;
  return reservation.state === 'acknowledged'
    && reservation.acknowledgedAt !== null
    && reservation.protocolVersion === 1
    && reservation.sessionId === session.id
    && reservation.enrolledHostId === session.enrolledHostId
    && reservation.repositoryIdentity === session.repositoryIdentity
    && reservation.startingCommit === session.startingCommit;
}

/**
 * The sole operator launch entry point. Internal identifiers, metadata,
 * credentials, receipts, and provider-native values never appear in its
 * return value.
 */
export async function launchOrResumeCoordinationLifecycle(
  input: CoordinationLifecycleOperatorInput,
  context: CoordinationLifecycleActorContext,
  dependencies: CoordinationLifecycleFacadeDependencies = {},
): Promise<CoordinationLifecycleSafeStatus> {
  invalid(input, context);
  const services: LifecycleServices = {
    createOrResumeSession,
    transitionCoordinationSession,
    createFreshAttempt,
    transitionCoordinationAttempt,
    resumeSameCoordinationAttempt,
    acquireCoordinationTransportLease,
    acceptCoordinationCompletion,
    transitionCoordinationCleanup,
    ...dependencies.services,
  };
  try {
    const [metadata, policy, host] = await Promise.all([
      dependencies.resolveTaskMetadata
        ? dependencies.resolveTaskMetadata(input.taskRef)
        : resolveCoordinationTaskMetadata(input.taskRef, {
          registry: dependencies.taskMetadataRegistry ?? DEFAULT_COORDINATION_TASK_METADATA_REGISTRY,
        }),
      (dependencies.resolvePolicy ?? defaultPolicy)(context, input.policySelector),
      (dependencies.resolveHost ?? defaultHost)(context),
    ]);
    const key = requestKey(input, context, dependencies);
    const session = await services.createOrResumeSession({
      operatorActor: context.actorId,
      operatorGrantId: policy.operatorGrantId,
      policyVersionId: policy.policyVersionId,
      taskRef: metadata.taskRef,
      taskArtifactSha256: metadata.taskArtifactSha256,
      repositoryIdentity: metadata.repositoryIdentity,
      startingCommit: metadata.startingCommit,
      enrolledHostId: host.enrolledHostId,
      requestedProviders: [...policy.policy.providerOrder],
      idempotencyKey: key,
    });
    let current = session;
    if (current.state === 'preparing') {
      const acknowledged = await (dependencies.preparationAcknowledged ?? preparationAcknowledged)(current.id);
      if (!acknowledged) {
        return statusFromSession(current, false);
      }
      current = await services.transitionCoordinationSession({
        sessionId: session.id, requestKey: `${key}:prepare`, actorId: context.actorId,
        command: { type: 'preparation_ready' },
      });
    }
    if (['ready'].includes(current.state)) {
      const descriptor = descriptorFor(policy.policy, dependencies.providerRegistry ?? DEFAULT_PROVIDER_REGISTRY);
      await services.createFreshAttempt({
        sessionId: current.id, requestKey: `${key}:attempt`, actorId: context.actorId,
        provider: descriptor.provider, model: descriptor.model, adapterVersion: descriptor.adapterVersion,
        attemptGeneration: deterministicIdentity(key, current.id, 'attempt', '1', descriptor.provider),
      });
      const durableState = await (dependencies.readDurableSessionState ?? readDurableSessionState)(current.id);
      current = { ...current, state: durableState };
    }
    if (['running', 'waiting_for_host', 'verifying'].includes(current.state)) {
      await services.acquireCoordinationTransportLease({
        sessionId: current.id, actorId: context.actorId,
        holderInstanceId: dependencies.holderInstanceId?.()
          ?? deterministicIdentity(key, current.id, 'holder-lineage'),
        requestKey: `${key}:lease`, durationMs: dependencies.leaseDurationMs ?? 15 * 60 * 1_000,
      });
    }
    return statusFromSession(
      current,
      current.state === 'succeeded'
        ? await (dependencies.cleanupPending ?? cleanupPending)(current.id)
        : false,
    );
  } catch (error) {
    if (error instanceof CoordinationLifecycleFacadeError) throw error;
    if (error instanceof CoordinationTaskMetadataError) {
      throw new CoordinationLifecycleFacadeError(
        error.code === 'TASK_METADATA_INVALID_REQUEST'
          ? 'LIFECYCLE_INVALID_REQUEST' : 'LIFECYCLE_TASK_UNSUPPORTED',
      );
    }
    throw new CoordinationLifecycleFacadeError('LIFECYCLE_DATABASE_UNAVAILABLE');
  }
}

export async function applyCoordinationProviderFailure(
  input: CoordinationProviderFailureInput,
  dependencies: CoordinationLifecycleFacadeDependencies = {},
): Promise<FailureMapping> {
  validateProviderFailureInput(input);
  let authority: ResolvedProviderFailureAuthority;
  try {
    authority = await (dependencies.resolveProviderFailureAuthority
      ?? ((sessionId, attemptId, actorId) => defaultProviderFailureAuthority(
        sessionId, attemptId, actorId, dependencies.providerRegistry ?? DEFAULT_PROVIDER_REGISTRY,
      )))(input.sessionId, input.attemptId, input.actorId);
  } catch (error) {
    if (error instanceof CoordinationLifecycleFacadeError) throw error;
    throw new CoordinationLifecycleFacadeError('LIFECYCLE_DATABASE_UNAVAILABLE');
  }
  const failure: ProviderFailureEnvelope = {
    provider: authority.currentProvider.provider,
    model: authority.currentProvider.model,
    adapterVersion: authority.currentProvider.adapterVersion,
    failure: input.failure,
  };
  const decision = mapProviderFailure(failure, authority.policy);
  const services: LifecycleServices = {
    createOrResumeSession,
    transitionCoordinationSession,
    createFreshAttempt,
    transitionCoordinationAttempt,
    resumeSameCoordinationAttempt,
    acquireCoordinationTransportLease,
    acceptCoordinationCompletion,
    transitionCoordinationCleanup,
    ...dependencies.services,
  };
  if (decision.classification === 'fresh_attempt_next_provider' && !authority.nextProvider) {
    throw new CoordinationLifecycleFacadeError('LIFECYCLE_PROVIDER_UNAVAILABLE');
  }
  if (decision.classification === 'resume_transport') {
    await services.resumeSameCoordinationAttempt({
      attemptId: input.attemptId, requestKey: `${input.requestKey}:resume`, actorId: input.actorId,
    });
  } else if (decision.classification === 'fresh_attempt_same_provider'
    || decision.classification === 'fresh_attempt_next_provider') {
    await services.transitionCoordinationAttempt({
      attemptId: input.attemptId, requestKey: `${input.requestKey}:fail`, actorId: input.actorId,
      command: attemptFailureCommand(decision.classification),
    });
    const next = decision.classification === 'fresh_attempt_next_provider'
      ? authority.nextProvider
      : {
        provider: authority.currentProvider.provider,
        model: authority.currentProvider.model,
        adapterVersion: authority.currentProvider.adapterVersion,
      };
    if (!next) throw new CoordinationLifecycleFacadeError('LIFECYCLE_PROVIDER_UNAVAILABLE');
    await services.createFreshAttempt({
      sessionId: input.sessionId, requestKey: `${input.requestKey}:attempt`, actorId: input.actorId,
      provider: next.provider, model: next.model, adapterVersion: next.adapterVersion,
      previousAttemptId: input.attemptId, classification: decision.classification,
      attemptGeneration: deterministicIdentity(
        input.requestKey, input.sessionId, 'retry', input.attemptId, next.provider,
      ),
    });
  } else {
    await services.transitionCoordinationAttempt({
      attemptId: input.attemptId, requestKey: `${input.requestKey}:fail`, actorId: input.actorId,
      command: attemptFailureCommand('terminal_failure'),
    });
    await services.transitionCoordinationSession({
      sessionId: input.sessionId, requestKey: `${input.requestKey}:terminal`, actorId: input.actorId,
      command: sessionFailureCommand(decision.reason, 'terminal_failure'),
    });
  }
  return decision;
}

export const runCoordinationLifecycle = launchOrResumeCoordinationLifecycle;
export const launchCoordinationLifecycle = launchOrResumeCoordinationLifecycle;

/** Dependency-container form used by server middleware and hermetic callers. */
export class CoordinationLifecycleFacadeService {
  constructor(private readonly dependencies: CoordinationLifecycleFacadeDependencies = {}) {}

  launch(
    input: CoordinationLifecycleOperatorInput,
    context: CoordinationLifecycleActorContext,
  ): Promise<CoordinationLifecycleSafeStatus> {
    return launchOrResumeCoordinationLifecycle(input, context, this.dependencies);
  }

  applyProviderFailure(
    input: CoordinationProviderFailureInput,
  ): Promise<FailureMapping> {
    return applyCoordinationProviderFailure(input, this.dependencies);
  }
}