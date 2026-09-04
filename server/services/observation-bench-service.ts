import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  contextLineageEvents,
  coordinationEvents,
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

export async function startObservationBench(input: {
  sessionId: string;
  idempotencyKey: string;
}) {
  const sessionId = input.sessionId?.trim();
  if (!sessionId) {
    throw new CoordinationError('sessionId is required', 400, 'invalid_request');
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

  return createCoordinationThread({
    actor: 'luca-replit',
    intendedRecipient: otherHat('luca-replit'),
    title: `One Luca, two benches — ${conversationId}`,
    description: 'Shared read-only Daniela session evidence for Luca wearing the Replit and Claude Code hats.',
    content: `Observation bench opened for Daniela conversation ${conversationId}. Hat labels record provenance; they do not name separate Lucas.`,
    payload: {
      kind: BENCH_KIND,
      conversationId,
      sessionId: session.id,
      requestedBy: 'david',
      sourcePolicy: 'read_only_canonical_evidence',
      identityPolicy: 'one_luca_multiple_hats',
      danielaInjectionPolicy: 'never_injected_technical_observation_only',
    },
    createInboxDelivery: false,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function syncObservationBench(input: {
  threadId: string;
  actor: CoordinationActorId;
}) {
  assertBenchActor(input.actor);
  let view = await getCoordinationThread(input.threadId, input.actor);
  const bench = assertBenchThread(view.events);
  const captureActor = view.thread.originActor as CoordinationActorId;
  assertBenchActor(captureActor);
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
      return {
        sequence: event.sequence,
        eventId: event.id,
        envelope,
        canonical,
        integrity: canonical && actualDigest === envelope.sha256 ? 'verified' : 'unavailable_or_changed',
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
  if (!OBSERVATION_CATEGORIES.includes(input.category)) {
    throw new CoordinationError('Observation category is invalid', 400, 'invalid_observation_category');
  }
  const view = await getCoordinationThread(input.threadId, input.actor);
  assertBenchThread(view.events);
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
    actor: input.actor,
    category: input.category,
    content: input.content,
    sourceEventIds: input.sourceEventIds,
    improvesObservationEventIds: input.improvesObservationEventIds ?? [],
  };
  return appendCoordinationEvent({
    threadId: input.threadId,
    actor: input.actor,
    eventType: 'comment',
    content: input.content,
    idempotencyKey: input.idempotencyKey,
    expectedSequence: input.expectedSequence,
    causalParentEventId: input.sourceEventIds[0],
    payload: {
      kind: OBSERVATION_KIND,
      hat: input.actor,
      category: input.category,
      sourceEventIds: input.sourceEventIds,
      improvesObservationEventIds: input.improvesObservationEventIds ?? [],
      observedAt: new Date().toISOString(),
      injectionState: 'bench_only',
      serverSignature: observationSignature(signatureInput),
    },
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

export async function inviteBenchObservation(input: {
  threadId: string;
  observationEventId: string;
  conversationId: string;
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
  return appendCoordinationEvent({
    threadId: input.threadId,
    actor: observation.actor as ObservationBenchActor,
    eventType: 'comment',
    content: 'David explicitly promoted this sourced observation into the shared observation room.',
    idempotencyKey: `bench-room-promotion:${input.threadId}:${observation.id}`,
    expectedSequence: allEvents.at(-1)!.sequence,
    causalParentEventId: observation.id,
    payload: {
      kind: INVITATION_KIND,
      stage: 'promoted_to_observation_room',
      requestedBy: 'david',
      observationHat: observation.actor,
      observationEventId: observation.id,
      sourceEventIds: sourceIds,
      sourceTimes,
      conversationId: input.conversationId,
      sessionId: bench.sessionId,
      promotedAt: new Date().toISOString(),
      danielaContextState: 'not_injected',
    },
  });
}