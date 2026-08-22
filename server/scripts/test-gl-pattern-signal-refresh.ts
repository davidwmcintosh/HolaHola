/**
 * test-gl-pattern-signal-refresh.ts
 *
 * Confirms that a mid-session `record_pattern_signal` call with eventType="stability"
 * on the Gemini Live (GL) native-FC path clears the previously-wobbling pattern from
 * `session.activePatternSignals` — so it no longer appears in Daniela's next reminder.
 *
 * Task #282 — GL-specific refresh added by Task #208:
 *   server/services/native-fc-handlers.ts RECORD_PATTERN_SIGNAL case, lines ~4226-4230.
 *
 * Three complementary checks:
 *
 *   PART 1 — Source analysis
 *     Confirms the GL native handler actually calls fetchPatternSignalContext and writes
 *     the result to session.activePatternSignals after every record_pattern_signal DB upsert.
 *
 *   PART 2 — Pure signal logic (formatPatternSignals)
 *     A compartment whose status transitions from "wobbling" to "stable" produces no
 *     output from formatPatternSignals (the function that backs fetchPatternSignalContext).
 *     This is the ground truth for "does the pattern still appear in the anchor?"
 *
 *   PART 3 — State-machine simulation
 *     Simulates the full fire-and-forget async block in RECORD_PATTERN_SIGNAL:
 *       session.activePatternSignals starts as a wobbling-pattern string.
 *       A stability event arrives → statusMap maps it to 'stable'.
 *       fetchPatternSignalContext equivalent returns null (no active patterns).
 *       session.activePatternSignals is set to null.
 *     This proves the refresh correctly clears the anchor mid-session without a real DB.
 *
 * Run: npx tsx server/scripts/test-gl-pattern-signal-refresh.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { formatPatternSignals } from '../services/pattern-signal-context.js';
import type { CompartmentInstallation } from '../../shared/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const G   = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R   = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B   = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y   = (s: string) => `\x1b[33m${s}\x1b[0m`;
const D   = (s: string) => `\x1b[2m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ${G('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${R('✗')} ${label}${detail ? `\n      ${R('→')} ${detail}` : ''}`);
    failed++;
  }
}

// ─── Load source files once ────────────────────────────────────────────────
const handlerSrc = readFileSync(
  resolve(__dirname, '../services/native-fc-handlers.ts'),
  'utf-8',
);
const contextSrc = readFileSync(
  resolve(__dirname, '../services/pattern-signal-context.ts'),
  'utf-8',
);

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Source analysis: GL native handler wires refresh correctly
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — Source analysis: RECORD_PATTERN_SIGNAL refresh in native-fc-handlers.ts'));
sep();

function part1() {
  // ── 1a. fetchPatternSignalContext is imported ──────────────────────────────
  const hasImport = handlerSrc.includes("from './pattern-signal-context'") ||
                    handlerSrc.includes('from "./pattern-signal-context"');
  assert(
    'native-fc-handlers.ts imports from pattern-signal-context',
    hasImport,
    hasImport ? undefined : 'Import line not found — GL path may be missing the import',
  );

  // ── 1b. RECORD_PATTERN_SIGNAL case exists in the switch ───────────────────
  const hasCase = /case\s+'RECORD_PATTERN_SIGNAL'\s*:/.test(handlerSrc);
  assert(
    "case 'RECORD_PATTERN_SIGNAL' exists in handler switch",
    hasCase,
    hasCase ? undefined : 'Case not found — handler may have been refactored',
  );

  // ── 1c. fetchPatternSignalContext is called inside the case ───────────────
  // Extract the RECORD_PATTERN_SIGNAL block (between its case label and the next case/break)
  const caseMatch = handlerSrc.match(/case\s+'RECORD_PATTERN_SIGNAL'\s*:([\s\S]*?)case\s+'MILESTONE'\s*:/);
  const caseBlock = caseMatch?.[1] ?? '';

  const hasFetch = caseBlock.includes('fetchPatternSignalContext');
  assert(
    'fetchPatternSignalContext is called inside RECORD_PATTERN_SIGNAL block',
    hasFetch,
    hasFetch ? undefined : 'Call not found in the case block — GL refresh may be missing',
  );

  // ── 1d. result is assigned to session.activePatternSignals ────────────────
  const hasAssign = /session\.activePatternSignals\s*=\s*refreshed/.test(caseBlock);
  assert(
    'session.activePatternSignals = refreshed is inside RECORD_PATTERN_SIGNAL block',
    hasAssign,
    hasAssign ? undefined : 'Assignment not found — GL refresh result may not reach the session',
  );

  // ── 1e. stability eventType maps to status 'stable' ───────────────────────
  const hasStableMapping = /stability\s*:\s*['"]stable['"]/.test(caseBlock);
  assert(
    "statusMap maps 'stability' → 'stable' in the case block",
    hasStableMapping,
    hasStableMapping ? undefined : "statusMap entry for stability not found — DB update may use wrong status",
  );

  // ── 1f. refresh happens after the DB update (ordering check) ──────────────
  const updateIdx  = caseBlock.indexOf('updateCompartmentStatus');
  const upsertIdx  = caseBlock.indexOf('upsertCompartment');
  const refreshIdx = caseBlock.indexOf('fetchPatternSignalContext');
  const assignIdx  = caseBlock.indexOf('session.activePatternSignals = refreshed');

  const dbUpdateIdx = Math.min(
    updateIdx  === -1 ? Infinity : updateIdx,
    upsertIdx  === -1 ? Infinity : upsertIdx,
  );

  const refreshAfterUpdate = refreshIdx > dbUpdateIdx;
  assert(
    'fetchPatternSignalContext is called AFTER the DB upsert/update',
    refreshAfterUpdate,
    refreshAfterUpdate
      ? undefined
      : 'Ordering wrong — refresh reads stale DB state before the write completes',
  );

  const assignAfterRefresh = assignIdx > refreshIdx;
  assert(
    'session.activePatternSignals assignment is AFTER fetchPatternSignalContext call',
    assignAfterRefresh,
    assignAfterRefresh
      ? undefined
      : 'Assignment comes before refresh resolves — session carries stale patterns',
  );

  // ── 1g. refresh is inside a try/catch (async safety) ─────────────────────
  const hasTryCatch = caseBlock.includes('try {') && caseBlock.includes('catch (err');
  assert(
    'The async block is wrapped in try/catch (error safety)',
    hasTryCatch,
    hasTryCatch ? undefined : 'No try/catch found — uncaught rejection could crash session',
  );
}

part1();

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Pure signal logic: stable compartment absent from anchor
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — formatPatternSignals: stable compartments produce no anchor text'));
sep();

function makeCompartment(
  patternKey: string,
  status: CompartmentInstallation['status'],
): CompartmentInstallation {
  return {
    id: `${patternKey}-id`,
    userId: 'test-user',
    language: 'spanish',
    patternKey,
    status,
    poundingCount: 0,
    wobbleCount: status === 'wobbling' ? 1 : 0,
    derivationCount: 0,
    lastWobbledAt: status === 'wobbling' ? new Date() : null,
    stabilizedAt: status === 'stable' ? new Date() : null,
    generativeAt: null,
    lastDrilledAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as CompartmentInstallation;
}

function part2() {
  // ── 2a. Wobbling compartment DOES appear in signals ───────────────────────
  const wobblingOnly = [makeCompartment('ser-vs-estar', 'wobbling')];
  const beforeSignals = formatPatternSignals(wobblingOnly);
  assert(
    'Wobbling compartment produces non-null signal text (baseline)',
    beforeSignals !== null && beforeSignals.includes('ser-vs-estar'),
    `Got: ${JSON.stringify(beforeSignals)}`,
  );
  assert(
    'Wobbling compartment signal text contains "WOBBLING"',
    beforeSignals?.includes('WOBBLING') ?? false,
    `Got: ${JSON.stringify(beforeSignals)}`,
  );

  // ── 2b. Same compartment after stability → null (no anchor text) ──────────
  const nowStable = [makeCompartment('ser-vs-estar', 'stable')];
  const afterSignals = formatPatternSignals(nowStable);
  assert(
    'After stability event the compartment produces null (no active patterns)',
    afterSignals === null,
    `Got: ${JSON.stringify(afterSignals)} — expected null`,
  );

  // ── 2c. Mixed: one stable, one still wobbling — stable one absent ─────────
  const mixed = [
    makeCompartment('ser-vs-estar', 'stable'),
    makeCompartment('preterite-vs-imperfect', 'wobbling'),
  ];
  const mixedSignals = formatPatternSignals(mixed);
  assert(
    'Resolved pattern absent from mixed-compartment signals',
    mixedSignals !== null && !mixedSignals.includes('ser-vs-estar'),
    `Got: ${JSON.stringify(mixedSignals)}`,
  );
  assert(
    'Still-wobbling pattern remains in mixed-compartment signals',
    mixedSignals?.includes('preterite-vs-imperfect') ?? false,
    `Got: ${JSON.stringify(mixedSignals)}`,
  );

  // ── 2d. All stable → completely null (no stale reminder) ─────────────────
  const allStable = [
    makeCompartment('ser-vs-estar', 'stable'),
    makeCompartment('preterite-vs-imperfect', 'stable'),
  ];
  const allStableSignals = formatPatternSignals(allStable);
  assert(
    'All compartments stable → null (anchor fully cleared)',
    allStableSignals === null,
    `Got: ${JSON.stringify(allStableSignals)} — expected null`,
  );
}

part2();

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — State-machine simulation of the GL fire-and-forget block
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — State-machine simulation: stability event clears session anchor'));
sep();

/**
 * Simulates the RECORD_PATTERN_SIGNAL fire-and-forget block without a live DB.
 * Mirrors the exact logic in native-fc-handlers.ts lines ~4158-4234.
 *
 * Instead of calling real storage methods, it uses an in-memory compartment
 * map and the real formatPatternSignals (pure function that backs
 * fetchPatternSignalContext) to produce the refreshed signals string.
 */
