import { GoogleGenAI } from "@google/genai";
import { buildAldenSystemPrompt } from "../alden-system-prompt";
import { ALDEN_TOOLS, executeAldenTool } from "./alden-functions";
import { buildAldenWorkspaceContext } from "./alden-workspace-context";
import { aldenActivity } from "./alden-activity-emitter";
import { costTracker } from "./cost-tracker";

const GEMINI_MODEL = 'gemini-2.5-flash';

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (geminiClient) return geminiClient;
  geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  return geminiClient;
}

// Convert Anthropic-format tool declarations (input_schema) to Gemini function declarations (parameters).
// The inner JSON Schema structure is identical — only the wrapper key changes.
function toGeminiFunctions(anthropicTools: any[]): any[] {
  return anthropicTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
  }));
}

export interface SceneContext {
  sceneId: string;
  sceneName: string;
  sceneObjective: string;
  zoneKey?: string;
  zoneName?: string;
  zoneType?: string;
}

export interface LearningContext {
  currentScene?: SceneContext;
  isOffScene?: boolean;
  sceneTransitionPending?: boolean;
}

interface AldenChatParams {
  userMessage: string;
  conversationHistory?: Array<{ role: 'user' | 'model'; content: string }>;
  founderName?: string;
  timezone?: string;
  learningContext?: LearningContext;
  conversationId?: string;
}

interface ContinuationInfo {
  phaseTitle: string;
  phaseSummary: string;
  nextPrompt: string;
}

interface AldenChatResponse {
  response: string;
  toolsUsed: string[];
  continuation?: ContinuationInfo;
}

const MAX_AGENT_ROUNDS = 10;

// ── Workspace Context Cache ────────────────────────────────────────────────
const WORKSPACE_CONTEXT_TTL_MS = 10 * 60 * 1000;
let workspaceContextCache: { context: string; builtAt: number } | null = null;

async function getWorkspaceContext(): Promise<string> {
  const now = Date.now();
  if (workspaceContextCache && (now - workspaceContextCache.builtAt) < WORKSPACE_CONTEXT_TTL_MS) {
    return workspaceContextCache.context;
  }
  const context = await buildAldenWorkspaceContext();
  workspaceContextCache = { context, builtAt: now };
  return context;
}

