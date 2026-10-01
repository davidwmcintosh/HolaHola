/** Credential custody must not depend on response field order or log truncation. */
export function apiResponseBodyForLogging<T>(path: string, body: T): T | undefined {
  let normalized: string;
  try {
    normalized = path;
    for (let layer = 0; layer < 8; layer += 1) {
      const decoded = decodeURIComponent(normalized);
      if (decoded === normalized) break;
      normalized = decoded;
    }
    // Do not log bodies when encoded routing semantics remain ambiguous.
    if (/%[0-9a-f]{2}/i.test(normalized)) return undefined;
    normalized = new URL(
      normalized.replace(/\\/g, '/'),
      'https://response-log.invalid',
    ).pathname.toLowerCase();
  } catch {
    return undefined;
  }
  const sensitivePrefixes = [
    '/api/coordination/credentials',
    '/api/coordination/onboarding',
    '/api/coordination/runtimes',
  ];
  return sensitivePrefixes.some((prefix) =>
    normalized === prefix || normalized.startsWith(`${prefix}/`))
    ? undefined
    : body;
}