import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws;

async function main() {
  const neonShared = new Pool({ connectionString: process.env.NEON_DATABASE_URL_SHARED });
  try {
    const result = await neonShared.query('SELECT COUNT(*) as count FROM agent_observations');
    console.log('Neon agent_observations count:', result.rows[0].count);
    
    // Also get max id for checkpoint reference
    const maxResult = await neonShared.query('SELECT MAX(id) as max_id FROM agent_observations');
    console.log('Neon max id:', maxResult.rows[0].max_id);
  } catch (e: any) {
    console.error('Error:', e.message);
  }
  await neonShared.end();
}
main();
