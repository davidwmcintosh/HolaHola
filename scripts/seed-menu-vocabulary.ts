/**
 * seed-menu-vocabulary.ts
 *
 * Extracts all unique food items from the authored menu data files and upserts
 * them into the visual_assets table as vocabulary words.
 *
 * Run: npx tsx scripts/seed-menu-vocabulary.ts
 */

import { neon } from '@neondatabase/serverless';

import { restaurantMenus, localFestivalMenus } from '../server/data/language-menus-restaurant-festival';
import { coffeeShopMenus, groceryStoreMenus } from '../server/data/language-menus-cafe-grocery';
import { breakfastMenus, lunchMenus } from '../server/data/language-menus-restaurant-mealtime';

const DB_URL = process.env.NEON_SHARED_DATABASE_URL;
if (!DB_URL) throw new Error('NEON_SHARED_DATABASE_URL not set');

const sql = neon(DB_URL);

// ── Slug helper ──────────────────────────────────────────────────────────────
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

// Language → column name mapping
const LANG_COLS: Record<string, string> = {
  spanish:    'spanish_terms',
  french:     'french_terms',
  german:     'german_terms',
  italian:    'italian_terms',
  portuguese: 'portuguese_terms',
  japanese:   'japanese_terms',
  korean:     'korean_terms',
  mandarin:   'mandarin_terms',
  arabic:     'arabic_terms',
  russian:    'russian_terms',
};

// ── Collect all items from all menus ─────────────────────────────────────────
const itemMap = new Map<string, {
  display_name: string;
  translations: Record<string, Set<string>>;
}>();

function collectMenu(menuRecord: Record<string, Record<string, { sections: any[] }>>) {
  for (const [lang, levelMap] of Object.entries(menuRecord)) {
    if (!LANG_COLS[lang]) continue;
    for (const levelData of Object.values(levelMap)) {
      for (const section of levelData.sections) {
        for (const item of section.items) {
          if (!item.name || !item.name_target) continue;
          const slug = toSlug(item.name);
          if (!slug) continue;

          if (!itemMap.has(slug)) {
            itemMap.set(slug, { display_name: item.name, translations: {} });
          }
          const entry = itemMap.get(slug)!;
          if (!entry.translations[lang]) entry.translations[lang] = new Set<string>();
          entry.translations[lang].add(item.name_target as string);
        }
      }
    }
  }
}

collectMenu(restaurantMenus as any);
collectMenu(localFestivalMenus as any);
collectMenu(coffeeShopMenus as any);
collectMenu(groceryStoreMenus as any);
collectMenu(breakfastMenus as any);
collectMenu(lunchMenus as any);

console.log(`\nCollected ${itemMap.size} unique food items.\n`);

