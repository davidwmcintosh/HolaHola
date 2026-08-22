/**
 * Source-bridge regression checks.
 *
 * Runs the coordinator against a stateful fake git executable. This proves the
 * bridge's state transitions without contacting GitHub or mutating this repo.
 */
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const bridgePath = join(root, 'scripts/source-bridge.sh');
const syncToPath = join(root, 'scripts/sync-to-github.sh');

function assertSourceContracts(): void {
  const bridge = readFileSync(bridgePath, 'utf8');
  const syncTo = readFileSync(syncToPath, 'utf8');
  assert.match(bridge, /mkdir "\$LOCK_DIR"/, 'bridge must serialize operations with an exclusive lock');
  assert.match(bridge, /git fetch --no-tags/, 'bridge must fetch before choosing a direction');
  assert.match(bridge, /sync-to-github\.sh" --committed-only/, 'automated pushes must use committed-only mode');
  assert.match(bridge, /sync-from-github\.sh"/, 'GitHub receives must keep using the reviewed fast-forward primitive');
  assert.match(bridge, /ready_to_promote/, 'received validated source must wait for explicit promotion');
  assert.match(bridge, /record-promotion/, 'successful explicit publishing must be recordable by exact SHA');
  assert.doesNotMatch(bridge, /\bgit (add|commit|reset|push --force)\b/, 'bridge must not stage, commit, reset, or force-push');
  assert.match(syncTo, /--committed-only/, 'low-level push helper must reject dirty committed-only calls');
  assert.match(syncTo, /never stages or commits editor changes automatically/, 'committed-only refusal must be explicit');
}

function writeFakeGit(dir: string): void {
  const fakeGit = `#!/usr/bin/env bash
set -eu
printf '%s\\n' "$*" >> "$GIT_CALL_LOG"
state="$FAKE_GIT_STATE"
read_state() { sed -n "s/^$1=//p" "$state"; }
write_state() { sed -i "s/^$1=.*/$1=$2/" "$state"; }

case "\${1:-}" in
  branch) echo main ;;
  status)
    [[ "$(read_state dirty)" == 1 ]] && printf ' M editor-change\\n'
    true
    ;;
  fetch)
    remaining="$(read_state failures)"
    if [[ "$remaining" -gt 0 ]]; then
      write_state failures "$((remaining - 1))"
      echo "simulated transport failure" >&2
      exit 1
    fi
    ;;
  rev-parse)
    if [[ "$*" == *FETCH_HEAD* ]]; then read_state remote; else read_state local; fi
    ;;
  merge-base)
    left="\${3:-}"; right="\${4:-}"
    [[ "$left" == "$right" ]] && exit 0
    [[ "$left:$right" == "remote-old:local-new" ]] && exit 0
    [[ "$left:$right" == "local-old:remote-new" ]] && exit 0
    exit 1
    ;;
  push)
    write_state remote "$(read_state local)"
    write_state scenario equal
    ;;
  merge)
    [[ "\${2:-}" == --ff-only && "\${3:-}" == FETCH_HEAD ]]
    write_state local "$(read_state remote)"
    write_state scenario equal
    ;;
  *)
    echo "Unexpected fake git call: $*" >&2
    exit 98
    ;;
esac
`;
  const path = join(dir, 'git');
  writeFileSync(path, fakeGit, { mode: 0o700 });
  chmodSync(path, 0o700);
}

function writeState(dir: string, scenario: 'equal' | 'local-ahead' | 'github-ahead' | 'divergent', dirty = 0, failures = 0): string {
  const path = join(dir, 'git-state');
  const local = scenario === 'github-ahead' ? 'local-old' : 'local-new';
  const remote = scenario === 'local-ahead' ? 'remote-old' : scenario === 'github-ahead' ? 'remote-new' : scenario === 'divergent' ? 'remote-other' : local;
  writeFileSync(path, `scenario=${scenario}\nlocal=${local}\nremote=${remote}\ndirty=${dirty}\nfailures=${failures}\n`);
  return path;
}

function runBridge(options: {
  scenario: 'equal' | 'local-ahead' | 'github-ahead' | 'divergent';
  command?: string[];
  dirty?: number;
  failures?: number;
  lockPid?: number;
}): { status: number | null; calls: string; output: string; statusJson: Record<string, unknown>; tempDir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'holahola-source-bridge-test-'));
  writeFakeGit(dir);
  const statePath = writeState(dir, options.scenario, options.dirty, options.failures);
  const callsPath = join(dir, 'git-calls.log');
  const statusPath = join(dir, 'status.json');
  const lockDir = join(dir, 'bridge.lock');
  if (options.lockPid) {
    mkdirSync(lockDir);
    writeFileSync(join(lockDir, 'pid'), `${options.lockPid}\n`);
  }

  const result = spawnSync('bash', [bridgePath, ...(options.command ?? ['once'])], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      GIT_CALL_LOG: callsPath,
      FAKE_GIT_STATE: statePath,
      SOURCE_BRIDGE_STATUS_FILE: statusPath,
      SOURCE_BRIDGE_SUMMARY_FILE: join(dir, 'status.md'),
      SOURCE_BRIDGE_LOCK_DIR: lockDir,
      SOURCE_BRIDGE_SKIP_VALIDATION: '1',
      SOURCE_BRIDGE_RETRY_DELAY_SECONDS: '0',
      SOURCE_BRIDGE_RETRY_MAX: '2',
      HOLAHOLA_GITHUB_DEPLOY_KEY: '-----BEGIN OPENSSH PRIVATE KEY-----\\\\nprivate-test-material\\\\n-----END OPENSSH PRIVATE KEY-----',
    },
  });
  const calls = existsSync(callsPath) ? readFileSync(callsPath, 'utf8') : '';
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const statusJson = existsSync(statusPath) ? JSON.parse(readFileSync(statusPath, 'utf8')) as Record<string, unknown> : {};
  return { status: result.status, calls, output, statusJson, tempDir: dir };
}

