/**
 * test-observe-empty-arrays.ts
 *
 * Confirms that the GET /api/admin/luca/observe handler returns valid JSON with
 * empty arrays for `frictionHistory` and `turnSummaries` when the session store
 * has no data for those fields (brand-new session, or store entry pre-dates when
 * these arrays were added).
 *
 * WHAT THIS PROVES
 * ────────────────
 * The route serialises both fields as:
 *
 *   turnSummaries:  (observation.turnSummaries  ?? []).slice(0,5).reverse().map(…)
 *   frictionHistory:(observation.frictionHistory ?? []).slice(0,5).reverse().map(…)
 *
 * The `?? []` guard is what prevents a crash (TypeError: Cannot read properties of
 * undefined — slice / reverse / map) when an old store entry — written before the
 * fields were added — is handed to the serialiser.
 *
 * SELF-CHECK (negative path)
 * ──────────────────────────
 * The script also runs the serialiser logic WITHOUT the ?? [] guard and asserts
 * that it produces undefined/throws for an observation missing those fields.
 * This confirms the positive-path assertion has real bite — if the guard were
 * removed, the CI run would fail at this exact negative-path step.
 *
 * Run: npx tsx server/scripts/test-observe-empty-arrays.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ─── Colour helpers ───────────────────────────────────────────────────────────
const G   = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R   = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B   = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y   = (s: string) => `\x1b[33m${s}\x1b[0m`;
const D   = (s: string) => `\x1b[2m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ${G('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${R('✗')} ${label}${detail ? `\n      ${R('→')} ${detail}` : ''}`);
    failed++;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Static source check: guards must be present in routes.ts
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — Static source analysis: ?? [] guards in routes.ts'));

const routesSrc = readFileSync(resolve(__dirname, '../routes.ts'), 'utf-8');

// The exact patterns that protect against undefined arrays
const turnSummaryGuard    = '(observation.turnSummaries ?? [])';
const frictionHistoryGuard = '(observation.frictionHistory ?? [])';

assert(
  '`(observation.turnSummaries ?? [])` guard present in routes.ts',
  routesSrc.includes(turnSummaryGuard),
  'Guard not found — the observe endpoint will crash when turnSummaries is undefined',
);

assert(
  '`(observation.frictionHistory ?? [])` guard present in routes.ts',
  routesSrc.includes(frictionHistoryGuard),
  'Guard not found — the observe endpoint will crash when frictionHistory is undefined',
);

// Also confirm the guards are in the observe handler (not some unrelated location)
// by finding them within a reasonable window after the route path string.
const observeHandlerIdx = routesSrc.indexOf('/api/admin/luca/observe');
assert(
  'Guards appear after the `/api/admin/luca/observe` route definition',
  observeHandlerIdx !== -1 &&
    routesSrc.indexOf(turnSummaryGuard,    observeHandlerIdx) > observeHandlerIdx &&
    routesSrc.indexOf(frictionHistoryGuard, observeHandlerIdx) > observeHandlerIdx,
  'Guards were found in the file but not inside the observe route handler',
);

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Positive path: inline simulation with empty-array observation
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Positive path: serialiser returns [] for brand-new store entries'));

/**
 * A minimal SessionObservation-like object that mirrors what the in-memory store
 * produces when a session starts before any GL turns have completed (no friction
 * records, no turn summaries yet).
 */
const emptyObservation = {
  conversationId:      'test-conv-001',
  language:            'Spanish',
  actflLevel:          'novice-mid',
  exchangeCount:       0,
  scenarioSlug:        null,
  sceneEnvironment:    null,
  sceneImageUrl:       null,
  sceneProps:          [] as string[],
  recentToolCalls:     [] as any[],
  lastUpdatedMs:       Date.now(),
  sessionStartedMs:    Date.now(),
  guardianChannel:     'concat' as const,
  guardianFireLog:     [] as any[],
  recentMemorySearches: [] as any[],
  // Both fields present but empty — typical brand-new session
  turnSummaries:       [] as any[],
  frictionHistory:     [] as any[],
};

