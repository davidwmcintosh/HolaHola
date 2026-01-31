import { WebSocketServer, WebSocket as WS } from 'ws';
import { Server } from 'http';
import type { IncomingMessage } from 'http';
import { storage } from './storage';
import { createSystemPrompt } from './system-prompt';
import { parse as parseCookie } from 'cookie';
import signature from 'cookie-signature';

// Helper function to get userId from authenticated session
async function getUserIdFromSession(req: IncomingMessage): Promise<string | null> {
  try {
    // Parse cookies from the upgrade request
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
      console.log('[AUTH] No cookies in upgrade request');
      return null;
    }

    const cookies = parseCookie(cookieHeader);
    const sessionCookieName = 'connect.sid'; // Default express-session cookie name
    let sessionId = cookies[sessionCookieName];
    
    if (!sessionId) {
      console.log('[AUTH] No session cookie found');
      return null;
    }

    // Remove 's:' prefix if present (express-session signed cookie format)
    if (sessionId.startsWith('s:')) {
      sessionId = sessionId.slice(2);
      // Unsign the cookie using SESSION_SECRET
      const unsigned = signature.unsign(sessionId, process.env.SESSION_SECRET!);
      if (unsigned === false) {
        console.log('[AUTH] Invalid session signature');
        return null;
      }
      sessionId = unsigned;
    }

    // Query the sessions table to get the session data
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.NEON_DATABASE_URL || process.env.DATABASE_URL!);
    
    const sessions = await sql`
      SELECT sess FROM sessions WHERE sid = ${sessionId}
    `;
    
    if (!sessions || sessions.length === 0) {
      console.log('[AUTH] No session found in database');
      return null;
    }

    const sessionData = sessions[0].sess as any;
    
    // Extract userId from passport session
    const userId = sessionData?.passport?.user?.claims?.sub;
    
    if (!userId) {
      console.log('[AUTH] No user ID in session data');
      return null;
    }

    console.log('[AUTH] ✓ Successfully authenticated WebSocket connection');
    return userId;
  } catch (error) {
    console.error('[AUTH] Error extracting userId from session:', error);
    return null;
  }
}

