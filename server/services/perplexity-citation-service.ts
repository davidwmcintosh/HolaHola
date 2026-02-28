/**
 * Perplexity Citation Service
 *
 * Enriches reading module content with sourced academic citations.
 * Uses Perplexity's online LLM which has live web access to find
 * and attach verifiable sources to factual claims.
 */

interface CitationResult {
  enrichedContent: string;
  citations: string[];
}

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const MODEL = 'sonar-pro';

const DOMAIN_FILTERS: Record<string, string[]> = {
  biology: [
    'ncbi.nlm.nih.gov',
    'pubmed.ncbi.nlm.nih.gov',
    'khanacademy.org',
    'biology.arizona.edu',
  ],
  history: [
    'loc.gov',
    'history.com',
    'britannica.com',
    'archives.gov',
  ],
  language: [
    'spanishdict.com',
    'rae.es',
    'wordreference.com',
  ],
};

function buildSystemPrompt(subject: string): string {
  const domainNote = DOMAIN_FILTERS[subject]
    ? `Prefer sources from these domains: ${DOMAIN_FILTERS[subject].join(', ')}.`
    : 'Prefer .edu and .gov academic sources.';

  return `You are an academic citation assistant helping verify and source educational content for high school students.

Your task: Given educational content about ${subject}, identify the 3-5 most important factual claims and return:
1. The same content with [1], [2], etc. citation markers appended inline to the relevant claims
2. A numbered list of sources at the end labeled "Sources:"

Rules:
- Only add citations to verifiable factual claims (not definitions or explanations)
- Keep the original content structure intact — do not rewrite or summarize it
- Use real, accessible URLs that students can click
- ${domainNote}
- If a claim cannot be sourced confidently, do not add a citation marker to it
- Format the sources list as: [N] Title — URL`;
}

function extractCitations(text: string): string[] {
  const sourcesMatch = text.match(/Sources?:\s*([\s\S]+)$/i);
  if (!sourcesMatch) return [];

  const sourcesBlock = sourcesMatch[1];
  const lines = sourcesBlock.split('\n').filter(l => l.trim());
  const urls: string[] = [];

  for (const line of lines) {
    const urlMatch = line.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      urls.push(urlMatch[0].replace(/[.,)]+$/, ''));
    }
  }

  return urls;
}

export async function addCitations(
  content: string,
  subject: string
): Promise<CitationResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    console.warn('[PerplexityCitations] PERPLEXITY_API_KEY not set — skipping citation enrichment');
    return { enrichedContent: content, citations: [] };
  }

  try {
    const response = await fetch(PERPLEXITY_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt(subject),
          },
          {
            role: 'user',
            content: `Please add citations to the following ${subject} educational content:\n\n${content}`,
          },
        ],
        temperature: 0.1,
        top_p: 0.9,
        return_images: false,
        return_related_questions: false,
        search_recency_filter: 'year',
        stream: false,
        frequency_penalty: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PerplexityCitations] API error:', response.status, errorText);
      return { enrichedContent: content, citations: [] };
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const enrichedContent = data.choices?.[0]?.message?.content ?? content;
    const citations = extractCitations(enrichedContent);

    return { enrichedContent, citations };
  } catch (error) {
    console.error('[PerplexityCitations] Request failed:', error);
    return { enrichedContent: content, citations: [] };
  }
}
