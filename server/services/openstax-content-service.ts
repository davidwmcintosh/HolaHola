/**
 * OpenStax Content Service
 *
 * Fetches CC-licensed, curriculum-aligned textbook content from OpenStax
 * to use as seed material for reading module generation.
 *
 * Biology 2e is NGSS-aligned. US History / World History are C3-aligned.
 * All content is CC BY 4.0 licensed — free to use and adapt.
 */

interface OpenStaxPage {
  title: string;
  slug: string;
  content?: string;
}

interface OpenStaxTocEntry {
  title: string;
  slug: string;
  contents?: OpenStaxTocEntry[];
}

type SubjectDomain = 'biology' | 'history';

const BOOK_SLUGS: Record<SubjectDomain, string[]> = {
  biology: ['biology-2e'],
  history: ['us-history', 'world-history-volume-1', 'world-history-volume-2'],
};

const OPENSTAX_API = 'https://openstax.org/apps/archive/20250403.172233/api/v0';

const tocCache = new Map<string, OpenStaxTocEntry[]>();
const contentCache = new Map<string, string>();

async function fetchToc(bookSlug: string): Promise<OpenStaxTocEntry[]> {
  if (tocCache.has(bookSlug)) {
    return tocCache.get(bookSlug)!;
  }

  try {
    const response = await fetch(`${OPENSTAX_API}/books/${bookSlug}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`[OpenStax] Could not fetch TOC for ${bookSlug}: ${response.status}`);
      return [];
    }

    const data = await response.json() as { tree?: { contents?: OpenStaxTocEntry[] } };
    const entries = data?.tree?.contents ?? [];
    tocCache.set(bookSlug, entries);
    return entries;
  } catch (error) {
    console.warn(`[OpenStax] TOC fetch failed for ${bookSlug}:`, error);
    return [];
  }
}

function flattenToc(entries: OpenStaxTocEntry[]): OpenStaxPage[] {
  const pages: OpenStaxPage[] = [];

  for (const entry of entries) {
    if (entry.slug) {
      pages.push({ title: entry.title, slug: entry.slug });
    }
    if (entry.contents) {
      pages.push(...flattenToc(entry.contents));
    }
  }

  return pages;
}

function scorePage(page: OpenStaxPage, topic: string): number {
  const topicWords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const titleLower = page.title.toLowerCase();
  let score = 0;

  for (const word of topicWords) {
    if (titleLower.includes(word)) {
      score += titleLower.startsWith(word) ? 3 : 2;
    }
  }

  return score;
}

async function fetchPageContent(bookSlug: string, pageSlug: string): Promise<string> {
  const cacheKey = `${bookSlug}:${pageSlug}`;
  if (contentCache.has(cacheKey)) {
    return contentCache.get(cacheKey)!;
  }

  try {
    const response = await fetch(
      `${OPENSTAX_API}/books/${bookSlug}/pages/${pageSlug}`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      console.warn(`[OpenStax] Could not fetch page ${pageSlug}: ${response.status}`);
      return '';
    }

    const data = await response.json() as { content?: string };
    const rawHtml = data?.content ?? '';

    const plainText = rawHtml
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 4000);

    contentCache.set(cacheKey, plainText);
    return plainText;
  } catch (error) {
    console.warn(`[OpenStax] Page content fetch failed for ${pageSlug}:`, error);
    return '';
  }
}

export async function fetchSeedContent(
  topic: string,
  subject: SubjectDomain
): Promise<string> {
  const bookSlugs = BOOK_SLUGS[subject] ?? [];

  let bestPage: OpenStaxPage | null = null;
  let bestScore = 0;
  let bestBookSlug = '';

  for (const bookSlug of bookSlugs) {
    const toc = await fetchToc(bookSlug);
    const pages = flattenToc(toc);

    for (const page of pages) {
      const score = scorePage(page, topic);
      if (score > bestScore) {
        bestScore = score;
        bestPage = page;
        bestBookSlug = bookSlug;
      }
    }
  }

  if (!bestPage || bestScore === 0) {
    console.info(`[OpenStax] No matching chapter found for topic: "${topic}" (${subject})`);
    return '';
  }

  console.info(`[OpenStax] Using "${bestPage.title}" from ${bestBookSlug} for topic: "${topic}" (score: ${bestScore})`);
  return fetchPageContent(bestBookSlug, bestPage.slug);
}
