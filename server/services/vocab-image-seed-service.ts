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

/**
 * CHARACTER_PROFILES
 *
 * Named recurring characters used in greeting and farewell scene prompts.
 * Each character has a precise physical description so DALL-E produces
 * visually similar results across every prompt that embeds that description.
 *
 * HOW TO USE when writing a new scene prompt:
 *   - Single-person scenes: embed the primary character (e.g. CHAR.ES.primary)
 *   - Two-person scenes:    embed primary + secondary (e.g. CHAR.ES.primary + CHAR.ES.secondary)
 *   - Assign one language's pair to any thematically linked group
 *     (time-of-day greetings, farewells, etc.) and use that pair consistently
 *     across every prompt in that group.
 *
 * Adding a new language / group:
 *   1. Add an entry in CHARACTER_PROFILES below with a primary and secondary character.
 *   2. Reference CHAR.<LANG>.primary / CHAR.<LANG>.secondary in each prompt.
 *   3. Add the updated words to GREETINGS_WORDS so old cached images are busted.
 */
export const CHARACTER_PROFILES = {
  /** Spanish — used for all Spanish greeting & farewell prompts */
  ES: {
    primary:   'Daniela, a 28-year-old Latina woman with long wavy dark-brown hair, warm medium-brown skin, and bright brown eyes, wearing a sky-blue short-sleeve collared button-up shirt and dark jeans',
    secondary: 'Marco, a 30-year-old Latino man with short curly black hair, light-olive skin, and friendly dark eyes, wearing a white button-up shirt and chinos',
    abuela:    'Rosa, a warm 68-year-old Mexican grandmother with short curly silver-white hair, warm brown skin, kind dark eyes behind gold-rimmed glasses, and a white blouse with colorful floral embroidery',
  },
  /** French — used for all French greeting & farewell prompts */
  FR: {
    primary:   'Sophie, a 27-year-old French woman with chin-length auburn hair, fair skin, and green eyes, wearing a striped navy-and-white Breton top and light trousers',
    secondary: 'Pierre, a 32-year-old French man with neat short brown hair, light skin, and blue eyes, wearing a burgundy crewneck sweater and dark trousers',
    grandmere: 'Colette, Sophie\'s 66-year-old French grandmother with soft silver curly hair, warm fair skin, and kind blue-grey eyes, wearing a lavender cardigan over a floral blouse',
  },
  /** German — used for all German greeting & farewell prompts */
  DE: {
    primary:   'Anna, a 26-year-old German woman with straight blonde hair in a ponytail, fair skin, and blue-grey eyes, wearing a forest-green pullover and grey slim-fit trousers',
    secondary: 'Klaus, a 34-year-old German man with short sandy-blond hair, fair skin, and hazel eyes, wearing a charcoal zip-up jacket and navy trousers',
    oma:       'Helga, Anna\'s 67-year-old German grandmother with short silver-white hair in a neat bun, fair skin, and warm grey eyes, wearing a cozy navy-blue cardigan and a floral blouse',
  },
  /** Italian — used for all Italian greeting & farewell prompts */
  IT: {
    primary:   'Giulia, a 25-year-old Italian woman with long straight dark-brown hair, warm olive skin, and dark-brown eyes, wearing a terracotta linen blouse and white wide-leg trousers',
    secondary: 'Luca, a 29-year-old Italian man with short dark wavy hair, medium-olive skin, and brown eyes, wearing a pale-yellow polo shirt and light chinos',
    nonna:     'Carmela, Giulia\'s 65-year-old Italian grandmother with short silver hair, warm olive skin, and kind dark-brown eyes, wearing a cream-coloured knitted cardigan over a printed blouse',
  },
  /** Portuguese — used for all Portuguese greeting & farewell prompts */
  PT: {
    primary:   'Ana, a 27-year-old Brazilian woman with long wavy dark hair, golden-brown skin, and warm brown eyes, wearing a coral short-sleeve fitted blouse tucked into dark tailored wide-leg trousers',
    secondary: 'João, a 31-year-old Brazilian man with short dark hair, medium-brown skin, and brown eyes, wearing a light-blue casual shirt and beige trousers',
    avo:       'Maria, Ana\'s 64-year-old Brazilian grandmother with short wavy silver hair, warm golden-brown skin, and kind brown eyes, wearing a vibrant floral blouse',
  },
  /** Japanese — used for all Japanese greeting & farewell prompts */
  JA: {
    primary:   'Yuki, a 25-year-old Japanese woman with straight shoulder-length black hair, light porcelain skin, and warm dark brown eyes, wearing a soft sage-green blouse and light grey wide-leg trousers',
    secondary: 'Kenji, a 29-year-old Japanese man with short neat black hair, light skin, and dark brown eyes, wearing a navy blue casual button-up shirt and dark chinos',
  },
  /** Korean — used for all Korean greeting & farewell prompts */
  KO: {
    primary:   'Ji-yeon, a 24-year-old Korean woman with long straight black hair, fair skin, and dark brown eyes, wearing a soft pink oversized blouse and white wide-leg trousers',
    secondary: 'Min-jun, a 28-year-old Korean man with neat short black hair, fair skin, and dark eyes, wearing a light grey crew-neck sweater and dark slim-fit trousers',
  },
  /** Mandarin/Chinese — used for all Mandarin greeting & farewell prompts */
  ZH: {
    primary:   'Mei, a 26-year-old Chinese woman with long sleek black hair, fair complexion, and warm brown eyes, wearing a teal short-sleeve silk blouse tucked into beige wide-leg trousers',
    secondary: 'Wei, a 30-year-old Chinese man with short neat black hair, light skin, and dark brown eyes, wearing a white linen button-up shirt and navy trousers',
  },
  /** Hebrew — used for all Hebrew greeting & farewell prompts */
  HE: {
    primary:   'Noa, a 26-year-old Israeli woman with long wavy dark brown hair, light olive skin, and warm hazel eyes, wearing a mustard-yellow fitted blouse tucked into dark wide-leg trousers',
    secondary: 'Avi, a 30-year-old Israeli man with short dark curly hair, medium olive skin, and dark eyes, wearing a sage-green button-up shirt and dark trousers',
  },
  /** English — used for all English greeting & farewell prompts */
  EN: {
    primary:   'Emma, a 27-year-old American woman with shoulder-length chestnut hair, light skin, and hazel eyes, wearing a navy blue cardigan and light jeans',
    secondary: 'Marcus, a 31-year-old American man with close-cropped dark hair, medium-brown skin, and warm dark eyes, wearing a light grey crew-neck sweater and dark jeans',
    grandma:   'Dorothy, Emma\'s 65-year-old American grandmother with short silver-white curly hair, warm fair skin, and kind hazel eyes, wearing a soft periwinkle sweater and small pearl earrings',
  },
} as const;

const CHAR = CHARACTER_PROFILES;

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

/**
 * Split-panel contrast illustration — shared by BOTH words in an antonym pair.
 * Left panel shows the "positive/first" concept; right panel shows the "negative/second".
 * Both members of the pair receive the SAME prompt so they always render identical images.
 */
const SPLIT = (leftLabel: string, leftDesc: string, rightLabel: string, rightDesc: string) =>
  `A clean split-panel flat illustration divided by a bold vertical line down the center. ` +
  `LEFT half (labeled "${leftLabel}" in small text at top): ${leftDesc}. ` +
  `RIGHT half (labeled "${rightLabel}" in small text at top): ${rightDesc}. ` +
  `Bright, bold flat design. No clutter, minimal background. Square format.`;

// ────────────────────────────────────────────────────────────────────────────
// VOCAB IMAGE ARCHITECTURE — TWO CATEGORIES:
//
// ── 1. CULTURALLY NEUTRAL (shared across all languages) ──────────────────
//    Concrete objects, numbers, colors, shapes — concepts with one universal
//    visual meaning regardless of culture or speaker.
//    → Stored under language-independent "concept_*" keys via CONCEPT_KEY_MAP
//      in vocabulary-image-resolver.ts; all languages share the SAME anchor image
//    → Prompt: static PROP description (PROP_STYLE, no character needed)
//    Example: the number 2 → "concept_num_2" is reused in ES, IT, FR, DE, etc.
//
// ── 2. CULTURALLY DRIVEN (character-specific, one image per language) ────
//    Actions, greetings, introductions, situational dialogue — concepts where
//    the LANGUAGE'S CHARACTER and cultural framing matter.
//    → NOT in CONCEPT_KEY_MAP — each language auto-generates on first request
//    → SCENE_OVERRIDES entries for these MUST be ACTION descriptions (gerunds,
//      verb phrases, situational descriptions).  NEVER embed a specific
//      character name — the character is auto-prepended from
//      LANGUAGE_CHARACTER_INTROS in vocabulary-image-resolver.ts
//    → Result: Spanish gets Daniela, Italian gets Giulia, French gets Sophie, etc.
//
//    GOOD override: "warmly pressing a hand to their chest while introducing themselves"
//    BAD  override: "Daniela pressing a hand to her chest..."  ← locks to Spanish only!
// ────────────────────────────────────────────────────────────────────────────

