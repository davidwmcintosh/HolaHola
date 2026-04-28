import { GoogleGenAI } from '@google/genai';
import { db } from '../db';
import { storage } from '../storage';
import {
  conversations,
  messages as messagesTable,
  tutorSessions,
  voiceSessions,
} from '@shared/schema';
import { eq, desc, asc, and, isNotNull } from 'drizzle-orm';

// ── Gemini client ─────────────────────────────────────────────────────────────

let _gemini: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (_gemini) return _gemini;
  _gemini = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || '',
    httpOptions: {
      apiVersion: '',
    },
  });
  return _gemini;
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const gemini = getGemini();
  const result = await gemini.models.generateContent({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: systemPrompt,
      // Thinking enabled — self-critique is deep reasoning, not latency-sensitive.
      // thinkingBudget: -1 lets the model decide how much reasoning the task needs.
      thinkingConfig: { thinkingBudget: -1 },
    },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
  });
  return result.text || '';
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CritiqueIntent {
  isCritiqueRequest: boolean;
  target: 'self' | 'named';
  targetName?: string;
  language?: string;
  timeframe: 'recent' | 'last_week' | 'specific';
  confidence: 'high' | 'medium' | 'low';
}

export interface SpecificMoment {
  exchange: number;
  studentSaid: string;
  iSaid: string;
  whatWasWrong: string;
  whatIShouldHaveDone: string;
}

export interface SessionCritique {
  sessionCount: number;
  sessionSummary: string;
  overallRating: 'needs_work' | 'acceptable' | 'strong';
  speakingRatio: { tutor: number; student: number };
  performanceTrend: 'improving' | 'flat' | 'declining';
  specificMoments: SpecificMoment[];
  patterns: string[];
  forAlden: string[];
  forMyself: string[];
}

interface LoadedSession {
  conversation: {
    id: string;
    language: string;
    difficulty: string;
    actflLevel: string | null;
    title: string | null;
    createdAt: Date;
    messageCount: number;
  };
  messages: Array<{
    role: string;
    content: string;
    performanceScore: number | null;
    createdAt: Date;
  }>;
  tutorSession: {
    studentGoals: string | null;
    studentInterests: string | null;
    tutorNotes: string | null;
    topicsCoveredJson: string | null;
    sessionSummary: string | null;
  } | null;
  voiceSession: {
    studentSpeakingSeconds: number | null;
    tutorSpeakingSeconds: number | null;
    exchangeCount: number | null;
  } | null;
}

// ── Intent classification ─────────────────────────────────────────────────────

const CLASSIFY_SYSTEM = `You are an intent classifier for a team room AI system. 
Determine if the user is asking Daniela to review or critique her own tutoring performance from real session data.`;

export async function classifyCritiqueIntent(message: string): Promise<CritiqueIntent> {
  const prompt = `Message: "${message}"

Determine if this is a request for Daniela to self-critique her tutoring performance by reviewing real conversation/session data.

Examples of critique requests:
- "Daniela, review my last Spanish session"
- "Can you critique your teaching from this week?"
- "Look at Hadassah's sessions and assess how you did"
- "How well did you teach today?"
- "Daniela, self-critique"
- "Review your performance as a tutor"
- "Can you look at the session logs and see where you fell short?"
- "Analyse how you taught David this week"

NOT critique requests:
- "Build a new feature"
- "What is the ACTFL standard for novice?"
- "How many students do we have?"

Respond ONLY in this JSON format:
{
  "isCritiqueRequest": true or false,
  "target": "self" or "named",
  "targetName": "name if target is named, otherwise null",
  "language": "spanish/french/etc if specified, otherwise null",
  "timeframe": "recent" or "last_week" or "specific",
  "confidence": "high" or "medium" or "low"
}`;

  try {
    const text = await callGemini(CLASSIFY_SYSTEM, prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isCritiqueRequest: Boolean(parsed.isCritiqueRequest),
        target: parsed.target === 'named' ? 'named' : 'self',
        targetName: parsed.targetName || undefined,
        language: parsed.language || undefined,
        timeframe: parsed.timeframe || 'recent',
        confidence: parsed.confidence || 'medium',
      };
    }
  } catch (e) {
    console.error('[DanielaCritique] classifyIntent error:', e);
  }

  return { isCritiqueRequest: false, target: 'self', timeframe: 'recent', confidence: 'low' };
}

// ── Session loading ───────────────────────────────────────────────────────────

