import { createHash, randomUUID } from 'crypto';

import { asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import {
  rawReplitCaptureEvents,
  rawReplitCaptureStreams,
  rawReplitProjectionLinks,
} from '../../shared/schema';
import {
  linkRawReplitCaptureToProjection,
  persistRawReplitCapture,
  setRawReplitCaptureDbForTest,
} from '../services/raw-replit-capture';

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const testId = randomUUID();
  const sourceKey = `raw-replit-integration:${testId}`;
  const pool = new Pool({
    connectionString: process.env.NEON_SHARED_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });
  const db = drizzle(pool);
  const events = [
    {
      sequenceNumber: 2,
      eventType: 'luca-output',
      payloadText: 'Luca source\nUTF-8 preserved: ñ',
      payloadBytes: Buffer.from('Luca source\nUTF-8 preserved: ñ', 'utf8'),
      idempotencyKey: 'luca',
    },
    {
      sequenceNumber: 1,
      eventType: 'david-message',
      payloadText: 'David source',
      payloadBytes: Buffer.from('David source', 'utf8'),
      idempotencyKey: 'david',
    },
  ];

  const rollback = new Error('raw-replit-capture integration rollback');
  try {
    await db.transaction(async tx => {
      setRawReplitCaptureDbForTest(tx);
      const capture = await persistRawReplitCapture({
      sourceKey,
      sourceRoute: 'raw-replit-capture-integration',
      events,
      metadata: { testId, purpose: 'migrated-table integration regression' },
    });
      await linkRawReplitCaptureToProjection({
      capture,
      targetKind: 'raw-replit-capture-integration',
      targetKey: testId,
      disposition: 'evidence',
      captureStartByteOffset: 7,
      captureEndByteOffset: 49,
    });

      const [stream] = await tx
      .select()
      .from(rawReplitCaptureStreams)
      .where(eq(rawReplitCaptureStreams.id, capture.streamId))
      .limit(1);
      const storedEvents = await tx
      .select()
      .from(rawReplitCaptureEvents)
      .where(eq(rawReplitCaptureEvents.streamId, capture.streamId))
      .orderBy(asc(rawReplitCaptureEvents.sequenceNumber));
      const links = await tx
      .select()
      .from(rawReplitProjectionLinks)
      .where(eq(rawReplitProjectionLinks.streamId, capture.streamId));

    const orderedPayloads = ['David source', 'Luca source\nUTF-8 preserved: ñ'];
    const expectedBytes = orderedPayloads.reduce(
      (total, payload) => total + Buffer.byteLength(payload, 'utf8'),
      0,
    );
    const expectedAggregate = sha256(
      [
        `1:david-message:${sha256(orderedPayloads[0]!)}\n`,
        `2:luca-output:${sha256(orderedPayloads[1]!)}\n`,
      ].join(''),
    );

    expect(stream?.status === 'complete', 'Raw test stream did not close as complete.');
    expect(stream?.persistedEventCount === 2, 'Raw test stream did not persist two events.');
    expect(stream?.persistedByteCount === expectedBytes, 'Raw test stream byte count differs from UTF-8 source.');
    expect(stream?.aggregateSha256 === expectedAggregate, 'Raw test stream aggregate hash differs from ordered source.');
    expect(storedEvents.length === 2, 'Raw test events were not stored.');
      expect(
      storedEvents.map(event => event.sequenceNumber).join(',') === '1,2',
      'Raw test events were not returned in canonical source order.',
    );
    expect(
      storedEvents.every((event, index) =>
        event.payloadText === orderedPayloads[index]
        && event.payloadSha256 === sha256(orderedPayloads[index]!)
        && event.payloadByteCount === Buffer.byteLength(orderedPayloads[index]!, 'utf8'),
      ),
      'Raw test event payload, SHA-256, or UTF-8 byte count differs from source.',
    );
    expect(
      links.length === 2
      && links.every(link =>
        link.targetKind === 'raw-replit-capture-integration'
        && link.targetKey === testId
        && link.disposition === 'evidence'
        && link.captureStartByteOffset === 7
        && link.captureEndByteOffset === 49,
      ),
      'Raw test projection links are missing or differ from the acknowledged target.',
    );

      let updateRejected = false;
      let deleteRejected = false;
      try {
        await tx.update(rawReplitCaptureEvents)
          .set({ payloadText: 'mutation must be rejected' })
          .where(eq(rawReplitCaptureEvents.id, capture.eventIds[0]!));
      } catch {
        updateRejected = true;
      }
      try {
        await tx.delete(rawReplitProjectionLinks)
          .where(eq(rawReplitProjectionLinks.streamId, capture.streamId));
      } catch {
        deleteRejected = true;
      }
      expect(updateRejected, 'Raw event mutation was not rejected by the database.');
      expect(deleteRejected, 'Raw projection-link deletion was not rejected by the database.');

      console.log('[raw-replit-capture-integration] PASS — migrated raw stream, exact bytes/hashes/order, links, and immutability verified.');
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    setRawReplitCaptureDbForTest(undefined);
    await pool.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});