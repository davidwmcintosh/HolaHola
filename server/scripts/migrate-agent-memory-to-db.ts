// One-off day-one migration: parses today's .agents/memory/MEMORY.md index
// and every .agents/memory/<slug>.md topic file into the agent_memory_*
// tables, then regenerates every file from that freshly seeded DB state.
//
// Migrates EVERY topic file on disk, not just the ones MEMORY.md's index
// currently links to. As of writing, 128 of 272 topic files have no index
// bullet (dropped from the index over time without deleting the file) --
// this migration must be lossless, so those orphaned topics still get a
// topic row + block, they just get no agent_memory_entries row, exactly
// mirroring their current unindexed-but-present status on disk.
//
// Refuses to run if any of the three tables already has a row, so it can
// never silently double-insert against a target it already seeded.
//
// See docs/superpowers/specs/2026-09-21-shared-docs-db-canonical-design.md
// and docs/superpowers/plans/2026-09-21-shared-docs-db-canonical-implementation-plan.md
// (Phase 4).

import { promises as fs } from "node:fs";
import path from "node:path";
import { agentMemoryEntries, agentMemoryTopicBlocks, agentMemoryTopics } from "@shared/schema";
import { closeDbConnections, getSharedDb } from "../db";
import { keyBetween, regenerateAll } from "../services/agent-memory-core";

const MEMORY_DIR = process.env.AGENT_MEMORY_TEST_FILES_DIR
  ? path.resolve(process.env.AGENT_MEMORY_TEST_FILES_DIR)
  : path.join(process.cwd(), ".agents/memory");
const MEMORY_INDEX_PATH = path.join(MEMORY_DIR, "MEMORY.md");
const MIGRATION_ACTOR = "migration-day-one";

// Mirrors formatMemoryIndex()'s own generator line in agent-memory-core.ts:
// `- [${title}](${topicSlug}.md) — ${hook}`. Title is non-greedy so a `]`
// inside the hook (e.g. "...(subject: [MENTION]).") never gets mistaken for
// the title's closing bracket; hook is greedy to the end of the line so an
// em dash inside the title or hook text itself never truncates it early.
const BULLET_PATTERN = /^- \[(?<title>.+?)\]\((?<slug>[^)]+)\.md\) — (?<hook>.+)$/;

interface ParsedEntry {
  title: string;
  topicSlug: string;
  hook: string;
}

function parseMemoryIndex(raw: string): ParsedEntry[] {
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  return lines.map((line) => {
    const match = BULLET_PATTERN.exec(line);
    if (!match || !match.groups) {
      throw new Error(`MEMORY.md line does not match the expected bullet format: ${JSON.stringify(line)}`);
    }
    return { title: match.groups.title, topicSlug: match.groups.slug, hook: match.groups.hook };
  });
}

async function main(): Promise<void> {
  const db = getSharedDb();

  const [existingTopics, existingEntries, existingBlocks] = await Promise.all([
    db.select({ slug: agentMemoryTopics.slug }).from(agentMemoryTopics).limit(1),
    db.select({ id: agentMemoryEntries.id }).from(agentMemoryEntries).limit(1),
    db.select({ id: agentMemoryTopicBlocks.id }).from(agentMemoryTopicBlocks).limit(1),
  ]);
  if (existingTopics.length || existingEntries.length || existingBlocks.length) {
    throw new Error(
      "agent_memory_* tables already have rows -- refusing to run the day-one migration a second time. " +
        "Use server/scripts/agent-memory-cli.ts for ongoing writes instead.",
    );
  }

  const indexRaw = await fs.readFile(MEMORY_INDEX_PATH, "utf8");
  const parsedEntries = parseMemoryIndex(indexRaw);

  const allSlugs = (await fs.readdir(MEMORY_DIR))
    .filter((name) => name.endsWith(".md") && name !== "MEMORY.md")
    .map((name) => name.slice(0, -".md".length))
    .sort();

  const topicFileSet = new Set(allSlugs);
  const missingSlugs = [...new Set(parsedEntries.map((entry) => entry.topicSlug))].filter((slug) => !topicFileSet.has(slug));
  if (missingSlugs.length > 0) {
    throw new Error(`MEMORY.md references topic file(s) that do not exist on disk: ${missingSlugs.join(", ")}`);
  }
  const referencedSlugs = new Set(parsedEntries.map((entry) => entry.topicSlug));
  const orphanCount = allSlugs.filter((slug) => !referencedSlugs.has(slug)).length;

  console.log(
    `Parsed ${parsedEntries.length} index entries; ${allSlugs.length} topic files on disk ` +
      `(${orphanCount} not referenced by any bullet -- migrating them too).`,
  );

  // formatTopicFile() (agent-memory-core.ts) unconditionally appends exactly
  // one trailing "\n" when rendering a topic's (here, sole) block. Of the
  // 272 real files on disk, 223 already end with exactly one "\n", 48 have
  // none, and 1 has two -- storing each file's raw bytes verbatim would
  // therefore give 223 files a spurious extra blank line at regeneration.
  // Stripping exactly one trailing "\n" here (if present) before storing
  // means formatTopicFile()'s own "+\n" exactly reproduces each file's
  // original ending, whatever it was, and the 48 files with no trailing
  // newline at all get that one, unambiguously cosmetic, gap closed.
  const bodiesBySlug = new Map<string, string>();
  for (const slug of allSlugs) {
    const raw = await fs.readFile(path.join(MEMORY_DIR, `${slug}.md`), "utf8");
    bodiesBySlug.set(slug, raw.replace(/\n$/, ""));
  }

  // Postgres's now() (what .defaultNow() would use) resolves to the
  // enclosing transaction's start time, which every row in one multi-row
  // INSERT -- let alone every INSERT inside one transaction -- shares. Left
  // to the default, every entry/block would get an identical created_at and
  // the file's bullet order would be unrecoverable from the DB alone. A
  // synthetic one-second-per-row stride keeps insertion order exact without
  // depending on real wall-clock gaps between statements.
  const baseTime = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(agentMemoryTopics).values(allSlugs.map((slug) => ({ slug })));

    await tx.insert(agentMemoryEntries).values(
      parsedEntries.map((entry, index) => ({
        topicSlug: entry.topicSlug,
        title: entry.title,
        hook: entry.hook,
        createdByActor: MIGRATION_ACTOR,
        createdAt: new Date(baseTime.getTime() + index * 1000),
      })),
    );

    await tx.insert(agentMemoryTopicBlocks).values(
      allSlugs.map((slug, index) => ({
        topicSlug: slug,
        orderKey: keyBetween(undefined, undefined),
        bodyMarkdown: bodiesBySlug.get(slug)!,
        authorActor: MIGRATION_ACTOR,
        createdAt: new Date(baseTime.getTime() + index * 1000),
        updatedAt: new Date(baseTime.getTime() + index * 1000),
      })),
    );
  });

  console.log(`Inserted ${allSlugs.length} topics, ${parsedEntries.length} entries, ${allSlugs.length} blocks. Regenerating files from DB state...`);
  const { indexPath, topicPaths } = await regenerateAll();
  console.log(`Regenerated ${indexPath} and ${topicPaths.length} topic file(s).`);
}

main()
  .then(async () => {
    await closeDbConnections();
    process.exit(0);
  })
  .catch(async (error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    await closeDbConnections().catch(() => {});
    process.exit(1);
  });
