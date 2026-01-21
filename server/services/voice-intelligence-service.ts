/**
 * Voice Intelligence Service
 * 
 * Commercial-grade voice pipeline analytics with:
 * - Latency trend detection (day-over-day)
 * - Time-of-day pattern analysis
 * - Per-language failure rate analysis
 * - Student correlation analysis
 * - Automatic threshold tuning
 * - Cross-environment comparison (dev vs prod)
 * - Production-priority alerting
 * - Environment-specific baselines
 * - Real-time monitoring with alert notifications
 */

import { db, getSharedDb, getUserDb } from '../db';
import { hiveSnapshots, wrenInsights, users } from '@shared/schema';
import { eq, and, gte, lte, desc, sql, like } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

interface VoiceEvent {
  timestamp: string;
  stage: 'stt' | 'llm' | 'tts' | 'overall';
  latencyMs: number;
  success: boolean;
  language?: string;
  userId?: string;
  error?: string;
}

interface DiagnosticSnapshot {
  id: string;
  createdAt: Date;
  content: {
    eventCount?: number;
    failureCount?: number;
    stageBreakdown?: Record<string, { count: number; avgLatencyMs: number; failures: number }>;
    events?: VoiceEvent[];
    environment?: string;
  };
  context?: {
    environment?: string;
  };
}

interface LatencyTrend {
  stage: string;
  today: number;
  yesterday: number;
  weekAgo: number;
  trend: 'improving' | 'stable' | 'degrading' | 'critical';
  percentChange: number;
}

interface TimeOfDayPattern {
  hour: number;
  avgLatency: number;
  failureRate: number;
  eventCount: number;
  isPeakHour: boolean;
}

interface LanguageMetrics {
  language: string;
  eventCount: number;
  failureRate: number;
  avgLatency: number;
  worstStage: string;
}

interface StudentIssue {
  userId: string;
  email?: string;
  failureRate: number;
  avgLatency: number;
  eventCount: number;
  likelyIssue: 'network' | 'device' | 'unknown' | 'none';
}

interface EnvironmentComparison {
  metric: string;
  dev: number;
  prod: number;
  diff: number;
  diffPercent: number;
  alert: boolean;
}

interface DynamicThreshold {
  metric: string;
  baseline: number;
  stdDev: number;
  currentThreshold: number;
  previousThreshold: number;
}

interface VoiceAlert {
  severity: 'info' | 'warning' | 'critical';
  category: string;
  message: string;
  environment: 'dev' | 'prod' | 'both';
  data?: any;
}

interface VoiceIntelligenceReport {
  generatedAt: Date;
  environment: string;
  periodDays: number;
  
  // Core metrics
  totalEvents: number;
  overallFailureRate: number;
  avgLatency: number;
  
  // Enhanced analytics
  latencyTrends: LatencyTrend[];
  timeOfDayPatterns: TimeOfDayPattern[];
  languageMetrics: LanguageMetrics[];
  studentIssues: StudentIssue[];
  envComparison: EnvironmentComparison[];
  dynamicThresholds: DynamicThreshold[];
  
  // Alerts
  alerts: VoiceAlert[];
}

// ============================================================================
// BASELINE STORAGE (in-memory, persisted to hiveSnapshots)
// ============================================================================

interface HistoricalBaselines {
  lastUpdated: Date;
  latencyBaselines: Record<string, { mean: number; stdDev: number }>;
  failureBaselines: Record<string, { mean: number; stdDev: number }>;
  peakHours: number[];
}

