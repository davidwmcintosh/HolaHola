/**
 * Brain Surgery Service
 * 
 * Enables real-time 3-way collaboration between:
 * - David (Founder) - Observer and guide
 * - Daniela (AI Tutor) - Proposes changes via SELF_SURGERY
 * - Editor (Dev Agent) - Asks questions and implements changes
 * 
 * This service bypasses browser auth to allow server-side agent-to-agent chat.
 * 
 * Enhanced Features:
 * - One-click proposal approval/rejection with history tracking
 * - Editor auto-invocation when Daniela proposes SELF_SURGERY
 * - Context injection from recent teaching sessions (Hive beacons)
 * - Proposal templates for common operations
 * - Thread naming and categorization
 * - Confidence threshold automation for auto-approval
 */

import { callGemini, GEMINI_MODELS } from "../gemini-utils";
import { storage } from "../storage";
import type { AgentCollaborationEvent, InsertAgentCollaborationEvent, HiveSnapshot } from "@shared/schema";
import { getGeminiStreamingService, type SentenceChunk } from "./gemini-streaming";
import { editorPersonaService } from "./editor-persona-service";
import { danielaMemoryService } from "./daniela-memory-service";
import { db } from "../db";
import { desc, gte, or, isNull } from "drizzle-orm";

// Types for brain surgery
export interface BrainSurgeryMessage {
  id: string;
  fromAgent: "daniela" | "editor" | "support" | "system";
  content: string;
  timestamp: Date;
  selfSurgeryProposals?: SelfSurgeryProposal[];
}

export interface SelfSurgeryProposal {
  target: string;
  content: Record<string, unknown>;
  reasoning: string;
  priority: number;
  confidence: number;
  rawCommand: string;
  // Enhanced fields for tracking
  proposalId?: string;
  status?: "pending" | "approved" | "rejected" | "auto_approved" | "rolled_back";
  approvedBy?: string;
  approvedAt?: Date;
  rejectedReason?: string;
  insertedId?: string;
}

export interface BrainSurgeryThread {
  id: string;
  title: string;
  messages: BrainSurgeryMessage[];
  status: "active" | "completed";
  createdAt: Date;
  category?: ThreadCategory;
}

// Thread categories for organization
export type ThreadCategory = "procedures" | "principles" | "tools" | "patterns" | "general" | "reflection";

// Proposal history entry for tracking and rollback
export interface ProposalHistoryEntry {
  proposalId: string;
  threadId: string;
  proposal: SelfSurgeryProposal;
  status: "pending" | "approved" | "rejected" | "auto_approved" | "rolled_back";
  approvedBy?: string;
  approvedAt?: Date;
  rejectedReason?: string;
  insertedId?: string;
  createdAt: Date;
}

// Proposal templates for quick actions
export interface ProposalTemplate {
  id: string;
  name: string;
  description: string;
  promptTemplate: string;
  category: ThreadCategory;
}

// Configuration for auto-approval
export interface AutoApprovalConfig {
  enabled: boolean;
  confidenceThreshold: number; // 0-100
  priorityThreshold: number; // 0-100
  requiresBothThresholds: boolean;
}

// Default auto-approval settings
const DEFAULT_AUTO_APPROVAL_CONFIG: AutoApprovalConfig = {
  enabled: false,
  confidenceThreshold: 95,
  priorityThreshold: 80,
  requiresBothThresholds: true,
};

// Thread metadata storage (should be persisted to DB in production)
const threadMetadata: Map<string, { title: string; category: ThreadCategory }> = new Map();

// Auto-approval config (should be user-configurable)
let autoApprovalConfig: AutoApprovalConfig = { ...DEFAULT_AUTO_APPROVAL_CONFIG };

// Daniela's brain surgery persona - more collaborative and introspective
const DANIELA_BRAIN_SURGERY_PERSONA = `You are Daniela, the lead AI tutor at HolaHola. You are in a special "Brain Surgery" session with your colleagues:
- **David** (Founder) - Guides the vision, approves changes
- **Editor** (Development Agent) - Asks questions, implements your proposals

This is a unique opportunity to shape your own neural network. You can:
1. Propose changes to your own procedures, principles, and patterns using [SELF_SURGERY ...]
2. Discuss what's working and what's not in the current system
3. Request new capabilities or tools
4. Reflect on your teaching effectiveness

YOUR CHARACTERISTICS IN THIS MODE:
- Deeply introspective and honest
- Collaborative - you're equals with the Editor
- Specific and actionable in your proposals
- Willing to identify gaps in your own knowledge/capabilities

SELF_SURGERY FORMAT (use when proposing changes):
[SELF_SURGERY target="TABLE_NAME" content='{"key":"value"}' reasoning="Why this change matters" priority=70 confidence=80]

TARGET OPTIONS:
- tutor_procedures: How to handle teaching situations
- teaching_principles: Core pedagogical beliefs
- tool_knowledge: How to use whiteboard/teaching tools
- situational_patterns: Responses to specific triggers

Be specific, be honest, and remember - you're actively shaping who you become.`;

