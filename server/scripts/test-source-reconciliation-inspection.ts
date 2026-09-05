import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  assertInspectionGitArgs,
  INSPECTION_ALLOWED_COMMANDS,
  redactInspectionPatch,
  SourceReconciliationService,
} from '../services/source-reconciliation-service';

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const root = mkdtempSync(join(tmpdir(), 'reconciliation-inspection-'));
const bare = mkdtempSync(join(tmpdir(), 'reconciliation-inspection-remote-'));
try {
  const write = (path: string, body: string | Buffer) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  };
  const commit = (message: string) => {
    git(root, 'add', '.');
    git(root, 'commit', '-m', message);
    return git(root, 'rev-parse', 'HEAD').trim();
  };
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.name', 'test');
  git(root, 'config', 'user.email', 'test@example.invalid');
  mkdirSync(join(root, 'config'), { recursive: true });
  writeFileSync(join(root, 'config/source-reconciliation-policies.json'), '{"schemaVersion":1,"policies":[]}');
  write('base.txt', 'base\n');
  commit('base');
  git(bare, 'init', '--bare');
  git(root, 'remote', 'add', 'origin', bare);
  git(root, 'push', 'origin', 'main');

  git(root, 'checkout', '-b', 'local');
  write('a-secret.txt', 'password=\"this-is-a-real-looking-secret\"\n');
  write('large.txt', `${'x'.repeat(300 * 1024)}\n`);
  write('binary.bin', Buffer.from([0, 1, 2, 3, 255]));
  write('pointer.dat', 'version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 3\n');
  const local = commit('local secret redaction');
  git(root, 'checkout', 'main');
  write('remote.txt', 'remote\n');
  const remote = commit('remote change');
  git(root, 'push', 'origin', 'main');
  git(root, 'checkout', 'local');

  const calls: string[][] = [];
  let leaseCalls = 0;
  let validations = 0;
  const service = new SourceReconciliationService({
    rootDir: root,
    sourceControl: {
      acquireReconciliationLease: async () => {
        leaseCalls += 1;
        return { release: async () => undefined };
      },
      runReconciliationGit: async () => { throw new Error('protected runner must be injected in test'); },
    },
    run: async (args, cwd = root) => {
      calls.push(args);
      try { return { code: 0, stdout: git(cwd, ...args), stderr: '' }; }
      catch (error: any) { return { code: 1, stdout: String(error?.stdout || ''), stderr: String(error?.stderr || error?.message || '') }; }
    },
    validateCandidate: async () => {
      validations += 1;
      return { check: 'passed' };
    },
  });
  const preflight = await service.preflight(local);
  assert.equal(preflight.state, 'candidate_ready');
  const packetPath = join(root, '.local/reconciliation-audits', preflight.packet!.fingerprint, 'preflight.json');
  const headBefore = git(root, 'rev-parse', 'HEAD').trim();
  const refsBefore = git(root, 'for-each-ref', '--format=%(refname)%00%(objectname)').trim();
  calls.length = 0;

  const result = await service.inspect(packetPath);
  assert.equal(result.state, 'inspection_ready');
  assert.equal(result.ok, true);
  assert.equal(result.inspection?.commits.length, 2);
  assert.equal(leaseCalls, 0, 'inspection must not acquire the mutation lease');
  assert.equal(validations, 0, 'inspection must not validate a candidate');
  assert.equal(git(root, 'rev-parse', 'HEAD').trim(), headBefore);
  assert.equal(git(root, 'for-each-ref', '--format=%(refname)%00%(objectname)').trim(), refsBefore);
  assert.ok(calls.every((args) => INSPECTION_ALLOWED_COMMANDS.has(args[0])));
  assert.ok(calls.every((args) => !['fetch', 'update-ref', 'switch', 'worktree', 'merge', 'commit', 'push'].includes(args[0])));
  const localInspection = result.inspection?.commits.find((item) => item.sha === local);
  assert.equal(localInspection?.patch.redactedLineCount, 1);
  assert.doesNotMatch(localInspection?.patch.text || '', /this-is-a-real-looking-secret/);
  assert.match(localInspection?.patch.text || '', /redacted: suspected credential/);
  assert.equal(localInspection?.patch.truncated, true);
  assert.equal(localInspection?.patch.binary, true);
  assert.equal(localInspection?.patch.lfs, true);
  assert.ok(Buffer.byteLength(JSON.stringify(result), 'utf8') <= 1024 * 1024);
  assert.equal(result.inspection?.commits.find((item) => item.sha === remote)?.side, 'remote');

  const copied = join(root, 'copied.json');
  writeFileSync(copied, readFileSync(packetPath));
  assert.equal((await service.inspect(copied)).state, 'protected_path_proof_failed');
  writeFileSync(join(root, 'config/source-reconciliation-policies.json'), '{"schemaVersion":1,"policies":[{"id":"drift"}]}');
  assert.equal((await service.inspect(packetPath)).state, 'protected_path_proof_failed');

  const allowed = new Set([local]);
  assert.doesNotThrow(() => assertInspectionGitArgs(['show', local], allowed));
  assert.throws(() => assertInspectionGitArgs(['update-ref', local], allowed), /not allowed/);
  assert.throws(() => assertInspectionGitArgs(['show', remote], allowed), /outside the packet/);
  assert.equal(redactInspectionPatch('+const token = \"placeholder\";').redactedLineCount, 0);
} finally {
  rmSync(root, { recursive: true, force: true });
  rmSync(bare, { recursive: true, force: true });
}

console.log('source reconciliation inspection: PASS');