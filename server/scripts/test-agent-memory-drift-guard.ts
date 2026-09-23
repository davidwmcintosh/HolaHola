#!/usr/bin/env npx tsx
/**
 * test-agent-memory-drift-guard.ts
 *
 * Guard for the invariant stated in AGENT_MEMORY_PREAMBLE, the warning baked
 * into the header of every generated .agents/memory/*.md file: these files
 * are pure projections of the agent_memory_* database tables, and must
 * never be hand-edited directly. Nothing enforced that beyond the warning
 * text itself — a direct file edit succeeded silently, left the tracked
 * tree dirty (blocking unrelated source-control prepare/candidate steps
 * until someone noticed and reverted it), and per that same warning got
 * silently overwritten — losing the hand-edited content — by the next real
 * agent-memory-cli.ts write. Hit live in this project's own agent session
 * on Sep 23, 2026 (task #1543). See
 * server/services/agent-memory-drift-guard.ts for the detection algorithm.
 *
 * Normal mode:
 *   npx tsx server/scripts/test-agent-memory-drift-guard.ts
 *     Recomputes what agent-memory-core.ts's formatMemoryIndex()/
 *     formatTopicFile() would generate for every topic from the CURRENT
 *     database — the exact same pure formatters
 *     writeMemoryIndexFile()/writeTopicFile()/regenerateAll() use — and
 *     reports a failure only for the subset of .agents/memory/*.md paths
 *     this checkout's OWN git working tree shows as locally modified,
 *     deleted, or untracked (findAgentMemoryDriftInWorkingTree). That
 *     scoping matters because the agent_memory_* tables are shared live
 *     across independent host checkouts (Replit Agent, Claude Code,
 *     Gemini, HolaHola runtime — see AGENT_MEMORY_PREAMBLE): another host
 *     can add a topic/entry/block at any moment, which this checkout will
 *     not have on disk until its next pull. That is normal and self-
 *     resolving, not a hand-edit, and reporting it as a failure here would
 *     just teach people to ignore this check. Real content that differs
 *     from the database purely because of that lag is still surfaced,
 *     just as an informational "ignored as unsynced" count, not a
 *     failure. Read-only: never writes to .agents/memory/ or the database.
 *
 *     Replit-only (see run-validation-suite.sh's registration comment for
 *     why): a fresh GitHub Actions checkout has an empty job-local
 *     database AND a working tree with nothing locally modified relative
 *     to the single commit it checked out, so this mode can never observe
 *     a real hand-edit there — there is no interactive session in which
 *     one could have happened. It has real value only in a long-running
 *     interactive checkout like this Replit workspace.
 *
 * Self-check mode:
 *   npx tsx server/scripts/test-agent-memory-drift-guard.ts --self-check
 *     Hermetic and git-free for the core comparison: proves
 *     findAgentMemoryDrift() catches a hand-edited topic file, a
 *     hand-edited MEMORY.md index, a file deleted out from under the
 *     database, a file created by hand with no backing topic, and an
 *     exact single-character difference — using fixture entries/blocks
 *     and a private mkdtemp() scratch directory.
 *
 *     Then, using a real disposable git repo (also under mkdtemp(),
 *     destroyed afterward) built the same way check-episode-content-
 *     loss.ts's self-check does, proves findAgentMemoryDriftInWorkingTree()
 *     tells a real hand-edit apart from simulated cross-host database
 *     drift: an uncommitted local edit, an uncommitted local deletion, and
 *     a brand-new untracked file are all still reported; a database write
 *     simulating a different checkout's already-committed, already-synced
 *     topic is not reported as a failure (only as informational
 *     "ignored as unsynced") because this checkout's own file for it
 *     stays byte-for-byte what it last committed.
 *
 *     Never touches the real .agents/memory/, and never queries the
 *     database (fixtures satisfy the injected fetchers). Importing
 *     agent-memory-core.ts for its pure formatMemoryIndex()/
 *     formatTopicFile() functions does construct the shared connection
 *     pool object as an unavoidable module-load side effect (see
 *     server/db.ts's top-level `export const db = getDb();`) — the same
 *     side effect every test of that module already accepts — but the
 *     pool is never connected to or queried in this mode.
 *
 * Exit codes:
 *   0 — no in-scope file has drifted from the database (self-check: all
 *       assertions passed)
 *   1 — at least one in-scope file has drifted from the database
 *       (self-check: an assertion failed)
 */

