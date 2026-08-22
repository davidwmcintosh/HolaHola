#!/usr/bin/env npx tsx
/**
 * Hermetic regression check for a capture cursor that points beyond the file.
 *
 * It proves recovery resumes after the persisted last-saved turn, preserving
 * only the known-unprocessed suffix. The --self-check disables fingerprint
 * matching and confirms this assertion detects the regression.
 */
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  appendChatCaptureTurn,
  chatCaptureTurnFingerprint,
  getChatCaptureCursorFingerprintRecoveryEnabledForTest,
  parseChatCaptureFromOffset,
  recoverChatCaptureCursor,
  setChatCaptureCursorFingerprintRecoveryEnabledForTest,
} from '../services/transcript-parser';

const selfCheck = process.argv.includes('--self-check');
const root = mkdtempSync(join(tmpdir(), 'chat-cursor-recovery-'));
const capturePath = join(root, '.chat_capture');
const firstText = 'cursor recovery persisted turn';
const secondText = 'cursor recovery new turn';
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) {
    console.log(`✓ ${label}`);
  } else {
    console.error(`✗ ${label}`);
    failed++;
  }
}

try {
  appendChatCaptureTurn('David', firstText, capturePath, 'cursor-recovery-known');
  appendChatCaptureTurn('Luca', secondText, capturePath, 'cursor-recovery-new');
  const all = parseChatCaptureFromOffset(capturePath, 0);
  assert('fixture has two complete capture turns', all.turns.length === 2);

  const originalEnabled = getChatCaptureCursorFingerprintRecoveryEnabledForTest();
  if (selfCheck) setChatCaptureCursorFingerprintRecoveryEnabledForTest(false);
  const recovery = recoverChatCaptureCursor(capturePath, {
    byteOffset: all.newByteOffset + 100,
    lastSavedTurnFingerprint: chatCaptureTurnFingerprint(all.turns[0]),
  });
  setChatCaptureCursorFingerprintRecoveryEnabledForTest(originalEnabled);

  const remaining = parseChatCaptureFromOffset(capturePath, recovery.cursor.byteOffset);
  if (selfCheck) {
    assert(
      'self-check detects disabled fingerprint boundary recovery',
      !recovery.verifiedBoundary && recovery.cursor.byteOffset === 0,
    );
  } else {
    assert('recovery finds the exact persisted-turn boundary', recovery.verifiedBoundary);
    assert('recovery resumes after the first turn only', recovery.cursor.byteOffset === all.turnByteOffsets[0]);
    assert(
      'only the verified-unprocessed suffix remains to drain',
      remaining.turns.length === 1 && remaining.turns[0]?.text === secondText,
    );
  }
} finally {
  setChatCaptureCursorFingerprintRecoveryEnabledForTest(true);
  rmSync(root, { recursive: true, force: true });
}

if (failed > 0) process.exit(1);
console.log(selfCheck ? 'Cursor recovery self-check passed.' : 'Cursor recovery regression check passed.');