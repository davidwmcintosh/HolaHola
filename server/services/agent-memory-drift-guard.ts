// Agent Memory drift guard — detects a hand-edited .agents/memory/*.md file.
//
// .agents/memory/MEMORY.md and every .agents/memory/<slug>.md file are
// supposed to be pure, byte-for-byte projections of the agent_memory_*
// database tables (see agent-memory-core.ts's own header comment and
// AGENT_MEMORY_PREAMBLE, the warning baked into the top of every generated
// MEMORY.md). Nothing previously enforced that beyond the warning text
// itself: a direct hand-edit succeeds silently, leaves the tracked tree
// dirty (which blocks unrelated source-control prepare/candidate steps
// until someone notices and reverts it), and per that same warning gets
// silently overwritten — losing whatever the hand-edit contained — the next
// time any hat runs a real agent-memory-cli.ts write. Hit live in this
// project's own agent session on Sep 23, 2026 (task #1543).
//
// findAgentMemoryDrift() is the comparison algorithm: given a directory and
// a set of DB-reading functions, which files on disk do NOT match what
// agent-memory-core.ts's own formatMemoryIndex()/formatTopicFile() would
// generate for them right now. The DB-reading functions are injected
// (AgentMemoryDriftFetchers) rather than imported and called directly, so a
// self-check can exercise this exact function against fixture data and a
// private scratch directory — no database connection, and the real
// .agents/memory/ is never touched. See
// server/scripts/test-agent-memory-drift-guard.ts for the CLI that wires
// this to the real database and the real directory (normal mode) or to
// fixtures and a temp directory (self-check mode).
//
// Three ways a file can be out of sync, all treated as drift:
//   - content-mismatch: the file exists but its bytes differ from what the
//     database would generate (the hand-edit case this guard exists for).
//   - missing-from-disk: the database has a topic (or the index itself),
//     but no corresponding file exists on disk at all.
//   - orphaned-on-disk: a .md file exists on disk with no topic in the
//     database to back it — e.g. created by hand rather than through
//     agent-memory-cli.ts, so it would never be regenerated or protected.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { AgentMemoryEntry, AgentMemoryTopicBlock } from "@shared/schema";
import { formatMemoryIndex, formatTopicFile } from "./agent-memory-core";

export const AGENT_MEMORY_INDEX_FILE_NAME = "MEMORY.md";

export type AgentMemoryDriftReason = "content-mismatch" | "missing-from-disk" | "orphaned-on-disk";

export interface AgentMemoryDriftFinding {
  fileName: string;
  /** null only for the MEMORY.md index file itself. */
  topicSlug: string | null;
  reason: AgentMemoryDriftReason;
}

export interface AgentMemoryDriftFetchers {
  fetchMemoryIndexEntries: () => Promise<readonly AgentMemoryEntry[]>;
  fetchTopicBlocks: (topicSlug: string) => Promise<readonly AgentMemoryTopicBlock[]>;
  listTopicSlugs: () => Promise<readonly string[]>;
}

export interface AgentMemoryDriftResult {
  findings: AgentMemoryDriftFinding[];
  filesExpected: number;
}

async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw error;
  }
}

