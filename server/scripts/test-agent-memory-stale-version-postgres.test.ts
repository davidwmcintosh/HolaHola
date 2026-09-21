// CLI-level stale-version guard coverage for
// server/scripts/agent-memory-cli.ts (Phase 8 of
// docs/superpowers/plans/2026-09-21-shared-docs-db-canonical-implementation-plan.md).
//
// server/services/agent-memory-core.test.ts already proves editEntry()/
// editBlock() return a `{ ok: false }` CasResult on a stale base version at
// the service level. This file proves the CLI wrapper around that result
// actually surfaces as a real non-zero process exit code (not just a
// console.error a caller could miss) -- see runAgentMemoryCli's
// `if (!result.ok) { ...; return 1; }` branches. A script that silently
// exited 0 on a rejected edit would look successful to any caller checking
// only the exit code.
//
// Requires the same AGENT_MEMORY_TEST_* disposable-database gate as the
// other Phase 8 Postgres test files. See
// .agents/memory/local-disposable-postgres-sandbox.md for how to stand up a
// throwaway Postgres instance to run this file directly.

import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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
    throw new Error("Agent memory stale-version test requires getSharedDb() to resolve to the gate-provided disposable database URL");
  }
  if (url === process.env.AGENT_MEMORY_FORBIDDEN_SHARED_URL) {
    throw new Error("Agent memory stale-version test refuses the shared Neon database");
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

/** Runs the CLI as a real process and reports its exit code instead of throwing, so a non-zero exit can be asserted on directly. */
async function runCli(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return execFile("npx", ["tsx", CLI_SCRIPT, ...args], {
    env: { ...process.env },
    timeout: 60_000,
  }).then(
    (result) => ({ code: 0, ...result }),
    (error: NodeJS.ErrnoException & { code?: number; stdout?: string; stderr?: string }) => ({
      code: error.code ?? -1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    }),
  );
}

test("edit-block CLI rejects a stale --base-version with exit 1 and leaves stored content untouched, but accepts the correct version", async (context) => {
  const url = disposableTarget();
  if (!url) {
    context.skip("run through the Neon migration gate with AGENT_MEMORY_TEST_* env set");
    return;
  }

  const { getSharedDb } = await import("../db");
  const { agentMemoryTopicBlocks } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const topicSlug = `agent-memory-stale-block-${suffix}`;
  const scratchDir = await mkdtemp(join(tmpdir(), "agent-memory-stale-"));
  const originalBodyFile = join(scratchDir, "original.md");
  const staleEditBodyFile = join(scratchDir, "stale-edit.md");
  const correctEditBodyFile = join(scratchDir, "correct-edit.md");
  await writeFile(originalBodyFile, "Original body.\n", "utf8");
  await writeFile(staleEditBodyFile, "Edit attempted with a stale version.\n", "utf8");
  await writeFile(correctEditBodyFile, "Edit made with the correct version.\n", "utf8");

  try {
    const created = await runCli(["add-block", "--topic-slug", topicSlug, "--body-file", originalBodyFile, "--actor", "luca-replit"]);
    assert.equal(created.code, 0, created.stderr);

    const db = getSharedDb();
    const [seeded] = await db.select({ id: agentMemoryTopicBlocks.id, version: agentMemoryTopicBlocks.version })
      .from(agentMemoryTopicBlocks).where(eq(agentMemoryTopicBlocks.topicSlug, topicSlug));
    assert.ok(seeded, "seed block must exist before editing it");
    assert.equal(seeded.version, 1);

    const staleAttempt = await runCli([
      "edit-block", "--block-id", seeded.id, "--base-version", "999", "--body-file", staleEditBodyFile, "--actor", "luca-claude-code",
    ]);
    assert.equal(staleAttempt.code, 1, `expected exit 1 for a stale base-version, got ${staleAttempt.code}\nstderr: ${staleAttempt.stderr}`);
    assert.match(staleAttempt.stderr, /Stale version/);

    const [afterStaleAttempt] = await db.select({ version: agentMemoryTopicBlocks.version, bodyMarkdown: agentMemoryTopicBlocks.bodyMarkdown })
      .from(agentMemoryTopicBlocks).where(eq(agentMemoryTopicBlocks.id, seeded.id));
    assert.equal(afterStaleAttempt.version, 1, "a rejected edit must not bump the stored version");
    assert.equal(afterStaleAttempt.bodyMarkdown, "Original body.\n", "a rejected edit must not change the stored body");

    // Contrast check: the exact same shape of call with the correct current
    // version must succeed, proving exit 1 above was specifically the
    // stale-version guard and not e.g. a broken CLI invocation.
    const correctAttempt = await runCli([
      "edit-block", "--block-id", seeded.id, "--base-version", "1", "--body-file", correctEditBodyFile, "--actor", "luca-claude-code",
    ]);
    assert.equal(correctAttempt.code, 0, correctAttempt.stderr);

    const [afterCorrectAttempt] = await db.select({ version: agentMemoryTopicBlocks.version, bodyMarkdown: agentMemoryTopicBlocks.bodyMarkdown })
      .from(agentMemoryTopicBlocks).where(eq(agentMemoryTopicBlocks.id, seeded.id));
    assert.equal(afterCorrectAttempt.version, 2);
    assert.equal(afterCorrectAttempt.bodyMarkdown, "Edit made with the correct version.\n");
  } finally {
    await rm(scratchDir, { recursive: true, force: true });
  }
});

test("edit-entry CLI rejects a stale --base-version with exit 1 and leaves stored content untouched, but accepts the correct version", async (context) => {
  const url = disposableTarget();
  if (!url) {
    context.skip("run through the Neon migration gate with AGENT_MEMORY_TEST_* env set");
    return;
  }

  const { getSharedDb } = await import("../db");
  const { agentMemoryEntries, agentMemoryTopics } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const topicSlug = `agent-memory-stale-entry-${suffix}`;

  const db = getSharedDb();
  // addEntry requires the topic to already exist -- create it directly
  // rather than via add-block, to keep this test focused on entries only.
  await db.insert(agentMemoryTopics).values({ slug: topicSlug });

  const created = await runCli(["add-entry", "--topic-slug", topicSlug, "--title", "A Title", "--hook", "Original hook.", "--actor", "luca-replit"]);
  assert.equal(created.code, 0, created.stderr);

  const [seeded] = await db.select({ id: agentMemoryEntries.id, version: agentMemoryEntries.version })
    .from(agentMemoryEntries).where(eq(agentMemoryEntries.topicSlug, topicSlug));
  assert.ok(seeded, "seed entry must exist before editing it");
  assert.equal(seeded.version, 1);

  const staleAttempt = await runCli([
    "edit-entry", "--entry-id", seeded.id, "--base-version", "999", "--hook", "Stale edit attempt.", "--actor", "luca-gemini",
  ]);
  assert.equal(staleAttempt.code, 1, `expected exit 1 for a stale base-version, got ${staleAttempt.code}\nstderr: ${staleAttempt.stderr}`);
  assert.match(staleAttempt.stderr, /Stale version/);

  const [afterStaleAttempt] = await db.select({ version: agentMemoryEntries.version, hook: agentMemoryEntries.hook })
    .from(agentMemoryEntries).where(eq(agentMemoryEntries.id, seeded.id));
  assert.equal(afterStaleAttempt.version, 1, "a rejected edit must not bump the stored version");
  assert.equal(afterStaleAttempt.hook, "Original hook.", "a rejected edit must not change the stored hook");

  const correctAttempt = await runCli([
    "edit-entry", "--entry-id", seeded.id, "--base-version", "1", "--hook", "Correct-version edit.", "--actor", "luca-gemini",
  ]);
  assert.equal(correctAttempt.code, 0, correctAttempt.stderr);

  const [afterCorrectAttempt] = await db.select({ version: agentMemoryEntries.version, hook: agentMemoryEntries.hook })
    .from(agentMemoryEntries).where(eq(agentMemoryEntries.id, seeded.id));
  assert.equal(afterCorrectAttempt.version, 2);
  assert.equal(afterCorrectAttempt.hook, "Correct-version edit.");
});
