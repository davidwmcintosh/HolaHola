/**
 * Wikivoyage Service
 *
 * Fetches travel phrases, phrasebook content, and destination context from
 * English Wikivoyage and target-language Wikivoyage editions.
 *
 * Two fetch strategies, both run in parallel:
 *   1. Topic search on en.wikivoyage.org — finds destination/activity articles
 *      relevant to the lesson topic and returns the "Phrases" / "Eat" / "Buy"
 *      sections, which contain authentic target-language phrases inline.
 *   2. Language phrasebook on en.wikivoyage.org — the canonical "{Language}
 *      phrasebook" article has phrases organised by communicative category
 *      (greetings, numbers, food, transport, emergencies, shopping, etc.).
 *      We extract only the sections matching the lesson topic keywords.
 *
 * API: en.wikivoyage.org/w/api.php (CC BY-SA 4.0, no key required)
 */

const EN_WIKIVOYAGE = 'https://en.wikivoyage.org/w/api.php';
const cache = new Map<string, string>();

// Map lesson language names → Wikivoyage phrasebook article titles
const PHRASEBOOK_ARTICLES: Record<string, string> = {
  spanish:    'Spanish phrasebook',
  french:     'French phrasebook',
  german:     'German phrasebook',
  italian:    'Italian phrasebook',
  portuguese: 'Portuguese phrasebook',
  japanese:   'Japanese phrasebook',
  korean:     'Korean phrasebook',
  mandarin:   'Mandarin phrasebook',
  chinese:    'Mandarin phrasebook',
  english:    'English phrasebook',
};

// Keywords that trigger a stronger Wikivoyage fetch (travel/situational content)
const TRAVEL_KEYWORDS = [
  'travel', 'trip', 'restaurant', 'hotel', 'food', 'eat', 'drink', 'buy',
  'shop', 'market', 'transport', 'train', 'bus', 'taxi', 'airport', 'city',
  'museum', 'beach', 'sightseeing', 'tourism', 'directions', 'street',
  'emergency', 'hospital', 'pharmacy', 'money', 'bank', 'check in', 'check-in',
  'reservation', 'booking', 'menu', 'order', 'pay', 'bill', 'receipt',
  'accommodation', 'hostel', 'service', 'help', 'police', 'lost',
  // Spanish/French/German etc. topic keywords
  'restaurante', 'comida', 'viaje', 'ciudad', 'compras',
  'restaurant', 'nourriture', 'voyage', 'ville', 'achats',
  'essen', 'reise', 'bahnhof', 'einkaufen',
];

function hasTravelRelevance(topic: string): boolean {
  const lower = topic.toLowerCase();
  return TRAVEL_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Fetch the text extract of a Wikivoyage article by exact title.
 */
async function fetchArticleExtract(title: string, charLimit = 3000): Promise<string> {
  const params = new URLSearchParams({
    action:    'query',
    format:    'json',
    titles:    title,
    prop:      'extracts',
    exintro:   'false',
    explaintext: 'true',
    exchars:   String(charLimit),
    formatversion: '2',
  });
  const url = `${EN_WIKIVOYAGE}?${params}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'HolaHola/1.0 (language learning platform; contact@holahola.com)' },
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) return '';
  const data = await res.json();
  return (data.query?.pages?.[0]?.extract ?? '').trim();
}

/**
 * Search Wikivoyage for articles matching a topic query and return the best
 * extract.
 */
async function searchWikivoyage(query: string, charLimit = 2000): Promise<string> {
  const searchParams = new URLSearchParams({
    action:   'opensearch',
    format:   'json',
    search:   query,
    limit:    '3',
    namespace: '0',
  });
  const searchUrl = `${EN_WIKIVOYAGE}?${searchParams}`;
  const searchRes = await fetch(searchUrl, {
    headers: { 'User-Agent': 'HolaHola/1.0 (language learning platform)' },
    signal: AbortSignal.timeout(3000),
  });
  if (!searchRes.ok) return '';
  const [, titles] = await searchRes.json();
  if (!titles || titles.length === 0) return '';

  const extract = await fetchArticleExtract(titles[0], charLimit);
  return extract;
}

/**
 * Extract sections from a phrasebook article that are relevant to the given
 * topic keywords. Returns a trimmed block with the matching sections.
 */
function extractRelevantPhrasebookSections(fullText: string, topicKeywords: string[]): string {
  const lines = fullText.split('\n');
  const sections: string[] = [];
  let currentSection: string[] = [];
  let currentHeading = '';
  let inRelevantSection = false;

  for (const line of lines) {
    const isHeading = /^={1,3}[^=]/.test(line);
    if (isHeading) {
      // Save previous section if it was relevant
      if (inRelevantSection && currentSection.length > 0) {
        sections.push(`${currentHeading}\n${currentSection.join('\n').trim()}`);
      }
      currentHeading = line.trim();
      currentSection = [];
      const headingLower = currentHeading.toLowerCase();
      // Always include key practical sections + topic-matched sections
      const alwaysInclude = [
        'greeting', 'phrase', 'get in', 'get around', 'eat', 'drink',
        'buy', 'sleep', 'cope', 'essential', 'basic',
      ];
      inRelevantSection =
        alwaysInclude.some(kw => headingLower.includes(kw)) ||
        topicKeywords.some(kw => headingLower.includes(kw.toLowerCase()));
    } else if (inRelevantSection) {
      currentSection.push(line);
    }
  }
  // Don't forget the last section
  if (inRelevantSection && currentSection.length > 0) {
    sections.push(`${currentHeading}\n${currentSection.join('\n').trim()}`);
  }

  return sections.slice(0, 6).join('\n\n').slice(0, 2500);
}

/**
 * Main export: fetch Wikivoyage phrases relevant to a lesson topic.
 *
 * Returns a formatted string ready to paste into the Gemini prompt. Returns ''
 * if the topic has no meaningful travel/situational relevance.
 */
export async function fetchWikivoyagePhrases(
  topic:    string,
  language: string,
): Promise<string> {
  const cacheKey = `${language}:${topic.toLowerCase().slice(0, 60)}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const topicKeywords = topic.toLowerCase().split(/[\s,;]+/).filter(w => w.length > 3);
  const phrasebookTitle = PHRASEBOOK_ARTICLES[language.toLowerCase()] ?? '';

  try {
    const [topicExtract, phrasebookFull] = await Promise.all([
      // Only search topic articles when the topic has travel relevance
      hasTravelRelevance(topic)
        ? searchWikivoyage(topic, 2000)
        : Promise.resolve(''),

      // Always fetch phrasebook (it's always useful for language lessons)
      phrasebookTitle
        ? fetchArticleExtract(phrasebookTitle, 8000)
        : Promise.resolve(''),
    ]);

    const phrasebookRelevant = phrasebookFull
      ? extractRelevantPhrasebookSections(phrasebookFull, topicKeywords)
      : '';

    const parts: string[] = [];
    if (topicExtract) {
      parts.push(`== Wikivoyage: Topic article ("${topic}") ==\n${topicExtract.slice(0, 1500)}`);
    }
    if (phrasebookRelevant) {
      parts.push(`== Wikivoyage: ${phrasebookTitle} (relevant sections) ==\n${phrasebookRelevant}`);
    }

    const result = parts.join('\n\n').trim();
    cache.set(cacheKey, result);
    return result;
  } catch (err: any) {
    console.warn('[Wikivoyage] Fetch error:', err.message);
    return '';
  }
}
