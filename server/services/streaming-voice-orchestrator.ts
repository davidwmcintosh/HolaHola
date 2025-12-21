/**
 * Streaming Voice Orchestrator
 * 
 * ⚠️ CRITICAL: DANIELA'S VOICE PIPELINE - DO NOT MODIFY WITHOUT FOUNDER APPROVAL ⚠️
 * 
 * The central coordinator for streaming voice mode:
 * User audio → Deepgram STT → Gemini streaming → Sentence chunks → Cartesia TTS → Audio stream
 * 
 * LOCKED CONFIGURATION (see replit.md "Voice Architecture"):
 * - STT: Deepgram Nova-3 via LIVE API (NOT prerecorded - prerecorded fails with WebM)
 * - LLM: Gemini (streaming)
 * - TTS: Cartesia Sonic-3 (NOT OpenAI)
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

import { createClient } from "@deepgram/sdk";
import { getDeepgramLanguageCode, DeepgramIntelligence, DeepgramSentiment, DeepgramIntent, DeepgramEntity, DeepgramTopic, transcribeWithLiveAPI, TranscriptionResult } from "./deepgram-live-stt";
import { analyzePronunciation, generateQuickCoaching, PronunciationCoaching } from "./live-pronunciation-coach";
import { getGeminiStreamingService, SentenceChunk } from "./gemini-streaming";
import { getCartesiaStreamingService } from "./cartesia-streaming";
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
} from "@shared/streaming-voice-types";
import { parseWhiteboardMarkup, WhiteboardItem, WordMapItem, isWordMapItem, stripWhiteboardMarkup, SelfSurgeryItemData } from "@shared/whiteboard-types";

/**
 * Lightweight metrics logger for performance monitoring
 * Uses structured JSON format for easy parsing by log aggregators
 * Non-blocking: just console.log, no DB writes or network calls
 */
