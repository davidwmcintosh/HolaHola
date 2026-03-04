import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Users, Send, Plus, BrainCircuit, Radio, Code, X, ChevronDown,
  GraduationCap, Shield, Mic, MicOff, Volume2, FileText,
  Table, Lightbulb, CheckSquare, GitBranch, Info,
} from "lucide-react";
import type { TeamRoom as TeamRoomType, RoomVoiceMessage, RoomArtifact } from "@shared/schema";

// ── Participant config ────────────────────────────────────────────────────────

type ParticipantId = "david" | "alden" | "daniela" | "sofia";

const PARTICIPANTS: Record<ParticipantId, {
  id: ParticipantId;
  name: string;
  role: string;
  Icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  david: {
    id: "david", name: "David", role: "Founder",
    Icon: Code, color: "text-amber-500",
    bgColor: "bg-amber-500/10", borderColor: "border-amber-500/20",
  },
  alden: {
    id: "alden", name: "Alden", role: "Dev Steward",
    Icon: BrainCircuit, color: "text-blue-500",
    bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20",
  },
  daniela: {
    id: "daniela", name: "Daniela", role: "Curriculum Advisor",
    Icon: GraduationCap, color: "text-purple-500",
    bgColor: "bg-purple-500/10", borderColor: "border-purple-500/20",
  },
  sofia: {
    id: "sofia", name: "Sofia", role: "Tech Health",
    Icon: Shield, color: "text-emerald-500",
    bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/20",
  },
};

function getParticipantConfig(speakerName: string) {
  const key = speakerName.toLowerCase() as ParticipantId;
  return PARTICIPANTS[key] ?? PARTICIPANTS.alden;
}

// ── Artifact rendering ────────────────────────────────────────────────────────

const ARTIFACT_ICONS: Record<string, React.ElementType> = {
  plan: GitBranch, table: Table, code: Code,
  insight: Lightbulb, decision: CheckSquare, default: FileText,
};

