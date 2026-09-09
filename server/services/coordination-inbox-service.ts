import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  max,
  notLike,
  or,
  sql,
} from 'drizzle-orm';
import {
  COORDINATION_ACTOR_IDS,
  COORDINATION_EVENT_TYPES,
  agentNotes,
  coordinationAdapterDeliveries,
  coordinationEvents,
  coordinationInboxActivation,
  coordinationInboxCursors,
  coordinationInboxItems,
  coordinationThreads,
  sharedSpecDocuments,
  sharedSpecPublications,
  sharedSpecReviews,
  sharedSpecRevisions,
  type CoordinationActorId,
  type CoordinationEvent,
  type CoordinationEventType,
  type CoordinationThread,
} from '@shared/schema';
import { getSharedDb } from '../db';
import { CoordinationError, isCoordinationActorId } from './coordination-ledger-service';

export const COORDINATION_INBOX_ACTIVATION_ID = 'canonical';
export const COORDINATION_INBOX_SCHEMA_VERSION = 1;
export const COORDINATION_INBOX_RECIPIENT_RULE_VERSION = 1;

type ThreadRecipientState = Pick<
  CoordinationThread,
  'originActor' | 'intendedRecipient' | 'currentOwner' | 'sourceReference'
>;

type RecipientContext = {
  eventType: CoordinationEventType;
  actor: CoordinationActorId;
  explicitRecipient?: CoordinationActorId | null;
  preThread: ThreadRecipientState;
  postThread: ThreadRecipientState;
};

const RECIPIENT_RULES: Record<
  CoordinationEventType,
  (context: RecipientContext) => Array<CoordinationActorId | null | undefined>
> = {
  created: ({ postThread }) => [postThread.intendedRecipient as CoordinationActorId],
  delivered: () => [],
  accepted: ({ preThread }) => [preThread.originActor as CoordinationActorId],
  progress: ({ preThread }) => [preThread.originActor as CoordinationActorId],
  evidence_added: ({ preThread }) => [preThread.originActor as CoordinationActorId],
  blocked: ({ preThread }) => [preThread.originActor as CoordinationActorId],
  completed: ({ preThread }) => [preThread.originActor as CoordinationActorId],
  outcome_acknowledged: ({ preThread }) => [preThread.currentOwner as CoordinationActorId | null],
  reopened: ({ explicitRecipient, postThread, preThread }) => [
    explicitRecipient ?? postThread.intendedRecipient as CoordinationActorId,
    preThread.originActor as CoordinationActorId,
  ],
  reassigned: ({ explicitRecipient, preThread }) => [
    explicitRecipient,
    preThread.originActor as CoordinationActorId,
  ],
  comment: ({ explicitRecipient }) => [explicitRecipient],
};

const RULE_EVENT_TYPES = Object.keys(RECIPIENT_RULES).sort();
const SCHEMA_EVENT_TYPES = [...COORDINATION_EVENT_TYPES].sort();
if (JSON.stringify(RULE_EVENT_TYPES) !== JSON.stringify(SCHEMA_EVENT_TYPES)) {
  throw new Error('Coordination inbox recipient rules do not exhaust COORDINATION_EVENT_TYPES');
}

function validRecipient(
  actor: CoordinationActorId,
  sender: CoordinationActorId,
): boolean {
  return actor !== 'coordination-system'
    && actor !== sender
    && COORDINATION_ACTOR_IDS.includes(actor);
}

export function deriveCoordinationInboxRecipients(
  context: RecipientContext,
): CoordinationActorId[] {
  const rule = RECIPIENT_RULES[context.eventType];
  if (!rule) {
    throw new CoordinationError(
      `No inbox recipient rule exists for ${context.eventType}`,
      500,
      'inbox_rule_missing',
    );
  }
  return [...new Set(rule(context).filter(
    (candidate): candidate is CoordinationActorId => (
      Boolean(candidate)
      && isCoordinationActorId(candidate)
      && validRecipient(candidate, context.actor)
    ),
  ))];
}

function sourceCorrelationKey(thread: ThreadRecipientState): string | null {
  const reference = thread.sourceReference;
  if (!reference) return null;
  return [reference.provider, reference.type, reference.identifier].join(':').slice(0, 1000);
}

export async function getCoordinationInboxActivation(executor: any = getSharedDb()) {
  const [activation] = await executor
    .select()
    .from(coordinationInboxActivation)
    .where(eq(coordinationInboxActivation.id, COORDINATION_INBOX_ACTIVATION_ID))
    .limit(1);
  return activation ?? null;
}

