import { createHash } from "node:crypto";
import { canonicalJson } from "../services/coordination-policy-canonicalization";

export const WINDOWS_PREPARATION_PROTOCOL_VERSION = 1 as const;
export const PREFLIGHT_MAX_FAILURES = 32;
export const PREFLIGHT_MAX_PATHS = 16;

export type SafePreflightFailure = {
  code: string;
  component: string;
  detail?: string;
};

export type PreflightReport = {
  protocolVersion: 1;
  accepted: boolean;
  checks: {
    powershell: { major: number | null; minor: number | null; compatible: boolean };
    currentUser: { contextAvailable: boolean; context: "CurrentUser" | null };
    dpapi: { currentUserCapabilityPresent: boolean };
    launcher: { approved: boolean; digest: string | null; signatureValid: boolean };
    runtime: { approved: boolean; digest: string | null; signatureValid: boolean };
    paths: { approved: boolean; installation: string | null; worktree: string | null };
    filesystem: { reparseFree: boolean; aclSafe: boolean };
    repository: { identity: string | null; branch: string | null; clean: boolean; startingCommit: string | null };
    generations: { active: string | null; staged: string[] };
    serverProtocol: { compatible: boolean; version: number | null };
    network: { reachable: boolean };
    enrollment: { compatible: boolean };
  };
  failures: SafePreflightFailure[];
  reportDigest: string;
};

type FileCheck = {
  exists: boolean;
  isDirectory?: boolean;
  isFile?: boolean;
  reparseFree: boolean;
  aclSafe: boolean;
};

export type PreflightDependencies = {
  fs: {
    inspect: (path: string) => Promise<FileCheck> | FileCheck;
    inventory: () => Promise<{ active: string | null; staged: string[] }> | { active: string | null; staged: string[] };
  };
  process: {
    powershellVersion: () => Promise<{ major: number; minor: number }> | { major: number; minor: number };
    currentUserContext: () => Promise<{ available: boolean }> | { available: boolean };
    dpapiCurrentUser: () => Promise<boolean> | boolean;
    signedDigest: (path: string) => Promise<{ digest: string | null; signatureValid: boolean }> | { digest: string | null; signatureValid: boolean };
  };
  repository: () => Promise<{
    identity: string; branch: string; clean: boolean; startingCommit: string;
  }> | { identity: string; branch: string; clean: boolean; startingCommit: string };
  network: () => Promise<boolean> | boolean;
  server: {
    protocolVersion: () => Promise<number> | number;
    enrollmentCompatible: () => Promise<boolean> | boolean;
  };
};

export type PreflightOptions = {
  approvedInstallationPath: string;
  approvedWorktreePath: string;
  launcherPath: string;
  launcherDigest: string;
  runtimePath: string;
  runtimeDigest: string;
  repositoryIdentity: string;
  branch: string;
  startingCommit: string;
};

const SECRET_SHAPES = [
  /bearer\s+\S+/i, /(?:cb|ct)_[A-Za-z0-9_-]{8,}/i,
  /(?:password|secret|token|ciphertext|plaintext)\s*[=:]/i,
];

function safe(value: unknown, max = 128): string | undefined {
  const text = String(value);
  if (text.length > max || SECRET_SHAPES.some((pattern) => pattern.test(text))) return undefined;
  return text.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max) || undefined;
}

function reportDigest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function validateOptions(options: PreflightOptions): void {
  const bounded = (value: unknown, max: number) => typeof value === "string"
    && value.length > 0 && value.length <= max && value.trim() === value
    && !SECRET_SHAPES.some((pattern) => pattern.test(value));
  for (const value of [options.approvedInstallationPath, options.approvedWorktreePath,
    options.launcherPath, options.runtimePath]) {
    if (!bounded(value, 1024)) throw new Error("preflight_option_invalid");
  }
  for (const value of [options.launcherDigest, options.runtimeDigest]) {
    if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) throw new Error("preflight_digest_invalid");
  }
  if (!bounded(options.repositoryIdentity, 255) || !bounded(options.branch, 255)
    || !bounded(options.startingCommit, 64) || !/^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(options.startingCommit)) {
    throw new Error("preflight_repository_option_invalid");
  }
}

/**
 * Read-only boundary. Dependencies are deliberately capability-shaped, so a
 * preflight cannot accidentally acquire write methods or an authority client.
 */
