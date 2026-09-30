import assert from "node:assert/strict";
import test from "node:test";
import { execFile as callbackExecFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { InMemorySharedSpecRepository, SharedSpecCore, type ActorContext } from "./shared-spec-core";
import type {
  SharedSpecNotification,
  SharedSpecNotificationDelivery,
  SharedSpecNotificationSink,
} from "./shared-spec-notifications";
import { GitWorkingTreeLiveSyncProvider, type LiveInstructionDocumentSyncProvider } from "./shared-spec-live-sync";
import { decideSharedSpecReviewWithEffects } from "./shared-spec-review-decision";

const execFile = promisify(callbackExecFile);

/**
 * The exact scenario the 2026-09-29 incident produced: a liveInstructionDocument
 * review is decided but the on-disk working tree never converges to the
 * approved markdown. Uses a real temp git repo and the real
 * GitWorkingTreeLiveSyncProvider -- not a fake -- because "the working-tree
 * file is written/committed" is a filesystem/git fact a mocked liveSync
 * could report without it being true. See shared-spec-live-sync.test.ts's
 * own makeRepo() helper, mirrored here.
 */
async function makeRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "shared-spec-review-decision-"));
  await execFile("git", ["init", "-q"], { cwd: dir });
  await execFile("git", ["config", "user.email", "test@example.test"], { cwd: dir });
  await execFile("git", ["config", "user.name", "Test"], { cwd: dir });
  await writeFile(join(dir, "README.md"), "seed\n", "utf8");
  await execFile("git", ["add", "README.md"], { cwd: dir });
  await execFile("git", ["commit", "-q", "-m", "seed"], { cwd: dir });
  return dir;
}

const commitCountFor = async (repo: string, gitPath: string): Promise<number> => {
  const { stdout } = await execFile("git", ["log", "--oneline", "--", gitPath], { cwd: repo });
  return stdout.trim().split("\n").filter(Boolean).length;
};

class RecordingNotificationSink implements SharedSpecNotificationSink {
  readonly deliveries: SharedSpecNotification[] = [];
  async deliver(event: SharedSpecNotification): Promise<SharedSpecNotificationDelivery> {
    this.deliveries.push(event);
    return { state: "delivered" };
  }
}

const reviewer: ActorContext = { actorId: "reviewer" };
const author: ActorContext = { actorId: "author" };

/**
 * Mirrors setupReadyReview() in shared-spec-routes.test.ts, but fixed to a
 * document flagged liveInstructionDocument at one of the two real production
 * gitPaths (see shared-spec-core.ts's liveInstructionDocumentPaths) so this
 * test is tied to the actual incident document, not a generic fixture path.
 */
async function setupReadyReview(core: SharedSpecCore) {
  await core.setReviewerPolicy({ actorId: "admin", capabilities: ["policy_admin"] }, {
    actorId: reviewer.actorId, capability: "reviewer", active: true, idempotencyKey: "reviewer-on",
  });
  const created = await core.createDocument(author, {
    title: "Shared Agent Instructions", kind: "architecture", repository: "hola/hola",
    gitPath: "docs/shared-agent-instructions.md", markdown: "# Shared Agent Instructions\n\nOriginal.\n",
    liveInstructionDocument: true, idempotencyKey: "create",
  });
  const review = await core.markRevisionReady(author, {
    documentId: created.document.id, revisionId: created.revision.id, idempotencyKey: "ready",
  });
  await core.claimReview(reviewer, review.id, "claim");
  return { created, review };
}