import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AgentMemoryEntry, AgentMemoryTopicBlock } from "@shared/schema";
import {
  fetchAllTopicSlugs,
  fetchMemoryIndexEntries,
  fetchTopicBlocks,
  formatMemoryIndex,
  formatTopicFile,
} from "../services/agent-memory-core";
import {
  AGENT_MEMORY_INDEX_FILE_NAME,
  findAgentMemoryDrift,
  findAgentMemoryDriftInWorkingTree,
  type AgentMemoryDriftFetchers,
  type AgentMemoryDriftFinding,
  type AgentMemoryGitRunner,
} from "../services/agent-memory-drift-guard";
import { closeDbConnections } from "../db";

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;

const REAL_MEMORY_DIR = path.join(process.cwd(), ".agents/memory");

function makeRealGitRunner(): AgentMemoryGitRunner {
  return async (args, cwd) => {
    try {
      const stdout = execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
      return { stdout, exitCode: 0 };
    } catch (err: any) {
      const stdout = typeof err?.stdout === "string" ? err.stdout : (err?.stdout?.toString?.("utf-8") ?? "");
      const exitCode = typeof err?.status === "number" ? err.status : 1;
      return { stdout, exitCode };
    }
  };
}

// ---------------------------------------------------------------------------
// Normal mode
// ---------------------------------------------------------------------------

function reasonDetail(reason: AgentMemoryDriftFinding["reason"]): string {
  switch (reason) {
    case "content-mismatch":
      return "content does not match the database";
    case "missing-from-disk":
      return "the database expects this file, but it is missing from disk";
    case "orphaned-on-disk":
      return "exists on disk with no matching topic in the database";
  }
}

function reportFindings(findings: AgentMemoryDriftFinding[]): void {
  console.log("");
  console.log(R("╔══════════════════════════════════════════════════════════════════════════╗"));
  console.log(R("║   ⚠️   AGENT MEMORY FILE(S) OUT OF SYNC WITH THE DATABASE   ⚠️            ║"));
  console.log(R("╠══════════════════════════════════════════════════════════════════════════╣"));
  console.log(R("║  The following .agents/memory/ file(s) have local, uncommitted changes"));
  console.log(R("║  that do not match what server/services/agent-memory-core.ts would"));
  console.log(R("║  generate for them from the current database — almost always caused by"));
  console.log(R("║  a direct hand-edit."));
  console.log(R("║"));
  for (const finding of findings) {
    console.log(R(`║    • ${finding.fileName} — ${reasonDetail(finding.reason)}`));
  }
  console.log(R("║"));
  console.log(R("║  WHAT TO DO:"));
  console.log(R("║    Never hand-edit .agents/memory/MEMORY.md or any .agents/memory/*.md"));
  console.log(R("║    file directly. Every change goes through"));
  console.log(R("║    server/scripts/agent-memory-cli.ts, which writes the database first"));
  console.log(R("║    and regenerates the file from it."));
  console.log(R("║"));
  console.log(R("║    To discard an accidental hand-edit and restore the correct content:"));
  console.log(R("║      npx tsx server/scripts/agent-memory-cli.ts regenerate --all"));
  console.log(R("╚══════════════════════════════════════════════════════════════════════════╝"));
  console.log("");
}

