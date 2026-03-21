/**
 * Lesson Topic Tagger
 *
 * Mass-tags curriculum lessons with canonical topic slugs so the
 * scenario-to-textbook bridge works correctly.
 *
 * Execution order:
 *  1. Keyword fast-path — matches ~80 % of common Spanish lessons instantly
 *  2. Gemini batch fallback — sends batches of 20 lessons for the rest
 *  3. After tagging, resets scenario curriculumTopics to [] so the
 *     scenario seeder can re-process them with the richer topic set
 */

import { getSharedDb } from '../db';
import { curriculumLessons, curriculumUnits, curriculumPaths } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const GEMINI_MODEL = 'gemini-3-flash-preview';

// ─── Canonical topic slug list ────────────────────────────────────────────────
export const CANONICAL_TOPICS: string[] = [
  // Already covered (basic lessons)
  'numbers', 'advanced-numbers', 'intermediate-numbers',
  'greetings', 'food', 'family', 'health', 'work', 'hobbies',
  'prices', 'vocabulary', 'phrases',
  // Gap topics needed by scenarios
  'opinions', 'food-vocabulary', 'formal-language', 'social-vocabulary',
  'formal-requests', 'past-tense', 'professional-vocabulary', 'time',
  'ordering', 'directions', 'prices-money', 'colors-descriptors',
  'polite-requests', 'preferences', 'transportation', 'self-introduction',
  'body-parts', 'describing-symptoms', 'travel', 'cultural-vocabulary',
  'expressing-emotions', 'shopping', 'scheduling', 'describing-preferences',
  'art', 'descriptions', 'introductions', 'describing-objects',
  'describing-experiences', 'medicine', 'celebrations', 'kitchen-vocabulary',
  'instructions', 'verbs-of-action', 'future-plans', 'academic-vocabulary',
  'questions', 'note-taking', 'education', 'landmarks', 'describing-places',
  'financial-vocabulary', 'quantities',
];

// ─── Keyword rules (pattern → topic slugs) ───────────────────────────────────
// Each rule is [regex, slugs[]]. The first matching rule wins (plus accumulated
// matches from non-exclusive passes).
type KeywordRule = [RegExp, string[]];

