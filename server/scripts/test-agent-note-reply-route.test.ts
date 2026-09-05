import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { like } from 'drizzle-orm';
import { agentNotes } from '@shared/schema';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import { closeDbConnections, getSharedDb } from '../db';
import { registerAgentNoteReplyRoute } from '../routes/agent-note-reply-route';

const TOKENS = {
  'luca-replit': 'reply-route-replit-token-'.repeat(2),
  'luca-claude-code': 'reply-route-claude-token-'.repeat(2),
} as const;
const prefix = `reply-route-${Date.now()}`;
const hasIsolatedCiDatabase = Boolean(getVerifiedCiDatabaseUrl());
const databaseTest = hasIsolatedCiDatabase ? test : test.skip;
const previousEnvironment = new Map<string, string | undefined>();
let server: Server;
let baseUrl: string;

async function request(
  parentId: string,
  token: string | undefined,
  idempotencyKey: string,
  body: Record<string, unknown>,
) {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
    'idempotency-key': idempotencyKey,
  };
  if (token) headers['x-coordination-token'] = token;
  const response = await fetch(`${baseUrl}/api/agent/notes/${encodeURIComponent(parentId)}/reply`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json() as Record<string, any>,
  };
}

before(async () => {
  for (const [name, value] of Object.entries({
    COORDINATION_LUCA_REPLIT_TOKEN: TOKENS['luca-replit'],
    COORDINATION_LUCA_CLAUDE_CODE_TOKEN: TOKENS['luca-claude-code'],
  })) {
    previousEnvironment.set(name, process.env[name]);
    process.env[name] = value;
  }
  const app = express();
  app.use(express.json());
  registerAgentNoteReplyRoute(app);
  await new Promise<void>((resolve) => {
    server = createServer(app);
    server.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  if (hasIsolatedCiDatabase) {
    await getSharedDb().delete(agentNotes)
      .where(like(agentNotes.sourceMessageKey, `${prefix}%`));
    await closeDbConnections();
  }
  for (const [name, value] of previousEnvironment) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test('reply route rejects missing and invalid coordination credentials', async () => {
  const parentId = '00000000-0000-4000-8000-000000000000';
  for (const [label, token] of [
    ['missing', undefined],
    ['invalid', 'not-a-valid-coordination-token'],
  ] as const) {
    const response = await request(parentId, token, `${prefix}-${label}`, { body: 'Never delivered.' });
    assert.equal(response.status, 401);
    assert.deepEqual(Object.keys(response.body), ['error']);
  }
});

databaseTest('reply route derives both Luca identities and rejects cross-inbox access', async () => {
  const db = getSharedDb();
  const [toReplit] = await db.insert(agentNotes).values({
    fromAgent: 'luca-claude-code',
    toAgent: 'agent',
    subject: 'Reply to Claude',
    body: 'Origin for Luca Replit.',
    sourceMessageKey: `${prefix}-parent-replit`,
  }).returning();
  const [toClaude] = await db.insert(agentNotes).values({
    fromAgent: 'agent',
    toAgent: 'luca-claude-code',
    subject: 'Reply to Replit',
    body: 'Origin for Luca Claude Code.',
    sourceMessageKey: `${prefix}-parent-claude`,
  }).returning();

  const replitReply = await request(
    toReplit.id,
    TOKENS['luca-replit'],
    `${prefix}-reply-replit`,
    {
      body: 'Replit outcome.',
      fromAgent: 'alden',
      toAgent: 'alden',
      actor: 'alden',
    },
  );
  assert.equal(replitReply.status, 200);
  assert.equal(replitReply.body.deliveryState, 'delivered');
  assert.equal(replitReply.body.note.fromAgent, 'agent');
  assert.equal(replitReply.body.note.toAgent, 'luca-claude-code');
  assert.equal(replitReply.body.note.inReplyToId, toReplit.id);

  const claudeReply = await request(
    toClaude.id,
    TOKENS['luca-claude-code'],
    `${prefix}-reply-claude`,
    {
      body: 'Claude outcome.',
      fromAgent: 'founder',
      toAgent: 'founder',
      actor: 'luca-replit',
    },
  );
  assert.equal(claudeReply.status, 200);
  assert.equal(claudeReply.body.deliveryState, 'delivered');
  assert.equal(claudeReply.body.note.fromAgent, 'luca-claude-code');
  assert.equal(claudeReply.body.note.toAgent, 'agent');
  assert.equal(claudeReply.body.note.inReplyToId, toClaude.id);

  const crossInbox = await request(
    toReplit.id,
    TOKENS['luca-claude-code'],
    `${prefix}-cross-inbox`,
    { body: 'Must be rejected.' },
  );
  assert.equal(crossInbox.status, 403);
  assert.equal(crossInbox.body.code, 'parent_inbox_forbidden');
});