// Agent Memory CLI — the one sanctioned writer for .agents/memory/MEMORY.md
// and every .agents/memory/<slug>.md file. Sibling to shared-spec-cli.ts and
// source-control-cli.ts: every subcommand is a thin argument-parsing wrapper
// around server/services/agent-memory-core.ts, which owns the actual DB
// write + file-regeneration + evidence logic.
//
// See docs/superpowers/specs/2026-09-21-shared-docs-db-canonical-design.md
// and docs/superpowers/plans/2026-09-21-shared-docs-db-canonical-implementation-plan.md
// (Phase 3) for the design this implements.
//
// --actor is a self-reported hat identity (luca-replit, luca-claude-code,
// luca-gemini, luca-holahola, ...), matching the existing --source
// convention on the canonical-conversation-exchange path. This is
// cooperative infrastructure, not an access-control boundary.

import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { agentMemoryTopics } from "@shared/schema";
import { closeDbConnections, getSharedDb } from "../db";
import {
  AgentMemoryError,
  addBlock,
  addEntry,
  editBlock,
  editEntry,
  regenerateAll,
  removeBlock,
  removeEntry,
  writeTopicFile,
  type RecentActivityEvidence,
} from "../services/agent-memory-core";

const COMMANDS = new Set([
  "add-entry",
  "add-block",
  "edit-entry",
  "edit-block",
  "remove-entry",
  "remove-block",
  "regenerate",
]);

type Options = Record<string, string | boolean>;

function usage(): never {
  fail(
    [
      "Usage: agent-memory-cli <command> [options]",
      "  add-entry --topic-slug <slug> --title <title> --hook <hook> --actor <actor>",
      "  add-block --topic-slug <slug> [--heading <heading>] --body-file <path> --actor <actor> [--after <block-id>]",
      "  edit-entry --entry-id <id> --base-version <n> --hook <hook> --actor <actor>",
      "  edit-block --block-id <id> --base-version <n> --body-file <path> --actor <actor>",
      "  remove-entry --entry-id <id> --actor <actor>",
      "  remove-block --block-id <id> --actor <actor>",
      "  regenerate --all | --topic-slug <slug>",
    ].join("\n"),
  );
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(64);
}

function parse(argv: string[]): { command: string; options: Options } {
  const rest = [...argv];
  const command = rest.shift();
  if (!command || !COMMANDS.has(command)) usage();
  const options: Options = {};
  while (rest.length) {
    const part = rest.shift()!;
    if (!part.startsWith("--")) fail(`Unexpected argument: ${part}`);
    const name = part.slice(2);
    const value = rest[0] !== undefined && !rest[0].startsWith("--") ? rest.shift()! : true;
    if (!name || options[name] !== undefined) fail(`Invalid or repeated option: ${part}`);
    options[name] = value;
  }
  return { command, options };
}

function required(options: Options, name: string): string {
  const value = options[name];
  if (typeof value !== "string" || !value) fail(`--${name} is required`);
  return value;
}

function requiredInt(options: Options, name: string): number {
  const raw = required(options, name);
  const value = Number(raw);
  if (!Number.isInteger(value)) fail(`--${name} must be an integer, got ${JSON.stringify(raw)}`);
  return value;
}

