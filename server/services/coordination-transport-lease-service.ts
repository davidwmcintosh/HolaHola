import { createHash, randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import {
  coordinationV2TransportLeaseReceipts,
  coordinationV2TransportLeaseReconciliations,
  coordinationV2TransportLeases,
  coordinationV2TransportWorkClaims,
  coordinationV2TransportWorkResults,
  coordinationV2Attempts,
  coordinationV2AttemptEvents,
  coordinationV2CleanupAcknowledgements,
  coordinationV2CleanupObligations,
  coordinationV2Sessions,
  type CoordinationV2TransportLease,
  type CoordinationV2Session,
  type CoordinationV2Attempt,
  type CoordinationV2CleanupObligation,
} from '@shared/schema';
import { canonicalJson } from './coordination-policy-canonicalization';
import { transitionTransportLease } from './coordination-transport-lease-state';
import { createTransportLeaseState, type TransportLeaseState } from './coordination-v2-types';
import { transitionAttempt } from './coordination-attempt-state';
import { transitionCleanup } from './coordination-cleanup-state';
import type { AttemptState, CleanupState } from './coordination-v2-types';
import {
  authorizeCoordinationLifecycleInTransaction,
  CoordinationLifecycleAuthorizationError,
} from './coordination-lifecycle-authorization';

/**
 * The host protocol deliberately has no process-local lease cache. PostgreSQL
 * rows and the pure reducer are the only authority. The lifecycle authorization
 * helper is called once per transaction and therefore never reacquires the
 * session before an earlier grant/policy lock.
 */
export type LeaseOperation =
  | 'acquire' | 'renew' | 'release' | 'expire' | 'takeover'
  | 'poll' | 'claim' | 'result' | 'ack' | 'cleanup';

export type TransportLeaseServiceErrorCode =
  | 'LEASE_INVALID_REQUEST'
  | 'LEASE_NOT_FOUND'
  | 'LEASE_CONFLICT'
  | 'LEASE_STALE_EPOCH'
  | 'LEASE_EXPIRED'
  | 'LEASE_HOST_MISMATCH'
  | 'LEASE_HOLDER_MISMATCH'
  | 'LEASE_AUTHORIZATION_DENIED'
  | 'LEASE_SESSION_TERMINAL'
  | 'LEASE_REPLAY_CONFLICT'
  | 'LEASE_RECONCILIATION_LIMIT'
  | 'LEASE_DATABASE_UNAVAILABLE';

export class CoordinationTransportLeaseError extends Error {
  readonly code: TransportLeaseServiceErrorCode;
  readonly details?: Record<string, unknown>;
  constructor(code: TransportLeaseServiceErrorCode, details?: Record<string, unknown>) {
    super(code);
    this.name = 'CoordinationTransportLeaseError';
    this.code = code;
    this.details = details;
  }
}

function fail(code: TransportLeaseServiceErrorCode, details?: Record<string, unknown>): never {
  throw new CoordinationTransportLeaseError(code, details);
}

function required(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128 || value.trim() !== value) {
    fail('LEASE_INVALID_REQUEST', { field });
  }
  return value;
}

function positiveEpoch(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) fail('LEASE_INVALID_REQUEST', { field: 'epoch' });
  return value as number;
}

function duration(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0 || (value as number) > 24 * 60 * 60 * 1000) {
    fail('LEASE_INVALID_REQUEST', { field: 'durationMs' });
  }
  return value as number;
}

function hash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

function dto(row: CoordinationV2TransportLease) {
  return {
    id: row.id,
    sessionId: row.sessionId,
    enrolledHostId: row.enrolledHostId,
    holderInstanceId: row.holderInstanceId,
    epoch: row.epoch,
    predecessorLeaseId: row.predecessorLeaseId,
    state: row.state,
    issuedAt: row.issuedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
  };
}

async function lockById(tx: any, table: any, id: string): Promise<any | undefined> {
  const rows = await tx.select().from(table).where(eq(table.id, id)).for('update');
  return rows[0];
}

async function databaseNow(tx: any): Promise<Date> {
  const result = await tx.execute(sql`SELECT CURRENT_TIMESTAMP AS now`);
  const row = (result as any).rows?.[0] ?? (result as any)[0];
  const value = row?.now;
  const now = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(now.getTime())) fail('LEASE_DATABASE_UNAVAILABLE');
  return now;
}

function leaseState(row: CoordinationV2TransportLease): TransportLeaseState {
  return {
    leaseId: row.id,
    sessionId: row.sessionId,
    enrolledHostId: row.enrolledHostId,
    holderInstanceId: row.holderInstanceId,
    epoch: row.epoch,
    issuedAt: row.issuedAt.getTime(),
    expiresAt: row.expiresAt.getTime(),
    endedAt: row.endedAt?.getTime() ?? null,
    predecessorLeaseId: row.predecessorLeaseId,
    state: row.state as TransportLeaseState['state'],
  } as TransportLeaseState;
}

