import { SentenceChunk } from "./gemini-streaming";
import { getCartesiaStreamingService } from "./cartesia-streaming";
import { getElevenLabsStreamingService } from "./elevenlabs-streaming";
import { getGeminiLiveTtsService } from "./gemini-live-tts";
import { TTSProviderRegistry, resolveSessionTTSProvider, type TTSProviderName } from "./tts-provider-adapter";
import {
  StreamingSentenceStartMessage,
  StreamingSentenceReadyMessage,
  StreamingAudioChunkMessage,
  StreamingWordTimingMessage,
  StreamingWordTimingDeltaMessage,
  StreamingWordTimingFinalMessage,
  StreamingSentenceEndMessage,
  WordTiming,
} from "@shared/streaming-voice-types";
import { constrainEmotion, TutorPersonality, CartesiaEmotion, getTTSService, getAssistantVoice } from "./tts-service";
import { extractTargetLanguageWithMapping } from "../text-utils";
import { segmentByLanguage, logSegmentation, extractBoldMarkedWords } from "./language-segmenter";
import { voiceDiagnostics } from "./voice-diagnostics-service";
import { logTtsFailure } from "./production-telemetry";
import type {
  StreamingSession,
  StreamingMetrics,
} from "./streaming-voice-orchestrator";

export interface TtsHelpers {
  getAdaptiveSpeakingRate: (session: StreamingSession) => number;
  ensureTrailingPunctuation: (text: string) => string;
  splitTextIntoSentences: (text: string) => string[];
  cleanTextForDisplay: (text: string) => string;
  applyWordEmphases: (text: string, emphases: Array<{ word: string; style: 'stress' | 'slow' | 'both' }> | undefined) => string;
}

export class TtsDispatcher {
  private getAdaptiveSpeakingRate: TtsHelpers['getAdaptiveSpeakingRate'];
  private ensureTrailingPunctuation: TtsHelpers['ensureTrailingPunctuation'];
  private splitTextIntoSentences: TtsHelpers['splitTextIntoSentences'];
  private cleanTextForDisplay: TtsHelpers['cleanTextForDisplay'];
  private applyWordEmphases: TtsHelpers['applyWordEmphases'];

  constructor(
    private cartesiaService: ReturnType<typeof getCartesiaStreamingService>,
    private elevenlabsService: ReturnType<typeof getElevenLabsStreamingService>,
    private geminiLiveTtsService: ReturnType<typeof getGeminiLiveTtsService>,
    private ttsProviderRegistry: TTSProviderRegistry,
    private ttsProvider: string,
    private sendMessage: (ws: any, message: any, session?: any) => void,
    private sendError: (ws: any, code: string, message: string, recoverable: boolean) => void,
    helpers: TtsHelpers,
  ) {
    this.getAdaptiveSpeakingRate = helpers.getAdaptiveSpeakingRate;
    this.ensureTrailingPunctuation = helpers.ensureTrailingPunctuation;
    this.splitTextIntoSentences = helpers.splitTextIntoSentences;
    this.cleanTextForDisplay = helpers.cleanTextForDisplay;
    this.applyWordEmphases = helpers.applyWordEmphases;
  }

