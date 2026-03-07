import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Send, Plus, BrainCircuit, Radio, Code, X, ChevronDown,
  GraduationCap, Shield, Mic, MicOff, Volume2, FileText,
  Table, Lightbulb, CheckSquare, GitBranch, Info, Copy,
  Target, ClipboardList, AtSign, Hand, UserPlus, UserMinus,
  BookOpen, TrendingUp, Cpu, Circle, RotateCcw,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import type { TeamRoom as TeamRoomType, RoomVoiceMessage, RoomArtifact } from "@shared/schema";

// ── Participant config ────────────────────────────────────────────────────────

type CoreParticipantId = "david" | "alden" | "daniela" | "sofia" | "lyra" | "wren";

interface ParticipantConfig {
  id: string;
  name: string;
  role: string;
  Icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  isGuest?: boolean;
}

const CORE_PARTICIPANTS: Record<CoreParticipantId, ParticipantConfig> = {
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
  lyra: {
    id: "lyra", name: "Lyra", role: "Learning Analyst",
    Icon: TrendingUp, color: "text-pink-500",
    bgColor: "bg-pink-500/10", borderColor: "border-pink-500/20",
  },
  wren: {
    id: "wren", name: "Wren", role: "Architect",
    Icon: Cpu, color: "text-sky-500",
    bgColor: "bg-sky-500/10", borderColor: "border-sky-500/20",
  },
};

