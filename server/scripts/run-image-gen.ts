import { generateLessonImages } from '../services/lesson-image-generator';

// Temporarily patch MAX_PER_RUN by running multiple passes
async function runBatch() {
  // Run 5 passes of 20 = 100 images
  for (let pass = 1; pass <= 5; pass++) {
    console.log(`\n=== Pass ${pass}/5 ===`);
    await generateLessonImages();
  }
  console.log('\n[Done] Batch image generation complete');
}

runBatch().catch(console.error).finally(() => process.exit(0));
