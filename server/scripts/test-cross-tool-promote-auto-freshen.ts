#!/usr/bin/env npx tsx
/**
 * test-cross-tool-promote-auto-freshen.ts
 *
 * Exercises `freshenBranchAgainstMain` from scripts/cross-tool-promote.ts
 * against real, disposable git repositories (a bare "origin" plus working
 * clones under `mkdtemp()`, destroyed afterward) — no mocks, no fixtures
 * standing in for git itself.
 *
 * Background: this is the fix for the recurring "two hats land from a
 * stale base and main diverges" failure mode (see the function's own
 * doc comment and docs/shared-agent-instructions.md's "Keeping a
 * cross-tool promotion candidate fresh" section). It runs before every
 * cross-tool-promote.ts push, so a bug here either fails a promotion that
 * should have succeeded (a false conflict, or a botched push) or — far
 * worse — silently mis-merges or leaves a half-finished working tree.
 * Nothing else exercises this function against real git plumbing, so
 * nothing else would catch a regression here before it hit a real
 * promotion.
 *
 * Cases covered:
 *  1. Clean merge — candidate branch is behind main with no conflicting
 *     changes: merges, pushes the merge commit back to origin, leaves a
 *     clean working tree.
 *  2. No-op — candidate branch already contains main: returns
 *     `merged: false` without creating a commit or attempting a push.
 *  3. Real conflict — candidate and main edit the same line differently:
 *     the merge is aborted, HEAD and the working tree are left exactly as
 *     they were, nothing is pushed, and the thrown error says so.
 *  4. Precondition — wrong branch checked out: refuses before ever
 *     fetching, rather than freshening (or worse, merging into) a branch
 *     the caller didn't ask for.
 *  5. Precondition — dirty working tree: refuses before merging, rather
 *     than producing a confusing partial-merge state on top of an
 *     uncommitted change.
 *
 * Usage:
 *   npx tsx server/scripts/test-cross-tool-promote-auto-freshen.ts
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freshenBranchAgainstMain } from '../../scripts/cross-tool-promote';

// ─── Colour helpers (matches the convention in test-cross-tool-promote-push-auth-guard.ts) ──
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;

let _failed = false;

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(G(`  ✓ ${label}`));
  } else {
    console.error(R(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`));
    _failed = true;
  }
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function configureIdentity(dir: string): void {
  git(dir, ['config', 'user.email', 'cross-tool-promote-test@example.com']);
  git(dir, ['config', 'user.name', 'cross-tool-promote-test']);
}

const cleanupRoots: string[] = [];

/**
 * Builds a fresh bare "origin" repo plus a "seed" working clone that
 * already pushed one commit to `main` — the common starting point every
 * test case branches from. Each test gets its own fixture so mutating
 * `main` in one case can never affect another.
 */
function makeFixture(): { root: string; originDir: string; seedDir: string } {
  const root = mkdtempSync(join(tmpdir(), 'cross-tool-promote-freshen-'));
  cleanupRoots.push(root);

  const originDir = join(root, 'origin.git');
  mkdirSync(originDir);
  git(originDir, ['init', '--bare']);
  // A fresh bare repo's HEAD may point at "master" depending on the
  // environment's init.defaultBranch — pin it to "main" explicitly so
  // `git clone` checks out the branch this test suite actually uses,
  // regardless of that setting.
  git(originDir, ['symbolic-ref', 'HEAD', 'refs/heads/main']);

  const seedDir = join(root, 'seed');
  mkdirSync(seedDir);
  git(seedDir, ['init']);
  git(seedDir, ['checkout', '-b', 'main']);
  configureIdentity(seedDir);
  writeFileSync(join(seedDir, 'shared.txt'), 'original\n');
  git(seedDir, ['add', '.']);
  git(seedDir, ['commit', '-m', 'initial commit']);
  git(seedDir, ['remote', 'add', 'origin', originDir]);
  git(seedDir, ['push', 'origin', 'main']);

  return { root, originDir, seedDir };
}

function cloneCandidate(root: string, originDir: string, name: string): string {
  const dir = join(root, name);
  git(root, ['clone', originDir, dir]);
  configureIdentity(dir);
  return dir;
}

function advanceMain(seedDir: string, filename: string, content: string): void {
  writeFileSync(join(seedDir, filename), content);
  git(seedDir, ['add', '.']);
  git(seedDir, ['commit', '-m', `advance main: ${filename}`]);
  git(seedDir, ['push', 'origin', 'main']);
}

function commitOnBranch(dir: string, branch: string, filename: string, content: string): void {
  git(dir, ['checkout', '-b', branch]);
  writeFileSync(join(dir, filename), content);
  git(dir, ['add', '.']);
  git(dir, ['commit', '-m', `${branch}: ${filename}`]);
}

// ─── Case 1: clean merge ────────────────────────────────────────────────────

