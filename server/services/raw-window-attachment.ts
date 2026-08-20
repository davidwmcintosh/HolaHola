import { createHash } from 'crypto';

import { parseCanonicalFourChannelLucaTurn } from './inner-life-capture';
import {
  chatCaptureTurnFingerprint,
  ChatCaptureFromOffset,
  DialogueTurn,
} from './transcript-parser';

export type RawWindowContentClassification =
  | 'dialogue'
  | 'visible-thinking'
  | 'ui-status'
  | 'unknown';

export interface RawWindowClassifiedSegment {
  classification: RawWindowContentClassification;
  startLine: number;
  endLine: number;
  text: string;
}

export interface RawWindowMatchedTurn {
  speaker: DialogueTurn['speaker'];
  captureId?: string;
  fingerprint: string;
  turnIndex: number;
  startByteOffset: number;
  endByteOffset: number;
  match: 'exact' | 'attested-prefix';
}

export interface RawWindowAttachmentPlan {
  sourceSha256: string;
  sourceBytes: number;
  matchedTurns: [RawWindowMatchedTurn, RawWindowMatchedTurn];
  segments: RawWindowClassifiedSegment[];
  evidenceMarkdown: string;
}

export type RawWindowAttachmentResult =
  | { ok: true; plan: RawWindowAttachmentPlan }
  | { ok: false; reason: string };

function normalize(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
}

function extractAttestedLucaText(text: string): string {
  return parseCanonicalFourChannelLucaTurn(text)?.main ?? text;
}

function sourceMatch(
  rawNormalized: string,
  turn: DialogueTurn,
): 'exact' | 'attested-prefix' | null {
  const attested = normalize(
    turn.speaker === 'LUCA' ? extractAttestedLucaText(turn.text) : turn.text,
  );
  if (attested.length < 12) return null;
  if (rawNormalized.includes(attested)) return 'exact';

  // A window often shows the beginning of the visible Luca answer followed by
  // later status/checkpoint activity. Match only an attested, substantial
  // prefix; never use fuzzy similarity or generated reconstruction.
  if (turn.speaker === 'LUCA') {
    const prefix = attested.slice(0, Math.min(160, attested.length)).trim();
    if (prefix.length >= 80 && rawNormalized.includes(prefix)) {
      return 'attested-prefix';
    }
  }
  return null;
}

function matchedTurn(
  turn: DialogueTurn,
  turnIndex: number,
  parsedCapture: ChatCaptureFromOffset,
  match: 'exact' | 'attested-prefix',
): RawWindowMatchedTurn {
  const endByteOffset = parsedCapture.turnByteOffsets[turnIndex];
  const startByteOffset = turnIndex === 0
    ? 0
    : parsedCapture.turnByteOffsets[turnIndex - 1];
  if (endByteOffset === undefined) {
    throw new Error(`Missing byte offset for attested capture turn ${turnIndex}.`);
  }
  return {
    speaker: turn.speaker,
    ...(turn.captureId ? { captureId: turn.captureId } : {}),
    fingerprint: chatCaptureTurnFingerprint(turn),
    turnIndex,
    startByteOffset,
    endByteOffset,
    match,
  };
}

function isStatusLine(line: string): boolean {
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

function isVisibleThinking(text: string): boolean {
  const value = text.trim();
  return /^(?:considering|i['’]m considering|i['’]m pondering|i think i need|i should probably|i want to make sure)\b/i.test(value);
}

function isAttestedDialogueBlock(
  text: string,
  matchedTurns: readonly RawWindowMatchedTurn[],
  capturedTurns: readonly DialogueTurn[],
): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;

  return matchedTurns.some(matched => {
    const source = capturedTurns[matched.turnIndex];
    if (!source) return false;
    const attested = normalize(
      source.speaker === 'LUCA' ? extractAttestedLucaText(source.text) : source.text,
    );
    if (normalized.includes(attested) || attested.includes(normalized)) return true;
    return (
      source.speaker === 'LUCA' &&
      normalized.length >= 80 &&
      attested.startsWith(normalized.slice(0, Math.min(160, normalized.length)))
    );
  });
}

/**
 * Classify the visible window without changing its source. Status and visible
 * thinking are deliberately not emitted as dialogue; anything unrecognised is
 * explicitly retained as unknown instead of being discarded.
 */
export function classifyRawWindowForAttachment(
  rawWindow: string,
  matchedTurns: readonly RawWindowMatchedTurn[],
  capturedTurns: readonly DialogueTurn[],
): RawWindowClassifiedSegment[] {
  const lines = rawWindow.replace(/\r\n/g, '\n').split('\n');
  const segments: RawWindowClassifiedSegment[] = [];
  let blockLines: string[] = [];
  let blockStart = 1;

  const push = (
    classification: RawWindowContentClassification,
    startLine: number,
    endLine: number,
    text: string,
  ) => {
    if (!text) return;
    const previous = segments[segments.length - 1];
    if (
      previous &&
      previous.classification === classification &&
      previous.endLine + 1 === startLine
    ) {
      previous.endLine = endLine;
      previous.text += `\n${text}`;
      return;
    }
    segments.push({ classification, startLine, endLine, text });
  };

  const flushTextBlock = (endLine: number) => {
    const text = blockLines.join('\n');
    if (text.trim()) {
      const classification = isVisibleThinking(text)
        ? 'visible-thinking'
        : isAttestedDialogueBlock(text, matchedTurns, capturedTurns)
          ? 'dialogue'
          : 'unknown';
      push(classification, blockStart, endLine, text);
    }
    blockLines = [];
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const lineNumber = index + 1;
    if (isStatusLine(line)) {
      flushTextBlock(lineNumber - 1);
      push('ui-status', lineNumber, lineNumber, line);
      blockStart = lineNumber + 1;
      continue;
    }
    if (blockLines.length === 0) blockStart = lineNumber;
    blockLines.push(line);
  }
  flushTextBlock(lines.length);
  return segments;
}

