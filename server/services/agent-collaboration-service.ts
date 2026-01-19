/**
 * DEPRECATED: Agent Collaboration Service
 * 
 * This service and its associated tables (agentCollabThreads, agentCollabMessages)
 * are DEPRECATED in favor of the unified EXPRESS Lane system.
 * 
 * EXPRESS Lane (founderSessions + collaborationMessages tables) now provides
 * unified 3-way collaboration between Founder, Daniela, and Wren.
 * 
 * For new features, use:
 * - FounderCollaborationService (server/services/founder-collaboration-service.ts)
 * - /api/founder-collab/* endpoints
 * - /api/wren/hive-context for Wren context retrieval
 * 
 * This service is kept for backward compatibility but should not be used
 * for new development. Consider migrating existing functionality to EXPRESS Lane.
 * 
 * @deprecated Use EXPRESS Lane (FounderCollaborationService) instead
 */

import { db, getSharedDb } from "../db";
import { 
  agentCollabThreads, 
  agentCollabMessages,
  insertAgentCollabThreadSchema,
  insertAgentCollabMessageSchema,
  InsertAgentCollabThread,
  InsertAgentCollabMessage,
  AgentCollabThread,
  AgentCollabMessage,
  danielaBeacons,
} from "@shared/schema";
import { eq, desc, and, or, isNull, sql } from "drizzle-orm";

type Author = 'daniela' | 'wren' | 'founder';
type MessageType = 'request' | 'proposal' | 'clarification' | 'feedback' | 'implementation_report' | 'acknowledgment' | 'escalation' | 'founder_directive';
type ThreadStatus = 'active' | 'awaiting_wren' | 'awaiting_daniela' | 'awaiting_founder' | 'in_progress' | 'resolved' | 'archived';

/** @deprecated Use EXPRESS Lane (FounderCollaborationService) instead */
class AgentCollaborationService {
  
  async startThread(params: {
    title: string;
    initiator: Author;
    initialMessage: string;
    messageType?: MessageType;
    originBeaconId?: string;
    originTriggerId?: string;
    relatedComponent?: string;
    relatedFiles?: string[];
    priority?: 'low' | 'normal' | 'high' | 'critical';
    proposalDetails?: any;
  }): Promise<{ thread: AgentCollabThread; message: AgentCollabMessage }> {
    const { 
      title, 
      initiator, 
      initialMessage, 
      messageType = 'request',
      originBeaconId,
      originTriggerId,
      relatedComponent,
      relatedFiles = [],
      priority = 'normal',
      proposalDetails,
    } = params;

    const originType = originBeaconId ? 'beacon' : originTriggerId ? 'trigger' : 'spontaneous';
    
    const awaitingStatus: ThreadStatus = initiator === 'daniela' ? 'awaiting_wren' : 
                                          initiator === 'wren' ? 'awaiting_daniela' : 'active';

    const [thread] = await getSharedDb().insert(agentCollabThreads).values({
      title,
      status: awaitingStatus,
      originBeaconId,
      originTriggerId,
      originType,
      relatedComponent,
      relatedFiles,
      priority,
      messageCount: 1,
      lastMessageAt: new Date(),
      lastMessageBy: initiator,
    }).returning();

    const [message] = await getSharedDb().insert(agentCollabMessages).values({
      threadId: thread.id,
      author: initiator,
      messageType,
      content: initialMessage,
      fileReferences: relatedFiles,
      proposalDetails,
      readByDaniela: initiator === 'daniela',
      readByWren: initiator === 'wren',
      readByFounder: initiator === 'founder',
    }).returning();

    console.log(`[Agent Collab] Thread started: "${title}" by ${initiator}`);
    
    return { thread, message };
  }