async function assertSupportedWriterActivation(executor: any): Promise<void> {
  const activation = await getCoordinationInboxActivation(executor);
  if (!activation) {
    throw new CoordinationError(
      'Coordination inbox activation record is missing',
      503,
      'inbox_not_configured',
    );
  }
  if (
    activation.schemaVersion !== COORDINATION_INBOX_SCHEMA_VERSION
    || activation.recipientRuleVersion !== COORDINATION_INBOX_RECIPIENT_RULE_VERSION
  ) {
    throw new CoordinationError(
      'Coordination inbox schema or recipient rule version does not match this application',
      503,
      'inbox_version_mismatch',
      {
        expectedSchemaVersion: COORDINATION_INBOX_SCHEMA_VERSION,
        expectedRecipientRuleVersion: COORDINATION_INBOX_RECIPIENT_RULE_VERSION,
      },
    );
  }
  if (activation.state !== 'active') {
    throw new CoordinationError(
      'Coordination inbox is not active and recipient-addressed writes are paused',
      503,
      'inbox_not_active',
    );
  }
}

function assertActiveReader(activation: Awaited<ReturnType<typeof getCoordinationInboxActivation>>): void {
  if (
    !activation
    || activation.state !== 'active'
    || activation.schemaVersion !== COORDINATION_INBOX_SCHEMA_VERSION
    || activation.recipientRuleVersion !== COORDINATION_INBOX_RECIPIENT_RULE_VERSION
  ) {
    throw new CoordinationError(
      'Coordination inbox reads are unavailable until the supported version is active',
      503,
      'inbox_not_active',
    );
  }
}

export async function insertCoordinationInboxItems(
  executor: any,
  input: {
    event: CoordinationEvent;
    preThread: ThreadRecipientState;
    postThread: ThreadRecipientState;
    explicitRecipient?: CoordinationActorId | null;
    backfilled?: boolean;
    backfillProvenance?: Record<string, unknown> | null;
  },
): Promise<CoordinationActorId[]> {
  const recipients = deriveCoordinationInboxRecipients({
    eventType: input.event.eventType,
    actor: input.event.actor as CoordinationActorId,
    explicitRecipient: input.explicitRecipient,
    preThread: input.preThread,
    postThread: input.postThread,
  });
  if (recipients.length === 0) return recipients;
  if (!input.backfilled) await assertSupportedWriterActivation(executor);
  await executor.insert(coordinationInboxItems).values(recipients.map((recipientActor) => ({
    recipientActor,
    coordinationEventId: input.event.id,
    coordinationThreadId: input.event.threadId,
    eventGlobalSequence: input.event.globalSequence,
    senderActor: input.event.actor,
    messageKind: input.event.eventType,
    sourceReferenceSnapshot: input.postThread.sourceReference ?? input.preThread.sourceReference,
    sourceCorrelationKey: sourceCorrelationKey(input.postThread) ?? sourceCorrelationKey(input.preThread),
    recipientRuleVersion: COORDINATION_INBOX_RECIPIENT_RULE_VERSION,
    backfilled: input.backfilled ?? false,
    backfillProvenance: input.backfillProvenance ?? null,
    createdAt: input.event.createdAt,
  })));
  return recipients;
}

type HistoricalRecipientExpectation = {
  event: CoordinationEvent;
  preThread: ThreadRecipientState;
  postThread: ThreadRecipientState;
  recipients: CoordinationActorId[];
};

async function historicalRecipientExpectations(executor: any): Promise<HistoricalRecipientExpectation[]> {
  const rows = await executor
    .select({ event: coordinationEvents, thread: coordinationThreads })
    .from(coordinationEvents)
    .innerJoin(coordinationThreads, eq(coordinationThreads.id, coordinationEvents.threadId))
    .orderBy(asc(coordinationEvents.globalSequence));
  const stateByThread = new Map<string, ThreadRecipientState>();
  const expectations: HistoricalRecipientExpectation[] = [];
  for (const { event, thread } of rows) {
    let preThread = stateByThread.get(event.threadId);
    if (!preThread) {
      preThread = {
        originActor: event.eventType === 'created' ? event.actor : thread.originActor,
        intendedRecipient: event.eventType === 'created'
          ? event.recipientActor ?? thread.intendedRecipient
          : thread.intendedRecipient,
        currentOwner: null,
        sourceReference: thread.sourceReference,
      };
    }
    const postThread: ThreadRecipientState = { ...preThread };
    if (event.eventType === 'accepted') postThread.currentOwner = event.actor;
    if (event.eventType === 'reassigned') {
      postThread.intendedRecipient = event.recipientActor ?? preThread.intendedRecipient;
      postThread.currentOwner = null;
    }
    if (event.eventType === 'reopened') postThread.currentOwner = null;
    const recipients = deriveCoordinationInboxRecipients({
      eventType: event.eventType,
      actor: event.actor as CoordinationActorId,
      explicitRecipient: event.recipientActor as CoordinationActorId | null,
      preThread,
      postThread,
    });
    expectations.push({ event, preThread, postThread, recipients });
    stateByThread.set(event.threadId, postThread);
  }
  return expectations;
}

