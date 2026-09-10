import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import {
  CoordinationRuntimeService,
  RuntimeProtocolError,
  digestCanonical,
  type ExecutionEnvelope,
  type RuntimePrincipal,
} from "../services/coordination-runtime";
import { PostgresCoordinationRuntimeRepository } from "../services/coordination-runtime-postgres-repository";

const envelope: ExecutionEnvelope = {
  worktreeLabel: "postgres-parity",
  worktreePath: "/tmp/coordination-parity",
  argv: ["true"],
  patchDigest: null,
};

function disposableTarget(): string | undefined {
  const url = process.env.COORDINATION_RUNTIME_TEST_DATABASE_URL;
  if (!url) return undefined;
  if (process.env.COORDINATION_RUNTIME_TEST_DATABASE_DISPOSABLE !== "1") {
    throw new Error("COORDINATION_RUNTIME_TEST_DATABASE_DISPOSABLE=1 is required");
  }
  if (url === process.env.COORDINATION_RUNTIME_FORBIDDEN_SHARED_URL) {
    throw new Error("coordination parity refuses the shared Neon database");
  }
  return url;
}

function errorChainIncludes(error: unknown, needle: string): boolean {
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current instanceof Error && !seen.has(current)) {
    if (current.message.includes(needle)) return true;
    seen.add(current);
    current = current.cause;
  }
  return false;
}

