import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, MessageSquare, Volume2, Loader2, Globe, MessageCircle } from "lucide-react";
import { classifyGrammarType, GrammarChapterView } from "./ChapterIntroduction";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GrammarExample {
  target: string;
  translation: string;
  note?: string;
}

interface LessonContent {
  lesson_id: string;
  grammar_explanation?: string;
  grammar_examples?: GrammarExample[];
  cultural_note?: string;
  reading_passage?: string;
}

interface Section {
  id: string;
  name: string;
  lessonType: string;
  hasDrills: boolean;
  drillCount: number;
}

interface Chapter {
  id: string;
  number: number;
  title: string;
  description: string;
  sections: Section[];
  chapterType?: string | null;
}

interface GrammarConceptUnitProps {
  chapter: Chapter;
  language: string;
  onBack: () => void;
  onStartConversation: (lessonId?: string) => void;
}

// ── Single example sentence with TTS listen ───────────────────────────────────

function ExampleSentence({
  example,
  language,
  index,
}: {
  example: GrammarExample;
  language: string;
  index: number;
}) {
  const { gender } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);

  const handleListen = useCallback(async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      const res = await fetch("/api/tts/pronunciation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: example.target, language, gender: gender ?? "female" }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { setIsPlaying(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setIsPlaying(false); URL.revokeObjectURL(url); };
      await audio.play();
    } catch {
      setIsPlaying(false);
    }
  }, [example.target, language, gender, isPlaying]);

  return (
    <div
      className="flex items-start gap-2 py-2.5 border-b last:border-0"
      data-testid={`example-sentence-${index}`}
    >
      <Button
        size="icon"
        variant="ghost"
        onClick={handleListen}
        disabled={isPlaying}
        aria-label={`Listen to: ${example.target}`}
        data-testid={`button-listen-example-${index}`}
        className="h-7 w-7 shrink-0 mt-0.5"
      >
        {isPlaying ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Volume2 className="h-3.5 w-3.5" />
        )}
      </Button>
      <div className="flex-1 min-w-0">
        {example.note && (
          <p className="text-[10px] text-muted-foreground/60 italic mb-0.5">{example.note}</p>
        )}
        <p className="text-sm font-medium leading-snug">{example.target}</p>
        <p className="text-xs text-muted-foreground leading-snug">{example.translation}</p>
      </div>
    </div>
  );
}

// ── Dialogue block ────────────────────────────────────────────────────────────

function DialogueBlock({ text }: { text: string }) {
  return (
    <div className="rounded-md border bg-muted/20 px-4 py-3 space-y-2 mt-2">
      {text.split('\n').filter(Boolean).map((line, i) => {
        const isDialogue = line.startsWith('—') || line.startsWith('-');
        const content = isDialogue ? line.replace(/^[—-]\s*/, '') : line;
        return (
          <p
            key={i}
            className={`text-sm leading-snug ${
              isDialogue
                ? i % 2 === 0
                  ? 'font-medium'
                  : 'text-muted-foreground pl-4'
                : 'text-muted-foreground italic'
            }`}
          >
            {isDialogue && (
              <span className="text-muted-foreground/40 mr-1.5 select-none">—</span>
            )}
            {content}
          </p>
        );
      })}
    </div>
  );
}

// ── Domain block — one semantic use of the grammar concept ────────────────────

function DomainBlock({
  section,
  language,
  domainIndex,
}: {
  section: Section;
  language: string;
  domainIndex: number;
}) {
  const { data, isLoading } = useQuery<{ content: LessonContent | null }>({
    queryKey: ["/api/textbook-content", section.id],
    enabled: !!section.id,
  });

  const content = data?.content;

  return (
    <div className="space-y-3" data-testid={`domain-block-${domainIndex}`}>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary shrink-0">
          {domainIndex + 1}
        </span>
        <p className="text-sm font-semibold">{section.name}</p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-3 text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="text-xs">Loading examples…</span>
        </div>
      )}

      {!isLoading && content && (
        <div className="pl-7 space-y-3">
          {/* Grammar explanation (short — if present) */}
          {content.grammar_explanation && (
            <p className="text-xs text-muted-foreground leading-relaxed italic">
              {content.grammar_explanation}
            </p>
          )}

          {/* Example sentences with listen buttons */}
          {content.grammar_examples && content.grammar_examples.length > 0 && (
            <div>
              {content.grammar_examples.slice(0, 6).map((ex, i) => (
                <ExampleSentence
                  key={i}
                  example={ex}
                  language={language}
                  index={domainIndex * 10 + i}
                />
              ))}
            </div>
          )}

          {/* Cultural note */}
          {content.cultural_note && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Globe className="h-3 w-3 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{content.cultural_note}</p>
            </div>
          )}

          {/* Reading / dialogue */}
          {content.reading_passage && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <MessageCircle className="h-3 w-3 text-muted-foreground shrink-0" />
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Dialogue
                </p>
              </div>
              {content.reading_passage.includes('—') || content.reading_passage.includes('-') ? (
                <DialogueBlock text={content.reading_passage} />
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {content.reading_passage}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function GrammarConceptUnit({
  chapter,
  language,
  onBack,
  onStartConversation,
}: GrammarConceptUnitProps) {
  const grammarType = classifyGrammarType(chapter.title, language);

  return (
    <div
      className="space-y-8 w-full max-w-3xl mx-auto pb-12 touch-pan-y overscroll-contain"
      data-testid="grammar-concept-unit"
    >
      {/* ── Sticky top bar ── */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm py-3 -mx-4 px-4 border-b supports-[backdrop-filter]:bg-background/80">
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

      {/* ── Unit title ── */}
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          Unit {chapter.number}
        </p>
        <h1 className="text-2xl font-bold" data-testid="grammar-concept-title">
          {chapter.title}
        </h1>
        {chapter.description && (
          <p className="text-sm text-muted-foreground">{chapter.description}</p>
        )}
      </div>

      {/* ── Grammar reference card ── */}
      {grammarType && (
        <div data-testid="grammar-concept-reference-card">
          <GrammarChapterView
            type={grammarType}
            chapterNumber={chapter.number}
            language={language}
            chapterTitle={chapter.title}
          />
        </div>
      )}

      {/* ── Domain sections — one per lesson ── */}
      {chapter.sections.length > 0 && (
        <div className="space-y-8" data-testid="grammar-concept-domains">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            In Use
          </p>
          {chapter.sections.map((section, i) => (
            <DomainBlock
              key={section.id}
              section={section}
              language={language}
              domainIndex={i}
            />
          ))}
        </div>
      )}

      {/* ── CTA ── */}
      <div className="pt-2">
        <Button
          className="w-full min-h-[52px] text-base gap-2"
          onClick={() => onStartConversation(chapter.sections[0]?.id)}
          data-testid="button-start-chapter-chat"
        >
          <MessageSquare className="h-5 w-5" />
          Practice with Daniela
        </Button>
      </div>
    </div>
  );
}
