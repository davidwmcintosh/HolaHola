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

function NegativeCard({
  item,
  imageUrl,
  language,
  tutorGender,
}: {
  item: NegativeFormItem;
  imageUrl?: string;
  language: string;
  tutorGender: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlay = useCallback(async () => {
    if (isPlaying) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(true);
    try {
      const res = await apiRequest("POST", "/api/tts/pronunciation", {
        text: item.negativePhrase,
        language,
        tutorGender,
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
            <span className="text-4xl font-bold text-muted-foreground/20 select-none">
              {item.imageWord[0]?.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Text + audio */}
      <div className="px-2 pt-2 pb-2 flex items-start gap-1.5">
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium leading-snug"
            data-testid={`text-negative-phrase-${item.imageWord}`}
          >
            {item.negativePhrase}
          </p>
          <p className="text-xs text-muted-foreground leading-tight mt-0.5">
            {item.translation}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={handlePlay}
          disabled={isPlaying}
          className="shrink-0 mt-0.5"
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
  const words = items.map(i => i.imageWord);
  const { data: imageData, isLoading: imagesLoading } = useVocabImages(words, language);
  const imageMap = imageData?.images ?? {};

  if (!items.length) return null;

  return (
    <div className={`space-y-3 ${className}`} data-testid="negative-form-section">
      {patternLabel && (
        <div className="flex items-center gap-2 px-1">
          <span
            className="text-sm font-semibold text-muted-foreground"
            data-testid="text-negative-pattern-label"
          >
            {patternLabel}
          </span>
        </div>
      )}

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))` }}
        data-testid="negative-card-grid"
      >
        {items.map(item => {
          const key = `vocab_${language}_${item.imageWord.toLowerCase().replace(/\s+/g, "_")}`;
          return (
            <NegativeCard
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
