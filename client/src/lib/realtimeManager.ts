// GLOBAL SINGLETON: Ensures only ONE WebSocket connection to OpenAI exists
// This prevents multiple connections when React StrictMode causes multiple mounts
let globalWebSocket: WebSocket | null = null;
let globalConversationId: string | null = null;

export function getGlobalWebSocket(): WebSocket | null {
  return globalWebSocket;
}

export function setGlobalWebSocket(ws: WebSocket | null, conversationId: string | null): void {
  // Close existing WebSocket if it exists and is different
  if (globalWebSocket && globalWebSocket !== ws) {
    console.log('[REALTIME MANAGER] Closing existing global WebSocket');
    try {
      globalWebSocket.close();
    } catch (e) {
      console.error('[REALTIME MANAGER] Error closing WebSocket:', e);
    }
  }
  
  globalWebSocket = ws;
  globalConversationId = conversationId;
  
  if (ws) {
    console.log('[REALTIME MANAGER] ✓ Global WebSocket set for conversation:', conversationId);
  } else {
    console.log('[REALTIME MANAGER] Global WebSocket cleared');
  }
}

export function getGlobalConversationId(): string | null {
  return globalConversationId;
}

export function clearGlobalWebSocket(): void {
  if (globalWebSocket) {
    console.log('[REALTIME MANAGER] Clearing global WebSocket');
    try {
      globalWebSocket.close();
    } catch (e) {
      console.error('[REALTIME MANAGER] Error closing WebSocket:', e);
    }
  }
  globalWebSocket = null;
  globalConversationId = null;
}
