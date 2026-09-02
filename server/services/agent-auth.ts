/**
 * Authentication headers for Luca's server-side callers.
 *
 * Dedicated coordination credentials are preferred. The legacy agent header is
 * retained only as a bounded migration fallback while existing environments
 * are provisioned with COORDINATION_LUCA_REPLIT_TOKEN.
 */

export type AgentActor = 'luca-replit' | 'luca-claude-code';

const ACTOR_TOKEN_ENV: Record<AgentActor, string> = {
  'luca-replit': 'COORDINATION_LUCA_REPLIT_TOKEN',
  'luca-claude-code': 'COORDINATION_LUCA_CLAUDE_CODE_TOKEN',
};

export function getAgentAuthHeaders(actor: AgentActor = 'luca-replit'): Record<string, string> | null {
  const dedicatedToken = process.env[ACTOR_TOKEN_ENV[actor]]?.trim();
  if (dedicatedToken) {
    return { 'x-coordination-token': dedicatedToken };
  }

  if (actor === 'luca-replit') {
    const legacyToken = process.env.REPLIT_AGENT_TOKEN?.trim();
    if (legacyToken) {
      return { 'x-agent-token': legacyToken };
    }
  }

  if (actor === 'luca-claude-code') {
    const compatibilityToken = process.env.SOURCE_BRIDGE_API_TOKEN?.trim();
    if (compatibilityToken) {
      return { 'x-coordination-token': compatibilityToken };
    }
  }

  return null;
}

export function getAgentCredential(actor: AgentActor = 'luca-replit'): string | null {
  const headers = getAgentAuthHeaders(actor);
  if (!headers) return null;
  return headers['x-coordination-token'] ?? headers['x-agent-token'] ?? null;
}