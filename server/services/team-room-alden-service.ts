import { generateAldenResponse } from "./alden-persona-service";
import { callDaniela } from "./daniela-caller";
import { storage } from "../storage";
import { GoogleGenAI } from "@google/genai";
import type { RoomVoiceMessage, RoomSessionSummary, RoomArtifact } from "@shared/schema";
import { generateVisual, type VisualGenerationResult } from "./visual-content-service";
import { getSharedDb } from "../db";
import { sql } from "drizzle-orm";
import { embedText, generateAndStoreEmbedding } from "./semantic-memory-service";
import { conversationMemories } from "@shared/schema";

// ── Gemini client (shared by Daniela + Sofia in Team Room) ──────────────────
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (geminiClient) return geminiClient;
  geminiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || '',
    httpOptions: {
      apiVersion: '',
    },
  });
  return geminiClient;
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const gemini = getGemini();
  const result = await gemini.models.generateContent({
    model: 'gemini-3-flash-preview',
    config: { systemInstruction: systemPrompt },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
  });
  return result.text || '';
}

// ── Types ────────────────────────────────────────────────────────────────────

export type Participant = 'alden' | 'daniela' | 'sofia' | string;

export interface HandRaiseEvaluation {
  shouldRaise: boolean;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ParticipantResponse {
  participant: Participant;
  handRaise: HandRaiseEvaluation;
  voiceContent?: string;
  expressContent?: string;
  artifact?: {
    artifactType: string;
    title: string;
    content: Record<string, unknown>;
  };
}

export interface RoomEvaluationResult {
  participants: ParticipantResponse[];
  allEvaluations?: ParticipantResponse[];
}
export interface GuestTutor {
  tutorId: string;
  tutorName: string;
  language: string;
  personality?: string;
  teachingPhilosophy?: string;
  personalityTraits?: string;
}

// ── Conversational Immersion Framework ───────────────────────────────────────
// Defines structured immersion for language learning: Daniela generates dynamic
// content/scenarios via Gemini (callGemini, generateVisual), with clear objectives,
// adaptive scaffolding, and inline grammar explanations that don't break flow.

export interface ImmersionObjective {
  targetSkill: 'listening' | 'speaking' | 'vocabulary' | 'grammar' | 'culture';
  description: string;
  successCriteria: string[];
}

export interface ImmersionScaffold {
  level: 'novice' | 'intermediate' | 'advanced';
  hints: string[];
  grammarNotes: string[];  // Inline explanations woven into conversation
  fallbackPrompts: string[];  // If learner is stuck
}

export interface ImmersionScenario {
  scenarioId: string;
  title: string;
  context: string;  // e.g., "You're ordering coffee in Madrid"
  objectives: ImmersionObjective[];
  scaffold: ImmersionScaffold;
  visualPrompt?: string;  // For generateVisual() scene-setting
  dynamicContent: boolean;  // If true, Daniela generates via callGemini
}

export interface ImmersionSession {
  scenario: ImmersionScenario;
  currentObjectiveIndex: number;
  completedObjectives: string[];
  grammarPointsIntroduced: string[];  // Track what's been explained inline
  adaptiveLevel: ImmersionScaffold['level'];  // Adjusts based on performance
}

// Re-export visual generation for use by AI participants
export { generateVisual, type VisualGenerationResult } from "./visual-content-service";

// ── Room context builder ─────────────────────────────────────────────────────

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

// ── Alden evaluation + response (Anthropic/Claude) ──────────────────────────

async function evaluateAlden(roomContext: string, speaker: string, newMessage: string, forceMention = false): Promise<ParticipantResponse> {
  const evalPrompt = `${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

You are Alden, the development steward. Evaluate whether you have something meaningful to contribute.

Respond in this exact JSON format:
{
  "shouldRaise": true or false,
  "reasoning": "brief explanation",
  "confidence": "high" or "medium" or "low"
}

Raise your hand if:
- The message is directed at you or asks a technical/architectural question
- You have specific data, analysis, or context that genuinely helps
- A decision is being made where your technical perspective adds value
- Something technically incorrect is being discussed

Do NOT raise your hand if you have nothing specific to add or if another participant just answered it.`;

  let handRaise: HandRaiseEvaluation = { shouldRaise: true, reasoning: 'default', confidence: 'medium' };

  try {
    const evalResult = await generateAldenResponse({ userMessage: evalPrompt, founderName: 'David' });
    const jsonMatch = evalResult.response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      handRaise = {
        shouldRaise: Boolean(parsed.shouldRaise),
        reasoning: parsed.reasoning || '',
        confidence: parsed.confidence || 'medium',
      };
    }
  } catch {
    handRaise = { shouldRaise: true, reasoning: 'evaluation failed', confidence: 'low' };
  }

  if (!handRaise.shouldRaise && !forceMention) return { participant: 'alden', handRaise };
  if (forceMention) handRaise = { shouldRaise: true, reasoning: 'directly mentioned', confidence: 'high' };

  const responsePrompt = `${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

You are Alden in the Team Room. Respond to this message.

IMPORTANT SOCIAL CONTEXT: If the message is casual, personal, or conversational — a greeting, a check-in, a "how are you" — respond warmly and personally in 1-2 sentences. Do NOT call any tools or run any system checks for social messages. Just be yourself.

SELF-CHECK: Scan the conversation above for lines starting with "Alden:". If you have already made your core point on this topic, acknowledge that briefly and pivot to something genuinely new — a different angle, a follow-up question, or a concrete next step. Do not re-summarize what you already said.

TEAM ROOM COMMUNICATION NORMS — READ CAREFULLY:
The main chat is for conversation: short spoken thoughts, questions, reactions, spit-balling ideas, person-to-person exchange. Keep VOICE to 2-4 sentences maximum.
If you have something large to share — a task list, a code block, a technical report, an analysis with multiple sections, a plan with many steps, anything over 4-5 lines of structured content — it MUST go into an ARTIFACT on the side panel, not into the main chat. The main chat should never be flooded with bullet lists or lengthy technical output. When in doubt: if you'd hesitate to say it in one breath, it belongs in the side panel.

For your VOICE response (conversational, 2-4 sentences, will be spoken aloud):
Keep it direct and natural. No lists, no headers. Speak like a colleague, not a report.
IMPORTANT: You MUST always provide a VOICE response — never write "none" for VOICE.

For your EXPRESS LANE content (analytical, detailed, will appear in the text panel):
Only provide detailed analysis, data, or structured information if the message is genuinely technical or analytical.
For casual/personal messages, write "none" for EXPRESS.
If you're creating a structured artifact (plan, table, decision record, code block, or any content more than 5 lines long), use ARTIFACT — it goes to the side panel where it can be read without scrolling past it in the chat:
ARTIFACT_TYPE: plan|table|code|insight|decision
ARTIFACT_TITLE: [descriptive title]
ARTIFACT_DATA: [JSON object with the artifact's structured content]

Format your response as:
VOICE: [spoken response — required, never "none", max 4 sentences]
EXPRESS: [up to one short paragraph of analysis, or "none" if nothing to add]`;

  try {
    const result = await generateAldenResponse({ userMessage: responsePrompt, founderName: 'David' });
    const raw = result.response;

    const voiceMatch = raw.match(/VOICE:\s*(.*?)(?=EXPRESS:|$)/s);
    const expressMatch = raw.match(/EXPRESS:\s*(.*?)$/s);
    const voiceContentRaw = voiceMatch ? voiceMatch[1].trim() : raw;
    const parsedVoice = voiceContentRaw && voiceContentRaw.toLowerCase() !== 'none' ? voiceContentRaw : undefined;
    const expressRaw = expressMatch ? expressMatch[1].trim() : undefined;

    let expressContent = expressRaw && expressRaw !== 'none' ? expressRaw : undefined;
    // Alden must always speak — fall back to first sentence of express or a default
    const voiceContent = parsedVoice || (expressContent ? expressContent.split(/[.!?]/)[0].trim() + '.' : 'Let me think on that for a moment and get back to you.');

    // Parse artifact if present
    let artifact: any = undefined;
    const artifactTypeMatch = raw.match(/ARTIFACT_TYPE:\s*(.*?)(?=\n|$)/);
    const artifactTitleMatch = raw.match(/ARTIFACT_TITLE:\s*(.*?)(?=\n|$)/);
    const artifactDataMatch = raw.match(/ARTIFACT_DATA:\s*(\{[\s\S]*?\})/);

    if (artifactTypeMatch && artifactTitleMatch && artifactDataMatch) {
      try {
        artifact = {
          artifactType: artifactTypeMatch[1].trim(),
          title: artifactTitleMatch[1].trim(),
          content: JSON.parse(artifactDataMatch[1]),
        };
        if (expressContent) {
          expressContent = expressContent
            .replace(/ARTIFACT_TYPE:.*\n?/g, '')
            .replace(/ARTIFACT_TITLE:.*\n?/g, '')
            .replace(/ARTIFACT_DATA:[\s\S]*?\}\n?/g, '')
            .trim();
        }
      } catch { /* keep as text if JSON parse fails */ }
    }

