import { closeDbConnections } from '../db';
import { retryPendingRawWindowClassificationProjections } from '../services/raw-window-classification';

void retryPendingRawWindowClassificationProjections()
  .then(async count => {
    console.log(`[raw-window-classification] Recovered ${count} pending/failed projection(s).`);
    await closeDbConnections();
  })
  .catch(async error => {
    console.error('[raw-window-classification] retry failed:', error);
    await closeDbConnections();
    process.exit(1);
  });