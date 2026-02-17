import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Map, 
  Star, 
  RefreshCw, 
  Search, 
  Trophy, 
  TrendingUp,
  Clock,
  User,
  Languages,
  Loader2 
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface JourneySnapshot {
  id: string;
  userId: string;
  targetLanguage: string | null;
  snapshotType: string | null;
  narrativeSummary: string;
  currentStrengths: string[] | null;
  currentChallenges: string[] | null;
  trajectoryNotes: string | null;
  sessionsIncluded: number | null;
  lastUpdated: string;
  createdAt: string;
}

interface LearningMilestone {
  id: string;
  userId: string;
  targetLanguage: string;
  title: string;
  description: string;
  milestoneType: string;
  significance: string | null;
  emotionalContext: string | null;
  conversationId: string | null;
  voiceSessionId: string | null;
  createdAt: string;
}

interface JourneyStats {
  totalSnapshots: number;
  totalMilestones: number;
  snapshotsByLanguage: Array<{ language: string; count: number }>;
  milestonesByCategory: Array<{ category: string; count: number }>;
}

const MILESTONE_TYPE_COLORS: Record<string, string> = {
  breakthrough: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  first_success: "bg-green-500/20 text-green-700 dark:text-green-400",
  plateau_overcome: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
  connection_made: "bg-pink-500/20 text-pink-700 dark:text-pink-400",
  confidence_boost: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-400",
  teacher_flagged: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  vocabulary_milestone: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  grammar_milestone: "bg-indigo-500/20 text-indigo-700 dark:text-indigo-400",
  fluency_marker: "bg-orange-500/20 text-orange-700 dark:text-orange-400",
};