function commandDuration(input: { durationMs?: number; duration?: number }): number {
  return duration(input.durationMs ?? input.duration);
}

function actionFor(operation: LeaseOperation): 'launch' | 'resume' | 'terminate' {
  return ['release', 'expire', 'cleanup', 'ack'].includes(operation) ? 'terminate' : 'resume';
}

type LeaseInput = {
  sessionId: string;
  enrolledHostId?: string;
  holderInstanceId: string;
  actorId: string;
  requestKey: string;
  durationMs?: number;
  duration?: number;
  epoch?: number;
  leaseId?: string;
  attemptId?: string;
  claimId?: string;
  obligationId?: string;
  result?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
  command?: unknown;
};

function validateIdentity(input: LeaseInput): void {
  required(input.sessionId, 'sessionId');
  required(input.holderInstanceId, 'holderInstanceId');
  required(input.actorId, 'actorId');
  required(input.requestKey, 'requestKey');
  if (input.leaseId !== undefined) required(input.leaseId, 'leaseId');
}

async function authorize(
  tx: any,
  input: LeaseInput,
  operation: LeaseOperation,
  now: Date,
  allowExpired = false,
  actionOverride?: 'launch' | 'resume' | 'terminate' | 'status',
): Promise<{ session: CoordinationV2Session; host: any }> {
  try {
    const authorized = await authorizeCoordinationLifecycleInTransaction(tx, {
      sessionId: input.sessionId,
      actorId: input.actorId,
      action: actionOverride ?? actionFor(operation),
      now,
      ...(input.enrolledHostId !== undefined ? { requireHostId: input.enrolledHostId } : {}),
      allowExpired,
    });
    if (input.enrolledHostId !== undefined && authorized.session.enrolledHostId !== input.enrolledHostId) {
      fail('LEASE_HOST_MISMATCH');
    }
    return authorized;
  } catch (error) {
    if (error instanceof CoordinationTransportLeaseError) throw error;
    if (error instanceof CoordinationLifecycleAuthorizationError) {
      if (error.code === 'LIFECYCLE_SESSION_NOT_FOUND') fail('LEASE_NOT_FOUND');
      if (error.code === 'LIFECYCLE_SESSION_EXPIRED') fail('LEASE_EXPIRED');
      if (error.code === 'LIFECYCLE_HOST_INVALID' || error.code === 'LIFECYCLE_ACTOR_MISMATCH') {
        fail('LEASE_HOST_MISMATCH');
      }
      fail('LEASE_AUTHORIZATION_DENIED', { reason: error.code });
    }
    throw error;
  }
}

async function latestLease(tx: any, sessionId: string): Promise<CoordinationV2TransportLease | undefined> {
  const rows = await tx.select().from(coordinationV2TransportLeases)
    .where(eq(coordinationV2TransportLeases.sessionId, sessionId))
    .orderBy(desc(coordinationV2TransportLeases.epoch)).limit(1).for('update');
  return rows[0] as CoordinationV2TransportLease | undefined;
}

async function currentLease(tx: any, sessionId: string): Promise<CoordinationV2TransportLease | undefined> {
  const rows = await tx.select().from(coordinationV2TransportLeases)
    .where(and(eq(coordinationV2TransportLeases.sessionId, sessionId), eq(coordinationV2TransportLeases.state, 'active')))
    .orderBy(desc(coordinationV2TransportLeases.epoch)).limit(1).for('update');
  return rows[0] as CoordinationV2TransportLease | undefined;
}

async function authorizeOperation(tx: any, input: LeaseInput, operation: LeaseOperation, now: Date, allowExpired = false) {
  let action = actionFor(operation);
  if (operation === 'acquire') {
    const [probe] = await tx.select().from(coordinationV2Sessions).where(eq(coordinationV2Sessions.id, input.sessionId));
    action = probe && ['preparing', 'ready'].includes(probe.state) ? 'launch' : 'resume';
  }
  const authorized = await authorize(tx, input, operation, now, allowExpired, action);
  if (['succeeded', 'failed', 'exhausted', 'expired', 'revoked'].includes(authorized.session.state)
    && !['ack', 'cleanup'].includes(operation)) {
    fail('LEASE_SESSION_TERMINAL');
  }
  return authorized;
}

async function priorReceipt(tx: any, sessionId: string, requestKey: string): Promise<any | undefined> {
  const rows = await tx.select().from(coordinationV2TransportLeaseReceipts)
    .where(and(
      eq(coordinationV2TransportLeaseReceipts.sessionId, sessionId),
      eq(coordinationV2TransportLeaseReceipts.requestKey, requestKey),
    )).for('update');
  return rows[0];
}

async function saveReceipt(
  tx: any,
  input: { sessionId: string; requestKey: string; operation: LeaseOperation },
  commandDigest: string,
  snapshot: Record<string, unknown>,
  now: Date,
  actorId: string,
  enrolledHostId: string,
): Promise<void> {
  await tx.insert(coordinationV2TransportLeaseReceipts).values({
    id: randomUUID(),
    sessionId: input.sessionId,
    requestKey: input.requestKey,
    operation: input.operation,
    actorId,
    enrolledHostId,
    commandDigest,
    responseSnapshot: snapshot,
    createdAt: now,
  });
}

