/**
 * Unit tests: pattern signals reach Gemini's context when passed to text-mode
 *
 * All assertions are against pure functions exported from pattern-signal-context.ts,
 * which has no runtime dependencies (no DB, no Deepgram, no Cartesia).
 * This keeps the test process lean and guarantees clean exit in CI.
 *
 * Covers two invariants:
 *   1. A signals string with valid bullet prefixes (- or •) produces a
 *      pipe-joined "Active grammar patterns:" suffix that lands in the
 *      effective system prompt (via buildTextModeSystemPrompt).
 *   2. A signals string with NO bullet-prefixed lines produces no injection —
 *      the system prompt is returned unchanged.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatActivePatternSignalNote,
  buildTextModeSystemPrompt,
} from '../services/pattern-signal-context';

// ── formatActivePatternSignalNote — formatter unit tests ─────────────────────

describe('formatActivePatternSignalNote', () => {
  it('returns pipe-joined "Active grammar patterns:" for bullet lines', () => {
    const signals = [
      '- ser/estar: WOBBLING — slipped back (last wobble yesterday). Needs revisiting.',
      '- subjunctive: IN PROGRESS — being drilled (3 poundings, 1 wobbles). Keep building.',
    ].join('\n');

    const result = formatActivePatternSignalNote(signals);

    assert.ok(
      result.includes('Active grammar patterns:'),
      `Expected "Active grammar patterns:" in result, got: ${JSON.stringify(result)}`,
    );
    assert.ok(result.includes('ser/estar'), 'Expected ser/estar in result');
    assert.ok(result.includes('subjunctive'), 'Expected subjunctive in result');
    assert.ok(result.includes(' | '), 'Expected pipe separator between entries');
  });

  it('returns empty string when no bullet-prefixed lines exist', () => {
    const signals = [
      'Some header text without a dash',
      'Another plain line',
    ].join('\n');

    const result = formatActivePatternSignalNote(signals);

    assert.strictEqual(
      result,
      '',
      `Expected empty string for non-bullet signals, got: ${JSON.stringify(result)}`,
    );
  });

  it('returns empty string for null', () => {
    assert.strictEqual(formatActivePatternSignalNote(null), '');
  });

  it('returns empty string for undefined', () => {
    assert.strictEqual(formatActivePatternSignalNote(undefined), '');
  });

  it('accepts • bullet prefix as well as -', () => {
    const signals = '• preterite: WOBBLING — slipped back. Needs revisiting.';
    const result = formatActivePatternSignalNote(signals);
    assert.ok(
      result.includes('Active grammar patterns:'),
      `Expected injection for • prefix, got: ${JSON.stringify(result)}`,
    );
    assert.ok(result.includes('preterite'), 'Expected preterite in result');
  });
});

// ── buildTextModeSystemPrompt — integration of formatter into system prompt ──
//
// buildTextModeSystemPrompt mirrors the three-line effectiveSystemPrompt
// construction in runDanielaFCLoop (daniela-caller.ts).  Testing it here
// verifies the injection path without importing the caller, which initialises
// heavy runtime services (DB, Deepgram, Cartesia) at module load time.

describe('buildTextModeSystemPrompt — pattern signal reaches systemInstruction', () => {
  const BASE = 'You are Daniela, a Spanish tutor.';

  it('appends "Active grammar patterns:" when signals have bullet prefixes', () => {
    const signals = [
      '- ser/estar: WOBBLING — slipped back (last wobble today). Needs revisiting.',
      '- subjunctive: IN PROGRESS — being drilled (2 poundings, 0 wobbles). Keep building.',
    ].join('\n');

    const result = buildTextModeSystemPrompt(BASE, signals);

    assert.ok(result.startsWith(BASE), 'Base prompt must be preserved at start');
    assert.ok(
      result.includes('Active grammar patterns:'),
      `Expected "Active grammar patterns:" in result, got: ${JSON.stringify(result)}`,
    );
    assert.ok(result.includes('ser/estar'), 'Expected ser/estar in result');
    assert.ok(result.includes('subjunctive'), 'Expected subjunctive in result');
  });

  it('returns base prompt unchanged when signals have no bullet prefixes', () => {
    const signals = 'Header text only — no bullets here\nAnother plain line';

    const result = buildTextModeSystemPrompt(BASE, signals);

    assert.strictEqual(
      result,
      BASE,
      'systemPrompt should be unchanged when signals carry no bullet lines',
    );
    assert.ok(
      !result.includes('Active grammar patterns:'),
      `Expected NO "Active grammar patterns:" in result, got: ${JSON.stringify(result)}`,
    );
  });

  it('returns base prompt unchanged when signals is null', () => {
    assert.strictEqual(buildTextModeSystemPrompt(BASE, null), BASE);
  });

  it('returns base prompt unchanged when signals is undefined', () => {
    assert.strictEqual(buildTextModeSystemPrompt(BASE), BASE);
  });

  it('does not double-newline when base prompt already ends with newline', () => {
    const baseWithNewline = BASE + '\n';
    const signals = '- preterite: WOBBLING — slipped back. Needs revisiting.';
    const result = buildTextModeSystemPrompt(baseWithNewline, signals);
    assert.ok(!result.includes('\n\n'), 'Should not insert a double newline');
    assert.ok(result.includes('Active grammar patterns:'));
  });
});
