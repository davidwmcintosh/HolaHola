/**
 * Wolfram Fact Verification Service
 *
 * Uses Wolfram Alpha's LLM API to verify quantitative and scientific facts.
 * The LLM API returns concise, computation-verified answers optimized for
 * AI consumption — ideal for spot-checking Gene's biology claims.
 *
 * Primarily used for: atomic masses, chromosome counts, enzyme ratios,
 * population figures, physical constants, and historical dates.
 */

interface FactResult {
  answer: string;
  verified: boolean;
}

const WOLFRAM_LLM_API = 'https://www.wolframalpha.com/api/v1/llm-api';

export async function verifyFact(query: string): Promise<FactResult> {
  const appId = process.env.WOLFRAM_APP_ID;

  if (!appId) {
    console.warn('[WolframFact] WOLFRAM_APP_ID not set — skipping fact verification');
    return { answer: '', verified: false };
  }

  try {
    const url = `${WOLFRAM_LLM_API}?appid=${encodeURIComponent(appId)}&input=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/plain',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error('[WolframFact] API error:', response.status, response.statusText);
      return { answer: '', verified: false };
    }

    const answer = (await response.text()).trim();

    if (!answer || answer.toLowerCase().includes('wolfram|alpha did not understand')) {
      return { answer: '', verified: false };
    }

    return { answer, verified: true };
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.warn('[WolframFact] Request timed out for query:', query);
    } else {
      console.error('[WolframFact] Request failed:', error);
    }
    return { answer: '', verified: false };
  }
}

/**
 * Extract verifiable quantitative claims from reading module content.
 * Returns a list of query strings suitable for Wolfram verification.
 */
export function extractVerifiableClaims(content: string, subject: string): string[] {
  const claims: string[] = [];

  if (subject === 'biology') {
    const patterns = [
      /(\d+)\s+chromosomes?/gi,
      /atomic (?:mass|weight|number) of (\w+)/gi,
      /(\d+(?:\.\d+)?)\s*(?:km|m|nm|μm|mm)\s+(?:long|wide|tall|in size)/gi,
      /approximately (\d[\d,]*)\s+(?:species|genes|base pairs|nucleotides)/gi,
    ];

    for (const pattern of patterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        claims.push(match[0].replace(/\s+/g, ' ').trim());
        if (claims.length >= 3) break;
      }
      if (claims.length >= 3) break;
    }
  }

  if (subject === 'history') {
    const patterns = [
      /in (\d{4}),\s+[\w\s]+(?:signed|declared|began|ended|founded)/gi,
      /population of [\w\s]+ was (?:approximately |around )?(\d[\d,]*)/gi,
    ];

    for (const pattern of patterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        claims.push(match[0].replace(/\s+/g, ' ').trim());
        if (claims.length >= 2) break;
      }
      if (claims.length >= 2) break;
    }
  }

  return claims.slice(0, 3);
}
