/**
 * Vocabulary Image Resolver Service
 *
 * Resolves images for vocabulary words shown on the whiteboard.
 * Uses a two-step approach:
 *   1. Check the seeded library cache (vocab_spanish_{word} key) — instant, free, consistent watercolor style
 *   2. Generate on-the-fly with DALL-E 3 (same watercolor style as the library), save to cache
 *
 * No Unsplash. Every image uses the watercolor illustrated style.
 */

import { storage } from '../storage';
import { lookupCanonicalConcept, type Language as CanonicalLanguage } from '../data/canonical-vocabulary';

export interface VocabImageRequest {
  word: string;
  language: string;
  description?: string;
  scene?: string;       // Rich generation prompt when no library image exists
  translation?: string; // English meaning — used as generation hint for non-English words
  conversationId?: string;
  userId?: string;
  /**
   * When true (set by the batch seeder), DALL-E generation is blocked for any
   * language other than Spanish.  All non-Spanish words should resolve via
   * CONCEPT_KEY_MAP to an existing Spanish anchor — if they miss the map,
   * they get a placeholder rather than generating a language-specific image.
   * This prevents runaway generation of FR/DE/PT/etc images during bulk seeds.
   */
  seederMode?: boolean;
  /**
   * When true, only return images that are already in the cache library.
   * DALL-E generation is completely blocked — cache misses return a placeholder.
   * Use this for consumer-facing textbook routes to prevent inconsistent
   * on-the-fly images from appearing in curated lesson content.
   */
  libraryOnly?: boolean;
  /**
   * Scopes the image to a specific meaning of a polysemous word.
   * Use whenever the same word has visually distinct referents.
   * Examples: "weather" vs "time" for "el tiempo" / "le temps" / "il tempo";
   *           "bench" vs "bank" for "el banco" / "die Bank";
   *           "plant" vs "floor" for "la planta";
   *           "candle" vs "sail" for "la vela".
   * The meaning is slugified and appended to the cache key so each sense
   * stores and retrieves its own image independently — no cross-contamination.
   */
  meaning?: string;
}

export interface VocabImageResult {
  imageUrl: string;
  source: 'cache' | 'ai' | 'placeholder';
  word: string;
  description: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a clean, consistent SVG data URL for a number (0-99).
 * Used instead of DALL-E for number concept images — no AI variance, instant, shared.
 */
function generateNumberSvgDataUrl(num: number): string {
  const text = String(num);
  const fontSize = text.length === 1 ? 340 : text.length === 2 ? 240 : 170;
  const yOffset = text.length === 1 ? 330 : 340;
  const bg = '#faf8f3';   // warm cream
  const fg = '#1a2744';   // deep navy
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bg}" rx="28"/>
  <text x="256" y="${yOffset}" font-size="${fontSize}" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif" fill="${fg}" font-weight="700">${text}</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * Generate a clean typographic SVG "flashcard" for function/grammar words.
 * These words (que, como, de, desde, pero, y, o, si, …) have no visual concept
 * so a DALL-E scene would be nonsensical.  Instead we show the foreign word
 * prominently with its English gloss below, in the same warm-cream style as
 * the number cards.
 */
function generateFunctionWordSvg(word: string, translation: string): string {
  const bg = '#faf8f3';       // warm cream
  const fg = '#1a2744';       // deep navy
  const subtle = '#5a6a8a';   // muted blue-grey for the translation

  // Escape XML special chars
  const escapeXml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const wordText = escapeXml(word);
  const translationText = escapeXml(translation);

  // Scale the word font size based on character count
  const wordLen = word.length;
  const wordFontSize = wordLen <= 4 ? 210 : wordLen <= 8 ? 160 : wordLen <= 12 ? 120 : 90;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bg}" rx="28"/>
  <text x="256" y="240" font-size="${wordFontSize}" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif" fill="${fg}" font-weight="700"
    font-style="italic">${wordText}</text>
  <line x1="128" y1="276" x2="384" y2="276" stroke="${subtle}" stroke-width="1.5" opacity="0.4"/>
  <text x="256" y="320" font-size="52" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif" fill="${subtle}"
    font-weight="400">${translationText}</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// ── Function / grammar word detection ─────────────────────────────────────────
//
// These English words have no standalone visual concept — DALL-E generates
// confusing or nonsensical results for them.  We detect them via their
// English translation and render a typographic SVG flashcard instead.
//
// Covers: prepositions, conjunctions, relative/interrogative pronouns,
// modal auxiliaries, and common short adverbs/particles.
const ENGLISH_FUNCTION_WORDS = new Set([
  // Prepositions
  'of','in','to','for','with','on','at','from','by','as','into','through','during',
  'before','after','above','below','between','under','since','until','unless',
  'within','along','following','across','behind','beyond','plus','except',
  'up','down','out','off','over','near','among','around','without','about',
  'against','per','via','versus','amid','despite','towards','toward','upon',
  'concerning','regarding',
  // Spanish / French / German / Italian / Portuguese common prepositions (by translation)
  'desde','desde / since','desde / from',
  // Conjunctions
  'and','but','or','nor','so','yet','both','either','neither','whether',
  'because','although','though','even though','if','unless','until','while',
  'whereas','whenever','wherever','since','after','before','once','as','than',
  'that','which','who','whom','whose','where','when','how','why','what',
  // Relative / interrogative particles
  'like','as if','as though','such as','so that','in order to','in order that',
  // Articles and determiners (when the whole concept is just one of these)
  'the','a','an','this','that','these','those','some','any','each','every',
  'all','both','few','more','most','other','another','such','what','rather',
  // Modal / auxiliary concepts
  'can','could','may','might','shall','should','will','would','must','ought',
  'need','dare','used to',
  // Short adverbs / particles
  'not','no','yes','so','too','also','just','only','even','still','already',
  'always','never','sometimes','often','soon','now','then','here','there',
  'very','quite','rather','almost','perhaps','maybe','really','well',
  // Common short compound translations that are still function-word concepts
  'of the','in the','to the','from the','by the','at the','for the',
  'of a','in a','to a','with a','on a','by a',
]);

/**
 * Returns true when the English concept for a word maps to a grammar/function
 * word with no standalone visual representation.
 *
 * We check the concept (translation) rather than the foreign word itself so
 * this works across all 9 languages automatically.
 */
function isFunctionWord(concept: string): boolean {
  const lower = concept.toLowerCase().trim()
    // Normalise separators like "since / from" → "since/from"
    .replace(/\s*\/\s*/g, '/');

  // Direct match in our set
  if (ENGLISH_FUNCTION_WORDS.has(lower)) return true;

  // Check each slash-separated variant: "since/from" → check "since" and "from"
  const parts = lower.split('/').map(p => p.trim()).filter(Boolean);
  if (parts.length > 1 && parts.every(p => ENGLISH_FUNCTION_WORDS.has(p))) return true;

  // Very short single word (≤3 chars) that only contains lowercase letters —
  // catches words like "ya", "ne", "も", "に" etc. that slip through other checks.
  // We skip CJK characters since single CJK characters are content words with images.
  if (lower.length <= 3 && /^[a-z]+$/.test(lower)) return true;

  return false;
}

// Articles and common filler words to strip before fallback lookup (covers Spanish + French)
const SPANISH_ARTICLES = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al']);
const FRENCH_ARTICLES = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'l']);
const ALL_ARTICLES = new Set([...SPANISH_ARTICLES, ...FRENCH_ARTICLES]);

// ── Language character intros ──────────────────────────────────────────────────
//
// When a vocab word has no SCENE_OVERRIDES entry and the concept looks like an
// action or phrase (verb, multi-word expression), we embed the language's named
// primary character so DALL-E produces a character-consistent scene rather than
// a random anonymous person.
//
// For isolated object nouns (house, dog, book), no character is needed — the
// watercolor prop style alone produces consistent results across all languages.
//
// Must stay in sync with CHARACTER_PROFILES.primary in vocab-image-seed-service.ts.
// Kept here (rather than imported) to avoid a circular import — the resolver
// already uses a dynamic import for SCENE_OVERRIDES from the seed service.
export const LANGUAGE_CHARACTER_INTROS: Record<string, string> = {
  spanish:    'Daniela, a 28-year-old Latina woman with long wavy dark-brown hair, warm medium-brown skin, and bright brown eyes, wearing a sky-blue short-sleeve collared button-up shirt and dark jeans,',
  french:     'Sophie, a 27-year-old French woman with chin-length auburn hair, fair skin, and green eyes, wearing a striped navy-and-white Breton top and light trousers,',
  german:     'Anna, a 26-year-old German woman with straight blonde hair in a ponytail, fair skin, and blue-grey eyes, wearing a forest-green pullover and grey slim-fit trousers,',
  italian:    'Giulia, a 25-year-old Italian woman with long straight dark-brown hair, warm olive skin, and dark-brown eyes, wearing a terracotta linen blouse and white wide-leg trousers,',
  portuguese: 'Ana, a 27-year-old Brazilian woman with long wavy dark hair, golden-brown skin, and warm brown eyes, wearing a coral short-sleeve fitted blouse tucked into dark tailored wide-leg trousers,',
  japanese:   'Yuki, a 25-year-old Japanese woman with straight shoulder-length black hair, light porcelain skin, and warm dark brown eyes, wearing a soft sage-green blouse and light grey wide-leg trousers,',
  korean:     'Ji-yeon, a 24-year-old Korean woman with long straight black hair, fair skin, and dark brown eyes, wearing a soft pink oversized blouse and white wide-leg trousers,',
  mandarin:   'Mei, a 26-year-old Chinese woman with long sleek black hair, fair complexion, and warm brown eyes, wearing a teal short-sleeve silk blouse tucked into beige wide-leg trousers,',
  hebrew:     'Noa, a 26-year-old Israeli woman with long wavy dark brown hair, light olive skin, and warm hazel eyes, wearing a mustard-yellow fitted blouse tucked into dark wide-leg trousers,',
  english:    'Emma, a 27-year-old American woman with shoulder-length chestnut hair, light skin, and hazel eyes, wearing a navy blue cardigan and light jeans,',
};

// ── Per-language anchor image keys ────────────────────────────────────────────
//
// When generating a NEW scene image (type=infographic / character scene), the
// resolver looks up this anchor key in the shared image cache and passes the
// resulting URL to generateVisual.  The generation service then calls
// generateCharacterScene() in google-image-service.ts with that reference image
// so the model can see the actual character face, art style, and color palette —
// rather than relying on text description alone.
//
// The anchor should be a "canonical" image that clearly shows the language's
// primary character in the correct illustration style.  It must already exist in
// the cached_stock_images table before any generation runs.  If the key is not
// in the cache, the system gracefully falls back to text-only generation.
//
// Best anchors: greeting/farewell images (show the character prominently in the
// correct style).  Update these keys whenever a better anchor image is approved.
export const LANGUAGE_ANCHOR_CACHE_KEYS: Record<string, string> = {
  spanish:    'vocab_spanish_hola',
  french:     'vocab_french_bonjour',
  german:     'vocab_german_hallo',
  italian:    'vocab_italian_ciao',
  portuguese: 'vocab_portuguese_ola',
  japanese:   'vocab_japanese_こんにちは',
  korean:     'vocab_korean_안녕하세요',
  mandarin:   'vocab_mandarin_你好',
  hebrew:     'vocab_hebrew_שלום',
  english:    'vocab_english_hello',
};

// ── Shared concept image cache ────────────────────────────────────────────────
//
// Words that refer to the SAME visual concept across all languages share a single
// generated image stored under a language-independent key (e.g. "concept_num_3").
// This saves DALL-E credits and ensures visual consistency across language courses.
//
// NOTE: Greetings / farewells / courtesy phrases are intentionally excluded.
// Those prompts embed named characters (Daniela for Spanish, Sophie for French,
// etc.) via CHARACTER_PROFILES, so each language should get its own image.
//
// Keys below use normalizeWord() output: lowercase, accents stripped,
// non-alphanumeric-non-space stripped, spaces collapsed.

