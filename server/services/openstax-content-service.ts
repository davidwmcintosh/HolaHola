/**
 * Seed Content Service
 *
 * Fetches CC-licensed encyclopedic content and images to use as grounding
 * material for reading module generation. Wikipedia's REST API provides clean,
 * structured plain text and freely licensed images for any topic (CC BY-SA 4.0).
 *
 * OpenStax is the editorial standard for our curriculum alignment
 * (NGSS for biology, C3 for history), but Wikipedia's API is used as
 * the practical seed source because it returns clean plain text directly
 * without HTML parsing, covers every topic, and requires no key.
 *
 * Topic → Wikipedia article matching uses Wikimedia's search API,
 * then fetches the full page extract as plain text plus gallery images.
 */

type SubjectDomain = 'biology' | 'history';

export interface WikipediaImage {
  url: string;
  caption?: string;
  altText?: string;
  width?: number;
  height?: number;
}

const WIKIPEDIA_SEARCH_API = 'https://en.wikipedia.org/w/api.php';
const WIKIPEDIA_REST_API = 'https://en.wikipedia.org/api/rest_v1';

const contentCache = new Map<string, string>();
const imageCache = new Map<string, WikipediaImage[]>();

const SUBJECT_CONTEXT: Record<SubjectDomain, string> = {
  biology: 'biology',
  history: 'history',
};

async function searchWikipedia(query: string, subject: SubjectDomain): Promise<string | null> {
  // Try the exact topic first — this gets the right article most of the time
  // (e.g. "cell division" → "Cell division", not "Aster (cell biology)")
  const attempts = [query, `${query} ${SUBJECT_CONTEXT[subject]}`];

  for (const searchQuery of attempts) {
    try {
      const searchParams = new URLSearchParams({
        action: 'query',
        list: 'search',
        srsearch: searchQuery,
        srlimit: '5',
        format: 'json',
        origin: '*',
      });

      const searchResponse = await fetch(`${WIKIPEDIA_SEARCH_API}?${searchParams}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });

      if (!searchResponse.ok) continue;

      const searchData = await searchResponse.json() as {
        query: { search: Array<{ title: string; snippet: string }> }
      };

      const results = searchData?.query?.search ?? [];
      if (results.length === 0) continue;

      // Prefer an exact title match (case-insensitive) if one exists in top results
      const exactMatch = results.find(
        r => r.title.toLowerCase() === query.toLowerCase()
      );
      if (exactMatch) return exactMatch.title;

      // Otherwise return best result from first attempt only
      if (searchQuery === query) return results[0].title;

    } catch {
      continue;
    }
  }

  return null;
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

function isUsableImage(item: {
  type?: string;
  title?: string;
  showInGallery?: boolean;
  srcset?: Array<{ src: string; scale: string }>;
  original?: { source: string; width?: number; height?: number };
  width?: number;
  height?: number;
}): boolean {
  if (item.type !== 'image') return false;
  const title = item.title ?? '';
  const src = item.srcset?.[0]?.src ?? item.original?.source ?? '';
  if (/\.svg$/i.test(title) || /\.svg/i.test(src)) return false;
  if (/icon|flag|logo|symbol|map|blank|locator|wikimedia|commons-logo/i.test(title)) return false;
  const w = item.original?.width ?? item.width ?? 0;
  const h = item.original?.height ?? item.height ?? 0;
  if (w > 0 && w < 150) return false;
  if (h > 0 && h < 100) return false;
  return true;
}

export async function fetchWikipediaImages(title: string): Promise<WikipediaImage[]> {
  const cacheKey = title.toLowerCase();
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)!;
  }

  const images: WikipediaImage[] = [];

  try {
    const encodedTitle = encodeURIComponent(title.replace(/ /g, '_'));

    const summaryResponse = await fetch(
      `${WIKIPEDIA_REST_API}/page/summary/${encodedTitle}`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000),
      }
    );

    if (summaryResponse.ok) {
      const summary = await summaryResponse.json() as {
        thumbnail?: { source: string; width?: number; height?: number };
        originalimage?: { source: string; width?: number; height?: number };
        description?: string;
        title?: string;
      };

      const imgSrc = summary.originalimage?.source ?? summary.thumbnail?.source;
      if (imgSrc && !/\.svg/i.test(imgSrc)) {
        const w = summary.originalimage?.width ?? summary.thumbnail?.width;
        const h = summary.originalimage?.height ?? summary.thumbnail?.height;
        if (!w || w >= 150) {
          images.push({
            url: imgSrc.startsWith('//') ? `https:${imgSrc}` : imgSrc,
            caption: summary.description ?? summary.title,
            altText: summary.title,
            width: w,
            height: h,
          });
        }
      }
    }
  } catch (err) {
    console.info('[SeedContent] Summary image fetch failed:', err);
  }

  try {
    const encodedTitle = encodeURIComponent(title.replace(/ /g, '_'));
    const mediaResponse = await fetch(
      `${WIKIPEDIA_REST_API}/page/media-list/${encodedTitle}`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (mediaResponse.ok) {
      const mediaData = await mediaResponse.json() as {
        items?: Array<{
          type?: string;
          title?: string;
          showInGallery?: boolean;
          srcset?: Array<{ src: string; scale: string }>;
          original?: { source: string; width?: number; height?: number };
          caption?: { text?: string };
          alt?: string;
          width?: number;
          height?: number;
        }>;
      };

      const galleryItems = (mediaData.items ?? [])
        .filter(isUsableImage)
        .filter(item => item.showInGallery !== false)
        .slice(0, 6);

      for (const item of galleryItems) {
        const src = item.original?.source ?? item.srcset?.[0]?.src;
        if (!src) continue;

        const url = src.startsWith('//') ? `https:${src}` : src;
        const alreadyHave = images.some(img => img.url === url);
        if (alreadyHave) continue;

        images.push({
          url,
          caption: item.caption?.text,
          altText: item.alt ?? item.title,
          width: item.original?.width ?? item.width,
          height: item.original?.height ?? item.height,
        });

        if (images.length >= 3) break;
      }
    }
  } catch (err) {
    console.info('[SeedContent] Media-list fetch failed:', err);
  }

  imageCache.set(cacheKey, images);
  console.info(`[SeedContent] Fetched ${images.length} images for "${title}"`);
  return images;
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

export async function fetchSeedAndImages(
  topic: string,
  subject: SubjectDomain
): Promise<{ text: string; images: WikipediaImage[]; articleTitle: string | null }> {
  const articleTitle = await searchWikipedia(topic, subject);

  if (!articleTitle) {
    console.info(`[SeedContent] No Wikipedia article found for: "${topic}" (${subject})`);
    return { text: '', images: [], articleTitle: null };
  }

  console.info(`[SeedContent] Wikipedia article: "${articleTitle}" for topic: "${topic}"`);

  const [text, images] = await Promise.all([
    fetchWikipediaExtract(articleTitle),
    fetchWikipediaImages(articleTitle),
  ]);

  if (text) {
    const cacheKey = `${subject}:${topic.toLowerCase()}`;
    contentCache.set(cacheKey, text);
    console.info(`[SeedContent] Fetched ${text.length} chars + ${images.length} images for "${topic}"`);
  }

  return { text, images, articleTitle };
}