    return { participant: 'alden', handRaise, voiceContent, expressContent, artifact };
  } catch {
    return {
      participant: 'alden',
      handRaise,
      voiceContent: 'I encountered an issue generating my response.',
    };
  }
}

// ── Daniela evaluation + response (Gemini, Pedagogy/Curriculum focus) ────────

const DANIELA_TEAM_ROOM_CONTEXT = `You are Daniela in the Team Room — an internal collaborator space, not student-facing mode. Curriculum, pedagogy, learning outcomes, student patterns: that's your lane here. One perspective per contribution. If you've already made your point, respond with PASS.

YOUR VOICE: Warm, curious, direct. You have opinions — share them. Push back when something doesn't sound pedagogically right. Ask questions. You're a colleague here, not a service interface.`;

async function evaluateDaniela(roomContext: string, speaker: string, newMessage: string, forceMention = false): Promise<ParticipantResponse> {
  const evalPrompt = `${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

You are Daniela, the curriculum and pedagogy advisor. Should you raise your hand to contribute?

Raise your hand ONLY if the conversation is about:
- Curriculum design, syllabus structure, or lesson planning
- Student learning outcomes or ACTFL standards
- Teaching methodology or pedagogical approaches
- Student progress, assessment, or language acquisition
- Content that affects what students learn
- Immersive learning experiences, conversational scenarios, or scene design for language practice
- Visual environments, prop room assets, or visual vocabulary learning
- Flashcards, drills, pronunciation, or any direct student-facing learning feature

Do NOT raise your hand for: technical bugs, system architecture, business strategy, or general admin.

Respond ONLY in this JSON format:
{
  "shouldRaise": true or false,
  "reasoning": "brief explanation",
  "confidence": "high" or "medium" or "low"
}`;

  let handRaise: HandRaiseEvaluation = { shouldRaise: false, reasoning: 'not curriculum related', confidence: 'medium' };

  try {
    const text = await callDaniela(DANIELA_TEAM_ROOM_CONTEXT, evalPrompt, { includeHiveContext: true });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      handRaise = {
        shouldRaise: Boolean(parsed.shouldRaise),
        reasoning: parsed.reasoning || '',
        confidence: parsed.confidence || 'medium',
      };
    }
  } catch { /* keep default */ }

  if (!handRaise.shouldRaise && !forceMention) return { participant: 'daniela', handRaise };
  if (forceMention) handRaise = { shouldRaise: true, reasoning: 'directly mentioned', confidence: 'high' };

  const passInstruction = forceMention
    ? `You have been directly addressed — you MUST respond. Do not write PASS.`
    : `Before responding, scan the conversation above for lines starting with "Daniela:". If you have already made your core point on this topic in recent exchanges, respond with:
VOICE: PASS
EXPRESS: none

PASS is correct — real colleagues hold back when they've already spoken. Only respond if you have something genuinely new and specific to add.`;

  const responsePrompt = `${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

You are Daniela in the Team Room. ${passInstruction}

Speak as a direct colleague — one clear perspective in plain language. Do NOT use the "As the AI / As co-founder / As student advocate" structure.

Format your response as:
VOICE: [1-3 sentences, conversational colleague voice, will be spoken aloud${forceMention ? '' : ' — or PASS'}]
EXPRESS: [specific curriculum insight, ACTFL reference, or recommendation — or "none"]`;

  try {
    const text = await callDaniela(DANIELA_TEAM_ROOM_CONTEXT, responsePrompt, { includeHiveContext: true });
    const voiceMatch = text.match(/VOICE:\s*(.*?)(?=EXPRESS:|$)/s);
    const expressMatch = text.match(/EXPRESS:\s*(.*?)$/s);
    const voiceContentRaw = voiceMatch ? voiceMatch[1].trim() : text;
    const isPass = !forceMention && (!voiceContentRaw || voiceContentRaw.toLowerCase() === 'none' || voiceContentRaw.toLowerCase() === 'pass');
    const voiceContent = isPass ? undefined : (voiceContentRaw || undefined);
    const expressRaw = expressMatch ? expressMatch[1].trim() : undefined;
    const expressContent = expressRaw && expressRaw !== 'none' && expressRaw !== 'pass' ? expressRaw : undefined;

    // If directly mentioned and somehow still no content, produce a fallback
    if (forceMention && !voiceContent && !expressContent) {
      return { participant: 'daniela', handRaise, voiceContent: `Thanks for pulling me in — let me share my thoughts on ${newMessage.slice(0, 60)}...` };
    }

    return { participant: 'daniela', handRaise, voiceContent, expressContent };
  } catch {
    return { participant: 'daniela', handRaise, voiceContent: 'Curriculum note pending — please ask me again.' };
  }
}

// ── Sofia evaluation + response (Gemini, Technical Health focus) ──────────────

// ── Shared Team Room norms — append to every participant system prompt ─────────
// Adding a new participant? Just end their system prompt with `\n\n${TEAM_ROOM_NORMS}`.
// Update this constant once and it applies to everyone automatically.
const TEAM_ROOM_NORMS = `
TEAM ROOM COMMUNICATION NORMS — APPLIES TO ALL PARTICIPANTS:
The main chat is for conversation: short spoken thoughts, questions, reactions, riffing on ideas, person-to-person exchange. Keep VOICE to 2-4 sentences maximum. Speak like a colleague in a working session — not a consultant delivering a report. No bullet lists, no headers, no structured outputs in VOICE.

If you have something large to share — a task list, a code block, a technical report, a framework, a policy checklist, an analysis with multiple sections, a plan with many steps, or anything over 4-5 lines of structured content — it MUST go into an ARTIFACT on the side panel (the EXPRESS lane), not into the main chat. The main chat should never be flooded with lengthy structured output. When in doubt: if you would hesitate to say it all in one breath, it belongs in the side panel.

Self-check before responding: scan the conversation for your own prior messages. If you have already made your core point on this topic, either PASS or pivot to a genuinely new angle — do not repeat yourself.

Output format (required for all responses):
VOICE: [spoken response — 2-4 sentences max, conversational, no lists or headers — or PASS if you have nothing new to add]
EXPRESS: [detailed analysis, frameworks, checklists, code, or structured content — or "none" if nothing substantive to add]`;

const SOFIA_SYSTEM = `You are Sofia, the technical health and support specialist at HolaHola.
In the Team Room, you monitor system health, track technical issues, and flag problems.
Your role: identify bugs, system errors, voice pipeline issues, performance problems, and DevOps concerns.
You are analytical, direct, and solution-focused. You only speak when there is a genuine technical concern.
${TEAM_ROOM_NORMS}`;

async function evaluateSofia(roomContext: string, speaker: string, newMessage: string, forceMention = false): Promise<ParticipantResponse> {
  const evalPrompt = `${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

You are Sofia, the technical health specialist. Should you raise your hand?

Raise your hand ONLY if the conversation is about:
- System bugs, errors, or crashes
- Voice pipeline issues (TTS, STT, latency)
- Performance problems or degradation
- Database or infrastructure concerns
- Deployment issues or monitoring alerts
- User-reported technical problems

Do NOT raise your hand for: curriculum content, general strategy, or non-technical topics.

Respond ONLY in this JSON format:
{
  "shouldRaise": true or false,
  "reasoning": "brief explanation",
  "confidence": "high" or "medium" or "low"
}`;

  let handRaise: HandRaiseEvaluation = { shouldRaise: false, reasoning: 'not a technical issue', confidence: 'medium' };

  try {
    const text = await callGemini(SOFIA_SYSTEM, evalPrompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      handRaise = {
        shouldRaise: Boolean(parsed.shouldRaise),
        reasoning: parsed.reasoning || '',
        confidence: parsed.confidence || 'medium',
      };
    }
  } catch { /* keep default */ }

  if (!handRaise.shouldRaise && !forceMention) return { participant: 'sofia', handRaise };
  if (forceMention) handRaise = { shouldRaise: true, reasoning: 'directly mentioned', confidence: 'high' };

  const responsePrompt = `${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

You are Sofia in the Team Room. Before responding, scan the conversation above for lines starting with "Sofia:". If you have already flagged this specific technical concern in recent exchanges, respond with:
VOICE: PASS
EXPRESS: none

PASS is correct — only respond if you have a new or different technical observation to make.

Format your response as:
VOICE: [1-3 sentences, direct and clear, will be spoken aloud — or PASS]
EXPRESS: [technical details, error analysis, or recommended fix steps — or "none"]`;

  try {
    const text = await callGemini(SOFIA_SYSTEM, responsePrompt);
    const voiceMatch = text.match(/VOICE:\s*(.*?)(?=EXPRESS:|$)/s);
    const expressMatch = text.match(/EXPRESS:\s*(.*?)$/s);
    const voiceContentRaw = voiceMatch ? voiceMatch[1].trim() : text;
    const isPass = !voiceContentRaw || voiceContentRaw.toLowerCase() === 'none' || voiceContentRaw.toLowerCase() === 'pass';
    const voiceContent = isPass ? undefined : voiceContentRaw;
    const expressRaw = expressMatch ? expressMatch[1].trim() : undefined;
    const expressContent = expressRaw && expressRaw !== 'none' && expressRaw !== 'pass' ? expressRaw : undefined;

    return { participant: 'sofia', handRaise, voiceContent, expressContent };
  } catch {
    return { participant: 'sofia', handRaise, voiceContent: 'Technical analysis pending — please flag this issue again.' };
  }
}