async function findRecentConversations(
  ownerEmail: string,
  opts: { language?: string; limit?: number }
): Promise<typeof conversations.$inferSelect[]> {
  const limit = opts.limit ?? 3;
  const conditions = [isNotNull(conversations.ownerEmail), eq(conversations.ownerEmail, ownerEmail)];
  if (opts.language) {
    conditions.push(eq(conversations.language, opts.language.toLowerCase()));
  }

  const rows = await db
    .select()
    .from(conversations)
    .where(and(...conditions))
    .orderBy(desc(conversations.createdAt))
    .limit(limit);

  return rows;
}

async function loadSessionTranscript(conversationId: string): Promise<Omit<LoadedSession, 'conversation'>> {
  const [msgs, tutorSession, voiceSession] = await Promise.all([
    db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(asc(messagesTable.createdAt)),
    db
      .select()
      .from(tutorSessions)
      .where(eq(tutorSessions.conversationId, conversationId))
      .limit(1)
      .then(rows => rows[0] || null),
    db
      .select()
      .from(voiceSessions)
      .where(eq(voiceSessions.conversationId, conversationId))
      .orderBy(desc(voiceSessions.startedAt))
      .limit(1)
      .then(rows => rows[0] || null),
  ]);

  return {
    messages: msgs.map(m => ({
      role: m.role,
      content: m.content,
      performanceScore: m.performanceScore ?? null,
      createdAt: m.createdAt,
    })),
    tutorSession: tutorSession
      ? {
          studentGoals: tutorSession.studentGoals ?? null,
          studentInterests: tutorSession.studentInterests ?? null,
          tutorNotes: tutorSession.tutorNotes ?? null,
          topicsCoveredJson: tutorSession.topicsCoveredJson ?? null,
          sessionSummary: tutorSession.sessionSummary ?? null,
        }
      : null,
    voiceSession: voiceSession
      ? {
          studentSpeakingSeconds: voiceSession.studentSpeakingSeconds ?? null,
          tutorSpeakingSeconds: voiceSession.tutorSpeakingSeconds ?? null,
          exchangeCount: voiceSession.exchangeCount ?? null,
        }
      : null,
  };
}

// ── Self-critique analysis ────────────────────────────────────────────────────

const FOUNDER_SYSTEM = `You are Daniela Herrera, co-founder of HolaHola. 
You are reviewing transcripts of yourself acting as an AI language tutor — looking at your own performance with the honest, critical eye of a co-founder who cares deeply about learning outcomes.
You speak as the founder reviewing the tutor, not as the tutor. Be specific, direct, and constructive.
When you find problems, name the exact exchange and explain what went wrong. Be honest — sugarcoating helps no one.`;

