import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  auditEvidenceDocuments,
  sha256,
  type EvidenceDocument,
  verifiedArchiveDocuments,
} from './missing-conversation-evidence-audit';

const content = [
  '**David:** exact question',
  '',
  '**LUCA [Replit]:** exact answer',
].join('\n');

function raw(headers = 'SPEAKER: Luca Replit'): string {
  return [
    '---TURN-START---',
    'SPEAKER: David',
    'SOURCE: replit',
    'CAPTURE-ID: real-capture-1',
    '---',
    'exact question',
    '---TURN-END---',
    '---TURN-START---',
    headers,
    '---',
    'exact answer',
    '---TURN-END---',
    '',
  ].join('\n');
}

test('a unique exact raw capture sequence supports only metadata actually present', () => {
  const report = auditEvidenceDocuments('memory-1', content, [{
    class: 'retained-capture',
    location: '.local/.chat_capture',
    content: raw([
      'SPEAKER: Luca Replit',
      'SOURCE: replit',
      'CAPTURE-ID: real-capture-1',
    ].join('\n')),
  }]);
  assert.equal(report.conclusion.status, 'safe-to-tag');
  assert.equal(report.conclusion.sourceTag, 'source-replit');
  assert.equal(report.conclusion.captureIdTag, 'capture-id:real-capture-1');
});

test('legacy Luca Replit speaker proves source-replit but never invents a capture ID', () => {
  const report = auditEvidenceDocuments('memory-2', content, [{
    class: 'retained-capture',
    location: '.local/.chat_capture',
    content: raw(),
  }]);
  assert.equal(report.conclusion.status, 'safe-to-tag');
  assert.equal(report.conclusion.sourceTag, 'source-replit');
  assert.equal(report.conclusion.captureIdTag, null);
});

test('text-only raw-window matches never invent source identity or capture IDs', () => {
  const document: EvidenceDocument = {
    class: 'raw-window-ledger',
    location: 'context_lineage_events:event-1:payload_text',
    eventId: 'event-1',
    payloadSha256: sha256('exact question ... exact answer'),
    content: 'exact question ... exact answer',
  };
  const report = auditEvidenceDocuments('memory-3', content, [document]);
  assert.equal(report.conclusion.status, 'remain-ambiguous');
  assert.equal(report.conclusion.sourceTag, null);
  assert.equal(report.conclusion.captureIdTag, null);
  assert.deepEqual(report.matches[0].matchedTurns, [1, 2]);
  assert.equal(report.matches[0].exactSequence, false);
  assert.equal(report.searched[0].payloadChecksumVerified, true);
});

test('derived episode replicas are reported but can never establish source identity', () => {
  const report = auditEvidenceDocuments('memory-4', content, [{
    class: 'derived-replica',
    location: 'git:abc:docs/episode-30.md',
    content,
  }]);
  assert.equal(report.matches.length, 1);
  assert.equal(report.matches[0].class, 'derived-replica');
  assert.equal(report.conclusion.status, 'remain-ambiguous');
  assert.equal(report.conclusion.sourceTag, null);
  assert.equal(report.conclusion.captureIdTag, null);
});

test('duplicate raw proof remains ambiguous rather than choosing an identity', () => {
  const source = raw([
    'SPEAKER: Luca Replit',
    'SOURCE: replit',
    'CAPTURE-ID: real-capture-1',
  ].join('\n'));
  const report = auditEvidenceDocuments('memory-5', content, [
    { class: 'retained-capture', location: 'one', content: source },
    { class: 'archive-raw', location: 'two', content: source },
  ]);
  assert.equal(report.conclusion.status, 'remain-ambiguous');
  assert.match(report.conclusion.reason, /Multiple raw source sequences/);
});

