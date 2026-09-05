import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  contextLineageEvents,
  coordinationActorFeedCursors,
  coordinationAdapterDeliveries,
  coordinationEvents,
  coordinationThreads,
  sofiaIssueReports,
  studentSessionHealth,
  voicePipelineEvents,
  voiceSessions,
  type CoordinationActorId,
  type CoordinationEvent,
} from '@shared/schema';
import {
  OBSERVATION_BENCH_ACTORS,
  type ObservationBenchActor,
  type ObservationBenchPillStatus,
} from '@shared/observation-bench-types';
import { getSharedDb } from '../db';
import { isFounder } from '../middleware/rbac';
import {
  appendCoordinationEvent,
  CoordinationError,
  createCoordinationThread,
  getCoordinationThread,
} from './coordination-ledger-service';

export { OBSERVATION_BENCH_ACTORS };
export type { ObservationBenchActor, ObservationBenchPillStatus };
export const OBSERVATION_CATEGORIES = ['noticed', 'missed', 'cross_hat_improvement'] as const;
export type ObservationCategory = typeof OBSERVATION_CATEGORIES[number];

const BENCH_KIND = 'dual_luca_observation_bench';
const ARM_KIND = 'dual_luca_observation_arm';
const SOURCE_KIND = 'observation_source';
const OBSERVATION_KIND = 'bench_observation';
const INVITATION_KIND = 'observation_invitation';

type SourceEnvelope = {
  kind: typeof SOURCE_KIND;
  sourceType: 'voice_pipeline' | 'context_lineage' | 'sofia_issue_report' | 'student_session_health';
  sourceId: string;
  conversationId: string;
  sessionId: string | null;
  sourceTimestamp: string;
  capturedAt: string;
  sha256: string;
  role?: string;
  sourceRoute?: string;
  eventType?: string;
  deliveryChannel?: string | null;
  deliveryStatus?: string;
  captureRequestedBy?: CoordinationActorId;
};

const FOUNDER_USER_ID = process.env.FOUNDER_USER_ID || '49847136';

export type ObservationScope = {
  userId: string;
  sessionId: string;
  conversationId: string;
};

function scopeFields(value: unknown): Partial<ObservationScope> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const object = value as Record<string, unknown>;
  const hasScope = ['userId', 'sessionId', 'conversationId'].some(key => key in object);
  if (!hasScope) return null;
  return {
    ...(typeof object.userId === 'string' ? { userId: object.userId } : {}),
    ...(typeof object.sessionId === 'string' ? { sessionId: object.sessionId } : {}),
    ...(typeof object.conversationId === 'string' ? { conversationId: object.conversationId } : {}),
  };
}

function collectScopeFields(value: unknown): Partial<ObservationScope>[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(item => collectScopeFields(item));
  const direct = scopeFields(value);
  const nested = Object.values(value as Record<string, unknown>)
    .flatMap(item => collectScopeFields(item));
  return direct ? [direct, ...nested] : nested;
}

export function observationObjectScopeMatches(
  value: unknown,
  expected: ObservationScope,
): boolean {
  const scopes = collectScopeFields(value);
  return scopes.length > 0 && scopes.every(scope => (
    (scope.userId === undefined || scope.userId === expected.userId)
    && scope.sessionId === expected.sessionId
    && scope.conversationId === expected.conversationId
  ));
}

export function sofiaReportScopeMatches(
  report: { userId: string; diagnosticSnapshot: unknown; clientTelemetry: unknown },
  expected: ObservationScope,
): boolean {
  if (report.userId !== expected.userId) return false;
  const scopes = [report.diagnosticSnapshot, report.clientTelemetry]
    .flatMap(value => collectScopeFields(value));
  return scopes.length > 0 && scopes.every(scope => (
    (scope.userId === undefined || scope.userId === expected.userId)
    && scope.sessionId === expected.sessionId
    && scope.conversationId === expected.conversationId
  ));
}

type PresenceEvent = Pick<CoordinationEvent, 'actor' | 'sequence' | 'createdAt' | 'payload'>;

export function deriveObservationBenchPillStatus(input: {
  conversationId: string;
  sessionId: string;
  threadId: string | null;
  events: PresenceEvent[];
  ended: boolean;
  nowMs: number;
}): ObservationBenchPillStatus {
  const latestSequence = input.events.at(-1)?.sequence ?? 0;
  const evidenceTimes = input.events
    .filter(event => payloadOf(event as CoordinationEvent).kind === SOURCE_KIND)
    .map(event => payloadOf(event as CoordinationEvent).sourceTimestamp)
    .filter((value): value is string => typeof value === 'string')
    .sort();
  return {
    identity: 'one_luca_multiple_hats',
    conversationId: input.conversationId,
    sessionId: input.sessionId,
    threadId: input.threadId,
    windowState: input.threadId ? (input.ended ? 'ended' : 'active') : 'not_armed',
    expectedActors: OBSERVATION_BENCH_ACTORS,
    hats: Object.fromEntries(OBSERVATION_BENCH_ACTORS.map(actor => {
      const event = [...input.events].reverse().find(candidate => candidate.actor === actor);
      if (!event) return [actor, {
        connection: 'never_connected',
        cursor: 0,
        caughtUp: latestSequence === 0,
        replayPending: latestSequence > 0,
        lastEventAt: null,
      }];
      const ageMs = input.nowMs - event.createdAt.getTime();
      const connection = input.ended ? 'disconnected'
        : ageMs <= 60_000 ? 'connected'
          : ageMs <= 300_000 ? 'degraded' : 'disconnected';
      return [actor, {
        connection,
        cursor: event.sequence,
        caughtUp: event.sequence === latestSequence,
        replayPending: event.sequence < latestSequence,
        lastEventAt: event.createdAt.toISOString(),
      }];
    })) as ObservationBenchPillStatus['hats'],
    lastEvidenceAt: evidenceTimes.at(-1) ?? null,
  };
}

export function closeConflictIsAlreadyEnded(events: PresenceEvent[]): boolean {
  return events.some(event => payloadOf(event as CoordinationEvent).kind === 'observation_window_ended');
}

export function selectExactSessionBenchWinner<T extends {
  thread: { id: string };
  created: PresenceEvent;
}>(rows: T[], sessionId: string): T | null {
  return rows.find(({ created }) => {
    const payload = created.payload && typeof created.payload === 'object'
      ? created.payload as Record<string, unknown>
      : {};
    return payload.kind === BENCH_KIND && payload.sessionId === sessionId;
  }) ?? null;
}

async function requireActiveFounderSession(sessionId: string) {
  const [session] = await getSharedDb().select({
    id: voiceSessions.id,
    conversationId: voiceSessions.conversationId,
    userId: voiceSessions.userId,
    status: voiceSessions.status,
  }).from(voiceSessions).where(eq(voiceSessions.id, sessionId)).limit(1);
  if (!session || !session.conversationId || session.status !== 'active') {
    throw new CoordinationError('An already-active founder voice session is required', 409, 'voice_session_not_active');
  }
  if (!isFounder({ id: session.userId } as Parameters<typeof isFounder>[0])) {
    throw new CoordinationError('Student voice sessions cannot be observed', 403, 'founder_session_required');
  }
  return { ...session, conversationId: session.conversationId };
}

function assertBenchActor(actor: CoordinationActorId): asserts actor is ObservationBenchActor {
  if (!OBSERVATION_BENCH_ACTORS.includes(actor as ObservationBenchActor)) {
    throw new CoordinationError('Observation benches require a Luca hat credential', 403, 'bench_actor_required');
  }
}

