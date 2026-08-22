/**
 * Integration tests for scripts/gemini-gate-check.sh
 *
 * Each test case spins up a real (but temporary) git repository, creates
 * commits with a controlled set of changed files, then invokes the gate
 * script and asserts the exit code.
 *
 * Why a real git repo?  The gate uses `git diff` and `git show` to discover
 * changed files.  Mocking git commands would prove the test's mock, not the
 * script.  A throwaway repo keeps tests hermetic while exercising the real
 * bash logic.
 *
 * Run standalone:
 *   npx tsx --test server/scripts/gemini-gate-check.test.ts
 *
 * Run in CI (included in the npm test suite):
 *   npm test
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ── Helpers ───────────────────────────────────────────────────────────────────

const GATE_SCRIPT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../../scripts/gemini-gate-check.sh',
);

/** Create a temporary directory that is cleaned up after the suite. */
function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-gate-test-'));
}

/** Initialise a fresh git repo with an empty initial commit. */
function initRepo(dir: string): void {
  const opts = { cwd: dir, stdio: 'pipe' as const };
  execSync('git init', opts);
  execSync('git config user.email "test@ci.local"', opts);
  execSync('git config user.name "CI Test"', opts);
  // Initial commit so HEAD~1 is always valid later
  execSync('git commit --allow-empty -m "initial"', opts);
}

/**
 * Stage and commit a set of files (created with empty content).
 * Returns the SHA of the new commit.
 */
function commitFiles(dir: string, files: string[], message: string): string {
  for (const file of files) {
    const abs = path.join(dir, file);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, `// ${file}\n`);
  }
  const opts = { cwd: dir, stdio: 'pipe' as const };
  execSync('git add -A', opts);
  execSync(`git commit -m "${message}"`, opts);
  return execSync('git rev-parse HEAD', opts).toString().trim();
}

/**
 * Run scripts/gemini-gate-check.sh inside `repoDir` and return its exit code.
 *
 * `origHead` — when supplied, write it to ORIG_HEAD so the script uses
 * ORIG_HEAD..HEAD as the range (the real-merge path).  When omitted the
 * script falls back to HEAD~1..HEAD.
 */
function runGate(repoDir: string, origHead?: string): number {
  return runGateResult(repoDir, origHead).status;
}

/**
 * Run scripts/gemini-gate-check.sh inside `repoDir` and return both exit
 * code and captured stdout.  Useful when a test needs to assert on log output
 * rather than (or in addition to) the exit code.
 */
