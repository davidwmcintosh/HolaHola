// Live-instruction-document drift guard (task 1617) — proactively detects
// the exact condition GitWorkingTreeLiveSyncProvider.syncExclusive()
// (shared-spec-live-sync.ts) only discovers reactively, at the moment
// someone actually attempts a real approve/resync on a document created
// with liveInstructionDocument: true. Ordinary git commits can (and, per
// task 1612, routinely do) land on docs/shared-agent-instructions.md or
// docs/coordination-clients.md without ever going through the shared-spec
// review ceremony -- task 1612 found 11 such undetected drifting commits
// over 4 days on coordination-clients.md alone before anyone hit a blocked
// review. This guard exists so drift is surfaced long before that: run it
// periodically or in CI, and it reports every drifted document up front.
//
// findLiveInstructionDocumentDrift() reuses matchesKnownRevision() from
// shared-spec-live-sync.ts -- the exact same "does this content match ANY
// revision shared-spec has ever recorded for this document" test the
// reactive guard uses -- so the two checks can never silently disagree on
// what counts as drift. Git access and document/revision lookup are both
// injected (ReadLiveInstructionGitFile, and the caller assembles
// `candidates` itself from shared-spec) so this algorithm can be exercised
// hermetically against fixtures with no database or real git involved. See
// server/scripts/check-live-instruction-document-drift.ts for the CLI that
// wires this to the real database and real git files (normal mode) or to
// fixtures (self-check mode), and
// server/scripts/reconcile-live-instruction-document-drift.ts for the fix a
// real finding here should point a maintainer at.

import { matchesKnownRevision } from "./shared-spec-live-sync";

export interface LiveInstructionDocumentDriftCandidate {
  readonly documentId: string;
  readonly title: string;
  readonly gitPath: string;
  /** Content hash of every revision shared-spec has ever recorded for this document (see LiveInstructionSyncTarget.knownRevisionContentHashes for the same contract). */
  readonly knownRevisionContentHashes: readonly string[];
}

export type LiveInstructionDocumentDriftReason =
  /** The file exists, but its content matches no revision shared-spec has ever recorded for this document -- an out-of-band edit landed on this path. */
  | "content-drift"
  /** shared-spec has this document, but the git-tracked file is missing from this checkout entirely. */
  | "missing-file";

export interface LiveInstructionDocumentDriftFinding {
  readonly documentId: string;
  readonly title: string;
  readonly gitPath: string;
  readonly reason: LiveInstructionDocumentDriftReason;
}

export interface LiveInstructionDocumentDriftResult {
  readonly findings: readonly LiveInstructionDocumentDriftFinding[];
  readonly checked: number;
}

/**
 * Reads `gitPath`'s current content, or returns undefined when the file
 * does not exist. Any other failure (permissions, I/O error, etc.) must be
 * rethrown rather than swallowed into undefined -- a missing file is a
 * meaningful, distinct finding in its own right, but every other error is a
 * real operational failure the caller needs to see, not silently reinterpreted
 * as drift.
 */
export type ReadLiveInstructionGitFile = (gitPath: string) => Promise<string | undefined>;

export async function findLiveInstructionDocumentDrift(
  candidates: readonly LiveInstructionDocumentDriftCandidate[],
  readGitFile: ReadLiveInstructionGitFile,
): Promise<LiveInstructionDocumentDriftResult> {
  const findings: LiveInstructionDocumentDriftFinding[] = [];

  for (const candidate of candidates) {
    const content = await readGitFile(candidate.gitPath);
    if (content === undefined) {
      findings.push({ documentId: candidate.documentId, title: candidate.title, gitPath: candidate.gitPath, reason: "missing-file" });
      continue;
    }
    if (!matchesKnownRevision(content, candidate.knownRevisionContentHashes)) {
      findings.push({ documentId: candidate.documentId, title: candidate.title, gitPath: candidate.gitPath, reason: "content-drift" });
    }
  }

  return { findings, checked: candidates.length };
}
