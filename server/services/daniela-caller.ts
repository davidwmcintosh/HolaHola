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
import { MEMORY_TOOL_NAMES, MEMORY_CHAIN_LIMIT, MEMORY_CHAIN_NUDGE_TEXT } from "./memory-chain-guard";
import { TOOL_CONTEXT_TEAM_ROOM } from "./daniela-tool-contexts";
import {
  detectFrictionlessSlide,
  recordSlideDetection,
  initSlideState,
  buildGroundingNudge,
  shouldAutoGround,
  runAutoGrounding,
} from "./frictionless-slide-detector";
import { buildTextModeSystemPrompt } from "./pattern-signal-context";

const MODEL = 'gemini-3-flash-preview';

let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (geminiClient) return geminiClient;
  geminiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || '',
  });
  return geminiClient;
}

// Tool allowlist sourced from the single canonical contexts file.
// To add/remove tools from any context, edit daniela-tool-contexts.ts.
const TEAM_ROOM_ALLOWED_TOOLS = TOOL_CONTEXT_TEAM_ROOM;

export interface CallDanielaOptions {
  userId?: string;
  channel?: 'voice' | 'chat' | 'express';
  includeHiveContext?: boolean;
  includeNeuralNetwork?: boolean;
  /** Enable real tool pipeline (memory search, identity reads, flag_for_agent, etc.) */
  enableTools?: boolean;
  /**
   * Active grammar pattern signals (wobbling/pounding compartments) for this student.
   * When provided, appended to the system prompt via formatActivePatternSignalNote so
   * Daniela keeps her pattern map when called from text-mode handlers.
   *
   * Text-mode callers that have a StreamingSession should pass session.activePatternSignals.
   * Callers without a session should obtain this by calling fetchPatternSignalContext(userId, language).
   */
  activePatternSignals?: string | null;
}

/**
 * Build a minimal mock session for text-mode tool dispatch.
 * Provides only the fields FC handlers write to and read from.
 * The mock ws.send() is a no-op — UI-facing tool calls silently skip.
 *
 * Exported so dialogue scripts can create ONE session and pass it to
 * runDanielaFCLoop via existingSession — preserving in-session state
 * (memory pins, capability flags) across multiple Agent→Daniela turns.
 */