function replay(receipt: any, digest: string): Record<string, unknown> {
  if (!receipt || receipt.commandDigest !== digest) fail('LEASE_REPLAY_CONFLICT');
  return receipt.responseSnapshot as Record<string, unknown>;
}

function mapDatabaseError(error: unknown): never {
  if (error instanceof CoordinationTransportLeaseError) throw error;
  const code = (error as { code?: string }).code;
  if (code === '23505') fail('LEASE_CONFLICT');
  if (code === '23514') fail('LEASE_INVALID_REQUEST');
  if (code === '40001' || code === '40P01') fail('LEASE_CONFLICT');
  fail('LEASE_DATABASE_UNAVAILABLE');
}

async function mutateLease(operation: Extract<LeaseOperation, 'acquire' | 'renew' | 'release' | 'expire' | 'takeover'>, input: LeaseInput) {
  validateIdentity(input);
  try {
    return await db.transaction(async (tx) => {
      const now = await databaseNow(tx);
      const { session, host } = await authorizeOperation(tx, input, operation, now, operation === 'expire');
      const enrolledHostId = host.id as string;
      const digest = hash({
        operation, sessionId: input.sessionId, enrolledHostId, actorId: input.actorId,
        holderInstanceId: input.holderInstanceId, epoch: input.epoch ?? null,
        durationMs: input.durationMs ?? input.duration ?? null, leaseId: input.leaseId ?? null,
      });
      const receipt = await priorReceipt(tx, session.id, input.requestKey);
      if (receipt) return replay(receipt, digest);
      let old = await latestLease(tx, session.id);
      if (old && input.leaseId && old.id !== input.leaseId) fail('LEASE_STALE_EPOCH');

      const commandBase = { requestId: input.requestKey, eventId: randomUUID(), now: now.getTime() };
      let resultState: TransportLeaseState;
      if (operation === 'acquire') {
        if (old?.state === 'active') {
          if (old.expiresAt <= now) fail('LEASE_CONFLICT');
          fail('LEASE_CONFLICT');
        }
        if (old && old.state !== 'released') fail('LEASE_CONFLICT');
        const initial = old
          ? ({ ...leaseState(old), state: 'unheld' as const, holderInstanceId: null, issuedAt: null, expiresAt: null, endedAt: null })
          : createTransportLeaseState({ leaseId: randomUUID(), sessionId: session.id, enrolledHostId });
        const result = transitionTransportLease(initial, {
          ...commandBase, type: 'acquire', newLeaseId: randomUUID(), holderInstanceId: input.holderInstanceId,
          duration: commandDuration(input),
        });
        if (!result.ok) fail(result.code === 'lease_holder_conflict' ? 'LEASE_CONFLICT' : 'LEASE_INVALID_REQUEST');
        resultState = result.state;
      } else if (operation === 'takeover') {
        if (!old) fail('LEASE_NOT_FOUND');
        if (old.state === 'active' && old.expiresAt <= now) {
          const expired = transitionTransportLease(leaseState(old), { ...commandBase, type: 'expire' });
          if (!expired.ok) fail('LEASE_EXPIRED');
          await tx.update(coordinationV2TransportLeases).set({
            state: expired.state.state,
            expiresAt: new Date(expired.state.expiresAt!),
            endedAt: expired.state.endedAt === null ? null : new Date(expired.state.endedAt),
          }).where(eq(coordinationV2TransportLeases.id, old.id));
          old = {
            ...old,
            state: expired.state.state,
            expiresAt: new Date(expired.state.expiresAt!),
            endedAt: expired.state.endedAt === null ? null : new Date(expired.state.endedAt),
          };
        } else if (old.state !== 'expired') {
          fail(old.state === 'active' ? 'LEASE_CONFLICT' : 'LEASE_STALE_EPOCH');
        } else {
        }
        const result = transitionTransportLease(leaseState(old), {
          ...commandBase, type: 'takeover', newLeaseId: randomUUID(), holderInstanceId: input.holderInstanceId,
          duration: commandDuration(input),
        });
        if (!result.ok) fail(result.code === 'lease_holder_conflict' ? 'LEASE_CONFLICT' : 'LEASE_INVALID_REQUEST');
        resultState = result.state;
      } else {
        if (!old) fail('LEASE_NOT_FOUND');
        if (old.state !== 'active') fail(old.state === 'expired' ? 'LEASE_EXPIRED' : 'LEASE_STALE_EPOCH');
        if (operation !== 'expire' && old.expiresAt <= now) fail('LEASE_EXPIRED');
        if (input.epoch === undefined) fail('LEASE_INVALID_REQUEST', { field: 'epoch' });
        const result = transitionTransportLease(leaseState(old), {
          ...commandBase,
          type: operation,
          holderInstanceId: input.holderInstanceId,
          epoch: positiveEpoch(input.epoch),
          ...(operation === 'renew' ? { duration: commandDuration(input) } : {}),
        } as any);
        if (!result.ok) {
          if (result.code === 'lease_epoch_stale') fail('LEASE_STALE_EPOCH');
          if (result.code === 'lease_expired') fail('LEASE_EXPIRED');
          if (result.code === 'lease_holder_conflict') fail('LEASE_HOLDER_MISMATCH');
          fail('LEASE_CONFLICT');
        }
        resultState = result.state;
        const updated = await tx.update(coordinationV2TransportLeases).set({
          state: result.state.state,
          expiresAt: new Date(result.state.expiresAt!),
          endedAt: result.state.endedAt === null ? null : new Date(result.state.endedAt),
        }).where(eq(coordinationV2TransportLeases.id, old.id)).returning();
        const snapshot = dto(updated[0]);
        await saveReceipt(tx, { sessionId: session.id, requestKey: input.requestKey, operation }, digest, snapshot, now, input.actorId, enrolledHostId);
        return snapshot;
      }

      const inserted = await tx.insert(coordinationV2TransportLeases).values({
        id: resultState.leaseId,
        sessionId: session.id,
        enrolledHostId,
        holderInstanceId: resultState.holderInstanceId!,
        epoch: resultState.epoch,
        predecessorLeaseId: resultState.predecessorLeaseId,
        state: 'active',
        issuedAt: now,
        expiresAt: new Date(resultState.expiresAt!),
        createdAt: now,
      }).returning();
      const snapshot = dto(inserted[0]);
      await saveReceipt(tx, { sessionId: session.id, requestKey: input.requestKey, operation }, digest, snapshot, now, input.actorId, enrolledHostId);
      return snapshot;
    });
  } catch (error) {
    return mapDatabaseError(error);
  }
}

