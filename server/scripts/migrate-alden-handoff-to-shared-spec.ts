// One-off migration of docs/alden-agent-handoff.md's existing content into a
// shared-spec note (notes/alden-agent-handoff.md). See
// server/services/alden-handoff-shared-spec.ts for why: the file used to be
// written directly via fs.writeFileSync (no conflict detection between a
// concurrent Alden write and an Agent edit, no durable cross-checkout
// visibility for a write made by a different running server). From here on,
// the shared-spec note is canonical and the file is a generated snapshot.
//
// Uses shareDocument (not createDocument): shareDocument is the "note" kind's
// own create-or-append primitive, and every subsequent write to this
// destination -- write_briefing, update-alden-handoff-section.ts -- goes
// through it too. Notes have no review/approval lifecycle to seed past.
//
// Safe to re-run: an existing note at the destination is left untouched.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { closeDbConnections, getSharedDb } from "../db";
import { SharedSpecCore } from "../services/shared-spec-core";
import { PostgresSharedSpecRepository } from "../services/shared-spec-postgres-repository";
import {
  ALDEN_HANDOFF_GIT_PATH,
  ALDEN_HANDOFF_REPOSITORY,
  ALDEN_HANDOFF_SNAPSHOT_PATH,
} from "../services/alden-handoff-shared-spec";
import { isDirectCliInvocation } from "./lib/cli-entrypoint";

const ACTOR = "coordination-system";
const IDEMPOTENCY_KEY = "alden-handoff-migration-v1";

async function main(): Promise<void> {
  const root = resolve(import.meta.dirname, "../..");
  const core = new SharedSpecCore(new PostgresSharedSpecRepository(getSharedDb()));

  const existing = await core.findByDestination(ALDEN_HANDOFF_REPOSITORY, ALDEN_HANDOFF_GIT_PATH);
  if (existing) {
    console.log(`SKIP  ${ALDEN_HANDOFF_GIT_PATH}: active note already exists (document=${existing.document.id}, revision=${existing.currentRevision.id})`);
    return;
  }

  const markdown = await readFile(resolve(root, ALDEN_HANDOFF_SNAPSHOT_PATH), "utf8");
  const { document, revision } = await core.shareDocument(
    { actorId: ACTOR },
    {
      repository: ALDEN_HANDOFF_REPOSITORY,
      gitPath: ALDEN_HANDOFF_GIT_PATH,
      markdown,
      title: "Alden ↔ Agent Handoff",
      summary: "Bidirectional session handoff between Alden and the Replit Agent.",
      idempotencyKey: IDEMPOTENCY_KEY,
    },
  );
  console.log(`SEED  ${ALDEN_HANDOFF_GIT_PATH}: document=${document.id} revision=${revision.id} (${markdown.length} chars carried over from ${ALDEN_HANDOFF_SNAPSHOT_PATH})`);
}

// server/db.ts's pool sets idleTimeoutMillis but not allowExitOnIdle, so
// falling off the end without an explicit process.exit() would hold this
// one-shot process alive for up to two minutes. See
// .agents/memory/pg-pool-idle-timeout-ci-hang.md.
if (isDirectCliInvocation("migrate-alden-handoff-to-shared-spec.ts")) {
  main()
    .then(async () => {
      await closeDbConnections();
      process.exit(0);
    })
    .catch(async (error) => {
      process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
      await closeDbConnections().catch(() => {});
      process.exit(1);
    });
}
