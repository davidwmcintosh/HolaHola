#!/usr/bin/env npx tsx
/**
 * check-live-instruction-document-drift.ts (task 1617)
 *
 * Task 1612 added a guard that refuses to approve/resync a document created
 * with liveInstructionDocument: true (docs/shared-agent-instructions.md,
 * docs/coordination-clients.md) when its git-tracked file has drifted out
 * of shared-spec's recorded revision history (see matchesKnownRevision() in
 * server/services/shared-spec-live-sync.ts), plus
 * server/scripts/reconcile-live-instruction-document-drift.ts to recapture
 * drifted content as a fresh approved revision. Both are reactive: drift is
 * only discovered at the moment someone actually attempts a real
 * review-and-approve cycle, which can be long after the drift happened --
 * task 1612 itself found 11 undetected drifting commits over 4 days on
 * coordination-clients.md alone. This script is the proactive counterpart:
 * run it periodically or in CI, and it reports drift up front, before
 * anyone hits a blocked review.
 *
 * See server/services/live-instruction-document-drift-guard.ts for the
 * comparison algorithm (shared with the reactive guard via
 * matchesKnownRevision()), and
 * server/scripts/reconcile-live-instruction-document-drift.ts for the fix a
 * real finding here should point a maintainer at.
 *
 * Normal mode:
 *   npx tsx server/scripts/check-live-instruction-document-drift.ts
 *     Queries shared-spec for every document currently flagged
 *     liveInstructionDocument: true (the scope is read live from the
 *     database, not hardcoded here -- see seed-live-instruction-
 *     documents.ts for what is seeded there today), reads each one's real
 *     git-tracked file in this checkout, and reports any whose current
 *     content matches none of the revisions shared-spec has ever recorded
 *     for that document, or whose file is missing entirely. Never writes to
 *     git or to shared-spec.
 *
 *     Replit-only (see run-validation-suite.sh's registration comment for
 *     why): this needs a real NEON_SHARED_DATABASE_URL with the live-
 *     instruction documents actually seeded (seed-live-instruction-
 *     documents.ts) and this checkout's real git-tracked files. GitHub
 *     Actions' disposable, schema-only job-local database never has these
 *     documents seeded, so it could never observe a real drift there --
 *     keep it out of run-ci-test-steps.mjs.
 *
 * Self-check mode:
 *   npx tsx server/scripts/check-live-instruction-document-drift.ts --self-check
 *     Hermetic: proves findLiveInstructionDocumentDrift() (a) accepts
 *     content that matches a historical, non-current recorded revision,
 *     (b) flags a genuine content mismatch as content-drift, (c) flags a
 *     missing file distinctly as missing-file, (d) isolates findings
 *     correctly across multiple candidates, and (e) reports a clean pass
 *     for zero candidates without ever invoking the git reader. Never
 *     touches the database or real git files.
 *
 * Exit codes:
 *   0 -- no in-scope document has drifted (self-check: all assertions passed)
 *   1 -- at least one in-scope document has drifted (self-check: an assertion failed)
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { closeDbConnections, getSharedDb } from "../db";
import { hashSharedSpecMarkdown, SharedSpecCore } from "../services/shared-spec-core";
import { PostgresSharedSpecRepository } from "../services/shared-spec-postgres-repository";
import {
  findLiveInstructionDocumentDrift,
  type LiveInstructionDocumentDriftCandidate,
  type LiveInstructionDocumentDriftFinding,
  type ReadLiveInstructionGitFile,
} from "../services/live-instruction-document-drift-guard";
import { isDirectCliInvocation } from "./lib/cli-entrypoint";

const SELF_CHECK = process.argv.includes("--self-check");

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;

// ---------------------------------------------------------------------------
// Normal mode
// ---------------------------------------------------------------------------

function reasonDetail(reason: LiveInstructionDocumentDriftFinding["reason"]): string {
  switch (reason) {
    case "content-drift":
      return "current git content matches no revision shared-spec has ever recorded for this document";
    case "missing-file":
      return "shared-spec has this document, but the git-tracked file is missing from this checkout";
  }
}

function reportFindings(findings: readonly LiveInstructionDocumentDriftFinding[]): void {
  console.log("");
  console.log(R("╔══════════════════════════════════════════════════════════════════════════╗"));
  console.log(R("║   ⚠️   LIVE-INSTRUCTION DOCUMENT(S) HAVE DRIFTED FROM SHARED-SPEC   ⚠️     ║"));
  console.log(R("╠══════════════════════════════════════════════════════════════════════════╣"));
  console.log(R("║  Ordinary git commits appear to have landed on these liveInstructionDocument:"));
  console.log(R("║  true paths outside the shared-spec review ceremony. A real approve/resync"));
  console.log(R("║  attempt on them will be refused by GitWorkingTreeLiveSyncProvider until"));
  console.log(R("║  this is fixed."));
  console.log(R("║"));
  for (const finding of findings) {
    console.log(R(`║    • ${finding.gitPath} (${finding.title}) — ${reasonDetail(finding.reason)}`));
  }
  console.log(R("║"));
  console.log(R("║  WHAT TO DO:"));
  console.log(R("║    Reconcile before anyone hits a blocked review:"));
  console.log(R("║      npx tsx server/scripts/reconcile-live-instruction-document-drift.ts --dry-run"));
  console.log(R("║      npx tsx server/scripts/reconcile-live-instruction-document-drift.ts"));
  console.log(R("╚══════════════════════════════════════════════════════════════════════════╝"));
  console.log("");
}

async function readRealGitFile(root: string, gitPath: string): Promise<string | undefined> {
  try {
    return await readFile(resolve(root, gitPath), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return undefined;
    throw error;
  }
}

async function runNormalMode(): Promise<number> {
  const root = resolve(import.meta.dirname, "../..");
  const repository = new PostgresSharedSpecRepository(getSharedDb());
  const core = new SharedSpecCore(repository);

  const documents = await core.listDocuments();
  const liveDocuments = documents.filter((document) => document.liveInstructionDocument);

  if (liveDocuments.length === 0) {
    console.log(G("[live-instruction-document-drift-guard] No liveInstructionDocument: true documents are recorded yet -- nothing to check. Passed."));
    return 0;
  }

  const candidates: LiveInstructionDocumentDriftCandidate[] = await Promise.all(
    liveDocuments.map(async (document) => ({
      documentId: document.id,
      title: document.title,
      gitPath: document.gitPath,
      knownRevisionContentHashes: (await core.listRevisions(document.id)).map((revision) => revision.contentHash),
    })),
  );

  const readGitFile: ReadLiveInstructionGitFile = (gitPath) => readRealGitFile(root, gitPath);
  const { findings, checked } = await findLiveInstructionDocumentDrift(candidates, readGitFile);

  if (findings.length === 0) {
    console.log(
      G(`[live-instruction-document-drift-guard] All ${checked} liveInstructionDocument: true document(s) match a shared-spec-recorded revision. Passed.`),
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
    passed++;
    console.log(G(`  ✓ ${label}`));
  } else {
    failed++;
    console.log(R(`  ✗ ${label}`));
    if (detail) console.log(R(`       ${detail}`));
  }
}

function fixedReader(map: Record<string, string | undefined>): ReadLiveInstructionGitFile {
  return async (gitPath) => map[gitPath];
}

async function runSelfCheck(): Promise<number> {
  console.log("Self-check: findLiveInstructionDocumentDrift()");

  // (a) Content matches a historical, non-current recorded revision -> clean, no finding.
  {
    const oldContent = "# Revision one\n";
    const newContent = "# Revision two\n";
    const candidate: LiveInstructionDocumentDriftCandidate = {
      documentId: "doc-old-revision-match",
      title: "Doc A",
      gitPath: "docs/fixture-a.md",
      knownRevisionContentHashes: [hashSharedSpecMarkdown(oldContent), hashSharedSpecMarkdown(newContent)],
    };
    const { findings } = await findLiveInstructionDocumentDrift([candidate], fixedReader({ [candidate.gitPath]: oldContent }));
    assert(
      "content matching an older (non-current) recorded revision is accepted, not flagged",
      findings.length === 0,
      `Got: ${JSON.stringify(findings)}`,
    );
  }

  // (b) True content mismatch -> flagged as content-drift.
  {
    const approved = "# Approved\n";
    const outOfBand = "# Out of band edit, never went through shared-spec\n";
    const candidate: LiveInstructionDocumentDriftCandidate = {
      documentId: "doc-content-drift",
      title: "Doc B",
      gitPath: "docs/fixture-b.md",
      knownRevisionContentHashes: [hashSharedSpecMarkdown(approved)],
    };
    const { findings } = await findLiveInstructionDocumentDrift([candidate], fixedReader({ [candidate.gitPath]: outOfBand }));
    assert(
      "a real content mismatch is flagged as content-drift",
      findings.length === 1 && findings[0].reason === "content-drift" && findings[0].gitPath === candidate.gitPath,
      `Got: ${JSON.stringify(findings)}`,
    );
  }

  // (c) Missing file -> flagged distinctly as missing-file, never conflated with content-drift.
  {
    const candidate: LiveInstructionDocumentDriftCandidate = {
      documentId: "doc-missing-file",
      title: "Doc C",
      gitPath: "docs/fixture-c.md",
      knownRevisionContentHashes: [hashSharedSpecMarkdown("# Anything\n")],
    };
    const { findings } = await findLiveInstructionDocumentDrift([candidate], fixedReader({}));
    assert(
      "a missing git file is flagged distinctly as missing-file, not content-drift",
      findings.length === 1 && findings[0].reason === "missing-file" && findings[0].gitPath === candidate.gitPath,
      `Got: ${JSON.stringify(findings)}`,
    );
  }

  // (d) Multiple candidates: a clean one, a drifted one, and a missing one must be isolated correctly.
  {
    const cleanContent = "# Clean\n";
    const approved = "# Approved\n";
    const drifted = "# Drifted\n";
    const candidates: LiveInstructionDocumentDriftCandidate[] = [
      { documentId: "doc-clean", title: "Clean", gitPath: "docs/fixture-clean.md", knownRevisionContentHashes: [hashSharedSpecMarkdown(cleanContent)] },
      { documentId: "doc-drifted", title: "Drifted", gitPath: "docs/fixture-drifted.md", knownRevisionContentHashes: [hashSharedSpecMarkdown(approved)] },
      { documentId: "doc-missing", title: "Missing", gitPath: "docs/fixture-missing.md", knownRevisionContentHashes: [hashSharedSpecMarkdown(approved)] },
    ];
    const { findings, checked } = await findLiveInstructionDocumentDrift(
      candidates,
      fixedReader({ "docs/fixture-clean.md": cleanContent, "docs/fixture-drifted.md": drifted }),
    );
    assert("checked reflects the full candidate count", checked === 3, String(checked));
    assert("only the drifted and missing candidates are reported, the clean one is not", findings.length === 2, `Got: ${JSON.stringify(findings)}`);
    assert(
      "the drifted candidate is reported with the correct reason and path",
      findings.some((f) => f.gitPath === "docs/fixture-drifted.md" && f.reason === "content-drift"),
      `Got: ${JSON.stringify(findings)}`,
    );
    assert(
      "the missing candidate is reported with the correct reason and path",
      findings.some((f) => f.gitPath === "docs/fixture-missing.md" && f.reason === "missing-file"),
      `Got: ${JSON.stringify(findings)}`,
    );
  }

  // (e) Zero candidates -> clean pass, and the git reader must never be invoked.
  {
    let invoked = false;
    const readGitFile: ReadLiveInstructionGitFile = async () => {
      invoked = true;
      return undefined;
    };
    const { findings, checked } = await findLiveInstructionDocumentDrift([], readGitFile);
    assert("zero candidates is a clean pass", findings.length === 0 && checked === 0, `Got: ${JSON.stringify({ findings, checked })}`);
    assert("the git reader is never called when there are no candidates", !invoked);
  }

  console.log("");
  console.log(`${passed} passed, ${failed} failed.`);
  return failed === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  return SELF_CHECK ? runSelfCheck() : runNormalMode();
}

if (isDirectCliInvocation("check-live-instruction-document-drift.ts")) {
  main()
    .then(async (exitCode) => {
      if (!SELF_CHECK) await closeDbConnections();
      process.exit(exitCode);
    })
    .catch(async (error) => {
      process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
      if (!SELF_CHECK) await closeDbConnections().catch(() => {});
      process.exit(1);
    });
}