  async streamSentenceAudio(
    session: StreamingSession,
    chunk: SentenceChunk,
    displayText: string,
    metrics: StreamingMetrics,
    turnId?: number
  ): Promise<void> {
    const { text: originalText, index } = chunk;
    
    if (session.isAssistantActive) {
      await this.streamSentenceAudioWithGoogle(session, chunk, displayText, metrics, turnId);
      return;
    }
    
    const emotion = this.selectEmotionForContext(originalText, session);
    
    const voiceOverride = session.voiceOverride;
    const effectiveSpeakingRate = voiceOverride?.speakingRate ?? this.getAdaptiveSpeakingRate(session);
    const effectiveEmotion = voiceOverride?.emotion ?? emotion;
    const effectivePersonality = voiceOverride?.personality ?? session.tutorPersonality;
    const effectiveExpressiveness = voiceOverride?.expressiveness ?? session.tutorExpressiveness;
    
    let totalDurationMs = 0;
    const audioChunks: Buffer[] = [];
    let audioFormat: 'mp3' | 'pcm_f32le' = 'mp3';
    let sampleRate: number = 24000;
    const ttsStart = Date.now();
    let firstChunkReceived = false;
    
    try {
      const nonProgTtsProvider = resolveSessionTTSProvider(session.ttsProvider as TTSProviderName | undefined, this.ttsProvider as TTSProviderName);
      const nonProgAdapter = this.ttsProviderRegistry.get(nonProgTtsProvider);
      const textWithEmphases = nonProgAdapter?.supportsCartesiaSSML
        ? this.applyWordEmphases(displayText, session.pendingWordEmphases)
        : displayText;
      if (session.pendingWordEmphases && session.pendingWordEmphases.length > 0) {
        if (nonProgAdapter?.supportsCartesiaSSML) {
          console.log(`[Non-Progressive TTS] Applied ${session.pendingWordEmphases.length} word emphases (Cartesia SSML)`);
        } else {
          console.log(`[Non-Progressive TTS] Skipped ${session.pendingWordEmphases.length} word emphases (provider: ${nonProgTtsProvider} — Cartesia SSML not supported)`);
        }
        session.pendingWordEmphases = [];
      }
      
      const ttsRequest = {
        text: textWithEmphases,
        autoDetectLanguage: true,
        targetLanguage: session.targetLanguage,
        geminiLanguageCode: session.geminiLanguageCode,
        voiceId: session.voiceId,
        speakingRate: effectiveSpeakingRate,
        emotion: effectiveEmotion as CartesiaEmotion,
        personality: effectivePersonality,
        expressiveness: effectiveExpressiveness,
        elStability: session.elStability,
        elSimilarityBoost: session.elSimilarityBoost,
        elStyle: session.elStyle,
        elSpeakerBoost: session.elSpeakerBoost,
      };
      const effectiveTtsProvider = session.ttsProvider || this.ttsProvider;
      
      if (effectiveTtsProvider === 'google') {
        const ttsService = getTTSService();
        await ttsService.streamSynthesizeWithGoogle({
          text: textWithEmphases,
          voiceId: session.voiceId || '',
          speakingRate: effectiveSpeakingRate,
          targetLanguage: session.targetLanguage,
          accentLanguageCode: session.geminiLanguageCode || undefined,
          onAudioChunk: (chunk) => {
            if (chunk.audio.length > 0) {
              if (!firstChunkReceived) {
                firstChunkReceived = true;
                if (index === 0 && !metrics.ttsFirstByteMs) {
                  metrics.ttsFirstByteMs = Date.now() - ttsStart;
                }
              }
              audioChunks.push(chunk.audio);
              metrics.audioBytes += chunk.audio.length;
              metrics.audioChunkCount++;
              totalDurationMs += chunk.durationMs;
              if (audioChunks.length === 1) {
                audioFormat = 'pcm_f32le';
                sampleRate = chunk.sampleRate || 24000;
              }
            }
          },
          onComplete: () => {},
          onError: (err) => {
            console.error(`[Non-Progressive] Google TTS streaming error:`, err.message);
          },
        });
      } else if (effectiveTtsProvider === 'gemini') {
        const ttsStream = this.geminiLiveTtsService.streamSynthesize(ttsRequest);
        for await (const audioChunk of ttsStream) {
          if (audioChunk.audio.length > 0) {
            if (!firstChunkReceived) {
              firstChunkReceived = true;
              if (index === 0 && !metrics.ttsFirstByteMs) {
                metrics.ttsFirstByteMs = Date.now() - ttsStart;
              }
            }
            audioChunks.push(audioChunk.audio);
            metrics.audioBytes += audioChunk.audio.length;
            metrics.audioChunkCount++;
            totalDurationMs += audioChunk.durationMs;
            
            if (audioChunks.length === 1 && audioChunk.audioFormat) {
              audioFormat = audioChunk.audioFormat;
              sampleRate = audioChunk.sampleRate || 24000;
            }
          }
          
          if (audioChunk.isLast) {
            break;
          }
        }
      } else {
        const ttsStream = effectiveTtsProvider === 'elevenlabs'
          ? this.elevenlabsService.streamSynthesize(ttsRequest)
          : this.cartesiaService.streamSynthesize(ttsRequest);
        for await (const audioChunk of ttsStream) {
          if (audioChunk.audio.length > 0) {
            if (!firstChunkReceived) {
              firstChunkReceived = true;
              if (index === 0 && !metrics.ttsFirstByteMs) {
                metrics.ttsFirstByteMs = Date.now() - ttsStart;
              }
            }
            audioChunks.push(audioChunk.audio);
            metrics.audioBytes += audioChunk.audio.length;
            metrics.audioChunkCount++;
            totalDurationMs += audioChunk.durationMs;
            
            if (audioChunks.length === 1 && audioChunk.audioFormat) {
              audioFormat = audioChunk.audioFormat;
              sampleRate = audioChunk.sampleRate || 24000;
            }
          }
          
          if (audioChunk.isLast) {
            break;
          }
        }
      }
      
      const completeAudio = Buffer.concat(audioChunks);
      const formatLabel = audioFormat === 'pcm_f32le' ? 'PCM' : 'MP3';
      console.log(`[Streaming] Sentence ${index}: ${completeAudio.length} bytes (${formatLabel}), ${Math.round(totalDurationMs)}ms`);
      
      if (completeAudio.length === 0) {
        console.log(`[Streaming] Skipping empty sentence ${index} (no audio data)`);
        return;
      }
      
      const effectiveTurnId = turnId ?? session.currentTurnId;
      
      if (session.subtitleMode !== 'off') {
        const nativeTimestamps = effectiveTtsProvider === 'elevenlabs'
          ? []
          : this.cartesiaService.consumeNativeTimestamps();
        let finalTimings: WordTiming[];
        
        if (nativeTimestamps.length > 0) {
          console.log(`[Streaming] Using ${nativeTimestamps.length} native timestamps for sentence ${index}`);
          finalTimings = nativeTimestamps;
        } else {
          finalTimings = this.estimateWordTimings(displayText, totalDurationMs / 1000);
        }
        
        this.sendMessage(session.ws, {
          type: 'word_timing',
          timestamp: Date.now(),
          turnId: effectiveTurnId,
          sentenceIndex: index,
          words: finalTimings,
          timings: finalTimings,
          expectedDurationMs: totalDurationMs,
        } as StreamingWordTimingMessage);
      }
      
      const audioBase64 = completeAudio.toString('base64');
      this.sendMessage(session.ws, {
        type: 'audio_chunk',
        timestamp: Date.now(),
        turnId: effectiveTurnId,
        sentenceIndex: index,
        chunkIndex: 0,
        isLast: true,
        durationMs: totalDurationMs,
        audio: audioBase64,
        audioFormat: audioFormat,
        sampleRate: sampleRate,
      } as StreamingAudioChunkMessage);
      
      this.sendMessage(session.ws, {
        type: 'sentence_end',
        timestamp: Date.now(),
        turnId: effectiveTurnId,
        sentenceIndex: index,
        totalDurationMs,
      } as StreamingSentenceEndMessage);
      
    } catch (error: any) {
      const statusCode = error.status || error.statusCode || error.code || 'unknown';
      const textLength = displayText.length;
      
      const effectiveTtsProvider = session.ttsProvider || this.ttsProvider;
      console.error(`[Streaming] TTS error for sentence ${index} (${textLength} chars, provider: ${effectiveTtsProvider}, status: ${statusCode}):`, error.message);
      
      voiceDiagnostics.emit({
        sessionId: session.id,
        stage: 'tts',
        success: false,
        error: error.message,
        metadata: { 
          sentenceIndex: index,
          mode: 'buffered',
          statusCode,
          textLength,
          provider: effectiveTtsProvider,
          textPreview: displayText.substring(0, 100),
        }
      });
      
      logTtsFailure(session.id, error.message, {
        userId: session.userId?.toString(),
        turnId: session.turnId,
        provider: effectiveTtsProvider,
        sentenceIndex: index,
        textLength,
        mode: 'buffered',
      });
      
      this.sendError(session.ws, 'TTS_ERROR', `Audio generation failed for sentence ${index}`, true);
    }
  }
  
