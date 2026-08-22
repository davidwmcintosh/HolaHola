import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.NEON_SHARED_DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function main() {
  const client = await pool.connect();
  try {
    // Get chapters 1-4 lessons with their current vocab
    const { rows } = await client.query(`
      SELECT cu.order_index, cu.name as chapter_name, cl.id as lesson_id, cl.name as lesson_name,
             cl.required_vocabulary[1:5] as first_5_vocab,
             array_length(cl.required_vocabulary, 1) as vocab_count,
             CASE WHEN tlc.id IS NOT NULL THEN 'HAS cached content' ELSE 'NO cached content' END as content_status,
             CASE WHEN tlc.id IS NOT NULL 
               THEN (SELECT count(*) FROM jsonb_array_elements(tlc.drills::jsonb) WHERE true)::text
               ELSE '0' END as drill_count
      FROM curriculum_units cu
      JOIN curriculum_lessons cl ON cl.curriculum_unit_id = cu.id
      JOIN curriculum_paths cp ON cp.id = cu.curriculum_path_id
      LEFT JOIN textbook_lesson_content tlc ON tlc.lesson_id = cl.id
      WHERE cp.name = 'Spanish 1 - High School'
        AND cu.name NOT LIKE '[ARCHIVED]%'
        AND cu.order_index BETWEEN 1 AND 5
      ORDER BY cu.order_index, cl.order_index
    `);
    
    for (const r of rows) {
      console.log(`\nCh ${r.order_index} — ${r.chapter_name} | ${r.lesson_name}`);
      console.log(`  Vocab (first 5): ${r.first_5_vocab?.join(', ')} (total: ${r.vocab_count})`);
      console.log(`  ${r.content_status} (${r.drill_count} drills)`);
    }

    // Check if any greetings lesson content has food-related drills
    const { rows: greetingLessons } = await client.query(`
      SELECT cl.id, cl.name FROM curriculum_lessons cl
      JOIN curriculum_units cu ON cu.id = cl.curriculum_unit_id
      JOIN curriculum_paths cp ON cp.id = cu.curriculum_path_id
      WHERE cp.name = 'Spanish 1 - High School'
        AND cu.order_index = 1 AND cu.name NOT LIKE '[ARCHIVED]%'
    `);
    
    for (const lesson of greetingLessons) {
      const { rows: content } = await client.query(`
        SELECT drills::text as drills_sample 
        FROM textbook_lesson_content 
        WHERE lesson_id = $1 LIMIT 1
      `, [lesson.id]);
      
      if (content.length > 0) {
        const drillText = content[0].drills_sample || '';
        const hasFood = drillText.toLowerCase().includes('menu') || drillText.toLowerCase().includes('restaur') || drillText.toLowerCase().includes('comida') || drillText.toLowerCase().includes('por favor');
        console.log(`\nGreetings lesson "${lesson.name}" — food content present: ${hasFood}`);
        if (hasFood) {
          // Show a sample
          try {
            const drills = JSON.parse(drillText);
            const foodDrills = drills.filter((d: any) => {
              const text = (d.targetText || d.target_text || '').toLowerCase();
              return text.includes('menú') || text.includes('mesa') || text.includes('cuenta') || text.includes('por favor');
            });
            console.log(`  Food-related drills found: ${foodDrills.length}`);
            foodDrills.slice(0, 3).forEach((d: any) => console.log(`    - "${d.targetText || d.target_text}"`));
          } catch(e) { console.log('  Could not parse drills JSON'); }
        }
      } else {
        console.log(`\nGreetings lesson "${lesson.name}" — NO cached content`);
      }
    }
  } finally { client.release(); await pool.end(); }
}
main().catch(console.error);
