import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { sha256Hex } from '../../../shared/worker-contracts';
import { assertNoLinks, stageFiles, validateHarnessOutput } from './staging';

function tempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'lrw-repo-'));
  const git = (...a: string[]) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
  git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't'); git('config', 'core.autocrlf', 'false');
  mkdirSync(join(dir, 'docs'));
  writeFileSync(join(dir, 'docs', 'a.md'), 'line1\nline2\nline3\n');
  writeFileSync(join(dir, 'docs', 'secret.md'), 'not staged');
  git('add', '.'); git('commit', '-q', '-m', 'c');
  writeFileSync(join(dir, 'docs', 'a.md'), 'CHANGED IN WORKTREE\n'); // staging must use the commit, not the worktree
  return { dir, commit: git('rev-parse', 'HEAD') };
}

test('staging writes only selected files from commit blobs, not the working tree', () => {
  const { dir, commit } = tempRepo();
  const staging = mkdtempSync(join(tmpdir(), 'lrw-in-'));
  try {
    stageFiles({ repoRoot: dir, commit, files: [{ path: 'docs/a.md' }], stagingDir: staging });
    assert.equal(readFileSync(join(staging, 'docs', 'a.md'), 'utf8'), 'line1\nline2\nline3\n');
    assert.throws(() => readFileSync(join(staging, 'docs', 'secret.md')));
    assert.throws(() => stageFiles({ repoRoot: dir, commit, files: [{ path: 'docs/a.md' }], stagingDir: staging }), /staging_not_empty/);
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(staging, { recursive: true, force: true }); }
});

test('a link or junction anywhere in staging fails the check', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'lrw-link-'));
  try {
    mkdirSync(join(root, 'docs'));
    try { symlinkSync(tmpdir(), join(root, 'docs', 'escape'), 'junction'); } catch { t.skip('cannot create junction here'); return; }
    assert.throws(() => assertNoLinks(root), /staging_reparse_point/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

function stagingWith(text: string) {
  const dir = mkdtempSync(join(tmpdir(), 'lrw-val-'));
  mkdirSync(join(dir, 'docs'));
  writeFileSync(join(dir, 'docs', 'a.md'), text);
  return dir;
}
const out = (structured: unknown, extra: Record<string, unknown> = {}) => JSON.stringify({ type: 'result', is_error: false, structured_output: structured, total_cost_usd: 0.12, ...extra });

test('valid output yields citations re-read from staged bytes with supervisor-computed digests', () => {
  const dir = stagingWith('alpha\nbeta\ngamma\n');
  try {
    const r = validateHarnessOutput(out({ summary: 's', findings: [], citations: [{ path: 'docs/a.md', startLine: 2, endLine: 3 }] }), dir, new Set(['docs/a.md']));
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.citations[0].excerpt, 'beta\ngamma');
      assert.equal(r.citations[0].excerptSha256, sha256Hex(Buffer.from('beta\ngamma', 'utf8')));
      assert.equal(r.costTelemetryUsd, 0.12);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('citations outside staging or beyond the file are citation_mismatch', () => {
  const dir = stagingWith('one\n');
  try {
    const bad1 = validateHarnessOutput(out({ summary: 's', findings: [], citations: [{ path: 'server/x.ts', startLine: 1, endLine: 1 }] }), dir, new Set(['docs/a.md']));
    assert.deepEqual(bad1, { ok: false, failureClass: 'citation_mismatch', detail: 'citation_path_not_staged' });
    const bad2 = validateHarnessOutput(out({ summary: 's', findings: [], citations: [{ path: 'docs/a.md', startLine: 1, endLine: 9 }] }), dir, new Set(['docs/a.md']));
    assert.deepEqual(bad2, { ok: false, failureClass: 'citation_mismatch', detail: 'citation_beyond_file' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('malformed output, schema violations and harness errors map to closed failure classes', () => {
  const dir = stagingWith('x\n');
  try {
    assert.equal((validateHarnessOutput('not json', dir, new Set()) as { failureClass: string }).failureClass, 'schema_invalid');
    assert.equal((validateHarnessOutput(out({ summary: 1 }), dir, new Set()) as { failureClass: string }).failureClass, 'schema_invalid');
    assert.equal((validateHarnessOutput(JSON.stringify({ type: 'result', is_error: true, result: 'Not logged in · Please run /login' }), dir, new Set()) as { failureClass: string }).failureClass, 'auth_required');
    assert.equal((validateHarnessOutput(JSON.stringify({ type: 'result', is_error: true, result: 'boom' }), dir, new Set()) as { failureClass: string }).failureClass, 'harness_unavailable');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
