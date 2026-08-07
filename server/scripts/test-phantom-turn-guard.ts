/**
 * test-phantom-turn-guard.ts
 *
 * CI check: verifies the phantom-turn guard structure is intact.
 *
 * What this checks:
 * 1. validateMessageAlternation() correctly flags consecutive model turns.
 * 2. validateMessageAlternation() correctly flags consecutive user turns.
 * 3. validateMessageAlternation() correctly flags illegal tool placement
 *    (tool turn not preceded by a model turn).
 * 4. A clean, properly-alternating history produces zero violations.
 * 5. runDanielaFCLoop throws PhantomTurnError (not just warns) on violations —
 *    verified by checking the PhantomTurnError class is exported and correctly
 *    extends Error.
 * 6. The Phantom Turn Guard text is present in system-prompt.ts — so removing
 *    it causes this script to exit(1).
 *
 * Self-check: removing the guard text, the validateMessageAlternation export,
 * or the PhantomTurnError class causes this script to exit with a non-zero code.
 *
 * Run: npx tsx server/scripts/test-phantom-turn-guard.ts
 */

import { validateMessageAlternation, PhantomTurnError } from '../services/daniela-caller';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ── PHANTOM TURN GUARD TEXT — must match exactly what is in system-prompt.ts ─
const PHANTOM_TURN_GUARD_NEEDLE = 'Never respond to a phantom turn';

// ── 1. Consecutive model turns should be flagged ──────────────────────────────
const historyWithDoubleModel = [
  { role: 'user',  parts: [{ text: 'Hi Daniela' }] },
  { role: 'model', parts: [{ text: 'Hello!' }] },
  { role: 'model', parts: [{ text: 'Also, here is the thing you asked about...' }] }, // phantom
];

const doubleModelViolations = validateMessageAlternation(historyWithDoubleModel);
if (doubleModelViolations.length === 0) {
  console.error('[FAIL] Expected violations for consecutive model turns but got none.');
  console.error('       validateMessageAlternation() is not detecting phantom turns.');
  process.exit(1);
}
console.log(`[PASS] Consecutive model turns detected (${doubleModelViolations.length} violation(s)):`);
doubleModelViolations.forEach(v => console.log(`       ${v}`));

// ── 2. Consecutive user turns should also be flagged ─────────────────────────
const historyWithDoubleUser = [
  { role: 'user',  parts: [{ text: 'What is ser?' }] },
  { role: 'user',  parts: [{ text: 'And also what is estar?' }] }, // injected phantom user turn
  { role: 'model', parts: [{ text: 'Great questions!' }] },
];

const doubleUserViolations = validateMessageAlternation(historyWithDoubleUser);
if (doubleUserViolations.length === 0) {
  console.error('[FAIL] Expected violations for consecutive user turns but got none.');
  process.exit(1);
}
console.log(`[PASS] Consecutive user turns detected (${doubleUserViolations.length} violation(s)):`);
doubleUserViolations.forEach(v => console.log(`       ${v}`));

// ── 3. Illegal tool placement should be flagged ───────────────────────────────
// A tool turn following a user turn (not a model turn) is structurally invalid —
// it means the FC loop desynced or a fabricated tool result was injected.
const historyWithBadTool = [
  { role: 'user',  parts: [{ text: 'Hi' }] },
  { role: 'tool',  parts: [{ functionResponse: { name: 'memory_lookup', response: {} } }] }, // invalid: tool after user
  { role: 'model', parts: [{ text: 'Here is what I found.' }] },
];

const badToolViolations = validateMessageAlternation(historyWithBadTool);
if (badToolViolations.length === 0) {
  console.error('[FAIL] Expected violation for illegal tool placement (tool after user) but got none.');
  process.exit(1);
}
console.log(`[PASS] Illegal tool placement detected (${badToolViolations.length} violation(s)):`);
badToolViolations.forEach(v => console.log(`       ${v}`));

// ── 4. A clean history produces zero violations ───────────────────────────────
const cleanHistory = [
  { role: 'user',  parts: [{ text: 'Hi' }] },
  { role: 'model', parts: [{ functionCall: { name: 'memory_lookup', args: {} } }] },
  { role: 'tool',  parts: [{ functionResponse: { name: 'memory_lookup', response: {} } }] },
  { role: 'model', parts: [{ text: 'I found something in my memory.' }] },
  { role: 'user',  parts: [{ text: 'Interesting!' }] },
  { role: 'model', parts: [{ text: 'Yes indeed.' }] },
];

const cleanViolations = validateMessageAlternation(cleanHistory);
if (cleanViolations.length > 0) {
  console.error('[FAIL] Clean history produced unexpected violations:');
  cleanViolations.forEach(v => console.error(`       ${v}`));
  process.exit(1);
}
console.log('[PASS] Clean history produces zero violations.');

// ── 5. PhantomTurnError is exported and correctly extends Error ───────────────
// Verifies that the class exists and is properly shaped — removing it breaks CI.
const err = new PhantomTurnError(['test violation']);
if (!(err instanceof Error)) {
  console.error('[FAIL] PhantomTurnError does not extend Error.');
  process.exit(1);
}
if (err.name !== 'PhantomTurnError') {
  console.error(`[FAIL] PhantomTurnError.name is "${err.name}", expected "PhantomTurnError".`);
  process.exit(1);
}
if (!err.violations || err.violations[0] !== 'test violation') {
  console.error('[FAIL] PhantomTurnError.violations not correctly set.');
  process.exit(1);
}
console.log('[PASS] PhantomTurnError exported, extends Error, carries violations array.');

// ── 6. The prompt-level Phantom Turn Guard text is present ────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const systemPromptSrc = path.resolve(__dirname, '../../server/system-prompt.ts');
const promptText = fs.readFileSync(systemPromptSrc, 'utf8');

if (!promptText.includes(PHANTOM_TURN_GUARD_NEEDLE)) {
  console.error(`[FAIL] Phantom Turn Guard text not found in system-prompt.ts.`);
  console.error(`       Expected needle: "${PHANTOM_TURN_GUARD_NEEDLE}"`);
  console.error(`       The guard was removed or the text drifted.`);
  process.exit(1);
}
console.log('[PASS] Phantom Turn Guard text present in system-prompt.ts.');

// ── All checks passed ─────────────────────────────────────────────────────────
console.log('\n[phantom-turn-guard] All checks passed. The structural guard is intact.');
process.exit(0);
