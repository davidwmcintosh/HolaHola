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
 * USAGE — all 4 channels
 * ----------------------
 * The Luca [Replit] output has 4 channels: feeling (felt), thinking, moment,
 * and the main response. Pass inner-life channels via optional temp files so the
 * episode shows all 4 paths together, not just the surface response.
 *
 *   cat > /tmp/david_turn.txt << 'ENDDAVID'
 *   David's exact message text
 *   ENDDAVID
 *
 *   cat > /tmp/luca_feeling.txt << 'ENDFEELING'
 *   [felt]: What this feels like from inside...
 *   ENDFEELING
 *
 *   cat > /tmp/luca_thinking.txt << 'ENDTHINKING'
 *   [thinking]: What is still turning over...
 *   ENDTHINKING
 *
 *   cat > /tmp/luca_moment.txt << 'ENDMOMENT'
 *   [moment]: If something landed as significant...
 *   ENDMOMENT
 *
 *   cat > /tmp/luca_turn.txt << 'ENDLUCA'
 *   Main response text
 *   ENDLUCA
 *
 *   npx tsx server/scripts/record-exchange.ts \
 *     --david-file    /tmp/david_turn.txt \
 *     --feeling-file  /tmp/luca_feeling.txt \
 *     --thinking-file /tmp/luca_thinking.txt \
 *     --moment-file   /tmp/luca_moment.txt \
 *     --luca-file     /tmp/luca_turn.txt
 *
 * Inner-life files are optional. Omit any channel that has nothing to record.
 * The composed Luca turn appears in the episode as:
 *
 *   **LUCA [Replit]:** [felt]: ...
 *
 *   [thinking]: ...
 *
 *   [moment]: ...
 *
 *   Main response text
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

