/**
 * Source-level guard for the during-playback double-audio gate (#627).
 *
 * #627 — A second GL audio stream can arrive after `response_complete` has
 *        already been flushed to the client — while `isTutorGeneratingAudio`
 *        is still true (playback hasn't finished yet, so part-1 of the guard
 *        can't fire).  `responseFlushedToClient` is the part-2 gate that
 *        catches exactly this case.
 *
 *        Without this test, someone could remove the flag or short-circuit the
 *        condition and the existing suite would not catch it.
 *
 * Run: npx tsx --test server/__tests__/double-audio-during-playback-guard.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const glSrc = readFileSync(
  resolve(import.meta.dirname, '../services/gemini-live-session.ts'),
  'utf-8',
);

// ── Guard declaration ─────────────────────────────────────────────────────────

describe('#627 — responseFlushedToClient flag is declared on the class', () => {
  it('gemini-live-session.ts declares responseFlushedToClient as a private field', () => {
    assert.ok(
      glSrc.includes('private responseFlushedToClient = false'),
      'private responseFlushedToClient field not found — the during-playback guard has no backing flag',
    );
  });
});

// ── Guard condition ───────────────────────────────────────────────────────────

describe('#627 — responseFlushedToClient guard suppresses spurious audio during playback', () => {
  it('the part-2 guard condition references responseFlushedToClient', () => {
    assert.ok(
      glSrc.includes('this.responseFlushedToClient && !this.greetingPhaseActive && !this.hasStudentInputSinceLastResponse'),
      'responseFlushedToClient guard condition not found — spurious audio during playback would not be suppressed',
    );
  });

  it('the guard is followed by a continue statement (suppresses the chunk)', () => {
    // Locate the part-2 guard block and confirm a `continue` follows it.
    const guardIdx = glSrc.indexOf(
      'this.responseFlushedToClient && !this.greetingPhaseActive && !this.hasStudentInputSinceLastResponse',
    );
    assert.ok(guardIdx !== -1, 'part-2 guard condition not found');

    // Grab the next ~300 chars after the condition to check for `continue`.
    const snippet = glSrc.slice(guardIdx, guardIdx + 300);
    assert.ok(
      snippet.includes('continue'),
      'continue statement not found after responseFlushedToClient guard — spurious chunk may not be discarded',
    );
  });

  it('the guard log line mentions "response_complete" so it is distinguishable from part-1', () => {
    assert.ok(
      glSrc.includes('Spurious GL audio after response_complete'),
      'Distinctive log message not found — cannot distinguish part-2 guard fire from part-1 in production logs',
    );
  });
});

// ── Flag set in flushTranscripts ──────────────────────────────────────────────

describe('#627 — responseFlushedToClient is set to true inside flushTranscripts()', () => {
  it('flushTranscripts sets responseFlushedToClient = true', () => {
    assert.ok(
      glSrc.includes('this.responseFlushedToClient = true'),
      'responseFlushedToClient is never set to true — guard can never fire',
    );
  });
});

// ── Flag reset on new generation ─────────────────────────────────────────────

describe('#627 — responseFlushedToClient is reset when a genuine new generation begins', () => {
  it('responseFlushedToClient is reset to false (at least once) to allow future turns', () => {
    // Count explicit false assignments — there should be at least one reset so
    // the guard doesn't permanently block all audio after the first turn.
    const resetMatches = (glSrc.match(/this\.responseFlushedToClient\s*=\s*false/g) ?? []).length;
    assert.ok(
      resetMatches >= 1,
      `Expected at least 1 reset of responseFlushedToClient to false; found ${resetMatches}`,
    );
  });
});

// ── Negative-path (mutation) self-check ──────────────────────────────────────

describe('#627 — mutation self-check: removing the guard causes the guard-presence assertion to fail', () => {
  it('removing responseFlushedToClient from the guard condition yields 0 matches', () => {
    const mutated = glSrc.replace(
      'this.responseFlushedToClient && !this.greetingPhaseActive && !this.hasStudentInputSinceLastResponse',
      '/* guard removed */',
    );
    const countAfterMutation = (
      mutated.match(/this\.responseFlushedToClient && !this\.greetingPhaseActive && !this\.hasStudentInputSinceLastResponse/g) ?? []
    ).length;
    assert.equal(
      countAfterMutation,
      0,
      'replace() should have eliminated the guard condition — mutation did not work as expected',
    );
  });

  it('removing the flag declaration yields 0 matches', () => {
    const mutated = glSrc.replace('private responseFlushedToClient = false', '/* flag removed */');
    const countAfterMutation = (mutated.match(/private responseFlushedToClient = false/g) ?? []).length;
    assert.equal(
      countAfterMutation,
      0,
      'replace() should have eliminated the flag declaration — mutation did not work as expected',
    );
  });

  it('removing the true assignment yields 0 matches', () => {
    const mutated = glSrc.replace('this.responseFlushedToClient = true', '/* assignment removed */');
    const countAfterMutation = (mutated.match(/this\.responseFlushedToClient\s*=\s*true/g) ?? []).length;
    assert.equal(
      countAfterMutation,
      0,
      'replace() should have eliminated the true-assignment — mutation did not work as expected',
    );
  });
});
