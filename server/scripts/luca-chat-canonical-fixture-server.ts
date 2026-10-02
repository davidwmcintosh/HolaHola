/**
 * Isolated HTTP/provider fixture for the canonical Luca chat integration.
 *
 * Keep all environment/workspace/database checks above the first application
 * import: this program must never initialize production application modules
 * against an unverified or non-owned database.
 */
import { existsSync, realpathSync } from 'fs';
import { tmpdir } from 'os';
import { resolve, relative, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer as createNetServer } from 'net';

const refusal = (reason: string): never => {
  throw new Error(`REFUSING TO RUN: canonical-save fixture ${reason}`);
};

const workspace = process.env.HOLAHOLA_WORKSPACE_ROOT;
if (!workspace || resolve(workspace) !== resolve(process.cwd())) {
  refusal('requires its exact temporary workspace as cwd');
}
const [realWorkspace, realProjectRoot] = (() => {
  try {
    return [realpathSync(process.cwd()), realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../..'))];
  } catch {
    return refusal('requires an existing temporary workspace');
  }
})();
const tempRoot = realpathSync(tmpdir());
const tempRelative = relative(tempRoot, realWorkspace!);
if (realWorkspace === realProjectRoot || tempRelative.startsWith('..') || resolve(tempRelative) === '.') {
  refusal('refuses the real checkout or any non-temporary cwd');
}
if (!existsSync(resolve(realWorkspace!, '.local/CANONICAL_SAVE_SANDBOX')) ||
    !existsSync(resolve(realWorkspace!, '.local/docs/server/shared/episode-99.md'))) {
  refusal('requires the owned canonical-save workspace markers');
}

// This shared guard verifies getVerifiedCiDatabaseUrl(), the exact db name,
// the 32-character per-run nonce, and the private temporary workspace before
// this fixture loads any application modules.
const { assertCanonicalSaveIsolation } = await import('./luca-chat-canonical-isolation');
let isolation: { root: string; databaseUrl: string; runId: string };
try {
  isolation = assertCanonicalSaveIsolation();
} catch (error) {
  refusal(`failed shared isolation validation (${error instanceof Error ? error.message : String(error)})`);
}
if (resolve(isolation!.root) !== resolve(process.cwd())) refusal('requires its validated workspace to equal cwd');
const runId = isolation!.runId;
const expectedDatabaseName = process.env.CANONICAL_SAVE_DATABASE_NAME;
const actualDatabaseName = decodeURIComponent(new URL(isolation!.databaseUrl).pathname.replace(/^\/+/, ''));
if (!/^[a-f0-9]{32}$/.test(runId) ||
    !expectedDatabaseName ||
    !/^canonical_save_ci_[a-f0-9]{32}$/.test(expectedDatabaseName) ||
    actualDatabaseName !== expectedDatabaseName) {
  refusal('requires the exact owned canonical_save_ci_<32-hex> database URL and private per-run nonce');
}

const token = process.env.COORDINATION_LUCA_REPLIT_TOKEN;
if (!token || token.length < 32) refusal('requires the private per-run Luca credential');

async function reserveLoopbackPort(): Promise<number> {
  const probe = createNetServer();
  await new Promise<void>((resolveListen, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolveListen);
  });
  const address = probe.address();
  if (!address || typeof address === 'string') throw new Error('Could not allocate a local fixture port');
  const port = address.port;
  await new Promise<void>((resolveClose, reject) => probe.close(error => error ? reject(error) : resolveClose()));
  return port;
}

let anthropicCalls = 0;
let embeddingCalls = 0;
let forbiddenFetchAttempts = 0;
let forbiddenFetchRejected = false;
const providerReply = `Canonical-save deterministic Luca fixture reply. ${'A long deterministic answer exercises the production chunk-splitting threshold without contacting an external provider. '.repeat(34)}`;
if (providerReply.length < 2_400) {
  throw new Error('Canonical-save provider fixture reply must exercise the long-response chunk arm');
}

