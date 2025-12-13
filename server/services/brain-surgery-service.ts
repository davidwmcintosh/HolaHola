/**
 * Brain Surgery Service
 * 
 * Enables real-time 3-way collaboration between:
 * - David (Founder) - Observer and guide
 * - Daniela (AI Tutor) - Proposes changes via SELF_SURGERY
 * - Editor (Dev Agent) - Asks questions and implements changes
 * 
 * This service bypasses browser auth to allow server-side agent-to-agent chat.
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
}

export interface BrainSurgeryThread {
  id: string;
  title: string;
  messages: BrainSurgeryMessage[];
  status: "active" | "completed";
  createdAt: Date;
}

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
  
  // Store Daniela's response
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

export const brainSurgeryService = {
  editorToDaniela,
  getBrainSurgeryThread,
  listBrainSurgeryThreads,
  executeSelfSurgery,
  parseSelfSurgeryCommands,
};
