import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const schemaPath = join(process.cwd(), 'shared', 'schema.ts');
const content = readFileSync(schemaPath, 'utf-8');
const lines = content.split('\n');

// Insert enum after line 7185 (after wrenTriggerUrgencyEnum)
const enumInsertion = `
// Monitoring metric types for autonomous system health tracking
export const metricTypeEnum = pgEnum('metric_type', [
  'system_health',     // Voice pipeline status, server uptime, memory usage
  'user_activity',     // Active learners, session counts, engagement trends
  'voice_engagement',  // Voice session duration, TTS usage, error rates
  'error_rate',        // Sofia-reported issues, API failures, pipeline failures
]);
`;

// Insert table after line 7229 (after WrenProactiveTrigger type export, before ADR section)
const tableInsertion = `
// ===== Autonomous Monitoring Snapshots =====
// Time-series data captured by Alden's watch worker for pattern detection and trend analysis

export const monitoringSnapshots = pgTable("monitoring_snapshots", {
  id: varchar("id").primaryKey().default(sql\`gen_random_uuid()\`),
  
  capturedAt: timestamp("captured_at").notNull().defaultNow(),
  metricType: metricTypeEnum("metric_type").notNull(),
  
  // The actual metric value (flexible JSONB to accommodate different metric shapes)
  value: jsonb("value").notNull(), // { score: 85, status: 'green', activeSessions: 3, ... }
  
  // Baseline comparison for anomaly detection
  baselineValue: jsonb("baseline_value"), // What's "normal" for this metric
  deviationPercent: real("deviation_percent"), // How far from baseline (null = no baseline yet)
  
  // Anomaly detection flags
  isAnomaly: boolean("is_anomaly").default(false),
  anomalySeverity: varchar("anomaly_severity"), // 'low', 'medium', 'high', 'critical'
  anomalyReason: text("anomaly_reason"), // Why this was flagged as anomalous
  
  // Contextual metadata
  metadata: jsonb("metadata").$type<{
    source?: string;           // 'watch-worker', 'manual-check', 'scheduled-audit'
    triggerReason?: string;    // What prompted this snapshot
    relatedIssues?: string[];  // Sofia issue IDs if this relates to known problems
  }>().default(sql\`'{}'\`),
}, (table) => [
  index("idx_monitoring_captured_at").on(table.capturedAt),
  index("idx_monitoring_metric_type").on(table.metricType),
  index("idx_monitoring_anomaly").on(table.isAnomaly),
]);

export const insertMonitoringSnapshotSchema = createInsertSchema(monitoringSnapshots).omit({
  id: true,
  capturedAt: true,
});
export type InsertMonitoringSnapshot = z.infer<typeof insertMonitoringSnapshotSchema>;
export type MonitoringSnapshot = typeof monitoringSnapshots.$inferSelect;
`;

// Find insertion points
const enumInsertLine = 7185; // After wrenTriggerUrgencyEnum
const tableInsertLine = 7229; // After WrenProactiveTrigger types

// Insert enum (insert AFTER line 7185, so at index 7185 since arrays are 0-indexed)
lines.splice(enumInsertLine, 0, enumInsertion);

// Insert table (now line numbers have shifted by the enum insertion)
// Original line 7229 is now at 7229 + number of enum lines
const enumLineCount = enumInsertion.split('\n').length;
lines.splice(tableInsertLine + enumLineCount, 0, tableInsertion);

// Write back
writeFileSync(schemaPath, lines.join('\n'), 'utf-8');

console.log('✓ Added metricTypeEnum after line 7185');
console.log('✓ Added monitoringSnapshots table after line 7229');
console.log('✓ Schema updated successfully');
