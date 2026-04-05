import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.NEON_SHARED_DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function main() {
  const client = await pool.connect();
  try {
    // Fetch current positions to confirm before swapping
    const { rows } = await client.query(`
      SELECT cu.id, cu.order_index, cu.name FROM curriculum_units cu
      JOIN curriculum_paths cp ON cp.id = cu.curriculum_path_id
      WHERE cp.name = 'Spanish 1 - High School'
        AND cu.order_index IN (7, 8, 9)
        AND cu.name NOT LIKE '[ARCHIVED]%'
      ORDER BY cu.order_index
    `);
    console.log('Before reorder:');
    rows.forEach(r => console.log(`  Ch ${r.order_index}: ${r.name} (id: ${r.id})`));

    // Find the IDs for each chapter by name
    const byName = (name: string) => rows.find(r => r.name.includes(name));
    const birthdays = byName('Birthdays');
    const family = byName('Family');
    const describing = byName('Describing');

    if (!birthdays || !family || !describing) {
      console.error('Could not find all three chapters — aborting');
      console.log('Found:', rows.map(r => r.name));
      return;
    }

    await client.query('BEGIN');
    // Use temp values to avoid unique constraint collision during swap
    await client.query(`UPDATE curriculum_units SET order_index = 70 WHERE id = $1`, [birthdays.id]);
    await client.query(`UPDATE curriculum_units SET order_index = 80 WHERE id = $1`, [family.id]);
    await client.query(`UPDATE curriculum_units SET order_index = 90 WHERE id = $1`, [describing.id]);
    // Now assign final positions
    await client.query(`UPDATE curriculum_units SET order_index = 7 WHERE id = $1`, [birthdays.id]);
    await client.query(`UPDATE curriculum_units SET order_index = 8 WHERE id = $1`, [family.id]);
    await client.query(`UPDATE curriculum_units SET order_index = 9 WHERE id = $1`, [describing.id]);
    await client.query('COMMIT');

    const { rows: after } = await client.query(`
      SELECT cu.order_index, cu.name FROM curriculum_units cu
      JOIN curriculum_paths cp ON cp.id = cu.curriculum_path_id
      WHERE cp.name = 'Spanish 1 - High School'
        AND cu.order_index IN (7, 8, 9)
        AND cu.name NOT LIKE '[ARCHIVED]%'
      ORDER BY cu.order_index
    `);
    console.log('After reorder:');
    after.forEach(r => console.log(`  Ch ${r.order_index}: ${r.name}`));
  } finally { client.release(); await pool.end(); }
}
main().catch(console.error);
