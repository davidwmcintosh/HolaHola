/**
 * Git-only, fail-closed divergent-history evidence and candidate builder.
 * This module deliberately has no application-service imports: its static
 * boundary is part of the safety contract.
 */
import { execFile as nodeExecFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { SourceControlService } from './source-control-service';
import {
  assertMailboxPaths,
  MAILBOX_FORMATTER_VERSION,
  type MailboxIdentity,
  parseMailboxLedgerJson,
  renderMailboxMarkdown,
} from './mailbox-ledger';

const execFile = promisify(nodeExecFile);
const SHA = /^[0-9a-f]{40}$/;
const LARGE_BLOB = 10 * 1024 * 1024;
export type ReconciliationState = 'safe_fast_forward' | 'candidate_ready' | 'candidate_conflicts_manual' | 'candidate_stale_remote' | 'protected_path_proof_failed' | 'generated_regeneration_failed' | 'policy_overlap' | 'unclassified_conflict' | 'missing_git_object' | 'history_incomplete' | 'dirty_primary_worktree' | 'lease_contended' | 'transport_failure';
type BuiltInLedgerProof = { version: 1; formatterVersion: 1; ledgerPath: string; mailbox: MailboxIdentity };
type Policy = { id: string; path: string; kind: 'generated-local' | 'canonical-incoming-subset' | 'append-only-manual' | 'ordinary'; authority: string; resolution: string; proof: { builtInLedgerProof?: BuiltInLedgerProof; stableMarker?: string }; checks: string[] };
type Manifest = { schemaVersion: 1; policies: Policy[] };
export interface ReconciliationPacket {
  schemaVersion: 1; manifestVersion: 1; manifestDigest: string; fingerprint: string;
  localSha: string; remoteSha: string; mergeBase: string; remote: string; remoteBranch: string;
  localUniqueCommits: string[]; remoteUniqueCommits: string[]; localPaths: string[]; remotePaths: string[];
  intersections: Array<{ path: string; policy?: string; local?: BlobFact; remote?: BlobFact }>;
  findings: Array<{ state: ReconciliationState; path?: string; policy?: string; detail: string }>;
  recoveryRef: string; candidateBranch: string; reproduction: string;
}
type BlobFact = { sha: string; size: number; missing: boolean; lfs: boolean; large: boolean };
export interface ReconciliationResult { ok: boolean; state: ReconciliationState; packet?: ReconciliationPacket; candidateSha?: string; error?: string }
export interface ReconciliationOptions { rootDir?: string; run?: (args: string[], cwd?: string) => Promise<{ code: number; stdout: string; stderr: string }>; sourceControl?: Pick<SourceControlService, 'acquireReconciliationLease' | 'runReconciliationGit'>; validateCandidate?: (cwd: string) => Promise<Record<string, string>> }

const stable = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const lines = (text: string) => text.trim() ? text.trim().split('\n').filter(Boolean) : [];

export class SourceReconciliationService {
  private readonly root: string;
  private readonly run: NonNullable<ReconciliationOptions['run']>;
  private readonly sourceControl: Pick<SourceControlService, 'acquireReconciliationLease' | 'runReconciliationGit'>;
  private readonly validateCandidate: (cwd: string) => Promise<Record<string, string>>;
  constructor(options: ReconciliationOptions = {}) {
    this.root = options.rootDir || process.cwd();
    this.sourceControl = options.sourceControl || new SourceControlService({ rootDir: this.root });
    this.run = options.run || ((args, cwd = this.root) => this.sourceControl.runReconciliationGit(args, cwd));
    this.validateCandidate = options.validateCandidate || (async (cwd) => {
      const validationHome = join(this.root, '.local', 'reconciliation-validation-home');
      await mkdir(validationHome, { recursive: true, mode: 0o700 });
      const env: NodeJS.ProcessEnv = {
        PATH: process.env.PATH,
        HOME: validationHome,
        CI: '1',
        NODE_ENV: 'test',
        GIT_TERMINAL_PROMPT: '0',
      };
      const checks: Record<string, string> = {};
      const commands: Array<{ name: string; executable: string; args: string[]; cwd: string }> = [
        {
          name: 'typecheck',
          executable: resolve(this.root, 'node_modules/.bin/tsc'),
          args: ['--noEmit', '--project', join(cwd, 'tsconfig.json')],
          cwd,
        },
        {
          name: 'source-reconciliation',
          executable: resolve(this.root, 'node_modules/.bin/tsx'),
          args: [resolve(this.root, 'server/scripts/test-source-reconciliation-service.ts')],
          cwd: this.root,
        },
      ];
      for (const command of commands) {
        try {
          await execFile(command.executable, command.args, {
            cwd: command.cwd,
            env,
            maxBuffer: 8 * 1024 * 1024,
          });
          checks[command.name] = 'passed';
        } catch (error: any) {
          checks[command.name] = `failed:${String(error?.stderr || error?.message || '').slice(0, 512)}`;
          throw new Error(`Candidate check ${command.name} failed.`);
        }
      }
      return checks;
    });
  }

  async preflight(localSha: string, remote = 'origin', remoteBranch = 'main'): Promise<ReconciliationResult> {
    if (!SHA.test(localSha)) return this.failure('history_incomplete', 'Preflight requires an exact lowercase 40-character local SHA.');
    const manifest = await this.manifest();
    const manifestDigest = hash(stable(manifest));
    const badPolicies = this.validateManifest(manifest);
    if (badPolicies) return this.failure('policy_overlap', badPolicies);
    const temporaryRef = `refs/reconcile/preflight-${hash(`${localSha}:${remote}:${remoteBranch}`).slice(0, 20)}`;
    try {
      const fetched = await this.git(['fetch', '--no-tags', remote, `refs/heads/${remoteBranch}:${temporaryRef}`]);
      if (fetched.code) return this.failure('transport_failure', fetched.stderr || 'Remote fetch failed.');
      const remoteSha = await this.commit(temporaryRef);
      await this.commit(localSha);
      const base = await this.git(['merge-base', localSha, remoteSha]);
      if (base.code || !SHA.test(base.stdout.trim())) return this.failure('history_incomplete', 'No complete common ancestry is available.');
      const mergeBase = base.stdout.trim();
      const [localUniqueCommits, remoteUniqueCommits, localPaths, remotePaths] = await Promise.all([
        this.revList(`${remoteSha}..${localSha}`), this.revList(`${localSha}..${remoteSha}`),
        this.diffPaths(mergeBase, localSha), this.diffPaths(mergeBase, remoteSha),
      ]);
      const localAncestor = (await this.git(['merge-base', '--is-ancestor', localSha, remoteSha])).code === 0;
      const remoteAncestor = (await this.git(['merge-base', '--is-ancestor', remoteSha, localSha])).code === 0;
      const intersection = localPaths.filter((path) => remotePaths.includes(path)).sort();
      const findings: ReconciliationPacket['findings'] = [];
      const intersections: ReconciliationPacket['intersections'] = [];
      for (const path of intersection) {
        const policies = manifest.policies.filter((policy) => policy.path === path);
        if (policies.length > 1) findings.push({ state: 'policy_overlap', path, detail: 'More than one exact-path policy matched.' });
        const policy = policies[0];
        const [local, remoteFact] = await Promise.all([this.blob(localSha, path), this.blob(remoteSha, path)]);
        if (!local || !remoteFact || local.missing || remoteFact.missing) findings.push({ state: 'missing_git_object', path, policy: policy?.id, detail: 'Changed path is deleted or its blob is unavailable.' });
        intersections.push({ path, policy: policy?.id || 'ordinary', local, remote: remoteFact });
      }
      const seed = { schemaVersion: 1 as const, manifestVersion: manifest.schemaVersion, manifestDigest, localSha, remoteSha, mergeBase, remote, remoteBranch, localUniqueCommits, remoteUniqueCommits, localPaths, remotePaths, intersections, findings };
      const fingerprint = hash(stable(seed));
      const packet: ReconciliationPacket = { ...seed, fingerprint, recoveryRef: `reconcile/recovery-${fingerprint}`, candidateBranch: `reconcile/candidate-${fingerprint}`, reproduction: `npm run source-control:reconcile -- preflight --local-ref ${localSha} --remote ${remote} --remote-branch ${remoteBranch}` };
      await this.audit(packet.fingerprint, 'preflight.json', packet);
      const state: ReconciliationState = findings[0]?.state || (localAncestor || remoteAncestor ? 'safe_fast_forward' : 'candidate_ready');
      return { ok: findings.length === 0, state, packet, error: findings[0]?.detail };
    } finally { await this.git(['update-ref', '-d', temporaryRef]); }
  }

  async candidate(packetPath: string): Promise<ReconciliationResult> {
    let worktree = '';
    let candidateCommitted = false;
    let intentWritten = false;
    const packet = await this.readPacket(packetPath);
    if (!packet) return this.failure('protected_path_proof_failed', 'Packet digest envelope is invalid.');
    const lease = await this.sourceControl.acquireReconciliationLease();
    if (!lease) return this.failure('lease_contended', 'Another source-control operation holds the mutation lease.');
    const finish = async (
      state: ReconciliationState,
      error?: string,
      extra: Record<string, unknown> = {},
    ): Promise<ReconciliationResult> => {
      if (intentWritten) {
        await this.audit(packet.fingerprint, 'candidate-outcome.json', {
          schemaVersion: 1,
          packetFingerprint: packet.fingerprint,
          state,
          error,
          ...extra,
        });
      }
      return {
        ok: state === 'candidate_ready',
        state,
        candidateSha: typeof extra.candidateSha === 'string' ? extra.candidateSha : undefined,
        error,
      };
    };
    try {
      if (!(await this.clean()) || await this.head() !== packet.localSha) return this.failure('dirty_primary_worktree', 'Primary worktree is dirty or no longer at the packet local SHA.');
      const manifest = await this.manifest();
      if (hash(stable(manifest)) !== packet.manifestDigest) return this.failure('protected_path_proof_failed', 'Policy manifest changed since preflight.');
      if (packet.findings.length) return this.failure(packet.findings[0].state, packet.findings[0].detail);
      if (!packet.localUniqueCommits.length || !packet.remoteUniqueCommits.length) {
        return this.failure('safe_fast_forward', 'Candidate construction is unnecessary because the histories are not divergent.');
      }
      const revalidated = await this.revalidatePacket(packet, manifest);
      if (revalidated) return this.failure(revalidated.state, revalidated.detail);
      const intent = { schemaVersion: 1, packetFingerprint: packet.fingerprint, branch: packet.candidateBranch, localSha: packet.localSha, remoteSha: packet.remoteSha };
      await this.audit(packet.fingerprint, 'candidate-intent.json', intent);
      intentWritten = true;

      const existing = await this.git(['rev-parse', '--verify', `refs/heads/${packet.candidateBranch}^{commit}`]);
      if (existing.code === 0) {
        const candidateSha = existing.stdout.trim();
        const outcome = await this.readAudit(packet.fingerprint, 'candidate-outcome.json');
        const parents = await this.parents(candidateSha);
        if (
          !outcome
          || outcome.packetFingerprint !== packet.fingerprint
          || outcome.candidateSha !== candidateSha
          || !Array.isArray(outcome.parents)
          || stable(outcome.parents) !== stable(parents)
          || parents[0] !== packet.localSha
          || parents[1] !== packet.remoteSha
        ) {
          return this.failure('protected_path_proof_failed', 'Existing candidate branch does not match its immutable packet and outcome.');
        }
        return this.verifyRemote(packet, candidateSha, outcome.checks as Record<string, string>, parents);
      }

      worktree = join(this.root, '.local', `reconcile-worktree-${packet.fingerprint}`);
      await rm(worktree, { recursive: true }).catch(() => undefined);
      if ((await this.git(['worktree', 'add', '--detach', worktree, packet.localSha])).code) return finish('missing_git_object', 'Cannot create isolated worktree.');
      if ((await this.git(['switch', '-c', packet.candidateBranch], worktree)).code) return finish('protected_path_proof_failed', 'Cannot create candidate branch.');
      const merged = await this.git(['merge', '--no-commit', '--no-ff', packet.remoteSha], worktree);
      if (merged.code) {
        const conflicts = lines((await this.git(['diff', '--name-only', '--diff-filter=U'], worktree)).stdout);
        if (!conflicts.length) return finish('protected_path_proof_failed', merged.stderr || 'Merge failed without classifiable conflicts.');
        for (const path of conflicts) {
          const policy = manifest.policies.find((item) => item.path === path);
          if (!policy) return finish('unclassified_conflict', `No protected-path policy permits resolution of ${path}.`);
          if (policy.kind === 'append-only-manual') return finish('candidate_conflicts_manual', `Manual resolution required for ${path}.`);
          if (policy.kind === 'generated-local' && !(await this.resolveGenerated(worktree, packet, path, policy))) return finish('generated_regeneration_failed', `Generated proof failed for ${path}.`);
          if (policy.kind === 'canonical-incoming-subset' && !(await this.resolveCanonical(worktree, packet, path))) return finish('protected_path_proof_failed', `Canonical subset proof failed for ${path}.`);
          if (policy.kind === 'ordinary') return finish('unclassified_conflict', `Ordinary conflict requires manual resolution: ${path}.`);
        }
      }
      if (lines((await this.git(['ls-files', '-u'], worktree)).stdout).length) return finish('candidate_conflicts_manual', 'Candidate index has unmerged entries.');
      const timestamp = new Date((parseInt(packet.fingerprint.slice(0, 8), 16) % 2_000_000_000) * 1000).toISOString();
      const committed = await this.git(['-c', 'user.name=source-reconciliation', '-c', 'user.email=source-reconciliation@local.invalid', '-c', 'commit.committerDateIsAuthorDate=true', 'commit', '--no-gpg-sign', '--date', timestamp, '-m', `reconcile candidate ${packet.fingerprint}`], worktree);
      if (committed.code) return finish('protected_path_proof_failed', committed.stderr || 'Candidate commit failed.');
      const candidateSha = await this.head(worktree);
      candidateCommitted = true;
      const actualParents = await this.parents(candidateSha, worktree);
      if (actualParents.length !== 2 || actualParents[0] !== packet.localSha || actualParents[1] !== packet.remoteSha) {
        candidateCommitted = false;
        return finish('protected_path_proof_failed', 'Candidate merge parents differ from the immutable packet.', { candidateSha, parents: actualParents });
      }
      let checks: Record<string, string>;
      try { checks = await this.validateCandidate(worktree); }
      catch (error: any) {
        candidateCommitted = false;
        return finish('protected_path_proof_failed', String(error?.message || error), {
          candidateSha,
          parents: actualParents,
          checks: { error: String(error?.message || error) },
        });
      }
      await this.audit(packet.fingerprint, 'candidate-outcome.json', {
        schemaVersion: 1,
        packetFingerprint: packet.fingerprint,
        state: 'candidate_created',
        candidateSha,
        checks,
        parents: actualParents,
      });
      return this.verifyRemote(packet, candidateSha, checks, actualParents);
    } finally {
      if (worktree) {
        await this.git(['worktree', 'remove', worktree]);
        await rm(worktree, { recursive: true }).catch(() => undefined);
        await this.git(['worktree', 'prune']);
      }
      if (!candidateCommitted) await this.git(['update-ref', '-d', `refs/heads/${packet.candidateBranch}`]);
      await lease.release();
    }
  }

  private async verifyRemote(
    packet: ReconciliationPacket,
    candidateSha: string,
    checks: Record<string, string>,
    parents: string[],
  ): Promise<ReconciliationResult> {
    const verificationRef = `refs/reconcile/verify-${packet.fingerprint}`;
    try {
      const second = await this.git(['fetch', '--no-tags', packet.remote, `refs/heads/${packet.remoteBranch}:${verificationRef}`]);
      if (second.code) return this.failure('transport_failure', second.stderr || 'Second remote fetch failed.');
      const currentRemote = await this.commit(verificationRef);
      if (currentRemote !== packet.remoteSha) {
        await this.audit(packet.fingerprint, 'stale-remote.json', {
          schemaVersion: 1,
          packetFingerprint: packet.fingerprint,
          oldSha: packet.remoteSha,
          newSha: currentRemote,
          candidateSha,
          checks,
          parents,
        });
        return { ok: false, state: 'candidate_stale_remote', candidateSha, error: `Remote advanced to ${currentRemote}; run a new preflight.` };
      }
      return { ok: true, state: 'candidate_ready', candidateSha };
    } finally {
      await this.git(['update-ref', '-d', verificationRef]);
    }
  }

  private async resolveGenerated(cwd: string, packet: ReconciliationPacket, path: string, policy: Policy): Promise<boolean> {
    const proof = policy.proof.builtInLedgerProof;
    if (!proof) return false;
    try { assertMailboxPaths(proof.mailbox, proof.ledgerPath, path); } catch { return false; }
    const [ledgerBlob, localMarkdown] = await Promise.all([
      this.git(['show', `${packet.localSha}:${proof.ledgerPath}`], cwd),
      this.git(['show', `${packet.localSha}:${path}`], cwd),
    ]);
    if (ledgerBlob.code || localMarkdown.code) return false;
    let expected: string;
    try {
      const ledger = parseMailboxLedgerJson(ledgerBlob.stdout);
      if (ledger.mailbox !== proof.mailbox) return false;
      expected = renderMailboxMarkdown(ledger);
    } catch {
      return false;
    }
    if (expected !== localMarkdown.stdout) return false;
    await writeFile(join(cwd, path), expected);
    if ((await this.git(['add', '--', path], cwd)).code) return false;
    const staged = await this.git(['show', `:${path}`], cwd);
    return staged.code === 0 && staged.stdout === expected && staged.stdout === localMarkdown.stdout;
  }
  private async resolveCanonical(cwd: string, packet: ReconciliationPacket, path: string): Promise<boolean> {
    const [local, incoming, base] = await Promise.all([this.git(['show', `${packet.localSha}:${path}`]), this.git(['show', `${packet.remoteSha}:${path}`]), this.git(['show', `${packet.mergeBase}:${path}`])]);
    if (local.code || incoming.code || base.code) return false;
    const records = (text: string): Array<{ id: string; start: number; end: number; bytes: string }> | null => {
      const ranges = [...text.matchAll(/<!-- chat-capture-range:(\d+):(\d+) -->/g)];
      if (!ranges.length) return null;
      let previousEnd = -1;
      const output: Array<{ id: string; start: number; end: number; bytes: string }> = [];
      for (let index = 0; index < ranges.length; index += 1) {
        const marker = ranges[index], start = Number(marker[1]), end = Number(marker[2]);
        if (end <= start || (previousEnd !== -1 && start !== previousEnd)) return null;
        previousEnd = end;
        const finish = index + 1 < ranges.length ? ranges[index + 1].index! : text.length;
        const bytes = text.slice(marker.index!, finish);
        const ids = [...bytes.matchAll(/<!-- chat-capture:([^ >]+) -->/g)].map((match) => match[1]);
        if (ids.length !== 2 || new Set(ids).size !== 1) return null;
        output.push({ id: ids[0], start, end, bytes });
      }
      return output;
    };
    const l = records(local.stdout), r = records(incoming.stdout), b = records(base.stdout);
    if (!l || !r || !b || !l.length || new Set(l.map((x) => x.id)).size !== l.length || new Set(r.map((x) => x.id)).size !== r.length) return false;
    if (l.length < b.length || !b.every((item, index) => l[index]?.id === item.id && l[index]?.bytes === item.bytes)) return false;
    let cursor = -1;
    for (const item of r) { const index = l.findIndex((candidate) => candidate.id === item.id); if (index < 0 || index <= cursor || l[index].bytes !== item.bytes) return false; cursor = index; }
    await writeFile(join(cwd, path), local.stdout); if ((await this.git(['add', '--', path], cwd)).code) return false;
    const staged = await this.git(['show', `:${path}`], cwd); return staged.code === 0 && staged.stdout === local.stdout;
  }
  private async manifest(): Promise<Manifest> { return JSON.parse(await readFile(resolve(this.root, 'config/source-reconciliation-policies.json'), 'utf8')) as Manifest; }
  private validateManifest(manifest: Manifest): string | undefined {
    if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.policies) || Object.keys(manifest).some((key) => key !== 'schemaVersion' && key !== 'policies')) return 'Unsupported reconciliation policy manifest.';
    const kinds = new Set(['generated-local', 'canonical-incoming-subset', 'append-only-manual', 'ordinary']);
    const seen = new Set<string>();
    for (const policy of manifest.policies) {
      const validKeys = ['id', 'path', 'kind', 'authority', 'resolution', 'proof', 'checks'];
      if (Object.keys(policy).some((key) => !validKeys.includes(key)) || !/^[a-z0-9-]+$/.test(policy.id || '') || !policy.path || policy.path !== policy.path.normalize('NFC') || policy.path.includes('*') || policy.path.startsWith('/') || policy.path.includes('..') || seen.has(policy.id) || !kinds.has(policy.kind) || !['replit', 'shared'].includes(policy.authority) || !['keep-local-in-candidate', 'manual'].includes(policy.resolution) || !policy.proof || Object.keys(policy.proof).some((key) => key !== 'builtInLedgerProof' && key !== 'stableMarker') || !Array.isArray(policy.checks) || policy.checks.some((check) => !['typecheck', 'source-reconciliation'].includes(check))) return 'Policies contain an invalid field, combination, path, or check.';
      const exactCombination =
        (policy.kind === 'append-only-manual'
          && policy.authority === 'shared'
          && policy.resolution === 'manual'
          && Object.keys(policy.proof).length === 0)
        || (policy.kind === 'canonical-incoming-subset'
          && policy.authority === 'replit'
          && policy.resolution === 'keep-local-in-candidate'
          && policy.proof.stableMarker === 'chat-capture'
          && Object.keys(policy.proof).length === 1)
        || (policy.kind === 'generated-local'
          && policy.authority === 'replit'
          && policy.resolution === 'keep-local-in-candidate'
          && Object.keys(policy.proof).length === 1
          && (() => {
            const proof = policy.proof.builtInLedgerProof;
            if (!proof || typeof proof !== 'object' || Object.keys(proof).length !== 4
              || Object.keys(proof).some((key) => !['version', 'formatterVersion', 'ledgerPath', 'mailbox'].includes(key))
              || proof.version !== 1 || proof.formatterVersion !== MAILBOX_FORMATTER_VERSION
              || typeof proof.ledgerPath !== 'string'
              || (proof.mailbox !== 'claude-code-to-luca' && proof.mailbox !== 'luca-to-claude-code')) return false;
            try { assertMailboxPaths(proof.mailbox, proof.ledgerPath, policy.path); return true; } catch { return false; }
          })())
        || (policy.kind === 'ordinary'
          && policy.resolution === 'keep-local-in-candidate'
          && Object.keys(policy.proof).length === 0);
      if (!exactCombination) return 'Policy resolution/proof combination is invalid.';
      seen.add(policy.id);
    }
    return manifest.policies.some((p, i) => manifest.policies.slice(i + 1).some((q) => q.path === p.path)) ? 'Overlapping exact-path policies are forbidden.' : undefined;
  }
  private async audit(fingerprint: string, name: string, body: unknown): Promise<void> {
    const dir = join(this.root, '.local/reconciliation-audits', fingerprint); await mkdir(dir, { recursive: true, mode: 0o700 });
    const bytes = `${stable({ digest: hash(stable(body)), body })}\n`; const path = join(dir, name);
    try { const handle = await open(path, 'wx', 0o600); await handle.writeFile(bytes); await handle.close(); }
    catch (error: any) { if (error?.code !== 'EEXIST' || await readFile(path, 'utf8') !== bytes) throw error; }
  }
  private async readAudit(fingerprint: string, name: string): Promise<Record<string, unknown> | null> {
    try {
      const envelope = JSON.parse(await readFile(join(this.root, '.local/reconciliation-audits', fingerprint, name), 'utf8'));
      return envelope?.digest === hash(stable(envelope.body)) ? envelope.body : null;
    } catch {
      return null;
    }
  }
  private async readPacket(path: string): Promise<ReconciliationPacket | null> {
    try {
      const suppliedPath = resolve(this.root, path);
      const envelope = JSON.parse(await readFile(suppliedPath, 'utf8'));
      const body = envelope.body;
      if (!this.packetValid(body)) return null;
      const canonicalPath = resolve(this.root, '.local/reconciliation-audits', body.fingerprint, 'preflight.json');
      if (suppliedPath !== canonicalPath || await readFile(canonicalPath, 'utf8') !== await readFile(suppliedPath, 'utf8')) return null;
      return envelope.digest === hash(stable(body))
        && hash(stable(this.packetSeed(body))) === body.fingerprint
        ? body
        : null;
    } catch {
      return null;
    }
  }
  private packetValid(body: any): body is ReconciliationPacket {
    const ref = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
    return body?.schemaVersion === 1 && body.manifestVersion === 1 && SHA.test(body.localSha) && SHA.test(body.remoteSha) && SHA.test(body.mergeBase) && /^[0-9a-f]{64}$/.test(body.manifestDigest) && /^[0-9a-f]{64}$/.test(body.fingerprint) && ref.test(body.remote) && ref.test(body.remoteBranch) && body.candidateBranch === `reconcile/candidate-${body.fingerprint}` && body.recoveryRef === `reconcile/recovery-${body.fingerprint}` && ['localUniqueCommits', 'remoteUniqueCommits', 'localPaths', 'remotePaths', 'intersections', 'findings'].every((key) => Array.isArray(body[key])) && body.localUniqueCommits.every(SHA.test.bind(SHA)) && body.remoteUniqueCommits.every(SHA.test.bind(SHA)) && body.localPaths.concat(body.remotePaths).every((path: unknown) => typeof path === 'string' && path && !path.startsWith('/') && !path.includes('..'));
  }
  private packetSeed(body: ReconciliationPacket) {
    return {
      schemaVersion: body.schemaVersion,
      manifestVersion: body.manifestVersion,
      manifestDigest: body.manifestDigest,
      localSha: body.localSha,
      remoteSha: body.remoteSha,
      mergeBase: body.mergeBase,
      remote: body.remote,
      remoteBranch: body.remoteBranch,
      localUniqueCommits: body.localUniqueCommits,
      remoteUniqueCommits: body.remoteUniqueCommits,
      localPaths: body.localPaths,
      remotePaths: body.remotePaths,
      intersections: body.intersections,
      findings: body.findings,
    };
  }
  private async revalidatePacket(
    packet: ReconciliationPacket,
    manifest: Manifest,
  ): Promise<{ state: ReconciliationState; detail: string } | null> {
    await this.commit(packet.localSha);
    await this.commit(packet.remoteSha);
    const base = await this.git(['merge-base', packet.localSha, packet.remoteSha]);
    if (base.code || base.stdout.trim() !== packet.mergeBase) {
      return { state: 'history_incomplete', detail: 'Packet merge base no longer matches Git object topology.' };
    }
    const [localUniqueCommits, remoteUniqueCommits, localPaths, remotePaths] = await Promise.all([
      this.revList(`${packet.remoteSha}..${packet.localSha}`),
      this.revList(`${packet.localSha}..${packet.remoteSha}`),
      this.diffPaths(packet.mergeBase, packet.localSha),
      this.diffPaths(packet.mergeBase, packet.remoteSha),
    ]);
    const intersection = localPaths.filter((path) => remotePaths.includes(path)).sort();
    const intersections: ReconciliationPacket['intersections'] = [];
    const findings: ReconciliationPacket['findings'] = [];
    for (const path of intersection) {
      const policies = manifest.policies.filter((policy) => policy.path === path);
      if (policies.length > 1) findings.push({ state: 'policy_overlap', path, detail: 'More than one exact-path policy matched.' });
      const policy = policies[0];
      const [local, remote] = await Promise.all([
        this.blob(packet.localSha, path),
        this.blob(packet.remoteSha, path),
      ]);
      if (!local || !remote || local.missing || remote.missing) {
        findings.push({ state: 'missing_git_object', path, policy: policy?.id, detail: 'Changed path is deleted or its blob is unavailable.' });
      }
      intersections.push({ path, policy: policy?.id || 'ordinary', local, remote });
    }
    const observed = {
      ...this.packetSeed(packet),
      localUniqueCommits,
      remoteUniqueCommits,
      localPaths,
      remotePaths,
      intersections,
      findings,
    };
    const expected = this.packetSeed(packet);
    if (stable(observed) !== stable(expected)) {
      return { state: findings[0]?.state || 'protected_path_proof_failed', detail: 'Packet Git topology or blob evidence does not match current immutable objects.' };
    }
    return null;
  }
  private async git(args: string[], cwd?: string) { return this.run(args, cwd); }
  private async commit(ref: string, cwd?: string) { const value = await this.git(['rev-parse', '--verify', `${ref}^{commit}`], cwd); if (value.code || !SHA.test(value.stdout.trim())) throw new Error(`Missing exact commit object: ${ref}`); return value.stdout.trim(); }
  private async head(cwd?: string) { return this.commit('HEAD', cwd); }
  private async parents(sha: string, cwd?: string) {
    return (await this.git(['show', '-s', '--format=%P', sha], cwd)).stdout.trim().split(/\s+/).filter(Boolean);
  }
  private async revList(range: string) { return lines((await this.git(['rev-list', '--reverse', range])).stdout); }
  private async diffPaths(left: string, right: string) { return lines((await this.git(['diff', '--name-only', `${left}..${right}`])).stdout); }
  private async blob(ref: string, path: string): Promise<BlobFact | undefined> {
    const result = await this.git(['ls-tree', '-l', ref, '--', path]);
    const fields = result.stdout.trim().split(/\s+/);
    if (result.code || fields.length < 4 || fields[0] === '') return undefined;
    const sha = fields[2];
    const size = Number(fields[3]);
    if (!SHA.test(sha) || !Number.isSafeInteger(size) || size < 0) return undefined;
    const exists = await this.git(['cat-file', '-e', `${sha}^{blob}`]);
    const prefix = exists.code === 0 && size <= 1024 * 1024
      ? await this.git(['show', `${ref}:${path}`])
      : { code: 1, stdout: '', stderr: '' };
    return {
      sha,
      size,
      missing: exists.code !== 0,
      lfs: prefix.code === 0 && prefix.stdout.startsWith('version https://git-lfs.github.com/spec/v1\n'),
      large: size > LARGE_BLOB,
    };
  }
  private async clean() { const status = await this.git(['status', '--porcelain', '--untracked-files=normal']); return status.code === 0 && !status.stdout.trim(); }
  private failure(state: ReconciliationState, error: string): ReconciliationResult { return { ok: false, state, error }; }
}