const port = await reserveLoopbackPort();
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}`;
const originalFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const sourceUrl = input instanceof Request ? input.url : String(input);
  const parsedUrl = new URL(sourceUrl);
  if (parsedUrl.origin === 'https://api.openai.com' && parsedUrl.pathname === '/v1/embeddings') {
    return originalFetch(`http://127.0.0.1:${port}/v1/embeddings`, init);
  }
  if (parsedUrl.origin === `http://127.0.0.1:${port}` &&
      (parsedUrl.pathname === '/v1/messages' || parsedUrl.pathname === '/v1/embeddings')) {
    return originalFetch(input, init);
  }
  forbiddenFetchAttempts++;
  throw new Error(`CANONICAL_SAVE_FORBIDDEN_FETCH: rejected outbound request to ${parsedUrl.origin}${parsedUrl.pathname}`);
}) as typeof fetch;

try {
  await fetch('https://canonical-save-forbidden-probe.invalid/outbound-check');
} catch (error) {
  forbiddenFetchRejected = error instanceof Error &&
    error.message.includes('CANONICAL_SAVE_FORBIDDEN_FETCH');
}
if (!forbiddenFetchRejected) {
  throw new Error('Canonical-save outbound-fetch guard self-probe unexpectedly passed');
}

// All app imports happen only after assertCanonicalSaveIsolation and the
// network-deny guard are in place. The provider base URL is already local.
const { default: express } = await import('express');
const { lucaChatPostHandler } = await import('../routes/luca-chat-post-route');
const { loadAuthenticatedUser, requireFounderOrAgent } = await import('../middleware/rbac');
const { getMonitoringDb, closeDbConnections } = await import('../db');
const { sql } = await import('drizzle-orm');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.get('/api/health', (_req: any, res: any) => {
  res.json({ canonicalSaveRunId: runId });
});
app.post('/v1/messages', (_req: any, res: any) => {
  anthropicCalls++;
  res.json({
    id: `msg_${runId}`,
    type: 'message',
    role: 'assistant',
    model: 'claude-fixture',
    content: [{ type: 'text', text: providerReply }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 16, output_tokens: 512 },
  });
});
app.post('/v1/embeddings', (_req: any, res: any) => {
  embeddingCalls++;
  res.json({
    object: 'list',
    data: [{ object: 'embedding', index: 0, embedding: Array.from({ length: 768 }, (_, index) => index === 0 ? 1 : 0) }],
    model: 'text-embedding-3-small',
    usage: { prompt_tokens: 8, total_tokens: 8 },
  });
});
app.get('/fixture-status', async (_req: any, res: any) => {
  try {
    const db = getMonitoringDb();
    const [memories, notes, embeddings] = await Promise.all([
      db.execute(sql`SELECT COUNT(*)::int AS count FROM conversation_memories`),
      db.execute(sql`SELECT COUNT(*)::int AS count FROM agent_notes`),
      db.execute(sql`SELECT COUNT(*)::int AS count FROM memory_embeddings`),
    ]);
    const first = (result: any) => (result as any).rows?.[0] ?? (Array.isArray(result) ? result[0] : {});
    res.json({
      canonicalSaveRunId: runId,
      completionCalls: anthropicCalls,
      embeddingCalls,
      forbiddenFetchRejected,
      writes: {
        conversationMemories: Number(first(memories).count ?? 0),
        agentNotes: Number(first(notes).count ?? 0),
        memoryEmbeddings: Number(first(embeddings).count ?? 0),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});
app.post('/api/admin/luca/chat', loadAuthenticatedUser({}), requireFounderOrAgent, lucaChatPostHandler);
const server = app.listen(port, '127.0.0.1', () => {
  process.stdout.write(`${JSON.stringify({ type: 'canonical-save-ready', port, nonce: runId })}\n`);
});

let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close(async () => {
    try { await closeDbConnections(); }
    catch (error) {
      console.error('Canonical-save fixture DB pool shutdown failed:', error);
      process.exitCode = 1;
    }
    process.exit();
  });
  setTimeout(() => process.exit(1), 8_000).unref();
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);