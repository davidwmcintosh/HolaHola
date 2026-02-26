/**
 * Neural Memory Search Service
 * 
 * Provides on-demand memory lookup for Daniela's neural network.
 * Instead of relying solely on pre-loaded context in the system prompt,
 * Daniela can actively query her memory when specific people, topics,
 * or questions arise mid-conversation.
 * 
 * This enables "infinite memory" - even if something was mentioned years ago,
 * Daniela can recall it when directly asked or when it becomes relevant.
 */

import { db, getSharedDb, getUserDb } from '../db';
import { storage } from '../storage';
import {
  peopleConnections,
  studentInsights,
  learningMotivations,
  recurringStruggles,
  sessionNotes,
  actflAssessmentEvents,
  languageIdioms,
  culturalNuances,
  tutorProcedures,
  teachingPrinciples,
  learnerErrorPatterns,
  situationalPatterns,
  subtletyCues,
  emotionalPatterns,
  creativityTemplates,
  curriculumPaths,
  curriculumUnits,
  curriculumLessons,
  curriculumDrillItems,
  messages,
  conversations,
  danielaGrowthMemories,
  toolKnowledge,
  danielaNotes,
  type PeopleConnection,
  type StudentInsight,
  type LearningMotivation,
  type RecurringStruggle,
  type SessionNote,
  type LanguageIdiom,
  type CulturalNuance,
  type TutorProcedure,
  type TeachingPrinciple,
  type SituationalPattern,
  type SubtletyCue,
  type EmotionalPattern,
  type CreativityTemplate,
  type CurriculumPath,
  type CurriculumUnit,
  type CurriculumLesson,
  type DanielaGrowthMemory,
  type ToolKnowledge,
  type DanielaNote,
} from '@shared/schema';
import { eq, sql, desc, and, or, ilike, gte } from 'drizzle-orm';

/**
 * Tutor name to language mapping
 * Used to search conversations by tutor name (e.g., "What did I tell Isabel?" → search Portuguese)
 */
const TUTOR_NAME_TO_LANGUAGE: Record<string, string> = {
  'daniela': 'spanish',
  'agustin': 'spanish',
  'isabel': 'portuguese',
  'camilo': 'portuguese',
  'juliette': 'french',
  'vincent': 'french',
  'greta': 'german',
  'lukas': 'german',
  'liv': 'italian',
  'luca': 'italian',
  'yuki': 'japanese',
  'daisuke': 'japanese',
  'jihyun': 'korean',
  'minho': 'korean',
  'hua': 'mandarin chinese',
  'tao': 'mandarin chinese',
  'blake': 'english',
  'cindy': 'english',
  'yael': 'hebrew',
  'noam': 'hebrew',
};

/**
 * Extract tutor name from query and return corresponding language
 */
function extractTutorLanguage(query: string): string | null {
  const normalizedQuery = query.toLowerCase();
  for (const [tutorName, language] of Object.entries(TUTOR_NAME_TO_LANGUAGE)) {
    if (normalizedQuery.includes(tutorName)) {
      return language;
    }
  }
  return null;
}

/**
 * Memory search result with source attribution
 */
export interface MemorySearchResult {
  domain: 'person' | 'motivation' | 'insight' | 'struggle' | 'session' | 'progress' | 'conversation';
  relevance: number; // 0-1 score
  summary: string; // Human-readable summary for Daniela
  details: string; // Full context
  timestamp: Date | null;
  source: string; // Where this memory came from
}

/**
 * Combined memory search response
 */
export interface MemorySearchResponse {
  query: string;
  studentId: string;
  results: MemorySearchResult[];
  searchedDomains: string[];
  totalMatches: number;
}

/**
 * Full-text semantic search for messages using PostgreSQL tsvector
 * This finds related content even without exact keyword matches.
 * Returns messages ranked by relevance.
 */
export async function semanticSearchMessages(
  studentId: string,
  searchQuery: string,
  limit: number = 50
): Promise<Array<{
  messageId: string;
  content: string;
  role: string;
  conversationId: string;
  language: string | null;
  conversationTitle: string | null;
  createdAt: Date | null;
  rank: number;
}>> {
  try {
    const sharedDb = getSharedDb();
    
    // Convert query to tsquery format - handle phrases and individual words
    // Use minimal filtering for multilingual support with 'simple' config
    // Only filter very short words (1-2 chars) to keep language-specific tokens
    const words = searchQuery.toLowerCase().trim().split(/\s+/).filter(w => w.length > 2);
    
    // Minimal stop words that are common across multiple languages
    // Keeping this very minimal since 'simple' config doesn't stem, so we want most words
    const minimalStopWords = ['the', 'and', 'for'];
    const significantWords = words.filter(w => !minimalStopWords.includes(w));
    
    // If all words were filtered, use original words
    const queryWords = significantWords.length > 0 ? significantWords : words;
    
    if (queryWords.length === 0) {
      return [];
    }
    
    // Build OR query for broader matching
    const tsqueryText = queryWords.join(' | ');
    
    // Use 'simple' config for multilingual content (Spanish, Portuguese, Japanese, etc.)
    // 'simple' doesn't stem words but matches exact tokens across all languages
    const results = await sharedDb.execute(sql`
      SELECT 
        m.id as "messageId",
        m.content,
        m.role,
        m.conversation_id as "conversationId",
        c.language,
        c.title as "conversationTitle",
        m.created_at as "createdAt",
        ts_rank(m.search_vector::tsvector, to_tsquery('simple', ${tsqueryText})) as rank
      FROM messages m
      INNER JOIN conversations c ON m.conversation_id = c.id
      WHERE c.user_id = ${studentId}
        AND m.search_vector::tsvector @@ to_tsquery('simple', ${tsqueryText})
      ORDER BY rank DESC, m.created_at DESC
      LIMIT ${limit}
    `);
    
    return results.rows as any[];
  } catch (err: any) {
    console.error('[NeuralMemory] Semantic search error:', err.message);
    return [];
  }
}

/**
 * Search across all memory domains for a student
 * 
 * @param studentId - The student to search memories for
 * @param query - The search query (name, topic, question)
 * @param domains - Optional: limit to specific domains
 */