export const acquireCoordinationTransportLease = (input: LeaseInput) => mutateLease('acquire', input);
export const renewCoordinationTransportLease = (input: LeaseInput) => mutateLease('renew', input);
export const releaseCoordinationTransportLease = (input: LeaseInput) => mutateLease('release', input);
export const expireCoordinationTransportLease = (input: LeaseInput) => mutateLease('expire', input);
export const takeoverCoordinationTransportLease = (input: LeaseInput) => mutateLease('takeover', input);
export const acquireTransportLease = acquireCoordinationTransportLease;
export const renewTransportLease = renewCoordinationTransportLease;
export const releaseTransportLease = releaseCoordinationTransportLease;
export const expireTransportLease = expireCoordinationTransportLease;
export const takeoverTransportLease = takeoverCoordinationTransportLease;

export type LeaseFenceInput = LeaseInput & {
  operation: Extract<LeaseOperation, 'poll' | 'claim' | 'result' | 'ack' | 'cleanup'>;
  command?: unknown;
};

/**
 * Low-level fence retained for callers that already own a canonical evidence
 * transaction. Public host routes use the operation-specific services below;
 * this helper is intentionally not an operation acknowledgement.
 */
export async function validateCurrentCoordinationTransportLease(input: LeaseFenceInput) {
  validateIdentity(input);
  if (input.epoch === undefined) fail('LEASE_INVALID_REQUEST', { field: 'epoch' });
  const epoch = positiveEpoch(input.epoch);
  try {
    return await db.transaction(async (tx) => {
      const now = await databaseNow(tx);
      const { session, host } = await authorizeOperation(tx, input, input.operation, now);
      const enrolledHostId = host.id as string;
      const commandDigest = hash({
        operation: input.operation, sessionId: input.sessionId, enrolledHostId, actorId: input.actorId,
        holderInstanceId: input.holderInstanceId, command: input.command ?? null,
        epoch, leaseId: input.leaseId ?? null,
      });
      const receipt = await priorReceipt(tx, session.id, input.requestKey);
      if (receipt) return replay(receipt, commandDigest);
      const lease = await currentLease(tx, session.id);
      if (!lease) fail('LEASE_EXPIRED');
      if (lease.enrolledHostId !== enrolledHostId || lease.epoch !== epoch) fail('LEASE_STALE_EPOCH');
      if (lease.holderInstanceId !== input.holderInstanceId) fail('LEASE_HOLDER_MISMATCH');
      if (input.leaseId && input.leaseId !== lease.id) fail('LEASE_STALE_EPOCH');
      if (lease.expiresAt <= now) fail('LEASE_EXPIRED');
      const snapshot = {
        accepted: true, operation: input.operation, sessionId: session.id,
         leaseId: lease.id, enrolledHostId,
        holderInstanceId: lease.holderInstanceId, epoch: lease.epoch,
      };
      await saveReceipt(tx, { sessionId: session.id, requestKey: input.requestKey, operation: input.operation }, commandDigest, snapshot, now, input.actorId, enrolledHostId);
      return snapshot;
    });
  } catch (error) {
    return mapDatabaseError(error);
  }
}