async function verifyEventRecipients(
  executor: any,
  eventId: string,
  expected: CoordinationActorId[],
): Promise<void> {
  const actualRows = await executor
    .select({
      recipientActor: coordinationInboxItems.recipientActor,
      recipientRuleVersion: coordinationInboxItems.recipientRuleVersion,
    })
    .from(coordinationInboxItems)
    .where(eq(coordinationInboxItems.coordinationEventId, eventId));
  const actual = actualRows
    .filter((row: { recipientRuleVersion: number }) => (
      row.recipientRuleVersion === COORDINATION_INBOX_RECIPIENT_RULE_VERSION
    ))
    .map((row: { recipientActor: string }) => row.recipientActor)
    .sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
    throw new CoordinationError(
      'Coordination inbox recipient verification failed',
      500,
      'inbox_backfill_mismatch',
      { eventId, expected, actual },
    );
  }
}

export async function backfillCoordinationInbox(
  options: {
    executor?: any;
    migrationRunId: string;
    markReady?: boolean;
  },
): Promise<{
  eventCount: number;
  insertedItemCount: number;
  cutoffGlobalSequence: number;
}> {
  if (!options.executor) {
    return getSharedDb().transaction(async (tx) => {
      await tx.execute(sql`LOCK TABLE ${coordinationEvents} IN SHARE ROW EXCLUSIVE MODE`);
      return backfillCoordinationInbox({ ...options, executor: tx });
    });
  }
  const db = options.executor ?? getSharedDb();
  const activation = await getCoordinationInboxActivation(db);
  if (
    !activation
    || activation.schemaVersion !== COORDINATION_INBOX_SCHEMA_VERSION
    || activation.recipientRuleVersion !== COORDINATION_INBOX_RECIPIENT_RULE_VERSION
  ) {
    throw new CoordinationError(
      'Backfill requires the supported inbox activation record',
      503,
      'inbox_version_mismatch',
    );
  }
  const expectations = await historicalRecipientExpectations(db);
  let inserted = 0;
  for (const expectation of expectations) {
    if (expectation.recipients.length > 0) {
      const before = await db
        .select({ value: count() })
        .from(coordinationInboxItems)
        .where(eq(coordinationInboxItems.coordinationEventId, expectation.event.id));
      await db.insert(coordinationInboxItems)
        .values(expectation.recipients.map((recipientActor) => ({
          recipientActor,
          coordinationEventId: expectation.event.id,
          coordinationThreadId: expectation.event.threadId,
          eventGlobalSequence: expectation.event.globalSequence,
          senderActor: expectation.event.actor,
          messageKind: expectation.event.eventType,
          sourceReferenceSnapshot: expectation.postThread.sourceReference,
          sourceCorrelationKey: sourceCorrelationKey(expectation.postThread),
          recipientRuleVersion: COORDINATION_INBOX_RECIPIENT_RULE_VERSION,
          backfilled: true,
          backfillProvenance: {
            migrationRunId: options.migrationRunId,
            sourceEventId: expectation.event.id,
            sourceGlobalSequence: expectation.event.globalSequence,
            recipientRuleVersion: COORDINATION_INBOX_RECIPIENT_RULE_VERSION,
          },
          createdAt: expectation.event.createdAt,
        })))
        .onConflictDoNothing();
      const after = await db
        .select({ value: count() })
        .from(coordinationInboxItems)
        .where(eq(coordinationInboxItems.coordinationEventId, expectation.event.id));
      inserted += Number(after[0]?.value ?? 0) - Number(before[0]?.value ?? 0);
    }
    await verifyEventRecipients(db, expectation.event.id, expectation.recipients);
  }
  const cutoff = expectations.at(-1)?.event.globalSequence ?? 0;
  if (options.markReady !== false) {
    await db.update(coordinationInboxActivation).set({
      state: 'ready',
      backfillCutoffGlobalSequence: cutoff,
      completionEvidence: {
        migrationRunId: options.migrationRunId,
        status: 'backfilled_and_verified',
        eventCount: expectations.length,
        cutoffGlobalSequence: cutoff,
      },
      updatedAt: new Date(),
    }).where(eq(coordinationInboxActivation.id, COORDINATION_INBOX_ACTIVATION_ID));
  }
  return {
    eventCount: expectations.length,
    insertedItemCount: inserted,
    cutoffGlobalSequence: cutoff,
  };
}

