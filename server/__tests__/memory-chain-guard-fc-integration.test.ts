/**
 * Integration tests for the text-mode memory chain guard.
 *
 * Unlike the pure simulation tests in memory-chain-guard.test.ts, these tests
 * pass a _geminiOverride fake client to the REAL runDanielaFCLoop so the actual
 * guard code in daniela-caller.ts is exercised — not a reimplementation of it.
 *
 * If textMemoryNudgeSent is ever moved, removed, or its condition changed in the
 * real loop, these tests will catch the regression even when the simulation tests
 * still pass.
 *
 * Implementation note — avoiding real DB hangs
 * ────────────────────────────────────────────
 * The `recall` tool (and other MEMORY_TOOL_NAMES tools) push async DB promises
 * into session.pendingMemoryLookupPromises. The FC loop awaits that list after
 * each tool turn. Without intervention, each fake turn would make a real Neon DB
 * query, slowing the test significantly and hanging if the pool doesn't drain.
 *
 * Fix: pass existingSession backed by a Proxy that intercepts
 * `pendingMemoryLookupPromises` reads/writes and always returns a length-0
 * no-op array. The `if (session.pendingMemoryLookupPromises?.length)` check in
 * the loop is therefore false → the await is skipped entirely per turn.
 * The background DB call fires and is abandoned when we close the pool in
 * the after() hook.
 *
 * Run with:
 *   npx tsx --test server/__tests__/memory-chain-guard-fc-integration.test.ts
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { runDanielaFCLoop, buildMockSession } from '../services/daniela-caller';
import { MEMORY_CHAIN_LIMIT, MEMORY_CHAIN_NUDGE_TEXT } from '../services/memory-chain-guard';
import { closeDbConnections } from '../db';

// ── Teardown — close DB pool and exit with the correct code ──────────────────
// Importing daniela-caller.ts pulls in modules that open long-lived handles
// (Deepgram client, Cartesia, etc.) that prevent natural process exit.
// node:test sets process.exitCode (1 on failure, 0 on success) BEFORE running
// after() hooks, so we can safely force-exit with the runner's own code here.
// This keeps CI exit status reliable: a failing assertion still propagates as
// exit code 1 even though we force the process to close.
after(async () => {
  await closeDbConnections();
  process.exit(process.exitCode ?? 0);
});

// ── Helper: build a session whose pendingMemoryLookupPromises never accumulates ─
// The FC loop reassigns `session.pendingMemoryLookupPromises = []` at the start
// of each tool turn, then the tool handler pushes a real DB promise onto it.
// The outer Proxy intercepts both the assignment (set trap) and the read (get
// trap) so the array is always our no-op proxy — push is a no-op, length is 0.
// This means `if (session.pendingMemoryLookupPromises?.length)` is always false
// and `Promise.all([])` is never awaited, preventing DB calls from blocking.
function buildNoDbSession(userId: string): any {
  const noOpList = new Proxy([] as Promise<void>[], {
    get(target, prop) {
      if (prop === 'push') return () => {}; // discard real DB promises silently
      if (prop === 'length') return 0;       // always looks empty to the await check
      return (target as any)[prop];
    },
  });

  const base = buildMockSession(userId);
  return new Proxy(base, {
    get(target, prop) {
      if (prop === 'pendingMemoryLookupPromises') return noOpList;
      return (target as any)[prop as string];
    },
    set(target, prop, value) {
      if (prop === 'pendingMemoryLookupPromises') {
        // Ignore the `= []` reset — our noOpList is always in effect
        return true;
      }
      (target as any)[prop as string] = value;
      return true;
    },
  });
}

// ── Build a fake Gemini client ────────────────────────────────────────────────
// Returns FC-only turns (memory tool, no text) for the first `memoryTurns`
// calls, then a plain text turn so the loop exits.
function buildFakeGemini(memoryTurns: number, memoryToolName = 'recall') {
  let callCount = 0;
  return {
    models: {
      generateContent: async (_args: any) => {
        const call = callCount++;
        if (call < memoryTurns) {
          return {
            candidates: [{
              content: {
                parts: [{ functionCall: { name: memoryToolName, args: { query: 'test' } } }],
              },
            }],
            text: '',
          };
        }
        return {
          candidates: [{ content: { parts: [{ text: 'Here is my answer.' }] } }],
          text: 'Here is my answer.',
        };
      },
    },
  };
}

// ── Helper: collect all tool-response texts from the messages array ────────────
function collectToolResponseTexts(messages: any[]): string[] {
  return messages
    .filter((m: any) => m.role === 'tool')
    .flatMap((m: any) => m.parts ?? [])
    .map((p: any) => p.functionResponse?.response?.output?.[0]?.text ?? '');
}

// ─────────────────────────────────────────────────────────────────────────────

describe('FC loop integration — textMemoryNudgeSent gate in real runDanielaFCLoop', () => {

  it('MEMORY_CHAIN_NUDGE_TEXT appears exactly once after MEMORY_CHAIN_LIMIT+2 consecutive memory-only turns', async () => {
    const memoryOnlyTurns = MEMORY_CHAIN_LIMIT + 2;
    const messages: any[] = [{ role: 'user', parts: [{ text: 'Tell me about yourself.' }] }];

    const result = await runDanielaFCLoop({
      systemPrompt: 'You are Daniela.',
      messages,
      userId: 'test-task-353-a',
      allowedTools: [],                      // no real tool declarations needed
      maxTurns: memoryOnlyTurns + 3,
      existingSession: buildNoDbSession('test-task-353-a'),
      _geminiOverride: buildFakeGemini(memoryOnlyTurns),
    });

    const toolResponseTexts = collectToolResponseTexts(messages);

    const nudgeCount = toolResponseTexts.filter(
      (t) => t.includes(MEMORY_CHAIN_NUDGE_TEXT),
    ).length;

    assert.equal(
      nudgeCount,
      1,
      `MEMORY_CHAIN_NUDGE_TEXT must appear exactly once across all tool-response parts. ` +
      `Got ${nudgeCount}.\nTool response texts: ${JSON.stringify(toolResponseTexts, null, 2)}`,
    );

    assert.ok(
      result.includes('Here is my answer.'),
      `runDanielaFCLoop must return the final text response. Got: "${result}"`,
    );
  });

  it('nudge does NOT appear when the streak is broken by text alongside tool calls', async () => {
    // MEMORY_CHAIN_LIMIT - 1 memory-only turns, then a turn with text + FC
    // (streak breaks at the mixed turn), then a final text turn.
    const shortStreakLength = MEMORY_CHAIN_LIMIT - 1;
    let callCount = 0;

    const fakeGemini = {
      models: {
        generateContent: async (_args: any) => {
          const call = callCount++;
          if (call < shortStreakLength) {
            // Memory-only — one short of the limit
            return {
              candidates: [{
                content: { parts: [{ functionCall: { name: 'recall', args: {} } }] },
              }],
              text: '',
            };
          }
          if (call === shortStreakLength) {
            // Text + FC in same turn → resets the consecutive counter
            return {
              candidates: [{
                content: {
                  parts: [
                    { text: 'Let me check one more thing.' },
                    { functionCall: { name: 'recall', args: {} } },
                  ],
                },
              }],
              text: 'Let me check one more thing.',
            };
          }
          return {
            candidates: [{ content: { parts: [{ text: 'All done.' }] } }],
            text: 'All done.',
          };
        },
      },
    };

    const messages: any[] = [{ role: 'user', parts: [{ text: 'Hi.' }] }];

    await runDanielaFCLoop({
      systemPrompt: 'You are Daniela.',
      messages,
      userId: 'test-task-353-b',
      allowedTools: [],
      maxTurns: shortStreakLength + 4,
      existingSession: buildNoDbSession('test-task-353-b'),
      _geminiOverride: fakeGemini,
    });

    const toolResponseTexts = collectToolResponseTexts(messages);

    const nudgeCount = toolResponseTexts.filter(
      (t) => t.includes(MEMORY_CHAIN_NUDGE_TEXT),
    ).length;

    assert.equal(
      nudgeCount,
      0,
      `Nudge must NOT fire when streak is broken before reaching MEMORY_CHAIN_LIMIT. ` +
      `Got ${nudgeCount} occurrences.\nTool response texts: ${JSON.stringify(toolResponseTexts, null, 2)}`,
    );
  });

  it('nudge fires at most once even when streak continues well past the limit', async () => {
    // MEMORY_CHAIN_LIMIT + 4 consecutive memory-only turns — nudge must fire
    // at exactly turn MEMORY_CHAIN_LIMIT and not repeat for subsequent turns.
    const memoryOnlyTurns = MEMORY_CHAIN_LIMIT + 4;
    const messages: any[] = [{ role: 'user', parts: [{ text: 'Go.' }] }];

    await runDanielaFCLoop({
      systemPrompt: 'You are Daniela.',
      messages,
      userId: 'test-task-353-c',
      allowedTools: [],
      maxTurns: memoryOnlyTurns + 3,
      existingSession: buildNoDbSession('test-task-353-c'),
      _geminiOverride: buildFakeGemini(memoryOnlyTurns),
    });

    const toolResponseTexts = collectToolResponseTexts(messages);

    const nudgeCount = toolResponseTexts.filter(
      (t) => t.includes(MEMORY_CHAIN_NUDGE_TEXT),
    ).length;

    assert.equal(
      nudgeCount,
      1,
      `Nudge must fire exactly once even with a long streak. ` +
      `Got ${nudgeCount} occurrences.\nTool response texts: ${JSON.stringify(toolResponseTexts, null, 2)}`,
    );
  });
});