async function runNormalMode(): Promise<number> {
  const fetchers: AgentMemoryDriftFetchers = {
    fetchMemoryIndexEntries,
    fetchTopicBlocks,
    listTopicSlugs: fetchAllTopicSlugs,
  };

  const { findings, filesExpected, ignoredAsUnsynced } = await findAgentMemoryDriftInWorkingTree(
    REAL_MEMORY_DIR,
    process.cwd(),
    fetchers,
    makeRealGitRunner(),
  );

  if (findings.length === 0) {
    const unsyncedNote =
      ignoredAsUnsynced.length > 0
        ? ` (${ignoredAsUnsynced.length} file(s) are behind a newer shared database state written by another checkout, e.g. ${ignoredAsUnsynced[0].fileName} — not a local hand-edit, ignored)`
        : "";
    console.log(
      G(`[agent-memory-drift-guard] No locally-changed .agents/memory/*.md file (of ${filesExpected} expected) has drifted from the database. Passed.${unsyncedNote}`),
    );
    return 0;
  }

  reportFindings(findings);
  return 1;
}

// ---------------------------------------------------------------------------
// Self-check mode
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(G(`  ✓ ${label}`));
    passed++;
  } else {
    console.log(R(`  ✗ ${label}`));
    if (detail) console.log(R(`       ${detail}`));
    failed++;
  }
}

function fixtureEntry(overrides: Partial<AgentMemoryEntry> & Pick<AgentMemoryEntry, "id" | "topicSlug" | "title" | "hook">): AgentMemoryEntry {
  return {
    createdByActor: "luca-replit",
    createdAt: new Date("2026-09-01T00:00:00Z"),
    version: 1,
    deletedAt: null,
    deletedByActor: null,
    ...overrides,
  };
}

function fixtureBlock(overrides: Partial<AgentMemoryTopicBlock> & Pick<AgentMemoryTopicBlock, "id" | "topicSlug" | "bodyMarkdown">): AgentMemoryTopicBlock {
  return {
    orderKey: "1",
    heading: null,
    authorActor: "luca-replit",
    version: 1,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    updatedAt: new Date("2026-09-01T00:00:00Z"),
    deletedAt: null,
    deletedByActor: null,
    ...overrides,
  };
}

