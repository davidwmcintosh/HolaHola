// Proves the remote MCP (Model Context Protocol) adapter for the
// coordination ledger: a real JSON-RPC round trip over HTTP against
// server/routes/mcp-coordination-route.ts, using nothing but the same
// per-actor coordination tokens every other coordination surface (REST,
// CLI, Alden's tool-calling loop) already authenticates with. This is the
// generic, provider-neutral surface — any MCP client (Antigravity, an
// OpenAI remote-MCP connection, Claude, etc.) speaks the same protocol
// tested here.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { eq } from 'drizzle-orm';
import { coordinationEvents, coordinationThreads } from '@shared/schema';
import { closeDbConnections, getSharedDb } from '../db';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import {
  exchangeBootstrapCredential,
  registerCoordinationRuntime,
} from '../services/coordination-credential-broker';
import { registerMcpCoordinationRoutes } from '../routes/mcp-coordination-route';

const TOKENS = {
  'luca-holahola': 'mcp-route-hola-token-'.repeat(3),
  alden: 'mcp-route-alden-token-'.repeat(3),
} as const;

const TOKEN_ENVIRONMENT = {
  COORDINATION_LUCA_HOLAHOLA_TOKEN: TOKENS['luca-holahola'],
  COORDINATION_ALDEN_TOKEN: TOKENS.alden,
  COORDINATION_INBOX_TOKEN_SECRET: 'mcp-route-inbox-signing-secret-'.repeat(2),
} as const;

const hasIsolatedCiDatabase = Boolean(getVerifiedCiDatabaseUrl());
const databaseTest = hasIsolatedCiDatabase ? test : test.skip;
const runId = `mcp-route-${Date.now()}`;
const threadIds: string[] = [];
const previousEnvironment = new Map<string, string | undefined>();

const app = express();
app.use(express.json());
registerMcpCoordinationRoutes(app);

let server: Server;
let baseUrl: string;

before(async () => {
  for (const [key, value] of Object.entries(TOKEN_ENVIRONMENT)) {
    previousEnvironment.set(key, process.env[key]);
    process.env[key] = value;
  }
  await new Promise<void>((resolve) => {
    server = createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  for (const [key, value] of previousEnvironment) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  if (hasIsolatedCiDatabase && threadIds.length > 0) {
    const db = getSharedDb();
    for (const id of threadIds) {
      await db.delete(coordinationThreads).where(eq(coordinationThreads.id, id));
    }
  }
  await closeDbConnections();
});

let rpcId = 0;

// The SDK's StreamableHTTPServerTransport answers a single JSON-RPC request
// with a single SSE-framed message ("event: message\ndata: {...}") rather
// than a bare JSON body — this is valid per the MCP Streamable HTTP spec,
// and every real MCP client SDK parses it as SSE. This test has no SSE
// client, so it strips the framing itself: take the payload after the last
// "data:" line, which is the complete JSON-RPC response for our
// single-request (non-batched) calls.
function parseJsonRpcResponse(text: string): any {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed);
  }
  const dataLines = trimmed.split('\n').filter((line) => line.startsWith('data:'));
  if (dataLines.length === 0) {
    throw new Error(`Response was neither JSON nor SSE-framed: ${text}`);
  }
  return JSON.parse(dataLines[dataLines.length - 1].slice('data:'.length).trim());
}

async function rpc(
  method: string,
  params: Record<string, unknown> | undefined,
  options: { token?: string } = {},
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    // Required by the SDK's stateless transport: it 406s unless both are accepted.
    accept: 'application/json, text/event-stream',
    ...(options.token !== undefined ? { authorization: `Bearer ${options.token}` } : {}),
  };
  const response = await fetch(`${baseUrl}/api/mcp/coordination`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params: params ?? {} }),
  });
  const text = await response.text();
  if (!text) return { status: response.status, body: undefined };
  let body: any;
  try {
    body = parseJsonRpcResponse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

test('rejects a request with no coordination token', async () => {
  const result = await rpc('tools/list', {});
  assert.equal(result.status, 401);
});

test('rejects a request with an invalid coordination token', async () => {
  const result = await rpc('tools/list', {}, { token: 'not-a-real-token-not-a-real-token' });
  assert.equal(result.status, 401);
});

test('GET and DELETE are rejected as method not allowed (stateless mode)', async () => {
  const getResponse = await fetch(`${baseUrl}/api/mcp/coordination`);
  assert.equal(getResponse.status, 405);
  const deleteResponse = await fetch(`${baseUrl}/api/mcp/coordination`, { method: 'DELETE' });
  assert.equal(deleteResponse.status, 405);
});

test('initialize succeeds for a valid actor token', async () => {
  const result = await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' },
  }, { token: TOKENS['luca-holahola'] });
  assert.equal(result.status, 200);
  assert.equal(result.body.result.serverInfo.name, 'holahola-coordination');
});

