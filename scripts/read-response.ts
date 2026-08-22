import { founderCollabService } from '../server/services/founder-collaboration-service';

const SESSION_ID = 'fcad468e-592a-4a6f-b09d-5b320d230c9b';

async function main() {
  const messages = await founderCollabService.getSessionMessages(SESSION_ID, 10);
  // Show messages after our trigger
  const cutoff = new Date('2025-01-01');
  const recent = messages.filter(m => new Date(m.createdAt!) > cutoff);
  for (const m of recent.slice(-6)) {
    const ts = new Date(m.createdAt!).toLocaleTimeString();
    console.log(`\n[${ts}] ${m.role.toUpperCase()}:\n${m.content.substring(0, 2000)}`);
  }
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
