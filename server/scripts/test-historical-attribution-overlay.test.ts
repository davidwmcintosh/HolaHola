import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  attributionSha256, repairEpisodeClaudeAttribution,
} from '../services/episode-claude-attribution-repair';
import {
  HistoricalAttributionOverlay, getApprovedHistoricalAttributionOverlay,
  setHistoricalAttributionOverlayForTest,
} from '../services/historical-attribution-overlay';
import {
  appendChatCaptureTurnsAtomic, buildDialogueChunk, chatCaptureTurnFingerprint,
  formatChatCaptureSpeakerLabel, parseChatCaptureFromOffset, type DialogueTurn,
} from '../services/transcript-parser';
import { projectHistoricalEpisodeMirror } from '../services/historical-attribution-mirror-recovery';
import { enqueueEpisodeMirror, processEpisodeMirrorOutbox, advanceEpisodeMirrorAcknowledgement } from '../services/episode-mirror-outbox';
import {
  setHistoricalAttributionStatusDirectoryForTest, getHistoricalAttributionRecoveryStatus,
  historicalAttributionRecoveryStatusLines, clearHistoricalAttributionPause,
  recordHistoricalAttributionPause,
  historicalAttributionCaptureHealth,
} from '../services/historical-attribution-status';
import { HistoricalAttributionRecoveryPaused } from '../services/historical-attribution-overlay';

const episodeId = 'synthetic-attribution-episode';
const session = 'synthetic-session';
const bodies = Array.from({ length: 21 }, (_, i) => `Older reply ${i}: café — 中文.\nSpoken line stays exact.`);
const sources = bodies.map((body, i) => ({
  id: `source-${i}`,
  content: `Claude Code: ${body}`,
  tags: ['source-claude-code', `capture-id:cc-${session}-${i}`],
}));
const original = bodies.map(body => `Claude Code: ${body}`).join('\n\n') + '\n\n';
const repair = repairEpisodeClaudeAttribution(original, sources, session);
const receiptBytes = JSON.stringify({
  episodeId, ...repair, edits: repair.edits, applied: true,
  replicaParity: true, nonLabelBytesUnchanged: true,
});
const approval = {
  episodeId, authorization: 'Synthetic fixture operator explicitly approves only these exact source turns',
  receiptSha256: attributionSha256(receiptBytes),
};
function reload(bytes = receiptBytes) {
  const overlay = new HistoricalAttributionOverlay();
  overlay.addApprovedReceipt(bytes, approval);
  return overlay;
}
const turn: DialogueTurn = {
  speaker: 'CLAUDE_CODE', source: 'claude-code',
  captureId: `cc-${session}-0`, text: bodies[0], memoryId: 0,
};

test('explicit approval and exact source identity, not runtime, authorize historical labels', () => {
  const overlay = reload();
  assert.equal(overlay.label(turn), 'LUCA [Claude Code]');
  assert.equal(overlay.label({ ...turn, speaker: 'DAVID' }), undefined);
  assert.equal(overlay.label({ ...turn, captureId: 'unapproved-same-session' }), undefined);
  assert.equal(overlay.label({ ...turn, captureId: undefined }), undefined);
  assert.equal(overlay.label({ ...turn, text: undefined }), undefined);
  assert.equal(overlay.label({ ...turn, source: 'replit' }), 'LUCA [Claude Code]');
  assert.throws(() => overlay.label({ ...turn, text: `${turn.text} ` }), /different spoken bytes/);
  assert.throws(() => overlay.label({ ...turn, text: turn.text!.slice(0, -1) }), /different spoken bytes/);
  assert.throws(() => new HistoricalAttributionOverlay().addApprovedReceipt(receiptBytes + ' ', approval), /not explicitly approved/);
  assert.throws(() => new HistoricalAttributionOverlay().addApprovedReceipt(receiptBytes, { ...approval, authorization: '' }), /not explicitly approved/);
  const casingBytes = JSON.stringify({
    episodeId, applied: true, replicaParity: true, nonLabelBytesUnchanged: true,
    edits: [{ ...repair.edits[0], evidenceKind: 'explicit-luca-casing' }],
  });
  const casing = new HistoricalAttributionOverlay();
  casing.addApprovedReceipt(casingBytes, { ...approval, receiptSha256: attributionSha256(casingBytes) });
  assert.throws(() => casing.label(turn), /casing-only evidence/);
  assert.equal(casing.label({ ...turn, speaker: 'LUCA' }), 'LUCA [Claude Code]');
});

