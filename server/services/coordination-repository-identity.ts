/**
 * Canonical repository identity used by every Coordinator V2 authority.
 * GitHub repository names are case-insensitive; accepting mixed case would
 * create two textual authorities for the same remote, so mixed-case paths
 * mixed-case paths are rejected to avoid ambiguous authority strings.
 */
export function normalizeCoordinationRepositoryIdentity(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()
    || /[\u0000-\u0020\\?#%]/.test(value)) throw new Error('REPOSITORY_IDENTITY_INVALID');
  let path: string;
  if (value.startsWith('github:')) {
    path = value.slice('github:'.length);
  } else if (value.startsWith('git@github.com:')) {
    path = value.slice('git@github.com:'.length);
  } else {
    let parsed: URL;
    try { parsed = new URL(value); } catch { throw new Error('REPOSITORY_IDENTITY_INVALID'); }
    if (parsed.hostname !== 'github.com' || parsed.username !== 'git' && parsed.username !== '') {
      throw new Error('REPOSITORY_IDENTITY_INVALID');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'ssh:') throw new Error('REPOSITORY_IDENTITY_INVALID');
    if (parsed.protocol === 'https:' && parsed.username !== '') throw new Error('REPOSITORY_IDENTITY_INVALID');
    if (parsed.password || parsed.search || parsed.hash) throw new Error('REPOSITORY_IDENTITY_INVALID');
    if (parsed.protocol === 'ssh:' && parsed.username !== 'git') throw new Error('REPOSITORY_IDENTITY_INVALID');
    path = parsed.pathname.slice(1);
  }
  if (path.endsWith('.git')) path = path.slice(0, -4);
  if (path.endsWith('.') || path.includes('..')) throw new Error('REPOSITORY_IDENTITY_INVALID');
  const parts = path.split('/');
  const normalizedParts = path.split('/');
  if (normalizedParts.length !== 2 || !normalizedParts[0] || !normalizedParts[1]
    || path !== path.toLowerCase()
    || !normalizedParts.every((part) => /^[a-z0-9][a-z0-9_.-]*$/.test(part))) {
    throw new Error('REPOSITORY_IDENTITY_INVALID');
  }
  return `github:${normalizedParts[0]}/${normalizedParts[1]}`;
}

export function sameCoordinationRepositoryIdentity(left: unknown, right: unknown): boolean {
  try { return normalizeCoordinationRepositoryIdentity(left) === normalizeCoordinationRepositoryIdentity(right); }
  catch { return false; }
}