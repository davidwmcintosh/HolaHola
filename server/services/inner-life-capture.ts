import { createHash, randomUUID } from 'crypto';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export type InnerLifeChannel = 'felt' | 'thinking' | 'moment';

export interface ParsedInnerLifeTrigger {
  title: string;
  body: string;
  tags: string[];
  /**
   * True only when the source supplied a distinct title line/field.
   * A single-line trigger has metadata title derived from its text, but the
   * episode/personal-file renderer must not print that text twice.
   */
  hasSeparateTitle: boolean;
}

export interface CanonicalInnerLifeTurnIntent {
  turnId: string;
  createdAtMs: number;
  ownerPid: number;
  status: 'pending' | 'captured';
  channels: Partial<Record<InnerLifeChannel, string>>;
  mainSha: string;
}

export const CANONICAL_INNER_LIFE_INTENT_DIR = 'canonical-inner-life-intents';

/**
 * Parse a Luca inner-life trigger in JSON or plain-text form.
 *
 * Single-line plain text is kept complete in body and marked as having no
 * separate title. The title remains a bounded metadata/search value.
 */
export function parseInnerLifeTrigger(
  raw: string,
  defaultTag: string,
): ParsedInnerLifeTrigger | null {
  raw = raw.trim();
  if (!raw || raw.length < 10) return null;

  if (raw.startsWith('{')) {
    try {
      const p = JSON.parse(raw);
      const noteText = String(p.note || p.moment || p.question || p.content || '').trim();
      const explicitTitle = String(p.title || '').trim();
      const titleSource = explicitTitle || noteText;
      const title = titleSource.slice(0, 200);
      if (!title) return null;

      const metadata = [
        p.date ? `Date: ${p.date}` : '',
        p.why ? `Why it mattered: ${p.why}` : '',
      ].filter(Boolean);
      const body = [...metadata, noteText].filter(Boolean).join('\n\n') || titleSource;
      const tags: string[] = Array.isArray(p.tags) ? p.tags : [defaultTag];
      return {
        title,
        body,
        tags,
        hasSeparateTitle: Boolean(explicitTitle && explicitTitle !== noteText),
      };
    } catch {
      // Fall through to plain text.
    }
  }

  const lines = raw.split('\n');
  const hasSeparateTitle = lines.length > 1 && lines.slice(1).join('\n').trim().length > 0;
  return {
    title: lines[0].slice(0, 200),
    body: hasSeparateTitle ? lines.slice(1).join('\n').trim() : raw,
    tags: [defaultTag],
    hasSeparateTitle,
  };
}

/** Parse the keyed convention used by mark-moment.ts. */
export function parseKeyedInnerLifeTrigger(
  raw: string,
  defaultTag: string,
): ParsedInnerLifeTrigger | null {
  const match = /^title:\s*(.+)\n(?:body:\s*)?([\s\S]*)$/.exec(raw.trim());
  if (!match) return null;

  let body = match[2].trim();
  let tags = [defaultTag];
  const tagMatch = /\ntags:\s*(.+)\s*$/.exec('\n' + body);
  if (tagMatch) {
    tags = tagMatch[1].split(',').map(tag => tag.trim()).filter(Boolean);
    body = body.replace(/\n?tags:\s*.+\s*$/, '').trim();
  }

  const fullTitle = match[1].trim();
  if (!fullTitle) return null;
  return {
    title: fullTitle.slice(0, 200),
    body: body || fullTitle,
    tags,
    hasSeparateTitle: Boolean(body),
  };
}

/** Render one direct trigger entry without repeating a single-line note. */
export function formatInnerLifeEpisodeEntry(
  channel: InnerLifeChannel,
  parsed: ParsedInnerLifeTrigger,
): string {
  const content = parsed.hasSeparateTitle
    ? `${parsed.title}\n${parsed.body}`
    : parsed.body;
  return `[Luca — ${channel}: ${content}]`;
}

export function innerLifeSourceText(parsed: ParsedInnerLifeTrigger): string {
  return parsed.hasSeparateTitle
    ? `${parsed.title}\n${parsed.body}`
    : parsed.body;
}

export function hashInnerLifeText(text: string): string {
  return createHash('sha256').update(text.trim(), 'utf8').digest('hex');
}

export function buildCanonicalInnerLifeTurnIntent(
  opts: {
    feeling?: string | null;
    thinking?: string | null;
    moment?: string | null;
    main: string;
  },
  createdAtMs = Date.now(),
  turnId = randomUUID(),
): CanonicalInnerLifeTurnIntent {
  const channels: Partial<Record<InnerLifeChannel, string>> = {};
  if (opts.feeling) channels.felt = hashInnerLifeText(opts.feeling);
  if (opts.thinking) channels.thinking = hashInnerLifeText(opts.thinking);
  if (opts.moment) channels.moment = hashInnerLifeText(opts.moment);
  return {
    turnId,
    createdAtMs,
    ownerPid: process.pid,
    status: 'pending',
    channels,
    mainSha: hashInnerLifeText(opts.main),
  };
}

