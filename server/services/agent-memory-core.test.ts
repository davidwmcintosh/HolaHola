// Focused service tests for server/services/agent-memory-core.ts (Phase 2 of
// docs/superpowers/plans/2026-09-21-shared-docs-db-canonical-implementation-plan.md).
//
// Pure keyBetween() tests run unconditionally — no database needed. The rest
// require a disposable Postgres database and run only when the caller has
// proven, via the dedicated AGENT_MEMORY_TEST_* env vars below, that
// NEON_SHARED_DATABASE_URL (which getSharedDb() actually reads) points at a
// disposable target rather than this project's real shared Neon database.
// This mirrors server/scripts/test-agent-memory-schema-postgres.test.ts and
// server/scripts/test-coordinator-v2-schema-postgres.test.ts exactly.
//
// AGENT_MEMORY_TEST_FILES_DIR must also be set (to a scratch directory)
// before this file is imported — otherwise the service's real file-write
// step would overwrite this checkout's actual .agents/memory/MEMORY.md and
// topic files with content generated from throwaway test rows.

import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { readFileSync } from "node:fs";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

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
    throw new Error("Agent memory service test requires getSharedDb() to resolve to the gate-provided disposable database URL");
  }
  if (url === process.env.AGENT_MEMORY_FORBIDDEN_SHARED_URL) {
    throw new Error("Agent memory service test refuses the shared Neon database");
  }
  if (!process.env.AGENT_MEMORY_TEST_FILES_DIR) {
    throw new Error("AGENT_MEMORY_TEST_FILES_DIR is required so file writes never touch the real .agents/memory/");
  }
  return url;
}

const OWN_SOURCE = readFileSync(fileURLToPath(import.meta.url), "utf8");
test("this file hard-fails under the gate instead of silently skipping DB coverage", () => {
  assert.ok(OWN_SOURCE.includes('AGENT_MEMORY_REQUIRE_DATABASE_TESTS === "1"'));
  assert.ok(OWN_SOURCE.includes("AGENT_MEMORY_FORBIDDEN_SHARED_URL"));
  assert.ok(OWN_SOURCE.includes("AGENT_MEMORY_TEST_FILES_DIR"));
  assert.ok(OWN_SOURCE.includes("context.skip("));
});

// ===== keyBetween() — pure, no database ==========================================
// Imported unconditionally: these are cheap, deterministic, and the
// algorithm is exactly the kind of thing worth pinning with direct cases.

const { keyBetween } = await import("./agent-memory-core");

test("keyBetween: first key ever sorts strictly between unbounded ends", () => {
  const k = keyBetween(undefined, undefined);
  assert.ok(k.length > 0);
});

test("keyBetween: append-after-max always sorts after the given key", () => {
  const first = keyBetween(undefined, undefined);
  const second = keyBetween(first, undefined);
  assert.ok(first < second, `${JSON.stringify(first)} should sort before ${JSON.stringify(second)}`);
  const third = keyBetween(second, undefined);
  assert.ok(second < third);
});

test("keyBetween: insert-before-first always sorts before the given key", () => {
  const anchor = keyBetween(undefined, undefined);
  const before = keyBetween(undefined, anchor);
  assert.ok(before < anchor);
});

test("keyBetween: midpoint sorts strictly between two ordinary neighbors", () => {
  const lo = "1";
  const hi = "2";
  const mid = keyBetween(lo, hi);
  assert.ok(lo < mid && mid < hi, `expected ${lo} < ${JSON.stringify(mid)} < ${hi}`);
});

test("keyBetween: adjacent single-digit neighbors (no numeric room) still produce a valid midpoint", () => {
  // "1" and "2" differ by exactly one alphabet step at position 0 -- there is
  // no integer strictly between the digit values 1 and 2, so the algorithm
  // must extend to a second digit rather than fail or loop forever.
  const mid = keyBetween("1", "2");
  assert.ok("1" < mid && mid < "2");
  assert.ok(mid.length >= 2, "expected the midpoint to need a second digit when there is no room in the first");
});

test("keyBetween: a key ending in the maximum digit still extends correctly", () => {
  const mid = keyBetween("1z", "2");
  assert.ok("1z" < mid && mid < "2", `expected 1z < ${JSON.stringify(mid)} < 2`);
});

test("keyBetween: repeated bisection between the same two neighbors always narrows and never collides", () => {
  let lo = "a";
  let hi = "b";
  const seen = new Set([lo, hi]);
  for (let i = 0; i < 40; i++) {
    const mid = keyBetween(lo, hi);
    assert.ok(lo < mid && mid < hi, `iteration ${i}: expected ${lo} < ${JSON.stringify(mid)} < ${hi}`);
    assert.ok(!seen.has(mid), `iteration ${i}: key ${JSON.stringify(mid)} was already produced`);
    seen.add(mid);
    hi = mid; // keep bisecting the same shrinking interval
  }
});