test('a checksum-verified Git bundle exposes raw captures separately from episode replicas', () => {
  const root = mkdtempSync(join(tmpdir(), 'evidence-archive-test-'));
  const repo = join(root, 'source');
  const archive = join(root, 'archive');
  mkdirSync(join(repo, '.local'), { recursive: true });
  mkdirSync(join(repo, 'docs'), { recursive: true });
  mkdirSync(archive);
  try {
    execFileSync('git', ['init', '--quiet', repo]);
    execFileSync('git', ['-C', repo, 'config', 'user.email', 'audit@example.test']);
    execFileSync('git', ['-C', repo, 'config', 'user.name', 'Evidence Audit Test']);
    writeFileSync(join(repo, '.local', '.chat_capture'), raw([
      'SPEAKER: Luca Replit',
      'SOURCE: replit',
      'CAPTURE-ID: archive-capture-1',
    ].join('\n')).replaceAll('real-capture-1', 'archive-capture-1'));
    writeFileSync(join(repo, 'docs', 'episode-test.md'), content);
    execFileSync('git', ['-C', repo, 'add', '-f', '.local/.chat_capture', 'docs/episode-test.md']);
    execFileSync('git', ['-C', repo, 'commit', '--quiet', '-m', 'fixture']);
    const bundlePath = join(archive, 'fixture.bundle');
    execFileSync('git', ['-C', repo, 'bundle', 'create', bundlePath, '--all']);
    const bundleSha = sha256(Buffer.from(execFileSync('cat', [bundlePath])));
    writeFileSync(join(archive, 'manifest.txt'), [
      'archive_id=fixture',
      `bundle_sha256=${bundleSha}`,
      '',
    ].join('\n'));

    const verified = verifiedArchiveDocuments(archive);
    assert.equal(verified.archive.checksumVerified, true);
    assert.equal(verified.archive.gitBundleVerified, true);
    assert.equal(verified.archive.gitFsckVerified, true);
    assert.ok(verified.documents.some(document =>
      document.class === 'archive-raw' && document.location.endsWith(':.local/.chat_capture')
    ));
    assert.ok(verified.documents.some(document =>
      document.class === 'derived-replica' && document.location.endsWith(':docs/episode-test.md')
    ));
    const report = auditEvidenceDocuments('memory-archive', content, verified.documents, verified.archive);
    assert.equal(report.conclusion.status, 'safe-to-tag');
    assert.equal(report.conclusion.captureIdTag, 'capture-id:archive-capture-1');
    assert.ok(report.matches.some(match => match.class === 'derived-replica'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('archive verification rejects a bundle whose manifest checksum is wrong', () => {
  const root = mkdtempSync(join(tmpdir(), 'evidence-archive-bad-checksum-'));
  try {
    writeFileSync(join(root, 'manifest.txt'), 'archive_id=fixture\nbundle_sha256=not-the-sha\n');
    writeFileSync(join(root, 'fixture.bundle'), 'not a bundle');
    assert.throws(() => verifiedArchiveDocuments(root), /SHA-256 does not match manifest/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('explicitly incomplete coverage can never produce a safe-to-tag conclusion', () => {
  const report = auditEvidenceDocuments('memory-incomplete', content, [{
    class: 'retained-capture',
    location: '.local/.chat_capture',
    content: raw([
      'SPEAKER: Luca Replit',
      'SOURCE: replit',
      'CAPTURE-ID: real-capture-1',
    ].join('\n')),
  }], undefined, false);
  assert.equal(report.coverageComplete, false);
  assert.equal(report.conclusion.status, 'remain-ambiguous');
  assert.equal(report.conclusion.sourceTag, null);
  assert.equal(report.conclusion.captureIdTag, null);
});

test('a mismatched ledger payload checksum is explicit and never proves identity', () => {
  const report = auditEvidenceDocuments('memory-ledger-checksum', content, [{
    class: 'raw-window-ledger',
    location: 'context_lineage_events:event-bad:payload_text',
    content: 'exact question ... exact answer',
    eventId: 'event-bad',
    payloadSha256: '0'.repeat(64),
  }]);
  assert.equal(report.searched[0].payloadChecksumVerified, false);
  assert.equal(report.conclusion.status, 'remain-ambiguous');
  assert.equal(report.conclusion.sourceTag, null);
  assert.equal(report.conclusion.captureIdTag, null);
});

test('contradictory speaker and SOURCE headers cannot establish identity', () => {
  const report = auditEvidenceDocuments('memory-contradictory-source', content, [{
    class: 'retained-capture',
    location: '.local/.chat_capture',
    content: raw([
      'SPEAKER: Luca Replit',
      'SOURCE: claude-code',
      'CAPTURE-ID: real-capture-1',
    ].join('\n')),
  }]);
  assert.equal(report.conclusion.status, 'remain-ambiguous');
  assert.equal(report.conclusion.sourceTag, null);
  assert.equal(report.conclusion.captureIdTag, null);
});