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

function useVocabImages(words: string[], language: string) {
  const keys = words.map(w => `vocab_${language}_${w.toLowerCase().replace(/\s+/g, "_")}`);
  return useQuery<{ images: Record<string, { url: string; source: string }> }>({
    queryKey: ["/api/textbook/vocab-images-by-keys", keys.join(",")],
    queryFn: async () => {
      if (!keys.length) return { images: {} };
      const params = new URLSearchParams({ keys: keys.join(",") });
      const res = await fetch(`/api/textbook/vocab-images-by-keys?${params}`, { credentials: "include" });
      return res.json();
    },
    enabled: keys.length > 0,
    staleTime: 1000 * 60 * 10,
  });
}

function useTTS(language: string, tutorGender: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const play = useCallback(async (text: string, key: string) => {
    if (playingKey === key) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingKey(key);
    try {
      const res = await apiRequest("POST", "/api/tts/pronunciation", {
        text,
        language,
        tutorGender,
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

function AudioButton({
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
  const isPlaying = playingKey === playKey;
  return (
    <button
      type="button"
      onClick={() => play(text, playKey)}
      disabled={isPlaying}
      className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      data-testid={testId}
      title={`Hear: "${text}"`}
    >
      {isPlaying
        ? <Loader2 className="h-3 w-3 animate-spin" />
        : <Volume2 className="h-3 w-3" />
      }
    </button>
  );
}

function QuestionCard({
  item,
  imageUrl,
  language,
  tutorGender,
}: {
  item: QuestionFormItem;
  imageUrl?: string;
  language: string;
  tutorGender: string;
}) {
  const { play, playingKey } = useTTS(language, tutorGender);
  const cardKey = item.imageWord;

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
            <span className="text-4xl font-bold text-muted-foreground/20 select-none">
              {item.imageWord[0]?.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Q&A lines */}
      <div className="px-2 pt-2 pb-2 flex flex-col gap-2">
        {/* Question */}
        <div className="flex items-start gap-1.5">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-snug" data-testid={`text-question-${cardKey}`}>
              {item.question}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">{item.questionTranslation}</p>
          </div>
          <AudioButton
            text={item.question}
            playKey={`${cardKey}-q`}
            play={play}
            playingKey={playingKey}
            testId={`button-play-question-${cardKey}`}
          />
        </div>

        {/* Divider */}
        <div className="border-t border-dashed" />

        {/* Affirmative */}
        <div className="flex items-start gap-1.5">
          <div className="w-2 shrink-0 pt-0.5">
            <span className="text-[10px] font-bold text-green-600 dark:text-green-400">Sí</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-snug" data-testid={`text-affirmative-${cardKey}`}>
              {item.affirmativeAnswer}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">{item.affirmativeTranslation}</p>
          </div>
          <AudioButton
            text={item.affirmativeAnswer}
            playKey={`${cardKey}-yes`}
            play={play}
            playingKey={playingKey}
            testId={`button-play-affirmative-${cardKey}`}
          />
        </div>

        {/* Negative */}
        <div className="flex items-start gap-1.5">
          <div className="w-2 shrink-0 pt-0.5">
            <span className="text-[10px] font-bold text-muted-foreground">No</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-snug" data-testid={`text-negative-answer-${cardKey}`}>
              {item.negativeAnswer}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">{item.negativeTranslation}</p>
          </div>
          <AudioButton
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
  const words = items.map(i => i.imageWord);
  const { data: imageData, isLoading: imagesLoading } = useVocabImages(words, language);
  const imageMap = imageData?.images ?? {};

  if (!items.length) return null;

  return (
    <div className={`space-y-3 ${className}`} data-testid="question-form-section">
      {patternLabel && (
        <div className="flex items-center gap-2 px-1">
          <span
            className="text-sm font-semibold text-muted-foreground"
            data-testid="text-question-pattern-label"
          >
            {patternLabel}
          </span>
        </div>
      )}

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))` }}
        data-testid="question-card-grid"
      >
        {items.map(item => {
          const key = `vocab_${language}_${item.imageWord.toLowerCase().replace(/\s+/g, "_")}`;
          return (
            <QuestionCard
              key={item.imageWord}
              item={item}
              imageUrl={imageMap[key]?.url}
              language={language}
              tutorGender={tutorGender}
            />
          );
        })}
      </div>

      {imagesLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading images…
        </div>
      )}
    </div>
  );
}