function withFixture<T>(options: Parameters<typeof runBridge>[0], assertion: (result: ReturnType<typeof runBridge>) => T): T {
  const result = runBridge(options);
  try {
    return assertion(result);
  } finally {
    rmSync(result.tempDir, { recursive: true, force: true });
  }
}

function main(): void {
  assertSourceContracts();

  withFixture({ scenario: 'local-ahead' }, ({ status, calls, output, statusJson }) => {
    assert.equal(status, 0, `clean Replit-ahead source should push successfully:\n${output}\n${calls}`);
    assert.match(calls, /^push /m, 'clean Replit-ahead source must push normally');
    assert.equal(statusJson.state, 'synced', 'successful push must prove equality before synced');
  });

  withFixture({ scenario: 'github-ahead' }, ({ status, calls, statusJson }) => {
    assert.equal(status, 0, 'clean GitHub-ahead source should fast-forward successfully');
    assert.match(calls, /^merge --ff-only FETCH_HEAD/m, 'receive must use an explicit fast-forward');
    assert.equal(statusJson.state, 'ready_to_promote', 'received source must wait for explicit publish');
  });

  withFixture({ scenario: 'github-ahead', dirty: 1 }, ({ status, calls, statusJson }) => {
    assert.equal(status, 0, 'dirty worktree should defer rather than crash the workflow');
    assert.equal(statusJson.state, 'dirty', 'dirty worktree must be visible');
    assert.doesNotMatch(calls, /^(merge --ff-only|push|add|commit)\b/m, 'dirty worktree must not be mutated');
  });

  withFixture({ scenario: 'divergent' }, ({ status, calls, statusJson }) => {
    assert.equal(status, 0, 'divergence should fail closed without killing the poller');
    assert.equal(statusJson.state, 'diverged', 'divergence must be actionable in status');
    assert.doesNotMatch(calls, /^(merge --ff-only|push|add|commit)\b/m, 'divergence must not mutate either source');
  });

  withFixture({ scenario: 'local-ahead', failures: 1 }, ({ status, calls, statusJson }) => {
    assert.equal(status, 0, 'a temporary transport failure should retry');
    assert.match(calls, /^fetch /m, 'retry case must fetch');
    assert.equal(statusJson.state, 'synced', 'successful retry must reach synced');
  });

  withFixture({ scenario: 'github-ahead', dirty: 1, command: ['prepare-promotion'] }, ({ status, calls, statusJson }) => {
    assert.notEqual(status, 0, 'promotion preparation must refuse a dirty candidate');
    assert.equal(statusJson.state, 'dirty', 'promotion refusal must report dirty state');
    assert.doesNotMatch(calls, /^(merge --ff-only|push|add|commit)\b/m, 'promotion refusal must not mutate source');
  });

  withFixture({ scenario: 'equal', command: ['record-promotion', 'unvalidated-sha'] }, ({ status, statusJson }) => {
    assert.notEqual(status, 0, 'promotion recording must require a matching validated candidate');
    assert.equal(statusJson.state, 'failed', 'unvalidated promotion recording must be explicit');
  });

  withFixture({ scenario: 'equal', lockPid: process.pid }, ({ status, calls, statusJson }) => {
    assert.equal(status, 0, 'an active bridge lock should defer rather than race');
    assert.equal(statusJson.state, 'retrying', 'lock contention must be visible');
    assert.equal(calls, '', 'lock contention must not inspect or mutate git state');
  });

  console.log('Source bridge safety checks passed.');
}

main();