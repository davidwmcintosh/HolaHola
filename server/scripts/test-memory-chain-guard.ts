/**
 * test-memory-chain-guard.ts
 *
 * Three-part test for the MEMORY_CHAIN_LIMIT guard and shared-history
 * exception in runDanielaFCLoop (daniela-caller.ts lines 352–377).
 *
 * Part 1 — Logic simulation: replicates the exact guard code with controlled
 *           inputs; no live API or DB calls required.
 * Part 2 — Nudge content: asserts the nudge text contains both the hard
 *           synthesize directive and the shared-history exception phrase.
 * Part 3 — Counter reset: verifies the consecutive-turn counter resets when
 *           a non-memory tool fires or text is produced mid-chain.
 *
 * Run: npx tsx server/scripts/test-memory-chain-guard.ts
 */

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ─── Replicated constants from daniela-caller.ts ──────────────────────────
// Keep in sync with server/services/daniela-caller.ts.
// If these drift, the tests below will catch the mismatch.

const MEMORY_TOOL_NAMES = new Set([
  'recall', 'browse_conversations_by_date', 'search_my_teaching_wisdom',
  'introspect', 'memory_lookup', 'read_full_session', 'read_my_reflections',
]);

const MEMORY_CHAIN_LIMIT = 3; // hard backstop; system prompt soft-limits at 2

const NUDGE_TEXT =
  '\n\n--- SYSTEM STATUS ---\n' +
  'CRITICAL: Multiple lookups performed. Student-facing latency is high. ' +
  'Do not perform further tool calls. ' +
  'One exception: if the student is explicitly testing shared memory — phrasing like "do you remember when I told you about…" or "what did I say about…" — you may attempt one more targeted search. ' +
  'After that search (or if no such test is happening), respond honestly with whatever you have found, including "I don\'t have your exact words in front of me right now" if the specific detail was not in the results. ' +
  'Synthesize the current findings into a direct response to the student immediately.';

// ─── Simulation helpers ───────────────────────────────────────────────────

interface FakeFunctionCall {
  name: string;
}

interface FakePart {
  functionCall?: FakeFunctionCall;
  text?: string;
}

/**
 * Simulates ONE iteration of the memory-chain guard block in runDanielaFCLoop.
 * Returns the (possibly mutated) functionResponseParts and the new counter value.
 */