function runGateResult(
  repoDir: string,
  origHead?: string,
): { status: number; stdout: string } {
  if (origHead) {
    // Write ORIG_HEAD the same way git does during a real merge
    fs.writeFileSync(path.join(repoDir, '.git', 'ORIG_HEAD'), origHead + '\n');
  } else {
    // Ensure no stale ORIG_HEAD from a previous test case
    const origHeadPath = path.join(repoDir, '.git', 'ORIG_HEAD');
    if (fs.existsSync(origHeadPath)) fs.unlinkSync(origHeadPath);
  }

  const result = spawnSync('bash', [GATE_SCRIPT], {
    cwd: repoDir,
    encoding: 'utf8',
    env: { ...process.env, HOME: repoDir },
  });

  // Log output on unexpected failures so debugging CI is easier
  if (result.status === null) {
    throw new Error(
      `Gate script did not exit cleanly (signal=${result.signal})\n` +
      `stdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );
  }
  return { status: result.status, stdout: result.stdout ?? '' };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('gemini-gate-check.sh — exit-code assertions', () => {
  let repoDir: string;

  before(() => {
    assert.ok(
      fs.existsSync(GATE_SCRIPT),
      `Gate script not found at ${GATE_SCRIPT} — cannot run tests`,
    );
    fs.chmodSync(GATE_SCRIPT, 0o755);
    repoDir = makeTempDir();
    initRepo(repoDir);
  });

  after(() => {
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  // ── Case 1: no protected files changed ───────────────────────────────────

  it('exits 0 when no protected files are touched', () => {
    const sha = commitFiles(repoDir, ['client/src/App.tsx'], 'safe change');
    const code = runGate(repoDir, /* origHead= */ undefined);
    assert.equal(
      code, 0,
      'Gate must pass when only non-protected files are changed',
    );
  });

  // ── Case 2: protected file changed, NO audit doc ─────────────────────────
  //
  // This is the critical regression check: any flaw in the grep pattern or
  // exit-code path would allow a protected-file change through silently.

  it('exits 1 when system-prompt.ts is changed with no gemini-audit doc', () => {
    // Record HEAD before the "bad" commit so we can simulate ORIG_HEAD
    const origHead = execSync('git rev-parse HEAD', { cwd: repoDir }).toString().trim();

    commitFiles(
      repoDir,
      ['server/services/system-prompt.ts'],
      'touch system-prompt without audit',
    );

    const code = runGate(repoDir, origHead);
    assert.equal(
      code, 1,
      'Gate MUST block a commit that touches system-prompt.ts without a gemini-audit doc. ' +
      'Exit code was 0 — gate is broken.',
    );
  });

  // ── Case 3: protected file changed, audit doc PRESENT ────────────────────

  it('exits 0 when system-prompt.ts is changed AND a gemini-audit doc is present', () => {
    const origHead = execSync('git rev-parse HEAD', { cwd: repoDir }).toString().trim();

    commitFiles(
      repoDir,
      [
        'server/services/system-prompt.ts',
        'docs/gemini-audit-2099-01-01.md',
      ],
      'touch system-prompt WITH audit doc',
    );

    const code = runGate(repoDir, origHead);
    assert.equal(
      code, 0,
      'Gate must pass when a protected file is changed alongside a gemini-audit-*.md doc',
    );
  });

  // ── Case 4: fragment-matched protected path, no audit doc ────────────────
  //
  // Ensures PROTECTED_FRAGMENTS grepping works, not just PROTECTED_EXACT.

  it('exits 1 when a classroom-environment file is changed with no gemini-audit doc', () => {
    const origHead = execSync('git rev-parse HEAD', { cwd: repoDir }).toString().trim();

    commitFiles(
      repoDir,
      ['server/services/classroom-environment/context-builder.ts'],
      'touch classroom-environment without audit',
    );

    const code = runGate(repoDir, origHead);
    assert.equal(
      code, 1,
      'Gate must block changes to fragment-matched paths (classroom-environment) ' +
      'when no gemini-audit doc is present. Exit code was 0 — fragment grep is broken.',
    );
  });

  // ── Case 5: fragment-matched path + audit doc ─────────────────────────────

  it('exits 0 when a classroom-environment file is changed AND a gemini-audit doc is present', () => {
    const origHead = execSync('git rev-parse HEAD', { cwd: repoDir }).toString().trim();

    commitFiles(
      repoDir,
      [
        'server/services/classroom-environment/context-builder.ts',
        'docs/gemini-audit-2099-01-02.md',
      ],
      'touch classroom-environment WITH audit doc',
    );

    const code = runGate(repoDir, origHead);
    assert.equal(
      code, 0,
      'Gate must pass when a fragment-matched path is changed alongside a gemini-audit-*.md doc',
    );
  });

  // ── Case 6: another protected exact file — pre-session-synthesis.ts ──────

  it('exits 1 when pre-session-synthesis.ts is changed with no gemini-audit doc', () => {
    const origHead = execSync('git rev-parse HEAD', { cwd: repoDir }).toString().trim();

    commitFiles(
      repoDir,
      ['server/services/pre-session-synthesis.ts'],
      'touch pre-session-synthesis without audit',
    );

    const code = runGate(repoDir, origHead);
    assert.equal(
      code, 1,
      'Gate must block pre-session-synthesis.ts changes without a gemini-audit doc',
    );
  });

  // ── Case 7: audit doc alone (no protected file) — must pass ──────────────

  it('exits 0 when only a gemini-audit doc is added (no protected file touched)', () => {
    const origHead = execSync('git rev-parse HEAD', { cwd: repoDir }).toString().trim();

    commitFiles(
      repoDir,
      ['docs/gemini-audit-2099-01-03.md'],
      'add audit doc with no protected file',
    );

    const code = runGate(repoDir, origHead);
    assert.equal(
      code, 0,
      'Gate must pass when only a gemini-audit doc is added with no protected file changed',
    );
  });

  // ── Case 8: ORIG_HEAD fallback path (HEAD~1..HEAD range) ─────────────────
  //
  // Verifies the fallback range used when ORIG_HEAD is absent (fast-forward
  // or plain commit) also triggers exit 1 for a protected-file change.

  it('exits 1 for a protected file in HEAD~1..HEAD range when ORIG_HEAD is absent', () => {
    // Make sure there is no ORIG_HEAD in this repo
    const origHeadPath = path.join(repoDir, '.git', 'ORIG_HEAD');
    if (fs.existsSync(origHeadPath)) fs.unlinkSync(origHeadPath);

    commitFiles(
      repoDir,
      ['server/services/daniela-function-registry.ts'],
      'touch function-registry — fallback range test',
    );

    // runGate with no origHead arg does NOT write ORIG_HEAD
    const code = runGate(repoDir /* no origHead */);
    assert.equal(
      code, 1,
      'Gate must block a protected-file change via the HEAD~1..HEAD fallback range ' +
      'when ORIG_HEAD is absent. Exit code was 0 — fallback path is broken.',
    );
  });

  // ── Case 9: protected-file log lines appear even in the no-hit path ───────
  //
  // Lines 62–63 of gemini-gate-check.sh print every loaded exact path and
  // fragment regardless of whether any protected file was changed.  This test
  // asserts those lines are present in stdout on a clean (no-hit) run.  If
  // the for-loops on lines 62–63 are accidentally removed or gated behind a
  // condition, this test catches it before CI logs go dark.

  it('emits [gemini-gate]   exact: and [gemini-gate]   fragment: lines even when no protected files changed', () => {
    // Commit only a safe, non-protected file so the gate takes the no-hit path
    commitFiles(repoDir, ['client/src/SafeComponent.tsx'], 'safe-only change for log test');

    const { status, stdout } = runGateResult(repoDir, /* origHead= */ undefined);

    assert.equal(
      status, 0,
      'Gate must exit 0 when no protected files are changed (pre-condition for this test)',
    );

    const hasExactLine = stdout.includes('[gemini-gate]   exact:');
    assert.ok(
      hasExactLine,
      'stdout must contain at least one "[gemini-gate]   exact:" line ' +
      '(lines 62–63 of gemini-gate-check.sh). ' +
      'If this fails, those log lines were removed or gated — CI logs will go dark.\n' +
      `Actual stdout:\n${stdout}`,
    );

    const hasFragmentLine = stdout.includes('[gemini-gate]   fragment:');
    assert.ok(
      hasFragmentLine,
      'stdout must contain at least one "[gemini-gate]   fragment:" line ' +
      '(lines 62–63 of gemini-gate-check.sh). ' +
      'If this fails, those log lines were removed or gated — CI logs will go dark.\n' +
      `Actual stdout:\n${stdout}`,
    );
  });
});