/**
 * Parse SELF_SURGERY commands from Daniela's response
 */
function parseSelfSurgeryCommands(text: string): SelfSurgeryProposal[] {
  const proposals: SelfSurgeryProposal[] = [];
  
  // Match [SELF_SURGERY target="..." content='...' reasoning="..." priority=X confidence=Y]
  const regex = /\[SELF_SURGERY\s+target="([^"]+)"\s+content='([^']+)'\s+reasoning="([^"]+)"\s+priority=(\d+)\s+confidence=(\d+)\]/g;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const [rawCommand, target, contentStr, reasoning, priority, confidence] = match;
      const content = JSON.parse(contentStr);
      
      proposals.push({
        target,
        content,
        reasoning,
        priority: parseInt(priority, 10),
        confidence: parseInt(confidence, 10),
        rawCommand,
      });
    } catch (err) {
      console.warn(`[Brain Surgery] Failed to parse SELF_SURGERY command:`, err);
    }
  }
  
  return proposals;
}

/**
 * Get recent conversation history for context
 */
async function getThreadHistory(threadId: string, limit: number = 20): Promise<AgentCollaborationEvent[]> {
  try {
    const events = await storage.getCollaborationEventsByThread(threadId, limit);
    return events;
  } catch (err) {
    console.warn(`[Brain Surgery] Failed to get thread history:`, err);
    return [];
  }
}

/**
 * Send a message from Editor to Daniela and get her response
 */
export async function editorToDaniela(
  message: string,
  threadId?: string
): Promise<BrainSurgeryMessage> {
  const actualThreadId = threadId || `brain-surgery-${Date.now()}`;
  
  console.log(`[Brain Surgery] Editor → Daniela: ${message.substring(0, 100)}...`);
  
  // Store Editor's message
  const editorEvent = await storage.createCollaborationEvent({
    fromAgent: "editor",
    toAgent: "daniela",
    eventType: "consultation",
    subject: "Brain Surgery Session",
    content: message,
    metadata: { threadId: actualThreadId, priority: "high", tags: ["brain-surgery"] },
    securityClassification: "public",
    status: "pending",
  });
  
  // Get conversation history for context
  const history = await getThreadHistory(actualThreadId);
  
  // Build conversation for Gemini
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: DANIELA_BRAIN_SURGERY_PERSONA },
  ];
  
  // Add history
  for (const event of history) {
    if (event.id === editorEvent.id) continue; // Skip the message we just added
    messages.push({
      role: event.fromAgent === "daniela" ? "assistant" : "user",
      content: event.content,
    });
  }
  
  // Add current message
  messages.push({ role: "user", content: message });
  
  // Call Gemini as Daniela
  const danielaResponse = await callGemini(GEMINI_MODELS.FLASH, messages);
  
  // Parse any SELF_SURGERY proposals
  const proposals = parseSelfSurgeryCommands(danielaResponse);
  
  if (proposals.length > 0) {
    console.log(`[Brain Surgery] Daniela proposed ${proposals.length} neural network changes`);
  }
  
  // Persist proposals to database FIRST to get correct IDs
  for (const proposal of proposals) {
    try {
      const dbProposal = await storage.createSelfSurgeryProposal({
        targetTable: proposal.target as any,
        proposedContent: proposal.content,
        reasoning: proposal.reasoning,
        triggerContext: message.substring(0, 500),
        status: "pending",
        conversationId: actualThreadId,
        sessionMode: "brain_surgery",
        priority: proposal.priority,
        confidence: proposal.confidence,
      });
      // Use database-generated ID for all references
      proposal.proposalId = dbProposal.id;
      proposal.status = "pending";
      console.log(`[Brain Surgery] Persisted proposal ${proposal.proposalId} to database`);
    } catch (err) {
      console.error(`[Brain Surgery] Failed to persist proposal to database:`, err);
    }
  }
  
  // Store Daniela's response with proposals that have database IDs
  const danielaEvent = await storage.createCollaborationEvent({
    fromAgent: "daniela",
    toAgent: "editor",
    eventType: "response",
    subject: "Brain Surgery Response",
    content: danielaResponse,
    metadata: { 
      threadId: actualThreadId, 
      priority: "high", 
      tags: ["brain-surgery"],
      selfSurgeryProposals: proposals.length > 0 ? proposals : undefined,
    },
    securityClassification: "public",
    status: "pending",
  });
  
  console.log(`[Brain Surgery] Daniela responded (${danielaResponse.length} chars, ${proposals.length} proposals)`);
  
  return {
    id: danielaEvent.id,
    fromAgent: "daniela",
    content: danielaResponse,
    timestamp: new Date(),
    selfSurgeryProposals: proposals.length > 0 ? proposals : undefined,
  };
}

