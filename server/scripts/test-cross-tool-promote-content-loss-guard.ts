/**
 * test-cross-tool-promote-content-loss-guard.ts
 *
 * CI guard: confirms that .github/workflows/cross-tool-promote.yml's
 * "promote" job still runs the episode content-loss check (server/scripts/
 * check-episode-content-loss.ts) before it fast-forwards and pushes to main.
 *
 * Background (task #1529): this GitHub Actions job pushes straight to main
 * from outside Replit using a GitHub App token, bypassing server/services/
 * source-control-service.ts's syncLocked() guard entirely — that chokepoint
 * only covers pushes originating from this workspace. Without its own copy
 * of the check, a promotion that bundles a stale docs/episode-<N>.md read
 * could silently drop real conversation history exactly like the two
 * confirmed incidents this task was filed to prevent (see
 * server/services/episode-content-loss-guard.ts's header for the full
 * background). Nothing else parses this workflow file, so nothing else
 * would catch a later edit that removes or misorders this step.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Normal mode
 * ─────────────────────────────────────────────────────────────────────────
 * Parses the real workflow file and asserts the check step is present in
 * the "promote" job, runs check-episode-content-loss.ts, and appears after
 * dependencies are installed but before the fast-forward push.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Self-check mode (--self-check)
 * ─────────────────────────────────────────────────────────────────────────
 * Runs the same assertion logic against fabricated step lists with the
 * check step removed, misordered, or the workflow missing entirely, and
 * confirms each case FAILS — proving the assertions actually have teeth
 * rather than trivially passing on any input.
 *
 * Usage:
 *   npx tsx server/scripts/test-cross-tool-promote-content-loss-guard.ts
 *   npx tsx server/scripts/test-cross-tool-promote-content-loss-guard.ts --self-check
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKFLOW_PATH = join(__dirname, '../../.github/workflows/cross-tool-promote.yml');
const JOB_NAME = 'promote';
const INSTALL_STEP_NAME = 'Install dependencies';
const CHECK_STEP_NAME = 'Check episode files for silent content loss';
const PUSH_STEP_NAME = 'Fast-forward main and push';
const CLI_MARKER = 'server/scripts/check-episode-content-loss.ts';

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
 * Core assertion: given the promote job's step list, verify the content-loss
 * check step exists, actually invokes the CLI, and is positioned after
 * dependencies are installed but before the fast-forward push. Shared
 * between normal mode (the real file) and self-check mode (fabricated
 * broken step lists) so the exact same logic is what gets proven
 * load-bearing.
 */
function assertPromoteJobIsGuarded(steps: WorkflowStep[], context: string): void {
  const installIndex = steps.findIndex((s) => s?.name === INSTALL_STEP_NAME);
  const checkIndex = steps.findIndex((s) => s?.name === CHECK_STEP_NAME);
  const pushIndex = steps.findIndex((s) => s?.name === PUSH_STEP_NAME);

  assert(`${context}: "${CHECK_STEP_NAME}" step exists`, checkIndex !== -1, `steps found: ${steps.map((s) => s?.name).join(', ')}`);
  if (checkIndex === -1) return;

  const checkRun = steps[checkIndex]?.run ?? '';
  assert(
    `${context}: check step actually invokes ${CLI_MARKER}`,
    checkRun.includes(CLI_MARKER),
    `run script: ${JSON.stringify(checkRun)}`,
  );

  assert(`${context}: "${PUSH_STEP_NAME}" step exists`, pushIndex !== -1, `steps found: ${steps.map((s) => s?.name).join(', ')}`);
  if (pushIndex !== -1) {
    assert(
      `${context}: check step runs before the fast-forward push`,
      checkIndex < pushIndex,
      `check at index ${checkIndex}, push at index ${pushIndex}`,
    );
  }

  if (installIndex !== -1) {
    assert(
      `${context}: check step runs after dependencies are installed`,
      installIndex < checkIndex,
      `install at index ${installIndex}, check at index ${checkIndex}`,
    );
  }
}

// ─── Self-check mode ────────────────────────────────────────────────────────

function runSelfCheck(): void {
  console.log(B('\n[self-check] Verifying the guard assertions fail on broken step lists...\n'));
  let allCaught = true;

  const installStep: WorkflowStep = { name: INSTALL_STEP_NAME, run: 'npm ci --include=dev' };
  const goodCheckStep: WorkflowStep = { name: CHECK_STEP_NAME, run: `npx tsx ${CLI_MARKER} --old-ref "$MAIN_SHA" --new-ref HEAD` };
  const pushStep: WorkflowStep = { name: PUSH_STEP_NAME, run: 'git push "https://x-access-token:${GH_APP_TOKEN}@github.com/repo.git" "HEAD:refs/heads/main"' };

  const tests: Array<{ label: string; steps: WorkflowStep[] }> = [
    {
      label: 'Sub-test A: check step removed entirely',
      steps: [installStep, pushStep],
    },
    {
      label: 'Sub-test B: check step present but moved to after the push',
      steps: [installStep, pushStep, goodCheckStep],
    },
    {
      label: 'Sub-test C: check step present but moved to before dependencies are installed',
      steps: [goodCheckStep, installStep, pushStep],
    },
    {
      label: 'Sub-test D: check step present but its run script does not call the CLI',
      steps: [installStep, { name: CHECK_STEP_NAME, run: 'echo "placeholder"' }, pushStep],
    },
    {
      label: 'Sub-test E: workflow has no steps at all',
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

  console.log(B('\n── Cross-Tool Promote Episode Content-Loss Guard ───────────────\n'));

  const raw = readFileSync(WORKFLOW_PATH, 'utf-8');
  const doc = parse(raw) as WorkflowDoc;
  const steps: WorkflowStep[] = doc?.jobs?.[JOB_NAME]?.steps ?? [];

  assert(`"${JOB_NAME}" job has steps`, steps.length > 0, `jobs found: ${Object.keys(doc?.jobs ?? {}).join(', ')}`);

  assertPromoteJobIsGuarded(steps, `"${JOB_NAME}" job`);

  console.log('\n── Results ──────────────────────────────────────────────────\n');
  if (_failed) {
    console.error(R('FAIL — the promote job is not correctly guarded against silent episode content loss (see ✗ above)\n'));
    process.exit(1);
  } else {
    console.log(G('PASS — promote job checks for episode content loss before fast-forwarding main\n'));
    process.exit(0);
  }
}

main();