export async function activateCoordinationInbox(migrationRunId: string) {
  return getSharedDb().transaction(async (tx) => {
    await tx.execute(sql`LOCK TABLE ${coordinationEvents} IN SHARE ROW EXCLUSIVE MODE`);
    const backfill = await backfillCoordinationInbox({
      executor: tx,
      migrationRunId,
      markReady: false,
    });
    const integrity = await verifyCoordinationInboxIntegrity(tx);
    if (!integrity.ok) {
      throw new CoordinationError(
        'Coordination inbox activation integrity check failed',
        500,
        'inbox_integrity_failed',
        { mismatches: integrity.mismatches.slice(0, 25) },
      );
    }
    const [activation] = await tx.update(coordinationInboxActivation).set({
      state: 'active',
      backfillCutoffGlobalSequence: backfill.cutoffGlobalSequence,
      completionEvidence: {
        migrationRunId,
        status: 'active',
        eventCount: integrity.eventCount,
        inboxItemCount: integrity.inboxItemCount,
        cutoffGlobalSequence: backfill.cutoffGlobalSequence,
      },
      activatedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(coordinationInboxActivation.id, COORDINATION_INBOX_ACTIVATION_ID),
      inArray(coordinationInboxActivation.state, ['preparing', 'ready']),
      eq(coordinationInboxActivation.schemaVersion, COORDINATION_INBOX_SCHEMA_VERSION),
      eq(
        coordinationInboxActivation.recipientRuleVersion,
        COORDINATION_INBOX_RECIPIENT_RULE_VERSION,
      ),
    )).returning();
    if (!activation) {
      throw new CoordinationError(
        'Coordination inbox activation state changed or is unsupported',
        409,
        'inbox_activation_conflict',
      );
    }
    return { activation, backfill, integrity };
  });
}

export async function verifyExistingCoordinationInboxItems(
  event: CoordinationEvent,
  _thread?: ThreadRecipientState,
  executor: any = getSharedDb(),
): Promise<void> {
  const expectation = (await historicalRecipientExpectations(executor))
    .find((candidate) => candidate.event.id === event.id);
  if (!expectation) {
    throw new CoordinationError(
      'Idempotent event is absent from historical recipient reconstruction',
      500,
      'inbox_ledger_corrupt',
      { eventId: event.id },
    );
  }
  const expected = expectation.recipients;
  if (expected.length === 0) return;
  const rows: Array<{ recipientActor: string; recipientRuleVersion: number }> = await executor
    .select({
      recipientActor: coordinationInboxItems.recipientActor,
      recipientRuleVersion: coordinationInboxItems.recipientRuleVersion,
    })
    .from(coordinationInboxItems)
    .where(eq(coordinationInboxItems.coordinationEventId, event.id));
  const actual = rows
    .filter((row) => row.recipientRuleVersion === COORDINATION_INBOX_RECIPIENT_RULE_VERSION)
    .map((row) => row.recipientActor)
    .sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
    throw new CoordinationError(
      'Idempotent event is missing required inbox rows',
      500,
      'inbox_ledger_corrupt',
      { eventId: event.id, expected, actual },
    );
  }
}

type InboxWindowToken = {
  v: 1;
  actor: CoordinationActorId;
  after: number;
  through: number;
  lastSequence: number;
  lastId: string;
  complete: boolean;
};

function tokenSecret(): string {
  const secret = process.env.COORDINATION_INBOX_TOKEN_SECRET || process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new CoordinationError(
      'Coordination inbox token signing secret is not configured',
      503,
      'inbox_token_secret_missing',
    );
  }
  return secret;
}

function encodeWindowToken(payload: InboxWindowToken): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', tokenSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function decodeWindowToken(token: string, actor: CoordinationActorId): InboxWindowToken {
  const [encoded, suppliedSignature, extra] = token.split('.');
  if (!encoded || !suppliedSignature || extra) {
    throw new CoordinationError('Inbox window token is malformed', 400, 'invalid_inbox_window');
  }
  const expectedSignature = createHmac('sha256', tokenSecret()).update(encoded).digest();
  const supplied = Buffer.from(suppliedSignature, 'base64url');
  if (supplied.length !== expectedSignature.length || !timingSafeEqual(supplied, expectedSignature)) {
    throw new CoordinationError('Inbox window token signature is invalid', 400, 'invalid_inbox_window');
  }
  let payload: InboxWindowToken;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as InboxWindowToken;
  } catch {
    throw new CoordinationError('Inbox window token payload is invalid', 400, 'invalid_inbox_window');
  }
  if (
    payload.v !== 1
    || payload.actor !== actor
    || typeof payload.complete !== 'boolean'
    || typeof payload.lastId !== 'string'
  ) {
    throw new CoordinationError('Inbox window token belongs to another actor or version', 403, 'inbox_window_forbidden');
  }
  for (const value of [payload.after, payload.through, payload.lastSequence]) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new CoordinationError('Inbox window token contains an invalid sequence', 400, 'invalid_inbox_window');
    }
  }
  if (
    payload.after > payload.through
    || payload.lastSequence < payload.after
    || payload.lastSequence > payload.through
    || (payload.complete && payload.lastSequence < payload.through && payload.lastId !== '')
  ) {
    throw new CoordinationError(
      'Inbox window token contains an inconsistent window',
      400,
      'invalid_inbox_window',
    );
  }
  return payload;
}

