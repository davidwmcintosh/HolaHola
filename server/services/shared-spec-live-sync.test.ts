import assert from "node:assert/strict";
import test from "node:test";
import { execFile as callbackExecFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { hashSharedSpecMarkdown } from "./shared-spec-core";
import { GitWorkingTreeLiveSyncProvider, type LiveInstructionSyncTarget } from "./shared-spec-live-sync";

const execFile = promisify(callbackExecFile);

async function makeRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "shared-spec-live-sync-"));
  await execFile("git", ["init", "-q"], { cwd: dir });
  await execFile("git", ["config", "user.email", "test@example.test"], { cwd: dir });
  await execFile("git", ["config", "user.name", "Test"], { cwd: dir });
  await writeFile(join(dir, "README.md"), "seed\n", "utf8");
  await execFile("git", ["add", "README.md"], { cwd: dir });
  await execFile("git", ["commit", "-q", "-m", "seed"], { cwd: dir });
  return dir;
}

const commitCount = async (repo: string): Promise<number> => {
  const { stdout } = await execFile("git", ["log", "--oneline"], { cwd: repo });
  return stdout.trim().split("\n").filter(Boolean).length;
};
const changedPaths = async (repo: string): Promise<string[]> => {
  const { stdout } = await execFile("git", ["show", "--name-only", "--pretty=format:", "HEAD"], { cwd: repo });
  return stdout.trim().split("\n").filter(Boolean);
};
const subject = async (repo: string): Promise<string> => {
  const { stdout } = await execFile("git", ["log", "-1", "--pretty=%s"], { cwd: repo });
  return stdout.trim();
};

const target = (overrides: Partial<LiveInstructionSyncTarget> = {}): LiveInstructionSyncTarget => {
  const markdown = overrides.markdown ?? "# Hello\n";
  return {
    documentId: "doc-1", title: "Test Doc", repository: "hola/hola",
    gitPath: "docs/superpowers/specs/live.md", markdown, contentHash: hashSharedSpecMarkdown(markdown),
    revisionOrdinal: 1, knownRevisionContentHashes: [hashSharedSpecMarkdown(markdown)], ...overrides,
  };
};

test("sync writes and commits the markdown scoped to exactly one path", async () => {
  const repo = await makeRepo();
  const provider = new GitWorkingTreeLiveSyncProvider({ rootDir: repo });
  const result = await provider.sync(target());
  assert.equal(result.state, "synced");
  assert.equal(result.state === "synced" && result.commitCreated, true);
  assert.match(result.state === "synced" ? result.commitSha ?? "" : "", /^[0-9a-f]{40}$/);
  assert.equal(await readFile(join(repo, "docs/superpowers/specs/live.md"), "utf8"), "# Hello\n");
  assert.deepEqual(await changedPaths(repo), ["docs/superpowers/specs/live.md"]);
  assert.equal(await subject(repo), "shared-spec: approve Test Doc rev 1");
});

test("a second sync with identical content is idempotent and creates no new commit", async () => {
  const repo = await makeRepo();
  const provider = new GitWorkingTreeLiveSyncProvider({ rootDir: repo });
  await provider.sync(target());
  const before = await commitCount(repo);
  const result = await provider.sync(target());
  assert.equal(result.state, "synced");
  assert.equal(result.state === "synced" && result.commitCreated, false);
  assert.equal(await commitCount(repo), before);
  assert.equal(await readFile(join(repo, "docs/superpowers/specs/live.md"), "utf8"), "# Hello\n");
});

test("refuses to overwrite a path that already has an unrelated uncommitted change", async () => {
  const repo = await makeRepo();
  await mkdir(join(repo, "docs/superpowers/specs"), { recursive: true });
  await writeFile(join(repo, "docs/superpowers/specs/live.md"), "hand-edited, not yet committed\n", "utf8");
  const provider = new GitWorkingTreeLiveSyncProvider({ rootDir: repo });
  const result = await provider.sync(target({ markdown: "# New\n" }));
  assert.equal(result.state, "stale");
  assert.match(result.state === "stale" ? result.reason : "", /uncommitted change/);
  assert.equal(await readFile(join(repo, "docs/superpowers/specs/live.md"), "utf8"), "hand-edited, not yet committed\n");
});

test("refuses an unsafe git path without touching disk", async () => {
  const repo = await makeRepo();
  const provider = new GitWorkingTreeLiveSyncProvider({ rootDir: repo });
  const result = await provider.sync(target({ gitPath: "/etc/passwd" }));
  assert.equal(result.state, "stale");
  assert.match(result.state === "stale" ? result.reason : "", /unsafe/i);
  assert.equal(await commitCount(repo), 1);
});

