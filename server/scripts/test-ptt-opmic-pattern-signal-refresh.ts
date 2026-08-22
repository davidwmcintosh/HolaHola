/**
 * test-ptt-opmic-pattern-signal-refresh.ts
 *
 * Confirms that a mid-session `record_pattern_signal` call with eventType="stability"
 * on the PTT command-parser path and the OpenMic command-parser path each clear the
 * previously-wobbling pattern from `session.activePatternSignals` — so it no longer
 * appears in Daniela's next per-turn anchor.
 *
 * Task #333 — PTT/OpenMic complement to the GL test added by Task #282
 *   (server/scripts/test-gl-pattern-signal-refresh.ts).
 *
 * Both PTT and OpenMic paths live in:
 *   server/services/streaming-voice-orchestrator.ts
 *   PTT path   — case 'RECORD_PATTERN_SIGNAL' near line 3295
 *   OpenMic path — case 'RECORD_PATTERN_SIGNAL' near line 6753
 *
 * Three complementary checks for EACH path (PTT then OpenMic):
 *
 *   PART 1 — Source analysis
 *     Confirms each path imports fetchPatternSignalContext, has the case, calls the
 *     refresh function, writes to session.activePatternSignals, maps stability→stable,
 *     orders the assignment after the DB write, and wraps the async block in try/catch.
 *
 *   PART 2 — Pure signal logic (formatPatternSignals)
 *     A compartment transitioning from "wobbling" to "stable" produces null output
 *     from formatPatternSignals — the ground truth for "does the pattern still appear?"
 *     (Re-verified here to confirm the shared helper the PTT/OpenMic paths rely on.)
 *
 *   PART 3 — State-machine simulation
 *     Simulates the IIFE async block in each path without a live DB:
 *       session.activePatternSignals starts as a wobbling-pattern string.
 *       A stability event arrives → newStatus = 'stable'.
 *       formatPatternSignals (backing fetchPatternSignalContext) returns null.
 *       session.activePatternSignals is set to null.
 *
 * Run: npx tsx server/scripts/test-ptt-opmic-pattern-signal-refresh.ts
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

// ─── Load orchestrator source once ────────────────────────────────────────────
const orchSrc = readFileSync(
  resolve(__dirname, '../services/streaming-voice-orchestrator.ts'),
  'utf-8',
);

// ─── Extract the two RECORD_PATTERN_SIGNAL case blocks ────────────────────────
//
// The orchestrator has exactly two occurrences of case 'RECORD_PATTERN_SIGNAL':
//   1) PTT path  — logs "[PatternSignal]" (no "OpenMic" suffix)
//   2) OpenMic path — logs "[PatternSignal - OpenMic]"
//
// We split on the case label and take the text up to the next 'break;' that
// closes the case.  The block is bounded by the paired closing brace of the IIFE
// before the break, so we look for "break;" after the IIFE closing.

function extractCaseBlock(src: string, logMarker: string): string {
  // Find the RECORD_PATTERN_SIGNAL case that contains the given log marker
  const pattern = /case\s+'RECORD_PATTERN_SIGNAL'\s*:\s*\{([\s\S]*?)\}\s*\n?\s*case\s+'/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(src)) !== null) {
    if (m[1].includes(logMarker)) {
      return m[1];
    }
  }

  // Fallback: find all RECORD_PATTERN_SIGNAL case offsets and slice between them
  const offsets: number[] = [];
  const label = /case\s+'RECORD_PATTERN_SIGNAL'\s*:/g;
  let lm: RegExpExecArray | null;
  while ((lm = label.exec(src)) !== null) {
    offsets.push(lm.index);
  }

  for (const offset of offsets) {
    // Slice a generous window after the case label
    const window = src.slice(offset, offset + 2500);
    if (window.includes(logMarker)) {
      return window;
    }
  }
  return '';
}

const PTT_LOG_MARKER    = '[PatternSignal]';          // PTT path — no "OpenMic" suffix
const OPMIC_LOG_MARKER  = '[PatternSignal - OpenMic]';

const pttBlock   = extractCaseBlock(orchSrc, PTT_LOG_MARKER);
const opMicBlock = extractCaseBlock(orchSrc, OPMIC_LOG_MARKER);

// ══════════════════════════════════════════════════════════════════════════════
// PART 1a — Source analysis: PTT path
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1a — Source analysis: RECORD_PATTERN_SIGNAL refresh on PTT path'));
sep();

function sourceChecks(block: string, pathLabel: string) {
  // ── Import of fetchPatternSignalContext ─────────────────────────────────────
  const hasImport = orchSrc.includes("from './pattern-signal-context'") ||
                    orchSrc.includes('from "./pattern-signal-context"');
  assert(
    `${pathLabel}: streaming-voice-orchestrator.ts imports from pattern-signal-context`,
    hasImport,
    hasImport ? undefined : 'Import line not found',
  );

  // ── Case label exists ───────────────────────────────────────────────────────
  const hasCase = block.length > 0;
  assert(
    `${pathLabel}: case 'RECORD_PATTERN_SIGNAL' block found in orchestrator`,
    hasCase,
    hasCase ? undefined : `Log marker "${pathLabel}" not found — case may be missing`,
  );

  // ── fetchPatternSignalContext is called inside the block ────────────────────
  const hasFetch = block.includes('fetchPatternSignalContext');
  assert(
    `${pathLabel}: fetchPatternSignalContext is called inside the case block`,
    hasFetch,
    hasFetch ? undefined : 'Call not found — PTT/OpenMic refresh may be missing',
  );

  // ── Result assigned to session.activePatternSignals ────────────────────────
  const hasAssign = block.includes('session.activePatternSignals = refreshed');
  assert(
    `${pathLabel}: session.activePatternSignals = refreshed is in the block`,
    hasAssign,
    hasAssign ? undefined : 'Assignment not found — refresh result may not reach the session',
  );

  // ── stability → 'stable' status mapping ────────────────────────────────────
  const hasStableMapping =
    /eventType\s*===\s*['"]stability['"]\s*\)\s*newStatus\s*=\s*['"]stable['"]/.test(block) ||
    /stability['"]\s*[=:>]+\s*['"]stable/.test(block);
  assert(
    `${pathLabel}: stability eventType maps to newStatus = 'stable'`,
    hasStableMapping,
    hasStableMapping ? undefined : "Stability→stable mapping not found — DB update may use wrong status",
  );

  // ── Ordering: DB upsert before refresh, refresh before assignment ───────────
  const upsertIdx  = block.indexOf('upsertCompartment');
  const refreshIdx = block.indexOf('fetchPatternSignalContext');
  const assignIdx  = block.indexOf('session.activePatternSignals = refreshed');

  const refreshAfterUpsert = refreshIdx > upsertIdx && upsertIdx !== -1;
  assert(
    `${pathLabel}: fetchPatternSignalContext is called AFTER upsertCompartment`,
    refreshAfterUpsert,
    refreshAfterUpsert
      ? undefined
      : 'Ordering wrong — refresh reads stale DB state before the write completes',
  );

  const assignAfterRefresh = assignIdx > refreshIdx && refreshIdx !== -1;
  assert(
    `${pathLabel}: session.activePatternSignals assignment is AFTER fetchPatternSignalContext`,
    assignAfterRefresh,
    assignAfterRefresh
      ? undefined
      : 'Assignment comes before refresh resolves — session carries stale patterns',
  );

  // ── Async block wrapped in try/catch ────────────────────────────────────────
  const hasTryCatch = block.includes('try {') &&
    (block.includes('catch (err') || block.includes('catch(err'));
  assert(
    `${pathLabel}: async IIFE is wrapped in try/catch (error safety)`,
    hasTryCatch,
    hasTryCatch ? undefined : 'No try/catch found — uncaught rejection could crash session',
  );
}

sourceChecks(pttBlock, 'PTT');

// ══════════════════════════════════════════════════════════════════════════════
// PART 1b — Source analysis: OpenMic path
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1b — Source analysis: RECORD_PATTERN_SIGNAL refresh on OpenMic path'));
sep();

sourceChecks(opMicBlock, 'OpenMic');

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Pure signal logic shared by both paths
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
  // ── 2a. Wobbling compartment appears in signals (baseline) ─────────────────
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

  // ── 2b. Same compartment after stability → null ────────────────────────────
  const nowStable = [makeCompartment('ser-vs-estar', 'stable')];
  const afterSignals = formatPatternSignals(nowStable);
  assert(
    'After stability event compartment produces null (no active patterns)',
    afterSignals === null,
    `Got: ${JSON.stringify(afterSignals)} — expected null`,
  );

  // ── 2c. Mixed: one stable, one wobbling — stable absent, wobbling present ──
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
    'Still-wobbling pattern retained in mixed-compartment signals',
    mixedSignals?.includes('preterite-vs-imperfect') ?? false,
    `Got: ${JSON.stringify(mixedSignals)}`,
  );

  // ── 2d. All stable → completely null ──────────────────────────────────────
  const allStable = [
    makeCompartment('ser-vs-estar', 'stable'),
    makeCompartment('preterite-vs-imperfect', 'stable'),
  ];
  assert(
    'All compartments stable → null (anchor fully cleared)',
    formatPatternSignals(allStable) === null,
    'Expected null',
  );
}

part2();

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — State-machine simulation for PTT and OpenMic paths
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — State-machine simulation: stability event clears session anchor'));
sep();

/**
 * Simulates the IIFE async block in both RECORD_PATTERN_SIGNAL cases without a
 * live DB.  The logic mirrors what both PTT and OpenMic paths do:
 *
 *   1. Compute newStatus from eventType (same if-else chain in both paths)
 *   2. Apply the update to the in-memory compartment map
 *   3. Call formatPatternSignals (the pure function backing fetchPatternSignalContext)
 *   4. Write the result to session.activePatternSignals
 *
 * The path label is passed in for readable assertion names.
 */
