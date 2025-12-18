/**
 * Memory Consolidation Service
 * 
 * Merges semantically similar Daniela growth memories into canonical versions.
 * Uses Gemini to detect similarity clusters, then consolidates them with importance boosting.
 * 
 * Key behaviors:
 * - Groups memories by category first (only compare within same category)
 * - Uses AI to detect semantic similarity
 * - Selects the "best" memory as canonical (highest importance, best wording)
 * - Boosts importance based on cluster size
 * - Links superseded memories to the canonical version
 * - Preserves source references for audit trail
 */

import { db } from '../db';
import { danielaGrowthMemories } from '@shared/schema';
import type { DanielaGrowthMemory, GrowthMemoryCategory } from '@shared/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { callGemini, GEMINI_MODELS } from '../gemini-utils';

interface ConsolidationResult {
  clustersFound: number;
  memoriesConsolidated: number;
  categoriesProcessed: number;
  errors: string[];
}

interface SimilarityCluster {
  canonicalId: string;
  memberIds: string[];
  similarity: number; // 0-1 score
  sharedConcept: string; // Brief description of what they share
}

/**
 * Find semantically similar memories within a category using Gemini
 */
async function findSimilarityClusters(
  memories: DanielaGrowthMemory[],
  category: GrowthMemoryCategory
): Promise<SimilarityCluster[]> {
  if (memories.length < 2) return [];
  
  // Build a summary of each memory for AI analysis
  const memorySummaries = memories.map(m => ({
    id: m.id,
    title: m.title,
    lesson: m.lesson.substring(0, 300),
    importance: m.importance || 5,
  }));
  
  const prompt = `You are analyzing Daniela's growth memories to find semantic duplicates that should be merged.

Category: ${category}

Here are the memories to analyze:
${JSON.stringify(memorySummaries, null, 2)}

Find clusters of memories that express THE SAME core lesson or concept. Only cluster memories that are truly redundant - not just related topics.

For each cluster found:
1. Identify the memory with the best wording/highest importance as "canonical"
2. List other memory IDs that should be merged into it
3. Score similarity (0.7-1.0 where 1.0 = nearly identical)
4. Describe the shared concept briefly

Return JSON array of clusters:
[
  {
    "canonicalId": "id-of-best-memory",
    "memberIds": ["id-of-duplicate-1", "id-of-duplicate-2"],
    "similarity": 0.85,
    "sharedConcept": "Brief description of the shared teaching"
  }
]

Rules:
- Only include clusters with similarity >= 0.7
- A memory can only appear in ONE cluster
- If no duplicates found, return empty array []
- Prefer memories with higher importance scores as canonical`;

  try {
    const response = await callGemini(GEMINI_MODELS.FLASH, [
      { role: 'user', content: prompt }
    ]);
    
    const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
    const clusters = JSON.parse(cleanResponse) as SimilarityCluster[];
    
    // Validate clusters
    return clusters.filter(c => 
      c.canonicalId && 
      Array.isArray(c.memberIds) && 
      c.memberIds.length > 0 &&
      c.similarity >= 0.7
    );
  } catch (err: any) {
    console.warn(`[MEMORY-CONSOLIDATION] AI clustering failed for ${category}: ${err.message}`);
    return [];
  }
}

/**
 * Merge a cluster of memories into a single canonical version
 */
