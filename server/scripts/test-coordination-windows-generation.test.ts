import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { canonicalizeAndHashPolicy } from "../services/coordination-policy-canonicalization";

function disposableTarget(): string | undefined {
  const requiredByGate = process.env.COORDINATOR_V2_REQUIRE_DATABASE_TESTS === "1";
  const url = process.env.NEON_SHARED_DATABASE_URL;
  if (!url) {
    if (requiredByGate) {
      throw new Error("COORDINATOR_V2_TEST_DATABASE_URL is required by the migration gate");
    }
    return undefined;
  }
  if (!requiredByGate) return undefined;
  const forbiddenSharedUrl = process.env.COORDINATOR_V2_FORBIDDEN_SHARED_URL;
  if (process.env.COORDINATOR_V2_TEST_DATABASE_DISPOSABLE !== "1"
    || !process.env.COORDINATOR_V2_TEST_DATABASE_URL
    || process.env.COORDINATOR_V2_TEST_DATABASE_URL !== url
    || !forbiddenSharedUrl
    || forbiddenSharedUrl === url) {
    throw new Error("Coordinator V2 generation tests require the gate-provided disposable database URL");
  }
  return url;
}

test("Windows preparation authority transaction and lifecycle matrix", async (context) => {
  const url = disposableTarget();
  if (!url) { context.skip("requires a verified disposable PostgreSQL URL"); return; }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const suffix = `${Date.now()}-${randomUUID()}`;
  const id = (kind: string) => `generation-test-${kind}-${suffix}`;
  const hex = (kind: string) => createHash("sha256").update(`${suffix}:${kind}`).digest("hex");
  const hostId = id("host");
  const identityId = id("identity");
  const versionId = id("version");
  const grantId = id("grant");
  const sessionId = id("session");
  const publicDigest = hex("public");
  const policy = canonicalizeAndHashPolicy({
    hostTypes: ["windows"],
    hostConstraints: {
      windowsRepositoryBranch: "main",
      windowsPublicMaterialDigest: publicDigest,
    },
    providerOrder: ["test"],
    sessionDurationMs: 900_000,
    totalAttemptBudget: 2,
    requiredValidationCommands: ["typecheck"],
  });
  assert.throws(() => canonicalizeAndHashPolicy({
    providerOrder: ["test"], sessionDurationMs: 900_000, totalAttemptBudget: 2,
    windowsRepositoryBranch: "main",
  }));
  const commit = "a".repeat(40);
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO coordination_v2_host_enrollments
       (id,host_key,host_type,display_name,protocol_version,public_key,key_fingerprint,
        capabilities,enrollment_digest,status,created_by)
        VALUES ($1,$2,'windows','generation test host',1,'test-key',$3,ARRAY['preflight','prepare'],$4,'active','generation-test')`,
      [hostId, id("host-key"), hex("fingerprint"), hex("enrollment")],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_identities
       (id,policy_key,display_name,status,created_by)
       VALUES ($1,$2,'generation test policy','active','generation-test')`,
      [identityId, id("policy-key")],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_versions
       (id,policy_identity_id,version,canonical_policy,policy_digest,approval_state,
        created_by,approved_by,approved_at)
       VALUES ($1,$2,1,$3::jsonb,$4,'approved','generation-test','founder',now())`,
      [versionId, identityId, JSON.stringify(policy.canonicalPolicy), policy.policyDigest],
    );
    await client.query(
      `INSERT INTO coordination_v2_operator_grants
       (id,policy_identity_id,operator_actor,actions,issued_by,expires_at,grant_digest,request_key)
       VALUES ($1,$2,'operator-test',ARRAY['launch','status'],'founder',
               now()+interval '1 hour',$3,$4)`,
      [grantId, identityId, hex("grant"), id("grant-key")],
    );
    await client.query(
      `INSERT INTO coordination_v2_sessions
       (id,policy_version_id,operator_grant_id,operator_actor,task_ref,task_artifact_sha256,
        repository_identity,starting_commit,enrolled_host_id,requested_providers,expires_at,
        attempt_budget,per_provider_budgets,required_validations,completion_criteria,state,
        idempotency_key,session_digest)
       VALUES ($1,$2,$3,'operator-test','1',$4,'repo/test',$5,$6,ARRAY['test'],
               now()+interval '20 minutes',2,'{}'::jsonb,ARRAY['typecheck'],'{}'::jsonb,
               'preparing',$7,$8)`,
      [sessionId, versionId, grantId, hex("artifact"), commit, hostId, id("session-key"), hex("session")],
    );
    await client.query("COMMIT");

    const authority = await import("../services/coordination-windows-generation");
    const base = {
      sessionId, actorId: "operator-test",
    };
    const firstKey = id("reserve-first");
    const race = await Promise.all([
      authority.reserveCoordinationWindowsPreparation({ ...base, reserveRequestKey: firstKey }),
      authority.reserveCoordinationWindowsPreparation({ ...base, reserveRequestKey: firstKey }),
    ]);
    assert.equal(race[0].id, race[1].id);
    assert.equal(race[0].generationId, race[1].generationId);
    const count = await client.query(
      "SELECT count(*)::int AS count FROM coordination_v2_preparation_reservations WHERE session_id=$1",
      [sessionId],
    );
    assert.equal(count.rows[0].count, 1);
    const sessionExpiry = await client.query("SELECT expires_at FROM coordination_v2_sessions WHERE id=$1", [sessionId]);
    assert.ok(race[0].expiresAt <= sessionExpiry.rows[0].expires_at.toISOString());
    await assert.rejects(
      authority.reserveCoordinationWindowsPreparation({
        ...base,
        reserveRequestKey: id("reserve-distinct"),
      }),
      (error: unknown) => (error as { code?: string }).code === "PREPARATION_CONFLICT",
    );

    await assert.rejects(
      client.query(
        `UPDATE coordination_v2_policy_versions
         SET canonical_policy=$1::jsonb WHERE id=$2`,
        [JSON.stringify({
          ...policy.canonicalPolicy,
          hostConstraints: { windowsRepositoryBranch: "release", windowsPublicMaterialDigest: publicDigest },
        }), versionId],
      ),
    );
    const exactReplay = await authority.reserveCoordinationWindowsPreparation({
      ...base, reserveRequestKey: firstKey,
    });
    assert.equal(exactReplay.id, race[0].id);
    assert.equal(exactReplay.generationId, race[0].generationId);
    const active = await client.query(
      `SELECT count(*)::int AS count FROM coordination_v2_preparation_reservations
       WHERE session_id=$1 AND state IN ('reserved','promoted')`, [sessionId],
    );
    assert.equal(active.rows[0].count, 1);

    const promoted = await authority.promoteCoordinationWindowsPreparation({
      sessionId, actorId: "operator-test", reservationId: race[0].id, generationId: race[0].generationId,
      publicMaterialDigest: publicDigest, safePromotionEvidenceDigest: hex("evidence"),
    });
    const promotedReplay = await authority.promoteCoordinationWindowsPreparation({
      sessionId, actorId: "operator-test", reservationId: race[0].id, generationId: race[0].generationId,
      publicMaterialDigest: publicDigest, safePromotionEvidenceDigest: hex("evidence"),
    });
    assert.equal(promotedReplay.promotedAt, promoted.promotedAt);
    const acknowledged = await authority.acknowledgeCoordinationWindowsPreparation({
      sessionId, actorId: "operator-test", reservationId: race[0].id, generationId: race[0].generationId,
      publicMaterialDigest: publicDigest, protocolVersion: 1, acknowledgementRequestKey: id("ack"),
      safePromotionEvidenceDigest: hex("evidence"),
    });
    const acknowledgedReplay = await authority.acknowledgeCoordinationWindowsPreparation({
      sessionId, actorId: "operator-test", reservationId: race[0].id, generationId: race[0].generationId,
      publicMaterialDigest: publicDigest, protocolVersion: 1, acknowledgementRequestKey: id("ack"),
      safePromotionEvidenceDigest: hex("evidence"),
    });
    assert.equal(acknowledgedReplay.acknowledgedAt, acknowledged.acknowledgedAt);
    await assert.rejects(
      authority.acknowledgeCoordinationWindowsPreparation({
        sessionId, actorId: "operator-test", reservationId: race[0].id, generationId: race[0].generationId,
        publicMaterialDigest: publicDigest, protocolVersion: 1, acknowledgementRequestKey: id("ack-changed"),
        safePromotionEvidenceDigest: hex("different-evidence"),
      }),
      (error: unknown) => (error as { code?: string }).code === "PREPARATION_REPLAY_CONFLICT",
    );

    const expiringSessionId = id("expiring-session");
    await client.query(
      `INSERT INTO coordination_v2_sessions
       (id,policy_version_id,operator_grant_id,operator_actor,task_ref,task_artifact_sha256,
        repository_identity,starting_commit,enrolled_host_id,requested_providers,expires_at,
        attempt_budget,per_provider_budgets,required_validations,completion_criteria,state,
        idempotency_key,session_digest)
       SELECT $1,policy_version_id,operator_grant_id,operator_actor,task_ref,task_artifact_sha256,
        repository_identity,starting_commit,enrolled_host_id,requested_providers,
        clock_timestamp()+interval '2 seconds',attempt_budget,per_provider_budgets,
        required_validations,completion_criteria,state,$2,$3
       FROM coordination_v2_sessions WHERE id=$4`,
      [expiringSessionId, id("expiring-session-key"), hex("expiring-session"), sessionId],
    );
    const second = await authority.reserveCoordinationWindowsPreparation({
      sessionId: expiringSessionId,
      actorId: base.actorId,
      reserveRequestKey: id("reserve-second"),
    });
    await new Promise((resolve) => setTimeout(resolve, 2_100));
    const recovered = await authority.recoverCoordinationWindowsPreparation({
      sessionId: expiringSessionId,
      actorId: "operator-test",
      reservationId: second.id,
      generationId: second.generationId,
    });
    assert.equal(recovered.state, "expired");
    assert.ok(recovered.expiredAt);
    const recoveredReplay = await authority.recoverCoordinationWindowsPreparation({
      sessionId: expiringSessionId,
      actorId: "operator-test",
      reservationId: second.id,
      generationId: second.generationId,
    });
    assert.equal(recoveredReplay.expiredAt, recovered.expiredAt);
    const statusRead = await authority.readCoordinationWindowsPreparation({
      sessionId: expiringSessionId,
      actorId: "operator-test",
      reservationId: second.id,
    });
    assert.equal(statusRead?.id, second.id);
    await assert.rejects(
      authority.promoteCoordinationWindowsPreparation({
        sessionId: expiringSessionId,
        actorId: "operator-test",
        reservationId: second.id,
        generationId: race[0].generationId,
        publicMaterialDigest: publicDigest, safePromotionEvidenceDigest: hex("evidence"),
      }),
      (error: unknown) => ["PREPARATION_CONFLICT", "PREPARATION_NOT_FOUND"].includes((error as { code?: string }).code ?? ""),
    );
    await assert.rejects(
      authority.acknowledgeCoordinationWindowsPreparation({
        sessionId: expiringSessionId,
        actorId: "operator-test",
        reservationId: second.id,
        generationId: second.generationId,
        publicMaterialDigest: publicDigest, protocolVersion: 1, acknowledgementRequestKey: id("bad-ack"),
        safePromotionEvidenceDigest: hex("evidence"),
      }),
      (error: unknown) => (error as { code?: string }).code === "PREPARATION_CONFLICT",
    );

    const events = await client.query(
      `SELECT from_state,to_state,event_type,sequence FROM coordination_v2_session_events
       WHERE session_id=$1 ORDER BY sequence`, [sessionId],
    );
    assert.deepEqual(
      events.rows.map((event) => event.event_type),
      ["preparation_reserved", "preparation_promoted", "preparation_acknowledged"],
    );
    assert.ok(events.rows.every((event) => event.from_state === "preparing" && event.to_state === "preparing"));
    assert.deepEqual(events.rows.map((event) => event.sequence), [...events.rows.keys()].map((value) => value + 1));

    const promotedRow = await authority.reserveCoordinationWindowsPreparation({
      ...base, reserveRequestKey: id("reserve-promoted"),
    });
    const promotedAuthority = await authority.promoteCoordinationWindowsPreparation({
      sessionId, actorId: "operator-test", reservationId: promotedRow.id, generationId: promotedRow.generationId,
      publicMaterialDigest: publicDigest, safePromotionEvidenceDigest: hex("promoted-evidence"),
    });
    assert.equal(promotedAuthority.state, "promoted");
    await assert.rejects(
      client.query(
        "UPDATE coordination_v2_preparation_reservations SET promoted_at=created_at WHERE id=$1",
        [promotedRow.id],
      ),
    );
    await assert.rejects(
      client.query(
        "UPDATE coordination_v2_preparation_reservations SET safe_promotion_evidence_digest=$1 WHERE id=$2",
        [hex("rewritten-evidence"), promotedRow.id],
      ),
    );
    await assert.rejects(
      client.query(
        "UPDATE coordination_v2_preparation_reservations SET state='expired' WHERE id=$1",
        [promotedRow.id],
      ),
    );
    await assert.rejects(
      client.query(
        "UPDATE coordination_v2_preparation_reservations SET generation_id='other' WHERE id=$1",
        [promotedRow.id],
      ),
    );
    await assert.rejects(
      client.query("DELETE FROM coordination_v2_preparation_reservations WHERE id=$1", [promotedRow.id]),
    );
    await assert.rejects(
      client.query("UPDATE coordination_v2_preparation_reservations SET state='reserved' WHERE id=$1", [race[0].id]),
    );
    await assert.rejects(
      client.query("UPDATE coordination_v2_preparation_reservations SET generation_id='terminal-other' WHERE id=$1", [race[0].id]),
    );
    await assert.rejects(
      client.query("DELETE FROM coordination_v2_preparation_reservations WHERE id=$1", [race[0].id]),
    );
  } finally {
    await client.end();
  }
});