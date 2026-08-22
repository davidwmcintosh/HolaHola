/**
 * test-openai-key-absent.test.ts
 *
 * CI guard: verifies that pronunciation analysis and strip-translation both
 * fail *explicitly* (throw / return a real error) when no OpenAI API key is
 * set, rather than silently returning garbage or an empty result.
 *
 * Run via:  npx tsx --test server/scripts/test-openai-key-absent.test.ts
 * Or via:   npm test  (included in the explicit test list)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

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
    } else {
      delete process.env[key];
    }
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OpenAI key absent — explicit failure checks', () => {
  it('getEffectiveOpenAIKey() returns null when all env vars are absent', async () => {
    const saved = clearOpenAIKeys();
    try {
      // Dynamic import so the module is loaded AFTER we clear the keys.
      // The lazy factory reads process.env at call time, not at module load time.
      const { getEffectiveOpenAIKey } = await import('../pronunciation-analysis.js');
      const key = getEffectiveOpenAIKey();
      assert.strictEqual(
        key,
        null,
        `Expected null but got a key: ${String(key).slice(0, 8)}…`
      );
    } finally {
      restoreOpenAIKeys(saved);
    }
  });

  it('analyzePronunciation() throws with a clear message when no key is set', async () => {
    const saved = clearOpenAIKeys();
    try {
      const { analyzePronunciation } = await import('../pronunciation-analysis.js');
      await assert.rejects(
        async () => {
          await analyzePronunciation('hola', 'Spanish', 'beginner');
        },
        (err: any) => {
          const msg: string = err?.message ?? '';
          assert.ok(
            msg.includes('No OpenAI API key') || msg.includes('API key'),
            `Threw but message does not mention the missing API key: "${msg}"`
          );
          return true;
        }
      );
    } finally {
      restoreOpenAIKeys(saved);
    }
  });

  it('strip-translation error response does not include translations: {}', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const routesPath = path.join(process.cwd(), 'server', 'routes.ts');
    const source = await fs.readFile(routesPath, 'utf8');

    const catchIdx = source.indexOf('[strip-translation] Error:');
    assert.ok(
      catchIdx !== -1,
      'Could not find [strip-translation] Error: marker in routes.ts'
    );

    const snippet = source.slice(catchIdx, catchIdx + 600);

    assert.ok(
      !snippet.includes('translations: {}'),
      'Error response still contains translations: {} — callers will treat it as empty success'
    );

    assert.ok(
      snippet.includes("'Translation failed'") || snippet.includes('"Translation failed"'),
      "Error response does not include a 'Translation failed' message"
    );

    assert.ok(
      snippet.includes('No OpenAI API key') || snippet.includes('OpenAI API key not configured'),
      'Config-error branch does not mention missing OpenAI API key'
    );
  });

  it('runProxyStartupChecks() logs an error when no OpenAI key is set', async () => {
    const saved = clearOpenAIKeys();
    try {
      const { runProxyStartupChecks } = await import('../services/proxy-startup-check.js');

      const errors: string[] = [];
      const origError = console.error.bind(console);
      (console as any).error = (...args: unknown[]) => {
        errors.push(args.map(String).join(' '));
      };

      try {
        await runProxyStartupChecks();
      } finally {
        (console as any).error = origError;
      }

      const openaiError = errors.find(
        e => e.includes('OpenAI') && e.toLowerCase().includes('key')
      );
      assert.ok(
        openaiError != null,
        `No error logged for missing OpenAI key. Logged: ${errors.join(' | ').slice(0, 200)}`
      );
    } finally {
      restoreOpenAIKeys(saved);
    }
  });
});
