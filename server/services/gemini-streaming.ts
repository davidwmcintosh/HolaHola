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
import { 
  createDanielaTools, 
  extractFunctionCalls, 
  FUNCTION_TO_COMMAND_MAP,
  type ExtractedFunctionCall,
} from "./gemini-function-declarations";

// Re-export types and utilities for convenience
export { FUNCTION_TO_COMMAND_MAP } from "./gemini-function-declarations";
export type { ExtractedFunctionCall } from "./gemini-function-declarations";

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
  
  // Strip Gemini 3 thinking/drafting patterns that shouldn't be spoken aloud
  // These appear when thinkingConfig is enabled and model outputs its internal reasoning
  // Pattern: "Draft 1:", "Draft 2:", "*Draft 1:*", "* *Draft 1:*" etc.
  text = text.replace(/\*?\s*\*?Draft\s*\d+\s*(?:\([^)]*\))?\s*:?\s*\*?\s*:?/gi, '');
  
  // Pattern: "Tone:" followed by descriptors - internal voice planning
  text = text.replace(/Tone:\s*[A-Za-z\s,]+(?:\.{3}|\.\s|$)/gi, '');
  
  // Pattern: Self-evaluation checklists "Natural? Yes." "Curious? Yes." "Authentic? Yes."
  text = text.replace(/(?:Natural|Curious|Authentic|Revised|Teaching)\?\s*(?:Yes|No)\.?\s*/gi, '');
  
  // Pattern: "Not overly dramatic..." - internal tone instructions
  text = text.replace(/Not\s+overly\s+[a-z]+[^.]*\.{3}/gi, '');
  
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
  
  // Strip non-bracketed PHASE_SHIFT directives that Daniela sometimes outputs inline
  // Pattern: PHASE_SHIFT to="..." reason="..." (without brackets, often at end of sentences)
  text = text.replace(/\s*PHASE_SHIFT\s+to\s*=\s*[""][^""]*[""]\s*reason\s*=\s*[""][^""]*[""]/gi, '');
  // Also catch double-quoted versions
  text = text.replace(/\s*PHASE_SHIFT\s+to\s*=\s*"[^"]*"\s*reason\s*=\s*"[^"]*"/gi, '');
  
  // Strip internal meta-directives that look like instructions
  // Pattern: "Maintain directness and founder-level honesty even when transitioning..."
  // Pattern: "not a state-dependent persona Maintain directness..."
  text = text.replace(/\s*(?:not\s+a\s+state-dependent\s+persona\s+)?Maintain\s+(?:directness|founder-level)[^.!?\n]*[.!?]?/gi, '');
  
  // Strip bracket-based tags with balanced matching for complex content
  // Pattern: [TAG_NAME followed by content until balanced ]
  // Added PHASE_SHIFT to the list for bracketed versions
  const tagPatterns = ['SELF_SURGERY', 'SELF_LEARN', 'OBSERVE', 'KNOWLEDGE_PING', 'HIVE', 'PHASE_SHIFT'];
  
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
 * Callback for function calls (Gemini 3 native tool calling)
 */
export type OnFunctionCallCallback = (calls: ExtractedFunctionCall[]) => Promise<void>;

/**
 * Partial function call during streaming - emitted before full args are ready
 * Enables early intent detection for latency optimization (e.g., preload tutor voice)
 * 
 * @see https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling#streaming-fc
 */
export interface PartialFunctionCall {
  callIndex: number;               // Unique identifier (0-based, order in stream)
  name: string;                    // Function name (available immediately)
  willContinue: boolean;           // True if more args are coming
  partialArgs?: Array<{
    jsonPath: string;              // e.g., "$.location", "$.target"
    stringValue: string;           // Current value
    willContinue: boolean;         // More updates for this arg?
  }>;
  /** Accumulated args so far (built from partialArgs) */
  accumulatedArgs: Record<string, unknown>;
  /** True when this is the final chunk (function call complete) */
  isComplete: boolean;
}

/**
 * Callback for partial function calls during streaming
 * Called immediately when function name is known, then as args stream in
 */
export type OnPartialFunctionCallCallback = (partial: PartialFunctionCall) => void;

/**
 * Multimodal data for function responses (Gemini 3)
 * Allows returning images/PDFs alongside text in tool results
 * 
 * @see https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling#multimodal-response
 */
export interface MultimodalData {
  /** Base64-encoded data */
  data: string;
  /** MIME type: image/png, image/jpeg, application/pdf, etc. */
  mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' | 'application/pdf';
}

/**
 * Multimodal function response for Gemini 3
 * Can include text, images, and PDFs in the response to a tool call
 * 
 * Example usage:
 *   const response: MultimodalFunctionResponse = {
 *     text: "Here's a vocabulary card for 'gato' (cat)",
 *     images: [{
 *       data: base64ImageData,
 *       mimeType: 'image/png'
 *     }]
 *   };
 */
export interface MultimodalFunctionResponse {
  /** Text content - will be included in response.summary or similar */
  text?: string;
  /** Array of images (base64 encoded) */
  images?: MultimodalData[];
  /** Array of PDFs (base64 encoded) - tokens count under IMAGE modality */
  pdfs?: MultimodalData[];
  /** Structured data (JSON-serializable) */
  data?: Record<string, unknown>;
}

/**
 * Helper to create a function response with multimodal content
 * Converts MultimodalFunctionResponse to Gemini-compatible format
 * 
 * Gemini 3 expects multimodal function responses with response.output as array of parts:
 * {
 *   name: "function_name",
 *   response: {
 *     output: [
 *       { text: "summary text" },
 *       { inlineData: { mimeType: "image/png", data: "base64..." } }
 *     ]
 *   }
 * }
 * 
 * IMPORTANT: For history serialization, callers should be aware that large base64
 * blobs may need truncation or separate storage for efficiency. Consider using
 * createMultimodalFunctionResponseTextOnly() when replaying history.
 * 
 * @param fnName - The function name this response is for
 * @param response - The multimodal response with text, images, PDFs, and/or data
 * @returns Gemini-compatible function response ready for the API
 */
