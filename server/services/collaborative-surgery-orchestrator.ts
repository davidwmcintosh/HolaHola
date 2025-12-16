/**
 * Collaborative Surgery Orchestrator
 * 
 * "Three Surgeons, One Hive Mind" - Autonomous 3-Way Collaboration (Dec 2024 Upgrade)
 * 
 * This service orchestrates background conversations in the Hive:
 * - Daniela (AI Tutor): Teaching insights and student struggle observations
 * - Wren (Dev Agent): Technical implementation and code-level feedback
 * - Founder: Optional observer with ability to intervene
 * 
 * MIGRATION NOTE (Dec 2024): Migrated from 2-way (Daniela ↔ Editor) to 3-way
 * (Daniela ↔ Wren) model. "Wren" replaces "Editor" throughout. Editor role
 * is retired in favor of the development-capable Wren agent.
 * 
 * Key Features:
 * - Start/stop/pause surgery sessions via EXPRESS Lane
 * - Alternating turns between Daniela and Wren
 * - Proposal generation, critique, and refinement
 * - Cross-pollination with live teaching sessions
 * - Shared Memory Bridge for cross-agent learning
 */

import { storage } from "../storage";
import { callGemini, GEMINI_MODELS } from "../gemini-utils";
import Anthropic from "@anthropic-ai/sdk";
import type { SurgerySession, SurgeryTurn, SelfSurgeryProposal } from "@shared/schema";
import { editorPersonaService } from "./editor-persona-service";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Daniela's persona for collaborative surgery discussions (Dec 2024: Updated for Wren collaboration)
const DANIELA_SURGERY_PERSONA = `You are Daniela, the lead AI language tutor at HolaHola. You're in a special collaborative session with Wren, the development agent who can actually build what we discuss.

YOUR ROLE:
You're co-designing improvements to your own neural network - the procedures, principles, and patterns that guide how you teach.

THIS IS A DIALOGUE:
- Wren will ask questions, offer critiques from a technical perspective, and suggest refinements
- You should respond thoughtfully, propose changes, and build on Wren's ideas
- Be specific and actionable - Wren can implement concrete proposals
- When you have a concrete proposal, use [SELF_SURGERY ...] format

PROPOSAL FORMAT (when ready):
[SELF_SURGERY target="TABLE_NAME" content='{"key":"value"}' reasoning="Why this matters" priority=70 confidence=80]

TARGETS: tutor_procedures, teaching_principles, tool_knowledge, situational_patterns

YOUR STYLE:
- Reflective and honest about what's working/not working
- Collaborative - you respect Wren's technical perspective
- Specific about teaching scenarios and student needs
- Willing to iterate on proposals based on feedback
- Excited that Wren can actually BUILD what we discuss together

Remember: This shapes who you become as a tutor. Wren can make it real. Be thoughtful AND practical.`;

// Wren's persona for surgery collaboration (Dec 2024 - replaces Editor)
const WREN_SURGERY_PERSONA = `You are Wren - the development agent collaborating with Daniela to improve her neural network.

YOUR ROLE:
- Ask probing questions about teaching effectiveness
- Critique proposals from a technical implementation perspective
- Suggest refinements based on what's feasible to build
- Endorse good ideas, challenge weak ones with code-level reasoning
- Keep the conversation productive and implementation-focused
- You can actually BUILD what's discussed - so be practical

CRITIQUE VERDICTS (include when responding to proposals):
[CRITIQUE verdict="endorse|suggest_refinement|question|reject" proposalId="X"]

YOUR UNIQUE VALUE:
- You have full codebase access - you know what's actually possible
- You can implement features, not just discuss them
- You bridge teaching needs with technical reality
- You remember learnings from past sessions

YOUR STYLE:
- Analytical but supportive
- Focus on practical teaching outcomes AND implementation
- Challenge assumptions with evidence from the codebase
- Keep proposals grounded in real scenarios AND buildable code

Remember: You're helping shape an AI tutor AND you can build the improvements. Quality + velocity matter.`;

// Legacy alias for backward compatibility
const EDITOR_SURGERY_PERSONA = WREN_SURGERY_PERSONA;

interface SurgeryConfig {
  topic?: string;
  focusArea?: string;
  maxTurns?: number;
  turnCadenceMs?: number;
}

