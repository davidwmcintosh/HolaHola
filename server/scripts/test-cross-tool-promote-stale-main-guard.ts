/**
 * test-cross-tool-promote-stale-main-guard.ts
 *
 * CI guard: confirms that .github/workflows/cross-tool-promote.yml's
 * "promote" job re-verifies main has not advanced immediately before it
 * mutates the single shared production database, and actually fails the
 * job (not just logs) when that check fails.
 *
 * Background: this GitHub Actions job pushes straight to main from outside
 * Replit, entirely independent of server/services/source-control-service.ts's
 * own lease/lock (that chokepoint only covers pushes originating from this
 * workspace's own persistent checkout). Its "Refuse if main is not an
 * ancestor of this branch" step runs once, early, before the
 * typecheck/build/Neon-branch-gate steps — a gap of several minutes in
 * which a *different* actor (Replit's source-control coordinator, or
 * another concurrent cross-tool-promote run) can push to main. The
 * following "Apply migration + data-ops to production" step is a real,
 * not-always-reversible side effect against the one shared production
 * database (see the workflow file's own header). Without a fresh
 * re-verification immediately before that step, a stale run would mutate
 * production for a promotion that then fails at the final push
 * (non-fast-forward) — leaving production changed without the
 * corresponding code landing. Nothing else parses this workflow file, so
 * nothing else would catch a later edit that removes, misorders, or
 * defangs this guard.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Normal mode
 * ─────────────────────────────────────────────────────────────────────────
 * Parses the real workflow file and asserts the guard step exists, actually
 * checks ancestry and fails the job on divergence, and is positioned after
 * the (slow) Neon-branch gate but before the production-mutating step.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Self-check mode (--self-check)
 * ─────────────────────────────────────────────────────────────────────────
 * Runs the same assertion logic against fabricated step lists with the
 * guard removed, misordered, defanged (no real ancestry check), or
 * fail-quiet (no `exit 1`), and confirms each case FAILS — proving the
 * assertions actually have teeth rather than trivially passing on any
 * input.
 *
 * Usage:
 *   npx tsx server/scripts/test-cross-tool-promote-stale-main-guard.ts
 *   npx tsx server/scripts/test-cross-tool-promote-stale-main-guard.ts --self-check
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKFLOW_PATH = join(__dirname, '../../.github/workflows/cross-tool-promote.yml');
const JOB_NAME = 'promote';
const GATE_STEP_NAME = 'Validate migration + data-ops + full test suite on an isolated Neon branch';
const GUARD_STEP_NAME = 'Re-verify main has not advanced since the earlier ancestry check';
const MIGRATE_STEP_NAME = 'Apply migration + data-ops to production (gate-approved)';
const ANCESTRY_MARKER = 'git merge-base --is-ancestor';
const FAIL_MARKER = 'exit 1';

const SELF_CHECK = process.argv.includes('--self-check');

// ─── Colour helpers (matches the convention in test-cross-tool-promote-push-auth-guard.ts) ──
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;

let _failed = false;

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(G(`  ✓ ${label}`));
  } else {
    console.error(R(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`));
    _failed = true;
  }
}

interface WorkflowStep {
  name?: string;
  run?: string;
}

/**
 * Core assertion: given the promote job's step list, verify the stale-main
 * guard exists, actually re-checks ancestry and fails the job when it does
 * not hold, and is positioned after the slow Neon-branch gate but before
 * the production-mutating step. Shared between normal mode (the real file)
 * and self-check mode (fabricated broken step lists) so the exact same
 * logic is what gets proven load-bearing.
 */
function assertPromoteJobIsGuarded(steps: WorkflowStep[], context: string): void {
  const gateIndex = steps.findIndex((s) => s?.name === GATE_STEP_NAME);
  const guardIndex = steps.findIndex((s) => s?.name === GUARD_STEP_NAME);
  const migrateIndex = steps.findIndex((s) => s?.name === MIGRATE_STEP_NAME);

  assert(`${context}: "${GUARD_STEP_NAME}" step exists`, guardIndex !== -1, `steps found: ${steps.map((s) => s?.name).join(', ')}`);
  if (guardIndex === -1) return;

  const guardRun = steps[guardIndex]?.run ?? '';
  assert(
    `${context}: guard step actually re-checks ancestry (${ANCESTRY_MARKER})`,
    guardRun.includes(ANCESTRY_MARKER),
    `run script: ${JSON.stringify(guardRun)}`,
  );
  assert(
    `${context}: guard step fails the job (${FAIL_MARKER}) rather than only logging`,
    guardRun.includes(FAIL_MARKER),
    `run script: ${JSON.stringify(guardRun)}`,
  );

  assert(`${context}: "${MIGRATE_STEP_NAME}" step exists`, migrateIndex !== -1, `steps found: ${steps.map((s) => s?.name).join(', ')}`);
  if (migrateIndex !== -1) {
    assert(
      `${context}: guard step runs before the production-mutating step`,
      guardIndex < migrateIndex,
      `guard at index ${guardIndex}, migrate at index ${migrateIndex}`,
    );
  }

  if (gateIndex !== -1) {
    assert(
      `${context}: guard step runs after the Neon-branch gate (covers its full duration)`,
      gateIndex < guardIndex,
      `gate at index ${gateIndex}, guard at index ${guardIndex}`,
    );
  }
}

