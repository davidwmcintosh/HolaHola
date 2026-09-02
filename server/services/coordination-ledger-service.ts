import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import {
  COORDINATION_ACTOR_IDS,
  COORDINATION_EVENT_TYPES,
  COORDINATION_EVIDENCE_TYPES,
  coordinationAdapterDeliveries,
  coordinationEvents,
  coordinationThreads,
  type CoordinationActorId,
  type CoordinationEvent,
  type CoordinationEventType,
  type CoordinationEvidenceReference,
  type CoordinationThread,
  type CoordinationThreadState,
} from '@shared/schema';
import { getSharedDb } from '../db';

const ACTOR_SET = new Set<string>(COORDINATION_ACTOR_IDS);
const EVENT_TYPE_SET = new Set<string>(COORDINATION_EVENT_TYPES);
const EVIDENCE_TYPE_SET = new Set<string>(COORDINATION_EVIDENCE_TYPES);
const PARTICIPANT_EVENT_TYPES = new Set<CoordinationEventType>([
  'progress',
  'evidence_added',
  'blocked',
  'completed',
]);

const DIRECT_ACTOR_EVENT_PERMISSIONS: Record<
  'luca-holahola' | 'alden' | 'daniela',
  ReadonlySet<CoordinationEventType>
> = {
  'luca-holahola': new Set(['reassigned', 'comment']),
  alden: new Set([
    'accepted', 'progress', 'evidence_added', 'blocked', 'completed',
    'outcome_acknowledged', 'reassigned', 'comment',
  ]),
  daniela: new Set([
    'accepted', 'progress', 'evidence_added', 'blocked', 'completed', 'comment',
  ]),
};

export function canCoordinationActorPerform(
  actor: CoordinationActorId,
  eventType: CoordinationEventType,
): boolean {
  const permissions = DIRECT_ACTOR_EVENT_PERMISSIONS[actor as keyof typeof DIRECT_ACTOR_EVENT_PERMISSIONS];
  return !permissions || permissions.has(eventType);
}

function assertCoordinationActorCanCreate(actor: CoordinationActorId): void {
  if (actor === 'alden' || actor === 'daniela') {
    throw new CoordinationError(
      `${actor} may receive and update coordination work but cannot originate threads`,
      403,
      'operation_not_allowed',
    );
  }
}

export class CoordinationError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CoordinationError';
  }
}

export type CoordinationCreateInput = {
  actor: CoordinationActorId;
  intendedRecipient: CoordinationActorId;
  title: string;
  description: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  content?: string;
  idempotencyKey: string;
  sourceReference?: CoordinationEvidenceReference;
};

export type CoordinationAppendInput = {
  threadId: string;
  actor: CoordinationActorId;
  eventType: CoordinationEventType;
  content: string;
  idempotencyKey: string;
  expectedSequence: number;
  recipientActor?: CoordinationActorId;
  payload?: Record<string, unknown>;
  evidence?: CoordinationEvidenceReference[];
  causalParentEventId?: string;
};

export type CoordinationMutationResult = {
  thread: CoordinationThread;
  event: CoordinationEvent;
  deduplicated: boolean;
  deliveryState: 'not_applicable' | 'pending' | 'delivered' | 'failed';
};

export function isCoordinationActorId(value: unknown): value is CoordinationActorId {
  return typeof value === 'string' && ACTOR_SET.has(value);
}

export function isCoordinationEventType(value: unknown): value is CoordinationEventType {
  return typeof value === 'string' && EVENT_TYPE_SET.has(value);
}

function requiredText(value: string, field: string, maxLength: number): string {
  const normalized = value?.trim();
  if (!normalized) throw new CoordinationError(`${field} is required`, 400, 'invalid_request');
  if (normalized.length > maxLength) {
    throw new CoordinationError(`${field} exceeds ${maxLength} characters`, 400, 'invalid_request');
  }
  return normalized;
}