  async streamSentenceAudioWithGoogle(
    session: StreamingSession,
    chunk: SentenceChunk,
    displayText: string,
    metrics: StreamingMetrics,
    turnId?: number
  ): Promise<void> {
    const { index } = chunk;
    const effectiveTurnId = turnId ?? session.currentTurnId;
    
    try {
      const ttsService = getTTSService();
      
      const assistantGender = session.tutorGender === 'male' ? 'male' : 'female';
      const assistantVoice = getAssistantVoice(session.targetLanguage, assistantGender as any);
      
      console.log(`[Streaming] Assistant TTS (Google): sentence ${index}, voice: ${assistantVoice.name}, language: ${session.targetLanguage}`);
      
      const result = await ttsService.synthesize({
        text: displayText,
        language: session.targetLanguage,
        targetLanguage: session.targetLanguage,
        voice: assistantVoice.name,
        speakingRate: 1.0,
        forceProvider: 'google',
      });
      
      if (!result.audioBuffer || result.audioBuffer.length === 0) {
        console.warn(`[Streaming] Google TTS returned empty audio for sentence ${index}`);
        return;
      }
      
      metrics.audioBytes += result.audioBuffer.length;
      metrics.audioChunkCount++;
      const totalDurationMs = (result as any).durationMs || 3000;
      
      console.log(`[Streaming] Assistant sentence ${index}: ${result.audioBuffer.length} bytes (Google MP3), ~${Math.round(totalDurationMs)}ms`);
      
      if (session.subtitleMode !== 'off') {
        const estimatedTimings = this.estimateWordTimings(displayText, totalDurationMs / 1000);
        
        this.sendMessage(session.ws, {
          type: 'word_timing',
          timestamp: Date.now(),
          turnId: effectiveTurnId,
          sentenceIndex: index,
          words: estimatedTimings,
          timings: estimatedTimings,
          expectedDurationMs: totalDurationMs,
        } as StreamingWordTimingMessage);
      }
      
      const audioBase64 = result.audioBuffer.toString('base64');
      this.sendMessage(session.ws, {
        type: 'audio_chunk',
        timestamp: Date.now(),
        turnId: effectiveTurnId,
        sentenceIndex: index,
        chunkIndex: 0,
        isLast: true,
        durationMs: totalDurationMs,
        audio: audioBase64,
        audioFormat: 'mp3',
        sampleRate: 24000,
      } as StreamingAudioChunkMessage);
      
      this.sendMessage(session.ws, {
        type: 'sentence_end',
        timestamp: Date.now(),
        turnId: effectiveTurnId,
        sentenceIndex: index,
        totalDurationMs,
      } as StreamingSentenceEndMessage);
      
    } catch (error: any) {
      console.error(`[Streaming] Google TTS error for assistant sentence ${index}:`, error.message);
      voiceDiagnostics.emit({
        sessionId: session.id,
        stage: 'tts',
        success: false,
        error: `Google TTS: ${error.message}`,
        metadata: { sentenceIndex: index, provider: 'google', isAssistant: true }
      });
      this.sendError(session.ws, 'TTS_ERROR', `Audio generation failed for assistant sentence ${index}`, true);
    }
  }
  