test("approving a liveInstructionDocument review writes+commits the working-tree file and delivers a review_decided notification", async () => {
  const repo = await makeRepo();
  const core = new SharedSpecCore(new InMemorySharedSpecRepository());
  const { created, review } = await setupReadyReview(core);
  const notifications = new RecordingNotificationSink();
  const liveSync = new GitWorkingTreeLiveSyncProvider({ rootDir: repo });

  const result = await decideSharedSpecReviewWithEffects({ core, notifications, liveSync }, reviewer, {
    reviewId: review.id, decision: "approve", idempotencyKey: "decide-1",
  });

  assert.equal(result.review.state, "approved");
  assert.equal(result.liveSync?.state, "synced");

  // (1) The working-tree file was actually written AND committed -- not just
  // "the sync provider was invoked", which a mock could report without
  // anything landing on disk. This is exactly the drift the incident
  // produced: the DB said "approved" while the real file stayed stale.
  const onDisk = await readFile(join(repo, "docs/shared-agent-instructions.md"), "utf8");
  assert.equal(onDisk, "# Shared Agent Instructions\n\nOriginal.\n");
  assert.equal(
    await commitCountFor(repo, "docs/shared-agent-instructions.md"),
    1,
    "the approved revision must be committed to git, not merely written to disk",
  );

  // (2) The notification sink actually received a review_decided delivery.
  assert.equal(notifications.deliveries.length, 1);
  const delivered = notifications.deliveries[0];
  assert.equal(delivered.kind, "review_decided");
  assert.equal(delivered.documentId, created.document.id);
  assert.equal(delivered.revisionId, created.revision.id);
  assert.equal(delivered.reviewId, review.id);
  assert.equal(delivered.recipientActorId, review.requestedByActorId);
});

test("rejecting a review delivers the notification but never calls the live-sync provider", async () => {
  const core = new SharedSpecCore(new InMemorySharedSpecRepository());
  const { review } = await setupReadyReview(core);
  const notifications = new RecordingNotificationSink();
  let syncCalled = false;
  const liveSync: LiveInstructionDocumentSyncProvider = {
    sync: async () => { syncCalled = true; return { state: "synced", commitCreated: true }; },
  };

  const result = await decideSharedSpecReviewWithEffects({ core, notifications, liveSync }, reviewer, {
    reviewId: review.id, decision: "reject", rationale: "not ready", idempotencyKey: "decide-1",
  });

  assert.equal(result.review.state, "rejected");
  assert.equal(result.liveSync, undefined);
  assert.equal(syncCalled, false, "reject must never touch the working tree");
  assert.equal(notifications.deliveries.length, 1);
  assert.equal(notifications.deliveries[0].kind, "review_decided");
});

test("approving an ordinary (non-flagged) document's review never calls the live-sync provider", async () => {
  const core = new SharedSpecCore(new InMemorySharedSpecRepository());
  await core.setReviewerPolicy({ actorId: "admin", capabilities: ["policy_admin"] }, {
    actorId: reviewer.actorId, capability: "reviewer", active: true, idempotencyKey: "reviewer-on",
  });
  const created = await core.createDocument(author, {
    title: "Ordinary Doc", kind: "architecture", repository: "hola/hola",
    gitPath: "docs/superpowers/specs/ordinary.md", markdown: "# Ordinary\n", idempotencyKey: "create",
  });
  const review = await core.markRevisionReady(author, {
    documentId: created.document.id, revisionId: created.revision.id, idempotencyKey: "ready",
  });
  await core.claimReview(reviewer, review.id, "claim");
  const notifications = new RecordingNotificationSink();
  let syncCalled = false;
  const liveSync: LiveInstructionDocumentSyncProvider = {
    sync: async () => { syncCalled = true; return { state: "synced", commitCreated: true }; },
  };

  const result = await decideSharedSpecReviewWithEffects({ core, notifications, liveSync }, reviewer, {
    reviewId: review.id, decision: "approve", idempotencyKey: "decide-1",
  });

  assert.equal(result.review.state, "approved");
  assert.equal(result.liveSync, undefined);
  assert.equal(syncCalled, false);
  assert.equal(notifications.deliveries.length, 1);
});

test("a failed notification delivery throws instead of being silently swallowed", async () => {
  const core = new SharedSpecCore(new InMemorySharedSpecRepository());
  const { review } = await setupReadyReview(core);
  const failingSink: SharedSpecNotificationSink = {
    deliver: async () => ({ state: "failed", retryable: true, error: "simulated outage" }),
  };

  await assert.rejects(
    () => decideSharedSpecReviewWithEffects({ core, notifications: failingSink }, reviewer, {
      reviewId: review.id, decision: "approve", idempotencyKey: "decide-1",
    }),
    /notification delivery failed/,
  );
});
