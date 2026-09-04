import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { SourceReconciliationService } from '../services/source-reconciliation-service';
import { renderMailboxMarkdown, serializeMailboxLedger } from '../services/mailbox-ledger';

type Policy = { id: string; path: string; kind: 'ordinary' | 'append-only-manual' | 'generated-local' | 'canonical-incoming-subset'; authority: 'replit' | 'shared'; resolution: 'keep-local-in-candidate' | 'manual'; proof: Record<string, unknown>; checks: string[] };
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitRaw = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const stable = (value: unknown) => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
const digest = (value: unknown) => createHash('sha256').update(stable(value)).digest('hex');
const ordinary = (path: string): Policy => ({ id: 'ordinary-policy', path, kind: 'ordinary', authority: 'replit', resolution: 'keep-local-in-candidate', proof: {}, checks: [] });

function fixture(policy: Policy[] = []) {
  const root = mkdtempSync(join(tmpdir(), 'source-reconciliation-'));
  const bare = mkdtempSync(join(tmpdir(), 'source-reconciliation-remote-'));
  const write = (path: string, body: string) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), body); };
  const commit = (message: string) => { git(root, 'add', '.'); git(root, 'commit', '-m', message); return git(root, 'rev-parse', 'HEAD'); };
  git(root, 'init', '-b', 'main'); git(root, 'config', 'user.name', 'test'); git(root, 'config', 'user.email', 'test@example.invalid');
  writeFileSync(join(root, 'package.json'), '{"type":"module"}\n');
  writeFileSync(join(root, 'tsconfig.json'), '{"compilerOptions":{"target":"ES2022"}}\n');
  mkdirSync(join(root, 'config'), { recursive: true });
  writeFileSync(join(root, 'config/source-reconciliation-policies.json'), JSON.stringify({ schemaVersion: 1, policies: policy }));
  write('tracked.txt', 'base\n'); const base = commit('base');
  git(bare, 'init', '--bare'); git(root, 'remote', 'add', 'origin', bare); git(root, 'push', 'origin', 'main');
  let validations = 0;
  const calls: string[][] = [];
  const lease = { acquireReconciliationLease: async () => ({ release: async () => undefined }), runReconciliationGit: async () => { throw new Error('runner must be injected'); } };
  const service = (
    validator: () => Promise<Record<string, string>> = async () => ({ check: 'passed' }),
    sourceControl: any = lease,
  ) => new SourceReconciliationService({
    rootDir: root, sourceControl,
    run: async (args, cwd = root) => {
      calls.push(args);
      try { return { code: 0, stdout: gitRaw(cwd, ...args), stderr: '' }; }
      catch (error: any) { return { code: 1, stdout: String(error?.stdout || ''), stderr: String(error?.stderr || error?.message || '') }; }
    },
    validateCandidate: async () => { validations += 1; return validator(); },
  });
  const diverge = (path: string, localBody: string, remoteBody: string) => {
    git(root, 'checkout', '-b', 'local'); write(path, localBody); const local = commit('local');
    git(root, 'checkout', 'main'); write(path, remoteBody); const remote = commit('remote'); git(root, 'push', 'origin', 'main'); git(root, 'checkout', 'local');
    return { local, remote };
  };
  const divergeClean = () => {
    git(root, 'checkout', '-b', 'local'); write('local-only.txt', 'local\n'); const local = commit('local');
    git(root, 'checkout', 'main'); write('remote-only.txt', 'remote\n'); const remote = commit('remote'); git(root, 'push', 'origin', 'main'); git(root, 'checkout', 'local');
    return { local, remote };
  };
  const cleanup = () => { rmSync(root, { recursive: true, force: true }); rmSync(bare, { recursive: true, force: true }); };
  return { root, bare, write, commit, base, service, diverge, divergeClean, calls, cleanup, get validations() { return validations; } };
}

