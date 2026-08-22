import { randomUUID } from 'crypto';

import { and, eq } from 'drizzle-orm';

import { contextLineageEvents, conversationMemories } from '@shared/schema';
import { getMonitoringDb, getSharedDb } from '../db';
import type { RawWindowAuditManifest } from './raw-window-audit-service';

const SOURCE_EVENT = 'raw_window_source_observed';
const RESULT_EVENT = 'raw_window_projection_audited';
const PROJECTION_STARTED_EVENT = 'raw_window_projection_started';

export interface RawWindowEvidenceLedgerSummary {
  state: 'checking' | 'available' | 'unavailable';
  sourceCount: number;
  unresolvedSources: number;
  unresolvedBytes: number;
  incompleteProjections: number;
  error?: string;
}

export interface RawWindowEvidenceLedgerRow {
  sessionId: string;
  eventType: string;
  payloadJson: unknown;
}

function sessionIdFor(sourceSha256: string): string {
  return `raw-window:${sourceSha256}`;
}

function dispositionOf(payloadJson: unknown): string | null {
  if (!payloadJson || typeof payloadJson !== 'object') return null;
  const value = (payloadJson as Record<string, unknown>).disposition;
  return typeof value === 'string' ? value : null;
}

async function evidenceRows(sourceSha256: string) {
  return getSharedDb()
    .select({
      id: contextLineageEvents.id,
      conversationId: contextLineageEvents.conversationId,
      sequenceNumber: contextLineageEvents.sequenceNumber,
      eventType: contextLineageEvents.eventType,
      payloadJson: contextLineageEvents.payloadJson,
    })
    .from(contextLineageEvents)
    .where(eq(contextLineageEvents.sessionId, sessionIdFor(sourceSha256)));
}

export async function beginRawWindowCaptureProjection(
  manifest: RawWindowAuditManifest,
): Promise<boolean> {
  if (process.env.RAW_WINDOW_EVIDENCE_TEST_MODE === 'true') return true;
  const db = getSharedDb();
  const sourceSessionId = sessionIdFor(manifest.sourceSha256);
  const rows = await evidenceRows(manifest.sourceSha256);
  if (rows.some(row =>
    row.eventType === RESULT_EVENT && dispositionOf(row.payloadJson) === 'capture-staged'
  )) {
    return false;
  }
  const sequenceNumber = Math.max(0, ...rows.map(row => row.sequenceNumber)) + 1;
  await db.insert(contextLineageEvents).values({
    id: randomUUID(),
    traceId: sourceSessionId,
    sessionId: sourceSessionId,
    conversationId: rows.find(row => row.conversationId)?.conversationId ?? null,
    sequenceNumber,
    sourceRoute: 'record-window',
    eventType: PROJECTION_STARTED_EVENT,
    deliveryChannel: 'raw-window',
    deliveryStatus: 'queued',
    payloadJson: {
      sourceSha256: manifest.sourceSha256,
      disposition: 'projection-started',
      intendedDisposition: 'capture-staged',
      emittedTurnCount: manifest.emittedTurnCount,
    },
    payloadSha256: manifest.sourceSha256,
    privacyClassification: 'private-evidence',
    observedAt: new Date(),
  });
  return true;
}

/**
 * Aggregates the immutable DB rows after they have been read. Keeping the
 * grouping separate makes the source/session boundary testable without ever
 * inserting synthetic rows into the append-only production evidence ledger.
 */