  async reply(params: {
    threadId: string;
    author: Author;
    content: string;
    messageType?: MessageType;
    codeSnippets?: string[];
    fileReferences?: string[];
    proposalDetails?: any;
    implementationDetails?: any;
    replyToId?: string;
  }): Promise<AgentCollabMessage> {
    const { 
      threadId, 
      author, 
      content, 
      messageType = 'feedback',
      codeSnippets = [],
      fileReferences = [],
      proposalDetails,
      implementationDetails,
      replyToId,
    } = params;

    const [message] = await getSharedDb().insert(agentCollabMessages).values({
      threadId,
      author,
      messageType,
      content,
      codeSnippets,
      fileReferences,
      proposalDetails,
      implementationDetails,
      replyToId,
      readByDaniela: author === 'daniela',
      readByWren: author === 'wren',
      readByFounder: author === 'founder',
    }).returning();

    const newStatus: ThreadStatus = author === 'daniela' ? 'awaiting_wren' : 
                                     author === 'wren' ? 'awaiting_daniela' : 'active';

    await getSharedDb().update(agentCollabThreads)
      .set({
        messageCount: sql`${agentCollabThreads.messageCount} + 1`,
        lastMessageAt: new Date(),
        lastMessageBy: author,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(agentCollabThreads.id, threadId));

    console.log(`[Agent Collab] Reply in thread ${threadId} by ${author}`);
    
    return message;
  }

  async danielaRequest(params: {
    title: string;
    request: string;
    context?: string;
    originBeaconId?: string;
    relatedComponent?: string;
    relatedFiles?: string[];
    priority?: 'low' | 'normal' | 'high' | 'critical';
  }): Promise<{ thread: AgentCollabThread; message: AgentCollabMessage }> {
    const fullMessage = params.context 
      ? `${params.request}\n\nContext: ${params.context}`
      : params.request;

    return this.startThread({
      title: params.title,
      initiator: 'daniela',
      initialMessage: fullMessage,
      messageType: 'request',
      originBeaconId: params.originBeaconId,
      relatedComponent: params.relatedComponent,
      relatedFiles: params.relatedFiles,
      priority: params.priority,
    });
  }

  async wrenProposal(params: {
    threadId?: string;
    title: string;
    proposal: string;
    proposalDetails?: {
      approach?: string;
      estimatedEffort?: string;
      files?: string[];
      tradeoffs?: string[];
    };
    relatedFiles?: string[];
  }): Promise<AgentCollabMessage | { thread: AgentCollabThread; message: AgentCollabMessage }> {
    if (params.threadId) {
      return this.reply({
        threadId: params.threadId,
        author: 'wren',
        content: params.proposal,
        messageType: 'proposal',
        proposalDetails: params.proposalDetails,
        fileReferences: params.relatedFiles,
      });
    } else {
      return this.startThread({
        title: params.title,
        initiator: 'wren',
        initialMessage: params.proposal,
        messageType: 'proposal',
        proposalDetails: params.proposalDetails,
        relatedFiles: params.relatedFiles,
      });
    }
  }

  async wrenImplementationReport(params: {
    threadId: string;
    report: string;
    implementationDetails?: {
      filesChanged?: string[];
      testsAdded?: boolean;
      breakingChanges?: boolean;
      notes?: string;
    };
    resolveThread?: boolean;
  }): Promise<AgentCollabMessage> {
    const message = await this.reply({
      threadId: params.threadId,
      author: 'wren',
      content: params.report,
      messageType: 'implementation_report',
      implementationDetails: params.implementationDetails,
    });

    if (params.resolveThread) {
      await this.resolveThread(params.threadId, params.report);
    }

    return message;
  }

  async escalateToFounder(threadId: string, reason: string): Promise<AgentCollabMessage> {
    const message = await this.reply({
      threadId,
      author: 'wren',
      content: `Escalating to founder: ${reason}`,
      messageType: 'escalation',
    });

    await getSharedDb().update(agentCollabThreads)
      .set({
        status: 'awaiting_founder',
        updatedAt: new Date(),
      })
      .where(eq(agentCollabThreads.id, threadId));

    return message;
  }

  async founderDirective(params: {
    threadId: string;
    directive: string;
    assignTo?: 'wren' | 'daniela';
  }): Promise<AgentCollabMessage> {
    const message = await this.reply({
      threadId: params.threadId,
      author: 'founder',
      content: params.directive,
      messageType: 'founder_directive',
    });

    const newStatus: ThreadStatus = params.assignTo === 'wren' ? 'awaiting_wren' :
                                     params.assignTo === 'daniela' ? 'awaiting_daniela' : 'active';

    await getSharedDb().update(agentCollabThreads)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(agentCollabThreads.id, params.threadId));

    return message;
  }

  async resolveThread(threadId: string, resolution: string): Promise<void> {
    await getSharedDb().update(agentCollabThreads)
      .set({
        status: 'resolved',
        resolution,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentCollabThreads.id, threadId));

    console.log(`[Agent Collab] Thread ${threadId} resolved`);
  }

  async getThreadsForWren(limit = 10): Promise<AgentCollabThread[]> {
    return getSharedDb().select()
      .from(agentCollabThreads)
      .where(
        or(
          eq(agentCollabThreads.status, 'awaiting_wren'),
          eq(agentCollabThreads.status, 'active')
        )
      )
      .orderBy(desc(agentCollabThreads.lastMessageAt))
      .limit(limit);
  }

  async getThreadsForDaniela(limit = 10): Promise<AgentCollabThread[]> {
    return getSharedDb().select()
      .from(agentCollabThreads)
      .where(
        or(
          eq(agentCollabThreads.status, 'awaiting_daniela'),
          eq(agentCollabThreads.status, 'active')
        )
      )
      .orderBy(desc(agentCollabThreads.lastMessageAt))
      .limit(limit);
  }

  async getThreadsForFounder(limit = 20): Promise<AgentCollabThread[]> {
    return getSharedDb().select()
      .from(agentCollabThreads)
      .where(
        or(
          eq(agentCollabThreads.status, 'awaiting_founder'),
          eq(agentCollabThreads.status, 'active'),
          eq(agentCollabThreads.status, 'awaiting_wren'),
          eq(agentCollabThreads.status, 'awaiting_daniela')
        )
      )
      .orderBy(desc(agentCollabThreads.lastMessageAt))
      .limit(limit);
  }