// ── Upsert into visual_assets ─────────────────────────────────────────────────
async function run() {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const [slug, data] of itemMap.entries()) {
    try {
      // Build all translation arrays
      const spanishTerms   = Array.from(data.translations.spanish    || []);
      const frenchTerms    = Array.from(data.translations.french     || []);
      const germanTerms    = Array.from(data.translations.german     || []);
      const italianTerms   = Array.from(data.translations.italian    || []);
      const portugueseTerms = Array.from(data.translations.portuguese || []);
      const japaneseTerms  = Array.from(data.translations.japanese   || []);
      const koreanTerms    = Array.from(data.translations.korean     || []);
      const mandarinTerms  = Array.from(data.translations.mandarin   || []);
      const arabicTerms    = Array.from(data.translations.arabic     || []);
      const russianTerms   = Array.from(data.translations.russian    || []);
      const englishTerms   = [data.display_name];
      const tags           = ['food', 'menu', 'restaurant'];

      await sql`
        INSERT INTO visual_assets (
          name, display_name, object_type, image_url,
          spanish_terms, french_terms, german_terms, italian_terms,
          portuguese_terms, japanese_terms, korean_terms, mandarin_terms,
          arabic_terms, russian_terms, english_terms, tags
        ) VALUES (
          ${slug}, ${data.display_name}, 'food', '',
          ${spanishTerms}, ${frenchTerms}, ${germanTerms}, ${italianTerms},
          ${portugueseTerms}, ${japaneseTerms}, ${koreanTerms}, ${mandarinTerms},
          ${arabicTerms}, ${russianTerms}, ${englishTerms}, ${tags}
        )
        ON CONFLICT (name) DO UPDATE SET
          spanish_terms    = CASE WHEN array_length(EXCLUDED.spanish_terms, 1) > 0
                              THEN array(SELECT DISTINCT unnest(visual_assets.spanish_terms || EXCLUDED.spanish_terms))
                              ELSE visual_assets.spanish_terms END,
          french_terms     = CASE WHEN array_length(EXCLUDED.french_terms, 1) > 0
                              THEN array(SELECT DISTINCT unnest(visual_assets.french_terms || EXCLUDED.french_terms))
                              ELSE visual_assets.french_terms END,
          german_terms     = CASE WHEN array_length(EXCLUDED.german_terms, 1) > 0
                              THEN array(SELECT DISTINCT unnest(visual_assets.german_terms || EXCLUDED.german_terms))
                              ELSE visual_assets.german_terms END,
          italian_terms    = CASE WHEN array_length(EXCLUDED.italian_terms, 1) > 0
                              THEN array(SELECT DISTINCT unnest(visual_assets.italian_terms || EXCLUDED.italian_terms))
                              ELSE visual_assets.italian_terms END,
          portuguese_terms = CASE WHEN array_length(EXCLUDED.portuguese_terms, 1) > 0
                              THEN array(SELECT DISTINCT unnest(visual_assets.portuguese_terms || EXCLUDED.portuguese_terms))
                              ELSE visual_assets.portuguese_terms END,
          japanese_terms   = CASE WHEN array_length(EXCLUDED.japanese_terms, 1) > 0
                              THEN array(SELECT DISTINCT unnest(visual_assets.japanese_terms || EXCLUDED.japanese_terms))
                              ELSE visual_assets.japanese_terms END,
          korean_terms     = CASE WHEN array_length(EXCLUDED.korean_terms, 1) > 0
                              THEN array(SELECT DISTINCT unnest(visual_assets.korean_terms || EXCLUDED.korean_terms))
                              ELSE visual_assets.korean_terms END,
          mandarin_terms   = CASE WHEN array_length(EXCLUDED.mandarin_terms, 1) > 0
                              THEN array(SELECT DISTINCT unnest(visual_assets.mandarin_terms || EXCLUDED.mandarin_terms))
                              ELSE visual_assets.mandarin_terms END,
          arabic_terms     = CASE WHEN array_length(EXCLUDED.arabic_terms, 1) > 0
                              THEN array(SELECT DISTINCT unnest(visual_assets.arabic_terms || EXCLUDED.arabic_terms))
                              ELSE visual_assets.arabic_terms END,
          russian_terms    = CASE WHEN array_length(EXCLUDED.russian_terms, 1) > 0
                              THEN array(SELECT DISTINCT unnest(visual_assets.russian_terms || EXCLUDED.russian_terms))
                              ELSE visual_assets.russian_terms END,
          english_terms    = CASE WHEN array_length(EXCLUDED.english_terms, 1) > 0
                              THEN array(SELECT DISTINCT unnest(visual_assets.english_terms || EXCLUDED.english_terms))
                              ELSE visual_assets.english_terms END,
          tags             = array(SELECT DISTINCT unnest(visual_assets.tags || EXCLUDED.tags))
      `;
      inserted++;
    } catch (err: any) {
      console.error(`  ERROR on "${slug}": ${err.message?.slice(0, 100)}`);
      skipped++;
    }
  }

  console.log(`\nDone:`);
  console.log(`  ${inserted} rows inserted/upserted`);
  console.log(`  ${skipped} rows skipped (errors)`);

  // Show a sample
  const sample = await sql`
    SELECT name, display_name, spanish_terms, french_terms, arabic_terms, russian_terms
    FROM visual_assets
    WHERE object_type = 'food'
    ORDER BY created_at DESC
    LIMIT 10
  `;
  console.log(`\nRecent food vocabulary rows:`);
  for (const row of sample) {
    console.log(`  ${(row.name as string).padEnd(30)} ES:${(row.spanish_terms as string[]).length} FR:${(row.french_terms as string[]).length} AR:${(row.arabic_terms as string[]).length} RU:${(row.russian_terms as string[]).length}`);
  }
}

run().catch(console.error);
