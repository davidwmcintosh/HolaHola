/**
 * test-synthesis-cache-identity-invalidation.ts
 *
 * CI check: confirms that getOrCreateSynthesisCache() discards a stale
 * persisted cache registry when the stored identityHash no longer matches
 * SYNTHESIS_IDENTITY_HASH, and then creates a fresh cache.
 *
 * This is the production deploy/restart path: the identity block is module-static,
 * so a fresh process begins with no in-memory cache and reads the persisted
 * registry from disk.  If DANIELA_SYNTHESIS_IDENTITY was edited between
 * restarts, the stored hash will differ — Step 1 must discard the stale entry
 * and proceed to create a new cache.  If the Step-1 hash-comparison branch is
 * removed, the stale Google-side cache silently persists across restarts.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Normal mode
 * ─────────────────────────────────────────────────────────────────────────────
 *   Round 1 — Step 1 (persisted registry, the primary production path):
 *     1. Backs up any existing synthesis-cache-registry.json.
 *     2. Writes a stale registry: wrong identityHash, unexpired expiresAt,
 *        valid-looking cacheName.
 *     3. Resets all test seams to production defaults (no in-memory cache,
 *        _persistedRegistryLoaded = false) so Step 1 reads the seeded file.
 *     4. Calls getOrCreateSynthesisCache() with a mock GoogleGenAI that
 *        records whether caches.create() was invoked.
 *     5. Asserts:
 *          a. The stale cache name was NOT returned (Step 1 discarded it).
 *          b. caches.create() WAS called (fresh cache created after discard).
 *     6. Restores the registry backup (or removes the temp file) in finally.
 *
 *   Round 2 — Step 2 (in-process hash mismatch, defensive branch):
 *     Same approach but injects state directly (registryLoaded=true, wrong
 *     _synthesisCacheContentHash).  Confirms Step 2 also clears and re-creates.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Proves the Round 1 assertion catches a broken Step-1 guard:
 *     1. Disables the Step-1 persisted hash-comparison via
 *        _setPersistedHashGuardEnabledForTest(false).
 *     2. Seeds the same stale registry and calls getOrCreateSynthesisCache().
 *     3. With the guard absent the stale entry is restored as valid →
 *        caches.create() is NOT called → the Round 1 assertion fails.
 *     4. Confirms the assertion correctly exits 1, proving the CI check is
 *        sensitive to a guard-removal regression.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Exit codes
 * ─────────────────────────────────────────────────────────────────────────────
 *   0 — PASS
 *   1 — FAIL
 *
 * Usage
 * ─────
 *   npx tsx server/scripts/test-synthesis-cache-identity-invalidation.ts
 *   npx tsx server/scripts/test-synthesis-cache-identity-invalidation.ts --self-check
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { GoogleGenAI } from '@google/genai';

import {
  getOrCreateSynthesisCache,
  _setSynthesisCacheStateForTest,
  _getSynthesisCacheNameForTest,
  _setHashGuardEnabledForTest,
  _setPersistedHashGuardEnabledForTest,
  _resetSynthesisCacheTestSeams,
} from '../services/pre-session-synthesis';

// ── Colour helpers ────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;

const SELF_CHECK = process.argv.includes('--self-check');

const STALE_CACHE_NAME  = 'fake-cache/stale-identity-000';
const STALE_HASH        = 'stale000stale0000'; // will not equal the real SYNTHESIS_IDENTITY_HASH
const FAR_FUTURE        = Date.now() + 60 * 60 * 1000; // 1 hour — not expired

const REGISTRY_PATH = join(process.cwd(), '.local', 'synthesis-cache-registry.json');

/** Backup of the original registry content (null = file did not exist). */
let _registryBackup: string | null = null;

function backupRegistry(): void {
  if (existsSync(REGISTRY_PATH)) {
    _registryBackup = readFileSync(REGISTRY_PATH, 'utf8');
  } else {
    _registryBackup = null;
  }
}

function restoreRegistry(): void {
  if (_registryBackup !== null) {
    writeFileSync(REGISTRY_PATH, _registryBackup, 'utf8');
  } else if (existsSync(REGISTRY_PATH)) {
    unlinkSync(REGISTRY_PATH);
  }
}

function writeStaleRegistry(): void {
  mkdirSync(join(process.cwd(), '.local'), { recursive: true });
  writeFileSync(
    REGISTRY_PATH,
    JSON.stringify({
      cacheName: STALE_CACHE_NAME,
      identityHash: STALE_HASH,
      expiresAt: FAR_FUTURE,
    }, null, 2),
    'utf8',
  );
}

/**
 * Build a minimal mock GoogleGenAI whose caches.create() records calls and
 * returns a synthetic cache name without hitting the real API.
 */