async function simulatePath(params: {
  pathLabel: string;
  session: { activePatternSignals: string | null; [k: string]: unknown };
  compartments: CompartmentInstallation[];
  patternKey: string;
  eventType: 'wobble' | 'stability' | 'derivation' | 'pounding' | 'unlock' | 'review';
}): Promise<void> {
  const { session, compartments, patternKey, eventType } = params;

  // ── Replicated status logic from both PTT and OpenMic RECORD_PATTERN_SIGNAL ─
  const current = compartments.find(c => c.patternKey === patternKey);
  let newStatus: CompartmentInstallation['status'] = current?.status ?? 'unstarted';
  if (eventType === 'pounding' && newStatus === 'unstarted') newStatus = 'pounding';
  if (eventType === 'wobble') newStatus = 'wobbling';
  if (eventType === 'stability') newStatus = 'stable';
  if (eventType === 'derivation') newStatus = 'generative';

  // ── Apply update to in-memory map (mirrors upsertCompartment) ────────────
  const updated = compartments.map(c =>
    c.patternKey === patternKey ? { ...c, status: newStatus } : c,
  );

  // ── Simulate fetchPatternSignalContext (uses pure formatPatternSignals) ───
  const refreshed = formatPatternSignals(updated);

  // ── Write back to session ─────────────────────────────────────────────────
  session.activePatternSignals = refreshed;
}