export const SCENE_OVERRIDES: Record<string, string> = {
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
  // Characters: Daniela (primary) + Marco (secondary) — see CHARACTER_PROFILES.ES
  'hola':               `${CHAR.ES.primary} waving hello with a big cheerful smile to ${CHAR.ES.secondary} at a sunny school entrance, both standing a few feet apart, friendly classmate greeting, wholesome platonic interaction`,
  'buenos dias':        `${CHAR.ES.primary} standing outside a rustic farmhouse at sunrise, smiling and waving buenos días at the viewer while a rooster struts past her feet, golden dawn light over rolling hills in the background`,
  'buenas tardes':      `${CHAR.ES.primary} relaxing on a park bench in the sunny afternoon, waving cheerfully to ${CHAR.ES.secondary} passing by, long golden shadows on the grass`,
  'buenas noches':      `${CHAR.ES.primary} in cozy pajamas waving from a lit bedroom window at a beautiful starry night sky with a glowing crescent moon, warm lamp light inside`,
  'adios':              `${CHAR.ES.primary} leaning out of a car window waving adiós, ${CHAR.ES.abuela} standing on the front porch of a cozy house waving back with a warm smile`,
  'hasta luego':        `${CHAR.ES.primary} and ${CHAR.ES.secondary} at a sunny intersection, each heading a different direction, smiling and waving goodbye over their shoulder`,
  'hasta manana':       `${CHAR.ES.primary} waving goodbye to ${CHAR.ES.abuela} outside a cozy house, a plain blank monthly wall calendar with an empty white grid visible on the wall behind them, no text no numbers no writing no labels anywhere in the image`,
  'hasta pronto':       `${CHAR.ES.primary} giving ${CHAR.ES.abuela} a warm farewell hug at a cozy front door, both smiling happily`,
  'mucho gusto':        `${CHAR.ES.primary} and ${CHAR.ES.secondary} meeting for the first time, both extending a friendly handshake with warm open smiles, bright cheerful setting`,
  'encantado':          `${CHAR.ES.secondary} placing his hand on his chest and giving a small warm bow of greeting with a delighted smile`,
  'encantada':          `${CHAR.ES.primary} placing her hand on her chest and giving a small warm bow of greeting with a warm smile`,
  'como estas':         `${CHAR.ES.primary} smiling warmly and gesturing openly toward ${CHAR.ES.secondary} who stands directly in front of her on a sunny sidewalk, both facing each other in friendly conversation`,
  // NOTE: 'como esta' is language-prefixed because Portuguese shares the same bare key.
  'spanish:como esta':  `${CHAR.ES.primary} and ${CHAR.ES.abuela} facing each other warmly on a sunny sidewalk or courtyard, grandmother visibly shorter and much older, granddaughter asking a caring formal question with a warm smile, wholesome intergenerational exchange`,
  'como esta usted':    `${CHAR.ES.primary} in a smart-casual setting extending a polite open-hand greeting gesture toward ${CHAR.ES.secondary}, a formal respectful exchange, warm indoor setting`,
  'bien':               SPLIT('bien', 'a cheerful person giving a big thumbs-up with a bright grin, sunny warm background', 'mal', 'a person with slumped shoulders, frowning face, and drooping posture, grey cool background'),
  'estoy bien':         SPLIT('bien', `${CHAR.ES.primary} giving a big thumbs-up with a beaming grin under a bright sun`, 'mal', `${CHAR.ES.primary} with slumped shoulders, a downcast frown, and a rain cloud overhead, grey cool background`),
  'muy bien':           `${CHAR.ES.primary} jumping with both arms raised in a huge joyful smile and a double thumbs-up, bright sunny Spanish setting`,
  'muy bien gracias':   `${CHAR.ES.primary} giving a warm thumbs-up with a bright grateful smile, pressing one hand to her heart in appreciation, sunny cheerful background`,
  'mal':                SPLIT('bien', 'a cheerful person giving a big thumbs-up with a bright grin, sunny warm background', 'mal', 'a person with slumped shoulders, frowning face, and drooping posture, grey cool background'),
  'estoy mal':          SPLIT('bien', `${CHAR.ES.primary} giving a big thumbs-up with a beaming grin under a bright sun`, 'mal', `${CHAR.ES.primary} with slumped shoulders, a downcast frown, and a rain cloud overhead, grey cool background`),
  'mas o menos':        `${CHAR.ES.primary} tilting her open hand back and forth in a relaxed "so-so" gesture with a neutral shrug and a small smile, bright sunny background`,
  'regular':            `${CHAR.ES.primary} holding her hand out horizontally with a neutral "just okay" expression and a slight shrug, bright cheerful setting`,
  'por favor':          `${CHAR.ES.primary} pressing her hands together in a gentle pleading "por favor" gesture with kind warm eyes, bright sunny setting`,
  'gracias':            `${CHAR.ES.primary} pressing both palms together in a warm grateful thank-you bow with a big smile, bright cheerful background`,
  'muchas gracias':     `${CHAR.ES.primary} bowing slightly with both arms extended forward in deep heartfelt gratitude and a beaming smile, bright sunny background`,
  // NOTE: 'de nada' is language-prefixed — see 'spanish:de nada' below (and 'portuguese:de nada' in the Portuguese section).
  'perdon':             `${CHAR.ES.primary} with a sheepish apologetic expression raising one hand in a gentle sorry gesture, soft warm background`,
  'disculpe':           `${CHAR.ES.primary} excusing herself politely with a gentle raised hand gesture and a kind apologetic smile, warm setting`,
  'lo siento':          `${CHAR.ES.primary} with a sorrowful sincere apologetic expression placing her hand over her heart`,
  // Language-prefixed entry used by fix-greetings when language='spanish'
  'spanish:de nada':    `${CHAR.ES.secondary} waving a relaxed "de nada — no problem" hand with a kind easygoing smile and a small chuckle, bright sunny background`,

  // ── Greetings & Farewells — French ────────────────────────────────────────
  // Characters: Sophie (primary) + Pierre (secondary) — see CHARACTER_PROFILES.FR
  'bonjour':            `${CHAR.FR.primary} and ${CHAR.FR.secondary} greeting each other with warm smiles at a sunny Parisian café terrace in the morning, croissants and coffee on the table`,
  'bonsoir':            `${CHAR.FR.primary} and ${CHAR.FR.secondary} meeting at a warmly lit evening street café, exchanging friendly bonsoir greetings under soft streetlamp glow, dusky blue sky behind them`,
  'bonne nuit':         `${CHAR.FR.primary} waving goodnight from a warmly lit apartment doorway under a crescent moon and starry sky, soft interior lamp light`,
  'au revoir':          `${CHAR.FR.primary} waving goodbye at an open doorway with a warm smile, ${CHAR.FR.grandmere} standing on the front steps waving back warmly, soft afternoon light`,
  'salut':              `${CHAR.FR.primary} and ${CHAR.FR.secondary} spotting each other across a sunny park and waving hello with big casual smiles, green trees in the background`,
  'a bientot':          `${CHAR.FR.primary} giving ${CHAR.FR.grandmere} a warm farewell hug at a sunny French doorway, both smiling happily`,
  'a demain':           `${CHAR.FR.primary} waving goodbye at a garden gate at sunset, a cheerful circular calendar floating nearby with tomorrow circled, warm golden light`,
  'sil vous plait':     `${CHAR.FR.primary} at a café counter with hands clasped in a polite please-expression, a coffee cup on the counter, friendly exchange with the barista, warm cozy interior`,
  'merci':              `${CHAR.FR.primary} pressing both palms together with a genuine grateful smile and a small nod of thanks, bright cheerful background`,
  'merci beaucoup':     `${CHAR.FR.primary} holding both arms open in a warm heartfelt gesture of deep gratitude, beaming with a big delighted smile, bright cheerful background`,
  'de rien':            `${CHAR.FR.secondary} waving a relaxed "de rien — no worries" hand with a friendly easygoing smile, bright airy setting`,
  'excusez-moi':        `${CHAR.FR.primary} gently tapping a stranger on the shoulder with a polite "excusez-moi" expression, hand slightly raised, busy Parisian market setting behind them`,
  'pardon':             `${CHAR.FR.primary} with a sincere apologetic expression placing hand on chest, stepping aside politely in a narrow street`,
  'enchante':           `${CHAR.FR.secondary} extending his hand for a warm first-meeting handshake with a delighted smile, ${CHAR.FR.primary} reaching forward to meet it, bright cheerful setting`,
  'comment allez-vous': `${CHAR.FR.primary} turning to ${CHAR.FR.secondary} on a sunny Parisian street with an open warm questioning expression and a polite smile, a subtle "comment allez-vous?" air to the gesture`,
  'tres bien merci':    `${CHAR.FR.primary} pressing both palms together with a glowing warm smile and a happy nod, radiating genuine contentment, "très bien, merci" written in delicate script in the bright background`,

  // ── Greetings & Farewells — German ────────────────────────────────────────
  // Characters: Anna (primary) + Klaus (secondary) — see CHARACTER_PROFILES.DE
  'hallo':              `${CHAR.DE.primary} waving hello with a big warm smile to ${CHAR.DE.secondary} at a sunny German market square, colourful European shop fronts behind them`,
  'guten morgen':       `${CHAR.DE.primary} in cozy full-length pajamas holding a steaming mug of coffee, smiling at a bright kitchen window with golden sunrise light streaming through the glass, warm morning light`,
  'guten tag':          `${CHAR.DE.primary} and ${CHAR.DE.secondary} waving hello to each other on a sunny cobblestone pedestrian street, European shop fronts and flower boxes behind them, bright afternoon light`,
  'guten abend':        `${CHAR.DE.primary} and ${CHAR.DE.secondary} meeting at the entrance of a warmly-lit cozy restaurant at dusk, exchanging warm greetings, amber light spilling from the open door, soft violet evening sky above`,
  'gute nacht':         `${CHAR.DE.primary} waving goodnight from a cozy doorway under a starry sky, warm lamp light glowing inside`,
  'auf wiedersehen':    `${CHAR.DE.primary} waving goodbye at an open front door with a warm smile, ${CHAR.DE.oma} standing on the garden path waving back warmly, soft sunset light`,
  'tschuss':            `${CHAR.DE.primary} and ${CHAR.DE.secondary} parting cheerfully at a bus stop, both turning and waving a casual cheerful goodbye to each other with big smiles, bright urban setting`,
  'bitte':              `${CHAR.DE.primary} at a bakery counter with hands clasped in a gentle polite please-expression, a fresh loaf on the counter, warm cozy interior with shelves of bread behind`,
  'danke':              `${CHAR.DE.primary} pressing both palms together with a heartfelt grateful smile and a warm nod of thanks, bright cheerful background`,
  'danke schon':        `${CHAR.DE.primary} giving a warm grateful bow with both hands pressed together, beaming with sincere deep appreciation, cheerful bright background`,
  'bitte schon':        `${CHAR.DE.secondary} gesturing "bitte schön — you're welcome" with an open relaxed palm and a kind friendly smile, bright airy setting`,
  'entschuldigung':     `${CHAR.DE.primary} gently tapping a stranger on the shoulder with a polite apologetic expression, hand slightly raised to get attention, busy street setting`,
  'bis spater':         `${CHAR.DE.primary} giving ${CHAR.DE.oma} a warm farewell hug at a cozy German front door, both smiling happily`,
  'freut mich':         `${CHAR.DE.primary} and ${CHAR.DE.secondary} shaking hands warmly in a first meeting, both wearing delighted pleased-to-meet-you smiles, bright professional indoor setting`,
  'wie geht es ihnen':  `${CHAR.DE.primary} in a polite formal posture facing ${CHAR.DE.secondary}, extending a courteous open-hand gesture with a respectful questioning smile, bright warm indoor setting`,
  'mir geht es gut danke': `${CHAR.DE.primary} giving a cheerful thumbs-up with a bright content smile, radiating a warm "I'm doing well, thank you" expression, sunny background`,

  // ── Greetings & Farewells — Italian ──────────────────────────────────────
  // Characters: Giulia (primary) + Luca (secondary) — see CHARACTER_PROFILES.IT
  'ciao':               `${CHAR.IT.primary} and ${CHAR.IT.secondary} waving cheerfully to each other at a sunny Italian piazza, colourful buildings and a fountain behind them`,
  'buongiorno':         `${CHAR.IT.primary} waving good morning from a sunlit Italian courtyard balcony with flower pots, golden morning light streaming in`,
  'buonasera':          `${CHAR.IT.primary} and ${CHAR.IT.secondary} exchanging warm buonasera greetings at the entrance of a cozy trattoria, amber evening light spilling from the open door`,
  'buonanotte':         `${CHAR.IT.primary} waving goodnight from a warmly lit doorway under a beautiful starry Italian sky, warm lamp light glowing inside`,
  'arrivederci':        `${CHAR.IT.primary} waving arrivederci with a warm smile at a sunny doorway, ${CHAR.IT.nonna} standing on the step waving back warmly`,
  'prego':              `${CHAR.IT.secondary} at a restaurant gesturing "prego — please, go ahead" with an open gracious welcoming hand and a warm smile, bright Italian dining setting`,
  'grazie':             `${CHAR.IT.primary} pressing both palms together with a warm grateful smile and a slight bow of thanks, bright sunny background`,
  'per favore':         `${CHAR.IT.primary} at a gelato shop counter with hands clasped making a polite "per favore" request with kind eyes, cheerful colourful setting`,
  'mi chiamo':          `${CHAR.IT.primary} pointing to herself confidently with a big friendly smile, a small speech bubble showing her name`,
  'come stai':          `${CHAR.IT.primary} walking toward ${CHAR.IT.secondary} on a sunny Italian street, spreading her arms open with a warm questioning "come stai?" expression, both smiling`,
  'come sta':           `${CHAR.IT.primary} in a formal setting making a respectful polite inquiry gesture to ${CHAR.IT.secondary}, a professional warm interior`,
  'a domani':           `${CHAR.IT.primary} waving goodbye at a sun-dappled Italian garden gate at sunset, a cheerful circular calendar floating nearby with domani circled, warm golden light`,
  'a presto':           `${CHAR.IT.primary} giving ${CHAR.IT.nonna} a warm farewell hug at a sun-drenched Italian doorway, both smiling warmly`,
  'piacere':            `${CHAR.IT.primary} and ${CHAR.IT.secondary} meeting for the first time in a bright sunny piazza, both extending a warm handshake with delighted "piacere — pleased to meet you" smiles`,
  'sto bene grazie':    `${CHAR.IT.primary} giving a cheerful double thumbs-up with a radiant warm smile, the bright Italian countryside visible through a window behind`,

  // ── Greetings & Farewells — Portuguese ───────────────────────────────────
  // Characters: Ana (primary) + João (secondary) — see CHARACTER_PROFILES.PT
  'ola':                `${CHAR.PT.primary} and ${CHAR.PT.secondary} spotting each other on a sunny Brazilian street and waving hello with big warm smiles, colourful tropical buildings behind them`,
  'bom dia':            `${CHAR.PT.primary} in cozy full-length pajamas waving good morning at a bright kitchen window, golden sunrise light streaming in through the glass`,
  'boa tarde':          `${CHAR.PT.primary} relaxing on a park bench waving cheerfully to ${CHAR.PT.secondary} passing by in the warm sunny afternoon, long golden shadows on the path`,
  'boa noite':          `${CHAR.PT.primary} waving goodnight from a warmly lit doorway under a calm night sky with a crescent moon and stars, soft interior lamp light`,
  'adeus':              `${CHAR.PT.primary} waving a heartfelt farewell at an open doorway with a warm smile, ${CHAR.PT.avo} standing on the garden path waving back warmly, soft warm light`,
  'ate logo':           `${CHAR.PT.primary} giving ${CHAR.PT.avo} a warm farewell embrace at a garden gate, both smiling broadly`,
  'ate amanha':         `${CHAR.PT.primary} waving goodbye at a garden gate at sunset, a cheerful circular calendar floating nearby with tomorrow circled, warm golden light`,
  'obrigado':           `${CHAR.PT.secondary} pressing both palms together with a genuine grateful smile and a warm nod of thanks, bright cheerful background`,
  'obrigada':           `${CHAR.PT.primary} pressing both palms together with a heartfelt warm smile and a slight bow of deep gratitude, bright background`,
  // Language-prefixed to avoid collision with 'spanish:de nada' — used by fix-greetings when language='portuguese'
  'portuguese:de nada': `${CHAR.PT.secondary} waving a relaxed "de nada — no worries" hand with a kind easygoing smile, bright cheerful setting`,
  'com licenca':        `${CHAR.PT.primary} politely excusing herself with a gentle hand gesture, stepping around others in a busy colourful market`,
  'desculpe':           `${CHAR.PT.primary} with a sincere apologetic expression placing hand on heart, stepping back with a sorry gesture, warm bright setting`,
  'oi':                 `${CHAR.PT.primary} spotting ${CHAR.PT.secondary} across a bright tropical street and waving a casual cheerful "oi!" with a big friendly smile, colourful buildings behind them`,
  'tchau':              `${CHAR.PT.primary} and ${CHAR.PT.secondary} parting with a casual wave and warm "tchau" smiles at a sunny bus stop, bright tropical setting`,
  'portuguese:como esta': `${CHAR.PT.primary} in a warm polite posture facing ${CHAR.PT.secondary}, extending a courteous open-hand gesture with a respectful friendly questioning smile, bright setting`,
  'estou bem obrigado': `${CHAR.PT.secondary} giving a cheerful thumbs-up with a warm content smile, radiating a happy "estou bem, obrigado" expression, bright sunny background`,
  'prazer em conhece-lo': `${CHAR.PT.primary} and ${CHAR.PT.secondary} shaking hands warmly in a first meeting, both beaming with genuine "prazer em conhecê-lo" pleasure, bright cheerful setting`,

  // ── Greetings & Farewells — Japanese ─────────────────────────────────────
  // Characters: Yuki (primary) + Kenji (secondary) — see CHARACTER_PROFILES.JA
  // Native-script keys are preserved by normalizeForOverride.
  // Romaji aliases are also provided for curricula that romanize vocabulary.
  'こんにちは':               `${CHAR.JA.primary} waving hello with a big smile to ${CHAR.JA.secondary} on a sunny Japanese shopping street, colourful shop signs and a torii gate visible behind them`,
  'おはようございます':        `${CHAR.JA.primary} in cozy full-length pajamas holding a steaming mug of green tea at a bright kitchen window, golden sunrise light streaming through shoji screens, warm morning light`,
  'おはよう':                `${CHAR.JA.primary} waving a cheerful casual good morning to ${CHAR.JA.secondary} at a neighbourhood convenience store entrance, early morning light`,
  'こんばんは':               `${CHAR.JA.primary} and ${CHAR.JA.secondary} meeting at the entrance of a cozy izakaya at dusk, warm amber paper-lantern light spilling out, soft violet evening sky`,
  'おやすみなさい':            `${CHAR.JA.primary} waving goodnight from a warmly lit doorway under a starry sky, soft paper lantern light glowing inside`,
  'おやすみ':                `${CHAR.JA.primary} waving a casual goodnight at a lit bedroom doorway with a crescent moon visible outside the window`,
  'さようなら':               `${CHAR.JA.primary} standing at an open doorway waving a heartfelt goodbye as ${CHAR.JA.secondary} walks away down a cherry-blossom-lined path, soft sunset light`,
  'またね':                  `${CHAR.JA.primary} and ${CHAR.JA.secondary} parting cheerfully at a train station platform, both turning to wave "mata ne" with bright smiles`,
  'じゃあね':                `${CHAR.JA.primary} and ${CHAR.JA.secondary} parting with a casual cheerful wave at a school gate, bright afternoon light`,
  'ありがとうございます':       `${CHAR.JA.primary} pressing both palms together in a respectful forward bow of deep gratitude, warm bright setting`,
  'ありがとう':               `${CHAR.JA.primary} pressing both palms together with a warm grateful smile and a slight bow of thanks, bright cheerful background`,
  'すみません':               `${CHAR.JA.primary} bowing apologetically with a polite expression, hand raised to get attention in a busy Japanese street`,
  'ごめんなさい':              `${CHAR.JA.primary} bowing deeply with a sincere apologetic expression and hands pressed together in a sorry gesture`,
  'どういたしまして':          `${CHAR.JA.secondary} waving a relaxed "you're welcome" hand with a kind easygoing smile, bright airy setting`,
  'はじめまして':              `${CHAR.JA.primary} and ${CHAR.JA.secondary} bowing politely to each other on first meeting, both smiling warmly, bright cheerful setting`,
  'よろしくおねがいします':     `${CHAR.JA.primary} bowing respectfully with both hands at her sides and a warm open smile, formal greeting stance`,
  'おげんきですか':            `${CHAR.JA.primary} facing ${CHAR.JA.secondary} with a warm open "how are you?" questioning expression, bright Japanese garden setting`,
  // Romaji aliases
  'konnichiwa':              `${CHAR.JA.primary} waving hello with a big smile to ${CHAR.JA.secondary} on a sunny Japanese shopping street, colourful shop signs behind them`,
  'ohayou gozaimasu':        `${CHAR.JA.primary} in cozy full-length pajamas holding green tea at a bright kitchen window, golden sunrise through shoji screens`,
  'ohayou':                  `${CHAR.JA.primary} waving a cheerful casual good morning at a convenience store entrance, early morning light`,
  'konbanwa':                `${CHAR.JA.primary} and ${CHAR.JA.secondary} meeting at the entrance of a cozy izakaya at dusk, amber lantern light`,
  'oyasumi nasai':            `${CHAR.JA.primary} waving goodnight from a warmly lit doorway under a starry sky, paper lantern light inside`,
  'oyasumi':                 `${CHAR.JA.primary} waving casual goodnight at a lit bedroom doorway with a crescent moon outside`,
  'sayounara':               `${CHAR.JA.primary} waving goodbye at an open doorway as ${CHAR.JA.secondary} walks away down a cherry-blossom path`,
  'mata ne':                 `${CHAR.JA.primary} and ${CHAR.JA.secondary} parting at a train station, both turning to wave with bright smiles`,
  'ja ne':                   `${CHAR.JA.primary} and ${CHAR.JA.secondary} parting with a casual wave at a school gate, bright afternoon`,
  'arigatou gozaimasu':      `${CHAR.JA.primary} pressing both palms together in a respectful forward bow of deep gratitude, warm bright setting`,
  'arigatou':                `${CHAR.JA.primary} pressing both palms together with a warm grateful smile and a slight bow, bright cheerful background`,
  'sumimasen':               `${CHAR.JA.primary} bowing apologetically with a polite raised hand in a busy Japanese street`,
  'gomennasai':              `${CHAR.JA.primary} bowing deeply with a sincere apologetic expression, hands pressed together`,
  'dou itashimashite':       `${CHAR.JA.secondary} waving a relaxed "you're welcome" hand with a kind smile, bright airy setting`,
  'hajimemashite':           `${CHAR.JA.primary} and ${CHAR.JA.secondary} bowing politely on first meeting, both smiling warmly, bright cheerful setting`,
  'yoroshiku onegaishimasu': `${CHAR.JA.primary} bowing respectfully with both hands at her sides and a warm open smile, formal greeting stance`,
  'ogenki desu ka':          `${CHAR.JA.primary} facing ${CHAR.JA.secondary} with a warm friendly "how are you?" expression`,
  'お元気ですか':              `${CHAR.JA.primary} facing ${CHAR.JA.secondary} on a bright sunny Japanese street with a warm open polite questioning expression, both smiling`,
  'また明日':                `${CHAR.JA.primary} waving goodbye at a school entrance at sunset, a cheerful calendar floating nearby with 明日 circled, warm golden light`,
  'mata ashita':             `${CHAR.JA.primary} waving goodbye at a school entrance at sunset with a bright warm smile, golden afternoon light`,
  '元気です ありがとう':       `${CHAR.JA.primary} giving a warm cheerful thumbs-up with a bright content smile and a slight bow of gratitude, sunny Japanese garden setting`,
  'genki desu arigatou':     `${CHAR.JA.primary} giving a cheerful thumbs-up with a warm grateful smile and a gentle bow of thanks, bright sunny Japanese garden setting`,

  // ── Greetings & Farewells — Korean ───────────────────────────────────────
  // Characters: Ji-yeon (primary) + Min-jun (secondary) — see CHARACTER_PROFILES.KO
  '안녕하세요':               `${CHAR.KO.primary} waving hello with a warm smile to ${CHAR.KO.secondary} on a bright modern Seoul street, colourful café signs and hangeul lettering behind them`,
  '안녕':                   `${CHAR.KO.primary} and ${CHAR.KO.secondary} exchanging a casual cheerful wave to each other, bright urban Korean setting`,
  '안녕히 가세요':             `${CHAR.KO.primary} standing at an open doorway waving a respectful farewell as ${CHAR.KO.secondary} departs, warm indoor light`,
  '안녕히 계세요':             `${CHAR.KO.secondary} at a doorway waving goodbye to ${CHAR.KO.primary} who is leaving, warm respectful farewell`,
  '감사합니다':               `${CHAR.KO.primary} pressing both palms together with a respectful slight bow and a sincere grateful expression, bright warm background`,
  '고맙습니다':               `${CHAR.KO.primary} pressing both palms together with a warm grateful smile and a slight bow, bright cheerful background`,
  '고마워요':                `${CHAR.KO.primary} placing one hand on her heart with a warm appreciative smile toward ${CHAR.KO.secondary}, casual warm setting`,
  '죄송합니다':               `${CHAR.KO.primary} bowing deeply with a sincere formal apologetic expression, hands at her sides`,
  '미안해요':                `${CHAR.KO.primary} with a sheepish apologetic expression placing hand on heart, warm setting`,
  '괜찮아요':                `${CHAR.KO.secondary} waving a relaxed "it's okay" hand with a kind reassuring smile, bright cheerful setting`,
  '천만에요':                `${CHAR.KO.secondary} waving a friendly "you're welcome" hand with an easygoing smile, bright airy setting`,
  // Romanized aliases
  'annyeonghaseyo':          `${CHAR.KO.primary} waving hello with a warm smile to ${CHAR.KO.secondary} on a bright modern Seoul street`,
  'annyeong':                `${CHAR.KO.primary} and ${CHAR.KO.secondary} exchanging a casual cheerful wave, bright urban setting`,
  'annyeonghi gaseyo':       `${CHAR.KO.primary} waving a respectful farewell at an open doorway as ${CHAR.KO.secondary} departs`,
  'annyeonghi gyeseyo':      `${CHAR.KO.secondary} waving goodbye to ${CHAR.KO.primary} who is leaving, warm respectful farewell`,
  'gamsahamnida':            `${CHAR.KO.primary} pressing both palms together with a respectful bow and sincere grateful expression, bright warm background`,
  'gomawoyo':                `${CHAR.KO.primary} placing one hand on her heart with a warm appreciative smile, casual warm setting`,
  'joesonghamnida':          `${CHAR.KO.primary} bowing deeply with a sincere formal apologetic expression`,
  'mianhaeyo':               `${CHAR.KO.primary} with a sheepish apologetic expression placing hand on heart`,
  'gwaenchanayo':            `${CHAR.KO.secondary} waving a relaxed "it's okay" hand with a kind reassuring smile`,
  'cheonmaneyo':             `${CHAR.KO.secondary} waving a friendly "you're welcome" hand with an easygoing smile`,
  '좋은 아침이에요':           `${CHAR.KO.primary} in cozy pajamas holding a warm cup of tea at a bright kitchen window, golden sunrise light streaming in`,
  '잘 자요':                 `${CHAR.KO.primary} waving goodnight from a warmly lit apartment doorway under a starry sky, crescent moon visible, soft indoor light`,
  '잘 지내요 감사합니다':      `${CHAR.KO.primary} giving a cheerful thumbs-up with a warm grateful smile and a gentle bow, bright sunny background`,
  '어떻게 지내세요':           `${CHAR.KO.primary} facing ${CHAR.KO.secondary} on a bright Seoul street with a warm open polite "how are you?" questioning expression, both smiling`,
  '내일 봐요':               `${CHAR.KO.primary} waving goodbye at a café doorway at sunset, a cheerful calendar with 내일 circled floating nearby, warm golden light`,
  '또 만나요':               `${CHAR.KO.primary} and ${CHAR.KO.secondary} parting at a subway entrance, both turning to wave a warm "see you again" with bright smiles, urban Seoul setting`,
  '만나서 반갑습니다':         `${CHAR.KO.primary} and ${CHAR.KO.secondary} bowing politely to each other in a first meeting, both smiling warmly with pleased-to-meet-you expressions, bright professional setting`,

  // ── Greetings & Farewells — Mandarin ─────────────────────────────────────
  // Characters: Mei (primary) + Wei (secondary) — see CHARACTER_PROFILES.ZH
  '你好':                   `${CHAR.ZH.primary} waving hello with a bright warm smile to ${CHAR.ZH.secondary} at a sunny Chinese tea garden, bamboo and stone paths visible behind them`,
  '早上好':                  `${CHAR.ZH.primary} in cozy full-length pajamas holding a warm cup of tea at a bright kitchen window, golden sunrise light streaming in, warm morning light`,
  '晚上好':                  `${CHAR.ZH.primary} and ${CHAR.ZH.secondary} exchanging warm evening greetings outside a warmly lit tea house at dusk, amber lantern light spilling out, soft violet sky`,
  '晚安':                   `${CHAR.ZH.primary} waving goodnight from a warmly lit doorway under a crescent moon and stars, soft indoor lamp light`,
  '再见':                   `${CHAR.ZH.primary} waving a warm goodbye at an open doorway as ${CHAR.ZH.secondary} walks away, soft golden afternoon light`,
  '谢谢':                   `${CHAR.ZH.primary} pressing both palms together with a warm grateful smile and a slight bow of thanks, bright cheerful background`,
  '谢谢你':                  `${CHAR.ZH.primary} pressing both palms together with a heartfelt smile directed at ${CHAR.ZH.secondary}, warm bright background`,
  '不客气':                  `${CHAR.ZH.secondary} waving a relaxed "bù kèqì — no worries" hand with a kind easygoing smile, bright airy setting`,
  '对不起':                  `${CHAR.ZH.primary} bowing slightly with a sincere apologetic expression and hand on heart`,
  '没关系':                  `${CHAR.ZH.secondary} waving a reassuring "it's fine" hand with a kind smile, bright cheerful setting`,
  '你好吗':                  `${CHAR.ZH.primary} facing ${CHAR.ZH.secondary} with a warm open "how are you?" gesture and a friendly questioning expression, bright Chinese garden setting`,
  '很好':                   `${CHAR.ZH.primary} giving a big cheerful thumbs-up with a bright happy smile, vibrant warm background`,
  // Pinyin aliases
  'ni hao':                  `${CHAR.ZH.primary} waving hello with a bright warm smile to ${CHAR.ZH.secondary} at a sunny Chinese tea garden`,
  'zao shang hao':           `${CHAR.ZH.primary} in cozy pajamas holding warm tea at a bright kitchen window, golden sunrise light`,
  'wan shang hao':           `${CHAR.ZH.primary} and ${CHAR.ZH.secondary} exchanging warm evening greetings outside a tea house at dusk`,
  'wan an':                  `${CHAR.ZH.primary} waving goodnight from a lit doorway under a crescent moon`,
  'zai jian':                `${CHAR.ZH.primary} waving goodbye at an open doorway as ${CHAR.ZH.secondary} walks away`,
  'xie xie':                 `${CHAR.ZH.primary} pressing both palms together with a warm grateful smile and slight bow`,
  'bu ke qi':                `${CHAR.ZH.secondary} waving a relaxed "you're welcome" hand with a kind smile`,
  'dui bu qi':               `${CHAR.ZH.primary} bowing slightly with a sincere apologetic expression and hand on heart`,
  'mei guan xi':             `${CHAR.ZH.secondary} waving a reassuring "it's fine" hand with a kind smile`,
  'ni hao ma':               `${CHAR.ZH.primary} facing ${CHAR.ZH.secondary} with a warm friendly "how are you?" expression`,
  'hen hao':                 `${CHAR.ZH.primary} giving a cheerful thumbs-up with a bright happy smile, warm background`,
  '下午好':                  `${CHAR.ZH.primary} and ${CHAR.ZH.secondary} waving warm afternoon greetings to each other on a sunlit Chinese garden path, golden afternoon light`,
  '回头见':                  `${CHAR.ZH.primary} parting with a warm wave and a bright hopeful smile at a tea shop doorway, a cheerful "see you soon" air, soft afternoon light`,
  '我很好 谢谢':              `${CHAR.ZH.primary} giving a cheerful double thumbs-up with a broad warm smile and a slight grateful bow, bright sunny Chinese garden background`,
  '我很好谢谢':               `${CHAR.ZH.primary} giving a cheerful double thumbs-up with a broad warm smile and a slight grateful bow, bright sunny Chinese garden background`,
  'wo hen hao xie xie':      `${CHAR.ZH.primary} giving a cheerful double thumbs-up with a bright happy smile and a grateful bow, sunny Chinese garden background`,
  'wo hen hao':              `${CHAR.ZH.primary} giving a cheerful thumbs-up with a bright happy smile, warm Chinese garden background`,
  '明天见':                  `${CHAR.ZH.primary} waving goodbye at a garden gate at sunset, a cheerful round calendar with 明天 circled floating nearby, warm golden light`,

  // ── Greetings & Farewells — Hebrew ───────────────────────────────────────
  // Characters: Noa (primary) + Avi (secondary) — see CHARACTER_PROFILES.HE
  // Hebrew script is preserved by normalizeForOverride.
  'שלום':                   `${CHAR.HE.primary} waving shalom with a warm smile to ${CHAR.HE.secondary} at a sunny Jerusalem stone-arch market square, colourful stalls behind them`,
  'בוקר טוב':               `${CHAR.HE.primary} in cozy full-length pajamas holding a steaming cup of coffee at a bright kitchen window, golden Mediterranean sunrise light streaming in, warm morning light`,
  'ערב טוב':                `${CHAR.HE.primary} and ${CHAR.HE.secondary} exchanging warm evening greetings outside a warmly lit Israeli café at dusk, amber light spilling out, soft Mediterranean sky above`,
  'לילה טוב':               `${CHAR.HE.primary} waving goodnight from a warmly lit doorway under a beautiful starry sky, soft indoor lamp light`,
  'להתראות':                `${CHAR.HE.primary} waving a heartfelt farewell at an open doorway as ${CHAR.HE.secondary} walks away down a sun-dappled path, warm light`,
  'תודה':                   `${CHAR.HE.primary} pressing both palms together with a warm grateful smile and a nod of thanks, bright cheerful background`,
  'תודה רבה':               `${CHAR.HE.primary} holding both arms open in a heartfelt gesture of deep gratitude, beaming with a big warm appreciative smile, bright background`,
  'בבקשה':                  `${CHAR.HE.primary} at a colourful market stall with hands clasped in a polite "bevakasha — please" request expression, warm market setting`,
  'סליחה':                  `${CHAR.HE.primary} gently tapping a stranger on the shoulder with a polite apologetic expression, hand raised, busy market setting`,
  'מה שלומך':               `${CHAR.HE.primary} facing ${CHAR.HE.secondary} with a warm open questioning smile, sunny outdoor stone-paved setting`,
  'מצוין':                  `${CHAR.HE.primary} giving a cheerful thumbs-up with a bright happy smile, vibrant warm background`,
  // Transliterated aliases
  'shalom':                  `${CHAR.HE.primary} waving shalom with a warm smile to ${CHAR.HE.secondary} at a sunny Jerusalem market square`,
  'boker tov':               `${CHAR.HE.primary} in cozy pajamas holding coffee at a bright kitchen window, Mediterranean sunrise light`,
  'erev tov':                `${CHAR.HE.primary} and ${CHAR.HE.secondary} greeting warmly outside a warmly lit café at dusk`,
  'layla tov':               `${CHAR.HE.primary} waving goodnight from a lit doorway under a starry sky`,
  'lehitraot':               `${CHAR.HE.primary} waving a heartfelt farewell at an open doorway, warm light`,
  'toda':                    `${CHAR.HE.primary} pressing both palms together with a warm grateful smile`,
  'toda raba':               `${CHAR.HE.primary} holding arms open in a heartfelt gesture of deep gratitude`,
  'bevakasha':               `${CHAR.HE.primary} at a market stall with hands clasped in a polite please-expression, colourful market setting`,
  'slicha':                  `${CHAR.HE.primary} with a polite apologetic expression and a raised hand, excusing themselves`,
  'ma shlomcha':             `${CHAR.HE.primary} facing ${CHAR.HE.secondary} with a warm friendly "how are you?" expression`,
  'metzuyan':                `${CHAR.HE.primary} giving a cheerful thumbs-up with a bright happy smile`,

  // ── Greetings & Farewells — English ──────────────────────────────────────
  // Characters: Emma (primary) + Marcus (secondary) — see CHARACTER_PROFILES.EN
  'hello':              `${CHAR.EN.primary} and ${CHAR.EN.secondary} greeting each other with warm smiles at a sunny city park`,
  'hi':                 `${CHAR.EN.primary} spotting ${CHAR.EN.secondary} across a sunny café and waving a casual hi with a big friendly smile`,
  'good morning':       `${CHAR.EN.primary} in cozy pajamas holding a steaming mug of coffee, smiling at a bright kitchen window with golden sunrise light streaming through the glass`,
  'good afternoon':     `${CHAR.EN.primary} and ${CHAR.EN.secondary} meeting up at a sunny outdoor café in the afternoon, both smiling and waving, golden afternoon light`,
  'good evening':       `${CHAR.EN.primary} and ${CHAR.EN.secondary} exchanging warm good evening greetings at the entrance of a cozy warmly lit restaurant at dusk, amber light spilling from the open door`,
  'good night':         `${CHAR.EN.primary} waving goodnight from a warmly lit doorway under a calm starry sky, a crescent moon visible, soft interior lamp light`,
  'goodbye':            `${CHAR.EN.primary} waving a warm goodbye from an open doorway with a warm smile, ${CHAR.EN.grandma} standing on the porch waving back warmly, soft afternoon light`,
  'bye':                `${CHAR.EN.primary} and ${CHAR.EN.secondary} parting cheerfully at a bus stop, both turning to wave a casual bye with big smiles, bright urban setting`,
  'see you later':      `${CHAR.EN.primary} and ${CHAR.EN.secondary} parting at a park gate, both turning to wave "see you later" over their shoulders with warm smiles, sunny afternoon`,
  'see you soon':       `${CHAR.EN.primary} giving ${CHAR.EN.grandma} a warm farewell hug at a sunny doorstep, both smiling happily`,
  'nice to meet you':   `${CHAR.EN.primary} and ${CHAR.EN.secondary} shaking hands warmly for the first time at a bright friendly setting, both smiling with a genuine pleased-to-meet-you expression`,
  'please':             `${CHAR.EN.primary} at a café counter with hands clasped in a polite please-expression, warm cozy interior, friendly exchange`,
  'thank you':          `${CHAR.EN.primary} pressing both palms together with a genuine grateful smile and a warm nod of thanks, bright cheerful background`,
  'thanks':             `${CHAR.EN.primary} giving a casual wave of appreciation with a relaxed friendly smile, bright airy setting`,
  "you're welcome":     `${CHAR.EN.secondary} waving a relaxed "you're welcome" hand with a kind easygoing smile, bright cheerful setting`,
  'excuse me':          `${CHAR.EN.primary} gently tapping a stranger on the shoulder with a polite "excuse me" expression, hand slightly raised, busy street market setting`,
  'sorry':              `${CHAR.EN.primary} with a sincere apologetic expression placing hand on chest, a warm sorry gesture, bright setting`,
  'my pleasure':        `${CHAR.EN.secondary} gesturing "my pleasure" with an open gracious welcoming hand and a warm delighted smile, bright airy setting`,
  'how are you':        `${CHAR.EN.primary} walking toward ${CHAR.EN.secondary} on a sunny street, spreading arms open with a warm questioning "how are you?" smile, both smiling`,
  'how are you doing':  `${CHAR.EN.primary} and ${CHAR.EN.secondary} chatting at a friendly outdoor café, ${CHAR.EN.primary} leaning forward with a warm inquisitive "how are you doing?" expression`,
  'fine':               `${CHAR.EN.primary} giving a cheerful thumbs-up with a relaxed bright smile, warm sunny background`,
  'very well':          `${CHAR.EN.primary} spreading both arms wide open with a huge beaming smile of contentment, vibrant cheerful sunny background`,
  'not bad':            `${CHAR.EN.primary} tilting an open hand back and forth in a casual "not bad" gesture with a relaxed neutral-to-pleased smile, bright setting`,
  "i'm fine thank you": `${CHAR.EN.primary} giving a warm thumbs-up with a bright grateful smile and a gentle nod, radiating a cheerful "I'm fine, thank you" energy, sunny background`,

  // ── Adjective Pairs — Spanish ─────────────────────────────────────────────
  // Both words in each pair share the exact same SPLIT prompt so they render
  // the same contrast image regardless of which word is looked up first.
  'bueno':    SPLIT('bueno', 'a bright sunny day with a smiling happy face and a green checkmark', 'malo', 'a stormy grey sky with a frowning face and a red X'),
  'malo':     SPLIT('bueno', 'a bright sunny day with a smiling happy face and a green checkmark', 'malo', 'a stormy grey sky with a frowning face and a red X'),
  'grande':   SPLIT('grande', 'a large bold elephant filling the left panel', 'pequeño', 'a tiny mouse in the corner of the right panel'),
  'pequeno':  SPLIT('grande', 'a large bold elephant filling the left panel', 'pequeño', 'a tiny mouse in the corner of the right panel'),
  'caliente': SPLIT('caliente', 'a steaming red mug of hot liquid with rising heat waves', 'frío', 'an icy blue glass with visible frost and ice cubes'),
  'frio':     SPLIT('caliente', 'a steaming red mug of hot liquid with rising heat waves', 'frío', 'an icy blue glass with visible frost and ice cubes'),
  // feliz & triste — standalone emoji-style faces (not a SPLIT pair); each gets its own distinct image
  'feliz':    'a single large round emoji face with a wide beaming smile and bright sparkling eyes, golden yellow circle on a clean white background, modern flat vector emoji style, bold expressive features, no text, no other objects',
  'triste':   'a single large round emoji face with a deeply downturned mouth and big glistening teary eyes, pale blue circle on a clean white background, modern flat vector emoji style, bold expressive features, no text, no other objects',
  'rapido':   SPLIT('rápido', 'a bright red sports car with motion-blur speed lines', 'lento', 'a slow green turtle plodding along'),
  'lento':    SPLIT('rápido', 'a bright red sports car with motion-blur speed lines', 'lento', 'a slow green turtle plodding along'),
  'alto':     SPLIT('alto', 'a very tall giraffe stretching up to the sky', 'bajo', 'a tiny low-to-the-ground dachshund'),
  'bajo':     SPLIT('alto', 'a very tall giraffe stretching up to the sky', 'bajo', 'a tiny low-to-the-ground dachshund'),
  'nuevo':    SPLIT('nuevo', 'a shiny brand-new smartphone still in its glossy box', 'viejo', 'an old battered telephone with worn edges and dust'),
  'viejo':    SPLIT('nuevo', 'a shiny brand-new smartphone still in its glossy box', 'viejo', 'an old battered telephone with worn edges and dust'),
  'facil':    SPLIT('fácil', 'a person breezing through a task with a relaxed smile, simple clean path ahead', 'difícil', 'a person struggling and sweating over a tangled pile of papers'),
  'dificil':  SPLIT('fácil', 'a person breezing through a task with a relaxed smile, simple clean path ahead', 'difícil', 'a person struggling and sweating over a tangled pile of papers'),
  'abierto':  SPLIT('abierto', 'a wide open bright door with sunlight streaming in', 'cerrado', 'a firmly shut door with a closed sign'),
  'cerrado':  SPLIT('abierto', 'a wide open bright door with sunlight streaming in', 'cerrado', 'a firmly shut door with a closed sign'),
  'limpio':   SPLIT('limpio', 'a sparkling clean white plate gleaming under bright light', 'sucio', 'a dirty muddy plate covered in smudges and mess'),
  'sucio':    SPLIT('limpio', 'a sparkling clean white plate gleaming under bright light', 'sucio', 'a dirty muddy plate covered in smudges and mess'),
  'bonito':   SPLIT('bonito', 'a vibrant bouquet of colorful blooming flowers', 'feo', 'a wilted brown dead flower drooping sadly'),
  'feo':      SPLIT('bonito', 'a vibrant bouquet of colorful blooming flowers', 'feo', 'a wilted brown dead flower drooping sadly'),
  'largo':    SPLIT('largo', 'a very long stretching snake winding across the panel', 'corto', 'a tiny stub of a pencil that is barely usable'),
  'corto':    SPLIT('largo', 'a very long stretching snake winding across the panel', 'corto', 'a tiny stub of a pencil that is barely usable'),
  'joven':    SPLIT('joven', 'a young energetic teenager running with a bright smile', 'viejo', 'an elderly person with grey hair walking slowly with a cane'),
  'gordo':    SPLIT('gordo', 'a large round bouncy ball filling most of the panel', 'delgado', 'a slim thin pencil standing upright'),
  'delgado':  SPLIT('gordo', 'a large round bouncy ball filling most of the panel', 'delgado', 'a slim thin pencil standing upright'),
  'rico':     SPLIT('rico', 'an elegant set table with fancy dishes and sparkling cutlery', 'pobre', 'a bare empty table with nothing on it'),
  'pobre':    SPLIT('rico', 'an elegant set table with fancy dishes and sparkling cutlery', 'pobre', 'a bare empty table with nothing on it'),
  'caro':     SPLIT('caro', 'a glittering diamond ring with a high price tag attached', 'barato', 'a simple coin with a tiny price sticker'),
  'barato':   SPLIT('caro', 'a glittering diamond ring with a high price tag attached', 'barato', 'a simple coin with a tiny price sticker'),
  'fuerte':   SPLIT('fuerte', 'a muscular arm flexing with bold thick lines', 'debil', 'a thin weak arm barely able to lift a small weight'),
  'debil':    SPLIT('fuerte', 'a muscular arm flexing with bold thick lines', 'debil', 'a thin weak arm barely able to lift a small weight'),
  'lleno':    SPLIT('lleno', 'a completely full glass of water to the brim', 'vacio', 'a completely empty glass with nothing in it'),
  'vacio':    SPLIT('lleno', 'a completely full glass of water to the brim', 'vacio', 'a completely empty glass with nothing in it'),
  'oscuro':   SPLIT('oscuro', 'a very dark dim room lit only by a tiny candle', 'claro', 'a bright sunny well-lit room with big windows flooding light'),
  'claro':    SPLIT('oscuro', 'a very dark dim room lit only by a tiny candle', 'claro', 'a bright sunny well-lit room with big windows flooding light'),

  // ── Adjective Pairs — French ──────────────────────────────────────────────
  'bon':        SPLIT('bon', 'a bright sunny day with a smiling happy face and a green checkmark', 'mauvais', 'a stormy grey sky with a frowning face and a red X'),
  'mauvais':    SPLIT('bon', 'a bright sunny day with a smiling happy face and a green checkmark', 'mauvais', 'a stormy grey sky with a frowning face and a red X'),
  'grand':      SPLIT('grand', 'a large bold elephant filling the left panel', 'petit', 'a tiny mouse in the corner of the right panel'),
  'petit':      SPLIT('grand', 'a large bold elephant filling the left panel', 'petit', 'a tiny mouse in the corner of the right panel'),
  'chaud':      SPLIT('chaud', 'a steaming red mug of hot liquid with rising heat waves', 'froid', 'an icy blue glass with visible frost and ice cubes'),
  'froid':      SPLIT('chaud', 'a steaming red mug of hot liquid with rising heat waves', 'froid', 'an icy blue glass with visible frost and ice cubes'),
  'heureux':    SPLIT('heureux', 'a person with a huge grin and hands raised in joy, sunny background', 'triste', 'a person with tears and a deep frown, blue background'),
  'rapide':     SPLIT('rapide', 'a bright red sports car with motion-blur speed lines', 'lent', 'a slow green turtle plodding along'),
  'lent':       SPLIT('rapide', 'a bright red sports car with motion-blur speed lines', 'lent', 'a slow green turtle plodding along'),
  'nouveau':    SPLIT('nouveau', 'a shiny brand-new smartphone in its glossy box', 'vieux', 'an old battered telephone with worn edges'),
  'vieux':      SPLIT('nouveau', 'a shiny brand-new smartphone in its glossy box', 'vieux', 'an old battered telephone with worn edges'),
  'facile':     SPLIT('facile', 'a person breezing through a task with a relaxed smile', 'difficile', 'a person struggling over a tangled pile of papers'),
  'difficile':  SPLIT('facile', 'a person breezing through a task with a relaxed smile', 'difficile', 'a person struggling over a tangled pile of papers'),
  'ouvert':     SPLIT('ouvert', 'a wide open bright door with sunlight streaming in', 'ferme', 'a firmly shut door with a closed sign'),
  'ferme':      SPLIT('ouvert', 'a wide open bright door with sunlight streaming in', 'ferme', 'a firmly shut door with a closed sign'),
  'propre':     SPLIT('propre', 'a sparkling clean white plate gleaming under light', 'sale', 'a dirty muddy plate covered in smudges'),
  'sale':       SPLIT('propre', 'a sparkling clean white plate gleaming under light', 'sale', 'a dirty muddy plate covered in smudges'),
  'beau':       SPLIT('beau', 'a vibrant bouquet of colorful blooming flowers', 'laid', 'a wilted brown dead flower drooping sadly'),
  'laid':       SPLIT('beau', 'a vibrant bouquet of colorful blooming flowers', 'laid', 'a wilted brown dead flower drooping sadly'),
  'long':       SPLIT('long', 'a very long stretching snake winding across the panel', 'court', 'a tiny stub of pencil that is barely usable'),
  'court':      SPLIT('long', 'a very long stretching snake winding across the panel', 'court', 'a tiny stub of pencil that is barely usable'),
  'plein':      SPLIT('plein', 'a completely full glass of water to the brim', 'vide', 'a completely empty glass with nothing in it'),
  'vide':       SPLIT('plein', 'a completely full glass of water to the brim', 'vide', 'a completely empty glass with nothing in it'),

  // ── Adjective Pairs — German ──────────────────────────────────────────────
  'gut':          SPLIT('gut', 'a bright sunny day with a smiling happy face and a green checkmark', 'schlecht', 'a stormy grey sky with a frowning face and a red X'),
  'schlecht':     SPLIT('gut', 'a bright sunny day with a smiling happy face and a green checkmark', 'schlecht', 'a stormy grey sky with a frowning face and a red X'),
  // groß/klein — ß is kept by normalizer (not a combining diacritic)
  'groß':         SPLIT('groß', 'a large bold elephant filling the left panel', 'klein', 'a tiny mouse in the corner of the right panel'),
  'klein':        SPLIT('groß', 'a large bold elephant filling the left panel', 'klein', 'a tiny mouse in the corner of the right panel'),
  'heiß':         SPLIT('heiß', 'a steaming red mug of hot liquid with rising heat waves', 'kalt', 'an icy blue glass with frost and ice cubes'),
  'kalt':         SPLIT('heiß', 'a steaming red mug of hot liquid with rising heat waves', 'kalt', 'an icy blue glass with frost and ice cubes'),
  'glucklich':    SPLIT('glücklich', 'a person with a huge grin and hands raised in joy, sunny background', 'traurig', 'a person with tears and a deep frown, blue background'),
  'traurig':      SPLIT('glücklich', 'a person with a huge grin and hands raised in joy, sunny background', 'traurig', 'a person with tears and a deep frown, blue background'),
  'schnell':      SPLIT('schnell', 'a bright red sports car with motion-blur speed lines', 'langsam', 'a slow green turtle plodding along'),
  'langsam':      SPLIT('schnell', 'a bright red sports car with motion-blur speed lines', 'langsam', 'a slow green turtle plodding along'),
  'neu':          SPLIT('neu', 'a shiny brand-new smartphone in its glossy box', 'alt', 'an old battered telephone with worn edges'),
  'alt':          SPLIT('neu', 'a shiny brand-new smartphone in its glossy box', 'alt', 'an old battered telephone with worn edges'),
  'einfach':      SPLIT('einfach', 'a person breezing through a task with a relaxed smile', 'schwer', 'a person struggling over a tangled pile of papers'),
  'schwer':       SPLIT('einfach', 'a person breezing through a task with a relaxed smile', 'schwer', 'a person struggling over a tangled pile of papers'),
  'offen':        SPLIT('offen', 'a wide open bright door with sunlight streaming in', 'geschlossen', 'a firmly shut door with a closed sign'),
  'geschlossen':  SPLIT('offen', 'a wide open bright door with sunlight streaming in', 'geschlossen', 'a firmly shut door with a closed sign'),
  'sauber':       SPLIT('sauber', 'a sparkling clean white plate gleaming under light', 'schmutzig', 'a dirty muddy plate covered in smudges'),
  'schmutzig':    SPLIT('sauber', 'a sparkling clean white plate gleaming under light', 'schmutzig', 'a dirty muddy plate covered in smudges'),
  'voll':         SPLIT('voll', 'a completely full glass of water to the brim', 'leer', 'a completely empty glass with nothing in it'),
  'leer':         SPLIT('voll', 'a completely full glass of water to the brim', 'leer', 'a completely empty glass with nothing in it'),

  // ── Adjective Pairs — Italian ─────────────────────────────────────────────
  'buono':       SPLIT('buono', 'a bright sunny day with a smiling happy face and a green checkmark', 'cattivo', 'a stormy grey sky with a frowning face and a red X'),
  'cattivo':     SPLIT('buono', 'a bright sunny day with a smiling happy face and a green checkmark', 'cattivo', 'a stormy grey sky with a frowning face and a red X'),
  'piccolo':     SPLIT('grande', 'a large bold elephant filling the left panel', 'piccolo', 'a tiny mouse in the corner of the right panel'),
  'caldo':       SPLIT('caldo', 'a steaming red mug of hot liquid with rising heat waves', 'freddo', 'an icy blue glass with frost and ice cubes'),
  'freddo':      SPLIT('caldo', 'a steaming red mug of hot liquid with rising heat waves', 'freddo', 'an icy blue glass with frost and ice cubes'),
  'felice':      SPLIT('felice', 'a person with a huge grin and hands raised in joy, sunny background', 'triste', 'a person with tears and a deep frown, blue background'),
  'veloce':      SPLIT('veloce', 'a bright red sports car with motion-blur speed lines', 'lento', 'a slow green turtle plodding along'),
  'bello':       SPLIT('bello', 'a vibrant bouquet of colorful blooming flowers', 'brutto', 'a wilted brown dead flower drooping sadly'),
  'brutto':      SPLIT('bello', 'a vibrant bouquet of colorful blooming flowers', 'brutto', 'a wilted brown dead flower drooping sadly'),
  'aperto':      SPLIT('aperto', 'a wide open bright door with sunlight streaming in', 'chiuso', 'a firmly shut door with a closed sign'),
  'chiuso':      SPLIT('aperto', 'a wide open bright door with sunlight streaming in', 'chiuso', 'a firmly shut door with a closed sign'),
  'pulito':      SPLIT('pulito', 'a sparkling clean white plate gleaming under light', 'sporco', 'a dirty muddy plate covered in smudges'),
  'sporco':      SPLIT('pulito', 'a sparkling clean white plate gleaming under light', 'sporco', 'a dirty muddy plate covered in smudges'),
  'pieno':       SPLIT('pieno', 'a completely full glass of water to the brim', 'vuoto', 'a completely empty glass with nothing in it'),
  'vuoto':       SPLIT('pieno', 'a completely full glass of water to the brim', 'vuoto', 'a completely empty glass with nothing in it'),

  // ── Adjective Pairs — Portuguese ─────────────────────────────────────────
  'bom':        SPLIT('bom', 'a bright sunny day with a smiling happy face and a green checkmark', 'mau', 'a stormy grey sky with a frowning face and a red X'),
  'mau':        SPLIT('bom', 'a bright sunny day with a smiling happy face and a green checkmark', 'mau', 'a stormy grey sky with a frowning face and a red X'),
  'ruim':       SPLIT('bom', 'a bright sunny day with a smiling happy face and a green checkmark', 'ruim', 'a stormy grey sky with a frowning face and a red X'),
  // grande / pequeno (normalizes from pequeno — without ñ, Portuguese doesn't use ñ)
  'quente':     SPLIT('quente', 'a steaming red mug of hot liquid with rising heat waves', 'frio', 'an icy blue glass with frost and ice cubes'),
  // frio / feliz / triste / rapido / lento / facil / dificil all shared with Spanish entries above
  'baixo':      SPLIT('alto', 'a very tall giraffe stretching up to the sky', 'baixo', 'a tiny low-to-the-ground dachshund'),
  'novo':       SPLIT('novo', 'a shiny brand-new smartphone in its glossy box', 'velho', 'an old battered telephone with worn edges'),
  'velho':      SPLIT('novo', 'a shiny brand-new smartphone in its glossy box', 'velho', 'an old battered telephone with worn edges'),
  'aberto':     SPLIT('aberto', 'a wide open bright door with sunlight streaming in', 'fechado', 'a firmly shut door with a closed sign'),
  'fechado':    SPLIT('aberto', 'a wide open bright door with sunlight streaming in', 'fechado', 'a firmly shut door with a closed sign'),
  'limpo':      SPLIT('limpo', 'a sparkling clean white plate gleaming under light', 'sujo', 'a dirty muddy plate covered in smudges'),
  'sujo':       SPLIT('limpo', 'a sparkling clean white plate gleaming under light', 'sujo', 'a dirty muddy plate covered in smudges'),
  'cheio':      SPLIT('cheio', 'a completely full glass of water to the brim', 'vazio', 'a completely empty glass with nothing in it'),
  'vazio':      SPLIT('cheio', 'a completely full glass of water to the brim', 'vazio', 'a completely empty glass with nothing in it'),

  // ── Emotions — modern emoji-style faces (race/language neutral, shared across all languages) ──
  // Each entry produces one bold emoji face on a colored circle. Language-neutral by design.
  // Emoji style is preferred: round face, exaggerated features, simple flat design, no people portraits.
  'enojado':          'a single large round emoji face with deeply furrowed brows, clenched teeth, and a hot angry flush, bright red-orange circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'enojada':          'a single large round emoji face with deeply furrowed brows, clenched teeth, and a hot angry flush, bright red-orange circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'enfadado':         'a single large round emoji face with deeply furrowed brows, clenched teeth, and a hot angry flush, bright red-orange circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'molesto':          'a single large round emoji face with deeply furrowed brows, clenched teeth, and a hot angry flush, bright red-orange circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'nervioso':         'a single large round emoji face with wide jittery eyes, a wavy uncertain mouth, and sweat drop on forehead, pale green circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'nerviosa':         'a single large round emoji face with wide jittery eyes, a wavy uncertain mouth, and sweat drop on forehead, pale green circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'ansioso':          'a single large round emoji face with wide jittery eyes, a wavy uncertain mouth, and sweat drop on forehead, pale green circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'sorprendido':      'a single large round emoji face with eyebrows shooting up, huge round eyes, and a wide open O-shaped mouth, bright white circle on a clean white background with a light gray ring, modern bold flat emoji style, no text, no other objects',
  'sorprendida':      'a single large round emoji face with eyebrows shooting up, huge round eyes, and a wide open O-shaped mouth, bright white circle on a clean white background with a light gray ring, modern bold flat emoji style, no text, no other objects',
  'asombrado':        'a single large round emoji face with eyebrows shooting up, huge round eyes, and a wide open O-shaped mouth, bright white circle on a clean white background with a light gray ring, modern bold flat emoji style, no text, no other objects',
  'aburrido':         'a single large round emoji face with heavy half-closed eyelids, a flat uninterested mouth, and one cheek resting on a hand, muted gray circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'aburrida':         'a single large round emoji face with heavy half-closed eyelids, a flat uninterested mouth, and one cheek resting on a hand, muted gray circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'aburrimiento':     'a single large round emoji face with heavy half-closed eyelids, a flat uninterested mouth, and one cheek resting on a hand, muted gray circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'asustado':         'a single large round emoji face with enormous frightened eyes, eyebrows arched to the top, and a screaming open mouth, pale purple-blue circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'asustada':         'a single large round emoji face with enormous frightened eyes, eyebrows arched to the top, and a screaming open mouth, pale purple-blue circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'atemorizado':      'a single large round emoji face with enormous frightened eyes, eyebrows arched to the top, and a screaming open mouth, pale purple-blue circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'cansado':          'a single large round emoji face with drooping sleepy eyelids, a wide yawning open mouth, and a small ZZZ above the head, soft indigo-blue circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'cansada':          'a single large round emoji face with drooping sleepy eyelids, a wide yawning open mouth, and a small ZZZ above the head, soft indigo-blue circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'agotado':          'a single large round emoji face with drooping sleepy eyelids, a wide yawning open mouth, and a small ZZZ above the head, soft indigo-blue circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'avergonzado':      'a single large round emoji face with rosy red cheeks, wide eyes looking sideways, and a nervous closed-mouth smile, soft pink circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'avergonzada':      'a single large round emoji face with rosy red cheeks, wide eyes looking sideways, and a nervous closed-mouth smile, soft pink circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'verguenza':        'a single large round emoji face with rosy red cheeks, wide eyes looking sideways, and a nervous closed-mouth smile, soft pink circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'emocionado':       'a single large round emoji face with a huge excited grin showing teeth, bright sparkling star-shaped eyes, and tiny party lines around it, vibrant orange-yellow circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'emocionada':       'a single large round emoji face with a huge excited grin showing teeth, bright sparkling star-shaped eyes, and tiny party lines around it, vibrant orange-yellow circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'entusiasmado':     'a single large round emoji face with a huge excited grin showing teeth, bright sparkling star-shaped eyes, and tiny party lines around it, vibrant orange-yellow circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'orgulloso':        'a single large round emoji face with a smug satisfied smile, eyebrows slightly raised in pride, chest-puffed look, warm golden circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'orgullosa':        'a single large round emoji face with a smug satisfied smile, eyebrows slightly raised in pride, chest-puffed look, warm golden circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'alegre':           'a single large round emoji face with a wide beaming smile, bright cheerful eyes, and small sparkle lines around it, bright warm yellow circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  // Cross-language emotion synonyms — same emoji concept as Spanish originals (language-neutral)
  'triste':           'a single large round emoji face with a deeply downturned mouth and big glistening teary eyes, pale blue circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'heureux':          'a single large round emoji face with a wide beaming smile and bright sparkling eyes, golden yellow circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'heureuse':         'a single large round emoji face with a wide beaming smile and bright sparkling eyes, golden yellow circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'en colere':        'a single large round emoji face with deeply furrowed brows, clenched teeth, and a hot angry flush, bright red-orange circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'nerveux':          'a single large round emoji face with wide jittery eyes, a wavy uncertain mouth, and sweat drop on forehead, pale green circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'surpris':          'a single large round emoji face with eyebrows shooting up, huge round eyes, and a wide open O-shaped mouth, bright white circle with light gray ring, modern bold flat emoji style, no text, no other objects',
  'fatigue':          'a single large round emoji face with drooping sleepy eyelids, a wide yawning open mouth, soft indigo-blue circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'ennuye':           'a single large round emoji face with heavy half-closed eyelids and a flat uninterested mouth, muted gray circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'effraye':          'a single large round emoji face with enormous frightened eyes, eyebrows arched to the top, and a screaming open mouth, pale purple-blue circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'excite':           'a single large round emoji face with a huge excited grin, sparkling star-shaped eyes, vibrant orange-yellow circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  // German
  'glucklich':        'a single large round emoji face with a wide beaming smile and bright sparkling eyes, golden yellow circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'traurig':          'a single large round emoji face with a deeply downturned mouth and big glistening teary eyes, pale blue circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'wutend':           'a single large round emoji face with deeply furrowed brows and clenched teeth, bright red-orange circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'uberrascht':       'a single large round emoji face with eyebrows shooting up and a wide O-shaped mouth, bright white circle with light gray ring, modern bold flat emoji style, no text, no other objects',
  'mude':             'a single large round emoji face with drooping sleepy eyelids and a yawning mouth, soft indigo-blue circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'gelangweilt':      'a single large round emoji face with heavy half-closed eyelids and a flat uninterested mouth, muted gray circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'angstlich':        'a single large round emoji face with enormous frightened eyes and a screaming open mouth, pale purple-blue circle on a clean white background, modern bold flat emoji style, no text, no other objects',
  'aufgeregt':        'a single large round emoji face with a huge excited grin and sparkling star-shaped eyes, vibrant orange-yellow circle on a clean white background, modern bold flat emoji style, no text, no other objects',

  // ── Food items — force still-life framing so DALL-E doesn't add a person ──
  'legumbres':       'a colorful close-up arrangement of mixed legumes — kidney beans, brown lentils, chickpeas, and black beans — in small rustic clay bowls on a wooden table, soft warm watercolor food illustration, no people',
  'las legumbres':   'a colorful close-up arrangement of mixed legumes — kidney beans, brown lentils, chickpeas, and black beans — in small rustic clay bowls on a wooden table, soft warm watercolor food illustration, no people',
  'verduras':        'a fresh colorful arrangement of vegetables — broccoli, carrots, peppers, and tomatoes — on a wooden table, soft warm watercolor food illustration, no people',
  'las verduras':    'a fresh colorful arrangement of vegetables — broccoli, carrots, peppers, and tomatoes — on a wooden table, soft warm watercolor food illustration, no people',
  'frutas':          'a colorful basket overflowing with fresh fruits — apples, oranges, bananas, and strawberries — soft warm watercolor food illustration, no people',
  'las frutas':      'a colorful basket overflowing with fresh fruits — apples, oranges, bananas, and strawberries — soft warm watercolor food illustration, no people',
  'mariscos':        'a rustic seafood platter with shrimp, mussels, and clams arranged on crushed ice, no people',
  'los mariscos':    'a rustic seafood platter with shrimp, mussels, and clams arranged on crushed ice, no people',

  // ── Self-introduction phrases — CULTURALLY DRIVEN (one image per language) ─
  // These are CHARACTER ACTION overrides.  Do NOT embed a character name here —
  // LANGUAGE_CHARACTER_INTROS in vocabulary-image-resolver.ts prepends the
  // language's character automatically (Daniela for ES, Giulia for IT, etc.).
  // Equivalent phrases across all 9 languages share the SAME action description
  // so every student sees their language's character introducing themselves.
  //
  // Spanish
  'me llamo':                  'warmly pressing a hand to their chest and pointing to themselves with a confident friendly smile, making a self-introduction gesture',
  'me llamo...':               'warmly pressing a hand to their chest and pointing to themselves with a confident friendly smile, making a self-introduction gesture',
  'me llamo your name':        'warmly pressing a hand to their chest and pointing to themselves with a confident friendly smile, making a self-introduction gesture',
  // Italian
  'mi chiamo':                 'warmly pressing a hand to their chest and pointing to themselves with a confident friendly smile, making a self-introduction gesture',
  // French
  'je mappelle':               'warmly pressing a hand to their chest and pointing to themselves with a confident friendly smile, making a self-introduction gesture',
  'je m appelle':              'warmly pressing a hand to their chest and pointing to themselves with a confident friendly smile, making a self-introduction gesture',
  // German
  'ich heisse':                'warmly pressing a hand to their chest and pointing to themselves with a confident friendly smile, making a self-introduction gesture',
  'ich bin':                   'warmly pressing a hand to their chest and pointing to themselves with a confident friendly smile, making a self-introduction gesture',
  // Portuguese
  'me chamo':                  'warmly pressing a hand to their chest and pointing to themselves with a confident friendly smile, making a self-introduction gesture',
  'meu nome e':                'warmly pressing a hand to their chest and pointing to themselves with a confident friendly smile, making a self-introduction gesture',
  // English
  'my name is':                'warmly pressing a hand to their chest and pointing to themselves with a confident friendly smile, making a self-introduction gesture',
  // Japanese
  'watashi no namae wa':       'warmly pressing a hand to their chest and pointing to themselves with a confident friendly smile, making a self-introduction gesture',
  // Korean
  'je ireumeun':               'warmly pressing a hand to their chest and pointing to themselves with a confident friendly smile, making a self-introduction gesture',
  // Mandarin
  'wode mingzi shi':           'warmly pressing a hand to their chest and pointing to themselves with a confident friendly smile, making a self-introduction gesture',
  // "desayunar" / "yo desayuno" → morning breakfast scene
  'desayunar':                 'cozy breakfast table scene with a bowl of cereal, toast, orange juice glass, and a small plant, morning sunlight streaming in through a window, no people, soft watercolor children\'s book illustration style, warm gentle colors, no text no words',
  'el desayuno':               'cozy breakfast table scene with a bowl of cereal, toast, orange juice glass, and a small plant, morning sunlight streaming in through a window, no people, soft watercolor children\'s book illustration style, warm gentle colors, no text no words',
  'yo desayuno':               'cozy breakfast table scene with a bowl of cereal, toast, orange juice glass, and a small plant, morning sunlight streaming in through a window, no people, soft watercolor children\'s book illustration style, warm gentle colors, no text no words',
  'desayuno':                  'cozy breakfast table scene with a bowl of cereal, toast, orange juice glass, and a small plant, morning sunlight streaming in through a window, no people, soft watercolor children\'s book illustration style, warm gentle colors, no text no words',
  // "más despacio, por favor" → gentle slow-down gesture
  'mas despacio por favor':    'a person calmly holding up one open palm in a gentle "slow down" gesture, patient and kind expression, soft watercolor children\'s book illustration style, warm gentle colors, clean fine ink outlines, no text no words',
  'mas despacio':              'a person calmly holding up one open palm in a gentle "slow down" gesture, patient and kind expression, soft watercolor children\'s book illustration style, warm gentle colors, clean fine ink outlines, no text no words',
  // "no entiendo" → friendly puzzled shrug
  'no entiendo':               'a young student with a gentle puzzled expression, head tilted slightly, soft question mark doodle floating nearby, friendly and relatable, soft watercolor children\'s book illustration style, warm gentle colors, clean fine ink outlines, no text no words',
  'no comprendo':              'a young student with a gentle puzzled expression, head tilted slightly, soft question mark doodle floating nearby, friendly and relatable, soft watercolor children\'s book illustration style, warm gentle colors, clean fine ink outlines, no text no words',
  // "¿qué significa?" / "¿cómo se dice?" — already 4-word filtered on frontend, but give them decent images if they slip through
  'que significa':             'a person pointing at a word on a chalkboard with a curious expression, thought bubble with a question mark, soft watercolor children\'s book illustration style, no text in image no words',
  'como se dice':              'two friends having a friendly conversation, one pointing to their mouth while speaking, the other listening attentively, soft watercolor children\'s book illustration style, no text no words',
  // ── Health & Body — avoid literal/graphic AI interpretations ──────────────
  // "dolor" / "el dolor" → mild relatable discomfort, NOT a dramatic heart or wound
  'dolor':           'a young woman sitting down, gently pressing her fingertips to her temple with a mild wince, soft warm watercolor, no blood or wounds',
  'el dolor':        'a young woman sitting down, gently pressing her fingertips to her temple with a mild wince, soft warm watercolor, no blood or wounds',
  'pain':            'a person gently holding their shoulder with a slightly pained expression, mild and relatable',
  'duele':           'a person gently rubbing their knee with a slight frown',
  'me duele':        'a person gently holding their head with a slight uncomfortable expression',
  'fiebre':          'a person lying in bed with a warm blanket pulled up, holding a thermometer, soft warm watercolor',
  'la fiebre':       'a person lying in bed with a warm blanket pulled up, holding a thermometer, soft warm watercolor',
  'enfermo':         'a person in pajamas sitting in an armchair wrapped in a blanket looking unwell',
  'enferma':         'a person in pajamas sitting in an armchair wrapped in a blanket looking unwell',
  'el resfriado':    'a person wrapped in a cozy scarf blowing their nose with a tissue, warm soft watercolor',
  'la gripe':        'a person in bed with a box of tissues nearby and a warm mug',
  'la tos':          'a person covering their mouth while coughing, wearing a scarf, soft warm watercolor',
  'el médico':       'a friendly doctor in a white coat holding a clipboard with a warm smile',
  'la enfermera':    'a kind nurse in scrubs holding a clipboard with a gentle expression',
  'el hospital':     'a clean bright hospital building with a red cross sign',
  'la farmacia':     'a bright pharmacy storefront with colorful medicine boxes visible through the window',

  // ── Ordering & shopping — CULTURALLY DRIVEN ────────────────────────────
  // Character-action overrides — character auto-injected per language.
  // "¿Cuánto cuesta?" — asking the price at a market
  'cuanto cuesta':   'pointing inquisitively at a handcrafted item on a colorful outdoor market stall with a curious expression, vibrant produce and goods visible in the background',
  // Drinks ordering
  // NOTE: "una cerveza" replaced with "una horchata" — a culturally authentic
  // non-alcoholic rice-milk drink served at Mexican and Latin American markets.
  // Update curriculum drill items to "una horchata, por favor" when revising lessons.
  'una cerveza por favor':  'a tall sweating glass of creamy pale horchata with ice cubes and a cinnamon stick resting on the rim, small bowl of ground cinnamon and a few grains of rice beside it, warm adobe-toned cantina table, soft watercolor children\'s book illustration style, no people, no text',
  'una horchata por favor': 'a tall sweating glass of creamy pale horchata with ice cubes and a cinnamon stick resting on the rim, small bowl of ground cinnamon and a few grains of rice beside it, warm adobe-toned cantina table, soft watercolor children\'s book illustration style, no people, no text',
  'horchata':               'a tall sweating glass of creamy pale horchata with ice cubes and a cinnamon stick resting on the rim, small bowl of ground cinnamon beside it, warm adobe-toned cantina table, soft watercolor children\'s book illustration style, no people, no text',
};

