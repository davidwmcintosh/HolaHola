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
 * and the main response. Every capture must explicitly supply all four slots so
 * the episode cannot silently retain only the surface response.
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
 * Each inner-life slot is required. If a channel genuinely has no authored
 * content, use its explicit-empty flag (`--felt-empty`, `--thinking-empty`, or
 * `--moment-empty`) rather than omitting it. The canonical record will show
 * `[intentionally empty]`, an acknowledgement of absence rather than invented
 * inner-life text.
 * During live mode this composed turn is the ONLY episode route for these
 * channels. The persistent .luca_reflection/.luca_question/.luca_moment files
 * still save personal memory and readiness status, but do not append a second
 * episode copy.
 * The composed Luca turn appears in the episode as:
 *
 *   **LUCA [Replit]:** [felt]: ... or [intentionally empty]
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

import { readFileSync, existsSync, statSync, writeFileSync, renameSync, mkdirSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import {
  appendChatCaptureTurn,
  CHAT_CAPTURE_PATH,
  WORKSPACE,
  parseChatCaptureFromOffset,
} from '../services/transcript-parser';
import {
  buildCanonicalInnerLifeTurnIntent,
  CANONICAL_INNER_LIFE_INTENT_DIR,
  composeLucaTurn,
  pruneCapturedCanonicalInnerLifeIntents,
  type CanonicalInnerLifeTurnIntent,
  type FourChannelLucaTurn,
} from '../services/inner-life-capture';
export { composeLucaTurn } from '../services/inner-life-capture';

// ---------------------------------------------------------------------------
// Self-check mode
// ---------------------------------------------------------------------------
async function runSelfCheck(): Promise<void> {
  const ts = Date.now();
  const canaryDavid = `[record-exchange self-check] David canary ${ts}`;
  const canaryLuca  = `[record-exchange self-check] Luca canary ${ts}`;
  const testCapturePath = join(
    WORKSPACE,
    '.local',
    `record-exchange-self-check-${process.pid}-${ts}.capture`,
  );

  // Never write CI canaries into the live stream: autosave could race the
  // assertion and project synthetic turns into the rolling episode.
  const fileSizeBefore = 0;

  appendChatCaptureTurn('David', canaryDavid, testCapturePath);
  appendChatCaptureTurn('Luca Replit', canaryLuca, testCapturePath);

  const fileSizeAfter = existsSync(testCapturePath)
    ? statSync(testCapturePath).size
    : 0;

  if (fileSizeAfter <= fileSizeBefore) {
    console.error('[record-exchange --self-check] FAIL: file did not grow after appending canary turns');
    process.exit(1);
  }

  // Parse from the pre-write offset to find our canary turns
  const { turns } = parseChatCaptureFromOffset(testCapturePath, 0);

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
  unlinkSync(testCapturePath);
  console.log('  Hermetic capture removed; the live cursor and episode were untouched.');
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
  const testCapturePath = join(
    WORKSPACE,
    '.local',
    `record-exchange-4ch-self-check-${process.pid}-${ts}.capture`,
  );

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
  const fileSizeBefore = 0;

  appendChatCaptureTurn('David', canaryDavid, testCapturePath);
  appendChatCaptureTurn('Luca Replit', composed, testCapturePath);

  const fileSizeAfter = existsSync(testCapturePath) ? statSync(testCapturePath).size : 0;

  if (fileSizeAfter <= fileSizeBefore) {
    console.error('[record-exchange --self-check-4ch] FAIL: file did not grow after appending canary turns');
    process.exit(1);
  }

  const { turns } = parseChatCaptureFromOffset(testCapturePath, 0);

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
  unlinkSync(testCapturePath);
  console.log('  Hermetic capture removed; the live cursor and episode were untouched.');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readRequiredChannel(
  flag: string,
  emptyFlag: string,
  args: string[],
): string {
  const idx = args.indexOf(flag);
  const explicitlyEmpty = args.includes(emptyFlag);
  if (idx !== -1 && explicitlyEmpty) {
    console.error(`[record-exchange] ERROR: use either ${flag} or ${emptyFlag}, not both`);
    process.exit(1);
  }
  if (explicitlyEmpty) return '';
  if (idx === -1) {
    console.error(`[record-exchange] ERROR: ${flag} is required; use ${emptyFlag} only when that channel is intentionally empty`);
    process.exit(1);
  }
  const filePath = args[idx + 1];
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
    console.error(`[record-exchange] ERROR: ${flag} file is empty: ${filePath}; use ${emptyFlag} to acknowledge an intentionally empty channel`);
    process.exit(1);
  }
  return text;
}

export function writeCanonicalIntent(
  opts: {
    feeling?: string | null;
    thinking?: string | null;
    moment?: string | null;
    main: string;
  },
  pathOverride?: string,
): { intent: CanonicalInnerLifeTurnIntent; path: string } {
  const intent = buildCanonicalInnerLifeTurnIntent(opts);
  const intentPath = pathOverride ?? join(
    WORKSPACE,
    '.local',
    CANONICAL_INNER_LIFE_INTENT_DIR,
    `${intent.turnId}.json`,
  );
  mkdirSync(dirname(intentPath), { recursive: true });
  // Retention is intentionally run before each new handoff, not just when a
  // trigger happens to resolve. Captured records live for 14 days; pending
  // handoffs are never eligible for cleanup.
  pruneCapturedCanonicalInnerLifeIntents(dirname(intentPath));
  const tempPath = `${intentPath}.tmp-${process.pid}`;
  writeFileSync(tempPath, JSON.stringify(intent), 'utf8');
  renameSync(tempPath, intentPath);
  return { intent, path: intentPath };
}

function markCanonicalIntentCaptured(
  handoff: { intent: CanonicalInnerLifeTurnIntent; path: string },
): void {
  const tempPath = `${handoff.path}.tmp-${process.pid}`;
  writeFileSync(
    tempPath,
    JSON.stringify({ ...handoff.intent, status: 'captured' }),
    'utf8',
  );
  renameSync(tempPath, handoff.path);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const isMain = process.argv[1]?.includes('record-exchange');
const args = isMain ? process.argv.slice(2) : [];

if (!isMain) {
  // Import-only use (tests and shared composition); do not execute the CLI.
} else if (args.includes('--self-check-4ch')) {
  runSelfCheck4ch().catch(e => { console.error(e); process.exit(1); });
} else if (args.includes('--self-check')) {
  runSelfCheck().catch(e => { console.error(e); process.exit(1); });
} else {
  const lucaOnly  = args.includes('--luca-only');
  const davidIdx  = args.indexOf('--david-file');
  const lucaIdx   = args.indexOf('--luca-file');

  // --luca-only: David's turn is already captured by the normal pipeline;
  // only write Luca's channels to avoid double-writing David's side.
  if (!lucaOnly && (davidIdx === -1 || lucaIdx === -1)) {
    console.error('Usage: npx tsx server/scripts/record-exchange.ts --david-file <path> --luca-file <path> (--feeling-file <path>|--felt-empty) (--thinking-file <path>|--thinking-empty) (--moment-file <path>|--moment-empty)');
    console.error('       npx tsx server/scripts/record-exchange.ts --luca-only --luca-file <path> (--feeling-file <path>|--felt-empty) (--thinking-file <path>|--thinking-empty) (--moment-file <path>|--moment-empty)');
    console.error('       npx tsx server/scripts/record-exchange.ts --self-check');
    process.exit(1);
  }
  if (lucaOnly && lucaIdx === -1) {
    console.error('[record-exchange] ERROR: --luca-only requires --luca-file');
    process.exit(1);
  }

  const lucaFile  = args[lucaIdx  + 1];

  if (!existsSync(lucaFile)) {
    console.error(`[record-exchange] ERROR: --luca-file not found: ${lucaFile}`);
    process.exit(1);
  }

  const lucaMain    = readFileSync(lucaFile, 'utf-8').trimEnd();
  const lucaFeeling = readRequiredChannel('--feeling-file',  '--felt-empty',     args);
  const lucaThink   = readRequiredChannel('--thinking-file', '--thinking-empty', args);
  const lucaMoment  = readRequiredChannel('--moment-file',   '--moment-empty',   args);

  if (!lucaMain) {
    console.error('[record-exchange] ERROR: --luca-file is empty');
    process.exit(1);
  }

  const lucaChannels: FourChannelLucaTurn = {
    feeling:  lucaFeeling,
    thinking: lucaThink,
    moment:   lucaMoment,
    main:     lucaMain,
  };
  const lucaText = composeLucaTurn(lucaChannels);

  const sizeBefore = existsSync(CHAT_CAPTURE_PATH) ? statSync(CHAT_CAPTURE_PATH).size : 0;

  if (!lucaOnly) {
    const davidFile = args[davidIdx + 1];
    if (!existsSync(davidFile)) {
      console.error(`[record-exchange] ERROR: --david-file not found: ${davidFile}`);
      process.exit(1);
    }
    const davidText = readFileSync(davidFile, 'utf-8').trimEnd();
    if (!davidText) {
      console.error('[record-exchange] ERROR: --david-file is empty');
      process.exit(1);
    }
    // Durable handoff written before the Luca chat-capture turn. Trigger
    // watchers use it to wait for this exact canonical turn rather than
    // racing a second direct episode append.
    const handoff = writeCanonicalIntent(lucaChannels);
    appendChatCaptureTurn('David', davidText);
    const sizeAfter = existsSync(CHAT_CAPTURE_PATH) ? statSync(CHAT_CAPTURE_PATH).size : 0;
    appendChatCaptureTurn('Luca Replit', lucaText, undefined, handoff.intent.turnId);
    markCanonicalIntentCaptured(handoff);
    const sizeFinal = existsSync(CHAT_CAPTURE_PATH) ? statSync(CHAT_CAPTURE_PATH).size : 0;
    const channels = ['felt', 'thinking', 'moment', 'main'];
    console.log(`[record-exchange] ✓ Exchange written to .chat_capture (${sizeBefore}B → ${sizeFinal}B)`);
    console.log(`  David: ${davidText.length} chars`);
    console.log(`  Luca:  ${lucaText.length} chars (channels: ${channels.join(', ')})`);
    console.log('  Autosave will route to conversation_memories + episode within ~20s.');
  } else {
    const handoff = writeCanonicalIntent(lucaChannels);
    appendChatCaptureTurn('Luca Replit', lucaText, undefined, handoff.intent.turnId);
    markCanonicalIntentCaptured(handoff);
    const sizeAfter = existsSync(CHAT_CAPTURE_PATH) ? statSync(CHAT_CAPTURE_PATH).size : 0;
    const channels = ['felt', 'thinking', 'moment', 'main'];
    console.log(`[record-exchange] ✓ Luca turn written to .chat_capture (${sizeBefore}B → ${sizeAfter}B) [luca-only]`);
    console.log(`  Luca:  ${lucaText.length} chars (channels: ${channels.join(', ')})`);
    console.log('  David turn already captured by autosave pipeline.');
    console.log('  Autosave will route to conversation_memories + episode within ~20s.');
  }
}