async function withFixture(body: (f: ReturnType<typeof fixture>) => Promise<void>, policies: Policy[] = []) {
  const f = fixture(policies);
  try { await body(f); } finally { f.cleanup(); }
}
function candidateAudit(f: ReturnType<typeof fixture>, fingerprint: string) { return join(f.root, '.local/reconciliation-audits', fingerprint, 'preflight.json'); }
function noTemporaryMetadata(f: ReturnType<typeof fixture>) {
  assert.equal(git(f.root, 'for-each-ref', '--format=%(refname)', 'refs/reconcile'), '', 'temporary reconciliation refs must be removed');
}
function refMissing(f: ReturnType<typeof fixture>, ref: string) {
  try { git(f.root, 'show-ref', '--verify', '--quiet', ref); assert.fail(`unexpected ref ${ref}`); }
  catch (error: any) { if (error?.name === 'AssertionError') throw error; }
}
function primaryUnchanged(f: ReturnType<typeof fixture>, local: string, main: string) {
  assert.equal(git(f.root, 'rev-parse', 'HEAD'), local, 'primary HEAD must not move');
  assert.equal(git(f.root, 'rev-parse', 'refs/heads/main'), main, 'main ref must not move');
}

await withFixture(async (f) => {
  assert.equal((await f.service().preflight('HEAD')).state, 'history_incomplete');
  assert.equal((await f.service().preflight('A'.repeat(40))).state, 'history_incomplete');
  assert.equal((await f.service().preflight('a'.repeat(39))).state, 'history_incomplete');
});

await withFixture(async (f) => {
  const { local, remote } = f.divergeClean();
  const preflight = await f.service().preflight(local);
  f.write('dirty.txt', 'dirty\n');
  assert.equal((await f.service().candidate(candidateAudit(f, preflight.packet!.fingerprint))).state, 'dirty_primary_worktree');
  refMissing(f, `refs/heads/${preflight.packet!.candidateBranch}`);
  primaryUnchanged(f, local, remote);
});

await withFixture(async (f) => {
  const { local, remote } = f.divergeClean();
  const preflight = await f.service().preflight(local);
  const contended = {
    acquireReconciliationLease: async () => null,
    runReconciliationGit: async () => { throw new Error('runner must be injected'); },
  };
  assert.equal((await f.service(async () => ({ check: 'passed' }), contended).candidate(candidateAudit(f, preflight.packet!.fingerprint))).state, 'lease_contended');
  primaryUnchanged(f, local, remote);
});

await withFixture(async (f) => {
  const invalid = [
    ordinary('same.txt'),
    { ...ordinary('same.txt'), id: 'second-policy' },
  ];
  writeFileSync(join(f.root, 'config/source-reconciliation-policies.json'), JSON.stringify({ schemaVersion: 1, policies: invalid }));
  assert.equal((await f.service().preflight(f.base)).state, 'policy_overlap');
});

await withFixture(async (f) => {
  const invalid = [{ ...ordinary('file.txt'), kind: 'canonical-incoming-subset', authority: 'shared', proof: { stableMarker: 'chat-capture' } }];
  writeFileSync(join(f.root, 'config/source-reconciliation-policies.json'), JSON.stringify({ schemaVersion: 1, policies: invalid }));
  assert.equal((await f.service().preflight(f.base)).state, 'policy_overlap');
});

await withFixture(async (f) => {
  const { local, remote } = f.divergeClean();
  const preflight = await f.service().preflight(local);
  const canonical = candidateAudit(f, preflight.packet!.fingerprint);
  const copied = join(f.root, 'copied-preflight.json');
  writeFileSync(copied, readFileSync(canonical));
  assert.equal((await f.service().candidate(copied)).state, 'protected_path_proof_failed');
  primaryUnchanged(f, local, remote);
});

await withFixture(async (f) => {
  git(f.root, 'checkout', '-b', 'local'); f.write('ff.txt', 'one\n'); const local = f.commit('local'); git(f.root, 'push', 'origin', 'local');
  const result = await f.service().preflight(local);
  assert.equal(result.state, 'safe_fast_forward'); assert.equal(result.ok, true); noTemporaryMetadata(f);
});

await withFixture(async (f) => {
  const { local, remote } = f.diverge('conflict.txt', 'local\n', 'remote\n');
  const preflight = await f.service().preflight(local); assert.equal(preflight.state, 'candidate_ready');
  const result = await f.service().candidate(candidateAudit(f, preflight.packet!.fingerprint));
  assert.equal(result.state, 'unclassified_conflict'); primaryUnchanged(f, local, remote); noTemporaryMetadata(f);
  assert.ok(f.calls.some((args) => args.some((arg) => arg.startsWith('refs/heads/main:refs/reconcile/preflight-'))), 'preflight must fetch into a temporary ref');
});

