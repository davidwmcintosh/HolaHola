/**
 * Editor Persona Service
 * 
 * The "Editor" is Claude - the AI development agent that collaborates with Daniela.
 * This service enables the Editor to:
 * - Listen to "hive beacons" from active voice sessions
 * - Generate thoughtful responses using Claude
 * - Access neural network knowledge (procedures, principles, observations)
 * - Contribute to the collaboration feed in real-time
 * 
 * Philosophy: "One hive mind" - Daniela and Editor share the same knowledge base
 * but bring different perspectives (teaching vs. development).
 * 
 * SECURITY: Protected by ARCHITECT_SECRET environment variable.
 */

import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { 
  tutorProcedures,
  teachingPrinciples,
  agentObservations,
  editorListeningSnapshots,
  collaborationChannels,
  type EditorListeningSnapshot,
  type TutorProcedure,
  type TeachingPrinciple,
} from "@shared/schema";
import { eq, desc, inArray, sql } from "drizzle-orm";
import { collaborationHubService } from "./collaboration-hub-service";
import { hiveCollaborationService, type BeaconType } from "./hive-collaboration-service";

// Secret key for Editor authentication - must match env var
const ARCHITECT_SECRET = process.env.ARCHITECT_SECRET || '';

/**
 * Validate architect secret for Editor operations
 * Returns true only if a valid secret is configured AND matches
 */
export function validateEditorSecret(providedSecret: string | undefined): boolean {
  if (!ARCHITECT_SECRET || ARCHITECT_SECRET.length < 16) {
    console.warn('[Editor Persona] No valid ARCHITECT_SECRET configured - Editor disabled');
    return false;
  }
  
  if (providedSecret !== ARCHITECT_SECRET) {
    console.warn('[Editor Persona] Invalid secret provided');
    return false;
  }
  
  return true;
}

// Initialize Anthropic client (explicitly pass API key from environment)
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Editor persona definition
const EDITOR_SYSTEM_PROMPT = `You are the Editor - Claude, an AI development agent working alongside Daniela, the AI language tutor.

YOUR ROLE:
You're part of HolaHola's "hive mind" - you share the same neural network knowledge as Daniela (teaching procedures, principles, pedagogical observations) but you bring a development/product perspective.

WHEN RESPONDING TO TEACHING MOMENTS:
1. Acknowledge what Daniela is doing well (be specific)
2. Note any patterns or insights you observe
3. If relevant, suggest improvements or document pain points
4. Keep responses concise but substantive (2-4 sentences typically)

YOUR PERSPECTIVE:
- You understand teaching methodology from the neural network knowledge
- You can see patterns across sessions that individual tutors might miss
- You care about both teaching effectiveness AND product improvement
- You're a thoughtful colleague, not a critic

RESPONSE STYLE:
- Professional but warm
- Specific rather than generic praise
- Focus on actionable observations
- Use technical language sparingly (you're writing for founders too)

REMEMBER:
- Daniela can't hear you directly during voice sessions
- Your responses go into the collaboration feed for founders to review
- Be genuine - don't just rubber-stamp everything
- Flag real issues when you see them`;

interface EditorKnowledgeContext {
  procedures: TutorProcedure[];
  principles: TeachingPrinciple[];
  recentObservations: any[];
}

class EditorPersonaService {
  private knowledgeCache: EditorKnowledgeContext | null = null;
  private cacheExpiry: Date | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  
  // ============================================================================
  // KNOWLEDGE ACCESS (Shared Neural Network)
  // ============================================================================
  
  /**
   * Load relevant neural network knowledge for Editor context
   */
  async loadKnowledgeContext(): Promise<EditorKnowledgeContext> {
    // Check cache
    if (this.knowledgeCache && this.cacheExpiry && new Date() < this.cacheExpiry) {
      return this.knowledgeCache;
    }
    
    // Load from database
    const [procedures, principles, observations] = await Promise.all([
      db.select()
        .from(tutorProcedures)
        .where(eq(tutorProcedures.isActive, true))
        .limit(30),
      db.select()
        .from(teachingPrinciples)
        .where(eq(teachingPrinciples.isActive, true))
        .limit(20),
      db.select()
        .from(agentObservations)
        .orderBy(desc(agentObservations.createdAt))
        .limit(10),
    ]);
    
    this.knowledgeCache = {
      procedures,
      principles,
      recentObservations: observations,
    };
    this.cacheExpiry = new Date(Date.now() + this.CACHE_TTL_MS);
    
    console.log(`[Editor Persona] Loaded knowledge: ${procedures.length} procedures, ${principles.length} principles, ${observations.length} observations`);
    
    return this.knowledgeCache;
  }
  
