/**
 * test-prod-auth-bypass-guard-meta.ts
 *
 * Meta-test: confirms that test-prod-auth-bypass-guard.ts itself fails when the
 * NODE_ENV half of the isDevBypass guard is removed from server/middleware/rbac.ts.
 *
 * This is stronger than the in-memory mutation in Part 3 of the main guard
 * script: it mutates the real file on disk, runs the full guard script end-to-end,
 * and then restores the original.  A meta-test exit code of 0 means the guard
 * script correctly catches the regression; any other outcome is a failure.
 *
 * Steps:
 *   1. Back up server/middleware/rbac.ts.
 *   2. Strip "process.env.NODE_ENV !== 'production' && " from isDevBypass.
 *   3. Run test-prod-auth-bypass-guard.ts as a child process.
 *   4. Assert the child exits non-zero (guard detected the mutation).
 *   5. Restore the original file (always, even on error).
 *
 * Run: npx tsx server/scripts/test-prod-auth-bypass-guard-meta.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
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
const GUARD_SCRIPT = resolve(__dirname, 'test-prod-auth-bypass-guard.ts');

// The full guard expression that must be present in rbac.ts
const FULL_GUARD  = `process.env.NODE_ENV !== 'production' && process.env.DEV_AUTH_BYPASS === 'true'`;
// The stripped (mutant) guard — NODE_ENV check removed
const MUTANT_GUARD = `process.env.DEV_AUTH_BYPASS === 'true'`;

sep();
console.log(B('Meta-test: guard script exits non-zero when NODE_ENV check is removed from rbac.ts'));
sep();

// ── Pre-flight: verify files exist ───────────────────────────────────────────
if (!existsSync(RBAC)) {
  console.error(R(`  ✗ rbac.ts not found at ${RBAC}`));
  process.exit(1);
}
if (!existsSync(GUARD_SCRIPT)) {
  console.error(R(`  ✗ guard script not found at ${GUARD_SCRIPT}`));
  process.exit(1);
}

const originalSrc = readFileSync(RBAC, 'utf8');

// ── Pre-flight: confirm the full guard is present before we mutate ────────────
assert(
  'rbac.ts contains the full NODE_ENV+DEV_AUTH_BYPASS guard before mutation',
  originalSrc.includes(FULL_GUARD),
  `Expected to find: ${FULL_GUARD}`,
);

if (failed > 0) {
  console.log(R('\n  Pre-flight failed — aborting without mutating the file.\n'));
  process.exit(1);
}

// ── Produce the mutant source ─────────────────────────────────────────────────
const mutantSrc = originalSrc.replace(FULL_GUARD, MUTANT_GUARD);

assert(
  'Mutant source differs from the original (replacement succeeded)',
  mutantSrc !== originalSrc,
  'replace() returned the same string — FULL_GUARD may not match exactly',
);
assert(
  'Mutant source no longer contains the full guard',
  !mutantSrc.includes(FULL_GUARD),
);
assert(
  'Mutant source still contains the partial (no-NODE_ENV) guard',
  mutantSrc.includes(MUTANT_GUARD),
);

if (failed > 0) {
  console.log(R('\n  Mutation setup failed — aborting without writing to disk.\n'));
  process.exit(1);
}

// ── Write mutant, run guard script, restore ───────────────────────────────────
sep();
console.log(B('Writing mutant rbac.ts and running guard script...'));
sep();

let guardResult: ReturnType<typeof spawnSync> | null = null;

try {
  writeFileSync(RBAC, mutantSrc, 'utf8');
  console.log('  Mutant written.  Running test-prod-auth-bypass-guard.ts...\n');

  guardResult = spawnSync(
    process.execPath,
    ['--import', 'tsx', GUARD_SCRIPT],
    {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
      // Give the child script a generous timeout (30s) — it spawns its own sub-process
      timeout: 30_000,
    },
  );
} finally {
  // Always restore the original, even if spawnSync throws
  writeFileSync(RBAC, originalSrc, 'utf8');
  console.log('\n  Original rbac.ts restored.');
}

// ── Verify the guard script exited non-zero for the RIGHT reason ─────────────
sep();
console.log(B('Asserting guard script behaviour on mutant file'));
sep();

const childStatus = guardResult?.status ?? null;
const childSignal = guardResult?.signal ?? null;
const childError  = guardResult?.error ?? null;
// Normalize to string — spawnSync's encoding:'utf8' returns string at runtime, but
// TypeScript infers stdout/stderr as string | Buffer from the overloaded signature.
const childStdout: string = String(guardResult?.stdout ?? '');
const childStderr: string = String(guardResult?.stderr ?? '');

if (childStdout) {
  console.log('  Child stdout (truncated to 3000 chars):');
  console.log(childStdout.slice(0, 3000).replace(/^/gm, '    '));
}
if (childStderr) {
  console.log('  Child stderr:');
  console.log(childStderr.slice(0, 500).replace(/^/gm, '    '));
}

// 1. Child must have completed normally — not crashed, timed out, or been killed.
assert(
  'Guard script launched without a spawn error',
  childError == null,
  `spawnSync error: ${String(childError)}`,
);
assert(
  'Guard script was not killed by a signal (no timeout/crash)',
  childSignal == null,
  `Killed by signal: ${childSignal}`,
);

// 2. Exit code must be exactly 1 — the guard script's deliberate "assertions failed" exit.
//    Exit code 0  → guard script passed on the mutant (static check is too weak).
//    Exit code 2+ → unexpected crash before reaching the assertion summary.
assert(
  `Guard script exited with code 1 on mutant (actual: ${childStatus})`,
  childStatus === 1,
  childStatus === 0
    ? 'Exit code was 0 — the guard script did NOT detect the mutation; the static check is too weak.'
    : `Exit code was ${childStatus}, not 1 — the guard script may have crashed before reaching the RBAC check.`,
);

// 3. The RBAC static-check assertion must specifically appear as FAILED in the output.
//    The child's assert() function prints either:
//      "  ✓ <label>"  (ANSI green)  for a pass
//      "  ✗ <label>"  (ANSI red)    for a fail
//    We strip ANSI escapes and look for the ✗ failure marker on the same line as
//    the RBAC label so a passing assertion with the same text cannot satisfy this check.
const RBAC_ASSERTION_LABEL = 'rbac.ts contains NODE_ENV+DEV_AUTH_BYPASS guard';
// Strip all ANSI colour/formatting codes before matching.
// eslint-disable-next-line no-control-regex
const strippedStdout = childStdout.replace(/\x1b\[[0-9;]*m/g, '');
const rbacFailedOnFailedLine = strippedStdout
  .split('\n')
  .some((line: string) => line.includes('✗') && line.includes(RBAC_ASSERTION_LABEL));
assert(
  'Child output shows the RBAC full-guard static assertion ran and specifically FAILED (✗ on same line as label)',
  rbacFailedOnFailedLine,
  `Expected a line containing both "✗" and "${RBAC_ASSERTION_LABEL}" in child stdout. ` +
  'The label must appear on a failure line, not a passing one. ' +
  'Guard script may have crashed before Part 1, or the Part 1 RBAC check was weakened to pass.',
);

// 4. The guard script must have reached its summary line — confirming it ran to completion
//    rather than short-circuiting mid-way due to an unrelated error.
const SUMMARY_MARKER = 'Failed:';
assert(
  'Child output contains the guard script summary line (script ran to completion)',
  childStdout.includes(SUMMARY_MARKER),
  `Expected to find "${SUMMARY_MARKER}" in child stdout. ` +
  'The guard script may not have reached its summary block.',
);

// ── Summary ───────────────────────────────────────────────────────────────────
sep();
console.log(`\n  Passed: ${G(String(passed))}   Failed: ${failed > 0 ? R(String(failed)) : String(failed)}\n`);

if (failed > 0) {
  process.exit(1);
}