const KEYWORD_RULES: KeywordRule[] = [
  // Food & ordering
  [/restaur|restaurant.*order|order.*food|ordering/i, ['food-vocabulary', 'ordering', 'polite-requests']],
  [/coffee|café|cafe|drinks?|bebida|smoothie|juice|latte|beverage/i, ['food-vocabulary', 'ordering']],
  [/grocery|supermarket|mercado|market|produce/i, ['food-vocabulary', 'shopping', 'quantities']],
  [/food|comida|cuisine|eat|meal|breakfast|lunch|dinner|menu|cocina|recipe|ingredient|cooking|kitchen/i, ['food-vocabulary']],
  [/hispanic.*cuisine|cultura.*comida|culin/i, ['food-vocabulary', 'cultural-vocabulary']],

  // Shopping & clothing
  [/clothing|clothes|ropa|wardrobe|outfit|wear|fashion|shirt|pants|dress|shoes/i, ['shopping', 'colors-descriptors']],
  [/color|colour|size|sizes|big|small|large|medium|fits?/i, ['colors-descriptors']],
  [/shopping|at.*store|en.*tienda|tienda|buying|purchase|haggl|store|shop/i, ['shopping', 'prices-money']],

  // Travel
  [/airport|aeropuerto|flight|boarding|customs|immigration|terminal/i, ['travel', 'formal-requests', 'time']],
  [/hotel|hostel|accommodation|check.in|check.out|room|reservation/i, ['travel', 'formal-requests', 'describing-preferences']],
  [/travel|viaje|trip|tourism|tourist|vacation|holiday|destination|adventure|sightseeing/i, ['travel', 'cultural-vocabulary']],
  [/dream.*destination|dream.*trip|dream.*travel|places.*visit/i, ['travel', 'describing-places']],
  [/planificando|planning.*trip|plan.*travel|itinerary/i, ['travel', 'scheduling']],

  // Directions & city
  [/direction|giving.*direction|finding.*way|how.*get.*there|navigate|lost/i, ['directions', 'transportation']],
  [/exploring.*city|explorar.*ciudad|explorando.*ciudad|city.*life|city.*guide/i, ['directions', 'describing-places']],
  [/getting.*around|transport|taxi|bus|metro|train|subway|commut|taking.*bus/i, ['transportation', 'directions']],
  [/places.*town|en.*ciudad|landmarks|street|neighbourhood|neighborhood|barrio|district/i, ['directions', 'landmarks']],

  // Weather & places
  [/weather|clima|temperatura|lluvia|sol|sunny|rainy|cold|hot|forecast/i, ['describing-places']],
  [/describing.*place|sitio|cultural.*site|museum|arte|art|cultura|heritage/i, ['describing-places', 'cultural-vocabulary', 'art']],

  // Grammar tenses
  [/imperfecto|preterit|pretérito|imperfect|past.*tense|tense.*past|past.*events|used.*to/i, ['past-tense']],
  [/future|futuro|going.*to|will.*do|plans.*future|tomorrow|next.*week|upcoming/i, ['future-plans', 'scheduling']],

  // Opinions & formal language
  [/opinion|viewpoint|perspectiv|mi.*opinion|my.*opinion|argumenta|debate|persuad|i.*think|creo.*que/i, ['opinions', 'formal-language']],
  [/formal|professional|respetfu|usted|business.*email|professional.*writing/i, ['formal-language', 'formal-requests']],
  [/polite|courtesy|please|thank.*you|por.*favor|request.*politely|asking.*politely/i, ['polite-requests', 'formal-requests']],

  // Work & professional
  [/job.*interview|interview.*job|entrevista.*trabajo|career|job.*application/i, ['professional-vocabulary', 'formal-language', 'self-introduction']],
  [/office|workplace|trabajo|profesional|business.*lunch|business.*meeting|work.*meeting|meeting.*work/i, ['professional-vocabulary', 'formal-language']],
  [/performance.*review|evaluation.*work|feedback.*work|promotion/i, ['professional-vocabulary', 'expressing-emotions', 'formal-language']],
  [/networking|professional.*event|business.*lunch|work.*social/i, ['professional-vocabulary', 'social-vocabulary', 'formal-language']],

  // Social & emotions
  [/friend|amigo|social|party|house.*party|birthday|celebration|fiesta|gathering|event/i, ['social-vocabulary', 'expressing-emotions']],
  [/celebrating|celebrations?|holiday|carnival|carnaval|festival/i, ['celebrations', 'cultural-vocabulary', 'expressing-emotions']],
  [/emotion|feeling|sentimiento|happy|sad|angr|excit|nervous|anxious|proud/i, ['expressing-emotions', 'social-vocabulary']],
  [/preference|prefer|favorite|favorito|would.*rather|gustaria|which.*do.*you/i, ['preferences', 'describing-preferences']],

  // Family & introductions
  [/family|familia|relative|parent|madre|padre|hermano|hermana|abuelo|sibling/i, ['family', 'social-vocabulary']],
  [/introduc|self.*intro|about.*me|tell.*about.*yourself|me.*llamo|new.*friend|meet.*people/i, ['self-introduction', 'social-vocabulary']],
  [/greet|hello|hi|saludar|saludo|welcome|nice.*meet/i, ['greetings', 'social-vocabulary']],

  // Medical & body
  [/doctor|médico|médica|clinic|appointment.*doctor|consulta|enferm/i, ['body-parts', 'describing-symptoms', 'formal-requests']],
  [/pharmacy|farmacia|medication|medicine|drug|prescription|pill/i, ['medicine', 'describing-symptoms']],
  [/body|body.*part|anatomy|head|arm|leg|chest|back.*pain|stomach/i, ['body-parts']],
  [/symptom|pain|ache|ill|sick|hurt|fever|cough|cold|sore|feel.*bad|not.*feeling/i, ['describing-symptoms']],
  [/health|salud|wellness|exercise|fitness|bien.*estar/i, ['health']],

  // Time & scheduling
  [/time|hora|clock|what.*time|schedule|appointment|horario|punctual|when.*does/i, ['time', 'scheduling']],
  [/numbers?|número|counting|count|how.*many|math|digit|quantity|quantities/i, ['numbers', 'quantities']],
  [/price|money|cost|costo|precio|cash|pay|currency|change|afford|expensive|cheap/i, ['prices-money', 'prices']],
  [/financial|bank|banking|account|transaction|credit|debit/i, ['financial-vocabulary']],

  // Academic
  [/academic|university|class|study|education|school|student|campus|lecture|homework/i, ['academic-vocabulary', 'education']],
  [/note.*taking|apuntes|write.*notes|study.*skills/i, ['note-taking', 'academic-vocabulary']],
  [/question|asking.*question|preguntar|how.*to.*ask/i, ['questions']],

  // Cooking & instructions
  [/cooking|cocinar|recipe|ingredient|prepare.*food|how.*to.*cook|kitchen/i, ['kitchen-vocabulary', 'food-vocabulary', 'instructions']],
  [/instruction|how.*to|step.*by.*step|directions.*how|following.*steps/i, ['instructions', 'verbs-of-action']],
  [/verb|action.*verb|doing|activity|action/i, ['verbs-of-action']],

  // Descriptions & objects
  [/describing|description|what.*look.*like|appearance|descript/i, ['descriptions', 'describing-objects']],
  [/lost.*found|found.*object|describe.*object|what.*is.*it/i, ['describing-objects', 'descriptions']],
  [/experience|mi.*experiencia|my.*experience|telling.*story|anecdote/i, ['describing-experiences', 'past-tense']],
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function keywordTag(name: string, description: string): string[] {
  const text = `${name} ${description}`;
  const matched = new Set<string>();

  for (const [pattern, slugs] of KEYWORD_RULES) {
    if (pattern.test(text)) {
      for (const s of slugs) matched.add(s);
    }
  }

  return [...matched];
}

async function batchTagWithGemini(
  lessons: Array<{ id: string; name: string; description: string; lessonType: string }>
): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return results;

    const genAI = new GoogleGenAI({ apiKey });

    const lessonList = lessons.map((l, i) =>
      `${i + 1}. id=${l.id} | type=${l.lessonType} | name="${l.name}" | desc="${(l.description || '').slice(0, 120)}"`
    ).join('\n');

    const prompt = `You are a language curriculum expert. Tag each lesson below with 2-6 relevant topic slugs from the canonical list.

CANONICAL TOPIC SLUGS (only use these exact strings):
${CANONICAL_TOPICS.join(', ')}

LESSONS TO TAG:
${lessonList}

Return a JSON array where each element is:
{"id": "<lesson_id>", "topics": ["slug1", "slug2"]}

Rules:
- Only use slugs from the canonical list above
- 2-6 slugs per lesson
- Choose slugs that best describe the communicative/linguistic content
- For grammar lessons focus on the grammar concept (past-tense, formal-language, etc.)
- For vocabulary lessons include the vocabulary domain (food-vocabulary, colors-descriptors, etc.)
- For conversation lessons include the social function (ordering, polite-requests, directions, etc.)

Return ONLY the JSON array, no explanation.`;

    const response = await genAI.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = response.text || '';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return results;

    const parsed = JSON.parse(match[0]) as Array<{ id: string; topics: string[] }>;
    const validSet = new Set(CANONICAL_TOPICS);

    for (const item of parsed) {
      if (!item.id || !Array.isArray(item.topics)) continue;
      const valid = item.topics.filter((s: unknown) => typeof s === 'string' && validSet.has(s));
      if (valid.length > 0) results.set(item.id, valid);
    }
  } catch (err) {
    console.error('[LessonTagger] Gemini batch error:', err);
  }
  return results;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function tagLessonTopics(): Promise<void> {
  try {
    const db = getSharedDb();

    // Get all lessons without topics across all languages
    const allLessons = await db.select({
      id: curriculumLessons.id,
      name: curriculumLessons.name,
      description: curriculumLessons.description,
      lessonType: curriculumLessons.lessonType,
      topics: curriculumLessons.requiredTopics,
    }).from(curriculumLessons);

    const untagged = allLessons.filter(l => !l.topics || l.topics.length === 0);

    if (untagged.length === 0) {
      console.log('[LessonTagger] All lessons already tagged');
      return;
    }

    console.log(`[LessonTagger] Tagging ${untagged.length} untagged lessons...`);

    let keywordHits = 0;
    let geminiHits = 0;
    let skipped = 0;
    const needsGemini: typeof untagged = [];

    // Pass 1: keyword fast path
    for (const lesson of untagged) {
      const topics = keywordTag(lesson.name, lesson.description || '');
      if (topics.length >= 2) {
        await db.update(curriculumLessons)
          .set({ requiredTopics: topics })
          .where(eq(curriculumLessons.id, lesson.id));
        keywordHits++;
      } else {
        needsGemini.push(lesson);
      }
    }

    console.log(`[LessonTagger] Keyword pass: ${keywordHits} tagged, ${needsGemini.length} need Gemini`);

    // Pass 2: Gemini batch processing (batches of 15)
    const BATCH = 15;
    for (let i = 0; i < needsGemini.length; i += BATCH) {
      const batch = needsGemini.slice(i, i + BATCH);
      const tagMap = await batchTagWithGemini(
        batch.map(l => ({ id: l.id, name: l.name, description: l.description || '', lessonType: l.lessonType }))
      );

      for (const lesson of batch) {
        const topics = tagMap.get(lesson.id) || [];
        if (topics.length > 0) {
          await db.update(curriculumLessons)
            .set({ requiredTopics: topics })
            .where(eq(curriculumLessons.id, lesson.id));
          geminiHits++;
        } else {
          skipped++;
        }
      }

      // Small delay between batches to avoid rate limits
      if (i + BATCH < needsGemini.length) {
        await new Promise(r => setTimeout(r, 800));
      }
    }

    const total = keywordHits + geminiHits;
    console.log(`[LessonTagger] Complete: ${total} tagged (${keywordHits} keyword, ${geminiHits} Gemini), ${skipped} skipped`);

  } catch (error) {
    console.error('[LessonTagger] Error:', error);
  }
}
