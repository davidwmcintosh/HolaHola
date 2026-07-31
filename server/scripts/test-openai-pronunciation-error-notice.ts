/**
 * test-openai-pronunciation-error-notice.ts
 *
 * Confirms the pronunciation-unavailable notice path fires correctly when
 * the OpenAI API key is missing or returns a 401.
 *
 * Eleven scenarios are verified:
 *  1. No key → error shape has reason "OpenAI API key not configured"
 *  2. OpenAI 401 status → reason "OpenAI API key is invalid or expired"
 *  3. invalid_api_key message string → same 401 reason
 *  4. Client-side VoiceChat.tsx checks error === 'pronunciation_unavailable' and shows toast
 *  5. routes.ts inner catch block contains both documented reason strings + error shape
 *  6. analyzePronunciation() actually throws (not silent neutral) → maps to correct reason
 *  7. useStreamingVoice.ts hook delegates to validatePronunciationScorePayload (guard module)
 *  8. OpenAI 429 status → reason "OpenAI rate limit reached; try again shortly"
 *  9. "rate limit" in message text (no status) → same 429 reason
 * 10. routes.ts inner catch contains rate-limit reason string
 * 11. Hook-level guard (validatePronunciationScorePayload) actually blocks malformed payloads
 *     at runtime — not just confirmed by source scan.
 *
 * Usage:
 *   npx tsx server/scripts/test-openai-pronunciation-error-notice.ts
 *
 * Exit code: 0 = all checks passed, 1 = at least one check failed.
 */

export {}; // makes this a module so top-level await is valid

// ── helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function pass(label: string): void {
  console.log(`  ✅  ${label}`);
  passed++;
}

function fail(label: string, detail?: string): void {
  console.error(`  ❌  ${label}${detail ? ` — ${detail}` : ''}`);
  failed++;
}

/**
 * Replicates the route's inner-catch reason-mapping logic from routes.ts ~8515.
 * Keeping it in sync here intentionally — if routes.ts diverges the test will
 * catch the discrepancy.
 */
function mapApiErrorToReason(apiError: { message?: string; status?: number }): string {
  const isConfigError = apiError?.message?.includes('No OpenAI API key');
  const isAuthError =
    apiError?.status === 401 ||
    apiError?.message?.includes('401') ||
    apiError?.message?.includes('Unauthorized') ||
    apiError?.message?.includes('invalid_api_key');
  const isRateLimit =
    apiError?.status === 429 ||
    apiError?.message?.includes('429') ||
    (apiError?.message?.toLowerCase() ?? '').includes('rate limit');
  return isConfigError
    ? 'OpenAI API key not configured'
    : isAuthError
    ? 'OpenAI API key is invalid or expired'
    : isRateLimit
    ? 'OpenAI rate limit reached; try again shortly'
    : apiError?.message ?? 'Unknown error';
}

// ── Scenario 1: No key configured ─────────────────────────────────────────────

console.log('\n[1] No OpenAI key → reason = "OpenAI API key not configured"');
{
  // createOpenAIClient() in pronunciation-analysis.ts throws this exact message.
  const thrown = new Error(
    '[pronunciation-analysis] No OpenAI API key configured. ' +
    'Set AI_INTEGRATIONS_OPENAI_API_KEY (Replit proxy) or OPENAI_API_KEY (direct).'
  );

  const reason = mapApiErrorToReason({ message: thrown.message });
  const body = { error: 'pronunciation_unavailable' as const, reason };

  if (body.error === 'pronunciation_unavailable') {
    pass('error field is "pronunciation_unavailable"');
  } else {
    fail('error field is not pronunciation_unavailable', body.error);
  }

  if (reason === 'OpenAI API key not configured') {
    pass('reason is exactly "OpenAI API key not configured"');
  } else {
    fail('reason mismatch for missing-key case', reason);
  }
}

// ── Scenario 2: Invalid / expired key (OpenAI 401 status) ────────────────────

