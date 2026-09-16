import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

function disposableTarget(): string | undefined {
  const shared = process.env.NEON_SHARED_DATABASE_URL;
  if (!shared) {
    if (process.env.COORDINATOR_V2_REQUIRE_DATABASE_TESTS === "1") {
      throw new Error("COORDINATOR_V2_TEST_DATABASE_URL is required by the migration gate");
    }
    return undefined;
  }
  if (process.env.COORDINATOR_V2_TEST_DATABASE_DISPOSABLE !== "1") {
    throw new Error("COORDINATOR_V2_TEST_DATABASE_DISPOSABLE=1 is required");
  }
  if (!process.env.COORDINATOR_V2_TEST_DATABASE_URL || process.env.COORDINATOR_V2_TEST_DATABASE_URL !== shared) {
    throw new Error("Coordinator V2 reauthorization test requires the gate-provided disposable database URL");
  }
  if (!process.env.COORDINATOR_V2_FORBIDDEN_SHARED_URL || shared === process.env.COORDINATOR_V2_FORBIDDEN_SHARED_URL) {
    throw new Error("Coordinator V2 reauthorization test refuses the shared Neon database");
  }
  return shared;
}

const digest = (seed: string) => {
  assert.match(seed, /^[0-9a-f]$/);
  return seed.repeat(64);
};

async function rejectCode(client: pg.Client, savepoint: string, action: () => Promise<unknown>, code: string) {
  await client.query(`SAVEPOINT ${savepoint}`);
  try {
    await assert.rejects(action(), (error: unknown) => (error as { code?: string })?.code === code);
  } finally {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  }
}

