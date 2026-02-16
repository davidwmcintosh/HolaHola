import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Loader2,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Wrench,
  Phone,
  PhoneOff,
  Users,
  AtSign,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useFounderCollab, type ConnectionState } from "@/hooks/useFounderCollab";
import type { CollaborationMessage } from "@shared/schema";

const AGENT_CONFIG: Record<string, { label: string; initials: string; color: string; darkColor: string }> = {
  founder: { label: "David", initials: "D", color: "bg-blue-500/10 text-blue-600", darkColor: "bg-blue-500/20 text-blue-400" },
  daniela: { label: "Daniela", initials: "Da", color: "bg-purple-500/10 text-purple-600", darkColor: "bg-purple-500/20 text-purple-400" },
  wren: { label: "Wren", initials: "W", color: "bg-emerald-500/10 text-emerald-600", darkColor: "bg-emerald-500/20 text-emerald-400" },
  editor: { label: "Alden", initials: "A", color: "bg-primary/10 text-primary", darkColor: "bg-primary/20 text-primary" },
  system: { label: "System", initials: "S", color: "bg-muted text-muted-foreground", darkColor: "bg-muted text-muted-foreground" },
};

function getAgentConfig(role: string) {
  return AGENT_CONFIG[role] || AGENT_CONFIG.system;
}

const toolLabels: Record<string, string> = {
  get_system_health: "System Health",
  get_database_stats: "Database Stats",
  get_user_analytics: "User Analytics",
  get_voice_session_metrics: "Voice Metrics",
  get_recent_errors: "Recent Errors",
  get_sofia_report: "Sofia Report",
  search_editor_memories: "Memories",
  post_to_express_lane: "Express Lane",
};

function ConnectionBadge({ state }: { state: ConnectionState }) {
  const config: Record<ConnectionState, { label: string; variant: "default" | "outline" | "secondary" | "destructive" }> = {
    connected: { label: "Connected", variant: "outline" },
    connecting: { label: "Connecting...", variant: "secondary" },
    reconnecting: { label: "Reconnecting...", variant: "secondary" },
    disconnected: { label: "Disconnected", variant: "destructive" },
    error: { label: "Error", variant: "destructive" },
  };
  const c = config[state];
  return <Badge variant={c.variant} className="text-[10px]" data-testid="badge-connection-state">{c.label}</Badge>;
}