function otherHat(actor: ObservationBenchActor): ObservationBenchActor {
  return actor === 'luca-replit' ? 'luca-claude-code' : 'luca-replit';
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function observationSignature(input: {
  actor: ObservationBenchActor;
  category: ObservationCategory;
  content: string;
  sourceEventIds: string[];
  improvesObservationEventIds: string[];
}): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new CoordinationError('Observation signing is not configured', 503, 'observation_signing_unavailable');
  }
  return createHmac('sha256', secret).update(JSON.stringify(input)).digest('hex');
}

function signatureMatches(expected: string, supplied: unknown): boolean {
  if (typeof supplied !== 'string') return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function sourceSignature(input: Omit<SourceEnvelope, 'kind' | 'capturedAt'>): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new CoordinationError('Observation signing is not configured', 503, 'observation_signing_unavailable');
  }
  return createHmac('sha256', secret).update(JSON.stringify(input)).digest('hex');
}

function payloadOf(event: CoordinationEvent): Record<string, unknown> {
  return event.payload && typeof event.payload === 'object'
    ? event.payload as Record<string, unknown>
    : {};
}

function assertBenchThread(events: CoordinationEvent[]): {
  conversationId: string;
  sessionId: string | null;
} {
  const created = events[0];
  const payload = created ? payloadOf(created) : {};
  if (payload.kind !== BENCH_KIND || typeof payload.conversationId !== 'string') {
    throw new CoordinationError('Coordination thread is not an observation bench', 400, 'not_observation_bench');
  }
  return {
    conversationId: payload.conversationId,
    sessionId: typeof payload.sessionId === 'string' ? payload.sessionId : null,
  };
}

function assertObservationWindowActive(events: CoordinationEvent[]): void {
  if (events.some(event => payloadOf(event).kind === 'observation_window_ended')) {
    throw new CoordinationError('Observation window has ended', 409, 'observation_window_ended');
  }
}

function assertValidSourceEvent(
  event: CoordinationEvent,
  bench: { conversationId: string; sessionId: string | null },
): void {
  const payload = payloadOf(event);
  const signatureInput = {
    sourceType: payload.sourceType,
    sourceId: payload.sourceId,
    conversationId: payload.conversationId,
    sessionId: payload.sessionId,
    sourceTimestamp: payload.sourceTimestamp,
    sha256: payload.sha256,
    ...(payload.sourceRoute !== undefined ? { sourceRoute: payload.sourceRoute } : {}),
    ...(payload.eventType !== undefined ? { eventType: payload.eventType } : {}),
    ...(payload.deliveryChannel !== undefined ? { deliveryChannel: payload.deliveryChannel } : {}),
    ...(payload.deliveryStatus !== undefined ? { deliveryStatus: payload.deliveryStatus } : {}),
    ...(payload.captureRequestedBy !== undefined ? { captureRequestedBy: payload.captureRequestedBy } : {}),
  } as Omit<SourceEnvelope, 'kind' | 'capturedAt'>;
  if (
    payload.kind !== SOURCE_KIND
    || payload.conversationId !== bench.conversationId
    || payload.sessionId !== bench.sessionId
    || !signatureMatches(sourceSignature(signatureInput), payload.serverSignature)
  ) {
    throw new CoordinationError('Source envelope provenance is invalid', 403, 'invalid_source_provenance');
  }
}