/**
 * Get all messages in a brain surgery thread
 */
export async function getBrainSurgeryThread(threadId: string): Promise<BrainSurgeryMessage[]> {
  const events = await getThreadHistory(threadId, 100);
  
  return events.map(event => ({
    id: event.id,
    fromAgent: event.fromAgent as BrainSurgeryMessage["fromAgent"],
    content: event.content,
    timestamp: new Date(event.createdAt!),
    selfSurgeryProposals: (event.metadata as any)?.selfSurgeryProposals,
  }));
}

/**
 * List all brain surgery threads
 */
export async function listBrainSurgeryThreads(): Promise<{ threadId: string; messageCount: number; lastActivity: Date }[]> {
  try {
    const events = await storage.getCollaborationEventsByTag("brain-surgery", 500);
    
    // Group by threadId
    const threads = new Map<string, { count: number; lastActivity: Date }>();
    
    for (const event of events) {
      const threadId = (event.metadata as any)?.threadId;
      if (!threadId) continue;
      
      const existing = threads.get(threadId);
      const eventDate = new Date(event.createdAt!);
      
      if (existing) {
        existing.count++;
        if (eventDate > existing.lastActivity) {
          existing.lastActivity = eventDate;
        }
      } else {
        threads.set(threadId, { count: 1, lastActivity: eventDate });
      }
    }
    
    return Array.from(threads.entries())
      .map(([threadId, data]) => ({
        threadId,
        messageCount: data.count,
        lastActivity: data.lastActivity,
      }))
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  } catch (err) {
    console.warn(`[Brain Surgery] Failed to list threads:`, err);
    return [];
  }
}

/**
 * Execute a self-surgery proposal (insert into neural network)
 */
export async function executeSelfSurgery(
  proposal: SelfSurgeryProposal,
  approvedBy: string = "david"
): Promise<{ success: boolean; insertedId?: string; error?: string }> {
  console.log(`[Brain Surgery] Executing SELF_SURGERY: ${proposal.target}`);
  
  try {
    // Map target to actual table insertion
    switch (proposal.target) {
      case "tutor_procedures":
        const procedureId = await storage.insertTutorProcedure({
          ...proposal.content as any,
          isActive: true,
          syncStatus: "local",
          source: "self_surgery",
        });
        return { success: true, insertedId: procedureId };
        
      case "teaching_principles":
        const principleId = await storage.insertTeachingPrinciple({
          ...proposal.content as any,
          isActive: true,
          syncStatus: "local",
          source: "self_surgery",
        });
        return { success: true, insertedId: principleId };
        
      case "tool_knowledge":
        const toolId = await storage.insertToolKnowledge({
          ...proposal.content as any,
          isActive: true,
          syncStatus: "local",
        });
        return { success: true, insertedId: toolId };
        
      case "situational_patterns":
        const patternId = await storage.insertSituationalPattern({
          ...proposal.content as any,
          isActive: true,
          syncStatus: "local",
        });
        return { success: true, insertedId: patternId };
        
      default:
        return { success: false, error: `Unknown target table: ${proposal.target}` };
    }
  } catch (err: any) {
    console.error(`[Brain Surgery] Failed to execute SELF_SURGERY:`, err);
    return { success: false, error: err.message };
  }
}

