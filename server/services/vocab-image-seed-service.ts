/**
 * Vocab Image Seed Service
 *
 * Pre-generates and caches watercolor vocabulary images for every word in the
 * textbook curriculum, so students never wait for on-demand DALL-E generation.
 *
 * Strategy:
 *   1. Pull all distinct vocab drill words (listen_repeat + translate_speak,
 *      target_text length < 50) for the requested language(s).
 *   2. Run each word through resolveVocabularyImage — which checks the shared
 *      cache first (free, instant) and only calls DALL-E on a true miss.
 *   3. Process 3 words concurrently per batch to stay within rate limits.
 *   4. Report progress via in-memory job map (polled by the admin endpoint).
 */

import { getUserDb, getSharedDb } from '../db';
import { curriculumDrillItems, mediaFiles } from '../../shared/schema';
import { inArray, sql, eq, and, like } from 'drizzle-orm';
import { resolveVocabularyImage } from './vocabulary-image-resolver';

// ── Scene overrides ────────────────────────────────────────────────────────
// Words that DALL-E gets wrong when given just the word.
// Numbers: generic images instead of clear numeral illustrations.
// Days of week: no clear visual concept — use calendar style illustration.
//
// Format: normalizedWord → scene description for DALL-E
const SCENE_OVERRIDES: Record<string, string> = {
  // Spanish numbers
  'uno':        'A single large numeral "1" painted in watercolor on a white card, surrounded by one bright star',
  'dos':        'Two large numeral "2" painted in watercolor on a white card, surrounded by two bright stars',
  'tres':       'A large numeral "3" in watercolor style, surrounded by three colorful dots',
  'cuatro':     'A large numeral "4" in watercolor style, surrounded by four colorful dots',
  'cinco':      'A large numeral "5" in watercolor style, surrounded by five colorful dots',
  'seis':       'A large numeral "6" in watercolor style, surrounded by six colorful dots',
  'siete':      'A large numeral "7" in watercolor style, surrounded by seven colorful dots',
  'ocho':       'A large numeral "8" in watercolor style, surrounded by eight colorful dots',
  'nueve':      'A large numeral "9" in watercolor style, surrounded by nine colorful dots',
  'diez':       'A large numeral "10" in bold watercolor, surrounded by ten small stars',
  'once':       'A large numeral "11" in bold watercolor, surrounded by eleven small stars',
  'doce':       'A large numeral "12" in bold watercolor, surrounded by twelve small stars',
  'trece':      'A large numeral "13" in bold watercolor style',
  'catorce':    'A large numeral "14" in bold watercolor style',
  'quince':     'A large numeral "15" in bold watercolor style',
  'dieciséis':  'A large numeral "16" in bold watercolor style',
  'diecisiete': 'A large numeral "17" in bold watercolor style',
  'dieciocho':  'A large numeral "18" in bold watercolor style',
  'diecinueve': 'A large numeral "19" in bold watercolor style',
  'veinte':     'A large numeral "20" in bold watercolor style, with twenty small dots',
  // French numbers
  'un':    'A single large numeral "1" in watercolor style on a clean card',
  'deux':  'A large numeral "2" in watercolor style',
  'trois': 'A large numeral "3" in watercolor style',
  'quatre':'A large numeral "4" in watercolor style',
  'cinq':  'A large numeral "5" in watercolor style',
  'six':   'A large numeral "6" in watercolor style',
  'sept':  'A large numeral "7" in watercolor style',
  'huit':  'A large numeral "8" in watercolor style',
  'neuf':  'A large numeral "9" in watercolor style',
  'dix':   'A large numeral "10" in bold watercolor style',
  'onze':  'A large numeral "11" in bold watercolor style',
  'douze': 'A large numeral "12" in bold watercolor style',
  // German numbers (normalizeForOverride strips ü→u, ö→o, ä→a so we key on the stripped form)
  'eins':       'A large numeral "1" in bold watercolor style',
  'zwei':       'A large numeral "2" in bold watercolor style',
  'drei':       'A large numeral "3" in bold watercolor style',
  'vier':       'A large numeral "4" in bold watercolor style',
  'funf':       'A large numeral "5" in bold watercolor style',       // fünf stripped
  'sechs':      'A large numeral "6" in bold watercolor style',
  'sieben':     'A large numeral "7" in bold watercolor style',
  'acht':       'A large numeral "8" in bold watercolor style',
  'neun':       'A large numeral "9" in bold watercolor style',
  'zehn':       'A large numeral "10" in bold watercolor style',
  'elf':        'A large numeral "11" in bold watercolor style',
  'zwolf':      'A large numeral "12" in bold watercolor style',      // zwölf stripped
  'dreizehn':   'A large numeral "13" in bold watercolor style',
  'vierzehn':   'A large numeral "14" in bold watercolor style',
  'funfzehn':   'A large numeral "15" in bold watercolor style',
  'sechzehn':   'A large numeral "16" in bold watercolor style',
  'siebzehn':   'A large numeral "17" in bold watercolor style',
  'achtzehn':   'A large numeral "18" in bold watercolor style',
  'neunzehn':   'A large numeral "19" in bold watercolor style',
  'zwanzig':    'A large numeral "20" in bold watercolor style',
  // Italian numbers (uno/sei/dieci shared with Spanish — same override works for both)
  'due':         'A large numeral "2" in watercolor style',
  'tre':         'A large numeral "3" in watercolor style',
  'quattro':     'A large numeral "4" in watercolor style',
  'sette':       'A large numeral "7" in watercolor style',
  'otto':        'A large numeral "8" in watercolor style',
  'nove':        'A large numeral "9" in watercolor style',
  'undici':      'A large numeral "11" in bold watercolor style',
  'dodici':      'A large numeral "12" in bold watercolor style',
  'tredici':     'A large numeral "13" in bold watercolor style',
  'quattordici': 'A large numeral "14" in bold watercolor style',
  'quindici':    'A large numeral "15" in bold watercolor style',
  'sedici':      'A large numeral "16" in bold watercolor style',
  'diciassette': 'A large numeral "17" in bold watercolor style',
  'diciotto':    'A large numeral "18" in bold watercolor style',
  'diciannove':  'A large numeral "19" in bold watercolor style',
  'venti':       'A large numeral "20" in bold watercolor style',
  // Portuguese numbers (um, dois, etc.)
  'um':     'A single large numeral "1" in watercolor style on a clean card',
  'dois':   'A large numeral "2" in watercolor style',
  // tres / quatro / cinco / seis / sete / oito / nove already covered by ES/IT entries above
  'sete':   'A large numeral "7" in watercolor style',
  'oito':   'A large numeral "8" in watercolor style',
  'dez':    'A large numeral "10" in bold watercolor style',
  // Japanese numbers — kanji forms (most common in curriculum target_text)
  '一':  'A large numeral "1" in bold watercolor style with the kanji 一 beside it',
  '二':  'A large numeral "2" in bold watercolor style with the kanji 二 beside it',
  '三':  'A large numeral "3" in bold watercolor style with the kanji 三 beside it',
  '四':  'A large numeral "4" in bold watercolor style with the kanji 四 beside it',
  '五':  'A large numeral "5" in bold watercolor style with the kanji 五 beside it',
  '六':  'A large numeral "6" in bold watercolor style with the kanji 六 beside it',
  '七':  'A large numeral "7" in bold watercolor style with the kanji 七 beside it',
  '八':  'A large numeral "8" in bold watercolor style with the kanji 八 beside it',
  '九':  'A large numeral "9" in bold watercolor style with the kanji 九 beside it',
  '十':  'A large numeral "10" in bold watercolor style with the kanji 十 beside it',
  // Japanese numbers — hiragana/romaji forms
  'ichi':   'A large numeral "1" in bold watercolor style with the text "いち" beside it',
  'ni':     'A large numeral "2" in bold watercolor style with the text "に" beside it',
  'san':    'A large numeral "3" in bold watercolor style with the text "さん" beside it',
  'shi':    'A large numeral "4" in bold watercolor style with the text "し" beside it',
  'yon':    'A large numeral "4" in bold watercolor style with the text "よん" beside it',
  'go':     'A large numeral "5" in bold watercolor style with the text "ご" beside it',
  'roku':   'A large numeral "6" in bold watercolor style with the text "ろく" beside it',
  'shichi': 'A large numeral "7" in bold watercolor style with the text "しち" beside it',
  'nana':   'A large numeral "7" in bold watercolor style with the text "なな" beside it',
  'hachi':  'A large numeral "8" in bold watercolor style with the text "はち" beside it',
  'kyu':    'A large numeral "9" in bold watercolor style with the text "きゅう" beside it',
  'juu':    'A large numeral "10" in bold watercolor style with the text "じゅう" beside it',
  // Korean numbers — hangul
  '일':   'A large numeral "1" in bold watercolor style with the Korean character 일 beside it',
  '이':   'A large numeral "2" in bold watercolor style with the Korean character 이 beside it',
  '삼':   'A large numeral "3" in bold watercolor style with the Korean character 삼 beside it',
  '사':   'A large numeral "4" in bold watercolor style with the Korean character 사 beside it',
  '오':   'A large numeral "5" in bold watercolor style with the Korean character 오 beside it',
  '육':   'A large numeral "6" in bold watercolor style with the Korean character 육 beside it',
  '칠':   'A large numeral "7" in bold watercolor style with the Korean character 칠 beside it',
  '팔':   'A large numeral "8" in bold watercolor style with the Korean character 팔 beside it',
  '구':   'A large numeral "9" in bold watercolor style with the Korean character 구 beside it',
  '십':   'A large numeral "10" in bold watercolor style with the Korean character 십 beside it',
  // Mandarin numbers — Chinese characters
  // Note: 一/二/三 etc. are shared with Japanese kanji above — same prompts apply
  // Days of week keys below also cover Mandarin since chars are the same
  // Spanish days of the week — calendar-style illustration
  'lunes':     'A small watercolor weekly calendar with Monday highlighted in blue, the word "LUNES" written boldly on it',
  'martes':    'A small watercolor weekly calendar with Tuesday highlighted in red, the word "MARTES" written boldly',
  'miercoles': 'A small watercolor weekly calendar with Wednesday highlighted in green, the word "MIÉRCOLES" written boldly',
  'jueves':    'A small watercolor weekly calendar with Thursday highlighted in orange, the word "JUEVES" written boldly',
  'viernes':   'A small watercolor weekly calendar with Friday highlighted in purple, the word "VIERNES" written boldly',
  'sabado':    'A small watercolor weekly calendar with Saturday highlighted in yellow, the word "SÁBADO" written boldly',
  'domingo':   'A small watercolor weekly calendar with Sunday highlighted in pink, the word "DOMINGO" written boldly',
  // French days of the week
  'lundi':    'A small watercolor weekly calendar with Monday highlighted in blue, the word "LUNDI" written boldly',
  'mardi':    'A small watercolor weekly calendar with Tuesday highlighted in red, the word "MARDI" written boldly',
  'mercredi': 'A small watercolor weekly calendar with Wednesday highlighted in green, the word "MERCREDI" written boldly',
  'jeudi':    'A small watercolor weekly calendar with Thursday highlighted in orange, the word "JEUDI" written boldly',
  'vendredi': 'A small watercolor weekly calendar with Friday highlighted in purple, the word "VENDREDI" written boldly',
  'samedi':   'A small watercolor weekly calendar with Saturday highlighted in yellow, the word "SAMEDI" written boldly',
  'dimanche': 'A small watercolor weekly calendar with Sunday highlighted in pink, the word "DIMANCHE" written boldly',
  // German days of the week
  'montag':     'A small watercolor weekly calendar with Monday highlighted in blue, the word "MONTAG" written boldly',
  'dienstag':   'A small watercolor weekly calendar with Tuesday highlighted in red, the word "DIENSTAG" written boldly',
  'mittwoch':   'A small watercolor weekly calendar with Wednesday highlighted in green, the word "MITTWOCH" written boldly',
  'donnerstag': 'A small watercolor weekly calendar with Thursday highlighted in orange, the word "DONNERSTAG" written boldly',
  'freitag':    'A small watercolor weekly calendar with Friday highlighted in purple, the word "FREITAG" written boldly',
  'samstag':    'A small watercolor weekly calendar with Saturday highlighted in yellow, the word "SAMSTAG" written boldly',
  'sonntag':    'A small watercolor weekly calendar with Sunday highlighted in pink, the word "SONNTAG" written boldly',
  // Italian days of the week
  'lunedi':    'A small watercolor weekly calendar with Monday highlighted in blue, the word "LUNEDÌ" written boldly',
  'martedi':   'A small watercolor weekly calendar with Tuesday highlighted in red, the word "MARTEDÌ" written boldly',
  'mercoledi': 'A small watercolor weekly calendar with Wednesday highlighted in green, the word "MERCOLEDÌ" written boldly',
  'giovedi':   'A small watercolor weekly calendar with Thursday highlighted in orange, the word "GIOVEDÌ" written boldly',
  'venerdi':   'A small watercolor weekly calendar with Friday highlighted in purple, the word "VENERDÌ" written boldly',
  'sabato':    'A small watercolor weekly calendar with Saturday highlighted in yellow, the word "SABATO" written boldly',
  'domenica':  'A small watercolor weekly calendar with Sunday highlighted in pink, the word "DOMENICA" written boldly',
  // Portuguese days of the week
  'segunda-feira': 'A small watercolor weekly calendar with Monday highlighted in blue, the word "SEGUNDA" written boldly',
  'terca-feira':   'A small watercolor weekly calendar with Tuesday highlighted in red, the word "TERÇA" written boldly',
  'quarta-feira':  'A small watercolor weekly calendar with Wednesday highlighted in green, the word "QUARTA" written boldly',
  'quinta-feira':  'A small watercolor weekly calendar with Thursday highlighted in orange, the word "QUINTA" written boldly',
  'sexta-feira':   'A small watercolor weekly calendar with Friday highlighted in purple, the word "SEXTA" written boldly',
  // sábado / domingo already covered by Spanish entries above
  // Japanese days of the week — kanji
  '月曜日': 'A small watercolor weekly calendar with Monday highlighted in blue, the kanji 月 written boldly on it',
  '火曜日': 'A small watercolor weekly calendar with Tuesday highlighted in red, the kanji 火 written boldly',
  '水曜日': 'A small watercolor weekly calendar with Wednesday highlighted in green, the kanji 水 written boldly',
  '木曜日': 'A small watercolor weekly calendar with Thursday highlighted in orange, the kanji 木 written boldly',
  '金曜日': 'A small watercolor weekly calendar with Friday highlighted in purple, the kanji 金 written boldly',
  '土曜日': 'A small watercolor weekly calendar with Saturday highlighted in yellow, the kanji 土 written boldly',
  '日曜日': 'A small watercolor weekly calendar with Sunday highlighted in pink, the kanji 日 written boldly',
  // Korean days of the week — hangul
  '월요일': 'A small watercolor weekly calendar with Monday highlighted in blue, the Korean text 월요일 written boldly',
  '화요일': 'A small watercolor weekly calendar with Tuesday highlighted in red, the Korean text 화요일 written boldly',
  '수요일': 'A small watercolor weekly calendar with Wednesday highlighted in green, the Korean text 수요일 written boldly',
  '목요일': 'A small watercolor weekly calendar with Thursday highlighted in orange, the Korean text 목요일 written boldly',
  '금요일': 'A small watercolor weekly calendar with Friday highlighted in purple, the Korean text 금요일 written boldly',
  '토요일': 'A small watercolor weekly calendar with Saturday highlighted in yellow, the Korean text 토요일 written boldly',
  '일요일': 'A small watercolor weekly calendar with Sunday highlighted in pink, the Korean text 일요일 written boldly',
  // Mandarin days of the week — Chinese characters
  '星期一': 'A small watercolor weekly calendar with Monday highlighted in blue, the Chinese characters 星期一 written boldly',
  '星期二': 'A small watercolor weekly calendar with Tuesday highlighted in red, the Chinese characters 星期二 written boldly',
  '星期三': 'A small watercolor weekly calendar with Wednesday highlighted in green, the Chinese characters 星期三 written boldly',
  '星期四': 'A small watercolor weekly calendar with Thursday highlighted in orange, the Chinese characters 星期四 written boldly',
  '星期五': 'A small watercolor weekly calendar with Friday highlighted in purple, the Chinese characters 星期五 written boldly',
  '星期六': 'A small watercolor weekly calendar with Saturday highlighted in yellow, the Chinese characters 星期六 written boldly',
  '星期天': 'A small watercolor weekly calendar with Sunday highlighted in pink, the Chinese characters 星期天 written boldly',
  '星期日': 'A small watercolor weekly calendar with Sunday highlighted in pink, the Chinese characters 星期日 written boldly',
  // Alternate Mandarin day forms (周X)
  '周一': 'A small watercolor weekly calendar with Monday highlighted in blue, the Chinese characters 周一 written boldly',
  '周二': 'A small watercolor weekly calendar with Tuesday highlighted in red, the Chinese characters 周二 written boldly',
  '周三': 'A small watercolor weekly calendar with Wednesday highlighted in green, the Chinese characters 周三 written boldly',
  '周四': 'A small watercolor weekly calendar with Thursday highlighted in orange, the Chinese characters 周四 written boldly',
  '周五': 'A small watercolor weekly calendar with Friday highlighted in purple, the Chinese characters 周五 written boldly',
  '周六': 'A small watercolor weekly calendar with Saturday highlighted in yellow, the Chinese characters 周六 written boldly',
  '周日': 'A small watercolor weekly calendar with Sunday highlighted in pink, the Chinese characters 周日 written boldly',
};

