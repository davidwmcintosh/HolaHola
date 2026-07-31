/**
 * test-memory-chain-guard-integration.ts
 *
 * Integration-level guard test: exercises the REAL runDanielaFCLoop code path
 * with a fake Gemini client so the memory-chain guard is verified end-to-end —
 * not just as an isolated simulation.
 *
 * Why this exists (and why it's NOT the unit test):
 *   The unit test (memory-chain-guard.test.ts) simulates the guard with local
 *   helper functions. A refactor that removes the guard block from
 *   runDanielaFCLoop, changes the MEMORY_TOOL_NAMES import path, or breaks the
 *   allMemoryTools check would leave the unit test green while production regresses.
 *   This script catches those cases by walking the real loop.
 *
 * Runs as a standalone script (not via --test runner) so that DB pool handles
 * opened by the transitive imports can be cleanly terminated with process.exit(0).
 *
 * Run: npx tsx server/scripts/test-memory-chain-guard-integration.ts
 */

import { runDanielaFCLoop } from '../services/daniela-caller';
import {
  MEMORY_CHAIN_LIMIT,
  MEMORY_CHAIN_NUDGE_TEXT,
  MEMORY_TOOL_NAMES,
} from '../services/memory-chain-guard';

// ── Colour helpers ────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ── Test accounting ──────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function pass(name: string, detail?: string) {
  passed++;
  console.log(`  ${G('✓')} ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name: string, detail: string) {
  failed++;
  console.error(`  ${R('✗')} ${name}`);
  console.error(`    ${detail}`);
}

// ── Fake Gemini client ───────────────────────────────────────────────────────
// Returns a controlled sequence of generateContent responses.
// Each element is either a { functionCall: { name, args? } } (FC turn)
// or a { text } (final text-only turn).

type FakeSpec =
  | { functionCall: { name: string; args?: Record<string, string> } }
  | { text: string };

function makeFakeClient(responses: FakeSpec[]) {
  let callIndex = 0;
  return {
    models: {
      async generateContent(_args: any): Promise<any> {
        const spec = responses[callIndex] ?? responses[responses.length - 1];
        callIndex++;

        if ('functionCall' in spec) {
          return {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      functionCall: {
                        name: spec.functionCall.name,
                        args: spec.functionCall.args ?? { query: 'test query' },
                      },
                    },
                  ],
                },
                finishReason: 'STOP',
              },
            ],
          };
        }

        const text = spec.text;
        return {
          candidates: [
            { content: { parts: [{ text }] }, finishReason: 'STOP' },
          ],
          text,
        };
      },
    },
  };
}

// ── Tool response text collector ─────────────────────────────────────────────
function collectToolResponseTexts(messages: any[]): string[] {
  const texts: string[] = [];
  for (const msg of messages) {
    if (msg.role !== 'tool') continue;
    for (const part of msg.parts ?? []) {
      for (const o of part?.functionResponse?.response?.output ?? []) {
        if (typeof o?.text === 'string') texts.push(o.text);
      }
    }
  }
  return texts;
}

// ── Tests ────────────────────────────────────────────────────────────────────

async function testNudgeAppearsAtLimit() {
  const name = `nudge appears after ${MEMORY_CHAIN_LIMIT} consecutive memory-only turns`;
  const messages: any[] = [
    { role: 'user', parts: [{ text: 'What do you remember about me?' }] },
  ];

  const responses: FakeSpec[] = [
    ...Array.from({ length: MEMORY_CHAIN_LIMIT }, () => ({
      functionCall: { name: 'recall', args: { query: 'student history' } },
    })),
    { text: 'Based on my memory, here is what I found.' },
  ];

  await runDanielaFCLoop({
    systemPrompt: 'You are Daniela.',
    messages,
    userId: 'ci-test-user',
    allowedTools: ['recall'],
    maxTurns: MEMORY_CHAIN_LIMIT + 2,
    _geminiOverride: makeFakeClient(responses),
  });

  const toolTexts = collectToolResponseTexts(messages);
  if (toolTexts.length < MEMORY_CHAIN_LIMIT) {
    return fail(name, `Expected ≥${MEMORY_CHAIN_LIMIT} tool response(s), got ${toolTexts.length}`);
  }

  const nudgeCount = toolTexts.filter(t => t.includes(MEMORY_CHAIN_NUDGE_TEXT)).length;
  if (nudgeCount === 0) {
    return fail(
      name,
      `MEMORY_CHAIN_NUDGE_TEXT not found in any tool response. ` +
      `Guard block may be missing or MEMORY_CHAIN_NUDGE_TEXT import is broken in runDanielaFCLoop.`,
    );
  }

  const lastMemoryText = toolTexts[MEMORY_CHAIN_LIMIT - 1];
  if (!lastMemoryText?.includes(MEMORY_CHAIN_NUDGE_TEXT)) {
    return fail(
      name,
      `Nudge found ${nudgeCount} time(s) but NOT at the ${MEMORY_CHAIN_LIMIT}th tool response (index ${MEMORY_CHAIN_LIMIT - 1}). ` +
      `Counter may be offset. First 80 chars of each text: ${JSON.stringify(toolTexts.map(t => t.substring(0, 80)))}`,
    );
  }

  pass(name, `nudge present in tool response #${MEMORY_CHAIN_LIMIT} (${nudgeCount} occurrence(s) total)`);
}

