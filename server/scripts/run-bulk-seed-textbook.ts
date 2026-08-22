/**
 * Standalone bulk textbook seeding runner.
 * Run with: tsx server/scripts/run-bulk-seed-textbook.ts
 *
 * Generates structured textbook content (introduction, grammar explanation,
 * vocabulary list, reading passage, comprehension questions, key phrases)
 * for every lesson across all 45 curriculum paths using Gemini + OER sources.
 *
 * Already-seeded lessons are skipped automatically — safe to re-run.
 * Estimated time: ~43 minutes for 1300 lessons (1.5s throttle per lesson).
 */

import { bulkSeedAllPaths, bulkSeedJobs } from '../services/textbook-seed-service';

const jobId = `bulk-seed-${Date.now()}`;
console.log(`[BulkSeed] Starting job ${jobId}`);
console.log(`[BulkSeed] Processing all 45 paths across 9 languages`);
console.log(`[BulkSeed] Estimated ~43 minutes for 1300 lessons`);
console.log(`[BulkSeed] Started at ${new Date().toISOString()}`);
console.log('──────────────────────────────────────────────────────────');

const progressInterval = setInterval(() => {
  const job = bulkSeedJobs.get(jobId);
  if (!job) return;
  const pct = job.totalLessons > 0
    ? Math.round((job.processedLessons / job.totalLessons) * 100)
    : 0;
  const elapsed = (Date.now() - new Date(job.startedAt).getTime()) / 1000;
  const rate = elapsed > 0 ? job.processedLessons / elapsed : 0;
  const remaining = rate > 0
    ? Math.ceil((job.totalLessons - job.processedLessons) / rate / 60)
    : job.estimatedMinutes;
  console.log(
    `[BulkSeed] ${pct}% | ${job.processedLessons}/${job.totalLessons} lessons | ` +
    `${job.completedPaths}/${job.totalPaths} paths | ` +
    `${job.seeded} seeded | ${job.skipped} skipped | ${job.errors.length} errors | ` +
    `~${remaining}m left | Current: ${job.currentLanguage} — ${job.currentPath}`
  );
}, 30000);

bulkSeedAllPaths(jobId)
  .then(() => {
    clearInterval(progressInterval);
    const job = bulkSeedJobs.get(jobId);
    console.log('──────────────────────────────────────────────────────────');
    console.log(`[BulkSeed] COMPLETE at ${new Date().toISOString()}`);
    if (job) {
      console.log(`[BulkSeed] ${job.processedLessons} lessons processed`);
      console.log(`[BulkSeed] ${job.seeded} lessons newly seeded`);
      console.log(`[BulkSeed] ${job.skipped} lessons already seeded (skipped)`);
      if (job.errors.length > 0) {
        console.log(`[BulkSeed] ${job.errors.length} errors:`);
        job.errors.slice(0, 20).forEach(e => console.log(`  ✗ ${e}`));
      } else {
        console.log(`[BulkSeed] 0 errors — clean run!`);
      }
    }
    process.exit(0);
  })
  .catch(err => {
    clearInterval(progressInterval);
    console.error('[BulkSeed] Fatal error:', err.message);
    process.exit(1);
  });
