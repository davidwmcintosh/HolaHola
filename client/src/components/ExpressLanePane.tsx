import { useState, useRef, useEffect } from "react";
import {
  Send,
  Mic,
  Loader2,
  Sparkles,
  Radio,
  Code,
  Wifi,
  WifiOff,
  Volume2,
  History,
  ChevronDown,
  ChevronRight,
  UserCheck,
  MessageSquare,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useFounderCollab } from "@/hooks/useFounderCollab";
import { useQuery } from "@tanstack/react-query";

// ── Resolution label helpers ─────────────────────────────────────────────────

import { getResolutionMeta, type ResolutionType } from "@/lib/absence-resolution-labels";

interface ResolutionConfig {
  label: string;
  icon: React.ReactNode;
  badgeVariant: "default" | "secondary" | "outline" | "destructive";
  className: string;
}

function getResolutionConfig(type: ResolutionType): ResolutionConfig {
  const meta = getResolutionMeta(type);
  const icon =
    type === "student_returned" ? (
      <UserCheck className="h-3 w-3" />
    ) : type === "message_queued" ? (
      <MessageSquare className="h-3 w-3" />
    ) : (
      <XCircle className="h-3 w-3" />
    );
  return { ...meta, icon };
}

// ── Absence history types ────────────────────────────────────────────────────

interface ResolvedNudge {
  nudgeId: string;
  userId: string;
  firstName: string | null;
  daysSinceLastSession: number;
  lastSessionDate: string | null;
  resolvedAt: string;
  resolutionType: ResolutionType;
}

// ── AbsenceHistoryPanel ──────────────────────────────────────────────────────

type FilterType = ResolutionType | "all";