test("PostgreSQL parity: complete persisted lifecycle and replay", async (context) => {
  const url = disposableTarget();
  if (!url) {
    context.skip("set COORDINATION_RUNTIME_TEST_DATABASE_URL and COORDINATION_RUNTIME_TEST_DATABASE_DISPOSABLE=1");
    return;
  }
  const suffix = `parity-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });
  const repo = new PostgresCoordinationRuntimeRepository(db);
  const now = () => 100;
  const principal: RuntimePrincipal = {
    actor: "luca-gemini",
    runtimeRegistrationId: `${suffix}-runtime`,
    credentialId: `${suffix}-credential`,
    profileId: `${suffix}-profile`,
    capabilities: ["execute", "model"],
    credentialExpiresAt: 10_000,
    runtimeEnabled: true,
    revoked: false,
  };
  const verifier: RuntimePrincipal = {
    actor: "luca-replit",
    runtimeRegistrationId: `${suffix}-verifier`,
    credentialId: `${suffix}-verifier-credential`,
    profileId: `${suffix}-verifier-profile`,
    capabilities: ["verify"],
    credentialExpiresAt: 10_000,
    runtimeEnabled: true,
    revoked: false,
  };
  const ids = {
    thread: `${suffix}-thread`,
    item1: `${suffix}-item-1`,
    item2: `${suffix}-item-2`,
    assignment: `${suffix}-assignment`,
  };
  try {
    await db.insert(schema.coordinationRuntimeRegistrations).values([
      { id: principal.runtimeRegistrationId, actor: principal.actor, displayName: suffix, bootstrapHash: digestCanonical(suffix), capabilities: principal.capabilities },
      { id: verifier.runtimeRegistrationId, actor: verifier.actor, displayName: `${suffix}-verifier`, bootstrapHash: digestCanonical(`${suffix}-v`), capabilities: verifier.capabilities },
    ]);
    await db.insert(schema.coordinationRuntimeCredentials).values([
      { id: principal.credentialId, runtimeId: principal.runtimeRegistrationId, actor: principal.actor, tokenHash: digestCanonical(`${suffix}-token`), capabilities: principal.capabilities, expiresAt: new Date("2099-01-01") },
      { id: verifier.credentialId, runtimeId: verifier.runtimeRegistrationId, actor: verifier.actor, tokenHash: digestCanonical(`${suffix}-v-token`), capabilities: verifier.capabilities, expiresAt: new Date("2099-01-01") },
    ]);
    await db.insert(schema.coordinationThreads).values({
      id: ids.thread, title: suffix, description: "PostgreSQL parity fixture",
      originActor: "alden", intendedRecipient: "luca-gemini",
    });
    const profileProvenance = {
      provider: "google",
      model: "gemini-test",
      adapterVersion: "postgres-parity-v1",
      repositoryLabel: "HolaHola",
      worktreeLabel: "postgres-parity",
      worktreeRealpathDigest: digestCanonical("/tmp/coordination-parity"),
      branch: "test/postgres-parity",
      startingCommit: "0".repeat(40),
    };
    await repo.provisionProfile({
      id: principal.profileId,
      runtimeRegistrationId: principal.runtimeRegistrationId,
      actor: principal.actor,
      capabilities: [...principal.capabilities],
      ...profileProvenance,
    });
    await repo.provisionProfile({
      id: verifier.profileId,
      runtimeRegistrationId: verifier.runtimeRegistrationId,
      actor: verifier.actor,
      capabilities: [...verifier.capabilities],
      ...profileProvenance,
    });

    await repo.addInboxItem({ id: ids.item1, eventId: `${suffix}-context`, threadId: ids.thread, taskId: `${suffix}-task`, sequence: 1, payload: { content: { context: "parity" } } });
    await repo.addInboxItem({ id: ids.item2, eventId: ids.assignment, threadId: ids.thread, taskId: `${suffix}-task`, sequence: 2, payload: { content: { assignment: "bounded" } } });
    const window = await repo.freezeInboxWindow(ids.thread, 0, 2, `${suffix}-boundary`);
    const assignment = { assignmentEventId: ids.assignment, assignmentAuthor: "alden" as const, taskId: `${suffix}-task`, threadId: ids.thread, expectedSequence: 2 };
    const service = new CoordinationRuntimeService(repo, now, () => `${suffix}-${Math.random()}`, envelope, 1_000);
    const packet = await service.createPacket(principal, window.id, assignment, "packet-key");
    assert.equal((await service.createPacket(principal, window.id, assignment, "packet-key")).id, packet.id);
    const interaction = await service.recordInteraction(principal, { packetId: packet.id, turn: 1, attempt: 1, requestDigest: digestCanonical("request"), responseDigest: digestCanonical("response"), outcome: "consumed", idempotencyKey: "interaction-key" });
    assert.equal((await service.recordInteraction(principal, { packetId: packet.id, turn: 1, attempt: 1, requestDigest: digestCanonical("request"), responseDigest: digestCanonical("response"), outcome: "consumed", idempotencyKey: "interaction-key" })).id, interaction.id);
    const receipt = await service.recordOutcomeReceipt(principal, packet.id, packet.digest, interaction.id, "receipt-key");
    const claim = await service.claim(principal, packet.id, packet.digest, receipt.id, 100, "claim-key");
    const renewed = await service.renew(principal, claim.id, claim.epoch, 100, "renew-key");
    const execution = await service.execute(principal, renewed.id, envelope, "execution-key");
    const completion = await service.complete(principal, execution.id, digestCanonical(execution), "completion-key");
    const verification = await service.verify(verifier, completion.id, completion.evidenceDigest, null, "verification-key");
    assert.equal(verification.decision, "approved");

    const fresh = new PostgresCoordinationRuntimeRepository(db);
    assert.equal((await fresh.getPacket(packet.id))?.digest, packet.digest);
    assert.equal((await fresh.getCompletion(completion.id))?.evidenceDigest, completion.evidenceDigest);
    await assert.rejects(() => service.createPacket(principal, window.id, { ...assignment, taskId: `${suffix}-changed` }, "packet-key"), (e: unknown) => e instanceof RuntimeProtocolError && e.code === "idempotency_payload_mismatch");
    assert.equal(
      (await service.recordOutcomeReceipt(principal, packet.id, packet.digest, interaction.id, "receipt-key")).id,
      receipt.id,
    );
    await assert.rejects(
      () => db.execute(sql`UPDATE coordination_runtime_packets SET digest = ${"f".repeat(64)} WHERE id = ${packet.id}`),
      (error: unknown) => errorChainIncludes(error, "immutable"),
    );
    await assert.rejects(
      () => db.execute(sql`DELETE FROM coordination_runtime_completions WHERE id = ${completion.id}`),
      (error: unknown) => errorChainIncludes(error, "immutable"),
    );
  } finally {
    await pool.end();
  }
});