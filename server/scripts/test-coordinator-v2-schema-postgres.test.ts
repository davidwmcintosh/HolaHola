import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

function disposableTarget(): string | undefined {
  const url = process.env.NEON_SHARED_DATABASE_URL;
  if (!url) {
    if (process.env.COORDINATOR_V2_REQUIRE_DATABASE_TESTS === "1") {
      throw new Error("COORDINATOR_V2_TEST_DATABASE_URL is required by the migration gate");
    }
    return undefined;
  }
  if (process.env.COORDINATOR_V2_TEST_DATABASE_DISPOSABLE !== "1") {
    throw new Error("COORDINATOR_V2_TEST_DATABASE_DISPOSABLE=1 is required");
  }
  if (process.env.COORDINATOR_V2_TEST_DATABASE_URL !== url) {
    throw new Error("Coordinator V2 schema test requires the gate-provided disposable database URL");
  }
  if (url === process.env.COORDINATOR_V2_FORBIDDEN_SHARED_URL) {
    throw new Error("Coordinator V2 schema test refuses the shared Neon database");
  }
  return url;
}

async function rejectCode(
  client: pg.Client,
  savepoint: string,
  action: () => Promise<unknown>,
  code: string,
) {
  await client.query(`SAVEPOINT ${savepoint}`);
  try {
    await assert.rejects(action(), (error: unknown) => (error as { code?: string })?.code === code);
  } finally {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  }
}

