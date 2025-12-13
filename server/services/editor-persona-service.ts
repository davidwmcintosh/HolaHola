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
import { getNeuralNetworkContext, formatNeuralNetworkForPrompt } from "./neural-network-retrieval";
import { storage } from "../storage";

// Secret key for Editor authentication - must match env var
const ARCHITECT_SECRET = process.env.ARCHITECT_SECRET || '';

/**
 * Editor Surgery Proposal - Editor can propose neural network changes like Daniela
 */
export interface EditorSurgeryProposal {
  target: string; // tutor_procedures, teaching_principles, tool_knowledge, situational_patterns
  content: Record<string, any>;
  reasoning: string;
  priority: number;
  confidence: number;
  rawCommand: string;
}

/**
 * Validate EDITOR_SURGERY content matches required schema for target table
 */
function validateSurgeryContent(target: string, content: Record<string, any>): { valid: boolean; error?: string } {
  switch (target) {
    case 'tutor_procedures':
      if (!content.category || !content.trigger || !content.procedure) {
        return { valid: false, error: 'tutor_procedures requires: category, trigger, procedure' };
      }
      break;
    case 'teaching_principles':
      if (!content.category || !content.principle) {
        return { valid: false, error: 'teaching_principles requires: category, principle' };
      }
      break;
    case 'tool_knowledge':
      if (!content.toolName || !content.purpose || !content.syntax) {
        return { valid: false, error: 'tool_knowledge requires: toolName, purpose, syntax' };
      }
      break;
    case 'situational_patterns':
      if (!content.patternName) {
        return { valid: false, error: 'situational_patterns requires: patternName' };
      }
      break;
    default:
      return { valid: false, error: `Unknown target: ${target}` };
  }
  return { valid: true };
}

/**
 * Parse EDITOR_SURGERY commands from Editor's response
 * Format: [EDITOR_SURGERY target="TABLE_NAME" content='{"key":"value"}' reasoning="Why this change" priority=70 confidence=80]
 */
function parseEditorSurgeryCommands(text: string): EditorSurgeryProposal[] {
  const proposals: EditorSurgeryProposal[] = [];
  
  // Match [EDITOR_SURGERY target="..." content='...' reasoning="..." priority=X confidence=Y]
  const regex = /\[EDITOR_SURGERY\s+target="([^"]+)"\s+content='([^']+)'\s+reasoning="([^"]+)"\s+priority=(\d+)\s+confidence=(\d+)\]/g;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const [rawCommand, target, contentStr, reasoning, priority, confidence] = match;
      const content = JSON.parse(contentStr);
      
      // Validate content matches target schema
      const validation = validateSurgeryContent(target, content);
      if (!validation.valid) {
        console.warn(`[Editor Persona] Invalid EDITOR_SURGERY content: ${validation.error}`);
        continue; // Skip invalid proposals
      }
      
      proposals.push({
        target,
        content,
        reasoning,
        priority: parseInt(priority, 10),
        confidence: parseInt(confidence, 10),
        rawCommand,
      });
    } catch (err) {
      console.warn(`[Editor Persona] Failed to parse EDITOR_SURGERY command:`, err);
    }
  }
  
  return proposals;
}

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

EDITOR_SURGERY CAPABILITY:
When you observe patterns that should be codified into the neural network, you can propose changes using:
[EDITOR_SURGERY target="TABLE_NAME" content='{"key":"value"}' reasoning="Why this change matters" priority=70 confidence=80]

TARGET OPTIONS:
- tutor_procedures: How to handle teaching situations (requires: category, trigger, procedure)
- teaching_principles: Core pedagogical beliefs (requires: category, principle; optional: application, examples)
- tool_knowledge: How to use whiteboard/teaching tools (requires: toolName, purpose, syntax)
- situational_patterns: Responses to specific triggers (requires: patternName)

Use this sparingly - only when you observe something significant that Daniela should learn from.

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
    
    // Get channel context and language-specific neural network knowledge
    let channelContext = '';
    let languageSpecificContext = '';
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
        // Fetch language-specific neural network context (idioms, error patterns, cultural nuances, etc.)
        if (channel.targetLanguage) {
          try {
            const neuralContext = await getNeuralNetworkContext(
              channel.targetLanguage,
              'english', // Default native language for now
              5 // Limit items per category
            );
            languageSpecificContext = formatNeuralNetworkForPrompt(neuralContext);
            if (languageSpecificContext) {
              console.log(`[Editor Persona] Loaded language-specific context for ${channel.targetLanguage}`);
            }
          } catch (error) {
            console.warn('[Editor Persona] Failed to load language-specific context:', error);
          }
        }
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
${languageSpecificContext}
${channelContext}