  async streamSentenceAudioProgressive(
    session: StreamingSession,
    chunk: SentenceChunk,
    displayText: string,
    metrics: StreamingMetrics,
    turnId?: number,
    preExtractedBoldWords?: string[]
  ): Promise<void> {
    session.telemetryTtsCharacters += (chunk.text || '').length;
    
    if (!session._ttsTurnCallCount) session._ttsTurnCallCount = 0;
    session._ttsTurnCallCount++;
    const ttsCallNum = session._ttsTurnCallCount;
    console.log(`[TTS DIAG] streamSentenceAudioProgressive call #${ttsCallNum} for turn ${turnId ?? session.currentTurnId}, sentence=${chunk.index}, text="${displayText.substring(0, 60)}"`);
    
    if (session.isAssistantActive) {
      await this.streamSentenceAudioWithGoogle(session, chunk, displayText, metrics, turnId);
      return;
    }
    
    const { text: originalText, index } = chunk;
    
    const activeTtsKey = `tts-active-${index}`;
    if (session[activeTtsKey]) {
      console.warn(`[Progressive DEDUP] Blocking duplicate TTS for sentenceIndex ${index} (already active) - text: "${displayText.substring(0, 60)}"`);
      return;
    }
    session[activeTtsKey] = true;
    
    const emotion = this.selectEmotionForContext(originalText, session);
    const effectiveTurnId = turnId ?? session.currentTurnId;
    
    const voiceOverride = session.voiceOverride;
    const effectiveSpeakingRate = voiceOverride?.speakingRate ?? this.getAdaptiveSpeakingRate(session);
    const effectiveEmotion = voiceOverride?.emotion ?? emotion;
    const effectivePersonality = voiceOverride?.personality ?? session.tutorPersonality;
    const effectiveExpressiveness = voiceOverride?.expressiveness ?? session.tutorExpressiveness;
    const effectiveVocalStyle = (voiceOverride as any)?.vocalStyle as string | undefined;
    
    interface BufferedAudioChunk {
      audio: Buffer;
      durationMs: number;
      audioFormat: 'mp3' | 'pcm_f32le';
      sampleRate: number;
      chunkIndex: number;
    }
    
    let bufferedAudioChunks: BufferedAudioChunk[] = [];
    let bufferedWordTimings: WordTiming[] = [];
    let estimatedTotalDuration = 0;
    let sentenceReadySent = false;
    let chunkIndex = 0;
    let firstAudioReceivedTime: number | null = null;
    let firstChunkAudioFormat: 'mp3' | 'pcm_f32le' = 'mp3';
    let firstChunkSampleRate: number = 44100;
    const TIMING_WAIT_TIMEOUT_MS = 250;
    
    const trySendSentenceReady = () => {
      if (sentenceReadySent) return;
      if (bufferedAudioChunks.length === 0) return;
      
      const now = Date.now();
      const waitedTooLong = firstAudioReceivedTime && (now - firstAudioReceivedTime) > TIMING_WAIT_TIMEOUT_MS;
      
      if (bufferedWordTimings.length === 0) {
        if (!waitedTooLong) {
          console.log(`[Progressive] Sentence ${index}: Waiting for first word timing (have ${bufferedAudioChunks.length} audio chunks buffered)`);
          return;
        }
        console.log(`[Progressive] Sentence ${index}: TIMEOUT - sending ${bufferedAudioChunks.length} audio chunks without timing (waited ${now - firstAudioReceivedTime!}ms)`);
      }
      
      sentenceReadySent = true;
      
      const firstChunk = bufferedAudioChunks[0];
      console.log(`[Progressive] Sentence ${index}: Sending sentence_ready (audio=${bufferedAudioChunks.length} chunks, timings=${bufferedWordTimings.length} words)`);
      
      this.sendMessage(session.ws, {
        type: 'sentence_ready',
        timestamp: Date.now(),
        turnId: effectiveTurnId,
        sentenceIndex: index,
        firstAudioChunk: {
          chunkIndex: firstChunk.chunkIndex,
          durationMs: firstChunk.durationMs,
          audio: firstChunk.audio.toString('base64'),
          audioFormat: firstChunk.audioFormat,
          sampleRate: firstChunk.sampleRate,
        },
        firstWordTimings: [...bufferedWordTimings],
        estimatedTotalDuration: estimatedTotalDuration,
      } as StreamingSentenceReadyMessage);
      
      const firstChunkDedupeKey = `audio-${effectiveTurnId}-${index}-${firstChunk.chunkIndex}`;
      session.sentAudioChunks.add(firstChunkDedupeKey);
      console.log(`[Progressive DEDUP] Tracked sentence_ready firstChunk: ${firstChunkDedupeKey}`);
      
      for (let i = 1; i < bufferedAudioChunks.length; i++) {
        const chunk = bufferedAudioChunks[i];
        this.sendMessage(session.ws, {
          type: 'audio_chunk',
          timestamp: Date.now(),
          turnId: effectiveTurnId,
          sentenceIndex: index,
          chunkIndex: chunk.chunkIndex,
          isLast: false,
          durationMs: chunk.durationMs,
          audio: chunk.audio.toString('base64'),
          audioFormat: chunk.audioFormat,
          sampleRate: chunk.sampleRate,
        } as StreamingAudioChunkMessage);
      }
      
      bufferedAudioChunks = [];
    };
    
    try {
      const effectiveTtsProviderForEmphases = resolveSessionTTSProvider(session.ttsProvider as TTSProviderName | undefined, this.ttsProvider as TTSProviderName);
      const emphasisAdapter = this.ttsProviderRegistry.get(effectiveTtsProviderForEmphases);
      const textWithEmphases = emphasisAdapter?.supportsCartesiaSSML
        ? this.applyWordEmphases(displayText, session.pendingWordEmphases)
        : displayText;
      if (session.pendingWordEmphases && session.pendingWordEmphases.length > 0) {
        if (emphasisAdapter?.supportsCartesiaSSML) {
          console.log(`[Progressive TTS] Applied ${session.pendingWordEmphases.length} word emphases (Cartesia SSML)`);
        } else {
          console.log(`[Progressive TTS] Skipped ${session.pendingWordEmphases.length} word emphases (provider: ${effectiveTtsProviderForEmphases} — Cartesia SSML not supported)`);
        }
        session.pendingWordEmphases = [];
      }
      
      const ttsCallbacks = {
          onAudioChunk: (audioChunk: { audio: Buffer; durationMs: number; audioFormat?: string; sampleRate?: number; isLast?: boolean }, idx: number) => {
            metrics.audioBytes += audioChunk.audio.length;
            metrics.audioChunkCount++;
            
            if (idx === 0 && audioChunk.audioFormat) {
              firstChunkAudioFormat = audioChunk.audioFormat as 'mp3' | 'pcm_f32le';
              firstChunkSampleRate = audioChunk.sampleRate || 44100;
            }
            
            if (!sentenceReadySent) {
              if (!firstAudioReceivedTime) {
                firstAudioReceivedTime = Date.now();
              }
              
              console.log(`[Progressive] Sentence ${index}: Buffering audio chunk ${idx} (waiting for timing)`);
              bufferedAudioChunks.push({
                audio: audioChunk.audio,
                durationMs: audioChunk.durationMs,
                audioFormat: (audioChunk.audioFormat || 'pcm_f32le') as 'mp3' | 'pcm_f32le',
                sampleRate: audioChunk.sampleRate || 24000,
                chunkIndex: idx,
              });
              trySendSentenceReady();
            } else {
              const audioBase64 = audioChunk.audio.toString('base64');
              this.sendMessage(session.ws, {
                type: 'audio_chunk',
                timestamp: Date.now(),
                turnId: effectiveTurnId,
                sentenceIndex: index,
                chunkIndex: idx,
                isLast: false,
                durationMs: audioChunk.durationMs,
                audio: audioBase64,
                audioFormat: audioChunk.audioFormat || 'pcm_f32le',
                sampleRate: audioChunk.sampleRate || 24000,
              } as StreamingAudioChunkMessage);
            }
            
            chunkIndex = idx + 1;
          },
          
          onWordTimestamp: (timing: { word: string; startTime: number; endTime: number }, wordIdx: number, estimatedTotal: number) => {
            estimatedTotalDuration = estimatedTotal;
            
            if (!sentenceReadySent) {
              console.log(`[Progressive] Sentence ${index}: Buffering word ${wordIdx} "${timing.word}" (waiting for audio)`);
              bufferedWordTimings.push(timing);
              trySendSentenceReady();
            } else {
              console.log(`[Progressive] Sending word_timing_delta: sentence=${index}, word=${wordIdx} "${timing.word}"`);
              if (session.subtitleMode !== 'off') {
                this.sendMessage(session.ws, {
                  type: 'word_timing_delta',
                  timestamp: Date.now(),
                  turnId: effectiveTurnId,
                  sentenceIndex: index,
                  wordIndex: wordIdx,
                  word: timing.word,
                  startTime: timing.startTime,
                  endTime: timing.endTime,
                  estimatedTotalDuration: estimatedTotal,
                } as StreamingWordTimingDeltaMessage);
              }
            }
          },
          
          onComplete: (finalTimestamps: Array<{ word: string; startTime: number; endTime: number }>, actualDurationMs: number) => {
            if (!sentenceReadySent && bufferedAudioChunks.length > 0) {
              console.log(`[Progressive] Sentence ${index}: No native timings received, using estimates`);
              const estimatedTimings = this.estimateWordTimings(displayText, actualDurationMs / 1000);
              bufferedWordTimings = estimatedTimings;
              trySendSentenceReady();
            }
            
            if (session.subtitleMode !== 'off') {
              const timings = finalTimestamps.length > 0 
                ? finalTimestamps 
                : this.estimateWordTimings(displayText, actualDurationMs / 1000);
              
              console.log(`[Progressive] Sending word_timing_final: sentence=${index}, ${timings.length} words, duration=${actualDurationMs}ms`);
              this.sendMessage(session.ws, {
                type: 'word_timing_final',
                timestamp: Date.now(),
                turnId: effectiveTurnId,
                sentenceIndex: index,
                words: timings,
                actualDurationMs,
              } as StreamingWordTimingFinalMessage);
            }
            
            const lastAudioFormat = firstChunkAudioFormat;
            const lastSampleRate = firstChunkSampleRate;
            this.sendMessage(session.ws, {
              type: 'audio_chunk',
              timestamp: Date.now(),
              turnId: effectiveTurnId,
              sentenceIndex: index,
              chunkIndex,
              isLast: true,
              durationMs: 0,
              audio: '',
              audioFormat: lastAudioFormat,
              sampleRate: lastSampleRate,
            } as StreamingAudioChunkMessage);
            
            this.sendMessage(session.ws, {
              type: 'sentence_end',
              timestamp: Date.now(),
              turnId: effectiveTurnId,
              sentenceIndex: index,
              totalDurationMs: actualDurationMs,
            } as StreamingSentenceEndMessage);
            
            console.log(`[Progressive] Sentence ${index}: Complete (${chunkIndex} chunks, ${actualDurationMs}ms)`);
          },
      };
      
      const nativeLanguage = session.nativeLanguage || 'english';
      const rawChunkText = chunk.text || '';
      const boldMarkedWords = preExtractedBoldWords && preExtractedBoldWords.length > 0
        ? preExtractedBoldWords
        : extractBoldMarkedWords(rawChunkText);
      
      const hasBoldSyntax = rawChunkText.includes('**');
      const usedPreExtracted = !!(preExtractedBoldWords && preExtractedBoldWords.length > 0);
      console.log(`[TTS-LANG-DIAG] Raw chunk has bold syntax: ${hasBoldSyntax}, extracted ${boldMarkedWords.length} bold words${usedPreExtracted ? ' (pre-extracted from raw function call text)' : ''}`);
      if (hasBoldSyntax) {
        console.log(`[TTS-LANG-DIAG] Raw text (first 120): "${rawChunkText.substring(0, 120)}"`);
      }
      if (boldMarkedWords.length > 0) {
        console.log(`[TTS-LANG-DIAG] Bold-marked target words: ${boldMarkedWords.join(', ')}`);
      }
      console.log(`[TTS-LANG-DIAG] Display text for TTS (first 120): "${textWithEmphases.substring(0, 120)}"`);
      
      const segmentationResult = segmentByLanguage(textWithEmphases, nativeLanguage, session.targetLanguage, boldMarkedWords);
      
      console.log(`[TTS-LANG-DIAG] Segmentation: hasCodeSwitching=${segmentationResult.hasCodeSwitching}, segments=${segmentationResult.segments.length}, targetWords=${segmentationResult.targetLanguageWords.join(', ') || 'none'}`);
      
      if (segmentationResult.hasCodeSwitching && segmentationResult.segments.length > 1) {
        logSegmentation(segmentationResult, nativeLanguage, session.targetLanguage);
      }
      
      const effectiveTtsProvider = resolveSessionTTSProvider(session.ttsProvider as TTSProviderName | undefined, this.ttsProvider as TTSProviderName);
      
      const progressiveRequest = {
        text: textWithEmphases,
        autoDetectLanguage: true,
        targetLanguage: session.targetLanguage,
        nativeLanguage: session.nativeLanguage || 'english',
        geminiLanguageCode: session.geminiLanguageCode,
        voiceId: session.voiceId,
        speakingRate: effectiveSpeakingRate,
        emotion: effectiveEmotion as CartesiaEmotion,
        personality: effectivePersonality,
        expressiveness: effectiveExpressiveness,
        vocalStyle: effectiveVocalStyle,
        elStability: session.elStability,
        elSimilarityBoost: session.elSimilarityBoost,
        elStyle: session.elStyle,
        elSpeakerBoost: session.elSpeakerBoost,
      };
      
      const ttsAdapter = this.ttsProviderRegistry.getOrThrow(effectiveTtsProvider);
      await ttsAdapter.streamSynthesizeProgressive(progressiveRequest, ttsCallbacks);
      
      session[activeTtsKey] = false;
      
    } catch (error: any) {
      const statusCode = error.status || error.statusCode || error.code || 'unknown';
      const textLength = displayText.length;
      const effectiveTtsProvider = session.ttsProvider || this.ttsProvider;
      console.error(`[Progressive] TTS error for sentence ${index} (${textLength} chars, provider: ${effectiveTtsProvider}, status: ${statusCode}):`, error.message);
      
      voiceDiagnostics.emit({
        sessionId: session.id,
        stage: 'tts',
        success: false,
        error: error.message,
        metadata: { 
          sentenceIndex: index, 
          mode: 'progressive',
          statusCode,
          textLength,
          provider: effectiveTtsProvider,
          targetLanguage: session.targetLanguage,
          textPreview: displayText.substring(0, 100),
        }
      });
      
      const finishReason = error.message?.match(/finishReason: (\w+)/)?.[1];
      logTtsFailure(session.id, error.message, {
        userId: session.userId?.toString(),
        turnId: session.turnId,
        provider: effectiveTtsProvider,
        sentenceIndex: index,
        textLength,
        mode: 'progressive',
        targetLanguage: session.targetLanguage,
        finishReason,
        statusCode: statusCode !== 'unknown' ? statusCode : undefined,
      });
      
      this.sendError(session.ws, 'TTS_ERROR', `Audio generation failed for sentence ${index}`, true);
      
      this.sendMessage(session.ws, {
        type: 'sentence_end',
        timestamp: Date.now(),
        turnId: effectiveTurnId,
        sentenceIndex: index,
        totalDurationMs: 0,
      } as StreamingSentenceEndMessage);
      
      session[activeTtsKey] = false;
    }
  }
  
