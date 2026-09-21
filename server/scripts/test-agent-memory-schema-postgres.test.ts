import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import pg from "pg";

// AGENT_MEMORY_TEST_DATABASE_URL (not the ambient NEON_SHARED_DATABASE_URL,
// which is already set in a normal dev shell as the app's own database) is
// checked first, so running this file directly outside the Neon migration
// gate skips cleanly instead of throwing. Mirrors
// server/scripts/test-coordinator-v2-schema-postgres.test.ts.
function disposableTarget(): string | undefined {
  const url = process.env.AGENT_MEMORY_TEST_DATABASE_URL;
  if (!url) {
    if (process.env.AGENT_MEMORY_REQUIRE_DATABASE_TESTS === "1") {
      throw new Error("AGENT_MEMORY_TEST_DATABASE_URL is required by the migration gate");
    }
    return undefined;
  }
  if (process.env.AGENT_MEMORY_TEST_DATABASE_DISPOSABLE !== "1") {
    throw new Error("AGENT_MEMORY_TEST_DATABASE_DISPOSABLE=1 is required");
  }
  if (process.env.NEON_SHARED_DATABASE_URL !== url) {
    throw new Error("Agent memory schema test requires the gate-provided disposable database URL");
  }
  if (url === process.env.AGENT_MEMORY_FORBIDDEN_SHARED_URL) {
    throw new Error("Agent memory schema test refuses the shared Neon database");
  }
  return url;
}

// disposableTarget() above must hard-fail -- not silently context.skip() --
// when AGENT_MEMORY_REQUIRE_DATABASE_TESTS='1' but its own URL/DISPOSABLE
// vars are missing while still running inside the gate.
const OWN_SOURCE = readFileSync(fileURLToPath(import.meta.url), "utf8");
test("this file hard-fails under the gate instead of silently skipping DB coverage", () => {
  assert.ok(OWN_SOURCE.includes('AGENT_MEMORY_REQUIRE_DATABASE_TESTS === "1"'));
  assert.ok(OWN_SOURCE.includes("AGENT_MEMORY_FORBIDDEN_SHARED_URL"));
  assert.ok(OWN_SOURCE.includes("context.skip("));
});

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

test("agent_memory schema enforces topic/entry/block invariants", async (context) => {
  const url = disposableTarget();
  if (!url) {
    context.skip("run through the Neon migration gate");
    return;
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const slug = (kind: string) => `agent-memory-schema-${kind}-${suffix}`;

  try {
    await client.query("BEGIN");

    // A block or entry referencing an unknown topic_slug is rejected at the
    // DB level -- Phase 1's explicit verification criterion.
    await rejectCode(
      client,
      "entry_unknown_topic",
      () => client.query(
        `INSERT INTO agent_memory_entries (topic_slug, title, hook, created_by_actor)
         VALUES ($1, 'Title', 'Hook text', 'luca-replit')`,
        [slug("missing-topic-entry")],
      ),
      "23503",
    );
    await rejectCode(
      client,
      "block_unknown_topic",
      () => client.query(
        `INSERT INTO agent_memory_topic_blocks (topic_slug, order_key, body_markdown, author_actor)
         VALUES ($1, 'a0', 'Body text', 'luca-replit')`,
        [slug("missing-topic-block")],
      ),
      "23503",
    );

    // Happy path: topic, entry, and block all insert cleanly.
    const topicSlug = slug("topic");
    await client.query(`INSERT INTO agent_memory_topics (slug) VALUES ($1)`, [topicSlug]);
    await rejectCode(
      client,
      "topic_duplicate_slug",
      () => client.query(`INSERT INTO agent_memory_topics (slug) VALUES ($1)`, [topicSlug]),
      "23505",
    );

    const entryResult = await client.query(
      `INSERT INTO agent_memory_entries (topic_slug, title, hook, created_by_actor)
       VALUES ($1, 'Title', 'Hook text', 'luca-replit') RETURNING id, version`,
      [topicSlug],
    );
    assert.equal(entryResult.rows[0].version, 1);

    await client.query(
      `INSERT INTO agent_memory_topic_blocks (topic_slug, order_key, heading, body_markdown, author_actor)
       VALUES ($1, 'a0', 'Heading', 'Body text', 'luca-replit')`,
      [topicSlug],
    );
    await rejectCode(
      client,
      "block_duplicate_order_key",
      () => client.query(
        `INSERT INTO agent_memory_topic_blocks (topic_slug, order_key, body_markdown, author_actor)
         VALUES ($1, 'a0', 'Second body', 'luca-claude-code')`,
        [topicSlug],
      ),
      "23505",
    );

    // Nonempty and positive-version checks.
    await rejectCode(
      client,
      "entry_blank_title",
      () => client.query(
        `INSERT INTO agent_memory_entries (topic_slug, title, hook, created_by_actor)
         VALUES ($1, '   ', 'Hook text', 'luca-replit')`,
        [topicSlug],
      ),
      "23514",
    );
    await rejectCode(
      client,
      "entry_nonpositive_version",
      () => client.query(
        `INSERT INTO agent_memory_entries (topic_slug, title, hook, created_by_actor, version)
         VALUES ($1, 'Title', 'Hook text', 'luca-replit', 0)`,
        [topicSlug],
      ),
      "23514",
    );
    await rejectCode(
      client,
      "block_blank_body",
      () => client.query(
        `INSERT INTO agent_memory_topic_blocks (topic_slug, order_key, body_markdown, author_actor)
         VALUES ($1, 'a1', '', 'luca-replit')`,
        [topicSlug],
      ),
      "23514",
    );

    // deleted_at / deleted_by_actor must be set together, never one alone.
    await rejectCode(
      client,
      "entry_delete_pairing_half",
      () => client.query(
        `UPDATE agent_memory_entries SET deleted_at = now() WHERE id = $1`,
        [entryResult.rows[0].id],
      ),
      "23514",
    );
    await client.query(
      `UPDATE agent_memory_entries SET deleted_at = now(), deleted_by_actor = 'luca-replit' WHERE id = $1`,
      [entryResult.rows[0].id],
    );
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
});
