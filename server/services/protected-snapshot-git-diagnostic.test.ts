import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { protectedSnapshotGitErrorCode } from './protected-snapshot-git-diagnostic';

test('Git failures expose only fixed diagnostics, never secret stderr', () => {
  const cases: Array<[unknown, string]> = [
    [{ code: 'ENOENT', stderr: 'secret path' }, 'executable_missing'],
    [{ stderr: Buffer.from('fatal: server certificate verification failed. CAfile: none CRLfile: none') }, 'tls_failed'],
    [{ stderr: 'fatal: SSL certificate problem: unable to get local issuer certificate' }, 'tls_failed'],
    [{ stderr: 'fatal: Authentication failed for https://secret@github.com/private' }, 'authentication_failed'],
    [{ stderr: 'fatal: unable to access secret: The requested URL returned error: 403' }, 'authentication_failed'],
    [{ stderr: "fatal: path 'secret.pem' does not exist in 'abcdef'" }, 'source_object_missing'],
    [{ stderr: 'fatal: remote error: upload-pack: not our ref secret' }, 'source_object_missing'],
    [{ stderr: 'secret token and raw output' }, 'failed'],
    [null, 'failed'],
  ];
  for (const [error, expected] of cases) {
    assert.equal(protectedSnapshotGitErrorCode(error), `protected_remote_snapshot_git_${expected}`);
  }
});

test('Render runtime explicitly installs Git HTTPS trust without disabling verification', () => {
  const dockerfile = readFileSync('Dockerfile', 'utf8').split(' AS runtime')[1];
  assert.ok(dockerfile);
  const install = dockerfile.match(/apt-get install -y --no-install-recommends\s+([\s\S]*?)&&/);
  assert.ok(install);
  assert.match(install[1], /\bgit\b/);
  assert.match(install[1], /\bca-certificates\b/);
  assert.doesNotMatch(dockerfile, /GIT_SSL_NO_VERIFY|sslVerify\s*=?\s*false/i);
});