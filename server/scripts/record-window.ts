/**
 * Capture a complete Replit-window paste without reconstructing dialogue.
 *
 * A SHA-keyed raw file is always retained first. Before valid, cleaned turns
 * enter .chat_capture (the DB/Markdown pipe), a private audit manifest records
 * exact transform accounting. Personal/manual dumps stay reference-only until
 * an explicitly attributed missing-record gap-fill is approved.
 */
import { createHash, randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import { closeDbConnections } from '../db';
import { appendRawWindowOriginToEpisodeDb } from '../services/agent-session-autosave';
import { parseCanonicalFourChannelLucaTurn } from '../services/inner-life-capture';
import { alignUnlabelledRawWindow } from '../services/raw-window-attribution';
import {
  createRawWindowAuditManifest,
  persistRawWindowAuditManifest,
  TrustedReplitDumpReceiptSummary,
  verifyTrustedReplitDumpReceipt,
} from '../services/raw-window-audit-service';
import { createRawWindowAttachmentPlan } from '../services/raw-window-attachment';
import { parseRawWindowCapture } from '../services/raw-window-capture';
import { reconcileRawWindowEvidence } from '../services/raw-window-reconciliation';
import {
  beginRawWindowCaptureProjection,
  markRawWindowOriginRecorded,
  persistRawWindowEvidence,
} from '../services/raw-window-evidence-ledger';
import {
  linkRawReplitCaptureToProjection,
  persistRawReplitCapture,
} from '../services/raw-replit-capture';
import {
  appendChatCaptureTurn,
  CHAT_CAPTURE_PATH,
  DialogueTurn,
  parseChatCaptureFromOffset,
  WORKSPACE,
} from '../services/transcript-parser';
import { markCanonicalIntentCaptured, writeCanonicalIntent } from './record-exchange';

const args = process.argv.slice(2);
const windowIndex = args.indexOf('--window-file');
const sourceDirIndex = args.indexOf('--source-dir');
const capturePathIndex = args.indexOf('--capture-path');
const davidCapturePathIndex = args.indexOf('--david-capture-path');
const intentDirIndex = args.indexOf('--intent-dir');
const episodeIndex = args.indexOf('--episode');

const receiptPathIndex = args.indexOf('--receipt-path');
const attachExisting = args.includes('--attach-existing');
const verifiedReplitDump = args.includes('--verified-replit-dump');

function fail(message: string): never {
  console.error(`[record-window] ERROR: ${message}`);
  process.exit(1);
}

async function persistRawWindowEvidenceWithSource(
  manifest: Parameters<typeof persistRawWindowEvidence>[0],
  rawWindow: string,
  rawWindowBytes: Buffer,
  episodeName?: string,
) {
  // Source first: neither reference-only nor attributed projection may create
  // a lineage event until the exact collector-visible bytes are durable.
  const rawCapture = await persistRawReplitCapture({
    sourceKey: `raw-window:${manifest.sourceSha256}`,
    sourceRoute: 'record-window',
    events: [{
      sequenceNumber: 1,
      eventType: 'raw-window-source',
      payloadText: rawWindow,
      payloadBytes: rawWindowBytes,
      idempotencyKey: 'source',
      metadata: {
        sourceSha256: manifest.sourceSha256,
        sourceKind: manifest.sourceKind,
        sourceBytes: manifest.reconciliation.sourceBytes,
      },
    }],
    metadata: {
      sourceSha256: manifest.sourceSha256,
      sourceKind: manifest.sourceKind,
      disposition: manifest.disposition,
    },
  });
  const persisted = await persistRawWindowEvidence(manifest, rawWindow, episodeName);
  // Raw-window source remains evidence even when later reconciliation proves
  // dialogue; attribution is represented by the downstream audit events.
  await linkRawReplitCaptureToProjection({
    capture: rawCapture,
    targetKind: 'context-lineage-event',
    targetKey: persisted.sourceEventId,
    disposition: 'evidence',
    metadata: {
      sourceSha256: manifest.sourceSha256,
      lineageEventType: 'raw_window_source_observed',
    },
  });
  return { ...persisted, rawCapture };
}

function rawWindowOriginBlock(
  rawWindow: string,
  sourceSha256: string,
  sourceBytes: number,
  sourceKind: string,
  reason?: string,
): string {
  return [
    '**[RAW WINDOW — ORIGIN DATA]:**',
    '[CLASSIFICATION: UNKNOWN]',
    `[ORIGIN SHA-256: ${sourceSha256}]`,
    `[ORIGIN BYTES: ${sourceBytes}]`,
    `[ORIGIN SOURCE: ${sourceKind}]`,
    ...(reason ? [`[INITIAL NOTE: ${reason}]`] : []),
    '',
    rawWindow,
  ].join('\n');
}

async function persistAndProjectRawWindowOrigin(
  result: ReturnType<typeof emitAudit>,
  rawWindow: string,
  rawWindowBytes: Buffer,
  episodeName?: string,
) {
  if (!episodeName) {
    throw new Error('Raw-window origin data requires --episode <episode-file> so it can enter the canonical DB/Markdown record.');
  }
  const persisted = await persistRawWindowEvidenceWithSource(
    result.manifest,
    rawWindow,
    rawWindowBytes,
    episodeName,
  );
  const projected = await appendRawWindowOriginToEpisodeDb(
    rawWindowOriginBlock(
      rawWindow,
      result.manifest.sourceSha256,
      result.manifest.reconciliation.sourceBytes,
      result.manifest.sourceKind,
      result.manifest.reason,
    ),
    episodeName,
    result.manifest.sourceSha256,
  );
  if (!projected) {
    throw new Error(`Raw-window origin source ${result.manifest.sourceSha256} is durable but its canonical episode projection failed.`);
  }
  await markRawWindowOriginRecorded(result.manifest);
  await linkRawReplitCaptureToProjection({
    capture: persisted.rawCapture,
    targetKind: 'episode-origin-record',
    targetKey: `${episodeName}:${result.manifest.sourceSha256}`,
    disposition: 'origin-data',
    metadata: {
      sourceSha256: result.manifest.sourceSha256,
      classification: 'unknown',
      episodeName,
    },
  });
  return persisted;
}

if (windowIndex === -1 || !args[windowIndex + 1]) {
  fail('Usage: npx tsx server/scripts/record-window.ts --window-file <path> [--verified-replit-dump --receipt-path <path>] [--attach-existing --episode <episode-name>] [--source-dir <path>] [--capture-path <test-path>] [--david-capture-path <test-path>] [--intent-dir <test-path>]');
}

const rawBytes = readFileSync(args[windowIndex + 1]);
const rawWindow = rawBytes.toString('utf8');
if (!rawWindow.trim()) fail('window file is empty');

const sourceDir = sourceDirIndex === -1
  ? join(WORKSPACE, '.local', 'raw-window-captures')
  : args[sourceDirIndex + 1];
if (!sourceDir) fail('--source-dir requires a path');
const capturePath = capturePathIndex === -1 ? CHAT_CAPTURE_PATH : args[capturePathIndex + 1];
if (!capturePath) fail('--capture-path requires a path');
const davidCapturePath = davidCapturePathIndex === -1 ? capturePath : args[davidCapturePathIndex + 1];
if (!davidCapturePath) fail('--david-capture-path requires a path');
const intentDir = intentDirIndex === -1 ? undefined : args[intentDirIndex + 1];
if (intentDirIndex !== -1 && !intentDir) fail('--intent-dir requires a path');
const episodeName = episodeIndex === -1 ? undefined : args[episodeIndex + 1];
const sourceSha = createHash('sha256').update(rawBytes).digest('hex');

const receiptPath = receiptPathIndex === -1 ? join(sourceDir, `${sourceSha}.replit-receipt.json`) : args[receiptPathIndex + 1];
const sourcePath = join(sourceDir, `${sourceSha}.raw`);
mkdirSync(dirname(sourcePath), { recursive: true });
if (existsSync(sourcePath)) {
  if (!readFileSync(sourcePath).equals(rawBytes)) {
    fail(`raw source SHA-256 collision or prior source corruption at ${sourcePath}`);
  }
} else {
  const tempPath = `${sourcePath}.tmp-${process.pid}`;
  writeFileSync(tempPath, rawBytes);
  renameSync(tempPath, sourcePath);
}

function asDialogueTurns(turns: Array<{ speaker: 'David' | 'Luca Replit'; text: string }>): DialogueTurn[] {
  return turns.map(turn => ({
    speaker: turn.speaker === 'David' ? 'DAVID' : 'LUCA',
    text: turn.text,
    memoryId: 0,
  }));
}

function writeSourceMetadata(metadata: object): void {
  const path = join(sourceDir, `${sourceSha}.json`);
  let priorMetadata: Record<string, unknown> = {};
  if (existsSync(path)) {
    try {
      priorMetadata = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    } catch {
      // The new metadata is still the authoritative local audit state.
    }
  }
  const tempPath = `${path}.tmp-${process.pid}`;
  writeFileSync(tempPath, JSON.stringify({ ...priorMetadata, ...metadata }, null, 2) + '\n', 'utf8');
  renameSync(tempPath, path);
}

function markEvidenceLedgerPersisted(sourceEventId: string): void {
  writeSourceMetadata({
    evidenceLedger: {
      sourceEventId,
      persistedAt: new Date().toISOString(),
    },
  });
}

function emitAudit(
  turns: DialogueTurn[],
  sourceKind: 'replit-window' | 'david-reference-dump',
  disposition: 'audit-passed-pending-capture' | 'capture-staged' | 'origin-recorded' | 'reference-retained' | 'reference-retained-unclassified',
  options: {
    captureRange?: { startByteOffset: number; endByteOffset: number };
    capturedBytesSha256?: string;
    reason?: string;
    useConstraint?: string;
    sourceReceipt?: TrustedReplitDumpReceiptSummary;
  } = {},
) {
  const emittedDialogue = turns
    .map(turn => `${turn.speaker === 'DAVID' ? 'David' : 'Luca Replit'}: ${turn.text}`)
    .join('\n\n');
  const reconciliation = reconcileRawWindowEvidence({
    rawWindow,
    rawBytes,
    attestedTurns: turns,
    emittedDialogue,
    ...(options.reason ? { noMatchReason: options.reason } : {}),
  });
  const manifest = createRawWindowAuditManifest({
    rawBytes,
    rawSourcePath: sourcePath,
    sourceKind,
    disposition,
    reconciliation,
    emittedTurns: turns,
    ...options,
  });
  const artifact = disposition === 'audit-passed-pending-capture'
    ? 'precommit'
    : disposition === 'capture-staged'
      ? 'capture-receipt'
      : 'reference';
  const auditPath = persistRawWindowAuditManifest(sourceDir, manifest, artifact);
  writeSourceMetadata({
    version: 2,
    status: disposition,
    sourceKind,
    sourceSha256: sourceSha,
    sourceBytes: rawBytes.byteLength,
    rawSourcePath: sourcePath,
    auditManifestPath: auditPath,
    ...(episodeName ? { episodeContext: episodeName } : {}),
    ...(options.reason ? { reason: options.reason } : {}),
    ...(options.useConstraint ? { useConstraint: options.useConstraint } : {}),
    ...(options.sourceReceipt ? {
      trustedReplitSourceReceipt: {
        path: receiptPath,
        ...options.sourceReceipt,
      },
    } : {}),
    reconciliation,
  });
  return { auditPath, reconciliation, manifest };
}

const referenceConstraint = 'Origin data. Preserve and render as a labeled raw-window block; attribution may be refined later without changing the source.';

// Manual input is reference-only by default. A producer that has obtained the
// actual Replit verbatim dump must present a signed receipt from the trusted
// intake collector; merely selecting a file or setting a CLI flag cannot
// accidentally promote David's cut-and-paste into canonical dialogue.
if (attachExisting || !verifiedReplitDump) {
  if (attachExisting && !episodeName) fail('--attach-existing requires --episode <episode-name> to name the reference context.');
  const parsedCapture = parseChatCaptureFromOffset(capturePath, 0);
  const attachment = createRawWindowAttachmentPlan(
    rawWindow,
    rawBytes,
    parsedCapture,
    existsSync(capturePath) ? readFileSync(capturePath) : undefined,
  );
  const reason = attachment.ok
    ? attachment.plan.reconciliation.reason
    : attachment.reason;
  const result = emitAudit(
    [],
    'david-reference-dump',
    'origin-recorded',
    {
      reason,
      useConstraint: referenceConstraint,
    },
  );
  const persisted = await persistAndProjectRawWindowOrigin(result, rawWindow, rawBytes, episodeName);
  markEvidenceLedgerPersisted(persisted.sourceEventId);
  console.log(`[record-window] ✓ Raw origin data projected into the canonical episode: ${result.auditPath}`);
  console.log(`  Raw source SHA-256: ${sourceSha}`);
  await closeDbConnections();
  process.exit(0);
}

const receiptVerification = verifyTrustedReplitDumpReceipt(receiptPath, rawBytes);
if (!receiptVerification.ok) {
  const result = emitAudit(
    [],
    'replit-window',
    'origin-recorded',
    {
      reason: receiptVerification.reason,
      useConstraint: 'Origin data with an invalid receipt. Preserve and render the raw source; do not invent speaker attribution.',
    },
  );
  const persisted = await persistAndProjectRawWindowOrigin(result, rawWindow, rawBytes, episodeName);
  markEvidenceLedgerPersisted(persisted.sourceEventId);
  await closeDbConnections();
  console.log(`[record-window] ✓ Invalid-receipt source projected as origin data: ${result.auditPath}. ${receiptVerification.reason}`);
  process.exit(0);
}
const sourceReceipt = receiptVerification.summary;
// A receipt minted by the authenticated intake establishes that a caller
// submitted these bytes, but it does not carry a non-forgeable host event or
// collector identity. Until that ingress exists, this remains raw evidence and
// cannot authorize attributed canonical dialogue.
const unboundReceiptResult = emitAudit(
  [],
  'replit-window',
  'origin-recorded',
  {
    reason: 'Receipt verified byte integrity; collector-origin provenance is not yet available.',
    useConstraint: 'Origin data. Preserve and render the source with unknown classification; do not invent a speaker attribution.',
    sourceReceipt,
  },
);
const unboundReceiptEvidence = await persistAndProjectRawWindowOrigin(
  unboundReceiptResult,
  rawWindow,
  rawBytes,
  episodeName,
);
markEvidenceLedgerPersisted(unboundReceiptEvidence.sourceEventId);
console.log(`[record-window] ✓ Receipt-backed window projected as raw origin data: ${unboundReceiptResult.auditPath}`);
await closeDbConnections();
process.exit(0);