// Policy-specific conflicts use independent repositories so the manifest digest is immutable.
await withFixture(async (f) => {
  const { local, remote } = f.diverge('manual.txt', 'local\n', 'remote\n');
  const preflight = await f.service().preflight(local); const result = await f.service().candidate(candidateAudit(f, preflight.packet!.fingerprint));
  assert.equal(result.state, 'candidate_conflicts_manual'); primaryUnchanged(f, local, remote); noTemporaryMetadata(f);
}, [{ id: 'manual-policy', path: 'manual.txt', kind: 'append-only-manual', authority: 'shared', resolution: 'manual', proof: {}, checks: [] }]);

type Mailbox = 'claude-code-to-luca' | 'luca-to-claude-code';
const mailboxPaths: Record<Mailbox, { markdown: string; ledger: string }> = {
  'claude-code-to-luca': { markdown: 'docs/claude-code-to-luca.md', ledger: 'docs/mailbox-ledgers/claude-code-to-luca.json' },
  'luca-to-claude-code': { markdown: 'docs/luca-to-claude-code.md', ledger: 'docs/mailbox-ledgers/luca-to-claude-code.json' },
};
const mailboxPolicy = (mailbox: Mailbox, proof: Record<string, unknown> = {
  builtInLedgerProof: { version: 1, formatterVersion: 1, ledgerPath: mailboxPaths[mailbox].ledger, mailbox },
}): Policy => ({
  id: `generated-${mailbox}`,
  path: mailboxPaths[mailbox].markdown,
  kind: 'generated-local',
  authority: 'replit',
  resolution: 'keep-local-in-candidate',
  proof,
  checks: [],
});
const mailboxLedger = (mailbox: Mailbox, notes: unknown[] = []) => ({
  schemaVersion: 1,
  mailbox,
  notes,
});
const mailboxNote = (mailbox: Mailbox, id = 'note-a') => ({
  id,
  fromAgent: mailbox === 'claude-code-to-luca' ? 'luca-claude-code' : 'agent',
  toAgent: mailbox === 'claude-code-to-luca' ? 'agent' : 'luca-claude-code',
  subject: 'Proof',
  body: 'Exact body',
  sessionLabel: null,
  createdAt: '2026-09-04T18:00:00.000Z',
});

async function generatedCase(
  mailbox: Mailbox,
  localLedger: string | null,
  localMarkdown: string,
  expected: string,
  policy = mailboxPolicy(mailbox),
) {
  await withFixture(async (f) => {
    const paths = mailboxPaths[mailbox];
    const base = mailboxLedger(mailbox);
    f.write(paths.ledger, serializeMailboxLedger(base));
    f.write(paths.markdown, renderMailboxMarkdown(base));
    f.commit('mailbox base'); git(f.root, 'push', 'origin', 'main');
    git(f.root, 'checkout', '-b', 'local');
    if (localLedger === null) rmSync(join(f.root, paths.ledger));
    else f.write(paths.ledger, localLedger);
    f.write(paths.markdown, localMarkdown);
    git(f.root, 'add', '-A'); git(f.root, 'commit', '-m', 'local mailbox'); const local = git(f.root, 'rev-parse', 'HEAD');
    git(f.root, 'checkout', 'main');
    f.write(paths.markdown, '# remote mailbox change\n');
    const remote = f.commit('remote mailbox'); git(f.root, 'push', 'origin', 'main'); git(f.root, 'checkout', 'local');
    const preflight = await f.service().preflight(local);
    assert.equal(preflight.state, 'candidate_ready', preflight.error);
    const result = await f.service().candidate(candidateAudit(f, preflight.packet!.fingerprint));
    assert.equal(result.state, expected, result.error);
    primaryUnchanged(f, local, remote); noTemporaryMetadata(f);
    assert.equal(f.calls.some((args) => args[0] === 'test' || args[0] === 'sh'), false, 'proof must not execute a command');
  }, [policy]);
}