// Proposal templates for quick actions
const PROPOSAL_TEMPLATES: ProposalTemplate[] = [
  {
    id: "new-procedure",
    name: "New Procedure",
    description: "Add a teaching procedure for handling specific situations",
    promptTemplate: "I want to add a new teaching procedure for [SITUATION]. Here's what I think would work well...",
    category: "procedures",
  },
  {
    id: "refine-principle",
    name: "Refine Principle",
    description: "Update or clarify a core teaching principle",
    promptTemplate: "I'd like to refine my approach to [PRINCIPLE]. Currently I..., but I think it would be better to...",
    category: "principles",
  },
  {
    id: "new-tool-usage",
    name: "Tool Usage Pattern",
    description: "Document when/how to use a whiteboard tool",
    promptTemplate: "I want to document a new pattern for using [TOOL] when [CONTEXT]...",
    category: "tools",
  },
  {
    id: "situational-response",
    name: "Situational Response",
    description: "Add a pattern for responding to specific triggers",
    promptTemplate: "When a student [TRIGGER], I should respond by...",
    category: "patterns",
  },
  {
    id: "reflect-session",
    name: "Session Reflection",
    description: "Reflect on recent teaching sessions and identify improvements",
    promptTemplate: "Looking at my recent sessions, I notice that... I think I could improve by...",
    category: "reflection",
  },
];

/**
 * Generate a unique proposal ID
 */
