/**
 * test-chat-capture-integration.ts
 *
 * End-to-end integration test for the .chat_capture pipeline:
 *
 *   appendChatCaptureTurn → parseChatCaptureFromOffset (drain loop) →
 *   cursor advance through turnByteOffsets (never newByteOffset) →
 *   stale lock recovery (dead PID → steal)
 *
 * This test does NOT write to the real .chat_capture file. It uses a temp
 * directory so production capture state is never disturbed.
 *
 * Usage:
 *   npx tsx server/scripts/test-chat-capture-integration.ts
 *
 * Exit 0 = all assertions passed. Exit 1 = at least one failure.
 */

import {
  writeFileSync, readFileSync, existsSync, unlinkSync, mkdirSync, rmSync,
  openSync, closeSync, writeSync,
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

// Import REAL production functions so Tests 5/6 verify the CHARLEN fix, not
// just the inline reimplementation.
import {
  appendChatCaptureTurn as realAppendTurn,
  parseChatCaptureFromOffset as realParseFromOffset,
  saveChatCaptureCursor,
} from '../services/transcript-parser';

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;

// ---------------------------------------------------------------------------
// Inline minimal re-implementation of the primitives under test, operating on
// tmp paths instead of the real workspace paths.
// ---------------------------------------------------------------------------

const CHAT_TURN_START = '<<<CHAT_TURN>>>';
const CHAT_TURN_END   = '<<<END_TURN>>>';

function appendTurnToFile(filePath: string, speaker: string, body: string): void {
  const entry = `${CHAT_TURN_START}\nSPEAKER:${speaker}\nBODY:${body.replace(/\n$/, '')}\n${CHAT_TURN_END}\n`;
  const fd = openSync(filePath, 'a');
  try { writeSync(fd, entry); } finally { closeSync(fd); }
}

interface ParsedTurn { speaker: string; body: string; }
interface ParseResult {
  turns: ParsedTurn[];
  newByteOffset: number;
  turnByteOffsets: number[];
}

function parseFromOffset(filePath: string, byteOffset: number): ParseResult {
  if (!existsSync(filePath)) return { turns: [], newByteOffset: byteOffset, turnByteOffsets: [] };
  const raw       = readFileSync(filePath);
  const slice     = raw.slice(byteOffset).toString('utf-8');
  const turns: ParsedTurn[]   = [];
  const turnByteOffsets: number[] = [];
  let pos = 0;
  while (true) {
    const start = slice.indexOf(CHAT_TURN_START, pos);
    if (start === -1) break;
    const end = slice.indexOf(CHAT_TURN_END, start);
    if (end === -1) break;
    const block = slice.slice(start + CHAT_TURN_START.length + 1, end);
    const lines  = block.split('\n');
    const spLine = lines.find(l => l.startsWith('SPEAKER:')) ?? '';
    const bodyIdx = lines.findIndex(l => l.startsWith('BODY:'));
    const speaker = spLine.slice('SPEAKER:'.length).trim();
    const body = (bodyIdx >= 0
      ? lines.slice(bodyIdx).join('\n').slice('BODY:'.length)
      : '').replace(/\n$/, ''); // strip only the format-artifact trailing newline
    if (speaker && body.length >= 1) {
      turns.push({ speaker, body });
      const endByte = byteOffset + Buffer.byteLength(slice.slice(0, end + CHAT_TURN_END.length + 1), 'utf-8');
      turnByteOffsets.push(endByte);
    }
    pos = end + CHAT_TURN_END.length;
  }
  const newByteOffset = byteOffset + Buffer.byteLength(slice, 'utf-8');
  return { turns, newByteOffset, turnByteOffsets };
}

// Simplified lock that writes our PID
function acquireLock(lockPath: string): number {
  try {
    const fd = openSync(lockPath, 'wx');
    try { writeFileSync(lockPath, String(process.pid), { flag: 'w' }); } catch { /* ok */ }
    return fd;
  } catch {
    // Stale lock recovery: only steal if holder is dead
    try {
      const holderPid = parseInt(readFileSync(lockPath, 'utf-8').trim(), 10);
      if (!isNaN(holderPid) && holderPid > 0) {
        let alive = false;
        try { process.kill(holderPid, 0); alive = true; } catch { /* dead */ }
        if (alive) return -1; // live process — skip
      }
      // Dead PID — steal
      try { unlinkSync(lockPath); } catch { /* race */ }
      const fd = openSync(lockPath, 'wx');
      try { writeFileSync(lockPath, String(process.pid), { flag: 'w' }); } catch { /* ok */ }
      return fd;
    } catch { return -1; }
  }
}

function releaseLock(fd: number, lockPath: string): void {
  try { closeSync(fd); } catch { /* ok */ }
  try { unlinkSync(lockPath); } catch { /* ok */ }
}

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(G(`  ✓ ${message}`));
    passed++;
  } else {
    console.error(R(`  ✗ FAIL: ${message}`));
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
async function main() {
  const dir = join(tmpdir(), `chat-capture-test-${randomBytes(4).toString('hex')}`);
  mkdirSync(dir, { recursive: true });
  const capturePath = join(dir, '.chat_capture');
  const lockPath    = join(dir, '.chat_capture.lock');

  try {

    // --- Test 1: Basic append + parse ---
    console.log(B('\nTest 1: basic append + parse'));
    appendTurnToFile(capturePath, 'David',       'Hello, Luca');
    appendTurnToFile(capturePath, 'Luca Replit', 'Hello, David');
    const r1 = parseFromOffset(capturePath, 0);
    assert(r1.turns.length === 2,            'two turns parsed');
    assert(r1.turns[0].speaker === 'David',  'first speaker = David');
    assert(r1.turns[1].speaker === 'Luca Replit', 'second speaker = Luca Replit');
    assert(r1.turnByteOffsets.length === 2,  'two byte offsets returned');
    assert(r1.turnByteOffsets[0] < r1.turnByteOffsets[1], 'offsets are ascending');
    assert(r1.turnByteOffsets[1] === r1.newByteOffset,    'last offset = newByteOffset');

    // --- Test 2: Cursor advancement only through included turns ---
    console.log(B('\nTest 2: cursor advances only through included turns'));
    // Simulate two-batch drain: read from cursor=0, only "include" first turn
    const firstOffset = r1.turnByteOffsets[0];
    // Second parse picks up only the second turn
    const r2 = parseFromOffset(capturePath, firstOffset);
    assert(r2.turns.length === 1,            'second parse sees only second turn');
    assert(r2.turns[0].speaker === 'Luca Replit', 'second parse turn is Luca');
    assert(r2.turnByteOffsets[0] === r2.newByteOffset, 'single-turn offset = newByteOffset');

    // --- Test 3: Verbatim body preservation (leading/trailing whitespace preserved) ---
    console.log(B('\nTest 3: verbatim body — leading/trailing whitespace preserved'));
    const bodyWithWhitespace = '  indented text  ';
    appendTurnToFile(capturePath, 'David', bodyWithWhitespace);
    const r3 = parseFromOffset(capturePath, r2.newByteOffset);
    assert(r3.turns.length === 1, 'one new turn');
    assert(r3.turns[0].body === bodyWithWhitespace, `body preserved verbatim: "${r3.turns[0].body}"`);

    // --- Test 4: Consecutive turns — cursor never jumps to newByteOffset when only one batch ---
    console.log(B('\nTest 4: multi-turn file — turnByteOffsets parallels turns'));
    appendTurnToFile(capturePath, 'David',       'Turn 4a');
    appendTurnToFile(capturePath, 'Luca Replit', 'Turn 4b');
    appendTurnToFile(capturePath, 'David',       'Turn 4c');
    const r4 = parseFromOffset(capturePath, r3.newByteOffset);
    assert(r4.turns.length === 3,  'three new turns');
    assert(r4.turnByteOffsets.length === 3, 'three byte offsets');
    // If we "include" only the first 2 turns, cursor should advance to [1], not newByteOffset
    const cursorAfterTwo = r4.turnByteOffsets[1];
    assert(cursorAfterTwo < r4.newByteOffset, 'cursor after 2 turns < newByteOffset');
    // Re-parse from that cursor sees only the 3rd turn
    const r4b = parseFromOffset(capturePath, cursorAfterTwo);
    assert(r4b.turns.length === 1, 're-parse from partial cursor sees remaining turn');
    assert(r4b.turns[0].body === 'Turn 4c', 'remaining turn is Turn 4c');

    // --- Test 5: REAL production code — delimiter in body round-trips verbatim ---
    // These tests use the ACTUAL appendChatCaptureTurn and parseChatCaptureFromOffset
    // (with path overrides pointing to a temp file) to verify the CHARLEN fix.
    console.log(B('\nTest 5: REAL parser — body containing production TURN-END delimiter is lossless'));
    const realCapturePath = join(dir, 'real_chat_capture.txt');
    const PROD_DELIMITER = '---TURN-END---'; // the actual production end marker
    const bodyWithDelimiter = `Line one.\n${PROD_DELIMITER}\nLine after delimiter.`;
    realAppendTurn('David', bodyWithDelimiter, realCapturePath);
    const r5 = realParseFromOffset(realCapturePath, 0);
    assert(r5.turns.length === 1, 'real parser: one turn with delimiter in body');
    assert(r5.turns[0].text === bodyWithDelimiter,
      `real parser: body with delimiter round-trips verbatim (len ${r5.turns[0].text.length})`);
    assert(!r5.turns[0].text.includes('[TURN-END-escaped]'),
      'body does NOT contain irreversible escape marker');

    // --- Test 6: REAL parser — multiple delimiters + multi-turn separation correct ---
    console.log(B('\nTest 6: REAL parser — multiple delimiters in body, second turn parsed correctly'));
    const multiDelimBody = `${PROD_DELIMITER} start. More ${PROD_DELIMITER} middle. End ${PROD_DELIMITER}`;
    realAppendTurn('Luca', multiDelimBody, realCapturePath);  // 'Luca' → speaker='LUCA'
    const r6 = realParseFromOffset(realCapturePath, r5.newByteOffset);
    assert(r6.turns.length === 1, 'real parser: second turn with multiple delimiters');
    assert(r6.turns[0].speaker === 'LUCA', 'real parser: speaker normalised to LUCA');
    assert(r6.turns[0].text === multiDelimBody,
      `real parser: multiple delimiters preserved verbatim (len ${r6.turns[0].text.length})`);

    // --- Test 7: Cursor write failure propagates (not silently swallowed) ---
    console.log(B('\nTest 7: cursor write failure propagates — not swallowed'));
    // Point saveChatCaptureCursor at a path inside a non-existent directory.
    // writeFileSync will throw ENOENT; the old code swallowed this silently —
    // the new code lets it propagate so callers can handle (log + retry).
    const badCursorPath = join(dir, 'no_such_dir', 'cursor.json');
    let cursorWriteThrew = false;
    try {
      saveChatCaptureCursor({ byteOffset: 42 }, badCursorPath);
    } catch {
      cursorWriteThrew = true;
    }
    assert(cursorWriteThrew, 'saveChatCaptureCursor propagates write error (not swallowed)');

    // --- Test 8: Stale lock recovery (dead PID → lock stolen) ---
    console.log(B('\nTest 8: stale lock recovery — dead PID is stolen'));
    // Write a lockfile with a non-existent PID (99999999)
    writeFileSync(lockPath, '99999999', 'utf-8');
    const fd8 = acquireLock(lockPath);
    assert(fd8 !== -1, 'acquired lock despite stale lockfile with dead PID');
    if (fd8 !== -1) {
      releaseLock(fd8, lockPath);
      assert(!existsSync(lockPath), 'lock released cleanly');
    }

    // --- Test 9: Live PID lock NOT stolen ---
    console.log(B('\nTest 9: live PID lock not stolen'));
    // Acquire lock normally first
    const fd9a = acquireLock(lockPath);
    assert(fd9a !== -1, 'first acquisition succeeds');
    // Second acquisition attempt while we hold it should fail
    const fd9b = acquireLock(lockPath);
    assert(fd9b === -1, 'second acquisition rejected — live PID not stolen');
    if (fd9a !== -1) releaseLock(fd9a, lockPath);

    // --- Summary ---
    console.log('');
    const total = passed + failed;
    if (failed === 0) {
      console.log(G(`✓  All ${total} assertions passed.`));
      console.log(G('   Chat-capture pipeline end-to-end: append → parse → cursor → lock recovery'));
    } else {
      console.error(R(`✗  ${failed} of ${total} assertions failed.`));
    }

  } finally {
    // Clean up temp dir
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ok */ }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(R('FATAL:'), err.message);
  process.exit(1);
});
