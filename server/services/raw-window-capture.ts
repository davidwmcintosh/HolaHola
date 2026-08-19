import { isCanonicalFourChannelLucaTurn } from './inner-life-capture';

export type RawWindowSpeaker = 'David' | 'Luca Replit';

export interface RawWindowDialogueTurn {
  speaker: RawWindowSpeaker;
  text: string;
}

export type RawWindowParseResult =
  | { ok: true; turns: RawWindowDialogueTurn[] }
  | { ok: false; reason: string };

/**
 * UI events are not dialogue. Keep this list deliberately narrow: unfamiliar
 * unlabelled text is an ambiguity, not permission to silently drop a line.
 */
export function isKnownWindowChrome(line: string): boolean {
  const value = line.trim();
  return (
    /^Wrote a file$/i.test(value) ||
    /^\d+\s+actions?$/i.test(value) ||
    /^Worked for \d+(?:\.\d+)? (?:seconds?|minutes?)$/i.test(value)
  );
}

function parseSpeakerHeader(
  line: string,
): { speaker: RawWindowSpeaker; openingText: string } | null {
  const bold = /^\*\*(David|Luca(?:\s+\[Replit\])?):\*\*\s*(.*)$/i.exec(line);
  const plain = /^(David|Luca(?:\s+\[Replit\])?):\s*(.*)$/i.exec(line);
  const match = bold ?? plain;
  if (!match) return null;
  return {
    speaker: /^david$/i.test(match[1]) ? 'David' : 'Luca Replit',
    openingText: match[2],
  };
}

function trimBoundaryBlankLines(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start].trim()) start++;
  while (end > start && !lines[end - 1].trim()) end--;
  return lines.slice(start, end);
}

/**
 * Deterministically clean a raw Replit-window paste.
 *
 * The source itself is retained by the caller before this parser runs. This
 * parser never infers a speaker: every dialogue block must carry an explicit
 * David or Luca header. A malformed or ambiguous source returns an error
 * before callers can append any cleaned text to the shared capture stream.
 */
export function parseRawWindowCapture(raw: string): RawWindowParseResult {
  const turns: RawWindowDialogueTurn[] = [];
  let currentSpeaker: RawWindowSpeaker | null = null;
  let currentLines: string[] = [];

  const flush = (): string | null => {
    if (!currentSpeaker) return null;
    const text = trimBoundaryBlankLines(currentLines).join('\n');
    if (!text) return `The ${currentSpeaker} block is empty.`;
    turns.push({ speaker: currentSpeaker, text });
    currentSpeaker = null;
    currentLines = [];
    return null;
  };

  for (const sourceLine of raw.replace(/\r\n/g, '\n').split('\n')) {
    if (isKnownWindowChrome(sourceLine)) continue;
    const header = parseSpeakerHeader(sourceLine);
    if (header) {
      const error = flush();
      if (error) return { ok: false, reason: error };
      currentSpeaker = header.speaker;
      currentLines = [header.openingText];
      continue;
    }

    if (!currentSpeaker) {
      if (!sourceLine.trim()) continue;
      return {
        ok: false,
        reason: `Unlabelled window text cannot be assigned safely: "${sourceLine.slice(0, 120)}"`,
      };
    }
    currentLines.push(sourceLine);
  }

  const error = flush();
  if (error) return { ok: false, reason: error };
  if (turns.length === 0) return { ok: false, reason: 'No explicitly labelled David or Luca dialogue was found.' };
  if (!turns.some(turn => turn.speaker === 'David')) return { ok: false, reason: 'The raw window has no David block.' };
  if (!turns.some(turn => turn.speaker === 'Luca Replit')) return { ok: false, reason: 'The raw window has no Luca block.' };

  for (const turn of turns) {
    if (turn.speaker === 'Luca Replit' && !isCanonicalFourChannelLucaTurn(turn.text)) {
      return {
        ok: false,
        reason: 'A Luca block is missing the required felt → thinking → moment → main envelope.',
      };
    }
  }
  return { ok: true, turns };
}