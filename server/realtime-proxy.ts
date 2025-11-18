import { WebSocketServer, WebSocket as WS } from 'ws';
import { Server } from 'http';
import { storage } from './storage';
import { createSystemPrompt } from './system-prompt';

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
      const conversationId = url.searchParams.get('conversationId');

      // Fetch conversation to get message count and topic for phase-appropriate prompts
      let messageCount = 0;
      let topic: string | null = null;
      if (conversationId) {
        try {
          const conversation = await storage.getConversation(conversationId);
          if (conversation) {
            topic = conversation.topic ?? null;
          }
          const messages = await storage.getMessagesByConversation(conversationId);
          // Count only user messages to determine conversation phase
          messageCount = messages.filter((m: any) => m.role === 'user').length;
        } catch (error) {
          console.error('Failed to fetch messages for conversation:', error);
        }
      }

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
            
            // Send user-friendly error message to client
            if (clientWs.readyState === WS.OPEN) {
              const errorMessage = parsed.error?.message || 'Unknown error';
              
              // Check if it's an auth/access issue
              if (errorMessage.includes('server had an error') || errorMessage.includes('server_error')) {
                clientWs.send(JSON.stringify({
                  type: 'error',
                  error: {
                    message: 'Voice chat is unavailable. Your OpenAI API key may not have access to the Realtime API, or there may be a billing issue. Please check your OpenAI account at platform.openai.com.',
                    code: 'realtime_api_access_denied'
                  }
                }));
              } else {
                clientWs.send(JSON.stringify(parsed));
              }
            }
            return;
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
        
        // Create simplified system prompt for voice mode
        // Realtime API has stricter length limits than Chat API
        const languageNames: Record<string, string> = {
          spanish: "Spanish", french: "French", german: "German", 
          italian: "Italian", portuguese: "Portuguese", japanese: "Japanese",
          mandarin: "Mandarin Chinese", korean: "Korean"
        };
        const languageName = languageNames[language] || language;
        
        // Simplified instructions for Realtime API
        const systemInstructions = `You are a friendly ${languageName} language tutor conducting a voice conversation.

Difficulty: ${difficulty}
${topic ? `Topic focus: ${topic}` : ''}

Guidelines:
- Speak naturally and conversationally
- Adjust language complexity to ${difficulty} level
- ${difficulty === 'beginner' ? 'Use mostly English (80%) with simple ' + languageName + ' words. Speak slowly and clearly.' : difficulty === 'intermediate' ? 'Use 50/50 mix of English and ' + languageName + '. Build on basics.' : 'Use mostly ' + languageName + ' (80-90%). Challenge the student.'}
- Ask one question at a time
- Encourage and praise efforts
- Keep responses brief and focused
${difficulty === 'beginner' ? '- For new words, provide phonetic pronunciation (e.g., "Hola = oh-LAH")' : ''}

Be warm, patient, and encouraging. Help them learn naturally through conversation.`;
        
        console.log('System instructions length:', systemInstructions.length, 'characters');
        
        // Session configuration with instructions for the AI tutor
        openaiWs.send(JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            voice: "alloy",
            instructions: systemInstructions,
            input_audio_transcription: {
              model: "whisper-1"
            }
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
