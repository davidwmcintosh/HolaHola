import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChevronLeft,
  MessageSquare,
  BookOpen,
  Globe,
  Library,
  Volume2,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getAdvancedUnitContent, type AdvancedVocabWord } from "@/data/advanced-unit-content";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/queryClient";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Chapter {
  id: string;
  number: number;
  title: string;
  description: string;
  chapterType?: string | null;
}

interface AdvancedUnitProps {
  chapter: Chapter;
  language: string;
  onBack: () => void;
  onStartConversation: (lessonId?: string) => void;
}

// ── Source type label ─────────────────────────────────────────────────────────

const SOURCE_TYPE_LABELS: Record<string, string> = {
  literatura: "Literatura",
  poesía: "Poesía",
  noticias: "Artículo de Actualidad",
  cultural: "Texto Cultural",
  ensayo: "Ensayo",
};

// ── Vocab Card ─────────────────────────────────────────────────────────────────

function VocabCard({
  word,
  index,
  language,
}: {
  word: AdvancedVocabWord;
  index: number;
  language: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const { tutorGender } = useLanguage();

  const handleListen = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isPlaying) return;
      setIsPlaying(true);
      try {
        const response = await apiRequest("POST", "/api/tts/pronunciation", {
          text: word.spanish,
          language,
          gender: tutorGender ?? "female",
        });
        const data = await response.json();
        const audio = new Audio(data.audioUrl);
        audio.onended = () => setIsPlaying(false);
        audio.onerror = () => setIsPlaying(false);
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
    },
    [word.spanish, language, tutorGender, isPlaying]
  );

  return (
    <div
      className="border rounded-md bg-card cursor-pointer select-none"
      onClick={() => setExpanded((e) => !e)}
      data-testid={`vocab-card-${index}`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Button
          size="icon"
          variant="ghost"
          onClick={handleListen}
          disabled={isPlaying}
          aria-label={`Escuchar: ${word.spanish}`}
          data-testid={`button-listen-vocab-${index}`}
          className="shrink-0"
        >
          {isPlaying ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Volume2 className="h-3.5 w-3.5" />
          )}
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold text-sm leading-snug">{word.spanish}</span>
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0">
              {word.partOfSpeech}
            </Badge>
          </div>
          {!expanded && (
            <p className="text-xs text-muted-foreground leading-snug truncate">{word.english}</p>
          )}
        </div>

        <div className="shrink-0 text-muted-foreground">
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-0 space-y-1.5 border-t">
          <p className="text-sm text-muted-foreground pt-2">
            <span className="font-medium text-foreground">Translation: </span>
            {word.english}
          </p>
          {word.example && (
            <div className="space-y-0.5">
              <p className="text-sm italic text-foreground leading-snug">{word.example}</p>
              {word.exampleTranslation && (
                <p className="text-xs text-muted-foreground leading-snug">
                  {word.exampleTranslation}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Reading passage ────────────────────────────────────────────────────────────

function ReadingSection({
  reading,
}: {
  reading: { title: string; author?: string; year?: string; sourceType: string; body: string };
}) {
  const typeLabel = SOURCE_TYPE_LABELS[reading.sourceType] ?? reading.sourceType;
  const attribution = [reading.author, reading.year].filter(Boolean).join(", ");

  return (
    <div className="space-y-3" data-testid="reading-passage-section">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Lectura — {typeLabel}
        </h2>
      </div>

      <Card>
        <CardContent className="pt-4 pb-5 space-y-3">
          <div>
            <h3 className="font-semibold text-base leading-snug">{reading.title}</h3>
            {attribution && (
              <p className="text-xs text-muted-foreground mt-0.5">{attribution}</p>
            )}
          </div>
          <div className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
            {reading.body}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Cultural note ──────────────────────────────────────────────────────────────

function CulturalNoteSection({
  note,
}: {
  note: { heading: string; body: string };
}) {
  return (
    <div className="space-y-3" data-testid="cultural-note-section">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Nota Cultural
        </h2>
      </div>

      <Card>
        <CardContent className="pt-4 pb-5 space-y-2">
          <h3 className="font-semibold text-base leading-snug">{note.heading}</h3>
          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
            {note.body}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AdvancedUnit({
  chapter,
  language,
  onBack,
  onStartConversation,
}: AdvancedUnitProps) {
  const content = getAdvancedUnitContent(chapter.id);

  // If no curated content, fall back gracefully
  if (!content) {
    return (
      <div className="space-y-6 w-full max-w-2xl mx-auto pb-12 touch-pan-y overscroll-contain">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-3 -mx-4 px-4 border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            data-testid="button-back-to-chapters"
            className="gap-1 -ml-2"
          >
            <ChevronLeft className="h-4 w-4" />
            All Chapters
          </Button>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            Unit {chapter.number}
          </p>
          <h1 className="text-2xl font-bold">{chapter.title}</h1>
          <p className="text-sm text-muted-foreground">{chapter.description}</p>
        </div>
        <Button
          className="w-full min-h-[52px] text-base gap-2"
          onClick={() => onStartConversation()}
          data-testid="button-start-chapter-chat"
        >
          <MessageSquare className="h-5 w-5" />
          Practice with Daniela
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-2xl mx-auto pb-12 touch-pan-y overscroll-contain">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-3 -mx-4 px-4 border-b supports-[backdrop-filter]:bg-background/80">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          data-testid="button-back-to-chapters"
          className="gap-1 -ml-2"
        >
          <ChevronLeft className="h-4 w-4" />
          All Chapters
        </Button>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {content.levelBadge}
          </Badge>
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {content.topicLabel}
          </span>
        </div>
        <h1 className="text-2xl font-bold leading-snug">{chapter.title}</h1>
        {chapter.description && (
          <p className="text-sm text-muted-foreground">{chapter.description}</p>
        )}
      </div>

      {/* Vocabulary */}
      <div className="space-y-3" data-testid="vocabulary-section">
        <div className="flex items-center gap-2">
          <Library className="h-4 w-4 text-muted-foreground shrink-0" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Vocabulario Clave
          </h2>
          <span className="text-xs text-muted-foreground">
            — toca para expandir
          </span>
        </div>
        <div className="space-y-1.5">
          {content.vocabulary.map((word, i) => (
            <VocabCard key={word.spanish} word={word} index={i} language={language} />
          ))}
        </div>
      </div>

      {/* Reading passage */}
      <ReadingSection reading={content.reading} />

      {/* Cultural note */}
      <CulturalNoteSection note={content.culturalNote} />

      {/* Practice CTA */}
      <div className="pt-2">
        <Button
          className="w-full min-h-[52px] text-base gap-2"
          onClick={() => onStartConversation()}
          data-testid="button-start-chapter-chat"
        >
          <MessageSquare className="h-5 w-5" />
          Practice with Daniela
        </Button>
      </div>
    </div>
  );
}