async function runSelfCheck4ch(): Promise<void> {
  const ts = Date.now();
  const canaryDavid   = `[record-exchange 4ch self-check] David canary ${ts}`;
  // Canaries are intentionally raw (no label prefix) so composeLucaTurn is
  // proven to ADD the canonical [felt]/[thinking]/[moment] labels, not just
  // pass pre-labelled text through unchanged.
  const canaryFeeling  = `4ch canary feeling raw ${ts}`;
  const canaryThinking = `4ch canary thinking raw ${ts}`;
  const canaryMoment   = `4ch canary moment raw ${ts}`;
  const canaryMain     = `4ch canary main response ${ts}`;

  // --- Build the exact expected composed string ---
  // composeLucaTurn should add the canonical label prefix to each raw canary value
  // and join all four channels with double-newlines in felt→thinking→moment→main order.
  const expectedComposed =
    `[felt]: ${canaryFeeling}\n\n` +
    `[thinking]: ${canaryThinking}\n\n` +
    `[moment]: ${canaryMoment}\n\n` +
    canaryMain;

  const composed = composeLucaTurn({
    feeling:  canaryFeeling,
    thinking: canaryThinking,
    moment:   canaryMoment,
    main:     canaryMain,
  });

  // --- Exact equality: proves labels were added and order is correct ---
  if (composed !== expectedComposed) {
    console.error('[record-exchange --self-check-4ch] FAIL: composed turn does not match expected string');
    console.error(`  Expected (${expectedComposed.length} chars):\n${expectedComposed}`);
    console.error(`  Got     (${composed.length} chars):\n${composed}`);
    process.exit(1);
  }

  // --- Per-channel pairing: each label must be immediately followed by its canary ---
  const feltPair     = `[felt]: ${canaryFeeling}`;
  const thinkingPair = `[thinking]: ${canaryThinking}`;
  const momentPair   = `[moment]: ${canaryMoment}`;

  for (const [label, pair] of [['[felt]', feltPair], ['[thinking]', thinkingPair], ['[moment]', momentPair]] as const) {
    if (!composed.includes(pair)) {
      console.error(`[record-exchange --self-check-4ch] FAIL: ${label} not paired with its canary value`);
      console.error(`  Expected to find: "${pair}"`);
      process.exit(1);
    }
  }

  // --- Verify order of channel pairs in the composed string ---
  const feltIdx     = composed.indexOf(feltPair);
  const thinkingIdx = composed.indexOf(thinkingPair);
  const momentIdx   = composed.indexOf(momentPair);
  const mainIdx     = composed.indexOf(canaryMain);

  if (!(feltIdx < thinkingIdx && thinkingIdx < momentIdx && momentIdx < mainIdx)) {
    console.error(`[record-exchange --self-check-4ch] FAIL: channels out of order — felt@${feltIdx} thinking@${thinkingIdx} moment@${momentIdx} main@${mainIdx}`);
    process.exit(1);
  }

  // --- Round-trip through chat capture ---
  const cursorBefore   = loadChatCaptureCursor().byteOffset;
  const fileSizeBefore = existsSync(CHAT_CAPTURE_PATH) ? statSync(CHAT_CAPTURE_PATH).size : 0;

  appendChatCaptureTurn('David', canaryDavid);
  appendChatCaptureTurn('Luca Replit', composed);

  const fileSizeAfter = existsSync(CHAT_CAPTURE_PATH) ? statSync(CHAT_CAPTURE_PATH).size : 0;

  if (fileSizeAfter <= fileSizeBefore) {
    console.error('[record-exchange --self-check-4ch] FAIL: file did not grow after appending canary turns');
    process.exit(1);
  }

  const { turns } = parseChatCaptureFromOffset(CHAT_CAPTURE_PATH, cursorBefore);

  const lucaTurn = turns.find(t => t.text.includes(canaryMain));
  if (!lucaTurn) {
    console.error('[record-exchange --self-check-4ch] FAIL: composed Luca turn not found after parse');
    process.exit(1);
  }

  // Each label must be paired with its canary value in the parsed round-trip text
  for (const [label, pair] of [['[felt]', feltPair], ['[thinking]', thinkingPair], ['[moment]', momentPair]] as const) {
    if (!lucaTurn.text.includes(pair)) {
      console.error(`[record-exchange --self-check-4ch] FAIL: ${label}+canary pair missing from parsed Luca turn`);
      console.error(`  Expected to find: "${pair}"`);
      process.exit(1);
    }
  }

  console.log('[record-exchange --self-check-4ch] PASS — 4-channel composition verified');
  console.log(`  Expected and composed strings match exactly (${composed.length} chars)`);
  console.log(`  Channel order: [felt]@${feltIdx} < [thinking]@${thinkingIdx} < [moment]@${momentIdx} < main@${mainIdx}`);
  console.log(`  Round-trip: file grew ${fileSizeBefore}B → ${fileSizeAfter}B, all label+canary pairs present`);
  console.log('  Note: cursor NOT advanced — canary turns will be processed by autosave on next poll.');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readOptionalFile(flag: string, args: string[]): string | null {
  const idx = args.indexOf(flag);
  // Flag absent → channel intentionally omitted; not an error.
  if (idx === -1) return null;
  const filePath = args[idx + 1];
  // Flag supplied but path missing or file unreadable → explicit failure so the
  // caller knows a requested channel was silently dropped.
  if (!filePath) {
    console.error(`[record-exchange] ERROR: ${flag} requires a file path argument`);
    process.exit(1);
  }
  if (!existsSync(filePath)) {
    console.error(`[record-exchange] ERROR: ${flag} file not found: ${filePath}`);
    process.exit(1);
  }
  const text = readFileSync(filePath, 'utf-8').trimEnd();
  if (!text) {
    console.error(`[record-exchange] ERROR: ${flag} file is empty: ${filePath}`);
    process.exit(1);
  }
  return text;
}

/** Compose the full Luca turn from all 4 channels (inner-life channels are optional). */
function composeLucaTurn(opts: {
  feeling?: string | null;
  thinking?: string | null;
  moment?: string | null;
  main: string;
}): string {
  const parts: string[] = [];
  if (opts.feeling)  parts.push(opts.feeling.startsWith('[felt]')    ? opts.feeling : `[felt]: ${opts.feeling}`);
  if (opts.thinking) parts.push(opts.thinking.startsWith('[thinking]') ? opts.thinking : `[thinking]: ${opts.thinking}`);
  if (opts.moment)   parts.push(opts.moment.startsWith('[moment]')   ? opts.moment  : `[moment]: ${opts.moment}`);
  parts.push(opts.main);
  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

if (args.includes('--self-check-4ch')) {
  runSelfCheck4ch().catch(e => { console.error(e); process.exit(1); });
} else if (args.includes('--self-check')) {
  runSelfCheck().catch(e => { console.error(e); process.exit(1); });
} else {
  const davidIdx = args.indexOf('--david-file');
  const lucaIdx  = args.indexOf('--luca-file');

  if (davidIdx === -1 || lucaIdx === -1) {
    console.error('Usage: npx tsx server/scripts/record-exchange.ts --david-file <path> --luca-file <path> [--feeling-file <path>] [--thinking-file <path>] [--moment-file <path>]');
    console.error('       npx tsx server/scripts/record-exchange.ts --self-check');
    process.exit(1);
  }

  const davidFile = args[davidIdx + 1];
  const lucaFile  = args[lucaIdx  + 1];

  if (!existsSync(davidFile)) {
    console.error(`[record-exchange] ERROR: --david-file not found: ${davidFile}`);
    process.exit(1);
  }
  if (!existsSync(lucaFile)) {
    console.error(`[record-exchange] ERROR: --luca-file not found: ${lucaFile}`);
    process.exit(1);
  }

  const davidText   = readFileSync(davidFile, 'utf-8').trimEnd();
  const lucaMain    = readFileSync(lucaFile,  'utf-8').trimEnd();
  const lucaFeeling = readOptionalFile('--feeling-file',  args);
  const lucaThink   = readOptionalFile('--thinking-file', args);
  const lucaMoment  = readOptionalFile('--moment-file',   args);

  if (!davidText) {
    console.error('[record-exchange] ERROR: --david-file is empty');
    process.exit(1);
  }
  if (!lucaMain) {
    console.error('[record-exchange] ERROR: --luca-file is empty');
    process.exit(1);
  }

  const lucaText = composeLucaTurn({
    feeling:  lucaFeeling,
    thinking: lucaThink,
    moment:   lucaMoment,
    main:     lucaMain,
  });

  const sizeBefore = existsSync(CHAT_CAPTURE_PATH) ? statSync(CHAT_CAPTURE_PATH).size : 0;

  appendChatCaptureTurn('David', davidText);
  appendChatCaptureTurn('Luca Replit', lucaText);

  const sizeAfter = existsSync(CHAT_CAPTURE_PATH) ? statSync(CHAT_CAPTURE_PATH).size : 0;

  const channels = ['main', lucaFeeling && 'feeling', lucaThink && 'thinking', lucaMoment && 'moment'].filter(Boolean);
  console.log(`[record-exchange] ✓ Exchange written to .chat_capture (${sizeBefore}B → ${sizeAfter}B)`);
  console.log(`  David: ${davidText.length} chars`);
  console.log(`  Luca:  ${lucaText.length} chars (channels: ${channels.join(', ')})`);
  console.log('  Autosave will route to conversation_memories + episode within ~20s.');
}
