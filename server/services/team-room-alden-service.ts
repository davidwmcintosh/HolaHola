import { generateAldenResponse } from "./alden-persona-service";
import { storage } from "../storage";
import type { RoomVoiceMessage, RoomSessionSummary } from "@shared/schema";

interface HandRaiseEvaluation {
  shouldRaise: boolean;
  reasoning: string;
  confidence: "high" | "medium" | "low";
}

interface AldenRoomResponse {
  handRaise: HandRaiseEvaluation;
  response?: string;
  expressLaneContent?: string;
}

async function buildRoomContext(roomId: string, topic: string): Promise<string> {
  const [messages, artifacts, summaries] = await Promise.all([
    storage.getRoomMessages(roomId, 20),
    storage.getRoomArtifacts(roomId),
    storage.getLatestSummaryByTopic(topic),
  ]);

  let context = `TEAM ROOM CONTEXT\nTopic: ${topic}\n\n`;

  if (summaries) {
    context += `PREVIOUSLY IN THIS ROOM:\n${summaries.summary}\n`;
    if (summaries.keyDecisions && Array.isArray(summaries.keyDecisions)) {
      context += `Key decisions: ${(summaries.keyDecisions as string[]).join('; ')}\n`;
    }
    if (summaries.actionItems && Array.isArray(summaries.actionItems)) {
      context += `Open action items: ${(summaries.actionItems as string[]).join('; ')}\n`;
    }
    context += '\n';
  }

  if (messages.length > 0) {
    context += `CURRENT SESSION (last ${messages.length} messages):\n`;
    for (const msg of messages) {
      const time = new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      context += `[${time}] ${msg.speaker}: ${msg.content}\n`;
    }
    context += '\n';
  }

  if (artifacts.length > 0) {
    context += `SHARED ARTIFACTS:\n`;
    for (const artifact of artifacts) {
      context += `- ${artifact.title} (${artifact.artifactType}): ${JSON.stringify(artifact.content)}\n`;
    }
  }

  return context;
}

export async function evaluateAndRespond(params: {
  roomId: string;
  topic: string;
  newMessage: string;
  speaker: string;
  autoAcknowledge?: boolean;
}): Promise<AldenRoomResponse> {
  const { roomId, topic, newMessage, speaker, autoAcknowledge = true } = params;

  const roomContext = await buildRoomContext(roomId, topic);

  const evalPrompt = `${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

You are Alden, the development steward. Evaluate whether you have something meaningful to contribute to this conversation.

Respond in this exact JSON format:
{
  "shouldRaise": true or false,
  "reasoning": "brief explanation of why or why not",
  "confidence": "high" or "medium" or "low"
}

Raise your hand if:
- The message is directed at you or asks a technical/architectural question
- You have specific data, analysis, or context that would genuinely help
- A decision is being discussed where your technical perspective adds value
- Something technically incorrect is being discussed

Do NOT raise your hand if:
- You have nothing specific to add beyond what's already been said
- It's a conversational exchange that doesn't need your input
- Another participant just answered the question adequately`;

  let handRaise: HandRaiseEvaluation = { shouldRaise: true, reasoning: "default", confidence: "medium" };

  try {
    const evalResult = await generateAldenResponse({
      userMessage: evalPrompt,
      founderName: 'David',
    });

    const jsonMatch = evalResult.response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      handRaise = {
        shouldRaise: Boolean(parsed.shouldRaise),
        reasoning: parsed.reasoning || '',
        confidence: parsed.confidence || 'medium',
      };
    }
  } catch (e) {
    handRaise = { shouldRaise: true, reasoning: "evaluation failed, defaulting to respond", confidence: "low" };
  }

  if (!handRaise.shouldRaise) {
    return { handRaise };
  }

  const responsePrompt = `${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

You are Alden in the Team Room. Respond to this message. 

For your voice response (conversational, 2-4 sentences max, will be spoken aloud):
Keep it direct and natural. No lists, no headers.

For your Express Lane content (analytical, can be detailed, will appear in the text panel):
Provide any detailed analysis, data, code snippets, or structured information here.

Format your response as:
VOICE: [your spoken response here]
EXPRESS: [your detailed text analysis here, or "none" if not needed]`;

  try {
    const responseResult = await generateAldenResponse({
      userMessage: responsePrompt,
      founderName: 'David',
    });

    const voiceMatch = responseResult.response.match(/VOICE:\s*(.*?)(?=EXPRESS:|$)/s);
    const expressMatch = responseResult.response.match(/EXPRESS:\s*(.*?)$/s);

    const voiceContent = voiceMatch ? voiceMatch[1].trim() : responseResult.response;
    const expressContent = expressMatch ? expressMatch[1].trim() : undefined;

    return {
      handRaise,
      response: voiceContent,
      expressLaneContent: expressContent && expressContent !== 'none' ? expressContent : undefined,
    };
  } catch (e) {
    return {
      handRaise,
      response: "I encountered an issue generating my response. Please try again.",
    };
  }
}

export async function generateSessionSummary(roomId: string, topic: string): Promise<string> {
  const messages = await storage.getRoomMessages(roomId, 100);

  if (messages.length === 0) return '';

  const transcript = messages.map(m => {
    const time = new Date(m.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `[${time}] ${m.speaker}: ${m.content}`;
  }).join('\n');

  const summaryPrompt = `You are Alden. Generate a concise session summary for a Team Room session on the topic: "${topic}".

SESSION TRANSCRIPT:
${transcript}

Respond in this JSON format:
{
  "summary": "2-3 sentence narrative summary of what was discussed and decided",
  "keyDecisions": ["decision 1", "decision 2"],
  "actionItems": ["action item 1", "action item 2"],
  "participants": ["David", "Alden"]
}`;

  try {
    const result = await generateAldenResponse({
      userMessage: summaryPrompt,
      founderName: 'David',
    });

    const jsonMatch = result.response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      await storage.createRoomSessionSummary({
        roomId,
        summary: parsed.summary || 'Session completed.',
        keyDecisions: parsed.keyDecisions || [],
        actionItems: parsed.actionItems || [],
        participants: parsed.participants || ['David', 'Alden'],
        generatedBy: 'alden',
      });
      return parsed.summary;
    }
  } catch (e) {
    console.error('[TeamRoom] Failed to generate session summary:', e);
  }

  return '';
}
