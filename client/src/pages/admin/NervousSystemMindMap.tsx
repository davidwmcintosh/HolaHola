import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain,
  Activity,
  Heart,
  Zap,
  BookOpen,
  Users,
  Network,
  RefreshCw,
  Volume2,
  Shield,
  Database,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface HealthDimension {
  name: string;
  status: string;
  score: number;
  reasons: string[];
  metrics: any;
}

interface BrainReport {
  overallStatus: string;
  overallScore: number;
  dimensions: Record<string, HealthDimension>;
  timestamp: string;
}

interface NervousSystemData {
  brain: BrainReport;
  context: {
    status: string;
    reasons: string[];
    sourceBreakdown: Record<string, { successRate: number; avgLatencyMs: number; total: number; failures: number }>;
  };
  recentDigests: Array<{
    id: string;
    issueType: string;
    userDescription: string;
    sofiaAnalysis: string;
    createdAt: string;
    status: string;
    diagnosticSnapshot?: any;
  }>;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; glow: string; pulse: string }> = {
  green: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    border: "border-emerald-500/30 dark:border-emerald-500/40",
    text: "text-emerald-700 dark:text-emerald-400",
    glow: "shadow-emerald-500/20",
    pulse: "",
  },
  yellow: {
    bg: "bg-amber-500/10 dark:bg-amber-500/15",
    border: "border-amber-500/30 dark:border-amber-500/40",
    text: "text-amber-700 dark:text-amber-400",
    glow: "shadow-amber-500/20",
    pulse: "animate-pulse",
  },
  red: {
    bg: "bg-red-500/10 dark:bg-red-500/15",
    border: "border-red-500/30 dark:border-red-500/40",
    text: "text-red-700 dark:text-red-400",
    glow: "shadow-red-500/20",
    pulse: "animate-pulse",
  },
};

const DIMENSION_CONFIG: Record<string, { icon: any; label: string; description: string; category: string }> = {
  memory: {
    icon: BookOpen,
    label: "Memory",
    description: "Retrieval, injection, relevance, freshness",
    category: "Cognitive Core",
  },
  neuralRetrieval: {
    icon: Brain,
    label: "Neural Network",
    description: "Knowledge tables, procedures, principles",
    category: "Cognitive Core",
  },
  neuralSync: {
    icon: Network,
    label: "Neural Sync",
    description: "Dev-to-prod sync pipeline, promotion queue",
    category: "Infrastructure",
  },
  studentLearning: {
    icon: Users,
    label: "Student Learning",
    description: "Coverage rates, fact extraction, personalization",
    category: "Student Interface",
  },
  toolOrchestration: {
    icon: Zap,
    label: "Tool Orchestration",
    description: "Function call latency, failure rates",
    category: "Infrastructure",
  },
  contextInjection: {
    icon: Database,
    label: "Context Injection",
    description: "Per-source assembly, classroom, intelligence",
    category: "Student Interface",
  },
};

function StatusIndicator({ status, size = "md" }: { status: string; size?: "sm" | "md" | "lg" }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.green;
  const sizeClasses = {
    sm: "h-2 w-2",
    md: "h-3 w-3",
    lg: "h-4 w-4",
  };

  return (
    <div className="relative flex items-center justify-center">
      <div className={`${sizeClasses[size]} rounded-full ${colors.bg} ${colors.border} border ${colors.pulse}`} />
      {status !== "green" && (
        <div className={`absolute ${sizeClasses[size]} rounded-full ${colors.bg} animate-ping opacity-40`} />
      )}
    </div>
  );
}

function ScoreRing({ score, status, size = 120 }: { score: number; status: string; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const colors = STATUS_COLORS[status] || STATUS_COLORS.green;

  const strokeColor = status === "green" ? "#10b981" : status === "yellow" ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="6"
          fill="none"
          className="text-muted-foreground/10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth="6"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-2xl font-bold ${colors.text}`} data-testid="text-overall-score">
          {score}
        </span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">score</span>
      </div>
    </div>
  );
}