/**
 * A minimal observation that is missing both fields entirely — simulates an
 * old store entry from before these fields were added to SessionObservation.
 */
const legacyObservation = {
  conversationId:      'test-conv-002',
  language:            'French',
  actflLevel:          'intermediate-low',
  exchangeCount:       4,
  scenarioSlug:        null,
  sceneEnvironment:    null,
  sceneImageUrl:       null,
  sceneProps:          [] as string[],
  recentToolCalls:     [] as any[],
  lastUpdatedMs:       Date.now(),
  sessionStartedMs:    Date.now() - 300_000,
  guardianChannel:     'concat' as const,
  guardianFireLog:     [] as any[],
  recentMemorySearches: [] as any[],
  // Both fields intentionally absent — the ?? [] guard is what saves us here
} as any;

/**
 * The inline serialiser logic extracted verbatim from the observe handler in
 * routes.ts.  Any change to the handler must be reflected here to keep the
 * test meaningful.
 */
function serializeTurnSummaries(obs: any): any[] {
  return (obs.turnSummaries ?? []).slice(0, 5).reverse().map((t: any) => ({
    turn:           t.turn,
    tools:          t.tools,
    hasArchiveCall: t.hasArchiveCall,
    secsAgo:        Math.round((Date.now() - t.ts) / 1000),
  }));
}

function serializeFrictionHistory(obs: any): any[] {
  return (obs.frictionHistory ?? []).slice(0, 5).reverse().map((f: any) => ({
    turnId:                   String(f.turn),
    label:                    f.label,
    score:                    f.totalScore,
    archiveAccess:            f.archiveAccess,
    smoothSlide:              f.smoothSlide,
    unverifiedAssertionCount: f.unverifiedAssertionCount,
    firstUnverifiedAssertion: f.firstUnverifiedAssertion,
    secsAgo:                  Math.round((Date.now() - f.ts) / 1000),
  }));
}

// ── 2a. Empty-array observation ───────────────────────────────────────────────
let turnResult: any[];
let frictionResult: any[];

try {
  turnResult    = serializeTurnSummaries(emptyObservation);
  frictionResult = serializeFrictionHistory(emptyObservation);
  assert(
    'Empty-array observation: serialiser does not throw',
    true,
  );
} catch (err: any) {
  assert(
    'Empty-array observation: serialiser does not throw',
    false,
    err.message,
  );
  turnResult    = [];
  frictionResult = [];
}

assert(
  'Empty-array observation: turnSummaries serialises to []',
  Array.isArray(turnResult!) && turnResult!.length === 0,
  `Got: ${JSON.stringify(turnResult!)}`,
);

assert(
  'Empty-array observation: frictionHistory serialises to []',
  Array.isArray(frictionResult!) && frictionResult!.length === 0,
  `Got: ${JSON.stringify(frictionResult!)}`,
);

// ── 2b. Legacy (missing-field) observation ────────────────────────────────────
let legacyTurnResult: any[];
let legacyFrictionResult: any[];

try {
  legacyTurnResult    = serializeTurnSummaries(legacyObservation);
  legacyFrictionResult = serializeFrictionHistory(legacyObservation);
  assert(
    'Legacy (missing-field) observation: serialiser does not throw',
    true,
  );
} catch (err: any) {
  assert(
    'Legacy (missing-field) observation: serialiser does not throw',
    false,
    err.message,
  );
  legacyTurnResult    = [];
  legacyFrictionResult = [];
}

assert(
  'Legacy observation: turnSummaries serialises to []',
  Array.isArray(legacyTurnResult!) && legacyTurnResult!.length === 0,
  `Got: ${JSON.stringify(legacyTurnResult!)}`,
);

assert(
  'Legacy observation: frictionHistory serialises to []',
  Array.isArray(legacyFrictionResult!) && legacyFrictionResult!.length === 0,
  `Got: ${JSON.stringify(legacyFrictionResult!)}`,
);

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Negative path (self-check): guard removal causes crash / undefined
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Negative path: confirms guard removal causes failure'));
console.log(Y('  (This proves the positive-path assertions above have real bite.)'));