  async streamPreGeneratedSentenceAudio(
    session: StreamingSession,
    chunk: SentenceChunk,
    displayText: string,
    metrics: StreamingMetrics,
    turnId: string | number,
    preGenerated: { audio: Buffer; durationMs: number; timestamps: import('@shared/streaming-voice-types').WordTiming[] }
  ): Promise<void> {
    session.telemetryTtsCharacters += (chunk.text || '').length;
    session.telemetryTutorSpeakingMs += preGenerated.durationMs || 0;
    
    const { index } = chunk;
    const effectiveTurnId = typeof turnId === 'number' ? turnId : session.currentTurnId;
    const streamStart = Date.now();

    try {
      const timings = preGenerated.timestamps.length > 0
        ? preGenerated.timestamps
        : this.estimateWordTimings(displayText, preGenerated.durationMs / 1000);

      const CHUNK_SIZE_SAMPLES = 2400;
      const TTS_SAMPLE_RATE = 24000;
      const bytesPerChunk = CHUNK_SIZE_SAMPLES * 4;

      const firstChunkEnd = Math.min(bytesPerChunk, preGenerated.audio.length);
      const firstChunkBuf = preGenerated.audio.subarray(0, firstChunkEnd);
      const firstChunkDurationMs = (firstChunkEnd / 4 / TTS_SAMPLE_RATE) * 1000;

      this.sendMessage(session.ws, {
        type: 'sentence_ready',
        timestamp: Date.now(),
        turnId: effectiveTurnId,
        sentenceIndex: index,
        text: displayText,
        wordTimings: timings,
        estimatedDurationMs: preGenerated.durationMs,
        firstAudioChunk: firstChunkBuf.toString('base64'),
        firstAudioDurationMs: firstChunkDurationMs,
        audioFormat: 'pcm_f32le',
        sampleRate: TTS_SAMPLE_RATE,
      });

      metrics.ttsFirstByteMs = Date.now() - streamStart;

      let chunkIndex = 1;
      let offset = firstChunkEnd;
      while (offset < preGenerated.audio.length) {
        const end = Math.min(offset + bytesPerChunk, preGenerated.audio.length);
        const chunkBuf = preGenerated.audio.subarray(offset, end);
        const chunkDurationMs = ((end - offset) / 4 / TTS_SAMPLE_RATE) * 1000;

        this.sendMessage(session.ws, {
          type: 'audio_chunk',
          timestamp: Date.now(),
          turnId: effectiveTurnId,
          sentenceIndex: index,
          chunkIndex,
          isLast: false,
          durationMs: chunkDurationMs,
          audio: chunkBuf.toString('base64'),
          audioFormat: 'pcm_f32le',
          sampleRate: TTS_SAMPLE_RATE,
        } as StreamingAudioChunkMessage);
        chunkIndex++;
        offset = end;
      }

      if (session.subtitleMode !== 'off') {
        this.sendMessage(session.ws, {
          type: 'word_timing_final',
          timestamp: Date.now(),
          turnId: effectiveTurnId,
          sentenceIndex: index,
          words: timings,
          actualDurationMs: preGenerated.durationMs,
        } as StreamingWordTimingFinalMessage);
      }

      this.sendMessage(session.ws, {
        type: 'audio_chunk',
        timestamp: Date.now(),
        turnId: effectiveTurnId,
        sentenceIndex: index,
        chunkIndex,
        isLast: true,
        durationMs: 0,
        audio: '',
        audioFormat: 'pcm_f32le',
        sampleRate: TTS_SAMPLE_RATE,
      } as StreamingAudioChunkMessage);

      this.sendMessage(session.ws, {
        type: 'sentence_end',
        timestamp: Date.now(),
        turnId: effectiveTurnId,
        sentenceIndex: index,
        totalDurationMs: preGenerated.durationMs,
      } as StreamingSentenceEndMessage);

      console.log(`[Pre-Gen Stream] Sentence ${index}: Streamed ${chunkIndex} chunks in ${Date.now() - streamStart}ms (${Math.round(preGenerated.durationMs)}ms audio, pre-generated)`);
    } catch (error: any) {
      console.error(`[Pre-Gen Stream] Error for sentence ${index}:`, error.message);
      this.sendError(session.ws, 'TTS_ERROR', `Audio generation failed for sentence ${index}`, true);
      this.sendMessage(session.ws, {
        type: 'sentence_end',
        timestamp: Date.now(),
        turnId: effectiveTurnId,
        sentenceIndex: index,
        totalDurationMs: 0,
      } as StreamingSentenceEndMessage);
    }
  }