export function ConferenceCall() {
  const founderCollab = useFounderCollab();
  const [inputValue, setInputValue] = useState("");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingAgent, setPlayingAgent] = useState<string | null>(null);
  const [mentionPrefix, setMentionPrefix] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackSessionRef = useRef<number>(0);
  const audioQueueRef = useRef<Array<{ text: string; agent: string }>>([]);
  const isProcessingQueueRef = useRef(false);
  const lastProcessedCursorRef = useRef<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    founderCollab.connect();
    return () => {
      founderCollab.disconnect();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      if (isNearBottom) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [founderCollab.state.messages]);

  const synthesizeAndPlay = useCallback(async (text: string, agent: string) => {
    if (!audioEnabled) return;
    const mySessionId = ++playbackSessionRef.current;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    try {
      setIsPlaying(true);
      setPlayingAgent(agent);
      const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 3);
      if (sentences.length === 0) { setIsPlaying(false); setPlayingAgent(null); return; }

      for (let i = 0; i < sentences.length; i++) {
        if (playbackSessionRef.current !== mySessionId) return;
        try {
          const response = await fetch("/api/conference/synthesize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: sentences[i], agent }),
            credentials: "include",
          });
          if (playbackSessionRef.current !== mySessionId) return;
          if (!response.ok) {
            if (response.status === 403) { setIsPlaying(false); setPlayingAgent(null); return; }
            continue;
          }
          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          await new Promise<void>((resolve) => {
            if (playbackSessionRef.current !== mySessionId) { URL.revokeObjectURL(audioUrl); resolve(); return; }
            const audio = new Audio(audioUrl);
            audioRef.current = audio;
            const cleanup = () => { URL.revokeObjectURL(audioUrl); resolve(); };
            audio.onended = cleanup;
            audio.onerror = cleanup;
            audio.onpause = cleanup;
            audio.play().catch(cleanup);
          });
        } catch { continue; }
      }
      if (playbackSessionRef.current === mySessionId) { setIsPlaying(false); setPlayingAgent(null); }
    } catch {
      if (playbackSessionRef.current === mySessionId) { setIsPlaying(false); setPlayingAgent(null); }
    }
  }, [audioEnabled]);

  const processAudioQueue = useCallback(async () => {
    if (isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;
    while (audioQueueRef.current.length > 0) {
      const item = audioQueueRef.current.shift()!;
      await synthesizeAndPlay(item.text, item.agent);
    }
    isProcessingQueueRef.current = false;
  }, [synthesizeAndPlay]);

  useEffect(() => {
    if (!audioEnabled) return;
    const msgs = founderCollab.state.messages;
    if (msgs.length === 0) return;
    let enqueued = false;
    for (const msg of msgs) {
      if (msg.role === "founder" || msg.role === "system") continue;
      if (lastProcessedCursorRef.current && msg.cursor <= lastProcessedCursorRef.current) continue;
      lastProcessedCursorRef.current = msg.cursor;
      audioQueueRef.current.push({ text: msg.content, agent: msg.role });
      enqueued = true;
    }
    if (enqueued) processAudioQueue();
  }, [founderCollab.state.messages, audioEnabled, processAudioQueue]);

  const sendMessage = useCallback((content: string) => {
    if (!content.trim()) return;
    if (founderCollab.state.connectionState !== "connected") {
      toast({ variant: "destructive", title: "Not Connected", description: "Waiting for connection to the conference channel." });
      return;
    }
    founderCollab.sendMessage("founder", content.trim());
    setInputValue("");
    setMentionPrefix("");
  }, [founderCollab, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const addMention = (agent: string) => {
    const mention = `@${agent} `;
    setInputValue(prev => {
      if (prev.includes(`@${agent}`)) return prev;
      return mention + prev;
    });
    setMentionPrefix(agent);
  };

  const stopAudio = useCallback(() => {
    playbackSessionRef.current++;
    audioQueueRef.current = [];
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setPlayingAgent(null);
  }, []);

  const handleVoiceToggle = useCallback(async () => {
    if (founderCollab.voiceState.isRecording) {
      founderCollab.stopVoiceRecording();
    } else {
      try {
        await founderCollab.startVoiceRecording();
      } catch {
        toast({ variant: "destructive", title: "Microphone Access", description: "Please allow microphone access to use voice input." });
      }
    }
  }, [founderCollab, toast]);

  const messages = founderCollab.state.messages;
  const isConnected = founderCollab.isConnected;

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]" data-testid="conference-call-container">
      <div className="flex items-center justify-between gap-3 mb-3 px-1 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm" data-testid="text-conference-title">Conference</h3>
          </div>
          <ConnectionBadge state={founderCollab.state.connectionState} />
        </div>
        <div className="flex items-center gap-1">
          <div className="flex -space-x-1.5">
            {["daniela", "wren", "editor"].map(role => {
              const cfg = getAgentConfig(role);
              return (
                <Avatar key={role} className="h-6 w-6 border-2 border-background">
                  <AvatarFallback className={`${cfg.color} text-[9px] font-bold`}>{cfg.initials}</AvatarFallback>
                </Avatar>
              );
            })}
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => { if (isPlaying) stopAudio(); setAudioEnabled(!audioEnabled); }}
            data-testid="button-conference-audio-toggle"
          >
            {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="conference-messages">
          {messages.length === 0 && isConnected && (
            <div className="text-center text-sm text-muted-foreground py-8" data-testid="text-conference-empty">
              Conference channel active. Speak or type to begin.
            </div>
          )}
          {messages.map((msg) => {
            const cfg = getAgentConfig(msg.role);
            const isFounder = msg.role === "founder";
            const meta = msg.metadata as Record<string, any> | null;
            const msgToolsUsed = meta?.toolsUsed as string[] | undefined;
            return (
              <div
                key={msg.cursor || msg.id}
                className={`flex gap-2.5 ${isFounder ? "justify-end" : "justify-start"}`}
                data-testid={`message-${msg.role}-${msg.id}`}
              >
                {!isFounder && (
                  <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
                    <AvatarFallback className={`${cfg.color} text-[9px] font-bold`}>{cfg.initials}</AvatarFallback>
                  </Avatar>
                )}
                <div className={`max-w-[80%] space-y-1 ${isFounder ? "items-end" : "items-start"}`}>
                  {!isFounder && (
                    <span className="text-[11px] font-medium text-muted-foreground ml-1">{cfg.label}</span>
                  )}
                  <div
                    className={`rounded-md px-3 py-2 text-sm whitespace-pre-wrap ${
                      isFounder ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msgToolsUsed && msgToolsUsed.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Wrench className="h-3 w-3 text-muted-foreground mt-0.5" />
                      {[...new Set(msgToolsUsed)].map((tool, idx) => (
                        <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0" data-testid={`badge-tool-${tool}`}>
                          {toolLabels[tool] || tool}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {isPlaying && playingAgent === msg.role && msg.cursor === lastProcessedCursorRef.current && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Volume2 className="h-3 w-3 animate-pulse" />
                      <span>Speaking...</span>
                    </div>
                  )}
                </div>
                {isFounder && (
                  <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
                    <AvatarFallback className={`${cfg.color} text-[9px] font-bold`}>{cfg.initials}</AvatarFallback>
                  </Avatar>
                )}
              </div>
            );
          })}

          {founderCollab.voiceState.currentTranscript && (
            <div className="flex gap-2.5 justify-end" data-testid="conference-voice-transcript">
              <div className="max-w-[80%]">
                <div className="rounded-md px-3 py-2 text-sm bg-primary/50 text-primary-foreground italic">
                  {founderCollab.voiceState.currentTranscript}
                </div>
              </div>
              <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
                <AvatarFallback className="bg-blue-500/10 text-blue-600 text-[9px] font-bold">D</AvatarFallback>
              </Avatar>
            </div>
          )}
        </div>

        <div className="border-t p-3 space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
            {["daniela", "wren", "alden", "team"].map(target => (
              <Button
                key={target}
                size="sm"
                variant={mentionPrefix === target ? "default" : "outline"}
                className="h-6 text-[11px] px-2"
                onClick={() => addMention(target)}
                data-testid={`button-mention-${target}`}
              >
                @{target}
              </Button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Talk to the team..."
              className="flex-1 min-h-[40px] max-h-[120px] resize-none text-sm"
              disabled={!isConnected}
              data-testid="input-conference-message"
            />
            <div className="flex flex-col gap-1">
              <Button
                size="icon"
                variant={founderCollab.voiceState.isRecording ? "destructive" : "ghost"}
                onClick={handleVoiceToggle}
                disabled={!isConnected}
                data-testid="button-conference-voice"
              >
                {founderCollab.voiceState.isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                onClick={() => sendMessage(inputValue)}
                disabled={!inputValue.trim() || !isConnected}
                data-testid="button-conference-send"
              >
                {founderCollab.voiceState.processingStatus === "thinking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {isPlaying && (
        <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground">
          <Volume2 className="h-3 w-3 animate-pulse" />
          <span>{playingAgent ? `${getAgentConfig(playingAgent).label} is speaking...` : "Speaking..."}</span>
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={stopAudio} data-testid="button-conference-stop-audio">
            Stop
          </Button>
        </div>
      )}
    </div>
  );
}
