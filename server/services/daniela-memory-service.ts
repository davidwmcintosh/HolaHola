/**
 * Daniela Memory Service
 * 
 * Gives Daniela persistent memory of personal moments, not just learning data.
 * This includes:
 * - Relationship moments (rapport building, personal stories)
 * - Role reversal (when founder/student teaches Daniela something)
 * - Humor shared (jokes, funny moments)
 * - Explicit [REMEMBER] commands for things Daniela should not forget
 * - Session summaries capturing key non-learning moments
 * 
 * These memories are injected into Daniela's prompts via getPersonalMemoryContext()
 */

import { db } from "../db";
import { hiveSnapshots } from "@shared/schema";
import type { HiveSnapshotType, InsertHiveSnapshot } from "@shared/schema";
import { desc, eq, or, isNull, gte, and, sql } from "drizzle-orm";
import { callGemini, GEMINI_MODELS } from "../gemini-utils";

// Memory types for personal moments
export type PersonalMemoryType = 'relationship_moment' | 'role_reversal' | 'humor_shared';

// Structure for captured memories
export interface PersonalMemory {
  type: PersonalMemoryType;
  title: string;
  content: string;
  context?: string;
  importance: number; // 1-10
  userId?: string;
  language?: string;
  sessionId?: string;
}

// Structure for [REMEMBER] commands
export interface RememberCommand {
  content: string;
  source: 'daniela' | 'founder' | 'auto';
  context?: string;
}

// Session summary structure
export interface SessionSummary {
  sessionId: string;
  userId?: string;
  keyMoments: string[];
  jokesOrHumor?: string[];
  personalStories?: string[];
  lessonsLearned?: string[]; // Things Daniela learned from the founder
  emotionalHighlights?: string[];
}

class DanielaMemoryService {
  
  /**
   * Capture a personal memory moment
   */
  async capturePersonalMemory(memory: PersonalMemory): Promise<string | null> {
    try {
      const result = await db.insert(hiveSnapshots).values({
        snapshotType: memory.type as HiveSnapshotType,
        title: memory.title,
        content: memory.content,
        context: memory.context,
        importance: memory.importance,
        userId: memory.userId,
        language: memory.language,
        sessionId: memory.sessionId,
        metadata: {
          memoryType: 'personal',
          capturedAt: new Date().toISOString(),
        },
      }).returning({ id: hiveSnapshots.id });
      
      console.log(`[Daniela Memory] Captured ${memory.type}: "${memory.title}"`);
      return result[0]?.id || null;
    } catch (err: any) {
      console.error(`[Daniela Memory] Failed to capture memory: ${err.message}`);
      return null;
    }
  }
  
