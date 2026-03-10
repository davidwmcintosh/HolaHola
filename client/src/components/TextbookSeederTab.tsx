import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, BookOpen, CheckCircle2, AlertTriangle, Play, ChevronDown, ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PathStatus {
  path_id:        string;
  path_name:      string;
  language:       string;
  total_lessons:  number;
  seeded_lessons: number;
}

interface SeedProgress {
  current:       number;
  total:         number;
  currentLesson: string;
  status:        "running" | "complete" | "error";
  errors:        string[];
  pathId:        string;
  pathName:      string;
}

const LANGUAGE_FLAGS: Record<string, string> = {
  spanish:    "ES",
  french:     "FR",
  german:     "DE",
  italian:    "IT",
  portuguese: "PT",
  japanese:   "JP",
  korean:     "KR",
  mandarin:   "CN",
  english:    "EN",
};

export function TextbookSeederTab() {
  const { toast } = useToast();
  const [activeJobs, setActiveJobs] = useState<Map<string, string>>(new Map()); // pathId → jobId
  const [jobProgress, setJobProgress] = useState<Map<string, SeedProgress>>(new Map());
  const [expandedLang, setExpandedLang] = useState<string | null>("spanish");
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const { data, isLoading, refetch } = useQuery<{ paths: PathStatus[] }>({
    queryKey: ["/api/admin/textbook/status"],
  });

  // Poll all active jobs every 2 seconds
  useEffect(() => {
    if (activeJobs.size === 0) return;
    pollRef.current = setInterval(async () => {
      const updates = new Map(jobProgress);
      let anyRunning = false;
      for (const [pathId, jobId] of activeJobs) {
        try {
          const res = await fetch(`/api/admin/textbook/seed-progress/${jobId}`, { credentials: "include" });
          if (res.ok) {
            const prog: SeedProgress = await res.json();
            updates.set(pathId, prog);
            if (prog.status === "running") anyRunning = true;
            if (prog.status === "complete") {
              toast({ title: `"${prog.pathName}" seeded`, description: `${prog.total} lessons complete${prog.errors.length ? `, ${prog.errors.length} errors` : ""}` });
              refetch();
            }
          }
        } catch {}
      }
      setJobProgress(new Map(updates));
      if (!anyRunning) {
        clearInterval(pollRef.current!);
      }
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeJobs, toast, refetch]);

  const seedMutation = useMutation({
    mutationFn: async (pathId: string) => {
      const res = await apiRequest("POST", "/api/admin/textbook/seed", { pathId });
      return res as { jobId: string };
    },
    onSuccess: (data, pathId) => {
      setActiveJobs(prev => new Map(prev).set(pathId, data.jobId));
    },
    onError: (e: any) => toast({ title: "Seed failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const paths = data?.paths ?? [];

  // Group by language
  const byLanguage = paths.reduce<Record<string, PathStatus[]>>((acc, p) => {
    (acc[p.language] ??= []).push(p);
    return acc;
  }, {});

  const totalSeeded = paths.reduce((s, p) => s + Number(p.seeded_lessons), 0);
  const totalLessons = paths.reduce((s, p) => s + Number(p.total_lessons), 0);

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Textbook Content Seeder
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            One-time pipeline — generates textbook prose for every lesson using Wiktionary, Tatoeba, Wikipedia, and Gemini.
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{totalSeeded}<span className="text-muted-foreground text-lg font-normal">/{totalLessons}</span></div>
          <div className="text-xs text-muted-foreground">lessons seeded</div>
        </div>
      </div>

      <Progress value={totalLessons > 0 ? (totalSeeded / totalLessons) * 100 : 0} className="h-2" />

      {/* Per-language sections */}
      {Object.entries(byLanguage).sort(([a], [b]) => a.localeCompare(b)).map(([lang, langPaths]) => {
        const langSeeded  = langPaths.reduce((s, p) => s + Number(p.seeded_lessons), 0);
        const langTotal   = langPaths.reduce((s, p) => s + Number(p.total_lessons), 0);
        const isExpanded  = expandedLang === lang;
        const isComplete  = langSeeded === langTotal && langTotal > 0;

        return (
          <Card key={lang} className="overflow-hidden">
            <CardHeader
              className="cursor-pointer py-3 flex flex-row items-center gap-3 justify-between"
              onClick={() => setExpandedLang(isExpanded ? null : lang)}
              data-testid={`section-lang-${lang}`}
            >
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="font-mono text-xs">{LANGUAGE_FLAGS[lang] ?? lang.slice(0,2).toUpperCase()}</Badge>
                <CardTitle className="text-base capitalize">{lang}</CardTitle>
                {isComplete && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{langSeeded}/{langTotal} lessons</span>
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0 space-y-3">
                {langPaths.map(path => {
                  const seeded   = Number(path.seeded_lessons);
                  const total    = Number(path.total_lessons);
                  const pct      = total > 0 ? (seeded / total) * 100 : 0;
                  const progress = jobProgress.get(path.path_id);
                  const jobId    = activeJobs.get(path.path_id);
                  const isRunning = progress?.status === "running";
                  const isDone    = seeded === total && total > 0;

                  return (
                    <div key={path.path_id} className="border rounded-md p-3 space-y-2" data-testid={`path-row-${path.path_id}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium text-sm">{path.path_name}</div>
                          <div className="text-xs text-muted-foreground">{seeded}/{total} lessons seeded</div>
                        </div>
                        <Button
                          size="sm"
                          variant={isDone ? "outline" : "default"}
                          disabled={isRunning || seedMutation.isPending}
                          onClick={() => seedMutation.mutate(path.path_id)}
                          data-testid={`button-seed-${path.path_id}`}
                        >
                          {isRunning ? (
                            <><Loader2 className="h-3 w-3 animate-spin mr-1" />Running</>
                          ) : isDone ? (
                            <><CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />Re-seed</>
                          ) : (
                            <><Play className="h-3 w-3 mr-1" />Seed</>
                          )}
                        </Button>
                      </div>

                      <Progress value={isRunning && progress ? (progress.current / progress.total) * 100 : pct} className="h-1.5" />

                      {isRunning && progress && (
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {progress.current}/{progress.total} — {progress.currentLesson}
                        </div>
                      )}

                      {progress?.status === "complete" && progress.errors.length > 0 && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {progress.errors.length} lesson(s) had errors
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
        );
      })}

      <p className="text-xs text-muted-foreground">
        Each seed job runs in the background. Lessons already seeded are skipped automatically — you can re-seed any path to refresh its content.
      </p>
    </div>
  );
}
