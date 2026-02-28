import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ArrowLeft, BookOpen, Microscope, Landmark, Plus, Search } from "lucide-react";
import { ReadingModulePanel } from "@/components/ReadingModulePanel";
import { useIsMobile } from "@/hooks/use-mobile";

type Subject = "biology" | "history";

interface ModuleSummary {
  id: string;
  subjectDomain: string;
  topic: string;
  generatedAt: string;
  version: number;
}

const SUBJECT_CONFIG = {
  biology: {
    label: "Biology",
    icon: Microscope,
    accent: "emerald",
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    activeTab: "bg-emerald-600 text-white",
    iconClass: "text-emerald-600 dark:text-emerald-400",
    bgIcon: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  history: {
    label: "History",
    icon: Landmark,
    accent: "amber",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    activeTab: "bg-amber-600 text-white",
    iconClass: "text-amber-600 dark:text-amber-400",
    bgIcon: "bg-amber-100 dark:bg-amber-900/30",
  },
};

function useSearchParam(key: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key) ?? "";
}

export default function ReadingLibrary() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const initialSubject = (useSearchParam("subject") as Subject) || "biology";

  const [activeSubject, setActiveSubject] = useState<Subject>(initialSubject);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [newTopicInput, setNewTopicInput] = useState("");
  const [generatingTopic, setGeneratingTopic] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: modules, isLoading } = useQuery<ModuleSummary[]>({
    queryKey: ["/api/reading-modules", activeSubject],
    queryFn: async () => {
      const res = await fetch(`/api/reading-modules/${activeSubject}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    staleTime: 30_000,
  });

  const cfg = SUBJECT_CONFIG[activeSubject];
  const Icon = cfg.icon;

  const filtered = modules?.filter(m =>
    m.topic.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const handleGenerateNew = () => {
    const trimmed = newTopicInput.trim();
    if (!trimmed) return;
    setGeneratingTopic(trimmed);
    setSelectedTopic(trimmed);
    setNewTopicInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleGenerateNew();
  };

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
              onClick={() => { setActiveSubject(s); setSelectedTopic(null); setSearch(""); }}
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
        <div className={`flex flex-col ${selectedTopic && !isMobile ? "w-80 shrink-0 border-r" : "flex-1"} ${selectedTopic && isMobile ? "hidden" : ""}`}>
          <div className="px-4 py-3 border-b space-y-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search topics…"
                className="pl-9 text-sm"
                data-testid="input-search-modules"
              />
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={newTopicInput}
                onChange={e => setNewTopicInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`New topic — e.g. ${activeSubject === "biology" ? "photosynthesis" : "the Cold War"}`}
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

          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-md" />
                ))}
              </div>
            )}

            {!isLoading && filtered.length === 0 && !generatingTopic && (
              <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground px-4">
                <BookOpen className="w-8 h-8 opacity-30 mb-2" />
                <p className="text-sm">
                  {search ? "No modules match your search." : "No modules yet. Generate your first one above."}
                </p>
              </div>
            )}

            {generatingTopic && !modules?.find(m => m.topic === generatingTopic) && (
              <button
                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b hover-elevate ${selectedTopic === generatingTopic ? "bg-muted" : ""}`}
                onClick={() => setSelectedTopic(generatingTopic)}
                data-testid="card-module-generating"
              >
                <div className={`flex items-center justify-center w-8 h-8 rounded-md shrink-0 ${cfg.bgIcon}`}>
                  <Icon className={`w-4 h-4 ${cfg.iconClass}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium capitalize truncate">{generatingTopic}</p>
                  <Badge variant="outline" className={`text-xs mt-0.5 ${cfg.badgeClass}`}>generating…</Badge>
                </div>
              </button>
            )}

            {filtered.map(module => (
              <button
                key={module.id}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b hover-elevate ${selectedTopic === module.topic ? "bg-muted" : ""}`}
                onClick={() => setSelectedTopic(module.topic)}
                data-testid={`card-module-${module.id}`}
              >
                <div className={`flex items-center justify-center w-8 h-8 rounded-md shrink-0 ${cfg.bgIcon}`}>
                  <Icon className={`w-4 h-4 ${cfg.iconClass}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium capitalize truncate">{module.topic}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(module.generatedAt).toLocaleDateString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {selectedTopic ? (
          <div className={`flex-1 overflow-hidden ${isMobile ? "" : ""}`}>
            <ReadingModulePanel
              key={`${activeSubject}::${selectedTopic}`}
              subject={activeSubject}
              onClose={() => setSelectedTopic(null)}
              initialTopic={selectedTopic}
            />
          </div>
        ) : !isMobile ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <BookOpen className="w-12 h-12 opacity-20" />
            <p className="text-sm">Select a topic from the list, or generate a new one.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
