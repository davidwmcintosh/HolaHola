import { reconcileAlertBridgeApproval } from '../services/agent-note-coordination-ingress';
import { closeDbConnections } from '../db';

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--key' || !args[1] || args[1].startsWith('--')) {
    throw new Error('Usage: reconcile-alert-bridge-approval --key <repository-authorized-key>');
  }
  const result = await reconcileAlertBridgeApproval(args[1]);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

void (async () => {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  } finally {
    try {
      await closeDbConnections();
    } catch (error) {
      // Preserve the original operation failure when one exists. A shutdown
      // failure after an otherwise successful operation is itself fatal.
      if (!process.exitCode) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    }
  }
})();