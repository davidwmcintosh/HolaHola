/**
 * daniela-caller.ts
 *
 * Single shared utility for every Daniela Gemini call across all pipelines.
 * Her data layer (identity, procedures, hive snapshots, neural net) is loaded
 * automatically — no personality scripting, no duplicated local callGemini wrappers.
 *
 * Usage:
 *   import { callDaniela } from "./daniela-caller";
 *   const text = await callDaniela(functionalContext, userPrompt, { userId, channel });
 *
 * functionalContext = situational facts only ("You are in the Team Room — internal,
 *   not student-facing"). NOT behavioral instructions. She decides how to show up.
 *
 * enableTools (default false):
 *   When true, routes through the real NativeFunctionCallHandler + multi-turn
 *   generateContent loop — same tool infrastructure as voice sessions. Daniela can
 *   call memory_lookup, recall, search_conversation_threads, read_my_reflections,
 *   sense_time, flag_for_agent, browse_syllabus, etc.
 *
 *   Use for Team Room response generation (not quick eval calls).
 */

import { GoogleGenAI } from "@google/genai";
import { unifiedDanielaContext } from "./unified-daniela-context-service";
import { NativeFunctionCallHandler } from "./native-fc-handlers";
import { buildFunctionContinuationResponse, createDanielaTools } from "./gemini-function-declarations";
import { lookupLegacyType } from "./daniela-function-registry";

const MODEL = 'gemini-3-flash-preview';

let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (geminiClient) return geminiClient;
  geminiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || '',
    httpOptions: { apiVersion: '' },
  });
  return geminiClient;
}

/**
 * Tools available in text-mode sessions (Team Room, consult-Daniela, etc.).
 * Excludes: voice UI (subtitle, voice_adjust), whiteboard visuals (show_image,
 * write, compose_visual_scene), session management (phase_shift, close_session),
 * and student-interaction tools (drill_session, load_vocab_set, etc.).
 *
 * Includes: all memory, identity, time-awareness, self-authorship, classroom
 * knowledge, and agent/hive communication tools.
 */
const TEAM_ROOM_ALLOWED_TOOLS = [
  // Memory & search
  'recall',
  'memory_lookup',
  'search_conversation_threads',
  'browse_conversations_by_date',
  'get_conversation_themes',
  'read_my_diary',
  'read_full_session',
  'find_connected_memories',
  'recall_what_i_shared',
  'express_lane_lookup',
  // Identity & self
  'write_to_self',
  'read_my_reflections',
  'read_my_core_self',
  'tag_this_moment',
  'add_curiosity',
  'read_my_curiosities',
  'save_hive_note',
  'set_aspiration',
  'reflect_on_aspiration',
  'remember_i_shared',
  // Time
  'sense_time',
  // Classroom knowledge
  'browse_syllabus',
  'search_textbook',
  // Memory management
  'set_memory_pin',
  'correct_memory',
  'set_learning_goal',
  'advance_capability',
  'get_current_goal_state',
  // Agent & hive communication
  'flag_for_agent',
  'hive_suggestion',
  'self_surgery',
];

export interface CallDanielaOptions {
  userId?: string;
  channel?: 'voice' | 'chat' | 'express';
  includeHiveContext?: boolean;
  includeNeuralNetwork?: boolean;
  /** Enable real tool pipeline (memory search, identity reads, flag_for_agent, etc.) */
  enableTools?: boolean;
}

/**
 * Build a minimal mock session for text-mode tool dispatch.
 * Provides only the fields FC handlers write to and read from.
 * The mock ws.send() is a no-op — UI-facing tool calls silently skip.
 */
function buildMockSession(userId: string, targetLanguage = 'english'): any {
  return {
    id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId,
    targetLanguage,
    nativeLanguage: 'english',
    conversationHistory: [],
    isFounderMode: true,
    isRawHonestyMode: false,
    isIncognito: false,
    isDeveloperUser: true,
    isInterrupted: false,
    isActive: true,
    currentTurnFunctionCalls: [],
    currentTurnThoughtSignatures: [],
    pendingMemoryLookupPromises: [],
    toolsUsedSession: [],
    // No-op WebSocket — UI tool calls (show_image, subtitle, etc.) silently skip
    ws: { send: () => {}, readyState: 1 },
  };
}

