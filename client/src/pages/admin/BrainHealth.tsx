import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import { MetricsCard } from "@/components/admin/MetricsCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Brain, 
  Activity, 
  Zap, 
  Tag, 
  Users, 
  TrendingUp,
  RefreshCw,
  Clock,
  Database,
  Target,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Pause,
  Play
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface DashboardSummary {
  today: {
    memoryRetrievals: number;
    memoryInjections: number;
    toolCalls: number;
    actionTriggers: number;
    factsExtracted: number;
    uniqueStudents: number;
    avgLatency: number;
  };
  trends: { date: string; injections: number; toolCalls: number; factsExtracted: number }[];
  topTools: { name: string; count: number }[];
  topTriggers: { name: string; count: number }[];
  memoryHealth: {
    avgRelevance: number;
    avgFreshnessDays: number;
    injectionRate: number;
    redundancyRate: number;
  };
  factQuality: {
    totalFacts: number;
    specificityRate: number;
  };
}

interface LiveEvent {
  id: string;
  eventType: string;
  eventSource: string;
  sessionId: string | null;
  userId: string | null;
  toolName: string | null;
  actionTrigger: string | null;
  factType: string | null;
  relevanceScore: number | null;
  latencyMs: number | null;
  createdAt: string;
}

interface LiveEventsResponse {
  events: LiveEvent[];
  totalCount: number;
  oldestTimestamp: string | null;
}

interface Anomaly {
  type: 'high_latency' | 'low_relevance' | 'high_redundancy' | 'extraction_failure' | 'memory_starvation';
  severity: 'warning' | 'critical';
  message: string;
  affectedEvents: number;
  sampleEventIds: string[];
}

interface AnomaliesResponse {
  anomalies: Anomaly[];
  healthScore: number;
  recommendation: string | null;
}

