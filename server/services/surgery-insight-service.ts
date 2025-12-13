/**
 * Surgery Insight Service
 * 
 * When a self-surgery proposal is approved, this service inserts the insight
 * directly into the appropriate neural network table:
 * - procedure → tutorProcedures
 * - principle → teachingPrinciples
 * - tool → toolKnowledge
 * - pattern → situationalPatterns
 * 
 * The originProposalId field links back to the source proposal for tracking.
 * 
 * Philosophy: Surgery insights become first-class neural network knowledge,
 * not separate prompt injections. This allows the procedural memory retrieval
 * system to include them naturally alongside manually-curated knowledge.
 */

import { db } from "../db";
import {
  tutorProcedures,
  toolKnowledge,
  situationalPatterns,
  teachingPrinciples,
  selfSurgeryProposals,
  InsertTutorProcedure,
  InsertToolKnowledge,
  InsertSituationalPattern,
  InsertTeachingPrinciple,
  TutorProcedure,
  ToolKnowledge,
  SituationalPattern,
  TeachingPrinciple,
} from "@shared/schema";
import { eq, sql, isNotNull } from "drizzle-orm";

// Type for surgery proposal types
export type SurgeryInsightType = 'procedure' | 'principle' | 'tool' | 'pattern';

// Result of promoting a surgery insight
export interface PromotionResult {
  success: boolean;
  insightType: SurgeryInsightType;
  insertedId?: string;
  error?: string;
}

// Insight structure parsed from surgery proposal
export interface ParsedInsight {
  type: SurgeryInsightType;
  title: string;
  description: string;
  situation?: string;
  action?: string;
  examples?: string[];
  tags?: string[];
  language?: string;
  category?: string;
}

/**
 * Parse a surgery proposal's content into a structured insight
 */
export function parseSurgeryProposal(proposalContent: string, proposalType: string): ParsedInsight | null {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(proposalContent);
    return {
      type: mapProposalTypeToInsightType(proposalType),
      title: parsed.title || parsed.name || 'Untitled Insight',
      description: parsed.description || parsed.content || proposalContent,
      situation: parsed.situation || parsed.when || parsed.trigger,
      action: parsed.action || parsed.what || parsed.response,
      examples: parsed.examples || [],
      tags: parsed.tags || [],
      language: parsed.language,
      category: parsed.category,
    };
  } catch {
    // Fallback: treat as plain text description
    return {
      type: mapProposalTypeToInsightType(proposalType),
      title: 'Auto-generated Insight',
      description: proposalContent,
    };
  }
}

/**
 * Map proposal type string to SurgeryInsightType
 */
function mapProposalTypeToInsightType(proposalType: string): SurgeryInsightType {
  const typeMap: Record<string, SurgeryInsightType> = {
    'procedure': 'procedure',
    'principle': 'principle',
    'tool': 'tool',
    'tool_knowledge': 'tool',
    'pattern': 'pattern',
    'situational_pattern': 'pattern',
    'teaching_principle': 'principle',
    'tutor_procedure': 'procedure',
  };
  
  return typeMap[proposalType.toLowerCase()] || 'procedure';
}

/**
 * Promote an approved surgery proposal into the neural network
 */
