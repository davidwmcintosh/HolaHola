import { syncBridge } from '../server/services/sync-bridge';

async function runSync() {
  console.log('=== Collecting Neural Network Export Bundle ===\n');
  
  const bundle = await syncBridge.collectExportBundle();
  
  console.log('Bundle collected at:', bundle.generatedAt);
  console.log('Source environment:', bundle.sourceEnvironment);
  console.log('Checksum:', bundle.checksum);
  console.log('\n=== Bundle Contents ===');
  console.log('- Best Practices:', bundle.bestPractices.length);
  console.log('- Language Idioms:', bundle.idioms.length);
  console.log('- Cultural Nuances:', bundle.nuances.length);
  console.log('- Error Patterns:', bundle.errorPatterns.length);
  console.log('- Dialect Variations:', bundle.dialects.length);
  console.log('- Linguistic Bridges:', bundle.bridges.length);
  console.log('- Tool Knowledge:', bundle.tools.length);
  console.log('- Tutor Procedures:', bundle.procedures.length);
  console.log('- Teaching Principles:', bundle.principles.length);
  console.log('- Situational Patterns:', bundle.patterns.length);
  console.log('- Subtlety Cues:', bundle.subtletyCues.length);
  console.log('- Emotional Patterns:', bundle.emotionalPatterns.length);
  console.log('- Creativity Templates:', bundle.creativityTemplates.length);
  console.log('- Daniela Suggestions:', bundle.suggestions.length);
  console.log('- Reflection Triggers:', bundle.triggers.length);
  console.log('- Suggestion Actions:', bundle.actions.length);
  console.log('- Observations:', bundle.observations.length);
  console.log('- System Alerts:', bundle.alerts.length);
  console.log('- North Star Principles:', bundle.northStarPrinciples.length);
  console.log('- North Star Understanding:', bundle.northStarUnderstanding.length);
  console.log('- North Star Examples:', bundle.northStarExamples.length);
  
  // Now try to push to peer
  console.log('\n=== Attempting Push to Peer ===');
  try {
    const result = await syncBridge.pushToPeer('founder-mobile');
    console.log('Push result:', JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.log('Push error:', error.message);
    console.log('(This is expected if peer is not configured or unreachable)');
  }
  
  process.exit(0);
}

runSync().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