async function listMarkdownFiles(memoryDir: string): Promise<string[]> {
  try {
    return (await fs.readdir(memoryDir)).filter((name) => name.endsWith(".md"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return [];
    throw error;
  }
}

/**
 * This project's `.agents/memory/` database tables are shared live across
 * multiple independent host checkouts (Replit Agent, Claude Code, Gemini,
 * HolaHola runtime agents — see AGENT_MEMORY_PREAMBLE). Any one of them can
 * add a topic/entry/block at any moment; that host's OWN local files update
 * immediately (writeTopicFile/writeMemoryIndexFile run synchronously right
 * after the DB write), but every OTHER checkout's files stay exactly as of
 * its last git pull until it syncs. That is completely normal and self-
 * resolving — not a hand-edit — but findAgentMemoryDrift() alone cannot
 * tell the two apart: both look identical as "on-disk content does not
 * match the live database right now".
 *
 * findAgentMemoryDriftInWorkingTree() adds the distinguishing signal: a
 * hand-edit (or an accidental deletion, or a hand-created orphan file)
 * necessarily leaves this checkout's git working tree dirty for that exact
 * path, because it never went through the DB-write-then-regenerate path —
 * there is no commit to match. A file that is simply behind a newer shared
 * database state (written by a different checkout entirely) stays clean —
 * it matches this checkout's own last commit exactly, it is just older
 * than what a fresh pull would bring. Restricting findAgentMemoryDrift()'s
 * findings to paths git itself reports as locally modified, deleted, or
 * untracked keeps the two cases apart without ever hiding a real hand-edit:
 * see .agents/memory/always-on-honest-record.md — the guard must still
 * fail loud on genuine drift, just scoped to what THIS checkout actually
 * did.
 */
export type AgentMemoryGitRunner = (args: string[], cwd: string) => Promise<{ stdout: string; exitCode: number }>;

async function listGitDirtyFileNames(memoryDir: string, cwd: string, runGit: AgentMemoryGitRunner): Promise<Set<string>> {
  const relDir = path.relative(cwd, memoryDir) || ".";
  const names = new Set<string>();
  const collect = (stdout: string) => {
    for (const line of stdout.split("\n")) {
      const trimmed = line.trim();
      if (trimmed) names.add(path.basename(trimmed));
    }
  };

  // No commits at all yet is a legitimate (if rare) state for a fresh repo —
  // `git diff ... HEAD` has nothing to diff against in that case, so every
  // existing file is necessarily untracked, which the ls-files call below
  // already covers.
  const headCheck = await runGit(["rev-parse", "--verify", "HEAD"], cwd);
  if (headCheck.exitCode === 0) {
    const diffResult = await runGit(["diff", "--name-only", "HEAD", "--", relDir], cwd);
    if (diffResult.exitCode !== 0) {
      throw new Error(`git diff failed while scoping the agent-memory drift guard to locally-changed files: ${diffResult.stdout}`);
    }
    collect(diffResult.stdout);
  }

  const untrackedResult = await runGit(["ls-files", "--others", "--exclude-standard", "--", relDir], cwd);
  if (untrackedResult.exitCode !== 0) {
    throw new Error(`git ls-files failed while scoping the agent-memory drift guard to locally-changed files: ${untrackedResult.stdout}`);
  }
  collect(untrackedResult.stdout);

  return names;
}

export interface AgentMemoryWorkingTreeDriftResult extends AgentMemoryDriftResult {
  /** Findings that were real (disk ≠ database) but excluded because the file is clean in git — almost always another checkout's shared-database write this one has not pulled yet, not a hand-edit. */
  ignoredAsUnsynced: AgentMemoryDriftFinding[];
}

export async function findAgentMemoryDriftInWorkingTree(
  memoryDir: string,
  cwd: string,
  fetchers: AgentMemoryDriftFetchers,
  runGit: AgentMemoryGitRunner,
): Promise<AgentMemoryWorkingTreeDriftResult> {
  const full = await findAgentMemoryDrift(memoryDir, fetchers);
  const dirtyNames = await listGitDirtyFileNames(memoryDir, cwd, runGit);
  const findings = full.findings.filter((finding) => dirtyNames.has(finding.fileName));
  const ignoredAsUnsynced = full.findings.filter((finding) => !dirtyNames.has(finding.fileName));
  return { findings, filesExpected: full.filesExpected, ignoredAsUnsynced };
}

export async function findAgentMemoryDrift(
  memoryDir: string,
  fetchers: AgentMemoryDriftFetchers,
): Promise<AgentMemoryDriftResult> {
  const findings: AgentMemoryDriftFinding[] = [];
  const topicSlugs = await fetchers.listTopicSlugs();
  const expectedFileNames = new Set<string>([
    AGENT_MEMORY_INDEX_FILE_NAME,
    ...topicSlugs.map((slug) => `${slug}.md`),
  ]);

  const [expectedIndexContent, onDiskIndexContent] = await Promise.all([
    fetchers.fetchMemoryIndexEntries().then(formatMemoryIndex),
    readFileIfExists(path.join(memoryDir, AGENT_MEMORY_INDEX_FILE_NAME)),
  ]);
  if (onDiskIndexContent === null) {
    findings.push({ fileName: AGENT_MEMORY_INDEX_FILE_NAME, topicSlug: null, reason: "missing-from-disk" });
  } else if (onDiskIndexContent !== expectedIndexContent) {
    findings.push({ fileName: AGENT_MEMORY_INDEX_FILE_NAME, topicSlug: null, reason: "content-mismatch" });
  }

  await Promise.all(
    topicSlugs.map(async (topicSlug) => {
      const fileName = `${topicSlug}.md`;
      const [expected, onDisk] = await Promise.all([
        fetchers.fetchTopicBlocks(topicSlug).then(formatTopicFile),
        readFileIfExists(path.join(memoryDir, fileName)),
      ]);
      if (onDisk === null) {
        findings.push({ fileName, topicSlug, reason: "missing-from-disk" });
      } else if (onDisk !== expected) {
        findings.push({ fileName, topicSlug, reason: "content-mismatch" });
      }
    }),
  );

  const onDiskMarkdownFiles = await listMarkdownFiles(memoryDir);
  for (const fileName of onDiskMarkdownFiles) {
    if (!expectedFileNames.has(fileName)) {
      findings.push({ fileName, topicSlug: fileName.slice(0, -3), reason: "orphaned-on-disk" });
    }
  }

  findings.sort((a, b) => a.fileName.localeCompare(b.fileName));
  return { findings, filesExpected: expectedFileNames.size };
}
