import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, 'config/source-reconciliation-policies.json'), 'utf8'));
assert.ok(!manifest.policies.some((policy: any) => policy.proof?.episodeReceiptProof),
  'episode receipts are an overlay, not a broad generated-local policy');
assert.ok(manifest.policies.filter((policy: any) => policy.proof?.builtInLedgerProof).length === 4);

const covered = [
  { file: 'server/scripts/restore-rolling-episodes-from-db.ts', destination: 'mdPath', writer: 'restore-rolling-episodes-from-db' },
  { file: 'server/scripts/restore-episode-27-from-db.ts', destination: 'MD_PATH', writer: 'restore-episode-27-from-db' },
  { file: 'server/scripts/restore-episode-28-from-db.ts', destination: 'MD_PATH', writer: 'restore-episode-28-from-db' },
  { file: 'server/scripts/sync-ep27-from-db.ts', destination: 'filePath', writer: 'sync-ep27-from-db' },
  { file: 'server/services/agent-notes-snapshot.ts', destination: '(?:ledgerPath|markdownPath)', writer: 'agent-notes-snapshot' },
];

// These are file-first authoring / Markdown→DB paths, not DB→Markdown
// projections. They must remain outside this projection-writer registry.
const authoringPaths = [
  'server/scripts/append-to-episode.ts',
  'server/scripts/sync-episode-27-from-md.ts',
  'server/scripts/sync-episode-28-from-md.ts',
  'server/scripts/sync-ep27-from-md.ts',
];
for (const file of authoringPaths) {
  const source = readFileSync(join(root, file), 'utf8');
  assert.doesNotMatch(source, /writer:\s*'(?:restore|sync)-.*-from-db'/,
    `${file} must not masquerade as a DB projection writer`);
}
for (const file of ['server/scripts/sync-prequel-ep1-from-db.ts', 'server/scripts/sync-prequel-ep3-from-db.ts']) {
  const source = readFileSync(join(root, file), 'utf8');
  assert.doesNotMatch(source, /writeProjectionAtomically/,
    `${file} is deliberately outside the approved numeric-episode receipt scope`);
}

function verify(source: string, item: typeof covered[number]): void {
  assert.match(source, /writeProjectionAtomically\s*\(/, `${item.file} must use the projection writer`);
  assert.ok(source.includes(`writer: '${item.writer}'`), `${item.file} must preserve its trusted writer identity`);
  const direct = new RegExp(`(?:writeFileSync|writeFile|renameSync|rename)\\s*\\(\\s*${item.destination}\\b`);
  assert.doesNotMatch(source, direct, `${item.file} directly mutates a policy-matched destination`);
}
for (const item of covered) verify(readFileSync(join(root, item.file), 'utf8'), item);

const episode28 = readFileSync(join(root, 'server/scripts/restore-episode-28-from-db.ts'), 'utf8');
assert.match(episode28, /source:\s*\{\s*type:\s*'conversation_memory',\s*ids:\s*\[EPISODE_ID\]/);
assert.doesNotMatch(episode28, /writeFileSync\s*\(\s*MD_PATH|unlinkSync\s*\(\s*MD_PATH/);
assert.match(episode28, /writeIsolatedProjectionFixture/);
assert.match(episode28, /removeIsolatedProjectionFixture/);
assert.match(episode28, /const ok = restoreFromDb\(dbContent\)/, 'self-check canonical DB restore must use the receipt writer');

// Mutation self-check: removing the projection call must make the verifier fail.
assert.throws(() => verify(episode28.replace('writeProjectionAtomically(', 'removedProjectionCall('), covered[2]));
console.log('Projection writer static coverage and mutation self-check: PASS');