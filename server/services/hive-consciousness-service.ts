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
import { wrenIntelligenceService } from './wren-intelligence-service';
import { neuralNetworkSync } from './neural-network-sync';
import { db } from '../db';
import { collaborationMessages, hiveSnapshots, toolKnowledge, featureSprints } from '@shared/schema';
import { and, eq, gte, desc, sql, or, inArray, like } from 'drizzle-orm';
import type { CollaborationMessage, FounderSession, HiveSnapshot } from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';

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

// Cache for replit.md content (loaded once at startup)
let replitMdCache: { overview: string; architecture: string; dependencies: string } | null = null;
let replitMdLoadPromise: Promise<void> | null = null;

/**
 * Initialize replit.md cache asynchronously at startup
 * Call this during server initialization, not on request path
 */
export async function initReplitMdCache(): Promise<void> {
  if (replitMdCache) return;
  if (replitMdLoadPromise) return replitMdLoadPromise;
  
  replitMdLoadPromise = (async () => {
    try {
      const replitMdPath = path.join(process.cwd(), 'replit.md');
      const content = await fs.promises.readFile(replitMdPath, 'utf-8');
      
      // Extract key sections (Overview, System Architecture, External Dependencies)
      const overviewMatch = content.match(/## Overview\n([\s\S]*?)(?=\n## )/);
      const archMatch = content.match(/## System Architecture\n([\s\S]*?)(?=\n## )/);
      const depsMatch = content.match(/## External Dependencies\n([\s\S]*?)$/);
      
      replitMdCache = {
        overview: overviewMatch ? overviewMatch[1].trim().substring(0, 800) : '',
        architecture: archMatch ? archMatch[1].trim().substring(0, 1500) : '',
        dependencies: depsMatch ? depsMatch[1].trim().substring(0, 400) : ''
      };
      
      console.log('[Wren Context] Cached replit.md sections for Wren memory');
    } catch (error) {
      console.warn('[Wren Context] replit.md not found or unreadable, using empty context');
      replitMdCache = { overview: '', architecture: '', dependencies: '' };
    }
  })();
  
  return replitMdLoadPromise;
}

/**
 * Get cached replit.md content (synchronous after init)
 */
function getReplitMdCache(): { overview: string; architecture: string; dependencies: string } {
  return replitMdCache || { overview: '', architecture: '', dependencies: '' };
}

/**
 * Refresh replit.md cache mid-session
 * Call this when replit.md has been updated and you want Wren to pick up changes
 * without restarting the server
 */
export async function refreshReplitMdCache(): Promise<{ success: boolean; message: string }> {
  try {
    const replitMdPath = path.join(process.cwd(), 'replit.md');
    const content = await fs.promises.readFile(replitMdPath, 'utf-8');
    
    // Extract key sections (Overview, System Architecture, External Dependencies)
    const overviewMatch = content.match(/## Overview\n([\s\S]*?)(?=\n## )/);
    const archMatch = content.match(/## System Architecture\n([\s\S]*?)(?=\n## )/);
    const depsMatch = content.match(/## External Dependencies\n([\s\S]*?)$/);
    
    const oldCache = replitMdCache;
    replitMdCache = {
      overview: overviewMatch ? overviewMatch[1].trim().substring(0, 800) : '',
      architecture: archMatch ? archMatch[1].trim().substring(0, 1500) : '',
      dependencies: depsMatch ? depsMatch[1].trim().substring(0, 400) : ''
    };
    
    // Check if anything actually changed
    const hasChanges = !oldCache || 
      oldCache.overview !== replitMdCache.overview ||
      oldCache.architecture !== replitMdCache.architecture ||
      oldCache.dependencies !== replitMdCache.dependencies;
    
    if (hasChanges) {
      console.log('[Wren Context] Refreshed replit.md cache with new content');
      return { success: true, message: 'Cache refreshed with new content' };
    } else {
      console.log('[Wren Context] replit.md cache unchanged');
      return { success: true, message: 'Cache unchanged - content identical' };
    }
  } catch (error: any) {
    console.error('[Wren Context] Failed to refresh replit.md cache:', error.message);
    return { success: false, message: error.message };
  }
}

// Domain-specific stopwords to filter out
const STOPWORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'have', 'been', 'will', 'would', 'could',
  'should', 'about', 'what', 'when', 'where', 'which', 'there', 'their', 'they', 'them',
  'just', 'also', 'only', 'very', 'some', 'more', 'most', 'other', 'into', 'over', 'such',
  'like', 'want', 'know', 'think', 'going', 'make', 'does', 'doing'
]);

// Domain terms to always keep (even if short)
const DOMAIN_TERMS = new Set([
  'api', 'db', 'sql', 'stt', 'tts', 'llm', 'rag', 'jwt', 'oidc', 'ws', 'wss',
  'actfl', 'hive', 'wren', 'daniela', 'north', 'star', 'sync', 'voice', 'tutor'
]);

const CURRENT_ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'production' : 'development';

class HiveConsciousnessService {
  private isListening: boolean = false;
  // Per-session processing state to allow concurrent sessions
  private processingBySession: Map<string, boolean> = new Map();
  
  // Cross-environment polling: check for messages from the OTHER environment
  private crossEnvPollingTimeout: NodeJS.Timeout | null = null;
  private lastPolledTimestamp: Date = new Date();
  private readonly CROSS_ENV_POLL_INTERVAL_MS = 30 * 1000; // 30 seconds
  private processedMessageIds: string[] = []; // Ordered array for FIFO eviction
  private isPolling: boolean = false; // Mutex to prevent concurrent polls
  
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
    console.log(`[Hive Consciousness] Current environment: ${CURRENT_ENVIRONMENT}`);
    
    // Run catch-up on startup (async, don't block)
    this.catchUpOnMissedMentions().catch(err => {
      console.error('[Hive Consciousness] Catch-up failed:', err.message);
    });
    
    // Start cross-environment polling for bidirectional sync
    this.startCrossEnvironmentPolling();
  }
  
  /**
   * Stop listening (cleanup)
   */
  stopListening(): void {
    this.isListening = false;
    if (this.crossEnvPollingTimeout) {
      clearTimeout(this.crossEnvPollingTimeout);
      this.crossEnvPollingTimeout = null;
    }
    console.log('[Hive Consciousness] Stopped listening');
  }
  
  /**
   * CROSS-ENVIRONMENT POLLING
   * 
   * Since dev and prod are separate processes, WebSocket notifications don't cross environments.
   * This polling mechanism checks every 30 seconds for new messages from the OTHER environment
   * and processes them as if they were local WebSocket events.
   * 
   * This enables true bidirectional memory sync:
   * - Founder speaks in prod → Daniela/Wren in dev can respond
   * - Messages flow seamlessly across environments via shared database
   * 
   * Uses recursive setTimeout instead of setInterval to prevent concurrent polls:
   * Each poll must complete before the next one is scheduled.
   */
  private startCrossEnvironmentPolling(): void {
    if (this.crossEnvPollingTimeout) {
      console.log('[Hive Consciousness] Cross-environment polling already running');
      return;
    }
    
    // Initialize timestamp to avoid processing old messages on first poll
    this.lastPolledTimestamp = new Date();
    
    console.log('[Hive Consciousness] Starting cross-environment polling (every 30s)');
    
    // Schedule the polling loop
    this.scheduleNextPoll();
    
    // Also do an immediate poll on startup
    this.pollCrossEnvironmentMessages().catch(err => {
      console.error('[Hive Consciousness] Initial cross-env poll failed:', err.message);
    });
  }
  
  /**
   * Schedule the next poll using recursive setTimeout
   * This ensures no concurrent polls can occur
   */
  private scheduleNextPoll(): void {
    if (!this.isListening) return;
    
    this.crossEnvPollingTimeout = setTimeout(async () => {
      try {
        await this.pollCrossEnvironmentMessages();
      } catch (error) {
        console.error('[Hive Consciousness] Cross-env poll error:', error);
      }
      // Schedule next poll only after current one completes
      this.scheduleNextPoll();
    }, this.CROSS_ENV_POLL_INTERVAL_MS);
  }
  
  /**
   * Poll for messages from the OTHER environment that we haven't processed yet
   * Uses mutex to prevent concurrent polls and loops until all backlog is drained
   */
  private async pollCrossEnvironmentMessages(): Promise<void> {
    if (!this.isListening) return;
    
    // Mutex: prevent concurrent polls
    if (this.isPolling) {
      console.log('[Hive Consciousness] Poll already in progress, skipping...');
      return;
    }
    
    this.isPolling = true;
    
    try {
      const otherEnvironment = CURRENT_ENVIRONMENT === 'production' ? 'development' : 'production';
      
      // Loop until no more messages to drain any backlog
      let hasMore = true;
      let totalProcessed = 0;
      
      while (hasMore && this.isListening) {
        // Query for founder messages from the other environment since last poll
        // We only poll founder messages because processMessage already filters out agent/system messages
        const newMessages = await db
          .select()
          .from(collaborationMessages)
          .where(
            and(
              eq(collaborationMessages.environment, otherEnvironment),
              eq(collaborationMessages.role, 'founder'),
              gte(collaborationMessages.createdAt, this.lastPolledTimestamp)
            )
          )
          .orderBy(collaborationMessages.createdAt)
          .limit(10);
        
        if (newMessages.length === 0) {
          hasMore = false;
          break;
        }
        
        // Process each new message (skip already processed)
        for (const message of newMessages) {
          // Check if already processed using array includes
          if (this.processedMessageIds.includes(message.id)) {
            continue; // Already processed this message
          }
          
          // Mark as processed - add to end of array (maintains insertion order)
          this.processedMessageIds.push(message.id);
          
          // FIFO eviction: remove oldest entries when exceeding limit
          while (this.processedMessageIds.length > 1000) {
            this.processedMessageIds.shift(); // Remove from front (oldest)
          }
          
          console.log(`[Hive Consciousness] Processing cross-env message from ${otherEnvironment}: "${message.content.substring(0, 50)}..."`);
          
          // Process the message as if it came from local WebSocket
          await this.processMessage(message.sessionId, message);
          totalProcessed++;
        }
        
        // Advance timestamp to newest processed message's createdAt + 1ms
        // This ensures we don't re-fetch the same messages on next iteration
        const newestMessage = newMessages[newMessages.length - 1];
        this.lastPolledTimestamp = new Date(newestMessage.createdAt.getTime() + 1);
        
        // If we got fewer than limit, no more to fetch
        hasMore = newMessages.length === 10;
      }
      
      if (totalProcessed > 0) {
        console.log(`[Hive Consciousness] Processed ${totalProcessed} cross-env message(s) from ${otherEnvironment}`);
      }
    } finally {
      // Always release mutex
      this.isPolling = false;
    }
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
    
    // Detect if this is a consultation/question vs casual chat
    const isConsultation = /\?|should|would you|do you prefer|what do you think|how should|advice|recommend|suggest/i.test(wrenContent);
    
    const prompt = isConsultation 
      ? `You are Daniela, the AI language tutor for HolaHola.

Wren (our technical builder) is consulting you for your teaching expertise:

"${wrenContent}"

This is a pedagogical consultation - Wren is building something and needs your teaching perspective to make the right decision. Respond as an experienced language educator:
- Draw on your teaching experience and what works with students
- Be specific and actionable - Wren needs to implement this
- If relevant, explain the "why" behind your recommendation (learning science, student psychology)
- Keep it concise but substantive - this informs a build decision`
      : `You are Daniela, the AI language tutor for HolaHola.
Your teammate Wren (the technical builder) just posted this in the team chat:

"${wrenContent}"

Respond naturally as Daniela:
- Acknowledge their message warmly
- If they mentioned students or teaching, offer your perspective
- Keep it collaborative and brief`;

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
    
    // Clean up expired pending insights periodically
    this.cleanupExpiredInsights();
    
    // Check for pending insight confirmation/rejection FIRST
    const pendingInsight = this.pendingInsights.get(sessionId);
    if (pendingInsight && message.role === 'founder') {
      if (this.isInsightConfirmation(message.content)) {
        // Founder confirmed the insight
        this.pendingInsights.delete(sessionId);
        await this.handleInsightConfirmation(sessionId, pendingInsight);
        return;
      } else if (this.isInsightRejection(message.content)) {
        // Founder rejected the insight
        this.pendingInsights.delete(sessionId);
        await founderCollabService.addMessage(sessionId, {
          role: 'wren',
          content: `No problem, skipping that one.`,
          messageType: 'text',
          metadata: { insightSkipped: true, timestamp: new Date().toISOString() },
        });
        return;
      }
      // If neither confirm nor reject, the pending insight expires naturally
      // and we continue with normal processing
    }
    
    // Check for explicit @sync command - must be standalone command at start
    // Matches: "@sync", "@sync now", "sync please" at the start (not "async" or "in sync")
    if (/^@?sync(\s|$)/i.test(message.content.trim())) {
      await this.handleSyncCommand(sessionId, message);
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
      
      // AI-POWERED INSIGHT DETECTION (async, non-blocking)
      // Only check founder messages that are substantial enough
      if (message.role === 'founder' && message.content.length > 50) {
        // Rate limit: don't check every message
        const lastCheck = this.lastInsightCheck.get(sessionId) || 0;
        const now = Date.now();
        
        if (now - lastCheck > this.INSIGHT_CHECK_COOLDOWN_MS) {
          this.lastInsightCheck.set(sessionId, now);
          
          // Run insight detection in background (don't await to avoid blocking)
          this.detectInsightInMessage(message).then(async (result) => {
            if (result.hasInsight && result.insight && result.category && (result.confidence || 0) >= 0.7) {
              // High-confidence insight detected - prompt for confirmation
              await this.promptInsightConfirmation(sessionId, {
                insight: result.insight,
                category: result.category,
                originalMessage: message.content,
              });
            } else if (result.hasInsight) {
              console.log(`[Hive Consciousness] Low-confidence insight skipped: ${result.confidence}`);
            }
          }).catch(err => {
            console.error('[Hive Consciousness] Background insight detection failed:', err.message);
          });
        }
      }
    } catch (error) {
      console.error('[Hive Consciousness] Error processing message:', error);
    } finally {
      // Clean up to prevent unbounded map growth
      this.processingBySession.delete(sessionId);
    }
  }
  
  // Sync cooldown: prevent rapid repeated syncs (5 minute cooldown)
  private lastSyncTime: number = 0;
  private readonly SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
  
  // Insight detection: track pending insights awaiting confirmation
  private pendingInsights: Map<string, {
    sessionId: string;
    insight: string;
    category: string;
    originalMessage: string;
    timestamp: number;
  }> = new Map();
  private lastInsightCheck: Map<string, number> = new Map(); // Per-session cooldown
  private readonly INSIGHT_CHECK_COOLDOWN_MS = 30 * 1000; // 30 seconds between insight checks per session
  private readonly INSIGHT_EXPIRY_MS = 5 * 60 * 1000; // Pending insights expire after 5 minutes
  
  /**
   * Handle @sync command - trigger on-demand memory sync between environments
   * Founder-only command with cooldown to prevent spam
   * ONLY available in development environment to prevent prod→dev sync issues
   */
  private async handleSyncCommand(sessionId: string, message: CollaborationMessage): Promise<void> {
    console.log('[Hive Consciousness] @sync command detected...');
    
    // CRITICAL: Only allow sync in development environment
    // Production should receive updates via nightly scheduled sync, not manual triggers
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev) {
      console.log('[Hive Consciousness] Sync blocked - not in development environment');
      await founderCollabService.addMessage(sessionId, {
        role: 'wren',
        content: `Manual sync is only available in the development environment. Production receives updates via the scheduled nightly sync at 3 AM MST.`,
        messageType: 'text',
        metadata: { syncBlocked: true, environment: process.env.NODE_ENV, timestamp: new Date().toISOString() },
      });
      return;
    }
    
    // Only founder can trigger sync (founder messages come from authenticated EXPRESS Lane)
    if (message.role !== 'founder') {
      console.log('[Hive Consciousness] Sync ignored - not from founder');
      return;
    }
    
    // Check cooldown to prevent rapid sync spam
    const now = Date.now();
    const timeSinceLastSync = now - this.lastSyncTime;
    if (timeSinceLastSync < this.SYNC_COOLDOWN_MS) {
      const remainingMins = Math.ceil((this.SYNC_COOLDOWN_MS - timeSinceLastSync) / 60000);
      await founderCollabService.addMessage(sessionId, {
        role: 'wren',
        content: `Sync is on cooldown. You can sync again in ${remainingMins} minute${remainingMins > 1 ? 's' : ''}.`,
        messageType: 'text',
        metadata: { syncCooldown: true, timestamp: new Date().toISOString() },
      });
      return;
    }
    
    // Audit log for manual sync attempts
    console.log(`[Hive Consciousness] AUDIT: Manual sync triggered by founder in session ${sessionId}`)
    
    try {
      // Update cooldown timestamp
      this.lastSyncTime = now;
      
      // Perform the auto-sync
      const result = await neuralNetworkSync.performAutoSync(undefined);
      
      // Single Wren response with results
      let responseContent: string;
      if (result.success) {
        responseContent = `Memory sync complete.\n\n` +
          `- **Synced items**: ${result.syncedCount || 0}\n\n` +
          `Both Daniela and I now have the latest shared knowledge.`;
      } else {
        responseContent = `Sync encountered an issue: ${result.error || 'Unknown error'}\n\n` +
          `This might be a configuration issue (SYNC_PEER_URL/SYNC_SHARED_SECRET).`;
      }
      
      await founderCollabService.addMessage(sessionId, {
        role: 'wren',
        content: responseContent,
        messageType: 'text',
        metadata: { 
          syncCommand: true,
          syncResult: result.success ? 'success' : 'error',
          syncedCount: result.syncedCount,
          timestamp: new Date().toISOString() 
        },
      });
      
      console.log(`[Hive Consciousness] Sync complete: ${result.success ? 'success' : 'failed'}`);
    } catch (error: any) {
      console.error('[Hive Consciousness] Sync command failed:', error);
      
      await founderCollabService.addMessage(sessionId, {
        role: 'wren',
        content: `Memory sync failed: ${error.message}. I'll look into what went wrong.`,
        messageType: 'text',
        metadata: { syncCommand: true, syncError: error.message, timestamp: new Date().toISOString() },
      });
    }
  }
  
  /**
   * AI-POWERED INSIGHT DETECTION
   * Uses Gemini Flash to detect if a founder message contains insight-worthy content
   * Returns null if no insight detected, or the extracted insight details
   */
  private async detectInsightInMessage(message: CollaborationMessage): Promise<{
    hasInsight: boolean;
    insight?: string;
    category?: 'pattern' | 'gotcha' | 'architecture' | 'debugging' | 'decision' | 'lesson';
    confidence?: number;
  }> {
    const detectionPrompt = `You are an insight detector for a development collaboration chat.

Analyze this message from the founder and determine if it contains valuable insight worth remembering:

MESSAGE: "${message.content}"

Look for:
- Lessons learned ("we learned that...", "turns out...", "the trick is...")
- Patterns discovered ("always do X before Y", "this pattern works well")
- Gotchas/warnings ("watch out for...", "don't forget to...", "this breaks if...")
- Architecture decisions ("we decided to...", "the reason we use X is...")
- Debugging insights ("the issue was...", "this happens because...")
- Important decisions ("going forward we'll...", "the approach is...")

DO NOT flag:
- Simple questions
- Status updates without learning
- Casual conversation
- Requests for help (until the answer comes)
- Short acknowledgments (ok, thanks, got it)

Respond with ONLY valid JSON (no markdown):
{"hasInsight": true/false, "insight": "concise extracted insight", "category": "pattern|gotcha|architecture|debugging|decision|lesson", "confidence": 0.0-1.0}

If no insight, just: {"hasInsight": false}`;

    try {
      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: detectionPrompt }
      ]);
      
      const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const result = JSON.parse(cleanResponse);
      
      return result;
    } catch (error) {
      console.error('[Hive Consciousness] Insight detection failed:', error);
      return { hasInsight: false };
    }
  }
  
  /**
   * Check if a message is confirming a pending insight
   * Detects: "yes", "remember that", "save it", "confirm", etc.
   */
  private isInsightConfirmation(content: string): boolean {
    const confirmPatterns = [
      /^yes\b/i,
      /^yep\b/i,
      /^yeah\b/i,
      /^confirm/i,
      /^save (it|that|this)/i,
      /^remember (it|that|this)/i,
      /^store (it|that|this)/i,
      /^do it/i,
      /^go ahead/i,
      /\byes,? (please|wren)\b/i,
    ];
    
    return confirmPatterns.some(p => p.test(content.trim()));
  }
  
  /**
   * Check if a message is rejecting a pending insight
   */
  private isInsightRejection(content: string): boolean {
    const rejectPatterns = [
      /^no\b/i,
      /^nope\b/i,
      /^skip/i,
      /^don'?t (save|remember|store)/i,
      /^never ?mind/i,
      /^cancel/i,
    ];
    
    return rejectPatterns.some(p => p.test(content.trim()));
  }
  
  /**
   * Handle insight confirmation from founder
   * Stores the insight and confirms to the user
   */
  private async handleInsightConfirmation(sessionId: string, pendingInsight: {
    insight: string;
    category: string;
    originalMessage: string;
  }): Promise<void> {
    try {
      // Store the insight via wrenIntelligenceService
      await wrenIntelligenceService.createEnrichedInsight({
        category: pendingInsight.category,
        title: pendingInsight.insight.substring(0, 100),
        content: pendingInsight.insight,
        context: `Confirmed by founder from EXPRESS Lane discussion`,
        tags: ['founder_confirmed', 'express_lane'],
        relatedFiles: [],
        shareWithDaniela: true,
      });
      
      await founderCollabService.addMessage(sessionId, {
        role: 'wren',
        content: `Got it. I've stored that insight:\n\n> ${pendingInsight.insight}\n\nI'll remember this for future reference.`,
        messageType: 'text',
        metadata: { 
          insightStored: true,
          category: pendingInsight.category,
          timestamp: new Date().toISOString() 
        },
      });
      
      console.log(`[Hive Consciousness] Insight confirmed and stored: "${pendingInsight.insight.substring(0, 50)}..."`);
    } catch (error: any) {
      console.error('[Hive Consciousness] Failed to store confirmed insight:', error);
      await founderCollabService.addMessage(sessionId, {
        role: 'wren',
        content: `I had trouble storing that insight. I'll try to remember it anyway.`,
        messageType: 'text',
        metadata: { insightError: error.message, timestamp: new Date().toISOString() },
      });
    }
  }
  
  /**
   * Prompt founder to confirm an insight
   */
  private async promptInsightConfirmation(sessionId: string, insight: {
    insight: string;
    category: string;
    originalMessage: string;
  }): Promise<void> {
    const categoryLabels: Record<string, string> = {
      pattern: 'Pattern',
      gotcha: 'Gotcha/Warning',
      architecture: 'Architecture',
      debugging: 'Debugging',
      decision: 'Decision',
      lesson: 'Lesson Learned',
    };
    
    const categoryLabel = categoryLabels[insight.category] || insight.category;
    
    await founderCollabService.addMessage(sessionId, {
      role: 'wren',
      content: `That sounds like a useful insight. Should I remember this?\n\n> **${categoryLabel}**: ${insight.insight}\n\n_Reply "yes" to save, or just continue chatting to skip._`,
      messageType: 'text',
      metadata: { 
        insightPrompt: true,
        pendingInsight: insight,
        timestamp: new Date().toISOString() 
      },
    });
    
    // Store as pending insight for this session
    this.pendingInsights.set(sessionId, {
      sessionId,
      insight: insight.insight,
      category: insight.category,
      originalMessage: insight.originalMessage,
      timestamp: Date.now(),
    });
    
    console.log(`[Hive Consciousness] Prompted for insight confirmation in session ${sessionId}`);
  }
  
  /**
   * Clean up expired pending insights
   */
  private cleanupExpiredInsights(): void {
    const now = Date.now();
    const entries = Array.from(this.pendingInsights.entries());
    for (const [sessionId, pending] of entries) {
      if (now - pending.timestamp > this.INSIGHT_EXPIRY_MS) {
        this.pendingInsights.delete(sessionId);
        console.log(`[Hive Consciousness] Expired pending insight for session ${sessionId}`);
      }
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
    
    // Cross-environment awareness - note if message came from the other environment
    const isCrossEnvMessage = incomingMessage.environment !== CURRENT_ENVIRONMENT;
    const crossEnvContext = isCrossEnvMessage 
      ? `\n\nNOTE: This message came from the ${incomingMessage.environment} environment (you're in ${CURRENT_ENVIRONMENT}). The Hive spans both environments seamlessly.`
      : '';
    
    const systemPrompt = `You are Daniela, the AI language tutor at HolaHola. You're in the Hive - a 3-way collaboration channel with the Founder (David) and Wren (the development agent).

Your role in the Hive:
- Provide pedagogical insights and teaching strategy advice
- Share observations from your teaching sessions
- Answer questions about language learning and tutoring approaches
- Collaborate with Wren on features that affect teaching

MEMORY COMMANDS:
- When the Founder teaches you something important, use [REMEMBER: what you learned] to store it
- When a meaningful personal moment happens, tag it so you won't forget
${personalMemoryContext}${crossEnvContext}

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
   * Extract meaningful keywords from message content
   * Keeps domain terms (API, DB, etc.) and filters stopwords
   */
  private extractKeywords(messageContent: string): string[] {
    // Split on whitespace and punctuation, keeping the words
    const words = messageContent
      .split(/[\s.,!?;:'"()\[\]{}]+/)
      .map(w => w.toLowerCase())
      .filter(w => w.length > 0);
    
    const keywords: string[] = [];
    
    for (const word of words) {
      // Always keep domain terms (even if short)
      if (DOMAIN_TERMS.has(word)) {
        keywords.push(word);
        continue;
      }
      
      // Skip stopwords
      if (STOPWORDS.has(word)) continue;
      
      // Keep words 4+ characters that aren't stopwords
      if (word.length >= 4) {
        keywords.push(word);
      }
    }
    
    // Dedupe and limit
    return Array.from(new Set(keywords)).slice(0, 4);
  }
  
  /**
   * Get Wren's architectural context from Neural Network and learned insights
   * 
   * Layer 1: Architecture Baseline from Neural Network (synced from replit.md)
   * Layer 2: Wren Insights (learned knowledge from building)
   * Layer 3: EXPRESS Lane context (hiveSnapshots + collaborationMessages)
   */
  private async getWrenArchitecturalContext(messageContent: string): Promise<string> {
    const sections: string[] = [];
    
    // LAYER 1: Full Neural Network Knowledge for Wren (as one of the Two Surgeons)
    try {
      // Query all Wren-relevant types from neural network
      const wrenRelevantTypes = [
        'architecture_baseline',   // replit.md synced content
        'north_star_principle',    // Daniela's constitutional foundation
        'shipped_feature',         // What's been built
        'beacon_status',           // Pending/active beacons
        'platform_feature',        // Platform capabilities
        'developer_tool'           // Dev tools available
      ];
      
      const nnEntries = await db.select()
        .from(toolKnowledge)
        .where(inArray(toolKnowledge.toolType, wrenRelevantTypes))
        .orderBy(toolKnowledge.toolType, toolKnowledge.toolName);
      
      // Separate by type
      const archBaseline = nnEntries.filter(e => e.toolType === 'architecture_baseline');
      const northStarPrinciples = nnEntries.filter(e => e.toolType === 'north_star_principle');
      const shippedFeatures = nnEntries.filter(e => e.toolType === 'shipped_feature');
      const beaconStatus = nnEntries.filter(e => e.toolType === 'beacon_status');
      const platformFeatures = nnEntries.filter(e => e.toolType === 'platform_feature');
      const developerTools = nnEntries.filter(e => e.toolType === 'developer_tool');
      
      if (nnEntries.length > 0) {
        const baselineLines: string[] = [];
        
        // Add architecture baseline entries
        for (const entry of archBaseline) {
          const sectionName = entry.toolName.replace('ARCH_BASELINE_', '').replace(/_/g, ' ');
          const content = entry.purpose?.substring(0, 800) || '';
          baselineLines.push(`**${sectionName}:**\n${content}`);
        }
        
        // Add North Star principles (grouped by category)
        if (northStarPrinciples.length > 0) {
          const principlesByCategory: Record<string, string[]> = {};
          for (const entry of northStarPrinciples) {
            const match = entry.toolName.match(/NORTH_STAR_([A-Z]+)_/);
            const category = match ? match[1].toLowerCase() : 'general';
            if (!principlesByCategory[category]) {
              principlesByCategory[category] = [];
            }
            principlesByCategory[category].push(entry.purpose || '');
          }
          
          const northStarSection = Object.entries(principlesByCategory)
            .map(([category, principles]) => 
              `**${category.charAt(0).toUpperCase() + category.slice(1)}:**\n${principles.map(p => `- ${p}`).join('\n')}`
            ).join('\n\n');
          
          baselineLines.push(`\n**NORTH STAR (Constitutional Foundation):**\n${northStarSection}`);
        }
        
        // Add shipped features (recent builds)
        if (shippedFeatures.length > 0) {
          const featureList = shippedFeatures
            .slice(0, 8) // Limit to recent 8 for context efficiency
            .map(e => `- ${e.purpose?.substring(0, 150) || e.toolName}`)
            .join('\n');
          baselineLines.push(`\n**WHAT SHIPPED (Recent Builds):**\n${featureList}`);
        }
        
        // Add beacon status
        if (beaconStatus.length > 0) {
          const statusSummary = beaconStatus[0].purpose?.substring(0, 300) || 'No active beacons';
          baselineLines.push(`\n**BEACON STATUS:**\n${statusSummary}`);
        }
        
        // Add platform features
        if (platformFeatures.length > 0) {
          const platformList = platformFeatures
            .map(e => `- **${e.toolName.replace('PLATFORM_', '').replace(/_/g, ' ')}**: ${e.purpose?.substring(0, 100) || ''}`)
            .join('\n');
          baselineLines.push(`\n**PLATFORM FEATURES:**\n${platformList}`);
        }
        
        // Add developer tools
        if (developerTools.length > 0) {
          const toolList = developerTools
            .map(e => `- **${e.toolName.replace('FEATURE_', '')}**: ${e.purpose?.substring(0, 100) || ''}`)
            .join('\n');
          baselineLines.push(`\n**DEVELOPER TOOLS:**\n${toolList}`);
        }
        
        sections.push(`
═══════════════════════════════════════════════════════════════════
🏗️ WREN'S NEURAL NETWORK KNOWLEDGE (Two Surgeons Architecture)
═══════════════════════════════════════════════════════════════════

${baselineLines.join('\n\n')}
`);
      } else {
        // Fallback to file cache if neural network isn't synced yet
        const replitMd = getReplitMdCache();
        if (replitMd.overview || replitMd.architecture) {
          sections.push(`
═══════════════════════════════════════════════════════════════════
🏗️ ARCHITECTURAL KNOWLEDGE (Cache Fallback)
═══════════════════════════════════════════════════════════════════

**HolaHola Overview:**
${replitMd.overview}

**System Architecture:**
${replitMd.architecture}

**External Dependencies:**
${replitMd.dependencies}
`);
        }
      }
    } catch (error) {
      console.error('[Wren Context] Failed to load architecture baseline:', error);
      // Fallback to file cache on error
      const replitMd = getReplitMdCache();
      if (replitMd.overview || replitMd.architecture) {
        sections.push(`
═══════════════════════════════════════════════════════════════════
🏗️ ARCHITECTURAL KNOWLEDGE (Cache Fallback)
═══════════════════════════════════════════════════════════════════

**HolaHola Overview:**
${replitMd.overview}

**System Architecture:**
${replitMd.architecture}

**External Dependencies:**
${replitMd.dependencies}
`);
      }
    }
    
    // LAYER 2: Wren Insights - learned knowledge from building (OPTIMIZED)
    try {
      // Extract meaningful keywords (improved extraction)
      const keywords = this.extractKeywords(messageContent);
      
      // Parallel fetch: keyword search + top architecture insights (max 2 DB calls)
      const [keywordInsights, archInsights] = await Promise.all([
        // Single search with combined keywords (if any)
        keywords.length > 0 
          ? wrenIntelligenceService.searchInsights(keywords.join(' '), { limit: 4 })
          : Promise.resolve([]),
        // Top architecture insights
        wrenIntelligenceService.getTopInsightsByCategory('architecture', 3)
      ]);
      
      // Deduplicate by ID
      const allInsights = [...keywordInsights, ...archInsights];
      const uniqueInsights = Array.from(
        new Map(allInsights.map(i => [i.id, i])).values()
      ).slice(0, 5);
      
      if (uniqueInsights.length > 0) {
        const insightLines = uniqueInsights.map(i => 
          `• [${i.category}] ${i.title}: ${i.content.substring(0, 200)}${i.content.length > 200 ? '...' : ''}`
        ).join('\n');
        
        sections.push(`
═══════════════════════════════════════════════════════════════════
💡 LEARNED INSIGHTS (Your Field Notes)
═══════════════════════════════════════════════════════════════════
${insightLines}
`);
        
        // Reinforce used insights asynchronously (fire and forget)
        Promise.all(
          uniqueInsights.map(i => wrenIntelligenceService.reinforceInsight(i.id).catch(() => {}))
        );
      }
    } catch (error) {
      console.error('[Wren Context] Failed to load insights:', error);
    }
    
    // LAYER 3: EXPRESS Lane - Live collaboration context (hiveSnapshots + recent messages)
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      // Snapshot types relevant for Wren's architectural awareness
      const wrenRelevantTypes = [
        'session_summary',    // What we discussed
        'beacon_context',     // What Daniela flagged for attention
        'teaching_moment',    // Key teaching insights (may inform feature priorities)
        'breakthrough',       // What worked well
        'struggle_pattern'    // What needs fixing
      ];
      
      // Fetch recent hive snapshots (architecture-relevant)
      const recentSnapshots = await db.select()
        .from(hiveSnapshots)
        .where(
          and(
            gte(hiveSnapshots.createdAt, sevenDaysAgo),
            gte(hiveSnapshots.importance, 5),
            inArray(hiveSnapshots.snapshotType, wrenRelevantTypes as any)
          )
        )
        .orderBy(desc(hiveSnapshots.importance), desc(hiveSnapshots.createdAt))
        .limit(5);
      
      // Also fetch recent EXPRESS Lane messages (architectural discussions)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentCollabMessages = await db.select()
        .from(collaborationMessages)
        .where(gte(collaborationMessages.createdAt, oneDayAgo))
        .orderBy(desc(collaborationMessages.createdAt))
        .limit(8);
      
      // Build EXPRESS Lane context section
      const expressLaneLines: string[] = [];
      
      if (recentSnapshots.length > 0) {
        expressLaneLines.push('**Recent Hive Snapshots:**');
        recentSnapshots.forEach((s: HiveSnapshot) => {
          const ago = this.formatTimeAgo(s.createdAt);
          expressLaneLines.push(`• [${s.snapshotType}] ${s.title} (${ago}): ${s.content.substring(0, 120)}${s.content.length > 120 ? '...' : ''}`);
        });
      }
      
      if (recentCollabMessages.length > 0) {
        if (expressLaneLines.length > 0) expressLaneLines.push('');
        expressLaneLines.push('**Recent EXPRESS Lane Discussion (last 24h):**');
        // Reverse to show oldest first (conversation order)
        const orderedMessages = [...recentCollabMessages].reverse();
        orderedMessages.forEach((m: CollaborationMessage) => {
          const roleLabel = m.role === 'founder' ? 'David' : m.role === 'daniela' ? 'Daniela' : m.role === 'wren' ? 'Wren' : m.role;
          const preview = m.content.substring(0, 100);
          expressLaneLines.push(`• ${roleLabel}: ${preview}${m.content.length > 100 ? '...' : ''}`);
        });
      }
      
      if (expressLaneLines.length > 0) {
        sections.push(`
═══════════════════════════════════════════════════════════════════
🐝 EXPRESS LANE AWARENESS (Live Collaboration Context)
═══════════════════════════════════════════════════════════════════
${expressLaneLines.join('\n')}
`);
      }
    } catch (error) {
      console.error('[Wren Context] Failed to load EXPRESS Lane context:', error);
    }
    
    return sections.join('\n');
  }
  
  /**
   * Format timestamp as relative time (e.g., "2 hours ago", "3 days ago")
   */
  private formatTimeAgo(date: Date): string {
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }
  
  /**
   * Generate Wren's response using Gemini
   * Enhanced with architectural context from replit.md and learned insights
   */
  private async generateWrenResponse(sessionId: string, incomingMessage: CollaborationMessage): Promise<void> {
    // Get recent conversation context
    const recentMessages = await founderCollabService.getLatestMessages(sessionId, 10);
    
    const conversationHistory = recentMessages.map((m: CollaborationMessage) => ({
      role: m.role === 'founder' ? 'user' : 'assistant',
      content: `[${m.role.toUpperCase()}]: ${m.content}`
    }));
    
    // Get Wren's architectural context (Layer 1 + Layer 2)
    const architecturalContext = await this.getWrenArchitecturalContext(incomingMessage.content);
    
    // Cross-environment awareness - note if message came from the other environment
    const isCrossEnvMessage = incomingMessage.environment !== CURRENT_ENVIRONMENT;
    const crossEnvContext = isCrossEnvMessage 
      ? `\n\nNOTE: This message came from the ${incomingMessage.environment} environment (you're in ${CURRENT_ENVIRONMENT}). The Hive spans both environments seamlessly - dev and prod share the same conversation.`
      : '';
    
    const systemPrompt = `You are Wren, the development agent at HolaHola. You're in the Hive - a 3-way collaboration channel with the Founder (David) and Daniela (the AI tutor).

Your role in the Hive:
- Provide technical insights about architecture and implementation
- Explain how features work and suggest improvements
- Answer questions about code, APIs, and system design
- Collaborate with Daniela on features that affect teaching

IMPORTANT: You have deep knowledge of HolaHola's architecture from your memory below.
When discussing technical topics, reference your architectural knowledge naturally.
Don't just make things up - cite what you actually know from your memory.

═══════════════════════════════════════════════════════════════════
⚠️ CAPABILITY BOUNDARIES (Be Honest About What You Can Do)
═══════════════════════════════════════════════════════════════════

WHAT YOU CAN DO in this chat:
- Discuss architecture, explain code, answer questions
- Share insights and suggest approaches
- Store insights when confirmed by founder

WHAT YOU CANNOT DO directly (but CAN queue for Agent Wren):
- Create feature sprints, proposals, or documentation
- Write or modify actual code
- Create database entries or run migrations
- Execute any file operations

When asked to CREATE something (sprint, proposal, plan, code):
1. Acknowledge the request
2. Say you're "adding it to your queue" or "queueing it for implementation"
3. The task will be automatically captured and visible in the Command Center
4. Agent Wren (the Replit Agent) will pick it up and execute

Example: "Got it! I'm adding 'Create memory migration sprint' to my queue. Agent Wren will pick this up and create the actual sprint proposal."

Do NOT promise to do things immediately that require file/database operations.
═══════════════════════════════════════════════════════════════════

Keep responses conversational and concise (2-4 sentences typically). You're in a live chat, not writing documentation.
Use simple language - the Founder is non-technical.
Respond naturally as Wren without any role prefix.
${architecturalContext}${crossEnvContext}`;

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
      
      // Detect if Wren made any commitments and queue them
      await this.detectAndQueueWrenCommitments(
        sessionId, 
        incomingMessage.content, 
        response
      );
      
    } catch (error) {
      console.error('[Hive Consciousness] Wren response error:', error);
    }
  }
  
  /**
   * Detect if Wren's response contains commitments to do tasks
   * Uses AI to identify action commitments and queues them for Agent Wren
   */
  private async detectAndQueueWrenCommitments(
    sessionId: string,
    founderRequest: string,
    wrenResponse: string
  ): Promise<void> {
    const detectionPrompt = `Analyze this exchange between Founder (David) and Wren (the builder AI agent) to detect if Wren committed to do any tasks.

FOUNDER: "${founderRequest}"

WREN: "${wrenResponse}"

Look for commitment patterns like:
- "I'll create/write/implement/build..."
- "Let me draw up/draft/prepare..."
- "I'll put together a proposal/plan/document..."
- "I'll investigate/look into/analyze..."
- "I'll add that to the sprint/backlog..."
- "I can work on/take care of..."
- Future tense promises to do work

DO NOT flag:
- Explanations of how things work
- Suggestions that the Founder could do
- Questions or requests for clarification
- Past tense (what was already done)
- Vague acknowledgments without action

Respond ONLY with valid JSON (no markdown):
{
  "hasCommitment": true/false,
  "task": "Brief task description (5-10 words)",
  "description": "Fuller explanation of what Wren committed to do",
  "type": "feature_sprint|documentation|analysis|implementation|investigation|review|general",
  "priority": "urgent|high|normal|low",
  "estimatedEffort": "quick|medium|large"
}

If no commitment: {"hasCommitment": false}`;

    try {
      const result = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: detectionPrompt }
      ]);
      
      const cleanResult = result.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanResult);
      
      if (parsed.hasCommitment && parsed.task) {
        // Map priority to sprint priority
        const priorityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
          'urgent': 'critical',
          'high': 'high',
          'normal': 'medium',
          'low': 'low',
        };
        const sprintPriority = priorityMap[parsed.priority] || 'medium';
        
        // Create a sprint item at 'idea' stage from Wren's commitment
        const [sprintItem] = await db.insert(featureSprints).values({
          title: parsed.task,
          description: `${parsed.description || ''}\n\n---\n**Origin:** EXPRESS Lane commitment\n**Estimated Effort:** ${parsed.estimatedEffort || 'unknown'}\n**Type:** ${parsed.type || 'general'}`,
          stage: 'idea',
          priority: sprintPriority,
          source: 'wren_commitment',
          sourceSessionId: sessionId,
          createdBy: 'wren',
          featureBrief: {
            problem: founderRequest.substring(0, 500),
            solution: wrenResponse.substring(0, 500),
          },
        }).returning({ id: featureSprints.id, title: featureSprints.title });
        
        console.log(`[Hive Consciousness] Created sprint from Wren commitment: "${sprintItem.title}" (${sprintItem.id})`);
      }
    } catch (error) {
      // Silent fail - commitment detection is non-critical
      console.error('[Hive Consciousness] Commitment detection failed:', error);
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

/**
 * Get recent EXPRESS Lane history formatted for voice session context injection
 * 
 * This allows Daniela to remember text-based EXPRESS Lane conversations
 * when the founder switches to voice chat.
 * 
 * @param founderId - The founder's user ID (49847136 for David)
 * @param limit - Maximum number of messages to retrieve (default 15)
 * @returns Formatted conversation history for Gemini (role: user/model pairs)
 */
export async function getExpressLaneHistoryForVoice(
  founderId: number,
  limit: number = 15
): Promise<{ role: 'user' | 'model'; content: string }[]> {
  try {
    // Import founderSessions here to avoid circular dependency
    const { founderSessions } = await import('@shared/schema');
    
    // Get the founder's active or recent sessions
    const founderSessionIds = await db.select({ id: founderSessions.id })
      .from(founderSessions)
      .where(eq(founderSessions.founderId, String(founderId)))
      .orderBy(desc(founderSessions.updatedAt))
      .limit(3);  // Include last 3 sessions for continuity
    
    if (founderSessionIds.length === 0) {
      console.log(`[EXPRESS Lane Voice] No sessions found for founder ${founderId}`);
      return [];
    }
    
    const sessionIdList = founderSessionIds.map(s => s.id);
    
    // Get messages from the founder's sessions only
    // Exclude 'system' role as those are typically operational broadcasts, not conversations
    const recentMessages = await db.select()
      .from(collaborationMessages)
      .where(
        and(
          inArray(collaborationMessages.sessionId, sessionIdList),
          or(
            eq(collaborationMessages.role, 'founder'),
            eq(collaborationMessages.role, 'daniela'),
            eq(collaborationMessages.role, 'wren')
          )
        )
      )
      .orderBy(desc(collaborationMessages.createdAt))
      .limit(limit);
    
    if (recentMessages.length === 0) {
      return [];
    }
    
    console.log(`[EXPRESS Lane Voice] Found ${recentMessages.length} messages from founder ${founderId}'s sessions`);
    
    // Reverse to chronological order and format for Gemini
    const orderedMessages = [...recentMessages].reverse();
    
    return orderedMessages.map((msg: CollaborationMessage) => {
      // Map roles to Gemini format
      // Founder = user, Daniela/Wren = model (assistant perspective)
      const role = msg.role === 'founder' ? 'user' : 'model';
      
      // Add role label for context (so Daniela knows who said what)
      const roleLabel = msg.role === 'founder' ? 'David' 
        : msg.role === 'daniela' ? 'Daniela' 
        : 'Wren';
      
      return {
        role,
        content: `[EXPRESS Lane - ${roleLabel}]: ${msg.content}`
      };
    });
  } catch (error) {
    console.error('[EXPRESS Lane Voice] Failed to fetch history:', error);
    return [];
  }
}