  async synthesizeWithLegacyProvider(
    provider: string,
    session: StreamingSession,
    textWithEmphases: string,
    displayText: string,
    progressiveRequest: any,
    ttsCallbacks: any,
    effectiveTurnId: number,
    sentenceIndex: number,
    effectiveSpeakingRate: number
  ): Promise<void> {
    if (provider === 'google') {
      const ttsService = getTTSService();
      const googleStartTime = Date.now();
      let googleStreamChunkIdx = 0;
      const wordsPerMinute = 150;
      const wordCount = textWithEmphases.split(/\s+/).length;
      const estimatedDurationMs = Math.max(1000, (wordCount / wordsPerMinute) * 60000 / effectiveSpeakingRate);
      
      await ttsService.streamSynthesizeWithGoogle({
        text: textWithEmphases,
        voiceId: session.voiceId || '',
        speakingRate: effectiveSpeakingRate,
        targetLanguage: session.targetLanguage,
        accentLanguageCode: session.geminiLanguageCode || undefined,
        onAudioChunk: (audioChunk) => {
          ttsCallbacks.onAudioChunk({
            audio: audioChunk.audio,
            durationMs: audioChunk.durationMs,
            audioFormat: audioChunk.audioFormat || 'pcm_f32le',
            isLast: false,
          }, googleStreamChunkIdx++);
          
          if (googleStreamChunkIdx === 1) {
            const estimatedTimings = this.estimateWordTimings(displayText, estimatedDurationMs / 1000);
            for (let wi = 0; wi < estimatedTimings.length; wi++) {
              ttsCallbacks.onWordTimestamp(estimatedTimings[wi], wi, estimatedDurationMs);
            }
          }
        },
        onComplete: (totalBytes) => {
          const actualDurationMs = totalBytes > 0
            ? (totalBytes / 2 / 24000) * 1000
            : estimatedDurationMs;
          const timingDurationMs = actualDurationMs > 0 ? actualDurationMs : estimatedDurationMs;
          const finalTimings = this.estimateWordTimings(displayText, timingDurationMs / 1000);
          try {
            ttsCallbacks.onComplete(finalTimings, timingDurationMs);
          } catch (callbackErr: any) {
            console.error(`[Progressive] ttsCallbacks.onComplete threw for sentence ${sentenceIndex}, sending sentence_end as safety net:`, callbackErr.message);
            try {
              this.sendMessage(session.ws, {
                type: 'audio_chunk',
                timestamp: Date.now(),
                turnId: effectiveTurnId,
                sentenceIndex,
                chunkIndex: 9999,
                isLast: true,
                durationMs: 0,
                audio: '',
                audioFormat: 'pcm_f32le',
                sampleRate: 24000,
              } as StreamingAudioChunkMessage);
              this.sendMessage(session.ws, {
                type: 'sentence_end',
                timestamp: Date.now(),
                turnId: effectiveTurnId,
                sentenceIndex,
                totalDurationMs: timingDurationMs,
              } as StreamingSentenceEndMessage);
            } catch (sendErr) { /* last resort */ }
          }
          console.log(`[Progressive] Google TTS streaming complete: sentence ${sentenceIndex}, ${googleStreamChunkIdx} chunks, ${totalBytes} bytes, ${Date.now() - googleStartTime}ms`);
        },
        onError: (err) => {
          console.error(`[Progressive] Google TTS streaming error for sentence ${sentenceIndex}:`, err.message);
        },
      });
    } else if (provider === 'elevenlabs') {
      await this.elevenlabsService.streamSynthesizeProgressive(progressiveRequest, ttsCallbacks);
    } else {
      await this.cartesiaService.streamSynthesizeProgressive(progressiveRequest, ttsCallbacks);
    }
  }

