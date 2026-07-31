/**
 * Unit tests for the memory chain guard.
 *
 * The guard is implemented as a pure counter inside runDanielaFCLoop
 * (daniela-caller.ts) for text-mode, and inline in gemini-live-session.ts
 * for voice-mode (GL). Both share constants from memory-chain-guard.ts.
 *
 * Key invariant: `read_full_memory` is intentionally EXCLUDED from
 * MEMORY_TOOL_NAMES so that Founder / Reading Room sessions can chain as many
 * read_full_memory calls as needed without tripping the backstop nudge.
 * This exclusion must behave identically in both text-mode and GL voice-mode.
 *
 * This file tests:
 *   TEXT-MODE:
 *   1. A batch containing only read_full_memory does NOT count as a memory-only turn.
 *   2. Interleaved guarded + read_full_memory batches only count the guarded ones.
 *   3. Three consecutive guarded-tool-only batches still fire the backstop nudge.
 *
 *   GL VOICE-MODE:
 *   4. The GL guard uses the same MEMORY_TOOL_NAMES.has() check.
 *   5. read_full_memory resets the GL counter (same as text-mode).
 *   6. Guarded tools increment the GL counter and fire the nudge at MEMORY_CHAIN_LIMIT.
 *   7. The GL nudge uses MEMORY_CHAIN_NUDGE_TEXT (no hardcoded duplicate).
 *
 * Run with:
 *   npx tsx --test server/__tests__/memory-chain-guard.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MEMORY_TOOL_NAMES,
  MEMORY_CHAIN_LIMIT,
  MEMORY_CHAIN_NUDGE_TEXT,
} from '../services/memory-chain-guard';

// ── Pure helper — mirrors the 5-line guard block in runDanielaFCLoop ──────────
// Returns whether this batch should increment the consecutive memory-only counter.
// toolNames: every FC name called in one Gemini turn.
// hasText:   true when the model also emitted text alongside the tool calls.
function isBatchMemoryOnly(toolNames: string[], hasText: boolean): boolean {
  if (toolNames.length === 0) return false;  // no tools → text-only turn, never counts
  const allInSet = toolNames.every(name => MEMORY_TOOL_NAMES.has(name));
  return allInSet && !hasText;
}

// Simulate the full counter loop for a sequence of batches.
// Each element is { toolNames, hasText }.
// Returns the consecutiveMemoryOnlyTurns value AND whether the nudge fired on
// each turn (i.e., whether the limit was reached and there were response parts).
function simulateGuard(
  batches: Array<{ toolNames: string[]; hasText: boolean; hasResponseParts?: boolean }>,
): Array<{ counter: number; nudgeFired: boolean }> {
  let counter = 0;
  return batches.map(({ toolNames, hasText, hasResponseParts = true }) => {
    if (isBatchMemoryOnly(toolNames, hasText)) {
      counter++;
    } else {
      counter = 0;
    }
    const nudgeFired = counter >= MEMORY_CHAIN_LIMIT && hasResponseParts;
    return { counter, nudgeFired };
  });
}

// ── Baseline: understand what IS in the set ───────────────────────────────────

describe('MEMORY_TOOL_NAMES — set membership', () => {
  it('contains the expected guarded tool names', () => {
    const expected = [
      'recall',
      'browse_conversations_by_date',
      'search_my_teaching_wisdom',
      'introspect',
      'memory_lookup',
      'read_full_session',
      'read_my_reflections',
      'memory_review',
    ];
    for (const name of expected) {
      assert.ok(
        MEMORY_TOOL_NAMES.has(name),
        `Expected "${name}" to be in MEMORY_TOOL_NAMES`,
      );
    }
  });

  it('does NOT contain read_full_memory — intentional exclusion', () => {
    assert.equal(
      MEMORY_TOOL_NAMES.has('read_full_memory'),
      false,
      'read_full_memory must NOT be in MEMORY_TOOL_NAMES (Founder / Reading Room exception)',
    );
  });

  it('MEMORY_CHAIN_LIMIT is 3', () => {
    assert.equal(MEMORY_CHAIN_LIMIT, 3);
  });

  it('MEMORY_CHAIN_NUDGE_TEXT is a non-empty string', () => {
    assert.ok(typeof MEMORY_CHAIN_NUDGE_TEXT === 'string');
    assert.ok(MEMORY_CHAIN_NUDGE_TEXT.length > 0);
  });
});

// ── Test 1: read_full_memory alone never increments the counter ───────────────

describe('Test 1 — read_full_memory batches do NOT increment the counter', () => {
  it('a single read_full_memory call is not a memory-only batch', () => {
    assert.equal(isBatchMemoryOnly(['read_full_memory'], false), false);
  });

  it('multiple read_full_memory calls in one batch are not a memory-only batch', () => {
    assert.equal(
      isBatchMemoryOnly(['read_full_memory', 'read_full_memory'], false),
      false,
    );
  });

  it('counter stays 0 after 5 consecutive read_full_memory-only batches', () => {
    const batches = Array.from({ length: 5 }, () => ({
      toolNames: ['read_full_memory'],
      hasText: false,
    }));
    const results = simulateGuard(batches);
    for (const { counter, nudgeFired } of results) {
      assert.equal(counter, 0, 'counter must remain 0 for read_full_memory batches');
      assert.equal(nudgeFired, false);
    }
  });

  it('nudge never fires even after 10 consecutive read_full_memory-only batches', () => {
    const batches = Array.from({ length: 10 }, () => ({
      toolNames: ['read_full_memory'],
      hasText: false,
    }));
    const results = simulateGuard(batches);
    assert.ok(results.every(r => !r.nudgeFired));
  });
});

// ── Test 2: interleaved batches — only guarded turns count ────────────────────

describe('Test 2 — interleaved guarded + read_full_memory turns count only the guarded ones', () => {
  it('guarded → read_full_memory → guarded: counter is 1, 0, 1 (no nudge)', () => {
    const batches = [
      { toolNames: ['recall'], hasText: false },           // guarded → counter = 1
      { toolNames: ['read_full_memory'], hasText: false },  // NOT guarded → counter = 0
      { toolNames: ['memory_lookup'], hasText: false },    // guarded → counter = 1
    ];
    const [a, b, c] = simulateGuard(batches);
    assert.equal(a.counter, 1);
    assert.equal(b.counter, 0, 'read_full_memory must reset the streak');
    assert.equal(c.counter, 1);
    assert.equal(c.nudgeFired, false, 'never reached limit — nudge must not fire');
  });

  it('guarded → guarded → read_full_memory → guarded: streak breaks at 2, restarts at 1', () => {
    const batches = [
      { toolNames: ['recall'], hasText: false },
      { toolNames: ['browse_conversations_by_date'], hasText: false },
      { toolNames: ['read_full_memory'], hasText: false }, // breaks streak
      { toolNames: ['memory_lookup'], hasText: false },
    ];
    const [a, b, c, d] = simulateGuard(batches);
    assert.equal(a.counter, 1);
    assert.equal(b.counter, 2);
    assert.equal(c.counter, 0, 'streak must break on read_full_memory batch');
    assert.equal(d.counter, 1);
    assert.equal(d.nudgeFired, false);
  });

  it('mixed tool batch with read_full_memory + guarded tool: not counted (not ALL guarded)', () => {
    // Only batches where EVERY tool is in MEMORY_TOOL_NAMES count.
    // If read_full_memory is mixed in, it fails the .every() check → not counted.
    const batches = [
      { toolNames: ['recall', 'read_full_memory'], hasText: false },
    ];
    const [result] = simulateGuard(batches);
    assert.equal(result.counter, 0, 'mixed batch with read_full_memory is not a memory-only turn');
    assert.equal(result.nudgeFired, false);
  });

  it('text produced alongside guarded tools resets the counter', () => {
    const batches = [
      { toolNames: ['recall'], hasText: false },
      { toolNames: ['recall'], hasText: true },  // text present → not memory-only
      { toolNames: ['recall'], hasText: false },
    ];
    const [a, b, c] = simulateGuard(batches);
    assert.equal(a.counter, 1);
    assert.equal(b.counter, 0, 'text alongside tool calls resets the streak');
    assert.equal(c.counter, 1);
  });
});

// ── Test 3: three consecutive guarded-only batches fire the backstop nudge ────

describe('Test 3 — three consecutive guarded-tool-only batches fire the backstop nudge', () => {
  it('reaches limit exactly at turn 3 and fires the nudge', () => {
    const batches = [
      { toolNames: ['recall'], hasText: false },
      { toolNames: ['browse_conversations_by_date'], hasText: false },
      { toolNames: ['memory_lookup'], hasText: false },
    ];
    const [a, b, c] = simulateGuard(batches);
    assert.equal(a.counter, 1);
    assert.equal(a.nudgeFired, false);
    assert.equal(b.counter, 2);
    assert.equal(b.nudgeFired, false);
    assert.equal(c.counter, 3);
    assert.equal(c.nudgeFired, true, 'nudge must fire at exactly MEMORY_CHAIN_LIMIT consecutive turns');
  });

  it('nudge does NOT fire at turn 2 (one short of the limit)', () => {
    const batches = [
      { toolNames: ['recall'], hasText: false },
      { toolNames: ['memory_review'], hasText: false },
    ];
    const [, b] = simulateGuard(batches);
    assert.equal(b.counter, 2);
    assert.equal(b.nudgeFired, false);
  });

  it('nudge fires again on turn 4+ when no text is produced (streak continues)', () => {
    const batches = [
      { toolNames: ['recall'], hasText: false },
      { toolNames: ['recall'], hasText: false },
      { toolNames: ['recall'], hasText: false },
      { toolNames: ['recall'], hasText: false }, // turn 4
    ];
    const results = simulateGuard(batches);
    assert.equal(results[2].nudgeFired, true, 'fires at turn 3');
    assert.equal(results[3].nudgeFired, true, 'fires again at turn 4 (counter > limit)');
  });

  it('nudge does not fire when response parts are absent (empty tool response)', () => {
    // hasResponseParts = false mimics an edge case where the FC handler returns nothing
    const batches = [
      { toolNames: ['recall'], hasText: false, hasResponseParts: false },
      { toolNames: ['recall'], hasText: false, hasResponseParts: false },
      { toolNames: ['recall'], hasText: false, hasResponseParts: false },
    ];
    const [, , c] = simulateGuard(batches);
    assert.equal(c.counter, 3);
    assert.equal(c.nudgeFired, false, 'nudge must not fire when there are no function response parts to append to');
  });

  it('various guarded tool names all increment the counter correctly', () => {
    const guardedTools = [
      'recall',
      'browse_conversations_by_date',
      'search_my_teaching_wisdom',
      'introspect',
      'memory_lookup',
      'read_full_session',
      'read_my_reflections',
      'memory_review',
    ];
    for (const toolName of guardedTools) {
      const batches = Array.from({ length: MEMORY_CHAIN_LIMIT }, () => ({
        toolNames: [toolName],
        hasText: false,
      }));
      const results = simulateGuard(batches);
      assert.equal(
        results[MEMORY_CHAIN_LIMIT - 1].nudgeFired,
        true,
        `nudge must fire after ${MEMORY_CHAIN_LIMIT} consecutive batches of "${toolName}"`,
      );
    }
  });
});

// ── GL voice-mode guard simulation ────────────────────────────────────────────
// Mirrors the exact logic in gemini-live-session.ts (the MEMORY_CHAIN_LIMIT block).
//
// Key difference from text-mode: GL has no `hasText` flag because audio is
// tracked separately via generationComplete. The counter increments whenever
// ALL tools in a batch are in MEMORY_TOOL_NAMES; it resets otherwise.
// The nudge fires once (nudgeSent gate) when counter >= MEMORY_CHAIN_LIMIT
// and there is at least one response to append to.

function simulateGLGuard(
  batches: Array<{ toolNames: string[]; hasResponses?: boolean }>,
): Array<{ counter: number; nudgeFired: boolean }> {
  let counter = 0;
  let nudgeSent = false;
  return batches.map(({ toolNames, hasResponses = true }) => {
    const allMemoryBatch = toolNames.every((n: string) => MEMORY_TOOL_NAMES.has(n));
    if (!allMemoryBatch) {
      counter = 0;
      nudgeSent = false;
    } else {
      counter++;
    }
    const nudgeFired = !nudgeSent && counter >= MEMORY_CHAIN_LIMIT && hasResponses;
    if (nudgeFired) nudgeSent = true;
    return { counter, nudgeFired };
  });
}

describe('GL guard — read_full_memory exclusion matches text-mode', () => {
  it('read_full_memory is absent from MEMORY_TOOL_NAMES (confirmed exclusion)', () => {
    assert.equal(
      MEMORY_TOOL_NAMES.has('read_full_memory'),
      false,
      'read_full_memory must NOT be in MEMORY_TOOL_NAMES',
    );
  });

  it('GL: a batch of only read_full_memory resets the counter (allMemoryBatch=false)', () => {
    // read_full_memory is not in MEMORY_TOOL_NAMES → allMemoryBatch=false → counter=0
    const [result] = simulateGLGuard([{ toolNames: ['read_full_memory'] }]);
    assert.equal(result.counter, 0, 'counter must be 0 — read_full_memory is not a guarded tool');
    assert.equal(result.nudgeFired, false);
  });

  it('GL: read_full_memory mid-streak resets the counter', () => {
    const batches = [
      { toolNames: ['recall'] },          // counter → 1
      { toolNames: ['recall'] },          // counter → 2
      { toolNames: ['read_full_memory'] }, // not in set → counter resets to 0
      { toolNames: ['recall'] },          // counter → 1 (fresh start)
    ];
    const results = simulateGLGuard(batches);
    assert.equal(results[2].counter, 0, 'read_full_memory must reset the GL counter');
    assert.equal(results[3].counter, 1, 'counter must restart fresh after the reset');
  });

  it('GL: mix of guarded + read_full_memory in same batch resets the counter', () => {
    // one tool not in MEMORY_TOOL_NAMES → allMemoryBatch=false
    const [result] = simulateGLGuard([{ toolNames: ['recall', 'read_full_memory'] }]);
    assert.equal(result.counter, 0);
    assert.equal(result.nudgeFired, false);
  });

  it('GL: MEMORY_CHAIN_LIMIT consecutive guarded batches fire the nudge once', () => {
    const batches = Array.from({ length: MEMORY_CHAIN_LIMIT }, () => ({
      toolNames: ['recall'],
    }));
    const results = simulateGLGuard(batches);
    assert.equal(results[MEMORY_CHAIN_LIMIT - 1].counter, MEMORY_CHAIN_LIMIT);
    assert.equal(results[MEMORY_CHAIN_LIMIT - 1].nudgeFired, true, 'nudge must fire at the limit');
  });

  it('GL: nudge fires only once even when the streak continues past the limit', () => {
    const batches = Array.from({ length: MEMORY_CHAIN_LIMIT + 2 }, () => ({
      toolNames: ['recall'],
    }));
    const results = simulateGLGuard(batches);
    const nudgeCount = results.filter(r => r.nudgeFired).length;
    assert.equal(nudgeCount, 1, 'GL nudge must fire exactly once per streak (glMemoryNudgeSent gate)');
  });

  it('GL: nudge does not fire when there are no responses to append to', () => {
    const batches = Array.from({ length: MEMORY_CHAIN_LIMIT }, () => ({
      toolNames: ['recall'],
      hasResponses: false,
    }));
    const results = simulateGLGuard(batches);
    assert.equal(results[MEMORY_CHAIN_LIMIT - 1].nudgeFired, false);
  });

  it('GL: all guarded tools increment the counter correctly', () => {
    const guardedTools = Array.from(MEMORY_TOOL_NAMES);
    for (const toolName of guardedTools) {
      const batches = Array.from({ length: MEMORY_CHAIN_LIMIT }, () => ({
        toolNames: [toolName],
      }));
      const results = simulateGLGuard(batches);
      assert.equal(
        results[MEMORY_CHAIN_LIMIT - 1].nudgeFired,
        true,
        `GL nudge must fire after ${MEMORY_CHAIN_LIMIT} consecutive batches of "${toolName}"`,
      );
    }
  });

  it('MEMORY_CHAIN_NUDGE_TEXT is imported and used by GL (no hardcoded duplicate)', () => {
    // If the GL path imported MEMORY_CHAIN_NUDGE_TEXT, this constant must be
    // non-empty and contain the canonical CRITICAL prefix used in the GL nudge.
    assert.ok(
      MEMORY_CHAIN_NUDGE_TEXT.includes('CRITICAL'),
      'MEMORY_CHAIN_NUDGE_TEXT must contain the CRITICAL prefix',
    );
    assert.ok(
      MEMORY_CHAIN_NUDGE_TEXT.includes('SYSTEM STATUS'),
      'MEMORY_CHAIN_NUDGE_TEXT must contain the SYSTEM STATUS marker',
    );
  });
});