function validateIdempotencyKey(value: string): string {
  const normalized = requiredText(value, 'idempotencyKey', 255);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,254}$/.test(normalized)) {
    throw new CoordinationError(
      'idempotencyKey must be 8-255 safe characters',
      400,
      'invalid_idempotency_key',
    );
  }
  return normalized;
}

function validateEvidenceReference(reference: CoordinationEvidenceReference): CoordinationEvidenceReference {
  if (!reference || !EVIDENCE_TYPE_SET.has(reference.type)) {
    throw new CoordinationError('Unsupported evidence type', 400, 'invalid_evidence');
  }
  const provider = requiredText(reference.provider, 'evidence.provider', 80);
  const identifier = requiredText(reference.identifier, 'evidence.identifier', 1000);
  if (reference.type === 'commit' && !/^[0-9a-f]{40,64}$/i.test(identifier)) {
    throw new CoordinationError(
      'Commit evidence requires an immutable hexadecimal commit identifier',
      400,
      'invalid_evidence',
    );
  }
  if (reference.type === 'external_url') {
    let parsed: URL;
    try {
      parsed = new URL(identifier);
    } catch {
      throw new CoordinationError('External URL evidence is invalid', 400, 'invalid_evidence');
    }
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      throw new CoordinationError('External URL evidence must use HTTPS or HTTP', 400, 'invalid_evidence');
    }
  }
  if (reference.digest && !/^[A-Za-z0-9:+/=_-]{16,255}$/.test(reference.digest)) {
    throw new CoordinationError('Evidence digest is malformed', 400, 'invalid_evidence');
  }
  return {
    type: reference.type,
    provider,
    identifier,
    ...(reference.label ? { label: requiredText(reference.label, 'evidence.label', 300) } : {}),
    ...(reference.digest ? { digest: reference.digest } : {}),
    ...(reference.metadata ? { metadata: reference.metadata } : {}),
  };
}

function assertParticipant(thread: CoordinationThread, actor: CoordinationActorId): void {
  if (actor === 'luca-holahola') return;
  if (
    actor !== thread.originActor
    && actor !== thread.intendedRecipient
    && actor !== thread.currentOwner
  ) {
    throw new CoordinationError('Actor is not a participant in this thread', 403, 'not_participant');
  }
}

function stateForEvent(
  thread: CoordinationThread,
  eventType: CoordinationEventType,
): CoordinationThreadState {
  if (eventType === 'progress' || eventType === 'evidence_added') return 'in_progress';
  if (eventType === 'comment') return thread.state;
  if (eventType === 'delivered') {
    return ['created', 'reassigned', 'reopened'].includes(thread.state)
      ? 'delivered'
      : thread.state;
  }
  if (eventType === 'created') return 'created';
  return eventType;
}