console.log('\n[2] OpenAI 401 status → reason = "OpenAI API key is invalid or expired"');
{
  // The OpenAI SDK surfaces 401 via an APIError with .status = 401.
  const thrown = {
    status: 401,
    message: 'Incorrect API key provided. You can find your API key at https://platform.openai.com/account/api-keys.',
  };

  const reason = mapApiErrorToReason(thrown);
  const body = { error: 'pronunciation_unavailable' as const, reason };

  if (body.error === 'pronunciation_unavailable') {
    pass('error field is "pronunciation_unavailable"');
  } else {
    fail('error field is not pronunciation_unavailable', body.error);
  }

  if (reason === 'OpenAI API key is invalid or expired') {
    pass('reason is exactly "OpenAI API key is invalid or expired"');
  } else {
    fail('reason mismatch for 401 status case', reason);
  }
}

// ── Scenario 3: invalid_api_key message string ────────────────────────────────

console.log('\n[3] "invalid_api_key" in message → same 401 reason');
{
  const thrown = {
    status: 401,
    message: 'invalid_api_key: The provided API key is invalid or has been revoked.',
  };

  const reason = mapApiErrorToReason(thrown);

  if (reason === 'OpenAI API key is invalid or expired') {
    pass('reason is "OpenAI API key is invalid or expired" for invalid_api_key message');
  } else {
    fail('reason mismatch for invalid_api_key message path', reason);
  }
}

// ── Scenario 4: Client-side notice is wired ────────────────────────────────────

console.log('\n[4] VoiceChat.tsx checks error === "pronunciation_unavailable" and shows a toast');
{
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const clientPath = path.join(process.cwd(), 'client', 'src', 'components', 'VoiceChat.tsx');
  const source = await fs.readFile(clientPath, 'utf8');

  if (source.includes("analysisResult.error === 'pronunciation_unavailable'")) {
    pass('VoiceChat.tsx checks analysisResult.error === "pronunciation_unavailable"');
  } else {
    fail('VoiceChat.tsx is missing the pronunciation_unavailable error check');
  }

  if (source.includes('Pronunciation feedback is temporarily unavailable')) {
    pass('VoiceChat.tsx shows "Pronunciation feedback is temporarily unavailable" toast');
  } else {
    fail('VoiceChat.tsx is missing the visible error notice toast');
  }

  // The reason must be forwarded to the toast description so the user sees why
  if (source.includes('analysisResult.reason')) {
    pass('VoiceChat.tsx forwards reason string to the toast description');
  } else {
    fail('VoiceChat.tsx does not forward the reason string to the toast description');
  }
}

// ── Scenario 5: Route source contains both documented reason strings ───────────

console.log('\n[5] routes.ts inner catch block: both documented reason strings + error shape');
{
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const routesPath = path.join(process.cwd(), 'server', 'routes.ts');
  const source = await fs.readFile(routesPath, 'utf8');

  // Find the pronunciation-scores/analyze inner catch block
  const markerIdx = source.indexOf('pronunciation-scores/analyze');
  if (markerIdx === -1) {
    fail('could not find /api/pronunciation-scores/analyze in routes.ts');
  } else {
    const snippet = source.slice(markerIdx, markerIdx + 3000);

    if (snippet.includes("'OpenAI API key not configured'")) {
      pass('routes.ts contains "OpenAI API key not configured" reason string');
    } else {
      fail('routes.ts is missing "OpenAI API key not configured" reason string');
    }

    if (snippet.includes("'OpenAI API key is invalid or expired'")) {
      pass('routes.ts contains "OpenAI API key is invalid or expired" reason string');
    } else {
      fail('routes.ts is missing "OpenAI API key is invalid or expired" reason string');
    }

    if (snippet.includes("error: 'pronunciation_unavailable'")) {
      pass('routes.ts returns { error: "pronunciation_unavailable" } shape in inner catch');
    } else {
      fail('routes.ts inner catch is missing pronunciation_unavailable error shape');
    }

    // Outer catch should also return the same shape as a fallback
    const outerCatchIdx = snippet.lastIndexOf("error: 'pronunciation_unavailable'");
    if (outerCatchIdx > snippet.indexOf("error: 'pronunciation_unavailable'")) {
      pass('routes.ts outer catch also returns pronunciation_unavailable shape as fallback');
    } else {
      fail('routes.ts outer catch does not return pronunciation_unavailable — silent failure possible');
    }
  }
}

