/**
 * daniela-team-room-live.ts
 *
 * Gemini Live replacement for callDaniela in the Team Room response path.
 *
 * Opens a fresh gemini-3.1-flash-live-preview Live session per call, sends the
 * prompt as a text turn, collects outputAudioTranscription as the text response,
 * handles tool calls through the real NativeFunctionCallHandler, and resolves
 * when generationComplete fires.
 *
 * Why Live instead of REST?
 *   - Same model as /chat (gemini-3.1-flash-live-preview via GEMINI_LIVE_MODEL)
 *   - Same tool infrastructure as voice sessions
 *   - Thinking mode built-in (same reasoning depth)
 *
 * Why transcript instead of TEXT modality?
 *   gemini-3.1-flash-live-preview does NOT support TEXT as a responseModality
 *   (causes 1011 "Internal error"). AUDIO + outputAudioTranscription is the only
 *   way to get text back from the Live model.
 *
 * Audio PCM16 is received and silently discarded — Team Room is text-based.
 */

import { GoogleGenAI, Modality, type LiveServerMessage } from '@google/genai';
import { unifiedDanielaContext } from './unified-daniela-context-service';
import { NativeFunctionCallHandler } from './native-fc-handlers';
import { createDanielaTools } from './gemini-function-declarations';
import { lookupLegacyType, buildFunctionContinuationResponse } from './daniela-function-registry';

const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview';
const CALL_TIMEOUT_MS = 45_000;

export interface DanielaLiveOptions {
  userId?: string;
  includeHiveContext?: boolean;
  includeNeuralNetwork?: boolean;
  enableTools?: boolean;
}

// ── Same tool allow-list as daniela-caller.ts ──────────────────────────────
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