let cachedBaselines: HistoricalBaselines | null = null;

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchVoiceDiagnostics(daysBack: number, environment?: string): Promise<DiagnosticSnapshot[]> {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  
  const snapshots = await getSharedDb()
    .select()
    .from(hiveSnapshots)
    .where(
      and(
        eq(hiveSnapshots.snapshotType, 'voice_diagnostic'),
        gte(hiveSnapshots.createdAt, since)
      )
    )
    .orderBy(desc(hiveSnapshots.createdAt));
  
  // Parse and filter by environment if specified
  const parsed: DiagnosticSnapshot[] = snapshots
    .map(s => {
      try {
        const content = typeof s.content === 'string' ? JSON.parse(s.content) : (s.content as any) || {};
        const context = typeof s.context === 'string' ? JSON.parse(s.context) : (s.context as any) || {};
        return {
          id: s.id,
          createdAt: s.createdAt,
          content: content,
          context: context,
        } as DiagnosticSnapshot;
      } catch {
        return null;
      }
    })
    .filter((s): s is DiagnosticSnapshot => s !== null);
  
  if (environment) {
    return parsed.filter(s => 
      s.content?.environment === environment || 
      s.context?.environment === environment
    );
  }
  
  return parsed;
}

async function fetchBaselines(): Promise<HistoricalBaselines> {
  if (cachedBaselines && Date.now() - cachedBaselines.lastUpdated.getTime() < 60 * 60 * 1000) {
    return cachedBaselines;
  }
  
  // Try to load from hiveSnapshots
  const [stored] = await getSharedDb()
    .select()
    .from(hiveSnapshots)
    .where(eq(hiveSnapshots.snapshotType, 'voice_baselines'))
    .orderBy(desc(hiveSnapshots.createdAt))
    .limit(1);
  
  if (stored) {
    try {
      const content = typeof stored.content === 'string' ? JSON.parse(stored.content) : stored.content;
      cachedBaselines = {
        lastUpdated: stored.createdAt,
        latencyBaselines: content.latencyBaselines || {},
        failureBaselines: content.failureBaselines || {},
        peakHours: content.peakHours || [9, 10, 11, 14, 15, 16, 19, 20],
      };
      return cachedBaselines;
    } catch {
      // Fall through to defaults
    }
  }
  
  // Return defaults
  cachedBaselines = {
    lastUpdated: new Date(),
    latencyBaselines: {
      stt: { mean: 500, stdDev: 200 },
      llm: { mean: 1500, stdDev: 500 },
      tts: { mean: 400, stdDev: 150 },
      overall: { mean: 2400, stdDev: 600 },
    },
    failureBaselines: {
      stt: { mean: 0.02, stdDev: 0.01 },
      llm: { mean: 0.01, stdDev: 0.005 },
      tts: { mean: 0.03, stdDev: 0.015 },
      overall: { mean: 0.05, stdDev: 0.02 },
    },
    peakHours: [9, 10, 11, 14, 15, 16, 19, 20],
  };
  
  return cachedBaselines;
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * 1. Latency Trend Detection - Day over day comparison
 */
function analyzeLatencyTrends(snapshots: DiagnosticSnapshot[]): LatencyTrend[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  
  const todaySnapshots = snapshots.filter(s => now - s.createdAt.getTime() < dayMs);
  const yesterdaySnapshots = snapshots.filter(s => {
    const age = now - s.createdAt.getTime();
    return age >= dayMs && age < 2 * dayMs;
  });
  const weekAgoSnapshots = snapshots.filter(s => {
    const age = now - s.createdAt.getTime();
    return age >= 6 * dayMs && age < 8 * dayMs;
  });
  
  const stages = ['stt', 'llm', 'tts', 'overall'];
  const trends: LatencyTrend[] = [];
  
  for (const stage of stages) {
    const todayAvg = computeAvgLatency(todaySnapshots, stage);
    const yesterdayAvg = computeAvgLatency(yesterdaySnapshots, stage);
    const weekAgoAvg = computeAvgLatency(weekAgoSnapshots, stage);
    
    const percentChange = yesterdayAvg > 0 
      ? ((todayAvg - yesterdayAvg) / yesterdayAvg) * 100 
      : 0;
    
    let trend: LatencyTrend['trend'] = 'stable';
    if (percentChange > 50) trend = 'critical';
    else if (percentChange > 20) trend = 'degrading';
    else if (percentChange < -10) trend = 'improving';
    
    trends.push({
      stage,
      today: Math.round(todayAvg),
      yesterday: Math.round(yesterdayAvg),
      weekAgo: Math.round(weekAgoAvg),
      trend,
      percentChange: Math.round(percentChange * 10) / 10,
    });
  }
  
  return trends;
}

function computeAvgLatency(snapshots: DiagnosticSnapshot[], stage: string): number {
  let total = 0;
  let count = 0;
  
  for (const s of snapshots) {
    const breakdown = s.content?.stageBreakdown;
    if (breakdown?.[stage]) {
      total += breakdown[stage].avgLatencyMs * breakdown[stage].count;
      count += breakdown[stage].count;
    }
  }
  
  return count > 0 ? total / count : 0;
}

/**
 * 2. Time-of-Day Pattern Analysis
 */
function analyzeTimeOfDayPatterns(snapshots: DiagnosticSnapshot[], baselines: HistoricalBaselines): TimeOfDayPattern[] {
  const hourlyData: Map<number, { latencies: number[]; failures: number; total: number }> = new Map();
  
  for (let h = 0; h < 24; h++) {
    hourlyData.set(h, { latencies: [], failures: 0, total: 0 });
  }
  
  for (const s of snapshots) {
    const hour = s.createdAt.getUTCHours();
    const data = hourlyData.get(hour)!;
    
    const eventCount = s.content?.eventCount || 0;
    const failureCount = s.content?.failureCount || 0;
    const breakdown = s.content?.stageBreakdown;
    
    data.total += eventCount;
    data.failures += failureCount;
    
    if (breakdown?.overall) {
      data.latencies.push(breakdown.overall.avgLatencyMs);
    }
  }
  
  const patterns: TimeOfDayPattern[] = [];
  
  for (const [hour, data] of Array.from(hourlyData.entries())) {
    const avgLatency = data.latencies.length > 0
      ? data.latencies.reduce((a: number, b: number) => a + b, 0) / data.latencies.length
      : 0;
    
    patterns.push({
      hour,
      avgLatency: Math.round(avgLatency),
      failureRate: data.total > 0 ? Math.round((data.failures / data.total) * 1000) / 10 : 0,
      eventCount: data.total,
      isPeakHour: baselines.peakHours.includes(hour),
    });
  }
  
  return patterns;
}

/**
 * 3. Per-Language Failure Rate Analysis
 */
function analyzeLanguageMetrics(snapshots: DiagnosticSnapshot[]): LanguageMetrics[] {
  const languageData: Map<string, { events: number; failures: number; latencies: number[]; stageFailures: Record<string, number> }> = new Map();
  
  for (const s of snapshots) {
    const events = s.content?.events || [];
    
    for (const event of events) {
      const lang = event.language || 'unknown';
      
      if (!languageData.has(lang)) {
        languageData.set(lang, { events: 0, failures: 0, latencies: [], stageFailures: {} });
      }
      
      const data = languageData.get(lang)!;
      data.events++;
      
      if (!event.success) {
        data.failures++;
        data.stageFailures[event.stage] = (data.stageFailures[event.stage] || 0) + 1;
      }
      
      if (event.latencyMs) {
        data.latencies.push(event.latencyMs);
      }
    }
  }
  
  const metrics: LanguageMetrics[] = [];
  
  for (const [language, data] of Array.from(languageData.entries())) {
    if (data.events < 10) continue; // Skip languages with too few events
    
    const worstStage = Object.entries(data.stageFailures)
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1])[0]?.[0] || 'none';
    
    metrics.push({
      language,
      eventCount: data.events,
      failureRate: Math.round((data.failures / data.events) * 1000) / 10,
      avgLatency: data.latencies.length > 0
        ? Math.round(data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length)
        : 0,
      worstStage,
    });
  }
  
  return metrics.sort((a, b) => b.failureRate - a.failureRate);
}