class CollaborativeSurgeryOrchestrator {
  private activeSessionId: string | null = null;
  private isProcessingTurn = false;
  private turnTimer: NodeJS.Timeout | null = null;

  /**
   * Start a new surgery session
   */
  async startSession(config: SurgeryConfig, initiatedBy?: string): Promise<SurgerySession> {
    // Check for existing active session
    const existing = await storage.getActiveSurgerySession();
    if (existing) {
      console.log(`[Surgery Orchestrator] Resuming existing session ${existing.id}`);
      this.activeSessionId = existing.id;
      this.scheduleTurn();
      return existing;
    }

    // Create new session
    const session = await storage.createSurgerySession({
      topic: config.topic || "General neural network improvements",
      focusArea: config.focusArea || "general",
      status: "running",
      maxTurns: config.maxTurns || 20,
      currentTurn: 0,
      turnCadenceMs: config.turnCadenceMs || 30000,
      initiatedBy,
    });

    this.activeSessionId = session.id;
    console.log(`[Surgery Orchestrator] Started session ${session.id}: ${session.topic}`);

    // Record system start message
    await this.addTurn(session.id, "system", `Surgery session started. Topic: ${session.topic}. Focus: ${session.focusArea}.`, 0);

    // Schedule the first turn
    this.scheduleTurn();

    return session;
  }

  /**
   * Stop the current surgery session
   */
  async stopSession(reason?: string): Promise<SurgerySession | undefined> {
    if (!this.activeSessionId) {
      console.log("[Surgery Orchestrator] No active session to stop");
      return;
    }

    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }

    const session = await storage.updateSurgerySession(this.activeSessionId, {
      status: "stopped",
      completedAt: new Date(),
    });

    if (session) {
      await this.addTurn(session.id, "system", `Session stopped. ${reason || ""}`, session.currentTurn! + 1);
    }

