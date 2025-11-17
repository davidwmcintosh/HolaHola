import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mic, MicOff, Bot, User, Loader2, Volume2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Message } from "@shared/schema";
import { AudioRecorder, AudioPlayer, pcm16ToBase64 } from "@/lib/audioUtils";
import { Badge } from "@/components/ui/badge";

interface RealtimeEvent {
  type: string;
  [key: string]: any;
}

export function VoiceChat() {
  const { language, difficulty } = useLanguage();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<Array<{ role: string; content: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [capabilityChecked, setCapabilityChecked] = useState(false);
  const [capabilityAvailable, setCapabilityAvailable] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check Realtime API capability
  useEffect(() => {
    const checkCapability = async () => {
      try {
        const response = await fetch('/api/realtime/capability');
        const data = await response.json();
        setCapabilityAvailable(data.available);
        setCapabilityChecked(true);
        
        if (!data.available) {
          setError(data.reason || 'Voice chat unavailable');
        }
      } catch (error) {
        console.error('Failed to check capability:', error);
        setCapabilityChecked(true);
        setCapabilityAvailable(false);
        setError('Failed to check voice chat availability');
      }
    };
    
    checkCapability();
  }, []);

  // Create or reuse conversation
  useEffect(() => {
    const getOrCreateConversation = async () => {
      try {
        const response = await apiRequest("POST", "/api/conversations", {
          language,
          difficulty,
        });
        const data = await response.json();
        setConversationId(data.id);
      } catch (error) {
        console.error("Failed to create conversation:", error);
        setError("Failed to create conversation");
      }
    };
    
    getOrCreateConversation();
  }, [language, difficulty]);

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

  const connectToRealtimeAPI = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!conversationId) {
        reject(new Error('No conversation ID'));
        return;
      }

      const CONNECTION_TIMEOUT = 10000; // 10 seconds
      let connectionTimer: NodeJS.Timeout | null = null;

      try {
        // Connect to our backend WebSocket proxy
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/api/realtime/ws?language=${encodeURIComponent(language)}&difficulty=${encodeURIComponent(difficulty)}&conversationId=${encodeURIComponent(conversationId)}`;
        
        const ws = new WebSocket(wsUrl);
        let connectionOpened = false;

        // Set connection timeout
        connectionTimer = setTimeout(() => {
          if (!connectionOpened) {
            ws.close();
            reject(new Error('Connection timeout'));
          }
        }, CONNECTION_TIMEOUT);

        ws.onopen = () => {
          console.log('Connected to Realtime API proxy');
          connectionOpened = true;
          if (connectionTimer) clearTimeout(connectionTimer);
          // Session configuration is handled by the backend proxy
          resolve();
        };

      ws.onmessage = async (event) => {
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
            setTranscript(prev => [...prev, { role: "user", content: userTranscript }]);
            
            // Save to backend
            await apiRequest("POST", `/api/conversations/${conversationId}/messages`, {
              role: "user",
              content: userTranscript,
            });
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
            setError(data.error?.message || 'An error occurred');
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
        } else {
          // Connection was open but closed unexpectedly
          setError('Connection lost. Please try again.');
        }
        
        setIsRecording(false);
        setIsAiSpeaking(false);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect to Realtime API:', error);
      if (connectionTimer) clearTimeout(connectionTimer);
      setError('Failed to connect. The OpenAI Realtime API may not be available.');
      reject(error);
    }
    });
  }, [conversationId, language, difficulty]);

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
    };
  }, [conversationId, capabilityAvailable, connectToRealtimeAPI]);

  // Combine backend messages with live transcript
  const allMessages = [
    ...messages.map(m => ({ role: m.role, content: m.content, saved: true })),
    ...transcript.map(t => ({ ...t, saved: false })),
  ];

  return (
    <Card className="flex flex-col h-[600px]">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Voice Conversation</h2>
            <p className="text-sm text-muted-foreground">Speak with your AI language tutor</p>
          </div>
          <div className="flex items-center gap-2">
            {isRecording && (
              <Badge variant="destructive" className="animate-pulse">
                <Mic className="h-3 w-3 mr-1" />
                Recording
              </Badge>
            )}
            {isAiSpeaking && (
              <Badge variant="default">
                <Volume2 className="h-3 w-3 mr-1 animate-pulse" />
                AI Speaking
              </Badge>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="space-y-4">
          {allMessages.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-full text-center text-muted-foreground p-8">
              <Mic className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Start a voice conversation</p>
              <p className="text-sm">Press the microphone button to start speaking with your AI tutor</p>
            </div>
          ) : (
            <>
              {allMessages.map((message, index) => (
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
                  <div
                    className={`max-w-2xl rounded-2xl p-4 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-base leading-relaxed">{message.content}</p>
                  </div>
                  {message.role === "user" && (
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-secondary">
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              <div ref={scrollRef} />
            </>
          )}
        </div>
      </ScrollArea>

      <div className="p-6 border-t">
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-lg">
            <p className="font-medium mb-2">Voice Chat Unavailable</p>
            <p className="text-sm mb-3">{error}</p>
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-medium">Why is this happening?</p>
              <p>The OpenAI Realtime API requires direct access and is not available through Replit AI Integrations.</p>
              <p className="font-medium mt-3">What can I do?</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Use text-based chat mode (fully functional)</li>
                <li>Provide your own OpenAI API key with Realtime API access</li>
                <li>See docs/voice-chat-setup.md for setup instructions</li>
              </ul>
            </div>
          </div>
        )}
        
        <div className="flex justify-center">
          <Button
            size="lg"
            variant={isRecording ? "destructive" : "default"}
            onClick={toggleRecording}
            disabled={!capabilityAvailable}
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
          {!capabilityChecked 
            ? "Checking voice chat availability..." 
            : !capabilityAvailable
            ? "Voice chat unavailable - see error message above"
            : isRecording 
            ? "Click to stop recording" 
            : "Click to start speaking"}
        </p>
      </div>
    </Card>
  );
}
