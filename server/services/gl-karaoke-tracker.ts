/**
 * GL Karaoke Tracker
 *
 * Taps the Gemini Live PCM16 audio output and runs it through a parallel
 * Deepgram STT session to extract word-level timestamps. These are broadcast
 * to the client as `word_timing` WS messages so FloatingSubtitleOverlay can
 * do karaoke-style highlighting during live voice sessions.
 *
 * Architecture:
 *   GL audio output (PCM16 24kHz) ──┬──► client (audio_chunk WS)
 *                                    └──► Deepgram Live STT
 *                                               │
 *                                         word timestamps
 *                                               │
 *                                               └──► word_timing WS ──► client
 *
 * Timing math:
 *   Deepgram returns word.start/word.end as cumulative seconds from the moment
 *   the first byte was sent to the connection. We track the byte offset at
 *   each sentence boundary so we can convert cumulative times to per-sentence
 *   relative times that the existing karaoke player expects.
 *
 *   PCM16 mono 24kHz = 2 bytes/sample × 24,000 samples/s = 48,000 bytes/s
 */

import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import type { WordTiming } from "@shared/streaming-voice-types";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

const BYTES_PER_SECOND = 48000; // PCM16 mono 24kHz

const LANGUAGE_CODE_MAP: Record<string, string> = {
  spanish: 'es',
  french: 'fr',
  portuguese: 'pt-BR',
  german: 'de',
  italian: 'it',
  japanese: 'ja',
  mandarin: 'zh',
  korean: 'ko',
  arabic: 'ar',
  russian: 'ru',
  english: 'en',
};

interface SentenceMeta {
  turnId: number;
  startBytes: number; // Total bytes sent to Deepgram when this sentence began
}

export class GLKaraokeTracker {
  private connection: any = null;
  private isOpen = false;
  private destroyed = false;

  // Byte accounting — cumulative across the full Deepgram connection lifetime
  private totalBytesReceived = 0;

  // Per-sentence metadata: sentenceIndex → { turnId, startBytes }
  private sentenceMeta = new Map<number, SentenceMeta>();
  private currentSentenceIndex = -1; // -1 = not yet started
  private currentTurnId = -1;

  // Accumulated confirmed words per sentence (we replace on each is_final)
  private sentenceWords = new Map<number, WordTiming[]>();

  constructor(
    private targetLanguage: string,
    private sendToClient: (msg: any) => void,
  ) {}