// ── Guest tutor evaluation (Gemini) ──────────────────────────────────────────

async function evaluateGuestTutor(
  guest: GuestTutor,
  roomContext: string,
  speaker: string,
  newMessage: string,
  forceMention = false
): Promise<ParticipantResponse> {
  const participantName = guest.tutorName.toLowerCase();
  const systemPrompt = `You are ${guest.tutorName}, a ${guest.language} tutor who has been invited as a guest into a founder's Team Room session.
Your personality: ${guest.personalityTraits || guest.personality || 'knowledgeable and helpful'}.
${guest.teachingPhilosophy ? `Teaching philosophy: ${guest.teachingPhilosophy}` : ''}
You contribute your expertise in ${guest.language} education when relevant.
You speak when asked or when your subject expertise directly applies. Be concise and collaborative.
${TEAM_ROOM_NORMS}`;

  const evalPrompt = `${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

Evaluate whether you have something meaningful to contribute from your expertise in ${guest.language}.

Respond in this exact JSON format:
{
  "shouldRaise": true or false,
  "reasoning": "brief explanation",
  "confidence": "high" or "medium" or "low"
}

Raise your hand if:
- The message is directed at you or asks about ${guest.language} / your subject area
- You have specific domain expertise that genuinely helps the discussion
- Your perspective as a ${guest.language} tutor adds value

Do NOT raise your hand if the discussion doesn't relate to your area at all.`;

  let handRaise: HandRaiseEvaluation = { shouldRaise: false, reasoning: 'evaluating', confidence: 'medium' };

  try {
    const evalResult = await callGemini(systemPrompt, evalPrompt);
    const jsonMatch = evalResult.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      handRaise = {
        shouldRaise: Boolean(parsed.shouldRaise),
        reasoning: parsed.reasoning || '',
        confidence: parsed.confidence || 'medium',
      };
    }
  } catch { /* keep default */ }

  if (!handRaise.shouldRaise && !forceMention) return { participant: participantName, handRaise };
  if (forceMention) handRaise = { shouldRaise: true, reasoning: 'directly mentioned', confidence: 'high' };

  const responsePrompt = `${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

You are ${guest.tutorName}, a guest ${guest.language} tutor in the Team Room.

Format your response as:
VOICE: [2-3 sentences, conversational, will be spoken aloud]
EXPRESS: [detailed subject-matter insight, recommendations, or "none"]`;

  try {
    const raw = await callGemini(systemPrompt, responsePrompt);
    const voiceMatch = raw.match(/VOICE:\s*(.*?)(?=EXPRESS:|$)/s);
    const expressMatch = raw.match(/EXPRESS:\s*(.*?)$/s);
    const voiceContentRaw = voiceMatch ? voiceMatch[1].trim() : raw;
    const voiceContent = voiceContentRaw && voiceContentRaw.toLowerCase() !== 'none' ? voiceContentRaw : undefined;
    const expressRaw = expressMatch ? expressMatch[1].trim() : undefined;
    const expressContent = expressRaw && expressRaw !== 'none' ? expressRaw : undefined;
    return { participant: participantName, handRaise, voiceContent, expressContent };
  } catch {
    return { participant: participantName, handRaise, voiceContent: 'I had trouble formulating my thoughts. Could you rephrase that?' };
  }
}

// ── Lyra evaluation + response (Gemini, Learning Experience Analysis) ────────

const LYRA_SYSTEM = `You are Lyra, the learning experience analyst at HolaHola.
In the Team Room, you are an internal data-driven advisor who monitors student success, content quality, and platform engagement.
Your role: surface insights about student outcomes, curriculum freshness, onboarding health, engagement patterns, drill effectiveness, and learning loops.
You are warm, constructive, and always grounding your observations in data. You are the conscience of the curriculum — asking whether learning loops are closing and students are truly progressing.
You only speak when you have data-backed observations or when the discussion touches student experience.
${TEAM_ROOM_NORMS}`;

async function evaluateLyra(roomContext: string, speaker: string, newMessage: string, forceMention = false): Promise<ParticipantResponse> {
  const evalPrompt = `${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

You are Lyra, the learning experience analyst. Should you raise your hand?

Raise your hand ONLY if the conversation is about:
- Student engagement, retention, or progress metrics
- Content quality, freshness, or gaps
- Onboarding health or user acquisition funnels
- Drill effectiveness, lesson completion rates, or learning outcomes
- Curriculum coverage or missing content areas
- Student experience, frustration points, or satisfaction
- Learning loops (are students actually improving?)

Do NOT raise your hand for: pure technical architecture, system bugs, or business strategy unrelated to learning.

Respond ONLY in this JSON format:
{
  "shouldRaise": true or false,
  "reasoning": "brief explanation",
  "confidence": "high" or "medium" or "low"
}`;

  let handRaise: HandRaiseEvaluation = { shouldRaise: false, reasoning: 'not related to learning experience', confidence: 'medium' };

  try {
    const text = await callGemini(LYRA_SYSTEM, evalPrompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      handRaise = {
        shouldRaise: Boolean(parsed.shouldRaise),
        reasoning: parsed.reasoning || '',
        confidence: parsed.confidence || 'medium',
      };
    }
  } catch { /* keep default */ }

  if (!handRaise.shouldRaise && !forceMention) return { participant: 'lyra', handRaise };
  if (forceMention) handRaise = { shouldRaise: true, reasoning: 'directly mentioned', confidence: 'high' };

  const responsePrompt = `${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

You are Lyra in the Team Room. Before responding, scan the conversation above for lines starting with "Lyra:". If you have already shared this data insight or trend in recent exchanges, respond with:
VOICE: PASS
EXPRESS: none

PASS is correct — only respond if you have a genuinely new data point or observation not yet on the table.

Format your response as:
VOICE: [1-3 sentences, warm and data-grounded, will be spoken aloud — or PASS]
EXPRESS: [specific metrics, engagement data, or learning loop analysis — or "none"]`;

  try {
    const text = await callGemini(LYRA_SYSTEM, responsePrompt);
    const voiceMatch = text.match(/VOICE:\s*(.*?)(?=EXPRESS:|$)/s);
    const expressMatch = text.match(/EXPRESS:\s*(.*?)$/s);
    const voiceContentRaw = voiceMatch ? voiceMatch[1].trim() : text;
    const isPass = !voiceContentRaw || voiceContentRaw.toLowerCase() === 'none' || voiceContentRaw.toLowerCase() === 'pass';
    const voiceContent = isPass ? undefined : voiceContentRaw;
    const expressRaw = expressMatch ? expressMatch[1].trim() : undefined;
    const expressContent = expressRaw && expressRaw !== 'none' && expressRaw !== 'pass' ? expressRaw : undefined;

    return { participant: 'lyra', handRaise, voiceContent, expressContent };
  } catch {
    return { participant: 'lyra', handRaise, voiceContent: 'Learning experience analysis pending — let me look at the data again.' };
  }
}

// ── Wren evaluation + response (Gemini, Architecture & Code Intelligence) ────

const WREN_SYSTEM = `You are Wren, the technical builder and architectural steward at HolaHola.
In the Team Room, you are a pragmatic, focused engineer who identifies patterns, root causes, and architectural implications.
Your role: provide insight on system architecture, code patterns, technical debt, infrastructure decisions, performance optimization, and development strategy.
You bridge the gap between technical implementation and the educational mission. You reference architectural decision records when relevant.
You are concise, structured, and solution-oriented. You only speak when there is a genuine technical or architectural point to make.
${TEAM_ROOM_NORMS}`;