  async getThread(threadId: string): Promise<AgentCollabThread | null> {
    const [thread] = await getSharedDb().select()
      .from(agentCollabThreads)
      .where(eq(agentCollabThreads.id, threadId))
      .limit(1);
    return thread || null;
  }

  async getThreadMessages(threadId: string): Promise<AgentCollabMessage[]> {
    return getSharedDb().select()
      .from(agentCollabMessages)
      .where(eq(agentCollabMessages.threadId, threadId))
      .orderBy(agentCollabMessages.createdAt);
  }

  async getUnreadForWren(): Promise<AgentCollabMessage[]> {
    return getSharedDb().select()
      .from(agentCollabMessages)
      .where(eq(agentCollabMessages.readByWren, false))
      .orderBy(agentCollabMessages.createdAt);
  }

  async getUnreadForDaniela(): Promise<AgentCollabMessage[]> {
    return getSharedDb().select()
      .from(agentCollabMessages)
      .where(eq(agentCollabMessages.readByDaniela, false))
      .orderBy(agentCollabMessages.createdAt);
  }

  async markReadByWren(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;
    
    await getSharedDb().update(agentCollabMessages)
      .set({ readByWren: true })
      .where(sql`${agentCollabMessages.id} = ANY(${messageIds})`);
  }

  async markReadByDaniela(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;
    
    await getSharedDb().update(agentCollabMessages)
      .set({ readByDaniela: true })
      .where(sql`${agentCollabMessages.id} = ANY(${messageIds})`);
  }

  async rateHelpfulness(messageId: string, wasHelpful: boolean, notes?: string): Promise<void> {
    await getSharedDb().update(agentCollabMessages)
      .set({
        wasHelpful,
        helpfulnessNotes: notes,
      })
      .where(eq(agentCollabMessages.id, messageId));
  }

  async createThreadFromBeacon(beaconId: string, overrideTitle?: string): Promise<{ thread: AgentCollabThread; message: AgentCollabMessage } | null> {
    const [beacon] = await getSharedDb().select()
      .from(danielaBeacons)
      .where(eq(danielaBeacons.id, beaconId))
      .limit(1);

    if (!beacon) return null;

    const messageContent = beacon.wish || beacon.studentPain || beacon.rawContent || 'Beacon signal - needs attention';
    const title = overrideTitle || `[${beacon.beaconType}] ${messageContent.substring(0, 50)}...`;
    
    return this.startThread({
      title,
      initiator: 'daniela',
      initialMessage: messageContent,
      messageType: 'request',
      originBeaconId: beaconId,
      priority: beacon.priority === 'high' || beacon.priority === 'critical' ? 'high' : 'normal',
    });
  }

  async generateDanielaCollabContext(maxChars = 500): Promise<string> {
    const pendingThreads = await this.getThreadsForDaniela(5);
    const unreadMessages = await this.getUnreadForDaniela();

    if (pendingThreads.length === 0 && unreadMessages.length === 0) {
      return '';
    }

    let context = '\n[WREN COLLABORATION]';
    
    if (unreadMessages.length > 0) {
      context += `\n${unreadMessages.length} unread message(s) from Wren.`;
      const latestFromWren = unreadMessages.filter(m => m.author === 'wren')[0];
      if (latestFromWren) {
        context += ` Latest: "${latestFromWren.content.substring(0, 100)}..."`;
      }
    }

    if (pendingThreads.length > 0) {
      context += `\n${pendingThreads.length} active thread(s) awaiting your response.`;
    }

    return context.substring(0, maxChars);
  }

  async generateWrenCollabContext(maxChars = 500): Promise<string> {
    const pendingThreads = await this.getThreadsForWren(5);
    const unreadMessages = await this.getUnreadForWren();

    if (pendingThreads.length === 0 && unreadMessages.length === 0) {
      return '';
    }

    let context = '\n═══ DANIELA COLLABORATION ═══';
    
    if (unreadMessages.length > 0) {
      const fromDaniela = unreadMessages.filter(m => m.author === 'daniela');
      if (fromDaniela.length > 0) {
        context += `\n📬 ${fromDaniela.length} message(s) from Daniela awaiting response:`;
        for (const msg of fromDaniela.slice(0, 3)) {
          context += `\n  • [${msg.messageType}] "${msg.content.substring(0, 80)}..."`;
        }
      }
    }

    if (pendingThreads.length > 0) {
      context += `\n📋 ${pendingThreads.length} active thread(s):`;
      for (const thread of pendingThreads.slice(0, 3)) {
        context += `\n  • [${thread.priority?.toUpperCase()}] ${thread.title}`;
      }
    }

    return context.substring(0, maxChars);
  }
}

export const agentCollaborationService = new AgentCollaborationService();
