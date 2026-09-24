/**
 * Alden <-> Agent handoff, backed by shared-spec instead of a raw file.
 *
 * docs/alden-agent-handoff.md used to be written directly via fs.writeFileSync
 * (see write_briefing's old implementation in alden-functions.ts, before
 * 2026-09-24). That had two problems: no conflict detection (a concurrent
 * Alden write and an Agent edit could clobber each other -- last write wins,
 * silently) and no durable cross-checkout visibility (a write made against
 * one running server -- e.g. a production deployment -- was invisible to a
 * different checkout's copy of the file until someone manually synced it; a
 * container recycle between the write and any sync could lose it outright).
 *
 * This service stores the handoff as a shared-spec "note" at
 * notes/alden-agent-handoff.md (kind: note -- CAS-protected, cross-actor,
 * unreviewed by design; see shareDocument in shared-spec-core.ts). The
 * Postgres row is canonical regardless of which host process wrote it.
 *
 * docs/alden-agent-handoff.md remains on disk as a generated, git-tracked
 * snapshot for backward-compatible reading (session-start checklists, human
 * reading, other hats that haven't adopted the shared-spec CLI) -- refreshed
 * here after every in-process write, and refreshable from any checkout via
 * `npx tsx server/scripts/shared-spec-cli.ts pull --path alden-agent-handoff
 * --write-file docs/alden-agent-handoff.md ...`.
 *
 * Fast-share notes deliberately never go through the liveInstructionDocument
 * git-commit-on-approval path (they skip review entirely -- see the comment
 * on shareDocument in shared-spec-core.ts). The local snapshot file written
 * here is a separate, purpose-built, best-effort mechanism, not a reuse of
 * that review-gated path -- appropriate for a channel that's meant to stay
 * informal and immediate, not ceremonial.
 */

