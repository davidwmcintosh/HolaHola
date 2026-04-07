/**
 * seed-character-greetings.ts
 * One-time script: delete corrupted Hebrew DB entries and pre-generate
 * Korean, Mandarin, Hebrew greeting images using existing SCENE_OVERRIDEs.
 * Also fills missing French (merci beaucoup) and Japanese (ありがとう) slots.
 *
 * Run: npx tsx server/scripts/seed-character-greetings.ts
 * Delete after use.
 */

import { getUserDb } from '../db';
import { sql } from 'drizzle-orm';
import { resolveVocabularyImage } from '../services/vocabulary-image-resolver';
import { toCacheKey, normalizeForOverride, SCENE_OVERRIDES } from '../services/vocab-image-seed-service';

const BATCH_PAUSE_MS = 1200; // avoid hammering DALL-E

// Words to generate per language — script form first (canonical key), then romanized aliases
// Script forms will be the primary cache entry; romanized entries get their own image OR
// will resolve via the existing script cache once generated.
const SEED_WORDS: Record<string, string[]> = {
  korean: [
    // Script forms
    '안녕하세요', '안녕', '안녕히 가세요', '안녕히 계세요',
    '감사합니다', '고맙습니다', '고마워요',
    '죄송합니다', '미안해요', '괜찮아요', '천만에요',
    '좋은 아침이에요', '잘 자요',
    '어떻게 지내세요', '잘 지내요 감사합니다',
    '내일 봐요', '또 만나요', '만나서 반갑습니다',
    // Romanized aliases (same character, same image style)
    'annyeonghaseyo', 'annyeong', 'annyeonghi gaseyo', 'annyeonghi gyeseyo',
    'gamsahamnida', 'gomawoyo', 'joesonghamnida', 'mianhaeyo',
    'gwaenchanayo', 'cheonmaneyo',
  ],
  mandarin: [
    // Script forms
    '你好', '再见', '谢谢', '谢谢你', '不客气',
    '对不起', '没关系', '你好吗', '很好',
    '下午好', '回头见', '我很好 谢谢', '明天见',
    // Romanized aliases
    'ni hao', 'zai jian', 'xie xie', 'bu ke qi', 'dui bu qi',
    'mei guan xi', 'ni hao ma', 'hen hao',
    'zao shang hao', 'wan shang hao', 'wan an',
    'wo hen hao xie xie', 'wo hen hao',
  ],
  hebrew: [
    // Script forms
    'שלום', 'בוקר טוב', 'ערב טוב', 'לילה טוב',
    'להתראות', 'תודה', 'תודה רבה', 'בבקשה',
    'סליחה', 'מה שלומך', 'מצוין',
    // Romanized aliases
    'shalom', 'boker tov', 'erev tov', 'layla tov', 'lehitraot',
    'toda', 'toda raba', 'bevakasha', 'slicha', 'ma shlomcha', 'metzuyan',
  ],
  french: [
    'merci beaucoup',
  ],
  japanese: [
    'ありがとう', 'ありがとうございます',
    'arigatou', 'arigatou gozaimasu',
  ],
};

// Corrupted Hebrew entries to remove before seeding
const CORRUPTED_KEYS = [
  'vocab_hebrew_lunes',
  'vocab_hebrew_martes',
  'vocab_hebrew_miercoles',
  'vocab_hebrew_jueves',
  'vocab_hebrew_viernes',
  'vocab_hebrew_sabado',
  'vocab_hebrew_domingo',
];

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const db = getUserDb();
  let generated = 0, cached = 0, skipped = 0, errors = 0;

  // ── 1. Delete corrupted Hebrew entries ──────────────────────────────────────
  console.log('\n── Step 1: Delete corrupted Hebrew entries ─────────────────────');
  for (const key of CORRUPTED_KEYS) {
    const r = await db.execute(
      sql`DELETE FROM media_files WHERE search_query = ${key} RETURNING id`
    );
    const deleted = (r.rows as any[]).length;
    console.log(`  ${deleted > 0 ? '🗑️  Deleted' : '⏭️  Not found'}: ${key}`);
  }

  // ── 2. Generate missing images ───────────────────────────────────────────────
  console.log('\n── Step 2: Generate character greeting images ──────────────────');

  for (const [language, words] of Object.entries(SEED_WORDS)) {
    console.log(`\n  [${language.toUpperCase()}] ${words.length} words`);

    for (const word of words) {
      const cacheKey = toCacheKey(language, word);

      // Skip if already cached
      const existing = await db.execute(
        sql`SELECT id FROM media_files WHERE search_query = ${cacheKey} LIMIT 1`
      );
      if ((existing.rows as any[]).length > 0) {
        cached++;
        console.log(`  ✅ Cached   : ${cacheKey}`);
        continue;
      }

      // Find SCENE_OVERRIDE
      const wordKey = normalizeForOverride(word);
      const sceneOverride = (SCENE_OVERRIDES as Record<string, string>)[`${language}:${wordKey}`]
                         ?? (SCENE_OVERRIDES as Record<string, string>)[wordKey];

      if (!sceneOverride) {
        skipped++;
        console.log(`  ⏭️  No override: ${word} (${language})`);
        continue;
      }

      try {
        console.log(`  🎨 Generating: ${word} (${language}) …`);
        const result = await resolveVocabularyImage({
          word,
          language,
          description: word,
          scene: sceneOverride,
        });

        if (result.source === 'ai') {
          generated++;
          console.log(`  ✓ Generated : ${cacheKey}`);
        } else if (result.source === 'cache') {
          cached++;
          console.log(`  ✅ Cached    : ${cacheKey}`);
        } else {
          skipped++;
          console.log(`  ⏭️  Skipped   : ${cacheKey} (source=${result.source})`);
        }
      } catch (err: any) {
        errors++;
        console.error(`  ✗ Error     : ${word} — ${err.message}`);
      }

      await sleep(BATCH_PAUSE_MS);
    }
  }

  console.log(`\n── Done ───────────────────────────────────────────────────────`);
  console.log(`   Generated: ${generated}  |  Cached: ${cached}  |  Skipped: ${skipped}  |  Errors: ${errors}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
