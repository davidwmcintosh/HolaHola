import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { MetricsCard } from "@/components/admin/MetricsCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  CheckCircle2
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

export default function BrainHealth() {
  const { data: summary, isLoading, refetch } = useQuery<DashboardSummary>({
    queryKey: ["/api/admin/brain-health/dashboard"],
  });

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

  return (
    <RoleGuard allowedRoles={["admin", "founder"]}>
      <AdminLayout>
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
              <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
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
            </>
          )}
        </div>
      </AdminLayout>
    </RoleGuard>
  );
}
