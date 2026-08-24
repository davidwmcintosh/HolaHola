/**
 * Hermetic contract test for the shared Claude Code/Replit capture path.
 *
 * Covers the task-critical failures:
 *   - missing/empty capture is rejected before bytes are written
 *   - a retry with the same turn ID does not duplicate either author
 *   - source labels preserve Claude Code vs Luca [Replit] attribution
 *   - a failed acknowledgement is persisted as a visible per-turn receipt
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  appendCanonicalConversationExchange,
  isCompleteCanonicalCaptureBatch,
  selectCanonicalCaptureBatch,
  settleCanonicalCaptureReceipts,
  writeCanonicalCaptureReceipt,
} from '../services/canonical-conversation-capture';
import {
  appendChatCaptureTurn,
  buildDialogueChunk,
  parseChatCaptureFromOffset,
} from '../services/transcript-parser';

const root = mkdtempSync(join(tmpdir(), 'canonical-conversation-capture-'));
const capturePath = join(root, 'capture.log');

function fail(message: string): never {
  throw new Error(`[canonical-conversation-capture] ${message}`);
}

try {
  // Missing capture: reject before the private stream can receive any bytes.
  try {
    appendCanonicalConversationExchange({
      source: 'replit',
      userText: '',
      assistantText: 'This must never be recorded without its user turn.',
      turnId: 'missing-user-identity-001',
      capturePath,
    });
    fail('missing user turn was accepted');
  } catch (error: any) {
    if (!String(error?.message ?? error).includes('userText')) throw error;
  }
  if (existsSync(capturePath)) fail('missing capture created a log file');

  const replit = appendCanonicalConversationExchange({
    source: 'replit',
    userText: 'Replit user turn',
    assistantText: '[felt]: f\n\n[thinking]: t\n\n[moment]: m\n\nReplit assistant turn',
    turnId: 'replit-identity-001',
    capturePath,
  });
  if (replit.appendedSpeakers.join(',') !== 'user,assistant') {
    fail(`expected first Replit write to append both authors, got ${replit.appendedSpeakers.join(',')}`);
  }
  const sizeAfterReplit = statSync(capturePath).size;
  const replitRetry = appendCanonicalConversationExchange({
    source: 'replit',
    userText: 'Replit user turn',
    assistantText: '[felt]: f\n\n[thinking]: t\n\n[moment]: m\n\nReplit assistant turn',
    turnId: 'replit-identity-001',
    capturePath,
  });
  if (replitRetry.appendedSpeakers.length !== 0 || statSync(capturePath).size !== sizeAfterReplit) {
    fail('same Replit turn ID wrote duplicate capture bytes on retry');
  }

  // A partial exchange from another interface claims this stable ID; it must
  // fail closed rather than allow the two sources to share an author pair.
  appendChatCaptureTurn('Claude Code', 'Claude-only partial turn', capturePath, 'cross-source-partial-001', 'claude-code');
  try {
    appendCanonicalConversationExchange({
      source: 'replit',
      userText: 'Different interface user turn',
      assistantText: '[felt]: f\n\n[thinking]: t\n\n[moment]: m\n\nDifferent interface assistant turn',
      turnId: 'cross-source-partial-001',
      capturePath,
    });
    fail('cross-interface stable turn ID collision was accepted');
  } catch (error: any) {
    if (!String(error?.message ?? error).includes('different or legacy source')) throw error;
  }

  // A same-source one-sided historical capture is not silently completed out
  // of order. Fresh exchanges are atomic; malformed old bytes are quarantined
  // visibly rather than being merged with a later unrelated author turn.
  appendChatCaptureTurn('David', 'Historical partial user turn', capturePath, 'same-source-partial-001', 'replit');
  try {
    appendCanonicalConversationExchange({
      source: 'replit',
      userText: 'Historical partial user turn',
      assistantText: '[felt]: f\n\n[thinking]: t\n\n[moment]: m\n\nLate assistant turn',
      turnId: 'same-source-partial-001',
      capturePath,
    });
    fail('same-source partial capture was silently completed');
  } catch (error: any) {
    if (!String(error?.message ?? error).includes('requires reconciliation')) throw error;
  }

  // A held ingress lock makes contention visible and guarantees the caller can
  // retry the same identity instead of racing a second append.
  const lockPath = join(root, 'ingress.lock');
  writeFileSync(lockPath, String(process.pid), 'utf8');
  try {
    appendCanonicalConversationExchange({
      source: 'claude-code',
      userText: 'Busy user turn',
      assistantText: 'Busy assistant turn',
      turnId: 'busy-lock-identity-001',
      capturePath,
      ingressLockPath: lockPath,
    });
    fail('concurrent ingress lock was ignored');
  } catch (error: any) {
    if (!String(error?.message ?? error).includes('ingress is busy')) throw error;
  } finally {
    rmSync(lockPath, { force: true });
  }

  // A dead process's ingress lock is recovered; canonical capture cannot remain
  // unavailable after a prior writer crashes.
  writeFileSync(lockPath, '999999999', 'utf8');
  appendCanonicalConversationExchange({
    source: 'claude-code',
    userText: 'Recovered-lock user turn',
    assistantText: 'Recovered-lock assistant turn',
    turnId: 'recovered-lock-identity-001',
    capturePath,
    ingressLockPath: lockPath,
  });

  // Batch shape can change after cursor recovery. Projection must retain one
  // stable capture ID per DB row instead of using an A|B batch identity.
  const replayTurns = [
    { captureId: 'projection-a' },
    { captureId: 'projection-a' },
    { captureId: 'projection-b' },
    { captureId: 'projection-b' },
  ];
  const firstProjection = selectCanonicalCaptureBatch(replayTurns);
  const secondProjection = selectCanonicalCaptureBatch(replayTurns.slice(firstProjection.length));
  if (firstProjection.some(turn => turn.captureId !== 'projection-a') || secondProjection.some(turn => turn.captureId !== 'projection-b')) {
    fail('cursor replay batch boundaries did not remain per-capture-ID');
  }
  if (isCompleteCanonicalCaptureBatch([{ speaker: 'DAVID', captureId: 'half-written', source: 'replit' }])) {
    fail('autosave would acknowledge a capture ID with only one author side');
  }
  if (!isCompleteCanonicalCaptureBatch([
    { speaker: 'DAVID', captureId: 'complete-pair', source: 'claude-code' },
    { speaker: 'CLAUDE_CODE', captureId: 'complete-pair', source: 'claude-code' },
  ])) {
    fail('autosave rejected a complete source-attributed capture pair');
  }

  // --luca-only is a retained legacy continuation: its David side was already
  // captured through another pipeline. It must remain a source-attributed
  // ordinary turn, not be assigned a complete-exchange ID and quarantined.
  appendChatCaptureTurn(
    'Luca Replit',
    '[felt]: legacy\n\n[thinking]: continuation\n\n[moment]: retained\n\nLegacy Luca-only continuation',
    capturePath,
    undefined,
    'replit',
  );
  const legacyContinuation = parseChatCaptureFromOffset(capturePath, 0).turns.at(-1);
  if (!legacyContinuation || legacyContinuation.captureId || !isCompleteCanonicalCaptureBatch([legacyContinuation])) {
    fail('legacy Luca-only continuation was treated as an incomplete complete-exchange capture');
  }

  const claude = appendCanonicalConversationExchange({
    source: 'claude-code',
    userText: 'Claude Code user turn',
    assistantText: 'Claude Code assistant turn',
    turnId: 'claude-code-identity-001',
    capturePath,
  });
  if (claude.appendedSpeakers.join(',') !== 'user,assistant') {
    fail(`expected first Claude Code write to append both authors, got ${claude.appendedSpeakers.join(',')}`);
  }

  const parsed = parseChatCaptureFromOffset(capturePath, 0);
  if (parsed.turns.length !== 9) fail(`expected nine turns including the legacy Luca-only continuation and recovered-lock fixtures, got ${parsed.turns.length}`);
  const dialogue = buildDialogueChunk(parsed.turns, 0).dialogue;
  for (const required of [
    'David [Replit]: Replit user turn',
    'Luca [Replit]: [felt]: f',
    'David [Claude Code]: Claude Code user turn',
    'Claude Code: Claude Code assistant turn',
    'Luca [Replit]: [felt]: legacy',
  ]) {
    if (!dialogue.includes(required)) fail(`source-attributed canonical dialogue omitted "${required}"`);
  }

  const failedTurnId = 'failed-ack-identity-001';
  writeCanonicalCaptureReceipt({
    turnId: failedTurnId,
    targetByteOffset: 999,
    createdAtMs: Date.now(),
    source: 'claude-code',
    status: 'failed',
    failedAtMs: Date.now(),
    failureReason: 'synthetic acknowledgement timeout',
  }, {
    latestPath: join(root, 'latest-receipt.json'),
    receiptDir: join(root, 'receipts'),
  });
  const receiptPath = join(root, 'receipts', `${failedTurnId}.json`);
  if (!existsSync(receiptPath)) fail('failed acknowledgement receipt was not persisted');
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  if (receipt.status !== 'failed' || !String(receipt.failureReason).includes('timeout')) {
    fail('failed acknowledgement receipt did not preserve its visible failure state');
  }

  const pendingTurnId = 'pending-ack-identity-001';
  const cursorPath = join(root, 'cursor.json');
  writeFileSync(cursorPath, JSON.stringify({ byteOffset: 4 }), 'utf8');
  writeCanonicalCaptureReceipt({
    turnId: pendingTurnId,
    targetByteOffset: 4,
    createdAtMs: Date.now(),
    source: 'replit',
    status: 'pending',
  }, {
    latestPath: join(root, 'latest-receipt.json'),
    receiptDir: join(root, 'receipts'),
    cursorPath,
  });
  const createdAfterDrain = JSON.parse(readFileSync(join(root, 'receipts', `${pendingTurnId}.json`), 'utf8'));
  if (createdAfterDrain.status !== 'acknowledged' || !createdAfterDrain.acknowledgedAtMs) {
    fail('receipt created after cursor acknowledgement remained pending');
  }
  settleCanonicalCaptureReceipts(4, {
    latestPath: join(root, 'latest-receipt.json'),
    receiptDir: join(root, 'receipts'),
    cursorPath,
  });
  const settled = JSON.parse(readFileSync(join(root, 'receipts', `${pendingTurnId}.json`), 'utf8'));
  if (settled.status !== 'acknowledged' || !settled.acknowledgedAtMs) {
    fail('cursor acknowledgement did not settle a pending durable receipt');
  }

  console.log('PASS: canonical conversation capture preserves sources, serializes retries, rejects source collisions/missing turns, and persists receipt state.');
} finally {
  rmSync(root, { recursive: true, force: true });
}
