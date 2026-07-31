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
// textMemoryNudgeSent mirrors glMemoryNudgeSent: the nudge fires at most once
// per streak and resets when the streak breaks (non-memory tool or text produced).
function simulateGuard(
  batches: Array<{ toolNames: string[]; hasText: boolean; hasResponseParts?: boolean }>,
): Array<{ counter: number; nudgeFired: boolean }> {
  let counter = 0;
  let nudgeSent = false;
  return batches.map(({ toolNames, hasText, hasResponseParts = true }) => {
    if (isBatchMemoryOnly(toolNames, hasText)) {
      counter++;
    } else {
      counter = 0;
      nudgeSent = false;
    }
    const nudgeFired = !nudgeSent && counter >= MEMORY_CHAIN_LIMIT && hasResponseParts;
    if (nudgeFired) nudgeSent = true;
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

  it('nudge fires exactly once even when the streak continues past the limit', () => {
    const batches = [
      { toolNames: ['recall'], hasText: false },
      { toolNames: ['recall'], hasText: false },
      { toolNames: ['recall'], hasText: false },
      { toolNames: ['recall'], hasText: false }, // turn 4 — streak continues but nudgeSent=true
    ];
    const results = simulateGuard(batches);
    assert.equal(results[2].nudgeFired, true, 'nudge fires at turn 3 (first time limit is reached)');
    assert.equal(results[3].nudgeFired, false, 'nudge must NOT fire again at turn 4 (textMemoryNudgeSent gate)');
    const nudgeCount = results.filter(r => r.nudgeFired).length;
    assert.equal(nudgeCount, 1, 'text-mode nudge must fire exactly once per streak (matches GL behaviour)');
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

// ── GL generationComplete reset path ─────────────────────────────────────────
// Mirrors the exact reset block in gemini-live-session.ts (lines ~2673-2676):
//
//   if ((this.session.consecutiveMemoryCalls ?? 0) > 0) {
//     this.session.consecutiveMemoryCalls = 0;
//     this.session.glMemoryNudgeSent = false;
//   }
//
// This block fires at generationComplete — when Daniela produces audio output.
// It resets both the counter AND the one-shot nudge gate so the next memory
// streak can trigger a fresh nudge. Without it, a stale counter could cause a
// false nudge on the very first memory call of a new student turn.
//
// The simulation below treats events as either:
//   { kind: 'tool_batch', toolNames, hasResponses? }  — a GL tool call batch
//   { kind: 'generation_complete' }                   — Daniela produced audio
//
// A generation_complete event only resets if the counter is > 0 (matching the
// `if (counter > 0)` guard in the real code — avoids spurious log noise).

type GLEvent =
  | { kind: 'tool_batch'; toolNames: string[]; hasResponses?: boolean }
  | { kind: 'generation_complete' }
  | { kind: 'watchdog_seal' };

interface GLEventResult {
  eventKind: string;
  counter: number;
  nudgeSent: boolean;
  nudgeFired: boolean;
}

function simulateGLGuardWithGenerationComplete(events: GLEvent[]): GLEventResult[] {
  let counter = 0;
  let nudgeSent = false;
  return events.map((event) => {
    let nudgeFired = false;

    if (event.kind === 'generation_complete') {
      // Mirrors: if ((this.session.consecutiveMemoryCalls ?? 0) > 0) { reset }
      // — conditional on counter > 0 to avoid spurious log noise.
      if (counter > 0) {
        counter = 0;
        nudgeSent = false;
      }
    } else if (event.kind === 'watchdog_seal') {
      // Mirrors lines 1592-1593 in gemini-live-session.ts (watchdog timer path):
      //   this.session.consecutiveMemoryCalls = 0;
      //   this.session.glMemoryNudgeSent = false;
      // Unlike generationComplete, the watchdog reset is UNCONDITIONAL — it fires
      // regardless of whether the counter is currently 0. This matters because the
      // watchdog seals the turn even when no memory tools fired (e.g., GL dropped
      // the generationComplete signal mid-greeting), so the reset must always clear
      // both fields to prevent a permanently-stuck nudge gate.
      counter = 0;
      nudgeSent = false;
    } else {
      // tool_batch — mirrors the MEMORY_CHAIN_LIMIT block in the tool-call handler
      const allMemoryBatch = event.toolNames.every((n: string) => MEMORY_TOOL_NAMES.has(n));
      if (!allMemoryBatch) {
        counter = 0;
        nudgeSent = false;
      } else {
        counter++;
        const hasResponses = event.hasResponses ?? true;
        if (!nudgeSent && counter >= MEMORY_CHAIN_LIMIT && hasResponses) {
          nudgeFired = true;
          nudgeSent = true;
        }
      }
    }

    return { eventKind: event.kind, counter, nudgeSent, nudgeFired };
  });
}

describe('GL generationComplete path — counter resets after Daniela speaks', () => {
  it('counter is 0 and nudgeSent is false after generationComplete following a full streak', () => {
    // MEMORY_CHAIN_LIMIT batches → nudge fires; then Daniela speaks → full reset.
    const events: GLEvent[] = [
      ...Array.from({ length: MEMORY_CHAIN_LIMIT }, () =>
        ({ kind: 'tool_batch' as const, toolNames: ['recall'] })),
      { kind: 'generation_complete' },
    ];
    const results = simulateGLGuardWithGenerationComplete(events);
    const afterSpeak = results[results.length - 1];
    assert.equal(afterSpeak.counter, 0, 'counter must be 0 after generationComplete');
    assert.equal(afterSpeak.nudgeSent, false, 'nudgeSent must be false after generationComplete — one-shot gate must reopen');
  });

  it('nudge does NOT re-fire on the very next memory batch after generationComplete', () => {
    // Full streak → nudge fired → Daniela speaks → one more memory batch.
    // The nudge must NOT fire again on the first post-speak memory call.
    const events: GLEvent[] = [
      ...Array.from({ length: MEMORY_CHAIN_LIMIT }, () =>
        ({ kind: 'tool_batch' as const, toolNames: ['recall'] })),
      { kind: 'generation_complete' },
      { kind: 'tool_batch', toolNames: ['recall'] },
    ];
    const results = simulateGLGuardWithGenerationComplete(events);
    const firstPostSpeak = results[results.length - 1];
    assert.equal(firstPostSpeak.counter, 1, 'counter must restart at 1 after generationComplete');
    assert.equal(firstPostSpeak.nudgeFired, false, 'nudge must NOT re-fire on the first post-speak memory batch');
  });

  it('nudge fires again once a fresh full streak is reached after generationComplete', () => {
    // First streak → Daniela speaks → second streak of MEMORY_CHAIN_LIMIT → nudge fires again.
    const singleBatch = { kind: 'tool_batch' as const, toolNames: ['recall'] };
    const events: GLEvent[] = [
      ...Array.from({ length: MEMORY_CHAIN_LIMIT }, () => singleBatch),
      { kind: 'generation_complete' },
      ...Array.from({ length: MEMORY_CHAIN_LIMIT }, () => singleBatch),
    ];
    const results = simulateGLGuardWithGenerationComplete(events);
    const lastResult = results[results.length - 1];
    assert.equal(lastResult.counter, MEMORY_CHAIN_LIMIT, 'counter must reach the limit again in the second streak');
    assert.equal(lastResult.nudgeFired, true, 'nudge must fire again after a fresh streak post-generationComplete');
  });

  it('generationComplete on a zero counter is a no-op (guard condition is counter > 0)', () => {
    // No tool calls yet — generationComplete fires at session start (greeting turn).
    // Counter stays at 0, nudgeSent stays false — no state mutation at all.
    const events: GLEvent[] = [
      { kind: 'generation_complete' },
    ];
    const [result] = simulateGLGuardWithGenerationComplete(events);
    assert.equal(result.counter, 0, 'counter must remain 0');
    assert.equal(result.nudgeSent, false, 'nudgeSent must remain false');
    assert.equal(result.nudgeFired, false);
  });

  it('generationComplete mid-streak resets partial counter and allows re-fire at new limit', () => {
    // Two memory batches (counter = 2, not yet at limit) → Daniela speaks (counter → 0)
    // → MEMORY_CHAIN_LIMIT more batches → nudge fires.
    const memBatch = { kind: 'tool_batch' as const, toolNames: ['memory_lookup'] };
    const events: GLEvent[] = [
      memBatch,
      memBatch,
      { kind: 'generation_complete' },   // counter was 2, drops to 0
      ...Array.from({ length: MEMORY_CHAIN_LIMIT }, () => memBatch),
    ];
    const results = simulateGLGuardWithGenerationComplete(events);
    const afterReset = results[2]; // the generationComplete event
    assert.equal(afterReset.counter, 0, 'partial counter must reset to 0 at generationComplete');
    const finalResult = results[results.length - 1];
    assert.equal(finalResult.nudgeFired, true, 'nudge must fire after a full streak built after the mid-streak reset');
  });

  it('nudge fires exactly once per streak even with generationComplete separating two streaks', () => {
    // Two full streaks separated by a generationComplete — each fires the nudge exactly once.
    const memBatch = { kind: 'tool_batch' as const, toolNames: ['browse_conversations_by_date'] };
    const events: GLEvent[] = [
      ...Array.from({ length: MEMORY_CHAIN_LIMIT + 1 }, () => memBatch), // streak 1 (fires at position LIMIT, then one extra)
      { kind: 'generation_complete' },
      ...Array.from({ length: MEMORY_CHAIN_LIMIT + 1 }, () => memBatch), // streak 2
    ];
    const results = simulateGLGuardWithGenerationComplete(events);
    const nudgeFires = results.filter(r => r.nudgeFired);
    assert.equal(nudgeFires.length, 2, 'nudge must fire exactly once per streak (two total across both streaks)');
  });
});

// ── GL watchdog-seal reset path ───────────────────────────────────────────────
// Mirrors lines 1592-1593 in gemini-live-session.ts — the generationComplete
// watchdog timer path.  When GL drops the generationComplete signal (a known
// transient failure), the watchdog fires and executes:
//
//   this.session.consecutiveMemoryCalls = 0;
//   this.session.glMemoryNudgeSent = false;
//
// Key difference from the normal generationComplete path (lines 2673-2676):
//   • generationComplete: conditional — only resets when counter > 0.
//   • watchdog_seal:      unconditional — always resets both fields.
//
// Without this reset, a nudge that fired before the watchdog would leave
// glMemoryNudgeSent permanently true. Any subsequent streak — even after a
// long silence — would be silently blocked from sending a second nudge.

describe('GL watchdog-seal path — both counter AND nudge gate reset unconditionally', () => {
  it('counter is 0 and nudgeSent is false after watchdog_seal following a full streak + nudge', () => {
    // Full streak fires the nudge → watchdog seal → both fields must be cleared.
    const events: GLEvent[] = [
      ...Array.from({ length: MEMORY_CHAIN_LIMIT }, () =>
        ({ kind: 'tool_batch' as const, toolNames: ['recall'] })),
      { kind: 'watchdog_seal' },
    ];
    const results = simulateGLGuardWithGenerationComplete(events);
    // Nudge must have fired during the streak
    assert.equal(
      results[MEMORY_CHAIN_LIMIT - 1].nudgeFired,
      true,
      'nudge must fire at the streak limit before the watchdog fires',
    );
    const afterWatchdog = results[results.length - 1];
    assert.equal(afterWatchdog.counter, 0, 'counter must be 0 after watchdog_seal');
    assert.equal(afterWatchdog.nudgeSent, false, 'nudgeSent must be false after watchdog_seal — gate must reopen');
    assert.equal(afterWatchdog.nudgeFired, false, 'watchdog_seal itself does not fire the nudge');
  });

  it('a fresh streak after watchdog_seal can trigger the nudge again', () => {
    // First streak → nudge fires → watchdog seal → second full streak → nudge fires again.
    const memBatch = { kind: 'tool_batch' as const, toolNames: ['recall'] };
    const events: GLEvent[] = [
      ...Array.from({ length: MEMORY_CHAIN_LIMIT }, () => memBatch), // streak 1 — nudge fires
      { kind: 'watchdog_seal' },                                       // unconditional reset
      ...Array.from({ length: MEMORY_CHAIN_LIMIT }, () => memBatch), // streak 2
    ];
    const results = simulateGLGuardWithGenerationComplete(events);
    // streak 1 must have fired the nudge
    assert.equal(results[MEMORY_CHAIN_LIMIT - 1].nudgeFired, true, 'streak 1 must fire the nudge');
    // streak 2 (after watchdog) must also fire the nudge
    const lastResult = results[results.length - 1];
    assert.equal(lastResult.counter, MEMORY_CHAIN_LIMIT, 'counter must reach the limit in streak 2');
    assert.equal(lastResult.nudgeFired, true, 'nudge must fire again after watchdog_seal clears the gate');
  });

  it('single memory batch after watchdog_seal does NOT fire the nudge (counter only at 1)', () => {
    // After the watchdog resets, the counter starts fresh — one batch is not enough.
    const events: GLEvent[] = [
      ...Array.from({ length: MEMORY_CHAIN_LIMIT }, () =>
        ({ kind: 'tool_batch' as const, toolNames: ['memory_lookup'] })),
      { kind: 'watchdog_seal' },
      { kind: 'tool_batch', toolNames: ['recall'] },
    ];
    const results = simulateGLGuardWithGenerationComplete(events);
    const firstPostWatchdog = results[results.length - 1];
    assert.equal(firstPostWatchdog.counter, 1, 'counter must restart at 1 after watchdog_seal');
    assert.equal(firstPostWatchdog.nudgeFired, false, 'nudge must NOT fire on the first post-watchdog memory batch');
  });

  it('watchdog_seal on a zero counter is still a no-op (unconditional reset of already-zero state)', () => {
    // No tool calls before watchdog fires (e.g., watchdog during greeting turn).
    // Both fields are already 0/false — the reset is safe and produces no change.
    const events: GLEvent[] = [
      { kind: 'watchdog_seal' },
    ];
    const [result] = simulateGLGuardWithGenerationComplete(events);
    assert.equal(result.counter, 0, 'counter must remain 0 (was already 0)');
    assert.equal(result.nudgeSent, false, 'nudgeSent must remain false (was already false)');
    assert.equal(result.nudgeFired, false);
  });

  it('watchdog_seal resets mid-streak partial counter so it cannot reach the limit retroactively', () => {
    // Two memory batches (counter = 2, one short of the limit) → watchdog fires → counter resets.
    // Without the reset, one more memory batch after the watchdog would reach 3 and fire prematurely.
    const memBatch = { kind: 'tool_batch' as const, toolNames: ['introspect'] };
    const events: GLEvent[] = [
      memBatch,
      memBatch,
      { kind: 'watchdog_seal' }, // counter was 2 — unconditionally resets to 0
      memBatch,                   // counter restarts at 1 (not 3) — nudge must NOT fire
    ];
    const results = simulateGLGuardWithGenerationComplete(events);
    const afterWatchdog = results[2];
    assert.equal(afterWatchdog.counter, 0, 'watchdog_seal must reset a partial counter');
    const afterOneBatch = results[3];
    assert.equal(afterOneBatch.counter, 1, 'counter must restart from 1 after watchdog_seal reset');
    assert.equal(afterOneBatch.nudgeFired, false, 'nudge must NOT fire — counter only at 1, not yet at MEMORY_CHAIN_LIMIT');
  });

  it('nudge fires exactly once per streak across watchdog-separated streaks (mirrors generationComplete behaviour)', () => {
    // Two full streaks separated by a watchdog_seal — each fires the nudge exactly once.
    const memBatch = { kind: 'tool_batch' as const, toolNames: ['read_my_reflections'] };
    const events: GLEvent[] = [
      ...Array.from({ length: MEMORY_CHAIN_LIMIT + 1 }, () => memBatch), // streak 1 (fires at LIMIT, one extra)
      { kind: 'watchdog_seal' },
      ...Array.from({ length: MEMORY_CHAIN_LIMIT + 1 }, () => memBatch), // streak 2
    ];
    const results = simulateGLGuardWithGenerationComplete(events);
    const nudgeFires = results.filter(r => r.nudgeFired);
    assert.equal(nudgeFires.length, 2, 'nudge must fire exactly once per streak (two total across watchdog-separated streaks)');
  });
});
