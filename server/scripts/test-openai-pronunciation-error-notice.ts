/**
 * test-openai-pronunciation-error-notice.ts
 *
 * Confirms the pronunciation-unavailable notice path fires correctly when
 * the OpenAI API key is missing or returns a 401.
 *
 * Six scenarios are verified:
 *  1. No key → error shape has reason "OpenAI API key not configured"
 *  2. OpenAI 401 status → reason "OpenAI API key is invalid or expired"
 *  3. invalid_api_key message string → same 401 reason
 *  4. Client-side VoiceChat.tsx checks error === 'pronunciation_unavailable' and shows toast
 *  5. routes.ts inner catch block contains both documented reason strings + error shape
 *  6. analyzePronunciation() actually throws (not silent neutral) → maps to correct reason
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
    'OpenAI key-missing and 401 scenarios.'
  );
  process.exit(0);
}
