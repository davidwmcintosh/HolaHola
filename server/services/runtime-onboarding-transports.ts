import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { RuntimeOnboardingClient } from './runtime-onboarding-client';
import type { RuntimeOnboardingStore } from './runtime-onboarding-store';

export type RuntimeMcpScope = {
  endpoint: string;
  actor: string;
  runtimeId: string;
};

export type RuntimeTransportOptions = RuntimeMcpScope & {
  store: RuntimeOnboardingStore;
  fetchImpl?: typeof fetch;
  /** Only isolated fake-endpoint tests should enable plain HTTP. */
  allowInsecureHttpForTests?: boolean;
};

/**
 * OpenAI-compatible enrolled HTTP transport. It supplies the broker-issued
 * authorization header internally for coordination MCP calls; it does not
 * supply an OpenAI platform API key or permit credentials to other hosts.
 */
export function createRuntimeOpenAITransport(options: RuntimeTransportOptions): {
  fetch: typeof fetch;
  client: RuntimeOnboardingClient;
} {
  const client = new RuntimeOnboardingClient({
    endpoint: options.endpoint,
    actor: options.actor,
    runtimeId: options.runtimeId,
    store: options.store,
    fetchImpl: options.fetchImpl,
    allowInsecureHttpForTests: options.allowInsecureHttpForTests,
  });
  return {
    fetch: (input, init) => client.authenticatedFetch(input, init),
    client,
  };
}

export type McpBridgeOptions = RuntimeTransportOptions & {
  input: Readable;
  output: Writable;
  diagnostics: Writable;
};

function writeLine(output: Writable, value: unknown): void {
  output.write(`${JSON.stringify(value)}\n`);
}

function parseJsonRpc(line: string): (Record<string, unknown> & { method: string }) | null {
  try {
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const value = parsed as Record<string, unknown>;
    return value.jsonrpc === '2.0' && typeof value.method === 'string'
      ? value as Record<string, unknown> & { method: string }
      : null;
  } catch {
    return null;
  }
}

async function forwardResponse(response: Response, output: Writable, requestId: unknown): Promise<void> {
  const body = await response.text();
  if (!body.trim()) return;
  const contentType = response.headers.get('content-type') ?? '';
  const messages: unknown[] = [];
  if (contentType.includes('text/event-stream')) {
    for (const line of body.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        messages.push(JSON.parse(data) as unknown);
      } catch {
        // Ignore non-JSON keepalive/event lines; only protocol JSON reaches stdout.
      }
    }
  } else {
    try {
      messages.push(JSON.parse(body) as unknown);
    } catch {
      messages.push(null);
    }
  }
  let forwarded = false;
  if (messages.length > 0) {
    for (const message of messages) {
      if (typeof message === 'object' && message !== null && !Array.isArray(message)) {
        writeLine(output, message);
        forwarded = true;
      }
    }
    if (forwarded) return;
  }
  if (requestId !== undefined) {
    writeLine(output, {
      jsonrpc: '2.0',
      id: requestId,
      error: { code: -32000, message: `Coordination MCP response was invalid (${response.status})` },
    });
  }
}

/**
 * Fixed stdio-to-Streamable-HTTP MCP bridge. The MCP config contains only
 * endpoint/actor/runtime IDs; this process reads and renews credentials from
 * the secure store and emits protocol JSON only on stdout.
 */
export async function runRuntimeMcpStdioBridge(options: McpBridgeOptions): Promise<void> {
  const client = new RuntimeOnboardingClient({
    endpoint: options.endpoint,
    actor: options.actor,
    runtimeId: options.runtimeId,
    store: options.store,
    fetchImpl: options.fetchImpl,
    allowInsecureHttpForTests: options.allowInsecureHttpForTests,
  });
  const lines = createInterface({ input: options.input, crlfDelay: Infinity });
  let diagnosticCount = 0;
  const diagnostic = (message: string) => {
    if (diagnosticCount >= 10) return;
    diagnosticCount += 1;
    options.diagnostics.write(`runtime-onboarding-mcp: ${message.slice(0, 160)}\n`);
  };
  for await (const line of lines) {
    if (line.length > 1024 * 1024) {
      writeLine(options.output, {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'MCP message exceeded the local size limit' },
      });
      continue;
    }
    const message = parseJsonRpc(line);
    if (!message) {
      writeLine(options.output, {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Invalid JSON-RPC message' },
      });
      continue;
    }
    const notification = message.id === undefined && message.method.startsWith('notifications/');
    try {
      const response = await client.authenticatedFetch(`${client.scope.endpoint}/api/mcp/coordination`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify(message),
      });
      if (notification) {
        // The stateless server may return an empty accepted response. Do not
        // turn notifications into responses on the stdio protocol.
        if (!response.ok) {
          await response.text();
          diagnostic(`notification failed (${response.status})`);
        } else {
          await response.arrayBuffer();
        }
        continue;
      }
      await forwardResponse(response, options.output, message.id);
    } catch (error) {
      const safeMessage = error instanceof Error && /^onboarding_[a-z0-9:_-]+$/.test(error.message)
        ? error.message
        : 'authenticated transport failed';
      diagnostic(safeMessage);
      if (!notification) {
        writeLine(options.output, {
          jsonrpc: '2.0',
          id: message.id ?? null,
          error: { code: -32000, message: 'Coordination MCP transport failed' },
        });
      }
    }
  }
}

export function generateRuntimeMcpClientConfig(input: {
  executable: string;
  cliEntryPath: string;
  entryArguments?: string[];
  endpoint: string;
  actor: string;
  runtimeId: string;
}): Record<string, unknown> {
  let endpoint: URL;
  try {
    endpoint = new URL(input.endpoint);
  } catch {
    throw new Error('onboarding_endpoint_invalid');
  }
  if (
    endpoint.protocol !== 'https:' || endpoint.username || endpoint.password
    || endpoint.pathname !== '/' || endpoint.search || endpoint.hash
  ) {
    throw new Error('onboarding_endpoint_must_be_trusted_https_origin');
  }
  if (!input.executable || !input.cliEntryPath || !/^[a-z][a-z0-9-]{1,63}$/.test(input.actor)
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/.test(input.runtimeId)) {
    throw new Error('onboarding_mcp_config_scope_invalid');
  }
  const args = [
    ...(input.entryArguments ?? [input.cliEntryPath]),
    'mcp',
    '--endpoint',
    endpoint.origin,
    '--actor',
    input.actor,
    '--runtime-id',
    input.runtimeId,
  ];
  return {
    mcpServers: {
      'holahola-coordination': {
        command: input.executable,
        args,
      },
    },
  };
}