function validateLifecycle(
  thread: CoordinationThread,
  input: CoordinationAppendInput,
): void {
  const { actor, eventType } = input;
  if (!canCoordinationActorPerform(actor, eventType)) {
    throw new CoordinationError(
      `${actor} is not allowed to perform ${eventType}`,
      403,
      'operation_not_allowed',
    );
  }
  if (eventType === 'created') {
    throw new CoordinationError('created is only valid during thread creation', 400, 'invalid_transition');
  }
  if (eventType === 'delivered') {
    if (actor !== 'coordination-system') {
      throw new CoordinationError('delivered is reserved for adapters', 403, 'invalid_transition');
    }
    return;
  }

  if (eventType === 'reassigned' && actor === 'alden' && actor !== thread.currentOwner) {
    throw new CoordinationError(
      'Alden may only reassign work he currently owns',
      403,
      'not_owner',
    );
  }

  assertParticipant(thread, actor);

  if (eventType === 'accepted') {
    if (actor !== thread.intendedRecipient || thread.currentOwner) {
      throw new CoordinationError(
        'Only the intended recipient may accept unowned work',
        409,
        'invalid_transition',
        { currentOwner: thread.currentOwner, intendedRecipient: thread.intendedRecipient },
      );
    }
    if (!['created', 'delivered', 'reopened', 'reassigned'].includes(thread.state)) {
      throw new CoordinationError('Thread cannot be accepted from its current state', 409, 'invalid_transition');
    }
    return;
  }

  if (PARTICIPANT_EVENT_TYPES.has(eventType)) {
    if (!thread.currentOwner || actor !== thread.currentOwner) {
      throw new CoordinationError('Only the current owner may update active work', 403, 'not_owner');
    }
    if (['completed', 'outcome_acknowledged'].includes(thread.state)) {
      throw new CoordinationError('Completed work must be reopened before further updates', 409, 'invalid_transition');
    }
    return;
  }

  if (eventType === 'outcome_acknowledged') {
    if (actor !== thread.originActor) {
      throw new CoordinationError('Only the origin actor may acknowledge the outcome', 403, 'invalid_transition');
    }
    if (thread.state !== 'completed') {
      throw new CoordinationError('Only completed work can be acknowledged', 409, 'invalid_transition');
    }
    return;
  }

  if (eventType === 'reopened') {
    if (actor !== thread.originActor) {
      throw new CoordinationError('Only the origin actor may reopen work', 403, 'invalid_transition');
    }
    if (!['blocked', 'completed', 'outcome_acknowledged'].includes(thread.state)) {
      throw new CoordinationError('Thread cannot be reopened from its current state', 409, 'invalid_transition');
    }
    return;
  }

  if (eventType === 'reassigned') {
    if (
      actor !== 'luca-holahola'
      && actor !== thread.originActor
      && actor !== thread.currentOwner
    ) {
      throw new CoordinationError(
        'Only Luca [HolaHola], the origin actor, or the current owner may reassign work',
        403,
        'invalid_transition',
      );
    }
    if (!input.recipientActor || input.recipientActor === 'coordination-system') {
      throw new CoordinationError('reassigned requires a valid recipientActor', 400, 'invalid_transition');
    }
  }
}

async function findIdempotentEvent(actor: CoordinationActorId, idempotencyKey: string) {
  const [existing] = await getSharedDb()
    .select()
    .from(coordinationEvents)
    .where(and(
      eq(coordinationEvents.actor, actor),
      eq(coordinationEvents.idempotencyKey, idempotencyKey),
    ))
    .limit(1);
  return existing ?? null;
}

async function mutationResultFromExisting(event: CoordinationEvent): Promise<CoordinationMutationResult> {
  const [thread] = await getSharedDb()
    .select()
    .from(coordinationThreads)
    .where(eq(coordinationThreads.id, event.threadId))
    .limit(1);
  if (!thread) throw new CoordinationError('Idempotent event references a missing thread', 500, 'ledger_corrupt');
  const [delivery] = await getSharedDb()
    .select({ status: coordinationAdapterDeliveries.status })
    .from(coordinationAdapterDeliveries)
    .where(eq(coordinationAdapterDeliveries.eventId, event.id))
    .limit(1);
  return {
    thread,
    event,
    deduplicated: true,
    deliveryState: delivery?.status ?? 'not_applicable',
  };
}

function shouldCreateInboxDelivery(actor: CoordinationActorId): boolean {
  return actor === 'luca-replit' || actor === 'luca-claude-code';
}

