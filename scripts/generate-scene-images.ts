/**
 * One-time script: generate DALL-E base images for all 15 visual environments
 * and archive them to permanent object storage.
 *
 * Run: tsx scripts/generate-scene-images.ts
 * Options:
 *   --force    Regenerate even if image_url is already set
 *   --only restaurant_table,cafe   Comma-separated list of scene names
 */
import '../server/services/prop-room-compositor';
import { generateAllSceneImages } from '../server/services/prop-room-compositor';

const args = process.argv.slice(2);
const force = args.includes('--force');
const onlyArg = args.find(a => a.startsWith('--only='));
const only = onlyArg ? onlyArg.replace('--only=', '').split(',').map(s => s.trim()) : undefined;

console.log('=== Prop Room: Base Scene Image Generation ===');
console.log(`Force regenerate: ${force}`);
if (only) console.log(`Only: ${only.join(', ')}`);
console.log('');

generateAllSceneImages({ force, only })
  .then(results => {
    console.log('\n=== Results ===');
    let succeeded = 0, failed = 0, skipped = 0;
    for (const r of results) {
      if (r.skipped) {
        console.log(`  SKIP  ${r.name} (already has image)`);
        skipped++;
      } else if (r.success) {
        console.log(`  ✓     ${r.name} → ${r.url}`);
        succeeded++;
      } else {
        console.log(`  ✗     ${r.name} — ${r.error}`);
        failed++;
      }
    }
    console.log(`\nDone: ${succeeded} generated, ${skipped} skipped, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