export function setupRealtimeProxy(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/api/realtime/ws'
  });

  wss.on('connection', async (clientWs: WS, req) => {
    console.log('Client connected to Realtime proxy');

    try {
      // SECURITY: Extract userId from authenticated session (server-side)
      // This prevents spoofing and ensures voice mode has same auth as text mode
      const userId = await getUserIdFromSession(req);
      
      if (!userId) {
        console.error('[AUTH] Unauthorized WebSocket connection - no valid session');
        clientWs.close(4401, 'Unauthorized: Authentication required');
        return;
      }

      // Extract session info from query params
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const language = url.searchParams.get('language') || 'spanish';
      const difficulty = url.searchParams.get('difficulty') || 'beginner';
      const conversationId = url.searchParams.get('conversationId');
      // VAD mode: 'push-to-talk', 'server_vad', or 'semantic_vad'
      const vadMode = url.searchParams.get('vadMode') || 'semantic_vad';

      // Fetch user to determine subscription tier for model selection
      let subscriptionTier = 'free';
      try {
        const user = await storage.getUser(userId);
        if (user) {
          subscriptionTier = user.subscriptionTier || 'free';
        }
      } catch (error) {
        console.error('Failed to fetch user for tier selection:', error);
      }

      // Fetch conversation to get message count, topic, and nativeLanguage for phase-appropriate prompts
      let messageCount = 0;
      let topic: string | null = null;
      let nativeLanguage = 'english';
      let conversationLanguage = language; // Use query param as fallback
      let userName: string | null = null;
      let actflLevel: string | null = null; // ACTFL proficiency level
      let previousConversations: Array<{ id: string; title: string | null; messageCount: number; createdAt: string }> = [];
      
      // Fetch conversation metadata (topic, nativeLanguage, userName, actflLevel)
      if (conversationId) {
        try {
          const conversation = await storage.getConversation(conversationId, userId);
          if (conversation) {
            topic = conversation.topic ?? null;
            nativeLanguage = conversation.nativeLanguage || 'english';
            conversationLanguage = conversation.language || conversationLanguage; // Use actual conversation language with fallback
            userName = conversation.userName || null;
            actflLevel = conversation.actflLevel ?? null; // Get ACTFL level from conversation
          }
        } catch (error) {
          console.error('Failed to fetch conversation metadata:', error);
        }
        
        // Fetch messages for message count (separate try/catch)
        try {
          const messages = await storage.getMessagesByConversation(conversationId);
          // Count only user messages to determine conversation phase
          messageCount = messages.filter((m: any) => m.role === 'user').length;
        } catch (error) {
          console.error('Failed to fetch messages for conversation:', error);
        }
      }
      
      // Fallback: fetch user profile for userName if not available from conversation
      // This matches text mode behavior and ensures history filtering works correctly
      if (!userName) {
        try {
          const user = await storage.getUser(userId);
          userName = user?.firstName || null;
        } catch (error) {
          console.error('Failed to fetch user profile for userName fallback:', error);
        }
      }
      
      // Fetch previous conversations for conversation history/resumption (unified with text mode)
      // CRITICAL: Separate try/catch so history fetch never fails due to conversation lookup errors
      // This matches text mode behavior and ensures history is always available when userId exists
      // userId is guaranteed to exist here because we validated it at the start
      if (conversationLanguage) {
        try {
          const allUserConversations = await storage.getConversationsByLanguage(conversationLanguage, userId);
          previousConversations = allUserConversations
            .filter(c => 
              c.id !== conversationId && 
              !c.isOnboarding && 
              (userName === null || c.userName === userName) && // Only filter by userName if we have one
              c.messageCount && c.messageCount > 1
            )
            .slice(0, 5) // Limit to 5 most recent
            .map(c => ({
              id: c.id,
              title: c.title,
              messageCount: c.messageCount!, // Safe because we filter for messageCount > 1
              createdAt: c.createdAt.toISOString()
            }));
        } catch (error) {
          console.error('Failed to fetch previous conversations:', error);
          // Keep previousConversations as empty array on error
        }
      }

      // Use correct OpenAI Realtime API model based on tier
      const model = subscriptionTier === 'pro' 
        ? 'gpt-4o-realtime-preview-2024-12-17'
        : 'gpt-4o-mini-realtime-preview-2024-12-17';
      
      console.log(`Using Realtime model: ${model} for tier: ${subscriptionTier}`);

      // Connect directly to OpenAI Realtime API with API key
      const apiKey = process.env.USER_OPENAI_API_KEY;
      const wsUrl = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;
      
      console.log('[DIRECT CONNECTION] Connecting to OpenAI Realtime API...');
      const openaiWs = new WS(wsUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
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
        console.log('[REALTIME PROXY] Configuring session...');
        
        // Configure turn detection based on VAD mode
        let turnDetection: any;
        
        if (vadMode === 'semantic_vad') {
          turnDetection = {
            type: 'semantic_vad',
            eagerness: 'low',
            create_response: true,
            interrupt_response: true
          };
        } else if (vadMode === 'server_vad') {
          turnDetection = {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
            create_response: true
          };
        }
        
        // Create TRIMMED system instructions (keep under 8k chars to avoid server_error)
        let systemPrompt = createSystemPrompt(
          conversationLanguage,
          difficulty,
          messageCount,
          true, // isVoiceMode
          topic,
          previousConversations,
          nativeLanguage,
          undefined, // No due vocabulary (Realtime API has strict size limits)
          undefined, // No session vocabulary (Realtime API has strict size limits)
          actflLevel // ACTFL proficiency level
        );
        
        // CRITICAL FIX: Trim instructions to avoid server_error
        // Testing with very conservative limit (4000 chars) for mini model
        const MAX_INSTRUCTION_LENGTH = 4000;
        if (systemPrompt.length > MAX_INSTRUCTION_LENGTH) {
          console.log(`[TRIM] Instructions too long (${systemPrompt.length} chars), trimming to ${MAX_INSTRUCTION_LENGTH}...`);
          systemPrompt = systemPrompt.substring(0, MAX_INSTRUCTION_LENGTH) + '\n\n[Instructions trimmed for performance]';
        }
        
        // Configure session
        const sessionConfig: any = {
          modalities: ['text', 'audio'],
          voice: 'alloy',
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          instructions: systemPrompt,
          input_audio_transcription: {
            model: 'whisper-1'
          }
        };
        
        // Only include turn_detection if using VAD mode
        if (turnDetection) {
          sessionConfig.turn_detection = turnDetection;
        }
        
        console.log('[SESSION CONFIG] Instructions length:', systemPrompt.length, 'chars');
        console.log('[SESSION CONFIG] Turn detection:', turnDetection ? turnDetection.type : 'push-to-talk');
        
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
