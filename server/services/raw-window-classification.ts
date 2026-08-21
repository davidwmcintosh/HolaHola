import { createHash } from 'crypto';
import { desc, eq, sql } from 'drizzle-orm';

import {
  rawReplitCaptureEvents,
  rawReplitClassificationRevisions,
  rawReplitClassificationProjectionQueue,
} from '../../shared/schema';
import { getSharedDb } from '../db';
import { appendRawWindowOriginToEpisodeDb } from './agent-session-autosave';

export interface RawWindowClassificationInput {
  sourceSha256: string;
  classification: string;
  reason: string;
  revisedBy: string;
  episodeFilename: string;
  attribution?: Record<string, unknown>;
}

function revisionBlock(input: RawWindowClassificationInput): string {
  return [
    `**[RAW WINDOW — CLASSIFICATION REVISION]:**`,
    `[ORIGIN SHA-256: ${input.sourceSha256}]`,
    `[CLASSIFICATION: ${input.classification}]`,
    `[REASON: ${input.reason}]`,
    `[REVISED BY: ${input.revisedBy}]`,
    ...(input.attribution ? [`[ATTRIBUTION: ${JSON.stringify(input.attribution)}]`] : []),
  ].join('\n');
}
function stableJson(value: Record<string, unknown> | undefined): string {
  if (!value) return '';
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
}

/** Append-only interpretation. Raw bytes and the original origin block remain unchanged. */
export async function reviseRawWindowClassification(input: RawWindowClassificationInput): Promise<void> {
  const db = getSharedDb();
  const events = await db.select({ id: rawReplitCaptureEvents.id })
    .from(rawReplitCaptureEvents)
    .where(eq(rawReplitCaptureEvents.payloadSha256, input.sourceSha256))
    .limit(1);
  const rawEvent = events[0];
  if (!rawEvent) throw new Error(`No immutable raw source exists for ${input.sourceSha256}.`);
  const revisionKey = createHash('sha256').update([
    input.sourceSha256, input.classification, input.reason,
    input.episodeFilename, input.revisedBy, stableJson(input.attribution),
  ].join('\n')).digest('hex');
  const marker = `<!-- raw-window-classification:${revisionKey} -->`;
  await db.transaction(async tx => {
    await tx.insert(rawReplitClassificationRevisions).values({
      rawEventId: rawEvent.id,
      revisionKey,
      sourceSha256: input.sourceSha256,
      classification: input.classification,
      attribution: input.attribution,
      reason: input.reason,
      revisedBy: input.revisedBy,
    }).onConflictDoNothing();
    const revisions = await tx.select().from(rawReplitClassificationRevisions)
      .where(eq(rawReplitClassificationRevisions.revisionKey, revisionKey)).limit(1);
    const revision = revisions[0];
    if (!revision) throw new Error(`Classification revision ${revisionKey} was not durable.`);
    await tx.insert(rawReplitClassificationProjectionQueue).values({
      revisionId: revision.id,
      revisionKey,
      sourceSha256: input.sourceSha256,
      episodeFilename: input.episodeFilename,
      marker,
      status: 'pending',
    }).onConflictDoNothing();
  });
  const queueRows = await db.select().from(rawReplitClassificationProjectionQueue)
    .where(eq(rawReplitClassificationProjectionQueue.revisionKey, revisionKey)).limit(1);
  const queue = queueRows[0];
  if (!queue) throw new Error(`Classification projection queue ${revisionKey} was not durable.`);
  if (queue.status === 'projected') return;
  await db.update(rawReplitClassificationProjectionQueue).set({
    attempts: sql`${rawReplitClassificationProjectionQueue.attempts} + 1`,
    updatedAt: new Date(),
    lastError: null,
  }).where(eq(rawReplitClassificationProjectionQueue.revisionKey, revisionKey));
  try {
    const projected = await appendRawWindowOriginToEpisodeDb(
      revisionBlock(input),
      input.episodeFilename,
      input.sourceSha256,
      marker,
    );
    if (!projected) throw new Error(`Canonical episode projection failed for ${input.sourceSha256}.`);
    await db.update(rawReplitClassificationProjectionQueue).set({
      status: 'projected',
      projectedAt: new Date(),
      updatedAt: new Date(),
      lastError: null,
    }).where(eq(rawReplitClassificationProjectionQueue.revisionKey, revisionKey));
  } catch (error) {
    await db.update(rawReplitClassificationProjectionQueue).set({
      status: 'failed',
      lastError: error instanceof Error ? error.message : String(error),
      updatedAt: new Date(),
    }).where(eq(rawReplitClassificationProjectionQueue.revisionKey, revisionKey));
    throw error;
  }
}

/** Durable recovery consumer for interrupted classification projections. */
export async function retryPendingRawWindowClassificationProjections(): Promise<number> {
  const db = getSharedDb();
  const queues = await db.select().from(rawReplitClassificationProjectionQueue)
    .where(sql`${rawReplitClassificationProjectionQueue.status} IN ('pending', 'failed')`);
  let recovered = 0;
  for (const queue of queues) {
    const revisions = await db.select().from(rawReplitClassificationRevisions)
      .where(eq(rawReplitClassificationRevisions.id, queue.revisionId)).limit(1);
    const revision = revisions[0];
    if (!revision) continue;
    await reviseRawWindowClassification({
      sourceSha256: revision.sourceSha256,
      classification: revision.classification,
      reason: revision.reason,
      revisedBy: revision.revisedBy,
      episodeFilename: queue.episodeFilename,
      attribution: (revision.attribution as Record<string, unknown> | null) ?? undefined,
    });
    recovered++;
  }
  return recovered;
}

export async function getLatestRawWindowClassification(sourceSha256: string) {
  const db = getSharedDb();
  const rows = await db.select().from(rawReplitClassificationRevisions)
    .where(eq(rawReplitClassificationRevisions.sourceSha256, sourceSha256))
    .orderBy(desc(rawReplitClassificationRevisions.recordedAt))
    .limit(1);
  return rows[0] ?? null;
}