/**
 * Targeted fix for 2 stale Spanish 1 lessons.
 * Deletes stale translate_speak/fill_blank drill items,
 * then regenerates them from textbook_lesson_content.vocabulary_list.
 */
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

const STALE_LESSONS = [
  { id: '169ad5dd-42de-4b24-a3f6-4224a9d190fe', name: 'Ch1 — AI-Generated Practice: Active Production' },
  { id: '8c61130d-cb2f-4885-82fd-c13fa969b8c8', name: 'Ch20 — New Words: Colors & Sizes' },
];

const pool = new Pool({ connectionString: process.env.NEON_SHARED_DATABASE_URL, ssl: { rejectUnauthorized: false } });

function normalizeTarget(s: string): string {
  return (s || '').toLowerCase().trim().replace(/[^\w\s\u00C0-\u024F]/g, '');
}

async function main() {
  const client = await pool.connect();
  try {
    for (const lesson of STALE_LESSONS) {
      console.log(`\n═══ Fixing: "${lesson.name}" ═══`);

      // 1. Load vocabulary_list from textbook_lesson_content
      const { rows: tlc } = await client.query(
        `SELECT vocabulary_list, key_phrases_for_chat FROM textbook_lesson_content WHERE lesson_id = $1`,
        [lesson.id]
      );
      if (!tlc.length) { console.log('  ⚠ No textbook_lesson_content found — skip'); continue; }
      
      const vocabList: Array<{word: string; translation: string; partOfSpeech?: string}> = tlc[0].vocabulary_list || [];
      const phraseList: Array<{phrase: string; translation: string}> = tlc[0].key_phrases_for_chat || [];
      console.log(`  textbook_lesson_content: ${vocabList.length} vocab, ${phraseList.length} phrases`);
      console.log(`  Sample vocab: ${vocabList.slice(0,4).map(v => v.word).join(', ')}`);

      // 2. Delete stale translate_speak and fill_blank items
      const { rowCount: deleted } = await client.query(
        `DELETE FROM curriculum_drill_items WHERE lesson_id = $1 AND item_type IN ('translate_speak', 'fill_blank')`,
        [lesson.id]
      );
      console.log(`  Deleted ${deleted} stale items`);

      // 3. Get existing listen_repeat items to continue order_index from
      const { rows: existing } = await client.query(
        `SELECT max(order_index) as max_idx FROM curriculum_drill_items WHERE lesson_id = $1`,
        [lesson.id]
      );
      let nextOrder = (parseInt(existing[0]?.max_idx) || 0) + 10;

      // 4. Insert new translate_speak items from vocabulary_list
      const seenTargets = new Set<string>();
      const toInsert: any[] = [];

      for (const entry of vocabList) {
        const word = (entry.word || '').trim();
        const translation = (entry.translation || '').trim();
        if (!word || !translation || word.length > 60) continue;
        const key = normalizeTarget(word);
        if (seenTargets.has(key)) continue;
        seenTargets.add(key);
        toInsert.push({
          id: randomUUID(),
          lesson_id: lesson.id,
          item_type: 'translate_speak',
          order_index: nextOrder,
          prompt: translation,
          target_text: word,
          target_language: 'spanish',
          difficulty: 1,
          tags: ['vocab', 'seeded', entry.partOfSpeech || 'unknown'],
        });
        nextOrder += 10;
      }

      // 5. Insert key phrase items
      for (const entry of phraseList) {
        const phrase = (entry.phrase || '').trim();
        const translation = (entry.translation || '').trim();
        if (!phrase || !translation || phrase.length > 100) continue;
        const key = normalizeTarget(phrase);
        if (seenTargets.has(key)) continue;
        seenTargets.add(key);
        toInsert.push({
          id: randomUUID(),
          lesson_id: lesson.id,
          item_type: 'translate_speak',
          order_index: nextOrder,
          prompt: translation,
          target_text: phrase,
          target_language: 'spanish',
          difficulty: 1,
          tags: ['phrase', 'seeded'],
        });
        nextOrder += 10;
      }

      // 6. Batch insert
      for (const item of toInsert) {
        await client.query(`
          INSERT INTO curriculum_drill_items 
            (id, lesson_id, item_type, order_index, prompt, target_text, target_language, difficulty, tags)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::text[])
        `, [item.id, item.lesson_id, item.item_type, item.order_index, item.prompt, item.target_text, item.target_language, item.difficulty, item.tags]);
      }
      console.log(`  Inserted ${toInsert.length} fresh items`);

      // 7. Verify result
      const { rows: verify } = await client.query(`
        SELECT item_type, count(*) as n FROM curriculum_drill_items 
        WHERE lesson_id = $1 GROUP BY item_type ORDER BY item_type
      `, [lesson.id]);
      console.log('  Final counts:', verify.map(r => `${r.item_type}: ${r.n}`).join(', '));

      const { rows: sampleNew } = await client.query(`
        SELECT target_text FROM curriculum_drill_items 
        WHERE lesson_id = $1 AND item_type = 'translate_speak' 
        ORDER BY order_index LIMIT 8
      `, [lesson.id]);
      console.log('  New translate_speak items:', sampleNew.map(s => `"${s.target_text}"`).join(', '));
    }
    console.log('\n✓ Done');
  } finally { client.release(); await pool.end(); }
}
main().catch(console.error);