export async function searchMemory(
  studentId: string,
  query: string,
  domains?: ('person' | 'motivation' | 'insight' | 'struggle' | 'session' | 'progress' | 'conversation')[]
): Promise<MemorySearchResponse> {
  const results: MemorySearchResult[] = [];
  const searchedDomains: string[] = [];
  
  // Normalize query for case-insensitive matching
  const normalizedQuery = query.toLowerCase().trim();
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 2);
  
  // Build search pattern for SQL ILIKE (exact phrase match)
  const searchPattern = `%${normalizedQuery}%`;
  
  // Build keyword patterns for conversation search (matches ANY significant word)
  // This allows finding "song on the radio" when searching for "car song radio"
  const significantWords = queryWords.filter(w => 
    !['the', 'and', 'for', 'that', 'with', 'from', 'have', 'was', 'were', 'are', 'been', 'being', 'about', 'what', 'when', 'where', 'which', 'who', 'how', 'you', 'your', 'they', 'them', 'this', 'these', 'those'].includes(w)
  );
  const keywordPatterns = significantWords.map(w => `%${w}%`);
  
  const domainsToSearch = domains || ['person', 'motivation', 'insight', 'struggle', 'session', 'progress', 'conversation'];
  
  // Search each domain in parallel
  const searchPromises: Promise<void>[] = [];
  
  // === PEOPLE CONNECTIONS (USER database - per-user data) ===
  if (domainsToSearch.includes('person')) {
    searchedDomains.push('person');
    searchPromises.push((async () => {
      try {
        const connections = await getUserDb().select().from(peopleConnections)
          .where(and(
            eq(peopleConnections.isActive, true),
            or(
              eq(peopleConnections.personAId, studentId),
              eq(peopleConnections.personBId, studentId)
            ),
            or(
              ilike(peopleConnections.pendingPersonName, searchPattern),
              ilike(peopleConnections.pendingPersonContext, searchPattern),
              ilike(peopleConnections.relationshipDetails, searchPattern),
              ilike(peopleConnections.relationshipType, searchPattern)
            )
          ))
          .orderBy(desc(peopleConnections.confidenceScore))
          .limit(10);
        
        for (const conn of connections) {
          const personName = conn.pendingPersonName || 'Unknown person';
          const context = [conn.relationshipDetails, conn.pendingPersonContext].filter(Boolean).join('. ');
          
          results.push({
            domain: 'person',
            relevance: conn.confidenceScore || 0.5,
            summary: `${personName} - ${conn.relationshipType}`,
            details: context || `A ${conn.relationshipType} mentioned by the student.`,
            timestamp: conn.createdAt,
            source: 'people_connections',
          });
        }
      } catch (err: any) {
        console.error('[NeuralMemory] Error searching people:', err.message);
      }
    })());
  }
  
  // === STUDENT INSIGHTS (SHARED database) ===
  if (domainsToSearch.includes('insight')) {
    searchedDomains.push('insight');
    searchPromises.push((async () => {
      try {
        const insights = await getSharedDb().select().from(studentInsights)
          .where(and(
            eq(studentInsights.studentId, studentId),
            eq(studentInsights.isActive, true),
            or(
              ilike(studentInsights.insight, searchPattern),
              ilike(studentInsights.insightType, searchPattern),
              ilike(studentInsights.evidence, searchPattern)
            )
          ))
          .orderBy(desc(studentInsights.confidenceScore))
          .limit(10);
        
        for (const insight of insights) {
          results.push({
            domain: 'insight',
            relevance: insight.confidenceScore || 0.5,
            summary: `[${insight.insightType}] ${insight.insight.substring(0, 100)}...`,
            details: insight.insight + (insight.evidence ? ` Evidence: ${insight.evidence}` : ''),
            timestamp: insight.createdAt,
            source: 'student_insights',
          });
        }
      } catch (err: any) {
        console.error('[NeuralMemory] Error searching insights:', err.message);
      }
    })());
  }
  
  // === LEARNING MOTIVATIONS (USER database - per-user data) ===
  if (domainsToSearch.includes('motivation')) {
    searchedDomains.push('motivation');
    searchPromises.push((async () => {
      try {
        const motivations = await getUserDb().select().from(learningMotivations)
          .where(and(
            eq(learningMotivations.studentId, studentId),
            eq(learningMotivations.status, 'active'),
            or(
              ilike(learningMotivations.motivation, searchPattern),
              ilike(learningMotivations.details, searchPattern)
            )
          ))
          .orderBy(desc(learningMotivations.createdAt))
          .limit(5);
        
        for (const mot of motivations) {
          const targetDate = mot.targetDate ? ` (target: ${new Date(mot.targetDate).toLocaleDateString()})` : '';
          results.push({
            domain: 'motivation',
            relevance: 0.7,
            summary: mot.motivation + targetDate,
            details: mot.details || mot.motivation,
            timestamp: mot.createdAt,
            source: 'learning_motivations',
          });
        }
      } catch (err: any) {
        console.error('[NeuralMemory] Error searching motivations:', err.message);
      }
    })());
  }
  
  // === RECURRING STRUGGLES (USER database - per-user data) ===
  if (domainsToSearch.includes('struggle')) {
    searchedDomains.push('struggle');
    searchPromises.push((async () => {
      try {
        const struggles = await getUserDb().select().from(recurringStruggles)
          .where(and(
            eq(recurringStruggles.studentId, studentId),
            or(
              ilike(recurringStruggles.struggleArea, searchPattern),
              ilike(recurringStruggles.description, searchPattern),
              ilike(recurringStruggles.specificExamples, searchPattern)
            )
          ))
          .orderBy(desc(recurringStruggles.occurrenceCount))
          .limit(5);
        
        for (const struggle of struggles) {
          results.push({
            domain: 'struggle',
            relevance: Math.min(1, (struggle.occurrenceCount || 1) / 10),
            summary: `[${struggle.struggleArea}] ${struggle.description.substring(0, 100)}`,
            details: struggle.description + (struggle.specificExamples ? ` Examples: ${struggle.specificExamples}` : ''),
            timestamp: struggle.lastOccurredAt || struggle.createdAt,
            source: 'recurring_struggles',
          });
        }
      } catch (err: any) {
        console.error('[NeuralMemory] Error searching struggles:', err.message);
      }
    })());
  }
  
  // === SESSION NOTES (USER database - per-user data) ===
  if (domainsToSearch.includes('session')) {
    searchedDomains.push('session');
    searchPromises.push((async () => {
      try {
        const notes = await getUserDb().select().from(sessionNotes)
          .where(and(
            eq(sessionNotes.studentId, studentId),
            or(
              ilike(sessionNotes.wins, searchPattern),
              ilike(sessionNotes.challenges, searchPattern),
              ilike(sessionNotes.nextSteps, searchPattern),
              ilike(sessionNotes.summary, searchPattern)
            )
          ))
          .orderBy(desc(sessionNotes.createdAt))
          .limit(5);
        
        for (const note of notes) {
          const parts = [
            note.wins ? `Wins: ${note.wins}` : '',
            note.challenges ? `Challenges: ${note.challenges}` : '',
            note.nextSteps ? `Next steps: ${note.nextSteps}` : '',
          ].filter(Boolean);
          
          results.push({
            domain: 'session',
            relevance: 0.6,
            summary: `Session from ${note.createdAt ? new Date(note.createdAt).toLocaleDateString() : 'unknown date'}`,
            details: parts.join('. ') || note.summary || 'No details recorded.',
            timestamp: note.createdAt,
            source: 'session_notes',
          });
        }
      } catch (err: any) {
        console.error('[NeuralMemory] Error searching sessions:', err.message);
      }
    })());
  }
  
  // === PROGRESS (ACTFL Assessments) - USER database ===
  if (domainsToSearch.includes('progress')) {
    searchedDomains.push('progress');
    searchPromises.push((async () => {
      try {
        const assessments = await getUserDb().select().from(actflAssessmentEvents)
          .where(eq(actflAssessmentEvents.userId, studentId))
          .orderBy(desc(actflAssessmentEvents.createdAt))
          .limit(5);
        
        for (const assessment of assessments) {
          // Check if query relates to progress/level/improvement
          const progressTerms = ['progress', 'level', 'improving', 'better', 'actfl', 'proficiency'];
          const isProgressQuery = progressTerms.some(term => normalizedQuery.includes(term));
          
          if (isProgressQuery || assessments.length <= 3) {
            results.push({
              domain: 'progress',
              relevance: 0.7,
              summary: `${assessment.language}: ${assessment.previousLevel || 'started'} → ${assessment.newLevel}`,
              details: `Assessed at ${assessment.newLevel} level in ${assessment.language}. ${assessment.direction || ''}`,
              timestamp: assessment.createdAt,
              source: 'actfl_assessment_events',
            });
          }
        }
      } catch (err: any) {
        console.error('[NeuralMemory] Error searching progress:', err.message);
      }
    })());
  }
  
  // === CONVERSATION HISTORY (Cross-tutor memory) ===
  if (domainsToSearch.includes('conversation')) {
    searchedDomains.push('conversation');
    searchPromises.push((async () => {
      try {
        console.log(`[NeuralMemory] Starting conversation search for student ${studentId}, query: "${query}", keywords: [${significantWords.join(', ')}]`);
        
        // Check if query mentions a specific tutor by name
        // e.g., "What did I tell Isabel?" → search Portuguese conversations
        const tutorLanguage = extractTutorLanguage(query);
        const tutorName = tutorLanguage ? 
          Object.entries(TUTOR_NAME_TO_LANGUAGE).find(([_, lang]) => lang === tutorLanguage)?.[0] : null;
        
        let recentConvos: any[];
        let semanticRanks: Map<string, number> = new Map();
        
        if (tutorLanguage) {
          // Search by tutor's language - get recent conversations with that tutor
          console.log(`[NeuralMemory] Detected tutor name in query, searching ${tutorLanguage} conversations`);
          const tutorConvos = await getSharedDb()
            .select({
              messageId: messages.id,
              content: messages.content,
              role: messages.role,
              conversationId: messages.conversationId,
              language: conversations.language,
              conversationTitle: conversations.title,
              createdAt: messages.createdAt,
            })
            .from(messages)
            .innerJoin(conversations, eq(messages.conversationId, conversations.id))
            .where(and(
              eq(conversations.userId, studentId),
              eq(conversations.language, tutorLanguage)
            ))
            .orderBy(desc(messages.createdAt))
            .limit(20);
          
          // Also search for tutor name mentions across ALL conversations (if tutorName is valid)
          let crossTutorByName: typeof tutorConvos = [];
          if (tutorName && tutorName.length > 0) {
            crossTutorByName = await getSharedDb()
              .select({
                messageId: messages.id,
                content: messages.content,
                role: messages.role,
                conversationId: messages.conversationId,
                language: conversations.language,
                conversationTitle: conversations.title,
                createdAt: messages.createdAt,
              })
              .from(messages)
              .innerJoin(conversations, eq(messages.conversationId, conversations.id))
              .where(and(
                eq(conversations.userId, studentId),
                ilike(messages.content, `%${tutorName}%`)
              ))
              .orderBy(desc(messages.createdAt))
              .limit(10);
          }
          
          // Also search for the actual query content across ALL languages
          // This catches the topic itself (e.g., "reggaeton") regardless of which tutor session it was in
          // Use keyword-based matching to find messages with ANY significant word
          const keywordConditions = keywordPatterns.length > 0 
            ? keywordPatterns.map(pattern => ilike(messages.content, pattern))
            : [ilike(messages.content, searchPattern)];
          
          // Limit ILIKE to recent 6 months — avoids full sequential scan on large history.
          // Older memories are covered by semanticSearchMessages (full-text index via search_vector).
          const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
          const crossTutorByContent = await getSharedDb()
            .select({
              messageId: messages.id,
              content: messages.content,
              role: messages.role,
              conversationId: messages.conversationId,
              language: conversations.language,
              conversationTitle: conversations.title,
              createdAt: messages.createdAt,
            })
            .from(messages)
            .innerJoin(conversations, eq(messages.conversationId, conversations.id))
            .where(and(
              eq(conversations.userId, studentId),
              gte(messages.createdAt, sixMonthsAgo),
              or(...keywordConditions)
            ))
            .orderBy(desc(messages.createdAt))
            .limit(100);
          
          // Also run semantic search for broader matching (finds related content even without exact keywords)
          const semanticResults = await semanticSearchMessages(studentId, query, 100);
          
          // Merge results, deduplicate by message ID, and combine rankings
          const seenIds = new Set<string>();
          const messageRankings = new Map<string, { msg: typeof tutorConvos[0], semanticRank?: number }>();
          
          // Add all sources with deduplication
          const allMessages = [...tutorConvos, ...crossTutorByName, ...crossTutorByContent];
          for (const msg of allMessages) {
            if (!seenIds.has(msg.messageId)) {
              seenIds.add(msg.messageId);
              messageRankings.set(msg.messageId, { msg });
            }
          }
          
          // Add semantic results with ranking info
          for (const semResult of semanticResults) {
            if (!seenIds.has(semResult.messageId)) {
              seenIds.add(semResult.messageId);
              messageRankings.set(semResult.messageId, { 
                msg: {
                  messageId: semResult.messageId,
                  content: semResult.content,
                  role: semResult.role,
                  conversationId: semResult.conversationId,
                  language: semResult.language ?? null,
                  conversationTitle: semResult.conversationTitle ?? null,
                  createdAt: semResult.createdAt ?? null,
                } as typeof tutorConvos[0],
                semanticRank: semResult.rank
              });
            } else {
              // Message already found by keyword search - add semantic rank
              const existing = messageRankings.get(semResult.messageId);
              if (existing) {
                existing.semanticRank = semResult.rank;
              }
            }
          }
          
          // Build final list sorted by: semantic rank (if present) > recency
          // Store semantic ranks in a map for later use in relevance scoring
          semanticRanks = new Map<string, number>();
          const sortedResults = Array.from(messageRankings.values())
            .sort((a, b) => {
              // Messages with high semantic rank come first
              if (a.semanticRank && b.semanticRank) {
                return b.semanticRank - a.semanticRank;
              }
              if (a.semanticRank && !b.semanticRank) return -1;
              if (!a.semanticRank && b.semanticRank) return 1;
              // Fall back to recency
              const aTime = a.msg.createdAt ? new Date(a.msg.createdAt).getTime() : 0;
              const bTime = b.msg.createdAt ? new Date(b.msg.createdAt).getTime() : 0;
              return bTime - aTime;
            });
          
          for (const r of sortedResults) {
            if (r.semanticRank) {
              semanticRanks.set(r.msg.messageId, r.semanticRank);
            }
          }
          recentConvos = sortedResults.map(r => r.msg);
          
          console.log(`[NeuralMemory] Tutor search: ${tutorConvos.length} from ${tutorLanguage}, ${crossTutorByName.length} name mentions, ${crossTutorByContent.length} content matches, ${semanticResults.length} semantic matches`);
        } else {
          // Check if this is a "recent/today" query that should just return recent messages
          const recentTerms = ['recent', 'today', 'earlier', 'last', 'previous', 'past', 'before', 'ago', 'just', 'chat', 'conversation', 'talked', 'said', 'told', 'discussed', 'mentioned'];
          const isRecentQuery = recentTerms.some(term => normalizedQuery.includes(term));
          
          if (isRecentQuery) {
            // Just return recent messages without content filtering
            console.log(`[NeuralMemory] Detected "recent conversations" query - returning recent messages`);
            recentConvos = await getSharedDb()
              .select({
                messageId: messages.id,
                content: messages.content,
                role: messages.role,
                conversationId: messages.conversationId,
                language: conversations.language,
                conversationTitle: conversations.title,
                createdAt: messages.createdAt,
              })
              .from(messages)
              .innerJoin(conversations, eq(messages.conversationId, conversations.id))
              .where(eq(conversations.userId, studentId))
              .orderBy(desc(messages.createdAt))
              .limit(30); // Get more messages for context
          } else {
            // Search by content match across ALL languages/tutors
            // Use keyword-based matching to find messages with ANY significant word
            const contentKeywordConditions = keywordPatterns.length > 0 
              ? keywordPatterns.map(pattern => ilike(messages.content, pattern))
              : [ilike(messages.content, searchPattern)];
            
            // Run keyword, semantic, AND baseline recent search in parallel
            // The baseline ensures Daniela always "sees" recent conversations even if they don't match the query
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const sixMonthsAgoKeyword = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
            
            const [keywordResults, semanticResults, baselineRecent] = await Promise.all([
              getSharedDb()
                .select({
                  messageId: messages.id,
                  content: messages.content,
                  role: messages.role,
                  conversationId: messages.conversationId,
                  language: conversations.language,
                  conversationTitle: conversations.title,
                  createdAt: messages.createdAt,
                })
                .from(messages)
                .innerJoin(conversations, eq(messages.conversationId, conversations.id))
                .where(and(
                  eq(conversations.userId, studentId),
                  gte(messages.createdAt, sixMonthsAgoKeyword),
                  or(...contentKeywordConditions)
                ))
                .orderBy(desc(messages.createdAt))
                .limit(100),
              semanticSearchMessages(studentId, query, 100),
              // BASELINE: Always fetch recent messages so Daniela has visibility into recent activity
              getSharedDb()
                .select({
                  messageId: messages.id,
                  content: messages.content,
                  role: messages.role,
                  conversationId: messages.conversationId,
                  language: conversations.language,
                  conversationTitle: conversations.title,
                  createdAt: messages.createdAt,
                })
                .from(messages)
                .innerJoin(conversations, eq(messages.conversationId, conversations.id))
                .where(and(
                  eq(conversations.userId, studentId),
                  gte(messages.createdAt, sevenDaysAgo)
                ))
                .orderBy(desc(messages.createdAt))
                .limit(30)
            ]);
            
            // Merge and deduplicate, prioritizing semantic rank
            const seenIds = new Set<string>();
            const messageRankings = new Map<string, { msg: typeof keywordResults[0], semanticRank?: number, isRecentBaseline?: boolean }>();
            
            for (const msg of keywordResults) {
              if (!seenIds.has(msg.messageId)) {
                seenIds.add(msg.messageId);
                messageRankings.set(msg.messageId, { msg });
              }
            }
            
            for (const semResult of semanticResults) {
              if (!seenIds.has(semResult.messageId)) {
                seenIds.add(semResult.messageId);
                messageRankings.set(semResult.messageId, { 
                  msg: {
                    messageId: semResult.messageId,
                    content: semResult.content,
                    role: semResult.role,
                    conversationId: semResult.conversationId,
                    language: semResult.language ?? null,
                    conversationTitle: semResult.conversationTitle ?? null,
                    createdAt: semResult.createdAt ?? null,
                  } as typeof keywordResults[0],
                  semanticRank: semResult.rank
                });
              } else {
                const existing = messageRankings.get(semResult.messageId);
                if (existing) {
                  existing.semanticRank = semResult.rank;
                }
              }
            }
            
            // BASELINE RECENT: Always include recent messages regardless of content match
            // This ensures Daniela "sees" recent activity even when query doesn't match
            for (const msg of baselineRecent) {
              if (!seenIds.has(msg.messageId)) {
                seenIds.add(msg.messageId);
                messageRankings.set(msg.messageId, { msg, isRecentBaseline: true });
              }
            }
            
            // Sort by semantic rank first, then recency
            // Also populate semanticRanks for relevance scoring
            const sortedContentResults = Array.from(messageRankings.values())
              .sort((a, b) => {
                if (a.semanticRank && b.semanticRank) return b.semanticRank - a.semanticRank;
                if (a.semanticRank && !b.semanticRank) return -1;
                if (!a.semanticRank && b.semanticRank) return 1;
                const aTime = a.msg.createdAt ? new Date(a.msg.createdAt).getTime() : 0;
                const bTime = b.msg.createdAt ? new Date(b.msg.createdAt).getTime() : 0;
                return bTime - aTime;
              });
            
            for (const r of sortedContentResults) {
              if (r.semanticRank) {
                semanticRanks.set(r.msg.messageId, r.semanticRank);
              }
            }
            recentConvos = sortedContentResults.map(r => r.msg);
            
            console.log(`[NeuralMemory] Content search: ${keywordResults.length} keyword, ${semanticResults.length} semantic, ${baselineRecent.length} baseline recent`);
          }
        }
        
        // Get tutor display name for the language
        const getTutorDisplayName = (lang: string): string => {
          const tutorEntry = Object.entries(TUTOR_NAME_TO_LANGUAGE)
            .find(([name, language]) => language === lang && name.charAt(0) === name.charAt(0).toLowerCase());
          if (tutorEntry) {
            return tutorEntry[0].charAt(0).toUpperCase() + tutorEntry[0].slice(1);
          }
          return lang;
        };
        
        // Calculate recency boost - messages from last 14 days get a boost
        // This ensures recent conversations are always visible even if content doesn't match well
        const now = Date.now();
        const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        
        for (const msg of recentConvos) {
          const tutorDisplayName = msg.language ? getTutorDisplayName(msg.language) : 'Tutor';
          const roleLabel = msg.role === 'user' ? 'You said to ' + tutorDisplayName : tutorDisplayName + ' said';
          const langLabel = msg.language ? `[${msg.language}]` : '';
          
          // Calculate relevance: base score + semantic rank boost + recency boost
          const baseRelevance = tutorLanguage ? 0.85 : 0.7;
          const semanticRank = semanticRanks.get(msg.messageId) || 0;
          // Normalize semantic rank (typically 0-0.5) to 0-0.2 boost
          const semanticBoost = Math.min(semanticRank * 0.4, 0.2);
          
          // Recency boost: +0.15 for messages in last 7 days, +0.08 for last 14 days
          // This ensures Daniela "remembers" recent conversations naturally
          let recencyBoost = 0;
          if (msg.createdAt) {
            const msgTime = new Date(msg.createdAt).getTime();
            const age = now - msgTime;
            if (age < sevenDaysMs) {
              recencyBoost = 0.15; // Very recent - strong boost
            } else if (age < fourteenDaysMs) {
              recencyBoost = 0.08; // Recent - moderate boost
            }
          }
          
          const relevance = Math.min(baseRelevance + semanticBoost + recencyBoost, 0.99);
          
          results.push({
            domain: 'conversation',
            relevance,
            summary: `${langLabel} ${roleLabel}: "${msg.content?.substring(0, 80)}..."`,
            details: msg.content || '',
            timestamp: msg.createdAt,
            source: `conversation:${msg.conversationId}`,
          });
        }
        
        console.log(`[NeuralMemory] Conversation search found ${recentConvos.length} messages for "${query}"${tutorLanguage ? ` (tutor: ${tutorLanguage})` : ''}`);
      } catch (err: any) {
        console.error('[NeuralMemory] Error searching conversations:', err.message);
      }
    })());
  }
  
  // Wait for all searches to complete
  await Promise.all(searchPromises);
  
  // Sort by relevance (highest first)
  results.sort((a, b) => b.relevance - a.relevance);
  
  return {
    query,
    studentId,
    results,
    searchedDomains,
    totalMatches: results.length,
  };
}

