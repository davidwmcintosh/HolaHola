/**
 * Prints a short-lived GitHub App installation token to stdout. Lets a
 * GitHub Actions workflow push to GitHub over HTTPS without a long-lived SSH
 * deploy key — see server/services/github-app-auth.ts, the same mechanism
 * server/services/source-control-service.ts uses for the coordinator's own
 * fast-forward push.
 *
 * Usage: npx tsx scripts/print-github-app-token.ts
 * Requires HOLAHOLA_GITHUB_APP_ID, HOLAHOLA_GITHUB_APP_INSTALLATION_ID, and
 * HOLAHOLA_GITHUB_APP_PRIVATE_KEY in the environment. Prints only the raw
 * token to stdout (no trailing newline) so a caller can capture it directly
 * into a shell variable; all diagnostics go to stderr.
 */
import { fetchGithubInstallationToken } from '../server/services/github-app-auth';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

async function main() {
  const appId = requireEnv('HOLAHOLA_GITHUB_APP_ID');
  const installationId = requireEnv('HOLAHOLA_GITHUB_APP_INSTALLATION_ID');
  const privateKey = requireEnv('HOLAHOLA_GITHUB_APP_PRIVATE_KEY');
  const { token } = await fetchGithubInstallationToken({ appId, installationId, privateKey });
  process.stdout.write(token);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
