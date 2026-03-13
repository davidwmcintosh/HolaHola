import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const schemaPath = join(__dirname, '..', 'shared', 'schema.ts');

console.log('Reading schema.ts...');
const content = readFileSync(schemaPath, 'utf-8');
const lines = content.split('\n');

console.log(`Schema has ${lines.length} lines`);

// Check if already migrated
if (content.includes('metricTypeEnum')) {
  console.log('❌ Migration already applied (metricTypeEnum exists)');
  process.exit(1);
}

// Insertion content
const enumBlock = `
// Monitoring metric types for autonomous system health tracking
export const metricTypeEnum = pgEnum('metric_type', [
  'system_health',     // Voice pipeline status, server uptime, memory usage
  'user_activity',     // Active learners, session counts, engagement trends
  'voice_engagement',  // Voice session duration, TTS usage, error rates
  'error_rate',        // Sofia-reported issues, API failures, pipeline failures
]);
`;

const tableBlock = `
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

// Insert enum after line 7185 (0-indexed = 7185)
console.log('Inserting enum after line 7185...');
lines.splice(7185, 0, enumBlock);

// Insert table after line 7229 (adjusted for enum insertion)
const enumLines = enumBlock.split('\n').length;
console.log(`Inserting table after line ${7229 + enumLines}...`);
lines.splice(7229 + enumLines, 0, tableBlock);

// Write back
console.log('Writing updated schema...');
writeFileSync(schemaPath, lines.join('\n'), 'utf-8');

console.log('✅ Migration complete');
console.log('✓ Added metricTypeEnum after line 7185');
console.log('✓ Added monitoringSnapshots table after original line 7229');
console.log('\nNext steps:');
console.log('  1. npm run db:push --force');
console.log('  2. npx tsc --noEmit');