export function createMultimodalFunctionResponse(
  fnName: string,
  response: MultimodalFunctionResponse
): { name: string; response: Record<string, unknown> } {
  // Build output parts array (Gemini's multimodal format uses "output" field)
  const outputParts: Array<Record<string, unknown>> = [];
  
  // Text part first
  if (response.text) {
    outputParts.push({ text: response.text });
  }
  
  // Structured data as text (JSON stringified)
  if (response.data && Object.keys(response.data).length > 0) {
    outputParts.push({ text: JSON.stringify(response.data) });
  }
  
  // Image parts with inlineData format (Gemini's expected schema)
  if (response.images && response.images.length > 0) {
    for (const img of response.images) {
      outputParts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data
        }
      });
    }
  }
  
  // PDF parts with inlineData format
  if (response.pdfs && response.pdfs.length > 0) {
    for (const pdf of response.pdfs) {
      outputParts.push({
        inlineData: {
          mimeType: pdf.mimeType,
          data: pdf.data
        }
      });
    }
  }
  
  return {
    name: fnName,
    response: { output: outputParts }
  };
}

/**
 * Create a text-only version of a multimodal function response for history replay
 * Strips inline data to avoid bloating conversation context
 * 
 * @param fnName - The function name this response is for
 * @param response - The multimodal response 
 * @returns Lightweight function response with media counts instead of blobs
 */
export function createMultimodalFunctionResponseTextOnly(
  fnName: string,
  response: MultimodalFunctionResponse
): { name: string; response: Record<string, unknown> } {
  const summary: string[] = [];
  
  if (response.text) {
    summary.push(response.text);
  }
  
  if (response.images && response.images.length > 0) {
    summary.push(`[${response.images.length} image(s) displayed]`);
  }
  
  if (response.pdfs && response.pdfs.length > 0) {
    summary.push(`[${response.pdfs.length} document(s) displayed]`);
  }
  
  // For history replay, use output array with text-only content
  return {
    name: fnName,
    response: { output: [{ text: summary.join(' ') }] }
  };
}

/**
 * Gemini 3 thinking levels for latency/quality tradeoff
 * 
 * NOTE: The @google/genai SDK only supports LOW and HIGH.
 * 'MINIMAL' and 'MEDIUM' are aliases that map to these values:
 * - MINIMAL/LOW: Fastest responses, low reasoning depth (best for voice)
 * - MEDIUM/HIGH: Maximum reasoning depth (for complex decisions, assessment)
 * 
 * If you pass 'MINIMAL', it will be mapped to 'LOW' for the API.
 * If you pass 'MEDIUM', it will be mapped to 'HIGH' for the API.
 */
export type ThinkingLevel = 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Gemini 3 conversation history entry with support for thought signatures
 * 
 * Simple format (backwards compatible):
 *   { role: 'user' | 'model', content: 'text' }
 * 
 * Rich format (for function calls with thought signatures):
 *   { role: 'model', parts: [{ functionCall: {...}, thought_signature: '...' }] }
 * 
 * @see https://docs.cloud.google.com/vertex-ai/generative-ai/docs/thought-signatures
 */
export interface ConversationHistoryEntry {
  role: 'user' | 'model' | 'tool';
  content?: string;  // Simple text content
  /** 
   * Gemini-native parts array for rich content (function calls, responses, signatures)
   * If provided, takes precedence over content field
   */
  parts?: Array<{
    text?: string;
    functionCall?: { name: string; args: Record<string, unknown> };
    functionResponse?: { name: string; response: Record<string, unknown> };
    thought_signature?: string;  // Gemini 3 thought signature - MUST pass back
  }>;
  /**
   * Accumulated thought signatures from this turn (for multi-step function calling)
   * Gemini 3 requires these to be passed back in subsequent requests
   */
  thoughtSignatures?: string[];
}

/**
 * Configuration for streaming generation
 */
export interface StreamingGenerationConfig {
  systemPrompt: string;
  conversationHistory: Array<ConversationHistoryEntry>;
  userMessage: string;
  model?: string;  // Default: gemini-3-flash-preview
  temperature?: number;
  maxOutputTokens?: number;
  onSentence: OnSentenceCallback;
  onSentenceEnqueued?: (chunk: SentenceChunk) => void;
  onProgress?: OnProgressCallback;
  onError?: (error: Error) => void;
  // Gemini 3 features
  enableFunctionCalling?: boolean;  // Enable native tool calling
  allowedFunctions?: string[];  // Optional allowlist of function names (e.g., ['subtitle', 'show_overlay'])
  onFunctionCall?: OnFunctionCallCallback;  // Callback when functions are called
  thinkingLevel?: ThinkingLevel;  // MINIMAL for voice speed, MEDIUM for complex decisions
  // Streaming function calls (Gemini 3)
  streamFunctionCallArguments?: boolean;  // Enable partial argument streaming
  onPartialFunctionCall?: OnPartialFunctionCallCallback;  // Called as function name/args stream in
  // Context caching
  enableContextCaching?: boolean;  // Enable system prompt caching (90% cost reduction)
  // Early abort signal - allows caller to stop stream iteration when all needed content is received
  abortSignal?: { aborted: boolean };
}

/**
 * Result of streaming generation
 */
export interface StreamingGenerationResult {
  fullText: string;
  sentenceCount: number;
  totalTokens: number;
  durationMs: number;
  functionCallCount?: number;  // Number of native function calls processed
}

/**
 * Context cache entry for tracking cached system prompts
 */
interface ContextCacheEntry {
  cacheName: string;
  model: string;
  promptHash: string;
  createdAt: number;
  expiresAt: number;
  tokenCount?: number;
}

