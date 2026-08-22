import { getMonitoringDb } from '../db';
import { sql } from 'drizzle-orm';

export type MetricType = 'system_health' | 'user_activity' | 'voice_engagement' | 'error_rate';

export interface MonitoringSnapshot {
  id: string;
  capturedAt: Date;
  metricType: MetricType;
  value: any;
  baselineValue: any | null;
  deviationPercent: number | null;
  isAnomaly: boolean;
  anomalySeverity: string | null;
  anomalyReason: string | null;
  metadata: any;
}

export interface AnomalyDetection {
  detected: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metric: MetricType;
  currentValue: number;
  baselineValue: number;
  deviationPercent: number;
}

export interface PatternAnalysis {
  metricType: MetricType;
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  confidence: number;
  dataPoints: number;
  timeWindow: string;
  findings: string[];
}

/**
 * Capture a monitoring snapshot for a specific metric
 */
export async function captureSnapshot(
  metricType: MetricType,
  value: any,
  source = 'watch-worker'
): Promise<MonitoringSnapshot> {
  const sharedDb = getMonitoringDb();
  
  // Calculate baseline from last 7 days of snapshots (if any exist)
  const baseline = await calculateBaseline(metricType);
  
  // Detect deviation
  const numericValue = extractNumericValue(value);
  let deviationPercent: number | null = null;
  let isAnomaly = false;
  let anomalySeverity: string | null = null;
  let anomalyReason: string | null = null;
  
  if (baseline !== null && numericValue !== null) {
    deviationPercent = ((numericValue - baseline) / baseline) * 100;
    const absDev = Math.abs(deviationPercent);
    
    // Flag as anomaly if deviation exceeds ±30%
    if (absDev > 30) {
      isAnomaly = true;
      
      // Assign severity
      if (absDev > 100) anomalySeverity = 'critical';
      else if (absDev > 60) anomalySeverity = 'high';
      else if (absDev > 40) anomalySeverity = 'medium';
      else anomalySeverity = 'low';
      
      anomalyReason = `${deviationPercent > 0 ? 'Increased' : 'Decreased'} ${absDev.toFixed(1)}% from 7-day baseline`;
    }
  }
  
  // Determine trend direction and store in metadata
  const trendDirection = await calculateTrendDirection(metricType, numericValue);
  
  const result = await sharedDb.execute(sql`
    INSERT INTO monitoring_snapshots (
      id, captured_at, metric_type, value, baseline_value, deviation_percent,
      is_anomaly, anomaly_severity, anomaly_reason, metadata
    )
    VALUES (
      gen_random_uuid(),
      NOW(),
      ${metricType},
      ${JSON.stringify(value)}::jsonb,
      ${baseline !== null ? JSON.stringify({ value: baseline }) : null}::jsonb,
      ${deviationPercent},
      ${isAnomaly},
      ${anomalySeverity},
      ${anomalyReason},
      ${JSON.stringify({ source, trendDirection })}::jsonb
    )
    RETURNING 
      id, captured_at, metric_type, value, baseline_value, deviation_percent,
      is_anomaly, anomaly_severity, anomaly_reason, metadata
  `);
  
  const row = result.rows[0] as any;
  
  return {
    id: row.id,
    capturedAt: new Date(row.captured_at),
    metricType: row.metric_type,
    value: row.value,
    baselineValue: row.baseline_value,
    deviationPercent: row.deviation_percent,
    isAnomaly: row.is_anomaly,
    anomalySeverity: row.anomaly_severity,
    anomalyReason: row.anomaly_reason,
    metadata: row.metadata,
  };
}

/**
 * Detect anomalies across all recent snapshots
 */
export async function detectAnomalies(hours = 24): Promise<AnomalyDetection[]> {
  const sharedDb = getMonitoringDb();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const result = await sharedDb.execute(sql`
    SELECT 
      metric_type,
      value,
      baseline_value,
      deviation_percent,
      is_anomaly,
      anomaly_severity,
      captured_at
    FROM monitoring_snapshots
    WHERE captured_at >= ${since}
      AND is_anomaly = true
    ORDER BY captured_at DESC
  `);
  
  const anomalies: AnomalyDetection[] = [];
  
  for (const row of result.rows as any[]) {
    const currentValue = extractNumericValue(row.value);
    const baselineValue = row.baseline_value ? extractNumericValue(row.baseline_value) : null;
    
    if (currentValue === null || baselineValue === null) continue;
    
    const deviationPercent = row.deviation_percent || 0;
    
    let severity: AnomalyDetection['severity'] = 'low';
    if (row.anomaly_severity === 'critical') severity = 'critical';
    else if (row.anomaly_severity === 'high') severity = 'high';
    else if (row.anomaly_severity === 'medium') severity = 'medium';
    
    anomalies.push({
      detected: true,
      severity,
      message: `${row.metric_type} deviated ${deviationPercent.toFixed(1)}% from baseline`,
      metric: row.metric_type,
      currentValue,
      baselineValue,
      deviationPercent,
    });
  }
  
  return anomalies;
}

/**
 * Analyze patterns across a time window for a specific metric
 */
