import { createHash, randomUUID } from 'crypto';

import { and, eq } from 'drizzle-orm';

import {
  rawReplitCaptureEvents,
  rawReplitCaptureStreams,
  rawReplitProjectionLinks,
  type RawReplitCaptureEvent,
} from '../../shared/schema';
import { getMonitoringDb, getSharedDb } from '../db';

export interface RawReplitEventInput {
  sequenceNumber: number;
  eventType: string;
  payloadText: string;
  /**
   * Authoritative collector bytes. When omitted, the UTF-8 encoding of
   * payloadText is retained; callers receiving a file/buffer must provide it.
   */
  payloadBytes?: Buffer;
  /**
   * Stable within the source stream. A retry with this key must have the exact
   * same source payload or fail closed as an idempotency collision.
   */
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  observedAt?: Date;
}

export interface PersistRawReplitCaptureInput {
  sourceKey: string;
  sourceRoute: string;
  events: RawReplitEventInput[];
  metadata?: Record<string, unknown>;
  privacyClassification?: string;
}

export interface PersistedRawReplitCapture {
  streamId: string;
  sourceKey: string;
  eventIds: string[];
  eventCount: number;
  byteCount: number;
  aggregateSha256: string;
}

export interface RawReplitProjectionInput {
  capture: PersistedRawReplitCapture;
  targetKind: string;
  targetKey: string;
  disposition: 'dialogue' | 'evidence' | 'origin-data' | 'cleanup' | 'unresolved' | 'not_projected';
  captureStartByteOffset?: number;
  captureEndByteOffset?: number;
  metadata?: Record<string, unknown>;
}

export interface RawReplitCaptureSummary {
  state: 'checking' | 'available' | 'unavailable';
  streamCount: number;
  completeStreamCount: number;
  eventCount: number;
  byteCount: number;
  unlinkedStreamCount: number;
  error?: string;
}

interface PreparedEvent extends RawReplitEventInput {
  payloadBytes: Buffer;
  payloadByteCount: number;
  payloadSha256: string;
}

type TransactionCapableDb = {
  transaction<T>(transaction: (tx: any) => Promise<T>): Promise<T>;
};

let rawCaptureDbForTest: TransactionCapableDb | undefined;

