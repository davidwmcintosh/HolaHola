import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2, CheckCircle2, AlertTriangle, Play, ChevronDown, ChevronRight,
  DatabaseZap, ShieldCheck, Sparkles, Globe,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PathStatus {
  path_id:          string;
  path_name:        string;
  language:         string;
  total_lessons:    number;
  enriched_lessons: number;
  has_vocab:        number;
  has_grammar:      number;
}

interface EnrichProgress {
  current:       number;
  total:         number;
  currentLesson: string;
  status:        "running" | "complete" | "error";
  errors:        string[];
  pathId:        string;
  pathName:      string;
  backfilled:    number;
  validated:     number;
}

interface BulkEnrichProgress {
  totalPaths:       number;
  completedPaths:   number;
  currentPath:      string;
  currentLanguage:  string;
  totalLessons:     number;
  processedLessons: number;
  backfilled:       number;
  validated:        number;
  status:           "running" | "complete" | "error";
  errors:           string[];
  startedAt:        string;
  estimatedMinutes: number;
}

const LANGUAGE_FLAGS: Record<string, string> = {
  spanish: "ES", french: "FR", german: "DE", italian: "IT",
  portuguese: "PT", japanese: "JP", korean: "KR", mandarin: "CN", english: "EN",
};

const LANGUAGE_LABELS: Record<string, string> = {
  spanish: "Spanish", french: "French", german: "German", italian: "Italian",
  portuguese: "Portuguese", japanese: "Japanese", korean: "Korean",
  mandarin: "Mandarin", english: "English",
};