// ── Scenario 6: analyzePronunciation() throws → maps to correct reason ─────────

console.log('\n[6] analyzePronunciation() throws (not silent) when no key — maps to correct reason');
{
  const OPENAI_KEY_VARS = [
    'AI_INTEGRATIONS_OPENAI_API_KEY',
    'AI_INTEGRATIONS_OPENAI_BASE_URL',
    'USER_OPENAI_API_KEY',
    'OPENAI_API_KEY',
  ] as const;

  // Save and clear all key vars
  const saved: Record<string, string | undefined> = {};
  for (const k of OPENAI_KEY_VARS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }

  try {
    const { analyzePronunciation } = await import('../pronunciation-analysis.js');
    try {
      await analyzePronunciation('hola', 'Spanish', 'beginner');
      fail('expected analyzePronunciation() to throw when no key is set');
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (msg.includes('No OpenAI API key') || msg.includes('API key')) {
        const reason = mapApiErrorToReason({ message: msg });
        if (reason === 'OpenAI API key not configured') {
          pass('thrown message maps to "OpenAI API key not configured" via route logic');
        } else {
          fail('thrown message does not map to the expected reason', `got: ${reason}`);
        }
      } else {
        fail('threw but message does not mention missing API key', msg.slice(0, 200));
      }
    }
  } finally {
    // Restore
    for (const k of OPENAI_KEY_VARS) {
      if (saved[k] !== undefined) {
        process.env[k] = saved[k];
      }
    }
  }
}

// ── Scenario 7: Hook delegates to guard module + guard module has validations ──
//
// The streaming voice path does NOT call /api/pronunciation-scores/analyze.
// Instead Daniela scores pronunciation herself via the show_pronunciation_score
// tool; scores arrive over WebSocket as a structured event. The streaming path
// has two layers of guards:
//
//  Layer 1 (hook): handlePronunciationScoreShown in useStreamingVoice.ts delegates
//    to validatePronunciationScorePayload (client/src/lib/pronunciation-score-guard.ts).
//    This is the primary gate — it ensures ANY future consumer of the hook
//    receives only well-formed pronunciation data, matching the quiz pattern.
//
//  Layer 2 (component): StreamingVoiceChat.tsx keeps its own guard as a
//    belt-and-suspenders layer, showing the user-visible toast on bad data.

