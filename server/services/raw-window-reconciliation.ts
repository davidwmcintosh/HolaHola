import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync } from 'fs';

import { isKnownWindowChrome } from './raw-window-capture';
import type { DialogueTurn } from './transcript-parser';

export type RawWindowEvidenceClassification =
  | 'dialogue'
  | 'visible-thinking'
  | 'ui-status'
  | 'unknown'
  | 'cleanup'
  | 'structural';

export interface RawWindowSourceSpan {
  classification: RawWindowEvidenceClassification;
  reason: string;
  startLine: number;
  endLine: number;
  startByteOffset: number;
  endByteOffset: number;
  sourceBytes: number;
  sourceCodePoints: number;
}

export interface RawWindowCanonicalScope {
  startByteOffset: number;
  endByteOffset: number;
  sourceBytes?: number;
  sha256?: string;
}

export interface RawWindowReconciliation {
  sourceSha256: string;
  sourceBytes: number;
  sourceCodePoints: number;
  accountedBytes: number;
  dialogueBytes: number;
  evidenceBytes: number;
  cleanupBytes: number;
  /** Speaker/category headers consumed to organise the verbatim payload. */
  structuralBytes: number;
  /** Exact payload bytes emitted into the capture pipe, excluding its framing. */
  emittedDialogueBytes: number;
  /** Formatting/chrome bytes removed from the source; structural markers are separate. */
  removedBytes: number;
  unexplainedBytes: number;
  status: 'reconciled' | 'unresolved';
  reason?: string;
  canonicalScope?: RawWindowCanonicalScope;
  spans: RawWindowSourceSpan[];
}

export interface RawWindowReconciliationInput {
  rawWindow: string;
  rawBytes: Buffer;
  attestedTurns: readonly DialogueTurn[];
  canonicalScope?: RawWindowCanonicalScope;
  noMatchReason?: string;
  /** The exact cleaned turns about to enter the capture → DB path. */
  emittedDialogue?: string;
}

const normalize = (value: string) =>
  value.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();

export function isRawWindowStatusLine(line: string): boolean {
  const value = line.trim();
  return (
    /^show (?:less|more)$/i.test(value) ||
    /^updating (?:memory|transcript|episode) capture$/i.test(value) ||
    /^(?:recording|finalizing|creating)\b/i.test(value) ||
    /^(?:opened|wrote|read|ran|created|deleted)\b.+$/i.test(value) ||
    /^\d+\s+(?:actions?|minutes?\s+ago)$/i.test(value) ||
    /^worked for \d+(?:\.\d+)? (?:seconds?|minutes?)$/i.test(value)
  );
}

export function isRawWindowVisibleThinking(text: string): boolean {
  return /^(?:considering|i['’]m considering|i['’]m pondering|i think i need|i should probably|i want to make sure)\b/i.test(text.trim());
}

function isAttestedDialogueLine(line: string, turns: readonly DialogueTurn[]): boolean {
  const candidate = normalize(line);
  if (candidate.length < 12) return false;
  return turns.some(turn => {
    const source = normalize(turn.text);
    return source.includes(candidate) || candidate.includes(source);
  });
}

function classifyLine(
  textWithoutEol: string,
  attestedTurns: readonly DialogueTurn[],
): Pick<RawWindowSourceSpan, 'classification' | 'reason'> {
  if (!textWithoutEol.trim()) {
    return { classification: 'cleanup', reason: 'blank-line' };
  }
  if (/^\s*(?:\*\*)?(?:David|Luca(?:\s+\[Replit\])?):(?:\*\*)?\s*/i.test(textWithoutEol)) {
    return { classification: 'structural', reason: 'speaker-header' };
  }
  if (isKnownWindowChrome(textWithoutEol)) {
    return { classification: 'cleanup', reason: 'known-window-chrome' };
  }
  if (isRawWindowStatusLine(textWithoutEol)) {
    return { classification: 'ui-status', reason: 'visible-ui-status' };
  }
  if (isRawWindowVisibleThinking(textWithoutEol)) {
    return { classification: 'visible-thinking', reason: 'visible-thinking' };
  }
  if (isAttestedDialogueLine(textWithoutEol, attestedTurns)) {
    return { classification: 'dialogue', reason: 'attested-capture-text' };
  }
  return { classification: 'unknown', reason: 'not-proven-dialogue-or-known-ui' };
}

