/**
 * GitHub release-script safety checks.
 *
 * Exercises the release scripts with a fake git executable so the failure
 * paths are deterministic and make no network calls or repository changes.
 */

import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const syncToPath = join(root, 'scripts/sync-to-github.sh');
const syncFromPath = join(root, 'scripts/sync-from-github.sh');
const sshHelperPath = join(root, 'scripts/github-release-ssh.sh');

function assertReleaseSources(): void {
  const syncTo = readFileSync(syncToPath, 'utf8');
  const syncFrom = readFileSync(syncFromPath, 'utf8');
  const helper = readFileSync(sshHelperPath, 'utf8');

  for (const [label, source] of [['sync-to', syncTo], ['sync-from', syncFrom]] as const) {
    assert.match(source, /HOLAHOLA_GITHUB_DEPLOY_KEY/, `${label} must require the repository deploy key`);
    assert.doesNotMatch(source, /GITHUB_TOKEN/, `${label} must not use the retired HTTPS token`);
    assert.doesNotMatch(source, /https:\/\/[^"\n]*github\.com/, `${label} must not embed an HTTPS GitHub remote`);
  }

  assert.match(syncTo, /git fetch --no-tags/, 'sync-to must fetch before its release decision');
  assert.match(syncTo, /merge-base --is-ancestor/, 'sync-to must check ancestry before pushing');
  assert.match(syncFrom, /git merge --ff-only FETCH_HEAD/, 'sync-from must only fast-forward');
  assert.doesNotMatch(syncFrom, /\bgit pull\b/, 'sync-from must not use an implicit pull/merge');
  assert.match(helper, /raw_key="\$\{raw_key\/\/\\\\n\/\$'\\n'\}"/, 'one-line escaped key values must be normalized');
  assert.match(helper, /Some secret stores remove the physical line breaks entirely/, 'single-line armored keys must be normalized');
  assert.match(helper, /GitHub's published SSH host keys, pinned here/, 'host keys must be pinned, not discovered over the release network');
  assert.doesNotMatch(helper, /^\s*ssh-keyscan\b/m, 'runtime host-key discovery would allow a network MITM');
  assert.match(helper, /mktemp \/tmp\/holahola-github-key/, 'temporary credentials must not use caller-provided TMPDIR');
  assert.match(helper, /printf -v GIT_SSH_COMMAND/, 'GIT_SSH_COMMAND paths must be shell-quoted');
  assert.match(helper, /trap cleanup_github_ssh EXIT|cleanup_github_ssh/, 'temporary key files must be cleaned up');
}

function writeFakeTools(dir: string): void {
  const fakeGit = `#!/usr/bin/env bash
set -eu
printf '%q ' "$@" >> "$GIT_CALL_LOG"
printf '\\n' >> "$GIT_CALL_LOG"

case "\${1:-}" in
  branch)
    echo main
    ;;
  status|fetch)
    ;;
  rev-parse)
    if [[ "$*" == *FETCH_HEAD* ]]; then
      echo remote-new
    else
      echo local-old
    fi
    ;;
  merge-base)
    case "\${FAKE_GIT_SCENARIO:-remote-ahead}" in
      remote-ahead)
        # local-old is an ancestor of remote-new.
        [[ "\${3:-}" == local-old && "\${4:-}" == remote-new ]] && exit 0
        ;;
      local-ahead)
        # remote-new is an ancestor of local-old.
        [[ "\${3:-}" == remote-new && "\${4:-}" == local-old ]] && exit 0
        ;;
      divergent)
        # Neither commit is an ancestor of the other.
        ;;
    esac
    exit 1
    ;;
  merge)
    [[ "\${2:-}" == "--ff-only" && "\${3:-}" == "FETCH_HEAD" ]]
    ;;
  push|commit|add)
    echo "UNEXPECTED MUTATION: $*" >&2
    exit 99
    ;;
  *)
    echo "Unexpected fake git call: $*" >&2
    exit 98
    ;;
esac
`;
  const fakeSshKeyscan = `#!/usr/bin/env bash
echo "github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITestHostKey"
`;

  writeFileSync(join(dir, 'git'), fakeGit, { mode: 0o700 });
  writeFileSync(join(dir, 'ssh-keyscan'), fakeSshKeyscan, { mode: 0o700 });
  chmodSync(join(dir, 'git'), 0o700);
  chmodSync(join(dir, 'ssh-keyscan'), 0o700);
}

function runReleaseScript(
  scriptPath: string,
  scenario: 'remote-ahead' | 'divergent' | 'local-ahead' = 'remote-ahead',
): { status: number | null; output: string; calls: string } {
  const tempDir = mkdtempSync(join(tmpdir(), 'holahola-github-release-test-'));
  const callsPath = join(tempDir, 'git-calls.log');
  try {
    writeFakeTools(tempDir);
    const result = spawnSync('bash', [scriptPath], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${tempDir}:${process.env.PATH}`,
        GIT_CALL_LOG: callsPath,
        FAKE_GIT_SCENARIO: scenario,
        // Deliberately not a real credential. It verifies escaped newline
        // normalization and that script errors never echo private-key text.
        HOLAHOLA_GITHUB_DEPLOY_KEY: '-----BEGIN OPENSSH PRIVATE KEY-----\\\\nprivate-test-material\\\\n-----END OPENSSH PRIVATE KEY-----',
      },
    });
    return {
      status: result.status,
      output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
      calls: readFileSync(callsPath, 'utf8'),
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function assertPhysicalOneLineKeyNormalizes(): void {
  const tempDir = mkdtempSync(join(tmpdir(), 'holahola-github-key-normalization-test-'));
  const privateKeyPath = join(tempDir, 'test-key');
  try {
    writeFakeTools(tempDir);
    const keygen = spawnSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', privateKeyPath], {
      encoding: 'utf8',
    });
    assert.equal(keygen.status, 0, `could not create temporary key fixture: ${keygen.stderr}`);

    const oneLineKey = readFileSync(privateKeyPath, 'utf8').replace(/\r?\n/g, '');
    const result = spawnSync('bash', ['-c', [
      'source "$1"',
      'prepare_github_ssh "$TEST_KEY"',
      'ssh-keygen -y -f "$GITHUB_SSH_KEY_FILE" >/dev/null',
      'cleanup_github_ssh',
    ].join('; '), 'bash', sshHelperPath], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${tempDir}:${process.env.PATH}`,
        TEST_KEY: oneLineKey,
      },
    });
    assert.equal(result.status, 0, `physical one-line key must normalize safely: ${result.stderr}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function assertNoMutation(calls: string): void {
  assert.doesNotMatch(calls, /^(push|commit|add)\b/m, `refusal path must not write or push:\n${calls}`);
}

function main(): void {
  assertReleaseSources();
  assertPhysicalOneLineKeyNormalizes();

  const remoteAhead = runReleaseScript(syncToPath);
  assert.notEqual(remoteAhead.status, 0, 'sync-to must fail when GitHub has a newer branch');
  assert.match(remoteAhead.output, /GitHub is ahead of Replit/, 'sync-to must explain its safe refusal');
  assert.doesNotMatch(remoteAhead.output, /private-test-material/, 'sync-to must never print key material');
  assertNoMutation(remoteAhead.calls);

  const divergentPush = runReleaseScript(syncToPath, 'divergent');
  assert.notEqual(divergentPush.status, 0, 'sync-to must fail when histories diverge');
  assert.match(divergentPush.output, /have diverged/, 'sync-to must explain a divergent-history refusal');
  assertNoMutation(divergentPush.calls);

  const fastForward = runReleaseScript(syncFromPath);
  assert.equal(fastForward.status, 0, `sync-from should accept a clean fast-forward:\n${fastForward.output}`);
  assert.match(fastForward.calls, /^merge --ff-only FETCH_HEAD/m, 'sync-from must use an explicit fast-forward merge');
  assert.doesNotMatch(fastForward.calls, /^push\b/m, 'sync-from must never push');

  const localAheadPull = runReleaseScript(syncFromPath, 'local-ahead');
  assert.notEqual(localAheadPull.status, 0, 'sync-from must fail rather than move Replit backward');
  assert.match(localAheadPull.output, /ahead of GitHub/, 'sync-from must explain a local-ahead refusal');
  assertNoMutation(localAheadPull.calls);

  const divergentPull = runReleaseScript(syncFromPath, 'divergent');
  assert.notEqual(divergentPull.status, 0, 'sync-from must fail when histories diverge');
  assert.match(divergentPull.output, /have diverged/, 'sync-from must explain a divergent-history refusal');
  assertNoMutation(divergentPull.calls);

  console.log('GitHub release safety checks passed.');
}

main();