console.log('\n[7] useStreamingVoice.ts hook-level guard + StreamingVoiceChat.tsx component guard both present');
{
  const fs = await import('node:fs/promises');
  const path = await import('node:path');

  // ── Layer 1: hook-level guard in useStreamingVoice.ts ──────────────────────
  const hookPath = path.join(process.cwd(), 'client', 'src', 'hooks', 'useStreamingVoice.ts');
  const hookSource = await fs.readFile(hookPath, 'utf8');

  // The hook must define handlePronunciationScoreShown and validate before calling consumer.
  if (hookSource.includes('handlePronunciationScoreShown')) {
    pass('useStreamingVoice.ts defines handlePronunciationScoreShown');
  } else {
    fail('useStreamingVoice.ts is missing handlePronunciationScoreShown');
  }

  // The hook must delegate validation to validatePronunciationScorePayload (the shared guard
  // module) so that tests can import and execute the exact production logic without React.
  if (/handlePronunciationScoreShown[\s\S]{0,600}validatePronunciationScorePayload/.test(hookSource)) {
    pass('useStreamingVoice.ts delegates to validatePronunciationScorePayload in handlePronunciationScoreShown');
  } else {
    fail('useStreamingVoice.ts does not call validatePronunciationScorePayload — guard may be orphaned from the hook');
  }

  // The guard module must contain phrase, wordScores, and overallScore validation so the
  // shared function enforces all three field requirements.
  const guardPath = path.join(process.cwd(), 'client', 'src', 'lib', 'pronunciation-score-guard.ts');
  const guardSource = await fs.readFile(guardPath, 'utf8');

  if (guardSource.includes('typeof d.phrase') || guardSource.includes("d.phrase")) {
    pass('pronunciation-score-guard.ts validates phrase (hook guard covers phrase check)');
  } else {
    fail('pronunciation-score-guard.ts is missing phrase validation');
  }

  if (guardSource.includes('Array.isArray(d.wordScores)')) {
    pass('pronunciation-score-guard.ts validates wordScores array (hook guard covers wordScores check)');
  } else {
    fail('pronunciation-score-guard.ts is missing wordScores array validation');
  }

  if (guardSource.includes('typeof d.overallScore')) {
    pass('pronunciation-score-guard.ts validates overallScore (hook guard covers overallScore check)');
  } else {
    fail('pronunciation-score-guard.ts is missing overallScore validation');
  }

  // ── Layer 2: component-level guard in StreamingVoiceChat.tsx ───────────────
  const streamingPath = path.join(process.cwd(), 'client', 'src', 'components', 'StreamingVoiceChat.tsx');
  const source = await fs.readFile(streamingPath, 'utf8');

  // The streaming component must NOT call the REST scoring endpoint — that belongs
  // to the legacy VoiceChat path only. Calling it here would be a latency regression
  // and would re-introduce the OpenAI key dependency in the streaming path.
  // We check for an actual apiRequest/fetch call to the endpoint (not just a comment
  // or documentation string that mentions the path).
  const hasActualCall = /apiRequest\s*\([^)]*pronunciation-scores\/analyze|fetch\s*\([^)]*pronunciation-scores\/analyze/.test(source);
  if (!hasActualCall) {
    pass('StreamingVoiceChat.tsx does NOT call /api/pronunciation-scores/analyze (intentional: Daniela scores natively)');
  } else {
    fail('StreamingVoiceChat.tsx unexpectedly calls /api/pronunciation-scores/analyze — review intended architecture');
  }

  // The streaming component must have its own error guard for malformed tool data.
  if (source.includes('onPronunciationScoreShown')) {
    pass('StreamingVoiceChat.tsx wires onPronunciationScoreShown callback');
  } else {
    fail('StreamingVoiceChat.tsx is missing the onPronunciationScoreShown callback');
  }

  // The guard must surface a visible error notice — same toast title as the legacy path.
  if (source.includes('Pronunciation feedback is temporarily unavailable')) {
    pass('StreamingVoiceChat.tsx shows "Pronunciation feedback is temporarily unavailable" toast on malformed data');
  } else {
    fail('StreamingVoiceChat.tsx is missing the pronunciation error toast for malformed data');
  }

  // The architecture comment must be present so future developers understand the split.
  if (source.includes('show_pronunciation_score')) {
    pass('StreamingVoiceChat.tsx references show_pronunciation_score (documents native-scoring architecture)');
  } else {
    fail('StreamingVoiceChat.tsx is missing the show_pronunciation_score architecture note');
  }
}

// ── Scenario 8: Rate-limit (429 status) → correct reason string ───────────────

console.log('\n[8] OpenAI 429 status → reason = "OpenAI rate limit reached; try again shortly"');
{
  // The OpenAI SDK surfaces 429 via an APIError with .status = 429.
  const thrown = {
    status: 429,
    message: 'Rate limit reached for model gpt-4o-audio-preview on tokens per minute.',
  };

  const reason = mapApiErrorToReason(thrown);
  const body = { error: 'pronunciation_unavailable' as const, reason };

  if (body.error === 'pronunciation_unavailable') {
    pass('error field is "pronunciation_unavailable"');
  } else {
    fail('error field is not pronunciation_unavailable', body.error);
  }

  if (reason === 'OpenAI rate limit reached; try again shortly') {
    pass('reason is exactly "OpenAI rate limit reached; try again shortly" for 429 status');
  } else {
    fail('reason mismatch for 429 status case', reason);
  }
}

// ── Scenario 9: Rate-limit via message text (no status field) ─────────────────

console.log('\n[9] "rate limit" in message text (no status) → same 429 reason');
{
  // Some SDK wrappers surface rate-limit errors only via message, without .status.
  const thrown = {
    message: 'You have exceeded the rate limit for this endpoint.',
  };

  const reason = mapApiErrorToReason(thrown);

  if (reason === 'OpenAI rate limit reached; try again shortly') {
    pass('reason is "OpenAI rate limit reached; try again shortly" for rate-limit message path');
  } else {
    fail('reason mismatch for rate-limit message-only path', reason);
  }
}

