import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import {
  auditManifestRow,
  parseRawEvidence,
  type RepairManifestEntry,
} from './repair-preincident-watchdog-source-identity';

function block(speaker: string, text: string): string {
  return [
    '---TURN-START---',
    `SPEAKER: ${speaker}`,
    'TIME: 2026-08-20T00:00:00.000Z',
    `CHARLEN: ${text.length}`,
    '---',
    text,
    '---TURN-END---',
    '',
  ].join('\n');
}

function manifest(content: string, expectedOutcome: RepairManifestEntry['expectedOutcome']): RepairManifestEntry {
  return {
    id: 'fixture-row',
    contentSha256: createHash('sha256').update(content).digest('hex'),
    expectedOutcome,
  };
}

test('adds only Replit source tags for one exact legacy Luca Replit sequence', () => {
  const content = '**David:** hello\n\n**LUCA [Replit]:** present';
  const raw = parseRawEvidence(block('David', 'hello') + block('Luca Replit', 'present'));
  const audit = auditManifestRow(manifest(content, 'source-replit'), content, raw);
  assert.deepEqual(audit.addTags, ['canonical-conversation', 'source-replit']);
  assert.equal(audit.addCaptureId, null);
  assert.equal(audit.exactSequenceMatches, 1);
});

test('keeps a row ambiguous when no exact raw sequence survives', () => {
  const content = '**David:** missing\n\n**LUCA [Replit]:** missing too';
  const audit = auditManifestRow(manifest(content, 'ambiguous'), content, []);
  assert.deepEqual(audit.addTags, []);
  assert.equal(audit.addCaptureId, null);
});

test('does not treat generic Luca as evidence for Luca Replit', () => {
  const content = '**David:** hello\n\n**LUCA [Replit]:** present';
  const raw = parseRawEvidence(block('David', 'hello') + block('Luca', 'present'));
  const audit = auditManifestRow(manifest(content, 'ambiguous'), content, raw);
  assert.equal(audit.outcome, 'ambiguous');
});

test('fails closed when reviewed conversation bytes drift', () => {
  const content = '**David:** hello\n\n**LUCA [Replit]:** present';
  assert.throws(
    () => auditManifestRow(manifest(content, 'source-replit'), content + '!', []),
    /content hash differs/,
  );
});