export const fenceCoordinationHostOperation = validateCurrentCoordinationTransportLease;
export const validateCurrentLeaseEpoch = validateCurrentCoordinationTransportLease;

function attemptState(row: CoordinationV2Attempt): AttemptState {
  return {
    attemptId: row.id,
    sessionId: row.sessionId,
    provider: row.provider,
    model: row.model,
    adapterVersion: row.adapterVersion,
    ordinal: row.sessionOrdinal,
    providerOrdinal: row.providerOrdinal,
    createdAt: row.createdAt.getTime(),
    deadline: row.deadlineAt.getTime(),
    failureClassification: row.failureClassification as AttemptState['failureClassification'],
    state: row.state as AttemptState['state'],
    terminalAt: row.terminalAt?.getTime() ?? null,
    resultCode: row.resultCode,
  } as AttemptState;
}

function cleanupState(row: CoordinationV2CleanupObligation): CleanupState {
  return {
    sessionId: row.sessionId,
    terminalOutcome: row.terminalOutcome as CleanupState['terminalOutcome'],
    terminalReason: row.terminalReason,
    requestedAt: row.requestedAt.getTime(),
    acknowledgedAt: row.completedAt?.getTime() ?? null,
    lastFailureCode: row.lastErrorCode,
    status: row.state as CleanupState['status'],
  } as CleanupState;
}

async function openAttempt(tx: any, sessionId: string): Promise<CoordinationV2Attempt | undefined> {
  const rows = await tx.select().from(coordinationV2Attempts)
    .where(and(eq(coordinationV2Attempts.sessionId, sessionId),
      sql`${coordinationV2Attempts.state} NOT IN ('completed', 'retryable_failed', 'terminal_failed', 'cancelled')`))
    .orderBy(desc(coordinationV2Attempts.sessionOrdinal)).limit(1).for('update');
  return rows[0] as CoordinationV2Attempt | undefined;
}

function operationDigest(input: LeaseInput, operation: LeaseOperation, hostId: string): string {
  return hash({
    operation, sessionId: input.sessionId, actorId: input.actorId, enrolledHostId: hostId,
    holderInstanceId: input.holderInstanceId, epoch: input.epoch ?? null, leaseId: input.leaseId ?? null,
    attemptId: input.attemptId ?? null, claimId: input.claimId ?? null,
    obligationId: input.obligationId ?? null, result: input.result ?? null, evidence: input.evidence ?? null,
    command: input.command ?? null,
  });
}

function boundedObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Buffer.byteLength(JSON.stringify(value), 'utf8') > 32768) {
    fail('LEASE_INVALID_REQUEST', { field });
  }
  return value as Record<string, unknown>;
}

async function fencedOperation(
  operation: Extract<LeaseOperation, 'poll' | 'claim' | 'result'>,
  input: LeaseInput,
  work: (context: {
    tx: any; now: Date; session: CoordinationV2Session; hostId: string;
    lease: CoordinationV2TransportLease; digest: string;
  }) => Promise<Record<string, unknown>>,
) {
  validateIdentity(input);
  if (input.epoch === undefined) fail('LEASE_INVALID_REQUEST', { field: 'epoch' });
  const epoch = positiveEpoch(input.epoch);
  return db.transaction(async (tx) => {
    const now = await databaseNow(tx);
    const { session, host } = await authorizeOperation(tx, input, operation, now);
    const hostId = host.id as string;
    const digest = operationDigest(input, operation, hostId);
    const receipt = await priorReceipt(tx, session.id, input.requestKey);
    if (receipt) return replay(receipt, digest);
    const lease = await currentLease(tx, session.id);
    if (!lease) fail('LEASE_EXPIRED');
    if (lease.enrolledHostId !== hostId || lease.epoch !== epoch) fail('LEASE_STALE_EPOCH');
    if (lease.holderInstanceId !== input.holderInstanceId) fail('LEASE_HOLDER_MISMATCH');
    if (input.leaseId && input.leaseId !== lease.id) fail('LEASE_STALE_EPOCH');
    if (lease.expiresAt <= now) fail('LEASE_EXPIRED');
    return work({ tx, now, session, hostId, lease, digest });
  });
}

export async function pollCoordinationTransportWork(input: LeaseInput) {
  try {
    return await fencedOperation('poll', input, async (context) => {
      const attempt = await openAttempt(context.tx, context.session.id);
      const snapshot = {
        operation: 'poll', sessionId: context.session.id, leaseId: context.lease.id,
        epoch: context.lease.epoch, attempt: attempt ? {
          id: attempt.id, packetId: attempt.packetId, state: attempt.state,
          provider: attempt.provider, model: attempt.model, deadlineAt: attempt.deadlineAt.toISOString(),
        } : null,
      };
      await saveReceipt(context.tx, {
        sessionId: context.session.id, requestKey: input.requestKey, operation: 'poll',
      }, context.digest, snapshot, context.now, input.actorId, context.hostId);
      return snapshot;
    });
  } catch (error) { return mapDatabaseError(error); }
}

