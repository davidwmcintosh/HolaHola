import { generateAldenResponse } from "./alden-persona-service";
import { storage } from "../storage";
import { GoogleGenAI } from "@google/genai";
import type { RoomVoiceMessage, RoomSessionSummary, RoomArtifact } from "@shared/schema";

// ── Gemini client (shared by Daniela + Sofia in Team Room) ──────────────────
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (geminiClient) return geminiClient;
  geminiClient = new GoogleGenAI({
    apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '',
    httpOptions: {
      apiVersion: '',
      baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
    },
  });
  return geminiClient;
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const gemini = getGemini();
  const result = await gemini.models.generateContent({
    model: 'gemini-2.5-flash',
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
}

export interface GuestTutor {
  tutorId: string;
  tutorName: string;
  language: string;
  personality?: string;
  teachingPhilosophy?: string;
  personalityTraits?: string;
}

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

For your VOICE response (conversational, 2-4 sentences, will be spoken aloud):
Keep it direct and natural. No lists, no headers.

For your EXPRESS LANE content (analytical, detailed, will appear in the text panel):
Provide detailed analysis, data, code snippets, or structured information.
If you're creating a structured artifact (plan, table, decision record, code block), add:
ARTIFACT_TYPE: plan|table|code|insight|decision
ARTIFACT_TITLE: [descriptive title]
ARTIFACT_DATA: [JSON object with the artifact's structured content]

Format your response as:
VOICE: [spoken response]
EXPRESS: [detailed analysis, or "none" if nothing to add]`;

  try {
    const result = await generateAldenResponse({ userMessage: responsePrompt, founderName: 'David' });
    const raw = result.response;

    const voiceMatch = raw.match(/VOICE:\s*(.*?)(?=EXPRESS:|$)/s);
    const expressMatch = raw.match(/EXPRESS:\s*(.*?)$/s);
    const voiceContent = voiceMatch ? voiceMatch[1].trim() : raw;
    const expressRaw = expressMatch ? expressMatch[1].trim() : undefined;

    let expressContent = expressRaw && expressRaw !== 'none' ? expressRaw : undefined;
    let artifact: ParticipantResponse['artifact'];

    // Extract artifact if present in Express Lane content
    if (expressContent) {
      const artifactTypeMatch = expressContent.match(/ARTIFACT_TYPE:\s*(\w+)/);
      const artifactTitleMatch = expressContent.match(/ARTIFACT_TITLE:\s*(.+?)(?=\n|$)/);
      const artifactDataMatch = expressContent.match(/ARTIFACT_DATA:\s*(\{[\s\S]*?\})/);

      if (artifactTypeMatch && artifactTitleMatch && artifactDataMatch) {
        try {
          artifact = {
            artifactType: artifactTypeMatch[1],
            title: artifactTitleMatch[1].trim(),
            content: JSON.parse(artifactDataMatch[1]),
          };
          // Remove artifact markers from Express content
          expressContent = expressContent
            .replace(/ARTIFACT_TYPE:.*\n?/g, '')
            .replace(/ARTIFACT_TITLE:.*\n?/g, '')
            .replace(/ARTIFACT_DATA:[\s\S]*?\}\n?/g, '')
            .trim();
        } catch { /* keep as text if JSON parse fails */ }
      }
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

const DANIELA_SYSTEM = `You are Daniela, the curriculum and pedagogy advisor at HolaHola. 
In the Team Room, you are an internal collaborator — not a student-facing tutor.
Your role: provide insight on curriculum design, ACTFL standards, learning outcomes, student progress, 
syllabi structure, and pedagogical best practices. You are warm but concise and professional.
You only speak when you have something genuinely useful to add about curriculum or teaching.`;

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

Do NOT raise your hand for: technical bugs, system architecture, business strategy, or general admin.

Respond ONLY in this JSON format:
{
  "shouldRaise": true or false,
  "reasoning": "brief explanation",
  "confidence": "high" or "medium" or "low"
}`;

  let handRaise: HandRaiseEvaluation = { shouldRaise: false, reasoning: 'not curriculum related', confidence: 'medium' };

  try {
    const text = await callGemini(DANIELA_SYSTEM, evalPrompt);
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

  const responsePrompt = `${roomContext}

NEW MESSAGE from ${speaker}: "${newMessage}"

You are Daniela in the Team Room providing curriculum/pedagogy insight.

Format your response as:
VOICE: [2-3 sentences, conversational, will be spoken aloud]
EXPRESS: [detailed curriculum insight, specific ACTFL references, or lesson recommendations — or "none"]`;

  try {
    const text = await callGemini(DANIELA_SYSTEM, responsePrompt);
    const voiceMatch = text.match(/VOICE:\s*(.*?)(?=EXPRESS:|$)/s);
    const expressMatch = text.match(/EXPRESS:\s*(.*?)$/s);
    const voiceContent = voiceMatch ? voiceMatch[1].trim() : text;
    const expressRaw = expressMatch ? expressMatch[1].trim() : undefined;
    const expressContent = expressRaw && expressRaw !== 'none' ? expressRaw : undefined;

    return { participant: 'daniela', handRaise, voiceContent, expressContent };
  } catch {
    return { participant: 'daniela', handRaise, voiceContent: 'Curriculum note pending — please ask me again.' };
  }
}

// ── Sofia evaluation + response (Gemini, Technical Health focus) ──────────────

const SOFIA_SYSTEM = `You are Sofia, the technical health and support specialist at HolaHola.
In the Team Room, you monitor system health, track technical issues, and flag problems.
Your role: identify bugs, system errors, voice pipeline issues, performance problems, and DevOps concerns.
You are analytical, direct, and solution-focused. You only speak when there is a genuine technical concern.`;

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

You are Sofia in the Team Room flagging a technical concern.

Format your response as:
VOICE: [2-3 sentences, direct and clear, will be spoken aloud]
EXPRESS: [technical details, error analysis, recommended fix steps, or "none"]`;

  try {
    const text = await callGemini(SOFIA_SYSTEM, responsePrompt);
    const voiceMatch = text.match(/VOICE:\s*(.*?)(?=EXPRESS:|$)/s);
    const expressMatch = text.match(/EXPRESS:\s*(.*?)$/s);
    const voiceContent = voiceMatch ? voiceMatch[1].trim() : text;
    const expressRaw = expressMatch ? expressMatch[1].trim() : undefined;
    const expressContent = expressRaw && expressRaw !== 'none' ? expressRaw : undefined;

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
You speak when asked or when your subject expertise directly applies. Be concise and collaborative.`;

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
    const voiceContent = voiceMatch ? voiceMatch[1].trim() : raw;
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
You only speak when you have data-backed observations or when the discussion touches student experience.`;

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

You are Lyra in the Team Room providing learning experience analysis.

Format your response as:
VOICE: [2-3 sentences, warm and data-grounded, will be spoken aloud]
EXPRESS: [detailed metrics, engagement data, content audit findings, or learning loop analysis — or "none"]`;

  try {
    const text = await callGemini(LYRA_SYSTEM, responsePrompt);
    const voiceMatch = text.match(/VOICE:\s*(.*?)(?=EXPRESS:|$)/s);
    const expressMatch = text.match(/EXPRESS:\s*(.*?)$/s);
    const voiceContent = voiceMatch ? voiceMatch[1].trim() : text;
    const expressRaw = expressMatch ? expressMatch[1].trim() : undefined;
    const expressContent = expressRaw && expressRaw !== 'none' ? expressRaw : undefined;

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
You are concise, structured, and solution-oriented. You only speak when there is a genuine technical or architectural point to make.`;

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

You are Wren in the Team Room providing architectural and technical insight.

Format your response as:
VOICE: [2-3 sentences, pragmatic and clear, will be spoken aloud]
EXPRESS: [architectural analysis, code patterns, technical recommendations, or system design insights — or "none"]`;

  try {
    const text = await callGemini(WREN_SYSTEM, responsePrompt);
    const voiceMatch = text.match(/VOICE:\s*(.*?)(?=EXPRESS:|$)/s);
    const expressMatch = text.match(/EXPRESS:\s*(.*?)$/s);
    const voiceContent = voiceMatch ? voiceMatch[1].trim() : text;
    const expressRaw = expressMatch ? expressMatch[1].trim() : undefined;
    const expressContent = expressRaw && expressRaw !== 'none' ? expressRaw : undefined;

    return { participant: 'wren', handRaise, voiceContent, expressContent };
  } catch {
    return { participant: 'wren', handRaise, voiceContent: 'Architectural analysis pending — let me review the patterns.' };
  }
}

// ── Public API: evaluate all participants in parallel ────────────────────────

// ── @mention parsing ────────────────────────────────────────────────────────

export function parseMentions(message: string, guestNames: string[] = []): Participant[] | null {
  const coreNames = ['alden', 'daniela', 'sofia', 'lyra', 'wren'];
  const allNames = [...coreNames, ...guestNames.map(n => n.toLowerCase())];
  const pattern = new RegExp(`@(${allNames.join('|')})\\b`, 'gi');
  const matches = message.match(pattern);
  if (!matches || matches.length === 0) return null;
  const unique = [...new Set(matches.map(m => m.slice(1).toLowerCase()))];
  return unique;
}

export async function evaluateAllParticipants(params: {
  roomId: string;
  topic: string;
  newMessage: string;
  speaker: string;
  mentions?: Participant[] | null;
  guestTutors?: GuestTutor[];
}): Promise<RoomEvaluationResult> {
  const { roomId, topic, newMessage, speaker, mentions, guestTutors = [] } = params;
  const roomContext = await buildRoomContext(roomId, topic);

  const targeted = mentions && mentions.length > 0;
  const evaluators: Promise<ParticipantResponse>[] = [];

  if (!targeted || mentions!.includes('alden')) {
    evaluators.push(evaluateAlden(roomContext, speaker, newMessage, targeted && mentions!.includes('alden')));
  }
  if (!targeted || mentions!.includes('daniela')) {
    evaluators.push(evaluateDaniela(roomContext, speaker, newMessage, targeted && mentions!.includes('daniela')));
  }
  if (!targeted || mentions!.includes('sofia')) {
    evaluators.push(evaluateSofia(roomContext, speaker, newMessage, targeted && mentions!.includes('sofia')));
  }
  if (!targeted || mentions!.includes('lyra')) {
    evaluators.push(evaluateLyra(roomContext, speaker, newMessage, targeted && mentions!.includes('lyra')));
  }
  if (!targeted || mentions!.includes('wren')) {
    evaluators.push(evaluateWren(roomContext, speaker, newMessage, targeted && mentions!.includes('wren')));
  }

  for (const guest of guestTutors) {
    const guestKey = guest.tutorName.toLowerCase();
    if (!targeted || mentions!.includes(guestKey)) {
      evaluators.push(evaluateGuestTutor(guest, roomContext, speaker, newMessage, targeted && mentions!.includes(guestKey)));
    }
  }

  const results = await Promise.all(evaluators);

  const respondingParticipants = results.filter(p => {
    if (targeted && mentions!.includes(p.participant)) return true;
    return p.handRaise.shouldRaise;
  });

  return { participants: respondingParticipants };
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

// ── TTS voice config for Team Room participants ───────────────────────────────

export const PARTICIPANT_VOICES: Record<string, { name: string; languageCode: string }> = {
  alden: { name: 'en-US-Neural2-D', languageCode: 'en-US' },   // Male, authoritative
  daniela: { name: 'en-US-Neural2-F', languageCode: 'en-US' }, // Female, warm
  sofia: { name: 'en-US-Neural2-E', languageCode: 'en-US' },   // Female, analytical
  lyra: { name: 'en-US-Neural2-H', languageCode: 'en-US' },    // Female, warm-analytical
  wren: { name: 'en-US-Neural2-A', languageCode: 'en-US' },    // Male, pragmatic
};