/**
 * Normalize a word for SCENE_OVERRIDES lookup:
 * lowercase + remove accent marks + strip punctuation (¿?¡!,;:).
 * This lets "¿cómo estás?" match the key 'como estas', and
 * "muy bien, gracias" match 'muy bien gracias', etc.
 */
export function normalizeForOverride(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip Latin accents only
    .normalize('NFC')                   // re-compose so CJK/Hangul/kana stays intact
    .replace(/[¿¡?!,;:、，。]/g, ' ')  // replace punctuation with space (preserves word boundaries)
    // Strip leading/trailing quotation marks that act as wrappers around a word/phrase
    // (e.g. drill target_text "'Hello'" → "hello", not "'hello'").
    // Single-char apostrophes mid-word (French/Italian contractions) are left intact
    // because they are stripped later only at the boundaries via trim-like anchors.
    .replace(/^['"''""\s]+|['"''""\s]+$/g, '')
    .replace(/\s+/g, ' ')              // collapse multiple spaces to one
    .trim();
}

/**
 * Normalize a word to its cache key form, matching the logic in vocabulary-image-resolver.ts.
 * Format: vocab_{language}_{normalizedWord}
 */
export function toCacheKey(language: string, word: string): string {
  const normalized = word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip Latin diacritics only
    // Re-compose so Hangul Jamo produced by NFD decomposition recombine into
    // syllable blocks — otherwise Korean words normalize to empty string.
    .normalize('NFC')
    // Replace CJK/Japanese/Arabic punctuation with a space to preserve word boundaries,
    // mirroring the normalizeWord() fix in vocabulary-image-resolver.ts so keys align.
    // e.g. "元気です、ありがとう" → "元気です ありがとう" (not "元気ですありがとう")
    .replace(/[\u3001\u3002\uff0c\uff01\uff1f\uff1a\uff1b\u300c\u300d\u300e\u300f\u3008-\u3011\u30fb\u060c\u061b\u061f]/g, ' ')
    // Preserve CJK, Hangul syllables + Jamo, Hiragana/Katakana, Hebrew, Arabic, Cyrillic.
    // Strip remaining punctuation/symbols (Latin apostrophes, ¿, ¡, etc.)
    .replace(/[^a-z0-9\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\u0590-\u05FF\u0600-\u06FF\u0400-\u04FF\s]/g, '')
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
export const NUMBERS_DAYS_WORDS: Record<string, string[]> = {
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
  // Japanese, Korean, Mandarin: toCacheKey preserves CJK/Hangul/Hiragana scripts,
  // so we use the actual script words to generate the correct cache keys to bust.
  japanese: [
    'ゼロ','いち','に','さん','よん','ご','ろく','なな','はち','きゅう','じゅう',
    'じゅういち','じゅうに','じゅうさん','じゅうよん','じゅうご',
    'じゅうろく','じゅうなな','じゅうはち','じゅうきゅう','にじゅう',
  ],
  korean: [
    '영','일','이','삼','사','오','육','칠','팔','구','십',
    '십일','십이','십삼','십사','십오','십육','십칠','십팔','십구','이십',
  ],
  mandarin: [
    '零','一','二','三','四','五','六','七','八','九','十',
    '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
  ],
};

export const NUMBERS_DAYS_CACHE_KEYS: Record<string, string[]> = Object.fromEntries(
  Object.entries(NUMBERS_DAYS_WORDS).map(([lang, words]) => [
    lang,
    words.map(w => toCacheKey(lang, w)),
  ])
);

// ── Greetings cache keys (per language) ────────────────────────────────────
export const GREETINGS_WORDS: Record<string, string[]> = {
  spanish: [
    'hola','buenos días','buenas tardes','buenas noches','adiós','hasta luego',
    'hasta mañana','hasta pronto','mucho gusto','encantado','encantada',
    '¿cómo estás?','¿cómo está usted?','bien','muy bien','muy bien, gracias','mal','más o menos','regular',
    'por favor','gracias','muchas gracias','de nada','perdón','disculpe','lo siento',
  ],
  french: [
    'bonjour','bonsoir','bonne nuit','au revoir','salut','à bientôt','à demain',
    's\'il vous plaît','merci','merci beaucoup','de rien','excusez-moi','pardon','enchanté',
    'comment allez-vous','très bien merci',
  ],
  german: [
    'Hallo','guten Morgen','guten Tag','guten Abend','gute Nacht','auf Wiedersehen','tschüss',
    'bitte','danke','danke schön','bitte schön','Entschuldigung',
    'bis später','freut mich','wie geht es ihnen','mir geht es gut danke',
  ],
  italian: [
    'ciao','buongiorno','buonasera','buonanotte','arrivederci',
    'prego','grazie','per favore','mi chiamo','come stai','come sta',
    'a domani','a presto','piacere','sto bene grazie',
  ],
  portuguese: [
    'olá','oi','bom dia','boa tarde','boa noite','adeus','até logo','até amanhã','tchau',
    'obrigado','obrigada','de nada','com licença','desculpe',
    'como está','estou bem obrigado','prazer em conhecê-lo',
  ],
  english: [
    'hello','hi','good morning','good afternoon','good evening','good night',
    'goodbye','bye','see you later','see you soon','nice to meet you',
    'please','thank you','thanks','you\'re welcome','excuse me','sorry','my pleasure',
    'how are you','how are you doing','fine','very well','not bad','i\'m fine thank you',
  ],
  // Both native-script and romaji/transliterated forms are included now that toCacheKey
  // preserves CJK, Hangul, and Hebrew characters (matching vocabulary-image-resolver).
  japanese: [
    // Native script (primary keys in resolver)
    'こんにちは','おはようございます','おはよう','こんばんは','おやすみなさい','おやすみ',
    'さようなら','またね','じゃあね','ありがとうございます','ありがとう',
    'すみません','ごめんなさい','どういたしまして','はじめまして',
    'よろしくおねがいします','おげんきですか',
    'お元気ですか','また明日','元気です ありがとう',
    // Romaji aliases
    'konnichiwa','ohayou gozaimasu','ohayou','konbanwa','oyasumi nasai','oyasumi',
    'sayounara','mata ne','ja ne','arigatou gozaimasu','arigatou',
    'sumimasen','gomennasai','dou itashimashite','hajimemashite',
    'yoroshiku onegaishimasu','ogenki desu ka',
    'mata ashita','genki desu arigatou',
  ],
  korean: [
    // Native script (primary keys in resolver)
    '안녕하세요','안녕','안녕히 가세요','안녕히 계세요',
    '감사합니다','고맙습니다','고마워요','죄송합니다','미안해요','괜찮아요','천만에요',
    '좋은 아침이에요','잘 자요','잘 지내요 감사합니다','어떻게 지내세요',
    '내일 봐요','또 만나요','만나서 반갑습니다',
    // Romanized aliases
    'annyeonghaseyo','annyeong','annyeonghi gaseyo','annyeonghi gyeseyo',
    'gamsahamnida','gomawoyo','joesonghamnida','mianhaeyo','gwaenchanayo','cheonmaneyo',
  ],
  mandarin: [
    // Native script (primary keys in resolver)
    '你好','早上好','下午好','晚上好','晚安','再见',
    '谢谢','谢谢你','不客气','对不起','没关系','你好吗','很好',
    '回头见','我很好 谢谢','我很好谢谢','明天见',
    // Pinyin aliases
    'ni hao','zao shang hao','wan shang hao','wan an','zai jian',
    'xie xie','bu ke qi','dui bu qi','mei guan xi','ni hao ma','hen hao',
    'wo hen hao xie xie','wo hen hao',
  ],
  hebrew: [
    // Native script (primary keys in resolver)
    'שלום','בוקר טוב','ערב טוב','לילה טוב','להתראות',
    'תודה','תודה רבה','בבקשה','סליחה','מה שלומך',
    // Transliterated aliases
    'shalom','boker tov','erev tov','layla tov','lehitraot',
    'toda','toda raba','bevakasha','slicha','ma shlomcha','metzuyan',
  ],
};

export const GREETINGS_CACHE_KEYS: Record<string, string[]> = Object.fromEntries(
  Object.entries(GREETINGS_WORDS).map(([lang, words]) => [
    lang,
    words.map(w => toCacheKey(lang, w)),
  ])
);

// ── Adjective pairs (antonym contrast images) ───────────────────────────────
// Any word here that already has a stale cache entry will be busted by the
// fix-adjectives admin endpoint and regenerated with the SPLIT panel prompt.
const ADJECTIVE_PAIRS_WORDS: Record<string, string[]> = {
  spanish: [
    'bien','mal','bueno','malo','grande','pequeño','caliente','frío',
    'feliz','triste','rápido','lento','alto','bajo','nuevo','viejo',
    'fácil','difícil','abierto','cerrado','limpio','sucio',
    'bonito','feo','largo','corto','joven','gordo','delgado',
    'rico','pobre','caro','barato','fuerte','débil',
    'lleno','vacío','oscuro','claro',
  ],
  french: [
    'bon','mauvais','grand','petit','chaud','froid','heureux','triste',
    'rapide','lent','nouveau','vieux','facile','difficile',
    'ouvert','fermé','propre','sale','beau','laid','long','court',
    'plein','vide',
  ],
  german: [
    'gut','schlecht','groß','klein','heiß','kalt','glücklich','traurig',
    'schnell','langsam','neu','alt','einfach','schwer',
    'offen','geschlossen','sauber','schmutzig','voll','leer',
  ],
  italian: [
    'buono','cattivo','grande','piccolo','caldo','freddo','felice','triste',
    'veloce','lento','alto','basso','nuovo','vecchio','facile','difficile',
    'aperto','chiuso','pulito','sporco','pieno','vuoto',
    'bello','brutto',
  ],
  portuguese: [
    'bom','mau','grande','pequeno','quente','frio','feliz','triste',
    'rápido','lento','alto','baixo','novo','velho','fácil','difícil',
    'aberto','fechado','limpo','sujo','cheio','vazio',
  ],
};

export const ADJECTIVE_PAIRS_CACHE_KEYS: Record<string, string[]> = Object.fromEntries(
  Object.entries(ADJECTIVE_PAIRS_WORDS).map(([lang, words]) => [
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
  // Non-Spanish languages route through CONCEPT_KEY_MAP to existing Spanish anchor
  // images — the resolver handles that transparently during live sessions.
  // Seeding them would only generate language-specific DALL-E junk.
  // Spanish is the ONLY language we generate new images for during bulk seeding.
  if (language !== 'spanish') {
    console.log(`[VocabSeed] Skipping image generation for "${language}" — non-Spanish languages use Spanish anchors via CONCEPT_KEY_MAP`);
    const progress: VocabSeedProgress = {
      language,
      status: 'complete',
      total: 0,
      processed: 0,
      cached: 0,
      generated: 0,
      skipped: 0,
      errors: [],
      currentWord: '',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    };
    vocabSeedJobs.set(jobId, progress);
    return;
  }

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

            // Skip abstract concepts that would be filtered out in the student view anyway —
            // this prevents wasteful DALL-E generation for discourse markers, abstract nouns, etc.
            if (!isWordSeedable(word, translation)) {
              progress.skipped++;
              progress.processed++;
              return;
            }

            // Check for a hand-crafted scene override — prefer language-prefixed key
            // (e.g. 'spanish:como esta') so languages sharing bare keys don't collide.
            const normalizedWord = normalizeForOverride(word);
            const sceneOverride = SCENE_OVERRIDES[`${language}:${normalizedWord}`]
                                ?? SCENE_OVERRIDES[normalizedWord];

            const result = await resolveVocabularyImage({
              word,
              language,
              description: word,
              translation: translation !== word ? translation : undefined,
              scene: sceneOverride,
              // Non-Spanish languages must resolve via CONCEPT_KEY_MAP to existing
              // Spanish anchors — block DALL-E so a missing map entry never creates
              // language-specific junk images during bulk seeding.
              seederMode: true,
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

const ALL_LANGUAGES = ['spanish', 'french', 'german', 'portuguese', 'italian', 'english', 'mandarin', 'japanese', 'korean', 'hebrew'];

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

// ── Abstract-concept filter ────────────────────────────────────────────────
// Mirrors the frontend isVisuallyMeaningful() filter. If a word would be
// hidden in the student view anyway, skip generating an image for it — this
// saves DALL-E credits and keeps the queue lean.

const SEED_SKIP_TRANSLATIONS = new Set([
  // Personal pronouns — no visual concept
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'you (formal)', 'you (informal)', 'i / me', 'you / your',
  // Question words — abstract/relational, nothing to show
  'what', 'where', 'who', 'how', 'when', 'why', 'which', 'whose', 'whom',
  // Yes / no / basic particles
  'yes', 'no', 'ok', 'okay',
  // Articles / determiners alone
  'a', 'an', 'the',
  // Short copula / grammar phrases (2–3 words)
  'i am', 'you are', 'he is', 'she is', 'it is', 'we are', 'they are',
  'i was', 'i will', 'i can', 'i do', 'i go', 'i have', 'is it', 'is this', 'is that',
  'to be', 'to have', 'to do', 'to go', 'to say', 'to see', 'to know', 'to get',
  // Classroom management too short for 4-word filter
  'i understand', 'excuse me', 'never mind',
  // Discourse markers / connectors
  'however', 'although', 'therefore', 'moreover', 'furthermore', 'meanwhile',
  'consequently', 'nonetheless', 'nevertheless', 'whereas', 'despite', 'thus',
  'hence', 'accordingly', 'subsequently', 'conversely', 'alternatively',
  'in addition', 'on the other hand', 'in contrast', 'as a result',
  'for example', 'for instance', 'in other words', 'in conclusion',
  'to summarize', 'in summary', 'first of all', 'in my opinion',
  'it is important', 'it is necessary', 'there is', 'there are',
  'to have to', 'to be able to', 'one must', 'one can',
  'it seems', 'i think', 'in order to', 'so that', 'in fact',
  'on the contrary', 'in spite of', 'even though', 'as well as',
  'not only', 'both', 'neither', 'either', 'whether', 'on condition that',
  'provided that', 'as long as', 'in case', 'so long as', 'as soon as',
  // Abstract single nouns — yield generic or confusing images
  'leadership', 'democracy', 'ideology', 'nationalism', 'globalization',
  'capitalism', 'socialism', 'communism', 'imperialism', 'colonialism',
  'consciousness', 'existence', 'reality', 'knowledge', 'understanding',
  'intelligence', 'wisdom', 'truth', 'morality', 'ethics', 'justice',
  'freedom', 'liberty', 'equality', 'solidarity', 'humanity',
  'identity', 'personality', 'mentality', 'philosophy', 'theory',
  'policy', 'politics', 'economy', 'society', 'culture',
  'heritage', 'civilization', 'modernization', 'progress',
  'development', 'achievement', 'influence', 'importance', 'significance',
  'relationship', 'communication', 'collaboration', 'cooperation',
  'motivation', 'creativity', 'imagination', 'inspiration', 'innovation',
  'sustainability', 'responsibility', 'accountability', 'transparency',
  'diversity', 'inclusion', 'discrimination', 'prejudice', 'tolerance',
  'consciousness', 'perception', 'emotion', 'feeling', 'thought',
  'attitude', 'behavior', 'tendency', 'tendency', 'approach',
  'strategy', 'method', 'technique', 'process', 'procedure',
  'phenomenon', 'concept', 'idea', 'notion', 'principle',
  'tradition', 'convention', 'institution', 'organization', 'structure',
  // Government / civic
  'government', 'legislation', 'regulation', 'administration', 'constitution',
  'parliament', 'senate', 'judiciary', 'bureaucracy',
  // Social issues
  'violence', 'inequality', 'poverty', 'unemployment', 'corruption',
  'exploitation', 'oppression', 'segregation', 'alienation',
  'dehumanization', 'marginalization', 'radicalization',
  // Environmental
  'pollution', 'deforestation', 'emissions', 'carbon', 'climate',
  'biodiversity', 'conservation', 'depletion', 'contamination',
  // Economy / business
  'inflation', 'recession', 'privatization', 'nationalization', 'taxation',
  'investment', 'revenue', 'profit', 'deficit', 'surplus',
  // Language / education
  'grammar', 'vocabulary', 'fluency', 'proficiency', 'linguistics',
  'literature', 'rhetoric', 'narrative', 'discourse', 'curriculum',
  // History / culture abstract
  'colonization', 'decolonization', 'industrialization',
  'globalization', 'westernization', 'gentrification',
  'assimilation', 'acculturation', 'syncretism',
  // General advanced abstract
  'hypothesis', 'paradox', 'contradiction', 'ambiguity', 'complexity',
  'relevance', 'coherence', 'validity', 'credibility', 'legitimacy',
  'autonomy', 'sovereignty', 'hierarchy', 'patriarchy', 'matriarchy',
  'hegemony', 'subjectivity', 'objectivity', 'relativity',
  'culinary', 'gastronomy', 'cuisine',
  // Verbs-as-gerunds (when translation is gerund form, not an action scene)
  'elucidate', 'to elucidate', 'clarify', 'elaborate', 'facilitate',
  'to facilitate', 'negotiate', 'to negotiate', 'mediate', 'to mediate',
  'coordinate', 'to coordinate', 'implement', 'to implement',
  // Relational / abstract nouns from connector drills
  'aspect', 'dimension', 'factor', 'variable', 'criterion', 'criteria',
  'parameter', 'element', 'component', 'framework', 'paradigm',
  'context', 'perspective', 'interpretation', 'analysis', 'synthesis',
  'evaluation', 'conclusion', 'hypothesis', 'assumption', 'implication',
]);

const SEED_SKIP_PREFIXES = [
  'the development', 'the impact', 'the context', 'the process',
  'the relationship', 'the influence', 'the importance', 'the significance',
  'the establishment', 'the implementation', 'the achievement',
  'the concept of', 'the phenomenon', 'the situation', 'the consequences',
];

// English word suffixes that almost always signal abstract nouns — DALL-E can't
// produce a meaningful single object for these, so skip them to save DALL-E credits.
// ONLY include long/unambiguous suffixes to avoid false positives like:
//   -tion → "station", "portion"   -ment → "apartment"   -ance → "ambulance"
//   -ence → "fence"   -ship → "ship"   -dom → "kingdom"
const ABSTRACT_SUFFIXES = [
  'ization',   // globalization, dehumanization, modernization
  'isation',   // modernisation, globalisation
  'ism',       // nationalism, capitalism, colonialism (min-length guards "ism" itself)
  'ology',     // psychology, biology, archaeology
  'ography',   // photography, cartography, filmography
];

// 2-word English phrases where the first word signals an abstract topic
const ABSTRACT_TWO_WORD_PREFIXES = [
  'carbon ', 'social ', 'cultural ', 'political ', 'economic ', 'historical ',
  'global ', 'environmental ', 'sustainable ', 'digital ', 'national ',
  'human ', 'mass ', 'public ', 'civil ', 'critical ', 'emotional ',
  'mental ', 'physical ', 'personal ', 'professional ', 'academic ',
  'urban ', 'rural ', 'ethical ', 'moral ', 'intellectual ',
];

/**
 * Returns true if this word should have a vocab image generated.
 * Words with SCENE_OVERRIDES are always seedable (curated = always generate).
 * Words whose English translation signals an abstract concept are skipped.
 */
function isWordSeedable(word: string, engTranslation: string): boolean {
  // Always seed if there's a hand-crafted SCENE_OVERRIDE — these are curated
  if (SCENE_OVERRIDES[normalizeForOverride(word)]) return true;

  // Strip punctuation (mirrors frontend isVisuallyMeaningful fix)
  const eng = engTranslation.toLowerCase().trim()
    .replace(/\.\.\./g, ' ')
    .replace(/['''`]/g, '')
    .replace(/[.,!?;:"¡¿…]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // No meaningful translation (listen_repeat / same as word) → seed it
  if (!eng || eng === word.toLowerCase().trim()) return true;

  // 4+ English words = almost certainly an abstract multi-part phrase
  if (eng.split(/\s+/).length >= 4) return false;

  // 3-word phrases that are abstract topic descriptions
  if (eng.split(/\s+/).length === 3) {
    // "X Y Z" patterns — most 3-word English translations are either noun phrases
    // ("the big house") which are fine, or topic descriptions ("carbon tax policy")
    // which are not. Skip if first word is a known abstract signal.
    const firstWord = eng.split(' ')[0];
    if (['the', 'a', 'an'].includes(firstWord)) {
      // "the X of Y" or "a X of Y" — likely abstract
      if (eng.includes(' of ')) return false;
    }
  }

  // Known discourse markers / abstract single nouns
  if (SEED_SKIP_TRANSLATIONS.has(eng)) return false;

  // Abstract-noun prefix patterns
  if (SEED_SKIP_PREFIXES.some(p => eng.startsWith(p))) return false;

  // Abstract two-word prefix patterns
  if (ABSTRACT_TWO_WORD_PREFIXES.some(p => eng.startsWith(p))) return false;

  // Single word ending in abstract-noun suffix — unlikely to produce a clear image
  const words = eng.split(/\s+/);
  if (words.length === 1) {
    const w = words[0];
    if (ABSTRACT_SUFFIXES.some(s => w.endsWith(s) && w.length > s.length + 2)) return false;
  }

  return true;
}

function cleanPromptToEnglish(prompt: string, word: string): string {
  if (!prompt) return word;
  return prompt
    .replace(/^Say\s+"([^"]+)"\s+in\s+\w+\.\s*Context:\s*/i, '$1 — ')
    .replace(/^Say\s+"([^"]+)"\s+in\s+\w+\.?\s*/i, '$1')
    .replace(/^Translate[:\s]+/i, '')
    .trim() || word;
}
