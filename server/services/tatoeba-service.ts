/**
 * Tatoeba Service
 *
 * Fetches natural example sentences from tatoeba.org for a given word/phrase
 * and target language. Each sentence comes with its English translation.
 *
 * API: tatoeba.org/api_v0/search (CC BY 2.0, no key required)
 */

const TATOEBA_API = 'https://tatoeba.org/api_v0/search';

const LANGUAGE_CODES: Record<string, string> = {
  spanish:    'spa',
  french:     'fra',
  german:     'deu',
  italian:    'ita',
  portuguese: 'por',
  japanese:   'jpn',
  korean:     'kor',
  mandarin:   'cmn',
  chinese:    'cmn',
  english:    'eng',
};

export interface TatoebaSentence {
  id:          number;
  target:      string; // Sentence in the target language
  translation: string; // English translation
}

const cache = new Map<string, TatoebaSentence[]>();

export async function fetchTatoebaSentences(
  query:    string,
  language: string,
  limit:    number = 5
): Promise<TatoebaSentence[]> {
  const langCode = LANGUAGE_CODES[language.toLowerCase()] ?? 'spa';
  const cacheKey = `${langCode}:${query.toLowerCase()}:${limit}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  try {
    const params = new URLSearchParams({
      query,
      from:      langCode,
      to:        'eng',
      max_count: String(Math.min(limit, 10)),
    });

    const res = await fetch(`${TATOEBA_API}?${params}`, {
      headers: { Accept: 'application/json' },
      signal:  AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];

    const data = await res.json() as {
      results?: Array<{
        id:           number;
        text:         string;
        translations: Array<Array<{ text: string; lang: string }>>;
      }>
    };

    const sentences: TatoebaSentence[] = (data.results ?? [])
      .slice(0, limit)
      .map((r) => {
        // Translations come as nested arrays; find the English one
        const engTranslation = r.translations
          .flat()
          .find((t) => t.lang === 'eng')?.text ?? '';
        return {
          id:          r.id,
          target:      r.text,
          translation: engTranslation,
        };
      })
      .filter((s) => s.target && s.translation);

    cache.set(cacheKey, sentences);
    return sentences;
  } catch {
    return [];
  }
}

export async function fetchTatoebaForVocabulary(
  words:    string[],
  language: string,
  perWord:  number = 3
): Promise<Record<string, TatoebaSentence[]>> {
  const results: Record<string, TatoebaSentence[]> = {};
  await Promise.all(
    words.slice(0, 10).map(async (word) => {
      results[word] = await fetchTatoebaSentences(word, language, perWord);
    })
  );
  return results;
}
