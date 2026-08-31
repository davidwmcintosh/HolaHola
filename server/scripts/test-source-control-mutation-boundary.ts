import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const legacyFiles = [
  'scripts/source-bridge.sh',
  'scripts/source-bridge-history.sh',
  'scripts/source-bridge-supervisor.sh',
  'scripts/sync-to-github.sh',
  'scripts/sync-from-github.sh',
  'scripts/post-merge.sh',
  'scripts/alden-build-guardian.js',
  'server/services/source-promotion-service.ts',
  'server/services/alden-code-review-service.ts',
  'server/services/alden-build-service.ts',
];

for (const file of legacyFiles) {
  const source = readFileSync(join(root, file), 'utf8');
  assert.doesNotMatch(
    source,
    /\bgit\s+(?:fetch|merge|push|add|commit|reset)\b|sync-to-github\.sh|sync-from-github\.sh|source-bridge\.sh\s+(?:once|watch|prepare-promotion|record-promotion)/,
    `${file} must not expose a development Git mutation bypass`,
  );
}

const coordinator = readFileSync(join(root, 'server/services/source-control-service.ts'), 'utf8');
for (const command of ["['fetch'", "['merge', '--ff-only'", "['push'"]) {
  assert.match(coordinator, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `coordinator must own ${command}`);
}
assert.doesNotMatch(coordinator, /\['(?:add|commit|reset)'/, 'coordinator must never stage, commit, or reset');
assert.doesNotMatch(coordinator, /--force/, 'coordinator must never force-push');

console.log('Source-control single-writer mutation boundary passed.');