export function summarizeRawWindowEvidenceLedgerRows(
  rows: RawWindowEvidenceLedgerRow[],
): Omit<RawWindowEvidenceLedgerSummary, 'state' | 'error'> {
  const workspaceSources = rows.filter(row => {
      if (row.eventType !== SOURCE_EVENT) return false;
      const payload = row.payloadJson as Record<string, unknown> | null;
      const rawSourcePath = payload?.rawSourcePath;
      return typeof rawSourcePath === 'string'
        // Raw-window tests use disposable /tmp directories. The append-only
        // ledger intentionally preserves their historical rows, but live
        // capture status must describe only workspace evidence.
        && !rawSourcePath.startsWith('/tmp/')
        // One earlier CI attempt wrote this explicitly labeled marker before
        // the append-only ledger's no-delete trigger was discovered. Do not
        // report a CI fixture as user-visible source evidence.
        && !rawSourcePath.includes('/.local/ci-raw-window-summary-');
  });
  const workspaceSessionIds = new Set(workspaceSources.map(row => row.sessionId));
  let unresolvedSources = 0;
  let unresolvedBytes = 0;
  const started = new Set<string>();
  const completed = new Set<string>();
  for (const source of workspaceSources) {
    const payload = source.payloadJson as Record<string, unknown> | null;
    const reconciliation = payload?.reconciliation as Record<string, unknown> | undefined;
    if (reconciliation?.status === 'unresolved') {
      unresolvedSources++;
      unresolvedBytes += Number(reconciliation.unexplainedBytes) || 0;
    }
  }
  for (const row of rows) {
    if (!workspaceSessionIds.has(row.sessionId)) continue;
    if (row.eventType === PROJECTION_STARTED_EVENT) started.add(row.sessionId);
    if (
      row.eventType === RESULT_EVENT
      && ['capture-staged', 'origin-recorded'].includes(dispositionOf(row.payloadJson) ?? '')
    ) {
      completed.add(row.sessionId);
    }
  }
  return {
    sourceCount: workspaceSources.length,
    unresolvedSources,
    unresolvedBytes,
    incompleteProjections: [...started].filter(sessionId => !completed.has(sessionId)).length,
  };
}

