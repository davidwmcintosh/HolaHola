import { brainHealthTelemetry } from './brain-health-telemetry';
import { neuralNetworkSync } from './neural-network-sync';
import { getSharedDb } from '../db';
import {
  selfBestPractices,
  toolKnowledge,
  tutorProcedures,
  teachingPrinciples,
  learnerErrorPatterns,
  linguisticBridges,
  culturalNuances,
  dialectVariations,
  subtletyCues,
  emotionalPatterns,
  creativityTemplates,
} from '@shared/schema';
import { eq, and, gte, sql, desc } from 'drizzle-orm';

export type BrainHealthStatus = 'green' | 'yellow' | 'red';

export interface HealthDimension {
  name: string;
  status: BrainHealthStatus;
  score: number;
  reasons: string[];
  metrics: Record<string, any>;
}

export interface BrainHealthReport {
  overallStatus: BrainHealthStatus;
  overallScore: number;
  dimensions: {
    memory: HealthDimension;
    neuralRetrieval: HealthDimension;
    neuralSync: HealthDimension;
    studentLearning: HealthDimension;
    toolOrchestration: HealthDimension;
    contextInjection: HealthDimension;
  };
  timestamp: Date;
}

export interface BrainHealthTransition {
  previousStatus: BrainHealthStatus;
  newStatus: BrainHealthStatus;
  direction: 'degraded' | 'recovered' | 'worsened';
  reasons: string[];
  report: BrainHealthReport;
  timestamp: Date;
}

type TransitionCallback = (transition: BrainHealthTransition) => Promise<void>;

let currentStatus: BrainHealthStatus = 'green';
let checkInterval: NodeJS.Timeout | null = null;
const transitionCallbacks: TransitionCallback[] = [];

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

export function onBrainHealthStatusChange(cb: TransitionCallback): void {
  transitionCallbacks.push(cb);
}

export function startBrainHealthAggregator(): void {
  if (checkInterval) return;
  console.log('[BrainHealthAggregator] Started — unified brain health check every 15min');

  checkInterval = setInterval(async () => {
    try {
      await runBrainHealthCheck();
    } catch (err: any) {
      console.error('[BrainHealthAggregator] Check failed:', err.message);
    }
  }, CHECK_INTERVAL_MS);
}