function testCleanMerge(): void {
  console.log(B('\n  Case 1: clean merge (candidate behind main, no conflicts)'));
  const { root, originDir, seedDir } = makeFixture();
  const candidateDir = cloneCandidate(root, originDir, 'candidate-clean');
  commitOnBranch(candidateDir, 'feature-clean', 'feature.txt', 'feature work\n');
  advanceMain(seedDir, 'main-advance.txt', 'main moved on\n');

  const beforeHead = git(candidateDir, ['rev-parse', 'HEAD']).trim();
  const result = freshenBranchAgainstMain('feature-clean', candidateDir);
  const afterHead = git(candidateDir, ['rev-parse', 'HEAD']).trim();

  assert('merged === true', result.merged === true);
  assert('HEAD advanced (a merge commit was created)', afterHead !== beforeHead);
  assert('main\'s new file is present locally after the merge', existsSync(join(candidateDir, 'main-advance.txt')));
  assert('the branch\'s own file survived the merge', existsSync(join(candidateDir, 'feature.txt')));
  assert('working tree is clean after the merge', git(candidateDir, ['status', '--porcelain']).trim() === '');

  const remoteRef = git(candidateDir, ['ls-remote', 'origin', 'refs/heads/feature-clean']).split(/\s+/)[0];
  assert('the merge commit was pushed back to origin', remoteRef === afterHead, `remote=${remoteRef} local=${afterHead}`);
}

// ─── Case 2: no-op ──────────────────────────────────────────────────────────

function testNoOp(): void {
  console.log(B('\n  Case 2: no-op (branch already contains main)'));
  const { root, originDir } = makeFixture();
  const candidateDir = cloneCandidate(root, originDir, 'candidate-noop');
  commitOnBranch(candidateDir, 'feature-noop', 'feature.txt', 'feature work\n');

  const beforeHead = git(candidateDir, ['rev-parse', 'HEAD']).trim();
  const result = freshenBranchAgainstMain('feature-noop', candidateDir);
  const afterHead = git(candidateDir, ['rev-parse', 'HEAD']).trim();

  assert('merged === false when the branch already includes main', result.merged === false);
  assert('HEAD is unchanged (no merge commit created)', afterHead === beforeHead);
}

// ─── Case 3: real conflict ──────────────────────────────────────────────────

function testRealConflict(): void {
  console.log(B('\n  Case 3: real conflict (candidate and main edit the same line differently)'));
  const { root, originDir, seedDir } = makeFixture();
  const candidateDir = cloneCandidate(root, originDir, 'candidate-conflict');
  commitOnBranch(candidateDir, 'feature-conflict', 'shared.txt', 'feature-version\n');
  advanceMain(seedDir, 'shared.txt', 'main-version\n');

  const beforeHead = git(candidateDir, ['rev-parse', 'HEAD']).trim();
  let threw = false;
  let message = '';
  try {
    freshenBranchAgainstMain('feature-conflict', candidateDir);
  } catch (err) {
    threw = true;
    message = err instanceof Error ? err.message : String(err);
  }
  const afterHead = git(candidateDir, ['rev-parse', 'HEAD']).trim();

  assert('freshen throws on a real conflict', threw);
  assert('the error names manual resolution rather than auto-resolving', /manual resolution/i.test(message), message);
  assert('HEAD is unchanged after the aborted merge', afterHead === beforeHead);
  assert('working tree is clean after the aborted merge (no conflict markers left behind)', git(candidateDir, ['status', '--porcelain']).trim() === '');

  const remoteRef = execFileSync('git', ['ls-remote', originDir, 'refs/heads/feature-conflict'], { encoding: 'utf-8' }).trim();
  assert('nothing was pushed to origin for this branch', remoteRef === '', `unexpected remote ref: ${remoteRef}`);
}

// ─── Case 4: wrong branch checked out ───────────────────────────────────────

function testWrongBranchCheckedOut(): void {
  console.log(B('\n  Case 4: precondition — wrong branch checked out'));
  const { root, originDir } = makeFixture();
  const candidateDir = cloneCandidate(root, originDir, 'candidate-wrong-branch');
  // Still on "main" locally — never checked out "feature-x".

  let threw = false;
  let message = '';
  try {
    freshenBranchAgainstMain('feature-x', candidateDir);
  } catch (err) {
    threw = true;
    message = err instanceof Error ? err.message : String(err);
  }

  assert('freshen refuses rather than merging into the wrong branch', threw);
  assert('the error names the actual checked-out branch', /checked-out branch is "main"/.test(message), message);
}

// ─── Case 5: dirty working tree ─────────────────────────────────────────────

function testDirtyWorkingTree(): void {
  console.log(B('\n  Case 5: precondition — dirty working tree'));
  const { root, originDir } = makeFixture();
  const candidateDir = cloneCandidate(root, originDir, 'candidate-dirty');
  git(candidateDir, ['checkout', '-b', 'feature-dirty']);
  writeFileSync(join(candidateDir, 'uncommitted.txt'), 'oops\n');

  let threw = false;
  let message = '';
  try {
    freshenBranchAgainstMain('feature-dirty', candidateDir);
  } catch (err) {
    threw = true;
    message = err instanceof Error ? err.message : String(err);
  }

  assert('freshen refuses rather than merging over an uncommitted change', threw);
  assert('the error mentions uncommitted changes', /uncommitted changes/i.test(message), message);
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main(): void {
  console.log(B('\n── Cross-Tool Promote Auto-Freshen ──────────────────────────\n'));

  try {
    testCleanMerge();
    testNoOp();
    testRealConflict();
    testWrongBranchCheckedOut();
    testDirtyWorkingTree();
  } finally {
    for (const root of cleanupRoots) {
      rmSync(root, { recursive: true, force: true });
    }
  }

  console.log('\n── Results ──────────────────────────────────────────────────\n');
  if (_failed) {
    console.error(R('FAIL — freshenBranchAgainstMain did not behave correctly against real git repos (see ✗ above)\n'));
    process.exit(1);
  } else {
    console.log(G('PASS — freshenBranchAgainstMain merges cleanly, no-ops when already fresh, and fails closed on real conflicts and unsafe preconditions\n'));
    process.exit(0);
  }
}

main();
