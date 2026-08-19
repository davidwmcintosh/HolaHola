import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';

import { appendChatCaptureTurn, parseChatCaptureFromOffset } from '../services/transcript-parser';
import { alignUnlabelledRawWindow } from '../services/raw-window-attribution';
import { parseRawWindowCapture } from '../services/raw-window-capture';

const root = mkdtempSync(join(tmpdir(), 'raw-window-capture-'));
const rawPath = join(root, 'window.txt');
const capturePath = join(root, 'capture.txt');
const davidCapturePath = join(root, 'david-capture.txt');
const sourceDir = join(root, 'sources');
const intentDir = join(root, 'intents');
const alignedCapturePath = join(root, 'aligned-capture.txt');
const alignedSourceDir = join(root, 'aligned-sources');
const alignedIntentDir = join(root, 'aligned-intents');
const emptyDavidCapturePath = join(root, 'empty-david-capture.txt');
const emptyCapturePath = join(root, 'empty-capture.txt');
const emptySourceDir = join(root, 'empty-sources');
const emptyIntentDir = join(root, 'empty-intents');
const marker = `raw-window-${Date.now()}`;

const raw = [
  '**David:** David exact message ' + marker,
  '',
  '4 actions',
  '**LUCA [Replit]:** [felt]: Felt exact ' + marker,
  '',
  '[thinking]: Thinking exact ' + marker,
  '',
  '[moment]: Moment exact ' + marker,
  '',
  'Wrote a file',
  'Luca main exact ' + marker,
  '',
  'Worked for 9 minutes',
].join('\n');