export function BrainHealthContent() {
  const [liveMode, setLiveMode] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data: summary, isLoading, refetch } = useQuery<DashboardSummary>({
    queryKey: ["/api/admin/brain-health/dashboard"],
  });

  const { data: liveEvents, isLoading: isLiveLoading, refetch: refetchLive } = useQuery<LiveEventsResponse>({
    queryKey: ["/api/admin/brain-health/events/live"],
    enabled: liveMode,
  });

  const { data: anomalies, isLoading: isAnomaliesLoading, refetch: refetchAnomalies } = useQuery<AnomaliesResponse>({
    queryKey: ["/api/admin/brain-health/anomalies"],
  });

  const stableRefetchLive = useCallback(() => {
    refetchLive();
  }, [refetchLive]);

  useEffect(() => {
    if (liveMode) {
      stableRefetchLive();
      intervalRef.current = setInterval(stableRefetchLive, 3000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [liveMode, stableRefetchLive]);

  const handleRunAggregation = async () => {
    try {
      await apiRequest("POST", "/api/admin/brain-health/aggregate", {});
      refetch();
    } catch (error) {
      console.error("Aggregation failed:", error);
    }
  };

  const formatPercent = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return "0%";
    return `${Math.round(value * 100)}%`;
  };

  const formatNumber = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return "0";
    return value.toFixed(1);
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'memory_injection': return <Brain className="h-3 w-3" />;
      case 'memory_retrieval': return <Target className="h-3 w-3" />;
      case 'tool_call': return <Zap className="h-3 w-3" />;
      case 'action_trigger': return <Tag className="h-3 w-3" />;
      case 'fact_extraction': return <Sparkles className="h-3 w-3" />;
      default: return <Activity className="h-3 w-3" />;
    }
  };

  const getEventBadgeVariant = (eventType: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (eventType) {
      case 'memory_injection': return "default";
      case 'tool_call': return "secondary";
      case 'action_trigger': return "outline";
      default: return "secondary";
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Brain className="h-8 w-8" />
                Brain Health Monitor
              </h1>
              <p className="text-muted-foreground mt-1">
                Real-time observability into Daniela's memory, tool usage, and cognitive activity
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant={liveMode ? "default" : "outline"} 
                onClick={() => setLiveMode(!liveMode)} 
                data-testid="button-live-mode"
              >
                {liveMode ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                {liveMode ? "Pause Live" : "Go Live"}
                {liveMode && <Radio className="h-3 w-3 ml-2 animate-pulse text-destructive" />}
              </Button>
              <Button variant="outline" onClick={() => { refetch(); refetchAnomalies(); }} data-testid="button-refresh">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={handleRunAggregation} data-testid="button-aggregate">
                <Database className="h-4 w-4 mr-2" />
                Run Aggregation
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="grid-today-metrics">
                <div data-testid="card-memory-injections">
                  <MetricsCard
                    title="Memory Injections"
                    value={summary?.today.memoryInjections || 0}
                    description="Memories used today"
                    icon={Brain}
                  />
                </div>
                <div data-testid="card-tool-calls">
                  <MetricsCard
                    title="Tool Calls"
                    value={summary?.today.toolCalls || 0}
                    description="Whiteboard, functions, etc."
                    icon={Zap}
                  />
                </div>
                <div data-testid="card-action-triggers">
                  <MetricsCard
                    title="Action Triggers"
                    value={summary?.today.actionTriggers || 0}
                    description="SWITCH_TUTOR, DRILL, etc."
                    icon={Tag}
                  />
                </div>
                <div data-testid="card-facts-extracted">
                  <MetricsCard
                    title="Facts Extracted"
                    value={summary?.today.factsExtracted || 0}
                    description="Personal facts learned"
                    icon={Sparkles}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="grid-secondary-metrics">
                <div data-testid="card-unique-students">
                  <MetricsCard
                    title="Unique Students"
                    value={summary?.today.uniqueStudents || 0}
                    description="Active today"
                    icon={Users}
                  />
                </div>
                <div data-testid="card-avg-latency">
                  <MetricsCard
                    title="Avg Latency"
                    value={`${summary?.today.avgLatency || 0}ms`}
                    description="Memory retrieval speed"
                    icon={Clock}
                  />
                </div>
                <div data-testid="card-memory-retrievals">
                  <MetricsCard
                    title="Memory Retrievals"
                    value={summary?.today.memoryRetrievals || 0}
                    description="Passive lookups triggered"
                    icon={Target}
                  />
                </div>
                <div data-testid="card-injection-rate">
                  <MetricsCard
                    title="Injection Rate"
                    value={formatPercent(summary?.memoryHealth.injectionRate)}
                    description="Memories retrieved → used"
                    icon={CheckCircle2}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card data-testid="card-memory-health">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Memory Health
                    </CardTitle>
                    <CardDescription>
                      Quality metrics for Daniela's memory system
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Avg Relevance Score</span>
                        <span className="font-medium" data-testid="text-avg-relevance">{formatNumber(summary?.memoryHealth.avgRelevance)}</span>
                      </div>
                      <Progress 
                        value={(summary?.memoryHealth.avgRelevance || 0) * 100} 
                        className="h-2"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Memory Freshness</span>
                        <span className="font-medium" data-testid="text-avg-freshness">{formatNumber(summary?.memoryHealth.avgFreshnessDays)} days avg</span>
                      </div>
                      <Progress 
                        value={Math.max(0, 100 - (summary?.memoryHealth.avgFreshnessDays || 0) * 3)} 
                        className="h-2"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Redundancy Rate</span>
                        <span className="font-medium" data-testid="text-redundancy-rate">{formatPercent(summary?.memoryHealth.redundancyRate)}</span>
                      </div>
                      <Progress 
                        value={(summary?.memoryHealth.redundancyRate || 0) * 100} 
                        className="h-2 [&>div]:bg-orange-500"
                      />
                      <p className="text-xs text-muted-foreground">
                        Lower is better - repeated retrievals waste context
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-fact-quality">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      Fact Extraction Quality
                    </CardTitle>
                    <CardDescription>
                      Personal facts learned from students (last 7 days)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold" data-testid="text-total-facts">{summary?.factQuality.totalFacts || 0}</span>
                      <span className="text-muted-foreground">total facts extracted</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Specificity Rate</span>
                        <span className="font-medium" data-testid="text-specificity-rate">{formatPercent(summary?.factQuality.specificityRate)}</span>
                      </div>
                      <Progress 
                        value={(summary?.factQuality.specificityRate || 0) * 100} 
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground">
                        Higher is better - specific facts are more useful than vague ones
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card data-testid="card-top-tools">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      Top Tools (7 days)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {summary?.topTools && summary.topTools.length > 0 ? (
                      <div className="space-y-2">
                        {summary.topTools.map((tool, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <Badge variant="secondary" className="font-mono" data-testid={`badge-tool-${i}`}>
                              {tool.name}
                            </Badge>
                            <span className="text-sm text-muted-foreground">{tool.count}x</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground" data-testid="text-no-tools">No tool usage data yet</p>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="card-top-triggers">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Tag className="h-5 w-5" />
                      Top Action Triggers (7 days)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {summary?.topTriggers && summary.topTriggers.length > 0 ? (
                      <div className="space-y-2">
                        {summary.topTriggers.map((trigger, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <Badge variant="outline" className="font-mono" data-testid={`badge-trigger-${i}`}>
                              {trigger.name}
                            </Badge>
                            <span className="text-sm text-muted-foreground" data-testid={`text-trigger-count-${i}`}>{trigger.count}x</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground" data-testid="text-no-triggers">No action trigger data yet</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {summary?.trends && summary.trends.length > 0 && (
                <Card data-testid="card-activity-trends">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Activity Trends (14 days)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 flex items-end gap-1">
                      {summary.trends.map((day, i) => {
                        const maxValue = Math.max(...summary.trends.map(d => d.injections + d.toolCalls + d.factsExtracted));
                        const total = day.injections + day.toolCalls + day.factsExtracted;
                        const height = maxValue > 0 ? (total / maxValue) * 100 : 0;
                        return (
                          <div 
                            key={i} 
                            className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-t"
                            style={{ height: `${Math.max(height, 2)}%` }}
                            title={`${day.date}: ${total} events`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>{summary.trends[0]?.date}</span>
                      <span>{summary.trends[summary.trends.length - 1]?.date}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <Card data-testid="card-anomalies">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Anomaly Detection
                      </span>
                      {anomalies && (
                        <Badge 
                          variant={anomalies.healthScore >= 80 ? "default" : anomalies.healthScore >= 50 ? "secondary" : "destructive"}
                          data-testid="badge-health-score"
                        >
                          Health: {anomalies.healthScore}%
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Proactive issue detection (last 24 hours)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isAnomaliesLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-16" />
                        <Skeleton className="h-16" />
                      </div>
                    ) : anomalies?.anomalies && anomalies.anomalies.length > 0 ? (
                      <div className="space-y-3">
                        {anomalies.anomalies.map((anomaly, i) => (
                          <div 
                            key={i} 
                            className={`p-3 rounded-lg border ${anomaly.severity === 'critical' ? 'border-destructive/50 bg-destructive/10' : 'border-muted-foreground/30 bg-muted'}`}
                            data-testid={`anomaly-${i}`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={anomaly.severity === 'critical' ? 'destructive' : 'outline'} className="text-xs">
                                {anomaly.severity}
                              </Badge>
                              <span className="text-sm font-medium">{anomaly.type.replace(/_/g, ' ')}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{anomaly.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Affected: {anomaly.affectedEvents} events
                            </p>
                          </div>
                        ))}
                        {anomalies.recommendation && (
                          <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted rounded" data-testid="text-recommendation">
                            {anomalies.recommendation}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-primary" data-testid="text-no-anomalies">
                        <CheckCircle2 className="h-5 w-5" />
                        <span>No anomalies detected - brain is healthy!</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="card-live-events">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Radio className={`h-5 w-5 ${liveMode ? 'text-destructive animate-pulse' : ''}`} />
                        Live Events Feed
                      </span>
                      {liveMode && (
                        <Badge variant="outline" className="text-xs" data-testid="badge-live-count">
                          {liveEvents?.totalCount || 0} events
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {liveMode ? 'Streaming brain activity (refreshing every 3s)' : 'Click "Go Live" to start monitoring'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {liveMode ? (
                      <ScrollArea className="h-64">
                        {isLiveLoading && !liveEvents ? (
                          <div className="space-y-2">
                            <Skeleton className="h-12" />
                            <Skeleton className="h-12" />
                            <Skeleton className="h-12" />
                          </div>
                        ) : liveEvents?.events && liveEvents.events.length > 0 ? (
                          <div className="space-y-2">
                            {liveEvents.events.map((event, i) => (
                              <div 
                                key={event.id} 
                                className="p-2 rounded border bg-muted/50 text-sm"
                                data-testid={`live-event-${i}`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <Badge variant={getEventBadgeVariant(event.eventType)} className="text-xs flex items-center gap-1">
                                    {getEventIcon(event.eventType)}
                                    {event.eventType.replace(/_/g, ' ')}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">{formatTime(event.createdAt)}</span>
                                </div>
                                <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                                  {event.toolName && <span>Tool: {event.toolName}</span>}
                                  {event.actionTrigger && <span>Trigger: {event.actionTrigger}</span>}
                                  {event.latencyMs && <span>{event.latencyMs}ms</span>}
                                  {event.relevanceScore !== null && <span>Rel: {(event.relevanceScore * 100).toFixed(0)}%</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-live-events">
                            No events in the last 60 seconds. Start a voice session to see activity.
                          </p>
                        )}
                      </ScrollArea>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground" data-testid="live-mode-disabled">
                        <Radio className="h-8 w-8 mb-2 opacity-50" />
                        <p className="text-sm">Live monitoring is paused</p>
                        <p className="text-xs">Click "Go Live" to watch Daniela's brain in real-time</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
    </div>
  );
}

export default BrainHealthContent;
