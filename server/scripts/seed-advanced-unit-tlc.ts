/**
 * seed-advanced-unit-tlc.ts
 *
 * Seeds textbook_lesson_content rows for all 20 Spanish 3/4/5 advanced units
 * so Daniela receives vocabulary, reading passages, and key phrases when a
 * student clicks "Practice with Daniela" from any of these units.
 *
 * Run: npx tsx server/scripts/seed-advanced-unit-tlc.ts
 */

import { ADVANCED_UNITS, type AdvancedUnitContent } from '../../shared/advanced-unit-content';

async function run() {
  const { getUserDb } = await import('../db');
  const { sql } = await import('drizzle-orm');
  const db = getUserDb();

  console.log(`[AdvancedUnitTLC] Seeding ${ADVANCED_UNITS.length} advanced unit rows...`);

  let inserted = 0;
  let skipped = 0;

  for (const unit of ADVANCED_UNITS) {
    const vocabularyList = unit.vocabulary.map(v => ({
      word: v.spanish,
      translation: v.english,
      partOfSpeech: v.partOfSpeech,
      exampleSentences: v.example
        ? [{ target: v.example, translation: v.exampleTranslation ?? '' }]
        : [],
    }));

    const keyPhrasesForChat = unit.vocabulary
      .filter(v => v.example)
      .map(v => ({
        phrase: v.example!,
        translation: v.exampleTranslation ?? '',
        context: `${v.spanish} (${v.english})`,
      }));

    const existingCheck = await db.execute(
      sql`SELECT id FROM textbook_lesson_content WHERE lesson_id = ${unit.unitId} LIMIT 1`
    );

    if (existingCheck.rows.length > 0) {
      await db.execute(sql`
        UPDATE textbook_lesson_content SET
          vocabulary_list      = ${JSON.stringify(vocabularyList)}::jsonb,
          key_phrases_for_chat = ${JSON.stringify(keyPhrasesForChat)}::jsonb,
          cultural_note        = ${unit.culturalNote.body},
          reading_passage      = ${unit.reading.body},
          actfl_level          = ${unit.levelBadge},
          seed_version         = seed_version + 1
        WHERE lesson_id = ${unit.unitId}
      `);
      skipped++;
      console.log(`  [update] ${unit.topicLabel} (${unit.unitId})`);
    } else {
      await db.execute(sql`
        INSERT INTO textbook_lesson_content
          (lesson_id, language, actfl_level, vocabulary_list, key_phrases_for_chat,
           cultural_note, reading_passage, seed_version, seeded_at)
        VALUES
          (${unit.unitId}, 'spanish', ${unit.levelBadge},
           ${JSON.stringify(vocabularyList)}::jsonb,
           ${JSON.stringify(keyPhrasesForChat)}::jsonb,
           ${unit.culturalNote.body},
           ${unit.reading.body},
           1, NOW())
      `);
      inserted++;
      console.log(`  [insert] ${unit.topicLabel} (${unit.unitId})`);
    }
  }

  console.log(`\n[AdvancedUnitTLC] Done. Inserted: ${inserted}, Updated: ${skipped}`);
  process.exit(0);
}

run().catch(err => {
  console.error('[AdvancedUnitTLC] Fatal error:', err.message ?? err);
  console.error(err.stack);
  process.exit(1);
});
