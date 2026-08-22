/**
 * BookSpread.tsx
 * Full-screen paginated book reader — mimics opening a physical book.
 *
 * - Single pages appear alone (right-hand page, like the opening of a chapter)
 * - Two-page spreads appear side-by-side with a center spine shadow
 * - Keyboard (← →) and tap/click navigation
 * - No scrolling within a spread — each page is fixed-height
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BookPageDef {
  node: React.ReactNode;
  bookPageNum?: number;
}

export interface SpreadDef {
  /** 1 page = single (right-hand page). 2 pages = facing spread. */
  pages: BookPageDef[];
}

interface BookSpreadProps {
  spreads: SpreadDef[];
  onBack: () => void;
  backLabel?: string;
}

// ── BookSpread ─────────────────────────────────────────────────────────────────

export function BookSpread({
  spreads,
  onBack,
  backLabel = "All Chapters",
}: BookSpreadProps) {
  const [idx, setIdx] = useState(0);
  const total = spreads.length;
  const spread = spreads[idx];
  const isSingle = spread.pages.length === 1;

  const goNext = useCallback(() => setIdx((i) => Math.min(i + 1, total - 1)), [total]);
  const goPrev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goNext();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  const pageNums = spread.pages
    .map((p) => p.bookPageNum)
    .filter((n): n is number => n !== undefined);
  const pageLabel =
    pageNums.length === 1
      ? `p. ${pageNums[0]}`
      : pageNums.length === 2
        ? `pp. ${pageNums[0]}–${pageNums[1]}`
        : null;

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-background"
      data-testid="book-spread-reader"
    >
      {/* ── Top strip ── */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b bg-background/95 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1 -ml-1"
          data-testid="button-back-to-chapters"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </Button>
        <div className="flex items-center gap-3">
          {pageLabel && (
            <span className="text-xs text-muted-foreground">{pageLabel}</span>
          )}
        </div>
      </div>

      {/* ── Book area ── */}
      <div className="flex-1 min-h-0 flex items-stretch px-1 py-2 gap-0">
        {/* Prev arrow */}
        <button
          onClick={goPrev}
          disabled={idx === 0}
          className="shrink-0 flex items-center justify-center w-7 text-muted-foreground/40 hover:text-foreground disabled:opacity-10 disabled:cursor-not-allowed transition-colors"
          data-testid="button-book-prev"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Pages */}
        <div
          className={cn(
            "flex-1 min-h-0 min-w-0 flex",
            isSingle && "justify-center",
          )}
        >
          {isSingle ? (
            <div className="h-full w-full max-w-md">
              <BookPageShell pageNum={spread.pages[0].bookPageNum}>
                {spread.pages[0].node}
              </BookPageShell>
            </div>
          ) : (
            <>
              {/* Left page */}
              <div className="flex-1 min-w-0 h-full">
                <BookPageShell side="left" pageNum={spread.pages[0].bookPageNum}>
                  {spread.pages[0].node}
                </BookPageShell>
              </div>
              {/* Spine shadow */}
              <div className="relative shrink-0 w-4 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-black/6 to-transparent" />
              </div>
              {/* Right page */}
              <div className="flex-1 min-w-0 h-full">
                <BookPageShell side="right" pageNum={spread.pages[1].bookPageNum}>
                  {spread.pages[1].node}
                </BookPageShell>
              </div>
            </>
          )}
        </div>

        {/* Next arrow */}
        <button
          onClick={goNext}
          disabled={idx === total - 1}
          className="shrink-0 flex items-center justify-center w-7 text-muted-foreground/40 hover:text-foreground disabled:opacity-10 disabled:cursor-not-allowed transition-colors"
          data-testid="button-book-next"
          aria-label="Next page"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* ── Page dots ── */}
      <div className="shrink-0 flex justify-center items-center gap-1.5 py-1.5">
        {spreads.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={cn(
              "rounded-full transition-all duration-200",
              i === idx
                ? "w-4 h-1.5 bg-foreground"
                : "w-1.5 h-1.5 bg-muted-foreground/25 hover:bg-muted-foreground/50",
            )}
            data-testid={`dot-spread-${i}`}
            aria-label={`Go to spread ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

// ── BookPageShell — the paper page container ──────────────────────────────────

export function BookPageShell({
  children,
  side,
  pageNum,
}: {
  children: React.ReactNode;
  side?: "left" | "right";
  pageNum?: number;
}) {
  return (
    <div
      className={cn(
        "h-full flex flex-col overflow-hidden",
        "bg-[#fdf9f2] dark:bg-[#1c1a13]",
        !side && "border border-border/50 rounded-md shadow-sm",
        side === "left" &&
          "border-l border-t border-b border-border/50 rounded-l-md shadow-sm",
        side === "right" &&
          "border-r border-t border-b border-border/50 rounded-r-md shadow-sm",
      )}
    >
      <div className="flex-1 min-h-0 overflow-hidden p-3 flex flex-col">
        {children}
      </div>
      {pageNum !== undefined && (
        <div className="shrink-0 text-center text-[10px] text-muted-foreground/35 pb-1 select-none">
          {pageNum}
        </div>
      )}
    </div>
  );
}
