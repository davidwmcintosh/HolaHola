import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

console.log('GitHub release transport safety checks passed.');