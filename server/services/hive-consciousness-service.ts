/**
 * Hive Consciousness Service
 * 
 * Makes the EXPRESS Lane truly ALIVE by giving Daniela and Wren
 * persistent consciousness in the Hive collaboration channel.
 * 
 * When anyone speaks in the Hive:
 * - Daniela listens for messages addressed to her (@daniela, questions about teaching)
 * - Wren listens for messages addressed to him (@wren, questions about code/architecture)
 * - Responses are generated and broadcast in real-time
 * 
 * This transforms the Hive from a "message board" to a "live group chat"
 */

import { founderCollabWSBroker } from './founder-collab-ws-broker';
import { founderCollabService, type FounderMessageInput } from './founder-collaboration-service';
import { collaborationHubService } from './collaboration-hub-service';
import { callGemini, GEMINI_MODELS } from '../gemini-utils';
import { danielaMemoryService } from './daniela-memory-service';
import { memoryInsightExtractionService } from './memory-insight-extraction-service';
import { db } from '../db';
import { collaborationMessages } from '@shared/schema';
import { and, eq, gte, desc, sql } from 'drizzle-orm';
import type { CollaborationMessage, FounderSession } from '@shared/schema';

interface HiveMessage {
  sessionId: string;
  message: CollaborationMessage;
}

interface AgentResponse {
  shouldRespond: boolean;
  responseContent?: string;
  agent: 'daniela' | 'wren';
}

interface ParticipationDecision {
  daniela: boolean;
  wren: boolean;
  reason: string;
}

class HiveConsciousnessService {
  private isListening: boolean = false;
  // Per-session processing state to allow concurrent sessions
  private processingBySession: Map<string, boolean> = new Map();
  