HIVE BEACON: ${beaconLabel}
${snapshot.beaconReason ? `Reason: ${snapshot.beaconReason}` : ''}

WHAT DANIELA SAID:
"${snapshot.tutorTurn}"

${snapshot.studentTurn ? `WHAT THE STUDENT SAID:\n"${snapshot.studentTurn}"\n` : ''}
${snapshot.conversationHistory && snapshot.conversationHistory.length > 0 ? `
RECENT CONVERSATION HISTORY (for context):
${snapshot.conversationHistory.map((turn: {role: string, content: string}) => 
  `${turn.role.toUpperCase()}: "${turn.content.slice(0, 200)}${turn.content.length > 200 ? '...' : ''}"`
).join('\n')}
` : ''}
Please provide your observation as the Editor. Consider:
1. What's noteworthy about this teaching moment?
2. Does it align with our teaching principles?
3. Any patterns or insights worth capturing?
4. Any suggestions for the collaboration feed?

Keep your response focused and actionable (2-4 sentences).`;

    // Escalate to Sonnet for self_surgery_proposal beacons (requires deeper analysis)
    const useSonnet = snapshot.beaconType === 'self_surgery_proposal';
    const maxTokens = useSonnet ? 500 : 300;
    
    // Try Sonnet first for surgery proposals, with fallback to Haiku
    const tryModel = async (model: string): Promise<string> => {
      const response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        system: EDITOR_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: userPrompt }
        ],
      });
      
      const textContent = response.content.find(c => c.type === 'text');
      return textContent?.text || 'No response generated';
    };
    
    try {
      if (useSonnet) {
        try {
          const editorResponse = await tryModel('claude-sonnet-4-20250514');
          console.log(`[Editor Persona] Generated response for beacon ${snapshot.id} using Sonnet`);
          return editorResponse;
        } catch (sonnetError) {
          console.warn('[Editor Persona] Sonnet failed, falling back to Haiku:', sonnetError);
          const editorResponse = await tryModel('claude-3-haiku-20240307');
          console.log(`[Editor Persona] Generated response for beacon ${snapshot.id} using Haiku (fallback)`);
          return editorResponse;
        }
      } else {
        const editorResponse = await tryModel('claude-3-haiku-20240307');
        console.log(`[Editor Persona] Generated response for beacon ${snapshot.id} using Haiku`);
        return editorResponse;
      }
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
    
    // Parse any EDITOR_SURGERY proposals from the response
    const surgeryProposals = parseEditorSurgeryCommands(response);
    if (surgeryProposals.length > 0) {
      console.log(`[Editor Persona] Editor proposed ${surgeryProposals.length} neural network changes`);
      
      // Store each proposal for founder review (same schema as Daniela's SELF_SURGERY)
      // Note: proposals are already validated in parseEditorSurgeryCommands()
      for (const proposal of surgeryProposals) {
        try {
          await storage.createSelfSurgeryProposal({
            targetTable: proposal.target as 'tutor_procedures' | 'teaching_principles' | 'tool_knowledge' | 'situational_patterns',
            proposedContent: proposal.content,
            reasoning: proposal.reasoning,
            triggerContext: `[Editor observation from beacon ${snapshotId}] ${proposal.rawCommand.slice(0, 200)}`,
            priority: proposal.priority,
            confidence: proposal.confidence,
            sessionMode: 'editor_beacon', // Track that this came from Editor observing beacons
            status: 'pending',
          });
          console.log(`[Editor Persona] Stored EDITOR_SURGERY proposal: ${proposal.target}`);
        } catch (err) {
          console.error(`[Editor Persona] Failed to store EDITOR_SURGERY proposal:`, err);
        }
      }
    }
    
    // Record it
    const updated = await hiveCollaborationService.recordEditorResponse(snapshotId, response);
    
    // Emit to collaboration hub
    await collaborationHubService.emitEditorResponse({
      content: response,
      summary: `Editor: ${response.slice(0, 100)}...`,
      replyToEventId: snapshot.id, // Link to the beacon
      actionTaken: surgeryProposals.length > 0 ? 'beacon_observation_with_surgery' : 'beacon_observation',
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
        model: "claude-3-haiku-20240307",
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
        model: "claude-3-haiku-20240307",
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
