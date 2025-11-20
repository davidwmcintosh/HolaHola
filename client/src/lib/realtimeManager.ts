// GLOBAL SINGLETON: Ensures only ONE WebSocket connection to OpenAI exists
// This prevents multiple connections when React StrictMode causes multiple mounts
// Using window object to persist across module reloads

declare global {
  interface Window {
    __linguaflow_ws?: WebSocket;
    __linguaflow_conv_id?: string;
    __linguaflow_greeting_sent?: Set<string>;  // Track which conversations have received greetings
    __linguaflow_connecting?: boolean;  // Lock to prevent simultaneous connections
  }
}

export function getGlobalWebSocket(): WebSocket | null {
  return window.__linguaflow_ws || null;
}

export function isGloballyConnecting(): boolean {
  return window.__linguaflow_connecting || false;
}

export function setGloballyConnecting(connecting: boolean): void {
  window.__linguaflow_connecting = connecting;
  console.log('[REALTIME MANAGER] Connection lock:', connecting ? 'LOCKED' : 'UNLOCKED');
}

export function setGlobalWebSocket(ws: WebSocket | null, conversationId: string | null): void {
  // Close existing WebSocket if it exists and is different
  if (window.__linguaflow_ws && window.__linguaflow_ws !== ws) {
    console.log('[REALTIME MANAGER] Closing existing global WebSocket');
    try {
      window.__linguaflow_ws.close();
    } catch (e) {
      console.error('[REALTIME MANAGER] Error closing WebSocket:', e);
    }
  }
  
  window.__linguaflow_ws = ws || undefined;
  window.__linguaflow_conv_id = conversationId || undefined;
  
  if (ws) {
    console.log('[REALTIME MANAGER] ✓ Global WebSocket set for conversation:', conversationId);
  } else {
    console.log('[REALTIME MANAGER] Global WebSocket cleared');
  }
}

export function getGlobalConversationId(): string | null {
  return window.__linguaflow_conv_id || null;
}

export function clearGlobalWebSocket(): void {
  if (window.__linguaflow_ws) {
    console.log('[REALTIME MANAGER] Clearing global WebSocket');
    try {
      window.__linguaflow_ws.close();
    } catch (e) {
      console.error('[REALTIME MANAGER] Error closing WebSocket:', e);
    }
  }
  window.__linguaflow_ws = undefined;
  window.__linguaflow_conv_id = undefined;
}

// CRITICAL FIX: Identity-aware cleanup
// Only clear the global WebSocket if it matches the provided socket
// This prevents stale onclose handlers from closing fresh connections
export function clearGlobalWebSocketIfMatch(ws: WebSocket | null): void {
  if (!ws || window.__linguaflow_ws !== ws) {
    console.log('[REALTIME MANAGER] Skipping clear - socket does not match global reference');
    return;
  }
  
  console.log('[REALTIME MANAGER] Clearing global WebSocket (identity match confirmed)');
  window.__linguaflow_ws = undefined;
  window.__linguaflow_conv_id = undefined;
}

// PERSISTENT GREETING TRACKER: Uses localStorage to persist across page refreshes
const GREETING_STORAGE_KEY = 'linguaflow_greetings_sent';

function loadGreetingTracker(): Set<string> {
  try {
    const stored = localStorage.getItem(GREETING_STORAGE_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch (e) {
    console.error('[REALTIME MANAGER] Failed to load greeting tracker:', e);
  }
  return new Set();
}

function saveGreetingTracker(greetings: Set<string>): void {
  try {
    localStorage.setItem(GREETING_STORAGE_KEY, JSON.stringify(Array.from(greetings)));
  } catch (e) {
    console.error('[REALTIME MANAGER] Failed to save greeting tracker:', e);
  }
}

export function hasGreetingBeenSent(conversationId: string): boolean {
  if (!window.__linguaflow_greeting_sent) {
    window.__linguaflow_greeting_sent = loadGreetingTracker();
  }
  return window.__linguaflow_greeting_sent.has(conversationId);
}

export function markGreetingAsSent(conversationId: string): void {
  if (!window.__linguaflow_greeting_sent) {
    window.__linguaflow_greeting_sent = loadGreetingTracker();
  }
  window.__linguaflow_greeting_sent.add(conversationId);
  saveGreetingTracker(window.__linguaflow_greeting_sent);
  console.log('[REALTIME MANAGER] Greeting marked as sent for conversation:', conversationId);
}
