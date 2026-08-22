import { founderCollabService } from '../server/services/founder-collaboration-service';
import { getSharedDb } from '../server/db';
import { collaborationMessages } from '../shared/schema';
import { eq, desc } from 'drizzle-orm';

const SESSION_ID = 'fcad468e-592a-4a6f-b09d-5b320d230c9b';

async function main() {
  const db = getSharedDb();
  const msgs = await db
    .select()
    .from(collaborationMessages)
    .where(eq(collaborationMessages.sessionId, SESSION_ID))
    .orderBy(desc(collaborationMessages.createdAt))
    .limit(15);

  const recent = msgs.reverse();
  for (const m of recent) {
    if (m.role === 'founder' || m.role === 'daniela') {
      const ts = new Date(m.createdAt!).toLocaleTimeString();
      console.log(`\n${'='.repeat(60)}`);
      console.log(`[${ts}] ${m.role.toUpperCase()}`);
      console.log('='.repeat(60));
      console.log(m.content);
    }
  }
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