import { randomUUID } from "node:crypto";
import { renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { getSharedDb } from "../db";
import { SharedSpecCore, SharedSpecDomainError } from "./shared-spec-core";
import { PostgresSharedSpecRepository } from "./shared-spec-postgres-repository";
import { workspaceResolution } from "./workspace-root";

/** Matches shared-spec-cli.ts's DEFAULT_NOTE_REPOSITORY -- one shared flat
 * namespace for notes across all of Luca's hats. */
export const ALDEN_HANDOFF_REPOSITORY = "luca-hats/notes";
export const ALDEN_HANDOFF_GIT_PATH = "notes/alden-agent-handoff.md";
/** Backward-compatible local snapshot path -- see module doc comment. */
export const ALDEN_HANDOFF_SNAPSHOT_PATH = "docs/alden-agent-handoff.md";

let cachedCore: SharedSpecCore | undefined;
/**
 * Lazy singleton, distinct from the SharedSpecCore instance
 * hola-hola-shared-spec-bootstrap.ts hands to the HTTP routes. Safe to have
 * two instances: SharedSpecCore holds no in-memory document/revision cache of
 * its own (only `now`/`newId` helpers) -- every read and write goes through
 * PostgresSharedSpecRepository straight to Postgres, which is the only place
 * state actually lives.
 */
function getCore(): SharedSpecCore {
  if (!cachedCore) cachedCore = new SharedSpecCore(new PostgresSharedSpecRepository(getSharedDb()));
  return cachedCore;
}

export interface AldenHandoffSnapshot {
  readonly markdown: string;
  readonly revisionId: string;
}

/** Pulls the current handoff markdown directly from shared-spec. Returns
 * undefined only if the note has never been created yet (see
 * server/scripts/migrate-alden-handoff-to-shared-spec.ts). */
export async function pullAldenHandoffNote(): Promise<AldenHandoffSnapshot | undefined> {
  const found = await getCore().findByDestination(ALDEN_HANDOFF_REPOSITORY, ALDEN_HANDOFF_GIT_PATH);
  if (!found) return undefined;
  return { markdown: found.currentRevision.markdown, revisionId: found.currentRevision.id };
}

function atomicWriteFile(absolutePath: string, content: string): void {
  const directory = dirname(absolutePath);
  const temporary = join(directory, `.${basename(absolutePath)}.${randomUUID()}.tmp`);
  writeFileSync(temporary, content, "utf8");
  renameSync(temporary, absolutePath);
}

/**
 * Writes the given markdown to the local git-tracked snapshot file. Best
 * effort and non-throwing: the shared-spec write has already succeeded by
 * the time this runs, so a local filesystem failure here must not be
 * reported as a lost briefing -- the canonical content is safe in Postgres
 * either way, and the file can be refreshed later via shared-spec-cli.ts
 * pull --write-file.
 */
export function refreshAldenHandoffSnapshotFile(markdown: string): void {
  try {
    atomicWriteFile(join(workspaceResolution.root, ALDEN_HANDOFF_SNAPSHOT_PATH), markdown.endsWith("\n") ? markdown : `${markdown}\n`);
  } catch (error: any) {
    console.warn(`[AldenHandoff] Local snapshot refresh failed (canonical shared-spec write already succeeded): ${error?.message ?? error}`);
  }
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Replaces (or inserts) a "## From <heading>" section while preserving every
 * other section byte-for-byte -- the one piece of logic both write paths
 * (Alden's write_briefing tool call and update-alden-handoff-section.ts, used
 * by the Agent / Claude Code) share, so it lives here once instead of as two
 * independently-maintained regexes that could silently drift apart and lose
 * content.
 *
 * A section runs from its "## From <heading>" marker up to (not including)
 * the next "## From " marker, or the end of the document. When the heading
 * isn't present yet, the new section is appended after whatever content
 * already exists (or becomes the whole document, with a top-level title, if
 * there was none).
 */
export function applyHandoffSection(existing: string, heading: string, body: string, timestamp: string): string {
  // No "m" flag: this must match "$" only at the true end of the document.
  // With "m", "$" matches before every line's newline, so the lazy [\s\S]*?
  // would stop after the heading's first line instead of consuming the rest
  // of that section's body -- caught by test-alden-handoff-section-transform.ts.
  const headingPattern = new RegExp(`## From ${escapeRegExp(heading)}[\\s\\S]*?(?=\\n## From |$)`);
  const newSection = `## From ${heading} — last updated: ${timestamp}\n\n${body}`;
  if (headingPattern.test(existing)) {
    return `${existing.replace(headingPattern, newSection).trimEnd()}\n`;
  }
  const trimmed = existing.trim();
  return trimmed ? `${trimmed}\n\n---\n\n${newSection}\n` : `# Alden ↔ Agent Handoff\n\n${newSection}\n`;
}

export type AldenHandoffTransform = (currentMarkdown: string) => string;

/**
 * Pulls the current note, applies `transform` to compute the next markdown,
 * and shares it with optimistic-concurrency retry: if another actor's write
 * lands between the pull and the share (SharedSpecDomainError "CONFLICT"),
 * re-pulls and re-applies `transform` against the new base rather than
 * failing outright or overwriting. Refreshes the local snapshot file on
 * success.
 */
export async function shareAldenHandoffNote(
  actorId: string,
  transform: AldenHandoffTransform,
  maxAttempts = 5,
): Promise<{ markdown: string; revisionId: string; created: boolean }> {
  let lastConflict: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const pulled = await pullAldenHandoffNote();
    const markdown = transform(pulled?.markdown ?? "");
    try {
      const shared = await getCore().shareDocument(
        { actorId },
        {
          repository: ALDEN_HANDOFF_REPOSITORY,
          gitPath: ALDEN_HANDOFF_GIT_PATH,
          markdown,
          title: "Alden ↔ Agent Handoff",
          baseRevisionId: pulled?.revisionId,
          idempotencyKey: randomUUID(),
        },
      );
      refreshAldenHandoffSnapshotFile(markdown);
      return { markdown, revisionId: shared.revision.id, created: shared.created };
    } catch (error) {
      if (error instanceof SharedSpecDomainError && error.code === "CONFLICT") {
        lastConflict = error;
        continue;
      }
      throw error;
    }
  }
  throw lastConflict instanceof Error
    ? lastConflict
    : new Error("Failed to share the Alden handoff note after repeated concurrent-write conflicts");
}