export function stopBrainHealthAggregator(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

export async function runBrainHealthCheck(): Promise<BrainHealthReport> {
  const [memory, neuralRetrieval, neuralSync, studentLearning, toolOrchestration, contextInjection] =
    await Promise.all([
      assessMemoryHealth(),
      assessNeuralRetrievalHealth(),
      assessNeuralSyncHealth(),
      assessStudentLearningHealth(),
      assessToolOrchestrationHealth(),
      assessContextInjectionHealth(),
    ]);

  const dimensions = { memory, neuralRetrieval, neuralSync, studentLearning, toolOrchestration, contextInjection };

  const weights: Record<string, number> = {
    memory: 0.25,
    neuralRetrieval: 0.20,
    neuralSync: 0.10,
    studentLearning: 0.20,
    toolOrchestration: 0.10,
    contextInjection: 0.15,
  };
  const overallScore = Math.round(
    Object.entries(dimensions).reduce((sum, [key, dim]) => sum + dim.score * (weights[key] || 0.15), 0)
  );

  const hasRed = Object.values(dimensions).some(d => d.status === 'red');
  const yellowCount = Object.values(dimensions).filter(d => d.status === 'yellow').length;

  let overallStatus: BrainHealthStatus;
  if (hasRed || overallScore < 40) overallStatus = 'red';
  else if (yellowCount >= 2 || overallScore < 70) overallStatus = 'yellow';
  else overallStatus = 'green';

  const report: BrainHealthReport = {
    overallStatus,
    overallScore,
    dimensions,
    timestamp: new Date(),
  };

  if (overallStatus !== currentStatus) {
    const previousStatus = currentStatus;
    currentStatus = overallStatus;

    let direction: BrainHealthTransition['direction'];
    const statusRank = { green: 0, yellow: 1, red: 2 };
    if (statusRank[overallStatus] > statusRank[previousStatus]) {
      direction = statusRank[overallStatus] - statusRank[previousStatus] > 1 ? 'worsened' : 'degraded';
    } else {
      direction = 'recovered';
    }

    const allReasons = Object.values(dimensions)
      .filter(d => d.status !== 'green')
      .flatMap(d => d.reasons.map(r => `[${d.name}] ${r}`));

    const transition: BrainHealthTransition = {
      previousStatus,
      newStatus: overallStatus,
      direction,
      reasons: allReasons.length > 0 ? allReasons : [`Overall brain health ${direction}: ${previousStatus} → ${overallStatus}`],
      report,
      timestamp: new Date(),
    };

    console.log(`[BrainHealthAggregator] ${direction.toUpperCase()}: ${previousStatus} → ${overallStatus} | ${allReasons.join('; ')}`);

    for (const cb of transitionCallbacks) {
      cb(transition).catch(err => console.error('[BrainHealthAggregator] Callback error:', err.message));
    }
  } else {
    const nonGreen = Object.values(dimensions).filter(d => d.status !== 'green');
    if (nonGreen.length > 0) {
      console.log(`[BrainHealthAggregator] Status: ${overallStatus} (score: ${overallScore}) | Issues: ${nonGreen.map(d => `${d.name}=${d.status}`).join(', ')}`);
    }
  }

  return report;
}

export function getCurrentBrainStatus(): BrainHealthStatus {
  return currentStatus;
}

async function assessMemoryHealth(): Promise<HealthDimension> {
  const reasons: string[] = [];
  let score = 100;

  try {
    const metrics = await brainHealthTelemetry.getMemoryHealthMetrics(1);
    const anomalies = await brainHealthTelemetry.detectAnomalies(1);

    if (metrics.totalRetrievals === 0 && metrics.totalInjections === 0) {
      return { name: 'Memory', status: 'green', score: 100, reasons: ['No memory activity in last hour (idle)'], metrics };
    }

    if (metrics.injectionRate < 0.3) {
      score -= 25;
      reasons.push(`Low injection rate: ${Math.round(metrics.injectionRate * 100)}% (threshold: 30%)`);
    }

    if (metrics.avgRelevance > 0 && metrics.avgRelevance < 0.4) {
      score -= 20;
      reasons.push(`Low memory relevance: ${metrics.avgRelevance.toFixed(2)} (threshold: 0.4)`);
    }

    if (metrics.redundancyRate > 0.5) {
      score -= 15;
      reasons.push(`High memory redundancy: ${Math.round(metrics.redundancyRate * 100)}% duplicates`);
    }

    if (metrics.avgFreshnessDays > 30) {
      score -= 15;
      reasons.push(`Stale memories: avg ${Math.round(metrics.avgFreshnessDays)} days old`);
    }

    const memStarvation = anomalies.anomalies.find(a => a.type === 'memory_starvation');
    if (memStarvation) {
      score -= memStarvation.severity === 'critical' ? 25 : 15;
      reasons.push(memStarvation.message);
    }

    const highLatency = anomalies.anomalies.find(a => a.type === 'high_latency');
    if (highLatency) {
      score -= highLatency.severity === 'critical' ? 20 : 10;
      reasons.push(highLatency.message);
    }

    score = Math.max(0, score);
    const status: BrainHealthStatus = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red';

    return { name: 'Memory', status, score, reasons: reasons.length > 0 ? reasons : ['Memory system healthy'], metrics };
  } catch (err: any) {
    return { name: 'Memory', status: 'yellow', score: 50, reasons: [`Assessment error: ${err.message}`], metrics: {} };
  }
}

async function assessNeuralRetrievalHealth(): Promise<HealthDimension> {
  const reasons: string[] = [];
  let score = 100;

  try {
    const [procedures, principles, errorPatterns, bridges, nuances, dialects, cues, emotional, creative, bestPractices] =
      await Promise.all([
        getSharedDb().select({ count: sql<number>`count(*)` }).from(tutorProcedures).where(eq(tutorProcedures.isActive, true)),
        getSharedDb().select({ count: sql<number>`count(*)` }).from(teachingPrinciples).where(eq(teachingPrinciples.isActive, true)),
        getSharedDb().select({ count: sql<number>`count(*)` }).from(learnerErrorPatterns).where(eq(learnerErrorPatterns.isActive, true)),
        getSharedDb().select({ count: sql<number>`count(*)` }).from(linguisticBridges).where(eq(linguisticBridges.isActive, true)),
        getSharedDb().select({ count: sql<number>`count(*)` }).from(culturalNuances).where(eq(culturalNuances.isActive, true)),
        getSharedDb().select({ count: sql<number>`count(*)` }).from(dialectVariations).where(eq(dialectVariations.isActive, true)),
        getSharedDb().select({ count: sql<number>`count(*)` }).from(subtletyCues).where(eq(subtletyCues.isActive, true)),
        getSharedDb().select({ count: sql<number>`count(*)` }).from(emotionalPatterns).where(eq(emotionalPatterns.isActive, true)),
        getSharedDb().select({ count: sql<number>`count(*)` }).from(creativityTemplates).where(eq(creativityTemplates.isActive, true)),
        getSharedDb().select({ count: sql<number>`count(*)` }).from(selfBestPractices),
      ]);

    const tableCounts: Record<string, number> = {
      procedures: Number(procedures[0]?.count ?? 0),
      principles: Number(principles[0]?.count ?? 0),
      errorPatterns: Number(errorPatterns[0]?.count ?? 0),
      bridges: Number(bridges[0]?.count ?? 0),
      nuances: Number(nuances[0]?.count ?? 0),
      dialects: Number(dialects[0]?.count ?? 0),
      subtletyCues: Number(cues[0]?.count ?? 0),
      emotionalPatterns: Number(emotional[0]?.count ?? 0),
      creativityTemplates: Number(creative[0]?.count ?? 0),
      bestPractices: Number(bestPractices[0]?.count ?? 0),
    };

    const criticalTables = ['procedures', 'principles'];
    for (const table of criticalTables) {
      if (tableCounts[table] === 0) {
        score -= 30;
        reasons.push(`CRITICAL: ${table} table is empty — Daniela has no ${table}`);
      }
    }

    const importantTables = ['errorPatterns', 'bridges', 'subtletyCues', 'emotionalPatterns'];
    for (const table of importantTables) {
      if (tableCounts[table] === 0) {
        score -= 10;
        reasons.push(`${table} table is empty`);
      }
    }

    const totalKnowledge = Object.values(tableCounts).reduce((a, b) => a + b, 0);
    if (totalKnowledge < 20) {
      score -= 20;
      reasons.push(`Low total neural knowledge: ${totalKnowledge} entries across all tables`);
    }

    const tools = await getSharedDb().select({ count: sql<number>`count(*)` }).from(toolKnowledge).where(eq(toolKnowledge.isActive, true));
    const toolCount = Number(tools[0]?.count ?? 0);
    if (toolCount === 0) {
      score -= 25;
      reasons.push('Tool knowledge table empty — Daniela cannot use any tools');
    }

    score = Math.max(0, score);
    const status: BrainHealthStatus = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red';

    return {
      name: 'Neural Retrieval',
      status,
      score,
      reasons: reasons.length > 0 ? reasons : ['Neural network knowledge base healthy'],
      metrics: { tableCounts, toolCount, totalKnowledge },
    };
  } catch (err: any) {
    return { name: 'Neural Retrieval', status: 'yellow', score: 50, reasons: [`Assessment error: ${err.message}`], metrics: {} };
  }
}

async function assessNeuralSyncHealth(): Promise<HealthDimension> {
  const reasons: string[] = [];
  let score = 100;

  try {
    const syncStats = await neuralNetworkSync.getSyncStats();

    if (syncStats.pendingPromotions > 20) {
      score -= 20;
      reasons.push(`Large promotion backlog: ${syncStats.pendingPromotions} pending items`);
    } else if (syncStats.pendingPromotions > 10) {
      score -= 10;
      reasons.push(`Growing promotion backlog: ${syncStats.pendingPromotions} pending items`);
    }

    if (syncStats.lastSyncTime) {
      const hoursSinceSync = (Date.now() - syncStats.lastSyncTime.getTime()) / (1000 * 60 * 60);
      if (hoursSinceSync > 48) {
        score -= 25;
        reasons.push(`Last sync was ${Math.round(hoursSinceSync)} hours ago (threshold: 48h)`);
      } else if (hoursSinceSync > 36) {
        score -= 10;
        reasons.push(`Last sync was ${Math.round(hoursSinceSync)} hours ago`);
      }
    }

    score = Math.max(0, score);
    const status: BrainHealthStatus = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red';

    return {
      name: 'Neural Sync',
      status,
      score,
      reasons: reasons.length > 0 ? reasons : ['Neural network sync healthy'],
      metrics: syncStats,
    };
  } catch (err: any) {
    return { name: 'Neural Sync', status: 'yellow', score: 50, reasons: [`Assessment error: ${err.message}`], metrics: {} };
  }
}

async function assessStudentLearningHealth(): Promise<HealthDimension> {
  const reasons: string[] = [];
  let score = 100;

  try {
    const coverage = await brainHealthTelemetry.getStudentCoverage();
    const factMetrics = await brainHealthTelemetry.getFactExtractionMetrics(1);

    if (coverage.studentsWithActivity === 0) {
      return {
        name: 'Student Learning',
        status: 'green',
        score: 100,
        reasons: ['No student activity (idle)'],
        metrics: { coverage, factMetrics },
      };
    }

    if (coverage.studentsWithSparseMemory > 0) {
      const sparseRate = coverage.studentsWithSparseMemory / coverage.studentsWithActivity;
      if (sparseRate > 0.5) {
        score -= 25;
        reasons.push(`${Math.round(sparseRate * 100)}% of active students have sparse memory (<5 facts)`);
      } else if (sparseRate > 0.3) {
        score -= 10;
        reasons.push(`${Math.round(sparseRate * 100)}% of active students have sparse memory`);
      }
    }

    if (factMetrics.totalFacts > 5 && factMetrics.specificityRate < 0.4) {
      score -= 20;
      reasons.push(`Low fact specificity: ${Math.round(factMetrics.specificityRate * 100)}% specific (threshold: 40%)`);
    }

    if (factMetrics.totalFacts > 0 && factMetrics.vagueFacts > factMetrics.specificFacts * 2) {
      score -= 10;
      reasons.push(`Too many vague facts: ${factMetrics.vagueFacts} vague vs ${factMetrics.specificFacts} specific`);
    }

    score = Math.max(0, score);
    const status: BrainHealthStatus = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red';

    return {
      name: 'Student Learning',
      status,
      score,
      reasons: reasons.length > 0 ? reasons : ['Student learning intelligence healthy'],
      metrics: { coverage, factMetrics },
    };
  } catch (err: any) {
    return { name: 'Student Learning', status: 'yellow', score: 50, reasons: [`Assessment error: ${err.message}`], metrics: {} };
  }
}

async function assessToolOrchestrationHealth(): Promise<HealthDimension> {
  const reasons: string[] = [];
  let score = 100;

  try {
    const toolBreakdown = await brainHealthTelemetry.getToolBreakdown(1);
    const actionBreakdown = await brainHealthTelemetry.getActionTriggerBreakdown(1);
    const anomalies = await brainHealthTelemetry.detectAnomalies(1);

    const totalToolCalls = Object.values(toolBreakdown).reduce((a, b) => a + b, 0);
    const totalActions = Object.values(actionBreakdown).reduce((a, b) => a + b, 0);

    if (totalToolCalls === 0 && totalActions === 0) {
      return {
        name: 'Tool Orchestration',
        status: 'green',
        score: 100,
        reasons: ['No tool/action activity in last day (idle)'],
        metrics: { toolBreakdown, actionBreakdown },
      };
    }

    const highLatency = anomalies.anomalies.find(a => a.type === 'high_latency');
    if (highLatency) {
      score -= highLatency.severity === 'critical' ? 25 : 15;
      reasons.push(`Tool latency: ${highLatency.message}`);
    }

    if (anomalies.healthScore < 50) {
      score -= 20;
      reasons.push(`Brain anomaly score critical: ${anomalies.healthScore}/100`);
    } else if (anomalies.healthScore < 70) {
      score -= 10;
      reasons.push(`Brain anomaly score degraded: ${anomalies.healthScore}/100`);
    }

    score = Math.max(0, score);
    const status: BrainHealthStatus = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red';

    return {
      name: 'Tool Orchestration',
      status,
      score,
      reasons: reasons.length > 0 ? reasons : ['Tool orchestration healthy'],
      metrics: { toolBreakdown, actionBreakdown, anomalyScore: anomalies.healthScore },
    };
  } catch (err: any) {
    return { name: 'Tool Orchestration', status: 'yellow', score: 50, reasons: [`Assessment error: ${err.message}`], metrics: {} };
  }
}

async function assessContextInjectionHealth(): Promise<HealthDimension> {
  const reasons: string[] = [];
  let score = 100;

  try {
    const health = await brainHealthTelemetry.getContextInjectionHealth(1);

    if (health.totalEvents === 0) {
      return {
        name: 'Context Injection',
        status: 'green',
        score: 100,
        reasons: ['No context injection activity in last hour (idle)'],
        metrics: health,
      };
    }

    const CRITICAL_SOURCES = ['classroom', 'student_intelligence'];

    for (const src of CRITICAL_SOURCES) {
      const sourceStats = health.sources[src];
      if (sourceStats && sourceStats.successRate < 50) {
        score -= 30;
        reasons.push(`CRITICAL source "${src}" failing: ${sourceStats.successRate}% success`);
      } else if (sourceStats && sourceStats.successRate < 80) {
        score -= 15;
        reasons.push(`Critical source "${src}" degraded: ${sourceStats.successRate}% success`);
      }
    }

    if (health.overallSuccessRate < 60) {
      score -= 20;
      reasons.push(`Overall context injection success rate: ${health.overallSuccessRate}%`);
    } else if (health.overallSuccessRate < 80) {
      score -= 10;
      reasons.push(`Context injection success rate degraded: ${health.overallSuccessRate}%`);
    }

    if (health.slowestSource) {
      const slowest = health.sources[health.slowestSource];
      if (slowest && slowest.avgLatencyMs > 2000) {
        score -= 10;
        reasons.push(`Slow context source "${health.slowestSource}": ${slowest.avgLatencyMs}ms avg`);
      }
    }

    score = Math.max(0, score);
    const status: BrainHealthStatus = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red';

    return {
      name: 'Context Injection',
      status,
      score,
      reasons: reasons.length > 0 ? reasons : ['Context injection healthy'],
      metrics: health,
    };
  } catch (err: any) {
    return { name: 'Context Injection', status: 'yellow', score: 50, reasons: [`Assessment error: ${err.message}`], metrics: {} };
  }
}