test('autosave dialogue and persisted mirror recovery change only approved label spans', () => {
  const overlay = reload();
  setHistoricalAttributionOverlayForTest(overlay);
  try {
    const before = JSON.stringify(turn);
    const fingerprint = chatCaptureTurnFingerprint(turn);
    assert.equal(formatChatCaptureSpeakerLabel(turn), 'LUCA [Claude Code]');
    assert.equal(buildDialogueChunk([turn], 0).dialogue, `LUCA [Claude Code]: ${turn.text}\n`);
    const pending = `**David [Claude Code]:** Question\n\n**Claude Code:** ${turn.text}`;
    const sourceTurns: DialogueTurn[] = [
      { ...turn, speaker: 'DAVID', text: 'Question' }, turn,
    ];
    const projected = overlay.projectPendingMirror(pending, [turn.captureId!], sourceTurns);
    assert.equal(projected, pending.replace('**Claude Code:**', '**LUCA [Claude Code]:**'));
    assert.equal(reload().projectPendingMirror(projected, [turn.captureId!], sourceTurns), projected);
    assert.equal(overlay.projectPendingMirror(pending, ['genuine-bare']), pending);
    assert.equal(formatChatCaptureSpeakerLabel({ ...turn, captureId: 'genuine-bare' }), 'Claude Code');
    assert.throws(() => overlay.projectPendingMirror(pending + ' ', [turn.captureId!], sourceTurns), /does not match/);
    assert.throws(() => overlay.projectPendingMirror(pending, [turn.captureId!]), /independently delimited/);
    const conflicting = `**David [Claude Code]:** Question\n\n**Claude Code:** Additional unapproved speech\n\n**Claude Code:** ${turn.text}`;
    assert.throws(() => overlay.projectPendingMirror(conflicting, [turn.captureId!], sourceTurns), /does not match/);
    assert.throws(() => overlay.projectPendingMirror(conflicting, [turn.captureId!], [
      sourceTurns[0], { ...turn, text: `Additional unapproved speech\n\n**Claude Code:** ${turn.text}` },
    ]), /different spoken bytes/);
    assert.throws(() => overlay.projectPendingMirror(pending, [turn.captureId!, 'other']), /mixes capture identities/);
    assert.equal(JSON.stringify(turn), before);
    assert.equal(chatCaptureTurnFingerprint(turn), fingerprint);
  } finally {
    setHistoricalAttributionOverlayForTest();
  }
});

