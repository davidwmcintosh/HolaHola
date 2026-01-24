import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from "ws";
import { SHARED_TABLES, USER_TABLES } from '../neon-db';

neonConfig.webSocketConstructor = ws;

const NEON_SHARED_URL = process.env.NEON_SHARED_DATABASE_URL;

if (!NEON_SHARED_URL) {
  console.error("NEON_SHARED_DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: NEON_SHARED_URL });

async function checkFKConstraints() {
  console.log("🔍 Checking for cross-database FK constraints in Neon...\n");

  // Get all FK constraints
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

  const crossDbIssues: any[] = [];
  const withinShared: any[] = [];
  const withinUser: any[] = [];
  const unknown: any[] = [];

  for (const row of result.rows) {
    const fromTable = row.from_table;
    const toTable = row.to_table;
    
    const fromIsShared = SHARED_TABLES.has(fromTable);
    const fromIsUser = USER_TABLES.has(fromTable);
    const toIsShared = SHARED_TABLES.has(toTable);
    const toIsUser = USER_TABLES.has(toTable);

    const constraint = {
      name: row.constraint_name,
      from: `${fromTable}.${row.from_column}`,
      to: `${toTable}.${row.to_column}`,
    };

    // Cross-database: SHARED -> USER or USER -> SHARED
    if ((fromIsShared && toIsUser) || (fromIsUser && toIsShared)) {
      crossDbIssues.push({
        ...constraint,
        issue: fromIsShared ? 'SHARED → USER' : 'USER → SHARED',
      });
    } else if (fromIsShared && toIsShared) {
      withinShared.push(constraint);
    } else if (fromIsUser && toIsUser) {
      withinUser.push(constraint);
    } else {
      unknown.push({
        ...constraint,
        fromDb: fromIsShared ? 'SHARED' : fromIsUser ? 'USER' : 'UNKNOWN',
        toDb: toIsShared ? 'SHARED' : toIsUser ? 'USER' : 'UNKNOWN',
      });
    }
  }

  // Report cross-database issues (CRITICAL)
  if (crossDbIssues.length > 0) {
    console.log("🚨 CROSS-DATABASE FK CONSTRAINTS (need to be dropped):\n");
    for (const issue of crossDbIssues) {
      console.log(`  ❌ ${issue.name}`);
      console.log(`     ${issue.from} → ${issue.to}`);
      console.log(`     Issue: ${issue.issue}\n`);
    }
  } else {
    console.log("✅ No cross-database FK constraints found!\n");
  }

  // Report unknown tables
  if (unknown.length > 0) {
    console.log("⚠️  FK constraints with UNKNOWN table routing:\n");
    for (const u of unknown) {
      console.log(`  ⚠️  ${u.name}`);
      console.log(`     ${u.from} (${u.fromDb}) → ${u.to} (${u.toDb})\n`);
    }
  }

  // Summary
  console.log("\n📊 Summary:");
  console.log(`   Within SHARED: ${withinShared.length} constraints`);
  console.log(`   Within USER: ${withinUser.length} constraints`);
  console.log(`   Cross-database issues: ${crossDbIssues.length}`);
  console.log(`   Unknown routing: ${unknown.length}`);

  // Generate DROP statements if needed
  if (crossDbIssues.length > 0) {
    console.log("\n🔧 DROP statements to fix cross-database issues:\n");
    for (const issue of crossDbIssues) {
      const tableName = issue.from.split('.')[0];
      console.log(`ALTER TABLE ${tableName} DROP CONSTRAINT ${issue.name};`);
    }
  }

  await pool.end();
}

checkFKConstraints().catch(console.error);
