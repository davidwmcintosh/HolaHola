/**
 * Learner Memory Extraction Service
 * 
 * Automatically extracts personal facts and memorable moments from conversations
 * and stores them as permanent learner memories.
 * 
 * This runs at the end of voice sessions to capture:
 * - Personal details shared by students
 * - Upcoming events and dates
 * - Goals and motivations
 * - Life circumstances relevant to learning
 */

import { callGemini, GEMINI_MODELS } from '../gemini-utils';
import { studentLearningService, type PersonalFactType, PERSONAL_FACT_TYPES } from './student-learning-service';
import type { LearnerPersonalFact, MemoryPrivacySettings } from '@shared/schema';
import { db, getSharedDb, getUserDb } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Structure for extracted facts from conversation
interface ExtractedFact {
  factType: PersonalFactType;
  fact: string;
  context: string;
  relevantDate?: string; // ISO date string if applicable
  confidence: number; // 0-1
}

interface ExtractionResult {
  facts: ExtractedFact[];
  sessionSummary?: string;
}

// Prompt for Gemini to extract personal facts
// CRITICAL: Preserve SPECIFIC details - names, titles, places, dates!
const EXTRACTION_PROMPT = `You are analyzing a language tutoring conversation to extract personal facts the student shared about their life.

CRITICAL: Preserve SPECIFIC DETAILS! When the student mentions:
- Song names, band names, movie titles, book titles → Include the EXACT name
- People's names (family, friends, colleagues) → Include their NAME
- Places (restaurants, cities, neighborhoods) → Include the SPECIFIC place
- Dates, times, ages → Include the EXACT detail
- Numbers, amounts, statistics → Include the EXACT number

❌ BAD: "Enjoys listening to music during car rides"
✅ GOOD: "Loves 'The Promise' by When in Rome - listens during car rides"

❌ BAD: "Has a daughter who plays soccer"  
✅ GOOD: "Daughter Maya plays soccer for the Wildcats team"

❌ BAD: "Works in technology"
✅ GOOD: "Works as a software architect at Replit"

Extract personal details valuable for the tutor to remember. Focus on:
- Life events: trips, weddings, new jobs, moving, babies (with NAMES and DATES)
- Personal details: occupation, hobbies, pets, family (with SPECIFIC names)
- Goals: why they're learning, what they want to achieve
- Preferences: favorite songs, movies, books, restaurants, activities (with TITLES/NAMES)
- Relationships: family members, friends mentioned (with their NAMES)
- Travel: trips with SPECIFIC destinations and dates
- Work: job titles, company names, projects
- Hobbies: activities with SPECIFIC details (team names, venues, etc.)
- Notable mentions: any song, book, movie, artist, or cultural reference they shared

DO NOT extract:
- Language learning progress (tracked separately)
- Errors or struggles (tracked separately)
- Generic observations without specifics
- Anything the tutor said (only student's personal info)

For each fact, provide:
- factType: one of ${PERSONAL_FACT_TYPES.join(', ')}
- fact: detailed statement with specifics preserved (max 200 chars)
- context: how it came up (max 80 chars)
- relevantDate: ISO date if there's a specific date
- confidence: 0-1 how confident this is a real personal fact

Respond with JSON:
{
  "facts": [
    {
      "factType": "preference",
      "fact": "Loves 'The Promise' by When in Rome - was listening during a car ride",
      "context": "Shared music during road trip conversation",
      "relevantDate": null,
      "confidence": 0.95
    },
    {
      "factType": "family",
      "fact": "Daughter Maya (age 8) plays soccer for the Wildcats",
      "context": "Mentioned when discussing weekend plans",
      "relevantDate": null,
      "confidence": 0.9
    }
  ],
  "sessionSummary": "Brief 1-2 sentence summary of what was discussed"
}

If no personal facts were shared, return: {"facts": [], "sessionSummary": "..."}`;