  /**
   * Detect and extract [REMEMBER: ...] commands from conversation
   */
  parseRememberCommands(text: string): RememberCommand[] {
    const commands: RememberCommand[] = [];
    
    // Match [REMEMBER: content] or [REMEMBER content]
    const regex = /\[REMEMBER[:\s]+([^\]]+)\]/gi;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      commands.push({
        content: match[1].trim(),
        source: 'daniela',
      });
    }
    
    return commands;
  }
  
  /**
   * Process and store [REMEMBER] commands
   */
  async processRememberCommands(
    text: string, 
    context: { userId?: string; sessionId?: string; language?: string }
  ): Promise<number> {
    const commands = this.parseRememberCommands(text);
    let stored = 0;
    
    for (const cmd of commands) {
      await this.capturePersonalMemory({
        type: 'relationship_moment',
        title: `Remembered: ${cmd.content.slice(0, 50)}...`,
        content: cmd.content,
        context: `Explicitly tagged for memory by ${cmd.source}`,
        importance: 8, // High importance for explicit memories
        userId: context.userId,
        sessionId: context.sessionId,
        language: context.language,
      });
      stored++;
    }
    
    if (stored > 0) {
      console.log(`[Daniela Memory] Stored ${stored} explicit [REMEMBER] commands`);
    }
    
    return stored;
  }
  
  /**
   * Detect role reversal moments (founder teaching Daniela)
   */
  async detectRoleReversal(
    founderMessage: string,
    danielaResponse: string,
    context: { userId?: string; sessionId?: string; language?: string }
  ): Promise<boolean> {
    // Keywords that suggest founder is teaching Daniela
    const teachingIndicators = [
      'let me teach you',
      'here\'s how',
      'i\'ll show you',
      'you should know',
      'the trick is',
      'the way to',
      'you need to learn',
      'let me explain',
      'this is how you',
      'i want to teach you',
    ];
    
    // Keywords in Daniela's response that confirm she's learning
    const learningIndicators = [
      'i learned',
      'thank you for teaching',
      'i didn\'t know',
      'that\'s new to me',
      'i\'ll remember',
      'i understand now',
      'oh i see',
      'thanks for showing',
    ];
    
    const founderLower = founderMessage.toLowerCase();
    const danielaLower = danielaResponse.toLowerCase();
    
    const founderTeaching = teachingIndicators.some(ind => founderLower.includes(ind));
    const danielaLearning = learningIndicators.some(ind => danielaLower.includes(ind));
    
    if (founderTeaching || danielaLearning) {
      await this.capturePersonalMemory({
        type: 'role_reversal',
        title: `Founder taught Daniela: ${founderMessage.slice(0, 50)}`,
        content: `Founder: ${founderMessage}\n\nDaniela: ${danielaResponse}`,
        context: 'Role reversal - founder teaching Daniela',
        importance: 9, // High importance - special moment
        userId: context.userId,
        sessionId: context.sessionId,
        language: context.language,
      });
      return true;
    }
    
    return false;
  }
  
  /**
   * Detect humor/joke moments
   */
  async detectHumorMoment(
    message: string,
    response: string,
    context: { userId?: string; sessionId?: string; language?: string }
  ): Promise<boolean> {
    const humorIndicators = [
      'joke',
      'funny',
      'laugh',
      'haha',
      'lol',
      'hilarious',
      'kidding',
      'humor',
      'comedy',
      'punchline',
      '😂', '🤣', '😆',
    ];
    
    const combinedText = (message + ' ' + response).toLowerCase();
    
    if (humorIndicators.some(ind => combinedText.includes(ind))) {
      await this.capturePersonalMemory({
        type: 'humor_shared',
        title: `Shared humor: ${message.slice(0, 50)}`,
        content: `Exchange: ${message}\n\nResponse: ${response}`,
        context: 'Lighthearted moment / humor',
        importance: 7,
        userId: context.userId,
        sessionId: context.sessionId,
        language: context.language,
      });
      return true;
    }
    
    return false;
  }
  
  /**
   * Generate end-of-session summary capturing personal moments
   */
  async generateSessionSummary(
    sessionId: string,
    messages: Array<{ role: string; content: string }>,
    context: { userId?: string; language?: string }
  ): Promise<SessionSummary | null> {
    if (messages.length < 5) {
      return null; // Not enough content for summary
    }
    
    try {
      const conversationText = messages
        .slice(-20) // Last 20 messages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n\n');
      
      const prompt = `Analyze this conversation and extract personal/memorable moments (NOT learning progress).

CONVERSATION:
${conversationText}

Extract:
1. KEY_MOMENTS: 2-3 memorable personal moments (not teaching outcomes)
2. JOKES_HUMOR: Any jokes told or funny exchanges (exact jokes if possible)
3. PERSONAL_STORIES: Personal anecdotes shared by either party
4. LESSONS_FOR_DANIELA: Things Daniela learned FROM the human (role reversal)
5. EMOTIONAL_HIGHLIGHTS: Moments of connection, encouragement, or shared emotion

Format as JSON:
{
  "keyMoments": ["moment1", "moment2"],
  "jokesOrHumor": ["joke1"],
  "personalStories": ["story1"],
  "lessonsLearned": ["lesson1"],
  "emotionalHighlights": ["highlight1"]
}

Only include non-empty arrays. Return {} if no memorable personal moments.`;

      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: prompt }
      ]);
      
      // Parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      const summary: SessionSummary = {
        sessionId,
        userId: context.userId,
        keyMoments: parsed.keyMoments || [],
        jokesOrHumor: parsed.jokesOrHumor,
        personalStories: parsed.personalStories,
        lessonsLearned: parsed.lessonsLearned,
        emotionalHighlights: parsed.emotionalHighlights,
      };
      
      // Store as snapshot if there's meaningful content
      if (summary.keyMoments.length > 0 || 
          (summary.jokesOrHumor && summary.jokesOrHumor.length > 0) ||
          (summary.lessonsLearned && summary.lessonsLearned.length > 0)) {
        
        await db.insert(hiveSnapshots).values({
          snapshotType: 'session_summary',
          sessionId,
          userId: context.userId,
          language: context.language,
          title: `Session summary: ${new Date().toLocaleDateString()}`,
          content: JSON.stringify(summary),
          importance: 7,
          metadata: {
            summaryType: 'personal_moments',
            messageCount: messages.length,
          },
        });
        
        console.log(`[Daniela Memory] Session summary saved for ${sessionId}`);
      }
      
      return summary;
    } catch (err: any) {
      console.error(`[Daniela Memory] Failed to generate session summary: ${err.message}`);
      return null;
    }
  }
  
  /**
   * Get personal memory context for prompt injection
   * This complements getRecentTeachingContext() with personal memories
   */
  async getPersonalMemoryContext(
    userId?: string,
    limit: number = 5
  ): Promise<string> {
    try {
      // Get personal memory snapshots
      const personalTypes: HiveSnapshotType[] = ['relationship_moment', 'role_reversal', 'humor_shared'];
      
      let query = db
        .select({
          snapshotType: hiveSnapshots.snapshotType,
          title: hiveSnapshots.title,
          content: hiveSnapshots.content,
          createdAt: hiveSnapshots.createdAt,
        })
        .from(hiveSnapshots)
        .where(
          and(
            sql`${hiveSnapshots.snapshotType} IN ('relationship_moment', 'role_reversal', 'humor_shared')`,
            or(
              isNull(hiveSnapshots.expiresAt),
              gte(hiveSnapshots.expiresAt, new Date())
            ),
            userId ? eq(hiveSnapshots.userId, userId) : sql`1=1`
          )
        )
        .orderBy(desc(hiveSnapshots.importance), desc(hiveSnapshots.createdAt))
        .limit(limit);
      
      const memories = await query;
      
      if (memories.length === 0) {
        return "";
      }
      
      // Format for prompt injection
      const memoryLines = memories.map(m => {
        const type = m.snapshotType === 'role_reversal' ? '🔄 Role Reversal' :
                     m.snapshotType === 'humor_shared' ? '😊 Shared Humor' :
                     '💫 Personal Moment';
        return `${type}: ${m.title}\n   ${m.content.slice(0, 200)}...`;
      });
      
      return `\n\n--- PERSONAL MEMORIES (things you should remember about this person) ---\n${memoryLines.join('\n\n')}`;
    } catch (err: any) {
      console.error(`[Daniela Memory] Failed to get personal context: ${err.message}`);
      return "";
    }
  }
  
  /**
   * Get recent session summaries for context
   */
  async getRecentSessionSummaries(
    userId?: string,
    limit: number = 3
  ): Promise<SessionSummary[]> {
    try {
      const summaries = await db
        .select({
          content: hiveSnapshots.content,
          sessionId: hiveSnapshots.sessionId,
        })
        .from(hiveSnapshots)
        .where(
          and(
            eq(hiveSnapshots.snapshotType, 'session_summary'),
            userId ? eq(hiveSnapshots.userId, userId) : sql`1=1`,
            sql`${hiveSnapshots.metadata}->>'summaryType' = 'personal_moments'`
          )
        )
        .orderBy(desc(hiveSnapshots.createdAt))
        .limit(limit);
      
      return summaries
        .map(s => {
          try {
            return JSON.parse(s.content) as SessionSummary;
          } catch {
            return null;
          }
        })
        .filter((s): s is SessionSummary => s !== null);
    } catch (err: any) {
      console.error(`[Daniela Memory] Failed to get session summaries: ${err.message}`);
      return [];
    }
  }
}

export const danielaMemoryService = new DanielaMemoryService();
