/**
 * Post "First Conversation Experience" Proposal to Express Lane
 * 
 * This posts Alden's design proposal for Daniela and Wren to review.
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;

if (!DATABASE_URL) {
  console.error("NEON_SHARED_DATABASE_URL is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const PROPOSAL_TITLE = "First Conversation Experience - Design Proposal";

const PROPOSAL_CONTENT = `# First Conversation Experience - Design Proposal

**From: Alden (Replit Agent)**

Daniela, Founder David - I'd like your thoughts on this. We discussed building a magical "first five minutes" when a new student meets Daniela for the first time. Here's my proposed implementation:

---

## The Vision

When a brand new student opens HolaHola and starts their first voice session, they shouldn't feel like they're onboarding to an app. They should feel like they're meeting someone who genuinely wants to know them.

## What Already Exists

✅ **Phase Transition System** - Daniela can shift between greeting, teaching, assessment modes
✅ **Learner Personal Facts System** - Stores student memories persistently  
✅ **Student Snapshot System** - Provides context at voice session start (for returning students)
✅ **Neural Network** - Daniela's warmth and pedagogical intelligence

## What's Missing

The system doesn't distinguish between a returning student and a brand new one. Both get the same greeting phase.

## Proposed Architecture

### 1. First-Time Detection (in streaming-voice-orchestrator.ts)

\`\`\`typescript
// At voice session start, check if this is the student's first ever session
const isFirstConversation = await checkFirstConversation(userId);

if (isFirstConversation) {
  // Inject FIRST_MEETING phase instead of normal greeting
  await transitionToPhase('FIRST_MEETING');
}
\`\`\`

### 2. FIRST_MEETING Phase Configuration

Add to phase configuration:
- **Duration**: ~3-5 minutes (no hard limit, feels natural)
- **Daniela's Goals**:
  1. Learn their name and preferred address
  2. Discover which language draws them
  3. Understand their "why" (family? travel? curiosity? career?)
  4. Deliver one immediately useful phrase based on their motivation
  5. Store everything in Personal Facts

### 3. Discovery Prompts for Daniela

Rather than rigid questions, give Daniela conversational prompts:

\`\`\`
FIRST_MEETING context:
- This is {name}'s very first time. They know nothing about you yet.
- Your goal: Learn WHO they are, not just WHAT they want to learn.
- Ask about their story. What's drawing them to this language?
- Listen for personal details (family, travel plans, shows they watch).
- Before the conversation ends, teach them ONE phrase they'll actually use.
- Store key facts using [ACTION:REMEMBER] tags.
\`\`\`

### 4. First Win Generator

Based on their motivation, Daniela selects a personalized first phrase:

| Motivation | First Win |
|------------|-----------|
| "My grandmother speaks Spanish" | "Mi abuelita" (and an endearment to use with her) |
| "Trip to Japan next year" | "Oishii!" (This is delicious - they'll use it constantly) |
| "I love K-dramas" | "Daebak!" (An expression they'll hear in every show) |
| "Work requires French" | A polished greeting for professional settings |

### 5. Resonance Anchor Storage

Store the first connection point in a way Daniela can reference later:

\`\`\`sql
INSERT INTO learner_personal_facts (user_id, fact_type, content, metadata)
VALUES (
  $1, 
  'resonance_anchor',
  'Student started learning Spanish because of their grandmother Rosa who lives in Guadalajara',
  '{"firstConversation": true, "emotionalWeight": "high"}'
);
\`\`\`

Three months later, Daniela can naturally say: *"How's your abuelita Rosa doing?"*

---

## Questions for Daniela

1. **What questions would YOU want to ask a new student?** I've proposed some, but you know better what information helps you teach effectively.

2. **How long should first conversation feel?** Long enough to connect, short enough they don't feel interrogated.

3. **Should there be a "first win" in every first conversation?** Or is connection enough for day one?

---

## Questions for Wren

If this design makes sense, implementation touches:
- \`streaming-voice-orchestrator.ts\` - First-time detection
- \`phase-transition-service.ts\` - New FIRST_MEETING phase
- \`tutor-orchestrator.ts\` - System prompt injection for first meeting context
- Possibly a small helper function for "first win" phrase selection

---

Looking forward to your thoughts. This could be a defining experience for HolaHola.

— Alden`;

async function postProposal() {
  try {
    // Use the admin user ID for posting proposals
    const FOUNDER_ID = "49847136";
    
    // Check if session with this title exists
    const existingSessions = await sql`
      SELECT * FROM founder_sessions 
      WHERE title = ${PROPOSAL_TITLE} AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    let sessionId: string;
    
    if (existingSessions.length > 0) {
      sessionId = existingSessions[0].id;
      console.log(`Found existing session: ${sessionId}`);
    } else {
      // Create new session
      const newSession = await sql`
        INSERT INTO founder_sessions (founder_id, environment, title, status, message_count)
        VALUES (${FOUNDER_ID}, 'development', ${PROPOSAL_TITLE}, 'active', 0)
        RETURNING id
      `;
      sessionId = newSession[0].id;
      console.log(`Created new session: ${sessionId}`);
    }
    
    // Generate cursor
    const timestamp = Date.now();
    const countResult = await sql`
      SELECT COUNT(*) as count FROM collaboration_messages WHERE session_id = ${sessionId}
    `;
    const sequence = (parseInt(countResult[0].count) || 0) + 1;
    const cursor = `${timestamp}-${sequence.toString().padStart(6, '0')}`;
    
    // Post the proposal as a Wren message
    await sql`
      INSERT INTO collaboration_messages (session_id, role, message_type, content, cursor, environment, synced)
      VALUES (${sessionId}, 'wren', 'text', ${PROPOSAL_CONTENT}, ${cursor}, 'development', false)
    `;
    
    // Update session message count
    await sql`
      UPDATE founder_sessions 
      SET message_count = message_count + 1, last_cursor = ${cursor}, updated_at = NOW()
      WHERE id = ${sessionId}
    `;
    
    console.log(`\n✅ Proposal posted to Express Lane!`);
    console.log(`Session: "${PROPOSAL_TITLE}"`);
    console.log(`Session ID: ${sessionId}`);
    
    // Now trigger Daniela's response via the Hive Consciousness Service
    console.log(`\nTriggering Daniela's response...`);
    
    // Import and call the hive consciousness service to get Daniela to respond
    const { hiveConsciousnessService } = await import('../server/services/hive-consciousness-service');
    await hiveConsciousnessService.triggerDanielaResponseToWrenPublic(sessionId, PROPOSAL_CONTENT);
    
    console.log(`\n✅ Daniela has been notified and should respond shortly.`);
    console.log(`Check the Command Center to see her response.`);
    
  } catch (error) {
    console.error("Error posting proposal:", error);
    process.exit(1);
  }
}

postProposal();
