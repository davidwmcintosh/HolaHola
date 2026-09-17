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
    // The repeated passage must occupy a large, immediate suffix. This is
    // intentionally stricter than "opening words recur somewhere": a later
    // return to an opening passage after intervening content must survive.
    if (candidate.every((token, index) => token === first[index])
      && i <= tokens.length * 0.55
      && tokens.length - i >= tokens.length * 0.45) {
      const replayAt = tokens[i].index ?? 0;
      if (replayAt <= text.length * 0.75) return replayAt;
    }
  }
  return null;
}

export class TurnReplayGuard {
  private transcript = '';
  private suppressed = false;
  private responseStarted = false;
  private droppedPcmChunks = 0;
  private droppedPcmDurationMs = 0;

  appendTranscript(text: string): { acceptedText: string; replayConfirmed: boolean } {
    this.beginResponse();
    if (this.suppressed) return { acceptedText: '', replayConfirmed: false };
    const prior = this.transcript;
    const candidate = prior + text;
    const replayAt = findImmediateSubstantialReplay(candidate);
    if (replayAt === null) {
      this.transcript = candidate;
      return { acceptedText: text, replayConfirmed: false };
    }
    this.transcript = candidate.slice(0, replayAt);
    this.suppressed = true;
    const acceptedText = prior.length === 0
      ? this.transcript
      : this.transcript.length > prior.length
        ? this.transcript.slice(prior.length)
        : '';
    return {
      acceptedText,
      replayConfirmed: true,
    };
  }

  beginResponse(): void {
    if (this.responseStarted) return;
    this.responseStarted = true;
  }

  shouldDropPcm(durationMs: number): boolean {
    if (!this.suppressed) return false;
    this.droppedPcmChunks++;
    this.droppedPcmDurationMs += durationMs;
    return true;
  }

  isSuppressed(): boolean { return this.suppressed; }
  get transcriptText(): string { return this.transcript; }
  get telemetry(): { droppedPcmChunks: number; droppedPcmDurationMs: number } {
    return { droppedPcmChunks: this.droppedPcmChunks, droppedPcmDurationMs: this.droppedPcmDurationMs };
  }
  reset(): void {
    this.transcript = '';
    this.responseStarted = false;
    this.suppressed = false;
    this.droppedPcmChunks = 0;
    this.droppedPcmDurationMs = 0;
  }
}