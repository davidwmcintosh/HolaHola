// Concurrent-write coverage for server/services/agent-memory-core.ts (Phase 8
// of docs/superpowers/plans/2026-09-21-shared-docs-db-canonical-implementation-plan.md).
//
// Invariant 2 of the design doc: two hats acting in the same window never
// lose either one's contribution. This file proves that with real, separate
// OS processes (not just two in-process promises sharing one connection
// pool) racing the CLI the way two different hats actually would.
//
// Requires the same AGENT_MEMORY_TEST_* disposable-database gate as
// server/services/agent-memory-core.test.ts and
// server/scripts/test-agent-memory-schema-postgres.test.ts. See
// .agents/memory/local-disposable-postgres-sandbox.md for how to stand up a
// throwaway Postgres instance to run this file directly.

import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

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
    throw new Error("Agent memory concurrent-write test requires getSharedDb() to resolve to the gate-provided disposable database URL");
  }
  if (url === process.env.AGENT_MEMORY_FORBIDDEN_SHARED_URL) {
    throw new Error("Agent memory concurrent-write test refuses the shared Neon database");
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

after(async () => {
  if (!disposableTarget()) return;
  const { closeDbConnections } = await import("../db");
  await closeDbConnections();
});

const CLI_SCRIPT = "server/scripts/agent-memory-cli.ts";

/** Runs the CLI as a genuinely separate process, the way a second hat would. */
function runCli(args: string[], childFilesDir: string): Promise<{ code: 0; stdout: string; stderr: string }> {
  return execFile("npx", ["tsx", CLI_SCRIPT, ...args], {
    env: { ...process.env, AGENT_MEMORY_TEST_FILES_DIR: childFilesDir },
    timeout: 60_000,
  }).then(
    (result) => ({ code: 0 as const, ...result }),
    (error: NodeJS.ErrnoException & { code?: number; stdout?: string; stderr?: string }) => {
      throw new Error(`CLI ${args[0]} exited ${error.code}\nstdout: ${error.stdout}\nstderr: ${error.stderr}`);
    },
  );
}

test("two concurrent add-block CLI processes against the same brand-new topic both land, with no lost write and no order-key collision", async (context) => {
  const url = disposableTarget();
  if (!url) {
    context.skip("run through the Neon migration gate with AGENT_MEMORY_TEST_* env set");
    return;
  }

  const { getSharedDb, closeDbConnections } = await import("../db");
  const { agentMemoryTopicBlocks } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  const { writeTopicFile } = await import("../services/agent-memory-core");

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const topicSlug = `agent-memory-concurrent-block-${suffix}`;
  const scratchDir = await mkdtemp(join(tmpdir(), "agent-memory-concurrent-"));
  const bodyFileA = join(scratchDir, "body-a.md");
  const bodyFileB = join(scratchDir, "body-b.md");
  await writeFile(bodyFileA, "Body from writer A.\n", "utf8");
  await writeFile(bodyFileB, "Body from writer B.\n", "utf8");

  try {
    // Both processes append (no --after) to a topic that does not exist yet,
    // the exact shape that used to make both writers compute
    // keyBetween(undefined, undefined) -- the same order key -- before the
    // FOR UPDATE lock fix in addBlock().
    const [resultA, resultB] = await Promise.all([
      runCli(["add-block", "--topic-slug", topicSlug, "--heading", "Writer A", "--body-file", bodyFileA, "--actor", "luca-replit"], process.env.AGENT_MEMORY_TEST_FILES_DIR!),
      runCli(["add-block", "--topic-slug", topicSlug, "--heading", "Writer B", "--body-file", bodyFileB, "--actor", "luca-claude-code"], process.env.AGENT_MEMORY_TEST_FILES_DIR!),
    ]);
    assert.equal(resultA.code, 0);
    assert.equal(resultB.code, 0);

    const db = getSharedDb();
    const rows = await db.select({ orderKey: agentMemoryTopicBlocks.orderKey, bodyMarkdown: agentMemoryTopicBlocks.bodyMarkdown })
      .from(agentMemoryTopicBlocks).where(eq(agentMemoryTopicBlocks.topicSlug, topicSlug));
    assert.equal(rows.length, 2, "both concurrent writers' blocks must exist -- neither may be lost or fail to insert");
    const orderKeys = rows.map((row) => row.orderKey);
    assert.equal(new Set(orderKeys).size, 2, `order keys must be distinct, got ${JSON.stringify(orderKeys)}`);

    // Regenerate deterministically from final DB state rather than trusting
    // whichever child process happened to render last -- see file header.
    const filePath = await writeTopicFile(topicSlug);
    const rendered = await readFile(filePath, "utf8");
    assert.match(rendered, /Body from writer A\./);
    assert.match(rendered, /Body from writer B\./);
  } finally {
    await rm(scratchDir, { recursive: true, force: true });
  }
});

test("two concurrent add-entry CLI processes against the same brand-new topic both land", async (context) => {
  const url = disposableTarget();
  if (!url) {
    context.skip("run through the Neon migration gate with AGENT_MEMORY_TEST_* env set");
    return;
  }

  const { getSharedDb } = await import("../db");
  const { agentMemoryEntries } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  const { writeMemoryIndexFile } = await import("../services/agent-memory-core");

  // addEntry (unlike addBlock) requires the topic to already exist -- create
  // it first with a single block so both concurrent add-entry calls race
  // against an established topic, not against topic auto-creation.
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const topicSlug = `agent-memory-concurrent-entry-${suffix}`;
  const scratchDir = await mkdtemp(join(tmpdir(), "agent-memory-concurrent-"));
  const bodyFile = join(scratchDir, "body.md");
  await writeFile(bodyFile, "Seed block so the topic exists before entries race.\n", "utf8");

  try {
    await runCli(["add-block", "--topic-slug", topicSlug, "--body-file", bodyFile, "--actor", "luca-replit"], process.env.AGENT_MEMORY_TEST_FILES_DIR!);

    const [resultA, resultB] = await Promise.all([
      runCli(["add-entry", "--topic-slug", topicSlug, "--title", "From A", "--hook", "Hook text from writer A.", "--actor", "luca-replit"], process.env.AGENT_MEMORY_TEST_FILES_DIR!),
      runCli(["add-entry", "--topic-slug", topicSlug, "--title", "From B", "--hook", "Hook text from writer B.", "--actor", "luca-gemini"], process.env.AGENT_MEMORY_TEST_FILES_DIR!),
    ]);
    assert.equal(resultA.code, 0);
    assert.equal(resultB.code, 0);

    const db = getSharedDb();
    const rows = await db.select({ title: agentMemoryEntries.title }).from(agentMemoryEntries).where(eq(agentMemoryEntries.topicSlug, topicSlug));
    assert.equal(rows.length, 2, "both concurrent writers' entries must exist -- neither may be lost");

    // Entries render into the global MEMORY.md index, not the per-topic
    // file (which holds blocks) -- regenerate deterministically from final
    // DB state, same reasoning as the add-block test above.
    const indexPath = await writeMemoryIndexFile();
    const rendered = await readFile(indexPath, "utf8");
    assert.match(rendered, /Hook text from writer A\./);
    assert.match(rendered, /Hook text from writer B\./);
  } finally {
    await rm(scratchDir, { recursive: true, force: true });
  }
});
