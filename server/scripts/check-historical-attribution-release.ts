/**
 * Database-free release/startup probe. Use the production approval loader,
 * including its workspace resolution and exact pinned-byte checks.
 */
import { getApprovedHistoricalAttributionOverlay } from '../services/historical-attribution-overlay';

try {
  getApprovedHistoricalAttributionOverlay();
  console.log('Historical attribution release approvals verified (both pinned receipts).');
} catch (error) {
  console.error('Historical attribution release approvals failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}