/**
 * 4. Student Correlation Analysis
 */
async function analyzeStudentIssues(snapshots: DiagnosticSnapshot[]): Promise<StudentIssue[]> {
  const studentData: Map<string, { events: number; failures: number; latencies: number[] }> = new Map();
  
  for (const s of snapshots) {
    const events = s.content?.events || [];
    
    for (const event of events) {
      const userId = event.userId;
      if (!userId) continue;
      
      if (!studentData.has(userId)) {
        studentData.set(userId, { events: 0, failures: 0, latencies: [] });
      }
      
      const data = studentData.get(userId)!;
      data.events++;
      
      if (!event.success) {
        data.failures++;
      }
      
      if (event.latencyMs) {
        data.latencies.push(event.latencyMs);
      }
    }
  }
  
  // Get user emails for reporting
  const userIds = Array.from(studentData.keys());
  const userMap: Map<string, string> = new Map();
  
  if (userIds.length > 0) {
    const usersData = await getUserDb()
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(sql`${users.id} IN ${userIds.slice(0, 100)}`);
    
    for (const u of usersData) {
      if (u.email) userMap.set(u.id, u.email);
    }
  }
  
  const issues: StudentIssue[] = [];
  
  for (const [userId, data] of Array.from(studentData.entries())) {
    if (data.events < 5) continue; // Skip students with too few events
    
    const failureRate = (data.failures / data.events) * 100;
    const avgLatency = data.latencies.length > 0
      ? data.latencies.reduce((a: number, b: number) => a + b, 0) / data.latencies.length
      : 0;
    
    // Determine likely issue
    let likelyIssue: StudentIssue['likelyIssue'] = 'none';
    if (failureRate > 30) {
      likelyIssue = avgLatency > 3000 ? 'network' : 'device';
    } else if (failureRate > 15 || avgLatency > 4000) {
      likelyIssue = 'unknown';
    }
    
    if (likelyIssue !== 'none') {
      issues.push({
        userId,
        email: userMap.get(userId),
        failureRate: Math.round(failureRate * 10) / 10,
        avgLatency: Math.round(avgLatency),
        eventCount: data.events,
        likelyIssue,
      });
    }
  }
  
  return issues.sort((a, b) => b.failureRate - a.failureRate).slice(0, 20);
}

