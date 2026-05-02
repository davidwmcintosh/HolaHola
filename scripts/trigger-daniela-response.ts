import { founderCollabService } from '../server/services/founder-collaboration-service';
import { hiveConsciousnessService } from '../server/services/hive-consciousness-service';

const SESSION_ID = 'fcad468e-592a-4a6f-b09d-5b320d230c9b';
const MSG_ID = 'af3db957-1a85-4e64-92d0-051283236a31';

async function main() {
  try {
    // Get the message we just posted
    const messages = await founderCollabService.getSessionMessages(SESSION_ID, 5);
    const msg = messages.find(m => m.id === MSG_ID);
    
    if (!msg) {
      console.error('Message not found');
      process.exit(1);
    }
    
    console.log(`Found message, triggering hive consciousness...`);
    await hiveConsciousnessService.processMessage(SESSION_ID, msg);
    console.log(`✓ Hive consciousness triggered`);
    process.exit(0);
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