const GUEST_COLORS = [
  { color: "text-rose-500", bgColor: "bg-rose-500/10", borderColor: "border-rose-500/20" },
  { color: "text-cyan-500", bgColor: "bg-cyan-500/10", borderColor: "border-cyan-500/20" },
  { color: "text-orange-500", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/20" },
  { color: "text-pink-500", bgColor: "bg-pink-500/10", borderColor: "border-pink-500/20" },
  { color: "text-teal-500", bgColor: "bg-teal-500/10", borderColor: "border-teal-500/20" },
  { color: "text-indigo-500", bgColor: "bg-indigo-500/10", borderColor: "border-indigo-500/20" },
];

function getParticipantConfig(speakerName: string, guestTutors: GuestTutorInfo[] = []): ParticipantConfig {
  const key = speakerName.toLowerCase() as CoreParticipantId;
  if (CORE_PARTICIPANTS[key]) return CORE_PARTICIPANTS[key];
  if (speakerName.toLowerCase() === "system") {
    return { id: "system", name: "System", role: "", Icon: Info, color: "text-muted-foreground", bgColor: "bg-muted/50", borderColor: "border-border" };
  }
  const guestIdx = guestTutors.findIndex(g => g.tutorName.toLowerCase() === speakerName.toLowerCase());
  const colorSet = GUEST_COLORS[Math.max(0, guestIdx) % GUEST_COLORS.length];
  const guest = guestTutors.find(g => g.tutorName.toLowerCase() === speakerName.toLowerCase());
  return {
    id: speakerName.toLowerCase(), name: speakerName, role: guest ? `${guest.language} Tutor (Guest)` : "Guest",
    Icon: BookOpen, isGuest: true, ...colorSet,
  };
}

// ── Template icons ────────────────────────────────────────────────────────────

const TEMPLATE_ICONS: Record<string, React.ElementType> = {
  "graduation-cap": GraduationCap, "git-branch": GitBranch, "clipboard-list": ClipboardList,
  "radio": Radio, "target": Target, "shield": Shield,
};

// ── Artifact rendering ────────────────────────────────────────────────────────

const ARTIFACT_ICONS: Record<string, React.ElementType> = {
  plan: GitBranch, table: Table, code: Code, insight: Lightbulb, decision: CheckSquare, default: FileText,
};

function ArtifactCard({ artifact, guestTutors }: { artifact: RoomArtifact; guestTutors: GuestTutorInfo[] }) {
  const [expanded, setExpanded] = useState(true);
  const { toast } = useToast();
  const ArtifactIcon = ARTIFACT_ICONS[artifact.artifactType] ?? ARTIFACT_ICONS.default;
  const creator = getParticipantConfig(artifact.createdBy, guestTutors);

  const handleCopy = () => {
    const c = artifact.content as Record<string, unknown>;
    navigator.clipboard.writeText(JSON.stringify(c, null, 2));
    toast({ title: "Copied to clipboard" });
  };

  const renderContent = () => {
    const c = artifact.content as Record<string, unknown>;
    if (artifact.artifactType === "table" && c.headers && c.rows) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                {(c.headers as string[]).map((h, i) => <th key={i} className="text-left py-1 px-2 font-medium text-muted-foreground">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(c.rows as string[][]).map((row, ri) => (
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
      return (
        <ol className="space-y-1">
          {(c.steps as Array<{ step?: string; description?: string } | string>).map((s, i) => (
            <li key={i} className="flex gap-2 text-xs">
              <span className="shrink-0 font-mono text-muted-foreground w-4">{i + 1}.</span>
              <span>{typeof s === "string" ? s : (s.step || s.description || JSON.stringify(s))}</span>
            </li>
          ))}
        </ol>
      );
    }
    if (artifact.artifactType === "code" && c.code) {
      return <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/50 rounded p-2 overflow-x-auto">{String(c.code)}</pre>;
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
    return <div className="text-xs whitespace-pre-wrap">{typeof c === "object" ? JSON.stringify(c, null, 2) : String(c)}</div>;
  };

  return (
    <Card className={`${creator.bgColor} ${creator.borderColor} border`} data-testid={`artifact-${artifact.id}`}>
      <CardHeader className="p-2.5">
        <div className="flex items-center gap-2">
          <ArtifactIcon className={`h-3.5 w-3.5 ${creator.color} shrink-0`} />
          <span className="text-xs font-medium flex-1 truncate">{artifact.title}</span>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleCopy} data-testid={`button-copy-artifact-${artifact.id}`}><Copy className="h-3 w-3" /></Button>
            <Badge variant="outline" className="text-xs py-0 h-4 capitalize">{artifact.artifactType}</Badge>
            <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
              <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "" : "-rotate-90"}`} />
            </button>
          </div>
        </div>
      </CardHeader>
      {expanded && <CardContent className="p-2.5 pt-0">{renderContent()}</CardContent>}
    </Card>
  );
}

// ── Express Lane message ──────────────────────────────────────────────────────

function ExpressLaneMessage({ participant, content, time, guestTutors }: { participant: string; content: string; time: string; guestTutors: GuestTutorInfo[] }) {
  const p = getParticipantConfig(participant, guestTutors);
  const Icon = p.Icon;
  return (
    <div className="space-y-1" data-testid="express-lane-message">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3 w-3 ${p.color}`} />
        <span className={`text-xs font-medium ${p.color}`}>{p.name}</span>
        <span className="text-xs text-muted-foreground">{time}</span>
      </div>
      <div className={`text-xs ${p.bgColor} ${p.borderColor} border rounded-md p-2 whitespace-pre-wrap leading-relaxed`}>{content}</div>
    </div>
  );
}

// ── Message bubble with @mention highlights ───────────────────────────────────

function renderWithMentions(text: string, guestTutors: GuestTutorInfo[] = []) {
  const allNames = ["alden", "daniela", "sofia", "lyra", "wren", ...guestTutors.map(g => g.tutorName.toLowerCase())];
  const pattern = new RegExp(`(@(?:${allNames.join("|")}))`, "gi");
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    const lower = part.toLowerCase();
    if (lower.startsWith("@") && allNames.includes(lower.slice(1))) {
      const p = getParticipantConfig(lower.slice(1), guestTutors);
      return <span key={i} className={`font-semibold ${p.color}`}>{part}</span>;
    }
    return part;
  });
}