/**
 * 5. Automatic Threshold Tuning
 */
async function computeDynamicThresholds(snapshots: DiagnosticSnapshot[], baselines: HistoricalBaselines): Promise<DynamicThreshold[]> {
  const thresholds: DynamicThreshold[] = [];
  const stages = ['stt', 'llm', 'tts', 'overall'];
  
  for (const stage of stages) {
    // Compute current stats from last 7 days
    const latencies: number[] = [];
    let failures = 0;
    let total = 0;
    
    for (const s of snapshots) {
      const breakdown = s.content?.stageBreakdown;
      if (breakdown?.[stage]) {
        latencies.push(breakdown[stage].avgLatencyMs);
        failures += breakdown[stage].failures;
        total += breakdown[stage].count;
      }
    }
    
    if (latencies.length > 0) {
      const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const variance = latencies.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / latencies.length;
      const stdDev = Math.sqrt(variance);
      
      const previousThreshold = baselines.latencyBaselines[stage]?.mean + 2 * (baselines.latencyBaselines[stage]?.stdDev || 0);
      const currentThreshold = mean + 2 * stdDev;
      
      thresholds.push({
        metric: `${stage}_latency`,
        baseline: Math.round(mean),
        stdDev: Math.round(stdDev),
        currentThreshold: Math.round(currentThreshold),
        previousThreshold: Math.round(previousThreshold),
      });
    }
  }
  
  return thresholds;
}

/**
 * 6 & 7. Cross-Environment Comparison
 */
