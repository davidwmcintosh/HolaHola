/**
 * CI guard for task 1655: within server/, SharedSpecCore's
 * approveReview()/rejectReview() may be called directly from exactly one
 * production file -- server/services/shared-spec-review-decision.ts's
 * decideSharedSpecReviewWithEffects(). Every other production entry point
 * that decides a review (the HTTP route in shared-spec-routes.ts, Alden's
 * in-process decide_shared_spec_review tool in alden-shared-spec-review.ts,
 * and any future caller) must go through that wrapper instead, or it
 * silently skips the review_decided notification and, for a
 * liveInstructionDocument, leaves the on-disk working-tree file stale even
 * though the document row now reads "approved".
 *
 * This is not hypothetical: an earlier version of Alden's decide tool called
 * SharedSpecCore.approveReview() directly, producing exactly that drift in
 * production-shared data (an md5 mismatch between the approved revision's
 * markdown and the on-disk file, plus a stale git log) before it was fixed by
 * extracting decideSharedSpecReviewWithEffects. See that module's own doc
 * comment and .agents/memory/shared-spec-live-instruction-doc-drift.md's
 * 2026-09-29 refinement for the full incident. This script exists so a
 * future refactor cannot silently reintroduce the same gap.
 *
 * `*.test.ts` files are exempt: shared-spec-core.test.ts and
 * shared-spec-routes.test.ts legitimately call core.approveReview/
 * rejectReview directly, either to unit-test the domain layer itself or to
 * fixture an "already decided" review ahead of an unrelated assertion.
 * Neither is a production entry point a real reviewer's decision can reach,
 * so neither is the regression this guard exists to catch.
 *
 * A plain per-line text scan (matching the style of
 * test-cli-entrypoint-guard-pattern.ts), not a full AST walk: the pattern
 * being guarded against is one specific member-call shape
 * (`.approveReview(` / `.rejectReview(`), not a broad semantic property.
 *
 * Usage:
 *   npx tsx server/scripts/test-shared-spec-review-decision-bypass-guard.ts
 *   npx tsx server/scripts/test-shared-spec-review-decision-bypass-guard.ts --self-check
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SERVER_ROOT = path.join(REPO_ROOT, "server");

const IS_SELF_CHECK = process.argv.includes("--self-check");

// Matches a member call to either decision method regardless of the
// receiver expression (`core.approveReview(`, `this.core.rejectReview(`,
// `deps.core.approveReview(`, ...) -- deliberately name-based, like the
// image-upload and CLI-entrypoint scanners this mirrors, not a type-resolved
// AST check.
const CALL_PATTERN = /\.(approveReview|rejectReview)\(/;

/** The one production file allowed to call these methods directly. server/-relative, POSIX-separated. */
const ALLOWED_CALLER = "services/shared-spec-review-decision.ts";

/**
 * This guard's own source: its doc comment discusses the call pattern in
 * prose (e.g. "SharedSpecCore.approveReview() directly") and its self-check
 * builds fixture file contents containing the literal call shape as JS
 * string literals -- both of which the plain text scan below would
 * otherwise flag as if they were real call sites. Computed from __filename
 * rather than hardcoded so renaming this file can never leave a stale
 * exemption path behind.
 */
const SELF_RELATIVE_PATH = path.relative(SERVER_ROOT, __filename).split(path.sep).join("/");

