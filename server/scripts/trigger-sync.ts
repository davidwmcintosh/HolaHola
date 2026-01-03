import { syncBridge } from '../services/sync-bridge';

async function main() {
  console.log('[SYNC] Triggering production diagnostic pull...');
  console.log('[SYNC] Batches: sofia-telemetry, prod-conversations, prod-content-growth');
  
  try {
    const result = await syncBridge.pullFromPeer('agent-cli', {
      selectedBatches: ['sofia-telemetry', 'prod-conversations', 'prod-content-growth']
    });
    console.log('[SYNC] Result:', JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('[SYNC] Error:', error.message);
    if (error.message.includes('Peer URL')) {
      console.log('[SYNC] Note: No SYNC_PEER_URL configured - this is expected in dev.');
      console.log('[SYNC] To pull from production, configure SYNC_PEER_URL to point to production.');
    }
  }
  process.exit(0);
}

main();
