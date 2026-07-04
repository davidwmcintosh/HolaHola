import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Radio,
  Eye,
  MessageSquare,
  Zap,
  Brain,
  Image as ImageIcon,
  BookOpen,
  RefreshCw,
  Pause,
  Play,
  ChevronDown,
  ExternalLink,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonitorMessage {
  id: string;
  role: string;
  content: string;
  targetLanguageText?: string | null;
  actflLevel?: string | null;
  createdAt: string;
}

interface BrainEvent {
  id: string;
  eventType: string;
  toolName?: string | null;
  sessionId?: string | null;
  memoryQuery?: string | null;
  factContent?: string | null;
  createdAt: string;
}

interface VisionImage {
  id: string;
  imageUrl: string;
  description?: string | null;
  createdAt: string;
  lastUsedAt: string;
}

interface MonitorData {
  active: boolean;
  conversationId: string | null;
  targetUserId?: string;
  messages: MonitorMessage[];
  events: BrainEvent[];
  images: VisionImage[];
  serverTime: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

const EVENT_COLORS: Record<string, string> = {
  tool_call: "text-blue-500",
  memory_retrieval: "text-violet-500",
  memory_injection: "text-purple-500",
  memory_lookup_tool: "text-purple-400",
  action_trigger: "text-amber-500",
  fact_extraction: "text-green-500",
  context_injection: "text-cyan-500",
};

const EVENT_ICONS: Record<string, React.ReactNode> = {
  tool_call: <Zap className="h-3 w-3" />,
  memory_retrieval: <Brain className="h-3 w-3" />,
  memory_injection: <Brain className="h-3 w-3" />,
  memory_lookup_tool: <Brain className="h-3 w-3" />,
  action_trigger: <Radio className="h-3 w-3" />,
  fact_extraction: <BookOpen className="h-3 w-3" />,
  context_injection: <Eye className="h-3 w-3" />,
};

function EventBadgeVariant(type: string): "default" | "secondary" | "outline" | "destructive" {
  if (type === "tool_call" || type === "action_trigger") return "default";
  if (type.includes("memory")) return "secondary";
  return "outline";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MessageBubble({ msg, isNew }: { msg: MonitorMessage; isNew: boolean }) {
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";

  if (isSystem) return null;

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} gap-2 ${isNew ? "animate-in fade-in slide-in-from-bottom-2 duration-300" : ""}`}
      data-testid={`msg-${msg.id}`}
    >
      <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
        <div className="flex items-center gap-1.5 px-1">
          <span className="text-[10px] text-muted-foreground">
            {isUser ? "David" : "Daniela"}
          </span>
          {msg.actflLevel && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
              {msg.actflLevel.replace("_", " ")}
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
        </div>
        <div
          className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground"
          }`}
        >
          {msg.content}
          {msg.targetLanguageText && msg.targetLanguageText !== msg.content && (
            <div className="mt-1 pt-1 border-t border-current/20 text-xs opacity-75 italic">
              {msg.targetLanguageText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: BrainEvent }) {
  const colorClass = EVENT_COLORS[event.eventType] || "text-muted-foreground";
  const icon = EVENT_ICONS[event.eventType] || <Zap className="h-3 w-3" />;
  const label = event.toolName || event.eventType.replace(/_/g, " ");
  const detail = event.memoryQuery || event.factContent;

  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-border/50 last:border-0" data-testid={`event-${event.id}`}>
      <span className={`mt-0.5 flex-shrink-0 ${colorClass}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-medium ${colorClass}`}>{label}</span>
          <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatTime(event.createdAt)}</span>
        </div>
        {detail && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{truncate(detail, 80)}</p>
        )}
      </div>
    </div>
  );
}

