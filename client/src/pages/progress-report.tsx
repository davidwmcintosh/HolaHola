import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  ClipboardList,
  BookOpen,
  Printer,
  Eye,
  EyeOff,
  Calendar,
  CheckCircle2,
  Microscope,
  Landmark,
  Languages,
  Calculator,
  Briefcase,
  GraduationCap,
  Clock,
  BookMarked,
  TrendingUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecallItem {
  question: string;
  answer: string;
}

interface ViewedModule {
  id: string;
  topic: string;
  subjectDomain: string;
  viewedAt: string;
  lastViewedAt: string;
  quizPrintedAt: string | null;
  content: {
    recallCheck: RecallItem[];
    keyTerms: Array<{ term: string; definition: string }>;
    keyConcepts: string[];
  };
}

interface LanguageProgressEntry {
  language: string;
  wordsLearned: number;
  practiceMinutes: number;
  currentStreak: number;
  currentActflLevel: string | null;
  topicsTotal: number;
  tasksTotal: number;
  canDoAchieved: number;
}

interface ProgressReport {
  viewedModules: ViewedModule[];
  bySubject: Record<string, { count: number; lastActivity: string | null }>;
  languageProgress: LanguageProgressEntry[];
}

// ─── Subject config ───────────────────────────────────────────────────────────

const SUBJECT_CONFIG: Record<string, {
  label: string;
  Icon: React.ElementType;
  badgeClass: string;
  iconClass: string;
  borderClass: string;
}> = {
  biology: {
    label: "Biology",
    Icon: Microscope,
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    iconClass: "text-emerald-600 dark:text-emerald-400",
    borderClass: "border-emerald-200 dark:border-emerald-800",
  },
  microbiology: {
    label: "Microbiology",
    Icon: Microscope,
    badgeClass: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
    iconClass: "text-teal-600 dark:text-teal-400",
    borderClass: "border-teal-200 dark:border-teal-800",
  },
  history: {
    label: "US History",
    Icon: Landmark,
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    iconClass: "text-amber-600 dark:text-amber-400",
    borderClass: "border-amber-200 dark:border-amber-800",
  },
  math: {
    label: "Mathematics",
    Icon: Calculator,
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    iconClass: "text-blue-600 dark:text-blue-400",
    borderClass: "border-blue-200 dark:border-blue-800",
  },
  business: {
    label: "Business",
    Icon: Briefcase,
    badgeClass: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
    iconClass: "text-violet-600 dark:text-violet-400",
    borderClass: "border-violet-200 dark:border-violet-800",
  },
  language: {
    label: "Language",
    Icon: Languages,
    badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
    iconClass: "text-rose-600 dark:text-rose-400",
    borderClass: "border-rose-200 dark:border-rose-800",
  },
};

