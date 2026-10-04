import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import {
  SOURCE_CONTROL_REQUIRED_CHECKS,
  SOURCE_CONTROL_VALIDATION_MANIFEST_VERSION,
  SourceControlService,
  isSourceControlSyncStalled,
  materializeProtectedGitSnapshot,
  resolveRenderReleaseEvidenceFromHealth,
  resolveSourceControlStallThresholds,
  validateRenderReleaseEvidence,
  type CandidateSupersededContext,
  type PushValidationFailedContext,
  type RenderReleaseEvidence,
  type SourceControlStatus,
  type StalledSyncAlertContext,
  type StalledSyncAlertDeliveryResult,
} from '../services/source-control-service';

const LOCAL_OLD = '1'.repeat(40);
const LOCAL_NEW = '2'.repeat(40);
const REMOTE_NEW = '3'.repeat(40);
const PUBLICATION_MARKER = '4'.repeat(40);
const CANDIDATE_TREE = '5'.repeat(40);
const SOURCE_CONTEXT_SHA256 = 'c'.repeat(64);
const VALID_RENDER_EVIDENCE: RenderReleaseEvidence = {
  schemaVersion: 1,
  authority: 'build',
  promotable: true,
  commitSha: LOCAL_NEW,
  sourceContextSha256: SOURCE_CONTEXT_SHA256,
  sourceContextAlgorithm: 'sha256(path-nul-kind-nul-bytes-nul-v1)',
  sourceFileCount: 321,
  dirtyWorktree: null,
};

function assertRenderRuntimeSourceSnapshotPrerequisites(): void {
  const dockerfile = readFileSync(join(process.cwd(), 'Dockerfile'), 'utf8');
  const runtimeStage = dockerfile.slice(dockerfile.indexOf(' AS runtime'));
  const runtimeInstallBlocks = [...runtimeStage.matchAll(
    /apt-get install -y --no-install-recommends\s+([\s\S]*?)&&\s*rm -rf \/var\/lib\/apt\/lists\/\*/g,
  )].map((match) => match[1]);
  assert.ok(
    runtimeInstallBlocks.some((block) => /\bgit\b/.test(block)),
    'Render Docker runtime stage must install git for protected source snapshots',
  );
  assert.ok(
    runtimeInstallBlocks.some((block) => /\bca-certificates\b/.test(block)),
    'Render Docker runtime stage must install CA certificates for authenticated Git HTTPS',
  );

  const renderBlueprint = readFileSync(join(process.cwd(), 'render.yaml'), 'utf8');
  for (const key of ['HOLAHOLA_GITHUB_APP_ID', 'HOLAHOLA_GITHUB_APP_INSTALLATION_ID', 'HOLAHOLA_GITHUB_APP_PRIVATE_KEY']) {
    assert.match(
      renderBlueprint,
      new RegExp(`- key: ${key}\\s*\\n\\s+sync: false(?:\\s*\\n|$)`),
      `Render must declare ${key} as an external secret`,
    );
  }
}

function manifest(sha: string): Record<string, unknown> {
  const checks = Object.fromEntries(SOURCE_CONTROL_REQUIRED_CHECKS.map((name) => [name, 'passed']));
  const sourceContextAlgorithm = 'sha256(path-nul-kind-nul-bytes-nul-v1)';
  const sourceFileCount = 321;
  return {
    manifestVersion: SOURCE_CONTROL_VALIDATION_MANIFEST_VERSION,
    candidateSha: sha,
    sourceContextSha256: SOURCE_CONTEXT_SHA256,
    sourceContextAlgorithm,
    sourceFileCount,
    checks,
    validationId: createHash('sha256')
      .update(JSON.stringify({
        manifestVersion: SOURCE_CONTROL_VALIDATION_MANIFEST_VERSION,
        candidateSha: sha,
        sourceContextSha256: SOURCE_CONTEXT_SHA256,
        sourceContextAlgorithm,
        sourceFileCount,
        checks,
      }))
      .digest('hex'),
  };
}

type Scenario = 'equal' | 'local-ahead' | 'github-ahead' | 'diverged';

/** Injects a specific docs/episode-*.md diff into the 'local-ahead' fixture
 *  so a test can prove syncLocked() actually reacts to what
 *  episode-content-loss-guard.ts reports, rather than merely exercising the
 *  fixture's default (and otherwise-untested) always-empty diff stub. */
interface EpisodeDiffFixture {
  changedPath: string;
  oldContent: string;
  newContent: string;
}

interface FixtureRunOptions {
  dirty?: boolean;
  untracked?: boolean;
  missingKey?: boolean;
  holdLock?: boolean;
  episodeDiff?: EpisodeDiffFixture;
  /** Pre-seeds status.json before the fixture's single sync() call, so a
   * test can prove how syncLocked() reacts to a pre-existing status (e.g.
   * a still-current, explicitly-prepared ready_to_promote candidate about
   * to be superseded by this sync's own auto-promotion). */
  seedStatus?: Record<string, unknown>;
  notifyCandidateSuperseded?: (context: CandidateSupersededContext) => Promise<void>;
  notifyPushValidationFailed?: (context: PushValidationFailedContext) => Promise<void>;
  /** Overrides the fixture's default always-passing `async (sha) =>
   * manifest(sha)`, so a test can make the post-push (or receive-branch)
   * validation fail on demand. */
  validateCandidate?: (sha: string) => Promise<Record<string, unknown>>;
}

/** Extracted so a multi-call fixture (see withRepeatableFixture, used by the
 * stalled-sync tests) can drive the same Git-command simulation across
 * repeated sync() calls without re-deriving this scenario logic. `options`
 * is read live on every invocation (not snapshotted), so a caller holding a
 * reference to the same object can flip e.g. `dirty` between calls to
 * simulate a tree that later gets cleaned up. */
function buildFixtureRunCommand(
  scenario: Scenario,
  state: { local: string; remote: string },
  calls: string[],
  options: FixtureRunOptions,
) {
  return async (command: string, args: string[]) => {
    calls.push(`${command} ${args.join(' ')}`);
    assert.equal(command, 'git', 'fixture must never route Git through a shell helper');
    const operation = args[0];
    if (operation === 'branch') return { exitCode: 0, stdout: 'main\n', stderr: '' };
    if (operation === 'status') {
      return {
        exitCode: 0,
        stdout: options.dirty ? ' M tracked-file\n' : options.untracked ? '?? untracked-source.ts\n' : '',
        stderr: '',
      };
    }
    if (operation === 'fetch') return { exitCode: 0, stdout: '', stderr: '' };
    if (operation === 'rev-parse' && args.includes('--is-shallow-repository')) {
      return { exitCode: 0, stdout: 'false\n', stderr: '' };
    }
    if (operation === 'rev-parse') {
      // episode-content-loss-guard.ts's resolveCommit() calls
      // `rev-parse --verify <sha>^{commit}` with the two already-
      // resolved head shas (not the symbolic HEAD/FETCH_HEAD refs
      // SourceControlService's own head-resolution uses) — it must
      // echo back that exact sha, not collapse both to whichever of
      // state.local/state.remote happens to be current, or a
      // violating-diff fixture would compare a version against itself.
      const target = args[args.length - 1] ?? '';
      const embeddedSha = target.match(/^([0-9a-f]{40})\^\{commit\}$/)?.[1];
      const resolved = embeddedSha ?? (target.includes('FETCH_HEAD') ? state.remote : state.local);
      return { exitCode: 0, stdout: `${resolved}\n`, stderr: '' };
    }
    if (operation === 'merge-base' && args[1] !== '--is-ancestor') {
      return { exitCode: scenario === 'diverged' ? 1 : 0, stdout: '', stderr: '' };
    }
    if (operation === 'merge-base') {
      const [, , ancestor, descendant] = args;
      const isAncestor = ancestor === descendant
        || (scenario === 'local-ahead' && ancestor === state.remote && descendant === state.local)
        || (scenario === 'github-ahead' && ancestor === state.local && descendant === state.remote);
      return { exitCode: isAncestor ? 0 : 1, stdout: '', stderr: '' };
    }
    if (operation === 'push') {
      state.remote = state.local;
      return { exitCode: 0, stdout: '', stderr: '' };
    }
    if (operation === 'merge' && args[1] === '--ff-only') {
      state.local = state.remote;
      return { exitCode: 0, stdout: '', stderr: '' };
    }
    // episode-content-loss-guard.ts (checked inline by syncLocked() before
    // its fast-forward push — see server/services/episode-content-loss-
    // guard.ts) issues a read-only diff to find changed docs/episode-*.md
    // files. Only a fixture that opts in via `options.episodeDiff` ever
    // touches such a file; every other fixture's synthetic history
    // truthfully reports an empty changed-file list.
    if (operation === 'diff') {
      const changed = options.episodeDiff ? `${options.episodeDiff.changedPath}\n` : '';
      return { exitCode: 0, stdout: changed, stderr: '' };
    }
    if (
      operation === 'ls-tree'
      && options.episodeDiff
      && args[2] === '--'
      && args[3] === options.episodeDiff.changedPath
    ) {
      // Both the old and new sha carry this path as a normal file in
      // every scenario this fixture drives — it only exercises content
      // mutation, never an add or a delete.
      return { exitCode: 0, stdout: `100644 blob ${'a'.repeat(40)}\t${options.episodeDiff.changedPath}\n`, stderr: '' };
    }
    if (operation === 'show' && options.episodeDiff) {
      const spec = args[1] ?? '';
      const separator = spec.indexOf(':');
      const sha = separator === -1 ? '' : spec.slice(0, separator);
      const path = separator === -1 ? '' : spec.slice(separator + 1);
      if (path === options.episodeDiff.changedPath) {
        if (sha === state.remote) return { exitCode: 0, stdout: options.episodeDiff.oldContent, stderr: '' };
        if (sha === state.local) return { exitCode: 0, stdout: options.episodeDiff.newContent, stderr: '' };
      }
    }
    return { exitCode: 98, stdout: '', stderr: `unexpected command: ${args.join(' ')}` };
  };
}

