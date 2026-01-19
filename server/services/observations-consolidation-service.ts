/**
 * Observations Consolidation Service
 * 
 * Consolidates semantically similar agent/support observations to reduce database growth.
 * Uses AI to detect similarity clusters, then merges them with priority boosting.
 * 
 * Key behaviors:
 * - Groups observations by category first (only compare within same category)
 * - Uses AI to detect semantic similarity (looking for same core insight)
 * - Selects the "best" observation as canonical (highest priority, best wording)
 * - Boosts priority based on cluster size (more duplicates = more important)
 * - Marks superseded observations as 'archived' with reference to canonical
 * - Runs nightly as part of the sync scheduler
 */

import { db, getSharedDb } from '../db';
import { agentObservations, supportObservations } from '@shared/schema';
import type { AgentObservation, SupportObservation } from '@shared/schema';
import { eq, and, ne, desc, inArray } from 'drizzle-orm';
import { callGemini, GEMINI_MODELS } from '../gemini-utils';

interface ConsolidationResult {
  agentClustersFound: number;
  agentObservationsArchived: number;
  supportClustersFound: number;
  supportObservationsArchived: number;
  errors: string[];
}

interface SimilarityCluster {
  canonicalId: string;
  memberIds: string[];
  similarity: number;
  sharedConcept: string;
}

const MAX_OBSERVATIONS_PER_BATCH = 50; // Process in batches to avoid token limits

/**
 * Find semantically similar observations within a category using Gemini
 */
async function findObservationClusters(
  observations: Array<{ id: string; title: string; observation: string; priority: number | null }>,
  category: string
): Promise<SimilarityCluster[]> {
  if (observations.length < 2) return [];
  
  const summaries = observations.map(o => ({
    id: o.id,
    title: o.title,
    observation: o.observation.substring(0, 200),
    priority: o.priority || 50,
  }));
  
  const prompt = `You are analyzing development observations to find semantic duplicates that should be merged.

Category: ${category}

Here are the observations to analyze:
${JSON.stringify(summaries, null, 2)}

Find clusters of observations that express THE SAME core insight or issue. Only cluster observations that are truly redundant - not just related topics.

For each cluster found:
1. Identify the observation with the best wording/highest priority as "canonical"
2. List other observation IDs that should be merged into it
3. Score similarity (0.7-1.0 where 1.0 = nearly identical)
4. Describe the shared insight briefly

Return JSON array of clusters:
[
  {
    "canonicalId": "id-of-best-observation",
    "memberIds": ["id-of-duplicate-1", "id-of-duplicate-2"],
    "similarity": 0.85,
    "sharedConcept": "Brief description of the shared insight"
  }
]

Rules:
- Only include clusters with similarity >= 0.75
- A observation can only appear in ONE cluster
- If no duplicates found, return empty array []
- Prefer observations with higher priority scores as canonical`;

  try {
    const response = await callGemini(GEMINI_MODELS.FLASH, [
      { role: 'user', content: prompt }
    ]);
    
    const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
    const clusters = JSON.parse(cleanResponse) as SimilarityCluster[];
    
    return clusters.filter(c => 
      c.canonicalId && 
      Array.isArray(c.memberIds) && 
      c.memberIds.length > 0 &&
      c.similarity >= 0.75
    );
  } catch (err: any) {
    console.warn(`[OBS-CONSOLIDATION] AI clustering failed for ${category}: ${err.message}`);
    return [];
  }
}

/**
 * Consolidate agent observations by category
 */
async function consolidateAgentObservations(): Promise<{ clustersFound: number; archived: number; errors: string[] }> {
  const errors: string[] = [];
  let totalClusters = 0;
  let totalArchived = 0;
  
  // Get all active (non-archived) observations grouped by category
  const activeObservations = await getSharedDb()
    .select()
    .from(agentObservations)
    .where(ne(agentObservations.status, 'archived'))
    .orderBy(desc(agentObservations.priority));
  
  // Group by category
  const byCategory = new Map<string, AgentObservation[]>();
  for (const obs of activeObservations) {
    const cat = obs.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(obs);
  }
  
  console.log(`[OBS-CONSOLIDATION] Processing ${activeObservations.length} agent observations across ${byCategory.size} categories`);
  
  for (const [category, observations] of Array.from(byCategory.entries())) {
    if (observations.length < 2) continue;
    
    // Process in batches
    for (let i = 0; i < observations.length; i += MAX_OBSERVATIONS_PER_BATCH) {
      const batch = observations.slice(i, i + MAX_OBSERVATIONS_PER_BATCH);
      
      try {
        const clusters = await findObservationClusters(
          batch.map((o: AgentObservation) => ({ id: o.id, title: o.title, observation: o.observation, priority: o.priority })),
          category
        );
        
        for (const cluster of clusters) {
          totalClusters++;
          
          // Boost canonical observation's priority based on cluster size
          const priorityBoost = Math.min(cluster.memberIds.length * 5, 20);
          const canonical = batch.find((o: AgentObservation) => o.id === cluster.canonicalId);
          if (canonical) {
            const newPriority = Math.min((canonical.priority || 50) + priorityBoost, 100);
            
            await getSharedDb().update(agentObservations)
              .set({ 
                priority: newPriority,
                updatedAt: new Date(),
              })
              .where(eq(agentObservations.id, cluster.canonicalId));
          }
          
          // Archive the duplicates with reference to canonical
          await getSharedDb().update(agentObservations)
            .set({
              status: 'archived',
              reasoning: `Consolidated into ${cluster.canonicalId}: ${cluster.sharedConcept}`,
              updatedAt: new Date(),
            })
            .where(inArray(agentObservations.id, cluster.memberIds));
          
          totalArchived += cluster.memberIds.length;
          console.log(`[OBS-CONSOLIDATION] Agent ${category}: merged ${cluster.memberIds.length} observations -> ${cluster.canonicalId.slice(0, 8)}... (${cluster.sharedConcept})`);
        }
      } catch (err: any) {
        errors.push(`agent/${category}: ${err.message}`);
      }
    }
  }
  
  return { clustersFound: totalClusters, archived: totalArchived, errors };
}

