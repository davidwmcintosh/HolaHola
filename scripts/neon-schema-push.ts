import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { sql } from 'drizzle-orm';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function pushSchemaToNeon() {
  const sharedUrl = process.env.NEON_SHARED_DATABASE_URL;
  const userUrl = process.env.NEON_USER_DATABASE_URL;

  if (!sharedUrl || !userUrl) {
    console.error('Missing NEON_SHARED_DATABASE_URL or NEON_USER_DATABASE_URL');
    process.exit(1);
  }

  console.log('=== Neon Schema Push ===\n');

  // Test connections first
  console.log('1. Testing connections...');
  
  const sharedPool = new Pool({ connectionString: sharedUrl });
  const userPool = new Pool({ connectionString: userUrl });

  try {
    const sharedResult = await sharedPool.query('SELECT current_database()');
    console.log(`   Shared DB: ${sharedResult.rows[0].current_database} ✓`);
    
    const userResult = await userPool.query('SELECT current_database()');
    console.log(`   User DB: ${userResult.rows[0].current_database} ✓`);
  } catch (error: any) {
    console.error('Connection test failed:', error.message);
    process.exit(1);
  }

  // Check current table count in each database
  console.log('\n2. Checking existing tables...');
  
  const sharedTables = await sharedPool.query(`
    SELECT COUNT(*) as count FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  console.log(`   Shared DB tables: ${sharedTables.rows[0].count}`);
  
  const userTables = await userPool.query(`
    SELECT COUNT(*) as count FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  console.log(`   User DB tables: ${userTables.rows[0].count}`);

  await sharedPool.end();
  await userPool.end();

  console.log('\n3. Schema push instructions:');
  console.log('   Run these commands to push the schema to each database:');
  console.log('\n   For SHARED database:');
  console.log('   DATABASE_URL=$NEON_SHARED_DATABASE_URL npx drizzle-kit push');
  console.log('\n   For USER database:');
  console.log('   DATABASE_URL=$NEON_USER_DATABASE_URL npx drizzle-kit push');
  
  console.log('\nDone!');
}

pushSchemaToNeon().catch(console.error);
