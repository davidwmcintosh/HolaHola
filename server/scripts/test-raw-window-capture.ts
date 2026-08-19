import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';

import { parseChatCaptureFromOffset } from '../services/transcript-parser';
import { parseRawWindowCapture } from '../services/raw-window-capture';

const root = mkdtempSync(join(tmpdir(), 'raw-window-capture-'));
const rawPath = join(root, 'window.txt');
const capturePath = join(root, 'capture.txt');
const sourceDir = join(root, 'sources');
const intentDir = join(root, 'intents');
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

  const ambiguous = parseRawWindowCapture(`unlabelled ${marker}`);
  if (ambiguous.ok) throw new Error('Unlabelled raw window was accepted');
  console.log('[raw-window-capture] PASS — exact labelled dialogue survives cleaning; UI chrome is removed; ambiguous input fails closed.');
} finally {
  rmSync(root, { recursive: true, force: true });
}