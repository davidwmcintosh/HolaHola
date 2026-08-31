import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const coordinator = readFileSync(join(root, 'server/services/source-control-service.ts'), 'utf8');

assert.match(coordinator, /HOLAHOLA_GITHUB_DEPLOY_KEY/, 'coordinator must require the repository deploy key');
assert.match(coordinator, /PINNED_GITHUB_HOST_KEYS/, 'coordinator must pin GitHub host keys');
assert.match(coordinator, /StrictHostKeyChecking=yes/, 'coordinator must require pinned-host verification');
assert.match(coordinator, /mode: 0o600/, 'temporary credentials must be owner-only');
assert.match(coordinator, /await rm\(tempDir, \{ recursive: true, force: true \}\)/, 'temporary credentials must be cleaned in finally');
assert.match(coordinator, /\['fetch', '--no-tags'/, 'coordinator must fetch before source decisions');
assert.match(coordinator, /\['merge', '--ff-only', 'FETCH_HEAD'\]/, 'receive must be fast-forward-only');
assert.match(coordinator, /\['push', this\.repoUrl/, 'push must use the fixed repository target');
assert.doesNotMatch(coordinator, /--force/, 'force push must remain impossible');
assert.doesNotMatch(coordinator, /\['(?:add|commit|reset)'/, 'coordinator must not stage, commit, or reset');

for (const script of ['scripts/sync-to-github.sh', 'scripts/sync-from-github.sh']) {
  const result = spawnSync('bash', [join(root, script)], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 78, `${script} must fail closed`);
  assert.match(`${result.stdout}${result.stderr}`, /coordinator/i);
}

const sshHelper = join(root, 'scripts/github-release-ssh.sh');
const tempDir = mkdtempSync(join(tmpdir(), 'holahola-release-safety-'));
const testKeyPath = join(tempDir, 'test-key');

try {
  const generated = spawnSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', testKeyPath], {
    encoding: 'utf8',
  });
  assert.equal(generated.status, 0, `test key generation failed: ${generated.stderr}`);

  const multilineKey = readFileSync(testKeyPath, 'utf8');
  const validSerializations = [
    ['multiline', multilineKey],
    ['literal-newline', multilineKey.replace(/\n/g, '\\n')],
    ['space-flattened', multilineKey.replace(/\n/g, ' ')],
    ['fully-flattened', multilineKey.replace(/\s/g, '')],
    ['base64-wrapped', Buffer.from(multilineKey, 'utf8').toString('base64')],
  ] as const;

  const prepareAndCleanup = `
set -euo pipefail
source "$1"
prepare_github_ssh "$TEST_KEY"
key_file="$GITHUB_SSH_KEY_FILE"
hosts_file="$GITHUB_KNOWN_HOSTS_FILE"
test -f "$key_file"
test -f "$hosts_file"
ssh-keygen -y -f "$key_file" >/dev/null 2>&1
cleanup_github_ssh
test ! -e "$key_file"
test ! -e "$hosts_file"
`;

  for (const [label, serializedKey] of validSerializations) {
    const result = spawnSync('bash', ['-c', prepareAndCleanup, 'bash', sshHelper], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, TEST_KEY: serializedKey },
    });
    assert.equal(
      result.status,
      0,
      `${label} deploy-key serialization must normalize and clean up: ${result.stderr}`,
    );
  }

  const invalidSerializations = [
    ['empty', '', /not set/i],
    [
      'invalid-payload-alphabet',
      '-----BEGIN OPENSSH PRIVATE KEY-----\nnot@base64\n-----END OPENSSH PRIVATE KEY-----',
      /invalid armored payload/i,
    ],
    [
      'mismatched-armor',
      '-----BEGIN OPENSSH PRIVATE KEY-----\nAAAA\n-----END RSA PRIVATE KEY-----',
      /supported armored private key/i,
    ],
    [
      'parse-invalid',
      '-----BEGIN OPENSSH PRIVATE KEY-----\nAAAA\n-----END OPENSSH PRIVATE KEY-----',
      /could not be parsed/i,
    ],
  ] as const;

  const rejectAndProveCleanup = `
set -uo pipefail
source "$1"
if prepare_github_ssh "$TEST_KEY"; then
  exit 90
fi
test -z "\${GITHUB_SSH_KEY_FILE:-}"
test -z "\${GITHUB_KNOWN_HOSTS_FILE:-}"
`;

  for (const [label, serializedKey, expectedError] of invalidSerializations) {
    const result = spawnSync('bash', ['-c', rejectAndProveCleanup, 'bash', sshHelper], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, TEST_KEY: serializedKey },
    });
    assert.equal(result.status, 0, `${label} deploy-key input must fail closed and clean up`);
    assert.match(result.stderr, expectedError, `${label} must report a safe actionable error`);
    assert.doesNotMatch(result.stderr, /BEGIN .*PRIVATE KEY/, `${label} must not log key material`);
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

console.log('GitHub release transport safety checks passed.');