export const CONCEPT_KEY_MAP: Record<string, string> = {
  // ── Numbers ─────────────────────────────────────────────────────────
  'cero':          'concept_num_0',
  'zero':          'concept_num_0',  // FR/IT/PT/DE
  'null':          'concept_num_0',  // DE (zero)
  'uno':           'concept_num_1',  // ES/IT
  'eins':          'concept_num_1',  // DE
  'dos':           'concept_num_2',  // ES
  'deux':          'concept_num_2',  // FR
  'zwei':          'concept_num_2',  // DE
  'due':           'concept_num_2',  // IT
  'dois':          'concept_num_2',  // PT-m
  'duas':          'concept_num_2',  // PT-f
  'tres':          'concept_num_3',  // ES/PT
  'trois':         'concept_num_3',  // FR
  'drei':          'concept_num_3',  // DE
  'tre':           'concept_num_3',  // IT
  'cuatro':        'concept_num_4',  // ES
  'quatre':        'concept_num_4',  // FR
  'vier':          'concept_num_4',  // DE
  'quattro':       'concept_num_4',  // IT
  'quatro':        'concept_num_4',  // PT
  'cinco':         'concept_num_5',  // ES/PT
  'cinq':          'concept_num_5',  // FR
  'funf':          'concept_num_5',  // DE (fünf → funf)
  'cinque':        'concept_num_5',  // IT
  'seis':          'concept_num_6',  // ES/PT
  'six':           'concept_num_6',  // FR
  'sechs':         'concept_num_6',  // DE
  'sei':           'concept_num_6',  // IT
  'siete':         'concept_num_7',  // ES
  'sept':          'concept_num_7',  // FR
  'sieben':        'concept_num_7',  // DE
  'sette':         'concept_num_7',  // IT
  'sete':          'concept_num_7',  // PT
  'ocho':          'concept_num_8',  // ES
  'huit':          'concept_num_8',  // FR
  'acht':          'concept_num_8',  // DE
  'otto':          'concept_num_8',  // IT
  'oito':          'concept_num_8',  // PT
  'nueve':         'concept_num_9',  // ES
  'neuf':          'concept_num_9',  // FR
  'neun':          'concept_num_9',  // DE
  'nove':          'concept_num_9',  // IT/PT
  'diez':          'concept_num_10', // ES
  'dix':           'concept_num_10', // FR
  'zehn':          'concept_num_10', // DE
  'dieci':         'concept_num_10', // IT
  'dez':           'concept_num_10', // PT
  'once':          'concept_num_11', // ES
  'onze':          'concept_num_11', // FR/PT
  'elf':           'concept_num_11', // DE
  'undici':        'concept_num_11', // IT
  'doce':          'concept_num_12', // ES
  'douze':         'concept_num_12', // FR
  'zwolf':         'concept_num_12', // DE (zwölf → zwolf)
  'dodici':        'concept_num_12', // IT
  'doze':          'concept_num_12', // PT
  'trece':         'concept_num_13', // ES
  'treize':        'concept_num_13', // FR
  'dreizehn':      'concept_num_13', // DE
  'tredici':       'concept_num_13', // IT
  'treze':         'concept_num_13', // PT
  'catorce':       'concept_num_14', // ES
  'quatorze':      'concept_num_14', // FR/PT
  'vierzehn':      'concept_num_14', // DE
  'quattordici':   'concept_num_14', // IT
  'quince':        'concept_num_15', // ES
  'quinze':        'concept_num_15', // FR/PT
  'funfzehn':      'concept_num_15', // DE (fünfzehn → funfzehn)
  'quindici':      'concept_num_15', // IT
  'dieciseis':     'concept_num_16', // ES (dieciséis)
  'seize':         'concept_num_16', // FR
  'sechzehn':      'concept_num_16', // DE
  'sedici':        'concept_num_16', // IT
  'dezesseis':     'concept_num_16', // PT
  'diecisiete':    'concept_num_17', // ES
  'dixsept':       'concept_num_17', // FR (dix-sept → dixsept)
  'siebzehn':      'concept_num_17', // DE
  'diciassette':   'concept_num_17', // IT
  'dezessete':     'concept_num_17', // PT
  'dieciocho':     'concept_num_18', // ES
  'dixhuit':       'concept_num_18', // FR (dix-huit → dixhuit)
  'achtzehn':      'concept_num_18', // DE
  'diciotto':      'concept_num_18', // IT
  'dezoito':       'concept_num_18', // PT
  'diecinueve':    'concept_num_19', // ES
  'dixneuf':       'concept_num_19', // FR (dix-neuf → dixneuf)
  'neunzehn':      'concept_num_19', // DE
  'diciannove':    'concept_num_19', // IT
  'dezenove':      'concept_num_19', // PT
  'veinte':        'concept_num_20', // ES
  'vingt':         'concept_num_20', // FR
  'zwanzig':       'concept_num_20', // DE
  'venti':         'concept_num_20', // IT
  'vinte':         'concept_num_20', // PT
  'veintiuno':     'concept_num_21', // ES
  'vingt et un':   'concept_num_21', // FR
  'einundzwanzig': 'concept_num_21', // DE
  'ventuno':       'concept_num_21', // IT
  'vinte e um':    'concept_num_21', // PT
  'treinta':       'concept_num_30', // ES
  'trente':        'concept_num_30', // FR
  'dreiig':        'concept_num_30', // DE (dreißig → dreiig after ß removed)
  'trenta':        'concept_num_30', // IT
  'trinta':        'concept_num_30', // PT
  'cuarenta':      'concept_num_40', // ES
  'quarante':      'concept_num_40', // FR
  'vierzig':       'concept_num_40', // DE
  'quaranta':      'concept_num_40', // IT
  'quarenta':      'concept_num_40', // PT
  'cincuenta':     'concept_num_50', // ES
  'cinquante':     'concept_num_50', // FR
  'funfzig':       'concept_num_50', // DE (fünfzig → funfzig)
  'cinquanta':     'concept_num_50', // IT
  'cinquenta':     'concept_num_50', // PT
  'sesenta':       'concept_num_60', // ES
  'soixante':      'concept_num_60', // FR
  'sechzig':       'concept_num_60', // DE
  'sessanta':      'concept_num_60', // IT
  'sessenta':      'concept_num_60', // PT
  'setenta':       'concept_num_70', // ES/PT
  'soixantedix':   'concept_num_70', // FR (soixante-dix → soixantedix)
  'siebzig':       'concept_num_70', // DE
  'settanta':      'concept_num_70', // IT
  'ochenta':       'concept_num_80', // ES
  'quatrevingt':   'concept_num_80', // FR (quatre-vingt → quatrevingt)
  'achtzig':       'concept_num_80', // DE
  'ottanta':       'concept_num_80', // IT
  'oitenta':       'concept_num_80', // PT
  'noventa':       'concept_num_90', // ES/PT
  'quatrevingtdix':'concept_num_90', // FR (quatre-vingt-dix)
  'neunzig':       'concept_num_90', // DE
  'novanta':       'concept_num_90', // IT
  'cien':          'concept_num_100',// ES
  'cent':          'concept_num_100',// FR
  'hundert':       'concept_num_100',// DE
  'cento':         'concept_num_100',// IT
  'cem':           'concept_num_100',// PT
  'mil':           'concept_num_1000',// ES/PT
  'mille':         'concept_num_1000',// FR/IT
  'tausend':       'concept_num_1000',// DE

  // ── Korean numbers (Sino-Korean, 0-20) ──────────────────────────────
  '영':            'concept_num_0',
  '공':            'concept_num_0',   // alternate zero
  '일':            'concept_num_1',
  '이':            'concept_num_2',
  '삼':            'concept_num_3',
  '사':            'concept_num_4',
  '오':            'concept_num_5',
  '육':            'concept_num_6',
  '칠':            'concept_num_7',
  '팔':            'concept_num_8',
  '구':            'concept_num_9',
  '십':            'concept_num_10',
  '십일':          'concept_num_11',
  '십이':          'concept_num_12',
  '십삼':          'concept_num_13',
  '십사':          'concept_num_14',
  '십오':          'concept_num_15',
  '십육':          'concept_num_16',
  '십칠':          'concept_num_17',
  '십팔':          'concept_num_18',
  '십구':          'concept_num_19',
  '이십':          'concept_num_20',

  // ── Japanese numbers (hiragana readings, 0-20) ───────────────────────
  'ゼロ':          'concept_num_0',
  'れい':          'concept_num_0',   // alternate zero
  'いち':          'concept_num_1',
  'に':            'concept_num_2',
  'さん':          'concept_num_3',
  'よん':          'concept_num_4',
  'し':            'concept_num_4',   // alternate 4
  'ご':            'concept_num_5',
  'ろく':          'concept_num_6',
  'なな':          'concept_num_7',
  'しち':          'concept_num_7',   // alternate 7
  'はち':          'concept_num_8',
  'きゅう':        'concept_num_9',
  'く':            'concept_num_9',   // alternate 9
  'じゅう':        'concept_num_10',
  'じゅういち':    'concept_num_11',
  'じゅうに':      'concept_num_12',
  'じゅうさん':    'concept_num_13',
  'じゅうよん':    'concept_num_14',
  'じゅうし':      'concept_num_14',  // alternate 14
  'じゅうご':      'concept_num_15',
  'じゅうろく':    'concept_num_16',
  'じゅうなな':    'concept_num_17',
  'じゅうしち':    'concept_num_17',  // alternate 17
  'じゅうはち':    'concept_num_18',
  'じゅうきゅう':  'concept_num_19',
  'じゅうく':      'concept_num_19',  // alternate 19
  'にじゅう':      'concept_num_20',

  // ── Mandarin numbers (hanzi, 0-20) ───────────────────────────────────
  '零':            'concept_num_0',
  '一':            'concept_num_1',
  '二':            'concept_num_2',
  '三':            'concept_num_3',
  '四':            'concept_num_4',
  '五':            'concept_num_5',
  '六':            'concept_num_6',
  '七':            'concept_num_7',
  '八':            'concept_num_8',
  '九':            'concept_num_9',
  '十':            'concept_num_10',
  '十一':          'concept_num_11',
  '十二':          'concept_num_12',
  '十三':          'concept_num_13',
  '十四':          'concept_num_14',
  '十五':          'concept_num_15',
  '十六':          'concept_num_16',
  '十七':          'concept_num_17',
  '十八':          'concept_num_18',
  '十九':          'concept_num_19',
  '二十':          'concept_num_20',
  '百':            'concept_num_100',
  '千':            'concept_num_1000',

  // ── Colors ──────────────────────────────────────────────────────────
  'rojo':          'concept_color_red',
  'rouge':         'concept_color_red',
  'rot':           'concept_color_red',
  'rosso':         'concept_color_red',
  'vermelho':      'concept_color_red',
  'azul':          'concept_color_blue',
  'bleu':          'concept_color_blue',
  'blau':          'concept_color_blue',
  'blu':           'concept_color_blue',
  'verde':         'concept_color_green',
  'vert':          'concept_color_green',
  'grun':          'concept_color_green', // DE (grün → grun)
  'amarillo':      'concept_color_yellow',
  'jaune':         'concept_color_yellow',
  'gelb':          'concept_color_yellow',
  'giallo':        'concept_color_yellow',
  'amarelo':       'concept_color_yellow',
  'naranja':       'concept_color_orange',
  'arancione':     'concept_color_orange',
  'laranja':       'concept_color_orange',
  // Note: 'orange' (FR/DE) omitted — same word as the fruit in those languages
  'morado':        'concept_color_purple',
  'violet':        'concept_color_purple',
  'lila':          'concept_color_purple',
  'viola':         'concept_color_purple',
  'roxo':          'concept_color_purple',
  'rosa':          'concept_color_pink', // ES/IT/PT/DE
  'rose':          'concept_color_pink', // FR
  'blanco':        'concept_color_white',
  'blanc':         'concept_color_white',
  'wei':           'concept_color_white', // DE (weiß → wei after ß removed)
  'bianco':        'concept_color_white',
  'branco':        'concept_color_white',
  'negro':         'concept_color_black',
  'noir':          'concept_color_black',
  'schwarz':       'concept_color_black',
  'nero':          'concept_color_black',
  'preto':         'concept_color_black',
  'marron':        'concept_color_brown', // ES (marrón → marron) / FR
  'braun':         'concept_color_brown',
  'marrone':       'concept_color_brown',
  'marrom':        'concept_color_brown',
  'gris':          'concept_color_gray',  // ES/FR
  'grau':          'concept_color_gray',  // DE
  'grigio':        'concept_color_gray',  // IT
  'cinza':         'concept_color_gray',  // PT

  // ── Seasons ─────────────────────────────────────────────────────────
  'primavera':     'concept_season_spring',  // ES/IT/PT
  'printemps':     'concept_season_spring',  // FR
  'fruhling':      'concept_season_spring',  // DE (Frühling → fruhling)
  'verano':        'concept_season_summer',  // ES
  'ete':           'concept_season_summer',  // FR (été → ete)
  'sommer':        'concept_season_summer',  // DE
  'estate':        'concept_season_summer',  // IT
  'verao':         'concept_season_summer',  // PT (verão → verao)
  'otono':         'concept_season_fall',    // ES (otoño → otono)
  'automne':       'concept_season_fall',    // FR
  'herbst':        'concept_season_fall',    // DE
  'autunno':       'concept_season_fall',    // IT
  'outono':        'concept_season_fall',    // PT
  'invierno':      'concept_season_winter',  // ES
  'hiver':         'concept_season_winter',  // FR
  'winter':        'concept_season_winter',  // DE
  'inverno':       'concept_season_winter',  // IT/PT

  // ── Weather ─────────────────────────────────────────────────────────
  'lluvia':        'concept_weather_rain',
  'pluie':         'concept_weather_rain',
  'regen':         'concept_weather_rain',
  'pioggia':       'concept_weather_rain',
  'chuva':         'concept_weather_rain',
  'nieve':         'concept_weather_snow',
  'neige':         'concept_weather_snow',
  'schnee':        'concept_weather_snow',
  'neve':          'concept_weather_snow',   // IT/PT
  'sol':           'concept_weather_sun',    // ES/PT
  'soleil':        'concept_weather_sun',
  'sonne':         'concept_weather_sun',
  'sole':          'concept_weather_sun',
  'viento':        'concept_weather_wind',
  'vent':          'concept_weather_wind',
  'wind':          'concept_weather_wind',
  'vento':         'concept_weather_wind',   // IT/PT
  'nube':          'concept_weather_cloud',  // ES
  'nuage':         'concept_weather_cloud',  // FR
  'wolke':         'concept_weather_cloud',  // DE
  'nuvola':        'concept_weather_cloud',  // IT
  'nuvem':         'concept_weather_cloud',  // PT
  'niebla':        'concept_weather_fog',    // ES
  'brouillard':    'concept_weather_fog',    // FR
  'nebel':         'concept_weather_fog',    // DE
  'nebbia':        'concept_weather_fog',    // IT
  'nevoa':         'concept_weather_fog',    // PT (névoa → nevoa)
  'tormenta':      'concept_weather_storm',  // ES
  'orage':         'concept_weather_storm',  // FR
  'gewitter':      'concept_weather_storm',  // DE
  'temporale':     'concept_weather_storm',  // IT
  'tempestade':    'concept_weather_storm',  // PT
  'relampago':     'concept_weather_lightning', // ES (relámpago)
  'eclair':        'concept_weather_lightning', // FR (éclair)
  'blitz':         'concept_weather_lightning', // DE
  'fulmine':       'concept_weather_lightning', // IT
  'relampago pt':  'concept_weather_lightning', // PT (same as ES after norm)
  'arcoiris':      'concept_weather_rainbow',   // ES/PT (arco iris)
  'arcciel':       'concept_weather_rainbow',   // FR (arc-en-ciel → arcciel? no: arc-en-ciel → arcenciel)
  'arcenciel':     'concept_weather_rainbow',   // FR (arc-en-ciel → hyphens stripped → arcenciel)
  'regenbogen':    'concept_weather_rainbow',   // DE
  'arcobaleno':    'concept_weather_rainbow',   // IT
  'soleado':       'concept_weather_sunny',     // ES
  'ensoleille':    'concept_weather_sunny',     // FR (ensoleillé)
  'sonnig':        'concept_weather_sunny',     // DE
  'soleggiato':    'concept_weather_sunny',     // IT
  'ensolarado':    'concept_weather_sunny',     // PT
  'nublado':       'concept_weather_cloudy',    // ES/PT
  'nuageux':       'concept_weather_cloudy',    // FR
  'bewolkt':       'concept_weather_cloudy',    // DE (bewölkt → bewolkt)
  'nuvoloso':      'concept_weather_cloudy',    // IT
  'lluvioso':      'concept_weather_rainy',     // ES
  'pluvieux':      'concept_weather_rainy',     // FR
  'regnerisch':    'concept_weather_rainy',     // DE
  'piovoso':       'concept_weather_rainy',     // IT
  'chuvoso':       'concept_weather_rainy',     // PT
  'nevando':       'concept_weather_snowy',     // ES/PT
  'enneige':       'concept_weather_snowy',     // FR (enneigé)
  'verschneit':    'concept_weather_snowy',     // DE
  'nevoso':        'concept_weather_snowy',     // IT
  'ventoso':       'concept_weather_windy',     // ES/IT/PT
  'venteux':       'concept_weather_windy',     // FR
  'windig':        'concept_weather_windy',     // DE
  'tormentoso':    'concept_weather_stormy',    // ES/PT
  'orageux':       'concept_weather_stormy',    // FR
  'sturmisch':     'concept_weather_stormy',    // DE (stürmisch)
  'tempestoso':    'concept_weather_stormy',    // IT

  // ── Basic shapes ─────────────────────────────────────────────────────
  'circulo':       'concept_shape_circle',    // ES (círculo)
  'cercle':        'concept_shape_circle',    // FR
  'kreis':         'concept_shape_circle',    // DE
  'cerchio':       'concept_shape_circle',    // IT
  'circulopt':     'concept_shape_circle',    // PT (círculo — same as ES after norm)
  'cuadrado':      'concept_shape_square',    // ES
  'carre':         'concept_shape_square',    // FR (carré)
  'quadrat':       'concept_shape_square',    // DE
  'quadrato':      'concept_shape_square',    // IT
  'quadrado':      'concept_shape_square',    // PT
  'triangulo':     'concept_shape_triangle',  // ES (triángulo)
  'triangle':      'concept_shape_triangle',  // FR/DE
  'dreieck':       'concept_shape_triangle',  // DE
  'triangolo':     'concept_shape_triangle',  // IT
  'retangulo':     'concept_shape_rectangle', // PT (retângulo)
  'rectangulo':    'concept_shape_rectangle', // ES (rectángulo)
  'rectangle':     'concept_shape_rectangle', // FR
  'rechteck':      'concept_shape_rectangle', // DE
  'rettangolo':    'concept_shape_rectangle', // IT

  // ══════════════════════════════════════════════════════════════════════
  // ── Japanese (日本語) ─────────────────────────────────────────────────
  // Kanji forms are shared with Mandarin where identical characters are used.
  // ══════════════════════════════════════════════════════════════════════

  // Numbers — kanji (also shared with Mandarin for the same characters)
  '〇': 'concept_num_0', '零': 'concept_num_0',
  '三十': 'concept_num_30', '四十': 'concept_num_40', '五十': 'concept_num_50',
  '六十': 'concept_num_60', '七十': 'concept_num_70', '八十': 'concept_num_80',
  '九十': 'concept_num_90', '百': 'concept_num_100', '千': 'concept_num_1000',

  // Numbers — hiragana/katakana phonetic forms

  // Colors
  '赤': 'concept_color_red', '赤色': 'concept_color_red',
  '青': 'concept_color_blue', '青色': 'concept_color_blue',
  '緑': 'concept_color_green', '緑色': 'concept_color_green',
  '黄色': 'concept_color_yellow', '黄': 'concept_color_yellow',
  '白': 'concept_color_white', '白色': 'concept_color_white',
  '黒': 'concept_color_black', '黒色': 'concept_color_black',
  'オレンジ': 'concept_color_orange', 'オレンジ色': 'concept_color_orange',
  '橙色': 'concept_color_orange', '橙': 'concept_color_orange',
  '紫': 'concept_color_purple', '紫色': 'concept_color_purple',
  'ピンク': 'concept_color_pink', 'ピンク色': 'concept_color_pink', '桃色': 'concept_color_pink',
  '茶色': 'concept_color_brown', '茶': 'concept_color_brown',
  '灰色': 'concept_color_gray', '灰': 'concept_color_gray',

  // Seasons
  '春': 'concept_season_spring', 'はる': 'concept_season_spring',
  '夏': 'concept_season_summer', 'なつ': 'concept_season_summer',
  '秋': 'concept_season_fall',   'あき': 'concept_season_fall',
  '冬': 'concept_season_winter', 'ふゆ': 'concept_season_winter',

  // Weather
  '晴れ': 'concept_weather_sunny', '晴': 'concept_weather_sunny',
  '曇り': 'concept_weather_cloudy', '曇': 'concept_weather_cloudy',
  '雨': 'concept_weather_rain', '雪': 'concept_weather_snow',
  '太陽': 'concept_weather_sun', '風': 'concept_weather_wind',
  '霧': 'concept_weather_fog',  '嵐': 'concept_weather_storm',
  '雷': 'concept_weather_lightning', '虹': 'concept_weather_rainbow',
  '雨天': 'concept_weather_rainy', '雪天': 'concept_weather_snowy',

  // ══════════════════════════════════════════════════════════════════════
  // ── Mandarin Chinese (普通话) — Simplified characters ─────────────────
  // Many characters overlap with Japanese kanji above; only unique ones listed.
  // ══════════════════════════════════════════════════════════════════════

  // Numbers — simplified Chinese where different from Japanese kanji
  '两': 'concept_num_2',   // liǎng — Mandarin variant of "2"
  '二十一': 'concept_num_21', // Already covered by JP above
  '一百': 'concept_num_100', '一千': 'concept_num_1000',

  // Colors — simplified Chinese
  '红': 'concept_color_red', '红色': 'concept_color_red',
  '蓝': 'concept_color_blue', '蓝色': 'concept_color_blue',
  '绿': 'concept_color_green', '绿色': 'concept_color_green',
  // 黄/黄色, 白/白色, 黑/黑色, 紫/紫色, 灰色/灰 already covered by JP
  '橙': 'concept_color_orange', '橙色': 'concept_color_orange',
  '粉': 'concept_color_pink', '粉色': 'concept_color_pink', '粉红': 'concept_color_pink',
  '棕': 'concept_color_brown', '棕色': 'concept_color_brown',
  '咖啡色': 'concept_color_brown',

  // Seasons — same kanji as Japanese (春夏秋冬) already covered above

  // Weather — simplified Chinese
  '晴天': 'concept_weather_sunny',
  '多云': 'concept_weather_cloudy',
  // 雨, 雪, 风, 雾, 雷, 虹 already covered by JP
  '太阳': 'concept_weather_sun', '雾': 'concept_weather_fog',
  '暴风雨': 'concept_weather_storm', '彩虹': 'concept_weather_rainbow',
  '闪电': 'concept_weather_lightning',

  // ══════════════════════════════════════════════════════════════════════
  // ── Korean (한국어) ───────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════

  // Numbers — Sino-Korean (한자어)
  '오십': 'concept_num_50', '육십': 'concept_num_60', '칠십': 'concept_num_70',
  '팔십': 'concept_num_80', '구십': 'concept_num_90',
  '백': 'concept_num_100', '천': 'concept_num_1000',

  // Numbers — Native Korean (순우리말)
  '하나': 'concept_num_1', '한': 'concept_num_1',
  '둘': 'concept_num_2',  '두': 'concept_num_2',
  '셋': 'concept_num_3',  '세': 'concept_num_3',
  '넷': 'concept_num_4',  '네': 'concept_num_4',
  '다섯': 'concept_num_5',
  '여섯': 'concept_num_6',
  '일곱': 'concept_num_7',
  '여덟': 'concept_num_8',
  '아홉': 'concept_num_9',
  '열': 'concept_num_10',
  '열하나': 'concept_num_11', '열둘': 'concept_num_12', '열셋': 'concept_num_13',
  '열넷': 'concept_num_14', '열다섯': 'concept_num_15', '열여섯': 'concept_num_16',
  '열일곱': 'concept_num_17', '열여덟': 'concept_num_18', '열아홉': 'concept_num_19',
  '스물': 'concept_num_20', '서른': 'concept_num_30', '마흔': 'concept_num_40',
  '쉰': 'concept_num_50', '예순': 'concept_num_60', '일흔': 'concept_num_70',
  '여든': 'concept_num_80', '아흔': 'concept_num_90',

  // Colors
  '빨간색': 'concept_color_red',    '빨강': 'concept_color_red',
  '파란색': 'concept_color_blue',   '파랑': 'concept_color_blue',
  '초록색': 'concept_color_green',  '초록': 'concept_color_green', '녹색': 'concept_color_green',
  '노란색': 'concept_color_yellow', '노랑': 'concept_color_yellow',
  '흰색': 'concept_color_white',    '흰': 'concept_color_white', '하얀색': 'concept_color_white',
  '검은색': 'concept_color_black',  '검정': 'concept_color_black',
  '주황색': 'concept_color_orange', '주황': 'concept_color_orange',
  '보라색': 'concept_color_purple', '보라': 'concept_color_purple',
  '분홍색': 'concept_color_pink',   '분홍': 'concept_color_pink',
  '갈색': 'concept_color_brown',    '갈': 'concept_color_brown',
  '회색': 'concept_color_gray',     '회': 'concept_color_gray',

  // Seasons
  '봄': 'concept_season_spring',
  '여름': 'concept_season_summer',
  '가을': 'concept_season_fall',
  '겨울': 'concept_season_winter',

  // Weather
  '맑음': 'concept_weather_sunny',  '화창한': 'concept_weather_sunny',
  '흐림': 'concept_weather_cloudy', '구름': 'concept_weather_cloud',
  '비': 'concept_weather_rain',     '눈': 'concept_weather_snow',
  '태양': 'concept_weather_sun',    '해': 'concept_weather_sun',
  '바람': 'concept_weather_wind',   '안개': 'concept_weather_fog',
  '폭풍': 'concept_weather_storm',  '번개': 'concept_weather_lightning',
  '무지개': 'concept_weather_rainbow',
  '비가 오는': 'concept_weather_rainy', '눈이 오는': 'concept_weather_snowy',

  // ══════════════════════════════════════════════════════════════════════
  // ── Hebrew (עברית) ────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════

  // Numbers (Hebrew has gendered forms — both mapped to the same concept)
  'אפס': 'concept_num_0',
  'אחד': 'concept_num_1',   'אחת': 'concept_num_1',
  'שניים': 'concept_num_2', 'שתיים': 'concept_num_2',
  'שלושה': 'concept_num_3', 'שלוש': 'concept_num_3',
  'ארבעה': 'concept_num_4', 'ארבע': 'concept_num_4',
  'חמישה': 'concept_num_5', 'חמש': 'concept_num_5',
  'שישה': 'concept_num_6',  'שש': 'concept_num_6',
  'שבעה': 'concept_num_7',  'שבע': 'concept_num_7',
  'שמונה': 'concept_num_8',
  'תשעה': 'concept_num_9',  'תשע': 'concept_num_9',
  'עשרה': 'concept_num_10', 'עשר': 'concept_num_10',
  'אחד עשר': 'concept_num_11',  'אחת עשרה': 'concept_num_11',
  'שנים עשר': 'concept_num_12', 'שתים עשרה': 'concept_num_12',
  'שלושה עשר': 'concept_num_13','שלוש עשרה': 'concept_num_13',
  'ארבעה עשר': 'concept_num_14','ארבע עשרה': 'concept_num_14',
  'חמישה עשר': 'concept_num_15','חמש עשרה': 'concept_num_15',
  'שישה עשר': 'concept_num_16', 'שש עשרה': 'concept_num_16',
  'שבעה עשר': 'concept_num_17', 'שבע עשרה': 'concept_num_17',
  'שמונה עשר': 'concept_num_18',
  'תשעה עשר': 'concept_num_19', 'תשע עשרה': 'concept_num_19',
  'עשרים': 'concept_num_20',
  'עשרים ואחד': 'concept_num_21',
  'שלושים': 'concept_num_30', 'ארבעים': 'concept_num_40',
  'חמישים': 'concept_num_50', 'שישים': 'concept_num_60',
  'שבעים': 'concept_num_70', 'שמונים': 'concept_num_80',
  'תשעים': 'concept_num_90',
  'מאה': 'concept_num_100', 'אלף': 'concept_num_1000',

  // Colors (masculine forms — feminine would need ה suffix but m. is most common standalone)
  'אדום': 'concept_color_red',
  'כחול': 'concept_color_blue',
  'ירוק': 'concept_color_green',
  'צהוב': 'concept_color_yellow',
  'לבן': 'concept_color_white',
  'שחור': 'concept_color_black',
  'כתום': 'concept_color_orange',
  'סגול': 'concept_color_purple',
  'ורוד': 'concept_color_pink',
  'חום': 'concept_color_brown',
  'אפור': 'concept_color_gray',

  // Seasons
  'אביב': 'concept_season_spring',
  'קיץ':  'concept_season_summer',
  'סתיו': 'concept_season_fall',
  'חורף': 'concept_season_winter',

  // Weather
  'שמשי': 'concept_weather_sunny',   'בהיר': 'concept_weather_sunny',
  'מעונן': 'concept_weather_cloudy',
  'גשם': 'concept_weather_rain',     'גשום': 'concept_weather_rainy',
  'שלג': 'concept_weather_snow',     'מושלג': 'concept_weather_snowy',
  'שמש': 'concept_weather_sun',
  'רוח': 'concept_weather_wind',     'סוער': 'concept_weather_windy',
  'ערפל': 'concept_weather_fog',
  'סערה': 'concept_weather_storm',
  'ברק': 'concept_weather_lightning',
  'קשת': 'concept_weather_rainbow',
  'קשת בענן': 'concept_weather_rainbow',

  // ══════════════════════════════════════════════════════════════════════════
  // ── Language-Neutral Shared Vocabulary ────────────────────────────────────
  //
  // These concept keys point to EXISTING Spanish cache entries (vocab_spanish_*)
  // so images generated for Spanish are reused cross-language at zero extra cost.
  //
  // Strategy: map every language variant → vocab_spanish_{word}.
  //   • If the Spanish entry already exists in DB → instant cache hit ✅
  //   • If not yet seeded → first resolution (any language) generates it and
  //     caches under the Spanish key; every subsequent language gets it free ✅
  //
  // Excluded: words with cross-language normalization conflicts (see inline notes).
  // ══════════════════════════════════════════════════════════════════════════

  // ── Animals ───────────────────────────────────────────────────────────────
  // dog
  'chien':       'vocab_spanish_perro', // FR
  'hund':        'vocab_spanish_perro', // DE
  'cane':        'vocab_spanish_perro', // IT
  'cachorro':    'vocab_spanish_perro', // PT
  'dog':         'vocab_spanish_perro', // EN
  'いぬ':         'vocab_spanish_perro', // JA (hiragana)
  '犬':           'vocab_spanish_perro', // JA/ZH (kanji/hanzi)
  '개':           'vocab_spanish_perro', // KO
  '狗':           'vocab_spanish_perro', // ZH

  // cat
  'chat':        'vocab_spanish_gato', // FR
  'katze':       'vocab_spanish_gato', // DE
  'gatto':       'vocab_spanish_gato', // IT
  'cat':         'vocab_spanish_gato', // EN
  'ねこ':         'vocab_spanish_gato', // JA
  '猫':           'vocab_spanish_gato', // JA/ZH
  '고양이':        'vocab_spanish_gato', // KO

  // bird
  'oiseau':      'vocab_spanish_pajaro', // FR
  'vogel':       'vocab_spanish_pajaro', // DE
  'uccello':     'vocab_spanish_pajaro', // IT
  'passaro':     'vocab_spanish_pajaro', // PT (pássaro)
  'bird':        'vocab_spanish_pajaro', // EN
  'とり':         'vocab_spanish_pajaro', // JA
  '鳥':           'vocab_spanish_pajaro', // JA/ZH
  '새':           'vocab_spanish_pajaro', // KO
  '鸟':           'vocab_spanish_pajaro', // ZH (simplified)

  // fish
  'poisson':     'vocab_spanish_pez', // FR
  'fisch':       'vocab_spanish_pez', // DE
  'pesce':       'vocab_spanish_pez', // IT
  'peixe':       'vocab_spanish_pez', // PT
  'fish':        'vocab_spanish_pez', // EN
  'さかな':        'vocab_spanish_pez', // JA
  '魚':           'vocab_spanish_pez', // JA/ZH
  '물고기':        'vocab_spanish_pez', // KO

  // horse
  'cheval':      'vocab_spanish_caballo', // FR
  'pferd':       'vocab_spanish_caballo', // DE
  'cavallo':     'vocab_spanish_caballo', // IT
  'cavalo':      'vocab_spanish_caballo', // PT
  'horse':       'vocab_spanish_caballo', // EN
  'うま':         'vocab_spanish_caballo', // JA
  '馬':           'vocab_spanish_caballo', // JA/ZH
  '말':           'vocab_spanish_caballo', // KO
  '马':           'vocab_spanish_caballo', // ZH

  // cow
  'vache':       'vocab_spanish_vaca', // FR
  'kuh':         'vocab_spanish_vaca', // DE
  'mucca':       'vocab_spanish_vaca', // IT
  'cow':         'vocab_spanish_vaca', // EN
  'うし':         'vocab_spanish_vaca', // JA
  '牛':           'vocab_spanish_vaca', // JA/ZH
  '소':           'vocab_spanish_vaca', // KO

  // pig
  'cochon':      'vocab_spanish_cerdo', // FR
  'schwein':     'vocab_spanish_cerdo', // DE
  'maiale':      'vocab_spanish_cerdo', // IT
  'porco':       'vocab_spanish_cerdo', // PT
  'pig':         'vocab_spanish_cerdo', // EN
  'ぶた':         'vocab_spanish_cerdo', // JA
  '豚':           'vocab_spanish_cerdo', // JA
  '돼지':         'vocab_spanish_cerdo', // KO
  '猪':           'vocab_spanish_cerdo', // ZH

  // chicken (animal)
  'poulet':      'vocab_spanish_pollo', // FR
  'huhn':        'vocab_spanish_pollo', // DE
  'frango':      'vocab_spanish_pollo', // PT
  'chicken':     'vocab_spanish_pollo', // EN
  'にわとり':       'vocab_spanish_pollo', // JA
  '鶏':           'vocab_spanish_pollo', // JA
  '닭':           'vocab_spanish_pollo', // KO
  '鸡':           'vocab_spanish_pollo', // ZH
  // Note: "pollo" is same in ES and IT → resolves to vocab_spanish_pollo naturally

  // rabbit
  'lapin':       'vocab_spanish_conejo', // FR
  'kaninchen':   'vocab_spanish_conejo', // DE
  'coniglio':    'vocab_spanish_conejo', // IT
  'coelho':      'vocab_spanish_conejo', // PT
  'rabbit':      'vocab_spanish_conejo', // EN
  'うさぎ':        'vocab_spanish_conejo', // JA
  '兎':           'vocab_spanish_conejo', // JA
  '토끼':         'vocab_spanish_conejo', // KO
  '兔子':         'vocab_spanish_conejo', // ZH

  // ── Fruit & Food ──────────────────────────────────────────────────────────
  // apple
  'pomme':       'vocab_spanish_manzana', // FR
  'apfel':       'vocab_spanish_manzana', // DE
  'mela':        'vocab_spanish_manzana', // IT
  'maca':        'vocab_spanish_manzana', // PT (maçã)
  'apple':       'vocab_spanish_manzana', // EN
  'りんご':        'vocab_spanish_manzana', // JA
  '사과':         'vocab_spanish_manzana', // KO
  '苹果':         'vocab_spanish_manzana', // ZH

  // banana
  'banane':      'vocab_spanish_platano', // FR/DE
  'banana':      'vocab_spanish_platano', // IT/PT/EN
  'バナナ':        'vocab_spanish_platano', // JA (katakana)
  '바나나':        'vocab_spanish_platano', // KO
  '香蕉':         'vocab_spanish_platano', // ZH

  // strawberry
  'fraise':      'vocab_spanish_fresa', // FR
  'erdbeere':    'vocab_spanish_fresa', // DE
  'fragola':     'vocab_spanish_fresa', // IT
  'morango':     'vocab_spanish_fresa', // PT
  'strawberry':  'vocab_spanish_fresa', // EN
  'いちご':        'vocab_spanish_fresa', // JA
  '딸기':         'vocab_spanish_fresa', // KO
  '草莓':         'vocab_spanish_fresa', // ZH

  // tomato
  'pomodoro':    'vocab_spanish_tomate', // IT
  'tomato':      'vocab_spanish_tomate', // EN
  'トマト':        'vocab_spanish_tomate', // JA
  '토마토':        'vocab_spanish_tomate', // KO
  '西红柿':        'vocab_spanish_tomate', // ZH
  '番茄':         'vocab_spanish_tomate', // ZH alt
  // Note: "tomate" is same in ES, FR, DE, PT — all naturally share vocab_spanish_tomate

  // carrot
  'carotte':     'vocab_spanish_zanahoria', // FR
  'karotte':     'vocab_spanish_zanahoria', // DE
  'carota':      'vocab_spanish_zanahoria', // IT
  'cenoura':     'vocab_spanish_zanahoria', // PT
  'carrot':      'vocab_spanish_zanahoria', // EN
  'にんじん':       'vocab_spanish_zanahoria', // JA
  '당근':         'vocab_spanish_zanahoria', // KO
  '胡萝卜':        'vocab_spanish_zanahoria', // ZH

  // bread
  'brot':        'vocab_spanish_pan', // DE
  'pane':        'vocab_spanish_pan', // IT
  'pao':         'vocab_spanish_pan', // PT (pão)
  'bread':       'vocab_spanish_pan', // EN
  'パン':          'vocab_spanish_pan', // JA
  '빵':           'vocab_spanish_pan', // KO
  '面包':         'vocab_spanish_pan', // ZH
  // Note: "pain" (FR=bread) omitted — ambiguous with English "pain"
  // Note: "pan" is same in ES → naturally vocab_spanish_pan

  // milk
  'lait':        'vocab_spanish_leche', // FR
  'milch':       'vocab_spanish_leche', // DE
  'latte':       'vocab_spanish_leche', // IT
  'leite':       'vocab_spanish_leche', // PT
  'milk':        'vocab_spanish_leche', // EN
  'ぎゅうにゅう':     'vocab_spanish_leche', // JA
  '牛乳':         'vocab_spanish_leche', // JA kanji
  '우유':         'vocab_spanish_leche', // KO
  '牛奶':         'vocab_spanish_leche', // ZH

  // water
  'eau':         'vocab_spanish_agua', // FR
  'wasser':      'vocab_spanish_agua', // DE
  'acqua':       'vocab_spanish_agua', // IT
  'water':       'vocab_spanish_agua', // EN
  'みず':         'vocab_spanish_agua', // JA
  '水':           'vocab_spanish_agua', // JA/ZH shared
  '물':           'vocab_spanish_agua', // KO
  // Note: "agua" same in ES and PT

  // egg
  'oeuf':        'vocab_spanish_huevo', // FR
  'ei':          'vocab_spanish_huevo', // DE
  'uovo':        'vocab_spanish_huevo', // IT
  'ovo':         'vocab_spanish_huevo', // PT
  'egg':         'vocab_spanish_huevo', // EN
  'たまご':        'vocab_spanish_huevo', // JA
  '卵':           'vocab_spanish_huevo', // JA
  '달걀':         'vocab_spanish_huevo', // KO
  '鸡蛋':         'vocab_spanish_huevo', // ZH

  // cheese
  'fromage':     'vocab_spanish_queso', // FR
  'kase':        'vocab_spanish_queso', // DE (Käse)
  'formaggio':   'vocab_spanish_queso', // IT
  'queijo':      'vocab_spanish_queso', // PT
  'cheese':      'vocab_spanish_queso', // EN
  'チーズ':        'vocab_spanish_queso', // JA
  '치즈':         'vocab_spanish_queso', // KO
  '奶酪':         'vocab_spanish_queso', // ZH

  // grape
  'raisin':      'vocab_spanish_uva', // FR
  'traube':      'vocab_spanish_uva', // DE
  'grape':       'vocab_spanish_uva', // EN
  'ぶどう':        'vocab_spanish_uva', // JA
  '포도':         'vocab_spanish_uva', // KO
  '葡萄':         'vocab_spanish_uva', // ZH
  // Note: "uva" same in ES, IT, PT

  // orange (fruit) — using distinct key to avoid color swatch conflict
  // FR/DE "orange" → color was excluded from color map due to fruit ambiguity; here we map to fruit
  'orange':      'vocab_spanish_naranja_fruta', // FR/DE/EN — fruit image
  'arancia':     'vocab_spanish_naranja_fruta', // IT
  '오렌지':        'vocab_spanish_naranja_fruta', // KO
  '橙子':         'vocab_spanish_naranja_fruta', // ZH

  // ── Classroom & Office Objects ─────────────────────────────────────────────
  // table / desk (shared image)
  'tisch':       'vocab_spanish_mesa', // DE
  'tavolo':      'vocab_spanish_mesa', // IT
  'テーブル':       'vocab_spanish_mesa', // JA
  '테이블':        'vocab_spanish_mesa', // KO
  '桌子':         'vocab_spanish_mesa', // ZH
  'table':       'vocab_spanish_mesa', // EN/FR (same word after norm)
  // Note: "mesa" same in ES and PT

  // desk (escritorio)
  'bureau':      'vocab_spanish_escritorio', // FR
  'schreibtisch': 'vocab_spanish_escritorio', // DE
  'scrivania':   'vocab_spanish_escritorio', // IT
  'escrivaninha': 'vocab_spanish_escritorio', // PT
  'desk':        'vocab_spanish_escritorio', // EN
  'つくえ':        'vocab_spanish_escritorio', // JA
  '机':           'vocab_spanish_escritorio', // JA/ZH
  '책상':         'vocab_spanish_escritorio', // KO
  '书桌':         'vocab_spanish_escritorio', // ZH

  // chair
  'chaise':      'vocab_spanish_silla', // FR
  'stuhl':       'vocab_spanish_silla', // DE
  'sedia':       'vocab_spanish_silla', // IT
  'cadeira':     'vocab_spanish_silla', // PT
  'chair':       'vocab_spanish_silla', // EN
  'いす':         'vocab_spanish_silla', // JA
  '椅子':         'vocab_spanish_silla', // JA/ZH
  '의자':         'vocab_spanish_silla', // KO

  // book
  'livre':       'vocab_spanish_libro', // FR
  'buch':        'vocab_spanish_libro', // DE
  'livro':       'vocab_spanish_libro', // PT
  'book':        'vocab_spanish_libro', // EN
  'ほん':         'vocab_spanish_libro', // JA
  '本':           'vocab_spanish_libro', // JA/ZH
  '책':           'vocab_spanish_libro', // KO
  '书':           'vocab_spanish_libro', // ZH
  // Note: "libro" same in ES and IT

  // pen (bolígrafo)
  'stylo':       'vocab_spanish_boligrafo', // FR
  'stift':       'vocab_spanish_boligrafo', // DE
  'penna':       'vocab_spanish_boligrafo', // IT
  'caneta':      'vocab_spanish_boligrafo', // PT
  'pen':         'vocab_spanish_boligrafo', // EN
  'ペン':          'vocab_spanish_boligrafo', // JA
  '펜':           'vocab_spanish_boligrafo', // KO
  '钢笔':         'vocab_spanish_boligrafo', // ZH

  // pencil (lápiz)
  'crayon':      'vocab_spanish_lapiz', // FR (crayon = pencil in French)
  'bleistift':   'vocab_spanish_lapiz', // DE
  'matita':      'vocab_spanish_lapiz', // IT
  'lapis':       'vocab_spanish_lapiz', // PT (lápis)
  'pencil':      'vocab_spanish_lapiz', // EN
  'えんぴつ':       'vocab_spanish_lapiz', // JA
  '연필':         'vocab_spanish_lapiz', // KO
  '铅笔':         'vocab_spanish_lapiz', // ZH

  // paper (papel)
  'papier':      'vocab_spanish_papel', // FR/DE
  'carta':       'vocab_spanish_papel', // IT
  'paper':       'vocab_spanish_papel', // EN
  'かみ':         'vocab_spanish_papel', // JA
  '紙':           'vocab_spanish_papel', // JA/ZH
  '종이':         'vocab_spanish_papel', // KO
  '纸':           'vocab_spanish_papel', // ZH
  // Note: "papel" same in ES and PT

  // backpack (mochila)
  'rucksack':    'vocab_spanish_mochila', // DE
  'zaino':       'vocab_spanish_mochila', // IT
  'backpack':    'vocab_spanish_mochila', // EN
  'リュック':       'vocab_spanish_mochila', // JA
  '배낭':         'vocab_spanish_mochila', // KO
  '背包':         'vocab_spanish_mochila', // ZH
  'sac a dos':   'vocab_spanish_mochila', // FR (sac à dos normalized)
  // Note: "mochila" same in ES and PT

  // computer (computadora / ordenador)
  'ordinateur':  'vocab_spanish_computadora', // FR
  'computer':    'vocab_spanish_computadora', // DE/IT/EN (same word)
  'computador':  'vocab_spanish_computadora', // PT
  'パソコン':       'vocab_spanish_computadora', // JA
  '컴퓨터':        'vocab_spanish_computadora', // KO
  '电脑':         'vocab_spanish_computadora', // ZH

  // ── Clothing & Accessories ─────────────────────────────────────────────────
  // shirt (camisa)
  'chemise':     'vocab_spanish_camisa', // FR
  'hemd':        'vocab_spanish_camisa', // DE
  'camicia':     'vocab_spanish_camisa', // IT
  'shirt':       'vocab_spanish_camisa', // EN
  'シャツ':        'vocab_spanish_camisa', // JA
  '셔츠':         'vocab_spanish_camisa', // KO
  '衬衫':         'vocab_spanish_camisa', // ZH
  // Note: "camisa" same in ES and PT

  // pants / trousers (pantalones)
  'pantalon':    'vocab_spanish_pantalones', // FR
  'hose':        'vocab_spanish_pantalones', // DE
  'pantaloni':   'vocab_spanish_pantalones', // IT
  'calca':       'vocab_spanish_pantalones', // PT (calça)
  'pants':       'vocab_spanish_pantalones', // EN
  'trousers':    'vocab_spanish_pantalones', // EN alt
  'ズボン':        'vocab_spanish_pantalones', // JA
  '바지':         'vocab_spanish_pantalones', // KO
  '裤子':         'vocab_spanish_pantalones', // ZH

  // dress (vestido)
  'robe':        'vocab_spanish_vestido', // FR
  'kleid':       'vocab_spanish_vestido', // DE
  'vestito':     'vocab_spanish_vestido', // IT
  'dress':       'vocab_spanish_vestido', // EN
  'ドレス':        'vocab_spanish_vestido', // JA
  '드레스':        'vocab_spanish_vestido', // KO
  '连衣裙':        'vocab_spanish_vestido', // ZH
  // Note: "vestido" same in ES and PT

  // shoes (zapatos)
  'chaussures':  'vocab_spanish_zapatos', // FR
  'schuhe':      'vocab_spanish_zapatos', // DE
  'scarpe':      'vocab_spanish_zapatos', // IT
  'sapatos':     'vocab_spanish_zapatos', // PT
  'shoes':       'vocab_spanish_zapatos', // EN
  'くつ':         'vocab_spanish_zapatos', // JA
  '靴':           'vocab_spanish_zapatos', // JA
  '신발':         'vocab_spanish_zapatos', // KO
  '鞋子':         'vocab_spanish_zapatos', // ZH

  // hat / cap (sombrero)
  'chapeau':     'vocab_spanish_sombrero', // FR
  'hut':         'vocab_spanish_sombrero', // DE
  'cappello':    'vocab_spanish_sombrero', // IT
  'chapeu':      'vocab_spanish_sombrero', // PT (chapéu)
  'hat':         'vocab_spanish_sombrero', // EN
  'ぼうし':        'vocab_spanish_sombrero', // JA
  '帽子':         'vocab_spanish_sombrero', // JA/ZH shared
  '모자':         'vocab_spanish_sombrero', // KO

  // jacket (chaqueta)
  'veste':       'vocab_spanish_chaqueta', // FR
  'jacke':       'vocab_spanish_chaqueta', // DE
  'giacca':      'vocab_spanish_chaqueta', // IT
  'jaqueta':     'vocab_spanish_chaqueta', // PT
  'jacket':      'vocab_spanish_chaqueta', // EN
  'ジャケット':      'vocab_spanish_chaqueta', // JA
  '자켓':         'vocab_spanish_chaqueta', // KO
  '夹克':         'vocab_spanish_chaqueta', // ZH

  // socks (calcetines)
  'chaussettes': 'vocab_spanish_calcetines', // FR
  'socken':      'vocab_spanish_calcetines', // DE
  'calzini':     'vocab_spanish_calcetines', // IT
  'meias':       'vocab_spanish_calcetines', // PT
  'socks':       'vocab_spanish_calcetines', // EN
  'くつした':       'vocab_spanish_calcetines', // JA
  '靴下':         'vocab_spanish_calcetines', // JA
  '양말':         'vocab_spanish_calcetines', // KO
  '袜子':         'vocab_spanish_calcetines', // ZH

  // ── Common Verbs / Activities ──────────────────────────────────────────────
  // eat (comer) — conjugated FR/DE/IT/ES forms included
  'manger':      'vocab_spanish_comer', // FR infinitive
  'mange':       'vocab_spanish_comer', // FR je/il/elle mange
  'manges':      'vocab_spanish_comer', // FR tu manges
  'mangeons':    'vocab_spanish_comer', // FR nous mangeons
  'mangez':      'vocab_spanish_comer', // FR vous mangez
  'mangent':     'vocab_spanish_comer', // FR ils mangent
  'essen':       'vocab_spanish_comer', // DE infinitive
  'esse':        'vocab_spanish_comer', // DE ich esse
  'isst':        'vocab_spanish_comer', // DE er/sie/es isst
  'mangiare':    'vocab_spanish_comer', // IT infinitive
  'mangio':      'vocab_spanish_comer', // IT io mangio
  'mangia':      'vocab_spanish_comer', // IT lui/lei mangia
  'eat':         'vocab_spanish_comer', // EN
  'eats':        'vocab_spanish_comer', // EN he/she eats
  // Note: "como" omitted (also Spanish "how"); "come" omitted (English "to come" collision)
  'たべる':        'vocab_spanish_comer', // JA
  '食べる':        'vocab_spanish_comer', // JA kanji
  '먹다':         'vocab_spanish_comer', // KO
  '吃':           'vocab_spanish_comer', // ZH
  // Note: "comer" same in ES and PT

  // sleep (dormir)
  'schlafen':    'vocab_spanish_dormir', // DE
  'dormire':     'vocab_spanish_dormir', // IT
  'sleep':       'vocab_spanish_dormir', // EN
  'ねる':         'vocab_spanish_dormir', // JA
  '寝る':         'vocab_spanish_dormir', // JA
  '자다':         'vocab_spanish_dormir', // KO
  '睡觉':         'vocab_spanish_dormir', // ZH
  // Note: "dormir" same in ES, FR, PT

  // run (correr)
  'courir':      'vocab_spanish_correr', // FR
  'laufen':      'vocab_spanish_correr', // DE
  'correre':     'vocab_spanish_correr', // IT
  'run':         'vocab_spanish_correr', // EN
  'はしる':        'vocab_spanish_correr', // JA
  '走る':         'vocab_spanish_correr', // JA
  '달리다':        'vocab_spanish_correr', // KO
  '跑步':         'vocab_spanish_correr', // ZH
  // Note: "correr" same in ES and PT

  // speak / talk (hablar)
  'parler':      'vocab_spanish_hablar', // FR
  'sprechen':    'vocab_spanish_hablar', // DE
  'parlare':     'vocab_spanish_hablar', // IT
  'falar':       'vocab_spanish_hablar', // PT
  'speak':       'vocab_spanish_hablar', // EN
  'talk':        'vocab_spanish_hablar', // EN alt
  'はなす':        'vocab_spanish_hablar', // JA
  '話す':         'vocab_spanish_hablar', // JA
  '말하다':        'vocab_spanish_hablar', // KO
  '说话':         'vocab_spanish_hablar', // ZH

  // listen (escuchar)
  'ecouter':     'vocab_spanish_escuchar', // FR (écouter)
  'horen':       'vocab_spanish_escuchar', // DE (hören)
  'ascoltare':   'vocab_spanish_escuchar', // IT
  'escutar':     'vocab_spanish_escuchar', // PT
  'listen':      'vocab_spanish_escuchar', // EN
  'きく':         'vocab_spanish_escuchar', // JA
  '聞く':         'vocab_spanish_escuchar', // JA
  '듣다':         'vocab_spanish_escuchar', // KO
  '听':           'vocab_spanish_escuchar', // ZH

  // write (escribir)
  'ecrire':      'vocab_spanish_escribir', // FR (écrire)
  'schreiben':   'vocab_spanish_escribir', // DE
  'scrivere':    'vocab_spanish_escribir', // IT
  'escrever':    'vocab_spanish_escribir', // PT
  'write':       'vocab_spanish_escribir', // EN
  'かく':         'vocab_spanish_escribir', // JA
  '書く':         'vocab_spanish_escribir', // JA
  '쓰다':         'vocab_spanish_escribir', // KO
  '写字':         'vocab_spanish_escribir', // ZH

  // read (leer)
  'lire':        'vocab_spanish_leer', // FR
  'lesen':       'vocab_spanish_leer', // DE
  'leggere':     'vocab_spanish_leer', // IT
  'ler':         'vocab_spanish_leer', // PT
  'read':        'vocab_spanish_leer', // EN
  'よむ':         'vocab_spanish_leer', // JA
  '読む':         'vocab_spanish_leer', // JA
  '읽다':         'vocab_spanish_leer', // KO
  '看书':         'vocab_spanish_leer', // ZH
  // Note: "leer" (DE) = "empty" — NOT added here to avoid conflict with ES "leer" = read

  // dance (bailar)
  'danser':      'vocab_spanish_bailar', // FR
  'tanzen':      'vocab_spanish_bailar', // DE
  'ballare':     'vocab_spanish_bailar', // IT
  'dancar':      'vocab_spanish_bailar', // PT (dançar)
  'dance':       'vocab_spanish_bailar', // EN
  'おどる':        'vocab_spanish_bailar', // JA
  '踊る':         'vocab_spanish_bailar', // JA
  '춤추다':        'vocab_spanish_bailar', // KO
  '跳舞':         'vocab_spanish_bailar', // ZH

  // sing (cantar)
  'chanter':     'vocab_spanish_cantar', // FR
  'singen':      'vocab_spanish_cantar', // DE
  'cantare':     'vocab_spanish_cantar', // IT
  'sing':        'vocab_spanish_cantar', // EN
  'うたう':        'vocab_spanish_cantar', // JA
  '歌う':         'vocab_spanish_cantar', // JA
  '노래하다':       'vocab_spanish_cantar', // KO
  '唱歌':         'vocab_spanish_cantar', // ZH
  // Note: "cantar" same in ES and PT

  // swim (nadar)
  'nager':       'vocab_spanish_nadar', // FR
  'schwimmen':   'vocab_spanish_nadar', // DE
  'nuotare':     'vocab_spanish_nadar', // IT
  'swim':        'vocab_spanish_nadar', // EN
  'およぐ':        'vocab_spanish_nadar', // JA
  '泳ぐ':         'vocab_spanish_nadar', // JA
  '수영하다':       'vocab_spanish_nadar', // KO
  '游泳':         'vocab_spanish_nadar', // ZH
  // Note: "nadar" same in ES and PT

  // walk (caminar)
  'marcher':     'vocab_spanish_caminar', // FR
  'gehen':       'vocab_spanish_caminar', // DE
  'camminare':   'vocab_spanish_caminar', // IT
  'caminhar':    'vocab_spanish_caminar', // PT
  'walk':        'vocab_spanish_caminar', // EN
  'あるく':        'vocab_spanish_caminar', // JA
  '歩く':         'vocab_spanish_caminar', // JA
  '걷다':         'vocab_spanish_caminar', // KO
  '走路':         'vocab_spanish_caminar', // ZH

  // cook (cocinar)
  'cuisiner':    'vocab_spanish_cocinar', // FR
  'kochen':      'vocab_spanish_cocinar', // DE
  'cucinare':    'vocab_spanish_cocinar', // IT
  'cozinhar':    'vocab_spanish_cocinar', // PT
  'cook':        'vocab_spanish_cocinar', // EN
  'りょうりする':     'vocab_spanish_cocinar', // JA
  '料理する':       'vocab_spanish_cocinar', // JA
  '요리하다':       'vocab_spanish_cocinar', // KO
  '做饭':         'vocab_spanish_cocinar', // ZH

  // play (jugar)
  'jouer':       'vocab_spanish_jugar', // FR
  'spielen':     'vocab_spanish_jugar', // DE
  'giocare':     'vocab_spanish_jugar', // IT
  'jogar':       'vocab_spanish_jugar', // PT
  'play':        'vocab_spanish_jugar', // EN
  'あそぶ':        'vocab_spanish_jugar', // JA
  '遊ぶ':         'vocab_spanish_jugar', // JA
  '놀다':         'vocab_spanish_jugar', // KO
  '玩':           'vocab_spanish_jugar', // ZH

  // buy (comprar)
  'acheter':     'vocab_spanish_comprar', // FR
  'kaufen':      'vocab_spanish_comprar', // DE
  'comprare':    'vocab_spanish_comprar', // IT
  'buy':         'vocab_spanish_comprar', // EN
  'かう':         'vocab_spanish_comprar', // JA
  '買う':         'vocab_spanish_comprar', // JA
  '사다':         'vocab_spanish_comprar', // KO
  '买':           'vocab_spanish_comprar', // ZH
  // Note: "comprar" same in ES and PT

  // study (estudiar) — conjugated FR/DE/IT/ES forms also included
  'etudier':     'vocab_spanish_estudiar', // FR infinitive (étudier)
  'etudie':      'vocab_spanish_estudiar', // FR je/il/elle étudie (also j'étudie stripped)
  'etudies':     'vocab_spanish_estudiar', // FR tu étudies
  'etudions':    'vocab_spanish_estudiar', // FR nous étudions
  'etudiez':     'vocab_spanish_estudiar', // FR vous étudiez
  'etudient':    'vocab_spanish_estudiar', // FR ils étudient
  'studieren':   'vocab_spanish_estudiar', // DE infinitive
  'studiere':    'vocab_spanish_estudiar', // DE ich studiere
  'studierst':   'vocab_spanish_estudiar', // DE du studierst
  'studiert':    'vocab_spanish_estudiar', // DE er/sie/es studiert
  'studiare':    'vocab_spanish_estudiar', // IT infinitive
  'studio':      'vocab_spanish_estudiar', // IT io studio
  'studia':      'vocab_spanish_estudiar', // IT lui/lei studia
  'estudar':     'vocab_spanish_estudiar', // PT infinitive
  'study':       'vocab_spanish_estudiar', // EN
  'studies':     'vocab_spanish_estudiar', // EN he/she studies
  'estudio':     'vocab_spanish_estudiar', // ES yo estudio
  'estudia':     'vocab_spanish_estudiar', // ES él/ella estudia
  'benkyo suru': 'vocab_spanish_estudiar', // JA (勉強する romanised)
  'benkyosuru':  'vocab_spanish_estudiar', // JA alt
  '勉強する':     'vocab_spanish_estudiar', // JA kanji
  'べんきょうする':  'vocab_spanish_estudiar', // JA hiragana
  '공부하다':     'vocab_spanish_estudiar', // KO
  '学习':        'vocab_spanish_estudiar', // ZH

  // watch / look at (mirar) — conjugated FR/DE/IT/ES forms also included
  'regarder':    'vocab_spanish_mirar', // FR infinitive
  'regarde':     'vocab_spanish_mirar', // FR je/il/elle (je regarde, il regarde)
  'regardes':    'vocab_spanish_mirar', // FR tu
  'regardons':   'vocab_spanish_mirar', // FR nous
  'regardez':    'vocab_spanish_mirar', // FR vous
  'regardent':   'vocab_spanish_mirar', // FR ils/elles
  'schauen':     'vocab_spanish_mirar', // DE infinitive
  'schaue':      'vocab_spanish_mirar', // DE ich schaue
  'schaust':     'vocab_spanish_mirar', // DE du schaust
  'schaut':      'vocab_spanish_mirar', // DE er/sie/es schaut
  'anschauen':   'vocab_spanish_mirar', // DE infinitive alt
  'guardare':    'vocab_spanish_mirar', // IT infinitive
  'guardo':      'vocab_spanish_mirar', // IT io guardo
  'guarda':      'vocab_spanish_mirar', // IT lui/lei guarda
  'assistir':    'vocab_spanish_mirar', // PT infinitive
  'watch':       'vocab_spanish_mirar', // EN
  'look':        'vocab_spanish_mirar', // EN alt (look at)
  'miro':        'vocab_spanish_mirar', // ES yo miro
  'mira':        'vocab_spanish_mirar', // ES él/ella mira
  'みる':        'vocab_spanish_mirar', // JA
  '見る':        'vocab_spanish_mirar', // JA kanji
  '보다':        'vocab_spanish_mirar', // KO
  '看':          'vocab_spanish_mirar', // ZH

  // work (trabajar) — conjugated FR/DE/IT/ES forms also included
  'travailler':  'vocab_spanish_trabajar', // FR infinitive
  'travaille':   'vocab_spanish_trabajar', // FR je/il/elle travaille
  'travailles':  'vocab_spanish_trabajar', // FR tu travailles
  'travaillons': 'vocab_spanish_trabajar', // FR nous travaillons
  'travaillez':  'vocab_spanish_trabajar', // FR vous travaillez
  'travaillent': 'vocab_spanish_trabajar', // FR ils travaillent
  'arbeiten':    'vocab_spanish_trabajar', // DE infinitive
  'arbeite':     'vocab_spanish_trabajar', // DE ich arbeite
  'arbeitest':   'vocab_spanish_trabajar', // DE du arbeitest
  'arbeitet':    'vocab_spanish_trabajar', // DE er/sie/es arbeitet
  'lavorare':    'vocab_spanish_trabajar', // IT infinitive
  'lavoro':      'vocab_spanish_trabajar', // IT io lavoro
  'lavora':      'vocab_spanish_trabajar', // IT lui/lei lavora
  'trabalhar':   'vocab_spanish_trabajar', // PT infinitive
  'work':        'vocab_spanish_trabajar', // EN
  'works':       'vocab_spanish_trabajar', // EN he/she works
  'trabajo':     'vocab_spanish_trabajar', // ES yo trabajo
  'trabaja':     'vocab_spanish_trabajar', // ES él/ella trabaja
  'はたらく':     'vocab_spanish_trabajar', // JA
  '働く':        'vocab_spanish_trabajar', // JA kanji
  '일하다':      'vocab_spanish_trabajar', // KO
  '工作':        'vocab_spanish_trabajar', // ZH

  // get up / wake up (levantarse)
  // Note: reflexive sentence forms ("je me lève") have 3 tokens after pronoun strip
  // so they fall through cleanly — only bare infinitives and non-reflexive forms match here.
  // Separable verb stems (stehe, steht, wache) are omitted to avoid collision with stehen/wachen.
  'se lever':       'vocab_spanish_levantarse', // FR infinitive (se lever)
  'lever':          'vocab_spanish_levantarse', // FR bare infinitive (after se stripped)
  'leve':           'vocab_spanish_levantarse', // FR lève → leve (diacritic stripped)
  'se reveiller':   'vocab_spanish_levantarse', // FR (se réveiller — alt)
  'aufstehen':      'vocab_spanish_levantarse', // DE infinitive
  'aufwachen':      'vocab_spanish_levantarse', // DE (wake up infinitive)
  'alzarsi':        'vocab_spanish_levantarse', // IT infinitive
  'svegliarsi':     'vocab_spanish_levantarse', // IT infinitive (wake up)
  'levantarse':     'vocab_spanish_levantarse', // PT/ES normalised (levantar-se → levantarse)
  'se levantar':    'vocab_spanish_levantarse', // PT alt
  'acordar':        'vocab_spanish_levantarse', // PT (wake up)
  'get up':         'vocab_spanish_levantarse', // EN
  'wake up':        'vocab_spanish_levantarse', // EN alt
  'gets up':        'vocab_spanish_levantarse', // EN he/she gets up
  'me levanto':     'vocab_spanish_levantarse', // ES yo me levanto (normalised: me levanto)
  'おきる':         'vocab_spanish_levantarse', // JA
  '起きる':         'vocab_spanish_levantarse', // JA kanji
  '일어나다':        'vocab_spanish_levantarse', // KO
  '起床':           'vocab_spanish_levantarse', // ZH

  // go to bed (acostarse)
  'se coucher':     'vocab_spanish_acostarse', // FR infinitive
  'couche':         'vocab_spanish_acostarse', // FR je me couche stem
  'schlafen gehen': 'vocab_spanish_acostarse', // DE
  'ins bett gehen': 'vocab_spanish_acostarse', // DE alt
  'andare a letto': 'vocab_spanish_acostarse', // IT
  'coricarsi':      'vocab_spanish_acostarse', // IT alt
  'deitarse':       'vocab_spanish_acostarse', // PT (deitar-se → deitarse after normalizeWord)
  'deitar':         'vocab_spanish_acostarse', // PT bare verb
  'ir dormir':      'vocab_spanish_acostarse', // PT alt
  'go to bed':      'vocab_spanish_acostarse', // EN
  'goes to bed':    'vocab_spanish_acostarse', // EN he/she

  // get dressed (vestirse)
  // "s'habiller" → normalizeWord → "shabiller" (apostrophe removed, no space)
  // stripPronounPrefix pre-processes apostrophes to spaces, so "je m'habille" → "je m habille" → 3 tokens → falls through
  'shabiller':      'vocab_spanish_vestirse', // FR s'habiller normalised (apostrophe removed)
  'habiller':       'vocab_spanish_vestirse', // FR bare infinitive
  'habille':        'vocab_spanish_vestirse', // FR je/il m'habille → habille after strip
  'sich anziehen':  'vocab_spanish_vestirse', // DE (sich anziehen normalised: sich anziehen)
  'vestirsi':       'vocab_spanish_vestirse', // IT infinitive
  'vestirse':       'vocab_spanish_vestirse', // ES/PT (vestir-se → vestirse after normalizeWord)
  'get dressed':    'vocab_spanish_vestirse', // EN
  '着る':           'vocab_spanish_vestirse', // JA
  '옷을 입다':      'vocab_spanish_vestirse', // KO
  '穿衣':           'vocab_spanish_vestirse', // ZH

  // speak / talk (hablar) — conjugated FR/DE/IT/PT/ES/EN forms included
  // "Tu parles." → strip tu → parles → vocab_spanish_hablar ✓
  'parle':       'vocab_spanish_hablar', // FR je/il/elle parle
  'parles':      'vocab_spanish_hablar', // FR tu parles
  'parlons':     'vocab_spanish_hablar', // FR nous parlons
  'parlez':      'vocab_spanish_hablar', // FR vous parlez
  'parlent':     'vocab_spanish_hablar', // FR ils parlent
  'spreche':     'vocab_spanish_hablar', // DE ich spreche
  'sprichst':    'vocab_spanish_hablar', // DE du sprichst
  'spricht':     'vocab_spanish_hablar', // DE er/sie/es spricht
  'parlo':       'vocab_spanish_hablar', // IT io parlo
  'parla':       'vocab_spanish_hablar', // IT lui/lei parla
  'parlano':     'vocab_spanish_hablar', // IT loro parlano
  'falo':        'vocab_spanish_hablar', // PT eu falo
  'fala':        'vocab_spanish_hablar', // PT ele/ela fala
  'speaks':      'vocab_spanish_hablar', // EN he/she speaks
  'talks':       'vocab_spanish_hablar', // EN he/she talks
  'hablo':       'vocab_spanish_hablar', // ES yo hablo
  'habla':       'vocab_spanish_hablar', // ES él/ella habla

  // ── Body Parts (all point to shared body diagram) ─────────────────────────
  // head (cabeza)
  'tete':        'vocab_spanish_cabeza', // FR (tête)
  'kopf':        'vocab_spanish_cabeza', // DE
  'testa':       'vocab_spanish_cabeza', // IT
  'cabeca':      'vocab_spanish_cabeza', // PT (cabeça)
  'head':        'vocab_spanish_cabeza', // EN
  'あたま':        'vocab_spanish_cabeza', // JA
  '頭':           'vocab_spanish_cabeza', // JA/ZH
  '머리':         'vocab_spanish_cabeza', // KO

  // hand (mano)
  'main':        'vocab_spanish_mano', // FR
  'hand':        'vocab_spanish_mano', // DE/EN (same word)
  'mao':         'vocab_spanish_mano', // PT (mão)
  'て':           'vocab_spanish_mano', // JA
  '手':           'vocab_spanish_mano', // JA/ZH
  '손':           'vocab_spanish_mano', // KO
  // Note: "mano" same in ES and IT

  // foot (pie)
  'pied':        'vocab_spanish_pie', // FR
  'fus':         'vocab_spanish_pie', // DE (Fuß → fus after ß→s)
  'piede':       'vocab_spanish_pie', // IT
  'pe':          'vocab_spanish_pie', // PT (pé)
  'foot':        'vocab_spanish_pie', // EN
  'あし':         'vocab_spanish_pie', // JA
  '足':           'vocab_spanish_pie', // JA/ZH
  '발':           'vocab_spanish_pie', // KO
  '脚':           'vocab_spanish_pie', // ZH

  // arm (brazo)
  'bras':        'vocab_spanish_brazo', // FR
  'arm':         'vocab_spanish_brazo', // DE/EN (same word)
  'braccio':     'vocab_spanish_brazo', // IT
  'braco':       'vocab_spanish_brazo', // PT (braço)
  'うで':         'vocab_spanish_brazo', // JA
  '腕':           'vocab_spanish_brazo', // JA/ZH

  // eye (ojo)
  'oeil':        'vocab_spanish_ojo', // FR (œil)
  'auge':        'vocab_spanish_ojo', // DE
  'occhio':      'vocab_spanish_ojo', // IT
  'olho':        'vocab_spanish_ojo', // PT
  'eye':         'vocab_spanish_ojo', // EN
  'め':           'vocab_spanish_ojo', // JA
  '目':           'vocab_spanish_ojo', // JA/ZH
  '눈':           'vocab_spanish_ojo', // KO
  '眼睛':         'vocab_spanish_ojo', // ZH

  // nose (nariz)
  'nez':         'vocab_spanish_nariz', // FR
  'nase':        'vocab_spanish_nariz', // DE
  'naso':        'vocab_spanish_nariz', // IT
  'nose':        'vocab_spanish_nariz', // EN
  'はな':         'vocab_spanish_nariz', // JA
  '鼻':           'vocab_spanish_nariz', // JA/ZH
  '코':           'vocab_spanish_nariz', // KO
  '鼻子':         'vocab_spanish_nariz', // ZH
  // Note: "nariz" same in ES and PT

  // mouth (boca)
  'bouche':      'vocab_spanish_boca', // FR
  'mund':        'vocab_spanish_boca', // DE
  'bocca':       'vocab_spanish_boca', // IT
  'mouth':       'vocab_spanish_boca', // EN
  'くち':         'vocab_spanish_boca', // JA
  '口':           'vocab_spanish_boca', // JA/ZH
  '입':           'vocab_spanish_boca', // KO
  '嘴':           'vocab_spanish_boca', // ZH
  // Note: "boca" same in ES and PT

  // leg (pierna)
  'jambe':       'vocab_spanish_pierna', // FR
  'bein':        'vocab_spanish_pierna', // DE
  'gamba':       'vocab_spanish_pierna', // IT
  'perna':       'vocab_spanish_pierna', // PT
  'leg':         'vocab_spanish_pierna', // EN
  '다리':         'vocab_spanish_pierna', // KO

  // ear (oreja)
  'oreille':     'vocab_spanish_oreja', // FR
  'ohr':         'vocab_spanish_oreja', // DE
  'orecchio':    'vocab_spanish_oreja', // IT
  'orelha':      'vocab_spanish_oreja', // PT
  'ear':         'vocab_spanish_oreja', // EN
  'みみ':         'vocab_spanish_oreja', // JA
  '耳':           'vocab_spanish_oreja', // JA/ZH
  '귀':           'vocab_spanish_oreja', // KO
  '耳朵':         'vocab_spanish_oreja', // ZH

  // shoulder (hombro)
  'epaule':      'vocab_spanish_hombro', // FR (épaule)
  'schulter':    'vocab_spanish_hombro', // DE
  'spalla':      'vocab_spanish_hombro', // IT
  'ombro':       'vocab_spanish_hombro', // PT
  'shoulder':    'vocab_spanish_hombro', // EN
  'かた':         'vocab_spanish_hombro', // JA
  '肩':           'vocab_spanish_hombro', // JA/ZH
  '어깨':         'vocab_spanish_hombro', // KO

  // knee (rodilla)
  'genou':       'vocab_spanish_rodilla', // FR
  'knie':        'vocab_spanish_rodilla', // DE
  'ginocchio':   'vocab_spanish_rodilla', // IT
  'joelho':      'vocab_spanish_rodilla', // PT
  'knee':        'vocab_spanish_rodilla', // EN
  'ひざ':         'vocab_spanish_rodilla', // JA
  '膝':           'vocab_spanish_rodilla', // JA
  '무릎':         'vocab_spanish_rodilla', // KO
  '膝盖':         'vocab_spanish_rodilla', // ZH

  // back (espalda)
  'rucken':      'vocab_spanish_espalda', // DE (Rücken)
  'schiena':     'vocab_spanish_espalda', // IT
  'costas':      'vocab_spanish_espalda', // PT
  'back':        'vocab_spanish_espalda', // EN
  'せなか':        'vocab_spanish_espalda', // JA
  '背中':         'vocab_spanish_espalda', // JA
  '등':           'vocab_spanish_espalda', // KO
  '背部':         'vocab_spanish_espalda', // ZH
  // Note: "dos" (FR=back) omitted — conflicts with concept_num_2

  // stomach (estómago)
  'ventre':      'vocab_spanish_estomago', // FR
  'bauch':       'vocab_spanish_estomago', // DE
  'stomaco':     'vocab_spanish_estomago', // IT
  'barriga':     'vocab_spanish_estomago', // PT
  'stomach':     'vocab_spanish_estomago', // EN
  'おなか':        'vocab_spanish_estomago', // JA
  'お腹':         'vocab_spanish_estomago', // JA
  '배':           'vocab_spanish_estomago', // KO
  '肚子':         'vocab_spanish_estomago', // ZH

  // neck (cuello)
  'cou':         'vocab_spanish_cuello', // FR
  'hals':        'vocab_spanish_cuello', // DE
  'collo':       'vocab_spanish_cuello', // IT
  'pescoco':     'vocab_spanish_cuello', // PT (pescoço)
  'neck':        'vocab_spanish_cuello', // EN
  'くび':         'vocab_spanish_cuello', // JA
  '首':           'vocab_spanish_cuello', // JA/ZH
  '목':           'vocab_spanish_cuello', // KO
  '脖子':         'vocab_spanish_cuello', // ZH

  // heart (corazón)
  'coeur':       'vocab_spanish_corazon', // FR
  'herz':        'vocab_spanish_corazon', // DE
  'cuore':       'vocab_spanish_corazon', // IT
  'coracao':     'vocab_spanish_corazon', // PT (coração)
  'heart':       'vocab_spanish_corazon', // EN
  'こころ':        'vocab_spanish_corazon', // JA
  '心':           'vocab_spanish_corazon', // JA/ZH
  '심장':         'vocab_spanish_corazon', // KO
  '心脏':         'vocab_spanish_corazon', // ZH

  // ── Emotions ──────────────────────────────────────────────────────────────
  // happy (feliz)
  'heureux':     'vocab_spanish_feliz', // FR
  'heureuse':    'vocab_spanish_feliz', // FR fem
  'glucklich':   'vocab_spanish_feliz', // DE (glücklich)
  'felice':      'vocab_spanish_feliz', // IT
  'happy':       'vocab_spanish_feliz', // EN
  'うれしい':       'vocab_spanish_feliz', // JA
  '嬉しい':        'vocab_spanish_feliz', // JA
  '행복하다':       'vocab_spanish_feliz', // KO
  '快乐':         'vocab_spanish_feliz', // ZH
  'feliz':       'vocab_spanish_feliz', // ES/PT — same word, share one cache key

  // sad (triste)
  'triste':      'vocab_spanish_triste', // ES/FR/IT/PT — same word, share one cache key
  'traurig':     'vocab_spanish_triste', // DE
  'sad':         'vocab_spanish_triste', // EN
  'かなしい':       'vocab_spanish_triste', // JA
  '悲しい':        'vocab_spanish_triste', // JA
  '슬프다':        'vocab_spanish_triste', // KO
  '伤心':         'vocab_spanish_triste', // ZH

  // angry (enojado)
  'fache':       'vocab_spanish_enojado', // FR (fâché)
  'wutend':      'vocab_spanish_enojado', // DE (wütend)
  'arrabbiato':  'vocab_spanish_enojado', // IT
  'irritado':    'vocab_spanish_enojado', // PT
  'angry':       'vocab_spanish_enojado', // EN
  'おこっている':     'vocab_spanish_enojado', // JA
  '怒っている':      'vocab_spanish_enojado', // JA
  '화나다':        'vocab_spanish_enojado', // KO
  '生气':         'vocab_spanish_enojado', // ZH

  // surprised (sorprendido)
  'surpris':     'vocab_spanish_sorprendido', // FR
  'uberrascht':  'vocab_spanish_sorprendido', // DE (überrascht)
  'sorpreso':    'vocab_spanish_sorprendido', // IT
  'surpreso':    'vocab_spanish_sorprendido', // PT
  'surprised':   'vocab_spanish_sorprendido', // EN
  'おどろいた':      'vocab_spanish_sorprendido', // JA
  '驚いた':        'vocab_spanish_sorprendido', // JA
  '놀랐다':        'vocab_spanish_sorprendido', // KO
  '惊讶':         'vocab_spanish_sorprendido', // ZH

  // excited (emocionado)
  'aufgeregt':   'vocab_spanish_emocionado', // DE
  'emozionato':  'vocab_spanish_emocionado', // IT
  'animado':     'vocab_spanish_emocionado', // PT
  'excited':     'vocab_spanish_emocionado', // EN
  'わくわくしている':   'vocab_spanish_emocionado', // JA
  '신나다':        'vocab_spanish_emocionado', // KO
  '兴奋':         'vocab_spanish_emocionado', // ZH
  // Note: "excite" (FR excité) — omitted to avoid English "excite" ambiguity

  // nervous (nervioso)
  'nerveux':     'vocab_spanish_nervioso', // FR
  'nervos':      'vocab_spanish_nervioso', // DE (nervös)
  'nervous':     'vocab_spanish_nervioso', // EN
  'きんちょうしている': 'vocab_spanish_nervioso', // JA
  '긴장하다':       'vocab_spanish_nervioso', // KO
  '紧张':         'vocab_spanish_nervioso', // ZH
  // Note: "nervioso" same in ES, IT, PT

  // bored (aburrido)
  'ennuye':      'vocab_spanish_aburrido', // FR (ennuyé)
  'gelangweilt': 'vocab_spanish_aburrido', // DE
  'annoiato':    'vocab_spanish_aburrido', // IT
  'entediado':   'vocab_spanish_aburrido', // PT
  'bored':       'vocab_spanish_aburrido', // EN
  'たいくつ':       'vocab_spanish_aburrido', // JA
  '지루하다':       'vocab_spanish_aburrido', // KO
  '无聊':         'vocab_spanish_aburrido', // ZH

  // scared / afraid (asustado)
  'apeure':      'vocab_spanish_asustado', // FR (apeuré)
  'angstlich':   'vocab_spanish_asustado', // DE (ängstlich)
  'spaventato':  'vocab_spanish_asustado', // IT
  'assustado':   'vocab_spanish_asustado', // PT
  'scared':      'vocab_spanish_asustado', // EN
  'afraid':      'vocab_spanish_asustado', // EN alt
  'こわい':        'vocab_spanish_asustado', // JA
  '무섭다':        'vocab_spanish_asustado', // KO
  '害怕':         'vocab_spanish_asustado', // ZH

  // ── Language-Neutral Adjective Pairs ──────────────────────────────────────
  // NOTE: Both words of each pair map to the same cache key — the pair image
  // shows both concepts side-by-side, so either word retrieves the full image.

  // near / close (cerca)
  'pres':        'vocab_spanish_cerca', // FR (près)
  'nah':         'vocab_spanish_cerca', // DE
  'vicino':      'vocab_spanish_cerca', // IT
  'perto':       'vocab_spanish_cerca', // PT
  'near':        'vocab_spanish_cerca', // EN
  'close':       'vocab_spanish_cerca', // EN alt
  'ちかい':        'vocab_spanish_cerca', // JA
  '近い':         'vocab_spanish_cerca', // JA
  '가깝다':        'vocab_spanish_cerca', // KO
  '近':           'vocab_spanish_cerca', // ZH

  // far (lejos)
  'loin':        'vocab_spanish_lejos', // FR
  'weit':        'vocab_spanish_lejos', // DE
  'lontano':     'vocab_spanish_lejos', // IT
  'longe':       'vocab_spanish_lejos', // PT
  'far':         'vocab_spanish_lejos', // EN
  'とおい':        'vocab_spanish_lejos', // JA
  '遠い':         'vocab_spanish_lejos', // JA
  '멀다':         'vocab_spanish_lejos', // KO
  '远':           'vocab_spanish_lejos', // ZH

  // big / large (grande)
  'grand':       'vocab_spanish_grande', // FR (also means tall)
  'gross':       'vocab_spanish_grande', // DE (groß)
  'big':         'vocab_spanish_grande', // EN
  'large':       'vocab_spanish_grande', // EN alt
  'おおきい':       'vocab_spanish_grande', // JA
  '大きい':        'vocab_spanish_grande', // JA
  '크다':         'vocab_spanish_grande', // KO
  '大':           'vocab_spanish_grande', // ZH
  // Note: "grande" same in ES, IT, PT

  // small (pequeño)
  'petit':       'vocab_spanish_pequeno', // FR
  'klein':       'vocab_spanish_pequeno', // DE
  'piccolo':     'vocab_spanish_pequeno', // IT
  'pequeno':     'vocab_spanish_pequeno', // PT (pequeno = same after norm)
  'small':       'vocab_spanish_pequeno', // EN
  'little':      'vocab_spanish_pequeno', // EN alt
  'ちいさい':       'vocab_spanish_pequeno', // JA
  '小さい':        'vocab_spanish_pequeno', // JA
  '작다':         'vocab_spanish_pequeno', // KO
  '小':           'vocab_spanish_pequeno', // ZH

  // hot (caliente)
  'chaud':       'vocab_spanish_caliente', // FR
  'heiss':       'vocab_spanish_caliente', // DE (heiß)
  'warm':        'vocab_spanish_caliente', // EN/DE (warm → caliente image)
  'caldo':       'vocab_spanish_caliente', // (conflict with ES "caldo"=broth — acceptable; food broth image far less common in curriculum)
  'quente':      'vocab_spanish_caliente', // PT
  'hot':         'vocab_spanish_caliente', // EN
  'あつい':        'vocab_spanish_caliente', // JA
  '熱い':         'vocab_spanish_caliente', // JA
  '뜨겁다':        'vocab_spanish_caliente', // KO
  '热':           'vocab_spanish_caliente', // ZH

  // cold (frío)
  'froid':       'vocab_spanish_frio', // FR
  'kalt':        'vocab_spanish_frio', // DE
  'freddo':      'vocab_spanish_frio', // IT
  'cold':        'vocab_spanish_frio', // EN
  'つめたい':       'vocab_spanish_frio', // JA
  '冷たい':        'vocab_spanish_frio', // JA
  '차갑다':        'vocab_spanish_frio', // KO
  '冷':           'vocab_spanish_frio', // ZH
  // Note: "frio" same in ES and PT

  // clean (limpio)
  'propre':      'vocab_spanish_limpio', // FR
  'sauber':      'vocab_spanish_limpio', // DE
  'pulito':      'vocab_spanish_limpio', // IT
  'limpo':       'vocab_spanish_limpio', // PT
  'clean':       'vocab_spanish_limpio', // EN
  'きれい':        'vocab_spanish_limpio', // JA
  '綺麗':         'vocab_spanish_limpio', // JA
  '깨끗하다':       'vocab_spanish_limpio', // KO
  '干净':         'vocab_spanish_limpio', // ZH

  // dirty (sucio)
  'schmutzig':   'vocab_spanish_sucio', // DE
  'sporco':      'vocab_spanish_sucio', // IT
  'sujo':        'vocab_spanish_sucio', // PT
  'dirty':       'vocab_spanish_sucio', // EN
  'きたない':       'vocab_spanish_sucio', // JA
  '汚い':         'vocab_spanish_sucio', // JA
  '더럽다':        'vocab_spanish_sucio', // KO
  '脏':           'vocab_spanish_sucio', // ZH
  // Note: "sale" (FR=dirty) omitted — conflicts with EN "sale" in commerce context

  // soft (suave)
  'doux':        'vocab_spanish_suave', // FR
  'weich':       'vocab_spanish_suave', // DE
  'morbido':     'vocab_spanish_suave', // IT
  'soft':        'vocab_spanish_suave', // EN
  'やわらかい':      'vocab_spanish_suave', // JA
  '부드럽다':       'vocab_spanish_suave', // KO
  '软':           'vocab_spanish_suave', // ZH
  // Note: "suave" same in ES and PT

  // hard (duro)
  'dur':         'vocab_spanish_duro', // FR
  'hart':        'vocab_spanish_duro', // DE
  'hard':        'vocab_spanish_duro', // EN
  'かたい':        'vocab_spanish_duro', // JA
  '硬い':         'vocab_spanish_duro', // JA
  '딱딱하다':       'vocab_spanish_duro', // KO
  '硬':           'vocab_spanish_duro', // ZH
  // Note: "duro" same in ES, IT, PT

  // heavy (pesado)
  'lourd':       'vocab_spanish_pesado', // FR
  'schwer':      'vocab_spanish_pesado', // DE
  'pesante':     'vocab_spanish_pesado', // IT
  'heavy':       'vocab_spanish_pesado', // EN
  'おもい':        'vocab_spanish_pesado', // JA
  '重い':         'vocab_spanish_pesado', // JA
  '무겁다':        'vocab_spanish_pesado', // KO
  '重':           'vocab_spanish_pesado', // ZH
  // Note: "pesado" same in ES and PT

  // light / lightweight (ligero)
  'leger':       'vocab_spanish_ligero', // FR (léger)
  'leicht':      'vocab_spanish_ligero', // DE
  'leggero':     'vocab_spanish_ligero', // IT
  'light':       'vocab_spanish_ligero', // EN (lightweight sense; color sense is "claro")
  'かるい':        'vocab_spanish_ligero', // JA
  '軽い':         'vocab_spanish_ligero', // JA
  '가볍다':        'vocab_spanish_ligero', // KO
  '轻':           'vocab_spanish_ligero', // ZH

  // loud / noisy (ruidoso)
  'bruyant':     'vocab_spanish_ruidoso', // FR
  'laut':        'vocab_spanish_ruidoso', // DE
  'rumoroso':    'vocab_spanish_ruidoso', // IT
  'barulhento':  'vocab_spanish_ruidoso', // PT
  'loud':        'vocab_spanish_ruidoso', // EN
  'noisy':       'vocab_spanish_ruidoso', // EN alt
  'うるさい':       'vocab_spanish_ruidoso', // JA
  '시끄럽다':       'vocab_spanish_ruidoso', // KO
  '吵':           'vocab_spanish_ruidoso', // ZH

  // quiet (tranquilo)
  'silencieux':  'vocab_spanish_tranquilo', // FR
  'leise':       'vocab_spanish_tranquilo', // DE
  'silenzioso':  'vocab_spanish_tranquilo', // IT
  'quieto':      'vocab_spanish_tranquilo', // PT
  'quiet':       'vocab_spanish_tranquilo', // EN
  'しずか':        'vocab_spanish_tranquilo', // JA
  '静か':         'vocab_spanish_tranquilo', // JA
  '조용하다':       'vocab_spanish_tranquilo', // KO
  '安静':         'vocab_spanish_tranquilo', // ZH

  // young (joven)
  'jeune':       'vocab_spanish_joven', // FR
  'jung':        'vocab_spanish_joven', // DE
  'giovane':     'vocab_spanish_joven', // IT
  'jovem':       'vocab_spanish_joven', // PT
  'young':       'vocab_spanish_joven', // EN
  'わかい':        'vocab_spanish_joven', // JA
  '若い':         'vocab_spanish_joven', // JA
  '젊다':         'vocab_spanish_joven', // KO
  '年轻':         'vocab_spanish_joven', // ZH

  // old / elderly (viejo)
  'vieux':       'vocab_spanish_viejo', // FR
  'alt':         'vocab_spanish_viejo', // DE
  'vecchio':     'vocab_spanish_viejo', // IT
  'velho':       'vocab_spanish_viejo', // PT
  'old':         'vocab_spanish_viejo', // EN
  'ふるい':        'vocab_spanish_viejo', // JA (old thing)
  'としより':       'vocab_spanish_viejo', // JA (elderly)
  '늙다':         'vocab_spanish_viejo', // KO
  '老':           'vocab_spanish_viejo', // ZH

  // fast / quick (rápido)
  'rapide':      'vocab_spanish_rapido', // FR
  'schnell':     'vocab_spanish_rapido', // DE
  'veloce':      'vocab_spanish_rapido', // IT
  'fast':        'vocab_spanish_rapido', // EN
  'quick':       'vocab_spanish_rapido', // EN alt
  'はやい':        'vocab_spanish_rapido', // JA
  '速い':         'vocab_spanish_rapido', // JA
  '빠르다':        'vocab_spanish_rapido', // KO
  '快':           'vocab_spanish_rapido', // ZH
  // Note: "rapido" same in ES and PT

  // slow (lento)
  'lent':        'vocab_spanish_lento', // FR
  'langsam':     'vocab_spanish_lento', // DE
  'slow':        'vocab_spanish_lento', // EN
  'おそい':        'vocab_spanish_lento', // JA
  '遅い':         'vocab_spanish_lento', // JA
  '느리다':        'vocab_spanish_lento', // KO
  '慢':           'vocab_spanish_lento', // ZH
  // Note: "lento" same in ES, IT, PT

  // open (abierto)
  'ouvert':      'vocab_spanish_abierto', // FR
  'offen':       'vocab_spanish_abierto', // DE
  'aperto':      'vocab_spanish_abierto', // IT
  'aberto':      'vocab_spanish_abierto', // PT
  'open':        'vocab_spanish_abierto', // EN
  'あいている':      'vocab_spanish_abierto', // JA
  '開いている':      'vocab_spanish_abierto', // JA
  '열다':         'vocab_spanish_abierto', // KO
  '开':           'vocab_spanish_abierto', // ZH

  // closed (cerrado)
  'ferme':       'vocab_spanish_cerrado', // FR (fermé)
  'geschlossen': 'vocab_spanish_cerrado', // DE
  'chiuso':      'vocab_spanish_cerrado', // IT
  'fechado':     'vocab_spanish_cerrado', // PT
  'closed':      'vocab_spanish_cerrado', // EN
  'しまっている':     'vocab_spanish_cerrado', // JA
  '閉まっている':     'vocab_spanish_cerrado', // JA
  '닫다':         'vocab_spanish_cerrado', // KO
  '关':           'vocab_spanish_cerrado', // ZH

  // full (lleno)
  'plein':       'vocab_spanish_lleno', // FR
  'voll':        'vocab_spanish_lleno', // DE
  'pieno':       'vocab_spanish_lleno', // IT
  'cheio':       'vocab_spanish_lleno', // PT
  'full':        'vocab_spanish_lleno', // EN
  'いっぱい':       'vocab_spanish_lleno', // JA
  '가득하다':       'vocab_spanish_lleno', // KO
  '满':           'vocab_spanish_lleno', // ZH

  // empty (vacío)
  'vide':        'vocab_spanish_vacio', // FR
  'vuoto':       'vocab_spanish_vacio', // IT
  'vazio':       'vocab_spanish_vacio', // PT
  'empty':       'vocab_spanish_vacio', // EN
  'からっぽ':       'vocab_spanish_vacio', // JA
  '비다':         'vocab_spanish_vacio', // KO
  '空':           'vocab_spanish_vacio', // ZH
  // Note: "leer" (DE=empty) omitted — conflicts with ES "leer" = to read

  // new (nuevo)
  'nouveau':     'vocab_spanish_nuevo', // FR
  'neu':         'vocab_spanish_nuevo', // DE
  'nuovo':       'vocab_spanish_nuevo', // IT
  'novo':        'vocab_spanish_nuevo', // PT
  'new':         'vocab_spanish_nuevo', // EN
  'あたらしい':      'vocab_spanish_nuevo', // JA
  '新しい':        'vocab_spanish_nuevo', // JA
  '새롭다':        'vocab_spanish_nuevo', // KO
  '新':           'vocab_spanish_nuevo', // ZH

  // tall (alto)
  'hoch':        'vocab_spanish_alto', // DE (tall/high)
  'tall':        'vocab_spanish_alto', // EN
  'たかい':        'vocab_spanish_alto', // JA
  '高い':         'vocab_spanish_alto', // JA
  '키가 크다':      'vocab_spanish_alto', // KO
  '高':           'vocab_spanish_alto', // ZH
  // Note: "alto" same in ES, IT, PT; "grand" (FR=tall) already added as "big" — body height image covers both

  // short / low (bajo)
  'bas':         'vocab_spanish_bajo', // FR
  'niedrig':     'vocab_spanish_bajo', // DE
  'basso':       'vocab_spanish_bajo', // IT
  'baixo':       'vocab_spanish_bajo', // PT
  'short':       'vocab_spanish_bajo', // EN
  'ひくい':        'vocab_spanish_bajo', // JA
  '低い':         'vocab_spanish_bajo', // JA
  '낮다':         'vocab_spanish_bajo', // KO
  '低':           'vocab_spanish_bajo', // ZH

  // dark (oscuro)
  'sombre':      'vocab_spanish_oscuro', // FR
  'dunkel':      'vocab_spanish_oscuro', // DE
  'scuro':       'vocab_spanish_oscuro', // IT
  'escuro':      'vocab_spanish_oscuro', // PT
  'dark':        'vocab_spanish_oscuro', // EN
  'くらい':        'vocab_spanish_oscuro', // JA
  '暗い':         'vocab_spanish_oscuro', // JA
  '어둡다':        'vocab_spanish_oscuro', // KO
  '暗':           'vocab_spanish_oscuro', // ZH

  // bright / light (claro)
  'clair':       'vocab_spanish_claro', // FR
  'hell':        'vocab_spanish_claro', // DE
  'chiaro':      'vocab_spanish_claro', // IT
  'bright':      'vocab_spanish_claro', // EN
  'あかるい':       'vocab_spanish_claro', // JA
  '明るい':        'vocab_spanish_claro', // JA
  '밝다':         'vocab_spanish_claro', // KO
  '亮':           'vocab_spanish_claro', // ZH
  // Note: "claro" same in ES and PT

  // good (bueno)
  'bon':         'vocab_spanish_bueno', // FR
  'gut':         'vocab_spanish_bueno', // DE
  'buono':       'vocab_spanish_bueno', // IT
  'bom':         'vocab_spanish_bueno', // PT
  'good':        'vocab_spanish_bueno', // EN
  'いい':          'vocab_spanish_bueno', // JA
  'よい':          'vocab_spanish_bueno', // JA alt
  '良い':          'vocab_spanish_bueno', // JA
  '좋다':         'vocab_spanish_bueno', // KO
  '好':           'vocab_spanish_bueno', // ZH

  // bad (malo)
  'mauvais':     'vocab_spanish_malo', // FR
  'schlecht':    'vocab_spanish_malo', // DE
  'cattivo':     'vocab_spanish_malo', // IT
  'mau':         'vocab_spanish_malo', // PT
  'bad':         'vocab_spanish_malo', // EN
  'わるい':        'vocab_spanish_malo', // JA
  '悪い':         'vocab_spanish_malo', // JA
  '나쁘다':        'vocab_spanish_malo', // KO
  '坏':           'vocab_spanish_malo', // ZH

  // ── Common Places ─────────────────────────────────────────────────────────
  // school (escuela)
  'ecole':       'vocab_spanish_escuela', // FR (école)
  'schule':      'vocab_spanish_escuela', // DE
  'scuola':      'vocab_spanish_escuela', // IT
  'escola':      'vocab_spanish_escuela', // PT
  'school':      'vocab_spanish_escuela', // EN
  'がっこう':       'vocab_spanish_escuela', // JA
  '学校':         'vocab_spanish_escuela', // JA/ZH shared
  '학교':         'vocab_spanish_escuela', // KO

  // library (biblioteca)
  'bibliotheque': 'vocab_spanish_biblioteca', // FR
  'bibliothek':  'vocab_spanish_biblioteca', // DE
  'library':     'vocab_spanish_biblioteca', // EN
  'としょかん':      'vocab_spanish_biblioteca', // JA
  '図書館':        'vocab_spanish_biblioteca', // JA
  '도서관':        'vocab_spanish_biblioteca', // KO
  '图书馆':        'vocab_spanish_biblioteca', // ZH
  // Note: "biblioteca" same in ES, IT, PT

  // hospital
  'hopital':     'vocab_spanish_hospital', // FR (hôpital)
  'krankenhaus': 'vocab_spanish_hospital', // DE
  'ospedale':    'vocab_spanish_hospital', // IT
  'びょういん':      'vocab_spanish_hospital', // JA
  '病院':         'vocab_spanish_hospital', // JA/ZH
  '병원':         'vocab_spanish_hospital', // KO
  '医院':         'vocab_spanish_hospital', // ZH
  // Note: "hospital" same in ES, PT, EN

  // park (parque)
  'parc':        'vocab_spanish_parque', // FR
  'park':        'vocab_spanish_parque', // DE/EN
  'parco':       'vocab_spanish_parque', // IT
  'こうえん':       'vocab_spanish_parque', // JA
  '公園':         'vocab_spanish_parque', // JA/ZH
  '공원':         'vocab_spanish_parque', // KO
  '公园':         'vocab_spanish_parque', // ZH
  // Note: "parque" same in ES and PT

  // restaurant (restaurante)
  'ristorante':  'vocab_spanish_restaurante', // IT
  'レストラン':      'vocab_spanish_restaurante', // JA
  '레스토랑':       'vocab_spanish_restaurante', // KO
  '餐厅':         'vocab_spanish_restaurante', // ZH
  // Note: "restaurant" same in FR/DE/EN; "restaurante" same in ES/PT

  // supermarket (supermercado)
  'supermarche': 'vocab_spanish_supermercado', // FR (supermarché)
  'supermarkt':  'vocab_spanish_supermercado', // DE
  'supermercato': 'vocab_spanish_supermercado', // IT
  'supermarket': 'vocab_spanish_supermercado', // EN
  'スーパー':        'vocab_spanish_supermercado', // JA
  '슈퍼마켓':       'vocab_spanish_supermercado', // KO
  '超市':         'vocab_spanish_supermercado', // ZH
  // Note: "supermercado" same in ES and PT

  // hotel
  'ホテル':        'vocab_spanish_hotel', // JA
  '호텔':         'vocab_spanish_hotel', // KO
  '酒店':         'vocab_spanish_hotel', // ZH
  // Note: "hotel" same in ES, FR, DE, IT, PT, EN

  // bank (banco)
  'banque':      'vocab_spanish_banco', // FR
  'banca':       'vocab_spanish_banco', // IT
  'ぎんこう':       'vocab_spanish_banco', // JA
  '銀行':         'vocab_spanish_banco', // JA/ZH
  '은행':         'vocab_spanish_banco', // KO
  '银行':         'vocab_spanish_banco', // ZH
  // Note: "banco" same in ES and PT; "bank" (DE/EN) already hits Spanish path

  // airport (aeropuerto)
  'aeroport':    'vocab_spanish_aeropuerto', // FR
  'flughafen':   'vocab_spanish_aeropuerto', // DE
  'aeroporto':   'vocab_spanish_aeropuerto', // IT/PT
  'airport':     'vocab_spanish_aeropuerto', // EN
  'くうこう':       'vocab_spanish_aeropuerto', // JA
  '空港':         'vocab_spanish_aeropuerto', // JA/ZH
  '공항':         'vocab_spanish_aeropuerto', // KO
  '机场':         'vocab_spanish_aeropuerto', // ZH

  // store / shop (tienda)
  'magasin':     'vocab_spanish_tienda', // FR
  'laden':       'vocab_spanish_tienda', // DE
  'negozio':     'vocab_spanish_tienda', // IT
  'loja':        'vocab_spanish_tienda', // PT
  'store':       'vocab_spanish_tienda', // EN
  'shop':        'vocab_spanish_tienda', // EN alt
  'みせ':         'vocab_spanish_tienda', // JA
  '店':           'vocab_spanish_tienda', // JA/ZH
  '가게':         'vocab_spanish_tienda', // KO
  '商店':         'vocab_spanish_tienda', // ZH

  // ── Family Members ─────────────────────────────────────────────────────────
  // mother / mom (madre)
  'mere':        'vocab_spanish_madre', // FR (mère)
  'mutter':      'vocab_spanish_madre', // DE
  'mother':      'vocab_spanish_madre', // EN
  'mom':         'vocab_spanish_madre', // EN
  'おかあさん':      'vocab_spanish_madre', // JA
  '母':           'vocab_spanish_madre', // JA/ZH
  '어머니':        'vocab_spanish_madre', // KO
  '妈妈':         'vocab_spanish_madre', // ZH
  // Note: "madre" same in ES, IT, PT

  // father / dad (padre)
  'pere':        'vocab_spanish_padre', // FR (père)
  'vater':       'vocab_spanish_padre', // DE
  'father':      'vocab_spanish_padre', // EN
  'dad':         'vocab_spanish_padre', // EN
  'おとうさん':      'vocab_spanish_padre', // JA
  '父':           'vocab_spanish_padre', // JA/ZH
  '아버지':        'vocab_spanish_padre', // KO
  '爸爸':         'vocab_spanish_padre', // ZH
  // Note: "padre" same in ES, IT, PT

  // brother (hermano)
  'frere':       'vocab_spanish_hermano', // FR (frère)
  'bruder':      'vocab_spanish_hermano', // DE
  'fratello':    'vocab_spanish_hermano', // IT
  'irmao':       'vocab_spanish_hermano', // PT (irmão)
  'brother':     'vocab_spanish_hermano', // EN
  'おにいさん':      'vocab_spanish_hermano', // JA
  '兄':           'vocab_spanish_hermano', // JA
  '형':           'vocab_spanish_hermano', // KO
  '哥哥':         'vocab_spanish_hermano', // ZH

  // sister (hermana)
  'soeur':       'vocab_spanish_hermana', // FR (sœur)
  'schwester':   'vocab_spanish_hermana', // DE
  'sorella':     'vocab_spanish_hermana', // IT
  'irma':        'vocab_spanish_hermana', // PT (irmã)
  'sister':      'vocab_spanish_hermana', // EN
  'おねえさん':      'vocab_spanish_hermana', // JA
  '姉':           'vocab_spanish_hermana', // JA
  '언니':         'vocab_spanish_hermana', // KO
  '姐姐':         'vocab_spanish_hermana', // ZH

  // grandmother (abuela)
  'grandmere':   'vocab_spanish_abuela', // FR (grand-mère)
  'oma':         'vocab_spanish_abuela', // DE
  'nonna':       'vocab_spanish_abuela', // IT
  'avo':         'vocab_spanish_abuela', // PT (avó)
  'grandmother': 'vocab_spanish_abuela', // EN
  'grandma':     'vocab_spanish_abuela', // EN
  'おばあさん':      'vocab_spanish_abuela', // JA
  '祖母':         'vocab_spanish_abuela', // JA/ZH
  '할머니':        'vocab_spanish_abuela', // KO
  '奶奶':         'vocab_spanish_abuela', // ZH

  // grandfather (abuelo)
  'grandpere':   'vocab_spanish_abuelo', // FR (grand-père)
  'opa':         'vocab_spanish_abuelo', // DE
  'nonno':       'vocab_spanish_abuelo', // IT
  'grandfather': 'vocab_spanish_abuelo', // EN
  'grandpa':     'vocab_spanish_abuelo', // EN
  'おじいさん':      'vocab_spanish_abuelo', // JA
  '祖父':         'vocab_spanish_abuelo', // JA/ZH
  '할아버지':       'vocab_spanish_abuelo', // KO
  '爷爷':         'vocab_spanish_abuelo', // ZH

  // child / kid (niño/niña — use niño as generic)
  'enfant':      'vocab_spanish_nino', // FR
  'kind':        'vocab_spanish_nino', // DE
  'bambino':     'vocab_spanish_nino', // IT
  'crianca':     'vocab_spanish_nino', // PT (criança)
  'child':       'vocab_spanish_nino', // EN
  'kid':         'vocab_spanish_nino', // EN
  'こども':        'vocab_spanish_nino', // JA
  '子供':         'vocab_spanish_nino', // JA/ZH
  '아이':         'vocab_spanish_nino', // KO
  '孩子':         'vocab_spanish_nino', // ZH

  // baby (bebé)
  'baby':        'vocab_spanish_bebe', // DE/EN
  'あかちゃん':      'vocab_spanish_bebe', // JA
  '赤ちゃん':       'vocab_spanish_bebe', // JA
  '아기':         'vocab_spanish_bebe', // KO
  '婴儿':         'vocab_spanish_bebe', // ZH
  // Note: "bebe" same in ES, FR, IT, PT after normalization

  // ── Classroom People ──────────────────────────────────────────────────────
  // teacher (maestro/maestra — generic teacher image)
  'professeur':  'vocab_spanish_maestro', // FR
  'lehrer':      'vocab_spanish_maestro', // DE
  'insegnante':  'vocab_spanish_maestro', // IT
  'professor':   'vocab_spanish_maestro', // PT
  'teacher':     'vocab_spanish_maestro', // EN
  'せんせい':       'vocab_spanish_maestro', // JA
  '先生':         'vocab_spanish_maestro', // JA/ZH
  '선생님':        'vocab_spanish_maestro', // KO
  '老师':         'vocab_spanish_maestro', // ZH

  // student (estudiante)
  'eleve':       'vocab_spanish_estudiante', // FR (élève)
  'schuler':     'vocab_spanish_estudiante', // DE (Schüler)
  'studente':    'vocab_spanish_estudiante', // IT
  'estudante':   'vocab_spanish_estudiante', // PT
  'student':     'vocab_spanish_estudiante', // EN
  'pupil':       'vocab_spanish_estudiante', // EN alt
  'がくせい':       'vocab_spanish_estudiante', // JA
  '学生':         'vocab_spanish_estudiante', // JA/ZH
  '학생':         'vocab_spanish_estudiante', // KO

  // ── Transportation ──────────────────────────────────────────────────────────
  // car (carro) — EN/DE "auto", IT "auto" same word → routes naturally; only unique forms mapped here
  'voiture':     'vocab_spanish_carro', // FR
  'macchina':    'vocab_spanish_carro', // IT
  'wagen':       'vocab_spanish_carro', // DE (der Wagen = car)
  'car':         'vocab_spanish_carro', // EN
  'くるま':        'vocab_spanish_carro', // JA
  '車':           'vocab_spanish_carro', // JA/ZH
  '자동차':        'vocab_spanish_carro', // KO
  '汽车':         'vocab_spanish_carro', // ZH
  // Note: "carro" same in ES and PT; "auto" same in DE/IT/ES resolves naturally

  // bus (autobús)
  'onibus':      'vocab_spanish_autobus', // PT (ônibus → onibus after accent strip)
  'バス':          'vocab_spanish_autobus', // JA
  '버스':         'vocab_spanish_autobus', // KO
  '公共汽车':       'vocab_spanish_autobus', // ZH
  '公交车':        'vocab_spanish_autobus', // ZH alt
  // Note: "bus" same in EN/FR/DE/IT after norm → resolves naturally

  // train (tren)
  'train':       'vocab_spanish_tren', // FR/EN (same word in both)
  'zug':         'vocab_spanish_tren', // DE
  'treno':       'vocab_spanish_tren', // IT
  'trem':        'vocab_spanish_tren', // PT (trem = train in BR Portuguese)
  'comboio':     'vocab_spanish_tren', // PT alt (comboio = train in European Portuguese)
  'でんしゃ':       'vocab_spanish_tren', // JA
  '電車':         'vocab_spanish_tren', // JA
  '기차':         'vocab_spanish_tren', // KO
  '火车':         'vocab_spanish_tren', // ZH

  // airplane (avión)
  // Note: "avion" norm same in FR and ES — routes naturally to vocab_spanish_avion
  'flugzeug':    'vocab_spanish_avion', // DE
  'aereo':       'vocab_spanish_avion', // IT (short form)
  'aviao':       'vocab_spanish_avion', // PT (avião → aviao)
  'airplane':    'vocab_spanish_avion', // EN
  'plane':       'vocab_spanish_avion', // EN alt
  'ひこうき':       'vocab_spanish_avion', // JA
  '飛行機':        'vocab_spanish_avion', // JA
  '비행기':        'vocab_spanish_avion', // KO
  '飞机':         'vocab_spanish_avion', // ZH

  // bicycle (bicicleta)
  'velo':        'vocab_spanish_bicicleta', // FR (vélo)
  'fahrrad':     'vocab_spanish_bicicleta', // DE
  'bicicletta':  'vocab_spanish_bicicleta', // IT
  'bicycle':     'vocab_spanish_bicicleta', // EN
  'bike':        'vocab_spanish_bicicleta', // EN alt
  'じてんしゃ':      'vocab_spanish_bicicleta', // JA
  '自転車':        'vocab_spanish_bicicleta', // JA
  '자전거':        'vocab_spanish_bicicleta', // KO
  '自行车':        'vocab_spanish_bicicleta', // ZH
  // Note: "bicicleta" same in ES and PT

  // boat / ship (barco)
  'bateau':      'vocab_spanish_barco', // FR
  'boot':        'vocab_spanish_barco', // DE
  'barca':       'vocab_spanish_barco', // IT
  'boat':        'vocab_spanish_barco', // EN
  'ship':        'vocab_spanish_barco', // EN alt
  'ふね':         'vocab_spanish_barco', // JA
  '船':           'vocab_spanish_barco', // JA/ZH shared
  // Note: "barco" same in ES and PT

  // subway / metro (metro)
  'ubahn':       'vocab_spanish_metro', // DE (U-Bahn → ubahn after norm)
  'metropolitana': 'vocab_spanish_metro', // IT
  'subway':      'vocab_spanish_metro', // EN
  'underground': 'vocab_spanish_metro', // EN alt
  'ちかてつ':       'vocab_spanish_metro', // JA
  '地下鉄':        'vocab_spanish_metro', // JA
  '지하철':        'vocab_spanish_metro', // KO
  '地铁':         'vocab_spanish_metro', // ZH
  // Note: "metro" same in ES, FR, IT, PT after norm

  // ── Home & Rooms ─────────────────────────────────────────────────────────────
  // house (casa)
  'maison':      'vocab_spanish_casa', // FR
  'haus':        'vocab_spanish_casa', // DE
  'house':       'vocab_spanish_casa', // EN
  'home':        'vocab_spanish_casa', // EN alt
  'いえ':          'vocab_spanish_casa', // JA
  '家':           'vocab_spanish_casa', // JA/ZH
  '집':           'vocab_spanish_casa', // KO
  '房子':         'vocab_spanish_casa', // ZH
  // Note: "casa" same in ES, IT, PT

  // bedroom (dormitorio)
  'chambre':     'vocab_spanish_dormitorio', // FR
  'schlafzimmer': 'vocab_spanish_dormitorio', // DE
  'camera':      'vocab_spanish_dormitorio', // IT (camera da letto → camera)
  'quarto':      'vocab_spanish_dormitorio', // PT
  'bedroom':     'vocab_spanish_dormitorio', // EN
  'しんしつ':       'vocab_spanish_dormitorio', // JA
  '寝室':         'vocab_spanish_dormitorio', // JA
  '침실':         'vocab_spanish_dormitorio', // KO
  '卧室':         'vocab_spanish_dormitorio', // ZH

  // kitchen (cocina)
  'cuisine':     'vocab_spanish_cocina', // FR
  'kuche':       'vocab_spanish_cocina', // DE (Küche → kuche)
  'cozinha':     'vocab_spanish_cocina', // PT
  'kitchen':     'vocab_spanish_cocina', // EN
  'だいどころ':      'vocab_spanish_cocina', // JA
  '台所':         'vocab_spanish_cocina', // JA
  '부엌':         'vocab_spanish_cocina', // KO
  '厨房':         'vocab_spanish_cocina', // ZH
  // Note: "cucina" (IT) same as "cocina" after norm → routes naturally

  // bathroom (baño)
  'badezimmer':  'vocab_spanish_bano', // DE
  'bagno':       'vocab_spanish_bano', // IT
  'banheiro':    'vocab_spanish_bano', // PT (BR)
  'casa de banho': 'vocab_spanish_bano', // PT alt (European)
  'bathroom':    'vocab_spanish_bano', // EN
  'toilet':      'vocab_spanish_bano', // EN alt (common usage)
  'バスルーム':      'vocab_spanish_bano', // JA
  'おふろ':        'vocab_spanish_bano', // JA alt
  '욕실':         'vocab_spanish_bano', // KO
  '浴室':         'vocab_spanish_bano', // ZH
  '卫生间':        'vocab_spanish_bano', // ZH alt
  // Note: "salle de bain" (FR) normalizes to "salle de bain" — multi-word; map the short form:
  'salle de bain': 'vocab_spanish_bano', // FR

  // living room (salón)
  'wohnzimmer':  'vocab_spanish_salon', // DE
  'salotto':     'vocab_spanish_salon', // IT
  'sala de estar': 'vocab_spanish_salon', // PT
  'living room': 'vocab_spanish_salon', // EN
  'リビング':       'vocab_spanish_salon', // JA
  '거실':         'vocab_spanish_salon', // KO
  '客厅':         'vocab_spanish_salon', // ZH
  // Note: "salon" same in FR and ES after norm → routes naturally

  // door (puerta)
  'porte':       'vocab_spanish_puerta', // FR
  'tur':         'vocab_spanish_puerta', // DE (Tür → tur)
  'porta':       'vocab_spanish_puerta', // IT/PT (same word)
  'door':        'vocab_spanish_puerta', // EN
  'ドア':          'vocab_spanish_puerta', // JA
  '문':           'vocab_spanish_puerta', // KO
  '门':           'vocab_spanish_puerta', // ZH

  // window (ventana)
  'fenetre':     'vocab_spanish_ventana', // FR (fenêtre → fenetre)
  'fenster':     'vocab_spanish_ventana', // DE
  'finestra':    'vocab_spanish_ventana', // IT
  'janela':      'vocab_spanish_ventana', // PT
  'window':      'vocab_spanish_ventana', // EN
  'まど':          'vocab_spanish_ventana', // JA
  '窓':           'vocab_spanish_ventana', // JA
  '창문':         'vocab_spanish_ventana', // KO
  '窗户':         'vocab_spanish_ventana', // ZH

  // garden (jardín)
  'jardin':      'vocab_spanish_jardin', // FR/ES (same after norm → routes naturally)
  'garten':      'vocab_spanish_jardin', // DE
  'giardino':    'vocab_spanish_jardin', // IT
  'jardim':      'vocab_spanish_jardin', // PT
  'garden':      'vocab_spanish_jardin', // EN
  'にわ':          'vocab_spanish_jardin', // JA
  '庭':           'vocab_spanish_jardin', // JA
  '정원':         'vocab_spanish_jardin', // KO
  '花园':         'vocab_spanish_jardin', // ZH

  // bed (cama)
  'lit':         'vocab_spanish_cama', // FR
  'bett':        'vocab_spanish_cama', // DE
  'letto':       'vocab_spanish_cama', // IT
  'bed':         'vocab_spanish_cama', // EN
  'ベッド':        'vocab_spanish_cama', // JA
  '침대':         'vocab_spanish_cama', // KO
  '床':           'vocab_spanish_cama', // ZH
  // Note: "cama" same in ES and PT

  // ── More Clothing ─────────────────────────────────────────────────────────────
  // coat / overcoat (abrigo)
  'manteau':     'vocab_spanish_abrigo', // FR
  'mantel':      'vocab_spanish_abrigo', // DE (Mantel)
  'cappotto':    'vocab_spanish_abrigo', // IT
  'casaco':      'vocab_spanish_abrigo', // PT
  'coat':        'vocab_spanish_abrigo', // EN
  'overcoat':    'vocab_spanish_abrigo', // EN alt
  'コート':        'vocab_spanish_abrigo', // JA
  '코트':         'vocab_spanish_abrigo', // KO
  '大衣':         'vocab_spanish_abrigo', // ZH

  // skirt (falda)
  'jupe':        'vocab_spanish_falda', // FR
  'rock':        'vocab_spanish_falda', // DE (der Rock = skirt in German)
  'gonna':       'vocab_spanish_falda', // IT
  'saia':        'vocab_spanish_falda', // PT
  'skirt':       'vocab_spanish_falda', // EN
  'スカート':       'vocab_spanish_falda', // JA
  '치마':         'vocab_spanish_falda', // KO
  '裙子':         'vocab_spanish_falda', // ZH

  // ── Health & Medical ─────────────────────────────────────────────────────────
  // doctor (médico)
  'medecin':     'vocab_spanish_medico', // FR (médecin)
  'arzt':        'vocab_spanish_medico', // DE
  'doctor':      'vocab_spanish_medico', // EN
  'physician':   'vocab_spanish_medico', // EN alt
  'いしゃ':        'vocab_spanish_medico', // JA
  '医者':         'vocab_spanish_medico', // JA
  '의사':         'vocab_spanish_medico', // KO
  '医生':         'vocab_spanish_medico', // ZH
  // Note: "medico" same in IT and ES; "médico" same in PT

  // nurse (enfermera)
  'infirmiere':  'vocab_spanish_enfermera', // FR (infirmière)
  'krankenschwester': 'vocab_spanish_enfermera', // DE
  'infermiera':  'vocab_spanish_enfermera', // IT
  'enfermeira':  'vocab_spanish_enfermera', // PT
  'nurse':       'vocab_spanish_enfermera', // EN
  'かんごし':       'vocab_spanish_enfermera', // JA
  '看護師':        'vocab_spanish_enfermera', // JA
  '간호사':        'vocab_spanish_enfermera', // KO
  '护士':         'vocab_spanish_enfermera', // ZH

  // medicine / pill (pastilla)
  'medicament':  'vocab_spanish_pastilla', // FR (médicament)
  'medikament':  'vocab_spanish_pastilla', // DE
  'farmaco':     'vocab_spanish_pastilla', // IT
  'remedio':     'vocab_spanish_pastilla', // PT
  'medicine':    'vocab_spanish_pastilla', // EN
  'pill':        'vocab_spanish_pastilla', // EN alt
  'tablet':      'vocab_spanish_pastilla', // EN alt
  'くすり':        'vocab_spanish_pastilla', // JA
  '薬':           'vocab_spanish_pastilla', // JA
  '약':           'vocab_spanish_pastilla', // KO
  '药':           'vocab_spanish_pastilla', // ZH

  // ── Sports ───────────────────────────────────────────────────────────────────
  // soccer / football (fútbol)
  'football':    'vocab_spanish_futbol', // FR/DE/EN-British
  'fussball':    'vocab_spanish_futbol', // DE (Fußball → fussball)
  'calcio':      'vocab_spanish_futbol', // IT
  'futebol':     'vocab_spanish_futbol', // PT
  'soccer':      'vocab_spanish_futbol', // EN-American
  'サッカー':       'vocab_spanish_futbol', // JA
  '축구':         'vocab_spanish_futbol', // KO
  '足球':         'vocab_spanish_futbol', // ZH

  // basketball (baloncesto)
  'basketball':  'vocab_spanish_baloncesto', // EN/DE (same word)
  'basket':      'vocab_spanish_baloncesto', // FR/IT (short form)
  'pallacanestro': 'vocab_spanish_baloncesto', // IT formal
  'basquete':    'vocab_spanish_baloncesto', // PT
  'バスケットボール': 'vocab_spanish_baloncesto', // JA
  'バスケ':        'vocab_spanish_baloncesto', // JA short
  '농구':         'vocab_spanish_baloncesto', // KO
  '篮球':         'vocab_spanish_baloncesto', // ZH

  // tennis (tenis)
  // Note: "tennis" same in EN/FR/DE/IT; "tenis" same in ES/PT — routes naturally
  'テニス':        'vocab_spanish_tenis', // JA
  '테니스':        'vocab_spanish_tenis', // KO
  '网球':         'vocab_spanish_tenis', // ZH

  // sports (deporte) — general
  'sport':       'vocab_spanish_deporte', // FR/DE/IT/EN (same word after norm)
  'sports':      'vocab_spanish_deporte', // EN plural
  'esporte':     'vocab_spanish_deporte', // PT
  'スポーツ':       'vocab_spanish_deporte', // JA
  '스포츠':        'vocab_spanish_deporte', // KO
  '运动':         'vocab_spanish_deporte', // ZH

  // ── Directions ────────────────────────────────────────────────────────────────
  // left (izquierda) — anchor exists in DB
  'left':        'vocab_spanish_izquierda', // EN
  'gauche':      'vocab_spanish_izquierda', // FR
  'links':       'vocab_spanish_izquierda', // DE
  'sinistra':    'vocab_spanish_izquierda', // IT
  'esquerda':    'vocab_spanish_izquierda', // PT
  'ひだり':        'vocab_spanish_izquierda', // JA
  '左':           'vocab_spanish_izquierda', // JA/ZH
  '왼쪽':         'vocab_spanish_izquierda', // KO
  '左边':         'vocab_spanish_izquierda', // ZH

  // right (derecha) — anchor exists in DB
  'right':       'vocab_spanish_derecha', // EN
  'droite':      'vocab_spanish_derecha', // FR
  'rechts':      'vocab_spanish_derecha', // DE
  'destra':      'vocab_spanish_derecha', // IT
  'direita':     'vocab_spanish_derecha', // PT
  'みぎ':          'vocab_spanish_derecha', // JA
  '右':           'vocab_spanish_derecha', // JA/ZH
  '오른쪽':        'vocab_spanish_derecha', // KO
  '右边':         'vocab_spanish_derecha', // ZH

  // ── Professions (additional) ───────────────────────────────────────────────────
  // lawyer (abogado) — anchor exists in DB
  'lawyer':      'vocab_spanish_abogado', // EN
  'attorney':    'vocab_spanish_abogado', // EN alt
  'avocat':      'vocab_spanish_abogado', // FR
  'anwalt':      'vocab_spanish_abogado', // DE (Anwalt)
  'rechtsanwalt':'vocab_spanish_abogado', // DE formal
  'avvocato':    'vocab_spanish_abogado', // IT
  'advogado':    'vocab_spanish_abogado', // PT
  'べんごし':       'vocab_spanish_abogado', // JA
  '弁護士':        'vocab_spanish_abogado', // JA
  '변호사':        'vocab_spanish_abogado', // KO
  '律师':         'vocab_spanish_abogado', // ZH
};

