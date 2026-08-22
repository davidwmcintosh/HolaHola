#!/usr/bin/env npx tsx
/**
 * test-merge-ours-guard.ts
 *
 * Hermetic self-check that proves the `docs/episode-27.md merge=ours` strategy
 * in .gitattributes actually protects the receiving branch from task-agent merges.
 *
 * Real-world scenario modelled:
 *   – Common ancestor  : episode-27.md at the point the task branch was cut
 *   – Main branch       : ancestor + Luca's live additions (longer)
 *   – Task branch       : task agent's stale snapshot (older/different content)
 *   Both sides differ from the ancestor → git invokes the merge driver.
 *   The `merge=ours` driver tells git to keep main's version unconditionally.
 *
 * Normal mode (default):
 *   – Registers merge.ours.driver
 *   – Builds the scenario described above in a temp git repo
 *   – Merges task branch into main
 *   – Asserts main's content (with Luca's additions) was preserved
 *
 * Self-check mode (--self-check):
 *   – Runs the same scenario WITHOUT the driver registered
 *   – Asserts main's content was NOT preserved (task version won or merge conflict)
 *   – This proves the driver is the actual protective mechanism
 *   – Restores the driver before exiting
 *
 * Usage:
 *   npx tsx server/scripts/test-merge-ours-guard.ts              # normal
 *   npx tsx server/scripts/test-merge-ours-guard.ts --self-check # prove driver is necessary
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const ATTR_PATH = '.gitattributes';

// ── Colour helpers ────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('-'.repeat(60));

const selfCheckMode = process.argv.includes('--self-check');

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(G(`  ✓ ${label}`));
    passed++;
  } else {
    console.log(R(`  ✗ ${label}`));
    if (detail) console.log(R(`       ${detail}`));
    failed++;
  }
}

const PROTECTED_EPISODES = ['docs/episode-27.md', 'docs/episode-28.md'];

function hasGitattributesRule(): boolean {
  if (!existsSync(ATTR_PATH)) return false;
  const content = readFileSync(ATTR_PATH, 'utf-8');
  return PROTECTED_EPISODES.every(ep => content.includes(ep) && content.includes('merge=ours'));
}

/** Run a git command in a specific directory; returns stdout. */
function git(dir: string, cmd: string): string {
  try {
    return execSync(`git -C "${dir}" ${cmd}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (err: any) {
    const msg = `git -C "${dir}" ${cmd}\n  → ${err.stderr?.trim() ?? err.message}`;
    throw new Error(msg);
  }
}

async function runGuardTest(driverEnabled: boolean): Promise<void> {
  const ts      = Date.now();
  const repoDir = join(tmpdir(), `merge-ours-test-${ts}`);
  const epPath  = join(repoDir, 'docs', 'ep.md');
  const attrPath = join(repoDir, '.gitattributes');

  try {
    // ── STEP 1: Verify .gitattributes in the real workspace ──────────────────
    sep();
    console.log(B('STEP 1 — Verify .gitattributes contains merge=ours for all protected episodes'));
    sep();
    assert(
      `.gitattributes exists and assigns merge=ours to: ${PROTECTED_EPISODES.join(', ')}`,
      hasGitattributesRule(),
      `Missing merge=ours for one or more episodes in ${ATTR_PATH}. Expected: ${PROTECTED_EPISODES.join(', ')}`,
    );

    // ── STEP 2: Build hermetic git repo ───────────────────────────────────────
    sep();
    console.log(B('STEP 2 — Create isolated git repo for the merge test'));
    sep();

    mkdirSync(join(repoDir, 'docs'), { recursive: true });
    git(repoDir, 'init -b main -q');
    git(repoDir, 'config user.email "ci@test"');
    git(repoDir, 'config user.name "CI Test"');

    // Common ancestor: simulate the state when the task branch was cut
    const ANCESTOR = 'ANCESTOR SNAPSHOT\nShared history line 1\nShared history line 2\n';
    writeFileSync(epPath, ANCESTOR);
    writeFileSync(attrPath, 'docs/ep.md merge=ours\n');
    git(repoDir, 'add docs/ep.md .gitattributes');
    git(repoDir, 'commit -qm "ancestor: shared state when task was cut"');
    console.log(Y(`  ℹ  Ancestor committed (${ANCESTOR.length} bytes)`));

    // Register (or unregister) the merge.ours driver
    if (driverEnabled) {
      git(repoDir, 'config merge.ours.driver "bash -c \'exit 0\'"');
      console.log(Y(`  ℹ  merge.ours.driver registered (driver enabled)`));
    } else {
      console.log(Y(`  ℹ  merge.ours.driver NOT registered (self-check path)`));
    }

    // Task branch: stale snapshot (older/different content — no Luca additions)
    git(repoDir, 'checkout -qb task');
    const TASK_STALE = 'TASK BRANCH STALE CONTENT\nOlder line 1\n(missing Luca\'s additions)\n';
    writeFileSync(epPath, TASK_STALE);
    git(repoDir, 'add docs/ep.md');
    git(repoDir, 'commit -qm "task: stale snapshot without Luca additions"');
    console.log(Y(`  ℹ  Task branch committed stale content (${TASK_STALE.length} bytes)`));

    // Main branch: Luca's live additions on top of the ancestor
    git(repoDir, 'checkout -q main');
    const MAIN_WITH_LUCA = ANCESTOR + '\nLUCA ADDITION LINE 1\nLUCA ADDITION LINE 2\nLUCA ADDITION LINE 3\n';
    writeFileSync(epPath, MAIN_WITH_LUCA);
    git(repoDir, 'add docs/ep.md');
    git(repoDir, 'commit -qm "main: Luca\'s live additions"');
    console.log(Y(`  ℹ  Main branch committed with Luca additions (${MAIN_WITH_LUCA.length} bytes)`));

    // ── STEP 3: Merge the task branch into main ───────────────────────────────
    sep();
    console.log(B('STEP 3 — Merge task branch → main (simulates post-task merge)'));
    sep();

    try {
      git(repoDir, 'merge --no-ff --no-edit -m "merge: task into main" task');
      console.log(Y(`  ℹ  Merge completed`));
    } catch (err: any) {
      // With driver disabled and a 3-way conflict, merge may exit non-zero
      console.log(Y(`  ℹ  Merge exited non-zero (expected in self-check mode): ${err.message.slice(0, 100)}`));
    }

    // ── STEP 4: Check result ──────────────────────────────────────────────────
    sep();
    console.log(B(
      driverEnabled
        ? 'STEP 4 — Assert Luca\'s additions survived (merge=ours held)'
        : 'STEP 4 — Assert Luca\'s additions were NOT preserved (driver is the actual guard)',
    ));
    sep();

    const postMerge = existsSync(epPath) ? readFileSync(epPath, 'utf-8') : '';
    console.log(Y(`  ℹ  Post-merge size: ${postMerge.length} bytes`));
    console.log(Y(`  ℹ  Main-with-Luca size: ${MAIN_WITH_LUCA.length} bytes`));

    if (driverEnabled) {
      assert(
        'Post-merge content is byte-for-byte equal to main\'s version with Luca\'s additions',
        postMerge === MAIN_WITH_LUCA,
        `Content mismatch — got ${postMerge.length} bytes, expected ${MAIN_WITH_LUCA.length}. ` +
        `First 80 chars of result: "${postMerge.slice(0, 80).replace(/\n/g, '↵')}"`,
      );
      assert(
        'Stale task-branch content ("TASK BRANCH STALE CONTENT") is absent from result',
        !postMerge.includes('TASK BRANCH STALE CONTENT'),
        'Stale task content was merged in — overwrite was NOT blocked',
      );
      assert(
        'Luca\'s additions are present in post-merge content',
        postMerge.includes('LUCA ADDITION LINE 1') && postMerge.includes('LUCA ADDITION LINE 3'),
        'Luca\'s additions were lost in the merge',
      );
    } else {
      // Self-check: without driver, task's stale content should win or cause conflict
      assert(
        'Without driver: main\'s Luca additions were NOT fully preserved (driver is the actual guard)',
        postMerge !== MAIN_WITH_LUCA,
        `Content was identical to main+Luca without the driver — merge=ours may be unconditional ` +
        `in this git version, or git resolved the merge without invoking a driver. ` +
        `Check git version and .gitattributes handling. The driver may not be needed here.`,
      );
    }
  } finally {
    // Always clean up the temp repo
    try {
      rmSync(repoDir, { recursive: true, force: true });
      console.log(Y(`\n  ℹ  Temp repo cleaned up: ${repoDir}`));
    } catch {
      // Non-fatal
    }
  }
}

async function main(): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  if (selfCheckMode) {
    console.log(B('  merge=ours guard — SELF-CHECK (prove driver is necessary)'));
    console.log(B('  Expected: without driver, task-branch stale content overwrites main'));
  } else {
    console.log(B('  merge=ours guard — Normal mode (prove guard holds with driver)'));
  }
  console.log('═'.repeat(70) + '\n');

  if (selfCheckMode) {
    await runGuardTest(false);
  } else {
    await runGuardTest(true);
  }

  sep();
  const total = passed + failed;
  if (failed === 0) {
    const msg = selfCheckMode
      ? `\n✓  Self-check passed (${total} assertions).\n` +
        `   Without merge.ours.driver the stale content overwrites — the driver is the guard.\n`
      : `\n✓  All ${total} assertions passed.\n` +
        `   merge=ours + driver blocks task-agent stale content from overwriting Luca's additions.\n`;
    console.log(G(msg));
    process.exit(0);
  } else {
    const msg = selfCheckMode
      ? `\n✗  ${failed} of ${total} assertions failed — see output above.\n`
      : `\n✗  ${failed} of ${total} assertions failed — merge=ours guard is NOT working.\n` +
        `   Check: (1) merge.ours.driver is registered via git config merge.ours.driver "bash -c 'exit 0'"\n` +
        `          (2) .gitattributes has docs/episode-27.md merge=ours\n` +
        `          (3) git version supports custom merge drivers (ort strategy, 2.34+)\n`;
    console.log(R(msg));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(R(`\nUnhandled error: ${err?.message ?? err}\n`));
  process.exit(1);
});