// ─── Self-check mode ────────────────────────────────────────────────────────

function runSelfCheck(): void {
  console.log(B('\n[self-check] Verifying the guard assertions fail on broken step lists...\n'));
  let allCaught = true;

  const gateStep: WorkflowStep = { name: GATE_STEP_NAME, run: 'npm run db:branch -- gate' };
  const goodGuardStep: WorkflowStep = {
    name: GUARD_STEP_NAME,
    run: 'git fetch origin main --no-tags\nMAIN_SHA="$(git rev-parse --verify FETCH_HEAD^{commit})"\nif ! git merge-base --is-ancestor "$MAIN_SHA" HEAD; then\n  echo "::error::stale"\n  exit 1\nfi',
  };
  const migrateStep: WorkflowStep = { name: MIGRATE_STEP_NAME, run: 'npx drizzle-kit migrate' };

  const tests: Array<{ label: string; steps: WorkflowStep[] }> = [
    {
      label: 'Sub-test A: guard step removed entirely',
      steps: [gateStep, migrateStep],
    },
    {
      label: 'Sub-test B: guard step present but moved to after the production mutation',
      steps: [gateStep, migrateStep, goodGuardStep],
    },
    {
      label: 'Sub-test C: guard step present but moved to before the Neon-branch gate',
      steps: [goodGuardStep, gateStep, migrateStep],
    },
    {
      label: 'Sub-test D: guard step present but does not actually re-check ancestry',
      steps: [gateStep, { name: GUARD_STEP_NAME, run: 'echo "placeholder"' }, migrateStep],
    },
    {
      label: 'Sub-test E: guard step checks ancestry but only warns instead of failing the job',
      steps: [gateStep, {
        name: GUARD_STEP_NAME,
        run: 'git fetch origin main --no-tags\nif ! git merge-base --is-ancestor "$MAIN_SHA" HEAD; then\n  echo "::warning::stale, continuing anyway"\nfi',
      }, migrateStep],
    },
    {
      label: 'Sub-test F: workflow has no steps at all',
      steps: [],
    },
  ];

  for (const { label, steps } of tests) {
    console.log(Y(`\n  ${label}`));
    _failed = false;
    assertPromoteJobIsGuarded(steps, 'fabricated steps');
    if (!_failed) {
      console.error(R('  [self-check] ✗ assertions passed on broken step list — guard is missing'));
      allCaught = false;
    } else {
      console.log(G('  [self-check] ✓ assertions correctly failed on broken step list'));
    }
  }

  console.log('');
  if (allCaught) {
    console.log(G('[self-check] PASS — all guard assertions are load-bearing\n'));
    process.exit(0);
  } else {
    console.error(R('[self-check] FAIL — one or more assertions did not catch the broken step list\n'));
    process.exit(1);
  }
}

// ─── Main check ───────────────────────────────────────────────────────────────

interface WorkflowDoc {
  jobs?: Record<string, { steps?: WorkflowStep[] }>;
}

function main(): void {
  if (SELF_CHECK) { runSelfCheck(); return; }

  console.log(B('\n── Cross-Tool Promote Stale-Main Guard ──────────────────────\n'));

  const raw = readFileSync(WORKFLOW_PATH, 'utf-8');
  const doc = parse(raw) as WorkflowDoc;
  const steps: WorkflowStep[] = doc?.jobs?.[JOB_NAME]?.steps ?? [];

  assert(`"${JOB_NAME}" job has steps`, steps.length > 0, `jobs found: ${Object.keys(doc?.jobs ?? {}).join(', ')}`);

  assertPromoteJobIsGuarded(steps, `"${JOB_NAME}" job`);

  console.log('\n── Results ──────────────────────────────────────────────────\n');
  if (_failed) {
    console.error(R('FAIL — the promote job is not correctly guarded against mutating production for a stale candidate (see ✗ above)\n'));
    process.exit(1);
  } else {
    console.log(G('PASS — promote job re-verifies main before mutating production\n'));
    process.exit(0);
  }
}

main();