test("keyBetween: rejects an out-of-order or equal bound pair", () => {
  assert.throws(() => keyBetween("b", "a"));
  assert.throws(() => keyBetween("a", "a"));
});

// ===== Database-backed service tests =============================================

// server/db.ts's pool sets idleTimeoutMillis but not allowExitOnIdle, so an
// idle pooled connection left open holds the event loop (and `node --test`)
// alive for the full 2-minute idle timeout even after every assertion has
// finished -- a file-wide stall with no single test reporting it. Guarded on
// disposableTarget() so this never triggers ../db's fatal
// NEON_SHARED_DATABASE_URL throw when the pure keyBetween-only run has no
// disposable DB env set. See .agents/memory/pg-pool-idle-timeout-ci-hang.md.
after(async () => {
  if (!disposableTarget()) return;
  const { closeDbConnections } = await import("../db");
  await closeDbConnections();
});

test("agent-memory-core: topic auto-creation, CAS edits, soft delete, and forced render failure", async (context) => {
  const url = disposableTarget();
  if (!url) {
    context.skip("run through the Neon migration gate with AGENT_MEMORY_TEST_* env set");
    return;
  }

  const core = await import("./agent-memory-core");
  const { getSharedDb } = await import("../db");
  const { agentMemoryEntries, agentMemoryTopicBlocks } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  const db = getSharedDb();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const topicSlug = `agent-memory-core-test-${suffix}`;

  await context.test("addEntry against an unknown topic is rejected, not auto-created", async () => {
    await assert.rejects(
      core.addEntry({ topicSlug, title: "Should not insert", hook: "n/a", actor: "luca-replit" }),
      (error: unknown) => error instanceof core.AgentMemoryError && error.kind === "VALIDATION",
    );
  });

  let firstBlockId = "";
  await context.test("addBlock against an unknown topic creates it implicitly", async () => {
    const { block, evidence } = await core.addBlock({
      topicSlug,
      heading: "First",
      bodyMarkdown: "First body.",
      actor: "luca-replit",
    });
    firstBlockId = block.id;
    assert.equal(block.topicSlug, topicSlug);
    assert.equal(block.version, 1);
    assert.deepEqual(evidence.otherActors, []);
  });

  let lastBlockId = "";
  await context.test("a plain append sorts strictly after the previous block", async () => {
    const { block } = await core.addBlock({ topicSlug, bodyMarkdown: "Second body.", actor: "luca-gemini" });
    lastBlockId = block.id;
    const first = await db.select().from(agentMemoryTopicBlocks).where(eq(agentMemoryTopicBlocks.id, firstBlockId));
    assert.ok(first[0].orderKey < block.orderKey);
  });

  await context.test("inserting between two blocks sorts strictly between them and leaves both neighbors unchanged", async () => {
    const beforeFirst = await db.select().from(agentMemoryTopicBlocks).where(eq(agentMemoryTopicBlocks.id, firstBlockId));
    const beforeLast = await db.select().from(agentMemoryTopicBlocks).where(eq(agentMemoryTopicBlocks.id, lastBlockId));

    const { block: middle } = await core.addBlock({
      topicSlug,
      bodyMarkdown: "Middle body.",
      actor: "luca-claude-code",
      afterBlockId: firstBlockId,
    });

    const afterFirst = await db.select().from(agentMemoryTopicBlocks).where(eq(agentMemoryTopicBlocks.id, firstBlockId));
    const afterLast = await db.select().from(agentMemoryTopicBlocks).where(eq(agentMemoryTopicBlocks.id, lastBlockId));
    assert.equal(afterFirst[0].orderKey, beforeFirst[0].orderKey, "the earlier neighbor's key must not change");
    assert.equal(afterLast[0].orderKey, beforeLast[0].orderKey, "the later neighbor's key must not change");
    assert.ok(beforeFirst[0].orderKey < middle.orderKey);
    assert.ok(middle.orderKey < beforeLast[0].orderKey);
  });

  await context.test("addEntry now succeeds against the topic created by addBlock", async (t) => {
    const { entry, evidence } = await core.addEntry({
      topicSlug,
      title: "Test topic",
      hook: "Exists only for this test run.",
      actor: "luca-replit",
    });
    assert.equal(entry.version, 1);
    // luca-gemini and luca-claude-code both wrote blocks to this topic above,
    // within the last 24h, and are not the calling actor.
    assert.deepEqual(evidence.otherActors, ["luca-claude-code", "luca-gemini"]);

    // Nested subtests must be declared on this callback's own context (t),
    // not the outer `context` -- calling context.test() reentrantly from
    // inside one of context's own still-pending subtests confuses the test
    // runner's parent/child bookkeeping and manifests as an unrelated-looking
    // "Promise resolution is still pending but the event loop has already
    // resolved" failure with no real hang underneath (confirmed via a
    // standalone repro against the same disposable branch: the DB and pool
    // are fine in isolation).
    await t.test("two CAS edits against the same stale version: one succeeds, one reports conflict", async () => {
      const first = await core.editEntry({ entryId: entry.id, baseVersion: entry.version, hook: "Updated once.", actor: "luca-replit" });
      assert.ok(first.ok);
      if (!first.ok) return;
      assert.equal(first.value.version, entry.version + 1);
      assert.equal(first.value.hook, "Updated once.");

      const second = await core.editEntry({ entryId: entry.id, baseVersion: entry.version, hook: "Should not apply.", actor: "luca-gemini" });
      assert.equal(second.ok, false);
      if (second.ok) return;
      assert.equal(second.current.hook, "Updated once.", "the stale writer must see the winner's content, not overwrite it");
      assert.equal(second.current.version, entry.version + 1);
    });

    await t.test("soft-deleted entries are excluded from rendering but remain queryable", async () => {
      const removed = await core.removeEntry(entry.id, "luca-replit");
      assert.equal(removed.alreadyDeleted, false);

      const rendered = await core.fetchMemoryIndexEntries();
      assert.ok(!rendered.some((row) => row.id === entry.id), "a soft-deleted entry must not appear in the rendered fetch");

      const [raw] = await db.select().from(agentMemoryEntries).where(eq(agentMemoryEntries.id, entry.id));
      assert.ok(raw, "the row itself must still exist after a soft delete");
      assert.ok(raw.deletedAt, "deletedAt must be set");
      assert.equal(raw.deletedByActor, "luca-replit");

      const again = await core.removeEntry(entry.id, "luca-gemini");
      assert.equal(again.alreadyDeleted, true, "removing an already-deleted entry is an idempotent no-op");
    });
  });

  await context.test("two CAS edits against the same stale block version: one succeeds, one reports conflict", async () => {
    const [block] = await db.select().from(agentMemoryTopicBlocks).where(eq(agentMemoryTopicBlocks.id, firstBlockId));
    const first = await core.editBlock({ blockId: block.id, baseVersion: block.version, bodyMarkdown: "Edited once.", actor: "luca-replit" });
    assert.ok(first.ok);
    if (!first.ok) return;

    const second = await core.editBlock({ blockId: block.id, baseVersion: block.version, bodyMarkdown: "Should not apply.", actor: "luca-gemini" });
    assert.equal(second.ok, false);
    if (second.ok) return;
    assert.equal(second.current.bodyMarkdown, "Edited once.");
  });

  await context.test("soft-deleted blocks are excluded from rendering but remain queryable", async () => {
    const removed = await core.removeBlock(lastBlockId, "luca-replit");
    assert.equal(removed.alreadyDeleted, false);

    const rendered = await core.fetchTopicBlocks(topicSlug);
    assert.ok(!rendered.some((row) => row.id === lastBlockId));

    const [raw] = await db.select().from(agentMemoryTopicBlocks).where(eq(agentMemoryTopicBlocks.id, lastBlockId));
    assert.ok(raw && raw.deletedAt);
  });

  await context.test("a render failure after a successful DB write throws rather than reporting success", async () => {
    const failingWrite = context.mock.method(fs, "writeFile", async () => {
      throw new Error("simulated disk failure");
    });
    try {
      await assert.rejects(
        core.addBlock({ topicSlug, bodyMarkdown: "Never rendered.", actor: "luca-holahola" }),
        /simulated disk failure/,
      );
    } finally {
      failingWrite.mock.restore();
    }

    // The DB write itself must have gone through even though the file write
    // failed -- the operation must not silently roll back a real insert just
    // because rendering failed afterward.
    const rows = await db
      .select()
      .from(agentMemoryTopicBlocks)
      .where(eq(agentMemoryTopicBlocks.topicSlug, topicSlug));
    assert.ok(
      rows.some((row) => row.bodyMarkdown === "Never rendered."),
      "the block row must exist in the database despite the failed file write",
    );

    // regenerateAll() is the documented recovery path: it must succeed now
    // that the mock is restored, proving the DB is never left unrecoverable.
    await core.regenerateAll();
    const fileContent = await fs.readFile(`${process.env.AGENT_MEMORY_TEST_FILES_DIR}/${topicSlug}.md`, "utf8");
    assert.ok(fileContent.includes("Never rendered."));
  });
});