/**
 * All concept cache keys for numbers (0–100, 1000).
 * Exported so admin "Fix Numbers" routes can also bust these in addition to
 * the language-specific `vocab_{lang}_{word}` keys.
 */
export const NUMBER_CONCEPT_KEYS: string[] = [
  ...Array.from({ length: 22 }, (_, i) => `concept_num_${i}`),   // 0–21
  'concept_num_30', 'concept_num_40', 'concept_num_50',
  'concept_num_60', 'concept_num_70', 'concept_num_80',
  'concept_num_90', 'concept_num_100', 'concept_num_1000',
];

/**
 * All concept cache keys for colors, seasons, and weather.
 * Exported so admin "Fix Adjectives" routes can also bust these.
 */
export const COLOR_SEASON_WEATHER_CONCEPT_KEYS: string[] = [
  'concept_color_red', 'concept_color_blue', 'concept_color_green', 'concept_color_yellow',
  'concept_color_orange', 'concept_color_purple', 'concept_color_pink', 'concept_color_brown',
  'concept_color_black', 'concept_color_white', 'concept_color_gray',
  'concept_season_spring', 'concept_season_summer', 'concept_season_fall', 'concept_season_winter',
  'concept_weather_sun', 'concept_weather_sunny', 'concept_weather_cloud', 'concept_weather_cloudy',
  'concept_weather_rain', 'concept_weather_rainy', 'concept_weather_snow', 'concept_weather_snowy',
  'concept_weather_wind', 'concept_weather_windy', 'concept_weather_storm', 'concept_weather_stormy',
  'concept_weather_fog', 'concept_weather_lightning', 'concept_weather_rainbow',
];

