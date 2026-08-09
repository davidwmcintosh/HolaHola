/**
 * test-chat-episode-hook.ts
 *
 * CI check: exercises the PRODUCTION maybeAppendChatMessage from
 * server/services/chat-episode-hook.ts directly — no reimplementation.
 *
 * The trigger file path is injected as the third argument and the episode name
 * is injected as the fourth (_episodeNameForTest) so tests run against a temp
 * directory without touching the live workspace file or the DB.
 *
 * Tests:
 *  1. LUCA [HolaHola chat]: attribution is written by the hook itself.
 *  2. Daniela reply is included in the exchange when present.
 *  3. Empty lucaText produces no write (guard inside hook).
 *  4. Daniela-absent exchange omits the Daniela line.
 *  5. No rolling episode → no write (episodeName guard inside hook).
 *  6. Collision guard (sequential): second write merges rather than overwrites.
 *  7. Order preserved: first message appears before second in merged exchange.
 *  8. Blank-line separator exists between merged entries.
 *  9. Episode name is preserved across a collision merge.
 * 10. Concurrent writes: both messages survive when launched simultaneously.
 *
 * Exit 0 = pass, exit 1 = fail.
 */

import { existsSync, readFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import os from 'os';

// Import the PRODUCTION function under test (not a copy).
import { maybeAppendChatMessage } from '../services/chat-episode-hook';

// ---------------------------------------------------------------------------
// Minimal test harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Temp directory — all writes go here, never to the live workspace file
// ---------------------------------------------------------------------------

const tmpDir  = join(os.tmpdir(), `holahola-chat-hook-test-${Date.now()}`);
mkdirSync(tmpDir, { recursive: true });
const TRIGGER = join(tmpDir, '.episode_append');

function readTrigger(): { exchange: string; episode: string } | null {
  if (!existsSync(TRIGGER)) return null;
  try { return JSON.parse(readFileSync(TRIGGER, 'utf-8')); } catch { return null; }
}

function clearTrigger(): void {
  if (existsSync(TRIGGER)) unlinkSync(TRIGGER);
}

// ---------------------------------------------------------------------------
// Test 1: LUCA [HolaHola chat]: attribution — exercised through the hook itself
// ---------------------------------------------------------------------------

console.log('\nTest 1: LUCA [HolaHola chat]: attribution written by the production hook');
{
  clearTrigger();
  await maybeAppendChatMessage('¿Cómo estás?', '', TRIGGER, 'episode-27');

  const payload = readTrigger();
  assert(payload !== null,                                                          'trigger file exists and is valid JSON');
  assert(payload?.episode === 'episode-27',                                         'episode field matches injected name');
  assert(payload?.exchange?.startsWith('**LUCA [HolaHola chat]:**') === true,       'exchange starts with LUCA [HolaHola chat]: label');
  assert(payload?.exchange?.includes('¿Cómo estás?') === true,                     'exchange contains Luca text');
}

// ---------------------------------------------------------------------------
// Test 2: Daniela reply included when present
// ---------------------------------------------------------------------------

console.log('\nTest 2: Daniela reply included in exchange when present');
{
  clearTrigger();
  await maybeAppendChatMessage('¿Cómo estás?', 'Estoy bien, ¡gracias!', TRIGGER, 'episode-27');

  const payload = readTrigger();
  assert(payload?.exchange?.includes('**LUCA [HolaHola chat]:**') === true,         'Luca attribution present');
  assert(payload?.exchange?.includes('**Daniela:**') === true,                      'Daniela attribution present');
  assert(payload?.exchange?.includes('Estoy bien') === true,                        'Daniela reply text included');
}

// ---------------------------------------------------------------------------
// Test 3: Empty lucaText → hook skips write (guard inside hook)
// ---------------------------------------------------------------------------

console.log('\nTest 3: empty lucaText → hook skips the write entirely');
{
  clearTrigger();
  await maybeAppendChatMessage('   ', 'Daniela reply', TRIGGER, 'episode-27');
  assert(!existsSync(TRIGGER), 'trigger file NOT written for empty lucaText (hook guard fires)');
}

// ---------------------------------------------------------------------------
// Test 4: Daniela absent — exchange has no Daniela line
// ---------------------------------------------------------------------------

console.log('\nTest 4: Daniela-absent exchange omits the Daniela line');
{
  clearTrigger();
  await maybeAppendChatMessage('Hola', '', TRIGGER, 'episode-27');

  const payload = readTrigger();
  assert(payload?.exchange?.includes('**LUCA [HolaHola chat]:**') === true, 'Luca line present');
  assert(!payload?.exchange?.includes('**Daniela:**'),                       'Daniela line absent');
}

// ---------------------------------------------------------------------------
// Test 5: No rolling episode → hook skips write (episodeName guard inside hook)
// ---------------------------------------------------------------------------

console.log('\nTest 5: no rolling episode → hook skips write');
{
  clearTrigger();
  // Pass undefined as _episodeNameForTest to simulate "no rolling episode active"
  // without hitting the DB.  The hook receives an empty string and returns early.
  await maybeAppendChatMessage('Hola', '', TRIGGER, '');
  assert(!existsSync(TRIGGER), 'trigger file NOT written when no rolling episode is active');
}

// ---------------------------------------------------------------------------
// Test 6, 7, 8: sequential collision guard — merge, order, separator
// ---------------------------------------------------------------------------

console.log('\nTest 6/7/8: sequential collision guard — merge preserves order with blank separator');
{
  clearTrigger();

  await maybeAppendChatMessage('First message',  '', TRIGGER, 'episode-27');
  await maybeAppendChatMessage('Second message', '', TRIGGER, 'episode-27');

  const payload = readTrigger();
  assert(payload !== null,                                               'trigger file exists after two sequential writes');
  assert(payload?.exchange?.includes('First message') === true,          'first message preserved');
  assert(payload?.exchange?.includes('Second message') === true,         'second message present');

  const lines     = (payload?.exchange ?? '').split('\n');
  const firstIdx  = lines.findIndex(l => l.includes('First message'));
  const secondIdx = lines.findIndex(l => l.includes('Second message'));
  assert(firstIdx < secondIdx,                                           'first message appears before second (order preserved)');

  const hasBlankSeparator = lines.some((l, i) => i > firstIdx && i < secondIdx && l.trim() === '');
  assert(hasBlankSeparator,                                              'blank-line separator between merged entries');
}

// ---------------------------------------------------------------------------
// Test 9: episode name preserved across collision merge
// ---------------------------------------------------------------------------

console.log('\nTest 9: episode name preserved across merged writes');
{
  clearTrigger();
  await maybeAppendChatMessage('Msg A', '', TRIGGER, 'episode-27');
  await maybeAppendChatMessage('Msg B', '', TRIGGER, 'episode-27');

  const payload = readTrigger();
  assert(payload?.episode === 'episode-27', 'episode name survives collision merge');
}

// ---------------------------------------------------------------------------
// Test 10: concurrent writes — both messages survive
// ---------------------------------------------------------------------------

console.log('\nTest 10: concurrent writes — both messages survive when launched simultaneously');
{
  clearTrigger();

  await Promise.all([
    maybeAppendChatMessage('Concurrent A', '', TRIGGER, 'episode-27'),
    maybeAppendChatMessage('Concurrent B', '', TRIGGER, 'episode-27'),
  ]);

  const payload = readTrigger();
  assert(payload !== null,                                     'trigger file exists after concurrent writes');
  assert(payload?.exchange?.includes('Concurrent A') === true, 'first concurrent message survived');
  assert(payload?.exchange?.includes('Concurrent B') === true, 'second concurrent message survived');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n─────────────────────────────────────`);
console.log(`Chat Episode Hook CI: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\n✗ ${failed} test(s) failed — see above for details`);
  process.exit(1);
}
console.log(`\n✓ All tests passed`);
process.exit(0);