function markdownFence(rawWindow: string): string {
  let fence = '```';
  while (rawWindow.includes(fence)) fence += '`';
  return fence;
}

export function formatRawWindowEvidenceAppendix(
  rawWindow: string,
  sourceSha256: string,
  sourceBytes: number,
  matchedTurns: readonly RawWindowMatchedTurn[],
  segments: readonly RawWindowClassifiedSegment[],
): string {
  const fence = markdownFence(rawWindow);
  const rangeStart = matchedTurns[0].startByteOffset;
  const rangeEnd = matchedTurns[1].endByteOffset;
  const segmentMap = segments.map((segment, index) =>
    `${index + 1}. Lines ${segment.startLine}–${segment.endLine}: **${segment.classification}**`,
  ).join('\n');

  return [
    `<!-- raw-window-evidence:sha256=${sourceSha256} -->`,
    '### Raw-window evidence appendix — attached source',
    '',
    'This is a verbatim Replit-window source attached to dialogue already recorded above. It is evidence, not a second dialogue replay: visible thinking, UI/status activity, and unknown material are not attributed as David or Luca prose.',
    '',
    `- Raw source SHA-256: \`${sourceSha256}\``,
    `- Raw source bytes: ${sourceBytes}`,
    `- Attested chat-capture range: ${rangeStart}–${rangeEnd}`,
    `- Matched turns: ${matchedTurns.map(turn => `${turn.speaker.toLowerCase()}#${turn.turnIndex} (${turn.match})`).join(', ')}`,
    '',
    '#### Verbatim raw window',
    fence,
    rawWindow,
    fence,
    '',
    '#### Classified source map',
    segmentMap || 'No non-empty source segments.',
  ].join('\n');
}

/**
 * Require one unambiguous, already-captured David→Luca range before attaching
 * a raw window. This is intentionally stricter than normal window alignment:
 * attachment must prove it is supplementing existing dialogue, never create it.
 */
export function createRawWindowAttachmentPlan(
  rawWindow: string,
  rawBytes: Buffer,
  parsedCapture: ChatCaptureFromOffset,
): RawWindowAttachmentResult {
  const rawNormalized = normalize(rawWindow);
  if (!rawNormalized) return { ok: false, reason: 'The raw window is empty.' };

  const davidCandidates: Array<{ index: number; match: 'exact' | 'attested-prefix' }> = [];
  const lucaCandidates: Array<{ index: number; match: 'exact' | 'attested-prefix' }> = [];
  parsedCapture.turns.forEach((turn, index) => {
    const match = sourceMatch(rawNormalized, turn);
    if (!match) return;
    if (turn.speaker === 'DAVID') davidCandidates.push({ index, match });
    if (turn.speaker === 'LUCA') lucaCandidates.push({ index, match });
  });

  const pairs = davidCandidates.flatMap(david =>
    lucaCandidates
      .filter(luca => luca.index > david.index)
      .map(luca => ({ david, luca })),
  );
  if (pairs.length === 0) {
    return {
      ok: false,
      reason: 'The raw window does not prove an already-captured, ordered David→Luca exchange.',
    };
  }
  if (pairs.length > 1) {
    return {
      ok: false,
      reason: 'More than one captured David→Luca range matches this raw window; attachment is ambiguous.',
    };
  }

  try {
    const pair = pairs[0];
    const matchedTurns: [RawWindowMatchedTurn, RawWindowMatchedTurn] = [
      matchedTurn(parsedCapture.turns[pair.david.index], pair.david.index, parsedCapture, pair.david.match),
      matchedTurn(parsedCapture.turns[pair.luca.index], pair.luca.index, parsedCapture, pair.luca.match),
    ];
    const sourceSha256 = createHash('sha256').update(rawBytes).digest('hex');
    const segments = classifyRawWindowForAttachment(
      rawWindow,
      matchedTurns,
      parsedCapture.turns,
    );
    return {
      ok: true,
      plan: {
        sourceSha256,
        sourceBytes: rawBytes.byteLength,
        matchedTurns,
        segments,
        evidenceMarkdown: formatRawWindowEvidenceAppendix(
          rawWindow,
          sourceSha256,
          rawBytes.byteLength,
          matchedTurns,
          segments,
        ),
      },
    };
  } catch (error: any) {
    return {
      ok: false,
      reason: error?.message ?? 'Unable to construct the raw-window attachment plan.',
    };
  }
}