// ── Chapter Cover Images ──────────────────────────────────────────────────────
// Language-neutral concept keys for chapter banner illustrations.
// Generated once via DALL-E, cached, and shared across all languages.
//
// These use the same watercolor illustrated style as vocabulary images so the
// textbook feels visually cohesive.

export const CHAPTER_COVER_SCENES: Record<string, string> = {
  numbers: [
    'Bright watercolor illustration: a cheerful classroom with colorful',
    'number tiles (1, 2, 3, 4, 5, 6, 7, 8, 9, 10) pinned to a corkboard,',
    'an abacus, chunky wooden number blocks and a ruler on a wooden desk,',
    'warm morning light through a window, soft educational watercolor style,',
    'inviting and playful, no characters, no text captions',
  ].join(' '),
  greetings: [
    'Bright watercolor illustration: two friendly cartoon people waving hello',
    'to each other across a sunny café table, speech bubble with a handshake',
    'icon, warm welcoming atmosphere, soft flat educational watercolor style,',
    'no text captions',
  ].join(' '),
  family: [
    'Warm watercolor illustration: a multigenerational family gathered around',
    'a round table sharing a meal, diverse faces, cozy home setting,',
    'soft educational watercolor style, no text captions',
  ].join(' '),
  daily: [
    'Bright watercolor illustration: a cheerful person going through a morning',
    'routine — sunrise, coffee cup, briefcase, clock — soft illustrated icons',
    'arranged in a circular flow, clean flat educational watercolor style,',
    'no text captions',
  ].join(' '),
};

