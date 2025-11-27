/**
 * Gemini Streaming Service with Sentence-Level Chunking
 * 
 * Architecture: Uses generateContentStream() for token-by-token streaming,
 * then buffers and chunks by sentence boundaries for TTS efficiency.
 * 
 * Flow: Gemini tokens → Sentence buffer → Complete sentences → TTS pipeline
 */

import { GoogleGenAI, Content, Part } from "@google/genai";
import { SENTENCE_CHUNKING_CONFIG } from "@shared/streaming-voice-types";

/**
 * Sentence chunk emitted by the streaming service
 */
export interface SentenceChunk {
  index: number;        // Sentence sequence number (0-based)
  text: string;         // The sentence text
  isComplete: boolean;  // True if sentence ended with proper punctuation
  isFinal: boolean;     // True if this is the last sentence
}

/**
 * Callback for when a complete sentence is ready
 */
export type OnSentenceCallback = (chunk: SentenceChunk) => Promise<void>;

/**
 * Callback for streaming progress
 */
export type OnProgressCallback = (partialText: string, totalChars: number) => void;

/**
 * Configuration for streaming generation
 */
export interface StreamingGenerationConfig {
  systemPrompt: string;
  conversationHistory: Array<{ role: 'user' | 'model'; content: string }>;
  userMessage: string;
  model?: string;  // Default: gemini-2.5-flash
  temperature?: number;
  maxOutputTokens?: number;
  onSentence: OnSentenceCallback;
  onProgress?: OnProgressCallback;
  onError?: (error: Error) => void;
}

/**
 * Result of streaming generation
 */
export interface StreamingGenerationResult {
  fullText: string;
  sentenceCount: number;
  totalTokens: number;
  durationMs: number;
}

/**
 * Gemini Streaming Service
 * Handles streaming text generation with sentence-level chunking
 */
export class GeminiStreamingService {
  private client: GoogleGenAI;
  private defaultModel: string;
  
  constructor() {
    this.client = new GoogleGenAI({
      apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || '',
      httpOptions: {
        apiVersion: "",
        baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
      },
    });
    this.defaultModel = 'gemini-2.5-flash';
  }
  