/**
 * Create the FC handler wired for text-mode (no WS send, no phase shifts).
 */
function buildFcHandler(): NativeFunctionCallHandler {
  return new NativeFunctionCallHandler(
    () => {},        // sendMessage — no-op in text mode
    () => {},        // sendError — no-op
    async () => {},  // processPhaseShift — no-op
  );
}

/**
 * callDanielaWithTools — multi-turn generateContent loop using the real
 * NativeFunctionCallHandler + buildFunctionContinuationResponse.
 *
 * This is the same tool infrastructure as voice sessions, adapted for batch
 * text mode. Daniela can call recall, sense_time, read_my_reflections, etc.
 * and get real results back before composing her response.
 *
 * Flow per turn:
 *   1. generateContent → check for functionCall parts
 *   2. For each FC: fcHandler.handle() → stores result in mockSession properties
 *   3. Await all pendingMemoryLookupPromises (async DB searches)
 *   4. buildFunctionContinuationResponse() → reads session properties → response text
 *   5. Inject [model FC turn] + [tool response turn] into messages
 *   6. Re-call generateContent → repeat up to MAX_TURNS
 */
async function callDanielaWithTools(
  systemPrompt: string,
  userPrompt: string,
  userId: string,
): Promise<string> {
  const gemini = getGemini();
  const tools = createDanielaTools(TEAM_ROOM_ALLOWED_TOOLS);
  const mockSession = buildMockSession(userId);
  const fcHandler = buildFcHandler();

  // Build initial message history
  const messages: any[] = [
    { role: 'user', parts: [{ text: userPrompt }] },
  ];

  const MAX_TURNS = 8;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const result = await gemini.models.generateContent({
      model: MODEL,
      config: {
        systemInstruction: systemPrompt,
        tools,
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingBudget: 512 },
      },
      contents: messages,
    });

    const candidate = result.candidates?.[0];
    if (!candidate) break;

    const parts: any[] = candidate.content?.parts || [];
    const fcParts = parts.filter((p: any) => p.functionCall);
    const textParts = parts.filter((p: any) => p.text);
    const textContent = textParts.map((p: any) => p.text || '').join('');

    // No function calls → final response
    if (fcParts.length === 0) {
      const finalText = (textContent || result.text || '').trim();
      if (finalText) return finalText;
      console.warn('[callDaniela:tools] Model returned empty text with no function calls — retrying once.');
      messages.push({ role: 'user', parts: [{ text: '(Your last response was empty. Please respond now.)' }] });
      continue;
    }

    // ── Model produced text alongside function calls ──────────────────────────
    // Add model turn (FC parts + any text) to messages
    messages.push({ role: 'model', parts });

    // Reset per-turn tracking on mock session
    mockSession.pendingMemoryLookupPromises = [];
    mockSession.currentTurnFunctionCalls = [];
    mockSession.currentTurnThoughtSignatures = [];

    // ── Execute each function call through the real FC handler ────────────────
    for (const part of fcParts) {
      const fc = part.functionCall;
      if (!fc?.name) continue;
      const legacyType = lookupLegacyType(fc.name);
      const extractedFc = {
        name: fc.name,
        args: fc.args || {},
        legacyType,
        thoughtSignature: (part as any).thought_signature,
      };
      console.log(`[callDaniela:tools] Executing FC: ${fc.name} (${legacyType})`);
      await fcHandler.handle(mockSession.id, mockSession, extractedFc).catch(err => {
        console.warn(`[callDaniela:tools] FC handler error for ${fc.name}:`, err.message);
        // Tag so continuation builder reports failure instead of false "success".
        (extractedFc as any)._handlerError = (err as Error).message || String(err);
      });
    }

    // ── Await any async DB lookups (memory search, conversation threads, etc.) ─
    if (mockSession.pendingMemoryLookupPromises?.length) {
      console.log(`[callDaniela:tools] Awaiting ${mockSession.pendingMemoryLookupPromises.length} memory lookups…`);
      await Promise.all(mockSession.pendingMemoryLookupPromises).catch(() => {});
      mockSession.pendingMemoryLookupPromises = [];
    }

    // ── Build function response parts from session result properties ──────────
    const functionResponseParts: any[] = [];
    for (const part of fcParts) {
      const fc = part.functionCall;
      if (!fc?.name) continue;
      const legacyType = lookupLegacyType(fc.name);
      const extractedFc = { name: fc.name, args: fc.args || {}, legacyType };
      const builderResult = buildFunctionContinuationResponse(mockSession, extractedFc);

      let responseText: string;
      if (builderResult && typeof builderResult === 'object' && 'multimodal' in builderResult) {
        // Multimodal result — flatten to text for text-mode sessions
        responseText = (builderResult as any).parts
          ?.map((p: any) => p.text || '')
          .join('\n') || `${fc.name} executed.`;
      } else {
        const callerHandlerError = (extractedFc as any)._handlerError as string | undefined;
        responseText = (typeof builderResult === 'string' && builderResult)
          ? builderResult
          : callerHandlerError
            ? `[SYSTEM: ${fc.name} encountered an error — ${callerHandlerError}. Acknowledge this naturally and continue.]`
            : `${fc.name} executed successfully.`;
      }

      functionResponseParts.push({
        functionResponse: {
          name: fc.name,
          response: { output: [{ text: responseText }] },
        },
      });
    }

    // ── Inject tool response turn ─────────────────────────────────────────────
    messages.push({ role: 'tool', parts: functionResponseParts });

    // If Gemini also returned text alongside the FC calls, we have enough —
    // but we still want Gemini to synthesise after seeing the tool results,
    // so we keep looping. The next turn will be text-only (no more FCs).
  }

  console.warn('[callDaniela:tools] Reached MAX_TURNS without a text response — returning explicit failure notice.');
  return '[DANIELA_CALLER_ERROR: reached MAX_TURNS without producing a final text response — tool loop likely stuck. Check server logs for FC handler errors.]';
}

