import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.NEON_SHARED_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT
        cu.order_index as unit_order,
        cu.name as unit_name,
        cl.name as lesson_name,
        cl.lesson_type,
        cl.description,
        cl.required_vocabulary,
        cl.required_grammar
      FROM curriculum_lessons cl
      JOIN curriculum_units cu ON cu.id = cl.curriculum_unit_id
      JOIN curriculum_paths cp ON cp.id = cu.curriculum_path_id
      WHERE cp.language = 'spanish'
        AND cp.name = 'Spanish 1 - High School'
      ORDER BY cu.order_index, cl.name
    `);

    // Group by unit
    const units = new Map<number, { name: string; lessons: typeof rows }>();
    for (const r of rows) {
      if (!units.has(r.unit_order)) units.set(r.unit_order, { name: r.unit_name, lessons: [] });
      units.get(r.unit_order)!.lessons.push(r);
    }

    for (const [unitOrder, unit] of [...units.entries()].sort((a,b) => a[0]-b[0])) {
      // Aggregate
      const allVocab: string[] = [];
      const allGrammar: string[] = [];
      for (const l of unit.lessons) {
        allVocab.push(...(l.required_vocabulary || []));
        allGrammar.push(...(l.required_grammar || []));
      }
      const uVocab = [...new Set(allVocab)];
      const uGram = [...new Set(allGrammar)];

      console.log(`\n${'═'.repeat(80)}`);
      console.log(`UNIT ${unitOrder}: ${unit.name}`);
      console.log(`Lessons: ${unit.lessons.length} | Unique Vocab: ${uVocab.length} | Unique Grammar: ${uGram.length}`);
      console.log(`${'─'.repeat(80)}`);

      for (const l of unit.lessons) {
        const vocab = l.required_vocabulary || [];
        const grammar = l.required_grammar || [];
        console.log(`\n  [${l.lesson_type.toUpperCase()}] ${l.lesson_name}`);
        if (l.description) console.log(`  desc: ${l.description.substring(0,120)}...`);
        if (vocab.length) console.log(`  vocab(${vocab.length}): ${vocab.map((v:string) => v.split(' - ')[0].split('(')[0].trim()).join(', ')}`);
        if (grammar.length) grammar.forEach((g:string, i:number) => console.log(`  G${i+1}: ${g}`));
      }

      console.log(`\n  ── ALL GRAMMAR (deduplicated) ──`);
      uGram.forEach((g, i) => console.log(`  ${i+1}. ${g}`));
    }
  } finally { client.release(); await pool.end(); }
}
main().catch(console.error);