test("migration 0054 enforces host credential reauthorization lineage and replay boundaries", async (context) => {
  const url = disposableTarget();
  if (!url) {
    context.skip("run through the Neon migration gate");
    return;
  }
  const client = new pg.Client({ connectionString: url });
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const id = (kind: string) => `reauth-postgres-${kind}-${suffix}`;
  const host = id("host");
  const otherHost = id("other-host");
  const request = id("request");
  const challenge = id("challenge");
  const fingerprint = digest("a");
  const unrelatedBefore = await client.connect().then(async () => (
    await client.query("SELECT count(*)::integer AS count FROM coordination_v2_host_credentials")
  )).then((result) => result.rows[0].count);

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO coordination_v2_host_enrollments
        (id, host_key, host_type, display_name, protocol_version, public_key,
         key_fingerprint, capabilities, enrollment_digest, enrollment_request_key,
         status, created_by)
       VALUES ($1, $2, 'windows', 'Reauthorization disposable host', 1, $3,
               $4, ARRAY['host:cleanup','host:transport'], $5, $6,
               'active', 'reauth-postgres-test')`,
      [host, id("host-key"), "public-key-a", fingerprint, digest("b"), id("enrollment-request")],
    );
    await client.query(
      `INSERT INTO coordination_v2_host_enrollments
        (id, host_key, host_type, display_name, protocol_version, public_key,
         key_fingerprint, capabilities, enrollment_digest, enrollment_request_key,
         status, created_by)
       VALUES ($1, $2, 'windows', 'Unrelated disposable host', 1, $3,
               $4, ARRAY['host:cleanup','host:transport'], $5, $6,
               'active', 'reauth-postgres-test')`,
      [otherHost, id("other-key"), "public-key-b", digest("c"), digest("d"), id("other-enrollment-request")],
    );

    await client.query(
      `INSERT INTO coordination_v2_host_reauthorization_requests
       (id, host_enrollment_id, key_fingerprint, protocol_version, request_generation,
        request_key, declaration_digest, request_signature_digest, state, requested_at, expires_at)
       VALUES ($1, $2, $3, 1, 1, $4, $5, $6, 'pending', now(), now() + interval '1 hour')`,
      [request, host, fingerprint, id("request-key"), digest("e"), digest("f")],
    );
    const requestTimes = await client.query(
      `SELECT extract(epoch FROM expires_at - requested_at)::integer AS lifetime_seconds
         FROM coordination_v2_host_reauthorization_requests
        WHERE id = $1`,
      [request],
    );
    assert.equal(requestTimes.rows[0].lifetime_seconds, 3600);

    await rejectCode(client, "reauth_second_pending", () => client.query(
      `INSERT INTO coordination_v2_host_reauthorization_requests
       (id, host_enrollment_id, key_fingerprint, protocol_version, request_generation,
        request_key, declaration_digest, request_signature_digest, state, requested_at, expires_at)
       VALUES ($1, $2, $3, 1, 2, $4, $5, $6, 'pending', now(), now() + interval '1 hour')`,
      [id("second-request"), host, fingerprint, id("second-key"), digest("0"), digest("1")],
    ), "23505");

    await rejectCode(client, "reauth_bad_protocol", () => client.query(
      `INSERT INTO coordination_v2_host_reauthorization_requests
       (id, host_enrollment_id, key_fingerprint, protocol_version, request_generation,
        request_key, declaration_digest, request_signature_digest, state, requested_at, expires_at)
       VALUES ($1, $2, $3, 2, 3, $4, $5, $6, 'pending', now(), now() + interval '1 hour')`,
      [id("bad-protocol"), host, fingerprint, id("bad-protocol-key"), digest("2"), digest("3")],
    ), "23514");

    await client.query(
      `INSERT INTO coordination_v2_host_reauthorization_challenges
       (id, request_id, host_enrollment_id, key_fingerprint, protocol_version,
        request_generation, nonce_digest, challenge_digest, issued_at, expires_at)
       VALUES ($1, $2, $3, $4, 1, 1, $5, $6, now(), now() + interval '2 minutes')`,
      [challenge, request, host, fingerprint, digest("4"), digest("5")],
    );
    const challengeTimes = await client.query(
      `SELECT extract(epoch FROM expires_at - issued_at)::integer AS lifetime_seconds
         FROM coordination_v2_host_reauthorization_challenges
        WHERE id = $1`,
      [challenge],
    );
    assert.equal(challengeTimes.rows[0].lifetime_seconds, 120);

    await rejectCode(client, "reauth_second_live_challenge", () => client.query(
      `INSERT INTO coordination_v2_host_reauthorization_challenges
       (id, request_id, host_enrollment_id, key_fingerprint, protocol_version,
        request_generation, nonce_digest, challenge_digest, issued_at, expires_at)
       VALUES ($1, $2, $3, $4, 1, 1, $5, $6, now(), now() + interval '2 minutes')`,
      [id("second-challenge"), request, host, fingerprint, digest("6"), digest("7")],
    ), "23505");

    await client.query(
      `UPDATE coordination_v2_host_reauthorization_challenges
          SET consumed_at = now()
        WHERE id = $1`,
      [challenge],
    );

    await rejectCode(client, "reauth_cross_lineage", () => client.query(
      `INSERT INTO coordination_v2_host_reauthorization_challenges
       (id, request_id, host_enrollment_id, key_fingerprint, protocol_version,
        request_generation, nonce_digest, challenge_digest, issued_at, expires_at)
       VALUES ($1, $2, $3, $4, 1, 1, $5, $6, now(), now() + interval '2 minutes')`,
      [id("cross-challenge"), request, otherHost, fingerprint, digest("8"), digest("9")],
    ), "23503");

    await rejectCode(client, "reauth_identity_trigger", () => client.query(
      `UPDATE coordination_v2_host_enrollments SET public_key = 'mutated' WHERE id = $1`, [host],
    ), "23514");
    await rejectCode(client, "reauth_fingerprint_trigger", () => client.query(
      `UPDATE coordination_v2_host_enrollments SET key_fingerprint = $2 WHERE id = $1`, [host, digest("0")],
    ), "23514");

    const credential = id("credential");
    const otherFingerprint = digest("c");
    await client.query(
      `INSERT INTO coordination_v2_host_credentials
       (id, host_enrollment_id, token_hash, credential_digest, lineage_digest,
        capability, protocol_version, proof_key_fingerprint, issued_by, issued_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'host:transport', 1, $6, 'reauth-test', now(), now() + interval '24 hours')`,
      [credential, otherHost, digest("1"), digest("2"), digest("3"), otherFingerprint],
    );
    await rejectCode(client, "reauth_result_wrong_host", () => client.query(
      `UPDATE coordination_v2_host_reauthorization_requests
          SET state = 'completed', founder_actor = 'founder', approved_at = now(),
              result_credential_id = $2, completed_at = now()
        WHERE id = $1`,
      [request, credential],
    ), "23503");
    await rejectCode(client, "reauth_duplicate_credential", () => client.query(
      `INSERT INTO coordination_v2_host_credentials
       (id, host_enrollment_id, token_hash, credential_digest, lineage_digest,
        capability, protocol_version, proof_key_fingerprint, issued_by, issued_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'host:transport', 1, $6, 'reauth-test', now(), now() + interval '24 hours')`,
      [id("duplicate"), host, digest("1"), digest("2"), digest("6"), fingerprint],
    ), "23505");

    assert.equal(Number((await client.query(
      "SELECT count(*)::integer AS count FROM coordination_v2_host_credentials WHERE id = $1", [credential],
    )).rows[0].count), 1);
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    const unrelatedAfter = await client.query(
      "SELECT count(*)::integer AS count FROM coordination_v2_host_credentials",
    );
    assert.equal(unrelatedAfter.rows[0].count, unrelatedBefore);
    await client.end();
  }
});