test("refuses a target whose repository does not match the configured expectedRepository", async () => {
  const repo = await makeRepo();
  const provider = new GitWorkingTreeLiveSyncProvider({ rootDir: repo, expectedRepository: "hola/hola" });
  const result = await provider.sync(target({ repository: "someone-else/other" }));
  assert.equal(result.state, "stale");
  assert.match(result.state === "stale" ? result.reason : "", /does not match this checkout/);
  assert.equal(await commitCount(repo), 1);
});

test("reports staleness rather than false success when the caller's contentHash does not match its own markdown", async () => {
  const repo = await makeRepo();
  const provider = new GitWorkingTreeLiveSyncProvider({ rootDir: repo });
  const result = await provider.sync(target({ markdown: "# Real\n", contentHash: hashSharedSpecMarkdown("# Different\n") }));
  assert.equal(result.state, "stale");
  assert.match(result.state === "stale" ? result.reason : "", /does not match the approved revision hash/);
});

test("two concurrent syncs to the same path are serialized, not interleaved", async () => {
  const repo = await makeRepo();
  const provider = new GitWorkingTreeLiveSyncProvider({ rootDir: repo });
  // Both revisions belong to the same document's history, so a realistic caller
  // (shared-spec-routes.ts) would supply both their hashes in every call --
  // whichever one lands on disk first must not make the other look like an
  // unrecorded, out-of-band edit.
  const knownRevisionContentHashes = [hashSharedSpecMarkdown("# First\n"), hashSharedSpecMarkdown("# Second\n")];
  const [first, second] = await Promise.all([
    provider.sync(target({ markdown: "# First\n", knownRevisionContentHashes })),
    provider.sync(target({ markdown: "# Second\n", knownRevisionContentHashes })),
  ]);
  assert.equal(first.state, "synced");
  assert.equal(second.state, "synced");
  assert.equal(await commitCount(repo), 3);
  const finalContent = await readFile(join(repo, "docs/superpowers/specs/live.md"), "utf8");
  assert.ok(finalContent === "# First\n" || finalContent === "# Second\n");
});

test("refuses to overwrite a path whose committed content is not a revision shared-spec has ever recorded for this document", async () => {
  const repo = await makeRepo();
  await mkdir(join(repo, "docs/superpowers/specs"), { recursive: true });
  await writeFile(join(repo, "docs/superpowers/specs/live.md"), "# Out of band\n", "utf8");
  await execFile("git", ["add", "docs/superpowers/specs/live.md"], { cwd: repo });
  await execFile("git", ["commit", "-q", "-m", "ordinary edit, never went through shared-spec"], { cwd: repo });
  const provider = new GitWorkingTreeLiveSyncProvider({ rootDir: repo });
  const commitsBefore = await commitCount(repo);

  const result = await provider.sync(target({ markdown: "# Approved rev 2\n" }));

  assert.equal(result.state, "stale");
  assert.match(result.state === "stale" ? result.reason : "", /does not match any revision shared-spec has recorded/);
  assert.equal(await commitCount(repo), commitsBefore, "refusing must not create a commit");
  assert.equal(await readFile(join(repo, "docs/superpowers/specs/live.md"), "utf8"), "# Out of band\n", "the out-of-band content must survive untouched");
});

test("allows syncing when the on-disk content matches an older revision this document already has on record", async () => {
  const repo = await makeRepo();
  const oldMarkdown = "# Revision one\n";
  await mkdir(join(repo, "docs/superpowers/specs"), { recursive: true });
  await writeFile(join(repo, "docs/superpowers/specs/live.md"), oldMarkdown, "utf8");
  await execFile("git", ["add", "docs/superpowers/specs/live.md"], { cwd: repo });
  await execFile("git", ["commit", "-q", "-m", "an older approved revision, or a manual revert to it"], { cwd: repo });
  const provider = new GitWorkingTreeLiveSyncProvider({ rootDir: repo });

  const newMarkdown = "# Revision two\n";
  const result = await provider.sync(target({
    markdown: newMarkdown,
    knownRevisionContentHashes: [hashSharedSpecMarkdown(oldMarkdown), hashSharedSpecMarkdown(newMarkdown)],
  }));

  assert.equal(result.state, "synced");
  assert.equal(await readFile(join(repo, "docs/superpowers/specs/live.md"), "utf8"), newMarkdown);
});
