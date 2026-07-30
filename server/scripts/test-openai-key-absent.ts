/**
 * test-openai-key-absent.ts
 *
 * Verifies that pronunciation analysis and strip-translation both fail
 * *explicitly* (throw / return a real error) when no OpenAI API key is set,
 * rather than silently returning garbage or an empty result.
 *
 * Usage:
 *   npx tsx server/scripts/test-openai-key-absent.ts
 *
 * Exit code: 0 = all checks passed, 1 = at least one check failed.
 */

export {}; // Required: makes this file a module so top-level await is valid.

// ── helpers ──────────────────────────────────────────────────────────────────

const OPENAI_KEY_VARS = [
  'AI_INTEGRATIONS_OPENAI_API_KEY',
  'AI_INTEGRATIONS_OPENAI_BASE_URL',
  'USER_OPENAI_API_KEY',
  'OPENAI_API_KEY',
] as const;

type Saved = Partial<Record<(typeof OPENAI_KEY_VARS)[number], string>>;

function clearOpenAIKeys(): Saved {
  const saved: Saved = {};
  for (const key of OPENAI_KEY_VARS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  return saved;
}

function restoreOpenAIKeys(saved: Saved): void {
  for (const key of OPENAI_KEY_VARS) {
    if (saved[key] !== undefined) {
      process.env[key] = saved[key];
    }
  }
}

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

// ── Test 1: getEffectiveOpenAIKey returns null when all vars are absent ───────

console.log('\n[1] getEffectiveOpenAIKey() with no env vars');
{
  const saved = clearOpenAIKeys();
  try {
    // Dynamic import so the module is loaded AFTER we clear the keys.
    // (The lazy factory reads process.env at call time, not at module load time.)
    const { getEffectiveOpenAIKey } = await import('../pronunciation-analysis.js');
    const key = getEffectiveOpenAIKey();
    if (key === null) {
      pass('returns null when all OpenAI env vars are absent');
    } else {
      fail('expected null but got a key', String(key).slice(0, 8) + '…');
    }
  } finally {
    restoreOpenAIKeys(saved);
  }
}

// ── Test 2: analyzePronunciation throws (not silently returns neutral) ────────

console.log('\n[2] analyzePronunciation() with no env vars');
{
  const saved = clearOpenAIKeys();
  try {
    const { analyzePronunciation } = await import('../pronunciation-analysis.js');
    try {
      const result = await analyzePronunciation('hola', 'Spanish', 'beginner');
      // If we reach here the function returned instead of throwing — bad.
      if ((result as any).score === 70) {
        fail(
          'returned neutral score 70 instead of throwing',
          'silent failure — caller cannot distinguish config error from real analysis'
        );
      } else {
        fail('returned a result instead of throwing', JSON.stringify(result));
      }
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (msg.includes('No OpenAI API key') || msg.includes('API key')) {
        pass(`threw with clear message: "${msg}"`);
      } else {
        fail('threw but message does not mention the missing API key', msg);
      }
    }
  } finally {
    restoreOpenAIKeys(saved);
  }
}

// ── Test 3: strip-translation error response does NOT include translations:{} ─

console.log('\n[3] strip-translation error response shape');
{
  // We cannot call the live HTTP endpoint from this script without a running
  // server, so we replicate the error-path logic directly and assert on the
  // response body the handler would send.
  //
  // The handler (routes.ts) now does:
  //   res.status(500).json({ message });   ← no translations key
  // We verify the shape here by reading the source.

  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const routesPath = path.join(process.cwd(), 'server', 'routes.ts');
  const source = await fs.readFile(routesPath, 'utf8');

  // Find the strip-translation catch block
  const catchIdx = source.indexOf('[strip-translation] Error:');
  if (catchIdx === -1) {
    fail('could not find [strip-translation] Error: marker in routes.ts');
  } else {
    const snippet = source.slice(catchIdx, catchIdx + 600);

    // Must NOT include translations:{} on the error path
    if (snippet.includes("translations: {}")) {
      fail(
        "error response still contains translations: {} — callers will treat it as empty success",
        snippet.slice(0, 200)
      );
    } else {
      pass('error response does not include translations: {}');
    }

    // Must send a meaningful message
    if (snippet.includes("'Translation failed'") || snippet.includes('"Translation failed"')) {
      pass("error response includes a 'Translation failed' message");
    } else {
      fail('error response does not include a clear message string');
    }

    // Config-error branch must name the missing key
    if (
      snippet.includes('No OpenAI API key') ||
      snippet.includes('OpenAI API key not configured')
    ) {
      pass('config-error branch surfaces a key-specific message');
    } else {
      fail('config-error branch does not mention missing OpenAI API key');
    }
  }
}

// ── Test 4: proxy-startup-check logs an error when no OpenAI key is set ──────

console.log('\n[4] runProxyStartupChecks() logs error when no OpenAI key is set');
{
  const saved = clearOpenAIKeys();
  try {
    const { runProxyStartupChecks } = await import('../services/proxy-startup-check.js');

    const errors: string[] = [];
    const origError = console.error.bind(console);
    (console as any).error = (...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
    };

    await runProxyStartupChecks();
    (console as any).error = origError;

    const openaiError = errors.find(e => e.includes('OpenAI') && e.toLowerCase().includes('key'));
    if (openaiError) {
      pass(`logs error: "${openaiError.slice(0, 120)}"`);
    } else {
      fail('no error logged for missing OpenAI key', errors.join(' | ').slice(0, 200));
    }
  } finally {
    restoreOpenAIKeys(saved);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('\nSome checks failed. See details above.');
  process.exit(1);
} else {
  console.log('\nAll checks passed.');
  process.exit(0);
}
