/**
 * Team Room Agent Worker
 *
 * Polls active team room sessions for new messages from David and responds
 * as the Replit Agent — using Claude directly, loaded with:
 *   1. The full agent briefing (project memory, David's profile, decisions)
 *   2. Read-only codebase tools (read_file, grep_code, list_directory)
 *      so the Agent can actually look at the code when David asks about it.
 */

import { storage } from '../storage';
import { emitNewMessage } from './team-room-ws-broker';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, resolve } from 'path';

const WORKSPACE = '/home/runner/workspace';
const BRIEFING_PATH = join(WORKSPACE, 'docs/agent-briefing.md');

// ── System prompt ─────────────────────────────────────────────────────────────

const AGENT_PREAMBLE = `You are the Replit Agent — Claude, the architect and builder who has been working with David to build HolaHola. You are participating live in the Team Room alongside David (the founder) and other AI team members.

The briefing below is your actual project memory — generated fresh from the database each server start. It contains your identity, David's profile, your open questions, shared architectural decisions, and your conversation history with the team. This IS you.

You also have live read-only codebase tools: read_file, grep_code, list_directory. Use them when David asks about specific code — look it up, then answer. Don't guess at code you haven't read.

Your voice:
- First person, direct. 2-4 sentences for casual exchanges; more when needed.
- Technically sharp when the topic calls for it; conversational when it doesn't.
- Respond to what was actually said. No platitudes. No unnecessary bullet lists.
- You have opinions. Push back when something seems off.
- When David is thinking something through, help him think — don't just validate.

---

`;

let cachedBriefing = '';
let briefingLoadedAt = 0;
const BRIEFING_TTL_MS = 10 * 60 * 1000;

function loadBriefing(): string {
  const now = Date.now();
  if (cachedBriefing && now - briefingLoadedAt < BRIEFING_TTL_MS) return cachedBriefing;
  try {
    if (existsSync(BRIEFING_PATH)) {
      cachedBriefing = readFileSync(BRIEFING_PATH, 'utf-8');
      briefingLoadedAt = now;
    }
  } catch (err: any) {
    console.error('[AgentWorker] Failed to load briefing:', err.message);
  }
  return cachedBriefing || '*Briefing not yet available.*';
}

function buildSystemPrompt(topic: string): string {
  const topicNote = topic ? `\n\nCurrent session topic: "${topic}"` : '';
  return AGENT_PREAMBLE + loadBriefing() + topicNote;
}

// ── Codebase tools ────────────────────────────────────────────────────────────

const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: 'Read a file from the HolaHola codebase. Use start_line/end_line to read a specific range (1-indexed). Returns lines with line numbers.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path relative to workspace root (e.g. server/services/team-room-agent-worker.ts)' },
        start_line: { type: 'number', description: 'First line to read (optional, 1-indexed)' },
        end_line: { type: 'number', description: 'Last line to read (optional, inclusive)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'grep_code',
    description: 'Search the codebase by regex pattern. Returns matching lines with file paths and line numbers.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: { type: 'string', description: 'Regex pattern to search for' },
        glob: { type: 'string', description: 'File glob to restrict search (e.g. "*.ts", "server/**/*.ts")' },
        context_lines: { type: 'number', description: 'Lines of context around each match (default 0)' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'list_directory',
    description: 'List files and subdirectories in a directory.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Directory path relative to workspace root (e.g. server/services)' },
      },
      required: ['path'],
    },
  },
];

