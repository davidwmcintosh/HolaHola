/**
 * Deletes stale curriculum_drill_items for two mismatched Spanish 1 lessons
 * then reseeds them from textbook_lesson_content (which is already correct).
 */
import { Pool } from 'pg';
import { seedVocabDrillItems as seedVocabDrillItemsForLesson } from '../services/vocab-drill-seed-service';

const STALE_LESSONS = [
  { id: '169ad5dd-42de-4b24-a3f6-4224a9d190fe', name: 'Ch1 — AI-Generated Practice: Active Production' },
  { id: '8c61130d-cb2f-4885-82fd-c13fa969b8c8', name: 'Ch20 — New Words: Colors & Sizes' },
];

const pool = new Pool({ connectionString: process.env.NEON_SHARED_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    for (const lesson of STALE_LESSONS) {
      console.log(`\nFixing: "${lesson.name}"`);

      // Count existing drill items before delete
      const { rows: before } = await client.query(
        `SELECT count(*) as n FROM curriculum_drill_items WHERE lesson_id = $1`, [lesson.id]
      );
      console.log(`  Before: ${before[0].n} drill items`);

      // Delete ONLY translate_speak and fill_blank drills (leave listen_repeat intact)
      const { rowCount } = await client.query(`
        DELETE FROM curriculum_drill_items 
        WHERE lesson_id = $1 AND item_type IN ('translate_speak', 'fill_blank')
      `, [lesson.id]);
      console.log(`  Deleted: ${rowCount} stale translate_speak/fill_blank items`);

      const { rows: after } = await client.query(
        `SELECT count(*) as n FROM curriculum_drill_items WHERE lesson_id = $1`, [lesson.id]
      );
      console.log(`  Remaining: ${after[0].n} items (listen_repeat preserved)`);
    }

    console.log('\n--- Reseeding from textbook_lesson_content ---');
    // Use the vocab drill seed service to regenerate
    const result = await (seedVocabDrillItemsForLesson as any)(STALE_LESSONS[0].id, 'spanish');
    console.log(`Ch1 reseed result:`, result);

    const result2 = await (seedVocabDrillItemsForLesson as any)(STALE_LESSONS[1].id, 'spanish');
    console.log(`Ch20 reseed result:`, result2);

    // Verify
    for (const lesson of STALE_LESSONS) {
      const { rows } = await client.query(`
        SELECT item_type, count(*) as n FROM curriculum_drill_items 
        WHERE lesson_id = $1 GROUP BY item_type
      `, [lesson.id]);
      console.log(`\n${lesson.name}:`);
      rows.forEach(r => console.log(`  ${r.item_type}: ${r.n}`));
      
      // Sample translate_speak items
      const { rows: samples } = await client.query(`
        SELECT target_text FROM curriculum_drill_items 
        WHERE lesson_id = $1 AND item_type = 'translate_speak' LIMIT 6
      `, [lesson.id]);
      samples.forEach(s => console.log(`    "${s.target_text}"`));
    }
  } finally { client.release(); await pool.end(); }
}
main().catch(console.error);
