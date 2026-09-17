import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  hashGitCommitSourceContext,
  hashSourceContext,
} from './source-context-digest.mjs';

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;

function normalizeCommit(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return SHA40.test(normalized) ? normalized : null;
}

function git(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

export async function generateReleaseManifest({
  root = process.cwd(),
  output = path.join(root, 'dist', 'release-manifest.json'),
  env = process.env,
} = {}) {
  const explicitCommit = normalizeCommit(env.RELEASE_COMMIT_SHA);
  const renderCommit = normalizeCommit(env.RENDER_GIT_COMMIT);
  const gitCommit = normalizeCommit(git(root, ['rev-parse', 'HEAD']));
  const dirty = gitCommit ? git(root, ['status', '--porcelain']).length > 0 : null;
  const commitSha = explicitCommit || renderCommit || gitCommit;
  const commitSource = explicitCommit
    ? 'release-build-input'
    : renderCommit
      ? 'render-build-input'
      : gitCommit
        ? 'git-worktree'
        : 'unavailable';

  const buildInput = commitSource === 'release-build-input' || commitSource === 'render-build-input';
  const matchesVisibleGit = Boolean(gitCommit && gitCommit === commitSha);
  const source = buildInput && matchesVisibleGit
    ? await hashGitCommitSourceContext(root, commitSha)
    : await hashSourceContext(root);
  if (!SHA256.test(source.digest)) throw new Error('source_context_digest_invalid');

  const promotable = Boolean(commitSha && buildInput && dirty !== true && matchesVisibleGit);
  const manifest = {
    schemaVersion: 1,
    authority: promotable ? 'build' : 'development',
    promotable,
    commitSha,
    commitSource,
    sourceContextSha256: source.digest,
    sourceContextAlgorithm: 'sha256(path-nul-kind-nul-bytes-nul-v1)',
    sourceFileCount: source.fileCount,
    dirtyWorktree: dirty,
  };

  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const manifest = await generateReleaseManifest();
  console.log(
    `[ReleaseManifest] authority=${manifest.authority} promotable=${manifest.promotable}`
    + ` commit=${manifest.commitSha || 'unavailable'} source=${manifest.sourceContextSha256}`,
  );
}