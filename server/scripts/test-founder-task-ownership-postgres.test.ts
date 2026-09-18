import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { canonicalJson } from "../services/task-ownership-service";

function disposableTarget(): string | undefined {
  const url = process.env.NEON_SHARED_DATABASE_URL;
  if (!url) return undefined;
  if (process.env.FOUNDER_TASK_OWNERSHIP_TEST_DATABASE_DISPOSABLE !== "1") {
    throw new Error("FOUNDER_TASK_OWNERSHIP_TEST_DATABASE_DISPOSABLE=1 is required");
  }
  if (url === process.env.NEON_SHARED_DATABASE_URL && process.env.FOUNDER_TASK_OWNERSHIP_TEST_DATABASE_URL !== url) {
    throw new Error("founder ownership test requires the gate-provided disposable database URL");
  }
  if (url === process.env.FOUNDER_TASK_OWNERSHIP_FORBIDDEN_SHARED_URL) {
    throw new Error("founder ownership test refuses the shared Neon database");
  }
  return url;
}

async function codeOf(action: Promise<unknown>, code: string) {
  await assert.rejects(action, (error: unknown) => (error as { code?: string })?.code === code);
}

async function sqlRejected(action: Promise<unknown>, text: string) {
  await assert.rejects(action, (error: unknown) => {
    let current: unknown = error;
    const messages: string[] = [];
    for (let depth = 0; depth < 4 && current; depth += 1) {
      messages.push(String((current as Error)?.message || current).toLowerCase());
      current = (current as Error & { cause?: unknown })?.cause;
    }
    return messages.some(message => message.includes(text));
  });
}

