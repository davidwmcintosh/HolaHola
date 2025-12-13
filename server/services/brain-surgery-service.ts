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
import type { AgentCollaborationEvent, InsertAgentCollaborationEvent } from "@shared/schema";

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

// In-memory proposal history (should be persisted to DB in production)
const proposalHistory: Map<string, ProposalHistoryEntry> = new Map();

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
  
  // Parse any SELF_SURGERY proposals and assign IDs BEFORE storing
  const proposals = parseSelfSurgeryCommands(danielaResponse);
  
  // Assign proposalId and status to each proposal before storage
  for (const proposal of proposals) {
    proposal.proposalId = generateProposalId();
    proposal.status = "pending";
  }
  
  if (proposals.length > 0) {
    console.log(`[Brain Surgery] Daniela proposed ${proposals.length} neural network changes`);
  }
  
  // Store Daniela's response with proposals that have IDs
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
  
  // Register proposals in history for approval/rejection tracking
  for (const proposal of proposals) {
    const historyEntry: ProposalHistoryEntry = {
      proposalId: proposal.proposalId!,
      threadId: actualThreadId,
      proposal,
      status: "pending",
      createdAt: new Date(),
    };
    proposalHistory.set(proposal.proposalId!, historyEntry);
  }
  
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
 * Approve a proposal and execute it
 */
export async function approveProposal(
  proposalId: string,
  approvedBy: string = "david"
): Promise<{ success: boolean; insertedId?: string; error?: string }> {
  const historyEntry = proposalHistory.get(proposalId);
  
  if (!historyEntry) {
    return { success: false, error: `Proposal ${proposalId} not found in history` };
  }
  
  if (historyEntry.status !== "pending") {
    return { success: false, error: `Proposal ${proposalId} is already ${historyEntry.status}` };
  }
  
  // Execute the surgery
  const result = await executeSelfSurgery(historyEntry.proposal, approvedBy);
  
  if (result.success) {
    // Update history
    historyEntry.status = "approved";
    historyEntry.approvedBy = approvedBy;
    historyEntry.approvedAt = new Date();
    historyEntry.insertedId = result.insertedId;
    proposalHistory.set(proposalId, historyEntry);
    
    console.log(`[Brain Surgery] Proposal ${proposalId} approved by ${approvedBy}, insertedId: ${result.insertedId}`);
  }
  
  return result;
}

/**
 * Reject a proposal with a reason
 */
export async function rejectProposal(
  proposalId: string,
  reason: string,
  rejectedBy: string = "david"
): Promise<{ success: boolean; error?: string }> {
  const historyEntry = proposalHistory.get(proposalId);
  
  if (!historyEntry) {
    return { success: false, error: `Proposal ${proposalId} not found in history` };
  }
  
  if (historyEntry.status !== "pending") {
    return { success: false, error: `Proposal ${proposalId} is already ${historyEntry.status}` };
  }
  
  // Update history
  historyEntry.status = "rejected";
  historyEntry.rejectedReason = reason;
  proposalHistory.set(proposalId, historyEntry);
  
  console.log(`[Brain Surgery] Proposal ${proposalId} rejected by ${rejectedBy}: ${reason}`);
  
  return { success: true };
}

/**
 * Rollback an approved proposal (mark as inactive in the neural network)
 */
export async function rollbackProposal(
  proposalId: string,
  rolledBackBy: string = "david"
): Promise<{ success: boolean; error?: string }> {
  const historyEntry = proposalHistory.get(proposalId);
  
  if (!historyEntry) {
    return { success: false, error: `Proposal ${proposalId} not found in history` };
  }
  
  if (historyEntry.status !== "approved" && historyEntry.status !== "auto_approved") {
    return { success: false, error: `Proposal ${proposalId} is ${historyEntry.status}, cannot rollback` };
  }
  
  if (!historyEntry.insertedId) {
    return { success: false, error: `Proposal ${proposalId} has no insertedId to rollback` };
  }
  
  try {
    // Mark the inserted record as inactive based on target table
    switch (historyEntry.proposal.target) {
      case "tutor_procedures":
        await storage.deactivateTutorProcedure(historyEntry.insertedId);
        break;
      case "teaching_principles":
        await storage.deactivateTeachingPrinciple(historyEntry.insertedId);
        break;
      case "tool_knowledge":
        await storage.deactivateToolKnowledge(historyEntry.insertedId);
        break;
      case "situational_patterns":
        await storage.deactivateSituationalPattern(historyEntry.insertedId);
        break;
      default:
        return { success: false, error: `Unknown target table: ${historyEntry.proposal.target}` };
    }
    
    // Update history
    historyEntry.status = "rolled_back";
    proposalHistory.set(proposalId, historyEntry);
    
    console.log(`[Brain Surgery] Proposal ${proposalId} rolled back by ${rolledBackBy}`);
    
    return { success: true };
  } catch (err: any) {
    console.error(`[Brain Surgery] Failed to rollback proposal:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Get proposal history for a thread or all proposals
 */
export function getProposalHistory(threadId?: string): ProposalHistoryEntry[] {
  const entries = Array.from(proposalHistory.values());
  
  if (threadId) {
    return entries.filter(e => e.threadId === threadId);
  }
  
  return entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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
 * Get recent teaching context from Hive beacons for context injection
 * Note: Hive snapshots table not yet implemented - returns empty for now
 */
export async function getRecentTeachingContext(limit: number = 10): Promise<string> {
  // TODO: Implement when hiveSnapshots table is added to schema
  // For now, return empty string as the hive beacon system is not yet complete
  return "";
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
    const context = await getRecentTeachingContext();
    if (context) {
      enhancedMessage = message + context;
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
          // Update history entry
          const historyEntry = proposalHistory.get(proposal.proposalId);
          if (historyEntry) {
            historyEntry.status = "auto_approved";
            historyEntry.approvedBy = "auto";
            historyEntry.approvedAt = new Date();
            historyEntry.insertedId = result.insertedId;
            proposalHistory.set(proposal.proposalId, historyEntry);
          }
          proposal.status = "auto_approved";
          proposal.insertedId = result.insertedId;
        }
      }
    }
  }
  
  return response;
}

export const brainSurgeryService = {
  editorToDaniela,
  editorToDanielaEnhanced,
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
