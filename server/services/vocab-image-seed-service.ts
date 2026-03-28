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
// Shared number card style — same for every numeral, only the digit changes.
// Locked down to prevent DALL-E from adding animals, balloons, stars, decorations, etc.
const NUM = (digit: string) =>
  `Flat graphic design: a single bold numeral "${digit}" centered on a soft cream background. ` +
  `The digit is rendered in deep navy blue with thick, clean rounded strokes, filling most of the frame. ` +
  `Minimal and modern. No animals, no people, no objects, no balloons, no stars, no dots, no decorations, no background scenery. ` +
  `Just the number symbol on a plain cream background. Educational flashcard style.`;

const NUM_CJK = (digit: string, char: string, label: string) =>
  `Flat graphic design: a bold Arabic numeral "${digit}" on the left and the ${label} character "${char}" on the right, ` +
  `both centered together on a soft cream background. Deep navy blue thick strokes, clean and minimal. ` +
  `No animals, no people, no objects, no decorations. Educational flashcard style.`;

const SCENE_OVERRIDES: Record<string, string> = {
  // Spanish numbers (0–20)
  'cero':       NUM('0'),
  'uno':        NUM('1'),
  'dos':        NUM('2'),
  'tres':       NUM('3'),
  'cuatro':     NUM('4'),
  'cinco':      NUM('5'),
  'seis':       NUM('6'),
  'siete':      NUM('7'),
  'ocho':       NUM('8'),
  'nueve':      NUM('9'),
  'diez':       NUM('10'),
  'once':       NUM('11'),
  'doce':       NUM('12'),
  'trece':      NUM('13'),
  'catorce':    NUM('14'),
  'quince':     NUM('15'),
  'dieciseis':  NUM('16'),
  'diecisiete': NUM('17'),
  'dieciocho':  NUM('18'),
  'diecinueve': NUM('19'),
  'veinte':     NUM('20'),
  // French numbers (1–12)
  'un':    NUM('1'),
  'deux':  NUM('2'),
  'trois': NUM('3'),
  'quatre':NUM('4'),
  'cinq':  NUM('5'),
  'six':   NUM('6'),
  'sept':  NUM('7'),
  'huit':  NUM('8'),
  'neuf':  NUM('9'),
  'dix':   NUM('10'),
  'onze':  NUM('11'),
  'douze': NUM('12'),
  // German numbers (normalizeForOverride strips diacritics: ü→u, ö→o, ä→a)
  'eins':       NUM('1'),
  'zwei':       NUM('2'),
  'drei':       NUM('3'),
  'vier':       NUM('4'),
  'funf':       NUM('5'),   // fünf stripped
  'sechs':      NUM('6'),
  'sieben':     NUM('7'),
  'acht':       NUM('8'),
  'neun':       NUM('9'),
  'zehn':       NUM('10'),
  'elf':        NUM('11'),
  'zwolf':      NUM('12'),  // zwölf stripped
  'dreizehn':   NUM('13'),
  'vierzehn':   NUM('14'),
  'funfzehn':   NUM('15'),
  'sechzehn':   NUM('16'),
  'siebzehn':   NUM('17'),
  'achtzehn':   NUM('18'),
  'neunzehn':   NUM('19'),
  'zwanzig':    NUM('20'),
  // Italian numbers (uno/sei/dieci shared with Spanish)
  'due':         NUM('2'),
  'tre':         NUM('3'),
  'quattro':     NUM('4'),
  'sette':       NUM('7'),
  'otto':        NUM('8'),
  'nove':        NUM('9'),
  'undici':      NUM('11'),
  'dodici':      NUM('12'),
  'tredici':     NUM('13'),
  'quattordici': NUM('14'),
  'quindici':    NUM('15'),
  'sedici':      NUM('16'),
  'diciassette': NUM('17'),
  'diciotto':    NUM('18'),
  'diciannove':  NUM('19'),
  'venti':       NUM('20'),
  // Portuguese numbers
  'um':     NUM('1'),
  'dois':   NUM('2'),
  // tres / quatro / cinco / seis already covered by ES/IT entries above
  'sete':   NUM('7'),
  'oito':   NUM('8'),
  'dez':    NUM('10'),
  // Japanese numbers — kanji forms
  '一':  NUM_CJK('1', '一', 'kanji'),
  '二':  NUM_CJK('2', '二', 'kanji'),
  '三':  NUM_CJK('3', '三', 'kanji'),
  '四':  NUM_CJK('4', '四', 'kanji'),
  '五':  NUM_CJK('5', '五', 'kanji'),
  '六':  NUM_CJK('6', '六', 'kanji'),
  '七':  NUM_CJK('7', '七', 'kanji'),
  '八':  NUM_CJK('8', '八', 'kanji'),
  '九':  NUM_CJK('9', '九', 'kanji'),
  '十':  NUM_CJK('10', '十', 'kanji'),
  // Japanese numbers — hiragana/romaji forms
  'ichi':   NUM_CJK('1', 'いち', 'hiragana'),
  'ni':     NUM_CJK('2', 'に', 'hiragana'),
  'san':    NUM_CJK('3', 'さん', 'hiragana'),
  'shi':    NUM_CJK('4', 'し', 'hiragana'),
  'yon':    NUM_CJK('4', 'よん', 'hiragana'),
  'go':     NUM_CJK('5', 'ご', 'hiragana'),
  'roku':   NUM_CJK('6', 'ろく', 'hiragana'),
  'shichi': NUM_CJK('7', 'しち', 'hiragana'),
  'nana':   NUM_CJK('7', 'なな', 'hiragana'),
  'hachi':  NUM_CJK('8', 'はち', 'hiragana'),
  'kyu':    NUM_CJK('9', 'きゅう', 'hiragana'),
  'juu':    NUM_CJK('10', 'じゅう', 'hiragana'),
  // Korean numbers — hangul
  '일':   NUM_CJK('1', '일', 'Korean hangul'),
  '이':   NUM_CJK('2', '이', 'Korean hangul'),
  '삼':   NUM_CJK('3', '삼', 'Korean hangul'),
  '사':   NUM_CJK('4', '사', 'Korean hangul'),
  '오':   NUM_CJK('5', '오', 'Korean hangul'),
  '육':   NUM_CJK('6', '육', 'Korean hangul'),
  '칠':   NUM_CJK('7', '칠', 'Korean hangul'),
  '팔':   NUM_CJK('8', '팔', 'Korean hangul'),
  '구':   NUM_CJK('9', '구', 'Korean hangul'),
  '십':   NUM_CJK('10', '십', 'Korean hangul'),
  // Mandarin numbers — Chinese characters (shares kanji entries above with Japanese)
  // Days of week keys below also cover Mandarin since chars are the same
  // English numbers
  'zero':    NUM('0'),
  'one':     NUM('1'),
  'two':     NUM('2'),
  'three':   NUM('3'),
  'four':    NUM('4'),
  'five':    NUM('5'),
  // 'six' already covered by French above — same key, same prompt
  'seven':   NUM('7'),
  'eight':   NUM('8'),
  'nine':    NUM('9'),
  'ten':     NUM('10'),
  'eleven':  NUM('11'),
  'twelve':  NUM('12'),
  'thirteen':  NUM('13'),
  'fourteen':  NUM('14'),
  'fifteen':   NUM('15'),
  'sixteen':   NUM('16'),
  'seventeen': NUM('17'),
  'eighteen':  NUM('18'),
  'nineteen':  NUM('19'),
  'twenty':    NUM('20'),
  // English days of the week
  'monday':    'A small clean calendar card with Monday highlighted in blue, the word "MONDAY" printed in bold modern type',
  'tuesday':   'A small clean calendar card with Tuesday highlighted in red, the word "TUESDAY" printed in bold modern type',
  'wednesday': 'A small clean calendar card with Wednesday highlighted in green, the word "WEDNESDAY" printed in bold modern type',
  'thursday':  'A small clean calendar card with Thursday highlighted in orange, the word "THURSDAY" printed in bold modern type',
  'friday':    'A small clean calendar card with Friday highlighted in purple, the word "FRIDAY" printed in bold modern type',
  'saturday':  'A small clean calendar card with Saturday highlighted in yellow, the word "SATURDAY" printed in bold modern type',
  'sunday':    'A small clean calendar card with Sunday highlighted in pink, the word "SUNDAY" printed in bold modern type',
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

  // ── Greetings & Farewells — Spanish ──────────────────────────────────────
  'hola':               'Two cheerful adults facing each other and waving hello with big smiles, bright flat illustration, warm colors',
  'buenos dias':        'A bright golden sunrise with orange and yellow rays over the horizon, a smiling person waving good morning, cheerful flat illustration',
  'buenas tardes':      'A warm sunny afternoon, the sun shining high and golden, a person outside waving hello in bright golden light, flat illustration',
  'buenas noches':      'A clear night sky with a large glowing crescent moon and bright stars, a person standing in a doorway waving goodnight, soft flat illustration',
  'adios':              'A person leaning out of a car window waving goodbye while another person waves back on the sidewalk, colorful flat illustration',
  'hasta luego':        'Two friends at a crossroads each walking different directions, both looking back and waving, bright cheerful flat illustration',
  'hasta manana':       'A person waving goodbye under a setting sun, with a calendar showing tomorrow circled, cheerful flat illustration',
  'hasta pronto':       'Two friends hugging goodbye at a doorstep, one waving, both smiling warmly, flat illustration',
  'mucho gusto':        'Two adults shaking hands warmly with bright smiles, a pleasure-to-meet-you moment, flat illustration',
  'encantado':          'A man placing his hand on his chest and bowing his head slightly with a warm smile, formal greeting, flat illustration',
  'encantada':          'A woman placing her hand on her chest and bowing her head slightly with a warm smile, formal greeting, flat illustration',
  'como estas':         'A person opening their arms wide with raised eyebrows and a questioning smile, asking "how are you?", flat illustration',
  'como esta usted':    'A person in neat attire with an open-hand gesture and polite questioning expression, formal greeting, flat illustration',
  'bien':               'A cheerful person giving a big thumbs-up with a wide grin, bright sunny background, flat illustration',
  'muy bien':           'A very happy dancing person with both thumbs up and a huge smile, bright energetic flat illustration',
  'mal':                'A person with slumped shoulders, frowning face, and a drooping posture, feeling bad, flat illustration',
  'mas o menos':        'A person tilting their open hand back and forth in a "so-so" gesture with a neutral shrug expression, flat illustration',
  'regular':            'A person with a flat neutral expression holding their hand out horizontally, gesturing "just okay", flat illustration',
  'por favor':          'A person with hands pressed together in a pleading please gesture, kind eyes, flat illustration',
  'gracias':            'A person pressing both palms together in a grateful thank-you bow with a warm smile, flat illustration',
  'muchas gracias':     'A person bowing deeply with both arms extended forward in deep gratitude, big smile, flat illustration',
  'de nada':            'A person waving their hand with a relaxed "don\'t mention it" smile, cheerful flat illustration',
  'perdon':             'A person with a sheepish expression raising one hand in an apologetic sorry gesture, flat illustration',
  'disculpe':           'A person excusing themselves politely with a gentle hand gesture, watercolor',
  'lo siento':          'A person with a sorrowful apologetic expression placing hand on heart, watercolor',

  // ── Greetings & Farewells — French ────────────────────────────────────────
  'bonjour':            'Two people greeting each other in the morning sunlight with a friendly wave, watercolor style',
  'bonsoir':            'Two people exchanging evening greetings under a dusky sky, watercolor illustration',
  'bonne nuit':         'A person waving goodnight under a starry sky with a crescent moon, watercolor',
  'au revoir':          'A person smiling and waving goodbye at an open door, watercolor illustration',
  'salut':              'Two friends giving a casual wave to each other, bright watercolor style',
  'a bientot':          'Two people parting cheerfully, "see you soon" in the air, watercolor illustration',
  'sil vous plait':     'A person making a polite request gesture with clasped hands, watercolor style',
  'merci':              'A person bowing graciously with a thankful smile, warm watercolor illustration',
  'merci beaucoup':     'A person bowing deeply with a very warm smile of gratitude, watercolor style',
  'de rien':            'A person waving a welcoming "no problem" hand gesture, watercolor illustration',
  'excusez-moi':        'A person gently raising a hand to get attention politely, watercolor style',
  'pardon':             'A person with an apologetic expression placing hand on chest, watercolor illustration',
  'enchante':           'A person extending a hand for a handshake with a delighted smile, watercolor style',

  // ── Greetings & Farewells — German ────────────────────────────────────────
  'guten morgen':       'A bright sunrise scene with a person waving good morning, watercolor illustration',
  'guten tag':          'A cheerful daytime scene with two people greeting each other, watercolor style',
  'guten abend':        'Two people greeting in the warm evening light, watercolor illustration',
  'gute nacht':         'A person waving goodnight under a starry sky, watercolor style',
  'auf wiedersehen':    'A person waving goodbye at an open door with a warm smile, watercolor illustration',
  'tschuss':            'Two friends giving a casual wave goodbye, bright watercolor style',
  'bitte':              'A person making a polite request gesture, watercolor illustration',
  'danke':              'A person bowing with a grateful smile, warm watercolor style',
  'danke schon':        'A person bowing deeply with a warm thankful smile, watercolor illustration',
  'bitte schon':        'A person gesturing "you\'re welcome" with a kind smile, watercolor style',
  'entschuldigung':     'A person raising a hand apologetically, watercolor illustration',

  // ── Greetings & Farewells — Italian ──────────────────────────────────────
  'ciao':               'Two friends waving hello and goodbye cheerfully, bright watercolor illustration',
  'buongiorno':         'A cheerful morning scene with warm sunlight and a person waving, watercolor style',
  'buonasera':          'Two people greeting warmly in the soft evening light, watercolor illustration',
  'buonanotte':         'A person waving goodnight under a starry sky, watercolor style',
  'arrivederci':        'A person waving goodbye at an open door with a friendly smile, watercolor illustration',
  'prego':              'A person gesturing "you\'re welcome" or "please go ahead" with an open hand, watercolor',
  'grazie':             'A person pressing hands together in a gracious thank-you bow, watercolor illustration',
  'per favore':         'A person with hands clasped making a polite "please" request, watercolor style',
  'mi chiamo':          'A person pointing to themselves and saying their name with a friendly smile, watercolor',
  'come stai':          'A person making an open "how are you?" gesture with a warm expression, watercolor',
  'come sta':           'A person in a slightly formal setting making a polite inquiry gesture, watercolor',

  // ── Greetings & Farewells — Portuguese ───────────────────────────────────
  'ola':                'Two people smiling and waving hello to each other, bright watercolor illustration',
  'bom dia':            'A cheerful sunrise scene with golden light and a person waving good morning, watercolor',
  'boa tarde':          'A warm afternoon scene with a person waving hello, soft watercolor illustration',
  'boa noite':          'A calm night scene with a crescent moon and a person waving goodnight, watercolor',
  'adeus':              'A person waving farewell at an open doorway with a warm smile, watercolor illustration',
  'ate logo':           'Two friends parting with a cheerful "see you soon" wave, watercolor style',
  'ate amanha':         'A calendar showing tomorrow with a cheerful sunrise, watercolor illustration',
  'obrigado':           'A person bowing with a grateful smile, warm watercolor illustration',
  'obrigada':           'A person bowing graciously with a warm thankful smile, watercolor style',
  'de nada':            'A person waving a kind "you\'re welcome" hand gesture, watercolor illustration',
  'com licenca':        'A person politely excusing themselves with a gentle gesture, watercolor style',
  'desculpe':           'A person with an apologetic expression placing hand on heart, watercolor illustration',
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
 * Also busts fallback word-component keys for multi-word phrases, preventing
 * stale individual-word images from being served after the exact key is deleted.
 */
export async function bustVocabImageCache(cacheKeys: string[]): Promise<number> {
  if (cacheKeys.length === 0) return 0;
  const db = getSharedDb();

  // Build expanded set including fallback word-component keys for multi-word phrases.
  // e.g. "vocab_spanish_buenas tardes" also busts "vocab_spanish_buenas" + "vocab_spanish_tardes"
  const allKeys = new Set(cacheKeys);
  for (const key of cacheKeys) {
    const match = key.match(/^vocab_([a-z]+)_(.+)$/);
    if (match) {
      const [, language, wordPart] = match;
      const parts = wordPart.split(' ').filter(p => p.length > 2);
      if (parts.length > 1) {
        for (const part of parts) {
          allKeys.add(`vocab_${language}_${part}`);
        }
      }
    }
  }

  let deleted = 0;
  for (const key of allKeys) {
    const result = await db.delete(mediaFiles).where(eq(mediaFiles.searchQuery, key));
    deleted += (result as any).rowCount ?? 0;
  }
  console.log(`[VocabBust] Deleted ${deleted} cached images from ${allKeys.size} keys (${cacheKeys.length} primary + ${allKeys.size - cacheKeys.length} fallback components)`);
  return deleted;
}

// ── Numbers/Days cache keys (per language) ─────────────────────────────────
// Generated using the same normalisation as vocabulary-image-resolver.ts.
// Exported so the fix-numbers-days admin route can bust them before re-seeding.
const NUMBERS_DAYS_WORDS: Record<string, string[]> = {
  spanish: [
    'cero','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez',
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
  english: [
    'zero','one','two','three','four','five','six','seven','eight','nine','ten',
    'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty',
    'monday','tuesday','wednesday','thursday','friday','saturday','sunday',
  ],
  // Japanese, Korean, Mandarin: CJK characters are stripped by the normalizer, so romaji/transliterated
  // forms are included here for any curriculum that uses them. CJK-script words are covered by
  // SCENE_OVERRIDES (which uses normalizeForOverride that preserves CJK) but can't be cache-busted
  // via toCacheKey (which strips CJK). That's acceptable — stale CJK images are rare.
  japanese: [
    'ichi','ni','san','shi','yon','go','roku','shichi','nana','hachi','kyu','juu',
  ],
  korean: [
    'il','i','sam','sa','o','yuk','chil','pal','gu','sip',
  ],
  mandarin: [
    'yi','er','san','si','wu','liu','qi','ba','jiu','shi',
  ],
};

export const NUMBERS_DAYS_CACHE_KEYS: Record<string, string[]> = Object.fromEntries(
  Object.entries(NUMBERS_DAYS_WORDS).map(([lang, words]) => [
    lang,
    words.map(w => toCacheKey(lang, w)),
  ])
);

// ── Greetings cache keys (per language) ────────────────────────────────────
const GREETINGS_WORDS: Record<string, string[]> = {
  spanish: [
    'hola','buenos días','buenas tardes','buenas noches','adiós','hasta luego',
    'hasta mañana','hasta pronto','mucho gusto','encantado','encantada',
    '¿cómo estás?','¿cómo está usted?','bien','muy bien','mal','más o menos','regular',
    'por favor','gracias','muchas gracias','de nada','perdón','disculpe','lo siento',
  ],
  french: [
    'bonjour','bonsoir','bonne nuit','au revoir','salut','à bientôt',
    's\'il vous plaît','merci','merci beaucoup','de rien','excusez-moi','pardon','enchanté',
  ],
  german: [
    'guten Morgen','guten Tag','guten Abend','gute Nacht','auf Wiedersehen','tschüss',
    'bitte','danke','danke schön','bitte schön','Entschuldigung',
  ],
  italian: [
    'ciao','buongiorno','buonasera','buonanotte','arrivederci',
    'prego','grazie','per favore','mi chiamo','come stai','come sta',
  ],
  portuguese: [
    'olá','bom dia','boa tarde','boa noite','adeus','até logo','até amanhã',
    'obrigado','obrigada','de nada','com licença','desculpe',
  ],
};

export const GREETINGS_CACHE_KEYS: Record<string, string[]> = Object.fromEntries(
  Object.entries(GREETINGS_WORDS).map(([lang, words]) => [
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
