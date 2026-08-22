import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.NEON_SHARED_DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT cu.order_index, cu.name, cu.chapter_type, cu.actfl_level,
             COUNT(cl.id) as lesson_count,
             SUM(array_length(cl.required_vocabulary, 1)) as vocab_count,
             SUM(array_length(cl.required_grammar, 1)) as grammar_count
      FROM curriculum_units cu
      LEFT JOIN curriculum_lessons cl ON cl.curriculum_unit_id = cu.id
      JOIN curriculum_paths cp ON cp.id = cu.curriculum_path_id
      WHERE cp.name = 'Spanish 1 - High School'
        AND cu.name NOT LIKE '[ARCHIVED]%'
      GROUP BY cu.id, cu.name, cu.order_index, cu.chapter_type, cu.actfl_level
      ORDER BY cu.order_index
    `);

    console.log(`\n${'═'.repeat(90)}`);
    console.log(`  Spanish 1 — Restructured Structure (${rows.length} chapters)`);
    console.log(`${'═'.repeat(90)}`);
    console.log(`  ${'Ch'.padEnd(4)} ${'Chapter Name'.padEnd(34)} ${'Type'.padEnd(22)} ${'Lessons'.padEnd(8)} ${'Vocab'.padEnd(6)} Grammar`);
    console.log(`  ${'─'.repeat(88)}`);

    let totalVocab = 0, totalGrammar = 0;
    for (const r of rows) {
      const v = parseInt(r.vocab_count) || 0;
      const g = parseInt(r.grammar_count) || 0;
      totalVocab += v; totalGrammar += g;
      const warn = v > 20 ? ' ⚠' : '';
      console.log(`  ${String(r.order_index).padStart(2)}   ${r.name.padEnd(34)} ${(r.chapter_type || '-').padEnd(22)} ${String(r.lesson_count).padEnd(8)} ${String(v).padEnd(6)}${g}${warn}`);
    }
    console.log(`  ${'─'.repeat(88)}`);
    console.log(`  TOTAL                                                                    ${String(totalVocab).padEnd(6)}${totalGrammar}`);

    // Check archived
    const { rows: archived } = await client.query(`
      SELECT COUNT(*) as n FROM curriculum_units cu
      JOIN curriculum_paths cp ON cp.id = cu.curriculum_path_id
      WHERE cp.name = 'Spanish 1 - High School' AND cu.name LIKE '[ARCHIVED]%'
    `);
    console.log(`\n  Archived mega-units: ${archived[0].n}`);

    // Check no orphaned lessons
    const { rows: orphans } = await client.query(`
      SELECT COUNT(*) as n FROM curriculum_lessons cl
      JOIN curriculum_units cu ON cu.id = cl.curriculum_unit_id
      JOIN curriculum_paths cp ON cp.id = cu.curriculum_path_id
      WHERE cp.name = 'Spanish 1 - High School' AND cu.name LIKE '[ARCHIVED]%'
    `);
    console.log(`  Orphaned lessons in archived units: ${orphans[0].n}`);
    console.log(`${'═'.repeat(90)}\n`);
  } finally { client.release(); await pool.end(); }
}
main().catch(console.error);
