import { isKnownWindowChrome, RawWindowDialogueTurn, RawWindowParseResult } from './raw-window-capture';

export interface RawWindowDavidAnchor {
  text: string;
}

interface NormalizedSource {
  text: string;
  starts: number[];
  ends: number[];
}

interface AnchorLocation {
  anchor: RawWindowDavidAnchor;
  start: number;
  end: number;
  sourceStart: number;
  sourceEnd: number;
}

/**
 * Whitespace is the only normalization allowed when matching an attested
 * David turn against the raw window. The returned text is used for searching
 * only; attributed output still comes from the source or the attested anchor.
 */
export function normalizeRawWindowForAlignment(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
}

type RawWindowAlignmentNormalizer = (text: string) => string;

// Production always uses normalizeRawWindowForAlignment. The override is
// intentionally test-only so the alignment self-check can prove that removing
// whitespace normalization makes a wrapped David anchor fail closed.
let normalizeRawWindowForAlignmentOverride: RawWindowAlignmentNormalizer | null = null;

export function _setNormalizeRawWindowForAlignmentForTest(
  normalizer: RawWindowAlignmentNormalizer | null,
): void {
  normalizeRawWindowForAlignmentOverride = normalizer;
}

function buildCleanedSource(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter(line => !isKnownWindowChrome(line))
    .join('\n');
}

/**
 * Build a whitespace-collapsed string and a character-to-source map. Keeping
 * the map lets us return Luca text from the cleaned source without replacing
 * it with a normalized reconstruction.
 */
function normalizeWithSourceMap(source: string): NormalizedSource {
  const chars: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];

  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (/\s/.test(character)) {
      if (chars.length === 0 || chars[chars.length - 1] === ' ') continue;
      chars.push(' ');
      starts.push(index);
      ends.push(index + 1);
      continue;
    }

    if (chars[chars.length - 1] === ' ') {
      ends[ends.length - 1] = index;
    }
    chars.push(character);
    starts.push(index);
    ends.push(index + 1);
  }

  while (chars[chars.length - 1] === ' ') {
    chars.pop();
    starts.pop();
    ends.pop();
  }

  return { text: chars.join(''), starts, ends };
}

function findOccurrences(haystack: string, needle: string): number[] {
  const occurrences: number[] = [];
  let from = 0;
  while (from <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) break;
    occurrences.push(index);
    from = index + 1;
  }
  return occurrences;
}

function isWholeTextBoundary(text: string, start: number, end: number): boolean {
  const before = start === 0 ? '' : text[start - 1];
  const after = end === text.length ? '' : text[end];
  return (!before || /\s/.test(before)) && (!after || /\s/.test(after));
}

function sourceSlice(source: string, start: number, end: number): string {
  return source.slice(start, end).trim();
}

/**
 * Attribute a raw Replit-window paste that has no speaker labels.
 *
 * David anchors are not generated from the window. They are supplied by the
 * append-only .chat_capture source and must occur once, in the same order,
 * after only whitespace/wrapping normalization. Every remaining non-chrome
 * region is attributed to Luca because the anchors are the attested David
 * regions. Any missing, duplicated, overlapping, or reordered anchor fails
 * closed.
 */
export function alignUnlabelledRawWindow(
  raw: string,
  davidAnchors: readonly RawWindowDavidAnchor[],
): RawWindowParseResult {
  if (davidAnchors.length === 0) {
    return { ok: false, reason: 'No attested David turns were supplied for alignment.' };
  }

  const cleanedSource = buildCleanedSource(raw);
  const normalizedSource = normalizeWithSourceMap(cleanedSource);
  const locations: AnchorLocation[] = [];

  for (const anchor of davidAnchors) {
    const normalizedAnchor = (
      normalizeRawWindowForAlignmentOverride ?? normalizeRawWindowForAlignment
    )(anchor.text);
    if (!normalizedAnchor) {
      return { ok: false, reason: 'An attested David turn is empty and cannot anchor the raw window.' };
    }

    const candidates = findOccurrences(normalizedSource.text, normalizedAnchor)
      .filter(start => isWholeTextBoundary(
        normalizedSource.text,
        start,
        start + normalizedAnchor.length,
      ));

    if (candidates.length === 0) {
      return {
        ok: false,
        reason: `An attested David anchor was not found verbatim after whitespace normalization: "${anchor.text.slice(0, 120)}"`,
      };
    }
    if (candidates.length > 1) {
      return {
        ok: false,
        reason: `A David anchor occurs more than once in the raw window and is ambiguous: "${anchor.text.slice(0, 120)}"`,
      };
    }

    const start = candidates[0];
    const end = start + normalizedAnchor.length;
    locations.push({
      anchor,
      start,
      end,
      sourceStart: normalizedSource.starts[start],
      sourceEnd: normalizedSource.ends[end - 1],
    });
  }

  const orderedLocations = [...locations].sort((a, b) => a.start - b.start);
  for (let index = 0; index < orderedLocations.length; index++) {
    const location = orderedLocations[index];
    const previous = orderedLocations[index - 1];
    if (previous && location.start < previous.end) {
      return { ok: false, reason: 'David anchors overlap in the raw window.' };
    }
    if (location !== locations[index]) {
      return {
        ok: false,
        reason: 'Attested David turns appear out of order in the raw window.',
      };
    }
  }

  const turns: RawWindowDialogueTurn[] = [];
  let sourceCursor = 0;
  for (const location of locations) {
    const lucaText = sourceSlice(cleanedSource, sourceCursor, location.sourceStart);
    if (lucaText) turns.push({ speaker: 'Luca Replit', text: lucaText });
    turns.push({ speaker: 'David', text: location.anchor.text });
    sourceCursor = location.sourceEnd;
  }

  const trailingLucaText = sourceSlice(cleanedSource, sourceCursor, cleanedSource.length);
  if (trailingLucaText) turns.push({ speaker: 'Luca Replit', text: trailingLucaText });

  if (!turns.some(turn => turn.speaker === 'Luca Replit')) {
    return { ok: false, reason: 'The raw window contains no non-chrome Luca region around the David anchors.' };
  }

  return { ok: true, turns };
}