test('tools/list exposes the four coordination tools as a standalone stateless call', async () => {
  const result = await rpc('tools/list', {}, { token: TOKENS['luca-holahola'] });
  assert.equal(result.status, 200);
  const names = result.body.result.tools.map((tool: any) => tool.name).sort();
  assert.deepEqual(names, [
    'create_coordination_thread',
    'get_coordination_thread',
    'list_coordination_inbox',
    'reply_to_coordination_thread',
  ]);
});

databaseTest('a full create -> reply -> get -> inbox round trip works end to end over MCP', async () => {
  const title = `MCP route e2e ${runId}`;
  const created = await rpc('tools/call', {
    name: 'create_coordination_thread',
    arguments: {
      recipient: 'alden',
      title,
      description: 'End-to-end proof that the MCP coordination adapter creates real ledger threads.',
      model: 'test-harness',
    },
  }, { token: TOKENS['luca-holahola'] });
  assert.equal(created.status, 200);
  assert.equal(created.body.result.isError, undefined, JSON.stringify(created.body.result));
  const createdPayload = JSON.parse(created.body.result.content[0].text);
  const threadId: string = createdPayload.threadId;
  assert.equal(typeof threadId, 'string');
  threadIds.push(threadId);
  assert.equal(createdPayload.recipient, 'alden');

  const replied = await rpc('tools/call', {
    name: 'reply_to_coordination_thread',
    arguments: {
      thread_id: threadId,
      recipient: 'luca-holahola',
      content: `Received thread ${runId}.`,
      model: 'test-harness',
    },
  }, { token: TOKENS.alden });
  assert.equal(replied.status, 200);
  assert.equal(replied.body.result.isError, undefined, JSON.stringify(replied.body.result));

  const fetched = await rpc('tools/call', {
    name: 'get_coordination_thread',
    arguments: { thread_id: threadId },
  }, { token: TOKENS['luca-holahola'] });
  assert.equal(fetched.status, 200);
  const fetchedPayload = JSON.parse(fetched.body.result.content[0].text);
  const commentEvent = fetchedPayload.events.find((event: any) => event.eventType === 'comment');
  assert.ok(commentEvent, `expected a comment event, got: ${JSON.stringify(fetchedPayload.events)}`);
  assert.equal(commentEvent.content, `Received thread ${runId}.`);

  const inbox = await rpc('tools/call', {
    name: 'list_coordination_inbox',
    arguments: { limit: 50 },
  }, { token: TOKENS['luca-holahola'] });
  assert.equal(inbox.status, 200);
  const inboxPayload = JSON.parse(inbox.body.result.content[0].text);
  assert.ok(inboxPayload.items.some((item: any) => item.threadId === threadId));
});

databaseTest('a self-addressed create is rejected as a tool-level error, not a transport error', async () => {
  const result = await rpc('tools/call', {
    name: 'create_coordination_thread',
    arguments: {
      recipient: 'luca-holahola',
      title: 'Should not be created',
      description: 'Self-addressed thread must be rejected.',
      model: 'test-harness',
    },
  }, { token: TOKENS['luca-holahola'] });
  assert.equal(result.status, 200);
  assert.equal(result.body.result.isError, true);
});

