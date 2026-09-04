import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import {
  contextLineageEvents,
  coordinationActorFeedCursors,
  coordinationAdapterDeliveries,
  coordinationEvents,
  coordinationThreads,
  voicePipelineEvents,
  voiceSessions,
  type CoordinationActorId,
  type CoordinationEvent,
} from '@shared/schema';
import { getSharedDb } from '../db';
import {
  appendCoordinationEvent,
  CoordinationError,
  createCoordinationThread,
  getCoordinationThread,
} from './coordination-ledger-service';

export const OBSERVATION_BENCH_ACTORS = ['luca-replit', 'luca-claude-code'] as const;
export type ObservationBenchActor = typeof OBSERVATION_BENCH_ACTORS[number];
export const OBSERVATION_CATEGORIES = ['noticed', 'missed', 'cross_hat_improvement'] as const;
export type ObservationCategory = typeof OBSERVATION_CATEGORIES[number];

const BENCH_KIND = 'dual_luca_observation_bench';
const ARM_KIND = 'dual_luca_observation_arm';
const SOURCE_KIND = 'observation_source';
const OBSERVATION_KIND = 'bench_observation';
const INVITATION_KIND = 'observation_invitation';

type SourceEnvelope = {
  kind: typeof SOURCE_KIND;
  sourceType: 'voice_pipeline' | 'context_lineage';
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
};

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

