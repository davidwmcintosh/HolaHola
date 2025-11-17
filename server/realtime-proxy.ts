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

      // Connect to OpenAI Realtime API
      const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
      const wsUrl = baseUrl.replace('https://', 'wss://').replace('http://', 'ws://') + '/realtime?model=gpt-4o-realtime-preview-2024-12-17';
      
      const openaiWs = new WS(wsUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
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
        if (clientWs.readyState === WS.OPEN) {
          clientWs.send(data);
        }
      });

      // Handle OpenAI connection open
      openaiWs.on('open', () => {
        console.log('Connected to OpenAI Realtime API');
        
        // Send initial session configuration using GA API format
        openaiWs.send(JSON.stringify({
          type: "session.update",
          session: {
            type: "realtime",
            model: "gpt-4o-realtime-preview-2024-12-17",
            modalities: ["text", "audio"],
            instructions: `You are a patient, friendly ${language} language tutor helping a ${difficulty} level student. Speak clearly in ${language}. Provide corrections gently and encourage the student.`,
            audio: {
              input: { format: "pcm16" },
              output: { 
                voice: "alloy",
                format: "pcm16"
              }
            },
            input_audio_transcription: {
              model: "whisper-1"
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
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

      openaiWs.on('close', () => {
        console.log('OpenAI connection closed');
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
