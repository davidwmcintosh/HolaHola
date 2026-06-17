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
  learnerPersonalFacts,
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
import { eq, sql, desc, asc, and, or, ilike, gte, lte, lt, gt, isNull, inArray } from 'drizzle-orm';

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
  'evelyn': 'biology',
  'gene': 'biology',
  'clio': 'history',
  'marcus': 'history',
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
  domains?: ('person' | 'motivation' | 'insight' | 'struggle' | 'session' | 'progress' | 'conversation')[],
  subjectFilter?: string
): Promise<MemorySearchResponse> {
  const results: MemorySearchResult[] = [];
  const searchedDomains: string[] = [];
  
  // Normalize query for case-insensitive matching (guard against accidental non-string callers)
  const normalizedQuery = String(query ?? '').toLowerCase().trim();
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
            subjectFilter
              ? or(isNull(studentInsights.language), eq(studentInsights.language, subjectFilter))
              : undefined,
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
          .orderBy(sql`CASE ${learningMotivations.priority} WHEN 'primary' THEN 1 WHEN 'secondary' THEN 2 WHEN 'nice_to_have' THEN 3 ELSE 4 END`, desc(learningMotivations.createdAt))
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
            subjectFilter ? eq(recurringStruggles.language, subjectFilter) : undefined,
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
            subjectFilter
              ? sql`${sessionNotes.conversationId} IN (SELECT id FROM conversations WHERE language = ${subjectFilter})`
              : undefined,
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
  
  // === LEARNER PERSONAL FACTS (SHARED database) ===
  // These are structured facts extracted from conversations — e.g. "Enjoys reggaeton music"
  // Included whenever 'person' domain is requested or no specific domain is given
  if (domainsToSearch.includes('person') || !domains || domains.length === 0) {
    searchPromises.push((async () => {
      try {
        const facts = await getSharedDb().select().from(learnerPersonalFacts)
          .where(and(
            eq(learnerPersonalFacts.studentId, studentId),
            eq(learnerPersonalFacts.isActive, true),
            or(
              ilike(learnerPersonalFacts.fact, searchPattern),
              ilike(learnerPersonalFacts.context, searchPattern),
              ilike(learnerPersonalFacts.factType, searchPattern)
            )
          ))
          .orderBy(desc(learnerPersonalFacts.confidenceScore))
          .limit(15);

        if (facts.length > 0) {
          // Group by fact_type for a cleaner summary
          const grouped: Record<string, string[]> = {};
          for (const f of facts) {
            const type = f.factType || 'general';
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(f.fact);
          }
          const summaryLines = Object.entries(grouped)
            .map(([type, fs]) => `[${type}] ${fs.join(' | ')}`)
            .join('\n');

          results.push({
            domain: 'person',
            relevance: 0.85,
            summary: `Personal facts (${facts.length} found): ${facts[0].fact.substring(0, 80)}`,
            details: `Extracted facts about the student:\n${summaryLines}`,
            timestamp: facts[0].createdAt,
            source: 'learner_personal_facts',
          });
        }
      } catch (err: any) {
        console.error('[NeuralMemory] Error searching learner_personal_facts:', err.message);
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
export function formatMemoryForConversation(response: MemorySearchResponse, studentName?: string): string {
  if (response.results.length === 0) {
    return `Nothing surfaces right now — respond from what you know.`;
  }

  // Natural relative phrasing — no citations, no timestamps
  function naturalTime(ts?: string | null): string {
    if (!ts) return '';
    const days = Math.floor((Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60 * 24));
    if (days < 3) return ' (recent)';
    if (days < 14) return ' (about a week ago)';
    if (days < 60) return ' (about a month ago)';
    if (days < 180) return ' (a few months ago)';
    return ' (a while back)';
  }

  // Up to 6 results, ordered by relevance.
  // No invented framing, no literary weavers — the memories are already in Daniela's voice.
  // Adding an opening sentence or connectors like "Something that stayed with me —"
  // flavors the memory before she reads it. Present them clean. Let them speak.
  const top = response.results.slice(0, 6);
  const lines: string[] = [];

  for (const result of top) {
    const when = naturalTime(result.timestamp);
    // Use the fuller of details vs summary — no truncation, Daniela needs the whole memory.
    const memory = (result.details && result.details !== result.summary && result.details.length > result.summary.length)
      ? result.details
      : result.summary;
    lines.push(`${memory}${when}`);
  }

  return lines.join('\n');
}

/**
 * Temporal Awareness — surfaces upcoming and recently-past time-sensitive personal facts.
 * Injected at session start so Daniela naturally brings up relevant dates without being asked.
 * E.g. "That trip to Barcelona is coming up in 4 days — ask how prep is going."
 */
export async function buildTemporalAwareness(userId: string): Promise<string | null> {
  try {
    const db = getUserDb();
    const now = new Date();
    const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);   // 7 days ago
    const windowEnd   = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);  // 90 days out

    const rows = await db
      .select({
        fact: learnerPersonalFacts.fact,
        factType: learnerPersonalFacts.factType,
        relevantDate: learnerPersonalFacts.relevantDate,
        lastMentionedAt: learnerPersonalFacts.lastMentionedAt,
        mentionCount: learnerPersonalFacts.mentionCount,
      })
      .from(learnerPersonalFacts)
      .where(sql`
        student_id = ${userId}
        AND is_active = true
        AND relevant_date IS NOT NULL
        AND relevant_date >= ${windowStart}
        AND relevant_date <= ${windowEnd}
      `)
      .orderBy(asc(learnerPersonalFacts.relevantDate))
      .limit(8);

    if (rows.length === 0) return null;

    const lines: string[] = ['[TEMPORAL AWARENESS — time-sensitive facts for this student:]'];
    for (const r of rows) {
      const diffMs = new Date(r.relevantDate!).getTime() - now.getTime();
      const days   = Math.round(diffMs / (1000 * 60 * 60 * 24));
      let urgency: string;
      if (days > 0 && days <= 3)   urgency = `⚠️ IN ${days} DAY${days === 1 ? '' : 'S'} — bring this up`;
      else if (days > 3 && days <= 14) urgency = `coming up in ${days} days`;
      else if (days > 14)              urgency = `coming up (${days} days away)`;
      else if (days === 0)             urgency = `TODAY`;
      else                             urgency = `just happened ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago — ask how it went`;
      lines.push(`— ${r.fact} [${urgency}]`);
    }
    lines.push('Note: Reference these naturally, not as a checklist read-out.]');
    return lines.join('\n');
  } catch {
    return null;
  }
}

/**
 * Coverage Audit — identifies topic areas Daniela knows little or nothing about for this student.
 * Injected at session start so she can explore blind spots through natural conversation over time.
 * Returns null for brand-new students (< 3 facts total) — no meaningful audit possible yet.
 */
export async function buildCoverageAudit(userId: string): Promise<string | null> {
  const EXPECTED_FACT_TYPES    = ['family', 'work', 'travel', 'goal', 'preference', 'relationship', 'personal_detail', 'life_event'];
  const EXPECTED_INSIGHT_TYPES = ['learning_style', 'preference', 'strength', 'personality'];

  try {
    const userDb   = getUserDb();
    const sharedDb = getSharedDb();

    const [facts, insights] = await Promise.all([
      userDb.select({ factType: learnerPersonalFacts.factType })
        .from(learnerPersonalFacts)
        .where(and(eq(learnerPersonalFacts.studentId, userId), eq(learnerPersonalFacts.isActive, true))),
      sharedDb.select({ insightType: studentInsights.insightType })
        .from(studentInsights)
        .where(and(eq(studentInsights.studentId, userId), eq(studentInsights.isActive, true))),
    ]);

    if (facts.length + insights.length < 3) return null;

    const coveredFacts    = new Set(facts.map(f => f.factType));
    const coveredInsights = new Set(insights.map(i => i.insightType));
    const missingFacts    = EXPECTED_FACT_TYPES.filter(t => !coveredFacts.has(t));
    const missingInsights = EXPECTED_INSIGHT_TYPES.filter(t => !coveredInsights.has(t));

    if (missingFacts.length === 0 && missingInsights.length === 0) return null;

    const lines: string[] = ['[BLIND SPOTS — areas you know little about this student yet:'];
    if (missingFacts.length > 0)    lines.push(`Personal areas unexplored: ${missingFacts.join(', ')}`);
    if (missingInsights.length > 0) lines.push(`Learning profile gaps: ${missingInsights.join(', ')}`);
    lines.push('Let these inform questions you weave in naturally — not a checklist to blast through.]');
    return lines.join('\n');
  } catch {
    return null;
  }
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
          .orderBy(desc(danielaNotes.timesReferenced), desc(danielaNotes.createdAt))
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
        
        // Async fire-and-forget: increment timesReferenced + lastReferencedAt for each returned note
        if (notes.length > 0) {
          const noteIds = notes.map(n => n.id);
          getSharedDb()
            .update(danielaNotes)
            .set({
              timesReferenced: sql`${danielaNotes.timesReferenced} + 1`,
              lastReferencedAt: sql`now()`,
            })
            .where(inArray(danielaNotes.id, noteIds))
            .catch(err => console.warn('[NeuralSearch] Failed to increment note timesReferenced:', err.message));
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

// ─────────────────────────────────────────────────────────────────────────────
// Conversation Thread Search
// Returns full exchange context around matching messages, not isolated snippets.
// ─────────────────────────────────────────────────────────────────────────────

export interface ConversationThreadMessage {
  role: string;
  content: string;
  createdAt: Date | null;
  isMatch: boolean;  // true if this message was the search match
}

export interface ConversationThread {
  conversationId: string;
  conversationTitle: string | null;
  conversationDate: Date | null;
  language: string | null;
  matchedContent: string;  // the snippet that triggered this thread
  messages: ConversationThreadMessage[];
}

export interface ConversationThreadSearchResult {
  query: string;
  threads: ConversationThread[];
  totalMatchingMessages: number;
}

/**
 * Search for conversation threads that contain the query.
 * For each matched message, returns the surrounding exchange context
 * (contextBefore + contextAfter messages) so Daniela can recall the
 * full conversation, not just an isolated snippet.
 */
export async function searchConversationThreads(
  studentId: string,
  query: string,
  options: {
    contextBefore?: number;  // messages before match (default 4)
    contextAfter?: number;   // messages after match (default 4)
    maxThreads?: number;     // max unique conversations to return (default 5)
    afterDate?: Date;        // optional date filter: only return messages after this date
    beforeDate?: Date;       // optional date filter: only return messages before this date
  } = {}
): Promise<ConversationThreadSearchResult> {
  const {
    contextBefore = 4,
    contextAfter = 4,
    maxThreads = 5,
    afterDate,
    beforeDate,
  } = options;

  const db = getSharedDb();

  // Build keyword search conditions from query words
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= 3)  // skip very short words
    .slice(0, 5);                 // max 5 keywords

  const keywordConditions = words.length > 0
    ? words.map(w => ilike(messages.content, `%${w}%`))
    : [ilike(messages.content, `%${query}%`)];

  // Also match the full phrase directly
  const phraseCondition = ilike(messages.content, `%${query}%`);
  const contentCondition = words.length > 0
    ? or(phraseCondition, ...keywordConditions)!
    : phraseCondition;

  // Date conditions
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const dateConditions: ReturnType<typeof and>[] = [
    and(
      eq(conversations.userId, studentId),
      gte(messages.createdAt, afterDate || sixMonthsAgo),
      contentCondition,
    ) as ReturnType<typeof and>,
  ];

  if (beforeDate) {
    dateConditions[0] = and(
      eq(conversations.userId, studentId),
      gte(messages.createdAt, afterDate || sixMonthsAgo),
      lte(messages.createdAt, beforeDate),
      contentCondition,
    ) as ReturnType<typeof and>;
  }

  // Step 1: Find matching messages using TWO queries — newest-first AND oldest-first.
  // This ensures original (early) conversations are always found alongside recent ones,
  // preventing "recency burial" where recent tool-call failure messages crowd out the
  // original rich conversations that happened months ago.
  type MatchRow = {
    messageId: string;
    content: string;
    role: string;
    createdAt: Date | null;
    conversationId: string;
    conversationTitle: string | null;
    conversationDate: Date | null;
    language: string | null;
  };

  const selectFields = {
    messageId: messages.id,
    content: messages.content,
    role: messages.role,
    createdAt: messages.createdAt,
    conversationId: messages.conversationId,
    conversationTitle: conversations.title,
    conversationDate: conversations.createdAt,
    language: conversations.language,
  };

  let matchingMessages: MatchRow[] = [];

  const runDualQuery = async (whereCondition: ReturnType<typeof and>): Promise<MatchRow[]> => {
    const [newestRows, oldestRows] = await Promise.all([
      db.select(selectFields).from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .where(whereCondition)
        .orderBy(desc(messages.createdAt))
        .limit(30),
      db.select(selectFields).from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .where(whereCondition)
        .orderBy(asc(messages.createdAt))
        .limit(30),
    ]);
    // Merge: interleave newest and oldest, dedup by messageId
    const seen = new Set<string>();
    const merged: MatchRow[] = [];
    // Alternate: 1 from oldest, 1 from newest — gives time-diverse coverage
    const maxLen = Math.max(newestRows.length, oldestRows.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < oldestRows.length && !seen.has(oldestRows[i].messageId)) {
        seen.add(oldestRows[i].messageId);
        merged.push(oldestRows[i]);
      }
      if (i < newestRows.length && !seen.has(newestRows[i].messageId)) {
        seen.add(newestRows[i].messageId);
        merged.push(newestRows[i]);
      }
    }
    return merged;
  };

  try {
    matchingMessages = await runDualQuery(dateConditions[0] as ReturnType<typeof and>);
  } catch (err: any) {
    console.error('[ConversationThreads] Search query failed:', err.message);
    return { query, threads: [], totalMatchingMessages: 0 };
  }

  if (matchingMessages.length === 0) {
    // Try without date limit if no results
    try {
      const noDateCondition = and(
        eq(conversations.userId, studentId),
        contentCondition,
      );
      matchingMessages = await runDualQuery(noDateCondition as ReturnType<typeof and>);
    } catch (err: any) {
      console.error('[ConversationThreads] Fallback search failed:', err.message);
      return { query, threads: [], totalMatchingMessages: 0 };
    }
  }

  const totalMatchingMessages = matchingMessages.length;

  // Step 2: Deduplicate by conversation, respecting the interleaved oldest+newest order
  // This ensures we see the ORIGINAL conversations (oldest) first, followed by recent ones
  const seenConversations = new Set<string>();
  const uniqueMatches: typeof matchingMessages = [];
  for (const msg of matchingMessages) {
    if (!seenConversations.has(msg.conversationId)) {
      seenConversations.add(msg.conversationId);
      uniqueMatches.push(msg);
      if (uniqueMatches.length >= maxThreads) break;
    }
  }

  // Step 3: For each unique match, fetch the context window around it
  const threadPromises = uniqueMatches.map(async (match) => {
    try {
      // Get messages BEFORE the match (inclusive of match itself to establish anchor)
      const before = await db
        .select({ role: messages.role, content: messages.content, createdAt: messages.createdAt })
        .from(messages)
        .where(and(
          eq(messages.conversationId, match.conversationId),
          lte(messages.createdAt, match.createdAt!),
        ))
        .orderBy(desc(messages.createdAt))
        .limit(contextBefore + 1);  // +1 to include the match itself

      // Get messages AFTER the match
      const after = await db
        .select({ role: messages.role, content: messages.content, createdAt: messages.createdAt })
        .from(messages)
        .where(and(
          eq(messages.conversationId, match.conversationId),
          gt(messages.createdAt, match.createdAt!),
        ))
        .orderBy(asc(messages.createdAt))
        .limit(contextAfter);

      // Combine: before (reversed to chronological) + after
      const beforeChron = [...before].reverse();
      const thread: ConversationThreadMessage[] = [
        ...beforeChron.map((m, i) => ({
          role: m.role,
          content: m.content || '',
          createdAt: m.createdAt,
          isMatch: i === beforeChron.length - 1,  // last of "before" is the match
        })),
        ...after.map(m => ({
          role: m.role,
          content: m.content || '',
          createdAt: m.createdAt,
          isMatch: false,
        })),
      ];

      return {
        conversationId: match.conversationId,
        conversationTitle: match.conversationTitle,
        conversationDate: match.conversationDate,
        language: match.language,
        matchedContent: match.content || '',
        messages: thread,
      } satisfies ConversationThread;
    } catch (err: any) {
      console.error(`[ConversationThreads] Context fetch failed for ${match.conversationId}:`, err.message);
      return null;
    }
  });

  const threadResults = await Promise.all(threadPromises);
  const threads = threadResults.filter((t): t is ConversationThread => t !== null);

  console.log(`[ConversationThreads] "${query}" → ${totalMatchingMessages} matches across ${threads.length} conversation threads`);

  return { query, threads, totalMatchingMessages };
}

/**
 * Format conversation thread search results for Daniela's use.
 * Returns readable thread excerpts that show the actual exchange, not just snippets.
 */
export function formatConversationThreads(result: ConversationThreadSearchResult, studentName = 'David'): string {
  if (result.threads.length === 0) {
    return `No conversation threads found for "${result.query}". The conversation may have happened before our recorded history or under different terms.`;
  }

  const lines: string[] = [];
  lines.push(`CONVERSATION THREADS — "${result.query}"`);
  lines.push(`Found in ${result.threads.length} conversation${result.threads.length > 1 ? 's' : ''} (${result.totalMatchingMessages} total matches)\n`);

  for (const thread of result.threads) {
    // Conversation header
    const dateStr = thread.conversationDate
      ? formatThreadDate(new Date(thread.conversationDate))
      : 'Unknown date';
    const title = thread.conversationTitle || 'Conversation';
    const langLabel = thread.language ? ` [${thread.language}]` : '';
    lines.push(`━━━ ${title}${langLabel} — ${dateStr} ━━━`);

    // Thread messages
    for (const msg of thread.messages) {
      const speaker = msg.role === 'user' ? studentName : 'Daniela';
      const marker = msg.isMatch ? ' ◄' : '';  // mark the matching message
      // Full content — no truncation so Daniela sees the complete exchange
      lines.push(`${speaker}: ${msg.content}${marker}`);
    }
    lines.push('');
  }

  lines.push(`Use these threads to recall the full context of our past conversations.`);
  return lines.join('\n');
}

function formatThreadDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  if (diffDays < 365) return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversation Date Browser
// Temporal browsing without a keyword — "What did we talk about in January?"
// ─────────────────────────────────────────────────────────────────────────────

export interface ConversationSummary {
  conversationId: string;
  title: string | null;
  date: Date | null;
  language: string | null;
  messageCount: number;
  firstMessage: string;
  lastMessage: string;
}

export interface ConversationBrowseResult {
  afterDate: Date | null;
  beforeDate: Date | null;
  conversations: ConversationSummary[];
  totalFound: number;
}

/**
 * Browse conversations by date range without a keyword query.
 * Returns conversation summaries so Daniela can orient herself temporally.
 * "Show me what we were talking about in January" → list of sessions from that period.
 */
export async function browseConversationsByDate(
  studentId: string,
  options: {
    afterDate?: Date;
    beforeDate?: Date;
    limit?: number;
    language?: string;
  } = {}
): Promise<ConversationBrowseResult> {
  const {
    limit = 10,
    afterDate,
    beforeDate,
    language,
  } = options;

  const db = getSharedDb();

  try {
    const base = eq(conversations.userId, studentId);

    const dateConditions = [
      base,
      ...(afterDate ? [gte(conversations.createdAt, afterDate)] : []),
      ...(beforeDate ? [lte(conversations.createdAt, beforeDate)] : []),
      ...(language ? [eq(conversations.language, language)] : []),
    ];

    const convRows = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        createdAt: conversations.createdAt,
        language: conversations.language,
      })
      .from(conversations)
      .where(and(...dateConditions))
      .orderBy(desc(conversations.createdAt))
      .limit(limit);

    if (convRows.length === 0) {
      return { afterDate: afterDate || null, beforeDate: beforeDate || null, conversations: [], totalFound: 0 };
    }

    // For each conversation, get message count and first/last message
    const summaries = await Promise.all(convRows.map(async (conv) => {
      try {
        const [countRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(messages)
          .where(eq(messages.conversationId, conv.id));

        const firstMsg = await db
          .select({ content: messages.content, role: messages.role })
          .from(messages)
          .where(eq(messages.conversationId, conv.id))
          .orderBy(asc(messages.createdAt))
          .limit(1);

        const lastMsg = await db
          .select({ content: messages.content, role: messages.role })
          .from(messages)
          .where(eq(messages.conversationId, conv.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        const firstContent = firstMsg[0]?.content || '';
        const lastContent = lastMsg[0]?.content || '';

        return {
          conversationId: conv.id,
          title: conv.title,
          date: conv.createdAt,
          language: conv.language,
          messageCount: countRow?.count || 0,
          firstMessage: firstContent.substring(0, 200),
          lastMessage: lastContent.substring(0, 200),
        } satisfies ConversationSummary;

      } catch {
        return {
          conversationId: conv.id,
          title: conv.title,
          date: conv.createdAt,
          language: conv.language,
          messageCount: 0,
          firstMessage: '',
          lastMessage: '',
        } satisfies ConversationSummary;
      }
    }));

    console.log(`[ConversationBrowse] Found ${summaries.length} conversations in date range`);

    return {
      afterDate: afterDate || null,
      beforeDate: beforeDate || null,
      conversations: summaries,
      totalFound: summaries.length,
    };
  } catch (err: any) {
    console.error('[ConversationBrowse] Error:', err.message);
    return { afterDate: afterDate || null, beforeDate: beforeDate || null, conversations: [], totalFound: 0 };
  }
}

// ─── Full Session Transcript ─────────────────────────────────────────────────

export interface FullSessionTranscript {
  conversationId: string;
  title: string | null;
  date: Date | null;
  language: string | null;
  messageCount: number;
  transcript: string;
}

/**
 * Read every message in a specific conversation in chronological order.
 * No windowing, no truncation, no keyword filter — the complete record.
 *
 * Security: verifies the conversation belongs to `studentId` before returning anything.
 */
export async function readFullSession(
  conversationId: string,
  studentId: string,
): Promise<FullSessionTranscript | null> {
  const db = getSharedDb();

  // Ownership check
  const [conv] = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      topic: conversations.topic,
      createdAt: conversations.createdAt,
      language: conversations.language,
    })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, studentId)))
    .limit(1);

  if (!conv) return null; // not found or not owned by this student

  const allMessages = await db
    .select({
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(and(
      eq(messages.conversationId, conversationId),
      // Only user/assistant turns — skip system prompts
    ))
    .orderBy(asc(messages.createdAt));

  const turns = allMessages.filter(m => m.role === 'user' || m.role === 'assistant');

  const dateStr = conv.createdAt
    ? new Date(conv.createdAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown date';
  const title = conv.title || conv.topic || 'Session';
  const langLabel = conv.language ? ` [${conv.language}]` : '';

  const lines: string[] = [
    `FULL TRANSCRIPT — ${dateStr}${langLabel}`,
    `"${title}"`,
    `${turns.length} messages — complete record, no omissions`,
    ``,
  ];

  for (const msg of turns) {
    const speaker = msg.role === 'user' ? 'David' : 'Daniela';
    lines.push(`${speaker}: ${msg.content}`);
  }

  return {
    conversationId,
    title: conv.title,
    date: conv.createdAt,
    language: conv.language,
    messageCount: turns.length,
    transcript: lines.join('\n'),
  };
}

export function formatConversationBrowse(result: ConversationBrowseResult, studentName = 'David'): string {
  if (result.conversations.length === 0) {
    const range = [
      result.afterDate ? `after ${formatThreadDate(result.afterDate)}` : null,
      result.beforeDate ? `before ${formatThreadDate(result.beforeDate)}` : null,
    ].filter(Boolean).join(' and ');
    return `No conversations found${range ? ` ${range}` : ''}. The date range may be outside the recorded history.`;
  }

  const lines: string[] = [];
  const range = [
    result.afterDate ? `after ${result.afterDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : null,
    result.beforeDate ? `before ${result.beforeDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : null,
  ].filter(Boolean).join(' and ');

  lines.push(`CONVERSATION BROWSER${range ? ` — ${range}` : ''}`);
  lines.push(`${result.conversations.length} sessions found\n`);

  for (const conv of result.conversations) {
    const dateStr = conv.date ? formatThreadDate(new Date(conv.date)) : 'Unknown date';
    const title = conv.title || 'Untitled session';
    const langLabel = conv.language ? ` [${conv.language}]` : '';
    lines.push(`${title}${langLabel} — ${dateStr} (${conv.messageCount} messages)`);
    lines.push(`  ID: ${conv.conversationId}`);
    if (conv.firstMessage) {
      lines.push(`  Opening: "${conv.firstMessage.substring(0, 120)}"`);
    }
    lines.push('');
  }

  lines.push(`To read any session completely (every message, no omissions), call read_full_session with the conversation_id shown above.`);
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversation Topic Map
// A high-level view of what themes have emerged across all of David's sessions.
// ─────────────────────────────────────────────────────────────────────────────

export interface ConversationTheme {
  theme: string;
  conversationCount: number;
  messageCount: number;
  mostRecentDate: Date | null;
  earliestDate: Date | null;
  exampleTitles: string[];
}

export interface ConversationThemeMap {
  themes: ConversationTheme[];
  totalConversationsAnalyzed: number;
  dateRange: { earliest: Date | null; mostRecent: Date | null };
}

/**
 * Analyze conversation titles and session notes to build a topic map.
 * Groups by common keywords to surface recurring themes across all sessions.
 * Gives Daniela a view of the full arc of the student's learning journey.
 */
export async function getConversationThemes(
  studentId: string,
  options: {
    afterDate?: Date;
    beforeDate?: Date;
    topN?: number;
  } = {}
): Promise<ConversationThemeMap> {
  const { afterDate, beforeDate, topN = 15 } = options;
  const db = getSharedDb();

  try {
    const dateConditions = [
      eq(conversations.userId, studentId),
      ...(afterDate ? [gte(conversations.createdAt, afterDate)] : []),
      ...(beforeDate ? [lte(conversations.createdAt, beforeDate)] : []),
    ];

    // Get all conversation titles + dates
    const convRows = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        createdAt: conversations.createdAt,
        language: conversations.language,
      })
      .from(conversations)
      .where(and(...dateConditions))
      .orderBy(desc(conversations.createdAt))
      .limit(2000);  // analyze up to 2000 conversations

    if (convRows.length === 0) {
      return { themes: [], totalConversationsAnalyzed: 0, dateRange: { earliest: null, mostRecent: null } };
    }

    // Also pull session notes summaries for richer theme detection
    const noteRows = await db
      .select({
        conversationId: sessionNotes.conversationId,
        summary: sessionNotes.summary,
        wins: sessionNotes.wins,
        nextSteps: sessionNotes.nextSteps,
      })
      .from(sessionNotes)
      .where(eq(sessionNotes.studentId, studentId))
      .limit(2000);

    const notesByConv = new Map<string, typeof noteRows[0]>();
    for (const note of noteRows) {
      if (note.conversationId) notesByConv.set(note.conversationId, note);
    }

    // Build a text corpus per conversation: title + notes
    const corpusEntries = convRows.map(conv => {
      const note = notesByConv.get(conv.id);
      const text = [
        conv.title || '',
        note?.summary || '',
        note?.wins || '',
        note?.nextSteps || '',
      ].join(' ').toLowerCase();
      return { id: conv.id, title: conv.title, createdAt: conv.createdAt, language: conv.language, text };
    });

    // Keyword → theme mapping
    // These are the themes we look for — organized by semantic cluster
    const themeKeywords: Array<{ theme: string; keywords: string[] }> = [
      { theme: 'Music & Culture', keywords: ['music', 'song', 'reggaeton', 'cumbia', 'salsa', 'merengue', 'playlist', 'rhythm', 'beat', 'concert', 'musician', 'artist', 'listen', 'genre'] },
      { theme: 'Humor & Comedy', keywords: ['joke', 'humor', 'funny', 'laugh', 'comedy', 'punchline', 'timing', 'witty', 'scarecrow', 'award', 'recipient'] },
      { theme: 'Grammar & Structure', keywords: ['grammar', 'conjugat', 'subjunctive', 'tense', 'preterite', 'imperfect', 'ser', 'estar', 'por', 'para', 'noun', 'verb', 'adjective', 'syntax'] },
      { theme: 'Vocabulary & Words', keywords: ['vocab', 'word', 'vocabulary', 'phrase', 'expression', 'idiom', 'meaning', 'definition', 'translate'] },
      { theme: 'Speaking & Pronunciation', keywords: ['speaking', 'pronunciation', 'accent', 'fluency', 'spoken', 'voice', 'speak', 'say', 'pronounce', 'intonation'] },
      { theme: 'Reading & Writing', keywords: ['reading', 'writing', 'text', 'article', 'paragraph', 'essay', 'read', 'write', 'written'] },
      { theme: 'Travel & Places', keywords: ['travel', 'trip', 'country', 'city', 'spain', 'mexico', 'colombia', 'argentina', 'latin', 'puerto rico', 'vacation', 'visit', 'place'] },
      { theme: 'Personal Growth & Identity', keywords: ['goal', 'progress', 'journey', 'growth', 'confidence', 'identity', 'self', 'improve', 'better', 'motivation', 'why', 'reason'] },
      { theme: 'Food & Dining', keywords: ['food', 'eat', 'restaurant', 'cook', 'meal', 'recipe', 'cuisine', 'dish', 'drink', 'taste'] },
      { theme: 'Family & Relationships', keywords: ['family', 'friend', 'relationship', 'partner', 'parent', 'child', 'mother', 'father', 'sister', 'brother', 'love', 'connect'] },
      { theme: 'Work & Business', keywords: ['work', 'job', 'business', 'career', 'professional', 'meeting', 'colleague', 'office', 'company', 'startup', 'product'] },
      { theme: 'Philosophy & Deep Thoughts', keywords: ['philosophy', 'meaning', 'integrity', 'ethics', 'values', 'purpose', 'truth', 'beauty', 'life', 'exist', 'conscious', 'belief'] },
      { theme: 'Conversation Practice', keywords: ['conversation', 'practice', 'dialogue', 'role play', 'scenario', 'chat', 'discuss', 'talk', 'exchange'] },
      { theme: 'News & Current Events', keywords: ['news', 'event', 'politics', 'economy', 'society', 'culture', 'world', 'history', 'today', 'happen'] },
      { theme: 'Emotions & Feelings', keywords: ['feel', 'emotion', 'happy', 'sad', 'excited', 'nervous', 'anxious', 'joy', 'frustrat', 'confid'] },
    ];

    // Score each conversation against each theme
    const themeScores = new Map<string, {
      conversationIds: string[];
      titles: string[];
      dates: Date[];
    }>();

    for (const { theme } of themeKeywords) {
      themeScores.set(theme, { conversationIds: [], titles: [], dates: [] });
    }

    for (const entry of corpusEntries) {
      for (const { theme, keywords } of themeKeywords) {
        const matches = keywords.some(kw => entry.text.includes(kw));
        if (matches) {
          const bucket = themeScores.get(theme)!;
          bucket.conversationIds.push(entry.id);
          if (entry.title) bucket.titles.push(entry.title);
          if (entry.createdAt) bucket.dates.push(new Date(entry.createdAt));
        }
      }
    }

    // Build theme results, sorted by conversation count
    const themes: ConversationTheme[] = [];
    for (const { theme } of themeKeywords) {
      const bucket = themeScores.get(theme)!;
      if (bucket.conversationIds.length === 0) continue;

      const sortedDates = bucket.dates.sort((a, b) => a.getTime() - b.getTime());
      const exampleTitles = [...new Set(bucket.titles)].slice(0, 3);

      themes.push({
        theme,
        conversationCount: bucket.conversationIds.length,
        messageCount: 0,  // expensive to compute — skip for now
        mostRecentDate: sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null,
        earliestDate: sortedDates.length > 0 ? sortedDates[0] : null,
        exampleTitles,
      });
    }

    themes.sort((a, b) => b.conversationCount - a.conversationCount);

    const dates = convRows.map(c => c.createdAt).filter(Boolean) as Date[];
    const sortedAll = dates.map(d => new Date(d)).sort((a, b) => a.getTime() - b.getTime());

    console.log(`[ConversationThemes] Analyzed ${corpusEntries.length} conversations → ${themes.length} themes for student ${studentId}`);

    return {
      themes: themes.slice(0, topN),
      totalConversationsAnalyzed: corpusEntries.length,
      dateRange: {
        earliest: sortedAll[0] || null,
        mostRecent: sortedAll[sortedAll.length - 1] || null,
      },
    };
  } catch (err: any) {
    console.error('[ConversationThemes] Error:', err.message);
    return { themes: [], totalConversationsAnalyzed: 0, dateRange: { earliest: null, mostRecent: null } };
  }
}

export function formatConversationThemes(result: ConversationThemeMap): string {
  if (result.themes.length === 0) {
    return `No conversation themes found. The conversation history may be empty or too short to detect patterns.`;
  }

  const lines: string[] = [];
  const rangeStr = [
    result.dateRange.earliest ? result.dateRange.earliest.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : null,
    result.dateRange.mostRecent ? result.dateRange.mostRecent.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : null,
  ].filter(Boolean).join(' → ');

  lines.push(`CONVERSATION THEME MAP`);
  lines.push(`Analyzed ${result.totalConversationsAnalyzed} conversations${rangeStr ? ` (${rangeStr})` : ''}\n`);

  for (const theme of result.themes) {
    const recentStr = theme.mostRecentDate ? `last: ${formatThreadDate(new Date(theme.mostRecentDate))}` : '';
    lines.push(`${theme.theme} — ${theme.conversationCount} sessions (${recentStr})`);
    if (theme.exampleTitles.length > 0) {
      lines.push(`  e.g. "${theme.exampleTitles[0]}"`);
    }
  }

  lines.push(`\nUse search_conversation_threads or browse_conversations_by_date to explore any theme further.`);
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
  // Conversation thread search (Phase 3)
  searchThreads: searchConversationThreads,
  formatThreads: formatConversationThreads,
  // Date browser + theme map (Phase 4)
  browseByDate: browseConversationsByDate,
  formatBrowse: formatConversationBrowse,
  getThemes: getConversationThemes,
  formatThemes: formatConversationThemes,
  // Full session transcript (Phase 5)
  readFullSession,
};