function buildMockSession(userId: string): any {
  return {
    id: `tr_live_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId,
    targetLanguage: 'english',
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
    pendingWhiteboardUpdates: [],
    firstAudioSent: false,
    ws: { send: () => {}, readyState: 1 },
  };
}

function buildFcHandler(): NativeFunctionCallHandler {
  return new NativeFunctionCallHandler(
    () => {},
    () => {},
    async () => {},
  );
}

/**
 * Call Daniela using the Gemini Live model (gemini-3.1-flash-live-preview).
 *
 * Drop-in replacement for callDaniela in the Team Room response-generation path.
 * The eval (hand-raise JSON check) stays on REST — no overhead for a quick decision.
 */
export async function callDanielaLive(
  functionalContext: string,
  userPrompt: string,
  options: DanielaLiveOptions = {},
): Promise<string> {
  const {
    userId = '49847136',
    includeHiveContext = false,
    includeNeuralNetwork = true,
    enableTools = false,
  } = options;

  // Build Daniela's full data-layer context (same path as callDaniela)
  const dataLayer = await unifiedDanielaContext.getContext({
    channel: 'chat',
    userId,
    includeStudentSnapshot: false,
    includeNeuralNetwork,
    includeHiveContext,
    includeExpressLane: false,
    includeVoiceSummary: false,
  }).catch(() => '');

  const systemPrompt = ['You are Daniela.', functionalContext, dataLayer]
    .filter(Boolean)
    .join('\n\n');

  const tools = enableTools ? createDanielaTools(TEAM_ROOM_ALLOWED_TOOLS) : [];
  const mockSession = buildMockSession(userId);
  const fcHandler = buildFcHandler();

  return new Promise<string>((resolve, reject) => {
    let transcript = '';
    let resolved = false;
    let liveSession: any = null;

    const done = (text: string) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(safetyTimer);
      try { liveSession?.close(); } catch { /* ignore */ }
      resolve(text.trim() || '');
    };

    const safetyTimer = setTimeout(() => {
      console.warn(`[DanielaLive] Safety timeout after ${CALL_TIMEOUT_MS}ms — resolving with ${transcript.length} chars`);
      done(transcript);
    }, CALL_TIMEOUT_MS);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

    ai.live.connect({
      model: LIVE_MODEL,
      config: {
        systemInstruction: systemPrompt,
        tools: tools.length > 0 ? tools : undefined,
        // AUDIO only — gemini-3.1-flash-live-preview does not support TEXT as responseModality
        responseModalities: [Modality.AUDIO],
        // Capture Daniela's words as text
        outputAudioTranscription: {},
        // MEDIUM thinking: enough depth for Team Room discussion, lighter than voice sessions
        thinkingConfig: { thinkingLevel: 'MEDIUM' as any },
      },
      callbacks: {
        onmessage: async (msg: LiveServerMessage) => {
          // ── setupComplete — model is ready, send the text prompt ─────────
          if ((msg as any).setupComplete != null) {
            try {
              liveSession.sendClientContent({
                turns: [{ role: 'user', parts: [{ text: userPrompt }] }],
                turnComplete: true,
              });
              console.log(`[DanielaLive] Text turn sent (${userPrompt.length} chars)`);
            } catch (err) {
              console.error('[DanielaLive] Failed to send text turn:', err);
              done('');
            }
            return;
          }

          // ── outputTranscription — accumulate Daniela's response text ─────
          const outTranscript = (msg.serverContent as any)?.outputTranscription?.text;
          if (outTranscript) {
            const chunk = outTranscript as string;
            if (chunk.trim()) {
              // Mirror GeminiLiveSession: trim only the very first chunk so words
              // concatenate correctly without running together.
              transcript += transcript === '' ? chunk.trimStart() : chunk;
            }
          }

          // ── toolCall — dispatch through the real FC handler ───────────────
          if (msg.toolCall && liveSession) {
            mockSession.pendingMemoryLookupPromises = [];
            mockSession.currentTurnFunctionCalls = [];
            mockSession.currentTurnThoughtSignatures = [];

            const responses: Array<{ id: string; name: string; response: Record<string, unknown> }> = [];

            for (const fc of msg.toolCall.functionCalls ?? []) {
              const fcName = fc.name || '';
              const legacyType = lookupLegacyType(fcName);
              const extractedFc = {
                name: fcName,
                legacyType,
                args: (fc.args as Record<string, unknown>) || {},
              };

              let toolResponsePayload: Record<string, unknown> = { result: 'done' };

              try {
                await fcHandler.handle(mockSession.id, mockSession, extractedFc).catch(() => {});

                // Await any async DB lookups (memory search, etc.)
                if (mockSession.pendingMemoryLookupPromises?.length) {
                  await Promise.all(mockSession.pendingMemoryLookupPromises).catch(() => {});
                  mockSession.pendingMemoryLookupPromises = [];
                }

                const continuation = buildFunctionContinuationResponse(mockSession, extractedFc);
                if (continuation) {
                  if (typeof continuation === 'string') {
                    toolResponsePayload = { result: continuation };
                  } else if (typeof continuation === 'object' && (continuation as any).multimodal) {
                    // Flatten multimodal to text — Live tool responses can't carry inlineData
                    const parts: any[] = (continuation as any).parts || [];
                    const textOnly = parts.filter((p: any) => p.text).map((p: any) => p.text).join('\n');
                    toolResponsePayload = { result: textOnly || 'done' };
                  } else {
                    toolResponsePayload = { result: JSON.stringify(continuation) };
                  }
                }

                console.log(`[DanielaLive] Tool handled: ${fcName} → ${String(toolResponsePayload.result).slice(0, 60)}`);
              } catch (err) {
                const msg2 = (err as Error).message || String(err);
                console.warn(`[DanielaLive] Tool error (${fcName}): ${msg2}`);
                toolResponsePayload = { result: `Tool call failed: ${msg2}` };
              }

              responses.push({ id: fc.id || '', name: fcName, response: toolResponsePayload });
            }

            // Always send responses — GL stalls if we don't
            try {
              liveSession.sendToolResponse({ functionResponses: responses });
            } catch (err) {
              console.warn('[DanielaLive] sendToolResponse failed:', err);
            }
          }

          // ── generationComplete — Daniela is done ─────────────────────────
          if ((msg.serverContent as any)?.generationComplete) {
            console.log(`[DanielaLive] generationComplete — ${transcript.length} chars collected`);
            done(transcript);
          }
        },

        onerror: (err: any) => {
          console.error('[DanielaLive] Live session error:', err);
          if (!resolved) {
            clearTimeout(safetyTimer);
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        },

        onclose: () => {
          console.log('[DanielaLive] Live session closed');
          done(transcript);
        },
      },
    }).then((session: any) => {
      liveSession = session;
    }).catch((err: any) => {
      clearTimeout(safetyTimer);
      if (!resolved) reject(err);
    });
  });
}