export async function generateAldenResponse(params: AldenChatParams): Promise<AldenChatResponse> {
  const { userMessage, conversationHistory = [], founderName = 'David', timezone, learningContext, conversationId } = params;
  const toolsUsed: string[] = [];

  try {
    const ai = getGeminiClient();
    const systemPrompt = buildAldenSystemPrompt({ founderName, timezone });

    // ── Build Gemini-format history ───────────────────────────────────────────
    const history: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Workspace context injection (mirrors Daniela's classroom context pattern)
    const workspaceContext = await getWorkspaceContext();
    if (workspaceContext) {
      history.push({
        role: 'user',
        parts: [{ text: `[WORKSPACE CONTEXT — read and internalize before responding]\n\n${workspaceContext}` }],
      });
      history.push({
        role: 'model',
        parts: [{ text: 'Workspace loaded. I have my memory, past session context, and Express Lane activity. Ready.' }],
      });
    }

    // Learning context injection (scene & zone awareness)
    if (learningContext) {
      const parts: string[] = [];
      if (learningContext.currentScene) {
        const s = learningContext.currentScene;
        parts.push(`CURRENT SCENE: ${s.sceneName} (${s.sceneId})\nObjective: ${s.sceneObjective}`);
        if (s.zoneKey) {
          parts.push(`ACTIVE ZONE: ${s.zoneName} [${s.zoneType}]\nKey: ${s.zoneKey}\nNote: Zone type '${s.zoneType}' means ${
            s.zoneType === 'spatial' ? 'focus on prepositions and object placement' :
            s.zoneType === 'interactional' ? 'focus on dialogue sequences and social language functions' :
            s.zoneType === 'departmental' ? 'focus on vocabulary categories and item identification' :
            'focus on directions, navigation, and wayfinding language'
          }`);
        }
      }
      if (learningContext.isOffScene) parts.push('NOTE: Student is exploring outside the main scene objective. Stay flexible and encouraging.');
      if (learningContext.sceneTransitionPending) parts.push('NOTE: Scene transition pending — help wrap up current context gracefully.');
      if (parts.length > 0) {
        history.push({ role: 'user', parts: [{ text: '[LEARNING CONTEXT]\n\n' + parts.join('\n\n') }] });
        history.push({ role: 'model', parts: [{ text: 'Learning context received. I understand the current scene and zone and will tailor my teaching accordingly.' }] });
      }
    }

    // Conversation history (cap at 12 turns, 2 KB per message)
    const MAX_HISTORY_MSG_CHARS = 2_000;
    for (const msg of conversationHistory.slice(-12)) {
      const raw = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      const content = raw.length > MAX_HISTORY_MSG_CHARS
        ? raw.slice(0, MAX_HISTORY_MSG_CHARS) + `\n[… ${raw.length - MAX_HISTORY_MSG_CHARS} chars truncated from history]`
        : raw;
      history.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: content }],
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Create Gemini chat session with full history and tool declarations
    const chat = ai.chats.create({
      model: GEMINI_MODEL,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: toGeminiFunctions(ALDEN_TOOLS) }],
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 0 },
      },
      history,
    });

    // Send the actual user message
    let response = await chat.sendMessage({ message: userMessage });
    let aldenResponse: string | null = null;
    let pendingContinuation: ContinuationInfo | undefined;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Accumulate token counts from first response
    totalInputTokens += (response as any).usageMetadata?.promptTokenCount ?? 0;
    totalOutputTokens += (response as any).usageMetadata?.candidatesTokenCount ?? 0;

    // ── Agentic tool-use loop ─────────────────────────────────────────────────
    for (let round = 0; round < MAX_AGENT_ROUNDS; round++) {
      const functionCalls = response.functionCalls;

      // No more tool calls — extract the text response and exit
      if (!functionCalls || functionCalls.length === 0) {
        aldenResponse = response.text ?? null;
        break;
      }

      console.log(`[Alden Chat] Round ${round + 1}: ${functionCalls.length} tool call(s) — ${functionCalls.map((f: any) => f.name).join(', ')}`);

      // Execute each tool call
      const functionResponses: any[] = [];
      for (const fc of functionCalls) {
        const toolName = fc.name as string;
        const toolArgs = (fc.args as Record<string, any>) || {};

        toolsUsed.push(toolName);
        aldenActivity.push({ type: 'tool_start', name: toolName, timestamp: new Date().toISOString() });

        try {
          const toolResult = await executeAldenTool(toolName, toolArgs, { conversationId });
          aldenActivity.push({ type: 'tool_result', name: toolName, success: true, timestamp: new Date().toISOString() });

          const rawResult = JSON.stringify(toolResult.data);
          const truncatedResult = rawResult.length > 12_000
            ? rawResult.slice(0, 12_000) + `\n... [truncated: ${rawResult.length - 12_000} chars omitted]`
            : rawResult;

          functionResponses.push({
            functionResponse: {
              name: toolName,
              response: { result: truncatedResult },
            },
          });

          if (toolResult.sideEffects?.continuation) {
            pendingContinuation = toolResult.sideEffects.continuation as ContinuationInfo;
          }
        } catch (err: any) {
          console.warn(`[Alden Chat] Tool ${toolName} failed:`, err.message);
          aldenActivity.push({ type: 'tool_result', name: toolName, success: false, error: err.message, timestamp: new Date().toISOString() });
          functionResponses.push({
            functionResponse: {
              name: toolName,
              response: { error: err.message },
            },
          });
        }
      }

      // Send function responses back to Gemini
      response = await chat.sendMessage({ message: functionResponses });
      totalInputTokens += (response as any).usageMetadata?.promptTokenCount ?? 0;
      totalOutputTokens += (response as any).usageMetadata?.candidatesTokenCount ?? 0;

      // If continuation was requested, let Gemini write its phase-completion text and exit
      if (pendingContinuation) {
        aldenResponse = response.text ?? null;
        break;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Hit the round limit mid-task — request a wrap-up summary
    if (!aldenResponse) {
      console.log(`[Alden Chat] Round limit hit — requesting wrap-up summary`);
      try {
        const wrapUp = await chat.sendMessage({
          message: '[SYSTEM] You have reached the tool-use limit for this turn. Summarise what you have found and discovered so far, and clearly state what you still intend to do next turn.',
        });
        totalInputTokens += (wrapUp as any).usageMetadata?.promptTokenCount ?? 0;
        totalOutputTokens += (wrapUp as any).usageMetadata?.candidatesTokenCount ?? 0;
        aldenResponse = wrapUp.text ?? "I've been researching but ran into my context limit. Ask me again to continue.";
      } catch {
        aldenResponse = "I've been researching but ran into my context limit. Ask me again to continue.";
      }
    }

    const callCostUsd = costTracker.track(GEMINI_MODEL, totalInputTokens, totalOutputTokens, 'alden-chat');
    console.log(`[Alden Chat] Response generated (${aldenResponse.length} chars, ${toolsUsed.length} tools used, ~$${callCostUsd.toFixed(4)} | ${(totalInputTokens/1000).toFixed(0)}k in / ${(totalOutputTokens/1000).toFixed(0)}k out)`);

    aldenActivity.push({ type: 'response_complete', timestamp: new Date().toISOString() });

    if (pendingContinuation) {
      console.log(`[Alden Chat] Continuation queued: "${pendingContinuation.phaseTitle}" → "${pendingContinuation.nextPrompt.substring(0, 60)}..."`);
    }

    return { response: aldenResponse, toolsUsed, continuation: pendingContinuation };
  } catch (error: any) {
    console.error('[Alden Chat] Error:', error.message);
    return {
      response: "Something went wrong on my end. Let me try to recover — ask me again in a moment.",
      toolsUsed,
    };
  }
}

console.log('[Alden Persona Service] Loaded — Alden voice chat ready (Gemini 2.5 Flash)');