async function getInboxCursor(actor: CoordinationActorId): Promise<number> {
  const [cursor] = await getSharedDb()
    .select({ value: coordinationInboxCursors.acknowledgedEventGlobalSequence })
    .from(coordinationInboxCursors)
    .where(eq(coordinationInboxCursors.recipientActor, actor))
    .limit(1);
  return cursor?.value ?? 0;
}

function boundedPageSize(limit: number): number {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new CoordinationError('limit must be a positive integer', 400, 'invalid_request');
  }
  return Math.min(limit, 100);
}

async function legacyCoverage(actor: CoordinationActorId) {
  const inbox = actor === 'luca-replit'
    ? 'agent'
    : actor === 'luca-claude-code'
      ? 'luca-claude-code'
      : null;
  if (!inbox) return { complete: true, directNoteCount: 0, notes: [] };
  try {
    const predicate = and(
      eq(agentNotes.toAgent, inbox),
      or(
        isNull(agentNotes.sourceMessageKey),
        notLike(agentNotes.sourceMessageKey, 'coordination:%'),
      ),
    );
    const [total] = await getSharedDb()
      .select({ value: count() })
      .from(agentNotes)
      .where(predicate);
    const notes = await getSharedDb()
      .select({
        id: agentNotes.id,
        fromAgent: agentNotes.fromAgent,
        subject: agentNotes.subject,
        createdAt: agentNotes.createdAt,
      })
      .from(agentNotes)
      .where(predicate)
      .orderBy(desc(agentNotes.createdAt))
      .limit(101);
    const directNoteCount = Number(total?.value ?? 0);
    const truncated = notes.length > 100 || directNoteCount > 100;
    return {
      complete: !truncated,
      directNoteCount,
      notes: notes.slice(0, 100),
      truncated,
      continuationRequired: truncated,
    };
  } catch (error) {
    return {
      complete: false,
      directNoteCount: null,
      notes: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function resolveInboxLinkedState(row: {
  inboxItem: typeof coordinationInboxItems.$inferSelect;
  thread: typeof coordinationThreads.$inferSelect;
}) {
  const observedAt = new Date().toISOString();
  const coordination = {
    threadId: row.thread.id,
    state: row.thread.state,
    intendedRecipient: row.thread.intendedRecipient,
    currentOwner: row.thread.currentOwner,
    latestSequence: row.thread.latestSequence,
    latestGlobalSequence: row.thread.latestGlobalSequence,
  };
  const reference = row.inboxItem.sourceReferenceSnapshot ?? row.thread.sourceReference;
  if (!reference) {
    return {
      complete: true,
      status: 'resolved',
      resolverVersion: 1,
      observedAt,
      coordination,
      source: null,
    };
  }
  try {
    if (reference.provider === 'shared-spec' && reference.type === 'design_spec') {
      const [documentPart, revisionPart] = reference.identifier.split('/');
      const [revisionById] = await getSharedDb()
        .select()
        .from(sharedSpecRevisions)
        .where(eq(sharedSpecRevisions.id, revisionPart ?? reference.identifier))
        .limit(1);
      const documentId = documentPart || revisionById?.documentId;
      const [document] = documentId
        ? await getSharedDb()
          .select()
          .from(sharedSpecDocuments)
          .where(eq(sharedSpecDocuments.id, documentId))
          .limit(1)
        : [];
      if (!document) {
        return {
          complete: false,
          status: 'not_found',
          resolverVersion: 1,
          observedAt,
          coordination,
          sourceReference: reference,
        };
      }
      const revisionId = revisionPart ?? revisionById?.id ?? document.currentRevisionId;
      const [revision] = revisionId
        ? await getSharedDb()
          .select({
            id: sharedSpecRevisions.id,
            documentId: sharedSpecRevisions.documentId,
            contentHash: sharedSpecRevisions.contentHash,
            authorActor: sharedSpecRevisions.authorActor,
            createdAt: sharedSpecRevisions.createdAt,
          })
          .from(sharedSpecRevisions)
          .where(and(
            eq(sharedSpecRevisions.id, revisionId),
            eq(sharedSpecRevisions.documentId, document.id),
          ))
          .limit(1)
        : [];
      const [review] = revision
        ? await getSharedDb()
          .select({
            id: sharedSpecReviews.id,
            state: sharedSpecReviews.state,
            requestedReviewerActor: sharedSpecReviews.requestedReviewerActor,
            claimedReviewerActor: sharedSpecReviews.claimedReviewerActor,
            decisionActor: sharedSpecReviews.decisionActor,
            decidedAt: sharedSpecReviews.decidedAt,
          })
          .from(sharedSpecReviews)
          .where(and(
            eq(sharedSpecReviews.documentId, document.id),
            eq(sharedSpecReviews.revisionId, revision.id),
          ))
          .limit(1)
        : [];
      const [publication] = review
        ? await getSharedDb()
          .select({
            id: sharedSpecPublications.id,
            state: sharedSpecPublications.state,
            repository: sharedSpecPublications.repository,
            destinationPath: sharedSpecPublications.destinationPath,
            pullRequestUrl: sharedSpecPublications.pullRequestUrl,
            mergedAt: sharedSpecPublications.mergedAt,
          })
          .from(sharedSpecPublications)
          .where(eq(sharedSpecPublications.reviewId, review.id))
          .limit(1)
        : [];
      return {
        complete: Boolean(revision),
        status: revision ? 'resolved' : 'not_found',
        resolverVersion: 1,
        observedAt,
        coordination,
        sourceReference: reference,
        sharedSpec: {
          document: {
            id: document.id,
            title: document.title,
            state: document.state,
            currentRevisionId: document.currentRevisionId,
            publishedRevisionId: document.publishedRevisionId,
            mergedRevisionId: document.mergedRevisionId,
            canonicalRepository: document.canonicalRepository,
            canonicalPath: document.canonicalPath,
          },
          revision: revision ?? null,
          review: review ?? null,
          publication: publication ?? null,
        },
      };
    }
    if (reference.type === 'agent_note') {
      const [note] = await getSharedDb()
        .select({
          id: agentNotes.id,
          fromAgent: agentNotes.fromAgent,
          toAgent: agentNotes.toAgent,
          subject: agentNotes.subject,
          status: agentNotes.status,
          readAt: agentNotes.readAt,
          acknowledgedAt: agentNotes.acknowledgedAt,
          actedOnAt: agentNotes.actedOnAt,
          sourceMessageKey: agentNotes.sourceMessageKey,
        })
        .from(agentNotes)
        .where(eq(agentNotes.id, reference.identifier))
        .limit(1);
      return {
        complete: Boolean(note),
        status: note ? 'resolved' : 'not_found',
        resolverVersion: 1,
        observedAt,
        coordination,
        sourceReference: reference,
        agentNote: note ?? null,
      };
    }
    return {
      complete: false,
      status: 'unsupported',
      resolverVersion: 1,
      observedAt,
      coordination,
      sourceReference: reference,
    };
  } catch (error) {
    return {
      complete: false,
      status: 'unavailable',
      resolverVersion: 1,
      observedAt,
      coordination,
      sourceReference: reference,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function listCoordinationInbox(
  actor: CoordinationActorId,
  options: { token?: string; after?: number; limit?: number } = {},
) {
  if (!isCoordinationActorId(actor) || actor === 'coordination-system') {
    throw new CoordinationError('Invalid coordination actor', 400, 'invalid_actor');
  }
  assertActiveReader(await getCoordinationInboxActivation());
  const limit = boundedPageSize(options.limit ?? 50);
  const acknowledged = await getInboxCursor(actor);
  let after: number;
  let through: number;
  let lastSequence: number;
  let lastId: string;
  if (options.token) {
    const token = decodeWindowToken(options.token, actor);
    if (token.complete) {
      throw new CoordinationError('Completed inbox window tokens cannot be paged', 409, 'inbox_window_complete');
    }
    after = token.after;
    through = token.through;
    lastSequence = token.lastSequence;
    lastId = token.lastId;
  } else {
    after = options.after ?? acknowledged;
    if (!Number.isSafeInteger(after) || after < 0) {
      throw new CoordinationError('after must be a non-negative integer', 400, 'invalid_request');
    }
    const [highWater] = await getSharedDb()
      .select({ value: max(coordinationInboxItems.eventGlobalSequence) })
      .from(coordinationInboxItems)
      .where(eq(coordinationInboxItems.recipientActor, actor));
    through = Math.max(after, highWater?.value ?? after);
    lastSequence = after;
    lastId = '';
  }

  const rows = await getSharedDb()
    .select({
      inboxItem: coordinationInboxItems,
      event: coordinationEvents,
      thread: coordinationThreads,
      adapter: coordinationAdapterDeliveries,
    })
    .from(coordinationInboxItems)
    .innerJoin(coordinationEvents, eq(coordinationEvents.id, coordinationInboxItems.coordinationEventId))
    .innerJoin(coordinationThreads, eq(coordinationThreads.id, coordinationInboxItems.coordinationThreadId))
    .leftJoin(
      coordinationAdapterDeliveries,
      and(
        eq(coordinationAdapterDeliveries.eventId, coordinationInboxItems.coordinationEventId),
        eq(coordinationAdapterDeliveries.targetActor, actor),
      ),
    )
    .where(and(
      eq(coordinationInboxItems.recipientActor, actor),
      gt(coordinationInboxItems.eventGlobalSequence, after),
      lte(coordinationInboxItems.eventGlobalSequence, through),
      or(
        gt(coordinationInboxItems.eventGlobalSequence, lastSequence),
        and(
          eq(coordinationInboxItems.eventGlobalSequence, lastSequence),
          gt(coordinationInboxItems.id, lastId),
        ),
      ),
    ))
    .orderBy(
      asc(coordinationInboxItems.eventGlobalSequence),
      asc(coordinationInboxItems.id),
    )
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const coreItems = rows.slice(0, limit);
  const items = await Promise.all(coreItems.map(async (row) => ({
    ...row,
    linkedState: await resolveInboxLinkedState(row),
  })));
  const last = coreItems.at(-1)?.inboxItem;
  const complete = !hasMore;
  const windowToken = encodeWindowToken({
    v: 1,
    actor,
    after,
    through,
    lastSequence: last?.eventGlobalSequence ?? lastSequence,
    lastId: last?.id ?? lastId,
    complete,
  });
  return {
    actor,
    items,
    window: {
      after,
      through,
      complete,
      token: windowToken,
      nextToken: complete ? null : windowToken,
      continuation: complete
        ? null
        : {
            queryParameter: 'token',
            cliOption: '--token',
          },
      acknowledged,
    },
    core: { complete: true },
    adapterOverlay: { complete: true },
    linkedState: {
      complete: items.every((item) => item.linkedState.complete),
      unavailableItemIds: items
        .filter((item) => !item.linkedState.complete)
        .map((item) => item.inboxItem.id),
    },
    legacyCoverage: await legacyCoverage(actor),
  };
}

export async function acknowledgeCoordinationInbox(
  actor: CoordinationActorId,
  windowToken: string,
) {
  if (!isCoordinationActorId(actor) || actor === 'coordination-system') {
    throw new CoordinationError('Invalid coordination actor', 400, 'invalid_actor');
  }
  assertActiveReader(await getCoordinationInboxActivation());
  const window = decodeWindowToken(windowToken, actor);
  if (!window.complete) {
    throw new CoordinationError(
      'Inbox acknowledgement requires a completed read window',
      409,
      'inbox_window_incomplete',
    );
  }
  return getSharedDb().transaction(async (tx) => {
    const [existing] = await tx
      .select({ value: coordinationInboxCursors.acknowledgedEventGlobalSequence })
      .from(coordinationInboxCursors)
      .where(eq(coordinationInboxCursors.recipientActor, actor))
      .limit(1);
    const previous = existing?.value ?? 0;
    if (window.after > previous) {
      throw new CoordinationError(
        'Inbox acknowledgement would skip an unacknowledged window',
        409,
        'inbox_ack_gap',
        { acknowledged: previous, windowAfter: window.after },
      );
    }
    const requested = Math.max(previous, window.through);
    const [cursor] = await tx
      .insert(coordinationInboxCursors)
      .values({
        recipientActor: actor,
        acknowledgedEventGlobalSequence: requested,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: coordinationInboxCursors.recipientActor,
        set: {
          acknowledgedEventGlobalSequence: sql`GREATEST(${coordinationInboxCursors.acknowledgedEventGlobalSequence}, ${requested})`,
          updatedAt: new Date(),
        },
      })
      .returning({ value: coordinationInboxCursors.acknowledgedEventGlobalSequence });
    const [acknowledgedItems] = await tx
      .select({ value: count() })
      .from(coordinationInboxItems)
      .where(and(
        eq(coordinationInboxItems.recipientActor, actor),
        gt(coordinationInboxItems.eventGlobalSequence, previous),
        lte(coordinationInboxItems.eventGlobalSequence, cursor.value),
      ));
    return {
      actor,
      previousAcknowledgedEventGlobalSequence: previous,
      acknowledgedEventGlobalSequence: cursor.value,
      acknowledgedItemCount: acknowledgedItems?.value ?? 0,
    };
  });
}

export async function verifyCoordinationInboxIntegrity(executor: any = getSharedDb()) {
  const expectations = await historicalRecipientExpectations(executor);
  const expectedByEvent = new Map(
    expectations.map((expectation) => [expectation.event.id, expectation.recipients]),
  );
  const items: Array<typeof coordinationInboxItems.$inferSelect> = await executor
    .select()
    .from(coordinationInboxItems);
  const actualByEvent = new Map<string, string[]>();
  for (const item of items) {
    actualByEvent.set(
      item.coordinationEventId,
      [...(actualByEvent.get(item.coordinationEventId) ?? []), item.recipientActor],
    );
  }
  const mismatches = [...expectedByEvent.entries()].flatMap(([eventId, expected]) => {
    const actual = (actualByEvent.get(eventId) ?? []).sort();
    return JSON.stringify([...expected].sort()) === JSON.stringify(actual)
      ? []
      : [{ eventId, expected, actual }];
  });
  for (const [eventId, actual] of actualByEvent.entries()) {
    if (!expectedByEvent.has(eventId)) {
      mismatches.push({ eventId, expected: [], actual: [...actual].sort() });
    }
  }
  const unsupportedRuleRows = items
    .filter((item) => item.recipientRuleVersion !== COORDINATION_INBOX_RECIPIENT_RULE_VERSION)
    .map((item) => ({
      inboxItemId: item.id,
      eventId: item.coordinationEventId,
      recipientRuleVersion: item.recipientRuleVersion,
    }));
  return {
    ok: mismatches.length === 0 && unsupportedRuleRows.length === 0,
    eventCount: expectations.length,
    inboxItemCount: items.length,
    mismatches,
    unsupportedRuleRows,
  };
}

export async function repairActiveCoordinationInbox(
  migrationRunId: string,
  executor?: any,
): Promise<{
  repairedItemCount: number;
  repairedEventIds: string[];
  integrity: Awaited<ReturnType<typeof verifyCoordinationInboxIntegrity>>;
}> {
  const db = executor ?? getSharedDb();
  return db.transaction(async (tx: any) => {
    await tx.execute(sql`LOCK TABLE ${coordinationEvents} IN SHARE ROW EXCLUSIVE MODE`);
    const activation = await getCoordinationInboxActivation(tx);
    if (
      !activation
      || activation.state !== 'active'
      || activation.schemaVersion !== COORDINATION_INBOX_SCHEMA_VERSION
      || activation.recipientRuleVersion !== COORDINATION_INBOX_RECIPIENT_RULE_VERSION
    ) {
      throw new CoordinationError(
        'Active inbox repair requires the supported inbox version to be active',
        409,
        'inbox_repair_not_active',
      );
    }

    const expectations = await historicalRecipientExpectations(tx);
    const existingRows: Array<{ coordinationEventId: string; recipientActor: string }> = await tx
      .select({
        coordinationEventId: coordinationInboxItems.coordinationEventId,
        recipientActor: coordinationInboxItems.recipientActor,
      })
      .from(coordinationInboxItems)
      .where(eq(
        coordinationInboxItems.recipientRuleVersion,
        COORDINATION_INBOX_RECIPIENT_RULE_VERSION,
      ));
    const existing = new Set(existingRows.map(
      (row) => `${row.coordinationEventId}:${row.recipientActor}`,
    ));
    const repairedEventIds = new Set<string>();
    let repairedItemCount = 0;

    for (const expectation of expectations) {
      const missingRecipients = expectation.recipients.filter(
        (recipient) => !existing.has(`${expectation.event.id}:${recipient}`),
      );
      if (missingRecipients.length === 0) continue;
      await tx.insert(coordinationInboxItems).values(missingRecipients.map((recipientActor) => ({
        recipientActor,
        coordinationEventId: expectation.event.id,
        coordinationThreadId: expectation.event.threadId,
        eventGlobalSequence: expectation.event.globalSequence,
        senderActor: expectation.event.actor,
        messageKind: expectation.event.eventType,
        sourceReferenceSnapshot:
          expectation.postThread.sourceReference ?? expectation.preThread.sourceReference,
        sourceCorrelationKey:
          sourceCorrelationKey(expectation.postThread) ?? sourceCorrelationKey(expectation.preThread),
        recipientRuleVersion: COORDINATION_INBOX_RECIPIENT_RULE_VERSION,
        backfilled: true,
        backfillProvenance: {
          migrationRunId,
          reason: 'active_integrity_repair',
        },
        createdAt: expectation.event.createdAt,
      }))).onConflictDoNothing();
      for (const recipient of missingRecipients) {
        existing.add(`${expectation.event.id}:${recipient}`);
      }
      repairedItemCount += missingRecipients.length;
      repairedEventIds.add(expectation.event.id);
    }

    const integrity = await verifyCoordinationInboxIntegrity(tx);
    if (!integrity.ok) {
      throw new CoordinationError(
        'Active inbox repair did not restore exact recipient integrity',
        500,
        'inbox_repair_incomplete',
        { mismatches: integrity.mismatches.slice(0, 25) },
      );
    }
    return {
      repairedItemCount,
      repairedEventIds: [...repairedEventIds],
      integrity,
    };
  });
}