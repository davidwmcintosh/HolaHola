import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Volume2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/queryClient";

export interface NegativeFormItem {
  imageWord: string;
  negativePhrase: string;
  translation: string;
}

interface NegativeFormSectionProps {
  items: NegativeFormItem[];
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

function NegativeCard({
  item,
  language,
  tutorGender,
}: {
  item: NegativeFormItem;
  language: string;
  tutorGender: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { data: imageData } = useWordImage(item.imageWord, language);

  const handlePlay = useCallback(async () => {
    if (isPlaying) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setIsPlaying(true);
    try {
      const res = await apiRequest("POST", "/api/tts/pronunciation", {
        text: item.negativePhrase,
        language,
        gender: tutorGender,
      });
      const { audioUrl } = await res.json();
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => { setIsPlaying(false); audioRef.current = null; };
      audio.onerror = () => { setIsPlaying(false); audioRef.current = null; };
      audio.play();
    } catch {
      setIsPlaying(false);
    }
  }, [isPlaying, item.negativePhrase, language, tutorGender]);

  const imageUrl = imageData?.url;

  return (
    <div
      className="rounded-md border bg-card flex flex-col overflow-hidden"
      data-testid={`negative-card-${item.imageWord}`}
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

      {/* Phrase + audio — centered */}
      <div className="flex flex-col items-center px-2 pt-2 pb-1.5 text-center gap-0.5">
        <p
          className="text-sm font-medium leading-snug"
          data-testid={`text-negative-phrase-${item.imageWord}`}
        >
          {item.negativePhrase}
        </p>
        <p className="text-[11px] text-muted-foreground leading-tight">
          {item.translation}
        </p>
        <Button
          size="icon"
          variant="ghost"
          onClick={handlePlay}
          disabled={isPlaying}
          data-testid={`button-play-negative-${item.imageWord}`}
          title={`Hear "${item.negativePhrase}"`}
        >
          {isPlaying
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Volume2 className="h-3.5 w-3.5" />
          }
        </Button>
      </div>
    </div>
  );
}

export function NegativeFormSection({
  items,
  language,
  patternLabel,
  className = "",
}: NegativeFormSectionProps) {
  const { tutorGender } = useLanguage();
  if (!items.length) return null;

  return (
    <div className={`space-y-3 ${className}`} data-testid="negative-form-section">
      {patternLabel && (
        <p
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-0.5"
          data-testid="text-negative-pattern-label"
        >
          {patternLabel}
        </p>
      )}

      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
        data-testid="negative-card-grid"
      >
        {items.map((item) => (
          <NegativeCard
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
