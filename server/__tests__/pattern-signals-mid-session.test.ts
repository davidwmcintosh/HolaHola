/**
 * Unit tests for pattern signals appearing in Daniela's per-turn context mid-session.
 *
 * CONTRACTS tested — using the real production functions from pattern-signal-context.ts:
 *
 * 1. formatPatternSignals (pattern-signal-context.ts)
 *    - Returns non-null text when a student has at least one wobbling or pounding compartment.
 *    - Wobbling compartments are listed before pounding ones.
 *    - Returns null when all compartments are stable/mastered/new.
 *
 * 2. buildActflPersonaAnchor (pattern-signal-context.ts)
 *    - Includes an "Active grammar patterns:" line when session.activePatternSignals is set.
 *    - The line contains the compartment's patternKey.
 *    - Emits nothing when session.activePatternSignals is null or empty string.
 *    - Caps the displayed list at 5 patterns.
 *
 * 3. session.activePatternSignals lifecycle
 *    - After the greeting, the orchestrator assigns formatPatternSignals output to
 *      session.activePatternSignals (see streaming-voice-orchestrator.ts ~line 9465).
 *    - buildActflPersonaAnchor reads that value on every subsequent per-turn call.
 *    - The value persists across turns (no automatic reset between turns).
 *
 * Run with:
 *   npx tsx --test server/__tests__/pattern-signals-mid-session.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import the real production functions — these are the same functions that
// streaming-voice-orchestrator.ts uses. Any regression to the real code will
// break these tests.
import {
  formatPatternSignals,
  buildActflPersonaAnchor,
  type PatternAnchorSession,
} from '../services/pattern-signal-context';

// CompartmentInstallation shape (shared/schema.ts $inferSelect).
// We import the type only; the actual table is not touched by these pure helpers.
import type { CompartmentInstallation } from '@shared/schema';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCompartments(
  overrides: Partial<CompartmentInstallation>[],
): CompartmentInstallation[] {
  return overrides.map((o, i) => ({
    id: `compartment-${i}`,
    userId: 'user-test',
    language: 'spanish',
    patternKey: `pattern_${i}`,
    status: 'stable' as const,
    poundingCount: 0,
    wobbleCount: 0,
    lastWobbledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...o,
  }));
}

// ── formatPatternSignals ──────────────────────────────────────────────────────

describe('formatPatternSignals', () => {
  it('returns null when compartment list is empty', () => {
    const result = formatPatternSignals([]);
    assert.strictEqual(result, null);
  });

  it('returns null when all compartments are stable', () => {
    const compartments = makeCompartments([
      { patternKey: 'ser_vs_estar', status: 'stable' },
      { patternKey: 'preterite_ir', status: 'mastered' },
    ]);
    assert.strictEqual(formatPatternSignals(compartments), null);
  });

  it('returns null when only new compartments exist', () => {
    const compartments = makeCompartments([
      { patternKey: 'pattern_a', status: 'new' },
    ]);
    assert.strictEqual(formatPatternSignals(compartments), null,
      'new compartments should not trigger pattern signals');
  });

  it('returns non-null text for a single wobbling compartment', () => {
    const compartments = makeCompartments([
      {
        patternKey: 'ser_vs_estar',
        status: 'wobbling',
        wobbleCount: 2,
        lastWobbledAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    ]);
    const result = formatPatternSignals(compartments);
    assert.ok(result !== null, 'Expected non-null for wobbling compartment');
    assert.ok(result.includes('ser_vs_estar'), 'Expected patternKey in output');
    assert.ok(result.includes('WOBBLING'),     'Expected WOBBLING label');
  });

  it('returns non-null text for a single pounding compartment', () => {
    const compartments = makeCompartments([
      {
        patternKey: 'preterite_ir',
        status: 'pounding',
        poundingCount: 5,
        wobbleCount: 1,
      },
    ]);
    const result = formatPatternSignals(compartments);
    assert.ok(result !== null, 'Expected non-null for pounding compartment');
    assert.ok(result.includes('preterite_ir'), 'Expected patternKey in output');
    assert.ok(result.includes('IN PROGRESS'),  'Expected IN PROGRESS label');
  });

  it('lists wobbling compartments before pounding ones', () => {
    const compartments = makeCompartments([
      { patternKey: 'pounding_first', status: 'pounding', poundingCount: 3 },
      { patternKey: 'wobbling_second', status: 'wobbling', wobbleCount: 1 },
    ]);
    const result = formatPatternSignals(compartments);
    assert.ok(result !== null);
    const wobblingIdx = result.indexOf('wobbling_second');
    const poundingIdx = result.indexOf('pounding_first');
    assert.ok(
      wobblingIdx < poundingIdx,
      'Wobbling compartment should appear before pounding compartment',
    );
  });

  it('includes relative age when lastWobbledAt is set', () => {
    const compartments = makeCompartments([
      {
        patternKey: 'past_tense',
        status: 'wobbling',
        lastWobbledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3d ago
      },
    ]);
    const result = formatPatternSignals(compartments);
    assert.ok(result !== null);
    assert.ok(
      result.includes('3d ago') || result.includes('ago'),
      'Expected relative time in output',
    );
  });
});

// ── buildActflPersonaAnchor — pattern signal section ─────────────────────────

describe('buildActflPersonaAnchor — pattern signal section', () => {
  it('omits pattern signal note when activePatternSignals is null', () => {
    const session: PatternAnchorSession = {
      studentActflLevel: 'novice_mid',
      targetLanguage: 'Spanish',
      nativeLanguage: 'english',
      tutorName: 'Daniela',
      conversationHistory: [],
      activePatternSignals: null,
    };
    const anchor = buildActflPersonaAnchor(session);
    assert.ok(anchor !== null);
    assert.ok(
      !anchor.includes('Active grammar patterns:'),
      'Expected no pattern line when activePatternSignals is null',
    );
  });

  it('omits pattern signal note when activePatternSignals is empty string', () => {
    const session: PatternAnchorSession = {
      studentActflLevel: 'novice_mid',
      targetLanguage: 'Spanish',
      nativeLanguage: 'english',
      activePatternSignals: '',
    };
    const anchor = buildActflPersonaAnchor(session)!;
    assert.ok(!anchor.includes('Active grammar patterns:'));
  });

  it('includes "Active grammar patterns:" line when activePatternSignals is set', () => {
    const signals = [
      '- ser_vs_estar: WOBBLING — slipped back after partial stability. Needs revisiting.',
      '- preterite_ir: IN PROGRESS — being drilled (5 poundings, 1 wobbles). Keep building.',
    ].join('\n');

    const session: PatternAnchorSession = {
      studentActflLevel: 'novice_mid',
      targetLanguage: 'Spanish',
      nativeLanguage: 'english',
      tutorName: 'Daniela',
      conversationHistory: ['turn1', 'turn2', 'turn3'],
      activePatternSignals: signals,
    };
    const anchor = buildActflPersonaAnchor(session)!;
    assert.ok(anchor.includes('Active grammar patterns:'), 'Expected header');
    assert.ok(anchor.includes('ser_vs_estar'),  'Expected wobbling key');
    assert.ok(anchor.includes('preterite_ir'),  'Expected pounding key');
  });

  it('caps displayed patterns at 5 even when more are stored', () => {
    const signalLines = Array.from(
      { length: 8 },
      (_, i) => `- pattern_${i}: WOBBLING — slipped back. Needs revisiting.`,
    );
    const session: PatternAnchorSession = {
      studentActflLevel: 'novice_high',
      targetLanguage: 'French',
      nativeLanguage: 'english',
      activePatternSignals: signalLines.join('\n'),
    };
    const anchor = buildActflPersonaAnchor(session)!;
    const patternSection = anchor.split('Active grammar patterns:')[1] ?? '';
    const matches = patternSection.match(/pattern_\d+/g) ?? [];
    assert.ok(
      matches.length <= 5,
      `Expected ≤5 patterns in anchor, got ${matches.length}`,
    );
  });

  it('anchor starts with "This turn:" regardless of pattern signals', () => {
    const session: PatternAnchorSession = {
      studentActflLevel: 'advanced_low',
      targetLanguage: 'French',
      nativeLanguage: 'english',
      activePatternSignals: null,
    };
    const anchor = buildActflPersonaAnchor(session)!;
    assert.ok(anchor.startsWith('This turn:'), 'Anchor must start with "This turn:"');
  });
});

// ── Round-trip: formatPatternSignals → session → buildActflPersonaAnchor ──────

describe('pattern signals round-trip (greeting → mid-session)', () => {
  it('pattern keys from formatPatternSignals appear in the per-turn anchor', () => {
    // Simulate: compartments present at greeting time
    const compartments = makeCompartments([
      {
        patternKey: 'subjunctive_present',
        status: 'wobbling',
        wobbleCount: 3,
        lastWobbledAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
      },
      {
        patternKey: 'reflexive_verbs',
        status: 'pounding',
        poundingCount: 4,
        wobbleCount: 0,
      },
    ]);

    // Step 1: orchestrator calls formatPatternSignals at greeting (~line 9441 in orchestrator)
    const signals = formatPatternSignals(compartments);
    assert.ok(signals !== null, 'Signals must be non-null for active compartments');

    // Step 2: orchestrator stores on session (~line 9465)
    const session: PatternAnchorSession = {
      studentActflLevel: 'intermediate_mid',
      targetLanguage: 'Spanish',
      nativeLanguage: 'english',
      tutorName: 'Daniela',
      conversationHistory: new Array(6).fill('turn'),
      activePatternSignals: signals,
    };

    // Step 3: per-turn call reads session.activePatternSignals via buildActflPersonaAnchor
    const anchor = buildActflPersonaAnchor(session)!;
    assert.ok(anchor.includes('Active grammar patterns:'), 'Per-turn anchor must include pattern header');
    assert.ok(anchor.includes('subjunctive_present'), 'Wobbling key must survive round-trip');
    assert.ok(anchor.includes('reflexive_verbs'),     'Pounding key must survive round-trip');
  });

  it('session carries signals across multiple turns without reset', () => {
    const compartments = makeCompartments([
      { patternKey: 'imperfect_tense', status: 'wobbling', wobbleCount: 2 },
    ]);

    const signals = formatPatternSignals(compartments);
    assert.ok(signals !== null);

    const session: PatternAnchorSession = {
      studentActflLevel: 'novice_high',
      targetLanguage: 'Spanish',
      nativeLanguage: 'english',
      activePatternSignals: signals,
    };

    // Turn 2
    const turn2 = buildActflPersonaAnchor(session)!;
    assert.ok(turn2.includes('imperfect_tense'), 'Turn 2 must see pattern from greeting');

    // Turn 3 — same session object, no reset
    const turn3 = buildActflPersonaAnchor(session)!;
    assert.ok(turn3.includes('imperfect_tense'), 'Turn 3 must still see the pattern');
  });

  it('null signals produce a clean anchor with no pattern section', () => {
    // Simulates a student with no wobbling/pounding patterns: signals = null
    const compartments = makeCompartments([
      { patternKey: 'ser_vs_estar', status: 'stable' },
    ]);
    const signals = formatPatternSignals(compartments);
    assert.strictEqual(signals, null, 'Stable compartments must produce null signals');

    const session: PatternAnchorSession = {
      studentActflLevel: 'novice_mid',
      targetLanguage: 'Spanish',
      nativeLanguage: 'english',
      activePatternSignals: signals, // null
    };
    const anchor = buildActflPersonaAnchor(session)!;
    assert.ok(!anchor.includes('Active grammar patterns:'),
      'Anchor must not include pattern section when signals are null');
  });

  it('clearing activePatternSignals to null removes pattern section from next turn', () => {
    // Simulates the mid-session refresh path (orchestrator line ~3463 / ~6921):
    // RECORD_PATTERN_SIGNAL fires → compartments all resolve to stable → signals = null
    // → session.activePatternSignals = null → next buildActflPersonaAnchor has no pattern block
    const session: PatternAnchorSession = {
      studentActflLevel: 'intermediate_low',
      targetLanguage: 'Spanish',
      nativeLanguage: 'english',
      activePatternSignals: '- ser_vs_estar: WOBBLING — slipped back. Needs revisiting.',
    };

    // Before refresh: patterns appear
    const beforeClear = buildActflPersonaAnchor(session)!;
    assert.ok(beforeClear.includes('Active grammar patterns:'), 'Patterns should appear before clear');

    // Refresh: all compartments now stable → formatPatternSignals returns null
    const refreshedCompartments = makeCompartments([
      { patternKey: 'ser_vs_estar', status: 'stable' },
    ]);
    session.activePatternSignals = formatPatternSignals(refreshedCompartments); // null

    // After refresh: patterns must not appear
    const afterClear = buildActflPersonaAnchor(session)!;
    assert.ok(!afterClear.includes('Active grammar patterns:'),
      'Pattern section must be absent after signals are cleared to null');
  });
});
