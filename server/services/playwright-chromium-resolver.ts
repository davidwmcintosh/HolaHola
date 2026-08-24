import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export type ChromiumExecutableSource = 'configured' | 'playwright-managed' | 'system';

export interface ChromiumResolution {
  executablePath: string;
  source: ChromiumExecutableSource;
}

export interface ChromiumResolutionOptions {
  configuredPath?: string;
  managedPath?: string;
  systemPaths?: string[];
}

function findSystemChromium(): string[] {
  const commands = process.platform === 'win32'
    ? [['where.exe', 'chromium'], ['where.exe', 'chrome']]
    : [['which', 'chromium'], ['which', 'chromium-browser'], ['which', 'google-chrome']];

  const paths: string[] = [];
  for (const [command, name] of commands) {
    try {
      const output = execFileSync(command, [name], { encoding: 'utf8' });
      const firstPath = output.split(/\r?\n/).map(line => line.trim()).find(Boolean);
      if (firstPath && existsSync(firstPath)) paths.push(firstPath);
    } catch {
      // This candidate is not installed; continue checking the platform's
      // other conventional Chromium executable names.
    }
  }
  return paths;
}

export function resolveChromiumExecutable(
  options: ChromiumResolutionOptions = {},
): ChromiumResolution | null {
  const configuredPath = (options.configuredPath ?? process.env.PLAYWRIGHT_EXECUTABLE_PATH)?.trim();
  if (configuredPath) {
    return existsSync(configuredPath)
      ? { executablePath: configuredPath, source: 'configured' }
      : null;
  }

  if (options.managedPath && existsSync(options.managedPath)) {
    return { executablePath: options.managedPath, source: 'playwright-managed' };
  }

  const systemPath = (options.systemPaths ?? findSystemChromium()).find(path => existsSync(path));
  return systemPath ? { executablePath: systemPath, source: 'system' } : null;
}