async function part3() {
  for (const pathLabel of ['PTT', 'OpenMic']) {
    console.log(`\n  ${Y(`[${pathLabel} path]`)}`);

    // ── 3a. Single wobbling pattern cleared by stability ──────────────────────
    {
      const session: { activePatternSignals: string | null } = {
        activePatternSignals: '- ser-vs-estar: WOBBLING — slipped back after partial stability (last wobble today). Needs revisiting.',
      };
      const compartments: CompartmentInstallation[] = [
        makeCompartment('ser-vs-estar', 'wobbling'),
      ];

      await simulatePath({ pathLabel, session, compartments, patternKey: 'ser-vs-estar', eventType: 'stability' });

      assert(
        `[${pathLabel}/3a] session.activePatternSignals is null after single-wobble resolved`,
        session.activePatternSignals === null,
        `Got: ${JSON.stringify(session.activePatternSignals)}`,
      );
    }

    // ── 3b. Two patterns, one resolves — only resolved one removed ────────────
    {
      const session: { activePatternSignals: string | null } = {
        activePatternSignals: [
          '- ser-vs-estar: WOBBLING — slipped back (last wobble today). Needs revisiting.',
          '- preterite-vs-imperfect: WOBBLING — slipped back (last wobble yesterday). Needs revisiting.',
        ].join('\n'),
      };
      const compartments: CompartmentInstallation[] = [
        makeCompartment('ser-vs-estar', 'wobbling'),
        makeCompartment('preterite-vs-imperfect', 'wobbling'),
      ];

      await simulatePath({ pathLabel, session, compartments, patternKey: 'ser-vs-estar', eventType: 'stability' });

      assert(
        `[${pathLabel}/3b] Resolved pattern removed from session.activePatternSignals`,
        !(session.activePatternSignals ?? '').includes('ser-vs-estar'),
        `Got: ${JSON.stringify(session.activePatternSignals)}`,
      );
      assert(
        `[${pathLabel}/3b] Still-wobbling pattern retained in session.activePatternSignals`,
        (session.activePatternSignals ?? '').includes('preterite-vs-imperfect'),
        `Got: ${JSON.stringify(session.activePatternSignals)}`,
      );
    }

    // ── 3c. New wobble event re-adds pattern to cleared signals ───────────────
    {
      const session: { activePatternSignals: string | null } = {
        activePatternSignals: null,
      };
      const compartments: CompartmentInstallation[] = [
        makeCompartment('ser-vs-estar', 'stable'),
      ];

      await simulatePath({ pathLabel, session, compartments, patternKey: 'ser-vs-estar', eventType: 'wobble' });

      assert(
        `[${pathLabel}/3c] New wobble event re-appears in session.activePatternSignals`,
        (session.activePatternSignals ?? '').includes('ser-vs-estar'),
        `Got: ${JSON.stringify(session.activePatternSignals)}`,
      );
    }

    // ── 3d. Stability on already-stable compartment keeps signals null ─────────
    {
      const session: { activePatternSignals: string | null } = {
        activePatternSignals: null,
      };
      const compartments: CompartmentInstallation[] = [
        makeCompartment('ser-vs-estar', 'stable'),
      ];

      await simulatePath({ pathLabel, session, compartments, patternKey: 'ser-vs-estar', eventType: 'stability' });

      assert(
        `[${pathLabel}/3d] Redundant stability on already-stable compartment keeps signals null`,
        session.activePatternSignals === null,
        `Got: ${JSON.stringify(session.activePatternSignals)}`,
      );
    }

    // ── 3e. Pounding event on fresh compartment adds to signals ───────────────
    {
      const session: { activePatternSignals: string | null } = {
        activePatternSignals: null,
      };
      const compartments: CompartmentInstallation[] = [
        makeCompartment('subjunctive-mood', 'unstarted'),
      ];

      await simulatePath({ pathLabel, session, compartments, patternKey: 'subjunctive-mood', eventType: 'pounding' });

      assert(
        `[${pathLabel}/3e] Pounding event on fresh compartment adds pattern to signals`,
        (session.activePatternSignals ?? '').includes('subjunctive-mood'),
        `Got: ${JSON.stringify(session.activePatternSignals)}`,
      );
    }
  }
}

await part3();

// ══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════════════════════════════
sep();
const total = passed + failed;
if (failed === 0) {
  console.log(G(`\n✓ All ${total} checks passed — PTT and OpenMic pattern-signal refresh is wired correctly.\n`));
  console.log(D('  Both the PTT command-parser path and the OpenMic command-parser path call'));
  console.log(D('  fetchPatternSignalContext after every record_pattern_signal DB upsert'));
  console.log(D("  and write the result to session.activePatternSignals, so a wobble resolved"));
  console.log(D("  mid-session stops appearing in Daniela's next per-turn anchor.\n"));
  process.exit(0);
} else {
  console.log(R(`\n✗ ${failed} of ${total} checks failed — PTT/OpenMic refresh may be broken.\n`));
  process.exit(1);
}