async function requiredBodyFile(options: Options): Promise<string> {
  const filePath = required(options, "body-file");
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    fail(`Could not read --body-file "${filePath}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

// The dynamic half of the "you are not alone" reminder (see design doc) --
// deliberately not static boilerplate, so it can't be skimmed past the way a
// fixed warning can.
function describeEvidence(evidence: RecentActivityEvidence): string {
  if (evidence.otherActors.length === 0) {
    return `Note: no other actors touched topic "${evidence.topicSlug}" in the last 24h.`;
  }
  return `Note: ${evidence.otherActors.length} other actor(s) (${evidence.otherActors.join(", ")}) touched topic "${evidence.topicSlug}" in the last 24h.`;
}

async function topicExists(topicSlug: string): Promise<boolean> {
  const db = getSharedDb();
  const [row] = await db.select({ slug: agentMemoryTopics.slug }).from(agentMemoryTopics).where(eq(agentMemoryTopics.slug, topicSlug));
  return Boolean(row);
}

/** Runs one subcommand and returns the process exit code. Never calls process.exit() itself, so tests can import and call this directly. */
export async function runAgentMemoryCli(argv: string[] = process.argv.slice(2)): Promise<number> {
  const { command, options } = parse(argv);

  if (command === "add-entry") {
    const { entry, evidence } = await addEntry({
      topicSlug: required(options, "topic-slug"),
      title: required(options, "title"),
      hook: required(options, "hook"),
      actor: required(options, "actor"),
    });
    console.log(`Wrote entry ${entry.id} ("${entry.title}") to topic "${entry.topicSlug}".`);
    console.log(describeEvidence(evidence));
    return 0;
  }

  if (command === "add-block") {
    const topicSlug = required(options, "topic-slug");
    const actor = required(options, "actor");
    const bodyMarkdown = await requiredBodyFile(options);
    const { block, evidence } = await addBlock({
      topicSlug,
      heading: typeof options.heading === "string" ? options.heading : undefined,
      bodyMarkdown,
      actor,
      afterBlockId: typeof options.after === "string" ? options.after : undefined,
    });
    console.log(`Wrote block ${block.id} to topic "${block.topicSlug}".`);
    console.log(describeEvidence(evidence));
    return 0;
  }

  if (command === "edit-entry") {
    const result = await editEntry({
      entryId: required(options, "entry-id"),
      baseVersion: requiredInt(options, "base-version"),
      hook: required(options, "hook"),
      actor: required(options, "actor"),
    });
    if (!result.ok) {
      console.error(`Stale version: entry ${result.current.id} is now at version ${result.current.version} (yours was based on an older version).`);
      console.error(`Current hook: ${result.current.hook}`);
      return 1;
    }
    console.log(`Updated entry ${result.value.id} to version ${result.value.version}.`);
    console.log(describeEvidence(result.evidence));
    return 0;
  }

  if (command === "edit-block") {
    const blockId = required(options, "block-id");
    const baseVersion = requiredInt(options, "base-version");
    const actor = required(options, "actor");
    const bodyMarkdown = await requiredBodyFile(options);
    const result = await editBlock({ blockId, baseVersion, bodyMarkdown, actor });
    if (!result.ok) {
      console.error(`Stale version: block ${result.current.id} is now at version ${result.current.version} (yours was based on an older version).`);
      console.error(`Current body:\n${result.current.bodyMarkdown}`);
      return 1;
    }
    console.log(`Updated block ${result.value.id} to version ${result.value.version}.`);
    console.log(describeEvidence(result.evidence));
    return 0;
  }

  if (command === "remove-entry") {
    const result = await removeEntry(required(options, "entry-id"), required(options, "actor"));
    if (result.alreadyDeleted) {
      console.log(`Entry ${result.value.id} was already deleted (by ${result.value.deletedByActor}) -- no-op.`);
      return 0;
    }
    console.log(`Removed entry ${result.value.id} ("${result.value.title}") from topic "${result.value.topicSlug}".`);
    if (result.evidence) console.log(describeEvidence(result.evidence));
    return 0;
  }

  if (command === "remove-block") {
    const result = await removeBlock(required(options, "block-id"), required(options, "actor"));
    if (result.alreadyDeleted) {
      console.log(`Block ${result.value.id} was already deleted (by ${result.value.deletedByActor}) -- no-op.`);
      return 0;
    }
    console.log(`Removed block ${result.value.id} from topic "${result.value.topicSlug}".`);
    if (result.evidence) console.log(describeEvidence(result.evidence));
    return 0;
  }

  // regenerate --all | --topic-slug <slug>
  const wantsAll = Boolean(options.all);
  const topicSlugOption = typeof options["topic-slug"] === "string" ? options["topic-slug"] : undefined;
  if (wantsAll && topicSlugOption) fail("regenerate takes --all or --topic-slug, not both.");
  if (!wantsAll && !topicSlugOption) fail("regenerate requires --all or --topic-slug <slug>.");
  if (wantsAll) {
    const { indexPath, topicPaths } = await regenerateAll();
    console.log(`Regenerated ${indexPath} and ${topicPaths.length} topic file(s):`);
    for (const topicPath of topicPaths) console.log(`  ${topicPath}`);
    return 0;
  }
  if (!(await topicExists(topicSlugOption!))) {
    fail(`Topic "${topicSlugOption}" does not exist.`);
  }
  const filePath = await writeTopicFile(topicSlugOption!);
  console.log(`Regenerated ${filePath}.`);
  return 0;
}

// server/db.ts's pool sets idleTimeoutMillis but not allowExitOnIdle, so
// falling off the end without an explicit process.exit() would hold this
// one-shot process alive for up to two minutes after the real work is done.
// See .agents/memory/pg-pool-idle-timeout-ci-hang.md.
if (process.argv[1]?.includes("agent-memory-cli")) {
  runAgentMemoryCli()
    .then(async (exitCode) => {
      await closeDbConnections();
      process.exit(exitCode);
    })
    .catch(async (error) => {
      const message = error instanceof AgentMemoryError ? error.message : error instanceof Error ? error.stack ?? error.message : String(error);
      process.stderr.write(`${message}\n`);
      await closeDbConnections().catch(() => {});
      process.exit(1);
    });
}
