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
  persistRawWindowEvidence,
} from '../services/raw-window-evidence-ledger';
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
  disposition: 'audit-passed-pending-capture' | 'capture-staged' | 'reference-retained' | 'reference-retained-unclassified',
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

const referenceConstraint = 'Reference only. Never render as ordinary dialogue; any future gap-fill must identify the missing original record and acknowledge David supplied this cut-and-paste.';

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
    'reference-retained',
    {
      reason,
      useConstraint: referenceConstraint,
    },
  );
  const persisted = await persistRawWindowEvidence(result.manifest, rawWindow, episodeName);
  markEvidenceLedgerPersisted(persisted.sourceEventId);
  console.log(`[record-window] ✓ Reference dump retained outside the episode: ${result.auditPath}`);
  console.log(`  Raw source SHA-256: ${sourceSha}`);
  await closeDbConnections();
  process.exit(0);
}

const receiptVerification = verifyTrustedReplitDumpReceipt(receiptPath, rawBytes);
if (!receiptVerification.ok) {
  const result = emitAudit(
    [],
    'replit-window',
    'reference-retained',
    {
      reason: receiptVerification.reason,
      useConstraint: 'Receipt verification failed. Retain as reference-only; never project this source as canonical dialogue.',
    },
  );
  const persisted = await persistRawWindowEvidence(result.manifest, rawWindow, episodeName);
  markEvidenceLedgerPersisted(persisted.sourceEventId);
  await closeDbConnections();
  fail(`Canonical capture rejected; source retained as reference-only: ${result.auditPath}. ${receiptVerification.reason}`);
}
const sourceReceipt = receiptVerification.summary;

let parsed = parseRawWindowCapture(rawWindow);
let usedAlignmentPath = false;
if (!parsed.ok && !/^\s*(?:\*\*)?(?:David|Luca(?:\s+\[Replit\])?):/im.test(rawWindow)) {
  const captureTurns = parseChatCaptureFromOffset(davidCapturePath, 0).turns;
  const lastLucaIndex = captureTurns.reduce(
    (last, turn, index) => turn.speaker === 'LUCA' ? index : last,
    -1,
  );
  const anchors = captureTurns
    .slice(lastLucaIndex + 1)
    .filter(turn => turn.speaker === 'DAVID')
    .map(turn => ({ text: turn.text }));
  parsed = alignUnlabelledRawWindow(rawWindow, anchors);
  usedAlignmentPath = parsed.ok;
}

if (!parsed.ok) {
  const reference = Boolean(episodeName);
  const result = emitAudit(
    [],
    reference ? 'david-reference-dump' : 'replit-window',
    reference ? 'reference-retained-unclassified' : 'reference-retained-unclassified',
    {
      reason: parsed.reason,
      ...(reference ? { useConstraint: referenceConstraint } : {}),
    },
  );

  const persisted = await persistRawWindowEvidence(result.manifest, rawWindow, episodeName);
  markEvidenceLedgerPersisted(persisted.sourceEventId);
  if (reference) {
    console.log(`[record-window] ✓ Unclassified reference retained outside the episode: ${result.auditPath}`);
    process.exit(0);
  }
  fail(`${parsed.reason} Raw source retained with audit: ${result.auditPath}`);
}

const turns = asDialogueTurns(parsed.turns);
const preCaptureAudit = emitAudit(turns, 'replit-window', 'audit-passed-pending-capture', { sourceReceipt });
const initialEvidence = await persistRawWindowEvidence(preCaptureAudit.manifest, rawWindow, episodeName);
markEvidenceLedgerPersisted(initialEvidence.sourceEventId);
if (!await beginRawWindowCaptureProjection(preCaptureAudit.manifest)) {
  await closeDbConnections();
  fail('This raw source already has a completed capture projection; refusing to append duplicate dialogue.');
}

const lucaPlans: Array<{ text: string; channels: ReturnType<typeof parseCanonicalFourChannelLucaTurn> }> = [];
if (!usedAlignmentPath) {
  for (const turn of parsed.turns) {
    if (turn.speaker !== 'Luca Replit') continue;
    const channels = parseCanonicalFourChannelLucaTurn(turn.text);
    if (!channels) fail('Internal error: a validated Luca envelope could not be parsed.');
    lucaPlans.push({ text: turn.text, channels });
  }
}

const sizeBefore = existsSync(capturePath) ? statSync(capturePath).size : 0;
const existingTurns = parseChatCaptureFromOffset(capturePath, 0).turns;
let lucaIndex = 0;
for (const turn of parsed.turns) {
  const expectedSpeaker = turn.speaker === 'David' ? 'DAVID' : 'LUCA';
  if (existingTurns.some(existing => existing.speaker === expectedSpeaker && existing.text === turn.text)) {
    continue;
  }
  if (turn.speaker === 'David') {
    appendChatCaptureTurn('David', turn.text, capturePath);
    continue;
  }
  if (usedAlignmentPath) {
    appendChatCaptureTurn('Luca Replit', turn.text, capturePath);
    continue;
  }
  const plan = lucaPlans[lucaIndex++];
  const handoff = writeCanonicalIntent(plan.channels!, intentDir ? join(intentDir, `${randomUUID()}.json`) : undefined);
  appendChatCaptureTurn('Luca Replit', plan.text, capturePath, handoff.intent.turnId);
  markCanonicalIntentCaptured(handoff);
}
const sizeAfter = existsSync(capturePath) ? statSync(capturePath).size : 0;
const capturedBytes = readFileSync(capturePath).subarray(sizeBefore, sizeAfter);
const stagedAudit = emitAudit(turns, 'replit-window', 'capture-staged', {
  captureRange: { startByteOffset: sizeBefore, endByteOffset: sizeAfter },
  capturedBytesSha256: createHash('sha256').update(capturedBytes).digest('hex'),
  sourceReceipt,
});
const stagedEvidence = await persistRawWindowEvidence(stagedAudit.manifest, rawWindow, episodeName);
markEvidenceLedgerPersisted(stagedEvidence.sourceEventId);
console.log(`[record-window] ✓ Raw window cleaned into ${parsed.turns.length} dialogue turn(s) (${sizeBefore}B → ${sizeAfter}B)`);
console.log(`  Audit: ${stagedAudit.auditPath}`);
console.log(`  Accounting: removed ${stagedAudit.reconciliation.removedBytes}B formatting/chrome; structural ${stagedAudit.reconciliation.structuralBytes}B; emitted ${stagedAudit.reconciliation.emittedDialogueBytes}B.`);
console.log('  Autosave will route the cleaned dialogue to conversation_memories + the rolling episode within ~20s.');
await closeDbConnections();
