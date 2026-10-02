// Opt-in integration test: unlike the hermetic reconciliation matrix, this
// exercises the default subprocess against the real memory DB. It reads the DB
// and writes only inside temporary directories; never run with a test-files
// override inherited by the candidate subprocess.
// Run alone: SOURCE_RECONCILIATION_LIVE_MEMORY_TEST=1 npx tsx --test \
//   server/scripts/test-source-reconciliation-memory-regeneration-live.test.ts
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { SourceReconciliationService } from '../services/source-reconciliation-service';

const projectRoot = resolve(import.meta.dirname, '../..');
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const runGit = async (args: string[], cwd: string) => {
  try {
    const stdout = execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, stdout, stderr: '' };
  } catch (error: any) {
    return { code: 1, stdout: String(error.stdout || ''), stderr: String(error.stderr || error.message) };
  }
};

test('default memory CLI regenerates a conflicted merge worktree from the DB', async (context) => {
  if (process.env.SOURCE_RECONCILIATION_LIVE_MEMORY_TEST !== '1') {
    context.skip('requires explicit live-memory integration opt-in');
    return;
  }
  assert.ok(process.env.NEON_SHARED_DATABASE_URL, 'the real memory DB connection is required');
  assert.equal(process.env.AGENT_MEMORY_TEST_FILES_DIR, undefined, 'the candidate subprocess must write into its worktree');

  const temp = mkdtempSync(join(tmpdir(), 'reconcile-memory-live-'));
  const root = join(temp, 'repo');
  const remote = join(temp, 'remote.git');
  const projection = join(temp, 'projection');
  mkdirSync(root);
  mkdirSync(projection);
  try {
    // Snapshot DB-canonical lines outside the real checkout. The candidate's
    // default command will run separately without the files-dir override.
    execFileSync(resolve(projectRoot, 'node_modules/.bin/tsx'),
      ['server/scripts/agent-memory-cli.ts', 'regenerate', '--all'], {
        cwd: projectRoot, env: { ...process.env, AGENT_MEMORY_TEST_FILES_DIR: projection },
        encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024,
      });
    const canonical = readFileSync(join(projection, 'MEMORY.md'), 'utf8');
    const entries = canonical.split('\n').filter((line) => /^- \[.+\]\(.+\.md\) — /.test(line));
    assert.ok(entries.length >= 2, 'DB projection needs two entries to construct a conflict');
    const path = '.agents/memory/MEMORY.md';

    git(root, 'init', '-b', 'main');
    git(root, 'config', 'user.name', 'test');
    git(root, 'config', 'user.email', 'test@example.invalid');
    // Symlinks provide the actual CLI and schema without copying the whole
    // repository. They are committed so the isolated git worktree has them too.
    for (const name of ['server', 'shared']) symlinkSync(join(projectRoot, name), join(root, name));
    symlinkSync(join(projectRoot, 'node_modules'), join(root, 'node_modules'));
    writeFileSync(join(root, '.gitignore'), 'node_modules/\n.local/\n');
    writeFileSync(join(root, 'package.json'), '{"type":"module"}\n');
    writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler',
        baseUrl: '.', paths: { '@shared/*': ['./shared/*'] } },
    }));
    mkdirSync(join(root, 'config'));
    writeFileSync(join(root, 'config/source-reconciliation-policies.json'),
      JSON.stringify({ schemaVersion: 1, policies: [] }));
    mkdirSync(join(root, '.agents/memory'), { recursive: true });
    writeFileSync(join(root, path), '# Memory\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'base');
    git(root, 'init', '--bare', remote);
    git(root, 'remote', 'add', 'origin', remote);
    git(root, 'push', 'origin', 'main');

    git(root, 'checkout', '-b', 'local');
    writeFileSync(join(root, path), `# Memory\n${entries[0]}\n`);
    git(root, 'add', path);
    git(root, 'commit', '-m', 'local memory');
    const local = git(root, 'rev-parse', 'HEAD');
    git(root, 'checkout', 'main');
    writeFileSync(join(root, path), `# Memory\n${entries[1]}\n`);
    git(root, 'add', path);
    git(root, 'commit', '-m', 'remote memory');
    const remoteSha = git(root, 'rev-parse', 'HEAD');
    git(root, 'push', 'origin', 'main');
    git(root, 'checkout', 'local');

    const sourceControl = {
      acquireReconciliationLease: async () => ({ release: async () => undefined }),
      runReconciliationGit: async () => { throw new Error('injected git runner should be used'); },
    };
    const service = new SourceReconciliationService({
      rootDir: root, sourceControl,
      run: (args, cwd = root) => runGit(args, cwd),
      validateCandidate: async () => ({ check: 'passed' }),
      // No regenerateAgentMemory injection: this is the production command.
    });
    const preflight = await service.preflight(local);
    assert.equal(preflight.state, 'candidate_ready', preflight.error);
    const packetPath = join(root, '.local/reconciliation-audits', preflight.packet!.fingerprint, 'preflight.json');
    const result = await service.candidate(packetPath);
    assert.equal(result.state, 'candidate_ready', result.error);
    assert.equal(result.ok, true);
    const merged = git(root, 'show', `${result.candidateSha}:${path}`);
    assert.ok(merged.includes(entries[0]) && merged.includes(entries[1]), 'DB projection must retain both sides');
    assert.doesNotMatch(merged, /^<{7} |^={7}$|^>{7} /m);
    assert.equal(git(root, 'rev-list', '--parents', '-n', '1', result.candidateSha!).split(' ').slice(1).join(' '), `${local} ${remoteSha}`);
    assert.equal(git(root, 'rev-parse', 'HEAD'), local, 'primary checkout must be untouched');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});