/** Query the canonical ledger for status; local audit sidecars are not proof. */
export async function getRawWindowEvidenceLedgerSummary(): Promise<RawWindowEvidenceLedgerSummary> {
  try {
    const rows = await getMonitoringDb()
      .select({
        sessionId: contextLineageEvents.sessionId,
        eventType: contextLineageEvents.eventType,
        payloadJson: contextLineageEvents.payloadJson,
      })
      .from(contextLineageEvents)
      .where(eq(contextLineageEvents.sourceRoute, 'record-window'));
    return {
      state: 'available',
      ...summarizeRawWindowEvidenceLedgerRows(rows),
    };
  } catch (error) {
    return {
      state: 'unavailable',
      sourceCount: 0,
      unresolvedSources: 0,
      unresolvedBytes: 0,
      incompleteProjections: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Persists the full source in the append-only evidence ledger before it can be
 * projected into dialogue. The raw text is evidence, never speaker-attributed
 * episode prose; its audit manifest remains structured provenance.
 */
export async function persistRawWindowEvidence(
  manifest: RawWindowAuditManifest,
  rawWindow: string,
  episodeName?: string,
): Promise<{ sourceEventId: string }> {
  if (process.env.RAW_WINDOW_EVIDENCE_TEST_MODE === 'true') {
    return { sourceEventId: `test-${manifest.sourceSha256.slice(0, 24)}` };
  }
  const db = getSharedDb();
  const sourceSessionId = sessionIdFor(manifest.sourceSha256);
  const sourceRows = await db
    .select({ id: contextLineageEvents.id })
    .from(contextLineageEvents)
    .where(and(
      eq(contextLineageEvents.sessionId, sourceSessionId),
      eq(contextLineageEvents.sequenceNumber, 1),
    ))
    .limit(1);

  let conversationId: string | null = null;
  if (episodeName) {
    const episode = await db
      .select({ id: conversationMemories.id })
      .from(conversationMemories)
      .where(eq(conversationMemories.title, episodeName))
      .limit(1);
    conversationId = episode[0]?.id ?? null;
  }

  const sourceEventId = sourceRows[0]?.id ?? randomUUID();
  if (sourceRows.length === 0) {
    await db.insert(contextLineageEvents).values({
      id: sourceEventId,
      traceId: sourceSessionId,
      sessionId: sourceSessionId,
      conversationId,
      sequenceNumber: 1,
      sourceRoute: 'record-window',
      eventType: SOURCE_EVENT,
      deliveryChannel: 'raw-window',
      deliveryStatus: 'observed',
      payloadText: rawWindow,
      payloadJson: {
        sourceSha256: manifest.sourceSha256,
        sourceKind: manifest.sourceKind,
        disposition: manifest.disposition,
        episodeName: episodeName ?? null,
        rawSourcePath: manifest.rawSourcePath,
        sourceBytes: manifest.reconciliation.sourceBytes,
        reconciliation: manifest.reconciliation,
        useConstraint: manifest.useConstraint ?? null,
      },
      payloadSha256: manifest.sourceSha256,
      privacyClassification: 'private-evidence',
      observedAt: new Date(),
    });
  }

  // Capture-result metadata is a separate immutable event. It never rewrites
  // the original source observation and therefore preserves the DB-first trail.
  if (
    manifest.disposition !== 'audit-passed-pending-capture'
    && manifest.disposition !== 'origin-recorded'
  ) {
    const rows = await evidenceRows(manifest.sourceSha256);
    const alreadyRecorded = rows.some(row =>
      row.eventType === RESULT_EVENT
      && dispositionOf(row.payloadJson) === manifest.disposition,
    );
    if (!alreadyRecorded) {
      await db.insert(contextLineageEvents).values({
        id: randomUUID(),
        traceId: sourceSessionId,
        sessionId: sourceSessionId,
        conversationId: conversationId ?? rows.find(row => row.conversationId)?.conversationId ?? null,
        sequenceNumber: Math.max(0, ...rows.map(row => row.sequenceNumber)) + 1,
        sourceRoute: 'record-window',
        eventType: RESULT_EVENT,
        deliveryChannel: 'raw-window',
        deliveryStatus: ['capture-staged', 'origin-recorded'].includes(manifest.disposition) ? 'consumed' : 'observed',
        payloadJson: {
          sourceSha256: manifest.sourceSha256,
          disposition: manifest.disposition,
          emittedTurnCount: manifest.emittedTurnCount,
          emittedDialogueBytes: manifest.emittedDialogueBytes,
          captureRange: manifest.captureRange ?? null,
          capturedBytesSha256: manifest.capturedBytesSha256 ?? null,
          reconciliationStatus: manifest.reconciliation.status,
          unresolvedBytes: manifest.reconciliation.unexplainedBytes,
          reason: manifest.reason ?? null,
          useConstraint: manifest.useConstraint ?? null,
        },
        payloadSha256: manifest.sourceSha256,
        privacyClassification: 'private-evidence',
        observedAt: new Date(),
      });
    }
  }

  return { sourceEventId };
}

/** Mark the origin-data projection only after DB-first episode + Markdown sync succeeds. */
export async function markRawWindowOriginRecorded(
  manifest: RawWindowAuditManifest,
): Promise<void> {
  if (process.env.RAW_WINDOW_EVIDENCE_TEST_MODE === 'true') return;
  const rows = await evidenceRows(manifest.sourceSha256);
  if (rows.some(row =>
    row.eventType === RESULT_EVENT && dispositionOf(row.payloadJson) === 'origin-recorded'
  )) {
    return;
  }
  const sourceSessionId = sessionIdFor(manifest.sourceSha256);
  await getSharedDb().insert(contextLineageEvents).values({
    id: randomUUID(),
    traceId: sourceSessionId,
    sessionId: sourceSessionId,
    conversationId: rows.find(row => row.conversationId)?.conversationId ?? null,
    sequenceNumber: Math.max(0, ...rows.map(row => row.sequenceNumber)) + 1,
    sourceRoute: 'record-window',
    eventType: RESULT_EVENT,
    deliveryChannel: 'raw-window',
    deliveryStatus: 'consumed',
    payloadJson: {
      sourceSha256: manifest.sourceSha256,
      disposition: 'origin-recorded',
      classification: 'unknown',
      emittedTurnCount: 1,
      emittedDialogueBytes: manifest.reconciliation.sourceBytes,
      reconciliationStatus: manifest.reconciliation.status,
      unresolvedBytes: manifest.reconciliation.unexplainedBytes,
      reason: manifest.reason ?? null,
      useConstraint: manifest.useConstraint ?? null,
    },
    payloadSha256: manifest.sourceSha256,
    privacyClassification: 'private-evidence',
    observedAt: new Date(),
  });
}