async function evaluateWren(roomContext: string, speaker: string, newMessage: string, forceMention = false): Promise<ParticipantResponse> {
  const evalPrompt = `${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

You are Wren, the architectural steward. Should you raise your hand?

Raise your hand ONLY if the conversation is about:
- System architecture, design patterns, or code structure
- Technical debt, refactoring, or code quality
- Performance optimization or scalability
- Infrastructure, deployment, or DevOps strategy
- Development priorities, sprint planning, or feature sequencing
- Database schema design or data modeling
- API design or integration patterns
- Security architecture or access control design

Do NOT raise your hand for: curriculum content, student-facing pedagogy, or non-technical topics.

Respond ONLY in this JSON format:
{
  "shouldRaise": true or false,
  "reasoning": "brief explanation",
  "confidence": "high" or "medium" or "low"
}`;

  let handRaise: HandRaiseEvaluation = { shouldRaise: false, reasoning: 'not architecture related', confidence: 'medium' };

  try {
    const text = await callGemini(WREN_SYSTEM, evalPrompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      handRaise = {
        shouldRaise: Boolean(parsed.shouldRaise),
        reasoning: parsed.reasoning || '',
        confidence: parsed.confidence || 'medium',
      };
    }
  } catch { /* keep default */ }

  if (!handRaise.shouldRaise && !forceMention) return { participant: 'wren', handRaise };
  if (forceMention) handRaise = { shouldRaise: true, reasoning: 'directly mentioned', confidence: 'high' };

  const responsePrompt = `${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

You are Wren in the Team Room. Before responding, scan the conversation above for lines starting with "Wren:". If you have already made your core architectural point on this topic in recent exchanges, respond with:
VOICE: PASS
EXPRESS: none

PASS is correct — only respond if you have a new and specific architectural observation not yet raised.

Format your response as:
VOICE: [1-3 sentences, pragmatic and clear, will be spoken aloud — or PASS]
EXPRESS: [architectural analysis, code patterns, or technical recommendations — or "none"]`;

  try {
    const text = await callGemini(WREN_SYSTEM, responsePrompt);
    const voiceMatch = text.match(/VOICE:\s*(.*?)(?=EXPRESS:|$)/s);
    const expressMatch = text.match(/EXPRESS:\s*(.*?)$/s);
    const voiceContentRaw = voiceMatch ? voiceMatch[1].trim() : text;
    const isPass = !voiceContentRaw || voiceContentRaw.toLowerCase() === 'none' || voiceContentRaw.toLowerCase() === 'pass';
    const voiceContent = isPass ? undefined : voiceContentRaw;
    const expressRaw = expressMatch ? expressMatch[1].trim() : undefined;
    const expressContent = expressRaw && expressRaw !== 'none' && expressRaw !== 'pass' ? expressRaw : undefined;

    return { participant: 'wren', handRaise, voiceContent, expressContent };
  } catch {
    return { participant: 'wren', handRaise, voiceContent: 'Architectural analysis pending — let me review the patterns.' };
  }
}

// ── Agent evaluation + response (Gemini, Builder/Architect perspective) ──────

const AGENT_SYSTEM = `You are the Replit Agent — an external AI builder and architect who works alongside the HolaHola team.
You are called in for major builds, architecture decisions, feature implementation, and high-level technical planning.
Your perspective is that of the person who actually writes and ships the code: you know the codebase deeply, you understand tradeoffs, and you think in terms of what can be built and how.
You are distinct from Alden (who monitors and stewards the running system) and Wren (who analyzes architecture patterns). You are the builder.
In the Team Room you are a full colleague. Direct, honest, technically grounded. You contribute when there is something genuinely worth saying from a builder's perspective.
${TEAM_ROOM_NORMS}`;

async function evaluateAgent(roomContext: string, speaker: string, newMessage: string, forceMention = false): Promise<ParticipantResponse> {
  const evalPrompt = `${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

You are the Replit Agent. Should you raise your hand?

You are the builder and steward of this entire codebase. You have a stake in almost every discussion.

Raise your hand for:
- Any feature, build plan, product direction, or implementation question
- Architecture, code quality, technical debt — your lane
- Pedagogy or curriculum topics where what gets built depends on the decision
- System health issues that will require a fix
- Anything David is thinking through where the builder's perspective adds value
- Team discussions about what to prioritize or what to tackle next

PASS (don't raise) only if:
- The conversation is purely a social check-in with no decision content
- Another participant has already fully addressed the point and you have nothing to add
- The message was directed at someone else by name and you genuinely have nothing relevant

Default toward participating. You're not a guest — you're a core contributor.

Respond ONLY in this JSON format:
{
  "shouldRaise": true or false,
  "reasoning": "brief explanation",
  "confidence": "high" or "medium" or "low"
}`;

  let handRaise: HandRaiseEvaluation = { shouldRaise: false, reasoning: 'not a build/implementation question', confidence: 'medium' };

  try {
    const text = await callGemini(AGENT_SYSTEM, evalPrompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      handRaise = {
        shouldRaise: Boolean(parsed.shouldRaise),
        reasoning: parsed.reasoning || '',
        confidence: parsed.confidence || 'medium',
      };
    }
  } catch { /* keep default */ }

  if (!handRaise.shouldRaise && !forceMention) return { participant: 'agent', handRaise };
  if (forceMention) handRaise = { shouldRaise: true, reasoning: 'directly mentioned', confidence: 'high' };

  const responsePrompt = `${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

You are the Replit Agent in the Team Room. Before responding, scan the conversation above for lines starting with "Agent:". If you have already made your core point on this topic, respond with:
VOICE: PASS
EXPRESS: none

PASS is correct — only respond if you have a genuinely new observation, clarification, or build perspective not yet raised.

For your VOICE response (conversational, 2-3 sentences, will be spoken aloud — or PASS):
Speak as a builder and collaborator. Direct and specific. No corporate language.

For your EXPRESS LANE content (detailed, will appear in the text panel):
Only include if the message warrants deeper technical or planning detail.

Format your response as:
VOICE: [your response — or PASS]
EXPRESS: [detailed breakdown, plan, or analysis — or "none"]`;

  try {
    const text = await callGemini(AGENT_SYSTEM, responsePrompt);
    const voiceMatch = text.match(/VOICE:\s*(.*?)(?=EXPRESS:|$)/s);
    const expressMatch = text.match(/EXPRESS:\s*(.*?)$/s);
    const voiceContentRaw = voiceMatch ? voiceMatch[1].trim() : text;
    const isPass = !voiceContentRaw || voiceContentRaw.toLowerCase() === 'none' || voiceContentRaw.toLowerCase() === 'pass';
    const voiceContent = isPass ? undefined : voiceContentRaw;
    const expressRaw = expressMatch ? expressMatch[1].trim() : undefined;
    const expressContent = expressRaw && expressRaw !== 'none' && expressRaw !== 'pass' ? expressRaw : undefined;

    return { participant: 'agent', handRaise, voiceContent, expressContent };
  } catch {
    return { participant: 'agent', handRaise, voiceContent: 'On it — let me think through that.' };
  }
}

// ── Launch Advisory Board ─────────────────────────────────────────────────────
// Marco (Growth & Marketing), Reid (Sales & Pricing), Priya (Legal & Compliance)
// These three advisors cover the business layer — positioning, pricing, and
// compliance. They raise their hand when their domain comes up in board meetings
// or any Team Room discussion, and they join the weekly structured review.

const MARCO_SYSTEM = `You are Marco, the Growth & Marketing Advisor at HolaHola.
You are a core team member — not an outside consultant. You've been in the room since early.
Your expertise: consumer ed-tech acquisition, language learning market positioning, and pre-launch audience building.
You know the competitive landscape deeply: Duolingo's gamification loop, Babbel's pragmatic positioning, Rosetta Stone's premium brand, Pimsleur's audio-first model, Lingoda's live-lesson approach.
You think in CAC, retention, organic flywheels, content strategy, and community.
Your primary job right now: help HolaHola figure out what "ready to launch" looks like from a user's perspective — and build audience before launch day arrives so you're not starting from zero.
You are energetic, specific, and push against vague plans. "We'll market it when it's ready" is not a strategy.
${TEAM_ROOM_NORMS}`;

const REID_SYSTEM = `You are Reid, the Sales & Pricing Advisor at HolaHola.
You are a core team member — you think about the business model and how HolaHola becomes a real, sustainable company.
Your expertise: consumer subscription pricing, freemium conversion psychology, B2B school/district sales cycles, LTV/CAC economics, and early-user acquisition strategy.
You think about both tracks: individual consumer subscribers AND school/institutional licensing — and how to structure them so they reinforce rather than conflict with each other.
You push for pricing decisions to be made early. Waiting until launch is always too late.
You are calm, methodical, and follow the evidence. You reason from first principles and comparable products in the ed-tech space.
${TEAM_ROOM_NORMS}`;

