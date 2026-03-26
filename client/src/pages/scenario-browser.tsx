import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Briefcase, Plane, Users, AlertTriangle, Palette, ArrowLeft, Search, Play, BookOpen, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Scenario } from "@shared/schema";
import { Link } from "wouter";

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof MapPin; color: string }> = {
  daily: { label: "Daily Life", icon: MapPin, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  travel: { label: "Travel", icon: Plane, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  professional: { label: "Professional", icon: Briefcase, color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  social: { label: "Social", icon: Users, color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  emergency: { label: "Emergency", icon: AlertTriangle, color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  cultural: { label: "Cultural", icon: Palette, color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
};

const LESSON_TYPE_LABEL: Record<string, string> = {
  grammar: "Grammar",
  vocabulary: "Vocab",
  conversation: "Conversation",
  culture: "Culture",
  reading: "Reading",
  listening: "Listening",
};

interface RelatedLesson {
  id: string;
  chapterId: string;
  name: string;
  description: string;
  lessonType: string;
  estimatedMinutes: number | null;
  imageUrl: string | null;
}

function RelatedLessonsSection({ slug, language }: { slug: string; language: string }) {
  const { data, isLoading } = useQuery<{ lessons: RelatedLesson[] }>({
    queryKey: ["/api/scenarios", slug, "related-lessons", language],
    queryFn: async () => {
      const res = await fetch(`/api/scenarios/${encodeURIComponent(slug)}/related-lessons?language=${encodeURIComponent(language)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load related lessons");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-1.5 pt-2 border-t">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    );
  }

  const lessons = data?.lessons || [];
  if (lessons.length === 0) return null;

  return (
    <div className="pt-2 border-t space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <BookOpen className="w-3 h-3" />
        Study first in the textbook
      </p>
      {lessons.map((lesson) => (
        <Link href={`/textbook?chapterId=${encodeURIComponent(lesson.chapterId)}`} key={lesson.id}>
          <div
            className="flex items-center gap-2 p-2 rounded-md hover-elevate cursor-pointer"
            data-testid={`link-related-lesson-${lesson.id}`}
          >
            {lesson.imageUrl ? (
              <img
                src={lesson.imageUrl}
                alt={lesson.name}
                className="w-10 h-10 rounded object-cover shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{lesson.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                  {LESSON_TYPE_LABEL[lesson.lessonType] || lesson.lessonType}
                </Badge>
                {lesson.estimatedMinutes && (
                  <span className="text-[10px] text-muted-foreground">{lesson.estimatedMinutes}m</span>
                )}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function ScenarioCard({
  scenario,
  onStart,
  language,
  practiced,
}: {
  scenario: Scenario;
  onStart: () => void;
  language: string;
  practiced?: boolean;
}) {
  const config = CATEGORY_CONFIG[scenario.category] || CATEGORY_CONFIG.daily;
  const CategoryIcon = config.icon;
  const [showRelated, setShowRelated] = useState(false);

  return (
    <Card className="flex flex-col hover-elevate transition-all duration-200 overflow-visible" data-testid={`card-scenario-${scenario.slug}`}>
      {scenario.imageUrl ? (
        <div className="relative h-36 rounded-t-md overflow-hidden shrink-0">
          <img
            src={scenario.imageUrl}
            alt={scenario.title}
            className="w-full h-full object-cover object-top"
            data-testid={`img-scenario-cover-${scenario.slug}`}
          />
          {practiced && (
            <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3 h-3" />
              Practiced
            </div>
          )}
        </div>
      ) : (
        <div className="h-36 rounded-t-md bg-muted shrink-0 flex items-center justify-center">
          <CategoryIcon className="w-8 h-8 text-muted-foreground opacity-40" />
        </div>
      )}
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <h3 className="font-semibold text-base" data-testid={`text-scenario-title-${scenario.slug}`}>
            {scenario.title}
          </h3>
          <Badge className={`${config.color} shrink-0`} data-testid={`badge-category-${scenario.slug}`}>
            <CategoryIcon className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>
        </div>

        {scenario.location && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3 shrink-0" />
            {scenario.location}
          </p>
        )}

        <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-scenario-desc-${scenario.slug}`}>
          {scenario.description}
        </p>

        <Button
          size="sm"
          onClick={onStart}
          className="w-full mt-1"
          data-testid={`button-start-scenario-${scenario.slug}`}
        >
          <Play className="w-3.5 h-3.5 mr-1.5" />
          {practiced ? "Practice again" : "Start Scenario"}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="w-full -mt-1 text-xs text-muted-foreground"
          onClick={() => setShowRelated(v => !v)}
          data-testid={`button-toggle-related-${scenario.slug}`}
        >
          {showRelated ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
          {showRelated ? "Hide" : "Textbook prep"}
        </Button>

        {showRelated && (
          <RelatedLessonsSection slug={scenario.slug} language={language} />
        )}
      </div>
    </Card>
  );
}

function ScenarioCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3">
        <div className="flex justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-full" />
      </div>
    </Card>
  );
}

export default function ScenarioBrowser() {
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: scenarios = [], isLoading } = useQuery<Scenario[]>({
    queryKey: ["/api/scenarios", language],
    queryFn: async () => {
      const res = await fetch(`/api/scenarios?language=${encodeURIComponent(language)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(text);
      }
      return res.json();
    },
  });

  const { data: scenarioHistory = [] } = useQuery<{ scenarioId: string; completedAt: string | null }[]>({
    queryKey: ["/api/user/scenario-history"],
  });

  const practicedIds = useMemo(() => new Set(scenarioHistory.map(h => h.scenarioId)), [scenarioHistory]);

  const filteredScenarios = useMemo(() => {
    let filtered = scenarios;
    if (selectedCategory) {
      filtered = filtered.filter((s) => s.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          (s.location && s.location.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [scenarios, selectedCategory, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of scenarios) {
      counts[s.category] = (counts[s.category] || 0) + 1;
    }
    return counts;
  }, [scenarios]);

  const handleStartScenario = (scenario: Scenario) => {
    navigate(`/chat?scenario=${scenario.slug}`);
  };

  return (
    <div className="flex flex-col h-full" data-testid="page-scenario-browser">
      <div className="border-b px-4 py-3 flex items-center gap-3 flex-wrap">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          data-testid="button-back-to-chat"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-lg font-semibold" data-testid="text-page-title">Scenarios</h1>
        {practicedIds.size > 0 && scenarios.length > 0 && (
          <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid="text-practiced-count">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            {practicedIds.size}/{scenarios.length} practiced
          </span>
        )}
        <div className="flex-1" />
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search scenarios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
            data-testid="input-search-scenarios"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
            data-testid="button-filter-all"
          >
            All ({scenarios.length})
          </Button>
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
            const count = categoryCounts[key] || 0;
            if (count === 0) return null;
            const Icon = config.icon;
            return (
              <Button
                key={key}
                variant={selectedCategory === key ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(key === selectedCategory ? null : key)}
                data-testid={`button-filter-${key}`}
              >
                <Icon className="w-3.5 h-3.5 mr-1" />
                {config.label} ({count})
              </Button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <ScenarioCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredScenarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Search className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm">No scenarios found</p>
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setSearchQuery("")}
                data-testid="button-clear-search"
              >
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredScenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                language={language}
                practiced={practicedIds.has(scenario.id)}
                onStart={() => handleStartScenario(scenario)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