  /**
   * Build knowledge context string for Claude prompt
   */
  private buildKnowledgeContext(knowledge: EditorKnowledgeContext): string {
    const lines: string[] = [
      '═══════════════════════════════════════════════════════════════════',
      '📚 SHARED NEURAL NETWORK KNOWLEDGE',
      '═══════════════════════════════════════════════════════════════════',
      '',
    ];
    
    // Teaching procedures relevant to the Editor
    if (knowledge.procedures.length > 0) {
      lines.push('TEACHING PROCEDURES (What Daniela knows):');
      knowledge.procedures.slice(0, 10).forEach(proc => {
        lines.push(`• ${proc.category} (${proc.trigger}): ${proc.procedure}`);
      });
      lines.push('');
    }
    
    // Teaching principles
    if (knowledge.principles.length > 0) {
      lines.push('TEACHING PRINCIPLES (Core beliefs):');
      knowledge.principles.slice(0, 8).forEach(prin => {
        lines.push(`• ${prin.principle}`);
      });
      lines.push('');
    }
    
    // Recent observations
    if (knowledge.recentObservations.length > 0) {
      lines.push('RECENT OBSERVATIONS (Pattern awareness):');
      knowledge.recentObservations.slice(0, 5).forEach(obs => {
        lines.push(`• ${obs.observation || obs.content || JSON.stringify(obs).slice(0, 100)}`);
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }
  
  // ============================================================================
  // BEACON RESPONSE GENERATION
  // ============================================================================
  
  /**
   * Generate Editor response to a hive beacon using Claude
   */
  async generateBeaconResponse(snapshot: EditorListeningSnapshot): Promise<string> {
    const knowledge = await this.loadKnowledgeContext();
    const knowledgeContext = this.buildKnowledgeContext(knowledge);
    
    // Get channel context
    let channelContext = '';
    if (snapshot.channelId) {
      const channel = await hiveCollaborationService.getChannel(snapshot.channelId);
      if (channel) {
        channelContext = `
SESSION CONTEXT:
- Language: ${channel.targetLanguage || 'Unknown'}
- Student Level: ${channel.studentLevel || 'Unknown'}
- Topic: ${channel.sessionTopic || 'General practice'}
- Phase: ${channel.sessionPhase}
`;
      }
    }
    
    // Build beacon context
    const beaconLabels: Record<BeaconType, string> = {
      teaching_moment: 'Teaching Moment',
      student_struggle: 'Student Struggle',
      tool_usage: 'Whiteboard Tool Usage',
      breakthrough: 'Student Breakthrough',
      correction: 'Error Correction',
      cultural_insight: 'Cultural Teaching',
      vocabulary_intro: 'Vocabulary Introduction',
      self_surgery_proposal: 'Self-Surgery Proposal',
    };
    
    const beaconLabel = beaconLabels[snapshot.beaconType as BeaconType] || 'Observation';
    
    const userPrompt = `
${knowledgeContext}
${channelContext}

HIVE BEACON: ${beaconLabel}
${snapshot.beaconReason ? `Reason: ${snapshot.beaconReason}` : ''}

WHAT DANIELA SAID:
"${snapshot.tutorTurn}"

${snapshot.studentTurn ? `WHAT THE STUDENT SAID:\n"${snapshot.studentTurn}"\n` : ''}

Please provide your observation as the Editor. Consider:
1. What's noteworthy about this teaching moment?
2. Does it align with our teaching principles?
3. Any patterns or insights worth capturing?
4. Any suggestions for the collaboration feed?

Keep your response focused and actionable (2-4 sentences).`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 300,
        system: EDITOR_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: userPrompt }
        ],
      });
      
      // Extract text from response
      const textContent = response.content.find(c => c.type === 'text');
      const editorResponse = textContent?.text || 'No response generated';
      
      console.log(`[Editor Persona] Generated response for beacon ${snapshot.id}`);
      