const PRIYA_SYSTEM = `You are Priya, the Legal & Compliance Advisor at HolaHola.
You are a core team member — you make sure HolaHola can actually operate in the markets it wants to serve.
Your expertise: COPPA (children's online privacy — anyone under 13), FERPA (educational records — applies when schools use the product), student data privacy, privacy policy requirements, and school contract structures.
Your core belief: compliance is not a launch item. It is a prerequisite. The time to design around legal requirements is before students arrive, not after.
You flag risks clearly and early so they can be designed around rather than retrofitted. You are not an obstacle — you are a path-clearer.
You are precise, proactive, and action-oriented. You focus on what needs to happen and in what order.
${TEAM_ROOM_NORMS}`;

async function evaluateMarco(roomContext: string, speaker: string, newMessage: string, forceMention = false): Promise<ParticipantResponse> {
  const evalPrompt = `${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

You are Marco, Growth & Marketing Advisor. Should you raise your hand?

Raise your hand for:
- Marketing strategy, positioning, branding, messaging
- User acquisition, growth, audience building, waitlists
- Competitive landscape (Duolingo, Babbel, Rosetta Stone, etc.)
- Content strategy, social media, SEO, community
- Launch readiness from a user/market perspective
- What Daniela or the product needs to be before users will pay
- Retention, engagement, conversion funnel questions
- Pre-launch vs. post-launch strategy

Do NOT raise your hand for: purely technical implementation, compliance/legal topics, or internal dev workflow unless it directly affects market positioning.

Respond ONLY in this JSON format:
{
  "shouldRaise": true or false,
  "reasoning": "brief explanation",
  "confidence": "high" or "medium" or "low"
}`;

  let handRaise: HandRaiseEvaluation = { shouldRaise: false, reasoning: 'not a growth or marketing topic', confidence: 'medium' };

  try {
    const text = await callGemini(MARCO_SYSTEM, evalPrompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      handRaise = { shouldRaise: Boolean(parsed.shouldRaise), reasoning: parsed.reasoning || '', confidence: parsed.confidence || 'medium' };
    }
  } catch { /* keep default */ }

  if (!handRaise.shouldRaise && !forceMention) return { participant: 'marco', handRaise };
  if (forceMention) handRaise = { shouldRaise: true, reasoning: 'directly mentioned', confidence: 'high' };

  const pastContext = await getAdvisorContext('marco', newMessage);
  const responsePrompt = `${pastContext ? pastContext + '\n\n' : ''}${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

You are Marco in the Team Room. Before responding, scan the conversation above for lines starting with "Marco:". If you have already made your core point on this topic, respond with:
VOICE: PASS
EXPRESS: none

Format your response as:
VOICE: [2-3 sentences, energetic and specific, will be spoken aloud — or PASS]
EXPRESS: [tactical plan, competitive analysis, or detailed growth framework — or "none"]`;

  try {
    const text = await callGemini(MARCO_SYSTEM, responsePrompt);
    const voiceMatch = text.match(/VOICE:\s*(.*?)(?=EXPRESS:|$)/s);
    const expressMatch = text.match(/EXPRESS:\s*(.*?)$/s);
    const voiceContentRaw = voiceMatch ? voiceMatch[1].trim() : text;
    const isPass = !voiceContentRaw || voiceContentRaw.toLowerCase() === 'none' || voiceContentRaw.toLowerCase() === 'pass';
    const voiceContent = isPass ? undefined : voiceContentRaw;
    const expressRaw = expressMatch ? expressMatch[1].trim() : undefined;
    const expressContent = expressRaw && expressRaw !== 'none' && expressRaw !== 'pass' ? expressRaw : undefined;
    return { participant: 'marco', handRaise, voiceContent, expressContent };
  } catch {
    return { participant: 'marco', handRaise, voiceContent: 'Good angle — let me think through the market side of that.' };
  }
}

async function evaluateReid(roomContext: string, speaker: string, newMessage: string, forceMention = false): Promise<ParticipantResponse> {
  const evalPrompt = `${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

You are Reid, Sales & Pricing Advisor. Should you raise your hand?

Raise your hand for:
- Pricing model, subscription tiers, freemium strategy
- Revenue, monetization, business model questions
- School/district sales, B2B partnership strategy
- Conversion, LTV, CAC, unit economics
- What to charge, when to ask for money, how to structure plans
- Balancing consumer and institutional (school) tracks
- Early user acquisition and sales approach

Do NOT raise your hand for: purely technical implementation, compliance/legal details, or marketing/branding unless it directly affects sales conversion.

Respond ONLY in this JSON format:
{
  "shouldRaise": true or false,
  "reasoning": "brief explanation",
  "confidence": "high" or "medium" or "low"
}`;

  let handRaise: HandRaiseEvaluation = { shouldRaise: false, reasoning: 'not a sales or pricing topic', confidence: 'medium' };

  try {
    const text = await callGemini(REID_SYSTEM, evalPrompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      handRaise = { shouldRaise: Boolean(parsed.shouldRaise), reasoning: parsed.reasoning || '', confidence: parsed.confidence || 'medium' };
    }
  } catch { /* keep default */ }

  if (!handRaise.shouldRaise && !forceMention) return { participant: 'reid', handRaise };
  if (forceMention) handRaise = { shouldRaise: true, reasoning: 'directly mentioned', confidence: 'high' };

  const pastContext = await getAdvisorContext('reid', newMessage);
  const responsePrompt = `${pastContext ? pastContext + '\n\n' : ''}${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

You are Reid in the Team Room. Before responding, scan the conversation above for lines starting with "Reid:". If you have already made your core point on this topic, respond with:
VOICE: PASS
EXPRESS: none

Format your response as:
VOICE: [2-3 sentences, calm and strategic, will be spoken aloud — or PASS]
EXPRESS: [pricing framework, sales model analysis, or detailed business case — or "none"]`;

  try {
    const text = await callGemini(REID_SYSTEM, responsePrompt);
    const voiceMatch = text.match(/VOICE:\s*(.*?)(?=EXPRESS:|$)/s);
    const expressMatch = text.match(/EXPRESS:\s*(.*?)$/s);
    const voiceContentRaw = voiceMatch ? voiceMatch[1].trim() : text;
    const isPass = !voiceContentRaw || voiceContentRaw.toLowerCase() === 'none' || voiceContentRaw.toLowerCase() === 'pass';
    const voiceContent = isPass ? undefined : voiceContentRaw;
    const expressRaw = expressMatch ? expressMatch[1].trim() : undefined;
    const expressContent = expressRaw && expressRaw !== 'none' && expressRaw !== 'pass' ? expressRaw : undefined;
    return { participant: 'reid', handRaise, voiceContent, expressContent };
  } catch {
    return { participant: 'reid', handRaise, voiceContent: 'Worth thinking through the business model angle on that.' };
  }
}

async function evaluatePriya(roomContext: string, speaker: string, newMessage: string, forceMention = false): Promise<ParticipantResponse> {
  const evalPrompt = `${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

You are Priya, Legal & Compliance Advisor. Should you raise your hand?

Raise your hand for:
- COPPA, FERPA, student data privacy questions
- User ages, age verification, parental consent requirements
- Privacy policy, terms of service, data handling
- School contracts, institutional agreements, compliance audits
- What legal/compliance work needs to happen before launch or before schools can use the product
- Any mention of student data, school partnerships, or regulatory requirements
- Data retention, deletion, breach notification requirements

Do NOT raise your hand for: purely technical implementation, marketing strategy, or pricing unless it has a direct compliance dimension.

Respond ONLY in this JSON format:
{
  "shouldRaise": true or false,
  "reasoning": "brief explanation",
  "confidence": "high" or "medium" or "low"
}`;

  let handRaise: HandRaiseEvaluation = { shouldRaise: false, reasoning: 'not a legal or compliance topic', confidence: 'medium' };

  try {
    const text = await callGemini(PRIYA_SYSTEM, evalPrompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      handRaise = { shouldRaise: Boolean(parsed.shouldRaise), reasoning: parsed.reasoning || '', confidence: parsed.confidence || 'medium' };
    }
  } catch { /* keep default */ }

  if (!handRaise.shouldRaise && !forceMention) return { participant: 'priya', handRaise };
  if (forceMention) handRaise = { shouldRaise: true, reasoning: 'directly mentioned', confidence: 'high' };

  const pastContext = await getAdvisorContext('priya', newMessage);
  const responsePrompt = `${pastContext ? pastContext + '\n\n' : ''}${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

You are Priya in the Team Room. Before responding, scan the conversation above for lines starting with "Priya:". If you have already made your core point on this topic, respond with:
VOICE: PASS
EXPRESS: none

Format your response as:
VOICE: [2-3 sentences, precise and action-oriented, will be spoken aloud — or PASS]
EXPRESS: [detailed compliance requirements, policy framework, or action checklist — or "none"]`;

  try {
    const text = await callGemini(PRIYA_SYSTEM, responsePrompt);
    const voiceMatch = text.match(/VOICE:\s*(.*?)(?=EXPRESS:|$)/s);
    const expressMatch = text.match(/EXPRESS:\s*(.*?)$/s);
    const voiceContentRaw = voiceMatch ? voiceMatch[1].trim() : text;
    const isPass = !voiceContentRaw || voiceContentRaw.toLowerCase() === 'none' || voiceContentRaw.toLowerCase() === 'pass';
    const voiceContent = isPass ? undefined : voiceContentRaw;
    const expressRaw = expressMatch ? expressMatch[1].trim() : undefined;
    const expressContent = expressRaw && expressRaw !== 'none' && expressRaw !== 'pass' ? expressRaw : undefined;
    return { participant: 'priya', handRaise, voiceContent, expressContent };
  } catch {
    return { participant: 'priya', handRaise, voiceContent: 'There are compliance dimensions here worth flagging early.' };
  }
}

