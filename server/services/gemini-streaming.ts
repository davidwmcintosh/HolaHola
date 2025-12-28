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
 * Strip internal notation tags from text BEFORE sentence chunking
 * These are Daniela's internal commands that should never be spoken aloud:
 * - [SELF_SURGERY ...] - neural network proposals
 * - [SELF_LEARN ...] - autonomous learning writes
 * - [OBSERVE ...] - teaching observations
 * - [COLLAB:TYPE]...[/COLLAB] - collaboration signals
 * - [KNOWLEDGE_PING ...] - knowledge queries
 * 
 * Uses balanced bracket matching for tags with complex nested content (JSON, quotes)
 */
function stripInternalNotationTags(text: string): string {
  // Strip COLLAB tags first (have closing tags)
  text = text.replace(/\[COLLAB:[A-Z_]+\][\s\S]*?\[\/COLLAB\]/gi, '');
  
  // Strip malformed LLM reasoning/planning patterns that shouldn't be spoken
  // Pattern: :["step1", "step2", ...] - internal thinking chains
  text = text.replace(/:\s*\[\s*"[^"]*"(?:\s*,?\s*"[^"]*")*\s*\]/g, '');
  
  // Strip JSON-like key-value fragments: "key":"value" or "key": "value"
  text = text.replace(/"[a-z_]+"\s*:\s*"[^"]*"/gi, '');
  
  // Strip parenthetical notes that look like internal metadata: (progress, notes, last topic)
  text = text.replace(/\([a-z,\s]+\)/gi, '');
  
  // Strip patterns like: reasoning="..." priority=N confidence=N]
  text = text.replace(/\s*reasoning\s*=\s*"[^"]*"\s*priority\s*=\s*\d+\s*confidence\s*=\s*\d+\s*\]/g, '');
  
  // Strip instruction-like sentences that shouldn't be spoken (internal LLM planning)
  // These start with imperative verbs followed by user/student references
  text = text.replace(/,?\s*"?(Inform|Emphasize|Confirm|Execute|Summarize|Transfer|Initiate|Ensure)\s+(user|student|the\s+user|the\s+student|about|seamless|context)[^.!?\n]*[.!?]?"?/gi, '');
  
  // Strip trailing/leading JSON fragments: }' or ,' or ,"
  text = text.replace(/[,}]'?\s*$/g, '');
  text = text.replace(/^[,'"}\]]+\s*/g, '');
  
  // Strip invented system command formats that LLM sometimes uses instead of SWITCH_TUTOR
  // e.g., [SYSTEM_MESSAGE: TRANSFER_TO_TUTOR tutor="..." language="..."]
  text = text.replace(/\[SYSTEM_MESSAGE[^\]]*\]/gi, '');
  text = text.replace(/\[TRANSFER_TO_TUTOR[^\]]*\]/gi, '');
  text = text.replace(/\[SYSTEM[^\]]*\]/gi, '');
  
  // Clean up multiple spaces and leading/trailing whitespace
  text = text.replace(/\s{2,}/g, ' ').trim();
  
  // Strip bracket-based tags with balanced matching for complex content
  // Pattern: [TAG_NAME followed by content until balanced ]
  const tagPatterns = ['SELF_SURGERY', 'SELF_LEARN', 'OBSERVE', 'KNOWLEDGE_PING', 'HIVE'];
  
  for (const tagName of tagPatterns) {
    let result = '';
    let i = 0;
    
    while (i < text.length) {
      // Look for tag opening
      const tagStart = `[${tagName}`;
      const startIdx = text.indexOf(tagStart, i);
      
      if (startIdx === -1) {
        // No more tags, append rest
        result += text.substring(i);
        break;
      }
      
      // Append text before tag
      result += text.substring(i, startIdx);
      
      // Find balanced closing bracket
      let depth = 0;
      let inString = false;
      let stringChar = '';
      let j = startIdx;
      
      while (j < text.length) {
        const char = text[j];
        const prevChar = j > 0 ? text[j - 1] : '';
        
        if (inString) {
          // Handle string escapes and closing
          if (char === stringChar && prevChar !== '\\') {
            inString = false;
          }
        } else {
          if (char === '"' || char === "'") {
            inString = true;
            stringChar = char;
          } else if (char === '[') {
            depth++;
          } else if (char === ']') {
            depth--;
            if (depth === 0) {
              // Found balanced closing bracket - skip entire tag
              i = j + 1;
              break;
            }
          }
        }
        j++;
      }
      
      // If we didn't find balanced bracket, skip just the opening
      if (j >= text.length) {
        i = text.length;
      }
    }
    
    text = result;
  }
  
  return text;
}

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
    // Using Gemini 3 Flash for fast responses + strong instruction following
    // 3x faster than 2.5 Pro, better at coding/tool-use than 2.5 Flash
    this.defaultModel = 'gemini-3-flash';
  }
  
  /**
   * Warm up the Gemini connection with a minimal request
   * This primes the model and eliminates cold-start latency on subsequent calls
   * 
   * @returns Time taken for warm-up in milliseconds
   */
  async warmup(): Promise<number> {
    const startTime = Date.now();
    try {
      const result = await this.client.models.generateContentStream({
        model: this.defaultModel,
        contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
        config: {
          temperature: 0,
          maxOutputTokens: 1,
        },
      });
      for await (const chunk of result) {
        break;
      }
      const latency = Date.now() - startTime;
      console.log(`[Gemini Streaming] ✓ Warmed up in ${latency}ms`);
      return latency;
    } catch (error: any) {
      const latency = Date.now() - startTime;
      console.warn(`[Gemini Streaming] Warmup failed after ${latency}ms: ${error.message}`);
      return latency;
    }
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
      // Strip internal notation tags before flushing
      buffer = stripInternalNotationTags(buffer);
      
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
        
        // Strip internal notation tags BEFORE sentence extraction
        // This prevents [SELF_SURGERY ...] etc. from being spoken aloud
        buffer = stripInternalNotationTags(buffer);
        
        // Check for complete sentences
        const sentences = this.extractCompleteSentences(buffer);
        
        // Update buffer IMMEDIATELY before async operations to prevent timeout race
        buffer = sentences.remaining;
        
        // Clear timeout while processing to prevent duplicate sends
        if (flushTimeoutId) {
          clearTimeout(flushTimeoutId);
          flushTimeoutId = null;
        }
        
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
      
      // Strip internal notation tags from remaining buffer before final output
      buffer = stripInternalNotationTags(buffer);
      
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
   * 
   * IMPORTANT: Protects bracket-enclosed tags from fragmentation.
   * Tags like [HIVE description="Something. More."] should NOT be split
   * on internal punctuation - we track bracket depth to ensure this.
   */
  private extractCompleteSentences(text: string): { complete: string[]; remaining: string } {
    const sentences: string[] = [];
    let remaining = text;
    
    // Look for sentence-ending punctuation
    const endings = SENTENCE_CHUNKING_CONFIG.SENTENCE_ENDINGS;
    
    while (remaining.length >= SENTENCE_CHUNKING_CONFIG.MIN_SENTENCE_LENGTH) {
      let breakIndex = -1;
      
      // Build a map of which positions are inside brackets (depth > 0)
      // This protects tags like [HIVE ...] from being split on internal punctuation
      const bracketDepth = new Array(remaining.length).fill(0);
      let depth = 0;
      let inString = false;
      let stringChar = '';
      
      for (let i = 0; i < remaining.length; i++) {
        const char = remaining[i];
        const prevChar = i > 0 ? remaining[i - 1] : '';
        
        if (inString) {
          // Handle string escapes and closing
          if (char === stringChar && prevChar !== '\\') {
            inString = false;
          }
        } else {
          if (char === '"' || char === "'") {
            inString = true;
            stringChar = char;
          } else if (char === '[') {
            depth++;
          } else if (char === ']') {
            depth = Math.max(0, depth - 1);
          }
        }
        bracketDepth[i] = depth;
      }
      
      // Find the earliest sentence ending that is OUTSIDE brackets (depth = 0)
      for (const ending of endings) {
        let searchFrom = 0;
        while (true) {
          const idx = remaining.indexOf(ending, searchFrom);
          if (idx === -1 || idx < SENTENCE_CHUNKING_CONFIG.MIN_SENTENCE_LENGTH - 1) {
            break;
          }
          
          // Skip if inside brackets - this protects tags from fragmentation
          if (bracketDepth[idx] > 0) {
            searchFrom = idx + 1;
            continue;
          }
          
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
          break; // Found a valid position for this ending type
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
   * 
   * IMPORTANT: Protects bracket-enclosed tags from fragmentation.
   * Won't break inside [HIVE ...] or similar tags.
   */
  private findClauseBreak(text: string): number {
    const breaks = SENTENCE_CHUNKING_CONFIG.CLAUSE_BREAKS;
    let bestBreak = -1;
    
    // Build bracket depth map to protect tags from fragmentation
    const bracketDepth = new Array(text.length).fill(0);
    let depth = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const prevChar = i > 0 ? text[i - 1] : '';
      
      if (inString) {
        if (char === stringChar && prevChar !== '\\') {
          inString = false;
        }
      } else {
        if (char === '"' || char === "'") {
          inString = true;
          stringChar = char;
        } else if (char === '[') {
          depth++;
        } else if (char === ']') {
          depth = Math.max(0, depth - 1);
        }
      }
      bracketDepth[i] = depth;
    }
    
    // Find the last clause break before MAX_SENTENCE_LENGTH that's OUTSIDE brackets
    for (const breakChar of breaks) {
      let lastIdx = text.lastIndexOf(breakChar);
      // Look for break in the safe range (after MIN, before MAX)
      while (lastIdx > SENTENCE_CHUNKING_CONFIG.MIN_SENTENCE_LENGTH && 
             lastIdx < SENTENCE_CHUNKING_CONFIG.MAX_SENTENCE_LENGTH) {
        // Only use this break if outside brackets
        if (bracketDepth[lastIdx] === 0) {
          bestBreak = Math.max(bestBreak, lastIdx + 1);
        }
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
  
  /**
   * Generate related words for WORD_MAP whiteboard tool
   * Returns synonyms, antonyms, collocations, and word family members
   */
  async generateRelatedWords(
    targetWord: string,
    language: string
  ): Promise<{
    synonyms: string[];
    antonyms: string[];
    collocations: string[];
    wordFamily: string[];
  }> {
    const prompt = `You are a language learning assistant. For the ${language} word "${targetWord}", provide related words to help students learn vocabulary relationships.

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "synonyms": ["word1", "word2"],
  "antonyms": ["word1", "word2"],
  "collocations": ["common phrase 1", "common phrase 2"],
  "wordFamily": ["related form 1", "related form 2"]
}

Rules:
- synonyms: 2-4 words with similar meaning in ${language}
- antonyms: 1-3 words with opposite meaning in ${language} (empty array if none exist)
- collocations: 2-4 common phrases using this word in ${language}
- wordFamily: 2-4 related word forms (noun/verb/adjective variants) in ${language}
- All words and phrases must be in ${language}, not English
- Keep it simple and appropriate for language learners`;

    try {
      const result = await this.client.models.generateContent({
        model: this.defaultModel,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.3,
          maxOutputTokens: 256,
        },
      });

      const text = result.text?.trim() || '';
      
      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms.slice(0, 4) : [],
          antonyms: Array.isArray(parsed.antonyms) ? parsed.antonyms.slice(0, 3) : [],
          collocations: Array.isArray(parsed.collocations) ? parsed.collocations.slice(0, 4) : [],
          wordFamily: Array.isArray(parsed.wordFamily) ? parsed.wordFamily.slice(0, 4) : [],
        };
      }
      
      console.warn(`[WORD_MAP] Failed to parse response for "${targetWord}": ${text.substring(0, 100)}`);
      return { synonyms: [], antonyms: [], collocations: [], wordFamily: [] };
      
    } catch (error: any) {
      console.error(`[WORD_MAP] Error generating related words for "${targetWord}":`, error.message);
      return { synonyms: [], antonyms: [], collocations: [], wordFamily: [] };
    }
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
