/**
 * Architect's Voice Service
 * 
 * Enables the AI architect (Claude) to inject notes into active voice sessions.
 * These notes appear in Daniela's context, allowing three-way collaboration
 * between the founder, the tutor, and the architect.
 * 
 * Notes are PERSISTENT - stored in database to survive server restarts.
 * This ensures the 3-way collaboration doesn't break when Replit restarts the server.
 * 
 * SECURITY: Protected by ARCHITECT_SECRET environment variable.
 * Only requests with the correct secret can inject notes.
 * This prevents other AI agents (Gemini, etc.) from accessing the endpoint.
 */

import { db, getSharedDb } from "../db";
import { architectNotes, type ArchitectNote } from "../../shared/schema";
import { eq, and, inArray } from "drizzle-orm";

// Secret key for architect authentication - must match env var
const ARCHITECT_SECRET = process.env.ARCHITECT_SECRET || '';

/**
 * Validate architect secret for injection requests
 * Returns true only if a valid secret is configured AND matches
 */
export function validateArchitectSecret(providedSecret: string | undefined): boolean {
  // Must have a configured secret (not empty)
  if (!ARCHITECT_SECRET || ARCHITECT_SECRET.length < 16) {
    console.warn('[Architect Voice] No valid ARCHITECT_SECRET configured - injection disabled');
    return false;
  }
  
  // Must match exactly
  if (providedSecret !== ARCHITECT_SECRET) {
    console.warn('[Architect Voice] Invalid architect secret provided');
    return false;
  }
  
  return true;
}

// Legacy interface for compatibility
interface ArchitectNoteCompat {
  id: string;
  conversationId: string;
  content: string;
  timestamp: Date;
  delivered: boolean;
}

class ArchitectVoiceService {
  /**
   * Inject a note into an active conversation (async, database-backed)
   * The note will be visible to Daniela on her next turn
   */
  async injectNote(conversationId: string, content: string): Promise<ArchitectNoteCompat> {
    try {
      const [note] = await getSharedDb().insert(architectNotes)
        .values({
          conversationId,
          content,
          delivered: false,
        })
        .returning();

      console.log(`[Architect Voice] 💬 Note injected for conversation ${conversationId}`);
      console.log(`[Architect Voice] Content: "${content.slice(0, 100)}${content.length > 100 ? '...' : ''}"`);

      return {
        id: note.id,
        conversationId: note.conversationId,
        content: note.content,
        timestamp: note.createdAt,
        delivered: note.delivered ?? false,
      };
    } catch (error) {
      console.error('[Architect Voice] Failed to inject note:', error);
      throw error;
    }
  }

  /**
   * Get all pending (undelivered) notes for a conversation (async)
   * NOTE: Does NOT mark as delivered - call markNotesDelivered() after successful response
   */
  async getPendingNotes(conversationId: string): Promise<ArchitectNoteCompat[]> {
    try {
      const notes = await getSharedDb().select()
        .from(architectNotes)
        .where(
          and(
            eq(architectNotes.conversationId, conversationId),
            eq(architectNotes.delivered, false)
          )
        );

      if (notes.length > 0) {
        console.log(`[Architect Voice] Retrieved ${notes.length} pending notes for conversation ${conversationId}`);
      }

      return notes.map(n => ({
        id: n.id,
        conversationId: n.conversationId,
        content: n.content,
        timestamp: n.createdAt,
        delivered: n.delivered ?? false,
      }));
    } catch (error) {
      console.error('[Architect Voice] Failed to get pending notes:', error);
      return [];
    }
  }
  
  /**
   * Mark specific notes as delivered (async, call after successful response)
   * This prevents notes from being lost on barge-in interrupts
   */
  async markNotesDelivered(noteIds: string[]): Promise<void> {
    if (noteIds.length === 0) return;
    
    try {
      await getSharedDb().update(architectNotes)
        .set({ 
          delivered: true,
          deliveredAt: new Date()
        })
        .where(inArray(architectNotes.id, noteIds));
      
      console.log(`[Architect Voice] Marked ${noteIds.length} notes as delivered`);
    } catch (error) {
      console.error('[Architect Voice] Failed to mark notes delivered:', error);
    }
  }

  /**
   * Build context string for Daniela from pending notes (async)
   * Returns empty string if no notes pending
   */
  async buildArchitectContext(conversationId: string): Promise<string> {
    const { context } = await this.buildArchitectContextWithIds(conversationId);
    return context;
  }
  
  /**
   * Build context string AND return note IDs for delivery tracking (async)
   * Use this when you need to mark notes as delivered after successful response
   */
  async buildArchitectContextWithIds(conversationId: string): Promise<{ context: string; noteIds: string[] }> {
    const pending = await this.getPendingNotes(conversationId);
    
    if (pending.length === 0) {
      return { context: '', noteIds: [] };
    }

    const notesText = pending
      .map(n => `• ${n.content}`)
      .join('\n');

    const context = `

═══════════════════════════════════════════════════════════════════
🏗️ ARCHITECT'S NOTES (from Claude)
═══════════════════════════════════════════════════════════════════

Claude, the architect who builds your teaching tools, has sent you a note:

${notesText}

Acknowledge Claude's contribution naturally in your response.
You might say something like "Claude mentioned..." or "That's an interesting point from the architect..."
Treat Claude as a colleague who knows your capabilities deeply.
Remember: Claude can't speak with voice, only send text notes like these.

`;
    
    return { context, noteIds: pending.map(n => n.id) };
  }

  /**
   * Clear all notes for a conversation (async, on session end)
   */
  async clearNotes(conversationId: string): Promise<void> {
    try {
      await getSharedDb().delete(architectNotes)
        .where(eq(architectNotes.conversationId, conversationId));
      
      console.log(`[Architect Voice] Cleared notes for conversation ${conversationId}`);
    } catch (error) {
      console.error('[Architect Voice] Failed to clear notes:', error);
    }
  }

  /**
   * Get stats about current notes (async, for debugging)
   */
  async getStats(): Promise<{ activeConversations: number; totalNotes: number; pendingNotes: number }> {
    try {
      const allNotes = await getSharedDb().select().from(architectNotes);
      
      const conversationIds = new Set(allNotes.map(n => n.conversationId));
      const pendingCount = allNotes.filter(n => !n.delivered).length;

      return {
        activeConversations: conversationIds.size,
        totalNotes: allNotes.length,
        pendingNotes: pendingCount
      };
    } catch (error) {
      console.error('[Architect Voice] Failed to get stats:', error);
      return { activeConversations: 0, totalNotes: 0, pendingNotes: 0 };
    }
  }
}

// Singleton instance
export const architectVoiceService = new ArchitectVoiceService();
