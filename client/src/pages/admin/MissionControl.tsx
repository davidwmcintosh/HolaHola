import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Maximize2,
  Minimize2,
  Radio,
  Users,
  Heart,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Send,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Phone,
  PhoneOff,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConferenceCall } from "@/components/ConferenceCall";
import { ExpressLanePane } from "@/components/ExpressLanePane";

type PaneId = "conference" | "express" | "health" | null;

interface VoiceHealthData {
  status: "green" | "yellow" | "red";
  timestamp: string;
  reasons: string[];
  metrics: {
    last1h: { events: number; users: number; errors: number };
    last6h: { events: number; users: number; errors: number };
    last24h: { events: number; users: number; errors: number; triggerTypes?: string[] };
  };
}

function NudgeBadge() {
  const { data } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/absence-nudges/count"],
    refetchInterval: 30000,
  });
  const count = data?.count ?? 0;
  if (count === 0) return null;
  return (
    <Badge
      variant="destructive"
      className="h-4 min-w-4 px-1 text-[10px] leading-none"
      data-testid="badge-nudge-count"
    >
      {count}
    </Badge>
  );
}

interface VoipUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  phoneConsentSms: boolean;
}

function TestVoiceSmsPanel() {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ queueId: string; playbackUrl: string; message: string } | null>(null);

  const { data: voipData, isLoading: loadingUsers } = useQuery<{ users: VoipUser[] }>({
    queryKey: ["/api/admin/voip-users"],
    enabled: open,
    staleTime: 60_000,
  });

  const students = voipData?.users ?? [];

  const { mutate, isPending, isError, error } = useMutation<
    { queueId: string; playbackUrl: string; message: string },
    Error,
    { userId: string; message: string }
  >({
    mutationFn: async (body) => {
      const res = await fetch("/api/admin/test-voice-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || res.statusText);
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const fire = () => {
    setResult(null);
    mutate({ userId: userId.trim(), message: message.trim() });
  };

  const selectedStudent = students.find((s) => s.id === userId);

  return (
    <div className="border-t pt-3 mt-3" data-testid="test-sms-panel">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground w-full text-left"
        data-testid="button-toggle-test-sms"
      >
        <Send className="h-3.5 w-3.5 text-amber-500" />
        Test SMS Pipeline
        {open ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2">
          {/* Student selector */}
          <Select
            value={userId}
            onValueChange={(val) => { setUserId(val); setResult(null); }}
            data-testid="select-test-sms-student"
          >
            <SelectTrigger className="h-7 text-xs" data-testid="select-trigger-test-sms-student">
              {loadingUsers ? (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading students…
                </span>
              ) : (
                <SelectValue placeholder="Pick a student…" />
              )}
            </SelectTrigger>
            <SelectContent>
              {students.map((s) => {
                const name = [s.firstName, s.lastName].filter(Boolean).join(" ") || s.email || s.id;
                const canSms = !!s.phone && s.phoneConsentSms;
                const hasPhone = !!s.phone;
                return (
                  <SelectItem
                    key={s.id}
                    value={s.id}
                    className="text-xs"
                    data-testid={`option-student-${s.id}`}
                  >
                    <span className="flex items-center gap-1.5">
                      {canSms ? (
                        <Phone className="h-3 w-3 text-green-500 flex-shrink-0" />
                      ) : hasPhone ? (
                        <Phone className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                      ) : (
                        <PhoneOff className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                      )}
                      <span className={!hasPhone ? "text-muted-foreground/60" : ""}>{name}</span>
                      {canSms && (
                        <span className="ml-auto text-[10px] text-green-600 dark:text-green-400 font-medium">SMS✓</span>
                      )}
                      {hasPhone && !canSms && (
                        <span className="ml-auto text-[10px] text-yellow-600 dark:text-yellow-400">no consent</span>
                      )}
                      {!hasPhone && (
                        <span className="ml-auto text-[10px] text-muted-foreground/50">no phone</span>
                      )}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {/* Consent warning for selected student */}
          {selectedStudent && !selectedStudent.phoneConsentSms && (
            <p className="text-[10px] text-yellow-600 dark:text-yellow-400" data-testid="test-sms-consent-warning">
              {selectedStudent.phone
                ? "This student has a phone number but has not consented to SMS."
                : "This student has no phone number on file."}
            </p>
          )}

          <Textarea
            placeholder="Message (leave blank for default)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="text-xs min-h-[60px] resize-none"
            data-testid="input-test-sms-message"
          />
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={fire}
            disabled={isPending || !userId.trim()}
            data-testid="button-fire-test-sms"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
            Fire Test
          </Button>

          {isError && (
            <p className="text-xs text-red-500" data-testid="test-sms-error">{(error as Error).message}</p>
          )}

          {result && (
            <div className="rounded-md bg-green-500/10 p-2 space-y-1" data-testid="test-sms-result">
              <p className="text-xs text-green-700 dark:text-green-400">{result.message}</p>
              <a
                href={result.playbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 underline break-all"
                data-testid="link-test-sms-playback"
              >
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                {result.playbackUrl}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VoiceHealthPane() {
  const { data, isLoading, error, refetch } = useQuery<VoiceHealthData>({
    queryKey: ["/api/voice/health-score"],
    refetchInterval: 30000,
  });

  const statusConfig = {
    green: { label: "Healthy", icon: CheckCircle, color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
    yellow: { label: "Degraded", icon: AlertTriangle, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10" },
    red: { label: "Critical", icon: AlertTriangle, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
        <AlertTriangle className="h-5 w-5" />
        <span className="text-xs">Health data unavailable</span>
        <Button size="sm" variant="ghost" onClick={() => refetch()} data-testid="button-health-retry">
          Retry
        </Button>
      </div>
    );
  }

  const cfg = statusConfig[data.status];
  const StatusIcon = cfg.icon;

  return (
    <div className="flex flex-col gap-3 p-4 h-full overflow-y-auto" data-testid="voice-health-content">
      <div className={`flex items-center gap-2 p-2.5 rounded-md ${cfg.bg}`}>
        <StatusIcon className={`h-5 w-5 ${cfg.color}`} />
        <span className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {new Date(data.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <div className="space-y-1">
        {data.reasons.map((reason, i) => (
          <p key={i} className="text-xs text-muted-foreground">{reason}</p>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-1">
        {([
          { label: "1h", d: data.metrics.last1h },
          { label: "6h", d: data.metrics.last6h },
          { label: "24h", d: data.metrics.last24h },
        ] as const).map(({ label, d }) => (
          <div key={label} className="rounded-md bg-muted/50 p-2 text-center space-y-0.5">
            <div className="text-[10px] text-muted-foreground uppercase font-medium">{label}</div>
            <div className="text-sm font-semibold">{d.events}</div>
            <div className="text-[10px] text-muted-foreground">{d.users} users</div>
            {d.errors > 0 && (
              <div className="text-[10px] text-red-500 font-medium">{d.errors} errors</div>
            )}
          </div>
        ))}
      </div>

      {data.metrics.last24h.triggerTypes && data.metrics.last24h.triggerTypes.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase font-medium">Event Types (24h)</span>
          <div className="flex flex-wrap gap-1">
            {data.metrics.last24h.triggerTypes
              .filter(t => t && t !== "null")
              .map((type, i) => (
                <Badge key={i} variant="outline" className="text-[10px]">
                  {type}
                </Badge>
              ))}
          </div>
        </div>
      )}

      <TestVoiceSmsPanel />
    </div>
  );
}

interface PaneWrapperProps {
  id: PaneId;
  title: string;
  icon: React.ReactNode;
  expandedPane: PaneId;
  onToggleExpand: (id: PaneId) => void;
  children: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

function PaneWrapper({ id, title, icon, expandedPane, onToggleExpand, children, badge, className = "" }: PaneWrapperProps) {
  const isExpanded = expandedPane === id;
  const isHidden = expandedPane !== null && expandedPane !== id;

  return (
    <Card
      className={`flex flex-col overflow-hidden transition-all duration-200 ${isExpanded ? "fixed inset-4 z-50" : ""} ${isHidden ? "invisible h-0 overflow-hidden" : ""} ${className}`}
      data-testid={`pane-${id}`}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b flex-wrap">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-sm">{title}</span>
          {badge}
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onToggleExpand(isExpanded ? null : id)}
          data-testid={`button-expand-${id}`}
        >
          {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </Card>
  );
}

export default function MissionControl() {
  const [expandedPane, setExpandedPane] = useState<PaneId>(null);

  const toggleExpand = useCallback((id: PaneId) => {
    setExpandedPane(id);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && expandedPane) {
        setExpandedPane(null);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [expandedPane]);

  return (
    <div className="h-full w-full p-3 overflow-hidden" data-testid="mission-control">
      {expandedPane && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setExpandedPane(null)}
          data-testid="pane-overlay"
        />
      )}

      <div className={`grid h-full gap-3 ${expandedPane ? "" : "grid-cols-[1fr_380px] grid-rows-[1fr_1fr]"}`}>
        <PaneWrapper
          id="conference"
          title="Conference"
          icon={<Users className="h-4 w-4 text-primary" />}
          expandedPane={expandedPane}
          onToggleExpand={toggleExpand}
          className={expandedPane ? "" : "row-span-2"}
        >
          <div className="h-full flex flex-col">
            <ConferenceCall />
          </div>
        </PaneWrapper>

        <PaneWrapper
          id="express"
          title="EXPRESS Lane"
          icon={<Radio className="h-4 w-4 text-amber-500" />}
          expandedPane={expandedPane}
          onToggleExpand={toggleExpand}
          badge={<NudgeBadge />}
        >
          <ExpressLanePane />
        </PaneWrapper>

        <PaneWrapper
          id="health"
          title="Voice Health"
          icon={<Heart className="h-4 w-4 text-red-500" />}
          expandedPane={expandedPane}
          onToggleExpand={toggleExpand}
          badge={<VoiceHealthBadge />}
        >
          <VoiceHealthPane />
        </PaneWrapper>
      </div>
    </div>
  );
}

function VoiceHealthBadge() {
  const { data } = useQuery<VoiceHealthData>({
    queryKey: ["/api/voice/health-score"],
    refetchInterval: 30000,
  });

  if (!data) return null;

  const variants: Record<string, "outline" | "destructive" | "secondary"> = {
    green: "outline",
    yellow: "secondary",
    red: "destructive",
  };

  return (
    <Badge variant={variants[data.status]} className="text-[10px]" data-testid="badge-voice-health-status">
      {data.status === "green" ? "OK" : data.status === "yellow" ? "WARN" : "CRIT"}
    </Badge>
  );
}