export async function createCoordinationThread(
  rawInput: CoordinationCreateInput,
): Promise<CoordinationMutationResult> {
  const input = {
    ...rawInput,
    title: requiredText(rawInput.title, 'title', 300),
    description: requiredText(rawInput.description, 'description', 20_000),
    content: requiredText(rawInput.content || rawInput.description, 'content', 20_000),
    idempotencyKey: validateIdempotencyKey(rawInput.idempotencyKey),
    sourceReference: rawInput.sourceReference
      ? validateEvidenceReference(rawInput.sourceReference)
      : undefined,
  };
  if (!isCoordinationActorId(input.actor) || input.actor === 'coordination-system') {
    throw new CoordinationError('Invalid origin actor', 400, 'invalid_actor');
  }
  assertCoordinationActorCanCreate(input.actor);
  if (!isCoordinationActorId(input.intendedRecipient) || input.intendedRecipient === 'coordination-system') {
    throw new CoordinationError('Invalid intended recipient', 400, 'invalid_actor');
  }

  const existing = await findIdempotentEvent(input.actor, input.idempotencyKey);
  if (existing) return mutationResultFromExisting(existing);

  try {
    return await getSharedDb().transaction(async (tx) => {
      const [thread] = await tx.insert(coordinationThreads).values({
        title: input.title,
        description: input.description,
        originActor: input.actor,
        intendedRecipient: input.intendedRecipient,
        priority: input.priority ?? 'normal',
        state: 'created',
        latestSequence: 0,
        latestGlobalSequence: 0,
        sourceReference: input.sourceReference,
      }).returning();
      if (!thread) throw new CoordinationError('Thread insert returned no row', 500, 'insert_failed');

      const [event] = await tx.insert(coordinationEvents).values({
        threadId: thread.id,
        sequence: 1,
        actor: input.actor,
        recipientActor: input.intendedRecipient,
        eventType: 'created',
        content: input.content,
        payload: {},
        evidence: input.sourceReference ? [input.sourceReference] : [],
        idempotencyKey: input.idempotencyKey,
      }).returning();
      if (!event) throw new CoordinationError('Created event insert returned no row', 500, 'insert_failed');

      const [updatedThread] = await tx.update(coordinationThreads).set({
        latestSequence: 1,
        latestGlobalSequence: event.globalSequence,
        updatedAt: new Date(),
      }).where(eq(coordinationThreads.id, thread.id)).returning();
      if (!updatedThread) throw new CoordinationError('Thread projection update failed', 500, 'projection_failed');

      let deliveryState: CoordinationMutationResult['deliveryState'] = 'not_applicable';
      if (shouldCreateInboxDelivery(input.intendedRecipient)) {
        await tx.insert(coordinationAdapterDeliveries).values({
          eventId: event.id,
          adapterName: 'agent_notes',
          targetActor: input.intendedRecipient,
          status: 'pending',
        });
        deliveryState = 'pending';
      }
      return { thread: updatedThread, event, deduplicated: false, deliveryState };
    });
  } catch (error) {
    const wonRace = await findIdempotentEvent(input.actor, input.idempotencyKey);
    if (wonRace) return mutationResultFromExisting(wonRace);
    throw error;
  }
}

