import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Clock, 
  DollarSign, 
  TrendingUp, 
  BarChart3, 
  RefreshCw, 
  MessageSquare,
  Loader2,
  GraduationCap,
  Users
} from "lucide-react";

interface AnalyticsData {
  period: string;
  dateRange: { start: string; end: string };
  summary: {
    totalSessions: number;
    totalDurationMinutes: number;
    totalDurationHours: number;
    totalExchanges: number;
    totalTtsCharacters: number;
    avgSessionDurationMinutes: number;
    avgExchangesPerSession: number;
  };
  byLanguage: Record<string, { sessions: number; durationSeconds: number; exchanges: number }>;
  byClass: Record<string, { sessions: number; durationSeconds: number; exchanges: number }>;
  durationDistribution: Record<string, number>;
  estimatedCosts: {
    deepgramStt: number;
    cartesiaTts: number;
    geminiLlm: number;
    total: number;
  };
}

interface ClassEstimate {
  classId: string;
  className: string;
  language: string;
  level: number | null;
  curriculumPathId: string | null;
  totalSessions: number;
  totalDurationHours: number;
  totalExchanges: number;
  enrolledStudents: number;
  avgHoursPerStudent: number;
}

interface StudentClass {
  id: string;
  name: string;
  language: string;
  allocatedSeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
}