/** Core comparison algorithm — no git involved at all, just fixtures vs a scratch directory. */
async function runCoreComparisonScenarios(): Promise<void> {
  const scratchDir = await fs.mkdtemp(path.join(tmpdir(), "agent-memory-drift-guard-"));

  try {
    const indexEntries: AgentMemoryEntry[] = [
      fixtureEntry({ id: "e-clean", topicSlug: "clean-topic", title: "Clean topic", hook: "Nothing to see here." }),
      fixtureEntry({ id: "e-edited", topicSlug: "edited-topic", title: "Edited topic", hook: "This one gets hand-edited." }),
      fixtureEntry({ id: "e-missing", topicSlug: "missing-topic", title: "Missing topic", hook: "This file will not exist on disk yet." }),
    ];
    const blocksBySlug: Record<string, AgentMemoryTopicBlock[]> = {
      "clean-topic": [fixtureBlock({ id: "b-clean", topicSlug: "clean-topic", bodyMarkdown: "Clean topic body." })],
      "edited-topic": [fixtureBlock({ id: "b-edited", topicSlug: "edited-topic", bodyMarkdown: "Edited topic body, before the hand-edit." })],
      "missing-topic": [fixtureBlock({ id: "b-missing", topicSlug: "missing-topic", bodyMarkdown: "Missing topic body." })],
    };

    const fetchers: AgentMemoryDriftFetchers = {
      fetchMemoryIndexEntries: async () => indexEntries,
      fetchTopicBlocks: async (topicSlug) => blocksBySlug[topicSlug] ?? [],
      listTopicSlugs: async () => Object.keys(blocksBySlug),
    };

    // ── Seed the scratch directory to exactly match the fixtures ---------
    // (the state a correct `agent-memory-cli.ts regenerate` would leave).
    await fs.writeFile(path.join(scratchDir, AGENT_MEMORY_INDEX_FILE_NAME), formatMemoryIndex(indexEntries), "utf8");
    await fs.writeFile(path.join(scratchDir, "clean-topic.md"), formatTopicFile(blocksBySlug["clean-topic"]), "utf8");
    await fs.writeFile(path.join(scratchDir, "edited-topic.md"), formatTopicFile(blocksBySlug["edited-topic"]), "utf8");
    // missing-topic.md is deliberately never written here.

    const baseline = await findAgentMemoryDrift(scratchDir, fetchers);
    assert(
      "Baseline: freshly-regenerated files report no content-mismatch",
      !baseline.findings.some((f) => f.reason === "content-mismatch"),
      `Got: ${JSON.stringify(baseline.findings)}`,
    );
    assert(
      "Baseline: a topic the database expects but with no file on disk is reported as missing, and only that one",
      baseline.findings.length === 1 &&
        baseline.findings[0].fileName === "missing-topic.md" &&
        baseline.findings[0].topicSlug === "missing-topic" &&
        baseline.findings[0].reason === "missing-from-disk",
      `Got: ${JSON.stringify(baseline.findings)}`,
    );

    // Write the missing file too, so later scenarios isolate one failure mode at a time.
    await fs.writeFile(path.join(scratchDir, "missing-topic.md"), formatTopicFile(blocksBySlug["missing-topic"]), "utf8");
    const fullyInSync = await findAgentMemoryDrift(scratchDir, fetchers);
    assert(
      "Sanity: once every expected file is written, no drift is reported at all",
      fullyInSync.findings.length === 0,
      `Got: ${JSON.stringify(fullyInSync.findings)}`,
    );

    // ── Hand-edit a topic file directly on disk (bypassing agent-memory-cli.ts) ──
    const editedPath = path.join(scratchDir, "edited-topic.md");
    const beforeEdit = await fs.readFile(editedPath, "utf8");
    await fs.writeFile(editedPath, `${beforeEdit}\nSomeone hand-edited this line in directly.\n`, "utf8");

    const afterTopicEdit = await findAgentMemoryDrift(scratchDir, fetchers);
    assert(
      "A hand-edited topic file is caught, and ONLY that file is reported",
      afterTopicEdit.findings.length === 1 &&
        afterTopicEdit.findings[0].fileName === "edited-topic.md" &&
        afterTopicEdit.findings[0].topicSlug === "edited-topic" &&
        afterTopicEdit.findings[0].reason === "content-mismatch",
      `Got: ${JSON.stringify(afterTopicEdit.findings)}`,
    );

    // ── Negative control: prove an existence-only check would miss this ---
    const filesOnDiskAfterEdit = new Set(await fs.readdir(scratchDir));
    const expectedFileNames = [AGENT_MEMORY_INDEX_FILE_NAME, "clean-topic.md", "edited-topic.md", "missing-topic.md"];
    const naiveExistenceOnlyWouldPass = expectedFileNames.every((name) => filesOnDiskAfterEdit.has(name));
    assert(
      "Regression guard: a naive existence-only check would NOT catch the hand-edit above, proving content comparison has real bite",
      naiveExistenceOnlyWouldPass === true,
      "Expected the naive existence-only check to see every file present and report no problem, while the real check still catches the content drift.",
    );

    await fs.writeFile(editedPath, beforeEdit, "utf8");

    // ── Hand-edit MEMORY.md itself -----------------------------------------
    const indexPath = path.join(scratchDir, AGENT_MEMORY_INDEX_FILE_NAME);
    const beforeIndexEdit = await fs.readFile(indexPath, "utf8");
    await fs.writeFile(indexPath, beforeIndexEdit.replace("Nothing to see here.", "Someone rewrote this hook by hand."), "utf8");

    const afterIndexEdit = await findAgentMemoryDrift(scratchDir, fetchers);
    assert(
      "A hand-edited MEMORY.md index is caught, with topicSlug null (it is the index, not a topic file)",
      afterIndexEdit.findings.length === 1 &&
        afterIndexEdit.findings[0].fileName === AGENT_MEMORY_INDEX_FILE_NAME &&
        afterIndexEdit.findings[0].topicSlug === null &&
        afterIndexEdit.findings[0].reason === "content-mismatch",
      `Got: ${JSON.stringify(afterIndexEdit.findings)}`,
    );

    await fs.writeFile(indexPath, beforeIndexEdit, "utf8");

    // ── A hand-created file with no backing topic in the database ----------
    const orphanPath = path.join(scratchDir, "never-went-through-the-cli.md");
    await fs.writeFile(orphanPath, "# Someone created this file directly\n", "utf8");
    const afterOrphan = await findAgentMemoryDrift(scratchDir, fetchers);
    assert(
      "A file with no matching database topic is reported as orphaned, and only that file",
      afterOrphan.findings.length === 1 &&
        afterOrphan.findings[0].fileName === "never-went-through-the-cli.md" &&
        afterOrphan.findings[0].topicSlug === "never-went-through-the-cli" &&
        afterOrphan.findings[0].reason === "orphaned-on-disk",
      `Got: ${JSON.stringify(afterOrphan.findings)}`,
    );
    await fs.rm(orphanPath);

    // ── Comparison is exact, not fuzzy/normalized ---------------------------
    await fs.appendFile(path.join(scratchDir, "clean-topic.md"), " ");
    const trailingWhitespace = await findAgentMemoryDrift(scratchDir, fetchers);
    assert(
      "Even a single trailing character is caught — byte-for-byte comparison, not fuzzy",
      trailingWhitespace.findings.length === 1 && trailingWhitespace.findings[0].fileName === "clean-topic.md",
      `Got: ${JSON.stringify(trailingWhitespace.findings)}`,
    );
    await fs.writeFile(path.join(scratchDir, "clean-topic.md"), formatTopicFile(blocksBySlug["clean-topic"]), "utf8");

    // ── Sanity: after restoring everything, the scratch dir is clean again ─
    const restored = await findAgentMemoryDrift(scratchDir, fetchers);
    assert(
      "Sanity: after undoing every scenario above, no drift remains",
      restored.findings.length === 0,
      `Got: ${JSON.stringify(restored.findings)}`,
    );
  } finally {
    await fs.rm(scratchDir, { recursive: true, force: true });
  }
}

