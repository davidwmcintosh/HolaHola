import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateReleaseManifest } from '../../scripts/generate-release-manifest.mjs';
import { loadReleaseIdentity, parseReleaseIdentity } from '../services/release-identity';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-identity-'));
fs.writeFileSync(path.join(root, 'app.txt'), 'exact source bytes\n');
fs.mkdirSync(path.join(root, 'dist'));

const output = path.join(root, 'dist', 'release-manifest.json');
const commit = 'a'.repeat(40);
const manifest = await generateReleaseManifest({
  root,
  output,
  env: { RELEASE_COMMIT_SHA: commit },
});

assert.equal(manifest.authority, 'build');
assert.equal(manifest.promotable, true);
assert.equal(manifest.commitSha, commit);
assert.match(manifest.sourceContextSha256, /^[0-9a-f]{64}$/);
assert.equal(loadReleaseIdentity(output).promotable, true);

const development = await generateReleaseManifest({
  root,
  output,
  env: { RELEASE_COMMIT_SHA: 'not-a-sha' },
});
assert.equal(development.authority, 'development');
assert.equal(development.promotable, false);
assert.equal(development.commitSha, null);

assert.throws(
  () => parseReleaseIdentity({ ...manifest, commitSha: 'bad', promotable: true }),
  /manifest_commit_invalid/,
);
assert.throws(
  () => parseReleaseIdentity({ ...manifest, authority: 'development', promotable: true }),
  /manifest_promotable_claim_invalid/,
);

fs.rmSync(root, { recursive: true, force: true });
console.log('Release identity tests passed');