/**
 * Resolve (or generate) a chapter cover image for the given chapter type.
 * Uses a language-neutral concept key shared across all languages.
 * Returns the image URL from cache, or generates via DALL-E and caches it.
 */
export async function resolveChapterCoverImage(
  chapterType: string,
  userId?: string,
): Promise<{ imageUrl: string; source: string }> {
  const scene = CHAPTER_COVER_SCENES[chapterType];
  if (!scene) {
    return { imageUrl: '', source: 'none' };
  }

  const conceptKey = `chapter_cover_${chapterType}`;

  // ── Check cache ──────────────────────────────────────────────────────────
  const cached = await storage.getCachedStockImage(conceptKey);
  if (cached?.url) {
    await storage.incrementImageUsage(cached.id);
    return { imageUrl: cached.url, source: 'cache' };
  }

  // ── Generate via DALL-E ──────────────────────────────────────────────────
  const { generateVisual } = await import('./visual-content-service');
  const result = await generateVisual(scene, 'infographic');

  try {
    await storage.cacheImage({
      url: result.imageUrl,
      filename: `chapter_cover_${chapterType}.png`,
      mimeType: 'image/png',
      mediaType: 'image',
      imageSource: 'ai_generated',
      searchQuery: conceptKey,
      uploadedBy: userId ?? null,
      title: `Chapter cover: ${chapterType}`,
      description: scene.slice(0, 200),
      language: 'shared',
      targetWord: conceptKey,
    });
  } catch (_) { /* non-fatal */ }

  return { imageUrl: result.imageUrl, source: 'generated' };
}