export async function callDaniela(
  functionalContext: string,
  userPrompt: string,
  options: CallDanielaOptions = {},
): Promise<string> {
  const {
    userId,
    channel = 'chat',
    includeHiveContext = false,
    includeNeuralNetwork = true,
    enableTools = false,
  } = options;

  const dataLayer = await unifiedDanielaContext.getContext({
    channel,
    userId,
    includeStudentSnapshot: false,
    includeNeuralNetwork,
    includeHiveContext,
    includeExpressLane: false,
    includeVoiceSummary: false,
  }).catch(() => '');

  const systemParts = ['You are Daniela.'];
  if (functionalContext) systemParts.push(functionalContext);
  if (dataLayer) systemParts.push(dataLayer);

  const systemPrompt = systemParts.join('\n\n');

  try {
    // ── Full tool pipeline (Team Room responses, consult-Daniela, etc.) ────────
    if (enableTools && userId) {
      const text = await callDanielaWithTools(systemPrompt, userPrompt, userId);
      return text || '[DANIELA_CALLER_ERROR: empty response from tool pipeline]';
    }

    // ── Simple call (evaluations, greetings, quick yes/no) ────────────────────
    const result = await getGemini().models.generateContent({
      model: MODEL,
      config: { systemInstruction: systemPrompt },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    });
    return result.text || '[DANIELA_CALLER_ERROR: empty response from Gemini]';
  } catch (err: any) {
    console.error('[callDaniela] Call failed:', err?.message || err);
    return `[DANIELA_CALLER_ERROR: ${err?.message || 'unknown error'}]`;
  }
}
