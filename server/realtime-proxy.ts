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
      // VAD mode: 'push-to-talk', 'server_vad', or 'semantic_vad'
      const vadMode = url.searchParams.get('vadMode') || 'semantic_vad';

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

      // Use latest stable preview model (Dec 2024 release)
      const model = 'gpt-4o-realtime-preview-2024-12-17';

      console.log(`Using model: ${model} for tier: ${subscriptionTier}`);

      // CRITICAL FIX: Create ephemeral session FIRST using REST API
      // The playground uses this approach - not direct WebSocket!
      console.log('Creating ephemeral Realtime session via REST...');
      const apiKey = process.env.USER_OPENAI_API_KEY;
      
      const sessionResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          voice: 'alloy'
        })
      });

      if (!sessionResponse.ok) {
        const errorText = await sessionResponse.text();
        console.error('Failed to create Realtime session:', sessionResponse.status, errorText);
        clientWs.send(JSON.stringify({
          type: 'error',
          error: { message: `Failed to create session: ${errorText}` }
        }));
        clientWs.close();
        return;
      }

      const sessionData = await sessionResponse.json();
      const ephemeralToken = sessionData.client_secret.value;
      console.log('✓ Ephemeral session created successfully');

      // Now connect to WebSocket using ephemeral token
      const wsUrl = `wss://api.openai.com/v1/realtime?model=${model}`;
      
      const openaiWs = new WS(wsUrl, {
        headers: {
          'Authorization': `Bearer ${ephemeralToken}`,
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
        
        // Generate unified system prompt using shared createSystemPrompt function
        // This ensures voice and text chat use identical learning constraints
        const systemPrompt = createSystemPrompt(
          language,
          difficulty,
          messageCount,
          true, // isVoiceMode = true
          topic,
          undefined, // previousConversations (not needed for voice)
          nativeLanguage,
          undefined, // dueVocabulary (not needed for realtime)
          undefined  // sessionVocabulary (not needed for realtime)
        );
        
        console.log('[REALTIME PROXY] Sending unified system prompt to OpenAI');
        console.log(`[REALTIME PROXY] VAD mode: ${vadMode}`);
        
        // Configure turn detection based on VAD mode
        let turnDetection: any;
        
        if (vadMode === 'semantic_vad') {
          // Semantic VAD - best for language learners
          // Uses AI to understand when user is done speaking
          // Low eagerness gives learners time to think/pause
          turnDetection = {
            type: 'semantic_vad',
            eagerness: 'low',  // Patient - won't interrupt while thinking
            create_response: true,
            interrupt_response: true  // Let user interrupt AI
          };
        } else if (vadMode === 'server_vad') {
          // Server VAD - simple silence-based detection
          turnDetection = {
            type: 'server_vad',
            threshold: 0.5,              // Medium sensitivity
            prefix_padding_ms: 300,      // Capture 300ms before speech
            silence_duration_ms: 500,    // Wait 500ms of silence (longer for learners)
            create_response: true
          };
        } else {
          // Push-to-talk mode - disable automatic turn detection
          turnDetection = null;
        }
        
        // Configure session with voice settings and unified instructions
        const sessionConfig: any = {
          voice: 'alloy',
          instructions: systemPrompt,
          input_audio_transcription: {
            model: 'whisper-1'
          }
        };
        
        // Only add turn_detection if not in push-to-talk mode
        if (turnDetection) {
          sessionConfig.turn_detection = turnDetection;
        }
        
        openaiWs.send(JSON.stringify({
          type: 'session.update',
          session: sessionConfig
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
