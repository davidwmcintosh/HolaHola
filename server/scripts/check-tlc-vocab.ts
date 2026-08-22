import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.NEON_SHARED_DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function main() {
  const client = await pool.connect();
  try {
    const lessonIds = [
      '169ad5dd-42de-4b24-a3f6-4224a9d190fe', // Ch1 greetings active production
      '8c61130d-cb2f-4885-82fd-c13fa969b8c8',  // Ch20 clothing colors/sizes
    ];
    
    for (const id of lessonIds) {
      // Check required_vocabulary (current)
      const { rows: lesson } = await client.query(`
        SELECT cl.name, cl.required_vocabulary
        FROM curriculum_lessons cl WHERE cl.id = $1
      `, [id]);
      console.log(`\nLesson: "${lesson[0]?.name}"`);
      console.log(`  required_vocabulary: ${lesson[0]?.required_vocabulary?.slice(0, 6).join(', ')}`);
      
      // Check textbook_lesson_content vocabulary_list (may be stale)
      const { rows: tlc } = await client.query(`
        SELECT vocabulary_list FROM textbook_lesson_content WHERE lesson_id = $1
      `, [id]);
      if (tlc.length > 0) {
        const vocabList = tlc[0].vocabulary_list;
        const sample = Array.isArray(vocabList) ? vocabList.slice(0, 5) : [];
        console.log(`  textbook_lesson_content.vocabulary_list (${vocabList?.length} items): ${JSON.stringify(sample).slice(0, 200)}`);
      } else {
        console.log(`  textbook_lesson_content: NOT FOUND`);
      }
    }
  } finally { client.release(); await pool.end(); }
}
main().catch(console.error);
