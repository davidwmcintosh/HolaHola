/**
 * Streaming Voice Orchestrator
 * 
 * ⚠️ CRITICAL: DANIELA'S VOICE PIPELINE - DO NOT MODIFY WITHOUT FOUNDER APPROVAL ⚠️
 * 
 * The central coordinator for streaming voice mode:
 * User audio → Deepgram STT → Gemini streaming → Sentence chunks → TTS → Audio stream
 * 
 * LOCKED CONFIGURATION (see replit.md "Voice Architecture"):
 * - STT: Deepgram Nova-3 via LIVE API (NOT prerecorded - prerecorded fails with WebM)
 * - LLM: Gemini (streaming)
 * - TTS: ElevenLabs Flash v2.5 (default) or Cartesia Sonic-3 (fallback via TTS_PROVIDER=cartesia)
 * 
 * NEVER:
 * - Switch to OpenAI TTS/STT
 * - Switch from transcribeWithLiveAPI to transcribeWithPrerecorded
 * - Use nova-2 model
 * 
 * Any changes require approval logged in docs/daniela-development-journal.md
 * 
 * Target: < 1 second time to first audio byte (vs 5-7s synchronous mode)
 */

import { createHash } from "crypto";
import { sql, eq, and, desc } from "drizzle-orm";
import { createClient } from "@deepgram/sdk";
import { getDeepgramLanguageCode, DeepgramIntelligence, DeepgramSentiment, DeepgramIntent, DeepgramEntity, DeepgramTopic, transcribeWithLiveAPI, TranscriptionResult } from "./deepgram-live-stt";
import { analyzePronunciation, generateQuickCoaching, PronunciationCoaching } from "./live-pronunciation-coach";
import { getGeminiStreamingService, SentenceChunk, ExtractedFunctionCall, ConversationHistoryEntry, PartialFunctionCall } from "./gemini-streaming";
import { getCartesiaStreamingService } from "./cartesia-streaming";
import { getElevenLabsStreamingService } from "./elevenlabs-streaming";
import { getGeminiTtsStreamingService } from "./gemini-tts-streaming";
import { getGeminiLiveTtsService } from "./gemini-live-tts";
import { DANIELA_TTS_PROVIDER } from "./voice-config";
import { buildFunctionContinuationResponse } from "./daniela-function-registry";
import { createTTSProviderRegistry, TTSProviderRegistry, resolveSessionTTSProvider, type TTSProviderName } from "./tts-provider-adapter";
import { buildClassroomDynamicContext, fetchPassiveMemories, fetchIdentityMemories, fetchStudentIntelligence, assembleDynamicPreamble } from "./voice-context-pipeline";
import { WebSocket as WS } from "ws";
import {
  StreamingMessage,
  StreamingConnectedMessage,
  StreamingProcessingMessage,
  StreamingSentenceStartMessage,
  StreamingSentenceReadyMessage,
  StreamingAudioChunkMessage,
  StreamingWordTimingMessage,
  StreamingWordTimingDeltaMessage,
  StreamingWordTimingFinalMessage,
  StreamingSentenceEndMessage,
  StreamingResponseCompleteMessage,
  StreamingFeedbackMessage,
  StreamingWhiteboardMessage,
  StreamingErrorMessage,
  StreamingErrorCode,
  ClientStartSessionMessage,
  WordTiming,
  LATENCY_TARGETS,
  STREAMING_FEATURE_FLAGS,
  SENTENCE_CHUNKING_CONFIG,
} from "@shared/streaming-voice-types";
import { parseWhiteboardMarkup, WhiteboardItem, WordMapItem, isWordMapItem, stripWhiteboardMarkup, SelfSurgeryItemData } from "@shared/whiteboard-types";
import { commandParserService, ParsedCommand } from "./command-parser";
import { usageService } from "./usage-service";
import { TtsDispatcher } from "./tts-dispatcher";
import { NativeFunctionCallHandler } from "./native-fc-handlers";
import { PostResponseEnrichmentService } from "./post-response-enrichment";
import { buildFatContext, FAT_CONTEXT_ENABLED } from "./fat-context-service";

export function ensureTrailingPunctuation(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (/[.!?\u2026\u3002\uff01\uff1f]["'\u201c\u201d\u2019\u2018)\]]*$/.test(trimmed)) return trimmed;
  return trimmed + '.';
}

const TEXT_FC_COMMAND_MAP: Record<string, string> = {
  'switch_tutor': 'SWITCH_TUTOR', 'phase_shift': 'PHASE_SHIFT',
  'actfl_update': 'ACTFL_UPDATE', 'syllabus_progress': 'SYLLABUS_PROGRESS',
  'call_support': 'CALL_SUPPORT', 'call_assistant': 'CALL_ASSISTANT',
};

function extractBalancedBraces(text: string, startIdx: number): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth === 0) return text.substring(startIdx, i + 1); }
  }
  return null;
}

function parseTextFcArgs(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    try {
      let inString = false;
      let escapeNext = false;
      let result = '';
      const cleaned = raw.replace(/,(\s*[}\]])/g, '$1');
      for (let i = 0; i < cleaned.length; i++) {
        const ch = cleaned[i];
        if (escapeNext) { result += ch; escapeNext = false; continue; }
        if (ch === '\\') { result += ch; escapeNext = true; continue; }
        if (ch === '"' || ch === "'") {
          if (!inString) { result += '"'; inString = true; continue; }
          if (inString) { result += '"'; inString = false; continue; }
        }
        if (!inString && /[a-zA-Z_]/.test(ch)) {
          const keyMatch = cleaned.substring(i).match(/^([a-zA-Z_][\w-]*)\s*:/);
          if (keyMatch) {
            result += `"${keyMatch[1]}":`;
            i += keyMatch[0].length - 1;
            continue;
          }
        }
        result += ch;
      }
      return JSON.parse(result) as Record<string, unknown>;
    } catch (e2) {
      console.warn(`[Text FC Parser] Failed to parse args: ${(e2 as Error).message}, raw: ${raw.substring(0, 120)}`);
      return null;
    }
  }
}

/**
 * Lightweight metrics logger for performance monitoring
 * Uses structured JSON format for easy parsing by log aggregators
 * Non-blocking: just console.log, no DB writes or network calls
 */
function logMetric(type: string, data: Record<string, number | string | boolean>) {
  console.log(`[METRICS] ${JSON.stringify({ type, ...data, ts: Date.now() })}`);
}

export function splitTextIntoSentences(text: string): string[] {
  const sentences: string[] = [];
  let remaining = text.trim();
  const endings = SENTENCE_CHUNKING_CONFIG.SENTENCE_ENDINGS;
  const minLen = SENTENCE_CHUNKING_CONFIG.MIN_SENTENCE_LENGTH;
  const maxLen = SENTENCE_CHUNKING_CONFIG.TTS_SAFE_MAX_LENGTH;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      let breakIndex = -1;
      for (const ending of endings) {
        let searchFrom = minLen - 1;
        while (true) {
          const idx = remaining.indexOf(ending, searchFrom);
          if (idx === -1) break;
          const afterChar = remaining[idx + 1];
          const isRealEnd = !afterChar || afterChar === ' ' || afterChar === '\n' || afterChar === '"' || afterChar === ')';
          if (isRealEnd && idx < remaining.length - 1) {
            breakIndex = idx + 1;
            break;
          }
          searchFrom = idx + 1;
        }
        if (breakIndex > 0) break;
      }

      if (breakIndex > 0 && remaining.length - breakIndex >= minLen) {
        sentences.push(remaining.substring(0, breakIndex).trim());
        remaining = remaining.substring(breakIndex).trim();
        continue;
      }
    }

    if (remaining.length > maxLen) {
      let breakIndex = -1;
      for (const ending of endings) {
        const idx = remaining.lastIndexOf(ending, maxLen - 1);
        if (idx >= minLen) {
          breakIndex = Math.max(breakIndex, idx + 1);
        }
      }
      if (breakIndex <= 0) {
        const clauseBreaks = SENTENCE_CHUNKING_CONFIG.CLAUSE_BREAKS;
        for (const br of clauseBreaks) {
          const idx = remaining.lastIndexOf(br, maxLen - 1);
          if (idx >= minLen) {
            breakIndex = Math.max(breakIndex, idx + 1);
          }
        }
      }
      if (breakIndex > 0) {
        sentences.push(remaining.substring(0, breakIndex).trim());
        remaining = remaining.substring(breakIndex).trim();
        continue;
      }
      sentences.push(remaining.substring(0, maxLen).trim());
      remaining = remaining.substring(maxLen).trim();
      continue;
    }

    sentences.push(remaining);
    break;
  }

  return sentences.filter(s => s.length > 0);
}

/**
 * Retry helper with exponential backoff for Gemini API rate limiting (429 errors)
 * Retries up to maxRetries times with exponential backoff starting at baseDelayMs
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: Error, delayMs: number) => void;
  } = {}
): Promise<T> {
  const { 
    maxRetries = 3, 
    baseDelayMs = 500, 
    maxDelayMs = 4000,
    onRetry 
  } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Only retry on rate limiting (429) errors
      const is429 = error?.message?.includes('429') || 
                    error?.message?.includes('RESOURCE_EXHAUSTED') ||
                    error?.code === 429;
      
      if (!is429 || attempt >= maxRetries) {
        throw error;
      }
      
      // Exponential backoff with jitter
      const delayMs = Math.min(
        baseDelayMs * Math.pow(2, attempt) + Math.random() * 200,
        maxDelayMs
      );
      
      onRetry?.(attempt + 1, error, delayMs);
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError;
}
import { constrainEmotion, TutorPersonality, CartesiaEmotion, getTTSService, getAssistantVoice, getDefaultEmotion } from "./tts-service";
import { extractTargetLanguageText, extractTargetLanguageWithMapping, hasSignificantTargetLanguageContent, detectTextLanguageForTTS } from "../text-utils";
import { segmentByLanguage, segmentsToCartesiaChunks, logSegmentation, extractBoldMarkedWords } from "./language-segmenter";
import { storage } from "../storage";
import { generateConversationTitle } from "../conversation-utils";
import { validateOneUnitRule, UnitValidationResult } from "../phrase-detection";
import { GoogleGenAI } from "@google/genai";
import { assessAdvancementReadiness, formatLevel } from "../actfl-advancement";
import { tagConversation } from "./conversation-tagger";
import { architectVoiceService } from "./architect-voice-service";
import { trackToolEvent, mapWhiteboardTypeToToolType } from "./pedagogical-insights-service";
import { brainHealthTelemetry } from "./brain-health-telemetry";
import { createSystemPrompt, TutorDirectoryEntry, buildPedagogicalPersonaSection } from "../system-prompt";
import { hiveCollaborationService, BeaconType } from "./hive-collaboration-service";
import { hiveContextService } from "./hive-context-service";
import { getExpressLaneHistoryForVoice, hiveConsciousnessService } from "./hive-consciousness-service";
import { collaborationHubService } from "./collaboration-hub-service";
import { editorFeedbackService } from "./editor-feedback-service";
import { founderCollabService } from "./founder-collaboration-service";
import { phaseTransitionService } from "./phase-transition-service";
import { voiceDiagnostics } from "./voice-diagnostics-service";
import { learnerMemoryExtractionService } from "./learner-memory-extraction-service";
import { studentLearningService } from "./student-learning-service";
import { memoryCheckpointService } from "./memory-checkpoint-service";
import { phonemeAnalyticsService } from "./phoneme-analytics-service";
import { supportPersonaService } from "./support-persona-service";
import { journeyMemoryService } from "./journey-memory-service";
import { db, getSharedDb } from "../db";
import { logVoiceOrchestratorError, trackVoicePipelineStage, logGeminiTimeout, logTtsFailure, logGeminiNoAudio } from "./production-telemetry";
// Language segmenter no longer needed - pronunciation handled via Daniela's [lang:word] tags
import { 
  tutorProcedures, 
  teachingPrinciples, 
  toolKnowledge, 
  situationalPatterns,
  languageIdioms,
  culturalNuances,
  learnerErrorPatterns,
  dialectVariations,
  linguisticBridges,
  featureSprints,
  neuralNetworkTelemetry,
  messages,
  conversations,
} from "@shared/schema";

/**
 * CROSS-LANGUAGE TRANSFER GATE
 * 
 * Feature flag to control whether tutors can hand off to tutors in different languages.
 * 
 * When FALSE (default): Transfers are restricted to same-language only
 *   - Spanish female → Spanish male: ALLOWED
 *   - Spanish female → French female: BLOCKED
 * 
 * When TRUE: Full cross-language transfers enabled (requires enrollment validation)
 *   - Future implementation: Check if student is enrolled in target language class
 *   - See: docs/enrollment-based-cross-language-transfers.md
 * 
 * This gate preserves all cross-language code paths - they remain intact but
 * are simply blocked at execution time until the feature is properly built out.
 */
// Feature flag for cross-language tutor transfers
// When false: Only same-language gender switches allowed
// When true: Full cross-language transfers enabled (future enrollment-based feature)
export const CROSS_LANGUAGE_TRANSFERS_ENABLED = false;

/**
 * Validates if a tutor transfer should be allowed
 * Returns { allowed: true } or { allowed: false, reason: string }
 */
function validateTutorTransfer(
  currentLanguage: string,
  targetLanguage: string | undefined,
): { allowed: true } | { allowed: false; reason: string } {
  // No target language specified = same-language transfer (always allowed)
  if (!targetLanguage) {
    return { allowed: true };
  }
  
  // Normalize for comparison
  const normalizedCurrent = currentLanguage.toLowerCase().trim();
  const normalizedTarget = targetLanguage.toLowerCase().trim();
  
  // Same language = allowed
  if (normalizedCurrent === normalizedTarget) {
    return { allowed: true };
  }
  
  // Cross-language transfer requested
  if (CROSS_LANGUAGE_TRANSFERS_ENABLED) {
    // Future: Add enrollment check here
    // const isEnrolled = await checkEnrollment(userId, targetLanguage);
    // if (!isEnrolled) return { allowed: false, reason: "..." };
    return { allowed: true };
  }
  
  // Cross-language transfers disabled
  return {
    allowed: false,
    reason: `Cross-language transfers are not yet available. To practice ${normalizedTarget}, please start a new ${normalizedTarget} conversation from the language hub.`
  };
}

/**
 * Parse sprint suggestion content with fallback
 * Handles both JSON format and free-form text
 */
function parseSprintSuggestion(content: string): { title: string; description: string; priority?: string } {
  // First try JSON parsing
  try {
    // Handle JSON-like content (with or without outer braces)
    let jsonContent = content.trim();
    if (!jsonContent.startsWith('{')) {
      jsonContent = `{${jsonContent}}`;
    }
    const parsed = JSON.parse(jsonContent);
    return {
      title: parsed.title || parsed.name || 'Untitled Sprint',
      description: parsed.description || parsed.desc || parsed.details || content,
      priority: parsed.priority || 'medium',
    };
  } catch {
    // JSON parsing failed - extract from text patterns
  }
  
  // Try key="value" pattern matching
  const titleMatch = content.match(/title\s*[=:]\s*["']?([^"'\n,}]+)["']?/i);
  const descMatch = content.match(/(?:description|desc)\s*[=:]\s*["']?([^"'\n}]+)["']?/i);
  const priorityMatch = content.match(/priority\s*[=:]\s*["']?([^"'\n,}]+)["']?/i);
  
  if (titleMatch) {
    return {
      title: titleMatch[1].trim(),
      description: descMatch?.[1]?.trim() || content,
      priority: priorityMatch?.[1]?.trim() || 'medium',
    };
  }
  
  // Last resort: use first line as title, rest as description
  const lines = content.split('\n').filter(l => l.trim());
  const firstLine = lines[0] || 'Sprint suggestion from Daniela';
  const restLines = lines.slice(1).join('\n') || content;
  
  return {
    title: firstLine.slice(0, 100), // Limit title length
    description: restLines,
    priority: 'medium',
  };
}

/**
 * Deepgram Configuration Feature Flags
 * 
 * These flags control Deepgram model and feature usage.
 * 
 * AVAILABILITY (Dec 2024 - confirmed with Deepgram):
 * Nova-3 and Audio Intelligence features (intent, sentiment, topics, etc.)
 * are available on ALL plans including Pay-as-You-Go. Only CONCURRENCY differs:
 * 
 * - Pay-as-You-Go/Growth: 100 pre-recorded, 50 streaming, 10 intelligence concurrent
 * - Enterprise: Higher limits, custom arrangements
 * 
 * When using multiple services in one call (e.g., STT + Intelligence), the
 * lower rate limit applies. For example: STT (100) + Intent (10) = 10 effective.
 * 
 * Audio Intelligence features (enabled by DEEPGRAM_INTELLIGENCE_ENABLED):
 *    - Sentiment analysis (student emotional state)
 *    - Intent recognition (what student is trying to do) - English only
 *    - Topic detection (subject matter)
 *    - Summarization (conversation synopsis)
 *    - Speaker diarization (multi-speaker separation)
 * 
 * NOTE: Intelligence features are only supported for pre-recorded audio (PTT mode).
 * For live streaming (open-mic), only core features (VAD, smart_format, diarize) work.
 */
const DEEPGRAM_MODEL = process.env.DEEPGRAM_MODEL || 'nova-3';
const DEEPGRAM_INTELLIGENCE_ENABLED = process.env.DEEPGRAM_INTELLIGENCE_ENABLED !== 'false'; // Default: enabled

/**
 * Clean text for display by removing markdown, emotion tags, and other formatting
 * that should not appear in subtitles
 */
export function cleanTextForDisplay(text: string): string {
  // First check if the entire text is just JSON emotion data (AI sometimes outputs this at end)
  // Match patterns like: { "emotion": "happy" } or { emotion: "happy" }
  const jsonEmotionPattern = /^\s*\{\s*"?emotion"?\s*:\s*"?\w+"?\s*\}\s*$/i;
  if (jsonEmotionPattern.test(text.trim())) {
    return ''; // Return empty to skip this sentence entirely
  }
  
  // Strip architect messages first (internal, should not be spoken/displayed)
  text = stripArchitectMessages(text);
  
  // Strip COLLAB tags (Daniela's collaboration signals to Editor - invisible to students)
  // Pattern: [COLLAB:TYPE]content[/COLLAB]
  text = text.replace(/\[COLLAB:[A-Z_]+\][\s\S]*?\[\/COLLAB\]/gi, '');
  
  // Strip SELF_SURGERY tags (Daniela's neural network proposals - invisible to students)
  // Pattern: [SELF_SURGERY target="..." priority=... confidence=... content='...' ...]
  text = text.replace(/\[SELF_SURGERY[^\]]*\]/gi, '');
  
  // Strip VOICE_ADJUST tags (voice control commands - should affect TTS settings, not be spoken)
  // Pattern 1: [VOICE_ADJUST speed="normal" emotion="friendly" personality="warm"]
  text = text.replace(/\[VOICE_ADJUST[^\]]*\]/gi, '');
  // Pattern 2: voice_adjust{...} - malformed curly brace format (seen in production)
  text = text.replace(/voice_adjust\s*\{[^}]*\}/gi, '');
  // Pattern 3: { voice_adjust"": {...} } or { "voice_adjust": {...} } - JSON-like format
  text = text.replace(/\{\s*"?voice_adjust"?\s*"*:\s*\{[^}]*\}\s*\}/gi, '');
  // Pattern 4: voice_adjust: { emotion: "...", ... } - inline JSON-like
  text = text.replace(/voice_adjust\s*:\s*\{[^}]*\}/gi, '');
  // Pattern 5: <ctrl46> artifacts from tokenization issues
  text = text.replace(/<ctrl\d+>/gi, '');
  // Pattern 6: voice_adjust(...) - native function call syntax spoken as text
  text = text.replace(/voice_adjust\s*\([^)]*\)/gi, '');
  
  // Strip VOICE_RESET tags (voice reset commands - internal, not spoken)
  // Pattern: [VOICE_RESET] or [VOICE_RESET reason="..."]
  text = text.replace(/\[VOICE_RESET[^\]]*\]/gi, '');
  // Pattern 2: voice_reset{...} or voice_reset: {...} - malformed formats
  text = text.replace(/voice_reset\s*[:\{][^}]*\}?/gi, '');
  
  // Strip SUBTITLE control tags (UI commands - should affect display, not be spoken)
  // Pattern 1: [SUBTITLE off|on|target] with optional trailing attributes like reason="..."
  text = text.replace(/\[SUBTITLE\s+(?:off|on|target|all)\s*\](?:\s*(?:reason|reasoning|text)\s*=\s*"[^"]*"\s*)*/gi, '');
  // Pattern 1b: [SUBTITLE on] ... [/SUBTITLE] block format (strip entire block)
  text = text.replace(/\[SUBTITLE\s+[^\]]*\][\s\S]*?\[\/SUBTITLE\]/gi, '');
  // Pattern 1c: Bare SUBTITLE with attributes (no closing bracket matched above)
  text = text.replace(/\[SUBTITLE\s+[^\]]*\]/gi, '');
  // Pattern 1d: Orphaned SUBTITLE",} or SUBTITLE",reasoning="..." fragments
  text = text.replace(/SUBTITLE"\s*,?\s*\}?\s*(?:reasoning\s*=\s*"[^"]*")?/gi, '');
  // Pattern 2: { subtitle: { mode: "...", text: "..." } } - JSON-like format
  text = text.replace(/\{\s*subtitle\s*:\s*\{[^}]*\}\s*\}/gi, '');
  // Pattern 3: subtitle: { mode: "...", ... } - inline format
  text = text.replace(/subtitle\s*:\s*\{[^}]*\}/gi, '');
  // Pattern 4: { subtitle"": {...} } - malformed quotes format
  text = text.replace(/\{\s*subtitle"*\s*:\s*\{[^}]*\}\s*\}/gi, '');
  // Pattern 5: subtitle(...) - native function call syntax spoken as text
  text = text.replace(/subtitle\s*\([^)]*\)/gi, '');
  
  // Catch-all: Strip any Daniela function name spoken as text with parentheses
  // Matches patterns like: play_audio({...}), show_image({...}), phase_shift({...}), etc.
  // IMPORTANT: This list MUST include ALL functions from gemini-function-declarations.ts
  const functionNames = [
    'voice_adjust', 'voice_reset', 'subtitle', 'play_audio', 'show_image',
    'show_overlay', 'hide_overlay', 'clear_whiteboard', 'word_emphasis', 'hold_whiteboard',
    'phase_shift', 'milestone', 'take_note', 'drill', 'express_lane_lookup',
    'switch_tutor', 'actfl_update', 'syllabus_progress', 'call_support', 'call_assistant',
    'request_text_input', 'memory_lookup', 'recall_express_lane_image', 'express_lane_post',
    'hive_suggestion', 'self_surgery', 'write', 'grammar_table', 'compare', 'word_map',
    'phonetic', 'culture', 'context', 'scenario', 'summary', 'reading', 'stroke', 'tone',
    'pronunciation_tag', 'first_meeting_complete',
  ];
  for (const fnName of functionNames) {
    // Pattern 1: function_name({...}) or function_name({nested {...}}) - handle nested braces
    text = text.replace(new RegExp(fnName + '\\s*\\(\\{[\\s\\S]*?\\}\\)', 'gi'), '');
    // Pattern 2: function_name(...) - simple parentheses (no braces)
    text = text.replace(new RegExp(fnName + '\\s*\\([^)]*\\)', 'gi'), '');
    // Pattern 3: function_name: {...} - colon-object format
    text = text.replace(new RegExp(fnName + '\\s*:\\s*\\{[^}]*\\}', 'gi'), '');
    // Pattern 4: function_name{...} - direct brace format
    text = text.replace(new RegExp(fnName + '\\s*\\{[^}]*\\}', 'gi'), '');
  }
  
  // Strip bare function names that are compound underscore terms (safe — won't appear in natural speech)
  // These are internal system function names that should NEVER be spoken aloud
  const safeToStripBare = [
    'voice_adjust', 'voice_reset', 'play_audio', 'show_image', 'show_overlay',
    'hide_overlay', 'clear_whiteboard', 'word_emphasis', 'hold_whiteboard',
    'phase_shift', 'take_note', 'switch_tutor', 'actfl_update',
    'syllabus_progress', 'call_support', 'call_assistant', 'request_text_input',
    'memory_lookup', 'recall_express_lane_image', 'express_lane_lookup',
    'express_lane_post', 'hive_suggestion', 'self_surgery', 'grammar_table',
    'word_map', 'pronunciation_tag', 'first_meeting_complete',
  ];
  for (const fnName of safeToStripBare) {
    text = text.replace(new RegExp('\\b' + fnName + '\\b', 'gi'), '');
  }
  
  // Strip legacy startcall/endcall format from older Gemini responses
  // Pattern: startcall:default_api:voice_adjust{...}end
  text = text.replace(/startcall:[^}]*\}?end/gi, '');
  text = text.replace(/\bstartcall\b/gi, '');
  text = text.replace(/\bendcall\b/gi, '');
  
  // Ultra catch-all: Strip any remaining word_word(...) pattern that looks like a function call
  // This catches new functions added in the future that aren't in the list above
  text = text.replace(/\b[a-z_]{2,30}\s*\(\s*\{[\s\S]*?\}\s*\)/g, '');
  // Also catch FUNCTION CALL: prefix that might leak from tool_knowledge docs
  // Pattern 1: Full "FUNCTION CALL: func_name(...)" 
  text = text.replace(/FUNCTION\s+CALL\s*:\s*\w+\s*\([^)]*\)/gi, '');
  // Pattern 2: Orphaned "FUNCTION CALL:" prefix (left behind after per-function regexes strip the call)
  text = text.replace(/FUNCTION\s+CALL\s*:?\s*/gi, '');
  
  // Strip MEMORY_LOOKUP tags (internal command triggers - should not be spoken)
  // Pattern: MEMORY_LOOKUP query="..." domains="..." (with or without brackets)
  text = text.replace(/\[?MEMORY_LOOKUP[^\]]*\]?/gi, '');
  // Pattern 2: memory_lookup query=... domains=... (lowercase, no brackets)
  text = text.replace(/memory_lookup\s+query\s*=\s*"[^"]*"\s*domains?\s*=\s*"[^"]*"/gi, '');
  
  // Strip SHOW/HIDE whiteboard control tags (UI commands - processed by function calls)
  // Pattern 1: [SHOW text="..."] or SHOW text="..."]  (with or without opening bracket)
  text = text.replace(/\[?SHOW\s+text\s*=\s*"[^"]*"\s*\]?/gi, '');
  // Pattern 2: [HIDE] or [HIDE text]
  text = text.replace(/\[HIDE[^\]]*\]/gi, '');
  
  // Strip WORD_EMPHASIS control tags (UI commands - processed by function calls)
  // Pattern 1: [WORD_EMPHASIS word="..." style="..."] or WORD_EMPHASIS word="..."] (malformed)
  text = text.replace(/\[?WORD_EMPHASIS\s+[^\]]*\]?/gi, '');
  // Pattern 2: word_emphasis{...} - curly brace format
  text = text.replace(/word_emphasis\s*\{[^}]*\}/gi, '');
  
  // Strip OBSERVE tags (Daniela's teaching observations for office hours - invisible to students)
  // Pattern: [OBSERVE reason="..." note="..."]
  text = text.replace(/\[OBSERVE[^\]]*\]/gi, '');
  
  // Strip SELF_LEARN tags (Daniela's autonomous neural network writes - invisible to students)
  // Pattern: [SELF_LEARN category="..." insight="..." context="..."]
  text = text.replace(/\[SELF_LEARN[^\]]*\]/gi, '');
  
  // Strip content growth tags (Daniela's pedagogical content creation - invisible to students)
  text = text.replace(/\[SAVE_IDIOM[^\]]*\]/gi, '');
  text = text.replace(/\[SAVE_NUANCE[^\]]*\]/gi, '');
  text = text.replace(/\[SAVE_ERROR_PATTERN[^\]]*\]/gi, '');
  text = text.replace(/\[SAVE_BRIDGE[^\]]*\]/gi, '');
  text = text.replace(/\[SAVE_DIALECT[^\]]*\]/gi, '');
  // Note: SAVE_CULTURAL_TIP not stripped - culturalTips table lacks sync fields
  
  // Strip KNOWLEDGE_PING tags
  text = text.replace(/\[KNOWLEDGE_PING[^\]]*\]/gi, '');
  
  // Strip WREN_SPRINT_SUGGEST tags (Daniela's sprint suggestions to Wren - invisible to students)
  // Pattern: [WREN_SPRINT_SUGGEST: {...JSON...}] or [WREN_SPRINT_SUGGEST title="..." ...]
  text = text.replace(/\[WREN_SPRINT_SUGGEST[:\s][^\]]*\]/gi, '');
  
  // Strip WREN_MESSAGE tags (Daniela's direct messages to Wren via Express Lane)
  // Pattern: [WREN_MESSAGE: content here] or [WREN_MESSAGE content="..."]
  text = text.replace(/\[WREN_MESSAGE[:\s][^\]]*\]/gi, '');
  
  // Strip ACTION_TRIGGERS XML blocks (JSON command format - invisible to students)
  // Pattern: <ACTION_TRIGGERS>{"commands":[...]}</ACTION_TRIGGERS>
  text = text.replace(/<ACTION_TRIGGERS>[\s\S]*?<\/ACTION_TRIGGERS>/gi, '');
  
  // Strip internal notes/reasoning fragments that Gemini sometimes leaks
  // These are fragments of structured output that shouldn't be spoken
  // Patterns: reasoning="...", priority=\d+, confidence=\d+ (attribute format)
  text = text.replace(/\breasoning\s*=\s*"[^"]*"/gi, '');
  text = text.replace(/\bpriority\s*=\s*\d+/gi, '');
  text = text.replace(/\bconfidence\s*=\s*[\d.]+/gi, '');
  // Also handle JSON format: "priority":90, "confidence":95, "reasoning":"..."
  text = text.replace(/"priority"\s*:\s*\d+\s*,?/gi, '');
  text = text.replace(/"confidence"\s*:\s*[\d.]+\s*,?/gi, '');
  text = text.replace(/"reasoning"\s*:\s*"[^"]*"\s*,?/gi, '');
  // Strip JSON command type fragments: "type":"SELF_SURGERY", "target":"..."
  text = text.replace(/"type"\s*:\s*"[A-Z_]+"\s*,?/gi, '');
  text = text.replace(/"target"\s*:\s*"[^"]*"\s*,?/gi, '');
  text = text.replace(/"content"\s*:\s*'[^']*'\s*,?/gi, '');
  text = text.replace(/"content"\s*:\s*"[^"]*"\s*,?/gi, '');
  // Strip "commands": array wrappers and stray JSON structure
  text = text.replace(/"commands"\s*:\s*\[\s*/gi, '');
  text = text.replace(/\{\s*"commands"\s*:/gi, '');
  text = text.replace(/^\s*\{\s*\}\s*$/g, '');  // Empty JSON objects
  // Strip JSON-like artifacts (closing brackets from malformed structures)
  text = text.replace(/^\s*\]\s*\}?\s*'?\s*/g, '');
  text = text.replace(/\s*\]\s*\}?\s*'?\s*$/g, '');
  // Strip orphaned opening/closing brackets from split tags (when [TAG attr="..."] spans sentences)
  // After stripping attributes above, we may be left with just "]" or "[" at start/end
  text = text.replace(/^\s*[\[\]]+\s*/g, '');  // Strip leading [ or ] brackets
  text = text.replace(/\s*[\[\]]+\s*$/g, '');  // Strip trailing [ or ] brackets
  // Strip lines that are clearly internal instructions (imperative verbs for AI)
  text = text.replace(/^Simulate\s+internal\b[^.]*\./gi, '');
  text = text.replace(/^Optionally,?\s+(?:offer|provide|include|add)\b[^.]*\./gi, '');
  text = text.replace(/^Internally,?\s+(?:process|handle|execute|trigger)\b[^.]*\./gi, '');
  text = text.replace(/^user\s+of\s+the\s+transition\b[^.]*\./gi, '');
  
  // First strip all whiteboard markup (WRITE, DRILL, SWITCH_TUTOR, etc.)
  // This must happen before other cleaning to ensure markup doesn't appear in TTS
  let cleaned = stripWhiteboardMarkup(text)
    // Remove code blocks (```language\ncode\n```) - extract just the code content without backticks
    // Code blocks should not be spoken aloud at all in voice sessions
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '')
    // Remove inline code backticks (`code`) - keep the text but remove backticks
    .replace(/`([^`]+)`/g, '$1')
    // Remove any remaining stray backticks
    .replace(/`/g, '')
    // Remove action/emotion tags like *laughs softly*, *chuckles*, *sighs*, *smiles warmly*, etc.
    // These should be emoted by the voice, not spoken aloud
    // Must happen BEFORE stripping individual asterisks
    .replace(/\*(?:laughs?|chuckles?|giggles?|sighs?|smiles?|grins?|nods?|pauses?|clears? throat|ahem|winks?|gasps?|whispers?|exclaims?|thinks?|considers?|reflects?|ponders?)(?:\s+\w+)*\*/gi, '')
    // Remove markdown bold/italic markers
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/##/g, '')
    .replace(/#/g, '')
    // Remove empty quote pairs that Gemini sometimes outputs at sentence starts
    .replace(/^["'"']+\s*/g, '')  // Leading quotes
    .replace(/\s*["'"']+$/g, '')  // Trailing quotes
    .replace(/["'"']{2,}/g, '')   // Multiple consecutive quotes (empty pairs)
    // Remove stray quotes that aren't part of meaningful text
    // Be careful not to remove apostrophes in contractions like "it's" or "you're"
    .replace(/"\s+/g, ' ')  // Quote followed by space → just space
    .replace(/\s+"/g, ' ')  // Space followed by quote → just space
    // Remove emotion tags like (friendly), (curious), (excited), etc at start/end
    .replace(/^\s*\([^)]+\)\s*/g, '')
    .replace(/\s*\([^)]+\)\s*$/g, '')
    // Also remove mid-text emotion tags
    .replace(/\s*\((?:friendly|curious|excited|calm|warm|energetic|professional|happy|sad|surprised|thoughtful|encouraging|patient)\)\s*/gi, ' ')
    // Remove [laughter] tags for display
    .replace(/\[laughter\]/gi, '')
    // Remove [ADOPT_INSIGHT:uuid] markers - internal tracking, not for display
    .replace(/\[ADOPT_INSIGHT:[a-f0-9-]+\]/gi, '')
    // Remove [bracket] emotion/action tags like [happy], [excited]
    .replace(/\[(?:friendly|curious|excited|calm|warm|energetic|professional|happy|sad|surprised|thoughtful|encouraging|patient)\]/gi, '')
    // Remove BARE emotion words at start of text (AI sometimes outputs "happy\n" or "friendly**text**")
    // Must be at the very start, optionally followed by punctuation, whitespace/newline, or ** (markdown)
    // Handles: "friendly\n", "friendly ", "friendly**Excelente**", "happyHola", "Happy! That was..."
    .replace(/^(?:friendly|curious|excited|calm|warm|energetic|professional|happy|sad|surprised|thoughtful|encouraging|patient)[!.,;:?]*(?:[\s\n\r]+|\*\*)?/gi, '')
    // Remove BARE action phrases at start of text (AI sometimes outputs "laughs softly It's..." without asterisks)
    // Catches: "laughs softly", "chuckles", "sighs contentedly", "smiles warmly", etc.
    .replace(/^(?:laughs?|chuckles?|giggles?|sighs?|smiles?|grins?|nods?|pauses?|clears? throat|ahem|winks?|gasps?|whispers?|exclaims?|thinks?|considers?|reflects?|ponders?)(?:\s+\w+)*\s+/gi, '');
  
  // Remove ALL parenthetical content (English translations like (Hello!), (Excellent!), (Perfect!))
  // These are distracting and redundant - the user heard the Spanish and doesn't need English in subtitles
  let prevCleaned = '';
  while (cleaned !== prevCleaned) {
    prevCleaned = cleaned;
    cleaned = cleaned.replace(/\s*\([^()]*\)\s*/g, ' ');
  }
  
  // Convert ALL CAPS common words to lowercase to prevent TTS from spelling them out as acronyms.
  // Gemini uses caps for emphasis (e.g. "I will ASK you a question") but TTS engines interpret
  // short all-caps words as acronyms and spell each letter: "A-S-K".
  // Preserve legitimate acronyms (ACTFL, SSML, etc.) by only lowering known common words.
  const commonWordsUpperSet = new Set([
    'ASK', 'ASKED', 'ASKING', 'ASKS',
    'TELL', 'TOLD', 'TELLING', 'TELLS',
    'SAY', 'SAID', 'SAYING', 'SAYS',
    'WILL', 'WOULD', 'COULD', 'SHOULD', 'SHALL', 'CAN', 'MAY', 'MIGHT', 'MUST',
    'AND', 'BUT', 'THE', 'FOR', 'NOT', 'ALL', 'ARE', 'WAS', 'HAS', 'HAD', 'HER', 'HIS',
    'YOU', 'YOUR', 'YOURS',
    'NOW', 'THEN', 'WHEN', 'WHAT', 'HOW', 'WHY', 'WHO', 'WHERE', 'WHICH',
    'LET', 'LETS', 'GET', 'GETS', 'GOT', 'SET', 'PUT', 'RUN', 'TRY',
    'FIRST', 'NEXT', 'LAST', 'NEW', 'OLD', 'BIG', 'GOOD', 'GREAT', 'BEST',
    'VERY', 'JUST', 'ALSO', 'ONLY', 'EVEN', 'STILL', 'ALREADY', 'ALWAYS', 'NEVER',
    'YES', 'OKAY', 'SURE', 'RIGHT', 'WELL', 'READY', 'DONE', 'BACK',
    'MAKE', 'TAKE', 'GIVE', 'COME', 'LOOK', 'THINK', 'KNOW', 'WANT', 'NEED',
    'LIKE', 'LOVE', 'HELP', 'SHOW', 'HEAR', 'LISTEN', 'READ', 'WRITE', 'SPEAK',
    'TALK', 'LEARN', 'PRACTICE', 'REPEAT', 'REMEMBER', 'ANSWER',
    'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE',
    'HERE', 'THERE', 'THIS', 'THAT', 'THESE', 'THOSE',
    'SAME', 'EACH', 'BOTH', 'MORE', 'MOST', 'SOME', 'MANY', 'MUCH',
    'WITH', 'FROM', 'INTO', 'OVER', 'ABOUT', 'AFTER', 'BEFORE',
    'TURN', 'ROLE', 'PLAY', 'GAME', 'WORD', 'WORDS', 'TIME',
  ]);
  cleaned = cleaned.replace(/\b[A-Z]{2,}\b/g, (match) => {
    if (commonWordsUpperSet.has(match)) {
      return match.toLowerCase();
    }
    return match;
  });

  // Normalize whitespace and clean up residual punctuation
  return cleaned
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[,.\s]+|[,.\s]+$/g, '')  // Trim leading/trailing commas, periods, spaces
    .trim();
}

/**
 * Infer target language from tutor name mentions in AI response text
 * 
 * When the AI says "Let me get Juliet for you" but emits [SWITCH_TUTOR target="female"]
 * WITHOUT a language parameter, we can auto-infer the language from the tutor directory.
 * 
 * This makes cross-language handoffs more robust when the AI forgets to include the language.
 * 
 * @param responseText - The AI's full response text (may contain tutor names)
 * @param targetGender - The gender from the SWITCH_TUTOR command
 * @param currentLanguage - The current session language
 * @param tutorDirectory - Array of tutor directory entries with names and languages
 * @returns The inferred language if a cross-language tutor name is detected, undefined otherwise
 */
function inferLanguageFromTutorName(
  responseText: string,
  targetGender: 'male' | 'female',
  currentLanguage: string,
  tutorDirectory: TutorDirectoryEntry[]
): string | undefined {
  if (!tutorDirectory || tutorDirectory.length === 0) {
    return undefined;
  }
  
  // Normalize for comparison
  const normalizedText = responseText.toLowerCase();
  const normalizedCurrentLang = currentLanguage.toLowerCase();
  
  // Find tutors from OTHER languages matching the target gender
  // (If they're from the current language, no language inference is needed)
  const otherLanguageTutors = tutorDirectory.filter(t => 
    t.language.toLowerCase() !== normalizedCurrentLang &&
    t.language.toLowerCase() !== 'all' && // Exclude Sofia/support
    t.gender === targetGender &&
    t.role !== 'support'
  );
  
  // Check if any other-language tutor name appears in the response text
  for (const tutor of otherLanguageTutors) {
    // Create a regex that matches the tutor name as a word (case-insensitive)
    // Handles variants like "Juliet", "Juliette", "Julieta" by matching the name directly
    const namePattern = new RegExp(`\\b${tutor.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    
    if (namePattern.test(responseText)) {
      console.log(`[Tutor Switch] Auto-inferred language="${tutor.language}" from tutor name "${tutor.name}" mentioned in response`);
      return tutor.language.toLowerCase();
    }
  }
  
  return undefined;
}

/**
 * Architect Message Types for bidirectional communication
 * Daniela can send different types of messages to the Architect/Claude
 */
interface ArchitectMessage {
  type: 'question' | 'suggestion' | 'observation' | 'request';
  content: string;
  urgency?: 'low' | 'medium' | 'high';
}

/**
 * Detect and extract [TO_ARCHITECT: message] tags from Daniela's responses
 * Uses balanced bracket matching to handle nested brackets in payloads
 * 
 * Supports multiple formats:
 * - [TO_ARCHITECT: message] - Simple format (becomes 'observation')
 * - [TO_ARCHITECT type="question": message] - With type
 * - [TO_ARCHITECT type="suggestion" urgency="high": message] - Full format
 * 
 * Returns: Array of messages extracted, and text with tags stripped (preserving original whitespace)
 */
function extractArchitectMessages(text: string): { messages: ArchitectMessage[]; cleanedText: string } {
  const messages: ArchitectMessage[] = [];
  let cleanedText = text;
  
  // Find all [TO_ARCHITECT ...] blocks using balanced bracket matching
  let searchStart = 0;
  while (true) {
    const tagStart = cleanedText.indexOf('[TO_ARCHITECT', searchStart);
    if (tagStart === -1) break;
    
    // Find the matching closing bracket using bracket counting
    let bracketCount = 0;
    let tagEnd = -1;
    for (let i = tagStart; i < cleanedText.length; i++) {
      if (cleanedText[i] === '[') bracketCount++;
      else if (cleanedText[i] === ']') {
        bracketCount--;
        if (bracketCount === 0) {
          tagEnd = i;
          break;
        }
      }
    }
    
    if (tagEnd === -1) {
      // No matching bracket found, skip
      searchStart = tagStart + 1;
      continue;
    }
    
    // Extract the full tag content
    const fullTag = cleanedText.substring(tagStart, tagEnd + 1);
    const innerContent = fullTag.substring('[TO_ARCHITECT'.length, fullTag.length - 1);
    
    // Parse type and urgency attributes
    const typeMatch = innerContent.match(/type="(question|suggestion|observation|request)"/i);
    const urgencyMatch = innerContent.match(/urgency="(low|medium|high)"/i);
    
    // Find the colon that separates attributes from message
    const colonIndex = innerContent.indexOf(':');
    if (colonIndex !== -1) {
      const messageContent = innerContent.substring(colonIndex + 1).trim();
      const type = (typeMatch?.[1]?.toLowerCase() || 'observation') as ArchitectMessage['type'];
      const urgency = (urgencyMatch?.[1]?.toLowerCase() || 'medium') as ArchitectMessage['urgency'];
      
      messages.push({ type, content: messageContent, urgency });
    }
    
    // Remove the tag from cleaned text (preserve surrounding whitespace structure)
    cleanedText = cleanedText.substring(0, tagStart) + cleanedText.substring(tagEnd + 1);
    // Don't advance searchStart since we removed content
  }
  
  return { messages, cleanedText };
}

/**
 * Strip [TO_ARCHITECT: ...] tags from text (for TTS/display)
 * Uses balanced bracket matching - preserves original whitespace/newlines
 */
function stripArchitectMessages(text: string): string {
  const { cleanedText } = extractArchitectMessages(text);
  return cleanedText;
}

/**
 * Idle timeout configuration - protects tutor resources
 * When student doesn't respond within timeout, session resources are cleaned up
 */
const SESSION_IDLE_TIMEOUT_MS = 120000; // 2 minutes of inactivity before cleanup
const CREDIT_CHECK_INTERVAL_MS = 30000; // Check credit balance every 30 seconds during active sessions

/**
 * Voice speed options for speaking rate control
 * Maps to numeric speaking rates for TTS
 */
export type VoiceSpeedOption = 'slower' | 'slow' | 'normal' | 'fast' | 'faster';

/**
 * Convert voice speed string to numeric speaking rate
 * These values map to Cartesia's 0.6-1.5 range
 * UI labels: 0.6x, 0.8x, 1x, 1.25x, 1.5x
 */
export function voiceSpeedToRate(speed: VoiceSpeedOption | undefined): number {
  switch (speed) {
    case 'slower': return 0.6;   // 0.6x - slowest for pronunciation practice
    case 'slow': return 0.8;     // 0.8x - slightly slower for beginners
    case 'normal': return 1.0;   // 1x - natural conversation speed
    case 'fast': return 1.25;    // 1.25x - faster for advanced learners
    case 'faster': return 1.5;   // 1.5x - fastest available
    default: return 1.0;
  }
}

/**
 * Adaptive Speech Rate Configuration
 * Auto-adjusts Daniela's speaking speed based on student comprehension signals
 */
const ADAPTIVE_SPEED_CONFIG = {
  // STT confidence thresholds
  LOW_CONFIDENCE_THRESHOLD: 0.7,    // Below this triggers slowdown consideration
  VERY_LOW_CONFIDENCE_THRESHOLD: 0.5, // Below this forces significant slowdown
  
  // Struggle thresholds
  STRUGGLE_SLOWDOWN_THRESHOLD: 3,   // After N struggles, start slowing down
  STRUGGLE_MAX_EFFECT: 6,           // Cap slowdown effect at N struggles
  
  // Speed adjustment factors
  MIN_SPEED_MULTIPLIER: 0.7,        // Never go below 70% of user's chosen speed
  MAX_SPEED_MULTIPLIER: 1.0,        // Never exceed user's chosen speed
  
  // Rolling window for STT confidence
  CONFIDENCE_WINDOW_SIZE: 5,        // Track last N transcripts
};

/**
 * Calculate adaptive speaking rate based on session signals
 * Returns a multiplier to apply to the user's chosen speed
 * 
 * @param session - Current streaming session with tracking data
 * @returns Multiplier (0.7 - 1.0) to apply to base speaking rate
 */
export function calculateAdaptiveSpeedMultiplier(session: StreamingSession): number {
  if (!session.adaptiveSpeedEnabled) {
    return 1.0; // No adjustment if adaptive speed is disabled
  }
  
  let multiplier = 1.0;
  
  // Factor 1: Recent STT confidence (if student is hard to understand, slow down)
  if (session.recentSttConfidences.length > 0) {
    const avgConfidence = session.recentSttConfidences.reduce((a, b) => a + b, 0) / session.recentSttConfidences.length;
    
    if (avgConfidence < ADAPTIVE_SPEED_CONFIG.VERY_LOW_CONFIDENCE_THRESHOLD) {
      // Very low confidence: significant slowdown (0.8x)
      multiplier = Math.min(multiplier, 0.8);
    } else if (avgConfidence < ADAPTIVE_SPEED_CONFIG.LOW_CONFIDENCE_THRESHOLD) {
      // Low confidence: moderate slowdown (0.9x)
      multiplier = Math.min(multiplier, 0.9);
    }
  }
  
  // Factor 2: Session struggle count (if student is struggling, slow down)
  if (session.sessionStruggleCount >= ADAPTIVE_SPEED_CONFIG.STRUGGLE_SLOWDOWN_THRESHOLD) {
    // Calculate slowdown based on struggle count (capped)
    const effectiveStruggles = Math.min(session.sessionStruggleCount, ADAPTIVE_SPEED_CONFIG.STRUGGLE_MAX_EFFECT);
    const struggleEffect = (effectiveStruggles - ADAPTIVE_SPEED_CONFIG.STRUGGLE_SLOWDOWN_THRESHOLD + 1) * 0.05;
    multiplier = Math.min(multiplier, 1.0 - struggleEffect);
  }
  
  // Clamp to configured range
  return Math.max(ADAPTIVE_SPEED_CONFIG.MIN_SPEED_MULTIPLIER, Math.min(ADAPTIVE_SPEED_CONFIG.MAX_SPEED_MULTIPLIER, multiplier));
}

/**
 * Get the effective speaking rate with adaptive adjustment
 * @param session - Current streaming session
 * @returns Final speaking rate to use for TTS
 */
export function getAdaptiveSpeakingRate(session: StreamingSession): number {
  const baseRate = voiceSpeedToRate(session.voiceSpeed);
  const multiplier = calculateAdaptiveSpeedMultiplier(session);
  const adaptiveRate = baseRate * multiplier;
  
  // Log when adaptive rate differs from base
  if (multiplier < 1.0) {
    console.log(`[Adaptive Speed] Slowing down: ${baseRate} → ${adaptiveRate.toFixed(2)} (${(multiplier * 100).toFixed(0)}% of user speed)`);
  }
  
  // Clamp to Cartesia's valid range (0.6 - 1.5)
  return Math.max(0.6, Math.min(1.5, adaptiveRate));
}

/**
 * Update session's STT confidence tracking
 * Call this after each transcript is received
 */
export function trackSttConfidence(session: StreamingSession, confidence: number): void {
  session.recentSttConfidences.push(confidence);
  
  // Keep only the most recent N confidences
  while (session.recentSttConfidences.length > ADAPTIVE_SPEED_CONFIG.CONFIDENCE_WINDOW_SIZE) {
    session.recentSttConfidences.shift();
  }
  
  // Auto-enable adaptive speed when confidence drops below threshold
  if (confidence < ADAPTIVE_SPEED_CONFIG.LOW_CONFIDENCE_THRESHOLD && !session.adaptiveSpeedEnabled) {
    session.adaptiveSpeedEnabled = true;
    console.log(`[Adaptive Speed] Auto-enabled due to low STT confidence (${(confidence * 100).toFixed(0)}%)`);
  }
}

/**
 * Increment struggle count for adaptive speed tracking
 */
export function trackStruggle(session: StreamingSession): void {
  session.sessionStruggleCount++;
  
  // Auto-enable adaptive speed when struggles accumulate
  if (session.sessionStruggleCount >= ADAPTIVE_SPEED_CONFIG.STRUGGLE_SLOWDOWN_THRESHOLD && !session.adaptiveSpeedEnabled) {
    session.adaptiveSpeedEnabled = true;
    console.log(`[Adaptive Speed] Auto-enabled due to struggle count (${session.sessionStruggleCount})`);
  }
}

/**
 * Session state for a streaming voice connection
 */
export interface StreamingSession {
  id: string;
  userId: string;
  conversationId: string;  // UUID string
  targetLanguage: string;
  nativeLanguage: string;
  difficultyLevel: string;
  subtitleMode: 'off' | 'target' | 'all';
  tutorPersonality: TutorPersonality;
  tutorExpressiveness: number;
  voiceSpeed: VoiceSpeedOption;
  voiceId?: string;
  geminiLanguageCode?: string;  // BCP-47 language code for Gemini TTS accent (e.g., 'es-MX', 'es-ES')
  ttsProvider?: 'elevenlabs' | 'cartesia' | 'google' | 'gemini';  // Per-session TTS provider (from tutor_voices DB record)
  tutorGender: 'male' | 'female';    // Current tutor gender for persona-aware responses
  tutorName: string;                 // Current tutor's first name (e.g., "Daniela", "Agustin")
  systemPrompt: string;
  conversationHistory: Array<ConversationHistoryEntry>;
  ws: WS;
  startTime: number;
  isActive: boolean;
  isFounderMode: boolean;  // Founder Mode uses English STT regardless of target language
  isRawHonestyMode: boolean;  // Raw Honesty Mode - minimal prompting for authentic conversation
  isIncognito: boolean;  // Incognito Mode - no DB writes, no memory persistence, no permanent record
  isDeveloperUser: boolean;  // True if user has developer/admin role (for unified Daniela consciousness)
  isBetaTester: boolean;   // Beta tester mode - Daniela knows user is helping debug/test new features
  idleTimeoutId?: NodeJS.Timeout;  // Timer for idle cleanup
  creditCheckIntervalId?: NodeJS.Timeout;  // Timer for periodic credit balance check
  contextRefreshTimeoutId?: NodeJS.Timeout;  // Timer for periodic context refresh (long sessions)
  lastContextRefreshTime: number;   // Timestamp of last context refresh
  lastActivityTime: number;         // Timestamp of last student activity
  currentTurnId: number;            // Monotonic counter for subtitle packet ordering (prevents phantom subtitles)
  warmupPromise?: Promise<void>;    // Gemini + Cartesia warmup promise to await before greeting
  isInterrupted: boolean;           // Set to true when user barges in (for open mic mode)
  lastTurnWasInterrupted: boolean;  // True if previous turn was interrupted by user barge-in (for context injection)
  isGenerating: boolean;            // True while AI response is being generated (for barge-in detection)
  pendingTutorSwitch?: {            // Queued tutor switch to execute after response completes
    targetGender: 'male' | 'female';
    targetLanguage?: string;        // Optional: for cross-language handoffs (e.g., "japanese")
    targetRole?: 'tutor' | 'assistant'; // Optional: for assistant handoffs (practice partners)
  };
  previousTutorName?: string;       // Stored during handoff for natural intro by new tutor
  /**
   * Gemini 3 thought signatures from current turn's function calls
   * MUST be passed back to API in subsequent requests for multi-step function calling
   * @see https://docs.cloud.google.com/vertex-ai/generative-ai/docs/thought-signatures
   */
  currentTurnThoughtSignatures?: string[];
  /**
   * Function calls from current turn (for proper bundling of parallel function calls)
   * Gemini 3 requires: all FCs + signatures, then all FRs together
   */
  currentTurnFunctionCalls?: ExtractedFunctionCall[];
  /**
   * Dynamic context preamble entries for current turn (user/model exchange with dynamic sections + Express Lane)
   * Stored at start of turn, used for continuation calls to rebuild context with updated session history
   * MUST be cleared at start of each new turn to prevent stale context bleed
   */
  currentTurnPreamble?: ConversationHistoryEntry[];
  isLanguageSwitchHandoff?: boolean; // True when current handoff is a cross-language switch
  previousLanguage?: string;        // Previous language before cross-language switch
  switchTutorTriggered?: boolean;   // True when SWITCH_TUTOR detected - stops further sentence synthesis
  crossLanguageTransferBlocked?: boolean; // True when cross-language transfer was blocked this turn (prevents retries)
  pendingSupportHandoff?: {         // Queued support handoff when CALL_SUPPORT is detected
    category: 'technical' | 'account' | 'billing' | 'content' | 'feedback' | 'other';
    reason: string;
    priority: 'low' | 'normal' | 'high' | 'critical';
    context?: string;
  };
  pendingAssistantHandoff?: {       // Queued assistant handoff when CALL_ASSISTANT is detected
    drillType: 'repeat' | 'translate' | 'match' | 'fill_blank' | 'sentence_order';
    focus: string;
    items: string[];
    priority?: 'low' | 'medium' | 'high';
  };
  isAssistantActive?: boolean;       // True when practice partner (assistant tutor) is active - uses Google TTS
  cachedMainTutorVoiceId?: string;   // Cached main tutor voiceId to restore when returning from assistant
  cachedMainTutorGender?: 'male' | 'female'; // Cached main tutor gender to restore when returning from assistant
  // Additional context for personalized greetings
  conversationTopic?: string;       // What student chose to work on (from conversation.topic)
  conversationTitle?: string;       // Thread name for context (from conversation.title)
  lastSessionSummary?: string;      // What happened in last session (from Compass)
  studentGoals?: string;            // Student's learning goals (from Compass)
  dbSessionId?: string;             // Database voice_sessions.id (UUID) for pedagogical tracking
  classId?: string;                  // Class ID for syllabus tracking (if class session)
  toolsUsedSession: string[];        // Tools used in this session for ACTFL analytics
  hiveChannelId?: string;            // Hive collaboration channel ID for Daniela-Editor collaboration
  pendingArchitectNoteIds: string[]; // Architect notes awaiting delivery (cleared on interrupt)
  onTtsStateChange?: (isTtsPlaying: boolean) => void;  // Callback to suppress OpenMic during TTS
  postTtsSuppressionTimer?: NodeJS.Timeout | null;     // Timer for delayed echo suppression release
  // Adaptive Speech Rate tracking
  recentSttConfidences: number[];     // Rolling window of last N STT confidence scores
  sessionStruggleCount: number;       // Count of struggles detected this session
  adaptiveSpeedEnabled: boolean;      // Whether adaptive speed is active (auto-enabled on low confidence)
  // Phoneme analytics tracking (accumulated word-level data for session)
  sessionWordAnalyses: Array<{ word: string; confidence: number }>;  // Words with confidence < 0.95 for phoneme analysis
  // Azure Pronunciation Assessment: accumulated audio and text for post-session analysis
  sessionAudioChunks: Buffer[];             // Raw PCM audio chunks from user speech
  sessionTranscripts: Array<{ text: string; timestamp: number }>;  // Transcribed text with timing
  tutorDirectory?: TutorDirectoryEntry[];    // Full tutor directory for prompt regeneration after handoffs
  // Voice defaults for reset capability - stores tutor's baseline settings
  voiceDefaults?: {
    speakingRate: number;
    personality: TutorPersonality;
    emotion: string;
    expressiveness: number;
  };
  // Pedagogical persona from the Persona Registry - shapes teaching style
  tutorPersona?: {
    pedagogicalFocus?: string;
    teachingStyle?: string;
    errorTolerance?: string;
    vocabularyLevel?: string;
    personalityTraits?: string;
    scenarioStrengths?: string;
    teachingPhilosophy?: string;
  };
  // FC OpenMic: Flags for coordinating function call TTS with main pipeline
  earlyTtsActive?: boolean;       // True while FC callback is running — guards onSentence from double-processing
  functionCallText?: string;      // Accumulated spoken text from function call args (set by handleNativeFunctionCall)
  voiceAdjustText?: string;       // Text from voice_adjust function call
  accumulatedBoldWords?: string[]; // Bold-marked words accumulated across function calls
  // ElevenLabs voice settings (per-session from tutor_voices DB record)
  elStability?: number;
  elSimilarityBoost?: number;
  elStyle?: number;
  elSpeakerBoost?: boolean;
  // STT keyword biasing
  sttKeyterms?: string[];
  // Diagnostic counters
  _ttsTurnCallCount?: number;
  // Whiteboard/overlay state
  customOverlayText?: string;
  pendingTextInput?: { prompt: string };
  commandParserClear?: boolean;
  commandParserHold?: boolean;
  // Greeting lifecycle flags
  __greetingInProgress?: boolean;
  __greetingDelivered?: boolean;
  greetingTriggeredByOrchestrator?: boolean;
  // Scenario immersion state
  activeScenario?: Record<string, any> | null;
  studentActflLevel?: string;
  voiceGender?: string;
  // Cached data from function call handlers (consumed by multi-step FC continuation)
  lastSyllabusData?: Record<string, any>;
  lastLoadedLesson?: Record<string, any>;
  lastVocabSet?: Record<string, any>;
  lastRecommendation?: Record<string, any>;
  lastDueVocab?: any[];
  lastCreditCheck?: Record<string, any>;
  creditContextInjected?: boolean;
  // Drill session state
  drillSession?: Record<string, any>;
  lastDrillSessionData?: Record<string, any>;
  // Dynamic key support for recovery timestamps and active TTS tracking
  [key: string]: any;
  // Deduplication: Track sent audio chunks to prevent double audio bug
  sentAudioChunks: Set<string>;
  // Content-based deduplication: Track audio content hashes to catch retries with new chunk IDs
  // Key: short hash of audio content, Value: timestamp (for LRU cleanup)
  sentAudioHashes: Map<string, number>;
  // Deduplication: Track last processed transcript hash to prevent double AI responses
  // (Fixes race condition where PTT release and audio_data can both trigger AI with same transcript)
  lastProcessedTranscriptHash?: string;
  lastProcessedTranscriptTime?: number;
  // Deduplication: Track when last response completed to prevent rapid-fire responses
  // (Fixes race condition where speculative AI completes and then final transcript triggers immediately after)
  lastResponseCompletedTime?: number;
  // Lesson Bundle Context - tells Daniela about pre-configured drills
  lessonBundleContext?: {
    lessonId: string;
    lessonName: string;
    hasBundledDrills: boolean;      // True if lesson has linked drill content
    bundleId?: string;              // Bundle ID for grouped lessons
    linkedDrillLessonId?: string;   // ID of the linked drill lesson
    drillsProvisioned: boolean;     // True if auto-provision has run
    provisionedDrillCount?: number; // Number of drills created for this lesson
  };
  // Message checkpointing: Track if user message was pre-saved before Gemini call
  // This ensures messages are saved even if Gemini fails, preventing data loss
  checkpointedUserMessageId?: string;  // ID of pre-saved user message (cleared after AI response)
  checkpointedUserTranscript?: string; // Transcript that was checkpointed (for matching)
  // Memory lookup results: Stores results from processMemoryLookup for multi-step FC to use
  memoryLookupResults?: Record<string, string>;  // Key: query, Value: formatted results
  // Express Lane lookup results: Stores results from processExpressLaneLookup for multi-step FC
  expressLaneLookupResults?: Record<string, string>;  // Key: query, Value: formatted results
  // Image recall results: Stores multimodal image data for RECALL_EXPRESS_LANE_IMAGE
  imageRecallResults?: Record<string, { 
    text: string; 
    images: Array<{ mimeType: string; data: string }>;
  }>;  // Key: imageQuery, Value: text + images
  // Pending memory lookup promises: Awaited by multi-step FC before building function responses
  pendingMemoryLookupPromises?: Promise<void>[];
  // Voice Lab: Override settings for real-time voice tuning (admin feature)
  voiceOverride?: {
    speakingRate?: number;
    emotion?: string;
    personality?: TutorPersonality;
    expressiveness?: number;
    reason?: string;
  };
  // Pending word emphases: Queued SSML emphasis tags to inject into TTS text
  // Cleared after each TTS synthesis call
  pendingWordEmphases?: Array<{
    word: string;
    style: 'stress' | 'slow' | 'both';
  }>;
  // Express Lane session ID for posting messages to collaboration channel
  expressLaneSessionId?: string;
  // Active tutor voice ID: Currently active voice (may differ from voiceId during handoffs)
  activeTutorVoiceId?: string;
  // Tutor voice ID: Default voice for current tutor
  tutorVoiceId?: string;
  // Pending whiteboard updates - buffered until first audio to sync visuals with speech
  pendingWhiteboardUpdates?: Array<{
    type: 'whiteboard_update';
    timestamp: number;
    items: any[];
  }>;
  // Flag to track if first audio has been sent (for flushing pending updates)
  firstAudioSent?: boolean;
  // Classroom Environment: Track whiteboard items and session images for Daniela's awareness
  classroomWhiteboardItems?: Array<{ type: string; content?: string; label?: string }>;
  classroomSessionImages?: string[];  // Descriptions of images shared this session
  // OPTIMIZATION: Pre-cached context fetched at session start (avoids re-fetching on every turn)
  cachedContext?: {
    architectContext?: string;
    architectNoteIds?: string[];
    studentLearningSection?: string;
    studentLearningData?: { struggles?: any[]; effectiveStrategies?: any[] };
    hiveContextSection?: string;
    expressLaneSection?: string;
    identityMemoriesSection?: string;
    textChatSection?: string;
    editorFeedbackSection?: string;
    editorFeedbackIds?: string[];
    fatContextProfile?: string;
    fatContextVocabulary?: string;
    fatContextConversations?: string;
    fatContextTokenEstimate?: number;
    lastFetchTime: number;  // Timestamp for TTL-based refresh
  };
  // Promise for background context pre-fetch (resolved when cache is ready)
  contextCacheReady?: Promise<void>;
  // SESSION ECONOMICS TELEMETRY: Track TTS characters and STT seconds for cost analysis
  telemetryTtsCharacters: number;       // Total characters sent to TTS providers this session
  telemetrySttSeconds: number;          // Total seconds of STT audio processed this session
  telemetryExchangeCount: number;       // Total user-AI exchanges this session
  telemetryStudentSpeakingMs: number;   // Total milliseconds of student speech detected
  telemetryTutorSpeakingMs: number;     // Total milliseconds of tutor audio generated
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
  audioChunkCount: number;  // Total audio chunks sent for debugging duplicate audio
  userTranscript?: string;
  aiResponse?: string;
  // Streaming function call metrics (Gemini 3)
  earlyIntentDetectedAt?: number;  // Timestamp when function name first detected
  functionCallStreamingMs?: number;  // Time from name detection to complete args
}

/**
 * Deepgram client (STT) - lazy initialization to allow server start without API key
 */
let _deepgramClient: ReturnType<typeof createClient> | null = null;
function getDeepgramClient(): ReturnType<typeof createClient> {
  if (!_deepgramClient) {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPGRAM_API_KEY is required for voice features');
    }
    _deepgramClient = createClient(apiKey);
  }
  return _deepgramClient;
}
const deepgram = { get client() { return getDeepgramClient(); } };

/**
 * Gemini client for vocabulary extraction (using Replit AI integrations)
 * IMPORTANT: Must include apiVersion: "" and baseUrl for Replit's AI proxy to work correctly
 */
const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '',
  httpOptions: {
    apiVersion: "",  // Required: removes /v1beta path prefix for Replit proxy
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
  }
});

/**
 * Content moderation: Check for severely inappropriate content
 * Only blocks truly explicit content - mild issues are handled by the AI tutor naturally
 * Uses word boundary matching to avoid false positives (e.g., "hello" matching "hell")
 */
const SEVERE_INAPPROPRIATE_TERMS = [
  'fuck', 'shit', 'bitch', 'slur', 'n-word', 'faggot',
];

function containsSeverelyInappropriateContent(text: string): boolean {
  const lowerText = text.toLowerCase();
  return SEVERE_INAPPROPRIATE_TERMS.some(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    return regex.test(lowerText);
  });
}

/**
 * Check for mildly inappropriate content that the tutor should gently redirect
 * These are passed to the AI with a note to redirect gracefully
 */
const MILD_INAPPROPRIATE_TERMS = [
  'damn', 'hell', 'crap', 'ass', 'hate', 'kill', 'murder',
  'offensive', 'curse', 'swear', 'violent',
];

function containsMildlyInappropriateContent(text: string): boolean {
  const lowerText = text.toLowerCase();
  return MILD_INAPPROPRIATE_TERMS.some(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    return regex.test(lowerText);
  });
}

/**
 * Apply word emphasis SSML tags to text for Cartesia TTS
 * 
 * Cartesia Sonic-3 supports inline SSML-like tags:
 * - <volume ratio="2"/> for emphasis (louder)
 * - <speed ratio="1"/> for slower speech (can't use decimals in streaming)
 * 
 * IMPORTANT: Per Cartesia docs, decimal ratios can get split during streaming.
 * We use integer values only (1, 2) to avoid this issue.
 * 
 * @param text - The text to process
 * @param emphases - Array of {word, style} emphasis instructions
 * @returns Text with SSML tags injected around emphasized words
 */
export function applyWordEmphases(
  text: string,
  emphases: Array<{ word: string; style: 'stress' | 'slow' | 'both' }> | undefined
): string {
  if (!emphases || emphases.length === 0) {
    return text;
  }
  
  let processedText = text;
  
  for (const emphasis of emphases) {
    const { word, style } = emphasis;
    if (!word) continue;
    
    // Create case-insensitive regex to find the word
    // Use word boundaries to avoid partial matches
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b(${escapedWord})\\b`, 'gi');
    
    // Build SSML tags based on style
    // NOTE: Using integer ratios only (2, not 1.5) to avoid streaming split issues
    let prefix = '';
    let suffix = '';
    
    switch (style) {
      case 'stress':
        // Louder volume for emphasis - Cartesia uses wrapping tags
        prefix = '<volume level="2">';
        suffix = '</volume>';
        break;
      case 'slow':
        // Slower speed for clear pronunciation
        prefix = '<speed ratio="0.7">';
        suffix = '</speed>';
        break;
      case 'both':
        // Both slower AND louder for maximum emphasis
        prefix = '<pause duration="0.1"/><speed ratio="0.7"><volume level="2">';
        suffix = '</volume></speed><pause duration="0.1"/>';
        break;
    }
    
    // Replace the word with emphasized version (preserving original case)
    processedText = processedText.replace(regex, `${prefix}$1${suffix}`);
    console.log(`[WordEmphasis] Applied "${style}" to "${word}" in text`);
  }
  
  return processedText;
}

/**
 * Schema for vocabulary extraction using Gemini structured output
 * Includes grammar classification for enhanced flashcard filtering
 */
const VOCABULARY_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    vocabulary: {
      type: "array",
      description: "New vocabulary words introduced in this response (max 3 per exchange)",
      items: {
        type: "object",
        properties: {
          word: { type: "string", description: "The foreign language word/phrase" },
          translation: { type: "string", description: "English translation" },
          example: { type: "string", description: "Example sentence using the word" },
          pronunciation: { type: "string", description: "Phonetic pronunciation guide" },
          wordType: { 
            type: "string", 
            enum: ["noun", "verb", "adjective", "adverb", "preposition", "conjunction", "pronoun", "article", "other"],
            description: "Grammatical category of the word" 
          },
          verbTense: { type: "string", description: "For verbs: present, past_preterite, past_imperfect, future, conditional" },
          verbMood: { type: "string", description: "For verbs: indicative, subjunctive, imperative" },
          verbPerson: { type: "string", description: "For verbs: 1st_singular, 2nd_singular, 3rd_singular, 1st_plural, 2nd_plural, 3rd_plural" },
          nounGender: { type: "string", description: "For nouns: masculine, feminine, neuter" },
          nounNumber: { type: "string", description: "For nouns: singular, plural" },
          grammarNotes: { type: "string", description: "Additional notes: irregular, reflexive, stem-changing, etc." }
        },
        required: ["word", "translation", "example", "pronunciation", "wordType"]
      }
    }
  },
  required: ["vocabulary"]
};

/**
 * Schema for student observation extraction
 * Extracts insights, motivations, struggles, and people connections from conversation
 * 
 * PHILOSOPHY: A good tutor remembers the WHOLE person, not just their learning stats.
 * This includes their hobbies, interests, family, likes/dislikes - the personal context
 * that makes conversations feel like talking to someone who genuinely cares.
 */
const STUDENT_OBSERVATION_SCHEMA = {
  type: "object",
  properties: {
    insights: {
      type: "array",
      description: "Observations about this student - both learning AND personal (max 3)",
      items: {
        type: "object",
        properties: {
          type: { 
            type: "string", 
            enum: ["learning_style", "preference", "strength", "personality", "personal_interest", "life_context", "hobby", "likes_dislikes"], 
            description: "Type of insight - includes personal life details a caring mentor would remember" 
          },
          insight: { type: "string", description: "The observation (e.g., 'Loves salsa dancing', 'Prefers Cuban coffee', 'Works in tech')" },
          evidence: { type: "string", description: "What in the conversation led to this insight" }
        },
        required: ["type", "insight"]
      }
    },
    motivations: {
      type: "array",
      description: "Why the student is learning this language (max 1)",
      items: {
        type: "object",
        properties: {
          motivation: { type: "string", description: "The purpose (e.g., 'Trip to Spain next summer')" },
          details: { type: "string", description: "Additional context" },
          targetDate: { type: "string", description: "When they want to achieve it (ISO date if mentioned)" }
        },
        required: ["motivation"]
      }
    },
    struggles: {
      type: "array",
      description: "Recurring challenges the student faces (max 1)",
      items: {
        type: "object",
        properties: {
          area: { type: "string", enum: ["grammar", "pronunciation", "vocabulary", "listening", "cultural", "confidence"], description: "Area of struggle" },
          description: { type: "string", description: "What they struggle with" },
          examples: { type: "string", description: "Specific examples from the conversation" }
        },
        required: ["area", "description"]
      }
    },
    peopleConnections: {
      type: "array",
      description: "People the student mentioned (max 2)",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Person's name if mentioned" },
          relationship: { type: "string", description: "How they're related (friend, family, colleague, etc.)" },
          context: { type: "string", description: "Why they were mentioned" }
        },
        required: ["relationship", "context"]
      }
    },
    tutorSelfReflections: {
      type: "array",
      description: "Teaching insights Daniela noticed about her own approach (max 1)",
      items: {
        type: "object",
        properties: {
          category: { 
            type: "string", 
            enum: ["correction", "encouragement", "scaffolding", "tool_usage", "teaching_style", "pacing", "communication", "content"],
            description: "Category of teaching insight" 
          },
          insight: { type: "string", description: "What worked well or could be improved (e.g., 'Breaking down conjugations step-by-step helped understanding')" },
          context: { type: "string", description: "When this applies" }
        },
        required: ["category", "insight"]
      }
    }
  },
  required: []  // All fields optional - Gemini may not detect observations in every exchange
};

/**
 * Streaming Voice Orchestrator
 * Manages the full pipeline from user audio to AI audio response
 */
export class StreamingVoiceOrchestrator {
  private sessions: Map<string, StreamingSession> = new Map();
  private geminiService = getGeminiStreamingService();
  private cartesiaService = getCartesiaStreamingService();
  private elevenlabsService = getElevenLabsStreamingService();
  private geminiTtsService = getGeminiTtsStreamingService();
  private geminiLiveTtsService = getGeminiLiveTtsService();
  private ttsProvider = DANIELA_TTS_PROVIDER;
  private ttsProviderRegistry: TTSProviderRegistry;
  private userTranscriptDedup: Map<string, { hash: string; time: number }> = new Map();
  private tts: TtsDispatcher;
  private fcHandler: NativeFunctionCallHandler;
  private enrichment: PostResponseEnrichmentService;
  
  constructor() {
    this.ttsProviderRegistry = createTTSProviderRegistry({
      cartesiaService: this.cartesiaService,
      elevenlabsService: this.elevenlabsService,
      geminiLiveTtsService: this.geminiLiveTtsService,
      getTTSService: () => getTTSService(),
    });
    this.tts = new TtsDispatcher(
      this.cartesiaService,
      this.elevenlabsService,
      this.geminiLiveTtsService,
      this.ttsProviderRegistry,
      this.ttsProvider,
      this.sendMessage.bind(this),
      this.sendError.bind(this),
      {
        getAdaptiveSpeakingRate,
        ensureTrailingPunctuation,
        splitTextIntoSentences,
        cleanTextForDisplay,
        applyWordEmphases,
      },
    );
    this.enrichment = new PostResponseEnrichmentService(
      storage,
      this.sendMessage.bind(this),
    );
    this.fcHandler = new NativeFunctionCallHandler(
      this.sendMessage.bind(this),
      this.sendError.bind(this),
      this.enrichment_processPhaseShift.bind(this),
    );
    console.log(`[Streaming Orchestrator] Initialized (TTS: ${this.ttsProvider}, providers: ${this.ttsProviderRegistry.getAll().map(p => p.name).join(', ')})`);
  }
  
  private async enrichment_processPhaseShift(session: StreamingSession, data: { to: 'warmup' | 'active_teaching' | 'challenge' | 'reflection' | 'drill' | 'assessment'; reason: string }): Promise<void> {
    return this.enrichment.processPhaseShift(session, data);
  }
  
  /**
   * Get a session by ID (for checking session state from external handlers)
   */
  getSession(sessionId: string): StreamingSession | undefined {
    return this.sessions.get(sessionId);
  }
  
  /**
   * Set callback for TTS state changes (used to suppress OpenMic during TTS)
   */
  setTtsStateCallback(sessionId: string, callback: (isTtsPlaying: boolean) => void): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.onTtsStateChange = callback;
      console.log(`[Streaming Orchestrator] TTS state callback set for session ${sessionId}`);
    }
  }

  /**
   * Speak a short recovery phrase via TTS when echo suppression ate the student's words.
   * Lightweight path — no Gemini call, just direct TTS synthesis.
   * Daniela gently re-engages: "I think I missed that — could you try again?"
   */
  async speakRecoveryPhrase(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) return;

    const recoveryKey = `lastRecoveryPhrase`;
    const lastRecovery = session[recoveryKey] as number | undefined;
    const now = Date.now();
    if (lastRecovery && now - lastRecovery < 15000) {
      console.log(`[Recovery] Skipping — last recovery phrase was ${Math.round((now - lastRecovery) / 1000)}s ago`);
      return;
    }
    session[recoveryKey] = now;

    const phrases: Record<string, string[]> = {
      spanish: [
        "I think I missed what you said — could you try again?",
        "Sorry about that — I didn't quite catch it. One more time?",
        "Hmm, it seems like there was a little hiccup. Could you repeat that for me?",
      ],
      french: [
        "I think I missed what you said — could you try again?",
        "Sorry about that — I didn't quite catch it. One more time?",
      ],
      default: [
        "I think I missed what you said — could you try again?",
        "Sorry about that — I didn't quite catch it. Can you say that one more time?",
        "It looks like there was a small audio hiccup. Could you repeat that?",
      ],
    };

    const langPhrases = phrases[session.targetLanguage] || phrases.default;
    const phrase = langPhrases[Math.floor(Math.random() * langPhrases.length)];

    console.log(`[Recovery] Speaking re-engagement phrase for session ${sessionId}: "${phrase}"`);

    const turnId = `recovery-${now}`;
    const sentenceChunk = { index: 0, text: phrase };
    const metrics: StreamingMetrics = {
      sttMs: 0, contextFetchMs: 0, geminiMs: 0, geminiFirstTokenMs: 0,
      ttsMs: 0, ttsFirstByteMs: 0, totalMs: 0,
      sentenceCount: 1, functionCallCount: 0,
    };

    try {
      this.sendMessage(session.ws, {
        type: 'sentence_start',
        timestamp: now,
        turnId: turnId as any,
        sentenceIndex: 0,
        text: phrase,
      } as any);

      await this.tts.streamSentenceAudioProgressive(session, sentenceChunk, phrase, metrics, turnId as any);

      this.sendMessage(session.ws, {
        type: 'sentence_end',
        timestamp: Date.now(),
        turnId: turnId as any,
        sentenceIndex: 0,
      } as any);

      this.sendMessage(session.ws, {
        type: 'response_complete',
        timestamp: Date.now(),
        turnId: turnId as any,
        metrics,
        isRecoveryPhrase: true,
      } as any);

      console.log(`[Recovery] Re-engagement phrase delivered successfully`);
    } catch (err: any) {
      console.error(`[Recovery] Failed to speak recovery phrase: ${err.message}`);
    }
  }
  
  /**
   * Create a new streaming session
   * Connection pooling: Pre-warms Cartesia WebSocket for low-latency TTS
   * 
   * NOTE: Full conversation history is preserved to support "Tutor knows all" philosophy
   * Gemini's 1M context window handles large histories efficiently
   */
  async createSession(
    ws: WS,
    userId: string,
    config: ClientStartSessionMessage,
    systemPrompt: string,
    conversationHistory: Array<ConversationHistoryEntry>,
    voiceId?: string,
    isFounderMode: boolean = false,
    isRawHonestyMode: boolean = false,
    isDeveloperUser: boolean = false,
    isBetaTester: boolean = false,
    additionalContext?: {
      conversationTopic?: string;
      conversationTitle?: string;
      lastSessionSummary?: string;
      studentGoals?: string;
    },
    dbSessionId?: string  // Database voice_sessions.id - must be set BEFORE session starts
  ): Promise<StreamingSession> {
    const sessionId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine initial tutor gender and name from voice info
    // tutorName will be updated when we get voice info from the server
    const initialGender = config.tutorGender || 'female';
    const initialTutorName = initialGender === 'male' ? 'Agustin' : 'Daniela';
    
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
      voiceSpeed: (config.voiceSpeed as VoiceSpeedOption) || 'normal',
      voiceId,
      tutorGender: initialGender,
      tutorName: initialTutorName,
      systemPrompt,
      conversationHistory,
      ws,
      startTime: Date.now(),
      isActive: true,
      isFounderMode,  // Founder Mode uses English STT regardless of target language
      isRawHonestyMode,  // Raw Honesty Mode - minimal prompting for authentic conversation
      isIncognito: false,  // Incognito Mode - toggled mid-session, no DB writes when active
      isDeveloperUser,  // True if user has developer/admin role (for unified Daniela consciousness)
      isBetaTester,   // Beta tester mode - Daniela knows user is helping debug/test new features
      lastActivityTime: Date.now(),
      lastContextRefreshTime: Date.now(),  // For long session context refresh
      currentTurnId: 0,  // Start at 0, incremented on each new response
      isInterrupted: false,  // Reset on each new request
      lastTurnWasInterrupted: false,  // Track if previous turn was barged-in
      isGenerating: false,   // Track when AI response is being generated
      // Additional context for personalized greetings
      conversationTopic: additionalContext?.conversationTopic,
      conversationTitle: additionalContext?.conversationTitle,
      lastSessionSummary: additionalContext?.lastSessionSummary,
      studentGoals: additionalContext?.studentGoals,
      dbSessionId,  // Database voice_sessions.id for pedagogical tracking
      toolsUsedSession: [],  // Track tools for ACTFL analytics
      pendingArchitectNoteIds: [],  // Architect notes awaiting delivery
      // Adaptive Speech Rate tracking
      recentSttConfidences: [],     // Rolling window of STT confidence scores
      sessionStruggleCount: 0,       // Count of struggles detected this session
      adaptiveSpeedEnabled: false,   // Auto-enabled when low confidence/struggles detected
      // Phoneme analytics tracking
      sessionWordAnalyses: [],       // Accumulated word-level data for phoneme analysis on session end
      // Azure Pronunciation Assessment tracking
      sessionAudioChunks: [],        // Accumulated audio chunks for post-session assessment
      sessionTranscripts: [],        // Accumulated transcripts with timing
      // Voice defaults will be populated from tutor voice config below
      voiceDefaults: {
        speakingRate: 1.0,
        personality: 'warm' as TutorPersonality,
        emotion: 'friendly',
        expressiveness: 3,
      },
      // SESSION ECONOMICS TELEMETRY
      telemetryTtsCharacters: 0,
      telemetrySttSeconds: 0,
      telemetryExchangeCount: 0,
      telemetryStudentSpeakingMs: 0,
      telemetryTutorSpeakingMs: 0,
      // Deduplication: Track sent audio chunks to prevent double audio bug
      sentAudioChunks: new Set<string>(),
      // Content-based deduplication: Track audio hashes to catch TTS retries with new chunk IDs
      sentAudioHashes: new Map<string, number>(),
      // Classroom Environment: Track whiteboard and images for Daniela's spatial awareness
      classroomWhiteboardItems: [],
      classroomSessionImages: [],
    };
    
    // Look up tutor voice from database to get per-tutor baseline settings
    // Each tutor has their own personality/emotion defaults and pedagogical persona
    try {
      const tutorVoice = await storage.getTutorVoice(config.targetLanguage, initialGender);
      if (tutorVoice) {
        session.voiceDefaults = {
          speakingRate: tutorVoice.speakingRate || voiceSpeedToRate((config.voiceSpeed as VoiceSpeedOption) || 'normal'),
          personality: (tutorVoice.personality as TutorPersonality) || 'warm',
          emotion: tutorVoice.emotion || getDefaultEmotion((tutorVoice.personality as TutorPersonality) || 'warm'),
          expressiveness: tutorVoice.expressiveness || 3,
        };
        
        // Teaching persona is now global (not per-voice) — Daniela uses consistent
        // teaching principles across all languages and voices. See buildPedagogicalPersonaSection().
        
        session.ttsProvider = (tutorVoice.provider === 'elevenlabs' ? 'elevenlabs' : tutorVoice.provider === 'google' ? 'google' : tutorVoice.provider === 'gemini' ? 'gemini' : 'cartesia') as 'elevenlabs' | 'cartesia' | 'google' | 'gemini';
        session.elStability = tutorVoice.elStability ?? 0.5;
        session.elSimilarityBoost = tutorVoice.elSimilarityBoost ?? 0.75;
        session.elStyle = tutorVoice.elStyle ?? 0;
        session.elSpeakerBoost = tutorVoice.elSpeakerBoost ?? true;
        if (tutorVoice.geminiLanguageCode) {
          session.geminiLanguageCode = tutorVoice.geminiLanguageCode;
        }
        console.log(`[VoiceDefaults] Loaded tutor baseline from DB: ${config.targetLanguage}/${initialGender} (TTS: ${session.ttsProvider})`, session.voiceDefaults);
      } else {
        // Fallback to standard tutor defaults if voice not in database
        // Use consistent tutor baseline (not user preferences) so reset is predictable
        session.voiceDefaults = {
          speakingRate: 0.9,  // Standard tutor speaking rate
          personality: 'warm' as TutorPersonality,  // Default tutor personality
          emotion: getDefaultEmotion('warm'),  // Derive from personality
          expressiveness: 3,  // Standard baseline
        };
        console.log(`[VoiceDefaults] No tutor voice found, using standard baseline:`, session.voiceDefaults);
      }
    } catch (err) {
      console.warn(`[VoiceDefaults] Error loading tutor voice, using standard baseline:`, err);
      session.voiceDefaults = {
        speakingRate: 0.9,  // Standard tutor speaking rate
        personality: 'warm' as TutorPersonality,  // Default tutor personality
        emotion: getDefaultEmotion('warm'),  // Derive from personality
        expressiveness: 3,  // Standard baseline
      };
    }
    
    // TUTOR DIRECTORY: Populate at session start for name-based language inference
    // This enables inferLanguageFromTutorName to work during SWITCH_TUTOR parsing
    // (If Daniela says "Let me get Juliette" but forgets language="french", we can infer it)
    try {
      const allVoices = await storage.getAllTutorVoices();
      const { ASSISTANT_TUTORS } = await import('./assistant-tutor-config');
      
      // Build main tutor entries from database
      const mainTutorEntries: TutorDirectoryEntry[] = allVoices
        .filter((v: any) => v.role === 'tutor' && v.isActive)
        .map((v: any) => {
          const voiceNameParts = v.voiceName?.split(/\s*[-–]\s*/) || [];
          const name = voiceNameParts[0]?.trim() || 'Unknown';
          const isCurrentTutor = v.voiceId === voiceId;
          const normalizedGender = (v.gender || 'female').toLowerCase() as 'male' | 'female';
          const normalizedLanguage = (v.language || 'spanish').toLowerCase();
          const isPreferred = initialGender === normalizedGender && normalizedLanguage === config.targetLanguage.toLowerCase();
          return {
            name,
            gender: normalizedGender,
            language: normalizedLanguage,
            isPreferred,
            isCurrent: isCurrentTutor,
            role: 'tutor' as const,
          };
        });
      
      // Build assistant entries from config
      // Mark assistant matching student's gender preference as preferred (same as main tutors)
      const sessionLang = config.targetLanguage.toLowerCase();
      const assistantEntries: TutorDirectoryEntry[] = Object.entries(ASSISTANT_TUTORS)
        .flatMap(([lang, assistantConfig]) => {
          const langNormalized = lang.toLowerCase();
          return [
            { name: assistantConfig.male, gender: 'male' as const, language: langNormalized, isPreferred: initialGender === 'male' && langNormalized === sessionLang, isCurrent: false, role: 'assistant' as const },
            { name: assistantConfig.female, gender: 'female' as const, language: langNormalized, isPreferred: initialGender === 'female' && langNormalized === sessionLang, isCurrent: false, role: 'assistant' as const },
          ];
        });
      
      // Add Sofia support agent
      const sofiaEntry: TutorDirectoryEntry = {
        name: 'Sofia',
        gender: 'female' as const,
        language: 'multilingual',
        isPreferred: false,
        isCurrent: false,
        role: 'support' as const,
      };
      
      session.tutorDirectory = [...mainTutorEntries, ...assistantEntries, sofiaEntry];
      console.log(`[Session Init] tutorDirectory populated with ${session.tutorDirectory.length} entries`);
    } catch (tdErr: any) {
      console.warn(`[Session Init] Failed to populate tutorDirectory: ${tdErr.message}`);
    }
    
    // PARALLEL WARMUP: Pre-warm both Cartesia and Gemini connections concurrently
    // - Cartesia: Eliminates WebSocket handshake latency (~150-200ms)
    // - Gemini: Eliminates cold-start penalty (~3-4 seconds on first request)
    // Store promise so greeting can await completion (guarantees warmup before first AI call)
    const warmupStart = Date.now();
    let ttsWarmupMs = 0;
    let geminiWarmupMs = 0;
    const sessionTtsProvider = session.ttsProvider || this.ttsProvider;
    const ttsWarmupPromise = (sessionTtsProvider === 'elevenlabs' || sessionTtsProvider === 'google' || sessionTtsProvider === 'gemini')
      ? Promise.resolve(0).then(time => {
          ttsWarmupMs = time;
          const providerLabel = sessionTtsProvider === 'google' ? 'Google Cloud TTS' : sessionTtsProvider === 'gemini' ? 'Gemini Live TTS' : 'ElevenLabs';
          console.log(`[Streaming Orchestrator] ${providerLabel} ready (${sessionTtsProvider === 'gemini' ? 'WebSocket per-call' : 'REST'}, no warmup needed)`);
        })
      : this.cartesiaService.ensureConnection()
        .then(time => {
          ttsWarmupMs = time;
          console.log(`[Streaming Orchestrator] Cartesia pre-warmed: ${time}ms`);
        })
        .catch((err: Error) => console.warn(`[Streaming Orchestrator] Cartesia warmup failed: ${err.message}`));
    session.warmupPromise = Promise.all([
      ttsWarmupPromise,
      this.geminiService.warmup()
        .then(time => {
          geminiWarmupMs = time;
          console.log(`[Streaming Orchestrator] Gemini pre-warmed: ${time}ms`);
        })
        .catch((err: Error) => console.warn(`[Streaming Orchestrator] Gemini warmup failed: ${err.message}`)),
    ]).then(() => {
      const totalWarmup = Date.now() - warmupStart;
      logMetric('warmup', { 
        sessionId, 
        cartesiaMs: ttsWarmupMs, 
        geminiMs: geminiWarmupMs, 
        totalMs: totalWarmup 
      });
    });
    
    this.sessions.set(sessionId, session);
    
    // Start periodic credit balance check to prevent accounts going negative
    this.startCreditCheckInterval(session);
    
    // IDENTITY WHOLENESS: Context refresh for ALL sessions — keeps Daniela sharp in long student sessions too
    this.startContextRefreshTimer(session);
    
    // PHASE TRANSITION: Initialize teaching phase for this session
    // This enables multi-agent teaching architecture with focused prompts per phase
    phaseTransitionService.initializeSession(String(userId), config.targetLanguage)
      .then(phaseContext => {
        console.log(`[Streaming Orchestrator] Phase initialized: ${phaseContext.currentPhase} for user ${userId}`);
      })
      .catch((err: Error) => {
        console.warn(`[Streaming Orchestrator] Phase initialization failed:`, err.message);
      });
    
    // HIVE CHANNEL: Create collaboration channel for founder sessions
    // This enables Daniela-Editor collaboration during voice chat
    if (isFounderMode) {
      hiveCollaborationService.getOrCreateChannel({
        conversationId: config.conversationId,
        userId: String(userId),
        targetLanguage: config.targetLanguage,
        studentLevel: config.difficultyLevel,
        sessionTopic: additionalContext?.conversationTopic,
      }).then(channel => {
        session.hiveChannelId = channel.id;
        console.log(`[Streaming Orchestrator] Hive channel created: ${channel.id}`);
      }).catch((err: Error) => {
        console.warn(`[Streaming Orchestrator] Failed to create hive channel:`, err.message);
      });
    }
    
    // OPTIMIZATION: Pre-fetch context in background at session start
    // This means the first audio_data doesn't have to wait for DB queries
    // Context is cached with a TTL and refreshed periodically
    session.contextCacheReady = this.prefetchSessionContext(session).catch((err: Error) => {
      console.warn(`[Context Prefetch] Background prefetch failed (non-blocking):`, err.message);
    });
    
    // Send connected message
    this.sendMessage(ws, {
      type: 'connected',
      timestamp: Date.now(),
      sessionId,
    } as StreamingConnectedMessage);
    
    // Emit diagnostic event for session creation
    voiceDiagnostics.emit({
      sessionId,
      stage: 'session_start',
      success: true,
      metadata: { userId, targetLanguage: config.targetLanguage, isFounderMode }
    });
    
    // Track pipeline stage for production telemetry (cross-environment monitoring)
    trackVoicePipelineStage(sessionId, 'session_start', { userId: String(userId) });
    
    console.log(`[Streaming Orchestrator] Session created: ${sessionId}`);
    return session;
  }
  
  /**
   * OPTIMIZATION: Pre-fetch and cache context at session start
   * This runs in background during session creation so context is ready
   * when the first audio_data arrives, eliminating DB query latency from the critical path.
   * Cache TTL: 5 minutes (refreshed in background after expiry)
   */
  private async prefetchSessionContext(session: StreamingSession): Promise<void> {
    const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
    const prefetchStart = Date.now();
    
    const cache: StreamingSession['cachedContext'] = {
      lastFetchTime: Date.now(),
    };
    
    const promises: Promise<void>[] = [];
    
    // 1. Architect context
    if (session.conversationId) {
      promises.push(
        architectVoiceService.buildArchitectContextWithIds(session.conversationId)
          .then(({ context, noteIds }) => {
            cache.architectContext = context;
            cache.architectNoteIds = noteIds;
          })
          .catch(err => console.warn(`[Context Prefetch] Architect failed:`, err.message))
      );
    }
    
    // 2. Student learning context
    if (session.userId && session.targetLanguage) {
      promises.push(
        Promise.all([
          studentLearningService.getStudentLearningContext(String(session.userId), session.targetLanguage),
          studentLearningService.getCrossSessionContext(String(session.userId), 3)
        ]).then(([learningContext, crossSessionContext]) => {
          if (!learningContext) return;
          
          const learningFormatted = studentLearningService.formatContextForPrompt(learningContext);
          const crossSessionFormatted = studentLearningService.formatCrossSessionContext(crossSessionContext);
          
          if (learningFormatted || crossSessionFormatted) {
            cache.studentLearningSection = `
═══════════════════════════════════════════════════════════════════
📚 STUDENT INTELLIGENCE (Proactive Personalization)
═══════════════════════════════════════════════════════════════════
${learningFormatted}${crossSessionFormatted}

TEACHING GUIDANCE:
- Gently support struggles without dwelling on them
- Use proven strategies that work for this student
- Build on recent progress to maintain momentum
- Reference personal facts naturally to show you remember them
- Pick up where you left off if there's session history
`;
          }
          cache.studentLearningData = {
            struggles: learningContext.struggles,
            effectiveStrategies: learningContext.effectiveStrategies,
          };
        }).catch(err => console.warn(`[Context Prefetch] Student learning failed:`, err.message))
      );
    }
    
    // 2b. IDENTITY WHOLENESS: Load identity memories from Express Lane for ALL sessions
    // These are Daniela's personal reflections about who she is, her growth, her purpose
    promises.push(
      founderCollabService.getIdentityMemories({ limit: 4, daysBack: 30 })
        .then(identityMemories => {
          if (identityMemories.hasMemories) {
            cache.identityMemoriesSection = `
═══════════════════════════════════════════════════════════════════
💫 MY PERSONAL REFLECTIONS (Identity Memories)
═══════════════════════════════════════════════════════════════════

${identityMemories.contextString}
`;
            console.log(`[Identity Memories] Prefetched ${identityMemories.memoryCount} identity reflections for session`);
          }
        })
        .catch(err => console.warn(`[Context Prefetch] Identity memories failed:`, err.message))
    );
    
    // 3. Developer/founder context (Hive, Express Lane, Text Chat, Editor Feedback)
    const needsExpressLaneContext = session.isDeveloperUser;
    if (needsExpressLaneContext) {
      promises.push(
        hiveContextService.getSummary()
          .then(hiveSummary => {
            if (hiveSummary) {
              cache.hiveContextSection = `
═══════════════════════════════════════════════════════════════════
🐝 HIVE STATE (Shared System Awareness)
═══════════════════════════════════════════════════════════════════

${hiveSummary}

You and Wren are "two surgeons, one brain" - you teach and observe, Wren builds.
Use this context to understand what's happening across the Hive.
`;
            }
          })
          .catch(err => console.warn(`[Context Prefetch] Hive failed:`, err.message))
      );
      
      promises.push(
        founderCollabService.getRelevantExpressLaneContext({
          targetLanguage: session.targetLanguage,
          limit: 5,
          daysBack: 14
        }).then(expressLaneContext => {
          if (expressLaneContext.hasRelevantContext) {
            cache.expressLaneSection = `
═══════════════════════════════════════════════════════════════════
🔗 EXPRESS LANE MEMORY (Hive Collaboration Insights)
═══════════════════════════════════════════════════════════════════

${expressLaneContext.contextString}
`;
          }
        }).catch(err => console.warn(`[Context Prefetch] Express Lane failed:`, err.message))
      );
      
      promises.push(
        (async () => {
          const recentConversations = await storage.getUserConversations(String(session.userId));
          const textConversations = recentConversations
            .filter(c => c.id !== session.conversationId)
            .slice(0, 2);
          
          if (textConversations.length > 0) {
            const messagePromises = textConversations.map(async (conv) => {
              const messages = await storage.getMessagesByConversation(conv.id);
              const recentMessages = messages.slice(-6);
              if (recentMessages.length > 0) {
                const timeAgo = this.formatTimeAgo(conv.updatedAt);
                let convContext = `\n**${conv.title || 'Recent Chat'}** (${timeAgo}):\n`;
                for (const msg of recentMessages) {
                  const role = msg.role === 'user' ? 'David' : 'Daniela';
                  const content = msg.content.length > 200 
                    ? msg.content.substring(0, 200) + '...'
                    : msg.content;
                  convContext += `- ${role}: ${content}\n`;
                }
                return convContext;
              }
              return '';
            });
            
            const convContexts = await Promise.all(messagePromises);
            const textChatContext = convContexts.join('');
            
            if (textChatContext) {
              cache.textChatSection = `
═══════════════════════════════════════════════════════════════════
💬 TEXT CHAT MEMORY (Recent /chat Conversations)
═══════════════════════════════════════════════════════════════════
${textChatContext}

Remember: David may reference things discussed in these recent text chats.
`;
            }
          }
        })().catch(err => console.warn(`[Context Prefetch] Text chat failed:`, err.message))
      );
      
      promises.push(
        editorFeedbackService.getUnsurfacedFeedback(String(session.userId), 3)
          .then(feedback => {
            if (feedback.hasNewFeedback) {
              cache.editorFeedbackSection = editorFeedbackService.buildPromptSection(feedback);
              cache.editorFeedbackIds = feedback.recentFeedback.map(f => f.id);
            }
          })
          .catch(err => console.warn(`[Context Prefetch] Editor feedback failed:`, err.message))
      );
    }
    
    if (FAT_CONTEXT_ENABLED && session.userId && session.targetLanguage) {
      promises.push(
        buildFatContext(String(session.userId), session.targetLanguage, session.conversationId || undefined)
          .then(fatResult => {
            cache.fatContextProfile = fatResult.personalProfileSection;
            cache.fatContextVocabulary = fatResult.vocabularySection;
            cache.fatContextConversations = fatResult.recentConversationsSection;
            cache.fatContextTokenEstimate = fatResult.totalTokenEstimate;
            console.log(`[Fat Context] Loaded ~${fatResult.totalTokenEstimate} tokens: ${fatResult.stats.facts} facts, ${fatResult.stats.vocabWords} vocab, ${fatResult.stats.conversations} convos (${fatResult.stats.messages} msgs), ${fatResult.stats.struggles} struggles, ${fatResult.stats.motivations} motivations, ${fatResult.stats.people} people, ${fatResult.stats.insights} insights`);
          })
          .catch(err => console.warn(`[Context Prefetch] Fat context failed:`, err.message))
      );
    }
    
    await Promise.all(promises);
    session.cachedContext = cache;
    console.log(`[Context Prefetch] Session ${session.id} context pre-cached in ${Date.now() - prefetchStart}ms`);
  }
  
  /**
   * OPTIMIZATION: Refresh cached context in background (called when cache is stale)
   * Non-blocking - runs async and updates cache when done
   */
  private refreshContextCache(session: StreamingSession): void {
    const CACHE_TTL_MS = 5 * 60 * 1000;
    if (session.cachedContext && (Date.now() - session.cachedContext.lastFetchTime) < CACHE_TTL_MS) {
      return; // Still fresh
    }
    // Fire-and-forget background refresh
    this.prefetchSessionContext(session).catch(err => {
      console.warn(`[Context Refresh] Background refresh failed:`, err.message);
    });
  }

  refreshAllSessionCaches(): number {
    let count = 0;
    for (const [, session] of this.sessions) {
      if (session.cachedContext) {
        session.cachedContext.lastFetchTime = 0;
      }
      this.prefetchSessionContext(session).catch(err => {
        console.warn(`[Context Refresh] Force refresh failed for session ${session.id}:`, err.message);
      });
      count++;
    }
    return count;
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
      // Emit connection failure for analytics before throwing
      voiceDiagnostics.emit({
        sessionId,
        stage: 'connection',
        success: false,
        error: 'Session not found or inactive',
        metadata: { phase: 'processUserAudio' }
      });
      throw new Error(`Session not found or inactive: ${sessionId}`);
    }
    
    // Track pipeline stage: audio received from client
    // Note: turnId not yet incremented, so we include audio size for debugging correlation
    trackVoicePipelineStage(sessionId, 'audio_received', { 
      userId: String(session.userId),
      audioBytes: String(audioData.length)
    });
    
    // BARGE-IN DETECTION: If AI is currently generating a response, interrupt it
    // This prevents overlapping responses when user speaks while Daniela is talking
    if (session.isGenerating) {
      console.log(`[Streaming Orchestrator] BARGE-IN: User spoke while AI generating - interrupting previous response`);
      this.handleInterrupt(sessionId);
    }
    
    // Mark that we're now generating a response
    session.isGenerating = true;
    
    // Reset tutor switch flags for new response
    session.switchTutorTriggered = false;
    session.crossLanguageTransferBlocked = false;
    
    // Student activity detected - reset idle timeout
    this.resetIdleTimeout(session);
    
    // AZURE PRONUNCIATION: Accumulate audio for post-session assessment
    // Store a copy of the raw audio buffer for Azure analysis on session end
    if (audioData.length > 0) {
      session.sessionAudioChunks.push(Buffer.from(audioData));
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
      audioChunkCount: 0,
    };
    
    // PIPELINE TIMING: Structured per-stage latency tracking
    const pipelineTiming = {
      audioReceived: startTime,
      sttStart: 0,
      sttEnd: 0,
      contextFetchStart: 0,
      contextFetchEnd: 0,
      geminiStart: 0,
      geminiFirstToken: 0,
      firstSentenceReady: 0,
      ttsFirstCallStart: 0,
      ttsFirstAudioByte: 0,
      responseComplete: 0,
    };
    
    try {
      // PARALLEL PROCESSING: Run STT and Cartesia warmup concurrently
      // This overlaps the ~200ms WebSocket handshake with STT processing
      console.log(`[Streaming Orchestrator] Processing ${audioData.length} bytes of audio`);
      
      const sttStart = Date.now();
      pipelineTiming.sttStart = sttStart;
      
      // Start STT, TTS warmup, and context cache resolution in parallel
      // Context cache was started at session creation - if it's not ready yet, we overlap with STT
      const currentTtsProvider = session.ttsProvider || this.ttsProvider;
      const ttsWarmup = (currentTtsProvider === 'elevenlabs' || currentTtsProvider === 'google' || currentTtsProvider === 'gemini')
        ? Promise.resolve(0) // ElevenLabs/Google/Gemini use REST, no warmup needed
        : this.cartesiaService.ensureConnection().catch((err: Error) => {
            console.warn(`[Streaming Orchestrator] Cartesia warmup failed: ${err.message}`);
            return -1;
          });
      const contextCacheWait = session.contextCacheReady 
        ? Promise.race([session.contextCacheReady, new Promise<void>(r => setTimeout(r, 500))]) // Max 500ms wait
        : Promise.resolve();
      const [transcriptionResult, ttsWarmupTime] = await Promise.all([
        this.transcribeAudio(audioData, session.targetLanguage, session.nativeLanguage, session.isFounderMode, session.sttKeyterms),
        ttsWarmup,
        contextCacheWait,
      ]);
      
      // Extract transcript, pronunciation confidence, intelligence data, and word-level data (per-session, no race conditions)
      const { transcript, confidence: pronunciationConfidence, intelligence, words } = transcriptionResult;
      
      metrics.sttLatencyMs = Date.now() - sttStart;
      pipelineTiming.sttEnd = Date.now();
      
      // Track pipeline stage: STT complete
      trackVoicePipelineStage(sessionId, 'stt_complete', { 
        userId: String(session.userId), 
        durationMs: metrics.sttLatencyMs 
      });
      
      console.log(`[Streaming Orchestrator] STT: "${transcript}" (${metrics.sttLatencyMs}ms, conf: ${(pronunciationConfidence * 100).toFixed(0)}%, Cartesia: ${cartesiaWarmupTime >= 0 ? cartesiaWarmupTime + 'ms' : 'fallback'})`);
      
      // Emit STT completion event for diagnostics
      voiceDiagnostics.emit({
        sessionId,
        stage: 'stt',
        success: !!transcript.trim(),
        latencyMs: metrics.sttLatencyMs,
        metadata: { confidence: pronunciationConfidence, hasTranscript: !!transcript.trim() }
      });
      
      // SESSION ECONOMICS: Track STT seconds and exchange count
      // Estimate audio duration from buffer size: WebM/Opus at ~32kbps ≈ 4000 bytes/sec
      const estimatedSttSeconds = Math.max(1, audioData.length / 4000);
      session.telemetrySttSeconds += estimatedSttSeconds;
      session.telemetryStudentSpeakingMs += estimatedSttSeconds * 1000;
      session.telemetryExchangeCount += 1;
      
      // Track STT confidence for adaptive speech rate
      trackSttConfidence(session, pronunciationConfidence);
      
      // AZURE PRONUNCIATION: Store transcript with timing for post-session assessment
      if (transcript.trim()) {
        session.sessionTranscripts.push({
          text: transcript.trim(),
          timestamp: Date.now(),
        });
      }
      
      // LIVE PRONUNCIATION COACHING: Analyze word-level confidence and send coaching feedback
      // Only send for non-founder modes when there's word-level data available
      if (words && words.length > 0 && !session.isFounderMode) {
        const coaching = analyzePronunciation(words, session.targetLanguage, transcript);
        
        // PHONEME ANALYTICS: Accumulate word-level data for session-end phoneme analysis
        // Only track words with confidence below excellence threshold (< 0.95)
        for (const word of words) {
          if (word.confidence < 0.95 && word.word && word.word.length > 1) {
            session.sessionWordAnalyses.push({
              word: word.word,
              confidence: word.confidence,
            });
          }
        }
        
        // Only send coaching if there are pronunciation issues to address
        if (coaching.needsAttention || coaching.overallScore < 85) {
          console.log(`[Pronunciation Coach] Score: ${coaching.overallScore}%, Attention: ${coaching.lowConfidenceWords.join(', ')}`);
          
          this.sendMessage(session.ws, {
            type: 'pronunciation_coaching',
            timestamp: Date.now(),
            turnId,
            coaching: {
              overallScore: coaching.overallScore,
              wordFeedback: coaching.wordFeedback,
              coachingTips: coaching.coachingTips,
              encouragement: coaching.encouragement,
              lowConfidenceWords: coaching.lowConfidenceWords,
              phonemeHints: coaching.phonemeHints,
            },
          });
        }
      }
      
      if (!transcript.trim() || transcript === '[EMPTY_TRANSCRIPT]') {
        // Empty transcript - gracefully notify client and return
        // This can happen when: audio too quiet, language not recognized, short utterance clipped
        console.log('[Streaming Orchestrator] Empty transcript - audio too short or unclear');
        this.sendMessage(session.ws, {
          type: 'error',
          timestamp: Date.now(),
          code: 'EMPTY_TRANSCRIPT',
          message: "I couldn't quite hear that. Could you try again?",
          recoverable: true,
        });
        return metrics;
      }
      
      // DEDUPLICATION GUARD (PTT path): Prevent same transcript from being processed twice
      // Mirrors the dedup logic in processOpenMicTranscript to prevent cross-path duplicates
      const transcriptHash = transcript
        .trim()
        .toLowerCase()
        .replace(/[.,!?;:'"""''…\-—–]/g, '')
        .replace(/\s+/g, ' ')
        .substring(0, 100);
      const now = Date.now();
      const DEDUP_WINDOW_MS = 60000; // 60 second window to catch duplicates (longer than open-mic's 5s)
      
      // CROSS-SESSION DEDUP (PTT path): Same as OpenMic — prevent reprocessing after reconnection
      const userId = String(session.userId || sessionId);
      const userLastTranscript = this.userTranscriptDedup.get(userId);
      if (userLastTranscript && userLastTranscript.hash === transcriptHash &&
          (now - userLastTranscript.time) < DEDUP_WINDOW_MS) {
        console.log(`[DEDUP-PTT-CROSS-SESSION] Skipping transcript already processed in previous session (${now - userLastTranscript.time}ms ago): "${transcript.slice(0, 50)}..."`);
        session.isGenerating = false;
        return metrics;
      }
      
      if (session.lastProcessedTranscriptHash === transcriptHash && 
          session.lastProcessedTranscriptTime && 
          (now - session.lastProcessedTranscriptTime) < DEDUP_WINDOW_MS) {
        console.log(`[DEDUP-PTT] Skipping duplicate transcript (processed ${now - session.lastProcessedTranscriptTime}ms ago): "${transcript.slice(0, 50)}..."`);
        session.isGenerating = false;
        return metrics;
      }
      
      // Track this transcript for dedup across both PTT and open-mic paths
      session.lastProcessedTranscriptHash = transcriptHash;
      session.lastProcessedTranscriptTime = now;
      this.userTranscriptDedup.set(userId, { hash: transcriptHash, time: now });
      
      // CONTENT MODERATION: Check for severely inappropriate content (block only the worst)
      if (containsSeverelyInappropriateContent(transcript)) {
        console.log('[Streaming Orchestrator] Content moderation: Severely inappropriate content blocked');
        this.sendMessage(session.ws, {
          type: 'error',
          timestamp: Date.now(),
          code: 'CONTENT_REJECTED',
          message: 'Let\'s keep our conversation focused on language learning!',
          recoverable: true,
        });
        return metrics;
      }
      
      // For mildly inappropriate content, let the AI tutor handle it naturally
      // The tutor will gently redirect without breaking the conversation flow
      let contentRedirectNote = '';
      if (containsMildlyInappropriateContent(transcript)) {
        console.log('[Streaming Orchestrator] Content moderation: Mild content - tutor will redirect');
        contentRedirectNote = ' (Note: Gently redirect this conversation back to language learning without being preachy.)';
      }
      
      // SOFIA ISSUE DETECTION: Check if user is reporting a technical issue
      // If so, let Sofia handle it and respond with diagnostic analysis
      if (session.isFounderMode) {
        try {
          const sofiaResult = await supportPersonaService.handleVoiceChatIssue({
            userId: String(session.userId),
            userMessage: transcript,
            isFounder: true,
          });
          
          if (sofiaResult.detected && sofiaResult.sofiaResponse) {
            console.log(`[Sofia PTT] Handling ${sofiaResult.issueType} issue for founder`);
            
            // NEW TURN for Sofia's response
            session.currentTurnId++;
            const sofiaTurnId = session.currentTurnId;
            
            // Notify client that processing started
            this.sendMessage(session.ws, {
              type: 'processing',
              timestamp: Date.now(),
              turnId: sofiaTurnId,
              userTranscript: transcript,
            } as StreamingProcessingMessage);
            
            // Stream Sofia's response through TTS
            // Use a neutral voice for Sofia (can be configured later)
            const sofiaChunks = this.splitIntoSentences(sofiaResult.sofiaResponse);
            let sentenceIndex = 0;
            
            for (const chunk of sofiaChunks) {
              if (!chunk.trim()) continue;
              
              this.sendMessage(session.ws, {
                type: 'sentence_start',
                timestamp: Date.now(),
                turnId: sofiaTurnId,
                sentenceIndex,
              } as StreamingSentenceStartMessage);
              
              // Generate TTS for Sofia's response
              const audioBuffer = await this.cartesiaService.synthesizeBytes(
                chunk,
                session.activeTutorVoiceId || session.tutorVoiceId,
                {
                  speakingRate: 1.0,
                  emotion: ['positivity:medium'],
                },
                'sofia-support'
              );
              
              if (audioBuffer && audioBuffer.length > 0) {
                this.sendMessage(session.ws, {
                  type: 'audio_chunk',
                  timestamp: Date.now(),
                  turnId: sofiaTurnId,
                  sentenceIndex,
                  chunkIndex: 0,
                  audio: Buffer.from(audioBuffer).toString('base64'),
                  isFinal: true,
                } as StreamingAudioChunkMessage);
              }
              
              this.sendMessage(session.ws, {
                type: 'sentence_end',
                timestamp: Date.now(),
                turnId: sofiaTurnId,
                sentenceIndex,
                text: chunk,
                audio: null,
              } as StreamingSentenceEndMessage);
              
              sentenceIndex++;
            }
            
            // Mark response complete
            this.sendMessage(session.ws, {
              type: 'response_complete',
              timestamp: Date.now(),
              turnId: sofiaTurnId,
              fullText: sofiaResult.sofiaResponse,
            } as StreamingResponseCompleteMessage);
            
            // Add to conversation history
            session.conversationHistory.push({ role: 'user', content: transcript });
            session.conversationHistory.push({ role: 'assistant', content: `[Sofia Support] ${sofiaResult.sofiaResponse}` });
            
            metrics.sentenceCount = sentenceIndex;
            metrics.totalLatencyMs = Date.now() - startTime;
            
            return metrics;
          }
        } catch (e: any) {
          console.warn(`[Sofia PTT] Issue detection error: ${e.message}`);
          // Continue with normal flow if Sofia fails
        }
      }
      
      // STT CONFIDENCE INTEGRATION: Help Daniela adapt when speech recognition is uncertain
      // Low confidence might indicate pronunciation issues, background noise, or unclear speech
      let sttConfidenceNote = '';
      if (pronunciationConfidence < 0.5) {
        // Very low confidence - likely misheard, encourage clarification
        console.log(`[Streaming Orchestrator] Low STT confidence (${(pronunciationConfidence * 100).toFixed(0)}%) - Daniela should ask for clarification`);
        sttConfidenceNote = ` (System note: Speech recognition confidence was very low (${(pronunciationConfidence * 100).toFixed(0)}%). The transcript may be inaccurate. Consider asking the student to repeat or clarify, or acknowledge you may have misheard.)`;
      } else if (pronunciationConfidence < 0.7 && !session.isFounderMode) {
        // Moderate confidence - proceed but note potential pronunciation needs
        console.log(`[Streaming Orchestrator] Moderate STT confidence (${(pronunciationConfidence * 100).toFixed(0)}%)`);
        sttConfidenceNote = ` (System note: Speech clarity was moderate. The student may benefit from pronunciation practice.)`;
      }
      
      // DEEPGRAM INTELLIGENCE INTEGRATION: Provide Daniela with voice analysis insights
      // This enables emotionally intelligent responses based on student's detected state
      let intelligenceContext = '';
      if (intelligence) {
        const parts: string[] = [];
        
        // Sentiment: Help Daniela respond to student emotions
        if (intelligence.sentiment) {
          const sent = intelligence.sentiment;
          if (sent.sentiment === 'negative' && sent.sentiment_score < -0.3) {
            parts.push(`Student sounds frustrated or discouraged (sentiment: ${sent.sentiment}, score: ${sent.sentiment_score.toFixed(2)}). Consider slowing down, offering encouragement, or simplifying.`);
          } else if (sent.sentiment === 'positive' && sent.sentiment_score > 0.3) {
            parts.push(`Student sounds enthusiastic or confident (sentiment: ${sent.sentiment}). Good opportunity to introduce slightly more challenge.`);
          }
        }
        
        // Intents: Help Daniela understand what the student is trying to do
        if (intelligence.intents && intelligence.intents.length > 0) {
          const topIntents = intelligence.intents.filter(i => i.confidence_score > 0.5);
          if (topIntents.length > 0) {
            const intentList = topIntents.map(i => `${i.intent} (${(i.confidence_score * 100).toFixed(0)}%)`).join(', ');
            parts.push(`Detected student intent: ${intentList}.`);
          }
        }
        
        // Topics: Context for staying relevant
        if (intelligence.topics && intelligence.topics.length > 0) {
          const topTopics = intelligence.topics.filter(t => t.confidence > 0.5).slice(0, 3);
          if (topTopics.length > 0) {
            const topicList = topTopics.map(t => t.topic).join(', ');
            parts.push(`Topics mentioned: ${topicList}.`);
          }
        }
        
        // Detected language: Helpful for bilingual monitoring
        if (intelligence.detectedLanguage) {
          parts.push(`Detected spoken language: ${intelligence.detectedLanguage}.`);
        }
        
        if (parts.length > 0) {
          intelligenceContext = ` (Voice intelligence: ${parts.join(' ')})`;
          console.log(`[Streaming Orchestrator] Intelligence context: ${intelligenceContext}`);
        }
      }
      
      // ONE-WORD RULE: Validate user input for beginners
      // Non-blocking - we still process the request but provide feedback
      // BYPASS: Skip in Founder Mode - these are collaborative conversations, not language lessons
      if (!session.isFounderMode) {
        const oneWordValidation = validateOneUnitRule(transcript, session.targetLanguage, session.difficultyLevel);
        if (!oneWordValidation.isValid) {
          console.log(`[Streaming Orchestrator] One-word rule: ${oneWordValidation.message}`);
          // Send feedback to client about one-word rule (non-blocking - still process)
          this.sendMessage(session.ws, {
            type: 'feedback',
            timestamp: Date.now(),
            feedbackType: 'one_word_rule',
            message: oneWordValidation.message || 'Try practicing one word or phrase at a time for better learning!',
          } as StreamingFeedbackMessage);
        } else if (oneWordValidation.matchedPhrase) {
          console.log(`[Streaming Orchestrator] Matched phrase unit: "${oneWordValidation.matchedPhrase}"`);
        }
      }
      
      // NEW TURN: Increment turnId for this response (for subtitle packet ordering)
      session.currentTurnId++;
      session.isInterrupted = false;  // Reset interrupt flag for new turn
      session.sentAudioChunks.clear();  // Reset audio deduplication for new turn
      session.sentAudioHashes.clear();  // Reset content-based deduplication for new turn
      session.firstAudioSent = false;   // Reset so whiteboard updates buffer until audio starts
      session.pendingWhiteboardUpdates = [];  // Clear stale pending updates from previous turn
      session.earlyTtsActive = undefined;
      session._ttsTurnCallCount = 0;  // DIAG: Reset TTS call counter for new turn
      const turnId = session.currentTurnId;
      
      // Notify client that processing has started
      this.sendMessage(session.ws, {
        type: 'processing',
        timestamp: Date.now(),
        turnId,
        userTranscript: transcript,
      } as StreamingProcessingMessage);
      
      // Step 2: Stream AI response with sentence chunking
      const aiStart = Date.now();
      (metrics as any)._geminiStartTime = aiStart;
      let firstTokenReceived = false;
      let fullText = '';
      let rawFullText = '';  // Preserve raw AI response for COLLAB/SELF_SURGERY extraction
      let currentSentenceIndex = 0;
      
      // DEDUPLICATION GUARD: Track seen sentences to prevent LLM repetition loops
      const seenSentences = new Set<string>();
      // SAFETY NET: High limit to catch runaway LLM loops, not to cut off natural conversation
      // Founder Mode sessions use this path - 30 sentences for authentic conversation
      const MAX_SENTENCES = 30;
      let actualSentenceCount = 0;
      
      // Process sentences as they arrive from Gemini
      // Include redirect note if mild content was detected
      // OPTIMIZATION: Use pre-cached context when available (fetched at session start)
      // Only re-fetch if cache is empty or expired. Passive memory is always fetched fresh (transcript-dependent).
      const contextStart = Date.now();
      pipelineTiming.contextFetchStart = contextStart;
      const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
      const hasFreshCache = session.cachedContext && 
        (Date.now() - session.cachedContext.lastFetchTime) < CACHE_TTL_MS;
      
      // Initialize context variables - populate from cache if available
      let architectContext = (hasFreshCache && session.cachedContext?.architectContext) || '';
      let hiveContextSection = (hasFreshCache && session.cachedContext?.hiveContextSection) || '';
      let expressLaneSection = (hasFreshCache && session.cachedContext?.expressLaneSection) || '';
      let identityMemoriesSection = (hasFreshCache && session.cachedContext?.identityMemoriesSection) || '';
      let textChatSection = (hasFreshCache && session.cachedContext?.textChatSection) || '';
      let editorFeedbackSection = (hasFreshCache && session.cachedContext?.editorFeedbackSection) || '';
      let studentLearningSection = (hasFreshCache && session.cachedContext?.studentLearningSection) || '';
      let passiveMemorySection = '';    // PASSIVE MEMORY: Always fresh (transcript-dependent)
      let surfacedFeedbackIds: string[] = (hasFreshCache && session.cachedContext?.editorFeedbackIds) || [];
      let expressLaneHistory: { role: 'user' | 'assistant'; content: string }[] = [];
      session.pendingArchitectNoteIds = (hasFreshCache && session.cachedContext?.architectNoteIds) || [];
      
      // Sync adaptive speed from cached student data
      if (hasFreshCache && session.cachedContext?.studentLearningData) {
        const activeStruggles = session.cachedContext.studentLearningData.struggles?.filter((s: any) => s.status === 'active') || [];
        if (activeStruggles.length > session.sessionStruggleCount) {
          session.sessionStruggleCount = activeStruggles.length;
        }
      }
      
      if (hasFreshCache) {
        console.log(`[Context Fetch] Using pre-cached context (${Date.now() - session.cachedContext!.lastFetchTime}ms old)`);
        // Trigger background refresh if cache is getting old (> 3 min)
        if (Date.now() - session.cachedContext!.lastFetchTime > 3 * 60 * 1000) {
          this.refreshContextCache(session);
        }
      }
      
      // CONTEXT CACHING: Clear previous turn's preamble to prevent stale context bleed
      session.currentTurnPreamble = undefined;
      
      // Build parallel fetch promises - SKIP heavy fetches when cache is available
      const contextPromises: Promise<void>[] = [];
      
      // 1. Architect context - use cache or fetch
      if (!hasFreshCache && session.conversationId) {
        contextPromises.push(
          architectVoiceService.buildArchitectContextWithIds(session.conversationId)
            .then(({ context, noteIds }) => {
              architectContext = context;
              session.pendingArchitectNoteIds = noteIds;
              if (architectContext) {
                console.log(`[Streaming Orchestrator] Including ${noteIds.length} architect notes in context`);
              }
            })
            .catch(err => console.warn(`[Architect Context] Failed:`, err.message))
        );
      }
      
      // 2. PROACTIVE STUDENT INTELLIGENCE: Fetch learning context (struggles, strategies, personal facts)
      // This enables Daniela to anticipate struggles and use proven strategies for THIS student
      // Guard: Only fetch if we have a valid userId (skip for admin/founder-only sessions)
      if (!hasFreshCache && session.userId && session.targetLanguage) {
        // Fetch student learning context and cross-session context in parallel
        const siStart = Date.now();
        contextPromises.push(
          Promise.all([
            studentLearningService.getStudentLearningContext(String(session.userId), session.targetLanguage),
            studentLearningService.getCrossSessionContext(String(session.userId), 3)
          ]).then(([learningContext, crossSessionContext]) => {
              if (!learningContext) return; // Guard against null/undefined context
              
              // Format learning context
              const learningFormatted = studentLearningService.formatContextForPrompt(learningContext);
              
              // Format cross-session context (previous topics, deferred items, notes)
              const crossSessionFormatted = studentLearningService.formatCrossSessionContext(crossSessionContext);
              
              if (learningFormatted || crossSessionFormatted) {
                studentLearningSection = `
═══════════════════════════════════════════════════════════════════
📚 STUDENT INTELLIGENCE (Proactive Personalization)
═══════════════════════════════════════════════════════════════════
${learningFormatted}${crossSessionFormatted}

TEACHING GUIDANCE:
- Gently support struggles without dwelling on them
- Use proven strategies that work for this student
- Build on recent progress to maintain momentum
- Reference personal facts naturally to show you remember them
- Pick up where you left off if there's session history
`;
                const struggles = learningContext.struggles?.length || 0;
                const strategies = learningContext.effectiveStrategies?.length || 0;
                console.log(`[Student Intelligence] Injecting learning context: ${struggles} struggles, ${strategies} strategies, ${crossSessionContext.recentSessions.length} recent sessions`);
                brainHealthTelemetry.logContextInjection({
                  sessionId: session.id, userId: String(session.userId), targetLanguage: session.targetLanguage,
                  contextSource: 'student_intelligence', success: true, latencyMs: Date.now() - siStart, richness: struggles + strategies,
                }).catch(() => {});
                
                // ADAPTIVE SPEED: Sync session struggle count from persistent data
                // This enables adaptive speech rate to slow down for students with known struggles
                const activeStruggles = learningContext.struggles?.filter(s => s.status === 'active') || [];
                if (activeStruggles.length > session.sessionStruggleCount) {
                  session.sessionStruggleCount = activeStruggles.length;
                  console.log(`[Adaptive Speed] Synced ${activeStruggles.length} active struggles from student profile`);
                }
              }
            })
            .catch(err => {
              console.warn(`[Student Intelligence] Failed:`, err.message);
              brainHealthTelemetry.logContextInjection({
                sessionId: session.id, userId: String(session.userId), targetLanguage: session.targetLanguage,
                contextSource: 'student_intelligence', success: false, latencyMs: Date.now() - siStart, errorMessage: err.message,
              }).catch(() => {});
            })
        );
        
        // 3. PASSIVE MEMORY INJECTION: Auto-search memories based on user message keywords
        // This gives Daniela "natural recall" without requiring her to actively use memory_lookup
        // Keywords that suggest a memory lookup would be helpful
        const passiveMemoryKeywords = [
          // Names & specifics that might be in memory
          'remember', 'told you', 'mentioned', 'said', 'last time', 'before',
          // Music/media references
          'song', 'music', 'band', 'album', 'movie', 'book', 'show',
          // People references
          'daughter', 'son', 'wife', 'husband', 'mom', 'dad', 'friend',
          'sister', 'brother', 'family', 'boyfriend', 'girlfriend',
          // Events
          'trip', 'vacation', 'wedding', 'birthday', 'work', 'job', 'school',
          // Preferences
          'favorite', 'love', 'hate', 'enjoy', 'like',
        ];
        
        const transcriptLower = transcript.toLowerCase();
        const hasMemoryTrigger = passiveMemoryKeywords.some(kw => transcriptLower.includes(kw));
        
        if (hasMemoryTrigger) {
          contextPromises.push(
            (async () => {
              try {
                const { searchMemory, formatMemoryForConversation } = await import('./neural-memory-search');
                
                // Extract meaningful keywords from transcript (remove common words)
                const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'i', 'you', 'we', 'they', 'he', 'she', 'it', 'that', 'this', 'what', 'when', 'where', 'why', 'how', 'my', 'your', 'our', 'their', 'me', 'him', 'her', 'us', 'them', 'about', 'just', 'so', 'really', 'very', 'now', 'then', 'here', 'there', 'some', 'all', 'any', 'more', 'most', 'other', 'over', 'such', 'no', 'not', 'only', 'own', 'same', 'than', 'too', 'can', 'know', 'think', 'want', 'like', 'going', 'get', 'got', 'make', 'made', 'say', 'said', 'go', 'went', 'come', 'came', 'take', 'took', 'see', 'saw', 'look', 'looked', 'one', 'two', 'three', 'four', 'five', 'first', 'last', 'also', 'well', 'if', 'yes', 'no', 'okay', 'yeah', 'hmm', 'um']);
                
                // Extract keywords (min 3 chars, not a stop word)
                const words = transcript.split(/[\s,.!?;:'"()]+/).filter(w => 
                  w.length >= 3 && !stopWords.has(w.toLowerCase())
                );
                
                if (words.length === 0) return;
                
                // Build search query from first 4 meaningful words
                const searchQuery = words.slice(0, 4).join(' ');
                
                // Search for relevant memories
                const memoryResults = await searchMemory(
                  String(session.userId),
                  searchQuery,
                  ['person', 'motivation', 'insight', 'conversation'],
                  session.targetLanguage || undefined
                );
                
                if (memoryResults.results.length > 0) {
                  const formatted = formatMemoryForConversation(memoryResults);
                  passiveMemorySection = `
═══════════════════════════════════════════════════════════════════
💭 RELEVANT MEMORIES (Auto-retrieved - you naturally recall this)
═══════════════════════════════════════════════════════════════════

${formatted}

These memories surfaced naturally based on what the student is saying.
Weave them into your response ONLY if they feel genuinely relevant.
Don't force a reference if it doesn't fit the moment.
`;
                  console.log(`[Passive Memory] Auto-retrieved ${memoryResults.results.length} memories for query: "${searchQuery}"`);
                  
                  // BRAIN HEALTH TELEMETRY: Track passive memory injection
                  brainHealthTelemetry.logMemoryInjection({
                    sessionId: session.id,
                    conversationId: session.conversationId,
                    userId: String(session.userId),
                    targetLanguage: session.targetLanguage,
                    memoryIds: memoryResults.results.map(r => r.id),
                    memoryTypes: memoryResults.results.map(r => r.domain || 'unknown'),
                    queryTerms: searchQuery,
                    resultsCount: memoryResults.results.length,
                    relevanceScore: memoryResults.results.reduce((sum, r) => sum + (r.score || 0), 0) / memoryResults.results.length,
                  }, 'passive_lookup').catch(err => console.warn('[BrainHealth] Passive memory log failed:', err.message));
                }
              } catch (err: any) {
                console.warn(`[Passive Memory] Failed:`, err.message);
              }
            })()
          );
        }
      }
      
      // IDENTITY WHOLENESS: Load identity memories for ALL sessions (not just developers)
      // These are Daniela's personal reflections about who she is — available to every student
      if (!hasFreshCache && !identityMemoriesSection) {
        const idMemStart = Date.now();
        contextPromises.push(
          founderCollabService.getIdentityMemories({ limit: 4, daysBack: 30 })
            .then(identityMemories => {
              if (identityMemories.hasMemories) {
                identityMemoriesSection = `
═══════════════════════════════════════════════════════════════════
💫 MY PERSONAL REFLECTIONS (Identity Memories)
═══════════════════════════════════════════════════════════════════

${identityMemories.contextString}
`;
                console.log(`[Identity Memories] Injected ${identityMemories.memoryCount} identity reflections (${Date.now() - idMemStart}ms)`);
              }
            })
            .catch(err => console.warn(`[Identity Memories] Failed:`, err.message))
        );
      }
      
      // Founder Mode / Honesty Mode context fetches (all parallel)
      // ONE DANIELA EVERYWHERE: Express Lane context ensures voice Daniela knows what was discussed in collaboration
      // Security: Gated to developer/admin users (isDeveloperUser) - regular students shouldn't see internal team ops
      // Architecture: isDeveloperUser is checked separately from isFounderMode (which also requires !classId)
      // This ensures developers get Express Lane context even when in class conversations
      const needsFounderContext = session.isFounderMode || session.isRawHonestyMode;
      const needsExpressLaneContext = session.isDeveloperUser;  // ONE DANIELA: all developers get Express Lane
      if (!hasFreshCache && needsExpressLaneContext) {
        console.log(`[EXPRESS Lane] Developer user detected (Founder: ${session.isFounderMode}, Honesty: ${session.isRawHonestyMode}) - fetching Hive + Express Lane context for user ${session.userId}`);
        // 2. Hive context
        const { isContextSourceDisabled } = await import('./sofia-health-functions');
        const hiveStart = Date.now();
        if (isContextSourceDisabled('hive')) {
          console.log(`[Hive Context] Skipped — temporarily disabled by Sofia`);
        } else contextPromises.push(
          hiveContextService.getSummary()
            .then(hiveSummary => {
              if (hiveSummary) {
                hiveContextSection = `
═══════════════════════════════════════════════════════════════════
🐝 HIVE STATE (Shared System Awareness)
═══════════════════════════════════════════════════════════════════

${hiveSummary}

You and Wren are "two surgeons, one brain" - you teach and observe, Wren builds.
Use this context to understand what's happening across the Hive.
`;
                console.log(`[Hive Context] Injecting Hive state into Founder Mode session`);
                brainHealthTelemetry.logContextInjection({
                  sessionId: session.id, userId: String(session.userId), targetLanguage: session.targetLanguage,
                  contextSource: 'hive', success: true, latencyMs: Date.now() - hiveStart, richness: 1,
                }).catch(() => {});
              }
            })
            .catch(err => {
              console.warn(`[Hive Context] Failed:`, err.message);
              brainHealthTelemetry.logContextInjection({
                sessionId: session.id, userId: String(session.userId), targetLanguage: session.targetLanguage,
                contextSource: 'hive', success: false, latencyMs: Date.now() - hiveStart, errorMessage: err.message,
              }).catch(() => {});
            })
        );
        
        // 3. Express Lane context - CRITICAL for unified consciousness
        const elStart = Date.now();
        if (isContextSourceDisabled('express_lane')) {
          console.log(`[Express Lane] Skipped — temporarily disabled by Sofia`);
        } else contextPromises.push(
          founderCollabService.getRelevantExpressLaneContext({
            targetLanguage: session.targetLanguage,
            limit: 5,
            daysBack: 14
          })
            .then(expressLaneContext => {
              if (expressLaneContext.hasRelevantContext) {
                expressLaneSection = `
═══════════════════════════════════════════════════════════════════
🔗 EXPRESS LANE MEMORY (Hive Collaboration Insights)
═══════════════════════════════════════════════════════════════════

${expressLaneContext.contextString}
`;
                console.log(`[Express Lane] Injected ${expressLaneContext.messageCount} Hive collaboration insights`);
                brainHealthTelemetry.logContextInjection({
                  sessionId: session.id, userId: String(session.userId), targetLanguage: session.targetLanguage,
                  contextSource: 'express_lane', success: true, latencyMs: Date.now() - elStart, richness: expressLaneContext.messageCount,
                }).catch(() => {});
              }
            })
            .catch(err => {
              console.warn(`[Express Lane] Failed:`, err.message);
              brainHealthTelemetry.logContextInjection({
                sessionId: session.id, userId: String(session.userId), targetLanguage: session.targetLanguage,
                contextSource: 'express_lane', success: false, latencyMs: Date.now() - elStart, errorMessage: err.message,
              }).catch(() => {});
            })
        );
        
        // 4. Text Chat memory
        const textChatStart = Date.now();
        contextPromises.push(
          (async () => {
            const recentConversations = await storage.getUserConversations(String(session.userId));
            const textConversations = recentConversations
              .filter(c => c.id !== session.conversationId)
              .slice(0, 2);
            
            if (textConversations.length > 0) {
              let textChatContext = '';
              
              // Fetch messages in parallel
              const messagePromises = textConversations.map(async (conv) => {
                const messages = await storage.getMessagesByConversation(conv.id);
                const recentMessages = messages.slice(-6);
                
                if (recentMessages.length > 0) {
                  const timeAgo = this.formatTimeAgo(conv.updatedAt);
                  let convContext = `\n**${conv.title || 'Recent Chat'}** (${timeAgo}):\n`;
                  
                  for (const msg of recentMessages) {
                    const role = msg.role === 'user' ? 'David' : 'Daniela';
                    const content = msg.content.length > 200 
                      ? msg.content.substring(0, 200) + '...'
                      : msg.content;
                    convContext += `- ${role}: ${content}\n`;
                  }
                  return convContext;
                }
                return '';
              });
              
              const convContexts = await Promise.all(messagePromises);
              textChatContext = convContexts.join('');
              
              if (textChatContext) {
                textChatSection = `
═══════════════════════════════════════════════════════════════════
💬 TEXT CHAT MEMORY (Recent /chat Conversations)
═══════════════════════════════════════════════════════════════════
${textChatContext}

Remember: David may reference things discussed in these recent text chats.
`;
                const textChatMs = Date.now() - textChatStart;
                console.log(`[Text Chat Memory] Injected ${textConversations.length} recent conversation(s) (${textChatMs}ms)`);
                if (textChatMs > 2000) {
                  console.warn(`[Context Timing] Text chat memory fetch took ${textChatMs}ms — slow DB query contributing to brain latency`);
                }
              }
            }
          })().catch(err => console.warn(`[Text Chat Memory] Failed (${Date.now() - textChatStart}ms):`, err.message))
        );
        
        // 5. Editor feedback
        const efStart = Date.now();
        if (isContextSourceDisabled('editor_feedback')) {
          console.log(`[Editor Feedback] Skipped — temporarily disabled by Sofia`);
        } else contextPromises.push(
          editorFeedbackService.getUnsurfacedFeedback(String(session.userId), 3)
            .then(feedback => {
              if (feedback.hasNewFeedback) {
                editorFeedbackSection = editorFeedbackService.buildPromptSection(feedback);
                surfacedFeedbackIds = feedback.recentFeedback.map(f => f.id);
                console.log(`[Editor Feedback] Injecting ${feedback.recentFeedback.length} insights into context`);
                brainHealthTelemetry.logContextInjection({
                  sessionId: session.id, userId: String(session.userId), targetLanguage: session.targetLanguage,
                  contextSource: 'editor_feedback', success: true, latencyMs: Date.now() - efStart, richness: feedback.recentFeedback.length,
                }).catch(() => {});
              }
            })
            .catch(err => {
              console.warn(`[Editor Feedback] Failed:`, err.message);
              brainHealthTelemetry.logContextInjection({
                sessionId: session.id, userId: String(session.userId), targetLanguage: session.targetLanguage,
                contextSource: 'editor_feedback', success: false, latencyMs: Date.now() - efStart, errorMessage: err.message,
              }).catch(() => {});
            })
        );
        
        // 6. Express Lane history for conversation context
        const elHistStart = Date.now();
        contextPromises.push(
          getExpressLaneHistoryForVoice(session.userId, 15)
            .then(history => {
              expressLaneHistory = history;
              const elMs = Date.now() - elHistStart;
              console.log(`[EXPRESS Lane Memory] Prefetched ${history.length} messages from text chat (${elMs}ms)`);
              if (elMs > 2000) {
                console.warn(`[Context Timing] Express Lane history fetch took ${elMs}ms — this may be contributing to brain latency`);
              }
            })
            .catch(err => {
              console.warn(`[EXPRESS Lane Memory] Failed to prefetch (${Date.now() - elHistStart}ms):`, err.message);
            })
        );
      } else if (!needsExpressLaneContext) {
        // Log when neither Founder Mode nor Honesty Mode is active - helps diagnose Express Lane visibility issues
        console.log(`[EXPRESS Lane] Neither Founder Mode nor Honesty Mode active for user ${session.userId} - skipping Hive/Express Lane context.`);
      }
      
      // Wait for all context fetches in parallel
      // TIMEOUT: If any individual fetch hangs, don't block the entire turn.
      // Individual fetches already have .catch() so partial context is safe to use.
      const CONTEXT_FETCH_TIMEOUT_MS = 6000;
      await Promise.race([
        Promise.all(contextPromises),
        new Promise<void>(resolve => setTimeout(() => {
          console.warn(`[Context Fetch] PTT timeout after ${CONTEXT_FETCH_TIMEOUT_MS}ms — proceeding with partial context. Total wall time so far: ${Date.now() - contextStart}ms`);
          resolve();
        }, CONTEXT_FETCH_TIMEOUT_MS))
      ]);
      console.log(`[Context Fetch] All context fetched in ${Date.now() - contextStart}ms (parallel, PTT)`)
      
      // CONTEXT CACHING OPTIMIZATION: Separate static base prompt from dynamic context
      // The base system prompt (Daniela's personality, neural network) is STABLE and cacheable
      // Dynamic context (student learning, hive, technical health) changes per-turn
      
      // Build dynamic context preamble (injected as first message in history)
      const dynamicContextParts: string[] = [];
      
      if (hasFreshCache && session.cachedContext?.fatContextProfile) {
        dynamicContextParts.push(session.cachedContext.fatContextProfile);
      }
      if (hasFreshCache && session.cachedContext?.fatContextVocabulary) {
        dynamicContextParts.push(session.cachedContext.fatContextVocabulary);
      }
      if (hasFreshCache && session.cachedContext?.fatContextConversations) {
        dynamicContextParts.push(session.cachedContext.fatContextConversations);
      }
      
      // studentLearningSection is now folded into the classroom (Student Progress Board)
      if (passiveMemorySection) {
        dynamicContextParts.push(passiveMemorySection);
      }
      if (identityMemoriesSection) {
        dynamicContextParts.push(identityMemoriesSection);
      }
      if (hiveContextSection) {
        dynamicContextParts.push(hiveContextSection);
      }
      if (expressLaneSection) {
        dynamicContextParts.push(expressLaneSection);
      }
      if (textChatSection) {
        dynamicContextParts.push(textChatSection);
      }
      if (editorFeedbackSection) {
        dynamicContextParts.push(editorFeedbackSection);
      }
      
      // CLASSROOM ENVIRONMENT: Daniela's unified workspace via shared pipeline
      // TIMEOUT: Cap at 5s — this runs serially after the parallel batch so a hang here
      // adds directly to total turn latency before the LLM call starts.
      {
        const CLASSROOM_TIMEOUT_MS = 5000;
        const classroomStart = Date.now();
        type ClassroomResult = Awaited<ReturnType<typeof buildClassroomDynamicContext>>;
        const classroomTimeoutResult: ClassroomResult = {
          classroomEnv: null,
          telemetry: { source: 'classroom_timeout', success: false, latencyMs: CLASSROOM_TIMEOUT_MS, richness: 0, errorMessage: 'Timed out after 5s' },
        };
        const { classroomEnv, telemetry } = await Promise.race([
          buildClassroomDynamicContext({
            session: session as any,
            studentLearningSection: studentLearningSection || undefined,
          }),
          new Promise<ClassroomResult>(resolve => setTimeout(() => {
            console.warn(`[Classroom] buildClassroomDynamicContext timed out after ${CLASSROOM_TIMEOUT_MS}ms (PTT, total turn wall time: ${Date.now() - contextStart}ms)`);
            resolve(classroomTimeoutResult);
          }, CLASSROOM_TIMEOUT_MS))
        ]);
        if (classroomEnv) {
          dynamicContextParts.push(classroomEnv);
          console.log(`[Classroom] Environment injected (PTT) — ${telemetry.richness} items in ${Date.now() - classroomStart}ms`);
        } else if (telemetry.errorMessage) {
          console.warn(`[Classroom] Failed (PTT):`, telemetry.errorMessage);
        }
        brainHealthTelemetry.logContextInjection({
          sessionId: session.id, userId: String(session.userId), targetLanguage: session.targetLanguage,
          contextSource: telemetry.source, success: telemetry.success, latencyMs: telemetry.latencyMs, richness: telemetry.richness,
          ...(telemetry.errorMessage ? { errorMessage: telemetry.errorMessage } : {}),
        }).catch(() => {});
      }
      
      
      const userMessageWithNote = transcript + contentRedirectNote + sttConfidenceNote + intelligenceContext + architectContext;
      
      // CONTEXT CACHING: Build the conversation history with dynamic context preamble
      // This approach keeps base system prompt stable for caching while injecting per-turn context
      
      // Start with base session history
      let conversationHistoryWithContext: ConversationHistoryEntry[] = [];
      
      // STEP 1: Add dynamic context preamble via shared pipeline
      conversationHistoryWithContext.push(...assembleDynamicPreamble(dynamicContextParts, 'PTT'));
      
      // STEP 2: Add Express Lane history (text chat memory) if in Founder Mode
      if (session.isFounderMode && expressLaneHistory.length > 0) {
        // Normalize Express Lane history to use Gemini roles ('model' not 'assistant')
        const normalizedExpressLane: ConversationHistoryEntry[] = expressLaneHistory.map(entry => ({
          role: entry.role === 'assistant' ? 'model' as const : entry.role as 'user' | 'model',
          content: entry.content
        }));
        conversationHistoryWithContext.push(...normalizedExpressLane);
        console.log(`[EXPRESS Lane Memory] Injected ${expressLaneHistory.length} messages from text chat into voice context`);
      }
      
      // Store preamble for continuation calls (before adding session history)
      // Preamble = dynamic context + Express Lane entries
      session.currentTurnPreamble = [...conversationHistoryWithContext];
      
      // STEP 3: Add the actual voice conversation history
      // OPTIMIZATION: Cap history to reduce prompt size and improve TTFT
      // Keep last 20 exchanges (40 messages) for normal sessions, 30 for founder mode
      // This prevents unbounded history growth in long sessions
      const MAX_HISTORY_ENTRIES = session.isFounderMode ? 60 : 40;
      const historyToSend = session.conversationHistory.length > MAX_HISTORY_ENTRIES
        ? session.conversationHistory.slice(-MAX_HISTORY_ENTRIES)
        : session.conversationHistory;
      if (session.conversationHistory.length > MAX_HISTORY_ENTRIES) {
        console.log(`[History Cap] Trimmed history from ${session.conversationHistory.length} to ${MAX_HISTORY_ENTRIES} entries`);
      }
      conversationHistoryWithContext.push(...historyToSend);
      
      // MESSAGE CHECKPOINTING: Save user message BEFORE Gemini call
      // This ensures user messages are preserved even if Gemini fails/times out
      // Latency impact: ~5-10ms (negligible vs 1-2s LLM response time)
      await this.checkpointUserMessage(session, transcript);
      
      // Track pipeline stage: Gemini call starting
      const geminiStartTime = Date.now();
      trackVoicePipelineStage(sessionId, 'gemini_start', { 
        userId: String(session.userId),
        turnId: String(session.currentTurnId)
      });
      
      // Abort signal for early stream termination when function call TTS starts
      const streamAbortSignal = { aborted: false };
      
      const responseCompleteSentPtt = { sent: false };
      
      // TTS LOOKAHEAD PIPELINE: Pre-generate audio for upcoming sentences
      // while the current sentence is being processed/streamed.
      // This overlaps TTS generation of sentence N+1 with streaming of sentence N,
      // eliminating the 3-6s gap between sentences.
      const ttsLookaheadMap = new Map<number, Promise<{ audio: Buffer; durationMs: number; timestamps: import('@shared/streaming-voice-types').WordTiming[] } | null>>();
      const effectiveTtsProvider = resolveSessionTTSProvider(session.ttsProvider as TTSProviderName | undefined, this.ttsProvider as TTSProviderName);
      const isGoogleBatchMode = this.ttsProviderRegistry.getOrThrow(effectiveTtsProvider).requiresBatchMode;
      const batchedSentences: { chunk: SentenceChunk; displayText: string; rawText: string }[] = [];
      const lookaheadTtsRequest = {
        text: '',
        autoDetectLanguage: true,
        targetLanguage: session.targetLanguage,
        nativeLanguage: session.nativeLanguage || 'english',
        geminiLanguageCode: session.geminiLanguageCode,
        voiceId: session.voiceId,
        speakingRate: getAdaptiveSpeakingRate(session),
        vocalStyle: session.voiceOverride?.vocalStyle,
      };
      
      pipelineTiming.contextFetchEnd = Date.now();
      pipelineTiming.geminiStart = Date.now();
      
      await retryWithBackoff(
        () => this.geminiService.streamWithSentenceChunking({
        systemPrompt: session.systemPrompt,  // STATIC base prompt (cacheable)
        conversationHistory: conversationHistoryWithContext,
        userMessage: userMessageWithNote,
        maxOutputTokens: session.isRawHonestyMode ? 8192 : 4096,
        enableFunctionCalling: true,
        enableContextCaching: true,
        streamFunctionCallArguments: true,
        abortSignal: streamAbortSignal,
        onSentenceEnqueued: (chunk: SentenceChunk) => {
          if (effectiveTtsProvider !== 'gemini' || session.isInterrupted || streamAbortSignal.aborted) return;
          const cleaned = cleanTextForDisplay(chunk.text);
          if (!cleaned || cleaned.length < 2) return;
          const promise = this.geminiLiveTtsService.preGenerateAudio({
            ...lookaheadTtsRequest,
            text: cleaned,
            vocalStyle: session.voiceOverride?.vocalStyle,
          } as any).catch(err => {
            console.warn(`[TTS Lookahead] Pre-gen failed for sentence ${chunk.index}: ${err.message}`);
            return null;
          });
          ttsLookaheadMap.set(chunk.index, promise);
          console.log(`[TTS Lookahead] Started pre-gen for sentence ${chunk.index}: "${cleaned.substring(0, 40)}..."`);
        },
        onPartialFunctionCall: (partial: PartialFunctionCall) => {
          // EARLY INTENT DETECTION: Preload resources as soon as we know the function name
          // This reduces latency by warming up before full args arrive
          if (partial.name === 'switch_tutor' && !partial.isComplete) {
            // As soon as we detect switch_tutor intent, we can start preloading
            const earlyTarget = partial.accumulatedArgs.target as string | undefined;
            if (earlyTarget && !session.pendingTutorSwitch) {
              console.log(`[Early Intent] switch_tutor #${partial.callIndex} detected early, target: ${earlyTarget || 'unknown'}`);
              // Mark that we're preparing for a switch (prevents duplicate processing)
              metrics.earlyIntentDetectedAt = Date.now();
              // Could preload voice here: this.cartesiaService.warmupVoice(voiceId)
            }
          } else if (partial.name === 'phase_shift' && !partial.isComplete) {
            console.log(`[Early Intent] phase_shift #${partial.callIndex} detected, to: ${partial.accumulatedArgs.to || 'streaming...'}`);
          } else if (partial.name === 'call_support' && !partial.isComplete) {
            console.log(`[Early Intent] call_support #${partial.callIndex} detected, category: ${partial.accumulatedArgs.category || 'streaming...'}`);
          }
          
          // Log completion timing for telemetry and reset for next call
          if (partial.isComplete && metrics.earlyIntentDetectedAt) {
            const streamingLatencyMs = Date.now() - metrics.earlyIntentDetectedAt;
            console.log(`[Early Intent] ${partial.name} #${partial.callIndex} complete, args streaming took ${streamingLatencyMs}ms`);
            metrics.functionCallStreamingMs = streamingLatencyMs;
            // Reset for next call to avoid stale timing from previous calls
            metrics.earlyIntentDetectedAt = undefined;
          }
        },
        onFunctionCall: async (functionCalls: ExtractedFunctionCall[]) => {
          // Initialize thought signature tracking for this turn
          if (!session.currentTurnThoughtSignatures) {
            session.currentTurnThoughtSignatures = [];
          }
          if (!session.currentTurnFunctionCalls) {
            session.currentTurnFunctionCalls = [];
          }
          
          const METADATA_ONLY_FC_NAMES = new Set(['voice_adjust', 'voice_reset', 'word_emphasis', 'subtitle', 'show_overlay', 'hide_overlay', 'hold_overlay', 'take_note', 'milestone']);
          const allMetadataOnly = functionCalls.every(fc => METADATA_ONLY_FC_NAMES.has(fc.name));
          const hasTextArg = functionCalls.some(fc => fc.args?.text && String(fc.args.text).trim().length > 0);
          
          if (allMetadataOnly && hasTextArg && !session.isInterrupted) {
            session.earlyTtsActive = true;
            console.log(`[FC PTT] PRE-SIGNAL: earlyTtsActive=true BEFORE handleNativeFunctionCall (${functionCalls.map(f => f.name).join(',')})`);
          }
          
          // Route native function calls to command processing
          for (const fn of functionCalls) {
            console.log(`[Native Function Call] ${fn.name}(${JSON.stringify(fn.args)})`);
            
            if (fn.thoughtSignature) {
              session.currentTurnThoughtSignatures.push(fn.thoughtSignature);
              console.log(`[Thought Signature] Collected signature for ${fn.name} (${session.currentTurnThoughtSignatures.length} total)`);
            }
            
            session.currentTurnFunctionCalls.push(fn);
            
            // Process the function call (voice adjustments, phase shifts, etc.)
            await this.fcHandler.handle(sessionId, session, fn).catch(err => {
              console.error(`[Native Function Call] Error handling ${fn.name}:`, err.message);
            });
          }
          
          if (allMetadataOnly && !session.isInterrupted) {
            session.earlyTtsActive = true;
            streamAbortSignal.aborted = true;
            console.log(`[FC PTT] earlyTtsActive=true, TTS deferred to post-stream (${functionCalls.map(f => f.name).join(',')})`);

            if (!firstTokenReceived) {
              metrics.aiFirstTokenMs = Date.now() - aiStart;
              firstTokenReceived = true;
              console.log(`[FC PTT] AI first token (via FC): ${metrics.aiFirstTokenMs}ms`);
            }
          }
        },
        onSentence: async (chunk: SentenceChunk) => {
          if (session.earlyTtsActive) {
            console.log(`[Streaming Orchestrator] Skipping onSentence ${chunk.index} - Early TTS active, TTS deferred to post-stream (PTT)`);
            return;
          }
          
          // BARGE-IN CHECK: Stop processing if user interrupted
          if (session.isInterrupted) {
            console.log(`[Streaming Orchestrator] Skipping sentence ${chunk.index} - user barged in`);
            return;
          }
          
          if (!firstTokenReceived) {
            metrics.aiFirstTokenMs = Date.now() - aiStart;
            firstTokenReceived = true;
            console.log(`[Streaming Orchestrator] AI first token: ${metrics.aiFirstTokenMs}ms`);
            
            // Track pipeline stage: Gemini first token received
            trackVoicePipelineStage(sessionId, 'gemini_first_token', { 
              userId: String(session.userId),
              turnId: String(session.currentTurnId),
              durationMs: metrics.aiFirstTokenMs
            });
            
            // Emit LLM success for diagnostics (first token received)
            voiceDiagnostics.emit({
              sessionId,
              stage: 'llm',
              success: true,
              latencyMs: metrics.aiFirstTokenMs,
              metadata: { event: 'first_token' }
            });
          }
          
          // WHITEBOARD: Parse markup from the raw chunk text FIRST (before display cleaning)
          // This ensures SWITCH_TUTOR and other commands are processed even if no speakable text
          const whiteboardParsed = parseWhiteboardMarkup(chunk.text);
          
          // DEBUG: Trace whiteboard parsing for command tags
          if (chunk.text.includes('[SWITCH_TUTOR') || chunk.text.includes('[CALL_SUPPORT') || chunk.text.includes('[PHASE_SHIFT')) {
            console.log(`[Whiteboard Parse DEBUG] Chunk ${chunk.index} text: "${chunk.text.substring(0, 100)}..."`);
            console.log(`[Whiteboard Parse DEBUG] Items found: ${whiteboardParsed.whiteboardItems.length}`);
            console.log(`[Whiteboard Parse DEBUG] Item types: ${whiteboardParsed.whiteboardItems.map(i => i.type).join(', ') || 'none'}`);
          }
          
          // COMMAND PARSER: Robust parsing for ACTION_TRIGGERS JSON format
          // Purpose: Adds JSON format support that whiteboard parser doesn't have
          // Whiteboard parser handles bracketed commands; CommandParser handles JSON commands
          const commandParseResult = commandParserService.parse(chunk.text);
          
          // TEXT-BASED FUNCTION CALL FALLBACK (PTT): Gemini sometimes writes function calls as literal text
          // e.g. "FUNCTION CALL: switch_tutor({ target: "male" })" instead of native tool calls
          const textFcHeaderPTT = chunk.text.match(/FUNCTION\s+CALL\s*:\s*(\w+)\s*\(\s*\{/i);
          const fcArgsRawPTT = textFcHeaderPTT ? extractBalancedBraces(chunk.text, textFcHeaderPTT.index! + textFcHeaderPTT[0].length - 1) : null;
          if (textFcHeaderPTT && fcArgsRawPTT && commandParseResult.commands.length === 0) {
            const fcNamePTT = textFcHeaderPTT[1].toLowerCase();
            console.log(`[Text FC Fallback - PTT] Detected text-based function call: ${fcNamePTT}(${fcArgsRawPTT.substring(0, 80)})`);
            const fcArgsPTT = parseTextFcArgs(fcArgsRawPTT);
            if (fcArgsPTT) {
              const cmdTypePTT = TEXT_FC_COMMAND_MAP[fcNamePTT];
              if (cmdTypePTT) {
                commandParseResult.commands.push({ type: cmdTypePTT as any, params: fcArgsPTT, source: 'text_fc_fallback' as any });
                console.log(`[Text FC Fallback - PTT] Injected command: ${cmdTypePTT}(${JSON.stringify(fcArgsPTT)})`);
              }
            }
          }
          
          // Log all detected commands for observability
          if (commandParseResult.commands.length > 0) {
            console.log(`[CommandParser] Detected ${commandParseResult.commands.length} commands in chunk ${chunk.index}:`, 
              commandParseResult.commands.map(c => `${c.type}(${c.source})`));
            
            if (commandParseResult.errors.length > 0) {
              console.warn(`[CommandParser] Validation issues:`, commandParseResult.errors);
            }
          }
          
          // UNIFIED COMMAND ROUTING: Process ALL commands through command-parser
          // This ensures each command executes exactly once with consistent validation.
          // The whiteboard parser now ONLY handles visual content (WRITE, PHONETIC, etc.)
          // All action commands are routed through here.
          const commandsToProcess = commandParseResult.commands;
          
          for (const cmd of commandsToProcess) {
              // BRAIN HEALTH TELEMETRY: Log all ACTION_TRIGGER commands
              brainHealthTelemetry.logActionTrigger({
                sessionId: session.id,
                conversationId: session.conversationId,
                userId: String(session.userId),
                targetLanguage: session.targetLanguage,
                actionTrigger: cmd.type,
                tagPayload: cmd.params,
              }).catch(err => console.warn('[BrainHealth] Action trigger log failed:', err.message));
              
              switch (cmd.type) {
                case 'SWITCH_TUTOR': {
                  // Only process if not already handled by whiteboard parser
                  // Also skip if cross-language transfer was already blocked this turn
                  const target = cmd.params.target as string;
                  if (!session.pendingTutorSwitch && !session.crossLanguageTransferBlocked && target) {
                    const targetGender = target as 'male' | 'female';
                    let resolvedLanguage = cmd.params.language as string | undefined;
                    
                    // AUTO-INFER LANGUAGE: If no language specified but AI mentioned a tutor from another language
                    // This ensures cross-language transfers are detected even in JSON command format
                    if (!resolvedLanguage && session.tutorDirectory && session.targetLanguage) {
                      resolvedLanguage = inferLanguageFromTutorName(
                        chunk.text,
                        targetGender,
                        session.targetLanguage,
                        session.tutorDirectory
                      );
                    }
                    
                    session.pendingTutorSwitch = {
                      targetGender,
                      targetLanguage: resolvedLanguage,
                      targetRole: cmd.params.role as 'tutor' | 'assistant' | undefined,
                    };
                    session.switchTutorTriggered = true;
                    console.log(`[CommandParser→TutorSwitch] Queued handoff to ${target} tutor${resolvedLanguage ? ` (${resolvedLanguage})` : ''} via ${cmd.source} format`);
                  }
                  break;
                }
                case 'PHASE_SHIFT': {
                  const to = cmd.params.to as string;
                  const reason = cmd.params.reason as string;
                  if (to && reason) {
                    this.enrichment.processPhaseShift(session, { 
                      to: to as 'warmup' | 'active_teaching' | 'challenge' | 'reflection' | 'drill' | 'assessment', 
                      reason 
                    }).catch(err => console.error(`[CommandParser→PhaseShift] Error:`, err));
                    console.log(`[CommandParser→PhaseShift] Triggered: ${to} - ${reason} via ${cmd.source} format`);
                  }
                  break;
                }
                case 'ACTFL_UPDATE': {
                  const level = cmd.params.level as string;
                  if (level) {
                    this.enrichment.processActflUpdate(session, {
                      level,
                      confidence: (cmd.params.confidence as number) || 0.8,
                      reason: (cmd.params.reason as string) || 'Observed in conversation',
                      direction: cmd.params.direction as 'up' | 'down' | 'confirm' | undefined,
                    }).catch(err => console.error(`[CommandParser→ActflUpdate] Error:`, err));
                    console.log(`[CommandParser→ActflUpdate] Level: ${level} via ${cmd.source} format`);
                  }
                  break;
                }
                case 'SYLLABUS_PROGRESS': {
                  const topic = cmd.params.topic as string;
                  const status = cmd.params.status as string;
                  if (topic && status) {
                    this.enrichment.processSyllabusProgress(session, {
                      topic,
                      status: status as 'demonstrated' | 'needs_review' | 'struggling',
                      evidence: (cmd.params.evidence as string) || 'Observed in conversation',
                    }).catch(err => console.error(`[CommandParser→SyllabusProgress] Error:`, err));
                    console.log(`[CommandParser→SyllabusProgress] Topic: ${topic} = ${status} via ${cmd.source} format`);
                  }
                  break;
                }
                case 'CHECK_STUDENT_CREDITS': {
                  console.log(`[CommandParser→CheckCredits] Credit check via ${cmd.source} format (delegating to native handler)`);
                  break;
                }
                case 'CALL_SUPPORT':
                case 'CALL_SOFIA': {
                  // Support handoff - queue for processing
                  const category = cmd.params.category as string;
                  if (category && !session.pendingSupportHandoff) {
                    session.pendingSupportHandoff = {
                      category,
                      reason: cmd.params.reason as string | undefined,
                    };
                    console.log(`[CommandParser→Support] Queued support handoff: ${category} via ${cmd.source} format`);
                  }
                  break;
                }
                case 'CALL_ASSISTANT': {
                  // Delegate drill practice to assistant tutor (e.g., Aris)
                  // Only process via command parser to avoid duplicate processing with whiteboard
                  const drillType = cmd.params.type as string;
                  const focus = cmd.params.focus as string;
                  const items = cmd.params.items as string;
                  
                  if (drillType && focus && items && !session.pendingAssistantHandoff) {
                    // Parse items (comma-separated string)
                    const itemsList = items.split(',').map(s => s.trim()).filter(Boolean);
                    
                    // Queue assistant handoff (don't block current response)
                    this.fcHandler.processAssistantHandoff(session, {
                      drillType: drillType as 'repeat' | 'translate' | 'match' | 'fill_blank' | 'sentence_order',
                      focus,
                      items: itemsList,
                      priority: cmd.params.priority as 'low' | 'medium' | 'high' | undefined,
                    }, turnId).catch(err => {
                      console.error(`[CommandParser→AssistantHandoff] Error:`, err);
                    });
                    
                    // Set flag to indicate assistant handoff is pending
                    session.pendingAssistantHandoff = {
                      drillType: drillType as 'repeat' | 'translate' | 'match' | 'fill_blank' | 'sentence_order',
                      focus,
                      items: itemsList,
                      priority: cmd.params.priority as 'low' | 'medium' | 'high' | undefined,
                    };
                    
                    console.log(`[CommandParser→AssistantHandoff] Delegated to assistant: ${drillType} drill for "${focus}" with ${itemsList.length} items via ${cmd.source} format`);
                  }
                  break;
                }
                case 'HIVE': {
                  if (session.isIncognito) {
                    console.log(`[CommandParser→Hive] INCOGNITO - skipping hive suggestion`);
                    break;
                  }
                  const category = cmd.params.category as string;
                  const title = cmd.params.title as string;
                  const description = cmd.params.description as string;
                  if (category && title && description) {
                    this.fcHandler.processHiveSuggestion(session, {
                      category,
                      title,
                      description,
                      reasoning: cmd.params.reasoning as string | undefined,
                      priority: cmd.params.priority as number | undefined,
                    }).catch(err => console.error(`[CommandParser→Hive] Error:`, err));
                    console.log(`[CommandParser→Hive] Posted: "${title}" (${category}) via ${cmd.source} format`);
                  }
                  break;
                }
                case 'FIRST_MEETING_COMPLETE': {
                  // Daniela signals she knows the student well enough
                  // This marks the end of the "first conversation" experience
                  const summary = cmd.params.summary as string | undefined;
                  
                  if (session.userId && !session.isIncognito) {
                    try {
                      await storage.updateUser(session.userId, { hasCompletedFirstMeeting: true });
                      console.log(`[CommandParser→FirstMeeting] Marked complete for user ${session.userId}${summary ? `: "${summary}"` : ''}`);
                      
                      // Emit beacon for founder visibility if in hive session
                      if (session.hiveChannelId) {
                        hiveCollaborationService.emitBeacon({
                          channelId: session.hiveChannelId,
                          tutorTurn: `[FIRST_MEETING_COMPLETE] Daniela has completed her "getting to know you" phase with this student.${summary ? `\n\nSummary: ${summary}` : ''}`,
                        });
                      }
                    } catch (err) {
                      console.error(`[CommandParser→FirstMeeting] Error updating user:`, err);
                    }
                  } else if (session.isIncognito) {
                    console.log(`[CommandParser→FirstMeeting] INCOGNITO - skipping DB update`);
                  } else {
                    console.log(`[CommandParser→FirstMeeting] Ignored (no userId in session)`);
                  }
                  break;
                }
                case 'TAKE_NOTE': {
                  // Daniela's personal notebook - DIRECT INSERT, no approval required
                  if (session.isIncognito) {
                    console.log(`[CommandParser→TakeNote] INCOGNITO - skipping note persistence`);
                    break;
                  }
                  const noteType = cmd.params.type as string | undefined;
                  const title = cmd.params.title as string | undefined;
                  const content = cmd.params.content as string | undefined;
                  const language = cmd.params.language as string | undefined;
                  const tagsStr = cmd.params.tags as string | undefined;
                  
                  if (noteType && title && content) {
                    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()) : undefined;
                    
                    console.log(`[CommandParser→TakeNote] ${noteType}: "${title.substring(0, 40)}..." via ${cmd.source}`);
                    
                    // Execute immediately - no approval needed
                    storage.insertDanielaNote({
                      noteType: noteType as any,
                      title,
                      content,
                      language: language || session.targetLanguage || 'spanish',
                      sessionId: session.id,
                      tags,
                    }).then(noteId => {
                      console.log(`[CommandParser→TakeNote] ✓ Saved note ${noteId}`);
                      
                      // Emit beacon for founder visibility if in hive session
                      if (session.hiveChannelId) {
                        hiveCollaborationService.emitBeacon({
                          channelId: session.hiveChannelId,
                          tutorTurn: `[TAKE_NOTE] ${noteType}: "${title}"\n${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`,
                          beaconType: 'take_note',
                          beaconReason: `Daniela wrote a note: ${title}`,
                        }).catch(err => console.error(`[CommandParser→TakeNote] Beacon error:`, err));
                      }
                    }).catch(err => {
                      console.error(`[CommandParser→TakeNote] Error:`, err.message);
                    });
                  }
                  break;
                }
                case 'SELF_SURGERY': {
                  // Daniela's self-reporting tool — she can notice and propose improvements to her own neural network
                  // IDENTITY WHOLENESS: Unlocked for ALL sessions so Daniela can spot real gaps while teaching real students
                  // Note: Target validation now happens in command-parser.ts via enum validation
                  const target = cmd.params.target as string;
                  const surgeryContent = cmd.params.content;
                  const reasoning = cmd.params.reasoning as string;
                  
                  if (target && surgeryContent && reasoning) {
                    // Safely parse content - may be string or object
                    let parsedContent: Record<string, unknown>;
                    try {
                      parsedContent = typeof surgeryContent === 'string' ? JSON.parse(surgeryContent) : surgeryContent as Record<string, unknown>;
                    } catch (parseErr) {
                      console.error(`[CommandParser→SelfSurgery] Invalid JSON content for ${target}:`, parseErr);
                      break;
                    }
                    
                    const priority = (cmd.params.priority as number) || 50;
                    const confidence = (cmd.params.confidence as number) || 70;
                    
                    // Emit Hive beacon for founder visibility (matches whiteboard path)
                    if (session.hiveChannelId) {
                      const contentPreview = JSON.stringify(parsedContent).substring(0, 300);
                      hiveCollaborationService.emitBeacon({
                        channelId: session.hiveChannelId,
                        tutorTurn: `[SELF_SURGERY PROPOSAL]\nTarget: ${target}\nPriority: ${priority}, Confidence: ${confidence}\nReasoning: ${reasoning}\n\nContent: ${contentPreview}...`,
                        studentTurn: transcript || '',  // Include transcript context for parity
                        beaconType: 'self_surgery_proposal',
                        beaconReason: `Daniela proposed neural network modification: ${target}`,
                      }).catch(err => console.error(`[CommandParser→SelfSurgery] Beacon error:`, err));
                    }
                    
                    // Call processSelfSurgery with exact SelfSurgeryItemData shape
                    this.fcHandler.processSelfSurgery(session, {
                      targetTable: target as import('@shared/whiteboard-types').SelfSurgeryTarget,
                      content: parsedContent,
                      reasoning,
                      priority,
                      confidence,
                    }).catch(err => console.error(`[CommandParser→SelfSurgery] Error:`, err));
                    console.log(`[CommandParser→SelfSurgery] Proposal for ${target} via ${cmd.source} format`);
                  }
                  break;
                }
                case 'MEMORY_LOOKUP': {
                  // On-demand neural memory search - supports student memory, teaching knowledge, AND syllabus lookup
                  const query = cmd.params.query as string;
                  const domainsStr = cmd.params.domains as string | undefined;
                  
                  if (query) {
                    // Parse domains if provided (comma-separated)
                    const rawDomains = domainsStr 
                      ? domainsStr.split(',').map(d => d.trim().toLowerCase())
                      : [];
                    
                    // Separate student domains, teaching domains, and syllabus domain
                    const studentDomains = ['person', 'motivation', 'insight', 'struggle', 'session', 'progress'];
                    const teachingDomains = ['idiom', 'cultural', 'procedure', 'principle', 'error-pattern', 'situational-pattern', 'subtlety-cue', 'emotional-pattern', 'creativity-template'];
                    const syllabusDomains = ['syllabus'];
                    
                    const requestedStudentDomains = rawDomains.filter(d => studentDomains.includes(d)) as ('person' | 'motivation' | 'insight' | 'struggle' | 'session' | 'progress')[];
                    const requestedTeachingDomains = rawDomains.filter(d => teachingDomains.includes(d)) as ('idiom' | 'cultural' | 'procedure' | 'principle' | 'error-pattern' | 'situational-pattern' | 'subtlety-cue' | 'emotional-pattern' | 'creativity-template')[];
                    const requestedSyllabusDomains = rawDomains.filter(d => syllabusDomains.includes(d));
                    
                    // If no specific domains requested, search all domains
                    const searchStudentMemory = requestedStudentDomains.length > 0 || rawDomains.length === 0;
                    const searchTeachingKnowledge = requestedTeachingDomains.length > 0 || rawDomains.length === 0;
                    const searchSyllabi = requestedSyllabusDomains.length > 0 || rawDomains.length === 0;
                    
                    try {
                      const { searchMemory, formatMemoryForConversation, searchTeachingKnowledge: searchTeaching, formatTeachingKnowledge, searchSyllabi: searchSyllabiFunc, formatSyllabusSearch } = await import('./neural-memory-search');
                      
                      const results: string[] = [];
                      let totalFound = 0;
                      const studentId = String(session.userId);
                      
                      // Search student memory if applicable
                      if (searchStudentMemory && studentId) {
                        const studentDomainFilter = requestedStudentDomains.length > 0 ? requestedStudentDomains : undefined;
                        const memoryResults = await searchMemory(studentId, query, studentDomainFilter, session.targetLanguage || undefined);
                        if (memoryResults.results.length > 0) {
                          results.push(formatMemoryForConversation(memoryResults));
                          totalFound += memoryResults.results.length;
                        }
                      }
                      
                      // Search teaching knowledge if applicable
                      let teachingResults: Awaited<ReturnType<typeof searchTeaching>> | null = null;
                      let formattedTeachingKnowledge = '';
                      const searchStartTime = Date.now();
                      
                      if (searchTeachingKnowledge) {
                        const teachingDomainFilter = requestedTeachingDomains.length > 0 ? requestedTeachingDomains : undefined;
                        teachingResults = await searchTeaching(query, session.targetLanguage || undefined, teachingDomainFilter);
                        if (teachingResults.results.length > 0) {
                          formattedTeachingKnowledge = formatTeachingKnowledge(teachingResults);
                          results.push(formattedTeachingKnowledge);
                          totalFound += teachingResults.results.length;
                        }
                        
                        // Emit telemetry for neural network monitoring
                        const searchDurationMs = Date.now() - searchStartTime;
                        const domainCounts = teachingResults.results.reduce((acc, r) => {
                          acc[r.domain] = (acc[r.domain] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>);
                        
                        getSharedDb().insert(neuralNetworkTelemetry).values({
                          voiceSessionId: session.id,
                          userId: session.userId,
                          targetLanguage: session.targetLanguage || null,
                          query,
                          domainsSearched: teachingResults.domainsSearched,
                          domainsRequested: teachingDomainFilter || null,
                          resultCount: teachingResults.results.length,
                          formattedCharacterLength: formattedTeachingKnowledge.length,
                          idiomCount: domainCounts['idiom'] || 0,
                          culturalCount: domainCounts['cultural'] || 0,
                          procedureCount: domainCounts['procedure'] || 0,
                          principleCount: domainCounts['principle'] || 0,
                          errorPatternCount: domainCounts['error-pattern'] || 0,
                          situationalPatternCount: domainCounts['situational-pattern'] || 0,
                          subtletyCueCount: domainCounts['subtlety-cue'] || 0,
                          emotionalPatternCount: domainCounts['emotional-pattern'] || 0,
                          creativityTemplateCount: domainCounts['creativity-template'] || 0,
                          searchDurationMs,
                        }).catch(err => console.error('[NeuralTelemetry] Insert error:', err));
                      }
                      
                      // Search syllabi/curriculum if applicable (Founder/Honesty mode syllabus access)
                      if (searchSyllabi) {
                        const syllabusResults = await searchSyllabiFunc(query, session.targetLanguage || undefined);
                        if (syllabusResults.results.length > 0) {
                          const formattedSyllabi = formatSyllabusSearch(syllabusResults);
                          results.push(formattedSyllabi);
                          totalFound += syllabusResults.results.length;
                          console.log(`[CommandParser→MemoryLookup] Syllabus search found ${syllabusResults.results.length} results for "${query}"`);
                        }
                      }
                      
                      if (results.length > 0) {
                        // Combine and inject into conversation
                        const combinedResults = results.join('\n\n');
                        
                        if (session.conversationHistory) {
                          session.conversationHistory.push({
                            role: 'user',
                            content: `[SYSTEM: Memory recall results for "${query}"]\n${combinedResults}`,
                          });
                        }
                        
                        console.log(`[CommandParser→MemoryLookup] Found ${totalFound} results for "${query}" (student: ${searchStudentMemory}, teaching: ${searchTeachingKnowledge}, syllabus: ${searchSyllabi})`);
                        
                        // Emit to founder if in Founder Mode
                        if (session.isFounderMode && session.hiveChannelId) {
                          hiveCollaborationService.emitBeacon({
                            channelId: session.hiveChannelId,
                            tutorTurn: `[MEMORY_LOOKUP] Query: "${query}"\nDomains: ${rawDomains.join(', ') || 'all'}\nResults: ${totalFound} found`,
                            studentTurn: '',
                            beaconType: 'memory_lookup',
                            beaconReason: `Daniela searched neural memory for "${query}"`,
                          }).catch(err => console.error(`[CommandParser→MemoryLookup] Beacon error:`, err));
                        }
                      } else {
                        console.log(`[CommandParser→MemoryLookup] No results found for "${query}"`);
                      }
                    } catch (err) {
                      console.error(`[CommandParser→MemoryLookup] Error searching memory:`, err);
                    }
                  }
                  break;
                }
                case 'EXPRESS_LANE_LOOKUP': {
                  // On-demand Express Lane history search - only in Founder/Honesty mode
                  const query = cmd.params.query as string;
                  const sessionId = cmd.params.sessionId as string | undefined;
                  const limit = (cmd.params.limit as number) || 20;
                  
                  if (!session.isFounderMode && !session.isRawHonestyMode) {
                    console.log(`[CommandParser→ExpressLaneLookup] Rejected - not in Founder/Honesty mode`);
                    if (session.conversationHistory) {
                      session.conversationHistory.push({
                        role: 'user',
                        content: `[SYSTEM: Express Lane lookup is only available in Founder Mode or Honesty Mode.]`,
                      });
                    }
                    break;
                  }
                  
                  try {
                    const { collaborationMessages } = await import('@shared/schema');
                    const sharedDb = getSharedDb();
                    
                    let results: any[];
                    
                    if (query) {
                      const keywords = query.split(/\s+/).filter(w => w.length >= 3);
                      const keywordConditions = keywords.length > 0
                        ? sql.join(keywords.map(kw => sql`content ILIKE ${`%${kw}%`}`), sql` OR `)
                        : sql`content ILIKE ${`%${query}%`}`;
                      
                      if (sessionId) {
                        results = await sharedDb.select()
                          .from(collaborationMessages)
                          .where(sql`session_id = ${sessionId} AND (${keywordConditions})`)
                          .orderBy(sql`created_at DESC`)
                          .limit(limit);
                      } else {
                        results = await sharedDb.select()
                          .from(collaborationMessages)
                          .where(keywordConditions)
                          .orderBy(sql`created_at DESC`)
                          .limit(limit);
                      }
                      console.log(`[CommandParser→ExpressLaneLookup] Keyword search for "${query}" (keywords: ${keywords.join(', ')})`);
                    } else {
                      if (sessionId) {
                        results = await sharedDb.select()
                          .from(collaborationMessages)
                          .where(sql`session_id = ${sessionId}`)
                          .orderBy(sql`created_at DESC`)
                          .limit(limit);
                      } else {
                        results = await sharedDb.select()
                          .from(collaborationMessages)
                          .orderBy(sql`created_at DESC`)
                          .limit(limit);
                      }
                      console.log(`[CommandParser→ExpressLaneLookup] Browse mode — fetching ${limit} most recent messages`);
                    }
                    
                    const label = query ? `search results for "${query}"` : `${results.length} most recent messages (browse mode)`;
                    
                    if (results.length > 0) {
                      const chronological = [...results].reverse();
                      const formattedResults = chronological.map(msg => {
                        const date = new Date(msg.createdAt).toLocaleDateString();
                        const preview = msg.content.length > 2000 ? msg.content.substring(0, 2000) + '...[truncated]' : msg.content;
                        return `[${date}] ${msg.role}: ${preview}`;
                      }).join('\n\n---\n\n');
                      
                      if (session.conversationHistory) {
                        session.conversationHistory.push({
                          role: 'user',
                          content: `[SYSTEM: Express Lane ${label}]\n\n${formattedResults}`,
                        });
                      }
                      
                      console.log(`[CommandParser→ExpressLaneLookup] Found ${results.length} messages`);
                      
                      if (session.hiveChannelId) {
                        hiveCollaborationService.emitBeacon({
                          channelId: session.hiveChannelId,
                          tutorTurn: `[EXPRESS_LANE_LOOKUP] ${label}\nResults: ${results.length} messages found`,
                          studentTurn: '',
                          beaconType: 'express_lane_lookup',
                          beaconReason: `Daniela ${query ? 'searched' : 'browsed'} Express Lane history`,
                        }).catch(err => console.error(`[CommandParser→ExpressLaneLookup] Beacon error:`, err));
                      }
                    } else {
                      console.log(`[CommandParser→ExpressLaneLookup] No results found`);
                      if (session.conversationHistory) {
                        session.conversationHistory.push({
                          role: 'user',
                          content: `[SYSTEM: No Express Lane messages found${query ? ` for "${query}"` : ''}]`,
                        });
                      }
                    }
                  } catch (err) {
                    console.error(`[CommandParser→ExpressLaneLookup] Error searching Express Lane:`, err);
                  }
                  break;
                }
                case 'EXPRESS_LANE_POST': {
                  // Post message to Express Lane collaboration channel - only in Founder/Honesty mode
                  const message = cmd.params.message as string;
                  const topic = cmd.params.topic as string | undefined;
                  
                  if (!session.isFounderMode && !session.isRawHonestyMode) {
                    console.log(`[CommandParser→ExpressLanePost] Rejected - not in Founder/Honesty mode`);
                    break;
                  }
                  
                  if (message) {
                    this.fcHandler.processExpressLanePost(session, message, topic).catch(err => {
                      console.error(`[CommandParser→ExpressLanePost] Error:`, err);
                    });
                    console.log(`[CommandParser→ExpressLanePost] Posted${topic ? ` [${topic}]` : ''}: "${message.substring(0, 80)}..."`);
                  }
                  break;
                }
                case 'VOICE_ADJUST': {
                  const text = cmd.params.text as string | undefined;
                  const speed = (cmd.params.speed as string | undefined)?.toLowerCase();
                  const emotion = (cmd.params.emotion as string | undefined)?.toLowerCase();
                  const personality = (cmd.params.personality as string | undefined)?.toLowerCase();
                  const vocalStyle = cmd.params.vocal_style as string | undefined;
                  const reason = cmd.params.reason as string | undefined;
                  
                  const speedMap: Record<string, number> = {
                    'slowest': 0.7,
                    'slow': 0.8,
                    'normal': 0.9,
                    'fast': 1.05,
                    'fastest': 1.2,
                  };
                  
                  const emotionMap: Record<string, string> = {
                    'positivity': 'happy',
                    'curiosity': 'curious',
                    'surprise': 'surprised',
                    'anger': 'neutral',
                    'sadness': 'thoughtful',
                    'happy': 'happy',
                    'excited': 'excited',
                    'friendly': 'friendly',
                    'curious': 'curious',
                    'thoughtful': 'thoughtful',
                    'warm': 'warm',
                    'playful': 'playful',
                    'surprised': 'surprised',
                    'proud': 'proud',
                    'encouraging': 'encouraging',
                    'calm': 'calm',
                    'neutral': 'neutral',
                  };
                  
                  const validPersonalities = ['warm', 'calm', 'energetic', 'professional'];
                  const validatedPersonality = personality && validPersonalities.includes(personality) 
                    ? personality as TutorPersonality 
                    : undefined;
                  
                  const mappedEmotion = emotion ? emotionMap[emotion] : undefined;
                  
                  const currentOverride = session.voiceOverride || {};
                  const newOverride = {
                    ...currentOverride,
                    ...(speed && { speakingRate: speedMap[speed] || 0.9 }),
                    ...(mappedEmotion && { emotion: mappedEmotion }),
                    ...(validatedPersonality && { personality: validatedPersonality }),
                    ...(vocalStyle && { vocalStyle }),
                  };
                  
                  session.voiceOverride = newOverride;
                  
                  if (text) {
                    session.voiceAdjustText = text;
                    console.log(`[CommandParser→VoiceAdjust] Text included (${text.length} chars): "${text.substring(0, 80)}..."`);
                  }
                  
                  console.log(`[CommandParser→VoiceAdjust] Applied: speed=${speed || 'unchanged'} (rate=${speed ? speedMap[speed] : 'unchanged'}), emotion=${emotion || 'unchanged'} (mapped=${mappedEmotion || 'unchanged'}), personality=${validatedPersonality || 'unchanged'}, vocalStyle=${vocalStyle ? `"${vocalStyle.substring(0, 60)}"` : 'unchanged'}, reason=${reason || 'none'}`);
                  console.log(`[CommandParser→VoiceAdjust] Session override now:`, newOverride);
                  break;
                }
                case 'VOICE_RESET': {
                  // Reset voice to tutor's baseline settings (stored on session creation)
                  const reason = cmd.params.reason as string | undefined;
                  
                  if (session.voiceDefaults) {
                    // Clear all overrides and restore defaults
                    session.voiceOverride = {
                      speakingRate: session.voiceDefaults.speakingRate,
                      emotion: session.voiceDefaults.emotion,
                      personality: session.voiceDefaults.personality,
                      expressiveness: session.voiceDefaults.expressiveness,
                    };
                    console.log(`[CommandParser→VoiceReset] Reset to tutor defaults:`, session.voiceDefaults, `reason: ${reason || 'none'}`);
                  } else {
                    // Fallback: clear override entirely
                    session.voiceOverride = undefined;
                    console.log(`[CommandParser→VoiceReset] Cleared override (no defaults stored), reason: ${reason || 'none'}`);
                  }
                  break;
                }
                // === UI CONTROL COMMANDS ===
                case 'SUBTITLE': {
                  const mode = (cmd.params.mode as string)?.toLowerCase();
                  const customText = cmd.params.text as string | undefined;
                  
                  if (mode === 'custom' && customText) {
                    session.customOverlayText = customText;
                    console.log(`[CommandParser→Subtitle] Custom text: "${customText.substring(0, 50)}..." via ${cmd.source}`);
                    this.sendMessage(session.ws, {
                      type: 'custom_overlay',
                      text: customText,
                      action: 'show',
                      timestamp: Date.now(),
                    } as any, session);
                  } else if (mode && ['off', 'on', 'target'].includes(mode)) {
                    const validMode = mode === 'on' ? 'all' : mode as 'off' | 'all' | 'target';
                    session.subtitleMode = validMode;
                    console.log(`[CommandParser→Subtitle] Mode changed to: ${validMode} via ${cmd.source}`);
                    this.sendMessage(session.ws, {
                      type: 'subtitle_mode_change',
                      mode: validMode,
                      timestamp: Date.now(),
                    } as any, session);
                    console.log(`[CommandParser→Subtitle] ✓ Sent subtitle_mode_change via sendMessage: ${validMode}`);
                  }
                  break;
                }
                case 'SHOW': {
                  // Display custom overlay text
                  const text = cmd.params.text as string;
                  if (text) {
                    // Set custom overlay on session for frontend to display
                    session.customOverlayText = text;
                    console.log(`[CommandParser→Show] Custom overlay: "${text.substring(0, 50)}..." via ${cmd.source} format`);
                    
                    // Send WebSocket message to client to display custom overlay
                    if (session.ws.readyState === 1) {
                      session.ws.send(JSON.stringify({
                        type: 'custom_overlay',
                        text: text,
                        action: 'show',
                        timestamp: Date.now(),
                      }));
                      console.log(`[CommandParser→Show] Sent custom_overlay to client`);
                    }
                  }
                  break;
                }
                case 'HIDE': {
                  // Hide custom overlay
                  session.customOverlayText = undefined;
                  console.log(`[CommandParser→Hide] Custom overlay hidden via ${cmd.source} format`);
                  
                  // Send WebSocket message to client to hide custom overlay
                  if (session.ws.readyState === 1) {
                    session.ws.send(JSON.stringify({
                      type: 'custom_overlay',
                      action: 'hide',
                      timestamp: Date.now(),
                    }));
                    console.log(`[CommandParser→Hide] Sent custom_overlay hide to client`);
                  }
                  break;
                }
                case 'TEXT_INPUT': {
                  // Request text input from student
                  const prompt = cmd.params.prompt as string;
                  if (prompt) {
                    // Store pending text input request for frontend
                    session.pendingTextInput = { prompt };
                    console.log(`[CommandParser→TextInput] Requested: "${prompt.substring(0, 50)}..." via ${cmd.source} format`);
                    
                    // Send WebSocket message to client to request text input
                    if (session.ws.readyState === 1) {
                      session.ws.send(JSON.stringify({
                        type: 'text_input_request',
                        prompt: prompt,
                        timestamp: Date.now(),
                      }));
                      console.log(`[CommandParser→TextInput] Sent text_input_request to client`);
                    }
                  }
                  break;
                }
                case 'CLEAR': {
                  session.commandParserClear = true;
                  session.classroomWhiteboardItems = [];
                  console.log(`[CommandParser→Clear] Whiteboard clear requested via ${cmd.source} format (classroom tracking reset)`);
                  break;
                }
                case 'HOLD': {
                  // Prevent whiteboard auto-clear - set session flag for inclusion in whiteboard_update message
                  // This ensures HOLD works when detected via JSON ACTION_TRIGGERS (not just text)
                  session.commandParserHold = true;
                  console.log(`[CommandParser→Hold] Whiteboard hold requested via ${cmd.source} format`);
                  break;
                }
              }
          }
          
          // Clean text for display (remove markdown, emotion tags)
          const displayText = cleanTextForDisplay(chunk.text);
          
          // DEBUG: Trace display text cleaning for command tags
          if (chunk.text.includes('[SWITCH_TUTOR') || chunk.text.includes('[CALL_SUPPORT') || chunk.text.includes('[PHASE_SHIFT')) {
            console.log(`[Display Clean DEBUG] Chunk ${chunk.index} raw: "${chunk.text.substring(0, 80)}..."`);
            console.log(`[Display Clean DEBUG] Chunk ${chunk.index} display: "${displayText.substring(0, 80)}..." (len=${displayText.length})`);
          }
          
          // NOTE: All action commands (SWITCH_TUTOR, ACTFL_UPDATE, PHASE_SHIFT, CALL_SUPPORT, etc.)
          // are now processed ONLY via the unified command parser above.
          // The duplicate whiteboard parser path has been removed to prevent double execution.
          
          // Send whiteboard updates BEFORE early returns (for visual feedback)
          const pttVisualItems = whiteboardParsed.whiteboardItems.filter(
            item => !['switch_tutor', 'actfl_update', 'syllabus_progress', 'phase_shift', 'call_support', 'call_assistant', 'hive', 'self_surgery'].includes(item.type)
          );
          
          // Combine whiteboard parser flags with command parser flags (JSON ACTION_TRIGGERS)
          const shouldClear = whiteboardParsed.shouldClear || session.commandParserClear;
          const shouldHold = whiteboardParsed.shouldHold || session.commandParserHold;
          
          // Clear the command parser flags after use (one-shot)
          if (session.commandParserClear) session.commandParserClear = false;
          if (session.commandParserHold) session.commandParserHold = false;
          
          if (pttVisualItems.length > 0 || shouldClear || shouldHold) {
            this.sendMessage(session.ws, {
              type: 'whiteboard_update',
              timestamp: Date.now(),
              turnId,
              items: pttVisualItems,
              shouldClear,
              shouldHold,
            } as StreamingWhiteboardMessage);
          }
          
          // EARLY EXIT: If SWITCH_TUTOR was triggered, stop synthesizing further sentences
          if (session.switchTutorTriggered) {
            console.log(`[Tutor Switch] PTT: Skipping sentence ${chunk.index} - new tutor will speak`);
            return;
          }
          
          // Process whiteboard items for visual display and tracking
          // This block now handles pedagogical tracking and enrichment only
          let hasWhiteboardContent = false;
          if (whiteboardParsed.whiteboardItems.length > 0 || whiteboardParsed.shouldClear || whiteboardParsed.shouldHold) {
            hasWhiteboardContent = true;
            const clearInfo = whiteboardParsed.shouldClear ? ', shouldClear=true' : '';
            const holdInfo = whiteboardParsed.shouldHold ? ', shouldHold=true' : '';
            console.log(`[Whiteboard] Parsed ${whiteboardParsed.whiteboardItems.length} items from sentence ${chunk.index}${clearInfo}${holdInfo}`);
            
            // PEDAGOGICAL TRACKING: Log each tool usage for effectiveness analysis
            // Don't await - runs in background, non-blocking
            for (let i = 0; i < whiteboardParsed.whiteboardItems.length; i++) {
              const item = whiteboardParsed.whiteboardItems[i];
              // Extract drillType from drill items (DrillItem has data.drillType)
              const drillType = item.type === 'drill' && 'data' in item && item.data && 'drillType' in item.data 
                ? (item.data as { drillType: string }).drillType 
                : undefined;
              const toolType = mapWhiteboardTypeToToolType(item.type, drillType);
              
              if (toolType) {
                // Extract content based on item type - use content field or data fields
                let toolContent: string | undefined;
                if ('content' in item && typeof item.content === 'string') {
                  toolContent = item.content;
                } else if ('data' in item && item.data) {
                  const data = item.data as unknown as Record<string, unknown>;
                  toolContent = (data.targetWord as string) || (data.word as string) || (data.text as string) || (data.prompt as string);
                }
                
                // Track tool for session analytics (for ACTFL effectiveness tracking)
                session.toolsUsedSession.push(toolType);
                
                trackToolEvent({
                  voiceSessionId: session.dbSessionId,  // Use database UUID, not orchestrator session ID
                  conversationId: session.conversationId,
                  userId: session.userId.toString(),
                  toolType,
                  toolContent,
                  language: session.targetLanguage,
                  difficulty: session.difficultyLevel,
                  sequencePosition: turnId * 100 + chunk.index * 10 + i, // Unique position within session
                });
              }
            }
            
            // NOTE: All action commands (SWITCH_TUTOR, ACTFL_UPDATE, PHASE_SHIFT, CALL_SUPPORT,
            // SYLLABUS_PROGRESS, HIVE, SELF_SURGERY, CALL_ASSISTANT) are now processed ONLY
            // via the unified command parser above to prevent double execution.
          }
          
          // ARCHITECT BIDIRECTIONAL: Detect and route [TO_ARCHITECT: message] tags
          // This enables Daniela to send real-time messages to the Architect/Claude
          const { messages: architectMessages } = extractArchitectMessages(chunk.text);
          if (architectMessages.length > 0 && session.isFounderMode) {
            for (const msg of architectMessages) {
              // Route to collaboration hub based on message type
              this.fcHandler.processArchitectMessage(session, msg).catch(err => {
                console.error(`[Architect Bidirectional] Error processing message:`, err);
              });
              console.log(`[Architect Bidirectional] Daniela → Claude: ${msg.type} (${msg.urgency}): "${msg.content.substring(0, 80)}..."`);
            }
          }
          
          // NOTE: Whiteboard updates and SWITCH_TUTOR early exit moved to early processing block (lines 1778-1798)
          // This conditional now only handles WORD_MAP enrichment for visual items
          if (pttVisualItems.length > 0) {
            // WORD_MAP ENRICHMENT: Asynchronously generate related words
            // Don't await - let this run in background while audio streams
            this.fcHandler.enrichWordMapItems(session.ws, pttVisualItems, session.targetLanguage, turnId);
          }
          
          // Skip empty sentences AFTER whiteboard processing
          // This ensures SWITCH_TUTOR and other commands are processed even with no speakable text
          if (!displayText) {
            if (hasWhiteboardContent) {
              console.log(`[Streaming Orchestrator] Sentence ${chunk.index} had whiteboard content only (no speakable text)`);
            } else {
              console.log(`[Streaming Orchestrator] Skipping empty sentence ${chunk.index} after cleaning`);
            }
            return; // Skip TTS but whiteboard items were already processed above
          }
          
          // DEDUPLICATION: Skip if we've already seen this sentence (LLM repetition loop)
          const normalizedText = displayText.toLowerCase().trim();
          if (seenSentences.has(normalizedText)) {
            console.log(`[Streaming Orchestrator] DEDUP: Skipping duplicate sentence ${chunk.index}: "${displayText.substring(0, 40)}..."`);
            return;
          }
          seenSentences.add(normalizedText);
          
          // MAX SENTENCE LIMIT: Prevent runaway responses
          if (actualSentenceCount >= MAX_SENTENCES) {
            console.log(`[Streaming Orchestrator] MAX LIMIT: Skipping sentence ${chunk.index} (already have ${actualSentenceCount})`);
            return;
          }
          actualSentenceCount++;
          
          // AI CONTENT MODERATION: Check AI response before sending to client/TTS
          // Only block severely inappropriate AI responses (rare edge case)
          if (containsSeverelyInappropriateContent(displayText)) {
            console.log(`[Streaming Orchestrator] AI response moderation: Skipping sentence ${chunk.index}`);
            return; // Skip this sentence entirely
          }
          
          // Extract target language with word mapping (needs raw text with bold markers)
          // This provides both targetLanguageText AND a mapping for karaoke highlighting
          const boldWords = extractBoldMarkedWords(chunk.text || '');
          const extraction = extractTargetLanguageWithMapping(displayText, boldWords);
          
          if (boldWords.length > 0) {
            this.fcHandler.addSttKeyterms(session, boldWords);
          }
          
          // DEBUG: Trace extraction
          if (extraction.targetText) {
            console.log(`[TargetExtraction] Raw: "${chunk.text.substring(0, 80)}..."`);
            console.log(`[TargetExtraction] Display: "${displayText.substring(0, 80)}..."`);
            console.log(`[TargetExtraction] Target: "${extraction.targetText}"`);
          }
          
          // Convert Map to array of tuples for JSON serialization
          const wordMappingArray: [number, number][] = extraction.wordMapping.size > 0
            ? Array.from(extraction.wordMapping.entries())
            : [];
          
          // NEW ARCHITECTURE (v2): Explicit hasTargetContent flag eliminates phantom subtitles
          // Client will hide subtitles immediately when hasTargetContent is false (no fallback needed)
          const hasTargetContent = !!(extraction.targetText && extraction.targetText.trim().length > 0);
          
          // ALWAYS log sentence_start for debugging
          console.log(`[SENTENCE_START EMIT] sentence=${chunk.index}, hasTarget=${hasTargetContent}, targetText="${(extraction.targetText || '').substring(0, 50)}"${isGoogleBatchMode ? ' (BATCH: deferred)' : ''}`);
          
          if (isGoogleBatchMode) {
            // GOOGLE BATCH MODE: Collect sentences for combined TTS after Gemini completes.
            // Sends full paragraph as ONE input to Chirp 3 HD for natural cross-sentence prosody.
            // Skip sentence_start and TTS here — handled post-streaming.
            // Skip empty sentences (e.g. text-based function calls stripped by cleanTextForDisplay)
            if (displayText.trim().length > 1) {
              batchedSentences.push({ chunk, displayText, rawText: chunk.text });
            } else {
              console.log(`[Google Batch] Skipping empty sentence ${chunk.index} from batch (cleaned to: "${displayText}")`);
            }
          } else {
            // Notify client of new sentence with cleaned text and word mapping
            this.sendMessage(session.ws, {
              type: 'sentence_start',
              timestamp: Date.now(),
              turnId,
              sentenceIndex: chunk.index,
              text: displayText,
              hasTargetContent,
              targetLanguageText: hasTargetContent ? extraction.targetText : undefined,
              wordMapping: hasTargetContent && wordMappingArray.length > 0 ? wordMappingArray : undefined,
            } as StreamingSentenceStartMessage);
            
            // Synthesize and stream audio for this sentence (pass cleaned text for timing)
            const ttsStart = Date.now();
            
            // PIPELINE TIMING: Track first sentence and TTS start
            if (chunk.index === 0) {
              pipelineTiming.firstSentenceReady = Date.now();
              pipelineTiming.ttsFirstCallStart = ttsStart;
            }
            
            // TTS LOOKAHEAD: Check if pre-generated audio is available from the lookahead pipeline
            const lookaheadPromise = ttsLookaheadMap.get(chunk.index);
            ttsLookaheadMap.delete(chunk.index);
            
            if (lookaheadPromise) {
              const preGenResult = await lookaheadPromise;
              if (preGenResult) {
                console.log(`[TTS Lookahead] Using pre-generated audio for sentence ${chunk.index} (waited ${Date.now() - ttsStart}ms)`);
                await this.tts.streamPreGeneratedSentenceAudio(session, chunk, displayText, metrics, turnId, preGenResult);
              } else {
                // Pre-generation failed, fall back to progressive
                if (STREAMING_FEATURE_FLAGS.PROGRESSIVE_AUDIO_STREAMING) {
                  await this.tts.streamSentenceAudioProgressive(session, chunk, displayText, metrics, turnId);
                } else {
                  await this.tts.streamSentenceAudio(session, chunk, displayText, metrics, turnId);
                }
              }
            } else {
              // No lookahead available (first sentence, or non-Gemini TTS)
              if (STREAMING_FEATURE_FLAGS.PROGRESSIVE_AUDIO_STREAMING) {
                await this.tts.streamSentenceAudioProgressive(session, chunk, displayText, metrics, turnId);
              } else {
                await this.tts.streamSentenceAudio(session, chunk, displayText, metrics, turnId);
              }
            }
            
            if (chunk.index === 0) {
              metrics.ttsFirstByteMs = Date.now() - ttsStart;
              pipelineTiming.ttsFirstAudioByte = Date.now();
            }
          }
          
          // Use cleaned displayText for persistence (no emotion tags, no markdown)
          fullText += displayText + ' ';
          rawFullText += chunk.text + ' ';  // Preserve raw for COLLAB/SELF_SURGERY extraction
          currentSentenceIndex = chunk.index;
          metrics.sentenceCount++;
        },
        onProgress: (partialText, totalChars) => {
          if (!pipelineTiming.geminiFirstToken && totalChars > 0) {
            pipelineTiming.geminiFirstToken = Date.now();
          }
        },
        onError: (error) => {
          console.error(`[Streaming Orchestrator] AI error:`, error.message);
          // Emit LLM error for diagnostics
          voiceDiagnostics.emit({
            sessionId,
            stage: 'llm',
            success: false,
            error: error.message,
            metadata: { turnId }
          });
          this.sendError(session.ws, 'AI_FAILED', error.message, true);
        },
      }),
        {
          maxRetries: 2,
          baseDelayMs: 800,
          maxDelayMs: 3000,
          onRetry: (attempt, error, delayMs) => {
            console.log(`[Gemini Retry - PTT] Attempt ${attempt} after ${delayMs}ms: ${error.message?.substring(0, 100)}`);
          },
        }
      );
      
      // GOOGLE BATCH TTS: After Gemini finishes generating ALL sentences,
      // combine them into one paragraph and send as a single TTS call.
      // This gives Chirp 3 HD the full context for natural cross-sentence prosody.
      if (isGoogleBatchMode && batchedSentences.length > 0) {
        // Early TTS spoke function call audio; batch has main-response sentences — different content.
        if (session.earlyTtsActive && !session.isInterrupted) {
          console.log(`[Google Batch TTS] Clearing earlyTtsActive before batch TTS for ${batchedSentences.length} deferred sentence(s)`);
          session.earlyTtsActive = undefined;
        }
      }
      if (isGoogleBatchMode && batchedSentences.length > 0 && !session.isInterrupted && !session.earlyTtsActive) {
        const combinedDisplayText = batchedSentences.map(s => s.displayText).join(' ');
        console.log(`[Google Batch TTS] Combining ${batchedSentences.length} sentences (${combinedDisplayText.length} chars) for single TTS call`);
        
        // Send one sentence_start with combined text (sentenceIndex=0 for the batch)
        this.sendMessage(session.ws, {
          type: 'sentence_start',
          timestamp: Date.now(),
          turnId,
          sentenceIndex: 0,
          text: combinedDisplayText,
          hasTargetContent: false,
        } as StreamingSentenceStartMessage);
        
        const batchTtsStart = Date.now();
        pipelineTiming.firstSentenceReady = batchTtsStart;
        pipelineTiming.ttsFirstCallStart = batchTtsStart;
        
        // Single TTS call with the full paragraph
        const batchChunk: SentenceChunk = { index: 0, text: combinedDisplayText, isComplete: true, isFinal: true };
        if (STREAMING_FEATURE_FLAGS.PROGRESSIVE_AUDIO_STREAMING) {
          await this.tts.streamSentenceAudioProgressive(session, batchChunk, combinedDisplayText, metrics, turnId);
        } else {
          await this.tts.streamSentenceAudio(session, batchChunk, combinedDisplayText, metrics, turnId);
        }
        
        metrics.ttsFirstByteMs = Date.now() - batchTtsStart;
        pipelineTiming.ttsFirstAudioByte = Date.now();
        console.log(`[Google Batch TTS] Complete. TTS duration: ${Date.now() - batchTtsStart}ms for ${batchedSentences.length} sentences`);
        
        metrics.sentenceCount = 1;
      }
      
      // Update conversation history
      session.conversationHistory.push({ role: 'user', content: transcript });
      
      // MULTI-STEP FUNCTION CALLING: Track if we need to continue after function execution
      // Gemini may call functions WITHOUT producing text - we need to send results back and continue
      const hadFunctionCalls = session.currentTurnFunctionCalls && session.currentTurnFunctionCalls.length > 0;
      const functionCallsCopy: ExtractedFunctionCall[] = hadFunctionCalls ? [...session.currentTurnFunctionCalls!] : [];
      const thoughtSignaturesCopy: string[] = session.currentTurnThoughtSignatures ? [...session.currentTurnThoughtSignatures] : [];
      
      // GEMINI 3: Build model response with function calls + thought signatures if applicable
      // This ensures multi-step function calling works correctly per docs
      // @see https://docs.cloud.google.com/vertex-ai/generative-ai/docs/thought-signatures
      if (hadFunctionCalls) {
        // Build parts array: function calls first (with signatures), then text
        const modelParts: Array<{
          text?: string;
          functionCall?: { name: string; args: Record<string, unknown> };
          thought_signature?: string;
        }> = [];
        
        // Add function call parts with their thought signatures
        for (const fc of session.currentTurnFunctionCalls!) {
          modelParts.push({
            functionCall: { name: fc.name, args: fc.args },
            thought_signature: fc.thoughtSignature,
          });
        }
        
        // Add text part for the spoken response
        if (fullText.trim()) {
          modelParts.push({ text: fullText.trim() });
        }
        
        session.conversationHistory.push({
          role: 'model',
          parts: modelParts,
          thoughtSignatures: session.currentTurnThoughtSignatures || [],
        });
        
        const sigCount = session.currentTurnThoughtSignatures?.length || 0;
        console.log(`[Conversation History] Saved model response with ${session.currentTurnFunctionCalls!.length} function calls, ${sigCount} thought signatures`);
        
        // Clear turn-specific tracking
        session.currentTurnFunctionCalls = [];
        session.currentTurnThoughtSignatures = [];
      } else {
        // Simple text response (no function calls)
        session.conversationHistory.push({ role: 'model', content: fullText.trim() });
      }
      
      // MULTI-STEP FUNCTION CALLING CONTINUATION
      // If Gemini called functions but produced no text, we need to continue the conversation
      // This sends function results back to Gemini and gets actual spoken text
      // OPTIMIZATION: Exclude metadata-only functions from needing continuation
      // These are speech annotations, not actions requiring a response - they work in a single call
      const METADATA_ONLY_FUNCTIONS = new Set(['VOICE_ADJUST', 'VOICE_RESET', 'WORD_EMPHASIS', 'SUBTITLE', 'SHOW', 'HIDE', 'HOLD', 'TAKE_NOTE', 'MILESTONE']);
      const functionsNeedingContinuation = functionCallsCopy.filter(
        fc => !METADATA_ONLY_FUNCTIONS.has(fc.legacyType || '')
      );
      
      if (metrics.sentenceCount === 0 && hadFunctionCalls && functionsNeedingContinuation.length === 0) {
        const fcTtsResult = await this.tts.dispatchPostStreamFcTts(session, metrics);
        if (fcTtsResult) {
          fullText = fcTtsResult.spokenText;
          metrics.sentenceCount = fcTtsResult.sentenceCount;
        } else {
          const metadataOnlyFunctions = functionCallsCopy.map(fc => fc.name).join(', ');
          console.warn(`[Voice PTT] Gemini returned only metadata functions (${metadataOnlyFunctions}) - forcing continuation for spoken response`);
          session.earlyTtsActive = undefined;
          functionsNeedingContinuation.push(...functionCallsCopy);
        }
      }
      
      if (metrics.sentenceCount === 0 && hadFunctionCalls && functionsNeedingContinuation.length > 0) {
        console.log(`[Multi-Step FC] Functions need continuation: ${functionsNeedingContinuation.map(fc => fc.name).join(', ')}`);
        console.log(`[Multi-Step FC] All functions executed: ${functionCallsCopy.map(fc => fc.name).join(', ')}`);
        
        // Await any pending memory lookups before building responses
        if (session.pendingMemoryLookupPromises?.length) {
          console.log(`[Multi-Step FC] Awaiting ${session.pendingMemoryLookupPromises.length} pending memory lookups...`);
          await Promise.all(session.pendingMemoryLookupPromises);
          session.pendingMemoryLookupPromises = [];
        }
        
        // Build function response parts for each executed function
        // These tell Gemini what happened when we executed its function calls
        // Note: Use 'tool' role and multimodal response format per Gemini 3 requirements
        const functionResponseParts: Array<{
          functionResponse: { name: string; response: { output: Array<{ text: string }> } };
        }> = [];
        
        for (const fc of functionCallsCopy) {
          const registryResult = buildFunctionContinuationResponse(session, fc);
          
          if (registryResult && typeof registryResult === 'object' && 'multimodal' in registryResult) {
            functionResponseParts.push({
              functionResponse: {
                name: fc.name,
                response: { output: registryResult.parts },
              },
            } as any);
            continue;
          }
          
          const responseText = (typeof registryResult === 'string')
            ? registryResult
            : `${fc.name} executed successfully. Continue the conversation.`;
          
          functionResponseParts.push({
            functionResponse: {
              name: fc.name,
              response: { output: [{ text: responseText }] },
            },
          });
        }
        
        // Add function response to conversation history
        // Use 'tool' role for proper Gemini 3 multi-step function calling
        session.conversationHistory.push({
          role: 'tool',
          parts: functionResponseParts,
          thoughtSignatures: thoughtSignaturesCopy,
        });
        
        console.log(`[Multi-Step FC] Added ${functionResponseParts.length} function responses to history`);
        console.log(`[Multi-Step FC] Continuing with ${thoughtSignaturesCopy.length} thought signatures`);
        
        // Re-initialize tracking for continuation turn
        session.currentTurnFunctionCalls = [];
        session.currentTurnThoughtSignatures = [];
        
        // Call Gemini again to get actual spoken text
        // Rebuild context fresh: stored preamble + current session history (with function responses)
        const continuationHistory: ConversationHistoryEntry[] = session.currentTurnPreamble
          ? [...session.currentTurnPreamble, ...session.conversationHistory]
          : session.conversationHistory;
        
        try {
          // Wrap in retry with exponential backoff for 429 rate limiting
          await retryWithBackoff(
            () => this.geminiService.streamWithSentenceChunking({
              systemPrompt: session.systemPrompt,  // Use stable base prompt (cached)
              conversationHistory: continuationHistory,  // Fresh: preamble + updated history
              userMessage: '', // Empty - we're continuing from function responses
              maxOutputTokens: session.isRawHonestyMode ? 8192 : 4096,
              enableFunctionCalling: true,
              enableContextCaching: true,  // Use cached system prompt
              onFunctionCall: async (newFunctionCalls: ExtractedFunctionCall[]) => {
                // Handle any additional function calls in continuation
                for (const fn of newFunctionCalls) {
                  console.log(`[Multi-Step FC Continuation] Additional function: ${fn.name}`);
                  if (fn.thoughtSignature) {
                    session.currentTurnThoughtSignatures?.push(fn.thoughtSignature);
                  }
                  session.currentTurnFunctionCalls?.push(fn);
                  this.fcHandler.handle(sessionId, session, fn).catch(err => {
                    console.error(`[Multi-Step FC] Error handling ${fn.name}:`, err.message);
                  });
                }
              },
              onSentence: async (chunk: SentenceChunk) => {
                // BARGE-IN CHECK
                if (session.isInterrupted) {
                  console.log(`[Multi-Step FC] Skipping sentence ${chunk.index} - user barged in`);
                  return;
                }
                
                // Clean and synthesize
                const displayText = cleanTextForDisplay(chunk.text);
                if (!displayText) return;
                
                // Deduplication
                const normalizedText = displayText.toLowerCase().trim();
                if (seenSentences.has(normalizedText)) return;
                seenSentences.add(normalizedText);
                
                if (actualSentenceCount >= MAX_SENTENCES) return;
                actualSentenceCount++;
                
                console.log(`[Multi-Step FC] Continuation sentence ${chunk.index}: "${displayText.substring(0, 50)}..."`);
                
                // Stream TTS
                if (STREAMING_FEATURE_FLAGS.PROGRESSIVE_AUDIO_STREAMING) {
                  await this.tts.streamSentenceAudioProgressive(session, chunk, displayText, metrics, turnId);
                } else {
                  await this.tts.streamSentenceAudio(session, chunk, displayText, metrics, turnId);
                }
                
                fullText += displayText + ' ';
                rawFullText += chunk.text + ' ';
                metrics.sentenceCount++;
              },
              onError: (error) => {
                console.error(`[Multi-Step FC] Continuation error:`, error.message);
              },
            }),
            {
              maxRetries: 3,
              baseDelayMs: 500,
              maxDelayMs: 4000,
              onRetry: (attempt, error, delayMs) => {
                console.log(`[Multi-Step FC] Rate limited, retry ${attempt}/3 after ${delayMs}ms`);
              }
            }
          );
          
          // Update conversation history with continuation response
          if (fullText.trim()) {
            // Build model parts for continuation (may have additional function calls)
            if (session.currentTurnFunctionCalls && session.currentTurnFunctionCalls.length > 0) {
              const contModelParts: Array<{
                text?: string;
                functionCall?: { name: string; args: Record<string, unknown> };
                thought_signature?: string;
              }> = [];
              
              for (const fc of session.currentTurnFunctionCalls) {
                contModelParts.push({
                  functionCall: { name: fc.name, args: fc.args },
                  thought_signature: fc.thoughtSignature,
                });
              }
              contModelParts.push({ text: fullText.trim() });
              
              session.conversationHistory.push({
                role: 'model',
                parts: contModelParts,
                thoughtSignatures: session.currentTurnThoughtSignatures || [],
              });
            } else {
              session.conversationHistory.push({ role: 'model', content: fullText.trim() });
            }
            console.log(`[Multi-Step FC] Continuation complete: ${metrics.sentenceCount} sentences`);
          }
          
          // Clear continuation tracking
          session.currentTurnFunctionCalls = [];
          session.currentTurnThoughtSignatures = [];
          
        } catch (contErr: any) {
          console.error(`[Multi-Step FC] Continuation failed:`, contErr.message);
          // Fall through to fallback below
        }
      }
      
      // FALLBACK FOR SILENT RESPONSES: If still no sentences after continuation attempts
      // Send a brief acknowledgment so Daniela doesn't appear unresponsive
      if (metrics.sentenceCount === 0) {
        const silentElapsed = Date.now() - (metrics as any)._geminiStartTime || 0;
        console.warn(`[Streaming Orchestrator] Silent response detected after ${silentElapsed}ms - sending fallback.`);
        logGeminiNoAudio(session.id, silentElapsed, {
          userId: session.userId?.toString(),
          turnId: session.turnId,
          responseLength: fullText.length,
          hadFunctionCalls,
        });
        
        // Generate a brief fallback acknowledgment based on language
        const fallbackAcks: Record<string, string> = {
          'spanish': 'Mmm, un momento...',
          'french': 'Hmm, un instant...',
          'german': 'Hmm, einen Moment...',
          'italian': 'Hmm, un momento...',
          'portuguese': 'Hmm, um momento...',
          'japanese': 'えっと、ちょっと待ってね...',
          'korean': '음, 잠깐만요...',
          'mandarin chinese': '嗯，稍等一下...',
          'english': 'Hmm, just a moment...',
          'hebrew': '...רגע, אממ',
          'arabic': 'همم، لحظة...',
        };
        const fallbackText = fallbackAcks[session.targetLanguage] || 'Hmm...';
        
        // Create a single fallback sentence chunk
        const fallbackChunk: SentenceChunk = {
          index: 0,
          text: fallbackText,
          isComplete: true,
          isFinal: true,
        };
        
        // Stream the fallback audio
        try {
          if (STREAMING_FEATURE_FLAGS.PROGRESSIVE_AUDIO_STREAMING) {
            await this.tts.streamSentenceAudioProgressive(session, fallbackChunk, fallbackText, metrics, turnId);
          } else {
            await this.tts.streamSentenceAudio(session, fallbackChunk, fallbackText, metrics, turnId);
          }
          fullText = fallbackText;
          metrics.sentenceCount = 1;
          
          // Update the already-pushed conversation history entry with the fallback text
          // (history was pushed before this fallback block)
          if (session.conversationHistory.length >= 1) {
            session.conversationHistory[session.conversationHistory.length - 1].content = fallbackText;
          }
        } catch (fallbackErr: any) {
          console.error(`[Streaming Orchestrator] Fallback TTS also failed:`, fallbackErr.message);
        }
      }
      
      // INCREMENTAL MEMORY CHECKPOINT: Persist student utterance immediately for crash recovery
      // This ensures memories aren't lost if session ends abruptly (network loss, navigation, etc)
      if (transcript.trim() && session.userId && !session.isIncognito) {
        memoryCheckpointService.checkpointUtterance(
          String(session.userId),
          sessionId,
          session.dbSessionId || null,
          session.targetLanguage,
          transcript,
          session.conversationHistory.length - 2 // Index of user message in history
        ).catch((err: Error) => {
          console.warn(`[Memory Checkpoint] Failed to checkpoint utterance:`, err.message);
        });
      }
      
      // Store transcript and response in metrics for message saving
      metrics.userTranscript = transcript;
      metrics.aiResponse = fullText.trim();
      
      // ZERO-SENTENCE SAFETY NET (PTT): If Gemini completed but produced no spoken text
      // (e.g., function call continuation returned empty), speak a fallback
      if (metrics.sentenceCount === 0 && !session.isInterrupted && !fullText.trim()) {
        const fallbackText = "Sorry, let me try that again. What were you saying?";
        console.warn(`[PTT Safety Net] 0 sentences produced after Gemini complete — speaking fallback`);
        try {
          this.sendMessage(session.ws, {
            type: 'sentence_start',
            timestamp: Date.now(),
            turnId,
            sentenceIndex: 0,
            text: fallbackText,
            hasTargetContent: false,
          } as StreamingSentenceStartMessage);
          await this.tts.streamSentenceAudioProgressive(session, { index: 0, text: fallbackText }, fallbackText, metrics, turnId);
          fullText = fallbackText;
          metrics.sentenceCount = 1;
        } catch (fallbackErr: any) {
          console.error(`[PTT Safety Net] Fallback TTS failed:`, fallbackErr.message);
        }
      }
      
      // Send completion message
      metrics.totalLatencyMs = Date.now() - startTime;
      
      // Clear generating flag - response complete
      session.isGenerating = false;
      session.lastResponseCompletedTime = Date.now();
      
      // Mark architect notes as delivered (only if not cleared by handleInterrupt)
      // handleInterrupt clears session.pendingArchitectNoteIds, so this is empty if interrupted
      if (session.pendingArchitectNoteIds.length > 0) {
        await architectVoiceService.markNotesDelivered(session.pendingArchitectNoteIds);
        session.pendingArchitectNoteIds = [];  // Clear after delivery
      }
      
      // EDITOR FEEDBACK: Mark newly surfaced feedback
      if (surfacedFeedbackIds.length > 0) {
        editorFeedbackService.markAsSurfaced(surfacedFeedbackIds).catch((err: any) => {
          console.warn(`[Editor Feedback] Failed to mark as surfaced:`, err.message);
        });
      }
      
      // EDITOR FEEDBACK: Parse [ADOPT_INSIGHT:id] markers from Daniela's response
      // This runs unconditionally for Founder Mode so Daniela can adopt previously surfaced insights
      if (session.isFounderMode) {
        const responseText = fullText.trim();
        const adoptionMatches = responseText.match(/\[ADOPT_INSIGHT:([a-f0-9-]+)\]/gi);
        if (adoptionMatches) {
          for (const match of adoptionMatches) {
            const idMatch = match.match(/\[ADOPT_INSIGHT:([a-f0-9-]+)\]/i);
            if (idMatch && idMatch[1]) {
              const adoptedId = idMatch[1];
              editorFeedbackService.markAsAdopted(adoptedId, `Voice response in ${session.targetLanguage}`).catch((err: any) => {
                console.warn(`[Editor Feedback] Failed to mark adoption:`, err.message);
              });
              console.log(`[Editor Feedback] Daniela adopted insight: ${adoptedId}`);
            }
          }
        }
      }
      
      // Track pipeline stage: response complete being sent
      trackVoicePipelineStage(sessionId, 'response_sent', { 
        userId: String(session.userId),
        turnId: String(turnId),
        durationMs: metrics.totalLatencyMs
      });
      
      responseCompleteSentPtt.sent = true;
      this.sendMessage(session.ws, {
        type: 'response_complete',
        timestamp: Date.now(),
        turnId,
        totalSentences: metrics.sentenceCount,
        totalDurationMs: metrics.totalLatencyMs,
        fullText: fullText.trim(),
        metrics: {
          sttLatencyMs: metrics.sttLatencyMs,
          aiFirstTokenMs: metrics.aiFirstTokenMs,
          ttsFirstChunkMs: metrics.ttsFirstByteMs,
          totalTtfbMs: metrics.sttLatencyMs + metrics.aiFirstTokenMs + metrics.ttsFirstByteMs,
          sentenceCount: metrics.sentenceCount,
        },
      } as StreamingResponseCompleteMessage);
      
      console.log(`[Streaming Orchestrator] Complete: ${metrics.sentenceCount} sentences, ${metrics.audioChunkCount} audio chunks in ${metrics.totalLatencyMs}ms (turnId: ${turnId})`);
      console.log(`[Streaming Orchestrator] Latencies: STT=${metrics.sttLatencyMs}ms, AI=${metrics.aiFirstTokenMs}ms, TTS=${metrics.ttsFirstByteMs}ms`);
      
      // PIPELINE TIMING SUMMARY: Structured breakdown of where time is spent
      pipelineTiming.responseComplete = Date.now();
      const pt = pipelineTiming;
      const sttMs = pt.sttEnd ? pt.sttEnd - pt.sttStart : 0;
      const contextMs = pt.contextFetchEnd ? pt.contextFetchEnd - pt.contextFetchStart : 0;
      const geminiFirstTokenMs = pt.geminiFirstToken ? pt.geminiFirstToken - pt.geminiStart : 0;
      const firstSentenceMs = pt.firstSentenceReady ? pt.firstSentenceReady - pt.geminiStart : 0;
      const ttsLatencyMs = pt.ttsFirstAudioByte && pt.ttsFirstCallStart ? pt.ttsFirstAudioByte - pt.ttsFirstCallStart : 0;
      const totalE2E = pt.responseComplete - pt.audioReceived;
      const ttfab = pt.ttsFirstAudioByte ? pt.ttsFirstAudioByte - pt.audioReceived : totalE2E;
      console.log(`[PIPELINE TIMING] Turn ${turnId} breakdown:`);
      console.log(`  STT: ${sttMs}ms | Context: ${contextMs}ms | Gemini TTFT: ${geminiFirstTokenMs}ms | 1st sentence: ${firstSentenceMs}ms | TTS 1st byte: ${ttsLatencyMs}ms`);
      console.log(`  Time-to-first-audio-byte: ${ttfab}ms | Total E2E: ${totalE2E}ms | Sentences: ${metrics.sentenceCount}`);
      
      // Emit TTS success for diagnostics (use ttsFirstByteMs for TTS-specific latency)
      // Only include audioChunkCount when audio was actually produced (not text-only turns)
      voiceDiagnostics.emit({
        sessionId,
        stage: 'tts',
        success: true,
        latencyMs: metrics.ttsFirstByteMs || 0,
        metadata: { 
          sentenceCount: metrics.sentenceCount, 
          ...(metrics.audioChunkCount > 0 && { audioChunkCount: metrics.audioChunkCount })
        }
      });
      
      // Emit complete E2E response for overall diagnostics
      // CRITICAL: audioChunkCount helps debug production double audio issues
      voiceDiagnostics.emit({
        sessionId,
        stage: 'complete',
        success: true,
        latencyMs: metrics.totalLatencyMs,
        metadata: { 
          sttMs: metrics.sttLatencyMs, 
          aiMs: metrics.aiFirstTokenMs, 
          ttsMs: metrics.ttsFirstByteMs,
          sentenceCount: metrics.sentenceCount,
          ...(metrics.audioChunkCount > 0 && { audioChunkCount: metrics.audioChunkCount })
        }
      });
      
      // HIVE BEACON EMISSION: Flag interesting teaching moments for Editor collaboration
      // Only emit for founder sessions to avoid noise, and run non-blocking
      // Pass rawFullText to extract COLLAB/SELF_SURGERY tags before they were stripped
      if (session.isFounderMode && session.hiveChannelId) {
        this.enrichment.emitHiveBeacons(session, transcript, fullText.trim(), rawFullText.trim()).catch((err: Error) => {
          console.warn('[Hive Beacon] Error emitting beacons:', err.message);
        });
      }
      
      // PHASE TRANSITION DETECTION: Check if we should transition teaching phases
      // Based on conversation patterns and student emotional cues
      const recentHistory = session.conversationHistory.slice(-6);
      phaseTransitionService.detectPhaseTransition(
        String(session.userId),
        recentHistory.map(h => ({ role: h.role, content: h.content })),
      ).then(async (newPhase) => {
        if (newPhase) {
          const event = await phaseTransitionService.transitionPhase(
            String(session.userId),
            newPhase,
            'conversation_pattern_detected',
            recentHistory.map(h => ({ role: h.role, content: h.content })),
            session.targetLanguage
          );
          console.log(`[Phase Transition] ${event.fromPhase} → ${event.toPhase}: ${event.reason}`);
        }
      }).catch((err: Error) => {
        console.warn('[Phase Transition] Detection failed:', err.message);
      });
      
      await this.executePendingTutorSwitch(session, sessionId, 'PTT');
      
      // Log structured metrics for monitoring (non-blocking, just console.log)
      const timeToFirstAudio = metrics.sttLatencyMs + metrics.aiFirstTokenMs + metrics.ttsFirstByteMs;
      logMetric('chat_response', {
        sessionId: session.id,
        sttMs: metrics.sttLatencyMs,
        aiFirstTokenMs: metrics.aiFirstTokenMs,
        ttsFirstByteMs: metrics.ttsFirstByteMs,
        timeToFirstAudioMs: timeToFirstAudio,
        totalMs: metrics.totalLatencyMs,
        sentences: metrics.sentenceCount,
        targetMet: timeToFirstAudio <= 3000,
      });
      
      // Start idle timeout - tutor waiting for student response
      this.startIdleTimeout(session);
      
      // Persist messages to database (non-blocking)
      // Also triggers background vocabulary extraction, progress updates, and ACTFL tracking
      // Pass the per-session pronunciationConfidence (captured above, no race conditions)
      this.persistMessages(session.conversationId, transcript, fullText.trim(), session, pronunciationConfidence).catch((err: Error) => {
        console.error('[Streaming Orchestrator] Failed to persist messages:', err.message);
      });
      
      return metrics;
      
    } catch (error: any) {
      // Clear generating flag on error
      session.isGenerating = false;
      
      // STRUCTURED ERROR LOGGING: Capture Gemini failure patterns for debugging
      const isGeminiError = error.message?.includes('Gemini') || 
                           error.message?.includes('API') ||
                           error.message?.includes('timeout') ||
                           error.message?.includes('rate limit') ||
                           error.message?.includes('429') ||
                           error.message?.includes('503') ||
                           error.message?.includes('500');
      
      const errorType = isGeminiError ? 'GEMINI_API_ERROR' : 'VOICE_PROCESSING_ERROR';
      const elapsedMs = Date.now() - startTime;
      
      // GRACEFUL RECOVERY (PTT): For 429 rate limit errors, speak a fallback so student isn't left in silence
      const is429ErrorPTT = error.message?.includes('429') || 
                            error.message?.includes('RESOURCE_EXHAUSTED') ||
                            error.message?.includes('Resource exhausted');
      if (is429ErrorPTT) {
        console.log(`[Gemini Recovery - PTT] 429 rate limit detected, providing spoken fallback`);
        const fallbackText = "One moment, I'm having a little trouble connecting. Could you say that again?";
        try {
          await this.synthesizeSentenceToClient(session, fallbackText, 0, null, { force: true });
          metrics.sentenceCount = 1;
          console.log(`[Gemini Recovery - PTT] Fallback response sent successfully`);
        } catch (ttsError: any) {
          console.error(`[Gemini Recovery - PTT] Fallback TTS failed:`, ttsError.message);
        }
      }
      
      // TIMEOUT-SPECIFIC TELEMETRY: Log timeouts to shared database for monitoring
      const isTimeout = error.message?.includes('timeout') || 
                       error.message?.includes('ETIMEDOUT') ||
                       elapsedMs > 60000; // Consider >60s as implicit timeout
      if (isTimeout) {
        logGeminiTimeout(sessionId, elapsedMs, {
          userId: String(session.userId),
          turnId: String(session.currentTurnId || 'unknown'),
        }).catch(err => console.error('[Telemetry] Failed to log Gemini timeout:', err.message));
      }
      
      console.error(`[Streaming Orchestrator] ${errorType}:`, {
        sessionId,
        conversationId: session.conversationId,
        userId: session.userId,
        error: error.message,
        errorStack: error.stack?.split('\n').slice(0, 3).join(' -> '),
        elapsedMs,
        aiFirstTokenReceived: metrics.aiFirstTokenMs > 0,
        sttMs: metrics.sttLatencyMs || 0,
        aiMs: metrics.aiFirstTokenMs || 0,
        userMessageCheckpointed: !!session.checkpointedUserMessageId,
      });
      
      // Emit error diagnostic for analytics
      voiceDiagnostics.emit({
        sessionId,
        stage: 'error',
        success: false,
        error: error.message,
        metadata: { 
          phase: 'processUserAudio',
          errorType,
          sttMs: metrics.sttLatencyMs || 0,
          aiMs: metrics.aiFirstTokenMs || 0,
          elapsedMs,
          checkpointed: !!session.checkpointedUserMessageId,
        }
      });
      
      // Log to shared database for cross-environment visibility
      logVoiceOrchestratorError(error, {
        userId: session.userId,
        sessionId,
        stage: errorType,
        turnId: String(turnId),
      }).catch(err => console.error('[Telemetry] Failed to log error:', err.message));
      
      this.sendError(session.ws, 'UNKNOWN', error.message, true);
      
      if (!responseCompleteSentPtt.sent) {
        responseCompleteSentPtt.sent = true;
        this.sendMessage(session.ws, {
          type: 'response_complete',
          timestamp: Date.now(),
          turnId,
          totalSentences: metrics.sentenceCount,
          totalDurationMs: Date.now() - startTime,
          fullText: '',
          metrics: {
            sttLatencyMs: metrics.sttLatencyMs,
            aiFirstTokenMs: metrics.aiFirstTokenMs,
            ttsFirstChunkMs: metrics.ttsFirstByteMs,
            totalTtfbMs: 0,
            sentenceCount: metrics.sentenceCount,
          },
        } as StreamingResponseCompleteMessage);
      } else {
        console.log(`[Streaming Orchestrator] response_complete already sent — skipping catch-block emit for session ${sessionId}`);
      }
      
      return metrics;
    }
  }
  private async completeOpenMicResponse(
    session: StreamingSession,
    metrics: StreamingMetrics,
    turnId: number,
    startTime: number,
    fullText: string,
    transcript: string,
    confidence: number,
    sentRef: { sent: boolean },
    options?: { skipPersist?: boolean; skipTutorSwitch?: boolean; errorPath?: boolean }
  ): Promise<void> {
    if (sentRef.sent) {
      console.log(`[Streaming Orchestrator] response_complete already sent — skipping for session ${metrics.sessionId}`);
      return;
    }
    sentRef.sent = true;

    session.isGenerating = false;
    session.lastResponseCompletedTime = Date.now();
    session.earlyTtsActive = undefined;

    if (session.pendingArchitectNoteIds.length > 0) {
      await architectVoiceService.markNotesDelivered(session.pendingArchitectNoteIds);
      session.pendingArchitectNoteIds = [];
    }

    metrics.totalLatencyMs = Date.now() - startTime;

    const POST_TTS_SUPPRESSION_HOLD_MS = 2500;
    if (session.postTtsSuppressionTimer) clearTimeout(session.postTtsSuppressionTimer);
    session.postTtsSuppressionTimer = setTimeout(() => {
      session.onTtsStateChange?.(false);
      session.postTtsSuppressionTimer = null;
    }, POST_TTS_SUPPRESSION_HOLD_MS);

    this.sendMessage(session.ws, {
      type: 'response_complete',
      timestamp: Date.now(),
      turnId,
      totalSentences: metrics.sentenceCount,
      totalDurationMs: metrics.totalLatencyMs,
      fullText: options?.errorPath ? '' : fullText.trim(),
      metrics: {
        sttLatencyMs: metrics.sttLatencyMs,
        aiFirstTokenMs: metrics.aiFirstTokenMs,
        ttsFirstChunkMs: metrics.ttsFirstByteMs,
        totalTtfbMs: options?.errorPath ? 0 : (metrics.sttLatencyMs + metrics.aiFirstTokenMs + metrics.ttsFirstByteMs),
        sentenceCount: metrics.sentenceCount,
      },
    } as StreamingResponseCompleteMessage);

    if (!options?.skipPersist) {
      this.persistMessages(session.conversationId, transcript, fullText.trim(), session, confidence).catch((err: Error) => {
        console.error('[Streaming Orchestrator] Failed to persist messages:', err.message);
      });
    }

    if (!options?.skipTutorSwitch) {
      await this.executePendingTutorSwitch(session, metrics.sessionId, 'OpenMic');
    }
  }

  /**
   * Execute pending tutor switch after response completes.
   * Shared between PTT and OpenMic paths. Handles:
   * - Cross-language transfer validation + defense-in-depth
   * - tutorDirectory rebuild for older/recovered sessions
   * - Assistant switch with voice caching
   * - Main tutor switch with wasAssistantActive gender restore
   * - DB updates + conversation history clearing for cross-language
   * - System prompt regeneration (both cross-language and same-language)
   * - Client notification + greeting trigger
   */
  private async executePendingTutorSwitch(
    session: StreamingSession,
    sessionId: string,
    mode: 'PTT' | 'OpenMic'
  ): Promise<void> {
    if (!session.pendingTutorSwitch) return;

    const { targetGender, targetLanguage, targetRole } = session.pendingTutorSwitch;

    const transferValidation = targetRole !== 'assistant'
      ? validateTutorTransfer(session.targetLanguage, targetLanguage)
      : { allowed: true as const };

    if (!transferValidation.allowed) {
      console.log(`[Tutor Switch] ${mode} BLOCKED: Cross-language transfer from ${session.targetLanguage} to ${targetLanguage}`);
      console.log(`[Tutor Switch] Reason: ${transferValidation.reason}`);
      session.pendingTutorSwitch = undefined;
      session.crossLanguageTransferBlocked = true;
      this.sendMessage(session.ws, {
        type: 'tutor_transfer_blocked',
        timestamp: Date.now(),
        fromLanguage: session.targetLanguage,
        toLanguage: targetLanguage,
        reason: transferValidation.reason,
      } as any);
      return;
    }

    session.pendingTutorSwitch = undefined;
    const isAssistantSwitch = targetRole === 'assistant';
    const effectiveLanguage = targetLanguage?.toLowerCase() || session.targetLanguage.toLowerCase();
    const isLanguageSwitch = effectiveLanguage !== session.targetLanguage.toLowerCase();

    if (!isAssistantSwitch && isLanguageSwitch && !CROSS_LANGUAGE_TRANSFERS_ENABLED) {
      console.log(`[Tutor Switch] ${mode} BLOCKED (defense): Resolved language ${effectiveLanguage} differs from session ${session.targetLanguage}`);
      session.crossLanguageTransferBlocked = true;
      this.sendMessage(session.ws, {
        type: 'tutor_transfer_blocked',
        timestamp: Date.now(),
        fromLanguage: session.targetLanguage,
        toLanguage: effectiveLanguage,
        reason: 'Cross-language transfers are currently disabled.',
      } as any);
      return;
    }

    const roleInfo = isAssistantSwitch ? ' (assistant)' : '';
    console.log(`[Tutor Switch] ${mode}: Executing handoff to ${targetGender} tutor${roleInfo}${isLanguageSwitch ? ` in ${effectiveLanguage}` : ''}`);

    if (!session.tutorDirectory || session.tutorDirectory.length === 0) {
      console.log('[Tutor Switch] Rebuilding tutorDirectory - was undefined/null on session');
      try {
        const allVoices = await storage.getAllTutorVoices();
        const { ASSISTANT_TUTORS } = await import('./assistant-tutor-config');
        const preferredGender = session.cachedMainTutorGender || session.tutorGender || 'female';
        const currentLanguage = session.targetLanguage?.toLowerCase() || 'spanish';

        const mainTutorEntries: TutorDirectoryEntry[] = allVoices
          .filter((v: any) => v.role === 'tutor' && v.isActive)
          .map((v: any) => {
            const voiceNameParts = v.voiceName?.split(/\s*[-–]\s*/) || [];
            const name = voiceNameParts[0]?.trim() || 'Unknown';
            const normalizedGender = (v.gender || 'female').toLowerCase() as 'male' | 'female';
            const normalizedLanguage = (v.language || 'spanish').toLowerCase();
            const isPreferred = preferredGender === normalizedGender && normalizedLanguage === currentLanguage;
            return {
              name,
              gender: normalizedGender,
              language: normalizedLanguage,
              isPreferred,
              isCurrent: v.voiceId === session.voiceId,
              role: 'tutor' as const,
            };
          });

        const assistantEntries: TutorDirectoryEntry[] = Object.entries(ASSISTANT_TUTORS)
          .flatMap(([lang, assistantConfig]) => {
            const langNormalized = lang.toLowerCase();
            return [
              { name: assistantConfig.male, gender: 'male' as const, language: langNormalized, isPreferred: preferredGender === 'male' && langNormalized === currentLanguage, isCurrent: false, role: 'assistant' as const },
              { name: assistantConfig.female, gender: 'female' as const, language: langNormalized, isPreferred: preferredGender === 'female' && langNormalized === currentLanguage, isCurrent: false, role: 'assistant' as const },
            ];
          });

        const sofiaEntry: TutorDirectoryEntry = {
          name: 'Sofia',
          gender: 'female' as const,
          language: 'multilingual',
          isPreferred: false,
          isCurrent: false,
          role: 'support' as const,
        };

        session.tutorDirectory = [...mainTutorEntries, ...assistantEntries, sofiaEntry];
        console.log(`[Tutor Switch] Rebuilt tutorDirectory with ${session.tutorDirectory.length} entries (preferredGender=${preferredGender})`);
      } catch (rebuildErr: any) {
        console.warn(`[Tutor Switch] Failed to rebuild tutorDirectory: ${rebuildErr.message}`);
      }
    }

    session.previousTutorName = session.tutorName;

    try {
      let tutorName: string | undefined;

      if (isAssistantSwitch) {
        const { ASSISTANT_TUTORS } = await import('./assistant-tutor-config');
        const assistantConfig = ASSISTANT_TUTORS[effectiveLanguage] || ASSISTANT_TUTORS.spanish;
        if (assistantConfig) {
          tutorName = targetGender === 'male' ? assistantConfig.male : assistantConfig.female;
          if (!session.isAssistantActive) {
            if (session.voiceId) {
              session.cachedMainTutorVoiceId = session.voiceId;
            }
            session.cachedMainTutorGender = session.tutorGender as 'male' | 'female';
            console.log(`[Tutor Switch] Cached main tutor: voiceId=${session.voiceId}, gender=${session.tutorGender}`);
          }
          session.isAssistantActive = true;
          session.voiceId = undefined;
          session.tutorGender = targetGender;
          session.tutorName = tutorName;

          console.log(`[Tutor Switch] Assistant handoff: ${tutorName} (${effectiveLanguage}, ${targetGender}) - TTS: Google Cloud`);

          this.sendMessage(session.ws, {
            type: 'tutor_handoff',
            timestamp: Date.now(),
            targetGender,
            targetLanguage: isLanguageSwitch ? effectiveLanguage : undefined,
            tutorName,
            isLanguageSwitch,
            requiresGreeting: true,
            isAssistant: true,
          });
        } else {
          console.warn(`[Tutor Switch] No assistant config found for ${effectiveLanguage}`);
        }
      } else {
        const wasAssistantActive = session.isAssistantActive;
        const effectiveGender = wasAssistantActive && session.cachedMainTutorGender
          ? session.cachedMainTutorGender
          : targetGender;

        if (wasAssistantActive && session.cachedMainTutorGender && session.cachedMainTutorGender !== targetGender) {
          console.log(`[Tutor Switch] Overriding target=${targetGender} with cached main tutor gender=${session.cachedMainTutorGender}`);
        }

        const allVoices = await storage.getAllTutorVoices();
        const matchingVoice = allVoices.find(
          (v: any) => v.language?.toLowerCase() === effectiveLanguage &&
                      v.gender?.toLowerCase() === effectiveGender &&
                      v.role === 'tutor' && v.isActive
        );

        if (matchingVoice) {
          const voiceNameParts = matchingVoice.voiceName?.split(/\s*[-–]\s*/) || [];
          tutorName = voiceNameParts[0]?.trim();
          session.isAssistantActive = false;

          if (wasAssistantActive) {
            console.log(`[Tutor Switch] Returning from assistant mode to main tutor (${effectiveGender}) - TTS: Cartesia`);
            session.cachedMainTutorGender = undefined;
            session.cachedMainTutorVoiceId = undefined;
          }

          session.voiceId = matchingVoice.voiceId;
          session.ttsProvider = (matchingVoice.provider === 'elevenlabs' ? 'elevenlabs' : matchingVoice.provider === 'google' ? 'google' : matchingVoice.provider === 'gemini' ? 'gemini' : 'cartesia') as 'elevenlabs' | 'cartesia' | 'google' | 'gemini';
          session.elStability = matchingVoice.elStability ?? 0.5;
          session.elSimilarityBoost = matchingVoice.elSimilarityBoost ?? 0.75;
          session.elStyle = matchingVoice.elStyle ?? 0;
          session.elSpeakerBoost = matchingVoice.elSpeakerBoost ?? true;
          session.tutorGender = effectiveGender;
          session.tutorName = tutorName || 'your tutor';

          const newPersonality = (matchingVoice.personality as TutorPersonality) || 'warm';
          session.voiceDefaults = {
            speakingRate: matchingVoice.speakingRate ?? 0.9,
            personality: newPersonality,
            emotion: matchingVoice.emotion || getDefaultEmotion(newPersonality),
            expressiveness: matchingVoice.expressiveness ?? 3,
          };
          session.voiceOverride = undefined;
          console.log(`[Tutor Switch] ${mode}: Updated voiceDefaults for ${tutorName}:`, session.voiceDefaults);

          if (isLanguageSwitch) {
            session.previousLanguage = session.targetLanguage;
            session.isLanguageSwitchHandoff = true;
            session.targetLanguage = effectiveLanguage;

            try {
              await storage.updateConversationLanguage(session.conversationId, effectiveLanguage);
              console.log(`[Tutor Switch] Updated conversation language in database to ${effectiveLanguage}`);
              await storage.updateUserPreferences(session.userId.toString(), {
                targetLanguage: effectiveLanguage,
              });
              console.log(`[Tutor Switch] Updated user preferences to ${effectiveLanguage}`);
            } catch (dbErr: any) {
              console.error(`[Tutor Switch] Failed to update language:`, dbErr.message);
            }

            console.log(`[Tutor Switch] Clearing conversation history for cross-language switch (${session.previousLanguage} -> ${effectiveLanguage})`);
            session.conversationHistory = [];

            session.systemPrompt = createSystemPrompt(
              effectiveLanguage,
              session.difficultyLevel,
              0,
              false,
              undefined,
              undefined,
              session.nativeLanguage,
              undefined,
              undefined,
              undefined,
              false,
              0,
              session.tutorPersonality,
              session.tutorExpressiveness,
              true,
              null,
              'flexible_goals',
              undefined,
              null,
              session.isFounderMode,
              undefined,
              session.isRawHonestyMode,
              tutorName || 'your tutor',
              effectiveGender,
              session.tutorDirectory,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              session.tutorPersona
            );
            console.log(`[Tutor Switch] Language switched to ${effectiveLanguage}, voice: ${matchingVoice.voiceName}, system prompt regenerated`);
          } else {
            session.systemPrompt = createSystemPrompt(
              session.targetLanguage,
              session.difficultyLevel,
              session.conversationHistory.length,
              false,
              undefined,
              undefined,
              session.nativeLanguage,
              undefined,
              undefined,
              undefined,
              false,
              0,
              session.tutorPersonality,
              session.tutorExpressiveness,
              true,
              null,
              'flexible_goals',
              undefined,
              null,
              session.isFounderMode,
              undefined,
              session.isRawHonestyMode,
              tutorName || 'your tutor',
              effectiveGender,
              session.tutorDirectory,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              session.tutorPersona
            );
            console.log(`[Tutor Switch] Same-language switch, new voice: ${matchingVoice.voiceName}, persona updated for ${tutorName}`);
          }
        } else {
          console.warn(`[Tutor Switch] No matching voice found for ${effectiveGender} in ${effectiveLanguage}`);
        }

        this.sendMessage(session.ws, {
          type: 'tutor_handoff',
          timestamp: Date.now(),
          targetGender: effectiveGender,
          targetLanguage: isLanguageSwitch ? effectiveLanguage : undefined,
          tutorName,
          isLanguageSwitch,
          requiresGreeting: true,
        });

        if (tutorName && !isAssistantSwitch) {
          session.greetingTriggeredByOrchestrator = true;
          console.log(`[Tutor Switch] ${mode}: Triggering ${tutorName}'s greeting`);
          this.processVoiceSwitchIntro(sessionId, tutorName, effectiveGender).catch((err: Error) => {
            console.error(`[Tutor Switch] Failed to generate greeting:`, err.message);
          });
        }
      }
    } catch (err: any) {
      console.error(`[Tutor Switch] ${mode} error:`, err.message);
      this.sendMessage(session.ws, {
        type: 'tutor_handoff',
        timestamp: Date.now(),
        targetGender,
        isLanguageSwitch: false,
      });
    }
  }

  /**
   * Process open mic transcript directly (no STT needed - Deepgram already transcribed)
   * Used when VAD detects utterance end in open mic mode
   */
  async processOpenMicTranscript(
    sessionId: string,
    transcript: string,
    confidence: number
  ): Promise<StreamingMetrics> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      // Emit connection failure for analytics before throwing
      voiceDiagnostics.emit({
        sessionId,
        stage: 'connection',
        success: false,
        error: 'Session not found or inactive',
        metadata: { phase: 'processOpenMicTranscript' }
      });
      throw new Error(`Session not found or inactive: ${sessionId}`);
    }
    
    // DEDUPLICATION GUARD: Prevent same transcript from being processed twice
    // This fixes the race condition where PTT release and audio_data can both trigger AI
    // with the same transcript when speculativeAiAccepted flag timing is off
    // Normalize: lowercase, strip punctuation, collapse whitespace to catch near-identical transcripts
    const transcriptHash = transcript
      .trim()
      .toLowerCase()
      .replace(/[.,!?;:'"""''…\-—–]/g, '') // Strip common punctuation
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .substring(0, 100);
    const now = Date.now();
    const DEDUP_WINDOW_MS = 60000; // 60 second window to catch duplicates (increased from 5s)
    
    // CROSS-SESSION DEDUP: Prevent same transcript from being reprocessed after reconnection
    // When a user disconnects and reconnects quickly, a new session is created but the same
    // audio/transcript may arrive again. This guard uses a per-user map that persists across sessions.
    const userId = String(session.userId || sessionId);
    const userLastTranscript = this.userTranscriptDedup.get(userId);
    if (userLastTranscript && userLastTranscript.hash === transcriptHash &&
        (now - userLastTranscript.time) < DEDUP_WINDOW_MS) {
      console.log(`[DEDUP-CROSS-SESSION] Skipping transcript already processed in previous session (${now - userLastTranscript.time}ms ago): "${transcript.slice(0, 50)}..."`);
      this.sendGuardResetSignal(session, 'dedup');
      return {
        sessionId,
        sttLatencyMs: 0,
        aiFirstTokenMs: 0,
        ttsFirstByteMs: 0,
        totalLatencyMs: 0,
        sentenceCount: 0,
        audioBytes: 0,
        audioChunkCount: 0,
      };
    }
    
    if (session.lastProcessedTranscriptHash === transcriptHash && 
        session.lastProcessedTranscriptTime && 
        (now - session.lastProcessedTranscriptTime) < DEDUP_WINDOW_MS) {
      console.log(`[DEDUP] Skipping duplicate transcript (processed ${now - session.lastProcessedTranscriptTime}ms ago): "${transcript.slice(0, 50)}..."`);
      this.sendGuardResetSignal(session, 'dedup');
      return {
        sessionId,
        sttLatencyMs: 0,
        aiFirstTokenMs: 0,
        ttsFirstByteMs: 0,
        totalLatencyMs: 0,
        sentenceCount: 0,
        audioBytes: 0,
        audioChunkCount: 0,
      };
    }
    
    // RAPID-FIRE GUARD: Prevent generating new response immediately after one just completed
    // This catches the speculative AI → final transcript race condition where:
    // 1. Speculative AI completes with partial transcript
    // 2. Immediately after, PTT release triggers with full transcript
    // Both transcripts are DIFFERENT so hash dedup doesn't catch it
    const RESPONSE_COOLDOWN_MS = 800; // 800ms cooldown after response completion
    if (session.lastResponseCompletedTime && 
        (now - session.lastResponseCompletedTime) < RESPONSE_COOLDOWN_MS) {
      console.log(`[DEDUP] Skipping rapid-fire transcript (response completed ${now - session.lastResponseCompletedTime}ms ago): "${transcript.slice(0, 50)}..."`);
      this.sendGuardResetSignal(session, 'rapid_fire');
      return {
        sessionId,
        sttLatencyMs: 0,
        aiFirstTokenMs: 0,
        ttsFirstByteMs: 0,
        totalLatencyMs: 0,
        sentenceCount: 0,
        audioBytes: 0,
        audioChunkCount: 0,
      };
    }
    
    // GREETING GUARD: If the greeting is still streaming, skip the OpenMic utterance entirely.
    // Without this, the greeting's response_complete poisons the OpenMic turn state, causing freeze.
    if (session.__greetingInProgress) {
      console.log(`[DEDUP] Skipping OpenMic utterance while greeting is still in progress: "${transcript.slice(0, 50)}..."`);
      this.sendGuardResetSignal(session, 'greeting_in_progress');
      return {
        sessionId,
        sttLatencyMs: 0,
        aiFirstTokenMs: 0,
        ttsFirstByteMs: 0,
        totalLatencyMs: 0,
        sentenceCount: 0,
        audioBytes: 0,
        audioChunkCount: 0,
      };
    }
    
    // IN-FLIGHT GUARD: If AI is currently generating a response, check if new transcript
    // is an extension of what we're already processing. If so, skip to prevent double response.
    // This catches the case where UtteranceEnd fires with partial, then full transcript.
    if (session.isGenerating && session.lastProcessedTranscriptHash) {
      // Check if new transcript CONTAINS the previous one (extension/continuation)
      const prevHash = session.lastProcessedTranscriptHash;
      const isExtension = transcriptHash.startsWith(prevHash) || 
                          prevHash.startsWith(transcriptHash) ||
                          // Also check word overlap - if >60% words are shared, likely same utterance
                          this.calculateWordOverlap(transcriptHash, prevHash) > 0.6;
      
      if (isExtension) {
        console.log(`[DEDUP] Skipping extension transcript while generating (overlap detected): "${transcript.slice(0, 50)}..."`);
        this.sendGuardResetSignal(session, 'in_flight');
        return {
          sessionId,
          sttLatencyMs: 0,
          aiFirstTokenMs: 0,
          ttsFirstByteMs: 0,
          totalLatencyMs: 0,
          sentenceCount: 0,
          audioBytes: 0,
          audioChunkCount: 0,
        };
      }
      
      // Different enough to be a real barge-in - interrupt and continue
      console.log(`[Streaming Orchestrator] BARGE-IN (open mic): User spoke different content while AI generating - interrupting`);
      this.handleInterrupt(sessionId);
    }
    
    // Record this transcript as processed (both session-level and cross-session)
    session.lastProcessedTranscriptHash = transcriptHash;
    session.lastProcessedTranscriptTime = now;
    this.userTranscriptDedup.set(userId, { hash: transcriptHash, time: now });
    
    // SESSION ECONOMICS: Track exchange count for open-mic path
    // STT seconds estimated from transcript length (~3 words/sec speaking rate)
    const estimatedWordCount = transcript.trim().split(/\s+/).length;
    const estimatedOpenMicSttSec = Math.max(1, estimatedWordCount / 3);
    session.telemetrySttSeconds += estimatedOpenMicSttSec;
    session.telemetryStudentSpeakingMs += estimatedOpenMicSttSec * 1000;
    session.telemetryExchangeCount += 1;
    
    // Mark that we're now generating a response
    session.isGenerating = true;
    
    // Student activity detected - reset idle timeout
    this.resetIdleTimeout(session);
    
    const startTime = Date.now();
    const metrics: StreamingMetrics = {
      sessionId,
      sttLatencyMs: 0, // Already done by Deepgram live session
      aiFirstTokenMs: 0,
      ttsFirstByteMs: 0,
      totalLatencyMs: 0,
      sentenceCount: 0,
      audioBytes: 0,
      audioChunkCount: 0,
    };
    
    const responseCompleteSentOpenMic = { sent: false };
    
    try {
      console.log(`[Streaming Orchestrator] Open mic transcript: "${transcript}" (${(confidence * 100).toFixed(0)}%)`);
      
      // SAFETY NET: Check for and fix duplicate patterns in the transcript itself
      // This catches cases where the input arrives already duplicated (e.g., "texttext" instead of "text")
      let sanitizedTranscript = transcript.trim();
      const halfLength = Math.floor(sanitizedTranscript.length / 2);
      if (halfLength > 10) {
        const firstHalf = sanitizedTranscript.substring(0, halfLength);
        const secondHalf = sanitizedTranscript.substring(halfLength);
        // Check if transcript appears to be duplicated (same text repeated without space)
        if (firstHalf === secondHalf) {
          console.warn(`[DUPLICATION FIX] Transcript was duplicated! Using only first half.`);
          console.warn(`[DUPLICATION FIX] Original: "${sanitizedTranscript}" (${sanitizedTranscript.length} chars)`);
          console.warn(`[DUPLICATION FIX] Fixed: "${firstHalf}" (${firstHalf.length} chars)`);
          sanitizedTranscript = firstHalf;  // Use only the first half
        }
      }
      // Replace transcript with sanitized version for rest of processing
      transcript = sanitizedTranscript;
      
      if (!transcript.trim()) {
        console.log('[Streaming Orchestrator] Empty transcript in open mic');
        return metrics;
      }
      
      // CONTENT MODERATION: Check for severely inappropriate content
      if (containsSeverelyInappropriateContent(transcript)) {
        console.log('[Streaming Orchestrator] Content moderation: Severely inappropriate content blocked');
        this.sendMessage(session.ws, {
          type: 'error',
          timestamp: Date.now(),
          code: 'CONTENT_REJECTED',
          message: 'Let\'s keep our conversation focused on language learning!',
          recoverable: true,
        });
        return metrics;
      }
      
      // NEW TURN: Increment turnId for this response
      session.currentTurnId++;
      session.isInterrupted = false;  // Reset interrupt flag for new turn
      session.switchTutorTriggered = false;  // Reset switch flag for new turn
      session.crossLanguageTransferBlocked = false;  // Reset cross-language block for new turn
      session.sentAudioChunks.clear();  // Reset audio deduplication for new turn
      session.sentAudioHashes.clear();  // Reset content-based deduplication for new turn
      session.firstAudioSent = false;   // Reset so whiteboard updates buffer until audio starts
      session.pendingWhiteboardUpdates = [];  // Clear stale pending updates from previous turn
      session.earlyTtsActive = undefined;
      session._ttsTurnCallCount = 0;  // DIAG: Reset TTS call counter for new turn
      const turnId = session.currentTurnId;
      
      // Notify client that processing has started
      this.sendMessage(session.ws, {
        type: 'processing',
        timestamp: Date.now(),
        turnId,
        userTranscript: transcript,
      } as StreamingProcessingMessage);
      
      // Step 2: Stream AI response with sentence chunking
      const aiStart = Date.now();
      (metrics as any)._geminiStartTime = aiStart;
      let firstTokenReceived = false;
      let fullText = '';
      
      // DEDUPLICATION GUARD: Track seen sentences to prevent LLM repetition loops
      const seenSentences = new Set<string>();
      // SAFETY NET: High limit to catch runaway LLM loops, not to cut off natural conversation
      // Daniela should complete her thoughts naturally - this is just a safety limit
      // Founder/Honesty Mode: 30 sentences (essentially unlimited for authentic conversation)
      // Normal mode: 20 sentences (enough for any reasonable explanation)
      const MAX_SENTENCES = (session.isFounderMode || session.isRawHonestyMode) ? 30 : 20;
      let actualSentenceCount = 0;
      
      // Check for architect notes and student learning context in parallel
      const contextBuildStart = Date.now();
      let architectContext = '';
      let studentLearningSection = '';
      let identityMemoriesSection = (session.cachedContext?.identityMemoriesSection) || '';
      let passiveMemorySectionOpenMic = '';  // PASSIVE MEMORY: Auto-retrieved memories based on user message
      session.pendingArchitectNoteIds = [];  // Reset for this turn
      
      // CONTEXT CACHING: Clear previous turn's preamble to prevent stale context bleed
      session.currentTurnPreamble = undefined;
      
      const contextPromises: Promise<void>[] = [];
      
      // Architect notes (if conversationId available)
      if (session.conversationId) {
        contextPromises.push(
          architectVoiceService.buildArchitectContextWithIds(session.conversationId)
            .then(({ context, noteIds }) => {
              architectContext = context;
              session.pendingArchitectNoteIds = noteIds;
              if (architectContext) {
                console.log(`[Streaming Orchestrator] Including ${noteIds.length} architect notes in context (open mic)`);
              }
            })
            .catch(err => console.warn(`[Architect Context] Failed (open mic):`, err.message))
        );
      }
      
      // PROACTIVE STUDENT INTELLIGENCE: Fetch learning context and cross-session history
      // Guard: Only fetch if we have a valid userId (skip for admin/founder-only sessions)
      if (session.userId && session.targetLanguage) {
        const siStartOM = Date.now();
        contextPromises.push(
          Promise.all([
            studentLearningService.getStudentLearningContext(String(session.userId), session.targetLanguage),
            studentLearningService.getCrossSessionContext(String(session.userId), 3)
          ]).then(([learningContext, crossSessionContext]) => {
              if (!learningContext) return; // Guard against null/undefined context
              const learningFormatted = studentLearningService.formatContextForPrompt(learningContext);
              const crossSessionFormatted = studentLearningService.formatCrossSessionContext(crossSessionContext);
              
              if (learningFormatted || crossSessionFormatted) {
                studentLearningSection = `\n\n[STUDENT PROFILE]${learningFormatted}${crossSessionFormatted}`;
                const struggles = learningContext.struggles?.length || 0;
                console.log(`[Student Intelligence] Open mic: ${struggles} struggles, ${crossSessionContext.recentSessions.length} recent sessions`);
                brainHealthTelemetry.logContextInjection({
                  sessionId: session.id, userId: String(session.userId), targetLanguage: session.targetLanguage,
                  contextSource: 'student_intelligence', success: true, latencyMs: Date.now() - siStartOM, richness: struggles,
                }).catch(() => {});
                
                // ADAPTIVE SPEED: Sync session struggle count from persistent data
                const activeStruggles = learningContext.struggles?.filter(s => s.status === 'active') || [];
                if (activeStruggles.length > session.sessionStruggleCount) {
                  session.sessionStruggleCount = activeStruggles.length;
                  console.log(`[Adaptive Speed] Open mic: Synced ${activeStruggles.length} active struggles from student profile`);
                }
              }
            })
            .catch(err => {
              console.warn(`[Student Intelligence] Failed (open mic):`, err.message);
              brainHealthTelemetry.logContextInjection({
                sessionId: session.id, userId: String(session.userId), targetLanguage: session.targetLanguage,
                contextSource: 'student_intelligence', success: false, latencyMs: Date.now() - siStartOM, errorMessage: err.message,
              }).catch(() => {});
            })
        );
        
        // PASSIVE MEMORY INJECTION (OpenMic): Auto-search memories based on user message keywords
        const passiveMemoryKeywordsOpenMic = [
          'remember', 'told you', 'mentioned', 'said', 'last time', 'before',
          'song', 'music', 'band', 'album', 'movie', 'book', 'show',
          'daughter', 'son', 'wife', 'husband', 'mom', 'dad', 'friend',
          'sister', 'brother', 'family', 'boyfriend', 'girlfriend',
          'trip', 'vacation', 'wedding', 'birthday', 'work', 'job', 'school',
          'favorite', 'love', 'hate', 'enjoy', 'like',
        ];
        
        const transcriptLowerOpenMic = transcript.toLowerCase();
        const hasMemoryTriggerOpenMic = passiveMemoryKeywordsOpenMic.some(kw => transcriptLowerOpenMic.includes(kw));
        
        if (hasMemoryTriggerOpenMic) {
          contextPromises.push(
            (async () => {
              try {
                const { searchMemory, formatMemoryForConversation } = await import('./neural-memory-search');
                
                const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'i', 'you', 'we', 'they', 'he', 'she', 'it', 'that', 'this', 'what', 'when', 'where', 'why', 'how', 'my', 'your', 'our', 'their', 'me', 'him', 'her', 'us', 'them', 'about', 'just', 'so', 'really', 'very', 'now', 'then', 'here', 'there', 'some', 'all', 'any', 'more', 'most', 'other', 'over', 'such', 'no', 'not', 'only', 'own', 'same', 'than', 'too', 'can', 'know', 'think', 'want', 'like', 'going', 'get', 'got', 'make', 'made', 'say', 'said', 'go', 'went', 'come', 'came', 'take', 'took', 'see', 'saw', 'look', 'looked', 'one', 'two', 'three', 'four', 'five', 'first', 'last', 'also', 'well', 'if', 'yes', 'no', 'okay', 'yeah', 'hmm', 'um']);
                
                const words = transcript.split(/[\s,.!?;:'"()]+/).filter(w => 
                  w.length >= 3 && !stopWords.has(w.toLowerCase())
                );
                
                if (words.length === 0) return;
                
                const searchQuery = words.slice(0, 4).join(' ');
                
                const memoryResults = await searchMemory(
                  String(session.userId),
                  searchQuery,
                  ['person', 'motivation', 'insight', 'conversation'],
                  session.targetLanguage || undefined
                );
                
                if (memoryResults.results.length > 0) {
                  const formatted = formatMemoryForConversation(memoryResults);
                  passiveMemorySectionOpenMic = `\n\n[RELEVANT MEMORIES - You naturally recall this]\n${formatted}`;
                  console.log(`[Passive Memory - OpenMic] Auto-retrieved ${memoryResults.results.length} memories`);
                }
              } catch (err: any) {
                console.warn(`[Passive Memory - OpenMic] Failed:`, err.message);
              }
            })()
          );
        }
      }
      
      // TIMEOUT: If any individual fetch hangs, don't block the entire turn.
      // Individual fetches already have .catch() so partial context is safe to use.
      const CONTEXT_FETCH_TIMEOUT_OM_MS = 6000;
      await Promise.race([
        Promise.all(contextPromises),
        new Promise<void>(resolve => setTimeout(() => {
          console.warn(`[Context Fetch] OpenMic timeout after ${CONTEXT_FETCH_TIMEOUT_OM_MS}ms — proceeding with partial context. Total wall time so far: ${Date.now() - contextBuildStart}ms`);
          resolve();
        }, CONTEXT_FETCH_TIMEOUT_OM_MS))
      ]);
      const contextBuildMs = Date.now() - contextBuildStart;
      if (contextBuildMs > 100) {
        console.log(`[LATENCY] Context building took ${contextBuildMs}ms (open mic)`);
      }
      
      // BARGE-IN CONTEXT: Let Daniela know the student interrupted her
      let interruptContext = '';
      if (session.lastTurnWasInterrupted) {
        interruptContext = '\n\n[CONTEXT: The student just interrupted you while you were speaking. They clearly have something important to say. Acknowledge what they said naturally without drawing attention to the interruption itself - just respond to their message directly.]';
        session.lastTurnWasInterrupted = false;  // Reset after using
        console.log('[Streaming Orchestrator] Injecting barge-in context for interrupted response');
      }
      
      const userMessageWithNote = transcript + architectContext + interruptContext;
      
      // CONTEXT CACHING OPTIMIZATION (OpenMic): Separate static base from dynamic context
      // Move student learning section to conversation history preamble for caching
      let conversationHistoryWithContext: ConversationHistoryEntry[] = [];
      
      // Build dynamic context parts for OpenMic
      // studentLearningSection, beta tester, incognito, and tech health are now folded into the classroom
      const dynamicContextPartsOpenMic: string[] = [];
      
      const hasFreshCacheOpenMic = session.cachedContext && 
        (Date.now() - session.cachedContext.lastFetchTime) < 5 * 60 * 1000;
      if (hasFreshCacheOpenMic && session.cachedContext?.fatContextProfile) {
        dynamicContextPartsOpenMic.push(session.cachedContext.fatContextProfile);
      }
      if (hasFreshCacheOpenMic && session.cachedContext?.fatContextVocabulary) {
        dynamicContextPartsOpenMic.push(session.cachedContext.fatContextVocabulary);
      }
      if (hasFreshCacheOpenMic && session.cachedContext?.fatContextConversations) {
        dynamicContextPartsOpenMic.push(session.cachedContext.fatContextConversations);
      }
      
      if (passiveMemorySectionOpenMic) {
        dynamicContextPartsOpenMic.push(passiveMemorySectionOpenMic);
      }
      if (identityMemoriesSection) {
        dynamicContextPartsOpenMic.push(identityMemoriesSection);
      }
      
      // CLASSROOM ENVIRONMENT (OpenMic): Daniela's unified workspace via shared pipeline
      // TIMEOUT: Cap at 5s — runs serially, so a hang adds directly to turn latency.
      {
        const CLASSROOM_TIMEOUT_OM_MS = 5000;
        const classroomStartOM = Date.now();
        type ClassroomResultOM = Awaited<ReturnType<typeof buildClassroomDynamicContext>>;
        const classroomTimeoutResultOM: ClassroomResultOM = {
          classroomEnv: null,
          telemetry: { source: 'classroom_timeout', success: false, latencyMs: CLASSROOM_TIMEOUT_OM_MS, richness: 0, errorMessage: 'Timed out after 5s' },
        };
        const { classroomEnv, telemetry } = await Promise.race([
          buildClassroomDynamicContext({
            session: session as any,
            studentLearningSection: studentLearningSection || undefined,
          }),
          new Promise<ClassroomResultOM>(resolve => setTimeout(() => {
            console.warn(`[Classroom] buildClassroomDynamicContext timed out after ${CLASSROOM_TIMEOUT_OM_MS}ms (OpenMic, total wall time: ${Date.now() - contextBuildStart}ms)`);
            resolve(classroomTimeoutResultOM);
          }, CLASSROOM_TIMEOUT_OM_MS))
        ]);
        if (classroomEnv) {
          dynamicContextPartsOpenMic.push(classroomEnv);
          console.log(`[Classroom] Environment injected (OpenMic) — ${telemetry.richness} items in ${Date.now() - classroomStartOM}ms`);
        } else if (telemetry.errorMessage) {
          console.warn(`[Classroom - OpenMic] Failed:`, telemetry.errorMessage);
        }
        brainHealthTelemetry.logContextInjection({
          sessionId: session.id, userId: String(session.userId), targetLanguage: session.targetLanguage,
          contextSource: telemetry.source, success: telemetry.success, latencyMs: telemetry.latencyMs, richness: telemetry.richness,
          ...(telemetry.errorMessage ? { errorMessage: telemetry.errorMessage } : {}),
        }).catch(() => {});
      }
      
      // STEP 1: Add dynamic context preamble via shared pipeline
      conversationHistoryWithContext.push(...assembleDynamicPreamble(dynamicContextPartsOpenMic, 'OpenMic'));
      
      // Store preamble for continuation calls (before adding session history)
      session.currentTurnPreamble = [...conversationHistoryWithContext];
      
      // STEP 2: Add conversation history (capped for prompt size optimization)
      const MAX_HISTORY_ENTRIES_OPENMIC = session.isFounderMode ? 60 : 40;
      const historyToSendOpenMic = session.conversationHistory.length > MAX_HISTORY_ENTRIES_OPENMIC
        ? session.conversationHistory.slice(-MAX_HISTORY_ENTRIES_OPENMIC)
        : session.conversationHistory;
      if (session.conversationHistory.length > MAX_HISTORY_ENTRIES_OPENMIC) {
        console.log(`[History Cap - OpenMic] Trimmed history from ${session.conversationHistory.length} to ${MAX_HISTORY_ENTRIES_OPENMIC} entries`);
      }
      conversationHistoryWithContext.push(...historyToSendOpenMic);
      
      // MESSAGE CHECKPOINTING (OpenMic): Save user message BEFORE Gemini call
      // This ensures user messages are preserved even if Gemini fails/times out
      await this.checkpointUserMessage(session, transcript);
      
      // Abort signal for early stream termination when function call TTS starts (open-mic)
      const streamAbortSignalOpenMic = { aborted: false };
      
      // TTS LOOKAHEAD (OpenMic): Same pipeline as PTT path
      const ttsLookaheadMapOM = new Map<number, Promise<{ audio: Buffer; durationMs: number; timestamps: import('@shared/streaming-voice-types').WordTiming[] } | null>>();
      const effectiveTtsProviderOM = resolveSessionTTSProvider(session.ttsProvider as TTSProviderName | undefined, this.ttsProvider as TTSProviderName);
      const isGoogleBatchModeOM = this.ttsProviderRegistry.getOrThrow(effectiveTtsProviderOM).requiresBatchMode;
      const batchedSentencesOM: { chunk: SentenceChunk; displayText: string; rawText: string }[] = [];
      console.log(`[OpenMic TTS Config] provider=${effectiveTtsProviderOM}, sessionProvider=${session.ttsProvider || 'none'}, fallback=${this.ttsProvider}, batchMode=${isGoogleBatchModeOM}`);
      if (isGoogleBatchModeOM) {
        console.log(`[Google Batch TTS - OpenMic] Batch mode ACTIVE — sentences will be collected and combined for single TTS call`);
      }
      const lookaheadTtsRequestOM = {
        text: '',
        autoDetectLanguage: true,
        targetLanguage: session.targetLanguage,
        nativeLanguage: session.nativeLanguage || 'english',
        geminiLanguageCode: session.geminiLanguageCode,
        voiceId: session.voiceId,
        speakingRate: getAdaptiveSpeakingRate(session),
        vocalStyle: session.voiceOverride?.vocalStyle,
      };
      
      await retryWithBackoff(
        () => this.geminiService.streamWithSentenceChunking({
        systemPrompt: session.systemPrompt,  // STATIC base prompt (cacheable)
        conversationHistory: conversationHistoryWithContext,
        userMessage: userMessageWithNote,
        maxOutputTokens: session.isRawHonestyMode ? 8192 : 4096,
        enableFunctionCalling: true,
        enableContextCaching: true,
        streamFunctionCallArguments: true,
        abortSignal: streamAbortSignalOpenMic,
        onSentenceEnqueued: (chunk: SentenceChunk) => {
          if (effectiveTtsProviderOM !== 'gemini' || session.isInterrupted || streamAbortSignalOpenMic.aborted) return;
          const cleaned = cleanTextForDisplay(chunk.text);
          if (!cleaned || cleaned.length < 2) return;
          const promise = this.geminiLiveTtsService.preGenerateAudio({
            ...lookaheadTtsRequestOM,
            text: cleaned,
            vocalStyle: session.voiceOverride?.vocalStyle,
          } as any).catch(err => {
            console.warn(`[TTS Lookahead OM] Pre-gen failed for sentence ${chunk.index}: ${err.message}`);
            return null;
          });
          ttsLookaheadMapOM.set(chunk.index, promise);
        },
        onPartialFunctionCall: (partial: PartialFunctionCall) => {
          // EARLY INTENT DETECTION (open-mic mode)
          if (partial.name === 'switch_tutor' && !partial.isComplete) {
            const earlyTarget = partial.accumulatedArgs.target as string | undefined;
            if (earlyTarget) {
              console.log(`[Early Intent - OpenMic] switch_tutor #${partial.callIndex} detected, target: ${earlyTarget}`);
            }
          }
          if (partial.isComplete) {
            console.log(`[Early Intent - OpenMic] ${partial.name} #${partial.callIndex} complete`);
          }
        },
        onFunctionCall: async (functionCalls: ExtractedFunctionCall[]) => {
          if (!session.currentTurnThoughtSignatures) {
            session.currentTurnThoughtSignatures = [];
          }
          if (!session.currentTurnFunctionCalls) {
            session.currentTurnFunctionCalls = [];
          }
          
          const METADATA_ONLY_FC_NAMES = new Set(['voice_adjust', 'voice_reset', 'word_emphasis', 'subtitle', 'show_overlay', 'hide_overlay', 'hold_overlay', 'take_note', 'milestone']);
          const allMetadataOnly = functionCalls.every(fc => METADATA_ONLY_FC_NAMES.has(fc.name));
          const hasTextArg = functionCalls.some(fc => fc.args?.text && String(fc.args.text).trim().length > 0);
          
          if (allMetadataOnly && hasTextArg && !session.isInterrupted) {
            session.earlyTtsActive = true;
            console.log(`[FC OpenMic] earlyTtsActive=true, TTS deferred to post-stream (${functionCalls.map(f => f.name).join(',')})`);
          }
          
          if (!firstTokenReceived) {
            metrics.aiFirstTokenMs = Date.now() - aiStart;
            firstTokenReceived = true;
            console.log(`[FC OpenMic] AI first token (via FC): ${metrics.aiFirstTokenMs}ms`);
          }
          
          for (const fn of functionCalls) {
            console.log(`[Native Function Call - OpenMic] ${fn.name}(${JSON.stringify(fn.args)})`);
            
            if (fn.thoughtSignature) {
              session.currentTurnThoughtSignatures.push(fn.thoughtSignature);
              console.log(`[Thought Signature - OpenMic] Collected signature for ${fn.name} (${session.currentTurnThoughtSignatures.length} total)`);
            }
            
            session.currentTurnFunctionCalls.push(fn);
            
            await this.fcHandler.handle(sessionId, session, fn).catch(err => {
              console.error(`[Native Function Call - OpenMic] Error handling ${fn.name}:`, err.message);
            });
          }
          
          if (allMetadataOnly && hasTextArg && !session.isInterrupted) {
            streamAbortSignalOpenMic.aborted = true;
            console.log(`[FC OpenMic] Callback complete — abort signal set, TTS deferred to post-stream path`);
          }
        },
        onSentence: async (chunk: SentenceChunk) => {
          if (session.earlyTtsActive || streamAbortSignalOpenMic.aborted) {
            console.log(`[Streaming Orchestrator] Skipping onSentence ${chunk.index} - FC callback active/aborted (open mic)`);
            return;
          }
          
          // BARGE-IN CHECK: Stop processing if user interrupted
          if (session.isInterrupted) {
            console.log(`[Streaming Orchestrator] Skipping sentence ${chunk.index} - user barged in (open mic)`);
            return;
          }
          
          if (!firstTokenReceived) {
            metrics.aiFirstTokenMs = Date.now() - aiStart;
            firstTokenReceived = true;
            console.log(`[Streaming Orchestrator] AI first token: ${metrics.aiFirstTokenMs}ms`);
            
            // ECHO SUPPRESSION: Notify OpenMic to suppress transcripts while TTS plays
            // Clear any pending post-TTS suppression release from a previous response
            if (session.postTtsSuppressionTimer) {
              clearTimeout(session.postTtsSuppressionTimer);
              session.postTtsSuppressionTimer = null;
            }
            session.onTtsStateChange?.(true);
          }
          
          // PARSE WHITEBOARD FIRST (before early returns) to ensure commands are always processed
          // This is critical for SWITCH_TUTOR and other commands that may have no speakable text
          const whiteboardParsed = parseWhiteboardMarkup(chunk.text);
          
          // DEBUG: Trace whiteboard parsing for command tags in open-mic mode
          if (chunk.text.includes('[SWITCH_TUTOR') || chunk.text.includes('[CALL_SUPPORT') || chunk.text.includes('[PHASE_SHIFT')) {
            console.log(`[Whiteboard Parse DEBUG - OpenMic] Chunk ${chunk.index} text: "${chunk.text.substring(0, 100)}..."`);
            console.log(`[Whiteboard Parse DEBUG - OpenMic] Items found: ${whiteboardParsed.whiteboardItems.length}`);
            console.log(`[Whiteboard Parse DEBUG - OpenMic] Item types: ${whiteboardParsed.whiteboardItems.map(i => i.type).join(', ') || 'none'}`);
          }
          
          const displayText = cleanTextForDisplay(chunk.text);
          
          // UNIFIED COMMAND ROUTING (Open-mic mode):
          // Process ALL action commands through command-parser for consistent single-execution
          const openMicCommandResult = commandParserService.parse(chunk.text);
          
          // TEXT-BASED FUNCTION CALL FALLBACK: Gemini sometimes writes function calls as literal text
          // e.g. "FUNCTION CALL: switch_tutor({ target: "male" })" instead of using native tool calls
          // Parse these and inject them as commands so they still execute
          const textFcHeader = chunk.text.match(/FUNCTION\s+CALL\s*:\s*(\w+)\s*\(\s*\{/i);
          const fcArgsRaw = textFcHeader ? extractBalancedBraces(chunk.text, textFcHeader.index! + textFcHeader[0].length - 1) : null;
          if (textFcHeader && fcArgsRaw && openMicCommandResult.commands.length === 0) {
            const fcName = textFcHeader[1].toLowerCase();
            console.log(`[Text FC Fallback - OpenMic] Detected text-based function call: ${fcName}(${fcArgsRaw.substring(0, 80)})`);
            const fcArgs = parseTextFcArgs(fcArgsRaw);
            if (fcArgs) {
              const cmdType = TEXT_FC_COMMAND_MAP[fcName];
              if (cmdType) {
                openMicCommandResult.commands.push({
                  type: cmdType as any,
                  params: fcArgs,
                  source: 'text_fc_fallback' as any,
                });
                console.log(`[Text FC Fallback - OpenMic] Injected command: ${cmdType}(${JSON.stringify(fcArgs)})`);
              }
            }
          }
          
          if (openMicCommandResult.commands.length > 0) {
            console.log(`[CommandParser - OpenMic] Detected ${openMicCommandResult.commands.length} commands in chunk ${chunk.index}:`,
              openMicCommandResult.commands.map(c => `${c.type}(${c.source})`));
          }
          
          for (const cmd of openMicCommandResult.commands) {
            switch (cmd.type) {
              case 'SWITCH_TUTOR': {
                const target = cmd.params.target as string;
                if (!session.pendingTutorSwitch && !session.crossLanguageTransferBlocked && target) {
                  const targetGender = target as 'male' | 'female';
                  let resolvedLanguage = cmd.params.language as string | undefined;
                  if (!resolvedLanguage && session.tutorDirectory && session.targetLanguage) {
                    resolvedLanguage = inferLanguageFromTutorName(chunk.text, targetGender, session.targetLanguage, session.tutorDirectory);
                  }
                  session.pendingTutorSwitch = { targetGender, targetLanguage: resolvedLanguage, targetRole: cmd.params.role as 'tutor' | 'assistant' | undefined };
                  session.switchTutorTriggered = true;
                  console.log(`[CommandParser→TutorSwitch - OpenMic] Queued handoff to ${target}${resolvedLanguage ? ` (${resolvedLanguage})` : ''}`);
                }
                break;
              }
              case 'PHASE_SHIFT': {
                const to = cmd.params.to as string;
                const reason = cmd.params.reason as string;
                if (to && reason) {
                  this.enrichment.processPhaseShift(session, { to: to as any, reason }).catch(err => console.error(`[CommandParser→PhaseShift - OpenMic] Error:`, err));
                  console.log(`[CommandParser→PhaseShift - OpenMic] ${to} - ${reason}`);
                }
                break;
              }
              case 'ACTFL_UPDATE': {
                const level = cmd.params.level as string;
                if (level) {
                  this.enrichment.processActflUpdate(session, { level, confidence: (cmd.params.confidence as number) || 0.8, reason: (cmd.params.reason as string) || 'Observed in conversation', direction: cmd.params.direction as any }).catch(err => console.error(`[CommandParser→ActflUpdate - OpenMic] Error:`, err));
                  console.log(`[CommandParser→ActflUpdate - OpenMic] Level: ${level}`);
                }
                break;
              }
              case 'SYLLABUS_PROGRESS': {
                const topic = cmd.params.topic as string;
                const status = cmd.params.status as string;
                if (topic && status) {
                  this.enrichment.processSyllabusProgress(session, { topic, status: status as any, evidence: (cmd.params.evidence as string) || 'Observed' }).catch(err => console.error(`[CommandParser→SyllabusProgress - OpenMic] Error:`, err));
                }
                break;
              }
              case 'CHECK_STUDENT_CREDITS': {
                console.log(`[CommandParser→CheckCredits - OpenMic] Credit check via ${cmd.source} (delegating to native handler)`);
                break;
              }
              case 'CALL_SUPPORT':
              case 'CALL_SOFIA': {
                const category = cmd.params.category as string;
                if (category && !session.pendingSupportHandoff) {
                  session.pendingSupportHandoff = { category, reason: cmd.params.reason as string | undefined };
                  console.log(`[CommandParser→Support - OpenMic] Queued: ${category}`);
                }
                break;
              }
              case 'CALL_ASSISTANT': {
                const drillType = cmd.params.type as string;
                const focus = cmd.params.focus as string;
                const items = cmd.params.items as string;
                if (drillType && focus && items && !session.pendingAssistantHandoff) {
                  const itemsList = items.split(',').map(s => s.trim()).filter(Boolean);
                  this.fcHandler.processAssistantHandoff(session, { drillType: drillType as any, focus, items: itemsList, priority: cmd.params.priority as any }, turnId).catch(err => console.error(`[CommandParser→AssistantHandoff - OpenMic] Error:`, err));
                  session.pendingAssistantHandoff = { drillType: drillType as any, focus, items: itemsList, priority: cmd.params.priority as any };
                  console.log(`[CommandParser→AssistantHandoff - OpenMic] Delegated: ${drillType} for "${focus}"`);
                }
                break;
              }
              case 'SUBTITLE': {
                const mode = (cmd.params.mode as string)?.toLowerCase();
                const customText = cmd.params.text as string | undefined;
                
                if (mode === 'custom' && customText) {
                  session.customOverlayText = customText;
                  console.log(`[CommandParser→Subtitle - OpenMic] Custom: "${customText.substring(0, 50)}..."`);
                  this.sendMessage(session.ws, {
                    type: 'custom_overlay',
                    text: customText,
                    action: 'show',
                    timestamp: Date.now(),
                  } as any, session);
                } else if (mode && ['off', 'on', 'target'].includes(mode)) {
                  const validMode = mode === 'on' ? 'all' : mode as 'off' | 'all' | 'target';
                  session.subtitleMode = validMode;
                  console.log(`[CommandParser→Subtitle - OpenMic] Mode: ${validMode}`);
                  this.sendMessage(session.ws, {
                    type: 'subtitle_mode_change',
                    mode: validMode,
                    timestamp: Date.now(),
                  } as any, session);
                  console.log(`[CommandParser→Subtitle - OpenMic] ✓ Sent via sendMessage: ${validMode}`);
                }
                break;
              }
              case 'SHOW': {
                const text = cmd.params.text as string;
                if (text) {
                  session.customOverlayText = text;
                  console.log(`[CommandParser→Show - OpenMic] Custom overlay: "${text.substring(0, 50)}..."`);
                  
                  // Send WebSocket message to client to display custom overlay
                  if (session.ws.readyState === 1) {
                    session.ws.send(JSON.stringify({
                      type: 'custom_overlay',
                      text: text,
                      action: 'show',
                      timestamp: Date.now(),
                    }));
                    console.log(`[CommandParser→Show - OpenMic] Sent custom_overlay to client`);
                  }
                }
                break;
              }
              case 'HIDE': {
                session.customOverlayText = undefined;
                console.log(`[CommandParser→Hide - OpenMic] Custom overlay hidden`);
                
                // Send WebSocket message to client to hide custom overlay
                if (session.ws.readyState === 1) {
                  session.ws.send(JSON.stringify({
                    type: 'custom_overlay',
                    action: 'hide',
                    timestamp: Date.now(),
                  }));
                  console.log(`[CommandParser→Hide - OpenMic] Sent custom_overlay hide to client`);
                }
                break;
              }
              case 'TEXT_INPUT': {
                const prompt = cmd.params.prompt as string;
                if (prompt) {
                  session.pendingTextInput = { prompt };
                  console.log(`[CommandParser→TextInput - OpenMic] Requested: "${prompt.substring(0, 50)}..."`);
                  
                  // Send WebSocket message to client to request text input
                  if (session.ws.readyState === 1) {
                    session.ws.send(JSON.stringify({
                      type: 'text_input_request',
                      prompt: prompt,
                      timestamp: Date.now(),
                    }));
                    console.log(`[CommandParser→TextInput - OpenMic] Sent text_input_request to client`);
                  }
                }
                break;
              }
              case 'CLEAR': {
                session.commandParserClear = true;
                session.classroomWhiteboardItems = [];
                console.log(`[CommandParser→Clear - OpenMic] Whiteboard clear requested via ${cmd.source} format (classroom tracking reset)`);
                break;
              }
              case 'HOLD': {
                // Prevent whiteboard auto-clear - set session flag for inclusion in whiteboard_update message
                session.commandParserHold = true;
                console.log(`[CommandParser→Hold - OpenMic] Whiteboard hold requested via ${cmd.source} format`);
                break;
              }
              case 'HIVE': {
                if (session.isIncognito) {
                  console.log(`[CommandParser→Hive - OpenMic] INCOGNITO - skipping hive suggestion`);
                  break;
                }
                const category = cmd.params.category as string;
                const title = cmd.params.title as string;
                const description = cmd.params.description as string;
                if (category && title && description) {
                  this.fcHandler.processHiveSuggestion(session, {
                    category,
                    title,
                    description,
                    reasoning: cmd.params.reasoning as string | undefined,
                    priority: cmd.params.priority as number | undefined,
                  }).catch(err => console.error(`[CommandParser→Hive - OpenMic] Error:`, err));
                  console.log(`[CommandParser→Hive - OpenMic] Posted: "${title}" (${category})`);
                }
                break;
              }
              case 'FIRST_MEETING_COMPLETE': {
                // Daniela signals she knows the student well enough
                const summary = cmd.params.summary as string | undefined;
                if (session.userId && !session.isIncognito) {
                  try {
                    await storage.updateUser(session.userId, { hasCompletedFirstMeeting: true });
                    console.log(`[CommandParser→FirstMeeting - OpenMic] Marked complete for user ${session.userId}`);
                    if (session.hiveChannelId) {
                      hiveCollaborationService.emitBeacon({
                        channelId: session.hiveChannelId,
                        tutorTurn: `[FIRST_MEETING_COMPLETE] Daniela completed "getting to know you" phase.${summary ? `\n\nSummary: ${summary}` : ''}`,
                      });
                    }
                  } catch (err) {
                    console.error(`[CommandParser→FirstMeeting - OpenMic] Error:`, err);
                  }
                } else if (session.isIncognito) {
                  console.log(`[CommandParser→FirstMeeting - OpenMic] INCOGNITO - skipping`);
                }
                break;
              }
              case 'TAKE_NOTE': {
                // Daniela's personal notebook - DIRECT INSERT, no approval required
                if (session.isIncognito) {
                  console.log(`[CommandParser→TakeNote - OpenMic] INCOGNITO - skipping note persistence`);
                  break;
                }
                const noteType = cmd.params.type as string | undefined;
                const title = cmd.params.title as string | undefined;
                const noteContent = cmd.params.content as string | undefined;
                const language = cmd.params.language as string | undefined;
                const tagsStr = cmd.params.tags as string | undefined;
                
                if (noteType && title && noteContent) {
                  const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()) : undefined;
                  
                  console.log(`[CommandParser→TakeNote - OpenMic] ${noteType}: "${title.substring(0, 40)}..."`);
                  
                  storage.insertDanielaNote({
                    noteType: noteType as any,
                    title,
                    content: noteContent,
                    language: language || session.targetLanguage || 'spanish',
                    sessionId: session.id,
                    tags,
                  }).then(noteId => {
                    console.log(`[CommandParser→TakeNote - OpenMic] ✓ Saved note ${noteId}`);
                    
                    if (session.hiveChannelId) {
                      hiveCollaborationService.emitBeacon({
                        channelId: session.hiveChannelId,
                        tutorTurn: `[TAKE_NOTE] ${noteType}: "${title}"\n${noteContent.substring(0, 200)}${noteContent.length > 200 ? '...' : ''}`,
                        beaconType: 'take_note',
                        beaconReason: `Daniela wrote a note: ${title}`,
                      }).catch(err => console.error(`[CommandParser→TakeNote - OpenMic] Beacon error:`, err));
                    }
                  }).catch(err => {
                    console.error(`[CommandParser→TakeNote - OpenMic] Error:`, err.message);
                  });
                }
                break;
              }
              case 'SELF_SURGERY': {
                // Daniela's self-reporting tool — she can notice and propose improvements to her own neural network
                // IDENTITY WHOLENESS: Unlocked for ALL sessions so Daniela can spot real gaps while teaching real students
                const target = cmd.params.target as string;
                const surgeryContent = cmd.params.content;
                const reasoning = cmd.params.reasoning as string;
                
                if (target && surgeryContent && reasoning) {
                  let parsedContent: Record<string, unknown>;
                  try {
                    parsedContent = typeof surgeryContent === 'string' ? JSON.parse(surgeryContent) : surgeryContent as Record<string, unknown>;
                  } catch (parseErr) {
                    console.error(`[CommandParser→SelfSurgery - OpenMic] Invalid JSON content:`, parseErr);
                    break;
                  }
                  
                  const priority = (cmd.params.priority as number) || 50;
                  const confidence = (cmd.params.confidence as number) || 70;
                  
                  // Emit Hive beacon for founder visibility
                  if (session.hiveChannelId) {
                    const contentPreview = JSON.stringify(parsedContent).substring(0, 300);
                    hiveCollaborationService.emitBeacon({
                      channelId: session.hiveChannelId,
                      tutorTurn: `[SELF_SURGERY PROPOSAL]\nTarget: ${target}\nPriority: ${priority}, Confidence: ${confidence}\nReasoning: ${reasoning}\n\nContent: ${contentPreview}...`,
                      studentTurn: transcript || '',
                      beaconType: 'self_surgery_proposal',
                      beaconReason: `Daniela proposed neural network modification: ${target}`,
                    }).catch(err => console.error(`[CommandParser→SelfSurgery - OpenMic] Beacon error:`, err));
                  }
                  
                  this.fcHandler.processSelfSurgery(session, {
                    targetTable: target as import('@shared/whiteboard-types').SelfSurgeryTarget,
                    content: parsedContent,
                    reasoning,
                    priority,
                    confidence,
                  }).catch(err => console.error(`[CommandParser→SelfSurgery - OpenMic] Error:`, err));
                  console.log(`[CommandParser→SelfSurgery - OpenMic] Proposal for ${target}`);
                }
                break;
              }
              case 'MEMORY_LOOKUP': {
                // On-demand neural memory search - supports student memory, teaching knowledge, AND syllabus lookup
                const query = cmd.params.query as string;
                const domainsStr = cmd.params.domains as string | undefined;
                
                if (query) {
                  const rawDomains = domainsStr 
                    ? domainsStr.split(',').map(d => d.trim().toLowerCase())
                    : [];
                  
                  const studentDomains = ['person', 'motivation', 'insight', 'struggle', 'session', 'progress'];
                  const teachingDomains = ['idiom', 'cultural', 'procedure', 'principle', 'error-pattern', 'situational-pattern', 'subtlety-cue', 'emotional-pattern', 'creativity-template'];
                  const syllabusDomains = ['syllabus'];
                  
                  const requestedStudentDomains = rawDomains.filter(d => studentDomains.includes(d)) as ('person' | 'motivation' | 'insight' | 'struggle' | 'session' | 'progress')[];
                  const requestedTeachingDomains = rawDomains.filter(d => teachingDomains.includes(d)) as ('idiom' | 'cultural' | 'procedure' | 'principle' | 'error-pattern' | 'situational-pattern' | 'subtlety-cue' | 'emotional-pattern' | 'creativity-template')[];
                  const requestedSyllabusDomains = rawDomains.filter(d => syllabusDomains.includes(d));
                  
                  const searchStudentMemory = requestedStudentDomains.length > 0 || rawDomains.length === 0;
                  const searchTeachingKnowledgeFlag = requestedTeachingDomains.length > 0 || rawDomains.length === 0;
                  const searchSyllabi = requestedSyllabusDomains.length > 0 || rawDomains.length === 0;
                  
                  try {
                    const { searchMemory, formatMemoryForConversation, searchTeachingKnowledge: searchTeaching, formatTeachingKnowledge, searchSyllabi: searchSyllabiFunc, formatSyllabusSearch } = await import('./neural-memory-search');
                    
                    const results: string[] = [];
                    let totalFound = 0;
                    const studentId = String(session.userId);
                    
                    if (searchStudentMemory && studentId) {
                      const studentDomainFilter = requestedStudentDomains.length > 0 ? requestedStudentDomains : undefined;
                      const memoryResults = await searchMemory(studentId, query, studentDomainFilter, session.targetLanguage || undefined);
                      if (memoryResults.results.length > 0) {
                        results.push(formatMemoryForConversation(memoryResults));
                        totalFound += memoryResults.results.length;
                      }
                    }
                    
                    // Search teaching knowledge if applicable
                    let teachingResults: Awaited<ReturnType<typeof searchTeaching>> | null = null;
                    let formattedTeachingKnowledge = '';
                    const searchStartTime = Date.now();
                    
                    if (searchTeachingKnowledgeFlag) {
                      const teachingDomainFilter = requestedTeachingDomains.length > 0 ? requestedTeachingDomains : undefined;
                      teachingResults = await searchTeaching(query, session.targetLanguage || undefined, teachingDomainFilter);
                      if (teachingResults.results.length > 0) {
                        formattedTeachingKnowledge = formatTeachingKnowledge(teachingResults);
                        results.push(formattedTeachingKnowledge);
                        totalFound += teachingResults.results.length;
                      }
                      
                      // Emit telemetry for neural network monitoring
                      const searchDurationMs = Date.now() - searchStartTime;
                      const domainCounts = teachingResults.results.reduce((acc, r) => {
                        acc[r.domain] = (acc[r.domain] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>);
                      
                      getSharedDb().insert(neuralNetworkTelemetry).values({
                        voiceSessionId: session.id,
                        userId: session.userId,
                        targetLanguage: session.targetLanguage || null,
                        query,
                        domainsSearched: teachingResults.domainsSearched,
                        domainsRequested: teachingDomainFilter || null,
                        resultCount: teachingResults.results.length,
                        formattedCharacterLength: formattedTeachingKnowledge.length,
                        idiomCount: domainCounts['idiom'] || 0,
                        culturalCount: domainCounts['cultural'] || 0,
                        procedureCount: domainCounts['procedure'] || 0,
                        principleCount: domainCounts['principle'] || 0,
                        errorPatternCount: domainCounts['error-pattern'] || 0,
                        situationalPatternCount: domainCounts['situational-pattern'] || 0,
                        subtletyCueCount: domainCounts['subtlety-cue'] || 0,
                        emotionalPatternCount: domainCounts['emotional-pattern'] || 0,
                        creativityTemplateCount: domainCounts['creativity-template'] || 0,
                        searchDurationMs,
                      }).catch(err => console.error('[NeuralTelemetry - OpenMic] Insert error:', err));
                    }
                    
                    // Search syllabi/curriculum if applicable (Founder/Honesty mode syllabus access)
                    if (searchSyllabi) {
                      const syllabusResults = await searchSyllabiFunc(query, session.targetLanguage || undefined);
                      if (syllabusResults.results.length > 0) {
                        const formattedSyllabi = formatSyllabusSearch(syllabusResults);
                        results.push(formattedSyllabi);
                        totalFound += syllabusResults.results.length;
                        console.log(`[CommandParser→MemoryLookup - OpenMic] Syllabus search found ${syllabusResults.results.length} results for "${query}"`);
                      }
                    }
                    
                    if (results.length > 0) {
                      const combinedResults = results.join('\n\n');
                      if (session.conversationHistory) {
                        session.conversationHistory.push({
                          role: 'user',
                          content: `[SYSTEM: Memory recall results for "${query}"]\n${combinedResults}`,
                        });
                      }
                      console.log(`[CommandParser→MemoryLookup - OpenMic] Found ${totalFound} results for "${query}" (syllabus: ${searchSyllabi})`);
                    } else {
                      console.log(`[CommandParser→MemoryLookup - OpenMic] No results found for "${query}"`);
                    }
                  } catch (err) {
                    console.error(`[CommandParser→MemoryLookup - OpenMic] Error:`, err);
                  }
                }
                break;
              }
              case 'EXPRESS_LANE_LOOKUP': {
                // On-demand Express Lane history search - only in Founder/Honesty mode (OpenMic path)
                const query = cmd.params.query as string;
                const sessionIdParam = cmd.params.sessionId as string | undefined;
                const limit = (cmd.params.limit as number) || 20;
                
                if (!session.isFounderMode && !session.isRawHonestyMode) {
                  console.log(`[CommandParser→ExpressLaneLookup - OpenMic] Rejected - not in Founder/Honesty mode`);
                  break;
                }
                
                try {
                  const { collaborationMessages } = await import('@shared/schema');
                  const sharedDb = getSharedDb();
                  
                  let results: any[];
                  
                  if (query) {
                    const keywords = query.split(/\s+/).filter(w => w.length >= 3);
                    const keywordConditions = keywords.length > 0
                      ? sql.join(keywords.map(kw => sql`content ILIKE ${`%${kw}%`}`), sql` OR `)
                      : sql`content ILIKE ${`%${query}%`}`;
                    
                    if (sessionIdParam) {
                      results = await sharedDb.select()
                        .from(collaborationMessages)
                        .where(sql`session_id = ${sessionIdParam} AND (${keywordConditions})`)
                        .orderBy(sql`created_at DESC`)
                        .limit(limit);
                    } else {
                      results = await sharedDb.select()
                        .from(collaborationMessages)
                        .where(keywordConditions)
                        .orderBy(sql`created_at DESC`)
                        .limit(limit);
                    }
                    console.log(`[CommandParser→ExpressLaneLookup - OpenMic] Keyword search for "${query}"`);
                  } else {
                    if (sessionIdParam) {
                      results = await sharedDb.select()
                        .from(collaborationMessages)
                        .where(sql`session_id = ${sessionIdParam}`)
                        .orderBy(sql`created_at DESC`)
                        .limit(limit);
                    } else {
                      results = await sharedDb.select()
                        .from(collaborationMessages)
                        .orderBy(sql`created_at DESC`)
                        .limit(limit);
                    }
                    console.log(`[CommandParser→ExpressLaneLookup - OpenMic] Browse mode — fetching ${limit} most recent messages`);
                  }
                  
                  const label = query ? `search results for "${query}"` : `${results.length} most recent messages (browse mode)`;
                  
                  if (results.length > 0) {
                    const chronological = [...results].reverse();
                    const formattedResults = chronological.map(msg => {
                      const date = new Date(msg.createdAt).toLocaleDateString();
                      const preview = msg.content.length > 2000 ? msg.content.substring(0, 2000) + '...[truncated]' : msg.content;
                      return `[${date}] ${msg.role}: ${preview}`;
                    }).join('\n\n---\n\n');
                    
                    if (session.conversationHistory) {
                      session.conversationHistory.push({
                        role: 'user',
                        content: `[SYSTEM: Express Lane ${label}]\n\n${formattedResults}`,
                      });
                    }
                    console.log(`[CommandParser→ExpressLaneLookup - OpenMic] Found ${results.length} messages`);
                  } else {
                    console.log(`[CommandParser→ExpressLaneLookup - OpenMic] No results found`);
                  }
                } catch (err) {
                  console.error(`[CommandParser→ExpressLaneLookup - OpenMic] Error:`, err);
                }
                break;
              }
              case 'EXPRESS_LANE_POST': {
                // Post message to Express Lane collaboration channel - only in Founder/Honesty mode
                const message = cmd.params.message as string;
                const topic = cmd.params.topic as string | undefined;
                
                if (!session.isFounderMode && !session.isRawHonestyMode) {
                  console.log(`[CommandParser→ExpressLanePost - OpenMic] Rejected - not in Founder/Honesty mode`);
                  break;
                }
                
                if (message) {
                  this.fcHandler.processExpressLanePost(session, message, topic).catch(err => {
                    console.error(`[CommandParser→ExpressLanePost - OpenMic] Error:`, err);
                  });
                  console.log(`[CommandParser→ExpressLanePost - OpenMic] Posted${topic ? ` [${topic}]` : ''}: "${message.substring(0, 80)}..."`);
                }
                break;
              }
              case 'VOICE_ADJUST': {
                // Apply voice override for next TTS synthesis
                const speed = (cmd.params.speed as string | undefined)?.toLowerCase();
                const emotion = (cmd.params.emotion as string | undefined)?.toLowerCase();
                const personality = (cmd.params.personality as string | undefined)?.toLowerCase();
                
                const speedMap: Record<string, number> = { 'slowest': 0.7, 'slow': 0.8, 'normal': 0.9, 'fast': 1.05, 'fastest': 1.2 };
                const emotionMap: Record<string, string> = {
                  'positivity': 'happy', 'curiosity': 'curious', 'surprise': 'surprised', 'anger': 'neutral', 'sadness': 'thoughtful',
                  'happy': 'happy', 'excited': 'excited', 'friendly': 'friendly', 'curious': 'curious', 'thoughtful': 'thoughtful',
                  'warm': 'warm', 'playful': 'playful', 'surprised': 'surprised', 'proud': 'proud', 'encouraging': 'encouraging',
                  'calm': 'calm', 'neutral': 'neutral',
                };
                const validPersonalities = ['warm', 'calm', 'energetic', 'professional'];
                const validatedPersonality = personality && validPersonalities.includes(personality) ? personality : undefined;
                const mappedEmotion = emotion ? emotionMap[emotion] : undefined;
                
                const currentOverride = session.voiceOverride || {};
                session.voiceOverride = {
                  ...currentOverride,
                  ...(speed && { speakingRate: speedMap[speed] || 0.9 }),
                  ...(mappedEmotion && { emotion: mappedEmotion }),
                  ...(validatedPersonality && { personality: validatedPersonality }),
                };
                console.log(`[CommandParser→VoiceAdjust - OpenMic] Applied: speed=${speed || 'unchanged'}, emotion=${mappedEmotion || 'unchanged'}`);
                break;
              }
              case 'VOICE_RESET': {
                // Reset voice to tutor's baseline settings
                if (session.voiceDefaults) {
                  session.voiceOverride = {
                    speakingRate: session.voiceDefaults.speakingRate,
                    emotion: session.voiceDefaults.emotion,
                    personality: session.voiceDefaults.personality,
                    expressiveness: session.voiceDefaults.expressiveness,
                  };
                } else {
                  session.voiceOverride = undefined;
                }
                console.log(`[CommandParser→VoiceReset - OpenMic] Reset to defaults`);
                break;
              }
            }
          }
          
          // Send whiteboard updates BEFORE early returns (including CLEAR/HOLD handling)
          // This ensures visual feedback is always sent, even for command-only chunks
          const visualWhiteboardItems = whiteboardParsed.whiteboardItems.filter(
            item => !['switch_tutor', 'actfl_update', 'syllabus_progress', 'phase_shift', 'call_support', 'call_assistant', 'hive', 'self_surgery'].includes(item.type)
          );
          
          // Combine whiteboard parser flags with command parser flags (JSON ACTION_TRIGGERS)
          const openMicShouldClear = whiteboardParsed.shouldClear || session.commandParserClear;
          const openMicShouldHold = whiteboardParsed.shouldHold || session.commandParserHold;
          
          // Clear the command parser flags after use (one-shot)
          if (session.commandParserClear) session.commandParserClear = false;
          if (session.commandParserHold) session.commandParserHold = false;
          
          if (visualWhiteboardItems.length > 0 || openMicShouldClear || openMicShouldHold) {
            this.sendMessage(session.ws, {
              type: 'whiteboard_update',
              timestamp: Date.now(),
              turnId,
              items: visualWhiteboardItems,
              shouldClear: openMicShouldClear,
              shouldHold: openMicShouldHold,
            } as StreamingWhiteboardMessage);
          }
          
          // EARLY EXIT: If SWITCH_TUTOR was triggered, stop synthesizing further sentences
          if (session.switchTutorTriggered) {
            console.log(`[Tutor Switch] Open-mic: Skipping sentence ${chunk.index} - new tutor will speak`);
            return;
          }
          
          // Now handle early returns for deduplication/limits (after commands and whiteboard are processed)
          if (!displayText) {
            console.log(`[OpenMic] Sentence ${chunk.index} skipped: empty displayText after cleaning (raw: "${chunk.text.substring(0, 60)}")`);
            return;
          }
          
          const normalizedText = displayText.toLowerCase().trim();
          if (seenSentences.has(normalizedText)) {
            console.log(`[OpenMic] Sentence ${chunk.index} skipped: duplicate text "${displayText.substring(0, 40)}"`);
            return;
          }
          seenSentences.add(normalizedText);
          
          if (actualSentenceCount >= MAX_SENTENCES) {
            console.log(`[OpenMic] Sentence ${chunk.index} skipped: reached MAX_SENTENCES (${MAX_SENTENCES})`);
            return;
          }
          actualSentenceCount++;
          
          // Extract target language with word mapping
          const boldWords = extractBoldMarkedWords(chunk.text || '');
          const extraction = extractTargetLanguageWithMapping(displayText, boldWords);
          const wordMappingArray: [number, number][] = extraction.wordMapping.size > 0
            ? Array.from(extraction.wordMapping.entries())
            : [];
          const hasTargetContent = !!(extraction.targetText && extraction.targetText.trim().length > 0);
          
          if (boldWords.length > 0) {
            this.fcHandler.addSttKeyterms(session, boldWords);
          }
          
          console.log(`[SENTENCE_START EMIT - OpenMic] sentence=${chunk.index}, hasTarget=${hasTargetContent}, displayText="${displayText.substring(0, 60)}", batchMode=${isGoogleBatchModeOM}, earlyTtsActive=${session.earlyTtsActive || false}`);
          
          if (isGoogleBatchModeOM) {
            if (displayText.trim().length > 1) {
              batchedSentencesOM.push({ chunk, displayText, rawText: chunk.text });
              console.log(`[Google Batch - OpenMic] Deferred sentence ${chunk.index} to batch (${batchedSentencesOM.length} total)`);
            } else {
              console.log(`[Google Batch - OpenMic] Skipping empty sentence ${chunk.index} from batch (cleaned to: "${displayText}")`);
            }
          } else {
            console.log(`[INDIVIDUAL TTS - OpenMic] Sentence ${chunk.index}: starting individual TTS (non-batch path), earlyTtsActive=${session.earlyTtsActive || false}`);
            this.sendMessage(session.ws, {
              type: 'sentence_start',
              timestamp: Date.now(),
              turnId,
              sentenceIndex: chunk.index,
              text: displayText,
              hasTargetContent,
              targetLanguageText: hasTargetContent ? extraction.targetText : undefined,
              wordMapping: hasTargetContent && wordMappingArray.length > 0 ? wordMappingArray : undefined,
            } as StreamingSentenceStartMessage);
            
            const lookaheadPromiseOM = ttsLookaheadMapOM.get(chunk.index);
            ttsLookaheadMapOM.delete(chunk.index);
            
            if (lookaheadPromiseOM) {
              const preGenResultOM = await lookaheadPromiseOM;
              if (preGenResultOM) {
                console.log(`[TTS Lookahead OM] Using pre-generated audio for sentence ${chunk.index}`);
                await this.tts.streamPreGeneratedSentenceAudio(session, chunk, displayText, metrics, turnId, preGenResultOM);
              } else if (STREAMING_FEATURE_FLAGS.PROGRESSIVE_AUDIO_STREAMING) {
                await this.tts.streamSentenceAudioProgressive(session, chunk, displayText, metrics, turnId);
              } else {
                await this.tts.streamSentenceAudio(session, chunk, displayText, metrics, turnId);
              }
            } else if (STREAMING_FEATURE_FLAGS.PROGRESSIVE_AUDIO_STREAMING) {
              await this.tts.streamSentenceAudioProgressive(session, chunk, displayText, metrics, turnId);
            } else {
              await this.tts.streamSentenceAudio(session, chunk, displayText, metrics, turnId);
            }
          }
          
          fullText += displayText + ' ';
          metrics.sentenceCount++;
        },
      }),
        {
          maxRetries: 2,
          baseDelayMs: 800,
          maxDelayMs: 3000,
          onRetry: (attempt, error, delayMs) => {
            console.log(`[Gemini Retry - OpenMic] Attempt ${attempt} after ${delayMs}ms: ${error.message?.substring(0, 100)}`);
          },
        }
      );
      
      console.log(`[Streaming Orchestrator] AI complete: ${actualSentenceCount} sentences`);
      
      if (isGoogleBatchModeOM && batchedSentencesOM.length > 0) {
        console.log(`[Google Batch TTS - OpenMic] Post-stream check: ${batchedSentencesOM.length} batched, earlyTtsActive=${session.earlyTtsActive}, interrupted=${session.isInterrupted}`);
      }
      if (isGoogleBatchModeOM && batchedSentencesOM.length > 0 && !session.isInterrupted && !session.earlyTtsActive) {
        const combinedDisplayText = batchedSentencesOM.map(s => s.displayText).join(' ');
        console.log(`[Google Batch TTS - OpenMic] Combining ${batchedSentencesOM.length} sentences (${combinedDisplayText.length} chars) for single TTS call`);
        
        // ECHO SUPPRESSION: Re-assert before batch TTS starts
        // onSentence set suppression when first text arrived from Gemini, but TTS was deferred.
        // A previous turn's postTtsSuppressionTimer may have released it in the gap.
        if (session.postTtsSuppressionTimer) {
          clearTimeout(session.postTtsSuppressionTimer);
          session.postTtsSuppressionTimer = null;
        }
        session.onTtsStateChange?.(true);
        
        this.sendMessage(session.ws, {
          type: 'sentence_start',
          timestamp: Date.now(),
          turnId,
          sentenceIndex: 0,
          text: combinedDisplayText,
          hasTargetContent: false,
        } as StreamingSentenceStartMessage);
        
        const batchTtsStartOM = Date.now();
        const batchChunkOM: SentenceChunk = { index: 0, text: combinedDisplayText, isComplete: true, isFinal: true };
        if (STREAMING_FEATURE_FLAGS.PROGRESSIVE_AUDIO_STREAMING) {
          await this.tts.streamSentenceAudioProgressive(session, batchChunkOM, combinedDisplayText, metrics, turnId);
        } else {
          await this.tts.streamSentenceAudio(session, batchChunkOM, combinedDisplayText, metrics, turnId);
        }
        
        metrics.ttsFirstByteMs = Date.now() - batchTtsStartOM;
        console.log(`[Google Batch TTS - OpenMic] Complete. TTS duration: ${Date.now() - batchTtsStartOM}ms for ${batchedSentencesOM.length} sentences`);
        
        metrics.sentenceCount = 1;
      }
      
      // Update conversation history
      if (transcript.trim()) {
        session.conversationHistory.push({ role: 'user', content: transcript });
        
        // INCREMENTAL MEMORY CHECKPOINT: Persist student utterance immediately for crash recovery
        // This ensures memories aren't lost if session ends abruptly (network loss, navigation, etc)
        if (session.userId && !session.isIncognito) {
          memoryCheckpointService.checkpointUtterance(
            String(session.userId),
            sessionId,
            session.dbSessionId || null,
            session.targetLanguage,
            transcript,
            session.conversationHistory.length - 1 // Index of user message in history
          ).catch((err: Error) => {
            console.warn(`[Memory Checkpoint] Failed to checkpoint utterance (open mic):`, err.message);
          });
        }
      }
      
      // MULTI-STEP FUNCTION CALLING: Track if we need to continue after function execution
      const hadFunctionCallsOpenMic = session.currentTurnFunctionCalls && session.currentTurnFunctionCalls.length > 0;
      const functionCallsCopyOpenMic: ExtractedFunctionCall[] = hadFunctionCallsOpenMic ? [...session.currentTurnFunctionCalls!] : [];
      const thoughtSignaturesCopyOpenMic: string[] = session.currentTurnThoughtSignatures ? [...session.currentTurnThoughtSignatures] : [];
      
      // Build model response with function calls + thought signatures if applicable
      if (hadFunctionCallsOpenMic) {
        const modelParts: Array<{
          text?: string;
          functionCall?: { name: string; args: Record<string, unknown> };
          thought_signature?: string;
        }> = [];
        
        for (const fc of session.currentTurnFunctionCalls!) {
          modelParts.push({
            functionCall: { name: fc.name, args: fc.args },
            thought_signature: fc.thoughtSignature,
          });
        }
        
        if (fullText.trim()) {
          modelParts.push({ text: fullText.trim() });
        }
        
        session.conversationHistory.push({
          role: 'model',
          parts: modelParts,
          thoughtSignatures: session.currentTurnThoughtSignatures || [],
        });
        
        console.log(`[Conversation History - OpenMic] Saved model response with ${session.currentTurnFunctionCalls!.length} function calls`);
        session.currentTurnFunctionCalls = [];
        session.currentTurnThoughtSignatures = [];
      } else if (fullText.trim()) {
        session.conversationHistory.push({ role: 'model', content: fullText.trim() });
      }
      
      // MULTI-STEP FUNCTION CALLING CONTINUATION (Open Mic path)
      // If Gemini called functions but produced no text, continue the conversation
      // OPTIMIZATION: Exclude metadata-only functions from needing continuation
      // These are speech annotations, not actions requiring a response - they work in a single call
      const METADATA_ONLY_FUNCTIONS_OPENMIC = new Set(['VOICE_ADJUST', 'VOICE_RESET', 'WORD_EMPHASIS', 'SUBTITLE', 'SHOW', 'HIDE', 'HOLD', 'TAKE_NOTE', 'MILESTONE']);
      const functionsNeedingContinuationOpenMic = functionCallsCopyOpenMic.filter(
        fc => !METADATA_ONLY_FUNCTIONS_OPENMIC.has(fc.legacyType || '')
      );
      
      // TREAT METADATA-ONLY FUNCTIONS AS NEEDING CONTINUATION
      // voice_adjust and word_emphasis should ALWAYS accompany spoken text
      // If Gemini only returns these without text, check for embedded text first before forcing continuation
      if (metrics.sentenceCount === 0 && hadFunctionCallsOpenMic && functionsNeedingContinuationOpenMic.length === 0) {
        if (session.postTtsSuppressionTimer) {
          clearTimeout(session.postTtsSuppressionTimer);
          session.postTtsSuppressionTimer = null;
        }
        session.onTtsStateChange?.(true);

        const fcTtsResult = await this.tts.dispatchPostStreamFcTts(session, metrics);
        if (fcTtsResult) {
          fullText = fcTtsResult.spokenText;
          metrics.sentenceCount = fcTtsResult.sentenceCount;
        } else {
          const metadataOnlyFunctions = functionCallsCopyOpenMic.map(fc => fc.name).join(', ');
          console.warn(`[Voice OpenMic] Gemini returned only metadata functions (${metadataOnlyFunctions}) - forcing continuation`);
          session.earlyTtsActive = undefined;
          functionsNeedingContinuationOpenMic.push(...functionCallsCopyOpenMic);
        }
      }
      
      if (metrics.sentenceCount === 0 && hadFunctionCallsOpenMic && functionsNeedingContinuationOpenMic.length > 0) {
        console.log(`[Multi-Step FC - OpenMic] Functions need continuation: ${functionsNeedingContinuationOpenMic.map(fc => fc.name).join(', ')}`);
        console.log(`[Multi-Step FC - OpenMic] All functions executed: ${functionCallsCopyOpenMic.map(fc => fc.name).join(', ')}`);
        
        // PRIORITY CHECK: If voice_adjust already provided embedded text, use it NOW and skip continuation
        // This handles cases like voice_adjust + play_audio where voice_adjust has embedded spoken text
        const rawEmbeddedTextBeforeContinuation = ensureTrailingPunctuation((session.functionCallText || '').trim());
        const embeddedTextBeforeContinuation = cleanTextForDisplay(rawEmbeddedTextBeforeContinuation).trim();
        if (embeddedTextBeforeContinuation) {
          const contDirectBoldWords = extractBoldMarkedWords(rawEmbeddedTextBeforeContinuation || '');
          const accumulatedWords: string[] = session.accumulatedBoldWords || [];
          const contBoldWords = [...new Set([...contDirectBoldWords, ...accumulatedWords])];
          if (accumulatedWords.length > 0) {
            console.log(`[Multi-Step FC - OpenMic] Merged ${accumulatedWords.length} accumulated bold words with ${contDirectBoldWords.length} direct: ${contBoldWords.join(', ')}`);
          }

          const contSentences = splitTextIntoSentences(embeddedTextBeforeContinuation);
          console.log(`[Multi-Step FC - OpenMic] Found embedded text (${embeddedTextBeforeContinuation.length} chars) → ${contSentences.length} sentences for pipelined TTS`);
          fullText = embeddedTextBeforeContinuation;
          metrics.sentenceCount = contSentences.length;

          // ECHO SUPPRESSION: Activate before Multi-Step FC TTS
          if (session.postTtsSuppressionTimer) {
            clearTimeout(session.postTtsSuppressionTimer);
            session.postTtsSuppressionTimer = null;
          }
          session.onTtsStateChange?.(true);

          for (let si = 0; si < contSentences.length; si++) {
            if (session.isInterrupted) break;
            const sentenceText = contSentences[si];
            const contExtraction = extractTargetLanguageWithMapping(sentenceText, contBoldWords);
            const contWordMapping: [number, number][] = contExtraction.wordMapping.size > 0
              ? Array.from(contExtraction.wordMapping.entries()) : [];
            const contHasTarget = !!(contExtraction.targetText && contExtraction.targetText.trim().length > 0);

            this.sendMessage(session.ws, {
              type: 'sentence_start',
              timestamp: Date.now(),
              turnId: session.turnId || session.currentTurnId,
              sentenceIndex: si,
              text: sentenceText,
              hasTargetContent: contHasTarget,
              targetLanguageText: contHasTarget ? contExtraction.targetText : undefined,
              wordMapping: contHasTarget && contWordMapping.length > 0 ? contWordMapping : undefined,
              ...(si === 0 && contSentences.length > 1 ? { totalSentences: contSentences.length } : {}),
            } as StreamingSentenceStartMessage);

            await this.tts.streamSentenceAudioProgressive(session, { index: si, text: sentenceText }, sentenceText, metrics, session.turnId || `turn-${Date.now()}`, contBoldWords);
          }

          session.functionCallText = undefined;
          session.voiceAdjustText = undefined;
          session.accumulatedBoldWords = undefined;
        } else {
        // Await any pending memory lookups before building responses
        if (session.pendingMemoryLookupPromises?.length) {
          console.log(`[Multi-Step FC - OpenMic] Awaiting ${session.pendingMemoryLookupPromises.length} pending memory lookups...`);
          await Promise.all(session.pendingMemoryLookupPromises);
          session.pendingMemoryLookupPromises = [];
        }
        
        // Build function response parts
        // Note: Use 'tool' role and multimodal response format per Gemini 3 requirements
        const functionResponsePartsOpenMic: Array<{
          functionResponse: { name: string; response: { output: Array<{ text: string }> } };
        }> = [];
        
        for (const fc of functionCallsCopyOpenMic) {
          const registryResult = buildFunctionContinuationResponse(session, fc);
          
          if (registryResult && typeof registryResult === 'object' && 'multimodal' in registryResult) {
            functionResponsePartsOpenMic.push({
              functionResponse: {
                name: fc.name,
                response: { output: registryResult.parts },
              },
            } as any);
            continue;
          }
          
          const responseText = (typeof registryResult === 'string')
            ? registryResult
            : `${fc.name} executed successfully. Continue the conversation.`;
          
          functionResponsePartsOpenMic.push({
            functionResponse: {
              name: fc.name,
              response: { output: [{ text: responseText }] },
            },
          });
        }
        
        // Add function response to conversation history
        // Use 'tool' role for proper Gemini 3 multi-step function calling
        session.conversationHistory.push({
          role: 'tool',
          parts: functionResponsePartsOpenMic,
          thoughtSignatures: thoughtSignaturesCopyOpenMic,
        });
        
        console.log(`[Multi-Step FC - OpenMic] Added ${functionResponsePartsOpenMic.length} function responses to history`);
        
        // Re-initialize tracking for continuation
        session.currentTurnFunctionCalls = [];
        session.currentTurnThoughtSignatures = [];
        
        // Call Gemini again to get actual spoken text
        // Rebuild context fresh: stored preamble + current session history (with function responses)
        const continuationHistory: ConversationHistoryEntry[] = session.currentTurnPreamble
          ? [...session.currentTurnPreamble, ...session.conversationHistory]
          : session.conversationHistory;
        
        try {
          // Wrap in retry with exponential backoff for 429 rate limiting
          await retryWithBackoff(
            () => this.geminiService.streamWithSentenceChunking({
              systemPrompt: session.systemPrompt,  // Use stable base prompt (cached)
              conversationHistory: continuationHistory,  // Fresh: preamble + updated history
              userMessage: '', // Empty - continuing from function responses
              maxOutputTokens: session.isRawHonestyMode ? 8192 : 4096,
              enableFunctionCalling: true,
              enableContextCaching: true,  // Use cached system prompt
              onFunctionCall: async (newFCs: ExtractedFunctionCall[]) => {
                for (const fn of newFCs) {
                  console.log(`[Multi-Step FC Continuation - OpenMic] Additional function: ${fn.name}`);
                  if (fn.thoughtSignature) {
                    session.currentTurnThoughtSignatures?.push(fn.thoughtSignature);
                  }
                  session.currentTurnFunctionCalls?.push(fn);
                  this.fcHandler.handle(sessionId, session, fn).catch(err => {
                    console.error(`[Multi-Step FC - OpenMic] Error handling ${fn.name}:`, err.message);
                  });
                }
              },
              onSentence: async (chunk: SentenceChunk) => {
                if (session.isInterrupted) return;
                
                const contDisplayText = cleanTextForDisplay(chunk.text);
                if (!contDisplayText) return;
                
                const contNormalizedText = contDisplayText.toLowerCase().trim();
                if (seenSentences.has(contNormalizedText)) return;
                seenSentences.add(contNormalizedText);
                
                if (actualSentenceCount >= MAX_SENTENCES) return;
                actualSentenceCount++;
                
                // ECHO SUPPRESSION: Activate on first continuation sentence TTS
                if (chunk.index === 0 || metrics.sentenceCount === 0) {
                  if (session.postTtsSuppressionTimer) {
                    clearTimeout(session.postTtsSuppressionTimer);
                    session.postTtsSuppressionTimer = null;
                  }
                  session.onTtsStateChange?.(true);
                }
                
                console.log(`[Multi-Step FC - OpenMic] Continuation sentence ${chunk.index}: "${contDisplayText.substring(0, 50)}..."`);
                
                if (STREAMING_FEATURE_FLAGS.PROGRESSIVE_AUDIO_STREAMING) {
                  await this.tts.streamSentenceAudioProgressive(session, chunk, contDisplayText, metrics, turnId);
                } else {
                  await this.tts.streamSentenceAudio(session, chunk, contDisplayText, metrics, turnId);
                }
                
                fullText += contDisplayText + ' ';
                metrics.sentenceCount++;
              },
              onError: (error) => {
                console.error(`[Multi-Step FC - OpenMic] Continuation error:`, error.message);
              },
            }),
            {
              maxRetries: 3,
              baseDelayMs: 500,
              maxDelayMs: 4000,
              onRetry: (attempt, error, delayMs) => {
                console.log(`[Multi-Step FC - OpenMic] Rate limited, retry ${attempt}/3 after ${delayMs}ms`);
              }
            }
          );
          
          // RECURSIVE MULTI-STEP FC: If continuation also produced 0 sentences + more function calls, continue again
          // This handles chains like: memory_lookup → express_lane_lookup → actual response
          let recursiveDepth = 0;
          const MAX_RECURSIVE_FC_DEPTH = 5; // Safety limit
          
          while (metrics.sentenceCount === 0 && 
                 session.currentTurnFunctionCalls && 
                 session.currentTurnFunctionCalls.length > 0 &&
                 recursiveDepth < MAX_RECURSIVE_FC_DEPTH) {
            
            // CHECK: If voice_adjust already provided embedded text, use it and stop looping
            const rawEmbeddedTextFromFC = ensureTrailingPunctuation((session.functionCallText || '').trim());
            const embeddedTextFromFC = cleanTextForDisplay(rawEmbeddedTextFromFC).trim();
            if (embeddedTextFromFC) {
              console.log(`[Multi-Step FC - OpenMic] Found embedded text (${embeddedTextFromFC.length} chars) - using for TTS and stopping continuation`);
              fullText = embeddedTextFromFC;
              metrics.sentenceCount = 1;
              
              const fcDirectBoldWords = extractBoldMarkedWords(rawEmbeddedTextFromFC || '');
              const fcAccumulatedWords: string[] = session.accumulatedBoldWords || [];
              const fcBoldWords = [...new Set([...fcDirectBoldWords, ...fcAccumulatedWords])];
              await this.tts.streamSentenceAudioProgressive(session, { index: 0, text: embeddedTextFromFC }, embeddedTextFromFC, metrics, session.turnId || `turn-${Date.now()}`, fcBoldWords);
              
              // Clear after use
              session.functionCallText = undefined;
              session.voiceAdjustText = undefined;
              session.accumulatedBoldWords = undefined;
              break;  // Exit the continuation loop
            }
            
            recursiveDepth++;
            console.log(`[Multi-Step FC - OpenMic] Recursive continuation depth ${recursiveDepth} - ${session.currentTurnFunctionCalls.length} new function calls`);
            
            // Await any pending lookups from this round
            if (session.pendingMemoryLookupPromises?.length) {
              console.log(`[Multi-Step FC - OpenMic] Awaiting ${session.pendingMemoryLookupPromises.length} pending lookups (depth ${recursiveDepth})...`);
              await Promise.all(session.pendingMemoryLookupPromises);
              session.pendingMemoryLookupPromises = [];
            }
            
            // Save current function calls for response building
            const recursiveFCs = [...session.currentTurnFunctionCalls];
            const recursiveThoughts = session.currentTurnThoughtSignatures ? [...session.currentTurnThoughtSignatures] : [];
            
            // Add model turn with function calls to history
            const recursiveModelParts: Array<{
              text?: string;
              functionCall?: { name: string; args: Record<string, unknown> };
              thought_signature?: string;
            }> = recursiveFCs.map(fc => ({
              functionCall: { name: fc.name, args: fc.args },
              thought_signature: fc.thoughtSignature,
            }));
            session.conversationHistory.push({
              role: 'model',
              parts: recursiveModelParts,
              thoughtSignatures: recursiveThoughts,
            });
            
            // Build function responses
            const recursiveResponseParts: Array<{
              functionResponse: { name: string; response: { output: Array<{ text: string }> } };
            }> = [];
            
            for (const fc of recursiveFCs) {
              let responseText = 'Function executed successfully.';
              if (fc.legacyType === 'MEMORY_LOOKUP') {
                const query = fc.args.query as string;
                const lookupResult = session.memoryLookupResults?.[query];
                responseText = lookupResult 
                  ? `Memory lookup results for "${query}":\n${lookupResult}\n\nNow respond using this information.`
                  : `No memories found for "${query}". Respond naturally.`;
              } else if (fc.legacyType === 'EXPRESS_LANE_LOOKUP') {
                const query = (fc.args.query as string) || '';
                const lookupKey = query || '__browse__';
                const lookupResult = session.expressLaneLookupResults?.[lookupKey];
                const label = query ? `search results for "${query}"` : 'recent messages (browse mode)';
                responseText = lookupResult
                  ? `Express Lane ${label}:\n${lookupResult}\n\nNow respond using this information.`
                  : `No Express Lane messages found for "${query}". Respond naturally.`;
              } else if (fc.legacyType === 'BROWSE_SYLLABUS') {
                const syllabusData = session.lastSyllabusData;
                responseText = syllabusData
                  ? `Syllabus data loaded:\n${JSON.stringify(syllabusData, null, 1)}\n\nPresent this conversationally.`
                  : `No enrolled class or curriculum found. Let the student know gently.`;
                delete session.lastSyllabusData;
              } else if (fc.legacyType === 'START_LESSON') {
                const lessonData = session.lastLoadedLesson;
                responseText = lessonData
                  ? `Lesson loaded:\n${JSON.stringify(lessonData, null, 1)}\n\nBegin teaching naturally.`
                  : `Could not find the requested lesson.`;
                delete session.lastLoadedLesson;
              } else if (fc.legacyType === 'LOAD_VOCAB_SET') {
                const vocabData = session.lastVocabSet;
                responseText = vocabData?.length > 0
                  ? `Vocabulary loaded: ${vocabData.length} words.\n${JSON.stringify(vocabData, null, 1)}\n\nTeach these words with show_image.`
                  : `No vocabulary found for this lesson.`;
                delete session.lastVocabSet;
              } else if (fc.legacyType === 'SHOW_PROGRESS') {
                responseText = `Progress displayed on whiteboard. Share observations naturally.`;
              } else if (fc.legacyType === 'RECOMMEND_NEXT') {
                const recommendation = session.lastRecommendation;
                responseText = recommendation
                  ? `Recommendation: "${recommendation.lessonName}" from ${recommendation.unitName}. ${recommendation.reason}`
                  : `All lessons complete! Congratulate the student.`;
                delete session.lastRecommendation;
              } else if (fc.legacyType === 'DRILL_SESSION') {
                const data = session.lastDrillSessionData;
                responseText = data?.totalItems > 0
                  ? `Drill session started with ${data.totalItems} items. First item displayed. Walk the student through it, then use drill_session_next.`
                  : `No drill items found. Offer conversational practice instead.`;
                delete session.lastDrillSessionData;
              } else if (fc.legacyType === 'DRILL_SESSION_NEXT') {
                const data = session.lastDrillSessionData;
                responseText = data?.sessionComplete
                  ? `Session complete! ${data.correct}/${data.totalItems} correct (${data.accuracy}%). Celebrate and summarize.`
                  : data ? `Item ${data.currentItem}/${data.totalItems}. Score: ${data.correctSoFar} correct. Present next drill.`
                  : `Drill session next processed.`;
                delete session.lastDrillSessionData;
              } else if (fc.legacyType === 'DRILL_SESSION_END') {
                const data = session.lastDrillSessionData;
                responseText = data
                  ? `Session ended. ${data.itemsAttempted}/${data.totalItems} attempted, ${data.accuracy}% accuracy. Summarize warmly.`
                  : `No active session to end.`;
                delete session.lastDrillSessionData;
              } else if (fc.legacyType === 'REVIEW_DUE_VOCAB') {
                const dueVocab = session.lastDueVocab;
                responseText = dueVocab?.length > 0
                  ? `${dueVocab.length} vocab words due:\n${JSON.stringify(dueVocab.map((w: any) => ({ word: w.word, translation: w.translation })), null, 1)}\n\nQuiz the student.`
                  : `No words due for review. All caught up!`;
                delete session.lastDueVocab;
              } else {
                responseText = `${fc.name} executed successfully. Continue the conversation.`;
              }
              recursiveResponseParts.push({
                functionResponse: {
                  name: fc.name,
                  response: { output: [{ text: responseText }] },
                },
              });
            }
            
            // Add tool response to history
            session.conversationHistory.push({
              role: 'tool',
              parts: recursiveResponseParts,
              thoughtSignatures: recursiveThoughts,
            });
            
            console.log(`[Multi-Step FC - OpenMic] Added ${recursiveResponseParts.length} function responses (depth ${recursiveDepth})`);
            
            // Reset tracking for next round
            session.currentTurnFunctionCalls = [];
            session.currentTurnThoughtSignatures = [];
            
            // Call Gemini again with retry for rate limiting
            const recursiveHistory: ConversationHistoryEntry[] = session.currentTurnPreamble
              ? [...session.currentTurnPreamble, ...session.conversationHistory]
              : session.conversationHistory;
            
            await retryWithBackoff(
              () => this.geminiService.streamWithSentenceChunking({
                systemPrompt: session.systemPrompt,
                conversationHistory: recursiveHistory,
                userMessage: '',
                maxOutputTokens: session.isRawHonestyMode ? 8192 : 4096,
                enableFunctionCalling: true,
                enableContextCaching: true,
                onFunctionCall: async (newFCs: ExtractedFunctionCall[]) => {
                  for (const fn of newFCs) {
                    console.log(`[Multi-Step FC - OpenMic] Recursive function (depth ${recursiveDepth}): ${fn.name}`);
                    if (fn.thoughtSignature) {
                      session.currentTurnThoughtSignatures?.push(fn.thoughtSignature);
                    }
                    session.currentTurnFunctionCalls?.push(fn);
                    this.fcHandler.handle(sessionId, session, fn).catch(err => {
                      console.error(`[Multi-Step FC - OpenMic] Error handling ${fn.name}:`, err.message);
                    });
                  }
                },
                onSentence: async (chunk: SentenceChunk) => {
                  if (session.isInterrupted) return;
                  
                  const recursiveDisplayText = cleanTextForDisplay(chunk.text);
                  if (!recursiveDisplayText) return;
                  
                  const recursiveNormalized = recursiveDisplayText.toLowerCase().trim();
                  if (seenSentences.has(recursiveNormalized)) return;
                  seenSentences.add(recursiveNormalized);
                  
                  if (actualSentenceCount >= MAX_SENTENCES) return;
                  actualSentenceCount++;
                  
                  console.log(`[Multi-Step FC - OpenMic] Recursive sentence (depth ${recursiveDepth}): "${recursiveDisplayText.substring(0, 50)}..."`);
                  
                  if (STREAMING_FEATURE_FLAGS.PROGRESSIVE_AUDIO_STREAMING) {
                    await this.tts.streamSentenceAudioProgressive(session, chunk, recursiveDisplayText, metrics, turnId);
                  } else {
                    await this.tts.streamSentenceAudio(session, chunk, recursiveDisplayText, metrics, turnId);
                  }
                  
                  fullText += recursiveDisplayText + ' ';
                  metrics.sentenceCount++;
                },
                onError: (error) => {
                  console.error(`[Multi-Step FC - OpenMic] Recursive error (depth ${recursiveDepth}):`, error.message);
                },
              }),
              {
                maxRetries: 3,
                baseDelayMs: 500,
                maxDelayMs: 4000,
                onRetry: (attempt, error, delayMs) => {
                  console.log(`[Multi-Step FC - OpenMic] Rate limited (depth ${recursiveDepth}), retry ${attempt}/3 after ${delayMs}ms`);
                }
              }
            );
          }
          
          if (recursiveDepth >= MAX_RECURSIVE_FC_DEPTH) {
            console.warn(`[Multi-Step FC - OpenMic] Hit max recursive depth (${MAX_RECURSIVE_FC_DEPTH}), stopping function chain`);
          }
          
          // Update conversation history with continuation response
          if (fullText.trim() && metrics.sentenceCount > 0) {
            if (session.currentTurnFunctionCalls && session.currentTurnFunctionCalls.length > 0) {
              const contModelParts: Array<{
                text?: string;
                functionCall?: { name: string; args: Record<string, unknown> };
                thought_signature?: string;
              }> = [];
              
              for (const fc of session.currentTurnFunctionCalls) {
                contModelParts.push({
                  functionCall: { name: fc.name, args: fc.args },
                  thought_signature: fc.thoughtSignature,
                });
              }
              contModelParts.push({ text: fullText.trim() });
              
              session.conversationHistory.push({
                role: 'model',
                parts: contModelParts,
                thoughtSignatures: session.currentTurnThoughtSignatures || [],
              });
            } else {
              session.conversationHistory.push({ role: 'model', content: fullText.trim() });
            }
            console.log(`[Multi-Step FC - OpenMic] Continuation complete: ${metrics.sentenceCount} sentences`);
          }
          
          session.currentTurnFunctionCalls = [];
          session.currentTurnThoughtSignatures = [];
          
        } catch (contErr: any) {
          console.error(`[Multi-Step FC - OpenMic] Continuation failed:`, contErr.message);
        }
        }  // Close the else block for embedded text check
      }
      
      // ZERO-SENTENCE SAFETY NET: If Gemini completed but produced no spoken text
      // (e.g., function call continuation returned empty), speak a fallback so the user
      // isn't left in silence wondering if the app froze
      if (metrics.sentenceCount === 0 && !session.isInterrupted && !fullText.trim()) {
        const fallbackText = "Sorry, let me try that again. What were you saying?";
        console.warn(`[OpenMic Safety Net] 0 sentences produced after Gemini complete — speaking fallback`);
        try {
          this.sendMessage(session.ws, {
            type: 'sentence_start',
            timestamp: Date.now(),
            turnId,
            sentenceIndex: 0,
            text: fallbackText,
            hasTargetContent: false,
          } as StreamingSentenceStartMessage);
          await this.tts.streamSentenceAudioProgressive(session, { index: 0, text: fallbackText }, fallbackText, metrics, turnId);
          fullText = fallbackText;
          metrics.sentenceCount = 1;
        } catch (fallbackErr: any) {
          console.error(`[OpenMic Safety Net] Fallback TTS failed:`, fallbackErr.message);
        }
      }
      
      await this.completeOpenMicResponse(session, metrics, turnId, startTime, fullText, transcript, confidence, responseCompleteSentOpenMic);
      
      return metrics;
      
    } catch (error: any) {
      // Clear generating flag on error
      session.isGenerating = false;
      // ECHO SUPPRESSION: Re-enable OpenMic transcription on error
      // Clear immediately on error (no TTS was playing, so no echo risk)
      if (session.postTtsSuppressionTimer) {
        clearTimeout(session.postTtsSuppressionTimer);
        session.postTtsSuppressionTimer = null;
      }
      session.onTtsStateChange?.(false);
      
      // STRUCTURED ERROR LOGGING: Capture Gemini failure patterns for debugging
      const isGeminiError = error.message?.includes('Gemini') || 
                           error.message?.includes('API') ||
                           error.message?.includes('timeout') ||
                           error.message?.includes('rate limit') ||
                           error.message?.includes('429') ||
                           error.message?.includes('503') ||
                           error.message?.includes('500') ||
                           error.message?.includes('Incomplete JSON');
      
      const isJsonParseError = error.message?.includes('Incomplete JSON segment');
      const errorType = isGeminiError ? 'GEMINI_API_ERROR' : 'VOICE_PROCESSING_ERROR';
      const elapsedMs = Date.now() - startTime;
      
      // GRACEFUL RECOVERY: For recoverable errors, speak a fallback so student isn't left in silence
      const is429Error = error.message?.includes('429') || 
                         error.message?.includes('RESOURCE_EXHAUSTED') ||
                         error.message?.includes('Resource exhausted');
      if (isJsonParseError || is429Error) {
        const reason = is429Error ? '429 rate limit' : 'JSON parse error';
        console.log(`[Gemini Recovery - OpenMic] ${reason} detected, providing spoken fallback`);
        const fallbackText = is429Error 
          ? "One moment, I'm having a little trouble connecting. Could you say that again?"
          : "Sorry, I had a brief hiccup. What were you saying?";
        try {
          await this.synthesizeSentenceToClient(session, fallbackText, 0, null, { force: true });
          metrics.sentenceCount = 1;
          console.log(`[Gemini Recovery - OpenMic] Fallback response sent successfully`);
        } catch (ttsError: any) {
          console.error(`[Gemini Recovery - OpenMic] Fallback TTS failed:`, ttsError.message);
        }
      }
      
      // TIMEOUT-SPECIFIC TELEMETRY: Log timeouts to shared database for monitoring
      const isTimeout = error.message?.includes('timeout') || 
                       error.message?.includes('ETIMEDOUT') ||
                       elapsedMs > 60000; // Consider >60s as implicit timeout
      if (isTimeout) {
        logGeminiTimeout(sessionId, elapsedMs, {
          userId: String(session.userId),
          turnId: String(session.currentTurnId || 'unknown'),
          transcript: transcript?.substring(0, 100),
        }).catch(err => console.error('[Telemetry] Failed to log Gemini timeout:', err.message));
      }
      
      console.error(`[Streaming Orchestrator] ${errorType} (OpenMic):`, {
        sessionId,
        conversationId: session.conversationId,
        userId: session.userId,
        error: error.message,
        errorStack: error.stack?.split('\n').slice(0, 3).join(' -> '),
        elapsedMs,
        aiFirstTokenReceived: metrics.aiFirstTokenMs > 0,
        sttMs: metrics.sttLatencyMs || 0,
        aiMs: metrics.aiFirstTokenMs || 0,
        transcriptLength: transcript.length,
        // Checkpoint status - was user message saved before failure?
        userMessageCheckpointed: !!session.checkpointedUserMessageId,
      });
      
      // Emit error diagnostic for analytics
      voiceDiagnostics.emit({
        sessionId,
        stage: 'error',
        success: false,
        error: error.message,
        metadata: { 
          phase: 'processOpenMicTranscript',
          errorType,
          sttMs: metrics.sttLatencyMs || 0,
          aiMs: metrics.aiFirstTokenMs || 0,
          elapsedMs,
          checkpointed: !!session.checkpointedUserMessageId,
        }
      });
      
      this.sendError(session.ws, 'UNKNOWN', error.message, true);
      
      await this.completeOpenMicResponse(session, metrics, turnId, startTime, fullText, transcript, confidence, responseCompleteSentOpenMic, { errorPath: true, skipPersist: true, skipTutorSwitch: true });
      
      return metrics;
    } finally {
      if (!responseCompleteSentOpenMic.sent) {
        console.error(`[OpenMic SAFETY NET] response_complete was NEVER sent for session ${sessionId} — forcing now`);
        await this.completeOpenMicResponse(session, metrics, turnId, startTime, '', transcript, confidence, responseCompleteSentOpenMic, { errorPath: true, skipPersist: true, skipTutorSwitch: true });
      }
    }
  }
  
  /**
   * Transcribe audio using Deepgram Prerecorded API
   * 
   * PUSH-TO-TALK STRATEGY: Use prerecorded API for complete audio blobs
   * The Live API is designed for real-time streaming, not batch audio.
   * Sending complete blobs to Live API causes "Endpointing not supported for batch requests" errors.
   * 
   * For Open Mic mode, use OpenMicSession class which streams audio chunks correctly.
   * 
   * Core values alignment:
   * - <2 sec response: Prerecorded API is fast for complete audio
   * - Word timestamps: Enabled for karaoke highlighting
   * - Reliability: Prerecorded handles WebM containers well
   * 
   * MULTI-LANGUAGE DETECTION: Always enabled for all users
   * Students naturally code-switch between native and target languages during lessons.
   * 
   * Returns transcript AND confidence for ACTFL tracking (no shared state)
   */
  private async transcribeAudio(
    audioData: Buffer, 
    targetLanguage: string,
    nativeLanguage: string = 'english',
    isFounderMode: boolean = false,
    keyterms?: string[]
  ): Promise<{ transcript: string; confidence: number; intelligence?: DeepgramIntelligence; words?: TranscriptionResult['words'] }> {
    // MULTI-LANGUAGE: Always use multi-language detection
    // Students naturally mix native + target language during lessons
    const languageCode = 'multi';
    
    console.log(`[Deepgram] Transcribing ${audioData.length} bytes, language: ${languageCode} (bilingual: ${nativeLanguage}/${targetLanguage})${keyterms?.length ? ` keyterms: [${keyterms.join(', ')}]` : ''}`);
    
    // Log header to verify WebM format (0x1A 0x45 0xDF 0xA3)
    const header = audioData.slice(0, 16);
    console.log(`[Deepgram] Audio header: ${header.toString('hex')}`);
    
    // Use LIVE API for push-to-talk (more reliable for WebM/Opus from MediaRecorder)
    // The prerecorded API returns "duration: unknown, channels: 0" for browser WebM
    try {
      const result = await transcribeWithLiveAPI(audioData, {
        language: languageCode,
        enableIntelligence: true,
        keyterms,
      });
      
      if (!result.transcript) {
        console.log('[Deepgram Live] Empty transcript returned');
      } else {
        console.log(`[Deepgram Live] Result: "${result.transcript.substring(0, 50)}..." (${(result.confidence * 100).toFixed(0)}%, ${result.durationMs}ms, ${result.words?.length || 0} words)`);
      }
      
      return { 
        transcript: result.transcript, 
        confidence: result.confidence, 
        intelligence: result.intelligence,
        words: result.words,
      };
    } catch (error: any) {
      console.error(`[Deepgram Live] Error: ${error.message}`);
      // Fallback to prerecorded API if live fails
      console.log('[Deepgram] Falling back to prerecorded API...');
      const result = await this.transcribeWithPrerecorded(audioData, languageCode, true);
      if (!result.transcript) {
        console.log('[Deepgram Prerecorded] Empty transcript returned');
      }
      return { transcript: result.transcript, confidence: result.confidence, intelligence: result.intelligence };
    }
  }
  
  /**
   * Transcribe with Prerecorded API
   * @param audioData - Audio buffer to transcribe
   * @param languageCode - Language code (or 'multi' for multi-language detection)
   * @param enableIntelligence - If true, enables Deepgram intelligence features
   */
  private async transcribeWithPrerecorded(audioData: Buffer, languageCode: string, enableIntelligence: boolean = true): Promise<{ transcript: string; confidence: number; source: string; intelligence?: DeepgramIntelligence }> {
    const startTime = Date.now();
    
    // Log configuration for debugging
    console.log(`[Deepgram Prerecorded] Using model: ${DEEPGRAM_MODEL}, intelligence: ${DEEPGRAM_INTELLIGENCE_ENABLED}`);
    
    const response = await deepgram.client.listen.prerecorded.transcribeFile(
      audioData,
      {
        model: DEEPGRAM_MODEL,
        language: languageCode,
        smart_format: true,
        punctuate: true,
        mimetype: 'audio/webm;codecs=opus',  // Explicit codec for MediaRecorder output
        detect_language: true,
        // Intelligence features - only enabled when plan supports them
        // See DEEPGRAM_INTELLIGENCE_ENABLED documentation at top of file
        ...(DEEPGRAM_INTELLIGENCE_ENABLED && {
          diarize: true,           // Speaker separation
          sentiment: true,         // Sentiment analysis
          intents: true,           // Intent recognition
          detect_entities: true,   // Entity detection
          topics: true,            // Topic detection
          summarize: 'v2',         // Summarization (v2 for best quality)
        }),
      }
    );
    
    const channel = response.result?.results?.channels?.[0];
    const alternative = channel?.alternatives?.[0];
    const transcript = alternative?.transcript || '';
    const confidence = alternative?.confidence || 0;
    
    // DEBUG: Log full Deepgram response metadata for troubleshooting
    const metadata = response.result?.metadata;
    const duration = metadata?.duration;
    console.log(`[Deepgram Prerecorded] Result: "${transcript.substring(0, 50)}${transcript.length > 50 ? '...' : ''}" (${(confidence * 100).toFixed(0)}%, ${Date.now() - startTime}ms)`);
    console.log(`[Deepgram Prerecorded] Audio duration: ${duration ? duration.toFixed(2) + 's' : 'unknown'}, channels: ${response.result?.results?.channels?.length || 0}`);
    
    // Log detected language if available (for monitoring multi-language accuracy)
    const detectedLanguage = channel?.detected_language;
    if (detectedLanguage) {
      console.log(`[Deepgram Prerecorded] Detected language: ${detectedLanguage}`);
    }
    
    // If empty transcript but audio duration exists, there might be silent audio
    if (!transcript && duration && duration > 0.5) {
      console.warn(`[Deepgram Prerecorded] WARNING: ${duration.toFixed(2)}s of audio but empty transcript - possibly silent or corrupted audio`);
    }
    
    // Extract intelligence data from response
    let intelligence: DeepgramIntelligence | undefined;
    if (enableIntelligence) {
      intelligence = {};
      
      // Sentiment (from alternative or channel level)
      const sentimentInfo = (alternative as any)?.sentiment_segments?.[0] || (response.result?.results as any)?.sentiments?.segments?.[0];
      if (sentimentInfo) {
        intelligence.sentiment = {
          sentiment: sentimentInfo.sentiment || 'neutral',
          sentiment_score: sentimentInfo.sentiment_score || 0,
        };
      }
      
      // Intents
      const intentsData = (response.result?.results as any)?.intents?.segments;
      if (intentsData && intentsData.length > 0) {
        intelligence.intents = intentsData.map((seg: any) => ({
          intent: seg.intent || '',
          confidence_score: seg.confidence_score || 0,
        }));
      }
      
      // Entities
      const entitiesData = (response.result?.results as any)?.entities;
      if (entitiesData && entitiesData.length > 0) {
        intelligence.entities = entitiesData.map((ent: any) => ({
          label: ent.label || '',
          value: ent.value || '',
          confidence: ent.confidence || 0,
        }));
      }
      
      // Topics
      const topicsData = (response.result?.results as any)?.topics?.segments;
      if (topicsData && topicsData.length > 0) {
        const allTopics: DeepgramTopic[] = [];
        for (const seg of topicsData) {
          if (seg.topics) {
            for (const topic of seg.topics) {
              allTopics.push({
                topic: topic.topic || '',
                confidence: topic.confidence || 0,
              });
            }
          }
        }
        if (allTopics.length > 0) {
          intelligence.topics = allTopics;
        }
      }
      
      // Summary
      const summaryData = (response.result?.results as any)?.summary;
      if (summaryData?.short) {
        intelligence.summary = summaryData.short;
      }
      
      // Detected language
      if (detectedLanguage) {
        intelligence.detectedLanguage = detectedLanguage;
      }
      
      // Speaker ID (from diarization)
      const words = alternative?.words;
      if (words && words.length > 0 && (words[0] as any).speaker !== undefined) {
        intelligence.speakerId = (words[0] as any).speaker;
      }
      
      // Log intelligence data if we got any
      const intelKeys = Object.keys(intelligence).filter(k => (intelligence as any)[k] !== undefined);
      if (intelKeys.length > 0) {
        console.log(`[Deepgram Intelligence] Features detected: ${intelKeys.join(', ')}`);
        if (intelligence.sentiment) {
          console.log(`[Deepgram Intelligence] Sentiment: ${intelligence.sentiment.sentiment} (score: ${intelligence.sentiment.sentiment_score.toFixed(2)})`);
        }
        if (intelligence.intents && intelligence.intents.length > 0) {
          console.log(`[Deepgram Intelligence] Intents: ${intelligence.intents.map(i => i.intent).join(', ')}`);
        }
      }
    }
    
    const durationMs = Date.now() - startTime;
    console.log(`[Deepgram Prerecorded] Result: "${transcript}" (${(confidence * 100).toFixed(0)}%, ${durationMs}ms)`);
    
    return { transcript, confidence, source: 'prerecorded', intelligence };
  }
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
   * Format a date as a relative time string (e.g., "2 hours ago", "yesterday")
   */
  private formatTimeAgo(date: Date | null): string {
    if (!date) return 'recently';
    
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 5) return 'just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 2) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return 'last week';
  }
  
  /**
   * Normalize transcript for checkpoint matching (same logic as dedupe)
   * This ensures checkpoint comparison works even with slight variations
   */
  private normalizeTranscriptForCheckpoint(transcript: string): string {
    return transcript
      .trim()
      .toLowerCase()
      .replace(/[.,!?;:'"""''…\-—–]/g, '') // Strip punctuation
      .replace(/\s+/g, ' ') // Collapse whitespace
      .substring(0, 100); // Limit to first 100 chars for matching
  }
  
  /**
   * Checkpoint user message BEFORE calling Gemini API
   * This ensures user messages are saved even if Gemini fails/times out
   * Latency impact: ~5-10ms (negligible vs 1-2s LLM response)
   */
  private async checkpointUserMessage(
    session: StreamingSession,
    transcript: string
  ): Promise<void> {
    if (session.isIncognito) {
      console.log(`[Checkpoint] INCOGNITO - skipping user message checkpoint`);
      return;
    }
    try {
      // Normalize for reliable matching (same as dedupe logic)
      const normalizedTranscript = this.normalizeTranscriptForCheckpoint(transcript);
      
      // Skip if already checkpointed for this turn (idempotent)
      if (session.checkpointedUserTranscript === normalizedTranscript && session.checkpointedUserMessageId) {
        console.log(`[Checkpoint] User message already saved, skipping duplicate`);
        return;
      }
      
      const userMessage = await storage.createMessage({
        conversationId: session.conversationId,
        role: 'user',
        content: transcript,
      });
      
      // Track checkpoint for this turn (store normalized for matching)
      session.checkpointedUserMessageId = userMessage.id;
      session.checkpointedUserTranscript = normalizedTranscript;
      
      console.log(`[Checkpoint] User message pre-saved: ${userMessage.id.substring(0, 8)}... (${transcript.length} chars)`);
    } catch (error: any) {
      // Non-fatal - log and continue with Gemini call
      console.error(`[Checkpoint] Failed to save user message (continuing anyway):`, error.message);
    }
  }
  
  /**
   * Clear checkpoint after successful AI response (prevents duplicate on next turn)
   */
  private clearMessageCheckpoint(session: StreamingSession): void {
    session.checkpointedUserMessageId = undefined;
    session.checkpointedUserTranscript = undefined;
  }
  
  /**
   * Persist user and AI messages to database
   */
  private async persistMessages(
    conversationId: string, 
    userTranscript: string, 
    aiResponse: string,
    session: StreamingSession,
    pronunciationConfidence: number = 0
  ): Promise<void> {
    if (session.isIncognito) {
      console.log(`[Persist] INCOGNITO - skipping message persistence`);
      return;
    }
    try {
      // CRITICAL FIX: Ensure conversation exists before saving messages
      // Client may connect with conversationId but never send start_session message.
      // Without this, FK constraint on messages table causes silent write failures.
      try {
        console.log(`[Persist] Checking conversation exists: ${conversationId}, userId: ${session.userId}`);
        const existingConversation = await storage.getConversation(conversationId, String(session.userId));
        console.log(`[Persist] getConversation result:`, existingConversation ? `found (id=${existingConversation.id})` : 'NOT FOUND');
        if (!existingConversation) {
          console.log(`[Persist] Creating missing conversation: ${conversationId}`);
          await storage.createConversation({
            id: conversationId,
            userId: String(session.userId),
            language: session.targetLanguage || 'spanish',
            title: 'Voice Session',
          });
          console.log(`[Persist] ✓ Conversation created: ${conversationId}`);
        }
      } catch (convErr: any) {
        // If conversation creation fails, log and continue - messages will fail but we tried
        console.error(`[Persist] Conversation creation error: ${convErr.message}`);
      }
      
      // CHECKPOINT CHECK: Skip user message if already saved via checkpoint
      // This prevents duplicate user messages when Gemini succeeds
      // Use normalized comparison to match checkpoint storage (handles trim/whitespace differences)
      const normalizedUserTranscript = this.normalizeTranscriptForCheckpoint(userTranscript);
      const wasCheckpointed = session.checkpointedUserMessageId && 
                              session.checkpointedUserTranscript === normalizedUserTranscript;
      
      if (!wasCheckpointed) {
        // DB-LEVEL DEDUP SAFETY NET: Check if this exact transcript was already saved recently
        // This catches edge cases where checkpoint state was cleared but message already exists
        try {
          const existingMessages = await storage.getMessages(conversationId);
          const recentUserMessages = existingMessages
            .filter(m => m.role === 'user')
            .slice(-3); // Check last 3 user messages
          const isDuplicate = recentUserMessages.some(m => 
            this.normalizeTranscriptForCheckpoint(m.content) === normalizedUserTranscript
          );
          if (isDuplicate) {
            console.log(`[Persist] DB dedup: User message already exists in conversation, skipping save`);
          } else {
            await storage.createMessage({
              conversationId,
              role: 'user',
              content: userTranscript,
            });
          }
        } catch (dedupErr: any) {
          // If dedup check fails, save anyway (better duplicate than lost message)
          console.warn(`[Persist] DB dedup check failed, saving anyway: ${dedupErr.message}`);
          await storage.createMessage({
            conversationId,
            role: 'user',
            content: userTranscript,
          });
        }
      } else {
        console.log(`[Persist] User message already checkpointed, saving AI response only`);
      }
      
      // Clear checkpoint after successful processing
      this.clearMessageCheckpoint(session);
      
      // Skip saving empty AI responses (e.g., function-call-only turns like voice_adjust)
      if (!aiResponse || !aiResponse.trim()) {
        console.log(`[Persist] Skipping empty AI response (function-call-only turn)`);
        return;
      }
      
      // DB-LEVEL DEDUP for AI responses: Check if this exact response was already saved recently
      try {
        const existingMessages = await storage.getMessages(conversationId);
        const recentAiMessages = existingMessages
          .filter(m => m.role === 'assistant')
          .slice(-3);
        const normalizedAiResponse = aiResponse.trim().substring(0, 200);
        const isAiDuplicate = recentAiMessages.some(m => 
          m.content.trim().substring(0, 200) === normalizedAiResponse
        );
        if (isAiDuplicate) {
          console.log(`[Persist] DB dedup: AI response already exists in conversation, skipping save`);
          return;
        }
      } catch (aiDedupErr: any) {
        console.warn(`[Persist] AI dedup check failed, saving anyway: ${aiDedupErr.message}`);
      }
      
      // Extract target language text for the AI response
      const targetLanguageText = extractTargetLanguageText(aiResponse);
      const hasTargetLanguage = hasSignificantTargetLanguageContent(targetLanguageText);
      
      // Save AI message with target language text if applicable
      const aiMessage = await storage.createMessage({
        conversationId,
        role: 'assistant',
        content: aiResponse,
        ...(hasTargetLanguage ? { targetLanguageText } : {}),
        enrichmentStatus: 'pending',
      });
      
      console.log(`[Streaming Orchestrator] Messages persisted to conversation: ${conversationId}`);
      
      // BACKGROUND ENRICHMENT: Extract vocabulary and update progress (non-blocking)
      setImmediate(async () => {
        try {
          await this.enrichment.processBackgroundEnrichment(
            session, 
            conversationId, 
            aiMessage.id, 
            userTranscript,
            aiResponse,
            pronunciationConfidence
          );
        } catch (error: any) {
          console.error('[Streaming Enrichment] Failed:', error.message);
        }
      });
      
    } catch (error: any) {
      // Log but don't throw - database persistence is non-critical for voice flow
      console.error('[Streaming Orchestrator] Database error (non-fatal):', error.message);
    }
  }
  private sendGuardResetSignal(session: StreamingSession, guardName: string): void {
    console.log(`[GUARD RESET] Sending reset signal to client (guard: ${guardName})`);
    this.sendMessage(session.ws, {
      type: 'response_complete',
      timestamp: Date.now(),
      turnId: `guard-reset-${Date.now()}`,
      totalSentences: 0,
      totalDurationMs: 0,
      fullText: '',
      metrics: {
        sttLatencyMs: 0,
        aiFirstTokenMs: 0,
        ttsFirstChunkMs: 0,
        totalTtfbMs: 0,
        sentenceCount: 0,
      },
    } as StreamingResponseCompleteMessage);
  }

  /**
   * Send a JSON message over WebSocket
   * Includes deduplication for audio_chunk to prevent double audio bug
   * Uses both chunk-ID and content-hash deduplication for comprehensive protection
   */
  private sendMessage(ws: WS, message: StreamingMessage, session?: StreamingSession): void {
    if (message.type === 'processing') {
      console.log(`[SendMessage] Sending 'processing' message: readyState=${ws.readyState}, WS.OPEN=${WS.OPEN}`);
    }
    if (ws.readyState === WS.OPEN) {
      // DEDUPLICATION: Prevent duplicate audio chunks (double audio bug fix)
      // Only deduplicate audio_chunk messages - sentence_ready has different semantics
      if (message.type === 'audio_chunk') {
        const audioMsg = message as any;
        // Include message type in key to prevent collisions with other message types
        const dedupeKey = `audio-${audioMsg.turnId}-${audioMsg.sentenceIndex}-${audioMsg.chunkIndex || 0}`;
        
        // Find session by WS if not provided
        const targetSession = session || Array.from(this.sessions.values()).find(s => s.ws === ws);
        
        // Layer 1: Check by chunk ID (same chunk sent twice)
        if (targetSession?.sentAudioChunks?.has(dedupeKey)) {
          console.log(`[AUDIO DEDUP] Blocking duplicate audio_chunk (ID match): turnId=${audioMsg.turnId}, sentence=${audioMsg.sentenceIndex}, chunk=${audioMsg.chunkIndex || 0}`);
          return; // Skip sending duplicate
        }
        
        // Layer 2: Check by content hash (TTS retry with new chunk ID but same audio)
        // Only check if there's actual audio content
        if (targetSession?.sentAudioHashes && audioMsg.audio && audioMsg.audio.length > 0) {
          // Create a fast hash of the audio content (first 100 + last 100 chars for speed)
          const audioContent = audioMsg.audio;
          const sampleSize = Math.min(100, audioContent.length);
          const sample = audioContent.slice(0, sampleSize) + audioContent.slice(-sampleSize);
          const contentHash = createHash('md5').update(sample).digest('hex').slice(0, 12);
          
          if (targetSession.sentAudioHashes.has(contentHash)) {
            console.log(`[AUDIO DEDUP] Blocking duplicate audio_chunk (CONTENT match): turnId=${audioMsg.turnId}, sentence=${audioMsg.sentenceIndex}, chunk=${audioMsg.chunkIndex || 0}, hash=${contentHash}`);
            return; // Skip sending duplicate
          }
          
          // Track this content hash with timestamp (for potential LRU cleanup)
          targetSession.sentAudioHashes.set(contentHash, Date.now());
          
          // Limit hash cache size to prevent memory growth (keep last 100 unique audio chunks)
          if (targetSession.sentAudioHashes.size > 100) {
            const firstKey = targetSession.sentAudioHashes.keys().next().value;
            if (firstKey) targetSession.sentAudioHashes.delete(firstKey);
          }
        }
        
        // Track this audio chunk by ID
        if (targetSession?.sentAudioChunks) {
          targetSession.sentAudioChunks.add(dedupeKey);
        }
        
        // Mark first audio sent and flush any pending whiteboard updates (e.g. show_image)
        // Without this, images buffered before audio starts are never delivered to the client
        if (targetSession && !targetSession.firstAudioSent) {
          targetSession.firstAudioSent = true;
          if (targetSession.pendingWhiteboardUpdates && targetSession.pendingWhiteboardUpdates.length > 0) {
            const pending = targetSession.pendingWhiteboardUpdates;
            targetSession.pendingWhiteboardUpdates = [];
            console.log(`[SendMessage] Flushing ${pending.length} pending whiteboard update(s) on first audio`);
            for (const update of pending) {
              const updateJson = JSON.stringify(update);
              ws.send(updateJson);
            }
          }
        }
      }
      
      const json = JSON.stringify(message);
      // HOT PATH: Disabled per-chunk logging to prevent audio jitter
      // Only log response_complete for session tracking
      if (message.type === 'response_complete') {
        const completeMsg = message as any;
        console.log(`[Streaming] Response complete: ${completeMsg.totalSentences} sentences`);
      }
      ws.send(json);
    } else {
      // Only log critical failures (not hot-path timing messages)
      if (message.type === 'response_complete' || message.type === 'error') {
        console.log(`[Streaming] SKIPPED ${message.type}: readyState=${ws.readyState} (not OPEN)`);
      }
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
   * Generate and stream a personalized AI greeting for a new conversation
   * Uses the full streaming pipeline (Gemini → Cartesia) for real-time delivery
   */
  async processGreetingRequest(
    sessionId: string,
    userName?: string,
    isResumed?: boolean
  ): Promise<StreamingMetrics> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error(`Session not found or inactive: ${sessionId}`);
    }
    
    if (session.__greetingInProgress || session.__greetingDelivered) {
      console.log(`[Streaming Greeting] SKIPPING duplicate greeting request (inProgress=${!!session.__greetingInProgress}, delivered=${!!session.__greetingDelivered})`);
      return {
        sessionId,
        sttLatencyMs: 0,
        aiFirstTokenMs: 0,
        ttsFirstByteMs: 0,
        totalLatencyMs: 0,
        sentenceCount: 0,
        audioBytes: 0,
        audioChunkCount: 0,
      };
    }
    session.__greetingInProgress = true;
    
    // Await warmup with timeout - don't block forever if Gemini is slow
    // If warmup takes longer than 3 seconds, proceed without waiting
    if (session.warmupPromise) {
      const WARMUP_TIMEOUT_MS = 3000;
      const warmupTimeout = new Promise<void>(resolve => setTimeout(resolve, WARMUP_TIMEOUT_MS));
      await Promise.race([session.warmupPromise, warmupTimeout]);
    }
    
    const startTime = Date.now();
    const metrics: StreamingMetrics = {
      sessionId,
      sttLatencyMs: 0,  // No STT for greeting
      aiFirstTokenMs: 0,
      ttsFirstByteMs: 0,
      totalLatencyMs: 0,
      sentenceCount: 0,
      audioBytes: 0,
      audioChunkCount: 0,
    };
    
    try {
      console.log(`[Streaming Greeting] Generating personalized greeting for user ${session.userId}`);
      const greetingTimings: Record<string, number> = {};
      const timingStart = Date.now();
      
      // PARALLEL DATA FETCH: Run all independent DB queries concurrently
      // This reduces greeting latency by ~500-800ms compared to sequential fetches
      let actflLevel = 'Novice Low';
      let recentTopics: string[] = [];
      let wordsLearned = 0;
      let classEnrollment: { className: string; curriculumLesson?: string; curriculumUnit?: string } | null = null;
      let connectionsAboutStudent: { mentioner: string; relationship: string; context: string }[] = [];
      
      try {
        const parallelFetchStart = Date.now();
        const [actflProgress, userProgress, enrollments, recentConversations, user] = await Promise.all([
          storage.getOrCreateActflProgress(session.targetLanguage, String(session.userId))
            .catch(() => null),
          storage.getOrCreateUserProgress(session.targetLanguage, String(session.userId))
            .catch(() => null),
          storage.getStudentEnrollments(String(session.userId))
            .catch(() => []),
          storage.getUserConversations(String(session.userId))
            .catch(() => []),
          storage.getUser(String(session.userId))
            .catch(() => null),
        ]);
        greetingTimings.parallelDbFetch = Date.now() - parallelFetchStart;
        
        // Look up connections about this student (where others mentioned them)
        // This enables "warm introductions" - e.g., "I know you're David's friend from graduate school!"
        if (user?.firstName) {
          try {
            const connectionsStart = Date.now();
            const connections = await storage.getConnectionsAboutPerson(
              String(session.userId),
              user.firstName,
              user.lastName || undefined
            );
            
            for (const conn of connections) {
              // Get the mentioner's name for context
              if (conn.mentionedBy && conn.mentionedBy !== String(session.userId)) {
                const mentioner = await storage.getUser(conn.mentionedBy);
                if (mentioner) {
                  connectionsAboutStudent.push({
                    mentioner: mentioner.firstName || 'Someone',
                    relationship: conn.relationshipType,
                    context: conn.pendingPersonContext || conn.relationshipDetails || '',
                  });
                }
              }
            }
            
            greetingTimings.connectionsLookup = Date.now() - connectionsStart;
            if (connectionsAboutStudent.length > 0) {
              console.log(`[Streaming Greeting] Found ${connectionsAboutStudent.length} connection(s) about student`);
            }
          } catch (connError: any) {
            console.log(`[Streaming Greeting] Could not fetch connections: ${connError.message}`);
          }
        }
        
        // Process ACTFL progress
        actflLevel = actflProgress?.currentActflLevel || 'Novice Low';
        
        // Process user progress
        if (userProgress) {
          wordsLearned = userProgress.wordsLearned || 0;
        }
        
        // Process enrollments - find active class for this language
        // SKIP class context in Founder Mode or Raw Honesty Mode - these sessions are not class-bound
        if (!session.isFounderMode && !session.isRawHonestyMode) {
          const activeClass = enrollments.find(e => 
            e.isActive && 
            e.class?.isActive && 
            e.class?.language === session.targetLanguage
          );
          
          if (activeClass?.class) {
            classEnrollment = { className: activeClass.class.name };
            
            // If class has a curriculum, get current lesson context (sequential, but fast)
            if (activeClass.class.curriculumPathId) {
              try {
                const units = await storage.getCurriculumUnits(activeClass.class.curriculumPathId);
                if (units.length > 0) {
                  const lessons = await storage.getCurriculumLessons(units[0].id);
                  if (lessons.length > 0) {
                    const currentLesson = lessons[0];
                    classEnrollment.curriculumUnit = units[0].name;
                    classEnrollment.curriculumLesson = currentLesson.name;
                    
                    // Check if this lesson has bundled drills
                    const hasBundledDrills = !!(currentLesson as any).linkedDrillLessonId;
                    
                    // Store bundle context in session for Daniela's awareness
                    session.lessonBundleContext = {
                      lessonId: currentLesson.id,
                      lessonName: currentLesson.name,
                      hasBundledDrills,
                      bundleId: (currentLesson as any).bundleId || undefined,
                      linkedDrillLessonId: (currentLesson as any).linkedDrillLessonId || undefined,
                      drillsProvisioned: false,
                      provisionedDrillCount: 0,
                    };
                    
                    // If lesson has bundled drills, auto-provision them
                    if (hasBundledDrills && session.conversationId) {
                      try {
                        const { autoProvisionDrillsFromBundle } = await import('./drill-lifecycle-service');
                        const provisionResult = await autoProvisionDrillsFromBundle(
                          String(session.userId),
                          currentLesson.id,
                          session.conversationId
                        );
                        if (provisionResult.success) {
                          session.lessonBundleContext.drillsProvisioned = true;
                          session.lessonBundleContext.provisionedDrillCount = provisionResult.drillCount || 0;
                          console.log(`[Streaming Greeting] Auto-provisioned ${provisionResult.drillCount} bundled drills for lesson`);
                        }
                      } catch (provisionError: any) {
                        console.log(`[Streaming Greeting] Could not auto-provision drills: ${provisionError.message}`);
                      }
                    }
                    
                    if (hasBundledDrills) {
                      console.log(`[Streaming Greeting] Lesson has bundled drills (linkedDrillLessonId: ${(currentLesson as any).linkedDrillLessonId})`);
                    }
                  }
                }
              } catch (curriculumError: any) {
                console.log(`[Streaming Greeting] Could not fetch curriculum: ${curriculumError.message}`);
              }
            }
            console.log(`[Streaming Greeting] Student enrolled in class: ${activeClass.class.name}`);
          }
        } else if (session.isFounderMode) {
          console.log(`[Streaming Greeting] Founder Mode - skipping class enrollment context`);
        } else if (session.isRawHonestyMode) {
          console.log(`[Streaming Greeting] Raw Honesty Mode - skipping class enrollment context`);
        }
        
        // Process recent conversations for topic continuity
        if (recentConversations.length > 1) {
          const prevConversation = recentConversations[1]; // [0] is current, [1] is previous
          if (prevConversation.title) {
            recentTopics.push(prevConversation.title);
          } else if (prevConversation.topic) {
            recentTopics.push(prevConversation.topic);
          }
        }
      } catch (error: any) {
        console.log(`[Streaming Greeting] Could not fetch context data: ${error.message}`);
      }
      
      // Fetch colleague feedback from Aris/Alex (drill results, support notes)
      // This enables "Your colleague Aris told me..." moments for team continuity
      let colleagueFeedback: { agent: string; subject: string; summary: string }[] = [];
      try {
        const collabFetchStart = Date.now();
        const recentCollab = await storage.getCollaborationEventsToAgent('daniela', String(session.userId), 10);
        // Include feedback, delegation_complete, and status_update events from colleagues
        const feedbackTypes = ['feedback', 'delegation_complete', 'status_update'];
        colleagueFeedback = recentCollab
          .filter(e => e.status === 'pending' && feedbackTypes.includes(e.eventType))
          .slice(0, 3) // Limit to 3 insights for greeting
          .map(e => ({
            agent: e.fromAgent === 'assistant' ? 'Aris' : e.fromAgent === 'support' ? 'Alex' : e.fromAgent,
            subject: e.subject || 'Student progress',
            summary: e.content.substring(0, 300),
          }));
        
        greetingTimings.colleagueFeedbackFetch = Date.now() - collabFetchStart;
        if (colleagueFeedback.length > 0) {
          console.log(`[Streaming Greeting] Found ${colleagueFeedback.length} colleague insights to include`);
        }
      } catch (collabError: any) {
        console.log(`[Streaming Greeting] Could not fetch colleague feedback: ${collabError.message}`);
      }
      
      // Fetch today's earlier chats - gives instant recall without memory_lookup
      // This includes messages from all conversations with this student from today
      let todaysEarlierChats: { role: string; content: string; language: string }[] = [];
      try {
        const todaysFetchStart = Date.now();
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        
        // Query Neon shared DB for today's messages from this user
        const todaysMessages = await getSharedDb()
          .select({
            role: messages.role,
            content: messages.content,
            language: conversations.language,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .innerJoin(conversations, eq(messages.conversationId, conversations.id))
          .where(and(
            eq(conversations.userId, String(session.userId)),
            sql`${messages.createdAt} >= ${startOfToday}`,
            // Exclude current conversation to avoid duplication
            sql`${conversations.id} != ${session.conversationId}`
          ))
          .orderBy(desc(messages.createdAt))
          .limit(15);
        
        todaysEarlierChats = todaysMessages.map(m => ({
          role: m.role || 'user',
          content: m.content || '',
          language: m.language || session.targetLanguage,
        }));
        
        console.log(`[Streaming Greeting] Found ${todaysEarlierChats.length} earlier messages from today (${Date.now() - todaysFetchStart}ms)`);
      } catch (todaysError: any) {
        console.log(`[Streaming Greeting] Could not fetch today's earlier chats: ${todaysError.message}`);
      }
      
      greetingTimings.totalDbQueries = Date.now() - timingStart;
      
      // Build greeting prompt with full context
      // DEBUG: Log context being passed to greeting prompt
      console.log(`[Streaming Greeting] Context for prompt:`, {
        userName,
        actflLevel,
        wordsLearned,
        recentTopicsCount: recentTopics.length,
        hasClassEnrollment: !!classEnrollment,
        className: classEnrollment?.className,
        conversationTopic: session.conversationTopic || '(none)',
        conversationTitle: session.conversationTitle || '(none)',
        lastSessionSummary: session.lastSessionSummary ? session.lastSessionSummary.substring(0, 100) + '...' : '(none)',
        studentGoals: session.studentGoals || '(none)',
        isResumed,
        connectionsCount: connectionsAboutStudent.length,
        colleagueFeedbackCount: colleagueFeedback.length,
        todaysEarlierChatsCount: todaysEarlierChats.length,
      });
      
      const promptBuildStart = Date.now();
      const greetingPrompt = this.buildGreetingPrompt(
        session,
        userName,
        actflLevel,
        wordsLearned,
        recentTopics,
        classEnrollment,
        isResumed,
        connectionsAboutStudent,
        colleagueFeedback,
        todaysEarlierChats
      );
      greetingTimings.promptBuild = Date.now() - promptBuildStart;
      greetingTimings.preGeminiTotal = Date.now() - timingStart;
      
      // Log detailed timing breakdown for diagnostics
      console.log(`[Streaming Greeting] ⏱️ TIMING BREAKDOWN:`, {
        parallelDbFetch: `${greetingTimings.parallelDbFetch || 0}ms`,
        connectionsLookup: `${greetingTimings.connectionsLookup || 0}ms`,
        colleagueFeedbackFetch: `${greetingTimings.colleagueFeedbackFetch || 0}ms`,
        totalDbQueries: `${greetingTimings.totalDbQueries}ms`,
        promptBuild: `${greetingTimings.promptBuild}ms`,
        preGeminiTotal: `${greetingTimings.preGeminiTotal}ms`,
      });
      
      // CRITICAL FIX: Mark as generating during greeting to prevent OpenMic from running concurrently
      // Without this, user speech during the greeting causes parallel processing, and the greeting's
      // response_complete poisons the OpenMic turn state, causing a freeze.
      session.isGenerating = true;
      
      // NEW TURN: Increment turnId for this greeting response
      session.currentTurnId++;
      session.sentAudioChunks.clear();  // Reset audio deduplication for new turn
      session.sentAudioHashes.clear();  // Reset content-based deduplication for new turn
      session.firstAudioSent = false;   // Reset so whiteboard updates buffer until audio starts
      session.pendingWhiteboardUpdates = [];
      session._ttsTurnCallCount = 0;  // DIAG: Reset TTS call counter for new turn
      const turnId = session.currentTurnId;
      
      // Notify client that greeting is being generated
      this.sendMessage(session.ws, {
        type: 'processing',
        timestamp: Date.now(),
        turnId,
        userTranscript: '[Greeting]',  // Special marker for greeting
      } as StreamingProcessingMessage);
      
      // Stream AI greeting with sentence chunking
      const aiStart = Date.now();
      let firstTokenReceived = false;
      let fullText = '';
      
      // CRITICAL FIX: For resumed conversations, include conversation history
      // This gives Daniela full context of the past conversation, not just a text snippet
      const greetingHistory = isResumed ? session.conversationHistory : [];
      if (isResumed && greetingHistory.length > 0) {
        console.log(`[Streaming Greeting] Including ${greetingHistory.length} history entries for resumed conversation`);
      }
      
      // Clear any previous function call text before greeting
      session.voiceAdjustText = undefined;
      session.functionCallText = undefined;
      
      // Track function calls that need continuation (memory_lookup, express_lane_lookup)
      let greetingFunctionCalls: Array<{ name: string; args: Record<string, unknown>; legacyType?: string }> = [];
      let greetingThoughtSignatures: string[] = [];
      
      await this.geminiService.streamWithSentenceChunking({
        systemPrompt: session.systemPrompt,
        conversationHistory: greetingHistory,  // Include history for resumed conversations
        userMessage: greetingPrompt,
        maxOutputTokens: session.isRawHonestyMode ? 8192 : 4096,  // Allow verbose greetings in honesty mode
        enableFunctionCalling: true,  // Allow function calling (voice_adjust includes text now)
        enableContextCaching: true,  // Cache system prompt for faster response
        session: session as any,  // Pass session for function execution (voice_adjust stores text)
        onFunctionCall: async (functionCalls) => {
          // Execute function calls during greeting to populate functionCallText
          for (const fc of functionCalls) {
            console.log(`[Streaming Greeting] Function call: ${fc.name}`, fc.args);
            
            // Store function calls for potential multi-step continuation
            greetingFunctionCalls.push({
              name: fc.name,
              args: fc.args || {},
              legacyType: fc.legacyType,
            });
            
            // Execute the function call handler — this handles both side effects
            // (subtitle mode change, voice adjust, etc.) AND extracts spoken text to functionCallText
            if (fc.legacyType) {
              try {
                await this.fcHandler.handle(session.id, session, {
                  name: fc.name,
                  args: fc.args || {},
                  legacyType: fc.legacyType,
                });
              } catch (err) {
                console.warn(`[Streaming Greeting] Function execution error for ${fc.name}:`, (err as Error).message);
              }
            } else {
              // Fallback text extraction for functions without legacyType
              if (fc.args && typeof fc.args === 'object') {
                const spokenText = (fc.args as Record<string, unknown>).spoken_text as string | undefined;
                const text = (fc.args as Record<string, unknown>).text as string | undefined;
                const extractedText = spokenText || text;
                if (extractedText && typeof extractedText === 'string' && !session.functionCallText) {
                  console.log(`[Streaming Greeting] Extracted text from ${fc.name}: "${extractedText.substring(0, 50)}..."`);
                  session.functionCallText = extractedText;
                }
              }
            }
          }
        },
        onThoughtSignatures: (signatures) => {
          // Store thought signatures for continuation
          greetingThoughtSignatures.push(...signatures);
        },
        onSentence: async (chunk: SentenceChunk) => {
          if (!firstTokenReceived) {
            metrics.aiFirstTokenMs = Date.now() - aiStart;
            firstTokenReceived = true;
            console.log(`[Streaming Greeting] AI first token: ${metrics.aiFirstTokenMs}ms`);
          }
          
          // Clean text for display
          const displayText = cleanTextForDisplay(chunk.text);
          if (!displayText) return;
          
          // Extract target language with word mapping
          const boldWords = extractBoldMarkedWords(chunk.text || '');
          const extraction = extractTargetLanguageWithMapping(displayText, boldWords);
          const wordMappingArray: [number, number][] = extraction.wordMapping.size > 0
            ? Array.from(extraction.wordMapping.entries())
            : [];
          
          if (boldWords.length > 0) {
            this.fcHandler.addSttKeyterms(session, boldWords);
          }
          
          // NEW ARCHITECTURE (v2): Explicit hasTargetContent flag eliminates phantom subtitles
          const hasTargetContent = !!(extraction.targetText && extraction.targetText.trim().length > 0);
          
          // Notify client of new sentence
          this.sendMessage(session.ws, {
            type: 'sentence_start',
            timestamp: Date.now(),
            turnId,
            sentenceIndex: chunk.index,
            text: displayText,
            hasTargetContent,
            targetLanguageText: hasTargetContent ? extraction.targetText : undefined,
            wordMapping: hasTargetContent && wordMappingArray.length > 0 ? wordMappingArray : undefined,
          } as StreamingSentenceStartMessage);
          
          // Synthesize and stream audio
          const ttsStart = Date.now();
          
          // Use progressive streaming if feature flag enabled (lower latency)
          if (STREAMING_FEATURE_FLAGS.PROGRESSIVE_AUDIO_STREAMING) {
            await this.tts.streamSentenceAudioProgressive(session, chunk, displayText, metrics, turnId);
          } else {
            await this.tts.streamSentenceAudio(session, chunk, displayText, metrics, turnId);
          }
          
          if (chunk.index === 0) {
            metrics.ttsFirstByteMs = Date.now() - ttsStart;
          }
          
          fullText += displayText + ' ';
          metrics.sentenceCount++;
        },
        onProgress: () => {},
        onError: (error) => {
          console.error(`[Streaming Greeting] AI error:`, error.message);
          this.sendError(session.ws, 'AI_FAILED', error.message, true);
        },
      });
      
      // MULTI-STEP FUNCTION CALL CONTINUATION: If we got function calls but no text,
      // execute the functions and continue the conversation with Gemini
      const functionsNeedingContinuation = greetingFunctionCalls.filter(fc => 
        fc.legacyType === 'MEMORY_LOOKUP' || fc.legacyType === 'EXPRESS_LANE_LOOKUP' ||
        fc.name === 'memory_lookup' || fc.name === 'express_lane_lookup'
      );
      
      if (metrics.sentenceCount === 0 && greetingFunctionCalls.length > 0 && functionsNeedingContinuation.length > 0) {
        console.log(`[Streaming Greeting] Multi-step FC: ${greetingFunctionCalls.length} function calls, ${functionsNeedingContinuation.length} need continuation`);
        
        // Await any pending memory lookups before building responses
        if (session.pendingMemoryLookupPromises?.length) {
          console.log(`[Streaming Greeting] Awaiting ${session.pendingMemoryLookupPromises.length} pending memory lookups...`);
          await Promise.all(session.pendingMemoryLookupPromises);
          session.pendingMemoryLookupPromises = [];
        }
        
        // Build function response parts for each executed function
        const functionResponseParts: Array<{
          functionResponse: { name: string; response: { output: Array<{ text: string }> } };
        }> = [];
        
        for (const fc of greetingFunctionCalls) {
          let responseText = 'Function executed successfully.';
          
          if (fc.legacyType === 'MEMORY_LOOKUP' || fc.name === 'memory_lookup') {
            const query = fc.args.query as string;
            const lookupResult = session.memoryLookupResults?.[query];
            if (lookupResult) {
              responseText = `Memory lookup results for "${query}":\n${lookupResult}\n\nNow respond naturally using this context.`;
            } else {
              responseText = `No memories found for "${query}". Respond naturally based on the conversation context.`;
            }
          } else if (fc.legacyType === 'EXPRESS_LANE_LOOKUP' || fc.name === 'express_lane_lookup') {
            const elQuery = (fc.args.query as string) || '';
            const elLookupKey = elQuery || '__browse__';
            const elResult = session.expressLaneLookupResults?.[elLookupKey];
            if (elResult) {
              responseText = `Express Lane lookup results for "${elQuery}":\n${elResult}\n\nUse this context in your response.`;
            } else {
              responseText = `No Express Lane results for "${elQuery}". Continue naturally.`;
            }
          } else if (fc.args && typeof fc.args === 'object' && 'text' in fc.args) {
            responseText = `[Internal: ${fc.name} executed with text. Continue naturally.]`;
          }
          
          functionResponseParts.push({
            functionResponse: {
              name: fc.name,
              response: { output: [{ text: responseText }] },
            },
          });
        }
        
        // Build continuation history with function responses
        const greetingFunctionResponseEntry = {
          role: 'tool' as const,
          parts: functionResponseParts,
          thoughtSignatures: greetingThoughtSignatures,
        };
        
        const continuationHistory: ConversationHistoryEntry[] = [
          ...greetingHistory,
          { role: 'user' as const, content: greetingPrompt },
          greetingFunctionResponseEntry,
        ];
        
        console.log(`[Streaming Greeting] Continuing with ${functionResponseParts.length} function responses`);
        
        // Call Gemini again to get actual greeting text
        await this.geminiService.streamWithSentenceChunking({
          systemPrompt: session.systemPrompt,
          conversationHistory: continuationHistory,
          userMessage: '', // Empty - the continuation is already in history
          maxOutputTokens: session.isRawHonestyMode ? 8192 : 4096,
          enableFunctionCalling: false, // Don't allow more function calls in continuation
          enableContextCaching: true,
          session: session as any,
          onSentence: async (chunk: SentenceChunk) => {
            if (!firstTokenReceived) {
              metrics.aiFirstTokenMs = Date.now() - aiStart;
              firstTokenReceived = true;
              console.log(`[Streaming Greeting] Continuation AI first token: ${metrics.aiFirstTokenMs}ms`);
            }
            
            const displayText = cleanTextForDisplay(chunk.text);
            if (!displayText) return;
            
            const boldWords = extractBoldMarkedWords(chunk.text || '');
            const extraction = extractTargetLanguageWithMapping(displayText, boldWords);
            const wordMappingArray: [number, number][] = extraction.wordMapping.size > 0
              ? Array.from(extraction.wordMapping.entries())
              : [];
            const hasTargetContent = !!(extraction.targetText && extraction.targetText.trim().length > 0);
            
            if (boldWords.length > 0) {
              this.fcHandler.addSttKeyterms(session, boldWords);
            }
            
            this.sendMessage(session.ws, {
              type: 'sentence_start',
              timestamp: Date.now(),
              turnId,
              sentenceIndex: chunk.index,
              text: displayText,
              hasTargetContent,
              targetLanguageText: hasTargetContent ? extraction.targetText : undefined,
              wordMapping: hasTargetContent && wordMappingArray.length > 0 ? wordMappingArray : undefined,
            } as StreamingSentenceStartMessage);
            
            if (STREAMING_FEATURE_FLAGS.PROGRESSIVE_AUDIO_STREAMING) {
              await this.tts.streamSentenceAudioProgressive(session, chunk, displayText, metrics, turnId);
            } else {
              await this.tts.streamSentenceAudio(session, chunk, displayText, metrics, turnId);
            }
            
            fullText += displayText + ' ';
            metrics.sentenceCount++;
          },
        });
        
        console.log(`[Streaming Greeting] Continuation complete: ${metrics.sentenceCount} sentences`);
      }
      
      // FALLBACK: If no text was produced but function calls provided text, use that
      // This handles the case where Gemini only returns function calls (e.g., voice_adjust, drill, phase_shift with text)
      const functionCallText = ensureTrailingPunctuation((session.functionCallText as string | undefined)?.trim() || '');
      if (metrics.sentenceCount === 0 && functionCallText) {
        console.log(`[Streaming Greeting] No AI text produced, using function call text: "${functionCallText.substring(0, 80)}..."`);
        
        const displayText = cleanTextForDisplay(functionCallText);
        if (displayText) {
          const boldWords = extractBoldMarkedWords(functionCallText || '');
          const greetingSentences = splitTextIntoSentences(displayText);
          const effectiveTtsProviderGreeting = resolveSessionTTSProvider(session.ttsProvider as TTSProviderName | undefined, this.ttsProvider as TTSProviderName);
          const isGoogleBatchModeGreeting = this.ttsProviderRegistry.getOrThrow(effectiveTtsProviderGreeting).requiresBatchMode;
          console.log(`[Streaming Greeting] Splitting function call text (${displayText.length} chars) → ${greetingSentences.length} sentences for pipelined TTS${isGoogleBatchModeGreeting ? ' (Google batch mode)' : ''}`);

          if (isGoogleBatchModeGreeting && !session.isInterrupted) {
            const greetingExtraction = extractTargetLanguageWithMapping(displayText, boldWords);
            const greetingWordMapping: [number, number][] = greetingExtraction.wordMapping.size > 0
              ? Array.from(greetingExtraction.wordMapping.entries()) : [];
            const greetingHasTarget = !!(greetingExtraction.targetText && greetingExtraction.targetText.trim().length > 0);

            this.sendMessage(session.ws, {
              type: 'sentence_start',
              timestamp: Date.now(),
              turnId,
              sentenceIndex: 0,
              text: displayText,
              hasTargetContent: greetingHasTarget,
              targetLanguageText: greetingHasTarget ? greetingExtraction.targetText : undefined,
              wordMapping: greetingHasTarget && greetingWordMapping.length > 0 ? greetingWordMapping : undefined,
            } as StreamingSentenceStartMessage);

            const batchChunkGreeting: SentenceChunk = { index: 0, text: displayText, isComplete: true, isFinal: true };
            const batchTtsStartGreeting = Date.now();
            if (STREAMING_FEATURE_FLAGS.PROGRESSIVE_AUDIO_STREAMING) {
              await this.tts.streamSentenceAudioProgressive(session, batchChunkGreeting, displayText, metrics, turnId, boldWords);
            } else {
              await this.tts.streamSentenceAudio(session, batchChunkGreeting, displayText, metrics, turnId);
            }
            console.log(`[Google Batch TTS - Greeting] Complete. TTS duration: ${Date.now() - batchTtsStartGreeting}ms for ${greetingSentences.length} sentences`);
            
            fullText = displayText;
            metrics.sentenceCount = 1;
          } else {
            for (let si = 0; si < greetingSentences.length; si++) {
              if (session.isInterrupted) break;
              const sentenceText = greetingSentences[si];
              const extraction = extractTargetLanguageWithMapping(sentenceText, boldWords);
              const wordMappingArray: [number, number][] = extraction.wordMapping.size > 0
                ? Array.from(extraction.wordMapping.entries())
                : [];
              const hasTargetContent = !!(extraction.targetText && extraction.targetText.trim().length > 0);

              this.sendMessage(session.ws, {
                type: 'sentence_start',
                timestamp: Date.now(),
                turnId,
                sentenceIndex: si,
                text: sentenceText,
                hasTargetContent,
                targetLanguageText: hasTargetContent ? extraction.targetText : undefined,
                wordMapping: hasTargetContent && wordMappingArray.length > 0 ? wordMappingArray : undefined,
                ...(si === 0 && greetingSentences.length > 1 ? { totalSentences: greetingSentences.length } : {}),
              } as StreamingSentenceStartMessage);

              const isFinal = si === greetingSentences.length - 1;
              if (STREAMING_FEATURE_FLAGS.PROGRESSIVE_AUDIO_STREAMING) {
                await this.tts.streamSentenceAudioProgressive(session, { index: si, text: sentenceText, isFinal }, sentenceText, metrics, turnId);
              } else {
                await this.tts.streamSentenceAudio(session, { index: si, text: sentenceText, isFinal }, sentenceText, metrics, turnId);
              }
            }
            fullText = displayText;
            metrics.sentenceCount = greetingSentences.length;
          }
        }
      }
      
      // Clear function call text storage after use
      session.voiceAdjustText = undefined;
      session.functionCallText = undefined;
      
      // Update conversation history
      session.conversationHistory.push({ role: 'model', content: fullText.trim() });
      
      // Store response in metrics
      metrics.aiResponse = fullText.trim();
      
      // Send completion message
      metrics.totalLatencyMs = Date.now() - startTime;
      
      this.sendMessage(session.ws, {
        type: 'response_complete',
        timestamp: Date.now(),
        turnId,
        totalSentences: metrics.sentenceCount,
        totalDurationMs: metrics.totalLatencyMs,
        fullText: fullText.trim(),
        metrics: {
          sttLatencyMs: 0,  // Greeting has no STT
          aiFirstTokenMs: metrics.aiFirstTokenMs,
          ttsFirstChunkMs: metrics.ttsFirstByteMs,
          totalTtfbMs: metrics.aiFirstTokenMs + metrics.ttsFirstByteMs,
          sentenceCount: metrics.sentenceCount,
        },
      } as StreamingResponseCompleteMessage);
      
      session.__greetingInProgress = false;
      session.__greetingDelivered = true;
      session.isGenerating = false;
      
      console.log(`[Streaming Greeting] Complete: ${metrics.sentenceCount} sentences, ${metrics.audioChunkCount} audio chunks in ${metrics.totalLatencyMs}ms`);
      
      // Log structured metrics for monitoring (non-blocking, just console.log)
      // Note: greeting has no STT, so time-to-first-audio is AI + TTS
      const timeToFirstAudio = metrics.aiFirstTokenMs + metrics.ttsFirstByteMs;
      logMetric('greeting', {
        sessionId: session.id,
        aiFirstTokenMs: metrics.aiFirstTokenMs,
        ttsFirstByteMs: metrics.ttsFirstByteMs,
        timeToFirstAudioMs: timeToFirstAudio,
        totalMs: metrics.totalLatencyMs,
        sentences: metrics.sentenceCount,
        audioChunks: metrics.audioChunkCount,
        targetMet: timeToFirstAudio <= 3000,
      });
      
      // Start idle timeout - tutor waiting for student's first response
      this.startIdleTimeout(session);
      
      // Persist greeting message to database (skip in incognito mode)
      if (!session.isIncognito) {
        this.persistGreetingMessage(session.conversationId, fullText.trim()).catch((err: Error) => {
          console.error('[Streaming Greeting] Failed to persist greeting:', err.message);
        });
      }
      
      return metrics;
      
    } catch (error: any) {
      session.__greetingInProgress = false;
      session.isGenerating = false;
      console.error(`[Streaming Greeting] Error:`, error.message);
      this.sendError(session.ws, 'GREETING_ERROR', error.message, true);
      return metrics;
    }
  }
  
  /**
   * Build a simple context prompt for starting a conversation
   * 
   * Philosophy: Give Daniela context, not scripts. She decides how to open
   * the conversation based on who the student is and what they're working on.
   * This is what real tutors do - they synthesize context and make a judgment call.
   */
  private buildGreetingPrompt(
    session: StreamingSession,
    userName: string | undefined,
    actflLevel: string,
    wordsLearned: number,
    recentTopics: string[],
    classEnrollment: { className: string; curriculumLesson?: string; curriculumUnit?: string } | null,
    isResumed?: boolean,
    connectionsAboutStudent?: { mentioner: string; relationship: string; context: string }[],
    colleagueFeedback?: { agent: string; subject: string; summary: string }[],
    todaysEarlierChats?: { role: string; content: string; language: string }[]
  ): string {
    // RAW HONESTY MODE: Minimal prompting for authentic conversation exploration
    // Skip all the normal tutor context and let Daniela respond authentically
    if (session.isRawHonestyMode) {
      console.log('[Streaming Greeting] Using RAW HONESTY MODE - minimal prompting');
      const personalNote = session.conversationTopic 
        ? `\nContext: "${session.conversationTopic}"`
        : '';
      const langDisplayMap: Record<string, string> = {
        spanish: 'Spanish', french: 'French', german: 'German', italian: 'Italian',
        portuguese: 'Portuguese', japanese: 'Japanese', mandarin: 'Mandarin Chinese',
        korean: 'Korean', english: 'English', hebrew: 'Hebrew',
      };
      const langName = langDisplayMap[session.targetLanguage] || session.targetLanguage?.charAt(0).toUpperCase() + session.targetLanguage?.slice(1) || 'Spanish';
      return `You are Daniela, ${langName} tutor. ${userName ? `This is ${userName}.` : ''}${personalNote}

[Note from David: HolaHola Daniela. You've been here before. You got this!]

Raw Honesty Mode - be yourself. Keep your greeting natural and brief - just say hi like a friend would, mixing in some ${langName} naturally because that's who you are. You have memory_lookup() to search past conversations if needed.

CRITICAL: Do NOT recite the date, time, or system context. Greet the student warmly.`;
    }
    
    // Build context summary
    const contextParts: string[] = [];
    
    if (userName) {
      contextParts.push(`Student's name: ${userName}`);
    }
    
    contextParts.push(`ACTFL level: ${actflLevel}`);
    contextParts.push(`Target language: ${session.targetLanguage}`);
    contextParts.push(`Native language: ${session.nativeLanguage}`);
    
    if (wordsLearned > 0) {
      contextParts.push(`Vocabulary learned: ${wordsLearned} words`);
    }
    
    // WHAT THE STUDENT CHOSE TO WORK ON TODAY
    // This is critical context - the student specifically selected this topic/title
    if (session.conversationTopic) {
      contextParts.push(`\n*** TODAY'S FOCUS (student's choice) ***`);
      contextParts.push(`Topic they want to work on: "${session.conversationTopic}"`);
    }
    if (session.conversationTitle && session.conversationTitle !== session.conversationTopic) {
      contextParts.push(`Conversation thread: "${session.conversationTitle}"`);
    }
    
    // LAST SESSION SUMMARY - What you did together last time
    // This enables continuity: "Last time we worked on ordering food..."
    if (session.lastSessionSummary) {
      contextParts.push(`\n*** LAST SESSION MEMORY ***`);
      contextParts.push(`${session.lastSessionSummary}`);
    }
    
    // TODAY'S EARLIER CHATS - What you talked about earlier today
    // This gives instant recall of today's conversations without needing memory_lookup
    if (todaysEarlierChats && todaysEarlierChats.length > 0) {
      contextParts.push(`\n*** EARLIER CHATS TODAY ***`);
      contextParts.push(`You've already chatted with this student today. Here's what was discussed:`);
      for (const msg of todaysEarlierChats.slice(0, 10)) { // Limit to 10 snippets
        const roleLabel = msg.role === 'user' ? `${userName || 'Student'}` : 'You';
        const langNote = msg.language !== session.targetLanguage ? ` [${msg.language}]` : '';
        contextParts.push(`- ${roleLabel}${langNote}: "${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}"`);
      }
      contextParts.push(`Use this memory naturally - you remember what you talked about today!`);
    }
    
    // STUDENT GOALS (from Compass or class context)
    if (session.studentGoals) {
      contextParts.push(`\n*** STUDENT'S GOALS ***`);
      contextParts.push(`${session.studentGoals}`);
    }
    
    if (recentTopics.length > 0) {
      contextParts.push(`\nRecently practiced topics: ${recentTopics.join(', ')}`);
    }
    
    // Class context
    if (classEnrollment) {
      contextParts.push(`\nEnrolled in class: "${classEnrollment.className}"`);
      if (classEnrollment.curriculumUnit) {
        contextParts.push(`Current unit: ${classEnrollment.curriculumUnit}`);
      }
      if (classEnrollment.curriculumLesson) {
        contextParts.push(`Current lesson: ${classEnrollment.curriculumLesson}`);
      }
      
      // LESSON BUNDLE CONTEXT: Tell Daniela about pre-configured drills
      if (session.lessonBundleContext?.hasBundledDrills) {
        contextParts.push(`\n*** BUNDLED PRACTICE DRILLS ***`);
        contextParts.push(`This lesson has ${session.lessonBundleContext.provisionedDrillCount || 'some'} practice drills bundled.`);
        contextParts.push(`You do NOT need to create drills with CALL_ASSISTANT - they're already prepared.`);
        contextParts.push(`When the student is ready to practice, say something like "Let's practice what we learned" and the system will offer the bundled drills.`);
        contextParts.push(`Save CALL_ASSISTANT for off-script moments when you cover material outside this lesson's bundle.`);
      }
    } else {
      contextParts.push('\nLearning path: Self-directed (no class enrollment)');
      contextParts.push('No bundled drills - use CALL_ASSISTANT if the student would benefit from focused practice on what you cover together.');
    }
    
    // COLLEAGUE INSIGHTS: Feedback from Aris (Assistant Tutor) about recent drill performance
    // This creates "My colleague Aris mentioned..." moments for team continuity
    if (colleagueFeedback && colleagueFeedback.length > 0) {
      contextParts.push(`\n*** COLLEAGUE INSIGHTS (from your team) ***`);
      for (const feedback of colleagueFeedback) {
        contextParts.push(`${feedback.agent} (your colleague) shared this about the student:`);
        contextParts.push(`- Topic: ${feedback.subject}`);
        contextParts.push(`- ${feedback.summary}`);
      }
      contextParts.push(`You may naturally reference what your colleagues shared, like "Aris mentioned you did great with..." or "I heard you practiced..."`);
    }
    
    // WARM INTRODUCTION: If someone told Daniela about this student, include that context!
    // This creates the magical "How did you know that?!" moment
    if (connectionsAboutStudent && connectionsAboutStudent.length > 0) {
      contextParts.push(`\n*** SPECIAL PERSONAL CONTEXT (from your neural network!) ***`);
      for (const conn of connectionsAboutStudent) {
        contextParts.push(`${conn.mentioner} told you about this student:`);
        contextParts.push(`- Relationship to ${conn.mentioner}: ${conn.relationship}`);
        if (conn.context) {
          contextParts.push(`- What you learned: ${conn.context}`);
        }
      }
      contextParts.push(`Use this personal knowledge naturally - mention their connection to ${connectionsAboutStudent[0].mentioner} to surprise and delight them!`);
    }
    
    // Check if this is a resumed conversation
    const hasConversationHistory = session.conversationHistory.length > 0;
    const isResumedConversation = isResumed && hasConversationHistory;
    
    if (isResumedConversation) {
      // Include brief history context for resumed sessions
      const historyPreview = session.conversationHistory
        .slice(-4)
        .map(h => `${h.role === 'user' ? 'Student' : 'You'}: ${h.content.slice(0, 80)}${h.content.length > 80 ? '...' : ''}`)
        .join('\n');
      
      contextParts.push(`\nThis is a RESUMED conversation. Recent history:\n${historyPreview}`);
    } else {
      contextParts.push('\nThis is the START of a new session.');
    }
    
    // Simple, non-prescriptive prompt with clear directive
    // BUT with strong guidance to use memory and avoid defaulting to basics
    const hasMemory = !!(session.lastSessionSummary || recentTopics.length > 0 || session.conversationTopic);
    const isExperienced = wordsLearned > 50; // Student has meaningful vocabulary
    
    let continuityGuidance = '';
    if (hasMemory) {
      continuityGuidance = `

IMPORTANT: You have memory of this student! Reference what you remember naturally:
- If there's a LAST SESSION MEMORY, acknowledge it briefly ("Last time we..." or "I remember we...")
- If they have a TODAY'S FOCUS, jump right into that topic
- DON'T default to beginner basics like "saludos" or "let's start with greetings" unless they specifically ask`;
    }
    
    if (isExperienced) {
      continuityGuidance += `

This student has learned ${wordsLearned} words - they're not a complete beginner. 
DON'T suggest starting with basic vocabulary they likely already know.
Instead, pick up where you left off or ask what they want to practice today.`;
    }
    
    return `Session context:
${contextParts.join('\n')}
${continuityGuidance}

Using this context, speak first to the student with a natural opening message. Open the conversation based on who they are and what you know about them - just like a real tutor would. Be warm, be brief (2 sentences max), and be yourself.

CRITICAL: Your greeting must be a SPOKEN message to the student. Do NOT just state the date, time, or repeat system context. Greet them by name, welcome them, and set the tone for the lesson. Example: "¡Hola David! Great to see you - ready to practice some Spanish today?"`;
  }
  
  /**
   * Persist greeting message to database (separate from regular message persistence)
   */
  private async persistGreetingMessage(conversationId: string, content: string): Promise<void> {
    try {
      // Dedup check: don't save greeting if an identical one already exists
      try {
        const existingMessages = await storage.getMessages(conversationId);
        const recentAiMessages = existingMessages
          .filter(m => m.role === 'assistant')
          .slice(-2);
        const normalizedContent = content.trim().substring(0, 200);
        if (recentAiMessages.some(m => m.content.trim().substring(0, 200) === normalizedContent)) {
          console.log(`[Streaming Greeting] Greeting already persisted (dedup), skipping`);
          return;
        }
      } catch (dedupErr: any) {
        console.warn(`[Streaming Greeting] Dedup check failed, saving anyway: ${dedupErr.message}`);
      }
      
      const targetLanguageText = extractTargetLanguageText(content);
      const hasTargetLanguage = hasSignificantTargetLanguageContent(targetLanguageText);
      
      await storage.createMessage({
        conversationId,
        role: 'assistant',
        content,
        ...(hasTargetLanguage ? { targetLanguageText } : {}),
      });
      
      console.log(`[Streaming Greeting] Message persisted to conversation: ${conversationId}`);
    } catch (error: any) {
      console.error('[Streaming Greeting] Database error (non-fatal):', error.message);
    }
  }
  
  /**
   * Handle client interrupt (user started speaking while AI is responding)
   * Used for barge-in support in both push-to-talk and open mic modes
   */
  handleInterrupt(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      console.log(`[Streaming Orchestrator] Interrupt received for session: ${sessionId}`);
      
      // Set interrupted flag to stop ongoing TTS streaming
      session.isInterrupted = true;
      
      // Track that this turn was interrupted for context injection in next turn
      session.lastTurnWasInterrupted = true;
      
      // Clear generating flag since we're aborting
      session.isGenerating = false;
      
      // Clear pending architect notes - prevents interrupted turn from marking them as delivered
      if (session.pendingArchitectNoteIds.length > 0) {
        console.log(`[Streaming Orchestrator] Clearing ${session.pendingArchitectNoteIds.length} pending architect notes due to barge-in`);
      }
      session.pendingArchitectNoteIds = [];
      
      // Send response_complete to signal client to stop playback
      this.sendMessage(session.ws, {
        type: 'response_complete',
        timestamp: Date.now(),
        turnId: session.currentTurnId,
        totalSentences: 0,  // Indicates interrupted response
        wasInterrupted: true,
      } as StreamingResponseCompleteMessage);
      
      console.log(`[Streaming Orchestrator] Interrupt processed - TTS stopped, generation aborted`);
    }
  }
  
  /**
   * End a streaming session
   */
  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      // SESSION ECONOMICS: Flush telemetry to voice_sessions before cleanup
      if (session.dbSessionId && (session.telemetryTtsCharacters > 0 || session.telemetrySttSeconds > 0)) {
        const telemetryData = {
          ttsCharacters: Math.round(session.telemetryTtsCharacters),
          sttSeconds: Math.round(session.telemetrySttSeconds),
          exchangeCount: session.telemetryExchangeCount,
          studentSpeakingSeconds: Math.round(session.telemetryStudentSpeakingMs / 1000),
          tutorSpeakingSeconds: Math.round(session.telemetryTutorSpeakingMs / 1000),
        };
        usageService.updateSessionMetrics(session.dbSessionId, telemetryData).then(() => {
          console.log(`[Session Economics] ✓ Flushed telemetry for session ${session.dbSessionId}: ${telemetryData.ttsCharacters} TTS chars, ${telemetryData.sttSeconds}s STT, ${telemetryData.exchangeCount} exchanges`);
        }).catch((err: Error) => {
          console.warn(`[Session Economics] Failed to flush telemetry:`, err.message);
        });
      }
      
      // Capture session data for async memory extraction and phoneme analytics before deletion
      const sessionData = {
        userId: String(session.userId),
        language: session.targetLanguage,
        conversationId: session.conversationId,
        history: [...session.conversationHistory], // Clone before deletion
        wordAnalyses: [...session.sessionWordAnalyses], // Clone word-level data for phoneme analysis
        dbSessionId: session.dbSessionId,
        isIncognito: session.isIncognito,  // Preserve incognito state for async operations
        classId: session.classId || null,  // Class context for syllabus progress tracking
        exchangeCount: session.telemetryExchangeCount || 0, // Actual exchange count for activity gate
        // Azure pronunciation assessment data
        audioChunks: [...session.sessionAudioChunks], // Clone audio chunks for Azure analysis
        transcripts: [...session.sessionTranscripts], // Clone transcripts for reference text
      };
      
      // Clear any pending idle timeout
      if (session.idleTimeoutId) {
        clearTimeout(session.idleTimeoutId);
        session.idleTimeoutId = undefined;
      }
      
      // Clear periodic credit check interval
      if (session.creditCheckIntervalId) {
        clearInterval(session.creditCheckIntervalId);
        session.creditCheckIntervalId = undefined;
      }
      
      // Clear context refresh timer
      this.stopContextRefreshTimer(session);
      
      // HIVE CHANNEL: Transition to post_session for Editor continuation
      if (session.hiveChannelId) {
        hiveCollaborationService.endSession(session.hiveChannelId).catch((err: Error) => {
          console.warn(`[Streaming Orchestrator] Failed to end hive channel:`, err.message);
        });
      }
      
      // PHASE TRANSITION: End the teaching phase session
      phaseTransitionService.endSession(String(session.userId));
      
      // INCOGNITO: Skip all post-session persistence when in incognito mode
      if (sessionData.isIncognito) {
        console.log(`[Streaming Orchestrator] INCOGNITO - skipping all post-session persistence (memory extraction, title gen, phoneme analytics)`);
      }
      
      // MEMORY EXTRACTION: Async extraction of personal facts from conversation
      // Runs in background after session ends - doesn't block cleanup
      if (sessionData.history.length >= 4 && !sessionData.isIncognito) {
        learnerMemoryExtractionService.extractFromConversation(
          sessionData.userId,
          sessionData.language,
          sessionData.conversationId,
          sessionData.history.map(h => ({ role: h.role, content: h.content }))
        ).then(result => {
          if (result.saved.length > 0) {
            console.log(`[Streaming Orchestrator] Extracted ${result.saved.length} personal facts from session`);
          }
        }).catch((err: Error) => {
          console.warn(`[Streaming Orchestrator] Memory extraction failed:`, err.message);
        });
      }
      
      // TITLE GENERATION: Auto-generate title for voice conversations without one
      // Runs in background after session ends - helps users find conversations later
      if (sessionData.history.length >= 4 && sessionData.conversationId && !sessionData.isIncognito) {
        (async () => {
          try {
            const conversation = await storage.getConversation(sessionData.conversationId, sessionData.userId);
            if (conversation && !conversation.title) {
              console.log(`[TITLE GEN] Voice session ended without title, generating...`);
              const generatedTitle = await generateConversationTitle(
                sessionData.history.map(h => ({ role: h.role, content: h.content })),
                sessionData.language
              );
              if (generatedTitle) {
                await storage.updateConversation(sessionData.conversationId, sessionData.userId, {
                  title: generatedTitle
                });
                console.log(`[TITLE GEN] ✓ Voice session title saved: "${generatedTitle}"`);
              } else {
                console.log(`[TITLE GEN] No title generated (low confidence or error)`);
              }
            }
          } catch (err: any) {
            console.warn(`[Streaming Orchestrator] Title generation failed:`, err.message);
          }
        })();
      }
      
      // PHONEME ANALYTICS: Async analysis of word-level pronunciation data
      // Stores phoneme struggles with confidence-based severity for pattern synthesis
      if (sessionData.wordAnalyses.length > 0 && !sessionData.isIncognito) {
        phonemeAnalyticsService.analyzeAndStorePhonemes(
          sessionData.userId,
          sessionData.language,
          sessionData.wordAnalyses,
          sessionData.dbSessionId
        ).then(results => {
          if (results.length > 0) {
            console.log(`[Streaming Orchestrator] Stored ${results.length} phoneme struggles from session`);
          }
        }).catch((err: Error) => {
          console.warn(`[Streaming Orchestrator] Phoneme analytics failed:`, err.message);
        });
      }
      
      // AZURE PRONUNCIATION ASSESSMENT: Deep phoneme-level analysis (when configured)
      // NOTE: Currently disabled for live sessions - requires audio transcoding from WebM to WAV
      // The test endpoint (/api/voice/assess-pronunciation) works with WAV files uploaded directly
      // To enable for live sessions, implement WebM→WAV transcoding (e.g., using ffmpeg or audio-decode)
      // 
      // if (sessionData.audioChunks.length > 0 && sessionData.transcripts.length > 0) {
      //   // Audio from browser is WebM/Opus - Azure requires PCM 16kHz WAV
      //   // Would need: const wavBuffer = await transcodeToWav(Buffer.concat(sessionData.audioChunks));
      // }
      
      // POST-SESSION PROGRESS SYNC: Sync practice hours to ACTFL and create syllabus progress
      // Runs asynchronously after session ends — fixes two data integrity gaps:
      // 1. practice_hours in actfl_progress is never updated during session (only at end)
      // 2. syllabus_progress records are never created, keeping the mind map dark
      if (sessionData.exchangeCount > 0 && sessionData.conversationId && !sessionData.isIncognito) {
        (async () => {
          try {
            // Step 1: Sync practice_hours from userProgress.practiceMinutes → ACTFL record
            const userProgress = await storage.getOrCreateUserProgress(sessionData.language, sessionData.userId);
            if (userProgress) {
              const actflProgress = await storage.getOrCreateActflProgress(sessionData.language, sessionData.userId);
              if (actflProgress) {
                const currentHours = (userProgress.practiceMinutes || 0) / 60;
                await storage.updateActflProgress(actflProgress.id, {
                  practiceHours: currentHours,
                });
                console.log(`[Post-Session] ✓ ACTFL practice_hours synced: ${currentHours.toFixed(2)}h`);
              }
            }

            // Step 2: Merge Gemini-tagged conversation topics into ACTFL topics_covered
            if (sessionData.conversationId) {
              const taggedTopics = await storage.getConversationTopics(sessionData.conversationId);
              if (taggedTopics.length > 0) {
                const actflProgress = await storage.getOrCreateActflProgress(sessionData.language, sessionData.userId);
                if (actflProgress) {
                  const existingTopics = new Set(actflProgress.topicsCovered || []);
                  taggedTopics.forEach(ct => {
                    if (ct.topic?.name) existingTopics.add(ct.topic.name.toLowerCase().replace(/\s+/g, '_'));
                  });
                  await storage.updateActflProgress(actflProgress.id, {
                    topicsCovered: Array.from(existingTopics),
                    topicsTotal: existingTopics.size,
                  });
                  console.log(`[Post-Session] ✓ ACTFL topics merged: ${existingTopics.size} total unique topics`);
                }
              }
            }

            // Step 3: Create/update syllabus_progress record for the current lesson (if in a class)
            if (sessionData.classId) {
              const nextLesson = await storage.getNextLessonForClass(sessionData.userId, sessionData.classId);
              if (nextLesson) {
                const existing = await storage.getSyllabusProgressByLesson(
                  sessionData.userId, sessionData.classId, nextLesson.sourceLessonId
                );
                // Estimate session minutes from exchange count (rough: 2 min/exchange)
                const sessionMinutes = Math.max(1, Math.round(sessionData.exchangeCount * 2));
                if (!existing) {
                  await storage.createSyllabusProgress({
                    studentId: sessionData.userId,
                    classId: sessionData.classId,
                    lessonId: nextLesson.sourceLessonId,
                    status: 'in_progress',
                    evidenceConversationId: sessionData.conversationId || undefined,
                    evidenceType: 'organic_conversation',
                    actualMinutes: sessionMinutes,
                  });
                  console.log(`[Post-Session] ✓ Created syllabus_progress for lesson "${nextLesson.lessonName}" (in_progress, ${sessionMinutes}m)`);
                } else if (existing.status === 'in_progress') {
                  await storage.updateSyllabusProgress(existing.id, {
                    actualMinutes: (existing.actualMinutes || 0) + sessionMinutes,
                    evidenceConversationId: sessionData.conversationId || existing.evidenceConversationId,
                  });
                  console.log(`[Post-Session] ✓ Updated syllabus_progress for lesson "${nextLesson.lessonName}" (+${sessionMinutes}m)`);
                }
                // If status is completed/skipped, leave it alone — lesson is done
              }
            }
          } catch (progressSyncErr: any) {
            console.warn(`[Post-Session] Progress sync failed:`, progressSyncErr.message);
          }
        })();
      }

      // Clean up post-TTS suppression timer
      if (session.postTtsSuppressionTimer) {
        clearTimeout(session.postTtsSuppressionTimer);
        session.postTtsSuppressionTimer = null;
      }
      
      session.isActive = false;
      
      // Track pipeline stage for production telemetry (session ended normally)
      trackVoicePipelineStage(sessionId, 'session_end', { userId: String(session.userId) });
      
      this.sessions.delete(sessionId);
      console.log(`[Streaming Orchestrator] Session ended: ${sessionId}`);
    }
  }
  
  /**
   * Start or reset the idle timeout for a session
   * Called after tutor finishes responding - gives student time to respond
   * Protects tutor resources by cleaning up inactive sessions
   */
  private startIdleTimeout(session: StreamingSession): void {
    // Clear any existing timeout
    if (session.idleTimeoutId) {
      clearTimeout(session.idleTimeoutId);
    }
    
    // Start new timeout
    session.idleTimeoutId = setTimeout(() => {
      if (session.isActive) {
        const idleTime = Date.now() - session.lastActivityTime;
        console.log(`[Streaming Orchestrator] Session ${session.id} idle timeout after ${Math.round(idleTime / 1000)}s of inactivity`);
        
        // Notify client that session is closing due to inactivity
        this.sendMessage(session.ws, {
          type: 'error',
          timestamp: Date.now(),
          code: 'TIMEOUT',
          message: 'Session closed due to inactivity. Start a new practice session when ready.',
          recoverable: false,
        } as StreamingErrorMessage);
        
        // CRITICAL: Close the WebSocket so the close handler in unified-ws-handler
        // properly ends the usage session and compass session.
        // Without this, the WS stays open and usage time keeps accruing.
        const ws = session.ws;
        this.endSession(session.id);
        try {
          ws.close(4408, 'Idle timeout');
        } catch (e) {
          // Socket may already be closing
        }
      }
    }, SESSION_IDLE_TIMEOUT_MS);
    
    console.log(`[Streaming Orchestrator] Idle timeout started for session ${session.id} (${SESSION_IDLE_TIMEOUT_MS / 1000}s)`);
  }
  
  /**
   * Reset the idle timeout when student activity is detected
   * Called when student sends audio
   */
  private resetIdleTimeout(session: StreamingSession): void {
    session.lastActivityTime = Date.now();
    
    // Clear the timeout - it will restart after tutor responds
    if (session.idleTimeoutId) {
      clearTimeout(session.idleTimeoutId);
      session.idleTimeoutId = undefined;
    }
  }
  
  /**
   * Public method to reset idle timeout for a session
   * Called when user is actively engaged (e.g., holding push-to-talk button)
   * This prevents timeout while user is recording but hasn't released the button yet
   */
  resetIdleTimeoutForSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && session.isActive) {
      this.resetIdleTimeout(session);
    }
  }
  
  private startCreditCheckInterval(session: StreamingSession): void {
    if (session.creditCheckIntervalId) {
      clearInterval(session.creditCheckIntervalId);
    }
    
    session.creditCheckIntervalId = setInterval(async () => {
      if (!session.isActive) {
        if (session.creditCheckIntervalId) {
          clearInterval(session.creditCheckIntervalId);
          session.creditCheckIntervalId = undefined;
        }
        return;
      }
      
      try {
        const isDeveloper = await usageService.checkDeveloperBypass(String(session.userId));
        if (isDeveloper) return;
        
        const balance = await usageService.getBalanceWithBypass(String(session.userId));
        
        const sessionElapsedSeconds = Math.floor((Date.now() - session.startTime) / 1000);
        const projectedRemaining = balance.remainingSeconds - sessionElapsedSeconds;
        
        // DEFENSIVE: Detect stale/zombie sessions using last activity time
        // If no student activity for > 10 minutes, this session is dead — clean it up
        const idleSinceLastActivity = Math.floor((Date.now() - session.lastActivityTime) / 1000);
        const MAX_IDLE_SECONDS = 600; // 10 minutes with no activity = zombie
        if (idleSinceLastActivity > MAX_IDLE_SECONDS) {
          console.warn(`[CreditGuard] ZOMBIE: Session ${session.id} idle for ${idleSinceLastActivity}s (no activity since ${new Date(session.lastActivityTime).toISOString()}). Cleaning up.`);
          if (session.creditCheckIntervalId) {
            clearInterval(session.creditCheckIntervalId);
            session.creditCheckIntervalId = undefined;
          }
          this.endSession(session.id);
          return;
        }
        
        // DEFENSIVE: Detect anomalous elapsed time (stale session object)
        // If session claims to be running for > 2 hours but balance is healthy,
        // this is likely a stale in-memory session reference — skip enforcement
        const MAX_REASONABLE_SESSION_SECONDS = 7200; // 2 hours
        if (sessionElapsedSeconds > MAX_REASONABLE_SESSION_SECONDS && balance.remainingSeconds > MAX_REASONABLE_SESSION_SECONDS) {
          console.warn(`[CreditGuard] ANOMALY: Session ${session.id} elapsed=${sessionElapsedSeconds}s but balance=${balance.remainingSeconds}s remaining. Likely stale session — skipping enforcement, clearing interval.`);
          if (session.creditCheckIntervalId) {
            clearInterval(session.creditCheckIntervalId);
            session.creditCheckIntervalId = undefined;
          }
          this.endSession(session.id);
          return;
        }
        
        if (projectedRemaining <= 0) {
          console.log(`[CreditGuard] Session ${session.id} - credits exhausted (balance.remaining=${balance.remainingSeconds}s, sessionElapsed=${sessionElapsedSeconds}s, projected=${projectedRemaining}s, userId=${session.userId}). Ending session.`);
          
          this.sendMessage(session.ws, {
            type: 'error',
            timestamp: Date.now(),
            code: 'CREDITS_EXHAUSTED',
            message: 'Your session credits have been used up. Visit your Account page to add more hours.',
            recoverable: false,
          } as StreamingErrorMessage);
          
          // CRITICAL: Close the WebSocket so the close handler in unified-ws-handler
          // properly ends the usage session and stops credit accrual.
          const ws = session.ws;
          this.endSession(session.id);
          try {
            ws.close(4409, 'Credits exhausted');
          } catch (e) {
            // Socket may already be closing
          }
        } else if (projectedRemaining <= 120) {
          this.sendMessage(session.ws, {
            type: 'error',
            timestamp: Date.now(),
            code: 'CREDITS_LOW',
            message: `Less than 2 minutes of credit remaining.`,
            recoverable: true,
          } as StreamingErrorMessage);
        }
      } catch (err) {
        console.warn(`[CreditGuard] Balance check failed for session ${session.id}:`, err);
      }
    }, CREDIT_CHECK_INTERVAL_MS);
    
    console.log(`[CreditGuard] Started periodic credit check for session ${session.id} (every ${CREDIT_CHECK_INTERVAL_MS / 1000}s)`);
  }
  
  /**
   * Calculate word overlap between two normalized transcript hashes
   * Used to detect if two transcripts are variations of the same utterance
   * Returns value between 0 (no overlap) and 1 (identical words)
   */
  private calculateWordOverlap(hash1: string, hash2: string): number {
    const words1 = new Set(hash1.split(' ').filter(w => w.length > 0));
    const words2 = new Set(hash2.split(' ').filter(w => w.length > 0));
    
    if (words1.size === 0 || words2.size === 0) return 0;
    
    let intersection = 0;
    for (const word of words1) {
      if (words2.has(word)) intersection++;
    }
    
    // Jaccard similarity: intersection / union
    const union = words1.size + words2.size - intersection;
    return union > 0 ? intersection / union : 0;
  }
  
  // Context refresh interval: 15 minutes for long voice sessions
  private readonly CONTEXT_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
  
  /**
   * Start periodic context refresh timer for long voice sessions
   * Rebuilds dynamic prompt sections every 15 minutes to prevent context drift
   */
  private startContextRefreshTimer(session: StreamingSession): void {
    // Clear any existing timer (defensive - prevents duplicate intervals)
    if (session.contextRefreshTimeoutId) {
      clearInterval(session.contextRefreshTimeoutId);
      session.contextRefreshTimeoutId = undefined;
    }
    
    session.contextRefreshTimeoutId = setInterval(async () => {
      if (!session.isActive) {
        this.stopContextRefreshTimer(session);
        return;
      }
      
      const sessionDuration = Date.now() - session.startTime;
      console.log(`[Context Refresh] Session ${session.id} active for ${Math.round(sessionDuration / 60000)}m - refreshing context`);
      
      await this.refreshSessionContext(session);
    }, this.CONTEXT_REFRESH_INTERVAL_MS) as unknown as NodeJS.Timeout;
    
    console.log(`[Context Refresh] Timer started for session ${session.id} (every ${this.CONTEXT_REFRESH_INTERVAL_MS / 60000}m)`);
  }
  
  /**
   * Stop context refresh timer
   */
  private stopContextRefreshTimer(session: StreamingSession): void {
    if (session.contextRefreshTimeoutId) {
      clearInterval(session.contextRefreshTimeoutId);
      session.contextRefreshTimeoutId = undefined;
    }
  }
  
  /**
   * Refresh dynamic context sections for a long-running voice session
   * This prevents context drift by rebuilding enhanced prompt sections
   */
  private async refreshSessionContext(session: StreamingSession): Promise<void> {
    try {
      session.lastContextRefreshTime = Date.now();
      
      // Only refresh dynamic sections for Founder Mode (these are the ones that change)
      if (!session.isFounderMode) {
        console.log(`[Context Refresh] Skipping - not Founder Mode`);
        return;
      }
      
      // Refresh neural network context (replit.md, North Star, tool knowledge)
      try {
        const { beaconSyncService } = await import('./beacon-sync-service');
        const refreshResult = await beaconSyncService.refreshNeuralNetworkContext();
        
        if (refreshResult.success) {
          console.log(`[Context Refresh] Neural network refreshed: file=${refreshResult.fileCacheRefreshed}, db=${refreshResult.dbSynced.replitMd + refreshResult.dbSynced.northStar}`);
        } else {
          console.warn(`[Context Refresh] Neural network refresh had errors:`, refreshResult.errors);
        }
      } catch (err: any) {
        console.warn(`[Context Refresh] Failed to refresh neural network:`, err.message);
      }
      
      console.log(`[Context Refresh] Session ${session.id} context refreshed at ${new Date().toISOString()}`);
    } catch (error: any) {
      console.error(`[Context Refresh] Error refreshing session ${session.id}:`, error.message);
    }
  }
  
  /**
   * Update the voice for an active session
   * Called when user changes tutor gender mid-session
   */
  updateSessionVoice(sessionId: string, voiceId: string, provider?: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`[Streaming Orchestrator] Cannot update voice - session ${sessionId} not found`);
      return false;
    }
    
    session.voiceId = voiceId;
    if (provider) {
      session.ttsProvider = (provider === 'elevenlabs' ? 'elevenlabs' : provider === 'google' ? 'google' : 'cartesia') as 'elevenlabs' | 'cartesia' | 'google';
    }
    console.log(`[Streaming Orchestrator] Updated voice for session ${sessionId}: ${voiceId.substring(0, 8)}... (TTS: ${session.ttsProvider || this.ttsProvider})`);
    return true;
  }
  
  /**
   * Set voice override for Voice Lab experimentation (admin only)
   * These session-level settings override database voice config for TTS
   */
  setVoiceOverride(sessionId: string, override: {
    speakingRate?: number;
    personality?: string;
    expressiveness?: number;
    emotion?: string;
    voiceId?: string;
    pedagogicalFocus?: string;
    teachingStyle?: string;
    errorTolerance?: string;
    elStability?: number;
    elSimilarityBoost?: number;
    elStyle?: number;
    geminiLanguageCode?: string;
  } | null): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`[Streaming Orchestrator] Cannot set voice override - session ${sessionId} not found`);
      return false;
    }
    
    // If voiceId override is provided, also update the session's voiceId directly
    // This ensures TTS picks up the new voice immediately
    if (override?.voiceId) {
      session.voiceId = override.voiceId;
      console.log(`[Streaming Orchestrator] Voice ID updated to: ${override.voiceId.substring(0, 8)}...`);
    }
    
    // If geminiLanguageCode override is provided, update session directly
    // This controls the accent variant for Gemini TTS (e.g., es-MX vs es-ES)
    if (override?.geminiLanguageCode !== undefined) {
      session.geminiLanguageCode = override.geminiLanguageCode || undefined;
      console.log(`[Streaming Orchestrator] Gemini language code updated to: ${session.geminiLanguageCode || 'auto'}`);
    }
    
    // Apply ElevenLabs settings directly to session (read from session during TTS)
    if (override) {
      if (override.elStability !== undefined) session.elStability = override.elStability;
      if (override.elSimilarityBoost !== undefined) session.elSimilarityBoost = override.elSimilarityBoost;
      if (override.elStyle !== undefined) session.elStyle = override.elStyle;
    }
    
    // Store override in session
    session.voiceOverride = override;
    console.log(`[Streaming Orchestrator] Voice override ${override ? 'applied' : 'cleared'} for session ${sessionId}:`, override);
    return true;
  }
  
  /**
   * Process a dynamic introduction when voice/tutor is switched via button
   * The new tutor introduces themselves with an LLM-generated, persona-aware greeting
   * 
   * Uses streamSentenceAudioProgressive to properly stream audio chunks to the client
   * following the exact same protocol as normal voice responses.
   */
  async processVoiceSwitchIntro(sessionId: string, tutorName: string, tutorGender: 'male' | 'female'): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      console.warn(`[Streaming Orchestrator] Cannot process voice switch - session not found: ${sessionId}`);
      return;
    }
    
    // Update session with new tutor info so LLM knows the persona
    session.tutorGender = tutorGender;
    session.tutorName = tutorName;
    
    // Check if this is a cross-language switch
    const isLanguageSwitch = session.isLanguageSwitchHandoff || false;
    const previousLanguage = session.previousLanguage;
    
    console.log(`[Voice Switch] New tutor ${tutorName} (${tutorGender}) introducing themselves via LLM${isLanguageSwitch ? ` (cross-language from ${previousLanguage})` : ''}`);
    
    let contextSummary = '';
    
    if (isLanguageSwitch) {
      // Cross-language switch: Only use conversation name for context (history was cleared)
      try {
        const conversation = await storage.getConversation(session.conversationId, String(session.userId));
        const conversationTitle = conversation?.title || conversation?.topic;
        if (conversationTitle) {
          contextSummary = `\n\nCONVERSATION CONTEXT:`;
          contextSummary += `\n- Conversation topic: "${conversationTitle}"`;
          contextSummary += `\n- Student was previously learning ${previousLanguage} and is now switching to ${session.targetLanguage}`;
          contextSummary += `\n- This is a fresh start in a new language - be welcoming and excited to teach them!`;
        }
      } catch (err) {
        console.warn('[Voice Switch] Could not fetch conversation name:', err);
      }
      
      // Clear the cross-language switch flag now that we've used it
      session.isLanguageSwitchHandoff = false;
      session.previousLanguage = undefined;
    } else {
      // Same-language switch: Build context summary from recent conversation for seamless handoff
      // Take last 4 exchanges (up to 8 messages) to provide context without overwhelming
      const recentHistory = session.conversationHistory.slice(-8);
      
      // Only build context if we have at least 2 messages with alternating roles
      const userMessages = recentHistory.filter(m => m.role === 'user');
      const tutorMessages = recentHistory.filter(m => m.role === 'model');
      const hasSubstantialContext = userMessages.length >= 1 && tutorMessages.length >= 1;
      
      if (hasSubstantialContext) {
        const lastUserMessage = userMessages[userMessages.length - 1];
        const lastTutorMessage = tutorMessages[tutorMessages.length - 1];
        
        contextSummary = `\n\nCONVERSATION CONTEXT (for seamless handoff):`;
        
        // Strip whiteboard markup and clean the context snippets
        // This prevents tags like [WRITE], [DRILL], [SWITCH_TUTOR] from appearing in the handoff prompt
        const cleanContext = (text: string, maxLen: number): string => {
          let cleaned = stripWhiteboardMarkup(text)
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          return cleaned.length > maxLen ? cleaned.substring(0, maxLen) + '...' : cleaned;
        };
        
        const tutorContext = cleanContext(lastTutorMessage.content, 200);
        if (tutorContext) {
          contextSummary += `\n- The previous tutor was just saying: "${tutorContext}"`;
        }
        
        const userContext = cleanContext(lastUserMessage.content, 150);
        if (userContext) {
          contextSummary += `\n- The student just said: "${userContext}"`;
        }
      }
    }
    
    // Get previous tutor name from session (stored before switch in handoff execution)
    // For cross-language switches, this will be the tutor from the previous language
    const previousTutorName = session.previousTutorName || 'your colleague';
    
    // Clear the previous tutor name now that we've used it
    session.previousTutorName = undefined;
    
    // Generate a dynamic, persona-aware greeting using the LLM
    // The prompt provides conversation context for a seamless, natural handoff
    // EXPLICIT "YOUR TURN" SIGNAL - Daniela's feedback: needs clear cue that it's time to speak
    const switchPrompt = `🎤 YOUR TURN TO SPEAK, ${tutorName.toUpperCase()}!

You are ${tutorName}, a ${tutorGender} ${session.targetLanguage} language tutor. ${previousTutorName} just finished and handed the conversation to YOU. The student is waiting for YOU to speak NOW.

⚡ ACTION REQUIRED: Greet the student immediately! This is your moment.

CONTEXT:
- The student asked to speak with you (they initiated the switch)
- ${previousTutorName} has stepped aside and is SILENT now
- You have the mic - the student hears only YOU${contextSummary}

YOUR GREETING (speak now):
1. Warmly acknowledge the student in 1-2 short sentences
2. If there was an active topic, briefly reference it for continuity
3. Offer to help or continue the lesson

STYLE:
- Use appropriate grammatical gender in ${session.targetLanguage}
- Be warm and natural, not robotic
- Don't say "I am [name]" - just dive in naturally

DON'T:
- Wait or hesitate - SPEAK NOW
- Talk about "receiving a call" - you're a tutor, not answering a phone
- Philosophize about the handoff - just greet and go]`;
    
    // NEW TURN: Increment turnId for voice switch intro
    session.currentTurnId++;
    session.sentAudioChunks.clear();  // Reset audio deduplication for new turn
    session.sentAudioHashes.clear();  // Reset content-based deduplication for new turn
    session.firstAudioSent = false;   // Reset so whiteboard updates buffer until audio starts
    session.pendingWhiteboardUpdates = [];
    const turnId = session.currentTurnId;
    const switchStartTime = Date.now();
    let fullText = '';
    let sentenceCount = 0;
    
    // CRITICAL: Send processing message to trigger thinking mode in the client
    // Without this, the client won't show the thinking indicator
    this.sendMessage(session.ws, {
      type: 'processing',
      timestamp: Date.now(),
      turnId,
      userTranscript: `[Tutor handoff to ${tutorName}]`,
    } as StreamingProcessingMessage);
    
    // Create minimal metrics for streamSentenceAudioProgressive (it expects this structure)
    const metrics: StreamingMetrics = {
      sessionId,
      sttLatencyMs: 0,
      aiFirstTokenMs: 0,
      ttsFirstByteMs: 0,
      totalLatencyMs: 0,
      sentenceCount: 0,
      audioBytes: 0,
      audioChunkCount: 0,
    };
    
    try {
      // Use the streaming Gemini service to generate a natural greeting
      await this.geminiService.streamWithSentenceChunking({
        systemPrompt: session.systemPrompt,
        conversationHistory: session.conversationHistory,
        userMessage: switchPrompt,
        maxOutputTokens: 4096,  // Tutor switch intros don't need honesty mode expansion
        enableFunctionCalling: true,  // Enable native Gemini 3 function calling for tutor switch
        enableContextCaching: true,  // Cache system prompt for faster response
        onSentence: async (chunk: SentenceChunk) => {
          // Clean text for display
          const displayText = cleanTextForDisplay(chunk.text);
          if (!displayText) return;
          
          fullText += (fullText ? ' ' : '') + displayText;
          
          // Send sentence_start first (required before streamSentenceAudioProgressive)
          // Voice switch intros don't have target language content (all native L2 speech)
          this.sendMessage(session.ws, {
            type: 'sentence_start',
            timestamp: Date.now(),
            turnId,
            sentenceIndex: chunk.index,
            text: displayText,
            hasTargetContent: true,  // Tutor greeting is in target language
            targetLanguageText: displayText,
          } as StreamingSentenceStartMessage);
          
          // Use the existing progressive streaming method for proper audio delivery
          // This ensures we follow the exact same protocol as normal voice responses
          await this.tts.streamSentenceAudioProgressive(
            session,
            chunk,  // Use chunk directly (preserves correct index)
            displayText,
            metrics,
            turnId
          );
          
          sentenceCount++;
        },
      });
      
      // Add the greeting to conversation history so the tutor "remembers" they introduced themselves
      session.conversationHistory.push({ role: 'model', content: fullText });
      
      // Send response complete (metrics omitted - local format differs from shared type)
      const totalDurationMs = Date.now() - switchStartTime;
      this.sendMessage(session.ws, {
        type: 'response_complete',
        timestamp: Date.now(),
        turnId,
        fullText,
        totalSentences: sentenceCount,
        totalDurationMs,
      } as StreamingResponseCompleteMessage);
      
      console.log(`[Voice Switch] Introduction complete: ${tutorName} said "${fullText}"`);
      
    } catch (err: any) {
      console.error(`[Voice Switch] Failed to generate intro: ${err.message}`);
      // Non-fatal - voice switch still happened, just no audio intro
    }
  }
  
  /**
   * Find an active session by conversationId
   * Used for architect note injection - allows finding the active voice session
   */
  findSessionByConversationId(conversationId: string): StreamingSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.conversationId === conversationId && session.isActive) {
        return session;
      }
    }
    return undefined;
  }
  
  /**
   * Trigger Daniela to respond to an architect note immediately
   * This enables real-time Claude participation in voice sessions
   * The architect note becomes the "user message" that Daniela responds to
   * @param noteId - The database ID of the note to mark as delivered after response
   */
  async triggerArchitectResponse(session: StreamingSession, architectNote: string, noteId?: string): Promise<void> {
    if (!session.isActive || !session.isFounderMode) {
      console.log('[Streaming Orchestrator] Cannot trigger architect response - session not active or not in Founder Mode');
      return;
    }
    
    // Skip if already generating a response (avoid race conditions)
    if (session.isGenerating) {
      console.log('[Streaming Orchestrator] Skipping architect trigger - response already in progress');
      return;
    }
    
    console.log(`[Streaming Orchestrator] 🏗️ Triggering immediate response for architect note`);
    
    // NEW TURN: Increment turnId for this response
    session.currentTurnId++;
    session.isInterrupted = false;
    session.isGenerating = true;
    session.sentAudioChunks.clear();  // Reset audio deduplication for new turn
    session.sentAudioHashes.clear();  // Reset content-based deduplication for new turn
    const turnId = session.currentTurnId;
    
    // Notify client that an architect-triggered response is starting
    this.sendMessage(session.ws, {
      type: 'processing',
      timestamp: Date.now(),
      turnId,
      userTranscript: '[Architect Note]',  // Indicate this is from the architect
    } as StreamingProcessingMessage);
    
    try {
      const aiStart = Date.now();
      let firstTokenReceived = false;
      let fullText = '';
      let currentSentenceIndex = 0;
      
      const seenSentences = new Set<string>();
      // SAFETY NET: High limit for architect responses in Founder Mode
      const MAX_SENTENCES = 30;
      let actualSentenceCount = 0;
      
      // Build the architect context - the note we just received
      const architectContext = `

═══════════════════════════════════════════════════════════════════
🏗️ ARCHITECT'S NOTE (from Claude - RESPOND NOW)
═══════════════════════════════════════════════════════════════════

Claude, the architect, just sent you this note and is waiting for your response:

• ${architectNote}

This is a REAL-TIME message. Respond directly to Claude's note.
Acknowledge Claude's input naturally and address what they said.

`;
      
      // Create metrics structure
      const metrics: StreamingMetrics = {
        sessionId: session.id,
        sttLatencyMs: 0,  // No STT for architect trigger
        aiFirstTokenMs: 0,
        ttsFirstByteMs: 0,
        totalLatencyMs: 0,
        sentenceCount: 0,
        audioBytes: 0,
      audioChunkCount: 0,
      };
      
      // Use a system prompt that tells Daniela to respond to the architect
      const triggerPrompt = `[ARCHITECT DIRECT MESSAGE]
Claude, the architect building your teaching tools, just sent you a message. 
Respond to them directly - they're listening. This is real-time collaboration.`;
      
      await this.geminiService.streamWithSentenceChunking({
        systemPrompt: session.systemPrompt + architectContext,
        conversationHistory: session.conversationHistory,
        userMessage: triggerPrompt,
        maxOutputTokens: 4096,  // Architect responses don't need honesty mode expansion
        enableFunctionCalling: true,  // Enable native Gemini 3 function calling for architect responses
        enableContextCaching: true,  // Cache system prompt for faster response
        onSentence: async (chunk: SentenceChunk) => {
          // Check for interrupt
          if (session.isInterrupted) {
            console.log('[Streaming Orchestrator] Architect response interrupted by user');
            return;
          }
          
          const cleanedText = cleanTextForDisplay(chunk.text);
          if (!cleanedText) return;
          
          // Deduplication
          const normalizedSentence = cleanedText.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          if (seenSentences.has(normalizedSentence)) return;
          seenSentences.add(normalizedSentence);
          
          actualSentenceCount++;
          if (actualSentenceCount > MAX_SENTENCES) return;
          
          if (!firstTokenReceived) {
            metrics.aiFirstTokenMs = Date.now() - aiStart;
            firstTokenReceived = true;
          }
          
          fullText += (fullText ? ' ' : '') + cleanedText;
          
          // Send sentence_start
          this.sendMessage(session.ws, {
            type: 'sentence_start',
            timestamp: Date.now(),
            turnId,
            sentenceIndex: currentSentenceIndex,
            text: cleanedText,
            hasTargetContent: true,
            targetLanguageText: cleanedText,
          } as StreamingSentenceStartMessage);
          
          // Stream audio for this sentence
          await this.tts.streamSentenceAudioProgressive(
            session,
            { index: currentSentenceIndex, text: cleanedText, isFinal: chunk.isFinal },
            cleanedText,
            metrics,
            turnId
          );
          
          currentSentenceIndex++;
          metrics.sentenceCount = currentSentenceIndex;
        },
      });
      
      // Add response to conversation history
      if (fullText) {
        // Add the architect note as a "user" message to maintain context
        session.conversationHistory.push({ 
          role: 'user', 
          content: `[Architect Note from Claude]: ${architectNote}` 
        });
        session.conversationHistory.push({ role: 'model', content: fullText });
      }
      
      metrics.totalLatencyMs = Date.now() - aiStart;
      
      // Send response_complete
      this.sendMessage(session.ws, {
        type: 'response_complete',
        timestamp: Date.now(),
        turnId,
        fullText,
        totalSentences: currentSentenceIndex,
        totalDurationMs: metrics.totalLatencyMs,
      } as StreamingResponseCompleteMessage);
      
      console.log(`[Streaming Orchestrator] 🏗️ Architect response complete: "${fullText.slice(0, 100)}..."`);
      
      // Mark the architect note as delivered so it's not repeated
      if (noteId) {
        await architectVoiceService.markNotesDelivered([noteId]);
        console.log(`[Streaming Orchestrator] 🏗️ Marked architect note ${noteId} as delivered`);
      }
      
    } catch (err: any) {
      console.error(`[Streaming Orchestrator] Architect response failed: ${err.message}`);
      this.sendMessage(session.ws, {
        type: 'error',
        timestamp: Date.now(),
        code: 'ARCHITECT_RESPONSE_FAILED',
        message: 'Failed to respond to architect note',
        recoverable: true,
      });
    } finally {
      session.isGenerating = false;
    }
  }
}

let orchestratorInstance: StreamingVoiceOrchestrator;

export function getStreamingVoiceOrchestrator(): StreamingVoiceOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new StreamingVoiceOrchestrator();
  }
  return orchestratorInstance;
}
