import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { RefreshCw, TrendingUp, TrendingDown, Activity, AlertTriangle, Clock, Globe, Users, Zap, ChevronDown, ChevronUp, Radio, Play, Pause } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface LatencyTrend {
  stage: string;
  today: number;
  yesterday: number;
  weekAgo: number;
  trend: 'improving' | 'stable' | 'degrading' | 'critical';
  percentChange: number;
}

interface TimePattern {
  hour: number;
  avgLatency: number;
  eventCount: number;
  failureRate: number;
  isPeakHour: boolean;
}

interface LanguageMetrics {
  language: string;
  eventCount: number;
  failureRate: number;
  avgLatency: number;
  worstStage: string;
}

interface StudentIssue {
  userId: string;
  email?: string;
  eventCount: number;
  failureRate: number;
  avgLatency: number;
  likelyIssue: 'network' | 'device' | 'unknown' | 'none';
}

interface EnvComparison {
  metric: string;
  dev: number;
  prod: number;
  diff: number;
  diffPercent: number;
  alert: boolean;
}

interface VoiceAlert {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  environment: 'dev' | 'prod' | 'both';
  data?: any;
}

interface ComprehensiveReport {
  generatedAt: string;
  environment: string;
  periodDays: number;
  totalEvents: number;
  overallFailureRate: number;
  avgLatency: number;
  latencyTrends: LatencyTrend[];
  timeOfDayPatterns: TimePattern[];
  languageMetrics: LanguageMetrics[];
  studentIssues: StudentIssue[];
  envComparison: EnvComparison[];
  alerts: VoiceAlert[];
}

interface TelemetryEvent {
  timestamp: string;
  sessionId: string;
  eventType: string;
  playbackState?: string;
  chunkIndex?: number;
  sentenceIndex?: number;
  latencyMs?: number;
  isCorrelated?: boolean;
}

interface TelemetrySummary {
  totalEvents: number;
  avgDeliveryLatency: number;
  correlationRate: number;
  eventsByType: Record<string, number>;
  recentEvents: TelemetryEvent[];
  sessions: Array<{ sessionId: string; eventCount: number; lastActive: string }>;
}