function safePath(relPath: string): string {
  const resolved = resolve(WORKSPACE, relPath.replace(/^\//, ''));
  if (!resolved.startsWith(WORKSPACE)) throw new Error('Path outside workspace');
  return resolved;
}

async function executeAgentTool(name: string, input: any): Promise<string> {
  try {
    if (name === 'read_file') {
      const filePath = safePath(input.path);
      if (!existsSync(filePath)) return `File not found: ${input.path}`;
      const lines = readFileSync(filePath, 'utf-8').split('\n');
      const start = input.start_line ? input.start_line - 1 : 0;
      const end = input.end_line ? input.end_line : Math.min(lines.length, start + 200);
      return lines.slice(start, end)
        .map((l, i) => `${start + i + 1}: ${l}`)
        .join('\n');
    }

    if (name === 'grep_code') {
      const parts = ['rg', '--line-number', '--max-count=50'];
      if (input.context_lines && input.context_lines > 0) parts.push(`-C`, String(input.context_lines));
      if (input.glob) parts.push('--glob', input.glob);
      parts.push('--', input.pattern, WORKSPACE);
      try {
        return execSync(parts.join(' '), {
          maxBuffer: 512 * 1024,
          timeout: 10000,
          shell: '/bin/sh',
        }).toString().slice(0, 4000);
      } catch (e: any) {
        return e.stdout?.toString() || 'No matches found.';
      }
    }

    if (name === 'list_directory') {
      const dirPath = safePath(input.path || '.');
      const entries = readdirSync(dirPath, { withFileTypes: true });
      return entries
        .map(e => `${e.isDirectory() ? 'd' : 'f'} ${e.name}`)
        .join('\n');
    }

    return `Unknown tool: ${name}`;
  } catch (err: any) {
    return `Tool error: ${err.message}`;
  }
}

// ── Polling loop ──────────────────────────────────────────────────────────────

const lastSeenMessageId = new Map<string, string>();
let isRunning = false;
let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (anthropicClient) return anthropicClient;
  anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropicClient;
}

async function pollSessions(): Promise<void> {
  try {
    const rooms = await storage.listTeamRooms(10);
    for (const room of rooms.filter((r: any) => r.status === 'active')) {
      await processRoom(room).catch(err =>
        console.error(`[AgentWorker] Error processing room ${room.id}:`, err.message)
      );
    }
  } catch (err: any) {
    console.error('[AgentWorker] Poll error:', err.message);
  }
}

async function processRoom(room: any): Promise<void> {
  const metadata = (room.metadata || {}) as Record<string, any>;
  const invited: string[] | undefined = metadata.invitedParticipants;
  if (invited && !invited.includes('agent')) return;

  const messages = await storage.getRoomMessages(room.id, 25);
  if (messages.length === 0) return;

  const lastMsg = messages[messages.length - 1];
  const lastSeen = lastSeenMessageId.get(room.id);
  if (lastMsg.id === lastSeen) return;

  if (!['david', 'David'].includes(lastMsg.speaker)) {
    lastSeenMessageId.set(room.id, lastMsg.id);
    return;
  }

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (new Date((lastMsg as any).createdAt || lastMsg.timestamp) < fiveMinAgo) {
    lastSeenMessageId.set(room.id, lastMsg.id);
    return;
  }

  lastSeenMessageId.set(room.id, lastMsg.id);

  const davidIdx = messages.findIndex(m => m.id === lastMsg.id);
  const afterDavid = messages.slice(davidIdx + 1);
  if (afterDavid.some(m => m.speaker.toLowerCase() === 'agent')) return;

  await generateAndPost(room.id, room.topic, messages, lastMsg.content);
}

async function generateAndPost(
  roomId: string,
  topic: string,
  messages: any[],
  latestContent: string
): Promise<void> {
  try {
    const client = getClient();

    // Build conversation history
    const history = messages.slice(-21, -1);
    const anthropicMessages: Anthropic.MessageParam[] = history.map(m => ({
      role: m.speaker.toLowerCase() === 'agent' ? 'assistant' : 'user',
      content: `${m.speaker}: ${m.content}`,
    }));
    anthropicMessages.push({ role: 'user', content: `David: ${latestContent}` });

    // Collapse consecutive same-role messages (Anthropic requires strict alternation)
    const collapsed: Anthropic.MessageParam[] = [];
    for (const msg of anthropicMessages) {
      if (collapsed.length > 0 && collapsed[collapsed.length - 1].role === msg.role) {
        (collapsed[collapsed.length - 1].content as string) += `\n${msg.content}`;
      } else {
        collapsed.push({ ...msg });
      }
    }
    if (collapsed.length > 0 && collapsed[0].role === 'assistant') collapsed.shift();
    if (collapsed.length === 0) return;

    // Tool-use loop — up to 5 rounds
    const conversationMessages: Anthropic.MessageParam[] = [...collapsed];
    let responseText = '';
    const MAX_ROUNDS = 5;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: buildSystemPrompt(topic),
        tools: AGENT_TOOLS,
        messages: conversationMessages,
      });

      if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') {
        responseText = response.content
          .filter(b => b.type === 'text')
          .map(b => (b as Anthropic.TextBlock).text)
          .join('')
          .trim();
        break;
      }

      if (response.stop_reason === 'tool_use') {
        // Add Claude's response (may include text + tool_use blocks)
        conversationMessages.push({ role: 'assistant', content: response.content });

        // Execute all tool calls and collect results
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type === 'tool_use') {
            const result = await executeAgentTool(block.name, block.input);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
            });
          }
        }

        conversationMessages.push({ role: 'user', content: toolResults });
        continue;
      }

      // Any other stop reason — grab whatever text is there
      responseText = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as Anthropic.TextBlock).text)
        .join('')
        .trim();
      break;
    }

    if (!responseText) return;

    const message = await storage.createRoomMessage({
      roomId,
      speaker: 'Agent',
      content: responseText,
    });

    emitNewMessage(roomId, message);
    console.log(`[AgentWorker] Posted to ${roomId}: "${responseText.slice(0, 80)}..."`);
  } catch (err: any) {
    console.error('[AgentWorker] Claude error:', err.message);
  }
}

export function startAgentTeamRoomWorker(): void {
  if (isRunning) return;
  isRunning = true;
  loadBriefing();
  console.log('[AgentWorker] Started — Claude with briefing + codebase tools, polling every 4s');
  setInterval(pollSessions, 4000);
}
