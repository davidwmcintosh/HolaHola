import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Maximize2,
  Minimize2,
  Activity,
  Radio,
  Users,
  Heart,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
} from "lucide-react";
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