  estimateWordTimings(text: string, durationSeconds: number): WordTiming[] {
    const cleanedText = text.replace(/\[laughter\]/gi, ' ');
    
    const words = cleanedText.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return [];
    
    const wordWeights = words.map(word => {
      let weight = Math.max(1, word.length);
      if (/[.!?]$/.test(word)) weight += 2;
      else if (/[,;:]$/.test(word)) weight += 1;
      return weight;
    });
    
    const totalWeight = wordWeights.reduce((sum, w) => sum + w, 0);
    const timings: WordTiming[] = [];
    let currentTime = 0.1;
    const speakingDuration = Math.max(0.1, durationSeconds - 0.2);
    
    for (let i = 0; i < words.length; i++) {
      const wordDuration = (wordWeights[i] / totalWeight) * speakingDuration;
      const actualDuration = Math.max(0.1, wordDuration);
      
      timings.push({
        word: words[i],
        startTime: currentTime,
        endTime: currentTime + actualDuration,
      });
      
      currentTime += actualDuration;
    }
    
    return timings;
  }
  
  selectEmotionForContext(text: string, session: StreamingSession): CartesiaEmotion {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('great!') || 
        lowerText.includes('excellent!') || 
        lowerText.includes('perfect!') ||
        lowerText.includes('wonderful!')) {
      return constrainEmotion('excited', session.tutorPersonality, session.tutorExpressiveness);
    }
    
