import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.NEON_SHARED_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    // Get all Spanish 1 lessons with their vocab and drill items
    const { rows: lessons } = await client.query(`
      SELECT cl.id, cl.name, cu.order_index as chapter_num, cu.name as chapter_name,
             cl.required_vocabulary
      FROM curriculum_lessons cl
      JOIN curriculum_units cu ON cu.id = cl.curriculum_unit_id
      JOIN curriculum_paths cp ON cp.id = cu.curriculum_path_id
      WHERE cp.name = 'Spanish 1 - High School' AND cu.name NOT LIKE '[ARCHIVED]%'
      ORDER BY cu.order_index, cl.order_index
    `);

    const staleIds: string[] = [];

    for (const lesson of lessons) {
      const { rows: drills } = await client.query(`
        SELECT target_text FROM curriculum_drill_items WHERE lesson_id = $1 LIMIT 50
      `, [lesson.id]);

      if (drills.length === 0) continue;

      // Build a set of normalized vocab words from required_vocabulary
      const vocab: string[] = Array.isArray(lesson.required_vocabulary) ? lesson.required_vocabulary : [];
      const vocabRoots = new Set(
        vocab.flatMap(v => v.toLowerCase().split(/[\s\-–\/,;:]+/).filter(w => w.length > 2))
      );

      // Check what fraction of drills contain words not in vocab
      let mismatch = 0;
      for (const d of drills) {
        const txt = (d.target_text || '').toLowerCase();
        const words = txt.split(/[\s.,?!¿¡]+/).filter((w: string) => w.length > 2);
        const anyMatch = words.some((w: string) => vocabRoots.has(w));
        if (!anyMatch && words.length > 0) mismatch++;
      }

      const ratio = drills.length > 0 ? mismatch / drills.length : 0;
      if (ratio > 0.5) { // More than 50% of drills don't match required vocab
        console.log(`⚠  Ch${String(lesson.chapter_num).padStart(2)} | ${lesson.chapter_name.padEnd(30)} | "${lesson.name.slice(0, 35)}" — ${mismatch}/${drills.length} drills mismatched`);
        staleIds.push(lesson.id);
      }
    }

    if (staleIds.length === 0) {
      console.log('✓ No highly-mismatched lessons found (>50% mismatch threshold)');
    } else {
      console.log(`\nTotal stale lessons: ${staleIds.length}`);
      console.log('IDs:', staleIds);
    }
  } finally { client.release(); await pool.end(); }
}
main().catch(console.error);
