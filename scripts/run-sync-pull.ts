import { syncBridge } from '../server/services/sync-bridge';

async function runPull() {
  console.log('=== Running Pull from Production ===\n');
  
  try {
    const result = await syncBridge.pullFromPeer('manual-test');
    console.log('Pull result:', JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.log('Pull error:', error.message);
  }
  
  process.exit(0);
}

runPull().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
