import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.NEON_SHARED_DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function main() {
  const client = await pool.connect();
  try {
    const { rows: uCols } = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns WHERE table_name = 'curriculum_units' ORDER BY ordinal_position`);
    console.log('=== curriculum_units columns ===');
    uCols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} default=${c.column_default}`));

    const { rows: lCols } = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'curriculum_lessons' ORDER BY ordinal_position`);
    console.log('\n=== curriculum_lessons columns ===');
    lCols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));

    const { rows: paths } = await client.query(`SELECT id, name, language FROM curriculum_paths WHERE language = 'spanish' ORDER BY name`);
    console.log('\n=== Spanish paths ===');
    paths.forEach(p => console.log(`  id=${p.id} | ${p.name}`));

    const { rows: units } = await client.query(`
      SELECT cu.id, cu.name, cu.order_index, COUNT(cl.id) as lesson_count
      FROM curriculum_units cu
      JOIN curriculum_paths cp ON cp.id = cu.curriculum_path_id
      LEFT JOIN curriculum_lessons cl ON cl.curriculum_unit_id = cu.id
      WHERE cp.name = 'Spanish 1 - High School'
      GROUP BY cu.id, cu.name, cu.order_index ORDER BY cu.order_index`);
    console.log('\n=== Spanish 1 units ===');
    units.forEach(u => console.log(`  id=${u.id} | order=${u.order_index} | lessons=${u.lesson_count} | ${u.name}`));

    const { rows: lessons } = await client.query(`
      SELECT cl.id, cl.name, cl.lesson_type, cu.order_index as unit_order, cu.name as unit_name
      FROM curriculum_lessons cl
      JOIN curriculum_units cu ON cu.id = cl.curriculum_unit_id
      JOIN curriculum_paths cp ON cp.id = cu.curriculum_path_id
      WHERE cp.name = 'Spanish 1 - High School'
      ORDER BY cu.order_index, cl.name`);
    console.log('\n=== All Spanish 1 lessons ===');
    let lastUnit = '';
    lessons.forEach(l => {
      if (l.unit_name !== lastUnit) { console.log(`\n  [Unit ${l.unit_order}] ${l.unit_name}`); lastUnit = l.unit_name; }
      console.log(`    id=${l.id} | [${l.lesson_type}] ${l.name}`);
    });
  } finally { client.release(); await pool.end(); }
}
main().catch(console.error);