async function simulateRecordPatternSignal(params: {
  session: { activePatternSignals: string | null; [k: string]: any };
  compartments: CompartmentInstallation[];
  patternKey: string;
  eventType: 'wobble' | 'stability' | 'derivation' | 'pounding' | 'unlock' | 'review';
}): Promise<void> {
  const { session, compartments, patternKey, eventType } = params;

  // ── Replicated statusMap from RECORD_PATTERN_SIGNAL ──────────────────────
  const existing = compartments.find(c => c.patternKey === patternKey);
  const statusMap: Record<string, string> = {
    pounding:   (existing?.status && existing.status !== 'unstarted') ? existing.status : 'pounding',
    wobble:     'wobbling',
    stability:  'stable',
    derivation: 'generative',
    unlock:     (existing?.status && existing.status !== 'unstarted') ? existing.status : 'pounding',
    review:     (existing?.status && existing.status !== 'unstarted') ? existing.status : 'pounding',
  };
  const newStatus = statusMap[eventType] as CompartmentInstallation['status'];

  // ── Apply update to in-memory compartment map (mirrors DB upsert/update) ─
  const updated = compartments.map(c =>
    c.patternKey === patternKey ? { ...c, status: newStatus } : c,
  );

  // ── Simulate fetchPatternSignalContext (uses pure formatPatternSignals) ───
  const refreshed = formatPatternSignals(updated);

  // ── Write back to session (the GL-path refresh) ───────────────────────────
  session.activePatternSignals = refreshed;
}

