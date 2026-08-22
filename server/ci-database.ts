const LOCAL_CI_DATABASE_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

/**
 * Returns the disposable PostgreSQL URL only for an explicitly verified CI
 * process. A stray CI_DATABASE_URL in development or production must never
 * change the application's Neon transport.
 */
export function getVerifiedCiDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const ciDatabaseUrl = env.CI_DATABASE_URL;
  if (!ciDatabaseUrl || env.CI !== 'true') {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(ciDatabaseUrl);
  } catch {
    throw new Error('[DB] FATAL: CI_DATABASE_URL must be a valid PostgreSQL connection URL');
  }

  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    !LOCAL_CI_DATABASE_HOSTS.has(parsed.hostname)
  ) {
    throw new Error('[DB] FATAL: CI_DATABASE_URL must target a job-local PostgreSQL service');
  }

  if (env.NEON_SHARED_DATABASE_URL !== ciDatabaseUrl) {
    throw new Error(
      '[DB] FATAL: NEON_SHARED_DATABASE_URL must match CI_DATABASE_URL in CI to prevent live-database fallback',
    );
  }

  return ciDatabaseUrl;
}