export function JourneyMemoryContent() {
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [userIdSearch, setUserIdSearch] = useState("");
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery<JourneyStats>({
    queryKey: ["/api/admin/journey/stats"],
  });

  const snapshotsQueryUrl = languageFilter && languageFilter !== "all"
    ? `/api/admin/journey/snapshots?language=${languageFilter}` 
    : "/api/admin/journey/snapshots";
  
  const { data: snapshotsData, isLoading: snapshotsLoading } = useQuery<{
    snapshots: JourneySnapshot[];
    total: number;
  }>({
    queryKey: [snapshotsQueryUrl],
  });

  const milestonesParams = new URLSearchParams();
  if (languageFilter && languageFilter !== "all") milestonesParams.set("language", languageFilter);
  if (categoryFilter && categoryFilter !== "all") milestonesParams.set("category", categoryFilter);
  const milestonesQueryUrl = milestonesParams.toString() 
    ? `/api/admin/journey/milestones?${milestonesParams.toString()}` 
    : "/api/admin/journey/milestones";

  const { data: milestonesData, isLoading: milestonesLoading } = useQuery<{
    milestones: LearningMilestone[];
    total: number;
  }>({
    queryKey: [milestonesQueryUrl],
  });

  const refreshMutation = useMutation({
    mutationFn: async ({ userId, language }: { userId: string; language: string }) => {
      return apiRequest("POST", `/api/admin/journey/refresh/${userId}`, { language });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/journey/snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/journey/stats"] });
      toast({ title: "Journey snapshot refreshed" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to refresh journey",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Map className="h-6 w-6" />
            Journey Memory System
          </h1>
          <p className="text-muted-foreground">
            AI-powered learning journey tracking for cost-effective student memory
          </p>
        </div>
      </div>

          {statsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Map className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Total Snapshots</span>
                  </div>
                  <div className="text-2xl font-bold" data-testid="text-total-snapshots">
                    {stats.totalSnapshots}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Total Milestones</span>
                  </div>
                  <div className="text-2xl font-bold" data-testid="text-total-milestones">
                    {stats.totalMilestones}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Languages className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Languages</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {stats.snapshotsByLanguage.length}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Avg Milestones/User</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {stats.totalSnapshots > 0 
                      ? (stats.totalMilestones / stats.totalSnapshots).toFixed(1)
                      : 0}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex flex-wrap gap-3 items-center">
            <Select value={languageFilter} onValueChange={setLanguageFilter}>
              <SelectTrigger className="w-40" data-testid="select-language-filter">
                <SelectValue placeholder="All languages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All languages</SelectItem>
                <SelectItem value="spanish">Spanish</SelectItem>
                <SelectItem value="french">French</SelectItem>
                <SelectItem value="german">German</SelectItem>
                <SelectItem value="italian">Italian</SelectItem>
                <SelectItem value="portuguese">Portuguese</SelectItem>
                <SelectItem value="mandarin">Mandarin</SelectItem>
                <SelectItem value="japanese">Japanese</SelectItem>
                <SelectItem value="korean">Korean</SelectItem>
                <SelectItem value="hebrew">Hebrew</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48" data-testid="select-category-filter">
                <SelectValue placeholder="All milestone types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All milestone types</SelectItem>
                <SelectItem value="breakthrough">Breakthrough</SelectItem>
                <SelectItem value="first_success">First Success</SelectItem>
                <SelectItem value="plateau_overcome">Plateau Overcome</SelectItem>
                <SelectItem value="connection_made">Connection Made</SelectItem>
                <SelectItem value="confidence_boost">Confidence Boost</SelectItem>
                <SelectItem value="teacher_flagged">Teacher Flagged</SelectItem>
                <SelectItem value="vocabulary_milestone">Vocabulary Milestone</SelectItem>
                <SelectItem value="grammar_milestone">Grammar Milestone</SelectItem>
                <SelectItem value="fluency_marker">Fluency Marker</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user ID..."
                value={userIdSearch}
                onChange={(e) => setUserIdSearch(e.target.value)}
                className="pl-10"
                data-testid="input-user-search"
              />
            </div>
          </div>

          <Tabs defaultValue="snapshots" className="space-y-4">
            <TabsList>
              <TabsTrigger value="snapshots" data-testid="tab-snapshots">
                <Map className="h-4 w-4 mr-2" />
                Journey Snapshots
              </TabsTrigger>
              <TabsTrigger value="milestones" data-testid="tab-milestones">
                <Star className="h-4 w-4 mr-2" />
                Milestones
              </TabsTrigger>
            </TabsList>

            <TabsContent value="snapshots" className="space-y-4">
              {snapshotsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {snapshotsData?.snapshots
                    .filter(s => !userIdSearch || s.userId.includes(userIdSearch))
                    .map((snapshot) => (
                    <Card key={snapshot.id} className="overflow-hidden">
                      <CardHeader className="py-3 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono text-sm" data-testid={`text-user-id-${snapshot.id}`}>
                              {snapshot.userId.slice(0, 12)}...
                            </span>
                            <Badge variant="outline" className="capitalize">
                              {snapshot.targetLanguage || 'Overall'}
                            </Badge>
                            {snapshot.snapshotType && (
                              <Badge variant="secondary" className="text-xs">
                                {snapshot.snapshotType.replace('_', ' ')}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">
                              {snapshot.sessionsIncluded || 0} sessions
                            </span>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => refreshMutation.mutate({ 
                                userId: snapshot.userId, 
                                language: snapshot.targetLanguage || 'spanish'
                              })}
                              disabled={refreshMutation.isPending}
                              data-testid={`button-refresh-${snapshot.id}`}
                            >
                              {refreshMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="py-3">
                        <p className="text-sm whitespace-pre-wrap line-clamp-4" data-testid={`text-narrative-${snapshot.id}`}>
                          {snapshot.narrativeSummary}
                        </p>
                        {(snapshot.currentStrengths?.length || snapshot.currentChallenges?.length) && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {snapshot.currentStrengths?.map((s, i) => (
                              <Badge key={`s-${i}`} variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">
                                {s}
                              </Badge>
                            ))}
                            {snapshot.currentChallenges?.map((c, i) => (
                              <Badge key={`c-${i}`} variant="secondary" className="bg-orange-500/10 text-orange-700 dark:text-orange-400">
                                {c}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Last updated: {formatDate(snapshot.lastUpdated)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {(!snapshotsData?.snapshots || snapshotsData.snapshots.length === 0) && (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        <Map className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No journey snapshots found</p>
                        <p className="text-sm">Snapshots are generated after 3+ voice sessions</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="milestones" className="space-y-4">
              {milestonesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {milestonesData?.milestones
                    .filter(m => !userIdSearch || m.userId.includes(userIdSearch))
                    .map((milestone) => (
                    <Card key={milestone.id}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Trophy className="h-4 w-4 text-yellow-500" />
                              <span className="font-medium" data-testid={`text-milestone-title-${milestone.id}`}>
                                {milestone.title}
                              </span>
                              <Badge 
                                className={MILESTONE_TYPE_COLORS[milestone.milestoneType] || ""}
                                variant="secondary"
                              >
                                {milestone.milestoneType.replace('_', ' ')}
                              </Badge>
                              {milestone.emotionalContext && (
                                <Badge variant="outline" className="text-xs">
                                  {milestone.emotionalContext}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground" data-testid={`text-milestone-desc-${milestone.id}`}>
                              {milestone.description}
                            </p>
                            {milestone.significance && (
                              <p className="text-sm italic text-muted-foreground mt-1">
                                {milestone.significance}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {milestone.userId.slice(0, 12)}...
                              </span>
                              <span className="capitalize">{milestone.targetLanguage}</span>
                              <span>{formatDate(milestone.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {(!milestonesData?.milestones || milestonesData.milestones.length === 0) && (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        <Trophy className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No milestones recorded yet</p>
                        <p className="text-sm">Milestones are captured when Daniela recognizes breakthrough moments</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
    </div>
  );
}

export default JourneyMemoryContent;