function AbsenceHistoryPanel() {
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const queryKey =
    activeFilter === "all"
      ? ["/api/admin/absence-nudges/history"]
      : ["/api/admin/absence-nudges/history", { resolutionType: activeFilter }];

  const queryFn = async () => {
    const url =
      activeFilter === "all"
        ? "/api/admin/absence-nudges/history"
        : `/api/admin/absence-nudges/history?resolutionType=${activeFilter}`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to load history");
    return res.json() as Promise<{ history: ResolvedNudge[] }>;
  };

  // Always fetch the full list for summary counts (unfiltered)
  const { data: allData } = useQuery<{ history: ResolvedNudge[] }>({
    queryKey: ["/api/admin/absence-nudges/history"],
    refetchInterval: 60000,
  });

  const { data, isLoading, error } = useQuery<{ history: ResolvedNudge[] }>({
    queryKey,
    queryFn,
    refetchInterval: 60000,
  });

  const allHistory = allData?.history ?? [];
  const history = data?.history ?? [];

  // Compute summary counts from the unfiltered list
  const counts = {
    student_returned: allHistory.filter((n) => n.resolutionType === "student_returned").length,
    message_queued: allHistory.filter((n) => n.resolutionType === "message_queued").length,
    dismissed: allHistory.filter((n) => n.resolutionType === "dismissed").length,
  };

  const filters: Array<{ key: FilterType; label: string; count: number }> = [
    { key: "all", label: "All", count: allHistory.length },
    { key: "student_returned", label: "Returned", count: counts.student_returned },
    { key: "message_queued", label: "Messaged", count: counts.message_queued },
    { key: "dismissed", label: "Dismissed", count: counts.dismissed },
  ];

  if (isLoading && allHistory.length === 0) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-[10px] text-red-500 px-1 py-2">
        Failed to load history
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {/* Summary line */}
      {allHistory.length > 0 && (
        <p className="text-[10px] text-muted-foreground" data-testid="absence-history-summary">
          {counts.student_returned > 0 && (
            <span className="text-green-600 dark:text-green-400 font-medium">{counts.student_returned} returned</span>
          )}
          {counts.student_returned > 0 && counts.message_queued > 0 && <span> · </span>}
          {counts.message_queued > 0 && (
            <span className="text-blue-600 dark:text-blue-400 font-medium">{counts.message_queued} messaged</span>
          )}
          {(counts.student_returned > 0 || counts.message_queued > 0) && counts.dismissed > 0 && <span> · </span>}
          {counts.dismissed > 0 && (
            <span className="text-muted-foreground font-medium">{counts.dismissed} dismissed</span>
          )}
        </p>
      )}

      {/* Filter buttons */}
      {allHistory.length > 0 && (
        <div className="flex gap-1 flex-wrap" data-testid="absence-history-filters">
          {filters.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              data-testid={`filter-absence-${key}`}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                activeFilter === key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {label} {count > 0 && <span>({count})</span>}
            </button>
          ))}
        </div>
      )}

      {/* History list */}
      {history.length === 0 ? (
        <p className="text-[10px] text-muted-foreground px-1 py-1 italic">
          {allHistory.length === 0 ? "No resolved nudges yet" : "No nudges match this filter"}
        </p>
      ) : (
        <div className="space-y-1.5" data-testid="absence-nudge-history">
          {history.map((nudge) => {
            const cfg = getResolutionConfig(nudge.resolutionType);
            const name = nudge.firstName ?? `student …${nudge.userId.slice(-5)}`;
            const resolvedDate = new Date(nudge.resolvedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            return (
              <div
                key={nudge.nudgeId}
                className="flex items-start gap-1.5 rounded-md border bg-muted/30 px-2 py-1.5"
                data-testid={`absence-nudge-history-row-${nudge.nudgeId}`}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-medium block truncate">{name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {nudge.daysSinceLastSession}d absent · resolved {resolvedDate}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={`flex items-center gap-1 text-[10px] px-1.5 py-0 h-5 flex-shrink-0 border ${cfg.className}`}
                  data-testid={`absence-resolution-badge-${nudge.nudgeId}`}
                >
                  {cfg.icon}
                  {cfg.label}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── ExpressLanePane ──────────────────────────────────────────────────────────

export function ExpressLanePane() {
  const {
    state: syncState,
    voiceState: syncVoiceState,
    connect: syncConnect,
    disconnect: syncDisconnect,
    sendMessage: syncSendMessage,
    startVoiceRecording: syncStartVoice,
    stopVoiceRecording: syncStopVoice,
    replayMessage: syncReplayMessage,
    isConnected: syncIsConnected,
  } = useFounderCollab();

  const [message, setMessage] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    syncConnect();
    return () => {
      syncDisconnect();
    };
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [syncState.messages]);

  const handleSend = () => {
    if (message.trim() && syncIsConnected) {
      syncSendMessage("founder", message.trim());
      setMessage("");
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="express-lane-pane">
      {/* Status bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/30">
        {syncIsConnected ? (
          <div className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400">
            <Wifi className="h-3 w-3" />
            <span>Live</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <WifiOff className="h-3 w-3" />
            <span>{syncState.connectionState === "reconnecting" ? "Reconnecting..." : "Offline"}</span>
          </div>
        )}
        <span className="text-[10px] text-muted-foreground ml-auto">
          Founder + Daniela + Wren
        </span>
        {/* History toggle */}
        <button
          onClick={() => setHistoryOpen((v) => !v)}
          className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-toggle-absence-history"
          title="Absence nudge history"
        >
          <History className="h-3 w-3" />
          {historyOpen ? (
            <ChevronDown className="h-2.5 w-2.5" />
          ) : (
            <ChevronRight className="h-2.5 w-2.5" />
          )}
        </button>
      </div>

      {/* Collapsible absence history panel */}
      {historyOpen && (
        <div
          className="border-b bg-background/60 px-3 py-2 max-h-52 overflow-y-auto"
          data-testid="absence-history-panel"
        >
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            Resolved absence nudges
          </p>
          <AbsenceHistoryPanel />
        </div>
      )}

      {/* Message feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {syncState.messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            <Radio className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="text-xs">EXPRESS Lane ready</p>
          </div>
        ) : (
          syncState.messages.map((msg) => (
            <div
              key={msg.cursor}
              className={`p-2 rounded-md text-sm ${
                msg.role === "founder"
                  ? "bg-amber-500/10 border border-amber-500/20"
                  : msg.role === "daniela"
                  ? "bg-primary/10 border border-primary/20"
                  : msg.role === "wren"
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : "bg-muted border border-border"
              }`}
              data-testid={`express-msg-${msg.id}`}
            >
              <div className="flex items-center gap-1 mb-1">
                {msg.role === "founder" && <Code className="h-3 w-3 text-amber-500" />}
                {msg.role === "daniela" && <Sparkles className="h-3 w-3 text-primary" />}
                {msg.role === "wren" && <Radio className="h-3 w-3 text-emerald-500" />}
                <span className="font-medium text-[11px] capitalize">{msg.role}</span>
                {msg.messageType === "voice" && <Mic className="h-3 w-3 text-muted-foreground" />}
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                {msg.messageType === "voice" && msg.role === "daniela" && (
                  <button
                    onClick={() => syncReplayMessage(msg.id)}
                    className="p-1 rounded hover-elevate"
                    disabled={syncVoiceState.playingMessageId === msg.id}
                    data-testid={`button-replay-express-${msg.id}`}
                  >
                    {syncVoiceState.playingMessageId === msg.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Volume2 className="h-3 w-3" />
                    )}
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-xs">{msg.content}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-2 border-t space-y-1.5">
        {syncVoiceState.currentTranscript && (
          <div className="text-[10px] text-muted-foreground bg-muted/50 rounded p-1.5 animate-pulse">
            {syncVoiceState.currentTranscript}
          </div>
        )}

        {syncVoiceState.processingStatus === "thinking" && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Daniela is thinking...</span>
          </div>
        )}
        {syncVoiceState.processingStatus === "speaking" && (
          <div className="flex items-center gap-1.5 text-[10px] text-primary">
            <Sparkles className="h-3 w-3 animate-pulse" />
            <span>Daniela is speaking...</span>
          </div>
        )}

        <div className="flex gap-1.5 items-center">
          <Button
            className="flex-1 text-xs"
            variant={syncVoiceState.isRecording ? "destructive" : "outline"}
            size="sm"
            onPointerDown={() => syncStartVoice()}
            onPointerUp={() => syncStopVoice()}
            onPointerLeave={() => syncVoiceState.isRecording && syncStopVoice()}
            onPointerCancel={() => syncVoiceState.isRecording && syncStopVoice()}
            disabled={!syncIsConnected || syncVoiceState.processingStatus === "thinking" || syncVoiceState.processingStatus === "speaking"}
            data-testid="button-express-voice"
          >
            {syncVoiceState.isRecording ? (
              <>
                <Mic className="h-3 w-3 mr-1.5 animate-pulse" />
                <span>Release to send</span>
              </>
            ) : (
              <>
                <Mic className="h-3 w-3 mr-1.5" />
                <span>Hold to talk</span>
              </>
            )}
          </Button>
        </div>

        <div className="flex gap-1.5">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Or type..."
            className="flex-1 text-xs h-8"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={!syncIsConnected}
            data-testid="input-express-message"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSend}
            disabled={!syncIsConnected || !message.trim()}
            data-testid="button-send-express"
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
