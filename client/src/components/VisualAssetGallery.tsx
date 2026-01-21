import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Image,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X
} from "lucide-react";

interface VisualAsset {
  id: string;
  chapterId?: string;
  lessonId?: string;
  language: string;
  assetType: string;
  title?: string;
  description?: string;
  imageUrl: string;
  thumbnailUrl?: string;
  imageSource: string;
  attribution?: string;
  sortOrder: number;
}

interface VisualAssetGalleryProps {
  chapterId?: string;
  lessonId?: string;
  language: string;
  title?: string;
  className?: string;
}

function AssetTypeLabel({ type }: { type: string }) {
  const labels: Record<string, { label: string; color: string }> = {
    hero: { label: "Hero", color: "bg-primary/10 text-primary" },
    infographic: { label: "Infographic", color: "bg-blue-500/10 text-blue-600" },
    vocabulary: { label: "Vocabulary", color: "bg-green-500/10 text-green-600" },
    cultural: { label: "Cultural", color: "bg-orange-500/10 text-orange-600" },
    grammar: { label: "Grammar", color: "bg-purple-500/10 text-purple-600" },
    concept: { label: "Concept", color: "bg-yellow-500/10 text-yellow-700" },
  };
  
  const { label, color } = labels[type] || { label: type, color: "bg-muted" };
  
  return (
    <Badge variant="outline" className={`text-xs ${color}`}>
      {label}
    </Badge>
  );
}

function ImageLightbox({ 
  asset, 
  onClose 
}: { 
  asset: VisualAsset; 
  onClose: () => void;
}) {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh] p-4">
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-2 right-2 text-white hover:bg-white/20"
          onClick={onClose}
          data-testid="button-close-lightbox"
        >
          <X className="h-5 w-5" />
        </Button>
        
        <img
          src={asset.imageUrl}
          alt={asset.title || "Visual asset"}
          className="max-w-full max-h-[80vh] object-contain rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
        
        {(asset.title || asset.description || asset.attribution) && (
          <div className="mt-4 text-white text-center" onClick={(e) => e.stopPropagation()}>
            {asset.title && <h3 className="font-semibold text-lg">{asset.title}</h3>}
            {asset.description && <p className="text-sm opacity-80 mt-1">{asset.description}</p>}
            {asset.attribution && (
              <p className="text-xs opacity-60 mt-2">Photo: {asset.attribution}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function VisualAssetGallery({
  chapterId,
  lessonId,
  language,
  title = "Visual Resources",
  className = ""
}: VisualAssetGalleryProps) {
  const [selectedAsset, setSelectedAsset] = useState<VisualAsset | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const queryParams = new URLSearchParams({
    language,
    ...(chapterId && { chapterId }),
    ...(lessonId && { lessonId }),
  });
  
  const { data: assets, isLoading } = useQuery<VisualAsset[]>({
    queryKey: ['/api/textbook/visual-assets', chapterId, lessonId, language],
    queryFn: async () => {
      const res = await fetch(`/api/textbook/visual-assets?${queryParams}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!(chapterId || lessonId),
  });
  
  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Image className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{title}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="aspect-video rounded-md" />
            <Skeleton className="aspect-video rounded-md" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!assets || assets.length === 0) {
    return null;
  }
  
  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : assets.length - 1));
  };
  
  const handleNext = () => {
    setCurrentIndex((prev) => (prev < assets.length - 1 ? prev + 1 : 0));
  };
  
  const displayedAssets = assets.length > 4 
    ? assets.slice(currentIndex, currentIndex + 4)
    : assets;
    
  return (
    <>
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Image className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{title}</span>
            </div>
            
            {assets.length > 4 && (
              <div className="flex items-center gap-1">
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-7 w-7"
                  onClick={handlePrev}
                  data-testid="button-gallery-prev"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {currentIndex + 1}-{Math.min(currentIndex + 4, assets.length)} of {assets.length}
                </span>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-7 w-7"
                  onClick={handleNext}
                  data-testid="button-gallery-next"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {displayedAssets.map((asset) => (
              <div
                key={asset.id}
                className="group relative aspect-video rounded-md overflow-hidden cursor-pointer hover-elevate"
                onClick={() => setSelectedAsset(asset)}
                data-testid={`visual-asset-${asset.id}`}
              >
                <img
                  src={asset.thumbnailUrl || asset.imageUrl}
                  alt={asset.title || "Visual asset"}
                  className="w-full h-full object-cover"
                />
                
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <Maximize2 className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                
                <div className="absolute top-1 left-1">
                  <AssetTypeLabel type={asset.assetType} />
                </div>
                
                {asset.title && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-xs text-white font-medium truncate">
                      {asset.title}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {selectedAsset && (
        <ImageLightbox 
          asset={selectedAsset} 
          onClose={() => setSelectedAsset(null)} 
        />
      )}
    </>
  );
}

export default VisualAssetGallery;
