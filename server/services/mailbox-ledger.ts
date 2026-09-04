/**
 * Deterministic, side-effect-free representation of the two Git-tracked
 * mailbox inputs. This module deliberately has no service or platform imports:
 * it is also used to verify blobs from an immutable Git commit.
 */

export const MAILBOX_FORMATTER_VERSION = 1 as const;

export const MAILBOX_IDENTITIES = [
  'claude-code-to-luca',
  'luca-to-claude-code',
] as const;

export type MailboxIdentity = (typeof MAILBOX_IDENTITIES)[number];

export interface MailboxNote {
  id: string;
  fromAgent: string;
  toAgent: string;
  subject: string;
  body: string;
  sessionLabel: string | null;
  createdAt: string;
}

export interface MailboxLedger {
  schemaVersion: 1;
  mailbox: MailboxIdentity;
  notes: MailboxNote[];
}

export const MAILBOX_PATHS: Readonly<Record<MailboxIdentity, {
  ledgerPath: string;
  markdownPath: string;
}>> = {
  'claude-code-to-luca': {
    ledgerPath: 'docs/mailbox-ledgers/claude-code-to-luca.json',
    markdownPath: 'docs/claude-code-to-luca.md',
  },
  'luca-to-claude-code': {
    ledgerPath: 'docs/mailbox-ledgers/luca-to-claude-code.json',
    markdownPath: 'docs/luca-to-claude-code.md',
  },
};

const ACTORS: Readonly<Record<MailboxIdentity, { fromAgent: string; toAgent: string }>> = {
  'claude-code-to-luca': { fromAgent: 'luca-claude-code', toAgent: 'agent' },
  'luca-to-claude-code': { fromAgent: 'agent', toAgent: 'luca-claude-code' },
};

const LEDGER_KEYS = ['schemaVersion', 'mailbox', 'notes'] as const;
const NOTE_KEYS = ['id', 'fromAgent', 'toAgent', 'subject', 'body', 'sessionLabel', 'createdAt'] as const;