/**
 * Format memory search results for injection into conversation
 * This creates a natural, readable format for Daniela to use
 */
export function formatMemoryForConversation(response: MemorySearchResponse): string {
  if (response.results.length === 0) {
    return `[Memory search for "${response.query}": No memories found]`;
  }
  
  const lines: string[] = [];
  lines.push(`\n═══ MEMORY RECALL: "${response.query}" ═══`);
  lines.push(`Found ${response.totalMatches} relevant memories:\n`);
  
  // Group by domain
  const byDomain = new Map<string, MemorySearchResult[]>();
  for (const result of response.results) {
    if (!byDomain.has(result.domain)) {
      byDomain.set(result.domain, []);
    }
    byDomain.get(result.domain)!.push(result);
  }
  
  const domainLabels: Record<string, string> = {
    person: '👥 People',
    motivation: '🎯 Motivations',
    insight: '💡 Insights',
    struggle: '⚠️ Struggles',
    session: '📝 Past Sessions',
    progress: '📈 Progress',
    conversation: '💬 Past Conversations',
  };
  
  for (const [domain, domainResults] of Array.from(byDomain)) {
    lines.push(`${domainLabels[domain] || domain}:`);
    for (const result of domainResults.slice(0, 3)) { // Max 3 per domain
      const date = result.timestamp ? ` (${new Date(result.timestamp).toLocaleDateString()})` : '';
      lines.push(`  • ${result.summary}${date}`);
      if (result.details && result.details !== result.summary) {
        lines.push(`    └─ ${result.details.substring(0, 200)}`);
      }
    }
    lines.push('');
  }
  
  lines.push('═══════════════════════════════════════');
  
  return lines.join('\n');
}

