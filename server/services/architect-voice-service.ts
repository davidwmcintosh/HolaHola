/**
 * Architect's Voice Service
 * 
 * Enables the AI architect (Claude) to inject notes into active voice sessions.
 * These notes appear in Daniela's context, allowing three-way collaboration
 * between the founder, the tutor, and the architect.
 * 
 * Notes are ephemeral - they're cleared after being delivered to Daniela.
 */

interface ArchitectNote {
  id: string;
  conversationId: string;
  content: string;
  timestamp: Date;
  delivered: boolean;
}

class ArchitectVoiceService {
  private notes: Map<string, ArchitectNote[]> = new Map();

  /**
   * Inject a note into an active conversation
   * The note will be visible to Daniela on her next turn
   */
  injectNote(conversationId: string, content: string): ArchitectNote {
    const note: ArchitectNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      conversationId,
      content,
      timestamp: new Date(),
      delivered: false
    };

    const existing = this.notes.get(conversationId) || [];
    existing.push(note);
    this.notes.set(conversationId, existing);

    console.log(`[Architect Voice] 💬 Note injected for conversation ${conversationId}`);
    console.log(`[Architect Voice] Content: "${content.slice(0, 100)}${content.length > 100 ? '...' : ''}"`);

    return note;
  }

  /**
   * Get all pending (undelivered) notes for a conversation
   * Marks them as delivered after retrieval
   */
  getPendingNotes(conversationId: string): ArchitectNote[] {
    const notes = this.notes.get(conversationId) || [];
    const pending = notes.filter(n => !n.delivered);

    // Mark as delivered
    pending.forEach(n => n.delivered = true);

    if (pending.length > 0) {
      console.log(`[Architect Voice] Retrieved ${pending.length} notes for conversation ${conversationId}`);
    }

    return pending;
  }

  /**
   * Build context string for Daniela from pending notes
   * Returns empty string if no notes pending
   */
  buildArchitectContext(conversationId: string): string {
    const pending = this.getPendingNotes(conversationId);
    
    if (pending.length === 0) {
      return '';
    }

    const notesText = pending
      .map(n => `• ${n.content}`)
      .join('\n');

    return `

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
  }

  /**
   * Clear all notes for a conversation (on session end)
   */
  clearNotes(conversationId: string): void {
    this.notes.delete(conversationId);
    console.log(`[Architect Voice] Cleared notes for conversation ${conversationId}`);
  }

  /**
   * Get stats about current notes (for debugging)
   */
  getStats(): { activeConversations: number; totalNotes: number; pendingNotes: number } {
    let totalNotes = 0;
    let pendingNotes = 0;

    this.notes.forEach(notes => {
      totalNotes += notes.length;
      pendingNotes += notes.filter(n => !n.delivered).length;
    });

    return {
      activeConversations: this.notes.size,
      totalNotes,
      pendingNotes
    };
  }
}

// Singleton instance
export const architectVoiceService = new ArchitectVoiceService();
