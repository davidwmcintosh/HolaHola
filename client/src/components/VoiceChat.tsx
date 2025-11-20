import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mic, MicOff, Bot, User, Loader2, Volume2, MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Message, Conversation } from "@shared/schema";
import { AudioRecorder, AudioPlayer, pcm16ToBase64 } from "@/lib/audioUtils";
import { Badge } from "@/components/ui/badge";
import { InstructorAvatar, type AvatarState } from "@/components/InstructorAvatar";
import { CompactDifficultyControl } from "@/components/CompactDifficultyControl";
import { LanguageSelector } from "@/components/LanguageSelector";
import { getGlobalWebSocket, setGlobalWebSocket, getGlobalConversationId, hasGreetingBeenSent, markGreetingAsSent, isGloballyConnecting, setGloballyConnecting } from "@/lib/realtimeManager";

interface RealtimeEvent {
  type: string;
  [key: string]: any;
}

interface PronunciationScoreData {
  messageId: string;
  score: number;
  feedback: string;
  phoneticIssues: string[];
  strengths: string[];
}

interface VoiceChatProps {
  conversationId: string | null;
  setConversationId: (id: string | null) => void;
  setCurrentConversationOnboarding: (isOnboarding: boolean | null) => void;
}

export function VoiceChat({ conversationId, setConversationId, setCurrentConversationOnboarding }: VoiceChatProps) {
  const { language, difficulty, userName } = useLanguage();
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<Array<{ role: string; content: string; messageId?: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [capabilityChecked, setCapabilityChecked] = useState(false);
  const [capabilityAvailable, setCapabilityAvailable] = useState(false);
  const [capabilityCode, setCapabilityCode] = useState<string | null>(null);
  const [isCheckingCapability, setIsCheckingCapability] = useState(false);
  const [pronunciationScores, setPronunciationScores] = useState<Map<string, PronunciationScoreData>>(new Map());
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isReconnectingRef = useRef<boolean>(false);
  
  // Track processed response IDs to prevent duplicate message saves
  const processedResponseIds = useRef<Set<string>>(new Set());
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speechDetectedRef = useRef<boolean>(false);
  
  // Track start/stop tokens to handle race conditions
  // - startTokenRef: Global counter, incremented for each new start attempt
  // - currentRecordingTokenRef: Which token is currently recording (set when isRecording becomes true)
  // - stoppedTokenRef: Which token was stopped (set when stopRecording is called)
  // A start only proceeds if its token > stoppedTokenRef
  const startTokenRef = useRef<number>(0);
  const currentRecordingTokenRef = useRef<number>(-1);
  const stoppedTokenRef = useRef<number>(-1);

  // Check Realtime API capability
  const checkCapability = useCallback(async (forceRecheck = false) => {
    setIsCheckingCapability(true);
    try {
      // Add force parameter to bypass cache when user clicks "Recheck Access"
      const url = forceRecheck ? '/api/realtime/capability?force=true' : '/api/realtime/capability';
      const response = await fetch(url);
      const data = await response.json();
      setCapabilityAvailable(data.available);
      setCapabilityCode(data.code || null);
      setCapabilityChecked(true);
      
      if (!data.available) {
        setError(data.reason || 'Voice chat unavailable');
      } else {
        setError(null);
      }
    } catch (error) {
      console.error('Failed to check capability:', error);
      setCapabilityChecked(true);
      setCapabilityAvailable(false);
      setCapabilityCode('network_error');
      setError('Failed to check voice chat availability. Please check your internet connection.');
    } finally {
      setIsCheckingCapability(false);
    }
  }, []);

  useEffect(() => {
    checkCapability();
  }, [checkCapability]);

  // Force fresh capability check when conversation changes (e.g., NEW CHAT button)
  useEffect(() => {
    if (conversationId) {
      console.log('[VOICE CHAT] Conversation changed, forcing fresh capability check...');
      checkCapability(true); // Force bypass cache
    }
  }, [conversationId, checkCapability]);

  // Fetch existing messages
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/conversations", conversationId, "messages"],
    enabled: !!conversationId,
  });

  // Initialize audio player
  useEffect(() => {
    audioPlayerRef.current = new AudioPlayer();
    return () => {
      audioPlayerRef.current?.stop();
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcript, messages]);

  const connectToRealtimeAPI = useCallback(async (): Promise<void> => {
    if (!conversationId) {
      throw new Error('No conversation ID');
    }

    // CRITICAL: Set connection lock to prevent duplicate WebSocket creation
    setGloballyConnecting(true);

    const CONNECTION_TIMEOUT = 10000; // 10 seconds
    let connectionTimer: NodeJS.Timeout | null = null;

    try {
      // CRITICAL FIX: Get ephemeral token from server, then connect DIRECTLY to OpenAI
      // This bypasses Replit's server-side WebSocket blocking!
      console.log('[VOICE CHAT] Fetching ephemeral token for direct OpenAI connection...');
      
      const tokenResponse = await apiRequest("POST", "/api/realtime/token", {});
      const { token, model } = await tokenResponse.json();
      
      console.log(`[VOICE CHAT] ✓ Token received, connecting directly to OpenAI with model: ${model}`);
      
      // Connect DIRECTLY to OpenAI WebSocket (just like the playground!)
      // Ephemeral token must be passed in subprotocols, not headers!
      const wsUrl = `wss://api.openai.com/v1/realtime?model=${model}`;
      const ws = new WebSocket(wsUrl, [
        "realtime",
        `openai-insecure-api-key.${token}`,
        "openai-beta.realtime-v1"
      ]);
      
      let connectionOpened = false;

      return new Promise((resolve, reject) => {
        // Set connection timeout
        connectionTimer = setTimeout(() => {
          if (!connectionOpened) {
            ws.close();
            reject(new Error('Connection timeout'));
          }
        }, CONNECTION_TIMEOUT);

        ws.onopen = () => {
          console.log('[VOICE CHAT] ✓ Connected directly to OpenAI Realtime API!');
          connectionOpened = true;
          if (connectionTimer) clearTimeout(connectionTimer);
          
          // CRITICAL: Clear connection lock now that we've successfully connected
          setGloballyConnecting(false);
          
          // Clear error and reset reconnecting flag on successful connection
          if (isReconnectingRef.current) {
            setError(null);
            isReconnectingRef.current = false;
          }
          
          // Reset retry count on successful connection
          setRetryCount(0);
          setIsRetrying(false);
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = null;
          }
          
          // Configure session with adaptive instructions based on difficulty
          const adaptiveInstructions = difficulty === 'beginner'
            ? `You are a ${language} language tutor for ${userName || 'the student'}. Their native language is english and they are a BEGINNER.

CRITICAL INSTRUCTION FOR BEGINNERS:
- Use mostly English (70-80%) with simple ${language} phrases mixed in
- Introduce ${language} gradually - start with greetings, common words, and simple phrases
- Always translate ${language} words to English immediately after using them
- Keep sentences short and simple
- Example: "¡Hola! (Hello!) How are you today? That's 'Cómo estás' in ${language}."

Be warm, encouraging, and patient. Keep responses concise (2-3 sentences max).`
            : difficulty === 'intermediate'
            ? `You are a ${language} language tutor for ${userName || 'the student'}. Their native language is english and they are INTERMEDIATE level.

Use a 50/50 mix of ${language} and English. Speak ${language} for main ideas, use English for explanations and corrections. Keep responses conversational and concise.`
            : `You are a ${language} language tutor for ${userName || 'the student'}. Their native language is english and they are ADVANCED.

Use mostly ${language} (80-90%) with occasional English explanations for complex grammar. Challenge them with natural, conversational ${language}. Keep responses concise.`;

          // PUSH-TO-TALK MODE: Use server_vad with high threshold to minimize false triggers
          // Response is manually triggered via response.create when button is released (line 690)
          console.log('[🔧 CODE VERSION: 2024-11-20-03:00] Push-to-talk, silence 1s (not 2s)');

          ws.send(JSON.stringify({
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              instructions: adaptiveInstructions,
              voice: 'alloy',
              input_audio_format: 'pcm16',
              output_audio_format: 'pcm16',
              input_audio_transcription: {
                model: 'whisper-1'
              },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.9,  // Very high threshold to avoid automatic responses
                prefix_padding_ms: 300,
                silence_duration_ms: 1000  // 1 second of silence before auto-response (we trigger manually first)
              }
            }
          }));
          
          // After configuring session, send initial greeting if conversation is empty
          // Strategy: Check database first, then mark as sent to prevent duplicates
          if (!conversationId) {
            resolve();
            return;
          }
          
          setTimeout(async () => {
            // FIRST: Check if we've already processed this conversation's greeting
            if (hasGreetingBeenSent(conversationId)) {
              console.log('[VOICE CHAT] Greeting already sent for conversation:', conversationId);
              return;
            }
            
            try {
              // SECOND: Check database for existing messages
              const messagesResponse = await fetch(`/api/conversations/${conversationId}/messages`);
              const existingMessages = await messagesResponse.json();
              
              // THIRD: Mark as sent BEFORE sending to prevent race conditions
              // (Multiple WebSocket connections might both reach this point, but only first one marks it)
              markGreetingAsSent(conversationId);
              console.log('[VOICE CHAT] Marked greeting as sent');
              
              if (existingMessages.length === 0) {
                console.log('[VOICE CHAT] Empty conversation - sending initial greeting request');
                
                // Use conversation.item.create to trigger AI greeting
                ws.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'message',
                    role: 'user',
                    content: [{
                      type: 'input_text',
                      text: `Hi! I'm ${userName || 'ready to learn'}. Please greet me briefly and ask what I'd like to learn today.`
                    }]
                  }
                }));
                
                // Trigger response
                ws.send(JSON.stringify({ type: 'response.create' }));
              } else {
                console.log('[VOICE CHAT] Conversation already has', existingMessages.length, 'messages, skipping greeting');
              }
            } catch (error) {
              console.error('[VOICE CHAT] Failed to check messages for greeting:', error);
            }
          }, 500);
          
          resolve();
        };

      ws.onmessage = async (event) => {
        // OpenAI Realtime API sends both text (JSON) and binary (audio) messages
        // Only parse text messages as JSON, skip binary messages
        if (event.data instanceof Blob) {
          // Binary audio data - ignore it (we receive audio via delta events)
          return;
        }
        
        const data: RealtimeEvent = JSON.parse(event.data);
        
        // Debug: Log ALL events to help troubleshoot
        console.log('[REALTIME EVENT]', data.type, data);
        
        switch (data.type) {
          case "session.created":
            console.log('Session created:', data);
            break;
            
          case "input_audio_buffer.speech_started":
            console.log('Speech started');
            speechDetectedRef.current = true;
            break;
            
          case "input_audio_buffer.speech_stopped":
            console.log('Speech stopped');
            // VAD automatically commits when speech stops, no manual action needed
            break;
            
          case "conversation.item.input_audio_transcription.completed":
            const userTranscript = data.transcript;
            const itemId = data.item_id;
            
            // CRITICAL FIX: Don't save empty transcripts (prevents duplicates)
            if (!userTranscript || userTranscript.trim() === "") {
              console.log('[VOICE CHAT] Skipping empty user transcript');
              break;
            }
            
            // DEDUPLICATION: Check if we've already processed this item_id
            if (processedResponseIds.current.has(itemId)) {
              console.log('[VOICE CHAT] Skipping duplicate item_id:', itemId);
              break;
            }
            
            // Mark this item_id as processed
            processedResponseIds.current.add(itemId);
            console.log('[VOICE CHAT] Saving user message for item_id:', itemId);
            
            // Save to backend
            const messageResponse = await apiRequest("POST", `/api/conversations/${conversationId}/messages`, {
              role: "user",
              content: userTranscript,
            });
            const savedMessage = await messageResponse.json();
            
            // Invalidate messages query to refetch and display the saved message
            await queryClient.invalidateQueries({ queryKey: ['/api/conversations', conversationId, 'messages'] });

            // Analyze pronunciation after saving the message
            try {
              const analysisResponse = await apiRequest("POST", "/api/pronunciation-scores/analyze", {
                messageId: savedMessage.id,
                conversationId,
                transcribedText: userTranscript,
              });
              const analysisResult = await analysisResponse.json();

              // Update pronunciation scores state
              setPronunciationScores(prev => new Map(prev).set(savedMessage.id, {
                messageId: savedMessage.id,
                score: analysisResult.score,
                feedback: analysisResult.feedback,
                phoneticIssues: analysisResult.phoneticIssues || [],
                strengths: analysisResult.strengths || [],
              }));
            } catch (error) {
              console.error("Failed to analyze pronunciation:", error);
              // Don't block the conversation if pronunciation analysis fails
            }
            break;
            
          case "response.created":
            // Mark AI as speaking as soon as response is created
            // This prevents user from interrupting before audio starts
            console.log('[VOICE CHAT] AI response created - blocking new recordings');
            setIsAiSpeaking(true);
            break;
            
          case "response.audio.delta":
            if (data.delta && audioPlayerRef.current) {
              console.log('[AUDIO] Playing audio chunk, size:', data.delta.length);
              audioPlayerRef.current.playAudio(data.delta);
              setIsAiSpeaking(true);
            }
            break;
            
          case "response.audio_transcript.delta":
            // Build up assistant transcript (streamed)
            break;
            
          case "response.audio_transcript.done":
            const assistantTranscript = data.transcript;
            const responseId = data.response_id;
            
            // CRITICAL FIX: Don't save empty transcripts (prevents duplicates)
            if (!assistantTranscript || assistantTranscript.trim() === "") {
              console.log('[VOICE CHAT] Skipping empty assistant transcript');
              break;
            }
            
            // DEDUPLICATION: Check if we've already processed this response_id
            if (processedResponseIds.current.has(responseId)) {
              console.log('[VOICE CHAT] Skipping duplicate response_id:', responseId);
              break;
            }
            
            // Mark this response_id as processed
            processedResponseIds.current.add(responseId);
            console.log('[VOICE CHAT] Saving assistant message for response_id:', responseId);
            
            // Save to backend
            await apiRequest("POST", `/api/conversations/${conversationId}/messages`, {
              role: "assistant",
              content: assistantTranscript,
            });
            
            // Invalidate messages query to refetch and display the saved message
            await queryClient.invalidateQueries({ queryKey: ['/api/conversations', conversationId, 'messages'] });
            break;
            
          case "response.done":
            // Reset AI speaking state when response completes or is cancelled
            console.log('[VOICE CHAT] AI response done, status:', data.response?.status);
            setIsAiSpeaking(false);
            break;
            
          case "error":
            console.error('Realtime API error:', data);
            
            // Parse error details
            const errorType = data.error?.type || 'unknown';
            const errorMessage = data.error?.message || 'An error occurred';
            const errorCode = data.error?.code;
            
            // Create user-friendly error message based on error type
            let friendlyMessage = '';
            let suggestions: string[] = [];
            
            if (errorType === 'server_error') {
              friendlyMessage = 'OpenAI servers are experiencing issues';
              suggestions = [
                'This is a temporary OpenAI server problem',
                'Automatically retrying...',
                'Use text chat mode as an alternative'
              ];
              
              // Automatically retry on server errors (OpenAI service issues)
              const maxRetries = 3;
              if (retryCount < maxRetries) {
                const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
                setIsRetrying(true);
                setRetryCount(prev => prev + 1);
                
                console.log(`Retrying connection in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
                
                // Clear any existing retry timeout
                if (retryTimeoutRef.current) {
                  clearTimeout(retryTimeoutRef.current);
                }
                
                retryTimeoutRef.current = setTimeout(async () => {
                  try {
                    ws.close(); // Close the failed connection
                    await connectToRealtimeAPI(); // Reconnect
                    setIsRetrying(false);
                    setError(null);
                  } catch (err) {
                    console.error('Retry failed:', err);
                    setIsRetrying(false);
                  }
                }, retryDelay);
              } else {
                suggestions = [
                  'Multiple retry attempts failed',
                  'OpenAI servers may be down',
                  'Please use text chat mode or try again later'
                ];
              }
            } else if (errorType === 'invalid_request_error') {
              friendlyMessage = 'Invalid API request';
              suggestions = [
                'Your API key may not have Realtime API access',
                'Check your OpenAI account settings at platform.openai.com',
                'Ensure you have Realtime API enabled on your account'
              ];
            } else if (errorType === 'authentication_error') {
              friendlyMessage = 'Authentication failed';
              suggestions = [
                'Your API key may be invalid or expired',
                'Update your OPENAI_API_KEY environment variable',
                'Check your OpenAI account status'
              ];
            } else if (errorType === 'rate_limit_exceeded' || errorCode === 'rate_limit_exceeded') {
              friendlyMessage = 'Rate limit exceeded';
              suggestions = [
                'You have reached your API usage limit',
                'Check your quota at platform.openai.com',
                'Wait before trying again or upgrade your plan'
              ];
            } else {
              friendlyMessage = errorMessage;
              suggestions = [
                'Try again in a moment',
                'Use text chat mode as an alternative'
              ];
            }
            
            setError(JSON.stringify({
              type: 'openai_error',
              friendlyMessage,
              suggestions,
              technicalDetails: errorMessage,
              errorType,
              errorCode
            }));
            break;
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (connectionTimer) clearTimeout(connectionTimer);
        
        // CRITICAL: Clear connection lock on error
        setGloballyConnecting(false);
        
        setError('Connection error. The OpenAI Realtime API may not be available through your current setup.');
        reject(new Error('WebSocket connection failed'));
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed', event.code, event.reason);
        wsRef.current = null;
        setGlobalWebSocket(null, null);  // Clear global WebSocket
        
        // CRITICAL: Clear connection lock when WebSocket closes
        setGloballyConnecting(false);
        
        if (!connectionOpened) {
          // Connection closed before it ever opened
          if (connectionTimer) clearTimeout(connectionTimer);
          reject(new Error(`Connection failed: ${event.reason || 'Unknown error'}`));
        } else if (!isReconnectingRef.current) {
          // Connection was open but closed unexpectedly (not during intentional reconnect)
          setError('Connection lost. Please try again.');
        }
        
        setIsRecording(false);
        setIsAiSpeaking(false);
      };

        wsRef.current = ws;
        setGlobalWebSocket(ws, conversationId || null);  // Set global WebSocket
      });
    } catch (error: any) {
      console.error('Failed to connect to Realtime API:', error);
      
      // CRITICAL: Clear connection lock on error
      setGloballyConnecting(false);
      
      throw new Error(`Failed to connect: ${error.message}`);
    }
  }, [conversationId, language, difficulty, user]);

  const startRecording = async () => {
    // Generate new token for this start attempt
    startTokenRef.current += 1;
    const myToken = startTokenRef.current;
    console.log('[VOICE CHAT] Starting recording with token:', myToken, 'isAiSpeaking:', isAiSpeaking);
    
    // CRITICAL: Don't start recording while AI is actively speaking - prevents "turn detected" cancellations
    // But allow if AI has finished (response.done received)
    if (isAiSpeaking) {
      console.log('[VOICE CHAT] Cannot start recording - AI is currently speaking');
      return;
    }
    
    try {
      setError(null);
      
      // CRITICAL: Resume audio playback context on user interaction (browser autoplay policy)
      if (audioPlayerRef.current) {
        console.log('[VOICE CHAT] Resuming audio playback on user interaction...');
        // Access the internal AudioContext and resume it
        const audioContext = (audioPlayerRef.current as any).audioContext;
        if (audioContext && audioContext.state === 'suspended') {
          await audioContext.resume();
          console.log('[VOICE CHAT] ✓ Audio playback ready!');
        }
      }
      
      // Check if this start was already stopped
      if (myToken <= stoppedTokenRef.current) {
        console.log('[VOICE CHAT] Token', myToken, 'already stopped (stoppedToken:', stoppedTokenRef.current, '), aborting');
        stoppedTokenRef.current = Math.max(stoppedTokenRef.current, myToken); // Mark as stopped
        return;
      }
      
      // Ensure WebSocket is connected
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setError('Connecting to voice chat...');
        try {
          await connectToRealtimeAPI();
          setError(null);
        } catch (err) {
          setError('Voice chat unavailable. The OpenAI Realtime API may not be accessible. Please use text mode or provide your own OpenAI API key.');
          stoppedTokenRef.current = Math.max(stoppedTokenRef.current, myToken); // Mark failed token as stopped
          return;
        }
      }

      // Check again if this start was stopped during connection
      if (myToken <= stoppedTokenRef.current) {
        console.log('[VOICE CHAT] Token', myToken, 'stopped during connection (stoppedToken:', stoppedTokenRef.current, '), aborting');
        stoppedTokenRef.current = Math.max(stoppedTokenRef.current, myToken); // Mark as stopped
        return;
      }

      audioRecorderRef.current = new AudioRecorder();
      
      await audioRecorderRef.current.startRecording((audioData) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          // Convert ArrayBuffer to Int16Array (PCM16 format)
          const pcm16 = new Int16Array(audioData);
          const base64Audio = pcm16ToBase64(pcm16);
          wsRef.current.send(JSON.stringify({
            type: "input_audio_buffer.append",
            audio: base64Audio,
          }));
        }
      });

      // FINAL TOKEN CHECK: Only set isRecording if this start wasn't stopped
      if (myToken <= stoppedTokenRef.current) {
        console.log('[VOICE CHAT] Token', myToken, 'stopped during recorder startup (stoppedToken:', stoppedTokenRef.current, '), cleaning up');
        if (audioRecorderRef.current) {
          audioRecorderRef.current.stopRecording();
          audioRecorderRef.current = null;
        }
        stoppedTokenRef.current = Math.max(stoppedTokenRef.current, myToken); // Mark as stopped
        return;
      }

      // Safe to set state - this start token hasn't been stopped
      currentRecordingTokenRef.current = myToken; // Save which token is recording
      setIsRecording(true);
      console.log('[VOICE CHAT] Recording started successfully with token:', myToken);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setError('Failed to access microphone. Please check permissions.');
      stoppedTokenRef.current = Math.max(stoppedTokenRef.current, myToken); // Mark failed token as stopped
    }
  };

  const stopRecording = () => {
    // CRITICAL FIX: Snapshot tokens immediately to prevent race with concurrent starts
    const recordingTokenSnapshot = currentRecordingTokenRef.current;
    const latestTokenSnapshot = startTokenRef.current;
    
    console.log('[VOICE CHAT] Stop requested, recordingToken:', recordingTokenSnapshot, 'latestToken:', latestTokenSnapshot, 'isRecording:', isRecording, 'hasRecorder:', !!audioRecorderRef.current);
    
    // Determine which token to stop based on snapshot (not live refs!)
    if (isRecording && recordingTokenSnapshot >= 0) {
      // Stop the specific token that was recording when we started
      stoppedTokenRef.current = Math.max(stoppedTokenRef.current, recordingTokenSnapshot);
      console.log('[VOICE CHAT] Stopped recording token:', recordingTokenSnapshot, 'stoppedToken now:', stoppedTokenRef.current);
      // Only clear if it's still the same token (not overwritten by new start)
      if (currentRecordingTokenRef.current === recordingTokenSnapshot) {
        currentRecordingTokenRef.current = -1;
      }
    } else {
      // No active recording - stop the most recent start attempt (as of snapshot)
      stoppedTokenRef.current = Math.max(stoppedTokenRef.current, latestTokenSnapshot);
      console.log('[VOICE CHAT] No active recording, stopped latest token:', latestTokenSnapshot);
    }
    
    // If recorder exists, stop it
    if (audioRecorderRef.current) {
      console.log('[VOICE CHAT] Stopping active recorder');
      audioRecorderRef.current.stopRecording();
      audioRecorderRef.current = null;
    }
    
    // CRITICAL: Commit the audio buffer so OpenAI processes what we recorded
    // In push-to-talk mode, we stop recording before server VAD detects end of speech,
    // so we must explicitly commit and request a response
    if (wsRef.current?.readyState === WebSocket.OPEN && speechDetectedRef.current) {
      console.log('[VOICE CHAT] Committing audio buffer and requesting response');
      wsRef.current.send(JSON.stringify({
        type: "input_audio_buffer.commit"
      }));
      wsRef.current.send(JSON.stringify({
        type: "response.create"
      }));
    }
    
    // CRITICAL: Always set isRecording to false, even if no recorder exists
    // This prevents UI stuck in "recording" state when stop races with start
    setIsRecording(false);
    speechDetectedRef.current = false;
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Global keyboard listener for push-to-talk (spacebar works anywhere)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle spacebar if not in an input field and not already recording
      if (e.code === 'Space' && 
          !e.repeat && 
          conversationId && 
          capabilityAvailable && 
          !isRecording &&
          !(e.target instanceof HTMLInputElement) &&
          !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        console.log('[GLOBAL KEYBOARD] Spacebar pressed, starting recording');
        startRecording();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Release spacebar to stop (only if currently recording)
      if (e.code === 'Space' && 
          isRecording &&
          !(e.target instanceof HTMLInputElement) &&
          !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        console.log('[GLOBAL KEYBOARD] Spacebar released, stopping recording');
        stopRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [conversationId, capabilityAvailable, isRecording]);

  // Connect to Realtime API when conversation is ready AND capability is confirmed
  useEffect(() => {
    let mounted = true;
    
    // CRITICAL SINGLETON FIX: Check if a global WebSocket already exists for this conversation
    const existingGlobalWs = getGlobalWebSocket();
    const existingGlobalConvId = getGlobalConversationId();
    
    // Check if WebSocket is OPEN or CONNECTING (prevents duplicate connections during React StrictMode)
    if (existingGlobalWs && existingGlobalConvId === conversationId && 
        (existingGlobalWs.readyState === WebSocket.OPEN || existingGlobalWs.readyState === WebSocket.CONNECTING)) {
      console.log('[VOICE CHAT] ✓ Reusing existing global WebSocket for conversation:', conversationId, 'readyState:', existingGlobalWs.readyState);
      wsRef.current = existingGlobalWs;
      return;
    }
    
    // CRITICAL LOCK: Prevent simultaneous WebSocket creation during React StrictMode double-mount
    if (isGloballyConnecting()) {
      console.log('[VOICE CHAT] ⏸️ Another component is already connecting, waiting...');
      // Wait 100ms and retry - the other component should finish connecting by then
      const checkInterval = setInterval(() => {
        const nowConnected = getGlobalWebSocket();
        if (nowConnected && getGlobalConversationId() === conversationId) {
          console.log('[VOICE CHAT] ✓ Using WebSocket created by other component');
          wsRef.current = nowConnected;
          clearInterval(checkInterval);
        } else if (!isGloballyConnecting()) {
          // Connection lock released but no WebSocket - we should connect
          console.log('[VOICE CHAT] Lock released, proceeding to connect...');
          clearInterval(checkInterval);
          if (conversationId && mounted && capabilityAvailable) {
            connectToRealtimeAPI().catch((err) => {
              if (mounted) {
                console.error('Failed to establish initial connection:', err);
                setError('Voice chat unavailable. The OpenAI Realtime API may not be accessible. Please use text mode.');
              }
            });
          }
        }
      }, 100);
      
      return () => {
        clearInterval(checkInterval);
      };
    }
    
    // Close any local WebSocket before creating a new one
    if (wsRef.current) {
      console.log('[VOICE CHAT] Closing local WebSocket before reconnecting...');
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (conversationId && mounted && capabilityAvailable) {
      connectToRealtimeAPI().catch((err) => {
        if (mounted) {
          console.error('Failed to establish initial connection:', err);
          setError('Voice chat unavailable. The OpenAI Realtime API may not be accessible. Please use text mode.');
        }
      });
    }
    
    return () => {
      mounted = false;
      // Don't close the global WebSocket on unmount - let other instances use it
      // Only clear the local reference
      wsRef.current = null;
      
      if (audioRecorderRef.current) {
        audioRecorderRef.current.stopRecording();
        audioRecorderRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      // Reset processed response IDs when conversation/session changes
      processedResponseIds.current.clear();
    };
  }, [conversationId, capabilityAvailable, connectToRealtimeAPI]);

  // Combine backend messages with live transcript (avoiding duplicates)
  // Only include transcript messages that haven't been saved to backend yet
  const savedContents = new Set(messages.map(m => m.content));
  const unsavedTranscript = transcript.filter(t => !savedContents.has(t.content));
  
  const allMessages = [
    ...messages.map(m => ({ role: m.role, content: m.content, saved: true, messageId: m.id })),
    ...unsavedTranscript.map(t => ({ ...t, saved: false })),
  ];

  // Determine avatar state for voice chat
  const avatarState: AvatarState = isRecording ? "listening" : isAiSpeaking ? "speaking" : "idle";

  // Get display name for current language
  const languageDisplayName = language.charAt(0).toUpperCase() + language.slice(1);

  return (
    <div className="flex flex-col h-full">
      {/* Compact toolbar */}
      <div className="flex items-center justify-between gap-4 p-4 border-b">
        <div className="flex items-center gap-4">
          <InstructorAvatar state={avatarState} className="w-12" />
          <div>
            <h2 className="text-lg font-semibold">Practice {languageDisplayName}</h2>
            <p className="text-xs text-muted-foreground">Speak with your AI tutor</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <LanguageSelector compact />
          <CompactDifficultyControl conversationId={conversationId} />
        </div>
      </div>

      {/* Voice chat area */}
      <Card className="flex flex-col flex-1 m-4 mt-0">
        <ScrollArea className="flex-1 p-6">
        <div className="space-y-4">
          {!conversationId ? (
            <div className="flex flex-col justify-center items-center h-full text-center text-muted-foreground p-8">
              <MessageSquare className="h-16 w-16 mb-4 opacity-50 animate-pulse" />
              <p className="text-lg font-medium mb-2">Preparing conversation...</p>
              <p className="text-sm">Your AI tutor will be with you momentarily</p>
            </div>
          ) : allMessages.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-full text-center text-muted-foreground p-8">
              <Mic className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Start a voice conversation</p>
              <p className="text-sm">Press the microphone button to start speaking with your AI tutor</p>
            </div>
          ) : (
            <>
              {allMessages.map((message, index) => {
                const pronunciationScore = message.messageId ? pronunciationScores.get(message.messageId) : undefined;
                const getScoreColor = (score: number) => {
                  if (score >= 80) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
                  if (score >= 60) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
                  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
                };
                
                return (
                <div
                  key={index}
                  className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Bot className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex flex-col gap-2 max-w-2xl">
                    <div
                      className={`rounded-2xl p-4 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-base leading-relaxed">{message.content}</p>
                    </div>
                    
                    {/* Pronunciation score for user messages */}
                    {message.role === "user" && pronunciationScore && (
                      <div className="flex flex-col gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Badge className={getScoreColor(pronunciationScore.score)} data-testid={`badge-pronunciation-score-${index}`}>
                            <Volume2 className="h-3 w-3 mr-1" />
                            Pronunciation: {pronunciationScore.score}/100
                          </Badge>
                        </div>
                        {pronunciationScore.feedback && (
                          <p className="text-xs text-muted-foreground italic">
                            {pronunciationScore.feedback}
                          </p>
                        )}
                        {pronunciationScore.phoneticIssues.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">Watch out for:</span>{' '}
                            {pronunciationScore.phoneticIssues.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {message.role === "user" && (
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-secondary">
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              )})}
              <div ref={scrollRef} />
            </>
          )}
        </div>
      </ScrollArea>

      {/* Foreign language text display for visual reinforcement */}
      {isAiSpeaking && transcript.length > 0 && transcript[transcript.length - 1].role === 'assistant' && (
        <div className="px-6 py-4 border-t bg-primary/5 dark:bg-primary/10">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <Volume2 className="h-5 w-5 text-primary animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Now speaking in {languageDisplayName}:
              </p>
              <p className="text-lg font-medium leading-relaxed text-foreground" data-testid="text-current-speech">
                {transcript[transcript.length - 1].content}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="px-6 pt-8 pb-10 border-t max-h-80 overflow-y-auto">
        {error && (() => {
          try {
            // Try to parse structured error
            const errorData = JSON.parse(error);
            if (errorData.type === 'openai_error') {
              return (
                <div className="mb-4 p-4 pb-6 bg-destructive/10 text-destructive rounded-lg" data-testid="error-message">
                  <p className="font-semibold mb-2 text-base">{errorData.friendlyMessage}</p>
                  
                  {errorData.suggestions && errorData.suggestions.length > 0 && (
                    <div className="text-sm space-y-2 mt-3">
                      <p className="font-medium">What you can do:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        {errorData.suggestions.map((suggestion: string, idx: number) => (
                          <li key={idx}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {errorData.technicalDetails && (
                    <details className="mt-3 text-xs">
                      <summary className="cursor-pointer font-medium">Technical details</summary>
                      <div className="mt-2 p-2 bg-background/50 rounded border">
                        <p><strong>Error type:</strong> {errorData.errorType}</p>
                        {errorData.errorCode && <p><strong>Error code:</strong> {errorData.errorCode}</p>}
                        <p><strong>Message:</strong> {errorData.technicalDetails}</p>
                      </div>
                    </details>
                  )}
                  
                  <div className="mt-4 flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      disabled={isRetrying}
                      onClick={() => {
                        // Cancel ongoing retry
                        if (retryTimeoutRef.current) {
                          clearTimeout(retryTimeoutRef.current);
                          retryTimeoutRef.current = null;
                        }
                        
                        // Reset retry state
                        setRetryCount(0);
                        setIsRetrying(true);
                        
                        // Set reconnecting flag before closing to prevent error message
                        isReconnectingRef.current = true;
                        
                        if (wsRef.current) {
                          wsRef.current.close();
                          wsRef.current = null;
                        }
                        
                        connectToRealtimeAPI().catch((err) => {
                          console.error('Retry failed:', err);
                          isReconnectingRef.current = false;
                          setIsRetrying(false);
                          // Show error if retry fails
                          setError(JSON.stringify({
                            type: 'openai_error',
                            friendlyMessage: 'Reconnection failed',
                            suggestions: [
                              'Check your internet connection',
                              'Wait a moment and try again',
                              'Use text chat mode as an alternative'
                            ],
                            technicalDetails: String(err),
                            errorType: 'connection_error',
                            errorCode: null
                          }));
                        });
                      }}
                      data-testid="button-retry-voice"
                    >
                      {isRetrying ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Retrying...
                        </>
                      ) : (
                        'Try Again'
                      )}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setError(null);
                        setRetryCount(0);
                        setIsRetrying(false);
                        if (retryTimeoutRef.current) {
                          clearTimeout(retryTimeoutRef.current);
                          retryTimeoutRef.current = null;
                        }
                      }}
                      data-testid="button-dismiss-error"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              );
            }
          } catch {
            // Fall through to simple error display
          }
          
          // Simple error string fallback
          return (
            <div className="mb-4 p-4 pb-6 bg-destructive/10 text-destructive rounded-lg" data-testid="error-message">
              <p className="font-medium mb-2">Voice Chat Unavailable</p>
              <p className="text-sm mb-3">{error}</p>
              <div className="text-sm text-muted-foreground space-y-2">
                <p className="font-medium">What can I do?</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Use text-based chat mode (fully functional)</li>
                  {capabilityCode === 'access_denied' && (
                    <li>Get an OpenAI API key with Realtime API access at <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer" className="underline">platform.openai.com</a></li>
                  )}
                  {capabilityCode === 'missing_api_key' && (
                    <li>Set USER_OPENAI_API_KEY in Replit Secrets with your OpenAI API key</li>
                  )}
                  {capabilityCode === 'rate_limit' && (
                    <li>Check your OpenAI account billing and usage limits</li>
                  )}
                  {capabilityCode === 'server_error' && (
                    <li>Wait a few minutes and try rechecking access</li>
                  )}
                </ul>
              </div>
              <div className="mt-4 flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => checkCapability(true)}
                  disabled={isCheckingCapability}
                  data-testid="button-recheck-access"
                >
                  {isCheckingCapability ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    'Recheck Access'
                  )}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setError(null)}
                  data-testid="button-dismiss-error"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          );
        })()}
        
        <div className="flex justify-center">
          <Button
            size="lg"
            variant={isRecording ? "destructive" : "default"}
            onPointerDown={(e) => {
              // Only start on primary button (left mouse or touch)
              console.log('[VOICE BUTTON] PointerDown - button:', e.button, 'conversationId:', conversationId, 'capabilityAvailable:', capabilityAvailable, 'isRecording:', isRecording);
              if (e.button === 0 && conversationId && capabilityAvailable && !isRecording) {
                console.log('[VOICE BUTTON] Conditions met, calling startRecording()');
                startRecording();
              } else {
                console.log('[VOICE BUTTON] Conditions NOT met, blocking startRecording()');
              }
            }}
            onPointerUp={() => {
              if (isRecording) {
                stopRecording();
              }
            }}
            onPointerLeave={() => {
              // Stop if pointer leaves button while recording
              if (isRecording) {
                stopRecording();
              }
            }}
            onPointerCancel={() => {
              // Stop if pointer is cancelled (e.g., touch interruption)
              if (isRecording) {
                stopRecording();
              }
            }}
            onKeyDown={(e) => {
              // Support keyboard: Space or Enter to start recording
              if (e.key === ' ' || e.key === 'Enter') {
                console.log('[VOICE BUTTON] KeyDown:', e.key, 'repeat:', e.repeat, 'conversationId:', conversationId, 'capabilityAvailable:', capabilityAvailable, 'isRecording:', isRecording);
                if (!e.repeat && conversationId && capabilityAvailable && !isRecording) {
                  e.preventDefault();
                  console.log('[VOICE BUTTON] Keyboard conditions met, calling startRecording()');
                  startRecording();
                } else {
                  console.log('[VOICE BUTTON] Keyboard conditions NOT met, blocking startRecording()');
                }
              }
            }}
            onKeyUp={(e) => {
              // Support keyboard: Release Space or Enter to stop recording
              if ((e.key === ' ' || e.key === 'Enter') && isRecording) {
                e.preventDefault();
                stopRecording();
              }
            }}
            disabled={!conversationId || !capabilityAvailable}
            className="rounded-full h-16 w-16"
            data-testid="button-toggle-recording"
          >
            {!capabilityChecked ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : isRecording ? (
              <MicOff className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </Button>
        </div>
        
        <p className="text-center text-sm text-muted-foreground mt-4">
          {!conversationId
            ? "Create a conversation to start voice chat"
            : !capabilityChecked 
            ? "Checking voice chat availability..." 
            : !capabilityAvailable
            ? "Voice chat unavailable - see error message above"
            : isRecording 
            ? "Release to stop recording" 
            : "Hold to speak"}
        </p>
      </div>
    </Card>
    </div>
  );
}