/** Test-only dependency boundary for a surrounding rollback transaction. */
export function setRawReplitCaptureDbForTest(db?: TransactionCapableDb): void {
  rawCaptureDbForTest = db;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function aggregateHash(events: PreparedEvent[]): string {
  return sha256(events.map(event =>
    `${event.sequenceNumber}:${event.eventType}:${event.payloadSha256}\n`,
  ).join(''));
}

/**
 * Deterministically prepares the source representation before any database or
 * projection operation. Exported for hermetic regression coverage.
 */
export function prepareRawReplitEvents(events: RawReplitEventInput[]): PreparedEvent[] {
  if (events.length === 0) {
    throw new Error('Raw Replit capture requires at least one source event.');
  }

  const usedSequences = new Set<number>();
  const usedIdempotencyKeys = new Set<string>();
  return events.map(event => {
    if (!Number.isInteger(event.sequenceNumber) || event.sequenceNumber < 1) {
      throw new Error(`Raw Replit event sequence must be a positive integer; got ${event.sequenceNumber}.`);
    }
    if (!event.eventType.trim()) throw new Error('Raw Replit event type is required.');
    if (!event.idempotencyKey.trim()) throw new Error('Raw Replit event idempotency key is required.');
    if (usedSequences.has(event.sequenceNumber)) {
      throw new Error(`Duplicate raw Replit event sequence ${event.sequenceNumber}.`);
    }
    if (usedIdempotencyKeys.has(event.idempotencyKey)) {
      throw new Error(`Duplicate raw Replit event idempotency key ${event.idempotencyKey}.`);
    }
    usedSequences.add(event.sequenceNumber);
    usedIdempotencyKeys.add(event.idempotencyKey);
    return {
      ...event,
      payloadBytes: event.payloadBytes ?? Buffer.from(event.payloadText, 'utf8'),
      payloadByteCount: (event.payloadBytes ?? Buffer.from(event.payloadText, 'utf8')).byteLength,
      payloadSha256: sha256(event.payloadBytes ?? Buffer.from(event.payloadText, 'utf8')),
    };
  }).sort((a, b) => a.sequenceNumber - b.sequenceNumber);
}

/**
 * Stores all source events before a caller is allowed to create a semantic
 * projection. A source key identifies one immutable logical stream, currently
 * a canonical record-exchange turn or a SHA-keyed raw-window source.
 */
export async function persistRawReplitCapture(
  input: PersistRawReplitCaptureInput,
): Promise<PersistedRawReplitCapture> {
  if (!input.sourceKey.trim()) throw new Error('Raw Replit capture source key is required.');
  if (!input.sourceRoute.trim()) throw new Error('Raw Replit capture source route is required.');

  const events = prepareRawReplitEvents(input.events);
  const expectedAggregateSha256 = aggregateHash(events);
  const expectedByteCount = events.reduce((total, event) => total + event.payloadByteCount, 0);
  const db: TransactionCapableDb = rawCaptureDbForTest ?? getSharedDb();

  return db.transaction(async tx => {
    const tentativeStreamId = randomUUID();
    await tx.insert(rawReplitCaptureStreams).values({
      id: tentativeStreamId,
      sourceKey: input.sourceKey,
      sourceRoute: input.sourceRoute,
        status: 'complete',
      expectedEventCount: events.length,
        persistedEventCount: events.length,
        persistedByteCount: expectedByteCount,
        aggregateSha256: expectedAggregateSha256,
      metadata: input.metadata,
      privacyClassification: input.privacyClassification ?? 'private-evidence',
      openedAt: new Date(),
      lastObservedAt: new Date(),
        closedAt: new Date(),
    }).onConflictDoNothing();

    const streamRows = await tx
      .select()
      .from(rawReplitCaptureStreams)
      .where(eq(rawReplitCaptureStreams.sourceKey, input.sourceKey))
      .limit(1);
    const stream = streamRows[0];
    if (!stream) {
      throw new Error(`Raw Replit capture stream was not readable after insert: ${input.sourceKey}.`);
    }
    if (stream.sourceRoute !== input.sourceRoute) {
      throw new Error(
        `Raw Replit source key collision: ${input.sourceKey} was created by ${stream.sourceRoute}, not ${input.sourceRoute}.`,
      );
    }

    for (const event of events) {
      await tx.insert(rawReplitCaptureEvents).values({
        id: randomUUID(),
        streamId: stream.id,
        sequenceNumber: event.sequenceNumber,
        eventType: event.eventType,
        payloadText: event.payloadText,
        payloadBytes: event.payloadBytes,
        payloadBytesExact: true,
        payloadByteCount: event.payloadByteCount,
        payloadSha256: event.payloadSha256,
        idempotencyKey: event.idempotencyKey,
        metadata: event.metadata,
        observedAt: event.observedAt ?? new Date(),
      }).onConflictDoNothing();

      const persistedRows = await tx
        .select()
        .from(rawReplitCaptureEvents)
        .where(and(
          eq(rawReplitCaptureEvents.streamId, stream.id),
          eq(rawReplitCaptureEvents.idempotencyKey, event.idempotencyKey),
        ))
        .limit(1);
      const persisted = persistedRows[0];
      if (!persisted) {
        throw new Error(
          `Raw Replit event was not readable after insert (${input.sourceKey}/${event.idempotencyKey}).`,
        );
      }
      if (
        persisted.sequenceNumber !== event.sequenceNumber
        || persisted.eventType !== event.eventType
        || persisted.payloadSha256 !== event.payloadSha256
        || persisted.payloadByteCount !== event.payloadByteCount
        || !Buffer.from(persisted.payloadBytes).equals(event.payloadBytes)
      ) {
        throw new Error(
          `Raw Replit idempotency collision for ${input.sourceKey}/${event.idempotencyKey}: existing payload differs.`,
        );
      }
    }

    const persistedEvents: RawReplitCaptureEvent[] = ((await tx
      .select()
      .from(rawReplitCaptureEvents)
      .where(eq(rawReplitCaptureEvents.streamId, stream.id))) as RawReplitCaptureEvent[])
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    if (persistedEvents.length !== events.length) {
      throw new Error(
        `Raw Replit capture ${input.sourceKey} has ${persistedEvents.length} events; expected ${events.length}.`,
      );
    }
    for (let index = 0; index < events.length; index++) {
      const expected = events[index];
      const persisted = persistedEvents[index];
      if (
        !persisted
        || persisted.sequenceNumber !== expected.sequenceNumber
        || persisted.eventType !== expected.eventType
        || persisted.payloadSha256 !== expected.payloadSha256
        || persisted.payloadByteCount !== expected.payloadByteCount
        || !Buffer.from(persisted.payloadBytes).equals(expected.payloadBytes)
      ) {
        throw new Error(`Raw Replit capture ${input.sourceKey} failed persisted ordering/hash verification.`);
      }
    }

    return {
      streamId: stream.id,
      sourceKey: input.sourceKey,
      eventIds: persistedEvents.map(event => event.id),
      eventCount: events.length,
      byteCount: expectedByteCount,
      aggregateSha256: expectedAggregateSha256,
    };
  });
}

/**
 * Records a downstream projection without mutating the raw source. Repeated
 * links are idempotent by raw event plus target kind/key.
 */
export async function linkRawReplitCaptureToProjection(
  input: RawReplitProjectionInput,
): Promise<void> {
  if (!input.targetKind.trim() || !input.targetKey.trim()) {
    throw new Error('Raw Replit projection target kind and key are required.');
  }
  if (
    input.captureStartByteOffset !== undefined
    && input.captureEndByteOffset !== undefined
    && input.captureEndByteOffset < input.captureStartByteOffset
  ) {
    throw new Error('Raw Replit projection byte range ends before it starts.');
  }

  const db: TransactionCapableDb = rawCaptureDbForTest ?? getSharedDb();
  await db.transaction(async tx => {
    for (const rawEventId of input.capture.eventIds) {
      await tx.insert(rawReplitProjectionLinks).values({
        id: randomUUID(),
        streamId: input.capture.streamId,
        rawEventId,
        targetKind: input.targetKind,
        targetKey: input.targetKey,
        disposition: input.disposition,
        captureStartByteOffset: input.captureStartByteOffset,
        captureEndByteOffset: input.captureEndByteOffset,
        metadata: input.metadata,
        observedAt: new Date(),
      }).onConflictDoNothing();
    }
  });
}

/**
 * Read-only status for the source ledger. This intentionally reports the
 * collector boundary, not a claim that every human-visible Replit UI block was
 * exposed to that collector.
 */
export async function getRawReplitCaptureSummary(): Promise<RawReplitCaptureSummary> {
  try {
    const db = getMonitoringDb();
    const [streams, links] = await Promise.all([
      db.select({
        id: rawReplitCaptureStreams.id,
        status: rawReplitCaptureStreams.status,
        persistedEventCount: rawReplitCaptureStreams.persistedEventCount,
        persistedByteCount: rawReplitCaptureStreams.persistedByteCount,
      }).from(rawReplitCaptureStreams),
      db.select({
        streamId: rawReplitProjectionLinks.streamId,
      }).from(rawReplitProjectionLinks),
    ]);
    const linkedStreamIds = new Set(links.map(link => link.streamId));
    return {
      state: 'available',
      streamCount: streams.length,
      completeStreamCount: streams.filter(stream => stream.status === 'complete').length,
      eventCount: streams.reduce((total, stream) => total + stream.persistedEventCount, 0),
      byteCount: streams.reduce((total, stream) => total + stream.persistedByteCount, 0),
      unlinkedStreamCount: streams.filter(stream =>
        stream.status === 'complete' && !linkedStreamIds.has(stream.id),
      ).length,
    };
  } catch (error) {
    return {
      state: 'unavailable',
      streamCount: 0,
      completeStreamCount: 0,
      eventCount: 0,
      byteCount: 0,
      unlinkedStreamCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}