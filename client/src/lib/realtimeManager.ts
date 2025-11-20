// GLOBAL SINGLETON: Ensures only ONE WebSocket connection to OpenAI exists
// This prevents multiple connections when React StrictMode causes multiple mounts
// Using window object to persist across module reloads

declare global {
  interface Window {
    __linguaflow_ws?: WebSocket;
    __linguaflow_conv_id?: string;
    __linguaflow_greeting_sent?: Set<string>;  // Track which conversations have received greetings
  }
}

export function getGlobalWebSocket(): WebSocket | null {
  return window.__linguaflow_ws || null;
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

export function hasGreetingBeenSent(conversationId: string): boolean {
  if (!window.__linguaflow_greeting_sent) {
    window.__linguaflow_greeting_sent = new Set();
  }
  return window.__linguaflow_greeting_sent.has(conversationId);
}

export function markGreetingAsSent(conversationId: string): void {
  if (!window.__linguaflow_greeting_sent) {
    window.__linguaflow_greeting_sent = new Set();
  }
  window.__linguaflow_greeting_sent.add(conversationId);
  console.log('[REALTIME MANAGER] Greeting marked as sent for conversation:', conversationId);
}