async function compareEnvironments(daysBack: number): Promise<EnvironmentComparison[]> {
  const devSnapshots = await fetchVoiceDiagnostics(daysBack, 'development');
  const prodSnapshots = await fetchVoiceDiagnostics(daysBack, 'production');
  
  const comparisons: EnvironmentComparison[] = [];
  const stages = ['stt', 'llm', 'tts', 'overall'];
  
  for (const stage of stages) {
    const devLatency = computeAvgLatency(devSnapshots, stage);
    const prodLatency = computeAvgLatency(prodSnapshots, stage);
    
    const diff = prodLatency - devLatency;
    const diffPercent = devLatency > 0 ? (diff / devLatency) * 100 : 0;
    
    comparisons.push({
      metric: `${stage}_latency`,
      dev: Math.round(devLatency),
      prod: Math.round(prodLatency),
      diff: Math.round(diff),
      diffPercent: Math.round(diffPercent * 10) / 10,
      alert: Math.abs(diffPercent) > 30, // Alert if >30% difference
    });
  }
  
  // Compare failure rates
  const devFailures = devSnapshots.reduce((sum, s) => sum + (s.content?.failureCount || 0), 0);
  const devTotal = devSnapshots.reduce((sum, s) => sum + (s.content?.eventCount || 0), 0);
  const prodFailures = prodSnapshots.reduce((sum, s) => sum + (s.content?.failureCount || 0), 0);
  const prodTotal = prodSnapshots.reduce((sum, s) => sum + (s.content?.eventCount || 0), 0);
  
  const devRate = devTotal > 0 ? (devFailures / devTotal) * 100 : 0;
  const prodRate = prodTotal > 0 ? (prodFailures / prodTotal) * 100 : 0;
  
  comparisons.push({
    metric: 'failure_rate',
    dev: Math.round(devRate * 10) / 10,
    prod: Math.round(prodRate * 10) / 10,
    diff: Math.round((prodRate - devRate) * 10) / 10,
    diffPercent: devRate > 0 ? Math.round(((prodRate - devRate) / devRate) * 100) : 0,
    alert: prodRate > devRate * 1.5, // Alert if prod is 50% worse than dev
  });
  
  return comparisons;
}

/**
 * 8. Generate Alerts with Production Priority
 */