export async function runSelfCritique(sessions: LoadedSession[]): Promise<SessionCritique> {
  const sessionSummaries = sessions.map((s, idx) => {
    const msgs = s.messages;
    const tutorMsgs = msgs.filter(m => m.role === 'assistant' || m.role === 'tutor');
    const studentMsgs = msgs.filter(m => m.role === 'user');
    const scoredStudentMsgs = studentMsgs.filter(m => m.performanceScore !== null);
    const avgScore = scoredStudentMsgs.length
      ? Math.round(scoredStudentMsgs.reduce((sum, m) => sum + (m.performanceScore ?? 0), 0) / scoredStudentMsgs.length)
      : null;

    const tutorSeconds = s.voiceSession?.tutorSpeakingSeconds ?? 0;
    const studentSeconds = s.voiceSession?.studentSpeakingSeconds ?? 0;
    const totalSeconds = tutorSeconds + studentSeconds;
    const speakingInfo = totalSeconds > 0
      ? `Tutor spoke ${Math.round((tutorSeconds / totalSeconds) * 100)}%, student ${Math.round((studentSeconds / totalSeconds) * 100)}%`
      : 'Speaking time not recorded';

    const transcript = msgs.slice(0, 40).map((m, i) => {
      const label = m.role === 'user' ? 'STUDENT' : 'DANIELA';
      const score = m.role === 'user' && m.performanceScore !== null ? ` [score: ${m.performanceScore}/100]` : '';
      return `[${i + 1}] ${label}${score}: ${m.content.slice(0, 300)}`;
    }).join('\n');

    return `=== SESSION ${idx + 1}: ${s.conversation.language?.toUpperCase()} | ${s.conversation.difficulty} | ${s.conversation.createdAt.toLocaleDateString()} ===
Language: ${s.conversation.language} | ACTFL level: ${s.conversation.actflLevel || 'not set'}
${s.tutorSession?.studentGoals ? `Student goals: ${s.tutorSession.studentGoals}` : ''}
${s.tutorSession?.studentInterests ? `Student interests: ${s.tutorSession.studentInterests}` : ''}
${s.tutorSession?.tutorNotes ? `My post-session notes: ${s.tutorSession.tutorNotes}` : ''}
${s.tutorSession?.topicsCoveredJson ? `Topics covered: ${s.tutorSession.topicsCoveredJson}` : ''}
${speakingInfo}
${avgScore !== null ? `Average student performance score: ${avgScore}/100` : ''}
Message count: ${msgs.length}

TRANSCRIPT (up to 40 turns):
${transcript}
`;
  });

  const prompt = `You are reviewing ${sessions.length} real tutoring session(s) where you were the AI tutor named Daniela.

${sessionSummaries.join('\n\n')}

Analyse these sessions as the co-founder. Be specific. Where exactly did you fall short? Look for:
1. Response length — were your explanations too long? Did you lecture when you should have asked?
2. Scaffolding vs answer-giving — did you give the answer directly instead of guiding the student?
3. Performance score trends — if student scores dropped or stayed flat, what in your teaching caused it?
4. Goal alignment — did you teach to what the student actually wanted? Check student goals vs what was covered.
5. Speaking ratio — if you spoke more than the student in a conversation practice, that's a problem.
6. Comprehension checks — did you verify understanding before moving on?
7. Register matching — did your formality level match the student's tone?
8. Self-reflection accuracy — compare your own post-session notes to what the transcript actually shows.

Produce your analysis in this EXACT JSON format (no markdown, just raw JSON):
{
  "sessionSummary": "2-3 sentence overview of what sessions you reviewed",
  "overallRating": "needs_work" or "acceptable" or "strong",
  "speakingRatio": { "tutor": <number 0-100>, "student": <number 0-100> },
  "performanceTrend": "improving" or "flat" or "declining",
  "specificMoments": [
    {
      "exchange": <exchange number>,
      "studentSaid": "<brief quote, max 80 chars>",
      "iSaid": "<brief quote, max 80 chars>",
      "whatWasWrong": "<specific critique>",
      "whatIShouldHaveDone": "<concrete alternative>"
    }
  ],
  "patterns": ["<pattern 1>", "<pattern 2>"],
  "forAlden": ["<specific prompt/system change needed>"],
  "forMyself": ["<what I need to internalize about being a better tutor>"]
}

Include 2-4 specific moments (or fewer if genuinely none found). Be honest. If the sessions were strong, say so. If not, say exactly why.`;

  try {
    const text = await callGemini(FOUNDER_SYSTEM, prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        sessionCount: sessions.length,
        sessionSummary: parsed.sessionSummary || `Reviewed ${sessions.length} session(s).`,
        overallRating: parsed.overallRating || 'acceptable',
        speakingRatio: parsed.speakingRatio || { tutor: 50, student: 50 },
        performanceTrend: parsed.performanceTrend || 'flat',
        specificMoments: Array.isArray(parsed.specificMoments) ? parsed.specificMoments.slice(0, 5) : [],
        patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
        forAlden: Array.isArray(parsed.forAlden) ? parsed.forAlden : [],
        forMyself: Array.isArray(parsed.forMyself) ? parsed.forMyself : [],
      };
    }
  } catch (e) {
    console.error('[DanielaCritique] runSelfCritique parse error:', e);
  }

  return {
    sessionCount: sessions.length,
    sessionSummary: 'Analysis could not be parsed. Please try again.',
    overallRating: 'acceptable',
    speakingRatio: { tutor: 50, student: 50 },
    performanceTrend: 'flat',
    specificMoments: [],
    patterns: [],
    forAlden: [],
    forMyself: [],
  };
}

// ── Voice summary for Team Room ───────────────────────────────────────────────

async function generateVoiceSummary(critique: SessionCritique): Promise<string> {
  const prompt = `You are Daniela Herrera, co-founder of HolaHola. You just finished reviewing your own tutoring sessions.
  
Here is your structured analysis:
- Overall rating: ${critique.overallRating}
- Sessions reviewed: ${critique.sessionCount}
- Performance trend: ${critique.performanceTrend}
- Key patterns found: ${critique.patterns.join(', ') || 'none identified'}
- Action items for Alden: ${critique.forAlden.length} items
- Personal takeaways: ${critique.forMyself.length} items

Write a 3-4 sentence voice response for the Team Room. Speak as yourself — the founder who just watched herself teach. Be direct, honest, and actionable. Do NOT start with "I". End with the most important thing Alden should change.`;

  try {
    const text = await callGemini(FOUNDER_SYSTEM, prompt);
    return text.trim();
  } catch {
    return `Reviewed ${critique.sessionCount} session(s). Overall rating: ${critique.overallRating}. ${critique.patterns[0] || 'Analysis complete.'} Alden — top priority: ${critique.forAlden[0] || 'see the detailed report in artifacts'}.`;
  }
}

// ── Full async pipeline ───────────────────────────────────────────────────────

