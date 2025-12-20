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
import type { LearnerPersonalFact } from '@shared/schema';

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
const EXTRACTION_PROMPT = `You are analyzing a language tutoring conversation to extract personal facts the student shared about their life.

Extract ONLY concrete personal details that would be valuable for the tutor to remember in future sessions. Focus on:
- Life events: trips, weddings, new jobs, moving, babies
- Personal details: occupation, hobbies, pets, family
- Goals: why they're learning, what they want to achieve
- Preferences: learning style, practice time preferences
- Relationships: family members, friends mentioned by name
- Travel: upcoming or past trips
- Work: job, career changes, work situations
- Hobbies: activities they enjoy

DO NOT extract:
- Language learning progress (tracked separately)
- Errors or struggles (tracked separately)
- Generic small talk without personal details
- Anything the tutor said (only student's personal info)

For each fact, provide:
- factType: one of ${PERSONAL_FACT_TYPES.join(', ')}
- fact: concise statement (max 100 chars)
- context: how it came up (max 50 chars)
- relevantDate: ISO date if there's a specific date (e.g., trip date, wedding date)
- confidence: 0-1 how confident this is a real personal fact

Respond with JSON:
{
  "facts": [
    {
      "factType": "travel",
      "fact": "Planning trip to Madrid in June 2025",
      "context": "Mentioned as motivation for learning",
      "relevantDate": "2025-06-01",
      "confidence": 0.9
    }
  ],
  "sessionSummary": "Brief 1-2 sentence summary of what was discussed"
}

If no personal facts were shared, return: {"facts": [], "sessionSummary": "..."}`;

class LearnerMemoryExtractionService {
  
  /**
   * Extract personal facts from a conversation transcript
   */
  async extractFromConversation(
    studentId: string,
    language: string,
    conversationId: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<{ saved: LearnerPersonalFact[]; summary?: string }> {
    try {
      // Filter to just get the conversation content
      const userMessages = messages
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .join('\n');
      
      if (userMessages.length < 50) {
        console.log('[MemoryExtraction] Conversation too short for extraction');
        return { saved: [] };
      }
      
      // Truncate long transcripts to avoid exceeding Gemini Flash limits
      // Keep last N messages to focus on most recent conversation (most likely to have personal details)
      const MAX_MESSAGES = 20;
      const MAX_CHARS_PER_MESSAGE = 500;
      const recentMessages = messages.slice(-MAX_MESSAGES);
      
      const transcript = recentMessages
        .map(m => {
          const role = m.role === 'user' ? 'Student' : 'Tutor';
          const content = m.content.length > MAX_CHARS_PER_MESSAGE 
            ? m.content.slice(0, MAX_CHARS_PER_MESSAGE) + '...'
            : m.content;
          return `${role}: ${content}`;
        })
        .join('\n');
      
      // Call Gemini to extract facts
      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: `${EXTRACTION_PROMPT}\n\nCONVERSATION:\n${transcript}` }
      ]);
      
      // Parse the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('[MemoryExtraction] No JSON found in response');
        return { saved: [] };
      }
      
      const result: ExtractionResult = JSON.parse(jsonMatch[0]);
      
      if (!result.facts || result.facts.length === 0) {
        console.log('[MemoryExtraction] No facts extracted from conversation');
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
        
        try {
          const savedFact = await studentLearningService.savePersonalFact({
            studentId,
            factType: fact.factType,
            fact: fact.fact.slice(0, 200), // Truncate if needed
            context: fact.context?.slice(0, 100),
            language,
            relevantDate: fact.relevantDate ? new Date(fact.relevantDate) : undefined,
            sourceConversationId: conversationId,
          });
          
          saved.push(savedFact);
        } catch (err: any) {
          console.error(`[MemoryExtraction] Failed to save fact: ${err.message}`);
        }
      }
      
      console.log(`[MemoryExtraction] Extracted and saved ${saved.length} personal facts`);
      
      return { saved, summary: result.sessionSummary };
    } catch (err: any) {
      console.error(`[MemoryExtraction] Extraction failed: ${err.message}`);
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
