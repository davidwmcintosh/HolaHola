/**
 * record-exchange.ts
 *
 * Records a David↔Luca chat exchange into .local/.chat_capture so the autosave
 * worker routes it to conversation_memories and (when live mode is on) to the
 * rolling episode .md.
 *
 * This is the standard end-of-turn capture path for Luca [Replit] sessions.
 * Replit does not expose a live chat stream API, so capture must be triggered
 * explicitly by the agent at the end of each turn.
 *
 * USAGE
 * -----
 * Pass David's message and Luca's response via temp files to avoid shell-escaping
 * issues with quotes, backticks, dollar signs, and newlines:
 *
 *   cat > /tmp/david_turn.txt << 'ENDDAVID'
 *   David's exact message text
 *   (can be multi-line)
 *   ENDDAVID
 *
 *   cat > /tmp/luca_turn.txt << 'ENDLUCA'
 *   Luca's full response text
 *   (can be multi-line)
 *   ENDLUCA
 *
 *   npx tsx server/scripts/record-exchange.ts \
 *     --david-file /tmp/david_turn.txt \
 *     --luca-file /tmp/luca_turn.txt
 *
 * WHAT HAPPENS NEXT
 * -----------------
 * The autosave worker polls .chat_capture every ~20s. On the next poll it will:
 *   1. Insert a conversation_memories row (importance=8, tags: david-luca-chat, verbatim)
 *   2. If .local/.episode_live exists, append both turns to the rolling episode .md
 *      formatted as **David:** and **LUCA [Replit]:**
 *
 * SELF-CHECK MODE
 * ---------------
 *   npx tsx server/scripts/record-exchange.ts --self-check
 *
 * Writes a canary exchange, reads it back via parseChatCaptureFromOffset, and
 * confirms both turns are present. Exits non-zero if anything is wrong.
 */

import { readFileSync, existsSync, statSync } from 'fs';
import {
  appendChatCaptureTurn,
  CHAT_CAPTURE_PATH,
  loadChatCaptureCursor,
  parseChatCaptureFromOffset,
} from '../services/transcript-parser';

// ---------------------------------------------------------------------------
// Self-check mode
// ---------------------------------------------------------------------------
async function runSelfCheck(): Promise<void> {
  const canaryDavid = `[record-exchange self-check] David canary ${Date.now()}`;
  const canaryLuca  = `[record-exchange self-check] Luca canary ${Date.now()}`;

  // Capture the byte offset BEFORE writing so we only parse the new turns
  const cursorBefore = loadChatCaptureCursor().byteOffset;
  const fileSizeBefore = existsSync(CHAT_CAPTURE_PATH)
    ? statSync(CHAT_CAPTURE_PATH).size
    : 0;

  appendChatCaptureTurn('David', canaryDavid);
  appendChatCaptureTurn('Luca Replit', canaryLuca);

  const fileSizeAfter = existsSync(CHAT_CAPTURE_PATH)
    ? statSync(CHAT_CAPTURE_PATH).size
    : 0;

  if (fileSizeAfter <= fileSizeBefore) {
    console.error('[record-exchange --self-check] FAIL: file did not grow after appending canary turns');
    process.exit(1);
  }

  // Parse from the pre-write offset to find our canary turns
  const { turns } = parseChatCaptureFromOffset(CHAT_CAPTURE_PATH, cursorBefore);

  const davidTurn = turns.find(t => t.text === canaryDavid);
  const lucaTurn  = turns.find(t => t.text === canaryLuca);

  if (!davidTurn) {
    console.error('[record-exchange --self-check] FAIL: David canary turn not found after parse');
    process.exit(1);
  }
  if (!lucaTurn) {
    console.error('[record-exchange --self-check] FAIL: Luca canary turn not found after parse');
    process.exit(1);
  }
  if (davidTurn.speaker !== 'DAVID') {
    console.error(`[record-exchange --self-check] FAIL: David turn speaker="${davidTurn.speaker}" expected "DAVID"`);
    process.exit(1);
  }
  // Luca Replit normalises to LUCA REPLIT or similar — accept any non-DAVID value
  if (davidTurn.speaker === lucaTurn.speaker) {
    console.error('[record-exchange --self-check] FAIL: David and Luca turns have the same speaker label');
    process.exit(1);
  }

  console.log('[record-exchange --self-check] PASS — David + Luca turns written and parsed correctly');
  console.log(`  File grew: ${fileSizeBefore}B → ${fileSizeAfter}B`);
  console.log(`  David turn speaker: ${davidTurn.speaker}`);
  console.log(`  Luca turn speaker:  ${lucaTurn.speaker}`);
  console.log('  Note: cursor NOT advanced — these canary turns will be processed by the autosave on next poll.');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

if (args.includes('--self-check')) {
  runSelfCheck().catch(e => { console.error(e); process.exit(1); });
} else {
  const davidIdx = args.indexOf('--david-file');
  const lucaIdx  = args.indexOf('--luca-file');

  if (davidIdx === -1 || lucaIdx === -1) {
    console.error('Usage: npx tsx server/scripts/record-exchange.ts --david-file <path> --luca-file <path>');
    console.error('       npx tsx server/scripts/record-exchange.ts --self-check');
    process.exit(1);
  }

  const davidFile = args[davidIdx + 1];
  const lucaFile  = args[lucaIdx + 1];

  if (!existsSync(davidFile)) {
    console.error(`[record-exchange] ERROR: --david-file not found: ${davidFile}`);
    process.exit(1);
  }
  if (!existsSync(lucaFile)) {
    console.error(`[record-exchange] ERROR: --luca-file not found: ${lucaFile}`);
    process.exit(1);
  }

  const davidText = readFileSync(davidFile, 'utf-8').trimEnd();
  const lucaText  = readFileSync(lucaFile,  'utf-8').trimEnd();

  if (!davidText) {
    console.error('[record-exchange] ERROR: --david-file is empty');
    process.exit(1);
  }
  if (!lucaText) {
    console.error('[record-exchange] ERROR: --luca-file is empty');
    process.exit(1);
  }

  const sizeBefore = existsSync(CHAT_CAPTURE_PATH) ? statSync(CHAT_CAPTURE_PATH).size : 0;

  appendChatCaptureTurn('David', davidText);
  appendChatCaptureTurn('Luca Replit', lucaText);

  const sizeAfter = existsSync(CHAT_CAPTURE_PATH) ? statSync(CHAT_CAPTURE_PATH).size : 0;

  console.log(`[record-exchange] ✓ Exchange written to .chat_capture (${sizeBefore}B → ${sizeAfter}B)`);
  console.log(`  David: ${davidText.length} chars`);
  console.log(`  Luca:  ${lucaText.length} chars`);
  console.log('  Autosave will route to conversation_memories + episode within ~20s.');
}
