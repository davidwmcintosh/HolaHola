import { Pool } from 'pg';

const pool = new Pool({ 
  connectionString: process.env.NEON_SHARED_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT
        cp.language,
        cp.name as path_name,
        cu.order_index as unit_order,
        cu.name as unit_name,
        COUNT(cl.id) as lesson_count,
        COALESCE(SUM(array_length(cl.required_vocabulary, 1)), 0) as total_vocab,
        COALESCE(SUM(array_length(cl.required_grammar, 1)), 0) as total_grammar,
        array_agg(cl.name ORDER BY cl.name) FILTER (WHERE cl.name IS NOT NULL) as lesson_names
      FROM curriculum_paths cp
      JOIN curriculum_units cu ON cu.curriculum_path_id = cp.id
      LEFT JOIN curriculum_lessons cl ON cl.curriculum_unit_id = cu.id
      WHERE cp.language = 'spanish'
      GROUP BY cp.language, cp.name, cu.order_index, cu.name
      ORDER BY cp.name, cu.order_index
    `);

    let currentPath = '';
    let pathUnitCount = 0;
    for (const r of rows) {
      if (r.path_name !== currentPath) {
        if (currentPath) console.log(`  (${pathUnitCount} units in path)\n`);
        console.log(`\n📚 PATH: ${r.path_name}`);
        currentPath = r.path_name;
        pathUnitCount = 0;
      }
      pathUnitCount++;
      const vocab = parseInt(r.total_vocab) || 0;
      const grammar = parseInt(r.total_grammar) || 0;
      const lessons = parseInt(r.lesson_count) || 0;
      const flag = vocab > 30 ? ' ⚠️  OVERSTUFFED' : vocab > 20 ? ' ⚡ LARGE' : '';
      console.log(`  Ch ${String(r.unit_order).padStart(2,'0')}: ${r.unit_name}`);
      console.log(`         Lessons: ${lessons} | Vocab: ${vocab} | Grammar: ${grammar}${flag}`);
      const names = (r.lesson_names || []);
      if (names.length) console.log(`         ↳ ${names.join(' | ')}`);
    }
    if (currentPath) console.log(`  (${pathUnitCount} units in path)\n`);

    const overstuffed = rows.filter(r => (parseInt(r.total_vocab) || 0) > 30).length;
    const large = rows.filter(r => { const v = parseInt(r.total_vocab)||0; return v > 20 && v <= 30; }).length;
    const total = rows.length;
    console.log(`\n=== TOTALS (Spanish) ===`);
    console.log(`Total chapters/units: ${total}`);
    console.log(`Overstuffed >30 vocab: ${overstuffed}`);
    console.log(`Large 21-30 vocab: ${large}`);
    console.log(`Well-sized ≤20 vocab: ${total - overstuffed - large}`);
    console.log(`Chapters needing split: ${overstuffed + large}`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
