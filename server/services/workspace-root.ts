import { accessSync, constants, existsSync, mkdirSync, statSync } from 'fs';
import { isAbsolute, join, resolve } from 'path';

export const HOLAHOLA_WORKSPACE_ROOT_ENV = 'HOLAHOLA_WORKSPACE_ROOT';

export type WorkspaceRootSource = 'configured' | 'replit' | 'current-directory';

export interface WorkspaceResolution {
  root: string;
  source: WorkspaceRootSource;
}

export interface CaptureWorkspaceInspection {
  rootSource: WorkspaceRootSource;
  localDirectoryPresent: boolean;
  localDirectoryWritable: boolean;
}

interface ResolveWorkspaceOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

const REQUIRED_PROJECT_MARKERS = [
  'package.json',
  'drizzle.config.ts',
  'server',
  'shared/schema.ts',
] as const;

function absoluteRoot(candidate: string, cwd: string): string {
  return resolve(isAbsolute(candidate) ? candidate : join(cwd, candidate));
}

function assertProjectRoot(root: string, source: WorkspaceRootSource): void {
  const missing = REQUIRED_PROJECT_MARKERS.filter(marker => !existsSync(join(root, marker)));
  if (missing.length > 0) {
    throw new Error(
      `Canonical capture workspace from ${source} is not a HolaHola project root: ` +
      `${root} is missing ${missing.join(', ')}.`,
    );
  }
  if (!statSync(join(root, 'server')).isDirectory()) {
    throw new Error(`Canonical capture workspace from ${source} has a non-directory server marker: ${root}.`);
  }
}

function resolveCandidate(
  candidate: string,
  source: WorkspaceRootSource,
  cwd: string,
): WorkspaceResolution {
  const root = absoluteRoot(candidate, cwd);
  assertProjectRoot(root, source);
  return { root, source };
}

/**
 * Resolve the one workspace that owns canonical capture.
 *
 * An explicit root is authoritative: a typo must stop capture rather than
 * silently redirect it to a legacy Replit-only directory or an arbitrary cwd.
 */
export function resolveWorkspaceRoot(options: ResolveWorkspaceOptions = {}): WorkspaceResolution {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const configured = env[HOLAHOLA_WORKSPACE_ROOT_ENV]?.trim();
  if (configured) return resolveCandidate(configured, 'configured', cwd);

  const replitHome = env.REPL_HOME?.trim();
  if (replitHome) return resolveCandidate(replitHome, 'replit', cwd);

  return resolveCandidate(cwd, 'current-directory', cwd);
}

export const workspaceResolution = resolveWorkspaceRoot();

/**
 * Inspect the capture directory without creating or changing anything.
 * Health endpoints use this form so a probe cannot mutate deployment state.
 */
export function inspectCaptureWorkspace(
  resolution: WorkspaceResolution = workspaceResolution,
): CaptureWorkspaceInspection {
  const localDirectory = join(resolution.root, '.local');
  if (!existsSync(localDirectory)) {
    return {
      rootSource: resolution.source,
      localDirectoryPresent: false,
      localDirectoryWritable: false,
    };
  }
  try {
    accessSync(localDirectory, constants.W_OK);
    return {
      rootSource: resolution.source,
      localDirectoryPresent: true,
      localDirectoryWritable: true,
    };
  } catch {
    return {
      rootSource: resolution.source,
      localDirectoryPresent: true,
      localDirectoryWritable: false,
    };
  }
}

/**
 * Capture writers may initialize .local, but must fail before appending any
 * dialogue if that directory cannot be used.
 */
export function ensureCaptureWorkspaceWritable(
  resolution: WorkspaceResolution = workspaceResolution,
): void {
  const localDirectory = join(resolution.root, '.local');
  try {
    mkdirSync(localDirectory, { recursive: true });
    accessSync(localDirectory, constants.W_OK);
  } catch (error: any) {
    throw new Error(
      `Canonical capture workspace is not writable (${resolution.source} root): ` +
      `${error?.message ?? String(error)}`,
    );
  }
}