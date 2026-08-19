/**
 * Capture a complete, labelled Replit-window paste without reconstructing
 * David or Luca text from memory.
 *
 * The raw source is retained before deterministic cleaning. Only explicit
 * David/Luca blocks are accepted; ambiguity fails before .chat_capture changes.
 */
import { createHash, randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import { appendChatCaptureTurn, CHAT_CAPTURE_PATH, WORKSPACE } from '../services/transcript-parser';
import { parseCanonicalFourChannelLucaTurn } from '../services/inner-life-capture';
import { parseRawWindowCapture } from '../services/raw-window-capture';
import { markCanonicalIntentCaptured, writeCanonicalIntent } from './record-exchange';

const args = process.argv.slice(2);
const windowIndex = args.indexOf('--window-file');
const sourceDirIndex = args.indexOf('--source-dir');
const capturePathIndex = args.indexOf('--capture-path');
const intentDirIndex = args.indexOf('--intent-dir');

function fail(message: string): never {
  console.error(`[record-window] ERROR: ${message}`);
  process.exit(1);
}

if (windowIndex === -1 || !args[windowIndex + 1]) {
  fail('Usage: npx tsx server/scripts/record-window.ts --window-file <path> [--source-dir <path>] [--capture-path <test-path>] [--intent-dir <test-path>]');
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
const intentDir = intentDirIndex === -1 ? undefined : args[intentDirIndex + 1];
if (!intentDir) fail('--intent-dir requires a path');

const sourceId = randomUUID();
const sourcePath = join(sourceDir, `${sourceId}.raw`);
mkdirSync(dirname(sourcePath), { recursive: true });
const sourceTempPath = `${sourcePath}.tmp-${process.pid}`;
writeFileSync(sourceTempPath, rawWindow, 'utf8');
renameSync(sourceTempPath, sourcePath);

const parsed = parseRawWindowCapture(rawWindow);
if (!parsed.ok) {
  fail(`${parsed.reason} Raw source retained for recovery: ${sourcePath}`);
}

const lucaPlans = parsed.turns
  .filter(turn => turn.speaker === 'Luca Replit')
  .map(turn => {
    const channels = parseCanonicalFourChannelLucaTurn(turn.text);
    if (!channels) fail('Internal error: a validated Luca envelope could not be parsed.');
    return { text: turn.text, channels };
  });

const sizeBefore = existsSync(capturePath) ? statSync(capturePath).size : 0;
let lucaIndex = 0;
for (const turn of parsed.turns) {
  if (turn.speaker === 'David') {
    appendChatCaptureTurn('David', turn.text, capturePath);
    continue;
  }

  const plan = lucaPlans[lucaIndex++];
  const handoff = writeCanonicalIntent(
    plan.channels,
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