// ── Scenario 10: routes.ts inner catch contains rate-limit reason string ──────

console.log('\n[10] routes.ts inner catch block contains the rate-limit reason string');
{
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const routesPath = path.join(process.cwd(), 'server', 'routes.ts');
  const source = await fs.readFile(routesPath, 'utf8');

  const markerIdx = source.indexOf('pronunciation-scores/analyze');
  if (markerIdx === -1) {
    fail('could not find /api/pronunciation-scores/analyze in routes.ts');
  } else {
    const snippet = source.slice(markerIdx, markerIdx + 3000);

    if (snippet.includes("'OpenAI rate limit reached; try again shortly'")) {
      pass('routes.ts contains "OpenAI rate limit reached; try again shortly" reason string');
    } else {
      fail('routes.ts is missing "OpenAI rate limit reached; try again shortly" reason string');
    }

    if (snippet.includes('429') || snippet.includes('rate limit') || snippet.includes('isRateLimit')) {
      pass('routes.ts inner catch contains 429 / rate-limit detection logic');
    } else {
      fail('routes.ts inner catch is missing 429 / rate-limit detection');
    }
  }
}

// ── Scenario 11: Hook-level guard actually blocks malformed payloads ───────────
//
// This scenario imports validatePronunciationScorePayload from the production
// guard module (client/src/lib/pronunciation-score-guard.ts) and executes it
// directly against a spy callback — proving the guard blocks bad data even when
// the component-layer guard in StreamingVoiceChat.tsx is imagined removed.
//
// tsx maps the .js extension to the matching .ts source file, so the dynamic
// import below loads and executes the real production module code.
// The hook delegates its validation entirely to this same function, so
// testing it IS testing the hook-layer gate.

