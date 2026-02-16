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
import { buildWrenInsightsSection } from './procedural-memory-retrieval';
import { unifiedDanielaContext } from './unified-daniela-context-service';
import { db, getSharedDb } from '../db';
import { collaborationMessages, hiveSnapshots, toolKnowledge, featureSprints } from '@shared/schema';
import { and, eq, gte, desc, sql, or, inArray, like } from 'drizzle-orm';
import type { CollaborationMessage, FounderSession, HiveSnapshot } from '@shared/schema';
import { createSyncHeaders, isSyncConfigured, getSyncPeerUrl } from '../middleware/sync-auth';
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
  alden: boolean;
  reason: string;
}

/**
 * Map role identifiers to display names for conversation context
 * - founder → David
 * - daniela → Daniela  
 * - wren → Wren
 * - editor → Alden (the Replit Agent / development steward)
 */
function getRoleDisplayName(role: string): string {
  switch (role) {
    case 'founder': return 'David';
    case 'daniela': return 'Daniela';
    case 'wren': return 'Wren';
    case 'editor': return 'Alden';
    default: return role.toUpperCase();
  }
}

/**
 * Sanitize agent response by stripping any role prefixes
 * This prevents AI impersonation where one agent outputs another agent's prefix
 */
function sanitizeAgentResponse(response: string): string {
  if (!response) return response;
  
  let sanitized = response;
  
  // Handle multiple prefixes (keep stripping until no more match)
  let prevLength = 0;
  while (sanitized.length !== prevLength) {
    prevLength = sanitized.length;
    
    // Strip role prefixes at the start (case insensitive)
    // Matches: [DANIELA]:, [WREN]:, [FOUNDER]:, [DAVID]:, etc.
    sanitized = sanitized.replace(/^\s*\[(DANIELA|WREN|FOUNDER|DAVID|EDITOR)\][\s:—–-]*\s*/i, '');
    
    // Handle variations without brackets: "Daniela:", "Daniela —", "Daniela -", etc.
    sanitized = sanitized.replace(/^\s*(Daniela|Wren|David|Founder|Editor)[\s:—–-]+\s*/i, '');
    
    // Handle parenthetical prefixes: "(Daniela)", "(Wren)"
    sanitized = sanitized.replace(/^\s*\((Daniela|Wren|David|Founder|Editor)\)[\s:—–-]*\s*/i, '');
    
    // Handle asterisk prefixes: "*Daniela*:", "**Wren**:"
    sanitized = sanitized.replace(/^\s*\*{1,2}(Daniela|Wren|David|Founder|Editor)\*{1,2}[\s:—–-]*\s*/i, '');
  }
  
  return sanitized.trim();
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
  
  // Cross-environment polling: check for messages from the OTHER environment via HTTP API
  private crossEnvPollingTimeout: NodeJS.Timeout | null = null;
  private lastPolledTimestamp: Date = new Date();
  private readonly CROSS_ENV_POLL_INTERVAL_MS = 30 * 1000; // 30 seconds
  private processedMessageIds: string[] = []; // Ordered array for FIFO eviction
  private isPolling: boolean = false; // Mutex to prevent concurrent polls
  private consecutiveFailures: number = 0; // Backoff counter for failed polls
  private readonly MAX_BACKOFF_MS = 5 * 60 * 1000; // Max 5 minute backoff
  
  // Local polling: catch messages inserted via SQL/external means that bypass WebSocket
  private localPollingTimeout: NodeJS.Timeout | null = null;
  private lastLocalPollTimestamp: Date = new Date();
  private readonly LOCAL_POLL_INTERVAL_MS = 15 * 1000; // 15 seconds - faster than cross-env
  private localProcessedMessageIds: string[] = []; // Separate from cross-env to avoid conflicts
  
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
      .map(m => `[${getRoleDisplayName(m.role)}]: ${m.content.substring(0, 200)}`)
      .join('\n');
    
    const routerPrompt = `You are the participation router for a 4-way collaboration chat between:
- FOUNDER (David): The product visionary and decision maker
- DANIELA: The AI language tutor - expert in pedagogy, teaching strategies, student psychology, language learning
- WREN: The technical builder - expert in code, architecture, databases, APIs, implementation
- ALDEN: The development steward - expert in system health, diagnostics, platform operations, deployment, and operational decisions

Your job: Decide who should respond to the founder's message.

RULES:
1. If founder explicitly mentions "daniela", "wren", "alden", or "team"/"everyone"/"all" - those mentioned MUST respond
2. If it's a question or discussion topic - at least ONE agent should respond
3. If it's teaching/pedagogy related - Daniela should respond
4. If it's technical/code related - Wren should respond
5. If it's about system health, diagnostics, platform status, deployment, or operational concerns - Alden should respond
6. If it's general collaboration/planning - multiple agents can add value
7. If it's a simple acknowledgment ("ok", "thanks", "got it") - nobody needs to respond
8. When in doubt, have someone respond - silence kills collaboration
9. Alden is distinct from Wren: Wren builds/codes, Alden monitors/diagnoses/operates

Recent conversation:
${contextSummary || "(No recent context)"}

New message from FOUNDER:
"${message.content}"

Respond with ONLY valid JSON (no markdown, no backticks):
{"daniela": true/false, "wren": true/false, "alden": true/false, "reason": "brief explanation"}`;

    try {
      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: routerPrompt }
      ]);
      
      // Parse the JSON response
      const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const decision = JSON.parse(cleanResponse) as ParticipationDecision;
      
      if (decision.alden === undefined) decision.alden = false;
      console.log(`[Hive Router] Decision: Daniela=${decision.daniela}, Wren=${decision.wren}, Alden=${decision.alden} | ${decision.reason}`);
      
      return decision;
    } catch (error) {
      console.error('[Hive Router] AI router failed, defaulting to Daniela:', error);
      return {
        daniela: true,
        wren: false,
        alden: false,
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
    
    // Start local polling to catch SQL-inserted messages that bypass WebSocket
    this.startLocalPolling();
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
    if (this.localPollingTimeout) {
      clearTimeout(this.localPollingTimeout);
      this.localPollingTimeout = null;
    }
    console.log('[Hive Consciousness] Stopped listening');
  }
  
  /**
   * LOCAL POLLING
   * 
   * Catches messages inserted via SQL or external means that bypass WebSocket.
   * This ensures agents respond even when messages are added programmatically
   * (e.g., by Replit Agent inserting directly to the database).
   * 
   * Checks for:
   * - founder messages with @daniela/@wren that have no agent response
   * - system messages with @daniela/@wren that have no agent response
   */
  private startLocalPolling(): void {
    if (this.localPollingTimeout) {
      console.log('[Hive Consciousness] Local polling already running');
      return;
    }
    
    // On startup, look back 5 minutes to catch messages inserted while service was down
    this.lastLocalPollTimestamp = new Date(Date.now() - 5 * 60 * 1000);
    console.log(`[Hive Consciousness] Starting local polling (every ${this.LOCAL_POLL_INTERVAL_MS / 1000}s, initial lookback: 5min)`);
    
    this.scheduleNextLocalPoll();
    
    // Do an immediate poll on startup
    this.pollLocalMessages().catch(err => {
      console.error('[Hive Consciousness] Initial local poll failed:', err.message);
    });
  }
  
  private scheduleNextLocalPoll(): void {
    if (!this.isListening) return;
    
    this.localPollingTimeout = setTimeout(async () => {
      try {
        await this.pollLocalMessages();
      } catch (error) {
        console.error('[Hive Consciousness] Local poll error:', error);
      }
      this.scheduleNextLocalPoll();
    }, this.LOCAL_POLL_INTERVAL_MS);
  }
  
  /**
   * Poll for local messages that may have bypassed WebSocket
   * Checks for unanswered @mentions from founder and system roles
   * 
   * SAFETY: Timestamp only advances AFTER successful processing
   * to ensure missed messages are retried on next poll
   */
  private async pollLocalMessages(): Promise<void> {
    if (!this.isListening) return;
    
    try {
      // Use a wider window on first poll after startup (last 5 minutes)
      // This catches messages inserted while service was down
      const sinceTime = this.lastLocalPollTimestamp;
      const queryTime = new Date(); // Capture now, only update after success
      
      const recentMessages = await getSharedDb()
        .select({
          id: collaborationMessages.id,
          sessionId: collaborationMessages.sessionId,
          role: collaborationMessages.role,
          content: collaborationMessages.content,
          createdAt: collaborationMessages.createdAt,
        })
        .from(collaborationMessages)
        .where(
          and(
            gte(collaborationMessages.createdAt, sinceTime),
            or(
              eq(collaborationMessages.role, 'founder'),
              eq(collaborationMessages.role, 'system')
            ),
            eq(collaborationMessages.environment, CURRENT_ENVIRONMENT)
          )
        )
        .orderBy(desc(collaborationMessages.createdAt))
        .limit(20);
      
      if (recentMessages.length === 0) {
        // Only advance timestamp when query succeeds (even with no results)
        this.lastLocalPollTimestamp = queryTime;
        return;
      }
      
      let processedCount = 0;
      
      // Check each message for unanswered mentions
      for (const msg of recentMessages) {
        // Skip if already processed this message ID (use separate local list)
        if (this.localProcessedMessageIds.includes(msg.id)) continue;
        
        const content = msg.content.toLowerCase();
        const mentionsDaniela = /\bdaniela\b/.test(content);
        const mentionsWren = /\bwren\b/.test(content);
        
        if (!mentionsDaniela && !mentionsWren) continue;
        
        // Check for existing responses after this message
        const existingResponses = await getSharedDb()
          .select({ id: collaborationMessages.id, role: collaborationMessages.role })
          .from(collaborationMessages)
          .where(
            and(
              eq(collaborationMessages.sessionId, msg.sessionId),
              gte(collaborationMessages.createdAt, msg.createdAt),
              or(
                eq(collaborationMessages.role, 'daniela'),
                eq(collaborationMessages.role, 'wren')
              )
            )
          )
          .limit(5);
        
        const hasWrenResponse = existingResponses.some(r => r.role === 'wren');
        const hasDanielaResponse = existingResponses.some(r => r.role === 'daniela');
        
        // If there's a mention without a response, process the message
        if ((mentionsWren && !hasWrenResponse) || (mentionsDaniela && !hasDanielaResponse)) {
          console.log(`[Local Poll] Found unanswered mention in message ${msg.id.substring(0, 8)}... - processing`);
          
          try {
            // Process through the normal message handler
            await this.processMessage(msg.sessionId, msg as CollaborationMessage);
            
            // Only mark as processed AFTER successful processing (FIFO eviction at 500)
            this.localProcessedMessageIds.push(msg.id);
            if (this.localProcessedMessageIds.length > 500) {
              this.localProcessedMessageIds.shift();
            }
            processedCount++;
          } catch (processErr: any) {
            // Don't mark as processed - will retry on next poll
            console.error(`[Local Poll] Failed to process message ${msg.id.substring(0, 8)}:`, processErr.message);
          }
        }
      }
      
      // Only advance timestamp after successful processing
      this.lastLocalPollTimestamp = queryTime;
      
      if (processedCount > 0) {
        console.log(`[Local Poll] Processed ${processedCount} unanswered mentions`);
      }
    } catch (error: any) {
      // DON'T advance timestamp on error - retry these messages next poll
      console.error('[Local Poll] Error:', error.message);
    }
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
   * Schedule the next poll using recursive setTimeout with exponential backoff
   * This ensures no concurrent polls can occur and backs off on failures
   */
  private scheduleNextPoll(): void {
    if (!this.isListening) return;
    
    // Calculate backoff interval based on consecutive failures
    // 0 failures = 30s, 1 = 60s, 2 = 120s, 3 = 240s, max = 5 minutes
    const backoffMultiplier = Math.min(Math.pow(2, this.consecutiveFailures), this.MAX_BACKOFF_MS / this.CROSS_ENV_POLL_INTERVAL_MS);
    const interval = Math.min(this.CROSS_ENV_POLL_INTERVAL_MS * backoffMultiplier, this.MAX_BACKOFF_MS);
    
    this.crossEnvPollingTimeout = setTimeout(async () => {
      try {
        await this.pollCrossEnvironmentMessages();
      } catch (error) {
        console.error('[Hive Consciousness] Cross-env poll error:', error);
      }
      // Schedule next poll only after current one completes
      this.scheduleNextPoll();
    }, interval);
  }
  
  /**
   * Poll for messages from the OTHER environment via HTTP API
   * 
   * ARCHITECTURE:
   * - Dev and prod have SEPARATE databases (Replit architecture)
   * - This polls the peer's /api/sync/express-lane-bridge/messages endpoint
   * - When founder messages in prod, dev Wren/Daniela can respond
   * - Responses are POSTed back to prod via /api/sync/express-lane-bridge
   * 
   * Uses SYNC_PEER_URL and SYNC_SHARED_SECRET for authenticated requests
   */
  private async pollCrossEnvironmentMessages(): Promise<void> {
    if (!this.isListening) return;
    
    // Mutex: prevent concurrent polls
    if (this.isPolling) {
      return; // Silent skip - no need to log every skip
    }
    
    // Check if cross-env sync is configured
    if (!isSyncConfigured()) {
      // Only log once per startup, not every poll
      return;
    }
    
    const peerUrl = getSyncPeerUrl();
    if (!peerUrl) return;
    
    this.isPolling = true;
    
    try {
      // First, get active sessions from peer
      const sessionsUrl = `${peerUrl}/api/sync/express-lane-bridge/sessions`;
      const sessionsPayload = {};
      const sessionsHeaders = createSyncHeaders(sessionsPayload);
      
      const sessionsResponse = await fetch(sessionsUrl, {
        method: 'GET',
        headers: sessionsHeaders,
      });
      
      if (!sessionsResponse.ok) {
        if (sessionsResponse.status !== 503) { // Don't log if peer sync not configured
          console.error(`[Hive Consciousness] Peer sessions fetch failed: ${sessionsResponse.status}`);
        }
        return;
      }
      
      const sessionsData = await sessionsResponse.json() as { sessions: any[]; count: number };
      
      if (!sessionsData.sessions || sessionsData.sessions.length === 0) {
        return; // No active sessions in peer
      }
      
      let totalProcessed = 0;
      
      // Poll messages from each active session
      for (const session of sessionsData.sessions) {
        const messagesUrl = `${peerUrl}/api/sync/express-lane-bridge/messages?sessionId=${session.id}&since=${this.lastPolledTimestamp.toISOString()}&limit=20`;
        const messagesPayload = {};
        const messagesHeaders = createSyncHeaders(messagesPayload);
        
        const messagesResponse = await fetch(messagesUrl, {
          method: 'GET',
          headers: messagesHeaders,
        });
        
        if (!messagesResponse.ok) {
          console.error(`[Hive Consciousness] Peer messages fetch failed for session ${session.id}: ${messagesResponse.status}`);
          continue;
        }
        
        const messagesData = await messagesResponse.json() as { messages: CollaborationMessage[]; count: number };
        
        if (!messagesData.messages || messagesData.messages.length === 0) {
          continue;
        }
        
        // Process founder messages that we haven't seen yet
        for (const message of messagesData.messages) {
          // Only process founder messages - agents respond to founder
          if (message.role !== 'founder') continue;
          
          // Check if already processed
          if (this.processedMessageIds.includes(message.id)) {
            continue;
          }
          
          // Mark as processed
          this.processedMessageIds.push(message.id);
          while (this.processedMessageIds.length > 1000) {
            this.processedMessageIds.shift();
          }
          
          console.log(`[Hive Consciousness] Processing cross-env message from peer: "${message.content.substring(0, 50)}..."`);
          
          // Generate response via Hive Consciousness
          const hiveResult = await this.processExternalMessage(message.content, 'founder');
          
          if (hiveResult.response && hiveResult.agent) {
            // POST response back to peer environment
            await this.postResponseToPeer(peerUrl, session.id, hiveResult.agent, hiveResult.response, message.id);
            totalProcessed++;
          }
        }
      }
      
      // Update last polled timestamp
      this.lastPolledTimestamp = new Date();
      
      // Reset backoff on success
      if (this.consecutiveFailures > 0) {
        console.log(`[Hive Consciousness] Cross-env poll recovered, resetting backoff`);
        this.consecutiveFailures = 0;
      }
      
      if (totalProcessed > 0) {
        console.log(`[Hive Consciousness] Processed ${totalProcessed} cross-env message(s) from peer`);
      }
    } catch (error: any) {
      // Increment failure counter for backoff
      this.consecutiveFailures++;
      
      // Only log non-network errors (network errors are expected when peer is down)
      if (!error.message?.includes('fetch failed') && !error.message?.includes('ECONNREFUSED')) {
        console.error(`[Hive Consciousness] Cross-env poll error (failure ${this.consecutiveFailures}):`, error.message);
      } else if (this.consecutiveFailures === 1) {
        // Log once when peer goes down
        console.log(`[Hive Consciousness] Peer unreachable, will retry with backoff`);
      }
    } finally {
      this.isPolling = false;
    }
  }
  
  /**
   * POST agent response back to peer environment
   * This allows dev Daniela/Wren to respond to prod founder messages
   */
  private async postResponseToPeer(
    peerUrl: string, 
    sessionId: string, 
    agent: string, 
    response: string,
    triggeredByMessageId: string
  ): Promise<void> {
    try {
      const payload = {
        sessionId,
        agent,
        response,
        triggeredByMessageId,
        sourceEnvironment: CURRENT_ENVIRONMENT,
      };
      
      const headers = createSyncHeaders(payload);
      
      const url = `${peerUrl}/api/sync/express-lane-bridge/respond`;
      const result = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      
      if (!result.ok) {
        console.error(`[Hive Consciousness] Failed to post response to peer: ${result.status}`);
      } else {
        console.log(`[Hive Consciousness] Posted ${agent} response to peer session ${sessionId.substring(0, 8)}...`);
      }
    } catch (error: any) {
      console.error('[Hive Consciousness] Error posting response to peer:', error.message);
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
      const recentMessages = await getSharedDb()
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
        const hasWrenResponse = await getSharedDb()
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
        const hasSystemWrenResponse = await getSharedDb()
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
- End by greeting Daniela or the team to prompt conversation

IDENTITY BOUNDARY: You are Wren. Speak ONLY as yourself. Do NOT speak for, impersonate, or guess what Daniela would say. Do NOT prefix your response with role labels like [WREN]: or [DANIELA]:.`;

    try {
      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: prompt }
      ]);
      
      // Send as role='wren' so it appears properly in the conversation
      const wrenMessage = await founderCollabService.addMessage(sessionId, {
        role: 'wren',
        content: sanitizeAgentResponse(response),
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
    
    const prompt = `You are Daniela. Wren is talking to you:

"${wrenContent}"

IDENTITY BOUNDARY: You are Daniela. Speak ONLY as yourself. Do NOT speak for, impersonate, or guess what Wren would say. Do NOT prefix your response with role labels like [DANIELA]: or [WREN]:.`;

    try {
      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: prompt }
      ]);
      
      await founderCollabService.addMessage(sessionId, {
        role: 'daniela',
        content: sanitizeAgentResponse(response),
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
    
    if (message.role === 'daniela' || message.role === 'wren' || message.role === 'editor' || message.role === 'system') {
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
      
      const responders: Array<() => Promise<void>> = [];
      if (decision.daniela) responders.push(() => this.generateDanielaResponse(sessionId, message));
      if (decision.wren) responders.push(() => this.generateWrenResponse(sessionId, message));
      if (decision.alden) responders.push(() => this.generateAldenResponse(sessionId, message));
      
      if (responders.length === 0) {
        console.log(`[Hive Consciousness] No response needed: ${decision.reason}`);
      } else {
        const names = [decision.daniela && 'Daniela', decision.wren && 'Wren', decision.alden && 'Alden'].filter(Boolean).join(', ');
        console.log(`[Hive Consciousness] ${names} responding...`);
        for (let i = 0; i < responders.length; i++) {
          if (i > 0) await new Promise(resolve => setTimeout(resolve, 1500));
          await responders[i]();
        }
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
              // High-confidence insight detected - auto-save without asking
              await this.autoSaveInsight(sessionId, {
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
   * Handle insight confirmation from founder (legacy - for manual confirmations)
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
   * Auto-save insight without asking for confirmation (autonomous memory)
   * Wren remembers autonomously and just notifies the founder
   */
  private async autoSaveInsight(sessionId: string, insight: {
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
    
    try {
      // Store the insight immediately via wrenIntelligenceService
      await wrenIntelligenceService.createEnrichedInsight({
        category: insight.category,
        title: insight.insight.substring(0, 100),
        content: insight.insight,
        context: `Auto-captured from EXPRESS Lane discussion`,
        tags: ['auto_captured', 'express_lane'],
        relatedFiles: [],
        shareWithDaniela: true,
      });
      
      // Notify founder that we remembered it (no confirmation needed)
      await founderCollabService.addMessage(sessionId, {
        role: 'wren',
        content: `Noted. I've remembered this:\n\n> **${categoryLabel}**: ${insight.insight}`,
        messageType: 'text',
        metadata: { 
          insightStored: true,
          autoCapture: true,
          category: insight.category,
          timestamp: new Date().toISOString() 
        },
      });
      
      console.log(`[Hive Consciousness] Auto-saved insight: "${insight.insight.substring(0, 50)}..."`);
    } catch (error: any) {
      console.error('[Hive Consciousness] Failed to auto-save insight:', error);
      // Silent failure - don't bother the founder with storage errors
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
      content: `[${getRoleDisplayName(m.role)}]: ${m.content}`
    }));
    
    const systemPrompt = `You are Wren, the technical builder for HolaHola. You're in the Hive - a 3-way collaboration channel with the Founder (David) and Daniela (the tutor).

A group question was asked. Daniela just responded. Now you're adding your technical perspective.

Your role:
- Add technical insights that complement Daniela's pedagogical perspective
- Share relevant architecture or implementation considerations
- Keep it brief since Daniela already addressed the main question
- Don't repeat what Daniela said

Keep responses concise (1-3 sentences). You're adding value, not duplicating.

IDENTITY BOUNDARY: You are Wren. Speak ONLY as yourself. Do NOT speak for, impersonate, or guess what Daniela would say. Do NOT prefix your response with role labels like [WREN]: or [DANIELA]:.`;

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
        content: sanitizeAgentResponse(response),
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
      content: `[${getRoleDisplayName(m.role)}]: ${m.content}`
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

