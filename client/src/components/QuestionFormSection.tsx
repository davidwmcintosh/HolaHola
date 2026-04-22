import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Volume2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/queryClient";

export interface QuestionFormItem {
  imageWord: string;
  question: string;
  questionTranslation: string;
  affirmativeAnswer: string;
  affirmativeTranslation: string;
  negativeAnswer: string;
  negativeTranslation: string;
}

interface QuestionFormSectionProps {
  items: QuestionFormItem[];
  language: string;
  patternLabel?: string;
  className?: string;
}

function useWordImage(word: string, language: string) {
  return useQuery<{ url: string | null; source: string }>({
    queryKey: ["/api/vocab-image/by-word", word, language],
    queryFn: () =>
      fetch(
        `/api/vocab-image/by-word?word=${encodeURIComponent(word)}&language=${encodeURIComponent(language)}`,
        { credentials: "include" }
      ).then((r) => r.json()),
    staleTime: 1000 * 60 * 60 * 24,
  });
}

function useTTS(language: string, tutorGender: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const play = useCallback(async (text: string, key: string) => {
    if (playingKey === key) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlayingKey(key);
    try {
      const res = await apiRequest("POST", "/api/tts/pronunciation", {
        text,
        language,
        gender: tutorGender,
      });
      const { audioUrl } = await res.json();
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => { setPlayingKey(null); audioRef.current = null; };
      audio.onerror = () => { setPlayingKey(null); audioRef.current = null; };
      audio.play();
    } catch {
      setPlayingKey(null);
    }
  }, [language, tutorGender, playingKey]);

  return { play, playingKey };
}

function TinyAudioButton({
  text,
  playKey,
  play,
  playingKey,
  testId,
}: {
  text: string;
  playKey: string;
  play: (text: string, key: string) => void;
  playingKey: string | null;
  testId?: string;
}) {
  const isActive = playingKey === playKey;
  return (
    <button
      type="button"
      onClick={() => play(text, playKey)}
      disabled={isActive}
      className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
      data-testid={testId}
      title={`Hear: "${text}"`}
    >
      {isActive
        ? <Loader2 className="h-3 w-3 animate-spin" />
        : <Volume2 className="h-3 w-3" />
      }
    </button>
  );
}

function QuestionCard({
  item,
  language,
  tutorGender,
}: {
  item: QuestionFormItem;
  language: string;
  tutorGender: string;
}) {
  const { play, playingKey } = useTTS(language, tutorGender);
  const cardKey = item.imageWord;
  const { data: imageData } = useWordImage(item.imageWord, language);
  const imageUrl = imageData?.url;

  return (
    <div
      className="rounded-md border bg-card flex flex-col overflow-hidden"
      data-testid={`question-card-${item.imageWord}`}
    >
      {/* Image */}
      <div className="relative w-full aspect-square bg-muted/30 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.imageWord}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Q&A block */}
      <div className="px-2 pt-2 pb-2 flex flex-col gap-1.5">

        {/* Question */}
        <div className="flex items-start gap-1">
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium leading-snug"
              data-testid={`text-question-${cardKey}`}
            >
              {item.question}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {item.questionTranslation}
            </p>
          </div>
          <TinyAudioButton
            text={item.question}
            playKey={`${cardKey}-q`}
            play={play}
            playingKey={playingKey}
            testId={`button-play-question-${cardKey}`}
          />
        </div>

        <div className="border-t border-dashed" />

        {/* Sí answer */}
        <div className="flex items-start gap-1">
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 pt-0.5 w-4 shrink-0">
            Sí
          </span>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm leading-snug"
              data-testid={`text-affirmative-${cardKey}`}
            >
              {item.affirmativeAnswer}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {item.affirmativeTranslation}
            </p>
          </div>
          <TinyAudioButton
            text={item.affirmativeAnswer}
            playKey={`${cardKey}-yes`}
            play={play}
            playingKey={playingKey}
            testId={`button-play-affirmative-${cardKey}`}
          />
        </div>

        {/* No answer */}
        <div className="flex items-start gap-1">
          <span className="text-[10px] font-bold text-muted-foreground pt-0.5 w-4 shrink-0">
            No
          </span>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm leading-snug"
              data-testid={`text-negative-answer-${cardKey}`}
            >
              {item.negativeAnswer}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {item.negativeTranslation}
            </p>
          </div>
          <TinyAudioButton
            text={item.negativeAnswer}
            playKey={`${cardKey}-no`}
            play={play}
            playingKey={playingKey}
            testId={`button-play-negative-answer-${cardKey}`}
          />
        </div>
      </div>
    </div>
  );
}

export function QuestionFormSection({
  items,
  language,
  patternLabel,
  className = "",
}: QuestionFormSectionProps) {
  const { tutorGender } = useLanguage();
  if (!items.length) return null;

  return (
    <div className={`space-y-3 ${className}`} data-testid="question-form-section">
      {patternLabel && (
        <p
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-0.5"
          data-testid="text-question-pattern-label"
        >
          {patternLabel}
        </p>
      )}

      <div
        className="grid grid-cols-2 gap-3"
        data-testid="question-card-grid"
      >
        {items.map((item) => (
          <QuestionCard
            key={item.imageWord}
            item={item}
            language={language}
            tutorGender={tutorGender}
          />
        ))}
      </div>
    </div>
  );
}