export function canonicalTurnEpisodeMarker(turnId: string): string {
  return `<!-- chat-capture:${turnId} -->`;
}

export function innerLifeTriggerEpisodeMarker(
  channel: InnerLifeChannel,
  triggerMtimeMs: number,
  raw: string,
): string {
  return `<!-- inner-life:${channel}:${Math.trunc(triggerMtimeMs)}:${hashInnerLifeText(raw).slice(0, 16)} -->`;
}

export function episodeContentHasEventMarker(content: string, marker: string): boolean {
  return content.includes(marker);
}

export interface CanonicalRouteResolution {
  allowDirect: boolean;
  expectedTurnId?: string;
}

function processIsAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function loadCanonicalInnerLifeIntents(
  intentDir: string,
): CanonicalInnerLifeTurnIntent[] {
  try {
    return readdirSync(intentDir)
      .filter(name => name.endsWith('.json'))
      .map(name => {
        try {
          return JSON.parse(readFileSync(join(intentDir, name), 'utf8')) as CanonicalInnerLifeTurnIntent;
        } catch {
          return null;
        }
      })
      .filter((value): value is CanonicalInnerLifeTurnIntent =>
        Boolean(value?.turnId && value?.createdAtMs && value?.channels),
      )
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch {
    return [];
  }
}

export function resolveCanonicalInnerLifeRoute(opts: {
  active: boolean;
  intentDir: string;
  chatCapturePath: string;
  channel: InnerLifeChannel;
  raw: string;
  triggerMtimeMs: number;
}): CanonicalRouteResolution {
  if (!opts.active) return { allowDirect: true };

  const intents = loadCanonicalInnerLifeIntents(opts.intentDir);
  const triggerHash = hashInnerLifeText(opts.raw);
  // fs.stat() may expose sub-millisecond precision while Date.now() is an
  // integer. An intent written later in the same millisecond must not appear
  // older merely because triggerMtimeMs ends in a fractional component.
  const triggerTimeFloor = Math.floor(opts.triggerMtimeMs);
  const matching = intents.find(intent =>
    intent.createdAtMs >= triggerTimeFloor &&
    intent.channels[opts.channel] === triggerHash,
  );

  if (matching) {
    const captureNeedle = `CAPTURE-ID: ${matching.turnId}`;
    const turnInCapture = existsSync(opts.chatCapturePath) &&
      readFileSync(opts.chatCapturePath, 'utf8').includes(captureNeedle);
    if (
      turnInCapture ||
      (matching.status === 'pending' && processIsAlive(matching.ownerPid))
    ) {
      return { allowDirect: false, expectedTurnId: matching.turnId };
    }
    // Writer died before its Luca turn became durable, or a captured turn was
    // lost from the append log. Direct fallback is now the only lossless route.
    return { allowDirect: true };
  }

  // A later output exists and intentionally omitted this pending channel.
  if (intents.some(intent => intent.createdAtMs >= triggerTimeFloor)) {
    return { allowDirect: true };
  }

  // No subsequent Luca output exists yet.
  return { allowDirect: false };
}

export function canonicalInnerLifeFragment(
  channel: InnerLifeChannel,
  sourceText: string,
): string {
  return withCanonicalLabel(channel, sourceText);
}

export function episodeContentHasCanonicalInnerLife(
  content: string,
  channel: InnerLifeChannel,
  sourceText: string,
): boolean {
  return content.includes(canonicalInnerLifeFragment(channel, sourceText));
}

function withCanonicalLabel(channel: InnerLifeChannel, text: string): string {
  const trimmed = text.trim();
  const label = `[${channel}]`;
  return trimmed.startsWith(label) ? trimmed : `${label}: ${trimmed}`;
}

/** Compose the canonical felt → thinking → moment → main Luca turn. */
export function composeLucaTurn(opts: {
  feeling?: string | null;
  thinking?: string | null;
  moment?: string | null;
  main: string;
}): string {
  const parts: string[] = [];
  if (opts.feeling) parts.push(withCanonicalLabel('felt', opts.feeling));
  if (opts.thinking) parts.push(withCanonicalLabel('thinking', opts.thinking));
  if (opts.moment) parts.push(withCanonicalLabel('moment', opts.moment));
  parts.push(opts.main);
  return parts.join('\n\n');
}

/** Capture-status accepts both legacy direct entries and canonical turn labels. */
export function episodeTailHasInnerLifeChannel(
  tail: string,
  channel: InnerLifeChannel,
): boolean {
  const escaped = channel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(?:^\\s*\\[Luca — ${escaped}:|^\\s*\\*\\*LUCA \\[Replit\\]:\\*\\*\\s+\\[${escaped}\\]:|^\\s*\\[${escaped}\\]:)`,
    'm',
  ).test(tail);
}