export async function appendCoordinationEvent(
  rawInput: CoordinationAppendInput,
): Promise<CoordinationMutationResult> {
  const input: CoordinationAppendInput = {
    ...rawInput,
    threadId: requiredText(rawInput.threadId, 'threadId', 255),
    content: requiredText(rawInput.content, 'content', 20_000),
    idempotencyKey: validateIdempotencyKey(rawInput.idempotencyKey),
    evidence: (rawInput.evidence ?? []).map(validateEvidenceReference),
    payload: rawInput.payload ?? {},
  };
  if (!isCoordinationActorId(input.actor)) {
    throw new CoordinationError('Invalid actor', 400, 'invalid_actor');
  }
  if (!isCoordinationEventType(input.eventType)) {
    throw new CoordinationError('Invalid event type', 400, 'invalid_event_type');
  }
  if (!Number.isInteger(input.expectedSequence) || input.expectedSequence < 1) {
    throw new CoordinationError('expectedSequence must be a positive integer', 400, 'invalid_sequence');
  }

  const existing = await findIdempotentEvent(input.actor, input.idempotencyKey);
  if (existing) {
    if (existing.threadId !== input.threadId) {
      throw new CoordinationError('Idempotency key was already used for another thread', 409, 'idempotency_conflict');
    }
    return mutationResultFromExisting(existing);
  }

  try {
    return await getSharedDb().transaction(async (tx) => {
      const [thread] = await tx
        .select()
        .from(coordinationThreads)
        .where(eq(coordinationThreads.id, input.threadId))
        .limit(1);
      if (!thread) throw new CoordinationError('Coordination thread not found', 404, 'thread_not_found');
      validateLifecycle(thread, input);

      if (input.eventType === 'completed' && (input.evidence?.length ?? 0) === 0) {
        const [priorEvidence] = await tx
          .select({ id: coordinationEvents.id })
          .from(coordinationEvents)
          .where(and(
            eq(coordinationEvents.threadId, thread.id),
            eq(coordinationEvents.eventType, 'evidence_added'),
          ))
          .limit(1);
        if (!priorEvidence) {
          throw new CoordinationError(
            'Completion requires immutable evidence',
            400,
            'completion_evidence_required',
          );
        }
      }

      const nextSequence = thread.latestSequence + 1;
      const [reservedThread] = await tx
        .update(coordinationThreads)
        .set({
          latestSequence: nextSequence,
          updatedAt: new Date(),
        })
        .where(and(
          eq(coordinationThreads.id, thread.id),
          eq(coordinationThreads.latestSequence, input.expectedSequence),
        ))
        .returning();
      if (!reservedThread) {
        const [current] = await tx
          .select({ latestSequence: coordinationThreads.latestSequence })
          .from(coordinationThreads)
          .where(eq(coordinationThreads.id, thread.id))
          .limit(1);
        throw new CoordinationError(
          'Thread sequence changed',
          409,
          'sequence_conflict',
          { currentSequence: current?.latestSequence ?? null },
        );
      }

      const [event] = await tx.insert(coordinationEvents).values({
        threadId: thread.id,
        sequence: nextSequence,
        actor: input.actor,
        recipientActor: input.recipientActor ?? null,
        eventType: input.eventType,
        content: input.content,
        payload: input.payload ?? {},
        evidence: input.evidence ?? [],
        causalParentEventId: input.causalParentEventId ?? null,
        idempotencyKey: input.idempotencyKey,
      }).returning();
      if (!event) throw new CoordinationError('Event insert returned no row', 500, 'insert_failed');

      const newRecipient = input.eventType === 'reassigned'
        ? input.recipientActor!
        : thread.intendedRecipient;
      const newOwner = input.eventType === 'accepted'
        ? input.actor
        : input.eventType === 'reassigned' || input.eventType === 'reopened'
          ? null
          : thread.currentOwner;
      const [updatedThread] = await tx
        .update(coordinationThreads)
        .set({
          intendedRecipient: newRecipient,
          currentOwner: newOwner,
          state: stateForEvent(thread, input.eventType),
          latestGlobalSequence: event.globalSequence,
          updatedAt: new Date(),
        })
        .where(eq(coordinationThreads.id, thread.id))
        .returning();
      if (!updatedThread) throw new CoordinationError('Thread projection update failed', 500, 'projection_failed');

      let deliveryState: CoordinationMutationResult['deliveryState'] = 'not_applicable';
      if (
        ['reassigned', 'reopened'].includes(input.eventType)
        && shouldCreateInboxDelivery(newRecipient as CoordinationActorId)
      ) {
        await tx.insert(coordinationAdapterDeliveries).values({
          eventId: event.id,
          adapterName: 'agent_notes',
          targetActor: newRecipient,
          status: 'pending',
        });
        deliveryState = 'pending';
      }
      return { thread: updatedThread, event, deduplicated: false, deliveryState };
    });
  } catch (error) {
    const wonRace = await findIdempotentEvent(input.actor, input.idempotencyKey);
    if (wonRace && wonRace.threadId === input.threadId) {
      return mutationResultFromExisting(wonRace);
    }
    throw error;
  }
}