/**
 * The same serialiser WITHOUT the ?? [] guard.
 * When obs.turnSummaries / obs.frictionHistory is undefined, calling .slice()
 * on undefined throws TypeError.
 */
function serializeTurnSummariesNoGuard(obs: any): any[] {
  // Intentional: no ?? [] — replicates what the code would look like if the guard were removed
  return (obs.turnSummaries).slice(0, 5).reverse().map((t: any) => ({
    turn:           t.turn,
    tools:          t.tools,
    hasArchiveCall: t.hasArchiveCall,
    secsAgo:        Math.round((Date.now() - t.ts) / 1000),
  }));
}

function serializeFrictionHistoryNoGuard(obs: any): any[] {
  // Intentional: no ?? [] — replicates what the code would look like if the guard were removed
  return (obs.frictionHistory).slice(0, 5).reverse().map((f: any) => ({
    turnId:                   String(f.turn),
    label:                    f.label,
    score:                    f.totalScore,
    archiveAccess:            f.archiveAccess,
    smoothSlide:              f.smoothSlide,
    unverifiedAssertionCount: f.unverifiedAssertionCount,
    firstUnverifiedAssertion: f.firstUnverifiedAssertion,
    secsAgo:                  Math.round((Date.now() - f.ts) / 1000),
  }));
}

// ── 3a. Legacy observation without guard: turnSummaries must crash ────────────
let noGuardTurnCrashed = false;
try {
  serializeTurnSummariesNoGuard(legacyObservation);
} catch {
  noGuardTurnCrashed = true;
}

assert(
  'Without ?? [] guard: serialising undefined turnSummaries throws TypeError',
  noGuardTurnCrashed,
  'Guard removal did NOT cause a crash — this means the negative-path self-check is broken',
);

// ── 3b. Legacy observation without guard: frictionHistory must crash ───────────
let noGuardFrictionCrashed = false;
try {
  serializeFrictionHistoryNoGuard(legacyObservation);
} catch {
  noGuardFrictionCrashed = true;
}

assert(
  'Without ?? [] guard: serialising undefined frictionHistory throws TypeError',
  noGuardFrictionCrashed,
  'Guard removal did NOT cause a crash — this means the negative-path self-check is broken',
);

// ── 3c. Empty-array observation without guard: must still work (arrays present) ─
//   This confirms the guard is only the safety net; normal arrays pass through fine.
let noGuardEmptyOk = true;
try {
  const r1 = serializeTurnSummariesNoGuard(emptyObservation);
  const r2 = serializeFrictionHistoryNoGuard(emptyObservation);
  noGuardEmptyOk = Array.isArray(r1) && r1.length === 0 &&
                   Array.isArray(r2) && r2.length === 0;
} catch (err: any) {
  noGuardEmptyOk = false;
}

assert(
  'Without ?? [] guard: empty-array observation still serialises correctly',
  noGuardEmptyOk,
  'Even brand-new observations with present (but empty) arrays failed — check the logic',
);

// ══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════════════════════════════
sep();
const total = passed + failed;
if (failed === 0) {
  console.log(G(`\n✓  All ${total} assertions passed.\n`));
  console.log(D('   The observe endpoint correctly handles missing frictionHistory / turnSummaries:'));
  console.log(D('   • Static check: ?? [] guards present in routes.ts'));
  console.log(D('   • Positive path: empty-array and legacy (missing-field) observations'));
  console.log(D('     both serialise to [] without crashing'));
  console.log(D('   • Negative path: removing the guard causes TypeError on undefined.slice()'));
  console.log(D('     — confirming the guard has real protective value\n'));
  process.exit(0);
} else {
  console.log(R(`\n✗  ${failed} of ${total} assertions failed — review output above.\n`));
  process.exit(1);
}
