/**
 * test-cross-tool-promote-push-auth-guard.ts
 *
 * CI guard: confirms that .github/workflows/cross-tool-promote.yml's
 * "Fast-forward main and push" step still strips actions/checkout's
 * persisted `http.https://github.com/.extraheader` config before pushing
 * with the GitHub App token.
 *
 * Root cause this guards against: actions/checkout (default
 * persist-credentials: true) leaves that git-config entry carrying the
 * default GITHUB_TOKEN. Because it's scoped to the same "https://github.com/"
 * prefix as the push URL, git/curl send it instead of honoring the
 * URL-embedded App token — the push silently authenticates as
 * github-actions[bot] instead of the App installation, and branch
 * protection on main denies it with a 403 (observed in run 35378467309 /
 * job 105708715641). Fixed by unsetting that config right before the push
 * (see the step's own inline comment for the full writeup, and
 * .agents/memory/github-actions-checkout-token-shadowing.md). Verified
 * working end-to-end against a real promotion in run 35396814943.
 *
 * If a later edit drops the unset-all line, or reorders it to after the
 * `git push` line, this exact failure mode can reappear silently — nothing
 * else in CI parses this workflow file, so nothing else would catch it
 * before the next real promotion attempt hits the same 403.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Normal mode
 * ─────────────────────────────────────────────────────────────────────────
 * Parses the real workflow file and asserts the guard is present in the
 * "Fast-forward main and push" step, ordered before the push.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Self-check mode (--self-check)
 * ─────────────────────────────────────────────────────────────────────────
 * Runs the same assertion logic against fabricated step text with the
 * guard removed, misordered, or the step missing entirely, and confirms
 * each case FAILS — proving the assertions actually have teeth rather than
 * trivially passing on any input.
 *
 * Usage:
 *   npx tsx server/scripts/test-cross-tool-promote-push-auth-guard.ts
 *   npx tsx server/scripts/test-cross-tool-promote-push-auth-guard.ts --self-check
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKFLOW_PATH = join(__dirname, '../../.github/workflows/cross-tool-promote.yml');
const JOB_NAME = 'promote';
const STEP_NAME = 'Fast-forward main and push';
const UNSET_LINE = 'git config --unset-all http.https://github.com/.extraheader';
const PUSH_MARKER = 'git push';

const SELF_CHECK = process.argv.includes('--self-check');

// ─── Colour helpers (matches the convention in test-luca-chat-canonical-save.ts) ──
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

/**
 * Core assertion: given a step's `run:` script text (or undefined if the
 * step itself couldn't be found), verify the unset-all guard is present
 * and appears before the git push line. Shared between normal mode (the
 * real file) and self-check mode (fabricated broken text) so the exact
 * same logic is what gets proven load-bearing.
 */
function assertPushStepIsGuarded(runText: string | undefined, context: string): void {
  assert(
    `${context}: step has a run script`,
    typeof runText === 'string' && runText.length > 0,
    `run script: ${JSON.stringify(runText)}`,
  );
  if (typeof runText !== 'string') return;

  const unsetIndex = runText.indexOf(UNSET_LINE);
  const pushIndex = runText.indexOf(PUSH_MARKER);

  assert(
    `${context}: contains the extraheader unset-all guard`,
    unsetIndex !== -1,
    `looked for "${UNSET_LINE}"`,
  );
  assert(
    `${context}: contains a git push line`,
    pushIndex !== -1,
    `looked for "${PUSH_MARKER}"`,
  );
  if (unsetIndex === -1 || pushIndex === -1) return;

  assert(
    `${context}: unset-all guard appears before the push`,
    unsetIndex < pushIndex,
    `unset-all at index ${unsetIndex}, push at index ${pushIndex}`,
  );
}

// ─── Self-check mode ────────────────────────────────────────────────────────

function runSelfCheck(): void {
  console.log(B('\n[self-check] Verifying the guard assertions fail on broken step text...\n'));
  let allCaught = true;

  const tests: Array<{ label: string; runText: string | undefined }> = [
    {
      label: 'Sub-test A: unset-all line removed entirely',
      runText: [
        'GH_APP_TOKEN="$(npx tsx scripts/print-github-app-token.ts)"',
        'echo "::add-mask::$GH_APP_TOKEN"',
        'git push "https://x-access-token:${GH_APP_TOKEN}@github.com/repo.git" "HEAD:refs/heads/main"',
      ].join('\n'),
    },
    {
      label: 'Sub-test B: unset-all present but moved to after the push',
      runText: [
        'GH_APP_TOKEN="$(npx tsx scripts/print-github-app-token.ts)"',
        'git push "https://x-access-token:${GH_APP_TOKEN}@github.com/repo.git" "HEAD:refs/heads/main"',
        'git config --unset-all http.https://github.com/.extraheader',
      ].join('\n'),
    },
    {
      label: 'Sub-test C: step missing entirely (undefined run text)',
      runText: undefined,
    },
    {
      label: 'Sub-test D: empty run text',
      runText: '',
    },
  ];

  for (const { label, runText } of tests) {
    console.log(Y(`\n  ${label}`));
    _failed = false;
    assertPushStepIsGuarded(runText, 'fabricated step');
    if (!_failed) {
      console.error(R('  [self-check] ✗ assertions passed on broken step text — guard is missing'));
      allCaught = false;
    } else {
      console.log(G('  [self-check] ✓ assertions correctly failed on broken step text'));
    }
  }

  console.log('');
  if (allCaught) {
    console.log(G('[self-check] PASS — all guard assertions are load-bearing\n'));
    process.exit(0);
  } else {
    console.error(R('[self-check] FAIL — one or more assertions did not catch the broken step text\n'));
    process.exit(1);
  }
}

// ─── Main check ───────────────────────────────────────────────────────────────

interface WorkflowStep {
  name?: string;
  run?: string;
}

interface WorkflowDoc {
  jobs?: Record<string, { steps?: WorkflowStep[] }>;
}

function main(): void {
  if (SELF_CHECK) { runSelfCheck(); return; }

  console.log(B('\n── Cross-Tool Promote Push-Auth Guard ───────────────────────\n'));

  const raw = readFileSync(WORKFLOW_PATH, 'utf-8');
  const doc = parse(raw) as WorkflowDoc;
  const steps: WorkflowStep[] = doc?.jobs?.[JOB_NAME]?.steps ?? [];

  assert(
    `"${JOB_NAME}" job has steps`,
    steps.length > 0,
    `jobs found: ${Object.keys(doc?.jobs ?? {}).join(', ')}`,
  );

  const step = steps.find((s) => s?.name === STEP_NAME);
  assert(
    `"${STEP_NAME}" step exists in the ${JOB_NAME} job`,
    !!step,
    `found steps: ${steps.map((s) => s?.name).join(', ')}`,
  );

  assertPushStepIsGuarded(step?.run, `"${STEP_NAME}" step`);

  console.log('\n── Results ──────────────────────────────────────────────────\n');
  if (_failed) {
    console.error(R('FAIL — the push step is not correctly guarded against checkout token shadowing (see ✗ above)\n'));
    process.exit(1);
  } else {
    console.log(G('PASS — push step strips the checkout-persisted credential before pushing with the App token\n'));
    process.exit(0);
  }
}

main();
