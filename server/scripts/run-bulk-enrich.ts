/**
 * Standalone bulk curriculum enrichment runner.
 * Run with: tsx server/scripts/run-bulk-enrich.ts
 * Logs progress to stdout; results are written directly to the DB.
 */

import { bulkEnrichAllPaths, bulkEnrichJobs } from '../services/curriculum-enrichment-service';

const jobId = `bulk-enrich-${Date.now()}`;
console.log(`[BulkEnrich] Starting job ${jobId}`);
console.log(`[BulkEnrich] Processing all 45 paths — estimated ~26 minutes`);
console.log(`[BulkEnrich] Started at ${new Date().toISOString()}`);
console.log('──────────────────────────────────────────────────────────');

// Print progress every 30 seconds
const progressInterval = setInterval(() => {
  const job = bulkEnrichJobs.get(jobId);
  if (!job) return;
  const pct = job.totalLessons > 0
    ? Math.round((job.processedLessons / job.totalLessons) * 100)
    : 0;
  const remaining = Math.max(0, Math.ceil(((job.totalLessons - job.processedLessons) * 1.2) / 60));
  console.log(
    `[BulkEnrich] ${pct}% | ${job.processedLessons}/${job.totalLessons} lessons | ` +
    `${job.completedPaths}/${job.totalPaths} paths | ` +
    `${job.backfilled} backfilled | ${job.validated} validated | ` +
    `~${remaining}m remaining | Current: ${job.currentPath}`
  );
}, 30000);

bulkEnrichAllPaths(jobId)
  .then(() => {
    clearInterval(progressInterval);
    const job = bulkEnrichJobs.get(jobId);
    console.log('──────────────────────────────────────────────────────────');
    console.log(`[BulkEnrich] COMPLETE at ${new Date().toISOString()}`);
    if (job) {
      console.log(`[BulkEnrich] ${job.processedLessons} lessons processed`);
      console.log(`[BulkEnrich] ${job.backfilled} lessons backfilled (vocab/grammar generated)`);
      console.log(`[BulkEnrich] ${job.validated} lessons OER-validated`);
      console.log(`[BulkEnrich] ${job.errors.length} errors`);
      if (job.errors.length > 0) {
        job.errors.slice(0, 10).forEach(e => console.log(`  ✗ ${e}`));
      }
    }
    process.exit(0);
  })
  .catch(err => {
    clearInterval(progressInterval);
    console.error('[BulkEnrich] Fatal error:', err.message);
    process.exit(1);
  });