test("Coordinator V2 PostgreSQL authority constraints reject mutation and lease conflict", async (context) => {
  const url = disposableTarget();
  if (!url) {
    context.skip("run through the Neon migration gate");
    return;
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const id = (kind: string) => `v2-schema-${kind}-${suffix}`;
  const digest = (character: string) => character.repeat(64);

  try {
    const nullKeys = await client.query(
      `SELECT
         (SELECT count(*) FROM coordination_v2_session_events WHERE request_key IS NULL) AS session_nulls,
         (SELECT count(*) FROM coordination_v2_attempt_events WHERE request_key IS NULL) AS attempt_nulls`,
    );
    assert.equal(Number(nullKeys.rows[0].session_nulls), 0);
    assert.equal(Number(nullKeys.rows[0].attempt_nulls), 0);
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO coordination_v2_host_enrollments
       (id, host_key, host_type, display_name, protocol_version, public_key, key_fingerprint,
        capabilities, enrollment_digest, status, created_by)
       VALUES ($1, $2, 'windows', 'Disposable test host', 1, 'test-public-key', $3,
        ARRAY['powershell'], $4, 'active', 'schema-test')`,
      [id("host"), id("host-key"), digest("a"), digest("b")],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_identities
       (id, policy_key, display_name, status, created_by)
       VALUES ($1, $2, 'Disposable test policy', 'active', 'schema-test')`,
      [id("policy"), id("policy-key")],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_versions
       (id, policy_identity_id, version, canonical_policy, policy_digest, approval_state,
        created_by, approved_by, approved_at)
       VALUES ($1, $2, 1, '{}'::jsonb, $3, 'approved', 'schema-test', 'founder-test', now())`,
      [id("policy-version"), id("policy"), digest("c")],
    );
    await client.query(
      `INSERT INTO coordination_v2_operator_grants
       (id, policy_identity_id, operator_actor, actions, issued_by, expires_at, grant_digest, request_key)
       VALUES ($1, $2, 'operator-test', ARRAY['launch'], 'founder-test', now() + interval '1 hour', $3, $4)`,
      [id("grant"), id("policy"), digest("d"), id("grant-request")],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_identities
       (id, policy_key, display_name, status, created_by)
       VALUES ($1, $2, 'Second disposable policy', 'active', 'schema-test')`,
      [id("policy-two"), id("policy-key-two")],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_versions
       (id, policy_identity_id, version, canonical_policy, policy_digest, approval_state,
        created_by, approved_by, approved_at)
       VALUES ($1, $2, 1, '{}'::jsonb, $3, 'approved', 'schema-test', 'founder-test', now())`,
      [id("policy-version-two"), id("policy-two"), digest("0")],
    );
    await client.query(
      `INSERT INTO coordination_v2_operator_grants
       (id, policy_identity_id, operator_actor, actions, issued_by, expires_at, grant_digest, request_key)
       VALUES ($1, $2, 'operator-two', ARRAY['launch'], 'founder-test', now() + interval '1 hour', $3, $4)`,
      [id("grant-two"), id("policy-two"), digest("1"), id("grant-request-two")],
    );
    await rejectCode(
      client,
      "policy_audit_mismatched_version_identity",
      () => client.query(
        `INSERT INTO coordination_v2_policy_audit_events
         (id, policy_identity_id, policy_version_id, actor_type, actor_id, action, request_key, request_digest, success)
         VALUES ($1, $2, $3, 'founder', 'schema-test', 'policy_approved', $4, $5, TRUE)`,
        [id("bad-audit-version"), id("policy"), id("policy-version-two"), id("bad-request-version"), digest("2")],
      ),
      "23503",
    );
    await rejectCode(
      client,
      "policy_audit_mismatched_grant_identity",
      () => client.query(
        `INSERT INTO coordination_v2_policy_audit_events
         (id, policy_identity_id, operator_grant_id, actor_type, actor_id, action, request_key, request_digest, success)
         VALUES ($1, $2, $3, 'founder', 'schema-test', 'grant_issued', $4, $5, TRUE)`,
        [id("bad-audit-grant"), id("policy"), id("grant-two"), id("bad-request-grant"), digest("3")],
      ),
      "23503",
    );
    await rejectCode(
      client,
      "policy_audit_bad_action_shape",
      () => client.query(
        `INSERT INTO coordination_v2_policy_audit_events
         (id, policy_identity_id, actor_type, actor_id, action, request_key, request_digest, success)
         VALUES ($1, $2, 'founder', 'schema-test', 'grant_issued', $3, $4, TRUE)`,
        [id("bad-audit-shape"), id("policy"), id("bad-request-shape"), digest("4")],
      ),
      "23514",
    );
    await rejectCode(
      client,
      "policy_audit_metadata_bound",
      () => client.query(
        `INSERT INTO coordination_v2_policy_audit_events
         (id, policy_identity_id, policy_version_id, actor_type, actor_id, action,
          request_key, request_digest, success, metadata)
         VALUES ($1, $2, $3, 'founder', 'schema-test', 'policy_approved', $4, $5, TRUE, $6::jsonb)`,
        [
          id("bad-audit-metadata"), id("policy"), id("policy-version"),
          id("bad-request-metadata"), digest("5"),
          JSON.stringify({ oversized: "x".repeat(20_000) }),
        ],
      ),
      "23514",
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_audit_events
       (id, policy_identity_id, operator_grant_id, actor_type, actor_id,
        action, request_key, request_digest, success, metadata)
       VALUES ($1, $2, $3, 'founder', 'schema-test', 'grant_issued', $4, $5, TRUE, '{}'::jsonb)`,
      [id("audit"), id("policy"), id("grant"), id("audit-request"), digest("6")],
    );
    await rejectCode(
      client,
      "policy_audit_mutation",
      () => client.query(
        `UPDATE coordination_v2_policy_audit_events SET success = FALSE WHERE id = $1`,
        [id("audit")],
      ),
      "23514",
    );
    await rejectCode(
      client,
      "policy_audit_delete",
      () => client.query(`DELETE FROM coordination_v2_policy_audit_events WHERE id = $1`, [id("audit")]),
      "23514",
    );
    await client.query(
      `INSERT INTO coordination_v2_sessions
       (id, policy_version_id, operator_grant_id, operator_actor, task_ref, task_artifact_sha256,
        repository_identity, starting_commit, enrolled_host_id, requested_providers, expires_at,
        attempt_budget, required_validations, completion_criteria, state, terminal_reason,
        terminal_at, idempotency_key, session_digest)
       VALUES ($1, $2, $3, 'operator-test', '1', $4, 'repo/test', $5, $6, ARRAY['gemini'],
        now() + interval '1 hour', 1, ARRAY['typecheck'], '{}'::jsonb, 'succeeded',
        'accepted-evidence', now(), $7, $8)`,
      [
        id("session"), id("policy-version"), id("grant"), digest("e"),
        "1".repeat(40), id("host"), id("session-request"), digest("f"),
      ],
    );
    await client.query(
      `INSERT INTO coordination_v2_host_enrollments
       (id, host_key, host_type, display_name, protocol_version, public_key, key_fingerprint,
        capabilities, enrollment_digest, status, created_by)
       VALUES ($1, $2, 'windows', 'Second disposable host', 1, 'test-public-key-2', $3,
        ARRAY['powershell'], $4, 'active', 'schema-test')`,
      [id("host-two"), id("host-key-two"), digest("7"), digest("8")],
    );
    await client.query(
      `INSERT INTO coordination_v2_attempts
       (id, session_id, attempt_generation, provider, model, adapter_version,
        session_ordinal, provider_ordinal, state, attempt_digest, deadline_at)
       VALUES ($1, $2, $3, 'test-provider', 'test-model', 'adapter-1', 1, 1,
        'waiting_for_host', $4, now() + interval '1 hour')`,
      [id("attempt"), id("session"), id("attempt-generation"), digest("c")],
    );
    await client.query(
      `INSERT INTO coordination_v2_cleanup_obligations
       (id, session_id, kind, terminal_outcome, terminal_reason, idempotency_key)
       VALUES ($1, $2, 'revoke_authority', 'succeeded', 'accepted-evidence', $3)`,
      [id("cleanup"), id("session"), id("cleanup-request")],
    );

    await rejectCode(
      client,
      "cleanup_terminal_mutation",
      () => client.query(
        `UPDATE coordination_v2_cleanup_obligations SET terminal_outcome = 'failed' WHERE id = $1`,
        [id("cleanup")],
      ),
      "23514",
    );

    await client.query(
        `INSERT INTO coordination_v2_session_events
         (id, session_id, sequence, from_state, to_state, event_type, actor_type, actor_id, request_key)
         VALUES ($1, $2, 1, 'verifying', 'succeeded', 'completion_accepted', 'server', 'schema-test', $3)`,
       [id("event"), id("session"), id("event-request")],
    );
    await rejectCode(
      client,
      "session_event_mutation",
      () => client.query(`UPDATE coordination_v2_session_events SET event_type = 'rewritten' WHERE id = $1`, [id("event")]),
      "23514",
    );

    await client.query(
      `INSERT INTO coordination_v2_transport_leases
       (id, session_id, enrolled_host_id, holder_instance_id, epoch, state, expires_at)
       VALUES ($1, $2, $3, 'holder-1', 1, 'active', now() + interval '5 minutes')`,
      [id("lease-1"), id("session"), id("host")],
    );
    await rejectCode(
      client,
      "duplicate_active_lease",
      () => client.query(
        `INSERT INTO coordination_v2_transport_leases
         (id, session_id, enrolled_host_id, holder_instance_id, epoch, state, expires_at)
         VALUES ($1, $2, $3, 'holder-2', 2, 'active', now() + interval '5 minutes')`,
        [id("lease-2"), id("session"), id("host")],
      ),
      "23505",
    );
    await client.query(
      `INSERT INTO coordination_v2_transport_lease_receipts
       (id, session_id, request_key, operation, actor_id, enrolled_host_id, command_digest, response_snapshot)
       VALUES ($1, $2, $3, 'poll', 'schema-test', $4, $5, '{}'::jsonb)`,
      [id("lease-receipt"), id("session"), id("lease-request"), id("host"), digest("g")],
    );
    await rejectCode(
      client,
      "duplicate_lease_receipt_request",
      () => client.query(
        `INSERT INTO coordination_v2_transport_lease_receipts
         (id, session_id, request_key, operation, actor_id, enrolled_host_id, command_digest, response_snapshot)
         VALUES ($1, $2, $3, 'poll', 'schema-test', $4, $5, '{}'::jsonb)`,
        [id("lease-receipt-two"), id("session"), id("lease-request"), id("host"), digest("h")],
      ),
      "23505",
    );
    await rejectCode(
      client,
      "bounded_reconciliation_evidence",
      () => client.query(
        `INSERT INTO coordination_v2_transport_lease_reconciliations
         (id, session_id, lease_id, enrolled_host_id, holder_instance_id, epoch,
          request_key, evidence_digest, evidence)
         VALUES ($1, $2, $3, $4, 'stale-holder', 1, $5, $6, $7::jsonb)`,
        [id("reconciliation"), id("session"), id("lease-1"), id("host"),
          id("reconciliation-request"), digest("i"), JSON.stringify({ evidence: "x".repeat(9000) })],
      ),
      "23514",
    );
    await client.query(
      `INSERT INTO coordination_v2_transport_work_claims
       (id, session_id, attempt_id, lease_id, enrolled_host_id, holder_instance_id,
        epoch, request_key, command_digest)
       VALUES ($1, $2, $3, $4, $5, 'schema-holder', 1, $6, $7)`,
      [id("claim"), id("session"), id("attempt"), id("lease-1"), id("host"),
        id("claim-request"), digest("m")],
    );
    await rejectCode(
      client,
      "work_claim_host_provenance",
      () => client.query(
        `INSERT INTO coordination_v2_transport_work_claims
         (id, session_id, attempt_id, lease_id, enrolled_host_id, holder_instance_id,
          epoch, request_key, command_digest)
         VALUES ($1, $2, $3, $4, $5, 'schema-holder-2', 1, $6, $7)`,
        [id("claim-bad-host"), id("session"), id("attempt"), id("lease-1"), id("host-two"),
          id("claim-bad-host-request"), digest("n")],
      ),
      "23503",
    );
    await rejectCode(
      client,
      "work_result_host_provenance",
      () => client.query(
        `INSERT INTO coordination_v2_transport_work_results
         (id, session_id, attempt_id, claim_id, lease_id, enrolled_host_id,
          holder_instance_id, epoch, request_key, result_digest, result)
         VALUES ($1, $2, $3, $4, $5, $6, 'schema-holder', 1, $7, $8, '{}'::jsonb)`,
        [id("result-bad-host"), id("session"), id("attempt"), id("claim"), id("lease-1"),
          id("host-two"), id("result-bad-host-request"), digest("o")],
      ),
      "23503",
    );
    await client.query(
      `INSERT INTO coordination_v2_cleanup_acknowledgements
       (id, obligation_id, session_id, enrolled_host_id, actor_id, holder_instance_id,
        transport_lease_id, transport_lease_epoch, acknowledgement_key,
        command_digest, outcome, evidence_digest)
       VALUES ($1, $2, $3, $4, 'schema-test', 'holder-1', $5, 1, $6, $7, 'acknowledged', $8)`,
      [id("ack-valid"), id("cleanup"), id("session"), id("host"), id("lease-1"),
        id("ack-valid-request"), digest("p"), digest("q")],
    );
    await rejectCode(
      client,
      "cleanup_ack_host_provenance",
      () => client.query(
        `INSERT INTO coordination_v2_cleanup_acknowledgements
         (id, obligation_id, session_id, enrolled_host_id, actor_id, holder_instance_id,
          transport_lease_id, transport_lease_epoch, acknowledgement_key,
          command_digest, outcome, evidence_digest)
         VALUES ($1, $2, $3, $4, 'schema-test', 'holder-1', $5, 1, $6, $7, 'acknowledged', $8)`,
        [id("ack-bad-host"), id("cleanup"), id("session"), id("host-two"), id("lease-1"),
          id("ack-bad-host-request"), digest("r"), digest("s")],
      ),
      "23514",
    );
    await rejectCode(
      client,
      "cleanup_ack_epoch_provenance",
      () => client.query(
        `INSERT INTO coordination_v2_cleanup_acknowledgements
         (id, obligation_id, session_id, enrolled_host_id, actor_id, holder_instance_id,
          transport_lease_id, transport_lease_epoch, acknowledgement_key,
          command_digest, outcome, evidence_digest)
         VALUES ($1, $2, $3, $4, 'schema-test', 'holder-1', $5, 2, $6, $7, 'acknowledged', $8)`,
        [id("ack-bad-epoch"), id("cleanup"), id("session"), id("host"), id("lease-1"),
          id("ack-bad-epoch-request"), digest("t"), digest("u")],
      ),
      "23503",
    );
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    await client.end();
  }
});