  /**
   * Stream generation with sentence-level chunking
   * 
   * @returns Promise that resolves when streaming is complete
   */
  async streamWithSentenceChunking(config: StreamingGenerationConfig): Promise<StreamingGenerationResult> {
    const startTime = Date.now();
    const {
      systemPrompt,
      conversationHistory,
      userMessage,
      model = this.defaultModel,
      temperature = 0.7,
      maxOutputTokens = 1024,
      onSentence,
      onProgress,
      onError,
    } = config;
    
    console.log(`[Gemini Streaming] Starting with model: ${model}`);
    
    // Build conversation contents in Gemini format
    const contents: Content[] = conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }] as Part[],
    }));
    
    // Add user's new message
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }] as Part[],
    });
    
    // Sentence chunking state
    let buffer = '';
    let sentenceIndex = 0;
    let fullText = '';
    let lastTokenTime = Date.now();
    let flushTimeoutId: NodeJS.Timeout | null = null;
    
    // Helper to flush buffer if it has enough content
    const flushBufferIfNeeded = async () => {
      if (buffer.length >= SENTENCE_CHUNKING_CONFIG.MIN_SENTENCE_LENGTH) {
        // Find best break point for partial flush
        const breakPoint = this.findClauseBreak(buffer) || buffer.length;
        if (breakPoint >= SENTENCE_CHUNKING_CONFIG.MIN_SENTENCE_LENGTH) {
          const chunk: SentenceChunk = {
            index: sentenceIndex++,
            text: buffer.substring(0, breakPoint).trim(),
            isComplete: false,  // Timeout-forced flush
            isFinal: false,
          };
          
          console.log(`[Gemini Streaming] Timeout flush ${chunk.index}: "${chunk.text.substring(0, 50)}..."`);
          await onSentence(chunk);
          buffer = buffer.substring(breakPoint).trim();
        }
      }
    };
    
    // Schedule flush timeout with error handling
    const scheduleFlushTimeout = () => {
      if (flushTimeoutId) {
        clearTimeout(flushTimeoutId);
      }
      flushTimeoutId = setTimeout(() => {
        const idleTime = Date.now() - lastTokenTime;
        if (idleTime >= SENTENCE_CHUNKING_CONFIG.CHUNK_TIMEOUT_MS && buffer.length > 0) {
          flushBufferIfNeeded().catch((error) => {
            console.error('[Gemini Streaming] Timeout flush error:', error.message);
            onError?.(error);
          });
        }
      }, SENTENCE_CHUNKING_CONFIG.CHUNK_TIMEOUT_MS);
    };
    
    try {
      // Start streaming generation with retry for transient errors
      let result;
      let lastError;
      const maxRetries = 3;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          result = await this.client.models.generateContentStream({
            model,
            contents,
            config: {
              systemInstruction: systemPrompt,
              temperature,
              maxOutputTokens,
            },
          });
          break; // Success, exit retry loop
        } catch (error: any) {
          lastError = error;
          const status = error.status || error.code;
          // Retry on 500, 502, 503, 504 errors
          if (status >= 500 && status < 600 && attempt < maxRetries - 1) {
            console.log(`[Gemini Streaming] Retry ${attempt + 1}/${maxRetries} after ${status} error`);
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))); // Exponential backoff
            continue;
          }
          throw error;
        }
      }
      
      if (!result) {
        throw lastError || new Error('Failed to start Gemini stream');
      }
      
      // Process streamed tokens
      for await (const chunk of result) {
        const text = chunk.text || '';
        if (!text) continue;
        
        buffer += text;
        fullText += text;
        lastTokenTime = Date.now();
        
        // Reset flush timeout on each token
        scheduleFlushTimeout();
        
        // Notify progress
        onProgress?.(buffer, fullText.length);
        
        // Check for complete sentences
        const sentences = this.extractCompleteSentences(buffer);
        
        for (const sentence of sentences.complete) {
          const chunk: SentenceChunk = {
            index: sentenceIndex++,
            text: sentence,
            isComplete: true,
            isFinal: false,
          };
          
          console.log(`[Gemini Streaming] Sentence ${chunk.index}: "${sentence.substring(0, 50)}..."`);
          await onSentence(chunk);
        }
        
        // Update buffer with remaining text
        buffer = sentences.remaining;
        
        // Force chunk if buffer is too long (prevents long waits)
        if (buffer.length >= SENTENCE_CHUNKING_CONFIG.MAX_SENTENCE_LENGTH) {
          const forcedBreak = this.findClauseBreak(buffer);
          if (forcedBreak > SENTENCE_CHUNKING_CONFIG.MIN_SENTENCE_LENGTH) {
            const chunk: SentenceChunk = {
              index: sentenceIndex++,
              text: buffer.substring(0, forcedBreak).trim(),
              isComplete: false,  // Forced break, not a natural sentence end
              isFinal: false,
            };
            
            console.log(`[Gemini Streaming] Forced chunk ${chunk.index}: "${chunk.text.substring(0, 50)}..."`);
            await onSentence(chunk);
            buffer = buffer.substring(forcedBreak).trim();
          }
        }
      }
      
      // Clear any pending timeout
      if (flushTimeoutId) {
        clearTimeout(flushTimeoutId);
      }
      
      // Emit any remaining text as final chunk
      if (buffer.trim()) {
        const chunk: SentenceChunk = {
          index: sentenceIndex++,
          text: buffer.trim(),
          isComplete: this.endsWithSentencePunctuation(buffer),
          isFinal: true,
        };
        
        console.log(`[Gemini Streaming] Final sentence ${chunk.index}: "${chunk.text.substring(0, 50)}..."`);
        await onSentence(chunk);
      }
      
      const durationMs = Date.now() - startTime;
      console.log(`[Gemini Streaming] Complete: ${sentenceIndex} sentences, ${fullText.length} chars in ${durationMs}ms`);
      
      return {
        fullText,
        sentenceCount: sentenceIndex,
        totalTokens: Math.ceil(fullText.length / 4), // Rough estimate
        durationMs,
      };
      
    } catch (error: any) {
      console.error(`[Gemini Streaming] Error:`, error.message);
      onError?.(error);
      throw error;
    }
  }
  
  /**
   * Extract complete sentences from buffer
   * Returns complete sentences and remaining buffer
   */
  private extractCompleteSentences(text: string): { complete: string[]; remaining: string } {
    const sentences: string[] = [];
    let remaining = text;
    
    // Look for sentence-ending punctuation
    const endings = SENTENCE_CHUNKING_CONFIG.SENTENCE_ENDINGS;
    
    while (remaining.length >= SENTENCE_CHUNKING_CONFIG.MIN_SENTENCE_LENGTH) {
      let breakIndex = -1;
      
      // Find the earliest sentence ending
      for (const ending of endings) {
        const idx = remaining.indexOf(ending);
        if (idx !== -1 && idx >= SENTENCE_CHUNKING_CONFIG.MIN_SENTENCE_LENGTH - 1) {
          // Check if there's a space or end after the punctuation (avoid "3.5" breaking)
          const afterPunct = remaining.substring(idx + 1, idx + 3);
          const isRealEnd = afterPunct.length === 0 || 
                           afterPunct[0] === ' ' || 
                           afterPunct[0] === '\n' ||
                           afterPunct[0] === '"' ||
                           afterPunct[0] === "'";
          
          if (isRealEnd && (breakIndex === -1 || idx < breakIndex)) {
            breakIndex = idx + 1; // Include the punctuation
          }
        }
      }
      
      if (breakIndex === -1) {
        break;
      }
      
      const sentence = remaining.substring(0, breakIndex).trim();
      if (sentence) {
        sentences.push(sentence);
      }
      remaining = remaining.substring(breakIndex).trim();
    }
    
    return { complete: sentences, remaining };
  }
  
  /**
   * Find a clause break point for forced chunking
   * Returns the break position (after the punctuation)
   */
  private findClauseBreak(text: string): number {
    const breaks = SENTENCE_CHUNKING_CONFIG.CLAUSE_BREAKS;
    let bestBreak = -1;
    
    // Find the last clause break before MAX_SENTENCE_LENGTH
    for (const breakChar of breaks) {
      let lastIdx = text.lastIndexOf(breakChar);
      // Look for break in the safe range (after MIN, before MAX)
      while (lastIdx > SENTENCE_CHUNKING_CONFIG.MIN_SENTENCE_LENGTH && 
             lastIdx < SENTENCE_CHUNKING_CONFIG.MAX_SENTENCE_LENGTH) {
        bestBreak = Math.max(bestBreak, lastIdx + 1);
        lastIdx = text.lastIndexOf(breakChar, lastIdx - 1);
      }
    }
    
    return bestBreak;
  }
  
  /**
   * Check if text ends with sentence-ending punctuation
   */
  private endsWithSentencePunctuation(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;
    
    const lastChar = trimmed.charAt(trimmed.length - 1);
    const endings: readonly string[] = SENTENCE_CHUNKING_CONFIG.SENTENCE_ENDINGS;
    return endings.includes(lastChar);
  }
}

// Singleton instance
let streamingService: GeminiStreamingService | null = null;

export function getGeminiStreamingService(): GeminiStreamingService {
  if (!streamingService) {
    streamingService = new GeminiStreamingService();
  }
  return streamingService;
}
