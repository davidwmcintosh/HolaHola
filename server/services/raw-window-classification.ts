import { desc, eq } from 'drizzle-orm';

import {
  rawReplitCaptureEvents,
  rawReplitClassificationRevisions,
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

/** Append-only interpretation. Raw bytes and the original origin block remain unchanged. */
export async function reviseRawWindowClassification(input: RawWindowClassificationInput): Promise<void> {
  const db = getSharedDb();
  const events = await db.select({ id: rawReplitCaptureEvents.id })
    .from(rawReplitCaptureEvents)
    .where(eq(rawReplitCaptureEvents.payloadSha256, input.sourceSha256))
    .limit(1);
  const rawEvent = events[0];
  if (!rawEvent) throw new Error(`No immutable raw source exists for ${input.sourceSha256}.`);
  await db.insert(rawReplitClassificationRevisions).values({
    rawEventId: rawEvent.id,
    sourceSha256: input.sourceSha256,
    classification: input.classification,
    attribution: input.attribution,
    reason: input.reason,
    revisedBy: input.revisedBy,
  });
  const marker = `${input.sourceSha256}:${input.classification}:${input.reason}`;
  const projected = await appendRawWindowOriginToEpisodeDb(
    revisionBlock(input),
    input.episodeFilename,
    input.sourceSha256,
    `<!-- raw-window-classification:${marker} -->`,
  );
  if (!projected) throw new Error(`Classification revision was recorded but could not be projected for ${input.sourceSha256}.`);
}

export async function getLatestRawWindowClassification(sourceSha256: string) {
  const db = getSharedDb();
  const rows = await db.select().from(rawReplitClassificationRevisions)
    .where(eq(rawReplitClassificationRevisions.sourceSha256, sourceSha256))
    .orderBy(desc(rawReplitClassificationRevisions.recordedAt))
    .limit(1);
  return rows[0] ?? null;
}