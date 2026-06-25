/**
 * CAP-006: Alden Memory-Driven Proactive Check-Ins
 *
 * After Lyra (or Daniela) analysis events, Alden cross-references
 * findings with David's stored preferences and goals. If a meaningful
 * connection exists, Alden opens a proactive Team Room conversation.
 */

import { db } from '../db';
import { getSharedDb } from '../db';
import { learnerPersonalFacts, editorInsights, founderSessions, users } from '@shared/schema';
import { eq, and, inArray, desc, or, isNull, sql } from 'drizzle-orm';
import { founderCollabService } from './founder-collaboration-service';
import { postToActiveTeamRoom } from './team-room-proactive-poster';
import { callGeminiWithSchema, GEMINI_MODELS } from '../gemini-utils';

const FOUNDER_ID = '49847136';
const ALDEN_SESSION_TITLE = 'Alden Platform Management';
const RELEVANT_FACT_TYPES = ['preference', 'goal', 'work', 'notable_mention'];
const MEMORY_FETCH_LIMIT = 100;
const MIN_CONFIDENCE_FOR_CHECKIN = 6;

interface LyraFinding {
  title: string;
  description: string;
  severity: string;
  category?: string;
  needsReview?: boolean;
}

interface MemoryCheckResult {
  triggered: boolean;
  connection?: string;
  confidence: number;
  checkInMessage?: string;
}

interface CheckInDecision {
  shouldSendCheckIn: boolean;
  confidence: number;
  connection: string;
  checkInMessage: string;
  memoryAnchor: string;
}

async function loadFounderMemory(): Promise<{ facts: Array<{ factType: string | null; fact: string; mentionCount: number | null }>; insights: Array<{ category: string; title: string; content: string; importance: number | null }> }> {
  const sharedDb = getSharedDb();

  const [facts, insights] = await Promise.all([
    sharedDb
      .select({
        factType: learnerPersonalFacts.factType,
        fact: learnerPersonalFacts.fact,
        mentionCount: learnerPersonalFacts.mentionCount,
      })
      .from(learnerPersonalFacts)
      .where(and(
        eq(learnerPersonalFacts.studentId, FOUNDER_ID),
        isNull(learnerPersonalFacts.validTo),
        inArray(learnerPersonalFacts.factType, RELEVANT_FACT_TYPES),
      ))
      .orderBy(desc(learnerPersonalFacts.mentionCount))
      .limit(MEMORY_FETCH_LIMIT),

    sharedDb
      .select({
        category: editorInsights.category,
        title: editorInsights.title,
        content: editorInsights.content,
        importance: editorInsights.importance,
      })
      .from(editorInsights)
      .orderBy(desc(editorInsights.importance))
      .limit(15),
  ]);

  return { facts, insights };
}

async function findMemoryConnection(
  findings: LyraFinding[],
  memory: Awaited<ReturnType<typeof loadFounderMemory>>
): Promise<CheckInDecision> {
  const findingsList = findings.slice(0, 6).map((f, i) =>
    `${i + 1}. [${f.severity.toUpperCase()}] ${f.title}: ${f.description}`
  ).join('\n');

  const factLines = memory.facts.slice(0, 80).map(f =>
    `[${f.factType}] ${f.fact}`
  ).join('\n');

  const insightLines = memory.insights.map(i =>
    `[${i.category} · importance ${i.importance}] ${i.title}: ${i.content.substring(0, 120)}`
  ).join('\n');

  const prompt = `You are Alden, HolaHola's platform management AI. You are deciding whether to send David a proactive check-in message based on recent platform findings from Lyra (learning experience analyst).

Your role is to be genuinely useful, not noisy. Only send a check-in if there is a specific, meaningful, and actionable connection between a platform finding and David's actual stored preferences or goals. If the connection is vague or generic, do NOT send.

LYRA'S RECENT FINDINGS:
${findingsList}

DAVID'S STORED MEMORY (preferences, goals, work notes, notable mentions):
${factLines}

ALDEN'S ARCHITECTURAL MEMORY (high-importance decisions):
${insightLines}

INSTRUCTIONS:
1. Look for a specific, concrete connection between a Lyra finding and a stored preference/goal/work note
2. The connection must be about the same topic/area — not just vaguely "related to the platform"
3. Rate your confidence 1-10 (10=very specific match, 1=very loose)
4. Only mark shouldSendCheckIn=true if confidence >= 6
5. If sending, write the check-in message as Alden would say it — brief, warm, direct. Reference the specific memory. End with a clear question or call to action. Max 3 sentences.
6. The memoryAnchor should be the verbatim fact from memory that connects to the finding

Examples of GOOD connections:
- Lyra found Spanish curriculum has low completion + David expressed "I want HolaHola to be the best Spanish learning app for beginners" → Good match
- Lyra found 11 lessons missing ACTFL levels + David noted "ACTFL alignment matters for our enterprise customers" → Good match

Examples of BAD connections (too vague — don't send):
- "Lyra found issues" + "David cares about quality" → Too generic
- Any finding that connects to Alden's architectural memory but not David's personal preferences`;

  const result = await callGeminiWithSchema<CheckInDecision>(
    GEMINI_MODELS.FLASH,
    [{ role: 'user', content: prompt }],
    {
      type: 'object',
      properties: {
        shouldSendCheckIn: { type: 'boolean', description: 'Whether to send a proactive check-in' },
        confidence: { type: 'number', description: 'Confidence score 1-10 for the connection' },
        connection: { type: 'string', description: 'Brief description of the connection found (or "No meaningful connection found")' },
        checkInMessage: { type: 'string', description: 'The message Alden would send (empty string if not sending)' },
        memoryAnchor: { type: 'string', description: 'The verbatim fact from memory that connects to the finding' },
      },
      required: ['shouldSendCheckIn', 'confidence', 'connection', 'checkInMessage', 'memoryAnchor'],
    }
  );

  return result;
}

