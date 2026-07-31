/**
 * Confirms that active grammar pattern signals reach Daniela's system prompt
 * in the study-mode chat text path.
 *
 * CONTRACTS tested:
 *
 * 1. Source-wiring — studyModeChat (study-mode-service.ts)
 *    - `fetchPatternSignalContext` is called and its result is named
 *      `activePatternSignals`.
 *    - A `.catch()` guard prevents a DB error from crashing the turn.
 *    - `activePatternSignals` is forwarded to `callDaniela`.
 *
 * 2. Source-wiring — callDaniela simple path (daniela-caller.ts)
 *    - `buildTextModeSystemPrompt(systemPrompt, activePatternSignals)` is called
 *      on the !enableTools branch.
 *    - The result becomes the `systemInstruction` passed to generateContent.
 *
 * 3. Source-wiring — runDanielaFCLoop tools path (daniela-caller.ts)
 *    - `buildTextModeSystemPrompt(systemPrompt, activePatternSignals)` is also
 *      called in the FC loop, so the injection works regardless of which branch
 *      the caller takes.
 *    - `effectiveSystemPrompt` is placed in `systemInstruction` in the
 *      generateContent config.
 *
 * 4. Behavioral — pure formatter (pattern-signal-context.ts)
 *    - `buildTextModeSystemPrompt` with a bullet-line signal string produces a
 *      prompt that includes "Active grammar patterns:" with pipe-joined entries.
 *    - With null / no-bullet signal the base prompt is returned unchanged.
 *
 * Why source analysis?
 * `daniela-caller.ts` initialises heavy runtime services (DB, Deepgram, Cartesia)
 * at module load time, making it impossible to import in a lightweight test process.
 * Source analysis is the established pattern in this test suite for exactly this
 * situation (see pattern-signal-fetch-error-preservation.test.ts).
 * Part 4 exercises the real production formatter so any change to the injection
 * logic is caught behaviourally — without spawning the full server.
 *
 * Run with:
 *   npx tsx --test server/__tests__/pattern-signals-study-mode-chat.test.ts
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  buildTextModeSystemPrompt,
  formatActivePatternSignalNote,
} from '../services/pattern-signal-context';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const root       = resolve(__dirname, '../..');

// ── Source files loaded once ─────────────────────────────────────────────────

let studyModeSrc: string;
let callerSrc: string;

before(() => {
  studyModeSrc = readFileSync(
    resolve(root, 'server/services/study-mode-service.ts'),
    'utf-8',
  );
  callerSrc = readFileSync(
    resolve(root, 'server/services/daniela-caller.ts'),
    'utf-8',
  );
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return text around the first occurrence of `anchor` in `src`. */
function regionAround(src: string, anchor: string, before = 150, after = 700): string {
  const idx = src.indexOf(anchor);
  if (idx === -1) return '';
  return src.slice(Math.max(0, idx - before), Math.min(src.length, idx + anchor.length + after));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1 — studyModeChat: fetchPatternSignalContext → callDaniela wiring
// ═══════════════════════════════════════════════════════════════════════════════

describe('studyModeChat — fetchPatternSignalContext → activePatternSignals → callDaniela', () => {
  it('imports fetchPatternSignalContext from pattern-signal-context', () => {
    assert.ok(
      studyModeSrc.includes('fetchPatternSignalContext'),
      'fetchPatternSignalContext must be imported/used in study-mode-service.ts — ' +
      'without it study-mode chat cannot read the student\'s wobble state.',
    );
  });

  it('assigns fetchPatternSignalContext result to activePatternSignals', () => {
    const region = regionAround(studyModeSrc, 'activePatternSignals');
    assert.ok(
      region.includes('fetchPatternSignalContext'),
      'studyModeChat must assign the fetchPatternSignalContext result to activePatternSignals. ' +
      'Region around "activePatternSignals":\n' + region,
    );
  });

  it('guards the fetch with .catch() so a DB error does not crash the turn', () => {
    const region = regionAround(studyModeSrc, 'activePatternSignals');
    assert.ok(
      region.includes('.catch('),
      'fetchPatternSignalContext in studyModeChat must be followed by .catch() — ' +
      'a transient DB failure must not bubble up and break the student\'s chat turn. ' +
      'Region around "activePatternSignals":\n' + region,
    );
  });

  it('passes activePatternSignals into callDaniela options', () => {
    const region = regionAround(studyModeSrc, 'callDaniela(');
    assert.ok(
      region.includes('activePatternSignals'),
      'callDaniela must receive activePatternSignals in its options object. ' +
      'Region around "callDaniela(":\n' + region,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2 — callDaniela simple path: activePatternSignals → systemInstruction
// ═══════════════════════════════════════════════════════════════════════════════

describe('callDaniela simple path — activePatternSignals reaches systemInstruction', () => {
  it('calls buildTextModeSystemPrompt with activePatternSignals on the !enableTools branch', () => {
    // The guard in callDaniela: if (!enableTools) { systemPrompt = buildTextModeSystemPrompt(...) }
    const region = regionAround(
      callerSrc,
      'buildTextModeSystemPrompt(systemPrompt, activePatternSignals)',
      300,
      300,
    );
    assert.ok(
      region.length > 0,
      'callDaniela must call buildTextModeSystemPrompt(systemPrompt, activePatternSignals) — ' +
      'this is the injection point for pattern signals on the simple (no-tools) path.',
    );
  });

  it('passes the built prompt as systemInstruction to generateContent on the simple path', () => {
    // Simple path ends with: config: { systemInstruction: systemPrompt }
    const region = regionAround(callerSrc, 'systemInstruction: systemPrompt', 50, 100);
    assert.ok(
      region.length > 0,
      'callDaniela simple path must use systemPrompt (after buildTextModeSystemPrompt) as ' +
      'the systemInstruction for generateContent.',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3 — runDanielaFCLoop tools path: activePatternSignals → systemInstruction
// ═══════════════════════════════════════════════════════════════════════════════

describe('runDanielaFCLoop tools path — activePatternSignals reaches systemInstruction', () => {
  it('calls buildTextModeSystemPrompt with activePatternSignals to build effectiveSystemPrompt', () => {
    const region = regionAround(
      callerSrc,
      'buildTextModeSystemPrompt(systemPrompt, activePatternSignals)',
      50,
      200,
    );
    assert.ok(
      region.length > 0,
      'runDanielaFCLoop must call buildTextModeSystemPrompt(systemPrompt, activePatternSignals) ' +
      'so pattern signals are injected on the tools path too.',
    );
  });

  it('places effectiveSystemPrompt in systemInstruction of the generateContent config', () => {
    const region = regionAround(callerSrc, 'systemInstruction: effectiveSystemPrompt', 50, 100);
    assert.ok(
      region.length > 0,
      'runDanielaFCLoop must pass effectiveSystemPrompt as systemInstruction to ' +
      'generateContent — without this the pattern note is built but never sent to Gemini.',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4 — Behavioral: pure formatter end-to-end (no heavy runtime deps)
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildTextModeSystemPrompt — formatted note reaches the system prompt string', () => {
  const BASE = 'You are Daniela, a Spanish tutor.';

  const WOBBLE_SIGNALS = [
    '- ser_vs_estar: WOBBLING — slipped back (last wobble today). Needs revisiting.',
    '- preterite_ir: IN PROGRESS — being drilled (3 poundings, 1 wobbles). Keep building.',
  ].join('\n');

  it('appends "Active grammar patterns:" when signals contain bullet lines', () => {
    const result = buildTextModeSystemPrompt(BASE, WOBBLE_SIGNALS);

    assert.ok(
      result.startsWith(BASE),
      'Base prompt must be preserved at start of systemInstruction',
    );
    assert.ok(
      result.includes('Active grammar patterns:'),
      `Expected "Active grammar patterns:" in result:\n${result}`,
    );
    assert.ok(result.includes('ser_vs_estar'), 'First signal key must appear in result');
    assert.ok(result.includes('preterite_ir'), 'Second signal key must appear in result');
  });

  it('pipe-joins multiple signals onto a single line', () => {
    const result = buildTextModeSystemPrompt(BASE, WOBBLE_SIGNALS);
    const patternLine = result.split('\n').find((l) => l.includes('Active grammar patterns:'));
    assert.ok(patternLine !== undefined, 'No "Active grammar patterns:" line found');
    assert.ok(
      patternLine.includes(' | '),
      `Expected " | " pipe separator in pattern line, got: ${patternLine}`,
    );
  });

  it('returns base prompt unchanged when activePatternSignals is null', () => {
    const result = buildTextModeSystemPrompt(BASE, null);
    assert.strictEqual(result, BASE, 'Null signals must not modify the system prompt');
    assert.ok(!result.includes('Active grammar patterns:'));
  });

  it('returns base prompt unchanged when activePatternSignals is undefined', () => {
    const result = buildTextModeSystemPrompt(BASE);
    assert.strictEqual(result, BASE, 'Missing signals must not modify the system prompt');
  });

  it('returns base prompt unchanged when signal string has no bullet-prefixed lines', () => {
    const result = buildTextModeSystemPrompt(BASE, 'Header line\nAnother plain line');
    assert.strictEqual(result, BASE, 'Non-bullet signal string must not inject anything');
  });

  it('accepts • as a valid bullet prefix', () => {
    const result = buildTextModeSystemPrompt(BASE, '• reflexive_verbs: WOBBLING — slipped back.');
    assert.ok(
      result.includes('Active grammar patterns:'),
      'Bullet prefix • must trigger injection just like -',
    );
    assert.ok(result.includes('reflexive_verbs'));
  });
});