async function withFixture(
  scenario: Scenario,
  options: FixtureRunOptions = {},
): Promise<{ result: Awaited<ReturnType<SourceControlService['sync']>>; calls: string[]; status: any }> {
  const rootDir = mkdtempSync(join(tmpdir(), 'source-control-service-test-'));
  const calls: string[] = [];
  const state = {
    local: scenario === 'github-ahead' ? LOCAL_OLD : LOCAL_NEW,
    remote: scenario === 'local-ahead' ? LOCAL_OLD : scenario === 'github-ahead' ? REMOTE_NEW : LOCAL_NEW,
  };
  try {
    const env = {
      NODE_ENV: 'development',
      SOURCE_BRIDGE_STATUS_FILE: join(rootDir, 'status.json'),
      SOURCE_BRIDGE_SUMMARY_FILE: join(rootDir, 'status.md'),
      SOURCE_CONTROL_LOCK_FILE: join(rootDir, 'control.lock'),
      SOURCE_CONTROL_OPERATIONS_DIR: join(rootDir, 'operations'),
    } as NodeJS.ProcessEnv;
    if (options.holdLock) {
      writeFileSync(env.SOURCE_CONTROL_LOCK_FILE!, `${JSON.stringify({
        token: 'held',
        pid: process.pid,
        expiresAt: '2999-01-01T00:00:00.000Z',
      })}\n`);
    }
    if (options.seedStatus) {
      writeFileSync(env.SOURCE_BRIDGE_STATUS_FILE!, `${JSON.stringify(options.seedStatus)}\n`);
    }
    const service = new SourceControlService({
      rootDir,
      env,
      fetchInstallationToken: options.missingKey ? undefined : async () => ({ token: 'fixture-token' }),
      uuid: (() => {
        let value = 0;
        return () => `fixture-${++value}`;
      })(),
      validateCandidate: options.validateCandidate ?? (async (sha) => manifest(sha)),
      notifyCandidateSuperseded: options.notifyCandidateSuperseded,
      notifyPushValidationFailed: options.notifyPushValidationFailed,
      runCommand: buildFixtureRunCommand(scenario, state, calls, options),
    });
    const result = await service.sync('fixture');
    const status = (() => {
      try {
        return JSON.parse(readFileSync(env.SOURCE_BRIDGE_STATUS_FILE!, 'utf8'));
      } catch {
        return null;
      }
    })();
    return { result, calls, status };
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
}

/**
 * Multi-call fixture for the stalled-sync alerting tests. Unlike withFixture
 * (one sync() call, then immediate cleanup), this hands back the live
 * `service` plus a mutable clock and a mutable `runOptions` object so a test
 * can call sync()/checkStalled() repeatedly -- e.g. failing several times to
 * cross the alert threshold, then flipping `runOptions.dirty = false` to
 * prove the alert clears on the next successful sync. The caller must
 * invoke the returned `cleanup()` when done (there is no automatic
 * try/finally here, since the whole point is staying alive across calls the
 * caller controls).
 */
async function withRepeatableFixture(
  scenario: Scenario,
  options: FixtureRunOptions & {
    notifyStalledSync?: (
      context: StalledSyncAlertContext,
      alreadyDelivered: StalledSyncAlertDeliveryResult,
    ) => Promise<StalledSyncAlertDeliveryResult>;
    extraEnv?: NodeJS.ProcessEnv;
  } = {},
): Promise<{
  service: SourceControlService;
  runOptions: FixtureRunOptions;
  calls: string[];
  advanceMs: (ms: number) => void;
  readStatus: () => any;
  cleanup: () => void;
}> {
  const rootDir = mkdtempSync(join(tmpdir(), 'source-control-service-stall-test-'));
  const calls: string[] = [];
  const state = {
    local: scenario === 'github-ahead' ? LOCAL_OLD : LOCAL_NEW,
    remote: scenario === 'local-ahead' ? LOCAL_OLD : scenario === 'github-ahead' ? REMOTE_NEW : LOCAL_NEW,
  };
  const runOptions: FixtureRunOptions = { ...options };
  const env = {
    NODE_ENV: 'development',
    SOURCE_BRIDGE_STATUS_FILE: join(rootDir, 'status.json'),
    SOURCE_BRIDGE_SUMMARY_FILE: join(rootDir, 'status.md'),
    SOURCE_CONTROL_LOCK_FILE: join(rootDir, 'control.lock'),
    SOURCE_CONTROL_OPERATIONS_DIR: join(rootDir, 'operations'),
    ...options.extraEnv,
  } as NodeJS.ProcessEnv;
  let clockMs = Date.parse('2026-01-01T00:00:00.000Z');
  const service = new SourceControlService({
    rootDir,
    env,
    now: () => new Date(clockMs),
    fetchInstallationToken: async () => ({ token: 'fixture-token' }),
    uuid: (() => {
      let value = 0;
      return () => `fixture-${++value}`;
    })(),
    validateCandidate: async (sha) => manifest(sha),
    notifyStalledSync: options.notifyStalledSync,
    runCommand: buildFixtureRunCommand(scenario, state, calls, runOptions),
  });
  return {
    service,
    runOptions,
    calls,
    advanceMs: (ms: number) => { clockMs += ms; },
    readStatus: () => {
      try {
        return JSON.parse(readFileSync(env.SOURCE_BRIDGE_STATUS_FILE!, 'utf8'));
      } catch {
        return null;
      }
    },
    cleanup: () => rmSync(rootDir, { recursive: true, force: true }),
  };
}

async function recordPublicationMarkerFixture(overrides: {
  localHead?: string;
  markerSha?: string;
  markerTree?: string;
  markerParents?: string;
  markerSubject?: string;
  remoteHead?: string;
  finalLocalHead?: string;
  finalRemoteHead?: string;
  finalDirty?: boolean;
  finalMarkerResolvedSha?: string;
  finalMarkerTree?: string;
  finalMarkerParents?: string;
  finalMarkerSubject?: string;
  finalConfiguredRemote?: string;
  remoteMarkerResolvedSha?: string;
  remoteMarkerTree?: string;
  remoteMarkerParent?: string;
  finalRemoteMarkerResolvedSha?: string;
  finalRemoteMarkerTree?: string;
  finalRemoteMarkerParent?: string;
  publicationReference?: string;
  finalRenderEvidence?: RenderReleaseEvidence;
  renderEvidenceFailureAt?: number;
} = {}): Promise<{
  result: Awaited<ReturnType<SourceControlService['recordPromotion']>>;
  recorded: import('../services/source-control-service').SourcePromotionRecordInput[];
  receipt?: Record<string, unknown>;
  renderEvidenceCalls: number;
}> {
  const rootDir = mkdtempSync(join(tmpdir(), 'source-control-marker-record-test-'));
  const statusPath = join(rootDir, 'status.json');
  const markerSha = overrides.markerSha ?? PUBLICATION_MARKER;
  const markerTree = overrides.markerTree ?? CANDIDATE_TREE;
  const markerParents = overrides.markerParents ?? LOCAL_NEW;
  const markerSubject = overrides.markerSubject ?? 'Published your App';
  const localHead = overrides.localHead ?? markerSha;
  const remoteHead = overrides.remoteHead ?? LOCAL_NEW;
  const finalLocalHead = overrides.finalLocalHead ?? localHead;
  const finalRemoteHead = overrides.finalRemoteHead ?? remoteHead;
  const publicationReference = overrides.publicationReference
    ?? `render-release:${LOCAL_NEW}:${SOURCE_CONTEXT_SHA256}`;
  const recorded: import('../services/source-control-service').SourcePromotionRecordInput[] = [];
  let fetchCount = 0;
  let localHeadReadCount = 0;
  let statusCount = 0;
  let showCount = 0;
  let remoteMarkerProofCount = 0;
  let configCount = 0;
  let renderEvidenceCalls = 0;
  writeFileSync(statusPath, `${JSON.stringify({
    schemaVersion: 3,
    state: 'ready_to_promote',
    origin: 'fixture',
    replitSha: LOCAL_NEW,
    githubSha: LOCAL_NEW,
    candidateSha: LOCAL_NEW,
    candidatePreparedAt: '2026-09-15T20:00:00.000Z',
    candidateExpiresAt: '2026-09-15T22:00:00.000Z',
    validation: manifest(LOCAL_NEW),
    consecutiveFailures: 0,
    lastHeartbeatAt: '2026-09-15T20:00:00.000Z',
    updatedAt: '2026-09-15T20:00:00.000Z',
  })}\n`);
  try {
    const service = new SourceControlService({
      rootDir,
      env: {
        NODE_ENV: 'development',
        GITHUB_REPO_URL: 'https://github.com/davidwmcintosh/holahola.git',
        SOURCE_BRIDGE_STATUS_FILE: statusPath,
        SOURCE_BRIDGE_SUMMARY_FILE: join(rootDir, 'status.md'),
        SOURCE_CONTROL_LOCK_FILE: join(rootDir, 'control.lock'),
        SOURCE_CONTROL_OPERATIONS_DIR: join(rootDir, 'operations'),
      },
      fetchInstallationToken: async () => ({ token: 'fixture-token' }),
      now: () => new Date('2026-09-15T21:00:00.000Z'),
      uuid: (() => {
        let value = 0;
        return () => `marker-fixture-${++value}`;
      })(),
      resolveRemoteCommit: async (sha) => {
        if (sha !== markerSha) {
          return { sha, treeSha: CANDIDATE_TREE, parentSha: LOCAL_OLD };
        }
        remoteMarkerProofCount += 1;
        return {
          sha: remoteMarkerProofCount > 1
            ? overrides.finalRemoteMarkerResolvedSha ?? overrides.remoteMarkerResolvedSha ?? sha
            : overrides.remoteMarkerResolvedSha ?? sha,
          treeSha: remoteMarkerProofCount > 1
            ? overrides.finalRemoteMarkerTree ?? overrides.remoteMarkerTree ?? markerTree
            : overrides.remoteMarkerTree ?? markerTree,
          parentSha: remoteMarkerProofCount > 1
            ? overrides.finalRemoteMarkerParent ?? overrides.remoteMarkerParent ?? LOCAL_NEW
            : overrides.remoteMarkerParent ?? LOCAL_NEW,
        };
      },
      resolveRenderReleaseEvidence: async (expectedSha, expectedSourceContextSha256) => {
        renderEvidenceCalls += 1;
        if (overrides.renderEvidenceFailureAt === renderEvidenceCalls) {
          throw new Error('render_evidence_fixture_failure');
        }
        assert.equal(expectedSha, LOCAL_NEW);
        assert.equal(expectedSourceContextSha256, SOURCE_CONTEXT_SHA256);
        return renderEvidenceCalls > 1 && overrides.finalRenderEvidence
          ? overrides.finalRenderEvidence
          : VALID_RENDER_EVIDENCE;
      },
      recordSourcePromotion: async (input) => {
        recorded.push(input);
      },
      runCommand: async (command, args) => {
        assert.equal(command, 'git', 'fixture must never route Git through a shell helper');
        const operation = args[0];
        if (operation === 'branch') return { exitCode: 0, stdout: 'main\n', stderr: '' };
        if (operation === 'status') {
          statusCount += 1;
          return {
            exitCode: 0,
            stdout: overrides.finalDirty && statusCount > 1 ? ' M changed-after-initial-check\n' : '',
            stderr: '',
          };
        }
        if (operation === 'fetch') {
          fetchCount += 1;
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        if (operation === 'config') {
          configCount += 1;
          return {
            exitCode: 0,
            stdout: `${
              configCount > 1 && overrides.finalConfiguredRemote
                ? overrides.finalConfiguredRemote
                : 'https://github.com/davidwmcintosh/holahola.git'
            }\n`,
            stderr: '',
          };
        }
        if (operation === 'rev-parse') {
          const remote = fetchCount > 1 ? finalRemoteHead : remoteHead;
          const local = localHeadReadCount > 0 ? finalLocalHead : localHead;
          if (!args.some((arg) => arg.includes('FETCH_HEAD'))) localHeadReadCount += 1;
          return {
            exitCode: 0,
            stdout: `${args.some((arg) => arg.includes('FETCH_HEAD')) ? remote : local}\n`,
            stderr: '',
          };
        }
        if (operation === 'show') {
          showCount += 1;
          const finalRead = showCount > 1;
          return {
            exitCode: 0,
            stdout: `${
              finalRead && overrides.finalMarkerResolvedSha
                ? overrides.finalMarkerResolvedSha
                : args.at(-1)
            }\n${
              finalRead && overrides.finalMarkerTree
                ? overrides.finalMarkerTree
                : markerTree
            }\n${
              finalRead && overrides.finalMarkerParents
                ? overrides.finalMarkerParents
                : markerParents
            }\n${
              finalRead && overrides.finalMarkerSubject
                ? overrides.finalMarkerSubject
                : markerSubject
            }\n`,
            stderr: '',
          };
        }
        // episode-content-loss-guard.ts (checked inline by syncLocked() before
        // its fast-forward push — see server/services/episode-content-loss-
        // guard.ts) issues a read-only diff to find changed docs/episode-*.md
        // files. None of this fixture's synthetic history ever touches such a
        // file, so an empty changed-file list is the truthful response.
        if (operation === 'diff') return { exitCode: 0, stdout: '', stderr: '' };
        return { exitCode: 98, stdout: '', stderr: `unexpected command: ${args.join(' ')}` };
      },
    });
    const result = await service.recordPromotion(
      LOCAL_NEW,
      'fixture',
      'marker-operation',
      publicationReference,
    );
    const receiptName = readdirSync(join(rootDir, 'operations'))
      .find((name) => name.startsWith('promotion-'));
    const receipt = receiptName
      ? JSON.parse(readFileSync(join(rootDir, 'operations', receiptName), 'utf8')) as Record<string, unknown>
      : undefined;
    return { result, recorded, receipt, renderEvidenceCalls };
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
}

async function syncPublicationMarkerFixture(overrides: {
  priorState?: 'ready_to_promote' | 'synced' | 'failed';
  candidatePreparedAt?: string;
  candidateExpiresAt?: string;
  validation?: Record<string, unknown>;
  markerParent?: string;
  markerTree?: string;
  markerSubject?: string;
  remoteCandidateTree?: string;
  remoteMarkerTree?: string;
  remoteMarkerParent?: string;
  finalLocalHead?: string;
  finalRemoteHead?: string;
  finalDirty?: boolean;
  rejectConcurrentRemoteProofs?: boolean;
} = {}): Promise<{
  result: Awaited<ReturnType<SourceControlService['sync']>>;
  status: any;
}> {
  const rootDir = mkdtempSync(join(tmpdir(), 'source-control-marker-sync-test-'));
  const statusPath = join(rootDir, 'status.json');
  const preparedAt = overrides.candidatePreparedAt ?? '2026-09-15T20:00:00.000Z';
  const expiresAt = overrides.candidateExpiresAt ?? '2026-09-15T22:00:00.000Z';
  let fetchCount = 0;
  let statusCount = 0;
  let activeRemoteProofs = 0;
  writeFileSync(statusPath, `${JSON.stringify({
    schemaVersion: 3,
    state: overrides.priorState ?? 'synced',
    origin: 'fixture',
    replitSha: LOCAL_NEW,
    githubSha: LOCAL_NEW,
    candidateSha: LOCAL_NEW,
    candidatePreparedAt: preparedAt,
    candidateExpiresAt: expiresAt,
    validation: overrides.validation ?? manifest(LOCAL_NEW),
    consecutiveFailures: overrides.priorState === 'failed' ? 1 : 0,
    lastHeartbeatAt: '2026-09-15T20:00:00.000Z',
    updatedAt: '2026-09-15T20:00:00.000Z',
  })}\n`);
  try {
    const service = new SourceControlService({
      rootDir,
      env: {
        NODE_ENV: 'development',
        SOURCE_BRIDGE_STATUS_FILE: statusPath,
        SOURCE_BRIDGE_SUMMARY_FILE: join(rootDir, 'status.md'),
        SOURCE_CONTROL_LOCK_FILE: join(rootDir, 'control.lock'),
        SOURCE_CONTROL_OPERATIONS_DIR: join(rootDir, 'operations'),
      },
      fetchInstallationToken: async () => ({ token: 'fixture-token' }),
      now: () => new Date('2026-09-15T21:00:00.000Z'),
      uuid: (() => {
        let value = 0;
        return () => `sync-marker-fixture-${++value}`;
      })(),
      resolveRemoteCommit: async (sha) => {
        activeRemoteProofs += 1;
        try {
          if (overrides.rejectConcurrentRemoteProofs) {
            await new Promise((resolve) => setTimeout(resolve, 1));
            if (activeRemoteProofs > 1) throw new Error('concurrent_remote_proof_resolution');
          }
          return sha === LOCAL_NEW
            ? {
                sha,
                treeSha: overrides.remoteCandidateTree ?? CANDIDATE_TREE,
                parentSha: LOCAL_OLD,
              }
            : {
                sha,
                treeSha: overrides.remoteMarkerTree ?? CANDIDATE_TREE,
                parentSha: overrides.remoteMarkerParent ?? LOCAL_NEW,
              };
        } finally {
          activeRemoteProofs -= 1;
        }
      },
      runCommand: async (command, args) => {
        assert.equal(command, 'git', 'fixture must never route Git through a shell helper');
        const operation = args[0];
        if (operation === 'branch') return { exitCode: 0, stdout: 'main\n', stderr: '' };
        if (operation === 'status') {
          statusCount += 1;
          return {
            exitCode: 0,
            stdout: overrides.finalDirty && statusCount > 1 ? ' M changed-after-marker-proof\n' : '',
            stderr: '',
          };
        }
        if (operation === 'fetch') {
          fetchCount += 1;
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        if (operation === 'rev-parse' && args.includes('--is-shallow-repository')) {
          return { exitCode: 0, stdout: 'false\n', stderr: '' };
        }
        if (operation === 'rev-parse') {
          const finalRead = fetchCount > 1;
          const value = args.some((arg) => arg.includes('FETCH_HEAD'))
            ? finalRead ? overrides.finalRemoteHead ?? PUBLICATION_MARKER : PUBLICATION_MARKER
            : finalRead ? overrides.finalLocalHead ?? PUBLICATION_MARKER : PUBLICATION_MARKER;
          return { exitCode: 0, stdout: `${value}\n`, stderr: '' };
        }
        if (operation === 'merge-base') {
          return { exitCode: 0, stdout: `${PUBLICATION_MARKER}\n`, stderr: '' };
        }
        if (operation === 'show') {
          return {
            exitCode: 0,
            stdout: `${PUBLICATION_MARKER}\n${overrides.markerTree ?? CANDIDATE_TREE}\n${
              overrides.markerParent ?? LOCAL_NEW
            }\n${overrides.markerSubject ?? 'Published your App'}\n`,
            stderr: '',
          };
        }
        // episode-content-loss-guard.ts (checked inline by syncLocked() before
        // its fast-forward push — see server/services/episode-content-loss-
        // guard.ts) issues a read-only diff to find changed docs/episode-*.md
        // files. None of this fixture's synthetic history ever touches such a
        // file, so an empty changed-file list is the truthful response.
        if (operation === 'diff') return { exitCode: 0, stdout: '', stderr: '' };
        return { exitCode: 98, stdout: '', stderr: `unexpected command: ${args.join(' ')}` };
      },
    });
    const result = await service.sync('fixture');
    const status = JSON.parse(readFileSync(statusPath, 'utf8'));
    return { result, status };
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
}

type SyncMarkerFixtureOverrides = {
  previousState?: string;
  candidateExpiresAt?: string;
  brokenValidation?: boolean;
  head?: string;
  localHead?: string;
  githubHead?: string;
  candidateRemoteSha?: string;
  candidateRemoteTree?: string;
  markerRemoteSha?: string;
  markerRemoteTree?: string;
  markerRemoteParent?: string;
  markerLocalResolvedSha?: string;
  markerLocalTree?: string;
  markerLocalParents?: string;
  markerLocalSubject?: string;
  dirty?: boolean;
};

async function syncPublicationMarkerFailClosedFixture(overrides: SyncMarkerFixtureOverrides = {}): Promise<{ result: Awaited<ReturnType<SourceControlService['sync']>>; status: any }> {
  const rootDir = mkdtempSync(join(tmpdir(), 'source-control-sync-marker-test-'));
  const statusPath = join(rootDir, 'status.json');
  const candidateSha = LOCAL_NEW;
  const candidateTree = CANDIDATE_TREE;
  const head = overrides.head ?? PUBLICATION_MARKER;
  const localHead = overrides.localHead ?? head;
  const githubHead = overrides.githubHead ?? head;
  const preparedAt = '2026-09-15T20:00:00.000Z';
  const expiresAt = overrides.candidateExpiresAt ?? '2026-09-15T22:00:00.000Z';
  const validation = overrides.brokenValidation
    ? { ...manifest(candidateSha), checks: {} }
    : manifest(candidateSha);
  writeFileSync(statusPath, `${JSON.stringify({
    schemaVersion: 3,
    state: overrides.previousState ?? 'ready_to_promote',
    origin: 'fixture',
    replitSha: candidateSha,
    githubSha: candidateSha,
    candidateSha,
    candidatePreparedAt: preparedAt,
    candidateExpiresAt: expiresAt,
    validation,
    consecutiveFailures: 0,
    lastHeartbeatAt: preparedAt,
    updatedAt: preparedAt,
  })}\n`);
  try {
    const service = new SourceControlService({
      rootDir,
      env: {
        NODE_ENV: 'development',
        GITHUB_REPO_URL: 'https://github.com/davidwmcintosh/holahola.git',
        SOURCE_BRIDGE_STATUS_FILE: statusPath,
        SOURCE_BRIDGE_SUMMARY_FILE: join(rootDir, 'status.md'),
        SOURCE_CONTROL_LOCK_FILE: join(rootDir, 'control.lock'),
        SOURCE_CONTROL_OPERATIONS_DIR: join(rootDir, 'operations'),
      },
      fetchInstallationToken: async () => ({ token: 'fixture-token' }),
      now: () => new Date('2026-09-15T21:00:00.000Z'),
      uuid: (() => {
        let value = 0;
        return () => `sync-marker-fixture-${++value}`;
      })(),
      validateCandidate: async (sha) => manifest(sha),
      resolveRemoteCommit: async (sha) => {
        if (sha === candidateSha) {
          return {
            sha: overrides.candidateRemoteSha ?? sha,
            treeSha: overrides.candidateRemoteTree ?? candidateTree,
            parentSha: LOCAL_OLD,
          };
        }
        return {
          sha: overrides.markerRemoteSha ?? sha,
          treeSha: overrides.markerRemoteTree ?? candidateTree,
          parentSha: overrides.markerRemoteParent ?? candidateSha,
        };
      },
      runCommand: async (command, args) => {
        assert.equal(command, 'git', 'fixture must never route Git through a shell helper');
        const operation = args[0];
        if (operation === 'branch') return { exitCode: 0, stdout: 'main\n', stderr: '' };
        if (operation === 'status') {
          return { exitCode: 0, stdout: overrides.dirty ? ' M tracked-file\n' : '', stderr: '' };
        }
        if (operation === 'fetch') return { exitCode: 0, stdout: '', stderr: '' };
        if (operation === 'rev-parse' && args.includes('--is-shallow-repository')) {
          return { exitCode: 0, stdout: 'false\n', stderr: '' };
        }
        if (operation === 'rev-parse') {
          const isRemote = args.some((arg) => arg.includes('FETCH_HEAD'));
          return { exitCode: 0, stdout: `${isRemote ? githubHead : localHead}\n`, stderr: '' };
        }
        if (operation === 'merge-base' && args[1] !== '--is-ancestor') {
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        if (operation === 'show') {
          return {
            exitCode: 0,
            stdout: `${overrides.markerLocalResolvedSha ?? head}\n${
              overrides.markerLocalTree ?? candidateTree
            }\n${overrides.markerLocalParents ?? candidateSha}\n${
              overrides.markerLocalSubject ?? 'Published your App'
            }\n`,
            stderr: '',
          };
        }
        // episode-content-loss-guard.ts (checked inline by syncLocked() before
        // its fast-forward push — see server/services/episode-content-loss-
        // guard.ts) issues a read-only diff to find changed docs/episode-*.md
        // files. None of this fixture's synthetic history ever touches such a
        // file, so an empty changed-file list is the truthful response.
        if (operation === 'diff') return { exitCode: 0, stdout: '', stderr: '' };
        return { exitCode: 98, stdout: '', stderr: `unexpected command: ${args.join(' ')}` };
      },
    });
    const result = await service.sync('fixture');
    const status = JSON.parse(readFileSync(statusPath, 'utf8'));
    return { result, status };
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
}

/**
 * End-to-end reproduction of the publish-then-scheduler race: a validated
 * candidate is prepared, Replit Publish creates an authenticated same-tree
 * "Published your App" marker on both Replit and GitHub, the scheduler's
 * `sync()` runs (as it does automatically after publish), and only then does
 * the operator call `recordPromotion()` for the original candidate. Before
 * the fix, `sync()` would have already overwritten the status file to
 * `synced`, so `recordPromotion()` would refuse because the status no longer
 * showed `ready_to_promote`. This proves the full lifecycle now succeeds.
 */
async function syncThenRecordPublicationMarkerFixture(): Promise<{
  syncResult: Awaited<ReturnType<SourceControlService['sync']>>;
  recordResult: Awaited<ReturnType<SourceControlService['recordPromotion']>>;
  recorded: import('../services/source-control-service').SourcePromotionRecordInput[];
  statusAfterSync: any;
  statusAfterRecord: any;
  syncAfterRecordResult: Awaited<ReturnType<SourceControlService['sync']>>;
  statusAfterSyncAfterRecord: any;
  recordAfterSyncResult: Awaited<ReturnType<SourceControlService['recordPromotion']>>;
}> {
  const rootDir = mkdtempSync(join(tmpdir(), 'source-control-sync-then-record-test-'));
  const statusPath = join(rootDir, 'status.json');
  const candidateSha = LOCAL_NEW;
  const candidateTree = CANDIDATE_TREE;
  const head = PUBLICATION_MARKER;
  const preparedAt = '2026-09-15T20:00:00.000Z';
  const expiresAt = '2026-09-15T22:00:00.000Z';
  const publicationReference = `render-release:${candidateSha}:${SOURCE_CONTEXT_SHA256}`;
  writeFileSync(statusPath, `${JSON.stringify({
    schemaVersion: 3,
    state: 'ready_to_promote',
    origin: 'fixture',
    replitSha: candidateSha,
    githubSha: candidateSha,
    candidateSha,
    candidatePreparedAt: preparedAt,
    candidateExpiresAt: expiresAt,
    validation: manifest(candidateSha),
    consecutiveFailures: 0,
    lastHeartbeatAt: preparedAt,
    updatedAt: preparedAt,
  })}\n`);
  const recorded: import('../services/source-control-service').SourcePromotionRecordInput[] = [];
  try {
    const service = new SourceControlService({
      rootDir,
      env: {
        NODE_ENV: 'development',
        GITHUB_REPO_URL: 'https://github.com/davidwmcintosh/holahola.git',
        SOURCE_BRIDGE_STATUS_FILE: statusPath,
        SOURCE_BRIDGE_SUMMARY_FILE: join(rootDir, 'status.md'),
        SOURCE_CONTROL_LOCK_FILE: join(rootDir, 'control.lock'),
        SOURCE_CONTROL_OPERATIONS_DIR: join(rootDir, 'operations'),
      },
      fetchInstallationToken: async () => ({ token: 'fixture-token' }),
      now: () => new Date('2026-09-15T21:00:00.000Z'),
      uuid: (() => {
        let value = 0;
        return () => `sync-then-record-fixture-${++value}`;
      })(),
      validateCandidate: async (sha) => manifest(sha),
      resolveRemoteCommit: async (sha) => (sha === candidateSha
        ? { sha, treeSha: candidateTree, parentSha: LOCAL_OLD }
        : { sha, treeSha: candidateTree, parentSha: candidateSha }),
      resolveRenderReleaseEvidence: async () => VALID_RENDER_EVIDENCE,
      recordSourcePromotion: async (input) => {
        recorded.push(input);
      },
      runCommand: async (command, args) => {
        assert.equal(command, 'git', 'fixture must never route Git through a shell helper');
        const operation = args[0];
        if (operation === 'branch') return { exitCode: 0, stdout: 'main\n', stderr: '' };
        if (operation === 'status') return { exitCode: 0, stdout: '', stderr: '' };
        if (operation === 'fetch') return { exitCode: 0, stdout: '', stderr: '' };
        if (operation === 'config') {
          return { exitCode: 0, stdout: 'https://github.com/davidwmcintosh/holahola.git\n', stderr: '' };
        }
        if (operation === 'rev-parse' && args.includes('--is-shallow-repository')) {
          return { exitCode: 0, stdout: 'false\n', stderr: '' };
        }
        if (operation === 'rev-parse') return { exitCode: 0, stdout: `${head}\n`, stderr: '' };
        if (operation === 'merge-base' && args[1] !== '--is-ancestor') {
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        if (operation === 'show') {
          return {
            exitCode: 0,
            stdout: `${head}\n${candidateTree}\n${candidateSha}\nPublished your App\n`,
            stderr: '',
          };
        }
        // episode-content-loss-guard.ts (checked inline by syncLocked() before
        // its fast-forward push — see server/services/episode-content-loss-
        // guard.ts) issues a read-only diff to find changed docs/episode-*.md
        // files. None of this fixture's synthetic history ever touches such a
        // file, so an empty changed-file list is the truthful response.
        if (operation === 'diff') return { exitCode: 0, stdout: '', stderr: '' };
        return { exitCode: 98, stdout: '', stderr: `unexpected command: ${args.join(' ')}` };
      },
    });
    const syncResult = await service.sync('scheduler');
    const statusAfterSync = JSON.parse(readFileSync(statusPath, 'utf8'));
    const recordResult = await service.recordPromotion(candidateSha, 'operator', 'record-after-sync', publicationReference);
    const statusAfterRecord = JSON.parse(readFileSync(statusPath, 'utf8'));
    // The scheduler keeps polling on its own cadence. The same "Published
    // your App" marker is still the head, and the just-promoted candidate's
    // evidence (sha/validation/expiry) is untouched by recordPromotion. A
    // completed promotion must never be re-armed to ready_to_promote, or a
    // later scheduler tick would let an operator attempt to record it again.
    const syncAfterRecordResult = await service.sync('scheduler');
    const statusAfterSyncAfterRecord = JSON.parse(readFileSync(statusPath, 'utf8'));
    const recordAfterSyncResult = await service.recordPromotion(candidateSha, 'operator', 'record-after-second-sync', publicationReference);
    return {
      syncResult,
      recordResult,
      recorded,
      statusAfterSync,
      statusAfterRecord,
      syncAfterRecordResult,
      statusAfterSyncAfterRecord,
      recordAfterSyncResult,
    };
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
}

/**
 * Task #1643: the DI-based coverage above only proves
 * dispatchPushValidationFailedAlert's *hook* fires with the right data --
 * the notifyPushValidationFailed override passed into the fixture never
 * touches the real method. This calls the real (private) method directly
 * against a verified disposable database and confirms its two live side
 * effects actually happen: a Team Room message via storage.createRoomMessage,
 * and an aldenNotifications row with fingerprint
 * 'source_control_push_validation_failed'. It also proves the two channels
 * are independently best-effort, matching the contract already established
 * for the sibling dispatchStalledSyncAlert/dispatchCandidateSupersededAlert
 * methods in the same file: a real failure injected into one channel (via a
 * BEFORE INSERT trigger, not a mock) must never block the other.
 *
 * Skips outside a verified CI database (see
 * .agents/memory/disposable-database-gate-design.md) so this file's normal
 * Replit/local execution never opens a real database connection.
 */
async function testPushValidationFailedAlertRealDelivery(): Promise<void> {
  const ciDatabaseUrl = getVerifiedCiDatabaseUrl();
  if (!ciDatabaseUrl) {
    console.log(
      '[SKIP] push-validation-failed real-delivery coverage requires a verified CI_DATABASE_URL ' +
      '(CI=true); skipping outside a real CI run.',
    );
    return;
  }

  const { storage } = await import('../storage');
  const { getUserDb } = await import('../db');
  const { aldenNotifications, roomVoiceMessages } = await import('@shared/schema');
  const { sql: rawSql } = await import('drizzle-orm');

  const db = getUserDb();
  const service = new SourceControlService({});
  const dispatch = (context: PushValidationFailedContext) =>
    (service as unknown as {
      dispatchPushValidationFailedAlert: (context: PushValidationFailedContext) => Promise<void>;
    }).dispatchPushValidationFailedAlert(context);

  // A real room for storage.listTeamRooms(1) to find -- the production
  // method silently no-ops the Team Room channel when there is none.
  const room = await storage.createTeamRoom({
    topic: `test-source-control-service push-validation-failed ${Date.now()}`,
  });

  // ---- Scenario 1: both channels succeed for real. ----
  const marker1 = `tscs-pvf-${Date.now()}-both-ok`;
  const sha1 = 'a'.repeat(40);
  await dispatch({ sha: sha1, error: `${marker1} fixture manifest failure`, actor: 'test-source-control-service' });

  const roomMessagesAfter1 = await db.select().from(roomVoiceMessages);
  const matchingMessages1 = roomMessagesAfter1.filter((m) => m.content.includes(marker1));
  assert.equal(matchingMessages1.length, 1, 'dispatchPushValidationFailedAlert must actually call storage.createRoomMessage, not just the injected hook');
  assert.equal(matchingMessages1[0].roomId, room.id);
  assert.equal(matchingMessages1[0].speaker, 'Luca');
  assert.match(matchingMessages1[0].content, new RegExp(sha1));

  const notificationsAfter1 = await db.select().from(aldenNotifications);
  const matchingNotifications1 = notificationsAfter1.filter((n) => n.content.includes(marker1));
  assert.equal(matchingNotifications1.length, 1, 'dispatchPushValidationFailedAlert must actually insert an aldenNotifications row, not just call the injected hook');
  assert.equal(matchingNotifications1[0].fingerprint, 'source_control_push_validation_failed');
  assert.equal(matchingNotifications1[0].triggeredBy, 'source-control');
  assert.equal(matchingNotifications1[0].severity, 'alert');
  assert.equal(matchingNotifications1[0].read, false);
  assert.match(matchingNotifications1[0].content, new RegExp(sha1));

  // ---- Scenario 2: Team Room channel fails for real (a BEFORE INSERT
  // trigger stands in for e.g. a broken import or schema mismatch); the
  // founder-inbox insert must still succeed independently. ----
  const marker2 = `tscs-pvf-${Date.now()}-team-room-fails`;
  const sha2 = 'b'.repeat(40);
  await db.execute(rawSql`DROP TRIGGER IF EXISTS test_scs_fail_room_message_trg ON room_voice_messages`);
  await db.execute(rawSql`DROP FUNCTION IF EXISTS test_scs_fail_room_message()`);
  await db.execute(rawSql`CREATE FUNCTION test_scs_fail_room_message() RETURNS trigger AS $BODY$ BEGIN RAISE EXCEPTION 'SIMULATED for test-source-control-service: Team Room channel failure'; END; $BODY$ LANGUAGE plpgsql`);
  await db.execute(rawSql`CREATE TRIGGER test_scs_fail_room_message_trg BEFORE INSERT ON room_voice_messages FOR EACH ROW EXECUTE FUNCTION test_scs_fail_room_message()`);
  try {
    await dispatch({ sha: sha2, error: `${marker2} fixture manifest failure`, actor: 'test-source-control-service' });
  } finally {
    await db.execute(rawSql`DROP TRIGGER IF EXISTS test_scs_fail_room_message_trg ON room_voice_messages`);
    await db.execute(rawSql`DROP FUNCTION IF EXISTS test_scs_fail_room_message()`);
  }

  const roomMessagesAfter2 = await db.select().from(roomVoiceMessages);
  assert.equal(
    roomMessagesAfter2.filter((m) => m.content.includes(marker2)).length,
    0,
    'sanity check: the simulated Team Room trigger must actually have blocked the insert',
  );
  const notificationsAfter2 = await db.select().from(aldenNotifications);
  const matchingNotifications2 = notificationsAfter2.filter((n) => n.content.includes(marker2));
  assert.equal(matchingNotifications2.length, 1, 'a Team Room delivery failure must not block the founder-inbox aldenNotifications insert');
  assert.equal(matchingNotifications2[0].fingerprint, 'source_control_push_validation_failed');

  // ---- Scenario 3: founder-inbox insert fails for real; the Team Room
  // message must still be posted independently. ----
  const marker3 = `tscs-pvf-${Date.now()}-founder-inbox-fails`;
  const sha3 = 'c'.repeat(40);
  await db.execute(rawSql`DROP TRIGGER IF EXISTS test_scs_fail_notification_trg ON alden_notifications`);
  await db.execute(rawSql`DROP FUNCTION IF EXISTS test_scs_fail_notification()`);
  await db.execute(rawSql`CREATE FUNCTION test_scs_fail_notification() RETURNS trigger AS $BODY$ BEGIN RAISE EXCEPTION 'SIMULATED for test-source-control-service: founder-inbox channel failure'; END; $BODY$ LANGUAGE plpgsql`);
  await db.execute(rawSql`CREATE TRIGGER test_scs_fail_notification_trg BEFORE INSERT ON alden_notifications FOR EACH ROW EXECUTE FUNCTION test_scs_fail_notification()`);
  try {
    await dispatch({ sha: sha3, error: `${marker3} fixture manifest failure`, actor: 'test-source-control-service' });
  } finally {
    await db.execute(rawSql`DROP TRIGGER IF EXISTS test_scs_fail_notification_trg ON alden_notifications`);
    await db.execute(rawSql`DROP FUNCTION IF EXISTS test_scs_fail_notification()`);
  }

  const notificationsAfter3 = await db.select().from(aldenNotifications);
  assert.equal(
    notificationsAfter3.filter((n) => n.content.includes(marker3)).length,
    0,
    'sanity check: the simulated founder-inbox trigger must actually have blocked the insert',
  );
  const roomMessagesAfter3 = await db.select().from(roomVoiceMessages);
  const matchingMessages3 = roomMessagesAfter3.filter((m) => m.content.includes(marker3));
  assert.equal(matchingMessages3.length, 1, 'a founder-inbox insert failure must not block the Team Room message delivery');
  assert.equal(matchingMessages3[0].roomId, room.id);

  console.log(
    'Push-validation-failed real-database delivery checks passed ' +
    '(Team Room message + aldenNotifications row, both channels independently best-effort).',
  );
}

async function main(): Promise<void> {
  assertRenderRuntimeSourceSnapshotPrerequisites();

  const equal = await withFixture('equal');
  assert.equal(equal.result.state, 'synced');

  for (const priorState of ['synced', 'failed'] as const) {
    const markerStatusRecovery = await syncPublicationMarkerFixture({
      priorState,
      rejectConcurrentRemoteProofs: true,
    });
    assert.equal(markerStatusRecovery.result.state, 'ready_to_promote');
    assert.equal(markerStatusRecovery.result.candidateSha, LOCAL_NEW);
    assert.equal(markerStatusRecovery.status.state, 'ready_to_promote');
    assert.equal(markerStatusRecovery.status.candidateSha, LOCAL_NEW);
    assert.equal(markerStatusRecovery.status.replitSha, PUBLICATION_MARKER);
    assert.equal(markerStatusRecovery.status.githubSha, PUBLICATION_MARKER);
    assert.equal(markerStatusRecovery.status.candidatePreparedAt, '2026-09-15T20:00:00.000Z');
    assert.equal(markerStatusRecovery.status.candidateExpiresAt, '2026-09-15T22:00:00.000Z');
    assert.deepEqual(markerStatusRecovery.status.validation, manifest(LOCAL_NEW));
  }

  for (const invalidMarkerRecovery of [
    { markerParent: LOCAL_OLD },
    { markerTree: '6'.repeat(40) },
    { markerSubject: 'Published another App' },
    { remoteCandidateTree: '6'.repeat(40) },
    { remoteMarkerTree: '6'.repeat(40) },
    { remoteMarkerParent: LOCAL_OLD },
    { candidateExpiresAt: '2026-09-15T21:00:00.000Z' },
    { candidatePreparedAt: '2026-09-15T21:30:00.000Z' },
    { validation: { ...manifest(LOCAL_NEW), validationId: '0'.repeat(64) } },
    { finalLocalHead: '7'.repeat(40) },
    { finalRemoteHead: '7'.repeat(40) },
    { finalDirty: true },
  ]) {
    const rejected = await syncPublicationMarkerFixture(invalidMarkerRecovery);
    assert.equal(rejected.result.state, 'synced');
    assert.equal(rejected.status.state, 'synced');
    assert.notEqual(rejected.status.candidateSha, PUBLICATION_MARKER);
  }

  const localAhead = await withFixture('local-ahead');
  assert.equal(localAhead.result.state, 'synced');
  assert.ok(localAhead.calls.some((call) => call.startsWith('git push ')));

  // A push that would silently remove real, non-duplicate episode content
  // must be blocked before it reaches `git push` — proving syncLocked()
  // actually reacts to a real violation from episode-content-loss-guard.ts,
  // not merely that unrelated fixtures still pass against an always-empty
  // diff stub (see the 2026-08-31/2026-09-21 incidents in task #1529).
  //
  // Uses episode 55, not 99: episode-content-loss-guard.ts's own
  // LEGACY_RESERVED_FIXTURE_EPISODE_NUMBERS now excludes 99 globally from
  // content-loss protection (it's test-rolling-sync-guard.ts's real-repo
  // scratch fixture), so isProtectedEpisodeFile('docs/episode-99.md') is
  // FALSE and this scenario would silently no-op (sync succeeds instead of
  // being blocked) if it stayed on 99. episode-55 is the same substitute
  // check-episode-content-loss.ts's own self-check already moved to for the
  // identical reason — kept consistent with that precedent.
  const episodeContentLossOld = [
    '# Episode 55',
    '',
    "**DAVID:** approved, I'm off for the day",
    '**LUCA [Replit]:** Good session, enjoy the rest of your day',
  ].join('\n');
  const episodeContentLossNew = [
    '# Episode 55',
    '',
    "**DAVID:** approved, I'm off for the day",
    '**LUCA [Replit]:** a different, later exchange entirely',
  ].join('\n');
  const episodeLossBlocked = await withFixture('local-ahead', {
    episodeDiff: {
      changedPath: 'docs/episode-55.md',
      oldContent: episodeContentLossOld,
      newContent: episodeContentLossNew,
    },
  });
  assert.equal(episodeLossBlocked.result.state, 'failed');
  assert.match(episodeLossBlocked.result.error || '', /EPISODE_CONTENT_LOSS_BLOCKED/);
  assert.match(episodeLossBlocked.result.error || '', /docs\/episode-55\.md/);
  assert.ok(
    !episodeLossBlocked.calls.some((call) => call.startsWith('git push ')),
    'a blocked episode content-loss violation must never reach git push',
  );
  assert.equal(episodeLossBlocked.status.state, 'failed');
  assert.match(episodeLossBlocked.status.error || '', /EPISODE_CONTENT_LOSS_BLOCKED/);

  // The same guard must not block a legitimate append — proving the
  // fixture (and the guard) actually discriminates on content loss rather
  // than blocking on the mere presence of an episode-file diff.
  const episodeAppendSafe = await withFixture('local-ahead', {
    episodeDiff: {
      changedPath: 'docs/episode-55.md',
      oldContent: episodeContentLossOld,
      newContent: `${episodeContentLossOld}\n**DAVID:** one more thing\n**LUCA [Replit]:** sure, go ahead`,
    },
  });
  assert.equal(episodeAppendSafe.result.state, 'synced');
  assert.ok(episodeAppendSafe.calls.some((call) => call.startsWith('git push ')));

  // The post-push validation confirms the very commit that was just
  // fast-forward pushed. On a passing manifest it must not alert and must
  // record 'passed' against the exact pushed SHA -- not silently succeed
  // with no trace it ever ran.
  const pushValidationPassed = await withFixture('local-ahead');
  assert.equal(pushValidationPassed.result.state, 'synced');
  assert.equal(pushValidationPassed.status.pushValidationStatus, 'passed');
  assert.equal(pushValidationPassed.status.pushValidationSha, LOCAL_NEW);
  assert.equal(pushValidationPassed.status.pushValidationError, undefined);
  assert.ok(pushValidationPassed.status.pushValidationCompletedAt);

  // A commit that fast-forward pushes cleanly but then fails the same
  // manifest a `prepare` run would have used must: (1) still report the
  // sync itself as ok (the git push genuinely succeeded and retrying
  // sync() cannot undo or fix that), (2) surface the problem through both
  // `error` and the dedicated pushValidationStatus field, and (3) alert
  // exactly once. This is the exact gap Fix A closes: code reaching GitHub
  // main via the fast path with nobody ever finding out it was broken.
  const pushValidationAlerts: PushValidationFailedContext[] = [];
  const pushValidationFailed = await withFixture('local-ahead', {
    validateCandidate: async () => { throw new Error('npm run test:ci:unit failed validation: fixture failure'); },
    notifyPushValidationFailed: async (context) => { pushValidationAlerts.push(context); },
  });
  assert.equal(pushValidationFailed.result.ok, true, 'the push itself succeeded and must not be reported as a sync failure');
  assert.equal(pushValidationFailed.result.state, 'synced');
  assert.match(pushValidationFailed.result.error || '', /POST_PUSH_VALIDATION_FAILED/);
  assert.match(pushValidationFailed.result.error || '', /fixture failure/);
  assert.equal(pushValidationFailed.status.state, 'synced');
  assert.equal(pushValidationFailed.status.pushValidationStatus, 'failed');
  assert.equal(pushValidationFailed.status.pushValidationSha, LOCAL_NEW);
  assert.match(pushValidationFailed.status.pushValidationError || '', /fixture failure/);
  assert.match(pushValidationFailed.status.error || '', /POST_PUSH_VALIDATION_FAILED/);
  assert.equal(pushValidationAlerts.length, 1, 'a commit that fails validation after already reaching GitHub main must alert exactly once');
  assert.equal(pushValidationAlerts[0].sha, LOCAL_NEW);
  assert.equal(pushValidationAlerts[0].actor, 'fixture');
  assert.match(pushValidationAlerts[0].error, /fixture failure/);

  await testPushValidationFailedAlertRealDelivery();

  const githubAhead = await withFixture('github-ahead');
  assert.equal(githubAhead.result.state, 'ready_to_promote');
  assert.ok(githubAhead.calls.includes('git merge --ff-only FETCH_HEAD'));
  assert.equal(githubAhead.status.candidateSha, REMOTE_NEW);
  assert.equal(
    githubAhead.status.candidateSource,
    'auto_sync',
    'a candidate the sync scheduler auto-validated on its own must be tagged auto_sync, never indistinguishable from an explicit prepare',
  );
  assert.equal(githubAhead.result.candidateSource, 'auto_sync');

  const dirty = await withFixture('local-ahead', { dirty: true });
  assert.equal(dirty.result.state, 'dirty');
  assert.ok(!dirty.calls.some((call) => /^git (push|merge) /.test(call)));

  const untracked = await withFixture('equal', { untracked: true });
  assert.equal(untracked.result.state, 'dirty');

  const diverged = await withFixture('diverged');
  assert.equal(diverged.result.state, 'diverged');
  assert.ok(!diverged.calls.some((call) => /^git (push|merge) /.test(call)));

  const contention = await withFixture('equal', { holdLock: true });
  assert.equal(contention.result.state, 'retrying');
  assert.deepEqual(contention.calls, []);

  const invalidCredentials = await withFixture('equal', { missingKey: true });
  assert.equal(invalidCredentials.result.state, 'failed');
  assert.match(invalidCredentials.result.error || '', /HOLAHOLA_GITHUB_APP_ID/);

  const production = new SourceControlService({
    rootDir: process.cwd(),
    env: { NODE_ENV: 'production' },
  });
  assert.equal((await production.sync('fixture')).state, 'disabled');

  const replitOnlyPublication = await recordPublicationMarkerFixture({
    publicationReference: `replit-publish:${LOCAL_NEW}:${PUBLICATION_MARKER}`,
  });
  assert.equal(replitOnlyPublication.result.ok, false);
  assert.match(replitOnlyPublication.result.error || '', /requires verified Render release evidence/);
  assert.equal(replitOnlyPublication.recorded.length, 0, 'Replit hosting must never append production authority');
  assert.equal(replitOnlyPublication.receipt, undefined);
  assert.equal(replitOnlyPublication.renderEvidenceCalls, 0);

  for (const failureAt of [1, 2]) {
    const markerWithoutLiveRender = await recordPublicationMarkerFixture({
      renderEvidenceFailureAt: failureAt,
    });
    assert.equal(markerWithoutLiveRender.result.ok, false);
    assert.equal(markerWithoutLiveRender.recorded.length, 0, 'even a verified marker cannot bypass either live Render check');
    assert.equal(markerWithoutLiveRender.renderEvidenceCalls, failureAt);
  }

  const markerRecovery = await recordPublicationMarkerFixture();
  assert.equal(markerRecovery.renderEvidenceCalls, 2);
  assert.deepEqual(markerRecovery.receipt?.renderReleaseEvidence, VALID_RENDER_EVIDENCE);
  assert.equal(markerRecovery.result.state, 'synced');
  assert.equal(markerRecovery.result.candidateSha, LOCAL_NEW);
  assert.equal(markerRecovery.recorded.length, 1);
  assert.equal(markerRecovery.recorded[0].promotedCommitSha, LOCAL_NEW);
  assert.equal(markerRecovery.recorded[0].exactTreeSha, CANDIDATE_TREE);
  assert.equal(markerRecovery.recorded[0].publishTriggerSha, PUBLICATION_MARKER);
  assert.deepEqual(markerRecovery.receipt?.publicationMarker, {
    sha: PUBLICATION_MARKER,
    treeSha: CANDIDATE_TREE,
    parentSha: LOCAL_NEW,
    subject: 'Published your App',
  });
  assert.equal(markerRecovery.receipt?.repositoryIdentity, 'github:davidwmcintosh/holahola');
  const expectedMarkerCanonicalDigest = createHash('sha256').update(JSON.stringify({
    repositoryIdentity: 'github:davidwmcintosh/holahola',
    promotedCommitSha: LOCAL_NEW,
    exactTreeSha: CANDIDATE_TREE,
    publicationReference: `render-release:${LOCAL_NEW}:${SOURCE_CONTEXT_SHA256}`,
    protectedValidationId: manifest(LOCAL_NEW).validationId,
    publishTriggerSha: PUBLICATION_MARKER,
    publicationMarker: {
      sha: PUBLICATION_MARKER,
      treeSha: CANDIDATE_TREE,
      parentSha: LOCAL_NEW,
      subject: 'Published your App',
    },
    renderReleaseEvidence: VALID_RENDER_EVIDENCE,
  })).digest('hex');
  assert.equal(markerRecovery.recorded[0].canonicalRecordDigest, expectedMarkerCanonicalDigest);

  const pushedMarkerRecovery = await recordPublicationMarkerFixture({
    remoteHead: PUBLICATION_MARKER,
    finalRemoteHead: PUBLICATION_MARKER,
  });
  assert.equal(pushedMarkerRecovery.result.state, 'synced');
  assert.equal(pushedMarkerRecovery.recorded.length, 1);
  assert.equal(pushedMarkerRecovery.recorded[0].promotedCommitSha, LOCAL_NEW);
  assert.equal(pushedMarkerRecovery.recorded[0].publishTriggerSha, PUBLICATION_MARKER);
  assert.deepEqual(pushedMarkerRecovery.receipt?.remotePublicationMarker, {
    sha: PUBLICATION_MARKER,
    treeSha: CANDIDATE_TREE,
    parentSha: LOCAL_NEW,
    subject: 'Published your App',
  });
  const expectedPushedMarkerCanonicalDigest = createHash('sha256').update(JSON.stringify({
    repositoryIdentity: 'github:davidwmcintosh/holahola',
    promotedCommitSha: LOCAL_NEW,
    exactTreeSha: CANDIDATE_TREE,
    publicationReference: `render-release:${LOCAL_NEW}:${SOURCE_CONTEXT_SHA256}`,
    protectedValidationId: manifest(LOCAL_NEW).validationId,
    publishTriggerSha: PUBLICATION_MARKER,
    publicationMarker: {
      sha: PUBLICATION_MARKER,
      treeSha: CANDIDATE_TREE,
      parentSha: LOCAL_NEW,
      subject: 'Published your App',
    },
    remotePublicationMarker: {
      sha: PUBLICATION_MARKER,
      treeSha: CANDIDATE_TREE,
      parentSha: LOCAL_NEW,
      subject: 'Published your App',
    },
    renderReleaseEvidence: VALID_RENDER_EVIDENCE,
  })).digest('hex');
  assert.equal(
    pushedMarkerRecovery.recorded[0].canonicalRecordDigest,
    expectedPushedMarkerCanonicalDigest,
  );

  const remoteOnlyMarkerRecovery = await recordPublicationMarkerFixture({
    localHead: LOCAL_NEW,
    finalLocalHead: LOCAL_NEW,
    remoteHead: PUBLICATION_MARKER,
    finalRemoteHead: PUBLICATION_MARKER,
  });
  assert.equal(remoteOnlyMarkerRecovery.result.state, 'synced');
  assert.equal(remoteOnlyMarkerRecovery.recorded.length, 1);
  assert.equal(remoteOnlyMarkerRecovery.recorded[0].promotedCommitSha, LOCAL_NEW);
  assert.equal(remoteOnlyMarkerRecovery.recorded[0].publishTriggerSha, PUBLICATION_MARKER);

  const exactHead = await recordPublicationMarkerFixture({
    localHead: LOCAL_NEW,
    markerSha: LOCAL_NEW,
    publicationReference: `render-release:${LOCAL_NEW}:${SOURCE_CONTEXT_SHA256}`,
  });
  assert.equal(exactHead.result.state, 'synced');
  assert.equal(exactHead.recorded.length, 1);
  assert.equal(exactHead.recorded[0].promotedCommitSha, LOCAL_NEW);
  assert.equal(exactHead.recorded[0].publishTriggerSha, undefined);
  assert.equal(exactHead.receipt?.publicationMarker, undefined);
  assert.deepEqual(exactHead.receipt?.renderReleaseEvidence, VALID_RENDER_EVIDENCE);
  assert.equal(exactHead.renderEvidenceCalls, 2);

  const changedRenderEvidence = await recordPublicationMarkerFixture({
    localHead: LOCAL_NEW,
    markerSha: LOCAL_NEW,
    publicationReference: `render-release:${LOCAL_NEW}:${SOURCE_CONTEXT_SHA256}`,
    finalRenderEvidence: { ...VALID_RENDER_EVIDENCE, sourceFileCount: 322 },
  });
  assert.equal(changedRenderEvidence.result.state, 'failed');
  assert.equal(changedRenderEvidence.recorded.length, 0);
  assert.equal(changedRenderEvidence.renderEvidenceCalls, 2);

  const failedFinalRenderEvidence = await recordPublicationMarkerFixture({
    localHead: LOCAL_NEW,
    markerSha: LOCAL_NEW,
    publicationReference: `render-release:${LOCAL_NEW}:${SOURCE_CONTEXT_SHA256}`,
    renderEvidenceFailureAt: 2,
  });
  assert.equal(failedFinalRenderEvidence.result.state, 'failed');
  assert.equal(failedFinalRenderEvidence.recorded.length, 0);
  assert.equal(failedFinalRenderEvidence.renderEvidenceCalls, 2);

  const arbitraryExactHead = await recordPublicationMarkerFixture({
    localHead: LOCAL_NEW,
    markerSha: LOCAL_NEW,
    publicationReference: 'protected-publication-reference',
  });
  assert.equal(arbitraryExactHead.result.state, 'failed');
  assert.equal(arbitraryExactHead.recorded.length, 0);

  const validReleaseDocument = {
    ...VALID_RENDER_EVIDENCE,
    commitSource: 'render-build',
  };
  assert.deepEqual(
    validateRenderReleaseEvidence(validReleaseDocument, LOCAL_NEW, SOURCE_CONTEXT_SHA256),
    VALID_RENDER_EVIDENCE,
  );
  for (const invalidReleaseDocument of [
    { ...validReleaseDocument, authority: 'development', promotable: false },
    { ...validReleaseDocument, commitSha: LOCAL_OLD },
    { ...validReleaseDocument, sourceContextSha256: 'd'.repeat(64) },
    { ...validReleaseDocument, sourceContextAlgorithm: 'sha256(other)' },
    { ...validReleaseDocument, sourceFileCount: 0 },
  ]) {
    assert.throws(() => validateRenderReleaseEvidence(
      invalidReleaseDocument,
      LOCAL_NEW,
      SOURCE_CONTEXT_SHA256,
    ));
  }
  const releaseHealthEnv = {
    SOURCE_RELEASE_HEALTH_URL: 'https://getholahola.com/health/release',
  };
  const fetchCalls: Array<{ url: string; redirect: RequestRedirect | undefined }> = [];
  const resolvedReleaseEvidence = await resolveRenderReleaseEvidenceFromHealth(
    releaseHealthEnv,
    LOCAL_NEW,
    SOURCE_CONTEXT_SHA256,
    (async (input, init) => {
      fetchCalls.push({ url: String(input), redirect: init?.redirect });
      return new Response(JSON.stringify(validReleaseDocument), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch,
  );
  assert.deepEqual(resolvedReleaseEvidence, VALID_RENDER_EVIDENCE);
  assert.deepEqual(fetchCalls, [{
    url: 'https://getholahola.com/health/release',
    redirect: 'manual',
  }]);
  for (const invalidUrl of [
    undefined,
    'http://getholahola.com/health/release',
    'https://user:password@getholahola.com/health/release',
    'https://getholahola.com/health/release?candidate=1',
    'https://getholahola.com/other',
  ]) {
    await assert.rejects(resolveRenderReleaseEvidenceFromHealth(
      { SOURCE_RELEASE_HEALTH_URL: invalidUrl },
      LOCAL_NEW,
      SOURCE_CONTEXT_SHA256,
      (async () => { throw new Error('fetch_must_not_run'); }) as typeof fetch,
    ));
  }
  await assert.rejects(resolveRenderReleaseEvidenceFromHealth(
    releaseHealthEnv,
    LOCAL_NEW,
    SOURCE_CONTEXT_SHA256,
    (async () => new Response('{}', { status: 503 })) as typeof fetch,
  ));
  await assert.rejects(resolveRenderReleaseEvidenceFromHealth(
    releaseHealthEnv,
    LOCAL_NEW,
    SOURCE_CONTEXT_SHA256,
    (async () => new Response('', {
      status: 302,
      headers: { location: 'https://example.invalid/health/release' },
    })) as typeof fetch,
  ));
  await assert.rejects(resolveRenderReleaseEvidenceFromHealth(
    releaseHealthEnv,
    LOCAL_NEW,
    SOURCE_CONTEXT_SHA256,
    (async () => new Response('x'.repeat(65 * 1024), { status: 200 })) as typeof fetch,
  ));
  await assert.rejects(resolveRenderReleaseEvidenceFromHealth(
    releaseHealthEnv,
    LOCAL_NEW,
    SOURCE_CONTEXT_SHA256,
    (async () => new Response('{', { status: 200 })) as typeof fetch,
  ));
  await assert.rejects(resolveRenderReleaseEvidenceFromHealth(
    releaseHealthEnv,
    LOCAL_NEW,
    SOURCE_CONTEXT_SHA256,
    (async () => new Response(JSON.stringify({
      ...validReleaseDocument,
      commitSha: LOCAL_OLD,
    }), { status: 200 })) as typeof fetch,
  ));

  for (const invalidMarker of [
    { markerTree: '6'.repeat(40) },
    { markerParents: LOCAL_OLD },
    { markerParents: `${LOCAL_NEW} ${LOCAL_OLD}` },
    { markerSubject: 'Published another App' },
    { publicationReference: `replit-publish:${LOCAL_NEW}` },
    { publicationReference: `prefix:replit-publish:${LOCAL_NEW}:${PUBLICATION_MARKER}` },
    { publicationReference: `replit-publish:${PUBLICATION_MARKER}:${LOCAL_NEW}` },
    { finalLocalHead: '7'.repeat(40) },
    { finalRemoteHead: '7'.repeat(40) },
    { finalDirty: true },
    { finalMarkerResolvedSha: '7'.repeat(40) },
    { finalMarkerTree: '7'.repeat(40) },
    { finalMarkerParents: LOCAL_OLD },
    { finalMarkerSubject: 'Published another App' },
    { finalConfiguredRemote: 'git@github.com:attacker/holahola.git' },
  ]) {
    const rejected = await recordPublicationMarkerFixture(invalidMarker);
    assert.equal(rejected.result.state, 'failed');
    assert.equal(rejected.recorded.length, 0);
  }

  const splitMarkers = await recordPublicationMarkerFixture({
    remoteHead: '9'.repeat(40),
    finalRemoteHead: '9'.repeat(40),
  });
  assert.equal(splitMarkers.result.state, 'failed');
  assert.equal(splitMarkers.recorded.length, 0);

  for (const invalidPushedMarker of [
    { remoteMarkerResolvedSha: '8'.repeat(40) },
    { remoteMarkerTree: '6'.repeat(40) },
    { remoteMarkerParent: LOCAL_OLD },
    { finalRemoteMarkerResolvedSha: '8'.repeat(40) },
    { finalRemoteMarkerTree: '6'.repeat(40) },
    { finalRemoteMarkerParent: LOCAL_OLD },
  ]) {
    const rejected = await recordPublicationMarkerFixture({
      remoteHead: PUBLICATION_MARKER,
      finalRemoteHead: PUBLICATION_MARKER,
      ...invalidPushedMarker,
    });
    assert.equal(rejected.result.state, 'failed');
    assert.equal(rejected.recorded.length, 0);
  }

  const pushedMarkerHeadDrift = await recordPublicationMarkerFixture({
    remoteHead: PUBLICATION_MARKER,
    finalRemoteHead: LOCAL_NEW,
  });
  assert.equal(pushedMarkerHeadDrift.result.state, 'failed');
  assert.equal(pushedMarkerHeadDrift.recorded.length, 0);

  // A publish-then-scheduler race: Replit Publish creates an authenticated
  // same-tree "Published your App" marker over the still-unexpired validated
  // candidate. The scheduler's next sync must recognize the marker and
  // preserve `ready_to_promote` instead of downgrading to `synced`.
  const syncMarkerReadiness = await syncPublicationMarkerFailClosedFixture();
  assert.equal(syncMarkerReadiness.result.state, 'ready_to_promote');
  assert.equal(syncMarkerReadiness.result.candidateSha, LOCAL_NEW);
  assert.equal(syncMarkerReadiness.status.state, 'ready_to_promote');
  assert.equal(syncMarkerReadiness.status.candidateSha, LOCAL_NEW);
  assert.notEqual(syncMarkerReadiness.status.candidateSha, PUBLICATION_MARKER);
  assert.equal(syncMarkerReadiness.status.replitSha, PUBLICATION_MARKER);
  assert.equal(syncMarkerReadiness.status.githubSha, PUBLICATION_MARKER);
  assert.equal(syncMarkerReadiness.status.candidatePreparedAt, '2026-09-15T20:00:00.000Z');
  assert.equal(syncMarkerReadiness.status.candidateExpiresAt, '2026-09-15T22:00:00.000Z');
  assert.deepEqual(syncMarkerReadiness.status.validation, manifest(LOCAL_NEW));

  // Full lifecycle: prepare -> publish creates a marker -> scheduler sync
  // preserves readiness -> the operator's record call succeeds using the
  // original candidate. This reproduces the publish-then-scheduler race and
  // proves the operator is no longer blocked from recording a valid publish.
  const syncThenRecord = await syncThenRecordPublicationMarkerFixture();
  assert.equal(syncThenRecord.syncResult.state, 'ready_to_promote');
  assert.equal(syncThenRecord.syncResult.candidateSha, LOCAL_NEW);
  assert.equal(syncThenRecord.statusAfterSync.state, 'ready_to_promote');
  assert.equal(syncThenRecord.statusAfterSync.candidateSha, LOCAL_NEW);
  assert.equal(syncThenRecord.recordResult.state, 'synced');
  assert.equal(syncThenRecord.recordResult.ok, true);
  assert.equal(syncThenRecord.recorded.length, 1);
  assert.equal(syncThenRecord.recorded[0].promotedCommitSha, LOCAL_NEW);
  assert.equal(syncThenRecord.recorded[0].publishTriggerSha, PUBLICATION_MARKER);
  assert.equal(syncThenRecord.statusAfterRecord.state, 'synced');
  assert.equal(syncThenRecord.statusAfterRecord.promotedSha, LOCAL_NEW);
  // A completed promotion must stay completed. The same publication marker
  // is still the head on the next scheduler tick, but the candidate it
  // points at has already been recorded -- recognizing the marker again
  // must not re-arm ready_to_promote and must not allow a second append.
  assert.equal(syncThenRecord.syncAfterRecordResult.state, 'synced');
  assert.equal(syncThenRecord.statusAfterSyncAfterRecord.state, 'synced');
  assert.equal(syncThenRecord.statusAfterSyncAfterRecord.candidateSha, LOCAL_NEW);
  assert.equal(syncThenRecord.statusAfterSyncAfterRecord.promotedSha, LOCAL_NEW);
  assert.equal(syncThenRecord.recordAfterSyncResult.ok, false);
  assert.equal(syncThenRecord.recordAfterSyncResult.state, 'failed');
  assert.equal(syncThenRecord.recorded.length, 1);

  // Every fail-closed variant must still land on `synced` (never
  // `ready_to_promote`) and must never extend the original candidate window.
  const syncMarkerRejections: Array<[string, SyncMarkerFixtureOverrides]> = [
    ['no parents (malformed marker)', { markerLocalParents: '' }],
    ['two parents (malformed marker)', { markerLocalParents: `${LOCAL_NEW} ${LOCAL_OLD}` }],
    ['wrong parent', { markerLocalParents: LOCAL_OLD }],
    ['wrong local tree', { markerLocalTree: '6'.repeat(40) }],
    ['wrong subject', { markerLocalSubject: 'Published another App' }],
    ['candidate remote sha mismatch', { candidateRemoteSha: '7'.repeat(40) }],
    ['candidate remote tree mismatch (marker tree now orphaned)', { candidateRemoteTree: '8'.repeat(40) }],
    ['marker remote sha mismatch', { markerRemoteSha: '9'.repeat(40) }],
    ['marker remote tree mismatch', { markerRemoteTree: '6'.repeat(40) }],
    ['marker remote parent mismatch', { markerRemoteParent: LOCAL_OLD }],
    ['expired candidate', { candidateExpiresAt: '2020-01-01T00:00:00.000Z' }],
    ['broken validation manifest', { brokenValidation: true }],
  ];
  for (const [label, overrides] of syncMarkerRejections) {
    const rejected = await syncPublicationMarkerFailClosedFixture(overrides);
    assert.equal(rejected.result.state, 'synced', `expected synced for: ${label}`);
    assert.equal(rejected.status.state, 'synced', `expected synced status for: ${label}`);
    assert.equal(
      rejected.status.candidateExpiresAt,
      overrides.candidateExpiresAt ?? '2026-09-15T22:00:00.000Z',
      `must not extend candidate expiry for: ${label}`,
    );
  }

  // A dirty tree short-circuits before the marker is ever inspected.
  const syncMarkerDirty = await syncPublicationMarkerFailClosedFixture({ dirty: true });
  assert.equal(syncMarkerDirty.result.state, 'dirty');
  assert.equal(syncMarkerDirty.status.state, 'dirty');
  assert.notEqual(syncMarkerDirty.status.state, 'ready_to_promote');

  const snapshotCalls: Array<{ sha: string; fixedPaths: readonly string[] }> = [];
  let resolverBlobs: Record<string, Buffer> = {};
  const snapshotService = new SourceControlService({
    rootDir: mkdtempSync(join(tmpdir(), 'source-control-snapshot-no-git-')),
    env: {
      NODE_ENV: 'production',
      GITHUB_REPO_URL: 'https://github.com/davidwmcintosh/holahola.git',
    },
    resolveRemoteSnapshot: async (sha, fixedPaths) => {
      snapshotCalls.push({ sha, fixedPaths });
      resolverBlobs = Object.fromEntries(fixedPaths.map((path) => [path, Buffer.from(path)]));
      return {
        sha,
        treeSha: '4'.repeat(40),
        blobs: resolverBlobs,
      };
    },
  });
  const snapshotPaths = [
    'scripts/hola-coordinator.ps1',
    'package-lock.json',
    'server/scripts/coordination-v2-cli.ts',
  ];
  const snapshot = await snapshotService.resolveProtectedRemoteSnapshot({
    sha: LOCAL_NEW,
    repositoryIdentity: 'github:davidwmcintosh/holahola',
    fixedPaths: snapshotPaths,
  });
  assert.equal(snapshot.sha, LOCAL_NEW);
  assert.equal(snapshot.treeSha, '4'.repeat(40));
  assert.deepEqual(snapshotCalls, [{
    sha: LOCAL_NEW,
    fixedPaths: [...snapshotPaths].sort(),
  }]);
  assert.deepEqual(Object.keys(snapshot.blobs), [...snapshotPaths].sort());
  snapshot.blobs['package-lock.json'][0] = 0;
  assert.equal(resolverBlobs['package-lock.json'].toString('utf8'), 'package-lock.json');
  assert.equal(snapshotCalls.length, 1, 'returned buffers must not alter resolver state');

  await assert.rejects(() => snapshotService.resolveProtectedRemoteSnapshot({
    sha: LOCAL_NEW,
    repositoryIdentity: 'github.com/attacker/repository',
    fixedPaths: snapshotPaths,
  }), /protected_remote_snapshot_request_invalid/);
  for (const badPath of [
    '../package-lock.json',
    '/package-lock.json',
    'scripts\\hola-coordinator.ps1',
    'scripts/hola:coordinator.ps1',
    'scripts//hola-coordinator.ps1',
  ]) {
    await assert.rejects(() => snapshotService.resolveProtectedRemoteSnapshot({
      sha: LOCAL_NEW,
      repositoryIdentity: 'github:davidwmcintosh/holahola',
      fixedPaths: [badPath],
    }), /protected_remote_snapshot_request_invalid/);
  }
  const wrongShaService = new SourceControlService({
    env: { GITHUB_REPO_URL: 'https://github.com/davidwmcintosh/holahola.git' },
    resolveRemoteSnapshot: async (_sha, fixedPaths) => ({
      sha: REMOTE_NEW,
      treeSha: '4'.repeat(40),
      blobs: Object.fromEntries(fixedPaths.map((path) => [path, Buffer.from(path)])),
    }),
  });
  await assert.rejects(() => wrongShaService.resolveProtectedRemoteSnapshot({
    sha: LOCAL_NEW,
    repositoryIdentity: 'github:davidwmcintosh/holahola',
    fixedPaths: snapshotPaths,
  }), /remote_commit_proof_mismatch/);
  const shiftedPathsService = new SourceControlService({
    env: { GITHUB_REPO_URL: 'https://github.com/davidwmcintosh/holahola.git' },
    resolveRemoteSnapshot: async (sha) => ({
      sha,
      treeSha: '4'.repeat(40),
      blobs: { 'package-lock.json': Buffer.from('{}'), 'extra.txt': Buffer.from('extra') },
    }),
  });
  await assert.rejects(() => shiftedPathsService.resolveProtectedRemoteSnapshot({
    sha: LOCAL_NEW,
    repositoryIdentity: 'github:davidwmcintosh/holahola',
    fixedPaths: snapshotPaths,
  }), /protected_remote_snapshot_paths_mismatch/);
  const sshService = new SourceControlService({
    env: { GITHUB_REPO_URL: 'git@github.com:davidwmcintosh/holahola.git' },
    resolveRemoteSnapshot: async () => {
      throw new Error('SSH transport must be rejected before resolver use');
    },
  });
  await assert.rejects(() => sshService.resolveProtectedRemoteSnapshot({
    sha: LOCAL_NEW,
    repositoryIdentity: 'github:davidwmcintosh/holahola',
    fixedPaths: snapshotPaths,
  }), /protected_remote_snapshot_request_invalid/);

  const gitFixture = mkdtempSync(join(tmpdir(), 'protected-snapshot-git-test-'));
  const sourceRepo = join(gitFixture, 'source');
  const snapshotParent = join(gitFixture, 'snapshots');
  mkdirSync(sourceRepo);
  mkdirSync(snapshotParent);
  const git = (args: string[], cwd = sourceRepo, maxBuffer = 4 * 1024 * 1024): Buffer =>
    Buffer.from(execFileSync('git', args, { cwd, encoding: 'buffer', maxBuffer }));
  try {
    git(['init']);
    git(['config', 'user.name', 'Snapshot Fixture']);
    git(['config', 'user.email', 'snapshot-fixture@example.invalid']);
    mkdirSync(join(sourceRepo, 'nested'));
    const binary = Buffer.from([0x00, 0xff, 0x80, 0x0d, 0x0a, 0x41]);
    writeFileSync(join(sourceRepo, 'nested', 'binary.dat'), binary);
    writeFileSync(join(sourceRepo, 'source.txt'), 'exact source\n');
    git(['add', '--', 'nested/binary.dat', 'source.txt']);
    git(['commit', '-m', 'fixture']);
    const sha = git(['rev-parse', 'HEAD']).toString('utf8').trim();
    const treeSha = git(['rev-parse', 'HEAD^{tree}']).toString('utf8').trim();
    const before = readdirSync(snapshotParent);
    const materialized = await materializeProtectedGitSnapshot({
      repoUrl: sourceRepo,
      sha,
      fixedPaths: ['source.txt', 'nested/binary.dat'],
      tempParent: snapshotParent,
      runGit: async (args, cwd, maxBuffer) => git(args, cwd, maxBuffer),
    });
    assert.equal(materialized.sha, sha);
    assert.equal(materialized.treeSha, treeSha);
    assert.deepEqual(materialized.blobs['nested/binary.dat'], binary);
    assert.equal(materialized.blobs['source.txt'].toString('utf8'), 'exact source\n');
    assert.deepEqual(readdirSync(snapshotParent), before, 'success must remove the bare snapshot');
    await assert.rejects(() => materializeProtectedGitSnapshot({
      repoUrl: sourceRepo,
      sha,
      fixedPaths: ['missing.txt'],
      tempParent: snapshotParent,
      runGit: async (args, cwd, maxBuffer) => git(args, cwd, maxBuffer),
    }));
    assert.deepEqual(readdirSync(snapshotParent), before, 'post-fetch failure must remove the bare snapshot');
  } finally {
    rmSync(gitFixture, { recursive: true, force: true });
  }

  // --- Stalled-sync alerting (Task #1625) -----------------------------
  // A ~2.5-day, 120-consecutive-failure 'diverged' outage ran unnoticed
  // because nothing but a human reading .local/source-bridge-status.json
  // could see it. These prove: the pure threshold decision, that an alert
  // actually fires through the injected hook once a real stall crosses it,
  // that it does not fire for the "clears within a poll or two" noise this
  // must ignore, that it does not repeat-fire while still stalled, that it
  // resets on recovery so a *future* stall can alert again, and that the
  // scheduler-level checkStalled() backstop works independently of
  // writeStatus for a wedged sync.

  // Pure threshold resolution and decision function -- no fixture needed.
  const defaultThresholds = resolveSourceControlStallThresholds({} as NodeJS.ProcessEnv);
  assert.equal(defaultThresholds.consecutiveFailureThreshold, 6);
  assert.equal(defaultThresholds.staleSuccessAgeMs, 3 * 60 * 60 * 1000);
  const overriddenThresholds = resolveSourceControlStallThresholds({
    SOURCE_CONTROL_STALL_FAILURE_THRESHOLD: '3',
    SOURCE_CONTROL_STALL_AGE_MS: '60000',
  } as NodeJS.ProcessEnv);
  assert.equal(overriddenThresholds.consecutiveFailureThreshold, 3);
  assert.equal(overriddenThresholds.staleSuccessAgeMs, 60000);
  const invalidThresholds = resolveSourceControlStallThresholds({
    SOURCE_CONTROL_STALL_FAILURE_THRESHOLD: '0',
    SOURCE_CONTROL_STALL_AGE_MS: '-5',
  } as NodeJS.ProcessEnv);
  assert.equal(invalidThresholds.consecutiveFailureThreshold, 6, 'non-positive override must fall back to the default');
  assert.equal(invalidThresholds.staleSuccessAgeMs, 3 * 60 * 60 * 1000, 'non-positive override must fall back to the default');

  const stallThresholds = { consecutiveFailureThreshold: 6, staleSuccessAgeMs: 3 * 60 * 60 * 1000 };
  const stallNowMs = Date.parse('2026-09-24T00:00:00.000Z');
  assert.equal(
    isSourceControlSyncStalled({ consecutiveFailures: 0, lastSuccessfulSyncAt: undefined }, stallThresholds, stallNowMs),
    false,
    'no failures yet and no prior success recorded must not read as stalled',
  );
  assert.equal(
    isSourceControlSyncStalled({ consecutiveFailures: 2, lastSuccessfulSyncAt: new Date(stallNowMs).toISOString() }, stallThresholds, stallNowMs),
    false,
    'a couple of failures with a fresh last success is the "clears within a poll or two" case that must stay quiet',
  );
  assert.equal(
    isSourceControlSyncStalled({ consecutiveFailures: 6, lastSuccessfulSyncAt: new Date(stallNowMs).toISOString() }, stallThresholds, stallNowMs),
    true,
    'crossing the failure-count threshold must read as stalled even with a recent success on record',
  );
  assert.equal(
    isSourceControlSyncStalled(
      { consecutiveFailures: 1, lastSuccessfulSyncAt: new Date(stallNowMs - 4 * 60 * 60 * 1000).toISOString() },
      stallThresholds,
      stallNowMs,
    ),
    true,
    'a last success older than the stale-age threshold must read as stalled even with few consecutive failures',
  );
  assert.equal(
    isSourceControlSyncStalled(
      { consecutiveFailures: 1, lastSuccessfulSyncAt: new Date(stallNowMs - 60 * 60 * 1000).toISOString() },
      stallThresholds,
      stallNowMs,
    ),
    false,
    'a recent-enough success with few failures must not read as stalled',
  );
  assert.equal(
    isSourceControlSyncStalled({ consecutiveFailures: 1, lastSuccessfulSyncAt: 'not-a-real-date' }, stallThresholds, stallNowMs),
    false,
    'an unparseable timestamp must fail closed to "not stalled" rather than throw or read as infinitely stale',
  );

  // Alert fires once a genuine stall crosses the failure-count threshold,
  // and not before -- using a low threshold (3) so the fixture does not
  // need dozens of sync() calls to prove it.
  {
    const alerts: StalledSyncAlertContext[] = [];
    const fixture = await withRepeatableFixture('local-ahead', {
      dirty: true,
      notifyStalledSync: async (context) => {
        alerts.push(context);
        return { teamRoomDelivered: true, founderInboxDelivered: true };
      },
      extraEnv: { SOURCE_CONTROL_STALL_FAILURE_THRESHOLD: '3' } as NodeJS.ProcessEnv,
    });
    try {
      const first = await fixture.service.sync('fixture');
      assert.equal(first.state, 'dirty');
      assert.equal(alerts.length, 0, 'a single dirty poll must not alert');
      const second = await fixture.service.sync('fixture');
      assert.equal(second.state, 'dirty');
      assert.equal(alerts.length, 0, 'two consecutive dirty polls (below threshold) must not alert -- the "poll or two" case');
      const third = await fixture.service.sync('fixture');
      assert.equal(third.state, 'dirty');
      assert.equal(alerts.length, 1, 'crossing the threshold on the third consecutive failure must alert exactly once');
      assert.equal(alerts[0].consecutiveFailures, 3);
      assert.equal(fixture.readStatus().stalledSyncAlertActive, true);
      assert.ok(fixture.readStatus().stalledSyncAlertTeamRoomDeliveredAt, 'confirmed Team Room delivery must be persisted too');

      // Must not repeat-fire while still stalled.
      const fourth = await fixture.service.sync('fixture');
      assert.equal(fourth.state, 'dirty');
      const fifth = await fixture.service.sync('fixture');
      assert.equal(fifth.state, 'dirty');
      assert.equal(alerts.length, 1, 'continuing to fail after the alert fired must not spam another notification');

      // Recovery clears the flag, so a *future* stall can alert again.
      fixture.runOptions.dirty = false;
      const recovered = await fixture.service.sync('fixture');
      assert.equal(recovered.state, 'synced');
      const recoveredStatus = fixture.readStatus();
      assert.equal(recoveredStatus.consecutiveFailures, 0);
      assert.equal(recoveredStatus.stalledSyncAlertActive, false);
      assert.equal(recoveredStatus.stalledSyncAlertSentAt, undefined);
      assert.equal(recoveredStatus.stalledSyncAlertTeamRoomDeliveredAt, undefined);
      assert.equal(alerts.length, 1, 'recovering must not itself fire a notification');

      // A fresh stall after recovery must be able to alert again.
      fixture.runOptions.dirty = true;
      await fixture.service.sync('fixture');
      await fixture.service.sync('fixture');
      assert.equal(alerts.length, 1, 'still below threshold on the new streak must stay quiet');
      await fixture.service.sync('fixture');
      assert.equal(alerts.length, 2, 'a second stall episode after a recovery must be able to alert again');
    } finally {
      fixture.cleanup();
    }
  }

  // Reviewer-required regression coverage: a delivery failure at the exact
  // moment the threshold is first crossed must not permanently suppress
  // the alert. The old design set stalledSyncAlertActive as soon as an
  // attempt was *made*, so a DB outage at the crossing moment meant the
  // founder inbox would never receive the alert for the rest of the
  // episode, even after the DB recovered. This proves the fix: the flag
  // is only set from a CONFIRMED result, and an unconfirmed episode keeps
  // retrying on every subsequent poll until delivery actually succeeds.
  {
    const attempts: StalledSyncAlertContext[] = [];
    let shouldDeliver = false;
    const fixture = await withRepeatableFixture('local-ahead', {
      dirty: true,
      notifyStalledSync: async (context) => {
        attempts.push(context);
        return shouldDeliver
          ? { teamRoomDelivered: true, founderInboxDelivered: true }
          : { teamRoomDelivered: false, founderInboxDelivered: false };
      },
      extraEnv: { SOURCE_CONTROL_STALL_FAILURE_THRESHOLD: '3' } as NodeJS.ProcessEnv,
    });
    try {
      await fixture.service.sync('fixture');
      await fixture.service.sync('fixture');
      const third = await fixture.service.sync('fixture');
      assert.equal(third.state, 'dirty');
      assert.equal(attempts.length, 1, 'crossing the threshold must attempt delivery even though it will fail');
      assert.equal(
        fixture.readStatus().stalledSyncAlertActive,
        false,
        'a failed delivery attempt must NOT be persisted as delivered -- this is the exact bug the reviewer flagged',
      );
      assert.equal(fixture.readStatus().stalledSyncAlertTeamRoomDeliveredAt, undefined);

      // The stall continues (still dirty) for another poll, still failing.
      const fourth = await fixture.service.sync('fixture');
      assert.equal(fourth.state, 'dirty');
      assert.equal(attempts.length, 2, 'an unconfirmed alert must retry on the next poll rather than being given up on');
      assert.equal(fixture.readStatus().stalledSyncAlertActive, false);

      // The channel recovers (e.g. the database comes back) while the
      // stall is still ongoing.
      shouldDeliver = true;
      const fifth = await fixture.service.sync('fixture');
      assert.equal(fifth.state, 'dirty');
      assert.equal(attempts.length, 3, 'recovery must be retried and observed on the very next poll');
      const recoveredDeliveryStatus = fixture.readStatus();
      assert.equal(
        recoveredDeliveryStatus.stalledSyncAlertActive,
        true,
        'once delivery is confirmed, the founder inbox must actually be marked as having received the alert',
      );
      assert.ok(recoveredDeliveryStatus.stalledSyncAlertSentAt, 'a confirmed delivery must record when it was confirmed');

      // Now that it is confirmed, continuing to fail must not re-attempt --
      // flipping shouldDeliver back to false here would have no effect if
      // a bug caused a spurious re-attempt, so this only passes if the
      // confirmed flag is truly respected.
      shouldDeliver = false;
      const sixth = await fixture.service.sync('fixture');
      assert.equal(sixth.state, 'dirty');
      assert.equal(attempts.length, 3, 'once confirmed delivered, further polls must not re-attempt at all');
    } finally {
      fixture.cleanup();
    }
  }

  // Partial-channel failure: Team Room succeeds immediately but the
  // founder inbox (database) fails, then later recovers. The
  // already-confirmed Team Room channel must never be re-attempted while
  // the outstanding founder-inbox channel keeps retrying -- proving a
  // lagging channel cannot cause a duplicate post to a channel that
  // already succeeded.
  {
    const calls: Array<{ context: StalledSyncAlertContext; already: StalledSyncAlertDeliveryResult }> = [];
    let founderInboxUp = false;
    const fixture = await withRepeatableFixture('local-ahead', {
      dirty: true,
      notifyStalledSync: async (context, already) => {
        calls.push({ context, already });
        return { teamRoomDelivered: true, founderInboxDelivered: founderInboxUp };
      },
      extraEnv: { SOURCE_CONTROL_STALL_FAILURE_THRESHOLD: '3' } as NodeJS.ProcessEnv,
    });
    try {
      await fixture.service.sync('fixture');
      await fixture.service.sync('fixture');
      await fixture.service.sync('fixture'); // crosses threshold: Team Room succeeds, founder inbox fails
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0].already, { teamRoomDelivered: false, founderInboxDelivered: false });
      let status = fixture.readStatus();
      assert.ok(status.stalledSyncAlertTeamRoomDeliveredAt, 'Team Room success must be persisted even though founder inbox failed');
      assert.equal(status.stalledSyncAlertActive, false, 'founder inbox must still show undelivered');

      await fixture.service.sync('fixture'); // still failing overall, retry
      assert.equal(calls.length, 2);
      assert.deepEqual(
        calls[1].already,
        { teamRoomDelivered: true, founderInboxDelivered: false },
        'a retry must tell the dispatcher Team Room already succeeded so it is never re-attempted',
      );

      founderInboxUp = true;
      await fixture.service.sync('fixture'); // founder inbox now recovers
      assert.equal(calls.length, 3);
      status = fixture.readStatus();
      assert.equal(status.stalledSyncAlertActive, true, 'founder inbox delivery must be confirmed once it recovers');
    } finally {
      fixture.cleanup();
    }
  }

  // Mirror of the previous test with the channels swapped: founder inbox
  // succeeds immediately (stalledSyncAlertActive becomes true) while Team
  // Room fails, then Team Room later recovers. Reviewer-flagged regression:
  // the old `if (isStalled && !stalledSyncAlertActive)` guard treated a
  // confirmed founder-inbox delivery as "this episode is fully handled" and
  // never attempted Team Room again for the rest of the stall, no matter how
  // many more polls happened.
  {
    const calls: Array<{ context: StalledSyncAlertContext; already: StalledSyncAlertDeliveryResult }> = [];
    let teamRoomUp = false;
    const fixture = await withRepeatableFixture('local-ahead', {
      dirty: true,
      notifyStalledSync: async (context, already) => {
        calls.push({ context, already });
        return { teamRoomDelivered: teamRoomUp, founderInboxDelivered: true };
      },
      extraEnv: { SOURCE_CONTROL_STALL_FAILURE_THRESHOLD: '3' } as NodeJS.ProcessEnv,
    });
    try {
      await fixture.service.sync('fixture');
      await fixture.service.sync('fixture');
      await fixture.service.sync('fixture'); // crosses threshold: founder inbox succeeds, Team Room fails
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0].already, { teamRoomDelivered: false, founderInboxDelivered: false });
      let status = fixture.readStatus();
      assert.equal(status.stalledSyncAlertActive, true, 'founder inbox success must be persisted even though Team Room failed');
      assert.equal(status.stalledSyncAlertTeamRoomDeliveredAt, undefined, 'Team Room must still show undelivered');
      const founderInboxSentAt = status.stalledSyncAlertSentAt;
      assert.ok(founderInboxSentAt, 'founder-inbox confirmation timestamp must be recorded');

      // Still stalled (still dirty) on the next poll. The old bug's guard
      // (`!stalledSyncAlertActive`) is now false, so without the fix this
      // whole block -- and therefore Team Room's retry -- would never run
      // again for the rest of this stall episode.
      await fixture.service.sync('fixture');
      assert.equal(
        calls.length,
        2,
        'a confirmed founder-inbox delivery must never stop Team Room from being retried -- this is the exact bug the reviewer flagged',
      );
      assert.deepEqual(
        calls[1].already,
        { teamRoomDelivered: false, founderInboxDelivered: true },
        'a retry must tell the dispatcher founder inbox already succeeded so it is never re-attempted',
      );

      teamRoomUp = true;
      await fixture.service.sync('fixture'); // Team Room now recovers
      assert.equal(calls.length, 3);
      status = fixture.readStatus();
      assert.ok(status.stalledSyncAlertTeamRoomDeliveredAt, 'Team Room delivery must be confirmed once it recovers');
      assert.equal(
        status.stalledSyncAlertSentAt,
        founderInboxSentAt,
        'a channel already confirmed on a prior poll must not have its sent-at timestamp bumped again by a later poll that only newly confirms the OTHER channel',
      );

      // Now that both channels are confirmed, continuing to fail must not
      // re-attempt either one.
      await fixture.service.sync('fixture');
      assert.equal(calls.length, 3, 'once both channels are confirmed delivered, further polls must not re-attempt at all');
    } finally {
      fixture.cleanup();
    }
  }

  // checkStalled() is the scheduler-driven backstop for a sync() that is
  // wedged (stuck lock, hung Git subprocess) and therefore never calls
  // writeStatus again on its own. It must detect staleness purely from
  // elapsed wall-clock time against the last on-disk status, independent of
  // any further sync() calls, and must dedupe repeated notifications for
  // the same unchanging snapshot in memory (never writing to disk itself).
  {
    const alerts: StalledSyncAlertContext[] = [];
    const fixture = await withRepeatableFixture('equal', {
      notifyStalledSync: async (context) => {
        alerts.push(context);
        return { teamRoomDelivered: true, founderInboxDelivered: true };
      },
      // A failure-count threshold far above anything this test reaches
      // isolates the stale-age branch: only elapsed time should trigger it.
      extraEnv: {
        SOURCE_CONTROL_STALL_FAILURE_THRESHOLD: '1000',
        SOURCE_CONTROL_STALL_AGE_MS: '60000',
      } as NodeJS.ProcessEnv,
    });
    try {
      const synced = await fixture.service.sync('fixture');
      assert.equal(synced.state, 'synced');
      assert.equal(fixture.readStatus().consecutiveFailures, 0);

      // No time has passed yet -- must not be stalled.
      await fixture.service.checkStalled();
      assert.equal(alerts.length, 0, 'checkStalled() must not fire immediately after a fresh success');

      // Simulate the sync loop wedging: no further sync() calls happen at
      // all, but wall-clock time keeps moving. checkStalled() alone must
      // still be able to detect and report this.
      fixture.advanceMs(61_000);
      await fixture.service.checkStalled();
      assert.equal(alerts.length, 1, 'checkStalled() must alert once the last success ages past the threshold');

      // The on-disk status file is untouched by checkStalled() -- it is a
      // read-only backstop, so it must never race writeStatus's own
      // read-modify-write.
      // The last real writeStatus (the successful sync above) explicitly
      // persisted `false` -- checkStalled() recognizing a stall in memory
      // must not touch that on-disk value at all.
      const statusAfterFirstCheck = fixture.readStatus();
      assert.equal(statusAfterFirstCheck.stalledSyncAlertActive, false, 'checkStalled() must never write to the status file');

      // Calling it again against the same unchanging snapshot must not
      // spam a second notification.
      await fixture.service.checkStalled();
      fixture.advanceMs(1000);
      await fixture.service.checkStalled();
      assert.equal(alerts.length, 1, 'repeated checkStalled() calls against an unchanging snapshot must dedupe in memory');
    } finally {
      fixture.cleanup();
    }
  }

  // checkStalled()'s standalone backstop must have the same confirmed-
  // delivery-before-suppression contract as writeStatus() above: a failed
  // attempt must not permanently prevent a later retry while the sync loop
  // remains wedged (status file frozen, no new sync() calls at all).
  {
    const attempts: StalledSyncAlertContext[] = [];
    let shouldDeliver = false;
    const fixture = await withRepeatableFixture('equal', {
      notifyStalledSync: async (context) => {
        attempts.push(context);
        return shouldDeliver
          ? { teamRoomDelivered: true, founderInboxDelivered: true }
          : { teamRoomDelivered: false, founderInboxDelivered: false };
      },
      extraEnv: {
        SOURCE_CONTROL_STALL_FAILURE_THRESHOLD: '1000',
        SOURCE_CONTROL_STALL_AGE_MS: '60000',
      } as NodeJS.ProcessEnv,
    });
    try {
      await fixture.service.sync('fixture');
      fixture.advanceMs(61_000);

      await fixture.service.checkStalled();
      assert.equal(attempts.length, 1, 'first check past the stale-age threshold must attempt delivery');
      assert.equal(fixture.readStatus().stalledSyncAlertActive, false, 'checkStalled() must never write to the status file');

      // Same unchanging (wedged) snapshot, delivery still failing -- must
      // retry, not silently give up because "this key was already tried".
      await fixture.service.checkStalled();
      assert.equal(attempts.length, 2, 'a snapshot whose previous delivery failed must be retried, not permanently skipped');

      // The channel recovers while the sync loop is still wedged.
      shouldDeliver = true;
      await fixture.service.checkStalled();
      assert.equal(attempts.length, 3, 'recovery must be observed on the very next check');

      // Now that delivery is confirmed for this snapshot, further checks
      // against the same unchanging snapshot must stop attempting.
      shouldDeliver = false;
      fixture.advanceMs(1000);
      await fixture.service.checkStalled();
      assert.equal(attempts.length, 3, 'once confirmed delivered for this snapshot, further checks must not re-attempt');
    } finally {
      fixture.cleanup();
    }
  }

  // checkStalled()'s wall-clock backstop must also catch a sync() that
  // wedges on its very first-ever attempt, before writeStatus() has run even
  // once. No status file exists in that case, so isSourceControlSyncStalled()
  // has neither consecutiveFailures nor lastSuccessfulSyncAt to compare
  // against -- only wall-clock time since the service itself was constructed
  // (startedAtMs) can catch it. Reviewer-flagged regression: the old
  // `if (!status || ...) return;` guard bailed out unconditionally when no
  // status file existed, so this case could never alert no matter how much
  // time passed.
  {
    const alerts: StalledSyncAlertContext[] = [];
    const fixture = await withRepeatableFixture('equal', {
      notifyStalledSync: async (context) => {
        alerts.push(context);
        return { teamRoomDelivered: true, founderInboxDelivered: true };
      },
      extraEnv: {
        SOURCE_CONTROL_STALL_FAILURE_THRESHOLD: '1000',
        SOURCE_CONTROL_STALL_AGE_MS: '60000',
      } as NodeJS.ProcessEnv,
    });
    try {
      // No sync() call at all -- simulates a first-ever attempt wedged
      // (stuck lock, hung Git subprocess) before it could write any status.
      assert.equal(fixture.readStatus(), null, 'no status file must exist yet for this to be a valid first-run-wedge fixture');

      await fixture.service.checkStalled();
      assert.equal(alerts.length, 0, 'must not fire before the age threshold elapses, even with no status file');

      fixture.advanceMs(61_000);
      await fixture.service.checkStalled();
      assert.equal(
        alerts.length,
        1,
        'a first sync that never completes must still be caught once wall-clock time since service startup exceeds the threshold',
      );
      assert.equal(alerts[0].consecutiveFailures, 0, 'no completed attempt means no recorded failure count yet');
      assert.equal(alerts[0].lastSuccessfulSyncAt, undefined);
      assert.ok(alerts[0].error, 'a fallback explanation must be provided when there is no real status.error to report');
      assert.equal(fixture.readStatus(), null, 'checkStalled() must never write a status file itself, even in the no-status case');

      // Must dedupe against the same unchanging (still-null) snapshot.
      await fixture.service.checkStalled();
      fixture.advanceMs(1000);
      await fixture.service.checkStalled();
      assert.equal(alerts.length, 1, 'repeated checks against the same still-wedged first attempt must dedupe in memory');
    } finally {
      fixture.cleanup();
    }
  }

  // syncLocked()'s auto-merge-and-revalidate branch must alert exactly
  // once when it silently replaces a still-current, explicitly-prepared
  // candidate -- the precise gap that let Publish deploy an unvalidated
  // commit in the 2026-09 e0ffe6c7 incident. It must NOT alert when there
  // was no prior ready_to_promote candidate, and must NOT re-alert when
  // the candidate it is replacing was itself already an auto-promoted one
  // (otherwise a burst of GitHub pushes would spam one alert per push).
  {
    const supersededAlerts: CandidateSupersededContext[] = [];
    const supersedesExplicit = await withFixture('github-ahead', {
      seedStatus: {
        schemaVersion: 3,
        state: 'ready_to_promote',
        origin: 'fixture',
        replitSha: LOCAL_OLD,
        githubSha: LOCAL_OLD,
        candidateSha: LOCAL_OLD,
        candidatePreparedAt: '2026-09-15T19:00:00.000Z',
        candidateExpiresAt: '2026-09-15T22:00:00.000Z',
        validation: manifest(LOCAL_OLD),
        consecutiveFailures: 0,
        lastHeartbeatAt: '2026-09-15T19:00:00.000Z',
        updatedAt: '2026-09-15T19:00:00.000Z',
      },
      notifyCandidateSuperseded: async (context) => { supersededAlerts.push(context); },
    });
    assert.equal(supersedesExplicit.result.state, 'ready_to_promote');
    assert.equal(supersedesExplicit.result.candidateSha, REMOTE_NEW);
    assert.equal(supersedesExplicit.result.candidateSource, 'auto_sync');
    assert.equal(supersedesExplicit.status.candidateSource, 'auto_sync');
    assert.equal(supersededAlerts.length, 1, 'silently replacing an explicitly-prepared candidate must alert exactly once');
    assert.equal(supersededAlerts[0].supersededCandidateSha, LOCAL_OLD);
    assert.equal(supersededAlerts[0].newCandidateSha, REMOTE_NEW);
    assert.equal(supersededAlerts[0].supersededPreparedAt, '2026-09-15T19:00:00.000Z');

    // No prior candidate at all -- nothing was superseded, so no alert.
    const noAlerts1: CandidateSupersededContext[] = [];
    const noPriorCandidate = await withFixture('github-ahead', {
      notifyCandidateSuperseded: async (context) => { noAlerts1.push(context); },
    });
    assert.equal(noPriorCandidate.status.candidateSource, 'auto_sync');
    assert.equal(noAlerts1.length, 0, 'auto-promoting when there was no prior ready_to_promote candidate must not alert');

    // The prior candidate was itself already auto-promoted (nobody had run
    // `prepare` in a while) -- chaining auto_sync-over-auto_sync must stay
    // quiet rather than firing one alert per subsequent GitHub push.
    const noAlerts2: CandidateSupersededContext[] = [];
    const chainedAutoSync = await withFixture('github-ahead', {
      seedStatus: {
        schemaVersion: 3,
        state: 'ready_to_promote',
        origin: 'fixture',
        replitSha: LOCAL_OLD,
        githubSha: LOCAL_OLD,
        candidateSha: LOCAL_OLD,
        candidateSource: 'auto_sync',
        candidatePreparedAt: '2026-09-15T19:00:00.000Z',
        candidateExpiresAt: '2026-09-15T22:00:00.000Z',
        validation: manifest(LOCAL_OLD),
        consecutiveFailures: 0,
        lastHeartbeatAt: '2026-09-15T19:00:00.000Z',
        updatedAt: '2026-09-15T19:00:00.000Z',
      },
      notifyCandidateSuperseded: async (context) => { noAlerts2.push(context); },
    });
    assert.equal(chainedAutoSync.status.candidateSource, 'auto_sync');
    assert.equal(noAlerts2.length, 0, 'replacing an already auto-promoted candidate with a newer one must not re-alert');
  }

  // preparePromotion() must clear any stale 'auto_sync' tag inherited from
  // a prior candidate window: an explicit, deliberate prepare run always
  // produces a candidate a human/automation actually reviewed, regardless
  // of what tag the previous ready_to_promote candidate happened to carry.
  {
    const rootDir = mkdtempSync(join(tmpdir(), 'source-control-prepare-clears-auto-sync-test-'));
    const statusPath = join(rootDir, 'status.json');
    const calls: string[] = [];
    const state = { local: LOCAL_NEW, remote: LOCAL_NEW };
    writeFileSync(statusPath, `${JSON.stringify({
      schemaVersion: 3,
      state: 'ready_to_promote',
      origin: 'fixture',
      replitSha: LOCAL_OLD,
      githubSha: LOCAL_OLD,
      candidateSha: LOCAL_OLD,
      candidateSource: 'auto_sync',
      candidatePreparedAt: '2026-09-15T19:00:00.000Z',
      candidateExpiresAt: '2026-09-15T20:00:00.000Z',
      validation: manifest(LOCAL_OLD),
      consecutiveFailures: 0,
      lastHeartbeatAt: '2026-09-15T19:00:00.000Z',
      updatedAt: '2026-09-15T19:00:00.000Z',
    })}\n`);
    try {
      const service = new SourceControlService({
        rootDir,
        env: {
          NODE_ENV: 'development',
          SOURCE_BRIDGE_STATUS_FILE: statusPath,
          SOURCE_BRIDGE_SUMMARY_FILE: join(rootDir, 'status.md'),
          SOURCE_CONTROL_LOCK_FILE: join(rootDir, 'control.lock'),
          SOURCE_CONTROL_OPERATIONS_DIR: join(rootDir, 'operations'),
        },
        fetchInstallationToken: async () => ({ token: 'fixture-token' }),
        uuid: (() => {
          let value = 0;
          return () => `prepare-clears-fixture-${++value}`;
        })(),
        validateCandidate: async (sha) => manifest(sha),
        runCommand: buildFixtureRunCommand('equal', state, calls, {}),
      });
      const result = await service.preparePromotion('fixture');
      assert.equal(result.ok, true);
      assert.equal(result.state, 'ready_to_promote');
      assert.equal(result.candidateSha, LOCAL_NEW);
      assert.equal(result.candidateSource, undefined, 'an explicit prepare must never report the candidate it just validated as auto_sync');
      const status = JSON.parse(readFileSync(statusPath, 'utf8'));
      assert.equal(status.candidateSource, undefined, 'prepare must clear a stale auto_sync tag on disk, not just omit it from the in-memory result');
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  }

  // recordLocked() must refuse an auto-promoted candidate even when it is
  // otherwise perfectly valid (matching sha, unexpired, well-formed
  // manifest, well-formed publication reference) -- candidateSource gates
  // on *how* the candidate was validated, not just *whether* it currently
  // looks valid.
  {
    const rootDir = mkdtempSync(join(tmpdir(), 'source-control-auto-sync-record-test-'));
    const statusPath = join(rootDir, 'status.json');
    const calls: string[] = [];
    const state = { local: LOCAL_NEW, remote: LOCAL_NEW };
    writeFileSync(statusPath, `${JSON.stringify({
      schemaVersion: 3,
      state: 'ready_to_promote',
      origin: 'fixture',
      replitSha: LOCAL_NEW,
      githubSha: LOCAL_NEW,
      candidateSha: LOCAL_NEW,
      candidateSource: 'auto_sync',
      candidatePreparedAt: '2026-09-15T20:00:00.000Z',
      candidateExpiresAt: '2026-09-15T22:00:00.000Z',
      validation: manifest(LOCAL_NEW),
      consecutiveFailures: 0,
      lastHeartbeatAt: '2026-09-15T20:00:00.000Z',
      updatedAt: '2026-09-15T20:00:00.000Z',
    })}\n`);
    try {
      const service = new SourceControlService({
        rootDir,
        env: {
          NODE_ENV: 'development',
          SOURCE_BRIDGE_STATUS_FILE: statusPath,
          SOURCE_BRIDGE_SUMMARY_FILE: join(rootDir, 'status.md'),
          SOURCE_CONTROL_LOCK_FILE: join(rootDir, 'control.lock'),
          SOURCE_CONTROL_OPERATIONS_DIR: join(rootDir, 'operations'),
        },
        now: () => new Date('2026-09-15T21:00:00.000Z'),
        fetchInstallationToken: async () => ({ token: 'fixture-token' }),
        uuid: (() => {
          let value = 0;
          return () => `auto-sync-record-fixture-${++value}`;
        })(),
        runCommand: buildFixtureRunCommand('equal', state, calls, {}),
      });
      const result = await service.recordPromotion(LOCAL_NEW, 'fixture', undefined, `replit-publish:${LOCAL_NEW}:${LOCAL_NEW}`);
      assert.equal(result.ok, false);
      assert.equal(result.state, 'failed');
      assert.match(result.error || '', /auto-validated by the sync scheduler/);
      assert.match(result.error || '', /npm run source-control:prepare/);
      assert.ok(
        !calls.some((call) => call.startsWith('git push ')),
        'an auto-promoted candidate must never reach a git push through record',
      );
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  }

  // checkCandidateDrift() must detect and describe every relationship
  // between HEAD and the last known ready_to_promote candidate without
  // ever mutating status or taking the shared lock -- it exists purely so
  // a human can check "is it still safe to click Publish?" independent of
  // the scheduler's own last sync/prepare/record tick.
  {
    const DRIFT_NOW = new Date('2026-09-15T21:00:00.000Z');
    const driftRunCommand = (
      headSha: string,
      marker?: { sha: string; treeSha: string; parentSha: string; subject: string },
      candidateTreeSha?: string,
    ) => async (command: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
      assert.equal(command, 'git', 'checkCandidateDrift() must never route Git through a shell helper');
      if (args[0] === 'rev-parse' && args[1] === '--verify' && args[2] === 'HEAD^{commit}') {
        return { exitCode: 0, stdout: `${headSha}\n`, stderr: '' };
      }
      if (args[0] === 'show' && marker && args[args.length - 1] === marker.sha) {
        return { exitCode: 0, stdout: `${marker.sha}\n${marker.treeSha}\n${marker.parentSha}\n${marker.subject}\n`, stderr: '' };
      }
      if (args[0] === 'show') {
        return { exitCode: 1, stdout: '', stderr: 'no such commit' };
      }
      if (args[0] === 'rev-parse' && args[1] === '--verify' && marker && args[2] === `${marker.parentSha}^{tree}` && candidateTreeSha) {
        return { exitCode: 0, stdout: `${candidateTreeSha}\n`, stderr: '' };
      }
      return { exitCode: 98, stdout: '', stderr: `unexpected command: ${args.join(' ')}` };
    };
    const refuseGit = async (): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
      throw new Error('checkCandidateDrift() must not touch git when the status already answers the question');
    };
    const failingGit = async (): Promise<{ exitCode: number; stdout: string; stderr: string }> => (
      { exitCode: 1, stdout: '', stderr: 'boom' }
    );
    const withDriftService = async (
      seedStatus: Record<string, unknown> | undefined,
      runCommand: (command: string, args: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>,
    ) => {
      const rootDir = mkdtempSync(join(tmpdir(), 'source-control-drift-test-'));
      const statusPath = join(rootDir, 'status.json');
      if (seedStatus) writeFileSync(statusPath, `${JSON.stringify(seedStatus)}\n`);
      try {
        const service = new SourceControlService({
          rootDir,
          env: {
            NODE_ENV: 'development',
            SOURCE_BRIDGE_STATUS_FILE: statusPath,
            SOURCE_CONTROL_LOCK_FILE: join(rootDir, 'control.lock'),
            SOURCE_CONTROL_OPERATIONS_DIR: join(rootDir, 'operations'),
          },
          // checkCandidateDrift() now checks candidateExpiresAt against
          // "now" the same way recordLocked() does -- pin it so every
          // fixture's expiry math stays deterministic regardless of when
          // this suite actually runs.
          now: () => DRIFT_NOW,
          fetchInstallationToken: async () => ({ token: 'fixture-token' }),
          runCommand,
        });
        return await service.checkCandidateDrift();
      } finally {
        rmSync(rootDir, { recursive: true, force: true });
      }
    };

    const noCandidate = await withDriftService(undefined, refuseGit);
    assert.equal(noCandidate.driftDetected, false);
    assert.equal(noCandidate.reason, 'no_candidate');

    const notReady = await withDriftService({ state: 'synced', updatedAt: '2026-09-15T19:00:00.000Z' }, refuseGit);
    assert.equal(notReady.driftDetected, false);
    assert.equal(notReady.reason, 'no_candidate', 'a status that is not currently ready_to_promote must read the same as no candidate at all');

    const autoPromoted = await withDriftService({
      state: 'ready_to_promote',
      candidateSha: LOCAL_NEW,
      candidateSource: 'auto_sync',
      candidatePreparedAt: '2026-09-15T19:00:00.000Z',
    }, refuseGit);
    assert.equal(autoPromoted.driftDetected, true);
    assert.equal(autoPromoted.reason, 'auto_promoted_candidate');
    assert.equal(autoPromoted.candidateSha, LOCAL_NEW);
    assert.match(autoPromoted.message, /prepare/);

    // An explicit candidate whose validation window has already lapsed
    // must never read as `match` just because it is otherwise well-formed
    // and even if HEAD still happens to equal it -- the same staleness
    // record() itself checks. Must never touch git: the status alone
    // already answers the question.
    const expired = await withDriftService({
      state: 'ready_to_promote',
      candidateSha: LOCAL_NEW,
      candidatePreparedAt: '2026-09-15T19:00:00.000Z',
      candidateExpiresAt: '2026-09-15T20:00:00.000Z',
      validation: manifest(LOCAL_NEW),
    }, refuseGit);
    assert.equal(expired.driftDetected, true);
    assert.equal(expired.reason, 'candidate_invalid');
    assert.equal(expired.candidateSha, LOCAL_NEW);
    assert.match(expired.message, /npm run source-control:prepare/);

    // Same gate, different failure: an unexpired candidate whose manifest
    // does not validate (tampered, truncated, or naming a different sha)
    // must also read as candidate_invalid, not match.
    const invalidManifest = await withDriftService({
      state: 'ready_to_promote',
      candidateSha: LOCAL_NEW,
      candidatePreparedAt: '2026-09-15T19:00:00.000Z',
      candidateExpiresAt: '2026-09-15T22:00:00.000Z',
      validation: manifest(LOCAL_OLD),
    }, refuseGit);
    assert.equal(invalidManifest.driftDetected, true);
    assert.equal(invalidManifest.reason, 'candidate_invalid', 'a manifest naming a different candidateSha must not validate');

    const matching = await withDriftService(
      {
        state: 'ready_to_promote',
        candidateSha: LOCAL_NEW,
        candidatePreparedAt: '2026-09-15T19:00:00.000Z',
        candidateExpiresAt: '2026-09-15T22:00:00.000Z',
        validation: manifest(LOCAL_NEW),
      },
      driftRunCommand(LOCAL_NEW),
    );
    assert.equal(matching.driftDetected, false);
    assert.equal(matching.reason, 'match');
    assert.equal(matching.currentHeadSha, LOCAL_NEW);

    const moved = await withDriftService(
      {
        state: 'ready_to_promote',
        candidateSha: LOCAL_OLD,
        candidatePreparedAt: '2026-09-15T19:00:00.000Z',
        candidateExpiresAt: '2026-09-15T22:00:00.000Z',
        validation: manifest(LOCAL_OLD),
      },
      driftRunCommand(LOCAL_NEW),
    );
    assert.equal(moved.driftDetected, true);
    assert.equal(moved.reason, 'head_moved_past_candidate');
    assert.equal(moved.candidateSha, LOCAL_OLD);
    assert.equal(moved.currentHeadSha, LOCAL_NEW);
    assert.match(moved.message, /npm run source-control:prepare/);

    const markerAhead = await withDriftService(
      {
        state: 'ready_to_promote',
        candidateSha: LOCAL_OLD,
        candidatePreparedAt: '2026-09-15T19:00:00.000Z',
        candidateExpiresAt: '2026-09-15T22:00:00.000Z',
        validation: manifest(LOCAL_OLD),
      },
      driftRunCommand(PUBLICATION_MARKER, {
        sha: PUBLICATION_MARKER,
        treeSha: CANDIDATE_TREE,
        parentSha: LOCAL_OLD,
        subject: 'Published your App',
      }, CANDIDATE_TREE),
    );
    assert.equal(markerAhead.driftDetected, false, 'HEAD exactly one legitimate Replit publish marker ahead of the candidate, with a verified matching tree, must not read as drift');
    assert.equal(markerAhead.reason, 'match');

    // The marker's parent and subject alone are not proof: if its tree
    // differs from the candidate's own tree, something changed the content
    // between the validated candidate and this "marker" commit. Reviewer-
    // flagged gap: the previous check only compared parentSha and subject,
    // so a marker carrying different file content still read as `match`.
    const markerTreeMismatch = await withDriftService(
      {
        state: 'ready_to_promote',
        candidateSha: LOCAL_OLD,
        candidatePreparedAt: '2026-09-15T19:00:00.000Z',
        candidateExpiresAt: '2026-09-15T22:00:00.000Z',
        validation: manifest(LOCAL_OLD),
      },
      driftRunCommand(PUBLICATION_MARKER, {
        sha: PUBLICATION_MARKER,
        treeSha: CANDIDATE_TREE,
        parentSha: LOCAL_OLD,
        subject: 'Published your App',
      }, '7'.repeat(40)),
    );
    assert.equal(markerTreeMismatch.driftDetected, true, 'a marker whose tree does not match the candidate\'s own tree must never read as a safe match');
    assert.equal(markerTreeMismatch.reason, 'head_moved_past_candidate');

    const gitUnavailable = await withDriftService(
      {
        state: 'ready_to_promote',
        candidateSha: LOCAL_NEW,
        candidatePreparedAt: '2026-09-15T19:00:00.000Z',
        candidateExpiresAt: '2026-09-15T22:00:00.000Z',
        validation: manifest(LOCAL_NEW),
      },
      failingGit,
    );
    assert.equal(gitUnavailable.driftDetected, false, 'an unreadable HEAD must fail closed to "cannot confirm" rather than a false drift/no-drift claim');
    assert.equal(gitUnavailable.reason, 'unknown');
  }

  console.log('Source-control coordinator fixture checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  const { closeDbConnections } = await import('../db');
  await closeDbConnections();
});
