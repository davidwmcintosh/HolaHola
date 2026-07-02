import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Volume2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/queryClient";

export interface ColumnItem {
  text: string;
  translation: string;
  imageQuery?: string;
}

function ColumnItemImage({ imageQuery, text, language }: { imageQuery: string; text: string; language: string }) {
  const { data, isLoading } = useQuery<{ url: string | null }>({
    queryKey: ["/api/vocab-image/by-word", text, language, imageQuery],
    queryFn: () => {
      const params = new URLSearchParams({ word: text, language, description: imageQuery });
      return fetch(`/api/vocab-image/by-word?${params.toString()}`, { credentials: "include" }).then(r => r.json());
    },
    staleTime: 10 * 60 * 1000,
  });
  if (isLoading) return <div className="w-8 h-8 rounded object-cover shrink-0 bg-muted animate-pulse" />;
  if (!data?.url) return null;
  return <img src={data.url} alt={text} className="w-8 h-8 rounded object-cover shrink-0" />;
}

export interface SentenceColumn {
  label?: string;
  items: ColumnItem[];
}

interface SentenceColumnGeneratorProps {
  columns: SentenceColumn[];
  language: string;
  className?: string;
}

export function SentenceColumnGenerator({
  columns,
  language,
  className = "",
}: SentenceColumnGeneratorProps) {
  const { tutorGender } = useLanguage();

  // -1 means "not yet chosen" — avoids browser auto-scrolling to a checked radio on mount
  const [selections, setSelections] = useState<number[]>(
    columns.map(() => -1)
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // For the assembled preview, fall back to index 0 when nothing is explicitly chosen
  const effectiveSelections = selections.map(s => (s === -1 ? 0 : s));

  // Join parts intelligently: if the first part is a question opener (¿…?),
  // move the closing ? to the end so "¿Tomó? un autobús" → "¿Tomó un autobús?"
  function assemblePhrase(parts: string[]): string {
    const filtered = parts.filter(Boolean);
    if (filtered.length === 0) return "";
    if (filtered.length === 1) return filtered[0];
    const first = filtered[0];
    if (first.startsWith("¿") && first.endsWith("?")) {
      const stem = first.slice(0, -1); // strip trailing ?
      return stem + " " + filtered.slice(1).join(" ") + "?";
    }
    return filtered.join(" ");
  }

  // Same idea for English translations: "did you take? a bus" → "did you take a bus?"
  function assembleTranslation(parts: string[]): string {
    const filtered = parts.filter(Boolean);
    if (filtered.length === 0) return "";
    if (filtered.length === 1) return filtered[0];
    const first = filtered[0];
    if (first.endsWith("?")) {
      const stem = first.slice(0, -1);
      return stem + " " + filtered.slice(1).join(" ") + "?";
    }
    return filtered.join(" ");
  }

  const assembledText = assemblePhrase(
    columns.map((col, i) => col.items[effectiveSelections[i]]?.text ?? "")
  );

  const assembledTranslation = assembleTranslation(
    columns.map((col, i) => col.items[effectiveSelections[i]]?.translation ?? "")
  );

  // Plays a given sentence string — used both for the bottom bar and auto-play on selection
  const playSentence = useCallback(async (text: string) => {
    if (!text) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(true);
    try {
      const res = await apiRequest("POST", "/api/tts/pronunciation", {
        text,
        language,
        tutorGender: tutorGender ?? "female",
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
  }, [language, tutorGender]);

  // When a chip is selected, update selections AND auto-play the full sentence
  const handleSelect = useCallback((colIndex: number, itemIndex: number) => {
    setSelections(prev => {
      const next = [...prev];
      next[colIndex] = itemIndex;
      // Compute the assembled text with the new selections immediately
      const parts = columns
        .map((col, i) => col.items[i === colIndex ? itemIndex : (next[i] === -1 ? 0 : next[i])]?.text ?? "");
      const fullText = assemblePhrase(parts);
      // Auto-play the full sentence for this new combination
      playSentence(fullText);
      return next;
    });
  }, [columns, playSentence]);

  const handlePlay = useCallback(() => {
    playSentence(assembledText);
  }, [assembledText, playSentence]);

  if (!columns || columns.length === 0) return null;

  return (
    <div className={`space-y-4 ${className}`} data-testid="sentence-column-generator">

      {/* ── Column grid ── */}
      <div
        className="grid gap-x-2 gap-y-0"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
        data-testid="column-grid"
      >
        {columns.map((col, colIdx) => (
          <div key={colIdx} data-testid={`column-${colIdx}`}>
            {col.label && (
              <p
                className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 pb-1"
                data-testid={`label-column-${colIdx}`}
              >
                {col.label}
              </p>
            )}
            <div className="rounded-md border overflow-hidden">
              {col.items.map((item, itemIdx) => {
                const isSelected = selections[colIdx] === itemIdx;
                return (
                  <label
                    key={itemIdx}
                    className={`
                      flex items-center gap-2 px-3 py-2 cursor-pointer select-none
                      transition-colors border-b last:border-b-0
                      ${isSelected
                        ? "bg-primary/10 text-primary"
                        : "hover-elevate"
                      }
                    `}
                    data-testid={`item-col${colIdx}-${itemIdx}`}
                  >
                    <input
                      type="radio"
                      name={`col-${colIdx}`}
                      checked={selections[colIdx] !== -1 && isSelected}
                      onChange={() => handleSelect(colIdx, itemIdx)}
                      className="accent-primary shrink-0"
                      data-testid={`radio-col${colIdx}-${itemIdx}`}
                    />
                    {item.imageQuery && (
                      <ColumnItemImage imageQuery={item.imageQuery} text={item.text} language={language} />
                    )}
                    <span className="flex-1 min-w-0">
                      <span
                        className={`block text-sm font-medium leading-snug ${isSelected ? "text-primary" : ""}`}
                        data-testid={`text-item-col${colIdx}-${itemIdx}`}
                      >
                        {item.text}
                      </span>
                      <span
                        className="block text-[11px] text-muted-foreground leading-tight"
                        data-testid={`text-translation-col${colIdx}-${itemIdx}`}
                      >
                        {item.translation}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Assembled sentence bar — full sentence with replay + mic ── */}
      <div
        className="flex items-center gap-3 rounded-md bg-muted/60 border border-dashed px-4 py-3"
        data-testid="assembled-sentence-bar"
      >
        <div className="flex-1 min-w-0">
          <p
            className="font-semibold text-base leading-snug"
            data-testid="text-assembled-sentence"
          >
            {assembledText}
          </p>
          <p
            className="text-xs text-muted-foreground mt-0.5"
            data-testid="text-assembled-translation"
          >
            {assembledTranslation}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            onClick={handlePlay}
            disabled={isPlaying || !assembledText}
            data-testid="button-play-assembled"
            title="Replay sentence"
          >
            {isPlaying
              ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
              : <Volume2 className="h-4 w-4" />
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
