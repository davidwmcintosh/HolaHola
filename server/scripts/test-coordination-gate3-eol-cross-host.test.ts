import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after } from 'node:test';
import { eq } from 'drizzle-orm';
import {
  coordinationEvents,
  coordinationInboxActivation,
  coordinationInboxItems,
  coordinationRuntimeInboxWindowItems,
} from '@shared/schema';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import { closeDbConnections, getSharedDb } from '../db';
import { GATE3 } from '../services/antigravity-provisioning-bundle';
import { createGate3AssignmentWindow } from '../services/coordination-gate3-assignment-window-service';
import { decideChallenge } from '../services/founder-task-ownership-service';
import { prepareAntigravityProvisioning } from './prepare-antigravity-provisioning';
import { registerAntigravityRuntime, submitAntigravityChallenge } from './provision-antigravity-runtime';

const disposableUrl = getVerifiedCiDatabaseUrl();
const databaseTest = disposableUrl ? test : test.skip;
const TEMPLATE_LF =
  '# Gate 3 cross-host oracle\nStarting commit: __FINAL_STARTING_COMMIT__\n';
const STARTING_COMMIT = '7e5f42a7cb85297a6af38b31dc84db4d4cb52517';
const CANONICAL_TEXT =
  `# Gate 3 cross-host oracle\nStarting commit: ${STARTING_COMMIT}\n`;
const CANONICAL_SHA256 =
  '713ddd918ee6ce578b2d204b6baf7f63fbcbdc855f0e0bd953e9130c24e6e6d1';

after(async () => {
  if (disposableUrl) await closeDbConnections();
});

databaseTest('CRLF preparation and LF assignment persist one independent canonical oracle', async (t) => {
  const parent = await mkdtemp(join(tmpdir(), 'gate3-cross-host-'));
  t.after(async () => { await rm(parent, { recursive: true, force: true }); });
  const repository = join(parent, 'repository');
  const worktree = join(parent, 'worktree');
  const runGit = (
    args: string[],
    cwd?: string,
    env?: Record<string, string>,
  ) => {
    const result = spawnSync('git', args, {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return result.stdout.trim();
  };

  runGit(['init', '-b', 'main', repository]);
  runGit(['config', 'user.email', 'gate3-test@example.invalid'], repository);
  runGit(['config', 'user.name', 'Gate 3 test'], repository);
  await writeFile(join(repository, 'seed'), 'seed', 'utf8');
  runGit(['add', 'seed'], repository);
  runGit(['commit', '-m', 'seed'], repository, {
    GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z',
    GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z',
  });
  const preparedCommit = runGit(['rev-parse', 'HEAD'], repository);
  assert.equal(preparedCommit, STARTING_COMMIT);
  runGit(['worktree', 'add', '-b', GATE3.branch, worktree, preparedCommit], repository);
  runGit(['update-ref', 'refs/remotes/origin/main', preparedCommit], worktree);

  const crlfTemplatePath = join(parent, 'task-1448-crlf.md');
  const lfAssignmentTemplatePath = join(parent, 'task-1448-lf.md');
  await writeFile(crlfTemplatePath, TEMPLATE_LF.replace(/\n/g, '\r\n'), 'utf8');
  await writeFile(lfAssignmentTemplatePath, TEMPLATE_LF, 'utf8');
  const bundle = await prepareAntigravityProvisioning({
    root: worktree,
    startingCommit: preparedCommit,
    env: {
      COORDINATION_RUNTIME_BOOTSTRAP_TOKEN:
        `cb_${crypto.randomBytes(32).toString('base64url')}`,
    },
    templatePath: crlfTemplatePath,
  });

  const expectedBytes = Buffer.from(CANONICAL_TEXT, 'utf8');
  assert.equal(
    crypto.createHash('sha256').update(expectedBytes).digest('hex'),
    CANONICAL_SHA256,
  );
  const preparedBytes = await readFile(join(worktree, '.local/tasks/task-1448.md'));
  assert.deepEqual(preparedBytes, expectedBytes);
  assert.equal(preparedBytes.includes(13), false);
  assert.equal(bundle.artifactSha256, CANONICAL_SHA256);

  const phaseA = await submitAntigravityChallenge(bundle, crypto.randomUUID());
  const receipt = await decideChallenge(
    phaseA.challengeId,
    'approved',
    'gate3-cross-host-oracle-test',
  );
  assert.ok('id' in receipt);
  const registered = await registerAntigravityRuntime(bundle, phaseA.challengeId);
  assert.equal(registered.status, 'created');
  await getSharedDb().insert(coordinationInboxActivation).values({
    id: `gate3-eol-${bundle.bundleDigest.slice(0, 16)}`,
    schemaVersion: 1,
    recipientRuleVersion: 1,
    state: 'active',
    backfillCutoffGlobalSequence: 0,
    completionEvidence: {},
    activatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const result = await createGate3AssignmentWindow({
    bundle,
    receiptId: receipt.id,
    assignmentAttemptId: crypto.randomUUID(),
    testHooks: { taskArtifactPath: lfAssignmentTemplatePath },
  });
  assert.equal(result.artifactDigest, CANONICAL_SHA256);
  const [event] = await getSharedDb().select().from(coordinationEvents)
    .where(eq(coordinationEvents.id, result.assignmentEventId));
  const runtimeItems = await getSharedDb().select().from(coordinationRuntimeInboxWindowItems)
    .where(eq(coordinationRuntimeInboxWindowItems.itemId, result.runtimeInboxItemId));
  const ordinaryItems = await getSharedDb().select().from(coordinationInboxItems)
    .where(eq(coordinationInboxItems.coordinationEventId, result.assignmentEventId));
  const expectedArtifact = { text: CANONICAL_TEXT, sha256: CANONICAL_SHA256 };
  assert.deepEqual((event.payload as any).taskArtifact, expectedArtifact);
  assert.equal(runtimeItems.length, 1);
  assert.deepEqual((runtimeItems[0].payload as any).taskArtifact, expectedArtifact);
  assert.equal(ordinaryItems.length, 1);
  assert.equal(ordinaryItems[0].coordinationEventId, event.id);
  assert.equal(ordinaryItems[0].coordinationThreadId, event.threadId);
  assert.equal(ordinaryItems[0].recipientActor, GATE3.actor);
  assert.equal(ordinaryItems[0].senderActor, 'luca-replit');
});