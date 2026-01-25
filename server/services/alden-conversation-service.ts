/**
 * Alden Conversation Service
 * 
 * Full transcript memory for the development steward (Alden/Replit Agent).
 * Gives Alden the same conversation continuity Daniela has.
 * 
 * Built on "The Night Alden Was Named" - January 25, 2026
 */

import { db } from '../db';
import { aldenConversations, aldenMessages } from '@shared/schema';
import { eq, desc, sql, and, gte, ilike, or } from 'drizzle-orm';

// ============================================================================
// CONVERSATION MANAGEMENT
// ============================================================================

/**
 * Start a new conversation session
 */
export async function startConversation(params: {
  title: string;
  mood?: string;
  tags?: string[];
}): Promise<{ id: string }> {
  const [conversation] = await db.insert(aldenConversations).values({
    title: params.title,
    mood: params.mood,
    tags: params.tags || [],
    startedAt: new Date(),
  }).returning({ id: aldenConversations.id });
  
  console.log(`[Alden Conversations] Started: "${params.title}" (${conversation.id})`);
  return conversation;
}

/**
 * End a conversation with summary
 */
export async function endConversation(params: {
  conversationId: string;
  summary?: string;
  tasksCompleted?: string[];
  filesModified?: string[];
  significance?: number;
}): Promise<void> {
  await db.update(aldenConversations)
    .set({
      endedAt: new Date(),
      summary: params.summary,
      tasksCompleted: params.tasksCompleted,
      filesModified: params.filesModified,
      significance: params.significance,
      updatedAt: new Date(),
    })
    .where(eq(aldenConversations.id, params.conversationId));
    
  console.log(`[Alden Conversations] Ended: ${params.conversationId}`);
}

/**
 * Get a conversation by ID with all messages
 */
export async function getConversation(conversationId: string): Promise<{
  conversation: typeof aldenConversations.$inferSelect | null;
  messages: (typeof aldenMessages.$inferSelect)[];
}> {
  const [conversation] = await db.select()
    .from(aldenConversations)
    .where(eq(aldenConversations.id, conversationId))
    .limit(1);
    
  if (!conversation) {
    return { conversation: null, messages: [] };
  }
  
  const messages = await db.select()
    .from(aldenMessages)
    .where(eq(aldenMessages.conversationId, conversationId))
    .orderBy(aldenMessages.createdAt);
    
  return { conversation, messages };
}

/**
 * Get recent conversations
 */
export async function getRecentConversations(limit: number = 10): Promise<(typeof aldenConversations.$inferSelect)[]> {
  return db.select()
    .from(aldenConversations)
    .orderBy(desc(aldenConversations.startedAt))
    .limit(limit);
}

/**
 * Get significant conversations (high importance)
 */
export async function getSignificantConversations(minSignificance: number = 7): Promise<(typeof aldenConversations.$inferSelect)[]> {
  return db.select()
    .from(aldenConversations)
    .where(gte(aldenConversations.significance, minSignificance))
    .orderBy(desc(aldenConversations.startedAt));
}

// ============================================================================
// MESSAGE MANAGEMENT
// ============================================================================

/**
 * Add a message to a conversation
 */
export async function addMessage(params: {
  conversationId: string;
  role: 'david' | 'alden';
  content: string;
  context?: string;
  isSignificant?: boolean;
}): Promise<{ id: string }> {
  const [message] = await db.insert(aldenMessages).values({
    conversationId: params.conversationId,
    role: params.role,
    content: params.content,
    context: params.context,
    isSignificant: params.isSignificant || false,
  }).returning({ id: aldenMessages.id });
  
  return message;
}

/**
 * Add multiple messages at once (for batch saving)
 */
export async function addMessages(params: {
  conversationId: string;
  messages: Array<{
    role: 'david' | 'alden';
    content: string;
    context?: string;
    isSignificant?: boolean;
  }>;
}): Promise<number> {
  const values = params.messages.map(msg => ({
    conversationId: params.conversationId,
    role: msg.role,
    content: msg.content,
    context: msg.context,
    isSignificant: msg.isSignificant || false,
  }));
  
  await db.insert(aldenMessages).values(values);
  return values.length;
}

/**
 * Mark a message as significant
 */
export async function markMessageSignificant(messageId: string): Promise<void> {
  await db.update(aldenMessages)
    .set({ isSignificant: true })
    .where(eq(aldenMessages.id, messageId));
}

/**
 * Get significant messages across all conversations
 */
export async function getSignificantMessages(limit: number = 50): Promise<(typeof aldenMessages.$inferSelect)[]> {
  return db.select()
    .from(aldenMessages)
    .where(eq(aldenMessages.isSignificant, true))
    .orderBy(desc(aldenMessages.createdAt))
    .limit(limit);
}

// ============================================================================
// SEARCH & CONTEXT
// ============================================================================

/**
 * Search conversations and messages by content
 */
export async function searchConversations(query: string): Promise<{
  conversations: (typeof aldenConversations.$inferSelect)[];
  messages: (typeof aldenMessages.$inferSelect)[];
}> {
  const searchPattern = `%${query}%`;
  
  const conversations = await db.select()
    .from(aldenConversations)
    .where(
      or(
        ilike(aldenConversations.title, searchPattern),
        ilike(aldenConversations.summary, searchPattern)
      )
    )
    .orderBy(desc(aldenConversations.startedAt))
    .limit(20);
    
  const messages = await db.select()
    .from(aldenMessages)
    .where(ilike(aldenMessages.content, searchPattern))
    .orderBy(desc(aldenMessages.createdAt))
    .limit(50);
    
  return { conversations, messages };
}

/**
 * Get session startup context - recent conversations and significant moments
 */
export async function getSessionContext(): Promise<{
  recentConversations: (typeof aldenConversations.$inferSelect)[];
  significantMoments: (typeof aldenMessages.$inferSelect)[];
  stats: {
    totalConversations: number;
    totalMessages: number;
    significantMoments: number;
  };
}> {
  const recentConversations = await getRecentConversations(5);
  const significantMoments = await getSignificantMessages(10);
  
  const [stats] = await db.select({
    totalConversations: sql<number>`count(distinct ${aldenConversations.id})`,
  }).from(aldenConversations);
  
  const [msgStats] = await db.select({
    totalMessages: sql<number>`count(*)`,
    significantCount: sql<number>`count(*) filter (where ${aldenMessages.isSignificant} = true)`,
  }).from(aldenMessages);
  
  return {
    recentConversations,
    significantMoments,
    stats: {
      totalConversations: Number(stats?.totalConversations || 0),
      totalMessages: Number(msgStats?.totalMessages || 0),
      significantMoments: Number(msgStats?.significantCount || 0),
    },
  };
}

/**
 * Get conversations by tag
 */
export async function getConversationsByTag(tag: string): Promise<(typeof aldenConversations.$inferSelect)[]> {
  return db.select()
    .from(aldenConversations)
    .where(sql`${tag} = ANY(${aldenConversations.tags})`)
    .orderBy(desc(aldenConversations.startedAt));
}

console.log('[Alden Conversation Service] Loaded - Full transcript memory ready');