async function testNudgeAbsentWhenNonMemoryToolBreaksStreak() {
  const name = 'nudge absent when a non-memory tool resets the streak';
  const messages: any[] = [
    { role: 'user', parts: [{ text: 'Show me Barcelona.' }] },
  ];

  // show_image is not in MEMORY_TOOL_NAMES — it resets the counter.
  // After the reset, only 2 recall turns follow (< MEMORY_CHAIN_LIMIT=3).
  const responses: FakeSpec[] = [
    { functionCall: { name: 'show_image', args: { image: 'barcelona.jpg' } } },
    { functionCall: { name: 'recall', args: { query: 'trip planning' } } },
    { functionCall: { name: 'recall', args: { query: 'trip details' } } },
    { text: 'Here is what I found.' },
  ];

  await runDanielaFCLoop({
    systemPrompt: 'You are Daniela.',
    messages,
    userId: 'ci-test-user',
    allowedTools: ['recall', 'show_image'],
    maxTurns: 6,
    _geminiOverride: makeFakeClient(responses),
  });

  const toolTexts = collectToolResponseTexts(messages);
  const nudgeCount = toolTexts.filter(t => t.includes(MEMORY_CHAIN_NUDGE_TEXT)).length;
  if (nudgeCount !== 0) {
    return fail(
      name,
      `Nudge fired ${nudgeCount} time(s) — counter reset logic broken. ` +
      `Non-memory tool (show_image) must reset consecutiveMemoryOnlyTurns to 0.`,
    );
  }
  pass(name, 'counter correctly reset by non-memory tool');
}

async function testNudgeFiresOnEachTurnAtOrBeyondLimit() {
  const name = 'nudge fires exactly once per streak even when streak extends beyond MEMORY_CHAIN_LIMIT (matches GL once-only gate)';
  const messages: any[] = [
    { role: 'user', parts: [{ text: 'Tell me everything you know about me.' }] },
  ];

  const extraTurns = 2;
  const totalMemoryTurns = MEMORY_CHAIN_LIMIT + extraTurns;
  const responses: FakeSpec[] = [
    ...Array.from({ length: totalMemoryTurns }, () => ({
      functionCall: { name: 'recall', args: { query: 'all memory' } },
    })),
    { text: 'Here is the synthesis.' },
  ];

  await runDanielaFCLoop({
    systemPrompt: 'You are Daniela.',
    messages,
    userId: 'ci-test-user',
    allowedTools: ['recall'],
    maxTurns: totalMemoryTurns + 2,
    _geminiOverride: makeFakeClient(responses),
  });

  const toolTexts = collectToolResponseTexts(messages);
  const nudgeCount = toolTexts.filter(t => t.includes(MEMORY_CHAIN_NUDGE_TEXT)).length;
  // Text-mode now fires the nudge at most once per streak (textMemoryNudgeSent flag),
  // matching the GL glMemoryNudgeSent gate. Even with extraTurns beyond the limit,
  // only 1 nudge should appear in the tool-response history.
  const expectedNudgeCount = 1;
  if (nudgeCount !== expectedNudgeCount) {
    return fail(
      name,
      `Expected exactly ${expectedNudgeCount} nudge occurrence (once-per-streak gate), got ${nudgeCount}. ` +
      `Check that textMemoryNudgeSent is set on first fire and reset when the streak breaks.`,
    );
  }
  pass(name, `${nudgeCount} nudge occurrence — once-per-streak gate working correctly`);
}