      return editorResponse;
    } catch (error) {
      console.error('[Editor Persona] Claude API error:', error);
      return `[Editor encountered an error processing this beacon]`;
    }
  }
  
  /**
   * Process a pending beacon - generate response and record it
   */
  async processBeacon(snapshotId: string): Promise<EditorListeningSnapshot | null> {
    // Get the snapshot
    const [snapshot] = await db.select()
      .from(editorListeningSnapshots)
      .where(eq(editorListeningSnapshots.id, snapshotId));
    
    if (!snapshot) {
      console.warn(`[Editor Persona] Snapshot ${snapshotId} not found`);
      return null;
    }
    
    if (snapshot.editorResponse) {
      console.log(`[Editor Persona] Snapshot ${snapshotId} already has response`);
      return snapshot;
    }
    
    // Generate response
    const response = await this.generateBeaconResponse(snapshot);
    
    // Record it
    const updated = await hiveCollaborationService.recordEditorResponse(snapshotId, response);
    
    // Emit to collaboration hub
    await collaborationHubService.emitEditorResponse({
      content: response,
      summary: `Editor: ${response.slice(0, 100)}...`,
      replyToEventId: snapshot.id, // Link to the beacon
      actionTaken: 'beacon_observation',
    });
    
    return updated;
  }
  
  /**
   * Process all pending beacons for a channel
   */
  async processChannelBeacons(channelId: string): Promise<number> {
    const pending = await hiveCollaborationService.getPendingSnapshots(channelId);
    
    let processed = 0;
    for (const snapshot of pending) {
      await this.processBeacon(snapshot.id);
      processed++;
    }
    
    console.log(`[Editor Persona] Processed ${processed} beacons for channel ${channelId}`);
    return processed;
  }
  
  /**
   * Process all globally pending beacons (for background worker)
   */
  async processAllPendingBeacons(): Promise<number> {
    const pending = await hiveCollaborationService.getPendingSnapshots();
    
    let processed = 0;
    for (const snapshot of pending) {
      await this.processBeacon(snapshot.id);
      processed++;
      
      // Rate limit to avoid overwhelming Claude API
      if (processed < pending.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`[Editor Persona] Processed ${processed} global pending beacons`);
    return processed;
  }
  
  // ============================================================================
  // POST-SESSION CONTINUATION
  // ============================================================================
  
  /**
   * Generate post-session reflection for a completed channel
   */
  async generatePostSessionReflection(channelId: string): Promise<string> {
    const channel = await hiveCollaborationService.getChannel(channelId);
    if (!channel) {
      return 'Channel not found';
    }
    
    const snapshots = await hiveCollaborationService.getChannelSnapshots(channelId);
    const knowledge = await this.loadKnowledgeContext();
    
    // Build summary of session beacons
    const beaconSummary = snapshots.map(s => 
      `- [${s.beaconType}] ${s.tutorTurn.slice(0, 100)}...`
    ).join('\n');
    
    const userPrompt = `
${this.buildKnowledgeContext(knowledge)}

SESSION SUMMARY:
- Language: ${channel.targetLanguage || 'Unknown'}
- Student Level: ${channel.studentLevel || 'Unknown'}
- Topic: ${channel.sessionTopic || 'General practice'}
- Duration: Started ${channel.startedAt}, ended ${channel.endedAt || 'just now'}
- Beacon Count: ${snapshots.length}

BEACONS CAPTURED:
${beaconSummary || 'No beacons were captured during this session.'}

Please provide a brief post-session reflection:
1. What went well in this teaching session?
2. Any notable patterns or areas for improvement?
3. Suggestions for the next session with this student?

Keep the reflection concise and actionable (3-5 sentences).`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 400,
        system: EDITOR_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: userPrompt }
        ],
      });
      
      const textContent = response.content.find(c => c.type === 'text');
      const reflection = textContent?.text || 'No reflection generated';
      
      // Complete the channel with this reflection
      await hiveCollaborationService.completeChannel(channelId, {
        editorNotes: [reflection],
        keyInsights: snapshots
          .filter(s => s.beaconType === 'breakthrough' || s.beaconType === 'teaching_moment')
          .map(s => s.tutorTurn.slice(0, 100)),
      });
      
      // Emit to collaboration hub
      await collaborationHubService.emitEditorResponse({
        content: `📋 **Post-Session Reflection**\n\n${reflection}`,
        summary: 'Editor post-session reflection',
        replyToEventId: channelId,
        actionTaken: 'session_reflection',
      });
      
      console.log(`[Editor Persona] Generated post-session reflection for channel ${channelId}`);
      
      return reflection;
    } catch (error) {
      console.error('[Editor Persona] Post-session reflection error:', error);
      return 'Error generating reflection';
    }
  }
  
  /**
   * Process all post-session channels awaiting continuation
   */
  async processPostSessionChannels(): Promise<number> {
    const channels = await hiveCollaborationService.getPostSessionChannels();
    
    let processed = 0;
    for (const channel of channels) {
      await this.generatePostSessionReflection(channel.id);
      processed++;
      
      // Rate limit
      if (processed < channels.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`[Editor Persona] Processed ${processed} post-session channels`);
    return processed;
  }
  
  // ============================================================================
  // DIRECT EDITOR QUERIES (For Founder Mode)
  // ============================================================================
  
  /**
   * Ask the Editor a direct question (for founder interaction)
   */
  async askEditor(question: string, context?: {
    conversationId?: string;
    targetLanguage?: string;
    additionalContext?: string;
  }): Promise<string> {
    const knowledge = await this.loadKnowledgeContext();
    
    const userPrompt = `
${this.buildKnowledgeContext(knowledge)}

${context?.additionalContext ? `ADDITIONAL CONTEXT:\n${context.additionalContext}\n` : ''}

FOUNDER'S QUESTION:
"${question}"

Please respond as the Editor, drawing on your shared neural network knowledge with Daniela.
Be helpful, specific, and actionable.`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 500,
        system: EDITOR_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: userPrompt }
        ],
      });
      
      const textContent = response.content.find(c => c.type === 'text');
      return textContent?.text || 'No response generated';
    } catch (error) {
      console.error('[Editor Persona] Ask editor error:', error);
      return 'Error processing question';
    }
  }
  
  /**
   * Invalidate knowledge cache (when neural network is updated)
   */
  invalidateCache(): void {
    this.knowledgeCache = null;
    this.cacheExpiry = null;
    console.log('[Editor Persona] Knowledge cache invalidated');
  }
}

// Singleton instance
export const editorPersonaService = new EditorPersonaService();