export async function claimCoordinationTransportWork(input: LeaseInput) {
  try {
    return await fencedOperation('claim', input, async (context) => {
      const attempt = await openAttempt(context.tx, context.session.id);
      if (!attempt) fail('LEASE_NOT_FOUND');
      if (input.attemptId && input.attemptId !== attempt.id) fail('LEASE_CONFLICT');
      const transition = transitionAttempt(attemptState(attempt), {
        type: 'host_started', requestId: input.requestKey, eventId: randomUUID(), now: context.now.getTime(),
      });
      if (!transition.ok) fail('LEASE_CONFLICT');
      const inserted = await context.tx.insert(coordinationV2TransportWorkClaims).values({
        id: randomUUID(), sessionId: context.session.id, attemptId: attempt.id,
        leaseId: context.lease.id, enrolledHostId: context.hostId, holderInstanceId: input.holderInstanceId,
        epoch: context.lease.epoch, requestKey: input.requestKey, commandDigest: context.digest,
        state: 'active', createdAt: context.now,
      }).returning();
      await context.tx.update(coordinationV2Attempts).set({
        state: transition.state.state, updatedAt: context.now,
      }).where(eq(coordinationV2Attempts.id, attempt.id));
      const eventRows = await context.tx.select().from(coordinationV2AttemptEvents)
        .where(eq(coordinationV2AttemptEvents.attemptId, attempt.id))
        .orderBy(desc(coordinationV2AttemptEvents.sequence)).limit(1);
      await context.tx.insert(coordinationV2AttemptEvents).values({
        id: randomUUID(), attemptId: attempt.id, sequence: (eventRows[0]?.sequence ?? 0) + 1,
        fromState: attempt.state, toState: transition.state.state, eventType: transition.event.kind,
        actorType: 'host', actorId: input.actorId, requestKey: input.requestKey,
        metadata: { leaseId: context.lease.id, epoch: context.lease.epoch }, createdAt: context.now,
      });
      const snapshot = { operation: 'claim', sessionId: context.session.id, leaseId: context.lease.id,
        epoch: context.lease.epoch, claimId: inserted[0].id, attemptId: attempt.id, state: transition.state.state };
      await saveReceipt(context.tx, { sessionId: context.session.id, requestKey: input.requestKey, operation: 'claim' },
        context.digest, snapshot, context.now, input.actorId, context.hostId);
      return snapshot;
    });
  } catch (error) { return mapDatabaseError(error); }
}

export async function resultCoordinationTransportWork(input: LeaseInput) {
  try {
    return await fencedOperation('result', input, async (context) => {
      const result = boundedObject(input.result, 'result');
      const claimRows = await context.tx.select().from(coordinationV2TransportWorkClaims)
        .where(and(eq(coordinationV2TransportWorkClaims.sessionId, context.session.id),
          eq(coordinationV2TransportWorkClaims.state, 'active'),
          ...(input.claimId ? [eq(coordinationV2TransportWorkClaims.id, input.claimId)] : [])))
        .orderBy(desc(coordinationV2TransportWorkClaims.createdAt)).limit(1).for('update');
      const claim = claimRows[0];
      if (!claim || claim.leaseId !== context.lease.id || claim.epoch !== context.lease.epoch) fail('LEASE_STALE_EPOCH');
      const attemptRows = await context.tx.select().from(coordinationV2Attempts)
        .where(eq(coordinationV2Attempts.id, claim.attemptId)).for('update');
      const attempt = attemptRows[0] as CoordinationV2Attempt | undefined;
      if (!attempt) fail('LEASE_NOT_FOUND');
      const transition = transitionAttempt(attemptState(attempt), {
        type: 'result_ready', requestId: input.requestKey, eventId: randomUUID(), now: context.now.getTime(),
      });
      if (!transition.ok) fail('LEASE_CONFLICT');
      const resultDigest = hash(result);
      const inserted = await context.tx.insert(coordinationV2TransportWorkResults).values({
        id: randomUUID(), sessionId: context.session.id, attemptId: attempt.id, claimId: claim.id,
        leaseId: context.lease.id, enrolledHostId: context.hostId, holderInstanceId: input.holderInstanceId,
        epoch: context.lease.epoch, requestKey: input.requestKey, resultDigest, result, createdAt: context.now,
      }).returning();
      await context.tx.update(coordinationV2Attempts).set({
        state: transition.state.state,
        failureClassification: transition.state.failureClassification,
        resultCode: transition.state.resultCode,
        terminalAt: transition.state.terminalAt === null ? null : new Date(transition.state.terminalAt),
        updatedAt: context.now,
      }).where(eq(coordinationV2Attempts.id, attempt.id));
      await context.tx.update(coordinationV2TransportWorkClaims).set({
        state: 'completed', terminalAt: context.now,
      }).where(eq(coordinationV2TransportWorkClaims.id, claim.id));
      const eventRows = await context.tx.select().from(coordinationV2AttemptEvents)
        .where(eq(coordinationV2AttemptEvents.attemptId, attempt.id))
        .orderBy(desc(coordinationV2AttemptEvents.sequence)).limit(1);
      await context.tx.insert(coordinationV2AttemptEvents).values({
        id: randomUUID(), attemptId: attempt.id, sequence: (eventRows[0]?.sequence ?? 0) + 1,
        fromState: attempt.state, toState: transition.state.state, eventType: transition.event.kind,
        actorType: 'host', actorId: input.actorId,
        failureClassification: transition.state.failureClassification,
        resultCode: transition.event.resultCode ?? transition.state.resultCode,
        evidenceRef: inserted[0].id, requestKey: input.requestKey,
        metadata: { leaseId: context.lease.id, epoch: context.lease.epoch, commandDigest: context.digest },
        createdAt: context.now,
      });
      const snapshot = { operation: 'result', sessionId: context.session.id, leaseId: context.lease.id,
        epoch: context.lease.epoch, resultId: inserted[0].id, claimId: claim.id, attemptId: attempt.id,
        resultDigest, state: transition.state.state };
      await saveReceipt(context.tx, { sessionId: context.session.id, requestKey: input.requestKey, operation: 'result' },
        context.digest, snapshot, context.now, input.actorId, context.hostId);
      return snapshot;
    });
  } catch (error) { return mapDatabaseError(error); }
}

