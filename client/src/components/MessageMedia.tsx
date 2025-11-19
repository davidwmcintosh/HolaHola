import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink } from "lucide-react";

interface StockImageData {
  type: "stock";
  query: string;
  url?: string;
  thumbnailUrl?: string;
  altText?: string;
  attribution?: {
    photographer: string;
    photographerUrl: string;
    unsplashUrl: string;
  };
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
            {item.type === "stock" && item.attribution && loadedImages.has(index) && (
              <div className="bg-muted/50 px-3 py-2 text-xs flex items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  Photo by{" "}
                  <a
                    href={item.attribution.photographerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground hover:underline"
                  >
                    {item.attribution.photographer}
                  </a>{" "}
                  on Unsplash
                </span>
                <a
                  href={item.attribution.unsplashUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="View on Unsplash"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
