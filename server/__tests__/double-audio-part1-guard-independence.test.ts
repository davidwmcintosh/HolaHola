/**
 * Source-level guard for the part-1 double-audio gate independence (#636).
 *
 * The double-audio protection has two independent gates:
 *   part-1: `!isTutorGeneratingAudio` — fires before audio generation ends
 *   part-2: `responseFlushedToClient`  — fires after response_complete flush,
 *            while isTutorGeneratingAudio is still true (playback still running)
 *
 * This test locks the independence of part-1 from part-2: part-1 must fire
 * even when `responseFlushedToClient` is false (i.e., the flush debounce hasn't
 * sealed the turn yet).  If the two conditions were merged into a single if-block,
 * the window between audio-start and response_complete would be unguarded.
 *
 * Run: npx tsx --test server/__tests__/double-audio-part1-guard-independence.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const glSrc = readFileSync(
  resolve(import.meta.dirname, '../services/gemini-live-session.ts'),
  'utf-8',
);

// ── Part-1 guard declaration ──────────────────────────────────────────────────

describe('#636 — hasStudentInputSinceLastResponse flag is declared on the class', () => {
  it('gemini-live-session.ts declares hasStudentInputSinceLastResponse as a private field', () => {
    assert.ok(
      glSrc.includes('private hasStudentInputSinceLastResponse = true'),
      'private hasStudentInputSinceLastResponse field not found — part-1 double-audio guard has no backing flag',
    );
  });
});

// ── Part-1 guard condition ────────────────────────────────────────────────────

describe('#636 — part-1 guard condition references !isTutorGeneratingAudio', () => {
  it('the part-1 guard condition is present in the source', () => {
    assert.ok(
      glSrc.includes('!this.isTutorGeneratingAudio && !this.greetingPhaseActive && !this.hasStudentInputSinceLastResponse'),
      'part-1 guard condition not found — spurious audio before response_complete would not be suppressed',
    );
  });

  it('the part-1 guard is followed by a continue statement (suppresses the chunk)', () => {
    const guardIdx = glSrc.indexOf(
      '!this.isTutorGeneratingAudio && !this.greetingPhaseActive && !this.hasStudentInputSinceLastResponse',
    );
    assert.ok(guardIdx !== -1, 'part-1 guard condition not found');

    const snippet = glSrc.slice(guardIdx, guardIdx + 300);
    assert.ok(
      snippet.includes('continue'),
      'continue statement not found after part-1 guard — spurious chunk may not be discarded',
    );
  });

  it('the part-1 guard log line is distinctive from part-2 (no "response_complete" in part-1 message)', () => {
    // Part-1 fires BEFORE response_complete; its log must not say "after response_complete"
    // Part-2 log says "Spurious GL audio after response_complete"
    assert.ok(
      glSrc.includes('Spurious GL audio — no student input since last response'),
      'Part-1 distinctive log message not found — cannot distinguish part-1 guard fire from part-2 in production logs',
    );
  });
});

// ── Guards are SEPARATE if-blocks (not combined) ─────────────────────────────

describe('#636 — part-1 and part-2 guards are separate if-blocks', () => {
  it('the two guard conditions do not appear on the same source line', () => {
    const lines = glSrc.split('\n');
    for (const line of lines) {
      const hasPart1 = line.includes('!this.isTutorGeneratingAudio && !this.greetingPhaseActive && !this.hasStudentInputSinceLastResponse');
      const hasPart2 = line.includes('this.responseFlushedToClient && !this.greetingPhaseActive && !this.hasStudentInputSinceLastResponse');
      assert.ok(
        !(hasPart1 && hasPart2),
        'part-1 and part-2 guard conditions appear on the same line — they must be separate if-blocks',
      );
    }
  });

  it('part-1 condition appears at a different character position than part-2 condition', () => {
    const part1Idx = glSrc.indexOf(
      '!this.isTutorGeneratingAudio && !this.greetingPhaseActive && !this.hasStudentInputSinceLastResponse',
    );
    const part2Idx = glSrc.indexOf(
      'this.responseFlushedToClient && !this.greetingPhaseActive && !this.hasStudentInputSinceLastResponse',
    );
    assert.ok(part1Idx !== -1, 'part-1 guard condition not found');
    assert.ok(part2Idx !== -1, 'part-2 guard condition not found');
    assert.notEqual(
      part1Idx,
      part2Idx,
      'part-1 and part-2 conditions are at the same position — they may be the same if-block',
    );
  });

  it('part-1 condition appears BEFORE part-2 condition in the file', () => {
    const part1Idx = glSrc.indexOf(
      '!this.isTutorGeneratingAudio && !this.greetingPhaseActive && !this.hasStudentInputSinceLastResponse',
    );
    const part2Idx = glSrc.indexOf(
      'this.responseFlushedToClient && !this.greetingPhaseActive && !this.hasStudentInputSinceLastResponse',
    );
    assert.ok(part1Idx !== -1, 'part-1 guard condition not found');
    assert.ok(part2Idx !== -1, 'part-2 guard condition not found');
    assert.ok(
      part1Idx < part2Idx,
      `part-1 guard (at ${part1Idx}) should appear before part-2 guard (at ${part2Idx})`,
    );
  });
});

// ── Part-1 fires independently when responseFlushedToClient is false ──────────
// Structural proof: the part-1 condition does NOT reference responseFlushedToClient,
// so it can fire whenever isTutorGeneratingAudio is false — regardless of whether
// the flush has occurred.

describe('#636 — part-1 condition does not reference responseFlushedToClient', () => {
  it('the part-1 if-condition line does not contain responseFlushedToClient', () => {
    const lines = glSrc.split('\n');
    const part1Line = lines.find(l =>
      l.includes('!this.isTutorGeneratingAudio && !this.greetingPhaseActive && !this.hasStudentInputSinceLastResponse')
    );
    assert.ok(part1Line !== undefined, 'part-1 guard condition not found in any line');
    assert.ok(
      !part1Line.includes('responseFlushedToClient'),
      'part-1 guard condition references responseFlushedToClient — the two guards are no longer independent',
    );
  });
});

// ── Mutation self-check: removing part-2 leaves part-1 intact ────────────────

describe('#636 — mutation self-check: removing part-2 guard leaves part-1 intact', () => {
  it('replacing part-2 condition still leaves exactly one part-1 match', () => {
    const mutated = glSrc.replace(
      'this.responseFlushedToClient && !this.greetingPhaseActive && !this.hasStudentInputSinceLastResponse',
      '/* part-2 guard removed */',
    );
    const part1Matches = (
      mutated.match(/!this\.isTutorGeneratingAudio && !this\.greetingPhaseActive && !this\.hasStudentInputSinceLastResponse/g) ?? []
    ).length;
    assert.equal(
      part1Matches,
      1,
      `Expected exactly 1 part-1 match after removing part-2; found ${part1Matches} — part-1 guard may have been lost or duplicated`,
    );
  });

  it('after part-2 removal, part-2 condition yields 0 matches (mutation worked)', () => {
    const mutated = glSrc.replace(
      'this.responseFlushedToClient && !this.greetingPhaseActive && !this.hasStudentInputSinceLastResponse',
      '/* part-2 guard removed */',
    );
    const part2Matches = (
      mutated.match(/this\.responseFlushedToClient && !this\.greetingPhaseActive && !this\.hasStudentInputSinceLastResponse/g) ?? []
    ).length;
    assert.equal(
      part2Matches,
      0,
      'part-2 condition still present after replacement — mutation did not work as expected',
    );
  });
});

