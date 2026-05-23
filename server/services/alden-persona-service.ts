import Anthropic from "@anthropic-ai/sdk";
import { buildAldenSystemPrompt } from "../alden-system-prompt";
import { ALDEN_TOOLS, executeAldenTool } from "./alden-functions";
import { buildAldenWorkspaceContext } from "./alden-workspace-context";
import { aldenActivity } from "./alden-activity-emitter";
import { costTracker } from "./cost-tracker";

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (anthropicClient) return anthropicClient;

  anthropicClient = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
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

    // Cap individual history messages at 2 KB and keep only the last 12 turns.
    // Each turn in a multi-round tool-use session carries the full prior messages array,
    // so quadratic growth kicks in fast. 12 turns × 2 KB = 24 KB max from history alone.
    const MAX_HISTORY_MSG_CHARS = 2_000;
    for (const msg of conversationHistory.slice(-12)) {
      const raw = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      const content = raw.length > MAX_HISTORY_MSG_CHARS
        ? raw.slice(0, MAX_HISTORY_MSG_CHARS) + `\n[… ${raw.length - MAX_HISTORY_MSG_CHARS} chars truncated from history]`
        : raw;
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content,
      });
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    let aldenResponse: string | null = null;
    let pendingContinuation: ContinuationInfo | undefined;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (let round = 0; round < MAX_AGENT_ROUNDS; round++) {
      const result = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: systemPrompt,
        messages,
        tools: ALDEN_TOOLS,
      });

      totalInputTokens += result.usage?.input_tokens ?? 0;
      totalOutputTokens += result.usage?.output_tokens ?? 0;

      const textBlocks = result.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      );
      const toolUseBlocks = result.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      if (toolUseBlocks.length === 0 || result.stop_reason === 'end_turn') {
        if (textBlocks.length > 0) {
          aldenResponse = textBlocks.map(b => b.text).join('\n');
        }
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
          // Cap tool results at 12 KB — large responses (file reads, shell output)
          // are the primary driver of the quadratic token blowup across rounds.
          const MAX_TOOL_RESULT_CHARS = 12_000;
          const rawToolResult = JSON.stringify(toolResult.data);
          const truncatedToolResult = rawToolResult.length > MAX_TOOL_RESULT_CHARS
            ? rawToolResult.slice(0, MAX_TOOL_RESULT_CHARS) + `\n... [truncated: ${rawToolResult.length - MAX_TOOL_RESULT_CHARS} chars omitted]`
            : rawToolResult;
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: truncatedToolResult,
          });
          // Detect continuation signal from request_continuation tool
          if (toolResult.sideEffects?.continuation) {
            pendingContinuation = toolResult.sideEffects.continuation as ContinuationInfo;
          }
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

      // If continuation was requested this round, let Claude write its phase-completion
      // text in the next iteration (with no more tools to call), then we'll break.
      if (pendingContinuation) {
        // One more pass so Claude can write the phase-completion summary text
        const finalResult = await client.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 2048,
          system: systemPrompt,
          messages,
          tools: [],
        });
        const finalText = finalResult.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map(b => b.text)
          .join('\n');
        if (finalText) aldenResponse = finalText;
        break;
      }
    }

    if (!aldenResponse) {
      // Hit the round limit mid-task — do one final tool-free call so Alden can
      // summarise what he found rather than returning nothing.
      console.log(`[Alden Chat] Round limit hit — requesting wrap-up summary`);
      try {
        messages.push({
          role: 'user',
          content: '[SYSTEM] You have reached the tool-use limit for this turn. Summarise what you have found and discovered so far, and clearly state what you still intend to do next turn.',
        });
        const wrapUp = await client.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 2048,
          system: systemPrompt,
          messages,
          tools: [],
        });
        const wrapUpText = wrapUp.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map(b => b.text)
          .join('\n');
        aldenResponse = wrapUpText || "I've been researching but ran into my context limit. Ask me again to continue.";
      } catch {
        aldenResponse = "I've been researching but ran into my context limit. Ask me again to continue.";
      }
    }

    const callCostUsd = costTracker.track('claude-sonnet-4-5', totalInputTokens, totalOutputTokens, 'alden-chat');
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

console.log('[Alden Persona Service] Loaded — Alden voice chat ready (Claude)');
