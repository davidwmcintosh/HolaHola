/**
 * Scenario Topic Enrichment Seeder
 * Auto-tags scenarios with curriculumTopics by matching against existing lesson topic slugs.
 * Runs at startup and only processes scenarios with empty curriculumTopics arrays.
 */

import { getSharedDb } from './db';
import { scenarios, curriculumLessons } from '../shared/schema';
import { eq, isNull, or } from 'drizzle-orm';

const GEMINI_MODEL = 'gemini-2.0-flash';

// Known mappings for common scenarios (fast path — no LLM needed)
const KNOWN_TOPIC_MAPS: Record<string, string[]> = {
  'coffee-shop': ['greetings', 'numbers', 'ordering', 'food-vocabulary', 'polite-requests', 'prices-money'],
  'grocery-store': ['numbers', 'food-vocabulary', 'prices-money', 'quantities', 'shopping'],
  'pharmacy': ['numbers', 'health-vocabulary', 'body-parts', 'polite-requests', 'describing-symptoms'],
  'restaurant': ['ordering', 'food-vocabulary', 'numbers', 'prices-money', 'polite-requests'],
  'airport': ['travel-vocabulary', 'directions', 'numbers', 'time-expressions', 'polite-requests'],
  'hotel': ['travel-vocabulary', 'numbers', 'polite-requests', 'describing-preferences'],
  'doctor-office': ['health-vocabulary', 'body-parts', 'describing-symptoms', 'polite-requests'],
  'hospital': ['health-vocabulary', 'body-parts', 'describing-symptoms', 'emergency-vocabulary'],
  'bank': ['numbers', 'prices-money', 'polite-requests', 'business-vocabulary'],
  'job-interview': ['professional-vocabulary', 'work-vocabulary', 'describing-yourself', 'formal-register'],
  'school': ['classroom-vocabulary', 'greetings', 'describing-yourself', 'time-expressions'],
  'post-office': ['numbers', 'prices-money', 'polite-requests', 'directions'],
  'market': ['food-vocabulary', 'numbers', 'prices-money', 'bargaining', 'quantities'],
  'museum': ['cultural-vocabulary', 'describing-places', 'polite-requests', 'opinions'],
  'park': ['nature-vocabulary', 'leisure-vocabulary', 'weather', 'describing-activities'],
  'apartment': ['household-vocabulary', 'describing-places', 'numbers', 'directions'],
  'transportation': ['travel-vocabulary', 'directions', 'numbers', 'time-expressions'],
  'phone-call': ['phone-vocabulary', 'polite-requests', 'making-plans', 'formal-register'],
  'party': ['social-vocabulary', 'greetings', 'food-vocabulary', 'making-plans'],
  'sports': ['sports-vocabulary', 'leisure-vocabulary', 'describing-activities', 'past-tense'],
  'shopping-mall': ['shopping', 'clothing-vocabulary', 'numbers', 'prices-money', 'describing-preferences'],
  'clothes-shopping': ['clothing-vocabulary', 'shopping', 'colors', 'numbers', 'prices-money'],
  'car-rental': ['travel-vocabulary', 'numbers', 'prices-money', 'directions'],
  'gas-station': ['travel-vocabulary', 'numbers', 'prices-money'],
  'emergency': ['emergency-vocabulary', 'health-vocabulary', 'directions', 'numbers'],
};

async function getAvailableTopicSlugs(): Promise<string[]> {
  const db = getSharedDb();
  const rows = await db.select({ topics: curriculumLessons.requiredTopics }).from(curriculumLessons);
  const slugSet = new Set<string>();
  for (const row of rows) {
    for (const slug of row.topics || []) {
      slugSet.add(slug);
    }
  }
  return [...slugSet].sort();
}

async function tagScenarioWithGemini(
  scenarioName: string,
  scenarioDescription: string,
  availableTopics: string[]
): Promise<string[]> {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return [];

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const prompt = `You are a language curriculum expert. Given a language-learning scenario and a list of curriculum topic slugs, identify which topics are most relevant to this scenario.

Scenario: "${scenarioName}"
Description: "${scenarioDescription}"

Available topic slugs (choose only from these):
${availableTopics.join(', ')}

Return ONLY a JSON array of 3-6 relevant topic slugs from the list above. No explanation.
Example: ["greetings", "numbers", "food-vocabulary"]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    // Filter to only valid slugs from our list
    const validSet = new Set(availableTopics);
    return parsed.filter((s: unknown) => typeof s === 'string' && validSet.has(s));
  } catch (err) {
    console.error('[Scenario Topics] Gemini tagging error:', err);
    return [];
  }
}

export async function seedScenarioTopics(): Promise<void> {
  try {
    const db = getSharedDb();

    // Find scenarios with empty or null curriculumTopics
    const allScenarios = await db.select({
      id: scenarios.id,
      slug: scenarios.slug,
      title: scenarios.title,
      description: scenarios.description,
      curriculumTopics: scenarios.curriculumTopics,
    }).from(scenarios);

    const untagged = allScenarios.filter(s =>
      !s.curriculumTopics || s.curriculumTopics.length === 0
    );

    if (untagged.length === 0) {
      console.log('[Scenario Topics] All scenarios already have curriculum topics');
      return;
    }

    console.log(`[Scenario Topics] Tagging ${untagged.length} untagged scenarios...`);

    // Get all available topic slugs from curriculum lessons
    const availableTopics = await getAvailableTopicSlugs();

    let tagged = 0;
    let usedKnownMap = 0;
    let usedGemini = 0;

    for (const scenario of untagged) {
      let topics: string[] = [];

      // Try known map first (fast, no LLM cost)
      const knownSlug = scenario.slug?.toLowerCase().replace(/\s+/g, '-');
      if (knownSlug && KNOWN_TOPIC_MAPS[knownSlug]) {
        // Filter to only topics that actually exist in the DB
        const validSet = new Set(availableTopics);
        topics = KNOWN_TOPIC_MAPS[knownSlug].filter(t => validSet.has(t));
        usedKnownMap++;
      }

      // Fall back to Gemini if not in known map or no matches found
      if (topics.length === 0 && availableTopics.length > 0) {
        topics = await tagScenarioWithGemini(
          scenario.title || scenario.slug || '',
          scenario.description || '',
          availableTopics.slice(0, 80) // limit to keep prompt manageable
        );
        if (topics.length > 0) usedGemini++;
      }

      if (topics.length > 0) {
        await db.update(scenarios)
          .set({ curriculumTopics: topics })
          .where(eq(scenarios.id, scenario.id));
        tagged++;
      }
    }

    console.log(`[Scenario Topics] Complete: ${tagged} tagged (${usedKnownMap} from map, ${usedGemini} via Gemini), ${untagged.length - tagged} skipped (no matches)`);
  } catch (error) {
    console.error('[Scenario Topics] Seeding error:', error);
  }
}