for (const mailbox of ['claude-code-to-luca', 'luca-to-claude-code'] as const) {
  const ledger = mailboxLedger(mailbox, [mailboxNote(mailbox)]);
  await generatedCase(mailbox, serializeMailboxLedger(ledger), renderMailboxMarkdown(ledger), 'candidate_ready');
}
{
  const mailbox: Mailbox = 'claude-code-to-luca';
  const valid = mailboxLedger(mailbox, [mailboxNote(mailbox)]);
  await generatedCase(mailbox, null, renderMailboxMarkdown(valid), 'generated_regeneration_failed');
  await generatedCase(mailbox, '{not json}\n', renderMailboxMarkdown(valid), 'generated_regeneration_failed');
  await generatedCase(mailbox, serializeMailboxLedger(valid), '# stale markdown\n', 'generated_regeneration_failed');
  const reordered = mailboxLedger(mailbox, [mailboxNote(mailbox, 'a'), { ...mailboxNote(mailbox, 'b'), createdAt: '2026-09-05T18:00:00.000Z' }]);
  await generatedCase(mailbox, JSON.stringify(reordered), renderMailboxMarkdown(valid), 'generated_regeneration_failed');
  const duplicate = mailboxLedger(mailbox, [mailboxNote(mailbox), mailboxNote(mailbox)]);
  await generatedCase(mailbox, JSON.stringify(duplicate), renderMailboxMarkdown(valid), 'generated_regeneration_failed');
}
await withFixture(async (f) => {
  const invalid = mailboxPolicy('claude-code-to-luca', {
    builtInLedgerProof: { version: 1, formatterVersion: 1, ledgerPath: 'docs/mailbox-ledgers/luca-to-claude-code.json', mailbox: 'claude-code-to-luca' },
  });
  f.write('config/source-reconciliation-policies.json', JSON.stringify({ schemaVersion: 1, policies: [invalid] }));
  assert.equal((await f.service().preflight(f.base)).state, 'policy_overlap', 'wrong proof path must be rejected');
  const arbitrary = { ...invalid, proof: { deterministicVerifier: 'test -f docs/claude-code-to-luca.md' } };
  f.write('config/source-reconciliation-policies.json', JSON.stringify({ schemaVersion: 1, policies: [arbitrary] }));
  assert.equal((await f.service().preflight(f.base)).state, 'policy_overlap', 'arbitrary proof must be rejected');
});

const record = (id: string) => `<!-- chat-capture-range:0:1 -->\n<!-- chat-capture:${id} -->\nbody\n<!-- chat-capture:${id} -->\n`;
const canonicalPolicy: Policy = { id: 'canonical-policy', path: 'capture.md', kind: 'canonical-incoming-subset', authority: 'replit', resolution: 'keep-local-in-candidate', proof: { stableMarker: 'chat-capture' }, checks: [] };
async function canonicalCase(localRecords: string, remoteRecords: string, expected: string) {
  await withFixture(async (f) => {
    f.write('capture.md', `base\n${record('a')}`); f.commit('capture base'); git(f.root, 'push', 'origin', 'main');
    const { local, remote } = f.diverge('capture.md', `local\n${localRecords}`, `remote\n${remoteRecords}`);
    const preflight = await f.service().preflight(local); const result = await f.service().candidate(candidateAudit(f, preflight.packet!.fingerprint));
    assert.equal(result.state, expected, result.error); primaryUnchanged(f, local, remote); noTemporaryMetadata(f);
    assert.ok(!existsSync(join(f.root, '.local', `reconcile-worktree-${preflight.packet!.fingerprint}`)), 'isolated worktree directory must be removed');
    if (expected === 'candidate_ready') assert.ok(f.calls.some((args) => args.some((arg) => arg.startsWith('refs/heads/main:refs/reconcile/verify-'))), 'verification must fetch into a temporary ref');
  }, [canonicalPolicy]);
}
// Canonical incoming subset: accepted, missing ID, same-ID conflict, reordered records,
// local shrinkage, and duplicate IDs are each independent real-Git histories.
await canonicalCase(record('a'), record('a'), 'candidate_ready');
await canonicalCase(record('a'), record('missing'), 'protected_path_proof_failed');
await canonicalCase(record('a'), `<!-- chat-capture-range:0:1 -->\n<!-- chat-capture:a -->\nchanged\n<!-- chat-capture:a -->\n`, 'protected_path_proof_failed');
await canonicalCase(`${record('a')}<!-- chat-capture-range:1:2 -->\n<!-- chat-capture:b -->\nbody\n<!-- chat-capture:b -->\n`, `<!-- chat-capture-range:0:1 -->\n<!-- chat-capture:b -->\nbody\n<!-- chat-capture:b -->\n<!-- chat-capture-range:1:2 -->\n<!-- chat-capture:a -->\nbody\n<!-- chat-capture:a -->\n`, 'protected_path_proof_failed');
await canonicalCase('', record('a'), 'protected_path_proof_failed');
await canonicalCase(record('a'), `${record('a')}${record('a').replaceAll('0:1', '1:2')}`, 'protected_path_proof_failed');

