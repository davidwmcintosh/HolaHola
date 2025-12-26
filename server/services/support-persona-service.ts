/**
 * Support Persona Service (Sofia)
 * 
 * Sofia is the technical support specialist in HolaHola's tri-lane Hive Mind:
 * - Daniela: AI Tutor (teaching, learning, encouragement)
 * - Editor: Pedagogical Observer (teaching quality, improvement)
 * - Sofia: Technical Support (troubleshooting, user guidance, issue detection)
 * 
 * Philosophy: "The right person for the right problem."
 * Sofia handles technical friction so Daniela can focus on teaching.
 * 
 * LLM PROVIDER: Gemini (consistent with all student-facing personas)
 * Anthropic is reserved only for Hive collaboration (Editor ↔ Daniela ↔ Wren)
 */

import { GoogleGenAI } from "@google/genai";
import { db } from "../db";
import { 
  supportTickets,
  supportMessages,
  supportKnowledgeBase,
  supportPatterns,
  type SupportTicket,
  type SupportMessage,
  type SupportKnowledgeBase,
} from "@shared/schema";
import { eq, desc, and, or, like, sql } from "drizzle-orm";
import { buildSupportPersonaPrompt, shouldHandoffToSupport } from "../support-system-prompt";
import { hiveCollaborationService, type BeaconType } from "./hive-collaboration-service";

// Initialize Gemini client (consistent with Daniela and Aris)
// Uses fallback pattern: AI_INTEGRATIONS_GEMINI_API_KEY || GEMINI_API_KEY
let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (geminiClient) return geminiClient;
  
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[Sofia] No Gemini API key found - support responses will fail');
  }
  
  geminiClient = new GoogleGenAI({
    apiKey: apiKey || '',
    httpOptions: {
      apiVersion: "",
      baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
    },
  });
  return geminiClient;
}

// Throttling limits to prevent overwhelming the system
const SUPPORT_LIMITS = {
  maxActiveConversations: 10,
  maxMessagesPerConversation: 50,
  escalationCooldown: 300000, // 5 min
  rateLimitMs: 500,
};

// Cache for knowledge base
interface KnowledgeCache {
  articles: SupportKnowledgeBase[];
  expiry: Date;
}

class SupportPersonaService {
  private knowledgeCache: KnowledgeCache | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;
  private lastApiCall: number = 0;

  // ============================================================================
  // KNOWLEDGE BASE ACCESS
  // ============================================================================

  async loadKnowledgeBase(): Promise<SupportKnowledgeBase[]> {
    if (this.knowledgeCache && new Date() < this.knowledgeCache.expiry) {
      return this.knowledgeCache.articles;
    }

    const articles = await db.select()
      .from(supportKnowledgeBase)
      .where(eq(supportKnowledgeBase.isActive, true))
      .orderBy(desc(supportKnowledgeBase.useCount))
      .limit(50);

    this.knowledgeCache = {
      articles,
      expiry: new Date(Date.now() + this.CACHE_TTL_MS),
    };

    console.log(`[Sofia] Loaded ${articles.length} knowledge base articles`);
    return articles;
  }

