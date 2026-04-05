import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.NEON_SHARED_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT
        cl.name as lesson_name,
        cl.lesson_type,
        cl.objectives,
        cl.required_vocabulary,
        cl.required_grammar,
        cl.description
      FROM curriculum_lessons cl
      JOIN curriculum_units cu ON cu.id = cl.curriculum_unit_id
      JOIN curriculum_paths cp ON cp.id = cu.curriculum_path_id
      WHERE cp.language = 'spanish'
        AND cp.name = 'Spanish 1 - High School'
        AND cu.order_index = 1
      ORDER BY cl.name
    `);

    for (const l of rows) {
      console.log(`\n═══════════════════════════════════`);
      console.log(`LESSON: ${l.lesson_name} [${l.lesson_type}]`);
      console.log(`Description: ${l.description || '(none)'}`);
      if (l.objectives?.length) {
        console.log(`Objectives (${l.objectives.length}):`);
        l.objectives.forEach((o: string, i: number) => console.log(`  ${i+1}. ${o}`));
      }
      const vocab = l.required_vocabulary || [];
      if (vocab.length) {
        console.log(`Vocab (${vocab.length}): ${vocab.join(', ')}`);
      }
      const grammar = l.required_grammar || [];
      if (grammar.length) {
        console.log(`Grammar (${grammar.length}):`);
        grammar.forEach((g: string, i: number) => console.log(`  G${i+1}. ${g}`));
      }
    }

    // Aggregate all grammar across the whole unit
    const allGrammar: string[] = [];
    const allVocab: string[] = [];
    for (const l of rows) {
      allGrammar.push(...(l.required_grammar || []));
      allVocab.push(...(l.required_vocabulary || []));
    }
    const uniqueGrammar = [...new Set(allGrammar)];
    const uniqueVocab = [...new Set(allVocab)];
    
    console.log(`\n\n═══ UNIT 1 AGGREGATE ═══`);
    console.log(`\nALL GRAMMAR ITEMS (${uniqueGrammar.length} unique of ${allGrammar.length} total):`);
    uniqueGrammar.forEach((g, i) => console.log(`  ${i+1}. ${g}`));
    console.log(`\nALL VOCAB (${uniqueVocab.length} unique of ${allVocab.length} total): ${uniqueVocab.join(', ')}`);

  } finally { client.release(); await pool.end(); }
}
main().catch(console.error);