function ClientTelemetryPanel() {
  const { data: telemetry, isLoading, refetch, isFetching } = useQuery<TelemetrySummary>({
    queryKey: ["/api/admin/voice-telemetry"],
    refetchInterval: 5000,
  });

  const getStateColor = (state: string) => {
    switch (state) {
      case 'playing': return 'bg-green-500';
      case 'buffering': return 'bg-yellow-500';
      case 'idle': return 'bg-gray-400';
      default: return 'bg-blue-500';
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Radio className="h-5 w-5 text-blue-500" />
          End-to-End Telemetry
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-telemetry"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Client Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-telemetry-total">
              {telemetry?.totalEvents?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">Last 24h</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Avg Delivery Latency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-delivery-latency">
              {telemetry?.avgDeliveryLatency ? `${Math.round(telemetry.avgDeliveryLatency)}ms` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Server → Client</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Correlation Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-correlation-rate">
              {telemetry?.correlationRate ? `${(telemetry.correlationRate * 100).toFixed(1)}%` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Events matched</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-sessions">
              {telemetry?.sessions?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">With telemetry</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Events by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(telemetry?.eventsByType || {}).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <span className="text-sm font-medium capitalize">{type.replace(/_/g, ' ')}</span>
                  <Badge variant="outline">{count as number}</Badge>
                </div>
              ))}
              {Object.keys(telemetry?.eventsByType || {}).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No events recorded</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Playback States</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-auto">
              {telemetry?.recentEvents?.filter(e => e.eventType === 'playback_state_change').slice(0, 10).map((event, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded bg-muted/50">
                  <div className={`w-2 h-2 rounded-full ${getStateColor(event.playbackState || 'unknown')}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize">{event.playbackState || 'unknown'}</p>
                    <p className="text-xs text-muted-foreground truncate">{event.sessionId.slice(0, 8)}...</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
              {(!telemetry?.recentEvents?.length || !telemetry.recentEvents.some(e => e.eventType === 'playback_state_change')) && (
                <p className="text-sm text-muted-foreground text-center py-4">No playback events</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session Telemetry</CardTitle>
          <CardDescription>Sessions with recent client-side reporting</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {telemetry?.sessions?.slice(0, 10).map((session) => (
              <div key={session.sessionId} className="flex items-center justify-between p-2 rounded bg-muted/50">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-mono">{session.sessionId.slice(0, 12)}...</span>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="outline">{session.eventCount} events</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(session.lastActive).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
            {(!telemetry?.sessions?.length) && (
              <p className="text-sm text-muted-foreground text-center py-4">No active sessions with telemetry</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function VoiceIntelligenceContent() {
  const { toast } = useToast();
  const [daysBack, setDaysBack] = useState("7");
  const [environment, setEnvironment] = useState<string>("all");
  const [alertsExpanded, setAlertsExpanded] = useState(true);

  const { data: report, isLoading, refetch, isFetching } = useQuery<ComprehensiveReport>({
    queryKey: ["/api/admin/voice-intelligence", { daysBack, environment: environment === "all" ? undefined : environment }],
  });

  const updateBaselinesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/voice-intelligence/update-baselines");
    },
    onSuccess: () => {
      toast({ title: "Baselines updated", description: "Historical baselines have been recalculated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/voice-intelligence"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'warning': return 'secondary';
      case 'info': return 'outline';
      default: return 'outline';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingDown className="h-4 w-4 text-green-500" />;
      case 'degrading': return <TrendingUp className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatLatency = (ms: number) => {
    if (ms > 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.round(ms)}ms`;
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Voice Intelligence</h1>
            <p className="text-sm text-muted-foreground">Comprehensive voice pipeline analytics</p>
          </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Select value={daysBack} onValueChange={setDaysBack}>
                <SelectTrigger className="w-[120px]" data-testid="select-days">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Last 24h</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="14">Last 14 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                </SelectContent>
              </Select>

              <Select value={environment} onValueChange={setEnvironment}>
                <SelectTrigger className="w-[140px]" data-testid="select-env">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Environments</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                data-testid="button-refresh"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => updateBaselinesMutation.mutate()}
                disabled={updateBaselinesMutation.isPending}
                data-testid="button-update-baselines"
              >
                <Zap className="h-4 w-4 mr-2" />
                Update Baselines
              </Button>
            </div>
          </div>

          {report?.alerts && report.alerts.length > 0 && (
            <Collapsible open={alertsExpanded} onOpenChange={setAlertsExpanded}>
              <Card className="border-yellow-500/50 bg-yellow-500/5">
                <CardHeader className="pb-2">
                  <CollapsibleTrigger className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      <CardTitle className="text-lg">Active Alerts ({report.alerts.length})</CardTitle>
                    </div>
                    {alertsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-2">
                    {report.alerts.map((alert, i) => (
                      <div key={i} className="flex items-start gap-3 p-2 rounded-md bg-background">
                        <Badge variant={getSeverityColor(alert.severity) as any} className="shrink-0">
                          {alert.severity}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{alert.category}</p>
                          <p className="text-sm">{alert.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {alert.environment === 'both' ? 'Dev & Prod' : alert.environment}
                          </p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList data-testid="tab-list">
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="latency" data-testid="tab-latency">Latency Trends</TabsTrigger>
                <TabsTrigger value="time" data-testid="tab-time">Time Patterns</TabsTrigger>
                <TabsTrigger value="languages" data-testid="tab-languages">Languages</TabsTrigger>
                <TabsTrigger value="students" data-testid="tab-students">Student Issues</TabsTrigger>
                <TabsTrigger value="environments" data-testid="tab-environments">Env Comparison</TabsTrigger>
                <TabsTrigger value="telemetry" data-testid="tab-telemetry">Client Telemetry</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Total Events
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-total-events">
                        {report?.totalEvents?.toLocaleString() || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">Last {daysBack} days</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Avg Latency
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-avg-latency">
                        {formatLatency(report?.avgLatency || 0)}
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        {getTrendIcon(report?.latencyTrends?.[0]?.trend || 'stable')}
                        <span className={
                          report?.latencyTrends?.[0]?.trend === 'improving' ? 'text-green-500' :
                          report?.latencyTrends?.[0]?.trend === 'degrading' ? 'text-red-500' :
                          'text-muted-foreground'
                        }>
                          {report?.latencyTrends?.[0]?.percentChange?.toFixed(1) || 0}% from yesterday
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Languages Active
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-languages">
                        {report?.languageMetrics?.length || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">With 10+ events</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Students w/ Issues
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-student-issues">
                        {report?.studentIssues?.filter(s => s.likelyIssue !== 'none').length || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">Need attention</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Quick Summary</CardTitle>
                    <CardDescription>Key metrics from the last {daysBack} days</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <h4 className="font-medium mb-2">Best Performing Languages</h4>
                        {report?.languageMetrics?.slice(0, 3).map((lang, i) => (
                          <div key={lang.language} className="flex items-center justify-between py-1">
                            <span className="text-sm">{lang.language}</span>
                            <Badge variant="outline" className="text-green-500">
                              {lang.failureRate.toFixed(1)}% fail rate
                            </Badge>
                          </div>
                        ))}
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Peak Hours</h4>
                        {report?.timeOfDayPatterns?.filter(t => t.isPeakHour).slice(0, 3).map((p, i) => (
                          <div key={p.hour} className="flex items-center justify-between py-1">
                            <span className="text-sm">{p.hour}:00 - {p.hour + 1}:00</span>
                            <span className="text-xs text-muted-foreground">{p.eventCount} events</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Environment Status</h4>
                        {report?.envComparison?.filter(c => c.alert).slice(0, 3).map((c, i) => (
                          <div key={c.metric} className="flex items-center justify-between py-1">
                            <span className="text-sm">{c.metric}</span>
                            <Badge variant="destructive">
                              {c.diffPercent.toFixed(0)}% diff
                            </Badge>
                          </div>
                        ))}
                        {(!report?.envComparison?.some(c => c.alert)) && (
                          <p className="text-sm text-green-500">All metrics within thresholds</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="latency" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Latency Trends by Stage</CardTitle>
                    <CardDescription>Pipeline stage performance comparison</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {report?.latencyTrends?.map((trend) => (
                        <div key={trend.stage} className="p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium capitalize">{trend.stage.replace(/_/g, ' ')}</span>
                            <div className="flex items-center gap-1">
                              {getTrendIcon(trend.trend)}
                              <span className={`text-sm ${
                                trend.trend === 'improving' ? 'text-green-500' :
                                trend.trend === 'degrading' ? 'text-red-500' :
                                trend.trend === 'critical' ? 'text-red-600 font-bold' :
                                'text-muted-foreground'
                              }`}>
                                {trend.percentChange > 0 ? '+' : ''}{trend.percentChange.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-xs">
                            <div>
                              <p className="text-muted-foreground">Today</p>
                              <p className="font-medium">{formatLatency(trend.today)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Yesterday</p>
                              <p className="font-medium">{formatLatency(trend.yesterday)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Week Ago</p>
                              <p className="font-medium">{formatLatency(trend.weekAgo)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {(!report?.latencyTrends || report.latencyTrends.length === 0) && (
                        <p className="text-sm text-muted-foreground text-center py-4">No latency data available</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="time" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Time of Day Patterns</CardTitle>
                    <CardDescription>Hourly performance breakdown (UTC)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                      {report?.timeOfDayPatterns?.map((pattern) => (
                        <div 
                          key={pattern.hour} 
                          className={`p-3 rounded-lg border ${pattern.isPeakHour ? 'border-primary bg-primary/5' : 'bg-muted/30'}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{pattern.hour.toString().padStart(2, '0')}:00</span>
                            {pattern.isPeakHour && <Badge variant="secondary">Peak</Badge>}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">Events</p>
                              <p className="font-medium">{pattern.eventCount}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Latency</p>
                              <p className="font-medium">{formatLatency(pattern.avgLatency)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Fail Rate</p>
                              <p className={`font-medium ${pattern.failureRate > 10 ? 'text-red-500' : ''}`}>
                                {pattern.failureRate.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="languages" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Per-Language Metrics</CardTitle>
                    <CardDescription>Performance breakdown by language</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {report?.languageMetrics?.map((lang) => (
                        <div key={lang.language} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                          <div className="w-32 shrink-0">
                            <span className="font-medium capitalize">{lang.language}</span>
                          </div>
                          <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs">Events</p>
                              <p className="font-medium">{lang.eventCount.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Fail Rate</p>
                              <p className={`font-medium ${lang.failureRate > 15 ? 'text-red-500' : lang.failureRate > 5 ? 'text-yellow-500' : 'text-green-500'}`}>
                                {lang.failureRate.toFixed(1)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Latency</p>
                              <p className="font-medium">{formatLatency(lang.avgLatency)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Worst Stage</p>
                              <Badge variant="outline" className="capitalize">{lang.worstStage.replace(/_/g, ' ')}</Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="students" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Student Issues</CardTitle>
                    <CardDescription>Students with recurring voice pipeline problems</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {report?.studentIssues?.filter(s => s.likelyIssue !== 'none').length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No students with significant issues detected</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {report?.studentIssues?.filter(s => s.likelyIssue !== 'none').map((student) => (
                          <div key={student.userId} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{student.email || student.userId}</p>
                              <p className="text-xs text-muted-foreground">{student.eventCount} events</p>
                            </div>
                            <div className="text-sm">
                              <span className={student.failureRate > 30 ? 'text-red-500' : 'text-yellow-500'}>
                                {student.failureRate.toFixed(1)}% fail
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatLatency(student.avgLatency)} avg
                            </div>
                            <Badge variant={student.likelyIssue === 'network' ? 'destructive' : 'secondary'}>
                              {student.likelyIssue}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="environments" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Environment Comparison</CardTitle>
                    <CardDescription>Development vs Production metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {report?.envComparison?.map((comparison) => (
                        <div 
                          key={comparison.metric} 
                          className={`flex items-center gap-4 p-3 rounded-lg ${comparison.alert ? 'bg-red-500/10 border border-red-500/30' : 'bg-muted/50'}`}
                        >
                          <div className="w-40 shrink-0">
                            <span className="font-medium text-sm capitalize">{comparison.metric.replace('_', ' ')}</span>
                          </div>
                          <div className="flex-1 grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Development</p>
                              <p className="font-medium">
                                {comparison.metric.includes('latency') 
                                  ? formatLatency(comparison.dev)
                                  : `${comparison.dev.toFixed(1)}%`
                                }
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Production</p>
                              <p className="font-medium">
                                {comparison.metric.includes('latency') 
                                  ? formatLatency(comparison.prod)
                                  : `${comparison.prod.toFixed(1)}%`
                                }
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Deviation</p>
                              <p className={`font-medium ${comparison.alert ? 'text-red-500' : 'text-green-500'}`}>
                                {comparison.diffPercent > 0 ? '+' : ''}{comparison.diffPercent.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                          {comparison.alert && (
                            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="telemetry" className="space-y-4">
                <ClientTelemetryPanel />
              </TabsContent>
            </Tabs>
          )}

          <div className="text-xs text-muted-foreground text-center">
            Report generated: {report?.generatedAt ? new Date(report.generatedAt).toLocaleString() : 'Loading...'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VoiceIntelligenceContent;
