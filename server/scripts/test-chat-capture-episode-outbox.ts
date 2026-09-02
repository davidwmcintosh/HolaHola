/**
 * Regression for the canonical-chat cursor wedge:
 * canonical DB progress must continue while an episode mirror is retrying,
 * and receipts must remain pending until that mirror succeeds.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import {
  enqueueEpisodeMirror,
  listEpisodeMirrorOutbox,
  processEpisodeMirrorOutbox,
  type EpisodeMirrorOutboxItem,
} from '../services/episode-mirror-outbox';
import { saveChatCaptureCursor } from '../services/transcript-parser';
import {
  settleCanonicalCaptureReceiptsByTurnId,
  writeCanonicalCaptureReceipt,
} from '../services/canonical-conversation-capture';

let passed = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
  passed++;
  console.log(`✓ ${message}`);
}

async function main(): Promise<void> {
  const root = join(tmpdir(), `chat-episode-outbox-${randomBytes(4).toString('hex')}`);
  const directory = join(root, 'outbox');
  const acknowledgementCursorPath = join(root, 'ack-cursor.json');
  const projectionCursorPath = join(root, 'projection-cursor.json');
  const receiptDir = join(root, 'receipts');
  const latestPath = join(root, 'latest-receipt.json');
  mkdirSync(root, { recursive: true });

  const paths = { directory, acknowledgementCursorPath };
  const receiptPaths = { receiptDir, latestPath, cursorPath: acknowledgementCursorPath };
  const first: EpisodeMirrorOutboxItem = {
    startCursor: 0,
    endOffset: 100,
    liveEpisode: 'episode-test.md',
    formattedContent: '**David [Replit]:** first',
    appendMarker: '<!-- chat-capture-range:0:100 -->',
    captureIds: ['first'],
    lastSavedTurnFingerprint: 'fingerprint-first',
  };
  const second: EpisodeMirrorOutboxItem = {
    startCursor: 100,
    endOffset: 200,
    liveEpisode: 'episode-test.md',
    formattedContent: '**David [Replit]:** second',
    appendMarker: '<!-- chat-capture-range:100:200 -->',
    captureIds: ['second'],
    lastSavedTurnFingerprint: 'fingerprint-second',
  };

  try {
    enqueueEpisodeMirror(first, paths);
    saveChatCaptureCursor({ byteOffset: 100 }, projectionCursorPath);
    writeCanonicalCaptureReceipt({
      turnId: 'first',
      targetByteOffset: 100,
      createdAtMs: Date.now(),
      source: 'replit',
      status: 'pending',
    }, receiptPaths);

    const failed = await processEpisodeMirrorOutbox(async () => false, paths);
    assert(failed.processed === 0 && failed.pending === 1, 'failed mirror remains durably queued');
    assert(JSON.parse(readFileSync(projectionCursorPath, 'utf8')).byteOffset === 100, 'canonical cursor advances after DB success despite mirror failure');
    assert(JSON.parse(readFileSync(acknowledgementCursorPath, 'utf8')).byteOffset === 0, 'acknowledgement cursor does not advance on mirror failure');
    assert(JSON.parse(readFileSync(join(receiptDir, 'first.json'), 'utf8')).status === 'pending', 'receipt remains pending after mirror failure');

    enqueueEpisodeMirror(second, paths);
    saveChatCaptureCursor({ byteOffset: 200 }, projectionCursorPath);
    writeCanonicalCaptureReceipt({
      turnId: 'second',
      targetByteOffset: 200,
      createdAtMs: Date.now(),
      source: 'replit',
      status: 'pending',
    }, receiptPaths);
    assert(listEpisodeMirrorOutbox(paths).length === 2, 'later exchange queues while the first mirror is still pending');
    assert(JSON.parse(readFileSync(projectionCursorPath, 'utf8')).byteOffset === 200, 'later canonical exchange drains past the failed mirror');

    const order: number[] = [];
    const recovered = await processEpisodeMirrorOutbox(async item => {
      order.push(item.endOffset);
      saveChatCaptureCursor({
        byteOffset: item.endOffset,
        lastSavedTurnFingerprint: item.lastSavedTurnFingerprint,
      }, acknowledgementCursorPath);
      settleCanonicalCaptureReceiptsByTurnId(item.captureIds, item.endOffset, receiptPaths);
      return true;
    }, paths);

    assert(recovered.processed === 2 && recovered.pending === 0, 'successful retry drains both queued mirrors');
    assert(order.join(',') === '100,200', 'mirror retries preserve cursor order');
    assert(JSON.parse(readFileSync(acknowledgementCursorPath, 'utf8')).byteOffset === 200, 'acknowledgement cursor reaches the final mirrored boundary');
    assert(JSON.parse(readFileSync(join(receiptDir, 'first.json'), 'utf8')).status === 'acknowledged', 'first receipt settles after its mirror succeeds');
    assert(JSON.parse(readFileSync(join(receiptDir, 'second.json'), 'utf8')).status === 'acknowledged', 'later receipt settles only after its mirror succeeds');
    assert(listEpisodeMirrorOutbox(paths).length === 0, 'completed mirror items are removed');

    writeFileSync(join(directory, '00000000000000000300-corrupt.json'), '{', 'utf8');
    let malformedFailedClosed = false;
    try {
      await processEpisodeMirrorOutbox(async () => true, paths);
    } catch {
      malformedFailedClosed = true;
    }
    assert(malformedFailedClosed, 'malformed outbox item fails closed instead of skipping an acknowledgement boundary');

    console.log(`\nPASS — ${passed} episode-outbox assertions`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(`FAIL — ${error?.message ?? error}`);
  process.exit(1);
});