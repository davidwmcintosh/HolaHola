/**
 * capture-conversation.ts
 *
 * Interactive session capture — reads alternating David/Luca turns from stdin
 * and appends each one immediately to .local/.chat_capture as it is entered.
 *
 * Use this for interactive back-and-forth entry when you want to capture
 * a conversation turn by turn. For single-turn appends, use append-turn.ts.
 *
 * USAGE
 * -----
 *   npx tsx server/scripts/capture-conversation.ts
 *
 *   Prompts for speaker and text interactively. Each turn is appended the
 *   moment you press Enter — not held in memory until session end.
 *
 *   Type "done" or "quit" to exit. Type "status" to see file/cursor state.
 *
 * PIPE MODE
 * ---------
 *   npx tsx server/scripts/capture-conversation.ts --pipe
 *
 *   Reads from stdin in alternating David/Luca format without prompts:
 *     David: exact text here
 *     Luca: response here
 *     David: follow-up
 *     ...
 *   Use this to pipe in a pre-written exchange. Each speaker line (and its
 *   continuation lines) is appended as a single turn.
 *
 *   Multi-line continuation: lines not starting with "David:" or "Luca:" are
 *   appended to the preceding turn.
 *
 * NOTE: This tool appends per-turn using appendChatCaptureTurn() — the same
 * function as append-turn.ts. Reconstruction is still reconstruction; if you
 * are entering text from memory, turns may be incomplete. Prefer append-turn.ts
 * at the moment each turn arrives rather than batch-entering them later.
 */

import * as readline from 'readline';
import { existsSync, statSync } from 'fs';
import {
  CHAT_CAPTURE_PATH,
  appendChatCaptureTurn,
  loadChatCaptureCursor,
  parseChatCaptureFromOffset,
} from '../services/transcript-parser';

const args    = process.argv.slice(2);
const pipeMode = args.includes('--pipe');

// ---------------------------------------------------------------------------
// Pipe mode — read "David: ..." / "Luca: ..." lines from stdin
// ---------------------------------------------------------------------------
async function runPipeMode(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

  let currentSpeaker: 'David' | 'Luca' | null = null;
  let currentLines: string[] = [];
  let turnCount = 0;

  const flush = () => {
    if (!currentSpeaker || currentLines.length === 0) return;
    const text = currentLines.join('\n').trimEnd();
    if (text.length < 1) return;
    appendChatCaptureTurn(currentSpeaker, text);
    turnCount++;
    const fileSize = existsSync(CHAT_CAPTURE_PATH) ? statSync(CHAT_CAPTURE_PATH).size : 0;
    console.error(`[CaptureConversation] ✓ ${currentSpeaker} turn #${turnCount} appended (file ${fileSize}B)`);
    currentLines = [];
  };

  for await (const line of rl) {
    const davidMatch = /^David:\s*/i.exec(line);
    const lucaMatch  = /^Luca:\s*/i.exec(line);
    if (davidMatch) {
      flush();
      currentSpeaker = 'David';
      currentLines   = [line.slice(davidMatch[0].length)];
    } else if (lucaMatch) {
      flush();
      currentSpeaker = 'Luca';
      currentLines   = [line.slice(lucaMatch[0].length)];
    } else if (currentSpeaker) {
      currentLines.push(line);
    }
  }
  flush();

  console.log(`[CaptureConversation] Done. ${turnCount} turn(s) appended.`);
}

// ---------------------------------------------------------------------------
// Interactive mode — prompts for speaker + text one turn at a time
// ---------------------------------------------------------------------------
async function runInteractiveMode(): Promise<void> {
  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
    crlfDelay: Infinity,
  });

  const ask = (q: string): Promise<string> =>
    new Promise(resolve => rl.question(q, resolve));

  console.log('[CaptureConversation] Interactive per-turn capture.');
  console.log('[CaptureConversation] Type the exact text for each turn as it arrives.');
  console.log('[CaptureConversation] Commands: "done"/"quit" to exit, "status" to show cursor info.');
  console.log('');

  let turnCount = 0;
  while (true) {
    const speaker = (await ask('Speaker (David/Luca): ')).trim();
    if (!speaker || speaker.toLowerCase() === 'done' || speaker.toLowerCase() === 'quit') {
      break;
    }
    if (speaker.toLowerCase() === 'status') {
      const cursor   = loadChatCaptureCursor();
      const fileSize = existsSync(CHAT_CAPTURE_PATH) ? statSync(CHAT_CAPTURE_PATH).size : 0;
      const { turns } = parseChatCaptureFromOffset(CHAT_CAPTURE_PATH, cursor.byteOffset);
      console.log(`  File: ${fileSize}B, cursor: ${cursor.byteOffset}B, unsaved: ${turns.length} turn(s)`);
      continue;
    }
    const speakerNorm = speaker.charAt(0).toUpperCase() + speaker.slice(1).toLowerCase();
    if (speakerNorm !== 'David' && speakerNorm !== 'Luca') {
      console.log('  → Must be David or Luca. Try again.');
      continue;
    }

    console.log(`Text for ${speakerNorm} (blank line = end of turn):`);
    const lines: string[] = [];
    while (true) {
      const line = await ask('');
      if (line === '') break;
      lines.push(line);
    }
    const text = lines.join('\n').trimEnd();
    if (!text) {
      console.log('  → Empty turn skipped.');
      continue;
    }

    appendChatCaptureTurn(speakerNorm, text);
    turnCount++;
    const fileSize = existsSync(CHAT_CAPTURE_PATH) ? statSync(CHAT_CAPTURE_PATH).size : 0;
    console.log(`  ✓ ${speakerNorm} turn #${turnCount} appended (file ${fileSize}B) — autosave will pick up within seconds.\n`);
  }

  rl.close();
  console.log(`[CaptureConversation] Done. ${turnCount} turn(s) appended.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  if (pipeMode) {
    await runPipeMode();
  } else {
    await runInteractiveMode();
  }
  process.exit(0);
})();