// Summarization prompt for earlier conversation chunks
const SUMMARIZATION_PROMPT = `Summarize the personal details shared by the student in this conversation segment.
Focus ONLY on personal facts (not language learning progress). 
Keep it concise - just list any personal facts mentioned.
If no personal facts, respond with "No personal facts".`;

// Observability metrics for memory extraction
interface ExtractionMetrics {
  totalExtractions: number;
  successfulExtractions: number;
  failedExtractions: number;
  totalFactsSaved: number;
  totalFactsDeduplicated: number;
  totalPrivacyBlocked: number;
  avgExtractionLatencyMs: number;
  latencyHistory: number[]; // Last 100 latencies for averaging
  factsByType: Record<string, number>;
  lastExtractionAt: Date | null;
  hiveSyncs: number;
}

class LearnerMemoryExtractionService {
  
  // Configuration for rolling window extraction
  private readonly MESSAGES_PER_WINDOW = 10;
  private readonly MAX_CHARS_PER_MESSAGE = 400;
  private readonly MAX_TOTAL_CHARS = 8000; // Stay well under Gemini Flash limits
  
  // Default privacy settings
  private readonly DEFAULT_PRIVACY: MemoryPrivacySettings = {
    enabled: true,
    allowedCategories: [],
    blockedCategories: [],
    redactionRequested: false,
  };
  
  // Observability metrics
  private metrics: ExtractionMetrics = {
    totalExtractions: 0,
    successfulExtractions: 0,
    failedExtractions: 0,
    totalFactsSaved: 0,
    totalFactsDeduplicated: 0,
    totalPrivacyBlocked: 0,
    avgExtractionLatencyMs: 0,
    latencyHistory: [],
    factsByType: {},
    lastExtractionAt: null,
    hiveSyncs: 0,
  };
  
  /**
   * Get current observability metrics
   */
  getMetrics(): ExtractionMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Record extraction latency and update average
   */
  private recordLatency(latencyMs: number): void {
    this.metrics.latencyHistory.push(latencyMs);
    // Keep only last 100 latencies
    if (this.metrics.latencyHistory.length > 100) {
      this.metrics.latencyHistory.shift();
    }
    // Recalculate average
    this.metrics.avgExtractionLatencyMs = 
      this.metrics.latencyHistory.reduce((a, b) => a + b, 0) / this.metrics.latencyHistory.length;
  }
  
  /**
   * Increment fact count by type
   */
  private recordFactSaved(factType: string): void {
    this.metrics.totalFactsSaved++;
    this.metrics.factsByType[factType] = (this.metrics.factsByType[factType] || 0) + 1;
  }
  
  /**
   * Get privacy settings for a user
   */
  private async getPrivacySettings(studentId: string): Promise<MemoryPrivacySettings> {
    try {
      const [user] = await getUserDb()
        .select({ memoryPrivacySettings: users.memoryPrivacySettings })
        .from(users)
        .where(eq(users.id, studentId));
      
      if (!user || !user.memoryPrivacySettings) {
        return this.DEFAULT_PRIVACY;
      }
      
      return user.memoryPrivacySettings as MemoryPrivacySettings;
    } catch (err) {
      console.warn('[MemoryExtraction] Failed to get privacy settings, using defaults');
      return this.DEFAULT_PRIVACY;
    }
  }
  
  /**
   * Check if a fact type is allowed by user's privacy settings
   */
  private isCategoryAllowed(
    factType: string,
    privacy: MemoryPrivacySettings
  ): boolean {
    // If memory extraction is disabled, block all
    if (!privacy.enabled) return false;
    
    // If redaction requested, block all
    if (privacy.redactionRequested) return false;
    
    // If blocked categories specified, check if this type is blocked
    if (privacy.blockedCategories.length > 0) {
      if (privacy.blockedCategories.includes(factType)) return false;
    }
    
    // If allowed categories specified (whitelist mode), check if included
    if (privacy.allowedCategories.length > 0) {
      return privacy.allowedCategories.includes(factType);
    }
    
    // Default: allow all
    return true;
  }
  