export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip combining diacritical marks (accents)
    // Re-compose after diacritic stripping so that Hangul Jamo (produced by NFD
    // decomposition of Korean syllables) get re-combined back into syllable blocks.
    // Without this, Korean words like "영" decompose to Jamo, the Jamo get stripped
    // by the character-class filter below, and every Korean word becomes an empty key.
    .normalize('NFC')
    // Replace CJK/Japanese/Arabic punctuation with a space so that word boundaries
    // are preserved (e.g. "元気です、ありがとう" → "元気です ありがとう" not "元気ですありがとう").
    // Latin punctuation (apostrophe, ¿, ¡, etc.) is stripped (replaced with '') below.
    .replace(/[\u3001\u3002\uff0c\uff01\uff1f\uff1a\uff1b\u300c\u300d\u300e\u300f\u3008-\u3011\u30fb\u060c\u061b\u061f]/g, ' ')
    // Strip remaining punctuation/symbols but preserve: a-z, 0-9, space, and non-Latin scripts:
    //   \u3040-\u30FF  Hiragana + Katakana (Japanese)
    //   \u3400-\u9FFF  CJK Unified Ideographs (Japanese kanji, Chinese hanzi)
    //   \uAC00-\uD7AF  Korean Hangul syllables
    //   \u1100-\u11FF  Korean Hangul Jamo (safety net after NFC)
    //   \u3130-\u318F  Korean Hangul Compatibility Jamo
    //   \u0590-\u05FF  Hebrew
    //   \u0600-\u06FF  Arabic
    //   \u0400-\u04FF  Cyrillic (Russian)
    .replace(/[^a-z0-9\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\u0590-\u05FF\u0600-\u06FF\u0400-\u04FF\s]/g, '')
    .replace(/\s+/g, ' ')            // collapse multiple spaces to single space
    .trim();
}

