import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routes = readFileSync(resolve(process.cwd(), 'server/routes.ts'), 'utf8');
const replyRoute = readFileSync(
  resolve(process.cwd(), 'server/routes/agent-note-reply-route.ts'),
  'utf8',
);
const ledger = readFileSync(
  resolve(process.cwd(), 'server/services/coordination-ledger-service.ts'),
  'utf8',
);
const workflow = readFileSync(
  resolve(process.cwd(), '.agents/skills/holahola-build/SKILL.md'),
  'utf8',
);

for (const routeNeedle of [
  'app.post("/api/agent/notes/mark-read", requireCoordinationAuth',
  'app.patch("/api/agent/notes/:id/status", requireCoordinationAuth',
  'app.get("/api/agent/notes/:id", requireCoordinationAuth',
]) {
  assert.ok(routes.includes(routeNeedle), `${routeNeedle} must remain actor-authenticated`);
}
assert.match(
  replyRoute,
  /['"]\/api\/agent\/notes\/:id\/reply['"],\s*requireCoordinationAuth/,
  'reply route must remain actor-authenticated',
);

assert.match(
  routes,
  /inboxForReplyingActor\(req\.coordinationActor\)[\s\S]*?Actor does not own the note inbox/,
  'per-note routes must derive and enforce the authenticated actor inbox',
);
assert.match(
  replyRoute,
  /req\.body\?\.idempotencyKey \?\? req\.body\?\.source_message_key/,
  'reply route must retain legacy body idempotency compatibility',
);

const combinedStart = ledger.indexOf('export async function completeWithLinkedOutcome');
const combinedEnd = ledger.indexOf('\nexport async function getCoordinationThread', combinedStart);
assert.ok(combinedStart >= 0 && combinedEnd > combinedStart, 'combined completion function must exist');
const combined = ledger.slice(combinedStart, combinedEnd);
assert.match(combined, /db\.transaction\(async \(tx\)/, 'local linked completion must use one transaction');
assert.match(
  combined,
  /replyToAgentNoteAndVerifyInTransaction\(tx,/,
  'reply insertion and verification must use the completion transaction',
);
assert.match(
  combined,
  /requestDigest[\s\S]*?payload: \{[\s\S]*?linkedOutcome:/,
  'completed event must persist the immutable operation fingerprint',
);
assert.doesNotMatch(
  combined,
  /delivery_succeeded_completion_pending/,
  'local shared-database completion must not expose a split success state',
);

assert.match(
  ledger,
  /if \(input\.eventType === 'completed'\) \{[\s\S]*?await assertLinkedOutcome/,
  'ordinary completion must retain the linked-outcome guard',
);
assert.match(
  workflow,
  /do not call `markTaskComplete` until the[\s\S]*?complete-with-linked-outcome/,
  'external task completion instructions must require linked delivery first',
);

console.log('✓ linked-outcome static guard passed');