function generateAlerts(
  trends: LatencyTrend[],
  patterns: TimeOfDayPattern[],
  languages: LanguageMetrics[],
  students: StudentIssue[],
  envComparison: EnvironmentComparison[],
  thresholds: DynamicThreshold[],
  baselines: HistoricalBaselines
): VoiceAlert[] {
  const alerts: VoiceAlert[] = [];
  
  // Latency trend alerts
  for (const trend of trends) {
    if (trend.trend === 'critical') {
      alerts.push({
        severity: 'critical',
        category: 'latency_trend',
        message: `${trend.stage.toUpperCase()} latency increased ${trend.percentChange}% in 24h (${trend.yesterday}ms → ${trend.today}ms)`,
        environment: 'both',
        data: trend,
      });
    } else if (trend.trend === 'degrading') {
      alerts.push({
        severity: 'warning',
        category: 'latency_trend',
        message: `${trend.stage.toUpperCase()} latency trending up: ${trend.percentChange}% increase`,
        environment: 'both',
        data: trend,
      });
    }
  }
  
  // Peak hour degradation
  const peakHourPatterns = patterns.filter(p => p.isPeakHour && p.eventCount > 10);
  const offPeakPatterns = patterns.filter(p => !p.isPeakHour && p.eventCount > 10);
  
  if (peakHourPatterns.length > 0 && offPeakPatterns.length > 0) {
    const peakAvg = peakHourPatterns.reduce((s, p) => s + p.avgLatency, 0) / peakHourPatterns.length;
    const offPeakAvg = offPeakPatterns.reduce((s, p) => s + p.avgLatency, 0) / offPeakPatterns.length;
    
    if (peakAvg > offPeakAvg * 1.3) {
      alerts.push({
        severity: 'warning',
        category: 'peak_hours',
        message: `Voice latency ${Math.round((peakAvg / offPeakAvg - 1) * 100)}% higher during peak hours`,
        environment: 'both',
        data: { peakAvg: Math.round(peakAvg), offPeakAvg: Math.round(offPeakAvg) },
      });
    }
  }
  
  // Language-specific issues
  for (const lang of languages) {
    if (lang.failureRate > 10 && lang.eventCount > 20) {
      alerts.push({
        severity: lang.failureRate > 20 ? 'critical' : 'warning',
        category: 'language',
        message: `${lang.language} has ${lang.failureRate}% failure rate (${lang.eventCount} events), worst stage: ${lang.worstStage}`,
        environment: 'both',
        data: lang,
      });
    }
  }
  
  // Student issues
  const criticalStudents = students.filter(s => s.failureRate > 30);
  if (criticalStudents.length > 0) {
    alerts.push({
      severity: 'warning',
      category: 'students',
      message: `${criticalStudents.length} students with >30% voice failure rate - likely device/network issues`,
      environment: 'both',
      data: criticalStudents.slice(0, 5),
    });
  }
  
  // Environment comparison (production-weighted)
  for (const comp of envComparison) {
    if (comp.alert && comp.prod > comp.dev) {
      alerts.push({
        severity: 'critical', // Higher severity for prod issues
        category: 'env_comparison',
        message: `PRODUCTION ${comp.metric} is ${comp.diffPercent}% worse than dev (${comp.prod} vs ${comp.dev})`,
        environment: 'prod',
        data: comp,
      });
    }
  }
  
  // Threshold violations
  for (const threshold of thresholds) {
    if (threshold.baseline > threshold.currentThreshold * 0.9) {
      alerts.push({
        severity: 'info',
        category: 'threshold',
        message: `${threshold.metric} approaching dynamic threshold: ${threshold.baseline}ms (threshold: ${threshold.currentThreshold}ms)`,
        environment: 'both',
        data: threshold,
      });
    }
  }
  
  // Sort by severity (critical first)
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  
  return alerts;
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

export async function runVoiceIntelligenceAnalysis(daysBack: number = 7): Promise<VoiceIntelligenceReport> {
  console.log(`[VOICE-INTEL] Starting voice intelligence analysis (${daysBack} days)...`);
  const startTime = Date.now();
  
  const environment = process.env.NODE_ENV || 'development';
  const snapshots = await fetchVoiceDiagnostics(daysBack);
  const baselines = await fetchBaselines();
  
  console.log(`[VOICE-INTEL] Analyzing ${snapshots.length} diagnostic snapshots...`);
  
  // Run all analyses
  const latencyTrends = analyzeLatencyTrends(snapshots);
  const timeOfDayPatterns = analyzeTimeOfDayPatterns(snapshots, baselines);
  const languageMetrics = analyzeLanguageMetrics(snapshots);
  const studentIssues = await analyzeStudentIssues(snapshots);
  const dynamicThresholds = await computeDynamicThresholds(snapshots, baselines);
  const envComparison = await compareEnvironments(daysBack);
  
  // Compute overall metrics
  const totalEvents = snapshots.reduce((sum, s) => sum + (s.content?.eventCount || 0), 0);
  const totalFailures = snapshots.reduce((sum, s) => sum + (s.content?.failureCount || 0), 0);
  const overallFailureRate = totalEvents > 0 ? (totalFailures / totalEvents) * 100 : 0;
  const avgLatency = computeAvgLatency(snapshots, 'overall');
  
  // Generate alerts
  const alerts = generateAlerts(
    latencyTrends,
    timeOfDayPatterns,
    languageMetrics,
    studentIssues,
    envComparison,
    dynamicThresholds,
    baselines
  );
  
  const report: VoiceIntelligenceReport = {
    generatedAt: new Date(),
    environment,
    periodDays: daysBack,
    totalEvents,
    overallFailureRate: Math.round(overallFailureRate * 100) / 100,
    avgLatency: Math.round(avgLatency),
    latencyTrends,
    timeOfDayPatterns,
    languageMetrics,
    studentIssues,
    envComparison,
    dynamicThresholds,
    alerts,
  };
  
  console.log(`[VOICE-INTEL] Analysis complete in ${Date.now() - startTime}ms:`);
  console.log(`  - ${totalEvents} events, ${Math.round(overallFailureRate * 10) / 10}% failure rate`);
  console.log(`  - ${alerts.filter(a => a.severity === 'critical').length} critical, ${alerts.filter(a => a.severity === 'warning').length} warning alerts`);
  
  return report;
}

/**
 * Update baselines based on recent data
 * Called after successful nightly analysis
 */
export async function updateBaselines(report: VoiceIntelligenceReport): Promise<void> {
  console.log('[VOICE-INTEL] Updating baselines...');
  
  const newBaselines: HistoricalBaselines = {
    lastUpdated: new Date(),
    latencyBaselines: {},
    failureBaselines: {},
    peakHours: report.timeOfDayPatterns
      .filter(p => p.eventCount > 50)
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 8)
      .map(p => p.hour),
  };
  
  // Update latency baselines from dynamic thresholds
  for (const threshold of report.dynamicThresholds) {
    const stage = threshold.metric.replace('_latency', '');
    newBaselines.latencyBaselines[stage] = {
      mean: threshold.baseline,
      stdDev: threshold.stdDev,
    };
  }
  
  // Store to hiveSnapshots
  await getSharedDb().insert(hiveSnapshots).values({
    snapshotType: 'voice_baselines',
    title: 'Voice Intelligence Baselines',
    content: JSON.stringify(newBaselines),
    context: JSON.stringify({ updatedBy: 'voice-intelligence-service' }),
    importance: 3,
  });
  
  cachedBaselines = newBaselines;
  console.log('[VOICE-INTEL] Baselines updated');
}

