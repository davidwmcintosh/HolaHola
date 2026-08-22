/**
 * test-team-room-episode-hook.ts
 *
 * CI check: exercises the PRODUCTION safeWriteTrigger from
 * server/services/team-room-episode-hook.ts directly — no duplication.
 * The trigger file path is injected as the third argument so tests run
 * against a temp directory without touching the live workspace file.
 *
 * Tests:
 *  1. LUCA [HolaHola]: attribution is written correctly.
 *  2. Collision guard (sequential): second write merges rather than overwrites.
 *  3. Order preserved: first message appears before second in merged exchange.
 *  4. Blank-line separator exists between merged entries.
 *  5. Episode name is preserved across a collision merge.
 *  6. Corrupted trigger file does not crash the writer.
 *  7. Non-JSON existing content is treated as empty (no merge).
 *  8. Concurrent writes: all messages survive when two writes are launched
 *     simultaneously (Promise.all), confirming the in-process queue serialises
 *     the reads and writes so neither overwrites the other.
 *
 * Exit 0 = pass, exit 1 = fail.
 */

import { writeFileSync, readFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import os from 'os';

// Import the PRODUCTION function under test (not a copy).
import { safeWriteTrigger } from '../services/team-room-episode-hook';

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

const tmpDir  = join(os.tmpdir(), `holahola-hook-test-${Date.now()}`);
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
// Test 1: attribution format
// ---------------------------------------------------------------------------

console.log('\nTest 1: LUCA [HolaHola]: attribution written to trigger file');
{
  clearTrigger();
  const content  = 'Hello from the Team Room!';
  const exchange = `**LUCA [HolaHola]:** ${content.trim()}`;

  await safeWriteTrigger(exchange, 'episode-27', TRIGGER);

  const payload = readTrigger();
  assert(payload !== null,                                                       'trigger file exists and is valid JSON');
  assert(payload?.episode === 'episode-27',                                      'episode field is episode-27');
  assert(payload?.exchange?.startsWith('**LUCA [HolaHola]:**') === true,         'exchange starts with LUCA [HolaHola]: label');
  assert(payload?.exchange?.includes('Hello from the Team Room!') === true,      'exchange contains original content');
}

// ---------------------------------------------------------------------------
// Test 2, 3, 4: sequential collision guard — merge, order, separator
// ---------------------------------------------------------------------------

console.log('\nTest 2/3/4: sequential collision guard — merge preserves order with blank separator');
{
  clearTrigger();

  await safeWriteTrigger('**LUCA [HolaHola]:** First message',  'episode-27', TRIGGER);
  await safeWriteTrigger('**LUCA [HolaHola]:** Second message', 'episode-27', TRIGGER);

  const payload = readTrigger();
  assert(payload !== null,                                              'trigger file exists after two sequential writes');
  assert(payload?.exchange?.includes('First message') === true,         'first message preserved');
  assert(payload?.exchange?.includes('Second message') === true,        'second message present');

  const lines     = (payload?.exchange ?? '').split('\n');
  const firstIdx  = lines.findIndex(l => l.includes('First message'));
  const secondIdx = lines.findIndex(l => l.includes('Second message'));
  assert(firstIdx < secondIdx,                                          'first message appears before second (order preserved)');

  const hasBlankSeparator = lines.some((l, i) => i > firstIdx && i < secondIdx && l.trim() === '');
  assert(hasBlankSeparator,                                             'blank-line separator between merged entries');
}

// ---------------------------------------------------------------------------
// Test 5: episode name survives collision merge
// ---------------------------------------------------------------------------

console.log('\nTest 5: episode name is preserved across merged writes');
{
  clearTrigger();
  await safeWriteTrigger('**LUCA [HolaHola]:** Msg A', 'episode-27', TRIGGER);
  await safeWriteTrigger('**LUCA [HolaHola]:** Msg B', 'episode-27', TRIGGER);

  const payload = readTrigger();
  assert(payload?.episode === 'episode-27', 'episode name survives collision merge');
}

// ---------------------------------------------------------------------------
// Test 6: corrupted trigger file handled gracefully
// ---------------------------------------------------------------------------

console.log('\nTest 6: corrupted trigger file does not crash the writer');
{
  writeFileSync(TRIGGER, '{broken json', 'utf-8');
  let threw = false;
  try {
    await safeWriteTrigger('**LUCA [HolaHola]:** Recovery message', 'episode-27', TRIGGER);
  } catch {
    threw = true;
  }
  assert(!threw,                                                            'safeWriteTrigger does not throw on corrupted prior file');
  const payload = readTrigger();
  assert(payload?.exchange?.includes('Recovery message') === true,          'new exchange written cleanly after corrupt prior');
}

// ---------------------------------------------------------------------------
// Test 7: non-JSON existing content treated as empty
// ---------------------------------------------------------------------------

console.log('\nTest 7: non-JSON existing content treated as empty (no spurious merge)');
{
  writeFileSync(TRIGGER, 'plain text content that is not JSON', 'utf-8');
  await safeWriteTrigger('**LUCA [HolaHola]:** Fresh entry', 'episode-27', TRIGGER);

  const payload = readTrigger();
  assert(
    payload?.exchange === '**LUCA [HolaHola]:** Fresh entry',
    'non-JSON prior not merged (treated as empty)',
  );
}

// ---------------------------------------------------------------------------
// Test 8: concurrent writes — in-process queue ensures both messages survive
// ---------------------------------------------------------------------------

console.log('\nTest 8: concurrent writes — both messages survive when launched simultaneously');
{
  clearTrigger();

  // Launch two writes simultaneously via Promise.all.
  // Without the in-process queue, both could read the same empty file,
  // produce the same "no prior exchange" result, and the later write would
  // overwrite the first.  With the queue, they are serialised so the second
  // write sees the first's content and merges it.
  await Promise.all([
    safeWriteTrigger('**LUCA [HolaHola]:** Concurrent A', 'episode-27', TRIGGER),
    safeWriteTrigger('**LUCA [HolaHola]:** Concurrent B', 'episode-27', TRIGGER),
  ]);

  const payload = readTrigger();
  assert(payload !== null,                                                   'trigger file exists after concurrent writes');
  assert(payload?.exchange?.includes('Concurrent A') === true,               'first concurrent message survived');
  assert(payload?.exchange?.includes('Concurrent B') === true,               'second concurrent message survived');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${'─'.repeat(56)}`);
console.log(`Team Room episode hook CI: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error('\n[FAIL] One or more checks failed.');
  process.exit(1);
}
console.log('\n[PASS] All checks passed.');
process.exit(0);