try {
  const direct = parseRawWindowCapture(raw);
  if (!direct.ok) throw new Error(`Parser rejected valid raw window: ${direct.reason}`);
  if (direct.turns.length !== 2) throw new Error(`Expected two turns, got ${direct.turns.length}`);
  if (direct.turns[0].text !== `David exact message ${marker}`) throw new Error('David text changed during cleaning');
  if (!direct.turns[1].text.includes(`Luca main exact ${marker}`)) throw new Error('Luca main missing after cleaning');
  if (direct.turns[1].text.includes('Wrote a file')) throw new Error('Known UI chrome leaked into Luca dialogue');

  const unlabelled = [
    '4 minutes ago',
    'David exact message ' + marker,
    '',
    'Clarifying user confusion',
    'Clarifying user confusion',
    '4 actions',
    'Luca exact response ' + marker,
    '',
    '6 actions',
    'David second exact message ' + marker,
  ].join('\n');
  const aligned = alignUnlabelledRawWindow(unlabelled, [
    { text: `David exact message ${marker}` },
    { text: `David second exact message ${marker}` },
  ]);
  if (!aligned.ok) throw new Error(`Alignment rejected valid unlabelled window: ${aligned.reason}`);
  if (aligned.turns.length !== 3) throw new Error(`Expected Luca/David/Luca alignment, got ${aligned.turns.length} turns`);
  if (aligned.turns[0].speaker !== 'David' || aligned.turns[0].text !== `David exact message ${marker}`) {
    throw new Error('First attested David anchor was not preserved');
  }
  if (aligned.turns[1].speaker !== 'Luca Replit' || aligned.turns[1].text !== `Luca exact response ${marker}`) {
    throw new Error('Unlabelled remainder was not attributed to Luca');
  }
  if (aligned.turns[2].speaker !== 'David' || aligned.turns[2].text !== `David second exact message ${marker}`) {
    throw new Error('Second attested David anchor was not preserved');
  }
  const missing = alignUnlabelledRawWindow(unlabelled, [{ text: 'David is not in this window' }]);
  if (missing.ok || !missing.reason.includes('not found verbatim')) {
    throw new Error('Missing David anchor did not fail closed');
  }
  const ambiguous = alignUnlabelledRawWindow(
    `David exact message ${marker}\nLuca text\nDavid exact message ${marker}`,
    [{ text: `David exact message ${marker}` }],
  );
  if (ambiguous.ok || !ambiguous.reason.includes('ambiguous')) {
    throw new Error('Ambiguous overlapping David anchor did not fail closed');
  }

  const alignedRaw = [
    '4 minutes ago',
    `David exact message ${marker}`,
    'Clarifying user confusion',
    '[felt]: Felt from aligned window',
    '[thinking]: Thinking from aligned window',
    '[moment]: Moment from aligned window',
    `Luca main from aligned window ${marker}`,
    '6 actions',
    `David second exact message ${marker}`,
  ].join('\n');
  appendChatCaptureTurn('David', `David exact message ${marker}`, davidCapturePath);
  appendChatCaptureTurn('David', `David second exact message ${marker}`, davidCapturePath);
  writeFileSync(rawPath, alignedRaw, 'utf8');
  const alignedResult = spawnSync(
    'npx',
    [
      'tsx',
      'server/scripts/record-window.ts',
      '--window-file',
      rawPath,
      '--source-dir',
      alignedSourceDir,
      '--capture-path',
      alignedCapturePath,
      '--david-capture-path',
      davidCapturePath,
      '--intent-dir',
      alignedIntentDir,
    ],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  if (alignedResult.status !== 0) {
    throw new Error(`Unlabelled raw-window CLI failed: ${alignedResult.stderr || alignedResult.stdout}`);
  }
  const alignedCaptured = parseChatCaptureFromOffset(alignedCapturePath, 0);
  if (alignedCaptured.turns.length !== 3) {
    throw new Error(`Expected three turns from aligned CLI capture, got ${alignedCaptured.turns.length}`);
  }
  if (alignedCaptured.turns[0].speaker !== 'DAVID' || alignedCaptured.turns[0].text !== `David exact message ${marker}`) {
    throw new Error('CLI did not emit the first attested David turn');
  }
  if (alignedCaptured.turns[1].speaker !== 'LUCA' || !alignedCaptured.turns[1].text.includes(`Luca main from aligned window ${marker}`)) {
    throw new Error('CLI did not emit the aligned Luca region');
  }
  if (alignedCaptured.turns[2].speaker !== 'DAVID' || alignedCaptured.turns[2].text !== `David second exact message ${marker}`) {
    throw new Error('CLI did not emit the second attested David turn');
  }

  const noDavidAnchorsRaw = [
    '4 minutes ago',
    `No captured David turn in this window ${marker}`,
    'Luca response from a session without auto-capture',
  ].join('\n');
  const existingCapture = `existing capture must remain unchanged ${marker}\n`;
  writeFileSync(rawPath, noDavidAnchorsRaw, 'utf8');
  writeFileSync(emptyDavidCapturePath, '', 'utf8');
  writeFileSync(emptyCapturePath, existingCapture, 'utf8');
  const noDavidAnchorsResult = spawnSync(
    'npx',
    [
      'tsx',
      'server/scripts/record-window.ts',
      '--window-file',
      rawPath,
      '--source-dir',
      emptySourceDir,
      '--capture-path',
      emptyCapturePath,
      '--david-capture-path',
      emptyDavidCapturePath,
      '--intent-dir',
      emptyIntentDir,
    ],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  if (noDavidAnchorsResult.status === 0) {
    throw new Error('Unlabelled raw-window CLI accepted a window with no attested David turns');
  }
  const emptySourceFiles = readdirSync(emptySourceDir);
  if (emptySourceFiles.length !== 1) {
    throw new Error('Raw recovery source was not retained after alignment failed with no David anchors');
  }
  if (readFileSync(join(emptySourceDir, emptySourceFiles[0]), 'utf8') !== noDavidAnchorsRaw) {
    throw new Error('Raw recovery source changed after alignment failed with no David anchors');
  }
  if (readFileSync(emptyCapturePath, 'utf8') !== existingCapture) {
    throw new Error('Capture path changed after alignment failed with no David anchors');
  }

  writeFileSync(rawPath, raw, 'utf8');
  const result = spawnSync(
    'npx',
    ['tsx', 'server/scripts/record-window.ts', '--window-file', rawPath, '--source-dir', sourceDir, '--capture-path', capturePath, '--intent-dir', intentDir],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error(`Raw-window CLI failed: ${result.stderr || result.stdout}`);

  const captured = parseChatCaptureFromOffset(capturePath, 0);
  if (captured.turns.length !== 2) throw new Error(`Expected two captured turns, got ${captured.turns.length}`);
  if (captured.turns[0].text !== `David exact message ${marker}`) throw new Error('Captured David text is not exact');
  if (!captured.turns[1].text.includes(`Luca main exact ${marker}`)) throw new Error('Captured Luca main is not exact');
  const sourceFiles = readdirSync(sourceDir);
  if (sourceFiles.length !== 1) throw new Error('Raw recovery source was not retained');
  if (readFileSync(join(sourceDir, sourceFiles[0]), 'utf8') !== raw) throw new Error('Raw recovery source changed');

  const legacyAmbiguous = parseRawWindowCapture(`unlabelled ${marker}`);
  if (legacyAmbiguous.ok) throw new Error('Unlabelled raw window was accepted by the labelled parser');
  console.log('[raw-window-capture] PASS — labelled and unlabelled attribution preserve attested text; UI chrome is removed; alignment failure cases fail closed.');
} finally {
  rmSync(root, { recursive: true, force: true });
}