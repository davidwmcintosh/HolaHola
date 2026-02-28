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
  Microscope,
  Landmark,
  BookOpen,
  Printer,
  Eye,
  EyeOff,
  Calendar,
  CheckCircle2,
} from "lucide-react";

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

interface AuthUser {
  firstName?: string;
  email?: string;
}

const SUBJECT_CONFIG = {
  biology: {
    label: "Biology",
    Icon: Microscope,
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    iconClass: "text-emerald-600 dark:text-emerald-400",
    cardBg: "border-emerald-200 dark:border-emerald-800",
  },
  history: {
    label: "History",
    Icon: Landmark,
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    iconClass: "text-amber-600 dark:text-amber-400",
    cardBg: "border-amber-200 dark:border-amber-800",
  },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SummaryTab({ report }: { report: ProgressReport }) {
  if (report.viewedModules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground gap-3 print:hidden">
        <BookOpen className="w-12 h-12 opacity-20" />
        <div>
          <p className="font-medium">No reading modules studied yet.</p>
          <p className="text-sm mt-1">Open a chapter in the Reading Library to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(["biology", "history"] as const).map(subj => {
          const cfg = SUBJECT_CONFIG[subj];
          const stats = report.bySubject[subj];
          if (!stats) return null;
          return (
            <Card key={subj} className={cfg.cardBg} data-testid={`card-subject-${subj}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <cfg.Icon className={`w-4 h-4 ${cfg.iconClass}`} />
                  {cfg.label}
                </CardTitle>
                <Badge variant="outline" className={cfg.badgeClass}>
                  {stats.count} {stats.count === 1 ? "topic" : "topics"}
                </Badge>
              </CardHeader>
              <CardContent>
                {stats.lastActivity && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
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
            const cfg = SUBJECT_CONFIG[mod.subjectDomain as "biology" | "history"];
            if (!cfg) return null;
            return (
              <div
                key={mod.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md border bg-card"
                data-testid={`row-module-${mod.id}`}
              >
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${cfg.iconClass}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate capitalize">{mod.topic}</p>
                  <p className="text-xs text-muted-foreground">{cfg.label}</p>
                </div>
                <p className="text-xs text-muted-foreground shrink-0">
                  {formatDate(mod.lastViewedAt)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function QuizTab({ report, user }: { report: ProgressReport; user: AuthUser | null }) {
  const [showAnswers, setShowAnswers] = useState(false);

  const bySubject: Record<string, { mod: ViewedModule; questions: RecallItem[] }[]> = {};
  for (const mod of report.viewedModules) {
    if (!mod.content.recallCheck?.length) continue;
    if (!bySubject[mod.subjectDomain]) bySubject[mod.subjectDomain] = [];
    bySubject[mod.subjectDomain].push({ mod, questions: mod.content.recallCheck });
  }

  const hasQuestions = Object.values(bySubject).some(arr => arr.length > 0);

  const today = new Date().toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (!hasQuestions) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground gap-3 print:hidden">
        <ClipboardList className="w-12 h-12 opacity-20" />
        <p className="text-sm">Quiz questions will appear here once you've studied some topics.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="print-header hidden print:block mb-6">
        <h1 className="text-xl font-bold">Reading Quiz</h1>
        <p className="text-sm text-muted-foreground">
          {user?.firstName ? `Student: ${user.firstName}` : ""} &nbsp;|&nbsp; Date: {today}
        </p>
      </div>

      <div className="flex items-center gap-3 mb-6 print:hidden">
        <Button
          variant="outline"
          onClick={() => setShowAnswers(a => !a)}
          data-testid="button-toggle-answers"
          className="flex items-center gap-2"
        >
          {showAnswers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showAnswers ? "Hide Answers" : "Show Answers"}
        </Button>
        <Button
          onClick={() => window.print()}
          data-testid="button-print-quiz"
          className="flex items-center gap-2"
        >
          <Printer className="w-4 h-4" />
          Print Quiz
        </Button>
      </div>

      <div className="space-y-8 quiz-questions">
        {(["biology", "history"] as const).map(subj => {
          const groups = bySubject[subj];
          if (!groups?.length) return null;
          const cfg = SUBJECT_CONFIG[subj];
          let qNum = 0;

          return (
            <div key={subj}>
              <div className={`flex items-center gap-2 mb-4 pb-2 border-b ${cfg.cardBg}`}>
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
                      return (
                        <div
                          key={i}
                          className="mb-3"
                          data-testid={`question-${qNum}`}
                        >
                          <p className="text-sm">
                            <span className="font-semibold">{qNum}.</span> {item.question}
                          </p>
                          <div className={`answer-block mt-1 ml-5 ${showAnswers ? "" : "hidden"}`}>
                            <p className="text-sm text-muted-foreground italic">{item.answer}</p>
                          </div>
                          <div className="mt-1 ml-5 answer-line-block">
                            <div className="border-b border-dashed border-muted-foreground/30 mt-4" />
                            <div className="border-b border-dashed border-muted-foreground/30 mt-4" />
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

      <div className="answer-key hidden print:block mt-16 page-break-before">
        <h2 className="text-lg font-bold mb-4 border-b pb-2">Answer Key</h2>
        {(["biology", "history"] as const).map(subj => {
          const groups = bySubject[subj];
          if (!groups?.length) return null;
          const cfg = SUBJECT_CONFIG[subj];
          let qNum = 0;
          return (
            <div key={subj} className="mb-6">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <cfg.Icon className={`w-4 h-4 ${cfg.iconClass}`} />
                {cfg.label}
              </h3>
              {groups.map(({ questions }) =>
                questions.map((item, i) => {
                  qNum++;
                  return (
                    <p key={i} className="text-sm mb-1">
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

export default function ProgressReport() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"summary" | "quiz">("summary");

  const { data: report, isLoading } = useQuery<ProgressReport>({
    queryKey: ["/api/progress-report"],
    staleTime: 30_000,
  });

  const { data: user } = useQuery<AuthUser>({
    queryKey: ["/api/auth/user"],
    staleTime: Infinity,
  });

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b shrink-0 print:hidden" data-testid="progress-header">
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
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-1 rounded-md border p-1 w-fit mb-6 print:hidden" data-testid="report-tabs">
            {(["summary", "quiz"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                data-testid={`button-tab-${tab}`}
                className={[
                  "px-4 py-1.5 text-sm rounded transition-colors capitalize",
                  activeTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {tab === "summary" ? "Summary" : "Quiz Worksheet"}
              </button>
            ))}
          </div>

          {isLoading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-md" />
              ))}
            </div>
          )}

          {report && activeTab === "summary" && <SummaryTab report={report} />}
          {report && activeTab === "quiz" && <QuizTab report={report} user={user ?? null} />}
        </div>
      </div>
    </div>
  );
}
