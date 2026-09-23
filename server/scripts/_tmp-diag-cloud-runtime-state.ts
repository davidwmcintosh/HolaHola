import { getSharedDb } from "../db";
import { coordinationRuntimeRegistrations, coordinationCredentialAuditEvents } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";

async function main() {
  const db = getSharedDb();
  const regs = await db
    .select()
    .from(coordinationRuntimeRegistrations)
    .where(eq(coordinationRuntimeRegistrations.id, "luca-claude-code-cloud-2026-09"));
  console.log("REGISTRATION:", JSON.stringify(regs, null, 2));

  if (regs[0]) {
    const events = await db
      .select()
      .from(coordinationCredentialAuditEvents)
      .where(eq(coordinationCredentialAuditEvents.runtimeId, "luca-claude-code-cloud-2026-09"))
      .orderBy(desc(coordinationCredentialAuditEvents.createdAt))
      .limit(20);
    console.log("AUDIT EVENTS:", JSON.stringify(events, null, 2));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