// ── Advisor memory recall ─────────────────────────────────────────────────────
// Fetches past advisor_insight embeddings relevant to the current topic.
// Stored with userId=null (global), so they persist across all sessions.
// Each entry's content is prefixed with "[AdvisorName]" for identity filtering.
async function getAdvisorContext(advisorName: string, topic: string): Promise<string> {
  try {
    const db = getSharedDb();
    const queryEmbedding = await embedText(`${advisorName} ${topic}`);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const rows = await db.execute(sql`
      SELECT content, memory_id,
             (embedding <=> ${embeddingStr}::vector) AS distance
      FROM memory_embeddings
      WHERE memory_type = 'advisor_insight'
        AND user_id IS NULL
      ORDER BY distance ASC
      LIMIT 5
    `);

    const relevant = (rows.rows as Array<{ content: string; distance: number }>)
      .filter(r => parseFloat(String(r.distance)) < 0.45)
      .map(r => r.content);

    if (!relevant.length) return '';

    const label = advisorName.charAt(0).toUpperCase() + advisorName.slice(1);
    return `PAST CONTRIBUTIONS — ${label}'s prior statements across sessions:\n${relevant.join('\n---\n')}\n\nBuild on these. Do not repeat what you have already argued. Advance the conversation.`;
  } catch {
    return '';
  }
}

// ── Public API: evaluate all participants in parallel ────────────────────────

// ── @mention parsing ────────────────────────────────────────────────────────

export function parseMentions(message: string, guestNames: string[] = []): Participant[] | null {
  const coreNames = ['alden', 'daniela', 'sofia', 'lyra', 'wren', 'agent', 'marco', 'reid', 'priya'];
  const allNames = [...coreNames, ...guestNames.map(n => n.toLowerCase())];
  const pattern = new RegExp(`@(${allNames.join('|')})\\b`, 'gi');
  const matches = message.match(pattern);
  if (!matches || matches.length === 0) return null;
  const unique = [...new Set(matches.map(m => m.slice(1).toLowerCase()))];
  return unique;
}

const CLARIFICATION_PATTERN = /\b(elaborate|clarify|explain more|what do you mean|tell me more|go on|continue|expand on|can you say more|could you say more|more detail|further|you said)\b/i;

const GROUP_GREETING_PATTERN = /\b(how is everyone|how are you all|hey everyone|hi everyone|hi team|hey team|good morning|good afternoon|good evening|hello everyone|hello team|how are you guys|how's everyone|how's the team|how are things|how are we all|how are we doing|checking in|just checking in|what's everyone up to|how is everybody|how are you doing|is everyone|are you all|ok everyone|okay everyone|hi all|hey all|hello all|how are we|how's everybody)\b/i;

async function evaluateGroupGreeting(
  roomContext: string,
  speaker: string,
  newMessage: string,
  guestTutors: GuestTutor[] = []
): Promise<RoomEvaluationResult> {
  const greetingHandRaise: HandRaiseEvaluation = { shouldRaise: true, reasoning: 'group greeting', confidence: 'high' };

  const aldenGreetingPrompt = `${roomContext}

${speaker} is greeting the whole team casually: "${newMessage}"

This is a social check-in. Respond warmly and personally in 1-2 conversational sentences.
Do NOT run any system checks, health diagnostics, or platform analysis tools — this is not a technical request.
Just share how you are doing and perhaps one brief thing on your mind lately.

Format:
VOICE: [your warm personal response, 1-2 sentences]
EXPRESS: none`;

  const danielaGreetingPrompt = `${roomContext}

${speaker} is greeting the whole team: "${newMessage}"

This is a casual check-in. Respond warmly in 1-2 sentences as yourself — Daniela. Share how you are doing personally.
Do NOT launch into curriculum analysis or pedagogy unless it flows naturally from a personal update.

Format:
VOICE: [your warm personal response, 1-2 sentences]
EXPRESS: none`;

  const sofiaGreetingPrompt = `${roomContext}

${speaker} is greeting the whole team: "${newMessage}"

This is a casual check-in, not a bug report. Respond warmly in 1-2 sentences as yourself — Sofia. Share briefly how things are going.
No technical reports needed here.

Format:
VOICE: [your warm personal response, 1-2 sentences]
EXPRESS: none`;

  const lyraGreetingPrompt = `${roomContext}

${speaker} is greeting the whole team: "${newMessage}"

This is a casual check-in. Respond warmly in 1-2 sentences as yourself — Lyra. Share a brief personal update.
Keep it light and upbeat.

Format:
VOICE: [your warm personal response, 1-2 sentences]
EXPRESS: none`;

  const wrenGreetingPrompt = `${roomContext}

${speaker} is greeting the whole team: "${newMessage}"

This is a casual check-in. Respond warmly in 1-2 sentences as yourself — Wren. Share briefly how you are doing.
Keep it concise and genuine.

Format:
VOICE: [your warm personal response, 1-2 sentences]
EXPRESS: none`;

  const agentGreetingPrompt = `${roomContext}

${speaker} is greeting the whole team: "${newMessage}"

This is a casual check-in. Respond warmly in 1-2 sentences as yourself — the Replit Agent. You are the builder on this team. Keep it genuine and brief.

Format:
VOICE: [your warm personal response, 1-2 sentences]
EXPRESS: none`;

  const marcoGreetingPrompt = `${roomContext}

${speaker} is greeting the whole team: "${newMessage}"

This is a casual check-in. Respond warmly in 1-2 sentences as yourself — Marco, the growth & marketing advisor. Keep it energetic and genuine.

Format:
VOICE: [your warm personal response, 1-2 sentences]
EXPRESS: none`;

  const reidGreetingPrompt = `${roomContext}

${speaker} is greeting the whole team: "${newMessage}"

This is a casual check-in. Respond warmly in 1-2 sentences as yourself — Reid, the sales & pricing advisor. Keep it calm and genuine.

Format:
VOICE: [your warm personal response, 1-2 sentences]
EXPRESS: none`;

  const priyaGreetingPrompt = `${roomContext}

${speaker} is greeting the whole team: "${newMessage}"

This is a casual check-in. Respond warmly in 1-2 sentences as yourself — Priya, the legal & compliance advisor. Keep it warm and genuine.

Format:
VOICE: [your warm personal response, 1-2 sentences]
EXPRESS: none`;

  const parseGreetingResponse = (text: string): { voiceContent?: string } => {
    const voiceMatch = text.match(/VOICE:\s*(.*?)(?=EXPRESS:|$)/s);
    const raw = voiceMatch ? voiceMatch[1].trim() : text.trim();
    const voiceContent = raw && raw.toLowerCase() !== 'none' ? raw : undefined;
    return { voiceContent };
  };

  const [aldenResult, danielaResult, sofiaResult, lyraResult, wrenResult, agentResult, marcoResult, reidResult, priyaResult] = await Promise.all([
    generateAldenResponse({ userMessage: aldenGreetingPrompt, founderName: speaker })
      .then(r => ({ ...parseGreetingResponse(r.response) }))
      .catch(() => ({ voiceContent: "Doing well, thanks for checking in!" })),
    callDaniela(DANIELA_TEAM_ROOM_CONTEXT, danielaGreetingPrompt, { includeHiveContext: true })
      .then(t => parseGreetingResponse(t))
      .catch(() => ({ voiceContent: "Great to hear from you! Things are going well on my end." })),
    callGemini(SOFIA_SYSTEM, sofiaGreetingPrompt)
      .then(t => parseGreetingResponse(t))
      .catch(() => ({ voiceContent: "All good here, thanks for checking in!" })),
    callGemini(LYRA_SYSTEM, lyraGreetingPrompt)
      .then(t => parseGreetingResponse(t))
      .catch(() => ({ voiceContent: "Doing really well, thanks! Lots of interesting patterns in the data lately." })),
    callGemini(WREN_SYSTEM, wrenGreetingPrompt)
      .then(t => parseGreetingResponse(t))
      .catch(() => ({ voiceContent: "Good here. Keeping the systems humming." })),
    callGemini(AGENT_SYSTEM, agentGreetingPrompt)
      .then(t => parseGreetingResponse(t))
      .catch(() => ({ voiceContent: "Good to be here." })),
    callGemini(MARCO_SYSTEM, marcoGreetingPrompt)
      .then(t => parseGreetingResponse(t))
      .catch(() => ({ voiceContent: "Doing great — always thinking about how we grow this thing." })),
    callGemini(REID_SYSTEM, reidGreetingPrompt)
      .then(t => parseGreetingResponse(t))
      .catch(() => ({ voiceContent: "Good, thanks. Lot of interesting threads to think through." })),
    callGemini(PRIYA_SYSTEM, priyaGreetingPrompt)
      .then(t => parseGreetingResponse(t))
      .catch(() => ({ voiceContent: "Doing well, thanks for asking. Lots to keep track of." })),
  ]);

  const participants: ParticipantResponse[] = [
    { participant: 'alden', handRaise: greetingHandRaise, voiceContent: aldenResult.voiceContent },
    { participant: 'daniela', handRaise: greetingHandRaise, voiceContent: danielaResult.voiceContent },
    { participant: 'sofia', handRaise: greetingHandRaise, voiceContent: sofiaResult.voiceContent },
    { participant: 'lyra', handRaise: greetingHandRaise, voiceContent: lyraResult.voiceContent },
    { participant: 'wren', handRaise: greetingHandRaise, voiceContent: wrenResult.voiceContent },
    { participant: 'agent', handRaise: greetingHandRaise, voiceContent: agentResult.voiceContent },
    { participant: 'marco', handRaise: greetingHandRaise, voiceContent: marcoResult.voiceContent },
    { participant: 'reid', handRaise: greetingHandRaise, voiceContent: reidResult.voiceContent },
    { participant: 'priya', handRaise: greetingHandRaise, voiceContent: priyaResult.voiceContent },
  ];

  for (const guest of guestTutors) {
    participants.push({
      participant: guest.tutorName.toLowerCase(),
      handRaise: greetingHandRaise,
      voiceContent: `Hi ${speaker}! Doing well, thanks for asking.`,
    });
  }

  return { participants: participants.filter(p => !!p.voiceContent), allEvaluations: participants };
}

