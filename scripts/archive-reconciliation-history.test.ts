// Regression coverage for the ownership-guard wiring added to
// scripts/archive-reconciliation-history.sh. The underlying CLI
// (scripts/reconciliation-history-object-storage.ts) refuses `upload` and
// `replicate` without --task-ref, but this wrapper script is the only real
// caller of those commands -- so the guard is only as good as the wrapper's
// own validation and forwarding. These tests spawn the real bash script
// (never the underlying CLI's network paths) to prove:
//   1. mutating modes reject a missing --task-ref before doing any work
//      (no git ref reads, no subprocess spawned), and
//   2. --replicate --task-ref <ref> forwards that exact ref to the
//      storage CLI rather than silently dropping it.
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT_PATH = join(process.cwd(), 'scripts/archive-reconciliation-history.sh');

function runScript(args: string[], options: { extraPathDir?: string } = {}) {
  const env = { ...process.env };
  if (options.extraPathDir) {
    env.PATH = `${options.extraPathDir}:${env.PATH ?? ''}`;
  }
  return spawnSync('bash', [SCRIPT_PATH, ...args], {
    encoding: 'utf8',
    env,
    cwd: process.cwd(),
  });
}

// A fake `npx` that only records how it was invoked and exits 0. Using this
// instead of the real binary keeps the test hermetic (no real tsx process,
// no real S3/Neon call) while still proving the wrapper's own argv
// construction and forwarding logic.
function installFakeNpx(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'archive-reconciliation-fake-npx-'));
  const fakeNpxPath = join(dir, 'npx');
  writeFileSync(fakeNpxPath, '#!/usr/bin/env bash\necho "FAKE_NPX_CALLED: $*"\nexit 0\n');
  chmodSync(fakeNpxPath, 0o755);
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('default (upload) mode rejects a missing --task-ref before touching git or the network', () => {
  const result = runScript([]);
  assert.notEqual(result.status, 0, `expected non-zero exit, got stdout=${result.stdout} stderr=${result.stderr}`);
  assert.match(result.stderr, /--task-ref <ref> is required/);
  // Proves it failed before the git-ref validation step, which would report a
  // different error (missing/invalid ref) rather than the task-ref message.
  assert.doesNotMatch(result.stderr, /required local ref is missing/);
});

test('--replicate mode rejects a missing --task-ref before invoking the storage CLI', () => {
  const { dir, cleanup } = installFakeNpx();
  try {
    const result = runScript(['--replicate'], { extraPathDir: dir });
    assert.notEqual(result.status, 0, `expected non-zero exit, got stdout=${result.stdout} stderr=${result.stderr}`);
    assert.match(result.stderr, /--task-ref <ref> is required/);
    assert.doesNotMatch(result.stdout, /FAKE_NPX_CALLED/, 'the storage CLI must never be invoked without a task ref');
  } finally {
    cleanup();
  }
});

test('--verify and --replicate together are rejected as an invalid combination', () => {
  const result = runScript(['--verify', '--replicate', '--task-ref', '1470']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /mutually exclusive/);
});

test('--replicate --task-ref forwards the exact task ref to the storage CLI', () => {
  const { dir, cleanup } = installFakeNpx();
  try {
    const result = runScript(['--replicate', '--task-ref', '1470'], { extraPathDir: dir });
    assert.equal(result.status, 0, `expected success, got stderr=${result.stderr}`);
    assert.match(result.stdout, /FAKE_NPX_CALLED:.*reconciliation-history-object-storage\.ts replicate --task-ref 1470/);
  } finally {
    cleanup();
  }
});

test('an unrecognized flag is rejected with usage instead of falling through silently', () => {
  const result = runScript(['--bogus-flag']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage: bash scripts\/archive-reconciliation-history\.sh/);
});
