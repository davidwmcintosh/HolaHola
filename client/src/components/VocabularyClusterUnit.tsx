import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ChevronLeft, MessageSquare, Globe, Volume2, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/queryClient";
import { classifyGrammarType, GrammarChapterView } from "./ChapterIntroduction";
import { SeeItSayItLoop } from "./SeeItSayItLoop";

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface KeyPhrase {
  phrase: string;
  translation: string;
  usage?: string;
}

interface VocabContent {
  lesson_id: string;
  key_phrases_for_chat?: KeyPhrase[];
  cultural_note?: string;
}

interface VocabularyClusterUnitProps {
  chapter: Chapter;
  language: string;
  onBack: () => void;
  onStartConversation: (lessonId?: string) => void;
}

// ── Key phrase row with TTS ────────────────────────────────────────────────────

function KeyPhraseRow({
  phrase,
  index,
  language,
}: {
  phrase: KeyPhrase;
  index: number;
  language: string;
}) {
  const { tutorGender } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);

  const handleListen = useCallback(async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      const response = await apiRequest("POST", "/api/tts/pronunciation", {
        text: phrase.phrase,
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
  }, [phrase.phrase, language, tutorGender, isPlaying]);

  return (
    <div
      className="flex items-start gap-2 py-2.5 border-b last:border-0"
      data-testid={`key-phrase-${index}`}
    >
      <Button
        size="icon"
        variant="ghost"
        onClick={handleListen}
        disabled={isPlaying}
        aria-label={`Listen to: ${phrase.phrase}`}
        data-testid={`button-listen-phrase-${index}`}
        className="shrink-0 mt-0.5"
      >
        {isPlaying ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Volume2 className="h-3.5 w-3.5" />
        )}
      </Button>
      <div className="flex-1 min-w-0">
        {phrase.usage && (
          <p className="text-[10px] italic text-muted-foreground/60 mb-0.5">{phrase.usage}</p>
        )}
        <p className="text-sm font-medium leading-snug">{phrase.phrase}</p>
        <p className="text-xs text-muted-foreground leading-snug">{phrase.translation}</p>
      </div>
    </div>
  );
}

// ── Lesson key phrases block ──────────────────────────────────────────────────

function LessonKeyPhrases({
  lessonId,
  language,
}: {
  lessonId: string;
  language: string;
}) {
  const { data, isLoading } = useQuery<{ content: VocabContent | null }>({
    queryKey: ["/api/textbook-content", lessonId],
    enabled: !!lessonId,
  });

  const content = data?.content;
  const phrases = content?.key_phrases_for_chat;

  if (isLoading || !phrases || phrases.length === 0) return null;

  return (
    <div data-testid="key-phrases-block">
      {phrases.slice(0, 10).map((ph, i) => (
        <KeyPhraseRow key={i} phrase={ph} index={i} language={language} />
      ))}
    </div>
  );
}

// ── Lesson cultural note ──────────────────────────────────────────────────────

function LessonCulturalNote({ lessonId }: { lessonId: string }) {
  const { data } = useQuery<{ content: VocabContent | null }>({
    queryKey: ["/api/textbook-content", lessonId],
    enabled: !!lessonId,
  });

  const note = data?.content?.cultural_note;
  if (!note) return null;

  return (
    <div className="flex items-start gap-2 rounded-md bg-muted/30 px-3 py-2.5">
      <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <p className="text-xs text-muted-foreground leading-relaxed">{note}</p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function VocabularyClusterUnit({
  chapter,
  language,
  onBack,
  onStartConversation,
}: VocabularyClusterUnitProps) {
  const firstSection = chapter.sections[0];
  const grammarType = classifyGrammarType(chapter.title, language);

  return (
    <div
      className="space-y-8 w-full max-w-3xl mx-auto pb-12 touch-pan-y overscroll-contain"
      data-testid="vocabulary-cluster-unit"
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
        <h1 className="text-2xl font-bold" data-testid="vocabulary-cluster-title">
          {chapter.title}
        </h1>
        {chapter.description && (
          <p className="text-sm text-muted-foreground">{chapter.description}</p>
        )}
      </div>

      {/* ── Thematic diagram — only when one exists (directions map, weather card, etc.) ── */}
      {grammarType && (
        <div data-testid="vocabulary-cluster-diagram">
          <GrammarChapterView
            type={grammarType}
            chapterNumber={chapter.number}
            language={language}
            chapterTitle={chapter.title}
          />
        </div>
      )}

      {/* ── Vocabulary images — all sections, each gets its own See It Say It loop ── */}
      {chapter.sections.length > 0 && (
        <div className="space-y-6" data-testid="vocabulary-cluster-grid">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            Vocabulary
          </p>
          {chapter.sections.map((section) => (
            <div key={section.id}>
              {chapter.sections.length > 1 && (
                <p className="text-xs font-medium text-muted-foreground mb-2">{section.name}</p>
              )}
              <SeeItSayItLoop
                lessonId={section.id}
                language={language}
                hideHeader
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Key phrases with TTS — all sections ── */}
      {chapter.sections.some(() => true) && (
        <div className="space-y-3" data-testid="vocabulary-cluster-phrases">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            Key Phrases
          </p>
          {chapter.sections.map((section) => (
            <LessonKeyPhrases key={section.id} lessonId={section.id} language={language} />
          ))}
        </div>
      )}

      {/* ── Cultural notes from all sections ── */}
      <div className="space-y-2">
        {chapter.sections.map((section) => (
          <LessonCulturalNote key={section.id} lessonId={section.id} />
        ))}
      </div>

      {/* ── Unit title footer — mirrors VerbUnit pattern ── */}
      <div className="border-t pt-6 space-y-1" data-testid="vocabulary-cluster-footer">
        <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          Unit {chapter.number}
        </p>
        <h2 className="text-lg font-bold">{chapter.title}</h2>
      </div>

      {/* ── CTA ── */}
      <div className="pt-2">
        <Button
          className="w-full min-h-[52px] text-base gap-2"
          onClick={() => onStartConversation(firstSection?.id)}
          data-testid="button-start-chapter-chat"
        >
          <MessageSquare className="h-5 w-5" />
          Practice with Daniela
        </Button>
      </div>
    </div>
  );
}
