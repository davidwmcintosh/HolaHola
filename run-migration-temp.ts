import { db } from './server/db';
import { conversations, messages, hiveSnapshots } from './shared/schema';
import { eq, and, sql, asc, desc } from 'drizzle-orm';
import { callGemini, GEMINI_MODELS } from './server/gemini-utils';
import { studentLearningService, PERSONAL_FACT_TYPES } from './server/services/student-learning-service';

const BATCH_SIZE = 10;
const USER_ID = '49847136';

async function runBatch() {
  console.log(`Running migration for user: ${USER_ID}`);
  
  // Get longer conversations first (more likely to have personal content)
  const convs = await db
    .select({
      id: conversations.id,
      createdAt: conversations.createdAt,
      language: conversations.language,
      messageCount: conversations.messageCount,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, USER_ID),
        eq(conversations.conversationType, 'learning'),
        sql`message_count > 5`,
        sql`NOT EXISTS (
          SELECT 1 FROM hive_snapshots 
          WHERE conversation_id = ${conversations.id}
          AND metadata->>'migrationType' = 'personal_facts'
        )`
      )
    )
    .orderBy(desc(conversations.messageCount))
    .limit(BATCH_SIZE);
  
  console.log(`Found ${convs.length} conversations with 5+ messages to process`);
  let totalFactsSaved = 0;
  
  for (const conv of convs) {
    console.log(`\nProcessing: ${conv.id.slice(0,8)}... (${conv.language}, ${new Date(conv.createdAt).toLocaleDateString()}, ${conv.messageCount} msgs)`);
    
    const msgs = await db
      .select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(eq(messages.conversationId, conv.id))
      .orderBy(asc(messages.createdAt));
    
    const sampleMsgs = msgs.length > 30 ? [...msgs.slice(0, 15), ...msgs.slice(-15)] : msgs;
    const transcript = sampleMsgs
      .map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${(m.content || '').slice(0, 300)}`)
      .join('\n');
    
    const prompt = `Extract personal facts about the STUDENT from this language lesson.
Look for: family members (names, relationships), travel plans, work/job, hobbies, life events, goals, pets, food preferences, where they live.
Return JSON: {"facts": [{"factType": "family_member|travel_plan|work_career|hobby_interest|life_event|cultural_background|personal_goal|relationship|health_wellness|education|pet|food_preference|daily_routine|location_residence", "fact": "brief description", "context": "what they said", "confidence": 0.0-1.0}]}
Only facts with confidence >= 0.7. If none found, return {"facts": []}.

CONVERSATION (${conv.language}):
${transcript.slice(0, 6000)}`;

    try {
      const response = await callGemini(GEMINI_MODELS.FLASH, [{ role: 'user', content: prompt }]);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      let factsExtracted = 0;
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const facts = (parsed.facts || []).filter((f: any) => f.confidence >= 0.7 && PERSONAL_FACT_TYPES.includes(f.factType));
        
        for (const f of facts) {
          try {
            const saved = await studentLearningService.savePersonalFact({
              studentId: USER_ID,
              factType: f.factType,
              fact: f.fact,
              context: `${f.context || ''} (historical migration)`,
              sourceConversationId: conv.id,
              language: conv.language,
              confidenceScore: f.confidence,
            });
            if (saved) {
              console.log(`  ✓ ${f.factType}: ${f.fact}`);
              factsExtracted++;
              totalFactsSaved++;
            }
          } catch (e: any) {
            if (!e.message?.includes('duplicate') && !e.message?.includes('similar')) {
              console.log(`  ✗ Failed: ${e.message}`);
            }
          }
        }
      }
      console.log(`  Extracted ${factsExtracted} new facts`);
    } catch (err: any) {
      console.log(`  Error: ${err.message}`);
    }
    
    await db.insert(hiveSnapshots).values({
      userId: USER_ID,
      conversationId: conv.id,
      snapshotType: 'session_summary',
      title: 'Personal Facts Migration',
      content: 'Migration marker',
      metadata: { migrationType: 'personal_facts' },
    });
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log(`\n=== Batch complete! Saved ${totalFactsSaved} new facts ===`);
  process.exit(0);
}

runBatch().catch(e => { console.error(e); process.exit(1); });
