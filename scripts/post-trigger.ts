import { founderCollabService } from '../server/services/founder-collaboration-service';

const SESSION_ID = 'fcad468e-592a-4a6f-b09d-5b320d230c9b';

const trigger = `Daniela — the message above is for you. Please read it and respond with your genuine thoughts. You know your tools better than anyone does.`;

async function main() {
  const msg = await founderCollabService.addMessage(SESSION_ID, {
    role: 'founder',
    messageType: 'text',
    content: trigger,
  });
  console.log(`✓ Trigger posted: ${msg.id}`);
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