/**
 * Account for every source byte before a cleaned payload enters the capture →
 * DB pipe. This is a system audit: it stores offsets and reasons, never raw
 * source prose. The raw dump itself stays in its private SHA-keyed source file.
 */
export function reconcileRawWindowEvidence(
  input: RawWindowReconciliationInput,
): RawWindowReconciliation {
  const pieces = input.rawWindow.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g) ?? [];
  const spans: RawWindowSourceSpan[] = [];
  let byteOffset = 0;
  let line = 1;

  for (const piece of pieces) {
    if (!piece) continue;
    const textWithoutEol = piece.replace(/(?:\r\n|\n|\r)$/, '');
    const sourceBytes = Buffer.byteLength(piece, 'utf8');
    const classification = classifyLine(textWithoutEol, input.attestedTurns);
    const previous = spans[spans.length - 1];
    if (
      previous &&
      previous.classification === classification.classification &&
      previous.reason === classification.reason &&
      previous.endByteOffset === byteOffset &&
      previous.endLine + 1 === line
    ) {
      previous.endLine = line;
      previous.endByteOffset += sourceBytes;
      previous.sourceBytes += sourceBytes;
      previous.sourceCodePoints += Array.from(piece).length;
    } else {
      spans.push({
        ...classification,
        startLine: line,
        endLine: line,
        startByteOffset: byteOffset,
        endByteOffset: byteOffset + sourceBytes,
        sourceBytes,
        sourceCodePoints: Array.from(piece).length,
      });
    }
    byteOffset += sourceBytes;
    line++;
  }

  const count = (classification: RawWindowEvidenceClassification) =>
    spans
      .filter(span => span.classification === classification)
      .reduce((total, span) => total + span.sourceBytes, 0);
  const dialogueBytes = count('dialogue');
  const cleanupBytes = count('cleanup');
  const structuralBytes = count('structural');
  const unexplainedBytes = count('unknown');
  const evidenceBytes = input.rawBytes.byteLength - dialogueBytes - cleanupBytes - structuralBytes;
  const accountedBytes = spans.reduce((total, span) => total + span.sourceBytes, 0);
  const reason = input.noMatchReason
    ?? (unexplainedBytes > 0 ? 'The source contains material not proven as dialogue or known UI.' : undefined);

  return {
    sourceSha256: createHash('sha256').update(input.rawBytes).digest('hex'),
    sourceBytes: input.rawBytes.byteLength,
    sourceCodePoints: Array.from(input.rawWindow).length,
    accountedBytes,
    dialogueBytes,
    evidenceBytes,
    cleanupBytes,
    structuralBytes,
    emittedDialogueBytes: Buffer.byteLength(input.emittedDialogue ?? '', 'utf8'),
    removedBytes: cleanupBytes,
    unexplainedBytes,
    status: reason ? 'unresolved' : 'reconciled',
    ...(reason ? { reason } : {}),
    ...(input.canonicalScope ? { canonicalScope: input.canonicalScope } : {}),
    spans,
  };
}

export interface RawWindowReconciliationDirectorySummary {
  totalSources: number;
  auditedSources: number;
  referenceSources: number;
  unresolvedSources: number;
  unresolvedBytes: number;
}

/** Read local audit metadata for status reporting; raw dumps are never episode prose. */
export function summarizeRawWindowReconciliationDirectory(
  sourceDir: string,
): RawWindowReconciliationDirectorySummary {
  const summary = { totalSources: 0, auditedSources: 0, referenceSources: 0, unresolvedSources: 0, unresolvedBytes: 0 };
  if (!existsSync(sourceDir)) return summary;
  for (const entry of readdirSync(sourceDir)) {
    if (!entry.endsWith('.json') || entry.endsWith('.audit.json')) continue;
    try {
      const metadata = JSON.parse(readFileSync(`${sourceDir}/${entry}`, 'utf8'));
      summary.totalSources++;
      if (metadata.status === 'capture-staged' || metadata.status === 'audit-passed-pending-capture') {
        summary.auditedSources++;
      }
      if (metadata.status === 'reference-retained' || metadata.status === 'reference-retained-unclassified') {
        summary.referenceSources++;
      }
      if (metadata.reconciliation?.status === 'unresolved') {
        summary.unresolvedSources++;
        summary.unresolvedBytes += Number(metadata.reconciliation.unexplainedBytes) || 0;
      }
    } catch {
      // A partially written metadata file is itself not permission to suppress the status writer.
    }
  }
  return summary;
}