test("PostgreSQL founder-attested ownership protocol is durable and immutable", async (context) => {
  if (!disposableTarget()) {
    context.skip("set NEON_SHARED_DATABASE_URL and FOUNDER_TASK_OWNERSHIP_TEST_DATABASE_DISPOSABLE=1");
    return;
  }
  const { db } = await import("../db");
  const ownership = await import("../services/founder-task-ownership-service");
  const suffix = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const actor = "luca-founder-test";
  const founder = `founder-${suffix}`;
  const keyPair = crypto.generateKeyPairSync("ed25519");
  const publicKey = (keyPair.publicKey.export({ format: "der", type: "spki" }) as Buffer).toString("base64url");
  const fingerprint = crypto.createHash("sha256").update(Buffer.from(publicKey, "base64url")).digest("hex");
  const artifact = crypto.createHash("sha256").update(`artifact-${suffix}`).digest("hex");
  const task = suffix;
  const base = {
    taskRef: task,
    artifactSha256: artifact,
    intendedActor: actor,
    coordinationActor: actor,
    publicKey,
    keyFingerprint: fingerprint,
    contextDigest: crypto.createHash("sha256").update(`context-${suffix}`).digest("hex"),
  };
  const sign = (payload: Record<string, unknown>) =>
    crypto.sign(null, Buffer.from(canonicalJson(payload)), keyPair.privateKey).toString("base64url");

  // The normal CLI omits contextDigest. Identical concurrent retries must converge.
  const { contextDigest: _omittedContext, ...withoutContext } = base;
  const concurrentChallenges = await Promise.all([
    ownership.createChallenge({ ...withoutContext, taskRef: `${Number(task) + 10}`, idempotencyKey: `concurrent-${suffix}` }),
    ownership.createChallenge({ ...withoutContext, taskRef: `${Number(task) + 10}`, idempotencyKey: `concurrent-${suffix}` }),
  ]);
  assert.equal(concurrentChallenges[0].challengeId, concurrentChallenges[1].challengeId);

  // Fingerprints are checked against the actual DER key, not an actor-supplied label.
  await codeOf(ownership.createChallenge({ ...base, keyFingerprint: "0".repeat(64), idempotencyKey: `fp-${suffix}` }), "INVALID_KEY_FINGERPRINT");
  const challenge = await ownership.createChallenge({ ...base, idempotencyKey: `idem-${suffix}` });
  const replay = await ownership.createChallenge({ ...base, idempotencyKey: `idem-${suffix}` });
  assert.equal(replay.challengeId, challenge.challengeId);
  await codeOf(ownership.createChallenge({ ...base, artifactSha256: "b".repeat(64), idempotencyKey: `idem-${suffix}` }), "IDEMPOTENCY_CONFLICT");
  await codeOf(ownership.getChallenge(challenge.challengeId, "luca-other"), "CHALLENGE_NOT_FOUND");

  // Two founders racing to approve one task converge on one active receipt.
  const approvals = await Promise.allSettled([
    ownership.decideChallenge(challenge.challengeId, "approved", founder, "accept"),
    ownership.decideChallenge(challenge.challengeId, "approved", founder, "accept"),
  ]);
  assert.ok(
    approvals.every((result) => result.status === "fulfilled"),
    `concurrent approval outcomes: ${JSON.stringify(approvals.map(result => (
      result.status === "fulfilled"
        ? { status: result.status, value: result.value }
        : { status: result.status, reason: result.reason instanceof Error ? result.reason.message : String(result.reason) }
    )))}`,
  );
  const receipt = (approvals[0] as PromiseFulfilledResult<{ id: string }>).value;
  assert.ok(approvals.every((result) => (result as PromiseFulfilledResult<{ id: string }>).value.id === receipt.id));
  const active = await db.execute(sql`SELECT id FROM task_ownership_receipts WHERE task_ref = ${task} AND status = 'active'`);
  assert.equal(active.rows.length, 1);
  const events = await db.execute(sql`SELECT decision FROM task_ownership_decision_events WHERE challenge_id = ${challenge.challengeId}`);
  assert.equal(events.rows.filter((row) => row.decision === "approved").length, 1);

  const rejectedChallenge = await ownership.createChallenge({ ...base, taskRef: `${Number(task) + 1}`, idempotencyKey: `reject-${suffix}` });
  assert.deepEqual(await ownership.decideChallenge(rejectedChallenge.challengeId, "rejected", founder, "no"), { status: "rejected" });

  const nonce = await ownership.issueProofNonce(receipt.id, actor);
  const signature = sign(nonce.signedPayload);
  await codeOf(ownership.verifyProof(nonce.nonceId, "bad-signature", actor), "SIGNATURE_INVALID");
  const badAttempt = await db.execute(sql`SELECT success, error_code FROM task_ownership_proof_attempts WHERE nonce_id = ${nonce.nonceId}`);
  assert.deepEqual(badAttempt.rows, [{ success: false, error_code: "SIGNATURE_INVALID" }]);
  await codeOf(ownership.verifyProof(nonce.nonceId, signature, actor), "NONCE_REPLAYED");

  const validNonce = await ownership.issueProofNonce(receipt.id, actor);
  assert.equal((await ownership.verifyProof(validNonce.nonceId, sign(validNonce.signedPayload), actor)).verified, true);
  const concurrentNonce = await ownership.issueProofNonce(receipt.id, actor);
  const concurrent = await Promise.allSettled([
    ownership.verifyProof(concurrentNonce.nonceId, sign(concurrentNonce.signedPayload), actor),
    ownership.verifyProof(concurrentNonce.nonceId, sign(concurrentNonce.signedPayload), actor),
  ]);
  assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(concurrent.filter((result) => result.status === "rejected").length, 1);
  const concurrentAttempts = await db.execute(sql`SELECT id FROM task_ownership_proof_attempts WHERE nonce_id = ${concurrentNonce.nonceId}`);
  assert.equal(concurrentAttempts.rows.length, 1);
  await codeOf(ownership.issueProofNonce(receipt.id, "luca-wrong"), "RECEIPT_NOT_ACTIVE");

  // Revocation leaves a decision event and prevents further proofs.
  assert.deepEqual(await ownership.revokeReceipt(receipt.id, founder, "retire"), { status: "revoked" });
  const revokedNonce = await ownership.issueProofNonce(
    (await ownership.createChallenge({ ...base, taskRef: `${Number(task) + 2}`, idempotencyKey: `revoked-${suffix}` })
      .then((c) => ownership.decideChallenge(c.challengeId, "approved", founder))).id,
    actor,
  );
  const revokedReceipt = (await db.execute(sql`SELECT receipt_id FROM task_ownership_proof_nonces WHERE id = ${revokedNonce.nonceId}`)).rows[0].receipt_id as string;
  await ownership.revokeReceipt(revokedReceipt, founder, "evidence");
  await codeOf(ownership.verifyProof(revokedNonce.nonceId, sign(revokedNonce.signedPayload), actor), "RECEIPT_NOT_ACTIVE");
  const revokedAttempt = await db.execute(sql`SELECT error_code FROM task_ownership_proof_attempts WHERE nonce_id = ${revokedNonce.nonceId}`);
  assert.equal(revokedAttempt.rows[0].error_code, "RECEIPT_NOT_ACTIVE");

  // An expired receipt also records a failed proof attempt.
  const expiredChallenge = await ownership.createChallenge({ ...base, taskRef: `${Number(task) + 3}`, idempotencyKey: `expired-${suffix}` });
  const expiredReceipt = await ownership.decideChallenge(expiredChallenge.challengeId, "approved", founder);
  const expiredNonce = await ownership.issueProofNonce(expiredReceipt.id, actor);
  await db.execute(sql`UPDATE task_ownership_receipts SET status = 'expired', revoked_at = now() WHERE id = ${expiredReceipt.id}`);
  await codeOf(ownership.verifyProof(expiredNonce.nonceId, sign(expiredNonce.signedPayload), actor), "RECEIPT_NOT_ACTIVE");
  const expiredAttempt = await db.execute(sql`SELECT error_code FROM task_ownership_proof_attempts WHERE nonce_id = ${expiredNonce.nonceId}`);
  assert.equal(expiredAttempt.rows[0].error_code, "RECEIPT_NOT_ACTIVE");

  // Lifecycle transitions do not permit resurrection or provenance mutation.
  await sqlRejected(
    db.execute(sql`UPDATE task_ownership_receipts SET status = 'active' WHERE id = ${receipt.id}`),
    "invalid task ownership receipt transition",
  );
  await sqlRejected(
    db.execute(sql`UPDATE task_ownership_receipts SET task_ref = ${`${Number(task) + 99}`} WHERE id = ${expiredReceipt.id}`),
    "invalid task ownership receipt transition",
  );
  await sqlRejected(
    db.execute(sql`UPDATE task_ownership_challenges SET status = 'pending' WHERE id = ${challenge.challengeId}`),
    "invalid task ownership challenge transition",
  );
  await sqlRejected(
    db.execute(sql`UPDATE task_ownership_challenges SET task_ref = ${`${Number(task) + 98}`} WHERE id = ${challenge.challengeId}`),
    "invalid task ownership challenge transition",
  );

  // Evidence is append-only, and all protocol rows reject deletion.
  const eventId = (await db.execute(sql`SELECT id FROM task_ownership_decision_events WHERE challenge_id = ${challenge.challengeId} LIMIT 1`)).rows[0].id as string;
  const attemptId = (await db.execute(sql`SELECT id FROM task_ownership_proof_attempts WHERE nonce_id = ${nonce.nonceId} LIMIT 1`)).rows[0].id as string;
  await sqlRejected(db.execute(sql`UPDATE task_ownership_decision_events SET reason = 'tampered' WHERE id = ${eventId}`), "evidence is immutable");
  await sqlRejected(db.execute(sql`DELETE FROM task_ownership_decision_events WHERE id = ${eventId}`), "evidence is immutable");
  await sqlRejected(db.execute(sql`UPDATE task_ownership_proof_attempts SET error_code = 'tampered' WHERE id = ${attemptId}`), "evidence is immutable");
  await sqlRejected(db.execute(sql`DELETE FROM task_ownership_proof_attempts WHERE id = ${attemptId}`), "evidence is immutable");
  await sqlRejected(db.execute(sql`DELETE FROM task_ownership_challenges WHERE id = ${challenge.challengeId}`), "evidence is immutable");
  await sqlRejected(db.execute(sql`DELETE FROM task_ownership_receipts WHERE id = ${receipt.id}`), "evidence is immutable");
  await sqlRejected(db.execute(sql`DELETE FROM task_ownership_proof_nonces WHERE id = ${nonce.nonceId}`), "evidence is immutable");
});