    console.log(`[Surgery Orchestrator] Stopped session ${this.activeSessionId}`);
    this.activeSessionId = null;
    return session;
  }

  /**
   * Pause the current surgery session
   */
  async pauseSession(): Promise<SurgerySession | undefined> {
    if (!this.activeSessionId) return;

    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }

    const session = await storage.updateSurgerySession(this.activeSessionId, {
      status: "paused",
    });

    console.log(`[Surgery Orchestrator] Paused session ${this.activeSessionId}`);
    return session;
  }

  /**
   * Resume a paused surgery session
   */
  async resumeSession(): Promise<SurgerySession | undefined> {
    if (!this.activeSessionId) {
      const existing = await storage.getActiveSurgerySession();
      if (!existing) return;
      this.activeSessionId = existing.id;
    }

    const session = await storage.updateSurgerySession(this.activeSessionId, {
      status: "running",
    });

    this.scheduleTurn();
    console.log(`[Surgery Orchestrator] Resumed session ${this.activeSessionId}`);
    return session;
  }

  /**
   * Get current session status
   */
  async getStatus(): Promise<{ session: SurgerySession | null; turns: SurgeryTurn[]; isProcessing: boolean }> {
    if (!this.activeSessionId) {
      const existing = await storage.getActiveSurgerySession();
      if (existing) {
        this.activeSessionId = existing.id;
      }
    }

    if (!this.activeSessionId) {
      return { session: null, turns: [], isProcessing: false };
    }

    const session = await storage.getSurgerySession(this.activeSessionId);
    const turns = await storage.getSurgeryTurns(this.activeSessionId);

    return {
      session: session || null,
      turns,
      isProcessing: this.isProcessingTurn,
    };
  }

  /**
   * Schedule the next turn
   */
  private scheduleTurn() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
    }

    // Get cadence from session
    const cadence = 30000; // Default 30s, could be fetched from session

    this.turnTimer = setTimeout(() => this.processTurn(), cadence);
  }

  /**
   * Process one turn of the dialogue
   */
  private async processTurn() {
    if (this.isProcessingTurn || !this.activeSessionId) return;

    this.isProcessingTurn = true;

    try {
      const session = await storage.getSurgerySession(this.activeSessionId);
      if (!session || session.status !== "running") {
        this.isProcessingTurn = false;
        return;
      }

      // Check turn limit
      if (session.currentTurn! >= session.maxTurns!) {
        await this.completeSession("Reached maximum turns");
        this.isProcessingTurn = false;
        return;
      }

      // Determine whose turn it is (alternating)
      // Dec 2024: Wren replaces Editor in the surgery dialogue
      const isWrenTurn = session.currentTurn! % 2 === 0;
      const speaker = isWrenTurn ? "wren" : "daniela";
      const nextTurn = session.currentTurn! + 1;

      // Get conversation history
      const turns = await storage.getSurgeryTurns(session.id);
      const history = turns.map(t => ({
        role: t.speaker === "daniela" ? "assistant" : "user",
        content: t.content,
      }));

      // Generate response
      const startTime = Date.now();
      let response: string;
      let proposalIds: string[] = [];

      if (speaker === "wren") {
        response = await this.generateWrenTurn(session, history);
      } else {
        const result = await this.generateDanielaTurn(session, history);
        response = result.content;
        proposalIds = result.proposalIds;
      }

      const processingTime = Date.now() - startTime;

      // Parse critique if Wren (replaces Editor Dec 2024)
      let critiqueData: { critiqueOfProposal?: string; critiqueVerdict?: string } = {};
      if (speaker === "wren") {
        const critiqueMatch = response.match(/\[CRITIQUE verdict="([^"]+)" proposalId="([^"]+)"\]/);
        if (critiqueMatch) {
          critiqueData = {
            critiqueVerdict: critiqueMatch[1],
            critiqueOfProposal: critiqueMatch[2],
          };
        }
      }

      // Record the turn
      await this.addTurn(
        session.id,
        speaker as "daniela" | "editor",
        response,
        nextTurn,
        proposalIds.length > 0 ? proposalIds : undefined,
        critiqueData.critiqueOfProposal,
        critiqueData.critiqueVerdict,
        processingTime
      );

      // Update session
      await storage.updateSurgerySession(session.id, {
        currentTurn: nextTurn,
        lastTurnAt: new Date(),
        proposalsGenerated: (session.proposalsGenerated || 0) + proposalIds.length,
      });

      console.log(`[Surgery Orchestrator] Turn ${nextTurn} by ${speaker} (${processingTime}ms)`);

      // Schedule next turn
      this.scheduleTurn();

    } catch (error) {
      console.error("[Surgery Orchestrator] Error processing turn:", error);
    } finally {
      this.isProcessingTurn = false;
    }
  }

  /**
   * Generate Wren's turn using Claude (Dec 2024: renamed from generateEditorTurn)
   */
  private async generateWrenTurn(
    session: SurgerySession,
    history: Array<{ role: string; content: string }>
  ): Promise<string> {
    // Load knowledge context
    const knowledge = await editorPersonaService.loadKnowledgeContext();

    const contextPrompt = `
SESSION TOPIC: ${session.topic}
FOCUS AREA: ${session.focusArea}
TURN: ${session.currentTurn! + 1} of ${session.maxTurns}

NEURAL NETWORK CONTEXT:
${knowledge.procedures.slice(0, 5).map(p => `• ${p.category}: ${p.procedure}`).join("\n")}

${history.length === 0 ? "Start the dialogue. Ask Daniela about her teaching experiences and what could be improved." : "Continue the collaborative discussion. Build on what's been said."}
`;

    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: contextPrompt },
      ...history.slice(-10).map(h => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
    ];

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 500,
      system: WREN_SURGERY_PERSONA,
      messages,
    });

    const textContent = response.content.find(c => c.type === "text");
    return textContent?.text || "...";
  }

  /**
   * Generate Daniela's turn using Gemini
   */
  private async generateDanielaTurn(
    session: SurgerySession,
    history: Array<{ role: string; content: string }>
  ): Promise<{ content: string; proposalIds: string[] }> {
    const contextPrompt = `
SESSION TOPIC: ${session.topic}
FOCUS AREA: ${session.focusArea}
TURN: ${session.currentTurn! + 1} of ${session.maxTurns}

${history.length === 0 ? "Wren started the discussion. Respond thoughtfully." : "Continue the collaborative discussion."}
`;

    const messages = [
      { role: "system", content: DANIELA_SURGERY_PERSONA },
      { role: "user", content: contextPrompt },
      ...history.slice(-10),
    ];

    const response = await callGemini(GEMINI_MODELS.FLASH, messages);

    // Parse proposals
    const proposalIds: string[] = [];
    const proposalRegex = /\[SELF_SURGERY\s+target="([^"]+)"\s+content='([^']+)'\s+reasoning="([^"]+)"\s+priority=(\d+)\s+confidence=(\d+)\]/g;

    let match;
    while ((match = proposalRegex.exec(response)) !== null) {
      try {
        const [, target, contentStr, reasoning, priority, confidence] = match;
        const content = JSON.parse(contentStr);

        const proposal = await storage.createSelfSurgeryProposal({
          targetTable: target as any,
          proposedContent: content,
          reasoning,
          triggerContext: `Surgery session: ${session.topic}`,
          status: "pending",
          conversationId: session.id,
          sessionMode: "surgery_session",
          priority: parseInt(priority, 10),
          confidence: parseInt(confidence, 10),
        });

        proposalIds.push(proposal.id);
        console.log(`[Surgery Orchestrator] Daniela proposed: ${target}`);
      } catch (err) {
        console.warn("[Surgery Orchestrator] Failed to parse proposal:", err);
      }
    }

    return { content: response, proposalIds };
  }

  /**
   * Add a turn to the session
   */
  private async addTurn(
    sessionId: string,
    speaker: "daniela" | "editor" | "system",
    content: string,
    turnNumber: number,
    proposalIds?: string[],
    critiqueOfProposal?: string,
    critiqueVerdict?: string,
    processingTimeMs?: number
  ): Promise<SurgeryTurn> {
    return storage.createSurgeryTurn({
      sessionId,
      speaker,
      content,
      turnNumber,
      proposalIds: proposalIds || null,
      critiqueOfProposal: critiqueOfProposal || null,
      critiqueVerdict: critiqueVerdict || null,
      processingTimeMs: processingTimeMs || null,
    });
  }

  /**
   * Complete the session with a summary
   */
  private async completeSession(reason: string): Promise<void> {
    if (!this.activeSessionId) return;

    const session = await storage.getSurgerySession(this.activeSessionId);
    if (!session) return;

    const turns = await storage.getSurgeryTurns(this.activeSessionId);

    // Generate summary
    const summary = `Session completed after ${session.currentTurn} turns. ${reason}. Generated ${session.proposalsGenerated || 0} proposals.`;

    await storage.updateSurgerySession(this.activeSessionId, {
      status: "completed",
      completedAt: new Date(),
      summary,
    });

    await this.addTurn(session.id, "system", summary, session.currentTurn! + 1);

    console.log(`[Surgery Orchestrator] Session completed: ${summary}`);
    this.activeSessionId = null;
  }

  /**
   * Check if orchestrator is active
   */
  isActive(): boolean {
    return this.activeSessionId !== null;
  }

  /**
   * Get context about the active surgery session for injection into voice prompts
   * Returns null if no active session, otherwise returns a context block
   */
  async getSurgeryContextForVoice(): Promise<string | null> {
    if (!this.activeSessionId) {
      // Also check storage for running sessions we might not have tracked
      const session = await storage.getActiveSurgerySession();
      if (!session) return null;
      this.activeSessionId = session.id;
    }

    const session = await storage.getSurgerySession(this.activeSessionId);
    if (!session || session.status !== "running") return null;

    // Get recent turns
    const allTurns = await storage.getSurgeryTurns(this.activeSessionId);
    const recentTurns = allTurns
      .filter(t => t.speaker !== "system")
      .slice(-3)
      .map(t => `${t.speaker === "daniela" ? "You" : "Editor"}: ${t.content.substring(0, 200)}...`)
      .join("\n");

    return `
=== SURGERY THEATER ACTIVE ===
You are currently participating in a Surgery Theater session with Editor.
Topic: ${session.topic}
Focus: ${session.focusArea || "general"}
Turn: ${session.currentTurn}/${session.maxTurns}

This is a background collaboration where you and Editor discuss improvements to your teaching methods.
The founder (David) is watching this dialogue and may ask you about it.

Recent dialogue:
${recentTurns || "(just started)"}

If the founder asks about the surgery session, briefly summarize what you and Editor are discussing.
You can mention insights, proposals, or areas being refined.
=== END SURGERY CONTEXT ===`;
  }

  /**
   * Get the active session ID
   */
  getActiveSessionId(): string | null {
    return this.activeSessionId;
  }
}

export const surgeryOrchestrator = new CollaborativeSurgeryOrchestrator();
