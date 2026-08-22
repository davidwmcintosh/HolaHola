/**
 * VocabImageCard — vocabulary image card for the textbook.
 *
 * Always shows both the target-language label (bold, primary color) and
 * the native-language translation (smaller, muted) below the image.
 * No reveal toggle — textbook is reference/study material.
 *
 * Contrast with the whiteboard ImageItemDisplay, which blurs the native
 * label so students can tap to self-test.
 */

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ZoomIn } from "lucide-react";

export interface VocabImageCardProps {
  word: string;
  translation?: string;
  imageUrl?: string;
  isLoading?: boolean;
  /**
   * Multi-subject labels — when one image depicts several vocabulary words
   * (e.g. a family photo for madre/padre/hermano/hermana/bebé).
   * The textbook always shows all labels — no mode switching.
   */
  labels?: { word: string; translation?: string }[];
  /** Optional click-through to a detail view */
  onClick?: () => void;
}

export function VocabImageCard({
  word,
  translation,
  imageUrl,
  isLoading = false,
  labels,
  onClick,
}: VocabImageCardProps) {
  const multiLabels = labels && labels.length > 0 ? labels : null;
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <div
        className="flex flex-col rounded-md border bg-card overflow-hidden hover-elevate cursor-pointer"
        data-testid={`vocab-card-${word}`}
        onClick={onClick ?? (() => setLightboxOpen(true))}
      >
        {/* Image area */}
        <div className="relative aspect-square bg-muted overflow-hidden group">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : imageUrl ? (
            <>
              <img
                src={imageUrl}
                alt={word}
                className="w-full h-full object-cover object-top"
                data-testid={`img-vocab-${word}`}
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                <ZoomIn className="h-6 w-6 text-white drop-shadow" />
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
              No image
            </div>
          )}
        </div>

        {/* Label area — textbook always shows all labels */}
        {multiLabels ? (
          /* Multi-subject: chip row for each vocabulary word in the image */
          <div className="flex flex-wrap justify-center gap-1 px-2 py-1.5">
            {multiLabels.map((label, i) => (
              <div
                key={i}
                className="flex flex-col items-center leading-tight px-1.5 py-0.5 rounded bg-primary/8"
                data-testid={`chip-${word}-${label.word}`}
              >
                <span className="text-[11px] font-bold text-primary">
                  {label.word}
                </span>
                {label.translation && (
                  <span className="text-[9px] text-muted-foreground">
                    {label.translation}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Single subject: standard bilingual label */
          <div className="flex flex-col items-center px-2 py-1.5 gap-0.5">
            <span
              className="text-[13px] font-bold text-primary leading-tight text-center"
              data-testid={`label-target-${word}`}
            >
              {word}
            </span>
            {translation && (
              <span
                className="text-[10px] text-muted-foreground leading-tight text-center"
                data-testid={`label-native-${word}`}
              >
                {translation}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {imageUrl && (
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent
            className="max-w-xl p-0 overflow-hidden bg-black border-0"
            data-testid={`lightbox-vocab-${word}`}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageUrl}
              alt={word}
              className="w-full h-auto max-h-[70vh] object-contain"
            />
            <div className="flex flex-col items-center py-3 bg-black/80 gap-0.5">
              <p className="text-white font-bold text-base">{word}</p>
              {translation && (
                <p className="text-white/60 text-sm">{translation}</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/**
 * VocabImageGrid — renders a responsive grid of VocabImageCards.
 * Used by TextbookSectionRenderer and ChapterIntroduction for
 * vocabulary sections that have pre-seeded images.
 */
export interface VocabImageGridItem {
  word: string;
  translation?: string;
  imageUrl?: string;
  isLoading?: boolean;
  labels?: { word: string; translation?: string }[];
}

export function VocabImageGrid({ items }: { items: VocabImageGridItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {items.map((item) => (
        <VocabImageCard
          key={item.word}
          word={item.word}
          translation={item.translation}
          imageUrl={item.imageUrl}
          isLoading={item.isLoading}
          labels={item.labels}
        />
      ))}
    </div>
  );
}
