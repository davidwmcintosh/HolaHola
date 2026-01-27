import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function checkFKConstraints() {
  console.log("🔍 Checking FK constraints in database...\n");

  const result = await pool.query(`
    SELECT 
      tc.table_name as from_table,
      kcu.column_name as from_column,
      ccu.table_name AS to_table,
      ccu.column_name AS to_column,
      tc.constraint_name
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    ORDER BY tc.table_name, tc.constraint_name
  `);

  console.log(`Found ${result.rows.length} FK constraints total.\n`);

  for (const row of result.rows) {
    console.log(`  ${row.constraint_name}`);
    console.log(`     ${row.from_table}.${row.from_column} → ${row.to_table}.${row.to_column}\n`);
  }

  await pool.end();
}

checkFKConstraints().catch(console.error);
