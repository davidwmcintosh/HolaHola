import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateReleaseManifest } from '../../scripts/generate-release-manifest.mjs';
import { hashGitCommitSourceContext } from '../../scripts/source-context-digest.mjs';
import { loadReleaseIdentity, parseReleaseIdentity } from '../services/release-identity';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-identity-'));
fs.writeFileSync(path.join(root, 'app.txt'), 'exact source bytes\n');
fs.mkdirSync(path.join(root, 'nested'));
fs.writeFileSync(path.join(root, 'nested', 'source.txt'), 'nested source bytes\n');
fs.mkdirSync(path.join(root, 'dist'));
execFileSync('git', ['init'], { cwd: root, stdio: 'ignore' });
execFileSync('git', ['config', 'user.email', 'release-identity@example.invalid'], { cwd: root });
execFileSync('git', ['config', 'user.name', 'Release Identity Test'], { cwd: root });
execFileSync('git', ['add', 'app.txt', 'nested/source.txt'], { cwd: root });
execFileSync('git', ['commit', '-m', 'fixture'], { cwd: root, stdio: 'ignore' });

const output = path.join(root, 'dist', 'release-manifest.json');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
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
const firstGitContext = await hashGitCommitSourceContext(root, commit);
assert.equal(firstGitContext.fileCount, 2, 'exact Git context must include nested files');
fs.writeFileSync(path.join(root, 'nested', 'source.txt'), 'changed nested source bytes\n');
execFileSync('git', ['add', 'nested/source.txt'], { cwd: root });
execFileSync('git', ['commit', '-m', 'nested-only change'], { cwd: root, stdio: 'ignore' });
const nestedChangeCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
const nestedChangeContext = await hashGitCommitSourceContext(root, nestedChangeCommit);
assert.equal(nestedChangeContext.fileCount, firstGitContext.fileCount);
assert.notEqual(
  nestedChangeContext.digest,
  firstGitContext.digest,
  'a nested-file-only change must change the exact Git source-context digest',
);

const renderRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'release-identity-render-'));
fs.writeFileSync(path.join(renderRoot, 'app.txt'), 'render build context\n');
fs.mkdirSync(path.join(renderRoot, 'dist'));
const renderWithoutGit = await generateReleaseManifest({
  root: renderRoot,
  output: path.join(renderRoot, 'dist', 'release-manifest.json'),
  env: { RENDER_GIT_COMMIT: commit },
});
assert.equal(renderWithoutGit.authority, 'build');
assert.equal(renderWithoutGit.promotable, true);
assert.equal(renderWithoutGit.commitSha, commit);
assert.equal(renderWithoutGit.dirtyWorktree, null);
fs.rmSync(renderRoot, { recursive: true, force: true });

const development = await generateReleaseManifest({
  root,
  output,
  env: { RELEASE_COMMIT_SHA: 'not-a-sha' },
});
assert.equal(development.authority, 'development');
assert.equal(development.promotable, false);
assert.equal(development.commitSha, nestedChangeCommit);

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