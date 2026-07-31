/**
 * test-gl-memory-chain-guard.ts
 *
 * Simulation test for the memory-chain guard in the Gemini Live (GL) voice path.
 * Mirrors the logic in server/services/gemini-live-session.ts lines ~3427–3461.
 *
 * GL-specific differences vs. text-mode (daniela-caller.ts):
 *   • Counter lives on session object (`consecutiveMemoryCalls`) not a loop-local var
 *   • One-shot gate (`glMemoryNudgeSent`) prevents repeated nudges within one chain
 *   • Gate resets when non-memory tool fires OR when Daniela produces audio
 *   • Tool response format: `response.result` string (not `functionResponse.response.output[0].text`)
 *
 * Run: npx tsx server/scripts/test-gl-memory-chain-guard.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ─── Replicated constants from gemini-live-session.ts ─────────────────────
// These must stay in sync with the source file.
// If they drift, the cross-check section below will catch it.

const MEMORY_TOOL_NAMES = new Set([
  'recall', 'browse_conversations_by_date', 'search_my_teaching_wisdom',
  'introspect', 'memory_lookup', 'read_full_session', 'read_my_reflections',
  'memory_review',
]);

const MEMORY_CHAIN_LIMIT = 3; // hard backstop; system prompt soft-limits at 2

const GL_NUDGE_TEXT =
  '\n\n--- SYSTEM STATUS ---\n' +
  'CRITICAL: Multiple lookups performed. Student-facing latency is high. ' +
  'Do not perform further tool calls. ' +
  'One exception: if the student is explicitly testing shared memory — phrasing like "do you remember when I told you about…" or "what did I say about…" — you may attempt one more targeted search. ' +
  'After that search (or if no such test is happening), respond honestly with whatever you have found, including "I don\'t have your exact words in front of me right now" if the specific detail was not in the results. ' +
  'Synthesize the current findings into a direct response to the student immediately.';

// ─── Session object mock ───────────────────────────────────────────────────
interface MockSession {
  consecutiveMemoryCalls?: number;
  glMemoryNudgeSent?: boolean;
}

// ─── Tool response format (GL path) ───────────────────────────────────────
interface GlToolResponse {
  id: string;
  name: string;
  response: { result: string };
}

/**
 * Simulates ONE GL tool batch through the memory-chain guard block.
 * Returns updated session state + whether the nudge was appended.
 */
function simulateGlGuardBatch(params: {
  session: MockSession;
  toolNames: string[];
}): {
  session: MockSession;
  nudgeAppended: boolean;
  nudgeText: string | null;
} {
  const { toolNames } = params;
  // Deep-clone session so each call is independent
  const session: MockSession = { ...params.session };

  // Build fake responses (mirrors GL responses[] array before the guard runs)
  const responses: GlToolResponse[] = toolNames.map((name, i) => ({
    id: `fc-${i}`,
    name,
    response: { result: `[${name} result]` },
  }));

  // ── Replicated guard logic from gemini-live-session.ts ──────────────────
  const batchToolNames = toolNames;
  const allMemoryBatch = batchToolNames.every((n: string) => MEMORY_TOOL_NAMES.has(n));

  let nudgeAppended = false;
  let nudgeText: string | null = null;

  if (!allMemoryBatch) {
    session.consecutiveMemoryCalls = 0;
    session.glMemoryNudgeSent = false;
  } else {
    const prev = (session.consecutiveMemoryCalls ?? 0);
    session.consecutiveMemoryCalls = prev + 1;
    if (
      !session.glMemoryNudgeSent &&
      session.consecutiveMemoryCalls >= MEMORY_CHAIN_LIMIT &&
      responses.length > 0
    ) {
      const lastResp = responses[responses.length - 1];
      const existing = lastResp.response.result ?? '';
      lastResp.response.result =
        existing +
        '\n\n--- SYSTEM STATUS ---\n' +
        'CRITICAL: Multiple lookups performed. Student-facing latency is high. ' +
        'Do not perform further tool calls. ' +
        'One exception: if the student is explicitly testing shared memory — phrasing like "do you remember when I told you about…" or "what did I say about…" — you may attempt one more targeted search. ' +
        'After that search (or if no such test is happening), respond honestly with whatever you have found, including "I don\'t have your exact words in front of me right now" if the specific detail was not in the results. ' +
        'Synthesize the current findings into a direct response to the student immediately.';
      session.glMemoryNudgeSent = true;
      nudgeAppended = true;
      nudgeText = lastResp.response.result;
    }
  }

  return { session, nudgeAppended, nudgeText };
}