/**
 * Create Wren insights for critical alerts
 */
export async function createAlertInsights(alerts: VoiceAlert[]): Promise<number> {
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'warning');
  let created = 0;
  
  for (const alert of criticalAlerts.slice(0, 10)) {
    try {
      await getSharedDb().insert(wrenInsights).values({
        category: 'integration',
        title: `Voice Alert: ${alert.category}`,
        content: alert.message,
        context: JSON.stringify({
          severity: alert.severity,
          environment: alert.environment,
          data: alert.data,
          detectedAt: new Date().toISOString(),
        }),
        tags: ['voice', 'diagnostics', alert.severity, alert.category],
        environment: process.env.NODE_ENV || 'development',
      });
      created++;
    } catch (err: any) {
      console.warn(`[VOICE-INTEL] Failed to create insight: ${err.message}`);
    }
  }
  
  return created;
}

// Wrapper functions for external API use
async function analyzeLatencyTrendsExternal(environment?: string): Promise<LatencyTrend[]> {
  const snapshots = await fetchVoiceDiagnostics(7, environment);
  return analyzeLatencyTrends(snapshots);
}

async function analyzeTimeOfDayPatternsExternal(environment?: string): Promise<TimeOfDayPattern[]> {
  const snapshots = await fetchVoiceDiagnostics(7, environment);
  const baselines = await fetchBaselines();
  return analyzeTimeOfDayPatterns(snapshots, baselines);
}

async function analyzeLanguageMetricsExternal(environment?: string): Promise<LanguageMetrics[]> {
  const snapshots = await fetchVoiceDiagnostics(7, environment);
  return analyzeLanguageMetrics(snapshots);
}

async function analyzeStudentCorrelationsExternal(environment?: string): Promise<StudentIssue[]> {
  const snapshots = await fetchVoiceDiagnostics(7, environment);
  return analyzeStudentIssues(snapshots);
}

async function compareCrossEnvironmentExternal(): Promise<EnvironmentComparison[]> {
  return compareEnvironments(7);
}

async function updateHistoricalBaselinesExternal(): Promise<void> {
  const report = await runVoiceIntelligenceAnalysis(30);
  await updateBaselines(report);
}

export const voiceIntelligenceService = {
  runAnalysis: runVoiceIntelligenceAnalysis,
  updateBaselines,
  createAlertInsights,
  fetchDiagnostics: fetchVoiceDiagnostics,
  generateComprehensiveReport: runVoiceIntelligenceAnalysis,
  analyzeLatencyTrends: analyzeLatencyTrendsExternal,
  analyzeTimeOfDayPatterns: analyzeTimeOfDayPatternsExternal,
  analyzePerLanguageMetrics: analyzeLanguageMetricsExternal,
  analyzeStudentCorrelations: analyzeStudentCorrelationsExternal,
  compareCrossEnvironment: compareCrossEnvironmentExternal,
  updateHistoricalBaselines: updateHistoricalBaselinesExternal,
};
