import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  X,
  BookOpen,
  Lightbulb,
  AlertTriangle,
  MessageSquare,
  CheckCircle2,
  ExternalLink,
  Search,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface KeyTerm {
  term: string;
  definition: string;
}

interface RecallItem {
  question: string;
  answer: string;
}

interface ReadingModuleContent {
  overview: string;
  keyConcepts: string[];
  keyTerms: KeyTerm[];
  misconceptions: string[];
  framingQuestions: string[];
  recallCheck: RecallItem[];
  citations: string[];
}

interface ReadingModule {
  id: string;
  subjectDomain: string;
  topic: string;
  content: ReadingModuleContent;
  generatedAt: string;
}

interface ReadingModulePanelProps {
  subject: "biology" | "history";
  onClose: () => void;
  initialTopic?: string;
}

const SUBJECT_STYLES = {
  biology: {
    accent: "emerald",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    section: "border-emerald-200 dark:border-emerald-800",
    icon: "text-emerald-600 dark:text-emerald-400",
    button: "bg-emerald-600 hover:bg-emerald-700 text-white",
    framing: "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800",
  },
  history: {
    accent: "amber",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    section: "border-amber-200 dark:border-amber-800",
    icon: "text-amber-600 dark:text-amber-400",
    button: "bg-amber-600 hover:bg-amber-700 text-white",
    framing: "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800",
  },
};

function RecallCard({ item }: { item: RecallItem }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div
      className="border rounded-md p-3 cursor-pointer hover-elevate"
      onClick={() => setRevealed(r => !r)}
      data-testid="recall-card"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{item.question}</p>
        {revealed ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        )}
      </div>
      {revealed && (
        <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">{item.answer}</p>
      )}
    </div>
  );
}

function ModuleContent({ module, styles }: { module: ReadingModule; styles: typeof SUBJECT_STYLES["biology"] }) {
  const { content } = module;

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h2 className="text-lg font-semibold capitalize mb-2" data-testid="text-module-topic">
          {module.topic}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-module-overview">
          {content.overview}
        </p>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className={`w-4 h-4 ${styles.icon}`} />
          <h3 className="text-sm font-semibold">Key Concepts</h3>
        </div>
        <ul className="space-y-2">
          {content.keyConcepts.map((concept, i) => (
            <li key={i} className="flex items-start gap-2 text-sm" data-testid={`text-concept-${i}`}>
              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-${styles.accent}-500`} />
              <span>{concept}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className={`w-4 h-4 ${styles.icon}`} />
          <h3 className="text-sm font-semibold">Key Terms</h3>
        </div>
        <div className="space-y-2">
          {content.keyTerms.map((kt, i) => (
            <div key={i} className="text-sm" data-testid={`text-term-${i}`}>
              <span className="font-medium">{kt.term}</span>
              <span className="text-muted-foreground"> — {kt.definition}</span>
            </div>
          ))}
        </div>
      </div>

      {content.misconceptions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className={`w-4 h-4 ${styles.icon}`} />
            <h3 className="text-sm font-semibold">Common Misconceptions</h3>
          </div>
          <ul className="space-y-2">
            {content.misconceptions.map((m, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2" data-testid={`text-misconception-${i}`}>
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-muted-foreground/50" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {content.framingQuestions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className={`w-4 h-4 ${styles.icon}`} />
            <h3 className="text-sm font-semibold">Questions to Explore</h3>
          </div>
          <div className="space-y-2">
            {content.framingQuestions.map((q, i) => (
              <div key={i} className={`rounded-md p-3 text-sm ${styles.framing}`} data-testid={`text-framing-${i}`}>
                {q}
              </div>
            ))}
          </div>
        </div>
      )}

      {content.recallCheck.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className={`w-4 h-4 ${styles.icon}`} />
            <h3 className="text-sm font-semibold">Quick Recall Check</h3>
            <span className="text-xs text-muted-foreground">(tap to reveal)</span>
          </div>
          <div className="space-y-2">
            {content.recallCheck.map((item, i) => (
              <RecallCard key={i} item={item} />
            ))}
          </div>
        </div>
      )}

      {content.citations.length > 0 && (
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-2">Sources</p>
          <div className="space-y-1">
            {content.citations.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                data-testid={`link-citation-${i}`}
              >
                <ExternalLink className="w-3 h-3 shrink-0" />
                <span className="truncate">{url.replace(/^https?:\/\//, '')}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ModuleSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
      <p className="text-xs text-muted-foreground text-center pt-4">
        Generating module — this takes about 20–30 seconds on first load…
      </p>
    </div>
  );
}

export function ReadingModulePanel({ subject, onClose, initialTopic = "" }: ReadingModulePanelProps) {
  const styles = SUBJECT_STYLES[subject];
  const [topicInput, setTopicInput] = useState(initialTopic);
  const [activeTopic, setActiveTopic] = useState(initialTopic);

  const { data: module, isLoading, isError } = useQuery<ReadingModule>({
    queryKey: ["/api/reading-modules", subject, activeTopic],
    queryFn: async () => {
      const res = await fetch(`/api/reading-modules/${subject}/${encodeURIComponent(activeTopic)}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!activeTopic,
    staleTime: Infinity,
  });

  const handleLoad = () => {
    const trimmed = topicInput.trim();
    if (!trimmed) return;
    if (trimmed === activeTopic) {
      queryClient.invalidateQueries({ queryKey: ["/api/reading-modules", subject, activeTopic] });
    }
    setActiveTopic(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLoad();
  };

  return (
    <div
      className="flex flex-col h-full bg-background border-l"
      data-testid="reading-module-panel"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className={`w-4 h-4 ${styles.icon}`} />
          <span className="text-sm font-semibold">Reading Module</span>
          <Badge variant="outline" className={`text-xs ${styles.badge}`}>
            {subject}
          </Badge>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          data-testid="button-close-reading-panel"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <Input
          value={topicInput}
          onChange={e => setTopicInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`e.g. ${subject === "biology" ? "cell division" : "causes of World War I"}`}
          className="text-sm"
          data-testid="input-reading-topic"
        />
        <Button
          onClick={handleLoad}
          disabled={!topicInput.trim() || isLoading}
          data-testid="button-load-module"
          className={styles.button}
        >
          <Search className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!activeTopic && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground">
            <BookOpen className="w-10 h-10 opacity-30" />
            <p className="text-sm">Enter a topic above to load or generate a reading module.</p>
          </div>
        )}
        {activeTopic && isLoading && <ModuleSkeleton />}
        {activeTopic && isError && (
          <div className="text-sm text-destructive text-center pt-8">
            Failed to load module. Please try again.
          </div>
        )}
        {activeTopic && module && (
          <ModuleContent module={module} styles={styles} />
        )}
      </div>
    </div>
  );
}
