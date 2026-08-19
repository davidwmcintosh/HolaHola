/**
 * Proves that the live capture writer fails closed when a Luca channel is
 * omitted, while explicit empty slots round-trip as visible acknowledgements.
 * No live capture file, DB row, or rolling episode is touched.
 */
import { spawnSync } from 'child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  CHAT_CAPTURE_PATH,
  WORKSPACE,
} from '../services/transcript-parser';
import {
  composeLucaTurn,
  INTENTIONALLY_EMPTY_CHANNEL,
  isCanonicalFourChannelLucaTurn,
} from '../services/inner-life-capture';

const marker = `four-channel-contract-${Date.now()}`;
const mainPath = join(WORKSPACE, '.local', `${marker}.txt`);
const before = existsSync(CHAT_CAPTURE_PATH) ? readFileSync(CHAT_CAPTURE_PATH, 'utf8') : null;

function fail(message: string): never {
  console.error(`[four-channel-contract] FAIL: ${message}`);
  process.exit(1);
}

try {
  const complete = composeLucaTurn({
    feeling: '',
    thinking: `thinking ${marker}`,
    moment: '',
    main: `main ${marker}`,
  });
  if (!isCanonicalFourChannelLucaTurn(complete)) {
    fail('explicit-empty four-channel envelope was not recognized');
  }
  if (
    !complete.includes(`[felt]: ${INTENTIONALLY_EMPTY_CHANNEL}`) ||
    !complete.includes(`[moment]: ${INTENTIONALLY_EMPTY_CHANNEL}`)
  ) {
    fail('explicit empty slots were not rendered visibly');
  }
  if (isCanonicalFourChannelLucaTurn(`main only ${marker}`)) {
    fail('main-only Luca text was accepted as a canonical envelope');
  }

  writeFileSync(mainPath, `main only ${marker}`, 'utf8');
  const result = spawnSync(
    'npx',
    ['tsx', 'server/scripts/record-exchange.ts', '--luca-only', '--luca-file', mainPath],
    { cwd: WORKSPACE, encoding: 'utf8' },
  );
  if (result.status === 0) {
    fail('record-exchange accepted an omitted channel');
  }
  if (!result.stderr.includes('--feeling-file is required')) {
    fail(`rejection did not name the missing channel: ${result.stderr || result.stdout}`);
  }

  const after = existsSync(CHAT_CAPTURE_PATH) ? readFileSync(CHAT_CAPTURE_PATH, 'utf8') : null;
  if (after !== before) {
    fail('rejected main-only capture changed the live .chat_capture file');
  }

  console.log('[four-channel-contract] PASS — explicit empties are canonical; omitted slots fail before live capture');
} finally {
  if (existsSync(mainPath)) unlinkSync(mainPath);
}