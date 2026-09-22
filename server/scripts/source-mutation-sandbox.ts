/**
 * Shared sandbox helpers for CI "mutation guard" scripts.
 *
 * A mutation guard proves a test suite has teeth by temporarily corrupting a
 * real implementation file, confirming the guarded test suite fails, then
 * restoring it. Doing this in place on the real, shared source file is
 * unsafe: any OTHER process reading, importing, or compiling that file
 * during the mutation window -- a concurrently-running CI batch, a manual
 * test invocation, or another `gate`/branch run sharing this working tree --
 * observes the corrupted content and fails with a confusing, unrelated-
 * looking symptom. `server/routes.ts` is especially high-risk: it is
 * imported by the running application itself, so a concurrent reader
 * mid-mutation is not limited to causing test flakes. This was the
 * confirmed root cause of an intermittent flake fixed for buildHistoryUrl
 * (see filter-url-mutation-fixture.ts, the original single-purpose version
 * of this pattern) and is generalized here for guards whose target file is
 * IMPORTED (not just read as text) by the test it feeds, and whose target
 * may be deeply nested with many sibling dependencies.
 *
 * Two helpers, for two shapes of mutation guard:
 *
 *   - createTextSnapshotSandbox(): copies one or more files into a temp
 *     directory, preserving their repo-relative paths. Use this when the
 *     downstream consumer only reads the target's TEXT (e.g. via
 *     `fs.readFileSync(path.resolve(process.cwd(), '<relative path>'))`)
 *     and never imports/executes it as a module. Run the consumer with its
 *     `cwd` pointed at the returned sandbox `root` so those reads resolve
 *     into the sandbox instead of the real, shared file.
 *
 *   - createShadowTreeSandbox(): builds a full repo-root-shaped directory
 *     mirroring the real tree, where every file/directory NOT on the path
 *     to one of the given targets is a SYMLINK back to the real repo entry,
 *     and the targets themselves (plus the real directories leading to
 *     them) are independent, mutable copies. This lets a downstream script
 *     IMPORT a mutated copy of a deeply-nested file through an ordinary
 *     relative import, without needing to enumerate or copy its full
 *     transitive dependency graph -- every sibling module Node resolves
 *     along the way is a symlink that leads straight back to the real,
 *     read-only repo file, so nothing else can ever observe a half-mutated
 *     copy. Keep the spawned process's `cwd` at the REAL repo root (not the
 *     sandbox) so `@shared/*`-style tsconfig path-alias resolution keeps
 *     working -- alias resolution walks up from `cwd` to find
 *     `tsconfig.json`, not from the importing file's own location (see the
 *     `tsx-path-alias-resolution-cwd` memory note). Ordinary relative
 *     imports (`../foo`, `./bar`) are unaffected by `cwd` -- they always
 *     resolve against the importing module's own real path, which is what
 *     makes the symlink farm work at all.
 */

import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, symlinkSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, sep } from "path";

/** Real repo root, captured once at module load (these scripts always run via `npx tsx` from repo root). */
export const REPO_ROOT = resolve(process.cwd());

export interface TextSnapshotSandbox {
  /** Root of the private temp directory. Remove with `cleanup()` when done. */
  root: string;
  /** Sandbox absolute path for each requested repo-relative path, keyed by that relative path. */
  files: Record<string, string>;
  /** Deletes the entire sandbox directory. Safe to call more than once. */
  cleanup: () => void;
}

/**
 * Copies one or more repo-relative files into a private temp directory,
 * preserving their relative nesting. Use this for a mutation guard whose
 * downstream consumer only reads the target as TEXT and never imports it as
 * a module.
 */
export function createTextSnapshotSandbox(
  relativeFilePaths: string[],
  prefix = "source-mutation-text-",
): TextSnapshotSandbox {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const files: Record<string, string> = {};
  for (const relPath of relativeFilePaths) {
    const dest = join(root, relPath);
    mkdirSync(resolve(dest, ".."), { recursive: true });
    cpSync(resolve(REPO_ROOT, relPath), dest);
    files[relPath] = dest;
  }
  return { root, files, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

export interface ShadowTreeSandbox {
  /** Root of the private temp directory, shaped like the repo root. Remove with `cleanup()`. */
  root: string;
  /** Sandbox absolute path for each requested repo-relative target, keyed by that relative path. */
  files: Record<string, string>;
  /** Deletes the entire sandbox directory. Safe to call more than once. */
  cleanup: () => void;
}

/**
 * Builds a "shadow tree" sandbox: a temp directory shaped like the repo
 * root, where every file/directory NOT on the path to one of
 * `targetRelativePaths` is a symlink back to the real repo entry, and the
 * targets themselves (plus the real directories leading to them) are
 * independent copies, free to mutate without any other process ever
 * observing it.
 */
export function createShadowTreeSandbox(
  targetRelativePaths: string[],
  prefix = "source-mutation-shadow-",
): ShadowTreeSandbox {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const targetSegments = targetRelativePaths.map((p) => p.split(sep).filter(Boolean));

  function buildLevel(realDir: string, sandboxDir: string, segmentsHere: string[][]): void {
    // Split the remaining path segments (from this level down) for every
    // target that passes through realDir into: names that ARE a target's
    // final component here ("leaves"), and names that lead further down
    // toward one or more targets ("intermediate").
    const intermediate = new Map<string, string[][]>();
    const leaves = new Set<string>();

    for (const segs of segmentsHere) {
      const [head, ...rest] = segs;
      if (rest.length === 0) {
        leaves.add(head);
      } else {
        const existing = intermediate.get(head);
        if (existing) existing.push(rest);
        else intermediate.set(head, [rest]);
      }
    }

    for (const entry of readdirSync(realDir)) {
      const realEntryPath = join(realDir, entry);
      const sandboxEntryPath = join(sandboxDir, entry);

      if (leaves.has(entry)) {
        // The mutation target itself: a real, independent, mutable copy.
        cpSync(realEntryPath, sandboxEntryPath);
        continue;
      }

      const nested = intermediate.get(entry);
      if (nested) {
        // An intermediate directory on the path to a target: real dir, recurse.
        mkdirSync(sandboxEntryPath);
        buildLevel(realEntryPath, sandboxEntryPath, nested);
        continue;
      }

      // Not on the path to any target -- symlink straight back to the real
      // entry so it (and everything under it) resolves exactly as it does
      // in the real repo. Nothing here is ever written to, so no other
      // process can ever observe a half-mutated copy through it.
      let isDir = false;
      try {
        isDir = statSync(realEntryPath).isDirectory();
      } catch {
        // Broken symlink or unreadable special file in the real tree --
        // still link it through; the type hint only matters on Windows.
      }
      symlinkSync(realEntryPath, sandboxEntryPath, isDir ? "dir" : "file");
    }
  }

  buildLevel(REPO_ROOT, root, targetSegments);

  const files: Record<string, string> = {};
  for (const relPath of targetRelativePaths) {
    files[relPath] = join(root, relPath);
  }

  return { root, files, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
