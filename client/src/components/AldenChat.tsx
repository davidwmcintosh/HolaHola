import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Loader2,
  Volume2,
  VolumeX,
  Mic,
  Wrench,
  Clock,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AldenMessage {
  id: string;
  role: 'user' | 'alden';
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
  fromHistory?: boolean;
}

interface SessionHistory {
  sessionId: string | null;
  sessionTitle: string | null;
  startedAt: string | null;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
    isSignificant: boolean;
  }>;
}

const WELCOME = "Hey. I'm here whenever you need me — system status, diagnostics, architecture decisions, or just thinking out loud. What's on your mind?";

function formatSessionTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function AldenChat() {
  const [messages, setMessages] = useState<AldenMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackSessionRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  // Load conversation history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch('/api/alden/session', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load session');
        const data: SessionHistory = await res.json();

        if (data.messages.length === 0) {
          setMessages([{
            id: 'initial',
            role: 'alden',
            content: WELCOME,
            timestamp: new Date(),
          }]);
        } else {
          setSessionTitle(data.sessionTitle);
          setSessionStartedAt(data.startedAt);
          const loaded: AldenMessage[] = data.messages.map(m => ({
            id: m.id,
            role: m.role === 'david' ? 'user' : 'alden',
            content: m.content,
            timestamp: new Date(m.createdAt),
            fromHistory: true,
          }));
          setMessages(loaded);
        }
      } catch {
        setMessages([{
          id: 'initial',
          role: 'alden',
          content: WELCOME,
          timestamp: new Date(),
        }]);
      } finally {
        setHistoryLoaded(true);
      }
    }
    loadHistory();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      playbackSessionRef.current++;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const synthesizeAndPlay = useCallback(async (text: string) => {
    if (!audioEnabled) return;

    const mySessionId = ++playbackSessionRef.current;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    try {
      setIsPlaying(true);

      const sentences = text
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 3);

      if (sentences.length === 0) {
        setIsPlaying(false);
        return;
      }

      for (let i = 0; i < sentences.length; i++) {
        if (playbackSessionRef.current !== mySessionId) return;

        try {
          const response = await fetch('/api/alden/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: sentences[i] }),
            credentials: 'include',
          });

          if (playbackSessionRef.current !== mySessionId) return;
          if (!response.ok) continue;

          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);

          await new Promise<void>((resolve) => {
            if (playbackSessionRef.current !== mySessionId) {
              URL.revokeObjectURL(audioUrl);
              resolve();
              return;
            }

            const audio = new Audio(audioUrl);
            audioRef.current = audio;

            const cleanup = () => {
              URL.revokeObjectURL(audioUrl);
              resolve();
            };

            audio.onended = cleanup;
            audio.onerror = cleanup;
            audio.onpause = cleanup;
            audio.play().catch(cleanup);
          });
        } catch {
          continue;
        }
      }

      if (playbackSessionRef.current === mySessionId) {
        setIsPlaying(false);
      }
    } catch {
      if (playbackSessionRef.current === mySessionId) {
        setIsPlaying(false);
      }
    }
  }, [audioEnabled]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: AldenMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const conversationHistory = messages
        .filter(m => m.id !== 'initial')
        .map(m => ({
          role: m.role === 'user' ? 'user' as const : 'model' as const,
          content: m.content,
        }));

      const response = await apiRequest('POST', '/api/alden/message', {
        message: content.trim(),
        conversationHistory,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const aldenMessage: AldenMessage = {
        id: `alden-${Date.now()}`,
        role: 'alden',
        content: data.reply,
        timestamp: new Date(),
        toolsUsed: data.toolsUsed,
      };

      setMessages(prev => [...prev, aldenMessage]);

      if (audioEnabled) {
        synthesizeAndPlay(data.reply);
      }
    } catch (error) {
      console.error('[AldenChat] Error:', error);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Couldn't reach Alden. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, audioEnabled, synthesizeAndPlay, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());

        if (audioChunksRef.current.length === 0) return;

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        setIsLoading(true);
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');

          const sttResponse = await fetch('/api/voice/transcribe', {
            method: 'POST',
            body: formData,
            credentials: 'include',
          });

          if (sttResponse.ok) {
            const { transcript } = await sttResponse.json();
            if (transcript && transcript.trim()) {
              await sendMessage(transcript.trim());
            }
          } else {
            toast({
              variant: "destructive",
              title: "Transcription Error",
              description: "Couldn't transcribe your voice. Please try typing instead.",
            });
          }
        } catch {
          toast({
            variant: "destructive",
            title: "Voice Error",
            description: "Something went wrong with voice input.",
          });
        } finally {
          setIsLoading(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      toast({
        variant: "destructive",
        title: "Microphone Access",
        description: "Please allow microphone access to use voice input.",
      });
    }
  }, [sendMessage, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  const stopAudio = useCallback(() => {
    playbackSessionRef.current++;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const toolLabels: Record<string, string> = {
    get_system_health: 'System Health',
    get_database_stats: 'Database Stats',
    get_user_analytics: 'User Analytics',
    get_voice_session_metrics: 'Voice Metrics',
    get_recent_errors: 'Recent Errors',
    get_sofia_report: 'Sofia Report',
    search_editor_memories: 'Memories',
    post_to_express_lane: 'Express Lane',
  };

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)] max-h-[700px]" data-testid="alden-chat-container">
      <div className="flex items-center gap-3 mb-4 px-1">
        <Avatar className="h-10 w-10 border-2 border-primary/20">
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
            A
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm" data-testid="text-alden-title">Alden</h3>
          {sessionTitle ? (
            <p className="text-xs text-muted-foreground truncate" data-testid="text-alden-session">
              {sessionTitle}
              {sessionStartedAt && (
                <span className="ml-1 opacity-60">· {formatSessionTime(sessionStartedAt)}</span>
              )}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Development Steward</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              if (isPlaying) stopAudio();
              setAudioEnabled(!audioEnabled);
            }}
            data-testid="button-alden-audio-toggle"
          >
            {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
          data-testid="alden-chat-messages"
        >
          {!historyLoaded && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className={`flex gap-3 ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                  {i % 2 === 0 && <Skeleton className="h-8 w-8 rounded-full shrink-0" />}
                  <Skeleton className={`h-14 rounded-md ${i % 2 === 0 ? 'w-2/3' : 'w-1/2'}`} />
                </div>
              ))}
            </div>
          )}

          {historyLoaded && messages.length > 0 && messages[0].fromHistory && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1" data-testid="text-history-divider">
              <div className="flex-1 border-t border-dashed" />
              <Clock className="w-3 h-3 shrink-0" />
              <span className="shrink-0">Earlier today</span>
              <div className="flex-1 border-t border-dashed" />
            </div>
          )}

          {historyLoaded && messages.map((msg, idx) => {
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const showNowDivider = prevMsg?.fromHistory && !msg.fromHistory;
            return (
              <div key={msg.id}>
                {showNowDivider && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-1" data-testid="text-now-divider">
                    <div className="flex-1 border-t" />
                    <span className="shrink-0">Now</span>
                    <div className="flex-1 border-t" />
                  </div>
                )}
                <div
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  data-testid={`message-${msg.role}-${msg.id}`}
                >
                  {msg.role === 'alden' && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                        A
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`max-w-[80%] space-y-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`rounded-md px-3 py-2 text-sm whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : msg.fromHistory
                          ? 'bg-muted/60 text-foreground/80'
                          : 'bg-muted'
                      }`}
                    >
                      {msg.content}
                    </div>
                    {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Wrench className="h-3 w-3 text-muted-foreground mt-0.5" />
                        {[...new Set(msg.toolsUsed)].map((tool, toolIdx) => (
                          <Badge
                            key={toolIdx}
                            variant="outline"
                            className="text-[10px] px-1.5 py-0"
                            data-testid={`badge-tool-${tool}`}
                          >
                            {toolLabels[tool] || tool}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-accent text-accent-foreground text-xs font-bold">
                        D
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 items-center" data-testid="alden-thinking">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  A
                </AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Investigating...</span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t p-3 flex items-end gap-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Talk to Alden..."
            className="flex-1 min-h-[40px] max-h-[120px] resize-none text-sm"
            disabled={isLoading || !historyLoaded}
            data-testid="input-alden-message"
          />
          <div className="flex flex-col gap-1">
            <Button
              size="icon"
              variant={isRecording ? "destructive" : "ghost"}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading || !historyLoaded}
              title={isRecording ? "Stop recording" : "Start voice input"}
              data-testid="button-alden-voice"
            >
              <Mic className={`h-4 w-4 ${isRecording ? "animate-pulse" : ""}`} />
            </Button>
            <Button
              size="icon"
              onClick={() => sendMessage(inputValue)}
              disabled={!inputValue.trim() || isLoading || !historyLoaded}
              data-testid="button-alden-send"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </Card>

      {isRecording && (
        <div className="flex items-center justify-center gap-2 mt-2 text-xs text-destructive">
          <span className="inline-block h-2 w-2 rounded-full bg-destructive animate-pulse" />
          <span>Listening... click the mic to send</span>
        </div>
      )}

      {isPlaying && !isRecording && (
        <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground">
          <Volume2 className="h-3 w-3 animate-pulse" />
          <span>Alden is speaking...</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs"
            onClick={stopAudio}
            data-testid="button-alden-stop-audio"
          >
            Stop
          </Button>
        </div>
      )}
    </div>
  );
}
