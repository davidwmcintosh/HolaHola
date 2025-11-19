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
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          
          // Configure session after connection opens
          ws.send(JSON.stringify({
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              instructions: `You are a ${language} language tutor. Keep responses concise and conversational.`,
              voice: 'alloy',
              input_audio_format: 'pcm16',
              output_audio_format: 'pcm16',
              input_audio_transcription: {
                model: 'whisper-1'
              },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500
              }
            }
          }));
          
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
        
        switch (data.type) {
          case "session.created":
            console.log('Session created:', data);
            break;
            
          case "input_audio_buffer.speech_started":
            console.log('Speech started');
            break;
            
          case "input_audio_buffer.speech_stopped":
            console.log('Speech stopped');
            break;
            
          case "conversation.item.input_audio_transcription.completed":
            const userTranscript = data.transcript;
            
            // Save to backend
            const messageResponse = await apiRequest("POST", `/api/conversations/${conversationId}/messages`, {
              role: "user",
              content: userTranscript,
            });
            const savedMessage = await messageResponse.json();
            
            // Add to transcript with messageId for pronunciation scoring
            setTranscript(prev => [...prev, { 
              role: "user", 
              content: userTranscript,
              messageId: savedMessage.id 
            }]);

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
            
          case "response.output_audio.delta":
            if (data.delta && audioPlayerRef.current) {
              audioPlayerRef.current.playAudio(data.delta);
              setIsAiSpeaking(true);
            }
            break;
            
          case "response.output_audio_transcript.delta":
            // Build up assistant transcript
            break;
            
          case "response.output_audio_transcript.done":
            const assistantTranscript = data.transcript;
            setTranscript(prev => [...prev, { role: "assistant", content: assistantTranscript }]);
            
            // Save to backend
            await apiRequest("POST", `/api/conversations/${conversationId}/messages`, {
              role: "assistant",
              content: assistantTranscript,
            });
            break;
            
          case "response.done":
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
        setError('Connection error. The OpenAI Realtime API may not be available through your current setup.');
        reject(new Error('WebSocket connection failed'));
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed', event.code, event.reason);
        wsRef.current = null;
        
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
      });
    } catch (error: any) {
      console.error('Failed to connect to Realtime API:', error);
      throw new Error(`Failed to connect: ${error.message}`);
    }
  }, [conversationId, language, difficulty, user]);

  const startRecording = async () => {
    try {
      setError(null);
      
      // Ensure WebSocket is connected
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setError('Connecting to voice chat...');
        try {
          await connectToRealtimeAPI();
          setError(null);
        } catch (err) {
          setError('Voice chat unavailable. The OpenAI Realtime API may not be accessible. Please use text mode or provide your own OpenAI API key.');
          return;
        }
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

      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setError('Failed to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (audioRecorderRef.current) {
      audioRecorderRef.current.stopRecording();
      audioRecorderRef.current = null;
    }
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "input_audio_buffer.commit",
      }));
      wsRef.current.send(JSON.stringify({
        type: "response.create",
      }));
    }
    
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Connect to Realtime API when conversation is ready AND capability is confirmed
  useEffect(() => {
    let mounted = true;
    
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
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (audioRecorderRef.current) {
        audioRecorderRef.current.stopRecording();
        audioRecorderRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [conversationId, capabilityAvailable, connectToRealtimeAPI]);

  // Combine backend messages with live transcript
  const allMessages = [
    ...messages.map(m => ({ role: m.role, content: m.content, saved: true, messageId: m.id })),
    ...transcript.map(t => ({ ...t, saved: false })),
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
            onClick={toggleRecording}
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
            ? "Click to stop recording" 
            : "Click to start speaking"}
        </p>
      </div>
    </Card>
    </div>
  );
}