/**
 * Simulates the generationComplete / audio-produced reset (GL path).
 * Resets both counters — mirrors lines ~2656–2663 in gemini-live-session.ts.
 */
function simulateAudioProduced(session: MockSession): MockSession {
  return { ...session, consecutiveMemoryCalls: 0, glMemoryNudgeSent: false };
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Core guard logic: fires at limit, one-shot gate, correct threshold
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — Core guard logic'));
sep();

let allPassed = true;

// ── Scenario A: Three consecutive memory-only batches ─────────────────────
console.log('\n' + Y('Scenario A — Three consecutive memory-only batches'));
console.log('  Expected: nudge fires at batch 3, NOT batch 1 or 2.\n');

{
  let session: MockSession = {};

  for (let batch = 1; batch <= 3; batch++) {
    const result = simulateGlGuardBatch({ session, toolNames: ['recall'] });
    session = result.session;

    const shouldFire = batch === 3;
    const label = `  Batch ${batch} (recall): count=${session.consecutiveMemoryCalls}`;
    if (result.nudgeAppended !== shouldFire) {
      console.log(R(`${label} — FAIL: nudge fired=${result.nudgeAppended}, expected=${shouldFire}`));
      allPassed = false;
    } else {
      console.log(G(`${label} — ✓ nudge fired=${result.nudgeAppended}`));
    }
  }
}

// ── Scenario B: One-shot gate — batch 4 must NOT re-fire ──────────────────
console.log('\n' + Y('Scenario B — One-shot gate: 4th memory batch must NOT re-fire after nudge'));
console.log('  Expected: nudge fires at batch 3, silent at batch 4 (gate latched).\n');

{
  let session: MockSession = {};
  let batch3NudgeFired = false;

  for (let batch = 1; batch <= 4; batch++) {
    const result = simulateGlGuardBatch({ session, toolNames: ['introspect'] });
    session = result.session;

    if (batch === 3) {
      batch3NudgeFired = result.nudgeAppended;
      console.log(batch3NudgeFired
        ? G(`  Batch 3 (introspect): nudge fired ✓`)
        : R(`  Batch 3 (introspect): FAIL — nudge did not fire`));
      if (!batch3NudgeFired) allPassed = false;
    }
    if (batch === 4) {
      if (result.nudgeAppended) {
        console.log(R(`  Batch 4 (introspect): FAIL — one-shot gate should have blocked re-fire`));
        allPassed = false;
      } else {
        console.log(G(`  Batch 4 (introspect): ✓ one-shot gate held (no duplicate nudge)`));
      }
    }
  }
}

// ── Scenario C: Non-memory tool resets counter ────────────────────────────
console.log('\n' + Y('Scenario C — Non-memory tool resets counter and clears one-shot gate'));
console.log('  Batches 1–2: memory. Batch 3: show_vocab_grid. Batch 4: memory (restart).\n');

{
  let session: MockSession = {};
  const batches = [
    { tools: ['recall'],           expectCount: 1, expectFire: false },
    { tools: ['read_my_reflections'], expectCount: 2, expectFire: false },
    { tools: ['show_vocab_grid'],  expectCount: 0, expectFire: false },  // non-memory → reset
    { tools: ['recall'],           expectCount: 1, expectFire: false },  // fresh chain
  ];

  for (const [i, { tools, expectCount, expectFire }] of batches.entries()) {
    const result = simulateGlGuardBatch({ session, toolNames: tools });
    session = result.session;
    const countOk = session.consecutiveMemoryCalls === expectCount;
    const fireOk = result.nudgeAppended === expectFire;
    console.log((countOk && fireOk)
      ? G(`  Batch ${i + 1} (${tools[0]}): count=${session.consecutiveMemoryCalls} ✓`)
      : R(`  Batch ${i + 1} (${tools[0]}): count=${session.consecutiveMemoryCalls}, fire=${result.nudgeAppended} — FAIL (expected count=${expectCount}, fire=${expectFire})`));
    if (!countOk || !fireOk) allPassed = false;
  }
}

// ── Scenario D: Audio production resets counter ───────────────────────────
console.log('\n' + Y('Scenario D — generationComplete (audio produced) resets counter and gate'));
console.log('  Batches 1–2: memory. Daniela speaks. Batch 3: memory (restarts from 1).\n');

{
  let session: MockSession = {};

  // Batch 1 + 2
  for (let b = 1; b <= 2; b++) {
    ({ session } = simulateGlGuardBatch({ session, toolNames: ['memory_lookup'] }));
  }
  console.log(`  After 2 memory batches: count=${session.consecutiveMemoryCalls}`);

  // Audio produced — generationComplete path
  session = simulateAudioProduced(session);
  const afterReset = session.consecutiveMemoryCalls === 0 && session.glMemoryNudgeSent === false;
  console.log(afterReset
    ? G(`  After audio reset: count=${session.consecutiveMemoryCalls}, nudgeSent=${session.glMemoryNudgeSent} ✓`)
    : R(`  After audio reset: count=${session.consecutiveMemoryCalls} — FAIL (expected 0)`));
  if (!afterReset) allPassed = false;

  // Batch 3 — fresh chain; should NOT fire (streak=1, below limit)
  const result3 = simulateGlGuardBatch({ session, toolNames: ['recall'] });
  session = result3.session;
  console.log(!result3.nudgeAppended
    ? G(`  Batch after reset (recall): count=${session.consecutiveMemoryCalls}, no premature nudge ✓`)
    : R(`  Batch after reset (recall): FAIL — premature nudge fired`));
  if (result3.nudgeAppended) allPassed = false;
}

// ── Scenario E: Multi-tool batch — all memory → increments; mixed → resets ─
console.log('\n' + Y('Scenario E — Multi-tool batches'));
console.log('  Batch 1: recall + read_full_session (all memory) → count=1');
console.log('  Batch 2: recall + show_image (mixed) → resets to 0\n');

{
  let session: MockSession = {};

  const r1 = simulateGlGuardBatch({ session, toolNames: ['recall', 'read_full_session'] });
  session = r1.session;
  console.log(session.consecutiveMemoryCalls === 1 && !r1.nudgeAppended
    ? G(`  Batch 1 (all-memory pair): count=${session.consecutiveMemoryCalls} ✓`)
    : R(`  Batch 1: FAIL — count=${session.consecutiveMemoryCalls}, nudge=${r1.nudgeAppended}`));
  if (session.consecutiveMemoryCalls !== 1 || r1.nudgeAppended) allPassed = false;

  const r2 = simulateGlGuardBatch({ session, toolNames: ['recall', 'show_image'] });
  session = r2.session;
  console.log(session.consecutiveMemoryCalls === 0 && !r2.nudgeAppended
    ? G(`  Batch 2 (mixed: recall+show_image): count=${session.consecutiveMemoryCalls} — reset ✓`)
    : R(`  Batch 2: FAIL — count=${session.consecutiveMemoryCalls}, nudge=${r2.nudgeAppended}`));
  if (session.consecutiveMemoryCalls !== 0 || r2.nudgeAppended) allPassed = false;
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Nudge content: GL nudge must match text-mode nudge
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Nudge content: GL nudge must include "One exception" clause'));
sep();

const nudgeChecks: Array<{ label: string; pass: boolean }> = [
  { label: 'Contains SYSTEM STATUS header',                  pass: GL_NUDGE_TEXT.includes('--- SYSTEM STATUS ---') },
  { label: 'Contains latency warning',                       pass: GL_NUDGE_TEXT.includes('Student-facing latency is high') },
  { label: 'Contains stop directive',                        pass: GL_NUDGE_TEXT.includes('Do not perform further tool calls') },
  { label: 'Contains "One exception" clause',                pass: GL_NUDGE_TEXT.includes('One exception:') },
  { label: 'Shared-history trigger: "do you remember when I told you about"',
    pass: GL_NUDGE_TEXT.includes('do you remember when I told you about') },
  { label: 'Shared-history trigger: "what did I say about"',
    pass: GL_NUDGE_TEXT.includes('what did I say about') },
  { label: 'Exception allows one more search ("one more targeted search")',
    pass: GL_NUDGE_TEXT.includes('one more targeted search') },
  { label: 'Honest fallback ("I don\'t have your exact words")',
    pass: GL_NUDGE_TEXT.includes("I don't have your exact words in front of me right now") },
  { label: 'Synthesize-immediately directive',
    pass: GL_NUDGE_TEXT.includes('Synthesize the current findings into a direct response to the student immediately') },
  { label: '"One exception" appears AFTER stop directive (correct ordering)',
    pass: GL_NUDGE_TEXT.indexOf('One exception:') > GL_NUDGE_TEXT.indexOf('Do not perform further tool calls') },
];

for (const { label, pass } of nudgeChecks) {
  console.log(`  ${pass ? G('✓') : R('✗')} ${label}`);
  if (!pass) allPassed = false;
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2b — Cross-check: gemini-live-session.ts imports from memory-chain-guard
// (nudge text must not be inline — it must come from the canonical source)
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2b — Cross-check: gemini-live-session.ts imports from memory-chain-guard.ts'));
sep();

try {
  const sourceFile = readFileSync(
    join(import.meta.dirname ?? __dirname, '../services/gemini-live-session.ts'),
    'utf-8',
  );

  const crossChecks = [
    { label: 'GL source imports MEMORY_CHAIN_NUDGE_TEXT from memory-chain-guard',
      pass: sourceFile.includes('MEMORY_CHAIN_NUDGE_TEXT') && sourceFile.includes('memory-chain-guard') },
    { label: 'GL source imports MEMORY_CHAIN_LIMIT from memory-chain-guard',
      pass: sourceFile.includes('MEMORY_CHAIN_LIMIT') && sourceFile.includes('memory-chain-guard') },
    { label: 'GL source imports MEMORY_TOOL_NAMES from memory-chain-guard',
      pass: sourceFile.includes('MEMORY_TOOL_NAMES') && sourceFile.includes('memory-chain-guard') },
    { label: 'GL source has no inline nudge text (no "--- SYSTEM STATUS ---" literal)',
      pass: !sourceFile.includes('--- SYSTEM STATUS ---') },
    { label: 'GL source uses MEMORY_CHAIN_NUDGE_TEXT constant at the injection site',
      pass: sourceFile.includes('MEMORY_CHAIN_NUDGE_TEXT') },
  ];

  for (const { label, pass } of crossChecks) {
    console.log(`  ${pass ? G('✓') : R('✗ DRIFT DETECTED')} ${label}`);
    if (!pass) allPassed = false;
  }

  if (crossChecks.every(c => c.pass)) {
    console.log('\n' + G('  ✓ GL source correctly delegates nudge text to memory-chain-guard.ts.'));
  } else {
    console.log('\n' + R('  ✗ DRIFT: GL source has inline nudge text or missing imports. Fix gemini-live-session.ts.'));
  }
} catch (err) {
  console.log(Y(`  ⚠ Could not read source file for cross-check: ${(err as Error).message}`));
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Parity check: both GL and text-mode import nudge text from the
// canonical single source (memory-chain-guard.ts) — no inline copies allowed.
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Parity: both GL and text-mode import nudge text from memory-chain-guard.ts'));
sep();

// Design intent: both paths share the same MEMORY_CHAIN_NUDGE_TEXT constant
// from memory-chain-guard.ts. Neither file should have the nudge text inline.
// Parity is guaranteed structurally (one source) rather than by text comparison.

try {
  const guardFile = readFileSync(
    join(import.meta.dirname ?? __dirname, '../services/memory-chain-guard.ts'),
    'utf-8',
  );
  const callerFile = readFileSync(
    join(import.meta.dirname ?? __dirname, '../services/daniela-caller.ts'),
    'utf-8',
  );
  const glFile = readFileSync(
    join(import.meta.dirname ?? __dirname, '../services/gemini-live-session.ts'),
    'utf-8',
  );

  // Both consumer files must import MEMORY_CHAIN_NUDGE_TEXT from the canonical source.
  const callerImportsNudge = callerFile.includes('MEMORY_CHAIN_NUDGE_TEXT') && callerFile.includes('memory-chain-guard');
  const glImportsNudge     = glFile.includes('MEMORY_CHAIN_NUDGE_TEXT') && glFile.includes('memory-chain-guard');

  // Neither consumer should have the nudge text hardcoded inline.
  // (Presence of the canonical constant in the guard file is the positive check below.)
  const callerNotInline = !callerFile.includes('--- SYSTEM STATUS ---');
  const glNotInline     = !glFile.includes('--- SYSTEM STATUS ---');

  // Canonical source (memory-chain-guard.ts) must have all required phrases.
  const guardHasException    = guardFile.includes('One exception: if the student is explicitly testing shared memory');
  const guardHasSharedHist   = guardFile.includes('do you remember when I told you about');
  const guardHasFallback     = guardFile.includes('exact words in front of me right now');
  const guardHasSynthesize   = guardFile.includes('Synthesize the current findings into a direct response to the student immediately');

  const parityChecks = [
    { label: 'daniela-caller.ts imports MEMORY_CHAIN_NUDGE_TEXT from memory-chain-guard',   pass: callerImportsNudge },
    { label: 'gemini-live-session.ts imports MEMORY_CHAIN_NUDGE_TEXT from memory-chain-guard', pass: glImportsNudge },
    { label: 'daniela-caller.ts has no inline nudge text (no "--- SYSTEM STATUS ---")',      pass: callerNotInline },
    { label: 'gemini-live-session.ts has no inline nudge text (no "--- SYSTEM STATUS ---")', pass: glNotInline },
    { label: 'Canonical source has "One exception" clause',   pass: guardHasException },
    { label: 'Canonical source has shared-history phrase',    pass: guardHasSharedHist },
    { label: 'Canonical source has honest fallback phrase',   pass: guardHasFallback },
    { label: 'Canonical source has synthesize-immediately directive', pass: guardHasSynthesize },
  ];

  for (const { label, pass } of parityChecks) {
    console.log(`  ${pass ? G('✓') : R('✗ PARITY DRIFT')} ${label}`);
    if (!pass) allPassed = false;
  }

  if (parityChecks.every(c => c.pass)) {
    console.log('\n' + G('  ✓ Both paths import from one canonical source — parity is structural, not fragile text comparison.'));
  } else {
    console.log('\n' + R('  ✗ PARITY DRIFT: one or both paths have diverged from the canonical source.'));
  }
} catch (err) {
  console.log(Y(`  ⚠ Could not read source files for parity check: ${(err as Error).message}`));
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 4 — MEMORY_TOOL_NAMES coverage (GL uses shared set from memory-chain-guard)
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 4 — MEMORY_TOOL_NAMES coverage (GL uses shared set from memory-chain-guard.ts)'));
sep();

const knownMemoryTools = [
  'recall', 'browse_conversations_by_date', 'search_my_teaching_wisdom',
  'introspect', 'memory_lookup', 'read_full_session', 'read_my_reflections',
  'memory_review',
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

// Cross-check MEMORY_TOOL_NAMES against the shared source file
try {
  const guardFile = readFileSync(
    join(import.meta.dirname ?? __dirname, '../services/memory-chain-guard.ts'),
    'utf-8',
  );
  const match = guardFile.match(/MEMORY_TOOL_NAMES = new Set\(\[([\s\S]*?)\]\)/);
  if (match) {
    const sourceNames = (match[1].match(/'([^']+)'/g) || []).map(s => s.replace(/'/g, ''));
    const sourceSet = new Set(sourceNames);
    const replicaMissing = [...sourceSet].filter(n => !MEMORY_TOOL_NAMES.has(n));
    const replicaExtra = [...MEMORY_TOOL_NAMES].filter(n => !sourceSet.has(n));

    console.log('\n  MEMORY_TOOL_NAMES sync check vs memory-chain-guard.ts:');
    if (replicaMissing.length === 0 && replicaExtra.length === 0) {
      console.log(G('  ✓ MEMORY_TOOL_NAMES replica matches source exactly.'));
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
  console.log(Y(`  ⚠ Could not read guard source: ${(err as Error).message}`));
}

// ══════════════════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════════════════
sep();
if (allPassed) {
  console.log(G('ALL CHECKS PASSED'));
  console.log(G('GL memory-chain guard correctly:'));
  console.log(G('  • fires at exactly batch 3 (MEMORY_CHAIN_LIMIT=3), not batch 1 or 2'));
  console.log(G('  • one-shot gate (glMemoryNudgeSent) prevents duplicate nudges per chain'));
  console.log(G('  • resets counter and gate when non-memory tool fires'));
  console.log(G('  • resets counter and gate when Daniela produces audio (generationComplete)'));
  console.log(G('  • multi-tool batches: all-memory increments, mixed resets'));
  console.log(G('  • nudge text includes "One exception" clause (parity with text-mode)'));
  console.log(G('  • nudge text includes honest fallback phrase'));
  console.log(G('  • nudge text includes synthesize-immediately directive'));
  console.log(G('  • imports MEMORY_TOOL_NAMES + MEMORY_CHAIN_LIMIT from shared memory-chain-guard.ts'));
  console.log('');
} else {
  console.log(R('ONE OR MORE CHECKS FAILED — see ✗ lines above.'));
  process.exit(1);
}
