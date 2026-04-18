import { useState, useCallback } from "react";
import { Volume2, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/queryClient";

export interface ColumnItem {
  text: string;
  translation: string;
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

  const [selections, setSelections] = useState<number[]>(
    columns.map(() => 0)
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioRef] = useState<{ current: HTMLAudioElement | null }>({ current: null });

  const assembledText = columns
    .map((col, i) => col.items[selections[i]]?.text ?? "")
    .filter(Boolean)
    .join(" ");

  const assembledTranslation = columns
    .map((col, i) => col.items[selections[i]]?.translation ?? "")
    .filter(Boolean)
    .join(" ");

  const handleSelect = useCallback((colIndex: number, itemIndex: number) => {
    setSelections(prev => {
      const next = [...prev];
      next[colIndex] = itemIndex;
      return next;
    });
  }, []);

  const handlePlay = useCallback(async () => {
    if (isPlaying || !assembledText) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(true);
    try {
      const res = await apiRequest("POST", "/api/tts/pronunciation", {
        text: assembledText,
        language,
        gender: tutorGender ?? "female",
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setIsPlaying(false);
        audioRef.current = null;
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setIsPlaying(false);
        audioRef.current = null;
        URL.revokeObjectURL(url);
      };
      audio.play();
    } catch {
      setIsPlaying(false);
    }
  }, [assembledText, isPlaying, language, tutorGender, audioRef]);

  const handlePlaySingle = useCallback(async (text: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    try {
      const res = await apiRequest("POST", "/api/tts/pronunciation", {
        text,
        language,
        gender: tutorGender ?? "female",
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        audioRef.current = null;
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        audioRef.current = null;
        URL.revokeObjectURL(url);
      };
      audio.play();
    } catch {
      // silent fail
    }
  }, [language, tutorGender, audioRef]);

  if (!columns || columns.length === 0) return null;

  return (
    <div className={`space-y-4 ${className}`} data-testid="sentence-column-generator">

      {/* ── Assembled sentence bar ── */}
      <div
        className="flex items-center gap-3 rounded-md bg-muted/60 border px-4 py-3"
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
            title="Listen to sentence"
          >
            <Volume2 className={`h-4 w-4 ${isPlaying ? "text-primary animate-pulse" : ""}`} />
          </Button>
          <Button
            size="icon"
            variant={isRecording ? "secondary" : "ghost"}
            onClick={() => setIsRecording(r => !r)}
            data-testid="button-mic-assembled"
            title="Say this sentence"
          >
            {isRecording
              ? <MicOff className="h-4 w-4 text-destructive" />
              : <Mic className="h-4 w-4" />
            }
          </Button>
        </div>
      </div>

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
                      checked={isSelected}
                      onChange={() => handleSelect(colIdx, itemIdx)}
                      className="accent-primary shrink-0"
                      data-testid={`radio-col${colIdx}-${itemIdx}`}
                    />
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
                    <button
                      type="button"
                      onClick={e => {
                        e.preventDefault();
                        handlePlaySingle(item.text);
                      }}
                      className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                      data-testid={`button-play-item-col${colIdx}-${itemIdx}`}
                      title={`Hear "${item.text}"`}
                    >
                      <Volume2 className="h-3 w-3" />
                    </button>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