export function CurriculumEnrichmentTab() {
  const { toast } = useToast();

  // Per-path job tracking
  const [activeJobs, setActiveJobs]     = useState<Map<string, string>>(new Map());
  const [jobProgress, setJobProgress]   = useState<Map<string, EnrichProgress>>(new Map());
  const [expandedLang, setExpandedLang] = useState<string | null>("spanish");
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Bulk job tracking
  const [bulkJobId, setBulkJobId]         = useState<string | null>(null);
  const [bulkProgress, setBulkProgress]   = useState<BulkEnrichProgress | null>(null);
  const bulkPollRef = useRef<NodeJS.Timeout | null>(null);

  const { data, isLoading, refetch } = useQuery<{ paths: PathStatus[] }>({
    queryKey: ["/api/admin/curriculum/enrich-status"],
  });

  // Poll per-path jobs
  useEffect(() => {
    if (activeJobs.size === 0) return;
    pollRef.current = setInterval(async () => {
      const updates = new Map(jobProgress);
      let anyRunning = false;
      for (const [pathId, jobId] of activeJobs) {
        try {
          const res = await fetch(`/api/admin/curriculum/enrich-progress/${jobId}`, { credentials: "include" });
          if (res.ok) {
            const prog: EnrichProgress = await res.json();
            updates.set(pathId, prog);
            if (prog.status === "running") anyRunning = true;
            if (prog.status === "complete") {
              toast({
                title: `"${prog.pathName}" enriched`,
                description: `${prog.backfilled} backfilled · ${prog.validated} OER-validated${prog.errors.length ? ` · ${prog.errors.length} errors` : ""}`,
              });
              refetch();
            }
          }
        } catch {}
      }
      setJobProgress(new Map(updates));
      if (!anyRunning) clearInterval(pollRef.current!);
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeJobs, toast, refetch]);

  // Poll bulk job
  useEffect(() => {
    if (!bulkJobId) return;
    bulkPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/curriculum/enrich-all-progress/${bulkJobId}`, { credentials: "include" });
        if (res.ok) {
          const prog: BulkEnrichProgress = await res.json();
          setBulkProgress(prog);
          if (prog.status === "complete") {
            clearInterval(bulkPollRef.current!);
            toast({
              title: "All languages enriched",
              description: `${prog.backfilled} lessons backfilled · ${prog.validated} OER-validated · ${prog.errors.length} errors`,
            });
            refetch();
          }
        }
      } catch {}
    }, 3000);
    return () => { if (bulkPollRef.current) clearInterval(bulkPollRef.current); };
  }, [bulkJobId, toast, refetch]);

  const enrichMutation = useMutation({
    mutationFn: async (pathId: string) => {
      const res = await apiRequest("POST", "/api/admin/curriculum/enrich", { pathId });
      return res.json();
    },
    onSuccess: (data, pathId) => {
      setActiveJobs(prev => new Map(prev).set(pathId, data.jobId));
    },
    onError: (err: any) => {
      toast({ title: "Enrichment failed", description: err.message, variant: "destructive" });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/curriculum/enrich-all", {});
      return res.json();
    },
    onSuccess: (data) => {
      setBulkJobId(data.jobId);
      toast({ title: "Bulk enrichment started", description: "Processing all 45 paths sequentially. This will take ~26 minutes." });
    },
    onError: (err: any) => {
      toast({ title: "Bulk enrichment failed", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading curriculum status…</span>
      </div>
    );
  }

  const paths = data?.paths ?? [];
  const totalLessons      = paths.reduce((s, p) => s + Number(p.total_lessons), 0);
  const totalEnriched     = paths.reduce((s, p) => s + Number(p.enriched_lessons), 0);
  const totalMissingVocab = paths.reduce((s, p) => s + (Number(p.total_lessons) - Number(p.has_vocab)), 0);
  const isBulkRunning     = bulkProgress?.status === "running";
  const isBulkComplete    = bulkProgress?.status === "complete";

  // Group by language
  const byLanguage: Record<string, PathStatus[]> = {};
  for (const p of paths) { (byLanguage[p.language] ??= []).push(p); }

  return (
    <div className="space-y-6">

      {/* Bulk progress banner — shown while/after bulk job runs */}
      {bulkProgress && (
        <Card className="border-primary/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  {isBulkRunning
                    ? <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    : <CheckCircle2 className="w-4 h-4 text-green-500" />
                  }
                  <span className="font-medium text-sm">
                    {isBulkRunning ? "Enriching all languages…" : "All languages enriched"}
                  </span>
                </div>
                {isBulkRunning && (
                  <p className="text-xs text-muted-foreground pl-6">
                    {LANGUAGE_LABELS[bulkProgress.currentLanguage] ?? bulkProgress.currentLanguage} — {bulkProgress.currentPath}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground shrink-0">
                <span>{bulkProgress.completedPaths}/{bulkProgress.totalPaths} paths</span>
                <span>{bulkProgress.processedLessons}/{bulkProgress.totalLessons} lessons</span>
                <span className="text-green-600 dark:text-green-400">{bulkProgress.backfilled} backfilled</span>
                <span>{bulkProgress.validated} validated</span>
                {isBulkRunning && (
                  <span>~{Math.max(0, Math.ceil(((bulkProgress.totalLessons - bulkProgress.processedLessons) * 1.2) / 60))} min remaining</span>
                )}
              </div>
            </div>
            <Progress
              value={bulkProgress.totalLessons > 0
                ? (bulkProgress.processedLessons / bulkProgress.totalLessons) * 100
                : 0}
              className="h-2"
            />
            {bulkProgress.errors.length > 0 && (
              <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                {bulkProgress.errors.length} error(s) — {bulkProgress.errors[0]}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Header summary */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <DatabaseZap className="w-4 h-4 text-muted-foreground" />
              Curriculum OER Enrichment
            </CardTitle>
            <Button
              onClick={() => bulkMutation.mutate()}
              disabled={isBulkRunning || bulkMutation.isPending}
              data-testid="button-enrich-all"
            >
              {isBulkRunning || bulkMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Running…</>
              ) : isBulkComplete ? (
                <><Sparkles className="w-4 h-4 mr-2" />Re-enrich All</>
              ) : (
                <><Globe className="w-4 h-4 mr-2" />Enrich All Languages</>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Run this before textbook seeding. For lessons missing vocabulary or grammar, Gemini
            generates them using Wiktionary, Tatoeba, and Wikivoyage as authoritative OER sources.
            For lessons that already have vocab/grammar, the pipeline cross-checks against OER
            sources and improves accuracy. "Enrich All Languages" processes all 45 paths
            sequentially (~26 min total).
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Total lessons:</span>
              <span className="font-medium">{totalLessons.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">OER enriched:</span>
              <span className="font-medium">{totalEnriched.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Missing vocab:</span>
              <Badge variant={totalMissingVocab > 0 ? "destructive" : "secondary"} className="text-xs">
                {totalMissingVocab.toLocaleString()} lessons
              </Badge>
            </div>
          </div>
          {totalLessons > 0 && (
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Overall enrichment progress</span>
                <span>{Math.round((totalEnriched / totalLessons) * 100)}%</span>
              </div>
              <Progress value={(totalEnriched / totalLessons) * 100} className="h-1.5" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-language sections */}
      {Object.entries(byLanguage).sort(([a], [b]) => a.localeCompare(b)).map(([lang, langPaths]) => {
        const isExpanded   = expandedLang === lang;
        const langTotal    = langPaths.reduce((s, p) => s + Number(p.total_lessons), 0);
        const langEnriched = langPaths.reduce((s, p) => s + Number(p.enriched_lessons), 0);
        const langMissing  = langPaths.reduce((s, p) => s + (Number(p.total_lessons) - Number(p.has_vocab)), 0);
        const isCurrent    = isBulkRunning && bulkProgress?.currentLanguage === lang;

        return (
          <Card key={lang} className={isCurrent ? "border-primary/40" : ""}>
            <CardHeader
              className="py-3 px-4 cursor-pointer select-none flex flex-row items-center justify-between gap-2"
              onClick={() => setExpandedLang(isExpanded ? null : lang)}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="text-xs font-mono">
                  {LANGUAGE_FLAGS[lang] ?? lang.toUpperCase()}
                </Badge>
                <span className="font-medium capitalize">{LANGUAGE_LABELS[lang] ?? lang}</span>
                {isCurrent && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                <span className="text-xs text-muted-foreground">
                  {langEnriched}/{langTotal} enriched
                </span>
                {langMissing > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {langMissing} missing vocab
                  </Badge>
                )}
                {langMissing === 0 && langEnriched > 0 && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    OER validated
                  </Badge>
                )}
              </div>
              {isExpanded
                ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0 space-y-3">
                {langPaths.map(path => {
                  const total      = Number(path.total_lessons);
                  const enriched   = Number(path.enriched_lessons);
                  const hasVocab   = Number(path.has_vocab);
                  const hasGrammar = Number(path.has_grammar);
                  const missingV   = total - hasVocab;
                  const missingG   = total - hasGrammar;
                  const pct        = total > 0 ? Math.round((enriched / total) * 100) : 0;
                  const isRunning  = activeJobs.has(path.path_id);
                  const isPathBulk = isBulkRunning && bulkProgress?.currentPath === path.path_name;
                  const prog       = jobProgress.get(path.path_id);
                  const isComplete = prog?.status === "complete";
                  const isFullyEnriched = enriched === total && total > 0;

                  return (
                    <div key={path.path_id} className="border rounded-md p-3 space-y-2" data-testid={`enrich-path-${path.path_id}`}>
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-sm font-medium truncate flex items-center gap-1.5">
                            {isPathBulk && <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />}
                            {path.path_name}
                          </p>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>{total} lessons</span>
                            {missingV > 0 && <span className="text-destructive">{missingV} missing vocab</span>}
                            {missingG > 0 && <span className="text-destructive">{missingG} missing grammar</span>}
                            {missingV === 0 && missingG === 0 && (
                              <span className="text-green-600 dark:text-green-400">vocab + grammar complete</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isComplete && (
                            <span className="text-xs text-muted-foreground">
                              {prog.backfilled} backfilled · {prog.validated} validated
                            </span>
                          )}
                          {isFullyEnriched && !isRunning && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                          <Button
                            size="sm"
                            variant={isFullyEnriched ? "outline" : "default"}
                            disabled={isRunning || isPathBulk || enrichMutation.isPending}
                            onClick={() => enrichMutation.mutate(path.path_id)}
                            data-testid={`button-enrich-${path.path_id}`}
                          >
                            {isRunning || isPathBulk ? (
                              <><Loader2 className="w-3 h-3 animate-spin mr-1" />Running</>
                            ) : isFullyEnriched ? (
                              <><Sparkles className="w-3 h-3 mr-1" />Re-enrich</>
                            ) : (
                              <><Play className="w-3 h-3 mr-1" />Enrich</>
                            )}
                          </Button>
                        </div>
                      </div>

                      {(isRunning || isPathBulk || pct > 0) && (
                        <div className="space-y-1">
                          <Progress
                            value={isRunning && prog ? (prog.current / prog.total) * 100 : pct}
                            className="h-1.5"
                          />
                          {isRunning && prog && (
                            <p className="text-xs text-muted-foreground truncate">
                              {prog.current}/{prog.total} — {prog.currentLesson}
                            </p>
                          )}
                          {!isRunning && pct > 0 && (
                            <p className="text-xs text-muted-foreground">{pct}% enriched</p>
                          )}
                        </div>
                      )}

                      {prog?.errors && prog.errors.length > 0 && (
                        <div className="text-xs text-destructive flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                          <span>{prog.errors.length} error(s) — {prog.errors[0]}</span>
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
    </div>
  );
}