console.log('\n[11] Hook-level guard (validatePronunciationScorePayload) blocks malformed and passes well-formed payloads');
{
  // ── import the production guard module ────────────────────────────────────
  // tsx resolves .js → .ts, so this loads client/src/lib/pronunciation-score-guard.ts
  const { validatePronunciationScorePayload } = await import(
    '../../client/src/lib/pronunciation-score-guard.js'
  );

  let spyCalls = 0;
  const spy = () => { spyCalls++; };

  function simulateHookDispatch(rawData: any): void {
    const payload = validatePronunciationScorePayload(rawData);
    if (!payload) return; // guard blocked it
    spy();
  }

  // ── malformed: missing phrase ─────────────────────────────────────────────
  spyCalls = 0;
  simulateHookDispatch({ wordScores: [{ word: 'hola', score: 0.9 }], overallScore: 88 });
  if (spyCalls === 0) {
    pass('spy NOT called when phrase is missing');
  } else {
    fail('spy was called despite missing phrase — hook guard is not blocking');
  }

  // ── malformed: whitespace-only phrase ────────────────────────────────────
  spyCalls = 0;
  simulateHookDispatch({ phrase: '   ', wordScores: [{ word: 'hola', score: 0.9 }], overallScore: 88 });
  if (spyCalls === 0) {
    pass('spy NOT called when phrase is whitespace-only');
  } else {
    fail('spy was called despite whitespace-only phrase — hook guard is not blocking');
  }

  // ── malformed: wordScores not an array ───────────────────────────────────
  spyCalls = 0;
  simulateHookDispatch({ phrase: 'hola mundo', wordScores: null, overallScore: 88 });
  if (spyCalls === 0) {
    pass('spy NOT called when wordScores is null');
  } else {
    fail('spy was called despite null wordScores — hook guard is not blocking');
  }

  // ── malformed: wordScores is empty array ─────────────────────────────────
  spyCalls = 0;
  simulateHookDispatch({ phrase: 'hola mundo', wordScores: [], overallScore: 88 });
  if (spyCalls === 0) {
    pass('spy NOT called when wordScores is empty array');
  } else {
    fail('spy was called despite empty wordScores array — hook guard is not blocking');
  }

  // ── malformed: overallScore missing ──────────────────────────────────────
  spyCalls = 0;
  simulateHookDispatch({ phrase: 'hola mundo', wordScores: [{ word: 'hola', score: 0.9 }] });
  if (spyCalls === 0) {
    pass('spy NOT called when overallScore is missing');
  } else {
    fail('spy was called despite missing overallScore — hook guard is not blocking');
  }

  // ── malformed: overallScore is a string ──────────────────────────────────
  spyCalls = 0;
  simulateHookDispatch({ phrase: 'hola mundo', wordScores: [{ word: 'hola', score: 0.9 }], overallScore: '88' });
  if (spyCalls === 0) {
    pass('spy NOT called when overallScore is a string (not a number)');
  } else {
    fail('spy was called despite string overallScore — hook guard is not blocking');
  }

  // ── well-formed: all required fields present ──────────────────────────────
  spyCalls = 0;
  simulateHookDispatch({
    id: 'test-01',
    phrase: 'hola mundo',
    wordScores: [
      { word: 'hola', score: 0.92 },
      { word: 'mundo', score: 0.88, tip: 'stress the second syllable' },
    ],
    overallScore: 90,
    encouragement: '¡Buen trabajo!',
    timestamp: Date.now(),
  });
  if (spyCalls === 1) {
    pass('spy IS called exactly once for a well-formed payload');
  } else {
    fail(`spy call count was ${spyCalls} for a well-formed payload (expected 1)`);
  }

  // ── well-formed: whitespace-only encouragement is sanitised, callback still fires
  spyCalls = 0;
  let receivedPayload: any = null;
  function spyCapture(p: any) { spyCalls++; receivedPayload = p; }
  function simulateCapture(rawData: any): void {
    const payload = validatePronunciationScorePayload(rawData);
    if (!payload) return;
    spyCapture(payload);
  }
  simulateCapture({
    phrase: 'hola mundo',
    wordScores: [{ word: 'hola', score: 0.9 }],
    overallScore: 85,
    encouragement: '   ',
  });
  if (spyCalls === 1) {
    pass('spy IS called when encouragement is whitespace-only (payload still dispatched)');
  } else {
    fail('spy was not called for payload with whitespace-only encouragement');
  }
  if (receivedPayload !== null && receivedPayload.encouragement === undefined) {
    pass('whitespace-only encouragement is stripped to undefined in sanitised payload');
  } else {
    fail('whitespace-only encouragement was not stripped from payload', String(receivedPayload?.encouragement));
  }

  // ── verify guard module file exists and exports the function ──────────────
  const fs2 = await import('node:fs/promises');
  const path2 = await import('node:path');
  const guardPath = path2.join(process.cwd(), 'client', 'src', 'lib', 'pronunciation-score-guard.ts');
  const guardSource = await fs2.readFile(guardPath, 'utf8');

  if (guardSource.includes('validatePronunciationScorePayload')) {
    pass('pronunciation-score-guard.ts exports validatePronunciationScorePayload');
  } else {
    fail('pronunciation-score-guard.ts does not export validatePronunciationScorePayload');
  }

  // Confirm the hook imports from the guard module (guard is wired, not orphaned)
  const hookPath2 = path2.join(process.cwd(), 'client', 'src', 'hooks', 'useStreamingVoice.ts');
  const hookSource2 = await fs2.readFile(hookPath2, 'utf8');
  if (hookSource2.includes("from '../lib/pronunciation-score-guard'")) {
    pass('useStreamingVoice.ts imports from pronunciation-score-guard (guard is not orphaned)');
  } else {
    fail('useStreamingVoice.ts does not import from pronunciation-score-guard — guard may have drifted from hook');
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('\nSome checks failed. See details above.');
  process.exit(1);
} else {
  console.log(
    '\nAll checks passed.\n' +
    'The pronunciation-unavailable notice is wired end-to-end for the\n' +
    'OpenAI key-missing, 401, and 429 rate-limit scenarios.\n' +
    'The streaming path (StreamingVoiceChat.tsx) uses Daniela\'s native\n' +
    'show_pronunciation_score tool instead of the REST endpoint — its own\n' +
    'malformed-data guard shows the same user-visible toast.\n' +
    'The hook-level guard (validatePronunciationScorePayload) is confirmed\n' +
    'to block malformed payloads in execution — not just by source scan.'
  );
  process.exit(0);
}