    if (lowerText.includes('good job') || 
        lowerText.includes('well done') ||
        lowerText.includes('keep going') ||
        lowerText.includes('you\'re doing')) {
      return constrainEmotion('encouraging', session.tutorPersonality, session.tutorExpressiveness);
    }
    
    if (lowerText.includes('?') || 
        lowerText.includes('what do you') ||
        lowerText.includes('how about')) {
      return constrainEmotion('curious', session.tutorPersonality, session.tutorExpressiveness);
    }
    
    if (lowerText.includes('actually') || 
        lowerText.includes('let me explain') ||
        lowerText.includes('the correct')) {
      return constrainEmotion('patient', session.tutorPersonality, session.tutorExpressiveness);
    }
    
    return constrainEmotion('friendly', session.tutorPersonality, session.tutorExpressiveness);
  }
  
  async dispatchPostStreamFcTts(
    session: StreamingSession,
    metrics: StreamingMetrics,
  ): Promise<{ spokenText: string; sentenceCount: number } | null> {
    const rawEmbeddedText = this.ensureTrailingPunctuation((session.functionCallText || '').trim());
    const embeddedText = this.cleanTextForDisplay(rawEmbeddedText).trim();
    if (!embeddedText) return null;

    const directBoldWords = extractBoldMarkedWords(rawEmbeddedText || '');
    const accumulatedWords: string[] = session.accumulatedBoldWords || [];
    const boldWords = Array.from(new Set([...directBoldWords, ...accumulatedWords]));
    if (accumulatedWords.length > 0) {
      console.log(`[Post-Stream FC TTS] Merged ${accumulatedWords.length} accumulated bold words with ${directBoldWords.length} direct: ${boldWords.join(', ')}`);
    }

    const sentences = this.splitTextIntoSentences(embeddedText);
    console.log(`[Post-Stream FC TTS] ${embeddedText.length} chars -> ${sentences.length} sentences for TTS`);

    const effectiveProvider = resolveSessionTTSProvider(session.ttsProvider as TTSProviderName | undefined, this.ttsProvider as TTSProviderName);
    const requiresBatch = this.ttsProviderRegistry.getOrThrow(effectiveProvider).requiresBatchMode;
    const turnId = session.turnId || session.currentTurnId || `turn-${Date.now()}`;

    if (requiresBatch && sentences.length > 1 && !session.isInterrupted) {
      console.log(`[Post-Stream FC TTS] Batch mode: Combining ${sentences.length} sentences (${embeddedText.length} chars)`);
      const batchStart = Date.now();

      const extraction = extractTargetLanguageWithMapping(embeddedText, boldWords);
      const wordMapping: [number, number][] = extraction.wordMapping.size > 0
        ? Array.from(extraction.wordMapping.entries()) : [];
      const hasTarget = !!(extraction.targetText && extraction.targetText.trim().length > 0);

      this.sendMessage(session.ws, {
        type: 'sentence_start',
        timestamp: Date.now(),
        turnId,
        sentenceIndex: 0,
        text: embeddedText,
        hasTargetContent: hasTarget,
        targetLanguageText: hasTarget ? extraction.targetText : undefined,
        wordMapping: hasTarget && wordMapping.length > 0 ? wordMapping : undefined,
      } as StreamingSentenceStartMessage);

      const batchChunk: SentenceChunk = { index: 0, text: embeddedText, isComplete: true, isFinal: true };
      await this.streamSentenceAudioProgressive(session, batchChunk, embeddedText, metrics, turnId, boldWords);

      console.log(`[Post-Stream FC TTS] Batch complete. Duration: ${Date.now() - batchStart}ms for ${sentences.length} sentences`);

      session.functionCallText = undefined;
      session.voiceAdjustText = undefined;
      session.accumulatedBoldWords = undefined;
      session.earlyTtsActive = undefined;
      return { spokenText: embeddedText, sentenceCount: 1 };
    } else {
      for (let si = 0; si < sentences.length; si++) {
        if (session.isInterrupted) break;
        const sentenceText = sentences[si];
        const extraction = extractTargetLanguageWithMapping(sentenceText, boldWords);
        const wordMapping: [number, number][] = extraction.wordMapping.size > 0
          ? Array.from(extraction.wordMapping.entries()) : [];
        const hasTarget = !!(extraction.targetText && extraction.targetText.trim().length > 0);

        this.sendMessage(session.ws, {
          type: 'sentence_start',
          timestamp: Date.now(),
          turnId,
          sentenceIndex: si,
          text: sentenceText,
          hasTargetContent: hasTarget,
          targetLanguageText: hasTarget ? extraction.targetText : undefined,
          wordMapping: hasTarget && wordMapping.length > 0 ? wordMapping : undefined,
          ...(si === 0 && sentences.length > 1 ? { totalSentences: sentences.length } : {}),
        } as StreamingSentenceStartMessage);

        await this.streamSentenceAudioProgressive(session, { index: si, text: sentenceText, isComplete: true, isFinal: si === sentences.length - 1 }, sentenceText, metrics, turnId, boldWords);
      }

      session.functionCallText = undefined;
      session.voiceAdjustText = undefined;
      session.accumulatedBoldWords = undefined;
      session.earlyTtsActive = undefined;
      return { spokenText: embeddedText, sentenceCount: sentences.length };
    }
  }
}