test('repair, restart, 21-turn watchdog backfill, and cursor replay preserve repaired prefix and bare identity', async () => {
  const wd = await import('./capture-watchdog');
  const dir = mkdtempSync(join(tmpdir(), 'historical-attribution-'));
  const capture = join(dir, 'capture');
  const cursor = join(dir, 'cursor');
  const liveFlag = join(dir, 'live');
  const receiptPath = join(dir, 'approved-receipt.json');
  const replica = join(dir, 'fixture.md');
  let episodeContent = repair.content;
  const rows: Array<{ title: string; content: string; participants: string[]; tags: string[] }> = [];
  const fakeDb = async (strings: TemplateStringsArray, ...values: any[]) => {
    const query = strings.join(' $ ').replace(/\s+/g, ' ');
    if (query.includes('SELECT content')) {
      assert.equal(values[0], episodeId);
      return [{ content: episodeContent }];
    }
    if (query.includes('UPDATE conversation_memories')) {
      assert.equal(values[1], episodeId);
      episodeContent += values[0];
      return [];
    }
    if (query.includes('SELECT id FROM conversation_memories')) {
      const found = rows.find(row => row.tags.includes(values[0]));
      return found ? [{ id: 'synthetic-row' }] : [];
    }
    if (query.includes('INSERT INTO conversation_memories')) {
      rows.push({ title: values[0], content: values[2], participants: values[3], tags: values[4] });
      return [{ id: `synthetic-row-${rows.length}` }];
    }
    throw new Error(`Unexpected fake query: ${query}`);
  };
  wd.setDbForTest(fakeDb);
  wd.setEpisodePathsForTest({ liveFlag, docsDirectory: dir });
  wd.setEpisodeOverrideForTest({ id: episodeId, filename: 'fixture.md' });
  wd.setChatCapturePathsForTest({ capture, cursor });
  wd.setReembedMemoryForTest(async () => {});
  setHistoricalAttributionStatusDirectoryForTest(join(dir, 'diagnostics'));
  try {
    writeFileSync(liveFlag, '');
    writeFileSync(receiptPath, receiptBytes);
    writeFileSync(replica, repair.content);
    setHistoricalAttributionOverlayForTest(reload(readFileSync(receiptPath, 'utf8')));
    appendChatCaptureTurnsAtomic([
      ...bodies.map((text, i) => ({
        speaker: 'Claude Code' as const, text, source: 'claude-code' as const, captureId: `cc-${session}-${i}`,
      })),
      { speaker: 'Claude Code', text: 'Genuine bare assistant.\nExact bytes  ', source: 'claude-code', captureId: 'genuine-bare' },
    ], capture);
    const raw = readFileSync(capture);
    const fingerprints = parseChatCaptureFromOffset(capture, 0).turns.map(chatCaptureTurnFingerprint);
    await wd.drain();
    assert.equal(rows.length, 22);
    assert.ok(episodeContent.startsWith(repair.content), 'repair remains an exact byte prefix');
    rows.slice(0, 21).forEach((row, i) => {
      assert.equal(row.content, `**LUCA [Claude Code]:** ${bodies[i]}`);
      assert.deepEqual(row.participants, ['david', 'luca-claude-code']);
      assert.match(row.title, /Luca \[Claude Code\]/);
    });
    assert.equal(rows[21].content, '**Claude Code:** Genuine bare assistant.\nExact bytes  ');
    assert.deepEqual(rows[21].participants, ['david', 'claude-code']);
    assert.equal(readFileSync(replica, 'utf8'), episodeContent);
    assert.deepEqual(readFileSync(capture), raw);
    const afterBackfill = episodeContent;
    // Restart reconstructs authority from the durable approval, not a repaired
    // Markdown snapshot or process-local speaker cache. Replay from byte zero.
    setHistoricalAttributionOverlayForTest(reload(readFileSync(receiptPath, 'utf8')));
    writeFileSync(cursor, JSON.stringify({ byteOffset: 0 }));
    await wd.drain();
    assert.equal(episodeContent, afterBackfill);
    assert.equal(rows.length, 22);
    assert.equal(JSON.parse(readFileSync(cursor, 'utf8')).byteOffset, raw.length);
    assert.deepEqual(parseChatCaptureFromOffset(capture, 0).turns.map(chatCaptureTurnFingerprint), fingerprints);
    await wd.drain();
    assert.equal(episodeContent, afterBackfill);
    // A damaged replay of an approved identity must hold its cursor pending,
    // even if an old canonical row already exists. Never append stale labels.
    const successfulCursor = readFileSync(cursor, 'utf8');
    appendChatCaptureTurnsAtomic([{
      speaker: 'Claude Code', source: 'claude-code',
      captureId: turn.captureId, text: `${turn.text} changed`,
    }], capture);
    await wd.drain();
    assert.equal(readFileSync(cursor, 'utf8'), successfulCursor);
    assert.equal(episodeContent, afterBackfill);
    assert.equal(rows.length, 22);
    const health = getHistoricalAttributionRecoveryStatus();
    assert.equal(health.paused, true);
    assert.equal(health.pauses[0].code, 'spoken-bytes-changed');
    assert.deepEqual(health.pauses[0].captureIds, [turn.captureId]);
    assert.equal(health.pauses[0].approvedSources[0].sourceId, 'source-0');
    assert.equal(health.pauses[0].worker, 'watchdog');
    assert.match(historicalAttributionRecoveryStatusLines().join('\n'), /Never infer an author/);
    assert.ok(!JSON.stringify(health).includes(bodies[0]), 'diagnostic must not expose speech');
    clearHistoricalAttributionPause('canonical-capture', ['genuine-bare']);
    assert.equal(getHistoricalAttributionRecoveryStatus().paused, true, 'unrelated completion cannot clear a pause');
    // A source-backed fixture reconciliation replays the same exact identity.
    // Never perform this operation on a live capture.
    writeFileSync(capture, raw);
    appendChatCaptureTurnsAtomic([{
      speaker: 'Claude Code', source: 'claude-code', captureId: turn.captureId, text: turn.text!,
    }], capture);
    await wd.drain();
    assert.equal(getHistoricalAttributionRecoveryStatus().paused, false);
    assert.equal(rows.length, 22);
  } finally {
    wd.setDbForTest(null);
    wd.setEpisodePathsForTest(null);
    wd.setEpisodeOverrideForTest(null);
    wd.setChatCapturePathsForTest(null);
    wd.setReembedMemoryForTest(null);
    setHistoricalAttributionOverlayForTest();
    setHistoricalAttributionStatusDirectoryForTest();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('checked-in approved receipts load without reading or mutating the live episode', () => {
  assert.ok(getApprovedHistoricalAttributionOverlay() instanceof HistoricalAttributionOverlay);
});

test('quoted matching suffix cannot authorize mirror delivery or acknowledgement', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'attribution-mirror-'));
  const capture = join(dir, 'capture');
  const ack = join(dir, 'ack');
  const paths = { directory: join(dir, 'outbox'), acknowledgementCursorPath: ack };
  setHistoricalAttributionOverlayForTest(reload());
  try {
    appendChatCaptureTurnsAtomic([{
      speaker: 'Claude Code', source: 'claude-code',
      captureId: turn.captureId, text: turn.text!,
    }], capture);
    const endOffset = readFileSync(capture).length;
    const original = `**Claude Code:** ${turn.text}`;
    const item = {
      startCursor: 0, endOffset, captureIds: [turn.captureId!], liveEpisode: 'synthetic.md',
      appendMarker: 'synthetic-marker',
      formattedContent: `**Claude Code:** Additional unapproved speech\n\n${original}`,
    };
    const queued = enqueueEpisodeMirror(item, paths);
    const queueBytes = readFileSync(queued);
    const ackBytes = readFileSync(ack);
    let appends = 0;
    const outcome = await processEpisodeMirrorOutbox(async pending => {
      projectHistoricalEpisodeMirror(pending, capture);
      appends++;
      writeFileSync(ack, JSON.stringify({ byteOffset: pending.endOffset }));
      return true;
    }, paths);
    assert.deepEqual(outcome, { processed: 0, pending: 1 });
    assert.equal(appends, 0);
    assert.deepEqual(readFileSync(queued), queueBytes);
    assert.deepEqual(readFileSync(ack), ackBytes);
    assert.equal(projectHistoricalEpisodeMirror({ ...item, formattedContent: original }, capture),
      `**LUCA [Claude Code]:** ${turn.text}`);
    assert.throws(() => projectHistoricalEpisodeMirror({ ...item, endOffset: endOffset - 1 }, capture),
      /original capture range is unavailable/);
    assert.throws(() => projectHistoricalEpisodeMirror(item, join(dir, 'missing-source')),
      /original capture range is unavailable/);
  } finally {
    setHistoricalAttributionOverlayForTest();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('typed reasons bind all pause cases to approved sources without changing speech', () => {
  const overlay = reload();
  const casing = new HistoricalAttributionOverlay();
  const bytes = JSON.stringify({
    episodeId, applied: true, replicaParity: true, nonLabelBytesUnchanged: true,
    edits: [{ ...repair.edits[0], evidenceKind: 'explicit-luca-casing' }],
  });
  casing.addApprovedReceipt(bytes, { ...approval, receiptSha256: attributionSha256(bytes) });
  const cases: Array<[string, () => unknown, string[]]> = [
    ['spoken-bytes-changed', () => overlay.label({ ...turn, text: turn.text + ' ' }), [turn.captureId!]],
    ['casing-only-bare-evidence', () => casing.label(turn), [turn.captureId!]],
    ['mixed-capture-mirror', () => overlay.projectPendingMirror('queued', [turn.captureId!, 'other']), [turn.captureId!, 'other']],
    ['source-capture-unavailable', () => overlay.projectPendingMirror('queued', [turn.captureId!]), [turn.captureId!]],
    ['mirror-evidence-mismatch', () => overlay.projectPendingMirror('queued', [turn.captureId!], [turn]), [turn.captureId!]],
  ];
  for (const [code, action, ids] of cases) {
    assert.throws(action, (error: unknown) => {
      assert.ok(error instanceof HistoricalAttributionRecoveryPaused);
      assert.equal(error.reason.code, code);
      assert.deepEqual(error.reason.captureIds, ids);
      assert.equal(error.reason.approvedSources[0].sourceId, 'source-0');
      assert.equal(error.reason.approvedSources[0].spokenSha256, attributionSha256(turn.text!));
      assert.match(error.reason.reconciliation, /Retry the same source identity/);
      return true;
    });
  }
});

test('autosave pending mirror reports persistent mixed identities and retains queue and acknowledgement', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'historical-status-'));
  const capture = join(dir, 'capture');
  const ack = join(dir, 'ack');
  const paths = { directory: join(dir, 'outbox'), acknowledgementCursorPath: ack };
  setHistoricalAttributionOverlayForTest(reload());
  setHistoricalAttributionStatusDirectoryForTest(join(dir, 'diagnostics'));
  let resetStatusPath: (() => void) | undefined;
  try {
    const autosave = await import('../services/agent-session-autosave');
    const { processPendingEpisodeMirrorsForTest } = autosave;
    const statusPath = join(dir, 'capture-status.md');
    autosave.setCaptureStatusPathOverrideForTest(statusPath);
    resetStatusPath = () => autosave.setCaptureStatusPathOverrideForTest(null);
    const queued = enqueueEpisodeMirror({
      startCursor: 0, endOffset: 500, captureIds: [turn.captureId!, 'other'],
      liveEpisode: 'synthetic.md', appendMarker: 'synthetic', formattedContent: 'queued evidence unchanged',
    }, paths);
    const queueBytes = readFileSync(queued);
    const ackBytes = readFileSync(ack);
    await processPendingEpisodeMirrorsForTest(paths, capture);
    const status = getHistoricalAttributionRecoveryStatus();
    const health = historicalAttributionCaptureHealth({ ok: true, status: 200 });
    assert.equal(health.status, 503);
    assert.equal(health.ok, false);
    assert.deepEqual(health.historicalRecovery, status);
    assert.equal(status.pauses[0].code, 'mixed-capture-mirror');
    assert.equal(status.pauses[0].lane, 'episode-mirror');
    assert.deepEqual(status.pauses[0].captureIds, [turn.captureId, 'other']);
    assert.deepEqual(readFileSync(queued), queueBytes);
    assert.deepEqual(readFileSync(ack), ackBytes);
    // Non-historical failures do not erase the original actionable reason.
    recordHistoricalAttributionPause(new Error('unrelated failure'), 'episode-mirror', 'autosave');
    clearHistoricalAttributionPause('canonical-capture', [turn.captureId!, 'other']);
    clearHistoricalAttributionPause('episode-mirror', ['unrelated']);
    assert.deepEqual(getHistoricalAttributionRecoveryStatus(), status);
    assert.match(historicalAttributionRecoveryStatusLines().join('\n'), /single-capture items/);
    autosave.writeCaptureStatusDbOnlyForTest();
    const renderedStatus = readFileSync(statusPath, 'utf8');
    assert.match(renderedStatus, /Historical attribution recovery — PAUSED/);
    assert.match(renderedStatus, /mixed-capture-mirror/);
    assert.match(renderedStatus, /source-0/);
    assert.match(renderedStatus, /Do not|Never infer an author/);
    assert.ok(!renderedStatus.includes('queued evidence unchanged'));
    // Audited source-backed replacement happens only in this temp fixture.
    // Retain the original mixed evidence, then replace it with two independently
    // delimited source captures. The real outbox delivers each separately.
    const retainedOriginal = join(dir, 'retained-original-queue.json');
    writeFileSync(retainedOriginal, queueBytes);
    unlinkSync(queued);
    appendChatCaptureTurnsAtomic([
      { speaker: 'Claude Code', source: 'claude-code', captureId: turn.captureId, text: turn.text! },
      { speaker: 'Claude Code', source: 'claude-code', captureId: 'other', text: 'Genuine bare speech  ' },
    ], capture);
    const parsed = parseChatCaptureFromOffset(capture, 0);
    let startCursor = 0;
    for (let i = 0; i < parsed.turns.length; i++) {
      const sourceTurn = parsed.turns[i];
      enqueueEpisodeMirror({
        startCursor, endOffset: parsed.turnByteOffsets[i], captureIds: [sourceTurn.captureId!],
        liveEpisode: 'synthetic.md', appendMarker: `synthetic-replacement-${i}`,
        formattedContent: `**Claude Code:** ${sourceTurn.text}`,
      }, paths);
      startCursor = parsed.turnByteOffsets[i];
    }
    const delivered: string[] = [];
    const outcome = await processEpisodeMirrorOutbox(async item => {
      delivered.push(projectHistoricalEpisodeMirror(item, capture));
      advanceEpisodeMirrorAcknowledgement(item, paths);
      clearHistoricalAttributionPause('episode-mirror', item.captureIds);
      if (delivered.length === 1) {
        const partial = getHistoricalAttributionRecoveryStatus();
        assert.equal(partial.paused, true);
        assert.deepEqual(partial.pauses[0].captureIds, [turn.captureId, 'other']);
        assert.deepEqual(partial.pauses[0].completedCaptureIds, [turn.captureId]);
        assert.deepEqual(JSON.parse(readFileSync(join(dir, 'diagnostics', 'episode-mirror.json'), 'utf8')).completedCaptureIds, [turn.captureId]);
        assert.equal(historicalAttributionCaptureHealth({ ok: true, status: 200 }).status, 503);
        clearHistoricalAttributionPause('episode-mirror', ['unrelated']);
        clearHistoricalAttributionPause('canonical-capture', ['other']);
        assert.deepEqual(getHistoricalAttributionRecoveryStatus(), partial);
        autosave.writeCaptureStatusDbOnlyForTest();
        assert.match(readFileSync(statusPath, 'utf8'), /Completed reconciled capture IDs:/);
      }
      return true;
    }, paths);
    assert.deepEqual(outcome, { processed: 2, pending: 0 });
    assert.deepEqual(delivered, [`**LUCA [Claude Code]:** ${turn.text}`, '**Claude Code:** Genuine bare speech  ']);
    assert.equal(getHistoricalAttributionRecoveryStatus().paused, false);
    assert.equal(historicalAttributionCaptureHealth({ ok: true, status: 200 }).status, 200);
    assert.equal(historicalAttributionCaptureHealth({ ok: false, status: 503 }).ok, false);
    autosave.writeCaptureStatusDbOnlyForTest();
    assert.ok(!readFileSync(statusPath, 'utf8').includes('Historical attribution recovery — PAUSED'));
    assert.deepEqual(readFileSync(retainedOriginal), queueBytes);
    assert.equal(JSON.parse(readFileSync(ack, 'utf8')).byteOffset, readFileSync(capture).length);
    writeFileSync(join(dir, 'diagnostics', 'episode-mirror.json'), '{broken');
    assert.equal(getHistoricalAttributionRecoveryStatus().diagnosticUnavailable, true);
    assert.equal(getHistoricalAttributionRecoveryStatus().paused, true);
  } finally {
    resetStatusPath?.();
    setHistoricalAttributionOverlayForTest();
    setHistoricalAttributionStatusDirectoryForTest();
    rmSync(dir, { recursive: true, force: true });
  }
});