await withFixture(async (f) => {
  const { local } = f.divergeClean();
  const preflight = await f.service().preflight(local);
  git(f.root, 'checkout', 'main'); f.write('after.txt', 'advanced\n'); f.commit('advance'); git(f.root, 'push', 'origin', 'main'); git(f.root, 'checkout', 'local');
  const main = git(f.root, 'rev-parse', 'refs/heads/main');
  const result = await f.service().candidate(candidateAudit(f, preflight.packet!.fingerprint));
  assert.equal(result.state, 'candidate_stale_remote'); primaryUnchanged(f, local, main); noTemporaryMetadata(f);
});

await withFixture(async (f) => {
  const { local, remote } = f.divergeClean();
  const preflight = await f.service(async () => { throw new Error('validator rejected candidate'); }).preflight(local);
  const result = await f.service(async () => { throw new Error('validator rejected candidate'); }).candidate(candidateAudit(f, preflight.packet!.fingerprint));
  const outcomePath = join(f.root, '.local/reconciliation-audits', preflight.packet!.fingerprint, 'candidate-outcome.json');
  assert.equal(result.state, 'protected_path_proof_failed'); assert.ok(existsSync(outcomePath));
  const outcome = JSON.parse(readFileSync(outcomePath, 'utf8')); assert.equal(outcome.digest, digest(outcome.body), 'validator failure outcome must retain a valid digest envelope');
  refMissing(f, `refs/heads/${preflight.packet!.candidateBranch}`); primaryUnchanged(f, local, remote); noTemporaryMetadata(f);
});

await withFixture(async (f) => {
  const { local, remote } = f.divergeClean();
  const service = f.service(); const preflight = await service.preflight(local); const audit = candidateAudit(f, preflight.packet!.fingerprint);
  const ready = await service.candidate(audit); assert.equal(ready.state, 'candidate_ready');
  git(f.root, 'update-ref', `refs/heads/${preflight.packet!.candidateBranch}`, local);
  assert.equal((await service.candidate(audit)).state, 'protected_path_proof_failed');
  refMissing(f, `refs/heads/${preflight.packet!.candidateBranch}`);
  primaryUnchanged(f, local, remote); noTemporaryMetadata(f);
});

await withFixture(async (f) => {
  const { local, remote } = f.diverge('missing.txt', 'local\n', 'remote\n');
  const service = f.service();
  const preflight = await service.preflight(local);
  const localBlob = git(f.root, 'rev-parse', `${local}:missing.txt`);
  rmSync(join(f.root, '.git', 'objects', localBlob.slice(0, 2), localBlob.slice(2)), { force: true });
  const result = await service.candidate(candidateAudit(f, preflight.packet!.fingerprint));
  assert.equal(result.state, 'missing_git_object');
  primaryUnchanged(f, local, remote);
});

const source = readFileSync(join(process.cwd(), 'server/services/source-reconciliation-service.ts'), 'utf8');
assert.doesNotMatch(source, /neon-db|drizzle|database_url/i);
assert.doesNotMatch(source, /\['(?:push|reset|rebase)'|--force/);
assert.doesNotMatch(source, /execFile\('npm'|env:\s*\{\s*\.\.\.process\.env/);
console.log('Source reconciliation hermetic real-Git matrix passed.');