async function mergeCluster(cluster: SimilarityCluster): Promise<boolean> {
  try {
    // Get the canonical memory
    const [canonical] = await db
      .select()
      .from(danielaGrowthMemories)
      .where(eq(danielaGrowthMemories.id, cluster.canonicalId))
      .limit(1);
    
    if (!canonical) {
      console.warn(`[MEMORY-CONSOLIDATION] Canonical memory ${cluster.canonicalId} not found`);
      return false;
    }
    
    // Calculate new importance: base + boost for each merged memory (max 10)
    const currentImportance = canonical.importance || 5;
    const boost = Math.min(cluster.memberIds.length * 0.5, 3); // Max +3 boost
    const newImportance = Math.min(Math.round(currentImportance + boost), 10);
    
    // Get existing consolidated sources
    const existingSources = canonical.consolidatedSourceIds || [];
    const existingCount = canonical.consolidatedFromCount || 1;
    
    // Update canonical memory with consolidation info
    await db.update(danielaGrowthMemories)
      .set({
        importance: newImportance,
        consolidatedFromCount: existingCount + cluster.memberIds.length,
        consolidatedSourceIds: [...existingSources, ...cluster.memberIds],
        updatedAt: new Date(),
      })
      .where(eq(danielaGrowthMemories.id, cluster.canonicalId));
    
    // Mark member memories as superseded and inactive
    for (const memberId of cluster.memberIds) {
      await db.update(danielaGrowthMemories)
        .set({
          supersededBy: cluster.canonicalId,
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(danielaGrowthMemories.id, memberId));
    }
    
    console.log(`[MEMORY-CONSOLIDATION] Merged ${cluster.memberIds.length} memories into ${cluster.canonicalId} (${cluster.sharedConcept})`);
    return true;
  } catch (err: any) {
    console.error(`[MEMORY-CONSOLIDATION] Failed to merge cluster: ${err.message}`);
    return false;
  }
}

/**
 * Run memory consolidation for all categories
 */
export async function runMemoryConsolidation(): Promise<ConsolidationResult> {
  console.log('[MEMORY-CONSOLIDATION] Starting memory consolidation...');
  
  const categories: GrowthMemoryCategory[] = [
    'teaching_technique',
    'timing_inflection',
    'specific_joke',
    'relationship_insight',
    'correction_received',
    'breakthrough_method',
    'cultural_nuance',
    'emotional_intelligence',
  ];
  
  const result: ConsolidationResult = {
    clustersFound: 0,
    memoriesConsolidated: 0,
    categoriesProcessed: 0,
    errors: [],
  };
  
  for (const category of categories) {
    try {
      // Get active, non-superseded memories in this category
      const memories = await db
        .select()
        .from(danielaGrowthMemories)
        .where(
          and(
            eq(danielaGrowthMemories.category, category),
            eq(danielaGrowthMemories.isActive, true),
            isNull(danielaGrowthMemories.supersededBy)
          )
        )
        .orderBy(desc(danielaGrowthMemories.importance));
      
      if (memories.length < 2) {
        console.log(`[MEMORY-CONSOLIDATION] ${category}: ${memories.length} memories (no consolidation needed)`);
        result.categoriesProcessed++;
        continue;
      }
      
      console.log(`[MEMORY-CONSOLIDATION] ${category}: Analyzing ${memories.length} memories...`);
      
      // Find similarity clusters
      const clusters = await findSimilarityClusters(memories, category);
      
      if (clusters.length === 0) {
        console.log(`[MEMORY-CONSOLIDATION] ${category}: No duplicates found`);
        result.categoriesProcessed++;
        continue;
      }
      
      console.log(`[MEMORY-CONSOLIDATION] ${category}: Found ${clusters.length} clusters to consolidate`);
      result.clustersFound += clusters.length;
      
      // Merge each cluster
      for (const cluster of clusters) {
        const success = await mergeCluster(cluster);
        if (success) {
          result.memoriesConsolidated += cluster.memberIds.length;
        } else {
          result.errors.push(`Failed to merge cluster in ${category}`);
        }
      }
      
      result.categoriesProcessed++;
    } catch (err: any) {
      console.error(`[MEMORY-CONSOLIDATION] Error processing ${category}: ${err.message}`);
      result.errors.push(`${category}: ${err.message}`);
    }
  }
  
  console.log(`[MEMORY-CONSOLIDATION] Complete: ${result.clustersFound} clusters, ${result.memoriesConsolidated} memories consolidated`);
  return result;
}

/**
 * Get consolidation statistics
 */
export async function getConsolidationStats(): Promise<{
  totalActive: number;
  totalSuperseded: number;
  totalConsolidated: number;
  byCategory: Record<string, { active: number; superseded: number }>;
}> {
  const allMemories = await db.select().from(danielaGrowthMemories);
  
  const stats = {
    totalActive: 0,
    totalSuperseded: 0,
    totalConsolidated: 0,
    byCategory: {} as Record<string, { active: number; superseded: number }>,
  };
  
  for (const memory of allMemories) {
    const cat = memory.category;
    if (!stats.byCategory[cat]) {
      stats.byCategory[cat] = { active: 0, superseded: 0 };
    }
    
    if (memory.isActive) {
      stats.totalActive++;
      stats.byCategory[cat].active++;
    } else {
      stats.totalSuperseded++;
      stats.byCategory[cat].superseded++;
    }
    
    if ((memory.consolidatedFromCount || 1) > 1) {
      stats.totalConsolidated++;
    }
  }
  
  return stats;
}

export const memoryConsolidationService = {
  runConsolidation: runMemoryConsolidation,
  getStats: getConsolidationStats,
};