function generateCacheKey(word: string, language: string): string {
  return `vocab_${language}_${normalizeWord(word)}`;
}

function getPlaceholderUrl(word: string): string {
  const encoded = encodeURIComponent(word);
  return `https://via.placeholder.com/400x300/6366f1/ffffff?text=${encoded}`;
}

/**
 * Returns a series of cache keys to try for the given word, in priority order:
 * 1. Exact normalized key (e.g. "vocab_spanish_caliente frio")
 * 2. Without leading articles (e.g. "las olas" → "olas")
 * 3. Each individual word component (e.g. "caliente frio" → try "caliente", then "frio")
 */
// Spanish articles to try as prefixes when looking up bare nouns in the cache
const SPANISH_ARTICLE_PREFIXES = ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas'];

function getFallbackCacheKeys(word: string, language: string): string[] {
  const normalized = normalizeWord(word);
  const keys: string[] = [];

  // 1. Exact match
  keys.push(`vocab_${language}_${normalized}`);

  const parts = normalized.split(' ').filter(Boolean);

  if (parts.length > 1) {
    // 2. Strip leading/trailing articles (language-aware: Spanish + French covered)
    const stripped = parts.filter(p => !ALL_ARTICLES.has(p));
    if (stripped.length > 0 && stripped.length < parts.length) {
      keys.push(`vocab_${language}_${stripped.join(' ')}`);
      // Also try each stripped component individually
      for (const part of stripped) {
        if (part.length > 2) keys.push(`vocab_${language}_${part}`);
      }
    }

    // 3. Each individual word component
    for (const part of parts) {
      if (part.length > 2 && !ALL_ARTICLES.has(part)) {
        const candidate = `vocab_${language}_${part}`;
        if (!keys.includes(candidate)) keys.push(candidate);
      }
    }
  }

  // 4. For bare Spanish nouns (single word, no article), also try article-prefixed variants.
  //    Older cached images may have been stored with the article (e.g. "el plato", "la crema")
  //    even though the current request uses the bare noun ("plato", "crema").
  if (language === 'spanish' && parts.length === 1 && !ALL_ARTICLES.has(parts[0])) {
    for (const article of SPANISH_ARTICLE_PREFIXES) {
      const candidate = `vocab_${language}_${article} ${normalized}`;
      if (!keys.includes(candidate)) keys.push(candidate);
    }
  }

  return keys;
}

/**
 * Detect whether the concept describes a full scene (background/environment) vs. an isolated object.
 * Used to pick the right DALL-E style: scene concepts → SCENE_STYLE (environment),
 * object concepts → PROP_STYLE (single object on white background).
 */
export function isSceneConcept(word: string, scene?: string): boolean {
  // If a scene description was explicitly provided and is long, treat as scene
  if (scene && scene.split(' ').length >= 6) return true;

  // Certain Spanish words strongly imply a scene (location/room/environment words)
  // These render far better with DALL-E 3 scene style than as isolated props.
  const normalized = normalizeWord(word);
  const sceneWords = [
    // Outdoor/city places
    'playa', 'mar', 'olas', 'ola', 'ciudad', 'mercado', 'parque', 'bosque',
    'montanas', 'campo', 'pueblo', 'calle', 'restaurante', 'cafe', 'aeropuerto',
    'estacion', 'jardin', 'patio', 'plazuela', 'plaza',
    // Indoor rooms and spaces + house/home
    'casa', 'cocina', 'sala', 'dormitorio', 'bano', 'comedor', 'despacho', 'oficina',
    'cuarto', 'habitacion', 'garaje', 'sotano', 'desvan', 'pasillo', 'entrada',
    // Institutions/buildings
    'escuela', 'hospital', 'supermercado', 'tienda', 'banco', 'iglesia', 'museo',
    'teatro', 'cine', 'gimnasio', 'estadio', 'universidad', 'biblioteca',
    // English equivalents (for cross-language concepts)
    'beach', 'ocean', 'waves', 'sunset', 'sunrise', 'landscape', 'countryside',
    'desert', 'jungle', 'forest', 'office', 'kitchen', 'bathroom', 'bedroom',
    'living room', 'dining room', 'school', 'hospital', 'store', 'market',
  ];
  return sceneWords.some(w => normalized.includes(w));
}

// ── main resolver ─────────────────────────────────────────────────────────────

