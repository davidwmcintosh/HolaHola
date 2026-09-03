/**
 * Authentication headers for Luca's server-side callers.
 *
 * All server-side callers use dedicated actor-scoped coordination credentials.
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

  return null;
}

export function getAgentCredential(actor: AgentActor = 'luca-replit'): string | null {
  const headers = getAgentAuthHeaders(actor);
  if (!headers) return null;
  return headers['x-coordination-token'] ?? null;
}