async function part3() {
  // ── 3a. Single wobbling pattern cleared by stability ──────────────────────
  {
    const session = {
      activePatternSignals: '- ser-vs-estar: WOBBLING — slipped back after partial stability (last wobble today). Needs revisiting.',
    };
    const compartments: CompartmentInstallation[] = [
      makeCompartment('ser-vs-estar', 'wobbling'),
    ];

    await simulateRecordPatternSignal({ session, compartments, patternKey: 'ser-vs-estar', eventType: 'stability' });

    assert(
      '[3a] session.activePatternSignals is null after single-wobble resolved',
      session.activePatternSignals === null,
      `Got: ${JSON.stringify(session.activePatternSignals)}`,
    );
  }

  // ── 3b. Two patterns, one resolves — only resolved one removed ────────────
  {
    const session = {
      activePatternSignals: [
        '- ser-vs-estar: WOBBLING — slipped back (last wobble today). Needs revisiting.',
        '- preterite-vs-imperfect: WOBBLING — slipped back (last wobble yesterday). Needs revisiting.',
      ].join('\n'),
    };
    const compartments: CompartmentInstallation[] = [
      makeCompartment('ser-vs-estar', 'wobbling'),
      makeCompartment('preterite-vs-imperfect', 'wobbling'),
    ];

    await simulateRecordPatternSignal({ session, compartments, patternKey: 'ser-vs-estar', eventType: 'stability' });

    assert(
      '[3b] Resolved pattern removed from session.activePatternSignals',
      !(session.activePatternSignals ?? '').includes('ser-vs-estar'),
      `Got: ${JSON.stringify(session.activePatternSignals)}`,
    );
    assert(
      '[3b] Still-wobbling pattern retained in session.activePatternSignals',
      (session.activePatternSignals ?? '').includes('preterite-vs-imperfect'),
      `Got: ${JSON.stringify(session.activePatternSignals)}`,
    );
  }

  // ── 3c. wobble event on stable pattern does NOT re-clear other signals ────
  {
    const session = {
      activePatternSignals: null as string | null,
    };
    const compartments: CompartmentInstallation[] = [
      makeCompartment('ser-vs-estar', 'stable'),
    ];

    // A new wobble arrives for the previously-stable pattern
    await simulateRecordPatternSignal({ session, compartments, patternKey: 'ser-vs-estar', eventType: 'wobble' });

    assert(
      '[3c] New wobble event re-appears in session.activePatternSignals',
      (session.activePatternSignals ?? '').includes('ser-vs-estar'),
      `Got: ${JSON.stringify(session.activePatternSignals)}`,
    );
  }

  // ── 3d. Stability event on already-stable compartment → signals stay null ─
  {
    const session = {
      activePatternSignals: null as string | null,
    };
    const compartments: CompartmentInstallation[] = [
      makeCompartment('ser-vs-estar', 'stable'),
    ];

    await simulateRecordPatternSignal({ session, compartments, patternKey: 'ser-vs-estar', eventType: 'stability' });

    assert(
      '[3d] Redundant stability on already-stable compartment keeps signals null',
      session.activePatternSignals === null,
      `Got: ${JSON.stringify(session.activePatternSignals)}`,
    );
  }
}

await part3();

// ══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════════════════════════════
sep();
const total = passed + failed;
if (failed === 0) {
  console.log(G(`\n✓ All ${total} checks passed — GL pattern-signal refresh is wired correctly.\n`));
  console.log(D('  The GL native handler calls fetchPatternSignalContext after every'));
  console.log(D("  record_pattern_signal DB upsert and writes the result to session.activePatternSignals,"));
  console.log(D('  so a wobble resolved mid-session stops appearing in Daniela\'s next reminder.\n'));
  process.exit(0);
} else {
  console.log(R(`\n✗ ${failed} of ${total} checks failed — GL refresh may be broken.\n`));
  process.exit(1);
}
