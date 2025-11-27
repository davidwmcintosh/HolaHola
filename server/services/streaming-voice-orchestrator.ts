/**
 * Streaming Voice Orchestrator
 * 
 * The central coordinator for streaming voice mode:
 * User audio → Deepgram STT → Gemini streaming → Sentence chunks → Cartesia TTS → Audio stream
 * 
 * Now with REAL-TIME streaming STT:
 * - Audio chunks stream to Deepgram as user speaks
 * - Transcript ready the moment user stops (vs 400-800ms batch delay)
 * 
 * Target: < 1 second time to first audio byte (vs 5-7s synchronous mode)
 */

import { createClient } from "@deepgram/sdk";
import { getGeminiStreamingService, SentenceChunk } from "./gemini-streaming";
import { getCartesiaStreamingService } from "./cartesia-streaming";
import { getStreamingSTTService, StreamingSTTSession } from "./deepgram-streaming";
import { WebSocket as WS } from "ws";
import {
  StreamingMessage,
  StreamingConnectedMessage,
  StreamingProcessingMessage,
  StreamingInterimTranscriptMessage,
  StreamingSentenceStartMessage,
  StreamingAudioChunkMessage,
  StreamingWordTimingMessage,
  StreamingSentenceEndMessage,
  StreamingResponseCompleteMessage,
  StreamingErrorMessage,
  StreamingErrorCode,
  ClientStartSessionMessage,
  WordTiming,
  LATENCY_TARGETS,
} from "@shared/streaming-voice-types";
import { constrainEmotion, TutorPersonality, CartesiaEmotion } from "./tts-service";
import { storage } from "../storage";

/**
 * Session state for a streaming voice connection
 */
export interface StreamingSession {
  id: string;
  userId: number;
  conversationId: string;  // UUID string
  targetLanguage: string;
  nativeLanguage: string;
  difficultyLevel: string;
  subtitleMode: 'off' | 'target' | 'all';
  tutorPersonality: TutorPersonality;
  tutorExpressiveness: number;
  voiceId?: string;
  systemPrompt: string;
  conversationHistory: Array<{ role: 'user' | 'model'; content: string }>;
  ws: WS;
  startTime: number;
  isActive: boolean;
  sttSession?: StreamingSTTSession;
  sttStartTime?: number;
  isRecording: boolean;
  pendingTranscript: string;
}

/**
 * Metrics for tracking streaming performance
 */
export interface StreamingMetrics {
  sessionId: string;
  sttLatencyMs: number;
  aiFirstTokenMs: number;
  ttsFirstByteMs: number;
  totalLatencyMs: number;
  sentenceCount: number;
  audioBytes: number;
}

/**
 * Deepgram client (STT)
 */
const deepgram = createClient(process.env.DEEPGRAM_API_KEY || '');

/**
 * Streaming Voice Orchestrator
 * Manages the full pipeline from user audio to AI audio response
 */
export class StreamingVoiceOrchestrator {
  private sessions: Map<string, StreamingSession> = new Map();
  private geminiService = getGeminiStreamingService();
  private cartesiaService = getCartesiaStreamingService();
  private sttService = getStreamingSTTService();
  
  constructor() {
    console.log('[Streaming Orchestrator] Initialized');
  }
  
