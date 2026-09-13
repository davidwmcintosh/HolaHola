import {
  COORDINATION_WINDOWS_EXIT_CODES,
  runCoordinationWindowsHost,
  type CoordinationWindowsHostDependencies,
  type CoordinationWindowsOperatorInput,
  type CoordinationWindowsHostResult,
} from "./coordination-windows-host";
import type { CoordinationLifecycleSafeStatus } from "../services/coordination-lifecycle-facade-service";

export type CoordinationV2CliFormat = "json" | "text";
export type CoordinationV2CliInput = CoordinationWindowsOperatorInput & {
  format: CoordinationV2CliFormat;
};

export type CoordinationV2CliRunner = (
  input: CoordinationWindowsOperatorInput,
) => Promise<CoordinationWindowsHostResult | CoordinationLifecycleSafeStatus>;

const safeFormats = new Set<CoordinationV2CliFormat>(["json", "text"]);
const forbiddenOptionWords = new Set([
  "id", "digest", "receipt", "challenge", "runtime", "packet", "window", "claim",
  "lease", "path", "command", "provider", "credential",
]);

export function parseCoordinationV2CliArgs(args: readonly string[]): CoordinationV2CliInput {
  let taskRef: string | undefined;
  let policySelector: string | undefined;
  let format: CoordinationV2CliFormat = "text";
  let positional: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      if (positional !== undefined) throw new Error("invalid_argument");
      positional = token;
      continue;
    }
    const name = token.slice(2);
    if (name === "task-ref" || name === "policy" || name === "format") {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error("invalid_argument");
      if (name === "task-ref") {
        if (taskRef !== undefined) throw new Error("invalid_argument");
        taskRef = value;
      } else if (name === "policy") {
        if (policySelector !== undefined) throw new Error("invalid_argument");
        policySelector = value;
      } else {
        if (!safeFormats.has(value as CoordinationV2CliFormat)) throw new Error("invalid_format");
        format = value as CoordinationV2CliFormat;
      }
      continue;
    }
    // Keep this explicit rather than accepting a prefix. This makes adding a
    // future internal option an intentional review decision.
    if (forbiddenOptionWords.has(name) || name.length > 0) throw new Error("unsupported_option");
    throw new Error("unsupported_option");
  }
  if (taskRef !== undefined && positional !== undefined) throw new Error("invalid_argument");
  taskRef ??= positional;
  if (!taskRef || !/^[1-9][0-9]*$/.test(taskRef)) throw new Error("task_ref_required");
  if (policySelector !== undefined && (policySelector.length === 0 || policySelector.length > 128
    || policySelector.trim() !== policySelector)) {
    throw new Error("invalid_policy");
  }
  return Object.freeze({ taskRef, ...(policySelector ? { policySelector } : {}), format });
}

export function safeCoordinationV2CliStatus(
  status: CoordinationWindowsHostResult | CoordinationLifecycleSafeStatus,
): { state: string; cleanupAcknowledged: boolean } {
  if ("status" in status) {
    return { state: status.status.state, cleanupAcknowledged: status.status.cleanupAcknowledged };
  }
  return { state: status.state, cleanupAcknowledged: !status.cleanupPending };
}

export async function runCoordinationV2Cli(
  args: readonly string[],
  runner: CoordinationV2CliRunner,
): Promise<{ status: { state: string; cleanupAcknowledged: boolean }; exitCode: number; format: CoordinationV2CliFormat }> {
  return runParsedCoordinationV2Cli(parseCoordinationV2CliArgs(args), runner);
}

async function runParsedCoordinationV2Cli(
  input: CoordinationV2CliInput,
  runner: CoordinationV2CliRunner,
): Promise<{ status: { state: string; cleanupAcknowledged: boolean }; exitCode: number; format: CoordinationV2CliFormat }> {
  const status = safeCoordinationV2CliStatus(await runner({
    taskRef: input.taskRef,
    ...(input.policySelector ? { policySelector: input.policySelector } : {}),
  }));
  const success = status.state === "succeeded" && status.cleanupAcknowledged;
  const terminalKey = !success && status.state === "succeeded" ? "cleanup_pending" : status.state;
  return {
    status,
    exitCode: success ? 0 : (COORDINATION_WINDOWS_EXIT_CODES[terminalKey as keyof typeof COORDINATION_WINDOWS_EXIT_CODES] ?? 1),
    format: input.format,
  };
}

/**
 * Hermetic/embedded one-command composition. This is the M9 path that
 * exercises preflight, preparation, lease, poll, claim, result, and cleanup.
 * The process entry point below intentionally does not manufacture these
 * dependencies before the authenticated Windows boundary exists.
 */
export async function runCoordinationV2Command(
  args: readonly string[],
  hostDependencies: CoordinationWindowsHostDependencies,
): Promise<{ status: { state: string; cleanupAcknowledged: boolean }; exitCode: number; format: CoordinationV2CliFormat }> {
  const parsed = parseCoordinationV2CliArgs(args);
  return runParsedCoordinationV2Cli(
    parsed,
    (input) => runCoordinationWindowsHost(input, hostDependencies),
  );
}

export type CoordinationV2DependencyFactory = (
  input: CoordinationWindowsOperatorInput,
) => CoordinationWindowsHostDependencies | Promise<CoordinationWindowsHostDependencies>;

/**
 * The sole CLI composition boundary. Embedded callers inject the authenticated
 * lifecycle dependencies; the process default intentionally has no transport
 * authority and therefore fails closed.
 */
export async function runCoordinationV2Entrypoint(
  args: readonly string[],
  dependencyFactory?: CoordinationV2DependencyFactory,
): Promise<{ status: { state: string; cleanupAcknowledged: boolean }; exitCode: number; format: CoordinationV2CliFormat }> {
  const parsed = parseCoordinationV2CliArgs(args);
  if (!dependencyFactory) {
    return {
      status: { state: "host_unavailable", cleanupAcknowledged: false },
      exitCode: COORDINATION_WINDOWS_EXIT_CODES.host_unavailable,
      format: parsed.format,
    };
  }
  const dependencies = await dependencyFactory({
    taskRef: parsed.taskRef,
    ...(parsed.policySelector ? { policySelector: parsed.policySelector } : {}),
  });
  return runCoordinationV2Command(args, dependencies);
}

function writeSafeStatus(
  format: CoordinationV2CliFormat,
  status: { state: string; cleanupAcknowledged: boolean },
): void {
  const output = format === "json"
    ? JSON.stringify(status)
    : `${status.state}${status.state === "succeeded" && !status.cleanupAcknowledged ? " (cleanup pending)" : ""}`;
  process.stdout.write(`${output}\n`);
}

/**
 * No real Windows authority is enabled until the later enrollment milestones.
 * Fail closed rather than calling the launch facade without host lifecycle.
 */
async function main(): Promise<void> {
  let run: Awaited<ReturnType<typeof runCoordinationV2Entrypoint>>;
  try {
    run = await runCoordinationV2Entrypoint(process.argv.slice(2));
  } catch {
    process.stdout.write('{"state":"invalid_request","cleanupAcknowledged":false}\n');
    process.exitCode = 64;
    return;
  }
  writeSafeStatus(run.format, run.status);
  process.exitCode = run.exitCode;
}

if (process.argv[1]?.endsWith("coordination-v2-cli.ts")) {
  main().catch(() => {
    process.stdout.write('{"state":"host_unavailable","cleanupAcknowledged":false}\n');
    process.exitCode = 69;
  });
}

export type { CoordinationWindowsHostDependencies };