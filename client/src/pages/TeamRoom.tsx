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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Send, Plus, BrainCircuit, Radio, Code, X, ChevronDown,
  GraduationCap, Shield, Mic, MicOff, Volume2, FileText,
  Table, Lightbulb, CheckSquare, GitBranch, Info, Copy,
  Target, ClipboardList, AtSign, Hand, UserPlus, UserMinus,
  BookOpen, TrendingUp, Cpu, Circle, RotateCcw, Monitor, ScanEye, Terminal,
  CheckCircle2, AlertCircle, Clock, Compass, BookmarkPlus, GitPullRequest,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import type { TeamRoom as TeamRoomType, RoomVoiceMessage, RoomArtifact, AgentActivityLog } from "@shared/schema";

// ── Participant config ────────────────────────────────────────────────────────

type CoreParticipantId = "david" | "alden" | "daniela" | "sofia" | "lyra" | "wren" | "agent";

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
  agent: {
    id: "agent", name: "Agent", role: "Replit Agent",
    Icon: Terminal, color: "text-orange-500",
    bgColor: "bg-orange-500/10", borderColor: "border-orange-500/20",
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
  plan: GitBranch, table: Table, code: Code, insight: Lightbulb, decision: CheckSquare,
  browser_screenshot: Monitor, daniela_self_critique: ScanEye, default: FileText,
};

