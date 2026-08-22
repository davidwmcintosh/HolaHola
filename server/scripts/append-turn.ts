/**
 * append-turn.ts
 *
 * THE primary tool for verbatim per-turn conversation capture.
 *
 * Write each turn IMMEDIATELY as it arrives — not from memory, not in a batch
 * later. Reconstruction always loses something: sentence openers get dropped,
 * entire turns get collapsed. The only verbatim record is a copy made at the
 * moment the turn exists.
 *
 * The autosave server picks up each appended turn via fs.watch (sub-second)
 * or the 20-second poll (backup), saves to conversation_memories, and advances
 * the byte cursor. The file is never cleared — the cursor is the idempotency
 * guarantee.
 *
 * USAGE
 * -----
 *
 *   # Write a David turn (his exact words, copied not recalled):
 *   npx tsx server/scripts/append-turn.ts David "So, two things: you just put..."
 *
 *   # Write a Luca turn:
 *   npx tsx server/scripts/append-turn.ts Luca "I see it clearly now. Let me name..."
 *
 *   # Multi-line turn (use $'...' in bash for literal newlines):
 *   npx tsx server/scripts/append-turn.ts David $'First line.\nSecond line.\nThird line.'
 *
 *   # Read from stdin (pipe the exact text):
 *   echo "So, two things:" | npx tsx server/scripts/append-turn.ts David --stdin
 *
 *   # Show current capture file status (cursor position, file size, unsaved bytes):
 *   npx tsx server/scripts/append-turn.ts --status
 *
 *   # Reset cursor and clear file at session end (call AFTER final save):
 *   npx tsx server/scripts/append-turn.ts --reset
 *
 * WHAT GETS WRITTEN
 * -----------------
 * Each call appends one turn block to .local/.chat_capture:
 *
 *   ---TURN-START---
 *   SPEAKER: David
 *   TIME: 2026-08-10T18:45:23.456Z
 *   ---
 *   So, two things: you just put some output in the MD that I had the
 *   autosave wrong, but my comment before is missing. Those are the types
 *   of omissions I am talking about.
 *   ---TURN-END---
 *
 * The autosave worker parses complete turns from the byte cursor forward,
 * inserts them to conversation_memories, and advances the cursor.
 *
 * DO NOT batch-write multiple turns at once from memory. One call per turn,
 * at the moment the turn exists.
 */

import { existsSync, statSync } from 'fs';
import { createInterface } from 'readline';
import {
  CHAT_CAPTURE_PATH,
  CHAT_CAPTURE_CURSOR_PATH,
  appendChatCaptureTurn,
  loadChatCaptureCursor,
  resetChatCaptureCursor,
  parseChatCaptureFromOffset,
} from '../services/transcript-parser';

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const args  = process.argv.slice(2);

const showStatus = args.includes('--status');
const doReset    = args.includes('--reset');
const useStdin   = args.includes('--stdin');

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------
function printStatus(): void {
  const cursor   = loadChatCaptureCursor();
  const exists   = existsSync(CHAT_CAPTURE_PATH);
  const fileSize = exists ? statSync(CHAT_CAPTURE_PATH).size : 0;
  const unsaved  = Math.max(0, fileSize - cursor.byteOffset);

  console.log('[AppendTurn] Status:');
  console.log(`  File:    ${CHAT_CAPTURE_PATH}`);
  console.log(`  Exists:  ${exists}`);
  console.log(`  Size:    ${fileSize} bytes`);
  console.log(`  Cursor:  ${cursor.byteOffset} bytes`);
  console.log(`  Unsaved: ${unsaved} bytes`);

  if (unsaved > 0) {
    const { turns } = parseChatCaptureFromOffset(CHAT_CAPTURE_PATH, cursor.byteOffset);
    console.log(`  Unsaved turns: ${turns.length} (${turns.filter(t => t.speaker === 'DAVID').length}D + ${turns.filter(t => t.speaker === 'LUCA').length}L)`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  if (showStatus) {
    printStatus();
    process.exit(0);
  }

  if (doReset) {
    resetChatCaptureCursor();
    console.log('[AppendTurn] Chat capture file and cursor reset.');
    process.exit(0);
  }

  // Determine speaker from first positional arg
  const speakerArg = args.find(a => !a.startsWith('--'));
  if (!speakerArg) {
    console.error('[AppendTurn] Usage: append-turn.ts <David|Luca> "exact text"');
    console.error('[AppendTurn]    or: append-turn.ts <David|Luca> --stdin');
    console.error('[AppendTurn]    or: append-turn.ts --status');
    console.error('[AppendTurn]    or: append-turn.ts --reset');
    process.exit(1);
  }

  const speakerNorm =
    /^david$/i.test(speakerArg)       ? 'David'       :
    /^luca replit$/i.test(speakerArg) ? 'Luca Replit' :
    /^luca$/i.test(speakerArg)        ? 'Luca'        : null;
  if (!speakerNorm) {
    console.error(`[AppendTurn] Speaker must be "David", "Luca", or "Luca Replit", got: "${speakerArg}"`);
    process.exit(1);
  }

  // Get text — either from next positional arg or stdin
  let text: string;

  if (useStdin) {
    const lines: string[] = [];
    const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
    for await (const line of rl) {
      lines.push(line);
    }
    text = lines.join('\n').trimEnd();
  } else {
    // Next positional arg after the speaker
    const speakerIdx = args.indexOf(speakerArg);
    const nextArgs   = args.slice(speakerIdx + 1).filter(a => !a.startsWith('--'));
    text = nextArgs.join(' ').trim();
  }

  if (!text) {
    console.error('[AppendTurn] Text is empty — nothing to append.');
    console.error('[AppendTurn] Provide text as the second argument or pipe via --stdin.');
    process.exit(1);
  }

  // Append the turn
  try {
    appendChatCaptureTurn(speakerNorm, text);
    const fileSize = existsSync(CHAT_CAPTURE_PATH) ? statSync(CHAT_CAPTURE_PATH).size : 0;
    console.log(`[AppendTurn] ✓ Appended ${speakerNorm} turn (${text.length} chars, file now ${fileSize}B)`);
    console.log(`[AppendTurn]   Autosave worker will save to conversation_memories within seconds.`);
  } catch (err: any) {
    console.error('[AppendTurn] Failed to append turn:', err.message);
    process.exit(1);
  }

  process.exit(0);
})();
