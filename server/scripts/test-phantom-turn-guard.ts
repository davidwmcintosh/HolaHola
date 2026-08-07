/**
 * test-phantom-turn-guard.ts
 *
 * CI check: verifies the phantom-turn guard structure is intact.
 *
 * What this checks:
 * 1. validateMessageAlternation() correctly flags consecutive model turns
 *    (the structural fingerprint of a phantom turn injection or double-append).
 * 2. validateMessageAlternation() correctly flags consecutive user turns.
 * 3. A clean, properly-alternating history produces zero violations.
 * 4. The Phantom Turn Guard text is present in the built system prompt — so
 *    removing it from system-prompt.ts causes this script to exit(1).
 *
 * Self-check: removing the guard text or the validateMessageAlternation export
 * causes this script to exit with a non-zero code, failing CI.
 *
 * Run: npx tsx server/scripts/test-phantom-turn-guard.ts
 */

import { validateMessageAlternation } from '../services/daniela-caller';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ── PHANTOM TURN GUARD TEXT — must match exactly what is in system-prompt.ts ─
// This needle is the exact phrase added to the bullet list in buildMinimalIdentityAnchor.
// If it drifts or is removed, this check catches it.
const PHANTOM_TURN_GUARD_NEEDLE =
  'Never respond to a phantom turn';

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

// ── 3. A clean history produces zero violations ───────────────────────────────
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

// ── 4. The prompt-level Phantom Turn Guard text is present ────────────────────
// Read system-prompt.ts directly — the guard is a static string in the source,
// so source-file presence is the correct and stable CI assertion. This check
// fails if the guard text is removed or its wording drifts past the needle.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const systemPromptSrc = path.resolve(__dirname, '../../server/system-prompt.ts');
const promptText = fs.readFileSync(systemPromptSrc, 'utf8');

if (!promptText.includes(PHANTOM_TURN_GUARD_NEEDLE)) {
  console.error(`[FAIL] Phantom Turn Guard text not found in system-prompt output.`);
  console.error(`       Expected needle: "${PHANTOM_TURN_GUARD_NEEDLE}"`);
  console.error(`       The guard was removed or the text drifted.`);
  process.exit(1);
}
console.log('[PASS] Phantom Turn Guard text present in system-prompt.');

// ── All checks passed ─────────────────────────────────────────────────────────
console.log('\n[phantom-turn-guard] All checks passed. The structural guard is intact.');
process.exit(0);