function ArtifactCard({ artifact, guestTutors }: { artifact: RoomArtifact; guestTutors: GuestTutorInfo[] }) {
  const [expanded, setExpanded] = useState(true);
  const { toast } = useToast();
  const ArtifactIcon = ARTIFACT_ICONS[(artifact.artifactType ?? 'default') as keyof typeof ARTIFACT_ICONS] ?? ARTIFACT_ICONS.default;
  const creator = getParticipantConfig(artifact.createdBy ?? '', guestTutors);

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
          {c.decision ? <p className="font-medium">{String(c.decision)}</p> : null}
          {c.rationale ? <p className="text-muted-foreground">{String(c.rationale)}</p> : null}
          {c.impact ? <p className="text-amber-600 dark:text-amber-400">Impact: {String(c.impact)}</p> : null}
        </div>
      );
    }
    if (artifact.artifactType === "browser_screenshot" && c.screenshotBase64) {
      const errors = c.consoleErrors as string[] | undefined;
      const broken = c.brokenImages as string[] | undefined;
      return (
        <div className="space-y-2">
          <img
            src={`data:image/png;base64,${String(c.screenshotBase64)}`}
            alt={`Screenshot of ${String(c.url || "page")}`}
            className="w-full rounded-sm border border-border"
            data-testid="browser-screenshot-image"
          />
          {c.analysis ? <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words overflow-hidden">{String(c.analysis)}</p> : null}
          {errors && errors.length > 0 && (
            <div className="text-xs text-destructive space-y-0.5">
              <span className="font-medium">Console errors ({errors.length}):</span>
              {errors.slice(0, 3).map((e, i) => <div key={i} className="font-mono truncate opacity-80">{e}</div>)}
            </div>
          )}
          {broken && broken.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{broken.length} broken image(s) on this page.</p>
          )}
          <p className="text-xs text-muted-foreground/60 font-mono truncate">{String(c.url || "")}</p>
        </div>
      );
    }
    if (artifact.artifactType === "daniela_self_critique") {
      const rating = String(c.overallRating || "");
      const ratingColor = rating === "needs_work" ? "text-destructive" : rating === "strong" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400";
      const moments = c.specificMoments as Array<{exchange: number; whatWasWrong: string; whatIShouldHaveDone: string}> | undefined;
      const forAlden = c.forAlden as string[] | undefined;
      const forMyself = c.forMyself as string[] | undefined;
      const patterns = c.patterns as string[] | undefined;
      return (
        <div className="space-y-2.5 text-xs">
          <div className="flex flex-wrap gap-2 items-center">
            <span className={`font-semibold ${ratingColor}`}>{rating.replace("_", " ").toUpperCase()}</span>
            <span className="text-muted-foreground">{Number(c.sessionCount) || 0} session(s)</span>
            <span className="text-muted-foreground">Trend: {String(c.performanceTrend || "")}</span>
            {c.speakingRatio ? <span className="text-muted-foreground">Tutor {(c.speakingRatio as any).tutor}% / Student {(c.speakingRatio as any).student}%</span> : null}
          </div>
          {c.sessionSummary ? <p className="text-muted-foreground">{String(c.sessionSummary)}</p> : null}
          {patterns && patterns.length > 0 && (
            <div><p className="font-medium mb-1">Patterns:</p>{patterns.map((p, i) => <p key={i} className="text-muted-foreground">• {p}</p>)}</div>
          )}
          {moments && moments.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-medium">Specific moments:</p>
              {moments.map((m, i) => (
                <div key={i} className="bg-muted/40 rounded-md p-2 space-y-1">
                  <p className="text-muted-foreground">Exchange {m.exchange}: {m.whatWasWrong}</p>
                  <p className="text-emerald-600 dark:text-emerald-400">→ {m.whatIShouldHaveDone}</p>
                </div>
              ))}
            </div>
          )}
          {forAlden && forAlden.length > 0 && (
            <div><p className="font-medium text-blue-600 dark:text-blue-400 mb-1">For Alden:</p>{forAlden.map((item, i) => <p key={i} className="text-muted-foreground">• {item}</p>)}</div>
          )}
          {forMyself && forMyself.length > 0 && (
            <div><p className="font-medium text-purple-600 dark:text-purple-400 mb-1">Personal notes:</p>{forMyself.map((item, i) => <p key={i} className="text-muted-foreground">• {item}</p>)}</div>
          )}
        </div>
      );
    }
    return <div className="text-xs whitespace-pre-wrap">{typeof c === "object" ? JSON.stringify(c, null, 2) : String(c)}</div>;
  };

  return (
    <Card className={`${creator.bgColor} ${creator.borderColor} border overflow-hidden min-w-0`} data-testid={`artifact-${artifact.id}`}>
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
    <div className="space-y-1 min-w-0 overflow-hidden" data-testid="express-lane-message">
      <div className="flex items-center gap-1.5 min-w-0">
        <Icon className={`h-3 w-3 shrink-0 ${p.color}`} />
        <span className={`text-xs font-medium shrink-0 ${p.color}`}>{p.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">{time}</span>
      </div>
      <div className={`text-xs ${p.bgColor} ${p.borderColor} border rounded-md p-2 whitespace-pre-wrap leading-relaxed break-words overflow-hidden`}>{content}</div>
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

function ParticipantCard({ config, isActive, isThinking, handRaise, onMention, onCallOn, onDisconnect, onRemove }: {
  config: ParticipantConfig;
  isActive: boolean;
  isThinking: boolean;
  handRaise?: { reasoning: string } | null;
  onMention?: (name: string) => void;
  onCallOn?: (name: string) => void;
  onDisconnect?: () => void;
  onRemove?: () => void;
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
              onClick={() => onCallOn && onCallOn(config.name.toLowerCase())}
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
        {isActive && isAI && onRemove && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onRemove}
                data-testid={`button-remove-${config.id}`}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p className="text-xs">Remove {config.name} from this session</p>
            </TooltipContent>
          </Tooltip>
        )}
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
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SR);
    if (SR) {
      const recognition = new SR();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognition.onresult = (e: any) => {
        const transcript = Array.from(e.results as any[]).map((r: any) => r[0].transcript).join(" ").trim();
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

// ── Voice playback — queue-based so participants speak one at a time ──────────

const _audioQueue: Array<{ text: string; speaker: string }> = [];
let _audioPlaying = false;

async function _processAudioQueue() {
  if (_audioPlaying || _audioQueue.length === 0) return;
  _audioPlaying = true;
  const { text, speaker } = _audioQueue.shift()!;
  try {
    const res = await fetch("/api/team-room/voice/tts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, speaker }),
    });
    if (!res.ok) { _audioPlaying = false; _processAudioQueue(); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => { URL.revokeObjectURL(url); _audioPlaying = false; _processAudioQueue(); };
    audio.onerror = () => { URL.revokeObjectURL(url); _audioPlaying = false; _processAudioQueue(); };
    await audio.play();
  } catch { _audioPlaying = false; _processAudioQueue(); }
}

function queueParticipantVoice(text: string, speaker: string) {
  _audioQueue.push({ text, speaker });
  _processAudioQueue();
}

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
  const [showAgentActivity, setShowAgentActivity] = useState(true);
  const [thinkingParticipants, setThinkingParticipants] = useState<Set<string>>(new Set());
  const [invitedParticipants, setInvitedParticipants] = useState<Set<string>>(new Set(['agent', 'daniela']));
  const [handRaises, setHandRaises] = useState<Record<string, { reasoning: string }>>({});
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [autoPlayVoice, setAutoPlayVoice] = useState(() => {
    const saved = localStorage.getItem("teamroom-autoplay");
    return saved === null ? true : saved === "true";
  });
  const [wsMessages, setWsMessages] = useState<RoomVoiceMessage[]>([]);
  const [guestTutors, setGuestTutors] = useState<GuestTutorInfo[]>([]);
  const [showFounderInsights, setShowFounderInsights] = useState(true);
  const [showBuildQueue, setShowBuildQueue] = useState(true);
  const [showSaveMemory, setShowSaveMemory] = useState(false);
  const [saveMemoryTitle, setSaveMemoryTitle] = useState("");
  const [saveMemoryImportance, setSaveMemoryImportance] = useState(8);
  const [saveToSharedLobe, setSaveToSharedLobe] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [closeAfterSave, setCloseAfterSave] = useState(false);
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
        if (autoPlayVoice) queueParticipantVoice(msg.content, msg.speaker);
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
  const { data: founderInsightsData } = useQuery<{ insights: any[] }>({
    queryKey: ["/api/conversation-memories/shared"],
    staleTime: 60000,
  });
  const founderInsights = founderInsightsData?.insights ?? [];

  const { data: buildQueueItems, refetch: refetchBuildQueue } = useQuery<any[]>({
    queryKey: ["/api/build-queue", "pending"],
    queryFn: () => fetch("/api/build-queue?status=pending").then(r => r.json()),
    refetchInterval: 60000,
    staleTime: 30000,
  });
  const pendingQueue = Array.isArray(buildQueueItems) ? buildQueueItems : [];

  const reviewQueueItem = useMutation({
    mutationFn: ({ id, status, reviewNote }: { id: string; status: string; reviewNote?: string }) =>
      apiRequest("PATCH", `/api/build-queue/${id}`, { status, reviewNote, reviewedBy: "david" }),
    onSuccess: () => { refetchBuildQueue(); toast({ title: "Updated" }); },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const { data: agentActivity } = useQuery<AgentActivityLog[]>({
    queryKey: ["/api/agent-activity"],
    refetchInterval: 30000,
  });

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
    const invited = metadata.invitedParticipants as string[] | undefined;
    if (invited) setInvitedParticipants(new Set(invited));
    else setInvitedParticipants(new Set(['agent', 'daniela']));
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

  const ALL_CORE_AI_IDS = ['alden', 'daniela', 'sofia', 'lyra', 'wren', 'agent'];

  const handleInvite = useCallback(async (participantId: string) => {
    setInvitedParticipants(prev => new Set([...prev, participantId]));
    if (activeSessionId) {
      apiRequest("PATCH", `/api/team-room/sessions/${activeSessionId}/invited`, { participantId, action: 'add' }).catch(() => {});
    }
  }, [activeSessionId]);

  const handleRemoveParticipant = useCallback(async (participantId: string) => {
    setInvitedParticipants(prev => { const next = new Set(prev); next.delete(participantId); return next; });
    if (activeSessionId) {
      apiRequest("PATCH", `/api/team-room/sessions/${activeSessionId}/invited`, { participantId, action: 'remove' }).catch(() => {});
    }
  }, [activeSessionId]);

  const postMessage = useMutation({
    mutationFn: (content: string) => {
      const dismissed = ALL_CORE_AI_IDS.filter(id => !invitedParticipants.has(id));
      return apiRequest("POST", `/api/team-room/sessions/${activeSessionId}/messages`, {
        content,
        speaker: "David",
        dismissedParticipants: dismissed,
      });
    },
    onMutate: (content) => {
      const allNames = ["alden", "daniela", "sofia", "lyra", "wren", "agent", ...guestTutors.map(g => g.tutorName.toLowerCase())]
        .filter(n => invitedParticipants.has(n) || guestTutors.some(g => g.tutorName.toLowerCase() === n));
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

  const saveToMemory = useMutation({
    mutationFn: (opts: { title: string; importance: number; saveToSharedLobe: boolean }) =>
      apiRequest("POST", `/api/team-room/sessions/${activeSessionId}/save-memory`, {
        title: opts.title,
        importance: opts.importance,
        tags: ["team-room"],
        saveToSharedLobe: opts.saveToSharedLobe,
      }),
    onSuccess: () => {
      setShowSaveMemory(false);
      toast({ title: "Saved to Agent memory", description: "This session will be part of the Agent's context next time." });
      if (closeAfterSave) {
        setCloseAfterSave(false);
        closeSession.mutate();
      }
    },
    onError: (e: any) => toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
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

  const handleCallOn = (name: string) => {
    const content = `@${name}`;
    postMessage.mutate(content);
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

  const ORDERED_CORE_AI_IDS: CoreParticipantId[] = ['agent', 'alden', 'daniela', 'sofia', 'lyra', 'wren'];
  const allParticipantConfigs: ParticipantConfig[] = [
    CORE_PARTICIPANTS.david,
    ...ORDERED_CORE_AI_IDS.filter(id => invitedParticipants.has(id)).map(id => CORE_PARTICIPANTS[id]),
    ...guestTutors.map((g, i) => ({
      id: g.tutorName.toLowerCase(),
      name: g.tutorName,
      role: `${g.language.charAt(0).toUpperCase() + g.language.slice(1)} Tutor (Guest)`,
      Icon: BookOpen,
      isGuest: true,
      ...GUEST_COLORS[i % GUEST_COLORS.length],
    })),
  ];

  const uninvitedCoreIds = ORDERED_CORE_AI_IDS.filter(id => !invitedParticipants.has(id));

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* ── Left Panel: Participants ── */}
      <div className="w-56 flex-none border-r flex flex-col overflow-hidden">
        <div className="p-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Participants</span>
            <Badge variant="outline" className="text-xs ml-auto">{allParticipantConfigs.length}</Badge>
          </div>
          {activeSessionId && isActive && (
            <p className="text-xs text-muted-foreground mt-1">Only invited participants respond. Click + to add more. Click × to remove.</p>
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
                onCallOn={activeSessionId && isActive ? handleCallOn : undefined}
                onDisconnect={p.isGuest && activeSessionId && isActive ? () => disconnectGuest.mutate(p.name) : undefined}
                onRemove={p.id !== "david" && !p.isGuest && activeSessionId && isActive ? () => handleRemoveParticipant(p.id) : undefined}
              />
            ))}

            {activeSessionId && isActive && uninvitedCoreIds.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground mt-1" data-testid="button-invite-participant">
                    <Plus className="h-3.5 w-3.5" />
                    <span className="text-xs">Invite to session</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="right" className="w-48 p-1">
                  {uninvitedCoreIds.map(id => {
                    const p = CORE_PARTICIPANTS[id];
                    const Icon = p.Icon;
                    return (
                      <button
                        key={id}
                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover-elevate text-left"
                        onClick={() => handleInvite(id)}
                        data-testid={`button-invite-${id}`}
                      >
                        <Icon className={`h-4 w-4 ${p.color}`} />
                        <span>{p.name}</span>
                      </button>
                    );
                  })}
                </PopoverContent>
              </Popover>
            )}

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

            {/* ── Agent Activity Log ── */}
            {agentActivity && agentActivity.length > 0 && (
              <>
                <Separator className="my-3" />
                <button
                  onClick={() => setShowAgentActivity(!showAgentActivity)}
                  className="flex items-center gap-1 text-xs text-muted-foreground px-2 w-full"
                  data-testid="button-toggle-agent-activity"
                >
                  <Terminal className="h-3 w-3" />
                  <ChevronDown className={`h-3 w-3 transition-transform ${showAgentActivity ? "" : "-rotate-90"}`} />
                  Agent Activity ({agentActivity.length})
                </button>
                {showAgentActivity && (
                  <div className="mt-1 space-y-1 pb-2">
                    {agentActivity.slice(0, 15).map(log => (
                      <div key={log.id} className="px-2 py-2 rounded-md bg-muted/40 space-y-1" data-testid={`activity-log-${log.id}`}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {log.status === 'complete' && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />}
                          {log.status === 'in_progress' && <Clock className="h-3 w-3 text-amber-500 shrink-0" />}
                          {log.status === 'blocked' && <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />}
                          <span className="text-xs font-medium leading-tight">{log.title}</span>
                        </div>
                        {log.details && (
                          <p className="text-xs text-muted-foreground leading-snug">{log.details}</p>
                        )}
                        {log.todos && log.todos.length > 0 && (
                          <ul className="space-y-0.5">
                            {log.todos.map((todo, i) => (
                              <li key={i} className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
                                <span className="shrink-0 mt-0.5">→</span>
                                <span>{todo}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="text-xs text-muted-foreground/60">
                          {log.actor} · {new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ── Center Panel: Discussion ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
                  <Button
                    variant="outline" size="sm"
                    onClick={() => {
                      setSaveMemoryTitle(sessionData?.room?.topic || "");
                      setShowSaveMemory(true);
                    }}
                    data-testid="button-save-memory"
                  >
                    <BookmarkPlus className="h-3.5 w-3.5 mr-1" />
                    Save to Memory
                  </Button>
                )}
                {isActive && (
                  <Button
                    variant="outline" size="sm"
                    onClick={() => {
                      setSaveMemoryTitle(sessionData?.room?.topic || "");
                      setShowEndConfirm(true);
                    }}
                    disabled={closeSession.isPending}
                    data-testid="button-close-session"
                  >
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
              <div className="mx-4 mt-3 p-3 rounded-md bg-muted/60 border border-border text-xs space-y-2 shrink-0" data-testid="session-summary-banner">
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
      <div className="w-80 flex-none border-l flex flex-col overflow-hidden">
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
        <ScrollArea className="flex-1">
          <div className="p-3 min-w-0 overflow-x-hidden space-y-4">
            {!hasExpressContent ? (
              <div className="text-center py-8 text-xs text-muted-foreground px-3">
                Detailed analysis and shared artifacts from the team will appear here during the session.
              </div>
            ) : (
              <div className="space-y-4 min-w-0">
                {displayArtifacts.length > 0 && (
                  <div className="space-y-2 min-w-0">
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

            {/* ── Build Queue ── */}
            {pendingQueue.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <button
                  className="flex items-center gap-1.5 w-full text-left"
                  onClick={() => setShowBuildQueue(!showBuildQueue)}
                  data-testid="button-toggle-build-queue"
                >
                  <GitPullRequest className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex-1">Build Queue</span>
                  <Badge variant="outline" className="text-xs">{pendingQueue.length}</Badge>
                  <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${showBuildQueue ? "" : "-rotate-90"}`} />
                </button>
                {showBuildQueue && (
                  <div className="space-y-2">
                    {pendingQueue.map((item: any) => (
                      <div key={item.id} className="rounded-md border p-2.5 space-y-2" data-testid={`build-queue-item-${item.id}`}>
                        <div className="flex items-start gap-1.5">
                          <span className={`text-xs font-semibold shrink-0 ${item.priority >= 8 ? 'text-red-500' : item.priority >= 6 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                            p{item.priority}
                          </span>
                          <p className="text-xs font-medium leading-snug flex-1">{item.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{item.description}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="secondary" className="text-xs">{item.proposedBy}</Badge>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(item.proposedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={() => reviewQueueItem.mutate({ id: item.id, status: "approved" })}
                            disabled={reviewQueueItem.isPending}
                            data-testid={`button-approve-queue-${item.id}`}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs"
                            onClick={() => reviewQueueItem.mutate({ id: item.id, status: "rejected" })}
                            disabled={reviewQueueItem.isPending}
                            data-testid={`button-reject-queue-${item.id}`}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Founder + Agent Insights ── */}
            {founderInsights.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <button
                  className="flex items-center gap-1.5 w-full text-left"
                  onClick={() => setShowFounderInsights(!showFounderInsights)}
                  data-testid="button-toggle-founder-insights"
                >
                  <Compass className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex-1">Founder + Agent Insights</span>
                  <Badge variant="outline" className="text-xs">{founderInsights.length}</Badge>
                  <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${showFounderInsights ? "" : "-rotate-90"}`} />
                </button>
                {showFounderInsights && (
                  <div className="space-y-2">
                    {founderInsights.map((ins: any) => (
                      <div key={ins.id} className="rounded-md border p-2.5 space-y-1.5" data-testid={`founder-insight-${ins.id}`}>
                        <p className="text-xs font-medium leading-snug">{ins.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{ins.insight}</p>
                        {ins.whyItMatters && (
                          <p className="text-xs text-muted-foreground italic leading-relaxed line-clamp-2">{ins.whyItMatters}</p>
                        )}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          {ins.tags && ins.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {ins.tags.slice(0, 3).map((t: string) => (
                                <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                              ))}
                            </div>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto shrink-0">
                            {new Date(ins.sharedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* End Session confirm dialog */}
      <Dialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-end-confirm">
          <DialogHeader>
            <DialogTitle>End session?</DialogTitle>
            <DialogDescription>
              Save this session to Agent memory before ending so it carries forward to future conversations.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={() => {
                setShowEndConfirm(false);
                setCloseAfterSave(true);
                setShowSaveMemory(true);
              }}
              data-testid="button-save-and-end"
            >
              <BookmarkPlus className="h-4 w-4 mr-2" />
              Save to Memory &amp; End
            </Button>
            <Button
              variant="outline"
              onClick={() => { setShowEndConfirm(false); closeSession.mutate(); }}
              disabled={closeSession.isPending}
              data-testid="button-end-without-save"
            >
              End without saving
            </Button>
            <Button variant="ghost" onClick={() => setShowEndConfirm(false)} data-testid="button-cancel-end">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save to Memory dialog */}
      <Dialog open={showSaveMemory} onOpenChange={setShowSaveMemory}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-save-memory">
          <DialogHeader>
            <DialogTitle>Save session to Agent memory</DialogTitle>
            <DialogDescription>
              This saves the full transcript to Agent conversation memory. The Agent will have this context at the start of future sessions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="memory-title">Title</Label>
              <Textarea
                id="memory-title"
                value={saveMemoryTitle}
                onChange={e => setSaveMemoryTitle(e.target.value)}
                placeholder="What was this session about?"
                className="resize-none"
                rows={2}
                data-testid="input-memory-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Importance (1–10): <span className="font-semibold">{saveMemoryImportance}</span></Label>
              <input
                type="range" min={1} max={10} value={saveMemoryImportance}
                onChange={e => setSaveMemoryImportance(Number(e.target.value))}
                className="w-full"
                data-testid="slider-memory-importance"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="shared-lobe"
                checked={saveToSharedLobe}
                onChange={e => setSaveToSharedLobe(e.target.checked)}
                className="h-4 w-4"
                data-testid="checkbox-shared-lobe"
              />
              <Label htmlFor="shared-lobe" className="cursor-pointer">
                Also write key decisions to shared lobe
                <span className="block text-xs text-muted-foreground font-normal">
                  Permanent shared brain — both Agent and Alden will see this
                </span>
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowSaveMemory(false)} data-testid="button-cancel-save-memory">
              Cancel
            </Button>
            <Button
              onClick={() => saveToMemory.mutate({ title: saveMemoryTitle, importance: saveMemoryImportance, saveToSharedLobe })}
              disabled={saveToMemory.isPending || !saveMemoryTitle.trim()}
              data-testid="button-confirm-save-memory"
            >
              {saveToMemory.isPending ? "Saving..." : "Save to Memory"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
