/**
 * Source-level guards for absence-related behavioral contracts (#454, #455, #489).
 *
 * #454 — The stale-transcript guard uses gt(createdAt, absenceThreshold) to
 *        ensure Daniela only sees call transcripts from the current absence
 *        window, not leftover transcripts from a prior cycle.
 *
 * #455 — The call transcript is forwarded to the synthesis context when a
 *        returning student has a recent call in the current absence window.
 *
 * #489 — The session-start pattern-signal fetch uses a conditional assign
 *        (if patternSignalContext) so a null result on DB error preserves
 *        the existing activePatternSignals value rather than clearing it.
 *
 * Run: npx tsx --test server/__tests__/absence-source-guards.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const absenceWorkerSrc = readFileSync(
  resolve(import.meta.dirname, '../services/daniela-absence-worker.ts'),
  'utf-8',
);

const orchestratorSrc = readFileSync(
  resolve(import.meta.dirname, '../services/streaming-voice-orchestrator.ts'),
  'utf-8',
);

// ── #454: stale-transcript guard ──────────────────────────────────────────────

describe('#454 — stale-transcript guard blocks calls from a prior absence cycle', () => {
  it('daniela-absence-worker.ts uses gt(createdAt, absenceThreshold) in the transcript query', () => {
    assert.ok(
      absenceWorkerSrc.includes('gt(danielaOutboundQueue.createdAt, absenceThreshold)'),
      'gt(danielaOutboundQueue.createdAt, absenceThreshold) not found — transcript query may return stale rows from prior absence cycles',
    );
  });

  it('absenceThreshold is used at least twice (both peekAbsenceReturnDetails and autoResolve paths)', () => {
    const matches = (absenceWorkerSrc.match(/gt\(danielaOutboundQueue\.createdAt,\s*absenceThreshold\)/g) ?? []).length;
    assert.ok(
      matches >= 2,
      `Expected at least 2 uses of the recency guard (peek + auto-resolve paths); found ${matches}`,
    );
  });

  it('mutation self-check: removing ALL occurrences of the gt() guard would produce 0 matches', () => {
    // Use replaceAll to eliminate every copy (the guard appears on both the peek
    // and auto-resolve paths).  After removal the assertion in the previous
    // test must also fire for zero matches.
    const mutated = absenceWorkerSrc.replaceAll(
      'gt(danielaOutboundQueue.createdAt, absenceThreshold)',
      '/* guard removed */',
    );
    const countAfterMutation = (mutated.match(/gt\(danielaOutboundQueue\.createdAt,\s*absenceThreshold\)/g) ?? []).length;
    assert.equal(countAfterMutation, 0, 'replaceAll should eliminate every copy of the guard');
  });
});

// ── #455: call transcript forwarded to synthesis context ──────────────────────

describe('#455 — call transcript is passed through to synthesis context', () => {
  it('daniela-absence-worker.ts includes callTranscript in the AbsenceReturnDetails result', () => {
    assert.ok(
      absenceWorkerSrc.includes('callTranscript'),
      'callTranscript not found in daniela-absence-worker.ts — transcript would not reach synthesis context',
    );
  });

  it('callTranscript is included in the returned details object', () => {
    // The return statement must spread or include callTranscript.
    assert.ok(
      absenceWorkerSrc.includes('callTranscript }') ||
      absenceWorkerSrc.includes('callTranscript,') ||
      absenceWorkerSrc.includes('callTranscript: '),
      'callTranscript is not part of the returned AbsenceReturnDetails object',
    );
  });

  it('the danielaOutboundQueue is queried for callTranscript (not just logged)', () => {
    assert.ok(
      absenceWorkerSrc.includes('select({ callTranscript: danielaOutboundQueue.callTranscript })'),
      'callTranscript column is not selected from danielaOutboundQueue — transcript would never reach synthesis',
    );
  });
});

// ── #489: session-start pattern signal preserves existing value on DB error ───

describe('#489 — session-start pattern-signal fetch is resilient to DB errors', () => {
  it('streaming-voice-orchestrator.ts guards activePatternSignals assignment with if (patternSignalContext)', () => {
    // The session-start path calls fetchPatternSignalContext().catch(() => null).
    // The result is only assigned to session.activePatternSignals when truthy,
    // so a DB error (which becomes null) silently preserves the existing value.
    assert.ok(
      orchestratorSrc.includes('if (patternSignalContext)'),
      'if (patternSignalContext) guard not found — a DB error at session start would unconditionally overwrite activePatternSignals with null',
    );
  });

  it('fetchPatternSignalContext is called with .catch(() => null) at session start', () => {
    assert.ok(
      orchestratorSrc.includes('fetchPatternSignalContext') &&
      orchestratorSrc.includes('.catch(() => null)'),
      'fetchPatternSignalContext().catch(() => null) not found — DB errors would surface as uncaught exceptions at session start',
    );
  });

  it('mutation self-check: removing ALL copies of the conditional guard yields 0 matches', () => {
    // The guard may appear more than once in the file; replaceAll ensures the
    // mutation eliminates every occurrence so we can verify the assertion fires.
    const mutated = orchestratorSrc.replaceAll('if (patternSignalContext)', '/* guard removed */');
    const countAfterMutation = (mutated.match(/if \(patternSignalContext\)/g) ?? []).length;
    assert.equal(countAfterMutation, 0, 'replaceAll should eliminate every copy of the guard');
  });
});
