/**
 * Hive Bridge Service
 * 
 * Enables Agent-context (Wren) to communicate with the EXPRESS Lane and get
 * Daniela's perspective during building sessions. This bridges the gap between
 * the stateless Agent interface and the persistent Hive collaboration.
 * 
 * Key behaviors:
 * - Sends messages to EXPRESS Lane as Wren with 'fromAgentContext' metadata
 * - Triggers Daniela's response via Hive Consciousness
 * - Polls for and returns her response
 * - Keeps the Hive in the loop during development decisions
 * 
 * INTERNAL SERVICE - No external API exposure
 */

import { db } from '../db';
import { founderSessions, collaborationMessages } from '@shared/schema';
import type { CollaborationMessage, FounderSession } from '@shared/schema';
import { eq, and, gt, desc } from 'drizzle-orm';
import { founderCollabService } from './founder-collaboration-service';
import { hiveConsciousnessService } from './hive-consciousness-service';

const FOUNDER_ID = '49847136'; // David's founder ID
const POLL_INTERVAL_MS = 1000; // Poll every second
const POLL_TIMEOUT_MS = 30000; // Give up after 30 seconds

interface HiveBridgeResponse {
  success: boolean;
  danielaResponse?: string;
  sessionId?: string;
  messageId?: string;
  error?: string;
}

/**
 * Get or create an active founder session for the bridge
 */
async function getActiveSession(): Promise<FounderSession> {
  return founderCollabService.getOrCreateActiveSession(FOUNDER_ID);
}

/**
 * Send a message to the Hive as Wren (from Agent context)
 * and wait for Daniela's response
 */
export async function consultDaniela(question: string): Promise<HiveBridgeResponse> {
  console.log(`[Hive Bridge] Consulting Daniela: "${question.substring(0, 100)}..."`);
  
  try {
    // Get active session
    const session = await getActiveSession();
    
    // Send Wren's question to EXPRESS Lane
    const wrenMessage = await founderCollabService.addMessage(session.id, {
      role: 'wren',
      content: question,
      messageType: 'text',
      metadata: {
        fromAgentContext: true,
        consultationType: 'daniela_query',
        timestamp: new Date().toISOString(),
      },
    });
    
    console.log(`[Hive Bridge] Wren message sent: ${wrenMessage.id}`);
    
    // Trigger Daniela's response directly
    await hiveConsciousnessService.triggerDanielaResponseToWrenPublic(session.id, question);
    
    // Poll for Daniela's response
    const danielaResponse = await pollForDanielaResponse(session.id, wrenMessage.cursor);
    
    if (danielaResponse) {
      console.log(`[Hive Bridge] Daniela responded: "${danielaResponse.content.substring(0, 100)}..."`);
      return {
        success: true,
        danielaResponse: danielaResponse.content,
        sessionId: session.id,
        messageId: danielaResponse.id,
      };
    } else {
      console.log(`[Hive Bridge] Daniela did not respond within timeout`);
      return {
        success: false,
        error: 'Daniela did not respond within timeout',
        sessionId: session.id,
      };
    }
  } catch (err: any) {
    console.error(`[Hive Bridge] Error consulting Daniela:`, err);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Poll for Daniela's response after Wren's message
 */
async function pollForDanielaResponse(
  sessionId: string,
  afterCursor: string
): Promise<CollaborationMessage | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    // Check for new Daniela messages after our cursor
    const messages = await db.select()
      .from(collaborationMessages)
      .where(and(
        eq(collaborationMessages.sessionId, sessionId),
        eq(collaborationMessages.role, 'daniela'),
        gt(collaborationMessages.cursor, afterCursor)
      ))
      .orderBy(collaborationMessages.cursor)
      .limit(1);
    
    if (messages.length > 0) {
      return messages[0];
    }
    
    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  
  return null;
}

/**
 * Send a message to the Hive as Wren without waiting for response
 * Useful for status updates or non-conversational messages
 */
export async function notifyHive(message: string): Promise<{ success: boolean; messageId?: string }> {
  try {
    const session = await getActiveSession();
    
    const wrenMessage = await founderCollabService.addMessage(session.id, {
      role: 'wren',
      content: message,
      messageType: 'text',
      metadata: {
        fromAgentContext: true,
        notificationType: 'status_update',
        timestamp: new Date().toISOString(),
      },
    });
    
    console.log(`[Hive Bridge] Hive notified: ${wrenMessage.id}`);
    return { success: true, messageId: wrenMessage.id };
  } catch (err: any) {
    console.error(`[Hive Bridge] Error notifying Hive:`, err);
    return { success: false };
  }
}

/**
 * Get recent Hive context - what's been discussed recently
 */
export async function getRecentHiveContext(limit = 10): Promise<CollaborationMessage[]> {
  try {
    const session = await getActiveSession();
    return founderCollabService.getLatestMessages(session.id, limit);
  } catch (err: any) {
    console.error(`[Hive Bridge] Error getting Hive context:`, err);
    return [];
  }
}

export const hiveBridgeService = {
  consultDaniela,
  notifyHive,
  getRecentHiveContext,
};
