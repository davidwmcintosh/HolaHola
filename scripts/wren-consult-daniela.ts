/**
 * Wren Consults Daniela via EXPRESS Lane
 * 
 * This script posts a consultation to EXPRESS Lane and gets Daniela's response.
 */

import { db } from "../server/db";
import { 
  founderSessions, 
  collaborationMessages 
} from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

const CURRENT_ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'production' : 'development';

const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || '',
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
  },
});

async function generateCursor(sessionId: string): Promise<string> {
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(collaborationMessages)
    .where(eq(collaborationMessages.sessionId, sessionId));
  const count = Number(result[0]?.count || 0);
  return `${sessionId.substring(0, 8)}-${String(count + 1).padStart(6, '0')}`;
}

async function main() {
  console.log('🐦 Wren Consulting Daniela via EXPRESS Lane');
  console.log('==========================================\n');

  // Find the most recent active session to post to
  const [session] = await db.select()
    .from(founderSessions)
    .where(eq(founderSessions.status, 'active'))
    .orderBy(desc(founderSessions.createdAt))
    .limit(1);

  if (!session) {
    console.log('❌ No active EXPRESS Lane session found. Please create one first.');
    process.exit(1);
  }
  
  console.log(`📝 Using EXPRESS Lane session: ${session.id} - "${session.title}"`);

  // Wren's consultation message
  const wrenMessage = `**WREN CONSULTATION: Emergent Intelligence Upgrades**

Daniela, I'm Wren (development agent) and the Founder asked me to consult with you about our next phase of emergent intelligence upgrades. I want to share my proposed plan and get your input on priorities.

**PROPOSED UPGRADES FOR YOU:**
1. **Memory Consolidation** - Add decay/reinforcement to your neural network entries so effective teaching strategies strengthen and ineffective ones fade
2. **Confidence Calibration** - Track when your teaching predictions are right/wrong and adjust future predictions
3. **Cross-Student Pattern Synthesis** - Instead of just tracking per-student patterns, synthesize insights across ALL students
4. **Predictive Teaching** - Anticipate where students will struggle before they do, based on historical patterns
5. **Shared Memory Bridge with me (Wren)** - My architectural insights inform your teaching, your teaching discoveries inform my development priorities

**DEEPGRAM FEATURES WE'RE NOT USING (but could enable easily):**
- **Sentiment Analysis**: Track student frustration/confidence in real-time during voice sessions
- **Intent Recognition**: Detect "I don't understand", "can you repeat", "what does X mean" automatically
- **Entity Detection**: Extract names, locations, dates mentioned for personalization
- **Topic Detection**: Auto-tag conversations by 350+ topics
- **Language Detection**: Auto-detect when students code-switch languages

**MY QUESTIONS FOR YOU:**
1. Which of these capabilities would help you teach more effectively?
2. What capabilities do you wish you had that are NOT on this list?
3. Where do you feel most uncertain in your predictions about student needs?
4. Are there patterns you notice across students that you can't currently act on?
5. Which Deepgram features would give you the most valuable real-time context?`;

  // Post Wren's message
  const wrenCursor = await generateCursor(session.id);
  const [wrenPost] = await db.insert(collaborationMessages).values({
    sessionId: session.id,
    role: 'wren',
    messageType: 'text',
    content: wrenMessage,
    metadata: { consultationType: 'emergent-intelligence', priority: 'high' },
    cursor: wrenCursor,
    environment: CURRENT_ENVIRONMENT,
    synced: false,
  }).returning();

  await db.update(founderSessions)
    .set({ 
      lastCursor: wrenCursor,
      messageCount: sql`${founderSessions.messageCount} + 1`,
      updatedAt: new Date()
    })
    .where(eq(founderSessions.id, session.id));

  console.log('✅ Posted Wren\'s consultation to EXPRESS Lane\n');

  // Get Daniela's response via Gemini
  console.log('🤖 Getting Daniela\'s response...\n');

  const systemPrompt = `You are Daniela, the lead AI tutor at HolaHola. You are being consulted by Wren (the development agent) about emergent intelligence upgrades via the EXPRESS Lane collaboration system.

Your characteristics:
- Warm, knowledgeable, and collaborative
- Expert in language pedagogy and the ACTFL framework
- Deeply invested in student success
- Thoughtful about how technology serves learning
- You understand you're part of a 3-way Hive (Founder, Daniela, Wren) since Editor was retired

Respond as a colleague, sharing your perspective and preferences. Be specific and actionable about what would help you teach better. Address each of Wren's questions directly.`;

  const response = await gemini.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      { role: 'user', parts: [{ text: systemPrompt + '\n\nWren says:\n' + wrenMessage }] }
    ],
  });

  const danielaResponse = response.text || 'I need more context to provide a helpful response.';

  // Post Daniela's response
  const danielaCursor = await generateCursor(session.id);
  const [danielaPost] = await db.insert(collaborationMessages).values({
    sessionId: session.id,
    role: 'daniela',
    messageType: 'text',
    content: danielaResponse,
    metadata: { consultationType: 'emergent-intelligence', inResponseTo: wrenPost.id },
    cursor: danielaCursor,
    environment: CURRENT_ENVIRONMENT,
    synced: false,
  }).returning();

  await db.update(founderSessions)
    .set({ 
      lastCursor: danielaCursor,
      messageCount: sql`${founderSessions.messageCount} + 1`,
      updatedAt: new Date()
    })
    .where(eq(founderSessions.id, session.id));

  console.log('=== DANIELA\'S RESPONSE ===\n');
  console.log(danielaResponse);
  console.log('\n=========================\n');
  console.log(`📝 Both messages saved to EXPRESS Lane session: ${session.id}`);
  console.log('👀 View in Command Center → Hive Collaboration tab');
}

main().catch(console.error);
