// Round-trip coverage for the CLI write -> generated file -> DB projection
// chain (Phase 8 of
// docs/superpowers/plans/2026-09-21-shared-docs-db-canonical-implementation-plan.md).
//
// Two independent properties, proven two different ways:
//
// 1. The generated markdown is a *faithful* projection of DB rows -- parsed
//    back out of the file with a parser independent of
//    formatMemoryIndex()/formatTopicFile(), then diffed field-by-field
//    against the actual DB rows. A formatting bug that produced
//    plausible-looking but wrong markdown (wrong field in the wrong slot,
//    silently dropped heading, wrong block order) would pass a
//    "re-render and compare to itself" check but fails this one.
// 2. The generated markdown is a *deterministic* projection -- regenerating
//    from DB state alone (regenerateAll(), simulating disaster recovery)
//    reproduces byte-identical files to what the individual CLI writes
//    already produced, for the same underlying rows.
//
// Requires the same AGENT_MEMORY_TEST_* disposable-database gate as the
// other Phase 8 Postgres test files. See
// .agents/memory/local-disposable-postgres-sandbox.md for how to stand up a
// throwaway Postgres instance to run this file directly.

import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
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
    throw new Error("Agent memory round-trip test requires getSharedDb() to resolve to the gate-provided disposable database URL");
  }
  if (url === process.env.AGENT_MEMORY_FORBIDDEN_SHARED_URL) {
    throw new Error("Agent memory round-trip test refuses the shared Neon database");
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

async function runCli(args: string[]): Promise<string> {
  const result = await execFile("npx", ["tsx", CLI_SCRIPT, ...args], { env: { ...process.env }, timeout: 60_000 });
  return result.stdout;
}

/** Independent of formatTopicFile(): parses "## heading\n\nbody" sections back into structured rows. Assumes single-line, heading-bearing bodies (true of every block this test writes) so "\n\n" alone unambiguously separates heading from body and section from section. */
function parseTopicFile(content: string): Array<{ heading: string; body: string }> {
  const parts = content.replace(/\n$/, "").split("\n\n");
  assert.equal(parts.length % 2, 0, `expected heading/body pairs, got an odd number of parts: ${JSON.stringify(parts)}`);
  const parsed: Array<{ heading: string; body: string }> = [];
  for (let i = 0; i < parts.length; i += 2) {
    assert.match(parts[i], /^## /, `expected a "## " heading line, got ${JSON.stringify(parts[i])}`);
    parsed.push({ heading: parts[i].slice(3), body: parts[i + 1] });
  }
  return parsed;
}

/** Independent of formatMemoryIndex(): parses "- [title](slug.md) — hook" lines, filtered to one topic so residue from other topics sharing the same scratch MEMORY.md never leaks in. */
function parseIndexEntriesForTopic(content: string, topicSlug: string): Array<{ title: string; hook: string }> {
  const parsed: Array<{ title: string; hook: string }> = [];
  for (const line of content.split("\n")) {
    const match = line.match(/^- \[(.+?)\]\((.+?)\.md\) — (.+)$/);
    if (match && match[2] === topicSlug) parsed.push({ title: match[1], hook: match[3] });
  }
  return parsed;
}

test("blocks and entries round-trip: parsed file content matches DB rows exactly, in true order-key order", async (context) => {
  const url = disposableTarget();
  if (!url) {
    context.skip("run through the Neon migration gate with AGENT_MEMORY_TEST_* env set");
    return;
  }

  const { getSharedDb } = await import("../db");
  const { agentMemoryTopicBlocks, agentMemoryEntries } = await import("@shared/schema");
  const { eq, asc } = await import("drizzle-orm");

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const topicSlug = `agent-memory-roundtrip-${suffix}`;
  const filesDir = process.env.AGENT_MEMORY_TEST_FILES_DIR!;

  // Two plain appends (First, Third), then an insert-between (Second) --
  // exercises --after, which none of the other Phase 8 files cover, and
  // proves the file reflects true order-key order, not insertion order.
  const { mkdtemp, writeFile: writeFileFs, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const scratchDir = await mkdtemp(join(tmpdir(), "agent-memory-roundtrip-"));
  const firstBodyFile = join(scratchDir, "first.md");
  const secondBodyFile = join(scratchDir, "second.md");
  const thirdBodyFile = join(scratchDir, "third.md");
  await writeFileFs(firstBodyFile, "First block body.", "utf8");
  await writeFileFs(secondBodyFile, "Second block body.", "utf8");
  await writeFileFs(thirdBodyFile, "Third block body.", "utf8");

  try {
    await runCli(["add-block", "--topic-slug", topicSlug, "--heading", "First", "--body-file", firstBodyFile, "--actor", "luca-replit"]);
    await runCli(["add-block", "--topic-slug", topicSlug, "--heading", "Third", "--body-file", thirdBodyFile, "--actor", "luca-replit"]);

    const db = getSharedDb();
    const [firstRow] = await db.select({ id: agentMemoryTopicBlocks.id }).from(agentMemoryTopicBlocks)
      .where(eq(agentMemoryTopicBlocks.topicSlug, topicSlug)).orderBy(asc(agentMemoryTopicBlocks.orderKey)).limit(1);
    await runCli(["add-block", "--topic-slug", topicSlug, "--heading", "Second", "--body-file", secondBodyFile, "--actor", "luca-replit", "--after", firstRow.id]);

    await runCli(["add-entry", "--topic-slug", topicSlug, "--title", "Entry One", "--hook", "Hook for entry one.", "--actor", "luca-replit"]);
    await runCli(["add-entry", "--topic-slug", topicSlug, "--title", "Entry Two", "--hook", "Hook for entry two.", "--actor", "luca-claude-code"]);

    // ----- Property 1: faithful projection, checked with an independent parser -----
    const dbBlocks = await db.select().from(agentMemoryTopicBlocks)
      .where(eq(agentMemoryTopicBlocks.topicSlug, topicSlug)).orderBy(asc(agentMemoryTopicBlocks.orderKey));
    assert.deepEqual(dbBlocks.map((b) => b.heading), ["First", "Second", "Third"], "DB order-key ordering must already be First, Second, Third");

    const topicFileContent = await readFile(join(filesDir, `${topicSlug}.md`), "utf8");
    const parsedBlocks = parseTopicFile(topicFileContent);
    assert.deepEqual(parsedBlocks, [
      { heading: "First", body: "First block body." },
      { heading: "Second", body: "Second block body." },
      { heading: "Third", body: "Third block body." },
    ]);

    const dbEntries = await db.select().from(agentMemoryEntries).where(eq(agentMemoryEntries.topicSlug, topicSlug)).orderBy(asc(agentMemoryEntries.createdAt));
    const indexFileContent = await readFile(join(filesDir, "MEMORY.md"), "utf8");
    const parsedEntries = parseIndexEntriesForTopic(indexFileContent, topicSlug);
    assert.deepEqual(parsedEntries, dbEntries.map((e) => ({ title: e.title, hook: e.hook })));

    // ----- Property 2: deterministic projection, checked byte-for-byte -----
    const { regenerateAll } = await import("../services/agent-memory-core");
    const topicBytesBefore = topicFileContent;
    const indexBytesBefore = indexFileContent;
    await regenerateAll();
    const topicBytesAfter = await readFile(join(filesDir, `${topicSlug}.md`), "utf8");
    const indexBytesAfter = await readFile(join(filesDir, "MEMORY.md"), "utf8");
    assert.equal(topicBytesAfter, topicBytesBefore, "regenerating from DB state alone must reproduce the exact same topic file bytes");
    assert.equal(indexBytesAfter, indexBytesBefore, "regenerating from DB state alone must reproduce the exact same index file bytes");

    // The agent_memory_topics row for this throwaway slug is left in place
    // deliberately -- there is no removeTopic() in the design (topics are
    // never deleted, only their entries/blocks are soft-deleted), matching
    // how every other Phase 8 file already leaves its throwaway topic rows
    // behind in the disposable database.
  } finally {
    await rm(scratchDir, { recursive: true, force: true });
  }
});