export async function startObservationBench(input: {
  sessionId: string;
  armThreadId: string;
  idempotencyKey: string;
  _beforeAtomicStartForTest?: () => Promise<void>;
}) {
  const sessionId = input.sessionId?.trim();
  const armThreadId = input.armThreadId?.trim();
  if (!sessionId || !armThreadId || !input.idempotencyKey?.trim()) {
    throw new CoordinationError('sessionId, armThreadId, and idempotencyKey are required', 400, 'invalid_request');
  }
  const [existingStart] = await getSharedDb().select()
    .from(coordinationEvents)
    .where(and(
      eq(coordinationEvents.actor, 'luca-replit'),
      eq(coordinationEvents.idempotencyKey, input.idempotencyKey),
    ))
    .limit(1);
  if (existingStart && payloadOf(existingStart).kind === BENCH_KIND) {
    const [thread] = await getSharedDb().select()
      .from(coordinationThreads)
      .where(eq(coordinationThreads.id, existingStart.threadId))
      .limit(1);
    return {
      thread,
      event: existingStart,
      deduplicated: true,
      deliveryState: 'not_applicable' as const,
      armThreadId,
    };
  }
  const [session] = await getSharedDb()
    .select({
      id: voiceSessions.id,
      conversationId: voiceSessions.conversationId,
      status: voiceSessions.status,
    })
    .from(voiceSessions)
    .where(eq(voiceSessions.id, sessionId))
    .limit(1);
  if (!session || !session.conversationId || session.status !== 'active') {
    throw new CoordinationError(
      'An active Daniela voice session is required before opening an observation bench',
      409,
      'voice_session_not_active',
    );
  }
  const conversationId = session.conversationId;
  const armView = await getCoordinationThread(armThreadId, 'david');
  if (
    payloadOf(armView.events[0]).kind !== ARM_KIND
    || armView.events.some(event => payloadOf(event).kind === 'observation_arm_bound')
  ) {
    throw new CoordinationError('A currently armed two-hat observation record is required', 409, 'observation_arm_unavailable');
  }

  await input._beforeAtomicStartForTest?.();
  return getSharedDb().transaction(async tx => {
    const armSequence = armView.thread.latestSequence;
    const [reservedArm] = await tx.update(coordinationThreads)
      .set({ latestSequence: armSequence + 1, updatedAt: new Date() })
      .where(and(
        eq(coordinationThreads.id, armThreadId),
        eq(coordinationThreads.latestSequence, armSequence),
      ))
      .returning();
    if (!reservedArm) throw new CoordinationError('Observation arm changed before binding', 409, 'sequence_conflict');

    const [thread] = await tx.insert(coordinationThreads).values({
      title: `One Luca, two benches — ${conversationId}`,
      description: 'Shared read-only Daniela session evidence for Luca wearing the Replit and Claude Code hats.',
      originActor: 'luca-replit',
      intendedRecipient: otherHat('luca-replit'),
      priority: 'normal',
      state: 'created',
      latestSequence: 0,
      latestGlobalSequence: 0,
    }).returning();
    if (!thread) throw new CoordinationError('Observation bench insert returned no row', 500, 'insert_failed');

    const [event] = await tx.insert(coordinationEvents).values({
      threadId: thread.id,
      sequence: 1,
      actor: 'luca-replit',
      recipientActor: otherHat('luca-replit'),
      eventType: 'created',
      content: `Observation bench opened for Daniela conversation ${conversationId}. Hat labels record provenance; they do not name separate Lucas.`,
      idempotencyKey: input.idempotencyKey,
      payload: {
        kind: BENCH_KIND,
        conversationId,
        sessionId: session.id,
        armThreadId,
        requestedBy: 'david',
        sourcePolicy: 'read_only_canonical_evidence',
        identityPolicy: 'one_luca_multiple_hats',
        danielaInjectionPolicy: 'never_injected_technical_observation_only',
      },
    }).returning();
    if (!event) throw new CoordinationError('Observation bench event insert returned no row', 500, 'insert_failed');
    const [updatedThread] = await tx.update(coordinationThreads)
      .set({ latestSequence: 1, latestGlobalSequence: event.globalSequence, updatedAt: new Date() })
      .where(eq(coordinationThreads.id, thread.id))
      .returning();

    const [boundEvent] = await tx.insert(coordinationEvents).values({
      threadId: armThreadId,
      sequence: armSequence + 1,
      actor: 'david',
      recipientActor: 'luca-replit',
      eventType: 'comment',
      content: `David bound both armed Luca hats to Daniela session ${session.id}.`,
      idempotencyKey: `observation-arm-bound:${armThreadId}:${thread.id}`,
      payload: {
        kind: 'observation_arm_bound',
        benchThreadId: thread.id,
        sessionId: session.id,
        conversationId,
        boundBy: 'david',
        danielaContextState: 'not_injected',
      },
    }).returning();
    if (!boundEvent || !updatedThread) throw new CoordinationError('Atomic arm binding failed', 500, 'projection_failed');
    await tx.update(coordinationThreads)
      .set({ latestGlobalSequence: boundEvent.globalSequence, updatedAt: new Date() })
      .where(eq(coordinationThreads.id, armThreadId));
    return { thread: updatedThread, event, deduplicated: false, deliveryState: 'not_applicable' as const, armThreadId };
  });
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

  const sources: Array<Omit<SourceEnvelope, 'kind' | 'capturedAt'>> = [
    ...pipeline.map(event => ({
      sourceType: 'voice_pipeline' as const,
      sourceId: event.id,
      conversationId: bench.conversationId,
      sessionId: bench.sessionId,
      sourceTimestamp: event.createdAt.toISOString(),
      sha256: digest({ eventType: event.eventType, eventData: event.eventData }),
      eventType: event.eventType,
    })),
    ...lineage.map(event => ({
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
      }).from(contextLineageEvents).where(inArray(contextLineageEvents.id, lineageIds))
    : [];
  const pipelineById = new Map(canonicalPipeline.map(row => [row.id, row]));
  const lineageById = new Map(canonicalLineage.map(row => [row.id, row]));
  return {
    thread: view.thread,
    items: sourceEvents.map(event => {
      const envelope = payloadOf(event);
      const sourceId = String(envelope.sourceId);
      const canonical = envelope.sourceType === 'voice_pipeline'
        ? pipelineById.get(sourceId)
        : lineageById.get(sourceId);
      const actualDigest = !canonical
        ? null
        : envelope.sourceType === 'voice_pipeline'
          ? digest({
              eventType: (canonical as typeof canonicalPipeline[number]).eventType,
              eventData: (canonical as typeof canonicalPipeline[number]).eventData,
            })
          : (canonical as typeof canonicalLineage[number]).payloadSha256 ?? digest({
              sourceRoute: (canonical as typeof canonicalLineage[number]).sourceRoute,
              eventType: (canonical as typeof canonicalLineage[number]).eventType,
              deliveryChannel: (canonical as typeof canonicalLineage[number]).deliveryChannel,
              deliveryStatus: (canonical as typeof canonicalLineage[number]).deliveryStatus,
              payloadText: (canonical as typeof canonicalLineage[number]).payloadText,
              payloadJson: (canonical as typeof canonicalLineage[number]).payloadJson,
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
          : (canonical as typeof canonicalLineage[number]).sessionId === envelope.sessionId
            && (canonical as typeof canonicalLineage[number]).observedAt.toISOString() === envelope.sourceTimestamp;
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
            const feedCursor = cursorByActor.get(hat);
            const ageMs = feedCursor ? Date.now() - feedCursor.updatedAt.getTime() : null;
            const connection = ageMs === null
              ? 'never_connected'
              : ageMs <= 60_000
                ? 'connected'
                : ageMs <= 300_000 ? 'degraded' : 'disconnected';
            return [hat, {
              connection,
              connectionEvidence: 'coordination_feed_cursor',
              authenticatedAccess: feedCursor ? 'observed' : 'not_observed',
              cursor: feedCursor?.acknowledgedGlobalSequence ?? 0,
              replayPending: (feedCursor?.acknowledgedGlobalSequence ?? 0) < thread.latestGlobalSequence,
              replayFromGlobalSequence: (feedCursor?.acknowledgedGlobalSequence ?? 0) + 1,
              lastEventAt: hatEvent?.createdAt ?? null,
              lastContactAt: feedCursor?.updatedAt ?? null,
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
      .where(eq(voiceSessions.status, 'active'))
      .orderBy(desc(voiceSessions.startedAt))
      .limit(50),
  };
}

export async function endObservationBench(input: { threadId: string }) {
  const view = await getCoordinationThread(input.threadId, 'luca-replit');
  assertBenchThread(view.events);
  if (
    ['completed', 'outcome_acknowledged'].includes(view.thread.state)
    || view.events.some(event => payloadOf(event).kind === 'observation_window_ended')
  ) {
    return { thread: view.thread, deduplicated: true };
  }
  const sourceCount = view.events.filter(event => payloadOf(event).kind === SOURCE_KIND).length;
  return getSharedDb().transaction(async tx => {
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
      actor: 'david',
      recipientActor: 'luca-replit',
      eventType: 'comment',
      content: 'David ended this technical observation window.',
      idempotencyKey: `bench-window-ended:${input.threadId}`,
      payload: {
        kind: 'observation_window_ended',
        endedBy: 'david',
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