function getSubjectCfg(domain: string) {
  return SUBJECT_CONFIG[domain] ?? {
    label: domain.charAt(0).toUpperCase() + domain.slice(1),
    Icon: GraduationCap,
    badgeClass: "bg-muted text-muted-foreground",
    iconClass: "text-muted-foreground",
    borderClass: "",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function todayLong() {
  return new Date().toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatActflLevel(level: string | null): string {
  if (!level) return "Not assessed";
  return level.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Language Progress Section ────────────────────────────────────────────────

function LanguageProgressSection({ entries }: { entries: LanguageProgressEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div data-testid="language-progress-section">
      <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
        Language Practice
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {entries.map(entry => (
          <Card
            key={entry.language}
            className="border-rose-200 dark:border-rose-800"
            data-testid={`card-language-${entry.language}`}
          >
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Languages className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span className="capitalize" data-testid={`text-language-name-${entry.language}`}>
                  {entry.language}
                </span>
              </CardTitle>
              {entry.currentActflLevel && (
                <Badge
                  variant="outline"
                  className="bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 text-xs"
                  data-testid={`badge-actfl-${entry.language}`}
                >
                  {formatActflLevel(entry.currentActflLevel)}
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5" data-testid={`stat-time-${entry.language}`}>
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>{formatMinutes(entry.practiceMinutes)} practiced</span>
                </div>
                <div className="flex items-center gap-1.5" data-testid={`stat-words-${entry.language}`}>
                  <BookMarked className="w-3 h-3 shrink-0" />
                  <span>{entry.wordsLearned} words</span>
                </div>
                {entry.canDoAchieved > 0 && (
                  <div className="flex items-center gap-1.5" data-testid={`stat-cando-${entry.language}`}>
                    <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-500" />
                    <span>{entry.canDoAchieved} can-do{entry.canDoAchieved !== 1 ? "s" : ""} achieved</span>
                  </div>
                )}
                {entry.topicsTotal > 0 && (
                  <div className="flex items-center gap-1.5" data-testid={`stat-topics-${entry.language}`}>
                    <TrendingUp className="w-3 h-3 shrink-0" />
                    <span>{entry.topicsTotal} topics covered</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Summary Tab ──────────────────────────────────────────────────────────────

function SummaryTab({ report }: { report: ProgressReport }) {
  const hasReadingModules = (report.viewedModules ?? []).length > 0;
  const hasLanguage = (report.languageProgress ?? []).length > 0;

  if (!hasReadingModules && !hasLanguage) {
    return (
      <div
        className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground gap-3"
        data-testid="summary-empty-state"
      >
        <BookOpen className="w-12 h-12 opacity-20" />
        <div>
          <p className="font-medium">No study activity yet.</p>
          <p className="text-sm mt-1">Start a language session or open a Reading Library chapter to get started.</p>
        </div>
      </div>
    );
  }

  const subjects = Object.keys(report.bySubject);

  return (
    <div className="space-y-8">
      {/* Language section — always first when present */}
      {hasLanguage && <LanguageProgressSection entries={report.languageProgress ?? []} />}

      {/* Reading module subject cards */}
      {hasReadingModules && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
            Reading Modules
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {subjects.map(domain => {
              const cfg = getSubjectCfg(domain);
              const stats = report.bySubject[domain];
              return (
                <Card key={domain} className={cfg.borderClass} data-testid={`card-subject-${domain}`}>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <cfg.Icon className={`w-4 h-4 ${cfg.iconClass}`} />
                      <span data-testid={`text-subject-title-${domain}`}>{cfg.label}</span>
                    </CardTitle>
                    <Badge variant="outline" className={cfg.badgeClass} data-testid={`badge-count-${domain}`}>
                      {stats.count} {stats.count === 1 ? "topic" : "topics"}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    {stats.lastActivity && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5" data-testid={`text-last-activity-${domain}`}>
                        <Calendar className="w-3 h-3" />
                        Last studied {formatDate(stats.lastActivity)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Recently studied reading modules */}
      {hasReadingModules && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
            Recently Studied
          </h3>
          <div className="space-y-2">
            {report.viewedModules.map(mod => {
              const cfg = getSubjectCfg(mod.subjectDomain);
              return (
                <div
                  key={mod.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md border bg-card"
                  data-testid={`row-module-${mod.id}`}
                >
                  <CheckCircle2 className={`w-4 h-4 shrink-0 ${cfg.iconClass}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate capitalize" data-testid={`text-topic-${mod.id}`}>{mod.topic}</p>
                    <p className="text-xs text-muted-foreground">{cfg.label}</p>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">{formatDate(mod.lastViewedAt)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Quiz Tab ─────────────────────────────────────────────────────────────────

const WINDOW_DAYS = 14;

function QuizTab({ report, studentName }: { report: ProgressReport; studentName: string }) {
  const [showAnswers, setShowAnswers] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // Optimistic local printed set — seed from server data
  const [localPrinted, setLocalPrinted] = useState<Set<string>>(
    () => new Set(report.viewedModules.filter(m => m.quizPrintedAt).map(m => m.id))
  );

  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Apply rolling window filter (bypass when showAll)
  const visibleModules = report.viewedModules.filter(m => {
    if (showAll) return true;
    return new Date(m.lastViewedAt) >= cutoff;
  });

  // Mark-printed mutation
  const markPrintedMutation = useMutation({
    mutationFn: async (moduleId: string) => {
      const res = await fetch(`/api/reading-module-views/${moduleId}/mark-printed`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark printed");
    },
    onMutate: (moduleId: string) => {
      setLocalPrinted(prev => new Set([...prev, moduleId]));
    },
  });

  // Group by subject — sort printed sections to bottom within each group
  const bySubject: Record<string, { mod: ViewedModule; questions: RecallItem[]; printed: boolean }[]> = {};
  for (const mod of visibleModules) {
    if (!mod.content.recallCheck?.length) continue;
    if (!bySubject[mod.subjectDomain]) bySubject[mod.subjectDomain] = [];
    bySubject[mod.subjectDomain].push({
      mod,
      questions: mod.content.recallCheck,
      printed: localPrinted.has(mod.id),
    });
  }
  // Within each subject, unprinted modules first
  for (const domain of Object.keys(bySubject)) {
    bySubject[domain].sort((a, b) => Number(a.printed) - Number(b.printed));
  }

  const hasQuestions = Object.values(bySubject).some(arr => arr.length > 0);
  const hiddenCount = report.viewedModules.filter(m =>
    m.content.recallCheck?.length && new Date(m.lastViewedAt) < cutoff
  ).length;

  if (!hasQuestions && !showAll) {
    return (
      <div
        className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground gap-3"
        data-testid="quiz-empty-state"
      >
        <ClipboardList className="w-12 h-12 opacity-20" />
        <p className="text-sm font-medium">No modules studied in the last {WINDOW_DAYS} days.</p>
        {hiddenCount > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className="text-sm text-primary underline underline-offset-2"
            data-testid="button-show-all-from-empty"
          >
            Show all {hiddenCount} older module{hiddenCount !== 1 ? "s" : ""}
          </button>
        )}
      </div>
    );
  }

  if (!hasQuestions) {
    return (
      <div
        className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground gap-3"
        data-testid="quiz-empty-state"
      >
        <ClipboardList className="w-12 h-12 opacity-20" />
        <p className="text-sm">Quiz questions will appear here once you have studied some topics.</p>
      </div>
    );
  }

  const totalQuestions = Object.values(bySubject).reduce(
    (n, arr) => n + arr.reduce((m, g) => m + g.questions.length, 0), 0
  );
  const totalModules = Object.values(bySubject).reduce((n, arr) => n + arr.length, 0);

  return (
    <div>
      {/* Print-only header — student copy */}
      <div className="hidden print:block mb-6">
        <h1 className="text-xl font-bold mb-1">Reading Quiz</h1>
        <p className="text-sm">
          <strong>Student:</strong> {studentName} &nbsp;&nbsp;
          <strong>Date:</strong> {todayLong()}
        </p>
        <hr className="mt-3" />
      </div>

      {/* Screen controls */}
      <div className="flex items-center gap-3 mb-6 print:hidden flex-wrap">
        <p className="text-sm text-muted-foreground mr-auto" data-testid="text-question-count">
          {totalQuestions} {totalQuestions === 1 ? "question" : "questions"} from {totalModules} {totalModules === 1 ? "module" : "modules"}
          {!showAll && <span className="text-xs ml-1">(last {WINDOW_DAYS} days)</span>}
        </p>
        {/* Rolling-window toggle */}
        <button
          onClick={() => setShowAll(a => !a)}
          data-testid="button-toggle-window"
          className={[
            "text-xs px-2.5 py-1 rounded-full border transition-colors",
            showAll
              ? "bg-muted text-foreground border-border"
              : "bg-background text-muted-foreground border-border hover:text-foreground",
          ].join(" ")}
        >
          {showAll ? "Showing all" : `Last ${WINDOW_DAYS} days`}
          {!showAll && hiddenCount > 0 && <span className="ml-1 opacity-60">+{hiddenCount} older</span>}
        </button>
        <Button
          variant="outline"
          onClick={() => setShowAnswers(a => !a)}
          data-testid="button-toggle-answers"
          size="sm"
        >
          {showAnswers ? <EyeOff className="w-4 h-4 mr-1.5" /> : <Eye className="w-4 h-4 mr-1.5" />}
          {showAnswers ? "Hide Answers" : "Show Answers"}
        </Button>
        <Button
          onClick={() => window.print()}
          data-testid="button-print-quiz"
          size="sm"
        >
          <Printer className="w-4 h-4 mr-1.5" />
          Print
        </Button>
      </div>

      {/* Questions — grouped by subject */}
      <div className="space-y-8 quiz-questions" data-testid="quiz-questions-section">
        {Object.entries(bySubject).map(([domain, groups]) => {
          const cfg = getSubjectCfg(domain);
          const allPrinted = groups.every(g => g.printed);
          let qNum = 0;
          return (
            <div key={domain} className={allPrinted ? "opacity-60" : ""}>
              {/* Subject header with mark-printed button */}
              <div className="flex items-center gap-2 mb-3 print:hidden">
                <cfg.Icon className={`w-4 h-4 ${cfg.iconClass}`} />
                <h3 className="font-semibold text-sm">{cfg.label}</h3>
                {allPrinted ? (
                  <Badge
                    variant="outline"
                    className="ml-auto text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
                    data-testid={`badge-printed-${domain}`}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Printed
                  </Badge>
                ) : (
                  <button
                    onClick={() => {
                      groups
                        .filter(g => !g.printed)
                        .forEach(g => markPrintedMutation.mutate(g.mod.id));
                    }}
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                    data-testid={`button-mark-printed-${domain}`}
                  >
                    Mark as printed
                  </button>
                )}
              </div>
              {/* Print-only subject header */}
              <div className="hidden print:flex items-center gap-2 mb-3">
                <h3 className="font-semibold text-sm">{cfg.label}</h3>
              </div>

              <div className="space-y-5">
                {groups.map(({ mod, questions, printed }) =>
                  questions.map((q, qi) => {
                    qNum++;
                    return (
                      <div
                        key={`${mod.id}-${qi}`}
                        className={["space-y-1", printed ? "opacity-70" : ""].join(" ")}
                        data-testid={`question-${mod.id}-${qi}`}
                      >
                        <p className="text-sm font-medium">
                          {qNum}. {q.question}
                        </p>
                        <div className={`answer-block pl-4 ${showAnswers ? "" : "print:block hidden"}`}>
                          <p className="text-sm text-muted-foreground italic">{q.answer}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ReportSkeleton() {
  return (
    <div className="space-y-4" data-testid="report-skeleton">
      {[1, 2, 3].map(i => (
        <Skeleton key={i} className="h-24 w-full rounded-md" />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgressReportPage() {
  const [activeTab, setActiveTab] = useState<"summary" | "quiz">("summary");
  const [, setLocation] = useLocation();

  const { data: report, isLoading } = useQuery<ProgressReport>({
    queryKey: ["/api/progress-report"],
  });

  const { data: authUser } = useQuery<{ firstName?: string; username?: string }>({
    queryKey: ["/api/auth/user"],
    staleTime: Infinity,
  });

  const studentName = authUser?.firstName ?? authUser?.username ?? "Student";

  return (
    <div className="flex flex-col h-full bg-background">
      <header
        className="flex items-center gap-3 px-4 py-3 border-b shrink-0 print:hidden"
        data-testid="progress-header"
      >
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setLocation("/")}
          data-testid="button-back-progress"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <ClipboardList className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-sm font-semibold">Progress Report</h1>
        {studentName !== "Student" && (
          <Badge variant="outline" className="ml-auto text-xs" data-testid="badge-student-name">
            {studentName}
          </Badge>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Tab switcher */}
          <div
            className="flex items-center gap-1 rounded-md border p-1 w-fit mb-6 print:hidden"
            data-testid="report-tabs"
          >
            {(["summary", "quiz"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                data-testid={`button-tab-${tab}`}
                className={[
                  "px-4 py-1.5 text-sm rounded transition-colors",
                  activeTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {tab === "summary" ? "Summary" : "Quiz Worksheet"}
              </button>
            ))}
          </div>

          {isLoading && <ReportSkeleton />}

          {report && activeTab === "summary" && <SummaryTab report={report} />}
          {report && activeTab === "quiz" && (
            <QuizTab report={report} studentName={studentName} />
          )}
        </div>
      </div>
    </div>
  );
}