export async function analyzePatterns(
  metricType: MetricType,
  days = 7
): Promise<PatternAnalysis> {
  const sharedDb = getMonitoringDb();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const result = await sharedDb.execute(sql`
    SELECT 
      value,
      captured_at,
      deviation_percent,
      metadata
    FROM monitoring_snapshots
    WHERE metric_type = ${metricType}
      AND captured_at >= ${since}
    ORDER BY captured_at ASC
  `);
  
  const dataPoints = result.rows.length;
  const findings: string[] = [];
  
  if (dataPoints === 0) {
    return {
      metricType,
      trend: 'stable',
      confidence: 0,
      dataPoints: 0,
      timeWindow: `${days} days`,
      findings: ['No data points in time window'],
    };
  }
  
  // Extract numeric values for trend calculation
  const values = result.rows
    .map((row: any) => extractNumericValue(row.value))
    .filter((v): v is number => v !== null);
  
  if (values.length < 2) {
    return {
      metricType,
      trend: 'stable',
      confidence: 0.3,
      dataPoints,
      timeWindow: `${days} days`,
      findings: ['Insufficient data for trend analysis'],
    };
  }
  
  // Simple linear regression for trend detection
  const n = values.length;
  const xMean = (n - 1) / 2; // time indices
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += Math.pow(i - xMean, 2);
  }
  
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const slopePercent = (slope / yMean) * 100;
  
  // Determine trend
  let trend: PatternAnalysis['trend'];
  if (Math.abs(slopePercent) < 5) {
    trend = 'stable';
    findings.push(`Metric remains stable (${slopePercent.toFixed(1)}% change)`);
  } else if (Math.abs(slopePercent) > 20 && calculateVolatility(values) > 0.3) {
    trend = 'volatile';
    findings.push(`High volatility detected (${(calculateVolatility(values) * 100).toFixed(1)}% CV)`);
  } else if (slope > 0) {
    trend = 'increasing';
    findings.push(`Upward trend: ${slopePercent.toFixed(1)}% increase over period`);
  } else {
    trend = 'decreasing';
    findings.push(`Downward trend: ${Math.abs(slopePercent).toFixed(1)}% decrease over period`);
  }
  
  // Confidence based on data density and consistency
  const confidence = Math.min(0.95, 0.5 + (n / 100) + (1 - calculateVolatility(values)) * 0.3);
  
  // Anomaly summary
  const anomalyCount = result.rows.filter((row: any) => row.deviation_percent && Math.abs(row.deviation_percent) > 30).length;
  if (anomalyCount > 0) {
    findings.push(`${anomalyCount} anomalies detected (${(anomalyCount / dataPoints * 100).toFixed(0)}% of samples)`);
  }
  
  return {
    metricType,
    trend,
    confidence: parseFloat(confidence.toFixed(2)),
    dataPoints,
    timeWindow: `${days} days`,
    findings,
  };
}

/**
 * Get recent snapshots for a metric type (used by get_monitoring_snapshots tool)
 */
export async function getMonitoringSnapshots(
  metricType: MetricType,
  hours = 24
): Promise<MonitoringSnapshot[]> {
  const sharedDb = getMonitoringDb();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const result = await sharedDb.execute(sql`
    SELECT 
      id, captured_at, metric_type, value, baseline_value, deviation_percent,
      is_anomaly, anomaly_severity, anomaly_reason, metadata
    FROM monitoring_snapshots
    WHERE metric_type = ${metricType}
      AND captured_at >= ${since}
    ORDER BY captured_at DESC
    LIMIT 50
  `);
  
  return result.rows.map((row: any) => ({
    id: row.id,
    capturedAt: new Date(row.captured_at),
    metricType: row.metric_type,
    value: row.value,
    baselineValue: row.baseline_value,
    deviationPercent: row.deviation_percent,
    isAnomaly: row.is_anomaly,
    anomalySeverity: row.anomaly_severity,
    anomalyReason: row.anomaly_reason,
    metadata: row.metadata,
  }));
}

// --- Helper Functions ---

async function calculateBaseline(metricType: MetricType): Promise<number | null> {
  const sharedDb = getMonitoringDb();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const result = await sharedDb.execute(sql`
    SELECT value
    FROM monitoring_snapshots
    WHERE metric_type = ${metricType}
      AND captured_at >= ${sevenDaysAgo}
      AND is_anomaly = false
    ORDER BY captured_at DESC
    LIMIT 50
  `);
  
  if (result.rows.length === 0) return null;
  
  const values = result.rows
    .map((row: any) => extractNumericValue(row.value))
    .filter((v): v is number => v !== null);
  
  if (values.length === 0) return null;
  
  // Use median for robustness against outliers
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? (values[mid - 1] + values[mid]) / 2
    : values[mid];
}

async function calculateTrendDirection(
  metricType: MetricType,
  currentValue: number | null
): Promise<'up' | 'down' | 'stable' | null> {
  if (currentValue === null) return null;
  
  const sharedDb = getMonitoringDb();
  
  const result = await sharedDb.execute(sql`
    SELECT value
    FROM monitoring_snapshots
    WHERE metric_type = ${metricType}
    ORDER BY captured_at DESC
    LIMIT 5 OFFSET 1
  `);
  
  if (result.rows.length === 0) return null;
  
  const recentValues = result.rows
    .map((row: any) => extractNumericValue(row.value))
    .filter((v): v is number => v !== null);
  
  if (recentValues.length === 0) return null;
  
  const recentAvg = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
  const change = ((currentValue - recentAvg) / recentAvg) * 100;
  
  if (Math.abs(change) < 5) return 'stable';
  return change > 0 ? 'up' : 'down';
}

function extractNumericValue(value: any): number | null {
  if (value === null || value === undefined) return null;
  
  // If value is already a number
  if (typeof value === 'number') return value;
  
  // If value is an object with a numeric property
  if (typeof value === 'object') {
    // Try common numeric keys
    const numericKeys = ['count', 'total', 'score', 'value', 'rate', 'percentage'];
    for (const key of numericKeys) {
      if (key in value && typeof value[key] === 'number') {
        return value[key];
      }
    }
  }
  
  return null;
}

function calculateVolatility(values: number[]): number {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  // Coefficient of variation (normalized volatility)
  return mean === 0 ? 0 : stdDev / Math.abs(mean);
}
