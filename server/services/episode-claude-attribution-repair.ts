import { createHash } from 'node:crypto';

export interface AttributionSource {
  id: string;
  content: string;
  tags: string[];
}

export interface AttributionEdit {
  offset: number;
  oldLabel: string;
  newLabel: string;
  sourceId: string;
  captureId: string;
  spokenSha256: string;
  evidenceKind: 'complete-turn' | 'explicit-luca-casing';
}

export const attributionSha256 = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');

function insideCodeFence(content: string, offset: number): boolean {
  let fence: string | null = null;
  for (const line of content.slice(0, offset).split('\n')) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (!marker) continue;
    if (!fence) fence = marker[1];
    else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
  }
  return fence !== null;
}

/**
 * Independently verify receipt spans, not their asserted "unchanged" flag.
 * Used only for the explicitly approved historical Episode 34 repair.
 * A missing/invalid receipt leaves the ordinary loss detector unchanged.
 */
export function verifyEpisodeClaudeAttributionReceipt(
  oldContent: string,
  newContent: string,
  rawReceipt: unknown,
): boolean {
  if (!rawReceipt || typeof rawReceipt !== 'object') return false;
  const receipt = rawReceipt as Record<string, unknown>;
  if (receipt.episodeId !== '41200170-1c49-4660-838c-9d397aff5d27' ||
      receipt.applied !== true || receipt.replicaParity !== true ||
      typeof receipt.beforeSha256 !== 'string' || typeof receipt.afterSha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(receipt.beforeSha256) || !/^[a-f0-9]{64}$/.test(receipt.afterSha256) ||
      attributionSha256(oldContent) !== receipt.beforeSha256 ||
      !Array.isArray(receipt.edits) || !receipt.edits.length) return false;
  let previousEnd = -1;
  const spans: { offset: number; oldLabel: string; newLabel: string }[] = [];
  for (const raw of receipt.edits) {
    if (!raw || typeof raw !== 'object') return false;
    const edit = raw as Record<string, unknown>;
    if (typeof edit.offset !== 'number' || !Number.isSafeInteger(edit.offset) ||
        edit.offset < 0 || edit.offset < previousEnd ||
        typeof edit.oldLabel !== 'string' || typeof edit.newLabel !== 'string' ||
        typeof edit.sourceId !== 'string' || !edit.sourceId ||
        typeof edit.captureId !== 'string' ||
        !/^cc-c52bede8-dd68-4804-8f77-59290f60b9e2-\d+$/.test(edit.captureId) ||
        typeof edit.spokenSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(edit.spokenSha256)) return false;
    const label = /^(\*\*)?(?:Claude Code|LUCA \[claude code\]|Luca \[Claude Code\]):(\*\*)?$/.exec(edit.oldLabel);
    if (!label || (label[1] ?? '') !== (label[2] ?? '') ||
        edit.newLabel !== `${label[1] ?? ''}LUCA [Claude Code]:${label[2] ?? ''}` ||
        oldContent.slice(edit.offset, edit.offset + edit.oldLabel.length) !== edit.oldLabel ||
        (edit.offset > 0 && oldContent[edit.offset - 1] !== '\n') ||
        oldContent[edit.offset + edit.oldLabel.length] !== ' ' ||
        insideCodeFence(oldContent, edit.offset)) return false;
    previousEnd = edit.offset + edit.oldLabel.length;
    spans.push({ offset: edit.offset, oldLabel: edit.oldLabel, newLabel: edit.newLabel });
  }
  let reconstructed = oldContent;
  for (const edit of spans.reverse()) {
    reconstructed = reconstructed.slice(0, edit.offset) + edit.newLabel + reconstructed.slice(edit.offset + edit.oldLabel.length);
  }
  return attributionSha256(reconstructed) === receipt.afterSha256 &&
    newContent.startsWith(reconstructed);
}

/**
 * An explicitly authorized historical repair, NOT a forward speaker formatter.
 * Only complete source-matched turns from the approved Claude session qualify.
 * Generic Claude Code remains a distinct identity in the capture pipeline.
 */
