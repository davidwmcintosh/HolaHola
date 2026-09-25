/**
 * Remote MCP (Model Context Protocol) endpoint for HolaHola's coordination
 * ledger.
 *
 * This is a protocol adapter, not a new capability: it exposes the exact
 * same coordination operations already available over REST
 * (coordination-routes.ts) and to Alden's own tool-calling loop
 * (alden-functions.ts) through the open MCP standard instead. Any
 * MCP-speaking client can attach here — the Antigravity IDE, an OpenAI
 * Agents/Responses API remote-MCP connection, Claude Desktop/Code, or any
 * future platform — using nothing more than the same per-actor coordination
 * token already issued for REST/CLI access (see
 * docs/coordination-clients.md). There is no Antigravity-specific (or any
 * other platform-specific) code here: the only per-connection state is
 * which actor the presented token resolves to.
 *
 * Transport: MCP "Streamable HTTP", stateless mode (one McpServer + one
 * transport per request, per the SDK's own documented pattern — see
 * @modelcontextprotocol/sdk's examples/server/simpleStatelessStreamableHttp).
 * Coordination tool calls are plain request/response; nothing here needs
 * server-initiated pushes or session continuity, so stateless mode avoids
 * holding any in-memory session state that a restart could lose.
 */
import type { Application, Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  resolveCoordinationCapability,
  COORDINATION_LEGACY_CAPABILITIES_BY_ACTOR,
} from '../middleware/coordination-auth';
import { registerCoordinationMcpTools } from '../services/mcp-coordination-tools';

const MCP_SERVER_INFO = { name: 'holahola-coordination', version: '1.0.0' };

function extractToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  // Accepted for parity with the existing REST/CLI header convention so the
  // same credential works unmodified across every coordination surface.
  const legacy = req.headers['x-coordination-token'];
  return typeof legacy === 'string' && legacy ? legacy : undefined;
}

function jsonRpcError(res: Response, status: number, message: string): void {
  res.status(status).json({ jsonrpc: '2.0', error: { code: -32000, message }, id: null });
}

export function registerMcpCoordinationRoutes(app: Application): void {
  app.post('/api/mcp/coordination', async (req, res) => {
    const token = extractToken(req);
    if (!token) {
      jsonRpcError(res, 401, 'Coordination token required (Authorization: Bearer <token>)');
      return;
    }
    // Every coordination actor's capability set includes coordination:read
    // (server/middleware/coordination-auth.ts), so this establishes identity
    // for any legitimate actor before any specific tool runs. Per-tool write
    // access is re-checked below from the same resolution, exactly as REST
    // routes pick coordination:read vs coordination:write per method.
    const resolution = await resolveCoordinationCapability(
      token,
      'coordination:read',
      undefined,
      req.ip || req.socket.remoteAddress,
    );
    if (!resolution.ok) {
      jsonRpcError(res, resolution.status, resolution.error);
      return;
    }
    const canWrite = resolution.authType === 'legacy'
      ? COORDINATION_LEGACY_CAPABILITIES_BY_ACTOR[resolution.actor].includes('coordination:write')
      : Boolean(resolution.credential?.capabilities.includes('coordination:write'));

    const server = new McpServer(MCP_SERVER_INFO);
    registerCoordinationMcpTools(server, { actor: resolution.actor, canWrite });
    try {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on('close', () => {
        void transport.close();
        void server.close();
      });
    } catch (error) {
      console.error('[MCP Coordination] request failed:', error);
      if (!res.headersSent) {
        jsonRpcError(res, 500, 'Internal server error');
      }
    }
  });

  // Stateless mode has no standalone SSE stream (GET) or session to end
  // (DELETE) — matches the SDK's own stateless example behavior.
  app.get('/api/mcp/coordination', (_req, res) => {
    jsonRpcError(res, 405, 'Method not allowed. This is a stateless MCP endpoint (POST only).');
  });
  app.delete('/api/mcp/coordination', (_req, res) => {
    jsonRpcError(res, 405, 'Method not allowed. This is a stateless MCP endpoint (POST only).');
  });
}