  /** Open the Deepgram connection. Called once when the GL session starts. */
  async start(): Promise<void> {
    if (!DEEPGRAM_API_KEY) {
      console.warn('[GLKaraoke] DEEPGRAM_API_KEY not set — karaoke subtitles disabled');
      return;
    }

    const client = createClient(DEEPGRAM_API_KEY);
    const langCode = LANGUAGE_CODE_MAP[this.targetLanguage.toLowerCase()] ?? 'es';

    this.connection = client.listen.live({
      model: 'nova-3',
      language: langCode,
      punctuate: false,
      smart_format: false,
      interim_results: true,
      encoding: 'linear16',
      sample_rate: 24000,
      channels: 1,
      // Short endpointing: GL sub-turns are short phrases with natural pauses between them.
      // 150ms triggers Deepgram's finalization quickly so timings arrive while audio is still playing.
      endpointing: 150,
    });

    this.connection.on(LiveTranscriptionEvents.Open, () => {
      this.isOpen = true;
      console.log(`[GLKaraoke] Deepgram connected — language: ${langCode}`);
    });

    this.connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
      if (this.destroyed) return;
      const alt = data?.channel?.alternatives?.[0];
      if (!alt?.words?.length) return;

      // Use only is_final results for reliable timings
      if (!data.is_final) return;

      this.handleFinalTranscript(alt.words);
    });

    this.connection.on(LiveTranscriptionEvents.Error, (err: any) => {
      console.warn('[GLKaraoke] Deepgram error:', err?.message ?? String(err));
    });

    this.connection.on(LiveTranscriptionEvents.Close, () => {
      this.isOpen = false;
      console.log('[GLKaraoke] Deepgram connection closed');
    });
  }

  /**
   * Feed a PCM16 audio chunk from the GL session to Deepgram.
   * Must be called for every audio chunk GL emits, before forwarding to the client.
   */
  sendAudioChunk(pcm16Buffer: Buffer, sentenceIndex: number, turnId: number): void {
    if (this.destroyed || !this.isOpen || !this.connection) return;

    const isNewTurn = turnId !== this.currentTurnId;
    const isNewSentence = sentenceIndex !== this.currentSentenceIndex;

    if (isNewTurn || isNewSentence) {
      // Record where this sentence starts in the cumulative byte stream
      this.sentenceMeta.set(sentenceIndex, {
        turnId,
        startBytes: this.totalBytesReceived,
      });
      this.currentSentenceIndex = sentenceIndex;
      this.currentTurnId = turnId;
      console.log(`[GLKaraoke] Sentence ${sentenceIndex} (turn ${turnId}) starts at byte ${this.totalBytesReceived} (${(this.totalBytesReceived / BYTES_PER_SECOND).toFixed(3)}s)`);
    }

    this.totalBytesReceived += pcm16Buffer.length;

    try {
      this.connection.send(pcm16Buffer);
    } catch (e: any) {
      // Ignore send errors — connection may be in transition
    }
  }

  /**
   * Called when a GL sub-turn (sentence) completes — keeps the connection warm
   * during the brief inter-sentence gap so Deepgram doesn't idle-close.
   */
  onSentenceComplete(): void {
    if (this.destroyed || !this.isOpen || !this.connection) return;
    try {
      this.connection.keepAlive();
    } catch (_) {}
  }

  /** Tear down the Deepgram connection when the GL session ends. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.connection) {
      try {
        this.connection.requestClose();
      } catch (_) {}
      this.connection = null;
    }
    this.isOpen = false;
    console.log('[GLKaraoke] Destroyed');
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private handleFinalTranscript(rawWords: any[]): void {
    if (this.currentSentenceIndex < 0) return;

    const sentenceIndex = this.currentSentenceIndex;
    const meta = this.sentenceMeta.get(sentenceIndex);
    if (!meta) return;

    const sentenceStartSecs = meta.startBytes / BYTES_PER_SECOND;

    const words: WordTiming[] = rawWords.map((w: any) => ({
      word: w.word ?? '',
      startTime: Math.max(0, (w.start ?? 0) - sentenceStartSecs),
      endTime: Math.max(0, (w.end ?? 0) - sentenceStartSecs),
    }));

    // Get any already-confirmed words for this sentence (from earlier Deepgram results)
    const existing = this.sentenceWords.get(sentenceIndex) ?? [];
    const startWordIndex = existing.length;

    // Replace with the updated full word list
    this.sentenceWords.set(sentenceIndex, words);

    // Emit new words as word_timing_delta messages — these hook into
    // handleWordTimingDelta on the client which registers words with the
    // audio player in progressive mode (PROGRESSIVE_AUDIO_STREAMING: true).
    const estimatedTotalDuration = words.length > 0
      ? words[words.length - 1].endTime * 1000
      : undefined;

    for (let i = startWordIndex; i < words.length; i++) {
      const w = words[i];
      this.sendToClient({
        type: 'word_timing_delta',
        turnId: meta.turnId,
        sentenceIndex,
        wordIndex: i,
        word: w.word,
        startTime: w.startTime,
        endTime: w.endTime,
        estimatedTotalDuration,
      });
    }

    // Emit word_timing_final so the client can reconcile with authoritative data
    if (words.length > 0) {
      this.sendToClient({
        type: 'word_timing_final',
        turnId: meta.turnId,
        sentenceIndex,
        words,
        actualDurationMs: estimatedTotalDuration,
      });
    }

    console.log(`[GLKaraoke] word_timing_delta ×${words.length - startWordIndex} + word_timing_final → sentence ${sentenceIndex} (turn ${meta.turnId})`);
  }
}
