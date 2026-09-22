/**
 * test-agent-skills-symlink.ts
 *
 * CI check: verifies `.claude/skills` is a real, git-trackable symlink to
 * `.agents/skills`, so Claude Code's own native skill-discovery (which scans
 * its own `.claude/skills/*` convention, not arbitrary repo paths) picks up
 * every skill in the shared `.agents/skills/` directory automatically.
 *
 * Background (task #1514, Sep 21 2026):
 *   docs/agent-workflows.md previously claimed "Claude Code can self-discover
 *   everything [in .agents/skills/] with a glob, no separate index needed."
 *   That was never true — Claude Code has no built-in mechanism to glob an
 *   arbitrary directory on its own initiative; it only auto-loads skills it
 *   finds under its own `.claude/skills/` convention. Replit Agent and
 *   Antigravity each have their own project/global skill directories, but
 *   nothing previously made `.agents/skills/` visible to Claude Code without
 *   someone manually restating each skill's existence elsewhere (e.g. an
 *   editor_insights pointer). A first attempt to close this gap (a task
 *   agent's isolated-repl change) was implemented and validated there, but
 *   failed to merge into `main` after repeated attempts
 *   (MERGE_BUDGET_EXHAUSTED) and never actually landed. This file, the
 *   symlink itself, and the corrected doc section were reconstructed
 *   directly on `main` per the fallback pattern in
 *   .agents/memory/task-agent-merge-budget-fallback.md.
 *
 * The fix is a single git-tracked relative symlink:
 *   .claude/skills -> ../.agents/skills
 * This does not solve every cross-hat skill gap — `.local/skills/` is
 * gitignored and stays genuinely invisible to Claude Code by construction
 * (see docs/agent-workflows.md); that remains tracked separately. This
 * check only proves the `.agents/skills/` <-> `.claude/skills` half holds.
 *
 * Run:
 *   npx tsx server/scripts/test-agent-skills-symlink.ts
 *   npx tsx server/scripts/test-agent-skills-symlink.ts --self-check
 *
 * --self-check mode: confirms the guard currently passes against the real
 * repo state, then temporarily breaks the invariant in two different ways
 * (symlink replaced by a plain directory; symlink pointed at the wrong
 * target) and verifies each is caught, restoring the original symlink
 * exactly afterward — even if an assertion throws — via try/finally rather
 * than an in-try process.exit(), which would skip cleanup.
 */
export {};

import { existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const LINK_PATH = join(REPO_ROOT, '.claude', 'skills');
const TARGET_PATH = join(REPO_ROOT, '.agents', 'skills');
const RELATIVE_TARGET = '../.agents/skills';

function assertSymlink(): string[] {
  const failures: string[] = [];

  if (!existsSync(LINK_PATH) && !isSymlinkEvenIfBroken(LINK_PATH)) {
    failures.push(`${LINK_PATH} does not exist`);
    return failures;
  }

  const stat = lstatSync(LINK_PATH);
  if (!stat.isSymbolicLink()) {
    failures.push(`${LINK_PATH} is not a symlink (found ${stat.isDirectory() ? 'a plain directory' : 'a regular file'}) — Claude Code will not see any shared skills through it`);
    return failures;
  }

  let resolvedLink: string;
  try {
    resolvedLink = realpathSync(LINK_PATH);
  } catch {
    failures.push(`${LINK_PATH} is a symlink but its target ("${readlinkSync(LINK_PATH)}") does not resolve — broken link`);
    return failures;
  }

  const resolvedTarget = realpathSync(TARGET_PATH);
  if (resolvedLink !== resolvedTarget) {
    failures.push(`${LINK_PATH} resolves to ${resolvedLink}, expected ${resolvedTarget}`);
    return failures;
  }

  const linkListing = readdirSync(LINK_PATH).sort();
  const targetListing = readdirSync(TARGET_PATH).sort();
  if (JSON.stringify(linkListing) !== JSON.stringify(targetListing)) {
    failures.push(`directory contents differ through the symlink vs. direct path (${linkListing.length} vs ${targetListing.length} entries)`);
  }

  return failures;
}

function isSymlinkEvenIfBroken(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

function removeLinkPath(): void {
  rmSync(LINK_PATH, { recursive: true, force: true });
}

function restoreRealSymlink(): void {
  removeLinkPath();
  symlinkSync(RELATIVE_TARGET, LINK_PATH);
}

async function runRealCheck(): Promise<void> {
  sep();
  console.log(B('Agent skills cross-hat symlink guard'));
  console.log(B(`Verifies ${LINK_PATH.replace(REPO_ROOT + '/', '')} is a real symlink to .agents/skills`));
  sep();

  const failures = assertSymlink();

  console.log('');
  if (failures.length === 0) {
    console.log(`  ${G('✓')} .claude/skills is a real symlink resolving to .agents/skills, contents match`);
    sep();
    console.log(G('\n✓ All assertions passed — Claude Code can discover every shared skill.\n'));
    process.exit(0);
  } else {
    for (const f of failures) console.log(`  ${R('✗')} ${f}`);
    sep();
    console.log(R(`\n✗ ${failures.length} assertion(s) failed — .claude/skills has drifted from a real symlink.\n`));
    process.exit(1);
  }
}

async function selfCheck(): Promise<void> {
  sep();
  console.log(B('SELF-CHECK: verifying this guard fails when the symlink is broken'));
  sep();

  const baselineFailures = assertSymlink();
  if (baselineFailures.length > 0) {
    console.log(R('✗ Self-check aborted — the guard already fails against the REAL repo state:'));
    for (const f of baselineFailures) console.log(`    ${R('✗')} ${f}`);
    console.log(R('  Fix the real .claude/skills symlink first, then rerun the self-check.'));
    process.exit(1);
    return;
  }
  console.log(G('✓ Baseline: guard passes against the real .claude/skills symlink'));
  console.log('');

  let selfCheckFailed = 0;

  try {
    // Fixture 1: symlink replaced by a plain empty directory.
    removeLinkPath();
    mkdirSync(LINK_PATH);
    let failures = assertSymlink();
    if (failures.length > 0) {
      console.log(`  ${G('✓')} Guard correctly FAILS when: .claude/skills is a plain directory, not a symlink`);
    } else {
      console.log(`  ${R('✗')} Guard still PASSES when: .claude/skills is a plain directory — this drift would go uncaught`);
      selfCheckFailed++;
    }
    restoreRealSymlink();

    // Fixture 2: symlink points at the wrong target.
    removeLinkPath();
    symlinkSync('../.agents/memory', LINK_PATH);
    failures = assertSymlink();
    if (failures.length > 0) {
      console.log(`  ${G('✓')} Guard correctly FAILS when: .claude/skills points at the wrong target`);
    } else {
      console.log(`  ${R('✗')} Guard still PASSES when: .claude/skills points at the wrong target — this drift would go uncaught`);
      selfCheckFailed++;
    }
    restoreRealSymlink();

    // Fixture 3: broken symlink (target does not exist at all).
    removeLinkPath();
    symlinkSync('../.agents/does-not-exist', LINK_PATH);
    failures = assertSymlink();
    if (failures.length > 0) {
      console.log(`  ${G('✓')} Guard correctly FAILS when: .claude/skills is a broken symlink`);
    } else {
      console.log(`  ${R('✗')} Guard still PASSES when: .claude/skills is a broken symlink — this drift would go uncaught`);
      selfCheckFailed++;
    }
  } finally {
    // Restore no matter what happened above, including a thrown assertion —
    // never leave the repo's real symlink corrupted because a fixture step
    // failed. See .agents/memory/process-exit-bypasses-finally.md.
    restoreRealSymlink();
  }

  const finalFailures = assertSymlink();
  if (finalFailures.length > 0) {
    console.log(R('✗ Restoration failed — .claude/skills is NOT back to the real symlink:'));
    for (const f of finalFailures) console.log(`    ${R('✗')} ${f}`);
    process.exit(1);
    return;
  }
  console.log(`\n  ${G('✓')} Restored .claude/skills to the real symlink exactly`);

  sep();
  if (selfCheckFailed === 0) {
    console.log(G('\n✓ Self-check passed: every known drift scenario makes this guard fail.\n'));
    process.exit(0);
  } else {
    console.log(R(`\n✗ Self-check FAILED: ${selfCheckFailed} drift scenario(s) were not caught.\n`));
    process.exit(1);
  }
}

function main(): void {
  const task = process.argv.includes('--self-check') ? selfCheck() : runRealCheck();
  task.catch((err) => {
    console.error(R(`✗ ${err instanceof Error ? err.message : String(err)}`));
    // Best-effort restoration even on an unexpected throw outside the
    // fixture loop's own try/finally.
    try {
      restoreRealSymlink();
    } catch {
      // ignore — nothing more we can do here
    }
    process.exit(1);
  });
}

main();