function MessageBubble({ message, onPlayVoice, guestTutors }: {
  message: RoomVoiceMessage;
  onPlayVoice?: (text: string, speaker: string) => void;
  guestTutors: GuestTutorInfo[];
}) {
  const p = getParticipantConfig(message.speaker, guestTutors);
  const isDavid = message.speaker.toLowerCase() === "david";
  const isSystem = message.speaker.toLowerCase() === "system";
  const Icon = p.Icon;
  const time = new Date(message.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  if (isSystem) {
    return (
      <div className="flex justify-center" data-testid={`message-${message.id}`}>
        <span className="text-xs text-muted-foreground italic px-3 py-1 bg-muted/30 rounded-full">{message.content}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${isDavid ? "items-end" : "items-start"}`} data-testid={`message-${message.id}`}>
      <div className={`flex items-center gap-1.5 ${isDavid ? "flex-row-reverse" : ""}`}>
        <Icon className={`h-3.5 w-3.5 ${p.color}`} />
        <span className={`text-xs font-medium ${p.color}`}>{p.name}</span>
        {p.isGuest && <Badge variant="outline" className="text-xs py-0 h-3.5 px-1">guest</Badge>}
        <span className="text-xs text-muted-foreground">{time}</span>
        {!isDavid && onPlayVoice && (
          <button onClick={() => onPlayVoice(message.content, message.speaker)} className="text-muted-foreground hover:text-foreground" data-testid={`button-play-voice-${message.id}`}>
            <Volume2 className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${isDavid ? "bg-primary text-primary-foreground" : `${p.bgColor} ${p.borderColor} border text-foreground`}`}>
        {renderWithMentions(message.content, guestTutors)}
      </div>
    </div>
  );
}

// ── Participant card with visible @ button and hand-raise ─────────────────────

function ParticipantCard({ config, isActive, isThinking, handRaise, onMention, onDisconnect }: {
  config: ParticipantConfig;
  isActive: boolean;
  isThinking: boolean;
  handRaise?: { reasoning: string } | null;
  onMention?: (name: string) => void;
  onDisconnect?: () => void;
}) {
  const Icon = config.Icon;
  const isAI = config.id !== "david" && config.id !== "system";

  return (
    <div className={`flex items-center gap-2 p-2 rounded-md ${isActive ? "bg-muted" : ""}`} data-testid={`participant-${config.id}`}>
      <div className="relative shrink-0">
        <Icon className={`h-5 w-5 ${config.color}`} />
        {isActive && !isThinking && !handRaise && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 ring-1 ring-background" />
        )}
        {isThinking && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400 ring-1 ring-background animate-pulse" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 flex-wrap">
          <p className="text-sm font-medium leading-none">{config.name}</p>
          {config.isGuest && <Badge variant="outline" className="text-xs py-0 h-3.5 px-1">guest</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{config.role}</p>
      </div>

      {handRaise && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 animate-bounce"
              onClick={() => onMention && onMention(config.name.toLowerCase())}
              data-testid={`button-hand-raise-${config.id}`}
            >
              <Hand className={`h-4 w-4 ${config.color}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-48">
            <p className="text-xs font-medium mb-0.5">Click to summon {config.name}</p>
            <p className="text-xs text-muted-foreground">{handRaise.reasoning}</p>
          </TooltipContent>
        </Tooltip>
      )}

      {isThinking && <span className="text-xs text-amber-500 shrink-0 animate-pulse">thinking</span>}

      <div className="flex items-center gap-0.5 shrink-0">
        {isActive && isAI && onMention && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onMention(config.name.toLowerCase())}
            title={`@${config.name.toLowerCase()}`}
            data-testid={`button-mention-${config.id}`}
          >
            <AtSign className="h-3.5 w-3.5" />
          </Button>
        )}
        {config.isGuest && onDisconnect && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={onDisconnect}
            title={`Disconnect ${config.name}`}
            data-testid={`button-disconnect-${config.id}`}
          >
            <UserMinus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── PTT voice hook ────────────────────────────────────────────────────────────

function usePTT(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SR);
    if (SR) {
      const recognition = new SR();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognition.onresult = (e: SpeechRecognitionEvent) => {
        const transcript = Array.from(e.results).map(r => r[0].transcript).join(" ").trim();
        if (transcript) onTranscript(transcript);
      };
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, [onTranscript]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    try { recognitionRef.current.start(); setIsListening(true); } catch { setIsListening(false); }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;
    recognitionRef.current.stop(); setIsListening(false);
  }, [isListening]);

  return { isListening, isSupported, startListening, stopListening };
}

// ── Voice playback helper ─────────────────────────────────────────────────────

async function playParticipantVoice(text: string, speaker: string) {
  try {
    const res = await fetch("/api/team-room/voice/tts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, speaker }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
  } catch { /* voice unavailable */ }
}

// ── WebSocket hook ────────────────────────────────────────────────────────────

function useTeamRoomWS(roomId: string | null, callbacks: {
  onNewMessage: (msg: RoomVoiceMessage) => void;
  onExpressLane: (items: Array<{ participant: string; content: string }>) => void;
  onArtifact: (artifact: RoomArtifact) => void;
  onThinking: (participants: string[]) => void;
  onDone: () => void;
  onSessionClosed: () => void;
  onGuestJoined: (info: { tutorName: string; language: string }) => void;
  onGuestLeft: (info: { tutorName: string }) => void;
}) {
  const socketRef = useRef<Socket | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!roomId) return;
    const socket = io("/team-room", { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => { socket.emit("join_room", roomId); });
    socket.on("new_message", (msg: RoomVoiceMessage) => callbacksRef.current.onNewMessage(msg));
    socket.on("express_lane", (items: Array<{ participant: string; content: string }>) => callbacksRef.current.onExpressLane(items));
    socket.on("new_artifact", (artifact: RoomArtifact) => callbacksRef.current.onArtifact(artifact));
    socket.on("participants_thinking", (participants: string[]) => callbacksRef.current.onThinking(participants));
    socket.on("participants_done", () => callbacksRef.current.onDone());
    socket.on("session_closed", () => callbacksRef.current.onSessionClosed());
    socket.on("guest_joined", (info: { tutorName: string; language: string }) => callbacksRef.current.onGuestJoined(info));
    socket.on("guest_left", (info: { tutorName: string }) => callbacksRef.current.onGuestLeft(info));

    return () => {
      socket.emit("leave_room", roomId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId]);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionData {
  room: TeamRoomType;
  messages: RoomVoiceMessage[];
  handRaises: any[];
  artifacts: RoomArtifact[];
}

interface ExpressItem { participant: string; content: string; time: string; }
interface SessionSummary { summary: string; keyDecisions?: string[]; actionItems?: string[]; momentum?: string; }
interface SessionTemplate { id: string; topic: string; description: string; icon: string; context?: string; }
interface GuestTutorInfo { tutorId: string; tutorName: string; language: string; personality?: string; personalityTraits?: string; teachingPhilosophy?: string; gender?: string; }
interface AvailableTutor extends GuestTutorInfo { gender: string; }

// ── Invite Tutor Popover ──────────────────────────────────────────────────────

function InviteTutorPopover({ sessionId, currentGuests, onInvited }: {
  sessionId: string;
  currentGuests: GuestTutorInfo[];
  onInvited: (guest: GuestTutorInfo) => void;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: availableTutors } = useQuery<AvailableTutor[]>({
    queryKey: ["/api/team-room/available-tutors"],
    enabled: open,
  });

  const inviteMutation = useMutation({
    mutationFn: (tutor: AvailableTutor) =>
      apiRequest("POST", `/api/team-room/sessions/${sessionId}/invite`, tutor),
    onSuccess: async (res, tutor) => {
      onInvited(tutor);
      toast({ title: `${tutor.tutorName} joined the room` });
    },
    onError: (e: any) => {
      toast({ title: "Failed to invite", description: e.message, variant: "destructive" });
    },
  });

  const guestNames = currentGuests.map(g => g.tutorName.toLowerCase());
  const filtered = (availableTutors ?? []).filter(t => !guestNames.includes(t.tutorName.toLowerCase()));

  const grouped = filtered.reduce((acc, t) => {
    const lang = t.language.charAt(0).toUpperCase() + t.language.slice(1);
    if (!acc[lang]) acc[lang] = [];
    acc[lang].push(t);
    return acc;
  }, {} as Record<string, AvailableTutor[]>);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full" data-testid="button-invite-tutor">
          <UserPlus className="h-3.5 w-3.5 mr-1.5" />
          Invite Tutor
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2 border-b">
          <p className="text-sm font-medium">Invite a Tutor</p>
          <p className="text-xs text-muted-foreground">They will participate in the session</p>
        </div>
        <ScrollArea className="max-h-64">
          <div className="p-1">
            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([lang, tutors]) => (
              <div key={lang}>
                <p className="text-xs text-muted-foreground font-medium px-2 py-1 uppercase tracking-wide">{lang}</p>
                {tutors.map(t => (
                  <button
                    key={t.tutorId}
                    onClick={() => { inviteMutation.mutate(t); setOpen(false); }}
                    disabled={inviteMutation.isPending}
                    className="w-full text-left px-2 py-1.5 rounded-md text-sm hover-elevate flex items-center gap-2"
                    data-testid={`invite-${t.tutorName.toLowerCase()}`}
                  >
                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <span className="font-medium">{t.tutorName}</span>
                      <span className="text-xs text-muted-foreground ml-1">({t.gender})</span>
                    </div>
                  </button>
                ))}
              </div>
            ))}
            {Object.keys(grouped).length === 0 && (
              <p className="text-xs text-muted-foreground p-3 text-center">No tutors available</p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TeamRoom() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [expressLaneItems, setExpressLaneItems] = useState<ExpressItem[]>([]);
  const [sessionArtifacts, setSessionArtifacts] = useState<RoomArtifact[]>([]);
  const [showPastSessions, setShowPastSessions] = useState(false);
  const [thinkingParticipants, setThinkingParticipants] = useState<Set<string>>(new Set());
  const [handRaises, setHandRaises] = useState<Record<string, { reasoning: string }>>({});
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [autoPlayVoice, setAutoPlayVoice] = useState(() => {
    const saved = localStorage.getItem("teamroom-autoplay");
    return saved === null ? true : saved === "true";
  });
  const [wsMessages, setWsMessages] = useState<RoomVoiceMessage[]>([]);
  const [guestTutors, setGuestTutors] = useState<GuestTutorInfo[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const expressEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleAutoPlay = (v: boolean) => {
    setAutoPlayVoice(v);
    localStorage.setItem("teamroom-autoplay", String(v));
  };

  const handleVoiceTranscript = useCallback((text: string) => setMessageInput(text), []);
  const { isListening, isSupported, startListening, stopListening } = usePTT(handleVoiceTranscript);

  useTeamRoomWS(activeSessionId, {
    onNewMessage: (msg) => {
      setWsMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      const speaker = msg.speaker.toLowerCase();
      if (speaker !== "david" && speaker !== "system") {
        if (autoPlayVoice) playParticipantVoice(msg.content, msg.speaker);
        setHandRaises(prev => {
          if (!prev[speaker]) return prev;
          const next = { ...prev };
          delete next[speaker];
          return next;
        });
      }
    },
    onExpressLane: (items) => {
      const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      setExpressLaneItems(prev => {
        const newItems = items.filter(it => !prev.some(p => p.participant === it.participant && p.content === it.content));
        if (newItems.length === 0) return prev;
        return [...prev, ...newItems.map(n => ({ ...n, time }))];
      });
    },
    onArtifact: (artifact) => {
      setSessionArtifacts(prev => {
        if (prev.some(a => a.id === artifact.id)) return prev;
        return [...prev, artifact];
      });
    },
    onThinking: (participants) => setThinkingParticipants(new Set(participants)),
    onDone: () => { setThinkingParticipants(new Set()); },
    onSessionClosed: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-room/sessions"] });
    },
    onGuestJoined: (info) => {
      setGuestTutors(prev => {
        if (prev.some(g => g.tutorName.toLowerCase() === info.tutorName.toLowerCase())) return prev;
        return [...prev, { tutorId: "", tutorName: info.tutorName, language: info.language }];
      });
      queryClient.invalidateQueries({ queryKey: ["/api/team-room/sessions", activeSessionId] });
    },
    onGuestLeft: (info) => {
      setGuestTutors(prev => prev.filter(g => g.tutorName.toLowerCase() !== info.tutorName.toLowerCase()));
      queryClient.invalidateQueries({ queryKey: ["/api/team-room/sessions", activeSessionId] });
    },
  });

  const { data: sessions } = useQuery<TeamRoomType[]>({ queryKey: ["/api/team-room/sessions"] });
  const { data: templates } = useQuery<SessionTemplate[]>({ queryKey: ["/api/team-room/templates"] });

  const { data: sessionData } = useQuery<SessionData>({
    queryKey: ["/api/team-room/sessions", activeSessionId],
    enabled: !!activeSessionId,
    refetchInterval: false,
  });

  useEffect(() => {
    if (!sessionData?.room) return;
    const summary = (sessionData as any).summary;
    if (summary) setSessionSummary(summary);
    setWsMessages([]);
    const metadata = (sessionData.room.metadata || {}) as Record<string, unknown>;
    const guests = (metadata.guestTutors || []) as GuestTutorInfo[];
    setGuestTutors(guests);
  }, [sessionData]);

  const allMessages = useMemo(() => {
    const restMsgs = sessionData?.messages ?? [];
    const merged = [...restMsgs];
    for (const wsMsg of wsMessages) {
      if (!merged.some(m => m.id === wsMsg.id)) merged.push(wsMsg);
    }
    merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return merged;
  }, [sessionData?.messages, wsMessages]);

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
      setWsMessages([]);
      setGuestTutors([]);
      setHandRaises({});
    },
  });

  const postMessage = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/team-room/sessions/${activeSessionId}/messages`, { content, speaker: "David" }),
    onMutate: (content) => {
      const allNames = ["alden", "daniela", "sofia", "lyra", "wren", ...guestTutors.map(g => g.tutorName.toLowerCase())];
      const mentionPattern = new RegExp(`@(${allNames.join("|")})\\b`, "gi");
      const matches = content.match(mentionPattern);
      if (matches && matches.length > 0) {
        const mentioned = new Set(matches.map(m => m.slice(1).toLowerCase()));
        setThinkingParticipants(mentioned);
      } else {
        setThinkingParticipants(new Set(allNames));
      }
    },
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/team-room/sessions", activeSessionId] });
      const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

      if (data.expressLaneItems?.length) {
        setExpressLaneItems(prev => {
          const newItems = data.expressLaneItems.filter((it: any) => !prev.some(p => p.participant === it.participant && p.content === it.content));
          return [...prev, ...newItems.map((item: any) => ({ ...item, time }))];
        });
      }
      if (data.artifacts?.length) {
        setSessionArtifacts(prev => [...prev, ...data.artifacts]);
      }

      const allParticipants = data.allEvaluations as Array<{ participant: string; handRaise: { shouldRaise: boolean; reasoning: string }; hasResponded?: boolean }> | undefined;
      if (allParticipants) {
        setHandRaises(prev => {
          const next = { ...prev };
          for (const p of allParticipants) {
            if (p.hasResponded) {
              delete next[p.participant];
            } else if (p.handRaise.shouldRaise) {
              next[p.participant] = { reasoning: p.handRaise.reasoning };
            }
          }
          return next;
        });
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
      setWsMessages([]);
      setGuestTutors([]);
      setHandRaises({});
    },
  });

  const disconnectGuest = useMutation({
    mutationFn: (tutorName: string) =>
      apiRequest("POST", `/api/team-room/sessions/${activeSessionId}/disconnect`, { tutorName }),
    onSuccess: async (_res, tutorName) => {
      setGuestTutors(prev => prev.filter(g => g.tutorName.toLowerCase() !== tutorName.toLowerCase()));
      queryClient.invalidateQueries({ queryKey: ["/api/team-room/sessions", activeSessionId] });
      toast({ title: `${tutorName} disconnected` });
    },
    onError: (e: any, tutorName) => {
      toast({ title: `Failed to disconnect ${tutorName}`, description: e.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages, thinkingParticipants]);

  useEffect(() => {
    expressEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [expressLaneItems, sessionArtifacts]);

  const handleSend = () => {
    if (!messageInput.trim() || postMessage.isPending) return;
    postMessage.mutate(messageInput.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleMention = (name: string) => {
    const prefix = messageInput.endsWith(" ") || messageInput === "" ? "" : " ";
    setMessageInput(prev => `${prev}${prefix}@${name} `);
    inputRef.current?.focus();
  };

  const handleTemplateSelect = (template: SessionTemplate) => {
    setNewTopic(template.topic);
  };

  const activeSessions = sessions?.filter(s => s.status === "active") ?? [];
  const pastSessions = sessions?.filter(s => s.status === "closed") ?? [];
  const isActive = sessionData?.room?.status === "active";

  const displayArtifacts = [
    ...(sessionData?.artifacts ?? []),
    ...sessionArtifacts.filter(a => !sessionData?.artifacts?.some((sa: RoomArtifact) => sa.id === a.id)),
  ];

  const hasExpressContent = expressLaneItems.length > 0 || displayArtifacts.length > 0;

  const allParticipantConfigs: ParticipantConfig[] = [
    CORE_PARTICIPANTS.david,
    CORE_PARTICIPANTS.alden,
    CORE_PARTICIPANTS.daniela,
    CORE_PARTICIPANTS.sofia,
    CORE_PARTICIPANTS.lyra,
    CORE_PARTICIPANTS.wren,
    ...guestTutors.map((g, i) => ({
      id: g.tutorName.toLowerCase(),
      name: g.tutorName,
      role: `${g.language.charAt(0).toUpperCase() + g.language.slice(1)} Tutor (Guest)`,
      Icon: BookOpen,
      isGuest: true,
      ...GUEST_COLORS[i % GUEST_COLORS.length],
    })),
  ];

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* ── Left Panel: Participants ── */}
      <div className="w-56 flex-none border-r flex flex-col">
        <div className="p-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Participants</span>
            <Badge variant="outline" className="text-xs ml-auto">{allParticipantConfigs.length}</Badge>
          </div>
          {activeSessionId && isActive && (
            <p className="text-xs text-muted-foreground mt-1">Everyone listens to every message. Raised hand = wants to add something. Click the hand to summon them.</p>
          )}
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {allParticipantConfigs.map(p => (
              <ParticipantCard
                key={p.id}
                config={p}
                isActive={!!activeSessionId}
                isThinking={thinkingParticipants.has(p.id)}
                handRaise={handRaises[p.id] ?? null}
                onMention={activeSessionId && isActive ? handleMention : undefined}
                onDisconnect={p.isGuest && activeSessionId && isActive ? () => disconnectGuest.mutate(p.name) : undefined}
              />
            ))}

            {activeSessionId && isActive && (
              <>
                <Separator className="my-2" />
                <InviteTutorPopover
                  sessionId={activeSessionId}
                  currentGuests={guestTutors}
                  onInvited={(guest) => {
                    setGuestTutors(prev => {
                      if (prev.some(g => g.tutorName.toLowerCase() === guest.tutorName.toLowerCase())) return prev;
                      return [...prev, guest];
                    });
                    queryClient.invalidateQueries({ queryKey: ["/api/team-room/sessions", activeSessionId] });
                  }}
                />
              </>
            )}

            {activeSessions.length > 0 && !activeSessionId && (
              <>
                <Separator className="my-3" />
                <p className="text-xs text-muted-foreground px-2 mb-2">Active sessions</p>
                {activeSessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setActiveSessionId(s.id); setExpressLaneItems([]); setSessionArtifacts([]); setWsMessages([]); setGuestTutors([]); }}
                    className="w-full text-left px-2 py-1.5 text-xs rounded-md hover-elevate truncate"
                    data-testid={`session-${s.id}`}
                  >
                    {s.topic}
                  </button>
                ))}
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
                        onClick={() => { setActiveSessionId(s.id); setExpressLaneItems([]); setSessionArtifacts([]); setWsMessages([]); setGuestTutors([]); }}
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
          <ScrollArea className="flex-1">
            <div className="flex flex-col items-center p-6 gap-6">
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Team Room
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Start a session to collaborate with the team. Use @mentions to target specific participants, or invite guest tutors for domain expertise.
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

              {templates && templates.length > 0 && (
                <div className="w-full max-w-md space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick Start Templates</p>
                  <div className="grid grid-cols-2 gap-2">
                    {templates.map(t => {
                      const TIcon = TEMPLATE_ICONS[t.icon] ?? Target;
                      return (
                        <button
                          key={t.id}
                          onClick={() => handleTemplateSelect(t)}
                          className="text-left p-3 rounded-md border border-border bg-card hover-elevate"
                          data-testid={`template-${t.id}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <TIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium">{t.topic}</span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        ) : (
          <>
            <div className="px-4 py-2.5 border-b flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-sm truncate">{sessionData?.room?.topic ?? "Loading..."}</span>
                <Badge variant="outline" className="text-xs shrink-0">
                  {isActive ? (
                    <><Circle className="h-2 w-2 fill-green-500 text-green-500 mr-1" />Live</>
                  ) : (
                    <><RotateCcw className="h-2.5 w-2.5 mr-1" />Replay</>
                  )}
                </Badge>
                {guestTutors.length > 0 && (
                  <Badge variant="outline" className="text-xs shrink-0">+{guestTutors.length} guest{guestTutors.length > 1 ? "s" : ""}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {isActive && (
                  <div className="flex items-center gap-1.5">
                    <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Auto-play</span>
                    <Switch checked={autoPlayVoice} onCheckedChange={toggleAutoPlay} data-testid="switch-autoplay" className="scale-75" />
                  </div>
                )}
                {isActive && (
                  <Button variant="outline" size="sm" onClick={() => closeSession.mutate()} disabled={closeSession.isPending} data-testid="button-close-session">
                    <X className="h-3.5 w-3.5 mr-1" />
                    {closeSession.isPending ? "Closing..." : "End Session"}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => { setActiveSessionId(null); setExpressLaneItems([]); setSessionArtifacts([]); setSessionSummary(null); setWsMessages([]); setGuestTutors([]); setHandRaises({}); }} data-testid="button-leave-room">
                  Leave
                </Button>
              </div>
            </div>

            {sessionSummary && (
              <div className="mx-4 mt-3 p-3 rounded-md bg-muted/60 border border-border text-xs space-y-2" data-testid="session-summary-banner">
                <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                  <Info className="h-3.5 w-3.5" />
                  {isActive ? "Previously in this room" : "Session Summary"}
                </div>
                <p>{sessionSummary.summary}</p>
                {sessionSummary.keyDecisions && sessionSummary.keyDecisions.length > 0 && (
                  <div>
                    <p className="font-medium text-muted-foreground mt-1">Key Decisions:</p>
                    <ul className="list-disc list-inside space-y-0.5 ml-1">
                      {sessionSummary.keyDecisions.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  </div>
                )}
                {sessionSummary.actionItems && sessionSummary.actionItems.length > 0 && (
                  <div>
                    <p className="font-medium text-muted-foreground mt-1">Action Items:</p>
                    <ul className="space-y-0.5 ml-1">
                      {sessionSummary.actionItems.map((a, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <CheckSquare className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {sessionSummary.momentum && <p className="text-muted-foreground italic">{sessionSummary.momentum}</p>}
              </div>
            )}

            <ScrollArea className="flex-1 px-4 py-3">
              <div className="space-y-4">
                {allMessages.length === 0 && !thinkingParticipants.size && (
                  <div className="text-center py-10 text-sm text-muted-foreground space-y-2">
                    {isActive ? (
                      <>
                        <p>Say something to the team.</p>
                        <p className="text-xs">
                          Everyone reads every message and decides whether to respond. Use <span className="font-mono bg-muted px-1 py-0.5 rounded">@name</span> to force a specific person to reply.
                        </p>
                      </>
                    ) : (
                      <p>No messages in this session.</p>
                    )}
                  </div>
                )}
                {allMessages.map(msg => (
                  <MessageBubble key={msg.id} message={msg} onPlayVoice={playParticipantVoice} guestTutors={guestTutors} />
                ))}
                {thinkingParticipants.size > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex gap-0.5">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                      ))}
                    </div>
                    <span>
                      {thinkingParticipants.size > 3
                        ? "Team is thinking..."
                        : `${[...thinkingParticipants].map(p => {
                            const cfg = allParticipantConfigs.find(c => c.id === p);
                            return cfg?.name ?? p;
                          }).join(", ")} thinking...`}
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

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
                  ref={inputRef}
                  placeholder={`Say something to the team... ${guestTutors.length > 0 ? "(use @name to mention anyone)" : "(use @name to mention)"}`}
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={postMessage.isPending}
                  data-testid="input-message"
                  className="flex-1"
                />
                <Button onClick={handleSend} disabled={!messageInput.trim() || postMessage.isPending} data-testid="button-send-message">
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
              <Badge variant="outline" className="ml-auto text-xs">{expressLaneItems.length + displayArtifacts.length}</Badge>
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
              {displayArtifacts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Artifacts</p>
                  {displayArtifacts.map(a => <ArtifactCard key={a.id} artifact={a} guestTutors={guestTutors} />)}
                </div>
              )}
              {expressLaneItems.length > 0 && (
                <div className="space-y-3">
                  {displayArtifacts.length > 0 && <Separator />}
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Analysis Stream</p>
                  {expressLaneItems.map((item, i) => <ExpressLaneMessage key={i} {...item} guestTutors={guestTutors} />)}
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
