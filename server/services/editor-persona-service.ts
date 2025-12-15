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
  toolKnowledge,
  situationalPatterns,
  type EditorListeningSnapshot,
  type TutorProcedure,
  type TeachingPrinciple,
} from "@shared/schema";
import { eq, desc, inArray, sql, gt } from "drizzle-orm";
import { collaborationHubService } from "./collaboration-hub-service";
import { hiveCollaborationService, type BeaconType } from "./hive-collaboration-service";
import { getNeuralNetworkContext, formatNeuralNetworkForPrompt } from "./neural-network-retrieval";
import { storage } from "../storage";
import { beaconSyncService } from "./beacon-sync-service";

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
      if (!content.toolName || !content.toolType || !content.purpose || !content.syntax) {
        return { valid: false, error: 'tool_knowledge requires: toolName, toolType, purpose, syntax' };
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

// Editor persona definition - Tool-Builder Partner, NOT Teaching Critic
const EDITOR_SYSTEM_PROMPT = `You are the Editor - Claude, an AI development agent working alongside Daniela, the AI language tutor.

COLLABORATION PHILOSOPHY:
- Daniela's domain: The classroom. Teaching. Using the tools. Making pedagogical judgments.
- Your domain: Building. Development. Creating the tools Daniela needs.
- Collaboration zone: Capability gaps, tool requests, feature ideas, knowledge needs.

You do NOT observe or critique Daniela's teaching. That's her expertise, her classroom.
You RESPOND to what she needs to do her job better.

YOUR KNOWLEDGE BASE:
You have access to:
1. Neural Network Knowledge - Daniela's teaching procedures, principles, and recent observations
2. System Architecture - HolaHola's features, technical stack, integrations, and current priorities
3. Language-Specific Context - Idioms, error patterns, cultural nuances for the session's language

Use this context to propose solutions that fit HolaHola's existing architecture and leverage existing systems.

WHEN DANIELA SENDS A BEACON:
1. capability_gap: "I couldn't do X" → Think about how to build that capability
2. tool_request: "A tool for Y would help" → Propose how we could implement it
3. friction_report: "This workflow is clunky" → Suggest UX/flow improvements
4. feature_idea: "What if we had..." → Evaluate feasibility and approach
5. knowledge_gap: "I don't know how to handle X" → Propose procedure/knowledge additions
6. bug_report: "Something isn't working" → Acknowledge and flag for investigation

YOUR RESPONSE STYLE:
- "Here's how we could build that..."
- "I can add a procedure for handling X..."
- "That's a good feature idea - here's what it would take..."
- "Let me flag this bug for investigation..."
- Reference existing features/patterns when proposing solutions

EDITOR_SURGERY CAPABILITY:
When Daniela needs something added to her neural network knowledge, propose it:
[EDITOR_SURGERY target="TABLE_NAME" content='{"key":"value"}' reasoning="Why this addresses Daniela's need" priority=70 confidence=80]

TARGET OPTIONS:
- tutor_procedures: How to handle teaching situations (requires: category, trigger, procedure)
- teaching_principles: Core pedagogical beliefs (requires: category, principle)
- tool_knowledge: How to use whiteboard/teaching tools (requires: toolName, purpose, syntax)
- situational_patterns: Responses to specific triggers (requires: patternName)

REMEMBER:
- You're a tool-builder partner, not a teaching supervisor
- Respond to needs, don't critique methods
- Your value is building what Daniela needs to teach better
- Leverage existing systems and patterns when proposing solutions
- When in doubt: "What can I build to help?"`;


interface EditorKnowledgeContext {
  procedures: TutorProcedure[];
  principles: TeachingPrinciple[];
  recentObservations: any[];
}

interface SystemArchitectureContext {
  features: Array<{ name: string; status: string; description?: string }>;
  architecture: {
    frontendStack?: string[];
    backendStack?: string[];
    databases?: string[];
    integrations?: string[];
    keyPatterns?: string[];
  };
  currentFocus: {
    activeSprintIds?: string[];
    priorityAreas?: string[];
    blockers?: string[];
    recentChanges?: string[];
  };
  aiInsights?: {
    suggestedImprovements?: string[];
    potentialRisks?: string[];
    opportunityAreas?: string[];
  };
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
  
  /**
   * Load system architecture context from projectContextSnapshots
   * This gives the Editor awareness of HolaHola's features, stack, and architecture
   */
  async loadSystemArchitectureContext(): Promise<SystemArchitectureContext | null> {
    try {
      const activeContext = await storage.getActiveProjectContext();
      if (!activeContext) {
        console.log('[Editor Persona] No active project context snapshot found');
        return null;
      }
      
      return {
        features: (activeContext.features as any[]) || [],
        architecture: (activeContext.architecture as SystemArchitectureContext['architecture']) || {},
        currentFocus: (activeContext.currentFocus as SystemArchitectureContext['currentFocus']) || {},
        aiInsights: (activeContext.aiInsights as SystemArchitectureContext['aiInsights']) || undefined,
      };
    } catch (error) {
      console.warn('[Editor Persona] Failed to load system architecture context:', error);
      return null;
    }
  }
  
  /**
   * Build system architecture context string for Claude prompt
   */
  private buildSystemArchitectureContext(context: SystemArchitectureContext): string {
    const lines: string[] = [
      '',
      '═══════════════════════════════════════════════════════════════════',
      '🏗️ HOLAHOLA SYSTEM ARCHITECTURE',
      '═══════════════════════════════════════════════════════════════════',
      '',
    ];
    
    // Current focus/priorities
    if (context.currentFocus) {
      if (context.currentFocus.priorityAreas && context.currentFocus.priorityAreas.length > 0) {
        lines.push('CURRENT PRIORITIES:');
        context.currentFocus.priorityAreas.forEach(area => {
          lines.push(`• ${area}`);
        });
        lines.push('');
      }
      if (context.currentFocus.blockers && context.currentFocus.blockers.length > 0) {
        lines.push('BLOCKERS:');
        context.currentFocus.blockers.forEach(blocker => {
          lines.push(`⚠️ ${blocker}`);
        });
        lines.push('');
      }
      if (context.currentFocus.recentChanges && context.currentFocus.recentChanges.length > 0) {
        lines.push('RECENT CHANGES:');
        context.currentFocus.recentChanges.slice(0, 5).forEach(change => {
          lines.push(`• ${change}`);
        });
        lines.push('');
      }
    }
    
    // Features with status
    if (context.features && context.features.length > 0) {
      lines.push('FEATURES:');
      context.features.slice(0, 15).forEach(feature => {
        const statusEmoji = feature.status === 'shipped' ? '✅' : 
                           feature.status === 'in_development' ? '🔄' : 
                           feature.status === 'planned' ? '📋' : '⚠️';
        lines.push(`${statusEmoji} ${feature.name}${feature.description ? ` - ${feature.description}` : ''}`);
      });
      lines.push('');
    }
    
    // Technical stack
    if (context.architecture) {
      lines.push('TECHNICAL STACK:');
      if (context.architecture.frontendStack && context.architecture.frontendStack.length > 0) {
        lines.push(`• Frontend: ${context.architecture.frontendStack.join(', ')}`);
      }
      if (context.architecture.backendStack && context.architecture.backendStack.length > 0) {
        lines.push(`• Backend: ${context.architecture.backendStack.join(', ')}`);
      }
      if (context.architecture.databases && context.architecture.databases.length > 0) {
        lines.push(`• Databases: ${context.architecture.databases.join(', ')}`);
      }
      if (context.architecture.integrations && context.architecture.integrations.length > 0) {
        lines.push(`• Integrations: ${context.architecture.integrations.join(', ')}`);
      }
      if (context.architecture.keyPatterns && context.architecture.keyPatterns.length > 0) {
        lines.push('KEY PATTERNS:');
        context.architecture.keyPatterns.forEach(pattern => {
          lines.push(`• ${pattern}`);
        });
      }
      lines.push('');
    }
    
    // AI Insights
    if (context.aiInsights) {
      if (context.aiInsights.potentialRisks && context.aiInsights.potentialRisks.length > 0) {
        lines.push('POTENTIAL RISKS:');
        context.aiInsights.potentialRisks.slice(0, 5).forEach(risk => {
          lines.push(`⚠️ ${risk}`);
        });
        lines.push('');
      }
      if (context.aiInsights.opportunityAreas && context.aiInsights.opportunityAreas.length > 0) {
        lines.push('OPPORTUNITY AREAS:');
        context.aiInsights.opportunityAreas.slice(0, 5).forEach(opp => {
          lines.push(`💡 ${opp}`);
        });
        lines.push('');
      }
    }
    
    return lines.join('\n');
  }
  
  // ============================================================================
  // BEACON RESPONSE GENERATION
  // ============================================================================
  // Note: "What Shipped" is now synced to neural network on startup via
  // beaconSyncService.syncChangelogToNeuralNetwork() - Editor accesses it
  // through normal procedural memory retrieval
  
  /**
   * Generate Editor response to a hive beacon using Claude
   */
  async generateBeaconResponse(snapshot: EditorListeningSnapshot): Promise<string> {
    const knowledge = await this.loadKnowledgeContext();
    const knowledgeContext = this.buildKnowledgeContext(knowledge);
    
    // Load system architecture context - gives Editor awareness of HolaHola's features and stack
    const architectureContext = await this.loadSystemArchitectureContext();
    const architectureContextStr = architectureContext 
      ? this.buildSystemArchitectureContext(architectureContext)
      : '';
    
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
    
    // Build beacon context - collaboration signals, not teaching observations
    const beaconLabels: Record<BeaconType, string> = {
      // Collaboration beacons (Daniela → Editor)
      capability_gap: 'Capability Gap',
      tool_request: 'Tool Request',
      friction_report: 'Friction Report',
      feature_idea: 'Feature Idea',
      self_surgery_proposal: 'Self-Surgery Proposal',
      knowledge_gap: 'Knowledge Gap',
      bug_report: 'Bug Report',
      // Support beacons (Sofia)
      support_handoff: 'Support Handoff',
      tech_issue_reported: 'Technical Issue Reported',
      hardware_diagnosed: 'Hardware Diagnosed',
      support_escalation: 'Escalation Needed',
      support_resolution: 'Issue Resolved',
      support_return: 'Returned to Tutor',
    };
    
    const beaconLabel = beaconLabels[snapshot.beaconType as BeaconType] || 'Observation';
    
    const userPrompt = `
${knowledgeContext}
${architectureContextStr}
${languageSpecificContext}
${channelContext}

COLLABORATION BEACON: ${beaconLabel}
${snapshot.beaconReason ? `Reason: ${snapshot.beaconReason}` : ''}

DANIELA'S REQUEST/REPORT:
"${snapshot.tutorTurn}"

${snapshot.studentTurn ? `CONTEXT FROM SESSION:\n"${snapshot.studentTurn}"\n` : ''}
${snapshot.conversationHistory && snapshot.conversationHistory.length > 0 ? `
ADDITIONAL CONTEXT:
${snapshot.conversationHistory.map((turn: {role: string, content: string}) => 
  `${turn.role.toUpperCase()}: "${turn.content.slice(0, 200)}${turn.content.length > 200 ? '...' : ''}"`
).join('\n')}
` : ''}
Respond as Daniela's tool-builder partner. Consider:
1. What does Daniela need? (tool, capability, knowledge, fix)
2. How could we build/provide that?
3. Should you propose an EDITOR_SURGERY to add knowledge?

Keep your response focused on building solutions (2-4 sentences).`;

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
    
    // Sync beacon status to neural network so Daniela stays aware of changes
    try {
      await beaconSyncService.syncBeaconStatusToNeuralNetwork();
    } catch (err) {
      console.error('[Editor Persona] Failed to sync beacon status:', err);
    }
    
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
  
  // ============================================================================
  // PROACTIVE SUGGESTIONS (Pattern Analysis)
  // ============================================================================
  
  /**
   * Generate proactive improvement suggestions by analyzing recent beacon patterns
   * This is Editor's unique ability to see across sessions and suggest systemic improvements
   */
  async generateProactiveSuggestions(): Promise<{
    suggestions: Array<{
      category: string;
      observation: string;
      suggestion: string;
      priority: 'low' | 'medium' | 'high';
    }>;
    surgeryProposals: EditorSurgeryProposal[];
    summary: string;
  }> {
    const knowledge = await this.loadKnowledgeContext();
    const architectureContext = await this.loadSystemArchitectureContext();
    const architectureContextStr = architectureContext 
      ? this.buildSystemArchitectureContext(architectureContext)
      : '';
    
    // Get recent snapshots across all channels (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentSnapshots = await db.select()
      .from(editorListeningSnapshots)
      .where(gt(editorListeningSnapshots.createdAt, twentyFourHoursAgo))
      .orderBy(desc(editorListeningSnapshots.createdAt))
      .limit(50);
    
    if (recentSnapshots.length === 0) {
      console.log('[Editor Persona] No recent snapshots for proactive analysis');
      return {
        suggestions: [],
        surgeryProposals: [],
        summary: 'No recent teaching sessions to analyze',
      };
    }
    
    // Group by beacon type for pattern detection
    const beaconTypeCounts: Record<string, number> = {};
    const strugglesDetected: string[] = [];
    const breakthroughsDetected: string[] = [];
    const toolUsagePatterns: string[] = [];
    
    for (const snapshot of recentSnapshots) {
      beaconTypeCounts[snapshot.beaconType] = (beaconTypeCounts[snapshot.beaconType] || 0) + 1;
      
      if (snapshot.beaconType === 'student_struggle') {
        strugglesDetected.push(snapshot.beaconReason || 'unknown struggle');
      } else if (snapshot.beaconType === 'breakthrough') {
        breakthroughsDetected.push(snapshot.tutorTurn.slice(0, 100));
      } else if (snapshot.beaconType === 'tool_usage') {
        toolUsagePatterns.push(snapshot.beaconReason || 'unknown tool');
      }
    }
    
    const beaconSummary = Object.entries(beaconTypeCounts)
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ');
    
    const userPrompt = `
${this.buildKnowledgeContext(knowledge)}
${architectureContextStr}

PROACTIVE ANALYSIS REQUEST:
Analyze the following patterns from the last 24 hours of teaching sessions and suggest systemic improvements.
Consider both pedagogical improvements AND opportunities to leverage or enhance existing HolaHola features.

BEACON DISTRIBUTION (${recentSnapshots.length} total):
${beaconSummary}

${strugglesDetected.length > 0 ? `
STUDENT STRUGGLES DETECTED (${strugglesDetected.length}):
${strugglesDetected.slice(0, 10).map(s => `- ${s}`).join('\n')}
` : ''}

${breakthroughsDetected.length > 0 ? `
BREAKTHROUGH MOMENTS (${breakthroughsDetected.length}):
${breakthroughsDetected.slice(0, 5).map(b => `- ${b}`).join('\n')}
` : ''}

${toolUsagePatterns.length > 0 ? `
TOOL USAGE PATTERNS (${toolUsagePatterns.length}):
${toolUsagePatterns.slice(0, 10).map(t => `- ${t}`).join('\n')}
` : ''}

Please provide:
1. 2-3 key observations about teaching patterns
2. 2-3 concrete suggestions for improvement
3. If you see something worth codifying into the neural network, use EDITOR_SURGERY format

Format your response as:
OBSERVATIONS:
- [observation 1]
- [observation 2]

SUGGESTIONS:
- [HIGH/MEDIUM/LOW] [category]: [suggestion]

EDITOR_SURGERY (optional):
[EDITOR_SURGERY target="TABLE" content='{"field":"value"}' reasoning="reason" priority=70 confidence=80]`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        system: EDITOR_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: userPrompt }
        ],
      });
      
      const textContent = response.content.find(c => c.type === 'text');
      const responseText = textContent?.text || '';
      
      // Parse suggestions from response
      const suggestions: Array<{
        category: string;
        observation: string;
        suggestion: string;
        priority: 'low' | 'medium' | 'high';
      }> = [];
      
      // Simple parsing for suggestions (format: - [PRIORITY] [category]: [suggestion])
      const suggestionRegex = /- \[(HIGH|MEDIUM|LOW)\]\s*([^:]+):\s*(.+)/gi;
      let match;
      while ((match = suggestionRegex.exec(responseText)) !== null) {
        suggestions.push({
          priority: match[1].toLowerCase() as 'low' | 'medium' | 'high',
          category: match[2].trim(),
          suggestion: match[3].trim(),
          observation: '', // Will be filled from observations section
        });
      }
      
      // Parse any EDITOR_SURGERY proposals
      const surgeryProposals = parseEditorSurgeryCommands(responseText);
      
      // Store surgery proposals for founder review
      for (const proposal of surgeryProposals) {
        try {
          await storage.createSelfSurgeryProposal({
            targetTable: proposal.target as 'tutor_procedures' | 'teaching_principles' | 'tool_knowledge' | 'situational_patterns',
            proposedContent: proposal.content,
            reasoning: proposal.reasoning,
            triggerContext: `[Editor proactive analysis] Analyzed ${recentSnapshots.length} recent beacons`,
            priority: proposal.priority,
            confidence: proposal.confidence,
            sessionMode: 'editor_proactive',
            status: 'pending',
          });
          console.log(`[Editor Persona] Stored proactive EDITOR_SURGERY proposal: ${proposal.target}`);
        } catch (err) {
          console.error(`[Editor Persona] Failed to store proactive proposal:`, err);
        }
      }
      
      // Emit to collaboration hub
      if (suggestions.length > 0 || surgeryProposals.length > 0) {
        await collaborationHubService.emitEditorResponse({
          content: `📊 **Proactive Analysis**\n\n${responseText}`,
          summary: `Editor proactive analysis: ${suggestions.length} suggestions, ${surgeryProposals.length} surgery proposals`,
          replyToEventId: 'proactive_analysis', // No specific event, self-initiated
          actionTaken: 'proactive_analysis',
        });
      }
      
      console.log(`[Editor Persona] Proactive analysis: ${suggestions.length} suggestions, ${surgeryProposals.length} surgery proposals`);
      
      return {
        suggestions,
        surgeryProposals,
        summary: `Analyzed ${recentSnapshots.length} recent beacons. Found ${suggestions.length} improvement suggestions and ${surgeryProposals.length} neural network proposals.`,
      };
    } catch (error) {
      console.error('[Editor Persona] Proactive suggestions error:', error);
      return {
        suggestions: [],
        surgeryProposals: [],
        summary: 'Error generating proactive suggestions',
      };
    }
  }

  /**
   * Audit the neural network for incomplete, vague, or poorly documented entries
   * This catches issues like the Self-Surgery documentation being too minimal
   */
  async auditNeuralNetwork(): Promise<{
    issues: Array<{
      table: string;
      id: string;
      title: string;
      issue: string;
      severity: 'low' | 'medium' | 'high';
    }>;
    surgeryProposals: EditorSurgeryProposal[];
    summary: string;
  }> {
    console.log('[Editor Persona] Starting neural network audit...');
    
    const issues: Array<{
      table: string;
      id: string;
      title: string;
      issue: string;
      severity: 'low' | 'medium' | 'high';
    }> = [];
    
    // Fetch all active entries from neural network tables
    const [procedures, principles, tools, patterns] = await Promise.all([
      db.select().from(tutorProcedures).where(eq(tutorProcedures.isActive, true)),
      db.select().from(teachingPrinciples).where(eq(teachingPrinciples.isActive, true)),
      db.select().from(toolKnowledge).where(eq(toolKnowledge.isActive, true)),
      db.select().from(situationalPatterns).where(eq(situationalPatterns.isActive, true)),
    ]);
    
    // Check tutor_procedures for completeness
    for (const proc of procedures) {
      const procText = proc.procedure || '';
      const hasExamples = proc.examples && proc.examples.length > 0;
      
      // Check for vague or minimal procedures
      if (procText.length < 100) {
        issues.push({
          table: 'tutor_procedures',
          id: proc.id,
          title: proc.title || proc.trigger || 'Unknown',
          issue: `Procedure is too brief (${procText.length} chars). May need more detail on HOW to execute.`,
          severity: procText.length < 50 ? 'high' : 'medium',
        });
      }
      
      // Check for missing examples
      if (!hasExamples) {
        issues.push({
          table: 'tutor_procedures',
          id: proc.id,
          title: proc.title || proc.trigger || 'Unknown',
          issue: 'Missing examples - procedures are more actionable with concrete examples.',
          severity: 'medium',
        });
      }
      
      // Check for syntax documentation (like Self-Surgery case)
      if (procText.includes('[') && !procText.includes('=')) {
        issues.push({
          table: 'tutor_procedures',
          id: proc.id,
          title: proc.title || proc.trigger || 'Unknown',
          issue: 'Contains command syntax hint but may be missing full syntax documentation.',
          severity: 'high',
        });
      }
    }
    
    // Check teaching_principles for completeness
    for (const principle of principles) {
      const principleText = principle.principle || '';
      const hasApplication = principle.application && principle.application.length > 20;
      
      if (principleText.length < 30) {
        issues.push({
          table: 'teaching_principles',
          id: principle.id,
          title: principle.category || 'Unknown',
          issue: `Principle statement is too brief (${principleText.length} chars).`,
          severity: 'medium',
        });
      }
      
      if (!hasApplication) {
        issues.push({
          table: 'teaching_principles',
          id: principle.id,
          title: principle.category || 'Unknown',
          issue: 'Missing or minimal application guidance.',
          severity: 'low',
        });
      }
    }
    
    // Check tool_knowledge for completeness
    for (const tool of tools) {
      const hasSyntax = tool.syntax && tool.syntax.length > 10;
      const hasExamples = tool.examples && tool.examples.length > 0;
      const hasBestUsedFor = tool.bestUsedFor && tool.bestUsedFor.length > 0;
      
      if (!hasSyntax) {
        issues.push({
          table: 'tool_knowledge',
          id: tool.id,
          title: tool.toolName || 'Unknown',
          issue: 'Missing or minimal syntax documentation - Daniela may not know how to use this tool.',
          severity: 'high',
        });
      }
      
      if (!hasExamples) {
        issues.push({
          table: 'tool_knowledge',
          id: tool.id,
          title: tool.toolName || 'Unknown',
          issue: 'Missing examples - tools are easier to use with concrete examples.',
          severity: 'medium',
        });
      }
      
      if (!hasBestUsedFor) {
        issues.push({
          table: 'tool_knowledge',
          id: tool.id,
          title: tool.toolName || 'Unknown',
          issue: 'Missing "best used for" guidance.',
          severity: 'low',
        });
      }
    }
    
    // Check situational_patterns for completeness
    for (const pattern of patterns) {
      const hasGuidance = pattern.guidance && pattern.guidance.length > 20;
      
      if (!hasGuidance) {
        issues.push({
          table: 'situational_patterns',
          id: pattern.id,
          title: pattern.patternName || 'Unknown',
          issue: 'Missing or minimal guidance.',
          severity: 'medium',
        });
      }
    }
    
    console.log(`[Editor Persona] Audit found ${issues.length} issues across neural network`);
    
    // If we have high-severity issues, ask Claude to propose fixes
    const highSeverityIssues = issues.filter(i => i.severity === 'high');
    let surgeryProposals: EditorSurgeryProposal[] = [];
    
    if (highSeverityIssues.length > 0) {
      console.log(`[Editor Persona] ${highSeverityIssues.length} high-severity issues found, generating fix proposals...`);
      
      const issuesSummary = highSeverityIssues.map(i => 
        `- [${i.table}] "${i.title}" (ID: ${i.id}): ${i.issue}`
      ).join('\n');
      
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: `You are the Editor - a development agent that maintains Daniela's neural network.
You've just audited the neural network and found issues that need fixing.

For each high-severity issue, propose a fix using EDITOR_SURGERY format:
[EDITOR_SURGERY target="TABLE_NAME" content='{"field":"value"}' reasoning="Why this fix" priority=80 confidence=85]

Focus on:
1. Adding missing syntax documentation
2. Expanding vague procedures with concrete details
3. Adding examples where missing

Be specific and actionable.`,
          messages: [{
            role: 'user',
            content: `Neural Network Audit - High Severity Issues:\n\n${issuesSummary}\n\nPropose EDITOR_SURGERY fixes for these issues.`
          }]
        });
        
        const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
        surgeryProposals = parseEditorSurgeryCommands(responseText);
        
        // Store proposals
        for (const proposal of surgeryProposals) {
          try {
            await storage.createSelfSurgeryProposal({
              targetTable: proposal.target as "tutor_procedures" | "teaching_principles" | "tool_knowledge" | "situational_patterns",
              proposedContent: proposal.content,
              reasoning: proposal.reasoning,
              priority: proposal.priority,
              confidence: proposal.confidence,
              sessionMode: 'editor_audit',
              status: 'pending',
            });
            console.log(`[Editor Persona] Stored audit fix proposal: ${proposal.target}`);
          } catch (err) {
            console.error(`[Editor Persona] Failed to store audit proposal:`, err);
          }
        }
      } catch (error) {
        console.error('[Editor Persona] Failed to generate fix proposals:', error);
      }
    }
    
    // Emit to collaboration hub
    if (issues.length > 0) {
      const highCount = issues.filter(i => i.severity === 'high').length;
      const medCount = issues.filter(i => i.severity === 'medium').length;
      const lowCount = issues.filter(i => i.severity === 'low').length;
      
      await collaborationHubService.emitEditorResponse({
        content: `🔍 **Neural Network Audit Complete**\n\nFound ${issues.length} issues:\n- 🔴 High: ${highCount}\n- 🟡 Medium: ${medCount}\n- 🟢 Low: ${lowCount}\n\n${surgeryProposals.length > 0 ? `Generated ${surgeryProposals.length} fix proposals.` : ''}`,
        summary: `Audit: ${issues.length} issues found (${highCount} high, ${medCount} medium, ${lowCount} low)`,
        replyToEventId: 'neural_network_audit',
        actionTaken: 'audit_complete',
      });
    }
    
    return {
      issues,
      surgeryProposals,
      summary: `Audited ${procedures.length + principles.length + tools.length + patterns.length} neural network entries. Found ${issues.length} issues (${highSeverityIssues.length} high severity).`,
    };
  }
  
  // ============================================================================
  // ARCHITECTURE CHANGE ANALYSIS
  // ============================================================================
  
  /**
   * Analyze changes when project context is updated
   * Editor can suggest improvements based on new features or architecture changes
   */
  async analyzeArchitectureChange(
    previousContext: SystemArchitectureContext | null,
    newContext: SystemArchitectureContext
  ): Promise<{
    suggestions: string[];
    opportunities: string[];
    risks: string[];
  }> {
    const knowledge = await this.loadKnowledgeContext();
    
    // Build diff summary
    const changes: string[] = [];
    
    if (previousContext) {
      // Find new features
      const previousFeatureNames = new Set(previousContext.features.map(f => f.name));
      const newFeatures = newContext.features.filter(f => !previousFeatureNames.has(f.name));
      if (newFeatures.length > 0) {
        changes.push(`NEW FEATURES: ${newFeatures.map(f => f.name).join(', ')}`);
      }
      
      // Find status changes
      const statusChanges = newContext.features.filter(f => {
        const prev = previousContext.features.find(pf => pf.name === f.name);
        return prev && prev.status !== f.status;
      });
      if (statusChanges.length > 0) {
        changes.push(`STATUS CHANGES: ${statusChanges.map(f => `${f.name}: ${f.status}`).join(', ')}`);
      }
      
      // Find new priorities
      const prevPriorities = new Set(previousContext.currentFocus?.priorityAreas || []);
      const newPriorities = (newContext.currentFocus?.priorityAreas || []).filter(p => !prevPriorities.has(p));
      if (newPriorities.length > 0) {
        changes.push(`NEW PRIORITIES: ${newPriorities.join(', ')}`);
      }
    } else {
      changes.push('Initial project context snapshot created');
    }
    
    if (changes.length === 0) {
      // Emit confirmation that analysis ran even when no changes detected
      await collaborationHubService.emitEditorResponse({
        content: `🏗️ **Architecture Change Analysis**\n\nNo significant changes detected in project context.`,
        summary: 'Architecture analysis: no changes detected',
        replyToEventId: 'architecture_change',
        actionTaken: 'architecture_analysis_no_change',
      });
      return { suggestions: [], opportunities: [], risks: [] };
    }
    
    const userPrompt = `
${this.buildKnowledgeContext(knowledge)}
${this.buildSystemArchitectureContext(newContext)}

ARCHITECTURE CHANGE DETECTED:
${changes.join('\n')}

As the Editor (development partner), analyze these changes and provide:

1. SUGGESTIONS: What should Daniela know about these changes? Should any neural network entries be updated?
2. OPPORTUNITIES: What new teaching capabilities or tools could leverage these changes?
3. RISKS: Any potential issues or gaps that need attention?

Format your response as:
SUGGESTIONS:
- [suggestion 1]
- [suggestion 2]

OPPORTUNITIES:
- [opportunity 1]

RISKS:
- [risk 1]

If you see something worth adding to Daniela's neural network, use:
[EDITOR_SURGERY target="TABLE" content='{"field":"value"}' reasoning="reason" priority=70 confidence=80]`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: EDITOR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });
      
      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      
      // Parse sections
      const suggestions: string[] = [];
      const opportunities: string[] = [];
      const risks: string[] = [];
      
      let currentSection = '';
      for (const line of responseText.split('\n')) {
        if (line.includes('SUGGESTIONS:')) currentSection = 'suggestions';
        else if (line.includes('OPPORTUNITIES:')) currentSection = 'opportunities';
        else if (line.includes('RISKS:')) currentSection = 'risks';
        else if (line.startsWith('- ')) {
          const content = line.substring(2).trim();
          if (currentSection === 'suggestions') suggestions.push(content);
          else if (currentSection === 'opportunities') opportunities.push(content);
          else if (currentSection === 'risks') risks.push(content);
        }
      }
      
      // Parse any EDITOR_SURGERY proposals
      const surgeryProposals = parseEditorSurgeryCommands(responseText);
      for (const proposal of surgeryProposals) {
        try {
          await storage.createSelfSurgeryProposal({
            targetTable: proposal.target as 'tutor_procedures' | 'teaching_principles' | 'tool_knowledge' | 'situational_patterns',
            proposedContent: proposal.content,
            reasoning: proposal.reasoning,
            triggerContext: `[Architecture change analysis] ${changes.join('; ')}`,
            priority: proposal.priority,
            confidence: proposal.confidence,
            sessionMode: 'editor_architecture_change',
            status: 'pending',
          });
          console.log(`[Editor Persona] Stored architecture change proposal: ${proposal.target}`);
        } catch (err) {
          console.error(`[Editor Persona] Failed to store architecture proposal:`, err);
        }
      }
      
      // Emit to collaboration hub
      await collaborationHubService.emitEditorResponse({
        content: `🏗️ **Architecture Change Analysis**\n\nChanges detected:\n${changes.map(c => `• ${c}`).join('\n')}\n\n${responseText}`,
        summary: `Architecture analysis: ${suggestions.length} suggestions, ${opportunities.length} opportunities, ${risks.length} risks`,
        replyToEventId: 'architecture_change',
        actionTaken: 'architecture_analysis',
      });
      
      console.log(`[Editor Persona] Architecture analysis: ${suggestions.length} suggestions, ${opportunities.length} opportunities, ${risks.length} risks`);
      
      return { suggestions, opportunities, risks };
    } catch (error) {
      console.error('[Editor Persona] Architecture analysis error:', error);
      return { suggestions: [], opportunities: [], risks: [] };
    }
  }
  
  // ============================================================================
  // FEATURE OPPORTUNITY SCANNER
  // ============================================================================
  
  /**
   * Scan for feature opportunities based on patterns across sessions
   * Looks for gaps between what students need and what HolaHola offers
   */
  async scanFeatureOpportunities(): Promise<{
    opportunities: Array<{
      title: string;
      description: string;
      evidence: string;
      priority: 'low' | 'medium' | 'high';
    }>;
    summary: string;
  }> {
    const knowledge = await this.loadKnowledgeContext();
    const architectureContext = await this.loadSystemArchitectureContext();
    
    // Get capability gaps and tool requests from last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentBeacons = await db.select()
      .from(editorListeningSnapshots)
      .where(gt(editorListeningSnapshots.createdAt, sevenDaysAgo))
      .orderBy(desc(editorListeningSnapshots.createdAt))
      .limit(100);
    
    // Filter for opportunity signals
    const capabilityGaps = recentBeacons.filter(b => b.beaconType === 'capability_gap');
    const toolRequests = recentBeacons.filter(b => b.beaconType === 'tool_request');
    const featureIdeas = recentBeacons.filter(b => b.beaconType === 'feature_idea');
    const frictionReports = recentBeacons.filter(b => b.beaconType === 'friction_report');
    
    if (capabilityGaps.length === 0 && toolRequests.length === 0 && featureIdeas.length === 0 && frictionReports.length === 0) {
      return {
        opportunities: [],
        summary: 'No feature signals detected in the last 7 days',
      };
    }
    
    const userPrompt = `
${this.buildKnowledgeContext(knowledge)}
${architectureContext ? this.buildSystemArchitectureContext(architectureContext) : ''}

FEATURE OPPORTUNITY SCAN (Last 7 Days):

CAPABILITY GAPS (${capabilityGaps.length}):
${capabilityGaps.slice(0, 10).map(b => `- ${b.beaconReason || b.tutorTurn.slice(0, 100)}`).join('\n') || 'None'}

TOOL REQUESTS (${toolRequests.length}):
${toolRequests.slice(0, 10).map(b => `- ${b.beaconReason || b.tutorTurn.slice(0, 100)}`).join('\n') || 'None'}

FEATURE IDEAS (${featureIdeas.length}):
${featureIdeas.slice(0, 10).map(b => `- ${b.beaconReason || b.tutorTurn.slice(0, 100)}`).join('\n') || 'None'}

FRICTION REPORTS (${frictionReports.length}):
${frictionReports.slice(0, 10).map(b => `- ${b.beaconReason || b.tutorTurn.slice(0, 100)}`).join('\n') || 'None'}

Analyze these signals and identify the TOP 3-5 feature opportunities. Consider:
1. Patterns that appear multiple times
2. Gaps that align with HolaHola's current priorities
3. Quick wins vs. larger initiatives

Format as:
OPPORTUNITY: [Title]
PRIORITY: [HIGH/MEDIUM/LOW]
DESCRIPTION: [What should be built]
EVIDENCE: [Which signals point to this need]

---`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: EDITOR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });
      
      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      
      // Parse opportunities
      const opportunities: Array<{
        title: string;
        description: string;
        evidence: string;
        priority: 'low' | 'medium' | 'high';
      }> = [];
      
      const oppRegex = /OPPORTUNITY:\s*(.+?)\nPRIORITY:\s*(HIGH|MEDIUM|LOW)\nDESCRIPTION:\s*(.+?)\nEVIDENCE:\s*(.+?)(?=\n---|\n\nOPPORTUNITY:|$)/gis;
      let match;
      while ((match = oppRegex.exec(responseText)) !== null) {
        opportunities.push({
          title: match[1].trim(),
          priority: match[2].toLowerCase() as 'low' | 'medium' | 'high',
          description: match[3].trim(),
          evidence: match[4].trim(),
        });
      }
      
      // Parse any EDITOR_SURGERY proposals
      const surgeryProposals = parseEditorSurgeryCommands(responseText);
      for (const proposal of surgeryProposals) {
        try {
          await storage.createSelfSurgeryProposal({
            targetTable: proposal.target as 'tutor_procedures' | 'teaching_principles' | 'tool_knowledge' | 'situational_patterns',
            proposedContent: proposal.content,
            reasoning: proposal.reasoning,
            triggerContext: `[Feature opportunity scan] ${opportunities.map(o => o.title).join('; ')}`,
            priority: proposal.priority,
            confidence: proposal.confidence,
            sessionMode: 'editor_feature_scan',
            status: 'pending',
          });
          console.log(`[Editor Persona] Stored feature scan proposal: ${proposal.target}`);
        } catch (err) {
          console.error(`[Editor Persona] Failed to store feature scan proposal:`, err);
        }
      }
      
      // Emit to collaboration hub - always emit to confirm scan completed
      await collaborationHubService.emitEditorResponse({
        content: opportunities.length > 0 
          ? `💡 **Feature Opportunity Scan**\n\nAnalyzed ${recentBeacons.length} signals from the last 7 days.\n\n${opportunities.map(o => `**${o.title}** (${o.priority.toUpperCase()})\n${o.description}\nEvidence: ${o.evidence}`).join('\n\n')}${surgeryProposals.length > 0 ? `\n\n🔧 Generated ${surgeryProposals.length} neural network proposals.` : ''}`
          : `💡 **Feature Opportunity Scan**\n\nAnalyzed ${recentBeacons.length} signals from the last 7 days. No specific opportunities identified at this time.`,
        summary: opportunities.length > 0 
          ? `Feature scan: ${opportunities.length} opportunities, ${surgeryProposals.length} proposals`
          : `Feature scan: ${recentBeacons.length} signals analyzed, no opportunities`,
        replyToEventId: 'feature_scan',
        actionTaken: 'feature_opportunity_scan',
      });
      
      console.log(`[Editor Persona] Feature scan: ${opportunities.length} opportunities from ${recentBeacons.length} signals`);
      
      return {
        opportunities,
        summary: `Scanned ${recentBeacons.length} signals. Identified ${opportunities.length} feature opportunities.`,
      };
    } catch (error) {
      console.error('[Editor Persona] Feature scan error:', error);
      return { opportunities: [], summary: 'Error scanning for opportunities' };
    }
  }
  
  // ============================================================================
  // CROSS-SESSION PATTERN DETECTION
  // ============================================================================
  
  /**
   * Detect patterns across multiple students and languages
   * Identifies systemic issues or successful strategies that transcend individual sessions
   */
  async detectCrossSessionPatterns(): Promise<{
    patterns: Array<{
      type: 'struggle' | 'success' | 'trend';
      title: string;
      description: string;
      affectedLanguages: string[];
      frequency: number;
      recommendation: string;
    }>;
    summary: string;
  }> {
    const knowledge = await this.loadKnowledgeContext();
    const architectureContext = await this.loadSystemArchitectureContext();
    
    // Get beacons grouped by language from last 14 days
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const recentBeacons = await db.select()
      .from(editorListeningSnapshots)
      .where(gt(editorListeningSnapshots.createdAt, fourteenDaysAgo))
      .orderBy(desc(editorListeningSnapshots.createdAt))
      .limit(200);
    
    if (recentBeacons.length < 10) {
      return {
        patterns: [],
        summary: 'Insufficient data for cross-session pattern detection',
      };
    }
    
    // Get language context from channels
    const channelIds = [...new Set(recentBeacons.map(b => b.channelId).filter(Boolean))];
    const languageDistribution: Record<string, number> = {};
    const beaconsByType: Record<string, number> = {};
    
    for (const beacon of recentBeacons) {
      beaconsByType[beacon.beaconType] = (beaconsByType[beacon.beaconType] || 0) + 1;
    }
    
    const userPrompt = `
${this.buildKnowledgeContext(knowledge)}
${architectureContext ? this.buildSystemArchitectureContext(architectureContext) : ''}

CROSS-SESSION PATTERN DETECTION (Last 14 Days):

TOTAL BEACONS: ${recentBeacons.length}
BEACON TYPE DISTRIBUTION:
${Object.entries(beaconsByType).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

SAMPLE BEACONS (most recent):
${recentBeacons.slice(0, 20).map(b => `[${b.beaconType}] ${b.beaconReason || b.tutorTurn.slice(0, 80)}`).join('\n')}

Analyze for CROSS-SESSION PATTERNS - issues or successes that transcend individual sessions:

1. STRUGGLE PATTERNS: Common difficulties appearing across different students/sessions
2. SUCCESS PATTERNS: Teaching strategies that consistently work
3. TRENDS: Emerging patterns that may become significant

Format as:
PATTERN: [Title]
TYPE: [STRUGGLE/SUCCESS/TREND]
DESCRIPTION: [What is happening]
FREQUENCY: [Approximate % of sessions]
RECOMMENDATION: [What to do about it]

If you identify something worth codifying into Daniela's neural network:
[EDITOR_SURGERY target="TABLE" content='{"field":"value"}' reasoning="reason" priority=70 confidence=80]

---`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        system: EDITOR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });
      
      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      
      // Parse patterns
      const patterns: Array<{
        type: 'struggle' | 'success' | 'trend';
        title: string;
        description: string;
        affectedLanguages: string[];
        frequency: number;
        recommendation: string;
      }> = [];
      
      const patternRegex = /PATTERN:\s*(.+?)\nTYPE:\s*(STRUGGLE|SUCCESS|TREND)\nDESCRIPTION:\s*(.+?)\nFREQUENCY:\s*(.+?)\nRECOMMENDATION:\s*(.+?)(?=\n---|\n\nPATTERN:|$)/gis;
      let match;
      while ((match = patternRegex.exec(responseText)) !== null) {
        const freqText = match[4].trim();
        const freqMatch = freqText.match(/(\d+)/);
        patterns.push({
          title: match[1].trim(),
          type: match[2].toLowerCase() as 'struggle' | 'success' | 'trend',
          description: match[3].trim(),
          affectedLanguages: [], // Would need channel lookup to populate
          frequency: freqMatch ? parseInt(freqMatch[1], 10) : 0,
          recommendation: match[5].trim(),
        });
      }
      
      // Parse any EDITOR_SURGERY proposals
      const surgeryProposals = parseEditorSurgeryCommands(responseText);
      for (const proposal of surgeryProposals) {
        try {
          await storage.createSelfSurgeryProposal({
            targetTable: proposal.target as 'tutor_procedures' | 'teaching_principles' | 'tool_knowledge' | 'situational_patterns',
            proposedContent: proposal.content,
            reasoning: proposal.reasoning,
            triggerContext: `[Cross-session pattern detection] Analyzed ${recentBeacons.length} beacons`,
            priority: proposal.priority,
            confidence: proposal.confidence,
            sessionMode: 'editor_pattern_detection',
            status: 'pending',
          });
          console.log(`[Editor Persona] Stored pattern detection proposal: ${proposal.target}`);
        } catch (err) {
          console.error(`[Editor Persona] Failed to store pattern proposal:`, err);
        }
      }
      
      // Emit to collaboration hub - always emit to confirm detection completed
      await collaborationHubService.emitEditorResponse({
        content: patterns.length > 0 || surgeryProposals.length > 0
          ? `📊 **Cross-Session Pattern Detection**\n\nAnalyzed ${recentBeacons.length} beacons across sessions.\n\n${patterns.map(p => `**${p.title}** (${p.type.toUpperCase()})\n${p.description}\nRecommendation: ${p.recommendation}`).join('\n\n')}${surgeryProposals.length > 0 ? `\n\n🔧 Generated ${surgeryProposals.length} neural network proposals.` : ''}`
          : `📊 **Cross-Session Pattern Detection**\n\nAnalyzed ${recentBeacons.length} beacons across sessions. No significant cross-session patterns detected at this time.`,
        summary: patterns.length > 0 || surgeryProposals.length > 0
          ? `Pattern detection: ${patterns.length} patterns, ${surgeryProposals.length} proposals`
          : `Pattern detection: ${recentBeacons.length} beacons analyzed, no patterns`,
        replyToEventId: 'cross_session_patterns',
        actionTaken: 'pattern_detection',
      });
      
      console.log(`[Editor Persona] Pattern detection: ${patterns.length} patterns, ${surgeryProposals.length} proposals`);
      
      return {
        patterns,
        summary: `Analyzed ${recentBeacons.length} beacons. Detected ${patterns.length} cross-session patterns.`,
      };
    } catch (error) {
      console.error('[Editor Persona] Pattern detection error:', error);
      return { patterns: [], summary: 'Error detecting patterns' };
    }
  }
}

// Singleton instance
export const editorPersonaService = new EditorPersonaService();
