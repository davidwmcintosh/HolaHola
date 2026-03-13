import Anthropic from "@anthropic-ai/sdk";
import { buildAldenSystemPrompt } from "../alden-system-prompt";
import { ALDEN_TOOLS, executeAldenTool } from "./alden-functions";
import { buildAldenWorkspaceContext } from "./alden-workspace-context";
import { aldenActivity } from "./alden-activity-emitter";

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (anthropicClient) return anthropicClient;

  anthropicClient = new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  });
  return anthropicClient;
}

export interface SceneContext {
  sceneId: string;
  sceneName: string;
  sceneObjective: string;
  zoneKey?: string;
  zoneName?: string;
  zoneType?: string; // 'spatial' | 'interactional' | 'departmental' | 'navigational'
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

interface AldenChatResponse {
  response: string;
  toolsUsed: string[];
}

const MAX_AGENT_ROUNDS = 4;

export async function generateAldenResponse(params: AldenChatParams): Promise<AldenChatResponse> {
  const { userMessage, conversationHistory = [], founderName = 'David', timezone, learningContext, conversationId } = params;
  const toolsUsed: string[] = [];

  try {
    const client = getAnthropicClient();
    const systemPrompt = buildAldenSystemPrompt({ founderName, timezone });

    const messages: Anthropic.MessageParam[] = [];

    // ── Workspace Context Injection (push model, every turn) ─────────────────
    // Mirrors Daniela's classroom: persistent memory, significant past sessions,
    // and Express Lane awareness are assembled and injected before every message.
    const workspaceContext = await buildAldenWorkspaceContext();
    if (workspaceContext) {
      messages.push({
        role: 'user',
        content: `[WORKSPACE CONTEXT — read and internalize before responding]\n\n${workspaceContext}`,
      });
      messages.push({
        role: 'assistant',
        content: 'Workspace loaded. I have my memory, past session context, and Express Lane activity. Ready.',
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Learning Context Injection (scene & zone awareness) ──────────────────
    // Passes structured info about where the student is in their learning journey.
    // Zone type determines what kind of teaching Daniela should do:
    //   spatial → prepositions/object placement
    //   interactional → dialogue sequences and social functions
    //   departmental → vocabulary categories
    //   navigational → directions and wayfinding
    if (learningContext) {
      const parts: string[] = [];
      if (learningContext.currentScene) {
        const s = learningContext.currentScene;
        parts.push(`CURRENT SCENE: ${s.sceneName} (${s.sceneId})
Objective: ${s.sceneObjective}`);
        if (s.zoneKey) {
          parts.push(`ACTIVE ZONE: ${s.zoneName} [${s.zoneType}]
Key: ${s.zoneKey}
Note: Zone type '${s.zoneType}' means ${
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
        const separator = '\n\n';
        messages.push({ role: 'user', content: '[LEARNING CONTEXT]\n\n' + parts.join(separator) });
        messages.push({ role: 'assistant', content: 'Learning context received. I understand the current scene and zone and will tailor my teaching accordingly.' });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    for (const msg of conversationHistory.slice(-20)) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    let aldenResponse: string | null = null;

    for (let round = 0; round < MAX_AGENT_ROUNDS; round++) {
      const result = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 8192,
        system: systemPrompt,
        messages,
        tools: ALDEN_TOOLS,
      });

      const textBlocks = result.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      );
      const toolUseBlocks = result.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      if (textBlocks.length > 0) {
        aldenResponse = textBlocks.map(b => b.text).join('\n');
      }

      if (toolUseBlocks.length === 0 || result.stop_reason === 'end_turn') {
        break;
      }

      console.log(`[Alden Chat] Round ${round + 1}: ${toolUseBlocks.length} tool call(s) — ${toolUseBlocks.map(t => t.name).join(', ')}`);

      messages.push({
        role: 'assistant',
        content: result.content,
      });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        toolsUsed.push(toolUse.name);

        aldenActivity.push({ type: 'tool_start', name: toolUse.name, timestamp: new Date().toISOString() });

        try {
          const toolResult = await executeAldenTool(toolUse.name, (toolUse.input as Record<string, any>) || {}, { conversationId });
          aldenActivity.push({ type: 'tool_result', name: toolUse.name, success: true, timestamp: new Date().toISOString() });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(toolResult.data),
          });
        } catch (err: any) {
          console.warn(`[Alden Chat] Tool ${toolUse.name} failed:`, err.message);
          aldenActivity.push({ type: 'tool_result', name: toolUse.name, success: false, error: err.message, timestamp: new Date().toISOString() });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: err.message }),
            is_error: true,
          });
        }
      }

      messages.push({
        role: 'user',
        content: toolResults,
      });
    }

    if (!aldenResponse) {
      aldenResponse = "I'm having trouble connecting to my systems right now. Give me a moment and try again.";
    }

    console.log(`[Alden Chat] Response generated (${aldenResponse.length} chars, ${toolsUsed.length} tools used)`);

    aldenActivity.push({ type: 'response_complete', timestamp: new Date().toISOString() });

    return { response: aldenResponse, toolsUsed };
  } catch (error: any) {
    console.error('[Alden Chat] Error:', error.message);
    return {
      response: "Something went wrong on my end. Let me try to recover — ask me again in a moment.",
      toolsUsed,
    };
  }
}

console.log('[Alden Persona Service] Loaded — Alden voice chat ready (Claude)');
