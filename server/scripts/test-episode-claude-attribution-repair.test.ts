import assert from 'node:assert/strict';
import test from 'node:test';
import { attributionSha256, repairEpisodeClaudeAttribution, verifyEpisodeClaudeAttributionReceipt } from '../services/episode-claude-attribution-repair';

const source = {
  id: 'synthetic-source',
  tags: ['source-claude-code', 'capture-id:cc-approved-session-1'],
  content: 'David [Claude Code]: Question?\n\nClaude Code: Exact words — punctuation! 🙂\nSecond line.\n',
};
test('source-backed label repair preserves every non-label byte and is idempotent', () => {
  const before = '<!-- chat-capture:fixture -->\n**David [Claude Code]:** Question?\n\n**Claude Code:** Exact words — punctuation! 🙂\nSecond line.\n';
  const result = repairEpisodeClaudeAttribution(before, [source], 'approved-session');
  assert.equal(result.content, before.replace('**Claude Code:**', '**LUCA [Claude Code]:**'));
  assert.equal(result.edits.length, 1);
  assert.equal(result.edits[0].sourceId, source.id);
  assert.equal(repairEpisodeClaudeAttribution(result.content, [source], 'approved-session').edits.length, 0);
  // Mutation proof: a bare label must not satisfy the corrected-label check.
  assert.ok(result.content.includes('**LUCA [Claude Code]:**'));
  assert.ok(!before.includes('**LUCA [Claude Code]:**'));
});
test('wrong session, partial evidence, and ambiguous evidence fail closed', () => {
  const before = 'Claude Code: Exact words — punctuation! 🙂\nSecond line.\n';
  assert.throws(() => repairEpisodeClaudeAttribution(before, [source], 'wrong-session'), /Unverified/);
  assert.throws(() => repairEpisodeClaudeAttribution(before.replace('Second', 'Different'), [source], 'approved-session'), /Unverified/);
  assert.throws(() => repairEpisodeClaudeAttribution(before, [{ ...source, content: source.content.split('\nSecond')[0] }], 'approved-session'), /Unverified/);
  assert.throws(() => repairEpisodeClaudeAttribution(before, [source, { ...source, id: 'duplicate' }], 'approved-session'), /ambiguous/);
});
test('plain labels qualify, unrelated speakers and fenced examples remain unchanged', () => {
  const before = 'Claude Code: Exact words — punctuation! 🙂\nSecond line.\n\nDaniela: No changes.\n```\nClaude Code: example, not dialogue\n```\n';
  const result = repairEpisodeClaudeAttribution(before, [source], 'approved-session');
  assert.equal(result.content, before.replace(/^Claude Code:/, 'LUCA [Claude Code]:'));
});
test('casing repair does not replace canonical text with a differing source snapshot', () => {
  const before = '**LUCA [claude code]:** Exact words — punctuation! 🙂\nCanonical second line.\n';
  const result = repairEpisodeClaudeAttribution(before, [source], 'approved-session');
  assert.equal(result.content, before.replace('LUCA [claude code]', 'LUCA [Claude Code]'));
});

function receiptFixture() {
  const session = 'c52bede8-dd68-4804-8f77-59290f60b9e2';
  const before = '<!-- chat-capture:synthetic-only -->\n[2026-10-02T00:00:00Z]\nDavid [Claude Code]: Question?\n\nClaude Code: Exact words — punctuation! 🙂\nSecond line.\n';
  const repair = repairEpisodeClaudeAttribution(before, [{
    ...source, tags: ['source-claude-code', `capture-id:cc-${session}-900001`],
  }], session);
  const receipt = {
    episodeId: '41200170-1c49-4660-838c-9d397aff5d27',
    applied: true, replicaParity: true, nonLabelBytesUnchanged: true,
    beforeSha256: attributionSha256(before),
    afterSha256: attributionSha256(repair.content), edits: repair.edits,
  };
  return { before, after: repair.content, receipt };
}
test('receipt verification independently proves the complete snapshot and allows only appended content', () => {
  const { before, after, receipt } = receiptFixture();
  assert.ok(verifyEpisodeClaudeAttributionReceipt(before, after, receipt));
  assert.ok(verifyEpisodeClaudeAttributionReceipt(before, after + '\nDaniela: Newly appended words.\n', receipt));
  assert.ok(!verifyEpisodeClaudeAttributionReceipt(before, '\n' + after, receipt));
  assert.ok(!verifyEpisodeClaudeAttributionReceipt(before, after, null));
  assert.ok(!verifyEpisodeClaudeAttributionReceipt(before, after, {}));
  assert.ok(!verifyEpisodeClaudeAttributionReceipt(before, after, { ...receipt, beforeSha256: '0'.repeat(64) }));
  assert.ok(!verifyEpisodeClaudeAttributionReceipt(before, after, { ...receipt, afterSha256: '0'.repeat(64) }));
});
test('a receipt cannot authorize lost words, punctuation, timestamps, markers, other speakers or reordering', () => {
  const { before, after, receipt } = receiptFixture();
  for (const changed of [
    after.replace('Second line.', ''),
    after.replace('punctuation!', 'punctuation?'),
    after.replace('00:00:00Z', '01:00:00Z'),
    after.replace('<!-- chat-capture:synthetic-only -->', ''),
    after.replace('David [Claude Code]:', 'Daniela:'),
    after.split('\n').reverse().join('\n'),
    '',
  ]) {
    assert.ok(!verifyEpisodeClaudeAttributionReceipt(before, changed, receipt));
    // Even a recomputed after-hash cannot conceal a non-label modification.
    assert.ok(!verifyEpisodeClaudeAttributionReceipt(before, changed, { ...receipt, afterSha256: attributionSha256(changed) }));
  }
});
test('receipt spans fail closed on forged labels, offsets, provenance, ordering and bold delimiters', () => {
  const { before, after, receipt } = receiptFixture();
  const edit = receipt.edits[0];
  for (const invalid of [
    { ...edit, offset: edit.offset + 1 },
    { ...edit, offset: NaN },
    { ...edit, offset: -1 },
    { ...edit, oldLabel: 'David [Claude Code]:' },
    { ...edit, oldLabel: '**Claude Code:' },
    { ...edit, newLabel: 'Daniela:' },
    { ...edit, newLabel: '**LUCA [Claude Code]:**' },
    { ...edit, captureId: 'cc-unapproved-session-1' },
    { ...edit, sourceId: '' },
  ]) assert.ok(!verifyEpisodeClaudeAttributionReceipt(before, after, { ...receipt, edits: [invalid] }));
  assert.ok(!verifyEpisodeClaudeAttributionReceipt(before, after, { ...receipt, edits: [edit, edit] }));
});
test('a receipt cannot turn an inline or fenced code-example label into a speaker', () => {
  const { before, receipt } = receiptFixture();
  for (const prefix of ['Quotation: ', '```text\n', '~~~text\n']) {
    const offset = before.indexOf('Claude Code: Exact');
    const old = before.slice(0, offset) + prefix + before.slice(offset);
    const next = old.slice(0, offset + prefix.length) + 'LUCA [Claude Code]:' + old.slice(offset + prefix.length + 'Claude Code:'.length);
    const forged = {
      ...receipt, beforeSha256: attributionSha256(old), afterSha256: attributionSha256(next),
      edits: [{ ...receipt.edits[0], offset: offset + prefix.length }],
    };
    assert.ok(!verifyEpisodeClaudeAttributionReceipt(old, next, forged));
  }
});