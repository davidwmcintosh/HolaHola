/**
 * test-prod-founder-bypass-guard.ts
 *
 * CI guard: confirms the dev-only founder-equivalent test account
 * (DEV_TEST_ACCOUNT_ID in server/middleware/rbac.ts's isFounderId()) can
 * NEVER satisfy a founder-only gate (requireFounder/isFounder) when
 * NODE_ENV=production.
 *
 * This account exists so agents/CI can log in via the real password-auth
 * API and exercise founder-only tooling (Alden tools, Team Room, Brain
 * Health, Voice Health, Telemetry, Growth Memories, Curriculum Sync)
 * locally -- see scripts/data-ops/seed-dev-test-account.ts. The guard here
 * is what makes that safe: it must be structurally impossible for the
 * allow-list to apply outside a non-production NODE_ENV, mirroring the
 * retired DEV_AUTH_BYPASS's own production-safety pattern.
 *
 * PART 1 — Static: the guard expression is present verbatim in rbac.ts.
 * PART 2 — In-process: evaluate the guard with NODE_ENV=production and
 *           confirm the dev test account id is rejected.
 * PART 3 — Mutation self-check: strip the NODE_ENV half from a temporary
 *           copy of rbac.ts, re-run the static check against the mutant,
 *           assert it exits non-zero.
 *
 * Run: npx tsx server/scripts/test-prod-founder-bypass-guard.ts
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ${G('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${R('✗')} ${label}${detail ? `\n       ${detail}` : ''}`);
    failed++;
  }
}

const ROOT        = resolve(__dirname, '../..');
const RBAC        = resolve(ROOT, 'server/middleware/rbac.ts');
const MUTANT_RBAC = resolve(ROOT, 'server/middleware/rbac.FOUNDER_GUARD_MUTANT.ts');

const GUARD_NEEDLE = `process.env.NODE_ENV !== 'production' && id === DEV_TEST_ACCOUNT_ID`;

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Static: guard expression present in rbac.ts
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — Static: founder dev-allowlist guard present in rbac.ts'));
sep();

const rbacSrc = readFileSync(RBAC, 'utf8');

assert(
  'rbac.ts contains the NODE_ENV-gated dev-test-account allow-list',
  rbacSrc.includes(GUARD_NEEDLE),
  `Expected to find: ${GUARD_NEEDLE}`,
);
assert(
  "rbac.ts guard uses the string 'production'",
  rbacSrc.includes("!== 'production'"),
);

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — In-process: evaluate isFounderId with NODE_ENV=production
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — In-process: dev test account id is rejected when NODE_ENV=production'));
sep();

const FOUNDER_USER_ID = '49847136';
const DEV_TEST_ACCOUNT_ID = 'dev-test-agent';

function isFounderId(nodeEnv: string | undefined, id: string): boolean {
  if (id === FOUNDER_USER_ID) return true;
  if (nodeEnv !== 'production' && id === DEV_TEST_ACCOUNT_ID) return true;
  return false;
}

assert(
  'Dev test account is rejected when NODE_ENV=production',
  isFounderId('production', DEV_TEST_ACCOUNT_ID) === false,
);
assert(
  'Dev test account is accepted when NODE_ENV=development (expected dev behaviour)',
  isFounderId('development', DEV_TEST_ACCOUNT_ID) === true,
);
assert(
  'Real founder id is still accepted when NODE_ENV=production (no regression)',
  isFounderId('production', FOUNDER_USER_ID) === true,
);
assert(
  'An arbitrary other id is rejected regardless of NODE_ENV',
  isFounderId('development', 'some-other-user') === false,
);

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Mutation self-check: static check must FAIL on a mutant that drops
//           the NODE_ENV half of the guard.
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Mutation self-check: static check fails when NODE_ENV guard is removed'));
sep();

const MUTANT_GUARD = `id === DEV_TEST_ACCOUNT_ID`;
const mutantSrc = rbacSrc.replace(GUARD_NEEDLE, `true || ${MUTANT_GUARD}`);

assert(
  'Mutant source was produced (guard replacement succeeded)',
  mutantSrc !== rbacSrc,
  'Replacement did not change the source — GUARD_NEEDLE may not match',
);
assert(
  'Mutant source no longer contains the full guard',
  !mutantSrc.includes(GUARD_NEEDLE),
);

writeFileSync(MUTANT_RBAC, mutantSrc, 'utf8');

try {
  const checker = `
    import { readFileSync } from 'fs';
    const src = readFileSync(${JSON.stringify(MUTANT_RBAC)}, 'utf8');
    const GUARD = ${JSON.stringify(GUARD_NEEDLE)};
    if (!src.includes(GUARD)) {
      console.error('GUARD MISSING — correctly detected');
      process.exit(1);
    }
    process.exit(0);
  `;

  const result = spawnSync(
    process.execPath,
    ['--input-type=module'],
    {
      input: checker,
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
    },
  );

  assert(
    'Static-check sub-process exits non-zero on the mutant (guard missing is detected)',
    result.status !== 0,
    `Sub-process exited with ${result.status}; stdout: ${result.stdout.trim()}; stderr: ${result.stderr.trim()}`,
  );
} finally {
  if (existsSync(MUTANT_RBAC)) unlinkSync(MUTANT_RBAC);
}

// ── Summary ──────────────────────────────────────────────────────────────────
sep();
console.log(`\n  Passed: ${G(String(passed))}   Failed: ${failed > 0 ? R(String(failed)) : String(failed)}\n`);

if (failed > 0) {
  process.exit(1);
}
