/**
 * Capture a complete, labelled Replit-window paste without reconstructing
 * David or Luca text from memory.
 *
 * Two parse paths:
 *
 * 1. Labelled path (parseRawWindowCapture): window contains explicit David/Luca
 *    speaker headers. Luca text must be a canonical four-channel envelope.
 *    Handoffs are written via writeCanonicalIntent as usual.
 *
 * 2. Unlabelled alignment path (alignUnlabelledRawWindow): window has no speaker
 *    headers. David regions are derived from attested .chat_capture turns; the
 *    remainder is attributed to Luca as plain prose. No four-channel requirement
 *    is imposed on aligned Luca regions — the raw window source is the verbatim
 *    record; the channel envelope is a production-mode convenience, not a guard.
 *
 * Both paths retain the raw source before any validation.
 */
import { createHash, randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import {
  appendChatCaptureTurn,
  CHAT_CAPTURE_PATH,
  parseChatCaptureFromOffset,
  WORKSPACE,
} from '../services/transcript-parser';
import { parseCanonicalFourChannelLucaTurn } from '../services/inner-life-capture';
import { alignUnlabelledRawWindow } from '../services/raw-window-attribution';
import { parseRawWindowCapture } from '../services/raw-window-capture';
import { markCanonicalIntentCaptured, writeCanonicalIntent } from './record-exchange';

const args = process.argv.slice(2);
const windowIndex = args.indexOf('--window-file');
const sourceDirIndex = args.indexOf('--source-dir');
const capturePathIndex = args.indexOf('--capture-path');
const davidCapturePathIndex = args.indexOf('--david-capture-path');
const intentDirIndex = args.indexOf('--intent-dir');

function fail(message: string): never {
  console.error(`[record-window] ERROR: ${message}`);
  process.exit(1);
}

if (windowIndex === -1 || !args[windowIndex + 1]) {
  fail('Usage: npx tsx server/scripts/record-window.ts --window-file <path> [--source-dir <path>] [--capture-path <test-path>] [--david-capture-path <test-path>] [--intent-dir <test-path>]');
}

const windowPath = args[windowIndex + 1];
if (!existsSync(windowPath)) fail(`window file not found: ${windowPath}`);
const rawWindow = readFileSync(windowPath, 'utf8');
if (!rawWindow.trim()) fail('window file is empty');

const sourceDir = sourceDirIndex === -1
  ? join(WORKSPACE, '.local', 'raw-window-captures')
  : args[sourceDirIndex + 1];
if (!sourceDir) fail('--source-dir requires a path');

const capturePath = capturePathIndex === -1 ? CHAT_CAPTURE_PATH : args[capturePathIndex + 1];
if (!capturePath) fail('--capture-path requires a path');
const davidCapturePath = davidCapturePathIndex === -1
  ? capturePath
  : args[davidCapturePathIndex + 1];
if (!davidCapturePath) fail('--david-capture-path requires a path');
const intentDir = intentDirIndex === -1 ? undefined : args[intentDirIndex + 1];
if (!intentDir) fail('--intent-dir requires a path');

const sourceId = randomUUID();
const sourcePath = join(sourceDir, `${sourceId}.raw`);
mkdirSync(dirname(sourcePath), { recursive: true });
const sourceTempPath = `${sourcePath}.tmp-${process.pid}`;
writeFileSync(sourceTempPath, rawWindow, 'utf8');
renameSync(sourceTempPath, sourcePath);

// -- Parse path selection ------------------------------------------------------
// Try the labelled parser first. If it fails AND the window has no speaker
// headers, fall back to the alignment path (David anchors from .chat_capture).
// Track which path was used so the Luca emit loop knows whether to demand a
// four-channel envelope.
let parsed = parseRawWindowCapture(rawWindow);
let usedAlignmentPath = false;
if (!parsed.ok && !/^\s*(?:\*\*)?(?:David|Luca(?:\s+\[Replit\])?):/im.test(rawWindow)) {
  const captureTurns = parseChatCaptureFromOffset(davidCapturePath, 0).turns;
  const lastLucaTurnIndex = captureTurns.reduce(
    (lastIndex, turn, index) => turn.speaker === 'LUCA' ? index : lastIndex,
    -1,
  );
  const attestedDavidTurns = captureTurns
    .slice(lastLucaTurnIndex + 1)
    .filter(turn => turn.speaker === 'DAVID')
    .map(turn => ({ text: turn.text }));
  parsed = alignUnlabelledRawWindow(rawWindow, attestedDavidTurns);
  usedAlignmentPath = parsed.ok;
}
if (!parsed.ok) {
  fail(`${parsed.reason} Raw source retained for recovery: ${sourcePath}`);
}

// -- Luca envelope plans (labelled path only) ----------------------------------
// Aligned Luca regions are raw prose from the window paste; they carry no
// four-channel structure. Only the labelled path validates and parses them.
const lucaPlans: Array<{ text: string; channels: ReturnType<typeof parseCanonicalFourChannelLucaTurn> }> = [];
if (!usedAlignmentPath) {
  for (const turn of parsed.turns) {
    if (turn.speaker !== 'Luca Replit') continue;
    const channels = parseCanonicalFourChannelLucaTurn(turn.text);
    if (!channels) fail('Internal error: a validated Luca envelope could not be parsed.');
    lucaPlans.push({ text: turn.text, channels });
  }
}

const sizeBefore = existsSync(capturePath) ? statSync(capturePath).size : 0;
let lucaIndex = 0;
for (const turn of parsed.turns) {
  if (turn.speaker === 'David') {
    appendChatCaptureTurn('David', turn.text, capturePath);
    continue;
  }

  if (usedAlignmentPath) {
    // Aligned path: Luca prose written directly — no four-channel requirement.
    appendChatCaptureTurn('Luca Replit', turn.text, capturePath);
    continue;
  }

  const plan = lucaPlans[lucaIndex++];
  const handoff = writeCanonicalIntent(
    plan.channels!,
    intentDir ? join(intentDir, `${randomUUID()}.json`) : undefined,
  );
  appendChatCaptureTurn('Luca Replit', plan.text, capturePath, handoff.intent.turnId);
  markCanonicalIntentCaptured(handoff);
}

const sizeAfter = existsSync(capturePath) ? statSync(capturePath).size : 0;
const sourceSha = createHash('sha256').update(rawWindow, 'utf8').digest('hex');
console.log(`[record-window] ✓ Raw window cleaned into ${parsed.turns.length} dialogue turn(s) (${sizeBefore}B → ${sizeAfter}B)`);
console.log(`  Raw source retained: ${sourcePath}`);
console.log(`  Source SHA-256: ${sourceSha}`);
console.log('  Autosave will route to conversation_memories + the rolling episode within ~20s.');