export async function getCoordinationThread(
  threadId: string,
  actor: CoordinationActorId,
  afterSequence = 0,
) {
  const [thread] = await getSharedDb()
    .select()
    .from(coordinationThreads)
    .where(eq(coordinationThreads.id, threadId))
    .limit(1);
  if (!thread) throw new CoordinationError('Coordination thread not found', 404, 'thread_not_found');
  assertParticipant(thread, actor);
  const events = await getSharedDb()
    .select()
    .from(coordinationEvents)
    .where(and(
      eq(coordinationEvents.threadId, threadId),
      gt(coordinationEvents.sequence, afterSequence),
    ))
    .orderBy(asc(coordinationEvents.sequence));
  return { thread, events };
}

export async function listCoordinationFeed(
  actor: CoordinationActorId,
  sinceGlobalSequence = 0,
  limit = 50,
) {
  const boundedLimit = Math.min(Math.max(limit, 1), 100);
  const items = await getSharedDb()
    .select({ thread: coordinationThreads, event: coordinationEvents })
    .from(coordinationEvents)
    .innerJoin(coordinationThreads, eq(coordinationThreads.id, coordinationEvents.threadId))
    .where(and(
      gt(coordinationEvents.globalSequence, sinceGlobalSequence),
      actor === 'luca-holahola'
        ? sql`true`
        : or(
          eq(coordinationThreads.originActor, actor),
          eq(coordinationThreads.intendedRecipient, actor),
          eq(coordinationThreads.currentOwner, actor),
        ),
    ))
    .orderBy(asc(coordinationEvents.globalSequence))
    .limit(boundedLimit);
  return {
    items,
    cursor: {
      previous: sinceGlobalSequence,
      next: items.at(-1)?.event.globalSequence ?? sinceGlobalSequence,
      hasMore: items.length === boundedLimit,
    },
  };
}

export async function listPendingCoordinationDeliveries(limit = 20) {
  return getSharedDb()
    .select()
    .from(coordinationAdapterDeliveries)
    .where(and(
      inArray(coordinationAdapterDeliveries.status, ['pending', 'failed']),
      lte(coordinationAdapterDeliveries.nextAttemptAt, new Date()),
    ))
    .orderBy(asc(coordinationAdapterDeliveries.nextAttemptAt))
    .limit(Math.min(Math.max(limit, 1), 100));
}

export async function markCoordinationDeliveryFailed(id: string, error: string, attemptCount: number) {
  const delayMs = Math.min(60 * 60 * 1000, 5_000 * (2 ** Math.min(attemptCount, 8)));
  await getSharedDb().update(coordinationAdapterDeliveries).set({
    status: 'failed',
    attemptCount,
    lastError: error.slice(0, 2_000),
    nextAttemptAt: new Date(Date.now() + delayMs),
    updatedAt: new Date(),
  }).where(eq(coordinationAdapterDeliveries.id, id));
}

export async function markCoordinationDeliverySucceeded(
  id: string,
  externalReference: string,
  attemptCount: number,
) {
  const [delivery] = await getSharedDb().update(coordinationAdapterDeliveries).set({
    status: 'delivered',
    attemptCount,
    lastError: null,
    externalReference,
    deliveredAt: new Date(),
    updatedAt: new Date(),
  }).where(and(
    eq(coordinationAdapterDeliveries.id, id),
    isNull(coordinationAdapterDeliveries.deliveredAt),
  )).returning();
  return delivery ?? null;
}

export async function getCoordinationDeliveryContext(eventId: string) {
  const [row] = await getSharedDb()
    .select({ event: coordinationEvents, thread: coordinationThreads })
    .from(coordinationEvents)
    .innerJoin(coordinationThreads, eq(coordinationThreads.id, coordinationEvents.threadId))
    .where(eq(coordinationEvents.id, eventId))
    .limit(1);
  return row ?? null;
}