/**
 * Consolidate support observations by category
 */
async function consolidateSupportObservations(): Promise<{ clustersFound: number; archived: number; errors: string[] }> {
  const errors: string[] = [];
  let totalClusters = 0;
  let totalArchived = 0;
  
  const activeObservations = await getSharedDb()
    .select()
    .from(supportObservations)
    .where(ne(supportObservations.status, 'archived'))
    .orderBy(desc(supportObservations.priority));
  
  const byCategory = new Map<string, SupportObservation[]>();
  for (const obs of activeObservations) {
    const cat = obs.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(obs);
  }
  
  console.log(`[OBS-CONSOLIDATION] Processing ${activeObservations.length} support observations across ${byCategory.size} categories`);
  
  for (const [category, observations] of Array.from(byCategory.entries())) {
    if (observations.length < 2) continue;
    
    for (let i = 0; i < observations.length; i += MAX_OBSERVATIONS_PER_BATCH) {
      const batch = observations.slice(i, i + MAX_OBSERVATIONS_PER_BATCH);
      
      try {
        const clusters = await findObservationClusters(
          batch.map((o: SupportObservation) => ({ id: o.id, title: o.title, observation: o.observation, priority: o.priority })),
          category
        );
        
        for (const cluster of clusters) {
          totalClusters++;
          
          const priorityBoost = Math.min(cluster.memberIds.length * 5, 20);
          const canonical = batch.find((o: SupportObservation) => o.id === cluster.canonicalId);
          if (canonical) {
            const newPriority = Math.min((canonical.priority || 50) + priorityBoost, 100);
            
            await getSharedDb().update(supportObservations)
              .set({ 
                priority: newPriority,
                updatedAt: new Date(),
              })
              .where(eq(supportObservations.id, cluster.canonicalId));
          }
          
          await getSharedDb().update(supportObservations)
            .set({
              status: 'archived',
              reasoning: `Consolidated into ${cluster.canonicalId}: ${cluster.sharedConcept}`,
              updatedAt: new Date(),
            })
            .where(inArray(supportObservations.id, cluster.memberIds));
          
          totalArchived += cluster.memberIds.length;
          console.log(`[OBS-CONSOLIDATION] Support ${category}: merged ${cluster.memberIds.length} observations -> ${cluster.canonicalId.slice(0, 8)}... (${cluster.sharedConcept})`);
        }
      } catch (err: any) {
        errors.push(`support/${category}: ${err.message}`);
      }
    }
  }
  
  return { clustersFound: totalClusters, archived: totalArchived, errors };
}

/**
 * Run full observations consolidation
 * Call this from the nightly sync scheduler
 */
export async function runObservationsConsolidation(): Promise<ConsolidationResult> {
  console.log('[OBS-CONSOLIDATION] Starting observations consolidation...');
  const startTime = Date.now();
  
  const agentResult = await consolidateAgentObservations();
  const supportResult = await consolidateSupportObservations();
  
  const result: ConsolidationResult = {
    agentClustersFound: agentResult.clustersFound,
    agentObservationsArchived: agentResult.archived,
    supportClustersFound: supportResult.clustersFound,
    supportObservationsArchived: supportResult.archived,
    errors: [...agentResult.errors, ...supportResult.errors],
  };
  
  console.log(`[OBS-CONSOLIDATION] Complete in ${Date.now() - startTime}ms:`);
  console.log(`  - Agent: ${result.agentClustersFound} clusters, ${result.agentObservationsArchived} archived`);
  console.log(`  - Support: ${result.supportClustersFound} clusters, ${result.supportObservationsArchived} archived`);
  if (result.errors.length > 0) {
    console.warn(`  - Errors: ${result.errors.length}`);
  }
  
  return result;
}

export const observationsConsolidationService = {
  runConsolidation: runObservationsConsolidation,
};