function buildMockAi(): { ai: GoogleGenAI; callCount: () => number; newCacheName: string } {
  let count = 0;
  const newCacheName = 'fake-cache/fresh-identity-NEW';
  const ai = {
    caches: {
      create: async (_opts: unknown) => {
        count++;
        return { name: newCacheName };
      },
    },
  } as unknown as GoogleGenAI;
  return { ai, callCount: () => count, newCacheName };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(B(`\n══ Synthesis Cache Identity Invalidation CI${SELF_CHECK ? ' (self-check)' : ''} ══\n`));

  let passed = true;

  // ── Round 1: Step-1 persisted-registry guard (production restart path) ─────
  console.log(B('Round 1 — Step 1: persisted registry discards stale identity on restart\n'));

  const { ai: ai1, callCount: callCount1, newCacheName: newName1 } = buildMockAi();

  backupRegistry();
  try {
    writeStaleRegistry();
    console.log(`Wrote stale registry: cacheName="${STALE_CACHE_NAME}", identityHash="${STALE_HASH}" (≠ real hash)`);
    console.log(`Expires: ${new Date(FAR_FUTURE).toISOString()} (not expired)`);

    // Reset to production defaults: no in-memory cache, registry file not yet loaded.
    _resetSynthesisCacheTestSeams();

    if (SELF_CHECK) {
      console.log(Y('\nSelf-check: disabling Step-1 persisted hash-comparison guard...'));
      _setPersistedHashGuardEnabledForTest(false);
    }

    const result1 = await getOrCreateSynthesisCache(ai1);

    console.log(`\nResult: ${result1 === null ? 'null' : `"${result1}"`}`);
    console.log(`caches.create() call count: ${callCount1()}`);
    console.log(`_synthesisCacheName after call: "${_getSynthesisCacheNameForTest()}"`);

    // Assertion 1a: stale name must NOT be returned
    if (result1 === STALE_CACHE_NAME) {
      console.log(R(`\n✗ Round 1 FAIL: returned the stale cache name "${STALE_CACHE_NAME}".`));
      console.log(R(`  Step-1 identity guard should have discarded the stale registry entry.`));
      passed = false;
    } else if (!SELF_CHECK) {
      console.log(G(`✓ Round 1a: stale cache name was not returned (Step-1 guard discarded it).`));
    }

    // Assertion 1b: caches.create() must have been called
    if (callCount1() === 0) {
      console.log(R(`\n✗ Round 1 FAIL: caches.create() was never called.`));
      console.log(R(`  Expected Step-1 to discard the stale entry and trigger fresh cache creation.`));
      passed = false;
    } else if (!SELF_CHECK) {
      console.log(G(`✓ Round 1b: caches.create() called ${callCount1()} time(s) — fresh cache created.`));
    }
  } finally {
    restoreRegistry();
    _resetSynthesisCacheTestSeams();
  }

  // ── Self-check verdict (Round 1 only) ─────────────────────────────────────
  if (SELF_CHECK) {
    if (passed) {
      console.log(R(`\n✗ SELF-CHECK FAIL: All assertions passed even with Step-1 guard disabled.`));
      console.log(R(`  The CI check is not sensitive enough to detect a guard-removal regression.`));
      process.exit(1);
    }
    console.log(G(`\n✓ Self-check PASS: Round 1 assertions correctly caught the broken Step-1 guard.`));
    console.log(G(`  The CI check exits 1 when the persisted hash-comparison branch is removed.`));
    return; // self-check only exercises Round 1
  }

  // ── Round 2: Step-2 in-process hash mismatch (defensive branch) ───────────
  console.log(B('\nRound 2 — Step 2: in-process guard clears mismatched hash before reuse\n'));

  const { ai: ai2, callCount: callCount2, newCacheName: newName2 } = buildMockAi();

  // Round 2 calls getOrCreateSynthesisCache() which may persist a mock cache
  // name to the registry file on disk.  Back up the registry before and restore
  // it afterwards so the test leaves no side effects for subsequent processes.
  backupRegistry();
  try {
    // Inject stale in-process state: cached name, wrong hash, not expired, registry already loaded.
    _setSynthesisCacheStateForTest(STALE_CACHE_NAME, STALE_HASH, FAR_FUTURE, true);
    console.log(`Injected in-process state: name="${STALE_CACHE_NAME}", hash="${STALE_HASH}" (≠ real hash), not expired`);

    const result2 = await getOrCreateSynthesisCache(ai2);

    console.log(`\nResult: ${result2 === null ? 'null' : `"${result2}"`}`);
    console.log(`caches.create() call count: ${callCount2()}`);

    // Assertion 2a: stale name must NOT be returned
    if (result2 === STALE_CACHE_NAME) {
      console.log(R(`\n✗ Round 2 FAIL: returned stale in-process cache name "${STALE_CACHE_NAME}".`));
      console.log(R(`  Step-2 hash guard should have cleared _synthesisCacheName before reuse.`));
      passed = false;
    } else {
      console.log(G(`✓ Round 2a: stale in-process cache was not returned (Step-2 guard cleared it).`));
    }

    // Assertion 2b: caches.create() must have been called
    if (callCount2() === 0) {
      console.log(R(`\n✗ Round 2 FAIL: caches.create() was never called.`));
      console.log(R(`  Expected Step-2 to clear the stale entry and trigger fresh cache creation.`));
      passed = false;
    } else {
      console.log(G(`✓ Round 2b: caches.create() called ${callCount2()} time(s) — fresh cache created.`));
    }

    // Assertion 2c: _synthesisCacheName holds the fresh name
    const nameAfter2 = _getSynthesisCacheNameForTest();
    if (nameAfter2 !== newName2) {
      console.log(R(`\n✗ Round 2 FAIL: _synthesisCacheName is "${nameAfter2}", expected "${newName2}".`));
      passed = false;
    } else {
      console.log(G(`✓ Round 2c: _synthesisCacheName holds new cache name "${newName2}".`));
    }
  } finally {
    restoreRegistry();
    _resetSynthesisCacheTestSeams();
  }

  // ── Final verdict ─────────────────────────────────────────────────────────
  if (!passed) {
    console.log(R(`\n✗ FAIL: one or more assertions failed (see above).`));
    process.exit(1);
  }
  console.log(G(`\n✓ PASS: Synthesis cache identity invalidation guards (Step 1 + Step 2) are working.`));
  console.log(G(`  A stale persisted registry or in-process cache (hash mismatch) is discarded`));
  console.log(G(`  and a fresh cache is created — covering the production deploy/restart path.`));
}

main().catch((err) => {
  console.error(R(`\nFATAL: ${err?.message ?? err}`));
  _resetSynthesisCacheTestSeams();
  process.exit(1);
});
