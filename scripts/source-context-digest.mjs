import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, readFile, readdir, readlink } from 'node:fs/promises';
import path from 'node:path';

const SHA40 = /^[0-9a-f]{40}$/;
const EXCLUDED_TOP_LEVEL = new Set([
  '.cache',
  '.config',
  '.git',
  '.local',
  'dist',
  'exports',
  'node_modules',
]);

function isExcludedSourcePath(relative) {
  if (EXCLUDED_TOP_LEVEL.has(relative.split('/')[0])) return true;
  return /^attached_assets\/.*\.(?:pdf|zip)$/.test(relative)
    || /^attached_assets\/Pasted-/.test(relative)
    || relative === 'attached_assets/output_1789235726963.png';
}

async function collectFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    if (isExcludedSourcePath(relative)) continue;
    if (entry.isDirectory()) {
      files.push(...await collectFiles(root, absolute));
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      files.push(relative);
    }
  }
  return files;
}

export async function hashSourceContext(root) {
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

export async function hashGitCommitSourceContext(root, sha) {
  if (!SHA40.test(sha)) throw new Error('source_context_commit_invalid');
  const tree = execFileSync('git', ['-C', root, 'ls-tree', '-rz', '-r', '--full-tree', sha], {
    encoding: 'buffer',
    maxBuffer: 32 * 1024 * 1024,
  });
  const entries = Buffer.from(tree)
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf('\t');
      if (separator < 1) throw new Error('source_context_tree_invalid');
      const [mode, type, object] = entry.slice(0, separator).split(' ');
      return { mode, type, object, path: entry.slice(separator + 1) };
    })
    .filter((entry) =>
      entry.type === 'blob'
      && !isExcludedSourcePath(entry.path))
    .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  if (entries.length < 1 || entries.length > 100_000) {
    throw new Error('source_context_file_count_invalid');
  }
  const hash = createHash('sha256');
  for (const entry of entries) {
    const blob = execFileSync('git', ['-C', root, 'cat-file', 'blob', entry.object], {
      encoding: 'buffer',
      maxBuffer: 128 * 1024 * 1024,
    });
    hash.update(entry.path);
    hash.update('\0');
    hash.update(entry.mode === '120000' ? 'symlink\0' : 'file\0');
    hash.update(blob);
    hash.update('\0');
  }
  return { digest: hash.digest('hex'), fileCount: entries.length };
}