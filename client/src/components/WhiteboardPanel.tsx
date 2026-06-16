import { useEffect, useState } from "react";
import { Pencil, ChevronLeft, ChevronRight, BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelWhiteboard } from "./Whiteboard";
import type { WhiteboardItem, WordEchoItem } from "@shared/whiteboard-types";

interface WhiteboardPanelProps {
  items: WhiteboardItem[];
  onClear?: () => void;
  onDrillComplete?: (drillId: string, drillType: string, isCorrect: boolean, responseTimeMs: number, toolContent?: string) => void;
  onTextInputSubmit?: (itemId: string, response: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function WhiteboardPanel({
  items,
  onClear,
  onDrillComplete,
  onTextInputSubmit,
  isCollapsed,
  onToggleCollapse,
}: WhiteboardPanelProps) {
  const hasTextbookPage = items.some(item => item.type === 'textbook_page');
  const hasTeachingCard = items.some(item => item.type === 'teaching_card');

  useEffect(() => {
    if ((hasTextbookPage || hasTeachingCard) && isCollapsed) {
      onToggleCollapse();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTextbookPage, hasTeachingCard]);

  // Word echo overlay — transient flash when a taught word is re-mentioned
  const [wordEcho, setWordEcho] = useState<{ word: string; imageUrl: string } | null>(null);
  const echoItems = items.filter(item => item.type === 'word_echo') as WordEchoItem[];
  const latestEcho = echoItems[echoItems.length - 1];

  useEffect(() => {
    if (!latestEcho) return;
    const duration = latestEcho.data?.durationMs ?? 2500;
    setWordEcho({ word: latestEcho.data.word, imageUrl: latestEcho.data.imageUrl });
    const timer = setTimeout(() => setWordEcho(null), duration);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestEcho?.id]);

  // Filter echo items out of the persistent whiteboard list
  const visibleItems = items.filter(item => item.type !== 'word_echo');

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center py-4 w-10 border-l bg-muted/30">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          data-testid="button-expand-whiteboard-panel"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {visibleItems.length > 0 && (
          <div className="mt-3 flex flex-col items-center gap-1">
            {hasTextbookPage ? (
              <BookOpen className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="text-xs text-muted-foreground">{visibleItems.length}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex flex-col w-[320px] border-l bg-muted/30 min-h-0 overflow-hidden" data-testid="panel-whiteboard">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          {hasTextbookPage ? (
            <BookOpen className="h-4 w-4 text-primary" />
          ) : (
            <Pencil className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium text-sm">
            {hasTextbookPage ? 'Lesson Page' : 'Whiteboard'}
          </span>
          {visibleItems.length > 0 && !hasTextbookPage && (
            <span className="text-xs text-muted-foreground">({visibleItems.length})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onClear && visibleItems.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClear}
              data-testid="button-clear-whiteboard-panel"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            data-testid="button-collapse-whiteboard-panel"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar flex flex-col justify-start">
        {visibleItems.length > 0 ? (
          <PanelWhiteboard
            items={visibleItems}
            onClear={onClear}
            onDrillComplete={onDrillComplete}
            onTextInputSubmit={onTextInputSubmit}
          />
        ) : (
          <div className="flex flex-col items-center text-center pt-6 gap-3">
            <div className="rounded-full bg-muted p-4">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Whiteboard is clear</p>
              <p className="text-xs text-muted-foreground max-w-[220px] mt-1">
                Your tutor will write vocabulary, grammar, and notes here as you learn
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Word echo overlay — brief image flash when a taught word is re-mentioned */}
      {wordEcho && (
        <div
          className="absolute bottom-4 right-4 animate-in fade-in zoom-in-95 duration-200 z-10"
          data-testid="word-echo-overlay"
        >
          <div className="rounded-md border bg-card shadow-md overflow-hidden w-20">
            <img
              src={wordEcho.imageUrl}
              alt={wordEcho.word}
              className="w-full aspect-square object-cover object-top"
            />
            <p className="text-[10px] font-bold text-center text-primary py-0.5 px-1 leading-tight">
              {wordEcho.word}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