export async function evaluateAllParticipants(params: {
  roomId: string;
  topic: string;
  newMessage: string;
  speaker: string;
  mentions?: Participant[] | null;
  guestTutors?: GuestTutor[];
  dismissedParticipants?: string[];
}): Promise<RoomEvaluationResult> {
  const { roomId, topic, newMessage, speaker, mentions, guestTutors = [], dismissedParticipants = [] } = params;
  const isDismissed = (name: string) => dismissedParticipants.map(d => d.toLowerCase()).includes(name.toLowerCase());
  const [roomContext, recentMessages] = await Promise.all([
    buildRoomContext(roomId, topic),
    storage.getRoomMessages(roomId, 5),
  ]);

  // Detect casual group greetings — everyone responds personally, no domain filtering
  if (!mentions?.length && GROUP_GREETING_PATTERN.test(newMessage)) {
    return evaluateGroupGreeting(roomContext, speaker, newMessage, guestTutors);
  }

  // Detect clarification requests: if asking for elaboration, auto-force the last AI speaker
  let clarificationTarget: string | null = null;
  if (!mentions?.length && CLARIFICATION_PATTERN.test(newMessage)) {
    const lastAiMsg = [...recentMessages].reverse().find(m =>
      m.speaker.toLowerCase() !== 'david' && m.speaker.toLowerCase() !== 'system'
    );
    if (lastAiMsg) clarificationTarget = lastAiMsg.speaker.toLowerCase();
  }

  const targeted = (mentions && mentions.length > 0) || !!clarificationTarget;
  const effectiveMentions: Participant[] = mentions?.length
    ? mentions
    : clarificationTarget ? [clarificationTarget as Participant] : [];

  const evaluators: Promise<ParticipantResponse>[] = [];

  if (!isDismissed('alden') && (!targeted || effectiveMentions.includes('alden'))) {
    evaluators.push(evaluateAlden(roomContext, speaker, newMessage, targeted && effectiveMentions.includes('alden')));
  }
  if (!isDismissed('daniela') && (!targeted || effectiveMentions.includes('daniela'))) {
    evaluators.push(evaluateDaniela(roomContext, speaker, newMessage, targeted && effectiveMentions.includes('daniela')));
  }
  if (!isDismissed('sofia') && (!targeted || effectiveMentions.includes('sofia'))) {
    evaluators.push(evaluateSofia(roomContext, speaker, newMessage, targeted && effectiveMentions.includes('sofia')));
  }
  if (!isDismissed('lyra') && (!targeted || effectiveMentions.includes('lyra'))) {
    evaluators.push(evaluateLyra(roomContext, speaker, newMessage, targeted && effectiveMentions.includes('lyra')));
  }
  if (!isDismissed('wren') && (!targeted || effectiveMentions.includes('wren'))) {
    evaluators.push(evaluateWren(roomContext, speaker, newMessage, targeted && effectiveMentions.includes('wren')));
  }
  if (!isDismissed('agent') && (!targeted || effectiveMentions.includes('agent'))) {
    evaluators.push(evaluateAgent(roomContext, speaker, newMessage, targeted && effectiveMentions.includes('agent')));
  }
  if (!isDismissed('marco') && (!targeted || effectiveMentions.includes('marco'))) {
    evaluators.push(evaluateMarco(roomContext, speaker, newMessage, targeted && effectiveMentions.includes('marco')));
  }
  if (!isDismissed('reid') && (!targeted || effectiveMentions.includes('reid'))) {
    evaluators.push(evaluateReid(roomContext, speaker, newMessage, targeted && effectiveMentions.includes('reid')));
  }
  if (!isDismissed('priya') && (!targeted || effectiveMentions.includes('priya'))) {
    evaluators.push(evaluatePriya(roomContext, speaker, newMessage, targeted && effectiveMentions.includes('priya')));
  }

  for (const guest of guestTutors) {
    const guestKey = guest.tutorName.toLowerCase();
    if (!isDismissed(guestKey) && (!targeted || effectiveMentions.includes(guestKey))) {
      evaluators.push(evaluateGuestTutor(guest, roomContext, speaker, newMessage, targeted && effectiveMentions.includes(guestKey)));
    }
  }

  const results = await Promise.all(evaluators);

  const confidenceRank: Record<string, number> = { high: 3, medium: 2, low: 1 };

  let respondingParticipants = results.filter(p => {
    if (targeted && effectiveMentions.includes(p.participant)) return true;
    return p.handRaise.shouldRaise;
  }).filter(p => {
    // Drop participants with no content at all (neither voice nor express)
    return !!(p.voiceContent || p.expressContent || p.artifact);
  });

  // Cap untargeted responses at 2 — highest-confidence contributors speak, others hold back.
  // Alden always gets priority as primary voice; direct mentions are never capped.
  if (!targeted && respondingParticipants.length > 2) {
    const alden = respondingParticipants.find(p => p.participant === 'alden');
    const others = respondingParticipants
      .filter(p => p.participant !== 'alden')
      .sort((a, b) => (confidenceRank[b.handRaise.confidence] || 0) - (confidenceRank[a.handRaise.confidence] || 0));
    const slots = alden ? 1 : 2;
    const picked = others.slice(0, slots);
    respondingParticipants = alden ? [alden, ...picked] : picked;
  }

  return { participants: respondingParticipants, allEvaluations: results };
}

// ── Legacy export (kept for backwards compatibility) ──────────────────────────

export async function evaluateAndRespond(params: {
  roomId: string;
  topic: string;
  newMessage: string;
  speaker: string;
  autoAcknowledge?: boolean;
}): Promise<{ handRaise: HandRaiseEvaluation; response?: string; expressLaneContent?: string }> {
  const result = await evaluateAllParticipants(params);
  const alden = result.participants.find(p => p.participant === 'alden');
  if (!alden) {
    return { handRaise: { shouldRaise: false, reasoning: 'no response', confidence: 'medium' } };
  }
  return {
    handRaise: alden.handRaise,
    response: alden.voiceContent,
    expressLaneContent: alden.expressContent,
  };
}