export async function runCoordinationWindowsPreflight(
  options: PreflightOptions,
  dependencies: PreflightDependencies,
): Promise<PreflightReport> {
  validateOptions(options);
  const failures: SafePreflightFailure[] = [];
  const add = (code: string, component: string, detail?: unknown) => {
    if (failures.length >= PREFLIGHT_MAX_FAILURES) return;
    failures.push({ code, component, ...(safe(detail) ? { detail: safe(detail) } : {}) });
  };
  const read = async <T>(component: string, operation: () => Promise<T> | T, fallback: T): Promise<T> => {
    try { return await operation(); } catch { add(`${component}_unavailable`, component); return fallback; }
  };

  const ps = await read("powershell", dependencies.process.powershellVersion, { major: 0, minor: 0 });
  const currentUser = await read("current_user", dependencies.process.currentUserContext, { available: false });
  const dpapi = await read("dpapi", dependencies.process.dpapiCurrentUser, false);
  const launcher = await read("launcher", () => dependencies.process.signedDigest(options.launcherPath),
    { digest: null, signatureValid: false });
  const runtime = await read("runtime", () => dependencies.process.signedDigest(options.runtimePath),
    { digest: null, signatureValid: false });
  const installation = await read("installation_path", () => dependencies.fs.inspect(options.approvedInstallationPath),
    { exists: false, reparseFree: false, aclSafe: false });
  const worktree = await read("worktree_path", () => dependencies.fs.inspect(options.approvedWorktreePath),
    { exists: false, reparseFree: false, aclSafe: false });
  const inventory = await read("generation_inventory", dependencies.fs.inventory, { active: null, staged: [] });
  const repo = await read("repository", dependencies.repository, {
    identity: null as unknown as string, branch: null as unknown as string,
    clean: false, startingCommit: null as unknown as string,
  });
  const serverVersion = await read("server_protocol", dependencies.server.protocolVersion, 0);
  const network = await read("network", dependencies.network, false);
  const enrollment = await read("enrollment", dependencies.server.enrollmentCompatible, false);

  const powershellCompatible = Number.isSafeInteger(ps.major) && (ps.major > 5 || (ps.major === 5 && ps.minor >= 1));
  if (!powershellCompatible) add("powershell_version", "powershell");
  if (!currentUser.available) add("current_user_unavailable", "current_user");
  if (!dpapi) add("dpapi_current_user_unavailable", "dpapi");
  if (!launcher.signatureValid || launcher.digest !== options.launcherDigest) add("launcher_not_approved", "launcher");
  if (!runtime.signatureValid || runtime.digest !== options.runtimeDigest) add("runtime_not_approved", "runtime");
  if (!installation.exists || !installation.reparseFree || !installation.aclSafe) add("installation_path_unsafe", "installation_path");
  if (!worktree.exists || !worktree.reparseFree || !worktree.aclSafe) add("worktree_path_unsafe", "worktree_path");
  if (repo.identity !== options.repositoryIdentity) add("repository_identity", "repository");
  if (repo.branch !== options.branch) add("repository_branch", "repository");
  if (!repo.clean) add("repository_dirty", "repository");
  if (repo.startingCommit !== options.startingCommit) add("repository_commit", "repository");
  if (!Array.isArray(inventory.staged) || inventory.staged.length > PREFLIGHT_MAX_PATHS) add("generation_inventory", "generation_inventory");
  if (serverVersion !== WINDOWS_PREPARATION_PROTOCOL_VERSION) add("server_protocol", "server_protocol");
  if (!network) add("network_unreachable", "network");
  if (!enrollment) add("enrollment_incompatible", "enrollment");

  const safeInventory = (value: unknown): string | null => {
    if (typeof value !== "string" || value.length > 128 || value.trim() !== value
      || /[\\/]/.test(value) || SECRET_SHAPES.some((pattern) => pattern.test(value))) return null;
    return value;
  };
  const activeGeneration = safeInventory(inventory.active);
  const stagedGenerations = Array.isArray(inventory.staged)
    ? inventory.staged.map(safeInventory) : [];
  if (inventory.active !== null && activeGeneration === null) add("generation_name_invalid", "generation_inventory");
  if (stagedGenerations.some((value) => value === null)) add("staged_name_invalid", "generation_inventory");
  const checks: PreflightReport["checks"] = {
    powershell: { major: Number.isSafeInteger(ps.major) ? ps.major : null, minor: Number.isSafeInteger(ps.minor) ? ps.minor : null, compatible: powershellCompatible },
    currentUser: { contextAvailable: currentUser.available === true, context: currentUser.available === true ? "CurrentUser" : null },
    dpapi: { currentUserCapabilityPresent: dpapi === true },
    launcher: { approved: launcher.signatureValid === true && launcher.digest === options.launcherDigest, digest: safe(launcher.digest, 64) ?? null, signatureValid: launcher.signatureValid === true },
    runtime: { approved: runtime.signatureValid === true && runtime.digest === options.runtimeDigest, digest: safe(runtime.digest, 64) ?? null, signatureValid: runtime.signatureValid === true },
    // Installation/worktree paths are authority inputs, never operator-safe
    // output. Only the bounded approval boolean crosses this boundary.
    paths: { approved: installation.exists && installation.reparseFree && installation.aclSafe && worktree.exists && worktree.reparseFree && worktree.aclSafe, installation: null, worktree: null },
    filesystem: { reparseFree: installation.reparseFree && worktree.reparseFree, aclSafe: installation.aclSafe && worktree.aclSafe },
    repository: { identity: safe(repo.identity, 255) ?? null, branch: safe(repo.branch, 255) ?? null, clean: repo.clean === true, startingCommit: safe(repo.startingCommit, 64) ?? null },
    generations: { active: activeGeneration, staged: stagedGenerations.slice(0, PREFLIGHT_MAX_PATHS).map((value) => value ?? "[redacted]") },
    serverProtocol: { compatible: serverVersion === 1, version: Number.isSafeInteger(serverVersion) ? serverVersion : null },
    network: { reachable: network === true },
    enrollment: { compatible: enrollment === true },
  };
  const body = { protocolVersion: 1 as const, accepted: failures.length === 0, checks, failures };
  return { ...body, reportDigest: reportDigest(body) };
}

export const preflightCoordinationWindows = runCoordinationWindowsPreflight;
