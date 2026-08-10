export {};

/**
 * test-nudge-delegation.ts
 *
 * CI guard for the nudge-delegation path in luca-responder.ts.
 *
 * Tests:
 *   1. Detection table — every advertised phrase triggers hasDelegationIntent
 *   2. Non-delegation phrases — no false positives
 *   3. Extraction table — each phrase returns the expected task text
 *   4. Source-order proof — delegation block appears before the Anthropic call
 *      in respondToNudge, so a Claude failure cannot suppress delegation
 *
 * The helpers are imported from the real source (no duplication / no drift risk).
 *
 * Run:
 *   npx tsx server/scripts/test-nudge-delegation.ts
 *
 * Exit 0 = all assertions passed.
 * Exit 1 = at least one failure.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { hasDelegationIntent, extractDelegationTask } from '../services/luca-responder';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Test runner ──────────────────────────────────────────────────────────────

let _passed = 0;
let _failed = 0;

function assert(label: string, actual: unknown, expected: unknown) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`);
    _passed++;
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`      expected: ${JSON.stringify(expected)}`);
    console.error(`      actual:   ${JSON.stringify(actual)}`);
    _failed++;
  }
}

function assertDetected(phrase: string) {
  assert(`detected: "${phrase.substring(0, 70)}"`, hasDelegationIntent(phrase), true);
}

function assertNotDetected(phrase: string) {
  assert(`NOT detected: "${phrase.substring(0, 70)}"`, hasDelegationIntent(phrase), false);
}

function assertExtracted(input: string, expected: string) {
  assert(
    `extract("${input.substring(0, 60)}")`,
    extractDelegationTask(input),
    expected,
  );
}

// ── 1. Detection table ───────────────────────────────────────────────────────
console.log('\n[1] Detection — advertised phrases must be detected');
assertDetected('@luca ask Alden to review the quiz overlay guard');
assertDetected('@luca have Alden look at this');
assertDetected('@luca get Alden to check the delegation loop');
assertDetected('@luca tell Alden to run a security audit');
assertDetected('@luca delegate to Alden: review the auth flow');
assertDetected('@luca delegate this to Alden');
assertDetected('@luca loop in Alden on the absence call issue');
assertDetected('@luca hand this to Alden — check the rolling episode sync');
assertDetected('luca, ask Alden to look at the GL dispatcher');
assertDetected('Ask Alden to review episode 27');            // case-insensitive
assertDetected('DELEGATE TO ALDEN: check the merge guard');

// ── 2. Non-delegation phrases — no false positives ───────────────────────────
console.log('\n[2] Non-delegation — these must NOT be detected');
assertNotDetected('@luca what is the ACTFL level in the current session?');
assertNotDetected('@luca how does the Guardian work?');
assertNotDetected('Alden reviewed the code');                // no delegation verb
assertNotDetected('@luca can you check the logs?');
assertNotDetected('we should ask about Alden later');        // "ask about", not "ask Alden"

// ── 3. Extraction table ──────────────────────────────────────────────────────
console.log('\n[3] Extraction — each phrase returns the core task');
assertExtracted(
  '@luca ask Alden to review the quiz overlay guard',
  'review the quiz overlay guard',
);
assertExtracted(
  '@luca have Alden look at the GL dispatcher',
  'look at the GL dispatcher',
);
assertExtracted(
  '@luca get Alden to check the delegation loop',
  'check the delegation loop',
);
assertExtracted(
  '@luca tell Alden to run a full security audit',
  'run a full security audit',
);
assertExtracted(
  '@luca delegate to Alden: review the auth flow',
  'review the auth flow',
);
assertExtracted(
  '@luca delegate to Alden review the auth flow',
  'review the auth flow',
);
assertExtracted(
  '@luca delegate review the auth flow to Alden',
  'review the auth flow',
);
assertExtracted(
  '@luca loop in Alden on the absence call issue',
  'the absence call issue',
);
assertExtracted(
  '@luca hand this to Alden — check the rolling episode sync',
  'check the rolling episode sync',
);
// No matching phrase → fallback to full (stripped) content
assertExtracted(
  '@luca Alden should know about this',
  'Alden should know about this',
);

// ── 4. Source-order proof ────────────────────────────────────────────────────
// Reads the real luca-responder.ts source and verifies that:
//   (a) the delegation dispatch block (`delegateToAlden`) appears before the
//       Anthropic client call (`getAnthropicClient`) inside respondToNudge.
//   (b) the delegation block is OUTSIDE the Claude try/catch.
//
// This proves structurally that a Claude error cannot suppress delegation —
// even without a running server or mock Anthropic client.
console.log('\n[4] Source-order proof — delegation fires before Anthropic call');

const responderPath = resolve(__dirname, '../services/luca-responder.ts');
const src = readFileSync(responderPath, 'utf8');

// Find respondToNudge function body
const fnStart = src.indexOf('export async function respondToNudge(');
if (fnStart === -1) {
  console.error('  ✗ respondToNudge not found in luca-responder.ts');
  _failed++;
} else {
  const fnBody = src.slice(fnStart);

  // Position of the delegation dispatch within the function
  const delegationPos = fnBody.indexOf("import('./luca-delegation')");
  // Position of the Anthropic client construction within the function
  const anthropicPos = fnBody.indexOf('getAnthropicClient()');
  // Position of the try { block wrapping the Claude call
  const tryPos = fnBody.indexOf('\n  try {');

  assert(
    'delegateToAlden is dispatched inside respondToNudge',
    delegationPos > 0,
    true,
  );
  assert(
    'getAnthropicClient() call exists inside respondToNudge',
    anthropicPos > 0,
    true,
  );
  assert(
    'delegation dispatch comes BEFORE the Anthropic try-block',
    delegationPos < tryPos && tryPos < anthropicPos,
    true,
  );
  assert(
    'delegation is outside the Claude try-block (not silenced by catch)',
    delegationPos < tryPos,
    true,
  );
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`nudge-delegation-ci: ${_passed} passed, ${_failed} failed`);

if (_failed > 0) {
  process.exit(1);
}