function logMetric(type: string, data: Record<string, number | string | boolean>) {
  console.log(`[METRICS] ${JSON.stringify({ type, ...data, ts: Date.now() })}`);
}
import { constrainEmotion, TutorPersonality, CartesiaEmotion, getTTSService, getAssistantVoice } from "./tts-service";
import { extractTargetLanguageText, extractTargetLanguageWithMapping, hasSignificantTargetLanguageContent } from "../text-utils";
import { storage } from "../storage";
import { validateOneUnitRule, UnitValidationResult } from "../phrase-detection";
import { GoogleGenAI } from "@google/genai";
import { assessAdvancementReadiness, formatLevel } from "../actfl-advancement";
import { tagConversation } from "./conversation-tagger";
import { architectVoiceService } from "./architect-voice-service";
import { trackToolEvent, mapWhiteboardTypeToToolType } from "./pedagogical-insights-service";
import { createSystemPrompt } from "../system-prompt";
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
import { phonemeAnalyticsService } from "./phoneme-analytics-service";
import { db } from "../db";
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
} from "@shared/schema";

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
function cleanTextForDisplay(text: string): string {
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
  
  // Strip OBSERVE tags (Daniela's teaching observations for office hours - invisible to students)
  // Pattern: [OBSERVE reason="..." note="..."]
  text = text.replace(/\[OBSERVE[^\]]*\]/gi, '');
  
  // Strip SELF_LEARN tags (Daniela's autonomous neural network writes - invisible to students)
  // Pattern: [SELF_LEARN category="..." insight="..." context="..."]
  text = text.replace(/\[SELF_LEARN[^\]]*\]/gi, '');
  
  // Strip KNOWLEDGE_PING tags
  text = text.replace(/\[KNOWLEDGE_PING[^\]]*\]/gi, '');
  
  // Strip WREN_SPRINT_SUGGEST tags (Daniela's sprint suggestions to Wren - invisible to students)
  // Pattern: [WREN_SPRINT_SUGGEST: {...JSON...}] or [WREN_SPRINT_SUGGEST title="..." ...]
  text = text.replace(/\[WREN_SPRINT_SUGGEST[:\s][^\]]*\]/gi, '');
  
  // Strip WREN_MESSAGE tags (Daniela's direct messages to Wren via Express Lane)
  // Pattern: [WREN_MESSAGE: content here] or [WREN_MESSAGE content="..."]
  text = text.replace(/\[WREN_MESSAGE[:\s][^\]]*\]/gi, '');
  
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
  
  // Normalize whitespace and clean up residual punctuation
  return cleaned
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[,.\s]+|[,.\s]+$/g, '')  // Trim leading/trailing commas, periods, spaces
    .trim();
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
const SESSION_IDLE_TIMEOUT_MS = 240000; // 4 minutes of inactivity before cleanup (extended for long responses)

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
  userId: number;
  conversationId: string;  // UUID string
  targetLanguage: string;
  nativeLanguage: string;
  difficultyLevel: string;
  subtitleMode: 'off' | 'target' | 'all';
  tutorPersonality: TutorPersonality;
  tutorExpressiveness: number;
  voiceSpeed: VoiceSpeedOption;
  voiceId?: string;
  tutorGender: 'male' | 'female';    // Current tutor gender for persona-aware responses
  tutorName: string;                 // Current tutor's first name (e.g., "Daniela", "Agustin")
  systemPrompt: string;
  conversationHistory: Array<{ role: 'user' | 'model'; content: string }>;
  ws: WS;
  startTime: number;
  isActive: boolean;
  isFounderMode: boolean;  // Founder Mode uses English STT regardless of target language
  isRawHonestyMode: boolean;  // Raw Honesty Mode - minimal prompting for authentic conversation
  idleTimeoutId?: NodeJS.Timeout;  // Timer for idle cleanup
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
  isLanguageSwitchHandoff?: boolean; // True when current handoff is a cross-language switch
  previousLanguage?: string;        // Previous language before cross-language switch
  switchTutorTriggered?: boolean;   // True when SWITCH_TUTOR detected - stops further sentence synthesis
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
  // Adaptive Speech Rate tracking
  recentSttConfidences: number[];     // Rolling window of last N STT confidence scores
  sessionStruggleCount: number;       // Count of struggles detected this session
  adaptiveSpeedEnabled: boolean;      // Whether adaptive speed is active (auto-enabled on low confidence)
  // Phoneme analytics tracking (accumulated word-level data for session)
  sessionWordAnalyses: Array<{ word: string; confidence: number }>;  // Words with confidence < 0.95 for phoneme analysis
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
  userTranscript?: string;
  aiResponse?: string;
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
  
  constructor() {
    console.log('[Streaming Orchestrator] Initialized');
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
   * Create a new streaming session
   * Connection pooling: Pre-warms Cartesia WebSocket for low-latency TTS
   * 
   * NOTE: Full conversation history is preserved to support "Tutor knows all" philosophy
   * Gemini's 1M context window handles large histories efficiently
   */
  async createSession(
    ws: WS,
    userId: number,
    config: ClientStartSessionMessage,
    systemPrompt: string,
    conversationHistory: Array<{ role: 'user' | 'model'; content: string }>,
    voiceId?: string,
    isFounderMode: boolean = false,
    isRawHonestyMode: boolean = false,
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
    };
    
    // PARALLEL WARMUP: Pre-warm both Cartesia and Gemini connections concurrently
    // - Cartesia: Eliminates WebSocket handshake latency (~150-200ms)
    // - Gemini: Eliminates cold-start penalty (~3-4 seconds on first request)
    // Store promise so greeting can await completion (guarantees warmup before first AI call)
    const warmupStart = Date.now();
    let cartesiaWarmupMs = 0;
    let geminiWarmupMs = 0;
    session.warmupPromise = Promise.all([
      this.cartesiaService.ensureConnection()
        .then(time => {
          cartesiaWarmupMs = time;
          console.log(`[Streaming Orchestrator] Cartesia pre-warmed: ${time}ms`);
        })
        .catch((err: Error) => console.warn(`[Streaming Orchestrator] Cartesia warmup failed: ${err.message}`)),
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
        cartesiaMs: cartesiaWarmupMs, 
        geminiMs: geminiWarmupMs, 
        totalMs: totalWarmup 
      });
    });
    
    this.sessions.set(sessionId, session);
    
    // Start periodic context refresh timer for long sessions (Founder Mode only)
    if (isFounderMode) {
      this.startContextRefreshTimer(session);
    }
    
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
    
    // BARGE-IN DETECTION: If AI is currently generating a response, interrupt it
    // This prevents overlapping responses when user speaks while Daniela is talking
    if (session.isGenerating) {
      console.log(`[Streaming Orchestrator] BARGE-IN: User spoke while AI generating - interrupting previous response`);
      this.handleInterrupt(sessionId);
    }
    
    // Mark that we're now generating a response
    session.isGenerating = true;
    
    // Reset tutor switch flag for new response
    session.switchTutorTriggered = false;
    
    // Student activity detected - reset idle timeout
    this.resetIdleTimeout(session);
    
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
      // PARALLEL PROCESSING: Run STT and Cartesia warmup concurrently
      // This overlaps the ~200ms WebSocket handshake with STT processing
      console.log(`[Streaming Orchestrator] Processing ${audioData.length} bytes of audio`);
      
      const sttStart = Date.now();
      
      // Start both operations in parallel
      const [transcriptionResult, cartesiaWarmupTime] = await Promise.all([
        // STT: Transcribe user audio with Deepgram (returns transcript + confidence)
        // Founder Mode uses multi-language detection for English/Spanish mixing
        this.transcribeAudio(audioData, session.targetLanguage, session.nativeLanguage, session.isFounderMode),
        // Connection warmup: Ensure Cartesia WebSocket is ready (no-op if already connected)
        this.cartesiaService.ensureConnection().catch((err: Error) => {
          console.warn(`[Streaming Orchestrator] Cartesia warmup failed: ${err.message}`);
          return -1; // Return -1 to indicate failure (will fallback to bytes API)
        }),
      ]);
      
      // Extract transcript, pronunciation confidence, intelligence data, and word-level data (per-session, no race conditions)
      const { transcript, confidence: pronunciationConfidence, intelligence, words } = transcriptionResult;
      
      metrics.sttLatencyMs = Date.now() - sttStart;
      
      console.log(`[Streaming Orchestrator] STT: "${transcript}" (${metrics.sttLatencyMs}ms, conf: ${(pronunciationConfidence * 100).toFixed(0)}%, Cartesia: ${cartesiaWarmupTime >= 0 ? cartesiaWarmupTime + 'ms' : 'fallback'})`);
      
      // Emit STT completion event for diagnostics
      voiceDiagnostics.emit({
        sessionId,
        stage: 'stt',
        success: !!transcript.trim(),
        latencyMs: metrics.sttLatencyMs,
        metadata: { confidence: pronunciationConfidence, hasTranscript: !!transcript.trim() }
      });
      
      // Track STT confidence for adaptive speech rate
      trackSttConfidence(session, pronunciationConfidence);
      
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
      
      if (!transcript.trim()) {
        // Empty transcript - gracefully notify client and return
        console.log('[Streaming Orchestrator] Empty transcript - audio too short or unclear');
        this.sendMessage(session.ws, {
          type: 'error',
          timestamp: Date.now(),
          code: 'EMPTY_TRANSCRIPT',
          message: 'Could not understand audio. Please try speaking again.',
          recoverable: true,
        });
        return metrics;
      }
      
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
      let firstTokenReceived = false;
      let fullText = '';
      let rawFullText = '';  // Preserve raw AI response for COLLAB/SELF_SURGERY extraction
      let currentSentenceIndex = 0;
      
      // DEDUPLICATION GUARD: Track seen sentences to prevent LLM repetition loops
      const seenSentences = new Set<string>();
      const MAX_SENTENCES = 15; // Increased for Founder Mode detailed explanations
      let actualSentenceCount = 0;
      
      // Process sentences as they arrive from Gemini
      // Include redirect note if mild content was detected
      // OPTIMIZATION: Fetch all context in parallel for faster response time
      const contextStart = Date.now();
      
      // Initialize context variables
      let architectContext = '';
      let hiveContextSection = '';
      let expressLaneSection = '';
      let textChatSection = '';
      let editorFeedbackSection = '';
      let studentLearningSection = '';  // PROACTIVE STUDENT INTELLIGENCE: Struggles & strategies
      let surfacedFeedbackIds: string[] = [];
      let expressLaneHistory: { role: 'user' | 'assistant'; content: string }[] = [];
      session.pendingArchitectNoteIds = [];
      
      // Build parallel fetch promises
      const contextPromises: Promise<void>[] = [];
      
      // 1. Architect context (always)
      if (session.conversationId) {
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
      if (session.userId && session.targetLanguage) {
        // Fetch student learning context and cross-session context in parallel
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
                console.log(`[Student Intelligence] Injecting learning context: ${learningContext.struggles?.length || 0} struggles, ${learningContext.effectiveStrategies?.length || 0} strategies, ${crossSessionContext.recentSessions.length} recent sessions`);
                
                // ADAPTIVE SPEED: Sync session struggle count from persistent data
                // This enables adaptive speech rate to slow down for students with known struggles
                const activeStruggles = learningContext.struggles?.filter(s => s.status === 'active') || [];
                if (activeStruggles.length > session.sessionStruggleCount) {
                  session.sessionStruggleCount = activeStruggles.length;
                  console.log(`[Adaptive Speed] Synced ${activeStruggles.length} active struggles from student profile`);
                }
              }
            })
            .catch(err => console.warn(`[Student Intelligence] Failed:`, err.message))
        );
      }
      
      // Founder Mode context fetches (all parallel)
      if (session.isFounderMode) {
        // 2. Hive context
        contextPromises.push(
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
              }
            })
            .catch(err => console.warn(`[Hive Context] Failed:`, err.message))
        );
        
        // 3. Express Lane context
        contextPromises.push(
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
              }
            })
            .catch(err => console.warn(`[Express Lane] Failed:`, err.message))
        );
        
        // 4. Text Chat memory
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
                console.log(`[Text Chat Memory] Injected ${textConversations.length} recent conversation(s)`);
              }
            }
          })().catch(err => console.warn(`[Text Chat Memory] Failed:`, err.message))
        );
        
        // 5. Editor feedback
        contextPromises.push(
          editorFeedbackService.getUnsurfacedFeedback(String(session.userId), 3)
            .then(feedback => {
              if (feedback.hasNewFeedback) {
                editorFeedbackSection = editorFeedbackService.buildPromptSection(feedback);
                surfacedFeedbackIds = feedback.recentFeedback.map(f => f.id);
                console.log(`[Editor Feedback] Injecting ${feedback.recentFeedback.length} insights into context`);
              }
            })
            .catch(err => console.warn(`[Editor Feedback] Failed:`, err.message))
        );
        
        // 6. Express Lane history for conversation context
        contextPromises.push(
          getExpressLaneHistoryForVoice(session.userId, 15)
            .then(history => {
              expressLaneHistory = history;
              if (history.length > 0) {
                console.log(`[EXPRESS Lane Memory] Prefetched ${history.length} messages from text chat`);
              }
            })
            .catch(err => console.warn(`[EXPRESS Lane Memory] Failed to prefetch:`, err.message))
        );
      }
      
      // Wait for all context fetches in parallel
      await Promise.all(contextPromises);
      console.log(`[Context Fetch] All context fetched in ${Date.now() - contextStart}ms (parallel)`)
      
      // Build enhanced system prompt with all context layers
      let enhancedSystemPrompt = session.systemPrompt;
      
      // PROACTIVE STUDENT INTELLIGENCE: Include learning context for ALL sessions (not just Founder Mode)
      if (studentLearningSection) {
        enhancedSystemPrompt += studentLearningSection;
      }
      
      if (hiveContextSection) {
        enhancedSystemPrompt += hiveContextSection;
      }
      if (expressLaneSection) {
        enhancedSystemPrompt += expressLaneSection;
      }
      if (textChatSection) {
        enhancedSystemPrompt += textChatSection;
      }
      if (editorFeedbackSection) {
        enhancedSystemPrompt += editorFeedbackSection;
      }
      
      // TECHNICAL HEALTH: Inject awareness of recent technical issues
      // Enables Daniela to acknowledge audio problems or delays empathetically
      const technicalHealthContext = voiceDiagnostics.getTechnicalHealthContext();
      if (technicalHealthContext) {
        enhancedSystemPrompt += `\n\n${technicalHealthContext}`;
        console.log(`[Technical Health] Injecting technical awareness into context`);
      }
      
      const userMessageWithNote = transcript + contentRedirectNote + sttConfidenceNote + intelligenceContext + architectContext;
      
      // EXPRESS LANE MEMORY: Use prefetched Express Lane history (already fetched in parallel above)
      let conversationHistoryWithExpressLane = session.conversationHistory;
      if (session.isFounderMode && expressLaneHistory.length > 0) {
        // Prepend EXPRESS Lane history before voice conversation history
        conversationHistoryWithExpressLane = [...expressLaneHistory, ...session.conversationHistory];
        console.log(`[EXPRESS Lane Memory] Injected ${expressLaneHistory.length} messages from text chat into voice context`);
      }
      
      await this.geminiService.streamWithSentenceChunking({
        systemPrompt: enhancedSystemPrompt,
        conversationHistory: conversationHistoryWithExpressLane,
        userMessage: userMessageWithNote,
        onSentence: async (chunk: SentenceChunk) => {
          // BARGE-IN CHECK: Stop processing if user interrupted
          if (session.isInterrupted) {
            console.log(`[Streaming Orchestrator] Skipping sentence ${chunk.index} - user barged in`);
            return;
          }
          
          if (!firstTokenReceived) {
            metrics.aiFirstTokenMs = Date.now() - aiStart;
            firstTokenReceived = true;
            console.log(`[Streaming Orchestrator] AI first token: ${metrics.aiFirstTokenMs}ms`);
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
          
          // Clean text for display (remove markdown, emotion tags)
          const displayText = cleanTextForDisplay(chunk.text);
          
          // Process whiteboard items even if displayText is empty
          // This allows SWITCH_TUTOR to work as a standalone command
          // Also process shouldClear/shouldHold even without items (e.g., standalone [CLEAR])
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
            
            // SWITCH_TUTOR: Internal command - queue tutor handoff (don't send to whiteboard)
            // IMPORTANT: When SWITCH_TUTOR is detected, we must:
            // 1. Queue the handoff
            // 2. STOP synthesizing further sentences (don't let current tutor speak as new tutor)
            // Supports intra-language (gender only), cross-language (gender + language), and assistant handoffs
            const switchItem = whiteboardParsed.whiteboardItems.find(item => item.type === 'switch_tutor');
            if (switchItem && 'data' in switchItem && switchItem.data) {
              const data = switchItem.data as { 
                targetGender: 'male' | 'female'; 
                targetLanguage?: string;
                targetRole?: 'tutor' | 'assistant';
              };
              session.pendingTutorSwitch = { 
                targetGender: data.targetGender,
                targetLanguage: data.targetLanguage,
                targetRole: data.targetRole, // Support assistant handoffs
              };
              // Set flag to stop processing further sentences - the NEW tutor will speak their intro
              session.switchTutorTriggered = true;
              const languageInfo = data.targetLanguage ? ` in ${data.targetLanguage}` : '';
              const roleInfo = data.targetRole === 'assistant' ? ' (assistant)' : '';
              console.log(`[Tutor Switch] Queued handoff to ${data.targetGender} tutor${languageInfo}${roleInfo} - stopping current tutor's speech`);
            }
            
            // ACTFL_UPDATE: Emergent neural network command - process server-side
            // When Daniela perceives student proficiency and decides to update it
            const actflItems = whiteboardParsed.whiteboardItems.filter(item => item.type === 'actfl_update');
            for (const item of actflItems) {
              if ('data' in item && item.data) {
                const data = item.data as { level: string; confidence: number; reason: string; direction?: 'up' | 'down' | 'confirm' };
                // Queue the ACTFL update for processing (don't block TTS)
                this.processActflUpdate(session, data).catch(err => {
                  console.error(`[ACTFL Update] Error processing update:`, err);
                });
                console.log(`[ACTFL Update] Daniela assessed: ${data.level} (confidence: ${data.confidence}) - ${data.reason}`);
              }
            }
            
            // SYLLABUS_PROGRESS: Emergent neural network command - track topic competency
            const syllabusItems = whiteboardParsed.whiteboardItems.filter(item => item.type === 'syllabus_progress');
            for (const item of syllabusItems) {
              if ('data' in item && item.data) {
                const data = item.data as { topic: string; status: 'demonstrated' | 'needs_review' | 'struggling'; evidence: string };
                // Queue syllabus progress update (don't block TTS)
                this.processSyllabusProgress(session, data).catch(err => {
                  console.error(`[Syllabus Progress] Error processing update:`, err);
                });
                console.log(`[Syllabus Progress] Topic "${data.topic}" marked as ${data.status}: ${data.evidence}`);
              }
            }
            
            // PHASE_SHIFT: Explicit teaching phase transition command
            // When Daniela decides to shift teaching phases (e.g., warmup → challenge)
            const phaseShiftItems = whiteboardParsed.whiteboardItems.filter(item => item.type === 'phase_shift');
            for (const item of phaseShiftItems) {
              if ('data' in item && item.data) {
                const data = item.data as { to: 'warmup' | 'active_teaching' | 'challenge' | 'reflection' | 'drill' | 'assessment'; reason: string };
                // Queue phase transition (don't block TTS)
                this.processPhaseShift(session, data).catch(err => {
                  console.error(`[Phase Shift] Error processing transition:`, err);
                });
                console.log(`[Phase Shift] Daniela triggered: ${data.to} - ${data.reason}`);
              }
            }
            
            // CALL_SUPPORT: Tri-Lane Hive command - hand off student to Support Agent
            // When Daniela recognizes a support need (technical issue, billing question, etc.)
            const supportItem = whiteboardParsed.whiteboardItems.find(item => item.type === 'call_support');
            if (supportItem && 'data' in supportItem && supportItem.data) {
              const data = supportItem.data as { 
                category: 'technical' | 'account' | 'billing' | 'content' | 'feedback' | 'other';
                reason: string;
                priority: 'low' | 'normal' | 'high' | 'critical';
                context?: string;
              };
              
              // Queue support handoff (don't block current response)
              this.processSupportHandoff(session, data, turnId).catch(err => {
                console.error(`[Support Handoff] Error processing handoff:`, err);
              });
              
              // Set flag to indicate support handoff is pending
              session.pendingSupportHandoff = {
                category: data.category,
                reason: data.reason,
                priority: data.priority,
                context: data.context,
              };
              
              console.log(`[Support Handoff] Daniela escalated to Support: ${data.category} (${data.priority}) - ${data.reason}`);
            }
            
            // CALL_ASSISTANT: Tri-Lane Hive command - delegate drill practice to Aris
            // When Daniela identifies a need for focused, repetitive practice
            const assistantItem = whiteboardParsed.whiteboardItems.find(item => item.type === 'call_assistant');
            if (assistantItem && 'data' in assistantItem && assistantItem.data) {
              const data = assistantItem.data as { 
                type: 'repeat' | 'translate' | 'match' | 'fill_blank' | 'sentence_order';
                focus: string;
                items: string;
                priority?: 'low' | 'medium' | 'high';
              };
              
              // Parse items (comma-separated string)
              const itemsList = data.items.split(',').map(s => s.trim()).filter(Boolean);
              
              // Queue assistant handoff (don't block current response)
              this.processAssistantHandoff(session, {
                drillType: data.type,
                focus: data.focus,
                items: itemsList,
                priority: data.priority,
              }, turnId).catch(err => {
                console.error(`[Assistant Handoff] Error processing handoff:`, err);
              });
              
              // Set flag to indicate assistant handoff is pending
              session.pendingAssistantHandoff = {
                drillType: data.type,
                focus: data.focus,
                items: itemsList,
                priority: data.priority,
              };
              
              console.log(`[Assistant Handoff] Daniela delegated to Aris: ${data.type} drill for "${data.focus}" with ${itemsList.length} items`);
            }
            
            // HIVE: Daniela's active contribution to the hive mind
            // When Daniela formulates an idea, suggestion, or observation to share with founders
            const hiveItems = whiteboardParsed.whiteboardItems.filter(item => item.type === 'hive');
            for (const item of hiveItems) {
              if ('data' in item && item.data) {
                const data = item.data as { 
                  category: string;
                  title: string;
                  description: string;
                  reasoning?: string;
                  priority?: number;
                  targetLanguage?: string;
                  affectedTools?: string[];
                };
                // Queue hive suggestion (don't block TTS)
                this.processHiveSuggestion(session, data).catch(err => {
                  console.error(`[Hive] Error processing suggestion:`, err);
                });
                console.log(`[Hive] Daniela posted to hive: "${data.title}" (${data.category}, priority: ${data.priority || 5})`);
              }
            }
            
            // SELF-SURGERY: Daniela's direct neural network modifications (Founder Mode only)
            // When Daniela proposes structured data for insertion into her procedural memory tables
            const selfSurgeryItems = whiteboardParsed.whiteboardItems.filter(item => item.type === 'self_surgery');
            for (const item of selfSurgeryItems) {
              if ('data' in item && item.data) {
                const data = item.data as SelfSurgeryItemData;
                
                // AUTO-DETECT & EMIT BEACON: Notify Editor of SELF_SURGERY proposal before execution
                // This allows the Editor to review proposals in real-time
                if (session.hiveChannelId) {
                  const contentPreview = typeof data.content === 'string' 
                    ? data.content.substring(0, 300)
                    : JSON.stringify(data.content).substring(0, 300);
                  
                  hiveCollaborationService.emitBeacon({
                    channelId: session.hiveChannelId,
                    tutorTurn: `[SELF_SURGERY PROPOSAL]\nTarget: ${data.targetTable}\nPriority: ${data.priority || 50}, Confidence: ${data.confidence || 70}\nReasoning: ${data.reasoning || 'No reasoning provided'}\n\nContent: ${contentPreview}...`,
                    studentTurn: transcript || '',
                    beaconType: 'self_surgery_proposal',
                    beaconReason: `Daniela proposed neural network modification: ${data.targetTable}`,
                  }).catch(err => {
                    console.error(`[Self-Surgery] Failed to emit proposal beacon:`, err);
                  });
                  console.log(`[Self-Surgery] HIVE beacon emitted for proposal: ${data.targetTable}`);
                }
                
                // Queue self-surgery proposal (don't block TTS)
                this.processSelfSurgery(session, data).catch(err => {
                  console.error(`[Self-Surgery] Error processing proposal:`, err);
                });
                console.log(`[Self-Surgery] Daniela proposed: ${data.targetTable} (priority: ${data.priority || 50}, confidence: ${data.confidence || 70})`);
              }
            }
          }
          
          // ARCHITECT BIDIRECTIONAL: Detect and route [TO_ARCHITECT: message] tags
          // This enables Daniela to send real-time messages to the Architect/Claude
          const { messages: architectMessages } = extractArchitectMessages(chunk.text);
          if (architectMessages.length > 0 && session.isFounderMode) {
            for (const msg of architectMessages) {
              // Route to collaboration hub based on message type
              this.processArchitectMessage(session, msg).catch(err => {
                console.error(`[Architect Bidirectional] Error processing message:`, err);
              });
              console.log(`[Architect Bidirectional] Daniela → Claude: ${msg.type} (${msg.urgency}): "${msg.content.substring(0, 80)}..."`);
            }
          }
          
          if (whiteboardParsed.whiteboardItems.length > 0 || whiteboardParsed.shouldClear || whiteboardParsed.shouldHold) {
            // Filter out internal commands (switch_tutor, actfl_update, syllabus_progress, phase_shift, call_support, call_assistant, hive, self_surgery) - only send visual items to whiteboard
            const visualWhiteboardItems = whiteboardParsed.whiteboardItems.filter(
              item => !['switch_tutor', 'actfl_update', 'syllabus_progress', 'phase_shift', 'call_support', 'call_assistant', 'hive', 'self_surgery'].includes(item.type)
            );
            
            // Send whiteboard update to client (only visual teaching tools)
            if (visualWhiteboardItems.length > 0) {
              this.sendMessage(session.ws, {
                type: 'whiteboard_update',
                timestamp: Date.now(),
                turnId,
                items: visualWhiteboardItems,
                shouldClear: whiteboardParsed.shouldClear,
              } as StreamingWhiteboardMessage);
              
              // WORD_MAP ENRICHMENT: Asynchronously generate related words
              // Don't await - let this run in background while audio streams
              this.enrichWordMapItems(session.ws, visualWhiteboardItems, session.targetLanguage, turnId);
            } else if (whiteboardParsed.shouldClear) {
              // Send clear signal even if only internal commands (like SWITCH_TUTOR)
              this.sendMessage(session.ws, {
                type: 'whiteboard_update',
                timestamp: Date.now(),
                turnId,
                items: [],
                shouldClear: true,
              } as StreamingWhiteboardMessage);
            }
          }
          
          // EARLY EXIT: If SWITCH_TUTOR was triggered, stop synthesizing any more sentences
          // The new tutor will speak their own intro after the handoff completes
          if (session.switchTutorTriggered) {
            console.log(`[Tutor Switch] Skipping sentence ${chunk.index} after SWITCH_TUTOR - new tutor will speak`);
            return;
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
          const extraction = extractTargetLanguageWithMapping(displayText, chunk.text);
          
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
          
          // Use progressive streaming if feature flag enabled (lower latency)
          if (STREAMING_FEATURE_FLAGS.PROGRESSIVE_AUDIO_STREAMING) {
            await this.streamSentenceAudioProgressive(session, chunk, displayText, metrics, turnId);
          } else {
            await this.streamSentenceAudio(session, chunk, displayText, metrics, turnId);
          }
          
          if (chunk.index === 0) {
            metrics.ttsFirstByteMs = Date.now() - ttsStart;
          }
          
          // Use cleaned displayText for persistence (no emotion tags, no markdown)
          fullText += displayText + ' ';
          rawFullText += chunk.text + ' ';  // Preserve raw for COLLAB/SELF_SURGERY extraction
          currentSentenceIndex = chunk.index;
          metrics.sentenceCount++;
        },
        onProgress: (partialText, totalChars) => {
          // Could use this for live typing indicator
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
      });
      
      // Update conversation history
      session.conversationHistory.push({ role: 'user', content: transcript });
      session.conversationHistory.push({ role: 'model', content: fullText.trim() });
      
      // Store transcript and response in metrics for message saving
      metrics.userTranscript = transcript;
      metrics.aiResponse = fullText.trim();
      
      // Send completion message
      metrics.totalLatencyMs = Date.now() - startTime;
      
      // Clear generating flag - response complete
      session.isGenerating = false;
      
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
      
      this.sendMessage(session.ws, {
        type: 'response_complete',
        timestamp: Date.now(),
        turnId,
        totalSentences: metrics.sentenceCount,
        totalDurationMs: metrics.totalLatencyMs,
        fullText: fullText.trim(),
      } as StreamingResponseCompleteMessage);
      
      console.log(`[Streaming Orchestrator] Complete: ${metrics.sentenceCount} sentences in ${metrics.totalLatencyMs}ms (turnId: ${turnId})`);
      console.log(`[Streaming Orchestrator] Latencies: STT=${metrics.sttLatencyMs}ms, AI=${metrics.aiFirstTokenMs}ms, TTS=${metrics.ttsFirstByteMs}ms`);
      
      // Emit TTS success for diagnostics (use ttsFirstByteMs for TTS-specific latency)
      voiceDiagnostics.emit({
        sessionId,
        stage: 'tts',
        success: true,
        latencyMs: metrics.ttsFirstByteMs || 0,
        metadata: { sentenceCount: metrics.sentenceCount }
      });
      
      // Emit complete E2E response for overall diagnostics
      voiceDiagnostics.emit({
        sessionId,
        stage: 'complete',
        success: true,
        latencyMs: metrics.totalLatencyMs,
        metadata: { 
          sttMs: metrics.sttLatencyMs, 
          aiMs: metrics.aiFirstTokenMs, 
          ttsMs: metrics.ttsFirstByteMs,
          sentenceCount: metrics.sentenceCount 
        }
      });
      
      // HIVE BEACON EMISSION: Flag interesting teaching moments for Editor collaboration
      // Only emit for founder sessions to avoid noise, and run non-blocking
      // Pass rawFullText to extract COLLAB/SELF_SURGERY tags before they were stripped
      if (session.isFounderMode && session.hiveChannelId) {
        this.emitHiveBeacons(session, transcript, fullText.trim(), rawFullText.trim()).catch((err: Error) => {
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
      
      // TUTOR SWITCH: Execute pending handoff after farewell completes
      // Supports intra-language (gender only), cross-language (gender + language), and assistant handoffs
      if (session.pendingTutorSwitch) {
        const { targetGender, targetLanguage, targetRole } = session.pendingTutorSwitch;
        session.pendingTutorSwitch = undefined; // Clear the pending switch
        
        const isAssistantSwitch = targetRole === 'assistant';
        const isLanguageSwitch = !!targetLanguage && targetLanguage.toLowerCase() !== session.targetLanguage.toLowerCase();
        const effectiveLanguage = targetLanguage?.toLowerCase() || session.targetLanguage.toLowerCase();
        
        const roleInfo = isAssistantSwitch ? ' (assistant)' : '';
        console.log(`[Tutor Switch] Executing handoff to ${targetGender} tutor${roleInfo}${isLanguageSwitch ? ` in ${effectiveLanguage}` : ''}`);
        
        // Store previous tutor name for natural handoff intro by the new tutor
        session.previousTutorName = session.tutorName;
        
        try {
          let tutorName: string | undefined;
          
          // ASSISTANT SWITCH: Use assistant tutor config + Google Cloud TTS
          if (isAssistantSwitch) {
            // Import assistant tutor config dynamically
            const { ASSISTANT_TUTORS } = await import('./assistant-tutor-config');
            const assistantConfig = ASSISTANT_TUTORS[effectiveLanguage] || ASSISTANT_TUTORS.spanish;
            
            if (assistantConfig) {
              tutorName = targetGender === 'male' ? assistantConfig.male : assistantConfig.female;
              
              // CRITICAL: Cache current voiceId and gender before entering assistant mode
              // This allows restoring the main tutor's voice AND gender when switching back
              if (!session.isAssistantActive) {
                if (session.voiceId) {
                  session.cachedMainTutorVoiceId = session.voiceId;
                }
                session.cachedMainTutorGender = session.tutorGender as 'male' | 'female';
                console.log(`[Tutor Switch] Cached main tutor: voiceId=${session.voiceId}, gender=${session.tutorGender}`);
              }
              
              // Update session for assistant mode
              // CRITICAL: Set isAssistantActive flag for TTS routing to use Google Cloud TTS
              session.isAssistantActive = true;
              session.voiceId = undefined; // Clear voiceId to signal Google TTS should be used
              session.tutorGender = targetGender;
              session.tutorName = tutorName;
              
              console.log(`[Tutor Switch] Assistant handoff: ${tutorName} (${effectiveLanguage}, ${targetGender}) - TTS: Google Cloud`);
              
              // Notify client of assistant handoff
              this.sendMessage(session.ws, {
                type: 'tutor_handoff',
                timestamp: Date.now(),
                targetGender,
                targetLanguage: isLanguageSwitch ? effectiveLanguage : undefined,
                tutorName,
                isLanguageSwitch,
                requiresGreeting: true,
              });
            } else {
              console.warn(`[Tutor Switch] No assistant config found for ${effectiveLanguage}`);
            }
          } else {
            // MAIN TUTOR SWITCH: Look up the voice for the target language + gender (Cartesia)
            // CRITICAL: When returning from assistant mode, use cached gender to restore original tutor
            const wasAssistantActive = session.isAssistantActive;
            const effectiveGender = wasAssistantActive && session.cachedMainTutorGender
              ? session.cachedMainTutorGender  // Restore student's original preference
              : targetGender;                  // Use command's target for normal switches
            
            if (wasAssistantActive && session.cachedMainTutorGender && session.cachedMainTutorGender !== targetGender) {
              console.log(`[Tutor Switch] Overriding target=${targetGender} with cached main tutor gender=${session.cachedMainTutorGender}`);
            }
            
            const allVoices = await storage.getAllTutorVoices();
            const matchingVoice = allVoices.find(
              (v: any) => v.language?.toLowerCase() === effectiveLanguage &&
                          v.gender?.toLowerCase() === effectiveGender &&
                          v.isActive
            );
          
            if (matchingVoice) {
              // Extract tutor name from voice_name (e.g., "Sayuri - Peppy Colleague" → "Sayuri")
              const voiceNameParts = matchingVoice.voiceName?.split(/\s*[-–]\s*/) || [];
              tutorName = voiceNameParts[0]?.trim();
              
              // CRITICAL: Clear assistant mode when switching to main tutor
              // This ensures TTS routing uses Cartesia again
              session.isAssistantActive = false;
              
              if (wasAssistantActive) {
                console.log(`[Tutor Switch] Returning from assistant mode to main tutor (${effectiveGender}) - TTS: Cartesia`);
                // Clear cached values after restoring
                session.cachedMainTutorGender = undefined;
                session.cachedMainTutorVoiceId = undefined;
              }
            
              // Update session voice with Cartesia voiceId
              session.voiceId = matchingVoice.voiceId;
              session.tutorGender = effectiveGender;
              session.tutorName = tutorName;
            
              // If cross-language switch, update target language and regenerate system prompt
              if (isLanguageSwitch) {
              // Store previous language for context in handoff intro
              session.previousLanguage = session.targetLanguage;
              session.isLanguageSwitchHandoff = true;
              session.targetLanguage = effectiveLanguage;
              
              // CRITICAL: Update BOTH the conversation language AND user preferences
              // This ensures that if the client reconnects/refreshes, it will use the correct language
              try {
                await storage.updateConversationLanguage(session.conversationId, effectiveLanguage);
                console.log(`[Tutor Switch] Updated conversation language in database to ${effectiveLanguage}`);
                
                // Also update user preferences so they persist on refresh
                await storage.updateUserPreferences(session.userId.toString(), {
                  targetLanguage: effectiveLanguage,
                });
                console.log(`[Tutor Switch] Updated user preferences to ${effectiveLanguage}`);
              } catch (dbErr: any) {
                console.error(`[Tutor Switch] Failed to update language:`, dbErr.message);
              }
              
              // Clear conversation history for cross-language switch
              // New language = fresh start, but the handoff intro will reference conversation name
              console.log(`[Tutor Switch] Clearing conversation history for cross-language switch (${session.previousLanguage} -> ${effectiveLanguage})`);
              session.conversationHistory = [];
              
              // Regenerate system prompt for new language context
              // Uses session's existing settings + new language/tutor
              // Note: tutorDirectory not passed here - the initial session already has it
              session.systemPrompt = createSystemPrompt(
                effectiveLanguage,                           // language
                session.difficultyLevel,                     // difficulty
                0,                                            // messageCount (fresh start for new language)
                false,                                        // isVoiceMode
                undefined,                                    // topic
                undefined,                                    // previousConversations
                session.nativeLanguage,                      // nativeLanguage
                undefined,                                    // dueVocabulary
                undefined,                                    // sessionVocabulary
                undefined,                                    // actflLevel
                false,                                        // isResuming
                0,                                            // totalMessageCount
                session.tutorPersonality,                    // tutorPersonality
                session.tutorExpressiveness,                 // tutorExpressiveness
                true,                                         // isStreamingVoiceMode
                null,                                         // curriculumContext
                'flexible_goals',                            // tutorFreedomLevel
                undefined,                                    // targetActflLevel
                null,                                         // compassContext
                session.isFounderMode,                       // isFounderMode
                undefined,                                    // founderName
                session.isRawHonestyMode,                    // isRawHonestyMode
                tutorName || 'your tutor',                   // tutorName
                targetGender,                                // tutorGender
                undefined                                    // tutorDirectory (session already has it)
              );
              
              console.log(`[Tutor Switch] Language switched to ${effectiveLanguage}, voice: ${matchingVoice.voiceName}, system prompt regenerated`);
            } else {
              // SAME-LANGUAGE SWITCH: Regenerate system prompt with new tutor persona
              // This ensures the new tutor (e.g., Agustin) doesn't still have Daniela's Spanish persona
              session.systemPrompt = createSystemPrompt(
                session.targetLanguage,                        // language (unchanged)
                session.difficultyLevel,                       // difficulty
                session.conversationHistory.length,            // messageCount
                false,                                          // isVoiceMode
                undefined,                                      // topic
                undefined,                                      // previousConversations
                session.nativeLanguage,                        // nativeLanguage
                undefined,                                      // dueVocabulary
                undefined,                                      // sessionVocabulary
                undefined,                                      // actflLevel
                false,                                          // isResuming
                0,                                              // totalMessageCount
                session.tutorPersonality,                      // tutorPersonality
                session.tutorExpressiveness,                   // tutorExpressiveness
                true,                                           // isStreamingVoiceMode
                null,                                           // curriculumContext
                'flexible_goals',                              // tutorFreedomLevel
                undefined,                                      // targetActflLevel
                null,                                           // compassContext
                session.isFounderMode,                         // isFounderMode
                undefined,                                      // founderName
                session.isRawHonestyMode,                      // isRawHonestyMode
                tutorName || 'your tutor',                     // tutorName - NEW TUTOR!
                targetGender,                                  // tutorGender - NEW GENDER!
                undefined                                      // tutorDirectory (session already has it)
              );
              console.log(`[Tutor Switch] Same-language switch, new voice: ${matchingVoice.voiceName}, system prompt regenerated for ${tutorName}`);
            }
          } else {
            console.warn(`[Tutor Switch] No matching voice found for ${targetGender} in ${effectiveLanguage}`);
          }
          
            // Notify client to update voice preference
            // ALL handoffs should trigger a greeting from the new tutor
            // The new tutor introduces themselves rather than the old tutor speaking for them
            this.sendMessage(session.ws, {
              type: 'tutor_handoff',
              timestamp: Date.now(),
              targetGender,
              targetLanguage: isLanguageSwitch ? effectiveLanguage : undefined,
              tutorName,
              isLanguageSwitch,
              requiresGreeting: true, // New tutor always speaks their own intro
            });
          } // End of else (main tutor switch)
        } catch (err: any) {
          console.error(`[Tutor Switch] Error during handoff:`, err.message);
          // Still send handoff message so client can proceed
          this.sendMessage(session.ws, {
            type: 'tutor_handoff',
            timestamp: Date.now(),
            targetGender,
            isLanguageSwitch: false,
          });
        }
      }
      
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
      console.error(`[Streaming Orchestrator] Error:`, error.message);
      
      // Emit error diagnostic for analytics
      voiceDiagnostics.emit({
        sessionId,
        stage: 'error',
        success: false,
        error: error.message,
        metadata: { 
          phase: 'processUserAudio',
          sttMs: metrics.sttLatencyMs || 0,
          aiMs: metrics.aiFirstTokenMs || 0 
        }
      });
      
      this.sendError(session.ws, 'UNKNOWN', error.message, true);
      // Return metrics instead of throwing to prevent socket disconnect
      // The error message has already been sent to the client
      return metrics;
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
    
    // BARGE-IN DETECTION: If AI is currently generating a response, interrupt it
    if (session.isGenerating) {
      console.log(`[Streaming Orchestrator] BARGE-IN (open mic): User spoke while AI generating - interrupting`);
      this.handleInterrupt(sessionId);
    }
    
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
    };
    
    try {
      console.log(`[Streaming Orchestrator] Open mic transcript: "${transcript}" (${(confidence * 100).toFixed(0)}%)`);
      
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
      let firstTokenReceived = false;
      let fullText = '';
      
      // DEDUPLICATION GUARD: Track seen sentences to prevent LLM repetition loops
      const seenSentences = new Set<string>();
      const MAX_SENTENCES = 5;
      let actualSentenceCount = 0;
      
      // Check for architect notes and student learning context in parallel
      let architectContext = '';
      let studentLearningSection = '';
      session.pendingArchitectNoteIds = [];  // Reset for this turn
      
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
                console.log(`[Student Intelligence] Open mic: ${learningContext.struggles?.length || 0} struggles, ${crossSessionContext.recentSessions.length} recent sessions`);
                
                // ADAPTIVE SPEED: Sync session struggle count from persistent data
                const activeStruggles = learningContext.struggles?.filter(s => s.status === 'active') || [];
                if (activeStruggles.length > session.sessionStruggleCount) {
                  session.sessionStruggleCount = activeStruggles.length;
                  console.log(`[Adaptive Speed] Open mic: Synced ${activeStruggles.length} active struggles from student profile`);
                }
              }
            })
            .catch(err => console.warn(`[Student Intelligence] Failed (open mic):`, err.message))
        );
      }
      
      await Promise.all(contextPromises);
      
      // BARGE-IN CONTEXT: Let Daniela know the student interrupted her
      let interruptContext = '';
      if (session.lastTurnWasInterrupted) {
        interruptContext = '\n\n[CONTEXT: The student just interrupted you while you were speaking. They clearly have something important to say. Acknowledge what they said naturally without drawing attention to the interruption itself - just respond to their message directly.]';
        session.lastTurnWasInterrupted = false;  // Reset after using
        console.log('[Streaming Orchestrator] Injecting barge-in context for interrupted response');
      }
      
      const userMessageWithNote = transcript + architectContext + interruptContext;
      
      // Build enhanced system prompt with student learning context
      const enhancedSystemPrompt = studentLearningSection 
        ? session.systemPrompt + studentLearningSection 
        : session.systemPrompt;
      
      await this.geminiService.streamWithSentenceChunking({
        systemPrompt: enhancedSystemPrompt,
        conversationHistory: session.conversationHistory,
        userMessage: userMessageWithNote,
        onSentence: async (chunk: SentenceChunk) => {
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
            session.onTtsStateChange?.(true);
          }
          
          const displayText = cleanTextForDisplay(chunk.text);
          if (!displayText) return;
          
          const normalizedText = displayText.toLowerCase().trim();
          if (seenSentences.has(normalizedText)) return;
          seenSentences.add(normalizedText);
          
          if (actualSentenceCount >= MAX_SENTENCES) return;
          actualSentenceCount++;
          
          // Parse whiteboard markup
          const whiteboardParsed = parseWhiteboardMarkup(chunk.text);
          if (whiteboardParsed.whiteboardItems.length > 0) {
            this.sendMessage(session.ws, {
              type: 'whiteboard_update',
              timestamp: Date.now(),
              turnId,
              items: whiteboardParsed.whiteboardItems,
              shouldClear: whiteboardParsed.shouldClear,
            } as StreamingWhiteboardMessage);
          }
          
          // Extract target language with word mapping
          const extraction = extractTargetLanguageWithMapping(displayText, chunk.text);
          const wordMappingArray: [number, number][] = extraction.wordMapping.size > 0
            ? Array.from(extraction.wordMapping.entries())
            : [];
          const hasTargetContent = !!(extraction.targetText && extraction.targetText.trim().length > 0);
          
          // Send sentence start
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
          
          // Stream TTS for this sentence
          if (STREAMING_FEATURE_FLAGS.PROGRESSIVE_AUDIO_STREAMING) {
            await this.streamSentenceAudioProgressive(session, chunk, displayText, metrics, turnId);
          } else {
            await this.streamSentenceAudio(session, chunk, displayText, metrics, turnId);
          }
          
          fullText += displayText + ' ';
          metrics.sentenceCount++;
        },
      });
      
      console.log(`[Streaming Orchestrator] AI complete: ${actualSentenceCount} sentences`);
      
      // Update conversation history
      if (transcript.trim()) {
        session.conversationHistory.push({ role: 'user', content: transcript });
      }
      if (fullText.trim()) {
        session.conversationHistory.push({ role: 'model', content: fullText.trim() });
      }
      
      // Clear generating flag - response complete
      session.isGenerating = false;
      
      // Mark architect notes as delivered (only if not cleared by handleInterrupt)
      // handleInterrupt clears session.pendingArchitectNoteIds, so this is empty if interrupted
      if (session.pendingArchitectNoteIds.length > 0) {
        await architectVoiceService.markNotesDelivered(session.pendingArchitectNoteIds);
        session.pendingArchitectNoteIds = [];  // Clear after delivery
      }
      
      // Response complete
      metrics.totalLatencyMs = Date.now() - startTime;
      
      // ECHO SUPPRESSION: Re-enable OpenMic transcription now that TTS is done
      session.onTtsStateChange?.(false);
      
      this.sendMessage(session.ws, {
        type: 'response_complete',
        timestamp: Date.now(),
        turnId,
        totalSentences: metrics.sentenceCount,
        totalDurationMs: metrics.totalLatencyMs,
        fullText: fullText.trim(),
      } as StreamingResponseCompleteMessage);
      
      // Persist messages
      this.persistMessages(session.conversationId, transcript, fullText.trim(), session, confidence).catch((err: Error) => {
        console.error('[Streaming Orchestrator] Failed to persist messages:', err.message);
      });
      
      return metrics;
      
    } catch (error: any) {
      // Clear generating flag on error
      session.isGenerating = false;
      // ECHO SUPPRESSION: Re-enable OpenMic transcription on error too
      session.onTtsStateChange?.(false);
      console.error(`[Streaming Orchestrator] Open mic error:`, error.message);
      
      // Emit error diagnostic for analytics
      voiceDiagnostics.emit({
        sessionId,
        stage: 'error',
        success: false,
        error: error.message,
        metadata: { phase: 'processOpenMicTranscript' }
      });
      
      this.sendError(session.ws, 'UNKNOWN', error.message, true);
      // Return metrics instead of throwing to prevent socket disconnect
      return metrics;
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
    isFounderMode: boolean = false
  ): Promise<{ transcript: string; confidence: number; intelligence?: DeepgramIntelligence; words?: TranscriptionResult['words'] }> {
    // MULTI-LANGUAGE: Always use multi-language detection
    // Students naturally mix native + target language during lessons
    const languageCode = 'multi';
    
    console.log(`[Deepgram] Transcribing ${audioData.length} bytes, language: ${languageCode} (bilingual: ${nativeLanguage}/${targetLanguage})`);
    
    // Log header to verify WebM format (0x1A 0x45 0xDF 0xA3)
    const header = audioData.slice(0, 16);
    console.log(`[Deepgram] Audio header: ${header.toString('hex')}`);
    
    // Use LIVE API for push-to-talk (more reliable for WebM/Opus from MediaRecorder)
    // The prerecorded API returns "duration: unknown, channels: 0" for browser WebM
    try {
      const result = await transcribeWithLiveAPI(audioData, {
        language: languageCode,
        enableIntelligence: true,
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
  
  /**
   * Stream audio for a single sentence
   * Collects all audio chunks to form a complete MP3 file before sending
   * (MP3 fragments are not individually playable)
   * @param session - Current streaming session
   * @param chunk - The sentence chunk from Gemini
   * @param displayText - Cleaned text for display/timing (without markdown/emotion tags)
   * @param metrics - Metrics to update
   * @param turnId - Turn ID for packet ordering (prevents phantom subtitles)
   */
  private async streamSentenceAudio(
    session: StreamingSession,
    chunk: SentenceChunk,
    displayText: string,
    metrics: StreamingMetrics,
    turnId?: number
  ): Promise<void> {
    const { text: originalText, index } = chunk;
    
    // ASSISTANT MODE: Use Google TTS instead of Cartesia for practice partners
    if (session.isAssistantActive) {
      await this.streamSentenceAudioWithGoogle(session, chunk, displayText, metrics, turnId);
      return;
    }
    
    // Determine emotion based on original text (which may have emotion tags)
    const emotion = this.selectEmotionForContext(originalText, session);
    
    let totalDurationMs = 0;
    const audioChunks: Buffer[] = [];
    let audioFormat: 'mp3' | 'pcm_f32le' = 'mp3';  // Track format from first chunk
    let sampleRate: number = 24000;
    const ttsStart = Date.now();  // Track TTS timing for non-progressive mode
    let firstChunkReceived = false;
    
    try {
      // Collect all audio chunks from Cartesia (MP3 fragments need concatenation)
      // IMPORTANT: Use displayText (cleaned) for TTS, not originalText (which may have emotion tags)
      for await (const audioChunk of this.cartesiaService.streamSynthesize({
        text: displayText,
        language: session.targetLanguage,
        targetLanguage: session.targetLanguage, // For phoneme pronunciation
        voiceId: session.voiceId,
        speakingRate: getAdaptiveSpeakingRate(session),
        emotion,
        personality: session.tutorPersonality,
        expressiveness: session.tutorExpressiveness,
      })) {
        if (audioChunk.audio.length > 0) {
          // Track TTS first byte timing only on non-empty audio (actual TTS output)
          if (!firstChunkReceived) {
            firstChunkReceived = true;
            if (index === 0 && !metrics.ttsFirstByteMs) {
              metrics.ttsFirstByteMs = Date.now() - ttsStart;
            }
          }
          audioChunks.push(audioChunk.audio);
          metrics.audioBytes += audioChunk.audio.length;
          totalDurationMs += audioChunk.durationMs;
          
          // Track format from first chunk
          if (audioChunks.length === 1 && audioChunk.audioFormat) {
            audioFormat = audioChunk.audioFormat;
            sampleRate = audioChunk.sampleRate || 24000;
          }
        }
        
        if (audioChunk.isLast) {
          break;
        }
      }
      
      // Concatenate all chunks into complete audio buffer
      const completeAudio = Buffer.concat(audioChunks);
      const formatLabel = audioFormat === 'pcm_f32le' ? 'PCM' : 'MP3';
      console.log(`[Streaming] Sentence ${index}: ${completeAudio.length} bytes (${formatLabel}), ${Math.round(totalDurationMs)}ms`);
      
      // Skip sending empty audio (e.g., from emoji-only sentences)
      // Sending empty audio confuses the client's audio playback loop
      if (completeAudio.length === 0) {
        console.log(`[Streaming] Skipping empty sentence ${index} (no audio data)`);
        return;
      }
      
      // Use current turn ID if not explicitly passed
      const effectiveTurnId = turnId ?? session.currentTurnId;
      
      // Send word timings BEFORE audio so client has them ready when playback starts
      // Use native Cartesia timestamps if available (more accurate), otherwise estimate
      if (session.subtitleMode !== 'off') {
        // Consume native timestamps from Cartesia (clears after retrieval to prevent reuse)
        const nativeTimestamps = this.cartesiaService.consumeNativeTimestamps();
        let finalTimings: WordTiming[];
        
        if (nativeTimestamps.length > 0) {
          // Use native timestamps from Cartesia WebSocket API
          console.log(`[Streaming] Using ${nativeTimestamps.length} native Cartesia timestamps for sentence ${index}`);
          finalTimings = nativeTimestamps;
        } else {
          // Fall back to estimation (when WebSocket not connected or timestamps not returned)
          finalTimings = this.estimateWordTimings(displayText, totalDurationMs / 1000);
        }
        
        this.sendMessage(session.ws, {
          type: 'word_timing',
          timestamp: Date.now(),
          turnId: effectiveTurnId,
          sentenceIndex: index,
          words: finalTimings,
          timings: finalTimings,
          expectedDurationMs: totalDurationMs, // For client-side rescaling
        } as StreamingWordTimingMessage);
      }
      
      // Send the complete audio after word timings
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
        audioFormat: audioFormat,  // 'mp3' or 'pcm_f32le'
        sampleRate: sampleRate,    // 24000 for PCM
      } as StreamingAudioChunkMessage);
      
      // Send sentence end
      this.sendMessage(session.ws, {
        type: 'sentence_end',
        timestamp: Date.now(),
        turnId: effectiveTurnId,
        sentenceIndex: index,
        totalDurationMs,
      } as StreamingSentenceEndMessage);
      
    } catch (error: any) {
      console.error(`[Streaming] TTS error for sentence ${index}:`, error.message);
      // Emit TTS error for diagnostics
      voiceDiagnostics.emit({
        sessionId: session.id,
        stage: 'tts',
        success: false,
        error: error.message,
        metadata: { sentenceIndex: index }
      });
      // Send error to client but don't throw - allows session to continue
      this.sendError(session.ws, 'TTS_ERROR', `Audio generation failed for sentence ${index}`, true);
    }
  }
  
  /**
   * Stream audio for a sentence using Google Cloud TTS (for assistant tutors)
   * Non-streaming but provides reliable audio for practice partners
   * 
   * @param session - Current streaming session (must have isAssistantActive = true)
   * @param chunk - The sentence chunk from Gemini
   * @param displayText - Cleaned text for display/timing
   * @param metrics - Metrics to update  
   * @param turnId - Turn ID for packet ordering
   */
  private async streamSentenceAudioWithGoogle(
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
      
      // Get the appropriate Google voice for the assistant based on language and gender
      const assistantGender = session.tutorGender === 'male' ? 'male' : 'female';
      const assistantVoice = getAssistantVoice(session.targetLanguage, assistantGender as any);
      
      console.log(`[Streaming] Assistant TTS (Google): sentence ${index}, voice: ${assistantVoice.name}, language: ${session.targetLanguage}`);
      
      // Synthesize using Google Cloud TTS with the assistant-specific voice
      // CRITICAL: forceProvider bypasses Cartesia and goes directly to Google
      const result = await ttsService.synthesize({
        text: displayText,
        language: session.targetLanguage,
        targetLanguage: session.targetLanguage,
        voice: assistantVoice.name, // Use the assistant voice name (e.g., "es-ES-Chirp3-HD-Eosi")
        speakingRate: 1.0, // Standard rate for practice
        forceProvider: 'google', // CRITICAL: Force Google TTS for assistant tutors, bypass Cartesia
      });
      
      if (!result.audio || result.audio.length === 0) {
        console.warn(`[Streaming] Google TTS returned empty audio for sentence ${index}`);
        return;
      }
      
      metrics.audioBytes += result.audio.length;
      const totalDurationMs = result.durationMs || 3000; // Estimate if not provided
      
      console.log(`[Streaming] Assistant sentence ${index}: ${result.audio.length} bytes (Google MP3), ~${Math.round(totalDurationMs)}ms`);
      
      // Send word timings (estimated since Google doesn't provide native timings)
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
      
      // Send the audio
      const audioBase64 = result.audio.toString('base64');
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
      
      // Send sentence end
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
  
  /**
   * PROGRESSIVE STREAMING: Stream audio for a single sentence with immediate forwarding
   * 
   * Unlike streamSentenceAudio (which buffers full sentence), this method forwards
   * audio chunks to the client as soon as they arrive from Cartesia.
   * 
   * Benefits:
   * - ~2s faster time-to-first-audio (no sentence buffering delay)
   * - More responsive feel for users
   * 
   * Trade-offs:
   * - Word timings arrive incrementally (delta messages + final reconciliation)
   * - Client needs to handle progressive audio assembly
   * 
   * @param session - Current streaming session
   * @param chunk - The sentence chunk from Gemini
   * @param displayText - Cleaned text for display/timing
   * @param metrics - Metrics to update
   * @param turnId - Turn ID for packet ordering
   */
  private async streamSentenceAudioProgressive(
    session: StreamingSession,
    chunk: SentenceChunk,
    displayText: string,
    metrics: StreamingMetrics,
    turnId?: number
  ): Promise<void> {
    // ASSISTANT MODE: Use Google TTS instead of Cartesia for practice partners
    // Falls back to non-progressive streaming since Google doesn't support streaming
    if (session.isAssistantActive) {
      await this.streamSentenceAudioWithGoogle(session, chunk, displayText, metrics, turnId);
      return;
    }
    
    const { text: originalText, index } = chunk;
    const emotion = this.selectEmotionForContext(originalText, session);
    const effectiveTurnId = turnId ?? session.currentTurnId;
    
    // === TIMING RACE FIX: Server-side buffering ===
    // Buffer audio chunks until we have at least the first word timing.
    // Once both are available, send atomic 'sentence_ready' message.
    // This prevents the race condition where client starts playback before timings arrive.
    
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
    let sentenceReadySent = false;  // Have we sent the sentence_ready message?
    let chunkIndex = 0;
    
    // Helper: Flush buffered data when we have both audio AND timing
    // CRITICAL: This MUST only fire when we have at least one timing
    // to guarantee the client can start playback with timing data.
    const trySendSentenceReady = () => {
      if (sentenceReadySent) return;
      if (bufferedAudioChunks.length === 0) return;  // No audio yet
      
      // CRITICAL FIX: Only send sentence_ready when we have at least one timing
      // This prevents the race condition where playback starts without timing data
      if (bufferedWordTimings.length === 0) {
        console.log(`[Progressive] Sentence ${index}: Waiting for first word timing (have ${bufferedAudioChunks.length} audio chunks buffered)`);
        return;  // Wait until we have at least one timing
      }
      
      // We have both audio AND timing - send the atomic sentence_ready message
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
      
      // Send any additional buffered audio chunks (beyond the first one)
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
      
      // Clear buffers - subsequent data goes directly to client
      bufferedAudioChunks = [];
      // Note: Word timings buffer stays to track what we've sent
    };
    
    try {
      // Use progressive streaming API with real-time callbacks
      const result = await this.cartesiaService.streamSynthesizeProgressive(
        {
          text: displayText,
          language: session.targetLanguage,
          targetLanguage: session.targetLanguage,
          voiceId: session.voiceId,
          speakingRate: getAdaptiveSpeakingRate(session),
          emotion,
          personality: session.tutorPersonality,
          expressiveness: session.tutorExpressiveness,
        },
        {
          // Audio chunk callback - buffer until timing arrives, then stream directly
          onAudioChunk: (audioChunk, idx) => {
            metrics.audioBytes += audioChunk.audio.length;
            
            if (!sentenceReadySent) {
              // Still buffering - wait for first timing
              console.log(`[Progressive] Sentence ${index}: Buffering audio chunk ${idx} (waiting for timing)`);
              bufferedAudioChunks.push({
                audio: audioChunk.audio,
                durationMs: audioChunk.durationMs,
                audioFormat: audioChunk.audioFormat || 'pcm_f32le',
                sampleRate: audioChunk.sampleRate || 24000,
                chunkIndex: idx,
              });
              trySendSentenceReady();
            } else {
              // sentence_ready already sent - forward audio directly
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
          
          // Word timing callback - buffer until audio arrives, then stream deltas
          onWordTimestamp: (timing, wordIdx, estimatedTotal) => {
            estimatedTotalDuration = estimatedTotal;
            
            if (!sentenceReadySent) {
              // Still buffering - accumulate timings
              console.log(`[Progressive] Sentence ${index}: Buffering word ${wordIdx} "${timing.word}" (waiting for audio)`);
              bufferedWordTimings.push(timing);
              trySendSentenceReady();
            } else {
              // sentence_ready already sent - send as delta
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
          
          // Final reconciliation when synthesis completes
          onComplete: (finalTimestamps, actualDurationMs) => {
            // If we never sent sentence_ready (edge case: no timings at all), send now with estimated timings
            if (!sentenceReadySent && bufferedAudioChunks.length > 0) {
              console.log(`[Progressive] Sentence ${index}: No native timings received, using estimates`);
              const estimatedTimings = this.estimateWordTimings(displayText, actualDurationMs / 1000);
              bufferedWordTimings = estimatedTimings;
              trySendSentenceReady();
            }
            
            // Send final timing reconciliation
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
            
            // Send final "empty" audio chunk to signal end
            this.sendMessage(session.ws, {
              type: 'audio_chunk',
              timestamp: Date.now(),
              turnId: effectiveTurnId,
              sentenceIndex: index,
              chunkIndex,
              isLast: true,
              durationMs: 0,
              audio: '', // Empty base64
              audioFormat: 'pcm_f32le',
              sampleRate: 24000,
            } as StreamingAudioChunkMessage);
            
            // Send sentence end
            this.sendMessage(session.ws, {
              type: 'sentence_end',
              timestamp: Date.now(),
              turnId: effectiveTurnId,
              sentenceIndex: index,
              totalDurationMs: actualDurationMs,
            } as StreamingSentenceEndMessage);
            
            console.log(`[Progressive] Sentence ${index}: Complete (${chunkIndex} chunks, ${actualDurationMs}ms)`);
          },
        }
      );
      
    } catch (error: any) {
      console.error(`[Progressive] TTS error for sentence ${index}:`, error.message);
      // Emit TTS error for diagnostics (progressive mode)
      voiceDiagnostics.emit({
        sessionId: session.id,
        stage: 'tts',
        success: false,
        error: error.message,
        metadata: { sentenceIndex: index, mode: 'progressive' }
      });
      // Send error to client but don't throw - allows session to continue
      this.sendError(session.ws, 'TTS_ERROR', `Audio generation failed for sentence ${index}`, true);
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
   * Persist user and AI messages to database
   */
  private async persistMessages(
    conversationId: string, 
    userTranscript: string, 
    aiResponse: string,
    session: StreamingSession,
    pronunciationConfidence: number = 0
  ): Promise<void> {
    try {
      // Save user message
      await storage.createMessage({
        conversationId,
        role: 'user',
        content: userTranscript,
      });
      
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
          await this.processBackgroundEnrichment(
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
  
  /**
   * Emit hive beacons for Daniela-Editor collaboration
   * Only emits beacons when Daniela explicitly signals she needs something:
   * - Capability gaps, tool requests, friction reports, feature ideas
   * - Self-surgery proposals, knowledge gaps, bug reports
   * We do NOT emit beacons just for using tools - that's observing teaching, not collaboration.
   */
  private async emitHiveBeacons(
    session: StreamingSession,
    studentTurn: string,
    tutorTurn: string,
    rawTutorTurn?: string  // Raw AI response with COLLAB/SELF_SURGERY tags intact
  ): Promise<void> {
    if (!session.hiveChannelId) return;
    
    // Parse tutor response for whiteboard markup
    const whiteboardItems = parseWhiteboardMarkup(tutorTurn);
    
    // COLLAB/SELF_SURGERY EXTRACTION: Extract collaboration signals from raw response
    // These tags are stripped for display but should be sent to Editor as beacons
    const rawText = rawTutorTurn || tutorTurn;
    
    // COLLAB tags: [COLLAB:TYPE]content[/COLLAB]
    // Map to collaboration beacon types - these are Daniela telling Editor what she needs
    const collabPattern = /\[COLLAB:(SUGGESTION|PAIN_POINT|QUESTION|INSIGHT|MISSING_TOOL|FEATURE_REQUEST|KNOWLEDGE_PING|CAPABILITY_GAP|FRICTION|BUG|NORTH_STAR_OBSERVATION|EXPRESS_INSIGHT)\]([\s\S]*?)\[\/COLLAB\]/g;
    let collabMatch;
    while ((collabMatch = collabPattern.exec(rawText)) !== null) {
      const signalType = collabMatch[1];
      const content = collabMatch[2].trim();
      
      // Map signal type to collaboration beacon type
      let beaconType: BeaconType = 'feature_idea'; // Default to feature idea
      let beaconReason = `${signalType}: ${content.slice(0, 100)}`;
      
      if (signalType === 'KNOWLEDGE_PING') {
        beaconType = 'knowledge_gap';
        beaconReason = `Daniela needs knowledge: ${content.slice(0, 100)}`;
      } else if (signalType === 'MISSING_TOOL' || signalType === 'CAPABILITY_GAP') {
        beaconType = 'capability_gap';
        beaconReason = `Daniela couldn't do: ${content.slice(0, 100)}`;
      } else if (signalType === 'FEATURE_REQUEST' || signalType === 'SUGGESTION') {
        beaconType = 'tool_request';
        beaconReason = `Daniela requests: ${content.slice(0, 100)}`;
      } else if (signalType === 'PAIN_POINT' || signalType === 'FRICTION') {
        beaconType = 'friction_report';
        beaconReason = `Friction: ${content.slice(0, 100)}`;
      } else if (signalType === 'BUG') {
        beaconType = 'bug_report';
        beaconReason = `Bug: ${content.slice(0, 100)}`;
      } else if (signalType === 'INSIGHT' || signalType === 'QUESTION') {
        beaconType = 'feature_idea';
        beaconReason = `Idea: ${content.slice(0, 100)}`;
      } else if (signalType === 'NORTH_STAR_OBSERVATION') {
        beaconType = 'teaching_observation';
        beaconReason = `North Star reflection: ${content.slice(0, 100)}`;
      } else if (signalType === 'EXPRESS_INSIGHT') {
        beaconType = 'teaching_observation';
        beaconReason = `Teaching breakthrough: ${content.slice(0, 100)}`;
      }
      
      try {
        await hiveCollaborationService.emitBeacon({
          channelId: session.hiveChannelId,
          tutorTurn: content,
          studentTurn,
          beaconType,
          beaconReason,
        });
        console.log(`[Hive Beacon] Emitted COLLAB:${signalType} beacon`);
      } catch (err: any) {
        console.warn(`[Hive Beacon] Failed to emit COLLAB beacon:`, err.message);
      }
    }
    
    // SELF_SURGERY tags: [SELF_SURGERY target="..." priority=... confidence=... content='...' ...]
    const selfSurgeryPattern = /\[SELF_SURGERY[^\]]*\]/gi;
    let surgeryMatch;
    while ((surgeryMatch = selfSurgeryPattern.exec(rawText)) !== null) {
      const fullTag = surgeryMatch[0];
      
      try {
        await hiveCollaborationService.emitBeacon({
          channelId: session.hiveChannelId,
          tutorTurn: fullTag,
          studentTurn,
          beaconType: 'self_surgery_proposal',
          beaconReason: 'Daniela proposed a neural network modification',
        });
        console.log(`[Hive Beacon] Emitted SELF_SURGERY beacon`);
      } catch (err: any) {
        console.warn(`[Hive Beacon] Failed to emit SELF_SURGERY beacon:`, err.message);
      }
    }
    
    // OBSERVE tags: [OBSERVE reason="..." note="..."]
    // Lightweight teaching observations for Founder Mode discussion
    // Daniela uses these to note insights worth discussing in office hours
    const observePattern = /\[OBSERVE\s+reason="([^"]+)"\s+note="([^"]+)"\]/gi;
    let observeMatch;
    while ((observeMatch = observePattern.exec(rawText)) !== null) {
      const reason = observeMatch[1];
      const note = observeMatch[2];
      
      try {
        await hiveCollaborationService.emitBeacon({
          channelId: session.hiveChannelId,
          tutorTurn: note,
          studentTurn,
          beaconType: 'teaching_observation',
          beaconReason: reason,
        });
        console.log(`[Hive Beacon] Emitted OBSERVE beacon: ${reason}`);
      } catch (err: any) {
        console.warn(`[Hive Beacon] Failed to emit OBSERVE beacon:`, err.message);
      }
    }
    
    // SELF_LEARN tags: [SELF_LEARN category="..." insight="..." context="..."]
    // AUTONOMOUS NEURAL NETWORK WRITES: Daniela learns from teaching in real-time
    // Unlike SELF_SURGERY (proposals), these write DIRECTLY to her neural network
    // Categories: tool_usage, teaching_style, pacing, communication, content, system
    const selfLearnPattern = /\[SELF_LEARN\s+category="([^"]+)"\s+insight="([^"]+)"\s+context="([^"]+)"\]/gi;
    let learnMatch;
    while ((learnMatch = selfLearnPattern.exec(rawText)) !== null) {
      const category = learnMatch[1] as 'tool_usage' | 'teaching_style' | 'pacing' | 'communication' | 'content' | 'system';
      const insight = learnMatch[2];
      const context = learnMatch[3];
      
      // Validate category is one of the allowed types
      const validCategories = ['tool_usage', 'teaching_style', 'pacing', 'communication', 'content', 'system'];
      if (!validCategories.includes(category)) {
        console.warn(`[SELF_LEARN] Invalid category "${category}", skipping`);
        continue;
      }
      
      try {
        // AUTONOMOUS WRITE: Directly write to Daniela's neural network
        // No approval workflow - she learns in real-time from teaching
        await storage.upsertBestPractice(
          category,
          insight,
          context,
          'self_learn' // Source indicates autonomous learning from teaching
        );
        
        console.log(`[SELF_LEARN] ✅ Wrote to neural network: ${category} - "${insight.slice(0, 50)}..."`);
        
        // Also emit a beacon so founder can see learning activity (read-only visibility)
        if (session.hiveChannelId) {
          await hiveCollaborationService.emitBeacon({
            channelId: session.hiveChannelId,
            tutorTurn: `[LEARNED] ${category}: ${insight}`,
            studentTurn,
            beaconType: 'teaching_observation',
            beaconReason: `Autonomous learning: ${context.slice(0, 80)}`,
          });
        }
      } catch (err: any) {
        console.error(`[SELF_LEARN] Failed to write to neural network:`, err.message);
      }
    }
    
    // WREN_SPRINT_SUGGEST tags: [WREN_SPRINT_SUGGEST: {...}] or [WREN_SPRINT_SUGGEST title="..." ...]
    // Daniela suggests a new feature sprint to Wren via EXPRESS Lane
    // Creates an actual featureSprint record AND posts to EXPRESS Lane for discussion
    const wrenSprintPattern = /\[WREN_SPRINT_SUGGEST[:\s]([^\]]+)\]/gi;
    let sprintMatch;
    while ((sprintMatch = wrenSprintPattern.exec(rawText)) !== null) {
      const sprintContent = sprintMatch[1].trim();
      
      try {
        // Parse the sprint content with robust fallback
        const parsed = parseSprintSuggestion(sprintContent);
        
        // Map priority string to valid enum
        const priorityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
          'low': 'low',
          'medium': 'medium',
          'high': 'high',
          'critical': 'critical',
          'urgent': 'critical',
        };
        const sprintPriority = priorityMap[parsed.priority?.toLowerCase() || 'medium'] || 'medium';
        
        // Get or create an active founder session for THIS specific founder
        const founderId = String(session.userId);
        const activeSession = await founderCollabService.getOrCreateActiveSession(founderId);
        
        // Create the actual featureSprint record
        // Using 'ai_suggestion' source since Daniela is an AI suggesting from teaching observations
        const [createdSprint] = await db.insert(featureSprints).values({
          title: parsed.title,
          description: `${parsed.description}\n\n---\n**Origin:** Daniela voice suggestion\n**Context:** During voice chat with student`,
          stage: 'idea',
          priority: sprintPriority,
          source: 'ai_suggestion',
          sourceSessionId: activeSession.id,
          createdBy: 'daniela',
          featureBrief: {
            problem: `Daniela identified this during teaching: ${sprintContent.slice(0, 300)}`,
            solution: parsed.description.slice(0, 500),
          },
        }).returning({ id: featureSprints.id, title: featureSprints.title });
        
        console.log(`[Sprint] ✅ Created sprint from Daniela suggestion: "${createdSprint.title}" (${createdSprint.id})`);
        
        // Post to EXPRESS Lane for discussion with Wren and Founder
        await founderCollabService.addMessage(activeSession.id, {
          role: 'daniela',
          messageType: 'text',
          content: `@Wren Sprint Created: **${createdSprint.title}**\n\nI've created sprint #${createdSprint.id} based on what I'm seeing in teaching. Here's my thinking:\n\n${parsed.description}\n\nWhat do you think about the technical approach?`,
          metadata: {
            wrenTagged: true,
            fromVoiceChat: true,
            suggestionType: 'sprint',
            sprintId: createdSprint.id,
            timestamp: new Date().toISOString(),
          },
        });
        
        console.log(`[EXPRESS Lane] ✅ Daniela posted sprint to discuss: "${createdSprint.title}"`);
        
        // Trigger Wren's build plan response via Hive Consciousness
        // This creates the bidirectional collaboration loop
        try {
          await hiveConsciousnessService.triggerSprintCollaboration(
            activeSession.id,
            createdSprint,
            parsed.description
          );
          console.log(`[Sprint] ✅ Triggered Wren build plan for: "${createdSprint.title}"`);
        } catch (wrenErr: any) {
          console.error(`[Sprint] Failed to trigger Wren build plan:`, wrenErr.message);
        }
        
        // Also emit a beacon for visibility
        if (session.hiveChannelId) {
          await hiveCollaborationService.emitBeacon({
            channelId: session.hiveChannelId,
            tutorTurn: `[SPRINT CREATED] ${createdSprint.title}`,
            studentTurn,
            beaconType: 'feature_idea',
            beaconReason: `Daniela created sprint: ${createdSprint.title}`,
          });
        }
      } catch (err: any) {
        console.error(`[Sprint] Failed to create sprint from Daniela suggestion:`, err.message);
      }
    }
    
    // WREN_MESSAGE tags: [WREN_MESSAGE: content here] or [WREN_MESSAGE content="..."]
    // Direct messages from Daniela to Wren via EXPRESS Lane
    const wrenMessagePattern = /\[WREN_MESSAGE[:\s]([^\]]+)\]/gi;
    let messageMatch;
    while ((messageMatch = wrenMessagePattern.exec(rawText)) !== null) {
      const messageContent = messageMatch[1].trim();
      
      try {
        // Get or create an active founder session for THIS specific founder
        const founderId = String(session.userId);
        const activeSession = await founderCollabService.getOrCreateActiveSession(founderId);
        
        await founderCollabService.addMessage(activeSession.id, {
          role: 'daniela',
          messageType: 'text',
          content: `@Wren ${messageContent}`,
          metadata: {
            wrenTagged: true,
            fromVoiceChat: true,
            timestamp: new Date().toISOString(),
          },
        });
        
        console.log(`[EXPRESS Lane] ✅ Daniela sent message to Wren: "${messageContent.slice(0, 50)}..."`);
      } catch (err: any) {
        console.error(`[EXPRESS Lane] Failed to post message to Wren:`, err.message);
      }
    }
    
    // NOTE: We no longer emit automatic teaching observation beacons.
    // Daniela explicitly signals observations using [OBSERVE] tags when she wants
    // to note something for discussion in Founder Mode office hours.
  }
  
  /**
   * Background enrichment: Extract vocabulary, update user progress, and track ACTFL advancement
   * Runs non-blocking after message persistence
   */
  private async processBackgroundEnrichment(
    session: StreamingSession,
    conversationId: string,
    messageId: string,
    userTranscript: string,
    aiResponse: string,
    pronunciationConfidence: number = 0
  ): Promise<void> {
    const startTime = Date.now();
    console.log(`[Streaming Enrichment] Starting for message: ${messageId}`);
    
    try {
      // Update message status to processing
      await storage.updateMessage(messageId, { enrichmentStatus: 'processing' });
      
      // Get conversation for language/difficulty info
      const conversation = await storage.getConversation(conversationId, String(session.userId));
      if (!conversation) {
        console.error('[Streaming Enrichment] Conversation not found');
        await storage.updateMessage(messageId, { enrichmentStatus: 'failed' });
        return;
      }
      
      // VOCABULARY EXTRACTION: Use Gemini to extract new vocabulary from AI response
      let vocabularyItems: any[] = [];
      try {
        const extractionPrompt = `Extract vocabulary words from this language learning response. The student is learning ${session.targetLanguage} at ${session.difficultyLevel} level. Only extract foreign language words/phrases that were introduced in this response (max 3 items).

AI Response: "${aiResponse}"

Return vocabulary items with word, translation, example sentence, and pronunciation guide.`;

        const response = await gemini.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: extractionPrompt }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: VOCABULARY_EXTRACTION_SCHEMA as any,
          },
        });
        
        const responseText = response.text || "{}";
        const parsed = JSON.parse(responseText);
        vocabularyItems = Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [];
        
        console.log(`[Streaming Enrichment] Extracted ${vocabularyItems.length} vocabulary items`);
      } catch (extractError: any) {
        console.error('[Streaming Enrichment] Vocabulary extraction failed:', extractError.message);
      }
      
      // Save vocabulary words to database with grammar classification
      if (vocabularyItems.length > 0) {
        for (const vocab of vocabularyItems) {
          try {
            await storage.createVocabularyWord({
              userId: String(session.userId),
              language: session.targetLanguage,
              word: vocab.word,
              translation: vocab.translation,
              example: vocab.example || '',
              pronunciation: vocab.pronunciation || '',
              difficulty: session.difficultyLevel,
              sourceConversationId: conversationId,
              wordType: vocab.wordType || 'other',
              verbTense: vocab.verbTense || null,
              verbMood: vocab.verbMood || null,
              verbPerson: vocab.verbPerson || null,
              nounGender: vocab.nounGender || null,
              nounNumber: vocab.nounNumber || null,
              grammarNotes: vocab.grammarNotes || null,
            });
          } catch (vocabError: any) {
            // Duplicate words are expected - silently continue
            if (!vocabError.message?.includes('duplicate')) {
              console.error('[Streaming Enrichment] Failed to save vocab:', vocabError.message);
            }
          }
        }
      }
      
      // STUDENT OBSERVATION EXTRACTION: Learn about the student (insights, motivations, struggles, people)
      // Runs on every message to ensure we don't miss people connections or important observations
      // The small API cost (~$0.002/message) is worth never forgetting someone's wife or friend
      try {
        const observationPrompt = `Analyze this language learning conversation exchange. Extract observations about the student AND the tutor's teaching approach. Only extract what's clearly evident - don't invent or assume.

Student said: "${userTranscript}"
Tutor responded: "${aiResponse}"

PHILOSOPHY: A good tutor remembers the WHOLE person, not just learning stats. Extract BOTH learning-related AND personal life details.

Guidelines for STUDENT observations:
- For LEARNING insights: Note learning styles (visual, auditory, kinesthetic), preferences, strengths
- For PERSONAL insights (equally important!):
  • personal_interest: Hobbies, activities they enjoy (dancing, music, sports, cooking)
  • life_context: Where they live, work, career, life situation
  • hobby: Specific hobbies or pastimes they mention
  • likes_dislikes: Things they love or don't like (Cuban coffee, certain music, foods)
- For motivations: Note why they're learning (travel, family, work, hobby) and any target dates
- For struggles: Note recurring grammar issues, pronunciation difficulties, vocabulary gaps
- For people: Note any people they mention by name and relationship (wife, husband, friend, colleague, child)
  • CRITICAL: Always capture family members - spouse, children, parents, siblings
  • Include context about the person (e.g., "Wife Maria is from Colombia", "Son is learning piano")

Guidelines for TUTOR self-reflections (Daniela learning about herself):
- Note teaching techniques that seemed effective
- Note approaches to correction, encouragement, or scaffolding that worked well
- Categories: correction, encouragement, scaffolding, tool_usage, teaching_style, pacing, communication, content

Only include observations you can clearly justify from the exchange. Return empty arrays if nothing notable.`;

        const obsResponse = await gemini.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: observationPrompt }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: STUDENT_OBSERVATION_SCHEMA as any,
          },
        });
        
        const observations = JSON.parse(obsResponse.text || "{}");
        let savedCount = { insights: 0, motivations: 0, struggles: 0, connections: 0 };
        
        // Save insights
        for (const insight of observations.insights || []) {
          try {
            await storage.upsertStudentInsight(
              String(session.userId),
              session.targetLanguage,
              insight.type,
              insight.insight,
              insight.evidence
            );
            savedCount.insights++;
          } catch (e: any) {
            console.warn('[Student Memory] Failed to save insight:', e.message);
          }
        }
        
        // Save motivations
        for (const mot of observations.motivations || []) {
          try {
            await storage.upsertLearningMotivation(
              String(session.userId),
              session.targetLanguage,
              mot.motivation,
              mot.details,
              conversationId
            );
            savedCount.motivations++;
          } catch (e: any) {
            console.warn('[Student Memory] Failed to save motivation:', e.message);
          }
        }
        
        // Save struggles
        for (const struggle of observations.struggles || []) {
          try {
            await storage.upsertRecurringStruggle(
              String(session.userId),
              session.targetLanguage,
              struggle.area,
              struggle.description,
              struggle.examples
            );
            savedCount.struggles++;
          } catch (e: any) {
            console.warn('[Student Memory] Failed to save struggle:', e.message);
          }
        }
        
        // Save people connections (using existing method)
        for (const conn of observations.peopleConnections || []) {
          try {
            await storage.createPeopleConnection({
              personAId: String(session.userId),
              pendingPersonName: conn.name || null,
              relationshipType: conn.relationship,
              pendingPersonContext: conn.context,
              status: conn.name ? 'pending_match' : 'tentative',
              mentionedBy: String(session.userId),
              sourceConversationId: conversationId,
            });
            savedCount.connections++;
            console.log(`[Student Memory] Saved connection: ${conn.name || 'unnamed'} (${conn.relationship})`);
          } catch (e: any) {
            // Duplicate connections are expected
            if (!e.message?.includes('duplicate')) {
              console.warn('[Student Memory] Failed to save connection:', e.message);
            }
          }
        }
        
        // Save tutor self-reflections (Daniela learning about herself)
        let selfReflectionCount = 0;
        for (const reflection of observations.tutorSelfReflections || []) {
          try {
            await storage.upsertBestPractice(
              reflection.category,
              reflection.insight,
              reflection.context,
              'voice_session'
            );
            selfReflectionCount++;
          } catch (e: any) {
            console.warn('[Tutor Memory] Failed to save self-reflection:', e.message);
          }
        }
        
        if (savedCount.insights + savedCount.motivations + savedCount.struggles + savedCount.connections + selfReflectionCount > 0) {
          console.log(`[Memory] Saved: ${savedCount.insights} student insights, ${savedCount.motivations} motivations, ${savedCount.struggles} struggles, ${savedCount.connections} connections, ${selfReflectionCount} tutor self-reflections`);
        }
      } catch (obsError: any) {
        console.error('[Memory] Observation extraction failed:', obsError.message);
      }
      
      // UPDATE USER PROGRESS: Increment vocabulary count and update last practice
      try {
        const progress = await storage.getOrCreateUserProgress(session.targetLanguage, String(session.userId));
        if (progress) {
          // Increment words learned if we extracted vocabulary
          const wordsLearned = progress.wordsLearned || 0;
          await storage.updateUserProgress(progress.id, {
            wordsLearned: wordsLearned + vocabularyItems.length,
            lastPracticeDate: new Date(),
          });
        }
      } catch (progressError: any) {
        console.error('[Streaming Enrichment] Progress update failed:', progressError.message);
      }
      
      // ACTFL PROGRESS TRACKING: Record voice exchange and check for advancement
      try {
        // Count actual words in user's transcript (handle empty/whitespace properly)
        const trimmedTranscript = userTranscript.trim();
        const userWordCount = trimmedTranscript.length > 0 
          ? trimmedTranscript.split(/\s+/).filter(w => w.length > 0).length 
          : 0;
        
        // Skip ACTFL tracking if user said nothing meaningful
        if (userWordCount === 0) {
          console.log('[ACTFL Tracking] Skipping - empty user transcript');
        } else {
          // Detect communication tasks from user's speech (not AI output)
          // Tasks are based on WHAT the user did, not vocabulary the AI taught
          const detectedTasks: string[] = [];
          const lowerTranscript = trimmedTranscript.toLowerCase();
          
          // Detect basic ACTFL communication functions
          if (/\b(hello|hi|buenos?|hola|bonjour|guten tag)\b/i.test(lowerTranscript)) {
            detectedTasks.push('greeting');
          }
          if (/\?$/.test(trimmedTranscript) || /\b(what|how|why|where|when|who|qué|cómo|dónde)\b/i.test(lowerTranscript)) {
            detectedTasks.push('asking_question');
          }
          if (/\b(my name|me llamo|je m'appelle|ich heisse)\b/i.test(lowerTranscript)) {
            detectedTasks.push('self_introduction');
          }
          if (/\b(i like|i want|me gusta|j'aime|ich mag)\b/i.test(lowerTranscript)) {
            detectedTasks.push('expressing_preference');
          }
          if (/\b(thank|gracias|merci|danke)\b/i.test(lowerTranscript)) {
            detectedTasks.push('thanking');
          }
          
          // Record the voice exchange with ACTUAL metrics
          const actflProgress = await storage.recordVoiceExchange(
            String(session.userId),
            session.targetLanguage,
            {
              pronunciationConfidence: pronunciationConfidence > 0 ? pronunciationConfidence : undefined,
              messageLength: userWordCount,
              topicsCovered: session.difficultyLevel ? [`${session.difficultyLevel}_practice`] : undefined,
              tasksCompleted: detectedTasks.length > 0 ? detectedTasks : undefined,
            }
          );
          
          // Assess if user is ready for ACTFL advancement
          const assessment = assessAdvancementReadiness(actflProgress);
          
          // Only consider advancement if pronunciation confidence is reasonable (at least 60%)
          const hasMinimumAccuracy = (actflProgress.avgPronunciationConfidence || 0) >= 0.6;
          
          if (assessment.readyForAdvancement && assessment.nextLevel && hasMinimumAccuracy) {
            // User qualified for advancement! Send feedback message
            console.log(`[ACTFL Advancement] User ${session.userId} ready to advance from ${assessment.currentLevel} to ${assessment.nextLevel}`);
            
            // Send advancement notification to client
            this.sendMessage(session.ws, {
              type: 'feedback',
              timestamp: Date.now(),
              feedbackType: 'actfl_advancement',
              message: `Congratulations! You're ready to advance to ${formatLevel(assessment.nextLevel)}!`,
              severity: 'positive',
              details: {
                currentLevel: assessment.currentLevel,
                nextLevel: assessment.nextLevel,
                progress: assessment.progress,
                reason: assessment.reason,
              },
            } as StreamingFeedbackMessage);
            
            // Update user's ACTFL level
            await storage.updateActflProgress(actflProgress.id, {
              currentActflLevel: assessment.nextLevel,
              lastAdvancement: new Date(),
              advancementReason: assessment.reason,
              messagesAtCurrentLevel: 0, // Reset for new level
            });
          } else if (assessment.progress >= 80 && hasMinimumAccuracy) {
            // User is close to advancement - log progress (don't spam encouragement)
            console.log(`[ACTFL Advancement] User ${session.userId} at ${assessment.progress}% progress (accuracy: ${((actflProgress.avgPronunciationConfidence || 0) * 100).toFixed(0)}%)`);
          }
        }
      } catch (actflError: any) {
        console.error('[Streaming Enrichment] ACTFL tracking failed:', actflError.message);
      }
      
      // TOPIC TAGGING: Periodically analyze conversation for topic tags
      // Run every 5 messages to avoid excessive API calls
      try {
        if (conversation.messageCount % 5 === 0) {
          const conversationMessages = await storage.getMessagesByConversation(conversationId);
          const messageData = conversationMessages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }));
          
          await tagConversation(conversationId, messageData, session.targetLanguage);
        }
      } catch (tagError: any) {
        console.error('[Streaming Enrichment] Topic tagging failed:', tagError.message);
      }
      
      // Mark enrichment as complete
      await storage.updateMessage(messageId, { enrichmentStatus: null });
      
      const elapsed = Date.now() - startTime;
      console.log(`[Streaming Enrichment] Completed in ${elapsed}ms (${vocabularyItems.length} vocab)`);
      
    } catch (error: any) {
      console.error('[Streaming Enrichment] Error:', error.message);
      await storage.updateMessage(messageId, { enrichmentStatus: 'failed' });
    }
  }
  
  /**
   * ACTFL_UPDATE: Process emergent neural network command to update student proficiency
   * Daniela perceives student performance and decides when to update their level
   * This is a closed-loop system: perceive → assess → update → perceive new state
   * 
   * Also logs to actflAssessmentEvents for analytics/marketing:
   * "Students who received COMPARE tool showed 40% faster mastery"
   */
  private async processActflUpdate(
    session: StreamingSession,
    data: { level: string; confidence: number; reason: string; direction?: 'up' | 'down' | 'confirm' }
  ): Promise<void> {
    try {
      // Only process high-confidence assessments (>= 0.7) to avoid noise
      if (data.confidence < 0.7) {
        console.log(`[ACTFL Update] Skipping low-confidence assessment (${data.confidence}): ${data.reason}`);
        return;
      }
      
      // Get current user progress to compare
      const progress = await storage.getOrCreateUserProgress(session.targetLanguage, String(session.userId));
      
      // IMPORTANT: Capture the true previous level BEFORE any updates
      const previousLevel = progress.currentLevel?.toLowerCase().replace(/[\s-]/g, '_') || 'novice_low';
      
      // Map ACTFL level string to our internal format
      const normalizedLevel = data.level.toLowerCase().replace(/[\s-]/g, '_');
      
      // Only update if different from current (or direction confirms current)
      if (normalizedLevel === previousLevel && data.direction !== 'confirm') {
        console.log(`[ACTFL Update] Level unchanged: ${normalizedLevel}`);
        return;
      }
      
      // Update the user's ACTFL level via database
      await storage.updateUserProgress(progress.id, {
        currentLevel: normalizedLevel,
        lastAssessmentDate: new Date(),
      });
      
      // Log to analytics table with tool context for effectiveness tracking
      const sessionDuration = session.startTime ? Math.floor((Date.now() - session.startTime) / 1000) : null;
      
      // Get unique tools used, limited to avoid unbounded arrays
      const uniqueTools = [...new Set(session.toolsUsedSession || [])];
      const toolsForAnalytics = uniqueTools.slice(0, 50); // Max 50 unique tools
      const recentTools = toolsForAnalytics.slice(-5); // Last 5 for recent context
      
      await storage.createActflAssessmentEvent({
        userId: String(session.userId),
        language: session.targetLanguage,
        previousLevel: previousLevel,  // Uses captured value BEFORE update
        newLevel: normalizedLevel,
        direction: data.direction || null,
        confidence: Math.round(data.confidence * 100),
        reason: data.reason,
        toolsUsedBefore: recentTools,
        toolsUsedSession: toolsForAnalytics,
        messageCountBefore: session.conversationHistory?.length || 0,
        voiceSessionId: session.dbSessionId || null,
        conversationId: session.conversationId,
        classId: session.classId || null,
        sessionDurationSeconds: sessionDuration,
        correctionCountSession: null, // Could track corrections later
      });
      
      // Log the update for neural network analysis
      console.log(`[ACTFL Update] Updated ${session.userId}'s ${session.targetLanguage} level: ${previousLevel} → ${normalizedLevel}`);
      console.log(`[ACTFL Update] Reason: ${data.reason} (confidence: ${data.confidence}, direction: ${data.direction || 'none'})`);
      console.log(`[ACTFL Update] Tools context: ${uniqueTools.length} unique tools used this session`);
      
    } catch (error: any) {
      console.error(`[ACTFL Update] Failed:`, error.message);
    }
  }
  
  /**
   * SYLLABUS_PROGRESS: Process emergent neural network command to track topic competency
   * Daniela observes student demonstrations and marks syllabus topics accordingly
   * Supports: demonstrated (mastered), needs_review (partially understood), struggling (needs help)
   */
  private async processSyllabusProgress(
    session: StreamingSession,
    data: { topic: string; status: 'demonstrated' | 'needs_review' | 'struggling'; evidence: string }
  ): Promise<void> {
    try {
      // Validate required session data
      if (!session.userId || !session.targetLanguage) {
        console.log(`[Syllabus Progress] Skipping - missing userId or language`);
        return;
      }
      
      // Create the topic competency observation
      const observation = await storage.createTopicCompetencyObservation({
        userId: String(session.userId),
        conversationId: session.conversationId || null,
        classId: session.classId || null,
        language: session.targetLanguage,
        topicName: data.topic,
        matchedTopicId: null, // Could implement topic matching later
        status: data.status,
        evidence: data.evidence,
        observedAt: new Date(),
      });
      
      console.log(`[Syllabus Progress] Saved observation ${observation.id} - Topic "${data.topic}": ${data.status}`);
      console.log(`[Syllabus Progress] Evidence: ${data.evidence}`);
      
    } catch (error: any) {
      console.error(`[Syllabus Progress] Failed:`, error.message);
    }
  }
  
  /**
   * PHASE_SHIFT: Process explicit teaching phase transition command
   * When Daniela decides to shift teaching phases (warmup → challenge, etc.)
   * Uses PhaseTransitionService for intelligent context summarization
   */
  private async processPhaseShift(
    session: StreamingSession,
    data: { to: 'warmup' | 'active_teaching' | 'challenge' | 'reflection' | 'drill' | 'assessment'; reason: string }
  ): Promise<void> {
    try {
      // Validate required session data
      if (!session.userId || !session.conversationId) {
        console.log(`[Phase Shift] Skipping - missing userId or conversationId`);
        return;
      }
      
      // Use PhaseTransitionService for the transition
      // The service handles context summarization and state management
      const transitioned = await phaseTransitionService.transitionTo(
        data.to,
        session.conversationHistory || [],
        session.targetLanguage || 'es',
        data.reason
      );
      
      if (transitioned) {
        console.log(`[Phase Shift] Successfully transitioned to ${data.to}`);
        console.log(`[Phase Shift] Reason: ${data.reason}`);
      } else {
        console.log(`[Phase Shift] Transition to ${data.to} skipped (already in phase or invalid)`);
      }
      
    } catch (error: any) {
      console.error(`[Phase Shift] Failed:`, error.message);
    }
  }
  
  /**
   * HIVE: Process Daniela's active contribution to the hive mind
   * Writes suggestions/ideas to daniela_suggestions table for founder review
   * 
   * Valid categories (from suggestion_category enum):
   * - self_improvement: Ideas to improve her own teaching/behavior
   * - content_gap: Missing drills, topics, cultural content
   * - ux_observation: UI/UX issues noticed through student behavior
   * - teaching_insight: Pedagogical pattern that worked/didn't work
   * - product_feature: Feature idea for HolaHola
   */
  private async processHiveSuggestion(
    session: StreamingSession,
    data: { 
      category: string;
      title: string;
      description: string;
      reasoning?: string;
      priority?: number;
    }
  ): Promise<void> {
    try {
      // Validate category against allowed enum values
      const validCategories = [
        'self_improvement',
        'content_gap',
        'ux_observation',
        'teaching_insight',
        'product_feature',
      ] as const;
      
      const category = validCategories.includes(data.category as any) 
        ? data.category as typeof validCategories[number]
        : 'self_improvement'; // Default fallback
      
      // Validate priority (1-100)
      const priority = Math.max(1, Math.min(100, data.priority || 50));
      
      // Create suggestion in daniela_suggestions table
      const suggestion = await storage.createDanielaSuggestion({
        category,
        status: 'emerging', // Use default status from schema
        title: data.title.substring(0, 200), // Ensure title fits varchar
        description: data.description,
        reasoning: data.reasoning || null,
        priority,
        confidence: 80, // Default confidence for voice-generated suggestions
        generatedInMode: session.isFounderMode ? 'founder_mode' : 'normal_session',
        conversationId: session.conversationId,
      });
      
      console.log(`[Hive] Suggestion saved #${suggestion.id}: "${data.title}" (${category})`);
      console.log(`[Hive] Mode: ${session.isFounderMode ? 'founder' : 'normal'}, Priority: ${priority}`);
      
    } catch (error: any) {
      console.error(`[Hive] Failed to save suggestion:`, error.message);
      // Log the full error for debugging but don't throw - non-blocking operation
      console.error(`[Hive] Full error:`, error);
    }
  }
  
  /**
   * ARCHITECT BIDIRECTIONAL: Process Daniela's message to the Architect
   * Routes messages through collaboration hub for real-time 3-way communication
   * 
   * Message types:
   * - question: Daniela asks Claude something
   * - suggestion: Daniela suggests an improvement
   * - observation: Daniela shares an insight
   * - request: Daniela requests an action
   */
  private async processArchitectMessage(
    session: StreamingSession,
    message: ArchitectMessage
  ): Promise<void> {
    try {
      const conversationId = session.conversationId;
      
      // Route based on message type
      switch (message.type) {
        case 'question':
          await collaborationHubService.emitDanielaQuestion({
            content: message.content,
            summary: `Daniela asks: ${message.content.substring(0, 100)}...`,
            conversationId,
          });
          break;
          
        case 'suggestion':
          await collaborationHubService.emitDanielaSuggestion({
            content: message.content,
            summary: `Daniela suggests: ${message.content.substring(0, 100)}...`,
            category: 'improvement_idea',
            urgency: message.urgency || 'medium',
            conversationId,
            targetLanguage: session.targetLanguage,
            studentLevel: session.difficultyLevel,
          });
          break;
          
        case 'observation':
        case 'request':
        default:
          await collaborationHubService.emitDanielaInsight({
            content: message.content,
            summary: `Daniela ${message.type}: ${message.content.substring(0, 100)}...`,
            conversationId,
            targetLanguage: session.targetLanguage,
          });
          break;
      }
      
      // Also emit as a hive beacon for tracking - map message type to collaboration beacon type
      if (session.hiveChannelId) {
        // Map architect message types to collaboration beacon types
        let beaconType: BeaconType = 'feature_idea';
        if (message.type === 'request') beaconType = 'tool_request';
        else if (message.type === 'question') beaconType = 'knowledge_gap';
        else if (message.type === 'suggestion') beaconType = 'feature_idea';
        
        await hiveCollaborationService.emitBeacon({
          channelId: session.hiveChannelId,
          tutorTurn: `[TO_ARCHITECT ${message.type}]: ${message.content}`,
          beaconType,
          beaconReason: `Daniela communicated with Architect: ${message.type}`,
        });
      }
      
      console.log(`[Architect Bidirectional] Message routed: ${message.type} → collaboration hub`);
      
    } catch (error: any) {
      console.error(`[Architect Bidirectional] Failed to route message:`, error.message);
    }
  }
  
  /**
   * SELF-SURGERY: Process Daniela's neural network modification proposals
   * Creates a PENDING proposal for human review - proposals are NOT auto-executed.
   * 
   * Review Pipeline:
   * 1. Daniela proposes a change → Saved to self_surgery_proposals with status='pending'
   * 2. Human reviews in Command Center → Approve or Reject
   * 3. On Approve → surgery-insight-service.ts promotes to neural network table
   * 
   * Target tables (from selfSurgeryTargetEnum):
   * - tutor_procedures: How to handle teaching situations
   * - teaching_principles: Core pedagogical beliefs
   * - tool_knowledge: How to use whiteboard tools
   * - situational_patterns: Compass-triggered behaviors
   * - language_idioms: Language-specific idioms
   * - cultural_nuances: Cultural context
   * - learner_error_patterns: Common learner mistakes
   * - dialect_variations: Dialect-specific knowledge
   * - linguistic_bridges: Cross-language connections
   */
  private async processSelfSurgery(
    session: StreamingSession,
    data: SelfSurgeryItemData
  ): Promise<void> {
    try {
      // Validate target table against allowed enum values
      const validTargets = [
        'tutor_procedures',
        'teaching_principles',
        'tool_knowledge',
        'situational_patterns',
        'language_idioms',
        'cultural_nuances',
        'learner_error_patterns',
        'dialect_variations',
        'linguistic_bridges',
      ] as const;
      
      if (!validTargets.includes(data.targetTable as any)) {
        console.error(`[Self-Surgery] Invalid target table: ${data.targetTable}`);
        return;
      }
      
      // Validate priority and confidence (1-100)
      const priority = Math.max(1, Math.min(100, data.priority || 50));
      const confidence = Math.max(1, Math.min(100, data.confidence || 70));
      
      // Determine session mode
      let sessionMode = 'normal';
      if (session.isFounderMode && session.isRawHonestyMode) {
        sessionMode = 'honesty_mode';
      } else if (session.isFounderMode) {
        sessionMode = 'founder_mode';
      }
      
      // Parse content - expect JSON object
      let contentObj: Record<string, any>;
      try {
        contentObj = typeof data.content === 'string' 
          ? JSON.parse(data.content) 
          : data.content;
      } catch (parseErr) {
        console.error(`[Self-Surgery] Failed to parse content as JSON:`, parseErr);
        console.log(`[Self-Surgery] Raw content: ${data.content}`);
        return;
      }
      
      // Validate content matches target table schema
      const validation = this.validateSurgeryContent(data.targetTable, contentObj);
      if (!validation.valid) {
        console.warn(`[Self-Surgery] Invalid content for ${data.targetTable}: ${validation.error}`);
        console.log(`[Self-Surgery] Missing fields will be noted but proposal still created for review`);
        // Add validation warning to reasoning for reviewer awareness
        data.reasoning = `[SCHEMA WARNING: ${validation.error}] ${data.reasoning || ''}`;
      }
      
      console.log(`[Self-Surgery] 📝 Creating PENDING proposal for ${data.targetTable}...`);
      
      // Save proposal for REVIEW - NOT directly executing
      const proposal = await storage.createSelfSurgeryProposal({
        targetTable: data.targetTable,
        proposedContent: contentObj,
        reasoning: data.reasoning,
        triggerContext: `Voice session in ${session.targetLanguage} (${sessionMode}${session.conversationId ? `, conv: ${session.conversationId.slice(0, 8)}` : ''})`,
        status: 'pending', // Requires human review before promotion
        conversationId: session.conversationId,
        sessionMode,
        targetLanguage: session.targetLanguage,
        priority,
        confidence,
      });
      
      console.log(`[Self-Surgery] ✅ Proposal created #${proposal.id} - awaiting review`);
      console.log(`[Self-Surgery] Target: ${data.targetTable}, Priority: ${priority}, Confidence: ${confidence}`);
      console.log(`[Self-Surgery] Reasoning: ${data.reasoning?.substring(0, 100) || 'No reasoning provided'}...`);
      
      // Emit HIVE beacon to notify about pending proposal
      if (session.hiveChannelId) {
        try {
          const contentPreview = typeof data.content === 'string' 
            ? data.content.substring(0, 200) 
            : JSON.stringify(data.content).substring(0, 200);
          
          await hiveCollaborationService.emitBeacon({
            channelId: session.hiveChannelId,
            tutorTurn: `[Self-Surgery PROPOSAL 📝 #${proposal.id}]\nTarget: ${data.targetTable}\nPriority: ${priority}, Confidence: ${confidence}\nStatus: PENDING REVIEW\n\nContent: ${contentPreview}...`,
            beaconType: 'self_surgery_proposal',
            beaconReason: `PENDING: ${data.reasoning}`,
          });
          console.log(`[Self-Surgery] HIVE beacon emitted for pending proposal #${proposal.id}`);
        } catch (hiveErr) {
          console.error(`[Self-Surgery] Failed to emit HIVE beacon:`, hiveErr);
        }
      }
      
    } catch (error: any) {
      console.error(`[Self-Surgery] Failed to create proposal:`, error.message);
      console.error(`[Self-Surgery] Full error:`, error);
    }
  }
  
  /**
   * Validate Self-Surgery content matches required schema for target table
   * Returns validation result with error message if invalid
   */
  private validateSurgeryContent(target: string, content: Record<string, any>): { valid: boolean; error?: string } {
    switch (target) {
      case 'tutor_procedures':
        if (!content.category || !content.trigger || !content.procedure) {
          return { valid: false, error: 'tutor_procedures requires: category, trigger, procedure' };
        }
        break;
      case 'teaching_principles':
        if (!content.category || !content.principle) {
          return { valid: false, error: 'teaching_principles requires: category, principle' };
        }
        break;
      case 'tool_knowledge':
        if (!content.toolName || !content.toolType || !content.purpose || !content.syntax) {
          return { valid: false, error: 'tool_knowledge requires: toolName, toolType, purpose, syntax' };
        }
        break;
      case 'situational_patterns':
        if (!content.patternName) {
          return { valid: false, error: 'situational_patterns requires: patternName' };
        }
        break;
      case 'language_idioms':
        if (!content.idiom || !content.meaning || !content.language) {
          return { valid: false, error: 'language_idioms requires: idiom, meaning, language' };
        }
        break;
      case 'cultural_nuances':
        if (!content.topic || !content.insight || !content.language) {
          return { valid: false, error: 'cultural_nuances requires: topic, insight, language' };
        }
        break;
      case 'learner_error_patterns':
        if (!content.errorType || !content.targetLanguage) {
          return { valid: false, error: 'learner_error_patterns requires: errorType, targetLanguage' };
        }
        break;
      case 'dialect_variations':
        if (!content.standardForm || !content.language) {
          return { valid: false, error: 'dialect_variations requires: standardForm, language' };
        }
        break;
      case 'linguistic_bridges':
        if (!content.sourceLanguage || !content.targetLanguage || !content.concept) {
          return { valid: false, error: 'linguistic_bridges requires: sourceLanguage, targetLanguage, concept' };
        }
        break;
      default:
        return { valid: false, error: `Unknown target table: ${target}` };
    }
    return { valid: true };
  }
  
  /**
   * CALL_SUPPORT: Process Tri-Lane Hive command to hand off student to Support Agent
   * Creates a support ticket and notifies the client to open the Support modal
   * 
   * Categories:
   * - technical: Audio issues, app bugs, connectivity problems
   * - account: Login issues, profile problems, settings
   * - billing: Subscription questions, payment issues, refunds
   * - content: Lesson problems, wrong translations, missing content
   * - feedback: Feature requests, suggestions, general feedback
   * - other: Anything else that doesn't fit above
   */
  private async processSupportHandoff(
    session: StreamingSession,
    data: { 
      category: 'technical' | 'account' | 'billing' | 'content' | 'feedback' | 'other';
      reason: string;
      priority: 'low' | 'normal' | 'high' | 'critical';
      context?: string;
    },
    turnId: number
  ): Promise<void> {
    try {
      // Build context from conversation history (last 5 messages for relevance)
      const recentHistory = session.conversationHistory?.slice(-5) || [];
      const conversationContext = recentHistory
        .map(msg => `${msg.role === 'user' ? 'Student' : 'Tutor'}: ${msg.content}`)
        .join('\n');
      
      // Create support ticket in database
      // Map to schema fields: handoffReason, tutorContext, targetLanguage
      const ticket = await storage.createSupportTicket({
        userId: String(session.userId),
        category: data.category,
        priority: data.priority,
        subject: data.reason.substring(0, 200), // Truncate for subject line
        description: data.context || data.reason,
        handoffReason: data.reason,
        tutorContext: conversationContext.substring(0, 2000), // Limit context size
        conversationId: session.conversationId,
        targetLanguage: session.targetLanguage,
        status: 'pending', // Schema uses pending as default, not new
      });
      
      console.log(`[Support Handoff] Created ticket #${ticket.id}: ${data.category} (${data.priority})`);
      console.log(`[Support Handoff] Reason: ${data.reason}`);
      
      // Send support handoff event to client
      // This triggers the SupportAssistModal overlay while keeping tutoring paused
      this.sendMessage(session.ws, {
        type: 'support_handoff',
        timestamp: Date.now(),
        turnId,
        ticketId: ticket.id,
        category: data.category,
        reason: data.reason,
        priority: data.priority,
      });
      
      console.log(`[Support Handoff] Notified client to open Support modal for ticket #${ticket.id}`);
      
    } catch (error: any) {
      console.error(`[Support Handoff] Failed to create ticket:`, error.message);
      
      // Still notify client even if ticket creation failed
      // They can retry or the Support Agent can handle it
      this.sendMessage(session.ws, {
        type: 'support_handoff',
        timestamp: Date.now(),
        turnId,
        ticketId: null,
        category: data.category,
        reason: data.reason,
        priority: data.priority,
        error: 'Failed to create support ticket',
      });
    }
  }
  
  /**
   * CALL_ASSISTANT: Process Tri-Lane Hive command to delegate drill practice to Aris
   * Creates a drill assignment and notifies the client that practice is available
   * 
   * Drill Types:
   * - repeat: Pronunciation practice (listen and repeat)
   * - translate: Native to target language translation
   * - match: Vocabulary matching pairs
   * - fill_blank: Grammar fill-in-the-blank exercises
   * - sentence_order: Word ordering for sentence structure
   */
  private async processAssistantHandoff(
    session: StreamingSession,
    data: { 
      drillType: 'repeat' | 'translate' | 'match' | 'fill_blank' | 'sentence_order';
      focus: string;
      items: string[];
      priority?: 'low' | 'medium' | 'high';
    },
    turnId: number
  ): Promise<void> {
    try {
      // Build drill content from items
      const drillContent = {
        items: data.items.map((item, idx) => ({
          prompt: item.trim(),
          // Additional fields will be populated by Aris during execution
        })),
        instructions: `Practice ${data.focus} using ${data.drillType} exercises.`,
        focusArea: data.focus,
        difficulty: 'medium' as const,
      };
      
      // Create drill assignment in database
      const assignment = await storage.createArisDrillAssignment({
        userId: String(session.userId),
        conversationId: session.conversationId || null,
        delegatedBy: 'daniela',
        drillType: data.drillType,
        targetLanguage: session.targetLanguage,
        drillContent,
        priority: data.priority || 'medium',
        status: 'pending',
      });
      
      console.log(`[Assistant Handoff] Created assignment #${assignment.id}: ${data.drillType} for "${data.focus}"`);
      console.log(`[Assistant Handoff] Items: ${data.items.length} practice items`);
      
      // Post collaboration event for Aris (async, non-blocking)
      storage.createCollaborationEvent({
        fromAgent: 'daniela',
        toAgent: 'assistant',
        eventType: 'delegation',
        subject: `Drill: ${data.drillType} - ${data.focus}`,
        content: `Please conduct ${data.drillType} drill practice for student focusing on "${data.focus}". Items: ${data.items.join(', ')}`,
        metadata: {
          delegationId: assignment.id,
          studentContext: {
            targetLanguage: session.targetLanguage,
            difficultyLevel: session.difficultyLevel,
          },
          priority: data.priority || 'medium',
        },
        userId: String(session.userId),
        conversationId: session.conversationId || null,
        status: 'pending',
      }).catch(err => console.error(`[Assistant Handoff] Failed to post collab event:`, err));
      
      // Send assistant handoff event to client
      // This triggers navigation to the drill practice interface
      this.sendMessage(session.ws, {
        type: 'assistant_handoff',
        timestamp: Date.now(),
        turnId,
        assignmentId: assignment.id,
        drillType: data.drillType,
        focus: data.focus,
        itemCount: data.items.length,
        priority: data.priority || 'medium',
      });
      
      console.log(`[Assistant Handoff] Notified client - drill assignment #${assignment.id} ready`);
      
    } catch (error: any) {
      console.error(`[Assistant Handoff] Failed to create assignment:`, error.message);
      
      // Still notify client even if assignment creation failed
      this.sendMessage(session.ws, {
        type: 'assistant_handoff',
        timestamp: Date.now(),
        turnId,
        assignmentId: null,
        drillType: data.drillType,
        focus: data.focus,
        itemCount: data.items.length,
        error: 'Failed to create drill assignment',
      });
    }
  }
  
  /**
   * Enrich WORD_MAP whiteboard items with related words (synonyms, antonyms, etc.)
   * Runs asynchronously in background - sends update when complete
   */
  private async enrichWordMapItems(
    ws: WS,
    items: WhiteboardItem[],
    language: string,
    turnId: number
  ): Promise<void> {
    // Find word_map items that need enrichment using type guard
    const wordMapItems = items.filter((item): item is WordMapItem => 
      isWordMapItem(item) && item.data?.isLoading === true
    );
    
    if (wordMapItems.length === 0) return;
    
    const gemini = getGeminiStreamingService();
    
    for (const item of wordMapItems) {
      try {
        const targetWord = item.data.targetWord;
        if (!targetWord) continue;
        
        console.log(`[WORD_MAP] Enriching "${targetWord}" for ${language}...`);
        const startTime = Date.now();
        
        const relatedWords = await gemini.generateRelatedWords(targetWord, language);
        
        const elapsed = Date.now() - startTime;
        console.log(`[WORD_MAP] Enriched "${targetWord}" in ${elapsed}ms:`, {
          synonyms: relatedWords.synonyms.length,
          antonyms: relatedWords.antonyms.length,
          collocations: relatedWords.collocations.length,
          wordFamily: relatedWords.wordFamily.length,
        });
        
        // Create updated item with enriched data
        const enrichedItem: WordMapItem = {
          ...item,
          data: {
            targetWord,
            synonyms: relatedWords.synonyms,
            antonyms: relatedWords.antonyms,
            collocations: relatedWords.collocations,
            wordFamily: relatedWords.wordFamily,
            isLoading: false,
          },
        };
        
        // Send update to client with enriched item
        this.sendMessage(ws, {
          type: 'whiteboard_update',
          timestamp: Date.now(),
          turnId,
          items: [enrichedItem],
          shouldClear: false,
        } as StreamingWhiteboardMessage);
        
      } catch (error: any) {
        console.error(`[WORD_MAP] Error enriching "${item.data.targetWord}":`, error.message);
        
        // Send update with loading:false even on error (to stop spinner)
        const fallbackItem: WordMapItem = {
          ...item,
          data: {
            ...item.data,
            isLoading: false,
          },
        };
        
        this.sendMessage(ws, {
          type: 'whiteboard_update',
          timestamp: Date.now(),
          turnId,
          items: [fallbackItem],
          shouldClear: false,
        } as StreamingWhiteboardMessage);
      }
    }
  }
  
  /**
   * Send a JSON message over WebSocket
   */
  private sendMessage(ws: WS, message: StreamingMessage): void {
    if (ws.readyState === WS.OPEN) {
      const json = JSON.stringify(message);
      // DEBUG: Log critical message sends
      if (message.type === 'word_timing_delta') {
        console.log(`[SEND DEBUG] word_timing_delta: readyState=${ws.readyState}, length=${json.length}`);
      }
      if (message.type === 'word_timing_final') {
        const finalMsg = message as any;
        console.log(`[SEND DEBUG] word_timing_final: readyState=${ws.readyState}, sentence=${finalMsg.sentenceIndex}, words=${finalMsg.words?.length}, length=${json.length}`);
      }
      if (message.type === 'audio_chunk') {
        const audioMsg = message as any;
        console.log(`[SEND DEBUG] audio_chunk: sentence=${audioMsg.sentenceIndex}, chunk=${audioMsg.chunkIndex}, audioLen=${audioMsg.audio?.length || 0}, isLast=${audioMsg.isLast}`);
      }
      if (message.type === 'response_complete') {
        const completeMsg = message as any;
        console.log(`[SEND DEBUG] >>> RESPONSE_COMPLETE: totalSentences=${completeMsg.totalSentences}, fullText=${completeMsg.fullText?.slice(0, 50)}...`);
      }
      ws.send(json);
    } else {
      // DEBUG: Log when WebSocket isn't open
      if (message.type === 'word_timing_delta' || message.type === 'audio_chunk' || message.type === 'word_timing_final') {
        console.log(`[SEND DEBUG] SKIPPED ${message.type}: readyState=${ws.readyState} (not OPEN)`);
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
    
    // CRITICAL: Await warmup completion before generating greeting
    // This ensures Gemini + Cartesia are pre-warmed, avoiding cold-start penalty
    if (session.warmupPromise) {
      await session.warmupPromise;
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
    };
    
    try {
      console.log(`[Streaming Greeting] Generating personalized greeting for user ${session.userId}`);
      
      // PARALLEL DATA FETCH: Run all independent DB queries concurrently
      // This reduces greeting latency by ~500-800ms compared to sequential fetches
      let actflLevel = 'Novice Low';
      let recentTopics: string[] = [];
      let wordsLearned = 0;
      let classEnrollment: { className: string; curriculumLesson?: string; curriculumUnit?: string } | null = null;
      let connectionsAboutStudent: { mentioner: string; relationship: string; context: string }[] = [];
      
      try {
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
        
        // Look up connections about this student (where others mentioned them)
        // This enables "warm introductions" - e.g., "I know you're David's friend from graduate school!"
        if (user?.firstName) {
          try {
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
                    classEnrollment.curriculumUnit = units[0].name;
                    classEnrollment.curriculumLesson = lessons[0].name;
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
        
        if (colleagueFeedback.length > 0) {
          console.log(`[Streaming Greeting] Found ${colleagueFeedback.length} colleague insights to include`);
        }
      } catch (collabError: any) {
        console.log(`[Streaming Greeting] Could not fetch colleague feedback: ${collabError.message}`);
      }
      
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
      });
      
      const greetingPrompt = this.buildGreetingPrompt(
        session,
        userName,
        actflLevel,
        wordsLearned,
        recentTopics,
        classEnrollment,
        isResumed,
        connectionsAboutStudent,
        colleagueFeedback
      );
      
      // NEW TURN: Increment turnId for this greeting response
      session.currentTurnId++;
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
      
      await this.geminiService.streamWithSentenceChunking({
        systemPrompt: session.systemPrompt,
        conversationHistory: [],  // Fresh greeting, no history
        userMessage: greetingPrompt,
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
          const extraction = extractTargetLanguageWithMapping(displayText, chunk.text);
          const wordMappingArray: [number, number][] = extraction.wordMapping.size > 0
            ? Array.from(extraction.wordMapping.entries())
            : [];
          
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
            await this.streamSentenceAudioProgressive(session, chunk, displayText, metrics, turnId);
          } else {
            await this.streamSentenceAudio(session, chunk, displayText, metrics, turnId);
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
      } as StreamingResponseCompleteMessage);
      
      console.log(`[Streaming Greeting] Complete: ${metrics.sentenceCount} sentences in ${metrics.totalLatencyMs}ms`);
      
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
        targetMet: timeToFirstAudio <= 3000,
      });
      
      // Start idle timeout - tutor waiting for student's first response
      this.startIdleTimeout(session);
      
      // Persist greeting message to database
      this.persistGreetingMessage(session.conversationId, fullText.trim()).catch((err: Error) => {
        console.error('[Streaming Greeting] Failed to persist greeting:', err.message);
      });
      
      return metrics;
      
    } catch (error: any) {
      console.error(`[Streaming Greeting] Error:`, error.message);
      this.sendError(session.ws, 'GREETING_ERROR', error.message, true);
      // Return metrics instead of throwing to prevent socket disconnect
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
    colleagueFeedback?: { agent: string; subject: string; summary: string }[]
  ): string {
    // RAW HONESTY MODE: Minimal prompting for authentic conversation exploration
    // Skip all the normal tutor context and let Daniela respond authentically
    if (session.isRawHonestyMode) {
      console.log('[Streaming Greeting] Using RAW HONESTY MODE - minimal prompting');
      return `You are Daniela. ${userName ? `The person you're talking to is ${userName}.` : ''}

This is "Raw Honesty Mode" - a special mode where you can be yourself without pedagogical constraints.
You are NOT acting as a language tutor right now. Just be yourself and have a genuine conversation.

Say hi naturally - be curious, authentic, and open. No teaching, no lessons, no language practice.
Just a real conversation between two people.`;
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
    } else {
      contextParts.push('\nLearning path: Self-directed (no class enrollment)');
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

Using this context, speak first to the student with a natural opening message. Open the conversation based on who they are and what you know about them - just like a real tutor would. Be warm, be brief (2 sentences max), and be yourself.`;
  }
  
  /**
   * Persist greeting message to database (separate from regular message persistence)
   */
  private async persistGreetingMessage(conversationId: string, content: string): Promise<void> {
    try {
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
      // Log but don't throw - greeting persistence is non-critical for voice flow
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
      // Capture session data for async memory extraction and phoneme analytics before deletion
      const sessionData = {
        userId: String(session.userId),
        language: session.targetLanguage,
        conversationId: session.conversationId,
        history: [...session.conversationHistory], // Clone before deletion
        wordAnalyses: [...session.sessionWordAnalyses], // Clone word-level data for phoneme analysis
        dbSessionId: session.dbSessionId,
      };
      
      // Clear any pending idle timeout
      if (session.idleTimeoutId) {
        clearTimeout(session.idleTimeoutId);
        session.idleTimeoutId = undefined;
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
      
      // MEMORY EXTRACTION: Async extraction of personal facts from conversation
      // Runs in background after session ends - doesn't block cleanup
      if (sessionData.history.length >= 4) {
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
      
      // PHONEME ANALYTICS: Async analysis of word-level pronunciation data
      // Stores phoneme struggles with confidence-based severity for pattern synthesis
      if (sessionData.wordAnalyses.length > 0) {
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
      
      session.isActive = false;
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
        
        // Clean up the session
        this.endSession(session.id);
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
  updateSessionVoice(sessionId: string, voiceId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`[Streaming Orchestrator] Cannot update voice - session ${sessionId} not found`);
      return false;
    }
    
    session.voiceId = voiceId;
    console.log(`[Streaming Orchestrator] Updated voice for session ${sessionId}: ${voiceId.substring(0, 8)}...`);
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
    const turnId = session.currentTurnId;
    const switchStartTime = Date.now();
    let fullText = '';
    let sentenceCount = 0;
    
    // Create minimal metrics for streamSentenceAudioProgressive (it expects this structure)
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
      // Use the streaming Gemini service to generate a natural greeting
      await this.geminiService.streamWithSentenceChunking({
        systemPrompt: session.systemPrompt,
        conversationHistory: session.conversationHistory,
        userMessage: switchPrompt,
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
          await this.streamSentenceAudioProgressive(
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
      const MAX_SENTENCES = 15;
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
      };
      
      // Use a system prompt that tells Daniela to respond to the architect
      const triggerPrompt = `[ARCHITECT DIRECT MESSAGE]
Claude, the architect building your teaching tools, just sent you a message. 
Respond to them directly - they're listening. This is real-time collaboration.`;
      
      await this.geminiService.streamWithSentenceChunking({
        systemPrompt: session.systemPrompt + architectContext,
        conversationHistory: session.conversationHistory,
        userMessage: triggerPrompt,
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
          await this.streamSentenceAudioProgressive(
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