  /**
   * Create a new streaming session
   */
  createSession(
    ws: WS,
    userId: number,
    config: ClientStartSessionMessage,
    systemPrompt: string,
    conversationHistory: Array<{ role: 'user' | 'model'; content: string }>,
    voiceId?: string
  ): StreamingSession {
    const sessionId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: StreamingSession = {
      id: sessionId,
      userId,
      conversationId: config.conversationId,
      targetLanguage: config.targetLanguage,
      nativeLanguage: config.nativeLanguage,
      difficultyLevel: config.difficultyLevel,
      subtitleMode: config.subtitleMode,
      tutorPersonality: (config.tutorPersonality as TutorPersonality) || 'warm',
      tutorExpressiveness: config.tutorExpressiveness || 3,
      voiceId,
      systemPrompt,
      conversationHistory,
      ws,
      startTime: Date.now(),
      isActive: true,
      isRecording: false,
      pendingTranscript: '',
    };
    
    this.sessions.set(sessionId, session);
    
    // Send connected message
    this.sendMessage(ws, {
      type: 'connected',
      timestamp: Date.now(),
      sessionId,
    } as StreamingConnectedMessage);
    
    console.log(`[Streaming Orchestrator] Session created: ${sessionId}`);
    return session;
  }
  
  /**
   * Process user audio and stream AI response
   */
  async processUserAudio(
    sessionId: string,
    audioData: Buffer,
    audioFormat: string = 'webm'
  ): Promise<StreamingMetrics> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error(`Session not found or inactive: ${sessionId}`);
    }
    
    const startTime = Date.now();
    const metrics: StreamingMetrics = {
      sessionId,
      sttLatencyMs: 0,
      aiFirstTokenMs: 0,
      ttsFirstByteMs: 0,
      totalLatencyMs: 0,
      sentenceCount: 0,
      audioBytes: 0,
    };
    
    try {
      // Step 1: Transcribe user audio with Deepgram
      console.log(`[Streaming Orchestrator] Processing ${audioData.length} bytes of audio`);
      
      const sttStart = Date.now();
      const transcript = await this.transcribeAudio(audioData, session.targetLanguage);
      metrics.sttLatencyMs = Date.now() - sttStart;
      
      console.log(`[Streaming Orchestrator] STT: "${transcript}" (${metrics.sttLatencyMs}ms)`);
      
      if (!transcript.trim()) {
        throw new Error('Empty transcript from audio');
      }
      
      // Notify client that processing has started
      this.sendMessage(session.ws, {
        type: 'processing',
        timestamp: Date.now(),
        userTranscript: transcript,
      } as StreamingProcessingMessage);
      
      // Step 2: Stream AI response with sentence chunking
      const aiStart = Date.now();
      let firstTokenReceived = false;
      let fullText = '';
      let currentSentenceIndex = 0;
      
      // Process sentences as they arrive from Gemini
      await this.geminiService.streamWithSentenceChunking({
        systemPrompt: session.systemPrompt,
        conversationHistory: session.conversationHistory,
        userMessage: transcript,
        onSentence: async (chunk: SentenceChunk) => {
          if (!firstTokenReceived) {
            metrics.aiFirstTokenMs = Date.now() - aiStart;
            firstTokenReceived = true;
            console.log(`[Streaming Orchestrator] AI first token: ${metrics.aiFirstTokenMs}ms`);
          }
          
          // Notify client of new sentence
          this.sendMessage(session.ws, {
            type: 'sentence_start',
            timestamp: Date.now(),
            sentenceIndex: chunk.index,
            text: chunk.text,
          } as StreamingSentenceStartMessage);
          
          // Synthesize and stream audio for this sentence
          const ttsStart = Date.now();
          await this.streamSentenceAudio(session, chunk, metrics);
          
          if (chunk.index === 0) {
            metrics.ttsFirstByteMs = Date.now() - ttsStart;
          }
          
          fullText += chunk.text + ' ';
          currentSentenceIndex = chunk.index;
          metrics.sentenceCount++;
        },
        onProgress: (partialText, totalChars) => {
          // Could use this for live typing indicator
        },
        onError: (error) => {
          console.error(`[Streaming Orchestrator] AI error:`, error.message);
          this.sendError(session.ws, 'AI_FAILED', error.message, true);
        },
      });
      
      // Update conversation history (in-memory for AI context)
      session.conversationHistory.push({ role: 'user', content: transcript });
      session.conversationHistory.push({ role: 'model', content: fullText.trim() });
      
      // Save messages to database for persistence
      try {
        // Save user message
        await storage.createMessage({
          conversationId: session.conversationId,
          role: 'user',
          content: transcript,
        });
        
        // Save AI response
        await storage.createMessage({
          conversationId: session.conversationId,
          role: 'assistant',
          content: fullText.trim(),
        });
        
        console.log(`[Streaming Orchestrator] Messages saved to database`);
      } catch (dbError: any) {
        console.error(`[Streaming Orchestrator] Failed to save messages:`, dbError.message);
        // Don't throw - conversation still worked, just failed to persist
      }
      
      // Send completion message
      metrics.totalLatencyMs = Date.now() - startTime;
      
      this.sendMessage(session.ws, {
        type: 'response_complete',
        timestamp: Date.now(),
        totalSentences: metrics.sentenceCount,
        totalDurationMs: metrics.totalLatencyMs,
        fullText: fullText.trim(),
      } as StreamingResponseCompleteMessage);
      
      console.log(`[Streaming Orchestrator] Complete: ${metrics.sentenceCount} sentences in ${metrics.totalLatencyMs}ms`);
      console.log(`[Streaming Orchestrator] Latencies: STT=${metrics.sttLatencyMs}ms, AI=${metrics.aiFirstTokenMs}ms, TTS=${metrics.ttsFirstByteMs}ms`);
      
      return metrics;
      
    } catch (error: any) {
      console.error(`[Streaming Orchestrator] Error:`, error.message);
      this.sendError(session.ws, 'UNKNOWN', error.message, true);
      throw error;
    }
  }
  
  /**
   * Transcribe audio using Deepgram Nova-3
   */
  private async transcribeAudio(audioData: Buffer, targetLanguage: string): Promise<string> {
    try {
      const response = await deepgram.listen.prerecorded.transcribeFile(
        audioData,
        {
          model: 'nova-3',
          language: this.getLanguageCode(targetLanguage),
          smart_format: true,
        }
      );
      
      const transcript = response.result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      return transcript;
      
    } catch (error: any) {
      console.error('[Deepgram STT] Error:', error.message);
      throw new Error(`STT failed: ${error.message}`);
    }
  }
  
  /**
   * Stream audio for a single sentence
   * Buffers complete sentence audio before sending (MP3 requires complete frames)
   */
  private async streamSentenceAudio(
    session: StreamingSession,
    chunk: SentenceChunk,
    metrics: StreamingMetrics
  ): Promise<void> {
    const { text, index } = chunk;
    
    // Determine emotion based on context
    const emotion = this.selectEmotionForContext(text, session);
    
    let totalDurationMs = 0;
    
    // Buffer all audio chunks for this sentence (MP3 needs complete frames to play correctly)
    const audioBuffers: Buffer[] = [];
    
    try {
      // Collect all audio chunks from Cartesia
      for await (const audioChunk of this.cartesiaService.streamSynthesize({
        text,
        language: session.targetLanguage,
        voiceId: session.voiceId,
        emotion,
        personality: session.tutorPersonality,
        expressiveness: session.tutorExpressiveness,
      })) {
        if (audioChunk.audio.length > 0) {
          audioBuffers.push(audioChunk.audio);
          metrics.audioBytes += audioChunk.audio.length;
          totalDurationMs += audioChunk.durationMs;
        }
        
        if (audioChunk.isLast) {
          break;
        }
      }
      
      // Combine all chunks into one complete MP3 buffer
      const completeAudio = Buffer.concat(audioBuffers);
      
      if (completeAudio.length > 0) {
        // Send complete sentence audio as a single chunk
        const audioBase64 = completeAudio.toString('base64');
        this.sendMessage(session.ws, {
          type: 'audio_chunk',
          timestamp: Date.now(),
          sentenceIndex: index,
          chunkIndex: 0,
          isLast: true,
          durationMs: totalDurationMs,
          audio: audioBase64,
        } as StreamingAudioChunkMessage);
      }
      
      // Send word timings for subtitle sync
      if (session.subtitleMode !== 'off') {
        const estimatedTimings = this.estimateWordTimings(text, totalDurationMs / 1000);
        this.sendMessage(session.ws, {
          type: 'word_timing',
          timestamp: Date.now(),
          sentenceIndex: index,
          words: estimatedTimings,
          timings: estimatedTimings,
        } as StreamingWordTimingMessage);
      }
      
      // Send sentence end
      this.sendMessage(session.ws, {
        type: 'sentence_end',
        timestamp: Date.now(),
        sentenceIndex: index,
        totalDurationMs,
      } as StreamingSentenceEndMessage);
      
    } catch (error: any) {
      console.error(`[Streaming] TTS error for sentence ${index}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Estimate word timings when not provided by TTS
   * Uses the original display text for word timings (phonemes are only added inside Cartesia)
   */
  private estimateWordTimings(text: string, durationSeconds: number): WordTiming[] {
    // Replace [laughter] tags with a space to preserve word count alignment
    // Phoneme tags are only added inside Cartesia, so `text` here is the clean display text
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
  
  /**
   * Select appropriate emotion for the sentence context
   */
  private selectEmotionForContext(text: string, session: StreamingSession): CartesiaEmotion {
    // Simple heuristic-based emotion selection
    const lowerText = text.toLowerCase();
    
    // Excited/enthusiastic patterns
    if (lowerText.includes('great!') || 
        lowerText.includes('excellent!') || 
        lowerText.includes('perfect!') ||
        lowerText.includes('wonderful!')) {
      return constrainEmotion('excited', session.tutorPersonality, session.tutorExpressiveness);
    }
    
    // Encouraging patterns
    if (lowerText.includes('good job') || 
        lowerText.includes('well done') ||
        lowerText.includes('keep going') ||
        lowerText.includes('you\'re doing')) {
      return constrainEmotion('encouraging', session.tutorPersonality, session.tutorExpressiveness);
    }
    
    // Curious/questioning patterns
    if (lowerText.includes('?') || 
        lowerText.includes('what do you') ||
        lowerText.includes('how about')) {
      return constrainEmotion('curious', session.tutorPersonality, session.tutorExpressiveness);
    }
    
    // Patient/calm patterns (for corrections)
    if (lowerText.includes('actually') || 
        lowerText.includes('let me explain') ||
        lowerText.includes('the correct')) {
      return constrainEmotion('patient', session.tutorPersonality, session.tutorExpressiveness);
    }
    
    // Default to friendly
    return constrainEmotion('friendly', session.tutorPersonality, session.tutorExpressiveness);
  }
  
  /**
   * Convert language name to ISO code for Deepgram
   */
  private getLanguageCode(language: string): string {
    const codes: Record<string, string> = {
      'english': 'en',
      'spanish': 'es',
      'french': 'fr',
      'german': 'de',
      'italian': 'it',
      'portuguese': 'pt',
      'japanese': 'ja',
      'mandarin chinese': 'zh',
      'korean': 'ko',
    };
    return codes[language.toLowerCase()] || 'en';
  }
  
  /**
   * Send a JSON message over WebSocket
   */
  private sendMessage(ws: WS, message: StreamingMessage): void {
    if (ws.readyState === WS.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
  
  /**
   * Send an error message
   */
  private sendError(ws: WS, code: StreamingErrorCode, message: string, recoverable: boolean): void {
    this.sendMessage(ws, {
      type: 'error',
      timestamp: Date.now(),
      code,
      message,
      recoverable,
    } as StreamingErrorMessage);
  }
  
  /**
   * Handle client interrupt (user started speaking while AI is responding)
   */
  handleInterrupt(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      console.log(`[Streaming Orchestrator] Interrupt received for session: ${sessionId}`);
    }
  }
  
  /**
   * Start recording - initialize streaming STT session
   * Call this when user starts speaking to prepare real-time transcription
   */
  async startRecording(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error(`Session not found or inactive: ${sessionId}`);
    }
    
    if (session.isRecording) {
      console.log(`[Streaming Orchestrator] Already recording for session: ${sessionId}`);
      return;
    }
    
    try {
      console.log(`[Streaming Orchestrator] Starting recording for session: ${sessionId}`);
      session.sttStartTime = Date.now();
      session.pendingTranscript = '';
      session.isRecording = true;
      
      const sttSession = await this.sttService.createSession(sessionId, session.targetLanguage);
      session.sttSession = sttSession;
      
      sttSession.on('interim', (transcript: string, confidence: number) => {
        session.pendingTranscript = transcript;
        this.sendMessage(session.ws, {
          type: 'interim_transcript',
          timestamp: Date.now(),
          transcript,
          confidence,
          isFinal: false,
        } as StreamingInterimTranscriptMessage);
      });
      
      sttSession.on('final', (transcript: string, confidence: number) => {
        session.pendingTranscript = transcript;
        this.sendMessage(session.ws, {
          type: 'interim_transcript',
          timestamp: Date.now(),
          transcript,
          confidence,
          isFinal: true,
        } as StreamingInterimTranscriptMessage);
      });
      
      sttSession.on('speech_ended', () => {
        console.log(`[Streaming Orchestrator] Speech ended detected for session: ${sessionId}`);
      });
      
      sttSession.on('error', (error: Error) => {
        console.error(`[Streaming Orchestrator] STT error for session ${sessionId}:`, error.message);
        this.sendError(session.ws, 'STT_FAILED', error.message, true);
      });
      
      console.log(`[Streaming Orchestrator] STT session ready for: ${sessionId}`);
      
    } catch (error: any) {
      console.error(`[Streaming Orchestrator] Failed to start recording:`, error.message);
      session.isRecording = false;
      this.sendError(session.ws, 'STT_FAILED', 'Speech recognition unavailable. Please try again.', true);
    }
  }
  
  /**
   * Handle streaming audio chunk from client
   * Forward PCM audio data to Deepgram for real-time transcription
   */
  handleAudioChunk(sessionId: string, audioData: Buffer): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      console.warn(`[Streaming Orchestrator] No active session for audio chunk: ${sessionId}`);
      return;
    }
    
    if (!session.sttSession) {
      console.warn(`[Streaming Orchestrator] No STT session for audio chunk: ${sessionId}`);
      return;
    }
    
    session.sttSession.sendAudio(audioData);
  }
  
  /**
   * Handle end of audio recording
   * Finalize STT and trigger AI response generation
   */
  async handleAudioEnd(sessionId: string): Promise<StreamingMetrics> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error(`Session not found or inactive: ${sessionId}`);
    }
    
    const startTime = Date.now();
    const sttLatencyMs = session.sttStartTime ? Date.now() - session.sttStartTime : 0;
    
    const metrics: StreamingMetrics = {
      sessionId,
      sttLatencyMs,
      aiFirstTokenMs: 0,
      ttsFirstByteMs: 0,
      totalLatencyMs: 0,
      sentenceCount: 0,
      audioBytes: 0,
    };
    
    try {
      if (session.sttSession) {
        session.sttSession.finishSpeaking();
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const transcript = session.sttSession.getFullTranscript();
        session.pendingTranscript = transcript;
        
        session.sttSession.close();
        session.sttSession = undefined;
      }
      
      session.isRecording = false;
      
      const transcript = session.pendingTranscript.trim();
      
      if (!transcript) {
        console.log(`[Streaming Orchestrator] Empty transcript, skipping AI response`);
        return metrics;
      }
      
      console.log(`[Streaming Orchestrator] Final transcript: "${transcript}" (STT: ${sttLatencyMs}ms)`);
      
      this.sendMessage(session.ws, {
        type: 'processing',
        timestamp: Date.now(),
        userTranscript: transcript,
      } as StreamingProcessingMessage);
      
      const aiStart = Date.now();
      let firstTokenReceived = false;
      let fullText = '';
      
      await this.geminiService.streamWithSentenceChunking({
        systemPrompt: session.systemPrompt,
        conversationHistory: session.conversationHistory,
        userMessage: transcript,
        onSentence: async (chunk: SentenceChunk) => {
          if (!firstTokenReceived) {
            metrics.aiFirstTokenMs = Date.now() - aiStart;
            firstTokenReceived = true;
            console.log(`[Streaming Orchestrator] AI first token: ${metrics.aiFirstTokenMs}ms`);
          }
          
          this.sendMessage(session.ws, {
            type: 'sentence_start',
            timestamp: Date.now(),
            sentenceIndex: chunk.index,
            text: chunk.text,
          } as StreamingSentenceStartMessage);
          
          const ttsStart = Date.now();
          await this.streamSentenceAudio(session, chunk, metrics);
          
          if (chunk.index === 0) {
            metrics.ttsFirstByteMs = Date.now() - ttsStart;
          }
          
          fullText += chunk.text + ' ';
          metrics.sentenceCount++;
        },
        onProgress: () => {},
        onError: (error) => {
          console.error(`[Streaming Orchestrator] AI error:`, error.message);
          this.sendError(session.ws, 'AI_FAILED', error.message, true);
        },
      });
      
      session.conversationHistory.push({ role: 'user', content: transcript });
      session.conversationHistory.push({ role: 'model', content: fullText.trim() });
      
      // Save messages to database for persistence
      try {
        await storage.createMessage({
          conversationId: session.conversationId,
          role: 'user',
          content: transcript,
        });
        
        await storage.createMessage({
          conversationId: session.conversationId,
          role: 'assistant',
          content: fullText.trim(),
        });
        
        console.log(`[Streaming Orchestrator] Messages saved to database`);
      } catch (dbError: any) {
        console.error(`[Streaming Orchestrator] Failed to save messages:`, dbError.message);
      }
      
      metrics.totalLatencyMs = Date.now() - startTime;
      
      this.sendMessage(session.ws, {
        type: 'response_complete',
        timestamp: Date.now(),
        totalSentences: metrics.sentenceCount,
        totalDurationMs: metrics.totalLatencyMs,
        fullText: fullText.trim(),
      } as StreamingResponseCompleteMessage);
      
      console.log(`[Streaming Orchestrator] Complete: ${metrics.sentenceCount} sentences`);
      console.log(`[Streaming Orchestrator] Latencies: STT=${sttLatencyMs}ms, AI=${metrics.aiFirstTokenMs}ms, TTS=${metrics.ttsFirstByteMs}ms, Total=${metrics.totalLatencyMs}ms`);
      
      return metrics;
      
    } catch (error: any) {
      console.error(`[Streaming Orchestrator] Error in handleAudioEnd:`, error.message);
      session.isRecording = false;
      if (session.sttSession) {
        session.sttSession.close();
        session.sttSession = undefined;
      }
      this.sendError(session.ws, 'UNKNOWN', error.message, true);
      throw error;
    }
  }
  
  /**
   * End a streaming session
   */
  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.sttSession) {
        session.sttSession.close();
      }
      session.isActive = false;
      this.sessions.delete(sessionId);
      console.log(`[Streaming Orchestrator] Session ended: ${sessionId}`);
    }
  }
  
  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }
}

// Singleton instance
let orchestrator: StreamingVoiceOrchestrator | null = null;

export function getStreamingVoiceOrchestrator(): StreamingVoiceOrchestrator {
  if (!orchestrator) {
    orchestrator = new StreamingVoiceOrchestrator();
  }
  return orchestrator;
}