function DimensionNode({
  dimensionKey,
  dimension,
  isExpanded,
  onToggle,
}: {
  dimensionKey: string;
  dimension: HealthDimension;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const config = DIMENSION_CONFIG[dimensionKey] || DIMENSION_CONFIG.memory;
  const colors = STATUS_COLORS[dimension.status] || STATUS_COLORS.green;
  const Icon = config?.icon || Activity;

  return (
    <div
      className={`border rounded-md transition-all duration-300 ${colors.border} ${colors.bg} ${
        dimension.status !== "green" ? `shadow-lg ${colors.glow}` : ""
      }`}
      data-testid={`card-dimension-${dimensionKey}`}
    >
      <Button
        variant="ghost"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 h-auto justify-start"
        data-testid={`button-toggle-${dimensionKey}`}
      >
        <div className={`p-2 rounded-md ${colors.bg}`}>
          <Icon className={`h-4 w-4 ${colors.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{dimension.name}</span>
            <StatusIndicator status={dimension.status} size="sm" />
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {config?.description || ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${colors.text}`}>{dimension.score}</span>
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </Button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2">
          {dimension.reasons.map((reason, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              {dimension.status === "green" ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className={`h-3 w-3 ${colors.text} mt-0.5 shrink-0`} />
              )}
              <span className="text-muted-foreground">{reason}</span>
            </div>
          ))}
          {dimension.metrics && typeof dimension.metrics === "object" && Object.keys(dimension.metrics).length > 0 && (
            <div className="mt-2 p-2 rounded bg-muted/50">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Metrics</div>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(dimension.metrics).slice(0, 6).map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <span className="text-muted-foreground">{key}: </span>
                    <span className="font-mono">
                      {typeof value === "number" ? (value % 1 === 0 ? value : value.toFixed(2)) :
                       typeof value === "object" ? JSON.stringify(value).slice(0, 40) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DigestCard({ digest }: { digest: any }) {
  const [expanded, setExpanded] = useState(false);
  const isBrain = digest.sofiaAnalysis?.startsWith("[BRAIN]");
  const isVoice = digest.issueType === "voice_health_transition";
  const label = isBrain ? "Brain" : isVoice ? "Voice" : "Context";
  const time = new Date(digest.createdAt);
  const transition = digest.diagnosticSnapshot?.transition;

  return (
    <div className="border rounded-md p-3 space-y-2" data-testid={`card-digest-${digest.id}`}>
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{label}</Badge>
        {transition && (
          <Badge variant={transition.direction === "recovered" ? "default" : "destructive"}>
            {transition.previousStatus} {"->"} {transition.newStatus}
          </Badge>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {time.toLocaleDateString()} {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{digest.userDescription}</p>
      {digest.sofiaAnalysis && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="h-auto py-1 px-2 text-xs"
          data-testid={`button-expand-digest-${digest.id}`}
        >
          {expanded ? "Hide analysis" : "Show Sofia's analysis"}
        </Button>
      )}
      {expanded && digest.sofiaAnalysis && (
        <div className="p-2 rounded bg-muted/50 text-xs whitespace-pre-wrap">
          {digest.sofiaAnalysis}
        </div>
      )}
    </div>
  );
}

export function NervousSystemMindMap() {
  const [expandedDimensions, setExpandedDimensions] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch, isFetching } = useQuery<NervousSystemData>({
    queryKey: ["/api/admin/brain-health/nervous-system"],
    refetchInterval: 60000,
  });

  const toggleDimension = (name: string) => {
    setExpandedDimensions(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No brain health data available
      </div>
    );
  }

  const { brain, context, recentDigests } = data;
  const overallColors = STATUS_COLORS[brain.overallStatus] || STATUS_COLORS.green;

  const cognitiveCore = Object.entries(brain.dimensions).filter(
    ([k]) => k === "memory" || k === "neuralRetrieval"
  );
  const studentInterface = Object.entries(brain.dimensions).filter(
    ([k]) => k === "studentLearning" || k === "contextInjection"
  );
  const infrastructure = Object.entries(brain.dimensions).filter(
    ([k]) => k === "neuralSync" || k === "toolOrchestration"
  );

  return (
    <div className="space-y-6" data-testid="nervous-system-mind-map">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-md ${overallColors.bg}`}>
            <Brain className={`h-5 w-5 ${overallColors.text}`} />
          </div>
          <div>
            <h2 className="text-lg font-semibold" data-testid="text-page-title">Daniela's Nervous System</h2>
            <p className="text-xs text-muted-foreground">
              Unified cognitive health across all subsystems
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={overallColors.text} data-testid="badge-overall-status">
            {brain.overallStatus.toUpperCase()}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh"
          >
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`${overallColors.border} border col-span-1`}>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <ScoreRing score={brain.overallScore} status={brain.overallStatus} />
            <div className="mt-3 text-center">
              <div className="text-sm font-medium">Overall Brain Health</div>
              <div className="text-xs text-muted-foreground mt-1">
                {Object.values(brain.dimensions).filter(d => d.status === "green").length}/
                {Object.values(brain.dimensions).length} dimensions healthy
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Voice Pipeline</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Voice Monitor</span>
                <Badge variant="outline" className="text-xs">Active</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">TTS Provider</span>
                <span className="text-xs font-medium">Google Chirp 3 HD</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">STT Provider</span>
                <span className="text-xs font-medium">Deepgram Nova-3</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Check Interval</span>
                <span className="text-xs font-mono">15min</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Context Injection</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {context.sourceBreakdown && Object.keys(context.sourceBreakdown).length > 0 ? (
                Object.entries(context.sourceBreakdown).slice(0, 5).map(([source, stats]) => (
                  <div key={source} className="flex items-center justify-between" data-testid={`text-context-source-${source}`}>
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">{source}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono" data-testid={`text-context-rate-${source}`}>{stats.successRate}%</span>
                      <StatusIndicator
                        status={stats.successRate >= 80 ? "green" : stats.successRate >= 50 ? "yellow" : "red"}
                        size="sm"
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">
                  {context.reasons?.[0] || "No active context injection data"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Cognitive Architecture
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cognitive Core
              </span>
            </div>
            {cognitiveCore.map(([key, dim]) => (
              <DimensionNode
                key={key}
                dimensionKey={key}
                dimension={dim}
                isExpanded={expandedDimensions.has(key)}
                onToggle={() => toggleDimension(key)}
              />
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Student Interface
              </span>
            </div>
            {studentInterface.map(([key, dim]) => (
              <DimensionNode
                key={key}
                dimensionKey={key}
                dimension={dim}
                isExpanded={expandedDimensions.has(key)}
                onToggle={() => toggleDimension(key)}
              />
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Network className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Infrastructure
              </span>
            </div>
            {infrastructure.map(([key, dim]) => (
              <DimensionNode
                key={key}
                dimensionKey={key}
                dimension={dim}
                isExpanded={expandedDimensions.has(key)}
                onToggle={() => toggleDimension(key)}
              />
            ))}
          </div>
        </div>
      </div>

      {recentDigests && recentDigests.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Recent Sofia Health Digests
            </span>
          </div>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2 pr-4">
              {recentDigests.map((digest: any) => (
                <DigestCard key={digest.id} digest={digest} />
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground text-center pt-2" data-testid="text-last-updated">
        Last updated: {brain.timestamp ? new Date(brain.timestamp).toLocaleTimeString() : "..."} | Auto-refresh every 60s
      </div>
    </div>
  );
}