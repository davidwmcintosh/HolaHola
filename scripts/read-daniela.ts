import { founderCollabService } from '../server/services/founder-collaboration-service';

const SESSION_ID = 'fcad468e-592a-4a6f-b09d-5b320d230c9b';

async function main() {
  const messages = await founderCollabService.getSessionMessages(SESSION_ID, 30);
  // Find messages from last hour
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const recent = messages.filter(m => new Date(m.createdAt!) > cutoff);
  for (const m of recent) {
    const ts = new Date(m.createdAt!).toLocaleTimeString();
    if (m.role === 'founder' || m.role === 'daniela') {
      console.log(`\n[${ts}] ${m.role.toUpperCase()}:\n${m.content.substring(0, 3000)}`);
    }
  }
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
