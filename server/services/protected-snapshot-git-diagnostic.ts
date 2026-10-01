/**
 * Closed, non-secret error codes only. Never propagate Git's stderr, argv,
 * environment, or raw error message into the founder-facing response.
 */
export function protectedSnapshotGitErrorCode(error: unknown): string {
  const value = error && typeof error === 'object'
    ? error as { code?: unknown; stderr?: unknown } : {};
  if (value.code === 'ENOENT') return 'protected_remote_snapshot_git_executable_missing';
  const stderr = Buffer.isBuffer(value.stderr)
    ? value.stderr.toString('utf8')
    : typeof value.stderr === 'string' ? value.stderr : '';
  if (/server certificate verification failed|SSL certificate problem|unable to get local issuer certificate|certificate verify failed/i.test(stderr)) {
    return 'protected_remote_snapshot_git_tls_failed';
  }
  if (/Authentication failed|could not read Username|requested URL returned error: (401|403)/i.test(stderr)) {
    return 'protected_remote_snapshot_git_authentication_failed';
  }
  if (/does not exist in|not a valid object name|could not get object info|not our ref|unadvertised object/i.test(stderr)) {
    return 'protected_remote_snapshot_git_source_object_missing';
  }
  return 'protected_remote_snapshot_git_failed';
}