/**
 * Quick lookup for a specific person by name
 * Optimized for the common case of "Do you remember X?"
 */
export async function lookupPerson(
  studentId: string,
  personName: string
): Promise<MemorySearchResult[]> {
  const response = await searchMemory(studentId, personName, ['person']);
  return response.results;
}

/**
 * Get a summary of what Daniela knows about a student
 * Useful for "What do you know about me?" type questions
 */
export async function getStudentMemorySummary(studentId: string): Promise<string> {
  // Student memory tables are in USER database (per-user data)
  // studentInsights is in SHARED database (Daniela's intelligence)
  const [people, insights, motivations, struggles] = await Promise.all([
    getUserDb().select().from(peopleConnections)
      .where(and(
        eq(peopleConnections.isActive, true),
        or(
          eq(peopleConnections.personAId, studentId),
          eq(peopleConnections.personBId, studentId)
        )
      ))
      .limit(100),
    getSharedDb().select().from(studentInsights)
      .where(and(
        eq(studentInsights.studentId, studentId),
        eq(studentInsights.isActive, true)
      ))
      .limit(100),
    getUserDb().select().from(learningMotivations)
      .where(and(
        eq(learningMotivations.studentId, studentId),
        eq(learningMotivations.status, 'active')
      ))
      .limit(20),
    getUserDb().select().from(recurringStruggles)
      .where(eq(recurringStruggles.studentId, studentId))
      .limit(20),
  ]);
  
  const lines: string[] = [];
  lines.push('\n═══ YOUR MEMORY BANKS ═══');
  lines.push(`I have memories about this student across ${[people.length > 0, insights.length > 0, motivations.length > 0, struggles.length > 0].filter(Boolean).length} domains:`);
  lines.push('');
  
  if (people.length > 0) {
    const namedPeople = people.filter(p => p.pendingPersonName).map(p => p.pendingPersonName);
    lines.push(`👥 ${people.length} people connections: ${namedPeople.slice(0, 5).join(', ')}${namedPeople.length > 5 ? '...' : ''}`);
  }
  
  if (insights.length > 0) {
    lines.push(`💡 ${insights.length} personal insights about them`);
  }
  
  if (motivations.length > 0) {
    lines.push(`🎯 ${motivations.length} learning motivations`);
  }
  
  if (struggles.length > 0) {
    lines.push(`⚠️ ${struggles.length} areas they tend to struggle with`);
  }
  
  lines.push('');
  lines.push('Use [MEMORY_LOOKUP query] to search for specific memories.');
  lines.push('═══════════════════════════════════════');
  
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEACHING KNOWLEDGE DOMAINS (Phase 1: On-Demand Recall)
// These are language-specific (not student-specific) teaching knowledge
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Teaching memory search result
 */
export interface TeachingMemoryResult {
  domain: 'idiom' | 'cultural' | 'procedure' | 'procedures' | 'principle' | 'principles' | 'error-pattern' | 'situational-pattern' | 'patterns' | 'subtlety-cue' | 'emotional-pattern' | 'creativity-template' | 'growth' | 'tools' | 'notes';
  relevance: number;
  summary: string;
  details: string;
  language: string | null;
  source: string;
}

/**
 * Teaching memory search response
 */
export interface TeachingMemoryResponse {
  query: string;
  language: string | null;
  results: TeachingMemoryResult[];
  searchedDomains: string[];
  totalMatches: number;
}

/**
 * Search Daniela's teaching knowledge base
 * Unlike student memory, this is filtered by LANGUAGE, not studentId
 * 
 * @param query - The search query (topic, phrase, situation)
 * @param language - Target language (optional, searches all if not provided)
 * @param domains - Limit to specific teaching domains
 */
export async function searchTeachingKnowledge(
  query: string,
  language?: string,
  domains?: ('idiom' | 'cultural' | 'procedure' | 'procedures' | 'principle' | 'principles' | 'error-pattern' | 'situational-pattern' | 'patterns' | 'subtlety-cue' | 'emotional-pattern' | 'creativity-template' | 'growth' | 'tools' | 'notes')[]
): Promise<TeachingMemoryResponse> {
  const results: TeachingMemoryResult[] = [];
  const searchedDomains: string[] = [];
  
  const normalizedQuery = query.toLowerCase().trim();
  const searchPattern = `%${normalizedQuery}%`;
  
  const domainsToSearch = domains || ['idiom', 'cultural', 'procedures', 'principles', 'error-pattern', 'patterns', 'subtlety-cue', 'emotional-pattern', 'creativity-template', 'growth', 'tools', 'notes'];
  const searchPromises: Promise<void>[] = [];
  
  // === LANGUAGE IDIOMS ===
  if (domainsToSearch.includes('idiom')) {
    searchedDomains.push('idiom');
    searchPromises.push((async () => {
      try {
        let whereClause = and(
          eq(languageIdioms.isActive, true),
          or(
            ilike(languageIdioms.idiom, searchPattern),
            ilike(languageIdioms.meaning, searchPattern),
            ilike(languageIdioms.literalTranslation, searchPattern),
            ilike(languageIdioms.culturalContext, searchPattern)
          )
        );
        
        if (language) {
          whereClause = and(whereClause, eq(languageIdioms.language, language));
        }
        
        const idioms = await getSharedDb().select().from(languageIdioms)
          .where(whereClause)
          .orderBy(desc(languageIdioms.createdAt))
          .limit(10);
        
        for (const idiom of idioms) {
          const examples = idiom.usageExamples?.slice(0, 2).join('; ') || '';
          results.push({
            domain: 'idiom',
            relevance: 0.8,
            summary: `"${idiom.idiom}" - ${idiom.meaning}`,
            details: [
              idiom.literalTranslation ? `Literal: "${idiom.literalTranslation}"` : '',
              idiom.culturalContext ? `Context: ${idiom.culturalContext}` : '',
              examples ? `Examples: ${examples}` : '',
              idiom.region ? `Region: ${idiom.region}` : '',
            ].filter(Boolean).join('. '),
            language: idiom.language,
            source: 'language_idioms',
          });
        }
      } catch (err: any) {
        console.error('[NeuralMemory] Error searching idioms:', err.message);
      }
    })());
  }
  
  // === CULTURAL NUANCES ===
  if (domainsToSearch.includes('cultural')) {
    searchedDomains.push('cultural');
    searchPromises.push((async () => {
      try {
        let whereClause = and(
          eq(culturalNuances.isActive, true),
          or(
            ilike(culturalNuances.nuance, searchPattern),
            ilike(culturalNuances.situation, searchPattern),
            ilike(culturalNuances.explanation, searchPattern),
            ilike(culturalNuances.category, searchPattern)
          )
        );
        
        if (language) {
          whereClause = and(whereClause, eq(culturalNuances.language, language));
        }
        
        const nuances = await getSharedDb().select().from(culturalNuances)
          .where(whereClause)
          .orderBy(desc(culturalNuances.createdAt))
          .limit(10);
        
        for (const nuance of nuances) {
          const mistakes = nuance.commonMistakes?.slice(0, 2).join('; ') || '';
          results.push({
            domain: 'cultural',
            relevance: 0.75,
            summary: `[${nuance.category}] ${nuance.situation}: ${nuance.nuance.substring(0, 100)}`,
            details: [
              nuance.explanation || '',
              mistakes ? `Common mistakes: ${mistakes}` : '',
              nuance.formalityLevel ? `Formality: ${nuance.formalityLevel}` : '',
              nuance.region ? `Region: ${nuance.region}` : '',
            ].filter(Boolean).join('. '),
            language: nuance.language,
            source: 'cultural_nuances',
          });
        }
      } catch (err: any) {
        console.error('[NeuralMemory] Error searching cultural nuances:', err.message);
      }
    })());
  }
  
  // === TUTOR PROCEDURES (How Daniela teaches) ===
  if (domainsToSearch.includes('procedure') || domainsToSearch.includes('procedures')) {
    searchedDomains.push('procedures');
    searchPromises.push((async () => {
      try {
        let whereClause = and(
          eq(tutorProcedures.isActive, true),
          or(
            ilike(tutorProcedures.title, searchPattern),
            ilike(tutorProcedures.procedure, searchPattern),
            ilike(tutorProcedures.category, searchPattern),
            ilike(tutorProcedures.trigger, searchPattern)
          )
        );
        
        if (language) {
          whereClause = and(
            whereClause,
            or(
              eq(tutorProcedures.language, language),
              sql`${tutorProcedures.language} IS NULL` // Universal procedures
            )
          );
        }
        
        const procedures = await getSharedDb().select().from(tutorProcedures)
          .where(whereClause)
          .orderBy(desc(tutorProcedures.priority))
          .limit(10);
        
        for (const proc of procedures) {
          const examples = proc.examples?.slice(0, 2).join('; ') || '';
          results.push({
            domain: 'procedures',
            relevance: (proc.priority || 50) / 100,
            summary: `[${proc.category}/${proc.trigger}] ${proc.title}`,
            details: [
              proc.procedure,
              examples ? `Examples: ${examples}` : '',
              proc.actflLevelRange ? `Level: ${proc.actflLevelRange}` : '',
            ].filter(Boolean).join('. '),
            language: proc.language,
            source: 'tutor_procedures',
          });
        }
      } catch (err: any) {
        console.error('[NeuralMemory] Error searching procedures:', err.message);
      }
    })());
  }
  
  // === TEACHING PRINCIPLES (Daniela's North Star - core beliefs) ===
  if (domainsToSearch.includes('principle') || domainsToSearch.includes('principles')) {
    searchedDomains.push('principles');
    searchPromises.push((async () => {
      try {
        const whereClause = and(
          eq(teachingPrinciples.isActive, true),
          or(
            ilike(teachingPrinciples.principle, searchPattern),
            ilike(teachingPrinciples.category, searchPattern),
            ilike(teachingPrinciples.application, searchPattern)
          )
        );
        
        const principles = await getSharedDb().select().from(teachingPrinciples)
          .where(whereClause)
          .orderBy(desc(teachingPrinciples.priority))
          .limit(10);
        
        for (const principle of principles) {
          const examples = principle.examples?.slice(0, 2).join('; ') || '';
          results.push({
            domain: 'principles',
            relevance: (principle.priority || 50) / 100,
            summary: `[${principle.category}] ${principle.principle.substring(0, 100)}`,
            details: [
              principle.principle,
              principle.application ? `Application: ${principle.application}` : '',
              examples ? `Examples: ${examples}` : '',
            ].filter(Boolean).join('. '),
            language: null, // Principles are language-agnostic
            source: 'teaching_principles',
          });
        }
      } catch (err: any) {
        console.error('[NeuralMemory] Error searching principles:', err.message);
      }
    })());
  }
  
  // === ERROR PATTERNS ===
  if (domainsToSearch.includes('error-pattern')) {
    searchedDomains.push('error-pattern');
    searchPromises.push((async () => {
      try {
        let whereClause = and(
          eq(learnerErrorPatterns.isActive, true),
          or(
            ilike(learnerErrorPatterns.specificError, searchPattern),
            ilike(learnerErrorPatterns.errorCategory, searchPattern),
            ilike(learnerErrorPatterns.whyItHappens, searchPattern)
          )
        );
        
        if (language) {
          whereClause = and(whereClause, eq(learnerErrorPatterns.targetLanguage, language));
        }
        
        const errors = await getSharedDb().select().from(learnerErrorPatterns)
          .where(whereClause)
          .orderBy(desc(learnerErrorPatterns.createdAt))
          .limit(10);
        
        for (const error of errors) {
          const strategies = error.teachingStrategies?.slice(0, 2).join('; ') || '';
          results.push({
            domain: 'error-pattern',
            relevance: error.priority === 'common' ? 0.9 : error.priority === 'occasional' ? 0.6 : 0.4,
            summary: `[${error.errorCategory}] ${error.specificError}`,
            details: [
              error.whyItHappens || '',
              strategies ? `Teaching strategies: ${strategies}` : '',
              error.actflLevel ? `Typical at: ${error.actflLevel}` : '',
            ].filter(Boolean).join('. '),
            language: error.targetLanguage,
            source: 'learner_error_patterns',
          });
        }
      } catch (err: any) {
        console.error('[NeuralMemory] Error searching error patterns:', err.message);
      }
    })());
  }
  
  // === SITUATIONAL PATTERNS (When to do what) ===
  if (domainsToSearch.includes('situational-pattern') || domainsToSearch.includes('patterns')) {
    searchedDomains.push('patterns');
    searchPromises.push((async () => {
      try {
        const whereClause = and(
          eq(situationalPatterns.isActive, true),
          or(
            ilike(situationalPatterns.patternName, searchPattern),
            ilike(situationalPatterns.description, searchPattern),
            ilike(situationalPatterns.guidance, searchPattern)
          )
        );
        
        const patterns = await getSharedDb().select().from(situationalPatterns)
          .where(whereClause)
          .orderBy(desc(situationalPatterns.priority))
          .limit(10);
        
        for (const pattern of patterns) {
          const tools = pattern.toolsToSuggest?.slice(0, 3).join(', ') || '';
          const procedures = pattern.proceduresToActivate?.slice(0, 2).join(', ') || '';
          results.push({
            domain: 'patterns',
            relevance: (pattern.priority || 50) / 100,
            summary: `[${pattern.patternName}] ${(pattern.description || '').substring(0, 80)}`,
            details: [
              pattern.guidance || '',
              tools ? `Suggested tools: ${tools}` : '',
              procedures ? `Activate procedures: ${procedures}` : '',
            ].filter(Boolean).join('. '),
            language: null,
            source: 'situational_patterns',
          });
        }
      } catch (err: any) {
        console.error('[NeuralMemory] Error searching situational patterns:', err.message);
      }
    })());
  }
  
  // === SUBTLETY CUES (Option B - Reading Between the Lines) ===
  if (domainsToSearch.includes('subtlety-cue')) {
    searchedDomains.push('subtlety-cue');
    searchPromises.push((async () => {
      try {
        let whereClause = and(
          eq(subtletyCues.isActive, true),
          or(
            ilike(subtletyCues.signalPattern, searchPattern),
            ilike(subtletyCues.likelyMeaning, searchPattern),
            ilike(subtletyCues.signalCategory, searchPattern),
            ilike(subtletyCues.cueType, searchPattern)
          )
        );
        
        if (language) {
          whereClause = and(
            whereClause,
            or(
              eq(subtletyCues.language, language),
              sql`${subtletyCues.language} IS NULL`
            )
          );
        }
        
        const cues = await getSharedDb().select().from(subtletyCues)
          .where(whereClause)
          .orderBy(desc(subtletyCues.priority))
          .limit(10);
        
        for (const cue of cues) {
          const responses = cue.suggestedResponses?.slice(0, 2).join('; ') || '';
          const avoid = cue.avoidResponses?.slice(0, 2).join('; ') || '';
          results.push({
            domain: 'subtlety-cue',
            relevance: (cue.priority || 50) / 100,
            summary: `[${cue.cueType}/${cue.signalCategory}] ${cue.signalPattern.substring(0, 80)}`,
            details: [
              `Likely meaning: ${cue.likelyMeaning}`,
              responses ? `Suggested responses: ${responses}` : '',
              avoid ? `Avoid: ${avoid}` : '',
              cue.culturalConsiderations ? `Cultural note: ${cue.culturalConsiderations}` : '',
            ].filter(Boolean).join('. '),
            language: cue.language,
            source: 'subtlety_cues',
          });
        }
      } catch (err: any) {
        console.error('[NeuralMemory] Error searching subtlety cues:', err.message);
      }
    })());
  }
  
  // === EMOTIONAL PATTERNS (Option B - Dynamic Empathy) ===
  if (domainsToSearch.includes('emotional-pattern')) {
    searchedDomains.push('emotional-pattern');
    searchPromises.push((async () => {
      try {
        const whereClause = and(
          eq(emotionalPatterns.isActive, true),
          or(
            ilike(emotionalPatterns.emotionalState, searchPattern),
            ilike(emotionalPatterns.learningContext, searchPattern),
            ilike(emotionalPatterns.pacingAdjustments, searchPattern)
          )
        );
        
        const patterns = await getSharedDb().select().from(emotionalPatterns)
          .where(whereClause)
          .orderBy(desc(emotionalPatterns.priority))
          .limit(10);
        
        for (const pattern of patterns) {
          const causes = pattern.typicalCauses?.slice(0, 3).join(', ') || '';
          const tools = pattern.toolRecommendations?.slice(0, 3).join(', ') || '';
          const recovery = pattern.recoveryStrategies?.slice(0, 2).join('; ') || '';
          results.push({
            domain: 'emotional-pattern',
            relevance: (pattern.priority || 50) / 100,
            summary: `[${pattern.emotionalState}] ${causes || 'emotional state patterns'}`,
            details: [
              causes ? `Typical causes: ${causes}` : '',
              pattern.pacingAdjustments ? `Pacing: ${pattern.pacingAdjustments}` : '',
              tools ? `Recommended tools: ${tools}` : '',
              recovery ? `Recovery strategies: ${recovery}` : '',
              pattern.learningContext ? `Context: ${pattern.learningContext}` : '',
            ].filter(Boolean).join('. '),
            language: null,
            source: 'emotional_patterns',
          });
        }
      } catch (err: any) {
        console.error('[NeuralMemory] Error searching emotional patterns:', err.message);
      }
    })());
  }
  
  // === CREATIVITY TEMPLATES (Option B - Novel Metaphor Generation) ===
  if (domainsToSearch.includes('creativity-template')) {
    searchedDomains.push('creativity-template');
    searchPromises.push((async () => {
      try {
        const whereClause = and(
          eq(creativityTemplates.isActive, true),
          or(
            ilike(creativityTemplates.templateType, searchPattern),
            ilike(creativityTemplates.sourceDomain, searchPattern),
            ilike(creativityTemplates.bridgePattern, searchPattern),
            ilike(creativityTemplates.reframeQuestion, searchPattern)
          )
        );
        
        const templates = await getSharedDb().select().from(creativityTemplates)
          .where(whereClause)
          .orderBy(desc(creativityTemplates.priority))
          .limit(10);
        
        for (const template of templates) {
          const metaphors = template.exampleMetaphors?.slice(0, 2).join('; ') || '';
          const angles = template.alternativeAngles?.slice(0, 2).join('; ') || '';
          const concepts = template.targetConcepts?.slice(0, 3).join(', ') || '';
          results.push({
            domain: 'creativity-template',
            relevance: (template.priority || 50) / 100,
            summary: `[${template.templateType}] ${template.sourceDomain || 'creative approach'}`,
            details: [
              template.bridgePattern ? `Bridge: ${template.bridgePattern}` : '',
              metaphors ? `Examples: ${metaphors}` : '',
              template.reframeQuestion ? `Reframe: ${template.reframeQuestion}` : '',
              angles ? `Alternative angles: ${angles}` : '',
              concepts ? `For concepts: ${concepts}` : '',
            ].filter(Boolean).join('. '),
            language: null,
            source: 'creativity_templates',
          });
        }
      } catch (err: any) {
        console.error('[NeuralMemory] Error searching creativity templates:', err.message);
      }
    })());
  }
  
  // === DANIELA'S GROWTH MEMORIES (Her learning journey) ===
  if (domainsToSearch.includes('growth')) {
    searchedDomains.push('growth');
    searchPromises.push((async () => {
      try {
        const whereClause = and(
          eq(danielaGrowthMemories.isActive, true),
          or(
            ilike(danielaGrowthMemories.title, searchPattern),
            ilike(danielaGrowthMemories.lesson, searchPattern),
            ilike(danielaGrowthMemories.specificContent, searchPattern),
            ilike(danielaGrowthMemories.category, searchPattern)
          )
        );
        
        const memories = await getSharedDb().select().from(danielaGrowthMemories)
          .where(whereClause)
          .orderBy(desc(danielaGrowthMemories.importance))
          .limit(15);
        
        for (const memory of memories) {
          results.push({
            domain: 'growth',
            relevance: (memory.importance || 5) / 10,
            summary: `[${memory.category}] ${memory.title}`,
            details: [
              memory.lesson,
              memory.specificContent ? `Specific: ${memory.specificContent.substring(0, 100)}` : '',
              memory.triggerConditions ? `When to apply: ${memory.triggerConditions}` : '',
              memory.sourceType ? `Learned from: ${memory.sourceType}` : '',
            ].filter(Boolean).join('. '),
            language: null,
            source: 'daniela_growth_memories',
          });
        }
      } catch (err: any) {
        console.error('[NeuralMemory] Error searching growth memories:', err.message);
      }
    })());
  }
  
  // === TOOL KNOWLEDGE (Daniela's capabilities) ===
  if (domainsToSearch.includes('tools')) {
    searchedDomains.push('tools');
    searchPromises.push((async () => {
      try {
        const whereClause = and(
          eq(toolKnowledge.isActive, true),
          or(
            ilike(toolKnowledge.toolName, searchPattern),
            ilike(toolKnowledge.purpose, searchPattern),
            ilike(toolKnowledge.syntax, searchPattern),
            ilike(toolKnowledge.toolType, searchPattern)
          )
        );
        
        const tools = await getSharedDb().select().from(toolKnowledge)
          .where(whereClause)
          .orderBy(desc(toolKnowledge.createdAt))
          .limit(10);
        
        for (const tool of tools) {
          const examples = tool.examples?.slice(0, 2).join('; ') || '';
          const bestFor = tool.bestUsedFor?.slice(0, 3).join(', ') || '';
          results.push({
            domain: 'tools',
            relevance: 0.8,
            summary: `[${tool.toolType}] ${tool.toolName}`,
            details: [
              tool.purpose,
              `Syntax: ${tool.syntax}`,
              examples ? `Examples: ${examples}` : '',
              bestFor ? `Best for: ${bestFor}` : '',
            ].filter(Boolean).join('. '),
            language: null,
            source: 'tool_knowledge',
          });
        }
      } catch (err: any) {
        console.error('[NeuralMemory] Error searching tool knowledge:', err.message);
      }
    })());
  }
  
  // === DANIELA'S PERSONAL NOTES ===
  if (domainsToSearch.includes('notes')) {
    searchedDomains.push('notes');
    searchPromises.push((async () => {
      try {
        let whereClause = and(
          eq(danielaNotes.isActive, true),
          or(
            ilike(danielaNotes.title, searchPattern),
            ilike(danielaNotes.content, searchPattern)
          )
        );
        
        // Filter by language if provided
        if (language) {
          whereClause = and(
            whereClause,
            or(
              eq(danielaNotes.language, language),
              sql`${danielaNotes.language} IS NULL`  // Also include language-agnostic notes
            )
          );
        }
        
        const notes = await getSharedDb().select().from(danielaNotes)
          .where(whereClause)
          .orderBy(desc(danielaNotes.createdAt))
          .limit(15);
        
        for (const note of notes) {
          const tags = note.tags?.slice(0, 3).join(', ') || '';
          results.push({
            domain: 'notes',
            relevance: 0.85,
            summary: `[${note.noteType}] ${note.title}`,
            details: [
              note.content.substring(0, 300),
              tags ? `Tags: ${tags}` : '',
              note.language ? `Language: ${note.language}` : '',
            ].filter(Boolean).join('. '),
            language: note.language || null,
            source: 'daniela_notes',
          });
        }
      } catch (err: any) {
        console.error('[NeuralMemory] Error searching personal notes:', err.message);
      }
    })());
  }
  
  await Promise.all(searchPromises);
  
  // Sort by relevance
  results.sort((a, b) => b.relevance - a.relevance);
  
  return {
    query,
    language: language || null,
    results,
    searchedDomains,
    totalMatches: results.length,
  };
}

// ===== SYLLABUS/CURRICULUM SEARCH =====

/**
 * Syllabus search result
 */
export interface SyllabusSearchResult {
  type: 'path' | 'unit' | 'lesson' | 'drill';
  id: string;
  name: string;
  language: string;
  description?: string; // Optional since some curriculum entries may not have descriptions
  level?: string; // ACTFL level or start-end range
  parent?: string; // Parent path/unit name
  details?: {
    estimatedHours?: number;
    objectives?: string[];
    lessonType?: string;
    orderIndex?: number;
    drillType?: string;
    targetText?: string;
  };
}

/**
 * Syllabus search response
 */
export interface SyllabusSearchResponse {
  query: string;
  language?: string;
  results: SyllabusSearchResult[];
  totalMatches: number;
}

/**
 * Search syllabi/curriculum for on-demand lookup
 * Searches paths, units, and lessons by name, description, language
 * 
 * @param query - Search query (syllabus name, topic, lesson name)
 * @param language - Optional: filter by language
 */
export async function searchSyllabi(
  query: string,
  language?: string
): Promise<SyllabusSearchResponse> {
  const results: SyllabusSearchResult[] = [];
  
  const normalizedQuery = query.toLowerCase().trim();
  const searchPattern = `%${normalizedQuery}%`;
  
  try {
    // === CURRICULUM PATHS (Syllabi) ===
    const paths = await getSharedDb().select().from(curriculumPaths)
      .where(
        and(
          language ? eq(curriculumPaths.language, language) : sql`true`,
          or(
            ilike(curriculumPaths.name, searchPattern),
            ilike(curriculumPaths.description, searchPattern),
            ilike(curriculumPaths.targetAudience, searchPattern)
          )
        )
      )
      .limit(10);
    
    for (const path of paths) {
      results.push({
        type: 'path',
        id: path.id,
        name: path.name,
        language: path.language,
        description: path.description || undefined,
        level: `${path.startLevel} → ${path.endLevel}`,
        details: {
          estimatedHours: path.estimatedHours || undefined,
        },
      });
    }
    
    // === CURRICULUM UNITS ===
    const unitsWithPath = await getSharedDb()
      .select({
        unit: curriculumUnits,
        pathName: curriculumPaths.name,
        pathLanguage: curriculumPaths.language,
      })
      .from(curriculumUnits)
      .innerJoin(curriculumPaths, eq(curriculumUnits.curriculumPathId, curriculumPaths.id))
      .where(
        and(
          language ? eq(curriculumPaths.language, language) : sql`true`,
          or(
            ilike(curriculumUnits.name, searchPattern),
            ilike(curriculumUnits.description, searchPattern),
            ilike(curriculumUnits.culturalTheme, searchPattern)
          )
        )
      )
      .orderBy(curriculumUnits.orderIndex)
      .limit(10);
    
    for (const { unit, pathName, pathLanguage } of unitsWithPath) {
      results.push({
        type: 'unit',
        id: unit.id,
        name: unit.name,
        language: pathLanguage,
        description: unit.description || undefined,
        level: unit.actflLevel || undefined,
        parent: pathName,
        details: {
          estimatedHours: unit.estimatedHours || undefined,
          orderIndex: unit.orderIndex,
        },
      });
    }
    
    // === CURRICULUM LESSONS ===
    const lessonsWithContext = await getSharedDb()
      .select({
        lesson: curriculumLessons,
        unitName: curriculumUnits.name,
        pathName: curriculumPaths.name,
        pathLanguage: curriculumPaths.language,
      })
      .from(curriculumLessons)
      .innerJoin(curriculumUnits, eq(curriculumLessons.curriculumUnitId, curriculumUnits.id))
      .innerJoin(curriculumPaths, eq(curriculumUnits.curriculumPathId, curriculumPaths.id))
      .where(
        and(
          language ? eq(curriculumPaths.language, language) : sql`true`,
          or(
            ilike(curriculumLessons.name, searchPattern),
            ilike(curriculumLessons.description, searchPattern),
            ilike(curriculumLessons.conversationTopic, searchPattern)
          )
        )
      )
      .orderBy(curriculumLessons.orderIndex)
      .limit(15);
    
    for (const { lesson, unitName, pathName, pathLanguage } of lessonsWithContext) {
      results.push({
        type: 'lesson',
        id: lesson.id,
        name: lesson.name,
        language: pathLanguage,
        description: lesson.description || undefined,
        level: lesson.actflLevel || undefined,
        parent: `${pathName} > ${unitName}`,
        details: {
          lessonType: lesson.lessonType,
          objectives: lesson.objectives || undefined,
          orderIndex: lesson.orderIndex,
        },
      });
    }
    
    // === CURRICULUM DRILLS ===
    const drillsWithContext = await getSharedDb()
      .select({
        drill: curriculumDrillItems,
        lessonName: curriculumLessons.name,
        unitName: curriculumUnits.name,
        pathName: curriculumPaths.name,
        pathLanguage: curriculumPaths.language,
      })
      .from(curriculumDrillItems)
      .innerJoin(curriculumLessons, eq(curriculumDrillItems.lessonId, curriculumLessons.id))
      .innerJoin(curriculumUnits, eq(curriculumLessons.curriculumUnitId, curriculumUnits.id))
      .innerJoin(curriculumPaths, eq(curriculumUnits.curriculumPathId, curriculumPaths.id))
      .where(
        and(
          language ? eq(curriculumPaths.language, language) : sql`true`,
          or(
            ilike(curriculumDrillItems.prompt, searchPattern),
            ilike(curriculumDrillItems.targetText, searchPattern)
          )
        )
      )
      .orderBy(curriculumDrillItems.orderIndex)
      .limit(10);
    
    for (const { drill, lessonName, unitName, pathName, pathLanguage } of drillsWithContext) {
      results.push({
        type: 'drill',
        id: drill.id,
        name: drill.prompt.substring(0, 50),
        language: pathLanguage,
        description: `Target: "${drill.targetText}"`,
        parent: `${pathName} > ${unitName} > ${lessonName}`,
        details: {
          drillType: drill.itemType,
          targetText: drill.targetText,
          orderIndex: drill.orderIndex,
        },
      });
    }
    
  } catch (err: any) {
    console.error('[NeuralMemory] Error searching syllabi:', err.message);
  }
  
  return {
    query,
    language,
    results,
    totalMatches: results.length,
  };
}

/**
 * Format syllabus search for injection into conversation
 */
export function formatSyllabusSearch(response: SyllabusSearchResponse): string {
  if (response.results.length === 0) {
    return `[Syllabus search for "${response.query}": No matching syllabi, units, lessons, or drills found]`;
  }
  
  const lines: string[] = [];
  lines.push(`\n═══ SYLLABUS LOOKUP: "${response.query}" ═══`);
  if (response.language) {
    lines.push(`Language: ${response.language}`);
  }
  lines.push(`Found ${response.totalMatches} matches:\n`);
  
  // Group by type
  const paths = response.results.filter(r => r.type === 'path');
  const units = response.results.filter(r => r.type === 'unit');
  const lessons = response.results.filter(r => r.type === 'lesson');
  const drills = response.results.filter(r => r.type === 'drill');
  
  if (paths.length > 0) {
    lines.push('📚 SYLLABI (Curriculum Paths):');
    for (const path of paths) {
      lines.push(`  • ${path.name} [${path.language}]`);
      lines.push(`    Level: ${path.level}`);
      const pathDesc = path.description ? path.description.substring(0, 150) : 'No description available';
      lines.push(`    ${pathDesc}`);
      if (path.details?.estimatedHours) {
        lines.push(`    Duration: ~${path.details.estimatedHours} hours`);
      }
    }
    lines.push('');
  }
  
  if (units.length > 0) {
    lines.push('📖 UNITS:');
    for (const unit of units.slice(0, 5)) {
      lines.push(`  • ${unit.name}`);
      lines.push(`    In: ${unit.parent}`);
      if (unit.level) lines.push(`    Level: ${unit.level}`);
      const unitDesc = unit.description ? unit.description.substring(0, 100) : 'No description';
      lines.push(`    ${unitDesc}`);
    }
    lines.push('');
  }
  
  if (lessons.length > 0) {
    lines.push('📝 LESSONS:');
    for (const lesson of lessons.slice(0, 8)) {
      lines.push(`  • ${lesson.name} (${lesson.details?.lessonType || 'lesson'})`);
      lines.push(`    In: ${lesson.parent}`);
      const lessonDesc = lesson.description ? lesson.description.substring(0, 80) : 'No description';
      lines.push(`    ${lessonDesc}`);
      if (lesson.details?.objectives?.length) {
        lines.push(`    Objectives: ${lesson.details.objectives.slice(0, 2).join('; ')}`);
      }
    }
    lines.push('');
  }
  
  if (drills.length > 0) {
    lines.push('🎯 DRILLS:');
    for (const drill of drills.slice(0, 6)) {
      lines.push(`  • [${drill.details?.drillType || 'drill'}] "${drill.name}"`);
      lines.push(`    Answer: "${drill.details?.targetText || ''}"`);
      lines.push(`    In: ${drill.parent}`);
    }
    lines.push('');
  }
  
  lines.push('═══════════════════════════════════════');
  
  return lines.join('\n');
}

/**
 * Format teaching knowledge for injection into conversation
 */
export function formatTeachingKnowledge(response: TeachingMemoryResponse): string {
  if (response.results.length === 0) {
    return `[Teaching knowledge search for "${response.query}": No matches found]`;
  }
  
  const lines: string[] = [];
  lines.push(`\n═══ TEACHING KNOWLEDGE: "${response.query}" ═══`);
  if (response.language) {
    lines.push(`Language: ${response.language}`);
  }
  lines.push(`Found ${response.totalMatches} relevant entries:\n`);
  
  const domainLabels: Record<string, string> = {
    'idiom': 'Idioms & Expressions',
    'cultural': 'Cultural Nuances',
    'procedure': 'Teaching Procedures',
    'principle': 'Teaching Principles',
    'error-pattern': 'Common Learner Errors',
    'situational-pattern': 'Situational Patterns',
    'subtlety-cue': 'Subtlety Cues',
    'emotional-pattern': 'Emotional Intelligence',
    'creativity-template': 'Creativity Templates',
  };
  
  // Group by domain
  const byDomain = new Map<string, TeachingMemoryResult[]>();
  for (const result of response.results) {
    if (!byDomain.has(result.domain)) {
      byDomain.set(result.domain, []);
    }
    byDomain.get(result.domain)!.push(result);
  }
  
  for (const [domain, domainResults] of Array.from(byDomain)) {
    lines.push(`${domainLabels[domain] || domain}:`);
    for (const result of domainResults.slice(0, 3)) {
      lines.push(`  • ${result.summary}`);
      if (result.details) {
        lines.push(`    └─ ${result.details.substring(0, 250)}`);
      }
    }
    lines.push('');
  }
  
  lines.push('═══════════════════════════════════════');
  
  return lines.join('\n');
}

// Export singleton-style functions
export const neuralMemorySearch = {
  search: searchMemory,
  format: formatMemoryForConversation,
  lookupPerson,
  getStudentMemorySummary,
  // Teaching knowledge (Phase 1)
  searchTeaching: searchTeachingKnowledge,
  formatTeaching: formatTeachingKnowledge,
  // Syllabus/curriculum lookup (Phase 2)
  searchSyllabi,
  formatSyllabi: formatSyllabusSearch,
};
