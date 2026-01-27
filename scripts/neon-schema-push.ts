import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function pushSchemaToNeon() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('Missing DATABASE_URL');
    process.exit(1);
  }

  console.log('=== Neon Schema Push ===\n');

  console.log('1. Testing connection...');
  
  const pool = new Pool({ connectionString: dbUrl });

  try {
    const result = await pool.query('SELECT current_database()');
    console.log(`   Database: ${result.rows[0].current_database} ✓`);
  } catch (error: any) {
    console.error('Connection test failed:', error.message);
    process.exit(1);
  }

  console.log('\n2. Checking existing tables...');
  
  const tables = await pool.query(`
    SELECT COUNT(*) as count FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  console.log(`   Tables: ${tables.rows[0].count}`);

  await pool.end();

  console.log('\n3. Schema push instructions:');
  console.log('   Run this command to push the schema:');
  console.log('\n   npm run db:push');
  
  console.log('\nDone!');
}

pushSchemaToNeon().catch(console.error);
