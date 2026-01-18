import { Pool, neonConfig } from '@neondatabase/serverless';
import pg from 'pg';
import ws from 'ws';
neonConfig.webSocketConstructor = ws;

const SHARED_TABLES = [
  'agent_observations',
  'curriculum_drill_items',
  'curriculum_lessons',
  'curriculum_units',
  'curriculum_paths',
  'can_do_statements',
  'wren_insights',
  'self_best_practices',
  'tutor_procedures',
  'teaching_principles',
];

async function main() {
  const neonShared = new Pool({ connectionString: process.env.NEON_DATABASE_URL_SHARED });
  const source = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  
  console.log('Table Comparison (Source vs Neon):\n');
  console.log('| Table | Source | Neon | Status |');
  console.log('|-------|--------|------|--------|');
  
  for (const table of SHARED_TABLES) {
    try {
      const srcResult = await source.query(`SELECT COUNT(*) as count FROM ${table}`);
      const neonResult = await neonShared.query(`SELECT COUNT(*) as count FROM ${table}`);
      const srcCount = parseInt(srcResult.rows[0].count);
      const neonCount = parseInt(neonResult.rows[0].count);
      const status = neonCount >= srcCount ? '✓ Complete' : `${Math.round(neonCount/srcCount*100)}%`;
      console.log(`| ${table} | ${srcCount.toLocaleString()} | ${neonCount.toLocaleString()} | ${status} |`);
    } catch (e: any) {
      console.log(`| ${table} | - | Error: ${e.message.substring(0, 30)} |`);
    }
  }
  
  await neonShared.end();
  await source.end();
}
main();