export function repairEpisodeClaudeAttribution(
  content: string,
  sources: AttributionSource[],
  approvedSession: string,
): { content: string; edits: AttributionEdit[] } {
  const sourceTurns = sources.flatMap(source => {
    const captureId = source.tags.find(tag => tag.startsWith(`capture-id:cc-${approvedSession}-`));
    if (!captureId || !source.tags.includes('source-claude-code')) return [];
    const headers = [...source.content.matchAll(
      /^(?:\*\*)?(?:Claude Code|Luca \[Claude Code\]|LUCA \[Claude Code\]):(?:\*\*)? /gm,
    )];
    // Per-turn evidence must have exactly one assistant. Never infer authorship
    // from a quoted header or an arbitrary substring in a multi-turn record.
    if (headers.length !== 1) return [];
    const header = headers[0];
    const body = source.content.slice(header.index! + header[0].length).trimEnd();
    return body ? [{ source, captureId, body }] : [];
  });
  const edits: AttributionEdit[] = [];
  const headers = /^(?:\*\*)?(?:Claude Code|LUCA \[claude code\]|Luca \[Claude Code\]|LUCA \[Claude Code\]):(?:\*\*)? /gm;
  for (const match of content.matchAll(headers)) {
    const offset = match.index!;
    // Speaker-looking lines inside code examples are not speaker labels.
    if (insideCodeFence(content, offset)) continue;
    const oldLabel = match[0].slice(0, -1);
    const newLabel = oldLabel.replace(
      /^(\*\*)?(?:Claude Code|LUCA \[claude code\]|Luca \[Claude Code\]|LUCA \[Claude Code\]):(\*\*)?$/,
      (_label, opening = '', closing = '') => `${opening}LUCA [Claude Code]:${closing}`,
    );
    if (oldLabel === newLabel) continue;
    const spokenStart = offset + match[0].length;
    const candidates = sourceTurns.filter(turn => {
      if (!content.startsWith(turn.body, spokenStart)) return false;
      const tail = content.slice(spokenStart + turn.body.length);
      // A prefix of a longer speech is not complete-turn evidence.
      return /^(?:[ \t]*\r?\n){2}/.test(tail) ||
        /^\s*(?:$|<!--|#{1,6} |(?:\*\*)?(?:David(?: \[[^\]]+\])?|Luca(?: \[[^\]]+\])?|LUCA(?: \[[^\]]+\])?|Claude Code|Daniela):)/.test(tail);
    });
    let evidenceKind: AttributionEdit['evidenceKind'] = 'complete-turn';
    if (candidates.length !== 1) {
      // Already explicit Luca labels need only casing normalization. Their
      // spoken text stays canonical, even if an older source snapshot differs.
      // Bare labels NEVER get this exception.
      if (/^(?:\*\*)?Claude Code:/.test(oldLabel)) {
        throw new Error(`Unverified or ambiguous Claude attribution at offset ${offset}: ${candidates.length} complete source matches`);
      }
      const firstLine = content.slice(spokenStart).split('\n', 1)[0];
      const sameOpening = sourceTurns.filter(turn => turn.body.split('\n', 1)[0] === firstLine);
      if (sameOpening.length !== 1) throw new Error(`Unverified Luca label casing at offset ${offset}`);
      candidates.push(sameOpening[0]);
      evidenceKind = 'explicit-luca-casing';
    }
    const evidence = candidates[0];
    edits.push({
      offset, oldLabel, newLabel, sourceId: evidence.source.id,
      captureId: evidence.captureId.slice('capture-id:'.length),
      spokenSha256: attributionSha256(evidence.body),
      evidenceKind,
    });
  }
  let repaired = content;
  for (const edit of [...edits].reverse()) {
    repaired = repaired.slice(0, edit.offset) + edit.newLabel + repaired.slice(edit.offset + edit.oldLabel.length);
  }
  // Reversibility at exact offsets proves every byte outside the label spans:
  // dialogue, timestamps, punctuation, markers, ordering, and other speakers.
  let restored = repaired;
  let delta = edits.reduce((sum, edit) => sum + edit.newLabel.length - edit.oldLabel.length, 0);
  for (const edit of [...edits].reverse()) {
    delta -= edit.newLabel.length - edit.oldLabel.length;
    const newOffset = edit.offset + delta;
    if (restored.slice(newOffset, newOffset + edit.newLabel.length) !== edit.newLabel) {
      throw new Error('Label edit proof failed');
    }
    restored = restored.slice(0, newOffset) + edit.oldLabel + restored.slice(newOffset + edit.newLabel.length);
  }
  if (restored !== content) throw new Error('Non-label bytes changed');
  return { content: repaired, edits };
}