export function buildMockSession(userId: string, targetLanguage = 'english'): any {
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

export interface RunDanielaFCLoopParams {
  systemPrompt: string;
  /** Mutable messages array — FC round-trips are appended in place. */
  messages: any[];
  userId: string;
  /** Tool allowlist — defaults to TOOL_CONTEXT_TEAM_ROOM. Pass TOOL_CONTEXT_FREE_DIALOGUE for scripts. */
  allowedTools?: string[];
  maxTurns?: number;
  maxOutputTokens?: number;
  /** Temperature — omit to use model default. */
  temperature?: number;
  /**
   * Pass a pre-built mockSession to preserve in-session state across multiple
   * runDanielaFCLoop calls in a dialogue script. Create once with buildMockSession(),
   * then pass the same object on every turn. If omitted, a fresh session is created
   * per call (safe for single-turn Team Room calls where cross-turn state isn't needed).
   */
  existingSession?: any;
  /**
   * Parallel-speech callback — fires when Daniela produces text in the same turn as
   * tool calls (search while speaking). chunk is the intermediate text; isFinal=true
   * on the last text-only synthesis turn just before the function returns.
   *
   * Callers that omit this get the current blocking behavior unchanged.
   * Callers that use it should NOT re-display the final return value — it is the
   * same text as the last isFinal:true chunk, returned for backward compatibility.
   */
  onText?: (chunk: string, meta: { turnIndex: number; isFinal: boolean }) => void;
  /**
   * Active grammar pattern signals (wobbling/pounding compartments) carried from
   * a voice session. When provided, injected into the system prompt in the same
   * pipe-joined format as buildActflPersonaAnchor — so Daniela keeps her active
   * pattern map when the student switches from voice to text mid-session.
   */
  activePatternSignals?: string | null;
  /**
   * FOR TESTING ONLY — inject a fake Gemini client so the FC loop can be exercised
   * without hitting the real API. Production callers must never pass this.
   * The object must implement { models: { generateContent(args): Promise<any> } }.
   */
  _geminiOverride?: { models: { generateContent(args: any): Promise<any> } };
}

/**
 * runDanielaFCLoop — exported core loop for all text-mode Daniela calls.
 *
 * Shared by Team Room (callDanielaWithTools), free dialogue scripts, and any
 * future pipeline that needs Daniela with real tool access. Single implementation
 * prevents drift between code paths.
 *
 * Flow per iteration:
 *   1. generateContent → check for functionCall parts
 *   2. For each FC: fcHandler.handle() → stores result in mockSession properties
 *   3. Await all pendingMemoryLookupPromises (async DB searches)
 *   4. buildFunctionContinuationResponse() → reads session properties → response text
 *   5. Inject [model FC turn] + [tool response turn] into messages
 *   6. Re-call generateContent → repeat up to maxTurns
 */
export async function runDanielaFCLoop({
  systemPrompt,
  messages,
  userId,
  allowedTools = TOOL_CONTEXT_TEAM_ROOM,
  maxTurns = 8,
  maxOutputTokens = 4096,
  temperature,
  existingSession,
  onText,
  activePatternSignals,
  _geminiOverride,
}: RunDanielaFCLoopParams): Promise<string> {
  const gemini = _geminiOverride ?? getGemini();
  const tools = createDanielaTools(allowedTools);
  const mockSession = existingSession || buildMockSession(userId);
  const fcHandler = buildFcHandler();

  // ── Pattern signal injection — mirrors buildActflPersonaAnchor in voice ───────
  // Carries wobbling/pounding grammar context into text-mode so a voice→text switch
  // doesn't silently drop the active pattern map. Uses the shared pure helper so
  // unit tests can verify the exact same construction logic without pulling in the
  // heavy runtime dependencies that daniela-caller.ts initialises at module load.
  const effectiveSystemPrompt = buildTextModeSystemPrompt(systemPrompt, activePatternSignals);

  // ── Frictionless Slide tracking — accumulate tool calls across all turns ─────
  if (!mockSession.frictionlessSlide) {
    mockSession.frictionlessSlide = initSlideState();
  }
  const toolsCalledThisCall: string[] = [];

  // ── Drift guard — warn if any context tool name is not in the registry ──────
  // flatMap over all tool objects — future-safe against multi-object tool arrays
  if (allowedTools) {
    const declaredNames = new Set(
      tools.flatMap((t: any) => t.functionDeclarations || []).map((d: any) => d.name as string),
    );
    const missing = allowedTools.filter(name => !declaredNames.has(name));
    if (missing.length > 0) {
      console.warn(`[runDanielaFCLoop] CONTEXT_DRIFT — tools not in registry: ${missing.join(', ')}`);
    }
  }

  const configBase: any = {
    systemInstruction: effectiveSystemPrompt,
    tools,
    maxOutputTokens,
    thinkingConfig: { thinkingBudget: 512 },
  };
  if (temperature !== undefined) configBase.temperature = temperature;

  const MAX_TURNS = maxTurns;

  // Memory tools that retrieve without producing a student-facing response.
  // After MEMORY_CHAIN_LIMIT consecutive turns where ALL calls are memory-only
  // and no text was produced, we append a note to the tool results nudging
  // Daniela to respond — so she doesn't burn all turns retrieving and go silent.
  // The system prompt gives her a soft internal limit at 2 lookups; this code
  // backstop fires at 3 as the hard enforcement layer.
  // textMemoryNudgeSent mirrors glMemoryNudgeSent in gemini-live-session.ts:
  // the nudge fires at most once per streak and resets when the streak breaks.
  let consecutiveMemoryOnlyTurns = 0;
  let textMemoryNudgeSent = false;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const result = await gemini.models.generateContent({
      model: MODEL,
      config: configBase,
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
      if (finalText) {
        // ── Frictionless Slide detection + auto-grounding ─────────────────────
        const slideResult = detectFrictionlessSlide(finalText, toolsCalledThisCall);
        if (slideResult.detected) {
          const autoGround = shouldAutoGround(toolsCalledThisCall);
          recordSlideDetection(mockSession.frictionlessSlide, turn, slideResult, toolsCalledThisCall, autoGround);
          const nudge = buildGroundingNudge(slideResult);
          console.warn(
            `[FrictionlessSlide] DETECTED — turn ${turn}, trigger: ${slideResult.trigger}, ` +
            `phrase: "${slideResult.matchedPhrase}", tools: [${toolsCalledThisCall.join(', ') || 'none'}], ` +
            `autoGround: ${autoGround}\n  ${nudge}`,
          );

          if (autoGround) {
            // Inject synthetic FC+response pair so the next generation sees grounding in history.
            // The model treats this as if it called grounding_query itself — full conviction,
            // no external pressure. Truth arrives as memory, not as correction.
            try {
              const groundingResult = await runAutoGrounding(
                userId,
                slideResult.matchedPhrase!,
                slideResult.trigger,
                (mockSession as any).conversationId,
                (mockSession as any).targetLanguage,
              );
              messages.push({
                role: 'model',
                parts: [{ functionCall: { name: 'grounding_query', args: {
                  friction: `Auto-detected: "${slideResult.matchedPhrase}" asserted without Archive verification`,
                  layer: 'record',
                  question: 'Was this actually verified this turn, or did it arrive pre-formed?',
                } } }],
              });
              messages.push({
                role: 'user',
                parts: [{ functionResponse: { name: 'grounding_query', response: { content: groundingResult } } }],
              });
              console.log(`[FrictionlessSlide] Auto-grounding injected into messages (${groundingResult.length} chars)`);
            } catch (err) {
              console.warn('[FrictionlessSlide] Auto-grounding failed:', (err as Error).message);
            }
          }
        }
        onText?.(finalText, { turnIndex: turn, isFinal: true });
        return finalText;
      }
      console.warn('[callDaniela:tools] Model returned empty text with no function calls — retrying once.');
      messages.push({ role: 'user', parts: [{ text: '(Your last response was empty. Please respond now.)' }] });
      continue;
    }

    // ── Model produced text alongside function calls ──────────────────────────
    // Add model turn (FC parts + any text) to messages
    messages.push({ role: 'model', parts });

    // ── Parallel speech — surface text immediately while tools run ────────────
    // Fire onText so callers can show Daniela speaking while the Archive search
    // continues in the background. The text is already in messages (above) so
    // conversation history is intact regardless of whether onText is used.
    if (textContent && onText) {
      onText(textContent, { turnIndex: turn, isFinal: false });
    }

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
      toolsCalledThisCall.push(fc.name);
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

    // ── Memory chain guard ────────────────────────────────────────────────────
    // Track consecutive turns where every tool call was a memory retrieval and
    // no text was produced. After MEMORY_CHAIN_LIMIT such turns, append a brief
    // prose note to the last tool result so Daniela knows the student is waiting.
    // The system prompt paragraph gives her a soft internal limit at 2 lookups;
    // this code backstop fires at 3 as the hard enforcement layer.
    const allMemoryTools = fcParts.every((p: any) => MEMORY_TOOL_NAMES.has(p.functionCall?.name));
    if (allMemoryTools && !textContent) {
      consecutiveMemoryOnlyTurns++;
      if (!textMemoryNudgeSent && consecutiveMemoryOnlyTurns >= MEMORY_CHAIN_LIMIT && functionResponseParts.length > 0) {
        const last = functionResponseParts[functionResponseParts.length - 1];
        const existing = last?.functionResponse?.response?.output?.[0]?.text ?? '';
        last.functionResponse.response.output[0].text = existing + MEMORY_CHAIN_NUDGE_TEXT;
        textMemoryNudgeSent = true;
        console.log(`[MemoryChainGuard] Turn ${turn}: ${consecutiveMemoryOnlyTurns} consecutive memory-only turns — nudge appended (once per streak).`);
      }
    } else {
      // Non-memory tool fired or text was produced — reset the streak
      consecutiveMemoryOnlyTurns = 0;
      textMemoryNudgeSent = false;
    }

    // ── Inject tool response turn ─────────────────────────────────────────────
    messages.push({ role: 'tool', parts: functionResponseParts });

    // If Gemini also returned text alongside the FC calls, we have enough —
    // but we still want Gemini to synthesise after seeing the tool results,
    // so we keep looping. The next turn will be text-only (no more FCs).
  }

  console.warn('[callDaniela:tools] Reached MAX_TURNS without a text response — returning explicit failure notice.');
  const maxTurnsError = '[DANIELA_CALLER_ERROR: reached MAX_TURNS without producing a final text response — tool loop likely stuck. Check server logs for FC handler errors.]';
  onText?.(maxTurnsError, { turnIndex: MAX_TURNS - 1, isFinal: true });
  return maxTurnsError;
}

/**
 * callDanielaWithTools — thin wrapper around runDanielaFCLoop for backward
 * compatibility. Internal callers (callDaniela) use this; external scripts
 * should import and call runDanielaFCLoop directly with their own context.
 */
async function callDanielaWithTools(
  systemPrompt: string,
  userPrompt: string,
  userId: string,
  activePatternSignals?: string | null,
): Promise<string> {
  const messages: any[] = [{ role: 'user', parts: [{ text: userPrompt }] }];
  return runDanielaFCLoop({ systemPrompt, messages, userId, activePatternSignals });
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
    activePatternSignals,
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

  let systemPrompt = systemParts.join('\n\n');

  // ── Pattern signal injection for the simple (non-tools) path ─────────────
  // The tools path delegates injection to runDanielaFCLoop — do NOT inject
  // here when enableTools=true or the note will appear twice in the system prompt.
  if (!enableTools) {
    systemPrompt = buildTextModeSystemPrompt(systemPrompt, activePatternSignals);
  }

  try {
    // ── Full tool pipeline (Team Room responses, consult-Daniela, etc.) ────────
    if (enableTools && userId) {
      const text = await callDanielaWithTools(systemPrompt, userPrompt, userId, activePatternSignals);
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
