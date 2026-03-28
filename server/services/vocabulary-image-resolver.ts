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

export interface VocabImageRequest {
  word: string;
  language: string;
  description?: string;
  scene?: string;       // Rich generation prompt when no library image exists
  translation?: string; // English meaning — used as generation hint for non-English words
  conversationId?: string;
  userId?: string;
}

export interface VocabImageResult {
  imageUrl: string;
  source: 'cache' | 'ai' | 'placeholder';
  word: string;
  description: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

// Articles and common filler words to strip before fallback lookup (covers Spanish + French)
const SPANISH_ARTICLES = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al']);
const FRENCH_ARTICLES = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'l']);
const ALL_ARTICLES = new Set([...SPANISH_ARTICLES, ...FRENCH_ARTICLES]);

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

const CONCEPT_KEY_MAP: Record<string, string> = {
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
};

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip accent marks
    .replace(/[^a-z0-9\s]/g, '')     // strip punctuation (slashes, hyphens, etc.)
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

  return keys;
}

/**
 * Detect whether the concept describes a full scene (background/environment) vs. an isolated object.
 * Used to pick the right DALL-E style: scene concepts → SCENE_STYLE (environment),
 * object concepts → PROP_STYLE (single object on white background).
 */
function isSceneConcept(word: string, scene?: string): boolean {
  // If a scene description was explicitly provided and is long, treat as scene
  if (scene && scene.split(' ').length >= 6) return true;

  // Certain Spanish words strongly imply a scene
  const normalized = normalizeWord(word);
  const sceneWords = ['playa', 'mar', 'olas', 'ola', 'ciudad', 'mercado', 'parque', 'bosque',
    'montanas', 'campo', 'pueblo', 'calle', 'restaurante', 'cafe', 'aeropuerto',
    'estacion', 'jardin', 'cocina', 'sala', 'dormitorio', 'escuela', 'oficina',
    'hospital', 'supermercado', 'tienda', 'banco', 'iglesia', 'museo', 'teatro',
    'playa beach ocean waves sunset sunrise landscape countryside desert jungle forest'];
  return sceneWords.some(w => normalized.includes(w));
}

// ── main resolver ─────────────────────────────────────────────────────────────

export async function resolveVocabularyImage(
  request: VocabImageRequest,
): Promise<VocabImageResult> {
  const { word, language, description = word, scene, translation, userId } = request;

  // Check if this word maps to a shared cross-language concept key
  const normalizedForConcept = normalizeWord(word);
  const conceptKey = CONCEPT_KEY_MAP[normalizedForConcept] ?? null;

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

    // ── 1c. Generate once, save under concept key for all languages ──────
    const conceptForGeneration = buildGenerationConcept(word, scene, description, translation, language);
    const generationType = isSceneConcept(word, scene) ? 'infographic' : 'image';
    console.log(`[VocabImage] Concept cache miss — generating (${generationType}) for concept "${conceptKey}": "${conceptForGeneration}"`);

    try {
      const { generateVisual } = await import('./visual-content-service');
      const result = await generateVisual(conceptForGeneration, generationType);

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
  const primaryKey = generateCacheKey(word, language);
  console.log(`[VocabImage] Resolving "${word}" (${language}), primary key: ${primaryKey}`);

  // ── 1. Library cache lookup with fallback variants ───────────────────────
  const keysToTry = getFallbackCacheKeys(word, language);
  for (const key of keysToTry) {
    const cached = await storage.getCachedStockImage(key);
    if (cached?.url) {
      const matchType = key === primaryKey ? 'exact' : 'fallback';
      console.log(`[VocabImage] Cache hit (${matchType}) for "${word}" → key "${key}"`);
      await storage.incrementImageUsage(cached.id);
      return { imageUrl: cached.url, source: 'cache', word, description };
    }
  }

  // ── 2. Generate with DALL-E 3 (watercolor style) ────────────────────────
  const conceptForGeneration = buildGenerationConcept(word, scene, description, translation, language);
  const generationType = isSceneConcept(word, scene) ? 'infographic' : 'image';
  console.log(`[VocabImage] Cache miss — generating (${generationType}) for: "${conceptForGeneration}"`);

  try {
    const { generateVisual } = await import('./visual-content-service');
    const result = await generateVisual(conceptForGeneration, generationType);

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
        description: description,
        tags: ['vocabulary', 'ai_generated', language],
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
 * Build a descriptive English generation concept from the available parameters.
 * When only a foreign-language word is given, DALL-E can struggle. We use the scene
 * description when available, then the English translation if provided, then the
 * description field, then finally the word itself (with articles stripped).
 * Language context is added so DALL-E knows what language the word is from.
 */
function buildGenerationConcept(word: string, scene?: string, description?: string, translation?: string, language?: string): string {
  // Prefer the explicit scene description — most informative for generation
  if (scene && scene.trim().length > 0) return scene.trim();

  // Use English translation as the generation concept when available — avoids DALL-E
  // misinterpreting foreign words (e.g. "paix" → apple instead of dove/peace symbol)
  if (translation && translation.trim().length > 0 && translation.trim().toLowerCase() !== word.toLowerCase()) {
    return translation.trim();
  }

  // Use the description if it adds more context than the word alone
  if (description && description !== word && description.trim().length > 0) {
    return description.trim();
  }

  // Strip articles for cleaner generation (covers Spanish + French)
  const normalized = normalizeWord(word);
  const parts = normalized.split(' ').filter(p => !ALL_ARTICLES.has(p));
  const cleanWord = parts.length > 0 ? parts.join(' ') : word;

  // For non-Spanish languages, add a language hint so DALL-E knows what it means
  if (language && language !== 'spanish' && cleanWord.length > 0) {
    return `${cleanWord} (${language} word)`;
  }

  return cleanWord;
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
