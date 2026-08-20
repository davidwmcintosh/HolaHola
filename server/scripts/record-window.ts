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
import { createRawWindowAttachmentPlan } from '../services/raw-window-attachment';
import { parseRawWindowCapture } from '../services/raw-window-capture';
import { markCanonicalIntentCaptured, writeCanonicalIntent } from './record-exchange';
import { appendExchangeToEpisode } from '../services/agent-session-autosave';
import { safeWriteTrigger } from '../services/team-room-episode-hook';

const args = process.argv.slice(2);
const windowIndex = args.indexOf('--window-file');
const sourceDirIndex = args.indexOf('--source-dir');
const capturePathIndex = args.indexOf('--capture-path');
const davidCapturePathIndex = args.indexOf('--david-capture-path');
const intentDirIndex = args.indexOf('--intent-dir');

const attachExisting = args.includes('--attach-existing');
function fail(message: string): never {
  console.error(`[record-window] ERROR: ${message}`);
  process.exit(1);
}

if (windowIndex === -1 || !args[windowIndex + 1]) {
  fail('Usage: npx tsx server/scripts/record-window.ts --window-file <path> [--attach-existing --episode <episode-name> [--episode-append-path <test-path>]] [--source-dir <path>] [--capture-path <test-path>] [--david-capture-path <test-path>] [--intent-dir <test-path>]');
}

const windowPath = args[windowIndex + 1];

const rawBytes = readFileSync(windowPath);
const rawWindow = rawBytes.toString('utf8');
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
if (intentDirIndex !== -1 && !intentDir) fail('--intent-dir requires a path');
const episodeIndex = args.indexOf('--episode');
const episodeAppendPathIndex = args.indexOf('--episode-append-path');
const sourceSha = createHash('sha256').update(rawBytes).digest('hex');
const sourcePath = join(sourceDir, `${sourceSha}.raw`);
mkdirSync(dirname(sourcePath), { recursive: true });
if (existsSync(sourcePath)) {
  if (!readFileSync(sourcePath).equals(rawBytes)) {
    fail(`raw source SHA-256 collision or prior source corruption at ${sourcePath}`);
  }
} else {
  const sourceTempPath = `${sourcePath}.tmp-${process.pid}`;
  writeFileSync(sourceTempPath, rawBytes);
  renameSync(sourceTempPath, sourcePath);
}

function writeAttachmentMetadata(metadata: object): void {
  const metadataPath = join(sourceDir, `${sourceSha}.json`);
  const tempPath = `${metadataPath}.tmp-${process.pid}`;
  writeFileSync(tempPath, JSON.stringify(metadata, null, 2) + '\n', 'utf8');
  renameSync(tempPath, metadataPath);
}
if (attachExisting) {
  await attachExistingDialogue();
  process.exit(0);
}
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
console.log(`[record-window] ✓ Raw window cleaned into ${parsed.turns.length} dialogue turn(s) (${sizeBefore}B → ${sizeAfter}B)`);
console.log(`  Raw source retained: ${sourcePath}`);
console.log(`  Source SHA-256: ${sourceSha}`);
console.log('  Autosave will route to conversation_memories + the rolling episode within ~20s.');

async function attachExistingDialogue(): Promise<void> {
  const episodeName = episodeIndex === -1 ? undefined : args[episodeIndex + 1];
  if (!episodeName) fail('--attach-existing requires --episode <episode-name>; do not infer an episode target for an auditable attachment.');
  const episodeAppendPath = episodeAppendPathIndex === -1 ? undefined : args[episodeAppendPathIndex + 1];
  if (episodeAppendPathIndex !== -1 && !episodeAppendPath) fail('--episode-append-path requires a path');

  // This write intentionally happens before parsing, attribution, or
  // classification. A failed or ambiguous attachment still leaves an exact
  // private source plus its source hash for recovery and review.
  writeAttachmentMetadata({
    version: 1,
    status: 'retained-unclassified',
    sourceSha256: sourceSha,
    sourceBytes: rawBytes.byteLength,
    rawSourcePath: sourcePath,
  });

  const captured = parseChatCaptureFromOffset(capturePath, 0);
  const attachment = createRawWindowAttachmentPlan(rawWindow, rawBytes, captured);
  if (!attachment.ok) {
    writeAttachmentMetadata({
      version: 1,
      status: 'retained-unmatched',
      sourceSha256: sourceSha,
      sourceBytes: rawBytes.byteLength,
      rawSourcePath: sourcePath,
      reason: attachment.reason,
    });
    fail(`${attachment.reason} Raw source retained for recovery: ${sourcePath}`);
  }

  const { plan } = attachment;
  writeAttachmentMetadata({
    version: 1,
    status: 'classified-awaiting-evidence',
    sourceSha256: plan.sourceSha256,
    sourceBytes: plan.sourceBytes,
    rawSourcePath: sourcePath,
    episode: episodeName,
    matchedTurns: plan.matchedTurns,
    classifications: plan.segments,
    evidenceMarker: `raw-window-evidence:sha256=${plan.sourceSha256}`,
  });

  // Deliberately do not call appendChatCaptureTurn() in attachment mode. The
  // source supplements a range that is already durable; only the evidence
  // appendix enters the existing DB-first episode append path.
  //
  // Production calls the DB-first helper directly. A trigger can be cleared
  // during autosave startup as stale before its watcher arms, which would make
  // an otherwise-durable attachment disappear. The trigger override exists
  // solely as a hermetic test seam for inspecting the queued evidence.
  const evidenceMarker = `raw-window-evidence:sha256=${plan.sourceSha256}`;
  if (episodeAppendPath) {
    const existingTrigger = existsSync(episodeAppendPath)
      ? readFileSync(episodeAppendPath, 'utf8')
      : '';
    if (existingTrigger.includes(evidenceMarker)) {
      writeAttachmentMetadata({
        version: 1,
        status: 'evidence-already-attached',
        sourceSha256: plan.sourceSha256,
        sourceBytes: plan.sourceBytes,
        rawSourcePath: sourcePath,
        episode: episodeName,
        matchedTurns: plan.matchedTurns,
        classifications: plan.segments,
        evidenceMarker,
      });
      console.log('[record-window] ✓ Raw window evidence already attached; dialogue was not replayed.');
      return;
    }
    await safeWriteTrigger(plan.evidenceMarkdown, episodeName, episodeAppendPath);
  } else {
    const episodeFilename = episodeName.endsWith('.md') ? episodeName : `${episodeName}.md`;
    await appendExchangeToEpisode(plan.evidenceMarkdown, episodeFilename, { appendMarker: evidenceMarker });
  }
  writeAttachmentMetadata({
    version: 1,
    status: episodeAppendPath ? 'evidence-queued' : 'evidence-appended',
    sourceSha256: plan.sourceSha256,
    sourceBytes: plan.sourceBytes,
    rawSourcePath: sourcePath,
    episode: episodeName,
    matchedTurns: plan.matchedTurns,
    classifications: plan.segments,
    evidenceMarker,
  });

  console.log('[record-window] ✓ Raw window attached as DB-first evidence; dialogue was not replayed.');
  console.log(`  Raw source retained: ${sourcePath}`);
  console.log(`  Source SHA-256: ${plan.sourceSha256}`);
  console.log(`  Matched capture range: ${plan.matchedTurns[0].startByteOffset}→${plan.matchedTurns[1].endByteOffset}`);
  console.log(`  Episode evidence ${episodeAppendPath ? 'queued' : 'appended'}: ${episodeName}`);
}