async function getOrCreateAldenSession(): Promise<string> {
  const sharedDb = getSharedDb();
  const [existing] = await sharedDb
    .select()
    .from(founderSessions)
    .where(and(
      eq(founderSessions.title, ALDEN_SESSION_TITLE),
      eq(founderSessions.status, 'active')
    ))
    .orderBy(desc(founderSessions.createdAt))
    .limit(1);

  if (existing) return existing.id;

  const session = await founderCollabService.createSession(FOUNDER_ID, ALDEN_SESSION_TITLE);
  return session.id;
}

let lastCheckInTime: Date | null = null;
const MIN_CHECKIN_GAP_MS = 4 * 60 * 60 * 1000;

export async function triggerAldenCheckIn(
  findings: LyraFinding[],
  source: string
): Promise<MemoryCheckResult> {
  if (findings.length === 0) {
    return { triggered: false, confidence: 0 };
  }

  if (lastCheckInTime && Date.now() - lastCheckInTime.getTime() < MIN_CHECKIN_GAP_MS) {
    console.log(`[AldenCheckIn] Recent check-in ${lastCheckInTime.toISOString()} — skipping (gap: 4h)`);
    return { triggered: false, confidence: 0 };
  }

  // DB-persistent cooldown — survives server restarts (in-memory resets on every deploy)
  if (!lastCheckInTime) {
    try {
      const sessionId = await getOrCreateAldenSession();
      const sharedDb = getSharedDb();
      const result = await sharedDb.execute(sql`
        SELECT MAX(created_at) as last_ts
        FROM collaboration_messages
        WHERE session_id = ${sessionId} AND role = 'system'
      `);
      const lastTs = (result as any)?.rows?.[0]?.last_ts;
      if (lastTs) {
        const lastDb = new Date(lastTs);
        if (Date.now() - lastDb.getTime() < MIN_CHECKIN_GAP_MS) {
          lastCheckInTime = lastDb;
          console.log(`[AldenCheckIn] Recent check-in from DB (${lastDb.toISOString()}) — skipping`);
          return { triggered: false, confidence: 0 };
        }
      }
    } catch (err: any) {
      console.warn(`[AldenCheckIn] DB cooldown check failed: ${err.message}`);
    }
  }

  console.log(`[AldenCheckIn] Assessing ${findings.length} findings from ${source} for memory connections...`);

  let memory: Awaited<ReturnType<typeof loadFounderMemory>>;
  try {
    memory = await loadFounderMemory();
  } catch (err: any) {
    console.error(`[AldenCheckIn] Memory load failed:`, err.message);
    return { triggered: false, confidence: 0 };
  }

  console.log(`[AldenCheckIn] Loaded ${memory.facts.length} relevant facts, ${memory.insights.length} insights`);

  let decision: CheckInDecision;
  try {
    decision = await findMemoryConnection(findings, memory);
  } catch (err: any) {
    console.error(`[AldenCheckIn] Gemini assessment failed:`, err.message);
    return { triggered: false, confidence: 0 };
  }

  console.log(`[AldenCheckIn] Decision: shouldSend=${decision.shouldSendCheckIn}, confidence=${decision.confidence}, connection="${decision.connection}"`);

  if (!decision.shouldSendCheckIn || decision.confidence < MIN_CONFIDENCE_FOR_CHECKIN) {
    return {
      triggered: false,
      confidence: decision.confidence,
      connection: decision.connection,
    };
  }

  lastCheckInTime = new Date();

  try {
    const sessionId = await getOrCreateAldenSession();

    const expressLaneContent = `**Alden Proactive Check-In** *(triggered by ${source})*

${decision.checkInMessage}

---
*Memory anchor: "${decision.memoryAnchor}"*
*Connection: ${decision.connection}*
*Confidence: ${decision.confidence}/10*`;

    await founderCollabService.addMessage(sessionId, {
      role: 'system',
      content: expressLaneContent,
      metadata: {
        type: 'alden_proactive_checkin',
        source,
        connection: decision.connection,
        confidence: decision.confidence,
        memoryAnchor: decision.memoryAnchor,
      },
    });

    await postToActiveTeamRoom({
      participant: 'alden',
      briefSummary: decision.checkInMessage,
      source: `Alden Memory Check-In (via ${source})`,
    });

    console.log(`[AldenCheckIn] Check-in posted: "${decision.checkInMessage.substring(0, 80)}..."`);
  } catch (err: any) {
    console.error(`[AldenCheckIn] Failed to post check-in:`, err.message);
    return { triggered: false, confidence: decision.confidence };
  }

  return {
    triggered: true,
    confidence: decision.confidence,
    connection: decision.connection,
    checkInMessage: decision.checkInMessage,
  };
}
