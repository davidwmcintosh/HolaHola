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
import { db, getUserDb, getSharedDb } from "../db";
import { 
  supportTickets,
  supportMessages,
  supportKnowledgeBase,
  supportPatterns,
  sofiaIssueReports,
  systemAlerts,
  type SupportTicket,
  type SupportMessage,
  type SupportKnowledgeBase,
} from "@shared/schema";
import { eq, desc, and, or, like, sql, gte } from "drizzle-orm";
import { buildSupportPersonaPrompt, shouldHandoffToSupport, type SupportVoiceDiagnostics, type ProductionFaultContext } from "../support-system-prompt";
import { hiveCollaborationService, type BeaconType } from "./hive-collaboration-service";
import { founderCollabService } from "./founder-collaboration-service";
import { voiceSessions, messages } from "@shared/schema";
import type { HealthTransition } from "./voice-health-monitor";

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

    const articles = await getSharedDb().select()
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
    await getSharedDb().update(supportKnowledgeBase)
      .set({ 
        useCount: sql`${supportKnowledgeBase.useCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(supportKnowledgeBase.id, articleId));
  }

  // ============================================================================
  // ISSUE DETECTION & REPORTING (Production Debugging)
  // ============================================================================

  /**
   * Issue keywords that trigger automatic report creation
   * Categorized by issue type for better analysis
   */
  private readonly ISSUE_KEYWORDS: Record<string, string[]> = {
    double_audio: ['double audio', 'audio twice', 'hearing twice', 'duplicate sound', 'echo', 'playing twice', 'repeated audio', 'double playback'],
    no_audio: ['no audio', 'can\'t hear', 'cannot hear', 'no sound', 'audio not working', 'sound not working', 'muted', 'silent', 'no voice'],
    latency: ['slow', 'delay', 'laggy', 'lag', 'takes too long', 'waiting forever', 'response time', 'latency'],
    connection: ['disconnected', 'connection lost', 'dropped', 'keeps disconnecting', 'connection issues', 'unstable connection'],
    microphone: ['microphone', 'mic not working', 'can\'t record', 'not picking up', 'voice not detected'],
  };

  /**
   * Detect if user message contains voice/audio issue keywords
   * Returns issue type if detected, null otherwise
   */
  detectVoiceIssue(userMessage: string): { issueType: string; matchedKeywords: string[] } | null {
    const lowerMessage = userMessage.toLowerCase();
    
    for (const [issueType, keywords] of Object.entries(this.ISSUE_KEYWORDS)) {
      const matched = keywords.filter(keyword => lowerMessage.includes(keyword));
      if (matched.length > 0) {
        return { issueType, matchedKeywords: matched };
      }
    }
    
    return null;
  }

  /**
   * Create an issue report with diagnostic snapshot
   * This captures the state at the moment a user reports an issue
   * Now also generates Sofia's analysis and returns it for voice response
   */
  async createIssueReport(params: {
    userId: string;
    ticketId?: string;
    issueType: string;
    userDescription: string;
    voiceDiagnostics?: SupportVoiceDiagnostics;
    deviceInfo?: { browser?: string; os?: string; device?: string };
    clientTelemetry?: Record<string, any>;
    generateAnalysis?: boolean;
    mode?: 'user' | 'dev';
  }): Promise<{ id: string; sofiaAnalysis?: string }> {
    const [report] = await getUserDb().insert(sofiaIssueReports)
      .values({
        userId: params.userId,
        ticketId: params.ticketId,
        issueType: params.issueType,
        userDescription: params.userDescription,
        diagnosticSnapshot: params.voiceDiagnostics || null,
        clientTelemetry: params.clientTelemetry || null,
        deviceInfo: params.deviceInfo || null,
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
        status: 'pending',
      })
      .returning();

    console.log(`[Sofia] Created issue report ${report.id} - type: ${params.issueType} for user ${params.userId}`);
    
    const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    
    // Generate Sofia's analysis if requested
    let sofiaAnalysis: string | undefined;
    if (params.generateAnalysis !== false) {
      try {
        sofiaAnalysis = await this.generateIssueAnalysis({
          issueType: params.issueType,
          userDescription: params.userDescription,
          voiceDiagnostics: params.voiceDiagnostics,
          deviceInfo: params.deviceInfo,
          clientTelemetry: params.clientTelemetry,
          mode: params.mode,
          environment,
        });
        
        // Update the report with the analysis
        if (sofiaAnalysis) {
          await getUserDb().update(sofiaIssueReports)
            .set({ sofiaAnalysis })
            .where(eq(sofiaIssueReports.id, report.id));
          console.log(`[Sofia] Generated analysis for report ${report.id}`);
        }
      } catch (e) {
        console.warn('[Sofia] Failed to generate analysis:', e);
      }
    }
    
    // Always send EXPRESS Lane alert for immediate visibility
    founderCollabService.emitSofiaIssueAlert({
      reportId: report.id,
      issueType: params.issueType,
      userDescription: params.userDescription,
      environment,
      hasVoiceDiagnostics: !!params.voiceDiagnostics,
      hasClientTelemetry: !!params.clientTelemetry,
    }).catch(e => console.warn('[Sofia] Failed to emit EXPRESS Lane alert:', e));
    
    // In production, also emit a beacon to the Hive so Editor is aware
    if (process.env.NODE_ENV === 'production') {
      try {
        console.log(`[Sofia] Production issue report ${report.id} - EXPRESS Lane alert sent`);
      } catch (e) {
        console.warn('[Sofia] Failed to process issue beacon:', e);
      }
    }

    return { id: report.id, sofiaAnalysis };
  }
  
  /**
   * Report a runtime fault (e.g., LLM API error) for production visibility
   * This creates an issue report with detailed error context that syncs to dev
   * allowing Sofia to diagnose her own failures across environments
   */
  async reportRuntimeFault(params: {
    errorType: 'gemini_api_error' | 'tts_error' | 'stt_error' | 'database_error' | 'unknown_error';
    errorMessage: string;
    errorCode?: string;
    errorStack?: string;
    ticketId?: string;
    userId?: string;
    context?: Record<string, any>;
  }): Promise<void> {
    const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    
    try {
      // Create an issue report for this runtime fault
      const [report] = await getUserDb().insert(sofiaIssueReports)
        .values({
          userId: params.userId || 'system',
          ticketId: params.ticketId,
          issueType: `runtime_fault:${params.errorType}`,
          userDescription: `[SOFIA RUNTIME FAULT] ${params.errorMessage}`,
          sofiaAnalysis: `Error occurred in ${environment}. Code: ${params.errorCode || 'N/A'}. This is an automated fault report - Sofia's LLM subsystem encountered an error.`,
          diagnosticSnapshot: {
            errorType: params.errorType,
            errorMessage: params.errorMessage,
            errorCode: params.errorCode,
            stackTrace: params.errorStack,
            timestamp: new Date().toISOString(),
            nodeEnv: process.env.NODE_ENV,
            hasGeminiKey: !!(process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY),
            hasGeminiBaseUrl: !!process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
          },
          clientTelemetry: params.context || null,
          environment,
          status: 'pending',
          syncStatus: 'pending_sync', // Mark for sync to dev environment
        })
        .returning();
      
      console.log(`[Sofia] Runtime fault reported: ${params.errorType} (${report.id}) in ${environment}`);
      
      // Emit EXPRESS Lane alert for immediate founder visibility
      founderCollabService.emitSofiaIssueAlert({
        reportId: report.id,
        issueType: `runtime_fault:${params.errorType}`,
        userDescription: `[RUNTIME] ${params.errorMessage}`,
        environment,
        hasVoiceDiagnostics: false,
        hasClientTelemetry: !!params.context,
      }).catch(e => console.warn('[Sofia] Failed to emit fault alert:', e));
      
    } catch (e) {
      // Last resort - just log, don't throw
      console.error('[Sofia] Failed to report runtime fault:', e);
    }
  }
  
  /**
   * Get production telemetry for dev environment debugging
   * Returns recent runtime faults and issue reports from production
   */
  async getProductionTelemetry(options?: {
    limit?: number;
    since?: Date;
    includeResolved?: boolean;
  }): Promise<{
    faults: Array<{
      id: string;
      issueType: string;
      userDescription: string;
      sofiaAnalysis: string | null;
      diagnosticSnapshot: any;
      environment: string | null;
      status: string | null;
      createdAt: Date;
    }>;
    summary: {
      totalPending: number;
      runtimeFaults: number;
      lastFaultTime: Date | null;
    };
  }> {
    const limit = options?.limit || 20;
    const since = options?.since || new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24h default
    
    const statusFilter = options?.includeResolved 
      ? sql`1=1`
      : sql`${sofiaIssueReports.status} IN ('pending', 'actionable')`;
    
    const faults = await getUserDb().select({
      id: sofiaIssueReports.id,
      issueType: sofiaIssueReports.issueType,
      userDescription: sofiaIssueReports.userDescription,
      sofiaAnalysis: sofiaIssueReports.sofiaAnalysis,
      diagnosticSnapshot: sofiaIssueReports.diagnosticSnapshot,
      environment: sofiaIssueReports.environment,
      status: sofiaIssueReports.status,
      createdAt: sofiaIssueReports.createdAt,
    })
      .from(sofiaIssueReports)
      .where(and(
        sql`${sofiaIssueReports.createdAt} > ${since}`,
        statusFilter,
      ))
      .orderBy(desc(sofiaIssueReports.createdAt))
      .limit(limit);
    
    // Get summary counts
    const [counts] = await getUserDb().select({
      totalPending: sql<number>`COUNT(*) FILTER (WHERE ${sofiaIssueReports.status} = 'pending')`,
      runtimeFaults: sql<number>`COUNT(*) FILTER (WHERE ${sofiaIssueReports.issueType} LIKE 'runtime_fault:%')`,
    })
      .from(sofiaIssueReports)
      .where(sql`${sofiaIssueReports.createdAt} > ${since}`);
    
    const lastFault = faults.find(f => f.issueType.startsWith('runtime_fault:'));
    
    return {
      faults,
      summary: {
        totalPending: Number(counts?.totalPending || 0),
        runtimeFaults: Number(counts?.runtimeFaults || 0),
        lastFaultTime: lastFault?.createdAt || null,
      },
    };
  }
  
  /**
   * Get recent runtime faults for Sofia's self-diagnosis capability
   * Used to inject fault context into Sofia's prompt so she can explain her own failures
   * 
   * Queries TWO sources:
   * 1. sofiaIssueReports (USER db) - User-reported issues in current environment
   * 2. systemAlerts (SHARED db) - Cross-environment telemetry from production
   */
  async getRecentRuntimeFaults(limit: number = 5): Promise<Array<{
    id: string;
    issueType: string;
    userDescription: string;
    environment: string | null;
    status: string | null;
    createdAt: Date;
  }>> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Get runtime faults from USER database (current environment)
    const userFaults = await getUserDb().select({
      id: sofiaIssueReports.id,
      issueType: sofiaIssueReports.issueType,
      userDescription: sofiaIssueReports.userDescription,
      environment: sofiaIssueReports.environment,
      status: sofiaIssueReports.status,
      createdAt: sofiaIssueReports.createdAt,
    })
      .from(sofiaIssueReports)
      .where(and(
        sql`${sofiaIssueReports.createdAt} > ${oneDayAgo}`,
        sql`(
          ${sofiaIssueReports.issueType} LIKE 'runtime_fault:%' 
          OR ${sofiaIssueReports.issueType} LIKE 'voice_fault:%'
          OR ${sofiaIssueReports.issueType} IN ('no_audio', 'connection', 'double_audio', 'latency')
        )`,
      ))
      .orderBy(desc(sofiaIssueReports.createdAt))
      .limit(limit);
    
    // Get cross-environment alerts from SHARED database (production telemetry)
    let sharedAlerts: Array<{
      id: string;
      issueType: string;
      userDescription: string;
      environment: string | null;
      status: string | null;
      createdAt: Date;
    }> = [];
    
    try {
      const alerts = await getSharedDb().select({
        id: systemAlerts.id,
        title: systemAlerts.title,
        message: systemAlerts.message,
        environment: systemAlerts.originEnvironment,
        severity: systemAlerts.severity,
        createdAt: systemAlerts.createdAt,
      })
        .from(systemAlerts)
        .where(sql`${systemAlerts.createdAt} > ${oneDayAgo}`)
        .orderBy(desc(systemAlerts.createdAt))
        .limit(limit);
      
      sharedAlerts = alerts.map(a => ({
        id: String(a.id),
        issueType: `telemetry:${a.title}`,
        userDescription: a.message || a.title,
        environment: a.environment,
        status: a.severity === 'outage' ? 'pending' : 'info',
        createdAt: a.createdAt!,
      }));
    } catch (err) {
      console.warn('[Sofia] Failed to query shared telemetry:', err);
    }
    
    // Merge and sort by timestamp, newest first
    const allFaults = [...userFaults, ...sharedAlerts]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
    
    return allFaults;
  }
  
  /**
   * Generate Sofia's analysis for an issue report using Gemini
   */
  private async generateIssueAnalysis(params: {
    issueType: string;
    userDescription: string;
    voiceDiagnostics?: SupportVoiceDiagnostics;
    deviceInfo?: { browser?: string; os?: string; device?: string };
    clientTelemetry?: Record<string, any>;
    mode?: 'user' | 'dev';
    environment: string;
  }): Promise<string | undefined> {
    const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[Sofia] No Gemini API key - cannot generate analysis');
      return undefined;
    }
    
    const gemini = getGeminiClient();
    const isDevMode = params.mode === 'dev';
    
    // Build context from diagnostics
    let diagnosticsContext = '';
    if (params.voiceDiagnostics) {
      diagnosticsContext = `\n\nVOICE DIAGNOSTICS:\n${JSON.stringify(params.voiceDiagnostics, null, 2)}`;
    }
    if (params.clientTelemetry) {
      diagnosticsContext += `\n\nCLIENT TELEMETRY:\n${JSON.stringify(params.clientTelemetry, null, 2)}`;
    }
    if (params.deviceInfo) {
      diagnosticsContext += `\n\nDEVICE INFO:\n- Browser: ${params.deviceInfo.browser || 'Unknown'}\n- OS: ${params.deviceInfo.os || 'Unknown'}\n- Device: ${params.deviceInfo.device || 'Unknown'}`;
    }
    
    const systemPrompt = isDevMode 
      ? `You are Sofia, the technical support specialist at HolaHola (an AI language learning platform). You're in DEV MODE helping the founder debug technical issues.

Be direct, technical, and analytical. Share your diagnostic insights openly. You have access to voice telemetry, client data, and system metrics.

The user is asking about a "${params.issueType}" issue in the ${params.environment} environment.
${diagnosticsContext}

Provide a technical analysis. Be concise but thorough. If you can identify likely causes, say so. If you need more information, ask specific technical questions.`
      : `You are Sofia, the friendly technical support specialist at HolaHola. A user is reporting a "${params.issueType}" issue.

Be warm, helpful, and reassuring. Explain any technical concepts in simple terms. Focus on actionable solutions the user can try.
${diagnosticsContext ? `\n(Technical context available for diagnosis)` : ''}

Acknowledge their issue, provide helpful guidance, and let them know you're here to help.`;
    
    try {
      const response = await gemini.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: params.userDescription }] }],
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: 500,
          temperature: 0.7,
        },
      });
      
      const text = response.text?.trim();
      if (text) {
        console.log(`[Sofia] Generated ${text.length} char analysis for ${params.issueType} issue`);
        return text;
      }
    } catch (e: any) {
      console.error('[Sofia] Gemini analysis failed:', e.message);
    }
    
    return undefined;
  }

  /**
   * Get pending issue reports for founder review
   */
  async getPendingIssueReports(limit: number = 50): Promise<any[]> {
    return getUserDb().select()
      .from(sofiaIssueReports)
      .where(eq(sofiaIssueReports.status, 'pending'))
      .orderBy(desc(sofiaIssueReports.createdAt))
      .limit(limit);
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
    const activeCount = await getUserDb().select({ count: sql<number>`count(*)` })
      .from(supportTickets)
      .where(eq(supportTickets.status, 'active'));

    if (activeCount[0]?.count >= SUPPORT_LIMITS.maxActiveConversations) {
      console.warn('[Sofia] Active conversation limit reached');
      throw new Error('Support system is at capacity. Please try again in a few minutes.');
    }

    const [ticket] = await getUserDb().insert(supportTickets)
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
    const [ticket] = await getUserDb().select()
      .from(supportTickets)
      .where(eq(supportTickets.id, ticketId));
    return ticket || null;
  }

  async getActiveTicket(userId: string): Promise<SupportTicket | null> {
    const [ticket] = await getUserDb().select()
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
    return getUserDb().select()
      .from(supportMessages)
      .where(eq(supportMessages.ticketId, ticketId))
      .orderBy(supportMessages.createdAt);
  }

  async addMessage(params: {
    ticketId: string;
    role: 'user' | 'support_agent' | 'system';
    content: string;
  }): Promise<SupportMessage> {
    const messageCount = await getUserDb().select({ count: sql<number>`count(*)` })
      .from(supportMessages)
      .where(eq(supportMessages.ticketId, params.ticketId));

    if (messageCount[0]?.count >= SUPPORT_LIMITS.maxMessagesPerConversation) {
      console.warn(`[Sofia] Message limit reached for ticket ${params.ticketId}`);
      throw new Error('Conversation limit reached. Please start a new support session.');
    }

    const [message] = await getUserDb().insert(supportMessages)
      .values({
        ticketId: params.ticketId,
        role: params.role,
        content: params.content,
      })
      .returning();

    // Update ticket status to active if first response
    if (params.role === 'support_agent') {
      await getUserDb().update(supportTickets)
        .set({ 
          status: 'active',
          firstResponseAt: sql`COALESCE(first_response_at, NOW())`,
        })
        .where(eq(supportTickets.id, params.ticketId));
    }

    return message;
  }

  // ============================================================================
  // SESSION DIAGNOSTICS - Real data for Sofia's analysis
  // ============================================================================

  private async getUserSessionDiagnostics(userId: string): Promise<string> {
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      
      const recentSessions = await getSharedDb().select({
        id: voiceSessions.id,
        conversationId: voiceSessions.conversationId,
        startedAt: voiceSessions.startedAt,
        endedAt: voiceSessions.endedAt,
        status: voiceSessions.status,
        exchangeCount: voiceSessions.exchangeCount,
        language: voiceSessions.language,
        durationSeconds: voiceSessions.durationSeconds,
      })
        .from(voiceSessions)
        .where(and(
          eq(voiceSessions.userId, userId),
          gte(voiceSessions.startedAt, twoHoursAgo),
        ))
        .orderBy(desc(voiceSessions.startedAt))
        .limit(5);
      
      if (recentSessions.length === 0) {
        return 'No voice sessions found in last 2 hours.';
      }
      
      let diagnosticText = `RECENT VOICE SESSIONS (last 2 hours):\n`;
      
      for (const session of recentSessions) {
        const startTime = session.startedAt ? new Date(session.startedAt).toLocaleTimeString() : 'unknown';
        const endTime = session.endedAt ? new Date(session.endedAt).toLocaleTimeString() : 'still active';
        const duration = session.durationSeconds ? `${session.durationSeconds}s` : 'ongoing';
        
        diagnosticText += `\n  Session ${session.id.substring(0, 8)}... (${session.language}):\n`;
        diagnosticText += `    Started: ${startTime}, Ended: ${endTime}, Status: ${session.status}, Duration: ${duration}\n`;
        diagnosticText += `    Exchanges: ${session.exchangeCount || 0}\n`;
        
        if (session.conversationId) {
          const sessionMessages = await getSharedDb().select({
            role: messages.role,
            content: messages.content,
            createdAt: messages.createdAt,
          })
            .from(messages)
            .where(eq(messages.conversationId, session.conversationId))
            .orderBy(messages.createdAt)
            .limit(10);
          
          if (sessionMessages.length > 0) {
            diagnosticText += `    Messages (${sessionMessages.length}):\n`;
            for (const msg of sessionMessages) {
              const time = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : '';
              const preview = (msg.content || '').substring(0, 120);
              diagnosticText += `      [${msg.role}] ${time}: ${preview}${(msg.content || '').length > 120 ? '...' : ''}\n`;
            }
          } else {
            diagnosticText += `    Messages: none stored\n`;
          }
        }
      }
      
      return diagnosticText;
    } catch (err: any) {
      console.warn('[Sofia] Failed to load session diagnostics:', err.message);
      return 'Session diagnostics unavailable (database query failed).';
    }
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
    voiceDiagnostics?: SupportVoiceDiagnostics;
    clientTelemetry?: Record<string, any>;
  }): Promise<{ response: string; shouldReturnToDaniela: boolean; knowledgeUsed?: string }> {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;
    if (timeSinceLastCall < SUPPORT_LIMITS.rateLimitMs) {
      await new Promise(resolve => setTimeout(resolve, SUPPORT_LIMITS.rateLimitMs - timeSinceLastCall));
    }
    this.lastApiCall = Date.now();

    // Auto-detect voice issues and create diagnostic report
    const detectedIssue = this.detectVoiceIssue(params.userMessage);
    if (detectedIssue) {
      const ticket = await this.getTicket(params.ticketId);
      if (ticket) {
        // Create issue report with diagnostic snapshot (fire and forget)
        this.createIssueReport({
          userId: ticket.userId,
          ticketId: params.ticketId,
          issueType: detectedIssue.issueType,
          userDescription: params.userMessage,
          voiceDiagnostics: params.voiceDiagnostics,
          deviceInfo: params.deviceInfo,
          clientTelemetry: params.clientTelemetry,
        }).catch(err => console.warn('[Sofia] Failed to create issue report:', err));
        
        console.log(`[Sofia] Detected voice issue: ${detectedIssue.issueType} (keywords: ${detectedIssue.matchedKeywords.join(', ')})`);
      }
    }

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
    const previousTickets = await getUserDb().select({
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

    // Load recent runtime faults for self-diagnosis (both dev and user modes)
    // This enables Sofia to explain her own failures in any context
    let productionFaultContext: ProductionFaultContext | undefined;
    try {
      const recentFaults = await this.getRecentRuntimeFaults();
      const activeCount = recentFaults.filter(f => f.status !== 'resolved').length;
      const prodCount = recentFaults.filter(f => f.environment === 'production').length;
      
      productionFaultContext = {
        recentFaults: recentFaults.map(f => ({
          errorType: f.issueType?.replace('runtime_fault:', '').replace('voice_fault:', '') || 'unknown',
          errorMessage: f.userDescription || 'No description',
          timestamp: f.createdAt?.toISOString() || 'unknown',
          environment: f.environment || 'unknown',
          resolved: f.status === 'resolved',
        })),
        faultSummary: recentFaults.length > 0
          ? `${recentFaults.length} fault(s) in last 24h: ${activeCount} active, ${prodCount} from production`
          : 'No runtime faults recorded in last 24 hours',
        crossEnvAvailable: true,
      };
    } catch (err) {
      console.warn('[Sofia] Failed to load production faults for context:', err);
      productionFaultContext = { 
        crossEnvAvailable: false,
        faultSummary: 'Telemetry unavailable - sync may be pending',
      };
    }

    // Fetch REAL session data so Sofia can diagnose actual issues instead of guessing
    let sessionDiagnostics = '';
    if (ticket?.userId) {
      sessionDiagnostics = await this.getUserSessionDiagnostics(ticket.userId);
    }
    
    // Build client telemetry context for the prompt (not just the issue report)
    let clientTelemetryContext = '';
    if (params.clientTelemetry) {
      const tel = params.clientTelemetry;
      const parts: string[] = [];
      if (tel.audioContext?.state) parts.push(`AudioContext state: ${tel.audioContext.state}`);
      if (tel.voiceClient?.connectionState) parts.push(`WebSocket: ${tel.voiceClient.connectionState}`);
      if (tel.voiceClient?.socketConnected !== undefined) parts.push(`Socket connected: ${tel.voiceClient.socketConnected}`);
      if (tel.voiceClient?.reconnectCount !== undefined) parts.push(`Reconnect attempts: ${tel.voiceClient.reconnectCount}`);
      if (tel.voiceClient?.lastConversationId) parts.push(`Last conversation: ${tel.voiceClient.lastConversationId}`);
      if (tel.voiceClient?.hasActiveSession !== undefined) parts.push(`Active session: ${tel.voiceClient.hasActiveSession}`);
      if (tel.device?.browser) parts.push(`Browser: ${tel.device.browser}`);
      if (tel.device?.platform) parts.push(`Platform: ${tel.device.platform}`);
      if (parts.length > 0) {
        clientTelemetryContext = `\nCLIENT TELEMETRY (live snapshot from user's device):\n  ${parts.join('\n  ')}\n`;
      }
    }
    
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
      productionFaultContext,
    }) + knowledgeContext + (sessionDiagnostics ? `\n\n═══════════════════════════════════════════════════════════════════\n📊 SESSION DIAGNOSTICS (from database - REAL DATA)\n═══════════════════════════════════════════════════════════════════\n${sessionDiagnostics}` : '') + (clientTelemetryContext ? `\n\n═══════════════════════════════════════════════════════════════════\n📡 CLIENT DEVICE TELEMETRY (from user's browser)\n═══════════════════════════════════════════════════════════════════\n${clientTelemetryContext}` : '');

    // Build Gemini conversation history from stored messages
    // NOTE: The user message is already stored in DB before generateResponse is called,
    // so we don't need to append it again - it's already in the messages array
    const geminiContents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    
    for (const msg of messages) {
      if (msg.role === 'user') {
        geminiContents.push({ role: 'user', parts: [{ text: msg.content }] });
      } else if (msg.role === 'support_agent') {
        geminiContents.push({ role: 'model', parts: [{ text: msg.content }] });
      }
    }

    try {
      const gemini = getGeminiClient();
      
      // Pre-flight check: Verify API key is available
      const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error('[Sofia] CRITICAL: No Gemini API key available');
        return {
          response: "I'm sorry, our AI system is temporarily unavailable. Please return to Daniela and try again later.",
          shouldReturnToDaniela: true,
        };
      }
      
      console.log(`[Sofia] Calling Gemini API for ticket ${params.ticketId} (mode: ${params.mode})`);
      
      const response = await gemini.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: geminiContents,
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: 1024,
          temperature: 0.6,
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
    } catch (error: any) {
      // Detailed error logging for debugging production issues
      const errorMessage = error?.message || 'Unknown error';
      const errorCode = error?.code || error?.status || 'N/A';
      const errorStack = error?.stack?.split('\n').slice(0, 5).join('\n');
      
      console.error('[Sofia] Gemini API error:', {
        message: errorMessage,
        code: errorCode,
        ticketId: params.ticketId,
        mode: params.mode,
        stack: errorStack,
      });
      
      // Report runtime fault for cross-environment visibility
      // This allows Sofia in dev to see production errors
      const ticket = await this.getTicket(params.ticketId);
      this.reportRuntimeFault({
        errorType: 'gemini_api_error',
        errorMessage,
        errorCode: String(errorCode),
        errorStack,
        ticketId: params.ticketId,
        userId: ticket?.userId,
        context: {
          mode: params.mode,
          hasVoiceDiagnostics: !!params.voiceDiagnostics,
          hasClientTelemetry: !!params.clientTelemetry,
          messageLength: params.userMessage.length,
        },
      }).catch(e => console.warn('[Sofia] Failed to report fault:', e));
      
      // Provide contextual fallback based on mode
      if (params.mode === 'dev') {
        return {
          response: `[DEV MODE] Gemini API error: ${errorMessage} (code: ${errorCode}). Check server logs for details. The AI integration may need reconfiguration.`,
          shouldReturnToDaniela: false,
        };
      }
      
      return {
        response: "I'm sorry, I'm experiencing technical difficulties. Please try again in a moment, or return to Daniela if the issue persists.",
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
    await getUserDb().update(supportTickets)
      .set({
        status: 'resolved',
        resolution,
        resolvedAt: new Date(),
      })
      .where(eq(supportTickets.id, ticketId));

    console.log(`[Sofia] Resolved ticket ${ticketId}`);
  }

  async escalateTicket(ticketId: string, reason: string): Promise<void> {
    await getUserDb().update(supportTickets)
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

    await getUserDb().update(supportTickets)
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
    const [existing] = await getSharedDb().select()
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
        
      await getSharedDb().update(supportPatterns)
        .set({
          occurrenceCount: sql`${supportPatterns.occurrenceCount} + 1`,
          lastSeen: new Date(),
          affectedBrowsers: newBrowsers,
          affectedDevices: newDevices,
        })
        .where(eq(supportPatterns.id, existing.id));
    } else {
      await getSharedDb().insert(supportPatterns)
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
  
  // ============================================================================
  // VOICE CHAT ISSUE HANDLING (Direct, without formal ticket)
  // ============================================================================
  
  /**
   * Handle an issue report directly from voice chat
   * Creates an issue report, generates Sofia's analysis, and returns it for speech
   * This is the main entry point for voice chat issue detection
   */
  async handleVoiceChatIssue(params: {
    userId: string;
    userMessage: string;
    voiceDiagnostics?: SupportVoiceDiagnostics;
    deviceInfo?: { browser?: string; os?: string; device?: string };
    clientTelemetry?: Record<string, any>;
    isFounder?: boolean;
  }): Promise<{ detected: boolean; issueType?: string; sofiaResponse?: string; reportId?: string }> {
    // Detect if this message contains an issue
    const detectedIssue = this.detectVoiceIssue(params.userMessage);
    
    if (!detectedIssue) {
      return { detected: false };
    }
    
    console.log(`[Sofia Voice] Detected ${detectedIssue.issueType} issue (keywords: ${detectedIssue.matchedKeywords.join(', ')})`);
    
    // Create the issue report and generate analysis
    const report = await this.createIssueReport({
      userId: params.userId,
      issueType: detectedIssue.issueType,
      userDescription: params.userMessage,
      voiceDiagnostics: params.voiceDiagnostics,
      deviceInfo: params.deviceInfo,
      clientTelemetry: params.clientTelemetry,
      generateAnalysis: true,
      mode: params.isFounder ? 'dev' : 'user',
    });
    
    return {
      detected: true,
      issueType: detectedIssue.issueType,
      sofiaResponse: report.sofiaAnalysis,
      reportId: report.id,
    };
  }
  
  // ============================================================================
  // PERIODIC ISSUE MONITORING WORKER
  // ============================================================================
  
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastCheckTime: Date | null = null;
  private patternAlertCooldown: Map<string, Date> = new Map();
  
  /**
   * Start the periodic issue monitoring worker
   * Checks for patterns and sends summaries every 5 minutes
   */
  startIssueMonitoringWorker(intervalMinutes: number = 5): void {
    if (this.monitoringInterval) {
      console.log('[Sofia Monitor] Worker already running');
      return;
    }
    
    const intervalMs = intervalMinutes * 60 * 1000;
    this.lastCheckTime = new Date();
    
    console.log(`[Sofia Monitor] Starting issue monitoring worker (interval: ${intervalMinutes}min)`);
    
    this.monitoringInterval = setInterval(async () => {
      await this.runMonitoringCheck();
    }, intervalMs);
    
    // Run initial check after 30 seconds
    setTimeout(() => this.runMonitoringCheck(), 30000);
  }
  
  /**
   * Stop the monitoring worker
   */
  stopIssueMonitoringWorker(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[Sofia Monitor] Worker stopped');
    }
  }
  
  /**
   * Run a single monitoring check - detect patterns and emit summary
   */
  private async runMonitoringCheck(): Promise<void> {
    try {
      const now = new Date();
      const lastCheck = this.lastCheckTime || new Date(Date.now() - 5 * 60 * 1000);
      const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
      
      // Get all reports from the last hour for pattern detection
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentReports = await getUserDb().select()
        .from(sofiaIssueReports)
        .where(sql`${sofiaIssueReports.createdAt} > ${oneHourAgo}`)
        .orderBy(desc(sofiaIssueReports.createdAt));
      
      // Pattern detection: cluster similar issues
      await this.detectAndAlertPatterns(recentReports, 60);
      
      // Get counts for summary
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const allPending = await getUserDb().select()
        .from(sofiaIssueReports)
        .where(eq(sofiaIssueReports.status, 'pending'));
      
      const resolvedToday = await getUserDb().select({ count: sql<number>`count(*)` })
        .from(sofiaIssueReports)
        .where(and(
          eq(sofiaIssueReports.status, 'resolved'),
          sql`${sofiaIssueReports.reviewedAt} > ${todayStart}`
        ));
      
      const newSinceLastCheck = recentReports.filter(r => 
        new Date(r.createdAt) > lastCheck
      ).length;
      
      // Count by issue type
      const issueTypeCounts: Record<string, number> = {};
      for (const report of allPending) {
        const type = report.issueType || 'unknown';
        issueTypeCounts[type] = (issueTypeCounts[type] || 0) + 1;
      }
      
      const topIssueTypes = Object.entries(issueTypeCounts)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);
      
      // Emit summary to EXPRESS Lane (only if there's activity)
      await founderCollabService.emitSofiaIssueSummary({
        pendingCount: allPending.length,
        newSinceLastCheck,
        resolvedToday: resolvedToday[0]?.count || 0,
        topIssueTypes,
        environment,
      });
      
      this.lastCheckTime = now;
      console.log(`[Sofia Monitor] Check complete: ${allPending.length} pending, ${newSinceLastCheck} new`);
      
    } catch (error) {
      console.error('[Sofia Monitor] Error in monitoring check:', error);
    }
  }
  
  /**
   * Detect patterns in issue reports and emit alerts
   */
  private async detectAndAlertPatterns(
    reports: typeof sofiaIssueReports.$inferSelect[],
    timeWindowMinutes: number
  ): Promise<void> {
    const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    
    // Group by issue type
    const byType: Record<string, typeof reports> = {};
    for (const report of reports) {
      const type = report.issueType || 'unknown';
      if (!byType[type]) byType[type] = [];
      byType[type].push(report);
    }
    
    // Check for clusters (3+ of same type in the time window)
    for (const [issueType, typeReports] of Object.entries(byType)) {
      const count = typeReports.length;
      
      if (count >= 3) {
        // Check cooldown to prevent spam (30 min cooldown per pattern type)
        const cooldownKey = `${issueType}-${environment}`;
        const lastAlert = this.patternAlertCooldown.get(cooldownKey);
        const cooldownMs = 30 * 60 * 1000; // 30 minutes
        
        if (lastAlert && (Date.now() - lastAlert.getTime()) < cooldownMs) {
          continue; // Skip, still in cooldown
        }
        
        // Generate recommendation based on issue type
        let recommendation: string | undefined;
        if (issueType === 'double_audio') {
          recommendation = 'Check TTS audio queue management and deduplication logic';
        } else if (issueType === 'no_audio') {
          recommendation = 'Verify TTS service health and audio playback initialization';
        } else if (issueType === 'latency') {
          recommendation = 'Review streaming pipeline for bottlenecks (STT/LLM/TTS)';
        } else if (issueType === 'connection') {
          recommendation = 'Check WebSocket stability and reconnection logic';
        } else if (issueType === 'microphone') {
          recommendation = 'Review microphone permission handling and audio input stream';
        }
        
        await founderCollabService.emitSofiaPatternAlert({
          patternType: 'cluster',
          issueType,
          count,
          timeWindowMinutes,
          environment,
          recentReportIds: typeReports.slice(0, 5).map(r => r.id),
          recommendation,
        });
        
        // Set cooldown
        this.patternAlertCooldown.set(cooldownKey, new Date());
        
        console.log(`[Sofia Monitor] Pattern alert: ${count}x ${issueType}`);
      }
    }
  }
  // ============================================================================
  // VOICE HEALTH WATCHER - Sofia as autonomous diagnostic agent (Gemini 3 function calling)
  // ============================================================================
  
  private healthDigestCooldown: Date | null = null;
  private readonly HEALTH_DIGEST_COOLDOWN_MS = 10 * 60 * 1000;
  private readonly MAX_AGENT_ROUNDS = 5;

  async handleHealthTransition(transition: HealthTransition): Promise<void> {
    const now = new Date();
    if (this.healthDigestCooldown && (now.getTime() - this.healthDigestCooldown.getTime()) < this.HEALTH_DIGEST_COOLDOWN_MS) {
      console.log(`[Sofia Agent] Skipping — cooldown active (${Math.round((this.HEALTH_DIGEST_COOLDOWN_MS - (now.getTime() - this.healthDigestCooldown.getTime())) / 1000)}s remaining)`);
      return;
    }
    this.healthDigestCooldown = now;

    console.log(`[Sofia Agent] Health transition: ${transition.previousStatus} → ${transition.newStatus} (${transition.direction})`);

    const { analysis, actions } = await this.runSofiaHealthAgent(transition);

    await this.recordHealthDigest(transition, analysis, actions);
  }

  private async runSofiaHealthAgent(transition: HealthTransition): Promise<{
    analysis: string;
    actions: Array<{ action: string; result: string; applied: boolean }>;
  }> {
    const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const fallback = `Voice health ${transition.direction}: ${transition.previousStatus} → ${transition.newStatus}. Reasons: ${transition.reasons.join('; ')}`;
      console.log(`[Sofia Agent] No API key — using fallback`);
      return { analysis: fallback, actions: [] };
    }

    const { SOFIA_HEALTH_FUNCTION_DECLARATIONS, executeSofiaTool } = await import('./sofia-health-functions');

    try {
      const gemini = getGeminiClient();
      const metricsJson = JSON.stringify(transition.metrics, null, 2);

      const systemPrompt = `You are Sofia, the autonomous voice health diagnostic agent at HolaHola (AI language learning platform).

A health status transition was detected. Your job is to INVESTIGATE the root cause using your tools, then take appropriate REMEDIATION actions.

WORKFLOW:
1. First, use get_health_status and get_recent_pipeline_events to understand what's happening right now
2. Check get_daily_summaries for trends if the issue seems recurring
3. Check list_active_sessions to see if stale sessions are contributing
4. Check get_recent_health_digests to see what you've already done recently
5. Based on your investigation, take appropriate actions:
   - cleanup_stale_sessions if stale sessions are found
   - upsert_kb_article if students need self-help guidance for a new pattern
   - track_pattern to record recurring issues
   - escalate_to_founder ONLY for critical issues that need human intervention
6. After investigating and acting, provide your final analysis

CONSTRAINTS:
- Only take actions you can justify from your investigation
- Tools have 30-minute cooldowns — if a tool returns a cooldown message, acknowledge it and move on
- Be concise in your final analysis (3-5 sentences)
- For "recovered" transitions, investigation is optional — confirm stability`;

      const seedMessage = `Voice health transition detected:
- Previous status: ${transition.previousStatus}
- Current status: ${transition.newStatus}
- Direction: ${transition.direction}
- Reasons: ${transition.reasons.join('; ')}
- Timestamp: ${transition.timestamp.toISOString()}

Initial metrics snapshot:
${metricsJson}

Event types: lockout_watchdog_8s (mic locked >8s), failsafe_tier1_20s (no audio 20s), failsafe_tier2_45s (no audio 45s), greeting_silence_15s (no greeting 15s), error (general), tts_error (TTS failure), mismatch_recovery (state recovery).

Investigate this transition using your tools, take any appropriate remediation actions, then provide your final analysis.`;

      type ContentPart = { text: string } | { functionCall: { name: string; args: Record<string, any> } } | { functionResponse: { name: string; response: { result: any } } };
      type ContentMessage = { role: 'user' | 'model'; parts: ContentPart[] };

      const conversationHistory: ContentMessage[] = [
        { role: 'user', parts: [{ text: seedMessage }] },
      ];

      const allActions: Array<{ action: string; result: string; applied: boolean }> = [];
      let finalAnalysis = '';

      for (let round = 0; round < this.MAX_AGENT_ROUNDS; round++) {
        const response = await gemini.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: conversationHistory,
          config: {
            systemInstruction: systemPrompt,
            maxOutputTokens: 800,
            temperature: 0.3,
            tools: [{ functionDeclarations: SOFIA_HEALTH_FUNCTION_DECLARATIONS }],
          },
        });

        const candidate = response.candidates?.[0];
        if (!candidate?.content?.parts) {
          console.warn(`[Sofia Agent] No response parts in round ${round + 1}`);
          break;
        }

        const parts = candidate.content.parts;
        conversationHistory.push({ role: 'model', parts: parts as ContentPart[] });

        const functionCalls = parts.filter((p: any) => p.functionCall);

        if (functionCalls.length === 0) {
          const textParts = parts.filter((p: any) => p.text);
          finalAnalysis = textParts.map((p: any) => p.text).join('\n').trim();
          console.log(`[Sofia Agent] Final analysis after ${round + 1} rounds (${finalAnalysis.length} chars, ${allActions.length} actions)`);
          break;
        }

        console.log(`[Sofia Agent] Round ${round + 1}: ${functionCalls.length} tool call(s) — ${functionCalls.map((p: any) => p.functionCall.name).join(', ')}`);

        const toolResponseParts: ContentPart[] = [];

        for (const part of functionCalls) {
          const fc = (part as any).functionCall;
          const toolName = fc.name;
          const toolArgs = fc.args || {};

          try {
            const result = await executeSofiaTool(toolName, toolArgs);

            const isMutating = ['cleanup_stale_sessions', 'upsert_kb_article', 'track_pattern', 'escalate_to_founder'].includes(toolName);
            if (isMutating) {
              allActions.push({
                action: toolName,
                result: JSON.stringify(result.data),
                applied: result.success,
              });
            }

            toolResponseParts.push({
              functionResponse: {
                name: toolName,
                response: { result: result.data },
              },
            });
          } catch (err: any) {
            console.warn(`[Sofia Agent] Tool ${toolName} failed:`, err.message);
            toolResponseParts.push({
              functionResponse: {
                name: toolName,
                response: { result: { error: err.message } },
              },
            });
            allActions.push({
              action: toolName,
              result: `Error: ${err.message}`,
              applied: false,
            });
          }
        }

        conversationHistory.push({ role: 'user', parts: toolResponseParts });
      }

      if (!finalAnalysis) {
        finalAnalysis = `Voice health ${transition.direction}: ${transition.previousStatus} → ${transition.newStatus}. Agent completed ${allActions.length} actions. ${transition.reasons.join('; ')}`;
      }

      return { analysis: finalAnalysis, actions: allActions };
    } catch (err: any) {
      console.error(`[Sofia Agent] Agent loop failed:`, err.message);
      return {
        analysis: `Voice health ${transition.direction}: ${transition.previousStatus} → ${transition.newStatus}. Agent error: ${err.message}. ${transition.reasons.join('; ')}`,
        actions: [],
      };
    }
  }

  private async recordHealthDigest(
    transition: HealthTransition,
    analysis: string,
    remediationResults: Array<{ action: string; result: string; applied: boolean }>
  ): Promise<void> {
    try {
      const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
      const appliedActions = remediationResults.filter(r => r.applied);

      const [report] = await getUserDb().insert(sofiaIssueReports)
        .values({
          userId: 'system',
          issueType: 'voice_health_transition',
          userDescription: `[HEALTH ${transition.direction.toUpperCase()}] ${transition.previousStatus} → ${transition.newStatus}: ${transition.reasons.join('; ')}`,
          sofiaAnalysis: analysis,
          diagnosticSnapshot: {
            source: 'health_agent',
            transition: {
              previousStatus: transition.previousStatus,
              newStatus: transition.newStatus,
              direction: transition.direction,
              reasons: transition.reasons,
              timestamp: transition.timestamp.toISOString(),
            },
            metrics: transition.metrics,
            remediation: remediationResults,
          },
          environment,
          status: transition.direction === 'recovered' ? 'resolved' : 'actionable',
        })
        .returning();

      console.log(`[Sofia Agent] Digest recorded: ${report.id} (${transition.direction}, ${appliedActions.length} actions applied)`);

      await founderCollabService.emitSofiaIssueAlert({
        reportId: report.id,
        issueType: 'voice_health_transition',
        userDescription: `[HEALTH ${transition.direction.toUpperCase()}] ${transition.previousStatus} → ${transition.newStatus}`,
        environment,
        hasVoiceDiagnostics: true,
        hasClientTelemetry: false,
      }).catch(e => console.warn('[Sofia Agent] Failed to emit alert:', e));
    } catch (err: any) {
      console.error(`[Sofia Agent] Failed to record digest:`, err.message);
    }
  }

  async getHealthDigests(limit: number = 20): Promise<any[]> {
    return getUserDb().select()
      .from(sofiaIssueReports)
      .where(eq(sofiaIssueReports.issueType, 'voice_health_transition'))
      .orderBy(desc(sofiaIssueReports.createdAt))
      .limit(limit);
  }
}

export const supportPersonaService = new SupportPersonaService();