function ArtifactCard({ artifact }: { artifact: RoomArtifact }) {
  const [expanded, setExpanded] = useState(true);
  const ArtifactIcon = ARTIFACT_ICONS[artifact.artifactType] ?? ARTIFACT_ICONS.default;
  const creator = getParticipantConfig(artifact.createdBy);
  const CreatorIcon = creator.Icon;

  const renderContent = () => {
    const c = artifact.content as Record<string, unknown>;
    if (artifact.artifactType === "table" && c.headers && c.rows) {
      const headers = c.headers as string[];
      const rows = c.rows as string[][];
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                {headers.map((h, i) => <th key={i} className="text-left py-1 px-2 font-medium text-muted-foreground">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border/50 last:border-0">
                  {row.map((cell, ci) => <td key={ci} className="py-1 px-2">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (artifact.artifactType === "plan" && c.steps) {
      const steps = c.steps as Array<{ step?: string; description?: string } | string>;
      return (
        <ol className="space-y-1">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-2 text-xs">
              <span className="shrink-0 font-mono text-muted-foreground w-4">{i + 1}.</span>
              <span>{typeof s === "string" ? s : (s.step || s.description || JSON.stringify(s))}</span>
            </li>
          ))}
        </ol>
      );
    }
    if (artifact.artifactType === "code" && c.code) {
      return (
        <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/50 rounded p-2 overflow-x-auto">
          {String(c.code)}
        </pre>
      );
    }
    if (artifact.artifactType === "decision") {
      return (
        <div className="space-y-1 text-xs">
          {c.decision && <p className="font-medium">{String(c.decision)}</p>}
          {c.rationale && <p className="text-muted-foreground">{String(c.rationale)}</p>}
          {c.impact && <p className="text-amber-600 dark:text-amber-400">Impact: {String(c.impact)}</p>}
        </div>
      );
    }
    return (
      <div className="text-xs whitespace-pre-wrap">
        {typeof c === "object" ? JSON.stringify(c, null, 2) : String(c)}
      </div>
    );
  };

  return (
    <Card className={`${creator.bgColor} ${creator.borderColor} border`} data-testid={`artifact-${artifact.id}`}>
      <CardHeader className="p-2.5">
        <div className="flex items-center gap-2">
          <ArtifactIcon className={`h-3.5 w-3.5 ${creator.color} shrink-0`} />
          <span className="text-xs font-medium flex-1 truncate">{artifact.title}</span>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="outline" className="text-xs py-0 h-4 capitalize">{artifact.artifactType}</Badge>
            <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
              <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "" : "-rotate-90"}`} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <CreatorIcon className={`h-2.5 w-2.5 ${creator.color}`} />
          <span className="text-xs text-muted-foreground">{creator.name}</span>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="p-2.5 pt-0">
          {renderContent()}
        </CardContent>
      )}
    </Card>
  );
}

// ── Express Lane message ──────────────────────────────────────────────────────

function ExpressLaneMessage({ participant, content, time }: { participant: string; content: string; time: string }) {
  const p = getParticipantConfig(participant);
  const Icon = p.Icon;
  return (
    <div className="space-y-1" data-testid="express-lane-message">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3 w-3 ${p.color}`} />
        <span className={`text-xs font-medium ${p.color}`}>{p.name}</span>
        <span className="text-xs text-muted-foreground">{time}</span>
      </div>
      <div className={`text-xs ${p.bgColor} ${p.borderColor} border rounded-md p-2 whitespace-pre-wrap leading-relaxed`}>
        {content}
      </div>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message, onPlayVoice }: {
  message: RoomVoiceMessage;
  onPlayVoice?: (text: string, speaker: string) => void;
}) {
  const p = getParticipantConfig(message.speaker);
  const isDavid = message.speaker.toLowerCase() === "david";
  const Icon = p.Icon;
  const time = new Date(message.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`flex flex-col gap-1 ${isDavid ? "items-end" : "items-start"}`} data-testid={`message-${message.id}`}>
      <div className={`flex items-center gap-1.5 ${isDavid ? "flex-row-reverse" : ""}`}>
        <Icon className={`h-3.5 w-3.5 ${p.color}`} />
        <span className={`text-xs font-medium ${p.color}`}>{p.name}</span>
        <span className="text-xs text-muted-foreground">{time}</span>
        {!isDavid && onPlayVoice && (
          <button
            onClick={() => onPlayVoice(message.content, message.speaker)}
            className="text-muted-foreground hover:text-foreground"
            title={`Play ${p.name}'s voice`}
            data-testid={`button-play-voice-${message.id}`}
          >
            <Volume2 className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${
        isDavid
          ? "bg-primary text-primary-foreground"
          : `${p.bgColor} ${p.borderColor} border text-foreground`
      }`}>
        {message.content}
      </div>
    </div>
  );
}

// ── Participant card (left panel) ─────────────────────────────────────────────

function ParticipantCard({ participantId, isActive, isThinking }: {
  participantId: ParticipantId;
  isActive: boolean;
  isThinking: boolean;
}) {
  const p = PARTICIPANTS[participantId];
  const Icon = p.Icon;
  return (
    <div className={`flex items-center gap-2 p-2 rounded-md ${isActive ? "bg-muted" : ""}`} data-testid={`participant-${p.id}`}>
      <div className="relative">
        <Icon className={`h-5 w-5 ${p.color}`} />
        {isActive && !isThinking && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 ring-1 ring-background" />
        )}
        {isThinking && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400 ring-1 ring-background animate-pulse" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-none">{p.name}</p>
        <p className="text-xs text-muted-foreground">{p.role}</p>
      </div>
      {isThinking && <span className="text-xs text-amber-500">thinking</span>}
    </div>
  );
}

// ── PTT voice hook ────────────────────────────────────────────────────────────

function usePTT(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognition.onresult = (e: SpeechRecognitionEvent) => {
        const transcript = Array.from(e.results)
          .map(r => r[0].transcript)
          .join(" ")
          .trim();
        if (transcript) onTranscript(transcript);
      };
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, [onTranscript]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch { setIsListening(false); }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;
    recognitionRef.current.stop();
    setIsListening(false);
  }, [isListening]);

  return { isListening, isSupported, startListening, stopListening };
}

// ── Voice playback helper ─────────────────────────────────────────────────────

async function playParticipantVoice(text: string, speaker: string) {
  try {
    const res = await fetch("/api/team-room/voice/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, speaker }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
  } catch { /* voice unavailable — silent fail */ }
}

// ── Session data types ────────────────────────────────────────────────────────

interface SessionData {
  room: TeamRoomType;
  messages: RoomVoiceMessage[];
  handRaises: any[];
  artifacts: RoomArtifact[];
}

interface ExpressItem {
  participant: string;
  content: string;
  time: string;
}

interface SessionSummary {
  summary: string;
  keyDecisions?: string[];
  actionItems?: string[];
  momentum?: string;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TeamRoom() {
  const queryClient = useQueryClient();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [expressLaneItems, setExpressLaneItems] = useState<ExpressItem[]>([]);
  const [sessionArtifacts, setSessionArtifacts] = useState<RoomArtifact[]>([]);
  const [showPastSessions, setShowPastSessions] = useState(false);
  const [thinkingParticipants, setThinkingParticipants] = useState<Set<ParticipantId>>(new Set());
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const expressEndRef = useRef<HTMLDivElement>(null);

  const handleVoiceTranscript = useCallback((text: string) => {
    setMessageInput(text);
  }, []);

  const { isListening, isSupported, startListening, stopListening } = usePTT(handleVoiceTranscript);

  const { data: sessions } = useQuery<TeamRoomType[]>({
    queryKey: ["/api/team-room/sessions"],
  });

  const { data: sessionData } = useQuery<SessionData>({
    queryKey: ["/api/team-room/sessions", activeSessionId],
    enabled: !!activeSessionId,
    refetchInterval: 8000,
  });

  // Load cross-session summary when session loads
  useEffect(() => {
    if (!sessionData?.room) return;
    const summary = (sessionData as any).summary;
    if (summary) setSessionSummary(summary);
  }, [sessionData]);

  const createSession = useMutation({
    mutationFn: (topic: string) => apiRequest("POST", "/api/team-room/sessions", { topic }),
    onSuccess: async (res) => {
      const room = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/team-room/sessions"] });
      setActiveSessionId(room.id);
      setNewTopic("");
      setExpressLaneItems([]);
      setSessionArtifacts([]);
      setSessionSummary(null);
    },
  });

  const postMessage = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/team-room/sessions/${activeSessionId}/messages`, { content, speaker: "David" }),
    onMutate: () => {
      setThinkingParticipants(new Set(["alden", "daniela", "sofia"] as ParticipantId[]));
    },
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/team-room/sessions", activeSessionId] });
      const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

      if (data.expressLaneItems?.length) {
        const newItems: ExpressItem[] = data.expressLaneItems.map((item: any) => ({
          participant: item.participant,
          content: item.content,
          time,
        }));
        setExpressLaneItems(prev => [...prev, ...newItems]);
      }

      if (data.artifacts?.length) {
        setSessionArtifacts(prev => [...prev, ...data.artifacts]);
      }

      // Auto-play the first AI voice response
      const firstAIMessage = data.aiMessages?.[0];
      if (firstAIMessage) {
        playParticipantVoice(firstAIMessage.content, firstAIMessage.speaker);
      }

      setMessageInput("");
      setThinkingParticipants(new Set());
    },
    onError: () => setThinkingParticipants(new Set()),
  });

  const closeSession = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/team-room/sessions/${activeSessionId}/close`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-room/sessions"] });
      setActiveSessionId(null);
      setExpressLaneItems([]);
      setSessionArtifacts([]);
      setSessionSummary(null);
      setThinkingParticipants(new Set());
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessionData?.messages, thinkingParticipants]);

  useEffect(() => {
    expressEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [expressLaneItems, sessionArtifacts]);

  const handleSend = () => {
    if (!messageInput.trim() || postMessage.isPending) return;
    postMessage.mutate(messageInput.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeSessions = sessions?.filter(s => s.status === "active") ?? [];
  const pastSessions = sessions?.filter(s => s.status === "closed") ?? [];
  const isActive = sessionData?.room?.status === "active";
  const allMessages = sessionData?.messages ?? [];

  // Merge artifacts from session data + locally captured
  const displayArtifacts = [
    ...(sessionData?.artifacts ?? []),
    ...sessionArtifacts.filter(a => !sessionData?.artifacts?.some((sa: RoomArtifact) => sa.id === a.id)),
  ];

  const hasExpressContent = expressLaneItems.length > 0 || displayArtifacts.length > 0;

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* ── Left Panel: Participants ── */}
      <div className="w-52 flex-none border-r flex flex-col">
        <div className="p-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Participants</span>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            <div className="space-y-1">
              {(Object.keys(PARTICIPANTS) as ParticipantId[]).map(id => (
                <ParticipantCard
                  key={id}
                  participantId={id}
                  isActive={!!activeSessionId}
                  isThinking={thinkingParticipants.has(id)}
                />
              ))}
            </div>

            {activeSessions.length > 0 && !activeSessionId && (
              <>
                <Separator className="my-3" />
                <p className="text-xs text-muted-foreground px-2 mb-2">Active sessions</p>
                <div className="space-y-1">
                  {activeSessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { setActiveSessionId(s.id); setExpressLaneItems([]); setSessionArtifacts([]); }}
                      className="w-full text-left px-2 py-1.5 text-xs rounded-md hover-elevate truncate"
                      data-testid={`session-${s.id}`}
                    >
                      {s.topic}
                    </button>
                  ))}
                </div>
              </>
            )}

            {pastSessions.length > 0 && (
              <>
                <Separator className="my-3" />
                <button
                  onClick={() => setShowPastSessions(!showPastSessions)}
                  className="flex items-center gap-1 text-xs text-muted-foreground px-2 w-full"
                  data-testid="button-toggle-past-sessions"
                >
                  <ChevronDown className={`h-3 w-3 transition-transform ${showPastSessions ? "" : "-rotate-90"}`} />
                  Past ({pastSessions.length})
                </button>
                {showPastSessions && (
                  <div className="mt-1 space-y-1">
                    {pastSessions.slice(0, 10).map(s => (
                      <button
                        key={s.id}
                        onClick={() => { setActiveSessionId(s.id); setExpressLaneItems([]); setSessionArtifacts([]); }}
                        className="w-full text-left px-2 py-1.5 text-xs rounded-md text-muted-foreground hover-elevate truncate"
                        data-testid={`past-session-${s.id}`}
                      >
                        {s.topic}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ── Center Panel: Discussion ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeSessionId ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Room
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Start a session to collaborate with the full team — Alden, Daniela, and Sofia.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Session topic (e.g. Gene's Progress Review)"
                  value={newTopic}
                  onChange={e => setNewTopic(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && newTopic.trim() && createSession.mutate(newTopic.trim())}
                  data-testid="input-session-topic"
                />
                <Button
                  onClick={() => createSession.mutate(newTopic.trim())}
                  disabled={!newTopic.trim() || createSession.isPending}
                  className="w-full"
                  data-testid="button-start-session"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {createSession.isPending ? "Starting..." : "Start Session"}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            {/* Session header */}
            <div className="px-4 py-2.5 border-b flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-sm truncate">{sessionData?.room?.topic ?? "Loading..."}</span>
                <Badge variant="outline" className="text-xs shrink-0">
                  {isActive ? "Live" : "Closed"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => closeSession.mutate()}
                    disabled={closeSession.isPending}
                    data-testid="button-close-session"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    {closeSession.isPending ? "Closing..." : "End Session"}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setActiveSessionId(null); setExpressLaneItems([]); setSessionArtifacts([]); setSessionSummary(null); }}
                  data-testid="button-leave-room"
                >
                  Leave
                </Button>
              </div>
            </div>

            {/* Cross-session summary banner */}
            {sessionSummary && (
              <div className="mx-4 mt-3 p-3 rounded-md bg-muted/60 border border-border text-xs space-y-1" data-testid="session-summary-banner">
                <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                  <Info className="h-3.5 w-3.5" />
                  Previously in this room
                </div>
                <p>{sessionSummary.summary}</p>
                {sessionSummary.momentum && (
                  <p className="text-muted-foreground italic">{sessionSummary.momentum}</p>
                )}
              </div>
            )}

            {/* Message thread */}
            <ScrollArea className="flex-1 px-4 py-3">
              <div className="space-y-4">
                {allMessages.length === 0 && !thinkingParticipants.size && (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    Say something — Alden, Daniela, and Sofia will respond when they have something to contribute.
                  </div>
                )}
                {allMessages.map(msg => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    onPlayVoice={isActive ? playParticipantVoice : undefined}
                  />
                ))}
                {thinkingParticipants.size > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex gap-0.5">
                      {["", "", ""].map((_, i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce"
                          style={{ animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                    </div>
                    <span>Team is thinking...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input area */}
            {isActive && (
              <div className="p-3 border-t flex gap-2 shrink-0">
                {isSupported && (
                  <Button
                    variant={isListening ? "default" : "outline"}
                    size="default"
                    onMouseDown={startListening}
                    onMouseUp={stopListening}
                    onTouchStart={startListening}
                    onTouchEnd={stopListening}
                    disabled={postMessage.isPending}
                    className={isListening ? "bg-red-500 hover:bg-red-500 border-red-500" : ""}
                    data-testid="button-ptt"
                    title="Hold to talk"
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                )}
                <Input
                  placeholder="Say something to the team..."
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={postMessage.isPending}
                  data-testid="input-message"
                  className="flex-1"
                />
                <Button
                  onClick={handleSend}
                  disabled={!messageInput.trim() || postMessage.isPending}
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Right Panel: Express Lane ── */}
      <div className="w-80 flex-none border-l flex flex-col">
        <div className="p-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-semibold">Express Lane</span>
            {hasExpressContent && (
              <Badge variant="outline" className="ml-auto text-xs">
                {expressLaneItems.length + displayArtifacts.length}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Analysis, artifacts & insights</p>
        </div>
        <ScrollArea className="flex-1 p-3">
          {!hasExpressContent ? (
            <div className="text-center py-10 text-xs text-muted-foreground px-3">
              Detailed analysis and shared artifacts from the team will appear here during the session.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Artifacts first (pinned at top) */}
              {displayArtifacts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Artifacts</p>
                  {displayArtifacts.map(a => (
                    <ArtifactCard key={a.id} artifact={a} />
                  ))}
                </div>
              )}

              {/* Express lane analysis stream */}
              {expressLaneItems.length > 0 && (
                <div className="space-y-3">
                  {displayArtifacts.length > 0 && <Separator />}
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Analysis Stream</p>
                  {expressLaneItems.map((item, i) => (
                    <ExpressLaneMessage key={i} {...item} />
                  ))}
                </div>
              )}
              <div ref={expressEndRef} />
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