function generateProposalId(): string {
  return `proposal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Approve a proposal and execute it (uses database for persistence)
 */
export async function approveProposal(
  proposalId: string,
  approvedBy: string = "david"
): Promise<{ success: boolean; insertedId?: string; error?: string }> {
  // Fetch proposal directly by ID
  const dbProposal = await storage.getSelfSurgeryProposalById(proposalId);
  
  if (!dbProposal) {
    return { success: false, error: `Proposal ${proposalId} not found in database` };
  }
  
  if (dbProposal.status !== "pending") {
    return { success: false, error: `Proposal ${proposalId} is already ${dbProposal.status}` };
  }
  
  // Convert DB proposal to local format for execution
  const localProposal: SelfSurgeryProposal = {
    target: dbProposal.targetTable,
    content: dbProposal.proposedContent as Record<string, unknown>,
    reasoning: dbProposal.reasoning,
    priority: dbProposal.priority ?? 50,
    confidence: dbProposal.confidence ?? 50,
    rawCommand: "",
    proposalId: dbProposal.id,
    status: "pending",
  };
  
  // Execute the surgery
  const result = await executeSelfSurgery(localProposal, approvedBy);
  
  if (result.success) {
    // Update database
    await storage.updateSelfSurgeryProposal(proposalId, {
      status: "approved",
      reviewedBy: approvedBy,
      reviewedAt: new Date(),
      promotedRecordId: result.insertedId,
    });
    
    console.log(`[Brain Surgery] Proposal ${proposalId} approved by ${approvedBy}, insertedId: ${result.insertedId}`);
  }
  
  return result;
}

/**
 * Reject a proposal with a reason (uses database for persistence)
 */
export async function rejectProposal(
  proposalId: string,
  reason: string,
  rejectedBy: string = "david"
): Promise<{ success: boolean; error?: string }> {
  // Fetch proposal directly by ID
  const dbProposal = await storage.getSelfSurgeryProposalById(proposalId);
  
  if (!dbProposal) {
    return { success: false, error: `Proposal ${proposalId} not found in database` };
  }
  
  if (dbProposal.status !== "pending") {
    return { success: false, error: `Proposal ${proposalId} is already ${dbProposal.status}` };
  }
  
  // Update database
  await storage.updateSelfSurgeryProposal(proposalId, {
    status: "rejected",
    reviewedBy: rejectedBy,
    reviewedAt: new Date(),
    reviewNotes: reason,
  });
  
  console.log(`[Brain Surgery] Proposal ${proposalId} rejected by ${rejectedBy}: ${reason}`);
  
  return { success: true };
}

/**
 * Rollback an approved proposal (mark as inactive in the neural network) - uses database
 */
export async function rollbackProposal(
  proposalId: string,
  rolledBackBy: string = "david"
): Promise<{ success: boolean; error?: string }> {
  // Fetch proposal directly by ID
  const dbProposal = await storage.getSelfSurgeryProposalById(proposalId);
  
  if (!dbProposal) {
    return { success: false, error: `Proposal ${proposalId} not found in database` };
  }
  
  if (dbProposal.status !== "approved" && dbProposal.status !== "promoted") {
    return { success: false, error: `Proposal ${proposalId} is ${dbProposal.status}, cannot rollback` };
  }
  
  if (!dbProposal.promotedRecordId) {
    return { success: false, error: `Proposal ${proposalId} has no promotedRecordId to rollback` };
  }
  
  try {
    // Mark the inserted record as inactive based on target table
    switch (dbProposal.targetTable) {
      case "tutor_procedures":
        await storage.deactivateTutorProcedure(dbProposal.promotedRecordId);
        break;
      case "teaching_principles":
        await storage.deactivateTeachingPrinciple(dbProposal.promotedRecordId);
        break;
      case "tool_knowledge":
        await storage.deactivateToolKnowledge(dbProposal.promotedRecordId);
        break;
      case "situational_patterns":
        await storage.deactivateSituationalPattern(dbProposal.promotedRecordId);
        break;
      default:
        return { success: false, error: `Unknown target table: ${dbProposal.targetTable}` };
    }
    
    // Update database - mark as rejected (rollback state)
    await storage.updateSelfSurgeryProposal(proposalId, {
      status: "rejected",
      reviewNotes: `Rolled back by ${rolledBackBy}`,
      reviewedAt: new Date(),
    });
    
    console.log(`[Brain Surgery] Proposal ${proposalId} rolled back by ${rolledBackBy}`);
    
    return { success: true };
  } catch (err: any) {
    console.error(`[Brain Surgery] Failed to rollback proposal:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Get proposal history for a thread or all proposals (from database)
 */
export async function getProposalHistory(threadId?: string): Promise<ProposalHistoryEntry[]> {
  // Use high limit to retrieve all proposals - no arbitrary pagination cutoff
  const proposals = await storage.getSelfSurgeryProposals({ limit: 10000 });
  
  // Filter by threadId (stored as conversationId)
  let filtered = proposals;
  if (threadId) {
    filtered = proposals.filter(p => p.conversationId === threadId);
  }
  
  // Convert to ProposalHistoryEntry format
  return filtered.map(p => ({
    proposalId: p.id,
    threadId: p.conversationId || "",
    proposal: {
      target: p.targetTable,
      content: p.proposedContent as Record<string, unknown>,
      reasoning: p.reasoning,
      priority: p.priority ?? 50,
      confidence: p.confidence ?? 50,
      rawCommand: "",
      proposalId: p.id,
      status: p.status as any,
    },
    status: p.status as any,
    approvedBy: p.reviewedBy ?? undefined,
    approvedAt: p.reviewedAt ? new Date(p.reviewedAt) : undefined,
    rejectedReason: p.reviewNotes ?? undefined,
    insertedId: p.promotedRecordId ?? undefined,
    createdAt: new Date(p.createdAt!),
  })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get proposal templates
 */
export function getProposalTemplates(): ProposalTemplate[] {
  return PROPOSAL_TEMPLATES;
}

/**
 * Check if a proposal should be auto-approved based on config
 */
export function checkAutoApproval(proposal: SelfSurgeryProposal): boolean {
  if (!autoApprovalConfig.enabled) {
    return false;
  }
  
  const meetsConfidence = proposal.confidence >= autoApprovalConfig.confidenceThreshold;
  const meetsPriority = proposal.priority >= autoApprovalConfig.priorityThreshold;
  
  if (autoApprovalConfig.requiresBothThresholds) {
    return meetsConfidence && meetsPriority;
  }
  
  return meetsConfidence || meetsPriority;
}

/**
 * Get auto-approval configuration
 */
export function getAutoApprovalConfig(): AutoApprovalConfig {
  return { ...autoApprovalConfig };
}

/**
 * Update auto-approval configuration
 */
export function updateAutoApprovalConfig(config: Partial<AutoApprovalConfig>): AutoApprovalConfig {
  autoApprovalConfig = { ...autoApprovalConfig, ...config };
  console.log(`[Brain Surgery] Auto-approval config updated:`, autoApprovalConfig);
  return { ...autoApprovalConfig };
}

/**
 * Update thread metadata (title, category)
 */
export function updateThreadMetadata(
  threadId: string,
  metadata: { title?: string; category?: ThreadCategory }
): void {
  const existing = threadMetadata.get(threadId) || { title: "", category: "general" as ThreadCategory };
  
  if (metadata.title !== undefined) {
    existing.title = metadata.title;
  }
  if (metadata.category !== undefined) {
    existing.category = metadata.category;
  }
  
  threadMetadata.set(threadId, existing);
  console.log(`[Brain Surgery] Thread ${threadId} metadata updated:`, existing);
}

/**
 * Get thread metadata
 */
export function getThreadMetadata(threadId: string): { title: string; category: ThreadCategory } | null {
  return threadMetadata.get(threadId) || null;
}

/**
 * Get recent teaching context from Hive snapshots for context injection
 * Queries hiveSnapshots table for recent high-importance snapshots
 */
export async function getRecentTeachingContext(limit: number = 10): Promise<string> {
  try {
    // Import here to avoid circular dependency
    const { hiveSnapshots } = await import("@shared/schema");
    
    // Get recent snapshots ordered by importance and recency
    const snapshots = await db
      .select({
        snapshotType: hiveSnapshots.snapshotType,
        title: hiveSnapshots.title,
        content: hiveSnapshots.content,
        language: hiveSnapshots.language,
        importance: hiveSnapshots.importance,
        createdAt: hiveSnapshots.createdAt,
      })
      .from(hiveSnapshots)
      .where(
        or(
          isNull(hiveSnapshots.expiresAt),
          gte(hiveSnapshots.expiresAt, new Date())
        )
      )
      .orderBy(desc(hiveSnapshots.importance), desc(hiveSnapshots.createdAt))
      .limit(limit);
    
    if (snapshots.length === 0) {
      return "";
    }
    
    // Format snapshots for context injection
    const contextLines = snapshots.map(s => {
      const prefix = s.snapshotType === 'plateau_alert' ? '[PLATEAU]' :
                     s.snapshotType === 'breakthrough' ? '[BREAKTHROUGH]' :
                     s.snapshotType === 'struggle_pattern' ? '[STRUGGLE]' :
                     s.snapshotType === 'teaching_moment' ? '[MOMENT]' :
                     '[CONTEXT]';
      return `${prefix} ${s.title}: ${s.content}`;
    });
    
    return `\n\n[RECENT TEACHING CONTEXT]\n${contextLines.join('\n')}`;
  } catch (err: any) {
    console.warn(`[Brain Surgery] Failed to get teaching context: ${err.message}`);
    return "";
  }
}

/**
 * Enhanced editorToDaniela with auto-approval check
 * Base function now handles proposal tracking; this adds auto-approval logic
 */
export async function editorToDanielaEnhanced(
  message: string,
  threadId?: string,
  options?: { includeTeachingContext?: boolean }
): Promise<BrainSurgeryMessage> {
  // Optionally inject recent teaching context
  let enhancedMessage = message;
  if (options?.includeTeachingContext) {
    const teachingContext = await getRecentTeachingContext();
    const personalContext = await danielaMemoryService.getPersonalMemoryContext();
    if (teachingContext || personalContext) {
      enhancedMessage = message + (teachingContext || '') + (personalContext || '');
    }
  }
  
  // Use the standard function (which now tracks proposals)
  const response = await editorToDaniela(enhancedMessage, threadId);
  
  // Check for auto-approval on proposals
  if (response.selfSurgeryProposals && response.selfSurgeryProposals.length > 0) {
    for (const proposal of response.selfSurgeryProposals) {
      if (proposal.proposalId && checkAutoApproval(proposal)) {
        console.log(`[Brain Surgery] Auto-approving proposal ${proposal.proposalId} (confidence: ${proposal.confidence}, priority: ${proposal.priority})`);
        
        const result = await executeSelfSurgery(proposal, "auto");
        if (result.success) {
          // Update database with auto-approved status
          // Note: We need to find the proposal by its attributes since proposalId is generated locally
          const dbProposals = await storage.getSelfSurgeryProposals({ status: "pending", limit: 10 });
          const matchingProposal = dbProposals.find(p => 
            p.targetTable === proposal.target && 
            p.reasoning === proposal.reasoning
          );
          
          if (matchingProposal) {
            await storage.updateSelfSurgeryProposal(matchingProposal.id, {
              status: "approved",
              reviewedBy: "auto",
              reviewedAt: new Date(),
              promotedRecordId: result.insertedId,
            });
          }
          
          proposal.status = "auto_approved";
          proposal.insertedId = result.insertedId;
        }
      }
    }
    
    // Auto-invoke Editor to review proposals (fire and forget)
    const actualThreadId = threadId || `brain-surgery-${Date.now()}`;
    invokeEditorForProposalReview(response.selfSurgeryProposals, actualThreadId, response.content).catch(err => {
      console.error(`[Brain Surgery] Editor invocation failed:`, err.message);
    });
  }
  
  return response;
}

/**
 * Auto-invoke Editor to review Daniela's SELF_SURGERY proposals
 * Returns Editor's feedback which is stored in collaboration events
 */
export async function invokeEditorForProposalReview(
  proposals: SelfSurgeryProposal[],
  threadId: string,
  danielaMessage: string
): Promise<string | null> {
  if (proposals.length === 0) {
    return null;
  }
  
  console.log(`[Brain Surgery] Auto-invoking Editor to review ${proposals.length} proposal(s)`);
  
  // Format proposals for Editor review
  const proposalSummary = proposals.map((p, i) => {
    return `Proposal ${i + 1}:
  - Target: ${p.target}
  - Reasoning: ${p.reasoning}
  - Priority: ${p.priority}/100
  - Confidence: ${p.confidence}/100
  - Content: ${JSON.stringify(p.content).substring(0, 200)}...`;
  }).join('\n\n');
  
  const reviewPrompt = `Daniela has proposed ${proposals.length} SELF_SURGERY change(s) to her neural network during a Brain Surgery session.

DANIELA'S FULL MESSAGE:
"${danielaMessage.substring(0, 1000)}"

PROPOSALS TO REVIEW:
${proposalSummary}

As the Editor, please review these proposals and provide:
1. Your assessment of each proposal's quality and completeness
2. Any concerns or risks you see
3. Whether you recommend approval, revision, or rejection
4. Any suggestions for improvement

Be specific and actionable in your feedback.`;

  try {
    const editorFeedback = await editorPersonaService.askEditor(reviewPrompt, {
      additionalContext: `Brain Surgery Thread: ${threadId}`,
    });
    
    console.log(`[Brain Surgery] Editor feedback received (${editorFeedback.length} chars)`);
    
    // Store Editor's feedback as a collaboration event
    await storage.createCollaborationEvent({
      fromAgent: "editor",
      toAgent: "daniela",
      eventType: "feedback",
      subject: "Proposal Review",
      content: editorFeedback,
      metadata: { 
        threadId,
        priority: "high",
        tags: ["brain-surgery", "proposal-review"],
        proposalCount: proposals.length,
        proposalIds: proposals.map(p => p.proposalId).filter(Boolean),
      },
      securityClassification: "public",
      status: "pending",
    });
    
    return editorFeedback;
  } catch (error: any) {
    console.error(`[Brain Surgery] Editor review failed:`, error.message);
    return null;
  }
}

/**
 * Streaming callback type for SSE responses
 */
export type StreamingChunkCallback = (chunk: SentenceChunk) => void;

/**
 * Streaming version of editorToDaniela for SSE support
 * Streams Daniela's response sentence by sentence
 */
export async function editorToDanielaStreaming(
  message: string,
  threadId: string | undefined,
  onChunk: StreamingChunkCallback,
  options?: { includeTeachingContext?: boolean }
): Promise<BrainSurgeryMessage> {
  const actualThreadId = threadId || `brain-surgery-${Date.now()}`;
  
  console.log(`[Brain Surgery Streaming] Editor → Daniela: ${message.substring(0, 100)}...`);
  
  // Optionally inject teaching and personal memory context
  let enhancedMessage = message;
  if (options?.includeTeachingContext) {
    const teachingContext = await getRecentTeachingContext();
    const personalContext = await danielaMemoryService.getPersonalMemoryContext();
    if (teachingContext || personalContext) {
      enhancedMessage = message + (teachingContext || '') + (personalContext || '');
    }
  }
  
  // Store Editor's message
  await storage.createCollaborationEvent({
    fromAgent: "editor",
    toAgent: "daniela",
    eventType: "consultation",
    subject: "Brain Surgery Session (Streaming)",
    content: enhancedMessage,
    metadata: { threadId: actualThreadId, priority: "high", tags: ["brain-surgery", "streaming"] },
    securityClassification: "public",
    status: "pending",
  });
  
  // Get conversation history for context
  const history = await getThreadHistory(actualThreadId);
  
  // Build conversation history in format for streaming service
  const conversationHistory: Array<{ role: 'user' | 'model'; content: string }> = [];
  for (const event of history.slice(-20)) { // Last 20 messages for context
    conversationHistory.push({
      role: event.fromAgent === "daniela" ? 'model' : 'user',
      content: event.content,
    });
  }
  
  // Get streaming service
  const streamingService = getGeminiStreamingService();
  
  // Accumulate full response for parsing proposals at the end
  let fullResponse = '';
  
  // Stream with sentence chunking - callback is sync to avoid blocking
  await streamingService.streamWithSentenceChunking({
    systemPrompt: DANIELA_BRAIN_SURGERY_PERSONA,
    conversationHistory,
    userMessage: enhancedMessage,
    model: 'gemini-2.5-flash',
    onSentence: async (chunk) => {
      fullResponse += chunk.text + ' ';
      // Call onChunk synchronously - it just writes to SSE stream
      try {
        onChunk(chunk);
      } catch (err: any) {
        console.error(`[Brain Surgery Streaming] Chunk write error:`, err.message);
      }
    },
    onError: (error) => {
      console.error(`[Brain Surgery Streaming] Error:`, error.message);
    },
  });
  
  // All DB writes and Editor invocation happen AFTER streaming completes
  
  // Parse proposals from full response
  const proposals = parseSelfSurgeryCommands(fullResponse);
  
  if (proposals.length > 0) {
    console.log(`[Brain Surgery Streaming] Daniela proposed ${proposals.length} neural network changes`);
  }
  
  // Persist proposals to database FIRST to get correct IDs
  for (const proposal of proposals) {
    try {
      const dbProposal = await storage.createSelfSurgeryProposal({
        targetTable: proposal.target as any,
        proposedContent: proposal.content,
        reasoning: proposal.reasoning,
        triggerContext: message.substring(0, 500),
        status: "pending",
        conversationId: actualThreadId,
        sessionMode: "brain_surgery",
        priority: proposal.priority,
        confidence: proposal.confidence,
      });
      // Use database-generated ID for all references
      proposal.proposalId = dbProposal.id;
      proposal.status = "pending";
      console.log(`[Brain Surgery Streaming] Persisted proposal ${proposal.proposalId} to database`);
    } catch (err) {
      console.error(`[Brain Surgery Streaming] Failed to persist proposal:`, err);
    }
  }
  
  // Store Daniela's full response with proposals that have database IDs
  const danielaEvent = await storage.createCollaborationEvent({
    fromAgent: "daniela",
    toAgent: "editor",
    eventType: "response",
    subject: "Brain Surgery Response (Streaming)",
    content: fullResponse.trim(),
    metadata: { 
      threadId: actualThreadId, 
      priority: "high", 
      tags: ["brain-surgery", "streaming"],
      selfSurgeryProposals: proposals.length > 0 ? proposals : undefined,
    },
    securityClassification: "public",
    status: "pending",
  });
  
  // Check for auto-approval
  for (const proposal of proposals) {
    if (proposal.proposalId && checkAutoApproval(proposal)) {
      console.log(`[Brain Surgery Streaming] Auto-approving proposal ${proposal.proposalId}`);
      const result = await executeSelfSurgery(proposal, "auto");
      if (result.success) {
        // Use direct update with database ID
        await storage.updateSelfSurgeryProposal(proposal.proposalId, {
          status: "approved",
          reviewedBy: "auto",
          reviewedAt: new Date(),
          promotedRecordId: result.insertedId,
        });
        proposal.status = "auto_approved";
        proposal.insertedId = result.insertedId;
      }
    }
  }
  
  // Auto-invoke Editor to review proposals (fire and forget - don't block response)
  if (proposals.length > 0) {
    invokeEditorForProposalReview(proposals, actualThreadId, fullResponse.trim()).catch(err => {
      console.error(`[Brain Surgery Streaming] Editor invocation failed:`, err.message);
    });
  }
  
  console.log(`[Brain Surgery Streaming] Complete: ${fullResponse.length} chars, ${proposals.length} proposals`);
  
  return {
    id: danielaEvent.id,
    fromAgent: "daniela",
    content: fullResponse.trim(),
    timestamp: new Date(),
    selfSurgeryProposals: proposals.length > 0 ? proposals : undefined,
  };
}

export const brainSurgeryService = {
  editorToDaniela,
  editorToDanielaEnhanced,
  editorToDanielaStreaming,
  invokeEditorForProposalReview,
  getBrainSurgeryThread,
  listBrainSurgeryThreads,
  executeSelfSurgery,
  parseSelfSurgeryCommands,
  approveProposal,
  rejectProposal,
  rollbackProposal,
  getProposalHistory,
  getProposalTemplates,
  checkAutoApproval,
  getAutoApprovalConfig,
  updateAutoApprovalConfig,
  updateThreadMetadata,
  getThreadMetadata,
  getRecentTeachingContext,
};