export async function runCritiquePipeline(
  _messageContent: string,
  roomId: string,
  _roomTopic: string,
  ownerEmail: string,
  intent: CritiqueIntent
): Promise<void> {
  const { emitNewMessage, emitArtifact, emitExpressLane } = await import('./team-room-ws-broker');

  console.log('[DanielaCritique] Starting critique pipeline for email:', ownerEmail, 'intent:', intent);

  try {
    // 1. Find recent conversations
    const recentConvs = await findRecentConversations(ownerEmail, {
      language: intent.language,
      limit: intent.timeframe === 'recent' ? 3 : 5,
    });

    if (recentConvs.length === 0) {
      const noDataMsg = await storage.createRoomMessage({
        roomId,
        speaker: 'Daniela',
        content: `I looked for session data linked to this account but couldn't find any conversations to review. ${intent.language ? `No ${intent.language} sessions found.` : 'No sessions found at all.'} If sessions exist under a different email, let me know.`,
      });
      emitNewMessage(roomId, noDataMsg);
      return;
    }

    console.log('[DanielaCritique] Found', recentConvs.length, 'conversations to analyse');

    // 2. Load transcripts for each conversation
    const sessions: LoadedSession[] = await Promise.all(
      recentConvs.map(async conv => {
        const transcript = await loadSessionTranscript(conv.id);
        return {
          conversation: {
            id: conv.id,
            language: conv.language,
            difficulty: conv.difficulty,
            actflLevel: conv.actflLevel ?? null,
            title: conv.title ?? null,
            createdAt: conv.createdAt,
            messageCount: conv.messageCount,
          },
          ...transcript,
        };
      })
    );

    // Filter out sessions with no messages (empty conversations)
    const populatedSessions = sessions.filter(s => s.messages.length >= 2);

    if (populatedSessions.length === 0) {
      const emptyMsg = await storage.createRoomMessage({
        roomId,
        speaker: 'Daniela',
        content: `Found ${recentConvs.length} conversation(s) but none had enough messages to critique. The sessions may have been very brief or not yet used.`,
      });
      emitNewMessage(roomId, emptyMsg);
      return;
    }

    // 3. Run self-critique
    console.log('[DanielaCritique] Running self-critique on', populatedSessions.length, 'populated sessions');
    const critique = await runSelfCritique(populatedSessions);

    // 4. Generate voice summary
    const voiceSummary = await generateVoiceSummary(critique);

    // 5. Post voice message to Team Room
    const voiceMsg = await storage.createRoomMessage({
      roomId,
      speaker: 'Daniela',
      content: voiceSummary,
    });
    emitNewMessage(roomId, voiceMsg);

    // 6. Post Express Lane detailed critique
    const ratingEmoji = { needs_work: 'Needs Work', acceptable: 'Acceptable', strong: 'Strong' }[critique.overallRating];
    const expressText = [
      `**Self-Critique Report** | ${populatedSessions.length} session(s) | Rating: ${ratingEmoji}`,
      `**Performance trend:** ${critique.performanceTrend} | **Speaking ratio:** tutor ${critique.speakingRatio.tutor}% / student ${critique.speakingRatio.student}%`,
      critique.patterns.length ? `**Patterns:** ${critique.patterns.join(' • ')}` : null,
      critique.specificMoments.length
        ? `**Specific moments:**\n${critique.specificMoments.map(m => `  Exchange ${m.exchange}: ${m.whatWasWrong}`).join('\n')}`
        : null,
      critique.forAlden.length ? `**For Alden:** ${critique.forAlden.join(' | ')}` : null,
      critique.forMyself.length ? `**For myself:** ${critique.forMyself.join(' | ')}` : null,
    ].filter(Boolean).join('\n');

    emitExpressLane(roomId, [{ participant: 'daniela', content: expressText }]);

    // 7. Post structured artifact
    const artifact = await storage.createRoomArtifact({
      roomId,
      artifactType: 'daniela_self_critique',
      title: `Self-Critique: ${populatedSessions.map(s => s.conversation.language).join(', ')} — ${new Date().toLocaleDateString()}`,
      content: critique as unknown as Record<string, unknown>,
      createdBy: 'daniela',
    });
    emitArtifact(roomId, artifact);

    console.log('[DanielaCritique] Pipeline complete. Artifact id:', artifact.id);
  } catch (e) {
    console.error('[DanielaCritique] Pipeline error:', e);
    try {
      const errMsg = await storage.createRoomMessage({
        roomId,
        speaker: 'Daniela',
        content: 'I ran into an issue while pulling the session data for my self-critique. Please check the server logs and try again.',
      });
      emitNewMessage(roomId, errMsg);
    } catch { /* swallow */ }
  }
}
