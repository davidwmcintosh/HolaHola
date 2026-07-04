import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface StockImageData {
  type: "stock";
  query: string;
  url?: string;
  thumbnailUrl?: string;
  altText?: string;
}

interface AIImageData {
  type: "ai_generated";
  prompt: string;
  context?: string;
  url?: string;
}

type MediaItem = StockImageData | AIImageData;

interface MessageMediaProps {
  media: MediaItem[];
}

export function MessageMedia({ media }: MessageMediaProps) {
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());

  const handleImageLoad = (index: number) => {
    setLoadedImages((prev) => new Set(Array.from(prev).concat([index])));
  };

  if (!media || media.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3">
      {media.map((item, index) => {
        const imageUrl = item.url;
        if (!imageUrl) return null;

        return (
          <div key={index} className="rounded-lg overflow-hidden border">
            {!loadedImages.has(index) && (
              <Skeleton className="w-full h-48" />
            )}
            <img
              src={imageUrl}
              alt={item.type === "stock" ? item.altText || item.query : `AI generated: ${item.prompt}`}
              className={`w-full h-auto max-h-64 object-cover ${
                loadedImages.has(index) ? "block" : "hidden"
              }`}
              onLoad={() => handleImageLoad(index)}
              data-testid={`image-${item.type}-${index}`}
            />
          </div>
        );
      })}
    </div>
  );
}