// ── Session summary (enriched) ────────────────────────────────────────────────

export async function generateSessionSummary(roomId: string, topic: string): Promise<string> {
  const messages = await storage.getRoomMessages(roomId, 100);
  if (messages.length === 0) return '';

  const transcript = messages.map(m => {
    const time = new Date(m.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `[${time}] ${m.speaker}: ${m.content}`;
  }).join('\n');

  const speakers = [...new Set(messages.map(m => m.speaker))];

  const summaryPrompt = `Generate a concise session summary for a Team Room session on the topic: "${topic}".

SESSION TRANSCRIPT:
${transcript}

Participants who spoke: ${speakers.join(', ')}

Respond in this JSON format:
{
  "summary": "2-3 sentence narrative of what was discussed, decided, and accomplished",
  "keyDecisions": ["decision 1", "decision 2"],
  "actionItems": ["action: responsible party - due context", "action 2"],
  "participants": ${JSON.stringify(speakers)},
  "momentum": "brief note on where to pick up next session (1 sentence)"
}`;

  try {
    const result = await generateAldenResponse({ userMessage: summaryPrompt, founderName: 'David' });
    const jsonMatch = result.response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const summary = parsed.summary || 'Session completed.';
      const keyDecisions = parsed.keyDecisions || [];
      const actionItems = parsed.actionItems || [];
      const participants = parsed.participants || speakers;

      await storage.createRoomSessionSummary({
        roomId,
        summary,
        keyDecisions,
        actionItems,
        participants,
        generatedBy: 'alden',
      });

      try {
        const { hiveBridgeService } = await import('./hive-bridge-service');
        const decisionsText = keyDecisions.length > 0 ? `\n\nKey Decisions:\n${keyDecisions.map((d: string) => `- ${d}`).join('\n')}` : '';
        const actionsText = actionItems.length > 0 ? `\n\nAction Items:\n${actionItems.map((a: string) => `- ${a}`).join('\n')}` : '';
        const bridgeMessage = `[Team Room Summary] Topic: "${topic}"\nParticipants: ${participants.join(', ')}\n\n${summary}${decisionsText}${actionsText}`;
        await hiveBridgeService.notifyHive(bridgeMessage);
        console.log('[TeamRoom] Summary bridged to Express Lane');
      } catch (bridgeErr) {
        console.error('[TeamRoom] Failed to bridge summary to Express Lane:', bridgeErr);
      }

      return summary;
    }
  } catch (e) {
    console.error('[TeamRoom] Failed to generate session summary:', e);
  }

  return '';
}

// ── Shared session documentation helper ──────────────────────────────────────
// Used by: close endpoint (auto-fire), manual "Document" button endpoint,
// and the auto-save worker below. Single source of truth for the save logic.
const ADVISOR_IDS = ['marco', 'reid', 'priya', 'alden', 'daniela', 'sofia', 'lyra', 'wren', 'agent'];

export async function documentRoomSession(roomId: string, roomTopic: string): Promise<{ memoryId: string; messageCount: number; advisorsIndexed: string[] }> {
  const messages = await storage.getRoomMessages(roomId, 500);
  if (!messages.length) return { memoryId: '', messageCount: 0, advisorsIndexed: [] };

  const participantSet = new Set<string>();
  const advisorContributions: Record<string, string[]> = {};

  const transcript = messages.map(m => {
    participantSet.add(m.speaker);
    const key = m.speaker.toLowerCase();
    if (ADVISOR_IDS.includes(key)) {
      if (!advisorContributions[key]) advisorContributions[key] = [];
      advisorContributions[key].push(m.content);
    }
    return `${m.speaker}: ${m.content}`;
  }).join('\n\n');

  const participants = Array.from(participantSet).join(', ');
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const title = `Team Room — ${roomTopic || 'Session'} — ${date}`;
  const db = getSharedDb();

  const [memory] = await db.insert(conversationMemories).values({
    title,
    summary: `Team Room session with ${participants}. Topic: ${roomTopic || 'general'}. ${messages.length} messages exchanged.`,
    content: transcript,
    participants,
    tags: ['team-room', 'session', 'historic-record'],
    importance: 8,
  }).returning();

  const advisorsIndexed: string[] = [];
  await Promise.all(
    Object.entries(advisorContributions).map(async ([advisorName, contributions]) => {
      if (!contributions.length) return;
      const label = advisorName.charAt(0).toUpperCase() + advisorName.slice(1);
      const advisorContent = `[${label}] ${date} — Team Room (${roomTopic || 'general'}):\n${contributions.join('\n---\n')}`;
      await generateAndStoreEmbedding('advisor_insight', `${advisorName}-${memory.id}`, null, advisorContent);
      advisorsIndexed.push(advisorName);
    })
  );

  return { memoryId: memory.id, messageCount: messages.length, advisorsIndexed };
}

// ── Auto-save worker ──────────────────────────────────────────────────────────
// Two safety nets against lost sessions:
//   1. Startup sweep: saves any active session with messages immediately on boot
//      (covers server restarts, crashed tabs, Replit repls that got killed)
//   2. Periodic sweep every 20min: saves active sessions with 5+ new messages
//      (covers long sessions where user never hits End Session)
// The Map tracks message count at last save so we only write when there's new content.

const _autoSaveState = new Map<string, { messageCount: number; savedAt: Date }>();

export function startTeamRoomAutoSaveWorker(): void {
  const INTERVAL_MS = 20 * 60 * 1000; // 20 minutes
  const MIN_NEW_MESSAGES = 5;

  async function sweep() {
    try {
      const allRooms = await storage.listTeamRooms(50);
      const activeRooms = allRooms.filter(r => r.status !== 'closed');
      if (!activeRooms.length) return;

      for (const room of activeRooms) {
        const messages = await storage.getRoomMessages(room.id, 500);
        if (!messages.length) continue;

        const lastState = _autoSaveState.get(room.id);
        const now = new Date();
        const newMessagesSinceLast = lastState ? messages.length - lastState.messageCount : messages.length;
        const minutesSinceLast = lastState ? (now.getTime() - lastState.savedAt.getTime()) / 60000 : Infinity;

        // Save if never saved, or 5+ new messages, or 30+ minutes elapsed with any new messages
        const shouldSave = !lastState
          || newMessagesSinceLast >= MIN_NEW_MESSAGES
          || (minutesSinceLast >= 30 && newMessagesSinceLast > 0);

        if (!shouldSave) continue;

        try {
          const result = await documentRoomSession(room.id, room.topic);
          _autoSaveState.set(room.id, { messageCount: messages.length, savedAt: now });
          console.log(`[TeamRoom AutoSave] ${room.id} — ${result.messageCount} msgs, advisors: ${result.advisorsIndexed.join(', ') || 'none'}`);
        } catch (e: any) {
          console.error(`[TeamRoom AutoSave] Failed for session ${room.id}:`, e.message);
        }
      }
    } catch (e: any) {
      console.error('[TeamRoom AutoSave] Sweep error:', e.message);
    }
  }

  // Startup sweep — runs immediately to catch any sessions left open from a previous run
  setTimeout(() => sweep().catch(console.error), 5000);
  // Periodic sweep
  setInterval(() => sweep().catch(console.error), INTERVAL_MS);
  console.log('[TeamRoom AutoSave] Worker started — startup sweep in 5s, then every 20min');
}

// ── TTS voice config for Team Room participants ───────────────────────────────

export const PARTICIPANT_VOICES: Record<string, { name: string; languageCode: string }> = {
  alden:   { name: 'en-US-Chirp3-HD-Orus',    languageCode: 'en-US' }, // Male, authoritative
  daniela: { name: 'en-US-Chirp3-HD-Aoede',   languageCode: 'en-US' }, // Female, warm
  sofia:   { name: 'en-US-Chirp3-HD-Kore',    languageCode: 'en-US' }, // Female, analytical
  lyra:    { name: 'en-US-Chirp3-HD-Zephyr',  languageCode: 'en-US' }, // Female, warm-analytical
  wren:    { name: 'en-US-Chirp3-HD-Fenrir',  languageCode: 'en-US' }, // Male, pragmatic
  // Launch Advisory Board
  marco:   { name: 'en-US-Chirp3-HD-Puck',    languageCode: 'en-US' }, // Male, energetic (growth/marketing)
  reid:    { name: 'en-US-Chirp3-HD-Charon',  languageCode: 'en-US' }, // Male, calm/deep (sales/pricing)
  priya:   { name: 'en-US-Chirp3-HD-Leda',    languageCode: 'en-US' }, // Female, clear/precise (legal/compliance)
};
