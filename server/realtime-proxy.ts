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
      const userId = url.searchParams.get('userId');

      // Fetch user to determine subscription tier for model selection
      let subscriptionTier = 'free';
      if (userId) {
        try {
          const user = await storage.getUser(userId);
          if (user) {
            subscriptionTier = user.subscriptionTier || 'free';
          }
        } catch (error) {
          console.error('Failed to fetch user for tier selection:', error);
        }
      }

      // Fetch conversation to get message count, topic, and nativeLanguage for phase-appropriate prompts
      let messageCount = 0;
      let topic: string | null = null;
      let nativeLanguage = 'english';
      if (conversationId && userId) {
        try {
          const conversation = await storage.getConversation(conversationId, userId);
          if (conversation) {
            topic = conversation.topic ?? null;
            nativeLanguage = conversation.nativeLanguage || 'english';
          }
          const messages = await storage.getMessagesByConversation(conversationId);
          // Count only user messages to determine conversation phase
          messageCount = messages.filter((m: any) => m.role === 'user').length;
        } catch (error) {
          console.error('Failed to fetch messages for conversation:', error);
        }
      }

      // Select model based on subscription tier
      // Pro tier gets premium GA model (Aug 2025), Free/Basic/Institutional get latest preview
      const model = subscriptionTier === 'pro' 
        ? 'gpt-4o-realtime-preview-2024-12-17'  // Latest GPT-4o Realtime (Dec 2024)
        : 'gpt-4o-realtime-preview-2024-12-17';  // Latest GPT-4o Realtime (Dec 2024) - most stable

      console.log(`Using model: ${model} for tier: ${subscriptionTier}`);

      // Connect to OpenAI Realtime API using user's API key
      // USER_OPENAI_API_KEY is the user's personal OpenAI key with Realtime API access
      const apiKey = process.env.USER_OPENAI_API_KEY;
      const wsUrl = `wss://api.openai.com/v1/realtime?model=${model}`;
      
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
            
            // Send error message to client
            if (clientWs.readyState === WS.OPEN) {
              const errorMessage = parsed.error?.message || 'Unknown error';
              const errorType = parsed.error?.type || '';
              
              // Check if it's ACTUALLY an auth/access issue (not just any server error)
              const isAuthError = 
                errorType === 'invalid_request_error' && 
                (errorMessage.toLowerCase().includes('unauthorized') || 
                 errorMessage.toLowerCase().includes('authentication') ||
                 errorMessage.toLowerCase().includes('access denied'));
              
              if (isAuthError) {
                // Real auth/access issue
                clientWs.send(JSON.stringify({
                  type: 'error',
                  error: {
                    message: 'Voice chat is unavailable. Your API key does not have Realtime API access. Please verify your OpenAI account tier and billing at platform.openai.com.',
                    code: 'realtime_api_access_denied'
                  }
                }));
              } else if (errorType === 'server_error') {
                // Temporary OpenAI server issue - pass through with helpful context
                clientWs.send(JSON.stringify({
                  type: 'error',
                  error: {
                    message: `OpenAI's servers are experiencing temporary issues. Please try again in a moment. (${errorMessage})`,
                    code: 'openai_server_error',
                    originalMessage: errorMessage
                  }
                }));
              } else {
                // Other errors - pass through as-is
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
          english: "English", spanish: "Spanish", french: "French", german: "German", 
          italian: "Italian", portuguese: "Portuguese", japanese: "Japanese",
          mandarin: "Mandarin Chinese", korean: "Korean"
        };
        const nativeLanguageNames: Record<string, string> = {
          english: "English", spanish: "Spanish", french: "French", german: "German",
          italian: "Italian", portuguese: "Portuguese", japanese: "Japanese",
          mandarin: "Mandarin Chinese", korean: "Korean", arabic: "Arabic",
          russian: "Russian", hindi: "Hindi"
        };
        const languageName = languageNames[language] || language;
        const nativeLanguageName = nativeLanguageNames[nativeLanguage] || nativeLanguage;
        
        // Simplified instructions for Realtime API
        const systemInstructions = `You are a friendly ${languageName} language tutor conducting a voice conversation. The student's native language is ${nativeLanguageName}.

Difficulty: ${difficulty}
${topic ? `Topic focus: ${topic}` : ''}

Guidelines:
- Speak naturally and conversationally
- Adjust language complexity to ${difficulty} level
- ${difficulty === 'beginner' ? 'Use mostly ' + nativeLanguageName + ' (80%) with simple ' + languageName + ' words. Speak slowly and clearly.' : difficulty === 'intermediate' ? 'Use 50/50 mix of ' + nativeLanguageName + ' and ' + languageName + '. Build on basics.' : 'Use mostly ' + languageName + ' (80-90%). Challenge the student.'}
- ALL explanations and translations must be in ${nativeLanguageName}
- Ask one question at a time
- Encourage and praise efforts
- Keep responses brief and focused
${difficulty === 'beginner' ? '- For new words, provide phonetic pronunciation and ' + nativeLanguageName + ' translation' : ''}

Be warm, patient, and encouraging. Help them learn naturally through conversation.`;
        
        console.log('System instructions length:', systemInstructions.length, 'characters');
        
        // Session configuration with instructions for the AI tutor
        // Note: Only send supported fields (voice, instructions, turn_detection)
        // Modalities and transcription cannot be set via session.update
        const sessionUpdate = {
          type: "session.update",
          session: {
            voice: "alloy",
            instructions: systemInstructions,
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500
            }
          },
        };
        openaiWs.send(JSON.stringify(sessionUpdate));
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