export async function acknowledgeCoordinationCleanup(input: LeaseInput) {
  try {
    return await db.transaction(async (tx) => {
      if (input.epoch === undefined || !input.obligationId) fail('LEASE_INVALID_REQUEST');
      const now = await databaseNow(tx);
      const { session, host } = await authorizeOperation(tx, input, 'ack', now);
      const hostId = host.id as string;
      const digest = operationDigest(input, 'ack', hostId);
      const canonicalRows = await tx.select().from(coordinationV2CleanupAcknowledgements)
        .where(and(
          eq(coordinationV2CleanupAcknowledgements.obligationId, input.obligationId),
          eq(coordinationV2CleanupAcknowledgements.acknowledgementKey, input.requestKey),
        )).for('update');
      if (canonicalRows[0]) {
        const canonical = canonicalRows[0];
        const snapshot = canonical.responseSnapshot as Record<string, unknown>;
        if (canonical.commandDigest !== digest
          || canonical.sessionId !== session.id
          || canonical.obligationId !== input.obligationId
          || canonical.actorId !== input.actorId
          || canonical.enrolledHostId !== hostId
          || canonical.holderInstanceId !== input.holderInstanceId
          || canonical.transportLeaseId !== input.leaseId
          || canonical.transportLeaseEpoch !== positiveEpoch(input.epoch)
          || snapshot.operation !== 'ack'
          || snapshot.obligationId !== input.obligationId || snapshot.sessionId !== session.id) {
          fail('LEASE_REPLAY_CONFLICT');
        }
        return snapshot;
      }
      const receipt = await priorReceipt(tx, session.id, input.requestKey);
      if (receipt) return replay(receipt, digest);
      const lease = await currentLease(tx, session.id);
      if (!lease || lease.expiresAt <= now) fail('LEASE_EXPIRED');
      if (lease.epoch !== positiveEpoch(input.epoch) || lease.holderInstanceId !== input.holderInstanceId
        || lease.enrolledHostId !== hostId || (input.leaseId !== undefined && input.leaseId !== lease.id)) {
        fail('LEASE_STALE_EPOCH');
      }
      const obligations = await tx.select().from(coordinationV2CleanupObligations)
        .where(and(eq(coordinationV2CleanupObligations.id, input.obligationId), eq(coordinationV2CleanupObligations.sessionId, session.id)))
        .for('update');
      const obligation = obligations[0] as CoordinationV2CleanupObligation | undefined;
      if (!obligation) fail('LEASE_NOT_FOUND');
      const evidence = boundedObject(input.evidence ?? input.result, 'evidence');
      const transition = transitionCleanup(cleanupState(obligation), {
        type: 'acknowledge', requestId: input.requestKey, eventId: randomUUID(), now: now.getTime(),
      });
      if (!transition.ok) fail('LEASE_CONFLICT');
      const evidenceDigest = hash(evidence);
      const snapshot = {
        operation: 'ack', sessionId: session.id, leaseId: lease.id, epoch: lease.epoch,
        obligationId: obligation.id, outcome: 'acknowledged', evidenceDigest,
        actorId: input.actorId, enrolledHostId: hostId, holderInstanceId: input.holderInstanceId,
      };
      const insertedAck = await tx.insert(coordinationV2CleanupAcknowledgements).values({
        id: randomUUID(), obligationId: obligation.id, sessionId: session.id, enrolledHostId: hostId,
        actorId: input.actorId, holderInstanceId: input.holderInstanceId,
        transportLeaseId: lease.id, transportLeaseEpoch: lease.epoch,
        acknowledgementKey: input.requestKey, commandDigest: digest, responseSnapshot: snapshot,
        outcome: 'acknowledged', evidenceDigest, safeMessage: null, errorCode: null, createdAt: now,
      }).onConflictDoNothing({
        target: [coordinationV2CleanupAcknowledgements.obligationId, coordinationV2CleanupAcknowledgements.acknowledgementKey],
      }).returning();
      if (insertedAck.length === 0) {
        const raced = await tx.select().from(coordinationV2CleanupAcknowledgements)
          .where(and(eq(coordinationV2CleanupAcknowledgements.obligationId, obligation.id),
            eq(coordinationV2CleanupAcknowledgements.acknowledgementKey, input.requestKey))).for('update');
        if (!raced[0]
          || raced[0].commandDigest !== digest
          || raced[0].sessionId !== session.id
          || raced[0].obligationId !== obligation.id
          || raced[0].actorId !== input.actorId
          || raced[0].enrolledHostId !== hostId
          || raced[0].holderInstanceId !== input.holderInstanceId
          || raced[0].transportLeaseId !== input.leaseId
          || raced[0].transportLeaseEpoch !== positiveEpoch(input.epoch)) {
          fail('LEASE_REPLAY_CONFLICT');
        }
        return raced[0].responseSnapshot as Record<string, unknown>;
      }
      await tx.update(coordinationV2CleanupObligations).set({
        state: transition.state.status, completedAt: now, updatedAt: now,
      }).where(eq(coordinationV2CleanupObligations.id, obligation.id));
      await saveReceipt(tx, { sessionId: session.id, requestKey: input.requestKey, operation: 'ack' },
        digest, snapshot, now, input.actorId, hostId);
      return snapshot;
    });
  } catch (error) { return mapDatabaseError(error); }
}

