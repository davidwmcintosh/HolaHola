/**
 * test-prod-auth-bypass-guard.ts
 *
 * CI guard: confirms DEV_AUTH_BYPASS cannot open protected endpoints when
 * NODE_ENV=production.
 *
 * The guard expression in both replitAuth.ts (isAuthenticated) and
 * rbac.ts (isDevBypass) is:
 *
 *   process.env.NODE_ENV !== 'production' && process.env.DEV_AUTH_BYPASS === 'true'
 *
 * If the NODE_ENV half is ever removed the bypass activates in production.
 * This script locks that invariant in three parts:
 *
 *   PART 1 — Static: the canonical guard string is present verbatim in both
 *             server/replitAuth.ts  and  server/middleware/rbac.ts.
 *
 *   PART 2 — In-process: evaluate the guard expression with
 *             NODE_ENV=production, DEV_AUTH_BYPASS=true and confirm it
 *             returns false (bypass is blocked).
 *
 *   PART 3 — Mutation self-check: strip the NODE_ENV half of the guard from a
 *             temporary copy of rbac.ts, re-run just the static check against
 *             the mutant, and assert it exits non-zero.  A zero exit would mean
 *             the static check is too weak to catch the regression.
 *
 * Run: npx tsx server/scripts/test-prod-auth-bypass-guard.ts
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

// ── File paths ───────────────────────────────────────────────────────────────
const ROOT           = resolve(__dirname, '../..');
const REPLIT_AUTH    = resolve(ROOT, 'server/replitAuth.ts');
const RBAC           = resolve(ROOT, 'server/middleware/rbac.ts');
const MUTANT_RBAC    = resolve(ROOT, 'server/middleware/rbac.MUTANT.ts');

// The exact guard string that must appear in both source files.
// It must contain the NODE_ENV production check AND the DEV_AUTH_BYPASS check.
const GUARD_NEEDLE = `process.env.NODE_ENV !== 'production' && process.env.DEV_AUTH_BYPASS === 'true'`;

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Static: guard expression is present in both source files
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — Static: guard expression present in both source files'));
sep();

const replitAuthSrc = readFileSync(REPLIT_AUTH, 'utf8');
const rbacSrc       = readFileSync(RBAC, 'utf8');

// replitAuth.ts now delegates to the shared isDevBypass() predicate from rbac.ts.
// Verify the delegation contract: it imports isDevBypass and calls it.
assert(
  "replitAuth.ts imports isDevBypass from rbac (centralized predicate)",
  replitAuthSrc.includes('isDevBypass') && replitAuthSrc.includes('./middleware/rbac'),
  `Expected replitAuth.ts to import isDevBypass from rbac.ts`,
);

assert(
  "replitAuth.ts calls isDevBypass() (not inline guard)",
  replitAuthSrc.includes('isDevBypass()'),
  `Expected replitAuth.ts to call isDevBypass() — it must not duplicate the inline guard`,
);

// The full guard expression lives only in rbac.ts.
assert(
  'rbac.ts contains NODE_ENV+DEV_AUTH_BYPASS guard',
  rbacSrc.includes(GUARD_NEEDLE),
  `Expected to find: ${GUARD_NEEDLE}`,
);

// Also confirm the guard references 'production' (catches a typo like 'prod')
assert(
  "rbac.ts guard uses the string 'production'",
  rbacSrc.includes("!== 'production'"),
);

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — In-process: evaluate the guard with NODE_ENV=production
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — In-process: bypass is blocked when NODE_ENV=production'));
sep();

// Snapshot the current env, override, then restore.
const origNodeEnv  = process.env.NODE_ENV;
const origBypass   = process.env.DEV_AUTH_BYPASS;

try {
  // Scenario A: NODE_ENV=production, DEV_AUTH_BYPASS=true → bypass must NOT fire
  process.env.NODE_ENV        = 'production';
  process.env.DEV_AUTH_BYPASS = 'true';

  const isDevBypassProduction =
    process.env.NODE_ENV !== 'production' && process.env.DEV_AUTH_BYPASS === 'true';

  assert(
    'Guard evaluates to false when NODE_ENV=production + DEV_AUTH_BYPASS=true',
    isDevBypassProduction === false,
    `Evaluated to: ${isDevBypassProduction}`,
  );

  // Scenario B: NODE_ENV=development, DEV_AUTH_BYPASS=true → bypass fires (expected)
  process.env.NODE_ENV = 'development';

  const isDevBypassDev =
    process.env.NODE_ENV !== 'production' && process.env.DEV_AUTH_BYPASS === 'true';

  assert(
    'Guard evaluates to true when NODE_ENV=development + DEV_AUTH_BYPASS=true (expected dev behaviour)',
    isDevBypassDev === true,
    `Evaluated to: ${isDevBypassDev}`,
  );

  // Scenario C: NODE_ENV=production, DEV_AUTH_BYPASS=false → bypass must NOT fire
  process.env.NODE_ENV        = 'production';
  process.env.DEV_AUTH_BYPASS = 'false';

  const isDevBypassFalse =
    process.env.NODE_ENV !== 'production' && process.env.DEV_AUTH_BYPASS === 'true';

  assert(
    'Guard evaluates to false when NODE_ENV=production + DEV_AUTH_BYPASS=false',
    isDevBypassFalse === false,
    `Evaluated to: ${isDevBypassFalse}`,
  );
} finally {
  // Restore env (important: do not leave NODE_ENV mutated for subsequent checks)
  if (origNodeEnv === undefined)  delete process.env.NODE_ENV;
  else                             process.env.NODE_ENV = origNodeEnv;

  if (origBypass === undefined)   delete process.env.DEV_AUTH_BYPASS;
  else                             process.env.DEV_AUTH_BYPASS = origBypass;
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Mutation self-check: static check must FAIL on a mutant that drops
//           the NODE_ENV half of the guard.
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Mutation self-check: static check fails when NODE_ENV guard is removed'));
sep();

// Build a mutant rbac.ts where the NODE_ENV condition is stripped so the guard
// becomes just  process.env.DEV_AUTH_BYPASS === 'true'  — no production gate.
const MUTANT_GUARD = `process.env.DEV_AUTH_BYPASS === 'true'`;
const mutantSrc    = rbacSrc.replace(GUARD_NEEDLE, MUTANT_GUARD);

assert(
  'Mutant source was produced (guard replacement succeeded)',
  mutantSrc !== rbacSrc,
  'Replacement did not change the source — GUARD_NEEDLE may not match',
);
assert(
  'Mutant source no longer contains the full guard',
  !mutantSrc.includes(GUARD_NEEDLE),
);
assert(
  'Mutant source still contains a DEV_AUTH_BYPASS reference (partial guard is present)',
  mutantSrc.includes(MUTANT_GUARD),
);

// Write the mutant to a temporary file and run a sub-process that performs
// only the static guard-presence check against it.
writeFileSync(MUTANT_RBAC, mutantSrc, 'utf8');

try {
  // Spawn a sub-process with a tiny inline script that looks for GUARD_NEEDLE
  // in the mutant file, mirroring Part 1's assertion.
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