/**
 * Failed cache attempt entry (to avoid retrying failed models)
 */
interface CacheFailureEntry {
  model: string;
  promptHash: string;
  failedAt: number;
  reason: string;
}

/**
 * Minimum tokens required for context caching (Gemini requirement)
 */
const MIN_CACHE_TOKENS = 2048;

/**
 * Cache TTL in seconds (55 minutes to allow refresh before default 60min expiry)
 */
const CACHE_TTL_SECONDS = 55 * 60;

/**
 * Failure memoization TTL (retry after 10 minutes)
 */
const CACHE_FAILURE_TTL_MS = 10 * 60 * 1000;

/**
 * Models known to support context caching
 * Includes versioned models (-001, -002) and preview models
 * Gemini 3 Flash Preview supports caching per Google documentation (Dec 2025)
 */
const CACHE_COMPATIBLE_MODELS = [
  'gemini-1.5-flash-001',
  'gemini-1.5-flash-002', 
  'gemini-1.5-pro-001',
  'gemini-1.5-pro-002',
  'gemini-2.0-flash-001',
  'gemini-2.5-flash-001',
  'gemini-2.5-pro-001',
  'gemini-3-flash-preview',  // Confirmed cache support (Dec 2025)
];

/**
 * Default cache-compatible model for when caching is enabled
 * Used as fallback when the requested model doesn't support caching
 */
const DEFAULT_CACHE_MODEL = 'gemini-2.5-flash-001';

/**
 * Check if a model supports context caching
 */
function isCacheCompatibleModel(model: string): boolean {
  // Check exact match first
  if (CACHE_COMPATIBLE_MODELS.includes(model)) {
    return true;
  }
  // Check if model has version suffix pattern (-NNN)
  return /-\d{3}$/.test(model);
}

/**
 * Get a cache-compatible version of a model
 * Returns the original model if compatible, or a fallback versioned model
 * Gemini 3 Flash Preview now supports caching (Dec 2025) - no downgrade needed
 */
function getCacheCompatibleModel(model: string): string {
  if (isCacheCompatibleModel(model)) {
    return model;
  }
  
  // Gemini 3 Flash: Now in CACHE_COMPATIBLE_MODELS, so this is a fallback
  // for any future Gemini 3 variant not yet listed
  if (model.includes('gemini-3')) {
    return 'gemini-3-flash-preview';  // Use preview which supports caching
  }
  
  // Map preview models to their versioned equivalents
  if (model.includes('gemini-2.5')) {
    return DEFAULT_CACHE_MODEL;  // Use 2.5 flash for caching
  }
  if (model.includes('gemini-2.0')) {
    return 'gemini-2.0-flash-001';
  }
  if (model.includes('gemini-1.5-pro')) {
    return 'gemini-1.5-pro-002';
  }
  if (model.includes('gemini-1.5-flash')) {
    return 'gemini-1.5-flash-002';
  }
  
  // Default fallback
  return DEFAULT_CACHE_MODEL;
}

/**
 * Simple hash function for cache keys
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Estimate token count (rough approximation: ~4 chars per token)
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Gemini Streaming Service
 * Handles streaming text generation with sentence-level chunking
 */
export class GeminiStreamingService {
  private client: GoogleGenAI;
  private defaultModel: string;
  
  // Context cache registry: model+hash -> cache entry
  private contextCacheRegistry: Map<string, ContextCacheEntry> = new Map();
  
  // Failed cache attempts: model+hash -> failure entry (to avoid retrying)
  private cacheFailureRegistry: Map<string, CacheFailureEntry> = new Map();
  
  // Stats for monitoring
  private cacheStats = {
    hits: 0,
    misses: 0,
    creates: 0,
    errors: 0,
    skipped: 0,  // Skipped due to incompatible model or memoized failure
    tokensSaved: 0,
  };
  
