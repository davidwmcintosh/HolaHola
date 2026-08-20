import { createHash } from 'crypto';
import { mkdirSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import { RawWindowReconciliation } from './raw-window-reconciliation';
import { DialogueTurn } from './transcript-parser';

export type RawWindowAuditDisposition =
  | 'audit-passed-pending-capture'
  | 'capture-staged'
  | 'reference-retained'
  | 'reference-retained-unclassified';

/**
 * Private pipeline accounting. This is intentionally an audit of transforms,
 * not a second representation of the source: it never stores raw prose or
 * cleaned dialogue text.
 */
export interface RawWindowAuditManifest {
  version: 1;
  sourceSha256: string;
  sourceKind: 'replit-window' | 'david-reference-dump';
  disposition: RawWindowAuditDisposition;
  rawSourcePath: string;
  reconciliation: RawWindowReconciliation;
  emittedTurnCount: number;
  emittedDialogueBytes: number;
  captureRange?: { startByteOffset: number; endByteOffset: number };
  capturedBytesSha256?: string;
  reason?: string;
  useConstraint?: string;
}

export function createRawWindowAuditManifest(input: {
  rawBytes: Buffer;
  rawSourcePath: string;
  sourceKind: RawWindowAuditManifest['sourceKind'];
  disposition: RawWindowAuditDisposition;
  reconciliation: RawWindowReconciliation;
  emittedTurns: readonly DialogueTurn[];
  captureRange?: RawWindowAuditManifest['captureRange'];
  capturedBytesSha256?: string;
  reason?: string;
  useConstraint?: string;
}): RawWindowAuditManifest {
  return {
    version: 1,
    sourceSha256: createHash('sha256').update(input.rawBytes).digest('hex'),
    sourceKind: input.sourceKind,
    disposition: input.disposition,
    rawSourcePath: input.rawSourcePath,
    reconciliation: input.reconciliation,
    emittedTurnCount: input.emittedTurns.length,
    emittedDialogueBytes: input.reconciliation.emittedDialogueBytes,
    ...(input.captureRange ? { captureRange: input.captureRange } : {}),
    ...(input.capturedBytesSha256 ? { capturedBytesSha256: input.capturedBytesSha256 } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.useConstraint ? { useConstraint: input.useConstraint } : {}),
  };
}

export function persistRawWindowAuditManifest(
  sourceDir: string,
  manifest: RawWindowAuditManifest,
  artifact: 'precommit' | 'capture-receipt' | 'reference' = 'precommit',
): string {
  const outputPath = join(sourceDir, `${manifest.sourceSha256}.${artifact}.audit.json`);
  mkdirSync(dirname(outputPath), { recursive: true });
  const tempPath = `${outputPath}.tmp-${process.pid}`;
  writeFileSync(tempPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  renameSync(tempPath, outputPath);
  return outputPath;
}