import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  BookOpen,
  Microscope,
  Landmark,
  Plus,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { ReadingModulePanel } from "@/components/ReadingModulePanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";

type Subject = "biology" | "history";

interface SyllabusChapter {
  chapterNumber: number;
  chapterTitle: string;
  topic: string;
  alternativeTopic?: string;
}

interface SyllabusUnit {
  unitNumber: number;
  unitTitle: string;
  chapters: SyllabusChapter[];
}

interface SubjectSyllabus {
  id: string;
  subject: string;
  units: SyllabusUnit[];
  source: string;
  bookTitle: string | null;
  bookSubtitle: string | null;
  description: string | null;
  targetAudience: string | null;
  scope: string | null;
}

interface ProgressReport {
  viewedModules: Array<{ id: string; topic: string; subjectDomain: string }>;
  bySubject: Record<string, { count: number; lastActivity: string | null }>;
}

const SUBJECT_CONFIG = {
  biology: {
    label: "Biology",
    icon: Microscope,
    activeTab: "bg-emerald-600 text-white",
    iconClass: "text-emerald-600 dark:text-emerald-400",
    bgIcon: "bg-emerald-100 dark:bg-emerald-900/30",
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    unitBg: "bg-emerald-50 dark:bg-emerald-950/30",
    unitBorder: "border-emerald-200 dark:border-emerald-800",
    placeholder: "e.g. photosynthesis, CRISPR, natural selection",
  },
  history: {
    label: "History",
    icon: Landmark,
    activeTab: "bg-amber-600 text-white",
    iconClass: "text-amber-600 dark:text-amber-400",
    bgIcon: "bg-amber-100 dark:bg-amber-900/30",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    unitBg: "bg-amber-50 dark:bg-amber-950/30",
    unitBorder: "border-amber-200 dark:border-amber-800",
    placeholder: "e.g. the Cold War, women's suffrage, imperialism",
  },
};

function useSearchParam(key: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key) ?? "";
}