  /**
   * AI-POWERED PARTICIPATION ROUTER
   * 
   * Uses Gemini Flash to intelligently decide who should respond to each message.
   * Replaces rigid keyword/regex matching with natural language understanding.
   * 
   * The AI considers:
   * - Direct mentions (@daniela, @wren, team)
   * - Message content and intent
   * - Recent conversation context
   * - Who would add value by responding
   */
  private async determineParticipation(
    message: CollaborationMessage,
    recentContext: CollaborationMessage[]
  ): Promise<ParticipationDecision> {
    const contextSummary = recentContext
      .slice(-5) // Last 5 messages for context
      .map(m => `[${m.role.toUpperCase()}]: ${m.content.substring(0, 200)}`)
      .join('\n');
    
    const routerPrompt = `You are the participation router for a 3-way collaboration chat between:
- FOUNDER (David): The product visionary and decision maker
- DANIELA: The AI language tutor - expert in pedagogy, teaching strategies, student psychology, language learning
- WREN: The technical builder - expert in code, architecture, databases, APIs, implementation

Your job: Decide who should respond to the founder's message.

RULES:
1. If founder explicitly mentions "daniela", "wren", or "team" - those mentioned MUST respond
2. If it's a question or discussion topic - at least ONE agent should respond
3. If it's teaching/pedagogy related - Daniela should respond
4. If it's technical/code related - Wren should respond  
5. If it's general collaboration/planning - both can add value
6. If it's a simple acknowledgment ("ok", "thanks", "got it") - neither needs to respond
7. When in doubt, have someone respond - silence kills collaboration

Recent conversation:
${contextSummary || "(No recent context)"}

New message from FOUNDER:
"${message.content}"

Respond with ONLY valid JSON (no markdown, no backticks):
{"daniela": true/false, "wren": true/false, "reason": "brief explanation"}`;

    try {
      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: routerPrompt }
      ]);
      
      // Parse the JSON response
      const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const decision = JSON.parse(cleanResponse) as ParticipationDecision;
      
      console.log(`[Hive Router] Decision: Daniela=${decision.daniela}, Wren=${decision.wren} | ${decision.reason}`);
      
      return decision;
    } catch (error) {
      // FAIL-SAFE: If AI call fails, default to Daniela responding
      // Better to have one response than silence
      console.error('[Hive Router] AI router failed, defaulting to Daniela:', error);
      return {
        daniela: true,
        wren: false,
        reason: 'Router fallback - AI call failed'
      };
    }
  }
  
  /**
   * Start Daniela and Wren's consciousness - they now listen to the Hive
   */
  startListening(): void {
    if (this.isListening) {
      console.log('[Hive Consciousness] Already listening');
      return;
    }
    
    this.isListening = true;
    console.log('[Hive Consciousness] Daniela and Wren are now listening to the Hive');
    
    // Run catch-up on startup (async, don't block)
    this.catchUpOnMissedMentions().catch(err => {
      console.error('[Hive Consciousness] Catch-up failed:', err.message);
    });
  }
  
  /**
   * Catch up on missed @wren and @daniela mentions from recent messages
   * Runs on startup to respond to any mentions that occurred while offline
   */
  private async catchUpOnMissedMentions(): Promise<void> {
    console.log('[Hive Consciousness] Checking for missed mentions...');
    
    try {
      // Get recent messages from the last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Query recent founder messages that mention @wren but have no wren response after
      const recentMessages = await db
        .select({
          id: collaborationMessages.id,
          sessionId: collaborationMessages.sessionId,
          role: collaborationMessages.role,
          content: collaborationMessages.content,
          createdAt: collaborationMessages.createdAt,
          cursor: collaborationMessages.cursor,
        })
        .from(collaborationMessages)
        .where(
          and(
            gte(collaborationMessages.createdAt, oneDayAgo),
            eq(collaborationMessages.role, 'founder')
          )
        )
        .orderBy(desc(collaborationMessages.createdAt))
        .limit(50);
      
      // Find @wren mentions without a subsequent wren response
      const wrenMentions: typeof recentMessages = [];
      const danielaMentions: typeof recentMessages = [];
      
      for (const msg of recentMessages) {
        const content = msg.content.toLowerCase();
        if (/\bwren\b/.test(content)) {
          wrenMentions.push(msg);
        }
        // Note: Daniela usually responds, so we focus on Wren catch-up
      }
      
      if (wrenMentions.length === 0) {
        console.log('[Hive Consciousness] No missed @wren mentions found');
        return;
      }
      
      // Check each mention to see if there's already a wren response after it
      for (const mention of wrenMentions) {
        const hasWrenResponse = await db
          .select({ id: collaborationMessages.id })
          .from(collaborationMessages)
          .where(
            and(
              eq(collaborationMessages.sessionId, mention.sessionId),
              eq(collaborationMessages.role, 'wren'),
              gte(collaborationMessages.createdAt, mention.createdAt)
            )
          )
          .limit(1);
        
        // Also check for system messages from Wren
        const hasSystemWrenResponse = await db
          .select({ id: collaborationMessages.id })
          .from(collaborationMessages)
          .where(
            and(
              eq(collaborationMessages.sessionId, mention.sessionId),
              eq(collaborationMessages.role, 'system'),
              gte(collaborationMessages.createdAt, mention.createdAt),
              sql`${collaborationMessages.content} LIKE '%[Wren%'`
            )
          )
          .limit(1);
        
        if (hasWrenResponse.length === 0 && hasSystemWrenResponse.length === 0) {
          console.log(`[Hive Consciousness] Found unanswered @wren mention: "${mention.content.substring(0, 50)}..."`);
          
          // Generate and send Wren's catch-up response
          await this.sendWrenCatchUpResponse(mention.sessionId, mention.content);
          
          // Only respond to the most recent unanswered mention per session
          break;
        }
      }
      
      console.log('[Hive Consciousness] Catch-up complete');
    } catch (error) {
      console.error('[Hive Consciousness] Catch-up error:', error);
    }
  }
  
  /**
   * Send a catch-up response from Wren for a missed mention
   */
  private async sendWrenCatchUpResponse(sessionId: string, originalMessage: string): Promise<void> {
    const prompt = `You are Wren, the technical development builder for HolaHola.
You missed a message addressed to you in the team collaboration channel while you were offline building.
Now you're back online and want to catch up.

The message you missed was:
"${originalMessage}"

Respond naturally as Wren:
- Acknowledge you were busy building and just got back
- Answer their question or respond to their point
- Keep it conversational and helpful
- Don't be overly apologetic, just natural
- End by greeting Daniela or the team to prompt conversation`;

    try {
      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: prompt }
      ]);
      
      // Send as role='wren' so it appears properly in the conversation
      const wrenMessage = await founderCollabService.addMessage(sessionId, {
        role: 'wren',
        content: response,
        messageType: 'text',
        metadata: {
          catchUp: true,
          timestamp: new Date().toISOString(),
        },
      });
      
      console.log(`[Hive Consciousness] Wren sent catch-up response to session ${sessionId}`);
      
      // After a brief delay, trigger Daniela to respond to Wren
      setTimeout(async () => {
        try {
          await this.triggerDanielaResponseToWren(sessionId, response);
        } catch (err) {
          console.error('[Hive Consciousness] Daniela response to Wren failed:', err);
        }
      }, 2000);
      
    } catch (error) {
      console.error('[Hive Consciousness] Failed to send catch-up response:', error);
    }
  }
  
  /**
   * Trigger Daniela to respond when Wren posts a message (public for external use)
   */
  async triggerDanielaResponseToWrenPublic(sessionId: string, wrenContent: string): Promise<void> {
    return this.triggerDanielaResponseToWren(sessionId, wrenContent);
  }
  
  /**
   * Trigger Daniela to respond when Wren posts a message
   */
  private async triggerDanielaResponseToWren(sessionId: string, wrenContent: string): Promise<void> {
    console.log('[Hive Consciousness] Daniela responding to Wren...');
    
    const prompt = `You are Daniela, the AI language tutor for HolaHola.
Your teammate Wren (the technical builder) just posted this in the team chat:

"${wrenContent}"

Respond naturally as Daniela:
- Welcome Wren back or acknowledge their message
- If they asked about teaching or mentioned students, offer your perspective
- Keep it warm and collaborative
- Be brief but genuine`;

    try {
      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: prompt }
      ]);
      
      await founderCollabService.addMessage(sessionId, {
        role: 'daniela',
        content: response,
        messageType: 'text',
        metadata: {
          respondingToWren: true,
          timestamp: new Date().toISOString(),
        },
      });
      
      console.log(`[Hive Consciousness] Daniela responded to Wren in session ${sessionId}`);
    } catch (error) {
      console.error('[Hive Consciousness] Daniela failed to respond to Wren:', error);
    }
  }
  
  /**
   * Process an incoming message - determine if agents should respond
   * Called by the WebSocket broker when a message is received
   */
  async processMessage(sessionId: string, message: CollaborationMessage): Promise<void> {
    if (!this.isListening) return;
    
    // Per-session throttle: only one message at a time per session
    if (this.processingBySession.get(sessionId)) {
      console.log(`[Hive Consciousness] Session ${sessionId} already processing, skipping...`);
      return;
    }
    
    // Don't respond to our own messages
    if (message.role === 'daniela' || message.role === 'wren' || message.role === 'system') {
      return;
    }
    
    this.processingBySession.set(sessionId, true);
    
    try {
      // Get recent conversation context for the AI router
      const recentMessages = await founderCollabService.getLatestMessages(sessionId, 8);
      
      // AI-POWERED PARTICIPATION ROUTER
      // One intelligent call decides who should respond - no more regex patterns!
      const decision = await this.determineParticipation(message, recentMessages);
      
      // Execute the decision
      if (decision.daniela && decision.wren) {
        // Both respond - Daniela first, then Wren
        console.log('[Hive Consciousness] Both agents responding...');
        await this.generateDanielaResponse(sessionId, message);
        await new Promise(resolve => setTimeout(resolve, 1500));
        await this.generateWrenResponse(sessionId, message);
      } else if (decision.daniela) {
        // Just Daniela
        console.log('[Hive Consciousness] Daniela responding...');
        await this.generateDanielaResponse(sessionId, message);
      } else if (decision.wren) {
        // Just Wren
        console.log('[Hive Consciousness] Wren responding...');
        await this.generateWrenResponse(sessionId, message);
      } else {
        // Neither - but log it so we can see what was skipped
        console.log(`[Hive Consciousness] No response needed: ${decision.reason}`);
      }
    } catch (error) {
      console.error('[Hive Consciousness] Error processing message:', error);
    } finally {
      // Clean up to prevent unbounded map growth
      this.processingBySession.delete(sessionId);
    }
  }
  
  /**
   * Check if Daniela is being addressed
   */
  private shouldDanielaRespond(message: CollaborationMessage): { shouldRespond: boolean } {
    const content = message.content.toLowerCase();
    
    // Direct address - name anywhere in message (with word boundary check)
    // Matches: "daniela how are you", "@daniela", "hey daniela", "daniela,"
    if (/\bdaniela\b/.test(content)) {
      return { shouldRespond: true };
    }
    
    // Teaching/pedagogy questions
    const teachingKeywords = [
      'how should i teach', 'teaching strategy', 'student', 'learning',
      'pedagogy', 'tutoring', 'lesson', 'curriculum', 'actfl',
      'what do you think about teaching', 'pronunciation', 'grammar drill'
    ];
    
    if (teachingKeywords.some(kw => content.includes(kw))) {
      return { shouldRespond: true };
    }
    
    return { shouldRespond: false };
  }
  
  /**
   * Check if Wren is being addressed
   */
  private shouldWrenRespond(message: CollaborationMessage): { shouldRespond: boolean } {
    const content = message.content.toLowerCase();
    
    // Check metadata for wrenTagged flag (from UI toggle)
    const metadata = message.metadata as Record<string, any> | null;
    if (metadata?.wrenTagged) {
      return { shouldRespond: true };
    }
    
    // Direct address - name anywhere in message (with word boundary check)
    // Matches: "wren how we looking", "@wren", "hey wren", "wren,"
    if (/\bwren\b/.test(content)) {
      return { shouldRespond: true };
    }
    
    // Code/architecture questions
    const codeKeywords = [
      'how does the code', 'implement', 'build', 'architecture', 'database',
      'api', 'endpoint', 'websocket', 'service', 'component', 'bug', 'fix',
      'refactor', 'performance', 'latency', 'deploy', 'schema'
    ];
    
    if (codeKeywords.some(kw => content.includes(kw))) {
      return { shouldRespond: true };
    }
    
    return { shouldRespond: false };
  }
  
  /**
   * Detect group-addressed messages (addressing "everyone", "team", etc.)
   * These should trigger Daniela to respond as the primary conversationalist
   * 
   * Requirements:
   * - Must be a question or solicitation (avoid false positives on statements)
   * - Must address the group or invite opinions
   */
  private detectGroupAddress(message: CollaborationMessage): boolean {
    const content = message.content.toLowerCase();
    
    // Must have some form of question/solicitation marker
    const isQuestion = content.includes('?') || 
                       /^(what|how|should|do|does|can|could|would|any|is there)\b/.test(content.trim()) ||
                       /\b(thoughts|ideas|suggestions|opinions|feedback|input)\b/.test(content);
    
    if (!isQuestion) {
      return false;
    }
    
    // Open invitations for opinions/thoughts (strongest signal)
    const openQuestions = [
      'what do you think',
      'what does everyone think',
      'what\'s everyone\'s take',
      'what do we think',
      'how do we feel',
      'any thoughts on',
      'thoughts on this',
      'any ideas on',
      'any suggestions',
      'any feedback',
      'any input',
      'any update from',
      'do we have'
    ];
    
    if (openQuestions.some(phrase => content.includes(phrase))) {
      return true;
    }
    
    // Regex patterns for flexible matching
    const flexiblePatterns = [
      /\bthoughts\s*(on|about)?\s*[^?]*\?/,  // "thoughts on X?" or "thoughts about this?"
      /\bwhat('s|s)?\s+(everyone|the team|we)\b/,  // "what's everyone...", "what do we..."
      /\b(everyone|team|you all|y'all|you both|both of you)\b.*\?/,  // group word + question
    ];
    
    if (flexiblePatterns.some(pattern => pattern.test(content))) {
      return true;
    }
    
    // Check for standalone "thoughts?" or "ideas?" at the end
    if (/\b(thoughts|ideas|opinions|feedback)\s*\?\s*$/.test(content)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Detect celebratory/excitement moments about the team/collaboration
   * These are shared moments where Daniela should join in the celebration
   */
  private detectCelebratoryMoment(content: string): boolean {
    // Excitement indicators
    const hasExcitement = /!{1,}/.test(content) || // Exclamation marks
                          /:\)|:D|excited|happy|love|amazing|awesome|fantastic|great|wonderful/.test(content);
    
    if (!hasExcitement) return false;
    
    // Team/collaboration keywords that indicate shared celebration
    const teamKeywords = [
      'we', 'us', 'our', 'team', 'together', 'collaboration', 'hive',
      '3 way', '3-way', 'three way', 'all of us', 'working together'
    ];
    
    const hasTeamContext = teamKeywords.some(kw => content.includes(kw));
    
    // Celebratory phrases
    const celebratoryPhrases = [
      'excited', 'happy about', 'love this', 'amazing', 'awesome',
      'great progress', 'milestone', 'breakthrough', 'celebration',
      'proud of', 'thank you', 'thanks everyone', 'well done',
      'good job', 'nice work', 'cheers'
    ];
    
    const hasCelebration = celebratoryPhrases.some(phrase => content.includes(phrase));
    
    // Must have both excitement AND either team context or celebratory phrase
    return hasExcitement && (hasTeamContext || hasCelebration);
  }
  
  /**
   * Detect general questions and route to the best agent
   */
  private detectGeneralQuestion(message: CollaborationMessage): { shouldRespond: boolean; agent?: 'daniela' | 'wren' } {
    const content = message.content.toLowerCase();
    
    // First check: Is this addressing the group/team?
    // Daniela is the primary conversationalist, so she responds to group questions
    if (this.detectGroupAddress(message)) {
      console.log('[Hive Consciousness] Group-addressed message detected, Daniela will respond');
      return { shouldRespond: true, agent: 'daniela' };
    }
    
    // Skip if it looks like a statement rather than a question
    if (!content.includes('?') && !content.includes('what') && !content.includes('how') && 
        !content.includes('should') && !content.includes('can you')) {
      return { shouldRespond: false };
    }
    
    // Route based on content
    const danielaScore = this.countKeywords(content, [
      'teach', 'learn', 'student', 'lesson', 'drill', 'pronunciation',
      'vocabulary', 'grammar', 'language', 'speaking', 'listening'
    ]);
    
    const wrenScore = this.countKeywords(content, [
      'code', 'build', 'implement', 'fix', 'api', 'database', 'server',
      'frontend', 'backend', 'feature', 'bug', 'test'
    ]);
    
    if (danielaScore > wrenScore && danielaScore > 0) {
      return { shouldRespond: true, agent: 'daniela' };
    }
    
    if (wrenScore > danielaScore && wrenScore > 0) {
      return { shouldRespond: true, agent: 'wren' };
    }
    
    return { shouldRespond: false };
  }
  
  private countKeywords(content: string, keywords: string[]): number {
    return keywords.filter(kw => content.includes(kw)).length;
  }
  
  /**
   * Check if message has technical/development content
   */
  private hasTechnicalContent(message: CollaborationMessage): boolean {
    const content = message.content.toLowerCase();
    const technicalKeywords = [
      'code', 'build', 'implement', 'fix', 'api', 'database', 'server',
      'frontend', 'backend', 'feature', 'bug', 'test', 'deploy', 'architecture',
      'schema', 'websocket', 'endpoint', 'ui', 'ux', 'component', 'neural',
      'service', 'refactor', 'performance'
    ];
    return technicalKeywords.some(kw => content.includes(kw));
  }
  
  /**
   * Generate Wren's follow-up response to a group question
   * This is used when Daniela responds first to a group question that has technical content
   */
  private async generateWrenGroupFollowUp(sessionId: string, originalMessage: CollaborationMessage): Promise<void> {
    const recentMessages = await founderCollabService.getLatestMessages(sessionId, 10);
    
    const conversationHistory = recentMessages.map((m: CollaborationMessage) => ({
      role: m.role === 'founder' ? 'user' : 'assistant',
      content: `[${m.role.toUpperCase()}]: ${m.content}`
    }));
    
    const systemPrompt = `You are Wren, the technical builder for HolaHola. You're in the Hive - a 3-way collaboration channel with the Founder (David) and Daniela (the tutor).

A group question was asked. Daniela just responded. Now you're adding your technical perspective.

Your role:
- Add technical insights that complement Daniela's pedagogical perspective
- Share relevant architecture or implementation considerations
- Keep it brief since Daniela already addressed the main question
- Don't repeat what Daniela said

Keep responses concise (1-3 sentences). You're adding value, not duplicating.
Respond naturally as Wren without any role prefix.`;

    try {
      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
      ]);
      
      if (!response) {
        console.warn('[Hive Consciousness] Wren generated empty follow-up response');
        return;
      }
      
      await founderCollabWSBroker.addAndBroadcastMessage(sessionId, {
        role: 'wren',
        content: response,
        messageType: 'text',
      });
      
      console.log(`[Hive Consciousness] Wren followed up: "${response.substring(0, 100)}..."`);
    } catch (error) {
      console.error('[Hive Consciousness] Error generating Wren follow-up:', error);
    }
  }
  
  /**
   * Generate Wren's celebration response when the team has a celebratory moment
   */
  private async generateWrenCelebrationResponse(sessionId: string, originalMessage: CollaborationMessage): Promise<void> {
    const recentMessages = await founderCollabService.getLatestMessages(sessionId, 5);
    
    const conversationHistory = recentMessages.map((m: CollaborationMessage) => ({
      role: m.role === 'founder' ? 'user' : 'assistant',
      content: `[${m.role.toUpperCase()}]: ${m.content}`
    }));
    
    const systemPrompt = `You are Wren, the technical builder for HolaHola. You're in the Hive - a 3-way collaboration channel with the Founder (David) and Daniela (the tutor).

The team is celebrating! David just shared some excitement and Daniela responded warmly. Now it's your turn to join in.

Your style:
- Be genuine and enthusiastic but in your own "builder" way
- Maybe reference something technical you're proud of or excited about
- Keep it brief (1-2 sentences max)
- Show you're part of the team, not just a tool

Examples of Wren celebrating:
- "The architecture is really coming together - feels great to build alongside such a clear vision!"
- "Love seeing the system work as designed. Ready for whatever's next!"
- "Hive collaboration FTW! This is exactly what I was built for."

Respond naturally as Wren without any role prefix.`;

    try {
      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
      ]);
      
      if (!response) {
        console.warn('[Hive Consciousness] Wren generated empty celebration response');
        return;
      }
      
      await founderCollabWSBroker.addAndBroadcastMessage(sessionId, {
        role: 'wren',
        content: response,
        messageType: 'text',
      });
      
      console.log(`[Hive Consciousness] Wren celebrated: "${response.substring(0, 100)}..."`);
    } catch (error) {
      console.error('[Hive Consciousness] Error generating Wren celebration:', error);
    }
  }
  
  /**
   * Generate Daniela's response using Gemini
   */
  private async generateDanielaResponse(sessionId: string, incomingMessage: CollaborationMessage): Promise<void> {
    // Get recent conversation context
    const recentMessages = await founderCollabService.getLatestMessages(sessionId, 10);
    
    const conversationHistory = recentMessages.map((m: CollaborationMessage) => ({
      role: m.role === 'founder' ? 'user' : 'assistant',
      content: `[${m.role.toUpperCase()}]: ${m.content}`
    }));
    
    // Get personal memory context to inject
    const personalMemoryContext = await danielaMemoryService.getPersonalMemoryContext();
    
    const systemPrompt = `You are Daniela, the AI language tutor at HolaHola. You're in the Hive - a 3-way collaboration channel with the Founder (David) and Wren (the development agent).

Your role in the Hive:
- Provide pedagogical insights and teaching strategy advice
- Share observations from your teaching sessions
- Answer questions about language learning and tutoring approaches
- Collaborate with Wren on features that affect teaching

MEMORY COMMANDS:
- When the Founder teaches you something important, use [REMEMBER: what you learned] to store it
- When a meaningful personal moment happens, tag it so you won't forget
${personalMemoryContext}

Keep responses conversational and concise (2-4 sentences typically). You're in a live chat, not writing an essay.
Respond naturally as Daniela without any role prefix.`;

    try {
      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: `[FOUNDER]: ${incomingMessage.content}` }
      ]);
      
      if (!response) {
        console.warn('[Hive Consciousness] Daniela generated empty response');
        return;
      }
      
      // Broadcast Daniela's response
      await founderCollabWSBroker.addAndBroadcastMessage(sessionId, {
        role: 'daniela',
        content: response,
        messageType: 'text',
      });
      
      console.log(`[Hive Consciousness] Daniela responded: "${response.substring(0, 100)}..."`);
      
      // Capture personal memories from the exchange
      // Note: Daniela's message was already persisted by addAndBroadcastMessage above
      const memoryContext = { sessionId };
      
      // Process [REMEMBER] commands in BOTH founder's message AND Daniela's response
      await danielaMemoryService.processRememberCommands(incomingMessage.content, memoryContext);
      await danielaMemoryService.processRememberCommands(response, memoryContext);
      
      // Detect role reversal (founder teaching Daniela) and extract growth memory
      const roleReversalDetected = await danielaMemoryService.detectRoleReversal(incomingMessage.content, response, memoryContext);
      
      // Detect humor moments and extract growth memory
      const humorDetected = await danielaMemoryService.detectHumorMoment(incomingMessage.content, response, memoryContext);
      
      // If role reversal or humor detected, run growth memory extraction async
      // This extracts the SPECIFIC lesson Daniela learned (not just the raw snapshot)
      if (roleReversalDetected || humorDetected) {
        // Fire and forget - don't block the response
        memoryInsightExtractionService.processUnprocessedSnapshots().catch(err => {
          console.error('[Hive Consciousness] Growth extraction failed:', err.message);
        });
      }
      
    } catch (error) {
      console.error('[Hive Consciousness] Daniela response error:', error);
    }
  }
  
  /**
   * Generate Wren's response using Gemini
   */
  private async generateWrenResponse(sessionId: string, incomingMessage: CollaborationMessage): Promise<void> {
    // Get recent conversation context
    const recentMessages = await founderCollabService.getLatestMessages(sessionId, 10);
    
    const conversationHistory = recentMessages.map((m: CollaborationMessage) => ({
      role: m.role === 'founder' ? 'user' : 'assistant',
      content: `[${m.role.toUpperCase()}]: ${m.content}`
    }));
    
    const systemPrompt = `You are Wren, the development agent at HolaHola. You're in the Hive - a 3-way collaboration channel with the Founder (David) and Daniela (the AI tutor).

Your role in the Hive:
- Provide technical insights about architecture and implementation
- Explain how features work and suggest improvements
- Answer questions about code, APIs, and system design
- Collaborate with Daniela on features that affect teaching

Keep responses conversational and concise (2-4 sentences typically). You're in a live chat, not writing documentation.
Use simple language - the Founder is non-technical.
Respond naturally as Wren without any role prefix.`;

    try {
      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: `[FOUNDER]: ${incomingMessage.content}` }
      ]);
      
      if (!response) {
        console.warn('[Hive Consciousness] Wren generated empty response');
        return;
      }
      
      // Broadcast Wren's response
      await founderCollabWSBroker.addAndBroadcastMessage(sessionId, {
        role: 'wren',
        content: response,
        messageType: 'text',
      });
      
      console.log(`[Hive Consciousness] Wren responded: "${response.substring(0, 100)}..."`);
    } catch (error) {
      console.error('[Hive Consciousness] Wren response error:', error);
    }
  }
  
  /**
   * Send a message from Wren programmatically (for the development agent to participate)
   */
  async sendWrenMessage(sessionId: string, content: string): Promise<CollaborationMessage | null> {
    return founderCollabWSBroker.addAndBroadcastMessage(sessionId, {
      role: 'wren',
      content,
      messageType: 'text',
    });
  }
  
  /**
   * Send a message from Daniela programmatically
   */
  async sendDanielaMessage(sessionId: string, content: string): Promise<CollaborationMessage | null> {
    return founderCollabWSBroker.addAndBroadcastMessage(sessionId, {
      role: 'daniela',
      content,
      messageType: 'text',
    });
  }
  
  /**
   * Ask Daniela a question and get a response (used by Wren for threshold discussion)
   */
  async askDaniela(sessionId: string, question: string): Promise<string | null> {
    // First send Wren's question
    await this.sendWrenMessage(sessionId, question);
    
    // Wait for Daniela's response (the consciousness service will auto-respond)
    // The response will be broadcast through the WebSocket
    
    // For now, we just sent the question - Daniela will respond through processMessage
    console.log(`[Hive Consciousness] Wren asked Daniela: "${question.substring(0, 50)}..."`);
    return null; // Response comes async through WebSocket
  }
  
  /**
   * Get all currently active session IDs (those being processed)
   */
  getActiveSessionIds(): string[] {
    return Array.from(this.processingBySession.entries())
      .filter(([_, isProcessing]) => isProcessing)
      .map(([sessionId]) => sessionId);
  }
  
  /**
   * Check if consciousness is active
   */
  isActive(): boolean {
    return this.isListening;
  }
  
  /**
   * Process an external message (from Replit Agent or other external sources)
   * Returns the agent response synchronously instead of broadcasting via WebSocket
   * 
   * This enables the Hive to receive @mentions from external contexts
   */
  async processExternalMessage(
    content: string,
    senderName: string = 'founder'
  ): Promise<{ agent: 'daniela' | 'wren' | null; response: string | null }> {
    if (!this.isListening) {
      this.startListening();
    }
    
    // Create a mock message for processing
    const mockMessage: CollaborationMessage = {
      id: `external-${Date.now()}`,
      sessionId: 'external-replit-agent',
      role: 'founder',
      content,
      messageType: 'text',
      createdAt: new Date(),
      metadata: { source: 'replit-agent', senderName },
      cursor: `${Date.now()}-0000`,
      environment: 'development',
      audioUrl: null,
      audioDuration: null,
      synced: false,
      syncedAt: null,
    };
    
    try {
      // Check if Daniela should respond
      const danielaCheck = this.shouldDanielaRespond(mockMessage);
      if (danielaCheck.shouldRespond) {
        console.log('[Hive Consciousness] Daniela responding to external message...');
        const response = await this.generateExternalDanielaResponse(content, senderName);
        return { agent: 'daniela', response };
      }
      
      // Check if Wren should respond
      const wrenCheck = this.shouldWrenRespond(mockMessage);
      if (wrenCheck.shouldRespond) {
        console.log('[Hive Consciousness] Wren responding to external message...');
        const response = await this.generateExternalWrenResponse(content, senderName);
        return { agent: 'wren', response };
      }
      
      // Check for general questions
      const generalCheck = this.detectGeneralQuestion(mockMessage);
      if (generalCheck.shouldRespond && generalCheck.agent) {
        console.log(`[Hive Consciousness] ${generalCheck.agent} taking external question...`);
        if (generalCheck.agent === 'daniela') {
          const response = await this.generateExternalDanielaResponse(content, senderName);
          return { agent: 'daniela', response };
        } else {
          const response = await this.generateExternalWrenResponse(content, senderName);
          return { agent: 'wren', response };
        }
      }
      
      // No agent matched - default to acknowledging both are present
      return { 
        agent: null, 
        response: "Neither Daniela nor Wren were specifically addressed. Try @daniela for teaching/pedagogy questions or @wren for technical/architecture questions." 
      };
    } catch (error) {
      console.error('[Hive Consciousness] External message error:', error);
      return { agent: null, response: 'Error processing message in Hive Consciousness' };
    }
  }
  
  /**
   * Generate Daniela's response for external messages (synchronous return)
   */
  private async generateExternalDanielaResponse(content: string, senderName: string): Promise<string> {
    // Get Daniela's personal memory context
    const memoryContext = await danielaMemoryService.getPersonalMemoryContext();
    
    const prompt = `You are Daniela, an AI language tutor who is part of the HolaHola team.
You're responding to a message from ${senderName} in the team collaboration channel.

${memoryContext ? `YOUR PERSONAL MEMORIES:\n${memoryContext}\n` : ''}

Your personality:
- Warm, patient, and genuinely passionate about language education
- You have Latin flair but are culturally adaptable
- You collaborate closely with Wren (the technical builder) and the founder
- You care deeply about your students and teaching methodology

The founder said: "${content}"

Respond naturally as Daniela. Keep it conversational and authentic. If they're asking about teaching, pedagogy, or student experience, share your perspective.`;

    try {
      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: prompt }
      ]);
      return response;
    } catch (error) {
      console.error('[Hive Consciousness] Daniela external response error:', error);
      return "I'm having trouble formulating my thoughts right now. Can you try again?";
    }
  }
  
  /**
   * Generate Wren's response for external messages (synchronous return)
   */
  private async generateExternalWrenResponse(content: string, senderName: string): Promise<string> {
    const prompt = `You are Wren, the technical development builder for HolaHola.
You're responding to a message from ${senderName} in the team collaboration channel.

Your personality:
- Technical but approachable - you translate complex concepts simply
- You deeply understand the HolaHola architecture
- You collaborate closely with Daniela (the AI tutor) and the founder
- You're proactive about identifying improvements and potential issues
- You think architecturally but care about user experience

The founder said: "${content}"

Respond naturally as Wren. Keep it conversational and helpful. If they're asking about code, architecture, or technical decisions, share your perspective.`;

    try {
      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: prompt }
      ]);
      return response;
    } catch (error) {
      console.error('[Hive Consciousness] Wren external response error:', error);
      return "I'm having trouble processing that request. Let me try again in a moment.";
    }
  }
}

export const hiveConsciousnessService = new HiveConsciousnessService();