export const cleanupCoordinationTransportWork = acknowledgeCoordinationCleanup;

export async function submitStaleCoordinationLeaseReconciliation(input: LeaseInput & {
  evidence: Record<string, unknown>;
}) {
  validateIdentity(input);
  const epoch = positiveEpoch(input.epoch);
  if (!input.evidence || typeof input.evidence !== 'object' || Array.isArray(input.evidence)
    || Buffer.byteLength(JSON.stringify(input.evidence), 'utf8') > 8192) {
    fail('LEASE_INVALID_REQUEST', { field: 'evidence' });
  }
  const evidenceDigest = hash(input.evidence);
  try {
    return await db.transaction(async (tx) => {
      const now = await databaseNow(tx);
      const { session, host } = await authorizeOperation(tx, input, 'poll', now, true);
      const hostId = host.id as string;
      const commandDigest = hash({ actorId: input.actorId, enrolledHostId: hostId, holderInstanceId: input.holderInstanceId, epoch, evidenceDigest });
      const latest = await latestLease(tx, session.id);
      if (!latest || (latest.state === 'active' && latest.epoch === epoch && latest.holderInstanceId === input.holderInstanceId
        && latest.enrolledHostId === hostId && latest.expiresAt > now)) {
        fail('LEASE_CONFLICT');
      }
      if (latest && epoch >= latest.epoch) fail('LEASE_STALE_EPOCH');
      const prior = await tx.select().from(coordinationV2TransportLeaseReconciliations).where(and(
        eq(coordinationV2TransportLeaseReconciliations.sessionId, session.id),
        eq(coordinationV2TransportLeaseReconciliations.requestKey, input.requestKey),
      )).for('update');
      if (prior[0]) {
        if (prior[0].evidenceDigest !== evidenceDigest
          || prior[0].enrolledHostId !== hostId
          || prior[0].holderInstanceId !== input.holderInstanceId
          || prior[0].epoch !== epoch) fail('LEASE_REPLAY_CONFLICT');
        return { id: prior[0].id, sessionId: session.id, epoch: prior[0].epoch, evidenceDigest, stored: true };
      }
      const countRows = await tx.select({ id: coordinationV2TransportLeaseReconciliations.id })
        .from(coordinationV2TransportLeaseReconciliations)
        .where(eq(coordinationV2TransportLeaseReconciliations.sessionId, session.id));
      if (countRows.length >= 32) fail('LEASE_RECONCILIATION_LIMIT');
      const inserted = await tx.insert(coordinationV2TransportLeaseReconciliations).values({
        id: randomUUID(), sessionId: session.id, leaseId: latest.id,
        enrolledHostId: hostId, holderInstanceId: input.holderInstanceId,
        epoch, requestKey: input.requestKey, evidenceDigest, evidence: input.evidence, createdAt: now,
      }).returning();
      // A reconciliation row is evidence only. No session, lease, attempt, or
      // runtime authority row is changed here.
      return { id: inserted[0].id, sessionId: session.id, epoch, evidenceDigest, stored: true };
    });
  } catch (error) {
    return mapDatabaseError(error);
  }
}

export const submitStaleHolderReconciliation = submitStaleCoordinationLeaseReconciliation;