  constructor() {
    this.client = new GoogleGenAI({
      apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || '',
      httpOptions: {
        apiVersion: "",
        baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
        // Extended timeout for complex AI responses (default is 60s which can timeout on long conversations)
        timeout: 180000, // 3 minutes in milliseconds
      },
    });
    // Using Gemini 3 Flash preview for latest capabilities
    this.defaultModel = 'gemini-3-flash-preview';
  }
  
  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return {
      ...this.cacheStats,
      activeCaches: this.contextCacheRegistry.size,
      hitRate: this.cacheStats.hits + this.cacheStats.misses > 0 
        ? (this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) * 100).toFixed(1) + '%'
        : '0%',
    };
  }
  
  /**
   * Get or create a context cache for the given system prompt
   * Returns the cache name if successful, null if caching not possible
   * 
   * Note: Automatically maps to a cache-compatible model if the requested model
   * doesn't support caching (e.g., gemini-3-flash-preview -> gemini-2.5-flash-001)
   */
  private async getOrCreateContextCache(
    systemPrompt: string,
    requestedModel: string
  ): Promise<string | null> {
    // Get a cache-compatible model (may differ from requested model)
    const cacheModel = getCacheCompatibleModel(requestedModel);
    const promptHash = hashString(systemPrompt);
    const cacheKey = `${cacheModel}:${promptHash}`;
    
    // Log model mapping if different
    if (cacheModel !== requestedModel) {
      console.log(`[Gemini Cache] Mapping ${requestedModel} → ${cacheModel} for caching`);
    }
    
    // Check for memoized failure
    const failure = this.cacheFailureRegistry.get(cacheKey);
    if (failure && (Date.now() - failure.failedAt) < CACHE_FAILURE_TTL_MS) {
      this.cacheStats.skipped++;
      return null;
    }
    
    // Check if we have a valid cached entry
    const existing = this.contextCacheRegistry.get(cacheKey);
    if (existing && existing.expiresAt > Date.now()) {
      this.cacheStats.hits++;
      this.cacheStats.tokensSaved += existing.tokenCount || 0;
      console.log(`[Gemini Cache] ✓ Cache hit for ${cacheKey.substring(0, 20)}... (saved ~${existing.tokenCount} tokens)`);
      return existing.cacheName;
    }
    
    // Check if prompt is large enough for caching
    const estimatedTokens = estimateTokenCount(systemPrompt);
    if (estimatedTokens < MIN_CACHE_TOKENS) {
      console.log(`[Gemini Cache] Skip: prompt too small (${estimatedTokens} < ${MIN_CACHE_TOKENS} tokens)`);
      return null;
    }
    
    this.cacheStats.misses++;
    
    try {
      // Create new context cache with the cache-compatible model
      console.log(`[Gemini Cache] Creating cache for ~${estimatedTokens} tokens with model ${cacheModel}...`);
      
      const cache = await this.client.caches.create({
        model: cacheModel,
        config: {
          systemInstruction: systemPrompt,
          ttl: `${CACHE_TTL_SECONDS}s`,
        },
      });
      
      if (!cache.name) {
        throw new Error('Cache created but no name returned');
      }
      
      // Store in registry
      const entry: ContextCacheEntry = {
        cacheName: cache.name,
        model: cacheModel,
        promptHash,
        createdAt: Date.now(),
        expiresAt: Date.now() + (CACHE_TTL_SECONDS * 1000),
        tokenCount: estimatedTokens,
      };
      
      this.contextCacheRegistry.set(cacheKey, entry);
      this.cacheStats.creates++;
      
      // Clear any previous failure for this key
      this.cacheFailureRegistry.delete(cacheKey);
      
      console.log(`[Gemini Cache] ✓ Created cache: ${cache.name} (expires in ${CACHE_TTL_SECONDS}s)`);
      return cache.name;
      
    } catch (error: any) {
      this.cacheStats.errors++;
      
      // Memoize the failure to avoid retrying
      this.cacheFailureRegistry.set(cacheKey, {
        model: cacheModel,
        promptHash,
        failedAt: Date.now(),
        reason: error.message,
      });
      
      console.warn(`[Gemini Cache] Failed to create cache (memoized for ${CACHE_FAILURE_TTL_MS / 60000}min): ${error.message}`);
      // Fall back to non-cached mode
      return null;
    }
  }
  
  /**
   * Clean up expired cache entries from registry
   */
  private cleanupExpiredCaches() {
    const now = Date.now();
    let cleaned = 0;
    
    // Use Array.from() to avoid downlevelIteration requirement
    const entries = Array.from(this.contextCacheRegistry.entries());
    for (const [key, entry] of entries) {
      if (entry.expiresAt < now) {
        this.contextCacheRegistry.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[Gemini Cache] Cleaned ${cleaned} expired cache entries`);
    }
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
      onSentenceEnqueued,
      onProgress,
      onError,
      // Gemini 3 features
      enableFunctionCalling = false,
      onFunctionCall,
      thinkingLevel = 'MINIMAL',  // Default to fastest for voice
      // Streaming function calls (Gemini 3)
      streamFunctionCallArguments = false,
      onPartialFunctionCall,
      // Context caching
      enableContextCaching = false,
      // Early abort
      abortSignal,
    } = config;
    
    // Clean up expired caches periodically
    this.cleanupExpiredCaches();
    
    console.log(`[Gemini Streaming] Starting with model: ${model}, thinking: ${thinkingLevel}, tools: ${enableFunctionCalling}, caching: ${enableContextCaching}`);
    
    // Build conversation contents in Gemini format
    // Supports both simple text format and rich parts format (for function calls with thought signatures)
    const contents: Content[] = conversationHistory.map(msg => {
      // Rich format: use parts directly if provided
      if (msg.parts && msg.parts.length > 0) {
        // Convert our internal parts format to Gemini SDK format
        const geminParts: Part[] = msg.parts.map(part => {
          // Build the part object for Gemini SDK
          const geminiPart: any = {};
          
          if (part.text) {
            geminiPart.text = part.text;
          }
          if (part.functionCall) {
            geminiPart.functionCall = part.functionCall;
          }
          if (part.functionResponse) {
            geminiPart.functionResponse = part.functionResponse;
          }
          // CRITICAL: Include thought_signature for Gemini 3 multi-step function calling
          if (part.thought_signature) {
            geminiPart.thought_signature = part.thought_signature;
          }
          
          return geminiPart as Part;
        });
        
        return {
          role: msg.role === 'tool' ? 'tool' : (msg.role === 'user' ? 'user' : 'model'),
          parts: geminParts,
        } as Content;
      }
      
      // Simple format: wrap content in text part (backwards compatible)
      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content || '' }] as Part[],
      };
    });
    
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
    let firstSentenceEmitted = false;
    
    // Stream timeout state (declared here so catch block can clean up)
    let streamTimeoutId: NodeJS.Timeout | null = null;
    
    // SENTENCE-LEVEL PIPELINING: Process TTS in order without blocking Gemini stream
    // Instead of `await onSentence(chunk)` which blocks token streaming while TTS runs,
    // we queue sentences and process them sequentially in the background.
    // This lets Gemini keep generating sentence N+1 while sentence N is being synthesized.
    const sentenceQueue: SentenceChunk[] = [];
    let sentenceQueueProcessing = false;
    let sentenceQueueError: Error | null = null;
    let sentenceQueueResolve: (() => void) | null = null;
    let sentenceQueueDone = false; // Set true when Gemini stream ends
    
    const processSentenceQueue = async () => {
      if (sentenceQueueProcessing) return; // Already running
      sentenceQueueProcessing = true;
      
      try {
        while (sentenceQueue.length > 0) {
          const nextChunk = sentenceQueue.shift()!;
          try {
            await onSentence(nextChunk);
          } catch (err: any) {
            if (!sentenceQueueError) sentenceQueueError = err;
            console.error(`[Gemini Streaming] Sentence queue error on sentence ${nextChunk.index}:`, err.message);
          }
        }
      } finally {
        sentenceQueueProcessing = false;
        if (sentenceQueueDone && sentenceQueue.length === 0 && sentenceQueueResolve) {
          sentenceQueueResolve();
        }
      }
    };
    
    const enqueueSentence = (chunk: SentenceChunk) => {
      sentenceQueue.push(chunk);
      if (onSentenceEnqueued) {
        try { onSentenceEnqueued(chunk); } catch {}
      }
      processSentenceQueue();
    };
    
    // Wait for all queued sentences to finish TTS processing
    const drainSentenceQueue = (): Promise<void> => {
      sentenceQueueDone = true;
      if (sentenceQueue.length === 0 && !sentenceQueueProcessing) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        sentenceQueueResolve = resolve;
        // If queue isn't currently processing, kick it off
        if (!sentenceQueueProcessing && sentenceQueue.length > 0) {
          processSentenceQueue();
        }
        // Safety timeout: prevent infinite hang if queue gets stuck
        setTimeout(() => {
          if (sentenceQueueResolve === resolve) {
            console.warn(`[Gemini Streaming] Sentence queue drain timeout after 30s (${sentenceQueue.length} items remaining, processing=${sentenceQueueProcessing})`);
            resolve();
          }
        }, 30000);
      });
    };
    
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
          enqueueSentence(chunk);
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
          // Build generation config with Gemini 3 features
          const generationConfig: Record<string, any> = {
            temperature,
            maxOutputTokens,
          };
          
          // Determine the model to use for this request
          // May switch to cache-compatible model when caching is enabled
          let requestModel = model;
          
          // Try to use context caching if enabled
          let usingCachedContext = false;
          if (enableContextCaching) {
            const cacheName = await this.getOrCreateContextCache(systemPrompt, model);
            if (cacheName) {
              generationConfig.cachedContent = cacheName;
              usingCachedContext = true;
              // CRITICAL: Must use the cache-compatible model for the request
              // Otherwise Gemini won't honor the cached content
              requestModel = getCacheCompatibleModel(model);
            } else {
              // Fall back to inline system instruction
              generationConfig.systemInstruction = systemPrompt;
            }
          } else {
            // No caching - use inline system instruction
            generationConfig.systemInstruction = systemPrompt;
          }
          
          // Add thinking level if model supports it (Gemini 3+)
          // Gemini 3 uses thinkingConfig with thinkingLevel (nested object)
          // Thinking output is hidden in thoughtSignature, not mixed into part.text
          // API accepts: MINIMAL, LOW, MEDIUM, HIGH (though SDK enum only has LOW/HIGH)
          // MINIMAL = "uses as few tokens as possible" - closest to zero thinking
          if (requestModel.includes('gemini-3')) {
            // Gemini 3: Use thinkingConfig with nested thinkingLevel
            // Pass as string to use MINIMAL (not in SDK enum but API accepts it)
            const level = thinkingLevel.toUpperCase();  // MINIMAL, LOW, MEDIUM, or HIGH
            generationConfig.thinkingConfig = { thinkingLevel: level as any };
            console.log(`[Gemini Streaming] ThinkingConfig set: { thinkingLevel: ${level} }`);
          } else if (requestModel.includes('gemini-2.5')) {
            // Gemini 2.5 still uses deprecated thinkingBudget (numeric tokens) in nested object
            generationConfig.thinkingConfig = { 
              thinkingBudget: (thinkingLevel === 'MINIMAL' || thinkingLevel === 'LOW') ? 256 : 
                             thinkingLevel === 'MEDIUM' ? 1024 : 4096 
            };
          }
          
          // Add tools if function calling is enabled
          if (enableFunctionCalling) {
            generationConfig.tools = createDanielaTools(config.allowedFunctions);
            
            // NOTE: streamFunctionCallArguments was planned for early intent detection but
            // is NOT yet supported by the Gemini API (causes "parameter not supported" error)
            // Keeping the code commented for future use when API support is added
            // if (streamFunctionCallArguments && requestModel.includes('gemini-3')) {
            //   const existingToolConfig = generationConfig.toolConfig || {};
            //   const existingFunctionCallingConfig = existingToolConfig.functionCallingConfig || {};
            //   generationConfig.toolConfig = {
            //     ...existingToolConfig,
            //     functionCallingConfig: {
            //       ...existingFunctionCallingConfig,
            //       streamFunctionCallArguments: true,
            //     },
            //   };
            //   console.log(`[Gemini Streaming] Streaming function call arguments ENABLED`);
            // }
          }
          
          if (usingCachedContext) {
            console.log(`[Gemini Streaming] Using cached context with model ${requestModel} (90% cost savings)`);
          }
          
          result = await this.client.models.generateContentStream({
            model: requestModel,
            contents,
            config: generationConfig,
          });
          break; // Success, exit retry loop
        } catch (error: any) {
          lastError = error;
          const status = error.status || error.code;
          const errorMessage = error.message || '';
          const isRateLimit = status === 429 || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('Too Many Requests');
          const isServerError = status >= 500 && status < 600;
          
          // Retry on rate limit (429) or server errors (5xx)
          if ((isRateLimit || isServerError) && attempt < maxRetries - 1) {
            // Longer backoff for rate limits (2s, 4s, 6s) vs server errors (0.5s, 1s, 1.5s)
            const backoffMs = isRateLimit ? 2000 * (attempt + 1) : 500 * (attempt + 1);
            console.log(`[Gemini Streaming] Retry ${attempt + 1}/${maxRetries} after ${isRateLimit ? 'rate limit' : status} error (waiting ${backoffMs}ms)`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            continue;
          }
          throw error;
        }
      }
      
      if (!result) {
        throw lastError || new Error('Failed to start Gemini stream');
      }
      
      // Track function calls across the stream
      let functionCallsProcessed = 0;
      
      // Track streaming partial function calls (Gemini 3)
      // Maps callIndex -> accumulated state as args stream in
      // Using index instead of name to handle repeated calls to same function
      let nextCallIndex = 0;
      const partialFunctionCalls: Map<number, {
        callIndex: number;
        name: string;
        accumulatedArgs: Record<string, unknown>;
        firstSeenTime: number;
      }> = new Map();
      
      // TTFB tracking: Time from request to first chunk
      const geminiRequestTime = Date.now();
      let firstChunkReceived = false;
      
      // STREAM TIMEOUT: Prevent indefinite hangs when Gemini stalls
      // Voice target is <3s total response. First chunk allows for thinking overhead,
      // but we abort early enough for the fallback to still feel responsive.
      const FIRST_CHUNK_TIMEOUT_MS = 10000; // 10s for initial thinking + first token
      const INTER_CHUNK_TIMEOUT_MS = 8000;  // 8s between subsequent chunks (generous for slow networks)
      let streamTimedOut = false;
      
      const clearStreamTimeout = () => {
        if (streamTimeoutId) {
          clearTimeout(streamTimeoutId);
          streamTimeoutId = null;
        }
      };
      
      const resetStreamTimeout = () => {
        clearStreamTimeout();
        const timeoutMs = firstChunkReceived ? INTER_CHUNK_TIMEOUT_MS : FIRST_CHUNK_TIMEOUT_MS;
        streamTimeoutId = setTimeout(() => {
          streamTimedOut = true;
          const elapsed = Date.now() - geminiRequestTime;
          const phase = firstChunkReceived ? 'inter-chunk' : 'first-chunk';
          console.error(`[Gemini Streaming] STREAM TIMEOUT (${phase}) after ${elapsed}ms - aborting to prevent hang`);
          console.error(`[Gemini Streaming] State at timeout: ${chunkCount} chunks received, ${buffer.length} chars buffered, ${sentenceIndex} sentences emitted`);
        }, timeoutMs);
      };
      
      resetStreamTimeout();
      
      // Process streamed tokens
      let chunkCount = 0;
      let lastLogTime = Date.now();
      let lastFinishReason: string | undefined;
      for await (const chunk of result) {
        if (streamTimedOut) {
          console.warn(`[Gemini Streaming] Breaking out of stream loop after timeout`);
          break;
        }
        
        // EARLY ABORT: Caller signals that all needed content has been received
        // (e.g., function call text already sent to TTS - no need to wait for stream close)
        if (abortSignal?.aborted) {
          const elapsed = Date.now() - geminiRequestTime;
          console.log(`[Gemini Streaming] Early abort at ${elapsed}ms - caller received all needed content`);
          break;
        }
        
        resetStreamTimeout();
        chunkCount++;
        
        // Log TTFB on first chunk
        if (!firstChunkReceived) {
          firstChunkReceived = true;
          const ttfb = Date.now() - geminiRequestTime;
          console.log(`[Gemini Streaming] TTFB: ${ttfb}ms (time-to-first-token from Gemini)`);
        }
        
        // Track finishReason from candidates (last chunk with a reason wins)
        const chunkFinishReason = (chunk as any).candidates?.[0]?.finishReason;
        if (chunkFinishReason) {
          lastFinishReason = chunkFinishReason;
        }
        
        // Debug: Log chunk activity every 5 seconds during long waits
        const now = Date.now();
        if (now - lastLogTime > 5000) {
          console.log(`[Gemini Streaming DEBUG] Chunk ${chunkCount} at ${now - geminiRequestTime}ms, buffer: ${buffer.length} chars, sentences: ${sentenceIndex}`);
          lastLogTime = now;
        }
        // Extract function calls from this chunk (Gemini 3 native tool calling)
        // Note: Function call handling is fire-and-forget to avoid blocking token streaming
        if (enableFunctionCalling) {
          // STREAMING FUNCTION CALLS: Handle partial arguments for early intent detection
          // When streamFunctionCallArguments is enabled, we get:
          // 1. Initial: { functionCall: { name: "...", willContinue: true } }
          // 2. Partial: { functionCall: { partialArgs: [...], willContinue: true } }
          // 3. Final: { functionCall: {} } (empty = complete)
          if (streamFunctionCallArguments && onPartialFunctionCall) {
            const candidates = chunk.candidates || [];
            for (const candidate of candidates) {
              const parts = candidate?.content?.parts || [];
              for (const part of parts) {
                const partAny = part as any;
                if (partAny.functionCall) {
                  const fc = partAny.functionCall;
                  
                  // Initial function name announcement (new call)
                  if (fc.name && fc.willContinue) {
                    const callIndex = nextCallIndex++;
                    partialFunctionCalls.set(callIndex, {
                      callIndex,
                      name: fc.name,
                      accumulatedArgs: {},
                      firstSeenTime: Date.now(),
                    });
                    const partialCall: PartialFunctionCall = {
                      callIndex,
                      name: fc.name,
                      willContinue: true,
                      accumulatedArgs: {},
                      isComplete: false,
                    };
                    console.log(`[Gemini Streaming] Partial FC #${callIndex}: ${fc.name} detected (early intent)`);
                    onPartialFunctionCall(partialCall);
                  }
                  // Partial args streaming (applies to most recent call)
                  else if (fc.partialArgs && Array.isArray(fc.partialArgs)) {
                    // Get the most recent pending call (highest index)
                    const pendingCalls = Array.from(partialFunctionCalls.values());
                    const lastFn = pendingCalls[pendingCalls.length - 1];
                    if (lastFn) {
                      for (const arg of fc.partialArgs) {
                        // Parse jsonPath like "$.location" -> "location"
                        const key = arg.jsonPath?.replace(/^\$\./, '') || 'unknown';
                        lastFn.accumulatedArgs[key] = arg.stringValue;
                      }
                      const partialCall: PartialFunctionCall = {
                        callIndex: lastFn.callIndex,
                        name: lastFn.name,
                        willContinue: fc.willContinue !== false,
                        partialArgs: fc.partialArgs,
                        accumulatedArgs: { ...lastFn.accumulatedArgs },
                        isComplete: false,
                      };
                      onPartialFunctionCall(partialCall);
                    }
                  }
                  // Final empty function call = complete
                  else if (Object.keys(fc).length === 0 || fc.willContinue === false) {
                    const pendingCalls = Array.from(partialFunctionCalls.values());
                    const lastFn = pendingCalls[pendingCalls.length - 1];
                    if (lastFn) {
                      const latencyMs = Date.now() - lastFn.firstSeenTime;
                      console.log(`[Gemini Streaming] Partial FC #${lastFn.callIndex}: ${lastFn.name} complete (${latencyMs}ms streaming)`);
                      const partialCall: PartialFunctionCall = {
                        callIndex: lastFn.callIndex,
                        name: lastFn.name,
                        willContinue: false,
                        accumulatedArgs: { ...lastFn.accumulatedArgs },
                        isComplete: true,
                      };
                      onPartialFunctionCall(partialCall);
                      partialFunctionCalls.delete(lastFn.callIndex);
                    }
                  }
                }
              }
            }
          }
          
          // Complete function calls (non-streaming or after streaming complete)
          if (onFunctionCall) {
            const functionCalls = extractFunctionCalls(chunk);
            if (functionCalls.length > 0) {
              const elapsed = Date.now() - geminiRequestTime;
              console.log(`[Gemini Streaming] Function calls detected at ${elapsed}ms: ${functionCalls.map(f => f.name).join(', ')}`);
              // Non-blocking: queue the function call handler without awaiting
              onFunctionCall(functionCalls).catch(err => 
                console.error('[Gemini Streaming] Function call handler error:', err.message)
              );
              functionCallsProcessed += functionCalls.length;
            }
          }
        }
        
        // Filter chunks by part type: only use 'text' parts, skip 'thought' parts
        // Gemini 3's thinking mode outputs reasoning that should NOT be spoken
        // Process ALL candidates to ensure no thought content leaks through
        let text = '';
        const candidates = chunk.candidates || [];
        
        if (candidates.length > 0) {
          // Process all candidates (usually just 1, but be thorough)
          for (const candidate of candidates) {
            const parts = candidate?.content?.parts || [];
            for (const part of parts) {
              // Skip thought/reasoning parts - check multiple possible locations:
              // 1. Gemini 2.5: part.thought boolean
              // 2. Gemini 3: part.metadata.thought or part.metadata.annotations array with {name: 'THOUGHT'/'REASONING'}
              // Cast to any to access dynamic properties that may not be in SDK types yet
              const partAny = part as any;
              
              // Check annotations array for thought/reasoning objects
              // Gemini 3 uses annotation objects like {name: 'THOUGHT'} not plain strings
              const hasThoughtAnnotation = Array.isArray(partAny.metadata?.annotations) && 
                partAny.metadata.annotations.some((a: any) => 
                  a?.name === 'THOUGHT' || a?.name === 'REASONING' || 
                  a === 'THOUGHT' || a === 'REASONING' // Handle both object and string formats
                );
              
              const isThought = partAny.thought || 
                partAny.metadata?.thought || 
                hasThoughtAnnotation;
              
              if (part.text && !isThought) {
                text += part.text;
              } else if (isThought && part.text) {
                // Log thought content for debugging but don't include in spoken output
                console.log(`[Gemini Streaming] Thought (filtered): "${part.text.substring(0, 80)}..."`);
              }
            }
          }
        } else if (chunk.text) {
          // Fallback for non-Gemini 3 models - apply regex filter as safety net
          // This catches any internal reasoning patterns that slip through
          text = stripInternalNotationTags(chunk.text);
        }
        
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
          // TTS safety cap: split oversized sentences at clause breaks
          const safeSentences = this.capSentenceForTTS(sentence);
          const wasSplit = safeSentences.length > 1;
          
          for (let i = 0; i < safeSentences.length; i++) {
            const safeSentence = safeSentences[i];
            const isLastFragment = i === safeSentences.length - 1;
            
            const chunk: SentenceChunk = {
              index: sentenceIndex++,
              text: safeSentence,
              // Only the final fragment of a split sentence (or unsplit) is "complete"
              isComplete: wasSplit ? isLastFragment : true,
              isFinal: false,
            };
            
            // Telemetry: log sentence length for monitoring
            const lenWarning = safeSentence.length > 400 ? ' [NEAR TTS LIMIT]' : '';
            const splitInfo = wasSplit ? ` [SPLIT ${i + 1}/${safeSentences.length}]` : '';
            console.log(`[Gemini Streaming] Sentence ${chunk.index} (${safeSentence.length} chars${lenWarning}${splitInfo}): "${safeSentence.substring(0, 50)}..."`);
            
            // Log first sentence latency (total time from request to first speakable content)
            if (!firstSentenceEmitted) {
              firstSentenceEmitted = true;
              const firstSentenceTime = Date.now() - startTime;
              console.log(`[Gemini Streaming] First sentence ready in ${firstSentenceTime}ms (total request → speakable content)`);
            }
            enqueueSentence(chunk);
          }
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
            enqueueSentence(chunk);
            buffer = buffer.substring(forcedBreak).trim();
          }
        }
      }
      
      // Clear stream timeout and flush timeout
      clearStreamTimeout();
      if (flushTimeoutId) {
        clearTimeout(flushTimeoutId);
      }
      
      // If stream timed out, notify via onError callback
      if (streamTimedOut) {
        const timeoutError = new Error(`Gemini stream timed out after ${Date.now() - geminiRequestTime}ms (${chunkCount} chunks received, ${fullText.length} chars)`);
        onError?.(timeoutError);
      }
      
      // TRUNCATION DETECTION: Log if Gemini stopped due to token limit
      if (lastFinishReason && lastFinishReason !== 'STOP') {
        console.warn(`[Gemini Streaming] ⚠️ FINISH REASON: ${lastFinishReason} — response may be truncated (${fullText.length} chars, ${functionCallsProcessed} FCs)`);
      } else if (lastFinishReason === 'STOP') {
        console.log(`[Gemini Streaming] finishReason: STOP (normal completion)`);
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
        enqueueSentence(chunk);
      }
      
      // PIPELINING: Wait for all queued sentences to finish TTS processing
      // Gemini text generation is done, but TTS may still be processing earlier sentences
      const drainStart = Date.now();
      await drainSentenceQueue();
      const drainMs = Date.now() - drainStart;
      if (drainMs > 50) {
        console.log(`[Gemini Streaming] Pipeline drain: waited ${drainMs}ms for TTS queue to finish`);
      }
      
      // Re-throw any sentence processing error that occurred in the queue
      if (sentenceQueueError) {
        throw sentenceQueueError;
      }
      
      const durationMs = Date.now() - startTime;
      const functionCallLog = functionCallsProcessed > 0 ? `, ${functionCallsProcessed} function calls` : '';
      const timeoutLog = streamTimedOut ? ' [TIMED OUT]' : '';
      const finishReasonLog = lastFinishReason && lastFinishReason !== 'STOP' ? ` [${lastFinishReason}]` : '';
      console.log(`[Gemini Streaming] Complete: ${sentenceIndex} sentences, ${fullText.length} chars${functionCallLog} in ${durationMs}ms${timeoutLog}${finishReasonLog}`);
      
      return {
        fullText,
        sentenceCount: sentenceIndex,
        totalTokens: Math.ceil(fullText.length / 4), // Rough estimate
        durationMs,
        functionCallCount: functionCallsProcessed || undefined,
      };
      
    } catch (error: any) {
      console.error(`[Gemini Streaming] Error:`, error.message);
      
      // GRACEFUL RECOVERY: If we got truncated JSON (function call cut off), 
      // but already streamed some content, return what we have instead of failing
      const isJsonTruncation = error.message?.includes('Incomplete JSON segment');
      const hasContent = fullText.length > 0 || sentenceIndex > 0;
      
      if (isJsonTruncation && hasContent) {
        console.log(`[Gemini Streaming] ⚠️ JSON TRUNCATION RECOVERED - returning ${sentenceIndex} sentences, ${fullText.length} chars (function call may have been lost)`);
        // Log to telemetry for monitoring frequency
        console.log(`[TELEMETRY] gemini_json_truncation: recovered=true, sentences=${sentenceIndex}, chars=${fullText.length}`);
        
        // Clear pending timeouts
        if (streamTimeoutId) {
          clearTimeout(streamTimeoutId);
        }
        if (flushTimeoutId) {
          clearTimeout(flushTimeoutId);
        }
        
        // Emit remaining buffer if any
        buffer = stripInternalNotationTags(buffer);
        if (buffer.trim()) {
          const chunk: SentenceChunk = {
            index: sentenceIndex++,
            text: buffer.trim(),
            isComplete: this.endsWithSentencePunctuation(buffer),
            isFinal: true,
          };
          console.log(`[Gemini Streaming] Recovery final: "${chunk.text.substring(0, 50)}..."`);
          enqueueSentence(chunk);
        }
        
        // Drain any remaining sentences in the queue
        await drainSentenceQueue();
        
        const durationMs = Date.now() - startTime;
        return {
          fullText,
          sentenceCount: sentenceIndex,
          totalTokens: Math.ceil(fullText.length / 4),
          durationMs,
        };
      }
      
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
   * Cap sentence length for TTS safety
   * Cartesia rejects payloads >500 chars, so we split at clause breaks
   * Returns array of sentence fragments (usually just 1 element)
   */
  private capSentenceForTTS(sentence: string): string[] {
    const maxLen = SENTENCE_CHUNKING_CONFIG.TTS_SAFE_MAX_LENGTH;
    
    // Fast path: most sentences are under the limit
    if (sentence.length <= maxLen) {
      return [sentence];
    }
    
    // Sentence is too long - split at clause breaks
    console.log(`[Gemini Streaming] TTS safety split: ${sentence.length} chars exceeds ${maxLen} limit`);
    
    const result: string[] = [];
    let remaining = sentence;
    
    while (remaining.length > maxLen) {
      // Find best clause break within the safe range
      const clauseBreaks = SENTENCE_CHUNKING_CONFIG.CLAUSE_BREAKS;
      let bestBreak = -1;
      
      for (const breakChar of clauseBreaks) {
        // Look for the last occurrence within the safe range
        const idx = remaining.lastIndexOf(breakChar, maxLen - 1);
        if (idx > SENTENCE_CHUNKING_CONFIG.MIN_SENTENCE_LENGTH) {
          bestBreak = Math.max(bestBreak, idx + 1);
        }
      }
      
      if (bestBreak > 0) {
        // Split at clause break
        result.push(remaining.substring(0, bestBreak).trim());
        remaining = remaining.substring(bestBreak).trim();
      } else {
        // No clause break found - force split at max length (rare edge case)
        console.warn(`[Gemini Streaming] No clause break found, forcing split at ${maxLen} chars`);
        result.push(remaining.substring(0, maxLen).trim());
        remaining = remaining.substring(maxLen).trim();
      }
    }
    
    // Add any remaining text
    if (remaining.trim()) {
      result.push(remaining.trim());
    }
    
    console.log(`[Gemini Streaming] Split into ${result.length} fragments: [${result.map(s => s.length).join(', ')}] chars`);
    return result;
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
