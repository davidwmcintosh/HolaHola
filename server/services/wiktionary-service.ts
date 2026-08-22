/**
 * Wiktionary Service
 *
 * Fetches plain-text vocabulary entries from the English Wiktionary for any
 * target language word. Returns the raw Wiktionary extract which Gemini then
 * parses into structured vocabulary data during textbook seeding.
 *
 * API: en.wiktionary.org/w/api.php (CC BY-SA 4.0, no key required)
 */

const WIKTIONARY_API = 'https://en.wiktionary.org/w/api.php';
const cache = new Map<string, string>();

const LANGUAGE_HEADERS: Record<string, string> = {
  spanish:    'Spanish',
  french:     'French',
  german:     'German',
  italian:    'Italian',
  portuguese: 'Portuguese',
  japanese:   'Japanese',
  korean:     'Korean',
  mandarin:   'Mandarin',
  chinese:    'Chinese',
  english:    'English',
};

export async function fetchWiktionaryEntry(word: string, language: string): Promise<string> {
  const cacheKey = `${language}:${word.toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  try {
    const params = new URLSearchParams({
      action:          'query',
      prop:            'extracts',
      titles:          word,
      exintro:         'false',
      explaintext:     'true',
      exsectionformat: 'plain',
      exlimit:         '1',
      format:          'json',
      origin:          '*',
    });

    const res = await fetch(`${WIKTIONARY_API}?${params}`, {
      headers: { Accept: 'application/json' },
      signal:  AbortSignal.timeout(8000),
    });

    if (!res.ok) return '';

    const data = await res.json() as {
      query: { pages: Record<string, { extract?: string }> }
    };

    const pages = data?.query?.pages ?? {};
    const page  = Object.values(pages)[0];
    const raw   = page?.extract ?? '';

    if (!raw) return '';

    // Trim to the target-language section if present (Wiktionary pages cover many languages)
    const targetHeader = LANGUAGE_HEADERS[language.toLowerCase()] ?? language;
    const sectionStart = raw.indexOf(`\n${targetHeader}\n`);
    const extract = sectionStart >= 0
      ? raw.slice(sectionStart, sectionStart + 4000).trim()
      : raw.slice(0, 3000).trim();

    cache.set(cacheKey, extract);
    return extract;
  } catch {
    return '';
  }
}

export async function fetchWiktionaryEntries(
  words: string[],
  language: string
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  await Promise.all(
    words.slice(0, 12).map(async (word) => {
      results[word] = await fetchWiktionaryEntry(word, language);
    })
  );
  return results;
}
