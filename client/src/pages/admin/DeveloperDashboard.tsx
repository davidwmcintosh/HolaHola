import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Users,
  Plus,
  Activity,
  AlertTriangle,
  Globe,
  Database,
  CheckCircle,
  XCircle,
  Image,
  Trash2,
  ShieldAlert,
  RotateCcw,
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

interface PlatformStats {
  activeUsers: { dau: number; wau: number; mau: number };
  usersByRole: Record<string, number>;
  languagePopularity: Array<{
    language: string;
    sessions: number;
    durationHours: number;
    uniqueUsers: number;
  }>;
  errorRate: number;
  dailyTrend: Array<{
    date: string;
    sessions: number;
    durationMinutes: number;
  }>;
}

const LANGUAGES = [
  "Spanish", "French", "German", "Italian", "Portuguese", 
  "Mandarin", "Japanese", "Korean", "Russian"
];

export default function DeveloperDashboard() {
  const { toast } = useToast();
  const [period, setPeriod] = useState("30d");
  const [userType, setUserType] = useState("all");
  const [reloadingClassId, setReloadingClassId] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState("Spanish");
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [davidNoteInput, setDavidNoteInput] = useState("");

  const { data: davidNoteData, refetch: refetchDavidNote } = useQuery<{ note: string | null }>({
    queryKey: ["/api/admin/classroom/david-note"],
  });

  const saveDavidNoteMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/classroom/david-note', { note: davidNoteInput }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: 'Note saved', description: "Daniela will see your note at the top of her classroom next session." });
      refetchDavidNote();
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/developer/analytics", { period, userType }],
  });

  const { data: classEstimates, isLoading: estimatesLoading } = useQuery<{ classEstimates: ClassEstimate[] }>({
    queryKey: ["/api/developer/class-estimates"],
  });

  const { data: myClasses, isLoading: classesLoading } = useQuery<StudentClass[]>({
    queryKey: ["/api/student/classes"],
  });

  const { data: platformStats, isLoading: statsLoading } = useQuery<PlatformStats>({
    queryKey: ["/api/developer/platform-stats"],
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

  const createTestClassMutation = useMutation({
    mutationFn: async ({ language, hours }: { language: string; hours: number }) => {
      return apiRequest("POST", "/api/developer/create-test-class", { language, hours });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/student/classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/developer/class-estimates"] });
      toast({ 
        title: "Test class created", 
        description: `Created "${data.class?.name}" with ${data.class?.allocatedHours} hours` 
      });
      setIsCreatingClass(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create test class",
        variant: "destructive",
      });
      setIsCreatingClass(false);
    },
  });

  const handleReloadCredits = (classId: string) => {
    setReloadingClassId(classId);
    reloadCreditsMutation.mutate({ classId, hours: 120 });
  };

  const handleCreateTestClass = () => {
    setIsCreatingClass(true);
    createTestClassMutation.mutate({ language: selectedLanguage, hours: 120 });
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
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Developer Dashboard</h1>
              <p className="text-muted-foreground mt-2">
                Usage analytics, cost estimates, and testing tools
              </p>
            </div>
          </div>

          <Tabs defaultValue="testing" className="space-y-6">
            <div className="overflow-x-auto w-full">
              <TabsList className="flex w-max">
                <TabsTrigger value="testing" data-testid="tab-testing">Testing Tools</TabsTrigger>
                <TabsTrigger value="vocab-images" data-testid="tab-vocab-images">Vocab Images</TabsTrigger>
                <TabsTrigger value="analytics" data-testid="tab-analytics">Usage Analytics</TabsTrigger>
                <TabsTrigger value="platform" data-testid="tab-platform">Platform Stats</TabsTrigger>
                <TabsTrigger value="neon" data-testid="tab-neon">Database Migration</TabsTrigger>
                <TabsTrigger value="image-audit" data-testid="tab-image-audit">
                  <ShieldAlert className="h-3.5 w-3.5 mr-1 text-destructive" />
                  Image Audit
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Testing Tools Tab */}
            <TabsContent value="testing" className="space-y-6">
              {/* Note from David to Daniela */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Note to Daniela
                  </CardTitle>
                  <CardDescription>
                    Leave a personal note that appears at the top of Daniela's classroom at the start of every session.
                    {davidNoteData?.note && (
                      <span className="block mt-1 text-xs text-muted-foreground italic">Current: "{davidNoteData.note.substring(0, 80)}{davidNoteData.note.length > 80 ? '…' : ''}"</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <textarea
                      value={davidNoteInput || (davidNoteData?.note ?? '')}
                      onChange={e => setDavidNoteInput(e.target.value)}
                      placeholder="e.g. Focus on warmth today — David had a rough week. Lean into the connection."
                      className="w-full h-24 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                      data-testid="input-david-note"
                    />
                    <Button
                      size="sm"
                      onClick={() => saveDavidNoteMutation.mutate()}
                      disabled={saveDavidNoteMutation.isPending || !davidNoteInput.trim()}
                      data-testid="button-save-david-note"
                    >
                      {saveDavidNoteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      Save Note
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Quick Test Setup
                  </CardTitle>
                  <CardDescription>
                    Create a test class to practice with the voice tutor and test credit consumption
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-4">
                    <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                      <SelectTrigger className="w-[180px]" data-testid="select-test-language">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map(lang => (
                          <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={handleCreateTestClass}
                      disabled={isCreatingClass}
                      data-testid="button-create-test-class"
                    >
                      {isCreatingClass ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Create Test Class (120h)
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Creates a class with you as both teacher and student, pre-loaded with 120 hours of credits.
                  </p>
                </CardContent>
              </Card>

              {/* My Classes - Credit Reload */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5" />
                    My Test Classes
                  </CardTitle>
                  <CardDescription>
                    Reload credits to reset used hours back to 120 hours for testing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {classesLoading ? (
                    <Skeleton className="h-20" />
                  ) : myClasses && myClasses.length > 0 ? (
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
                              <span className="ml-2">Reload Credits</span>
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground mb-4">No classes found. Create a test class above to get started.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Usage Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Period:</span>
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
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">User Type:</span>
                  <Select value={userType} onValueChange={setUserType}>
                    <SelectTrigger className="w-[180px]" data-testid="select-user-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="production">Production Only</SelectItem>
                      <SelectItem value="developer">Developers/Testers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {userType !== "all" && (
                  <Badge variant="outline" className="text-xs">
                    Filtering: {userType === "production" ? "Students & Teachers" : "Developers & Admins"}
                  </Badge>
                )}
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
                    How long users typically practice per session
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

              {/* Usage by Language */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
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
            </TabsContent>

            {/* Platform Stats Tab */}
            <TabsContent value="platform" className="space-y-6">
              {/* Active Users */}
              <div className="grid gap-4 md:grid-cols-3">
                {statsLoading ? (
                  [...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)
                ) : (
                  <>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Daily Active Users</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{platformStats?.activeUsers.dau || 0}</div>
                        <p className="text-xs text-muted-foreground">Users with sessions today</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Weekly Active Users</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{platformStats?.activeUsers.wau || 0}</div>
                        <p className="text-xs text-muted-foreground">Users in last 7 days</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Monthly Active Users</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{platformStats?.activeUsers.mau || 0}</div>
                        <p className="text-xs text-muted-foreground">Users in last 30 days</p>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>

              {/* Users by Role & Error Rate */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Registered Users by Role
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {statsLoading ? (
                      <Skeleton className="h-24" />
                    ) : platformStats?.usersByRole ? (
                      <div className="flex flex-wrap gap-4">
                        {Object.entries(platformStats.usersByRole).map(([role, count]) => (
                          <div key={role} className="flex items-center gap-2">
                            <Badge variant={role === 'admin' ? 'destructive' : role === 'developer' ? 'default' : 'outline'}>
                              {role}
                            </Badge>
                            <span className="font-semibold">{count}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No user data available.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Session Error Rate
                    </CardTitle>
                    <CardDescription>Failed sessions in last 30 days</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {statsLoading ? (
                      <Skeleton className="h-16" />
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className={`text-3xl font-bold ${(platformStats?.errorRate || 0) > 5 ? 'text-destructive' : (platformStats?.errorRate || 0) > 1 ? 'text-yellow-500' : 'text-green-500'}`}>
                          {platformStats?.errorRate || 0}%
                        </div>
                        <Badge variant={(platformStats?.errorRate || 0) > 5 ? 'destructive' : (platformStats?.errorRate || 0) > 1 ? 'outline' : 'default'}>
                          {(platformStats?.errorRate || 0) > 5 ? 'High' : (platformStats?.errorRate || 0) > 1 ? 'Moderate' : 'Low'}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Language Popularity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Language Popularity (Last 30 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <Skeleton className="h-40" />
                  ) : platformStats?.languagePopularity && platformStats.languagePopularity.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2 font-medium">Language</th>
                            <th className="text-right p-2 font-medium">Sessions</th>
                            <th className="text-right p-2 font-medium">Hours</th>
                            <th className="text-right p-2 font-medium">Unique Users</th>
                          </tr>
                        </thead>
                        <tbody>
                          {platformStats.languagePopularity
                            .sort((a, b) => b.sessions - a.sessions)
                            .map((lang) => (
                            <tr key={lang.language} className="border-b">
                              <td className="p-2">
                                <Badge>{lang.language}</Badge>
                              </td>
                              <td className="p-2 text-right">{lang.sessions}</td>
                              <td className="p-2 text-right">{lang.durationHours}h</td>
                              <td className="p-2 text-right">{lang.uniqueUsers}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No language data available yet.</p>
                  )}
                </CardContent>
              </Card>

              {/* Daily Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Daily Session Trend (Last 7 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <Skeleton className="h-32" />
                  ) : platformStats?.dailyTrend && platformStats.dailyTrend.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto">
                      {platformStats.dailyTrend.map((day) => (
                        <div key={day.date} className="flex flex-col items-center p-3 rounded-lg border min-w-[100px]">
                          <div className="text-lg font-bold">{day.sessions}</div>
                          <div className="text-xs text-muted-foreground">sessions</div>
                          <div className="text-sm font-medium mt-1">{day.durationMinutes}m</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No daily data available yet.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Neon Database Migration Tab */}
            <TabsContent value="neon" className="space-y-6">
              <NeonMigrationPanel />
            </TabsContent>

            {/* Vocab Images Tab */}
            <TabsContent value="vocab-images" className="space-y-6">
              <VocabImagesPanel />
            </TabsContent>

            {/* Image Audit Tab */}
            <TabsContent value="image-audit" className="space-y-6">
              <ImageAuditPanel />
            </TabsContent>
          </Tabs>
        </div>
  );
}

function NeonMigrationPanel() {
  const { toast } = useToast();
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);

  const { data: neonStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<{
    configured: boolean;
    connectionStatus: {
      shared: { success: boolean; message: string };
      user: { success: boolean; message: string };
    } | null;
    environment: string;
  }>({
    queryKey: ["/api/admin/neon/status"],
  });

  const handleMigrate = async () => {
    if (!confirm("This will migrate data from the current Replit database to Neon. Continue?")) {
      return;
    }

    setIsMigrating(true);
    setMigrationResult(null);

    try {
      const response = await apiRequest("POST", "/api/admin/neon/migrate");
      const result = await response.json();
      
      if (result.success) {
        setMigrationResult(result.result);
        toast({
          title: "Migration Complete",
          description: `Migrated ${result.result.shared.rows + result.result.user.rows} total rows`,
        });
      } else {
        throw new Error(result.error || "Migration failed");
      }
    } catch (error: any) {
      toast({
        title: "Migration Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsMigrating(false);
      refetchStatus();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Neon Database Migration
          </CardTitle>
          <CardDescription>
            Migrate data from Replit PostgreSQL to Neon for dual-database architecture
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusLoading ? (
            <Skeleton className="h-24" />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    {neonStatus?.connectionStatus?.shared.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className="font-medium">SHARED Database</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {neonStatus?.connectionStatus?.shared.message || "Not configured"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Daniela intelligence, curriculum, Wren insights
                  </p>
                </div>

                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    {neonStatus?.connectionStatus?.user.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className="font-medium">USER Database</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {neonStatus?.connectionStatus?.user.message || "Not configured"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    User accounts, conversations, progress
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={neonStatus?.configured ? "default" : "secondary"}>
                  {neonStatus?.environment || "unknown"} environment
                </Badge>
                {neonStatus?.configured && (
                  <Badge variant="outline">Neon Configured</Badge>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleMigrate}
                  disabled={!neonStatus?.configured || isMigrating}
                  data-testid="button-neon-migrate"
                >
                  {isMigrating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Migrating...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4 mr-2" />
                      Run Migration
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => refetchStatus()}
                  data-testid="button-neon-refresh"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Status
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {migrationResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Migration Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted">
                <div className="font-medium mb-2">SHARED Database</div>
                <div className="text-2xl font-bold">{migrationResult.shared.rows.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">rows migrated</div>
                <div className="text-sm mt-2">
                  {migrationResult.shared.success} tables successful
                  {migrationResult.shared.failed > 0 && (
                    <span className="text-red-500 ml-2">
                      ({migrationResult.shared.failed} failed)
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted">
                <div className="font-medium mb-2">USER Database</div>
                <div className="text-2xl font-bold">{migrationResult.user.rows.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">rows migrated</div>
                <div className="text-sm mt-2">
                  {migrationResult.user.success} tables successful
                  {migrationResult.user.failed > 0 && (
                    <span className="text-red-500 ml-2">
                      ({migrationResult.user.failed} failed)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const VOCAB_LANGUAGES = ['spanish', 'french', 'german', 'italian', 'portuguese', 'english', 'japanese', 'korean', 'mandarin', 'hebrew'];
interface ComparisonBg {
  id: string;
  searchQuery: string;
  url: string;
  usageCount: number;
  createdAt: string;
}

function ComparisonBackgroundsPanel() {
  const { toast } = useToast();
  const [bustingKey, setBustingKey] = useState<string | null>(null);

  const { data: images = [], isLoading, refetch } = useQuery<ComparisonBg[]>({
    queryKey: ['/api/admin/comparison-backgrounds'],
  });

  // Parse cache key into friendly label.
  // New format: vocab_spanish_comparison_bg → { language: 'spanish', pair: 'Shared Background' }
  // Old format: vocab_spanish_compare_ser_estar → { language: 'spanish', pair: 'SER vs ESTAR' }
  const parseKey = (searchQuery: string) => {
    const shared = searchQuery.match(/^vocab_([^_]+)_comparison_bg$/);
    if (shared) return { language: shared[1], pair: 'Shared Background' };
    const m = searchQuery.match(/^vocab_([^_]+)_compare_(.+)$/);
    if (!m) return { language: searchQuery, pair: searchQuery };
    const language = m[1];
    const pair = m[2].replace(/_/g, ' ').replace(/\s+vs\s+/i, ' vs ').toUpperCase();
    return { language, pair };
  };

  const bustImage = async (img: ComparisonBg) => {
    const { language, pair } = parseKey(img.searchQuery);
    const parts = pair.toLowerCase().split(' vs ');
    if (parts.length !== 2) {
      toast({ variant: 'destructive', title: 'Cannot parse pair', description: img.searchQuery });
      return;
    }
    setBustingKey(img.searchQuery);
    try {
      const res = await apiRequest('POST', '/api/admin/comparison-backgrounds/bust', {
        conceptA: parts[0].trim(),
        conceptB: parts[1].trim(),
        language,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bust failed');
      toast({ title: 'Regenerating', description: data.message });
      setTimeout(() => { refetch(); }, 8000);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Bust failed', description: e.message });
    } finally {
      setBustingKey(null);
    }
  };

  // Group by language
  const grouped = images.reduce<Record<string, ComparisonBg[]>>((acc, img) => {
    const { language } = parseKey(img.searchQuery);
    if (!acc[language]) acc[language] = [];
    acc[language].push(img);
    return acc;
  }, {});

  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Image className="h-4 w-4" />
              Comparison Widget Backgrounds
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Label-free classroom scenes used as backgrounds behind the DOM comparison widget.
              Generated on first use per language, then cached. No characters — scene flavor only.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs no-default-active-elevate">
              {images.length} cached
            </Badge>
            <Button size="sm" variant="ghost" onClick={() => refetch()} data-testid="button-refresh-compare-bgs">
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="aspect-video rounded-md" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No comparison backgrounds cached yet — they generate automatically on first use during a voice session.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([lang, langImages]) => (
              <div key={lang}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  {lang}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {langImages.map(img => {
                    const { pair } = parseKey(img.searchQuery);
                    const isBusting = bustingKey === img.searchQuery;
                    return (
                      <div key={img.id} className="space-y-1.5" data-testid={`card-compare-bg-${img.id}`}>
                        <div className="relative group aspect-video rounded-md overflow-hidden border bg-muted/20">
                          <img
                            src={img.url}
                            alt={pair}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-background/90 text-xs"
                              onClick={() => bustImage(img)}
                              disabled={isBusting}
                              data-testid={`button-regen-compare-${img.id}`}
                            >
                              {isBusting
                                ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                : <RotateCcw className="h-3 w-3 mr-1" />
                              }
                              Regenerate
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-xs font-medium leading-tight">{pair}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0">{img.usageCount}×</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Image Audit Panel ──────────────────────────────────────────────────────

const F_GRADE_IMAGES = [
  {
    conceptKey: 'vocab_adj_caliente_frio',
    label: 'caliente / frío',
    reason: '"Warm" + "Vs" English text printed on image',
    prompt: 'NO TEXT, NO WORDS, NO LETTERS anywhere in the image. Watercolor illustration. A single steaming red ceramic mug on the left half of the image on a warm orange background. A single glass packed full of ice cubes on the right half on an icy blue background. The steam rising from the mug and the ice cubes tell the story of hot and cold with no need for any labels. No dividers, no arrows, no words, no annotations.',
  },
  {
    conceptKey: 'vocab_places_casa',
    label: 'casa (house)',
    reason: '"(casa)" Spanish label text printed on image',
    prompt: 'NO TEXT, NO WORDS, NO LETTERS anywhere in the image. Watercolor illustration. A cheerful small house: bright red triangular roof, a brown wooden front door centered below the roof, one square window on each side of the door, a small chimney on the roof with a wisp of smoke. Plain pale sky background. Simple iconic shape like a child\'s drawing of a house. No garden furniture, no fences, no decorations. No labels, no words, no signs.',
  },
  {
    conceptKey: 'vocab_color_blanco',
    label: 'blanco (white)',
    reason: '"WHITE" English label baked into image',
    prompt: 'NO TEXT, NO WORDS, NO LETTERS anywhere in the image. Watercolor illustration. A fluffy white rabbit sitting upright and facing forward on a plain bright green meadow. The rabbit\'s fur is brilliant pure white — the most visually prominent thing in the image. Round body, long white ears, small pink nose. Clean simple composition. The white fur against the green background is the entire message. No labels, no words, no signs of any kind.',
  },
  {
    conceptKey: 'vocab_place_farmacia',
    label: 'farmacia (pharmacy)',
    reason: '"PHARMACY" printed twice in English on signage',
    prompt: 'NO TEXT, NO WORDS, NO LETTERS anywhere in the image. Watercolor illustration. A single large bold bright green cross symbol centred on a clean white background. The green cross glows with a soft light, thick arms, perfect symmetry. Nothing else in the image — no building, no door, no window, no storefront, no people. Just the glowing green cross on white. The green cross is the international pharmacy symbol and requires no text.',
  },
  {
    conceptKey: 'vocab_emo_nervioso',
    label: 'nervioso (nervous)',
    reason: '"stess" [sic] English text + undressed figure',
    prompt: 'NO TEXT, NO WORDS, NO LETTERS, NO SPEECH BUBBLES anywhere in the image. Watercolor illustration. A cartoon character wearing a striped shirt and plain dark trousers. Exaggerated nervous expression: very wide round eyes, raised eyebrows nearly touching the hairline, a wobbly frown, both hands clutching each other in front of the body, small drops of sweat flying off the forehead and temples. White background. Full body visible. Fully clothed. No labels, no thought bubbles, no words.',
  },
  {
    conceptKey: 'vocab_weather_temperature_scale',
    label: 'temperature scale',
    reason: '"CELSIUS" and "FAHRENHEIT" English headers baked in',
    prompt: 'NO TEXT, NO NUMBERS, NO DEGREE MARKS, NO WORDS anywhere in the image. Watercolor illustration. A single large glass thermometer on a white background. The liquid column inside the glass tube shows a bold colour gradient: vivid red-orange at the very top, fading through amber and yellow in the middle, to crisp icy blue at the very bottom bulb. A tiny yellow cartoon sun sits beside the top of the thermometer. A tiny white snowflake sits beside the bottom of the thermometer. Nothing else. No tick marks, no scale, no units, no numbers.',
  },
  {
    conceptKey: 'vocab_time_dias_semana',
    label: 'días de la semana (days of week)',
    reason: '"MONDAY", "WEDNESDAY", "SATURDAY" English day names baked in',
    prompt: 'NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS anywhere in the image. Watercolor illustration. Seven round glowing sun icons arranged in a neat horizontal row on a plain white background. Each sun is a different colour of the rainbow: the first sun is red-orange, then orange, yellow, lime-green, teal, blue, and the last is soft purple. Each sun has a circular glowing centre and short radiating rays around it. The seven differently-coloured suns represent seven days. No calendar, no grid, no columns, no labels, no day names in any language, no numbers.',
  },
] as const;

type AuditState = {
  previewing: boolean;
  applying: boolean;
  previewDataUrl: string | null;
  appliedTs: number | null;
  error: string | null;
};

function ImageAuditPanel() {
  const { toast } = useToast();
  const [states, setStates] = useState<Record<string, AuditState>>(() =>
    Object.fromEntries(F_GRADE_IMAGES.map(img => [img.conceptKey, { previewing: false, applying: false, previewDataUrl: null, appliedTs: null, error: null }]))
  );

  const patch = (key: string, update: Partial<AuditState>) =>
    setStates(prev => ({ ...prev, [key]: { ...prev[key], ...update } }));

  const generatePreview = async (conceptKey: string, prompt: string) => {
    patch(conceptKey, { previewing: true, previewDataUrl: null, error: null });
    try {
      const res = await apiRequest('POST', '/api/admin/vocab-images/regen-preview-key', { conceptKey, prompt });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      patch(conceptKey, { previewing: false, previewDataUrl: data.previewDataUrl });
    } catch (e: any) {
      patch(conceptKey, { previewing: false, error: e.message });
      toast({ variant: 'destructive', title: 'Preview failed', description: e.message });
    }
  };

  const applyPreview = async (conceptKey: string) => {
    patch(conceptKey, { applying: true, error: null });
    try {
      const res = await apiRequest('POST', '/api/admin/vocab-images/regen-apply-key', { conceptKey });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Apply failed');
      patch(conceptKey, { applying: false, previewDataUrl: null, appliedTs: Date.now() });
      toast({ title: 'Applied', description: `${conceptKey}.png replaced in GCS` });
    } catch (e: any) {
      patch(conceptKey, { applying: false, error: e.message });
      toast({ variant: 'destructive', title: 'Apply failed', description: e.message });
    }
  };

  const discard = (conceptKey: string) => patch(conceptKey, { previewDataUrl: null, error: null });

  const appliedCount = Object.values(states).filter(s => s.appliedTs !== null).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            F-Grade Image Regen Queue
          </CardTitle>
          <CardDescription>
            7 images failed the visual quality audit — each contains English text labels baked in by DALL-E.
            Click <strong>Generate Preview</strong> to see a candidate (~25s), then <strong>Apply</strong> to write it to GCS,
            or <strong>Retry</strong> for a different attempt. Nothing overwrites until you click Apply.
            {appliedCount > 0 && (
              <span className="ml-2 font-medium text-green-600 dark:text-green-400">
                {appliedCount}/7 applied this session.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {F_GRADE_IMAGES.map(img => {
              const s = states[img.conceptKey];
              const currentSrc = s.appliedTs
                ? `/api/media/ai-image/${img.conceptKey}.png?t=${s.appliedTs}`
                : `/api/media/ai-image/${img.conceptKey}.png`;
              const hasPreview = !!s.previewDataUrl;

              return (
                <Card key={img.conceptKey} className="flex flex-col" data-testid={`card-audit-${img.conceptKey}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <CardTitle className="text-sm font-semibold">{img.label}</CardTitle>
                      {s.appliedTs
                        ? <Badge className="bg-green-600 text-white text-xs no-default-active-elevate">Applied</Badge>
                        : hasPreview
                          ? <Badge variant="outline" className="text-xs no-default-active-elevate">Preview Ready</Badge>
                          : <Badge variant="destructive" className="text-xs no-default-active-elevate">F-Grade</Badge>
                      }
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">{img.reason}</p>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col gap-3 pb-4">
                    {/* Image comparison area */}
                    <div className={`grid gap-2 ${hasPreview ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      <div className="space-y-1">
                        <p className="text-xs text-center text-muted-foreground">
                          {hasPreview ? 'Current' : s.appliedTs ? 'Applied' : 'Current'}
                        </p>
                        <img
                          src={currentSrc}
                          alt={`current ${img.label}`}
                          className="w-full aspect-video object-contain rounded-md border bg-muted/20"
                          data-testid={`img-current-${img.conceptKey}`}
                        />
                      </div>
                      {hasPreview && (
                        <div className="space-y-1">
                          <p className="text-xs text-center font-medium text-amber-600 dark:text-amber-400">Candidate</p>
                          <img
                            src={s.previewDataUrl!}
                            alt={`candidate ${img.label}`}
                            className="w-full aspect-video object-contain rounded-md border border-amber-400/50 bg-muted/20"
                            data-testid={`img-preview-${img.conceptKey}`}
                          />
                        </div>
                      )}
                    </div>

                    {s.error && (
                      <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">{s.error}</p>
                    )}

                    {/* Action buttons */}
                    {hasPreview ? (
                      <div className="flex gap-2 mt-auto">
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={s.applying}
                          onClick={() => applyPreview(img.conceptKey)}
                          data-testid={`button-apply-${img.conceptKey}`}
                        >
                          {s.applying ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <CheckCircle className="h-3 w-3 mr-1.5" />}
                          Apply
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={s.applying || s.previewing}
                          onClick={() => generatePreview(img.conceptKey, img.prompt)}
                          data-testid={`button-retry-${img.conceptKey}`}
                          title="Generate another candidate"
                        >
                          {s.previewing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-1"
                          disabled={s.applying}
                          onClick={() => discard(img.conceptKey)}
                          data-testid={`button-discard-${img.conceptKey}`}
                        >
                          Discard
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant={s.appliedTs ? 'outline' : 'default'}
                        className="w-full mt-auto"
                        disabled={s.previewing}
                        onClick={() => generatePreview(img.conceptKey, img.prompt)}
                        data-testid={`button-preview-${img.conceptKey}`}
                      >
                        {s.previewing ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                            Generating (~25s)…
                          </>
                        ) : s.appliedTs ? (
                          <>
                            <RotateCcw className="h-3 w-3 mr-1.5" />
                            Generate Another
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-3 w-3 mr-1.5" />
                            Generate Preview
                          </>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function VocabImagesPanel() {
  const { toast } = useToast();
  const [language, setLanguage] = useState('spanish');
  const [fixNumbersResult, setFixNumbersResult] = useState<any>(null);
  const [fixGreetingsResult, setFixGreetingsResult] = useState<any>(null);
  const [fixClassroomResult, setFixClassroomResult] = useState<any>(null);
  const [fixAdjectivesResult, setFixAdjectivesResult] = useState<any>(null);
  const [seedResult, setSeedResult] = useState<any>(null);
  const [fixWordInput, setFixWordInput] = useState('');
  const [fixWordResult, setFixWordResult] = useState<any>(null);
  const [fixWordPreview, setFixWordPreview] = useState<{ currentUrl: string | null; previewUrl: string; previewKey: string; cacheKey: string; word: string; language: string } | null>(null);

  const fixNumbersMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/vocab-images/fix-numbers-days', { language }).then(r => r.json()),
    onSuccess: (data: any) => {
      setFixNumbersResult(data);
      toast({ title: 'Numbers/Days cache busted', description: `Deleted ${data.deleted} stale images. Re-seeding in background.` });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const fixGreetingsMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/vocab-images/fix-greetings', { language }).then(r => r.json()),
    onSuccess: (data: any) => {
      setFixGreetingsResult(data);
      toast({ title: 'Greetings cache busted', description: `Deleted ${data.deleted} stale images. Re-seeding in background.` });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const fixClassroomMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/vocab-images/fix-classroom', { language }).then(r => r.json()),
    onSuccess: (data: any) => {
      setFixClassroomResult(data);
      toast({ title: 'Classroom phrases cache busted', description: `Deleted ${data.deleted} stale images. Re-seeding in background.` });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const fixAdjectivesMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/vocab-images/fix-adjectives', { language }).then(r => r.json()),
    onSuccess: (data: any) => {
      setFixAdjectivesResult(data);
      toast({ title: 'Adjective pairs cache busted', description: `Deleted ${data.deleted} stale images. Re-seeding with split-panel prompts.` });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const seedMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/vocab-images/seed', { language }).then(r => r.json()),
    onSuccess: (data: any) => {
      setSeedResult(data);
      toast({ title: 'Seed started', description: `Job ${data.jobId} — seeding all ${language} vocab images in background.` });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const fixWordMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/vocab-images/fix-word', { language, word: fixWordInput.trim() }).then(r => r.json()),
    onSuccess: (data: any) => {
      setFixWordResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/textbook/vocab-images'] });
      toast({ title: 'Image regenerated', description: data.message });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const previewFixMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/vocab-images/preview-fix', { language, word: fixWordInput.trim() }).then(r => r.json()),
    onSuccess: (data: any) => {
      setFixWordPreview({ currentUrl: data.currentUrl, previewUrl: data.previewUrl, previewKey: data.previewKey, cacheKey: data.cacheKey, word: data.word, language: data.language });
      toast({ title: 'Preview ready', description: data.message });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Preview failed', description: e.message }),
  });

  const applyPreviewMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/vocab-images/apply-preview', {
      language: fixWordPreview!.language,
      word: fixWordPreview!.word,
      previewKey: fixWordPreview!.previewKey,
      previewUrl: fixWordPreview!.previewUrl,
    }).then(r => r.json()),
    onSuccess: (data: any) => {
      setFixWordPreview(null);
      setFixWordResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/textbook/vocab-images'] });
      toast({ title: 'Image applied', description: data.message });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Apply failed', description: e.message }),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Vocab Image Cache Tools
          </CardTitle>
          <CardDescription>
            Fix stale cached images, bust specific word categories, or reseed all vocab images for a language.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium w-20">Language</span>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-48" data-testid="select-vocab-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOCAB_LANGUAGES.map(l => (
                  <SelectItem key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-medium">Numbers &amp; Days</p>
                <p className="text-xs text-muted-foreground">Bust stale number/day-of-week images and reseed with correct numeral illustrations.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fixNumbersMutation.mutate()}
                  disabled={fixNumbersMutation.isPending}
                  className="w-full"
                  data-testid="button-fix-numbers"
                >
                  {fixNumbersMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                  Fix Numbers / Days
                </Button>
                {fixNumbersResult && (
                  <p className="text-xs text-muted-foreground">Deleted {fixNumbersResult.deleted} cached entries. Job: {fixNumbersResult.jobId?.slice(-8)}</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-medium">Greetings &amp; Farewells</p>
                <p className="text-xs text-muted-foreground">Bust stale greeting/farewell images and reseed with scene-based illustrations.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fixGreetingsMutation.mutate()}
                  disabled={fixGreetingsMutation.isPending}
                  className="w-full"
                  data-testid="button-fix-greetings"
                >
                  {fixGreetingsMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                  Fix Greetings
                </Button>
                {fixGreetingsResult && (
                  <p className="text-xs text-muted-foreground">Deleted {fixGreetingsResult.deleted} cached entries. Job: {fixGreetingsResult.jobId?.slice(-8)}</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-medium">Classroom Survival Phrases</p>
                <p className="text-xs text-muted-foreground">Bust stale classroom phrase images and reseed with character-scene illustrations (repeat, speak slowly, don't understand, how do you say).</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fixClassroomMutation.mutate()}
                  disabled={fixClassroomMutation.isPending}
                  className="w-full"
                  data-testid="button-fix-classroom"
                >
                  {fixClassroomMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                  Fix Classroom Phrases
                </Button>
                {fixClassroomResult && (
                  <p className="text-xs text-muted-foreground">Deleted {fixClassroomResult.deleted} cached entries. Job: {fixClassroomResult.jobId?.slice(-8)}</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-medium">Adjective Pairs</p>
                <p className="text-xs text-muted-foreground">Bust stale adjective images and reseed with split-panel contrast illustrations (bien/mal, grande/pequeño, etc.).</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fixAdjectivesMutation.mutate()}
                  disabled={fixAdjectivesMutation.isPending}
                  className="w-full"
                  data-testid="button-fix-adjectives"
                >
                  {fixAdjectivesMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                  Fix Adjectives
                </Button>
                {fixAdjectivesResult && (
                  <p className="text-xs text-muted-foreground">Deleted {fixAdjectivesResult.deleted} cached entries. Job: {fixAdjectivesResult.jobId?.slice(-8)}</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-medium">Full Reseed</p>
                <p className="text-xs text-muted-foreground">Reseed all vocab images for the selected language (generates missing images only).</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => seedMutation.mutate()}
                  disabled={seedMutation.isPending}
                  className="w-full"
                  data-testid="button-seed-vocab"
                >
                  {seedMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  Seed All
                </Button>
                {seedResult && (
                  <p className="text-xs text-muted-foreground">Job started: {seedResult.jobId?.slice(-8)}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <ComparisonBackgroundsPanel />

          <Card className="bg-muted/30">
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="text-sm font-medium">Fix Single Word</p>
                <p className="text-xs text-muted-foreground">Generate a candidate image and preview it before applying. The original stays safe until you click Apply. Accepts any script (hola, こんにちは, שלום, etc.).</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={fixWordInput}
                  onChange={e => { setFixWordInput(e.target.value); setFixWordResult(null); setFixWordPreview(null); }}
                  onKeyDown={e => { if (e.key === 'Enter' && fixWordInput.trim()) previewFixMutation.mutate(); }}
                  placeholder="e.g. buenos días"
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="input-fix-word"
                  dir="auto"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => previewFixMutation.mutate()}
                  disabled={previewFixMutation.isPending || applyPreviewMutation.isPending || !fixWordInput.trim()}
                  data-testid="button-fix-word"
                >
                  {previewFixMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  Preview
                </Button>
              </div>

              {fixWordPreview && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground text-center">Current</p>
                      {fixWordPreview.currentUrl
                        ? <img src={fixWordPreview.currentUrl} alt="current" className="w-full rounded-md object-contain border aspect-square" />
                        : <div className="w-full aspect-square rounded-md border border-dashed flex items-center justify-center text-xs text-muted-foreground bg-muted/40">No image</div>
                      }
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground text-center">Candidate</p>
                      <img src={fixWordPreview.previewUrl} alt="candidate" className="w-full rounded-md object-contain border aspect-square" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => applyPreviewMutation.mutate()}
                      disabled={applyPreviewMutation.isPending}
                      data-testid="button-apply-preview"
                      className="flex-1"
                    >
                      {applyPreviewMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      Apply
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => previewFixMutation.mutate()}
                      disabled={previewFixMutation.isPending || applyPreviewMutation.isPending}
                      data-testid="button-retry-preview"
                    >
                      {previewFixMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setFixWordPreview(null)}
                      disabled={applyPreviewMutation.isPending}
                      data-testid="button-discard-preview"
                      className="flex-1"
                    >
                      Discard
                    </Button>
                  </div>
                </div>
              )}

              {fixWordResult && !fixWordPreview && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{fixWordResult.message}</p>
                  {fixWordResult.url && (
                    <img src={fixWordResult.url} alt={fixWordInput} className="w-full rounded-md object-contain border" />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