let passed = 0;
let failed = 0;
function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  \u2713 ${label}`);
    passed++;
  } else {
    console.error(`  \u2717 FAIL: ${label}${detail ? `\n    ${detail}` : ""}`);
    failed++;
  }
}

function listTsFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTsFilesRecursive(full));
    else if (entry.isFile() && entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

export interface ReviewDecisionBypassViolation {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

/**
 * Scans `root` for a direct `.approveReview(`/`.rejectReview(` call site
 * outside of `exemptFiles` (root-relative, POSIX paths) and outside any
 * `*.test.ts` file.
 */
export function scanForReviewDecisionBypass(root: string, exemptFiles: readonly string[]): ReviewDecisionBypassViolation[] {
  const exempt = new Set(exemptFiles);
  const violations: ReviewDecisionBypassViolation[] = [];
  for (const filePath of listTsFilesRecursive(root)) {
    const relative = path.relative(root, filePath).split(path.sep).join("/");
    if (exempt.has(relative) || relative.endsWith(".test.ts")) continue;
    const lines = fs.readFileSync(filePath, "utf8").split("\n");
    lines.forEach((lineText, index) => {
      if (CALL_PATTERN.test(lineText)) violations.push({ file: relative, line: index + 1, text: lineText.trim() });
    });
  }
  return violations;
}

function runRealCheck(): void {
  const violations = scanForReviewDecisionBypass(SERVER_ROOT, [ALLOWED_CALLER, SELF_RELATIVE_PATH]);
  assert(
    violations.length === 0,
    "no production file outside shared-spec-review-decision.ts calls core.approveReview/rejectReview directly",
    violations.map(v => `${v.file}:${v.line}: ${v.text}`).join("\n    "),
  );

  const allowedFileAbs = path.join(SERVER_ROOT, ALLOWED_CALLER);
  assert(fs.existsSync(allowedFileAbs), `${ALLOWED_CALLER} still exists at the expected path (stale-allowlist guard)`);
  const allowedSource = fs.existsSync(allowedFileAbs) ? fs.readFileSync(allowedFileAbs, "utf8") : "";
  const approveCalls = (allowedSource.match(/\.approveReview\(/g) ?? []).length;
  const rejectCalls = (allowedSource.match(/\.rejectReview\(/g) ?? []).length;
  assert(approveCalls === 1, "shared-spec-review-decision.ts still calls core.approveReview exactly once", `found ${approveCalls}`);
  assert(rejectCalls === 1, "shared-spec-review-decision.ts still calls core.rejectReview exactly once", `found ${rejectCalls}`);
}

function runSelfCheck(): void {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "shared-spec-review-decision-bypass-"));
  try {
    fs.mkdirSync(path.join(sandbox, "services"), { recursive: true });
    fs.mkdirSync(path.join(sandbox, "routes"), { recursive: true });

    // The legitimate wrapper: its own direct calls must never be flagged.
    fs.writeFileSync(
      path.join(sandbox, "services/shared-spec-review-decision.ts"),
      [
        "export async function decideSharedSpecReviewWithEffects(deps, actor, input) {",
        "  const review = await (input.decision === \"approve\"",
        "    ? deps.core.approveReview(actor, input)",
        "    : deps.core.rejectReview(actor, input));",
        "  return review;",
        "}",
      ].join("\n"),
    );

    // A hypothetical new production entry point that bypasses the wrapper --
    // exactly the regression this guard exists to catch.
    fs.writeFileSync(
      path.join(sandbox, "routes/future-entrypoint.ts"),
      [
        "export async function decideReviewTheOldWayAgain(core, actor, reviewId) {",
        "  return core.approveReview(actor, { reviewId, idempotencyKey: \"x\" });",
        "}",
      ].join("\n"),
    );

    // A legitimate domain-level test file: exempt even though it calls the
    // method directly.
    fs.writeFileSync(
      path.join(sandbox, "services/shared-spec-core.test.ts"),
      "test(\"approve\", async () => { await core.approveReview(reviewer, { reviewId: review.id, idempotencyKey: \"x\" }); });",
    );

    const violations = scanForReviewDecisionBypass(sandbox, ["services/shared-spec-review-decision.ts"]);
    assert(
      violations.length === 1 && violations[0].file === "routes/future-entrypoint.ts",
      "self-check: a new production entry point calling core.approveReview directly is flagged, while the wrapper and *.test.ts fixtures are not",
      JSON.stringify(violations),
    );

    // Prove the *.test.ts exemption is load-bearing, not accidentally
    // always-true: renaming that same fixture out of the *.test.ts shape
    // must make its identical call site visible to the scan.
    fs.renameSync(
      path.join(sandbox, "services/shared-spec-core.test.ts"),
      path.join(sandbox, "services/shared-spec-core-not-a-test.ts"),
    );
    const violationsAfterRename = scanForReviewDecisionBypass(sandbox, ["services/shared-spec-review-decision.ts"]);
    assert(
      violationsAfterRename.some(v => v.file === "services/shared-spec-core-not-a-test.ts"),
      "self-check: the *.test.ts exemption is load-bearing -- the same call site is flagged once renamed out of test-file shape",
      JSON.stringify(violationsAfterRename),
    );
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

try {
  if (IS_SELF_CHECK) runSelfCheck();
  else runRealCheck();
} catch (error: any) {
  console.error(`Unhandled error: ${error?.message ?? error}`);
  process.exit(1);
}

const total = passed + failed;
if (failed === 0) {
  console.log(`\n\u2713 All ${total} checks passed.`);
  process.exit(0);
} else {
  console.error(`\n\u2717 ${failed} of ${total} checks failed.`);
  process.exit(1);
}