  /**
   * Split messages into windows for processing long sessions
   */
  private chunkMessages(
    messages: Array<{ role: string; content: string }>
  ): Array<Array<{ role: string; content: string }>> {
    const chunks: Array<Array<{ role: string; content: string }>> = [];
    for (let i = 0; i < messages.length; i += this.MESSAGES_PER_WINDOW) {
      chunks.push(messages.slice(i, i + this.MESSAGES_PER_WINDOW));
    }
    return chunks;
  }
  
  /**
   * Summarize an earlier conversation chunk to preserve personal facts
   */
  private async summarizeChunk(
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    // Guard against undefined/null messages array
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return '';
    }
    
    const transcript = messages
      .filter(m => m && m.content) // Filter out messages with undefined content
      .map(m => {
        const role = m.role === 'user' ? 'Student' : 'Tutor';
        const content = (m.content || '').length > this.MAX_CHARS_PER_MESSAGE 
          ? m.content.slice(0, this.MAX_CHARS_PER_MESSAGE) + '...'
          : (m.content || '');
        return `${role}: ${content}`;
      })
      .join('\n');
    
    try {
      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: `${SUMMARIZATION_PROMPT}\n\n${transcript}` }
      ]);
      return response.trim();
    } catch (err) {
      console.warn('[MemoryExtraction] Failed to summarize chunk, skipping');
      return '';
    }
  }
  
  /**
   * Build optimized transcript with rolling window + summarization
   * - Recent messages: full detail
   * - Earlier messages: summarized for personal facts
   */
  private async buildOptimizedTranscript(
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    // Guard against undefined/null messages array
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return '';
    }
    
    // Filter out messages with undefined content
    const validMessages = messages.filter(m => m && m.content);
    
    // For short conversations, use full transcript
    if (validMessages.length <= this.MESSAGES_PER_WINDOW * 2) {
      return validMessages
        .map(m => {
          const role = m.role === 'user' ? 'Student' : 'Tutor';
          const content = (m.content || '').length > this.MAX_CHARS_PER_MESSAGE 
            ? m.content.slice(0, this.MAX_CHARS_PER_MESSAGE) + '...'
            : (m.content || '');
          return `${role}: ${content}`;
        })
        .join('\n');
    }
    
    // For long sessions: summarize earlier chunks, keep recent in full
    const chunks = this.chunkMessages(validMessages);
    const parts: string[] = [];
    
    // Summarize earlier chunks (all except last 2)
    const earlierChunks = chunks.slice(0, -2);
    if (earlierChunks.length > 0) {
      console.log(`[MemoryExtraction] Summarizing ${earlierChunks.length} earlier conversation chunks`);
      
      // Summarize in parallel for speed
      const summaries = await Promise.all(
        earlierChunks.map(chunk => this.summarizeChunk(chunk))
      );
      
      const validSummaries = summaries.filter(s => s && s !== 'No personal facts');
      if (validSummaries.length > 0) {
        parts.push('[EARLIER IN CONVERSATION - Personal facts mentioned:]');
        parts.push(validSummaries.join('\n'));
        parts.push('\n[RECENT CONVERSATION:]');
      }
    }
    
    // Keep last 2 chunks in full detail
    const recentChunks = chunks.slice(-2);
    const recentTranscript = recentChunks.flat()
      .filter(m => m && m.content) // Filter out undefined content
      .map(m => {
        const role = m.role === 'user' ? 'Student' : 'Tutor';
        const content = (m.content || '').length > this.MAX_CHARS_PER_MESSAGE 
          ? m.content.slice(0, this.MAX_CHARS_PER_MESSAGE) + '...'
          : (m.content || '');
        return `${role}: ${content}`;
      })
      .join('\n');
    
    parts.push(recentTranscript);
    
    // Final safeguard: truncate if somehow exceeded
    const result = parts.join('\n');
    if (result.length > this.MAX_TOTAL_CHARS) {
      console.warn(`[MemoryExtraction] Transcript exceeded ${this.MAX_TOTAL_CHARS} chars, truncating`);
      return result.slice(-this.MAX_TOTAL_CHARS);
    }
    
    return result;
  }
  
  /**
   * Extract personal facts from a conversation transcript
   * Uses rolling window with summarization for long sessions
   */
  async extractFromConversation(
    studentId: string,
    language: string,
    conversationId: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<{ saved: LearnerPersonalFact[]; summary?: string }> {
    const startTime = Date.now();
    this.metrics.totalExtractions++;
    
    try {
      // Guard against undefined/null messages
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        console.log('[MemoryExtraction] No messages provided for extraction');
        this.recordLatency(Date.now() - startTime);
        return { saved: [] };
      }
      
      // Filter to just get the conversation content (guard against undefined content)
      const userMessages = messages
        .filter(m => m && m.role === 'user' && m.content)
        .map(m => m.content)
        .join('\n');
      
      if (userMessages.length < 50) {
        console.log('[MemoryExtraction] Conversation too short for extraction');
        this.recordLatency(Date.now() - startTime);
        return { saved: [] };
      }
      
      // Build optimized transcript using rolling window + summarization
      const transcript = await this.buildOptimizedTranscript(messages);
      
      console.log(`[MemoryExtraction] Processing ${messages.length} messages (${transcript.length} chars)`);
      
      // Call Gemini to extract facts
      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: `${EXTRACTION_PROMPT}\n\nCONVERSATION:\n${transcript}` }
      ]);
      
      // Parse the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('[MemoryExtraction] No JSON found in response');
        this.recordLatency(Date.now() - startTime);
        return { saved: [] };
      }
      
      const result: ExtractionResult = JSON.parse(jsonMatch[0]);
      
      if (!result.facts || result.facts.length === 0) {
        console.log('[MemoryExtraction] No facts extracted from conversation');
        this.metrics.successfulExtractions++;
        this.recordLatency(Date.now() - startTime);
        this.metrics.lastExtractionAt = new Date();
        return { saved: [], summary: result.sessionSummary };
      }
      
      // Get privacy settings for this student
      const privacySettings = await this.getPrivacySettings(studentId);
      
      // Check if memory extraction is completely disabled
      if (!privacySettings.enabled || privacySettings.redactionRequested) {
        console.log(`[MemoryExtraction] Memory disabled for student ${studentId} - skipping all facts`);
        this.metrics.totalPrivacyBlocked += result.facts.length;
        this.recordLatency(Date.now() - startTime);
        return { saved: [], summary: result.sessionSummary };
      }
      
      // Save each extracted fact
      const saved: LearnerPersonalFact[] = [];
      
      for (const fact of result.facts) {
        // Skip low confidence facts
        if (fact.confidence < 0.6) {
          console.log(`[MemoryExtraction] Skipping low confidence fact: ${fact.fact}`);
          continue;
        }
        
        // Validate fact type
        if (!PERSONAL_FACT_TYPES.includes(fact.factType as any)) {
          console.log(`[MemoryExtraction] Invalid fact type: ${fact.factType}`);
          continue;
        }
        
        // Check if category is allowed by privacy settings
        if (!this.isCategoryAllowed(fact.factType, privacySettings)) {
          console.log(`[MemoryExtraction] Category ${fact.factType} blocked by privacy settings`);
          this.metrics.totalPrivacyBlocked++;
          continue;
        }
        
        try {
          const savedFact = await studentLearningService.savePersonalFact({
            studentId,
            factType: fact.factType,
            fact: fact.fact.slice(0, 200), // Truncate if needed
            context: fact.context?.slice(0, 100),
            language,
            relevantDate: fact.relevantDate ? new Date(fact.relevantDate) : undefined,
            sourceConversationId: conversationId,
            confidenceScore: fact.confidence, // Pass through extracted confidence
          });
          
          saved.push(savedFact);
          this.recordFactSaved(fact.factType);
        } catch (err: any) {
          console.error(`[MemoryExtraction] Failed to save fact: ${err.message}`);
          // Check if it was a dedup (fact already existed)
          if (err.message?.includes('duplicate') || err.message?.includes('already exists')) {
            this.metrics.totalFactsDeduplicated++;
          }
        }
      }
      
      console.log(`[MemoryExtraction] Extracted and saved ${saved.length} personal facts`);
      
      this.metrics.successfulExtractions++;
      this.metrics.lastExtractionAt = new Date();
      this.recordLatency(Date.now() - startTime);
      
      return { saved, summary: result.sessionSummary };
    } catch (err: any) {
      console.error(`[MemoryExtraction] Extraction failed: ${err.message}`);
      this.metrics.failedExtractions++;
      this.recordLatency(Date.now() - startTime);
      return { saved: [] };
    }
  }
  
  /**
   * Extract facts from a single message (for real-time detection)
   * Used when explicit [REMEMBER: ...] commands are detected
   */
  async extractFromMessage(
    studentId: string,
    language: string,
    conversationId: string,
    message: string,
    role: 'user' | 'tutor'
  ): Promise<LearnerPersonalFact | null> {
    // Look for [REMEMBER: ...] pattern
    const rememberMatch = message.match(/\[REMEMBER[:\s]+([^\]]+)\]/i);
    
    if (!rememberMatch) {
      return null;
    }
    
    const content = rememberMatch[1].trim();
    
    // Determine fact type from content
    const factType = this.inferFactType(content);
    
    try {
      const saved = await studentLearningService.savePersonalFact({
        studentId,
        factType,
        fact: content.slice(0, 200),
        context: role === 'tutor' ? 'Daniela noted this' : 'Student mentioned',
        language,
        sourceConversationId: conversationId,
        confidenceScore: 0.95, // Explicit commands get high confidence
      });
      
      console.log(`[MemoryExtraction] Saved explicit remember command: ${content.slice(0, 50)}`);
      return saved;
    } catch (err: any) {
      console.error(`[MemoryExtraction] Failed to save explicit memory: ${err.message}`);
      return null;
    }
  }
  
  /**
   * Infer fact type from content
   */
  private inferFactType(content: string): PersonalFactType {
    const lower = content.toLowerCase();
    
    if (lower.includes('trip') || lower.includes('travel') || lower.includes('visit') || lower.includes('vacation')) {
      return 'travel';
    }
    if (lower.includes('work') || lower.includes('job') || lower.includes('career') || lower.includes('office')) {
      return 'work';
    }
    if (lower.includes('family') || lower.includes('wife') || lower.includes('husband') || lower.includes('kid') || lower.includes('child') || lower.includes('parent')) {
      return 'family';
    }
    if (lower.includes('wedding') || lower.includes('birthday') || lower.includes('anniversary') || lower.includes('celebration')) {
      return 'life_event';
    }
    if (lower.includes('want to') || lower.includes('goal') || lower.includes('hope to') || lower.includes('plan to')) {
      return 'goal';
    }
    if (lower.includes('prefer') || lower.includes('like') || lower.includes('enjoy') || lower.includes('love')) {
      return 'preference';
    }
    if (lower.includes('hobby') || lower.includes('play') || lower.includes('sport') || lower.includes('music') || lower.includes('art')) {
      return 'hobby';
    }
    if (lower.includes('friend') || lower.includes('colleague') || lower.includes('partner') || lower.includes('roommate')) {
      return 'relationship';
    }
    
    return 'personal_detail';
  }
}

export const learnerMemoryExtractionService = new LearnerMemoryExtractionService();