/**
 * Working-tree scoping — the part that tells a real hand-edit apart from
 * another checkout's already-synced database write. Uses a real disposable
 * git repo (mirrors check-episode-content-loss.ts's self-check) because the
 * distinction being tested is inherently a git-state distinction; a fake
 * git runner could only assert what it was told to return, not prove the
 * real `git diff`/`git ls-files` invocations behave as assumed.
 */
async function runWorkingTreeGitScenarios(): Promise<void> {
  const repoDir = await fs.mkdtemp(path.join(tmpdir(), "agent-memory-drift-guard-git-"));

  try {
    execFileSync("git", ["init", "-q"], { cwd: repoDir });
    execFileSync("git", ["config", "user.email", "self-check@example.com"], { cwd: repoDir });
    execFileSync("git", ["config", "user.name", "Agent Memory Drift Guard Self-Check"], { cwd: repoDir });

    const memoryDir = path.join(repoDir, ".agents", "memory");
    await fs.mkdir(memoryDir, { recursive: true });

    const indexEntries: AgentMemoryEntry[] = [
      fixtureEntry({ id: "e-committed", topicSlug: "committed-topic", title: "Committed topic", hook: "Already synced." }),
      fixtureEntry({ id: "e-behind", topicSlug: "behind-topic", title: "Behind topic", hook: "Another checkout moved this one ahead." }),
    ];
    let blocksBySlug: Record<string, AgentMemoryTopicBlock[]> = {
      "committed-topic": [fixtureBlock({ id: "b-committed", topicSlug: "committed-topic", bodyMarkdown: "Committed topic body." })],
      "behind-topic": [fixtureBlock({ id: "b-behind-1", topicSlug: "behind-topic", bodyMarkdown: "Behind topic body, version 1." })],
    };
    const fetchers: AgentMemoryDriftFetchers = {
      fetchMemoryIndexEntries: async () => indexEntries,
      fetchTopicBlocks: async (topicSlug) => blocksBySlug[topicSlug] ?? [],
      listTopicSlugs: async () => Object.keys(blocksBySlug),
    };
    const gitRunner = makeRealGitRunner();

    // Seed + commit a fully-in-sync checkout — the state a real
    // regenerate-then-commit leaves on every host.
    await fs.writeFile(path.join(memoryDir, AGENT_MEMORY_INDEX_FILE_NAME), formatMemoryIndex(indexEntries), "utf8");
    await fs.writeFile(path.join(memoryDir, "committed-topic.md"), formatTopicFile(blocksBySlug["committed-topic"]), "utf8");
    await fs.writeFile(path.join(memoryDir, "behind-topic.md"), formatTopicFile(blocksBySlug["behind-topic"]), "utf8");
    execFileSync("git", ["add", "-A"], { cwd: repoDir });
    execFileSync("git", ["commit", "-q", "-m", "seed"], { cwd: repoDir });

    const baseline = await findAgentMemoryDriftInWorkingTree(memoryDir, repoDir, fetchers, gitRunner);
    assert(
      "Working-tree scope, baseline: a freshly-committed, fully-synced checkout reports nothing, and nothing is ignored",
      baseline.findings.length === 0 && baseline.ignoredAsUnsynced.length === 0,
      `Got findings: ${JSON.stringify(baseline.findings)}, ignored: ${JSON.stringify(baseline.ignoredAsUnsynced)}`,
    );

    // ── Simulate a different checkout's write landing in the shared database:
    // the database moves ahead, but nothing changes in THIS working tree. ──
    blocksBySlug = {
      ...blocksBySlug,
      "behind-topic": [
        ...blocksBySlug["behind-topic"],
        fixtureBlock({ id: "b-behind-2", topicSlug: "behind-topic", bodyMarkdown: "Behind topic body, version 2 — written by a different checkout." }),
      ],
    };
    const rawDuringLag = await findAgentMemoryDrift(memoryDir, fetchers);
    assert(
      "Sanity: the raw (non-git-scoped) comparison DOES see the simulated cross-checkout write as drift",
      rawDuringLag.findings.length === 1 && rawDuringLag.findings[0].fileName === "behind-topic.md",
      `Got: ${JSON.stringify(rawDuringLag.findings)}`,
    );
    const duringLag = await findAgentMemoryDriftInWorkingTree(memoryDir, repoDir, fetchers, gitRunner);
    assert(
      "Working-tree scope: a clean, already-committed file that is merely behind a newer shared-database write is NOT reported as a failure",
      duringLag.findings.length === 0,
      `Got: ${JSON.stringify(duringLag.findings)}`,
    );
    assert(
      "...but it IS surfaced as informational \"ignored as unsynced\", so the signal is never silently dropped",
      duringLag.ignoredAsUnsynced.length === 1 && duringLag.ignoredAsUnsynced[0].fileName === "behind-topic.md",
      `Got: ${JSON.stringify(duringLag.ignoredAsUnsynced)}`,
    );

    // ── Real hand-edit: modify a tracked file locally without committing ──
    const committedPath = path.join(memoryDir, "committed-topic.md");
    const beforeHandEdit = await fs.readFile(committedPath, "utf8");
    await fs.writeFile(committedPath, `${beforeHandEdit}\nSomeone hand-edited this directly in the working tree.\n`, "utf8");

    const afterHandEdit = await findAgentMemoryDriftInWorkingTree(memoryDir, repoDir, fetchers, gitRunner);
    assert(
      "Working-tree scope: an uncommitted hand-edit to a tracked file IS reported",
      afterHandEdit.findings.length === 1 &&
        afterHandEdit.findings[0].fileName === "committed-topic.md" &&
        afterHandEdit.findings[0].reason === "content-mismatch",
      `Got: ${JSON.stringify(afterHandEdit.findings)}`,
    );
    await fs.writeFile(committedPath, beforeHandEdit, "utf8");

    // ── Untracked orphan file, never committed, no backing topic at all ──
    const orphanPath = path.join(memoryDir, "never-went-through-the-cli.md");
    await fs.writeFile(orphanPath, "# Hand-created, never committed\n", "utf8");
    const afterUntrackedOrphan = await findAgentMemoryDriftInWorkingTree(memoryDir, repoDir, fetchers, gitRunner);
    assert(
      "Working-tree scope: a brand-new untracked file with no backing topic IS reported",
      afterUntrackedOrphan.findings.length === 1 &&
        afterUntrackedOrphan.findings[0].fileName === "never-went-through-the-cli.md" &&
        afterUntrackedOrphan.findings[0].reason === "orphaned-on-disk",
      `Got: ${JSON.stringify(afterUntrackedOrphan.findings)}`,
    );
    await fs.rm(orphanPath);

    // ── Tracked file deleted locally (uncommitted) while the database still expects it ──
    await fs.rm(committedPath);
    const afterLocalDelete = await findAgentMemoryDriftInWorkingTree(memoryDir, repoDir, fetchers, gitRunner);
    assert(
      "Working-tree scope: a tracked file deleted locally without committing, while the database still expects it, IS reported",
      afterLocalDelete.findings.length === 1 &&
        afterLocalDelete.findings[0].fileName === "committed-topic.md" &&
        afterLocalDelete.findings[0].reason === "missing-from-disk",
      `Got: ${JSON.stringify(afterLocalDelete.findings)}`,
    );
    await fs.writeFile(committedPath, beforeHandEdit, "utf8");

    // A brand-new topic the database has but this checkout has never pulled
    // (never existed in HEAD or the working tree at all) is a strict subset
    // of the cross-checkout-lag scenario proven above — missing-from-disk
    // instead of content-mismatch, but the same "clean, not locally dirty"
    // shape. A path that was never created here cannot appear in `git
    // status` at all, so it is excluded by construction, not by a
    // special case this test would need to separately prove.

    // ── Sanity: after undoing every working-tree scenario above, the checkout is clean and fully in sync again ──
    blocksBySlug = { ...blocksBySlug, "behind-topic": blocksBySlug["behind-topic"].slice(0, 1) };
    const restored = await findAgentMemoryDriftInWorkingTree(memoryDir, repoDir, fetchers, gitRunner);
    assert(
      "Sanity: after undoing every working-tree scenario above, no drift and nothing ignored remains",
      restored.findings.length === 0 && restored.ignoredAsUnsynced.length === 0,
      `Got findings: ${JSON.stringify(restored.findings)}, ignored: ${JSON.stringify(restored.ignoredAsUnsynced)}`,
    );
  } finally {
    await fs.rm(repoDir, { recursive: true, force: true });
  }
}

async function runSelfCheck(): Promise<number> {
  console.log("\n" + "═".repeat(70));
  console.log(B("  agent-memory drift guard — SELF-CHECK"));
  console.log("═".repeat(70) + "\n");

  await runCoreComparisonScenarios();
  await runWorkingTreeGitScenarios();

  console.log("");
  const total = passed + failed;
  if (failed === 0) {
    console.log(G(`✓  Self-check passed (${total} assertions). No real .agents/memory/ file was touched and the database was never queried.\n`));
    return 0;
  }
  console.log(R(`✗  ${failed} of ${total} assertions failed — the agent-memory drift guard is NOT working correctly.\n`));
  return 1;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  return process.argv.includes("--self-check") ? runSelfCheck() : runNormalMode();
}

main()
  .then(async (exitCode) => {
    await closeDbConnections();
    process.exit(exitCode);
  })
  .catch(async (error) => {
    console.error(R(`[agent-memory-drift-guard] Unhandled error: ${error instanceof Error ? error.stack ?? error.message : String(error)}`));
    await closeDbConnections().catch(() => {});
    process.exit(1);
  });
