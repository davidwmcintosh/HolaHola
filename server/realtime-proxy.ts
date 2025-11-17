import { WebSocketServer, WebSocket as WS } from 'ws';
import { Server } from 'http';

export function setupRealtimeProxy(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/api/realtime/ws'
  });

  wss.on('connection', async (clientWs: WS, req) => {
    console.log('Client connected to Realtime proxy');

    try {
      // Extract session info from query params
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const language = url.searchParams.get('language') || 'spanish';
      const difficulty = url.searchParams.get('difficulty') || 'beginner';

      // Connect to OpenAI Realtime API using user's API key
      // USER_OPENAI_API_KEY is the user's personal OpenAI key with Realtime API access
      const apiKey = process.env.USER_OPENAI_API_KEY;
      const wsUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';
      
      const openaiWs = new WS(wsUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      });

      // Forward messages from client to OpenAI
      clientWs.on('message', (data) => {
        if (openaiWs.readyState === WS.OPEN) {
          openaiWs.send(data);
        }
      });

      // Forward messages from OpenAI to client
      openaiWs.on('message', (data) => {
        // Log messages to help debug issues
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.type === 'error') {
            console.error('OpenAI Realtime API error:', parsed);
          } else {
            console.log('OpenAI message type:', parsed.type);
          }
        } catch (e) {
          // Binary data, ignore
        }
        
        if (clientWs.readyState === WS.OPEN) {
          clientWs.send(data);
        }
      });

      // Handle OpenAI connection open
      openaiWs.on('open', () => {
        console.log('Connected to OpenAI Realtime API');
        
        // Minimal session configuration - text+audio is required by the API
        openaiWs.send(JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            voice: "alloy",
          },
        }));
      });

      // Handle errors
      openaiWs.on('error', (error) => {
        console.error('OpenAI WebSocket error:', error);
        if (clientWs.readyState === WS.OPEN) {
          clientWs.send(JSON.stringify({
            type: 'error',
            error: { message: 'Connection error' }
          }));
        }
      });

      openaiWs.on('close', (code, reason) => {
        console.log('OpenAI connection closed', { code, reason: reason.toString() });
        clientWs.close();
      });

      clientWs.on('close', () => {
        console.log('Client disconnected');
        openaiWs.close();
      });

      clientWs.on('error', (error) => {
        console.error('Client WebSocket error:', error);
        openaiWs.close();
      });

    } catch (error) {
      console.error('Error setting up Realtime proxy:', error);
      clientWs.close();
    }
  });

  return wss;
}
