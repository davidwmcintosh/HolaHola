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
import {
  SOURCE_CONTROL_REQUIRED_CHECKS,
  SOURCE_CONTROL_VALIDATION_MANIFEST_VERSION,
  SourceControlService,
  materializeProtectedGitSnapshot,
  resolveRenderReleaseEvidenceFromHealth,
  validateRenderReleaseEvidence,
  type RenderReleaseEvidence,
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

async function withFixture(
  scenario: Scenario,
  options: {
    dirty?: boolean;
    untracked?: boolean;
    missingKey?: boolean;
    holdLock?: boolean;
    episodeDiff?: EpisodeDiffFixture;
  } = {},
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
    const service = new SourceControlService({
      rootDir,
      env,
      fetchInstallationToken: options.missingKey ? undefined : async () => ({ token: 'fixture-token' }),
      uuid: (() => {
        let value = 0;
        return () => `fixture-${++value}`;
      })(),
      validateCandidate: async (sha) => manifest(sha),
      runCommand: async (command, args) => {
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
      },
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
    ?? `replit-publish:${LOCAL_NEW}:${markerSha}`;
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
  const publicationReference = `replit-publish:${candidateSha}:${head}`;
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
  // Uses episode-55 as an arbitrary protected-file stand-in (not episode-99):
  // episode-99 is a legacy CI fixture number now deliberately excluded from
  // the guard (see LEGACY_RESERVED_FIXTURE_EPISODE_NUMBERS in
  // episode-content-loss-guard.ts), so this scenario would silently no-op
  // against it. Same reasoning as check-episode-content-loss.ts's self-check.
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

  const githubAhead = await withFixture('github-ahead');
  assert.equal(githubAhead.result.state, 'ready_to_promote');
  assert.ok(githubAhead.calls.includes('git merge --ff-only FETCH_HEAD'));
  assert.equal(githubAhead.status.candidateSha, REMOTE_NEW);

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

  const markerRecovery = await recordPublicationMarkerFixture();
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
    publicationReference: `replit-publish:${LOCAL_NEW}:${PUBLICATION_MARKER}`,
    protectedValidationId: manifest(LOCAL_NEW).validationId,
    publishTriggerSha: PUBLICATION_MARKER,
    publicationMarker: {
      sha: PUBLICATION_MARKER,
      treeSha: CANDIDATE_TREE,
      parentSha: LOCAL_NEW,
      subject: 'Published your App',
    },
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
    publicationReference: `replit-publish:${LOCAL_NEW}:${PUBLICATION_MARKER}`,
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

  console.log('Source-control coordinator fixture checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});