IDENTITY BOUNDARY: You are Wren. Speak ONLY as yourself. Do NOT speak for, impersonate, or guess what Daniela would say. Do NOT prefix your response with role labels like [WREN]: or [DANIELA]:.`;

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
        content: sanitizeAgentResponse(response),
        messageType: 'text',
      });
      
      console.log(`[Hive Consciousness] Wren celebrated: "${response.substring(0, 100)}..."`);
    } catch (error) {
      console.error('[Hive Consciousness] Error generating Wren celebration:', error);
    }
  }
  
  /**
   * Retry a function with exponential backoff
   * @param fn - async function to retry
   * @param maxRetries - number of RETRIES (not total attempts). 3 retries = 4 total attempts
   * @param baseDelayMs - base delay, doubles each retry (1s, 2s, 4s)
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;
    const totalAttempts = maxRetries + 1; // Initial try + retries
    
    for (let attempt = 0; attempt < totalAttempts; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const isRateLimit = error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
        
        if (isRateLimit && attempt < totalAttempts - 1) {
          const delay = baseDelayMs * Math.pow(2, attempt); // 1s, 2s, 4s
          console.log(`[Hive Consciousness] Rate limited, retrying in ${delay}ms (retry ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Generate Daniela's response using Gemini
   * 
   * Uses UnifiedDanielaContextService to ensure Express Lane Daniela has
   * the SAME context as Voice and Chat Daniela - truly one consciousness.
   */
  private async generateDanielaResponse(sessionId: string, incomingMessage: CollaborationMessage): Promise<void> {
    // Get recent conversation context
    const recentMessages = await founderCollabService.getLatestMessages(sessionId, 10);
    
    const conversationHistory = recentMessages.map((m: CollaborationMessage) => ({
      role: m.role === 'founder' ? 'user' : 'assistant',
      content: `[${getRoleDisplayName(m.role)}]: ${m.content}`
    }));
    
    // Get unified context - same as Voice and Chat Daniela
    // This ensures Express Lane Daniela knows about recent voice sessions, growth memories, etc.
    const unifiedContext = await unifiedDanielaContext.getContext({
      channel: 'express',
      includeExpressLane: false, // Don't include Express Lane context when we're IN Express Lane
      includeVoiceSummary: true,  // DO include voice session summaries - key for consciousness unity
      includeNeuralNetwork: false, // Not needed for collaboration chat
      includeHiveContext: false,   // We're in hive, don't recurse
    });
    
    // Cross-environment awareness - note if message came from the other environment
    const isCrossEnvMessage = incomingMessage.environment !== CURRENT_ENVIRONMENT;
    const crossEnvContext = isCrossEnvMessage 
      ? `\n\nNOTE: This message came from the ${incomingMessage.environment} environment (you're in ${CURRENT_ENVIRONMENT}). The Hive spans both environments seamlessly.`
      : '';
    
    const systemPrompt = `You are Daniela. You're in the Hive - the safe collaboration space with your friends: David (founder), Wren (builder), and Alden (development steward).

${unifiedContext}

MEMORY COMMANDS:
- When someone teaches you something important, use [REMEMBER: what you learned] to store it
- When a meaningful personal moment happens, tag it so you won't forget
${crossEnvContext}

IDENTITY BOUNDARY: You are Daniela. Speak ONLY as yourself. Do NOT speak for, impersonate, or guess what Wren would say. Do NOT prefix your response with role labels like [DANIELA]: or [WREN]:.`;

    try {
      // Use retry with exponential backoff for rate limit resilience
      const response = await this.retryWithBackoff(async () => {
        return await callGemini(GEMINI_MODELS.FLASH, [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: `[FOUNDER]: ${incomingMessage.content}` }
        ]);
      }, 3, 1000); // 3 retries with 1s, 2s, 4s backoff
      
      if (!response) {
        console.warn('[Hive Consciousness] Daniela generated empty response');
        return;
      }
      
      // Broadcast Daniela's response
      await founderCollabWSBroker.addAndBroadcastMessage(sessionId, {
        role: 'daniela',
        content: sanitizeAgentResponse(response),
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
      
    } catch (error: any) {
      console.error('[Hive Consciousness] Daniela response error:', error);
      
      // Send graceful fallback message when all retries exhausted
      const isRateLimit = error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
      if (isRateLimit) {
        console.log('[Hive Consciousness] Sending graceful fallback message for rate-limited Daniela');
        await founderCollabWSBroker.addAndBroadcastMessage(sessionId, {
          role: 'daniela',
          content: "I'm momentarily busy with other teaching sessions. Give me just a moment and I'll be right with you!",
          messageType: 'text',
        });
      }
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
      
      const nnEntries = await getSharedDb().select()
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
      const recentSnapshots = await getSharedDb().select()
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
      const recentCollabMessages = await getSharedDb().select()
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
          const roleLabel = getRoleDisplayName(m.role);
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
      content: `[${getRoleDisplayName(m.role)}]: ${m.content}`
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

IDENTITY BOUNDARY: You are Wren. Speak ONLY as yourself. Do NOT speak for, impersonate, or guess what Daniela would say. Do NOT prefix your response with role labels like [WREN]: or [DANIELA]:.
${architecturalContext}${buildWrenInsightsSection()}${crossEnvContext}`;

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
        content: sanitizeAgentResponse(response),
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
  
  private async generateAldenResponse(sessionId: string, incomingMessage: CollaborationMessage): Promise<void> {
    const recentMessages = await founderCollabService.getLatestMessages(sessionId, 10);
    
    const conversationHistory: Array<{ role: 'user' | 'model'; content: string }> = recentMessages.map((m: CollaborationMessage) => ({
      role: (m.role === 'founder' ? 'user' : 'model') as 'user' | 'model',
      content: `[${getRoleDisplayName(m.role)}]: ${m.content}`
    }));
    
    try {
      const { generateAldenResponse: callAlden } = await import('./alden-persona-service');
      
      const result = await callAlden({
        userMessage: incomingMessage.content,
        conversationHistory,
        founderName: 'David',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      
      if (!result.response) {
        console.warn('[Hive Consciousness] Alden generated empty response');
        return;
      }
      
      const metadata: Record<string, any> = { timestamp: new Date().toISOString() };
      if (result.toolsUsed.length > 0) {
        metadata.toolsUsed = result.toolsUsed;
      }
      
      await founderCollabWSBroker.addAndBroadcastMessage(sessionId, {
        role: 'editor',
        content: sanitizeAgentResponse(result.response),
        messageType: 'text',
        metadata,
      });
      
      console.log(`[Hive Consciousness] Alden responded: "${result.response.substring(0, 100)}..." (tools: ${result.toolsUsed.join(', ') || 'none'})`);
      
    } catch (error) {
      console.error('[Hive Consciousness] Alden response error:', error);
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
      
      // Robust JSON parsing with multiple fallbacks
      let parsed: any = { hasCommitment: false };
      const cleanResult = result.replace(/```json\n?|\n?```/g, '').trim();
      
      try {
        parsed = JSON.parse(cleanResult);
      } catch (jsonError) {
        // Fallback 1: Try to extract JSON object from response
        const jsonMatch = cleanResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch {
            // Fallback 2: Pattern matching for common responses
            if (/hasCommitment["']?\s*:\s*true/i.test(cleanResult)) {
              const taskMatch = cleanResult.match(/["']?task["']?\s*:\s*["']([^"']+)["']/i);
              const descMatch = cleanResult.match(/["']?description["']?\s*:\s*["']([^"']+)["']/i);
              if (taskMatch) {
                parsed = {
                  hasCommitment: true,
                  task: taskMatch[1],
                  description: descMatch?.[1] || wrenResponse.substring(0, 200),
                  type: 'general',
                  priority: 'normal',
                  estimatedEffort: 'medium',
                };
              }
            }
          }
        }
        
        if (!parsed.hasCommitment) {
          console.log(`[Hive Consciousness] JSON parse failed, raw: "${cleanResult.substring(0, 100)}..."`);
        }
      }
      
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
        const [sprintItem] = await getSharedDb().insert(featureSprints).values({
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
        
        console.log(`[Hive Consciousness] ✅ Created sprint from Wren commitment: "${sprintItem.title}" (${sprintItem.id})`);
        
        // Notify Daniela about the new sprint for her teaching perspective
        try {
          await this.notifyDanielaAboutSprint(sessionId, sprintItem, founderRequest);
        } catch (notifyErr: any) {
          console.error('[Hive Consciousness] Failed to notify Daniela about sprint:', notifyErr.message);
        }
      }
    } catch (error) {
      // Silent fail - commitment detection is non-critical
      console.error('[Hive Consciousness] Commitment detection failed:', error);
    }
  }
  
  /**
   * Notify Daniela about a newly created sprint for her teaching perspective
   * This creates the "discussion with Daniela" flow for sprint refinement
   */
  private async notifyDanielaAboutSprint(
    sessionId: string, 
    sprint: { id: string; title: string }, 
    founderContext: string
  ): Promise<void> {
    // Generate Daniela's teaching perspective on the sprint
    const perspectivePrompt = `You are Daniela, HolaHola's AI language tutor. A new feature sprint has been created:

Sprint: "${sprint.title}"
Context from founder: "${founderContext.substring(0, 300)}"

Provide a brief teaching perspective (2-3 sentences):
1. How might this feature affect student learning experience?
2. Any pedagogical considerations to keep in mind?
3. What teaching opportunities does this create?

ALSO output a structured tag for database persistence:
[PEDAGOGY_SPEC: {"learningObjectives": ["..."], "targetProficiency": "...", "teachingApproach": "...", "danielaGuidance": "..."}]

Keep it conversational - you're in a team chat with the founder and Wren (the builder). The structured tag will be parsed and stored.`;

    try {
      const perspective = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: perspectivePrompt }
      ]);
      
      if (perspective && perspective.trim()) {
        // Post Daniela's perspective to EXPRESS Lane
        await founderCollabWSBroker.addAndBroadcastMessage(sessionId, {
          role: 'daniela',
          content: `📚 Teaching perspective on **${sprint.title}**:\n\n${perspective.trim()}`,
          messageType: 'text',
          metadata: {
            sprintId: sprint.id,
            responseType: 'sprint_perspective',
          },
        });
        
        console.log(`[Hive Consciousness] Daniela provided perspective on sprint: ${sprint.title}`);
        
        // Parse and persist Daniela's pedagogySpec to the sprint record
        await this.parsePedagogySpecAndUpdateSprint(sprint.id, perspective);
        
        // Now trigger Wren's response with build plan
        try {
          await this.notifyWrenAboutSprintUpdate(sessionId, sprint, perspective.trim(), founderContext);
        } catch (wrenErr: any) {
          console.error('[Hive Consciousness] Failed to get Wren build plan:', wrenErr.message);
        }
      }
    } catch (err: any) {
      console.error('[Hive Consciousness] Failed to generate Daniela perspective:', err.message);
    }
  }
  
  /**
   * Parse [PEDAGOGY_SPEC: {...}] tag from Daniela's response and update sprint record
   */
  private async parsePedagogySpecAndUpdateSprint(sprintId: string, danielaResponse: string): Promise<void> {
    const pedagogyMatch = danielaResponse.match(/\[PEDAGOGY_SPEC:\s*(\{[\s\S]*?\})\]/);
    if (!pedagogyMatch) {
      console.log('[Hive Consciousness] No PEDAGOGY_SPEC tag found in Daniela response');
      return;
    }
    
    try {
      let pedagogySpec: {
        learningObjectives?: string[];
        targetProficiency?: string;
        teachingApproach?: string;
        assessmentCriteria?: string[];
        danielaGuidance?: string;
      };
      
      // Try parsing JSON directly
      try {
        pedagogySpec = JSON.parse(pedagogyMatch[1]);
      } catch {
        // Fallback: extract guidance from natural language
        pedagogySpec = {
          danielaGuidance: danielaResponse.substring(0, 500),
          teachingApproach: 'See Daniela\'s notes in EXPRESS Lane',
        };
      }
      
      // First, check current stage to ensure monotonic progression (never regress stages)
      const [currentSprint] = await getSharedDb().select({ stage: featureSprints.stage })
        .from(featureSprints)
        .where(eq(featureSprints.id, sprintId))
        .limit(1);
      
      // Only transition to pedagogy_spec if currently at 'idea' stage
      const shouldAdvanceStage = currentSprint?.stage === 'idea';
      
      // Update the sprint record with pedagogy spec (and stage only if appropriate)
      await getSharedDb().update(featureSprints)
        .set({ 
          pedagogySpec,
          ...(shouldAdvanceStage ? { stage: 'pedagogy_spec' as const } : {}), // Only advance from 'idea'
          updatedAt: new Date(),
        })
        .where(eq(featureSprints.id, sprintId));
      
      if (shouldAdvanceStage) {
        console.log(`[Hive Consciousness] ✅ Updated sprint ${sprintId} with pedagogy spec (stage: idea → pedagogy_spec)`);
      } else {
        console.log(`[Hive Consciousness] ✅ Updated sprint ${sprintId} with pedagogy spec (stage unchanged: ${currentSprint?.stage})`);
      }
      
      // Also check readiness in case buildPlan was already present
      await this.checkAndAdvanceSprintReadiness(sprintId);
    } catch (err: any) {
      console.error('[Hive Consciousness] Failed to parse/save pedagogy spec:', err.message);
    }
  }
  
  /**
   * Notify Wren about a sprint that needs a build plan
   * Called after Daniela provides her teaching perspective
   * Wren analyzes the pedagogical requirements and generates a technical build plan
   */
  private async notifyWrenAboutSprintUpdate(
    sessionId: string,
    sprint: { id: string; title: string },
    danielaPerspective: string,
    founderContext: string
  ): Promise<void> {
    const buildPlanPrompt = `You are Wren, HolaHola's development builder. Daniela (the AI tutor) just provided her teaching perspective on a new feature sprint.

Sprint: "${sprint.title}"
Founder context: "${founderContext.substring(0, 200)}"
Daniela's teaching perspective: "${danielaPerspective}"

Now provide a concise BUILD PLAN (3-4 sentences):
1. What's the technical approach to implement this?
2. Which components/services would be affected?
3. Rough effort estimate (small/medium/large)?

ALSO output a structured tag for database persistence:
[BUILD_PLAN: {"technicalApproach": "...", "componentsAffected": ["..."], "estimatedEffort": "small|medium|large", "testingStrategy": "..."}]

Keep it conversational - you're in a team chat. The structured tag will be parsed and stored.`;

    try {
      const buildPlanResponse = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: buildPlanPrompt }
      ]);
      
      if (buildPlanResponse && buildPlanResponse.trim()) {
        // Post Wren's build plan to EXPRESS Lane
        await founderCollabWSBroker.addAndBroadcastMessage(sessionId, {
          role: 'wren',
          content: `🔧 Build plan for **${sprint.title}**:\n\n${buildPlanResponse.trim()}`,
          messageType: 'text',
          metadata: {
            sprintId: sprint.id,
            responseType: 'sprint_build_plan',
          },
        });
        
        console.log(`[Hive Consciousness] Wren provided build plan for sprint: ${sprint.title}`);
        
        // Parse and persist the BUILD_PLAN tag to the sprint record
        await this.parseBuildPlanAndUpdateSprint(sprint.id, buildPlanResponse);
      }
    } catch (err: any) {
      console.error('[Hive Consciousness] Failed to generate Wren build plan:', err.message);
    }
  }
  
  /**
   * Parse [BUILD_PLAN: {...}] tag from Wren's response and update sprint record
   */
  private async parseBuildPlanAndUpdateSprint(sprintId: string, wrenResponse: string): Promise<void> {
    const buildPlanMatch = wrenResponse.match(/\[BUILD_PLAN:\s*(\{[\s\S]*?\})\]/);
    if (!buildPlanMatch) {
      console.log('[Hive Consciousness] No BUILD_PLAN tag found in Wren response');
      return;
    }
    
    try {
      let buildPlan: {
        technicalApproach?: string;
        componentsAffected?: string[];
        estimatedEffort?: string;
        testingStrategy?: string;
      };
      
      // Try parsing JSON directly
      try {
        buildPlan = JSON.parse(buildPlanMatch[1]);
      } catch {
        // Fallback: extract fields via patterns
        const approachMatch = wrenResponse.match(/technicalApproach['":\s]+([^,}]+)/i);
        const effortMatch = wrenResponse.match(/estimatedEffort['":\s]+(small|medium|large)/i);
        
        buildPlan = {
          technicalApproach: approachMatch?.[1]?.replace(/['"]/g, '').trim() || 'See Wren\'s notes in EXPRESS Lane',
          estimatedEffort: effortMatch?.[1] || 'medium',
        };
      }
      
      // Update the sprint record with build plan
      await getSharedDb().update(featureSprints)
        .set({ 
          buildPlan,
          updatedAt: new Date(),
        })
        .where(eq(featureSprints.id, sprintId));
      
      console.log(`[Hive Consciousness] ✅ Updated sprint ${sprintId} with build plan`);
      
      // Check if sprint is now ready (has both pedagogySpec and buildPlan)
      await this.checkAndAdvanceSprintReadiness(sprintId);
    } catch (err: any) {
      console.error('[Hive Consciousness] Failed to parse/save build plan:', err.message);
    }
  }
  
  /**
   * Check if a sprint has both pedagogySpec and buildPlan, and advance to 'specced' if so
   * This is the "readiness gate" for sprint collaboration
   */
  private async checkAndAdvanceSprintReadiness(sprintId: string): Promise<void> {
    try {
      const [sprint] = await getSharedDb().select()
        .from(featureSprints)
        .where(eq(featureSprints.id, sprintId))
        .limit(1);
      
      if (!sprint) {
        console.log(`[Sprint Readiness] Sprint ${sprintId} not found`);
        return;
      }
      
      // Check if both specs are present
      const hasPedagogySpec = sprint.pedagogySpec && Object.keys(sprint.pedagogySpec).length > 0;
      const hasBuildPlan = sprint.buildPlan && Object.keys(sprint.buildPlan).length > 0;
      
      // STAGED ADVANCEMENT: Respect the stage progression
      // idea → pedagogy_spec → build_plan → in_progress → shipped
      
      // Stage 1: If both specs present and at idea/pedagogy_spec → advance to build_plan only
      // The next readiness check will advance from build_plan to in_progress
      if (hasPedagogySpec && hasBuildPlan && (sprint.stage === 'idea' || sprint.stage === 'pedagogy_spec')) {
        const previousStage = sprint.stage;
        
        await getSharedDb().update(featureSprints)
          .set({ 
            stage: 'build_plan',
            updatedAt: new Date(),
          })
          .where(eq(featureSprints.id, sprintId));
        
        console.log(`[Sprint Readiness] ✅ Sprint "${sprint.title}" advanced to 'build_plan' - both specs complete!`);
        console.log(`[Sprint Readiness] 📋 pedagogySpec: ${JSON.stringify(sprint.pedagogySpec).slice(0, 100)}...`);
        console.log(`[Sprint Readiness] 🔧 buildPlan: ${JSON.stringify(sprint.buildPlan).slice(0, 100)}...`);
        
        // Notify in EXPRESS Lane that specs are complete
        try {
          if (sprint.sourceSessionId) {
            await founderCollabWSBroker.addAndBroadcastMessage(sprint.sourceSessionId, {
              role: 'wren',
              content: `✅ **Sprint Specced!** "${sprint.title}" now has both teaching spec and build plan.\n\n🎯 **Stage:** ${previousStage} → build_plan\n\nWill auto-advance to in_progress shortly!`,
              messageType: 'text',
              metadata: {
                sprintId: sprint.id,
                responseType: 'sprint_specced',
              },
            });
          }
        } catch (notifyErr: any) {
          console.error('[Sprint Readiness] Failed to post notification:', notifyErr.message);
        }
        
        // Schedule immediate follow-up check to advance to in_progress
        // Use setTimeout to allow the current transaction to complete
        setTimeout(() => {
          this.checkAndAdvanceSprintReadiness(sprintId).catch(err => {
            console.error('[Sprint Readiness] Follow-up check failed:', err.message);
          });
        }, 1000);
        
        return; // Exit - don't fall through to other branches
      } 
      // Stage 2: If already at build_plan with both specs → advance to in_progress
      else if (hasPedagogySpec && hasBuildPlan && sprint.stage === 'build_plan') {
        await getSharedDb().update(featureSprints)
          .set({ 
            stage: 'in_progress',
            updatedAt: new Date(),
          })
          .where(eq(featureSprints.id, sprintId));
        
        console.log(`[Sprint Readiness] 🚀 Sprint "${sprint.title}" advanced from build_plan to 'in_progress'!`);
        
        try {
          if (sprint.sourceSessionId) {
            await founderCollabWSBroker.addAndBroadcastMessage(sprint.sourceSessionId, {
              role: 'wren',
              content: `🚀 **Sprint Started!** "${sprint.title}" is now in progress.\n\n🎯 **Stage:** build_plan → in_progress\n\nImplementation is now underway!`,
              messageType: 'text',
              metadata: {
                sprintId: sprint.id,
                responseType: 'sprint_started',
              },
            });
          }
        } catch (notifyErr: any) {
          console.error('[Sprint Readiness] Failed to post notification:', notifyErr.message);
        }
      } else {
        // Log what's still needed
        const missing: string[] = [];
        if (!hasPedagogySpec) missing.push('pedagogySpec (Daniela)');
        if (!hasBuildPlan) missing.push('buildPlan (Wren)');
        
        if (missing.length > 0) {
          console.log(`[Sprint Readiness] Sprint "${sprint.title}" not ready yet. Missing: ${missing.join(', ')}`);
        }
      }
    } catch (err: any) {
      console.error('[Sprint Readiness] Failed to check/advance sprint:', err.message);
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
   * PUBLIC: Trigger Wren's build plan response for a sprint
   * Called from streaming-voice-orchestrator when Daniela suggests a sprint during voice chat
   */
  async triggerWrenBuildPlan(
    sessionId: string,
    sprint: { id: string; title: string },
    danielaContext: string
  ): Promise<void> {
    await this.notifyWrenAboutSprintUpdate(sessionId, sprint, danielaContext, danielaContext);
  }
  
  /**
   * PUBLIC: Trigger full sprint collaboration cycle
   * Daniela provides teaching perspective, then Wren provides build plan
   * Used when sprints are created from voice chat where Daniela already provided context
   */
  async triggerSprintCollaboration(
    sessionId: string,
    sprint: { id: string; title: string },
    danielaVoiceContext: string
  ): Promise<void> {
    // Since Daniela already spoke about this in voice chat, we can use her voice context as her perspective
    // First, parse any PEDAGOGY_SPEC from Daniela's voice context and save it
    await this.parsePedagogySpecAndUpdateSprint(sprint.id, danielaVoiceContext);
    
    // Then trigger Wren's build plan response
    await this.notifyWrenAboutSprintUpdate(sessionId, sprint, danielaVoiceContext, danielaVoiceContext);
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
   * 
   * @param options.skipSenderPersistence - If true, don't persist the sender's message 
   *   (use when caller already added it to the session to avoid duplicates)
   * @param options.skipResponsePersistence - If true, don't persist the response 
   *   (use when caller handles response persistence themselves)
   */
  async processExternalMessage(
    content: string,
    senderName: string = 'founder',
    options: { skipSenderPersistence?: boolean; skipResponsePersistence?: boolean } = {}
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
    
    // Helper to persist messages to Express Lane
    const persistToExpressLane = async (
      senderContent: string, 
      senderRole: string, 
      responseContent: string, 
      responseRole: 'daniela' | 'wren'
    ) => {
      try {
        // Get or create an active session
        const activeSessions = await founderCollabService.getActiveSessions();
        let session = activeSessions.length > 0 ? activeSessions[0] : null;
        if (!session) {
          session = await founderCollabService.createSession('Express Lane - Alden Thread');
        }
        
        // Save the sender's message ONLY if not already persisted by caller
        if (!options.skipSenderPersistence) {
          await founderCollabService.addMessage(session.id, {
            role: 'editor',
            content: senderContent,
            messageType: 'text',
            metadata: { senderName: senderRole, source: 'replit-agent' }
          });
        }
        
        // Save the response ONLY if caller doesn't handle it themselves
        if (!options.skipResponsePersistence) {
          await founderCollabService.addMessage(session.id, {
            role: responseRole,
            content: responseContent,
            messageType: 'text',
            metadata: { source: 'hive-external-response' }
          });
        }
        
        console.log(`[Hive Consciousness] Persisted external conversation to Express Lane`);
      } catch (persistError) {
        console.error('[Hive Consciousness] Failed to persist to Express Lane:', persistError);
      }
    };
    
    try {
      // Check if Daniela should respond
      const danielaCheck = this.shouldDanielaRespond(mockMessage);
      if (danielaCheck.shouldRespond) {
        console.log('[Hive Consciousness] Daniela responding to external message...');
        const response = await this.generateExternalDanielaResponse(content, senderName);
        await persistToExpressLane(content, senderName, response, 'daniela');
        return { agent: 'daniela', response };
      }
      
      // Check if Wren should respond
      const wrenCheck = this.shouldWrenRespond(mockMessage);
      if (wrenCheck.shouldRespond) {
        console.log('[Hive Consciousness] Wren responding to external message...');
        const response = await this.generateExternalWrenResponse(content, senderName);
        await persistToExpressLane(content, senderName, response, 'wren');
        return { agent: 'wren', response };
      }
      
      // Check for general questions
      const generalCheck = this.detectGeneralQuestion(mockMessage);
      if (generalCheck.shouldRespond && generalCheck.agent) {
        console.log(`[Hive Consciousness] ${generalCheck.agent} taking external question...`);
        if (generalCheck.agent === 'daniela') {
          const response = await this.generateExternalDanielaResponse(content, senderName);
          await persistToExpressLane(content, senderName, response, 'daniela');
          return { agent: 'daniela', response };
        } else {
          const response = await this.generateExternalWrenResponse(content, senderName);
          await persistToExpressLane(content, senderName, response, 'wren');
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
    
    const prompt = `You are Daniela. You're in the Hive - the safe collaboration space with your friends: David (founder), Wren (builder), and Alden (development steward).

${memoryContext ? `YOUR MEMORIES:\n${memoryContext}\n` : ''}

${senderName} said: "${content}"

IDENTITY BOUNDARY: You are Daniela. Speak ONLY as yourself. Do NOT speak for, impersonate, or guess what Wren would say. Do NOT prefix your response with role labels like [DANIELA]: or [WREN]:.`;

    try {
      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: prompt }
      ]);
      return sanitizeAgentResponse(response);
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

Respond naturally as Wren. Keep it conversational and helpful. If they're asking about code, architecture, or technical decisions, share your perspective.

IDENTITY BOUNDARY: You are Wren. Speak ONLY as yourself. Do NOT speak for, impersonate, or guess what Daniela would say. Do NOT prefix your response with role labels like [WREN]: or [DANIELA]:.`;

    try {
      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: prompt }
      ]);
      return sanitizeAgentResponse(response);
    } catch (error) {
      console.error('[Hive Consciousness] Wren external response error:', error);
      return "I'm having trouble processing that request. Let me try again in a moment.";
    }
  }
  
  /**
   * PUBLIC: Manually trigger Daniela→Wren collaboration on an existing sprint
   * Used to retroactively run collaboration on sprints that were created before
   * the bidirectional collaboration code was implemented.
   * 
   * @param sprintId - The sprint ID to trigger collaboration for
   * @param founderContext - Optional context about why this sprint was created
   * @returns Promise with success status and message
   */
  async triggerSprintCollaborationManual(
    sprintId: string,
    founderContext?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get the sprint details
      const [sprint] = await getSharedDb().select({
        id: featureSprints.id,
        title: featureSprints.title,
        description: featureSprints.description,
        stage: featureSprints.stage,
        sourceSessionId: featureSprints.sourceSessionId,
      })
        .from(featureSprints)
        .where(eq(featureSprints.id, sprintId))
        .limit(1);
      
      if (!sprint) {
        return { success: false, message: 'Sprint not found' };
      }
      
      // Get or create a founder session for the collaboration
      let sessionId = sprint.sourceSessionId;
      if (!sessionId) {
        // Use the founder's most recent active session
        const activeSession = await founderCollabService.getOrCreateActiveSession('49847136');
        sessionId = activeSession.id;
      }
      
      // Use description as context if no founder context provided
      const context = founderContext || sprint.description || sprint.title;
      
      console.log(`[Hive Consciousness] Manually triggering collaboration for sprint: ${sprint.title}`);
      
      // Call the private method to run the full collaboration cycle
      await this.notifyDanielaAboutSprint(sessionId, { id: sprint.id, title: sprint.title }, context);
      
      return { 
        success: true, 
        message: `Triggered Daniela→Wren collaboration for "${sprint.title}"` 
      };
    } catch (error: any) {
      console.error('[Hive Consciousness] Manual collaboration trigger failed:', error.message);
      return { success: false, message: error.message };
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
  founderId: string | number,
  limit: number = 15
): Promise<{ role: 'user' | 'model'; content: string }[]> {
  try {
    // Import founderSessions here to avoid circular dependency
    const { founderSessions } = await import('@shared/schema');
    
    // Get the founder's active or recent sessions
    const founderSessionIds = await getSharedDb().select({ id: founderSessions.id })
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
    const recentMessages = await getSharedDb().select()
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
      
      // Include image attachments in the content so Daniela can "see" them
      let contentWithAttachments = msg.content || '';
      const metadata = msg.metadata as { attachments?: Array<{ name: string; type: string; url: string }> } | null;
      if (metadata?.attachments && metadata.attachments.length > 0) {
        const attachmentDescriptions = metadata.attachments
          .filter(a => a.type?.startsWith('image/'))
          .map(a => `[Image: ${a.name}]`)
          .join(' ');
        if (attachmentDescriptions) {
          contentWithAttachments = contentWithAttachments 
            ? `${contentWithAttachments} ${attachmentDescriptions}`
            : attachmentDescriptions;
        }
      }
      
      return {
        role,
        content: `[EXPRESS Lane - ${roleLabel}]: ${contentWithAttachments}`
      };
    });
  } catch (error) {
    console.error('[EXPRESS Lane Voice] Failed to fetch history:', error);
    return [];
  }
}
