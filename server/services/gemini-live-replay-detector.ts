/**
 * Find an exact, substantial replay that starts at the response beginning.
 * Short repeated teaching phrases are intentionally below these thresholds.
 */
export function findImmediateSubstantialReplay(text: string): number | null {
  const tokenPattern = /[\p{L}\p{N}']+/gu;
  const tokens = [...text.matchAll(tokenPattern)];
  const minimumReplayTokens = 20;
  if (tokens.length < minimumReplayTokens * 2) return null;
  const first = tokens.slice(0, minimumReplayTokens).map(m => m[0].toLocaleLowerCase());
  const firstSpan = (tokens[minimumReplayTokens - 1].index ?? 0) + tokens[minimumReplayTokens - 1][0].length;
  if (firstSpan < 100 || new Set(first).size < 10) return null;
  for (let i = minimumReplayTokens; i <= tokens.length - minimumReplayTokens; i++) {
    const candidate = tokens.slice(i, i + minimumReplayTokens).map(m => m[0].toLocaleLowerCase());
    if (candidate.every((token, index) => token === first[index])) {
      const replayAt = tokens[i].index ?? 0;
      if (replayAt <= text.length * 0.75) return replayAt;
    }
  }
  return null;
}