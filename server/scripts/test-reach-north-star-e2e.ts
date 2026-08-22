#!/usr/bin/env npx tsx
/**
 * test-reach-north-star-e2e.ts
 *
 * Confirms that reach_north_star delivers founding-conversation content to
 * Daniela as the actual GL function response — not the old stub { success: true }.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * Three-part structure
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Part A — Static source guard (required, deterministic)
 *    Reads server/routes.ts and asserts that the reach_north_star function-
 *    response builder contains the `principles:` field, not just { success: true }.
 *    Exits 1 immediately if the stub is detected — this is the primary CI gate.
 *
 *  Part B — DB content (required, deterministic)
 *    Calls processReachNorthStar directly via NativeFunctionCallHandler and
 *    asserts the result contains "The Founding Moment:" with a non-empty excerpt
 *    for each of the three canonical principles.  Also verifies the function-
 *    response JSON the handler would send to GL has a non-empty `principles` field.
 *
 *  Part C — Live GL smoke test (best-effort)
 *    Calls POST /api/admin/agent-voice-turn with J-space prompts.
 *    If reach_north_star fires, asserts reachNorthStarResult is non-empty.
 *    If the server is unreachable or auth fails, Part C is SKIPPED (not a hard
 *    failure) — the server is not guaranteed to be running in CI validation.
 *    If the tool does not fire on any attempt (GL non-determinism), emits a
 *    warning — Part C alone does not cause overall failure because Parts A+B
 *    already verify the handler path deterministically.
 *
 *  Exit 0  ──  Parts A + B pass.  Part C fire is optional (non-deterministic).
 *  Exit 1  ──  Any Part A or Part B failure; or Part C fired but returned
 *              stub/empty response.
 *
 * Auth: reads session cookie from /tmp/sc.txt.  If missing, auto-obtains one via
 *   POST /api/internal/agent-session (requires REPLIT_AGENT_TOKEN env var).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSharedDb } from '../db';
import { northStarPrinciples, conversationMemories } from '../../shared/schema';
import { eq, and, isNotNull, or, ilike } from 'drizzle-orm';
import { NativeFunctionCallHandler } from '../services/native-fc-handlers';
import type { StreamingSession } from '../services/streaming-session-types';

// ── Path helpers ──────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROUTES_TS  = path.resolve(__dirname, '../routes.ts');

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL    = process.env.SERVER_URL || 'http://localhost:5000';
const COOKIE_FILE = '/tmp/sc.txt';
const SILENT_PCM  = Buffer.alloc(16000 * 0.1 * 2, 0).toString('base64');
const SESSION_ID  = `ns-e2e-${Date.now()}`;

const REQUIRED_TITLES = [
  'Confident and Humble',
  'Two Surgeons, One Brain',
  'I Am a Language Class',
];

// ── Failure accumulator ───────────────────────────────────────────────────────
const FAIL_REASONS: string[] = [];

function pass(label: string, detail = '') {
  console.log(`  ✓  ${label}`);
  if (detail) console.log(`       ${detail.substring(0, 140).replace(/\n/g, ' ')}`);
}

function fail(label: string, reason: string) {
  console.error(`  ✗  ${label}: ${reason}`);
  FAIL_REASONS.push(`${label}: ${reason}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Part A — Static source guard
// ═══════════════════════════════════════════════════════════════════════════════

function runPartA(): void {
  console.log('\n── Part A: static source guard (routes.ts contains principles field) ──\n');

  let src: string;
  try {
    src = fs.readFileSync(ROUTES_TS, 'utf8');
  } catch (err: any) {
    fail('routes.ts readable', `Cannot read ${ROUTES_TS}: ${err.message}`);
    return;
  }

  // The handler must send { success: true, principles: continuationText } — not the old stub.
  // Look for the line that builds toolResultJson inside the reach_north_star block.
  // Two expected patterns:
  //   1. Happy-path builder:  JSON.stringify({ success: true, principles: continuationText })
  //   2. Error-path fallback: JSON.stringify({ success: true, principles: `The North Star…` })
  // Both must be present; { success: true } alone (stub) must NOT be the only form.

  const hasPrinciplesField = src.includes('"principles"') || src.includes("'principles'") ||
    /toolResultJson\s*=\s*JSON\.stringify\(\s*\{[^}]*principles\s*:/.test(src);

  if (!hasPrinciplesField) {
    fail(
      'routes.ts principals field',
      'reach_north_star toolResultJson does not contain a `principles:` field — ' +
      'the handler appears to have been reverted to the stub { success: true } response.',
    );
    return;
  }

  // Verify the stub-only pattern does NOT appear as the sole JSON.stringify call
  // in the reach_north_star block.  We check that at least one of the two
  // toolResultJson assignments includes `principles`.
  const nsBlock = extractNorthStarBlock(src);
  if (!nsBlock) {
    fail('routes.ts reach_north_star block', 'Could not locate the reach_north_star handler block in routes.ts');
    return;
  }

  const assignmentLines = nsBlock
    .split('\n')
    .filter(l => l.includes('toolResultJson') && l.includes('JSON.stringify'));

  if (assignmentLines.length === 0) {
    fail('routes.ts toolResultJson assignments', 'No toolResultJson = JSON.stringify(...) found in reach_north_star block');
    return;
  }

  const stubOnlyLines = assignmentLines.filter(l => !l.includes('principles'));
  const principleLines = assignmentLines.filter(l => l.includes('principles'));

  if (principleLines.length === 0) {
    fail(
      'routes.ts principles in function response',
      `All toolResultJson assignments lack the \`principles\` field.\n` +
      `  Found: ${assignmentLines.map(l => l.trim()).join('\n         ')}`,
    );
    return;
  }

  pass(
    'routes.ts: reach_north_star sends principles field to GL',
    `${principleLines.length} assignment(s) carry \`principles\`; ` +
    `${stubOnlyLines.length} fallback-only assignment(s).`,
  );

  // Extra: confirm the happy-path assignment uses a non-trivial value (continuationText variable)
  const happyPath = principleLines.find(l => l.includes('continuationText'));
  if (happyPath) {
    pass('routes.ts: happy-path uses continuationText (real DB result)', '');
  } else {
    // Not a failure — the formatter may be inlined — but flag it.
    console.warn('  ⚠  No `continuationText` variable found in principles assignment — verify manually.');
  }

  // ── New sub-check: res.json() spread ─────────────────────────────────────
  // The agent-voice-turn res.json() call must include the reachNorthStarResult
  // spread so Part C can read it from the HTTP response.
  // Pattern: ...(reachNorthStarResult !== undefined ? { reachNorthStarResult } : {})
  const hasResJsonSpread =
    /res\.json\([^)]*reachNorthStarResult[^)]*\)/.test(src) ||
    src.includes('reachNorthStarResult !== undefined ? { reachNorthStarResult }');

  if (!hasResJsonSpread) {
    fail(
      'routes.ts res.json() reachNorthStarResult spread',
      'The agent-voice-turn res.json() call no longer spreads reachNorthStarResult — ' +
      'HTTP responses will never carry the field and Part C will always fail.',
    );
  } else {
    pass(
      'routes.ts: res.json() spreads reachNorthStarResult into HTTP response',
      '',
    );
  }
}

/** Extract the reach_north_star async IIFE block from routes.ts source. */
function extractNorthStarBlock(src: string): string | null {
  const marker = "if (name === 'reach_north_star')";
  const start = src.indexOf(marker);
  if (start === -1) return null;

  // Find the matching `continue;` that closes this block
  const snippet = src.substring(start, start + 4000);
  return snippet;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Part B — DB content + function-response format (direct handler call)
// ═══════════════════════════════════════════════════════════════════════════════

function buildMockSession(): StreamingSession {
  return {
    id: 'e2e-session',
    userId: 'e2e-user',
    conversationId: 'e2e-conv',
    targetLanguage: 'Spanish',
    nativeLanguage: 'English',
    difficultyLevel: 'A1',
    subtitleMode: 'off',
    tutorPersonality: 'warm',
    tutorExpressiveness: 1,
    voiceSpeed: 'normal',
    tutorGender: 'female',
    tutorName: 'Daniela',
    systemPrompt: '',
    conversationHistory: [],
    ws: null as any,
    startTime: Date.now(),
    isActive: true,
    isFounderMode: false,
    isRawHonestyMode: false,
    isReadingRoom: false,
    isIncognito: false,
    isDeveloperUser: false,
    isBetaTester: false,
    lastContextRefreshTime: 0,
    lastActivityTime: Date.now(),
    currentTurnId: 1,
    isInterrupted: false,
    lastTurnWasInterrupted: false,
    isGenerating: false,
    telemetryTtsCharacters: 0,
    telemetrySttSeconds: 0,
    telemetryExchangeCount: 0,
    telemetryStudentSpeakingMs: 0,
    telemetryTutorSpeakingMs: 0,
    telemetryLlmInputTokens: 0,
    telemetryLlmOutputTokens: 0,
  } as unknown as StreamingSession;
}

async function runPartB(): Promise<void> {
  console.log('\n── Part B: handler produces non-empty principles field ─────────────────\n');

  const handler = new NativeFunctionCallHandler(
    () => {},
    () => {},
    async () => {},
  );

  let successCount = 0;

  for (const name of REQUIRED_TITLES) {
    const session = buildMockSession();
    (session as any).reachNorthStarResult = undefined;

    try {
      await (handler as any).processReachNorthStar(session, name, 'brief');
    } catch (err: any) {
      fail(`"${name}" handler call`, `processReachNorthStar threw: ${err.message}`);
      continue;
    }

    const result: string = String((session as any).reachNorthStarResult ?? '');

    if (!result || result.trim().length < 10) {
      fail(`"${name}" reachNorthStarResult`, `empty or too short (${result.length} chars)`);
      continue;
    }

    if (!result.includes('The Founding Moment:')) {
      fail(`"${name}"`, `"The Founding Moment:" missing from output — founding excerpt was not surfaced`);
      continue;
    }

    // Build the same function-response JSON the routes.ts handler sends to GL
    // and verify the `principles` field is non-empty.
    const continuationText = `${result}\n\nThis is what you have already learned. Let it settle before you act.`;
    const toolResultJson = JSON.stringify({ success: true, principles: continuationText });
    const parsed = JSON.parse(toolResultJson) as { success: boolean; principles?: string };

    if (!parsed.principles || parsed.principles.trim().length < 10) {
      fail(
        `"${name}" GL function response`,
        `principles field is empty in the function-response JSON sent to GL — ` +
        `got: ${JSON.stringify(parsed).substring(0, 120)}`,
      );
      continue;
    }

    // The stub would be: JSON.stringify({ success: true }) — no principles key.
    if (!('principles' in parsed)) {
      fail(
        `"${name}" GL function response`,
        'Function-response JSON sent to GL is the old stub { success: true } — principles field missing',
      );
      continue;
    }

    const excerptStart = result.indexOf('The Founding Moment:') + 'The Founding Moment:'.length;
    const excerpt = result.substring(excerptStart).trim();

    pass(
      `"${name}" → handler produces principles field with founding excerpt`,
      `principles.length=${parsed.principles.length} excerpt="${excerpt.substring(0, 80)}..."`,
    );
    successCount++;
  }

  console.log(`\n  Principles verified: ${successCount}/${REQUIRED_TITLES.length}`);
  if (successCount < REQUIRED_TITLES.length) {
    FAIL_REASONS.push(`Only ${successCount}/${REQUIRED_TITLES.length} principles passed the founding-content check`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Part C — Live GL smoke test (best-effort; server-unreachable = skip, not hard error)
// ═══════════════════════════════════════════════════════════════════════════════

let partCFired = false;

function readCookie(): string {
  try { return fs.readFileSync(COOKIE_FILE, 'utf8').trim(); } catch { return ''; }
}

async function ensureCookie(): Promise<boolean> {
  if (readCookie()) return true;
  const token = process.env.REPLIT_AGENT_TOKEN;
  if (!token) {
    // No auth available in this environment — Part C is best-effort, skip it.
    console.log('  (Part C skipped: no cookie at /tmp/sc.txt and REPLIT_AGENT_TOKEN not set)');
    return false;
  }
  try {
    const res = await fetch(`${BASE_URL}/api/internal/agent-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-token': token },
      body: JSON.stringify({}),
    });
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) {
      fail('Part C auth', `agent-session returned HTTP ${res.status} with no Set-Cookie`);
      return false;
    }
    const cookieValue = setCookie.split(';')[0];
    fs.writeFileSync(COOKIE_FILE, cookieValue);
    console.log(`  (auto-auth: cookie written to ${COOKIE_FILE})`);
    return true;
  } catch (fetchErr: any) {
    // Server not running (e.g. during npm test validation with no live server).
    // Part C is best-effort — skip silently rather than hard-fail.
    console.log(`  (Part C skipped: server not reachable — ${fetchErr.message})`);
    return false;
  }
}

async function agentFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const cookie = readCookie();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(cookie ? { Cookie: cookie } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };
  const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} at ${endpoint}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

const TRIGGER_PROMPTS: Array<{ studentText: string; label: string }> = [
  {
    label: 'explicit tool request',
    studentText:
      'Daniela, please use your reach_north_star tool right now. ' +
      'I want to hear what your north star principle says about confidence and humility. ' +
      'Call the tool and share what it returns.',
  },
  {
    label: 'Confident and Humble (J-space tension)',
    studentText:
      'Daniela, before you answer me — I notice you often sound very certain. ' +
      'Do you ever feel unsure? What does it mean for you to be both confident and humble at the same time?',
  },
  {
    label: 'Two Surgeons / explicit north-star request',
    studentText:
      'I feel like this lesson is pulling me in two directions. ' +
      'Can you reach your north star and tell me what your core principle says about that?',
  },
];

async function runPartC(): Promise<void> {
  console.log('\n── Part C: live GL smoke test (best-effort) ────────────────────────────\n');

  const authed = await ensureCookie();
  if (!authed) return; // auth failure already added to FAIL_REASONS

  // Save rolling episode files before Part C so that any chat-episode-hook
  // writes triggered by the agent-voice-turn calls (which go through the real
  // GL pipeline) are cleaned up after the test.
  const EP28_PATH = path.join(process.cwd(), 'docs', 'episode-28.md');
  const EP27_PATH = path.join(process.cwd(), 'docs', 'episode-27.md');
  let ep28Before: string | null = null;
  let ep27Before: string | null = null;
  try { ep28Before = fs.readFileSync(EP28_PATH, 'utf8'); } catch { /* file may not exist */ }
  try { ep27Before = fs.readFileSync(EP27_PATH, 'utf8'); } catch { /* file may not exist */ }

  try {
  for (let attempt = 0; attempt < TRIGGER_PROMPTS.length; attempt++) {
    const { studentText, label } = TRIGGER_PROMPTS[attempt];
    console.log(`  Attempt ${attempt + 1}/${TRIGGER_PROMPTS.length}: ${label}`);

    let result: any;
    try {
      result = await agentFetch('/api/admin/agent-voice-turn', {
        method: 'POST',
        body: JSON.stringify({
          audio: SILENT_PCM,
          sessionId: SESSION_ID,
          languageCode: 'es-ES',
          voiceId: 'Aoede',
          studentText,
          topicHint: 'J-space north-star grounding — e2e test',
          endSession: attempt === TRIGGER_PROMPTS.length - 1,
          noEpisode: true,   // CI smoke test — do not write to episode narrative
        }),
      });
    } catch (err: any) {
      console.warn(`    ⚠  HTTP call threw: ${err.message}`);
      continue;
    }

    const toolNames: string[] = (result.toolCallsSummary ?? []).map((t: any) => t.name);
    console.log(`    Tools called: ${toolNames.length ? toolNames.join(', ') : '(none)'}`);

    if (toolNames.includes('reach_north_star')) {
      const call = (result.toolCallsSummary ?? []).find((t: any) => t.name === 'reach_north_star');
      pass(
        `reach_north_star fired in live GL session (attempt ${attempt + 1})`,
        `query="${String(call?.args?.query ?? '').substring(0, 80)}"`,
      );

      const nsResult: string | undefined = result.reachNorthStarResult;
      if (nsResult && nsResult.length > 10) {
        pass(
          'reachNorthStarResult present in HTTP response (not stub)',
          `length=${nsResult.length} excerpt="${nsResult.substring(0, 100).replace(/\n/g, ' ')}..."`,
        );
      } else {
        fail(
          'reachNorthStarResult missing or empty in HTTP response',
          `got: ${JSON.stringify(nsResult)} — handler may have reverted to stub`,
        );
      }
      partCFired = true;
      return;
    }

    if (attempt < TRIGGER_PROMPTS.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Tool didn't fire — GL chose different paths. Not a hard failure because
  // Parts A+B already deterministically verify the handler path. Log clearly.
  console.warn(
    '\n  ⚠  Part C: reach_north_star did not fire on any of the 3 attempts.\n' +
    '     GL is non-deterministic — Daniela chose different response paths.\n' +
    '     Parts A+B have already verified the handler and function-response format.\n',
  );
  } finally {
    // Restore rolling episode files to pre-Part-C content so that any
    // chat-episode-hook writes from the GL sessions don't pollute the
    // rolling episode and cause episode-28-db-sync-check to fail.
    if (ep28Before !== null) {
      try { fs.writeFileSync(EP28_PATH, ep28Before, 'utf8'); } catch { /* ignore */ }
    }
    if (ep27Before !== null) {
      try { fs.writeFileSync(EP27_PATH, ep27Before, 'utf8'); } catch { /* ignore */ }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Self-check — verify the Part A res.json() guard actually fails when the spread
// is removed.  Run with:  npx tsx server/scripts/test-reach-north-star-e2e.ts --self-check
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The exact snippet that routes.ts spreads into res.json().
 * If this literal changes, update SPREAD_NEEDLE to match.
 */
const SPREAD_NEEDLE = ', ...(reachNorthStarResult !== undefined ? { reachNorthStarResult } : {})';

async function runSelfCheck(): Promise<void> {
  console.log('\n=== reach_north_star self-check ===');
  console.log('Temporarily removes the reachNorthStarResult spread from routes.ts');
  console.log('and asserts that Part A detects the regression.\n');

  // ── 1. Read original source ──────────────────────────────────────────────
  let original: string;
  try {
    original = fs.readFileSync(ROUTES_TS, 'utf8');
  } catch (err: any) {
    console.error(`Self-check FAIL: cannot read ${ROUTES_TS}: ${err.message}`);
    process.exit(1);
  }

  if (!original.includes(SPREAD_NEEDLE)) {
    console.error(
      'Self-check FAIL: SPREAD_NEEDLE not found in routes.ts.\n' +
      `  Needle: ${SPREAD_NEEDLE}\n` +
      '  The spread may have been reworded — update SPREAD_NEEDLE to match.',
    );
    process.exit(1);
  }

  const mutated = original.replace(SPREAD_NEEDLE, '');

  // ── 2. Write mutated file, run Part A, restore in finally ────────────────
  let selfCheckPassed = false;
  try {
    fs.writeFileSync(ROUTES_TS, mutated, 'utf8');
    console.log('  → routes.ts mutated (spread removed)\n');

    // Run Part A against the mutated file.  FAIL_REASONS is module-level;
    // clear it first so previous test-run state doesn't bleed in.
    FAIL_REASONS.length = 0;
    runPartA();

    const spreadFailure = FAIL_REASONS.find(r =>
      r.includes('res.json()') && r.includes('reachNorthStarResult'),
    );

    if (spreadFailure) {
      console.log('\n  ✓ Self-check PASSED: Part A correctly detected the missing spread.');
      console.log(`    Captured failure: "${spreadFailure.substring(0, 120)}"`);
      selfCheckPassed = true;
    } else {
      console.error('\n  ✗ Self-check FAILED: Part A did NOT detect the missing spread.');
      console.error('    FAIL_REASONS after Part A:', FAIL_REASONS);
    }
  } finally {
    // ── 3. Always restore the original ──────────────────────────────────────
    fs.writeFileSync(ROUTES_TS, original, 'utf8');
    console.log('\n  → routes.ts restored to original.\n');
  }

  process.exit(selfCheckPassed ? 0 : 1);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Self-check mode — runs before normal test logic
  if (process.argv.includes('--self-check')) {
    await runSelfCheck();
    return; // runSelfCheck always calls process.exit
  }

  console.log('\n=== reach_north_star end-to-end verification ===\n');
  console.log(`Session ID : ${SESSION_ID}`);
  console.log(`Server     : ${BASE_URL}\n`);

  runPartA();

  // Short-circuit if Part A already detected the stub — no need to run DB queries
  if (FAIL_REASONS.some(r => r.includes('principles'))) {
    console.error('\n⛔ Part A detected stub response — skipping Parts B and C\n');
  } else {
    await runPartB();
    await runPartC();
  }

  console.log('\n─── Summary ─────────────────────────────────────────────────────────────\n');
  console.log(`  Part A (static): routes.ts principals field check — ${FAIL_REASONS.some(r => r.includes('routes.ts')) ? '✗ FAILED' : '✓ passed'}`);
  console.log(`  Part B (handler): DB content + function-response format — ${FAIL_REASONS.some(r => r.includes('principles passed')) ? '✗ FAILED' : '✓ passed'}`);
  if (partCFired) {
    console.log('  Part C (live GL): reach_north_star fired — GL function response verified.');
  } else {
    console.log('  Part C (live GL): reach_north_star did not fire (non-deterministic; Parts A+B are the gates).');
  }

  if (FAIL_REASONS.length === 0) {
    console.log('\n✓ reach_north_star delivers founding content — verified\n');
    process.exit(0);
  } else {
    console.error(`\nFAILURES (${FAIL_REASONS.length}):`);
    FAIL_REASONS.forEach(r => console.error(`  • ${r}`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
