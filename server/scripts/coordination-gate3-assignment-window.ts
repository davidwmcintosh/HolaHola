import { closeDbConnections } from "../db";
import {
  createGate3AssignmentWindow, readGate3AssignmentBundle, Gate3AssignmentWindowError,
} from "../services/coordination-gate3-assignment-window-service";

function parseArgs(): { bundle: string; receiptId: string; attemptId: string } {
  const values: Record<string, string> = {};
  const allowed = new Set(["--bundle", "--receipt-id", "--attempt-id"]);
  for (let i = 2; i < process.argv.length; i += 2) {
    const flag = process.argv[i];
    if (!allowed.has(flag) || values[flag]) throw new Gate3AssignmentWindowError("usage");
    const value = process.argv[i + 1];
    if (!value || value.startsWith("--")) throw new Gate3AssignmentWindowError("usage");
    values[flag] = value;
  }
  if (process.argv.length % 2 !== 0 || Object.keys(values).length !== 3) throw new Gate3AssignmentWindowError("usage");
  return { bundle: values["--bundle"], receiptId: values["--receipt-id"], attemptId: values["--attempt-id"] };
}
if (process.argv[1]?.endsWith("coordination-gate3-assignment-window.ts")) {
  (async () => {
    const args = parseArgs();
    return createGate3AssignmentWindow({
      bundle: await readGate3AssignmentBundle(args.bundle),
      receiptId: args.receiptId, assignmentAttemptId: args.attemptId,
    });
  })().then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(error instanceof Gate3AssignmentWindowError ? `${error.message}\n` : "gate3_assignment_window_failed\n");
      process.exitCode = 1;
    }).finally(() => closeDbConnections());
}