export default function DeveloperDashboard() {
  const { toast } = useToast();
  const [period, setPeriod] = useState("30d");
  const [reloadingClassId, setReloadingClassId] = useState<string | null>(null);

  const { data: analytics, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/developer/analytics", { period }],
  });

  const { data: classEstimates, isLoading: estimatesLoading } = useQuery<{ classEstimates: ClassEstimate[] }>({
    queryKey: ["/api/developer/class-estimates"],
  });

  const { data: myClasses } = useQuery<StudentClass[]>({
    queryKey: ["/api/student/classes"],
  });

  const reloadCreditsMutation = useMutation({
    mutationFn: async ({ classId, hours }: { classId: string; hours: number }) => {
      return apiRequest("POST", "/api/developer/reload-credits", { classId, hours });
    },
    onSuccess: (_, { classId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/student/classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/usage/status"] });
      toast({ title: "Credits reloaded", description: "Your class credits have been reset to 120 hours" });
      setReloadingClassId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reload credits",
        variant: "destructive",
      });
      setReloadingClassId(null);
    },
  });

  const handleReloadCredits = (classId: string) => {
    setReloadingClassId(classId);
    reloadCreditsMutation.mutate({ classId, hours: 120 });
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  return (
    <RoleGuard allowedRoles={['developer', 'admin']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Developer Dashboard</h1>
              <p className="text-muted-foreground mt-2">
                Usage analytics, cost estimates, and credit management for testing
              </p>
            </div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px]" data-testid="select-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {analyticsLoading ? (
              [...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)
            ) : (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics?.summary.totalSessions || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {analytics?.summary.totalExchanges || 0} total exchanges
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Practice Time</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics?.summary.totalDurationHours || 0}h</div>
                    <p className="text-xs text-muted-foreground">
                      Avg {analytics?.summary.avgSessionDurationMinutes || 0} min/session
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">TTS Characters</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {((analytics?.summary.totalTtsCharacters || 0) / 1000).toFixed(1)}K
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Characters processed
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Estimated Cost</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(analytics?.estimatedCosts.total || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      STT + TTS + LLM
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Cost Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Cost Breakdown
              </CardTitle>
              <CardDescription>
                Estimated API costs based on usage during the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsLoading ? (
                <Skeleton className="h-20" />
              ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="p-4 rounded-lg border">
                    <div className="text-sm text-muted-foreground">Deepgram STT</div>
                    <div className="text-xl font-semibold mt-1">
                      {formatCurrency(analytics?.estimatedCosts.deepgramStt || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      @ $0.0043/min (Nova-3)
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <div className="text-sm text-muted-foreground">Cartesia TTS</div>
                    <div className="text-xl font-semibold mt-1">
                      {formatCurrency(analytics?.estimatedCosts.cartesiaTts || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      @ $0.015/1K chars
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <div className="text-sm text-muted-foreground">Gemini LLM</div>
                    <div className="text-xl font-semibold mt-1">
                      {formatCurrency(analytics?.estimatedCosts.geminiLlm || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      ~$0.0001/exchange
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Session Duration Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Session Duration Distribution
              </CardTitle>
              <CardDescription>
                How long students typically practice per session
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsLoading ? (
                <Skeleton className="h-32" />
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {analytics?.durationDistribution && Object.entries(analytics.durationDistribution).map(([bucket, count]) => (
                    <div key={bucket} className="flex flex-col items-center p-3 rounded-lg border min-w-[80px]">
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-xs text-muted-foreground">{bucket}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Classes - Credit Reload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                My Class Credits
              </CardTitle>
              <CardDescription>
                Reload credits for testing (resets to 120 hours)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myClasses && myClasses.length > 0 ? (
                <div className="space-y-3">
                  {myClasses.map((cls) => {
                    const usedHours = Math.round(cls.usedSeconds / 3600 * 10) / 10;
                    const remainingHours = Math.round(cls.remainingSeconds / 3600 * 10) / 10;
                    const totalHours = Math.round(cls.allocatedSeconds / 3600 * 10) / 10;
                    const percentUsed = cls.allocatedSeconds > 0 
                      ? Math.round((cls.usedSeconds / cls.allocatedSeconds) * 100)
                      : 0;
                    
                    return (
                      <div key={cls.id} className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex-1">
                          <div className="font-medium">{cls.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {cls.language} • {remainingHours}h remaining of {totalHours}h ({percentUsed}% used)
                          </div>
                          <div className="w-full bg-muted rounded-full h-2 mt-2">
                            <div 
                              className={`h-2 rounded-full ${percentUsed > 80 ? 'bg-destructive' : percentUsed > 50 ? 'bg-yellow-500' : 'bg-primary'}`}
                              style={{ width: `${Math.min(percentUsed, 100)}%` }}
                            />
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-4"
                          onClick={() => handleReloadCredits(cls.id)}
                          disabled={reloadingClassId === cls.id}
                          data-testid={`button-reload-${cls.id}`}
                        >
                          {reloadingClassId === cls.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          <span className="ml-2">Reload</span>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground">No classes enrolled. Join a class to test credit tracking.</p>
              )}
            </CardContent>
          </Card>

          {/* Class Estimates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Class Usage Estimates
              </CardTitle>
              <CardDescription>
                Usage data per class for completion time estimates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {estimatesLoading ? (
                <Skeleton className="h-40" />
              ) : classEstimates?.classEstimates && classEstimates.classEstimates.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Class</th>
                        <th className="text-left p-2 font-medium">Language</th>
                        <th className="text-right p-2 font-medium">Sessions</th>
                        <th className="text-right p-2 font-medium">Total Hours</th>
                        <th className="text-right p-2 font-medium">Students</th>
                        <th className="text-right p-2 font-medium">Avg Hours/Student</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classEstimates.classEstimates.map((cls) => (
                        <tr key={cls.classId} className="border-b">
                          <td className="p-2">{cls.className}</td>
                          <td className="p-2">
                            <Badge variant="outline">{cls.language}</Badge>
                          </td>
                          <td className="p-2 text-right">{cls.totalSessions}</td>
                          <td className="p-2 text-right">{cls.totalDurationHours}h</td>
                          <td className="p-2 text-right">{cls.enrolledStudents}</td>
                          <td className="p-2 text-right">{cls.avgHoursPerStudent}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground">No class usage data available yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Usage by Language */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Usage by Language
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analyticsLoading ? (
                <Skeleton className="h-32" />
              ) : analytics?.byLanguage && Object.keys(analytics.byLanguage).length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(analytics.byLanguage).map(([lang, data]) => (
                    <div key={lang} className="p-4 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <Badge>{lang}</Badge>
                      </div>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sessions:</span>
                          <span className="font-medium">{data.sessions}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Duration:</span>
                          <span className="font-medium">{formatDuration(data.durationSeconds)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Exchanges:</span>
                          <span className="font-medium">{data.exchanges}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No language usage data available yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </RoleGuard>
  );
}