// ── Mutation self-check: removing part-1 leaves part-2 intact ────────────────

describe('#636 — mutation self-check: removing part-1 guard leaves part-2 intact', () => {
  it('replacing part-1 condition still leaves exactly one part-2 match', () => {
    const mutated = glSrc.replace(
      '!this.isTutorGeneratingAudio && !this.greetingPhaseActive && !this.hasStudentInputSinceLastResponse',
      '/* part-1 guard removed */',
    );
    const part2Matches = (
      mutated.match(/this\.responseFlushedToClient && !this\.greetingPhaseActive && !this\.hasStudentInputSinceLastResponse/g) ?? []
    ).length;
    assert.equal(
      part2Matches,
      1,
      `Expected exactly 1 part-2 match after removing part-1; found ${part2Matches} — part-2 guard may have been lost or duplicated`,
    );
  });

  it('after part-1 removal, part-1 condition yields 0 matches (mutation worked)', () => {
    const mutated = glSrc.replace(
      '!this.isTutorGeneratingAudio && !this.greetingPhaseActive && !this.hasStudentInputSinceLastResponse',
      '/* part-1 guard removed */',
    );
    const part1Matches = (
      mutated.match(/!this\.isTutorGeneratingAudio && !this\.greetingPhaseActive && !this\.hasStudentInputSinceLastResponse/g) ?? []
    ).length;
    assert.equal(
      part1Matches,
      0,
      'part-1 condition still present after replacement — mutation did not work as expected',
    );
  });
});

// ── Flag reset ────────────────────────────────────────────────────────────────

describe('#636 — hasStudentInputSinceLastResponse is reset to false after each response', () => {
  it('hasStudentInputSinceLastResponse is set to false at least once (cleared after a completed response)', () => {
    const resetMatches = (glSrc.match(/this\.hasStudentInputSinceLastResponse\s*=\s*false/g) ?? []).length;
    assert.ok(
      resetMatches >= 1,
      `Expected at least 1 reset of hasStudentInputSinceLastResponse to false; found ${resetMatches} — guard may never arm`,
    );
  });

  it('hasStudentInputSinceLastResponse is set to true at least once (re-armed when student speaks)', () => {
    const setMatches = (glSrc.match(/this\.hasStudentInputSinceLastResponse\s*=\s*true/g) ?? []).length;
    assert.ok(
      setMatches >= 1,
      `Expected at least 1 assignment of hasStudentInputSinceLastResponse to true; found ${setMatches} — guard may never allow legitimate audio`,
    );
  });
});