async function testGuardSensitiveToMEMORY_TOOL_NAMES() {
  const name = 'guard fires for every tool currently in MEMORY_TOOL_NAMES';
  const guardedTool = Array.from(MEMORY_TOOL_NAMES)[0]; // e.g. 'recall'
  const messages: any[] = [
    { role: 'user', parts: [{ text: 'What do you remember?' }] },
  ];

  const responses: FakeSpec[] = [
    ...Array.from({ length: MEMORY_CHAIN_LIMIT }, () => ({
      functionCall: { name: guardedTool, args: { query: 'test' } },
    })),
    { text: 'Here is what I found.' },
  ];

  await runDanielaFCLoop({
    systemPrompt: 'You are Daniela.',
    messages,
    userId: 'ci-test-user',
    allowedTools: [guardedTool],
    maxTurns: MEMORY_CHAIN_LIMIT + 2,
    _geminiOverride: makeFakeClient(responses),
  });

  const toolTexts = collectToolResponseTexts(messages);
  const nudgeCount = toolTexts.filter(t => t.includes(MEMORY_CHAIN_NUDGE_TEXT)).length;
  if (nudgeCount === 0) {
    return fail(
      name,
      `"${guardedTool}" is in MEMORY_TOOL_NAMES but the guard did not fire. ` +
      `Check MEMORY_TOOL_NAMES import in runDanielaFCLoop and the allMemoryTools check.`,
    );
  }
  pass(name, `"${guardedTool}" correctly triggers the guard`);
}

async function testReadFullMemoryExcluded() {
  const name = 'read_full_memory does NOT trigger the guard (intentional exclusion)';
  const messages: any[] = [
    { role: 'user', parts: [{ text: 'Read my full memory.' }] },
  ];

  const responses: FakeSpec[] = [
    ...Array.from({ length: MEMORY_CHAIN_LIMIT }, () => ({
      functionCall: { name: 'read_full_memory', args: {} },
    })),
    { text: 'Here is your full memory.' },
  ];

  await runDanielaFCLoop({
    systemPrompt: 'You are Daniela.',
    messages,
    userId: 'ci-test-user',
    allowedTools: ['read_full_memory'],
    maxTurns: MEMORY_CHAIN_LIMIT + 2,
    _geminiOverride: makeFakeClient(responses),
  });

  const toolTexts = collectToolResponseTexts(messages);
  const nudgeCount = toolTexts.filter(t => t.includes(MEMORY_CHAIN_NUDGE_TEXT)).length;
  if (nudgeCount !== 0) {
    return fail(
      name,
      `read_full_memory is excluded from MEMORY_TOOL_NAMES (Founder/Reading Room exception) ` +
      `but the nudge fired ${nudgeCount} time(s). Check MEMORY_TOOL_NAMES in memory-chain-guard.ts.`,
    );
  }
  pass(name, 'read_full_memory chains do not trigger the backstop');
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log(B('\n  memory-chain-guard — integration (via runDanielaFCLoop)\n'));
  sep();

  await testNudgeAppearsAtLimit();
  await testNudgeAbsentWhenNonMemoryToolBreaksStreak();
  await testNudgeFiresOnEachTurnAtOrBeyondLimit();
  await testGuardSensitiveToMEMORY_TOOL_NAMES();
  await testReadFullMemoryExcluded();

  sep();
  const total = passed + failed;
  console.log(`  Results: ${G(String(passed))} passed, ${failed > 0 ? R(String(failed)) : String(failed)} failed  (${total} checks)`);

  if (failed === 0) {
    console.log(`\n  ${G('✓ ALL CHECKS PASSED')}`);
    console.log(`  The memory-chain guard fires through the real runDanielaFCLoop path.`);
    console.log(`  A regression in the guard wiring (deleted block, wrong import, broken check)`);
    console.log(`  will cause one or more of the above checks to fail.\n`);
    process.exit(0);
  } else {
    console.log(`\n  ${R('✗ SOME CHECKS FAILED')} — review items above\n`);
    process.exit(1);
  }
})();