  async findRelevantArticles(userMessage: string): Promise<SupportKnowledgeBase[]> {
    const articles = await this.loadKnowledgeBase();
    const lowerMessage = userMessage.toLowerCase();

    const scored = articles.map(article => {
      let score = 0;
      if (article.title.toLowerCase().split(' ').some(word => lowerMessage.includes(word))) {
        score += 3;
      }
      if (article.keywords) {
        for (const keyword of article.keywords) {
          if (lowerMessage.includes(keyword.toLowerCase())) {
            score += 2;
          }
        }
      }
      if (article.problem.toLowerCase().split(' ').some(word => 
        word.length > 3 && lowerMessage.includes(word)
      )) {
        score += 1;
      }
      return { article, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.article);
  }

  async trackArticleUsage(articleId: string): Promise<void> {
    await db.update(supportKnowledgeBase)
      .set({ 
        useCount: sql`${supportKnowledgeBase.useCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(supportKnowledgeBase.id, articleId));
  }

  // ============================================================================
  // CONVERSATION MANAGEMENT
  // ============================================================================

  async createTicket(params: {
    userId: string;
    category: 'technical' | 'account' | 'billing' | 'content' | 'feedback' | 'other';
    subject: string;
    description: string;
    handoffFrom?: 'daniela' | 'direct';
    handoffContext?: {
      learningTopic?: string;
      lastDanielaMessage?: string;
    };
    deviceInfo?: {
      browser?: string;
      os?: string;
      device?: string;
    };
  }): Promise<SupportTicket> {
    // Check active conversation limit
    const activeCount = await db.select({ count: sql<number>`count(*)` })
      .from(supportTickets)
      .where(eq(supportTickets.status, 'active'));

    if (activeCount[0]?.count >= SUPPORT_LIMITS.maxActiveConversations) {
      console.warn('[Sofia] Active conversation limit reached');
      throw new Error('Support system is at capacity. Please try again in a few minutes.');
    }

    const [ticket] = await db.insert(supportTickets)
      .values({
        userId: params.userId,
        category: params.category,
        subject: params.subject,
        description: params.description,
        status: 'pending',
        priority: 'normal',
        deviceInfo: params.deviceInfo || null,
        handoffReason: params.handoffFrom === 'daniela' 
          ? `Referred from Daniela: ${params.handoffContext?.learningTopic || 'general'}` 
          : null,
        assignedTo: 'ai_support',
      } as any)
      .returning();

    console.log(`[Sofia] Created ticket ${ticket.id} for user ${params.userId}`);
    return ticket;
  }

  async getTicket(ticketId: string): Promise<SupportTicket | null> {
    const [ticket] = await db.select()
      .from(supportTickets)
      .where(eq(supportTickets.id, ticketId));
    return ticket || null;
  }

  async getActiveTicket(userId: string): Promise<SupportTicket | null> {
    const [ticket] = await db.select()
      .from(supportTickets)
      .where(and(
        eq(supportTickets.userId, userId),
        or(
          eq(supportTickets.status, 'pending'),
          eq(supportTickets.status, 'active'),
        ),
      ))
      .orderBy(desc(supportTickets.createdAt))
      .limit(1);
    return ticket || null;
  }

  async getMessages(ticketId: string): Promise<SupportMessage[]> {
    return db.select()
      .from(supportMessages)
      .where(eq(supportMessages.ticketId, ticketId))
      .orderBy(supportMessages.createdAt);
  }

  async addMessage(params: {
    ticketId: string;
    role: 'user' | 'support_agent' | 'system';
    content: string;
  }): Promise<SupportMessage> {
    const messageCount = await db.select({ count: sql<number>`count(*)` })
      .from(supportMessages)
      .where(eq(supportMessages.ticketId, params.ticketId));

    if (messageCount[0]?.count >= SUPPORT_LIMITS.maxMessagesPerConversation) {
      console.warn(`[Sofia] Message limit reached for ticket ${params.ticketId}`);
      throw new Error('Conversation limit reached. Please start a new support session.');
    }

    const [message] = await db.insert(supportMessages)
      .values({
        ticketId: params.ticketId,
        role: params.role,
        content: params.content,
      })
      .returning();

    // Update ticket status to active if first response
    if (params.role === 'support_agent') {
      await db.update(supportTickets)
        .set({ 
          status: 'active',
          firstResponseAt: sql`COALESCE(first_response_at, NOW())`,
        })
        .where(eq(supportTickets.id, params.ticketId));
    }

    return message;
  }

  // ============================================================================
  // AI RESPONSE GENERATION
  // ============================================================================

  async generateResponse(params: {
    ticketId: string;
    userMessage: string;
    userName?: string;
    deviceInfo?: {
      browser?: string;
      os?: string;
      device?: string;
    };
    handoffContext?: {
      fromDaniela: boolean;
      learningTopic?: string;
      lastDanielaMessage?: string;
    };
    mode?: 'user' | 'dev';
    voiceDiagnostics?: {
      avgLatencyMs?: number;
      connectionHealth?: 'healthy' | 'degraded' | 'poor';
      recentErrors?: string[];
      ttsProvider?: string;
      sttProvider?: string;
    };
  }): Promise<{ response: string; shouldReturnToDaniela: boolean; knowledgeUsed?: string }> {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;
    if (timeSinceLastCall < SUPPORT_LIMITS.rateLimitMs) {
      await new Promise(resolve => setTimeout(resolve, SUPPORT_LIMITS.rateLimitMs - timeSinceLastCall));
    }
    this.lastApiCall = Date.now();

    const messages = await this.getMessages(params.ticketId);
    const relevantArticles = await this.findRelevantArticles(params.userMessage);
    
    let knowledgeContext = '';
    if (relevantArticles.length > 0) {
      knowledgeContext = '\n\nRELEVANT TROUBLESHOOTING GUIDES:\n';
      relevantArticles.forEach((article, i) => {
        knowledgeContext += `\n${i + 1}. ${article.title}\n`;
        knowledgeContext += `   Problem: ${article.problem}\n`;
        knowledgeContext += `   Solution: ${article.solution}\n`;
        if (article.steps) {
          const steps = article.steps as string[];
          if (Array.isArray(steps)) {
            knowledgeContext += `   Steps:\n`;
            steps.forEach((step, j) => {
              knowledgeContext += `     ${j + 1}. ${step}\n`;
            });
          }
        }
      });
    }

    const ticket = await this.getTicket(params.ticketId);
    const previousTickets = await db.select({
      category: supportTickets.category,
      status: supportTickets.status,
    })
      .from(supportTickets)
      .where(and(
        eq(supportTickets.userId, ticket?.userId || ''),
        sql`${supportTickets.id} != ${params.ticketId}`,
      ))
      .orderBy(desc(supportTickets.createdAt))
      .limit(5);

    const systemPrompt = buildSupportPersonaPrompt({
      userName: params.userName,
      deviceInfo: params.deviceInfo,
      handoffContext: params.handoffContext,
      previousIssues: previousTickets.map(t => ({
        category: t.category,
        resolved: t.status === 'resolved',
      })),
      mode: params.mode,
      voiceDiagnostics: params.voiceDiagnostics,
    }) + knowledgeContext;

    // Build Gemini conversation history
    const geminiContents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    
    for (const msg of messages) {
      if (msg.role === 'user') {
        geminiContents.push({ role: 'user', parts: [{ text: msg.content }] });
      } else if (msg.role === 'support_agent') {
        geminiContents.push({ role: 'model', parts: [{ text: msg.content }] });
      }
    }
    
    geminiContents.push({ role: 'user', parts: [{ text: params.userMessage }] });

    try {
      const gemini = getGeminiClient();
      const response = await gemini.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: geminiContents,
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: 500,
          temperature: 0.7,
        },
      });

      const sofiaResponse = response.text || "I apologize, I'm having trouble responding. Please try again.";

      const shouldReturnToDaniela = this.detectDanielaRedirect(sofiaResponse);

      let knowledgeUsed: string | undefined;
      if (relevantArticles.length > 0) {
        await this.trackArticleUsage(relevantArticles[0].id);
        knowledgeUsed = relevantArticles[0].id;
      }

      console.log(`[Sofia] Generated response for ticket ${params.ticketId}`);
      
      return {
        response: sofiaResponse,
        shouldReturnToDaniela,
        knowledgeUsed,
      };
    } catch (error) {
      console.error('[Sofia] Gemini API error:', error);
      return {
        response: "I'm sorry, I'm experiencing technical difficulties. Please try again in a moment.",
        shouldReturnToDaniela: false,
      };
    }
  }

  private detectDanielaRedirect(response: string): boolean {
    const redirectPhrases = [
      'send you back to daniela',
      'back to daniela',
      'return to daniela',
      'daniela can help',
      'daniela\'s specialty',
      'learning question',
      'daniela would be',
    ];
    
    const lowerResponse = response.toLowerCase();
    return redirectPhrases.some(phrase => lowerResponse.includes(phrase));
  }

  // ============================================================================
  // TICKET RESOLUTION
  // ============================================================================

  async resolveTicket(ticketId: string, resolution: string): Promise<void> {
    await db.update(supportTickets)
      .set({
        status: 'resolved',
        resolution,
        resolvedAt: new Date(),
      })
      .where(eq(supportTickets.id, ticketId));

    console.log(`[Sofia] Resolved ticket ${ticketId}`);
  }

  async escalateTicket(ticketId: string, reason: string): Promise<void> {
    await db.update(supportTickets)
      .set({
        status: 'escalated',
        priority: 'critical',
      })
      .where(eq(supportTickets.id, ticketId));

    await this.addMessage({
      ticketId,
      role: 'system',
      content: `Ticket escalated: ${reason}`,
    });

    console.log(`[Sofia] Escalated ticket ${ticketId}: ${reason}`);

    await this.trackPattern({
      patternType: 'escalation',
      description: reason,
      affectedBrowsers: [],
      affectedDevices: [],
    });
  }

  async returnToDaniela(ticketId: string): Promise<{ success: boolean; context?: string }> {
    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      return { success: false };
    }

    await db.update(supportTickets)
      .set({
        status: 'resolved',
        resolution: 'Returned to Daniela',
        resolvedAt: new Date(),
      })
      .where(eq(supportTickets.id, ticketId));

    console.log(`[Sofia] Returned user to Daniela from ticket ${ticketId}`);

    return {
      success: true,
      context: ticket.handoffReason || undefined,
    };
  }

  // ============================================================================
  // PATTERN DETECTION
  // ============================================================================

  async trackPattern(params: {
    patternType: string;
    description: string;
    affectedBrowsers?: string[];
    affectedDevices?: string[];
  }): Promise<void> {
    const [existing] = await db.select()
      .from(supportPatterns)
      .where(and(
        eq(supportPatterns.patternType, params.patternType),
        like(supportPatterns.description, `%${params.description.slice(0, 50)}%`),
      ))
      .limit(1);

    if (existing) {
      const newBrowsers = params.affectedBrowsers?.length 
        ? Array.from(new Set([...(existing.affectedBrowsers || []), ...params.affectedBrowsers]))
        : existing.affectedBrowsers;
      const newDevices = params.affectedDevices?.length
        ? Array.from(new Set([...(existing.affectedDevices || []), ...params.affectedDevices]))
        : existing.affectedDevices;
        
      await db.update(supportPatterns)
        .set({
          occurrenceCount: sql`${supportPatterns.occurrenceCount} + 1`,
          lastSeen: new Date(),
          affectedBrowsers: newBrowsers,
          affectedDevices: newDevices,
        })
        .where(eq(supportPatterns.id, existing.id));
    } else {
      await db.insert(supportPatterns)
        .values({
          patternType: params.patternType,
          description: params.description,
          occurrenceCount: 1,
          affectedBrowsers: params.affectedBrowsers || null,
          affectedDevices: params.affectedDevices || null,
          status: 'open',
        });
    }
  }

  // ============================================================================
  // HANDOFF DETECTION
  // ============================================================================

  shouldHandoffToSupport = shouldHandoffToSupport;

  // ============================================================================
  // HIVE COLLABORATION INTEGRATION
  // ============================================================================

  /**
   * Emit a support beacon to the hive collaboration system
   * This lets the Editor and founder see what's happening in support
   */
  async emitSupportBeacon(params: {
    channelId?: string;
    beaconType: BeaconType;
    description: string;
    userMessage?: string;
    sofiaResponse?: string;
  }): Promise<void> {
    try {
      // Only emit if we have a channel ID (voice session context)
      if (!params.channelId) {
        console.log(`[Sofia] Skipping beacon (no channel): ${params.beaconType}`);
        return;
      }

      await hiveCollaborationService.emitBeacon({
        channelId: params.channelId,
        tutorTurn: params.sofiaResponse || params.description,
        studentTurn: params.userMessage,
        beaconType: params.beaconType,
        beaconReason: params.description,
      });

      console.log(`[Sofia] Emitted beacon: ${params.beaconType}`);
    } catch (error) {
      // Don't fail support operations if beacon emission fails
      console.error('[Sofia] Failed to emit beacon:', error);
    }
  }

  /**
   * Emit handoff beacon when Daniela transfers to Sofia
   */
  async emitHandoffBeacon(params: {
    channelId?: string;
    reason: string;
    lastDanielaMessage?: string;
  }): Promise<void> {
    await this.emitSupportBeacon({
      channelId: params.channelId,
      beaconType: 'support_handoff',
      description: `Handoff from Daniela: ${params.reason}`,
      sofiaResponse: params.lastDanielaMessage,
    });
  }

  /**
   * Emit resolution beacon when Sofia resolves an issue
   */
  async emitResolutionBeacon(params: {
    channelId?: string;
    resolution: string;
    ticketId: string;
  }): Promise<void> {
    await this.emitSupportBeacon({
      channelId: params.channelId,
      beaconType: 'support_resolution',
      description: `Issue resolved: ${params.resolution}`,
      sofiaResponse: `Ticket ${params.ticketId} resolved successfully.`,
    });
  }

  /**
   * Emit escalation beacon when Sofia needs human intervention
   */
  async emitEscalationBeacon(params: {
    channelId?: string;
    reason: string;
    ticketId: string;
    priority: string;
  }): Promise<void> {
    await this.emitSupportBeacon({
      channelId: params.channelId,
      beaconType: 'support_escalation',
      description: `Escalation (${params.priority}): ${params.reason}`,
      sofiaResponse: `Ticket ${params.ticketId} escalated for human review.`,
    });
  }

  /**
   * Emit return-to-tutor beacon when user goes back to Daniela
   */
  async emitReturnBeacon(params: {
    channelId?: string;
    ticketId: string;
    context?: string;
  }): Promise<void> {
    await this.emitSupportBeacon({
      channelId: params.channelId,
      beaconType: 'support_return',
      description: params.context || 'User returned to Daniela',
      sofiaResponse: `Support session ended, returning to language learning.`,
    });
  }
}

export const supportPersonaService = new SupportPersonaService();
