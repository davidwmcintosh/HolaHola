import { createHash, createPublicKey, verify as verifySignature } from 'crypto';
import { mkdirSync, renameSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import { RawWindowReconciliation } from './raw-window-reconciliation';
import { DialogueTurn } from './transcript-parser';

export type RawWindowAuditDisposition =
  | 'audit-passed-pending-capture'
  | 'capture-staged'
  | 'origin-recorded'
  | 'reference-retained'
  | 'reference-retained-unclassified';

const RAW_WINDOW_RECEIPT_ROUTE = 'trusted-replit-dump-intake';
export const TRUSTED_REPLIT_WINDOW_RECEIPT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAiYKP5y+50eT5USOmMDEuf1pVLElL4Xb+u6RZAB0FbMI=
-----END PUBLIC KEY-----
`;

export interface TrustedReplitDumpReceipt {
  version: 1;
  receiptId: string;
  intakeRoute: typeof RAW_WINDOW_RECEIPT_ROUTE;
  sourceSha256: string;
  sourceBytes: number;
  issuedAt: string;
  expiresAt: string;
  signature: string;
}

export interface TrustedReplitDumpReceiptSummary {
  receiptId: string;
  intakeRoute: typeof RAW_WINDOW_RECEIPT_ROUTE;
  sourceSha256: string;
  sourceBytes: number;
  issuedAt: string;
  expiresAt: string;
}

function receiptPayload(receipt: Omit<TrustedReplitDumpReceipt, 'signature'>): string {
  return [
    receipt.version,
    receipt.receiptId,
    receipt.intakeRoute,
    receipt.sourceSha256,
    receipt.sourceBytes,
    receipt.issuedAt,
    receipt.expiresAt,
  ].join('|');
}

function receiptSummary(receipt: TrustedReplitDumpReceipt): TrustedReplitDumpReceiptSummary {
  return {
    receiptId: receipt.receiptId,
    intakeRoute: receipt.intakeRoute,
    sourceSha256: receipt.sourceSha256,
    sourceBytes: receipt.sourceBytes,
    issuedAt: receipt.issuedAt,
    expiresAt: receipt.expiresAt,
  };
}

export type TrustedReplitDumpReceiptVerification =
  | { ok: true; receipt: TrustedReplitDumpReceipt; summary: TrustedReplitDumpReceiptSummary }
  | { ok: false; reason: string };

export function verifyTrustedReplitDumpReceipt(
  receiptPath: string,
  rawBytes: Buffer,
  now = new Date(),
  trustedPublicKeyPem = TRUSTED_REPLIT_WINDOW_RECEIPT_PUBLIC_KEY,
): TrustedReplitDumpReceiptVerification {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(receiptPath, 'utf8'));
  } catch {
    return { ok: false, reason: `Trusted Replit source receipt is missing or unreadable: ${receiptPath}` };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, reason: 'Trusted Replit source receipt is not a JSON object.' };
  }
  const receipt = parsed as Partial<TrustedReplitDumpReceipt>;
  if (
    receipt.version !== 1 ||
    typeof receipt.receiptId !== 'string' ||
    receipt.intakeRoute !== RAW_WINDOW_RECEIPT_ROUTE ||
    typeof receipt.sourceSha256 !== 'string' ||
    typeof receipt.sourceBytes !== 'number' ||
    typeof receipt.issuedAt !== 'string' ||
    typeof receipt.expiresAt !== 'string' ||
    typeof receipt.signature !== 'string'
  ) {
    return { ok: false, reason: 'Trusted Replit source receipt has an invalid shape or intake route.' };
  }

  const expectedSha256 = createHash('sha256').update(rawBytes).digest('hex');
  if (receipt.sourceSha256 !== expectedSha256 || receipt.sourceBytes !== rawBytes.byteLength) {
    return { ok: false, reason: 'Trusted Replit source receipt is bound to different raw bytes.' };
  }

  const issuedAtMs = Date.parse(receipt.issuedAt);
  const expiresAtMs = Date.parse(receipt.expiresAt);
  const nowMs = now.getTime();
  if (!Number.isFinite(issuedAtMs) || !Number.isFinite(expiresAtMs) || expiresAtMs <= issuedAtMs) {
    return { ok: false, reason: 'Trusted Replit source receipt has invalid validity timestamps.' };
  }
  if (issuedAtMs > nowMs + 60_000) {
    return { ok: false, reason: 'Trusted Replit source receipt is issued in the future.' };
  }
  if (nowMs >= expiresAtMs) {
    return { ok: false, reason: 'Trusted Replit source receipt is stale.' };
  }

  try {
    const publicKey = createPublicKey(trustedPublicKeyPem);
    const signatureBytes = Buffer.from(receipt.signature, 'base64url');
    if (!signatureBytes.length || !verifySignature(
      null,
      Buffer.from(receiptPayload({
      version: receipt.version,
      receiptId: receipt.receiptId,
      intakeRoute: receipt.intakeRoute,
      sourceSha256: receipt.sourceSha256,
      sourceBytes: receipt.sourceBytes,
      issuedAt: receipt.issuedAt,
      expiresAt: receipt.expiresAt,
      }), 'utf8'),
      publicKey,
      signatureBytes,
    )) {
      return { ok: false, reason: 'Trusted Replit source receipt signature is invalid.' };
    }
  } catch {
    return { ok: false, reason: 'Trusted Replit source receipt could not be verified.' };
  }

  return { ok: true, receipt: receipt as TrustedReplitDumpReceipt, summary: receiptSummary(receipt as TrustedReplitDumpReceipt) };
}

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
  sourceReceipt?: TrustedReplitDumpReceiptSummary;
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
  sourceReceipt?: TrustedReplitDumpReceiptSummary;
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
    ...(input.sourceReceipt ? { sourceReceipt: input.sourceReceipt } : {}),
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