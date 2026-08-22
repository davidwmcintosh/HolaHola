/**
 * pronunciation-error-reason.ts
 *
 * Shared utility for mapping OpenAI API errors to user-facing reason strings
 * for the pronunciation-unavailable error shape.
 *
 * Imported by:
 *   - server/routes.ts  (inner catch block on /api/pronunciation-scores/analyze)
 *   - server/scripts/test-openai-pronunciation-error-notice.ts  (test scenarios)
 *
 * Keeping the logic in one place ensures that any future change to the reason
 * strings or detection conditions is automatically reflected in both the route
 * and the tests — a divergence becomes a build error rather than a silent drift.
 */

export function mapApiErrorToReason(
  apiError: { message?: string; status?: number }
): string {
  const isConfigError = apiError?.message?.includes('No OpenAI API key');
  const isAuthError =
    apiError?.status === 401 ||
    apiError?.message?.includes('401') ||
    apiError?.message?.includes('Unauthorized') ||
    apiError?.message?.includes('invalid_api_key');
  const isRateLimit =
    apiError?.status === 429 ||
    apiError?.message?.includes('429') ||
    (apiError?.message?.toLowerCase() ?? '').includes('rate limit');

  return isConfigError
    ? 'OpenAI API key not configured'
    : isAuthError
    ? 'OpenAI API key is invalid or expired'
    : isRateLimit
    ? 'OpenAI rate limit reached; try again shortly'
    : apiError?.message ?? 'Unknown error';
}