export async function promoteSurgeryInsight(
  proposalId: string,
  insight: ParsedInsight
): Promise<PromotionResult> {
  try {
    let insertedId: string | undefined;
    
    switch (insight.type) {
      case 'procedure':
        insertedId = await insertTutorProcedure(proposalId, insight);
        break;
      case 'principle':
        insertedId = await insertTeachingPrinciple(proposalId, insight);
        break;
      case 'tool':
        insertedId = await insertToolKnowledge(proposalId, insight);
        break;
      case 'pattern':
        insertedId = await insertSituationalPattern(proposalId, insight);
        break;
      default:
        return {
          success: false,
          insightType: insight.type,
          error: `Unknown insight type: ${insight.type}`,
        };
    }
    
    console.log(`[Surgery Insight] Promoted proposal ${proposalId} to ${insight.type} (id: ${insertedId})`);
    
    return {
      success: true,
      insightType: insight.type,
      insertedId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Surgery Insight] Failed to promote proposal ${proposalId}:`, errorMessage);
    
    return {
      success: false,
      insightType: insight.type,
      error: errorMessage,
    };
  }
}

/**
 * Insert a new tutor procedure from surgery insight
 */
async function insertTutorProcedure(proposalId: string, insight: ParsedInsight): Promise<string> {
  const data: InsertTutorProcedure = {
    category: insight.category || 'teaching',
    trigger: insight.situation || 'general',
    title: insight.title,
    procedure: insight.action || insight.description,
    examples: insight.examples || null,
    language: insight.language || null,
    isActive: true,
    originProposalId: proposalId,
  };
  
  const [inserted] = await db.insert(tutorProcedures)
    .values(data)
    .returning();
  
  return inserted.id;
}

/**
 * Insert a new teaching principle from surgery insight
 */
async function insertTeachingPrinciple(proposalId: string, insight: ParsedInsight): Promise<string> {
  const data: InsertTeachingPrinciple = {
    category: insight.category || 'pedagogy',
    principle: insight.description,
    application: insight.action || null,
    examples: insight.examples || null,
    isActive: true,
    originProposalId: proposalId,
  };
  
  const [inserted] = await db.insert(teachingPrinciples)
    .values(data)
    .returning();
  
  return inserted.id;
}

/**
 * Insert new tool knowledge from surgery insight
 */
async function insertToolKnowledge(proposalId: string, insight: ParsedInsight): Promise<string> {
  const data: InsertToolKnowledge = {
    toolName: insight.title,
    toolType: insight.category || 'whiteboard_command',
    purpose: insight.description,
    syntax: insight.action || insight.examples?.[0] || 'See examples',
    examples: insight.examples || null,
    isActive: true,
    originProposalId: proposalId,
  };
  
  const [inserted] = await db.insert(toolKnowledge)
    .values(data)
    .returning();
  
  return inserted.id;
}

/**
 * Insert a new situational pattern from surgery insight
 */
async function insertSituationalPattern(proposalId: string, insight: ParsedInsight): Promise<string> {
  const data: InsertSituationalPattern = {
    patternName: insight.title,
    description: insight.description,
    guidance: insight.action || null,
    isActive: true,
    originProposalId: proposalId,
  };
  
  const [inserted] = await db.insert(situationalPatterns)
    .values(data)
    .returning();
  
  return inserted.id;
}

/**
 * Get all surgery-originated insights (for audit/display)
 */
export async function getSurgeryOriginatedInsights(): Promise<{
  procedures: TutorProcedure[];
  principles: TeachingPrinciple[];
  tools: ToolKnowledge[];
  patterns: SituationalPattern[];
}> {
  const [procedures, principles, tools, patterns] = await Promise.all([
    db.select().from(tutorProcedures).where(isNotNull(tutorProcedures.originProposalId)),
    db.select().from(teachingPrinciples).where(isNotNull(teachingPrinciples.originProposalId)),
    db.select().from(toolKnowledge).where(isNotNull(toolKnowledge.originProposalId)),
    db.select().from(situationalPatterns).where(isNotNull(situationalPatterns.originProposalId)),
  ]);
  
  return { procedures, principles, tools, patterns };
}

/**
 * Retract (deactivate) a surgery-originated insight
 */
export async function retractSurgeryInsight(
  insightType: SurgeryInsightType,
  insightId: string
): Promise<boolean> {
  try {
    switch (insightType) {
      case 'procedure':
        await db.update(tutorProcedures)
          .set({ isActive: false })
          .where(eq(tutorProcedures.id, insightId));
        break;
      case 'principle':
        await db.update(teachingPrinciples)
          .set({ isActive: false })
          .where(eq(teachingPrinciples.id, insightId));
        break;
      case 'tool':
        await db.update(toolKnowledge)
          .set({ isActive: false })
          .where(eq(toolKnowledge.id, insightId));
        break;
      case 'pattern':
        await db.update(situationalPatterns)
          .set({ isActive: false })
          .where(eq(situationalPatterns.id, insightId));
        break;
    }
    
    console.log(`[Surgery Insight] Retracted ${insightType} insight ${insightId}`);
    return true;
  } catch (error) {
    console.error(`[Surgery Insight] Failed to retract ${insightType} ${insightId}:`, error);
    return false;
  }
}

/**
 * Reactivate a previously retracted surgery insight
 */
export async function reactivateSurgeryInsight(
  insightType: SurgeryInsightType,
  insightId: string
): Promise<boolean> {
  try {
    switch (insightType) {
      case 'procedure':
        await db.update(tutorProcedures)
          .set({ isActive: true })
          .where(eq(tutorProcedures.id, insightId));
        break;
      case 'principle':
        await db.update(teachingPrinciples)
          .set({ isActive: true })
          .where(eq(teachingPrinciples.id, insightId));
        break;
      case 'tool':
        await db.update(toolKnowledge)
          .set({ isActive: true })
          .where(eq(toolKnowledge.id, insightId));
        break;
      case 'pattern':
        await db.update(situationalPatterns)
          .set({ isActive: true })
          .where(eq(situationalPatterns.id, insightId));
        break;
    }
    
    console.log(`[Surgery Insight] Reactivated ${insightType} insight ${insightId}`);
    return true;
  } catch (error) {
    console.error(`[Surgery Insight] Failed to reactivate ${insightType} ${insightId}:`, error);
    return false;
  }
}

/**
 * Count surgery-originated insights by type
 */
export async function countSurgeryInsights(): Promise<Record<SurgeryInsightType, { active: number; inactive: number }>> {
  const [procedures, principles, tools, patterns] = await Promise.all([
    db.select({
      active: sql<number>`count(*) filter (where is_active = true)`,
      inactive: sql<number>`count(*) filter (where is_active = false)`,
    })
      .from(tutorProcedures)
      .where(isNotNull(tutorProcedures.originProposalId)),
    db.select({
      active: sql<number>`count(*) filter (where is_active = true)`,
      inactive: sql<number>`count(*) filter (where is_active = false)`,
    })
      .from(teachingPrinciples)
      .where(isNotNull(teachingPrinciples.originProposalId)),
    db.select({
      active: sql<number>`count(*) filter (where is_active = true)`,
      inactive: sql<number>`count(*) filter (where is_active = false)`,
    })
      .from(toolKnowledge)
      .where(isNotNull(toolKnowledge.originProposalId)),
    db.select({
      active: sql<number>`count(*) filter (where is_active = true)`,
      inactive: sql<number>`count(*) filter (where is_active = false)`,
    })
      .from(situationalPatterns)
      .where(isNotNull(situationalPatterns.originProposalId)),
  ]);
  
  return {
    procedure: { active: Number(procedures[0]?.active ?? 0), inactive: Number(procedures[0]?.inactive ?? 0) },
    principle: { active: Number(principles[0]?.active ?? 0), inactive: Number(principles[0]?.inactive ?? 0) },
    tool: { active: Number(tools[0]?.active ?? 0), inactive: Number(tools[0]?.inactive ?? 0) },
    pattern: { active: Number(patterns[0]?.active ?? 0), inactive: Number(patterns[0]?.inactive ?? 0) },
  };
}
