import { useState, useEffect } from "react";
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
  ZoomIn,
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

interface ModuleImage {
  url: string;
  caption?: string;
  altText?: string;
  width?: number;
  height?: number;
}

interface ReadingModuleContent {
  overview: string;
  keyConcepts: string[];
  keyTerms: KeyTerm[];
  misconceptions: string[];
  framingQuestions: string[];
  recallCheck: RecallItem[];
  citations: string[];
  images?: ModuleImage[];
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
  onLoaded?: (moduleId: string) => void;
}

const SUBJECT_STYLES = {
  biology: {
    accent: "emerald",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    section: "border-emerald-200 dark:border-emerald-800",
    icon: "text-emerald-600 dark:text-emerald-400",
    button: "bg-emerald-600 hover:bg-emerald-700 text-white",
    framing: "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
  },
  history: {
    accent: "amber",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    section: "border-amber-200 dark:border-amber-800",
    icon: "text-amber-600 dark:text-amber-400",
    button: "bg-amber-600 hover:bg-amber-700 text-white",
    framing: "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
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

function ImageLightbox({ image, onClose }: { image: ModuleImage; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-3xl max-h-[90vh] flex flex-col gap-2" onClick={e => e.stopPropagation()}>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          className="absolute -top-10 right-0 text-white"
        >
          <X className="w-5 h-5" />
        </Button>
        <img
          src={image.url}
          alt={image.altText ?? ""}
          className="max-w-full max-h-[80vh] object-contain rounded-md"
        />
        {image.caption && (
          <p className="text-xs text-white/70 text-center">{image.caption}</p>
        )}
      </div>
    </div>
  );
}

function ImageGallery({ images }: { images: ModuleImage[] }) {
  const [lightboxImage, setLightboxImage] = useState<ModuleImage | null>(null);

  if (!images || images.length === 0) return null;

  const [primary, ...secondary] = images;

  return (
    <>
      <div className="space-y-2" data-testid="image-gallery">
        <div
          className="relative rounded-md overflow-hidden cursor-pointer group bg-muted"
          onClick={() => setLightboxImage(primary)}
          data-testid="image-primary"
        >
          <img
            src={primary.url}
            alt={primary.altText ?? ""}
            className="w-full object-cover max-h-52"
            onError={e => { (e.currentTarget as HTMLImageElement).closest('[data-testid="image-primary"]')?.classList.add('hidden'); }}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-end p-2">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded p-1">
              <ZoomIn className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
        {primary.caption && (
          <p className="text-xs text-muted-foreground text-center px-1">{primary.caption}</p>
        )}

        {secondary.length > 0 && (
          <div className="flex gap-2">
            {secondary.map((img, i) => (
              <div
                key={i}
                className="relative flex-1 rounded-md overflow-hidden cursor-pointer group bg-muted"
                onClick={() => setLightboxImage(img)}
                data-testid={`image-secondary-${i}`}
              >
                <img
                  src={img.url}
                  alt={img.altText ?? ""}
                  className="w-full object-cover h-24"
                  onError={e => { (e.currentTarget as HTMLImageElement).closest('[data-testid]')?.classList.add('hidden'); }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </div>
            ))}
          </div>
        )}
      </div>

      {lightboxImage && (
        <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}
    </>
  );
}

function ModuleContent({ module, styles }: { module: ReadingModule; styles: typeof SUBJECT_STYLES["biology"] }) {
  const { content } = module;
  const images = content.images ?? [];

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

      {images.length > 0 && (
        <ImageGallery images={images} />
      )}

      <div>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className={`w-4 h-4 ${styles.icon}`} />
          <h3 className="text-sm font-semibold">Key Concepts</h3>
        </div>
        <ul className="space-y-2">
          {content.keyConcepts.map((concept, i) => (
            <li key={i} className="flex items-start gap-2 text-sm" data-testid={`text-concept-${i}`}>
              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`} />
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
      <Skeleton className="h-48 w-full rounded-md" />
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

export function ReadingModulePanel({ subject, onClose, initialTopic = "", onLoaded }: ReadingModulePanelProps) {
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

  useEffect(() => {
    if (module?.id && onLoaded) {
      onLoaded(module.id);
    }
  }, [module?.id]);

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
