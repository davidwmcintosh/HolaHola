import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PROJECTION_RECEIPTS_PATH,
  hashProjectionBytes,
  readProjectionReceipts,
  setProjectionReceiptCompletedAppendFailureForTest,
  setProjectionAfterParentOpenForTest,
  writeProjectionAtomically,
} from '../services/projection-receipts';
import { SourceReconciliationService } from '../services/source-reconciliation-service';
import { renderMailboxMarkdown, serializeMailboxLedger } from '../services/mailbox-ledger';

const root = mkdtempSync(join(tmpdir(), 'projection-receipts-'));
try {
  const episode = join(root, 'docs/episode-99.md');
  mkdirSync(join(root, 'docs'), { recursive: true });
  const first = writeProjectionAtomically(root, episode, 'canonical v1\n', {
    kind: 'episode-db-markdown', writer: 'test-writer',
    source: { type: 'conversation_memory', ids: ['99000000-0000-4000-8000-000000000099'] }, reason: 'test restore',
  });
  assert.equal(first.changed, true);
  assert.equal(first.receipt!.beforeHash, 'missing');
  assert.equal(first.receipt!.resultHash, hashProjectionBytes(Buffer.from('canonical v1\n')));
  assert.equal(writeProjectionAtomically(root, episode, 'canonical v1\n', {
    kind: 'episode-db-markdown', writer: 'test-writer',
    source: { type: 'conversation_memory', ids: ['99000000-0000-4000-8000-000000000099'] }, reason: 'test restore',
  }).changed, false, 'identical projection must not churn receipts');
  assert.equal(readProjectionReceipts(root).length, 1);
  assert.throws(() => writeProjectionAtomically(root, join(root, 'missing/episode-9.md'), 'x', {
    kind: 'episode-db-markdown', writer: 'test-writer',
    source: { type: 'conversation_memory', ids: ['09000000-0000-4000-8000-000000000009'] }, reason: 'failed test',
  }));
  assert.equal(readProjectionReceipts(root).length, 1, 'failed write must not create a receipt');
  assert.throws(() => writeProjectionAtomically(root, join(root, 'docs/not-an-episode.md'), 'x', {
    kind: 'episode-db-markdown', writer: 'test-writer',
    source: { type: 'conversation_memory', ids: ['bad'] }, reason: 'bad path',
  }));
  assert.throws(() => writeProjectionAtomically(root, join(root, 'docs/prequel-episode-1.md'), 'x', {
    kind: 'episode-db-markdown', writer: 'test-writer',
    source: { type: 'conversation_memory', ids: ['01000000-0000-4000-8000-000000000001'] }, reason: 'prequel out of scope',
  }), /Unauthorized/);
  symlinkSync(episode, join(root, 'docs/episode-8.md'));
  assert.throws(() => writeProjectionAtomically(root, join(root, 'docs/episode-8.md'), 'x', {
    kind: 'episode-db-markdown', writer: 'test-writer',
    source: { type: 'conversation_memory', ids: ['bad'] }, reason: 'symlink destination',
  }), /symlink|ELOOP/);

  const mailbox = 'claude-code-to-luca' as const;
  const ledger = {
    schemaVersion: 1 as const, mailbox,
    notes: [{ id: 'note-1', fromAgent: 'luca-claude-code', toAgent: 'agent', subject: 'Receipt', body: 'exact', sessionLabel: null, createdAt: '2026-09-05T00:00:00.000Z' }],
  };
  const ledgerPath = join(root, 'docs/mailbox-ledgers/claude-code-to-luca.json');
  mkdirSync(join(root, 'docs/mailbox-ledgers'), { recursive: true });
  writeProjectionAtomically(root, ledgerPath, serializeMailboxLedger(ledger), {
    kind: 'mailbox-ledger-json', writer: 'test-writer',
    source: { type: 'agent_notes', ids: ['note-1'] }, reason: 'mailbox snapshot', correlation: { mailbox },
  });
  const markdownPath = join(root, 'docs/claude-code-to-luca.md');
  writeProjectionAtomically(root, markdownPath, renderMailboxMarkdown(ledger), {
    kind: 'mailbox-markdown', writer: 'test-writer',
    source: { type: 'agent_notes', ids: ['note-1'] }, reason: 'mailbox snapshot', correlation: { mailbox },
  });
  mkdirSync(join(root, 'config'));
  writeFileSync(join(root, 'config/source-reconciliation-policies.json'), JSON.stringify({
    schemaVersion: 1, policies: [{
      id: 'generated-mailbox', path: 'docs/claude-code-to-luca.md', kind: 'generated-local',
      authority: 'replit', resolution: 'keep-local-in-candidate',
      proof: { builtInLedgerProof: { version: 1, formatterVersion: 1, ledgerPath: 'docs/mailbox-ledgers/claude-code-to-luca.json', mailbox } },
      checks: [],
    }, {
      id: 'generated-mailbox-ledger', path: 'docs/mailbox-ledgers/claude-code-to-luca.json', kind: 'generated-local',
      authority: 'replit', resolution: 'keep-local-in-candidate',
      proof: { builtInLedgerProof: { version: 1, formatterVersion: 1, ledgerPath: 'docs/mailbox-ledgers/claude-code-to-luca.json', mailbox } },
      checks: [],
    }, {
      id: 'episode-33-existing-policy', path: 'docs/episode-33.md', kind: 'canonical-incoming-subset',
      authority: 'replit', resolution: 'keep-local-in-candidate',
      proof: { stableMarker: 'chat-capture' }, checks: [],
    }],
  }));
  const service = new SourceReconciliationService({ rootDir: root, sourceControl: {} as any, run: async () => ({ code: 1, stdout: '', stderr: '' }) });
  const reported = await service.classifyProjectedChange('docs/claude-code-to-luca.md');
  assert.equal(reported.classified, true);
  assert.equal(reported.provenance?.writer, 'test-writer');
  assert.deepEqual(reported.provenance?.source.ids, ['note-1']);
  const ledgerReported = await service.classifyProjectedChange('docs/mailbox-ledgers/claude-code-to-luca.json');
  assert.equal(ledgerReported.classified, true, ledgerReported.error);
  // The episode receipt is deliberately not trusted until it comes from the
  // DB restore writer, demonstrating that receipt presence alone is not authority.
  assert.equal((await service.classifyProjectedChange('docs/episode-99.md')).classified, false);
  writeFileSync(join(root, 'docs/episode-33.md'), 'file-first authoring\n');
  const fallback33 = await service.classifyProjectedChange('docs/episode-33.md');
  assert.equal(fallback33.classified, false);
  assert.match(fallback33.error ?? '', /preserve existing canonical-incoming-subset/);
  writeProjectionAtomically(root, episode, 'canonical v2\n', {
    kind: 'episode-db-markdown', writer: 'restore-rolling-episodes-from-db',
    source: { type: 'conversation_memory', ids: ['99000000-0000-4000-8000-000000000099'] }, reason: 'test restore',
  });
  assert.equal((await service.classifyProjectedChange('docs/episode-99.md')).classified, true);
  writeFileSync(markdownPath, `${readFileSync(markdownPath, 'utf8')}manual edit\n`);
  assert.equal((await service.classifyProjectedChange('docs/claude-code-to-luca.md')).classified, false, 'hash mismatch must fail closed');
  assert.equal((await service.classifyProjectedChange('docs/other.md')).classified, false, 'path mismatch must fail closed');
  setProjectionReceiptCompletedAppendFailureForTest(true);
  assert.throws(() => writeProjectionAtomically(root, join(root, 'docs/episode-98.md'), 'crash-window\n', {
    kind: 'episode-db-markdown', writer: 'restore-rolling-episodes-from-db',
    source: { type: 'conversation_memory', ids: ['98000000-0000-4000-8000-000000000098'] }, reason: 'completion crash test',
  }));
  setProjectionReceiptCompletedAppendFailureForTest(false);
  assert.ok(readProjectionReceipts(root).some((entry) => entry.path === 'docs/episode-98.md'), 'matching pending projection must recover a completion');
  const heldDocs = join(root, 'held-docs');
  const outside = mkdtempSync(join(tmpdir(), 'projection-race-outside-'));
  setProjectionAfterParentOpenForTest(() => {
    renameSync(join(root, 'docs'), heldDocs);
    symlinkSync(outside, join(root, 'docs'));
    setProjectionAfterParentOpenForTest();
  });
  writeProjectionAtomically(root, join(root, 'docs/episode-33.md'), 'held-directory-write\n', {
    kind: 'episode-db-markdown', writer: 'restore-rolling-episodes-from-db',
    source: { type: 'conversation_memory', ids: ['33000000-0000-4000-8000-000000000033'] }, reason: 'parent swap race',
  });
  assert.equal(readFileSync(join(heldDocs, 'episode-33.md'), 'utf8'), 'held-directory-write\n');
  assert.equal(existsSync(join(outside, 'episode-33.md')), false, 'swapped symlink target must never receive bytes');
  unlinkSync(join(root, 'docs')); renameSync(heldDocs, join(root, 'docs')); rmSync(outside, { recursive: true });
  assert.equal((await service.classifyProjectedChange('docs/episode-33.md')).classified, true, 'numeric episode pattern must cover newly discovered rolling episodes');
  assert.equal((await service.classifyProjectedChange('docs/episode-x.md')).classified, false);

  const journalRoot = mkdtempSync(join(tmpdir(), 'projection-journal-link-'));
  mkdirSync(join(journalRoot, 'docs')); symlinkSync(join(journalRoot, 'docs'), join(journalRoot, '.local'));
  assert.throws(() => writeProjectionAtomically(journalRoot, join(journalRoot, 'docs/episode-33.md'), 'x', {
    kind: 'episode-db-markdown', writer: 'restore-rolling-episodes-from-db',
    source: { type: 'conversation_memory', ids: ['33000000-0000-4000-8000-000000000033'] }, reason: 'journal symlink',
  }), /symlink|ELOOP/);
  rmSync(journalRoot, { recursive: true, force: true });
  // An allowed path beneath a symlinked workspace ancestor is rejected too.
  rmSync(join(root, 'docs/episode-8.md'));
  const realDocs = join(root, 'real-docs');
  renameSync(join(root, 'docs'), realDocs);
  symlinkSync(realDocs, join(root, 'docs'));
  assert.throws(() => writeProjectionAtomically(root, join(root, 'docs/episode-7.md'), 'x', {
    kind: 'episode-db-markdown', writer: 'test-writer',
    source: { type: 'conversation_memory', ids: ['bad'] }, reason: 'symlink ancestor',
  }), /symlink/);
  assert.ok(readFileSync(join(root, PROJECTION_RECEIPTS_PATH), 'utf8').includes('"resultHash"'));
  console.log('Projection receipts and read-only reconciliation classification: PASS');
} finally {
  rmSync(root, { recursive: true, force: true });
}