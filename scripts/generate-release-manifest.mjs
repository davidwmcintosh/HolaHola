import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, readFile, readdir, readlink, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const EXCLUDED_TOP_LEVEL = new Set([
  '.cache',
  '.config',
  '.git',
  '.local',
  'dist',
  'exports',
  'node_modules',
]);

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

async function collectFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    const topLevel = relative.split('/')[0];
    if (EXCLUDED_TOP_LEVEL.has(topLevel)) continue;

    if (entry.isDirectory()) {
      files.push(...await collectFiles(root, absolute));
      continue;
    }

    if (entry.isFile() || entry.isSymbolicLink()) files.push(relative);
  }

  return files;
}

async function hashSourceContext(root) {
  const hash = createHash('sha256');
  const files = (await collectFiles(root)).sort();
  if (files.length === 0) throw new Error('source_context_empty');

  for (const relative of files) {
    const absolute = path.join(root, ...relative.split('/'));
    const stat = await lstat(absolute);
    hash.update(relative);
    hash.update('\0');
    if (stat.isSymbolicLink()) {
      hash.update('symlink\0');
      hash.update(await readlink(absolute));
    } else {
      hash.update('file\0');
      hash.update(await readFile(absolute));
    }
    hash.update('\0');
  }

  return { digest: hash.digest('hex'), fileCount: files.length };
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

  const source = await hashSourceContext(root);
  if (!SHA256.test(source.digest)) throw new Error('source_context_digest_invalid');

  const buildInput = commitSource === 'release-build-input' || commitSource === 'render-build-input';
  const matchesVisibleGit = !gitCommit || gitCommit === commitSha;
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