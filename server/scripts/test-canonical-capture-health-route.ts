/**
 * Read-only integration check for the canonical capture readiness endpoint.
 * Requires a running local server and its configured agent token.
 */
export {};

const baseUrl = process.env.SERVER_URL ?? 'http://localhost:5000';
const token = process.env.COORDINATION_LUCA_REPLIT_TOKEN;

if (!token) {
  throw new Error('[canonical-capture-health] COORDINATION_LUCA_REPLIT_TOKEN is required for the authenticated readiness check.');
}

const endpoint = `${baseUrl}/api/internal/canonical-conversation-health`;
const unauthenticated = await fetch(endpoint);
if (unauthenticated.status !== 401) {
  throw new Error(`[canonical-capture-health] missing token returned ${unauthenticated.status}, expected 401.`);
}

const response = await fetch(endpoint, {
  headers: { 'x-coordination-token': token },
});
const body = await response.json() as Record<string, any>;
if (response.status !== 200 || body.ok !== true) {
  throw new Error(`[canonical-capture-health] authenticated probe failed: status=${response.status} body=${JSON.stringify(body)}`);
}
if (
  typeof body.capture !== 'object' ||
  body.capture.worker?.armed !== true ||
  body.capture.worker?.phase !== 'armed' ||
  typeof body.capture.worker?.startedAt !== 'number' ||
  typeof body.capture.worker?.armedAt !== 'number' ||
  typeof body.capture.cursorByteOffset !== 'number' ||
  typeof body.capture.acknowledgementCursorByteOffset !== 'number' ||
  typeof body.capture.pendingBytes !== 'number' ||
  typeof body.capture.localDirectoryWritable !== 'boolean' ||
  'workspace' in body ||
  'path' in body ||
  'token' in body
) {
  throw new Error(`[canonical-capture-health] response disclosed an unsafe shape: ${JSON.stringify(body)}`);
}

console.log('PASS: canonical capture health is agent-authenticated, worker-armed, read-only, and returns only safe readiness state.');