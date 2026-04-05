import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.NEON_SHARED_DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function main() {
  const client = await pool.connect();
  try {
    const { rows: cols } = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'textbook_lesson_content' ORDER BY ordinal_position
    `);
    console.log('textbook_lesson_content columns:');
    cols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));

    // Get one sample row keys
    const { rows: sample } = await client.query(`SELECT * FROM textbook_lesson_content LIMIT 1`);
    if (sample.length > 0) {
      console.log('\nSample row keys:', Object.keys(sample[0]));
      // Show content summary
      const row = sample[0];
      for (const [key, val] of Object.entries(row)) {
        if (typeof val === 'string' && val.length > 100) {
          console.log(`  ${key}: [${val.length} chars]`);
        } else if (Array.isArray(val)) {
          console.log(`  ${key}: [array, ${val.length} items]`);
        } else {
          console.log(`  ${key}: ${JSON.stringify(val)?.slice(0, 80)}`);
        }
      }
    }
  } finally { client.release(); await pool.end(); }
}
main().catch(console.error);
