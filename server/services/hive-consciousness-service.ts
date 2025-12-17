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

class HiveConsciousnessService {
  private isListening: boolean = false;
  // Per-session processing state to allow concurrent sessions
  private processingBySession: Map<string, boolean> = new Map();
  
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
      // Check if Daniela should respond
      const danielaCheck = this.shouldDanielaRespond(message);
      if (danielaCheck.shouldRespond) {
        console.log('[Hive Consciousness] Daniela is responding...');
        await this.generateDanielaResponse(sessionId, message);
        return;
      }
      
      // Check if Wren should respond
      const wrenCheck = this.shouldWrenRespond(message);
      if (wrenCheck.shouldRespond) {
        console.log('[Hive Consciousness] Wren is responding...');
        await this.generateWrenResponse(sessionId, message);
        return;
      }
      
      // Neither agent is explicitly addressed - check if it's a general question
      const generalCheck = this.detectGeneralQuestion(message);
      if (generalCheck.shouldRespond && generalCheck.agent) {
        console.log(`[Hive Consciousness] ${generalCheck.agent} taking the question...`);
        if (generalCheck.agent === 'daniela') {
          await this.generateDanielaResponse(sessionId, message);
        } else {
          await this.generateWrenResponse(sessionId, message);
        }
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
   * Detect general questions and route to the best agent
   */
  private detectGeneralQuestion(message: CollaborationMessage): { shouldRespond: boolean; agent?: 'daniela' | 'wren' } {
    const content = message.content.toLowerCase();
    
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
}

export const hiveConsciousnessService = new HiveConsciousnessService();
