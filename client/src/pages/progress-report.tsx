import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  content: {
    recallCheck: RecallItem[];
    keyTerms: Array<{ term: string; definition: string }>;
    keyConcepts: string[];
  };
}

interface ProgressReport {
  viewedModules: ViewedModule[];
  bySubject: Record<string, { count: number; lastActivity: string | null }>;
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
    label: "Spanish",
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

// ─── Summary Tab ──────────────────────────────────────────────────────────────

function SummaryTab({ report }: { report: ProgressReport }) {
  if (report.viewedModules.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground gap-3"
        data-testid="summary-empty-state"
      >
        <BookOpen className="w-12 h-12 opacity-20" />
        <div>
          <p className="font-medium">No reading modules studied yet.</p>
          <p className="text-sm mt-1">Open a chapter in the Reading Library to get started.</p>
        </div>
      </div>
    );
  }

  const subjects = Object.keys(report.bySubject);

  return (
    <div className="space-y-6">
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
    </div>
  );
}

// ─── Quiz Tab ─────────────────────────────────────────────────────────────────

function QuizTab({ report, studentName }: { report: ProgressReport; studentName: string }) {
  const [showAnswers, setShowAnswers] = useState(false);

  const bySubject: Record<string, { mod: ViewedModule; questions: RecallItem[] }[]> = {};
  for (const mod of report.viewedModules) {
    if (!mod.content.recallCheck?.length) continue;
    if (!bySubject[mod.subjectDomain]) bySubject[mod.subjectDomain] = [];
    bySubject[mod.subjectDomain].push({ mod, questions: mod.content.recallCheck });
  }

  const hasQuestions = Object.values(bySubject).some(arr => arr.length > 0);

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
      <div className="flex items-center gap-3 mb-6 print:hidden">
        <p className="text-sm text-muted-foreground mr-auto" data-testid="text-question-count">
          {totalQuestions} {totalQuestions === 1 ? "question" : "questions"} from {report.viewedModules.filter(m => m.content.recallCheck?.length).length} modules
        </p>
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
          Print Quiz
        </Button>
      </div>

      {/* Questions — student copy (answers hidden in print via .answer-block CSS) */}
      <div className="space-y-8 quiz-questions" data-testid="quiz-questions-section">
        {Object.entries(bySubject).map(([domain, groups]) => {
          const cfg = getSubjectCfg(domain);
          let qNum = 0;
          return (
            <div key={domain} data-testid={`quiz-subject-${domain}`}>
              <div className={`flex items-center gap-2 mb-4 pb-2 border-b ${cfg.borderClass}`}>
                <cfg.Icon className={`w-4 h-4 ${cfg.iconClass}`} />
                <h2 className="text-base font-semibold">{cfg.label}</h2>
              </div>
              <div className="space-y-4">
                {groups.map(({ mod, questions }) => (
                  <div key={mod.id}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2 capitalize">
                      {mod.topic}
                    </p>
                    {questions.map((item, i) => {
                      qNum++;
                      const n = qNum;
                      return (
                        <div key={i} className="mb-4" data-testid={`question-${n}`}>
                          <p className="text-sm">
                            <span className="font-semibold">{n}.</span> {item.question}
                          </p>
                          {/* Shown on screen only when toggle is on */}
                          <div className={`answer-block mt-1 ml-5 ${showAnswers ? "" : "hidden"}`} data-testid={`answer-${n}`}>
                            <p className="text-sm text-muted-foreground italic">{item.answer}</p>
                          </div>
                          {/* Blank lines for writing — hidden in print on answer key page via CSS */}
                          <div className="mt-2 ml-5 answer-line-block">
                            <div className="border-b border-dashed border-muted-foreground/30 mt-5" />
                            <div className="border-b border-dashed border-muted-foreground/30 mt-5" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Answer Key — print only, page 2 */}
      <div className="answer-key hidden print:block mt-16 page-break-before">
        <h2 className="text-lg font-bold mb-1">Answer Key</h2>
        <p className="text-sm mb-4">
          <strong>Student:</strong> {studentName} &nbsp;&nbsp;
          <strong>Date:</strong> {todayLong()}
        </p>
        <hr className="mb-4" />
        {Object.entries(bySubject).map(([domain, groups]) => {
          const cfg = getSubjectCfg(domain);
          let qNum = 0;
          return (
            <div key={domain} className="mb-6">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <cfg.Icon className={`w-4 h-4 ${cfg.iconClass}`} />
                {cfg.label}
              </h3>
              {groups.map(({ questions }) =>
                questions.map((item, i) => {
                  qNum++;
                  return (
                    <p key={i} className="text-sm mb-1.5">
                      <span className="font-semibold">{qNum}.</span> {item.answer}
                    </p>
                  );
                })
              )}
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
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-md" />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgressReport() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"summary" | "quiz">("summary");

  const { data: report, isLoading } = useQuery<ProgressReport>({
    queryKey: ["/api/progress-report"],
    staleTime: 30_000,
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
