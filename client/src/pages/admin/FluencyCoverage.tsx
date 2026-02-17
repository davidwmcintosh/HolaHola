import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Target, AlertTriangle, CheckCircle, GraduationCap, Sparkles, Loader2, FileText } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface CoverageAnalysis {
  summary: {
    totalStatements: number;
    coveredStatements: number;
    uncoveredStatements: number;
    coveragePercent: number;
    totalLessons: number;
    linkedLessons: number;
  };
  byLevel: Array<{
    level: string;
    total: number;
    covered: number;
    uncovered: number;
    coveragePercent: number;
  }>;
  byCategory: Array<{
    category: string;
    total: number;
    covered: number;
    uncovered: number;
    coveragePercent: number;
  }>;
  gaps: Array<{
    id: string;
    statement: string;
    category: string;
    level: string;
    language: string;
    lessonCount: number;
  }>;
}

interface FluencyStatus {
  totalLessons: number;
  lessonsWithLinks: number;
  lessonsWithoutLinks: number;
  totalCanDoStatements: number;
  mappingCoverage: string;
  ready: boolean;
}

const LEVEL_LABELS: Record<string, string> = {
  novice_low: "Novice Low",
  novice_mid: "Novice Mid",
  novice_high: "Novice High",
  intermediate_low: "Intermediate Low",
  intermediate_mid: "Intermediate Mid",
  intermediate_high: "Intermediate High",
  advanced_low: "Advanced Low",
  advanced_mid: "Advanced Mid",
  advanced_high: "Advanced High",
};

const CATEGORY_LABELS: Record<string, string> = {
  interpersonal: "Interpersonal",
  interpretive: "Interpretive",
  presentational: "Presentational",
};

const LANGUAGES = [
  { value: "all", label: "All Languages" },
  { value: "spanish", label: "Spanish" },
  { value: "french", label: "French" },
  { value: "german", label: "German" },
  { value: "italian", label: "Italian" },
  { value: "portuguese", label: "Portuguese" },
  { value: "japanese", label: "Japanese" },
  { value: "korean", label: "Korean" },
  { value: "mandarin", label: "Mandarin" },
  { value: "english", label: "English" },
  { value: "hebrew", label: "Hebrew" },
];

