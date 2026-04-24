import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/queryClient";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SpanishPhrase {
  spanish: string;
  english: string;
  note?: string;
}

interface PhrasesClusterProps {
  heading: string;
  introNote?: string;
  phrases: SpanishPhrase[];
  language?: string;
}

// ── Single phrase row with TTS ─────────────────────────────────────────────

function PhraseRow({
  phrase,
  index,
  language,
}: {
  phrase: SpanishPhrase;
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
        text: phrase.spanish,
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
  }, [phrase.spanish, language, tutorGender, isPlaying]);

  return (
    <div
      className="flex items-start gap-2 py-2.5 border-b last:border-0"
      data-testid={`phrases-cluster-row-${index}`}
    >
      <Button
        size="icon"
        variant="ghost"
        onClick={handleListen}
        disabled={isPlaying}
        aria-label={`Listen to: ${phrase.spanish}`}
        data-testid={`button-listen-phrase-cluster-${index}`}
        className="shrink-0 mt-0.5"
      >
        {isPlaying ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Volume2 className="h-3.5 w-3.5" />
        )}
      </Button>
      <div className="flex-1 min-w-0">
        {phrase.note && (
          <p className="text-[10px] italic text-muted-foreground/60 mb-0.5">{phrase.note}</p>
        )}
        <p className="text-sm font-medium leading-snug">{phrase.spanish}</p>
        <p className="text-xs text-muted-foreground leading-snug">{phrase.english}</p>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PhrasesCluster({
  heading,
  introNote,
  phrases,
  language = "spanish",
}: PhrasesClusterProps) {
  return (
    <div className="space-y-3" data-testid="phrases-cluster">
      <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
        {heading}
      </p>
      {introNote && (
        <p className="text-xs text-muted-foreground italic">{introNote}</p>
      )}
      <div className="rounded-md border bg-card">
        {phrases.map((phrase, i) => (
          <PhraseRow key={i} phrase={phrase} index={i} language={language} />
        ))}
      </div>
    </div>
  );
}
