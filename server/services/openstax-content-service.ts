/**
 * Seed Content Service
 *
 * Fetches CC-licensed encyclopedic content to use as grounding material
 * for reading module generation. Wikipedia's REST API provides clean,
 * structured plain text for any topic (CC BY-SA 4.0).
 *
 * OpenStax is the editorial standard for our curriculum alignment
 * (NGSS for biology, C3 for history), but Wikipedia's API is used as
 * the practical seed source because it returns clean plain text directly
 * without HTML parsing, covers every topic, and requires no key.
 *
 * Topic → Wikipedia article matching uses Wikimedia's search API,
 * then fetches the full page extract as plain text.
 */

type SubjectDomain = 'biology' | 'history';

const WIKIPEDIA_SEARCH_API = 'https://en.wikipedia.org/w/api.php';

const contentCache = new Map<string, string>();

const SUBJECT_CONTEXT: Record<SubjectDomain, string> = {
  biology: 'biology',
  history: 'history',
};

async function searchWikipedia(query: string, subject: SubjectDomain): Promise<string | null> {
  const searchQuery = `${query} ${SUBJECT_CONTEXT[subject]}`;

  try {
    const searchParams = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: searchQuery,
      srlimit: '3',
      format: 'json',
      origin: '*',
    });

    const searchResponse = await fetch(`${WIKIPEDIA_SEARCH_API}?${searchParams}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!searchResponse.ok) return null;

    const searchData = await searchResponse.json() as {
      query: { search: Array<{ title: string; snippet: string }> }
    };

    const results = searchData?.query?.search ?? [];
    if (results.length === 0) return null;

    return results[0].title;
  } catch {
    return null;
  }
}

async function fetchWikipediaExtract(title: string): Promise<string> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      prop: 'extracts',
      titles: title,
      exintro: 'false',
      explaintext: 'true',
      exsectionformat: 'plain',
      exlimit: '1',
      format: 'json',
      origin: '*',
    });

    const response = await fetch(`${WIKIPEDIA_SEARCH_API}?${params}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return '';

    const data = await response.json() as {
      query: { pages: Record<string, { extract?: string }> }
    };

    const pages = data?.query?.pages ?? {};
    const page = Object.values(pages)[0];
    const extract = page?.extract ?? '';

    return extract
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 5000);
  } catch {
    return '';
  }
}

export async function fetchSeedContent(
  topic: string,
  subject: SubjectDomain
): Promise<string> {
  const cacheKey = `${subject}:${topic.toLowerCase()}`;
  if (contentCache.has(cacheKey)) {
    return contentCache.get(cacheKey)!;
  }

  const articleTitle = await searchWikipedia(topic, subject);
  if (!articleTitle) {
    console.info(`[SeedContent] No Wikipedia article found for: "${topic}" (${subject})`);
    return '';
  }

  console.info(`[SeedContent] Wikipedia article: "${articleTitle}" for topic: "${topic}"`);
  const content = await fetchWikipediaExtract(articleTitle);

  if (content) {
    contentCache.set(cacheKey, content);
    console.info(`[SeedContent] Fetched ${content.length} chars for "${topic}"`);
  }

  return content;
}
