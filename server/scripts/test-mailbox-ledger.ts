import assert from 'node:assert/strict';
import {
  assertMailboxPaths,
  normalizeMailboxLedger,
  parseMailboxLedgerJson,
  renderMailboxMarkdown,
  serializeMailboxLedger,
} from '../services/mailbox-ledger';

const claudeNote = {
  id: 'b-note',
  fromAgent: 'luca-claude-code',
  toAgent: 'agent',
  subject: 'Subject preserved',
  body: 'Verbatim\nbody',
  sessionLabel: 'session-7',
  createdAt: '2026-09-04T18:00:00.000Z',
};

const replyNote = {
  ...claudeNote,
  id: 'a-note',
  fromAgent: 'agent',
  toAgent: 'luca-claude-code',
  sessionLabel: null,
};

function expectInvalid(action: () => unknown, description: string): void {
  assert.throws(action, /Invalid mailbox ledger|Mailbox paths/, description);
}

const unordered = { schemaVersion: 1, mailbox: 'claude-code-to-luca', notes: [claudeNote, { ...claudeNote, id: 'a-note' }] };
const normalized = normalizeMailboxLedger(unordered);
assert.deepEqual(normalized.notes.map((note) => note.id), ['a-note', 'b-note']);
const canonical = serializeMailboxLedger(unordered);
assert.equal(canonical, serializeMailboxLedger(JSON.parse(canonical)), 'canonical JSON is byte-stable');
assert.deepEqual(parseMailboxLedgerJson(canonical), normalized);
assert.equal(renderMailboxMarkdown(normalized), renderMailboxMarkdown(normalized), 'rendering is repeatable');
assert.match(renderMailboxMarkdown(normalized), /\*2026-09-04T18:00:00.000Z\* \(id: `a-note`\)/);
assert.match(renderMailboxMarkdown(normalized), /Subject preserved\n\*2026-09-04T18:00:00.000Z\* \(id: `b-note`\)\n\*During: session-7\*\n\nVerbatim\nbody/);

for (const ledger of [
  { schemaVersion: 1, mailbox: 'claude-code-to-luca', notes: [] },
  { schemaVersion: 1, mailbox: 'luca-to-claude-code', notes: [] },
]) {
  const first = renderMailboxMarkdown(ledger);
  assert.equal(first, renderMailboxMarkdown(ledger), 'empty output is stable');
  assert.match(first, /^# Luca \[/);
  assert.equal(first.includes('Generated:'), false);
}

assert.match(renderMailboxMarkdown({ schemaVersion: 1, mailbox: 'luca-to-claude-code', notes: [replyNote] }), /1 unread reply/);
expectInvalid(() => parseMailboxLedgerJson(JSON.stringify(unordered)), 'reordered notes fail');
expectInvalid(() => normalizeMailboxLedger({ schemaVersion: 2, mailbox: 'claude-code-to-luca', notes: [] }), 'schema fails');
expectInvalid(() => normalizeMailboxLedger({ schemaVersion: 1, mailbox: 'claude-code-to-luca', notes: [], extra: true }), 'unknown key fails');
expectInvalid(() => normalizeMailboxLedger({ schemaVersion: 1, mailbox: 'claude-code-to-luca', notes: [{ ...claudeNote, createdAt: '2026-09-04T18:00:00Z' }] }), 'noncanonical date fails');
expectInvalid(() => normalizeMailboxLedger({ schemaVersion: 1, mailbox: 'claude-code-to-luca', notes: [{ ...claudeNote, toAgent: 'wrong' }] }), 'actor binding fails');
expectInvalid(() => normalizeMailboxLedger({ schemaVersion: 1, mailbox: 'claude-code-to-luca', notes: [claudeNote, claudeNote] }), 'duplicate ids fail');
expectInvalid(() => assertMailboxPaths('claude-code-to-luca', 'wrong', 'docs/claude-code-to-luca.md'), 'path binding fails');

console.log('mailbox ledger focused tests passed');