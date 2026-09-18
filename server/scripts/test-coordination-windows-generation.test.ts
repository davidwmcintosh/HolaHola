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
   const operatorActor = id("operator");
   const taskRef = `9${Date.now()}${Math.floor(Math.random() * 1000000)}`;
   let sessionId: string;
   const promotionId = id("promotion");
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
       capabilities,enrollment_digest,enrollment_request_key,status,created_by)
        VALUES ($1,$2,'windows','generation test host',1,'test-key',$3,ARRAY['preflight','prepare'],$4,$5,'active','generation-test')`,
      [hostId, id("host-key"), hex("fingerprint"), hex("enrollment"), id("enrollment-request")],
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
        VALUES ($1,$2,$3,ARRAY['launch','status'],'founder',
                now()+interval '1 hour',$4,$5)`,
       [grantId, identityId, operatorActor, hex("grant"), id("grant-key")],
    );
     await client.query(
       `INSERT INTO coordination_v2_source_promotions
        (id,repository_identity,promoted_commit_sha,exact_tree_sha,publication_reference,
         protected_validation_id,canonical_record_digest,operation_receipt_digest,operation_receipt_reference,state)
        VALUES ($1,'repo/test',$2,$3,$4,$5,$6,$7,$8,'published')`,
       [promotionId, commit, "b".repeat(40), id("publication"), id("validation"),
        hex("promotion-record"), hex("promotion-receipt"), id("receipt")],
     );
    await client.query("COMMIT");

    const authority = await import("../services/coordination-windows-generation");
    const firstKey = id("reserve-first");
     const preSessionInput = {
       taskRef, taskArtifactSha256: hex("artifact"), repositoryIdentity: "repo/test",
       startingCommit: commit, enrolledHostId: hostId, policyIdentityId: identityId,
       policyVersionId: versionId, operatorGrantId: grantId, operatorActor,
       reserveRequestKey: firstKey, branch: "main", publicMaterialDigest: publicDigest,
       promotionRecordId: promotionId, promotedCommitSha: commit, exactTreeSha: "b".repeat(40),
     };
    const race = await Promise.all([
       authority.reserveCoordinationWindowsPreparationBeforeSession(preSessionInput),
       authority.reserveCoordinationWindowsPreparationBeforeSession(preSessionInput),
    ]);
    assert.equal(race[0].id, race[1].id);
    assert.equal(race[0].generationId, race[1].generationId);
      const beforeAck = await client.query(
        `SELECT count(*)::int AS count FROM coordination_v2_sessions
         WHERE preparation_reservation_id = $1
            OR (task_ref = $2 AND operator_actor = $3 AND enrolled_host_id = $4
                AND policy_version_id = $5 AND operator_grant_id = $6)`,
        [race[0].id, taskRef, operatorActor, hostId, versionId, grantId],
      );
     assert.equal(beforeAck.rows[0].count, 0);
    const count = await client.query(
       "SELECT count(*)::int AS count FROM coordination_v2_preparation_reservations WHERE reserve_request_key=$1",
       [firstKey],
    );
    assert.equal(count.rows[0].count, 1);
    await assert.rejects(
       authority.reserveCoordinationWindowsPreparationBeforeSession({
         ...preSessionInput, taskArtifactSha256: hex("conflicting-artifact"),
       }),
       (error: unknown) => (error as { code?: string }).code === "PREPARATION_REPLAY_CONFLICT",
    );
     const exactReplay = await authority.reserveCoordinationWindowsPreparationBeforeSession(preSessionInput);
    assert.equal(exactReplay.id, race[0].id);
    assert.equal(exactReplay.generationId, race[0].generationId);
     const promoted = await authority.promoteCoordinationWindowsPreparationBeforeSession({
       reservationId: race[0].id, actorId: operatorActor, generationId: race[0].generationId,
       publicMaterialDigest: publicDigest, safePromotionEvidenceDigest: hex("evidence"),
    });
     const promotedReplay = await authority.promoteCoordinationWindowsPreparationBeforeSession({
       reservationId: race[0].id, actorId: operatorActor, generationId: race[0].generationId,
      publicMaterialDigest: publicDigest, safePromotionEvidenceDigest: hex("evidence"),
    });
    assert.equal(promotedReplay.promotedAt, promoted.promotedAt);
     const acknowledgementRequestKey = id("ack");
     const acknowledgementEvidence = hex("evidence");
     const acknowledgements = await Promise.all([
       authority.acknowledgeCoordinationWindowsPreparationBeforeSession({
          reservationId: race[0].id, actorId: operatorActor, generationId: race[0].generationId,
          publicMaterialDigest: publicDigest, acknowledgementRequestKey,
         safePromotionEvidenceDigest: acknowledgementEvidence,
       }),
       authority.acknowledgeCoordinationWindowsPreparationBeforeSession({
          reservationId: race[0].id, actorId: operatorActor, generationId: race[0].generationId,
          publicMaterialDigest: publicDigest, acknowledgementRequestKey,
         safePromotionEvidenceDigest: acknowledgementEvidence,
       }),
     ]);
     const acknowledged = acknowledgements[0];
     assert.equal(acknowledgements[1].sessionId, acknowledged.sessionId);
     assert.equal(acknowledgements[1].acknowledgedAt, acknowledged.acknowledgedAt);
     assert.ok(acknowledged.sessionId);
     sessionId = acknowledged.sessionId;
     const acknowledgedReplay = await authority.acknowledgeCoordinationWindowsPreparationBeforeSession({
       reservationId: race[0].id, actorId: operatorActor, generationId: race[0].generationId,
        publicMaterialDigest: publicDigest, acknowledgementRequestKey,
       safePromotionEvidenceDigest: acknowledgementEvidence,
    });
    assert.equal(acknowledgedReplay.acknowledgedAt, acknowledged.acknowledgedAt);
     const sessionExpiry = await client.query("SELECT expires_at FROM coordination_v2_sessions WHERE id=$1", [sessionId]);
     assert.ok(race[0].expiresAt <= sessionExpiry.rows[0].expires_at.toISOString());
     const base = { sessionId, actorId: operatorActor };

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
       actorId: operatorActor,
      reservationId: second.id,
      generationId: second.generationId,
    });
    assert.equal(recovered.state, "expired");
    assert.ok(recovered.expiredAt);
    const recoveredReplay = await authority.recoverCoordinationWindowsPreparation({
      sessionId: expiringSessionId,
       actorId: operatorActor,
      reservationId: second.id,
      generationId: second.generationId,
    });
    assert.equal(recoveredReplay.expiredAt, recovered.expiredAt);
    const statusRead = await authority.readCoordinationWindowsPreparation({
      sessionId: expiringSessionId,
       actorId: operatorActor,
      reservationId: second.id,
    });
    assert.equal(statusRead?.id, second.id);
    await assert.rejects(
      authority.promoteCoordinationWindowsPreparation({
        sessionId: expiringSessionId,
        actorId: operatorActor,
        reservationId: second.id,
        generationId: race[0].generationId,
        publicMaterialDigest: publicDigest, safePromotionEvidenceDigest: hex("evidence"),
      }),
      (error: unknown) => ["PREPARATION_CONFLICT", "PREPARATION_NOT_FOUND"].includes((error as { code?: string }).code ?? ""),
    );
    await assert.rejects(
      authority.acknowledgeCoordinationWindowsPreparation({
        sessionId: expiringSessionId,
        actorId: operatorActor,
        reservationId: second.id,
        generationId: second.generationId,
        publicMaterialDigest: publicDigest, protocolVersion: 1, acknowledgementRequestKey: id("bad-ack"),
        safePromotionEvidenceDigest: hex("evidence"),
      }),
      (error: unknown) => (error as { code?: string }).code === "PREPARATION_CONFLICT",
    );

     const events = await client.query(
       `SELECT from_state,to_state,event_type,sequence,created_at,metadata,request_key
        FROM coordination_v2_session_events
       WHERE session_id=$1 ORDER BY sequence`, [sessionId],
    );
     const reservationEvidence = await client.query(
       `SELECT created_at,promoted_at,acknowledged_at,reserve_request_key,reserve_command_digest,
               safe_promotion_evidence_digest,acknowledgement_request_key,ack_command_digest
          FROM coordination_v2_preparation_reservations WHERE id=$1`, [race[0].id],
     );
     assert.equal(events.rowCount, 3, "duplicate acknowledgement must not duplicate preparation history");
    assert.deepEqual(
      events.rows.map((event) => event.event_type),
       ["preparation_reserved", "preparation_promoted", "preparation_acknowledged"],
    );
     const storedReservation = reservationEvidence.rows[0];
     assert.equal(events.rows[0].created_at.getTime(), storedReservation.created_at.getTime());
     assert.equal(events.rows[1].created_at.getTime(), storedReservation.promoted_at.getTime());
     assert.equal(events.rows[2].created_at.getTime(), storedReservation.acknowledged_at.getTime());
     assert.equal(events.rows[0].metadata.reserveRequestKey, storedReservation.reserve_request_key);
     assert.equal(events.rows[0].metadata.reserveCommandDigest, storedReservation.reserve_command_digest);
     assert.equal(events.rows[1].metadata.safePromotionEvidenceDigest, storedReservation.safe_promotion_evidence_digest);
     assert.equal(events.rows[2].metadata.acknowledgementRequestKey, storedReservation.acknowledgement_request_key);
     assert.equal(events.rows[2].metadata.ackCommandDigest, storedReservation.ack_command_digest);
     assert.deepEqual(events.rows.map((event) => event.sequence), [1, 2, 3]);
     assert.ok(events.rows.every((event) => event.from_state === "ready" && event.to_state === "ready"));

    const promotedRow = await authority.reserveCoordinationWindowsPreparation({
      ...base, reserveRequestKey: id("reserve-promoted"),
    });
    const promotedAuthority = await authority.promoteCoordinationWindowsPreparation({
       sessionId, actorId: operatorActor, reservationId: promotedRow.id, generationId: promotedRow.generationId,
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