export default function ReadingLibrary() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const initialSubject = (useSearchParam("subject") as Subject) || "biology";

  const [activeSubject, setActiveSubject] = useState<Subject>(initialSubject);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [newTopicInput, setNewTopicInput] = useState("");
  const [expandedUnits, setExpandedUnits] = useState<Set<number>>(new Set([1]));

  const cfg = SUBJECT_CONFIG[activeSubject];
  const Icon = cfg.icon;

  const { data: syllabus, isLoading: syllabusLoading } = useQuery<SubjectSyllabus>({
    queryKey: ["/api/syllabi", activeSubject],
    queryFn: async () => {
      const res = await fetch(`/api/syllabi/${activeSubject}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    staleTime: Infinity,
  });

  const { data: progress } = useQuery<ProgressReport>({
    queryKey: ["/api/progress-report"],
    staleTime: 30_000,
  });

  const viewedTopics = useMemo(() => {
    if (!progress) return new Set<string>();
    return new Set(
      progress.viewedModules
        .filter(m => m.subjectDomain === activeSubject)
        .map(m => m.topic.toLowerCase())
    );
  }, [progress, activeSubject]);

  const viewMutation = useMutation({
    mutationFn: (moduleId: string) =>
      apiRequest("POST", `/api/reading-modules/${moduleId}/view`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/progress-report"] });
    },
  });

  const handleModuleLoaded = (moduleId: string) => {
    viewMutation.mutate(moduleId);
  };

  const handleGenerateNew = () => {
    const trimmed = newTopicInput.trim();
    if (!trimmed) return;
    setSelectedTopic(trimmed);
    setNewTopicInput("");
  };

  const toggleUnit = (unitNumber: number) => {
    setExpandedUnits(prev => {
      const next = new Set(prev);
      if (next.has(unitNumber)) {
        next.delete(unitNumber);
      } else {
        next.add(unitNumber);
      }
      return next;
    });
  };

  const switchSubject = (s: Subject) => {
    setActiveSubject(s);
    setSelectedTopic(null);
    setExpandedUnits(new Set([1]));
  };

  const listPanel = (
    <div className={`flex flex-col ${selectedTopic && !isMobile ? "w-80 shrink-0 border-r" : "flex-1"} ${selectedTopic && isMobile ? "hidden" : ""}`}>
      <div className="flex-1 overflow-y-auto">
        {/* Course metadata header */}
        {syllabus && (syllabus.bookTitle || syllabus.description) && (
          <div className="px-4 py-3 border-b bg-muted/30">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                {syllabus.bookTitle && (
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Textbook</p>
                )}
                {syllabus.bookTitle && (
                  <p className="font-medium text-sm leading-snug">
                    {syllabus.bookTitle}
                    {syllabus.bookSubtitle && (
                      <span className="text-muted-foreground font-normal"> — {syllabus.bookSubtitle}</span>
                    )}
                  </p>
                )}
                {syllabus.scope && (
                  <p className="text-xs text-muted-foreground mt-0.5">{syllabus.scope}</p>
                )}
                {syllabus.description && (
                  <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{syllabus.description}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {syllabusLoading && (
          <div className="p-4 space-y-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-md" />
            ))}
          </div>
        )}

        {syllabus?.units.map(unit => {
          const viewedInUnit = unit.chapters.filter(
            ch => viewedTopics.has(ch.topic.toLowerCase())
          ).length;
          const isExpanded = expandedUnits.has(unit.unitNumber);

          return (
            <div key={unit.unitNumber} className="border-b last:border-b-0">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover-elevate"
                onClick={() => toggleUnit(unit.unitNumber)}
                data-testid={`button-unit-${unit.unitNumber}`}
              >
                {isExpanded
                  ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Unit {unit.unitNumber}
                  </p>
                  <p className="text-sm font-medium truncate">{unit.unitTitle}</p>
                </div>
                {viewedInUnit > 0 && (
                  <Badge variant="outline" className={`text-xs shrink-0 ${cfg.badgeClass}`}>
                    {viewedInUnit}/{unit.chapters.length}
                  </Badge>
                )}
              </button>

              {isExpanded && (
                <div className={`${cfg.unitBg} border-t ${cfg.unitBorder}`}>
                  {unit.chapters.map(chapter => {
                    const isViewedStandard = viewedTopics.has(chapter.topic.toLowerCase());
                    const isViewedAlt = chapter.alternativeTopic
                      ? viewedTopics.has(chapter.alternativeTopic.toLowerCase())
                      : false;
                    const isViewed = isViewedStandard || isViewedAlt;
                    const isSelected =
                      selectedTopic === chapter.topic ||
                      selectedTopic === chapter.alternativeTopic;

                    if (chapter.alternativeTopic) {
                      return (
                        <div
                          key={chapter.chapterNumber}
                          className={`w-full flex items-start gap-3 px-5 py-2.5 border-b last:border-b-0 ${isSelected ? "bg-muted" : ""}`}
                          data-testid={`chapter-row-${chapter.chapterNumber}`}
                        >
                          <span className="text-xs text-muted-foreground shrink-0 w-8 pt-1">
                            {chapter.chapterNumber}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${isViewed ? "text-foreground" : "text-muted-foreground"}`}>
                              {chapter.chapterTitle}
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              <Button
                                size="sm"
                                variant={selectedTopic === chapter.topic ? "default" : "outline"}
                                onClick={() => setSelectedTopic(chapter.topic)}
                                data-testid={`button-chapter-${chapter.chapterNumber}-science`}
                              >
                                {isViewedStandard && <CheckCircle2 className="w-3 h-3 mr-1" />}
                                Scientific Theory
                              </Button>
                              <Button
                                size="sm"
                                variant={selectedTopic === chapter.alternativeTopic ? "default" : "outline"}
                                onClick={() => setSelectedTopic(chapter.alternativeTopic!)}
                                data-testid={`button-chapter-${chapter.chapterNumber}-creation`}
                              >
                                {isViewedAlt && <CheckCircle2 className="w-3 h-3 mr-1" />}
                                Creationist View
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={chapter.chapterNumber}
                        className={`w-full flex items-center gap-3 px-5 py-2.5 text-left border-b last:border-b-0 hover-elevate ${isSelected ? "bg-muted" : ""}`}
                        onClick={() => setSelectedTopic(chapter.topic)}
                        data-testid={`button-chapter-${chapter.chapterNumber}`}
                      >
                        <span className="text-xs text-muted-foreground shrink-0 w-8">
                          {chapter.chapterNumber}
                        </span>
                        <span className={`text-sm flex-1 min-w-0 truncate ${isViewed ? "text-foreground" : "text-muted-foreground"}`}>
                          {chapter.chapterTitle}
                        </span>
                        {isViewed && (
                          <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${cfg.iconClass}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div className="px-4 py-4 border-t mt-2">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Generate a custom topic</p>
          <div className="flex items-center gap-2">
            <Input
              value={newTopicInput}
              onChange={e => setNewTopicInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleGenerateNew()}
              placeholder={cfg.placeholder}
              className="text-sm"
              data-testid="input-new-topic"
            />
            <Button
              size="icon"
              onClick={handleGenerateNew}
              disabled={!newTopicInput.trim()}
              data-testid="button-generate-new"
              className={cfg.activeTab}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b shrink-0" data-testid="library-header">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setLocation("/")}
          data-testid="button-back-library"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <BookOpen className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-sm font-semibold">Reading Library</h1>

        <div className="ml-auto flex items-center gap-1 rounded-md border p-1" data-testid="subject-tabs">
          {(["biology", "history"] as Subject[]).map(s => (
            <button
              key={s}
              onClick={() => switchSubject(s)}
              data-testid={`button-tab-${s}`}
              className={[
                "px-3 py-1 text-xs rounded transition-colors capitalize",
                activeSubject === s
                  ? SUBJECT_CONFIG[s].activeTab
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {SUBJECT_CONFIG[s].label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {listPanel}

        {selectedTopic ? (
          <div className={`flex-1 overflow-hidden ${isMobile ? "" : ""}`}>
            <ReadingModulePanel
              key={`${activeSubject}::${selectedTopic}`}
              subject={activeSubject}
              onClose={() => setSelectedTopic(null)}
              initialTopic={selectedTopic}
              onLoaded={handleModuleLoaded}
            />
          </div>
        ) : !isMobile ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <Icon className={`w-12 h-12 opacity-20 ${cfg.iconClass}`} />
            <p className="text-sm">Select a chapter to read, or generate a custom topic below.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
