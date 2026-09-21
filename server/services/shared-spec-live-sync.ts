import { execFile as callbackExecFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { hashSharedSpecMarkdown } from "./shared-spec-core";

const execFile = promisify(callbackExecFile);

/**
 * The alternative to a GitHub PR for a document created with
 * liveInstructionDocument: true (see shared/schema.ts and
 * shared-spec-core.ts). Approving a revision on a flagged document writes
 * canonicalPath directly in this checkout and commits it, scoped to that one
 * path, instead of going through SpecPublicationProvider. Orchestrated from
 * shared-spec-routes.ts -- this module only knows how to converge one path
 * on disk with one approved revision; it never touches the shared-spec
 * domain or database itself.
 */
export interface LiveInstructionSyncTarget {
  readonly documentId: string;
  readonly title: string;
  readonly repository: string;
  readonly gitPath: string;
  readonly markdown: string;
  readonly contentHash: string;
  /** 1-based position of this revision in the document's history; used only for the commit message. */
  readonly revisionOrdinal: number;
}

export type LiveInstructionSyncResult =
  | { readonly state: "synced"; readonly commitCreated: boolean; readonly commitSha?: string }
  | { readonly state: "stale"; readonly reason: string };

export interface LiveInstructionDocumentSyncProvider {
  /** Idempotent: converges the working tree to `target` regardless of prior attempts. Never throws for an ordinary failure -- reports it in the result instead. */
  sync(target: LiveInstructionSyncTarget): Promise<LiveInstructionSyncResult>;
}

const isSafeRelativeGitPath = (gitPath: string): boolean =>
  gitPath.length > 0 && !gitPath.startsWith("/") && !gitPath.includes("\0")
  && !gitPath.split("/").some(segment => segment === "" || segment === "." || segment === "..");

export interface GitWorkingTreeLiveSyncOptions {
  /** Defaults to process.cwd(), matching source-control-service.ts's convention -- correct as long as the server's cwd is the repo root (true under scripts/start-application.sh). */
  readonly rootDir?: string;
  /**
   * Defence in depth only: shared-spec's own `repository` field on the
   * document is not otherwise cross-checked against the checkout a running
   * host actually writes to. When set, a target whose repository does not
   * match (case-insensitively) is refused before anything touches disk.
   */
  readonly expectedRepository?: string;
}

/**
 * Writes an approved live-instruction-document revision straight into this
 * checkout's working tree and commits it, scoped to exactly one path. Never
 * `git add -A`; a commit with an explicit pathspec both stages and commits
 * only that path, so it cannot absorb unrelated staged or dirty files
 * elsewhere in the tree.
 *
 * Concurrency: two syncs for the *same* gitPath are serialized in-process
 * (see withPathLock) so an approve and a manual resync racing each other
 * cannot interleave their check-write-commit steps. Different paths never
 * block each other.
 */
export class GitWorkingTreeLiveSyncProvider implements LiveInstructionDocumentSyncProvider {
  private readonly rootDir: string;
  private readonly expectedRepository?: string;
  private readonly locks = new Map<string, Promise<unknown>>();

  constructor(options: GitWorkingTreeLiveSyncOptions = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.expectedRepository = options.expectedRepository?.trim() || undefined;
  }

  async sync(target: LiveInstructionSyncTarget): Promise<LiveInstructionSyncResult> {
    return this.withPathLock(target.gitPath, () => this.syncExclusive(target));
  }

  private async syncExclusive(target: LiveInstructionSyncTarget): Promise<LiveInstructionSyncResult> {
    if (this.expectedRepository && target.repository.trim().toLowerCase() !== this.expectedRepository.toLowerCase()) {
      return { state: "stale", reason: `Document repository "${target.repository}" does not match this checkout's configured repository` };
    }
    if (!isSafeRelativeGitPath(target.gitPath)) {
      return { state: "stale", reason: `Refusing an unsafe git path: ${target.gitPath}` };
    }

    const status = await this.runGit(["status", "--porcelain", "--", target.gitPath]);
    if (status.exitCode !== 0) {
      return { state: "stale", reason: `git status failed: ${firstLine(status.stderr) || firstLine(status.stdout)}` };
    }
    if (status.stdout.trim() !== "") {
      return { state: "stale", reason: `${target.gitPath} already has an uncommitted change in this checkout; refusing to overwrite it` };
    }

    const absolutePath = resolve(this.rootDir, target.gitPath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, target.markdown, "utf8");

    // `git commit -- <path>` alone fails with "pathspec did not match any
    // file(s) known to git" for a path git has never seen before (a brand
    // new document's first sync) -- its partial-commit pathspec matching
    // only covers paths already known to the index/HEAD. `git add -- <path>`
    // first stages exactly that path (new or modified) without touching any
    // other staged content, then the pathspec-scoped commit only commits
    // that one path regardless of what else might already be staged.
    const add = await this.runGit(["add", "--", target.gitPath]);
    if (add.exitCode !== 0) {
      return { state: "stale", reason: `git add failed: ${firstLine(add.stderr) || firstLine(add.stdout)}` };
    }
    const commitMessage = `shared-spec: approve ${target.title} rev ${target.revisionOrdinal}`;
    const commit = await this.runGit(["commit", "-m", commitMessage, "--", target.gitPath]);
    if (commit.exitCode !== 0 && !/nothing to commit/i.test(`${commit.stdout}${commit.stderr}`)) {
      return { state: "stale", reason: `git commit failed: ${firstLine(commit.stderr) || firstLine(commit.stdout)}` };
    }

    const writtenBytes = await readFile(absolutePath, "utf8");
    if (hashSharedSpecMarkdown(writtenBytes) !== target.contentHash) {
      return { state: "stale", reason: "Working tree content does not match the approved revision hash after commit" };
    }
    const head = await this.runGit(["rev-parse", "HEAD"]);
    return { state: "synced", commitCreated: commit.exitCode === 0, commitSha: head.exitCode === 0 ? head.stdout.trim() : undefined };
  }

  /** Chains work for the same key so overlapping calls never interleave; distinct keys never wait on each other. */
  private async withPathLock<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    const settled = previous.catch(() => undefined);
    const current = settled.then(work);
    this.locks.set(key, current.catch(() => undefined));
    return current;
  }

  private async runGit(args: readonly string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    try {
      const { stdout, stderr } = await execFile("git", args as string[], { cwd: this.rootDir });
      return { exitCode: 0, stdout, stderr };
    } catch (error: any) {
      return {
        exitCode: typeof error?.code === "number" ? error.code : 1,
        stdout: typeof error?.stdout === "string" ? error.stdout : "",
        stderr: typeof error?.stderr === "string" ? error.stderr : String(error?.message ?? error),
      };
    }
  }
}

const firstLine = (value: string): string => value.split("\n").find(line => line.trim().length > 0)?.trim() ?? "";