databaseTest('a read-only broker credential is blocked from writes but can still read over MCP', async () => {
  // Registered for 'daniela' (not luca-holahola/alden, both of which get an
  // assertParticipant() steward bypass in coordination-ledger-service.ts) so
  // the read-tool assertions below prove genuine participant-gated reads,
  // not a bypass path that would work even without a real credential.
  const readOnlyRuntimeId = `${runId}-readonly`;
  const { bootstrapToken } = await registerCoordinationRuntime({
    runtimeId: readOnlyRuntimeId,
    actor: 'daniela',
    displayName: 'MCP route read-only broker credential (CI)',
    capabilities: ['coordination:read'],
    tokenTtlSeconds: 60,
  });
  const exchanged = await exchangeBootstrapCredential(readOnlyRuntimeId, bootstrapToken);
  assert.equal(exchanged.ok, true);
  if (!exchanged.ok) return;
  const readOnlyToken = exchanged.accessToken;

  // Seed a real thread addressed to the read-only actor, created with a
  // full-capability legacy credential, so the read tools below have
  // something genuine to see.
  const title = `MCP route read-only ${runId}`;
  const seeded = await rpc('tools/call', {
    name: 'create_coordination_thread',
    arguments: {
      recipient: 'daniela',
      title,
      description: 'Seed thread for the read-only credential capability proof.',
      model: 'test-harness',
    },
  }, { token: TOKENS['luca-holahola'] });
  assert.equal(seeded.status, 200);
  assert.equal(seeded.body.result.isError, undefined, JSON.stringify(seeded.body.result));
  const threadId: string = JSON.parse(seeded.body.result.content[0].text).threadId;
  threadIds.push(threadId);

  const attemptedCreateTitle = `Must not be created by a read-only credential ${runId}`;
  const attemptedCreate = await rpc('tools/call', {
    name: 'create_coordination_thread',
    arguments: {
      recipient: 'alden',
      title: attemptedCreateTitle,
      description: 'A read-only broker credential must not be able to originate threads over MCP.',
      model: 'test-harness',
    },
  }, { token: readOnlyToken });
  assert.equal(attemptedCreate.status, 200);
  assert.equal(attemptedCreate.body.result.isError, true);
  assert.match(
    JSON.parse(attemptedCreate.body.result.content[0].text).error,
    /coordination:write/,
  );

  const attemptedReply = await rpc('tools/call', {
    name: 'reply_to_coordination_thread',
    arguments: {
      thread_id: threadId,
      recipient: 'luca-holahola',
      content: 'A read-only credential must not be able to post this.',
      model: 'test-harness',
    },
  }, { token: readOnlyToken });
  assert.equal(attemptedReply.status, 200);
  assert.equal(attemptedReply.body.result.isError, true);
  assert.match(
    JSON.parse(attemptedReply.body.result.content[0].text).error,
    /coordination:write/,
  );

  // The two rejections above must be pure denials, not partial writes: no
  // stray thread and no extra event beyond the seed thread's own creation.
  const db = getSharedDb();
  const strayThreads = await db.select({ id: coordinationThreads.id })
    .from(coordinationThreads)
    .where(eq(coordinationThreads.title, attemptedCreateTitle));
  assert.deepEqual(strayThreads, []);
  const seedThreadEvents = await db.select({ id: coordinationEvents.id })
    .from(coordinationEvents)
    .where(eq(coordinationEvents.threadId, threadId));
  assert.equal(seedThreadEvents.length, 1, 'the seed thread must still contain only its creation event');

  const inbox = await rpc('tools/call', {
    name: 'list_coordination_inbox',
    arguments: { limit: 50 },
  }, { token: readOnlyToken });
  assert.equal(inbox.status, 200);
  assert.equal(inbox.body.result.isError, undefined, JSON.stringify(inbox.body.result));
  const inboxPayload = JSON.parse(inbox.body.result.content[0].text);
  assert.ok(inboxPayload.items.some((item: any) => item.threadId === threadId));

  const fetched = await rpc('tools/call', {
    name: 'get_coordination_thread',
    arguments: { thread_id: threadId },
  }, { token: readOnlyToken });
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.result.isError, undefined, JSON.stringify(fetched.body.result));
  const fetchedPayload = JSON.parse(fetched.body.result.content[0].text);
  assert.equal(fetchedPayload.threadId, threadId);
  assert.equal(fetchedPayload.title, title);
});