function getCoverageColor(percent: number): string {
  if (percent >= 80) return "text-green-600 dark:text-green-400";
  if (percent >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getCoverageProgressColor(percent: number): string {
  if (percent >= 80) return "bg-green-500";
  if (percent >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

export default function FluencyCoverage() {
  const [selectedLanguage, setSelectedLanguage] = useState("spanish");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: status, isLoading: statusLoading } = useQuery<FluencyStatus>({
    queryKey: ["/api/admin/fluency-wiring/status"],
  });

  const { data: coverage, isLoading: coverageLoading } = useQuery<CoverageAnalysis>({
    queryKey: [`/api/admin/fluency-wiring/coverage/${selectedLanguage}`],
    enabled: selectedLanguage !== "all",
  });

  const generateLessonMutation = useMutation({
    mutationFn: async (canDoStatementId: string) => {
      const response = await apiRequest("POST", "/api/admin/lesson-drafts/generate", {
        canDoStatementId
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Lesson Draft Created",
        description: "AI has generated a lesson draft. Check the Review Queue to approve it.",
      });
      setGeneratingId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate lesson",
        variant: "destructive",
      });
      setGeneratingId(null);
    }
  });

  const batchGenerateMutation = useMutation({
    mutationFn: async ({ language, limit }: { language: string; limit: number }) => {
      const response = await apiRequest("POST", "/api/admin/lesson-drafts/generate-for-gaps", {
        language,
        limit
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Batch Generation Started",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Batch Generation Failed",
        description: error.message || "Failed to start batch generation",
        variant: "destructive",
      });
    }
  });

  const fillAllGapsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/lesson-drafts/fill-all-gaps", {
        batchSize: 10,
        delayBetweenBatches: 5000
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Automated Gap Fill Started",
        description: `${data.message} Estimated time: ${data.estimatedTime}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Automation Failed",
        description: error.message || "Failed to start automated gap fill",
        variant: "destructive",
      });
    }
  });

  const handleGenerateLesson = (canDoStatementId: string) => {
    setGeneratingId(canDoStatementId);
    generateLessonMutation.mutate(canDoStatementId);
  };

  const handleBatchGenerate = (count: number) => {
    batchGenerateMutation.mutate({ language: selectedLanguage, limit: count });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-page-title">
              ACTFL Fluency Coverage
            </h1>
            <p className="text-muted-foreground mt-2">
              Monitor Can-Do statement coverage across lessons and identify content gaps
            </p>
          </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger className="w-48" data-testid="select-language">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => fillAllGapsMutation.mutate()}
                disabled={fillAllGapsMutation.isPending}
                data-testid="button-fill-all-gaps"
              >
                {fillAllGapsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Fill All Gaps
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {statusLoading ? (
              <>
                {[...Array(4)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="pt-6">
                      <Skeleton className="h-8 w-20 mb-2" />
                      <Skeleton className="h-4 w-32" />
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : (
              <>
                <Card data-testid="card-total-lessons">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Total Lessons</CardTitle>
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{status?.totalLessons || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      Across all languages
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-linked-lessons">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Linked Lessons</CardTitle>
                    <Target className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{status?.lessonsWithLinks || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      With Can-Do statements
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-coverage">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Coverage</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{status?.mappingCoverage || "0%"}</div>
                    <p className="text-xs text-muted-foreground">
                      Lessons with Can-Do links
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-cando-statements">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Can-Do Statements</CardTitle>
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{status?.totalCanDoStatements || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      ACTFL standards loaded
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {selectedLanguage !== "all" && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card data-testid="card-coverage-by-level">
                <CardHeader>
                  <CardTitle>Coverage by ACTFL Level</CardTitle>
                  <CardDescription>
                    Can-Do statement coverage for each proficiency level
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {coverageLoading ? (
                    <div className="space-y-3">
                      {[...Array(9)].map((_, i) => (
                        <Skeleton key={i} className="h-10" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {coverage?.byLevel.map((level) => (
                        <div key={level.level} className="space-y-1" data-testid={`level-${level.level}`}>
                          <div className="flex items-center justify-between text-sm">
                            <span>{LEVEL_LABELS[level.level] || level.level}</span>
                            <span className={getCoverageColor(level.coveragePercent)}>
                              {level.covered}/{level.total} ({level.coveragePercent}%)
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${getCoverageProgressColor(level.coveragePercent)}`}
                              style={{ width: `${level.coveragePercent}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-coverage-by-category">
                <CardHeader>
                  <CardTitle>Coverage by Category</CardTitle>
                  <CardDescription>
                    Can-Do statement coverage for each communication mode
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {coverageLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-10" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {coverage?.byCategory.map((cat) => (
                        <div key={cat.category} className="space-y-1" data-testid={`category-${cat.category}`}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{CATEGORY_LABELS[cat.category] || cat.category}</span>
                            <span className={getCoverageColor(cat.coveragePercent)}>
                              {cat.covered}/{cat.total} ({cat.coveragePercent}%)
                            </span>
                          </div>
                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${getCoverageProgressColor(cat.coveragePercent)}`}
                              style={{ width: `${cat.coveragePercent}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {selectedLanguage !== "all" && (
            <Card data-testid="card-gaps">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      Content Gaps
                    </CardTitle>
                    <CardDescription>
                      Can-Do statements not covered by any lesson - these need new content
                    </CardDescription>
                  </div>
                  {coverage?.gaps && coverage.gaps.length > 0 && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBatchGenerate(5)}
                        disabled={batchGenerateMutation.isPending}
                        data-testid="button-batch-generate-5"
                      >
                        {batchGenerateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Generate 5
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleBatchGenerate(10)}
                        disabled={batchGenerateMutation.isPending}
                        data-testid="button-batch-generate-10"
                      >
                        {batchGenerateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Generate 10
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {coverageLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : coverage?.gaps && coverage.gaps.length > 0 ? (
                  <ScrollArea className="h-96">
                    <div className="space-y-2 pr-4">
                      {coverage.gaps.map((gap, index) => (
                        <div 
                          key={gap.id} 
                          className="p-3 border rounded-lg hover-elevate flex items-start justify-between gap-3"
                          data-testid={`gap-${index}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{gap.statement}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Badge variant="outline">
                                {LEVEL_LABELS[gap.level] || gap.level}
                              </Badge>
                              <Badge variant="secondary">
                                {CATEGORY_LABELS[gap.category] || gap.category}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleGenerateLesson(gap.id)}
                            disabled={generatingId === gap.id || generateLessonMutation.isPending}
                            data-testid={`button-generate-${index}`}
                          >
                            {generatingId === gap.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p>All Can-Do statements are covered!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
      </div>
    </div>
  );
}

export function FluencyCoverageContent() {
  return <FluencyCoverage />;
}