/**
 * Normalize a word for SCENE_OVERRIDES lookup:
 * lowercase + remove accent marks.
 */
function normalizeForOverride(word: string): string {
  return word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/**
 * Normalize a word to its cache key form, matching the logic in vocabulary-image-resolver.ts.
 * Format: vocab_{language}_{normalizedWord}
 */
function toCacheKey(language: string, word: string): string {
  const normalized = word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `vocab_${language}_${normalized}`;
}

/**
 * Force-delete cached vocab images that match a list of exact cache keys.
 * Used to bust stale number/day images before re-seeding with correct prompts.
 */
export async function bustVocabImageCache(cacheKeys: string[]): Promise<number> {
  if (cacheKeys.length === 0) return 0;
  const db = getSharedDb();
  let deleted = 0;
  for (const key of cacheKeys) {
    const result = await db.delete(mediaFiles).where(eq(mediaFiles.searchQuery, key));
    deleted += (result as any).rowCount ?? 0;
  }
  console.log(`[VocabBust] Deleted ${deleted} cached images from ${cacheKeys.length} keys`);
  return deleted;
}

// ── Numbers/Days cache keys (per language) ─────────────────────────────────
// Generated using the same normalisation as vocabulary-image-resolver.ts.
// Exported so the fix-numbers-days admin route can bust them before re-seeding.
const NUMBERS_DAYS_WORDS: Record<string, string[]> = {
  spanish: [
    'uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez',
    'once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve','veinte',
    'lunes','martes','miércoles','jueves','viernes','sábado','domingo',
  ],
  french: [
    'un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze',
    'lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche',
  ],
  german: [
    'eins','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn',
    'elf','zwölf','dreizehn','vierzehn','fünfzehn','sechzehn','siebzehn','achtzehn','neunzehn','zwanzig',
    'Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag',
  ],
  italian: [
    'uno','due','tre','quattro','cinque','sei','sette','otto','nove','dieci',
    'undici','dodici','tredici','quattordici','quindici','sedici','diciassette','diciotto','diciannove','venti',
    'lunedì','martedì','mercoledì','giovedì','venerdì','sabato','domenica',
  ],
  portuguese: [
    'um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze',
    'segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado','domingo',
  ],
  // Japanese, Korean, Mandarin: CJK characters are stripped by the normalizer, so romaji/transliterated
  // forms are included here for any curriculum that uses them. CJK-script words are covered by
  // SCENE_OVERRIDES (which uses normalizeForOverride that preserves CJK) but can't be cache-busted
  // via toCacheKey (which strips CJK). That's acceptable — stale CJK images are rare.
  japanese: [
    'ichi','ni','san','shi','go','roku','shichi','hachi','kyu','juu',
  ],
};

export const NUMBERS_DAYS_CACHE_KEYS: Record<string, string[]> = Object.fromEntries(
  Object.entries(NUMBERS_DAYS_WORDS).map(([lang, words]) => [
    lang,
    words.map(w => toCacheKey(lang, w)),
  ])
);

// ── Types ──────────────────────────────────────────────────────────────────

export interface VocabSeedProgress {
  language: string;
  status: 'running' | 'complete' | 'error';
  total: number;
  processed: number;
  cached: number;    // already had an image (cache hit)
  generated: number; // newly generated via DALL-E
  skipped: number;   // placeholder / error
  errors: string[];
  currentWord: string;
  startedAt: string;
  finishedAt?: string;
}

export const vocabSeedJobs = new Map<string, VocabSeedProgress>();

// ── Helpers ────────────────────────────────────────────────────────────────

async function fetchTextbookVocab(
  language: string,
): Promise<Array<{ word: string; prompt: string }>> {
  const db = getUserDb();

  // Map UI language names to targetLanguage column values
  const langMap: Record<string, string> = {
    spanish: 'spanish',
    french: 'french',
    german: 'german',
    portuguese: 'portuguese',
    italian: 'italian',
    english: 'english',
    mandarin: 'mandarin',
    japanese: 'japanese',
    korean: 'korean',
  };
  const dbLang = langMap[language.toLowerCase()] ?? language.toLowerCase();

  const rows = await db.execute(sql`
    SELECT DISTINCT
      TRIM(target_text) AS word,
      TRIM(prompt)      AS prompt
    FROM curriculum_drill_items
    WHERE item_type IN ('listen_repeat', 'translate_speak')
      AND target_language = ${dbLang}
      AND target_text IS NOT NULL
      AND LENGTH(TRIM(target_text)) BETWEEN 1 AND 40
      -- exclude numbered multiple-choice answers ("2. They are ordering...")
      AND TRIM(target_text) !~ '^[0-9]'
      -- exclude full sentences (more than 5 words)
      AND array_length(regexp_split_to_array(TRIM(target_text), '\s+'), 1) <= 5
    ORDER BY word
  `);

  return (rows.rows ?? rows) as Array<{ word: string; prompt: string }>;
}

// ── Main seeder ────────────────────────────────────────────────────────────

export async function seedVocabImages(language: string, jobId: string): Promise<void> {
  const progress: VocabSeedProgress = {
    language,
    status: 'running',
    total: 0,
    processed: 0,
    cached: 0,
    generated: 0,
    skipped: 0,
    errors: [],
    currentWord: '',
    startedAt: new Date().toISOString(),
  };
  vocabSeedJobs.set(jobId, progress);

  try {
    const words = await fetchTextbookVocab(language);
    progress.total = words.length;
    console.log(`[VocabSeed] ${language}: ${words.length} vocab words to process`);

    const BATCH = 3;
    for (let i = 0; i < words.length; i += BATCH) {
      const batch = words.slice(i, i + BATCH);

      await Promise.all(
        batch.map(async ({ word, prompt }) => {
          progress.currentWord = word;
          try {
            // Extract English translation from prompt (strips "Say X in Spanish. Context: ..." patterns)
            const translation = cleanPromptToEnglish(prompt, word);

            // Check for a hand-crafted scene override (numbers, days, etc.)
            const sceneOverride = SCENE_OVERRIDES[normalizeForOverride(word)];

            const result = await resolveVocabularyImage({
              word,
              language,
              description: word,
              translation: translation !== word ? translation : undefined,
              scene: sceneOverride,
            });

            if (result.source === 'cache') {
              progress.cached++;
            } else if (result.source === 'ai') {
              progress.generated++;
              console.log(`[VocabSeed] ✓ Generated: "${word}" (${language})`);
            } else {
              progress.skipped++;
            }
          } catch (err: any) {
            progress.skipped++;
            progress.errors.push(`"${word}": ${err.message}`);
            console.error(`[VocabSeed] ✗ Failed: "${word}":`, err.message);
          }
          progress.processed++;
        }),
      );

      // Brief pause between batches to avoid overwhelming DALL-E
      if (i + BATCH < words.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    progress.status = 'complete';
    progress.finishedAt = new Date().toISOString();
    console.log(
      `[VocabSeed] ✓ ${language} complete — ` +
      `${progress.cached} cached, ${progress.generated} generated, ${progress.skipped} skipped`,
    );
  } catch (err: any) {
    progress.status = 'error';
    progress.errors.push(err.message);
    progress.finishedAt = new Date().toISOString();
    console.error(`[VocabSeed] Fatal error for ${language}:`, err.message);
  }
}

// ── Bulk seeder (all languages) ────────────────────────────────────────────

export interface BulkVocabSeedProgress {
  status: 'running' | 'complete' | 'error';
  languages: string[];
  current: string;
  completed: string[];
  errors: string[];
  startedAt: string;
  finishedAt?: string;
}

export const bulkVocabSeedJobs = new Map<string, BulkVocabSeedProgress>();

const ALL_LANGUAGES = ['spanish', 'french', 'german', 'portuguese', 'italian', 'english', 'mandarin', 'japanese', 'korean'];

export async function seedAllVocabImages(jobId: string, languages?: string[]): Promise<void> {
  const langs = languages ?? ALL_LANGUAGES;

  const bulk: BulkVocabSeedProgress = {
    status: 'running',
    languages: langs,
    current: '',
    completed: [],
    errors: [],
    startedAt: new Date().toISOString(),
  };
  bulkVocabSeedJobs.set(jobId, bulk);

  try {
    for (const lang of langs) {
      bulk.current = lang;
      const subJobId = `${jobId}-${lang}`;
      try {
        await seedVocabImages(lang, subJobId);
        bulk.completed.push(lang);
      } catch (err: any) {
        bulk.errors.push(`${lang}: ${err.message}`);
        console.error(`[BulkVocabSeed] Error for ${lang}:`, err.message);
      }
    }

    bulk.status = 'complete';
    bulk.finishedAt = new Date().toISOString();
    console.log(`[BulkVocabSeed] All languages complete`);
  } catch (err: any) {
    bulk.status = 'error';
    bulk.errors.push(err.message);
    bulk.finishedAt = new Date().toISOString();
  }
}

// ── Prompt cleaner ─────────────────────────────────────────────────────────

function cleanPromptToEnglish(prompt: string, word: string): string {
  if (!prompt) return word;
  return prompt
    .replace(/^Say\s+"([^"]+)"\s+in\s+\w+\.\s*Context:\s*/i, '$1 — ')
    .replace(/^Say\s+"([^"]+)"\s+in\s+\w+\.?\s*/i, '$1')
    .replace(/^Translate[:\s]+/i, '')
    .trim() || word;
}