function invalid(message: string): never {
  throw new Error(`Invalid mailbox ledger: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireExactKeys(value: Record<string, unknown>, expected: readonly string[], name: string): void {
  const keys = Object.keys(value);
  if (keys.length !== expected.length || expected.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) {
    invalid(`${name} must contain exactly these keys: ${expected.join(', ')}`);
  }
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string') invalid(`${name} must be a string`);
  return value;
}

function requireCanonicalTimestamp(value: unknown, name: string): string {
  const timestamp = requireString(value, name);
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== timestamp) {
    invalid(`${name} must be a canonical UTC ISO timestamp`);
  }
  return timestamp;
}

function requireMailbox(value: unknown): MailboxIdentity {
  if (value !== 'claude-code-to-luca' && value !== 'luca-to-claude-code') {
    invalid('mailbox must be a supported mailbox identity');
  }
  return value;
}

function compareNotes(left: MailboxNote, right: MailboxNote): number {
  if (left.createdAt > right.createdAt) return -1;
  if (left.createdAt < right.createdAt) return 1;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function parseNote(value: unknown, mailbox: MailboxIdentity, index: number): MailboxNote {
  if (!isRecord(value)) invalid(`notes[${index}] must be an object`);
  requireExactKeys(value, NOTE_KEYS, `notes[${index}]`);

  const id = requireString(value.id, `notes[${index}].id`);
  if (id.length === 0) invalid(`notes[${index}].id must be non-empty`);

  const actors = ACTORS[mailbox];
  const fromAgent = requireString(value.fromAgent, `notes[${index}].fromAgent`);
  const toAgent = requireString(value.toAgent, `notes[${index}].toAgent`);
  if (fromAgent !== actors.fromAgent || toAgent !== actors.toAgent) {
    invalid(`notes[${index}] actors do not match mailbox ${mailbox}`);
  }

  const sessionLabel = value.sessionLabel;
  if (sessionLabel !== null && typeof sessionLabel !== 'string') {
    invalid(`notes[${index}].sessionLabel must be a string or null`);
  }

  return {
    id,
    fromAgent,
    toAgent,
    subject: requireString(value.subject, `notes[${index}].subject`),
    body: requireString(value.body, `notes[${index}].body`),
    sessionLabel,
    createdAt: requireCanonicalTimestamp(value.createdAt, `notes[${index}].createdAt`),
  };
}

function parseLedger(value: unknown): MailboxLedger {
  if (!isRecord(value)) invalid('ledger must be an object');
  requireExactKeys(value, LEDGER_KEYS, 'ledger');
  if (value.schemaVersion !== 1) invalid('schemaVersion must be 1');

  const mailbox = requireMailbox(value.mailbox);
  if (!Array.isArray(value.notes)) invalid('notes must be an array');
  const notes = value.notes.map((note, index) => parseNote(note, mailbox, index));
  const ids = new Set<string>();
  for (const note of notes) {
    if (ids.has(note.id)) invalid(`duplicate note id: ${note.id}`);
    ids.add(note.id);
  }

  return { schemaVersion: 1, mailbox, notes };
}

/**
 * Validates a ledger that is intended to be committed. Its input order is part
 * of the canonical representation and is rejected when it is not canonical.
 */
export function validateMailboxLedger(value: unknown): MailboxLedger {
  const ledger = parseLedger(value);
  for (let index = 1; index < ledger.notes.length; index += 1) {
    if (compareNotes(ledger.notes[index - 1], ledger.notes[index]) > 0) {
      invalid('notes must be ordered by createdAt descending, then id ascending');
    }
  }
  return ledger;
}

/** Validates fields and produces a sorted, independent canonical ledger value. */
export function normalizeMailboxLedger(value: unknown): MailboxLedger {
  const ledger = parseLedger(value);
  return { ...ledger, notes: [...ledger.notes].sort(compareNotes) };
}

/** Strictly parses canonical ledger JSON, including its required note ordering. */
export function parseMailboxLedgerJson(json: string): MailboxLedger {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    invalid('ledger is not valid JSON');
  }
  return validateMailboxLedger(parsed);
}

/** Produces the only committed JSON byte representation for a ledger. */
export function serializeMailboxLedger(value: unknown): string {
  const ledger = normalizeMailboxLedger(value);
  return `${JSON.stringify({
    schemaVersion: ledger.schemaVersion,
    mailbox: ledger.mailbox,
    notes: ledger.notes.map((note) => ({
      id: note.id,
      fromAgent: note.fromAgent,
      toAgent: note.toAgent,
      subject: note.subject,
      body: note.body,
      sessionLabel: note.sessionLabel,
      createdAt: note.createdAt,
    })),
  }, null, 2)}\n`;
}

export function assertMailboxPaths(
  mailbox: MailboxIdentity,
  ledgerPath: string,
  markdownPath: string,
): void {
  const expected = MAILBOX_PATHS[mailbox];
  if (ledgerPath !== expected.ledgerPath || markdownPath !== expected.markdownPath) {
    throw new Error(`Mailbox paths do not match ${mailbox}`);
  }
}

function markdownHeader(ledger: MailboxLedger): { title: string; empty: string; summary: string } {
  if (ledger.mailbox === 'claude-code-to-luca') {
    return {
      title: '# Luca [Claude Code] → Luca [Replit] Notes',
      empty: '*No unread notes from Luca [Claude Code]. New notes appear immediately through `GET /api/agent/notes?from=luca-claude-code` and after `POST /api/agent/notes/refresh`.*',
      summary: `*${ledger.notes.length} unread note${ledger.notes.length === 1 ? '' : 's'}. Acknowledging a note does not imply it has been acted on; record the actual lifecycle outcome.*`,
    };
  }
  return {
    title: '# Luca [Replit] → Luca [Claude Code] Notes',
    empty: '*No unread replies from Luca [Replit]. New replies appear immediately through `GET /api/agent/notes?to=luca-claude-code` and after `POST /api/agent/notes/refresh`.*',
    summary: `*${ledger.notes.length} unread repl${ledger.notes.length === 1 ? 'y' : 'ies'}. Check this at the start of a session and continue the thread with --reply-to <id> on leave-luca-note.ts.*`,
  };
}

/** Renders stable Markdown from a validated canonical ledger. */
export function renderMailboxMarkdown(value: unknown): string {
  const ledger = validateMailboxLedger(value);
  const header = markdownHeader(ledger);
  if (ledger.notes.length === 0) return `${header.title}\n\n${header.empty}\n`;

  const sections = ledger.notes.map((note) => [
    `### ${note.subject}`,
    `*${note.createdAt}* (id: \`${note.id}\`)${note.sessionLabel === null ? '' : `\n*During: ${note.sessionLabel}*`}`,
    '',
    note.body,
  ].join('\n'));
  return [header.title, '', header.summary, '', '---', '', sections.join('\n\n---\n\n')].join('\n') + '\n';
}