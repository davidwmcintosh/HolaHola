import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mic, MicOff, Bot, User, Loader2, Volume2, MessageSquare, Radio } from "lucide-react";
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
import { getGlobalWebSocket, setGlobalWebSocket, getGlobalConversationId, hasGreetingBeenSent, markGreetingAsSent, isGloballyConnecting, setGloballyConnecting, clearGlobalWebSocketIfMatch } from "@/lib/realtimeManager";

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
  // VAD mode: 'push-to-talk' (manual), 'semantic_vad' (auto-detect with AI), 'server_vad' (simple auto-detect)
  // DEFAULT: push-to-talk to avoid microphone permission errors on page load (browsers require user gesture)
  const [vadMode, setVadMode] = useState<'push-to-talk' | 'semantic_vad' | 'server_vad'>('push-to-talk');
  const [isVadActive, setIsVadActive] = useState(false); // Is VAD currently detecting speech?
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isReconnectingRef = useRef<boolean>(false);
  
  // Track processed response IDs to prevent duplicate message saves
  const processedResponseIds = useRef<Set<string>>(new Set());
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speechDetectedRef = useRef<boolean>(false);
  
  // Track if initial greeting should be skipped (don't save to DB to avoid duplicates on reload)
  const skipNextGreetingRef = useRef<boolean>(false);
  
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
      
      // CRITICAL FIX: Only update state if values actually changed
      // This prevents unnecessary re-renders and useEffect cleanup cycles
      setCapabilityAvailable(prev => prev === data.available ? prev : data.available);
      setCapabilityCode(prev => prev === (data.code || null) ? prev : (data.code || null));
      setCapabilityChecked(true);
      
      if (!data.available) {
        setError(data.reason || 'Voice chat unavailable');
      } else {
        setError(null);
      }
    } catch (error) {
      console.error('Failed to check capability:', error);
      setCapabilityChecked(true);
      setCapabilityAvailable(prev => prev === false ? prev : false);
      setCapabilityCode(prev => prev === 'network_error' ? prev : 'network_error');
      setError('Failed to check voice chat availability. Please check your internet connection.');
    } finally {
      setIsCheckingCapability(false);
    }
  }, []);

  // Check capability once on mount
  useEffect(() => {
    checkCapability();
  }, [checkCapability]);

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
      // UNIFIED ARCHITECTURE: Connect through server proxy
      // Proxy uses shared createSystemPrompt() to ensure voice and text chat
      // have identical learning constraints and advancement goals
      console.log('[VOICE CHAT] Connecting through unified proxy...');
      
      // Build WebSocket URL with conversation context
      // NOTE: userId is derived server-side from authenticated session for security
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const params = new URLSearchParams({
        language,
        difficulty,
        conversationId: conversationId || '',
        vadMode  // Pass VAD mode to server proxy
      });
      const wsUrl = `${protocol}//${host}/api/realtime/ws?${params.toString()}`;
      
      console.log(`[VOICE CHAT] ✓ Connecting to proxy with unified system prompt`);
      
      const ws = new WebSocket(wsUrl);
      
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
          console.log('[VOICE CHAT] ✓ Connected through unified proxy with shared system prompt!');
          connectionOpened = true;
          if (connectionTimer) clearTimeout(connectionTimer);
          
          // CRITICAL FIX: Set global WebSocket ONLY after successful connection
          // This prevents React cleanup from closing the socket before it opens
          wsRef.current = ws;
          setGlobalWebSocket(ws, conversationId || null);
          
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
          
          // NOTE: System prompt is now configured server-side via realtime-proxy.ts
          // using the shared createSystemPrompt function. This ensures voice and text
          // chat use identical learning constraints and advancement goals.
          // No need to send session.update from client anymore.
          
          // VAD MODE: Start continuous recording automatically for auto-detect modes
          if (vadMode !== 'push-to-talk') {
            console.log('[VAD] Auto-detect mode active - starting continuous recording');
            // Small delay to ensure session is fully configured
            setTimeout(() => {
              startRecording().catch((err) => {
                console.error('[VAD] Failed to start continuous recording:', err);
              });
            }, 500);
          }
          
          // REVERTED: Removed greeting logic to debug voice chat issue
          
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
            console.log('[VAD] Speech started');
            speechDetectedRef.current = true;
            setIsVadActive(true); // Visual feedback: VAD detected speech
            break;
            
          case "input_audio_buffer.speech_stopped":
            console.log('[VAD] Speech stopped');
            setIsVadActive(false); // Visual feedback: VAD stopped detecting speech
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
            
            // REVERTED: Removed skip greeting logic
            
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
        
        // CRITICAL FIX: Only clear global WebSocket if THIS socket is the active one
        // This prevents stale onclose handlers from closing fresh connections
        clearGlobalWebSocketIfMatch(ws);
        
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
        await audioPlayerRef.current.resume();
        console.log('[VOICE CHAT] ✓ Audio playback ready!');
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
      // Set a structured error for microphone permission issues
      setError(JSON.stringify({
        type: 'microphone_permission',
        title: 'Microphone Access Required',
        message: 'Unable to access your microphone. Voice chat requires microphone permissions.',
        action: 'grant_permission'
      }));
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
  }, [conversationId, capabilityAvailable, connectToRealtimeAPI, vadMode]);

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
      {/* Compact toolbar - hidden on mobile for minimalist experience, visible on desktop */}
      <div className="hidden md:flex items-center justify-between gap-4 p-4 border-b">
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
      
      {/* Mobile-only minimalist header */}
      <div className="md:hidden flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-3">
          <InstructorAvatar state={avatarState} className="w-10" />
          <div>
            <h2 className="text-base font-semibold">{languageDisplayName}</h2>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <LanguageSelector compact />
          <CompactDifficultyControl conversationId={conversationId} />
        </div>
      </div>

      {/* Voice chat area - full height scrollable, mobile-optimized padding */}
      <Card className="flex flex-col flex-1 m-3 md:m-4 mt-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          <div className="space-y-3 md:space-y-4">
          {!conversationId ? (
            <div className="flex flex-col justify-center items-center h-full text-center text-muted-foreground p-6 md:p-8">
              <MessageSquare className="h-12 md:h-16 w-12 md:w-16 mb-3 md:mb-4 opacity-50 animate-pulse" />
              <p className="text-base md:text-lg font-medium mb-1 md:mb-2">Preparing conversation...</p>
              <p className="text-xs md:text-sm">Your AI tutor will be with you momentarily</p>
            </div>
          ) : allMessages.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-full text-center text-muted-foreground p-6 md:p-8">
              <Mic className="h-12 md:h-16 w-12 md:w-16 mb-3 md:mb-4 opacity-50" />
              <p className="text-base md:text-lg font-medium mb-1 md:mb-2">Start a voice conversation</p>
              <p className="text-xs md:text-sm">Press the microphone button to start speaking with your AI tutor</p>
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
                  className={`flex gap-2 md:gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <Avatar className="h-8 md:h-10 w-8 md:w-10 flex-shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Bot className="h-4 md:h-5 w-4 md:w-5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex flex-col gap-2 max-w-[85%] md:max-w-2xl">
                    <div
                      className={`rounded-2xl md:rounded-2xl p-3 md:p-4 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm md:text-base leading-relaxed">{message.content}</p>
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
                    <Avatar className="h-8 md:h-10 w-8 md:w-10 flex-shrink-0">
                      <AvatarFallback className="bg-secondary">
                        <User className="h-4 md:h-5 w-4 md:w-5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              )})}
              <div ref={scrollRef} />
            </>
          )}
          </div>
        </div>
      </Card>

      {/* Foreign language text display for visual reinforcement - mobile optimized */}
      {isAiSpeaking && transcript.length > 0 && transcript[transcript.length - 1].role === 'assistant' && (
        <div className="px-4 md:px-6 py-3 md:py-4 border-t bg-primary/5 dark:bg-primary/10">
          <div className="flex items-start gap-2 md:gap-3">
            <div className="flex-shrink-0">
              <Volume2 className="h-4 md:h-5 w-4 md:w-5 text-primary animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Now speaking in {languageDisplayName}:
              </p>
              <p className="text-base md:text-lg font-medium leading-relaxed text-foreground" data-testid="text-current-speech">
                {transcript[transcript.length - 1].content}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Control area - mobile optimized with larger mic button */}
      <div className="px-4 md:px-6 pt-4 md:pt-5 pb-4 md:pb-6 border-t shrink-0">
        {error && (() => {
          try {
            // Try to parse structured error
            const errorData = JSON.parse(error);
            
            // Handle microphone permission errors specifically
            if (errorData.type === 'microphone_permission') {
              return (
                <div className="mb-4 p-4 pb-6 bg-destructive/10 text-destructive rounded-lg" data-testid="error-message">
                  <p className="font-semibold mb-2 text-base">{errorData.title}</p>
                  <p className="text-sm mb-3">{errorData.message}</p>
                  
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p className="font-medium">How to enable your microphone:</p>
                    <ul className="list-disc list-inside space-y-1.5 ml-2">
                      <li><strong>Chrome/Edge:</strong> Look for the <Mic className="inline h-3 w-3 mx-1" /> icon in the address bar and click "Allow"</li>
                      <li><strong>Firefox:</strong> Click the microphone icon in the address bar and select "Allow"</li>
                      <li><strong>Safari:</strong> Go to Safari → Settings → Websites → Microphone, then allow this site</li>
                      <li>If you previously blocked access, you may need to refresh the page after changing permissions</li>
                    </ul>
                    <p className="mt-3 pt-2 border-t border-border">
                      <strong>Alternative:</strong> Use text-based chat mode (fully functional)
                    </p>
                  </div>
                  
                  <div className="mt-4 flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setError(null);
                        // Try starting recording again - will trigger permission prompt
                        startRecording();
                      }}
                      data-testid="button-retry-microphone"
                    >
                      <Mic className="h-3 w-3 mr-2" />
                      Try Again
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
            }
            
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
          
          // Simple error string fallback - check if it's a microphone permission error
          const isMicError = error.includes('microphone') || error.includes('Microphone');
          
          return (
            <div className="mb-4 p-4 pb-6 bg-destructive/10 text-destructive rounded-lg" data-testid="error-message">
              <p className="font-medium mb-2">
                {isMicError ? 'Microphone Access Required' : 'Voice Chat Unavailable'}
              </p>
              <p className="text-sm mb-3">{error}</p>
              <div className="text-sm text-muted-foreground space-y-2">
                <p className="font-medium">What can I do?</p>
                {isMicError ? (
                  <>
                    <p className="mb-2">To enable your microphone:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li><strong>Chrome/Edge:</strong> Look for the camera/microphone icon in the address bar and click "Allow"</li>
                      <li><strong>Firefox:</strong> Click the microphone icon in the address bar and select "Allow"</li>
                      <li><strong>Safari:</strong> Go to Safari → Settings → Websites → Microphone, then allow access</li>
                      <li>If you previously blocked access, you may need to refresh the page after granting permission</li>
                    </ul>
                    <p className="mt-3">Or use text-based chat mode (fully functional)</p>
                  </>
                ) : (
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
                      <li>OpenAI's servers are temporarily experiencing issues - wait a few minutes and try rechecking</li>
                    )}
                    {!capabilityCode && (
                      <li>Check your internet connection and try rechecking access</li>
                    )}
                  </ul>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    if (isMicError) {
                      // For mic errors, try starting recording again (will trigger permission prompt)
                      setError(null);
                      startRecording();
                    } else {
                      checkCapability(true);
                    }
                  }}
                  disabled={isCheckingCapability}
                  data-testid="button-recheck-access"
                >
                  {isCheckingCapability ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    isMicError ? 'Try Again' : 'Recheck Access'
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
        
        {/* VAD Mode Toggle - always visible but more compact on mobile */}
        <div className="flex justify-center mb-3 md:mb-4">
          <div className="inline-flex items-center gap-1 md:gap-2 p-1 bg-muted rounded-lg">
            <Button
              variant={vadMode === 'push-to-talk' ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setVadMode('push-to-talk');
                // Will reconnect WebSocket with new mode
              }}
              aria-pressed={vadMode === 'push-to-talk'}
              role="button"
              data-testid="button-vad-push-to-talk"
              className="text-xs md:text-sm"
            >
              <Mic className="h-3 md:h-4 w-3 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Push to Talk</span>
              <span className="sm:hidden">Push</span>
            </Button>
            <Button
              variant={vadMode === 'semantic_vad' ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setVadMode('semantic_vad');
                // Will reconnect WebSocket with new mode
              }}
              aria-pressed={vadMode === 'semantic_vad'}
              role="button"
              data-testid="button-vad-auto-detect"
              className="text-xs md:text-sm"
            >
              <Radio className="h-3 md:h-4 w-3 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Auto Detect</span>
              <span className="sm:hidden">Auto</span>
              {vadMode === 'semantic_vad' && (
                <Badge variant="secondary" className="ml-1 md:ml-2 text-xs hidden md:inline-flex">
                  Smart
                </Badge>
              )}
            </Button>
          </div>
        </div>
        
        {/* Large microphone button - wrapped in a sized container for mobile prominence */}
        <div className="flex justify-center">
          <div className="w-20 h-20 md:w-16 md:h-16 flex items-center justify-center">
            <Button
              size="lg"
              variant={isRecording ? "destructive" : (vadMode !== 'push-to-talk' && isVadActive) ? "default" : "outline"}
              onPointerDown={(e) => {
              // Only respond to button press in push-to-talk mode
              if (vadMode !== 'push-to-talk') return;
              
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
              if (vadMode !== 'push-to-talk') return;
              if (isRecording) {
                stopRecording();
              }
            }}
            onPointerLeave={() => {
              if (vadMode !== 'push-to-talk') return;
              // Stop if pointer leaves button while recording
              if (isRecording) {
                stopRecording();
              }
            }}
            onPointerCancel={() => {
              if (vadMode !== 'push-to-talk') return;
              // Stop if pointer is cancelled (e.g., touch interruption)
              if (isRecording) {
                stopRecording();
              }
            }}
            onKeyDown={(e) => {
              if (vadMode !== 'push-to-talk') return;
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
              if (vadMode !== 'push-to-talk') return;
              // Support keyboard: Release Space or Enter to stop recording
              if ((e.key === ' ' || e.key === 'Enter') && isRecording) {
                e.preventDefault();
                stopRecording();
              }
            }}
            disabled={!conversationId || !capabilityAvailable}
            aria-pressed={isRecording}
            aria-label={isRecording ? "Release to stop recording" : "Hold to speak"}
            role="button"
            className={`rounded-full w-full h-full ${vadMode !== 'push-to-talk' && isVadActive ? 'animate-pulse' : ''}`}
            data-testid="button-toggle-recording"
          >
            {!capabilityChecked ? (
              <Loader2 className="h-7 md:h-6 w-7 md:w-6 animate-spin" />
            ) : vadMode !== 'push-to-talk' ? (
              // VAD mode: Show visual feedback of detection
              isVadActive ? <Volume2 className="h-7 md:h-6 w-7 md:w-6" /> : <Radio className="h-7 md:h-6 w-7 md:w-6" />
            ) : (
              // Push-to-talk mode: Show mic on/off
              isRecording ? <MicOff className="h-7 md:h-6 w-7 md:w-6" /> : <Mic className="h-7 md:h-6 w-7 md:w-6" />
            )}
          </Button>
          </div>
        </div>
        
        <p className="text-center text-xs md:text-sm text-muted-foreground mt-3 md:mt-4 px-2">
          {!conversationId
            ? "Create a conversation to start voice chat"
            : !capabilityChecked 
            ? "Checking voice chat availability..." 
            : !capabilityAvailable
            ? "Voice chat unavailable - see error message above"
            : vadMode === 'push-to-talk'
              ? (isRecording ? "Release to stop recording" : "Hold to speak")
              : (isVadActive ? "Listening..." : "Speak to start - AI will detect when you're done")
          }
        </p>
      </div>
    </div>
  );
}