function VisionCard({ image }: { image: VisionImage }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border overflow-hidden" data-testid={`vision-${image.id}`}>
      <div className="relative">
        <img
          src={image.imageUrl}
          alt={image.description || "Image shown to student"}
          className="w-full h-28 object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <div className="absolute top-1 right-1">
          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 opacity-90">
            {formatTime(image.lastUsedAt)}
          </Badge>
        </div>
      </div>
      {image.description && (
        <div className="p-2">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {expanded ? image.description : truncate(image.description, 100)}
          </p>
          {image.description.length > 100 && (
            <button
              className="text-[10px] text-primary mt-0.5"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "less" : "more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LiveMonitorContent() {
  const [isLive, setIsLive] = useState(true);
  const [allMessages, setAllMessages] = useState<MonitorMessage[]>([]);
  const [seenMessageIds, setSeenMessageIds] = useState<Set<string>>(new Set());
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());
  const [lastServerTime, setLastServerTime] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Initial full load when conversation is discovered
  const { data: fullLoad } = useQuery<{ messages: MonitorMessage[] }>({
    queryKey: ["/api/admin/live-monitor/all-messages", conversationId],
    enabled: !!conversationId && !initialized,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (fullLoad?.messages && !initialized) {
      setAllMessages(fullLoad.messages);
      const ids = new Set(fullLoad.messages.map((m) => m.id));
      setSeenMessageIds(ids);
      setInitialized(true);
      setTimeout(() => transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [fullLoad, initialized]);

  // Live poll — delta since last server time
  const { data: liveData, dataUpdatedAt } = useQuery<MonitorData>({
    queryKey: ["/api/admin/live-monitor"],
    enabled: isLive,
    refetchInterval: isLive ? 3000 : false,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  useEffect(() => {
    if (!liveData) return;

    // Discover conversation
    if (liveData.conversationId && !conversationId) {
      setConversationId(liveData.conversationId);
    }

    // Merge new messages
    if (liveData.messages.length > 0) {
      const incoming = liveData.messages.filter((m) => !seenMessageIds.has(m.id));
      if (incoming.length > 0) {
        const incomingIds = new Set(incoming.map((m) => m.id));
        setAllMessages((prev) => [...prev, ...incoming]);
        setSeenMessageIds((prev) => {
          const next = new Set(prev);
          incoming.forEach((m) => next.add(m.id));
          return next;
        });
        setNewMessageIds(incomingIds);
        setTimeout(() => transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        // Clear "new" highlight after 3s
        setTimeout(() => setNewMessageIds(new Set()), 3000);
      }
    }

    setLastServerTime(liveData.serverTime);
  }, [liveData, dataUpdatedAt]);

  const handleClear = useCallback(() => {
    setAllMessages([]);
    setSeenMessageIds(new Set());
    setNewMessageIds(new Set());
    setConversationId(null);
    setInitialized(false);
    setLastServerTime(null);
    queryClient.removeQueries({ queryKey: ["/api/admin/live-monitor/all-messages"] });
  }, []);

  const isActive = liveData?.active ?? false;
  const events = liveData?.events ?? [];
  const images = liveData?.images ?? [];
  const visibleMessages = allMessages.filter((m) => m.role !== "system");

  return (
    <div className="flex flex-col h-full gap-4 p-4 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio
              className={`h-5 w-5 ${isLive && isActive ? "text-destructive animate-pulse" : "text-muted-foreground"}`}
              data-testid="icon-live-radio"
            />
            <h1 className="text-lg font-semibold">Luca Live Monitor</h1>
          </div>
          <Badge
            variant={isActive ? "default" : "outline"}
            className="text-xs"
            data-testid="badge-session-status"
          >
            {isActive ? "Session active" : "Waiting for session"}
          </Badge>
          {isLive && lastServerTime && (
            <span className="text-xs text-muted-foreground" data-testid="text-last-update">
              updated {formatTime(lastServerTime)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={isLive ? "default" : "outline"}
            onClick={() => setIsLive((v) => !v)}
            data-testid="button-toggle-live"
          >
            {isLive ? <><Pause className="h-3.5 w-3.5 mr-1" />Pause</> : <><Play className="h-3.5 w-3.5 mr-1" />Resume</>}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleClear}
            data-testid="button-clear"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Reset
          </Button>
          {conversationId && (
            <a
              href={`/`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-open-chat"
            >
              <Button size="sm" variant="outline">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Open Chat
              </Button>
            </a>
          )}
        </div>
      </div>

      {conversationId && (
        <p className="text-[11px] text-muted-foreground -mt-2" data-testid="text-conversation-id">
          Conversation: <span className="font-mono">{conversationId}</span>
        </p>
      )}

      {/* Main grid */}
      <div className="flex gap-4 flex-1 min-h-0" style={{ minHeight: 0 }}>
        {/* Transcript */}
        <Card className="flex flex-col flex-1 min-h-0" data-testid="card-transcript">
          <CardHeader className="pb-2 pt-3 px-4 flex-shrink-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Live Transcript
              <Badge variant="outline" className="text-xs ml-auto" data-testid="badge-message-count">
                {visibleMessages.length} messages
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 px-4 pb-4">
            <ScrollArea className="h-full" ref={scrollAreaRef as any}>
              {visibleMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
                  <MessageSquare className="h-8 w-8 opacity-30" />
                  <p className="text-sm text-center">
                    {isLive ? "Waiting for conversation…" : "Paused — no messages loaded"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 pr-2">
                  {visibleMessages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      isNew={newMessageIds.has(msg.id)}
                    />
                  ))}
                  <div ref={transcriptEndRef} />
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-4 w-80 flex-shrink-0 min-h-0">
          {/* Daniela Vision */}
          <Card className="flex flex-col" style={{ maxHeight: "50%" }} data-testid="card-vision">
            <CardHeader className="pb-2 pt-3 px-4 flex-shrink-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Daniela Vision
                <Badge variant="outline" className="text-xs ml-auto" data-testid="badge-image-count">
                  {images.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 px-4 pb-4">
              <ScrollArea className="h-full">
                {images.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-24 text-muted-foreground gap-2">
                    <ImageIcon className="h-6 w-6 opacity-30" />
                    <p className="text-xs">No images shown yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 pr-1">
                    {images.map((img) => (
                      <VisionCard key={img.id} image={img} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Brain Activity */}
          <Card className="flex flex-col flex-1 min-h-0" data-testid="card-brain-activity">
            <CardHeader className="pb-2 pt-3 px-4 flex-shrink-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Brain Activity
                <Badge variant="outline" className="text-xs ml-auto" data-testid="badge-event-count">
                  {events.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 px-4 pb-4">
              <ScrollArea className="h-full">
                {events.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-24 text-muted-foreground gap-2">
                    <Brain className="h-6 w-6 opacity-30" />
                    <p className="text-xs">{isLive ? "Waiting for activity…" : "No activity"}</p>
                  </div>
                ) : (
                  <div className="pr-1">
                    {events.map((event) => (
                      <EventRow key={event.id} event={event} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function LiveMonitor() {
  return <LiveMonitorContent />;
}
