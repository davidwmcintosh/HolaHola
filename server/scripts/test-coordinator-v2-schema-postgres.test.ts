import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

function disposableTarget(): string | undefined {
  const url = process.env.NEON_SHARED_DATABASE_URL;
  if (!url) return undefined;
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
       (id, session_id, sequence, from_state, to_state, event_type, actor_type, actor_id)
       VALUES ($1, $2, 1, 'verifying', 'succeeded', 'completion_accepted', 'server', 'schema-test')`,
      [id("event"), id("session")],
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
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    await client.end();
  }
});