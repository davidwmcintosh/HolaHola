import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Briefcase, Plane, Users, AlertTriangle, Palette, ArrowLeft, Search, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Scenario } from "@shared/schema";

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof MapPin; color: string }> = {
  daily: { label: "Daily Life", icon: MapPin, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  travel: { label: "Travel", icon: Plane, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  professional: { label: "Professional", icon: Briefcase, color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  social: { label: "Social", icon: Users, color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  emergency: { label: "Emergency", icon: AlertTriangle, color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  cultural: { label: "Cultural", icon: Palette, color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
};

function formatActflLevel(level: string | null): string {
  if (!level) return "";
  return level.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ScenarioCard({ scenario, onStart }: { scenario: Scenario; onStart: () => void }) {
  const config = CATEGORY_CONFIG[scenario.category] || CATEGORY_CONFIG.daily;
  const CategoryIcon = config.icon;

  return (
    <Card className="flex flex-col hover-elevate transition-all duration-200 overflow-visible" data-testid={`card-scenario-${scenario.slug}`}>
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

        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-auto">
          <span>{formatActflLevel(scenario.minActflLevel)}</span>
          <span>-</span>
          <span>{formatActflLevel(scenario.maxActflLevel)}</span>
        </div>

        <Button
          size="sm"
          onClick={onStart}
          className="w-full mt-1"
          data-testid={`button-start-scenario-${scenario.slug}`}
        >
          <Play className="w-3.5 h-3.5 mr-1.5" />
          Start Scenario
        </Button>
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
                onStart={() => handleStartScenario(scenario)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
