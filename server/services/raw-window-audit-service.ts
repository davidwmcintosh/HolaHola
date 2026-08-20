import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { WORKSPACE, DialogueTurn } from './transcript-parser';
import { classifyRawWindowForAttachment, RawWindowClassifiedSegment, RawWindowMatchedTurn } from './raw-window-attachment'; // Reusing classification logic

export type RawWindowAuditStatus = 'pending' | 'approved' | 'rejected' | 'processed';

export interface RawWindowAuditManifest {
  auditId: string;
  timestamp: string;
  rawBytesHash: string;
  retainedPayloadBytes: number;
  permittedFormattingRemovalBytes: number; // Placeholder, will need logic to calculate
  structuralMarkerBytes: number; // Placeholder, will need logic to calculate
  categorizedSpans: RawWindowClassifiedSegment[];
  byteConservationRatio: number; // retained / raw
  unresolvedAmbiguousInput: string[];
  cleanedDialogue: DialogueTurn[];
  auditStatus: RawWindowAuditStatus;
  rawSourcePath: string;
  auditManifestPath?: string;
}

export function createAuditManifest(
  rawWindow: string,
  rawBytes: Buffer,
  parsedTurns: DialogueTurn[],
  matchedTurns: RawWindowMatchedTurn[], // From raw-window-attachment's classification
  capturedTurns: DialogueTurn[], // From raw-window-attachment's classification
): RawWindowAuditManifest {
  const auditId = createHash('sha256').update(rawBytes).digest('hex'); // Using rawBytes hash as auditId
  const rawBytesHash = auditId;
  const retainedPayloadBytes = rawBytes.byteLength;

  // Reusing classification logic from raw-window-attachment for initial categorization
  const categorizedSpans = classifyRawWindowForAttachment(rawWindow, matchedTurns, capturedTurns);

  // Placeholder calculations for now, will be refined
  const permittedFormattingRemovalBytes = 0;
  const structuralMarkerBytes = 0;
  const byteConservationRatio = 1.0; // Placeholder

  const unresolvedAmbiguousInput: string[] = [];
  categorizedSpans.forEach(segment => {
    if (segment.classification === 'unknown') {
      unresolvedAmbiguousInput.push(`[Line ${segment.startLine}-${segment.endLine}] ${segment.text}`);
    }
  });

  return {
    auditId,
    timestamp: new Date().toISOString(),
    rawBytesHash,
    retainedPayloadBytes,
    permittedFormattingRemovalBytes,
    structuralMarkerBytes,
    categorizedSpans,
    byteConservationRatio,
    unresolvedAmbiguousInput,
    cleanedDialogue: parsedTurns,
    auditStatus: 'pending',
    rawSourcePath: join(WORKSPACE, '.local', 'raw-window-captures', `${rawBytesHash}.raw`),
  };
}

export function persistAuditManifest(manifest: RawWindowAuditManifest): string {
  const auditDir = join(WORKSPACE, '.local', 'raw-window-audits');
  mkdirSync(auditDir, { recursive: true });
  const manifestPath = join(auditDir, `${manifest.auditId}.json`);
  const tempPath = `${manifestPath}.tmp-${process.pid}`;
  writeFileSync(tempPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  renameSync(tempPath, manifestPath);
  manifest.auditManifestPath = manifestPath; // Update manifest with its own path
  return manifestPath;
}

export function loadAuditManifest(auditId: string): RawWindowAuditManifest | null {
  const auditDir = join(WORKSPACE, '.local', 'raw-window-audits');
  const manifestPath = join(auditDir, `${auditId}.json`);
  if (!existsSync(manifestPath)) {
    return null;
  }
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as RawWindowAuditManifest;
}
