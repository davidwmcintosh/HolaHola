/**
 * Shared sandbox helper for the buildHistoryUrl mutation guards
 * (test-filter-url-mutation.ts and test-filter-url-mutation-stale-sentinel.ts).
 *
 * Both guards need to temporarily corrupt the buildHistoryUrl implementation
 * to prove the filter-button test suite catches the regression. Earlier
 * versions mutated the real, shared `client/src/lib/absence-history-panel-logic.ts`
 * file on disk in place. That is unsafe: any OTHER process reading/compiling
 * that file while the mutation is applied -- a concurrently-running CI batch,
 * another `npm test` invocation, or a second `gate` run sharing this same
 * working tree -- observes the corrupted content and fails with the
 * confusing, unrelated-looking "fetch URL construction" symptom. That
 * cross-process file race was the root cause of the intermittent flake in
 * Task #1519 (reproduced directly: a second process reading the file during
 * the mutation window reliably fails the same 3 assertions the real flake
 * reported).
 *
 * The fix: never touch the real files. Copy the minimal set this test needs
 * into a private temp directory, mutate ONLY the copy, and run the test
 * suite against that copy. No other process can ever observe the mutation,
 * regardless of what else is running concurrently on the same checkout.
 */

import { cpSync, mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

export interface FilterUrlMutationSandbox {
  /** Root of the private temp directory. Remove with `cleanup()` when done. */
  root: string;
  /** Sandbox copy of client/src/lib/absence-history-panel-logic.ts */
  logicFile: string;
  /** Sandbox copy of client/src/lib/absence-filter-storage.ts */
  storageFile: string;
  /** Sandbox copy of client/src/components/absence-history-panel-filters.test.ts */
  testFile: string;
  /** Deletes the entire sandbox directory. Safe to call more than once. */
  cleanup: () => void;
}

/** Canonical real-repo path, used for display in error messages only. */
export const CANONICAL_LOGIC_FILE_PATH =
  "client/src/lib/absence-history-panel-logic.ts";

const REAL_LOGIC_FILE = resolve(CANONICAL_LOGIC_FILE_PATH);
const REAL_STORAGE_FILE = resolve("client/src/lib/absence-filter-storage.ts");
const REAL_TEST_FILE = resolve(
  "client/src/components/absence-history-panel-filters.test.ts",
);

/**
 * Creates a private copy of the logic file, its storage-helper sibling, and
 * the test file, laid out with the same relative directory nesting
 * (lib/ and components/ as siblings) so the test file's `../lib/...`
 * imports keep resolving inside the sandbox exactly as they do in the repo.
 */
export function createFilterUrlMutationSandbox(
  prefix = "filter-url-mutation-",
): FilterUrlMutationSandbox {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const libDir = join(root, "lib");
  const componentsDir = join(root, "components");
  mkdirSync(libDir, { recursive: true });
  mkdirSync(componentsDir, { recursive: true });

  const logicFile = join(libDir, "absence-history-panel-logic.ts");
  const storageFile = join(libDir, "absence-filter-storage.ts");
  const testFile = join(componentsDir, "absence-history-panel-filters.test.ts");

  cpSync(REAL_LOGIC_FILE, logicFile);
  cpSync(REAL_STORAGE_FILE, storageFile);
  cpSync(REAL_TEST_FILE, testFile);

  return {
    root,
    logicFile,
    storageFile,
    testFile,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