export async function createObservationBenchArm(input: { idempotencyKey: string }) {
  return createCoordinationThread({
    actor: 'david',
    intendedRecipient: 'luca-replit',
    title: 'Both Luca observation hats armed',
    description: 'Durable founder authorization to bind both Luca observation hats to the next selected Daniela session.',
    content: 'David armed Luca [Replit] and Luca [Claude Code] before the observation session.',
    payload: {
      kind: ARM_KIND,
      armedHats: {
        'luca-replit': 'armed',
        'luca-claude-code': 'armed',
      },
      requestedBy: 'david',
      danielaContextState: 'not_injected',
    },
    createInboxDelivery: false,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function listObservationBenchArms() {
  const events = await getSharedDb().select()
    .from(coordinationEvents)
    .orderBy(desc(coordinationEvents.createdAt));
  const armEvents = events.filter(event => event.sequence === 1 && payloadOf(event).kind === ARM_KIND);
  const boundThreadIds = new Set(
    events
      .filter(event => payloadOf(event).kind === 'observation_arm_bound')
      .map(event => event.threadId),
  );
  return {
    arms: armEvents
      .filter(event => !boundThreadIds.has(event.threadId))
      .map(event => ({
        threadId: event.threadId,
        armedAt: event.createdAt,
        armedHats: payloadOf(event).armedHats,
      })),
  };
}

async function findObservationBenchBySessionId(sessionId: string) {
  const rows = await getSharedDb().select({
    thread: coordinationThreads,
    created: coordinationEvents,
  }).from(coordinationThreads).innerJoin(coordinationEvents, and(
    eq(coordinationEvents.threadId, coordinationThreads.id),
    eq(coordinationEvents.sequence, 1),
  )).orderBy(desc(coordinationThreads.createdAt));
  return rows.find(({ created }) => {
    const payload = payloadOf(created);
    return payload.kind === BENCH_KIND && payload.sessionId === sessionId;
  }) ?? null;
}

export async function discoverObservationBenchBySessionId(input: {
  sessionId: string;
  actor: CoordinationActorId;
}) {
  assertBenchActor(input.actor);
  const sessionId = input.sessionId?.trim();
  if (!sessionId) throw new CoordinationError('Exact sessionId is required', 400, 'invalid_request');
  const session = await requireActiveFounderSession(sessionId);
  const bench = await findObservationBenchBySessionId(sessionId);
  const benchView = bench ? await getCoordinationThread(bench.thread.id, input.actor) : null;
  return {
    session: {
      id: session.id,
      conversationId: session.conversationId,
      status: session.status,
    },
    threadId: bench?.thread.id ?? null,
    windowState: bench
      ? ['completed', 'outcome_acknowledged'].includes(bench.thread.state)
        || benchView?.events.some(event => payloadOf(event).kind === 'observation_window_ended')
        ? 'ended' : 'active'
      : 'not_armed',
  };
}

async function openExactSessionObservationBench(input: {
  sessionId: string;
  actor: ObservationBenchActor | 'david';
  idempotencyKey: string;
  _afterSessionLockForTest?: () => Promise<void>;
}) {
  const sessionId = input.sessionId?.trim();
  if (!sessionId || !input.idempotencyKey?.trim()) {
    throw new CoordinationError('Exact sessionId and idempotencyKey are required', 400, 'invalid_request');
  }
  return getSharedDb().transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${sessionId}))`);
    await input._afterSessionLockForTest?.();
    const [session] = await tx.select({
      id: voiceSessions.id,
      conversationId: voiceSessions.conversationId,
      userId: voiceSessions.userId,
      status: voiceSessions.status,
    }).from(voiceSessions).where(eq(voiceSessions.id, sessionId)).limit(1);
    if (!session || !session.conversationId || session.status !== 'active') {
      throw new CoordinationError('An already-active founder voice session is required', 409, 'voice_session_not_active');
    }
    if (!isFounder({ id: session.userId } as Parameters<typeof isFounder>[0])) {
      throw new CoordinationError('Student voice sessions cannot be observed', 403, 'founder_session_required');
    }
    const [idempotent] = await tx.select().from(coordinationEvents).where(and(
      eq(coordinationEvents.actor, input.actor),
      eq(coordinationEvents.idempotencyKey, input.idempotencyKey),
    )).limit(1);
    if (idempotent) {
      const payload = payloadOf(idempotent);
      if (payload.sessionId !== sessionId || !['observation_hat_attached', 'observation_founder_started'].includes(String(payload.kind))) {
        throw new CoordinationError('Idempotency key was used for another mutation', 409, 'idempotency_conflict');
      }
      const [thread] = await tx.select().from(coordinationThreads)
        .where(eq(coordinationThreads.id, idempotent.threadId)).limit(1);
      if (!thread) throw new CoordinationError('Observation bench thread is missing', 500, 'ledger_corrupt');
      return { thread, event: idempotent, deduplicated: true, deliveryState: 'not_applicable' as const };
    }
    const rows = await tx.select({ thread: coordinationThreads, created: coordinationEvents })
      .from(coordinationThreads).innerJoin(coordinationEvents, and(
        eq(coordinationEvents.threadId, coordinationThreads.id),
        eq(coordinationEvents.sequence, 1),
      )).orderBy(desc(coordinationThreads.createdAt));
    const winner = selectExactSessionBenchWinner(rows, sessionId);
    let thread = winner?.thread;
    let sequence = thread?.latestSequence ?? 0;
    if (thread) {
      const events = await tx.select().from(coordinationEvents)
        .where(eq(coordinationEvents.threadId, thread.id));
      assertObservationWindowActive(events);
    } else {
      [thread] = await tx.insert(coordinationThreads).values({
        title: `One Luca, two benches — ${session.conversationId}`,
        description: 'Shared read-only founder voice evidence for Luca wearing the Replit and Claude Code hats.',
        originActor: 'luca-replit',
        intendedRecipient: 'luca-claude-code',
        priority: 'normal',
        state: 'created',
        latestSequence: 0,
        latestGlobalSequence: 0,
      }).returning();
      if (!thread) throw new CoordinationError('Observation bench insert returned no row', 500, 'insert_failed');
      const [created] = await tx.insert(coordinationEvents).values({
        threadId: thread.id,
        sequence: 1,
        actor: input.actor,
        recipientActor: input.actor === 'luca-claude-code' ? 'luca-replit' : 'luca-claude-code',
        eventType: 'created',
        content: `${input.actor} opened read-only observation for exact founder voice session ${sessionId}.`,
        idempotencyKey: `${input.idempotencyKey}:bench-created`,
        payload: {
          kind: BENCH_KIND,
          conversationId: session.conversationId,
          sessionId,
          requestedBy: input.actor,
          sourcePolicy: 'read_only_canonical_evidence',
          identityPolicy: 'one_luca_multiple_hats',
          danielaInjectionPolicy: 'never_injected_technical_observation_only',
        },
      }).returning();
      if (!created) throw new CoordinationError('Observation bench event insert returned no row', 500, 'insert_failed');
      sequence = 1;
      [thread] = await tx.update(coordinationThreads).set({
        latestSequence: sequence,
        latestGlobalSequence: created.globalSequence,
        updatedAt: new Date(),
      }).where(eq(coordinationThreads.id, thread.id)).returning();
    }
    const kind = input.actor === 'david' ? 'observation_founder_started' : 'observation_hat_attached';
    const [event] = await tx.insert(coordinationEvents).values({
      threadId: thread!.id,
      sequence: sequence + 1,
      actor: input.actor,
      recipientActor: input.actor === 'luca-claude-code' ? 'luca-replit' : 'luca-claude-code',
      eventType: 'comment',
      content: `${input.actor} bound read-only observation to exact founder voice session ${sessionId}.`,
      idempotencyKey: input.idempotencyKey,
      payload: {
        kind,
        actor: input.actor,
        sessionId,
        conversationId: session.conversationId,
        authority: 'read_only_observation',
        attachedAt: new Date().toISOString(),
      },
    }).returning();
    if (!event) throw new CoordinationError('Observation binding insert returned no row', 500, 'insert_failed');
    [thread] = await tx.update(coordinationThreads).set({
      latestSequence: sequence + 1,
      latestGlobalSequence: event.globalSequence,
      updatedAt: new Date(),
    }).where(eq(coordinationThreads.id, thread!.id)).returning();
    return { thread, event, deduplicated: false, deliveryState: 'not_applicable' as const };
  });
}

export async function attachObservationBench(input: {
  sessionId: string;
  actor: CoordinationActorId;
  idempotencyKey: string;
  _afterSessionLockForTest?: () => Promise<void>;
}) {
  assertBenchActor(input.actor);
  return openExactSessionObservationBench({ ...input, actor: input.actor });
}

export async function startObservationBench(input: {
  sessionId: string;
  armThreadId?: string;
  idempotencyKey: string;
  _afterSessionLockForTest?: () => Promise<void>;
}) {
  const result = await openExactSessionObservationBench({
    sessionId: input.sessionId,
    actor: 'david',
    idempotencyKey: input.idempotencyKey,
    _afterSessionLockForTest: input._afterSessionLockForTest,
  });
  return { ...result, armThreadId: null };
}

export async function syncObservationBench(input: {
  threadId: string;
  actor: CoordinationActorId;
}) {
  if (input.actor !== 'david') assertBenchActor(input.actor);
  let view = await getCoordinationThread(
    input.threadId,
    input.actor === 'david' ? 'luca-replit' : input.actor,
  );
  const bench = assertBenchThread(view.events);
  assertObservationWindowActive(view.events);
  const captureActor: CoordinationActorId = 'coordination-system';
  if (!bench.sessionId) {
    throw new CoordinationError('Observation bench is missing its immutable session ID', 500, 'bench_session_missing');
  }
  const [session] = await getSharedDb()
    .select({
      id: voiceSessions.id,
      userId: voiceSessions.userId,
      status: voiceSessions.status,
    })
    .from(voiceSessions)
    .where(and(
      eq(voiceSessions.id, bench.sessionId),
      eq(voiceSessions.conversationId, bench.conversationId),
    ))
    .limit(1);
  if (!session) {
    throw new CoordinationError('The bench voice session no longer exists', 404, 'voice_session_not_found');
  }
  if (session.status !== 'active') {
    await closeObservationBenchBySessionId({ sessionId: bench.sessionId, stale: true });
    throw new CoordinationError('Observation window has ended', 409, 'observation_window_ended');
  }
  const expectedScope: ObservationScope = {
    userId: session.userId,
    sessionId: bench.sessionId,
    conversationId: bench.conversationId,
  };
  const existing = new Set(
    view.events
      .map(payloadOf)
      .filter(payload => payload.kind === SOURCE_KIND && typeof payload.sourceId === 'string')
      .map(payload => `${payload.sourceType}:${payload.sourceId}`),
  );

  const pipeline = await getSharedDb()
    .select({
      id: voicePipelineEvents.id,
      eventType: voicePipelineEvents.eventType,
      eventData: voicePipelineEvents.eventData,
      createdAt: voicePipelineEvents.createdAt,
    })
    .from(voicePipelineEvents)
    .where(eq(voicePipelineEvents.sessionId, bench.sessionId))
    .orderBy(asc(voicePipelineEvents.createdAt), asc(voicePipelineEvents.id));

  const lineage = await getSharedDb()
    .select({
      id: contextLineageEvents.id,
      sessionId: contextLineageEvents.sessionId,
      sourceRoute: contextLineageEvents.sourceRoute,
      eventType: contextLineageEvents.eventType,
      deliveryChannel: contextLineageEvents.deliveryChannel,
      deliveryStatus: contextLineageEvents.deliveryStatus,
      payloadText: contextLineageEvents.payloadText,
      payloadJson: contextLineageEvents.payloadJson,
      payloadSha256: contextLineageEvents.payloadSha256,
      observedAt: contextLineageEvents.observedAt,
    })
    .from(contextLineageEvents)
    .where(eq(contextLineageEvents.sessionId, bench.sessionId))
    .orderBy(asc(contextLineageEvents.observedAt), asc(contextLineageEvents.id));
  const scopedLineage = lineage.filter(event => observationObjectScopeMatches(event.payloadJson, expectedScope));

  const health = await getSharedDb().select()
    .from(studentSessionHealth)
    .where(and(
      eq(studentSessionHealth.sessionId, bench.sessionId),
      eq(studentSessionHealth.userId, session.userId),
    ))
    .orderBy(asc(studentSessionHealth.createdAt), asc(studentSessionHealth.id));

  const userIssueReports = await getSharedDb().select()
    .from(sofiaIssueReports)
    .where(eq(sofiaIssueReports.userId, session.userId))
    .orderBy(asc(sofiaIssueReports.createdAt), asc(sofiaIssueReports.id));
  const issueReports = userIssueReports.filter(report => sofiaReportScopeMatches(report, expectedScope));

  const sources: Array<Omit<SourceEnvelope, 'kind' | 'capturedAt'>> = [
    ...pipeline.map(event => ({
      sourceType: 'voice_pipeline' as const,
      sourceId: event.id,
      conversationId: bench.conversationId,
      sessionId: bench.sessionId,
      sourceTimestamp: event.createdAt.toISOString(),
      sha256: digest({ eventType: event.eventType, eventData: event.eventData }),
      eventType: event.eventType,
      captureRequestedBy: input.actor,
    })),
    ...scopedLineage.map(event => ({
      sourceType: 'context_lineage' as const,
      sourceId: event.id,
      conversationId: bench.conversationId,
      sessionId: event.sessionId,
      sourceTimestamp: event.observedAt.toISOString(),
      sha256: event.payloadSha256 ?? digest({
        sourceRoute: event.sourceRoute,
        eventType: event.eventType,
        deliveryChannel: event.deliveryChannel,
        deliveryStatus: event.deliveryStatus,
        payloadText: event.payloadText,
        payloadJson: event.payloadJson,
      }),
      sourceRoute: event.sourceRoute,
      eventType: event.eventType,
      deliveryChannel: event.deliveryChannel,
      deliveryStatus: event.deliveryStatus,
      captureRequestedBy: input.actor,
    })),
    ...issueReports.map(report => ({
      sourceType: 'sofia_issue_report' as const,
      sourceId: report.id,
      conversationId: bench.conversationId,
      sessionId: bench.sessionId,
      sourceTimestamp: report.createdAt.toISOString(),
      sha256: digest({
        issueType: report.issueType,
        userDescription: report.userDescription,
        sofiaAnalysis: report.sofiaAnalysis,
        diagnosticSnapshot: report.diagnosticSnapshot,
        clientTelemetry: report.clientTelemetry,
        status: report.status,
      }),
      eventType: report.issueType,
      captureRequestedBy: input.actor,
    })),
    ...health.map(row => ({
      sourceType: 'student_session_health' as const,
      sourceId: row.id,
      conversationId: bench.conversationId,
      sessionId: bench.sessionId,
      sourceTimestamp: row.createdAt.toISOString(),
      sha256: digest({
        language: row.language,
        durationSeconds: row.durationSeconds,
        exchangeCount: row.exchangeCount,
        studentSpeakingSeconds: row.studentSpeakingSeconds,
        errorCount: row.errorCount,
        qualityScore: row.qualityScore,
      }),
      eventType: 'session_health',
      captureRequestedBy: input.actor,
    })),
  ].sort((a, b) => (
    a.sourceTimestamp.localeCompare(b.sourceTimestamp)
    || a.sourceType.localeCompare(b.sourceType)
    || a.sourceId.localeCompare(b.sourceId)
  ));

  let appended = 0;
  for (const source of sources) {
    const sourceKey = `${source.sourceType}:${source.sourceId}`;
    if (existing.has(sourceKey)) continue;
    const capturedAt = new Date().toISOString();
    const result = await appendCoordinationEvent({
      threadId: input.threadId,
      actor: captureActor,
      eventType: 'comment',
      content: `Canonical ${source.sourceType} evidence at ${source.sourceTimestamp}.`,
      idempotencyKey: `bench-source:${input.threadId}:${source.sourceType}:${source.sourceId}`,
      expectedSequence: view.thread.latestSequence,
      payload: {
        kind: SOURCE_KIND,
        ...source,
        capturedAt,
        serverSignature: sourceSignature(source),
      } satisfies SourceEnvelope & { serverSignature: string },
    });
    view = { thread: result.thread, events: [...view.events, result.event] };
    existing.add(sourceKey);
    appended += 1;
  }
  const syncResult = await appendCoordinationEvent({
    threadId: input.threadId,
    actor: input.actor,
    eventType: 'comment',
    content: `${input.actor} synchronized read-only evidence for exact voice session ${bench.sessionId}.`,
    idempotencyKey: `bench-sync:${input.threadId}:${input.actor}:${view.thread.latestSequence}`,
    expectedSequence: view.thread.latestSequence,
    payload: {
      kind: 'observation_hat_sync',
      actor: input.actor,
      sessionId: bench.sessionId,
      conversationId: bench.conversationId,
      syncedThroughSequence: view.thread.latestSequence,
      syncedAt: new Date().toISOString(),
    },
  });
  view = { thread: syncResult.thread, events: [...view.events, syncResult.event] };
  return { thread: view.thread, appended, sourceCount: existing.size };
}

export async function getObservationBenchSourceStream(
  threadId: string,
  actor: CoordinationActorId,
  afterSequence = 0,
) {
  assertBenchActor(actor);
  const view = await getCoordinationThread(threadId, actor);
  const bench = assertBenchThread(view.events);
  const [benchSession] = await getSharedDb().select({ userId: voiceSessions.userId })
    .from(voiceSessions)
    .where(and(
      eq(voiceSessions.id, bench.sessionId!),
      eq(voiceSessions.conversationId, bench.conversationId),
    ))
    .limit(1);
  if (!benchSession) throw new CoordinationError('Bench session not found', 404, 'voice_session_not_found');
  const expectedScope: ObservationScope = {
    userId: benchSession.userId,
    sessionId: bench.sessionId!,
    conversationId: bench.conversationId,
  };
  const sourceEvents = view.events.filter(event => (
    event.sequence > afterSequence && payloadOf(event).kind === SOURCE_KIND
  ));
  sourceEvents.forEach(event => assertValidSourceEvent(event, bench));
  const pipelineIds = sourceEvents
    .filter(event => payloadOf(event).sourceType === 'voice_pipeline')
    .map(event => String(payloadOf(event).sourceId));
  const lineageIds = sourceEvents
    .filter(event => payloadOf(event).sourceType === 'context_lineage')
    .map(event => String(payloadOf(event).sourceId));
  const issueReportIds = sourceEvents
    .filter(event => payloadOf(event).sourceType === 'sofia_issue_report')
    .map(event => String(payloadOf(event).sourceId));
  const healthIds = sourceEvents
    .filter(event => payloadOf(event).sourceType === 'student_session_health')
    .map(event => String(payloadOf(event).sourceId));
  const canonicalPipeline = pipelineIds.length
    ? await getSharedDb().select({
        id: voicePipelineEvents.id,
        sessionId: voicePipelineEvents.sessionId,
        eventType: voicePipelineEvents.eventType,
        eventData: voicePipelineEvents.eventData,
        createdAt: voicePipelineEvents.createdAt,
      }).from(voicePipelineEvents).where(and(
        inArray(voicePipelineEvents.id, pipelineIds),
        eq(voicePipelineEvents.sessionId, bench.sessionId!),
      ))
    : [];
  const canonicalLineage = lineageIds.length
    ? await getSharedDb().select({
        id: contextLineageEvents.id,
        sessionId: contextLineageEvents.sessionId,
        sourceRoute: contextLineageEvents.sourceRoute,
        eventType: contextLineageEvents.eventType,
        deliveryChannel: contextLineageEvents.deliveryChannel,
        deliveryStatus: contextLineageEvents.deliveryStatus,
        payloadText: contextLineageEvents.payloadText,
        payloadJson: contextLineageEvents.payloadJson,
        payloadSha256: contextLineageEvents.payloadSha256,
        observedAt: contextLineageEvents.observedAt,
      }).from(contextLineageEvents).where(and(
        inArray(contextLineageEvents.id, lineageIds),
        eq(contextLineageEvents.sessionId, bench.sessionId!),
      ))
    : [];
  const canonicalIssueReports = issueReportIds.length
    ? await getSharedDb().select().from(sofiaIssueReports).where(and(
        inArray(sofiaIssueReports.id, issueReportIds),
        eq(sofiaIssueReports.userId, benchSession.userId),
      ))
    : [];
  const canonicalHealth = healthIds.length
    ? await getSharedDb().select().from(studentSessionHealth).where(and(
        inArray(studentSessionHealth.id, healthIds),
        eq(studentSessionHealth.sessionId, bench.sessionId!),
        eq(studentSessionHealth.userId, benchSession.userId),
      ))
    : [];
  const pipelineById = new Map(canonicalPipeline.map(row => [row.id, row]));
  const lineageById = new Map(canonicalLineage
    .filter(row => observationObjectScopeMatches(row.payloadJson, expectedScope))
    .map(row => [row.id, row]));
  const issueReportById = new Map(canonicalIssueReports
    .filter(row => sofiaReportScopeMatches(row, expectedScope))
    .map(row => [row.id, row]));
  const healthById = new Map(canonicalHealth.map(row => [row.id, row]));
  return {
    thread: view.thread,
    items: sourceEvents.map(event => {
      const envelope = payloadOf(event);
      const sourceId = String(envelope.sourceId);
      const canonical = envelope.sourceType === 'voice_pipeline'
        ? pipelineById.get(sourceId)
        : envelope.sourceType === 'context_lineage'
          ? lineageById.get(sourceId)
          : envelope.sourceType === 'sofia_issue_report'
            ? issueReportById.get(sourceId)
            : healthById.get(sourceId);
      const actualDigest = !canonical
        ? null
        : envelope.sourceType === 'voice_pipeline'
          ? digest({
              eventType: (canonical as typeof canonicalPipeline[number]).eventType,
              eventData: (canonical as typeof canonicalPipeline[number]).eventData,
            })
          : envelope.sourceType === 'context_lineage'
            ? (canonical as typeof canonicalLineage[number]).payloadSha256 ?? digest({
              sourceRoute: (canonical as typeof canonicalLineage[number]).sourceRoute,
              eventType: (canonical as typeof canonicalLineage[number]).eventType,
              deliveryChannel: (canonical as typeof canonicalLineage[number]).deliveryChannel,
              deliveryStatus: (canonical as typeof canonicalLineage[number]).deliveryStatus,
              payloadText: (canonical as typeof canonicalLineage[number]).payloadText,
              payloadJson: (canonical as typeof canonicalLineage[number]).payloadJson,
            })
            : envelope.sourceType === 'sofia_issue_report'
              ? digest({
                  issueType: (canonical as typeof canonicalIssueReports[number]).issueType,
                  userDescription: (canonical as typeof canonicalIssueReports[number]).userDescription,
                  sofiaAnalysis: (canonical as typeof canonicalIssueReports[number]).sofiaAnalysis,
                  diagnosticSnapshot: (canonical as typeof canonicalIssueReports[number]).diagnosticSnapshot,
                  clientTelemetry: (canonical as typeof canonicalIssueReports[number]).clientTelemetry,
                  status: (canonical as typeof canonicalIssueReports[number]).status,
                })
              : digest({
                  language: (canonical as typeof canonicalHealth[number]).language,
                  durationSeconds: (canonical as typeof canonicalHealth[number]).durationSeconds,
                  exchangeCount: (canonical as typeof canonicalHealth[number]).exchangeCount,
                  studentSpeakingSeconds: (canonical as typeof canonicalHealth[number]).studentSpeakingSeconds,
                  errorCount: (canonical as typeof canonicalHealth[number]).errorCount,
                  qualityScore: (canonical as typeof canonicalHealth[number]).qualityScore,
                });
      const lineage = envelope.sourceType === 'context_lineage' && canonical
        ? canonical as typeof canonicalLineage[number]
        : null;
      const lineageRawPayload = lineage
        ? lineage.payloadText ?? (lineage.payloadJson ? JSON.stringify(lineage.payloadJson) : '')
        : '';
      const lineageStoredHashMatches = !lineage?.payloadSha256
        || createHash('sha256').update(lineageRawPayload).digest('hex') === lineage.payloadSha256;
      const canonicalMetadataMatches = !canonical
        ? false
        : envelope.sourceType === 'voice_pipeline'
          ? (canonical as typeof canonicalPipeline[number]).sessionId === envelope.sessionId
            && (canonical as typeof canonicalPipeline[number]).createdAt.toISOString() === envelope.sourceTimestamp
          : envelope.sourceType === 'context_lineage'
            ? (canonical as typeof canonicalLineage[number]).sessionId === envelope.sessionId
              && (canonical as typeof canonicalLineage[number]).observedAt.toISOString() === envelope.sourceTimestamp
            : envelope.sourceType === 'sofia_issue_report'
              ? (canonical as typeof canonicalIssueReports[number]).createdAt.toISOString() === envelope.sourceTimestamp
                && sofiaReportScopeMatches(
                  canonical as typeof canonicalIssueReports[number],
                  expectedScope,
                )
              : (canonical as typeof canonicalHealth[number]).sessionId === envelope.sessionId
                && (canonical as typeof canonicalHealth[number]).createdAt.toISOString() === envelope.sourceTimestamp;
      const signedLineageMetadataMatches = !lineage
        || (
          lineage.sourceRoute === envelope.sourceRoute
          && lineage.eventType === envelope.eventType
          && lineage.deliveryChannel === envelope.deliveryChannel
          && lineage.deliveryStatus === envelope.deliveryStatus
        );
      return {
        sequence: event.sequence,
        eventId: event.id,
        envelope,
        canonical,
        integrity: canonicalMetadataMatches
          && signedLineageMetadataMatches
          && lineageStoredHashMatches
          && actualDigest === envelope.sha256
          ? 'verified'
          : 'unavailable_or_changed',
      };
    }),
    cursor: sourceEvents.at(-1)?.sequence ?? afterSequence,
  };
}

export async function addBenchObservation(input: {
  threadId: string;
  actor: CoordinationActorId;
  category: ObservationCategory;
  content: string;
  sourceEventIds: string[];
  improvesObservationEventIds?: string[];
  idempotencyKey: string;
  expectedSequence: number;
}) {
  assertBenchActor(input.actor);
  const actor = input.actor;
  const content = input.content?.trim();
  if (!content || content.length > 20_000 || !input.idempotencyKey?.trim()) {
    throw new CoordinationError('Observation content and idempotencyKey are required', 400, 'invalid_request');
  }
  if (!OBSERVATION_CATEGORIES.includes(input.category)) {
    throw new CoordinationError('Observation category is invalid', 400, 'invalid_observation_category');
  }
  const view = await getCoordinationThread(input.threadId, input.actor);
  assertBenchThread(view.events);
  assertObservationWindowActive(view.events);
  const sourceIds = new Set(
    view.events
      .filter(event => payloadOf(event).kind === SOURCE_KIND)
      .filter(event => {
        assertValidSourceEvent(event, assertBenchThread(view.events));
        return true;
      })
      .map(event => event.id),
  );
  if (input.sourceEventIds.length === 0 || input.sourceEventIds.some(id => !sourceIds.has(id))) {
    throw new CoordinationError('Every observation must reference source events from this bench', 400, 'invalid_source_reference');
  }
  const observationIds = new Set(
    view.events.filter(event => payloadOf(event).kind === OBSERVATION_KIND).map(event => event.id),
  );
  if (
    input.category === 'cross_hat_improvement'
    && (!input.improvesObservationEventIds?.length
      || input.improvesObservationEventIds.some(id => !observationIds.has(id)))
  ) {
    throw new CoordinationError(
      'Cross-hat improvements must reference prior observations from this bench',
      400,
      'invalid_observation_reference',
    );
  }
  const signatureInput = {
    actor,
    category: input.category,
    content,
    sourceEventIds: input.sourceEventIds,
    improvesObservationEventIds: input.improvesObservationEventIds ?? [],
  };
  const [existing] = await getSharedDb().select()
    .from(coordinationEvents)
    .where(and(
      eq(coordinationEvents.actor, input.actor),
      eq(coordinationEvents.idempotencyKey, input.idempotencyKey),
    ))
    .limit(1);
  if (existing) {
    if (existing.threadId !== input.threadId || payloadOf(existing).kind !== OBSERVATION_KIND) {
      throw new CoordinationError('Idempotency key was already used for another event', 409, 'idempotency_conflict');
    }
    const [thread] = await getSharedDb().select()
      .from(coordinationThreads)
      .where(eq(coordinationThreads.id, input.threadId))
      .limit(1);
    return { thread, event: existing, deduplicated: true, deliveryState: 'not_applicable' as const };
  }

  return getSharedDb().transaction(async tx => {
    const [reservedThread] = await tx.update(coordinationThreads)
      .set({ latestSequence: input.expectedSequence + 1, updatedAt: new Date() })
      .where(and(
        eq(coordinationThreads.id, input.threadId),
        eq(coordinationThreads.latestSequence, input.expectedSequence),
      ))
      .returning();
    if (!reservedThread) throw new CoordinationError('Observation bench sequence changed', 409, 'sequence_conflict');

    const [event] = await tx.insert(coordinationEvents).values({
      threadId: input.threadId,
      sequence: input.expectedSequence + 1,
      actor,
      recipientActor: otherHat(actor),
      eventType: 'comment',
      content,
      idempotencyKey: input.idempotencyKey,
      causalParentEventId: input.sourceEventIds[0],
      payload: {
        kind: OBSERVATION_KIND,
        hat: actor,
        category: input.category,
        sourceEventIds: input.sourceEventIds,
        improvesObservationEventIds: input.improvesObservationEventIds ?? [],
        observedAt: new Date().toISOString(),
        injectionState: 'bench_only',
        serverSignature: observationSignature(signatureInput),
      },
    }).returning();
    if (!event) throw new CoordinationError('Observation insert returned no row', 500, 'insert_failed');
    const [thread] = await tx.update(coordinationThreads)
      .set({ latestGlobalSequence: event.globalSequence, updatedAt: new Date() })
      .where(eq(coordinationThreads.id, input.threadId))
      .returning();
    if (!thread) throw new CoordinationError('Observation projection failed', 500, 'projection_failed');
    return { thread, event, deduplicated: false, deliveryState: 'not_applicable' as const };
  });
}

export async function getObservationBenchComparison(
  threadId: string,
  actor: CoordinationActorId,
) {
  assertBenchActor(actor);
  const view = await getCoordinationThread(threadId, actor);
  const bench = assertBenchThread(view.events);
  const sourceEvents = view.events.filter(event => payloadOf(event).kind === SOURCE_KIND);
  const observations = view.events.filter(event => payloadOf(event).kind === OBSERVATION_KIND);
  const invitations = view.events.filter(event => payloadOf(event).kind === INVITATION_KIND);
  const byHat = Object.fromEntries(OBSERVATION_BENCH_ACTORS.map(hat => [
    hat,
    Object.fromEntries(OBSERVATION_CATEGORIES.map(category => [
      category,
      observations
        .filter(event => event.actor === hat && payloadOf(event).category === category)
        .map(event => ({ eventId: event.id, at: event.createdAt, content: event.content, ...payloadOf(event) })),
    ])),
  ]));
  const coverage = sourceEvents.map(source => {
    const reviewingHats = OBSERVATION_BENCH_ACTORS.filter(hat => observations.some(event => (
      event.actor === hat
      && Array.isArray(payloadOf(event).sourceEventIds)
      && (payloadOf(event).sourceEventIds as unknown[]).includes(source.id)
    )));
    return { sourceEventId: source.id, reviewingHats, reviewedByBoth: reviewingHats.length === 2 };
  });
  return {
    thread: view.thread,
    conversationId: bench.conversationId,
    sessionId: bench.sessionId,
    sourceCount: sourceEvents.length,
    sourceRange: {
      first: sourceEvents
        .map(event => payloadOf(event).sourceTimestamp)
        .filter((value): value is string => typeof value === 'string')
        .sort()[0] ?? null,
      last: sourceEvents
        .map(event => payloadOf(event).sourceTimestamp)
        .filter((value): value is string => typeof value === 'string')
        .sort()
        .at(-1) ?? null,
    },
    byHat,
    coverage,
    unreviewedSourceEventIds: coverage
      .filter(item => item.reviewingHats.length === 0)
      .map(item => item.sourceEventId),
    crossHatLinks: observations
      .filter(event => payloadOf(event).category === 'cross_hat_improvement')
      .map(event => ({
        eventId: event.id,
        hat: event.actor,
        improvesObservationEventIds: payloadOf(event).improvesObservationEventIds,
      })),
    invitations: invitations.map(event => ({ eventId: event.id, at: event.createdAt, ...payloadOf(event) })),
  };
}

export async function listObservationBenchDashboard() {
  const createdEvents = await getSharedDb()
    .select({ thread: coordinationThreads, created: coordinationEvents })
    .from(coordinationThreads)
    .innerJoin(coordinationEvents, and(
      eq(coordinationEvents.threadId, coordinationThreads.id),
      eq(coordinationEvents.sequence, 1),
    ))
    .orderBy(desc(coordinationThreads.updatedAt));

  const benches = createdEvents.filter(({ thread, created }) => (
    payloadOf(created).kind === BENCH_KIND
  ));
  const feedCursors = await getSharedDb()
    .select()
    .from(coordinationActorFeedCursors)
    .where(inArray(coordinationActorFeedCursors.actor, [...OBSERVATION_BENCH_ACTORS]));
  const cursorByActor = new Map(feedCursors.map(cursor => [cursor.actor, cursor]));
  const dashboardBenches = await Promise.all(benches.map(async ({ thread }) => {
      const [comparison, sources, view] = await Promise.all([
        getObservationBenchComparison(thread.id, 'luca-replit'),
        getObservationBenchSourceStream(thread.id, 'luca-replit'),
        getCoordinationThread(thread.id, 'luca-replit'),
      ]);
      const eventIds = view.events.map(event => event.id);
      const deliveries = eventIds.length > 0
        ? await getSharedDb().select().from(coordinationAdapterDeliveries)
            .where(inArray(coordinationAdapterDeliveries.eventId, eventIds))
        : [];
      const deliveryByEvent = new Map(deliveries.map(delivery => [delivery.eventId, delivery]));
      const sourceByEventId = new Map(
        view.events
          .filter(event => payloadOf(event).kind === SOURCE_KIND)
          .map(event => [event.id, payloadOf(event)]),
      );
      const backchannel = view.events
        .filter(event => [OBSERVATION_KIND, INVITATION_KIND].includes(String(payloadOf(event).kind)))
        .map(event => {
          const sourceEventIds = Array.isArray(payloadOf(event).sourceEventIds)
            ? (payloadOf(event).sourceEventIds as unknown[]).filter((id): id is string => typeof id === 'string')
            : [];
          return {
          sequence: event.sequence,
          eventId: event.id,
          kind: payloadOf(event).kind,
          actor: event.actor,
          observationHat: payloadOf(event).kind === INVITATION_KIND
            ? payloadOf(event).observationHat
            : event.actor,
          at: event.createdAt,
          content: event.content,
          category: payloadOf(event).category ?? null,
          improvesObservationEventIds: payloadOf(event).improvesObservationEventIds ?? [],
          observationEventId: payloadOf(event).observationEventId ?? null,
          sourceEventIds,
          sourceReferences: sourceEventIds.map(sourceEventId => ({
            sourceEventId,
            sourceTimestamp: sourceByEventId.get(sourceEventId)?.sourceTimestamp ?? null,
            integrity: sources.items.find(item => item.eventId === sourceEventId)?.integrity ?? 'unavailable_or_changed',
          })),
          authentication: payloadOf(event).kind === INVITATION_KIND
            ? 'founder_authorization_receipt'
            : 'authenticated_coordination_actor',
          lifecycle: {
            delivered: deliveryByEvent.get(event.id)?.status ?? 'not_applicable',
            notified: 'unavailable',
            notificationEvidence: 'none',
            seen: (() => {
              const cursor = cursorByActor.get(event.actor);
              return cursor ? cursor.acknowledgedGlobalSequence >= event.globalSequence : false;
            })(),
            acknowledged: view.events.some(candidate =>
              candidate.causalParentEventId === event.id
              && ['accepted', 'outcome_acknowledged'].includes(candidate.eventType)),
            actedOn: payloadOf(event).kind === INVITATION_KIND ? 'promoted' : 'unavailable',
          },
        };
        });
      const lastEvent = view.events.at(-1) ?? null;
      const windowEnded = view.events.some(event => payloadOf(event).kind === 'observation_window_ended');
      return {
        thread,
        comparison,
        liveStatus: {
          window: windowEnded || ['completed', 'outcome_acknowledged'].includes(thread.state) ? 'ended' : 'active',
          cursor: thread.latestSequence,
          lastEvent: lastEvent ? {
            sequence: lastEvent.sequence,
            at: lastEvent.createdAt,
            actor: lastEvent.actor,
            eventType: lastEvent.eventType,
          } : null,
          hats: Object.fromEntries(OBSERVATION_BENCH_ACTORS.map(hat => {
            const hatEvent = [...view.events].reverse().find(event => event.actor === hat);
            const ageMs = hatEvent ? Date.now() - hatEvent.createdAt.getTime() : null;
            const connection = ageMs === null
              ? 'never_connected'
              : windowEnded ? 'disconnected'
              : ageMs <= 60_000
                ? 'connected'
                : ageMs <= 300_000 ? 'degraded' : 'disconnected';
            return [hat, {
              connection,
              connectionEvidence: 'exact_bench_authenticated_event',
              authenticatedAccess: hatEvent ? 'observed' : 'not_observed',
              cursor: hatEvent?.sequence ?? 0,
              replayPending: (hatEvent?.sequence ?? 0) < thread.latestSequence,
              replayFromGlobalSequence: (hatEvent?.sequence ?? 0) + 1,
              lastEventAt: hatEvent?.createdAt ?? null,
              lastContactAt: hatEvent?.createdAt ?? null,
            }];
          })),
        },
        backchannel,
        sources: sources.items.map(item => ({
          sequence: item.sequence,
          eventId: item.eventId,
          sourceType: item.envelope.sourceType,
          sourceId: item.envelope.sourceId,
          sourceTimestamp: item.envelope.sourceTimestamp,
          sha256: item.envelope.sha256,
          eventType: item.envelope.eventType ?? null,
          sourceRoute: item.envelope.sourceRoute ?? null,
          deliveryChannel: item.envelope.deliveryChannel ?? null,
          deliveryStatus: item.envelope.deliveryStatus ?? null,
          integrity: item.integrity,
        })),
      };
    }));
  return {
    benches: dashboardBenches,
    generatedAt: new Date().toISOString(),
    contextBoundary: 'technical_observation_only',
  };
}

export async function listActiveObservationSessions() {
  return {
    sessions: await getSharedDb()
      .select({
        id: voiceSessions.id,
        conversationId: voiceSessions.conversationId,
        language: voiceSessions.language,
        startedAt: voiceSessions.startedAt,
      })
      .from(voiceSessions)
      .where(and(
        eq(voiceSessions.status, 'active'),
        eq(voiceSessions.userId, FOUNDER_USER_ID),
      ))
      .orderBy(desc(voiceSessions.startedAt))
      .limit(50),
  };
}

async function closeObservationBenchThread(input: {
  threadId: string;
  actor: CoordinationActorId;
  reason: 'founder_ended' | 'actor_ended' | 'voice_session_ended' | 'stale';
}) {
  const readActor = input.actor === 'coordination-system' || input.actor === 'david'
    ? 'luca-replit'
    : input.actor;
  const view = await getCoordinationThread(input.threadId, readActor);
  assertBenchThread(view.events);
  if (
    ['completed', 'outcome_acknowledged'].includes(view.thread.state)
    || view.events.some(event => payloadOf(event).kind === 'observation_window_ended')
  ) {
    return { thread: view.thread, deduplicated: true };
  }
  const sourceCount = view.events.filter(event => payloadOf(event).kind === SOURCE_KIND).length;
  try {
    return await getSharedDb().transaction(async tx => {
      const nextSequence = view.thread.latestSequence + 1;
    const [reserved] = await tx.update(coordinationThreads)
      .set({ latestSequence: nextSequence, updatedAt: new Date() })
      .where(and(
        eq(coordinationThreads.id, input.threadId),
        eq(coordinationThreads.latestSequence, view.thread.latestSequence),
      ))
      .returning();
    if (!reserved) throw new CoordinationError('Observation bench changed before closure', 409, 'sequence_conflict');
    const [event] = await tx.insert(coordinationEvents).values({
      threadId: input.threadId,
      sequence: nextSequence,
      actor: input.actor,
      recipientActor: input.actor === 'luca-replit' ? 'luca-claude-code' : 'luca-replit',
      eventType: 'comment',
      content: `${input.actor} terminally closed this read-only technical observation window.`,
      idempotencyKey: `bench-window-ended:${input.threadId}`,
      payload: {
        kind: 'observation_window_ended',
        endedBy: input.actor,
        reason: input.reason,
        endedAt: new Date().toISOString(),
        sourceCount,
        contextBoundary: 'technical_observation_only',
        danielaContextState: 'not_injected',
      },
    }).returning();
    if (!event) throw new CoordinationError('Observation closure insert returned no row', 500, 'insert_failed');
    const [thread] = await tx.update(coordinationThreads)
      .set({ latestGlobalSequence: event.globalSequence, updatedAt: new Date() })
      .where(eq(coordinationThreads.id, input.threadId))
      .returning();
      return { thread, event, deduplicated: false, deliveryState: 'not_applicable' as const };
    });
  } catch (error) {
    if (!(error instanceof CoordinationError) || error.code !== 'sequence_conflict') throw error;
    const latest = await getCoordinationThread(input.threadId, readActor);
    if (!closeConflictIsAlreadyEnded(latest.events)) throw error;
    return { thread: latest.thread, deduplicated: true };
  }
}

export async function endObservationBench(input: {
  threadId: string;
  actor?: CoordinationActorId;
}) {
  const actor = input.actor ?? 'david';
  if (actor !== 'david') assertBenchActor(actor);
  return closeObservationBenchThread({
    threadId: input.threadId,
    actor,
    reason: actor === 'david' ? 'founder_ended' : 'actor_ended',
  });
}

/**
 * Parent integration seam: call this from voice-session termination with the
 * immutable DB voice session ID. It is safe to retry.
 */
export async function closeObservationBenchBySessionId(input: {
  sessionId: string;
  stale?: boolean;
}) {
  const sessionId = input.sessionId?.trim();
  if (!sessionId) throw new CoordinationError('Exact sessionId is required', 400, 'invalid_request');
  const bench = await findObservationBenchBySessionId(sessionId);
  if (!bench) return { thread: null, deduplicated: true };
  return closeObservationBenchThread({
    threadId: bench.thread.id,
    actor: 'coordination-system',
    reason: input.stale ? 'stale' : 'voice_session_ended',
  });
}

export async function getObservationBenchPillStatus(input: {
  sessionId: string;
  userId: string;
}): Promise<ObservationBenchPillStatus> {
  const sessionId = input.sessionId?.trim();
  if (!sessionId) throw new CoordinationError('Exact sessionId is required', 400, 'invalid_request');
  const [session] = await getSharedDb().select({
    id: voiceSessions.id,
    conversationId: voiceSessions.conversationId,
    userId: voiceSessions.userId,
    status: voiceSessions.status,
  }).from(voiceSessions).where(eq(voiceSessions.id, sessionId)).limit(1);
  if (!session || !session.conversationId) {
    throw new CoordinationError('Voice session not found', 404, 'voice_session_not_found');
  }
  if (
    session.userId !== input.userId
    || !isFounder({ id: input.userId } as Parameters<typeof isFounder>[0])
  ) {
    throw new CoordinationError('Status is limited to the founder’s own exact session', 403, 'session_owner_required');
  }
  let bench = await findObservationBenchBySessionId(sessionId);
  if (bench && session.status !== 'active') {
    await closeObservationBenchBySessionId({ sessionId, stale: true });
    bench = await findObservationBenchBySessionId(sessionId);
  }
  if (!bench) {
    return deriveObservationBenchPillStatus({
      conversationId: session.conversationId,
      sessionId,
      threadId: null,
      events: [],
      ended: false,
      nowMs: Date.now(),
    });
  }
  const view = await getCoordinationThread(bench.thread.id, 'luca-replit');
  const ended = view.events.some(event => payloadOf(event).kind === 'observation_window_ended');
  return deriveObservationBenchPillStatus({
    conversationId: session.conversationId,
    sessionId,
    threadId: bench.thread.id,
    events: view.events,
    ended,
    nowMs: Date.now(),
  });
}

export async function inviteBenchObservation(input: {
  threadId: string;
  observationEventId: string;
  conversationId: string;
  requestedBy?: 'david';
  _beforeAtomicWriteForTest?: () => Promise<void>;
}) {
  const allEvents = await getSharedDb()
    .select()
    .from(coordinationEvents)
    .where(eq(coordinationEvents.threadId, input.threadId))
    .orderBy(asc(coordinationEvents.sequence));
  if (allEvents.length === 0) {
    throw new CoordinationError('Observation bench not found', 404, 'thread_not_found');
  }
  const bench = assertBenchThread(allEvents);
  assertObservationWindowActive(allEvents);
  if (bench.conversationId !== input.conversationId) {
    throw new CoordinationError('Invitation conversation does not match the observation bench', 409, 'conversation_mismatch');
  }
  const observation = allEvents.find(event => event.id === input.observationEventId);
  if (!observation || payloadOf(observation).kind !== OBSERVATION_KIND) {
    throw new CoordinationError('Observation event not found in this bench', 404, 'observation_not_found');
  }
  const observationPayload = payloadOf(observation);
  const sourceIds = Array.isArray(observationPayload.sourceEventIds)
    ? observationPayload.sourceEventIds.filter((id): id is string => typeof id === 'string')
    : [];
  const sources = allEvents.filter(event => sourceIds.includes(event.id));
  if (
    sources.length !== sourceIds.length
    || sources.some(event => payloadOf(event).kind !== SOURCE_KIND)
  ) {
    throw new CoordinationError('Observation source references are invalid', 400, 'invalid_source_reference');
  }
  sources.forEach(event => assertValidSourceEvent(event, bench));
  const sourceStream = await getObservationBenchSourceStream(input.threadId, 'luca-replit');
  const sourceIntegrity = new Map(sourceStream.items.map(item => [item.eventId, item.integrity]));
  if (sourceIds.some(id => sourceIntegrity.get(id) !== 'verified')) {
    throw new CoordinationError(
      'Observation promotion requires unchanged canonical source evidence',
      409,
      'source_integrity_failed',
    );
  }
  const improvesObservationEventIds = Array.isArray(observationPayload.improvesObservationEventIds)
    ? observationPayload.improvesObservationEventIds.filter((id): id is string => typeof id === 'string')
    : [];
  const expectedSignature = observationSignature({
    actor: observation.actor as ObservationBenchActor,
    category: observationPayload.category as ObservationCategory,
    content: observation.content,
    sourceEventIds: sourceIds,
    improvesObservationEventIds,
  });
  if (!signatureMatches(expectedSignature, observationPayload.serverSignature)) {
    throw new CoordinationError('Observation provenance signature is invalid', 403, 'invalid_observation_provenance');
  }
  const sourceTimes = sources
    .map(event => payloadOf(event).sourceTimestamp)
    .filter((value): value is string => typeof value === 'string');
  const idempotencyKey = `bench-room-promotion:${input.threadId}:${observation.id}`;
  const [existing] = await getSharedDb().select()
    .from(coordinationEvents)
    .where(and(
      eq(coordinationEvents.actor, 'david'),
      eq(coordinationEvents.idempotencyKey, idempotencyKey),
    ))
    .limit(1);
  if (existing) {
    const [thread] = await getSharedDb().select()
      .from(coordinationThreads)
      .where(eq(coordinationThreads.id, input.threadId))
      .limit(1);
    return { thread, event: existing, deduplicated: true, deliveryState: 'not_applicable' as const };
  }

  await input._beforeAtomicWriteForTest?.();
  return getSharedDb().transaction(async tx => {
    const expectedSequence = allEvents.at(-1)!.sequence;
    const [reservedThread] = await tx.update(coordinationThreads)
      .set({ latestSequence: expectedSequence + 1, updatedAt: new Date() })
      .where(and(
        eq(coordinationThreads.id, input.threadId),
        eq(coordinationThreads.latestSequence, expectedSequence),
      ))
      .returning();
    if (!reservedThread) {
      throw new CoordinationError(
        'Observation bench sequence changed before founder promotion',
        409,
        'sequence_conflict',
      );
    }

    const [event] = await tx.insert(coordinationEvents).values({
      threadId: input.threadId,
      sequence: expectedSequence + 1,
      actor: 'david',
      recipientActor: observation.actor,
      eventType: 'comment',
      content: 'David explicitly promoted this sourced observation into the shared observation room.',
      idempotencyKey,
      causalParentEventId: observation.id,
      payload: {
        kind: INVITATION_KIND,
        stage: 'promoted_to_observation_room',
        requestedBy: input.requestedBy ?? 'david',
        authorizationState: 'canonical_founder_event',
        observationHat: observation.actor,
        observationEventId: observation.id,
        sourceEventIds: sourceIds,
        sourceTimes,
        conversationId: input.conversationId,
        sessionId: bench.sessionId,
        promotedAt: new Date().toISOString(),
        danielaContextState: 'not_injected',
      },
    }).returning();
    if (!event) throw new CoordinationError('Founder promotion insert returned no row', 500, 'insert_failed');

    const [thread] = await tx.update(coordinationThreads)
      .set({ latestGlobalSequence: event.globalSequence, updatedAt: new Date() })
      .where(eq(coordinationThreads.id, input.threadId))
      .returning();
    if (!thread) throw new CoordinationError('Founder promotion projection failed', 500, 'projection_failed');
    return { thread, event, deduplicated: false, deliveryState: 'not_applicable' as const };
  });
}