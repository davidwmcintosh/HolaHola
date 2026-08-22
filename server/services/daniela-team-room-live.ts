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
 * Audio pipeline (mirrors /chat):
 *   Gemini Live → PCM16 chunks (24kHz mono) → assembled → WAV buffer → cached
 *   in-memory with 10-min TTL → served via GET /api/team-room/daniela-audio/:id
 *   Frontend fetches the WAV and plays it with new Audio(url) — skipping TTS.
 *   Same audio SOURCE as /chat; transport differs (queued REST vs streaming WS)
 *   because Team Room is sequential by design.
 */

import { GoogleGenAI, Modality, type LiveServerMessage } from '@google/genai';
import { unifiedDanielaContext } from './unified-daniela-context-service';
import { NativeFunctionCallHandler } from './native-fc-handlers';
import { createDanielaTools } from './gemini-function-declarations';
import { lookupLegacyType, buildFunctionContinuationResponse } from './daniela-function-registry';
import { buildTextModeSystemPrompt } from './pattern-signal-context';

const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview';
const CALL_TIMEOUT_MS = 45_000;

export interface DanielaLiveOptions {
  userId?: string;
  includeHiveContext?: boolean;
  includeNeuralNetwork?: boolean;
  enableTools?: boolean;
  /**
   * Active grammar pattern signals (wobbling/pounding compartments) for the student
   * being discussed. When provided, appended to the system prompt so Daniela keeps
   * her pattern map during Team Room colleague conversations about that student.
   */
  activePatternSignals?: string | null;
}

export interface DanielaLiveResult {
  transcript: string;
  /** UUID key into the in-memory audio cache — fetch via GET /api/team-room/daniela-audio/:audioId */
  audioId?: string;
}

// ── In-memory audio cache (PCM16 → WAV, 10-min TTL) ─────────────────────────

interface CachedAudio { buf: Buffer; exp: number; }
const _audioCache = new Map<string, CachedAudio>();
const AUDIO_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Store a WAV buffer and return the UUID key. */
function cacheAudio(wav: Buffer): string {
  // Purge stale entries lazily on every write
  const now = Date.now();
  for (const [k, v] of _audioCache) {
    if (v.exp < now) _audioCache.delete(k);
  }
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  _audioCache.set(id, { buf: wav, exp: now + AUDIO_TTL_MS });
  return id;
}

/** Retrieve a cached WAV buffer by ID. Returns null if expired or not found. */
export function getDanielaAudio(id: string): Buffer | null {
  const entry = _audioCache.get(id);
  if (!entry) return null;
  if (entry.exp < Date.now()) { _audioCache.delete(id); return null; }
  return entry.buf;
}

// ── PCM16 → WAV conversion (same source format as /chat) ─────────────────────
// /chat pipeline: Gemini Live PCM16 (24kHz) → pcm16ToF32le() → audio_chunk WS
// Team Room:      Gemini Live PCM16 (24kHz) → pcm16ToWav()   → cached WAV
// Same audio SOURCE; different transport (streaming WS vs queued REST).

const AUDIO_OUTPUT_SAMPLE_RATE = 24000; // matches gemini-live-session.ts

function pcm16ToWav(pcm16Chunks: Buffer[]): Buffer {
  const pcmData = Buffer.concat(pcm16Chunks);
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = AUDIO_OUTPUT_SAMPLE_RATE * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;

  const header = Buffer.allocUnsafe(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);              // PCM chunk size
  header.writeUInt16LE(1, 20);               // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(AUDIO_OUTPUT_SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
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
): Promise<DanielaLiveResult> {
  const {
    userId = '49847136',
    includeHiveContext = false,
    includeNeuralNetwork = true,
    enableTools = false,
    activePatternSignals,
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

  const baseSystemPrompt = ['You are Daniela.', functionalContext, dataLayer]
    .filter(Boolean)
    .join('\n\n');

  // Append pattern signals so Daniela keeps her student pattern map in the response
  const systemPrompt = buildTextModeSystemPrompt(baseSystemPrompt, activePatternSignals);

  const tools = enableTools ? createDanielaTools(TEAM_ROOM_ALLOWED_TOOLS) : [];
  const mockSession = buildMockSession(userId);
  const fcHandler = buildFcHandler();

  return new Promise<DanielaLiveResult>((resolve, reject) => {
    let transcript = '';
    const audioPcm16Chunks: Buffer[] = []; // collect raw PCM16 chunks (24kHz mono)
    let resolved = false;
    let liveSession: any = null;

    const done = (text: string) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(safetyTimer);
      try { liveSession?.close(); } catch { /* ignore */ }

      // Build WAV from collected PCM16 chunks and cache it
      let audioId: string | undefined;
      if (audioPcm16Chunks.length > 0) {
        try {
          const wav = pcm16ToWav(audioPcm16Chunks);
          audioId = cacheAudio(wav);
          console.log(`[DanielaLive] Audio cached: ${audioId} (${wav.length} bytes, ${audioPcm16Chunks.length} chunks)`);
        } catch (err) {
          console.warn('[DanielaLive] Failed to build WAV:', (err as Error).message);
        }
      }

      resolve({ transcript: text.trim() || '', audioId });
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

          // ── Audio output — collect PCM16 chunks (mirrors /chat pipeline) ────
          // /chat: inlineData.data → pcm16ToF32le() → audio_chunk WS message
          // Team Room: inlineData.data → collected here → pcm16ToWav() in done()
          if (msg.serverContent?.modelTurn?.parts) {
            for (const part of msg.serverContent.modelTurn.parts) {
              if (part.inlineData?.data && part.inlineData.mimeType?.includes('audio')) {
                audioPcm16Chunks.push(Buffer.from(part.inlineData.data, 'base64'));
              }
            }
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