function simulateGuardIteration(params: {
  fcParts: FakePart[];
  textContent: string;
  consecutiveMemoryOnlyTurns: number;
  turn: number;
}): {
  consecutiveMemoryOnlyTurns: number;
  nudgeAppended: boolean;
  nudgeText: string | null;
} {
  const { fcParts, textContent, turn } = params;
  let { consecutiveMemoryOnlyTurns } = params;

  // Replicate exact guard logic from daniela-caller.ts lines 358–377
  const allMemoryTools = fcParts.every(
    (p) => MEMORY_TOOL_NAMES.has(p.functionCall?.name ?? ''),
  );

  // Build a fake functionResponseParts with one entry per FC
  const functionResponseParts = fcParts.map((p) => ({
    functionResponse: {
      name: p.functionCall!.name,
      response: { output: [{ text: `[${p.functionCall!.name} result]` }] },
    },
  }));

  let nudgeAppended = false;
  let nudgeText: string | null = null;

  if (allMemoryTools && !textContent) {
    consecutiveMemoryOnlyTurns++;
    if (consecutiveMemoryOnlyTurns >= MEMORY_CHAIN_LIMIT && functionResponseParts.length > 0) {
      const last = functionResponseParts[functionResponseParts.length - 1];
      const existing = last?.functionResponse?.response?.output?.[0]?.text ?? '';
      last.functionResponse.response.output[0].text = existing + NUDGE_TEXT;
      nudgeAppended = true;
      nudgeText = last.functionResponse.response.output[0].text;
    }
  } else {
    consecutiveMemoryOnlyTurns = 0;
  }

  return { consecutiveMemoryOnlyTurns, nudgeAppended, nudgeText };
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Logic simulation: two scenarios
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — Logic simulation'));
console.log(Y('  Tests guard fires at turn 3, not 2; shared-history phrasing preserved.'));
sep();

let allPassed = true;

// ── Scenario A: Shared-history framing ────────────────────────────────────
console.log('\n' + Y('Scenario A — Shared-history question (3 memory-only turns)'));
console.log('  Student says: "do you remember when I told you about my trip to Barcelona?"');
console.log('  Expected: nudge fires at turn 3, contains shared-history exception');
console.log('            Daniela is allowed ONE more targeted search, NOT cut off early.\n');

{
  let streak = 0;
  const memoryTools = ['recall', 'read_full_session', 'memory_lookup'];

  for (let turn = 0; turn < 3; turn++) {
    const fcParts: FakePart[] = [{ functionCall: { name: memoryTools[turn] } }];
    const result = simulateGuardIteration({ fcParts, textContent: '', consecutiveMemoryOnlyTurns: streak, turn });
    streak = result.consecutiveMemoryOnlyTurns;

    if (turn < 2) {
      // First two turns: nudge must NOT fire
      const label = `  Turn ${turn + 1} (${memoryTools[turn]}): streak=${streak}`;
      if (result.nudgeAppended) {
        console.log(R(`${label} — FAIL: nudge fired too early`));
        allPassed = false;
      } else {
        console.log(G(`${label} — ✓ no premature nudge`));
      }
    } else {
      // Third turn: nudge MUST fire
      const label = `  Turn ${turn + 1} (${memoryTools[turn]}): streak=${streak}`;
      if (!result.nudgeAppended) {
        console.log(R(`${label} — FAIL: nudge did not fire at limit`));
        allPassed = false;
      } else {
        console.log(G(`${label} — ✓ nudge fired`));
        // Verify the nudge contains the shared-history exception phrase
        const nudge = result.nudgeText ?? '';
        const hasException = nudge.includes('do you remember when I told you about');
        const hasOneMore = nudge.includes('one more targeted search');
        console.log(
          `    Shared-history exception phrase present: ${hasException ? G('✓') : R('✗ MISSING')}`,
        );
        console.log(
          `    "one more targeted search" language present: ${hasOneMore ? G('✓') : R('✗ MISSING')}`,
        );
        if (!hasException || !hasOneMore) allPassed = false;
      }
    }
  }

  // After nudge fires, a 4th search is allowed (shared-history exception).
  // The nudge does NOT say "stop immediately" — it says "you MAY attempt one more".
  // Verify: nudge does NOT say "Do not perform further tool calls" WITHOUT the exception.
  const finalNudgeText = NUDGE_TEXT;
  const hasStopInstruction = finalNudgeText.includes('Do not perform further tool calls');
  const hasExceptionFollowing = finalNudgeText.includes('One exception:');
  const exceptionComesAfterStop = finalNudgeText.indexOf('One exception:') > finalNudgeText.indexOf('Do not perform further tool calls');

  console.log('\n  Structural check — stop + exception ordering:');
  console.log(`    "Do not perform further tool calls" present: ${hasStopInstruction ? G('✓') : R('✗')}`);
  console.log(`    "One exception:" follows the stop: ${exceptionComesAfterStop ? G('✓') : R('✗')}`);
  console.log(
    `    Shared-history question must NOT get cut off prematurely: ${(hasStopInstruction && hasExceptionFollowing && exceptionComesAfterStop) ? G('✓ Guard wired correctly') : R('✗ FAIL')}`,
  );
  if (!(hasStopInstruction && hasExceptionFollowing && exceptionComesAfterStop)) allPassed = false;
}

// ── Scenario B: No shared-history framing ─────────────────────────────────
console.log('\n' + Y('Scenario B — No shared-history framing (3 memory-only turns)'));
console.log('  Student says: "what do you think about grammar drills?"');
console.log('  Expected: nudge fires at turn 3, contains synthesize-immediately directive.\n');

{
  let streak = 0;
  const memoryTools = ['introspect', 'recall', 'read_my_reflections'];

  for (let turn = 0; turn < 3; turn++) {
    const fcParts: FakePart[] = [{ functionCall: { name: memoryTools[turn] } }];
    const result = simulateGuardIteration({ fcParts, textContent: '', consecutiveMemoryOnlyTurns: streak, turn });
    streak = result.consecutiveMemoryOnlyTurns;

    if (turn === 2) {
      const label = `  Turn ${turn + 1} (${memoryTools[turn]}): streak=${streak}`;
      if (!result.nudgeAppended) {
        console.log(R(`${label} — FAIL: nudge did not fire`));
        allPassed = false;
      } else {
        console.log(G(`${label} — ✓ nudge fired`));
        const nudge = result.nudgeText ?? '';
        // Directive to synthesize immediately must be present
        const hasSynthesizeNow = nudge.includes('Synthesize the current findings into a direct response to the student immediately');
        const hasHonestFallback = nudge.includes("I don't have your exact words in front of me right now");
        console.log(
          `    "Synthesize immediately" directive present: ${hasSynthesizeNow ? G('✓') : R('✗ MISSING')}`,
        );
        console.log(
          `    Honest fallback phrase present: ${hasHonestFallback ? G('✓') : R('✗ MISSING')}`,
        );
        if (!hasSynthesizeNow || !hasHonestFallback) allPassed = false;
      }
    }
  }
}

// ── Scenario C: Multiple FC calls per turn (all memory) ───────────────────
console.log('\n' + Y('Scenario C — Multiple memory tools per turn (both must be memory-only)'));
console.log('  Turn calls both recall + read_full_session in the same FC batch.\n');

{
  let streak = 0;

  for (let turn = 0; turn < 3; turn++) {
    const fcParts: FakePart[] = [
      { functionCall: { name: 'recall' } },
      { functionCall: { name: 'read_full_session' } },
    ];
    const result = simulateGuardIteration({ fcParts, textContent: '', consecutiveMemoryOnlyTurns: streak, turn });
    streak = result.consecutiveMemoryOnlyTurns;

    if (turn === 2) {
      console.log(
        result.nudgeAppended
          ? G(`  Turn 3 (recall + read_full_session batch): streak=${streak} — ✓ nudge fired (both counted as memory-only)`)
          : R(`  Turn 3: streak=${streak} — FAIL: nudge should fire when ALL tools are memory`),
      );
      if (!result.nudgeAppended) allPassed = false;
    }
  }
}

// ── Scenario D: Mixed turn breaks the chain ────────────────────────────────
console.log('\n' + Y('Scenario D — Non-memory tool breaks chain (show_vocab_grid mid-sequence)'));
console.log('  Turns 1–2: memory only. Turn 3: show_vocab_grid (non-memory) = streak resets.\n');

{
  let streak = 0;
  const turns = [
    [{ functionCall: { name: 'recall' } }],
    [{ functionCall: { name: 'read_my_reflections' } }],
    [{ functionCall: { name: 'show_vocab_grid' } }], // non-memory — resets counter
    [{ functionCall: { name: 'recall' } }],           // streak restarts at 1
  ] as FakePart[][];

  const labels = ['recall', 'read_my_reflections', 'show_vocab_grid (break)', 'recall (restart)'];
  const expectedStreaks = [1, 2, 0, 1];
  const shouldFire = [false, false, false, false];

  for (let turn = 0; turn < turns.length; turn++) {
    const result = simulateGuardIteration({ fcParts: turns[turn], textContent: '', consecutiveMemoryOnlyTurns: streak, turn });
    streak = result.consecutiveMemoryOnlyTurns;
    const streakOk = streak === expectedStreaks[turn];
    const fireOk = result.nudgeAppended === shouldFire[turn];
    console.log(
      (streakOk && fireOk)
        ? G(`  Turn ${turn + 1} (${labels[turn]}): streak=${streak} ✓`)
        : R(`  Turn ${turn + 1} (${labels[turn]}): streak=${streak} FAIL (expected ${expectedStreaks[turn]})`),
    );
    if (!streakOk || !fireOk) allPassed = false;
  }
}

// ── Scenario E: Text content resets chain ─────────────────────────────────
console.log('\n' + Y('Scenario E — Text produced mid-chain resets counter'));
console.log('  Turns 1–2: memory only. Turn 3: recall + text (Daniela spoke). Counter resets.\n');

{
  let streak = 0;
  const turns = [
    { fcParts: [{ functionCall: { name: 'recall' } }] as FakePart[], textContent: '' },
    { fcParts: [{ functionCall: { name: 'introspect' } }] as FakePart[], textContent: '' },
    { fcParts: [{ functionCall: { name: 'recall' } }] as FakePart[], textContent: 'That reminds me of something you said...' }, // text present → reset
  ];

  const expectedStreaks = [1, 2, 0]; // text produced → resets
  const shouldFire = [false, false, false];

  for (let turn = 0; turn < turns.length; turn++) {
    const { fcParts, textContent } = turns[turn];
    const result = simulateGuardIteration({ fcParts, textContent, consecutiveMemoryOnlyTurns: streak, turn });
    streak = result.consecutiveMemoryOnlyTurns;
    const streakOk = streak === expectedStreaks[turn];
    const fireOk = result.nudgeAppended === shouldFire[turn];
    const label = textContent ? 'recall + text (Daniela spoke)' : fcParts[0].functionCall!.name;
    console.log(
      (streakOk && fireOk)
        ? G(`  Turn ${turn + 1} (${label}): streak=${streak} ✓`)
        : R(`  Turn ${turn + 1} (${label}): streak=${streak} FAIL (expected ${expectedStreaks[turn]})`),
    );
    if (!streakOk || !fireOk) allPassed = false;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Nudge content verification
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Nudge content: structural assertions on the injected text'));
sep();

const checks: Array<{ label: string; pass: boolean }> = [
  {
    label: 'Contains SYSTEM STATUS header',
    pass: NUDGE_TEXT.includes('--- SYSTEM STATUS ---'),
  },
  {
    label: 'Contains latency warning',
    pass: NUDGE_TEXT.includes('Student-facing latency is high'),
  },
  {
    label: 'Contains stop directive',
    pass: NUDGE_TEXT.includes('Do not perform further tool calls'),
  },
  {
    label: 'Contains "One exception" clause',
    pass: NUDGE_TEXT.includes('One exception:'),
  },
  {
    label: 'Shared-history trigger: "do you remember when I told you about"',
    pass: NUDGE_TEXT.includes('do you remember when I told you about'),
  },
  {
    label: 'Shared-history trigger: "what did I say about"',
    pass: NUDGE_TEXT.includes('what did I say about'),
  },
  {
    label: 'Exception allows one more search ("one more targeted search")',
    pass: NUDGE_TEXT.includes('one more targeted search'),
  },
  {
    label: 'Honest fallback ("I don\'t have your exact words")',
    pass: NUDGE_TEXT.includes("I don't have your exact words in front of me right now"),
  },
  {
    label: 'Synthesize-immediately directive',
    pass: NUDGE_TEXT.includes('Synthesize the current findings into a direct response to the student immediately'),
  },
  {
    label: '"One exception" appears AFTER the stop directive (correct ordering)',
    pass: NUDGE_TEXT.indexOf('One exception:') > NUDGE_TEXT.indexOf('Do not perform further tool calls'),
  },
];

for (const { label, pass } of checks) {
  console.log(`  ${pass ? G('✓') : R('✗')} ${label}`);
  if (!pass) allPassed = false;
}

// Cross-check: these replicated constants must match the live source file.
// Read the actual source and compare key strings.
import { readFileSync } from 'fs';
import { join } from 'path';

sep();
console.log(B('PART 2b — Cross-check: replicated constants vs live daniela-caller.ts'));
sep();

try {
  // MEMORY_CHAIN_LIMIT is defined in memory-chain-guard.ts (imported by daniela-caller.ts)
  const guardFile = readFileSync(
    join(import.meta.dirname ?? __dirname, '../services/memory-chain-guard.ts'),
    'utf-8',
  );
  const callerFile = readFileSync(
    join(import.meta.dirname ?? __dirname, '../services/daniela-caller.ts'),
    'utf-8',
  );

  const sourceHasLimit3 = guardFile.includes('MEMORY_CHAIN_LIMIT = 3');
  const sourceHasException = callerFile.includes('do you remember when I told you about');
  const sourceHasSynthesizeImmediately = callerFile.includes('Synthesize the current findings into a direct response to the student immediately');
  const sourceHasOneMoreSearch = callerFile.includes('one more targeted search');

  const crossChecks = [
    { label: 'MEMORY_CHAIN_LIMIT = 3 in memory-chain-guard.ts',  pass: sourceHasLimit3 },
    { label: 'Shared-history phrase in source nudge',             pass: sourceHasException },
    { label: '"one more targeted search" in source nudge',        pass: sourceHasOneMoreSearch },
    { label: '"Synthesize... immediately" directive in source',   pass: sourceHasSynthesizeImmediately },
  ];

  for (const { label, pass } of crossChecks) {
    console.log(`  ${pass ? G('✓') : R('✗ DRIFT DETECTED')} ${label}`);
    if (!pass) allPassed = false;
  }

  if (crossChecks.every(c => c.pass)) {
    console.log('\n' + G('  ✓ Replicated constants are in sync with the live source.'));
  } else {
    console.log('\n' + R('  ✗ DRIFT: The test constants do not match the source file. Update this script.'));
  }
} catch (err) {
  console.log(Y(`  ⚠ Could not read source file for cross-check: ${(err as Error).message}`));
}

// ─── Part 2c — Cross-check: system-prompt.ts exception paragraph vs nudge ─────
// The shared-history trigger phrases exist in two independent places:
//   1. system-prompt.ts ~line 360 — soft-limit paragraph (Daniela's inner voice)
//   2. daniela-caller.ts nudge   — hard-enforcement backstop (SYSTEM STATUS block)
// If they drift (e.g. someone softens one without updating the other), Daniela's
// soft and hard limits say contradictory things.  This block reads both source
// files and asserts the same key phrases appear in both.
sep();
console.log(B('PART 2c — Cross-check: system-prompt.ts exception phrase vs nudge in daniela-caller.ts'));
console.log(Y('  Ensures the soft-limit paragraph and the hard-enforcement nudge stay in sync.'));
sep();

// Canonical trigger phrases — the phrases that identify a shared-history test.
// Both the system-prompt paragraph AND the nudge must contain these exact strings.
// If you update either file's wording, update the other and update this list.
const SHARED_HISTORY_TRIGGER_PHRASES = [
  'do you remember when I told you about',
  'what did I say about',
] as const;

try {
  const systemPromptSource = readFileSync(
    join(import.meta.dirname ?? __dirname, '../system-prompt.ts'),
    'utf-8',
  );
  const nudgeSource = readFileSync(
    join(import.meta.dirname ?? __dirname, '../services/daniela-caller.ts'),
    'utf-8',
  );

  console.log('\n  Trigger phrases — must appear in BOTH system-prompt.ts and daniela-caller.ts nudge:');

  for (const phrase of SHARED_HISTORY_TRIGGER_PHRASES) {
    const inPrompt = systemPromptSource.includes(phrase);
    const inNudge  = nudgeSource.includes(phrase);
    const bothPresent = inPrompt && inNudge;

    console.log(`\n  Phrase: "${phrase}"`);
    console.log(`    system-prompt.ts:      ${inPrompt  ? G('✓ present') : R('✗ MISSING')}`);
    console.log(`    daniela-caller.ts:     ${inNudge   ? G('✓ present') : R('✗ MISSING')}`);
    console.log(`    In sync:               ${bothPresent ? G('✓') : R('✗ DRIFT DETECTED — update both files to match')}`);

    if (!bothPresent) allPassed = false;
  }

  // Also assert the "One exception" label itself appears in both —
  // a rename in either place would break the conceptual link.
  const exceptionLabelInPrompt = systemPromptSource.includes('One exception:');
  const exceptionLabelInNudge  = nudgeSource.includes('One exception:');
  console.log('\n  "One exception:" label (structural anchor):');
  console.log(`    system-prompt.ts:      ${exceptionLabelInPrompt ? G('✓ present') : R('✗ MISSING')}`);
  console.log(`    daniela-caller.ts:     ${exceptionLabelInNudge  ? G('✓ present') : R('✗ MISSING')}`);
  if (!exceptionLabelInPrompt) allPassed = false;
  if (!exceptionLabelInNudge)  allPassed = false;

  if (SHARED_HISTORY_TRIGGER_PHRASES.every(p => systemPromptSource.includes(p) && nudgeSource.includes(p))
      && exceptionLabelInPrompt && exceptionLabelInNudge) {
    console.log('\n' + G('  ✓ system-prompt.ts and daniela-caller.ts nudge are in sync on shared-history exception.'));
  } else {
    console.log('\n' + R('  ✗ DRIFT: system-prompt.ts and daniela-caller.ts nudge have diverged.'));
    console.log(R('    Update both files so they use the same trigger phrases, then re-run this script.'));
  }
} catch (err) {
  console.log(Y(`  ⚠ Could not read source files for Part 2c cross-check: ${(err as Error).message}`));
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Counter reset: verify MEMORY_TOOL_NAMES set is correct
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — MEMORY_TOOL_NAMES coverage and non-memory tool classification'));
sep();

const knownMemoryTools = [
  'recall', 'browse_conversations_by_date', 'search_my_teaching_wisdom',
  'introspect', 'memory_lookup', 'read_full_session', 'read_my_reflections',
];

const knownNonMemoryTools = [
  'show_vocab_grid', 'show_image', 'start_scene', 'flag_for_agent',
  'grounding_query', 'switch_tutor', 'call_support',
  'update_session_pedagogy', 'browse_syllabus',
];

console.log('\n  Memory tools (should all be in MEMORY_TOOL_NAMES):');
for (const name of knownMemoryTools) {
  const inSet = MEMORY_TOOL_NAMES.has(name);
  console.log(`    ${inSet ? G('✓') : R('✗ MISSING')} ${name}`);
  if (!inSet) allPassed = false;
}

console.log('\n  Non-memory tools (must NOT be in MEMORY_TOOL_NAMES):');
for (const name of knownNonMemoryTools) {
  const inSet = MEMORY_TOOL_NAMES.has(name);
  console.log(`    ${!inSet ? G('✓ not in set') : R('✗ INCORRECTLY IN SET')} ${name}`);
  if (inSet) allPassed = false;
}

// Verify cross-check from source file
try {
  const sourceFile = readFileSync(
    join(import.meta.dirname ?? __dirname, '../services/daniela-caller.ts'),
    'utf-8',
  );
  // Extract MEMORY_TOOL_NAMES block from source
  const match = sourceFile.match(/MEMORY_TOOL_NAMES = new Set\(\[([\s\S]*?)\]\)/);
  if (match) {
    const sourceNames = (match[1].match(/'([^']+)'/g) || []).map(s => s.replace(/'/g, ''));
    const sourceSet = new Set(sourceNames);
    const replicaMissing = [...sourceSet].filter(n => !MEMORY_TOOL_NAMES.has(n));
    const replicaExtra = [...MEMORY_TOOL_NAMES].filter(n => !sourceSet.has(n));

    console.log('\n  MEMORY_TOOL_NAMES sync check vs source:');
    if (replicaMissing.length === 0 && replicaExtra.length === 0) {
      console.log(G('  ✓ MEMORY_TOOL_NAMES matches source exactly.'));
    } else {
      if (replicaMissing.length > 0) {
        console.log(R(`  ✗ Missing from replica: ${replicaMissing.join(', ')}`));
        allPassed = false;
      }
      if (replicaExtra.length > 0) {
        console.log(R(`  ✗ Extra in replica (not in source): ${replicaExtra.join(', ')}`));
        allPassed = false;
      }
    }
  }
} catch (err) {
  console.log(Y(`  ⚠ Source cross-check unavailable: ${(err as Error).message}`));
}

// ══════════════════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════════════════
sep();
if (allPassed) {
  console.log(G('ALL CHECKS PASSED'));
  console.log(G('Memory-chain guard correctly:'));
  console.log(G('  • fires at exactly turn 3 (MEMORY_CHAIN_LIMIT=3), not 2'));
  console.log(G('  • preserves "One exception" for shared-history questions'));
  console.log(G('  • allows one more targeted search before synthesizing'));
  console.log(G('  • carries honest fallback phrase when search comes back empty'));
  console.log(G('  • includes synthesize-immediately directive for non-shared-history cases'));
  console.log(G('  • resets counter on non-memory tool or when text is produced'));
  console.log('');
} else {
  console.log(R('ONE OR MORE CHECKS FAILED — see ✗ lines above.'));
  process.exit(1);
}