export async function resolveVocabularyImage(
  request: VocabImageRequest,
): Promise<VocabImageResult> {
  const { word, language, description = word, scene, translation, userId, seederMode, libraryOnly, meaning } = request;

  // ── TOP-LEVEL seeder guard ────────────────────────────────────────────────
  // During batch seeding, non-Spanish words MUST NOT trigger DALL-E.
  // They may only resolve from an existing cache/concept hit.
  // We set a flag and let the normal flow proceed — but we add an early check
  // right before any generation call.
  // (Additional mid-function guards remain at lines ~2750 and ~2870 as belt+suspenders.)

  // ── Pronoun-prefix stripping ──────────────────────────────────────────────
  // Sentence forms like "Je mange.", "Tu parles", "Il travaille" should resolve
  // to the same shared concept as the bare infinitive ("manger", "parler", etc.).
  // Strategy: if the normalised word is exactly two tokens and the first token is a
  // conjugation pronoun for the request language, try looking up only the second token.
  // Also handle elided French forms: j'étudie → étudier, j'aime → aimer.
  const CONJUGATION_PRONOUNS: Record<string, string[]> = {
    french:     ['je', 'j', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles'],
    german:     ['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr'],
    italian:    ['io', 'tu', 'lui', 'lei', 'noi', 'voi', 'loro'],
    portuguese: ['eu', 'tu', 'ele', 'ela', 'nos', 'voces', 'eles', 'elas'],
    spanish:    ['yo', 'tu', 'el', 'ella', 'nosotros', 'nosotras', 'vosotros', 'ellos', 'ellas'],
    english:    ['i', 'you', 'he', 'she', 'it', 'we', 'they'],
    japanese:   ['わたしは', 'わたしが', 'ぼくは', 'ぼくが'],
    korean:     ['나는', '나가', '저는', '그는', '그녀는'],
    mandarin:   ['我', '你', '他', '她', '我们', '你们', '他们'],
  };

  function stripPronounPrefix(raw: string, lang: string): string | null {
    // Pre-process: replace apostrophe variants with a space BEFORE normalizing.
    // normalizeWord() removes apostrophes without inserting a space, so
    //   "j'étudie"  → normalizeWord → "jetudie"  (wrong — can't split on pronouns)
    //   "j' étudie" → normalizeWord → "j etudie" (correct — splits cleanly)
    // Doing this replacement here gives correct 2-token behaviour for elided forms.
    const withSpaceApostrophes = raw
      .replace(/[\u2019\u2018\u0060\u00B4']/g, " ") // curly/smart apostrophes → space
      .replace(/'/g, " ");                            // straight apostrophe → space
    const norm = normalizeWord(withSpaceApostrophes);
    const pronouns = CONJUGATION_PRONOUNS[lang] ?? [];

    // Two-token form: "je mange" / "j etudie" (from j'étudie) → check if first token is a pronoun
    const tokens = norm.split(' ').filter(Boolean);
    if (tokens.length === 2 && pronouns.includes(tokens[0])) {
      return tokens[1];
    }

    // Sentence ending in a period: "Je mange." → normalised → "je mange" (period stripped) → two tokens ✓
    // (normalizeWord already strips punctuation and trims)

    return null;
  }

  // ── Step 0: Canonical vocabulary registry (guaranteed routing) ──────────
  // Check the canonical registry FIRST so that any word defined in the
  // 27-unit canonical vocabulary immediately resolves to its shared concept
  // key — no need for the word to also appear in CONCEPT_KEY_MAP.
  let conceptKey: string | null =
    lookupCanonicalConcept(word, language as CanonicalLanguage) ?? null;
  // Track whether the concept key came from the canonical registry so the
  // enforcement guard below can prevent generic auto-generation for these words.
  let isCanonicalKey = false;
  if (conceptKey) {
    isCanonicalKey = true;
    console.log(`[VocabImage] Canonical registry: "${word}" (${language}) → "${conceptKey}"`);
  }

  // ── Step 1: Check CONCEPT_KEY_MAP (existing cross-language map) ──────────
  // Check if this word maps to a shared cross-language concept key
  const normalizedForConcept = normalizeWord(word);
  let strippedBase: string | null = null;
  if (!conceptKey) {
    // Try direct lookup first; fall back to pronoun-stripped form if no hit.
    conceptKey = CONCEPT_KEY_MAP[normalizedForConcept] ?? null;
    if (!conceptKey) {
      strippedBase = stripPronounPrefix(word, language);
      if (strippedBase) {
        const strippedConceptKey = CONCEPT_KEY_MAP[strippedBase] ?? null;
        if (strippedConceptKey) {
          console.log(`[VocabImage] Pronoun-stripped "${word}" → "${strippedBase}" → concept "${strippedConceptKey}"`);
          conceptKey = strippedConceptKey;
        }
        // Also try the canonical registry on the stripped form
        if (!conceptKey) {
          conceptKey = lookupCanonicalConcept(strippedBase, language as CanonicalLanguage) ?? null;
          if (conceptKey) {
            isCanonicalKey = true;
            console.log(`[VocabImage] Canonical registry (stripped) "${strippedBase}" (${language}) → "${conceptKey}"`);
          }
        }
      }
    }
  }

  if (conceptKey) {
    console.log(`[VocabImage] "${word}" (${language}) → shared concept "${conceptKey}"`);

    // ── 1a. Concept cache hit — instant, cross-language ──────────────────
    const conceptCached = await storage.getCachedStockImage(conceptKey);
    if (conceptCached?.url) {
      console.log(`[VocabImage] Concept cache hit for "${word}" → "${conceptKey}"`);
      await storage.incrementImageUsage(conceptCached.id);
      return { imageUrl: conceptCached.url, source: 'cache', word, description };
    }

    // ── 1b. Migration: check legacy language-specific key and promote it ──
    // Images seeded before concept sharing existed are stored as vocab_{lang}_{word}.
    // If we find one, promote it to the shared concept key so all languages benefit.
    // EXCEPTION: skip migration for number concepts — numbers use SVG (step 1c) and
    // we must not promote stale DALL-E images into the shared concept cache.
    if (!conceptKey.startsWith('concept_num_')) {
      const legacyKey = generateCacheKey(word, language);
      const legacyCached = await storage.getCachedStockImage(legacyKey);
      if (legacyCached?.url) {
        console.log(`[VocabImage] Migrating legacy key "${legacyKey}" → concept key "${conceptKey}"`);
        try {
          await storage.cacheImage({
            url: legacyCached.url,
            filename: `vocab_concept_${conceptKey}_migrated.jpg`,
            mimeType: 'image/jpeg',
            mediaType: 'image',
            imageSource: 'ai_generated',
            searchQuery: conceptKey,
            uploadedBy: null,
            title: conceptKey,
            description: description,
            tags: ['vocabulary', 'ai_generated', 'shared_concept'],
            language: 'shared',
            targetWord: conceptKey,
          });
        } catch (_) { /* ignore migration save errors — image still returned */ }
        await storage.incrementImageUsage(legacyCached.id);
        return { imageUrl: legacyCached.url, source: 'cache', word, description };
      }
    }

    // ── 1c. Generate once, save under concept key for all languages ──────

    // ── Number concepts: generate a clean SVG instead of calling DALL-E ──────
    // DALL-E produces inconsistent results for numerals. A server-generated SVG
    // is perfectly consistent, instant, and shared across all languages.
    if (conceptKey.startsWith('concept_num_')) {
      const numStr = conceptKey.replace('concept_num_', '');
      const num = parseInt(numStr, 10);
      if (!isNaN(num)) {
        const svgUrl = generateNumberSvgDataUrl(num);
        console.log(`[VocabImage] Number concept "${conceptKey}" → SVG data URL (no DALL-E)`);
        try {
          await storage.cacheImage({
            url: svgUrl,
            filename: `vocab_concept_${conceptKey}.svg`,
            mimeType: 'image/svg+xml',
            mediaType: 'image',
            imageSource: 'ai_generated',
            searchQuery: conceptKey,
            uploadedBy: userId ?? null,
            title: conceptKey,
            description: `Number ${num}`,
            language: 'shared',
            targetWord: conceptKey,
          });
        } catch (_) { /* cache save failure is non-fatal */ }
        return { imageUrl: svgUrl, source: 'ai', word, description };
      }
    }

    // Seeder-mode guard: non-Spanish languages should ONLY hit existing Spanish anchors
    // via CONCEPT_KEY_MAP — if we reach here it means the concept anchor hasn't been
    // generated yet.  In seeder-mode we skip generation and return a placeholder so
    // we don't accidentally create non-Spanish images under shared concept keys.
    if (seederMode && language !== 'spanish') {
      console.log(`[VocabImage] Seeder mode — skipping concept generation for "${word}" (${language}), anchor not yet seeded`);
      return { imageUrl: getPlaceholderUrl(word), source: 'placeholder', word, description };
    }

    // Use SCENE_OVERRIDES via dynamic import (avoids circular dependency) so even
    // on-demand cache-miss generation uses the correct educational illustration
    // rather than a generic DALL-E interpretation that would permanently poison the concept key.
    const { SCENE_OVERRIDES: sceneOverrides, normalizeForOverride } = await import('./vocab-image-seed-service');
    const overrideKey = normalizeForOverride(word);
    // First try the raw word override; if not found, try the anchor word extracted
    // from the concept key (e.g. conceptKey="vocab_spanish_beber" → anchorWord="beber").
    // This lets French "boire" → canonical → vocab_spanish_beber → SCENE_OVERRIDES["beber"].
    let sceneFromOverride = sceneOverrides[overrideKey];
    if (!sceneFromOverride && conceptKey.startsWith('vocab_spanish_')) {
      // Convert underscores back to spaces so multi-word keys match:
      // vocab_spanish_dolor_de_cabeza → "dolor de cabeza" → SCENE_OVERRIDE key match
      const anchorWord = conceptKey.replace('vocab_spanish_', '').replace(/_/g, ' ');
      sceneFromOverride = sceneOverrides[normalizeForOverride(anchorWord)];
      if (sceneFromOverride) {
        console.log(`[VocabImage] Using anchor SCENE_OVERRIDE "${anchorWord}" for concept "${conceptKey}" (input: "${word}")`);
      }
    }

    // ── Canonical enforcement: prevent generic auto-generation ─────────────
    // If the concept key came from the canonical registry but has no SCENE_OVERRIDE
    // prompt to guide generation, do NOT fall through to generic DALL-E output.
    // Return a placeholder so the key is never poisoned with an off-concept image.
    // The admin seeder should provide a SCENE_OVERRIDE for any canonical concept
    // before it can receive an AI-generated image.
    if (!sceneFromOverride && isCanonicalKey) {
      console.log(`[VocabImage] Canonical word "${word}" → concept "${conceptKey}" has no SCENE_OVERRIDE — returning placeholder (seed required)`);
      return { imageUrl: getPlaceholderUrl(word), source: 'placeholder', word, description };
    }

    sceneFromOverride = sceneFromOverride ?? scene;
    const conceptForGeneration = buildGenerationConcept(word, sceneFromOverride, description, translation, language);
    const generationType = isSceneConcept(word, sceneFromOverride) ? 'infographic' : 'image';
    console.log(`[VocabImage] Concept cache miss — generating (${generationType}) for concept "${conceptKey}": "${conceptForGeneration.slice(0, 80)}..."`);

    if (libraryOnly) {
      console.log(`[VocabImage] Library-only mode — skipping DALL-E for concept "${conceptKey}"`);
      return { imageUrl: getPlaceholderUrl(word), source: 'placeholder', word, description };
    }

    try {
      const { generateVisual } = await import('./visual-content-service');
      const result = await generateVisual(conceptForGeneration, generationType, undefined, undefined, undefined, language);

      try {
        await storage.cacheImage({
          url: result.imageUrl,
          filename: `vocab_concept_${conceptKey}_${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
          mediaType: 'image',
          imageSource: 'ai_generated',
          searchQuery: conceptKey,
          uploadedBy: userId ?? null,
          title: conceptKey,
          description: description,
          tags: ['vocabulary', 'ai_generated', 'shared_concept'],
          language: 'shared',
          targetWord: conceptKey,
        });
        console.log(`[VocabImage] Concept image saved as "${conceptKey}" (shared across all languages)`);
      } catch (saveErr: any) {
        console.warn('[VocabImage] Concept cache save skipped:', saveErr.message);
      }

      return { imageUrl: result.imageUrl, source: 'ai', word, description };
    } catch (genErr: any) {
      console.error('[VocabImage] DALL-E generation failed for concept:', genErr.message);
    }

    // Fall through to placeholder if generation failed
    return { imageUrl: getPlaceholderUrl(word), source: 'placeholder', word, description };
  }

  // ── Non-concept word: language-specific lookup ───────────────────────────
  // When a meaning is provided (e.g. "weather" vs "time" for "el tiempo"), append
  // it as a slug so each sense gets its own cache entry — no cross-contamination.
  const meaningSlug = meaning
    ? `_${meaning.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`
    : '';
  const primaryKey = generateCacheKey(word, language) + meaningSlug;
  console.log(`[VocabImage] Resolving "${word}" (${language})${meaning ? ` [sense: ${meaning}]` : ''}, primary key: ${primaryKey}`);

  // ── 1. Library cache lookup with fallback variants ───────────────────────
  // When a meaning is scoped, only check the exact scoped key — never fall back
  // to the generic ambiguous key, which would return the wrong sense image.
  const keysToTry = meaning ? [primaryKey] : getFallbackCacheKeys(word, language);
  for (const key of keysToTry) {
    const cached = await storage.getCachedStockImage(key);
    if (cached?.url) {
      const matchType = key === primaryKey ? 'exact' : 'fallback';
      console.log(`[VocabImage] Cache hit (${matchType}) for "${word}" → key "${key}"`);
      await storage.incrementImageUsage(cached.id);
      return { imageUrl: cached.url, source: 'cache', word, description };
    }
  }

  // ── 1b. If no scene was passed by the caller, look up SCENE_OVERRIDES automatically.
  // On-demand generation (e.g. textbook viewing) doesn't pass a scene, so without this
  // a cache miss would produce a generic random-person image from just the word text.
  // The admin fix-greetings route already passes scene explicitly; this is the fallback
  // so that ALL generation paths (on-demand and admin) use the same character scenes.
  let effectiveScene = scene;
  if (!effectiveScene) {
    try {
      const { SCENE_OVERRIDES, normalizeForOverride } = await import('./vocab-image-seed-service');
      const overrideKey = normalizeForOverride(word);
      effectiveScene = (SCENE_OVERRIDES as Record<string, string>)[`${language}:${overrideKey}`]
                       ?? (SCENE_OVERRIDES as Record<string, string>)[overrideKey];
      if (effectiveScene) {
        console.log(`[VocabImage] Scene override auto-applied for "${word}" (${language})`);
      }
    } catch (_) { /* scene overrides unavailable — proceed with word-based generation */ }
  }

  // ── 1c. Function/grammar word check ─────────────────────────────────────
  // Words like "que", "como", "de", "desde", "pero", "y", "si" have no visual
  // concept — DALL-E generates nonsensical images for them.  Detect via English
  // translation and return a typographic SVG flashcard instead (instant, no credit use).
  {
    const conceptForCheck = buildGenerationConcept(word, effectiveScene, description, translation, language);
    if (!effectiveScene && isFunctionWord(conceptForCheck)) {
      const displayTranslation = (translation || description || word).slice(0, 40);
      const svgUrl = generateFunctionWordSvg(word, displayTranslation);
      console.log(`[VocabImage] Function word detected for "${word}" (${language}) — returning SVG card`);
      try {
        await storage.cacheImage({
          url: svgUrl,
          filename: `vocab_fw_${primaryKey}.svg`,
          mimeType: 'image/svg+xml',
          mediaType: 'image',
          imageSource: 'ai_generated',
          searchQuery: primaryKey,
          uploadedBy: userId ?? null,
          title: word,
          description: displayTranslation,
          tags: ['vocabulary', 'function_word', language ?? 'unknown'],
          language: language ?? 'unknown',
          targetWord: word,
        });
      } catch (_) { /* cache save failure is non-fatal */ }
      return { imageUrl: svgUrl, source: 'ai', word, description: displayTranslation };
    }
  }

  // ── Seeder-mode guard ─────────────────────────────────────────────────────
  // Non-Spanish languages should always resolve to a Spanish anchor via
  // CONCEPT_KEY_MAP.  If we reach this point during a batch seed it means
  // the word has no map entry — generating a language-specific image here
  // would create exactly the runaway FR/DE/PT junk-image problem.  Skip.
  if (seederMode && language !== 'spanish') {
    console.log(`[VocabImage] Seeder mode — skipping DALL-E for "${word}" (${language}), no CONCEPT_KEY_MAP entry`);
    return { imageUrl: getPlaceholderUrl(word), source: 'placeholder', word, description };
  }

  // ── 2. Generate with gpt-image-1 ─────────────────────────────────────────
  // Inject the language's named character for action/phrase concepts so the
  // model produces a character-consistent scene rather than an anonymous person.
  // Object nouns (house, dog, book) are not affected — looksLikeActionOrPhrase()
  // returns false for those, so they remain clean prop images.
  //
  // If a meaning was specified, prepend it to the description so the generator
  // produces the correct visual referent (e.g. a weather scene, not a clock).
  const generationDescription = meaning
    ? `${description} — specifically depicting: ${meaning}`
    : description;
  const characterIntro = language ? LANGUAGE_CHARACTER_INTROS[language] : undefined;
  const conceptForGeneration = buildGenerationConcept(word, effectiveScene, generationDescription, translation, language, characterIntro);
  const generationType = isSceneConcept(word, conceptForGeneration) ? 'infographic' : 'image';

  // Resolve anchor image URL for scene generations — gives gpt-image-1 a visual
  // reference for the character's face and illustration style.  Only applied to
  // scene/character images; prop images don't need character consistency.
  let anchorImageUrl: string | undefined;
  if (generationType === 'infographic' && language) {
    const anchorKey = LANGUAGE_ANCHOR_CACHE_KEYS[language];
    if (anchorKey) {
      try {
        const anchorRecord = await storage.getCachedStockImage(anchorKey);
        if (anchorRecord?.url) {
          anchorImageUrl = anchorRecord.url;
          console.log(`[VocabImage] Anchor resolved: ${anchorKey} → ${anchorImageUrl.slice(0, 60)}…`);
        } else {
          console.log(`[VocabImage] Anchor key "${anchorKey}" not in cache — will use text-only generation`);
        }
      } catch (anchorLookupErr: any) {
        console.warn('[VocabImage] Anchor lookup failed:', anchorLookupErr.message);
      }
    }
  }

  console.log(`[VocabImage] Cache miss — generating (${generationType}${anchorImageUrl ? ', anchored' : ''}) for: "${conceptForGeneration}"`);

  if (libraryOnly) {
    console.log(`[VocabImage] Library-only mode — skipping DALL-E for "${word}"`);
    return { imageUrl: getPlaceholderUrl(word), source: 'placeholder', word, description };
  }

  try {
    const { generateVisual } = await import('./visual-content-service');
    const result = await generateVisual(conceptForGeneration, generationType, undefined, undefined, anchorImageUrl);

    try {
      await storage.cacheImage({
        url: result.imageUrl,
        filename: `vocab_ai_${primaryKey}_${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        mediaType: 'image',
        imageSource: 'ai_generated',
        searchQuery: primaryKey,
        uploadedBy: userId ?? null,
        title: word,
        description: generationDescription,
        tags: ['vocabulary', 'ai_generated', language, ...(meaning ? [`sense_${meaning.toLowerCase().replace(/\s+/g, '_')}`] : [])],
        language,
        targetWord: word,
      });
      console.log(`[VocabImage] Generated image saved to cache as "${primaryKey}"`);
    } catch (saveErr: any) {
      console.warn('[VocabImage] Cache save skipped:', saveErr.message);
    }

    return { imageUrl: result.imageUrl, source: 'ai', word, description };
  } catch (genErr: any) {
    console.error('[VocabImage] DALL-E generation failed:', genErr.message);
  }

  // ── 3. Placeholder fallback ──────────────────────────────────────────────
  console.log(`[VocabImage] Using placeholder for "${word}"`);
  return { imageUrl: getPlaceholderUrl(word), source: 'placeholder', word, description };
}

/**
 * Returns true when a resolved concept string looks like a human action, verb,
 * or multi-word phrase — i.e. something that would naturally involve a person in
 * the generated image, so character injection makes sense.
 *
 * Returns false for single concrete nouns ("house", "dog", "book") and abstract
 * colour/number words — those are best rendered as clean prop images.
 */
function looksLikeActionOrPhrase(concept: string): boolean {
  const lower = concept.toLowerCase().trim();
  // Infinitive verbs: "to eat", "to speak", "to go shopping", …
  if (lower.startsWith('to ')) return true;
  // Participles / gerunds: "eating", "speaking", "going to the market"
  if (lower.match(/^[a-z]+ing\b/)) return true;
  // Phrases of 3+ words that are not pure article+noun combos
  const words = lower.split(/\s+/);
  if (words.length >= 3) return true;
  return false;
}

/**
 * Build a descriptive English generation concept from the available parameters.
 * When only a foreign-language word is given, DALL-E can struggle. We use the scene
 * description when available, then the English translation if provided, then the
 * description field, then finally the word itself (with articles stripped).
 * Language context is added so DALL-E knows what language the word is from.
 *
 * When `characterIntro` is provided and the concept looks like an action/phrase,
 * the character is embedded so DALL-E generates a character-consistent scene
 * rather than an anonymous person.  This is only applied to language-specific
 * (non-shared-concept) words.
 */
export function buildGenerationConcept(
  word: string,
  scene?: string,
  description?: string,
  translation?: string,
  language?: string,
  characterIntro?: string,
): string {
  // Derive the core concept from the scene override, translation, description, or word itself
  let concept = '';

  if (scene && scene.trim().length > 0) {
    // Scene override is the most informative starting point.
    // If it describes an ACTION (multi-word / gerund phrase) we still run it through
    // character injection below so the language's named character is included.
    // Only static prop descriptions (e.g. "a red apple on a wooden table") bypass
    // character injection — those will also fail looksLikeActionOrPhrase.
    concept = scene.trim();
  } else if (translation && translation.trim().length > 0 && translation.trim().toLowerCase() !== word.toLowerCase()) {
    // Use English translation as the generation concept when available — avoids DALL-E
    // misinterpreting foreign words (e.g. "paix" → apple instead of dove/peace symbol)
    concept = translation.trim();
  } else if (description && description !== word && description.trim().length > 0) {
    // Use the description if it adds more context than the word alone
    concept = description.trim();
  } else {
    // Strip articles for cleaner generation (covers Spanish + French)
    const normalized = normalizeWord(word);
    const parts = normalized.split(' ').filter(p => !ALL_ARTICLES.has(p));
    const cleanWord = parts.length > 0 ? parts.join(' ') : word;

    // For non-Spanish languages, add a language hint so DALL-E knows what it means
    concept = (language && language !== 'spanish' && cleanWord.length > 0)
      ? `${cleanWord} (${language} word)`
      : cleanWord;
  }

  // ── Character injection for actions and phrases ─────────────────────────────
  // If this concept describes an action or multi-word phrase and we have a named
  // character for the language, build a scene description so DALL-E uses that
  // character consistently instead of generating a random anonymous person.
  // NOTE: Static prop descriptions (e.g. "a tall glass of horchata with ice...") 
  // that are intentionally character-free will also return true from looksLikeActionOrPhrase
  // (many words), so those should be phrased as PROP descriptions and tested carefully.
  if (characterIntro && concept && looksLikeActionOrPhrase(concept)) {
    // Only inject a character if the scene is a CHARACTER ACTION, not a PROP/still-life:
    //   PROP: starts with "a ", "an ", "the " → it's a noun phrase describing an object.
    //         e.g. "a tall glass of horchata with ice..." → NO character injection.
    //   ACTION: starts with a gerund, adverb+gerund, or other verb form
    //         e.g. "warmly pressing a hand to their chest..." → inject character.
    // The seeder architecture doc calls these "CULTURALLY NEUTRAL" vs "CULTURALLY DRIVEN".
    const isPropDescription = /^(a |an |the )/i.test(concept);
    // Also skip injection for concepts that open with an explicit count or "ONLY" keyword —
    // e.g. "ONLY TWO people: ...", "Two women face each other..." — these are fully self-described scenes.
    const alreadyHasCharacter =
      /^(a |an )?(person|people|woman|man|boy|girl|child)\b/i.test(concept) ||
      /^(only |two |three )/i.test(concept);
    // Also skip injection when the scene already contains ANY known character name
    // in its first 150 characters.  This covers:
    //   — "Daniela, a 28-year-old..." (primary character)
    //   — "Marco, a 30-year-old..." (secondary character used in SCENE_OVERRIDES like 'de nada')
    //   — "Two people: Daniela... and Rosa..." two-person constructions
    // Without this broader check, scenes using CHAR.XX.secondary still have the primary
    // character injected on top → two people in the output.
    const ALL_KNOWN_CHARACTER_NAMES = [
      // Primary characters — one per language
      'Daniela', 'Sophie', 'Anna', 'Giulia', 'Ana', 'Yuki', 'Ji-yeon', 'Mei', 'Noa', 'Emma',
      // Secondary characters — one per language
      'Marco', 'Pierre', 'Klaus', 'Luca', 'João', 'Kenji', 'Min-jun', 'Wei', 'Avi', 'Marcus',
      // Family / supporting characters
      'Rosa', 'Nonna', 'Oma', 'Avó',
    ];
    const alreadyHasNamedCharacter =
      ALL_KNOWN_CHARACTER_NAMES.some(name => concept.slice(0, 150).includes(name));
    if (!isPropDescription && !alreadyHasCharacter && !alreadyHasNamedCharacter) {
      return `${characterIntro} ${concept}, in a natural everyday setting`;
    }
  }

  return concept;
}

export async function resolveMultipleImages(
  requests: VocabImageRequest[],
): Promise<VocabImageResult[]> {
  return Promise.all(requests.map(resolveVocabularyImage));
}

export async function prefetchVocabularyImage(
  word: string,
  language: string,
  description?: string,
): Promise<void> {
  try {
    await resolveVocabularyImage({ word, language, description });
  } catch (err: any) {
    console.error(`[VocabImage] Prefetch failed for "${word}":`, err.message);
  }
}

/**
 * Refetch: bust the cache for a word and re-resolve a fresh image.
 * Fixes the existing /api/admin/media/refetch route which imports this function.
 */
export async function refetchImage(request: {
  word: string;
  language: string;
  preferredSource: 'stock' | 'ai';
  customQuery?: string;
  userId?: string | null;
}): Promise<VocabImageResult> {
  const { word, language, customQuery, userId } = request;
  const effectiveWord = customQuery || word;
  const primaryKey = generateCacheKey(effectiveWord, language);

  // Bust the cache so resolveVocabularyImage generates fresh
  try {
    const { bustVocabImageCache } = await import('./vocab-image-seed-service');
    await bustVocabImageCache([primaryKey]);
  } catch (_) { /* non-fatal — image will still be regenerated */ }

  return resolveVocabularyImage({
    word: effectiveWord,
    language,
    description: word,
    userId: userId ?? undefined,
  });
}

/**
 * Preview-only refetch: generate a new image via DALL-E and archive it to
 * permanent storage, but do NOT save a record to media_files.
 * Returns the permanent URL so the admin can compare before committing.
 */
export async function previewRefetchImage(request: {
  word: string;
  language: string;
  customQuery?: string;
  userId?: string | null;
}): Promise<{ previewUrl: string; source: string }> {
  const { word, language, customQuery } = request;
  const effectiveWord = customQuery || word;

  // Auto-apply scene overrides so the preview matches what the real image would look like
  let scene: string | undefined;
  try {
    const { SCENE_OVERRIDES, normalizeForOverride } = await import('./vocab-image-seed-service');
    const overrideKey = normalizeForOverride(effectiveWord);
    scene = (SCENE_OVERRIDES as Record<string, string>)[`${language}:${overrideKey}`]
             ?? (SCENE_OVERRIDES as Record<string, string>)[overrideKey];
  } catch (_) { /* no override — proceed with word-based generation */ }

  const characterIntroPreview = language ? LANGUAGE_CHARACTER_INTROS[language] : undefined;
  const concept = buildGenerationConcept(effectiveWord, scene, effectiveWord, undefined, language, characterIntroPreview);
  const generationType = isSceneConcept(effectiveWord, concept) ? 'infographic' : 'image';

  const { generateVisual } = await import('./visual-content-service');
  const result = await generateVisual(concept, generationType);

  // Archive to permanent storage so URL doesn't expire during review
  const { archiveImageToPermanentStorage } = await import('./image-storage');
  const filename = `vocab_preview_library_${Date.now()}.jpg`;
  const permanentUrl = await archiveImageToPermanentStorage(result.imageUrl, filename);

  return { previewUrl: permanentUrl, source: 'ai' };
}
