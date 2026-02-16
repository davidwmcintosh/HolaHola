import { db } from '../db';
import { brainEvents } from '@shared/schema';
import { eq, and, gte } from 'drizzle-orm';

export interface ContextHealthTransition {
  previousStatus: string;
  newStatus: string;
  direction: 'degraded' | 'recovered' | 'worsened';
  reasons: string[];
  sourceBreakdown: Record<string, { successRate: number; avgLatencyMs: number; total: number; failures: number }>;
  timestamp: Date;
}

type ContextTransitionCallback = (transition: ContextHealthTransition) => Promise<void>;

let lastContextHealthStatus: string = 'green';
let monitorInterval: ReturnType<typeof setInterval> | null = null;
let onStatusChangeCallbacks: ContextTransitionCallback[] = [];

const CRITICAL_SOURCES = ['classroom', 'student_intelligence'];
const OPTIONAL_SOURCES = ['hive', 'express_lane', 'editor_feedback'];
const SUCCESS_RATE_RED = 60;
const SUCCESS_RATE_YELLOW = 85;
const LATENCY_RED_MS = 2000;
const LATENCY_YELLOW_MS = 800;

export function onContextHealthStatusChange(callback: ContextTransitionCallback): void {
  onStatusChangeCallbacks.push(callback);
}

export async function computeContextHealthStatus(): Promise<{
  status: string;
  reasons: string[];
  sourceBreakdown: Record<string, { successRate: number; avgLatencyMs: number; total: number; failures: number }>;
}> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const rows = await db.select()
    .from(brainEvents)
    .where(and(
      eq(brainEvents.eventType, 'context_injection'),
      gte(brainEvents.createdAt, oneHourAgo)
    ));

  const sourceStats: Record<string, { total: number; successes: number; failures: number; totalLatency: number }> = {};
  for (const row of rows) {
    const src = row.toolName || 'unknown';
    if (!sourceStats[src]) {
      sourceStats[src] = { total: 0, successes: 0, failures: 0, totalLatency: 0 };
    }
    sourceStats[src].total++;
    if (row.wasUsed) sourceStats[src].successes++;
    else sourceStats[src].failures++;
    sourceStats[src].totalLatency += (row.latencyMs || 0);
  }

  const sourceBreakdown: Record<string, { successRate: number; avgLatencyMs: number; total: number; failures: number }> = {};
  for (const [src, stats] of Object.entries(sourceStats)) {
    sourceBreakdown[src] = {
      successRate: stats.total > 0 ? Math.round((stats.successes / stats.total) * 100) : 100,
      avgLatencyMs: stats.total > 0 ? Math.round(stats.totalLatency / stats.total) : 0,
      total: stats.total,
      failures: stats.failures,
    };
  }

  let status: string = 'green';
  const reasons: string[] = [];

  if (rows.length === 0) {
    reasons.push('No context injection events in last hour (no active sessions or telemetry gap)');
    return { status: 'green', reasons, sourceBreakdown };
  }

  for (const src of CRITICAL_SOURCES) {
    const stats = sourceBreakdown[src];
    if (!stats) continue;
    if (stats.total < 2) continue;

    if (stats.successRate < SUCCESS_RATE_RED) {
      status = 'red';
      reasons.push(`CRITICAL: ${src} success rate ${stats.successRate}% (${stats.failures} failures in last hour)`);
    } else if (stats.successRate < SUCCESS_RATE_YELLOW && status !== 'red') {
      status = 'yellow';
      reasons.push(`${src} success rate dropping: ${stats.successRate}%`);
    }

    if (stats.avgLatencyMs > LATENCY_RED_MS) {
      if (status !== 'red') status = 'red';
      reasons.push(`CRITICAL: ${src} avg latency ${stats.avgLatencyMs}ms (threshold: ${LATENCY_RED_MS}ms)`);
    } else if (stats.avgLatencyMs > LATENCY_YELLOW_MS && status === 'green') {
      status = 'yellow';
      reasons.push(`${src} latency elevated: ${stats.avgLatencyMs}ms`);
    }
  }

  for (const src of OPTIONAL_SOURCES) {
    const stats = sourceBreakdown[src];
    if (!stats || stats.total < 2) continue;

    if (stats.successRate < SUCCESS_RATE_RED) {
      if (status === 'green') status = 'yellow';
      reasons.push(`Optional source ${src} failing: ${stats.successRate}% success rate`);
    }
    if (stats.avgLatencyMs > LATENCY_RED_MS) {
      if (status === 'green') status = 'yellow';
      reasons.push(`Optional source ${src} slow: ${stats.avgLatencyMs}ms avg latency`);
    }
  }

  if (reasons.length === 0) reasons.push('All context sources healthy');

  return { status, reasons, sourceBreakdown };
}

async function runContextHealthCheck(): Promise<void> {
  try {
    const { status, reasons, sourceBreakdown } = await computeContextHealthStatus();

    if (status !== lastContextHealthStatus) {
      const previousStatus = lastContextHealthStatus;
      const direction: ContextHealthTransition['direction'] =
        status === 'green' ? 'recovered' :
        (previousStatus === 'green' ? 'degraded' :
        (status === 'red' && previousStatus === 'yellow' ? 'worsened' : 'degraded'));

      console.log(`[ContextHealthMonitor] ${direction.toUpperCase()}: ${previousStatus} → ${status} | ${reasons.join('; ')}`);

      const transition: ContextHealthTransition = {
        previousStatus,
        newStatus: status,
        direction,
        reasons,
        sourceBreakdown,
        timestamp: new Date(),
      };

      lastContextHealthStatus = status;

      for (const callback of onStatusChangeCallbacks) {
        try {
          await callback(transition);
        } catch (err: any) {
          console.warn(`[ContextHealthMonitor] Transition callback error:`, err.message);
        }
      }
    }

    if (status === 'red') {
      console.warn(`[ContextHealthMonitor] RED ALERT: ${reasons.join('; ')}`);
    }
  } catch (err: any) {
    console.warn(`[ContextHealthMonitor] Check failed:`, err.message);
  }
}

export function startContextHealthMonitor(): void {
  const CHECK_INTERVAL = 15 * 60 * 1000;

  setTimeout(runContextHealthCheck, 30000);

  monitorInterval = setInterval(runContextHealthCheck, CHECK_INTERVAL);

  console.log(`[ContextHealthMonitor] Started — checking context injection health every 15min`);
}

export function stopContextHealthMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}
