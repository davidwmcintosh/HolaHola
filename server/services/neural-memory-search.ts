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

import { db } from '../db';
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
  type PeopleConnection,
  type StudentInsight,
  type LearningMotivation,
  type RecurringStruggle,
  type SessionNote,
  type LanguageIdiom,
  type CulturalNuance,
  type TutorProcedure,
  type TeachingPrinciple,
} from '@shared/schema';
import { eq, sql, desc, and, or, ilike } from 'drizzle-orm';

/**
 * Memory search result with source attribution
 */
export interface MemorySearchResult {
  domain: 'person' | 'motivation' | 'insight' | 'struggle' | 'session' | 'progress';
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
 * Search across all memory domains for a student
 * 
 * @param studentId - The student to search memories for
 * @param query - The search query (name, topic, question)
 * @param domains - Optional: limit to specific domains
 */
export async function searchMemory(
  studentId: string,
  query: string,
  domains?: ('person' | 'motivation' | 'insight' | 'struggle' | 'session' | 'progress')[]
): Promise<MemorySearchResponse> {
  const results: MemorySearchResult[] = [];
  const searchedDomains: string[] = [];
  
  // Normalize query for case-insensitive matching
  const normalizedQuery = query.toLowerCase().trim();
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 2);
  
  // Build search pattern for SQL ILIKE
  const searchPattern = `%${normalizedQuery}%`;
  
  const domainsToSearch = domains || ['person', 'motivation', 'insight', 'struggle', 'session', 'progress'];
  
  // Search each domain in parallel
  const searchPromises: Promise<void>[] = [];
  
  // === PEOPLE CONNECTIONS ===
  if (domainsToSearch.includes('person')) {
    searchedDomains.push('person');
    searchPromises.push((async () => {
      try {
        const connections = await db.select().from(peopleConnections)
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
  
  // === STUDENT INSIGHTS ===
  if (domainsToSearch.includes('insight')) {
    searchedDomains.push('insight');
    searchPromises.push((async () => {
      try {
        const insights = await db.select().from(studentInsights)
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
  
  // === LEARNING MOTIVATIONS ===
  if (domainsToSearch.includes('motivation')) {
    searchedDomains.push('motivation');
    searchPromises.push((async () => {
      try {
        const motivations = await db.select().from(learningMotivations)
          .where(and(
            eq(learningMotivations.studentId, studentId),
            eq(learningMotivations.isActive, true),
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
  
  // === RECURRING STRUGGLES ===
  if (domainsToSearch.includes('struggle')) {
    searchedDomains.push('struggle');
    searchPromises.push((async () => {
      try {
        const struggles = await db.select().from(recurringStruggles)
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
            timestamp: struggle.lastOccurred || struggle.createdAt,
            source: 'recurring_struggles',
          });
        }
      } catch (err: any) {
        console.error('[NeuralMemory] Error searching struggles:', err.message);
      }
    })());
  }
  
  // === SESSION NOTES ===
  if (domainsToSearch.includes('session')) {
    searchedDomains.push('session');
    searchPromises.push((async () => {
      try {
        const notes = await db.select().from(sessionNotes)
          .where(and(
            eq(sessionNotes.studentId, studentId),
            or(
              ilike(sessionNotes.wins, searchPattern),
              ilike(sessionNotes.challenges, searchPattern),
              ilike(sessionNotes.nextSteps, searchPattern),
              ilike(sessionNotes.teacherNotes, searchPattern)
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
            details: parts.join('. ') || note.teacherNotes || 'No details recorded.',
            timestamp: note.createdAt,
            source: 'session_notes',
          });
        }
      } catch (err: any) {
        console.error('[NeuralMemory] Error searching sessions:', err.message);
      }
    })());
  }
  
  // === PROGRESS (ACTFL Assessments) ===
  if (domainsToSearch.includes('progress')) {
    searchedDomains.push('progress');
    searchPromises.push((async () => {
      try {
        const assessments = await db.select().from(actflAssessmentEvents)
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
              details: `Assessed at ${assessment.newLevel} level in ${assessment.language}. ${assessment.assessmentType || ''}`,
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
  };
  
  for (const [domain, domainResults] of byDomain) {
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
  const [people, insights, motivations, struggles] = await Promise.all([
    db.select().from(peopleConnections)
      .where(and(
        eq(peopleConnections.isActive, true),
        or(
          eq(peopleConnections.personAId, studentId),
          eq(peopleConnections.personBId, studentId)
        )
      ))
      .limit(100),
    db.select().from(studentInsights)
      .where(and(
        eq(studentInsights.studentId, studentId),
        eq(studentInsights.isActive, true)
      ))
      .limit(100),
    db.select().from(learningMotivations)
      .where(and(
        eq(learningMotivations.studentId, studentId),
        eq(learningMotivations.isActive, true)
      ))
      .limit(20),
    db.select().from(recurringStruggles)
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
  domain: 'idiom' | 'cultural' | 'procedure' | 'principle' | 'error-pattern';
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
  domains?: ('idiom' | 'cultural' | 'procedure' | 'principle' | 'error-pattern')[]
): Promise<TeachingMemoryResponse> {
  const results: TeachingMemoryResult[] = [];
  const searchedDomains: string[] = [];
  
  const normalizedQuery = query.toLowerCase().trim();
  const searchPattern = `%${normalizedQuery}%`;
  
  const domainsToSearch = domains || ['idiom', 'cultural', 'procedure', 'principle', 'error-pattern'];
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
        
        const idioms = await db.select().from(languageIdioms)
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
        
        const nuances = await db.select().from(culturalNuances)
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
  
  // === TUTOR PROCEDURES ===
  if (domainsToSearch.includes('procedure')) {
    searchedDomains.push('procedure');
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
        
        const procedures = await db.select().from(tutorProcedures)
          .where(whereClause)
          .orderBy(desc(tutorProcedures.priority))
          .limit(10);
        
        for (const proc of procedures) {
          const examples = proc.examples?.slice(0, 2).join('; ') || '';
          results.push({
            domain: 'procedure',
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
  
  // === TEACHING PRINCIPLES ===
  if (domainsToSearch.includes('principle')) {
    searchedDomains.push('principle');
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
        
        const principles = await db.select().from(teachingPrinciples)
          .where(whereClause)
          .orderBy(desc(teachingPrinciples.priority))
          .limit(10);
        
        for (const principle of principles) {
          const examples = principle.examples?.slice(0, 2).join('; ') || '';
          results.push({
            domain: 'principle',
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
        
        const errors = await db.select().from(learnerErrorPatterns)
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
  };
  
  // Group by domain
  const byDomain = new Map<string, TeachingMemoryResult[]>();
  for (const result of response.results) {
    if (!byDomain.has(result.domain)) {
      byDomain.set(result.domain, []);
    }
    byDomain.get(result.domain)!.push(result);
  }
  
  for (const [domain, domainResults] of byDomain) {
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
};
